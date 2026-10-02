/**
 * Rauchtest: der Homebrew Creator (docs/homebrew-creator.md).
 *
 * Kachel anklicken, eine Waffe und eine Ruestung bauen, die Eichung
 * beobachten, speichern, die Datei pruefen, in der Liste und in der Suche
 * der Huelle wiederfinden.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-homebrew.cjs --no-sandbox
 */
const { app, BaseWindow, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'homebrew-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'homebrew', 'magicitems'] }));
// Ein magischer Eintrag von früher, noch in der eigenen Ablage: zieht beim Start in die gemeinsame um.
fs.mkdirSync(path.join(userData, 'homebrew', 'eintraege'), { recursive: true });
fs.writeFileSync(
  path.join(userData, 'homebrew', 'eintraege', 'altring.md'),
  `# Altring\n\n\`\`\`homebrew\n${JSON.stringify({ art: 'magisch', name: 'Altring', gegenstandsart: 'ring', seltenheit: 'rare', einstimmung: true, wirkungen: ['Leuchtet schwach.'], fluch: '', beschreibung: 'Von früher.', preis: 1234, gewicht: null, bild: null, geaendert: '2026-01-01T00:00:00Z' })}\n\`\`\`\n`
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
  const magieOrdner = path.join(userData, 'magicitems', 'gegenstaende');
  pruefe(
    fs.existsSync(path.join(magieOrdner, 'altring.md')) && !fs.existsSync(path.join(userData, 'homebrew', 'eintraege', 'altring.md')),
    'ein alter magischer Eintrag ist in die gemeinsame Ablage umgezogen'
  );
  pruefe(/wert: 1234/.test(fs.readFileSync(path.join(magieOrdner, 'altring.md'), 'utf8')), 'mit seinem Preis als Wert');

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
  await tippe('schadenAnzahl', '2');
  await warte(200);
  pruefe((await urteil()) === 'weit_ueber', '2W8: deutlich staerker als jede SRD-Kriegswaffe');
  await tippe('schadenAnzahl', '1');
  await js(`document.querySelector('[data-eigenschaft="leicht"]').click(); document.querySelector('[data-eigenschaft="zweihaendig"]').click(); true`);
  await warte(200);
  pruefe(await js(`Boolean(document.querySelector('[data-befund="warnung"]'))`), 'leicht und zweihaendig: eine Warnung');
  await js(`document.querySelector('[data-eigenschaft="leicht"]').click(); document.querySelector('[data-eigenschaft="zweihaendig"]').click(); true`);
  await waehle('bonus', '2');

  // Neu: Schaden aufgeteilt, zweite Schadenszeile, Reichweite, Erklärungen, zuklappbar.
  pruefe(/Angriff und Schaden/.test(await js(`document.querySelector('[data-eigenschaft="finesse"]').title`)), 'Eigenschaften erklären sich beim Darüberfahren');
  pruefe((await js(`document.querySelector('[data-eigenschaft-texte]')?.textContent ?? ''`)).includes('Vielseitig'), 'gewählte Eigenschaften stehen mit einem Satz darunter');
  pruefe((await js(`document.querySelector('[data-meisterschaft-text]').textContent`)).length > 20, 'die Meisterschaft hat einen Satz');
  await js(`document.querySelector('[data-zusatz-dazu]').click(); true`);
  await warte(200);
  await waehle('zusatz0Art', 'blitz');
  await tippe('schadenPlus', '1');
  await warte(200);
  pruefe((await js(`document.querySelector('select[data-feld="zusatz0Art"]')?.value ?? ''`)) === 'blitz', 'eine zweite Schadenszeile (gemischter Schaden)');
  pruefe((await urteil()) !== 'im_rahmen', 'Plus und Zusatzschaden fließen in die Eichung');
  await js(`document.querySelector('[data-zusatz="0"] button').click(); true`);
  await tippe('schadenPlus', '0');
  await js(`document.querySelector('[data-eigenschaft="reichweite"]').click(); true`);
  await warte(200);
  pruefe((await js(`document.querySelector('[data-feld="reichweiteNah"]').value`)) === '10', '„Weitreichend" setzt die Reichweite auf 10 Fuß');
  await js(`document.querySelector('[data-eigenschaft="reichweite"]').click(); true`);
  // Rückmeldung: „10" tippen, ohne dass die „1" sofort zur 5 wird; begrenzt wird erst beim Verlassen.
  await js(`document.querySelector('[data-feld="reichweiteNah"]').focus(); true`);
  await tippe('reichweiteNah', '1');
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="reichweiteNah"]').value`)) === '1', 'beim Tippen bleibt die 1 stehen');
  await tippe('reichweiteNah', '10');
  await js(`document.querySelector('[data-feld="reichweiteNah"]').blur(); true`);
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="reichweiteNah"]').value`)) === '10', 'und „10" kommt an');
  await js(`document.querySelector('[data-feld="reichweiteNah"]').focus(); true`);
  await tippe('reichweiteNah', '2');
  await js(`document.querySelector('[data-feld="reichweiteNah"]').blur(); true`);
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="reichweiteNah"]').value`)) === '5', 'erst beim Verlassen wird auf mindestens 5 begrenzt');
  pruefe((await js(`document.querySelectorAll('[data-abschnitt="grund"] [data-feld="fern"], [data-abschnitt="grund"] [data-feld="fernReichweite"]').length`)) === 0, 'Nah/Fern steht nur noch unter Reichweite');
  pruefe((await js(`document.querySelectorAll('[data-feld="fernReichweite"]').length`)) >= 1, 'dort ist die Wahl weiter da');
  await js(`document.querySelector('[data-abschnitt="schaden"] summary').click(); true`);
  await warte(150);
  pruefe(!(await js(`document.querySelector('[data-abschnitt="schaden"]').open`)), 'der Abschnitt „Schaden" klappt zu');
  await js(`document.querySelector('[data-abschnitt="schaden"] summary').click(); true`);
  // Ein Bild: ein kleines Canvas als PNG, ueber das Dateifeld wie von Hand gewaehlt.
  await js(`(async () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 20);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'klinge.png', { type: 'image/png' }));
    const e = document.querySelector('[data-bild-datei]'); e.files = dt.files;
    e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await warte(800);
  pruefe(await js(`Boolean(document.querySelector('[data-bild] img'))`), 'ein Bild ist gewaehlt');
  await warte(200);
  pruefe(/Selten/.test(await js(`document.querySelector('[data-eichung-seltenheit]')?.textContent ?? ''`)), 'Bonus +2: Seltenheit selten (SRD)');
  // Strg+S aus einem Textfeld heraus speichert (Rückmeldung).
  await js(`(() => { const e = document.querySelector('[data-feld="name"]'); e.focus();
    e.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); return true; })()`);
  await warte(800);
  pruefe(/Gespeichert/.test(await js(`document.querySelector('[data-meldung]')?.textContent ?? ''`)), 'Strg+S speichert');
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
  // Strg+S: der Speichern-Knopf pulsiert kurz (Rückmeldung).
  await js(`document.activeElement?.blur?.(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); true`);
  pruefe(await js(`document.querySelector('[data-speichern]').classList.contains('suite-gespeichert')`), 'Strg+S: der Speichern-Knopf zeigt eine Animation');
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(400);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 3, 'drei Kacheln in der Sammlung (mit dem Altring)');
  await js(`document.querySelector('[data-filter="ruestung"]').click(); true`);
  await warte(200);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 1, 'Filter Ruestung: eine Kachel');
  await js(`document.querySelector('[data-filter="alle"]').click(); true`);

  // --- Zauber ------------------------------------------------------------------
  await js(`document.querySelector('[data-neu="zauber"]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-zauber]'))`), 'Neu: Zauber oeffnet die Zauberfelder');
  pruefe(!(await js(`Boolean(document.querySelector('[data-feld="preis"]'))`)), 'ein Zauber hat keinen Preis');
  await tippe('name', 'Glutregen');
  await waehle('grad', '3');
  await waehle('ziel', 'flaeche');
  await tippe('schadenAnzahl', '8');
  await waehle('schadenSeiten', '6');
  await waehle('rettungswurf', 'ges');
  await warte(200);
  pruefe((await urteil()) === 'im_rahmen', 'Grad 3, Flaeche, 8W6: im Rahmen');
  pruefe(/Feuerball/.test(await js(`document.querySelector('[data-eichung-satz]').textContent`)), 'und nennt den Feuerball als Vergleich');
  pruefe(await js(`Boolean(document.querySelector('[data-befund="hinweis"]'))`), 'ohne halben Schaden bei Erfolg: ein Hinweis');
  await js(`document.querySelector('[data-feld="halbBeiErfolg"]').click(); true`);
  await tippe('schadenAnzahl', '14');
  await warte(200);
  pruefe((await urteil()) === 'weit_ueber', '14W6 auf Grad 3: deutlich staerker');
  await tippe('schadenAnzahl', '8');
  await js(`document.querySelector('[data-klasse="magier"]').click(); true`);
  pruefe((await js(`document.querySelector('[data-schule-text]').textContent`)).length > 10, 'die Schule hat einen erklärenden Satz');
  await waehle('zeitWahl', 'Bonusaktion');
  await waehle('komponentenWahl', '\u0000');
  await warte(150);
  await tippe('komponenten', 'V, G, M (ein Stück Kohle)');
  await tippe('eigeneKlassen', 'Blutjäger, Artificer');
  await tippe('unterklassen', 'Kleriker: Schmiededomäne');
  await js(`document.querySelector('[data-wirkung-art="zustand"]').click(); true`);
  await warte(150);
  await waehle('zustandWahl', 'Liegend');
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  const zdatei = path.join(userData, 'homebrew', 'eintraege', 'glutregen.md');
  const zinhalt = fs.existsSync(zdatei) ? fs.readFileSync(zdatei, 'utf8') : '';
  pruefe(/"grad": 3/.test(zinhalt) && /"schadenAnzahl": 8/.test(zinhalt) && /"magier"/.test(zinhalt), 'der Zauber liegt mit seinen Werten in der Datei');
  pruefe(
    /"zeit": "Bonusaktion"/.test(zinhalt) && /Stück Kohle/.test(zinhalt) && /Blutjäger/.test(zinhalt) && /Schmiededomäne/.test(zinhalt) && /"zustand": "Liegend"/.test(zinhalt),
    'Auswahl, freier Text, eigene Klassen, Unterklasse und Zustand sind gespeichert'
  );
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(400);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 4, 'vier Kacheln in der Sammlung');

  // --- Magischer Gegenstand ------------------------------------------------------
  await js(`document.querySelector('[data-neu="magisch"]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-magisch]'))`), 'Neu: magischer Gegenstand oeffnet seine Felder');
  pruefe(
    await js(`Boolean(document.querySelector('[data-magisch] [data-magiefelder] [data-wirkung-neu="0"]') && document.querySelector('[data-fluch-wuerfeln]'))`),
    'dasselbe Formular wie im Generator: Würfel je Wirkung und für den Fluch'
  );
  await tippe('name', 'Glutamulett');
  const wirkung = (i, text) =>
    js(`(() => { const e = document.querySelector('[data-wirkung="${i}"]');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(e, ${JSON.stringify('x')}.replace('x', ${JSON.stringify(text)}));
      e.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await wirkung(0, 'Du erhältst +1 Bonus auf Angriffswürfe.');
  await warte(200);
  pruefe((await urteil()) === 'im_rahmen', 'ungewoehnlich, +1: im Rahmen');
  await wirkung(0, 'Du erhältst +3 Bonus auf Angriffswürfe.');
  await warte(200);
  pruefe((await urteil()) === 'ueber' && (await js(`Boolean(document.querySelector('[data-befund="warnung"]'))`)), 'ungewoehnlich, +3: ueber der Grenze, mit Warnung');
  await waehle('seltenheit', 'veryRare');
  await warte(200);
  pruefe((await urteil()) === 'im_rahmen', 'sehr selten, +3: im Rahmen');
  await js(`document.querySelector('[data-speichern]').click(); true`);
  await warte(800);
  const ziel = path.join(tmp, 'glutamulett.json');
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: ziel });
  await js(`document.querySelector('[data-foundry]').click(); true`);
  await warte(800);
  const foundry = fs.existsSync(ziel) ? JSON.parse(fs.readFileSync(ziel, 'utf8')) : null;
  pruefe(foundry?.name === 'Glutamulett' && foundry?.system?.rarity === 'veryRare', 'Foundry-Export: JSON mit Name und Seltenheit');
  await js(`document.querySelector('[data-zurueck]').click(); true`);
  await warte(400);
  pruefe((await js(`document.querySelectorAll('.hbkachel').length`)) === 5, 'fünf Kacheln in der Sammlung');
  pruefe(fs.existsSync(path.join(magieOrdner, 'glutamulett.md')), 'das Glutamulett liegt in der gemeinsamen Ablage');

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
  // Eine Sammlung: was der Homebrew Creator an magischen Gegenständen hat, steht auch im Generator.
  const mig = await oeffneWerkzeug('magicitems');
  pruefe(
    await mig(`Boolean(document.querySelector('[data-id="glutamulett"]') && document.querySelector('[data-id="altring"]'))`),
    'Magic Item Generator: Glutamulett und Altring stehen auch dort'
  );
  const nsw = await oeffneWerkzeug('nachschlagewerk');
  pruefe(await nsw(`Boolean(document.querySelector('[data-regel="homebrew/sturmklinge"]'))`), 'Nachschlagewerk: die Sturmklinge steht unter Homebrew');
  await nsw(`document.querySelector('[data-regel="homebrew/sturmklinge"]')?.click(); true`);
  await warte(500);
  pruefe(await nsw(`Boolean(document.querySelector('[data-regel-bild]'))`), 'Nachschlagewerk: mit ihrem Bild');
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
  await cb(`(() => { const k = [...document.querySelectorAll('[data-gegenstand-titel]')].find((e) => /Sturmklinge/.test(e.textContent)); k?.click(); return Boolean(k); })()`);
  await warte(400);
  pruefe(await cb(`Boolean(document.querySelector('[data-gegenstand-bild]'))`), 'Charakterbogen: die Iteminfo zeigt ihr Bild');
  pruefe(/1d8\+2 Hieb/.test(schaden), `ausgerüstet wird sie zum Angriff: 1W8+2 Hieb (${schaden})`);

  // Der eigene Zauber steht in der Zaubersuche des Bogens.
  await cb(`document.querySelector('[data-zauber-an]')?.click(); true`);
  await warte(400);
  await cb(`document.querySelector('[data-zauber-suchen]')?.click(); true`);
  let zda = false;
  for (let i = 0; i < 30 && !zda; i += 1) {
    zda = await cb(`Boolean(document.querySelector('[data-zauber-dazu-eigen="glutregen"]'))`);
    if (!zda) await warte(200);
  }
  pruefe(zda, 'Charakterbogen: der Glutregen steht in der Zaubersuche');
  if (zda) {
    await cb(`document.querySelector('[data-zauber-dazu-eigen="glutregen"]').click(); true`);
    await warte(300);
    pruefe(/Glutregen/.test(await cb(`document.querySelector('.zauberliste, [data-zauberliste]')?.textContent ?? document.body.innerText`)), 'und landet in der Zauberliste');
  }

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  console.log(fehler.length === 0 ? '\nHomebrew Creator bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
