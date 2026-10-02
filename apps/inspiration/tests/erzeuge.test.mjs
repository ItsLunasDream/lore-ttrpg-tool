import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../dist/tests/entry.cjs');

/** Ein Zufallsgeber mit Gedaechtnis, damit ein Fehlschlag wiederholbar ist. */
function wuerfelgeber(saat = 1) {
  let zustand = saat >>> 0;
  return () => {
    zustand += 0x6d2b79f5;
    let x = zustand;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const ZU = T.STANDARD_ZUSCHNITT;

test('derselbe Wurf zweimal ergibt dasselbe', () => {
  // Grundlage aller anderen Tests: ohne das waeren Fehlschlaege nicht
  // nachstellbar.
  const a = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(7));
  const b = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(7));
  assert.deepEqual(a, b);
});

test('zweihundert Aufhaenger sind zweihundert verschiedene', () => {
  // Der eigentliche Anspruch an dieses Werkzeug: nicht immer dieselben fuenf
  // Optionen. Bei ueber hunderttausend Kombinationen waeren Doppelungen in
  // zweihundert Wuerfen ein Zeichen dafuer, dass irgendwo doch nur aus einer
  // kurzen Liste gezogen wird.
  const wuerfel = wuerfelgeber(11);
  const gesehen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const haken = T.erzeugeAufhaenger(ZU, 'de', wuerfel);
    gesehen.add(`${haken.ausloeser}|${haken.betroffene}|${haken.komplikation}`);
  }
  assert.equal(gesehen.size, 200);
});

test('auch die einzelnen Zeilen wiederholen sich selten', () => {
  // Strenger als der Test darueber: hier zaehlt jede Spalte fuer sich. Bei
  // fuenfzig Ausloesern und zweihundert Wuerfen sind Wiederholungen normal —
  // aber wenn eine Spalte nur drei verschiedene Werte liefert, ist etwas
  // kaputt.
  const wuerfel = wuerfelgeber(23);
  const ausloeser = new Set();
  const komplikationen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const haken = T.erzeugeAufhaenger(ZU, 'de', wuerfel);
    ausloeser.add(haken.ausloeser);
    komplikationen.add(haken.komplikation);
  }
  assert.ok(ausloeser.size > T.AUSLOESER.length * 0.8, `nur ${ausloeser.size} Ausloeser`);
  assert.ok(komplikationen.size > T.KOMPLIKATIONEN.length * 0.8, `nur ${komplikationen.size} Komplikationen`);
});

test('hundert Orte tragen fast hundert verschiedene Namen', () => {
  const wuerfel = wuerfelgeber(5);
  const namen = new Set();
  for (let i = 0; i < 100; i += 1) namen.add(T.erzeugeName('de', wuerfel));
  assert.ok(namen.size >= 95, `nur ${namen.size} verschiedene Namen`);
});

test('ein Ortsname setzt sich aus zwei Haelften zusammen, in beiden Sprachen', () => {
  const deutsch = T.erzeugeName('de', wuerfelgeber(3));
  const englisch = T.erzeugeName('en', wuerfelgeber(3));
  // Dieselbe Saat, dieselben Stellen in den Tabellen — also dieselbe
  // Bedeutung in zwei Sprachen und nicht zwei zufaellige Namen.
  const stelleErste = T.NAME_ERSTE.findIndex((paar) => deutsch.startsWith(paar.de));
  assert.ok(stelleErste >= 0);
  assert.ok(englisch.startsWith(T.NAME_ERSTE[stelleErste].en));
});

test('der Umfang entscheidet, wie viel entsteht', () => {
  for (const umfang of T.UMFAENGE) {
    const entwurf = T.erzeugeEntwurf({ ...ZU, umfang }, 'de', wuerfelgeber(2));
    const menge = T.MENGEN[umfang];
    assert.equal(entwurf.fraktionen.length, menge.fraktionen, umfang);
    assert.equal(entwurf.figuren.length, menge.figuren, umfang);
    assert.equal(entwurf.orte.length, menge.orte, umfang);
    assert.equal(entwurf.zeitstrahl.length, menge.schritte, umfang);
  }
});

test('ein festgehaltener Baustein bleibt beim Nachwuerfeln stehen', () => {
  // Das Schloss je Baustein, wie im NPC Creator. Ohne diesen Test faellt erst
  // am Tisch auf, dass der gute Aufhaenger weg ist.
  const erst = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(1));
  const zweit = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(99), ['aufhaenger', 'orte'], erst);
  assert.deepEqual(zweit.aufhaenger, erst.aufhaenger);
  assert.deepEqual(zweit.orte, erst.orte);
  assert.notDeepEqual(zweit.figuren, erst.figuren);
  assert.notDeepEqual(zweit.fraktionen, erst.fraktionen);
});

test('ohne Vorlage greift ein Schloss ins Leere, statt zu stoeren', () => {
  const entwurf = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(4), T.BAUSTEINE, null);
  assert.ok(entwurf.figuren.length > 0);
  assert.ok(entwurf.aufhaenger.ausloeser.length > 0);
});

test('festgehaltene Verbindungen ueberleben nur, solange die Figuren da sind', () => {
  // Verbindungen zeigen auf Stellen in der Figurenliste. Schrumpft die Liste,
  // zeigte eine festgehaltene Verbindung ins Nichts — und im Geflecht waere
  // das eine Linie zu einem Knoten, den es nicht gibt.
  const gross = T.erzeugeEntwurf({ ...ZU, umfang: 'kampagne' }, 'de', wuerfelgeber(8));
  assert.ok(gross.verbindungen.length > 3);
  const klein = T.erzeugeEntwurf(
    { ...ZU, umfang: 'abend' },
    'de',
    wuerfelgeber(9),
    ['verbindungen'],
    gross
  );
  for (const verbindung of klein.verbindungen) {
    assert.ok(verbindung.a < klein.figuren.length && verbindung.b < klein.figuren.length);
  }
});

test('jede Figur haengt an mindestens einer anderen', () => {
  // Eine Figur ohne Verbindung ist am Tisch ein Name ohne Anschluss. Bei rein
  // zufaelligen Paaren passiert genau das regelmaessig.
  for (const saat of [1, 2, 3, 4, 5]) {
    const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'kampagne' }, 'de', wuerfelgeber(saat));
    const beteiligt = new Set();
    for (const verbindung of entwurf.verbindungen) {
      beteiligt.add(verbindung.a);
      beteiligt.add(verbindung.b);
    }
    assert.equal(beteiligt.size, entwurf.figuren.length, `Saat ${saat}`);
  }
});

test('eine Verbindung nennt beide Namen und keinen Platzhalter mehr', () => {
  const entwurf = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(12));
  for (const verbindung of entwurf.verbindungen) {
    const a = entwurf.figuren[verbindung.a].name;
    const b = entwurf.figuren[verbindung.b].name;
    const beides = `${verbindung.hin} ${verbindung.zurueck}`;
    assert.ok(beides.includes(a), `${a} fehlt in "${beides}"`);
    assert.ok(beides.includes(b), `${b} fehlt in "${beides}"`);
    assert.ok(!beides.includes('{a}') && !beides.includes('{b}'));
  }
});

test('der Zeitstrahl steigert sich und wiederholt sich nicht', () => {
  const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'kampagne' }, 'de', wuerfelgeber(6));
  const texte = entwurf.zeitstrahl.map((punkt) => punkt.was);
  assert.equal(new Set(texte).size, texte.length);

  const stufe = (was) => T.SCHRITTE.find((schritt) => schritt.de === was).stufe;
  const stufen = texte.map(stufe);
  // Nicht streng steigend — gleich bleiben darf er, zurueckfallen nicht.
  for (let i = 1; i < stufen.length; i += 1) {
    assert.ok(stufen[i] >= stufen[i - 1], `Stufe faellt: ${stufen.join(',')}`);
  }
  assert.equal(stufen[0], 1);
  assert.equal(stufen[stufen.length - 1], 3);
});

test('die Zeitmarken stehen in der Reihenfolge des Umfangs', () => {
  const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'abend' }, 'de', wuerfelgeber(13));
  const erwartet = T.ZEITMARKEN.abend.slice(0, entwurf.zeitstrahl.length).map((paar) => paar.de);
  assert.deepEqual(entwurf.zeitstrahl.map((punkt) => punkt.marke), erwartet);
});

test('der Zuschnitt schlaegt bis in den Entwurf durch', () => {
  // Ein Regler, der nichts bewirkt, ist schlimmer als keiner: man stellt ihn
  // ein und glaubt, es haette geholfen.
  const unterreich = { ...ZU, region: 'unterreich', umfang: 'kampagne' };
  const passende = new Set(T.passend(T.ORT_ART, unterreich).map((eintrag) => eintrag.de));
  for (const saat of [1, 2, 3]) {
    const entwurf = T.erzeugeEntwurf(unterreich, 'de', wuerfelgeber(saat));
    for (const ort of entwurf.orte) assert.ok(passende.has(ort.art), ort.art);
  }
});

test('zwei Orte im selben Entwurf sind nicht derselbe', () => {
  for (const saat of [1, 2, 3, 4, 5, 6]) {
    const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'kampagne' }, 'de', wuerfelgeber(saat));
    const namen = entwurf.orte.map((ort) => ort.name);
    assert.equal(new Set(namen).size, namen.length, `Saat ${saat}`);
  }
});

test('eine Frist kommt vor, aber nicht immer', () => {
  const wuerfel = wuerfelgeber(21);
  let mit = 0;
  for (let i = 0; i < 300; i += 1) {
    if (T.erzeugeAufhaenger(ZU, 'de', wuerfel).frist) mit += 1;
  }
  assert.ok(mit > 120 && mit < 240, `${mit} von 300 mit Frist`);
});

test('englisch gewuerfelt kommt englisch heraus', () => {
  const entwurf = T.erzeugeEntwurf(ZU, 'en', wuerfelgeber(15));
  const englisch = new Set(T.AUSLOESER.map((eintrag) => eintrag.en));
  assert.ok(englisch.has(entwurf.aufhaenger.ausloeser));
});

test('die Zahl der Moeglichkeiten ist gross und stimmt mit den Tabellen ueberein', () => {
  const zahlen = T.moeglichkeiten();
  assert.equal(
    zahlen.aufhaenger,
    T.AUSLOESER.length * T.BETROFFENE.length * T.KOMPLIKATIONEN.length * (T.FRISTEN.length + 1)
  );
  // Die Zahl steht in der Oberflaeche. Faellt sie unter eine Million, steht
  // dort eine Angabe, die niemanden mehr beeindruckt — und das waere ein
  // ehrliches Zeichen dafuer, dass die Tabellen zu duenn geworden sind.
  assert.ok(zahlen.aufhaenger > 1_000_000, zahlen.aufhaenger);
  assert.ok(zahlen.orte > 1_000_000, zahlen.orte);
  assert.ok(zahlen.figuren > 1_000_000, zahlen.figuren);
});

test('eine ausgetauschte Figur nimmt ihre Verbindungen mit', () => {
  // Die Namen stehen in den Verbindungen fest drin. Ohne das Nachziehen
  // spraeche das Geflecht von jemandem, den es nicht mehr gibt.
  const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'kampagne' }, 'de', wuerfelgeber(31));
  const alt = entwurf.figuren[2].name;
  const neue = { ...T.erzeugeFigur(ZU, 'de', wuerfelgeber(32)), name: 'Zita Neuhafen' };
  const danach = T.ersetzeFigur(entwurf, 2, neue, ZU, 'de', wuerfelgeber(33));

  assert.equal(danach.figuren[2].name, 'Zita Neuhafen');
  const betroffen = danach.verbindungen.filter((v) => v.a === 2 || v.b === 2);
  assert.ok(betroffen.length > 0, 'die Figur haengt an mindestens einer Verbindung');
  for (const verbindung of betroffen) {
    const text = `${verbindung.hin} ${verbindung.zurueck}`;
    assert.ok(text.includes('Zita Neuhafen'), text);
    assert.ok(!text.includes(alt), `der alte Name steht noch da: ${text}`);
  }
  // Und die uebrigen bleiben unangetastet — sonst waere das Nachziehen ein
  // heimlicher Neuwurf des ganzen Geflechts.
  const unbeteiligt = (v) => v.a !== 2 && v.b !== 2;
  assert.deepEqual(danach.verbindungen.filter(unbeteiligt), entwurf.verbindungen.filter(unbeteiligt));
});

test('eine umbenannte Figur heisst auch in ihren Verbindungen neu', () => {
  // Fuer die Bearbeitung von Hand. Ohne das zeigte der Verweis im Export ins
  // Leere, und im Geflecht staende ein Name, den es nicht mehr gibt.
  const entwurf = T.erzeugeEntwurf({ ...ZU, umfang: 'bogen' }, 'de', wuerfelgeber(17));
  const alt = entwurf.figuren[1].name;
  const danach = T.benenneFigurUm(entwurf, 1, 'Edda Wolfsfurt', alt);

  assert.equal(danach.figuren[1].name, 'Edda Wolfsfurt');
  for (const verbindung of danach.verbindungen) {
    const text = `${verbindung.hin} ${verbindung.zurueck}`;
    assert.ok(!text.includes(alt), text);
  }
  const betroffen = danach.verbindungen.filter((v) => v.a === 1 || v.b === 1);
  assert.ok(betroffen.some((v) => `${v.hin} ${v.zurueck}`.includes('Edda Wolfsfurt')));
});

test('kurz doppelter Name: zurückbenennen nimmt der Gegenseite ihren Namen nicht', () => {
  // So im Smoke-Test aufgefallen: Figur 2 heißt kurz wie Figur 1 und dann
  // wieder wie vorher. Vorher tauschte das zweite Umbenennen beide Namen.
  const entwurf = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(18));
  const v = entwurf.verbindungen[0];
  const [eins, zwei] = [v.a, v.b];
  const nameEins = entwurf.figuren[eins].name;
  const nameZwei = entwurf.figuren[zwei].name;
  const doppelt = T.benenneFigurUm(entwurf, zwei, nameEins, nameZwei);
  const zurueck = T.benenneFigurUm(doppelt, zwei, nameZwei, nameEins);
  const text = `${zurueck.verbindungen[0].hin} ${zurueck.verbindungen[0].zurueck}`;
  assert.ok(text.includes(nameEins), text);
  assert.ok(text.includes(nameZwei), text);
  assert.deepEqual(zurueck.verbindungen[0], v);
});

test('ein leerer Name laesst die Verbindungen in Ruhe', () => {
  // Wer das Feld leert und wieder zumacht, soll nicht die halben Saetze
  // verlieren. Der alte Name bleibt dann in den Verbindungen stehen und ist
  // dort von Hand zu aendern — sichtbar und reparierbar, statt still kaputt.
  const entwurf = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(18));
  const alt = entwurf.figuren[0].name;
  const geleert = T.benenneFigurUm(entwurf, 0, '', alt);
  assert.equal(geleert.figuren[0].name, '');
  assert.deepEqual(geleert.verbindungen, entwurf.verbindungen);
});

test('die Frist gezielt nachgewuerfelt kommt immer', () => {
  // Beim ganzen Aufhaenger faellt sie oft aus, und das ist gewollt. Wer den
  // Knopf an dieser Zeile drueckt, will aber eine Uhr.
  const wuerfel = wuerfelgeber(27);
  for (let i = 0; i < 100; i += 1) {
    assert.notEqual(T.erzeugeFrist(ZU, 'de', wuerfel), '', `Versuch ${i}`);
  }
});

test('eine dazugeholte Figur wird gleich angebunden', () => {
  // Der Grund, eine vorhandene Figur zu holen, ist das Verbinden. Ohne
  // Anbindung staende nur ein Name in der Liste.
  const entwurf = T.erzeugeEntwurf(ZU, 'de', wuerfelgeber(41));
  const vorher = entwurf.verbindungen.length;
  const danach = T.fuegeFigurHinzu(
    entwurf,
    { name: 'Elara von Salzfurt', rolle: 'Auftraggebend', triebfeder: '', hebel: '', makel: '', vorhanden: true },
    ZU,
    'de',
    wuerfelgeber(42)
  );
  const neue = danach.figuren.length - 1;
  assert.equal(danach.figuren[neue].name, 'Elara von Salzfurt');
  assert.equal(danach.verbindungen.length, vorher + 1);
  const letzte = danach.verbindungen[danach.verbindungen.length - 1];
  assert.ok(letzte.a === neue || letzte.b === neue);
  assert.ok(`${letzte.hin} ${letzte.zurueck}`.includes('Elara von Salzfurt'));
});

test('in einen leeren Entwurf passt auch eine Figur ohne Gegenueber', () => {
  const leer = T.fuegeFigurHinzu(
    T.LEERER_ENTWURF,
    { name: 'Allein', rolle: '', triebfeder: '', hebel: '', makel: '' },
    ZU,
    'de',
    wuerfelgeber(43)
  );
  assert.equal(leer.figuren.length, 1);
  assert.equal(leer.verbindungen.length, 0);
});

test('keine zwei Bausteine mit demselben Namen (sonst fiele beim Export eine Notiz weg)', () => {
  for (let saat = 1; saat <= 400; saat += 1) {
    for (const umfang of ['abend', 'bogen', 'kampagne']) {
      const e = T.erzeugeEntwurf({ ...ZU, umfang }, saat % 2 ? 'de' : 'en', wuerfelgeber(saat));
      const namen = [...e.fraktionen, ...e.figuren, ...e.orte].map((x) => x.name.toLowerCase());
      assert.equal(new Set(namen).size, namen.length, `Saat ${saat}, ${umfang}: ${namen.join(', ')}`);
    }
  }
});

test('mitFreiemNamen weicht vergebenen Namen aus; vergebeneNamen lässt den eigenen aus', () => {
  const vergeben = new Set(['moonshaft']);
  let n = 0;
  const x = T.mitFreiemNamen(() => ({ name: ++n < 3 ? 'Moonshaft' : 'Ashford' }), vergeben);
  assert.equal(x.name, 'Ashford');
  assert.ok(vergeben.has('ashford'));
  const e = { fraktionen: [{ name: 'A' }], figuren: [{ name: 'B' }], orte: [{ name: 'C' }] };
  assert.deepEqual([...T.vergebeneNamen(e, 'B')].sort(), ['a', 'c']);
});
