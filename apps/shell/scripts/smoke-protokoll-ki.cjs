/**
 * Rauchtest: KI-Zusammenfassung im Sitzungsprotokoll, gegen ein
 * nachgebautes Ollama. Der Vorschlag landet im Feld „Zusammenfassung",
 * nicht direkt in der Notiz; die Anfrage enthält den Verlauf.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-protokoll-ki.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'protokollki-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

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
    ausgabe.write(JSON.stringify({ message: { content: 'Die Gruppe verbündete sich mit den Schmugglern.' } }) + '\n');
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
      einfuehrungGesehen: ['suite'],
      ki: { anbieter: 'ollama', ollamaAdresse: `http://127.0.0.1:${port}`, ollamaModell: 'testmodell', claudeModell: 'x' },
      claudeSchluessel: ''
    })
  );
  app.setPath('userData', userData);
  require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

  app.whenReady().then(async () => {
    await warte(4500);
    const fenster = BaseWindow.getAllWindows()[0];
    const huelle = fenster.contentView.children[0];
    const hjs = (a) => huelle.webContents.executeJavaScript(a);
    const bis = async (f, ms = 6000) => {
      const ende = Date.now() + ms;
      while (!(await f())) {
        if (Date.now() > ende) return false;
        await warte(100);
      }
      return true;
    };
    await hjs(`(async () => { await window.shell.protokoll.start(); await window.shell.protokoll.hand('Die Gruppe trifft die Schmuggler'); await window.shell.protokoll.stopp(); return true; })()`);
    await hjs(`document.querySelector('[data-protokoll-knopf]').click(); true`);
    pruefe(await bis(() => hjs(`Boolean(document.querySelector('[data-protokoll-ki]'))`)), 'mit eingerichteter KI steht der Knopf in der Vorschau');
    await hjs(`document.querySelector('[data-protokoll-ki]').click(); true`);
    pruefe(
      await bis(async () => (await hjs(`document.querySelector('[data-protokoll-zusammenfassung]').value`)) === 'Die Gruppe verbündete sich mit den Schmugglern.'),
      'der Vorschlag steht im Feld „Zusammenfassung"'
    );
    pruefe(/Schmuggler/.test(letzteFrage), 'die Anfrage enthält den Verlauf');
    pruefe(/Ein Pen|Pen-&-Paper|zusammen/.test(letzteFrage), 'mit Anweisung');
    modell.close();
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(fehler.length === 0 ? '\nProtokoll mit KI bestanden.' : `\n${fehler.length} Fehler.`);
    app.exit(fehler.length === 0 ? 0 : 1);
  });
});
