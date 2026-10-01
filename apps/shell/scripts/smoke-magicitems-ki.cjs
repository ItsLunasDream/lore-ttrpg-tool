/**
 * Rauchtest: die KI im Magic Item Generator, gegen ein nachgebautes Ollama.
 *
 * Geprueft: der ganze Gegenstand von der KI, die Pruefung an der Seltenheit
 * (ein zu hoher Bonus wird gezogen und gemeldet), eine einzelne Wirkung und
 * ein Fluch von der KI.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-magicitems-ki.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'miki-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

let antwort = {};
const modell = http.createServer((anfrage, ausgabe) => {
  if (anfrage.url.startsWith('/api/tags')) {
    ausgabe.writeHead(200, { 'content-type': 'application/json' });
    ausgabe.end(JSON.stringify({ models: [{ name: 'testmodell:latest' }] }));
    return;
  }
  const inhalt = JSON.stringify(antwort);
  ausgabe.writeHead(200, { 'content-type': 'application/x-ndjson' });
  ausgabe.write(JSON.stringify({ message: { content: inhalt } }) + '\n');
  ausgabe.end();
});

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

modell.listen(0, '127.0.0.1', () => {
  const port = modell.address().port;
  fs.writeFileSync(
    path.join(userData, 'einstellungen.json'),
    JSON.stringify({
      language: 'en',
      einfuehrungGesehen: ['suite', 'magicitems'],
      ki: { anbieter: 'ollama', ollamaAdresse: `http://127.0.0.1:${port}`, ollamaModell: 'testmodell', claudeModell: 'x' },
      claudeSchluessel: ''
    })
  );
  app.setPath('userData', userData);
  process.env.TTRPG_TOOLS_START_APP = 'magicitems';
  require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

  app.whenReady().then(async () => {
    await warte(5000);
    const fenster = BaseWindow.getAllWindows()[0];
    const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/magicitems/'));
    if (!sicht) {
      console.log('  FEHL das Werkzeug kommt nicht hoch');
      app.exit(1);
      return;
    }
    const js = (a) => sicht.webContents.executeJavaScript(a);
    const bis = async (f, ms = 5000) => {
      const ende = Date.now() + ms;
      while (!(await f())) {
        if (Date.now() > ende) return false;
        await warte(100);
      }
      return true;
    };
    const waehle = (was, wert) => js(`(() => { const el = document.querySelector('select[data-erzeuger="${was}"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, '${wert}');
      el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);

    pruefe(await bis(() => js("Boolean(document.querySelector('[data-ki]'))")), 'mit eingerichteter KI steht der KI-Knopf da');
    await waehle('art', 'waffe');
    await waehle('seltenheit', 'uncommon');
    antwort = { name: 'Frostzahn', wirkungen: ['You gain a +3 bonus to attack rolls made with this weapon.'], fluch: '', einstimmung: false };
    await js("document.querySelector('[data-ki]').click(); true");
    pruefe(
      await bis(async () => (await js("document.querySelector('[data-feld=\"name\"]')?.value ?? ''")) === 'Frostzahn'),
      'der ganze Gegenstand kommt von der KI'
    );
    pruefe(
      /\+1 bonus/.test(await js("document.querySelector('textarea[data-wirkung]')?.value ?? ''")),
      'ein zu hoher Bonus wird auf die Seltenheit gezogen'
    );
    pruefe(await js("Boolean(document.querySelector('[data-ki-berichtigt]'))"), 'und die Oberflaeche sagt es');

    antwort = { text: 'The blade whispers the name of anyone it wounds.' };
    await js("document.querySelector('[data-wirkung-ki-neu]').click(); true");
    pruefe(
      await bis(async () => (await js("[...document.querySelectorAll('textarea[data-wirkung]')].map(e => e.value).join('|')")).includes('whispers')),
      'eine weitere Wirkung kommt von der KI'
    );
    antwort = { text: 'Curse: You cannot lie while holding it.' };
    await js("document.querySelector('[data-fluch-ki]').click(); true");
    pruefe(
      await bis(async () => /cannot lie/.test(await js("document.querySelector('.fluch textarea').value"))),
      'ein Fluch kommt von der KI'
    );

    console.log(fehler.length === 0 ? '\nMagic Items mit KI bestanden.' : `\n${fehler.length} Fehler.`);
    modell.close();
    app.exit(fehler.length === 0 ? 0 : 1);
  });
});
