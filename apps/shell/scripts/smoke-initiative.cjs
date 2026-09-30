/**
 * Rauchtest des Initiative Trackers — in der Huelle, an der laufenden
 * Anwendung.
 *
 * Die Modelltests unter apps/initiative/tests pruefen die Regeln: Reihenfolge,
 * Runden, Gruppen, Schaden. Was sie nicht sehen koennen, ist, ob ein Klick
 * wirklich ankommt: ob die Bruecke zum Hauptprozess steht, ob die Gruppe drei
 * Felder zeichnet, ob Schaden im richtigen Feld landet und ob der Kampf die
 * Platte erreicht. Genau daran ist beim Karteneditor der erste Anlauf
 * gescheitert — die Modelltests waren gruen und die Oberflaeche blieb leer.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-initiative.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trk-'));
app.setPath('userData', path.join(tmp, 'userData'));
process.env.TTRPG_TOOLS_START_APP = 'initiative';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const fehler = [];
const pruefe = (b, t) => { console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`); if (!b) fehler.push(t); };

app.whenReady().then(async () => {
  await warte(5000);
  const fenster = BaseWindow.getAllWindows()[0];
  const sicht = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/initiative/'));
  pruefe(Boolean(sicht), 'der Tracker haengt als eigene Ansicht im Fenster');
  if (!sicht) { app.exit(1); return; }

  const konsole = [];
  sicht.webContents.on('console-message', (_e, level, text) => {
    if (level >= 2) konsole.push(text.slice(0, 160));
  });
  const js = (a) => sicht.webContents.executeJavaScript(a);

  pruefe(await js("Boolean(document.querySelector('.tracker'))"), 'seine Oberflaeche steht');
  pruefe(await js("typeof window.initiative === 'object'"), 'die Bruecke zum Hauptprozess ist da');
  pruefe(await js("Boolean(document.querySelector('.leer'))"), 'ohne Teilnehmer steht der Leertext');

  // Teilnehmer anlegen
  await js(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Participant') || b.textContent.includes('Teilnehmer')).click(); true`);
  await warte(600);
  pruefe(await js("document.querySelectorAll('.zeile').length === 1"), 'ein Teilnehmer wurde angelegt');
  pruefe(await js("Boolean(document.querySelector('.ausklapp'))"), 'seine Felder sind gleich offen');

  // Name und Werte setzen
  await js(`(() => {
    const setz = (el, v) => { Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', {bubbles:true})); };
    const felder = [...document.querySelectorAll('.ausklapp__felder input')];
    setz(felder[0], 'Goblin'); setz(felder[1], '15'); setz(felder[3], '7');
    return true; })()`);
  await warte(600);
  pruefe((await js("document.querySelector('.zeile__ini').textContent")) === '15', 'die Initiative steht in der Zeile');
  pruefe((await js("document.querySelector('.koerper__max').textContent")) === '/7', 'die Trefferpunkte stehen');

  // Gruppe auf 3
  await js(`(() => { const f = [...document.querySelectorAll('.ausklapp__felder input')][4];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'3');
    f.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await warte(600);
  pruefe(await js("document.querySelectorAll('.koerper').length === 3"), 'die Gruppe hat drei Koerper');

  // Schaden auf den zweiten
  await js(`(() => { const f = [...document.querySelectorAll('.koerper__schaden')][1];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'5');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    f.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true; })()`);
  await warte(800);
  const hp = await js("[...document.querySelectorAll('.koerper__hp')].map(e => e.value).join(',')");
  pruefe(hp === '7,2,7', `Schaden trifft genau einen Koerper (${hp})`);

  // Kampf beginnen und weiter
  await js(`[...document.querySelectorAll('button')].find(b => /Start combat|Kampf beginnen/.test(b.textContent)).click(); true`);
  await warte(700);
  pruefe(await js("Boolean(document.querySelector('.zeile--dran'))"), 'der Kampf laeuft, jemand ist dran');
  pruefe(await js("Boolean(document.querySelector('.leiste__runde'))"), 'die Runde wird angezeigt');

  // Leertaste
  await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true})); true`);
  await warte(500);
  pruefe(await js("Boolean(document.querySelector('.leiste__runde'))"), 'nach der Leertaste laeuft er weiter');

  // Auf der Platte gelandet?
  const datei = path.join(tmp, 'userData', 'initiative', 'kampf.json');
  const da = fs.existsSync(datei);
  pruefe(da, 'der laufende Kampf steht auf der Platte');
  if (da) {
    const gespeichert = JSON.parse(fs.readFileSync(datei, 'utf8'));
    pruefe(gespeichert.teilnehmer[0]?.name === 'Goblin', 'und traegt den richtigen Namen');
    pruefe(gespeichert.laeuft === true, 'und weiss, dass der Kampf laeuft');
  }

  // --- Rechtsklick auf eine Teilnehmende ----------------------------------
  /*
   * Geprueft wird die Bedienung: dass das Menue aufgeht, dass Escape es
   * schliesst, und dass Umbenennen wirklich umbenennt — mit dem bisherigen
   * Namen als Vorgabe, damit man nicht alles neu tippt.
   */
  await js(`(() => { const ziel = document.querySelector('.zeile__name');
    const k = ziel.getBoundingClientRect();
    ziel.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: k.left + 10, clientY: k.top + 10 }));
    return true; })()`);
  await warte(400);
  pruefe(await js("Boolean(document.querySelector('.kontextmenue'))"), 'der Rechtsklick oeffnet ein Menue');
  pruefe(
    (await js("document.querySelectorAll('.kontextmenue button').length")) === 3,
    'mit Umbenennen, Duplizieren und Entfernen'
  );

  await js(`document.querySelector('.kontextmenue').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await warte(300);
  pruefe(
    !(await js("Boolean(document.querySelector('.kontextmenue'))")),
    'Escape schliesst es wieder'
  );

  // Umbenennen durchspielen.
  await js(`(() => { const ziel = document.querySelector('.zeile__name');
    const k = ziel.getBoundingClientRect();
    ziel.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: k.left + 10, clientY: k.top + 10 }));
    return true; })()`);
  await warte(400);
  await js(`[...document.querySelectorAll('.kontextmenue button')]
    .find(b => /Umbenennen|Rename/.test(b.textContent)).click(); true`);
  await warte(500);
  pruefe(
    (await js("document.querySelector('.dialog input')?.value ?? ''")) === 'Goblin',
    'der Umbenennen-Dialog bringt den bisherigen Namen mit'
  );
  await js(`(() => { const f = document.querySelector('.dialog input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, 'Hobgoblin');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    [...document.querySelectorAll('.dialog__knoepfe button')].pop().click(); return true; })()`);
  await warte(700);
  pruefe(
    (await js("document.querySelector('.zeile__name').textContent")).includes('Hobgoblin'),
    'und das Umbenennen kommt in der Zeile an'
  );
  // Zurueck, damit die folgenden Pruefungen ihren Namen wiederfinden.
  await js(`(() => { const ziel = document.querySelector('.zeile__name');
    const k = ziel.getBoundingClientRect();
    ziel.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: k.left + 10, clientY: k.top + 10 }));
    return true; })()`);
  await warte(400);
  await js(`[...document.querySelectorAll('.kontextmenue button')]
    .find(b => /Umbenennen|Rename/.test(b.textContent)).click(); true`);
  await warte(500);
  await js(`(() => { const f = document.querySelector('.dialog input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, 'Goblin');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    [...document.querySelectorAll('.dialog__knoepfe button')].pop().click(); return true; })()`);
  await warte(700);

  // --- Rechtsklick auf die freie Flaeche -----------------------------------
  /*
   * Aus dem Gebrauch: „Wenn ich in Initiative Rechtsklick in die freie
   * Flaeche unter den Participants klicke erwarte ich wieder ein Pop-Up
   * Menue mit dem neue Participants/Terrain hinzugefuegt werden koennen."
   */
  await js(`(() => { const liste = document.querySelector('.liste');
    const k = liste.getBoundingClientRect();
    liste.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: k.left + 20, clientY: k.bottom - 10 }));
    return true; })()`);
  await warte(400);
  pruefe(
    await js("Boolean(document.querySelector('.kontextmenue'))"),
    'der Rechtsklick auf die freie Flaeche oeffnet ein Menue'
  );
  const flaechenEintraege = await js(
    "[...document.querySelectorAll('.kontextmenue button')].map(k => k.textContent).join('|')"
  );
  pruefe(
    /Participant|Teilnehmer/.test(flaechenEintraege) && /Terrain|Gelände/.test(flaechenEintraege),
    `mit Teilnehmer und Gelaende (${flaechenEintraege})`
  );

  const vorDemMenue = await js("document.querySelectorAll('.zeile').length");
  await js(`[...document.querySelectorAll('.kontextmenue button')].shift().click(); true`);
  await warte(600);
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) === vorDemMenue + 1,
    'und der erste Eintrag legt wirklich einen Teilnehmer an'
  );
  // Wieder weg, damit die naechsten Schritte dieselbe Liste sehen.
  await js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); true");
  await warte(500);

  // --- Rueckgaengig -------------------------------------------------------
  /*
   * Der Fall aus dem Gebrauch: „Wenn man ein Participant löscht soll hier
   * ZURÜCK bzw. STRG+Z das auch rückgängig machen." Am Modell ist der
   * Verlauf geprueft; hier geht es darum, dass die Taste und der Knopf
   * wirklich daran haengen und dass die Zeile mit allem zurueckkommt.
   */
  const namen = () =>
    js("[...document.querySelectorAll('.zeile__name')].map((e) => e.textContent).join('|')");
  const vorherNamen = await namen();
  const anzahlVorher = await js("document.querySelectorAll('.zeile').length");

  // Ueber das Rechtsklickmenue entfernen — derselbe Weg wie von Hand.
  await js(`(() => { const ziel = document.querySelector('.zeile__name');
    const k = ziel.getBoundingClientRect();
    ziel.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, clientX: k.left + 10, clientY: k.top + 10 }));
    return true; })()`);
  await warte(400);
  await js(`[...document.querySelectorAll('.kontextmenue button')].pop().click(); true`);
  await warte(600);
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) === anzahlVorher - 1,
    'der Teilnehmer ist entfernt'
  );

  // Strg+Z am Fenster, nicht am Knopf: genau so tippt man es.
  await js(`document.dispatchEvent(new KeyboardEvent('keydown',
    { key: 'z', ctrlKey: true, bubbles: true })); true`);
  await warte(600);
  pruefe((await namen()) === vorherNamen, 'Strg+Z holt ihn vollstaendig zurueck');

  // Und wieder vor, ueber den Knopf in der Leiste.
  await js(`[...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === '↷').click(); true`);
  await warte(600);
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) === anzahlVorher - 1,
    'Wiederherstellen entfernt ihn erneut'
  );

  // Zurueck auf den vollen Stand, damit die naechsten Schritte dieselbe
  // Liste sehen wie bisher.
  await js(`[...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim() === '↶').click(); true`);
  await warte(600);
  pruefe((await namen()) === vorherNamen, 'und der Knopf zurueck ebenfalls');

  // Der Zurueck-Pfeil der Huelle ist etwas anderes und darf hier nichts
  // zuruecknehmen — sonst kaeme man nicht mehr zum vorigen Werkzeug.
  await js(`document.dispatchEvent(new KeyboardEvent('keydown',
    { key: 'ArrowLeft', altKey: true, bubbles: true })); true`);
  await warte(500);
  pruefe((await namen()) === vorherNamen, 'Alt+Links nimmt im Tracker nichts zurueck');

  // --- Begegnung speichern und laden --------------------------------------
  // Diese beiden Knoepfe hat der Rauchtest zuerst nicht gedrueckt — und genau
  // dort steckte ein Fehler, den keine Modellpruefung sehen konnte: die
  // Namensabfrage lief ueber `window.prompt`, und das wirft in Electron
  // („prompt() is not supported"). Das Speichern waere schlicht gestorben.
  await js(`[...document.querySelectorAll('button')].find(b => /Save encounter|Begegnung speichern/.test(b.textContent)).click(); true`);
  await warte(600);
  pruefe(await js("Boolean(document.querySelector('.dialog'))"), 'die Namensabfrage geht auf');
  await js(`(() => { const f = document.querySelector('.dialog input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, 'Testbegegnung');
    f.dispatchEvent(new Event('input',{bubbles:true}));
    [...document.querySelectorAll('.dialog__knoepfe button')].pop().click(); return true; })()`);
  await warte(900);
  pruefe(!(await js("Boolean(document.querySelector('.dialog'))")), 'und schliesst sich wieder');

  const begegnungsOrdner = path.join(tmp, 'userData', 'initiative', 'begegnungen');
  const dateien = fs.existsSync(begegnungsOrdner) ? fs.readdirSync(begegnungsOrdner) : [];
  pruefe(dateien.length === 1, `die Begegnung liegt als Datei (${dateien.join(', ') || 'keine'})`);
  if (dateien.length) {
    const inhalt = fs.readFileSync(path.join(begegnungsOrdner, dateien[0]), 'utf8');
    pruefe(inhalt.startsWith('---'), 'als Markdown mit Kopf');
    pruefe(inhalt.includes('Goblin'), 'und mit den Teilnehmern darin');
  }

  // --- Neue Begegnung -----------------------------------------------------
  /*
   * Der Knopf wirft den jetzigen Kampf weg — und fragt vorher, wenn etwas
   * auf dem Spiel steht. Hier steht beides: der Kampf laeuft, und gespeichert
   * ist er in diesem Moment noch nicht.
   */
  const neuKnopf = `[...document.querySelectorAll('button')].find(
    b => /New encounter|Neue Begegnung/.test(b.textContent))`;
  await js(`${neuKnopf}.click(); true`);
  await warte(500);
  pruefe(await js("Boolean(document.querySelector('.dialog'))"), 'die Rueckfrage kommt');

  // Abbrechen laesst alles stehen.
  await js(`[...document.querySelectorAll('.dialog__knoepfe button')].shift().click(); true`);
  await warte(500);
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) > 0,
    'Abbrechen laesst die Teilnehmer stehen'
  );

  // --- Die Sammlung: Kacheln und Suche ------------------------------------
  /*
   * Aufgebaut wie im Monster Creator. Geprueft wird vor allem das, was diese
   * Sammlung von den anderen unterscheidet: gesucht wird auch ueber die
   * Namen der Teilnehmer, nicht nur ueber den der Begegnung.
   */
  await js(`[...document.querySelectorAll('button')].find(
    b => /^(Collection|Sammlung)$/.test(b.textContent.trim())).click(); true`);
  await warte(600);
  pruefe(await js("Boolean(document.querySelector('.kacheln'))"), 'die Sammlung zeigt Kacheln');
  pruefe(
    (await js("document.querySelectorAll('.kacheln .kachel').length")) === 1,
    'die gespeicherte Begegnung steht als Kachel da'
  );

  const suchfeld = "document.querySelector('.sammlung__suche')";
  const tippe = async (wort) =>
    js(`(() => { const f = ${suchfeld};
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, '${wort}');
      f.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  const kachelZahl = () => js("document.querySelectorAll('.kacheln .kachel').length");

  await tippe('Testbegegnung');
  await warte(300);
  pruefe((await kachelZahl()) === 1, 'die Suche findet den Namen der Begegnung');

  // Goblin ist der Teilnehmer von weiter oben — im Namen der Begegnung steht
  // er nicht.
  await tippe('Goblin');
  await warte(300);
  pruefe((await kachelZahl()) === 1, 'und den Namen eines Teilnehmers');

  await tippe('Drachenhort');
  await warte(300);
  pruefe((await kachelZahl()) === 0, 'und findet nichts, wo nichts ist');

  await tippe('');
  await warte(300);
  await js(`[...document.querySelectorAll('.sammlung__ansicht button')].pop().click(); true`);
  await warte(300);
  pruefe(
    await js("Boolean(document.querySelector('.begegnungen__liste'))"),
    'der Umschalter bringt die Liste'
  );
  await js(`document.querySelector('.begegnungen__zu').click(); true`);
  await warte(400);

  // --- Kampf beenden ------------------------------------------------------
  // Auch das lief ueber einen Browser-Dialog (`confirm`) und haette den
  // Renderer angehalten.
  await js(`[...document.querySelectorAll('button')].find(b => /End combat|Kampf beenden/.test(b.textContent)).click(); true`);
  await warte(500);
  pruefe(await js("Boolean(document.querySelector('.dialog'))"), 'die Rueckfrage vor dem Beenden kommt');
  await js(`[...document.querySelectorAll('.dialog__knoepfe button')].pop().click(); true`);
  await warte(600);
  pruefe(!(await js("Boolean(document.querySelector('.leiste__runde'))")), 'der Kampf ist beendet');

  // Jetzt ist gespeichert und der Kampf beendet: es steht nichts mehr auf
  // dem Spiel, also darf nicht mehr gefragt werden.
  await js(`${neuKnopf}.click(); true`);
  await warte(600);
  pruefe(
    !(await js("Boolean(document.querySelector('.dialog'))")),
    'ohne Verlust kommt keine Rueckfrage'
  );
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) === 0,
    'und der Tracker ist leer'
  );

  // --- Sprachkopplung ---------------------------------------------------
  // Bei den anderen beiden Werkzeugen war genau das die Fehlerquelle: die
  // Modelltests sahen die Kopplung nicht, und im Fenster blieb ein Werkzeug
  // auf der alten Sprache stehen.
  //
  // Der Tracker hatte bis 0.2.0 einen eigenen EN/DE-Waehler; der ist raus,
  // weil die Sprache in den Einstellungen der Huelle steht. Geprueft wird
  // deshalb nur noch die eine Richtung, die es noch gibt — und dass der
  // Waehler wirklich weg ist.
  pruefe(
    !(await js("Boolean(document.querySelector('.leiste__sprache'))")),
    'der Tracker hat keinen eigenen Sprachwaehler mehr'
  );

  // Gelesen wird die Sprache am `lang` des Dokuments: das setzt der Tracker
  // selbst, sobald er umgestellt hat.
  const spracheJetzt = () => js('document.documentElement.lang');
  const vorher = await spracheJetzt();
  const andere = vorher === 'de' ? 'en' : 'de';

  const huelle = fenster.contentView.children[0];
  await huelle.webContents.executeJavaScript(
    `window.shell.einstellungen.schreiben({ language: '${andere}' })`
  );
  await warte(900);
  pruefe((await spracheJetzt()) === andere, `der Tracker folgt der Huelle (${vorher} -> ${andere})`);

  // Und die Beschriftungen gehen wirklich mit, nicht nur das `lang`.
  const knopfText = await js(
    "[...document.querySelectorAll('button')].map((k) => k.textContent).join('|')"
  );
  pruefe(
    andere === 'de' ? knopfText.includes('Teilnehmer') : knopfText.includes('Participant'),
    `die Beschriftungen sind mitgegangen (${andere})`
  );

  await huelle.webContents.executeJavaScript(
    `window.shell.einstellungen.schreiben({ language: '${vorher}' })`
  );
  await warte(900);
  pruefe((await spracheJetzt()) === vorher, 'und wieder zurueck');

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' | ') || 'keine'})`);

  console.log(fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen.` : '\nTracker in der Huelle bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
