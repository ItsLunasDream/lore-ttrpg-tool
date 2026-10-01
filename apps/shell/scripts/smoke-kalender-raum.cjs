/**
 * Rauchtest: Terminumfrage im Raum (docs/kampagnenkalender.md).
 *
 * Die App eröffnet einen Raum, Anna (ein Gast aus dem Protokoll) tritt bei.
 *
 * 1. Solange der Kalender noch nicht offen ist, schickt Anna eine eigene
 *    Umfrage und ihre Antwort. Die Hülle legt beides ab; beim Öffnen steht
 *    die Umfrage mit Annas Antwort da.
 * 2. Die App markiert ihre Zeiten: die Antwort geht an Anna.
 * 3. Annas geänderte Antwort kommt im offenen Kalender an, ohne Neuöffnen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-kalender-raum.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { gast } = require('./raumgast.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kalender-raum-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'kalender'] }));
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};
async function bis(bedingung, ms = 6000) {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) return false;
    await warte(80);
  }
  return true;
}

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 120000);

const TAG = '2026-10-02';
const f = (m) => `${TAG}T${m}`;
const umfrage = {
  id: 'u-anna',
  titel: 'Annas Runde',
  tage: [TAG, '2026-10-03'],
  von: 1080,
  bis: 1320,
  schritt: 60,
  dauer: 120,
  antworten: [],
  termin: null,
  notiz: '',
  geaendert: ''
};

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1400, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);

  const auf = await hjs("window.shell.raum.eroeffnen('Runde', 'pw')");
  pruefe(auf.ok && auf.port > 0, `die Hülle eröffnet einen Raum (Port ${auf.port})`);
  const anna = gast(auf.port, 'pw', 'Anna');
  pruefe(await bis(() => anna.ich !== null), 'Anna tritt bei');
  await warte(300);

  const schicke = (inhalt) => anna.schreibe({ typ: 'werkzeug', von: 'x', an: null, werkzeug: 'kalender', inhalt: JSON.stringify(inhalt), zeit: '' });

  // --- 1. Kalender noch zu: Umfrage und Antwort kommen trotzdem an -------------------
  schicke({ art: 'umfrage', umfrage });
  await warte(300);
  schicke({ art: 'antwort', umfrageId: 'u-anna', antwort: { person: 'Anna', felder: { [f(1140)]: 'kann', [f(1200)]: 'kann' }, zeit: '2026-10-01T10:00:00Z' } });
  const datei = path.join(userData, 'kalender', 'umfragen', 'u-anna.md');
  pruefe(await bis(() => fs.existsSync(datei) && /"person": "Anna"/.test(fs.readFileSync(datei, 'utf8'))), 'die Hülle legt Annas Umfrage samt Antwort ab, obwohl der Kalender zu ist');

  await hjs(`(() => { const k = document.querySelector('.kachel[data-app="kalender"]:not(:disabled)'); if (k) k.click(); return Boolean(k); })()`);
  await warte(4000);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/kalender/'));
  pruefe(Boolean(sicht), 'der Kalender kommt hoch');
  if (!sicht) {
    app.exit(1);
    return;
  }
  const js = (a) => sicht.webContents.executeJavaScript(a);
  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });
  await js(`document.querySelector('[data-umfrage="u-anna"]').click(); true`);
  await warte(700);
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]')?.dataset.anzahl`)) === '1', 'Annas Antwort steht in der Heatmap');

  // --- 2. Die App antwortet: geht an Anna ---------------------------------------------
  const name = await js(`document.querySelector('[data-name]').value`);
  pruefe(name.length > 0, `der eigene Name kommt aus dem Raum (${name})`);
  await js(`(() => { const el = (k) => document.querySelector('[data-raster="meine"] [data-feld="' + k + '"]');
    el('${f(1140)}').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }));
    el('${f(1140)}').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: el('${f(1200)}') }));
    el('${f(1200)}').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: el('${f(1140)}') }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return true; })()`);
  pruefe(
    await bis(() => anna.alle.some((n) => n.typ === 'werkzeug' && n.werkzeug === 'kalender' && /"art":"antwort"/.test(n.inhalt) && JSON.parse(n.inhalt).antwort.person === name)),
    'die eigene Antwort geht an Anna'
  );
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '2', 'Heatmap: zwei um 19 Uhr');
  pruefe(/19:00/.test(await js(`document.querySelector('[data-vorschlag]')?.textContent ?? ''`)), 'bester Termin 19–21 Uhr');

  // --- 3. Annas neue Antwort kommt im offenen Kalender an -------------------------------
  schicke({ art: 'antwort', umfrageId: 'u-anna', antwort: { person: 'Anna', felder: { [f(1080)]: 'kann' }, zeit: '2026-10-01T11:00:00Z' } });
  pruefe(await bis(async () => (await js(`document.querySelector('[data-heat="${f(1080)}"]').dataset.anzahl`)) === '1'), 'Annas geänderte Antwort erscheint ohne Neuöffnen');
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '1', 'ihre alte Antwort ist ersetzt, nicht verdoppelt');

  // --- Teilen: die App schickt die Umfrage ------------------------------------------------
  await js(`document.querySelector('[data-teilen]').click(); true`);
  pruefe(
    await bis(() => anna.alle.some((n) => n.typ === 'werkzeug' && n.werkzeug === 'kalender' && /"art":"umfrage"/.test(n.inhalt))),
    '„Im Raum teilen" schickt die Umfrage'
  );

  anna.zu();
  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length === 0 ? '\nKalender im Raum bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
