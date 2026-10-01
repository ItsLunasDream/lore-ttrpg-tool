/**
 * Rauchtest der KI in der Inspirationshilfe — mit vorgetaeuschtem Anbieter.
 *
 * Vorgetaeuscht ist nur das Modell: ein kleiner HTTP-Server, der sich wie
 * Ollama verhaelt. Alles davor und danach ist echt — die Einstellung der
 * Huelle, der Weg durch den Hauptprozess, das Auswerten der Antwort, die
 * Oberflaeche.
 *
 * Geprueft wird vor allem das, was schiefgehen kann, wenn ein Modell sich
 * nicht an die Abmachung haelt: eine halbe Antwort, Unsinn, ein Fehler. In
 * allen drei Faellen muss der Entwurf stehen bleiben.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-inspiration-ki.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inspirationki-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

/** Was das vorgetaeuschte Modell antwortet. Wird je Pruefung umgesetzt. */
let antwort = { art: 'json', json: {} };
/** Was es zuletzt gefragt wurde — daran laesst sich die Anfrage pruefen. */
let letzteAnfrage = '';

const modell = http.createServer((anfrage, ausgabe) => {
  if (anfrage.url.startsWith('/api/tags')) {
    ausgabe.writeHead(200, { 'content-type': 'application/json' });
    ausgabe.end(JSON.stringify({ models: [{ name: 'testmodell:latest' }] }));
    return;
  }
  if (!anfrage.url.startsWith('/api/chat')) {
    ausgabe.writeHead(404);
    ausgabe.end();
    return;
  }

  let roh = '';
  anfrage.on('data', (stueck) => (roh += stueck));
  anfrage.on('end', () => {
    letzteAnfrage = roh;

    if (antwort.art === 'fehler') {
      ausgabe.writeHead(500, { 'content-type': 'application/json' });
      ausgabe.end('{}');
      return;
    }

    const inhalt =
      antwort.art === 'unsinn' ? 'Dazu faellt mir nichts ein.' : JSON.stringify(antwort.json);
    ausgabe.writeHead(200, { 'content-type': 'application/x-ndjson' });
    // Wie Ollama: eine JSON-Zeile je Teilstueck, absichtlich in zwei Haelften.
    const mitte = Math.ceil(inhalt.length / 2);
    ausgabe.write(JSON.stringify({ message: { content: inhalt.slice(0, mitte) } }) + '\n');
    ausgabe.write(JSON.stringify({ message: { content: inhalt.slice(mitte) } }) + '\n');
    ausgabe.end();
  });
});

modell.listen(0, '127.0.0.1', () => {
  const port = modell.address().port;
  fs.writeFileSync(
    path.join(userData, 'einstellungen.json'),
    JSON.stringify({
      language: 'de',
      ki: {
        anbieter: 'ollama',
        ollamaAdresse: `http://127.0.0.1:${port}`,
        ollamaModell: 'testmodell',
        claudeModell: 'claude-opus-5'
      },
      claudeSchluessel: ''
    })
  );

  app.setPath('userData', userData);
  process.env.TTRPG_TOOLS_START_APP = 'inspiration';
  require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
  starte();
});

/*
 * Ein abgelehntes executeJavaScript bliebe sonst unbemerkt: der Lauf haengt,
 * bis ihn jemand abwuergt, und ein haengender Test sagt nichts. Genau das ist
 * beim Umbau der Oberflaeche passiert — ein alter Selektor traf nichts, und
 * der Lauf stand eine Viertelstunde still, ohne eine Zeile auszugeben.
 */
process.on('unhandledRejection', (grund) => {
  console.log(`  FEHL unerwarteter Fehler: ${grund && grund.message ? grund.message : grund}`);
  app.exit(1);
});

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

function starte() {
  app.whenReady().then(async () => {
    await warte(5000);
    const fenster = BaseWindow.getAllWindows()[0];
    const sicht = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/inspiration/'));
    if (!sicht?.webContents) {
      console.log('  FEHL die Inspirationshilfe steht nicht');
      app.exit(1);
      return;
    }
    fenster.setBounds({ x: 0, y: 0, width: 1320, height: 900 });
    await warte(600);
    const js = (a) => sicht.webContents.executeJavaScript(a);
    const konsole = [];
    sicht.webContents.on('console-message', (_e, l, t) => {
      if (l >= 2) konsole.push(t.slice(0, 160));
    });

    pruefe(
      await js("Boolean(document.querySelector('.ki-hinweis'))"),
      'bei eingerichteter KI steht der Hinweis da'
    );

    // Erst einmal wuerfeln, damit es eine Umgebung gibt.
    await js(
      "[...document.querySelectorAll('button')].find(b => /Alles würfeln/.test(b.textContent)).click(); true"
    );
    await warte(400);
    pruefe(
      (await js("document.querySelectorAll('.knopf--ki').length")) === 2,
      'Aufhaenger und Zeitstrahl haben einen KI-Knopf'
    );
    pruefe(
      (await js("document.querySelectorAll('.zeile__knopf').length")) > 8,
      'und jede Fraktion, Figur, Ort und Verbindung einen kleinen dazu'
    );

    // --- Eine brauchbare Antwort --------------------------------------------
    antwort = {
      art: 'json',
      json: {
        ausloeser: 'Die Glocke von Rabenstein hat um Mitternacht geläutet.',
        betroffene: 'Der Küster bittet um Hilfe, sehr leise.',
        komplikation: 'Nur: der Turm steht seit dem Brand leer.',
        frist: 'Bis zum nächsten Vollmond.'
      }
    };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(1500);
    const erste = await js("document.querySelector('.karte .zeile .feld__wert').value");
    pruefe(erste.includes('Rabenstein'), `der Vorschlag steht im Aufhaenger (${erste})`);
    const frist = await js(
      "[...document.querySelectorAll('.karte .zeile .feld__wert')].map(e=>e.value).join(' | ')"
    );
    pruefe(frist.includes('Bis zum nächsten Vollmond'), `und die Frist dazu (${frist})`);
    pruefe(
      !(await js("Boolean(document.querySelector('.ki-fehler'))")),
      'ohne Fehlermeldung'
    );

    // --- Die Anfrage traegt die Umgebung ------------------------------------
    /*
     * Ohne das schlaegt das Modell etwas vor, das zu irgendeiner Welt passt,
     * nur nicht zu der, die schon dasteht. Am Modelltest allein ist das nicht
     * zu sehen: hier haengt es daran, dass der Entwurf wirklich durch die
     * Bruecke geht.
     */
    const ersteFigur = await js(
      "[...document.querySelectorAll('.karte')][2].querySelector('.block__titel').value.trim()"
    );
    antwort = {
      art: 'json',
      json: {
        name: 'Ansgar Salzfurt',
        rolle: 'Vermittelnd',
        triebfeder: 'Will, dass niemand nachfragt.',
        hebel: 'Kennt den Wächter beim Vornamen.',
        makel: 'Aber: nimmt Geld an, von jedem.'
      }
    };
    await js(
      "[...document.querySelectorAll('.karte')][2].querySelectorAll('.zeile__knopf')[1].click(); true"
    );
    await warte(1500);
    pruefe(
      letzteAnfrage.includes(ersteFigur),
      `die Anfrage kennt den bestehenden Entwurf (${ersteFigur})`
    );
    const figurenKarte =
      "[...[...document.querySelectorAll('.karte')][2].querySelectorAll('input, textarea')].map(e=>e.value).join(' | ')";
    pruefe(
      (await js(figurenKarte)).includes('Ansgar Salzfurt'),
      'die vorgeschlagene Figur steht in der Liste'
    );

    // --- Die Verbindungen ziehen den neuen Namen nach ------------------------
    /*
     * Der Name steht in den Verbindungen fest drin. Ohne Nachziehen spraeche
     * das Geflecht von jemandem, den es nicht mehr gibt — und im Export
     * zeigte der Verweis ins Leere.
     */
    const verbindungen = await js(
      "[...[...document.querySelectorAll('.karte')][4].querySelectorAll('input, textarea')].map(e=>e.value).join(' | ')"
    );
    pruefe(
      verbindungen.includes('Ansgar Salzfurt'),
      'die Verbindungen kennen den neuen Namen'
    );

    // --- Unsinn ---------------------------------------------------------------
    antwort = { art: 'unsinn' };
    const vorher = await js("document.querySelector('.karte .zeile .feld__wert').value");
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(1500);
    pruefe(
      await js("Boolean(document.querySelector('.ki-fehler'))"),
      'eine Antwort ohne JSON wird als Fehler gemeldet'
    );
    pruefe(
      (await js("document.querySelector('.karte .zeile .feld__wert').value")) === vorher,
      'und der Entwurf bleibt stehen'
    );

    // --- Eine halbe Antwort ---------------------------------------------------
    antwort = { art: 'json', json: { ausloeser: 'Nur eine Zeile.' } };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(1500);
    pruefe(
      (await js("document.querySelector('.karte .zeile .feld__wert').value")) === vorher,
      'eine halbe Antwort wird nicht halb uebernommen'
    );

    // --- Ein Fehler des Anbieters --------------------------------------------
    antwort = { art: 'fehler' };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(1500);
    const meldung = await js("document.querySelector('.ki-fehler')?.textContent ?? ''");
    pruefe(meldung.length > 0, `ein Fehler des Anbieters wird gesagt (${meldung})`);
    pruefe(
      await js("!document.querySelector('.knopf--ki').disabled"),
      'und der Knopf laesst sich danach wieder druecken'
    );

    // --- Alles auf einmal ----------------------------------------------------
    /*
     * Der grosse Knopf: eine Antwort fuer alle sechs Bausteine. Die Antwort
     * hier ist absichtlich luecken- und fehlerhaft — zu wenige Orte, eine
     * Verbindung auf eine Figur, die es nicht gibt. Beides muss das Werkzeug
     * auffangen: auffuellen aus den Tabellen, Unsinn verwerfen. Genau daran
     * haengt, ob der Regler „Umfang" noch stimmt.
     */
    antwort = {
      art: 'json',
      json: {
        aufhaenger: {
          ausloeser: 'Der Damm bei Aschfurt ist gebrochen.',
          betroffene: 'Die Müllerin bittet um Hilfe.',
          komplikation: 'Nur: das Wasser steigt weiter.',
          frist: 'Drei Tage.'
        },
        fraktionen: [
          { name: 'Der Bund', art: 'eine Zunft', ziel: 'Den Damm halten.', mittel: 'Geld.', schwaeche: 'Alt.' }
        ],
        figuren: [
          { name: 'Runa Aschfurt', rolle: 'Auftraggebend', triebfeder: 'Will das Dorf retten.', hebel: 'Kennt den Damm.', makel: 'Aber: schweigt.' },
          { name: 'Gorm Steinweide', rolle: 'Gegenseite', triebfeder: 'Will das Land.', hebel: 'Hat Papiere.', makel: 'Aber: zahlt nie.' }
        ],
        orte: [
          { name: 'Aschfurt', art: 'eine Mühle', merkmal: 'Steht schief.', zustand: 'Unter Wasser.', karte: 'Ein Steg.' }
        ],
        verbindungen: [
          { a: 0, b: 1, muster: 'Alte Rechnung', hin: 'Runa wartet.', zurueck: 'Gorm hat es vergessen.' },
          { a: 0, b: 12, muster: 'Unsinn', hin: 'x', zurueck: 'y' }
        ],
        zeitstrahl: ['Das Wasser steigt.', 'Die Ernte ist hin.']
      }
    };
    await js("document.querySelector('.knopf--kigross').click(); true");
    await warte(2000);

    const werte = (nr) =>
      js(`[...[...document.querySelectorAll('.karte')][${nr}].querySelectorAll('input, textarea')].map(e => e.value)`);

    const haken = await werte(0);
    pruefe(haken.join(' ').includes('Aschfurt'), `der Aufhaenger kommt von der KI (${haken[0]})`);

    const fraktionen = await js("[...document.querySelectorAll('.karte')][1].querySelectorAll('.block').length");
    const figuren = await js("[...document.querySelectorAll('.karte')][2].querySelectorAll('.block').length");
    const orte = await js("[...document.querySelectorAll('.karte')][3].querySelectorAll('.block').length");
    const zeit = await js("document.querySelectorAll('.zeitstrahl li').length");
    pruefe(fraktionen === 3, `zu wenige Fraktionen werden aufgefuellt (${fraktionen})`);
    pruefe(figuren === 5, `zu wenige Figuren werden aufgefuellt (${figuren})`);
    pruefe(orte === 3, `zu wenige Orte werden aufgefuellt (${orte})`);
    pruefe(zeit === 4, `der Zeitstrahl bekommt die Marken des Umfangs (${zeit})`);

    const gelieferte = await werte(2);
    pruefe(gelieferte.join(' ').includes('Runa Aschfurt'), 'die gelieferten Figuren stehen vorn');

    const geflecht = await werte(4);
    pruefe(geflecht.join(' ').includes('Alte Rechnung'), 'die gelieferte Verbindung ist dabei');
    pruefe(!geflecht.join(' ').includes('Unsinn'), 'die Verbindung ins Leere nicht');
    pruefe(
      await js("Boolean(document.querySelector('.geflecht'))"),
      'und das Geflecht wird gezeichnet'
    );

    pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' | ') || 'keine'})`);

    console.log(
      fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen.` : '\nKI der Inspirationshilfe bestanden.'
    );
    modell.close();
    app.exit(fehler.length ? 1 : 0);
  });
}
