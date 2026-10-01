/**
 * Rauchtest: der Charakterbogen.
 *
 * Der Weg, den die Modultests nicht sehen: Kachel oeffnen, einen Bogen
 * anlegen, Werte tippen, Schaden und Heilung ueber das Feld, eine lange
 * Rast, und dass alles ohne Speichern-Knopf auf der Platte landet.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-charakterbogen.cjs --no-sandbox
 */
const { app, BaseWindow, webContents } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bogen-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });
fs.writeFileSync(
  path.join(userData, 'einstellungen.json'),
  JSON.stringify({ language: 'de', einfuehrungGesehen: ['suite', 'charakterbogen'] })
);

// Ein eigener Gegenstand aus dem Magic Item Creator (Homebrew).
const mi = path.join(userData, 'magicitems', 'gegenstaende');
fs.mkdirSync(mi, { recursive: true });
fs.writeFileSync(
  path.join(mi, 'sturmklinge.md'),
  '---\nname: Sturmklinge\nart: waffe\nseltenheit: rare\neinstimmung: ja\nwert: 4000\ngeaendert: 2026-01-01\n---\n## Wirkungen\n\n- Blitze knistern an der Schneide.\n'
);

// Ein eigener Zustand aus dem Status Effect Creator (Homebrew-Effekt).
const ze = path.join(userData, 'zustaende', 'zustaende');
fs.mkdirSync(ze, { recursive: true });
fs.writeFileSync(path.join(ze, 'nebelfluch.md'), '---\nname: Nebelfluch\nart: fluch\n---\n# Nebelfluch\n\nDu siehst nur 3 m weit.\n');

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
}, 120000);

async function bis(bedingung, ms = 4000) {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) return false;
    await warte(50);
  }
  return true;
}

/** Setzt einen Wert so, dass React ihn mitbekommt. */
const tippe = (auswahl, wert) => `(async () => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  const setz = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  e.focus();
  setz.call(e, ${JSON.stringify(wert)});
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

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

  pruefe(
    await hjs(`Boolean(document.querySelector('.kachel[data-app="charakterbogen"]:not(:disabled)'))`),
    'die Kachel steht auf der Startseite'
  );
  await hjs(`document.querySelector('.kachel[data-app="charakterbogen"]').click(); true`);
  await warte(4000);
  const sicht = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/charakterbogen/'));
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
  pruefe(/Charakterbogen/.test(await js('document.body.innerText')), 'mit seiner Ueberschrift');

  // --- Anlegen ----------------------------------------------------------------
  await js(`document.querySelector('[data-neu]').click(); true`);
  await warte(800);
  pruefe(await js(`Boolean(document.querySelector('[data-feld="name"]'))`), 'ein neuer Bogen ist offen');
  const ordner = path.join(userData, 'charakterbogen', 'boegen');
  const dateien = () => (fs.existsSync(ordner) ? fs.readdirSync(ordner).filter((d) => d.endsWith('.md')) : []);
  pruefe(dateien().length === 1, `und liegt sofort als Datei da (${dateien().join(', ')})`);

  await js(tippe('[data-feld="name"]', 'Mira Sturmhand'));
  await js(tippe('[data-feld="klasse-0"]', 'Schurkin'));
  await js(tippe('[data-feld="stufe-0"]', '5'));
  await js(tippe('[data-feld="attribut-ges"]', '16'));
  await warte(200);
  pruefe((await js(`document.querySelector('[data-mod="ges"]').textContent`)) === '+3', 'GES 16 ergibt +3');
  pruefe((await js(`document.querySelector('[data-pb]').dataset.pb`)) === '3', 'Stufe 5 ergibt Uebungsbonus +3');

  // Rueckfragen (lange Rast) im Test immer bejahen.
  await js(`window.confirm = () => true; true`);
  // Heimlichkeit dreimal: halbe Uebung, Uebung, dann Expertise.
  const klickeHeimlichkeit = () => js(`document.querySelector('[data-fertigkeit="heimlichkeit"]').click(); true`);
  await klickeHeimlichkeit();
  await warte(150);
  pruefe((await js(`document.querySelector('[data-bonus="heimlichkeit"]').textContent`)) === '+4', 'halbe Uebung: 3 + 1 (3/2 abgerundet) = +4');
  await klickeHeimlichkeit();
  await warte(100);
  await klickeHeimlichkeit();
  await warte(200);
  pruefe(
    (await js(`document.querySelector('[data-bonus="heimlichkeit"]').textContent`)) === '+9',
    'Heimlichkeit mit Expertise: 3 + 2 × 3 = +9'
  );
  // Symbole der Uebung: alle gleich gross (war ein Glyph-Problem).
  pruefe(
    await js(`(() => { const g = [...document.querySelectorAll('.fertigkeiten .upunkt')].map((e) => e.getBoundingClientRect().width); return g.length === 18 && g.every((x) => Math.abs(x - g[0]) < 0.5); })()`),
    'alle Uebungspunkte sind gleich gross'
  );
  pruefe(
    await js(`(() => { const n = [...document.querySelectorAll('.fertigkeiten li')].map((li) => li.children[2].textContent); return n.join('|') === [...n].sort((a, b) => a.localeCompare(b, 'de')).join('|'); })()`),
    'Fertigkeiten stehen alphabetisch'
  );
  // Alleskoenner: ungeuebte Fertigkeiten bekommen den halben Bonus.
  const akro = () => js(`document.querySelector('[data-bonus="akrobatik"]').textContent`);
  pruefe((await akro()) === '+3', 'Akrobatik ohne Uebung: +3');
  await js(`document.querySelector('[data-feld="alleskoenner"]').click(); true`);
  await warte(150);
  pruefe((await akro()) === '+4', 'mit Alleskoenner: +4');
  // Mit Alleskoenner: ein Klick geht von halb gleich auf voll (Rueckmeldung).
  await js(`document.querySelector('[data-fertigkeit="akrobatik"]').click(); true`);
  await warte(150);
  pruefe((await akro()) === '+6', 'Alleskoenner: ein Klick auf eine ungeuebte Fertigkeit gibt volle Uebung');
  await js(`document.querySelector('[data-fertigkeit="akrobatik"]').click(); true`);
  await js(`document.querySelector('[data-fertigkeit="akrobatik"]').click(); true`);
  await warte(150);
  pruefe((await akro()) === '+4', 'und zwei weitere Klicks fuehren ueber Expertise zurueck');
  pruefe((await js(`document.querySelector('[data-feld="initiative"]').placeholder`)) === '+4', 'und die Initiative auch');
  await js(`document.querySelector('[data-feld="alleskoenner"]').click(); true`);
  // Erschoepfung als Punkte, Inspiration als Knopf.
  await js(`document.querySelector('[data-feld="erschoepfung"] [data-wert="2"]').click(); true`);
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="erschoepfung"]').dataset.stufe`)) === '2', 'Erschoepfung 2 per Klick auf den zweiten Punkt');
  await js(`document.querySelector('[data-feld="erschoepfung"] [data-wert="2"]').click(); true`);
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="erschoepfung"]').dataset.stufe`)) === '1', 'nochmal Klick nimmt eine Stufe zurueck');
  await js(`document.querySelector('[data-feld="erschoepfung"] [data-wert="1"]').click(); true`);
  await js(`document.querySelector('[data-feld="inspiration"]').click(); true`);
  await warte(100);
  pruefe((await js(`document.querySelector('[data-feld="inspiration"]').getAttribute('aria-pressed')`)) === 'true', 'Inspiration an');
  // Aussehen: Farbe, Papier und Schrift je Bogen.
  await js(`document.querySelector('[data-design-knopf]').click(); true`);
  await warte(100);
  await js(`document.querySelector('[data-design-papier="nacht"]').click(); document.querySelector('[data-design-schrift="alt"]').click(); document.querySelector('[data-design-farbe="gruen"]').click(); true`);
  await warte(150);
  pruefe((await js(`document.querySelector('.blatt').dataset.papier`)) === 'nacht', 'Papier Nacht gewaehlt');
  pruefe(
    /IM Fell English/.test(await js(`getComputedStyle(document.querySelector('.blatt__name input')).fontFamily`)),
    'die Schrift gilt im Bogen'
  );
  pruefe(
    await js(`document.fonts.ready.then(() => document.fonts.check('16px "IM Fell English"'))`),
    'die mitgelieferte Schrift ist geladen'
  );
  await js(`document.querySelector('[data-design-knopf]').click(); true`);

  // Ein Bild mit Rahmen (1x1-PNG, ueber das Dateifeld).
  await js(`(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const feld = document.querySelector('[data-bild-datei]');
    const liste = new DataTransfer();
    liste.items.add(new File([png], 'mira.png', { type: 'image/png' }));
    feld.files = liste.files;
    feld.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-portraet] img'))`)), 'ein Bild steht im Kopf');
  await js(`document.querySelector('[data-bild-rahmen] [data-wert="schild"]').click(); true`);
  await warte(100);
  pruefe(await js(`Boolean(document.querySelector('.portraet__rahmen--schild'))`), 'der Rahmen laesst sich wechseln');

  // Eigene Zustaende aus dem Status Effect Creator stehen zur Wahl.
  await js(`document.querySelector('[data-zustand-dazu] button').click(); true`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-zustand-dazu] [data-wert="eigen:Nebelfluch"]'))`)), 'der eigene Zustand Nebelfluch steht zur Wahl');
  await js(`document.querySelector('[data-zustand-dazu] [data-wert="eigen:Nebelfluch"]').click(); true`);
  await warte(100);
  pruefe(/3 m weit/.test(await js(`document.querySelector('[data-zustand="eigen:Nebelfluch"]')?.title ?? ''`)), 'und traegt seinen Text als Hinweis');

  // Notiz im Story Creator: ohne Kampagne eine Meldung, mit Kampagne die Notiz.
  await js(`document.querySelector('[data-story-anlegen]').click(); true`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('.stoerung')?.textContent)`), 8000), 'ohne Kampagne: eine verstaendliche Meldung');
  // Kampagne anlegen: den Story Creator einmal nach vorn holen, dann zurueck.
  const wechsle = (muster) =>
    hjs(`(() => { const k = [...document.querySelectorAll('.schiene__eintrag:not(:disabled)')].find((e) => ${muster}.test(e.title)); if (!k) return false; k.click(); return true; })()`);
  await wechsle('/Story/');
  await warte(3000);
  const story = fenster.contentView.children.map((v) => v.webContents).find((w) => w.getURL().includes('/apps/backstory/'));
  pruefe(Boolean(story), 'der Story Creator kommt hoch');
  if (story) {
    pruefe(await bis(async () => story.executeJavaScript(`typeof window.api?.campaigns?.create === 'function'`), 15000), 'und ist geladen');
    await story.executeJavaScript(`(async () => {
      const auspacken = (antwort) => (antwort && 'value' in antwort ? antwort.value : antwort);
      return auspacken(await window.api.campaigns.create('Testrunde')).name;
    })()`);
    await wechsle('/Charakter/');
    await warte(1500);
    await js(`document.querySelector('[data-story-anlegen]').click(); true`);
    pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-story-oeffnen]'))`), 6000), 'die Notiz ist angelegt und verknuepft');
    const wurzel = await story.executeJavaScript(`(async () => { const a = await window.api.settings.get(); return (a && 'value' in a ? a.value : a).vaultRoot; })()`);
    const notizen = [];
    const kampagnen = path.join(wurzel, 'campaigns');
    for (const k of fs.readdirSync(kampagnen)) {
      const o = path.join(kampagnen, k, 'notes');
      if (fs.existsSync(o)) notizen.push(...fs.readdirSync(o).map((d) => fs.readFileSync(path.join(o, d), 'utf8')));
    }
    pruefe(notizen.some((n) => /Heimlichkeit \+9/.test(n)), 'die Notiz traegt die Lesefassung der Figur');
    await js(`document.querySelector('[data-story-oeffnen]').click(); true`);
    pruefe(
      await bis(async () => /Story/.test(await hjs(`document.querySelector('.schiene__eintrag--an')?.title ?? ''`)), 8000),
      'Notiz oeffnen holt den Story Creator nach vorn'
    );
    // Zurueck zum Bogen fuer den Rest.
    await wechsle('/Charakter/');
    await warte(1500);

    // Stetiger Abgleich: Schalter an, Feld aendern, die Notiz zieht nach; eigener Text dort bleibt.
    const notizDatei = () => {
      for (const k of fs.readdirSync(kampagnen)) {
        const o = path.join(kampagnen, k, 'notes');
        if (!fs.existsSync(o)) continue;
        for (const d of fs.readdirSync(o)) if (/Heimlichkeit/.test(fs.readFileSync(path.join(o, d), 'utf8'))) return path.join(o, d);
      }
      return null;
    };
    await js(`document.querySelector('[data-story-sync]').click(); true`);
    pruefe(await bis(async () => /charakterbogen:anfang/.test(fs.readFileSync(notizDatei(), 'utf8')), 6000), 'Synchron an: die Notiz bekommt den markierten Abschnitt');
    fs.appendFileSync(notizDatei(), '\n\nEigener Satz der Spielerin.\n');
    await js(tippe('[data-feld="sprachen"]', 'Sylvanisch'));
    pruefe(
      await bis(async () => {
        const t = fs.readFileSync(notizDatei(), 'utf8');
        return /Sylvanisch/.test(t) && /Eigener Satz der Spielerin/.test(t);
      }, 8000),
      'eine Aenderung am Bogen landet in der Notiz, eigener Text dort bleibt'
    );
  }

  // --- Trefferpunkte -------------------------------------------------------
  await js(tippe('[data-feld="tp-max"]', '30'));
  await js(tippe('[data-feld="tp-aktuell"]', '30'));
  await js(tippe('[data-feld="tp-temp"]', '5'));
  await warte(100);
  pruefe(await js(`Boolean(document.querySelector('[data-tp-temp-balken]'))`), 'temporaere TP stehen als eigenes Stueck im Balken');
  await warte(200);
  const enter = `document.querySelector('[data-feld="tp-betrag"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`;
  await js(tippe('[data-feld="tp-betrag"]', '-12'));
  await js(enter);
  await warte(300);
  pruefe(
    (await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '23' &&
      (await js(`document.querySelector('[data-feld="tp-temp"]').value`)) === '0',
    '12 Schaden: erst 5 temporaere, dann 7 echte TP'
  );
  await js(tippe('[data-feld="tp-betrag"]', '+4'));
  await js(enter);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '27', '+4 heilt');

  await js(`document.querySelector('[data-rast="lang"]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '30', 'die lange Rast fuellt die TP');

  // --- Zauber ----------------------------------------------------------------
  await js(`document.querySelector('[data-zauber-an]').click(); true`);
  await warte(300);
  await js(tippe('[data-feld="attribut-int"]', '16'));
  await js(`document.querySelector('[data-feld="zauberattribut"] [data-wert="int"]').click(); true`);
  await warte(200);
  pruefe(/14/.test(await js(`document.querySelector('[data-zauber-sg]').textContent`)), 'Zauber-SG 8 + 3 + 3 = 14');
  await js(tippe('[data-platz-max="1"]', '2'));
  await js(`document.querySelector('[data-zauber-suchen]').click(); true`);
  await warte(300);
  await js(tippe('[data-zauber-anfrage]', 'magic missile'));
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-zauber-dazu="magic-missile"]'))`), 'die Suche findet den Zauber auf Englisch');
  await js(`document.querySelector('[data-zauber-dazu="magic-missile"]').click(); true`);
  await warte(300);
  pruefe(
    /Magisches Geschoss/.test(await js(`document.querySelector('[data-zauberliste]').innerText`)),
    'und er steht mit deutschem Namen in der Liste'
  );
  await js(`document.querySelector('[data-zauberliste] [data-wirken]').click(); true`);
  await warte(300);
  pruefe(
    (await js(`document.querySelectorAll('.punkt--weg').length`)) === 1,
    'Wirken verbraucht einen Platz des 1. Grades'
  );
  await js(`document.querySelector('[data-rast="lang"]').click(); true`);
  await warte(300);
  pruefe((await js(`document.querySelectorAll('.punkt--weg').length`)) === 0, 'die lange Rast gibt ihn zurueck');

  // --- Kompaktansicht (docs/charakterbogen-kompakt.md) ---------------------
  await js(`document.querySelector('[data-ansicht-kompakt]').click(); true`);
  await warte(300);
  pruefe(
    (await js(`Boolean(document.querySelector('[data-kompakt]'))`)) && !(await js(`Boolean(document.querySelector('[data-feld="attribut-int"]'))`)),
    'Kompakt: nur die Kampfwerte, keine Attribute'
  );
  pruefe(await js(`Boolean(document.querySelector('[data-kompakt-plaetze] [data-platz="1-0"]'))`), 'Kompakt: Zauberplaetze stehen da');
  await js(`document.querySelector('[data-kompakt-plaetze] [data-platz="1-0"]').click(); true`);
  await warte(200);
  pruefe((await js(`document.querySelectorAll('.punkt--weg').length`)) === 1, 'Kompakt: ein Klick verbraucht einen Platz');
  await js(tippe('[data-feld="tp-betrag"]', '-5'));
  await js(enter);
  await warte(300);
  pruefe((await js(`document.querySelector('[data-feld="tp-aktuell"]').value`)) === '25', 'Kompakt: Schaden wirkt wie im vollen Bogen');
  pruefe(await js(`Boolean(document.querySelector('[data-block="inventar"]'))`), 'Kompakt: das Inventar bleibt');
  await js(`document.querySelector('[data-ansicht-kompakt]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-feld="attribut-int"]'))`), 'zurueck zum vollen Bogen');
  await js(`document.querySelector('[data-rast="lang"]').click(); true`);
  await warte(300);

  // --- Tiergestalt (docs/tiergestalt.md) ------------------------------------
  pruefe(!(await js(`Boolean(document.querySelector('[data-block="tiergestalt"]'))`)), 'ohne Druidenstufe kein Tiergestalt-Block');
  await js(tippe('[data-feld="klasse-0"]', 'Druide'));
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-block="tiergestalt"]'))`), 'als Druide erscheint der Block Tiergestalt');
  pruefe(/HG bis 1\/2/.test(await js(`document.querySelector('[data-tg-regel]').textContent`)), 'Stufe 5: HG bis 1/2 (SRD-Tabelle)');
  await js(`document.querySelector('[data-tg-lernen] .suchwahl__knopf').click(); true`);
  await warte(200);
  pruefe(!(await js(`Boolean(document.querySelector('[data-tg-lernen] [data-wert="owl"]'))`)), 'die Eule (fliegt) steht nicht zur Wahl');
  pruefe(!(await js(`Boolean(document.querySelector('[data-tg-lernen] [data-wert="brown-bear"]'))`)), 'der Braunbaer (HG 1) auch nicht');
  await js(`document.querySelector('[data-tg-lernen] [data-wert="wolf"]').click(); true`);
  await warte(200);
  pruefe(await js(`Boolean(document.querySelector('[data-tg-gestalt="wolf"]'))`), 'der Wolf ist als Gestalt bekannt');
  const tempVorher = Number(await js(`document.querySelector('[data-feld="tp-temp"]').value`));
  await js(`document.querySelector('[data-tg-verwandeln="wolf"]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-gestaltkasten="wolf"]'))`), 'Verwandeln: der Kasten des Wolfs liegt neben dem Bogen');
  pruefe(
    Number(await js(`document.querySelector('[data-feld="tp-temp"]').value`)) === Math.max(tempVorher, 5),
    'und gibt 5 temporaere TP (Druidenstufe)'
  );
  pruefe((await js(`document.querySelector('[data-tg-nutzungen]').dataset.tgNutzungen`)) === '1', 'eine Nutzung ist verbraucht');
  await js(`document.querySelector('[data-gestaltkasten] [data-tg-zurueck]').click(); true`);
  await warte(300);
  pruefe(!(await js(`Boolean(document.querySelector('[data-gestaltkasten]'))`)), 'Zurueckverwandeln nimmt den Kasten weg');
  // Nachschlagen: das Nachschlagewerk oeffnet sich mit dem Filter der Figur.
  await js(`document.querySelector('[data-tg-nachschlagen]').click(); true`);
  const nachschlage = () => fenster.contentView.children.find((v) => v.webContents?.getURL().includes('/apps/nachschlagewerk/'));
  pruefe(
    await bis(async () => {
      const v = nachschlage();
      return Boolean(v) && (await v.webContents.executeJavaScript(`Boolean(document.querySelector('[data-gestalten]'))`));
    }),
    'Nachschlagen oeffnet die Ansicht Gestalten'
  );
  const njs = (a) => nachschlage().webContents.executeJavaScript(a);
  pruefe(await bis(async () => njs(`Boolean(document.querySelector('[data-gestalt="wolf"] [data-gestalt-bekannt]'))`)), 'der Wolf ist dort als bekannt markiert');
  pruefe(!(await njs(`Boolean(document.querySelector('[data-gestalt="brown-bear"]'))`)), 'und nur Gestalten bis HG 1/2 stehen da');
  // Zurueck zum Bogen.
  await hjs(`document.querySelector('[data-schiene="charakterbogen"]').click(); true`);
  pruefe(await bis(async () => js(`document.hasFocus() || document.visibilityState === 'visible'`)), 'der Bogen ist wieder vorn');
  await warte(500);

  await js(tippe('[data-feld="tp-temp"]', '0'));
  await js(`document.querySelector('[data-feld="tp-temp"]').blur(); true`);
  await js(tippe('[data-feld="klasse-0"]', 'Schurkin'));
  await warte(300);

  // --- Waffenangriffe ----------------------------------------------------------
  const waehle = (auswahl, wert) =>
    js(`(async () => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  if (e.tagName === 'SELECT') {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  // Segment oder Suchwahl: der Knopf mit dem Wert; eine Suchwahl erst aufklappen.
  const suche = () => e.querySelector('[data-wert="' + CSS.escape(${JSON.stringify(wert)}) + '"]');
  // React zeichnet nach einem Klick erst in einer Microtask neu.
  if (!suche()) {
    e.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 30));
  }
  const k = suche();
  if (!k) return false;
  k.click();
  await new Promise((r) => setTimeout(r, 30));
  return true;
})()`);
  await js(`document.querySelector('[data-angriff-dazu]').click(); true`);
  await warte(200);
  await waehle('[data-angriff="a-0"] [data-angriff-waffe]', 'rapier');
  await warte(200);
  pruefe(
    (await js(`document.querySelector('[data-angriff="a-0"] [data-angriff-bonus]')?.textContent`)) === '+6' &&
      /^1d8\+3 Stich/.test(await js(`document.querySelector('[data-angriff="a-0"] [data-angriff-schaden]')?.textContent ?? ''`)),
    'Rapier mit GES 16 und Stufe 5: +6, 1d8+3 Stich (Finesse)'
  );
  await js(`document.querySelector('[data-wuerfeln="a-0"]').click(); true`);
  await warte(200);
  pruefe(/^⚔ Rapier: \d+ \(d20 \d+ \+6\)/.test(await js(`document.querySelector('[data-wurf-ergebnis]')?.textContent ?? ''`)), 'Wuerfeln zeigt Angriff und Schaden');
  // Eine Waffe im Inventar: ausgeruestet wird sie zum Angriff.
  await js(`document.querySelector('[data-block="inventar"] [data-gegenstand-dazu]').click(); true`);
  await warte(200);
  await js(tippe('[data-gegenstand-name]', 'Dolch'));
  const gid = await js(`document.querySelector('[data-gegenstand-name]').dataset.gegenstandName`);
  // Ein neuer Gegenstand steht schon aufgeklappt da.
  await warte(200);
  await waehle(`[data-gegenstand-waffe="${gid}"]`, 'dagger');
  await warte(100);
  pruefe(!(await js(`Boolean(document.querySelector('[data-angriff="inv-${gid}"]'))`)), 'nicht ausgeruestet: kein Angriff');
  await js(`document.querySelector('[data-ausgeruestet="${gid}"]').click(); true`);
  await warte(200);
  pruefe(
    (await js(`document.querySelector('[data-angriff="inv-${gid}"] [data-angriff-bonus]')?.textContent`)) === '+6',
    'ausgeruestet: der Dolch steht unter Angriffe, +6'
  );

  // --- Auf der Platte, ohne Speichern-Knopf -----------------------------------
  await warte(1500);
  const inhalt = dateien().length ? fs.readFileSync(path.join(ordner, dateien()[0]), 'utf8') : '';
  pruefe(/^name: Mira Sturmhand$/m.test(inhalt), 'der Name steht in der Datei');
  pruefe(/^tp: 30$/m.test(inhalt) && /^tp_max: 30$/m.test(inhalt), 'die TP stehen im Kopf');
  pruefe(/Heimlichkeit \+9/.test(inhalt), 'die Lesefassung zeigt die Fertigkeit');
  pruefe(/Magisches Geschoss/.test(inhalt) && /"srd": "magic-missile"/.test(inhalt), 'der Zauber steht in der Datei');
  pruefe(dateien().length === 1, 'Umbenennen legt keine zweite Datei an');
  pruefe(/\*\*Rapier\*\* \+6 · 1d8\+3 Stich/.test(inhalt), 'die Lesefassung zeigt den Waffenangriff');
  pruefe(/"waffe": \{\s*"id": "dagger"/.test(inhalt), 'der Dolch ist in der Datei als Waffe vermerkt');

  // --- Zurueck zur Liste --------------------------------------------------------
  await js(`[...document.querySelectorAll('button')].find((b) => /Zurück zur Liste/.test(b.textContent)).click(); true`);
  await warte(600);
  pruefe(
    /Mira Sturmhand/.test(await js(`document.querySelector('.kacheln')?.innerText ?? ''`)) &&
      /30\/30/.test(await js(`document.querySelector('.kacheln')?.innerText ?? ''`)),
    'die Liste zeigt den Bogen mit TP'
  );

  // --- Inventar, Geld, Gruppeninventar ----------------------------------------
  const ereignis = (auswahl, art, extra = '') =>
    js(`(() => { const e = document.querySelector(${JSON.stringify(auswahl)}); if (!e) return false;
      e.dispatchEvent(new ${art === 'blur' ? 'FocusEvent' : 'KeyboardEvent'}('${art}', { bubbles: true ${extra} })); return true; })()`);
  await js(`document.querySelector('[data-neu-gruppe]').click(); true`);
  await warte(800);
  pruefe(await js(`Boolean(document.querySelector('[data-block="inventar"]')) && !document.querySelector('[data-block="zauber"]')`), 'ein Gruppeninventar hat Inventar, aber keine Werte');
  await js(tippe('[data-muenze="gm"]', '+25'));
  await ereignis('[data-muenze="gm"]', 'keydown', ", key: 'Enter'");
  await warte(200);
  await js(tippe('[data-muenze="sm"]', '7'));
  await ereignis('[data-muenze="sm"]', 'keydown', ", key: 'Enter'");
  await warte(200);
  pruefe(/25,7 GM/.test(await js(`document.querySelector('[data-geld-summe]').textContent`)), 'Geld: 25 GM + 7 SM = 25,7 GM');
  await js(`document.querySelector('[data-gegenstand-dazu]').click(); true`);
  await warte(200);
  await js(tippe('[data-gegenstand-name]', 'Seil'));
  await warte(900);
  // Das Seil an Mira geben.
  await js(`document.querySelector('[data-geben]').click(); true`);
  await warte(200);
  await js(`document.querySelector('[data-geben-ok]').click(); true`);
  await warte(900);
  pruefe((await js(`document.querySelectorAll('[data-gegenstand-name], [data-gegenstand-titel]').length`)) === 0, 'Geben nimmt das Seil aus der Gruppe');
  // Geld aufteilen (nur Mira ist Figur): alles geht an sie.
  await js(`document.querySelector('[data-aufteilen]').click(); true`);
  await warte(200);
  await js(`document.querySelector('[data-aufteilen-ok]').click(); true`);
  await warte(900);
  pruefe(/0 GM/.test(await js(`document.querySelector('[data-geld-summe]').textContent`)), 'Aufteilen leert die Gruppenkasse');
  pruefe(/Seil an Mira/.test(await js(`document.querySelector('.verlauf')?.textContent ?? ''`)), 'der Verlauf nennt die Uebergabe');
  const mira = fs.readFileSync(path.join(ordner, dateien().find((d) => d.startsWith('neue-figur'))), 'utf8');
  pruefe(/- Seil/.test(mira) && /25 GM, 7 SM|"gm": 25/.test(mira), 'bei Mira liegen Seil und Geld in der Datei');

  // --- Quellen fuers Inventar (Schritt 7) ---------------------------------------
  const waehleQ = (auswahl, wert) =>
    js(`(async () => {
  const e = document.querySelector(${JSON.stringify(auswahl)});
  if (!e) return false;
  if (e.tagName === 'SELECT') {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(wert)});
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  // Segment oder Suchwahl: der Knopf mit dem Wert; eine Suchwahl erst aufklappen.
  const suche = () => e.querySelector('[data-wert="' + CSS.escape(${JSON.stringify(wert)}) + '"]');
  // React zeichnet nach einem Klick erst in einer Microtask neu.
  if (!suche()) {
    e.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 30));
  }
  const k = suche();
  if (!k) return false;
  k.click();
  await new Promise((r) => setTimeout(r, 30));
  return true;
})()`);
  // Der Name ist ein Knopf zum Aufklappen; nur beim Umbenennen ein Eingabefeld.
  const namen = () => js(`[...document.querySelectorAll('[data-gegenstand-name], [data-gegenstand-titel]')].map((e) => e.value || e.textContent.replace(/^[▸▾]\\s*/, '')).join('|')`);
  await js(`document.querySelector('[data-aus-quelle]').click(); true`);
  await warte(200);
  await js(tippe('[data-quelle-suche]', 'ritterrüstung'));
  await warte(200);
  await js(`document.querySelector('[data-quelle-dazu]').click(); true`);
  await warte(200);
  pruefe(/Ritterrüstung/.test(await namen()), 'SRD-Ausruestung: die Ritterruestung liegt im Gruppeninventar');
  await js(`document.querySelector('[data-quelle-reiter="magie"]').click(); true`);
  await js(tippe('[data-quelle-suche]', 'nimmervoll'));
  await warte(200);
  await js(`document.querySelector('[data-quelle-dazu="bag-of-holding"]').click(); true`);
  await warte(200);
  pruefe(/Nimmervoller Beutel/.test(await namen()), 'SRD-Magie: der Nimmervolle Beutel liegt dort');
  await js(`document.querySelector('[data-quelle-reiter="eigene"]').click(); true`);
  pruefe(
    await bis(async () => js(`Boolean(document.querySelector('[data-quelle-dazu="sturmklinge"]'))`)),
    'Homebrew: die Sturmklinge aus dem Magic Item Creator steht zur Wahl'
  );
  await js(`document.querySelector('[data-quelle-dazu="sturmklinge"]').click(); true`);
  await warte(200);
  pruefe(/Sturmklinge/.test(await namen()), 'und kommt ins Inventar');
  await js(`document.querySelector('[data-quelle-reiter="loot"]').click(); true`);
  pruefe(await bis(async () => js(`document.querySelectorAll('[data-loot-tabelle] [data-wert]').length > 0`)), 'Loot: die Tabellen des Loot Generators stehen zur Wahl');
  await js(`document.querySelector('[data-loot-wuerfeln]').click(); true`);
  pruefe(await bis(async () => js(`Boolean(document.querySelector('[data-loot-dazu]'))`)), 'ein Wurf auf die Tabelle ergibt etwas');
  const vorher = (await namen()).split('|').length;
  await js(`document.querySelector('[data-loot-dazu]').click(); true`);
  await warte(200);
  pruefe((await namen()).split('|').length === vorher + 1, 'und landet als Gegenstand im Inventar');
  // Klick auf den Namen klappt die Iteminfo auf, der Stift rechts benennt um.
  const tid = await js(`document.querySelector('[data-gegenstand-titel]')?.dataset.gegenstandTitel ?? ''`);
  const offenVorher = await js(`document.querySelectorAll('.gegenstand__detail').length`);
  await js(`document.querySelector('[data-gegenstand-titel="${tid}"]').click(); true`);
  await warte(150);
  pruefe((await js(`document.querySelectorAll('.gegenstand__detail').length`)) !== offenVorher, 'Klick auf den Namen klappt die Iteminfo auf oder zu');
  await js(`document.querySelector('[data-umbenennen="${tid}"]').click(); true`);
  await warte(150);
  pruefe(await js(`document.activeElement?.dataset?.gegenstandName === ${JSON.stringify(tid)}`), 'der Stift macht den Namen zum Eingabefeld');
  await ereignis(`[data-gegenstand-name="${tid}"]`, 'keydown', ", key: 'Enter'");
  await warte(150);
  pruefe(await js(`Boolean(document.querySelector('[data-gegenstand-titel="${tid}"]'))`), 'Enter beendet das Umbenennen');
  await warte(1200);
  const gruppe = fs.readFileSync(path.join(ordner, dateien().find((d) => !d.startsWith('neue-figur'))), 'utf8');
  pruefe(/"art": "magicitem",\s*"kennung": "sturmklinge"/.test(gruppe), 'die Herkunft steht in der Datei');

  pruefe(konsole.length === 0, `keine Fehler in der Konsole (${konsole.join(' | ')})`);
  console.log(fehler.length ? `\n${fehler.length} fehlgeschlagen` : '\nCharakterbogen bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
