import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const O = require('../dist/tests/entry.cjs');

let n = 0;
const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
const ort = O.erzeugeOrt({ groesse: 'kleinstadt', lage: null }, 'de', rng);

test('KI: die Anfrage nennt nur gefragte Felder und den Wunsch', () => {
  const a = O.anweisung(ort, ['name', 'geruechte'], 'Fischerdorf', 'de', 'Küste');
  assert.match(a, /Gewünscht ist: Fischerdorf/);
  assert.match(a, /"name"/);
  assert.match(a, /"geruechte"/);
  assert.doesNotMatch(a, /"problem":/);
  // Was nicht gefragt ist, steht als Zusammenhang drin.
  assert.ok(a.includes(ort.problem.trim().slice(0, 30)));
});

test('KI: übernommen wird nur Gefragtes, Gerüchte und Gasthaus geprüft', () => {
  const w = O.uebernehme(ort, ['name', 'gasthaus', 'geruechte'], {
    name: '  Möwenruh  ',
    problem: 'nicht gefragt',
    gasthaus: { name: 'Zum Salzfass', spezialitaet: 'Fischsuppe' },
    geruechte: [{ text: 'Im Leuchtturm spukt es.', wahr: false }, 'Der Hafenmeister lügt.', { foo: 1 }]
  });
  assert.equal(w.name, 'Möwenruh');
  assert.equal('problem' in w, false);
  assert.equal(w.gasthaus.name, 'Zum Salzfass');
  assert.equal(w.gasthaus.qualitaet, ort.gasthaus.qualitaet, 'Qualität und Wirt bleiben');
  assert.deepEqual(w.geruechte, [{ text: 'Im Leuchtturm spukt es.', wahr: false }, { text: 'Der Hafenmeister lügt.', wahr: true }]);
  assert.deepEqual(O.uebernehme(ort, ['name'], 'kein Objekt'), {});
  assert.deepEqual(O.uebernehme(ort, ['name'], { name: '   ' }), {});
});
