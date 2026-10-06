/**
 * Startet das *gepackte* Paket der Sammlung und prueft zweierlei: dass die
 * Huelle ohne fehlende Module hochkommt, und dass die Dateien der
 * eingebetteten Anwendungen wirklich im Paket liegen.
 *
 * Das zweite ist der eigentliche Grund fuer dieses Skript. Die Huelle rechnet
 * sich den Weg zu diesen Dateien aus (`appDistDir`), und im Paket ist das ein
 * anderer als im Workspace. Stimmt er nicht, startet die Huelle trotzdem —
 * nur bleibt jede Anwendung eine leere Flaeche, ohne Fehlermeldung. Genau
 * diese Sorte Fehler hat beim Einbetten schon einmal zugeschlagen.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const binary = process.argv[2];
if (!binary) {
  console.error('Aufruf: node scripts/verify-package.mjs <pfad-zur-anwendung>');
  process.exit(1);
}

const BOOT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;
/** Windows gibt Dateien erst kurz nach dem Beenden frei. */
const RELEASE_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --user-data-dir setzt app.getPath('userData') direkt und funktioniert auf
// allen Plattformen gleich. Ueber HOME zu gehen waere je nach System anders.
const userDataDir = await mkdtemp(path.join(tmpdir(), 'ttrpg-pkg-'));

// NODE_OPTIONS lehnen gepackte Electron-Anwendungen ab. Ist die Variable in
// der Umgebung gesetzt, wuerde die Pruefung daran scheitern statt am Paket.
const { NODE_OPTIONS: _ignored, ...env } = process.env;

const output = [];
/**
 * Gestartet wird gleich mit einem Werkzeug. Ohne das kaeme die Huelle zwar
 * hoch, aber niemand haette je eine Anwendung darin geoeffnet — und ob deren
 * Dateien im Paket gefunden werden, haengt an Pfaden, die hier anders sind
 * als im Workspace. Der Beleg kommt weiter unten aus dem Log: der Backstory
 * Creator legt beim Montieren seinen Speicherort an.
 */
const child = spawn(binary, [`--user-data-dir=${userDataDir}`, '--no-sandbox', '--enable-logging'], {
  env: { ...env, TTRPG_TOOLS_START_APP: 'backstory' },
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.on('data', (chunk) => output.push(String(chunk)));
child.stderr.on('data', (chunk) => output.push(String(chunk)));

let exitCode = null;
let spawnError = null;
child.once('exit', (code) => {
  exitCode = code;
});
child.once('error', (error) => {
  spawnError = error;
});

/**
 * Gewartet wird auf die Bereitmeldung der Huelle: `[shell] bereit-mit <id>`.
 * Sie steht am Ende der Startfolge, nach `loadFile`.
 *
 * Zwei fruehere Signale waren falsch, beide auf dieselbe Weise. Die
 * einstellungen.json schreibt die Huelle, *bevor* sie ihr Fenster baut. Der
 * Speicherort <userData>/backstory/vault entsteht beim Montieren, *bevor* die
 * Oberflaeche geladen ist. Dieses Skript beendet den Prozess, sobald sein
 * Signal da ist — es traf damit jedes Mal mitten ins Laden, `loadFile` brach
 * mit ERR_FAILED ab, und ob die Pruefung das meldete oder nicht, entschied
 * die Tagesform des Rechners. Ein Signal, das zu frueh kommt, ist schlimmer
 * als keines.
 *
 * Der Speicherort wird trotzdem noch beobachtet, aber nur als Rueckfall: die
 * Bereitmeldung geht ueber stdout, und ob eine gepackte GUI-Anwendung unter
 * Windows dorthin schreiben kann, haengt an der Konsole, die sie vorfindet.
 * Bleibt die Meldung aus, obwohl der Speicherort da ist, bekommt das Laden
 * eine Gnadenfrist statt eines Fehlurteils.
 */
const BEREIT_MARKE = '[shell] bereit-mit';
const GNADENFRIST_MS = 8_000;

async function warteAufBoot() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let speicherortGesehen = false;
  while (Date.now() < deadline) {
    if (spawnError || exitCode !== null) return { bereit: false, ueberRueckfall: false };
    if (output.join('').includes(BEREIT_MARKE)) return { bereit: true, ueberRueckfall: false };
    if (!speicherortGesehen) {
      try {
        speicherortGesehen = (await readdir(path.join(userDataDir, 'backstory'))).includes('vault');
      } catch {
        // Verzeichnis noch nicht da, weiter warten.
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (speicherortGesehen) {
    await sleep(GNADENFRIST_MS);
    const log = output.join('');
    if (log.includes(BEREIT_MARKE)) return { bereit: true, ueberRueckfall: false };
    return { bereit: !/ERR_FAILED/.test(log), ueberRueckfall: true };
  }
  return { bereit: false, ueberRueckfall: false };
}

/**
 * Die Dateien der eingebetteten Anwendungen im Paket.
 *
 * Sie liegen unter resources/apps/<id>/dist — dorthin legt sie
 * electron-builder ueber `extraResources`, und genau dort sucht sie
 * `appDistDir` im gepackten Zustand.
 */
async function pruefeEingebetteteDateien() {
  // Vom Programm aus: eine Ebene hoch, dann resources. Unter Linux und
  // Windows liegt es neben der ausfuehrbaren Datei, unter macOS im
  // Contents-Verzeichnis des Bundles.
  const neben = path.dirname(binary);
  const kandidaten = [
    path.join(neben, 'resources'),
    path.join(neben, '..', 'Resources')
  ];

  let resources = null;
  for (const kandidat of kandidaten) {
    try {
      await access(kandidat);
      resources = kandidat;
      break;
    } catch {
      // naechsten versuchen
    }
  }
  if (!resources) return [`Kein resources-Verzeichnis gefunden, gesucht in: ${kandidaten.join(', ')}`];

  // [id, Ordner unter apps/<id>/, Datei darin]. Der Karteneditor hat sein
  // Sprachkopplungs-Preload in dist-embed/, getrennt von dist/: `vite build`
  // leert dist/ bei jedem Lauf komplett, das getrennt gebuendelte Preload
  // waere sonst weg.
  const erwartet = [
    ['backstory', 'dist', path.join('main', 'preload.js')],
    ['backstory', 'dist', path.join('renderer', 'index.html')],
    ['mapmaker', 'dist', 'index.html'],
    ['mapmaker', 'dist-embed', 'preload.js'],
    // Der Tracker legt beides unter dist/, wie der Story Creator.
    ['initiative', 'dist', path.join('main', 'preload.js')],
    ['initiative', 'dist', path.join('renderer', 'index.html')],
    ['dice', 'dist', path.join('main', 'preload.js')],
    ['dice', 'dist', path.join('renderer', 'index.html')],
    // NPC Creator und Inspirationshilfe fehlten hier lange, obwohl sie
    // laengst mitgepackt werden: die Liste ist beim Anlegen der Werkzeuge
    // nicht mitgewachsen. Aufgefallen ist es erst, als die Inspirationshilfe
    // dazukam und die Frage aufwarf, was das Paket eigentlich prueft.
    ['npc', 'dist', path.join('main', 'preload.js')],
    ['npc', 'dist', path.join('renderer', 'index.html')],
    ['inspiration', 'dist', path.join('main', 'preload.js')],
    ['inspiration', 'dist', path.join('renderer', 'index.html')]
  ];

  const fehlend = [];
  for (const [id, ordner, datei] of erwartet) {
    const voll = path.join(resources, 'apps', id, ordner, datei);
    try {
      await access(voll);
    } catch {
      fehlend.push(voll);
    }
  }
  // Lizenz und Namensnennung gehören ins Paket (NOTICE.md: sie wegzulassen
  // wäre ein Lizenzbruch), ebenso die Lizenzen der Schriften und Symbole.
  for (const datei of ['LICENSE', 'NOTICE.md', 'SCHRIFTEN.md', path.join('symbole', 'LIZENZ.md')]) {
    try {
      await access(path.join(resources, datei));
    } catch {
      fehlend.push(path.join(resources, datei));
    }
  }
  return fehlend.length
    ? [`Dateien fehlen im Paket:\n  ${fehlend.join('\n  ')}`]
    : [];
}

const { bereit, ueberRueckfall } = await warteAufBoot();
if (ueberRueckfall) {
  console.warn(
    `Hinweis: keine Bereitmeldung "${BEREIT_MARKE}" auf stdout, geurteilt wurde ueber den Rueckfall.`
  );
}

if (exitCode === null && !spawnError) {
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
  await sleep(RELEASE_DELAY_MS);
}

const log = output.join('');
const problems = [];

if (spawnError) problems.push(`Anwendung ließ sich nicht starten: ${spawnError.message}`);

const missing = log.match(/Cannot find module[^\n\r]*/g);
if (missing) problems.push(`Fehlendes Modul im Paket:\n  ${[...new Set(missing)].join('\n  ')}`);
if (/A JavaScript error occurred in the main process/.test(log)) problems.push('Hauptprozess ist abgestürzt');
if (/Uncaught Exception/.test(log)) problems.push('Unbehandelte Ausnahme im Hauptprozess');
if (!spawnError && exitCode !== null && exitCode !== 0) {
  problems.push(`Anwendung hat sich vorzeitig mit Code ${exitCode} beendet`);
}
problems.push(...(await pruefeEingebetteteDateien()));

// Die Huelle selbst muss ihre Oberflaeche geladen haben. Aus dem asar heraus
// ist das ein anderer Weg als im Workspace, und ein Fehlschlag dort bricht
// die ganze Startfolge ab.
if (/ERR_FAILED/.test(log)) problems.push('Eine Ansicht liess sich nicht laden (ERR_FAILED)');
if (/UnhandledPromiseRejection/.test(log)) {
  problems.push('Unbehandelte Promise-Ablehnung im Hauptprozess');
}

if (!bereit && !spawnError) {
  let found = '(nicht lesbar)';
  try {
    found = (await readdir(userDataDir)).join(', ') || '(leer)';
  } catch {
    // Meldung unten reicht.
  }
  problems.push(
    'Das mit TTRPG_TOOLS_START_APP geoeffnete Werkzeug ist nicht hochgekommen: keine ' +
      `Bereitmeldung "${BEREIT_MARKE}" innerhalb von ${BOOT_TIMEOUT_MS / 1000} s. ` +
      `Im Datenverzeichnis gefunden: ${found}`
  );
}

if (problems.length) {
  console.error('PAKET FEHLERHAFT\n- ' + problems.join('\n- '));
  await writeFile(path.join(process.cwd(), 'package-verify.log'), log || '(keine Ausgabe)');
  console.error('Vollständiges Log in package-verify.log');
} else {
  console.log('PAKET OK');
}

// Aufraeumen ist Kuer, nicht Pflicht: ein noch gesperrtes Temp-Verzeichnis
// darf das Ergebnis der Pruefung nicht kippen.
try {
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
} catch (error) {
  console.warn(`Temp-Verzeichnis konnte nicht gelöscht werden, wird ignoriert: ${error.message}`);
}

process.exit(problems.length ? 1 : 0);
