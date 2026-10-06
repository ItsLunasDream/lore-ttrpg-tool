import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { istErlaubt, begrenzeBerechtigungen } = require('../dist/tests/entry.cjs');

test('nur Zwischenablage, Dateizugriff und Vollbild sind erlaubt', () => {
  for (const b of ['clipboard-sanitized-write', 'fileSystem', 'fullscreen']) assert.equal(istErlaubt(b), true, b);
  for (const b of ['media', 'geolocation', 'notifications', 'clipboard-read', 'midi', 'openExternal', 'hid', 'serial', 'usb'])
    assert.equal(istErlaubt(b), false, b);
});

test('die Handler antworten nach der Liste', () => {
  let anfrage;
  let pruefung;
  begrenzeBerechtigungen({
    setPermissionRequestHandler: (h) => (anfrage = h),
    setPermissionCheckHandler: (h) => (pruefung = h)
  });
  const antworten = [];
  anfrage(null, 'media', (ja) => antworten.push(ja));
  anfrage(null, 'fileSystem', (ja) => antworten.push(ja));
  assert.deepEqual(antworten, [false, true]);
  assert.equal(pruefung(null, 'geolocation'), false);
  assert.equal(pruefung(null, 'clipboard-sanitized-write'), true);
});
