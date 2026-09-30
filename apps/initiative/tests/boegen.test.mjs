import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const I = require('../dist/tests/entry.cjs');

const thorin = { kennung: 'thorin', name: 'Thorin', tp: 30, tpMax: 30, tempTp: 0, rk: 16, iniMod: 1 };

test('Figuren aus Boegen: neu als Spielerfigur, zweimal wird aufgefrischt statt verdoppelt', () => {
  const k0 = I.leererKampf();
  const k1 = I.uebernimmFiguren(k0, [thorin], true);
  assert.equal(k1.teilnehmer.length, 1);
  const t = k1.teilnehmer[0];
  assert.equal(t.istSpieler, true);
  assert.equal(t.bogen, 'thorin');
  assert.equal(t.rk, 16);
  assert.equal(t.feinwert, 1);
  assert.deepEqual([t.koerper[0].hp, t.koerper[0].hpMax], [30, 30]);
  const k2 = I.uebernimmFiguren(k1, [{ ...thorin, tp: 12 }], true);
  assert.equal(k2.teilnehmer.length, 1);
  assert.equal(k2.teilnehmer[0].koerper[0].hp, 12);
  assert.equal(I.uebernimmFiguren(k2, [{ ...thorin, tp: 12 }], true), k2, 'nichts neu: derselbe Kampf');
  assert.equal(I.uebernimmFiguren(k0, [thorin], false).teilnehmer.length, 0, 'ohne hinzufuegen nur auffrischen');
});

test('TP-Aenderungen im Kampf gehen genau einmal an den Bogen', () => {
  const k1 = I.uebernimmFiguren(I.leererKampf(), [thorin], true);
  const bekannt = new Map();
  assert.deepEqual(I.tpAenderungen(k1, bekannt), [], 'beim ersten Mal nur merken');
  const k2 = I.setzeHp(k1, k1.teilnehmer[0].id, k1.teilnehmer[0].koerper[0].id, 21);
  assert.deepEqual(I.tpAenderungen(k2, bekannt), [{ kennung: 'thorin', hp: 21, temp: 0 }]);
  assert.deepEqual(I.tpAenderungen(k2, bekannt), []);
});

test('Die Kennung des Bogens uebersteht Speichern und Lesen, Muell wird verworfen', () => {
  const k = I.uebernimmFiguren(I.leererKampf(), [thorin], true);
  const text = I.schreibeBegegnung({ schemaVersion: 1, id: 'x', name: 'X', teilnehmer: k.teilnehmer, taktik: '' });
  assert.equal(I.leseBegegnung(text, 'x').teilnehmer[0].bogen, 'thorin');
  assert.deepEqual(I.leseFiguren([{ kennung: '', name: 'x' }, 'quatsch', { kennung: 'a', name: 'A', tp: 'viel' }]).map((f) => f.tp), [0]);
});
