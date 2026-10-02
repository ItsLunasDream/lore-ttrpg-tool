/**
 * Die Einfuehrung beim ersten Start und beim ersten Oeffnen eines Werkzeugs.
 *
 * Der interessante Teil ist nicht, dass das Fenster aufgeht — das ist ein
 * Dialog wie die anderen. Interessant ist, dass es genau EINMAL aufgeht:
 * eine Einfuehrung, die bei jedem Start wiederkommt, ist schlimmer als gar
 * keine. Geprueft wird darum ueber zwei Starts hinweg, mit demselben
 * Datenordner.
 *
 * Aufruf: EINFUEHRUNG_LAUF=1 xvfb-run -a electron scripts/smoke-einfuehrung.cjs --no-sandbox
 *         EINFUEHRUNG_LAUF=2 xvfb-run -a electron scripts/smoke-einfuehrung.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

/*
 * Derselbe Datenordner ueber beide Durchlaeufe.
 *
 * Der Test laeuft ZWEIMAL, als zwei Prozesse: EINFUEHRUNG_LAUF=1 und dann
 * EINFUEHRUNG_LAUF=2 (siehe das smoke-Skript in package.json). Anders ist
 * der eigentliche Punkt nicht zu zeigen — dass nach einem Neustart nichts
 * mehr kommt. Zwei Electron-Prozesse gleichzeitig auf demselben Datenordner
 * gehen dabei nicht: die zweite Sitzung bekommt die Dateien der ersten nicht
 * zu fassen und laedt kein Werkzeug mehr.
 */
const zweiterLauf = process.env.EINFUEHRUNG_LAUF === '2';
const userData = path.join(os.tmpdir(), 'ttrpg-einfuehrung-smoke');
// Der erste Lauf faengt bei Null an, auch nach einem abgebrochenen Versuch.
if (!zweiterLauf) fs.rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
fs.mkdirSync(userData, { recursive: true });

app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

/* Ein stiller Haenger ist die schlechteste Art zu scheitern. */
process.on('unhandledRejection', (grund) => {
  console.log('FEHLER: unbehandelte Ablehnung:', grund);
  app.exit(1);
});

const einstellungsdatei = () => path.join(userData, 'einstellungen.json');
const gesehen = () => {
  try {
    return JSON.parse(fs.readFileSync(einstellungsdatei(), 'utf8')).einfuehrungGesehen ?? [];
  } catch {
    return [];
  }
};

app.whenReady().then(async () => {
  await warte(4000);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1200, height: 800 });
  await warte(600);
  const sicht = fenster.contentView.children[0];
  const js = (a) => sicht.webContents.executeJavaScript(a);

  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  const dialogTitel = () =>
    js("document.querySelector('.dialog__titel')?.textContent ?? ''");
  const schliesse = () => js("document.querySelector('.dialog__knopf').click()");

  if (!zweiterLauf) {
    console.log('\nErster Start:');
    pruefe((await dialogTitel()) === 'Welcome', `das Willkommen steht da (${await dialogTitel()})`);
    pruefe(
      (await js("document.querySelectorAll('.einfuehrung__punkte li').length")) >= 3,
      'mit mindestens drei Punkten'
    );
    pruefe(
      (await js("document.querySelector('.dialog__knopf').textContent")) !== 'Close',
      'der Knopf sagt nicht "Schliessen", sondern "los"'
    );

    await schliesse();
    await warte(400);
    pruefe(!(await js("Boolean(document.querySelector('.dialog'))")), 'und laesst sich schliessen');
    pruefe(gesehen().includes('suite'), 'das Willkommen ist gemerkt');

    console.log('\nErstes Oeffnen eines Werkzeugs:');
    // Die Wuerfel: das kleinste Werkzeug, und es braucht keine Dateien.
    await js(
      "[...document.querySelectorAll('.kachel')].find(k => k.textContent.includes('Dice')).click()"
    );
    await warte(4000);
    pruefe(
      (await dialogTitel()).length > 0,
      `die Einfuehrung des Werkzeugs steht da (${await dialogTitel()})`
    );
    pruefe(
      await js("Boolean(document.querySelector('.einfuehrung__symbol'))"),
      'mit dem Symbol des Werkzeugs'
    );
    await schliesse();
    await warte(500);
    pruefe(gesehen().includes('dice'), 'und ist danach gemerkt');

    console.log('\nZurueck und wieder hin:');
    await js("document.querySelector('.schiene__heim').click()");
    await warte(1200);
    await js(
      "[...document.querySelectorAll('.kachel')].find(k => k.textContent.includes('Dice')).click()"
    );
    await warte(3000);
    pruefe(
      !(await js("Boolean(document.querySelector('.dialog'))")),
      'beim zweiten Mal kommt nichts mehr'
    );

    pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);

    console.log(fehler.length === 0 ? '\nErster Lauf bestanden.' : `\n${fehler.length} Fehler.`);
    app.exit(fehler.length === 0 ? 0 : 1);
    return;
  }

  console.log('\nZweiter Start, derselbe Datenordner:');
  pruefe(
    !(await js("Boolean(document.querySelector('.dialog'))")),
    'kein Willkommen mehr'
  );

  console.log('\nZuruecksetzen in den Einstellungen:');
  await js("document.querySelector('[data-einstellungen-knopf]').click()");
  await warte(400);
  // Der Knopf liegt seit dem Umbau unter „Daten & Sicherung" und nicht mehr
  // in einer langen Liste.
  await js(`(() => {
    const k = document.querySelector('.einst__nav-knopf[data-bereich="daten"]');
    if (k) k.click();
    return Boolean(k);
  })()`);
  await warte(500);
  await js(
    "[...document.querySelectorAll('.feld__knoepfe button')].find(b => b.textContent.includes('introduction')).click()"
  );
  await warte(600);
  pruefe(gesehen().length === 0, 'die Liste der gesehenen Einfuehrungen ist leer');
  await schliesse();
  await warte(400);

  await js(
    "[...document.querySelectorAll('.kachel')].find(k => k.textContent.includes('Dice')).click()"
  );
  await warte(4000);
  pruefe(
    await js("Boolean(document.querySelector('.einfuehrung__punkte'))"),
    'und die Einfuehrung kommt wieder'
  );

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nEinfuehrung bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
