/**
 * Die KI des Magic Item Generators: Anfrage, Antwort und die Pruefung an der
 * Seltenheit. Ohne Netz — geprueft wird, was mit Text passiert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../dist/tests/entry.cjs');

const g = (teil) => ({
  id: '', name: 'Test', art: 'waffe', seltenheit: 'uncommon', einstimmung: false,
  wirkungen: [], fluch: '', wert: 0, notiz: '', geaendert: '', ...teil
});

test('zu starke Zahlen der KI werden auf die Seltenheit gezogen, mit Ansage', () => {
  const { gegenstand, zeilen } = M.pruefeKi(
    g({ wirkungen: ['You gain a +4 bonus to attack rolls.', 'On a hit, the weapon deals an extra 4d8 fire damage.', 'The target makes a DC 20 Constitution saving throw.'] }),
    'en'
  );
  assert.match(gegenstand.wirkungen[0], /\+1 bonus/);
  assert.match(gegenstand.wirkungen[1], /extra 1d6 fire damage/);
  assert.match(gegenstand.wirkungen[2], /DC 13/);
  // Drei Wirkungen liegen bei ungewoehnlich ueber der Grenze: gemeldet, nicht gestrichen.
  assert.equal(zeilen.length, 4);
  assert.match(zeilen[3], /at most 2/);
  // Der Wert kommt aus der Tabelle, nicht aus der Antwort.
  assert.equal(gegenstand.wert, 400);
});

test('was in der Grenze liegt, bleibt unberuehrt', () => {
  const vorher = g({ seltenheit: 'rare', wirkungen: ['You gain a +2 bonus to attack rolls.', 'You regain 8d4 + 8 Hit Points.'] });
  const { gegenstand, zeilen } = M.pruefeKi(vorher, 'en');
  assert.deepEqual(gegenstand.wirkungen, vorher.wirkungen);
  assert.deepEqual(zeilen, []);
});

test('Traenke verlangen nie Einstimmung, ein Fluch bindet', () => {
  assert.equal(M.pruefeKi(g({ art: 'trank', einstimmung: true, wirkungen: ['x'] }), 'de').gegenstand.einstimmung, false);
  assert.equal(M.pruefeKi(g({ fluch: 'Fluch: x', wirkungen: ['x'] }), 'de').gegenstand.einstimmung, true);
});

test('die Anfrage nennt Grenzen, Wunsch zuerst und den Auftrag', () => {
  const text = M.anweisung({ aufgabe: 'gegenstand', art: 'ring', seltenheit: 'rare', wunsch: 'ein Ring aus Eis' }, 'de');
  assert.ok(text.startsWith('Gewünscht ist: ein Ring aus Eis'));
  assert.match(text, /Bonus höchstens \+2/);
  assert.match(text, /name, wirkungen, fluch, einstimmung/);
});

test('Antworten werden gelesen oder verworfen', () => {
  assert.deepEqual(M.uebernehmbar('gegenstand', { name: 'A', wirkungen: ['x', 7, ''], fluch: '', einstimmung: true }), {
    name: 'A', wirkungen: ['x'], fluch: '', einstimmung: true
  });
  assert.equal(M.uebernehmbar('gegenstand', { name: 'A', wirkungen: [] }), null);
  assert.equal(M.uebernehmbar('wirkung', { text: '  Neu.  ' }), 'Neu.');
  assert.equal(M.uebernehmbar('fluch', 'kein Objekt'), null);
});
