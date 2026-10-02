import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Z = require('../dist/tests/entry.cjs');

test('„10" bei Minimum 5 tippen: die 1 wird nicht zur 5', () => {
  const b = { min: 5, max: 100 };
  assert.equal(Z.waehrendDesTippens('1', b), null);
  assert.equal(Z.waehrendDesTippens('10', b), 10);
  assert.equal(Z.amEnde('1', b), 5);
  assert.equal(Z.amEnde('150', b), 100);
});

test('leer oder unlesbar: alten Wert behalten', () => {
  assert.equal(Z.amEnde('', { min: 1 }), null);
  assert.equal(Z.amEnde('-', { min: 1 }), null);
  assert.equal(Z.waehrendDesTippens('', { min: 1 }), null);
});

test('ganze Zahlen, Komma als Dezimalzeichen', () => {
  assert.equal(Z.waehrendDesTippens('2.5', { min: 0 }), null);
  assert.equal(Z.amEnde('2,6', { min: 0 }), 3);
  assert.equal(Z.amEnde('2,5', { min: 0, ganz: false }), 2.5);
});
