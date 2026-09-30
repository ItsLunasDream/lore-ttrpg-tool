/**
 * Rauchtest: Boegen live im Raum (docs/charakterbogen.md, Schritt 5).
 *
 * Die App ist Gastgeberin und SL, Anna ein Gast aus dem Raumprotokoll ohne
 * App. Geprueft wird der ganze Weg: Anna bringt ihren Bogen, der Gastgeber
 * seinen; Schaden auf beiden Seiten; die SL aendert Annas Bogen sichtbar und
 * still; Anna darf den fremden Bogen nicht aendern; die Freigabe steuert,
 * was Anna sieht; der eigene Bogen landet auf der Platte; wer geht, nimmt
 * seinen Bogen mit.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-charakterbogen-raum.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { gast } = require('./raumgast.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bogen-raum-'));
const userData = path.join(tmp, 'userData');
const boegen = path.join(userData, 'charakterbogen', 'boegen');
fs.mkdirSync(boegen, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', tischName: 'Lea', einfuehrungGesehen: ['suite', 'charakterbogen'] })
);
// Ein eigener Bogen des Gastgebers, wie ihn die Ablage schreibt (nur der JSON-Block zaehlt).
const thorin = { id: 'thorin', name: 'Thorin', werte: { tp: { max: 30, aktuell: 30, temp: 0 }, rk: 16 } };
fs.writeFileSync(path.join(boegen, 'thorin.md'), `---\nname: Thorin\n---\n\n\`\`\`json bogen\n${JSON.stringify(thorin)}\n\`\`\`\n`);

app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};
async function bis(bedingung, ms = 5000) {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) return false;
    await warte(50);
  }
  return true;
}

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 150000);

const tippe = (auswahl, wert) => `(() => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  const setz = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  e.focus();
  setz.call(e, ${JSON.stringify(wert)});
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;
const waehle = (auswahl, wert) => `(() => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  const setz = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setz.call(e, ${JSON.stringify(wert)});
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`;

/** Was Anna vom Charakterbogen des Gastgebers bekommen hat, gelesen. */
const vomBogen = (g) =>
  g.alle.filter((n) => n.typ === 'werkzeug' && n.werkzeug === 'charakterbogen' && n.von === 'gastgeber').map((n) => JSON.parse(n.inhalt));
const bitte = (g, inhalt) =>
  g.schreibe({ typ: 'werkzeug', von: 'x', an: 'gastgeber', werkzeug: 'charakterbogen', inhalt: JSON.stringify(inhalt), zeit: '' });
/** Der letzte Stand eines Bogens bei Anna. */
const letzter = (g, id) => {
  let e = null;
  for (const m of vomBogen(g)) {
    if (m.art === 'stand') e = m.eintraege.find((x) => x.id === id) ?? null;
    if (m.art === 'bogen' && m.eintrag.id === id) e = m.eintrag;
    if (m.art === 'weg' && m.id === id) e = null;
  }
  return e;
};

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);

  // --- Raum, Anna kommt, fragt nach dem Stand -----------------------------------
  const offen = await hjs(`window.shell.raum.eroeffnen('Runde', 'pw', { sl: true })`);
  pruefe(offen.ok, 'der Raum ist offen, der Gastgeber leitet');
  const anna = gast(offen.port, 'pw', 'Anna');
  pruefe(await bis(() => anna.ich !== null), 'Anna ist drin');
  bitte(anna, { art: 'hallo' });
  pruefe(
    await bis(() => vomBogen(anna).some((m) => m.art === 'stand')),
    'der Charakterbogen des Gastgebers antwortet, auch ungeoeffnet (still montiert)'
  );

  // --- Anna bringt ihren Bogen ---------------------------------------------------
  const annaId = `${anna.ich.id}/anna-elf`;
  bitte(anna, { art: 'bringe', bogen: { id: 'anna-elf', name: 'Anna Elf', werte: { tp: { max: 20, aktuell: 20, temp: 0 }, rk: 14 } } });
  pruefe(await bis(() => letzter(anna, annaId)?.sicht === 'voll'), 'Annas Bogen ist im Raum, sie sieht ihn ganz');

  // --- Der Gastgeber oeffnet das Werkzeug -----------------------------------------
  await hjs(`document.querySelector('.kachel[data-app="charakterbogen"]').click(); true`);
  await warte(4000);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/charakterbogen/'));
  pruefe(Boolean(sicht), 'das Werkzeug kommt hoch');
  const js = (a) => sicht.webContents.executeJavaScript(a);
  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });
  pruefe(
    await bis(async () => js(`Boolean(document.querySelector('[data-live="${annaId}"]'))`)),
    'unter „Im Raum" steht Annas Bogen'
  );

  // --- Der Gastgeber bringt Thorin --------------------------------------------------
  await js(waehle('[data-bringe-wahl]', 'thorin'));
  await warte(100);
  await js(`document.querySelector('[data-bringe]').click(); true`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-live-leiste]'))`)), 'Thorin ist im Raum und offen');
  const thorinId = 'gastgeber/thorin';
  pruefe(await bis(() => letzter(anna, thorinId)?.sicht === 'uebersicht'), 'Anna sieht von Thorin nur die Uebersicht (Vorgabe)');
  pruefe(letzter(anna, thorinId)?.bogen === undefined, 'ohne den Bogen selbst');

  // Schaden am eigenen Bogen ueber das Feld.
  await js(tippe('[data-feld="tp-betrag"]', '-7'));
  await js(`document.querySelector('[data-feld="tp-betrag"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`);
  pruefe(await bis(() => letzter(anna, thorinId)?.uebersicht.tpStufe === 'leicht'), 'Anna sieht Thorin „leicht verletzt"');
  pruefe(
    await bis(() => /"aktuell": 23/.test(fs.readFileSync(path.join(boegen, 'thorin.md'), 'utf8')), 4000),
    'der eigene Bogen steht mit 23 TP auf der Platte'
  );

  // --- Anna nimmt Schaden, die SL aendert ihre RK ---------------------------------
  bitte(anna, { art: 'schritte', id: annaId, nr: 1, schritte: [{ typ: 'betrag', text: '-5' }] });
  pruefe(await bis(() => letzter(anna, annaId)?.bogen?.werte.tp.aktuell === 15), 'Annas Schaden kommt beim Gastgeber an und zurueck');
  await js(`document.querySelector('button').click(); true`); // zurueck zur Liste
  await bis(async () => js(`Boolean(document.querySelector('[data-live="${annaId}"]'))`));
  pruefe(/15\/20/.test(await js(`document.querySelector('[data-live="${annaId}"]').textContent`)), 'die Liste des Gastgebers zeigt 15/20');
  await js(`document.querySelector('[data-live="${annaId}"]').click(); true`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-still]'))`)), 'an einem fremden Bogen hat die SL den Schalter „Still aendern"');
  await js(tippe('[data-feld="rk"]', '12'));
  pruefe(
    await bis(() => letzter(anna, annaId)?.slAenderungen?.some((a) => a.felder.includes('werte.rk') && !a.still)),
    'Anna sieht die Aenderung der RK als SL-Aenderung'
  );
  pruefe(letzter(anna, annaId)?.bogen?.werte.rk === 12, 'mit dem neuen Wert');
  await js(`document.querySelector('[data-still]').click(); true`);
  await warte(100);
  await js(tippe('[data-feld="spieler"]', 'Anna S.'));
  pruefe(await bis(() => letzter(anna, annaId)?.bogen?.werte.spieler === 'Anna S.'), 'die stille Aenderung wirkt');
  pruefe(letzter(anna, annaId)?.slAenderungen?.length === 1, 'aber Anna sieht sie nicht als SL-Aenderung');
  pruefe(
    await bis(async () => js(`Boolean(document.querySelector('[data-sl-verlauf]'))`)),
    'die SL hat ihren Verlauf der Aenderungen'
  );

  // --- Rechte und Freigabe --------------------------------------------------------
  bitte(anna, { art: 'schritte', id: thorinId, nr: 2, schritte: [{ typ: 'feld', pfad: ['name'], wert: 'Gekapert' }] });
  pruefe(await bis(() => vomBogen(anna).some((m) => m.art === 'abgelehnt' && m.grund === 'recht')), 'Anna darf Thorin nicht aendern');
  bitte(anna, { art: 'bestaetige', id: annaId });
  pruefe(await bis(() => letzter(anna, annaId)?.slAenderungen?.length === 0), 'Anna bestaetigt die SL-Aenderungen weg');
  await js(`document.querySelector('button').click(); true`);
  await bis(async () => js(`Boolean(document.querySelector('[data-bringe-wahl], [data-live="${thorinId}"]'))`));
  await js(`document.querySelector('[data-live="${thorinId}"]').click(); true`);
  await bis(async () => js(`Boolean(document.querySelector('[data-freigabe]'))`));
  await js(waehle('[data-freigabe]', 'alles'));
  pruefe(await bis(() => letzter(anna, thorinId)?.bogen?.werte.tp.aktuell === 23), 'mit Freigabe „alles" sieht Anna Thorin ganz');
  pruefe(letzter(anna, thorinId)?.darfAendern === false, 'aendern darf sie ihn trotzdem nicht');
  if (process.env.BILD) fs.writeFileSync(process.env.BILD, (await sicht.webContents.capturePage()).toPNG());

  // --- Anna geht ------------------------------------------------------------------
  anna.zu();
  await js(`document.querySelector('button').click(); true`);
  pruefe(
    await bis(async () => !(await js(`Boolean(document.querySelector('[data-live="${annaId}"]'))`))),
    'wer geht, nimmt seinen Bogen mit'
  );
  pruefe(!fs.existsSync(path.join(boegen, 'anna-elf.md')), 'Annas Bogen landet nicht auf der Platte des Gastgebers');

  await hjs('window.shell.raum.verlassen()');
  pruefe(await bis(async () => !(await js(`Boolean(document.querySelector('[data-live-liste]'))`))), 'ohne Raum verschwindet „Im Raum"');
  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nBoegen im Raum bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
