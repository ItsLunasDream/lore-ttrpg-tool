/** Waffen und Ruestungen als Daten (src/waffen.ts), gegen die Tabellen des SRD 5.2.1. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../dist/tests/entry.cjs');

test('38 Waffen, alle gepaart, Kennungen eindeutig', () => {
  assert.equal(S.WAFFEN.length, 38);
  assert.equal(new Set(S.WAFFEN.map((w) => w.id)).size, 38);
  for (const w of S.WAFFEN) assert.ok(w.name[0] && w.name[1], w.id);
});

test('Merkmale, Reichweite und Meisterschaft maschinenlesbar', () => {
  const dolch = S.waffeNach('dagger');
  assert.deepEqual([...dolch.merkmale].sort(), ['finesse', 'leicht', 'wurf']);
  assert.deepEqual(dolch.reichweiteFern, { normal: 20, max: 60 });
  assert.equal(dolch.meister, 'nick');
  const glefe = S.waffeNach('glaive');
  assert.deepEqual([...glefe.merkmale].sort(), ['reichweite', 'schwer', 'zweihaendig']);
  assert.equal(S.waffeNach('longbow').reichweiteFern.max, 600);
  assert.ok(S.WAFFEN.every((w) => S.MEISTERSCHAFTEN.includes(w.meister)));
});

test('13 Ruestungen in vier Arten', () => {
  assert.equal(S.RUESTUNGEN.length, 13);
  const zahl = (a) => S.RUESTUNGEN.filter((r) => r.art === a).length;
  assert.deepEqual([zahl('leicht'), zahl('mittel'), zahl('schwer'), zahl('schild')], [3, 5, 4, 1]);
  const platte = S.RUESTUNGEN.find((r) => r.id === 'plate-armor');
  assert.equal(platte.rk, 18);
  assert.equal(platte.staerke, 15);
  assert.equal(platte.heimlichkeitNachteil, true);
  assert.equal(platte.wert, 1500);
  assert.equal(platte.name[0], 'Ritterrüstung');
  const schild = S.RUESTUNGEN.find((r) => r.art === 'schild');
  assert.equal(schild.rk, 2);
  assert.equal(S.RUESTUNGEN.find((r) => r.id === 'chain-shirt').ges, 'max2');
});

test('Preise mit Tausendertrenner und Durchschnitt', () => {
  assert.equal(S.preisInGold('1,500 GP'), 1500);
  assert.equal(S.preisInGold('1.500 GM'), 1500);
  assert.equal(S.preisInGold('5 CP'), 0.05);
  assert.equal(S.schnittVon('2d6'), 7);
  assert.equal(S.schnittVon('1'), 1);
  assert.equal(S.schnittVon('1W8'), 4.5);
});
