/**
 * Die Eichung: jede Wirkung an den Gegenstaenden des SRD gemessen, die fuer
 * sie stehen (src/shared/eichpunkte.ts, aus dem PDF gelesen).
 *
 * Geprueft wird, ob der Erzeuger die Wirkung bei der Seltenheit des
 * SRD-Gegenstands ueberhaupt anbietet, und ob die Zahl dieselbe ist: der
 * Bonus einer Waffe +2, die Heilung eines seltenen Heiltranks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../dist/tests/entry.cjs');

const immerNull = () => 0;

test('es gibt Eichpunkte, und jeder gehoert zu einer Wirkung, die es gibt', () => {
  assert.ok(M.EICHPUNKTE.length >= 25);
  for (const p of M.EICHPUNKTE) {
    assert.ok(M.WIRKUNGEN.some((w) => w.id === p.wirkung), `${p.name}: ${p.wirkung}`);
  }
});

test('jede Wirkung kommt bei der Seltenheit vor, die das SRD ihr gibt', () => {
  const falsch = [];
  for (const p of M.EICHPUNKTE) {
    const w = M.WIRKUNGEN.find((x) => x.id === p.wirkung);
    const stufe = M.STUFE[p.seltenheit];
    if (stufe < w.ab || stufe > w.bis) falsch.push(`${p.name} (${p.seltenheit}) liegt ausserhalb von ${w.id} ${w.ab}..${w.bis}`);
  }
  assert.deepEqual(falsch, []);
});

test('Boni und Heilung stimmen mit dem SRD ueberein', () => {
  const falsch = [];
  for (const p of M.EICHPUNKTE) {
    const w = M.WIRKUNGEN.find((x) => x.id === p.wirkung);
    const text = M.fuelle(w, M.STUFE[p.seltenheit], 'en', immerNull).text;
    if (p.bonus !== undefined && !text.includes(`+${p.bonus} bonus`)) falsch.push(`${p.name}: erwartet +${p.bonus}, erzeugt „${text}"`);
    if (p.formel !== undefined && !text.includes(p.formel)) falsch.push(`${p.name}: erwartet ${p.formel}, erzeugt „${text}"`);
  }
  assert.deepEqual(falsch, []);
});
