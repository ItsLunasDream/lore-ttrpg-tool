/**
 * Prueft, was der Editor beim Laden und Speichern am Markdown veraendert.
 *
 * Die Unit-Tests pruefen nur die Umwandlung Markdown <-> HTML. Was danach
 * kommt, ist das Schema des Editors: kennt es ein Element nicht, faellt es
 * beim Laden weg und ist nach dem naechsten Speichern endgueltig verloren.
 * Genau so gingen frueher Tabellen, Links und tiefe Ueberschriften verloren.
 * Dieser Test laeuft deshalb durch die echte Anwendung.
 *
 * Aufruf: xvfb-run -a npx electron scripts/roundtrip.cjs --no-sandbox
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'backstory-roundtrip-'));
app.setPath('userData', userData);
// Dieser Test klickt auf deutsche Beschriftungen. Ausgeliefert wird aber
// Englisch (Konvention 6), deshalb wird die Sprache hier vorab gesetzt statt
// jedes Label doppelt zu fuehren. Der uebrige Teil der Einstellungen bleibt
// leer und wird beim Lesen mit den Standardwerten aufgefuellt.
fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ language: 'de' }), 'utf8');

require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (window, body) => window.webContents.executeJavaScript(`(() => { ${body} })()`);

/**
 * Vorher und nachher muessen wortgleich sein. Wo der Editor die Schreibweise
 * bewusst vereinheitlicht (Listen, Maskierung), steht das erwartete Ergebnis
 * als `erwartet` daneben, damit eine Aenderung daran auffaellt statt
 * durchzurutschen.
 */
const PROBEN = [
  { name: 'Tabelle', text: '| Jahr | Ereignis |\n| --- | --- |\n| 712 | Geboren |\n| 730 | Verbannt |' },
  { name: 'Tabelle mit Strich in der Zelle', text: '| A | B |\n| --- | --- |\n| x \\| y | z |' },
  {
    name: 'Wiki-Link mit Alias in einer Tabelle',
    text: '| Wer | Notiz |\n| --- | --- |\n| [[Mira\\|ihr]] | dazu |'
  },
  {
    name: 'Tabelle mit Auszeichnungen',
    text: '| Wer | Was |\n| --- | --- |\n| **Mira** | ein [Link](https://example.org) |'
  },
  {
    name: 'Aufgabenliste',
    text: '- [ ] Offen\n- [x] Erledigt',
    // Der Editor setzt drei Leerzeichen hinter den Strich und eine Leerzeile
    // zwischen die Punkte; das Kreuz und die leere Klammer bleiben.
    erwartet: '- [ ] Offen\n\n- [x] Erledigt'
  },
  {
    name: 'Bild mit Breite in Bildpunkten',
    text: '<img src="assets/bild.png" alt="" width="300">'
  },
  {
    name: 'Bild mit Breite als Anteil',
    // Ein Prozentwert im Attribut width waere ungueltiges HTML, deshalb
    // steht er als Stilangabe. Beim naechsten Speichern muss er so
    // wiederkommen, wie er hineingegangen ist.
    text: '<img src="assets/bild.png" alt="" style="width: 50%">'
  },
  {
    name: 'Unterstrichener Text',
    // Markdown kennt kein Unterstrichen, deshalb steht es als inline-HTML in
    // der Datei. Kennte das Schema des Editors das Element nicht, fiele es
    // beim Laden weg und waere nach dem naechsten Speichern verloren.
    text: 'Ein <u>unterstrichenes</u> Wort.'
  },
  { name: 'Fussnote', text: 'Sie ging fort.[^1]\n\n[^1]: Wohin, sagt niemand.' },
  { name: 'Ueberschriften', text: '# Eins\n\n## Zwei\n\n### Drei' },
  { name: 'Tiefe Ueberschrift', text: '#### Vier\n\nText.' },
  { name: 'Zitat', text: '> Sie sagte nichts.\n>\n> Dann ging sie.' },
  { name: 'Auszeichnungen', text: '**fett**, *kursiv*, ~~gestrichen~~, `code`' },
  { name: 'Trennlinie', text: 'oben\n\n---\n\nunten' },
  { name: 'Harter Umbruch', text: 'Erste Zeile  \nZweite Zeile' },
  { name: 'Link', text: 'Siehe [Handbuch](https://example.org) und [[Mira]].' },
  { name: 'Blosse Adresse', text: 'Siehe https://example.org heute.' },
  { name: 'Blosse E-Mail-Adresse', text: 'Schreib an mira@example.org bitte.' },
  {
    name: 'Spitze Klammer im Text',
    text: 'Ein \\<div\\>Kasten\\</div\\> als Text.',
    // Nur die oeffnende Klammer braucht die Maskierung, die schliessende
    // beginnt kein Element.
    erwartet: 'Ein \\<div>Kasten\\</div> als Text.'
  },
  {
    name: 'Wiki-Link mit Sonderzeichen im Titel',
    text: 'Sie wohnt in [[Haus_am_See]], [[Der *Turm*]] und [[Ort #1]].'
  },
  {
    name: 'Adresse mit doppelter Klammer',
    text: 'Siehe https://example.org/x?a=[[b]] dazu.',
    // Die Klammern muessen maskiert werden, also wird die Adresse zur
    // ausgeschriebenen Linkschreibweise. Sie bleibt dabei heil.
    erwartet: 'Siehe [https://example.org/x?a=\\[\\[b\\]\\]](https://example.org/x?a=%5B%5Bb%5D%5D) dazu.'
  },
  {
    name: 'Adresse mit Klammer',
    text: 'Siehe https://example.org/a[b_c dazu.',
    erwartet: 'Siehe [https://example.org/a\\[b\\_c](https://example.org/a%5Bb_c) dazu.'
  },
  {
    name: 'Codeblock mit Leerzeile',
    text: 'Davor:\n\n```\neins\n   \nzwei\n```'
  },
  // Früher stand hier eine erwartete Leerzeile vor dem Schluss-```: das „ZZ“
  // des Tests landete im Codeblock. Seit Tiptap 3 hängt der Editor einen
  // leeren Absatz an (trailingNode), dort landet es, und der Block bleibt
  // wortgleich.
  { name: 'Codeblock', text: 'Davor:\n\n```\nzeile eins\nzeile zwei\n```' },
  // Listen bleiben seit dem Testbericht eng und wortgleich; vorher wurden
  // sie zu „-   eins" mit Leerzeilen vereinheitlicht.
  { name: 'Liste', text: '- eins\n- zwei\n  - zwei a' },
  { name: 'Nummerierte Liste', text: '1. eins\n2. zwei' },
  { name: 'HTML-Kommentar', text: 'Vorne <!-- fuer die SL --> hinten.\n\n<!-- ganze Zeile -->' },
  { name: 'Linktitel und spitzer Link', text: '[x](https://a.de "Titel") und <https://b.de>.' },
  {
    name: 'Sonderzeichen',
    text: 'Ein Stern * und ein Unterstrich _ mitten drin.',
    erwartet: 'Ein Stern \\* und ein Unterstrich \\_ mitten drin.'
  }
];

const problems = [];

async function main() {
  await app.whenReady();

  let window;
  for (let attempt = 0; attempt < 100 && !window; attempt++) {
    [window] = BrowserWindow.getAllWindows();
    if (!window) await sleep(100);
  }
  if (!window) throw new Error('Kein Fenster geöffnet.');
  await sleep(3000);

  await run(
    window,
    `const button = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Erste Kampagne anlegen'));
     if (button) button.click();
     return true;`
  );
  await sleep(600);
  await run(
    window,
    `const input = document.querySelector('.modal input');
     Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Rundlauf');
     input.dispatchEvent(new Event('input', { bubbles: true }));
     [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('Anlegen')).click();
     return true;`
  );
  await sleep(1500);

  const campaigns = path.join(userData, 'vault', 'campaigns');
  const campaignId = fs.readdirSync(campaigns)[0];
  const notesDir = path.join(campaigns, campaignId, 'notes');
  fs.mkdirSync(notesDir, { recursive: true });

  // Die Notizen werden hinter dem Ruecken der Anwendung geschrieben, wie es
  // auch passiert, wenn jemand die Dateien in Obsidian anlegt.
  const ids = new Map();
  for (const probe of PROBEN) {
    const id = crypto.randomUUID();
    ids.set(probe.name, id);
    fs.writeFileSync(
      path.join(notesDir, `${id}.md`),
      `---\nid: ${id}\nschemaVersion: 1\ntype: note\ntitle: ${probe.name}\naliases: []\ntags: []\n` +
        `fields: {}\nrelations: []\ncreatedAt: '2026-01-01T00:00:00.000Z'\nupdatedAt: '2026-01-01T00:00:00.000Z'\n---\n\n${probe.text}\n`
    );
  }

  window.webContents.reload();
  await sleep(4000);

  for (const probe of PROBEN) {
    await run(
      window,
      `const entry = [...document.querySelectorAll('.note-list li button')]
         .find((b) => b.textContent.includes(${JSON.stringify(probe.name)}));
       if (!entry) throw new Error('Notiz nicht in der Liste: ' + ${JSON.stringify(probe.name)});
       entry.click();
       return true;`
    );
    await sleep(800);

    // Erst eine Aenderung macht die Notiz schmutzig. Der Zusatz kommt ans
    // Ende und wird vor dem Vergleich wieder entfernt.
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
       document.execCommand('insertText', false, 'ZZ');
       return true;`
    );
    await sleep(400);
    await run(window, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); return true;`);
    await sleep(1400);

    const raw = fs.readFileSync(path.join(notesDir, `${ids.get(probe.name)}.md`), 'utf8');
    if (raw.includes("updatedAt: '2026-01-01")) {
      problems.push(`${probe.name}: wurde nicht gespeichert, der Vergleich sagt nichts aus`);
      continue;
    }

    const body = raw.split('---\n').slice(2).join('---\n').trim().replace(/ZZ/g, '').trim();
    const erwartet = (probe.erwartet ?? probe.text).trim();
    if (body !== erwartet) {
      problems.push(`${probe.name}:\n    vorher : ${JSON.stringify(erwartet)}\n    nachher: ${JSON.stringify(body)}`);
    }
  }

  fs.rmSync(userData, { recursive: true, force: true });

  if (problems.length > 0) {
    console.error('RUNDLAUF FEHLGESCHLAGEN');
    for (const problem of problems) console.error('- ' + problem);
    app.exit(1);
    return;
  }

  console.log(`RUNDLAUF OK (${PROBEN.length} Proben)`);
  app.exit(0);
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
