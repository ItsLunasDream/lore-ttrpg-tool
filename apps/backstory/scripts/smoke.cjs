/**
 * End-to-End-Rauchtest der gebauten App: legt Kampagne und Notizen an,
 * tippt einen Wiki-Link, speichert und prueft die Datei auf der Platte.
 * Aufruf: xvfb-run -a npx electron scripts/smoke.cjs --no-sandbox
 */
const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

// Das '#' im Namen ist Absicht: der Speicherort wird frei gewaehlt und darf
// Zeichen enthalten, die in einer URL eine Bedeutung haben.
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'backstory-smoke #'));
app.setPath('userData', userData);

// Dieser Test klickt auf deutsche Beschriftungen. Ausgeliefert wird aber
// Englisch (Konvention 6), deshalb wird die Sprache hier vorab gesetzt statt
// jedes Label doppelt zu fuehren. Der uebrige Teil der Einstellungen bleibt
// leer und wird beim Lesen mit den Standardwerten aufgefuellt.
fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ language: 'de' }), 'utf8');

require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const problems = [];

function check(condition, message) {
  if (!condition) problems.push(message);
}

async function waitForWindow() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const [window] = BrowserWindow.getAllWindows();
    if (window) return window;
    await sleep(100);
  }
  throw new Error('Kein Fenster geöffnet.');
}

/** Setzt einen React-kontrollierten Eingabewert so, dass onChange feuert. */
const SET_VALUE = `
function setValue(element, value) {
  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}`;

function run(window, body) {
  return window.webContents.executeJavaScript(`(() => { ${SET_VALUE}\n${body} })()`);
}

/** Klickt den Button, dessen Beschriftung `label` enthaelt. */
function clickButton(window, label, scope = 'document') {
  return run(
    window,
    `const button = [...${scope}.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(label)}));
     if (!button) throw new Error('Button nicht gefunden: ' + ${JSON.stringify(label)});
     button.click();
     return true;`
  );
}

async function fillDialog(window, value, confirmLabel) {
  await run(window, `setValue(document.querySelector('.modal input'), ${JSON.stringify(value)}); return true;`);
  await sleep(120);
  await clickButton(window, confirmLabel, "document.querySelector('.modal')");
  await sleep(500);
}

/** Oeffnet das Kampagnen-Menue und waehlt einen Eintrag. */
/** Eine Kampagne ueber das Auswahlmenue oeffnen. */
async function waehleKampagne(window, name) {
  await run(
    window,
    `const opener = document.querySelector('.campaign-bar__picker > .menu > button');
     if (!opener) throw new Error('Kampagnenauswahl fehlt');
     if (opener.getAttribute('aria-expanded') !== 'true') opener.click();
     return true;`
  );
  await sleep(300);
  await run(
    window,
    `const eintrag = [...document.querySelectorAll('.campaign-bar__picker .menu__list button')]
       .find((b) => b.textContent === ${JSON.stringify(name)});
     if (!eintrag) throw new Error('Kampagne nicht in der Auswahl: ' + ${JSON.stringify(name)});
     eintrag.click();
     return true;`
  );
  await sleep(1200);
}

/**
 * Kampagnenexport: Menueeintrag, dann im Dialog auf Exportieren.
 *
 * Der Dialog fragt seit kurzem, welche Notizen mitkommen. Voreingestellt
 * sind alle, der Test uebernimmt das.
 */
async function kampagnenExport(window, label, optionen = {}) {
  await menuAction(window, label);
  await sleep(500);
  if (optionen.mitGraph) {
    await run(
      window,
      `const kaestchen = [...document.querySelectorAll('.modal .field--inline input')];
       const netz = kaestchen[kaestchen.length - 1];
       if (!netz) throw new Error('Die Option fuers Beziehungsnetz fehlt');
       if (!netz.checked) netz.click();
       return true;`
    );
    await sleep(300);
  }
  await run(
    window,
    `const knopf = [...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Exportieren');
     if (!knopf) throw new Error('Der Export-Dialog kam nicht');
     knopf.click();
     return true;`
  );
  await sleep(500);
}

async function menuAction(window, label) {
  await run(
    window,
    `const opener = [...document.querySelectorAll('.campaign-bar > .menu > button')][0];
     if (!opener) throw new Error('Kampagnen-Menü fehlt');
     if (opener.getAttribute('aria-expanded') !== 'true') opener.click();
     return true;`
  );
  await sleep(300);
  await run(
    window,
    `const entry = [...document.querySelectorAll('.menu__list button')]
       .find((b) => b.textContent === ${JSON.stringify(label)});
     if (!entry) throw new Error('Menüeintrag nicht gefunden: ' + ${JSON.stringify(label)});
     entry.click();
     return true;`
  );
  await sleep(500);
}

/**
 * Drueckt einen Knopf der Werkzeugleiste. Die reagiert auf mousedown statt
 * click, damit der Editor den Fokus behaelt.
 */
async function pressToolbar(window, label) {
  await run(
    window,
    `const button = [...document.querySelectorAll('.toolbar button')]
       .find((b) => b.textContent === ${JSON.stringify(label)});
     if (!button) throw new Error('Werkzeug nicht gefunden: ' + ${JSON.stringify(label)});
     button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
     return true;`
  );
  await sleep(400);
}

/** Waehlt eine Notiz ueber die Liste in der Seitenleiste aus. */
async function selectNote(window, title) {
  await run(
    window,
    `const entry = [...document.querySelectorAll('.note-list li button')]
       .find((b) => b.textContent.includes(${JSON.stringify(title)}));
     if (!entry) throw new Error('Notiz nicht in der Liste: ' + ${JSON.stringify(title)});
     entry.click();
     return true;`
  );
  await sleep(700);
}

/** Setzt ein Steckbrieffeld ueber seine Beschriftung. */
async function setField(window, label, value) {
  await run(
    window,
    `const field = [...document.querySelectorAll('.note-editor__side .field')]
       .find((f) => f.textContent.startsWith(${JSON.stringify(label)}));
     if (!field) throw new Error('Feld nicht gefunden: ' + ${JSON.stringify(label)});
     setValue(field.querySelector('input'), ${JSON.stringify(value)});
     return true;`
  );
  await sleep(250);
}

/** Einen Tastendruck ans Fenster schicken, so wie save() es fuer Strg+S tut. */
async function taste(window, key) {
  await run(
    window,
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })); return true;`
  );
}

async function save(window) {
  await run(
    window,
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); return true;`
  );
  await sleep(1200);
}

/**
 * Dateidialoge blockieren einen automatischen Durchlauf. Fuer den Rauchtest
 * werden sie durch feste Antworten ersetzt.
 */
/** Was der Nachfrage-Dialog vor Plattenaktionen antworten soll. */
let speicherAntwort = 0; // 0 = Speichern und fortfahren
const nachgefragt = [];

function stubDialogs(exportDir) {
  fs.mkdirSync(exportDir, { recursive: true });

  // Ohne Autosave fragt der Export, was mit Ungespeichertem geschehen soll.
  // Der Dialog ist ein Systemfenster; hier wird er beantwortet.
  dialog.showMessageBox = async (...args) => {
    nachgefragt.push(args.length > 1 ? args[1] : args[0]);
    return { response: speicherAntwort, checkboxChecked: false };
  };

  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [exportDir] });
  dialog.showSaveDialog = async (...args) => {
    const options = args.length > 1 ? args[1] : args[0];
    const name = path.basename(options?.defaultPath || 'ausgabe');
    return { canceled: false, filePath: path.join(exportDir, name) };
  };
}

app.whenReady().then(async () => {
  try {
    const window = await waitForWindow();

    window.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) problems.push(`console: ${message}`);
    });
    window.webContents.on('render-process-gone', (_event, details) =>
      problems.push(`renderer weg: ${details.reason}`)
    );

    await new Promise((resolve) => {
      if (!window.webContents.isLoading()) resolve();
      else window.webContents.once('did-finish-load', resolve);
    });
    await sleep(800);

    check(await run(window, 'return typeof window.api === "object";'), 'preload stellt window.api nicht bereit');

    // 1. Kampagne anlegen
    await clickButton(window, 'Erste Kampagne anlegen');
    await sleep(300);
    await fillDialog(window, 'Sturmküste', 'Anlegen');
    check(await run(window, `return document.querySelector('.campaign-bar__picker > .menu > button').textContent.includes('Sturmküste');`),
      'Kampagne wurde nicht ausgewaehlt');

    // 2. Zwei Charaktere anlegen
    for (const name of ['Mira Falkenhand', 'Toran']) {
      await clickButton(window, '+ Charakter');
      await sleep(300);
      await fillDialog(window, name, 'Anlegen');
    }
    check(await run(window, `return document.querySelectorAll('.note-list li').length === 2;`),
      'Notizliste zeigt nicht beide Charaktere');

    // 3. Beziehungen: mit zwei Notizen muss die Auswahl gefuellt sein
    await selectNote(window, 'Mira Falkenhand');
    check(
      await run(window, `const select = document.querySelector('.relations__add select');
         return Boolean(select) && select.options.length === 2;`),
      'Auswahlliste für Beziehungen ist leer, obwohl es eine zweite Notiz gibt'
    );

    await run(
      window,
      `const select = document.querySelector('.relations__add select');
       const option = [...select.options].find((o) => o.textContent.includes('Toran'));
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(300);
    await clickButton(window, 'Hinzufügen', "document.querySelector('.relations__add')");
    await sleep(500);
    check(await run(window, `return document.querySelectorAll('.relation').length === 1;`),
      'Beziehung wurde nicht angelegt');

    // Bezeichnung setzen, sonst traegt die Kante im Graphen spaeter keine.
    await run(window, `setValue(document.querySelector('.relation__type'), 'Mentorin'); return true;`);
    await sleep(400);
    await save(window);
    await sleep(400);

    // Die Gegenrichtung fehlt und muss angeboten werden
    check(await run(window, `return Boolean(document.querySelector('.relation__reverse'));`),
      'Fehlende Gegenrichtung wird nicht angeboten');
    await clickButton(window, 'Gegenrichtung anlegen', "document.querySelector('.relation__reverse')");
    await sleep(1200);
    check(await run(window, `return document.querySelector('.relation__reverse') === null;`),
      'Hinweis auf die Gegenrichtung bleibt stehen');

    await selectNote(window, 'Toran');
    check(await run(window, `return document.querySelectorAll('.relation').length === 1;`),
      'Gegenrichtung wurde bei Toran nicht angelegt');

    // Der Gegenrichtung eine eigene Bezeichnung geben. Im Graphen muessen
    // beide danach nebeneinander lesbar sein.
    await run(window, `setValue(document.querySelector('.relation__type'), 'Schuldner'); return true;`);
    await sleep(400);
    await save(window);
    await sleep(600);
    check(
      await run(window, `return document.querySelector('.relation__type').value === 'Schuldner';`),
      'Die Bezeichnung der Gegenrichtung wurde nicht übernommen'
    );
    await selectNote(window, 'Mira Falkenhand');
    // Jetzt gibt es keine freie Notiz mehr, statt leerer Liste muss ein Hinweis stehen
    check(await run(window, `return document.querySelector('.relations__add') === null;`),
      'Leere Auswahlliste bleibt sichtbar');

    // 4. Mira bekommt Steckbrieffeld und Text, damit die Kurzinfo etwas zeigt
    await selectNote(window, 'Mira Falkenhand');
    await setField(window, 'Spezies', 'Waldelfe');
    await run(window, `document.querySelector('.ProseMirror').focus(); return true;`);
    await sleep(200);
    window.webContents.insertText('Sie wuchs im Hafen von Baldurs Tor auf.');
    await sleep(600);
    await save(window);

    // 5. Text mit Wiki-Link in Torans Notiz tippen
    await selectNote(window, 'Toran');

    // Frisch geladen gibt es nichts zurueckzuholen: beide Pfeile ausgegraut.
    const pfeile = `[...document.querySelectorAll('.toolbar button')].slice(-2).map((knopf) => knopf.disabled)`;
    check(await run(window, `return JSON.stringify(${pfeile}) === '[true,true]';`),
      'Undo und Redo sind bei einer frisch geladenen Notiz nicht ausgegraut');

    await run(window, `document.querySelector('.ProseMirror').focus(); return true;`);
    await sleep(200);
    window.webContents.insertText('Er schuldet [[Mira Falkenhand]] noch Gold.');
    await sleep(600);

    check(await run(window, `return document.querySelectorAll('.ProseMirror .wikilink').length === 1;`),
      'Wiki-Link wurde im Editor nicht hervorgehoben');
    // Jetzt steht etwas im Verlauf: Undo geht, Redo noch nicht.
    check(await run(window, `return JSON.stringify(${pfeile}) === '[false,true]';`),
      'Nach dem Tippen stimmt der Zustand der Pfeile nicht');
    check(await run(window, `return document.querySelectorAll('.ProseMirror .wikilink--unresolved').length === 0;`),
      'Bestehende Notiz wurde faelschlich als offener Link markiert');
    check(await run(window, `return /\\d+ Wörter/.test(document.querySelector('.note-editor__words').textContent);`),
      'Wortzaehler fehlt');

    // 5b. Der Cursor mitten im fertigen Verweis darf keine Vorschlagsliste
    // oeffnen. Nach links sieht es dort aus wie ein frisch begonnener Link
    // (`[[Mira` ohne `]]`) — frueher schlug die Liste deshalb den halben
    // Titel vor, legte ihn als neue Notiz an und haengte ein zweites `]]` an.
    const vorherText = await run(window, `return document.querySelector('.ProseMirror').textContent;`);
    await run(
      window,
      `const knoten = [...document.querySelectorAll('.ProseMirror .wikilink')][0].firstChild;
       const bereich = document.createRange();
       bereich.setStart(knoten, 4);
       bereich.collapse(true);
       const auswahl = window.getSelection();
       auswahl.removeAllRanges();
       auswahl.addRange(bereich);
       document.querySelector('.ProseMirror').focus();
       return true;`
    );
    await sleep(400);
    check(await run(window, `return document.querySelector('.suggestions') === null;`),
      'Vorschlagsliste oeffnet mitten in einem fertigen Verweis');
    check(await run(window, `return document.querySelector('.ProseMirror').textContent;`) === vorherText,
      'Der Text hat sich beim Klick in den Verweis veraendert');

    // 5c. Die Vorschlagsliste muss sich mit den Pfeiltasten bedienen lassen.
    // Der Probetext wird hinterher wieder entfernt, damit die folgenden
    // Pruefungen denselben Notiztext vorfinden wie vorher.
    const PROBE = ' Und [[Mi';
    await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       feld.focus();
       const auswahl = window.getSelection();
       auswahl.selectAllChildren(feld);
       auswahl.collapseToEnd();
       return true;`
    );
    await sleep(200);
    window.webContents.insertText(PROBE);
    await sleep(600);
    check(await run(window, `return document.querySelectorAll('.suggestions button').length >= 2;`),
      'Die Vorschlagsliste zeigt weniger als zwei Eintraege');
    const ersterEintrag = await run(window, `return document.querySelector('.suggestions button.is-active')?.textContent ?? null;`);
    await taste(window, 'ArrowDown');
    await sleep(300);
    const zweiterEintrag = await run(window, `return document.querySelector('.suggestions button.is-active')?.textContent ?? null;`);
    check(zweiterEintrag !== null && zweiterEintrag !== ersterEintrag,
      `Pfeil runter bleibt beim ersten Eintrag (${ersterEintrag})`);
    await taste(window, 'Escape');
    await sleep(300);
    check(await run(window, `return document.querySelector('.suggestions') === null;`), 'Escape schliesst die Liste nicht');

    for (let i = 0; i < PROBE.length; i += 1) {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
    }
    await sleep(600);
    check(await run(window, `return !document.querySelector('.ProseMirror').textContent.includes('Und [[');`),
      'Der Probetext der Pfeiltasten-Pruefung blieb stehen');

    // 5d. Markierter Text und "[[" ergeben einen Verweis, statt ersetzt zu
    // werden. Geprueft wird an einem eigenen Satz, nicht am bestehenden
    // Verweis: dort waere das Ergebnis Unsinn.
    await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       feld.focus();
       const auswahl = window.getSelection();
       auswahl.selectAllChildren(feld);
       auswahl.collapseToEnd();
       return true;`
    );
    await sleep(200);
    window.webContents.insertText(' Der Hafen.');
    await sleep(400);
    const markiert = await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       const knoten = (function suche(k) {
         if (k.nodeType === 3 && k.textContent.includes('Hafen')) return k;
         for (const kind of k.childNodes) { const treffer = suche(kind); if (treffer) return treffer; }
         return null;
       })(feld);
       const versatz = knoten.textContent.lastIndexOf('Hafen');
       const bereich = document.createRange();
       bereich.setStart(knoten, versatz);
       bereich.setEnd(knoten, versatz + 5);
       const auswahl = window.getSelection();
       auswahl.removeAllRanges();
       auswahl.addRange(bereich);
       feld.focus();
       return auswahl.toString();`
    );
    check(markiert === 'Hafen', `Die Probe hat nicht "Hafen" markiert, sondern "${markiert}"`);
    await sleep(200);
    window.webContents.insertText('[[');
    await sleep(600);
    check(await run(window, `return document.querySelector('.ProseMirror').textContent.includes('[[Hafen]]');`),
      'Markierter Text wurde beim Tippen von "[[" nicht umschlossen');

    // 5e. Der Export-Knopf des Editors traegt beide Ebenen: die offene Notiz
    // und die ganze Kampagne.
    await run(
      window,
      `const knopf = [...document.querySelectorAll('.note-editor .menu > button')][0];
       if (!knopf) throw new Error('Export-Knopf fehlt');
       if (knopf.getAttribute('aria-expanded') !== 'true') knopf.click();
       return true;`
    );
    await sleep(300);
    const exportEintraege = await run(
      window,
      `return [...document.querySelectorAll('.note-editor .menu__list button')].map((b) => b.textContent);`
    );
    check(
      ['Notiz als Markdown', 'Notiz als PDF', 'Kampagne als Markdown', 'Kampagne als PDF', 'Als ZIP sichern'].every(
        (eintrag) => exportEintraege.includes(eintrag)
      ),
      `Im Export-Knopf fehlen Eintraege: ${JSON.stringify(exportEintraege)}`
    );
    await run(window, `document.querySelector('.note-editor .menu > button').click(); return true;`);
    await sleep(300);

    // 5f. Unterstrichen: Knopf und Strg+U. In der Datei steht <u>, weil
    // Markdown dafuer keine Schreibweise kennt.
    await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       feld.focus();
       const auswahl = window.getSelection();
       auswahl.selectAllChildren(feld);
       auswahl.collapseToEnd();
       return true;`
    );
    await sleep(200);
    window.webContents.insertText(' Unterstrichen');
    await sleep(400);
    await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       const knoten = (function suche(k) {
         if (k.nodeType === 3 && k.textContent.includes('Unterstrichen')) return k;
         for (const kind of k.childNodes) { const treffer = suche(kind); if (treffer) return treffer; }
         return null;
       })(feld);
       const versatz = knoten.textContent.lastIndexOf('Unterstrichen');
       const bereich = document.createRange();
       bereich.setStart(knoten, versatz);
       bereich.setEnd(knoten, versatz + 13);
       const auswahl = window.getSelection();
       auswahl.removeAllRanges();
       auswahl.addRange(bereich);
       feld.focus();
       return true;`
    );
    await sleep(200);
    await pressToolbar(window, 'U');
    await sleep(500);
    check(await run(window, `return document.querySelectorAll('.ProseMirror u').length === 1;`),
      'Der Knopf hat nichts unterstrichen');
    await save(window);
    {
      const campaignsDir = path.join(userData, 'vault', 'campaigns');
      const campaignId = fs.readdirSync(campaignsDir)[0];
      const notesDir = path.join(campaignsDir, campaignId, 'notes');
      const dateien = fs.readdirSync(notesDir).map((datei) => fs.readFileSync(path.join(notesDir, datei), 'utf8'));
      check(dateien.some((roh) => roh.includes('<u>Unterstrichen</u>')),
        'Unterstrichen steht nicht als <u> in der Datei');
    }

    // 5g. Zoom: Strg und Mausrad, Anzeige oben rechts, Klick setzt zurueck.
    const zoomAnzeige = `document.querySelector('.toolbar__zoom')?.textContent ?? null`;
    check(await run(window, `return ${zoomAnzeige} === '100%';`), 'Die Zoom-Anzeige steht nicht auf 100%');
    await run(
      window,
      `const flaeche = document.querySelector('.body-editor__surface');
       flaeche.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true }));
       return true;`
    );
    await sleep(600);
    check(await run(window, `return ${zoomAnzeige} === '110%';`),
      `Strg und Mausrad vergroessern nicht (${await run(window, `return ${zoomAnzeige};`)})`);
    check(
      await run(window, `return document.querySelector('.body-editor__surface').style.zoom === '1.1';`),
      'Die Vergroesserung kommt an der Editorflaeche nicht an'
    );
    await run(window, `document.querySelector('.toolbar__zoom').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true;`);
    await sleep(600);
    check(await run(window, `return ${zoomAnzeige} === '100%';`), 'Klick auf die Anzeige setzt nicht zurueck');

    // 5h. Ueberschriften einklappen. Der Zustand ist Ansicht: in der Datei
    // darf davon nichts stehen.
    await run(
      window,
      `const feld = document.querySelector('.ProseMirror');
       feld.focus();
       const auswahl = window.getSelection();
       auswahl.selectAllChildren(feld);
       auswahl.collapseToEnd();
       return true;`
    );
    await sleep(200);
    // Ueber die Werkzeugleiste und die Eingabetaste: insertText schreibt nur
    // Text, es macht daraus keine Absaetze und keine Ueberschriften.
    const enter = () => {
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    };
    enter();
    await sleep(200);
    window.webContents.insertText('Erster Teil');
    await sleep(300);
    await pressToolbar(window, 'H1');
    await sleep(400);
    enter();
    await sleep(200);
    window.webContents.insertText('Ein Satz darunter.');
    await sleep(600);

    const klapppfeile = await run(window, `return document.querySelectorAll('.einklapp-pfeil').length;`);
    check(klapppfeile >= 1, `Kein Pfeil neben der Ueberschrift (${klapppfeile})`);

    /*
     * Der Cursor steht hier noch in „Ein Satz darunter." — also genau in dem
     * Abschnitt, der gleich verschwindet.
     *
     * Frueher stand an dieser Stelle ein Umweg: der Test nahm den Cursor
     * vorher heraus, weil die Ansicht einen Abschnitt wieder aufklappt,
     * sobald er darin landet. Aus Sicht der Bedienung hiess das, dass der
     * Pfeil von dort aus nichts tat. Jetzt wandert der Cursor beim Zuklappen
     * ans Ende der Ueberschrift, und der Umweg ist weg — was der Test
     * ausdruecklich in dieser Lage prueft.
     */
    const vorherSichtbar = await run(
      window,
      `return [...document.querySelectorAll('.ProseMirror > *')].filter((e) => !e.classList.contains('ist-eingeklappt')).length;`
    );
    await run(window, `document.querySelectorAll('.einklapp-pfeil')[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true;`);
    await sleep(600);
    const nachherSichtbar = await run(
      window,
      `return [...document.querySelectorAll('.ProseMirror > *')].filter((e) => !e.classList.contains('ist-eingeklappt')).length;`
    );
    check(nachherSichtbar < vorherSichtbar, `Der Klick hat nichts eingeklappt (${vorherSichtbar} -> ${nachherSichtbar})`);
    check(
      await run(window, `return document.querySelector('.ProseMirror').textContent.includes('Erster Teil');`),
      'Die Ueberschrift selbst ist mitverschwunden'
    );
    check(
      !(await run(window, `return [...document.querySelectorAll('.ProseMirror > *')].some((e) => !e.classList.contains('ist-eingeklappt') && e.textContent === 'Ein Satz darunter.');`)),
      'Der Text unter der Ueberschrift ist noch sichtbar'
    );

    // Und der Cursor steht jetzt in der Ueberschrift, nicht mehr im
    // versteckten Text: sonst schriebe der naechste Tastendruck dorthin.
    check(
      await run(
        window,
        `const knoten = window.getSelection().anchorNode;
         const element = knoten && knoten.nodeType === 3 ? knoten.parentElement : knoten;
         return Boolean(element && element.closest('h1, h2, h3, h4'));`
      ),
      'Der Cursor ist nicht in die geschlossene Ueberschrift gesprungen'
    );

    // Alles aufklappen bringt sie zurueck.
    await pressToolbar(window, '⇕');
    await sleep(600);
    check(
      (await run(window, `return [...document.querySelectorAll('.ProseMirror > *')].filter((e) => !e.classList.contains('ist-eingeklappt')).length;`)) === vorherSichtbar,
      'Alles aufklappen bringt die Abschnitte nicht zurueck'
    );

    await save(window);
    {
      const campaignsDir = path.join(userData, 'vault', 'campaigns');
      const campaignId = fs.readdirSync(campaignsDir)[0];
      const notesDir = path.join(campaignsDir, campaignId, 'notes');
      const roh = fs
        .readdirSync(notesDir)
        .filter((datei) => datei.endsWith('.md'))
        .map((datei) => fs.readFileSync(path.join(notesDir, datei), 'utf8'))
        .join('\n');
      check(!roh.includes('eingeklappt') && !roh.includes('collapsed'),
        'Der eingeklappte Zustand ist in der Notizdatei gelandet');
      // Die Auszeichnung von vorhin laeuft im Text weiter, das ist normal.
      // Geprueft wird die Ueberschrift, nicht ihre Auszeichnung.
      check(
        /^#+ .*Erster Teil/m.test(roh),
        `Die Ueberschrift fehlt in der Datei: ${JSON.stringify(roh.slice(-260))}`
      );
    }

    // 6. Kurzinfo-Karte muss den Textanfang zeigen
    await run(
      window,
      `const link = document.querySelector('.ProseMirror .wikilink');
       link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
       return true;`
    );
    await sleep(500);
    check(await run(window, `return Boolean(document.querySelector('.info-card'));`), 'Kurzinfo-Karte erscheint nicht');
    check(await run(window, `return document.querySelector('.info-card')?.textContent.includes('Waldelfe') === true;`),
      'Steckbrieffeld fehlt in der Kurzinfo');
    check(await run(window, `return document.querySelector('.info-card__preview')?.textContent.includes('Sie wuchs im Hafen') === true;`),
      'Textanfang fehlt in der Kurzinfo');
    await run(window, `document.querySelector('.ProseMirror').dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })); return true;`);
    await sleep(300);

    // 7. Speichern per Strg+S
    await save(window);

    // 8. Suche: Treffer markiert in Liste und im Editor
    await run(
      window,
      `setValue(document.querySelector('.note-list__search input'), 'gold');
       return true;`
    );
    await sleep(700);
    check(await run(window, `return document.querySelectorAll('.note-list__snippet mark').length >= 1;`),
      'Suchtreffer in der Liste nicht hervorgehoben');
    check(await run(window, `return document.querySelectorAll('.ProseMirror .search-hit').length >= 1;`),
      'Suchtreffer im Editor nicht hervorgehoben');
    check(await run(window, `return Boolean(document.querySelector('.search-bar'));`),
      'Navigationsleiste für Fundstellen fehlt');

    await clickButton(window, '›', "document.querySelector('.search-bar')");
    await sleep(400);
    check(await run(window, `return document.querySelectorAll('.ProseMirror .search-hit--active').length === 1;`),
      'Aktive Fundstelle wird nicht hervorgehoben');
    check(await run(window, `return /1 von 1/.test(document.querySelector('.search-bar__count').textContent);`),
      'Trefferzähler stimmt nicht');

    await run(window, `setValue(document.querySelector('.note-list__search input'), ''); return true;`);
    await sleep(500);
    check(await run(window, `return document.querySelectorAll('.ProseMirror .search-hit').length === 0;`),
      'Hervorhebung bleibt nach Leeren der Suche stehen');

    // 9. Backlink muss jetzt bei Mira auftauchen
    await selectNote(window, 'Mira Falkenhand');
    check(await run(window, `return document.querySelector('.backlinks')?.textContent.includes('Toran') === true;`),
      'Backlink von Toran fehlt bei Mira');

    // 10. Datei auf der Platte pruefen
    const campaignsDir = path.join(userData, 'vault', 'campaigns');
    const campaignId = fs.readdirSync(campaignsDir)[0];
    const notesDir = path.join(campaignsDir, campaignId, 'notes');
    const files = fs.readdirSync(notesDir).map((name) => fs.readFileSync(path.join(notesDir, name), 'utf8'));

    check(files.some((raw) => raw.includes('[[Mira Falkenhand]]')), 'Wiki-Link steht nicht als Klartext in der Datei');
    check(files.some((raw) => raw.includes('species: Waldelfe')), 'Steckbrieffeld wurde nicht gespeichert');
    check(files.every((raw) => raw.startsWith('---\n')), 'Datei ohne YAML-Frontmatter');
    check(files.every((raw) => !raw.includes('\\[')), 'Klammern wurden beim Speichern maskiert');
    check(files.some((raw) => raw.includes('schemaVersion: 1')), 'schemaVersion fehlt');

    // 11. Notiztyp anpassen: Feld umbenennen und neues Feld anlegen
    // Erreichbar ueber den Knopf am Steckbrief, nicht nur ueber das Menue.
    check(
      await run(window, `const box = [...document.querySelectorAll('.panel__title')]
           .find((h) => h.textContent.includes('Steckbrief'));
         return Boolean(box && box.querySelector('button'));`),
      'Am Steckbrief fehlt der Knopf zum Bearbeiten'
    );
    await menuAction(window, 'Notiztypen');
    await sleep(500);
    check(await run(window, `return Boolean(document.querySelector('.type-editor'));`), 'Notiztyp-Editor öffnet nicht');

    await run(
      window,
      `const entry = [...document.querySelectorAll('.type-editor__list button')]
         .find((b) => b.textContent.includes('Charakter'));
       entry.click();
       return true;`
    );
    await sleep(300);

    // Beschriftung aendern, der Schluessel muss stabil bleiben
    await run(
      window,
      `const row = [...document.querySelectorAll('.type-editor__fields li')]
         .find((li) => li.querySelector('.type-editor__field-label').value === 'Spezies');
       if (!row) throw new Error('Feld Spezies nicht gefunden');
       setValue(row.querySelector('.type-editor__field-label'), 'Volk');
       return true;`
    );
    await sleep(250);

    await clickButton(window, '+ Feld', "document.querySelector('.type-editor')");
    await sleep(300);
    await run(
      window,
      `const rows = [...document.querySelectorAll('.type-editor__fields li')];
       setValue(rows[rows.length - 1].querySelector('.type-editor__field-label'), 'Heimat');
       return true;`
    );
    await sleep(250);

    // Eine Auswahlliste anlegen und mit Werten füllen
    await clickButton(window, '+ Feld', "document.querySelector('.type-editor')");
    await sleep(300);
    await run(
      window,
      `const rows = [...document.querySelectorAll('.type-editor__fields li')];
       const row = rows[rows.length - 1];
       setValue(row.querySelector('.type-editor__field-label'), 'Gesinnung');
       const select = row.querySelector('select');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'select');
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(400);
    await run(
      window,
      `const rows = [...document.querySelectorAll('.type-editor__fields li')];
       const area = rows[rows.length - 1].querySelector('textarea');
       if (!area) throw new Error('Eingabe für Auswahlwerte fehlt');
       setValue(area, 'Rechtschaffen' + String.fromCharCode(10) + 'Neutral' + String.fromCharCode(10) + 'Chaotisch');
       return true;`
    );
    await sleep(300);

    await clickButton(window, 'Übernehmen', "document.querySelector('.modal')");
    await sleep(900);

    check(await run(window, `return document.querySelector('.type-editor') === null;`), 'Dialog bleibt offen');
    check(
      await run(
        window,
        `const labels = [...document.querySelectorAll('.note-editor__side .field__label')].map((s) => s.textContent);
         return labels.includes('Volk') && labels.includes('Heimat') && !labels.includes('Spezies');`
      ),
      'Steckbrief übernimmt die Änderungen nicht'
    );
    check(
      await run(
        window,
        `const field = [...document.querySelectorAll('.note-editor__side .field')]
           .find((f) => f.textContent.startsWith('Gesinnung'));
         const select = field?.querySelector('select');
         return Boolean(select) && [...select.options].map((o) => o.value).includes('Chaotisch');`
      ),
      'Auswahlliste erscheint nicht im Steckbrief'
    );
    check(
      await run(
        window,
        `const field = [...document.querySelectorAll('.note-editor__side .field')]
           .find((f) => f.textContent.startsWith('Volk'));
         return field.querySelector('input').value === 'Waldelfe';`
      ),
      'Wert ging beim Umbenennen der Beschriftung verloren'
    );

    // Neuen Typ anlegen und benutzen
    await menuAction(window, 'Notiztypen');
    await sleep(500);
    await clickButton(window, '+ Typ', "document.querySelector('.type-editor')");
    await sleep(300);
    await run(
      window,
      `const detail = document.querySelector('.type-editor__detail');
       const inputs = detail.querySelectorAll('.field input');
       setValue(inputs[0], 'Gegenstand');
       setValue(inputs[1], 'Gegenstände');
       return true;`
    );
    await sleep(250);
    await clickButton(window, 'Übernehmen', "document.querySelector('.modal')");
    await sleep(900);

    check(
      await run(window, `return [...document.querySelectorAll('.note-list__new button')].some((b) => b.textContent.includes('Gegenstand'));`),
      'Neuer Notiztyp fehlt in der Seitenleiste'
    );

    await clickButton(window, '+ Gegenstand');
    await sleep(300);
    await fillDialog(window, 'Miras Bogen', 'Anlegen');
    check(
      await run(window, `return document.querySelector('.note-editor .badge')?.textContent === 'Gegenstand';`),
      'Notiz bekam nicht den neuen Typ'
    );

    // 12. Bild ins Portrait-Feld ziehen und im Fliesstext einfuegen
    await selectNote(window, 'Mira Falkenhand');

    // Ein winziges PNG, das im Renderer als Datei uebergeben wird
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    await run(
      window,
      `const bytes = Uint8Array.from(atob(${JSON.stringify(pngBase64)}), (c) => c.charCodeAt(0));
       const file = new File([bytes], 'portrait.png', { type: 'image/png' });
       const transfer = new DataTransfer();
       transfer.items.add(file);
       const target = document.querySelector('.image-field');
       if (!target) throw new Error('Portrait-Feld fehlt');
       target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
       return true;`
    );
    await sleep(1200);

    check(await run(window, `return Boolean(document.querySelector('.image-field__preview'));`),
      'Portrait wurde nicht übernommen');
    check(
      await run(window, `return document.querySelector('.image-field__preview').src.startsWith('backstory-asset://');`),
      'Portrait benutzt nicht das Bildprotokoll'
    );
    // Wird das Bild tatsaechlich geladen, oder ist es nur ein toter Verweis?
    check(
      await run(window, `const img = document.querySelector('.image-field__preview');
         return img.complete && img.naturalWidth > 0;`),
      'Portrait-Bild wird nicht geladen'
    );

    // Bild in den Fliesstext ziehen
    await run(
      window,
      `const bytes = Uint8Array.from(atob(${JSON.stringify(pngBase64)}), (c) => c.charCodeAt(0));
       const file = new File([bytes], 'szene.png', { type: 'image/png' });
       const transfer = new DataTransfer();
       transfer.items.add(file);
       const surface = document.querySelector('.ProseMirror');
       surface.focus();
       surface.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
       return true;`
    );
    await sleep(1500);
    check(await run(window, `return document.querySelectorAll('.ProseMirror img').length === 1;`),
      'Bild wurde nicht in den Text eingefügt');

    // Bildbreite setzen: die Knöpfe erscheinen nur bei ausgewähltem Bild
    await run(
      window,
      `const image = document.querySelector('.ProseMirror img');
       image.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
       image.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
       image.click();
       return true;`
    );
    await sleep(600);
    const hasWidthButtons = await run(
      window,
      `return [...document.querySelectorAll('.toolbar button')].some((b) => b.textContent === '200');`
    );
    if (hasWidthButtons) {
      await pressToolbar(window, '200');
      await sleep(600);
      const attrs = await run(
        window,
        `const img = document.querySelector('.ProseMirror img');
         return JSON.stringify({
           width: img.getAttribute('width'),
           selected: img.classList.contains('ProseMirror-selectednode'),
           buttons: [...document.querySelectorAll('.toolbar button')].map((b) => b.textContent)
         });`
      );
      check(JSON.parse(attrs).width === '200', `Bildbreite wurde nicht gesetzt: ${attrs}`);

      // Eigene Breite als Anteil: sie steht als Stilangabe am Bild, weil das
      // Attribut width in HTML5 nur ganze Zahlen nimmt.
      await run(
        window,
        `const feld = document.querySelector('.toolbar__width');
         if (!feld) throw new Error('Feld fuer die eigene Breite fehlt');
         const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setzer.call(feld, '50%');
         feld.dispatchEvent(new Event('input', { bubbles: true }));
         feld.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
         return true;`
      );
      await sleep(600);
      check(
        await run(window, `return document.querySelector('.ProseMirror img').style.width === '50%';`),
        'Eigene Breite als Anteil wurde nicht uebernommen'
      );

      // Unsinn laesst die Breite stehen, statt sie kaputtzuschreiben.
      await run(
        window,
        `const feld = document.querySelector('.toolbar__width');
         const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
         setzer.call(feld, 'breit');
         feld.dispatchEvent(new Event('input', { bubbles: true }));
         feld.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
         return true;`
      );
      await sleep(600);
      check(
        await run(window, `return document.querySelector('.ProseMirror img').style.width === '50%';`),
        'Eine unsinnige Eingabe hat die Bildbreite veraendert'
      );

      // Zurueck auf Bildpunkte, damit die folgenden Pruefungen den Stand von
      // vorher vorfinden.
      await pressToolbar(window, '200');
      await sleep(600);
    }

    await save(window);

    // Im Markdown muss ein relativer Verweis stehen, kein Protokoll und kein Base64
    {
      const campaignsDir = path.join(userData, 'vault', 'campaigns');
      const campaignId = fs.readdirSync(campaignsDir)[0];
      const notesDir = path.join(campaignsDir, campaignId, 'notes');
      const files = fs.readdirSync(notesDir).map((name) => fs.readFileSync(path.join(notesDir, name), 'utf8'));

      // Ohne Breite steht das Bild als Markdown, mit Breite als inline-HTML.
      // Beides muss den relativen Pfad behalten.
      check(
        files.some((raw) => /!\[[^\]]*\]\(assets\/[^)]+\.png\)/.test(raw) || /<img[^>]*src="assets\/[^"]+\.png"/.test(raw)),
        'Bild steht nicht als relativer Verweis im Markdown'
      );
      check(files.every((raw) => !/<img[^>]*src="backstory-asset/.test(raw)),
        'Protokoll-URL steht im gespeicherten HTML');
      check(files.every((raw) => !raw.includes('backstory-asset://')),
        'Protokoll-URL wurde ins Markdown geschrieben');
      check(files.every((raw) => !raw.includes('data:image')), 'Bild wurde als Base64 eingebettet');
      check(files.some((raw) => /portrait: assets\//.test(raw)), 'Portrait-Verweis fehlt im Steckbrief');

      const assets = fs.readdirSync(path.join(campaignsDir, campaignId, 'assets'));
      check(assets.length === 2, `erwartet zwei Bilddateien, gefunden ${assets.length}`);
    }

    // 13. Sprache auf Englisch und wieder zurueck
    await clickButton(window, 'Einstellungen');
    await sleep(500);
    await run(
      window,
      `const select = document.querySelector('.modal select');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'en');
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(900);

    check(await run(window, `return document.querySelector('.modal__header h2').textContent === 'Settings';`),
      'Dialog bleibt nach dem Sprachwechsel deutsch');
    check(
      await run(window, `return [...document.querySelectorAll('.campaign-bar button')]
         .some((b) => b.textContent === 'Settings');`),
      'Kopfzeile bleibt nach dem Sprachwechsel deutsch'
    );

    // Selbst vergebene Bezeichnungen bleiben unveraendert, die kann das
    // Programm nicht uebersetzen
    check(await run(window, `return [...document.querySelectorAll('.note-list__new button')].some((b) => b.textContent.includes('Gegenstand'));`),
      'Eigener Notiztyp wurde faelschlich veraendert');

    await run(
      window,
      `const select = document.querySelector('.modal select');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'de');
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(900);
    check(await run(window, `return document.querySelector('.modal__header h2').textContent === 'Einstellungen';`),
      'Rückwechsel auf Deutsch hat nicht gewirkt');

    await clickButton(window, '×', "document.querySelector('.modal__header')");
    await sleep(400);

    // 14. Umbenennen muss die Links mitziehen
    await selectNote(window, 'Mira Falkenhand');
    await run(
      window,
      `const title = document.querySelector('.note-editor__title');
       setValue(title, 'Mira Sturmhand');
       title.dispatchEvent(new Event('blur', { bubbles: true }));
       return true;`
    );
    await sleep(1600);
    const afterRename = fs.readdirSync(notesDir).map((name) => fs.readFileSync(path.join(notesDir, name), 'utf8'));
    check(afterRename.some((raw) => raw.includes('[[Mira Sturmhand]]')), 'Umbenennen hat den Link nicht mitgezogen');
    check(afterRename.every((raw) => !raw.includes('[[Mira Falkenhand]]')), 'Alter Linkname blieb stehen');

    // 14b. Ein Titel mit Link-Sonderzeichen wird abgewiesen, nicht gespeichert
    await run(
      window,
      `const title = document.querySelector('.note-editor__title');
       setValue(title, 'Mira|Sturm');
       return true;`
    );
    await sleep(500);
    check(
      await run(window, `return document.body.textContent.includes('gehören zum Link-Format');`),
      'Hinweis auf unerlaubte Zeichen im Titel fehlt'
    );
    // Der Autosave muss pausieren, sonst stuende der Titel gleich in der Datei
    await sleep(1200);
    check(
      fs.readdirSync(notesDir).every((name) => !fs.readFileSync(path.join(notesDir, name), 'utf8').includes('Mira|Sturm')),
      'Titel mit Sonderzeichen wurde gespeichert'
    );

    await run(
      window,
      `const title = document.querySelector('.note-editor__title');
       setValue(title, 'Mira Sturmhand');
       return true;`
    );
    await sleep(1600);
    // 14c. Ein Kampagnen-Export sichert vorher, sonst fehlt der letzte Absatz
    {
      // Autosave aus, damit die Luecke nicht zufaellig zugedeckt wird.
      await clickButton(window, 'Einstellungen');
      await sleep(400);
      await run(
        window,
        `const box = [...document.querySelectorAll('.modal input[type=checkbox]')][0];
         if (box.checked) box.click();
         return true;`
      );
      await sleep(500);
      await clickButton(window, '\u00d7', "document.querySelector('.modal__header')");
      await sleep(400);

      await selectNote(window, 'Mira Sturmhand');
      await run(
        window,
        `const view = document.querySelector('.ProseMirror');
         view.focus();
         // Ans Ende, sonst ersetzt der Text eine noch markierte Bildkachel.
         const range = document.createRange();
         range.selectNodeContents(view);
         range.collapse(false);
         const selection = window.getSelection();
         selection.removeAllRanges();
         selection.addRange(range);
         document.execCommand('insertText', false, ' Ungesicherter Nachsatz.');
         return true;`
      );
      await sleep(600);
      check(
        await run(window, `return document.querySelector('.status--dirty') !== null;`),
        'Der Text gilt nicht als ungesichert, der Test pruefte nichts'
      );

      const unsavedDir = path.join(userData, 'export-ungesichert');
      stubDialogs(unsavedDir);
      nachgefragt.length = 0;
      speicherAntwort = 0; // Speichern und fortfahren
      await kampagnenExport(window, 'Kampagne als Markdown');
      await sleep(3000);

      // Frueher schrieb der Export ungefragt. Ohne Autosave darf er das nicht
      // mehr — er fragt, und erst die Antwort „Speichern und fortfahren"
      // bringt die Aenderung in die Ausgabe.
      check(nachgefragt.length === 1, 'Der Export hat nicht nach Ungespeichertem gefragt');

      const dir = fs.readdirSync(unsavedDir).map((n) => path.join(unsavedDir, n)).find((e) => fs.statSync(e).isDirectory());
      check(Boolean(dir), 'Export ohne Autosave hat keinen Ordner angelegt');
      if (dir) {
        const texte = fs.readdirSync(dir)
          .filter((n) => n.endsWith('.md'))
          .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'));
        check(
          texte.some((raw) => raw.includes('Ungesicherter Nachsatz.')),
          'Der Export enthaelt die ungesicherten Aenderungen nicht'
        );
      }

      // Autosave wieder an, die folgenden Abschnitte verlassen sich darauf.
      await clickButton(window, 'Einstellungen');
      await sleep(400);
      await run(
        window,
        `const box = [...document.querySelectorAll('.modal input[type=checkbox]')][0];
         if (!box.checked) box.click();
         return true;`
      );
      await sleep(500);
      await clickButton(window, '\u00d7', "document.querySelector('.modal__header')");
      await sleep(400);
    }

    // Beide Formate der Notiz liegen unter einem Knopf.
    await run(
      window,
      `const box = [...document.querySelectorAll('.menu')]
         .find((m) => m.querySelector('button').textContent.includes('Export'));
       if (!box) throw new Error('Export-Menü fehlt');
       box.querySelector('button').click();
       return true;`
    );
    await sleep(400);
    check(
      await run(window, `const box = [...document.querySelectorAll('.menu')]
         .find((m) => m.querySelector('button').textContent.includes('Export'));
         const eintraege = [...box.querySelectorAll('.menu__list button')].map((b) => b.textContent);
         box.querySelector('button').click();
         return eintraege.includes('Notiz als Markdown') && eintraege.includes('Notiz als PDF');`),
      'Die Notiz-Exporte liegen nicht unter einem gemeinsamen Knopf'
    );
    await sleep(300);

    // 15. Export als Markdown und PDF
    {
      const exportDir = path.join(userData, 'export');
      stubDialogs(exportDir);

      // Die Notiz wurde in Abschnitt 14 umbenannt
      await selectNote(window, 'Mira Sturmhand');
      await kampagnenExport(window, 'Kampagne als Markdown');
      await sleep(2500);

      const campaignDir = fs.readdirSync(exportDir).map((name) => path.join(exportDir, name)).find((entry) => fs.statSync(entry).isDirectory());
      check(Boolean(campaignDir), 'Markdown-Export hat keinen Ordner angelegt');

      if (campaignDir) {
        const files = fs.readdirSync(campaignDir);
        check(files.some((name) => name.startsWith('Mira Sturmhand')), `Notizdatei fehlt: ${files.join(', ')}`);
        check(files.includes('assets'), 'Bilder wurden nicht mitkopiert');

        const miraFile = files.find((name) => name.startsWith('Mira Sturmhand'));
        const content = fs.readFileSync(path.join(campaignDir, miraFile), 'utf8');
        check(content.startsWith('# Mira'), 'Export beginnt nicht mit der Überschrift');
        check(!content.includes('schemaVersion'), 'YAML-Kopf steht im Export');
        check(/\*\*Volk:\*\*\s*Waldelfe/.test(content), 'Steckbrieffeld fehlt im Export');
        check(content.includes('## Beziehungen'), 'Beziehungen fehlen im Export');

        const assets = fs.readdirSync(path.join(campaignDir, 'assets'));
        check(assets.length >= 1, 'keine Bilder im Export');
      }

      await kampagnenExport(window, 'Kampagne als PDF', { mitGraph: true });
      await sleep(4000);

      const pdf = fs.readdirSync(exportDir).find((name) => name.endsWith('.pdf'));
      check(Boolean(pdf), `PDF wurde nicht geschrieben: ${fs.readdirSync(exportDir).join(', ')}`);
      if (pdf) {
        const bytes = fs.readFileSync(path.join(exportDir, pdf));
        check(bytes.subarray(0, 4).toString() === '%PDF', 'Datei ist kein PDF');
        check(bytes.length > 1000, `PDF ist verdächtig klein: ${bytes.length} Bytes`);

        /*
         * Sprungziele im PDF.
         *
         * Dass die Verweise im HTML zu `<a href="#...">` werden, pruefen die
         * Modultests. Ob daraus im PDF wirklich anklickbare Ziele werden,
         * entscheidet erst der Druck: Chromium legt dafuer Link-Annotationen
         * an (`/Annots` mit `/Subtype /Link`). Ohne diese Pruefung waere die
         * Frage „springt das im Reader?" nur zu beantworten, indem jemand
         * das PDF oeffnet und klickt.
         */
        const roh = bytes.toString('latin1');
        check(roh.includes('/Link'), 'Im PDF gibt es keine anklickbaren Verweise');
        check(roh.includes('/Dest') || roh.includes('/A <<'), 'Die Verweise im PDF haben kein Ziel');
      }

      // Das Beziehungsnetz ist eine Seite mehr. Gezaehlt wird gegen einen
      // zweiten Lauf ohne die Option — eine feste Seitenzahl bewiese nichts,
      // weil eine Notiz auch von sich aus umbrechen kann.
      {
        const ohneDir = path.join(userData, 'export-ohne-netz');
        stubDialogs(ohneDir);
        await kampagnenExport(window, 'Kampagne als PDF');
        await sleep(4000);

        const seiten = (ordner) => {
          const datei = fs.readdirSync(ordner).find((name) => name.endsWith('.pdf'));
          const roh = fs.readFileSync(path.join(ordner, datei)).toString('latin1');
          return Number(/\/Count (\d+)/.exec(roh)?.[1] ?? 0);
        };
        const mitNetz = seiten(exportDir);
        const ohneNetz = seiten(ohneDir);
        check(
          mitNetz === ohneNetz + 1,
          `Mit Netz ${mitNetz} Seiten, ohne ${ohneNetz} — erwartet war genau eine mehr`
        );
      }

      // Der Dialog nimmt eine Auswahl entgegen: nur eine Notiz exportieren.
      const einzelDir = path.join(userData, 'export-auswahl');
      stubDialogs(einzelDir);
      await menuAction(window, 'Kampagne als Markdown');
      await sleep(600);
      const gewaehlt = await run(
        window,
        `const eintraege = [...document.querySelectorAll('.export-liste input')];
         if (eintraege.length < 2) throw new Error('Die Auswahlliste ist zu kurz');
         // Alle abwaehlen, dann genau die erste wieder an.
         [...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Keine').click();
         return eintraege.length;`
      );
      await sleep(300);
      await run(window, `document.querySelectorAll('.export-liste input')[0].click(); return true;`);
      await sleep(300);
      check(
        await run(window, `return document.querySelector('.modal__hint').textContent.startsWith('1 von');`),
        'Der Dialog zaehlt die Auswahl nicht mit'
      );
      await run(
        window,
        `[...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Exportieren').click();
         return true;`
      );
      await sleep(2500);

      {
        const kampagne = fs
          .readdirSync(einzelDir)
          .map((name) => path.join(einzelDir, name))
          .find((eintrag) => fs.statSync(eintrag).isDirectory());
        const dateien = fs.readdirSync(kampagne).filter((name) => name.endsWith('.md'));
        check(
          dateien.length === 1,
          `Trotz Auswahl wurden ${dateien.length} von ${gewaehlt} Notizen exportiert`
        );
      }
    }

    // 16b. Der KI-Bereich liegt im selben Dialog, klar benannt — aber nur,
    //      wenn es eine KI gibt. Ist sie abgeschaltet (die Voreinstellung),
    //      soll nichts davon im Weg stehen: kein Assistent in der Sidebar,
    //      kein Reiter im Dialog, kein „und KI" im Titel.
    await selectNote(window, 'Toran');
    await sleep(400);
    check(
      !(await run(window, `return Boolean(document.querySelector('.assistant'));`)),
      'Bei abgeschalteter KI steht der Assistent trotzdem in der Sidebar'
    );

    await clickButton(window, 'Schreibhilfe');
    await sleep(700);
    check(
      !(await run(window, `return document.querySelector('.modal__header h2').textContent.includes('KI');`)),
      'Der Dialogtitel verspricht KI, obwohl keine eingerichtet ist'
    );
    check(
      !(await run(window, `return Boolean(document.querySelector('.prompts__tabs'));`)),
      'Bei abgeschalteter KI steht die Reiterleiste trotzdem da'
    );
    check(
      await run(window, `return Boolean(document.querySelector('.prompts__categories'));`),
      'Die Vorschläge fehlen — die kommen ohne KI aus und müssen bleiben'
    );
    await clickButton(window, '\u00d7', "document.querySelector('.modal__header')");
    await sleep(400);

    // Und mit KI: derselbe Dialog bekommt seine zwei Reiter zurueck.
    await run(window, `return window.api.settings.update({ aiProvider: 'ollama' });`);
    await sleep(900);
    check(
      await run(window, `return Boolean(document.querySelector('.assistant'));`),
      'Mit gewählter KI fehlt der Assistent in der Sidebar'
    );
    await clickButton(window, 'Schreibhilfe');
    await sleep(700);
    check(
      await run(window, `return document.querySelector('.modal__header h2').textContent.includes('KI');`),
      'Der Dialogtitel nennt den KI-Teil nicht'
    );
    check(
      await run(window, `const reiter = [...document.querySelectorAll('.prompts__tabs button')].map((b) => b.textContent);
         return reiter.some((r) => r.includes('ohne KI')) && reiter.some((r) => r.includes('KI-Assistent'));`),
      'Die Reiter unterscheiden Vorschläge und KI nicht'
    );
    await run(
      window,
      `[...document.querySelectorAll('.prompts__tabs button')].find((b) => b.textContent.includes('KI-Assistent')).click();
       return true;`
    );
    await sleep(500);
    check(
      await run(window, `return Boolean(document.querySelector('.assistant--chat'))
         || document.body.textContent.includes('Keine KI-Anbindung');`),
      'Der KI-Reiter zeigt weder Gespräch noch Hinweis'
    );
    await clickButton(window, '\u00d7', "document.querySelector('.modal__header')");
    await sleep(400);
    // Zurueck auf den Ausgangszustand, damit die naechsten Schritte dieselbe
    // Oberflaeche sehen wie vorher.
    await run(window, `return window.api.settings.update({ aiProvider: 'none' });`);
    await sleep(700);

    // 16. Schreibhilfe: Vorschlag in den Text uebernehmen
    await selectNote(window, 'Toran');
    await clickButton(window, 'Schreibhilfe');
    await sleep(1200);
    check(await run(window, `return Boolean(document.querySelector('.prompts__categories'));`),
      'Schreibhilfe öffnet nicht');
    check(await run(window, `return document.querySelectorAll('.prompts__option').length === 4;`),
      'Es werden nicht vier Vorschläge gewürfelt');

    const suggestion = await run(
      window,
      `const option = document.querySelector('.prompts__option');
       const text = option.querySelector('span').textContent;
       option.querySelector('button').click();
       return text;`
    );
    await sleep(900);
    check(await run(window, `return document.querySelector('.modal') === null;`), 'Schreibhilfe bleibt offen');
    check(
      await run(window, `return document.querySelector('.ProseMirror').textContent.includes(${JSON.stringify('')} + ${JSON.stringify(suggestion)});`),
      'Vorschlag steht nicht im Text'
    );

    await save(window);

    // Die Vorschlagsdatei muss im Speicherort liegen und bearbeitbar sein.
    //
    // Je Sprache eine Datei: sie ist Nutzerdatei, und wer eigene Vorschlaege
    // ergaenzt, tut das in der Sprache, in der er schreibt. Geprueft wird
    // deshalb das Muster und nicht ein fester Name — welche Sprache der Lauf
    // gerade hat, ist hier nicht der Punkt.
    const imVault = fs.readdirSync(path.join(userData, 'vault'));
    const vorschlagsdateien = imVault.filter((name) => /^writing-prompts\.(de|en)\.json$/.test(name));
    check(vorschlagsdateien.length > 0,
      `keine writing-prompts.<sprache>.json angelegt (gefunden: ${imVault.join(', ')})`);
    // Und der alte sprachlose Name darf nicht zurueckkommen: er fror beim
    // ersten Start eine Sprache ein, und genau das war der Fehler.
    check(!imVault.includes('writing-prompts.json'),
      'die alte sprachlose writing-prompts.json ist wieder da');

    // 16a. Bewegung: kommen die gemeinsamen Zeiten hier an?
    /*
     * Geprueft wird nicht, wie es aussieht — das kann kein Test —, sondern
     * dass die Stilvorlage des Bewegungspakets ueberhaupt geladen ist und
     * dass die Stellen, die sich bewegen sollen, eine Animation tragen.
     *
     * Ohne diese Pruefung faellt ein vergessener Import erst auf, wenn
     * jemand hinsieht: nichts bewegt sich, und nichts ist kaputt.
     */
    /*
     * In Millisekunden umgerechnet und nicht als Text verglichen: der
     * Minifizierer schreibt `160ms` als `.16s`, und ein Vergleich auf den
     * Wortlaut faellt darueber, obwohl alles stimmt. (Genau das ist hier
     * beim ersten Anlauf passiert.)
     */
    const motionMs = await run(
      window,
      `const roh = getComputedStyle(document.documentElement)
         .getPropertyValue('--motion-state').trim();
       if (!roh) return 0;
       const zahl = parseFloat(roh);
       return roh.endsWith('ms') ? zahl : zahl * 1000;`
    );
    check(motionMs === 160, `die gemeinsamen Bewegungszeiten sind nicht geladen (${motionMs})`);
    check(
      (await run(
        window,
        `const e = document.querySelector('.note-editor__columns');
         return e ? getComputedStyle(e).animationName : 'kein Editor';`
      )) === 'motion-erscheinen',
      'der Editorinhalt blendet beim Notizwechsel nicht ein'
    );

    // 16b. Die Vorschlagsliste wechselt die Sprache mit
    /*
     * Gemeldet: "Wenn ich die Sprache auf Englisch stelle ist die Prompt
     * (ohne KI) List immer noch auf Deutsch."
     *
     * Der Hauptprozess las immer richtig — die Liste lag nur im Zustand der
     * Oberflaeche und wurde nach dem ersten Holen nie wieder angefasst.
     */
    await clickButton(window, 'Schreibhilfe');
    await sleep(700);
    /*
     * Geprueft werden die Kategorienamen, nicht die Vorschlaege selbst.
     *
     * Die Vorschlaege werden bei jedem Oeffnen neu gezogen: sie sind auch
     * dann verschieden, wenn die Sprache dieselbe geblieben ist. Ein Test auf
     * "anders als vorher" ging deshalb durch, waehrend unter "Englisch"
     * weiter deutscher Text stand — genau der gemeldete Fehler, und der Test
     * sah ihn nicht.
     */
    const kategorien = () =>
      run(
        window,
        `return [...document.querySelectorAll('.prompts__categories button')].map((e) => e.textContent).join(' | ');`
      );
    const deutscheVorschlaege = await kategorien();
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(400);

    await clickButton(window, 'Einstellungen');
    await sleep(500);
    await run(
      window,
      `const select = document.querySelector('.modal select');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'en');
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(900);
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(400);

    // Auf Englisch heisst der Knopf "Prompts" — die Oberflaeche ist ja
    // umgestellt, und genau darum geht es hier.
    await clickButton(window, 'Prompts');
    await sleep(900);
    const englischeVorschlaege = await kategorien();
    check(
      deutscheVorschlaege.includes('Herkunftsort'),
      `Auf Deutsch stehen nicht die deutschen Kategorien da (${deutscheVorschlaege})`
    );
    check(
      englischeVorschlaege.includes('Place of origin'),
      `Vorschlagsliste bleibt nach dem Sprachwechsel deutsch (${englischeVorschlaege})`
    );
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(300);

    // Zurueck auf Deutsch, damit die folgenden Pruefungen ihre Texte finden.
    await clickButton(window, 'Settings');
    await sleep(500);
    await run(
      window,
      `const select = document.querySelector('.modal select');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'de');
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(900);
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(400);

    // 16c. Rechtsklick auf eine Notiz
    /*
     * Geprueft wird die Bedienung, nicht nur die Anwesenheit: dass das Menue
     * aufgeht, dass Escape es wieder schliesst, und dass Loeschen weiterhin
     * nachfragt statt sofort zu loeschen. Ein Menue, das ohne Frage loescht,
     * waere schlimmer als gar keins.
     */
    const rechtsklick = `const ziel = document.querySelector('.note-list__scroll button');
       const kasten = ziel.getBoundingClientRect();
       ziel.dispatchEvent(new MouseEvent('contextmenu', {
         bubbles: true, clientX: kasten.left + 10, clientY: kasten.top + 10 }));
       return true;`;
    await run(window, rechtsklick);
    await sleep(400);
    check(await run(window, `return Boolean(document.querySelector('.kontextmenue'));`),
      'Rechtsklick auf eine Notiz öffnet kein Menü');
    check(
      await run(window, `return document.querySelectorAll('.kontextmenue button').length === 2;`),
      'Das Menü hat nicht die zwei erwarteten Einträge'
    );

    await run(window, `document.querySelector('.kontextmenue').dispatchEvent(
       new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(300);
    check(await run(window, `return document.querySelector('.kontextmenue') === null;`),
      'Escape schließt das Kontextmenü nicht');

    // Loeschen muss weiter nachfragen.
    await run(window, rechtsklick);
    await sleep(400);
    await run(window, `[...document.querySelectorAll('.kontextmenue button')]
       .find((b) => /Löschen|Delete/.test(b.textContent)).click(); return true;`);
    await sleep(500);
    check(await run(window, `return Boolean(document.querySelector('.modal'));`),
      'Löschen aus dem Kontextmenü fragt nicht nach');
    // Abbrechen: die Notiz soll bleiben.
    const vorAbbruch = await run(window, `return document.querySelectorAll('.note-list__title').length;`);
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(500);
    check(
      (await run(window, `return document.querySelectorAll('.note-list__title').length;`)) === vorAbbruch,
      'Abbrechen im Löschdialog hat die Notiz trotzdem entfernt'
    );

    // Wirklich loeschen und gleich rueckgaengig machen: die Notiz kommt zurueck.
    await run(window, rechtsklick);
    await sleep(400);
    await run(window, `[...document.querySelectorAll('.kontextmenue button')]
       .find((b) => /Löschen|Delete/.test(b.textContent)).click(); return true;`);
    await sleep(500);
    await run(window, `document.querySelector('.modal button.danger').click(); return true;`);
    await sleep(900);
    check(
      (await run(window, `return document.querySelectorAll('.note-list__title').length;`)) === vorAbbruch - 1,
      'Löschen hat die Notiz nicht entfernt'
    );
    check(await run(window, `return Boolean(document.querySelector('[data-toast-aktion]'));`),
      'Nach dem Löschen fehlt „Rückgängig“');
    await run(window, `document.querySelector('[data-toast-aktion]').click(); return true;`);
    await sleep(900);
    check(
      (await run(window, `return document.querySelectorAll('.note-list__title').length;`)) === vorAbbruch,
      'Rückgängig hat die gelöschte Notiz nicht zurückgebracht'
    );

    // Umbenennen: der Dialog muss den bisherigen Titel mitbringen.
    await run(window, rechtsklick);
    await sleep(400);
    await run(window, `[...document.querySelectorAll('.kontextmenue button')]
       .find((b) => /Umbenennen|Rename/.test(b.textContent)).click(); return true;`);
    await sleep(500);
    check(
      await run(window, `const feld = document.querySelector('.modal input');
         return Boolean(feld && feld.value.length > 0);`),
      'Umbenennen bringt den bisherigen Titel nicht mit'
    );
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    await sleep(400);

    // 17. Graph-Ansicht
    await clickButton(window, 'Graph');
    await sleep(1500);
    check(await run(window, `return Boolean(document.querySelector('.graph__canvas'));`), 'Graph öffnet nicht');
    check(await run(window, `return document.querySelectorAll('.graph__node').length >= 3;`),
      'Zu wenige Knoten im Graph');
    check(await run(window, `return document.querySelectorAll('.graph__edge').length >= 2;`),
      'Zu wenige Kanten im Graph');
    check(
      await run(window, `return document.querySelectorAll('.graph__edge--relation').length >= 1
         && document.querySelectorAll('.graph__edge--mention').length >= 1;`),
      'Beziehungen und Erwähnungen werden nicht unterschieden'
    );
    // Knoten muessen auseinanderliegen, nicht alle auf einem Punkt
    check(
      await run(window, `const points = [...document.querySelectorAll('.graph__node')]
           .map((g) => g.getAttribute('transform'));
         return new Set(points).size === points.length;`),
      'Knoten liegen übereinander'
    );

    await clickButton(window, 'Beziehungen', "document.querySelector('.graph__modes')");
    await sleep(800);
    check(await run(window, `return document.querySelectorAll('.graph__edge--mention').length === 0;`),
      'Filter auf Beziehungen wirkt nicht');

    // Typfilter: Charaktere ausblenden muss Knoten entfernen
    const beforeFilter = await run(window, `return document.querySelectorAll('.graph__node').length;`);
    await run(
      window,
      `const bars = document.querySelectorAll('.graph__modes');
       const chip = [...bars[bars.length - 1].querySelectorAll('button')]
         .find((b) => b.textContent.includes('Charakter'));
       if (!chip) throw new Error('Typfilter für Charakter fehlt');
       chip.click();
       return true;`
    );
    await sleep(900);
    const afterFilter = await run(window, `return document.querySelectorAll('.graph__node').length;`);
    check(afterFilter < beforeFilter, `Typfilter wirkt nicht (${beforeFilter} -> ${afterFilter})`);

    await clickButton(window, 'Alle', "document.querySelectorAll('.graph__modes')[1]");
    await sleep(800);
    check(
      await run(window, `return document.querySelectorAll('.graph__node').length === ${beforeFilter};`),
      'Zurücksetzen des Typfilters wirkt nicht'
    );

    // Zoom verändert die viewBox und lässt sich zurücksetzen
    const zoomed = await run(
      window,
      `const svg = document.querySelector('.graph__canvas');
       const before = svg.getAttribute('viewBox');
       [...document.querySelectorAll('.graph__bar button')].find((b) => b.textContent.trim() === '+').click();
       return before;`
    );
    await sleep(500);
    check(await run(window, `return document.querySelector('.graph__canvas').getAttribute('viewBox') !== ${JSON.stringify(zoomed)};`),
      'Zoom verändert die Ansicht nicht');

    // Zuruecksetzen stellt die Ansicht um die Knoten, nicht mehr fest auf
    // 0 0 1200 780. Geprueft wird: dieselbe Ansicht wie vor dem Zoom.
    await clickButton(window, 'Zoom zurücksetzen', "document.querySelector('.graph__bar')");
    await sleep(500);
    check(await run(window, `return document.querySelector('.graph__canvas').getAttribute('viewBox') === ${JSON.stringify(zoomed)};`),
      'Zurücksetzen der Ansicht wirkt nicht');

    // 17a. Zwei Richtungen zwischen denselben Knoten liegen nebeneinander
    {
      const linien = await run(
        window,
        `const paare = new Map();
         for (const g of document.querySelectorAll('.graph__edge--relation')) {
           const line = g.querySelector('line');
           const punkte = [line.getAttribute('x1'), line.getAttribute('y1'), line.getAttribute('x2'), line.getAttribute('y2')];
           paare.set(punkte.join(','), (paare.get(punkte.join(',')) ?? 0) + 1);
         }
         return [...paare.keys()];`
      );
      check(linien.length >= 2, `Zu wenige Beziehungslinien im Graph: ${linien.length}`);
      check(new Set(linien).size === linien.length, 'Hin- und Rückrichtung liegen auf derselben Linie');

      const beschriftungen = await run(
        window,
        `return [...document.querySelectorAll('.graph__edge--relation text')]
           .map((t) => t.getAttribute('x') + ',' + t.getAttribute('y'));`
      );
      check(beschriftungen.length >= 2, `Zu wenige Beziehungstexte im Graph: ${JSON.stringify(beschriftungen)}`);
      check(
        new Set(beschriftungen).size === beschriftungen.length,
        `Die Beziehungstexte stehen aufeinander: ${JSON.stringify(beschriftungen)}`
      );
    }

    // 17b. Ein verschobener Knoten bleibt an seiner Stelle
    const vorherAlle = await run(
      window,
      `return [...document.querySelectorAll('.graph__node')]
         .map((g) => g.getAttribute('data-id') + '=' + g.getAttribute('transform'));`
    );

    const gezogen = await run(
      window,
      `const svg = document.querySelector('.graph__canvas');
       const node = document.querySelector('.graph__node');
       const id = node.getAttribute('data-id');
       const rect = svg.getBoundingClientRect();
       const at = (x, y) => ({ clientX: rect.left + x, clientY: rect.top + y, bubbles: true });

       node.dispatchEvent(new MouseEvent('mousedown', at(100, 100)));
       svg.dispatchEvent(new MouseEvent('mousemove', at(300, 250)));
       svg.dispatchEvent(new MouseEvent('mouseup', at(300, 250)));
       return id;`
    );
    await sleep(1200);
    // Ziehen ist kein Klick: der Graph muss noch offen sein.
    check(await run(window, `return Boolean(document.querySelector('.graph__canvas'));`),
      'Das Ziehen eines Knotens hat die Notiz geoeffnet');
    const kampagnenDatei = path.join(userData, 'vault', 'campaigns', campaignId, 'campaign.json');
    {
      const kampagne = JSON.parse(fs.readFileSync(kampagnenDatei, 'utf8'));
      check(
        Boolean(kampagne.graphPositions && kampagne.graphPositions[gezogen]),
        'Die verschobene Stelle steht nicht in campaign.json'
      );
    }

    // Die uebrigen Knoten duerfen dabei nicht mitspringen.
    {
      const vorherAndere = vorherAlle.filter((eintrag) => !eintrag.startsWith(gezogen + '='));
      const nachherAlle = await run(
        window,
        `return [...document.querySelectorAll('.graph__node')]
           .map((g) => g.getAttribute('data-id') + '=' + g.getAttribute('transform'));`
      );
      const gefiltert = nachherAlle.filter((eintrag) => !eintrag.startsWith(gezogen + '='));
      check(
        JSON.stringify(gefiltert) === JSON.stringify(vorherAndere),
        `Beim Verschieben eines Knotens sind andere mitgesprungen:\n    vorher : ${JSON.stringify(vorherAndere)}\n    nachher: ${JSON.stringify(gefiltert)}`
      );
    }

    // Auch ein Sprachwechsel darf die Anordnung nicht neu wuerfeln: die
    // Notizen werden dabei umsortiert, am Netz aendert sich nichts.
    {
      const vorSprache = await run(
        window,
        `return [...document.querySelectorAll('.graph__node')]
           .map((g) => g.getAttribute('data-id') + '=' + g.getAttribute('transform'));`
      );

      await clickButton(window, 'Einstellungen');
      await sleep(500);
      await run(
        window,
        `const select = document.querySelector('.modal select');
         Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'en');
         select.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`
      );
      await sleep(900);
      await run(
        window,
        `const select = document.querySelector('.modal select');
         Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'de');
         select.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`
      );
      await sleep(900);
      await clickButton(window, '\u00d7', "document.querySelector('.modal__header')");
      await sleep(500);

      const nachSprache = await run(
        window,
        `return [...document.querySelectorAll('.graph__node')]
           .map((g) => g.getAttribute('data-id') + '=' + g.getAttribute('transform'));`
      );
      check(
        JSON.stringify(nachSprache) === JSON.stringify(vorSprache),
        'Ein Sprachwechsel hat die Anordnung im Graphen neu gewürfelt'
      );
    }

    // Zwei Zuege unmittelbar hintereinander: der zweite darf den ersten nicht
    // ueberschreiben, obwohl das Gespeicherte noch nicht zurueck ist.
    await run(
      window,
      `const svg = document.querySelector('.graph__canvas');
       const rect = svg.getBoundingClientRect();
       const at = (x, y) => ({ clientX: rect.left + x, clientY: rect.top + y, bubbles: true });
       const knoten = [...document.querySelectorAll('.graph__node')];

       for (const [i, node] of [knoten[1], knoten[2]].entries()) {
         node.dispatchEvent(new MouseEvent('mousedown', at(150, 150)));
         svg.dispatchEvent(new MouseEvent('mousemove', at(400 + i * 60, 300 + i * 60)));
         svg.dispatchEvent(new MouseEvent('mouseup', at(400 + i * 60, 300 + i * 60)));
       }
       return true;`
    );
    await sleep(1500);
    {
      const kampagne = JSON.parse(fs.readFileSync(kampagnenDatei, 'utf8'));
      check(
        Object.keys(kampagne.graphPositions ?? {}).length === 3,
        `Drei Züge ergeben nicht drei Stellen: ${JSON.stringify(kampagne.graphPositions)}`
      );
    }

    // Neu anordnen wirft sie wieder weg, und zwar beim ersten Druck. Geprueft
    // wird der zuerst gezogene Knoten: die uebrigen ordnen sich ohnehin neu.
    const stelleVon = (id) =>
      run(
        window,
        `const node = document.querySelector('.graph__node[data-id=' + JSON.stringify(${JSON.stringify(id)}) + ']');
         return node ? node.getAttribute('transform') : null;`
      );

    // Die abgelegte Stelle als Vergleich: danach darf der Knoten nicht mehr
    // genau dort stehen.
    const abgelegt = JSON.parse(fs.readFileSync(kampagnenDatei, 'utf8')).graphPositions[gezogen];
    const vorNeu = await stelleVon(gezogen);
    check(
      vorNeu === `translate(${abgelegt.x} ${abgelegt.y})`,
      `Der gezogene Knoten steht nicht an seiner gespeicherten Stelle: ${vorNeu}`
    );

    await clickButton(window, 'Neu anordnen', "document.querySelector('.graph__bar')");
    await sleep(1500);
    {
      const kampagne = JSON.parse(fs.readFileSync(kampagnenDatei, 'utf8'));
      check(
        Object.keys(kampagne.graphPositions ?? {}).length === 0,
        'Neu anordnen hat die verschobenen Stellen nicht verworfen'
      );
      check(
        (await stelleVon(gezogen)) !== vorNeu,
        'Neu anordnen lässt den gezogenen Knoten beim ersten Druck an seiner Stelle'
      );
    }

    // 17c. Handlungsstraenge: Strang anlegen, Notiz ueber die Suche, gespeichert
    {
      await run(window, `document.querySelector('[data-ansicht="straenge"]').click(); return true;`);
      await sleep(500);
      await run(window, `document.querySelector('[data-strang-neu]').click(); return true;`);
      await sleep(300);
      await run(window, `const i = document.querySelector('[data-strang-notiz-suche]'); setValue(i, 'a'); return true;`);
      await sleep(300);
      const gewaehlt = await run(window, `const b = document.querySelector('.straenge__wahl [data-wahl]'); if (!b) return null; b.click(); return b.dataset.wahl;`);
      check(Boolean(gewaehlt), 'Handlungsstränge: die Notizsuche liefert nichts');
      await sleep(300);
      check(await run(window, `return document.querySelectorAll('[data-strang-knoten]').length === 1;`),
        'Handlungsstränge: die gewählte Notiz erscheint nicht als Knoten');
      await sleep(900);
      const plots = JSON.parse(fs.readFileSync(path.join(userData, 'vault', 'campaigns', campaignId, 'campaign.json'), 'utf8')).plots ?? [];
      check(plots.length === 1 && plots[0].notizen[0] === gewaehlt, `Handlungsstränge werden nicht gespeichert (${JSON.stringify(plots)})`);
      await run(window, `document.querySelector('[data-ansicht="graph"]').click(); return true;`);
      await sleep(500);
    }

    // Druecken und Loslassen ohne Bewegung oeffnet die Notiz
    await run(
      window,
      `const svg = document.querySelector('.graph__canvas');
       const knoten = document.querySelector('.graph__node');
       const rect = svg.getBoundingClientRect();
       const bei = { clientX: rect.left + 100, clientY: rect.top + 100, bubbles: true };
       knoten.dispatchEvent(new MouseEvent('mousedown', bei));
       svg.dispatchEvent(new MouseEvent('mouseup', bei));
       return true;`
    );
    await sleep(900);
    check(await run(window, `return document.querySelector('.graph__canvas') === null
       && Boolean(document.querySelector('.note-editor'));`), 'Klick auf einen Knoten öffnet keine Notiz');

    // 18. Eigene Suche im Editor mit Strg+F, samt Ersetzen
    await selectNote(window, 'Toran');
    await run(
      window,
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })); return true;`
    );
    await sleep(600);
    check(await run(window, `return Boolean(document.querySelector('.search-bar__query'));`),
      'Strg+F öffnet keine Suchleiste');

    await run(window, `setValue(document.querySelector('.search-bar__query'), 'Gold'); return true;`);
    await sleep(700);
    check(await run(window, `return document.querySelectorAll('.ProseMirror .search-hit').length === 1;`),
      'Eigene Suche hebt nichts hervor');

    await run(window, `setValue(document.querySelector('.search-bar__replace'), 'Silber'); return true;`);
    await sleep(400);
    await clickButton(window, 'Alle ersetzen', "document.querySelector('.search-bar')");
    await sleep(900);

    check(
      await run(window, `const text = document.querySelector('.ProseMirror').textContent;
         return text.includes('Silber') && !text.includes('Gold');`),
      'Ersetzen hat nicht gewirkt'
    );
    check(await run(window, `return document.querySelectorAll('.ProseMirror .search-hit').length === 0;`),
      'Nach dem Ersetzen bleiben Fundstellen markiert');

    // Escape schliesst die eigene Suche wieder
    await run(
      window,
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`
    );
    await sleep(500);
    check(await run(window, `return document.querySelector('.search-bar__query') === null;`),
      'Escape schließt die Suchleiste nicht');

    await save(window);

    // 19. Notiztypen aus einer anderen Kampagne übernehmen
    await menuAction(window, 'Neue Kampagne');
    await sleep(400);
    await fillDialog(window, 'Aschetal', 'Anlegen');
    await sleep(700);

    await menuAction(window, 'Notiztypen');
    await sleep(700);
    check(await run(window, `return Boolean(document.querySelector('.type-editor__copy select'));`),
      'Auswahl für andere Kampagnen fehlt');

    await run(
      window,
      `const select = document.querySelector('.type-editor__copy select');
       const option = [...select.options].find((o) => o.textContent.includes('Sturmküste'));
       if (!option) throw new Error('Sturmküste nicht in der Auswahl');
       Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value);
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`
    );
    await sleep(300);
    await clickButton(window, 'Übernehmen', "document.querySelector('.type-editor__copy')");
    await sleep(600);

    check(await run(window, `return Boolean(document.querySelector('.type-editor__note'));`),
      'Keine Rückmeldung zum Übernehmen');
    check(
      await run(window, `return [...document.querySelectorAll('.type-editor__list button')]
         .some((b) => b.textContent.includes('Gegenstand'));`),
      'Der eigene Typ wurde nicht übernommen'
    );

    await clickButton(window, 'Übernehmen', "document.querySelector('.modal__footer')");
    await sleep(900);
    check(
      await run(window, `return [...document.querySelectorAll('.note-list__new button')].some((b) => b.textContent.includes('Gegenstand'));`),
      'Übernommener Typ fehlt nach dem Speichern'
    );

    // Zurück zur ursprünglichen Kampagne
    await waehleKampagne(window, 'Sturmküste');
    await sleep(1200);

    // 20. Aufräumen: benutzte Bilder bleiben, unbenutzte werden angeboten
    await menuAction(window, 'Aufräumen');
    await sleep(2000);
    check(await run(window, `return Boolean(document.querySelector('.modal'));`), 'Aufräumen-Dialog öffnet nicht');
    // Beide Bilder sind noch in Benutzung, es darf nichts angeboten werden
    check(await run(window, `return document.querySelectorAll('.cleanup li').length === 0;`),
      'Benutzte Bilder wurden als verwaist gemeldet');
    await clickButton(window, 'Schließen', "document.querySelector('.modal__footer')");
    await sleep(500);

    // 21. Versionsverlauf: alten Stand wiederherstellen
    await selectNote(window, 'Toran');
    await run(window, `document.querySelector('.ProseMirror').focus(); return true;`);
    await sleep(200);
    window.webContents.insertText(' Nachtrag.');
    await sleep(500);
    await save(window);

    await clickButton(window, 'Verlauf');
    await sleep(1200);
    check(await run(window, `return Boolean(document.querySelector('.history__list'));`),
      'Verlauf zeigt keine Fassungen');

    await clickButton(window, 'Wiederherstellen', "document.querySelector('.modal')");
    await sleep(1500);
    check(await run(window, `return document.querySelector('.modal') === null;`), 'Verlaufs-Dialog bleibt offen');
    check(
      await run(window, `return !document.querySelector('.ProseMirror').textContent.includes('Nachtrag');`),
      'Der alte Stand wurde nicht wiederhergestellt'
    );
    // 21b. Link im Fliesstext setzen und speichern
    await selectNote(window, 'Toran');
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       view.focus();
       const range = document.createRange();
       range.selectNodeContents(view);
       range.collapse(false);
       const selection = window.getSelection();
       selection.removeAllRanges();
       selection.addRange(range);
       document.execCommand('insertText', false, ' Handbuch');
       return true;`
    );
    await sleep(400);
    // Das eben getippte Wort markieren, damit der Link daran haengt.
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       const selection = window.getSelection();
       selection.modify('extend', 'backward', 'word');
       return selection.toString();`
    );
    await sleep(300);
    await pressToolbar(window, '\u{1f517}');
    await sleep(600);
    check(await run(window, `return Boolean(document.querySelector('.modal input'));`), 'Link-Dialog öffnet nicht');
    await run(
      window,
      `setValue(document.querySelector('.modal input'), 'https://example.org/regeln');
       return true;`
    );
    await sleep(300);
    await clickButton(window, 'Übernehmen', "document.querySelector('.modal')");
    await sleep(600);
    await save(window);
    await sleep(900);
    {
      const dateien = fs.readdirSync(notesDir).map((n) => fs.readFileSync(path.join(notesDir, n), 'utf8'));
      check(
        dateien.some((raw) => raw.includes('[Handbuch](https://example.org/regeln)')),
        'Der Link steht nicht in der Datei'
      );
    }

    // 21d. Eingefuegter Klartext wird als Markdown gelesen
    await selectNote(window, 'Toran');
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       view.focus();
       const range = document.createRange();
       range.selectNodeContents(view);
       range.collapse(false);
       const selection = window.getSelection();
       selection.removeAllRanges();
       selection.addRange(range);

       // Zeilenumbruch ueber String.fromCharCode, damit er die Vorlage hier
       // nicht selbst umbricht.
       const nl = String.fromCharCode(10);
       const text = nl + '## Aus der Zwischenablage' + nl + nl + 'Ein **fetter** Satz.';

       const data = new DataTransfer();
       data.setData('text/plain', text);
       view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
       return true;`
    );
    await sleep(800);
    check(
      await run(window, `return [...document.querySelectorAll('.ProseMirror h2')].some((h) => h.textContent.includes('Aus der Zwischenablage'));`),
      'Eingefügtes Markdown wurde nicht als Überschrift gelesen'
    );
    check(
      await run(window, `return [...document.querySelectorAll('.ProseMirror strong')].some((b) => b.textContent === 'fetter');`),
      'Eingefügtes Markdown wurde nicht als Fettschrift gelesen'
    );
    // Mehrere Absaetze duerfen keine leeren dazwischen erzeugen.
    const leereVorher = await run(window, `return [...document.querySelectorAll('.ProseMirror p')].filter((p) => !p.textContent.trim()).length;`);
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       view.focus();
       const nl = String.fromCharCode(10);
       const data = new DataTransfer();
       data.setData('text/plain', 'Absatz eins.' + nl + nl + 'Absatz zwei.' + nl + nl + 'Ein <div>Kasten</div> bleibt Text.');
       view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
       return true;`
    );
    await sleep(800);
    check(
      (await run(window, `return [...document.querySelectorAll('.ProseMirror p')].filter((p) => !p.textContent.trim()).length;`)) === leereVorher,
      'Das Einfügen mehrerer Absätze hat leere Absätze erzeugt'
    );
    check(
      await run(window, `return document.querySelector('.ProseMirror').textContent.includes('<div>Kasten</div>');`),
      'Spitze Klammern im eingefügten Text wurden als HTML gelesen'
    );

    // In einem Codeblock bleibt Eingefuegtes woertlich.
    await pressToolbar(window, '</>');
    await sleep(400);
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       view.focus();
       const data = new DataTransfer();
       data.setData('text/plain', 'if (**p) return;');
       view.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
       return true;`
    );
    await sleep(700);
    check(
      await run(window, `return [...document.querySelectorAll('.ProseMirror pre')].some((p) => p.textContent.includes('if (**p) return;'));`),
      'Im Codeblock wurde das Eingefügte als Markdown gelesen'
    );

    await save(window);
    await sleep(900);
    {
      const dateien = fs.readdirSync(notesDir).map((n) => fs.readFileSync(path.join(notesDir, n), 'utf8'));
      check(
        dateien.some((raw) => raw.includes('## Aus der Zwischenablage') && raw.includes('**fetter**')),
        'Das eingefügte Markdown steht nicht als Markdown in der Datei'
      );
      check(
        dateien.every((raw) => !raw.includes('\\*\\*fetter')),
        'Das eingefügte Markdown wurde maskiert statt ausgewertet'
      );
    }

    // 21c. Tabelle einfuegen, fuellen und speichern
    await selectNote(window, 'Toran');
    await run(
      window,
      `const view = document.querySelector('.ProseMirror');
       view.focus();
       const range = document.createRange();
       range.selectNodeContents(view);
       range.collapse(false);
       const selection = window.getSelection();
       selection.removeAllRanges();
       selection.addRange(range);
       return true;`
    );
    await sleep(300);
    await pressToolbar(window, '\u25a6');
    await sleep(700);
    check(
      await run(window, `return document.querySelectorAll('.ProseMirror table th').length === 2;`),
      'Tabelle wurde nicht eingefügt'
    );
    // In die erste Kopfzelle schreiben.
    await run(
      window,
      `const cell = document.querySelector('.ProseMirror table th');
       const range = document.createRange();
       range.selectNodeContents(cell);
       range.collapse(true);
       const selection = window.getSelection();
       selection.removeAllRanges();
       selection.addRange(range);
       document.querySelector('.ProseMirror').focus();
       document.execCommand('insertText', false, 'Jahr');
       return true;`
    );
    await sleep(500);
    check(
      await run(window, `return [...document.querySelectorAll('.toolbar button')].some((b) => b.textContent === '+Z');`),
      'Tabellenknöpfe fehlen, obwohl der Cursor in der Tabelle steht'
    );
    await save(window);
    await sleep(900);
    {
      const dateien = fs.readdirSync(notesDir).map((n) => fs.readFileSync(path.join(notesDir, n), 'utf8'));
      const mitTabelle = dateien.find((raw) => raw.includes('| Jahr |'));
      check(Boolean(mitTabelle), 'Die Tabelle steht nicht in der Datei');
      if (mitTabelle) {
        check(/\|\s*---\s*\|/.test(mitTabelle), 'Der Tabelle fehlt die Trennzeile');
      }
    }

    // 22. Hilfe: Tastenkürzel müssen auffindbar sein
    await clickButton(window, 'Hilfe');
    await sleep(600);
    check(await run(window, `return Boolean(document.querySelector('.help'));`), 'Hilfe öffnet nicht');
    check(await run(window, `return document.querySelector('.help').textContent.includes('Strg + F');`),
      'Tastenkürzel fehlen in der Hilfe');
    check(await run(window, `return document.querySelector('.help').textContent.includes('Strg + Klick');`),
      'Tastenbezeichnungen sind nicht deutsch');
    await clickButton(window, '×', "document.querySelector('.modal__header')");
    await sleep(400);

    // 22b. Über: Name, Version und Lizenz müssen auffindbar sein
    await clickButton(window, 'Über');
    await sleep(600);
    check(await run(window, `return document.querySelector('.about')?.textContent.includes('ItsLunasDream');`),
      'Über-Dialog nennt nicht ItsLunasDream');
    check(await run(window, `return /Version \\d+\\.\\d+\\.\\d+/.test(document.querySelector('.about')?.textContent ?? '');`),
      'Über-Dialog zeigt keine Versionsnummer');
    check(await run(window, `return document.querySelector('.about')?.textContent.includes('Affero');`),
      'Über-Dialog nennt nicht die AGPL');
    await clickButton(window, '×', "document.querySelector('.modal__header')");
    await sleep(400);

    // 23. Das Fenster muss sich mit ungespeicherten Aenderungen schliessen
    // lassen. Frueher brach beforeunload das Schliessen ohne Dialog ab.
    await selectNote(window, 'Toran');
    await run(window, `document.querySelector('.ProseMirror').focus(); return true;`);
    await sleep(200);
    window.webContents.insertText(' Ungespeichert.');
    await sleep(400);
    check(await run(window, `return document.querySelector('.status--dirty') !== null;`),
      'Notiz gilt nicht als ungespeichert');

    const closed = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 8000);
      window.once('closed', () => {
        clearTimeout(timer);
        resolve(true);
      });
      window.close();
    });
    check(closed, 'Das Fenster ließ sich mit ungespeicherten Änderungen nicht schließen');

    // Beim Schliessen muss der Stand noch gesichert worden sein
    if (closed) {
      const campaignsDir = path.join(userData, 'vault', 'campaigns');
      const saved = fs
        .readdirSync(campaignsDir)
        .flatMap((id) => {
          const notesDir = path.join(campaignsDir, id, 'notes');
          if (!fs.existsSync(notesDir)) return [];
          return fs.readdirSync(notesDir).map((name) => fs.readFileSync(path.join(notesDir, name), 'utf8'));
        })
        .some((raw) => raw.includes('Ungespeichert.'));
      check(saved, 'Der ungespeicherte Stand ging beim Schließen verloren');
    }
  } catch (error) {
    problems.push(String(error));
  }

  if (problems.length) {
    console.error('SMOKE FEHLGESCHLAGEN\n- ' + problems.join('\n- '));
  } else {
    console.log('SMOKE OK');
  }

  fs.rmSync(userData, { recursive: true, force: true });
  app.exit(problems.length ? 1 : 0);
});
