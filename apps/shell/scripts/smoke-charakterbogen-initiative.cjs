/**
 * Rauchtest: Charakterbogen und Initiative Tracker (docs/charakterbogen.md,
 * Schritt 7). Ein Bogen geht per Knopf in den Tracker; Schaden im Tracker
 * landet im Bogen, Schaden am Bogen im Tracker.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-charakterbogen-initiative.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bogen-ini-'));
const userData = path.join(tmp, 'userData');
const boegen = path.join(userData, 'charakterbogen', 'boegen');
fs.mkdirSync(boegen, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'charakterbogen', 'initiative'] })
);
const thorin = {
  id: 'thorin',
  name: 'Thorin',
  werte: { tp: { max: 30, aktuell: 30, temp: 0 }, rk: 16, attribute: { sta: 16, ges: 14, kon: 14, int: 10, wei: 10, cha: 8 } }
};
fs.writeFileSync(path.join(boegen, 'thorin.md'), `---\nname: Thorin\n---\n\n\`\`\`json bogen\n${JSON.stringify(thorin)}\n\`\`\`\n`);

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
}, 120000);

const tippe = (auswahl, wert) => `(() => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const ansicht = (teil) => fenster.contentView.children.find((v) => v.webContents.getURL().includes(teil));

  await hjs(`document.querySelector('.kachel[data-app="charakterbogen"]').click(); true`);
  await bis(() => Boolean(ansicht('/apps/charakterbogen/')));
  const bogen = ansicht('/apps/charakterbogen/');
  const bjs = (a) => bogen.webContents.executeJavaScript(a);
  await bis(async () => bjs(`Boolean(document.querySelector('[data-bogen="thorin"]'))`));
  await bjs(`document.querySelector('[data-bogen="thorin"]').click(); true`);
  await bis(async () => bjs(`Boolean(document.querySelector('[data-in-tracker]'))`));
  await bjs(`document.querySelector('[data-in-tracker]').click(); true`);

  pruefe(await bis(() => Boolean(ansicht('/apps/initiative/')), 8000), 'der Knopf holt den Initiative Tracker nach vorn');
  const tracker = ansicht('/apps/initiative/');
  const tjs = (a) => tracker.webContents.executeJavaScript(a);
  pruefe(
    await bis(async () => /Thorin/.test(await tjs(`document.body.innerText`)), 8000),
    'Thorin steht im Kampf'
  );
  pruefe((await tjs(`document.querySelector('.koerper__hp')?.value`)) === '30', 'mit 30 TP');
  pruefe((await tjs(`document.querySelector('.koerper__max')?.textContent`)) === '/30', 'von 30');

  // Schaden im Tracker: der Bogen bekommt ihn.
  await tjs(`(() => { const f = document.querySelector('.koerper__schaden');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'7');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true; })()`);
  pruefe(
    await bis(() => /"aktuell": 23/.test(fs.readFileSync(path.join(boegen, 'thorin.md'), 'utf8'))),
    '7 Schaden im Tracker: im Bogen stehen 23 TP'
  );
  pruefe(
    await bis(async () => (await bjs(`document.querySelector('[data-feld="tp-aktuell"]')?.value`)) === '23'),
    'und der offene Bogen zeigt es'
  );

  // Schaden am Bogen: der Tracker bekommt ihn.
  await bjs(tippe('[data-feld="tp-betrag"]', '-3'));
  await bjs(`document.querySelector('[data-feld="tp-betrag"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`);
  pruefe(
    await bis(async () => (await tjs(`document.querySelector('.koerper__hp')?.value`)) === '20', 8000),
    '3 Schaden am Bogen: im Tracker stehen 20 TP'
  );

  // Zweimal in den Tracker: aufgefrischt, nicht verdoppelt.
  await bjs(`document.querySelector('[data-in-tracker]').click(); true`);
  await warte(1500);
  pruefe((await tjs(`document.querySelectorAll('.koerper__hp').length`)) === 1, 'ein zweites Mal verdoppelt Thorin nicht');

  console.log(fehler.length ? `\n${fehler.length} Fehler.` : '\nBogen und Initiative bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
