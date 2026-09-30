/**
 * Rauchtest der Inspirationshilfe — in der Huelle, an der laufenden Anwendung.
 *
 * Die Modelltests unter apps/inspiration/tests pruefen die Tabellen und den
 * Erzeuger: dass zweihundert Aufhaenger zweihundert verschiedene sind, dass
 * ein festgehaltener Baustein stehen bleibt, dass die Notizen aufeinander
 * verweisen. Was sie nicht sehen koennen, ist, ob ein Klick ankommt, ob die
 * Einbettung haelt und ob am Ende wirklich Dateien auf der Platte liegen.
 *
 * Beides in einem Lauf, weil der Export ohne Story Creator nur die
 * halbe Wahrheit ist: erst mit Kampagne zeigt sich, ob zwoelf Notizen
 * durchgehen, ob sie in derselben Kampagne landen und ob die Verweise
 * stimmen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-inspiration.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiration-smoke-'));
app.setPath('userData', path.join(tmp, 'userData'));
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

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

app.whenReady().then(async () => {
  await warte(4500);
  const f = BaseWindow.getAllWindows()[0];
  f.setBounds({ x: 0, y: 0, width: 1320, height: 860 });
  await warte(800);
  const menue = f.contentView.children[0];
  const mjs = (a) => menue.webContents.executeJavaScript(a);
  const sicht = (id) => f.contentView.children.find((v) => v.webContents.getURL().includes(`/apps/${id}/`));

  // --- Backstory oeffnen und eine Kampagne anlegen -------------------------
  await mjs("[...document.querySelectorAll('.kachel:not(:disabled)')][0].click(); true");
  await warte(5000);
  const bs = sicht('backstory');
  pruefe(Boolean(bs), 'der Story Creator kommt hoch');
  if (!bs) { app.exit(1); return; }
  const bjs = (a) => bs.webContents.executeJavaScript(a);

  const kampagnen = await bjs(`(async () => {
    const auspacken = (antwort) => (antwort && 'value' in antwort ? antwort.value : antwort);
    const liste = auspacken(await window.api.campaigns.list()) ?? [];
    if (liste.length > 0) return liste.map((k) => k.name);
    const neu = auspacken(await window.api.campaigns.create('Testrunde'));
    return [neu.name]; })()`);
  pruefe(Array.isArray(kampagnen) && kampagnen.length > 0, `eine Kampagne steht bereit (${kampagnen})`);
  bs.webContents.reload();
  await warte(4000);

  // --- Zur Inspirationshilfe wechseln -------------------------------------
  await mjs("document.querySelector('.schiene__heim').click(); true");
  await warte(900);
  const kachel = await mjs(`(() => { const k=[...document.querySelectorAll('.kachel:not(:disabled)')]
    .find(x => /Inspiration/.test(x.textContent)); if(!k) return false; k.click(); return true; })()`);
  pruefe(kachel === true, 'die Kachel der Inspirationshilfe ist da');
  await warte(4000);
  const ins = sicht('inspiration');
  pruefe(Boolean(ins), 'sie kommt hoch');
  if (!ins) { app.exit(1); return; }
  const js = (a) => ins.webContents.executeJavaScript(a);
  const konsole = [];
  ins.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  pruefe(await js("Boolean(document.querySelector('.regler-leiste'))"), 'die vier Regler stehen');
  pruefe(await js("typeof window.inspiration === 'object'"), 'die Bruecke zum Hauptprozess ist da');
  pruefe(
    (await js("document.querySelectorAll('.karte').length")) === 0,
    'vor dem ersten Wurf steht noch kein Baustein da'
  );

  // --- Alles wuerfeln ------------------------------------------------------
  const wuerfeln =
    "[...document.querySelectorAll('button')].find(b => /Alles würfeln|Roll everything/.test(b.textContent))";
  pruefe(await js(`Boolean(${wuerfeln})`), 'der Wuerfelknopf ist da');
  await js(`${wuerfeln}.click(); true`);
  await warte(400);
  pruefe(
    (await js("document.querySelectorAll('.karte').length")) === 6,
    'ein Klick fuellt alle sechs Bausteine'
  );
  const zeitstrahl = await js("document.querySelectorAll('.zeitstrahl li').length");
  pruefe(zeitstrahl === 4, `der Zeitstrahl hat vier Stufen fuer einen Bogen (${zeitstrahl})`);

  // --- Das Schloss ---------------------------------------------------------
  /*
   * Die wichtigste Pruefung der Bedienung, wie im NPC Creator: ohne das
   * Festhalten wuerfelt man den guten Aufhaenger weg, waehrend man die
   * Fraktionen sucht.
   */
  // Die Werte stehen in Eingabefeldern, nicht in <span>: alles im Entwurf
  // laesst sich von Hand ueberschreiben.
  const ersterSatz = () => js("document.querySelector('.karte .zeile .feld__wert').value");
  const vorher = await ersterSatz();
  await js(`(() => { const k=[...document.querySelectorAll('.karte')][0]
    .querySelector('.karte__knoepfe button'); k.click(); return true; })()`);
  await warte(200);
  pruefe(
    await js("[...document.querySelectorAll('.karte')][0].querySelector('.karte__knoepfe button').getAttribute('aria-pressed') === 'true'"),
    'der Aufhaenger laesst sich festhalten'
  );
  let gleich = true;
  for (let versuch = 0; versuch < 8; versuch += 1) {
    await js(`${wuerfeln}.click(); true`);
    await warte(140);
    if ((await ersterSatz()) !== vorher) gleich = false;
  }
  pruefe(gleich, 'und bleibt ueber acht Wuerfe stehen');

  // Der Knopf AM Baustein wuerfelt ihn trotzdem neu — er meint genau ihn.
  let geaendert = false;
  for (let versuch = 0; versuch < 12 && !geaendert; versuch += 1) {
    await js(`(() => { const k=[...document.querySelectorAll('.karte')][0]
      .querySelectorAll('.karte__knoepfe button')[1]; k.click(); return true; })()`);
    await warte(140);
    if ((await ersterSatz()) !== vorher) geaendert = true;
  }
  pruefe(geaendert, 'sein eigener Knopf wuerfelt ihn trotz Schloss neu');

  // --- Eine einzelne Zeile -------------------------------------------------
  const zweiter = await js("[...document.querySelectorAll('.karte .zeile .feld__wert')][1].value");
  let zeileNeu = false;
  for (let versuch = 0; versuch < 12 && !zeileNeu; versuch += 1) {
    await js("[...document.querySelectorAll('.karte .zeile__knopf')][1].click(); true");
    await warte(120);
    const jetzt = await js("[...document.querySelectorAll('.karte .zeile .feld__wert')][1].value");
    if (jetzt !== zweiter) zeileNeu = true;
  }
  pruefe(zeileNeu, 'eine einzelne Zeile laesst sich neu wuerfeln');
  pruefe(
    (await ersterSatz()) !== zweiter,
    'ohne die Nachbarzeile mitzunehmen'
  );

  // --- Der Umfang schlaegt durch ------------------------------------------
  await js(`(() => { const s=document.querySelector('select');
    const setz=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
    setz.call(s, 'kampagne'); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  await warte(200);
  await js(`${wuerfeln}.click(); true`);
  await warte(300);
  const figuren = await js("[...document.querySelectorAll('.karte')][2].querySelectorAll('.block').length");
  pruefe(figuren === 7, `eine Kampagne bringt sieben Figuren (${figuren})`);

  // --- Von Hand bearbeiten -------------------------------------------------
  /*
   * Ein Wurf ist ein Vorschlag, kein Ergebnis. Zwei Dinge muessen dabei
   * stimmen, und beide sieht man erst an der laufenden Anwendung: der eigene
   * Satz muss beim naechsten Wuerfeln stehen bleiben (der Baustein haelt sich
   * selbst fest), und eine umbenannte Figur muss auch in den Verbindungen
   * neu heissen.
   */
  const setzeFeld = (sel, wert) =>
    js(`(() => { const e=${sel};
      const art = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
      const setz=Object.getOwnPropertyDescriptor(art.prototype,'value').set;
      setz.call(e, ${JSON.stringify(wert)});
      e.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);

  await setzeFeld("document.querySelector('.karte .zeile .feld__wert')", 'Die Glocke hat geläutet.');
  await warte(250);
  pruefe((await ersterSatz()) === 'Die Glocke hat geläutet.', 'ein Satz laesst sich von Hand ersetzen');
  await js(`${wuerfeln}.click(); true`);
  await warte(250);
  pruefe(
    (await ersterSatz()) === 'Die Glocke hat geläutet.',
    'und bleibt beim naechsten Wuerfeln stehen — der Baustein haelt sich selbst fest'
  );

  const figurenKarte = "[...document.querySelectorAll('.karte')][2]";
  const alterName = await js(`${figurenKarte}.querySelector('.block__titel').value`);
  /*
   * Mit echtem focus() und blur(), nicht mit einem gebauten 'blur'-Ereignis:
   * React hoert auf focusin/focusout, und ein selbst erzeugtes 'blur' kommt
   * dort nie an. Beim ersten Anlauf schlug dieser Test genau daran fehl —
   * die Anwendung war in Ordnung, der Test nicht.
   */
  await js(`${figurenKarte}.querySelector('.block__titel').focus(); true`);
  await setzeFeld(`${figurenKarte}.querySelector('.block__titel')`, 'Zita Neuhafen');
  await js(`${figurenKarte}.querySelector('.block__titel').blur(); true`);
  await warte(300);
  const geflecht = await js(
    "[...[...document.querySelectorAll('.karte')][4].querySelectorAll('.feld__wert')].map(e=>e.value).join(' ')"
  );
  pruefe(geflecht.includes('Zita Neuhafen'), 'eine umbenannte Figur heisst auch im Geflecht neu');
  pruefe(!geflecht.includes(alterName), `und der alte Name ist weg (${alterName})`);

  // --- Das Geflecht gross ansehen ------------------------------------------
  /*
   * Klein steht es in der Karte, gross auf Klick. Beides gehoert hierher:
   * gross war es eine Weile fest in der Karte und draengte alles andere an
   * den Rand — die Rueckmeldung dazu war „viel zu gross".
   */
  pruefe(
    await js("Boolean(document.querySelector('.geflecht__knopf'))"),
    'das kleine Geflecht ist ein Knopf'
  );
  pruefe(
    !(await js("Boolean(document.querySelector('.geflecht-schirm'))")),
    'und das Vollbild ist zu, solange niemand darauf drueckt'
  );
  await js("document.querySelector('.geflecht__knopf').click(); true");
  await warte(300);
  pruefe(
    await js("Boolean(document.querySelector('.geflecht-schirm .geflecht'))"),
    'ein Klick oeffnet das Vollbild'
  );
  // Gross wird neu gerechnet und nicht gedehnt: die Zeichenflaeche ist eine
  // andere als die kleine.
  const flaechen = await js(
    "[...document.querySelectorAll('.geflecht')].map(e => e.getAttribute('viewBox'))"
  );
  pruefe(
    new Set(flaechen).size === flaechen.length,
    `klein und gross sind verschieden gerechnet (${flaechen.join(' | ')})`
  );
  await js(
    "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true"
  );
  await warte(300);
  pruefe(
    !(await js("Boolean(document.querySelector('.geflecht-schirm'))")),
    'Escape schliesst es wieder'
  );

  // --- Uebernehmen ---------------------------------------------------------
  const namen = await js(`[...[...document.querySelectorAll('.karte')][2].querySelectorAll('.block__titel')]
    .map(e => e.value.trim())`);
  await js(`(() => { const e=document.querySelector('.fuss__titel input');
    const setz=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setz.call(e, 'Der lange Winter');
    e.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await warte(200);
  await js("[...document.querySelectorAll('button')].find(b=>/Story Creator/.test(b.textContent)).click(); true");
  await warte(2500);
  const meldung = await js("document.querySelector('.fuss__meldung')?.textContent ?? ''");
  pruefe(
    /\d+/.test(meldung) && !(await js("Boolean(document.querySelector('.fuss__meldung--fehler'))")),
    `der Export meldet Vollzug (${meldung || 'nichts'})`
  );

  // --- Liegen die Notizen wirklich? ---------------------------------------
  const vault = path.join(tmp, 'userData', 'backstory', 'vault');
  const dateien = [];
  const suche = (ordner) => {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, e.name);
      // `history` auslassen. Der Story Creator legt dort zu jeder Notiz
      // eine Fassung ab — beim Anlegen also eine mit dem Titel und noch
      // leerem Rumpf. Beim ersten Anlauf zaehlte dieser Test deshalb 34 statt
      // 17 Notizen und verglich die Verweise gegen die leere Erstfassung.
      if (e.isDirectory()) { if (e.name !== 'history') suche(p); }
      else if (e.name.endsWith('.md')) dateien.push(p);
    }
  };
  try { suche(vault); } catch (e) { console.log('  (kein Vault:', e.message, ')'); }
  const texte = dateien.map((p) => fs.readFileSync(p, 'utf8'));
  // Uebersicht + 4 Fraktionen + 7 Figuren + 5 Orte = 17.
  pruefe(dateien.length === 17, `siebzehn Notizen liegen auf der Platte (${dateien.length})`);

  const uebersicht = texte.find((t) => t.includes('Der lange Winter'));
  pruefe(Boolean(uebersicht), 'die Uebersichtsnotiz ist dabei');
  const fehlendeVerweise = namen.filter((name) => !(uebersicht ?? '').includes(`[[${name}]]`));
  pruefe(
    fehlendeVerweise.length === 0,
    `sie verweist auf jede Figur (fehlt: ${fehlendeVerweise.join(', ') || 'nichts'})`
  );
  const mitVerbindung = texte.filter((t) => /\*\*[^*]+:\*\* .*\[\[/.test(t)).length;
  pruefe(mitVerbindung >= 7, `die Figurennotizen tragen ihre Verbindungen (${mitVerbindung})`);

  // --- Vorhandene Figuren holen -------------------------------------------
  /*
   * Nach dem Uebernehmen stehen die Figuren in der Kampagne. Genau von dort
   * holt dieser Knopf sie zurueck — und darueber auch die des NPC Creators,
   * der seine Figuren in dieselbe Kampagne legt. Geprueft wird hier der ganze
   * Weg: Vault, Hauptprozess, Bruecke, Liste, Anbindung ans Geflecht.
   */
  await js(
    "[...document.querySelectorAll('button')].find(b => /Aus der Kampagne|From the campaign/.test(b.textContent)).click(); true"
  );
  await warte(1200);
  const angeboten = await js("document.querySelectorAll('.holen__eintrag').length");
  pruefe(angeboten >= 7, `die Kampagnenfiguren stehen zur Auswahl (${angeboten})`);
  const schonDabei = await js("[...document.querySelectorAll('.holen__eintrag')].filter(b => b.disabled).length");
  pruefe(
    schonDabei === angeboten,
    `wer schon im Entwurf steht, ist ausgegraut (${schonDabei} von ${angeboten})`
  );

  /*
   * Jetzt eine Figur des Entwurfs umbenennen: ihre Notiz in der Kampagne
   * behaelt den alten Namen und ist damit frei zum Holen. (Beim ersten
   * Anlauf stand hier die Annahme, es sei ohnehin eine frei — nach dem
   * Uebernehmen sind aber genau die Figuren des Entwurfs in der Kampagne,
   * also keine.)
   */
  const umbenannt = await js(`${figurenKarte}.querySelector('.block__titel').value`);
  await js(`${figurenKarte}.querySelector('.block__titel').focus(); true`);
  await setzeFeld(`${figurenKarte}.querySelector('.block__titel')`, 'Jemand ganz anderes');
  await js(`${figurenKarte}.querySelector('.block__titel').blur(); true`);
  await warte(300);
  // Liste einmal zu und wieder auf, damit sie neu geholt wird.
  const holenKnopf =
    "[...document.querySelectorAll('button')].find(b => /Aus der Kampagne|From the campaign|Schließen|Close/.test(b.textContent))";
  await js(`${holenKnopf}.click(); true`);
  await warte(300);
  await js(`${holenKnopf}.click(); true`);
  await warte(1000);

  const freier = await js(
    "[...document.querySelectorAll('.holen__eintrag')].find(b => !b.disabled)?.querySelector('.holen__name')?.textContent ?? ''"
  );
  pruefe(freier === umbenannt, `die umbenannte Figur ist wieder zu haben (${freier || 'keine'})`);
  const vorherFiguren = await js(`${figurenKarte}.querySelectorAll('.block').length`);
  const vorherVerbindungen = await js(
    "[...document.querySelectorAll('.karte')][4].querySelectorAll('.block').length"
  );
  await js("[...document.querySelectorAll('.holen__eintrag')].find(b => !b.disabled).click(); true");
  await warte(400);
  pruefe(
    (await js(`${figurenKarte}.querySelectorAll('.block').length`)) === vorherFiguren + 1,
    'die geholte Figur steht im Entwurf'
  );
  pruefe(
    (await js("[...document.querySelectorAll('.karte')][4].querySelectorAll('.block').length")) ===
      vorherVerbindungen + 1,
    'und haengt gleich an einer Verbindung'
  );
  // In beiden Sprachen: welche die Huelle gerade eingestellt hat, entscheidet
  // sie, nicht dieser Test.
  const marke = await js(`${figurenKarte}.querySelector('.block__marke')?.textContent ?? ''`);
  pruefe(
    /aus der Kampagne|from the campaign/.test(marke),
    `sie ist als vorhanden gekennzeichnet (${marke || 'ohne Marke'})`
  );

  // --- Karte anlegen -------------------------------------------------------
  /*
   * Der Weg zum Karteneditor (Stufe 5 des Konzepts). Er geht ueber drei
   * Prozessgrenzen — Werkzeug, Hauptprozess, Karteneditor —, und genau dort
   * sieht ein Modelltest nichts: der Name muss ankommen, nachdem der Editor
   * montiert, geladen und sichtbar ist, nicht vorher.
   */
  const orteKarte = "[...document.querySelectorAll('.karte')][3]";
  const ortsname = await js(`${orteKarte}.querySelector('.block__titel').value`);
  const karteKnopf = await js(
    `Boolean([...${orteKarte}.querySelectorAll('button')].find(b => /Karte anlegen|Start a map/.test(b.textContent)))`
  );
  pruefe(karteKnopf === true, 'am Ort steht der Knopf zum Karteneditor');
  await js(
    `[...${orteKarte}.querySelectorAll('button')].find(b => /Karte anlegen|Start a map/.test(b.textContent)).click(); true`
  );
  /*
   * Ab hier wird gewartet, indem nachgesehen wird, nicht indem still Zeit
   * vergeht: die Meldung drueben steht nur vier Sekunden, und ein festes
   * `warte` haette sie je nach Rechner verpasst.
   */
  let map = null;
  for (let versuch = 0; versuch < 20 && !map; versuch += 1) {
    await warte(400);
    map = sicht('mapmaker');
  }
  pruefe(Boolean(map), 'der Karteneditor kommt nach vorn');
  if (map) {
    const mjsKarte = (a) => map.webContents.executeJavaScript(a);
    // Warten, bis der Name ankommt: der Editor kommt nach vorn, bevor die
    // Nachricht mit dem Namen verarbeitet ist.
    let name = '';
    for (let versuch = 0; versuch < 20 && name !== ortsname; versuch += 1) {
      name = await mjsKarte("document.querySelector('.map-name')?.textContent ?? ''");
      if (name !== ortsname) await warte(250);
    }
    pruefe(name === ortsname, `und die neue Karte heisst wie der Ort (${name} / ${ortsname})`);

    /*
     * Und sie ist nicht leer: was ueber den Ort bekannt ist, steht als Pin
     * darauf. Die erste Fassung schickte nur den Namen, und drueben stand man
     * vor einer leeren Flaeche — genau das war die Rueckmeldung.
     *
     * Gemessen wird an der Statuszeile des Karteneditors. Die Pins selbst
     * liegen im Dokument und werden auf eine Leinwand gezeichnet; im DOM sind
     * sie nicht zu finden, und das VTT-Panel ist beim Start zugeklappt.
     *
     * Die Meldung steht nur vier Sekunden. Der erste Anlauf schaute stur
     * sechs Sekunden nach dem Klick nach und fand nichts mehr — das sah aus
     * wie eine leere Karte und war eine abgelaufene Meldung.
     */
    // Das TIEFSTE Element mit der Meldung, nicht das erste: jeder Vorfahre
    // enthaelt sie ebenfalls, und die Fehlermeldung zeigte dann die halbe
    // Oberflaeche statt der Zeile, um die es geht.
    const suche =
      "[...document.querySelectorAll('*')].filter(e => /angelegt, mit|created, with/.test(e.textContent ?? '')).at(-1)?.textContent ?? ''";
    let status = '';
    for (let versuch = 0; versuch < 8 && !status; versuch += 1) {
      status = await mjsKarte(suche);
      if (!status) await warte(400);
    }
    pruefe(
      /[1-9]\d* (Notizen|notes)/.test(status),
      `auf der neuen Karte liegen Notizen (Statuszeile: ${status.slice(0, 80) || 'nichts'})`
    );
  }

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' | ') || 'keine'})`);

  console.log(
    fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen.` : '\nInspirationshilfe bestanden.'
  );
  app.exit(fehler.length ? 1 : 0);
});
