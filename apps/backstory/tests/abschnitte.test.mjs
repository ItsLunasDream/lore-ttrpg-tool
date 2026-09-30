import test from 'node:test';
import assert from 'node:assert/strict';
import entry from '../dist/tests/entry.cjs';

const { abschnitt, hatInhalt, ueberschriften, versteckteBloecke } = entry;

// H1, Text, H2, Text, Text, H2, Text, H1, Text
const DOKUMENT = [1, null, 2, null, null, 2, null, 1, null];

test('ein Abschnitt reicht bis zur naechsten Ueberschrift gleicher oder hoeherer Ebene', () => {
  // Die H1 ganz oben nimmt alles bis zur naechsten H1 mit, samt der H2 darin.
  assert.deepEqual(abschnitt(DOKUMENT, 0), { von: 1, bis: 7 });
  // Die erste H2 endet bei der zweiten H2.
  assert.deepEqual(abschnitt(DOKUMENT, 2), { von: 3, bis: 5 });
  // Die letzte H1 reicht bis zum Ende.
  assert.deepEqual(abschnitt(DOKUMENT, 7), { von: 8, bis: 9 });
});

test('eine eingeklappte H2 versteckt nur ihren eigenen Abschnitt', () => {
  // Die zweite Ueberschrift im Dokument ist die erste H2.
  assert.deepEqual([...versteckteBloecke(DOKUMENT, new Set([1]))].sort(), [3, 4]);
});

test('eine eingeklappte H1 nimmt die Ueberschriften darunter mit', () => {
  assert.deepEqual([...versteckteBloecke(DOKUMENT, new Set([0]))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
});

test('ineinander eingeklappte Ueberschriften sind kein Sonderfall', () => {
  const aussen = versteckteBloecke(DOKUMENT, new Set([0]));
  const beide = versteckteBloecke(DOKUMENT, new Set([0, 1]));
  assert.deepEqual([...beide].sort((a, b) => a - b), [...aussen].sort((a, b) => a - b));
});

test('eine Ueberschrift ohne Inhalt laesst sich nicht einklappen', () => {
  // H1 direkt gefolgt von H1: dazwischen steht nichts.
  const leer = [1, 1, null];
  assert.equal(hatInhalt(leer, 0), false);
  assert.equal(hatInhalt(leer, 1), true);
  assert.equal(versteckteBloecke(leer, new Set([0])).size, 0);
});

test('eine unbekannte Nummer aendert nichts', () => {
  assert.equal(versteckteBloecke(DOKUMENT, new Set([99])).size, 0);
});

test('eine Trennlinie beendet den Abschnitt (0 = Trennlinie)', () => {
  // H1, Text, H2, Text, ---, Bild, Text
  const stufen = [1, null, 2, null, 0, null, null];
  assert.deepEqual(abschnitt(stufen, 0), { von: 1, bis: 4 });
  assert.deepEqual([...versteckteBloecke(stufen, new Set([0]))].sort(), [1, 2, 3]);
  // Die Trennlinie ist keine Ueberschrift: sie zaehlt nicht mit und hat keinen Inhalt.
  assert.deepEqual(ueberschriften(stufen), [0, 2]);
  assert.equal(hatInhalt(stufen, 4), false);
});
