/**
 * Rauchtest: die KI im Settlement Generator, gegen ein nachgebautes Ollama.
 *
 * Geprüft: „KI fragen" schreibt Name, Gerüchte und Gasthaus; ein
 * festgehaltener Name bleibt; ✦ an einem Teil schreibt nur dieses Teil.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-orte-ki.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orteki-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

let antwort = {};
let letzteFrage = '';
const modell = http.createServer((anfrage, ausgabe) => {
  if (anfrage.url.startsWith('/api/tags')) {
    ausgabe.writeHead(200, { 'content-type': 'application/json' });
    ausgabe.end(JSON.stringify({ models: [{ name: 'testmodell:latest' }] }));
    return;
  }
  let koerper = '';
  anfrage.on('data', (d) => (koerper += d));
  anfrage.on('end', () => {
    letzteFrage = koerper;
    ausgabe.writeHead(200, { 'content-type': 'application/x-ndjson' });
    ausgabe.write(JSON.stringify({ message: { content: JSON.stringify(antwort) } }) + '\n');
    ausgabe.end();
  });
});

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

modell.listen(0, '127.0.0.1', () => {
  const port = modell.address().port;
  fs.writeFileSync(
    path.join(userData, 'einstellungen.json'),
    JSON.stringify({
      language: 'de',
      einfuehrungGesehen: ['suite', 'orte'],
      ki: { anbieter: 'ollama', ollamaAdresse: `http://127.0.0.1:${port}`, ollamaModell: 'testmodell', claudeModell: 'x' },
      claudeSchluessel: ''
    })
  );
  app.setPath('userData', userData);
  process.env.TTRPG_TOOLS_START_APP = 'orte';
  require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

  app.whenReady().then(async () => {
    await warte(5000);
    const fenster = BaseWindow.getAllWindows()[0];
    const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/orte/'));
    if (!sicht) {
      console.log('  FEHL das Werkzeug kommt nicht hoch');
      app.exit(1);
      return;
    }
    const js = (a) => sicht.webContents.executeJavaScript(a);
    const bis = async (f, ms = 6000) => {
      const ende = Date.now() + ms;
      while (!(await f())) {
        if (Date.now() > ende) return false;
        await warte(100);
      }
      return true;
    };
    const konsole = [];
    sicht.webContents.on('console-message', (_e, l, t) => {
      if (l >= 2) konsole.push(t.slice(0, 160));
    });

    await js(`document.querySelector('[data-wuerfeln]').click(); true`);
    pruefe(await bis(() => js(`Boolean(document.querySelector('[data-ki]'))`)), 'mit eingerichteter KI steht „KI fragen" da');
    const alterName = await js(`document.querySelector('[data-feld="name"]').value`);

    // --- Ganzer Ort, Name festgehalten --------------------------------------------
    await js(`document.querySelector('[data-sperre="name"]').click(); true`);
    await js(`(() => { const e = document.querySelector('[data-ki-wunsch]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, 'Fischerdorf mit Geheimnis');
      e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    antwort = {
      herrschaft: 'Die Hafenmeisterin entscheidet alles.',
      wirtschaft: 'Hering und Salz.',
      besonderheit: 'Ein Leuchtturm ohne Licht.',
      problem: 'Boote kehren leer zurück.',
      geruechte: [{ text: 'Im Leuchtturm wohnt jemand.', wahr: true }],
      gasthaus: { name: 'Zum Salzfass', spezialitaet: 'Fischsuppe' }
    };
    await js(`document.querySelector('[data-ki]').click(); true`);
    pruefe(await bis(async () => (await js(`document.querySelector('[data-feld="herrschaft"]').value`)) === 'Die Hafenmeisterin entscheidet alles.'), 'die KI schreibt die Herrschaft');
    pruefe((await js(`document.querySelector('[data-feld="gasthaus"]').value`)) === 'Zum Salzfass', 'und das Gasthaus');
    pruefe(/Im Leuchtturm wohnt jemand/.test(await js(`document.body.innerText`)), 'und die Gerüchte');
    pruefe((await js(`document.querySelector('[data-feld="name"]').value`)) === alterName, 'der festgehaltene Name bleibt');
    pruefe(/Fischerdorf mit Geheimnis/.test(letzteFrage) && !/\\"name\\": Name/.test(letzteFrage), 'der Wunsch geht mit, der Name wird nicht gefragt');

    // --- Ein Teil ----------------------------------------------------------------
    antwort = { problem: 'Ein Seeungeheuer frisst die Netze.' };
    await js(`document.querySelector('[data-ki-feld="problem"]').click(); true`);
    pruefe(await bis(async () => (await js(`document.querySelector('[data-feld="problem"]').value`)) === 'Ein Seeungeheuer frisst die Netze.'), '✦ am Problem schreibt nur das Problem');
    pruefe((await js(`document.querySelector('[data-feld="herrschaft"]').value`)) === 'Die Hafenmeisterin entscheidet alles.', 'die Herrschaft bleibt dabei');

    pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
    modell.close();
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    console.log(fehler.length === 0 ? '\nSettlement mit KI bestanden.' : `\n${fehler.length} Fehler.`);
    app.exit(fehler.length === 0 ? 0 : 1);
  });
});
