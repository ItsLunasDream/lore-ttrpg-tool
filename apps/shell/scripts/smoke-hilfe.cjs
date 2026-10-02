/**
 * Rauchtest: die Hilfe je Werkzeug (Knopf „?" und F1).
 *
 * Auf der Startseite zeigt „?" die Hilfe der Sammlung. Im Würfel öffnet F1
 * (gedrückt in der Ansicht des Werkzeugs) dessen Hilfe mit der Bedienung.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-hilfe.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hilfe-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'dice', 'homebrew'] }));
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
}, 90000);

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const finde = (id) => fenster.contentView.children.find((v) => v.webContents?.getURL().includes(`/apps/${id}/`));

  // --- Startseite: „?" ------------------------------------------------------------
  await hjs(`document.querySelector('[data-hilfe-knopf]').click(); true`);
  await warte(400);
  pruefe((await hjs(`document.querySelector('[data-hilfe]')?.dataset.hilfe ?? ''`)) === 'suite', '„?" auf der Startseite: die Hilfe der Sammlung');
  pruefe(/Strg\+K/.test(await hjs(`document.querySelector('.hilfe__allgemein')?.textContent ?? ''`)), 'mit dem, was überall gilt');
  await hjs(`document.querySelector('.dialog__fuss .dialog__knopf').click(); true`);
  await warte(300);

  // --- Würfel: F1 in der Ansicht des Werkzeugs -----------------------------------------
  await hjs(`document.querySelector('.kachel[data-app="dice"]:not(:disabled)').click(); true`);
  await warte(4000);
  const sicht = finde('dice');
  pruefe(Boolean(sicht), 'der Würfel kommt hoch');
  sicht.webContents.focus();
  sicht.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F1' });
  sicht.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F1' });
  await warte(600);
  pruefe((await hjs(`document.querySelector('[data-hilfe]')?.dataset.hilfe ?? ''`)) === 'dice', 'F1 im Würfel: dessen Hilfe');
  pruefe(/Rechtsklick/.test(await hjs(`document.querySelector('[data-hilfe-steuerung]')?.textContent ?? ''`)), 'mit der Bedienung (Rechtsklick nimmt weg)');
  pruefe(/Hilfe: /.test(await hjs(`document.querySelector('.dialog__titel')?.textContent ?? ''`)), 'Titel „Hilfe: …"');
  await hjs(`document.querySelector('.dialog__fuss .dialog__knopf').click(); true`);
  await warte(300);
  pruefe(!(await hjs(`Boolean(document.querySelector('[data-hilfe]'))`)), 'schließt wieder');

  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  console.log(fehler.length === 0 ? '\nHilfe bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
