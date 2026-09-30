import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buendle, eintragsSchluessel, finde, guete, heuhaufen, passt, schluessel } =
  require('../dist/tests/entry.cjs');

const E = (werkzeug, kennung, name, art, stichworte) => ({
  werkzeug,
  kennung,
  name,
  art,
  stichworte
});

const BESTAND = [
  E('backstory', 'n1', 'Der König von Waldheim', 'Notiz', 'Herrscher, alt'),
  E('backstory', 'n2', 'Waldlager', 'Notiz', 'Ort im Norden'),
  E('monster', 'm1', 'Ghul', 'Monster', 'untot, nahkampf'),
  E('monster', 'm2', 'Frostwächter', 'Monster', 'elementar, kälte'),
  E('zustaende', 'z1', 'Kälte', 'Zustand', 'stufen, winter'),
  E('initiative', 'b1', 'Kampf am Fluss', 'Begegnung', 'Ghul, Wolf, Wolf')
];

test('Umlaute und Grossschreibung stoeren nicht', () => {
  assert.equal(schluessel('Bär'), 'bar');
  assert.equal(schluessel('Kälte über Straße'), 'kalte uber strasse');
});

test('gesucht wird in Name, Art und Stichworten', () => {
  const eintrag = E('monster', 'm1', 'Ghul', 'Monster', 'untot');
  const stroh = heuhaufen(eintrag);
  assert.ok(stroh.includes('ghul'));
  assert.ok(stroh.includes('monster'));
  assert.ok(stroh.includes('untot'));
});

test('alle Worte muessen vorkommen, nicht irgendeines', () => {
  // Sonst wird die Liste mit jedem getippten Wort laenger statt kuerzer.
  const kampf = BESTAND.find((e) => e.kennung === 'b1');
  assert.ok(passt(kampf, 'ghul'));
  assert.ok(passt(kampf, 'ghul wolf'));
  assert.equal(passt(kampf, 'ghul drache'), false);
});

test('eine leere Suche passt auf alles', () => {
  assert.ok(passt(BESTAND[0], ''));
  assert.ok(passt(BESTAND[0], '   '));
});

test('die Suche findet ueber die Werkzeuge hinweg', () => {
  // Der eigentliche Zweck: „kälte" steht in einem Monster UND in einem
  // Zustand, und beide sollen kommen.
  const treffer = finde(BESTAND, 'kälte');
  const werkzeuge = new Set(treffer.map((e) => e.werkzeug));
  assert.ok(werkzeuge.has('zustaende'), treffer.map((e) => e.name).join(', '));
  assert.ok(werkzeuge.has('monster'), treffer.map((e) => e.name).join(', '));
});

test('der genaue Name steht vorn', () => {
  // Bei zwanzig Treffern aus fuenf Werkzeugen entscheidet die Reihenfolge,
  // ob man den gesuchten sofort sieht oder scrollt.
  const treffer = finde(BESTAND, 'kälte');
  assert.equal(treffer[0].name, 'Kälte');
});

test('der Anfang des Namens schlaegt die Mitte, und die die Stichworte', () => {
  const anfang = E('x', '1', 'Waldlager', 'Notiz');
  const mitte = E('x', '2', 'Im Waldlager', 'Notiz');
  const nurStichwort = E('x', '3', 'Etwas', 'Notiz', 'wald');
  assert.ok(guete(anfang, 'wald') > guete(mitte, 'wald'));
  assert.ok(guete(mitte, 'wald') > guete(nurStichwort, 'wald'));
});

test('der ganze Name schlaegt den Anfang', () => {
  const ganz = E('x', '1', 'Wald', 'Notiz');
  const anfang = E('x', '2', 'Waldlager', 'Notiz');
  assert.ok(guete(ganz, 'wald') > guete(anfang, 'wald'));
});

test('bei gleicher Guete entscheidet der Name', () => {
  // Sonst sortiert sich die Liste beim Tippen um, ohne dass sich etwas
  // geaendert haette.
  const gleich = [E('a', '1', 'Zebra', 'X'), E('b', '2', 'Adler', 'X')];
  const treffer = finde(gleich, '');
  assert.deepEqual(
    treffer.map((e) => e.name),
    ['Adler', 'Zebra']
  );
});

test('die Liste wird gedeckelt', () => {
  const viele = Array.from({ length: 200 }, (_, i) => E('x', String(i), `Ding ${i}`, 'Notiz'));
  assert.equal(finde(viele, 'ding').length, 40);
  assert.equal(finde(viele, 'ding', 5).length, 5);
});

test('die Treffer lassen sich nach Werkzeug buendeln', () => {
  const treffer = finde(BESTAND, 'ghul');
  const buendel = buendle(treffer);
  assert.ok(buendel.length >= 1);
  // Jeder Eintrag landet in genau einem Buendel.
  const gesamt = buendel.reduce((summe, b) => summe + b.eintraege.length, 0);
  assert.equal(gesamt, treffer.length);
  for (const b of buendel) {
    assert.ok(b.eintraege.every((e) => e.werkzeug === b.werkzeug), b.werkzeug);
  }
});

test('das Buendel mit dem besten Treffer steht oben', () => {
  const treffer = finde(BESTAND, 'kälte');
  const buendel = buendle(treffer);
  assert.equal(buendel[0].werkzeug, treffer[0].werkzeug);
});

test('ein Eintrag wird ueber Werkzeug UND Kennung benannt', () => {
  // Die Kennungen sind nur innerhalb eines Werkzeugs eindeutig — jedes
  // vergibt sie selbst.
  assert.equal(eintragsSchluessel(BESTAND[2]), 'monster/m1');
  const gleicheKennung = [E('monster', 'x', 'A', 'Monster'), E('zustaende', 'x', 'B', 'Zustand')];
  assert.notEqual(eintragsSchluessel(gleicheKennung[0]), eintragsSchluessel(gleicheKennung[1]));
});

test('nichts gefunden ist kein Fehler', () => {
  assert.deepEqual(finde(BESTAND, 'gibtesnicht'), []);
  assert.deepEqual(buendle([]), []);
});

test('Name plus Art: „armor table“ findet die Tabelle „Armor“ zuerst', () => {
  const bestand = [
    E('loot', 't1', 'Armor', 'Random table', ''),
    E('nachschlagewerk', 'r1', 'Armor', 'Rule', ''),
    E('magicitems', 'i1', 'Armor of Resistance', 'Armor · Rare', ''),
    E('loot', 't2', 'Weapons', 'Zufallstabelle', '')
  ];
  for (const anfrage of ['armor table', 'Armor Random Table', 'armor tabelle', 'armor zufallstabelle']) {
    const treffer = finde(bestand, anfrage);
    assert.equal(treffer[0]?.kennung, 't1', anfrage);
    assert.ok(!treffer.some((t) => t.kennung === 't2'), `${anfrage}: nur passende Namen`);
  }
  // Andere Werkzeuge ebenso: „ghul monster“, „kälte condition“.
  assert.equal(finde(BESTAND, 'ghul monster')[0].kennung, 'm1');
  assert.equal(finde(BESTAND, 'kälte condition')[0].kennung, 'z1');
  // Der Name allein bleibt der beste Treffer.
  assert.ok(guete(bestand[0], 'armor') > guete(bestand[0], 'armor table'));
});
