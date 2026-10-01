/**
 * Rauchtest: das Sitzungsprotokoll (docs/sitzungsprotokoll.md).
 *
 * Die App eröffnet einen Raum, Anna (ein Gast aus dem Protokoll) tritt bei
 * und legt im Kalender einen Termin für heute fest. Dann:
 *
 * 1. Sitzung beginnen über den Knopf in der Titelleiste: der Titel kommt aus
 *    dem Kalender, Anna steht unter „Dabei".
 * 2. Annas Wurf im Chat wird mitgeschrieben, eine gewöhnliche Chatzeile nicht.
 * 3. Der Würfel meldet einen Wurf, der Initiative Tracker Kampfbeginn und
 *    einen Ausfall.
 * 4. Eine Zeile von Hand, dann beenden: Vorschau mit allen Abschnitten,
 *    ein Eintrag abgewählt, als Notiz in den Story Creator.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-protokoll.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { gast } = require('./raumgast.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'protokoll-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'backstory', 'dice', 'initiative'] })
);
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
    await warte(100);
  }
  return true;
}

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 180000);

const jetzt = new Date();
const HEUTE = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1400, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const finde = (id) => fenster.contentView.children.find((v) => v.webContents?.getURL().includes(`/apps/${id}/`));
  const konsole = [];
  const oeffneWerkzeug = async (id) => {
    await hjs(`(() => { const s = document.querySelector('[data-schiene="${id}"]'); if (s) { s.click(); return true; }
      const k = document.querySelector('.kachel[data-app="${id}"]:not(:disabled)'); if (k) k.click(); return Boolean(k); })()`);
    const ende = Date.now() + 15000;
    while (Date.now() < ende) {
      const v = finde(id);
      if (v && (await v.webContents.executeJavaScript('document.readyState')) === 'complete') break;
      await warte(200);
    }
    await warte(1500);
    const v = finde(id);
    v?.webContents.on('console-message', (_e, l, t) => {
      if (l >= 2) konsole.push(`${id}: ${t.slice(0, 160)}`);
    });
    return (a) => v.webContents.executeJavaScript(a);
  };
  const zustand = () => hjs('window.shell.protokoll.zustand()');
  const eintraege = async () => (await zustand())?.eintraege ?? [];

  // --- Vorbereitung: Kampagne, Raum, Annas Termin ------------------------------------
  const bs = await oeffneWerkzeug('backstory');
  const kampagne = await bs(`(async () => {
    const aus = (a) => (a && 'value' in a ? a.value : a);
    const liste = aus(await window.api.campaigns.list()) ?? [];
    if (liste.length) return liste[0].name;
    return aus(await window.api.campaigns.create('Testrunde')).name; })()`);
  pruefe(Boolean(kampagne), `eine Kampagne steht bereit (${kampagne})`);
  await hjs(`document.querySelector('.schiene__heim')?.click(); true`);
  await warte(600);

  const auf = await hjs("window.shell.raum.eroeffnen('Runde', 'pw')");
  pruefe(auf.ok && auf.port > 0, 'die Hülle eröffnet einen Raum');
  const anna = gast(auf.port, 'pw', 'Anna');
  pruefe(await bis(() => anna.ich !== null), 'Anna tritt bei');
  anna.schreibe({
    typ: 'werkzeug',
    von: 'x',
    an: null,
    werkzeug: 'kalender',
    inhalt: JSON.stringify({
      art: 'umfrage',
      umfrage: { id: 'u-heute', titel: 'Drachenjagd', tage: [HEUTE], von: 1080, bis: 1320, schritt: 60, dauer: 120, antworten: [], termin: { tag: HEUTE, von: 1140, bis: 1260 }, notiz: '', geaendert: '' }
    }),
    zeit: ''
  });
  pruefe(await bis(() => fs.existsSync(path.join(userData, 'kalender', 'umfragen', 'u-heute.md'))), 'Annas Termin für heute liegt im Kalender');

  // --- 1. Beginnen über den Knopf ----------------------------------------------------
  pruefe(/○/.test(await hjs(`document.querySelector('[data-protokoll-knopf]')?.textContent ?? ''`)), 'der Knopf in der Titelleiste zeigt „aus"');
  await hjs(`document.querySelector('[data-protokoll-knopf]').click(); true`);
  pruefe(await bis(() => hjs(`Boolean(document.querySelector('[data-protokoll-start]'))`)), 'der Dialog öffnet sich');
  await hjs(`document.querySelector('[data-protokoll-start]').click(); true`);
  pruefe(await bis(() => hjs(`Boolean(document.querySelector('[data-protokoll="laeuft"]'))`)), 'die Sitzung läuft');
  const s1 = await zustand();
  pruefe(s1?.titel === 'Drachenjagd', `der Titel kommt aus dem Kalender (${s1?.titel})`);
  pruefe(s1?.dabei.includes('Anna'), `Anna steht unter „Dabei" (${s1?.dabei.join(', ')})`);
  await hjs(`document.querySelector('.dialog__fuss .dialog__knopf')?.click(); true`);
  await warte(400);
  pruefe(/●/.test(await hjs(`document.querySelector('[data-protokoll-knopf]')?.textContent ?? ''`)), 'der Knopf zeigt „läuft"');

  // --- 2. Raum: Würfe ja, Chat nein ---------------------------------------------------
  anna.schreibe({ typ: 'chat', von: anna.ich.id, an: null, text: 'Hallo Runde', zeit: '' });
  anna.schreibe({ typ: 'chat', von: anna.ich.id, an: null, text: '🎲 1d20: 20  (20)', zeit: '' });
  pruefe(await bis(async () => (await eintraege()).some((e) => e.quelle === 'raum' && e.art === 'wurf')), 'Annas Wurf aus dem Chat steht im Protokoll');
  pruefe(!(await eintraege()).some((e) => /Hallo Runde/.test(e.text)), 'die Chatzeile nicht');

  // --- 3. Würfel und Initiative melden ----------------------------------------------
  const wuerfel = await oeffneWerkzeug('dice');
  await wuerfel("[...document.querySelectorAll('.artfeld .wuerfel')][5].click(); true");
  await warte(300);
  await wuerfel("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
  pruefe(await bis(async () => (await eintraege()).some((e) => e.quelle === 'dice' && e.art === 'wurf' && /d20|W20/i.test(e.text))), 'der Würfel meldet seinen Wurf');
  const wurf = (await eintraege()).find((e) => e.quelle === 'dice');
  const augen = Number(/: (-?\d+)/.exec(wurf?.text ?? '')?.[1]);
  pruefe(wurf?.wichtig === (augen === 1 || augen === 20), `wichtig nur bei 1 oder 20 (${wurf?.text}, wichtig: ${wurf?.wichtig})`);

  await hjs(`document.querySelector('.schiene__heim')?.click(); true`);
  await warte(600);
  const ini = await oeffneWerkzeug('initiative');
  await ini(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Teilnehmer')).click(); true`);
  await warte(600);
  await ini(`(() => {
    const setz = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', {bubbles:true})); };
    const felder = [...document.querySelectorAll('.ausklapp__felder input')];
    setz(felder[0], 'Goblin'); setz(felder[1], '15'); setz(felder[3], '7');
    return true; })()`);
  await warte(600);
  await ini(`[...document.querySelectorAll('button')].find(b => /Kampf beginnen/.test(b.textContent)).click(); true`);
  pruefe(await bis(async () => (await eintraege()).some((e) => e.art === 'kampf-beginn' && /Goblin/.test(e.text))), 'der Tracker meldet den Kampfbeginn');
  await ini(`(() => { const f = document.querySelector('.koerper__schaden');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'9');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true; })()`);
  pruefe(await bis(async () => (await eintraege()).some((e) => e.art === 'raus' && /Goblin fällt aus/.test(e.text))), 'der Tracker meldet den Ausfall');
  pruefe(await bis(() => fs.existsSync(path.join(userData, 'protokoll', 'laufend.json'))), 'der Zwischenstand liegt auf der Platte (für Abstürze)');

  // --- 4. Zeile von Hand, beenden, Vorschau, Notiz ------------------------------------
  await hjs(`document.querySelector('[data-protokoll-knopf]').click(); true`);
  await bis(() => hjs(`Boolean(document.querySelector('[data-protokoll-zeile]'))`));
  await hjs(`(() => { const f = document.querySelector('[data-protokoll-zeile]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, 'Die Gruppe erreicht Rabenfurt');
    f.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await warte(200);
  await hjs(`document.querySelector('[data-protokoll-zeile]').form.requestSubmit(); true`);
  pruefe(await bis(async () => (await eintraege()).some((e) => e.art === 'hand' && e.wichtig)), 'die Zeile von Hand steht drin');

  await hjs(`document.querySelector('[data-protokoll-stopp]').click(); true`);
  pruefe(await bis(() => hjs(`Boolean(document.querySelector('[data-protokoll="vorschau"]'))`)), 'nach dem Beenden kommt die Vorschau');
  const raus = (await eintraege()).find((e) => e.art === 'raus');
  await hjs(`document.querySelector('[data-protokoll-eintrag="${raus.id}"]').click(); true`);
  await hjs(`(() => { const f = document.querySelector('[data-protokoll-zusammenfassung]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(f, 'Ein kurzer Kampf am Fluss.');
    f.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await hjs(`document.querySelector('[data-protokoll-vorschau]').closest('details').open = true; true`);
  pruefe(
    await bis(async () => /Ein kurzer Kampf/.test(await hjs(`document.querySelector('[data-protokoll-vorschau]').textContent`))),
    'die Vorschau zeigt die Zusammenfassung'
  );
  const vorschau = await hjs(`document.querySelector('[data-protokoll-vorschau]').textContent`);
  pruefe(/## Verlauf/.test(vorschau) && /## Alle Würfe/.test(vorschau), 'Vorschau mit Verlauf und „Alle Würfe"');
  pruefe(/Kampf beginnt/.test(vorschau) && !/fällt aus/.test(vorschau), 'der abgewählte Ausfall fehlt, der Kampfbeginn steht da');
  pruefe(/Dabei: .*Anna/.test(vorschau), 'Anna steht in der Kopfzeile');

  await hjs(`document.querySelector('[data-protokoll-anlegen]').click(); true`);
  pruefe(await bis(async () => (await zustand()) === null), 'nach dem Anlegen ist das Protokoll leer');
  pruefe(!fs.existsSync(path.join(userData, 'protokoll', 'laufend.json')), 'der Zwischenstand ist weg');
  const vault = path.join(userData, 'backstory', 'vault');
  const dateien = [];
  const suche = (o) => {
    for (const e of fs.readdirSync(o, { withFileTypes: true })) {
      const p = path.join(o, e.name);
      if (e.isDirectory()) suche(p);
      else if (e.name.endsWith('.md')) dateien.push(p);
    }
  };
  try {
    suche(vault);
  } catch {
    // kein Vault
  }
  const notiz = dateien.map((p) => fs.readFileSync(p, 'utf8')).find((t) => /Drachenjagd/.test(t) && /## Alle Würfe/.test(t));
  pruefe(Boolean(notiz), 'die Sitzungsnotiz liegt im Vault');
  pruefe(Boolean(notiz) && /Die Gruppe erreicht Rabenfurt/.test(notiz) && /Ein kurzer Kampf/.test(notiz), 'mit Zeile von Hand und Zusammenfassung');

  anna.zu();
  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length === 0 ? '\nSitzungsprotokoll bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
