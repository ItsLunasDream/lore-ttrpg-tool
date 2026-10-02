/**
 * Rauchtest: der Campaign Calendar (docs/kampagnenkalender.md).
 *
 * Umfrage anlegen, im Raster ziehen (zwei Personen), beste Termine sehen,
 * festlegen, .ics speichern, als Datei weitergeben und wieder einlesen, und
 * eine Antwort über den Weg der Hülle für Raumnachrichten zusammenführen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-kalender.cjs --no-sandbox
 */
const { app, BaseWindow, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kalender-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'kalender'] }));
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
// Der Weg, den die Hülle für Raumnachrichten an den Kalender nimmt. Das
// Bündel liegt in einem Paket mit "type": "module"; als .cjs-Kopie lässt es
// sich laden, ohne den Code zu ändern.
const kopie = path.join(tmp, 'kalender-embed.cjs');
fs.copyFileSync(path.join(__dirname, '..', '..', 'kalender', 'dist', 'main', 'embed.js'), kopie);
const { nimmRaumNachricht } = require(kopie);

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 150000);

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1400, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);

  await hjs(`(() => { const k = document.querySelector('.kachel[data-app="kalender"]:not(:disabled)'); if (k) k.click(); return Boolean(k); })()`);
  await warte(4500);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/kalender/'));
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
  pruefe(/Campaign Calendar/.test(await js('document.body.innerText')), 'mit seiner Überschrift');

  const tippe = (sel, wert) =>
    js(`(() => { const e = document.querySelector('${sel}');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
      e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  // Ziehen über Felder wie im Browser: pointerdown auf dem ersten, beim Wechsel
  // pointerout (mit Ziel) und pointerover; React bildet daraus onPointerEnter.
  // pointerup am Fenster.
  const ziehe = (felder) =>
    js(`(() => { const f = ${JSON.stringify(felder)};
      const el = (k) => document.querySelector('[data-raster="meine"] [data-feld="' + k + '"]');
      el(f[0]).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }));
      for (let i = 1; i < f.length; i += 1) {
        el(f[i - 1]).dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: el(f[i]) }));
        el(f[i]).dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: el(f[i - 1]) }));
      }
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      return true; })()`);

  // --- Umfrage anlegen ---------------------------------------------------------
  await js(`document.querySelector('[data-neu]').click(); true`);
  await warte(500);
  await tippe('[data-titel]', 'Sitzung 13');
  // Raster: Vorgabe 30 Minuten, 15 steht zur Wahl (Rückmeldung).
  pruefe((await js(`document.querySelector('[data-schritt]').value`)) === '30', 'Raster ist anfangs 30 Minuten');
  pruefe((await js(`[...document.querySelectorAll('[data-schritt] option')].map((o) => o.value).join(',')`)) === '15,30,60', 'Raster: 15, 30 oder 60 Minuten');
  await js(`(() => { const e = document.querySelector('[data-schritt]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, '15'); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await warte(300);
  pruefe(Boolean(await js(`document.querySelector('[data-raster="meine"] [data-feld$="T1095"]')`)), 'mit 15 Minuten gibt es ein Feld um 18:15');
  // Der Rest des Ablaufs rechnet in Stunden.
  await js(`(() => { const e = document.querySelector('[data-schritt]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, '60'); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await warte(300);
  const tage = await js(`[...document.querySelectorAll('[data-raster="meine"] .raster__kopf')].length`);
  pruefe(tage === 6, `vorbelegt: Fr, Sa, So über zwei Wochen (${tage} Tage)`);
  const ersterTag = await js(`document.querySelector('[data-raster="meine"] [data-feld]').dataset.feld.split('T')[0]`);
  const f = (min) => `${ersterTag}T${min}`;

  // --- Mira markiert 18–22 Uhr -----------------------------------------------------
  await tippe('[data-name]', 'Mira');
  await ziehe([f(1080), f(1140), f(1200), f(1260)]);
  await warte(500);
  pruefe((await js(`document.querySelector('[data-feld="${f(1140)}"]').dataset.stufe`)) === 'kann', 'Ziehen markiert „kann"');
  // --- Jo: 19–23 Uhr, die letzte Stunde nur notfalls ---------------------------------
  await tippe('[data-name]', 'Jo');
  await ziehe([f(1140), f(1200), f(1260)]);
  await js(`document.querySelector('[data-modus="notfalls"]').click(); true`);
  await ziehe([f(1320)]);
  await warte(500);
  pruefe((await js(`document.querySelector('[data-feld="${f(1320)}"]').dataset.stufe`)) === 'notfalls', 'Modus „notfalls" markiert gestreift');
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '2', 'Heatmap: um 19 Uhr können beide');

  // --- Beste Termine und festlegen --------------------------------------------------
  const vorschlag = await js(`document.querySelector('[data-vorschlag]')?.dataset.vorschlag ?? ''`);
  // Vorgabe: 4 Stunden. 18–22 Uhr kann Mira ganz (1 Punkt); 19–23 Uhr fehlt
  // Mira die letzte Stunde und Jo kann sie nur notfalls (½ Punkt).
  pruefe(vorschlag === `${ersterTag}-1080`, `bester Termin: erster Tag, 18 Uhr (${vorschlag})`);
  await js(`document.querySelector('[data-festlegen]').click(); true`);
  await warte(500);
  pruefe(await js(`Boolean(document.querySelector('[data-termin]'))`), 'Termin festgelegt');

  const icsZiel = path.join(tmp, 'sitzung.ics');
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: icsZiel });
  await js(`document.querySelector('[data-ics]').click(); true`);
  await warte(800);
  const ics = fs.existsSync(icsZiel) ? fs.readFileSync(icsZiel, 'utf8') : '';
  pruefe(/BEGIN:VEVENT/.test(ics) && /SUMMARY:Sitzung 13/.test(ics) && new RegExp(`DTSTART:${ersterTag.replace(/-/g, '')}T`).test(ics), '.ics mit Titel und Datum gespeichert');

  // --- Klick auf ein markiertes Feld wählt es ab, nochmal setzt es -------------------------
  await ziehe([f(1320)]);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="${f(1320)}"]').dataset.stufe`)) === '', 'Klick auf ein markiertes Feld wählt es ab');
  await ziehe([f(1320)]);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="${f(1320)}"]').dataset.stufe`)) === 'notfalls', 'nochmal klicken setzt es wieder');
  await js(`document.querySelector('[data-modus="kann"]').click(); true`);

  // --- Diagonal ziehen markiert ein Rechteck -------------------------------------------------
  const spalten = await js(`[...new Set([...document.querySelectorAll('[data-raster="meine"] [data-feld]')].map((e) => e.dataset.feld.split('T')[0]))]`);
  const [t3, t4] = [spalten[2], spalten[3]];
  await tippe('[data-name]', 'Rex');
  await ziehe([`${t3}T1080`, `${t4}T1140`]);
  await warte(300);
  const rechteck = await js(`['${t3}T1080','${t3}T1140','${t4}T1080','${t4}T1140'].map((k) => document.querySelector('[data-raster="meine"] [data-feld="' + k + '"]').dataset.stufe).join(',')`);
  pruefe(rechteck === 'kann,kann,kann,kann', `diagonal gezogen: alle vier Felder des Rechtecks (${rechteck})`);
  await tippe('[data-name]', 'Jo');

  // --- Als Datei weitergeben, jemand antwortet, wieder einlesen ------------------------
  const dateiZiel = path.join(tmp, 'umfrage.kalender.json');
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: dateiZiel });
  await js(`document.querySelector('[data-datei]').click(); true`);
  await warte(800);
  pruefe(fs.existsSync(dateiZiel), 'als Datei weitergegeben');
  const paket = JSON.parse(fs.readFileSync(dateiZiel, 'utf8'));
  paket.umfrage.antworten.push({ person: 'Sam', felder: { [f(1140)]: 'kann', [f(1200)]: 'kann' }, zeit: new Date().toISOString() });
  fs.writeFileSync(dateiZiel, JSON.stringify(paket));
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(600);
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dateiZiel] });
  await js(`document.querySelector('[data-einlesen]').click(); true`);
  await warte(1200);
  pruefe(/Sam/.test(await js(`document.body.innerText`)), 'eingelesen: Sams Antwort ist dabei');
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '3', 'Heatmap: um 19 Uhr können jetzt drei');

  // --- Filter in „Alle" ------------------------------------------------------------------
  const waehle = (sel, wert) =>
    js(`(() => { const e = document.querySelector('${sel}');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
      e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await js(`document.querySelector('[data-person="Sam"]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '2', 'Sam abgewählt: um 19 Uhr zählen zwei');
  await js(`document.querySelector('[data-person="Sam"]').click(); true`);
  await waehle('[data-mindestens]', '3');
  await warte(300);
  pruefe(
    (await js(`document.querySelector('[data-heat="${f(1080)}"]').dataset.passt`)) === '0' && (await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.passt`)) === '1',
    'mindestens drei: 18 Uhr ausgegraut, 19 Uhr nicht'
  );
  await waehle('[data-mindestens]', '');
  await js(`document.querySelector('[data-pflicht="Rex"]').click(); true`);
  await warte(300);
  pruefe(
    (await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.passt`)) === '0' &&
      (await js(`[...document.querySelectorAll('[data-vorschlag]')].every((v) => v.dataset.vorschlag.startsWith('${t3}') || v.dataset.vorschlag.startsWith('${t4}'))`)),
    'Rex muss dabei sein: nur noch Rex\' Tage'
  );
  await js(`document.querySelector('[data-pflicht="Rex"]').click(); true`);

  // --- Sitzungslänge offen: längste Blöcke ----------------------------------------------------
  await js(`document.querySelector('details.karte').open = true; true`);
  await waehle('[data-dauer]', '');
  await warte(400);
  const offenerVorschlag = await js(`document.querySelector('[data-vorschlag]')?.textContent ?? ''`);
  pruefe(/19:00–21:00/.test(offenerVorschlag), `ohne Dauer: der Block, in dem die meisten können (${offenerVorschlag.slice(0, 60)})`);
  await waehle('[data-dauer]', '240');

  // --- Zeitzone: das Raster in der eigenen Zone ------------------------------------------------
  await waehle('[data-zone-umfrage]', 'Europe/Berlin');
  await warte(300);
  await waehle('[data-zone-ich]', 'America/New_York');
  await warte(400);
  const ersteZeit = await js(`document.querySelector('[data-raster="meine"] .raster__zeit').textContent`);
  pruefe(ersteZeit === '11:00', `in New York beginnt das Raster um 11:00 statt 17:00 (${ersteZeit})`);
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '3', 'dieselben Felder, nur umgerechnet');
  await waehle('[data-zone-ich]', 'Europe/Berlin');
  await waehle('[data-zone-umfrage]', '');
  await warte(300);

  // --- Antwort aus dem Raum (der Weg der Hülle) -----------------------------------------
  const id = paket.umfrage.id;
  const geaendert = await nimmRaumNachricht(
    userData,
    JSON.stringify({ art: 'antwort', umfrageId: id, antwort: { person: 'Kai', felder: { [f(1140)]: 'kann' }, zeit: new Date().toISOString() } })
  );
  pruefe(geaendert === true, 'eine Raumnachricht wird in die Ablage übernommen');
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(600);
  await js(`document.querySelector('[data-umfrage="${id}"]').click(); true`);
  await warte(800);
  pruefe((await js(`document.querySelector('[data-heat="${f(1140)}"]').dataset.anzahl`)) === '4', 'nach dem Öffnen: Kai ist dabei');
  pruefe(await js(`Boolean(document.querySelector('[data-termin]'))`), 'der festgelegte Termin bleibt dabei erhalten');

  // --- Sammlung: nächster Termin --------------------------------------------------------
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(600);
  pruefe(/Sitzung 13/.test(await js(`document.querySelector('[data-naechste]')?.textContent ?? ''`)), 'die Sammlung zeigt den nächsten Termin');

  const eintraege = (await hjs('window.shell.suche.eintraege()')) ?? [];
  pruefe(eintraege.some((e) => e.werkzeug === 'kalender' && e.name === 'Sitzung 13'), 'Strg+K kennt die Umfrage');

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length === 0 ? '\nCampaign Calendar bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
