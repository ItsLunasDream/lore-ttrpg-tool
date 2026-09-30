/**
 * Rauchtest: der Charakterbogen.
 *
 * Der Weg, den die Modultests nicht sehen: Kachel oeffnen, einen Bogen
 * anlegen, Werte tippen, Schaden und Heilung ueber das Feld, eine lange
 * Rast, und dass alles ohne Speichern-Knopf auf der Platte landet.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-charakterbogen.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bogen-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'charakterbogen'] })
);

app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 120000);

/** Setzt einen Wert so, dass React ihn mitbekommt. */
const tippe = (auswahl, wert) => `(() => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  const setz = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  e.focus();
  setz.call(e, ${JSON.stringify(wert)});
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  if (!fenster) {
    console.log('  FEHL kein Fenster');
    app.exit(1);
    return;
  }
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);

  pruefe(
    await hjs(`Boolean(document.querySelector('.kachel[data-app="charakterbogen"]:not(:disabled)'))`),
    'die Kachel steht auf der Startseite'
  );
  await hjs(`document.querySelector('.kachel[data-app="charakterbogen"]').click(); true`);
  await warte(4000);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/charakterbogen/'));
  pruefe(Boolean(sicht), 'das Werkzeug kommt hoch');
  if (!sicht) {
    app.exit(1);
    return;
  }
  const js = (a) => sicht.webContents.executeJavaScript(a);
  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });
  pruefe(/Charakterbogen/.test(await js('document.body.innerText')), 'mit seiner Ueberschrift');

  // --- Anlegen ----------------------------------------------------------------
  await js(`document.querySelector('[data-neu]').click(); true`);
  await warte(800);
  pruefe(await js(`Boolean(document.querySelector('[data-feld="name"]'))`), 'ein neuer Bogen ist offen');
  const ordner = path.join(userData, 'charakterbogen', 'boegen');
  const dateien = () => (fs.existsSync(ordner) ? fs.readdirSync(ordner).filter((d) => d.endsWith('.md')) : []);
  pruefe(dateien().length === 1, `und liegt sofort als Datei da (${dateien().join(', ')})`);

  await js(tippe('[data-feld="name"]', 'Mira Sturmhand'));
  await js(tippe('[data-feld="klasse-0"]', 'Schurkin'));
  await js(tippe('[data-feld="stufe-0"]', '5'));
  await js(tippe('[data-feld="attribut-ges"]', '16'));
  await warte(200);
  pruefe((await js(`document.querySelector('[data-mod="ges"]').textContent`)) === '+3', 'GES 16 ergibt +3');
  pruefe((await js(`document.querySelector('[data-pb]').dataset.pb`)) === '3', 'Stufe 5 ergibt Uebungsbonus +3');

  // Heimlichkeit zweimal: Uebung, dann Expertise.
  await js(`document.querySelector('[data-fertigkeit="heimlichkeit"]').click(); true`);
  await warte(100);
  await js(`document.querySelector('[data-fertigkeit="heimlichkeit"]').click(); true`);
  await warte(200);
  pruefe(
    (await js(`document.querySelector('[data-bonus="heimlichkeit"]').textContent`)) === '+9',
    'Heimlichkeit mit Expertise: 3 + 2 × 3 = +9'
  );

  // --- Trefferpunkte -------------------------------------------------------
  await js(tippe('[data-feld="tp-max"]', '30'));
  await js(tippe('[data-feld="tp-aktuell"]', '30'));
  await js(tippe('[data-feld="tp-temp"]', '5'));
  await warte(200);
  const enter = `document.querySelector('[data-feld="tp-betrag"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`;
  await js(tippe('[data-feld="tp-betrag"]', '-12'));
  await js(enter);
  await warte(300);
  pruefe(
    (await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '23' &&
      (await js(`document.querySelector('[data-feld="tp-temp"]').value`)) === '0',
    '12 Schaden: erst 5 temporaere, dann 7 echte TP'
  );
  await js(tippe('[data-feld="tp-betrag"]', '+4'));
  await js(enter);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '27', '+4 heilt');

  await js(`document.querySelector('[data-rast="lang"]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '30', 'die lange Rast fuellt die TP');

  // --- Zauber ----------------------------------------------------------------
  await js(`document.querySelector('[data-zauber-an]').click(); true`);
  await warte(300);
  await js(tippe('[data-feld="attribut-int"]', '16'));
  await js(`(() => { const s = document.querySelector('[data-feld="zauberattribut"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'int');
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await warte(200);
  pruefe(/14/.test(await js(`document.querySelector('[data-zauber-sg]').textContent`)), 'Zauber-SG 8 + 3 + 3 = 14');
  await js(tippe('[data-platz-max="1"]', '2'));
  await js(`document.querySelector('[data-zauber-suchen]').click(); true`);
  await warte(300);
  await js(tippe('[data-zauber-anfrage]', 'magic missile'));
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-zauber-dazu="magic-missile"]'))`), 'die Suche findet den Zauber auf Englisch');
  await js(`document.querySelector('[data-zauber-dazu="magic-missile"]').click(); true`);
  await warte(300);
  pruefe(
    /Magisches Geschoss/.test(await js(`document.querySelector('[data-zauberliste]').innerText`)),
    'und er steht mit deutschem Namen in der Liste'
  );
  await js(`document.querySelector('[data-zauberliste] [data-wirken]').click(); true`);
  await warte(300);
  pruefe(
    (await js(`document.querySelectorAll('.punkt--weg').length`)) === 1,
    'Wirken verbraucht einen Platz des 1. Grades'
  );
  await js(`document.querySelector('[data-rast="lang"]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelectorAll('.punkt--weg').length`)) === 0, 'die lange Rast gibt ihn zurueck');

  // --- Auf der Platte, ohne Speichern-Knopf -----------------------------------
  await warte(1500);
  const inhalt = dateien().length ? fs.readFileSync(path.join(ordner, dateien()[0]), 'utf8') : '';
  pruefe(/^name: Mira Sturmhand$/m.test(inhalt), 'der Name steht in der Datei');
  pruefe(/^tp: 30$/m.test(inhalt) && /^tp_max: 30$/m.test(inhalt), 'die TP stehen im Kopf');
  pruefe(/Heimlichkeit \+9/.test(inhalt), 'die Lesefassung zeigt die Fertigkeit');
  pruefe(/Magisches Geschoss/.test(inhalt) && /"srd": "magic-missile"/.test(inhalt), 'der Zauber steht in der Datei');
  pruefe(dateien().length === 1, 'Umbenennen legt keine zweite Datei an');

  // --- Zurueck zur Liste --------------------------------------------------------
  await js(`[...document.querySelectorAll('button')].find((b) => /Zurück zur Liste/.test(b.textContent)).click(); true`);
  await warte(600);
  pruefe(
    /Mira Sturmhand/.test(await js(`document.querySelector('.kacheln')?.innerText ?? ''`)) &&
      /30\/30/.test(await js(`document.querySelector('.kacheln')?.innerText ?? ''`)),
    'die Liste zeigt den Bogen mit TP'
  );

  pruefe(konsole.length === 0, `keine Fehler in der Konsole (${konsole.join(' | ')})`);
  console.log(fehler.length ? `\n${fehler.length} fehlgeschlagen` : '\nCharakterbogen bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
