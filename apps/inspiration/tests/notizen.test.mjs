import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../dist/tests/entry.cjs');

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

const ENTWURF = T.erzeugeEntwurf(
  { ...T.STANDARD_ZUSCHNITT, umfang: 'bogen' },
  'de',
  wuerfelgeber(42)
);

test('der ganze Entwurf als Text enthaelt jeden Baustein', () => {
  const markdown = T.alsMarkdown(ENTWURF, 'de');
  assert.match(markdown, /## Aufhänger/);
  assert.match(markdown, /## Fraktionen/);
  assert.match(markdown, /## Figuren/);
  assert.match(markdown, /## Orte/);
  assert.match(markdown, /## Wenn niemand eingreift/);
  for (const ort of ENTWURF.orte) assert.ok(markdown.includes(ort.name));
  for (const figur of ENTWURF.figuren) assert.ok(markdown.includes(figur.name));
});

test('auf Englisch stehen auch die Ueberschriften englisch da', () => {
  // Sonst kaeme aus einer englischen Oberflaeche eine halb deutsche Notiz.
  const markdown = T.alsMarkdown(T.erzeugeEntwurf(T.STANDARD_ZUSCHNITT, 'en', wuerfelgeber(3)), 'en');
  assert.match(markdown, /## Hook/);
  assert.match(markdown, /\*\*Goal:\*\*/);
  assert.ok(!markdown.includes('Aufhänger'));
});

test('je Figur, Ort und Fraktion entsteht eine Notiz, plus die Uebersicht', () => {
  const notizen = T.alsNotizen(ENTWURF, 'de', 'Der lange Winter');
  assert.equal(
    notizen.length,
    1 + ENTWURF.fraktionen.length + ENTWURF.figuren.length + ENTWURF.orte.length
  );
  assert.equal(notizen[0].typ, 'note');
  assert.equal(notizen[0].titel, 'Der lange Winter');
  const typen = notizen.map((notiz) => notiz.typ);
  assert.ok(typen.includes('character'));
  assert.ok(typen.includes('location'));
  assert.ok(typen.includes('faction'));
});

test('die Uebersicht verweist auf jede andere Notiz', () => {
  // Damit der Graph im Story Creator sofort etwas zu zeichnen hat. Ohne
  // Verweise laegen dort zwanzig Notizen ohne jede Verbindung.
  const notizen = T.alsNotizen(ENTWURF, 'de', 'Der lange Winter');
  const uebersicht = notizen[0].markdown;
  for (const notiz of notizen.slice(1)) {
    assert.ok(uebersicht.includes(`[[${notiz.titel}]]`), `Verweis auf ${notiz.titel} fehlt`);
  }
});

test('eine Figur verweist auf ihre Gegenueber, nicht auf sich selbst', () => {
  const notizen = T.alsNotizen(ENTWURF, 'de', 'Titel');
  ENTWURF.figuren.forEach((figur, stelle) => {
    const notiz = notizen.find((eintrag) => eintrag.titel === figur.name);
    assert.ok(notiz, `${figur.name} fehlt`);
    assert.ok(!notiz.markdown.includes(`[[${figur.name}]]`), `${figur.name} verweist auf sich selbst`);
    for (const verbindung of ENTWURF.verbindungen) {
      if (verbindung.a !== stelle && verbindung.b !== stelle) continue;
      const andere = ENTWURF.figuren[verbindung.a === stelle ? verbindung.b : verbindung.a].name;
      assert.ok(notiz.markdown.includes(`[[${andere}]]`), `${figur.name} → ${andere}`);
    }
  });
});

test('jede Figur bekommt ihre Verbindungen beidseitig zu sehen', () => {
  // Gerichtet heisst: beide Seiten sehen es anders, und beide sollen ihren
  // Satz in ihrer eigenen Notiz haben.
  ENTWURF.verbindungen.forEach((verbindung) => {
    const beiA = T.verbindungenVon(verbindung.a, ENTWURF).join(' ');
    const beiB = T.verbindungenVon(verbindung.b, ENTWURF).join(' ');
    // Beide Seiten, in derselben Reihenfolge: erst wie A auf B sieht, dann
    // umgekehrt. Nur eine Haelfte waere eine Behauptung ohne Gegenstueck.
    for (const seite of [beiA, beiB]) {
      assert.ok(seite.includes(verbindung.muster), verbindung.muster);
      // Ohne Verweisklammern vergleichen: in der Notiz ist einer der beiden
      // Namen verlinkt, im Entwurf steht er nackt.
      const nackt = seite.split('[[').join('').split(']]').join('');
      const hin = nackt.indexOf(verbindung.hin);
      const zurueck = nackt.indexOf(verbindung.zurueck);
      assert.ok(hin >= 0, verbindung.hin);
      assert.ok(zurueck > hin, verbindung.zurueck);
    }
  });
});

test('ein leerer Entwurf ergibt eine Notiz und keinen Absturz', () => {
  const notizen = T.alsNotizen(T.LEERER_ENTWURF, 'de', 'Leer');
  assert.equal(notizen.length, 1);
  assert.equal(T.alsMarkdown(T.LEERER_ENTWURF, 'de').includes('## Fraktionen'), false);
});

test('ohne Frist steht keine leere Fristzeile da', () => {
  const ohne = {
    ...T.LEERER_ENTWURF,
    aufhaenger: { ausloeser: 'A.', betroffene: 'B.', komplikation: 'C.', frist: '' }
  };
  assert.ok(!T.alsMarkdown(ohne, 'de').includes('Frist'));
  const mit = { ...ohne, aufhaenger: { ...ohne.aufhaenger, frist: 'Drei Tage.' } };
  assert.ok(T.alsMarkdown(mit, 'de').includes('**Frist:** Drei Tage.'));
});

test('der Kanalname traegt das Praefix', () => {
  assert.equal(T.kanal('export'), 'inspiration:export');
  assert.equal(T.PRAEFIX, 'inspiration');
});

test('fuer eine vorhandene Figur wird keine zweite Notiz angelegt', () => {
  // Sonst haette man nach dem zweiten Entwurf jede Figur doppelt — und der
  // Wiki-Verweis wuesste nicht mehr, welche gemeint ist.
  const mitFremder = {
    ...ENTWURF,
    figuren: [
      ...ENTWURF.figuren,
      { name: 'Elara von Salzfurt', rolle: 'Auftraggebend', triebfeder: '', hebel: '', makel: '', vorhanden: true }
    ]
  };
  const notizen = T.alsNotizen(mitFremder, 'de', 'Titel');
  assert.equal(notizen.some((notiz) => notiz.titel === 'Elara von Salzfurt'), false);
  // In der Uebersicht steht sie trotzdem — der Verweis trifft ihre eigene,
  // schon vorhandene Notiz, und genau dafuer holt man sie herueber.
  assert.ok(notizen[0].markdown.includes('[[Elara von Salzfurt]]'));
});

test('ein Ort wird zu Pins fuer die Karte', () => {
  // Die erste Fassung schickte nur den Namen hinueber, und drueben stand man
  // vor einer leeren Flaeche. Was ueber den Ort bekannt ist, gehoert auf die
  // Karte — die Kartenzeile zuerst, sie sagt, wie er aussieht.
  const ort = {
    name: 'Rabenstein',
    art: 'ein Turm ohne Tür',
    merkmal: 'Es riecht nach etwas, das hier keiner verarbeitet.',
    zustand: 'Er ist verpfändet und wird versteigert.',
    karte: 'Drei Zugänge, einer verschüttet.',
    ausstattung: 'ein Brunnen mit Winde; ein Karren ohne Rad, quer im Durchgang; Fässer, brusthoch gestapelt'
  };
  const pins = T.alsKartennotizen(ort, 'de');

  // Grundriss, Art, und je ein Pin fuer jedes Ding.
  assert.equal(pins.length, 5);
  assert.match(pins[0].text, /Drei Zugänge/);
  assert.ok(pins.every((pin) => pin.title && pin.text));

  /*
   * Und was NICHT mitgeht: Merkmal und Zustand.
   *
   * Beides sind gute Saetze fuer die Ortsnotiz und beim Kartenbau wertlos —
   * einen Geruch zeichnet man nicht, eine Verpfaendung auch nicht.
   */
  const alles = pins.map((pin) => pin.text).join(' ');
  assert.ok(!alles.includes('riecht'), 'das Merkmal steht auf der Karte');
  assert.ok(!alles.includes('verpfändet'), 'der Zustand steht auf der Karte');

  // Jedes Ding einzeln, nicht alle in einem Pin.
  assert.match(alles, /Brunnen mit Winde/);
  assert.match(alles, /Karren ohne Rad/);
  assert.match(alles, /Fässer/);

  // Leere Felder ergeben keinen leeren Pin.
  assert.deepEqual(
    T.alsKartennotizen({ name: '', art: '', merkmal: '', zustand: '', karte: '', ausstattung: '' }, 'de'),
    []
  );
});

test('die Ausstattung wird an den Semikola getrennt', () => {
  assert.deepEqual(T.ausstattungsstuecke({ ausstattung: 'a; b;  c ' }), ['a', 'b', 'c']);
  assert.deepEqual(T.ausstattungsstuecke({ ausstattung: '' }), []);
  // Ein leeres Stueck zwischen zwei Semikola faellt weg statt leer zu bleiben.
  assert.deepEqual(T.ausstattungsstuecke({ ausstattung: 'a;; b' }), ['a', 'b']);
});

test('die Pins sprechen die eingestellte Sprache', () => {
  const pins = T.alsKartennotizen(
    { name: 'X', art: 'a mill', merkmal: '', zustand: '', karte: 'One way in.', ausstattung: 'a well' },
    'en'
  );
  assert.equal(pins[0].title, 'Layout');
  assert.equal(pins[2].title, 'Standing here');
});

/* ---------- Die Tabelle selbst ---------- */

test('was dort steht, kann man auch hinstellen', () => {
  /*
   * Die Regel, an der sich die Tabelle von `ORT_MERKMAL` unterscheidet:
   * hier darf nichts stehen, was man nur riechen, hoeren oder ahnen kann.
   * Ein Geruch ist auf einer Karte kein Element.
   */
  const nichtZeichenbar = [
    /riecht|geruch|smell/i,
    /hört man|zu hören|you hear/i,
    /stimmung|atmosph/i,
    /niemand weiß|nobody knows/i
  ];
  for (const eintrag of T.ORT_AUSSTATTUNG) {
    for (const muster of nichtZeichenbar) {
      assert.doesNotMatch(eintrag.de, muster, `${eintrag.de} (${muster})`);
      assert.doesNotMatch(eintrag.en, muster, `${eintrag.en} (${muster})`);
    }
  }
});

test('jedes Stueck sagt, wie gross es ist oder wo es liegt', () => {
  /*
   * Ohne Groesse oder Lage ist ein Ding keine Hilfe beim Zeichnen: „ein
   * Karren" laesst offen, ob er im Weg steht. „Ein Karren ohne Rad, quer im
   * Durchgang" nicht.
   */
  const masse =
    /hoch|tief|breit|lang|Schritt|mannsh|knieh|hüfth|kopfh|brusth|schulterh|groß|Reihen|Stufen|Ebenen|\bzwei\b|\bdrei\b|\bvier\b|\bacht\b|\bzwanzig\b|quer|über|unter|neben|mitten|ringsum|im Weg|davor|dahinter/i;
  const ohne = T.ORT_AUSSTATTUNG.filter((eintrag) => !masse.test(eintrag.de));
  assert.deepEqual(ohne.map((eintrag) => eintrag.de), []);
});

test('jeder erzeugte Ort bringt Dinge mit', () => {
  for (let saat = 1; saat <= 12; saat += 1) {
    const ort = T.erzeugeOrt(
      { umfang: 'abend', region: '', thema: '', tonfall: '', eigenes: '' },
      'de',
      wuerfelgeber(saat)
    );
    const stuecke = T.ausstattungsstuecke(ort);
    assert.equal(stuecke.length, T.AUSSTATTUNGSSTUECKE, `Saat ${saat}: ${ort.ausstattung}`);
    // Ohne Wiederholung: zweimal derselbe Brunnen ist ein Fehler.
    assert.equal(new Set(stuecke).size, stuecke.length, ort.ausstattung);
  }
});

test('doppelte Titel werden erkannt (Groß/klein egal), sonst keine', () => {
  assert.deepEqual(T.doppelteTitel([{ titel: 'Moonshaft' }, { titel: 'moonshaft ' }, { titel: 'Ashford' }]), ['Moonshaft']);
  assert.deepEqual(T.doppelteTitel([{ titel: 'A' }, { titel: 'B' }]), []);
});
