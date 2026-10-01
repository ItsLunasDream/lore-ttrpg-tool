/**
 * Rauchtest: das Nachschlagewerk.
 *
 * Geprueft wird der Weg, den die Modultests nicht sehen: Kachel anklicken,
 * Eintrag waehlen, suchen — und vor allem der Sprung aus der Suche der
 * Huelle hinein. Der ist bei diesem Werkzeug der haeufigste Weg: man sucht
 * „liegend" und will die Regel sehen, nicht erst das Werkzeug oeffnen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-nachschlagewerk.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nachschlagewerk-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

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

  // --- Die Kachel ---------------------------------------------------------
  const marke = await hjs(
    `document.querySelector('.kachel[data-app="nachschlagewerk"]')?.className ?? 'fehlt'`
  );
  pruefe(/kachel--bereit/.test(marke), `die Kachel ist bereit (${marke})`);

  // --- Die Suche der Huelle findet den offiziellen Bestand -----------------
  //
  // Das ist der eigentliche Gewinn: bisher fand Strg+K nur Selbstgebautes.
  // Gesucht wird ohne dass das Werkzeug je offen war.
  const eintraege = await hjs('window.shell.suche.eintraege()');
  const regeln = (eintraege ?? []).filter((e) => e.werkzeug === 'nachschlagewerk');
  pruefe(
    // + 1: die Ansicht „Tiergestalten" (docs/tiergestalt.md).
    regeln.length === 155 + 180 + 51 + 339 + 258 + 1,
    `die Suche der Huelle kennt Glossar, Ausruestung, Zauber, magische Gegenstaende und Tiergestalten (${regeln.length})`
  );
  pruefe(
    regeln.some(
      (e) =>
        e.kennung === 'gegenstand/bag-of-holding' &&
        /Bag of Holding/.test(`${e.name} ${e.stichworte}`) &&
        /Nimmervoll/.test(`${e.name} ${e.stichworte}`)
    ),
    'darunter der Nimmervolle Beutel, unter beiden Namen zu finden'
  );
  const liegend = regeln.find((e) => e.kennung === 'zustand/prone');
  pruefe(Boolean(liegend), 'darunter „Liegend"');
  pruefe(
    Boolean(liegend) && liegend.name === 'Prone' && /Liegend/.test(liegend.stichworte),
    'auf Englisch heisst er „Prone", der deutsche Name bleibt Suchwort'
  );

  // --- Werkzeug oeffnen -----------------------------------------------------
  await hjs(
    `(() => { const k = document.querySelector('.kachel[data-app="nachschlagewerk"]:not(:disabled)');
      if (k) k.click(); return Boolean(k); })()`
  );
  await warte(5000);

  const sicht = fenster.contentView.children.find((v) =>
    v.webContents.getURL().includes('/apps/nachschlagewerk/')
  );
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

  pruefe(
    (await js("document.querySelectorAll('.eintrag').length")) === 155 + 180 + 51 + 339 + 258,
    'die Liste zeigt 155 Eintraege des Glossars, 180 der Ausruestung und 51 einzelne Waffen und Ruestungen, 339 Zauber und 258 Gegenstaende'
  );
  // Die Einfuehrung kann beim ersten Oeffnen davor liegen; sie gehoert der
  // Huelle, nicht dem Werkzeug, und stoert die Pruefungen hier nicht.

  // --- Ein Eintrag ---------------------------------------------------------
  await js(`document.querySelector('.eintrag[data-regel="zustand/blinded"]').click(); true`);
  await warte(400);
  const blatt = await js("document.querySelector('.regel')?.innerText ?? ''");
  pruefe(blatt.length > 100, 'der Eintrag steht rechts');
  pruefe(
    (await js("document.querySelectorAll('.regel__punkt strong').length")) >= 2,
    'mit seinen Unterpunkten, hervorgehoben'
  );

  // --- Auf Englisch kein deutscher Text ------------------------------------
  //
  // Rueckmeldung: „Wenn die Sprache auf Englisch ist, soll kein deutscher
  // Text dabei stehen. Bei Deutsch schon englischer."
  pruefe(
    (await js("document.querySelectorAll('.regel__anders, .eintrag__anders').length")) === 0 &&
      !(await js("Boolean(document.querySelector('button[data-daneben]'))")),
    'auf Englisch stehen keine deutschen Namen dabei und es gibt kein Nebeneinander'
  );
  await hjs(`window.shell.einstellungen.schreiben({ language: 'de' }).then(() => true)`);
  await warte(800);
  pruefe(
    /Blinded/.test(await js("document.querySelector('.regel__anders')?.textContent ?? ''")),
    'auf Deutsch steht der englische Name dabei'
  );

  // --- Beide Sprachen nebeneinander (auf Deutsch) --------------------------
  await js(`document.querySelector('button[data-daneben]').click(); true`);
  await warte(300);
  pruefe(
    (await js("document.querySelectorAll('.regel__fassung').length")) === 2,
    'auf Wunsch stehen beide Sprachfassungen nebeneinander'
  );
  pruefe(
    /Blinded/.test(await js("document.querySelector('.regel__fassung[data-sprache=\"en\"]')?.innerText ?? ''")) &&
      /Blind/.test(await js("document.querySelector('.regel__fassung[data-sprache=\"de\"]')?.innerText ?? ''")),
    'und zwar wirklich die englische und die deutsche'
  );

  // --- Tabellen und Verweise -----------------------------------------------
  await js(`document.querySelector('button[data-daneben]').click(); true`);
  await hjs(`window.shell.einstellungen.schreiben({ language: 'en' }).then(() => true)`);
  await warte(800);
  await js(`document.querySelector('.eintrag[data-regel="regel/breaking-objects"]').click(); true`);
  await warte(400);
  pruefe(
    (await js("document.querySelectorAll('.regel__tabelle').length")) === 2 &&
      (await js("document.querySelectorAll('.regel__tabelle tbody tr').length")) === 8,
    'Tabellen stehen als Tabellen da, mit Kopf und Reihen'
  );
  await js(`document.querySelector('[data-verweis] .verweis').click(); true`);
  await warte(400);
  pruefe(
    (await js("document.querySelector('.regel')?.dataset.regel ?? ''")) === 'regel/damage-threshold',
    'ein Verweis fuehrt zum Eintrag, auf den er zeigt'
  );

  // --- Verweise im Text, mit Vorschau ---------------------------------------
  //
  // Im Text von „Restrained" steht „Grappled"-artiges und „Speed"; erkannt
  // werden nur die kuratierten Begriffe, und nie der eigene Eintrag.
  await js(`document.querySelector('.eintrag[data-regel="zustand/unconscious"]').click(); true`);
  await warte(400);
  const imText = await js("[...document.querySelectorAll('.regel__fassung .verweis--leise')].map(v => v.dataset.ziel)");
  pruefe(
    imText.includes('zustand/incapacitated') && imText.includes('zustand/prone') && !imText.includes('zustand/unconscious'),
    `im Text sind Begriffe verlinkt, der eigene nicht (${imText.join(', ')})`
  );
  pruefe(new Set(imText).size === imText.length, 'jeder Begriff nur einmal');
  await js(`document.querySelector('.regel__fassung .verweis--leise[data-ziel="zustand/prone"]')
    .dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); true`);
  await warte(600);
  const karte = await js("document.querySelector('.vorschau')?.dataset.vorschau ?? ''");
  pruefe(karte === 'zustand/prone', `beim Darueberfahren kommt die Vorschau (${karte})`);
  pruefe(
    (await js("document.querySelector('.regel')?.dataset.regel ?? ''")) === 'zustand/unconscious',
    'und die Seite bleibt, wo sie ist'
  );
  await js(`document.querySelector('.vorschau__oeffnen').click(); true`);
  await warte(400);
  pruefe(
    (await js("document.querySelector('.regel')?.dataset.regel ?? ''")) === 'zustand/prone' &&
      !(await js("Boolean(document.querySelector('.vorschau'))")),
    'aus der Vorschau oeffnet sich der Eintrag, und die Karte geht'
  );

  // --- Suche im Text -------------------------------------------------------
  //
  // „critical hit" steht in keinem Namen, aber im Text von Gelaehmt und
  // Bewusstlos. Wer nachschlaegt, sucht die Stelle, nicht nur den Titel.
  await js(`(() => {
    const feld = document.querySelector('.liste__suche');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(feld, 'critical hit');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await warte(300);
  const treffer = await js("[...document.querySelectorAll('.eintrag')].map(e => e.dataset.regel)");
  pruefe(
    treffer.includes('zustand/paralyzed') && treffer.includes('zustand/unconscious'),
    `die Suche findet auch im Text (${treffer.join(', ')})`
  );
  pruefe(
    (await js("document.querySelectorAll('.eintrag__stelle').length")) > 0,
    'und zeigt die Fundstelle'
  );

  // --- Der Sprung aus der Suche der Huelle ---------------------------------
  const sprung = await hjs(`window.shell.suche.zeige('nachschlagewerk', 'zustand/prone')`);
  pruefe(sprung === true, 'die Huelle stellt den Sprung zu');
  await warte(500);
  pruefe(
    (await js("document.querySelector('.regel')?.dataset.regel ?? ''")) === 'zustand/prone',
    'und der Eintrag ist offen'
  );
  pruefe(
    (await js("document.querySelector('.liste__suche').value")) === '',
    'die alte Suche ist dabei geleert, sonst stuende der Eintrag nicht in der Liste'
  );

  // --- Hausregeln ----------------------------------------------------------
  //
  // An der offiziellen Regel angelegt, auf der Platte abgelegt, und die
  // offizielle Regel traegt danach die Marke. Das ist der Kern: wer
  // „Critical Hit" nachschlaegt, soll sehen, dass am Tisch etwas anderes gilt.
  await js(`document.querySelector('.eintrag[data-regel="regel/critical-hit"]')?.click(); true`);
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'regel/critical-hit')`);
  await warte(500);
  await js(`document.querySelector('[data-hausregel-dazu]').click(); true`);
  await warte(300);
  const tippe = (feld, wert) => js(`(() => {
    const el = document.querySelector('[data-hausregel-formular] [data-feld="${feld}"]');
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(wert)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await tippe('name', 'Kritische Treffer: maximal');
  // „[[" schlaegt Eintraege vor, wie im Story Creator; Enter setzt den Verweis.
  await tippe('text', 'Gilt auch bei [[Blin');
  await warte(200);
  const vorgeschlagen = await js("[...document.querySelectorAll('[data-verweisvorschlag]')].map(e => e.dataset.verweisvorschlag)");
  pruefe(vorgeschlagen.some((n) => /^Blind/.test(n)), `"[[" schlaegt Eintraege vor (${vorgeschlagen.slice(0, 4).join(', ')})`);
  await js(`document.querySelector('[data-hausregel-formular] [data-feld="text"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); true`);
  await warte(200);
  pruefe(
    /\[\[Blind(ed)?\]\]/.test(await js("document.querySelector('[data-hausregel-formular] [data-feld=\"text\"]').value")),
    'und Enter setzt den ganzen Verweis'
  );
  await tippe('text', 'Bei uns wird der Schaden maximiert. Gilt auch bei [[Liegend]].');
  await warte(200);
  pruefe(
    (await js("document.querySelector('[data-hausregel-formular] [data-feld=bezug]').value")) === 'regel/critical-hit',
    'die neue Hausregel zeigt schon auf die Regel, von der aus sie angelegt wurde'
  );
  await js(`document.querySelector('[data-hausregel-speichern]').click(); true`);
  await warte(700);
  const hausordner = path.join(userData, 'nachschlagewerk', 'hausregeln');
  const hausdateien = fs.existsSync(hausordner) ? fs.readdirSync(hausordner) : [];
  pruefe(hausdateien.length === 1, `die Hausregel liegt auf der Platte (${hausdateien.join(', ')})`);
  pruefe(
    (await js("document.querySelector('.regel')?.dataset.regel ?? ''")).startsWith('hausregel/'),
    'nach dem Speichern steht sie rechts'
  );
  pruefe(
    (await js("document.querySelectorAll('.regel .verweis--leise').length")) >= 2,
    'mit dem Bezug und dem [[Verweis]] als Verweise'
  );
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'regel/critical-hit')`);
  await warte(500);
  pruefe(
    /Kritische Treffer/.test(await js("document.querySelector('[data-amtisch]')?.textContent ?? ''")),
    'die offizielle Regel traegt die Marke „an diesem Tisch gilt"'
  );
  const nachHaus = await hjs('window.shell.suche.eintraege()');
  pruefe(
    (nachHaus ?? []).some((e) => e.werkzeug === 'nachschlagewerk' && e.kennung.startsWith('hausregel/')),
    'Strg+K findet die Hausregel'
  );

  // --- Notizen am Text ------------------------------------------------------
  //
  // Text auswaehlen, Knopf „Notiz", schreiben, speichern. Die Stelle ist
  // danach hinterlegt, und die Notiz liegt auf der Platte.
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'zustand/blinded')`);
  await warte(500);
  await js(`(() => {
    const p = document.querySelector('.regel__fassung [data-block="2"]');
    const text = [...p.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes('Disadvantage')) ??
      [...p.querySelectorAll('*')].flatMap((e) => [...e.childNodes]).find((n) => n.nodeType === 3 && n.textContent.includes('Disadvantage'));
    const von = text.textContent.indexOf('Disadvantage');
    const r = document.createRange();
    r.setStart(text, von);
    r.setEnd(text, von + 'Disadvantage'.length);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    p.closest('.regel__fassung').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  })()`);
  await warte(300);
  pruefe(await js("Boolean(document.querySelector('[data-notiz-neu]'))"), 'nach einer Auswahl erscheint der Knopf „Notiz"');
  await js(`document.querySelector('[data-notiz-neu]').click(); true`);
  await warte(300);
  await js(`(() => {
    const el = document.querySelector('[data-notiz-text]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'Bei uns nur im Kampf');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await warte(200);
  await js(`document.querySelector('[data-notiz-speichern]').click(); true`);
  await warte(600);
  pruefe(
    (await js("document.querySelector('mark.notizstelle')?.textContent ?? ''")) === 'Disadvantage',
    'die Stelle ist danach hinterlegt'
  );
  const notizdatei = path.join(userData, 'nachschlagewerk', 'notizen.json');
  pruefe(
    fs.existsSync(notizdatei) && /Bei uns nur im Kampf/.test(fs.readFileSync(notizdatei, 'utf8')),
    'die Notiz liegt auf der Platte'
  );
  pruefe(
    /Bei uns nur im Kampf/.test(await js("document.querySelector('[data-notizen]')?.textContent ?? ''")),
    'und steht unter dem Eintrag'
  );

  // --- Die Notiz in der Suche der Huelle -------------------------------------
  // Erst woanders hin, dann ueber den Treffer der Notiz zurueck.
  const alleTreffer = (await hjs('window.shell.suche.eintraege()')) ?? [];
  const notizTreffer = alleTreffer.find((e) => e.werkzeug === 'nachschlagewerk' && /Bei uns nur im Kampf/.test(e.name));
  pruefe(Boolean(notizTreffer), `Strg+K findet die Notiz (${notizTreffer ? notizTreffer.art : 'nichts'})`);
  const anderer = alleTreffer.find(
    (e) =>
      e.werkzeug === 'nachschlagewerk' &&
      !/^(notiz|hausregel)\//.test(e.kennung) &&
      notizTreffer &&
      !notizTreffer.art.includes(e.name)
  );
  if (notizTreffer && anderer) {
    await hjs(`window.shell.suche.zeige('nachschlagewerk', ${JSON.stringify(anderer.kennung)})`);
    await warte(600);
    pruefe(
      !/Bei uns nur im Kampf/.test(await js("document.querySelector('[data-notizen]')?.textContent ?? ''")),
      `ein anderer Eintrag ist offen (${anderer.name})`
    );
    await hjs(`window.shell.suche.zeige('nachschlagewerk', ${JSON.stringify(notizTreffer.kennung)})`);
    await warte(800);
    pruefe(
      /Bei uns nur im Kampf/.test(await js("document.querySelector('[data-notizen]')?.textContent ?? ''")),
      'der Treffer oeffnet den Eintrag, an dem die Notiz haengt'
    );
  }

  // --- Ein Zauber ------------------------------------------------------------
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'zauber/fireball')`);
  await warte(700);
  pruefe(
    /Evocation|Hervorrufung/.test(await js("document.querySelector('[data-unterzeile]')?.textContent ?? ''")) &&
      /150 feet|45 Meter/.test(await js("document.querySelector('.regel__fassung')?.textContent ?? ''")),
    'ein Zauber zeigt Grad, Schule und Reichweite'
  );
  if (process.env.BILD_ZAUBER) {
    const bild = await sicht.webContents.capturePage();
    fs.writeFileSync(process.env.BILD_ZAUBER, bild.toPNG());
  }

  // --- Die Waffentabelle ------------------------------------------------------
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'ausruestung/weapons')`);
  await warte(700);
  pruefe(
    (await js("document.querySelectorAll('.regel__fassung table tbody tr').length")) === 42 &&
      (await js("document.querySelectorAll('.regel__fassung table thead th').length")) === 6,
    'die Waffentabelle hat sechs Spalten und 42 Reihen'
  );
  pruefe(
    (await js("document.querySelectorAll('.regel__fassung tr.regel__zwischen td[colspan=\"6\"]').length")) === 4,
    'ihre vier Zwischenzeilen gehen ueber die ganze Breite'
  );
  await js("document.querySelector('.regel__fassung table')?.scrollIntoView()");
  if (process.env.BILD_AUSRUESTUNG) {
    const bild = await sicht.webContents.capturePage();
    fs.writeFileSync(process.env.BILD_AUSRUESTUNG, bild.toPNG());
  }

  // --- Ein magischer Gegenstand mit Tabelle -----------------------------------
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'gegenstand/apparatus-of-the-crab')`);
  await warte(700);
  pruefe(
    /Wondrous Item|Wundersamer Gegenstand/.test(await js("document.querySelector('[data-unterzeile]')?.textContent ?? ''")),
    'ein Gegenstand zeigt seine Kopfzeile'
  );
  pruefe(
    (await js("document.querySelectorAll('.regel__fassung table tbody tr').length")) === 10,
    'und seine Tabelle mit zehn Hebeln'
  );
  if (process.env.BILD) {
    const bild = await sicht.webContents.capturePage();
    fs.writeFileSync(process.env.BILD, bild.toPNG());
  }

  // --- Gestalten (docs/tiergestalt.md) --------------------------------------
  await js(`document.querySelector('[data-ansicht="gestalten"]').click(); true`);
  await warte(300);
  pruefe(await js(`Boolean(document.querySelector('[data-gestalten]'))`), 'Reiter Gestalten oeffnet den Filter');
  const gestalten = () => js(`[...document.querySelectorAll('[data-gestalt]')].map((e) => e.dataset.gestalt)`);
  let ids = await gestalten();
  pruefe(ids.includes('wolf') && ids.includes('rat') && !ids.includes('owl') && !ids.includes('brown-bear'), `Druidenstufe 2: Wolf und Ratte, keine Eule, kein Braunbaer (${ids.length})`);
  await js(`document.querySelector('[data-gestalt-bewegung="schwimmen"]').click(); true`);
  await warte(200);
  ids = await gestalten();
  pruefe(ids.length > 0 && !ids.includes('wolf') && ids.includes('frog'), `Filter Schwimmen: Frosch ja, Wolf nein (${ids.join(', ')})`);
  await js(`document.querySelector('[data-gestalt-bewegung="schwimmen"]').click(); true`);
  await warte(200);
  await js(`document.querySelector('[data-gestalt-vergleich="wolf"]').click(); document.querySelector('[data-gestalt-vergleich="rat"]').click(); true`);
  await warte(200);
  pruefe(await js(`document.querySelectorAll('[data-gestalt-vergleichsblatt] thead th').length === 3`), 'zwei Gestalten stehen im Vergleich nebeneinander');
  await js(`document.querySelector('[data-gestalt="wolf"]').click(); true`);
  await warte(200);
  // Ein Klick auf eine Gestalt zeigt bei laufendem Vergleich weiter den Vergleich; Haken weg, dann der Kasten.
  await js(`document.querySelector('[data-gestalt-vergleich="wolf"]').click(); document.querySelector('[data-gestalt-vergleich="rat"]').click(); true`);
  await warte(200);
  pruefe(await js(`Boolean(document.querySelector('[data-gestalt-blatt="wolf"] .wertekasten'))`), 'der Wolf zeigt seinen ganzen Wertekasten');
  await hjs(`window.shell.suche.zeige('nachschlagewerk', 'gestalten?vorgabe=vertrauter')`);
  await warte(600);
  pruefe((await js(`document.querySelector('[data-gestalt-vorgabe]').value`)) === 'vertrauter', 'ein Aufruf von aussen setzt die Vorgabe (Vertrauter)');
  ids = await gestalten();
  pruefe(ids.includes('owl') && !ids.includes('wolf'), 'Vertrauter: HG 0, die Eule ja, der Wolf nicht');
  await js(`document.querySelector('[data-ansicht="regeln"]').click(); true`);
  await warte(200);

  // --- Die Namensnennung ---------------------------------------------------
  pruefe(
    /Systemreferenzdokument 5\.2\.1|System Reference Document 5\.2\.1/.test(
      await js("document.querySelector('.fuss')?.innerText ?? ''")
    ),
    'die vorgeschriebene Namensnennung steht da'
  );

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nNachschlagewerk bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
