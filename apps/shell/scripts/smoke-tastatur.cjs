/**
 * Bedienung ohne Maus (Rückmeldung „Allgemein 1", packages/tastatur).
 *
 * Geprüft wird, was sich nur im echten Fenster zeigt:
 * - Pfeiltasten wandern durch die Kacheln des Startmenüs (Raster) und
 *   durch die Schiene (Liste);
 * - F6 im Werkzeug gibt den Fokus an die Schiene der Hülle, F6 in der
 *   Hülle zurück ans Werkzeug. Die Taste geht dabei den echten Weg über
 *   `sendInputEvent`, denn `before-input-event` sieht keine
 *   nachgebauten DOM-Ereignisse.
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-tastatur-'));
app.setPath('userData', path.join(tmp, 'userData'));
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const fehler = [];
function pruefe(bedingung, text) {
  if (bedingung) console.log(`  ok   ${text}`);
  else {
    console.log(`  FEHL ${text}`);
    fehler.push(text);
  }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
async function bis(frage, ms = 15000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (await frage()) return true;
    await warte(150);
  }
  return false;
}

app.whenReady().then(async () => {
  await warte(2500);
  const fenster = BaseWindow.getAllWindows()[0];
  const huelle = fenster.contentView.children[0];
  const js = (a) => huelle.webContents.executeJavaScript(a);
  pruefe(await bis(() => js(`document.querySelectorAll('.kacheln [data-app]').length > 3`)), 'Startmenue mit Kacheln');

  // Pfeile im Raster: rechts eine Kachel weiter, links zurueck.
  const taste = (key) =>
    js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true })); document.activeElement?.dataset?.app ?? document.activeElement?.className ?? ''`);
  const erste = await js(`(() => { const k = document.querySelector('.kacheln [data-app]'); k.focus(); return k.dataset.app; })()`);
  const rechts = await taste('ArrowRight');
  pruefe(rechts && rechts !== erste, `Pfeil rechts: von ${erste} zu ${rechts}`);
  const zurueck = await taste('ArrowLeft');
  pruefe(zurueck === erste, 'Pfeil links: zurueck zur ersten Kachel');
  const ende = await taste('End');
  pruefe(ende && ende !== erste, 'Ende springt ans Ende der Gruppe');

  // Ein Werkzeug oeffnen, per Enter auf der Kachel.
  await js(`document.querySelector('[data-app="dice"]').focus(); true`);
  huelle.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
  huelle.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
  huelle.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
  const findeWerkzeug = () => fenster.contentView.children.find((v) => v.webContents?.getURL().includes('/apps/dice/'));
  pruefe(await bis(async () => Boolean(findeWerkzeug()) && (await findeWerkzeug().webContents.executeJavaScript('document.readyState')) === 'complete'), 'Enter auf der Kachel oeffnet den Wuerfel');
  const werkzeug = findeWerkzeug();
  await warte(1500);

  // Pfeile in der Schiene (Liste): runter geht zum naechsten Eintrag.
  const vonSchiene = await js(`(() => { const e = document.querySelector('.schiene__eintrag--an'); e?.focus(); return e?.dataset.schiene ?? ''; })()`);
  const naechster = await js(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); document.activeElement?.dataset?.schiene ?? ''`);
  pruefe(vonSchiene === 'dice' && naechster && naechster !== 'dice', `Schiene: Pfeil runter von ${vonSchiene} zu ${naechster}`);

  // F6 in der Huelle: der Fokus geht ins Werkzeug.
  huelle.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F6' });
  huelle.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F6' });
  pruefe(await bis(() => werkzeug.webContents.isFocused(), 3000), 'F6 in der Huelle gibt den Fokus ans Werkzeug');

  // F6 im Werkzeug: zurueck auf den aktiven Eintrag der Schiene.
  werkzeug.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F6' });
  werkzeug.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F6' });
  pruefe(
    await bis(async () => huelle.webContents.isFocused() && (await js(`document.activeElement?.classList.contains('schiene__eintrag--an') ?? false`)), 3000),
    'F6 im Werkzeug fuehrt zur Schiene zurueck'
  );

  // Im Werkzeug: Pfeile wandern durch eine markierte Gruppe.
  const imWerkzeug = (a) => werkzeug.webContents.executeJavaScript(a);
  const gruppen = await imWerkzeug(`document.querySelectorAll('[data-pfeile]').length`);
  console.log(`  info Gruppen mit Pfeilen im Wuerfel: ${gruppen}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length ? `\n${fehler.length} fehlgeschlagen` : '\nTastatur bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
