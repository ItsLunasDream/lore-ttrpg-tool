import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../dist/tests/entry.cjs');

// Raster 3 × 2, Kacheln 100 × 80 mit 10 Abstand.
const raster = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) raster.push({ x: c * 110, y: r * 90, b: 100, h: 80 });

test('Raster: rechts, links, runter, hoch treffen die Nachbarn', () => {
  assert.equal(T.naechsterInRichtung(raster, 0, 'rechts'), 1);
  assert.equal(T.naechsterInRichtung(raster, 1, 'links'), 0);
  assert.equal(T.naechsterInRichtung(raster, 1, 'runter'), 4);
  assert.equal(T.naechsterInRichtung(raster, 4, 'hoch'), 1);
});

test('Raster: am Rand geht es nicht weiter', () => {
  assert.equal(T.naechsterInRichtung(raster, 2, 'rechts'), -1);
  assert.equal(T.naechsterInRichtung(raster, 0, 'hoch'), -1);
});

test('Raster: rechts bleibt in der Reihe, auch wenn schräg darunter etwas näher liegt', () => {
  const k = [
    { x: 0, y: 0, b: 100, h: 80 },
    { x: 400, y: 0, b: 100, h: 80 },
    { x: 120, y: 90, b: 100, h: 80 }
  ];
  assert.equal(T.naechsterInRichtung(k, 0, 'rechts'), 1);
});

test('Textfelder behalten die Pfeile', () => {
  const feld = (tagName, type) => ({ tagName, type, isContentEditable: false });
  assert.equal(T.istTextfeld(feld('INPUT', 'text')), true);
  assert.equal(T.istTextfeld(feld('INPUT', 'checkbox')), false);
  assert.equal(T.istTextfeld(feld('TEXTAREA')), true);
  assert.equal(T.istTextfeld(feld('BUTTON')), false);
  assert.equal(T.istTextfeld(null), false);
});

test('alsKnopf löst mit Enter und Leertaste aus, nicht aus einem Feld darin', () => {
  let n = 0;
  const k = T.alsKnopf(() => n++);
  assert.equal(k.role, 'button');
  assert.equal(k.tabIndex, 0);
  const selbst = {};
  const ev = (key, target = selbst) => ({ key, target, currentTarget: selbst, preventDefault() {} });
  k.onKeyDown(ev('Enter'));
  k.onKeyDown(ev(' '));
  k.onKeyDown(ev('a'));
  k.onKeyDown(ev('Enter', {}));
  assert.equal(n, 2);
});
