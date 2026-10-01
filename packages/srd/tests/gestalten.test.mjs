/**
 * Gestalten (docs/tiergestalt.md). Die erwarteten Zahlen stehen im SRD
 * 5.2.1, englische Fassung: Tabelle „Beast Shapes" und Spalte „Wild Shape"
 * der Druidentabelle, dazu die Zauber Find Familiar, Polymorph, Animal Shapes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../dist/tests/entry.cjs');

test('alle 91 Tiere sind Gestalten', () => {
  assert.equal(S.alleGestalten().length, 91);
});

test('die Stufentabelle der Tiergestalt', () => {
  assert.equal(S.tiergestaltFuer(1), null);
  assert.deepEqual(S.tiergestaltFuer(2), { bekannt: 4, maxHg: 0.25, flug: false, nutzungen: 2, tempTp: 2, stunden: 1 });
  assert.deepEqual(S.tiergestaltFuer(3), { bekannt: 4, maxHg: 0.25, flug: false, nutzungen: 2, tempTp: 3, stunden: 1 });
  assert.deepEqual(S.tiergestaltFuer(4), { bekannt: 6, maxHg: 0.5, flug: false, nutzungen: 2, tempTp: 4, stunden: 2 });
  assert.equal(S.tiergestaltFuer(6).nutzungen, 3);
  assert.deepEqual(S.tiergestaltFuer(8), { bekannt: 8, maxHg: 1, flug: true, nutzungen: 3, tempTp: 8, stunden: 4 });
  assert.equal(S.tiergestaltFuer(17).nutzungen, 4);
  assert.equal(S.tiergestaltFuer(20).tempTp, 20);
});

test('Bewegung wird aus dem Text gelesen', () => {
  assert.deepEqual(S.leseBewegung('30 ft., Climb 30 ft., Swim 30 ft.'), { laufen: 30, klettern: 30, schwimmen: 30 });
  assert.deepEqual(S.leseBewegung('20 ft., Climb or Fly 20 ft. (GM’s choice)'), { laufen: 20, klettern: 20, fliegen: 20 });
  assert.deepEqual(S.leseBewegung('20 ft., Burrow 5 ft.'), { laufen: 20, graben: 5 });
  const adler = S.gestaltNach('eagle');
  assert.equal(adler.bewegung.fliegen, 60);
});

test('Sinne werden gelesen', () => {
  assert.deepEqual(S.leseSinne(['Senses Blindsight 10 ft., Darkvision 60 ft.; Passive Perception 13']), { blindsicht: 10, dunkelsicht: 60 });
  assert.ok(S.gestaltNach('wolf').monster);
});

test('Stufe 2: die Empfehlungen des SRD passen, Flieger nicht', () => {
  const g = S.grenzeFuer('tiergestalt', 2);
  for (const id of ['rat', 'riding-horse', 'spider', 'wolf']) assert.ok(S.erfuellt(S.gestaltNach(id), g), id);
  assert.ok(!S.erfuellt(S.gestaltNach('owl'), g), 'Eule fliegt');
  assert.ok(!S.erfuellt(S.gestaltNach('brown-bear'), g), 'Braunbaer HG 1');
});

test('Stufe 8: HG 1 und Flug', () => {
  const g = S.grenzeFuer('tiergestalt', 8);
  assert.ok(S.erfuellt(S.gestaltNach('brown-bear'), g));
  assert.ok(S.erfuellt(S.gestaltNach('eagle'), g), 'Adler fliegt, ab Stufe 8 erlaubt');
  assert.ok(S.erfuellt(S.gestaltNach('tiger'), g), 'Tiger HG 1');
  assert.ok(!S.erfuellt(S.gestaltNach('giant-ape'), g), 'Riesenaffe HG 7');
});

test('Vertrauter: genau HG 0, Zauber nennt Fledermaus, Katze, Eule …', () => {
  const g = S.grenzeFuer('vertrauter', 0);
  for (const id of ['bat', 'cat', 'frog', 'hawk', 'lizard', 'octopus', 'owl', 'rat', 'raven', 'spider', 'weasel']) {
    assert.ok(S.erfuellt(S.gestaltNach(id), g), id);
  }
  assert.ok(!S.erfuellt(S.gestaltNach('wolf'), g));
});

test('Tiergestalten-Zauber: HG 4, hoechstens gross', () => {
  const g = S.grenzeFuer('tiergestalten', 0);
  assert.ok(S.erfuellt(S.gestaltNach('tiger'), g), 'Tiger: gross, HG 1');
  assert.ok(!S.erfuellt(S.gestaltNach('elephant'), g), 'Elefant: HG 4, aber riesig');
  assert.ok(S.alleGestalten().every((x) => !S.erfuellt(x, g) || (x.hg <= 4 && ['tiny', 'small', 'medium', 'large'].includes(x.monster.groesse))));
});

test('HG als Text', () => {
  assert.equal(S.hgText(0.125), '1/8');
  assert.equal(S.hgText(0.5), '1/2');
  assert.equal(S.hgText(2), '2');
});
