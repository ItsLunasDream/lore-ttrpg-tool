/**
 * Rauchtest: der Homebrew Creator (docs/homebrew-creator.md).
 *
 * Kachel anklicken, eine Waffe und eine Ruestung bauen, die Eichung
 * beobachten, speichern, die Datei pruefen, in der Liste und in der Suche
 * der Huelle wiederfinden.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-homebrew.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'homebrew-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'homebrew'] }));

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
}, 150000);

app.whenReady().then(async () => {
  await warte(4500);
  const fenster = BaseWindow.getAllWindows()[0];
  if (!fenster) {
    console.log('  FEHL kein Fenster');
    app.exit(1);
    return;
  }
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 860 });
  const huelle = fenster.contentView.children[0];
  const hjs = (a) => huelle.webContents.executeJavaScript(a);

  await hjs(`(() => { const k = document.querySelector('.kachel[data-app="homebrew"]:not(:disabled)'); if (k) k.click(); return Boolean(k); })()`);
  await warte(5000);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/homebrew/'));
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
  pruefe(/Homebrew Creator/.test(await js('document.body.innerText')), 'mit seiner Ueberschrift');

  const tippe = (feld, wert) =>
    js(`(() => { const e = document.querySelector('[data-feld="${feld}"]');
      const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, ${JSON.stringify(wert)});
      e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const waehle = (feld, wert) =>
    js(`(() => { const e = document.querySelector('select[data-feld="${feld}"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
      e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const urteil = () => js(`document.querySelector('[data-urteil]')?.dataset.urteil ?? ''`);

  // --- Waffe -------------------------------------------------------------------
  await js(`document.querySelector('[data-neu="waffe"]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-waffe]'))`), 'Neu: Waffe oeffnet die Waffenfelder');
  await tippe('name', 'Sturmklinge');
  await js(`document.querySelector('[data-eigenschaft="vielseitig"]').click(); true`);
  await warte(200);
  pruefe((await urteil()) === 'im_rahmen', 'Kriegswaffe 1W8, vielseitig 1W10: im Rahmen (wie das Langschwert)');
  pruefe(/Langschwert/.test(await js(`document.querySelector('[data-eichung-satz]').textContent`)), 'und nennt das Langschwert als Vergleich');
  await waehle('wuerfel', '2d8');
  await warte(200);
  pruefe((await urteil()) === 'weit_ueber', '2W8: deutlich staerker als jede SRD-Kriegswaffe');
  await waehle('wuerfel', '1d8');
  await js(`document.querySelector('[data-eigenschaft="leicht"]').click(); document.querySelector('[data-eigenschaft="zweihaendig"]').click(); true`);
  await warte(200);
  pruefe(await js(`Boolean(document.querySelector('[data-befund="warnung"]'))`), 'leicht und zweihaendig: eine Warnung');
  await js(`document.querySelector('[data-eigenschaft="leicht"]').click(); document.querySelector('[data-eigenschaft="zweihaendig"]').click(); true`);
  await waehle('bonus', '2');
  await warte(200);
  pruefe(/Selten/.test(await js(`document.querySelector('[data-eichung-seltenheit]')?.textContent ?? ''`)), 'Bonus +2: Seltenheit selten (SRD)');
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  pruefe(/Gespeichert/.test(await js(`document.querySelector('[data-meldung]')?.textContent ?? ''`)), 'gespeichert');
  const ordner = path.join(userData, 'homebrew', 'eintraege');
  const datei = path.join(ordner, 'sturmklinge.md');
  pruefe(fs.existsSync(datei), 'liegt als Datei in homebrew/eintraege');
  const inhalt = fs.existsSync(datei) ? fs.readFileSync(datei, 'utf8') : '';
  pruefe(/^# Sturmklinge/m.test(inhalt) && /"wuerfel": "1d8"/.test(inhalt) && /"bonus": 2/.test(inhalt), 'lesbar und mit den Werten im JSON-Block');

  // --- Ruestung ----------------------------------------------------------------
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(300);
  await js(`document.querySelector('[data-neu="ruestung"]').click(); true`);
  await warte(300);
  await tippe('name', 'Drachenschuppen');
  await waehle('ruestungsart', 'schwer');
  await tippe('rk', '21');
  await warte(200);
  pruefe((await urteil()) === 'weit_ueber', 'schwere Ruestung RK 21: deutlich ueber dem SRD (hoechstens 18)');
  await tippe('rk', '18');
  await tippe('staerke', '15');
  await js(`document.querySelector('[data-feld="heimlichkeit"]').click(); true`);
  await tippe('preis', '1500');
  await warte(200);
  pruefe((await urteil()) === 'im_rahmen', 'RK 18, Staerke 15, Nachteil, 1500 GM: wie die Ritterruestung');
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(400);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 2, 'zwei Kacheln in der Sammlung');
  await js(`document.querySelector('[data-filter="ruestung"]').click(); true`);
  await warte(200);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 1, 'Filter Ruestung: eine Kachel');
  await js(`document.querySelector('[data-filter="alle"]').click(); true`);

  // --- Suche der Huelle ----------------------------------------------------------
  const eintraege = (await hjs('window.shell.suche.eintraege()')) ?? [];
  pruefe(eintraege.some((e) => e.werkzeug === 'homebrew' && e.name === 'Sturmklinge'), 'Strg+K kennt die Sturmklinge');
  await hjs(`window.shell.suche.zeige('homebrew', 'sturmklinge')`);
  await warte(600);
  pruefe((await js(`document.querySelector('[data-feld="name"]')?.value ?? ''`)) === 'Sturmklinge', 'ein Treffer oeffnet den Eintrag');

  // --- Anbindung (docs/homebrew-creator.md, „Wohin die Ergebnisse gehen") ---------
  await js(`document.querySelector('[data-loot]').click(); true`);
  await warte(800);
  pruefe(/Loot/.test(await js(`document.querySelector('[data-meldung]')?.textContent ?? ''`)), 'In den Loot Generator geschickt');
  const finde = (id) => fenster.contentView.children.find((v) => v.webContents?.getURL().includes(`/apps/${id}/`));
  const oeffneWerkzeug = async (id) => {
    await hjs(`document.querySelector('[data-schiene="${id}"]').click(); true`);
    const ende = Date.now() + 15000;
    while (Date.now() < ende) {
      const v = finde(id);
      if (v && (await v.webContents.executeJavaScript('document.readyState')) === 'complete') break;
      await warte(200);
    }
    await warte(1500);
    return (a) => finde(id).webContents.executeJavaScript(a);
  };
  const loot = await oeffneWerkzeug('loot');
  pruefe(await loot(`Boolean(document.querySelector('[data-id="mi-homebrew"]'))`), 'Loot Generator: Tabelle „Homebrew"');
  const nsw = await oeffneWerkzeug('nachschlagewerk');
  pruefe(await nsw(`Boolean(document.querySelector('[data-regel="homebrew/sturmklinge"]'))`), 'Nachschlagewerk: die Sturmklinge steht unter Homebrew');
  const cb = await oeffneWerkzeug('charakterbogen');
  await cb(`window.confirm = () => true; document.querySelector('[data-neu]').click(); true`);
  await warte(900);
  await cb(`document.querySelector('[data-aus-quelle]').click(); true`);
  await warte(300);
  await cb(`document.querySelector('[data-quelle-reiter="eigene"]').click(); true`);
  let da = false;
  for (let i = 0; i < 30 && !da; i += 1) {
    da = await cb(`Boolean(document.querySelector('[data-quelle-dazu="sturmklinge"]'))`);
    if (!da) await warte(200);
  }
  pruefe(da, 'Charakterbogen: die Sturmklinge steht unter „Eigene"');
  await cb(`document.querySelector('[data-quelle-dazu="sturmklinge"]').click(); true`);
  await warte(300);
  // Ausruesten: dann wird sie zum Angriff, gerechnet mit ihren eigenen Werten.
  await cb(`(() => { const k = document.querySelector('[data-ausgeruestet]'); if (k && !k.checked) k.click(); return true; })()`);
  await warte(400);
  // Neue Figur: alle Attribute 10, also nur der magische Bonus +2.
  const schaden = await cb(`[...document.querySelectorAll('[data-angriff-schaden]')].map((e) => e.textContent.trim()).join('|')`);
  pruefe(/1d8\+2 Hieb/.test(schaden), `ausgerüstet wird sie zum Angriff: 1W8+2 Hieb (${schaden})`);

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fehler.length === 0 ? '\nHomebrew Creator bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
