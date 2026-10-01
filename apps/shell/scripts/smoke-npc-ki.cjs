/**
 * Rauchtest der KI im NPC Creator — der ganze Weg, mit einem vorgetaeuschten
 * Anbieter.
 *
 * Vorgetaeuscht ist nur das Modell: ein kleiner HTTP-Server, der sich wie
 * Ollama verhaelt. Alles davor und danach ist echt — die Einstellung der
 * Huelle, der Weg durch den Hauptprozess, das Auswerten der Antwort, die
 * Oberflaeche. Genau dort sitzen die Fehler, die ein Modultest nicht sieht.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-npc-ki.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'npcki-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

/**
 * Was das vorgetaeuschte Modell antwortet.
 *
 * Wird je Pruefung umgesetzt: einmal eine brauchbare Figur, einmal Unsinn,
 * einmal ein Fehler. Die Oberflaeche muss alle drei ueberstehen.
 */
let antwort = { art: 'figur' };

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

  if (antwort.art === 'fehler') {
    ausgabe.writeHead(500, { 'content-type': 'application/json' });
    ausgabe.end('{}');
    return;
  }

  const inhalt =
    antwort.art === 'unsinn'
      ? 'Tut mir leid, dazu faellt mir nichts ein.'
      : JSON.stringify(antwort.json);

  ausgabe.writeHead(200, { 'content-type': 'application/x-ndjson' });
  // Wie Ollama: eine JSON-Zeile je Teilstueck, absichtlich in zwei Haelften,
  // damit auch der Zwischenpuffer einmal wirklich gebraucht wird.
  const mitte = Math.ceil(inhalt.length / 2);
  ausgabe.write(JSON.stringify({ message: { content: inhalt.slice(0, mitte) } }) + '\n');
  ausgabe.write(JSON.stringify({ message: { content: inhalt.slice(mitte) } }) + '\n');
  ausgabe.end();
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
  process.env.TTRPG_TOOLS_START_APP = 'npc';
  require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
  starte(port);
});

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

function starte(port) {
  app.whenReady().then(async () => {
    await warte(5000);
    const fenster = BaseWindow.getAllWindows()[0];
    const sicht = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/npc/'));
    if (!sicht?.webContents) {
      console.log('  FEHL der NPC Creator steht nicht');
      app.exit(1);
      return;
    }
    fenster.setBounds({ x: 0, y: 0, width: 1280, height: 800 });
    await warte(600);
    const js = (a) => sicht.webContents.executeJavaScript(a);

    const konsole = [];
    sicht.webContents.on('console-message', (_e, l, t) => {
      if (l >= 2) konsole.push(t.slice(0, 160));
    });

    const werte = () =>
      js("[...document.querySelectorAll('.zeile__wert')].map(e => e.value)");
    const stoerung = () => js("document.querySelector('.stoerung')?.textContent ?? ''");

    // --- Die Knoepfe sind da, weil eine KI eingerichtet ist ------------------
    pruefe(
      await js("Boolean(document.querySelector('.knopf--ki'))"),
      'bei eingerichteter KI ist der Knopf da'
    );

    await js(
      `[...document.querySelectorAll('button')].find(b => /Neue Figur|New character/.test(b.textContent)).click(); true`
    );
    await warte(300);
    pruefe(
      (await js("document.querySelectorAll('.zeile__ki').length")) === 7,
      'und je Zeile einer'
    );

    // --- Eine ganze Figur von der KI ----------------------------------------
    antwort = {
      art: 'figur',
      json: {
        name: 'Perle vom Kai',
        spezies: 'Seevolk',
        beruf: 'Faehrfrau',
        aussehen: 'Salz in den Brauen',
        motivation: 'will die alte Faehre zurueck',
        geheimnis: 'hat den Kahn nie bezahlt',
        eigenheit: ''
      }
    };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(2500);
    const nachKi = await werte();
    pruefe(nachKi[0] === 'Perle vom Kai', 'die KI fuellt die Felder');
    pruefe(nachKi[2] === 'Faehrfrau', 'und zwar alle, nicht nur das erste');
    pruefe((await stoerung()) === '', 'ohne Stoerung');

    // --- Ein festgehaltenes Feld bleibt stehen ------------------------------
    /*
     * Der wichtigste Punkt. Ohne ihn waere das Schloss beim KI-Knopf
     * wirkungslos — und das faellt erst auf, wenn der gute Name weg ist.
     */
    await js(
      "[...document.querySelectorAll('.zeile')][0].querySelector('.zeile__schloss').click(); true"
    );
    await warte(200);
    antwort = { art: 'figur', json: { name: 'Sollte nicht ankommen', beruf: 'Salzhaendler' } };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(2500);
    const nachSchloss = await werte();
    pruefe(nachSchloss[0] === 'Perle vom Kai', 'ein festgehaltenes Feld bleibt stehen');
    pruefe(nachSchloss[2] === 'Salzhaendler', 'die uebrigen aendern sich');

    // --- Ein einzelnes Feld --------------------------------------------------
    antwort = { art: 'feld', json: { wert: 'weiss, wo die Netze liegen' } };
    await js(
      "[...document.querySelectorAll('.zeile')][5].querySelector('.zeile__ki').click(); true"
    );
    await warte(2500);
    const nachFeld = await werte();
    pruefe(nachFeld[5] === 'weiss, wo die Netze liegen', 'ein einzelnes Feld kommt an');
    pruefe(
      await js("[...document.querySelectorAll('.zeile')][5].classList.contains('zeile--fest')"),
      'und wird dabei festgehalten, wie ein getippter Text'
    );

    // --- Unsinn macht die Figur nicht kaputt ---------------------------------
    antwort = { art: 'unsinn' };
    const vorUnsinn = await werte();
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(2500);
    pruefe(
      JSON.stringify(await werte()) === JSON.stringify(vorUnsinn),
      'eine unbrauchbare Antwort laesst die Figur unangetastet'
    );
    pruefe((await stoerung()).length > 0, 'und sagt, dass etwas nicht ging');
    pruefe(!(await stoerung()).startsWith('error.'), 'mit einem Satz, nicht mit einem Schluessel');

    // --- Ein Fehler des Anbieters --------------------------------------------
    antwort = { art: 'fehler' };
    await js("document.querySelector('.knopf--ki').click(); true");
    await warte(2500);
    pruefe(
      JSON.stringify(await werte()) === JSON.stringify(vorUnsinn),
      'ein Fehler des Anbieters ebenfalls'
    );
    pruefe(!(await stoerung()).startsWith('error.'), 'auch hier steht ein Satz da');

    // --- Im laufenden Betrieb abschalten ------------------------------------
    /*
     * Gemeldet: "Wenn ich in den Einstellungen die KI angeschaltet habe, sehe
     * ich nirgends ein KI Feature." Und umgekehrt beim Abschalten.
     *
     * Die Werkzeuge fragten den Zustand nur beim Laden ab. Wer die
     * Einstellung danach aenderte, sah davon nichts — bis zufaellig etwas
     * anderes ein Neuzeichnen ausloeste, etwa ein Sprachwechsel.
     */
    const huelle = fenster.contentView.children[0];
    const hjs = (a) => huelle.webContents.executeJavaScript(a);

    await hjs("window.shell.einstellungen.schreiben({ ki: { anbieter: 'none', ollamaAdresse: 'x', ollamaModell: 'y', claudeModell: 'z' } })");
    await warte(900);
    pruefe(
      (await js("Boolean(document.querySelector('.knopf--ki'))")) === false,
      'die KI abgeschaltet: die Knoepfe verschwinden ohne weiteres Zutun'
    );

    // --- Und wieder an --------------------------------------------------------
    await hjs(
      `window.shell.einstellungen.schreiben({ ki: { anbieter: 'ollama', ollamaAdresse: 'http://127.0.0.1:${port}', ollamaModell: 'testmodell', claudeModell: 'claude-opus-5' } })`
    );
    await warte(900);
    pruefe(
      (await js("Boolean(document.querySelector('.knopf--ki'))")) === true,
      'und wieder an: sie kommen zurueck'
    );

    pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);

    modell.close();
    console.log(fehler.length === 0 ? '\nKI im NPC Creator bestanden.' : `\n${fehler.length} Fehler.`);
    app.exit(fehler.length === 0 ? 0 : 1);
  });
}
