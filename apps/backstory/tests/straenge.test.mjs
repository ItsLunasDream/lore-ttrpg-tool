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

test('Mündung wie bei Git: das Ziel liegt rechts von der letzten Notiz der Quelle', () => {
  // B ist lang, A mündet in die zweite Notiz von A-los-gelöstem Strang B.
  const straenge = [
    { id: 'a', name: 'A', farbe: 0, notizen: ['a1', 'a2', 'a3', 'a4'], von: null, nach: { strang: 'b', notiz: 'b2' } },
    { id: 'b', name: 'B', farbe: 1, notizen: ['b1', 'b2', 'b3'], von: null, nach: null }
  ];
  const { knoten, kanten } = ordneStraenge(straenge);
  const spalte = (n) => knoten.find((k) => k.notiz === n).spalte;
  assert.ok(spalte('b2') > spalte('a4'), `b2 (${spalte('b2')}) muss rechts von a4 (${spalte('a4')}) liegen`);
  const m = kanten.find((k) => k.art === 'muendung');
  assert.ok(m.nach.spalte > m.von.spalte);
  // Abzweig und Mündung zusammen: C zweigt von A ab und mündet zurück in A.
  const ring = [
    { id: 'a', name: 'A', farbe: 0, notizen: ['a1', 'a2', 'a3', 'a4', 'a5'], von: null, nach: null },
    { id: 'c', name: 'C', farbe: 2, notizen: ['c1', 'c2'], von: { strang: 'a', notiz: 'a1' }, nach: { strang: 'a', notiz: 'a5' } }
  ];
  const r = ordneStraenge(ring);
  const sp = (n) => r.knoten.find((k) => k.notiz === n).spalte;
  assert.ok(sp('c1') > sp('a1') && sp('a5') > sp('c2'));
});
