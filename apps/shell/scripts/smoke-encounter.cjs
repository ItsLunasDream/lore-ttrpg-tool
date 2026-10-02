/**
 * Rauchtest: der Encounter Creator, erste Stufe.
 *
 * Geprueft wird der Weg, den die Modultests nicht sehen: Kachel anklicken,
 * Begegnung anlegen, benennen, speichern — und ob sie nach einem Neustart
 * des Werkzeugs noch da ist. Genau an dieser Naht ist bisher am meisten
 * schiefgegangen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-encounter.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'encounter-smoke-'));
const userData = path.join(tmp, 'userData');
fs.mkdirSync(userData, { recursive: true });

/*
 * Ein Monster, das schon da liegt, bevor die Anwendung startet.
 *
 * Zweimal `monster` im Pfad: die Huelle gibt dem Werkzeug seinen eigenen
 * Unterordner, und die Ablage legt darin noch einen an. Genau die Stelle,
 * an der die Suche der Huelle lange danebengegriffen hat.
 */
const monsterordner = path.join(userData, 'monster', 'monster');
fs.mkdirSync(monsterordner, { recursive: true });
fs.writeFileSync(
  path.join(monsterordner, 'bounty-hounter.md'),
  [
    '---',
    'id: bounty-hounter',
    'name: Bounty Hounter',
    'cr: "5"',
    'thema: untot',
    'rolle: jaeger',
    'tp: 90',
    'rk: 15',
    'ge: 14',
    'geaendert: 2026-09-22T09:00:00.000Z',
    '---',
    '',
    '# Bounty Hounter',
    ''
  ].join('\n'),
  'utf8'
);

app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

const ordner = path.join(userData, 'encounter', 'encounter');
const dateien = () => {
  try {
    return fs.readdirSync(ordner).filter((d) => d.endsWith('.md'));
  } catch {
    return [];
  }
};

setTimeout(() => {
  console.log('\nABBRUCH: Zeitwaechter');
  app.exit(2);
}, 180000);

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

  // --- Die Kachel ist nicht mehr „spaeter" --------------------------------
  const marke = await hjs(
    `document.querySelector('.kachel[data-app="encounter"]')?.className ?? 'fehlt'`
  );
  pruefe(/kachel--bereit/.test(marke), `die Kachel ist bereit (${marke})`);

  await hjs(
    `(() => { const k = document.querySelector('.kachel[data-app="encounter"]:not(:disabled)');
      if (k) k.click(); return Boolean(k); })()`
  );
  await warte(5000);

  const sicht = fenster.contentView.children.find((v) =>
    v.webContents.getURL().includes('/apps/encounter/')
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
    /Encounter Creator/.test(await js('document.body.innerText')),
    'und zeigt seine Ueberschrift'
  );

  // --- Anlegen -------------------------------------------------------------
  //
  // Ohne Namensabfrage: der Knopf fuehrt gleich in die Begegnung, und auf
  // die Platte kommt sie erst mit dem Speichern.
  await js(
    `[...document.querySelectorAll('button')].find(b => /Neue Begegnung|New encounter/.test(b.textContent)).click(); true`
  );
  await warte(500);
  pruefe(
    (await js("document.querySelectorAll('.gegnerliste, .hinweis').length")) > 0 &&
      dateien().length === 0,
    'der Knopf oeffnet gleich die Begegnung, ohne erst nach dem Namen zu fragen'
  );
  await js(`(() => {
    const feld = document.querySelector('.feld__eingabe');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(feld, 'Hinterhalt am Fluss');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await warte(300);
  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);

  pruefe(dateien().length === 1, `die Begegnung liegt auf der Platte (${dateien().join(', ')})`);
  pruefe(
    dateien()[0] === 'hinterhalt-am-fluss.md',
    `und zwar unter einem lesbaren Namen (${dateien()[0]})`
  );

  // --- Eine Notiz dazu, speichern -----------------------------------------
  await js(`(() => {
    const flaeche = document.querySelector('.feld__flaeche');
    if (!flaeche) return false;
    const setzer = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setzer.call(flaeche, 'Die Bruecke bricht in Runde 3.');
    flaeche.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await warte(300);
  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);

  const aufDerPlatte = fs.readFileSync(path.join(ordner, 'hinterhalt-am-fluss.md'), 'utf8');
  pruefe(/Die Bruecke bricht in Runde 3\./.test(aufDerPlatte), 'die Notiz steht in der Datei');
  pruefe(/^---/.test(aufDerPlatte) && /name: /.test(aufDerPlatte), 'mit Kopfzahlen darueber');

  // --- Der Monsterkatalog --------------------------------------------------
  //
  // Die eigenen Monster liegen schon auf der Platte, ohne dass der Monster
  // Creator in dieser Sitzung offen war: die Werkzeuge treffen sich ueber
  // Dateien. Daneben stehen die offiziellen aus dem SRD.
  const tippe = (wert) => js(`(() => {
    const feld = document.querySelector('.katalog__suche');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(feld, ${JSON.stringify(wert)});
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  const zeilen = () => js("document.querySelectorAll('.katalog__zeile').length");
  const anzahlText = () => js("document.querySelector('.katalog .anzahl')?.textContent ?? ''");

  pruefe(/33[12]/.test(await anzahlText()), `der Katalog fuehrt SRD und eigene (${await anzahlText()})`);

  await js(`document.querySelector('[data-quelle="eigen"]').click(); true`);
  await warte(250);
  pruefe((await zeilen()) === 1, 'nur eigene: das Monster aus der Sammlung');
  pruefe(
    /Bounty Hounter/.test(await js("document.querySelector('.katalog__zeile')?.textContent ?? ''")),
    'und zwar mit seinem Namen'
  );
  for (const [wort, erwartet] of [
    ['bounty', 1],
    ['untot', 1],
    ['drache', 0]
  ]) {
    await tippe(wort);
    await warte(250);
    const treffer = await zeilen();
    pruefe(treffer === erwartet, `„${wort}" findet ${erwartet} (${treffer})`);
  }
  await tippe('');
  await warte(250);

  // Offiziell: Typ, legendaer, Sortierung nach Grad.
  await js(`document.querySelector('[data-quelle="srd"]').click(); true`);
  await warte(300);
  pruefe(/331/.test(await anzahlText()), `offiziell sind es 331 (${await anzahlText()})`);
  await js(`(() => {
    const wahl = document.querySelector('select[data-filter="typ"]');
    const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setzer.call(wahl, 'dragon');
    wahl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await js(`document.querySelector('input[data-filter="legendaer"]').click(); true`);
  await warte(300);
  const drachen = await zeilen();
  pruefe(
    drachen > 5 && (await js("[...document.querySelectorAll('.katalog__zeile')].every(z => z.textContent.includes('★'))")),
    `Typ und legendaer filtern (${drachen} legendaere Drachen)`
  );
  await js(`document.querySelector('[data-sortiere="hg"]').click(); true`);
  await warte(250);
  const oberster = await js("document.querySelector('.katalog__zeile td:nth-child(3)')?.textContent");
  pruefe(oberster === '24', `nach Grad sortiert steht der staerkste oben (HG ${oberster})`);
  await js(`document.querySelector('.katalog__zeile .katalog__name').click(); true`);
  await warte(250);
  const blatt = await js("document.querySelector('.wertekasten')?.textContent ?? ''");
  pruefe(/Legendary Actions|Legendäre Aktionen/.test(blatt), 'ein Klick auf den Namen zeigt den ganzen Wertekasten');

  // Zurueck auf die eigenen; zweimal dazu ergibt Anzahl 2, nicht zwei Zeilen.
  await js(`document.querySelector('input[data-filter="legendaer"]').click(); true`);
  await js(`(() => {
    const wahl = document.querySelector('select[data-filter="typ"]');
    const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setzer.call(wahl, '');
    wahl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await js(`document.querySelector('[data-quelle="eigen"]').click(); true`);
  await warte(300);
  await js("document.querySelector('.katalog__dazu').click(); true");
  await warte(250);
  await js("document.querySelector('.katalog__dazu').click(); true");
  await warte(350);
  pruefe(
    (await js("document.querySelectorAll('.gegnerzeile').length")) === 1,
    'zweimal dasselbe Monster ist eine Zeile'
  );
  pruefe(
    (await js("document.querySelector('.gegnerzeile__anzahl')?.value")) === '2',
    'und zwar mit der Anzahl zwei'
  );

  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);
  const mitGegnern = fs.readFileSync(path.join(ordner, 'hinterhalt-am-fluss.md'), 'utf8');
  pruefe(/"anzahl":2/.test(mitGegnern), 'die Gegner stehen im Kopf der Datei');
  pruefe(/- 2× Bounty Hounter/.test(mitGegnern), 'und lesbar im Leib');

  // --- Die Umgebung in ihren zwei Sorten -----------------------------------
  //
  // Der Punkt dieser Stufe: es stehen zwei getrennte Listen da. Was man
  // sieht ist zum Vorlesen, was wirkt hat eine Zahl. Ein Blatt mit nur
  // einer der beiden Sorten waere die halbe Arbeit.
  pruefe(
    (await js("document.querySelectorAll('.umgebung').length")) === 0,
    'ohne Wahl steht kein Umgebungsblatt da'
  );
  // Gewaehlt wird an Kacheln mit Zeichen, nicht in einer Auswahlliste.
  pruefe(
    (await js("document.querySelectorAll('.umgebungskachel[data-umgebung]').length")) >= 17,
    'die Umgebungen stehen als Kacheln da'
  );
  await js(`document.querySelector('.umgebungskachel[data-umgebung="wald"]').click(); true`);
  await warte(350);
  pruefe(
    await js(`document.querySelector('.umgebungskachel[data-umgebung="wald"]').getAttribute('aria-pressed') === 'true'`),
    'die gewaehlte Kachel ist markiert'
  );
  // Zu- und wieder aufklappen; zugeklappt nennt der Kopf die Wahl.
  await js(`document.querySelector('.klappe[data-klappe="umgebung"] .klappe__kopf').click(); true`);
  await warte(250);
  const zu = await js(`document.querySelector('.klappe[data-klappe="umgebung"]').textContent`);
  pruefe(
    (await js("document.querySelectorAll('.umgebungswahl').length")) === 0 && /Wald|Forest/i.test(zu),
    `die Umgebung laesst sich zuklappen und nennt dann die Wahl (${zu.slice(0, 40)})`
  );
  await js(`document.querySelector('.klappe[data-klappe="umgebung"] .klappe__kopf').click(); true`);
  await warte(250);
  pruefe(
    (await js("document.querySelectorAll('.umgebung__teil').length")) === 2,
    'nach der Wahl stehen beide Sorten da'
  );
  pruefe(
    (await js("document.querySelectorAll('.umgebung__teil:not(.umgebung__teil--regeln) li').length")) > 0,
    'was man sieht, hat Zeilen'
  );
  pruefe(
    (await js("document.querySelectorAll('.umgebung__teil--regeln li').length")) > 0,
    'was wirkt, hat Zeilen'
  );
  pruefe(
    (await js("document.querySelectorAll('.umgebung__wert').length")) > 0,
    'und mindestens eine Regel traegt ihre Zahl als Marke'
  );

  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);
  pruefe(
    /^umgebung: /m.test(fs.readFileSync(path.join(ordner, 'hinterhalt-am-fluss.md'), 'utf8')),
    'die Umgebung steht im Kopf der Datei'
  );

  // --- Zwei gleichnamige ueberschreiben einander nicht ---------------------
  await js(
    `[...document.querySelectorAll('button')].find(b => /Zurück zur Liste|Back to the list/.test(b.textContent)).click(); true`
  );
  await warte(500);
  await js(
    `[...document.querySelectorAll('button')].find(b => /Neue Begegnung|New encounter/.test(b.textContent)).click(); true`
  );
  await warte(400);
  await js(`(() => {
    const feld = document.querySelector('.feld__eingabe');
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(feld, 'Hinterhalt am Fluss');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await warte(300);
  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);
  pruefe(
    dateien().length === 2,
    `die zweite gleichnamige ueberschreibt die erste nicht (${dateien().join(', ')})`
  );

  // Ohne Namen gespeichert heisst sie „Encounter_1".
  await js(
    `[...document.querySelectorAll('button')].find(b => /Zurück zur Liste|Back to the list/.test(b.textContent)).click(); true`
  );
  await warte(500);
  await js(
    `[...document.querySelectorAll('button')].find(b => /Neue Begegnung|New encounter/.test(b.textContent)).click(); true`
  );
  await warte(400);
  await js(
    `[...document.querySelectorAll('button')].find(b => /^(Speichern|Save)$/.test(b.textContent.trim())).click(); true`
  );
  await warte(900);
  pruefe(
    dateien().includes('encounter-1.md') &&
      /name: Encounter_1/.test(fs.readFileSync(path.join(ordner, 'encounter-1.md'), 'utf8')),
    `ohne Namen gespeichert heisst sie Encounter_1 (${dateien().join(', ')})`
  );

  // --- Zusammenstellen lassen -------------------------------------------------
  //
  // Die umgekehrte Richtung: Ziel HG 5, vier Gegner, nur offizielle.
  await js(`(() => {
    const wahl = document.querySelector('select[data-bau="grad"]');
    const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setzer.call(wahl, '5');
    wahl.dispatchEvent(new Event('change', { bubbles: true }));
    const feld = document.querySelector('input[data-bau="anzahl"]');
    const zahl = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    zahl.call(feld, '4');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-bau-quelle="srd"]').click();
    return true;
  })()`);
  await warte(300);
  await js(`document.querySelector('[data-bau="los"]').click(); true`);
  await warte(600);
  const gebaut = await js(
    "[...document.querySelectorAll('.gegnerzeile__anzahl')].reduce((s, e) => s + Number(e.value), 0)"
  );
  const bericht = await js("document.querySelector('[data-bau-ergebnis]')?.textContent ?? ''");
  pruefe(gebaut === 4, `zusammengestellt: genau vier Gegner (${gebaut})`);
  pruefe(
    /1[.,]800/.test(bericht) && /(HG|CR) 5/.test(bericht),
    `mit Ziel und Ergebnis daneben (${bericht.slice(0, 80)})`
  );
  pruefe(
    await js("[...document.querySelectorAll('.gegnerzeile')].every(z => z.dataset.monster.startsWith('srd:'))"),
    'und nur aus den offiziellen, wie gewaehlt'
  );

  // --- Die Sammlung --------------------------------------------------------
  // Die Zusammenstellung ist nicht gespeichert: „Zurueck" fragt nach, statt
  // sie still zu verwerfen. Hier wird die Rueckfrage mit „Ja" beantwortet.
  await js(`window.__gefragt = 0; window.confirm = () => { window.__gefragt += 1; return true; }; true`);
  await js(
    `[...document.querySelectorAll('button')].find(b => /Zurück zur Liste|Back to the list/.test(b.textContent)).click(); true`
  );
  await warte(700);
  pruefe((await js('window.__gefragt')) === 1, 'Zurueck mit ungespeicherter Zusammenstellung fragt nach');
  pruefe(
    (await js("document.querySelectorAll('.begegnungskachel').length")) === 3,
    'alle drei stehen in der Sammlung'
  );

  // --- Die Suche der Huelle findet sie, ohne dass sie offen war ------------
  const eintraege = await hjs('window.shell.suche.eintraege()');
  const meine = (eintraege ?? []).filter((e) => e.werkzeug === 'encounter');
  pruefe(meine.length === 3, `die Suche der Huelle kennt sie (${meine.length})`);

  // --- Der Weg in den Initiative Tracker -----------------------------------
  //
  // Der eigentliche Zweck des Werkzeugs, und die Naht, die kein Modultest
  // sieht: Knopf im einen Werkzeug, Huelle holt das andere nach vorn,
  // dort stehen Teilnehmer und Terrain. Drei Prozessgrenzen auf einmal.
  await js(
    `document.querySelector('.begegnungskachel[data-id="hinterhalt-am-fluss"]').click(); true`
  );
  await warte(800);
  pruefe(
    (await js("document.querySelectorAll('.gegnerzeile').length")) === 1,
    'die Begegnung ist wieder offen'
  );

  // --- Das Verhaeltnis, und ausdruecklich kein Urteil -----------------------
  //
  // Ohne eingetragene Gruppe steht die Gradsumme trotzdem da. Das Monster
  // hat Grad 5 und ist zweimal dabei, also zehn.
  pruefe(
    (await js("document.querySelectorAll('.verhaeltnis').length")) === 1,
    'das Verhaeltnis steht bei einer Begegnung mit Gegnern da'
  );
  const ohneGruppe = await js("document.querySelector('.verhaeltnis')?.textContent ?? ''");
  pruefe(/10/.test(ohneGruppe), `die Gradsumme rechnet die Anzahl ein (${ohneGruppe.slice(0, 40)})`);
  pruefe(
    /keine Gruppe|no party/i.test(ohneGruppe),
    'und ohne Gruppe sagt es das, statt etwas zu behaupten'
  );
  // Ohne Gruppe gibt es auch keine Einordnung — und das Werkzeug sagt,
  // warum, statt das Urteil stillschweigend wegzulassen.
  pruefe(
    ohneGruppe.length > 10 && !/data-einordnung="[a-z]/.test(
      await js("document.querySelector('.verhaeltnis')?.outerHTML ?? ''")
    ),
    'und ohne Gruppe keine Einordnung'
  );
  pruefe(
    /fehlt die Gruppe|needs the party/i.test(ohneGruppe),
    'sondern der Hinweis, dass die Gruppe fehlt'
  );

  // Die Gruppe steht im Werkzeug selbst, nicht in den Einstellungen der
  // Huelle: sie aendert sich von Abend zu Abend. 3x4 und 1x6 eintragen,
  // so wie ein Mensch es tut.
  const setzeZahl = (zeile, stelle, wert) => js(`(() => {
    const feld = document.querySelectorAll('[data-gruppenzeile="${zeile}"] input')[${stelle}];
    if (!feld) return false;
    const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setzer.call(feld, '${wert}');
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await js(`document.querySelector('[data-gruppe-dazu]').click(); true`);
  await warte(300);
  await setzeZahl(0, 0, 3);
  await warte(200);
  await setzeZahl(0, 1, 4);
  await warte(200);
  await js(`document.querySelector('[data-gruppe-dazu]').click(); true`);
  await warte(300);
  await setzeZahl(1, 0, 1);
  await warte(200);
  // Eine dritte Zeile, gleich wieder löschen, und noch während sie ausblendet
  // die Stufe der zweiten eintragen: die Eingabe darf nicht verloren gehen.
  await js(`document.querySelector('[data-gruppe-dazu]').click(); true`);
  await warte(300);
  await js(`document.querySelector('[data-gruppenzeile="2"] .gegnerzeile__weg').click(); true`);
  await warte(30);
  await setzeZahl(1, 1, 6);
  await warte(600);
  pruefe(
    (await js(`document.querySelectorAll('[data-gruppenzeile]').length`)) === 2,
    'die gelöschte Zeile ist weg'
  );
  pruefe(
    /3x4, 1x6/.test(fs.readFileSync(path.join(ordner, 'einstellungen.json'), 'utf8')),
    'die Gruppe, im Werkzeug eingetragen, liegt so auf der Platte'
  );
  const mitGruppe = await js("document.querySelector('.verhaeltnis')?.textContent ?? ''");
  pruefe(/4/.test(mitGruppe) && /6/.test(mitGruppe), `die Gruppe steht daneben (${mitGruppe.slice(0, 60)})`);
  pruefe(
    !/keine Gruppe|no party/i.test(mitGruppe),
    'und der Hinweis auf die fehlende Gruppe ist weg'
  );

  // Und jetzt steht die Einordnung da, aus dem Regelwerk gerechnet.
  //
  // Zweimal das Monster mit Grad 5 sind 3.600 EP. Die Gruppe (3x4, 1x6)
  // hat ein hohes Budget von 3 x 500 + 1.400 = 2.900 EP, und das
  // Anderthalbfache davon ist 4.350 — die Begegnung liegt also im
  // hohen Bereich.
  const kasten = await js("document.querySelector('.verhaeltnis')?.outerHTML ?? ''");
  pruefe(/data-einordnung="hoch"/.test(kasten), `die Einordnung steht da (${
    (/data-einordnung="([a-z]*)"/.exec(kasten) ?? [])[1] ?? 'keine'
  })`);
  pruefe(
    /3[.,]600|3600/.test(mitGruppe),
    'mit den Erfahrungspunkten, aus denen sie entstanden ist'
  );
  pruefe(
    fs.existsSync(path.join(ordner, 'einstellungen.json')),
    'die Gruppe liegt auf der Platte'
  );

  await js(`document.querySelector('button[data-tracker]').click(); true`);
  await warte(6000);

  const tracker = fenster.contentView.children.find((v) =>
    v.webContents.getURL().includes('/apps/initiative/')
  );
  pruefe(Boolean(tracker), 'der Tracker kommt hoch');
  if (tracker) {
    const tjs = (a) => tracker.webContents.executeJavaScript(a);
    const text = await tjs('document.body.innerText');
    pruefe(/Bounty Hounter/.test(text), 'die Gegner stehen im Tracker');
    // Die Sprache der Huelle entscheidet, ob „Wald" oder „Forest"
    // dasteht — der Name kommt aus `packages/umgebungen` und wandert
    // uebersetzt mit. Der Rauchtest darf sich darauf nicht festlegen.
    // Die Sprache der Huelle entscheidet, ob „Wald" oder „Forest"
    // dasteht, und das Aussehen macht daraus Kleinschreibung — der
    // Rauchtest darf sich auf beides nicht festlegen.
    pruefe(/wald|forest/i.test(text), 'und die Umgebung als Terrain');
    // Die Regel selbst, nicht nur der Name der Umgebung: sie ist der
    // Grund, warum die Umgebung ueberhaupt mitwandert.
    pruefe(
      /sight|sicht|undergrowth|unterholz/i.test(text),
      'samt der Regel, die am Tisch wirkt'
    );
    /*
     * Zwei Wolfskoerper unter EINEM Eintrag, nicht zwei Eintraege: eine
     * Gruppe wuerfelt einmal Initiative. Genau dafuer hat der Tracker
     * seine Koerper.
     */
    const zeilen = await tjs("document.querySelectorAll('.zeile').length");
    const terrain = await tjs("document.querySelectorAll('.zeile--terrain').length");
    pruefe(zeilen === 3, `ein Eintrag fuer die Gruppe, zwei fuers Terrain (${zeilen})`);
    pruefe(terrain === 2, `jede Regel der Umgebung ist ein eigener Eintrag (${terrain})`);
    pruefe(
      /Hinterhalt am Fluss/.test(text),
      'und der Kampf traegt den Namen der Begegnung'
    );
    // Der Statblock reist mit und steht per Klick bereit.
    pruefe(
      await tjs("Boolean(document.querySelector('[data-statblock-knopf]'))"),
      'der Gegner hat einen Statblock-Knopf'
    );
    await tjs("document.querySelector('[data-statblock-knopf]').click(); true");
    await warte(300);
    const block = await tjs("document.querySelector('[data-statblock]')?.innerText ?? ''");
    pruefe(/Bounty Hounter/.test(block), `und der Statblock geht auf (${block.slice(0, 40).replace(/\n/g, ' ')})`);
    await tjs("document.querySelector('.statblock-fenster__zu').click(); true");
  }

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nEncounter bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
