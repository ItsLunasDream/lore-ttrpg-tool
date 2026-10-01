import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bereinigeStraenge, ordneStraenge } = require('../dist/tests/entry.cjs');

const A = { id: 'a', name: 'Plot A', farbe: 0, notizen: ['n1', 'n2', 'n3'] };
const B = { id: 'b', name: 'Plot B', farbe: 1, notizen: ['m1', 'm2'], von: { strang: 'a', notiz: 'n2' } };

test('Plot B beginnt hinter der zweiten Notiz von A', () => {
  const { knoten, kanten, spalten } = ordneStraenge(bereinigeStraenge([A, B]));
  const b1 = knoten.find((k) => k.notiz === 'm1');
  assert.deepEqual([b1.spalte, b1.zeile], [2, 1]);
  assert.equal(spalten, 4);
  const abzweig = kanten.find((k) => k.art === 'abzweig');
  assert.deepEqual(abzweig.von, { spalte: 1, zeile: 0 });
  assert.deepEqual(abzweig.nach, { spalte: 2, zeile: 1 });
  assert.equal(kanten.filter((k) => k.art === 'folge').length, 3);
});

test('Zweige von Zweigen und Muendung', () => {
  const C = { id: 'c', name: 'C', farbe: 2, notizen: ['x'], von: { strang: 'b', notiz: 'm2' }, nach: { strang: 'a', notiz: 'n3' } };
  const { knoten, kanten } = ordneStraenge(bereinigeStraenge([A, B, C]));
  assert.equal(knoten.find((k) => k.notiz === 'x').spalte, 4);
  assert.ok(kanten.some((k) => k.art === 'muendung'));
});

test('Bereinigen: unbekannte Notizen, Anschluss an sich selbst, Ringe', () => {
  const bekannt = new Set(['n1', 'n2', 'n3', 'm1', 'm2']);
  const s = bereinigeStraenge([{ ...A, notizen: ['n1', 'weg', 'n2', 'n3'] }, { ...B, nach: { strang: 'b', notiz: 'm1' } }, { id: 'kaputt!' }], bekannt);
  assert.deepEqual(s[0].notizen, ['n1', 'n2', 'n3']);
  assert.equal(s[1].nach, null);
  assert.equal(s.length, 2);
  // Ring: A zweigt von B, B von A -> kein Endlosrechnen
  const ring = ordneStraenge(bereinigeStraenge([{ ...A, von: { strang: 'b', notiz: 'm1' } }, B]));
  assert.ok(ring.knoten.length === 5);
});
