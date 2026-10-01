/**
 * Rauchtest: der Settlement Generator (docs/ortsgenerator.md).
 *
 * Eine Stadt würfeln, Teile festhalten und neu würfeln, speichern, in der
 * Suche finden, die Läden in den Loot Generator schicken und den Ort als
 * Notizen in den Story Creator legen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-orte.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orte-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'orte', 'backstory', 'loot'] })
);
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 180000);

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const finde = (id) => fenster.contentView.children.find((v) => v.webContents?.getURL().includes(`/apps/${id}/`));
  const oeffneWerkzeug = async (id) => {
    await hjs(`(() => { const s = document.querySelector('[data-schiene="${id}"]'); if (s) { s.click(); return true; }
      const k = document.querySelector('.kachel[data-app="${id}"]:not(:disabled)'); if (k) k.click(); return Boolean(k); })()`);
    const ende = Date.now() + 15000;
    while (Date.now() < ende) {
      const v = finde(id);
      if (v && (await v.webContents.executeJavaScript('document.readyState')) === 'complete') break;
      await warte(200);
    }
    await warte(1500);
    return (a) => finde(id).webContents.executeJavaScript(a);
  };

  // --- Eine Kampagne im Story Creator, damit der Export ein Ziel hat ----------
  const bs = await oeffneWerkzeug('backstory');
  const kampagne = await bs(`(async () => {
    const aus = (a) => (a && 'value' in a ? a.value : a);
    const liste = aus(await window.api.campaigns.list()) ?? [];
    if (liste.length) return liste[0].name;
    return aus(await window.api.campaigns.create('Testrunde')).name; })()`);
  pruefe(Boolean(kampagne), `eine Kampagne steht bereit (${kampagne})`);

  // --- Werkzeug öffnen und eine Stadt würfeln --------------------------------
  await hjs(`document.querySelector('.schiene__heim')?.click(); true`);
  await warte(800);
  const js = await oeffneWerkzeug('orte');
  const sicht = finde('orte');
  pruefe(Boolean(sicht), 'das Werkzeug kommt hoch');
  if (!sicht) {
    app.exit(1);
    return;
  }
  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });
  pruefe(/Settlement Generator/.test(await js('document.body.innerText')), 'mit seiner Überschrift');

  await js(`(() => { const e = document.querySelector('[data-wunsch="groesse"]');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, 'stadt');
    e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await js(`document.querySelector('[data-wuerfeln]').click(); true`);
  await warte(500);
  const name1 = await js(`document.querySelector('[data-feld="name"]')?.value ?? ''`);
  pruefe(name1.length > 3, `ein Ort ist gewürfelt (${name1})`);
  pruefe(/Stadt/.test(await js(`document.querySelector('[data-kurzzeile]').textContent`)), 'als Stadt');
  const laeden = await js(`[...document.querySelectorAll('[data-laden]')].map((e) => e.dataset.laden).join(',')`);
  pruefe(laeden === 'kraemer,schmied,bogner,alchemist,magie', `alle Läden einer Stadt (${laeden})`);
  pruefe(/9/.test(await js(`document.querySelector('[data-zauberdienste]').textContent`)), 'Zauberdienste bis Grad 9 (SRD: nur Stadt)');
  pruefe(/GM/.test(await js(`document.querySelector('[data-laden="schmied"]').textContent`)), 'Waren mit Preisen in GM');

  // Name festhalten, alles neu: der Name bleibt, das Gasthaus nicht unbedingt.
  await js(`document.querySelector('[data-sperre="name"]').click(); true`);
  await warte(150);
  await js(`document.querySelector('[data-alles-neu]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="name"]').value`)) === name1, 'festgehaltener Name bleibt beim Neuwürfeln');
  // Nur das Problem neu: der Name bleibt sowieso.
  const problem1 = await js(`document.querySelector('[data-feld="problem"]').value`);
  // Bis zu fünf Würfe: bei 20 Problemen ist fünfmal dasselbe praktisch ausgeschlossen.
  let problem2 = problem1;
  for (let i = 0; i < 5 && problem2 === problem1; i += 1) {
    await js(`document.querySelector('[data-neu-teil="problem"]').click(); true`);
    await warte(150);
    problem2 = await js(`document.querySelector('[data-feld="problem"]').value`);
  }
  pruefe(problem2 !== problem1, 'ein Teil lässt sich einzeln neu würfeln');
  pruefe((await js(`document.querySelector('[data-feld="name"]').value`)) === name1, 'und der Rest bleibt stehen');

  // Von Hand umbenennen und speichern.
  await js(`(() => { const e = document.querySelector('[data-feld="name"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, 'Rabenfurt');
    e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  pruefe(/Gespeichert/.test(await js(`document.querySelector('[data-meldung]')?.textContent ?? ''`)), 'gespeichert');
  const datei = path.join(userData, 'orte', 'orte', 'rabenfurt.md');
  pruefe(fs.existsSync(datei), 'liegt als Datei in orte/orte');

  // --- Suche der Hülle -------------------------------------------------------
  const eintraege = (await hjs('window.shell.suche.eintraege()')) ?? [];
  pruefe(eintraege.some((e) => e.werkzeug === 'orte' && e.name === 'Rabenfurt'), 'Strg+K kennt Rabenfurt');

  // --- Läden in den Loot Generator ---------------------------------------------
  await js(`document.querySelector('[data-loot]').click(); true`);
  await warte(900);
  pruefe(/Loot/.test(await js(`document.querySelector('[data-meldung]')?.textContent ?? ''`)), 'Läden in den Loot Generator geschickt');

  // --- Als Notizen in den Story Creator ----------------------------------------
  await js(`document.querySelector('[data-story]').click(); true`);
  await warte(1500);
  const meldung = await js(`(document.querySelector('[data-meldung]')?.textContent ?? '') + (document.querySelector('[data-fehler]')?.textContent ?? '')`);
  pruefe(/Angelegt/.test(meldung), `in den Story Creator angelegt (${meldung})`);
  const vault = path.join(userData, 'backstory', 'vault');
  const dateien = [];
  const suche = (o) => {
    for (const e of fs.readdirSync(o, { withFileTypes: true })) {
      const p = path.join(o, e.name);
      if (e.isDirectory()) suche(p);
      else if (e.name.endsWith('.md')) dateien.push(p);
    }
  };
  try {
    suche(vault);
  } catch {
    // kein Vault
  }
  const texte = dateien.map((p) => fs.readFileSync(p, 'utf8'));
  pruefe(texte.some((t) => /Rabenfurt/.test(t) && /## Läden/.test(t)), 'die Ortsnotiz liegt im Vault, mit Läden');
  pruefe(texte.filter((t) => /\[\[Rabenfurt\]\]/.test(t)).length >= 5, 'Gasthaus, Läden und Personen verweisen auf den Ort');

  // --- Loot Generator: die Läden als Tabellen -----------------------------------
  const loot = await oeffneWerkzeug('loot');
  const tabellen = await loot(`[...document.querySelectorAll('[data-id^="mi-ort-"]')].length`);
  pruefe(tabellen === 5, `Loot Generator: fünf Ladentabellen (${tabellen})`);

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length === 0 ? '\nSettlement Generator bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
