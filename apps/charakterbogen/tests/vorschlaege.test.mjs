import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

test('Vorschläge: „Comm" schlägt „Common" vor, Anfang vor Mitte', () => {
  const sprachen = B.vorschlagsliste('sprachen', 'en');
  assert.equal(B.vorschlaege('Comm', sprachen, true)[0], 'Common');
  assert.ok(B.vorschlaege('common', sprachen, true).includes('Common Sign Language'));
  // In der Mitte: „Speech" findet „Deep Speech".
  assert.deepEqual(B.vorschlaege('speech', sprachen, true), ['Deep Speech']);
});

test('Vorschläge in Listen: nur der letzte Teil, Vorhandenes nicht doppelt', () => {
  const sprachen = B.vorschlagsliste('sprachen', 'de');
  assert.deepEqual(B.vorschlaege('Gemeinsprache, Elf', sprachen, true), ['Elfisch']);
  assert.equal(B.setzeEin('Gemeinsprache, Elf', 'Elfisch', true), 'Gemeinsprache, Elfisch');
  assert.ok(!B.vorschlaege('Elfisch, El', sprachen, true).includes('Elfisch'));
  assert.equal(B.setzeEin('Elf', 'Elfisch', false), 'Elfisch');
});

test('Vorschlagslisten aus dem SRD: Werkzeuge ohne Preis, Waffen', () => {
  const werkzeuge = B.vorschlagsliste('werkzeug', 'de');
  assert.ok(werkzeuge.includes('Diebeswerkzeug'));
  assert.ok(werkzeuge.every((w) => !/\(\d/.test(w)), 'kein Preis im Namen');
  assert.ok(B.vorschlagsliste('waffen', 'en').includes('Longsword'));
  assert.equal(B.vorschlagsliste('gesinnung', 'en').length, 10);
});
