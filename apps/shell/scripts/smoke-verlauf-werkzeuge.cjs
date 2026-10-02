/**
 * Rauchtest: „Zurueck" innerhalb eines Werkzeugs.
 *
 * Rueckmeldung: „Wenn man eine Liste oeffnet und dann zurueck drueckt, kommt
 * man nicht zur Liste, sondern zum letzten Tool." Geprueft an Loot (eine
 * Tabelle), Nachschlagewerk (zwei Eintraege nacheinander) und Magic Items
 * (ein gespeicherter Gegenstand): zurueck fuehrt erst durch das Werkzeug,
 * vorwaerts wieder hinein, und erst danach zum vorigen Werkzeug.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-verlauf-werkzeuge.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verlauf-wz-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(path.join(userData, 'magicitems', 'gegenstaende'), { recursive: true });
fs.writeFileSync(
  path.join(userData, 'magicitems', 'gegenstaende', 'klinge.md'),
  '---\nname: Klinge\nart: waffe\nseltenheit: rare\neinstimmung: nein\nwert: 4000\ngeaendert: 2026-01-01\n---\n## Wirkungen\n\n- Glaenzt.\n'
);
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'en', einfuehrungGesehen: ['suite', 'loot', 'nachschlagewerk', 'magicitems', 'backstory'] })
);
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

app.whenReady().then(async () => {
  await warte(4000);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const sicht = (id) => fenster.contentView.children.find((v) => v.webContents.getURL().includes(`/apps/${id}/`));
  // Das erste Werkzeug ueber die Kachel, die weiteren ueber die Schiene:
  // ein Umweg ueber die Startseite stuende selbst im Verlauf.
  const oeffneApp = async (id) => {
    const kachel = await hjs(`(() => { const k = document.querySelector('[data-app="${id}"]'); if (!k || k.offsetParent === null) return false; k.click(); return true; })()`);
    if (!kachel) {
      await hjs(`document.querySelector('[data-schiene="${id}"]').click(); true`);
    }
    await warte(3500);
    return (a) => sicht(id).webContents.executeJavaScript(a);
  };
  const zurueck = async () => {
    await hjs(`document.querySelector('.titelleiste__verlauf button').click(); true`);
    await warte(1400);
  };
  const vor = async () => {
    await hjs(`document.querySelectorAll('.titelleiste__verlauf button')[1].click(); true`);
    await warte(1400);
  };
  const aktiv = () => hjs("document.querySelector('.schiene__eintrag--an')?.getAttribute('title') ?? ''");

  // --- Nachschlagewerk: zwei Eintraege, dann zurueck ------------------------
  const nw = await oeffneApp('nachschlagewerk');
  await nw(`document.querySelector('.eintrag[data-regel="zustand/blinded"]').click(); true`);
  await warte(600);
  await nw(`document.querySelector('.eintrag[data-regel="zustand/prone"]').click(); true`);
  await warte(600);
  await zurueck();
  await warte(500);
  pruefe(
    (await nw("document.querySelector('article.regel')?.dataset.regel ?? ''")) === 'zustand/blinded',
    'Nachschlagewerk: zurueck fuehrt zum vorigen Eintrag'
  );
  await vor();
  pruefe(
    (await nw("document.querySelector('article.regel')?.dataset.regel ?? ''")) === 'zustand/prone',
    'und vorwaerts wieder zum naechsten'
  );

  // --- Loot: eine Tabelle oeffnen, zurueck zur Liste ------------------------
  const loot = await oeffneApp('loot');
  await loot(`document.querySelector('.tabellenkachel').click(); true`);
  await warte(700);
  pruefe(!(await loot("Boolean(document.querySelector('.tabellenkachel'))")), 'Loot: eine Tabelle ist offen');
  await zurueck();
  pruefe(
    (await loot("Boolean(document.querySelector('.tabellenkachel'))")) && /Loot/.test(await aktiv()),
    'Loot: zurueck fuehrt zur Liste und bleibt im Loot Generator'
  );

  // --- Magic Items: ein Gegenstand, zurueck zur Sammlung --------------------
  const mi = await oeffneApp('magicitems');
  await mi(`document.querySelector('.gegenstandskachel').click(); true`);
  await warte(700);
  pruefe(await mi("Boolean(document.querySelector('[data-speichern]'))"), 'Magic Items: der Gegenstand ist offen');
  await zurueck();
  pruefe(
    (await mi("Boolean(document.querySelector('.gegenstandskachel'))")) && /Magic/.test(await aktiv()),
    'Magic Items: zurueck fuehrt zur Sammlung'
  );
  // Erst jetzt geht es aus dem Werkzeug hinaus.
  await zurueck();
  pruefe(/Loot/.test(await aktiv()), 'noch einmal zurueck: erst dann das vorige Werkzeug');

  // --- Teilen: „Zuletzt geoeffnet" ganz oben ---------------------------------
  await hjs(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(1000);
  await hjs(`document.querySelector('[data-richtung="datei"]').click(); true`);
  await warte(600);
  const gruppen = await hjs("[...document.querySelectorAll('[data-austausch=\"geben\"] [data-gruppe]')].map(g => g.dataset.gruppe)");
  const zuletzt = await hjs("[...document.querySelectorAll('[data-gruppe=\"~zuletzt\"] [data-teilen]')].map(e => e.dataset.teilen)");
  pruefe(gruppen[0] === '~zuletzt', `„Zuletzt geoeffnet" steht als eigene Gruppe ganz oben (${gruppen.slice(0, 3).join(', ')})`);
  pruefe(
    // Zuletzt war der Gegenstand im Magic Item Generator offen, davor die Regeln.
    zuletzt[0] === 'magicitems/klinge' &&
      zuletzt.indexOf('nachschlagewerk/zustand/prone') < zuletzt.indexOf('nachschlagewerk/zustand/blinded'),
    `mit den zuletzt geoeffneten Eintraegen, neueste zuerst (${zuletzt.join(', ')})`
  );

  await hjs(`document.querySelector('.dialog__fuss .dialog__knopf')?.click(); true`);
  await warte(400);

  // --- Story Creator: Graph, Zeitstrahl und Handlungsstränge stehen im Verlauf -------
  const sc = await oeffneApp('backstory');
  await sc(`(async () => {
    const aus = (a) => (a && 'value' in a ? a.value : a);
    let k = (aus(await window.api.campaigns.list()) ?? [])[0];
    if (!k) k = aus(await window.api.campaigns.create('Testrunde'));
    await window.api.notes.create(k.id, 'note', 'Erste Notiz');
    return true; })()`);
  // Neu laden, damit die Notiz in der Liste steht.
  sicht('backstory').webContents.reload();
  await warte(3000);
  await sc(`document.querySelector('.note-list button, [data-note-id]')?.click(); true`);
  await warte(600);
  await sc(`document.querySelector('[data-graph-knopf]').click(); true`);
  await warte(600);
  await sc(`document.querySelector('[data-ansicht="zeit"]').click(); true`);
  await warte(600);
  await sc(`document.querySelector('[data-ansicht="straenge"]').click(); true`);
  await warte(600);
  const reiter = () => sc(`document.querySelector('[data-ansicht][aria-selected="true"]')?.dataset.ansicht ?? 'kein Graph'`);
  await zurueck();
  pruefe((await reiter()) === 'zeit', `Story: zurück von den Handlungssträngen zum Zeitstrahl (${await reiter()})`);
  await zurueck();
  pruefe((await reiter()) === 'graph', `Story: noch einmal zurück zum Graphen (${await reiter()})`);
  await zurueck();
  pruefe((await reiter()) === 'kein Graph', 'Story: und dann zurück zur Notiz');
  await vor();
  pruefe((await reiter()) === 'graph', 'Story: vor führt wieder in den Graphen');

  console.log(fehler.length === 0 ? '\nVerlauf in den Werkzeugen bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
