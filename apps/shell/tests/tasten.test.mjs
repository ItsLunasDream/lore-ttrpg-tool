import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../dist/tests/entry.cjs');

test('Groessentasten: auch deutsche Tastatur mit AltGr', () => {
  // Deutsch: Strg+Alt = AltGr, AltGr + „+“ liefert „~“ auf der Taste BracketRight.
  assert.equal(S.groessenTaste('~', 'BracketRight'), 'groesser');
  assert.equal(S.groessenTaste('+', 'BracketRight'), 'groesser');
  assert.equal(S.groessenTaste('+', 'NumpadAdd'), 'groesser');
  assert.equal(S.groessenTaste('=', 'Equal'), 'groesser');
  assert.equal(S.groessenTaste('-', 'Slash'), 'kleiner');
  assert.equal(S.groessenTaste('}', 'Digit0'), 'zurueck');
  assert.equal(S.groessenTaste('0', 'Digit0'), 'zurueck');
  // Englisch: ] auf derselben Taste ist keine Groessentaste.
  assert.equal(S.groessenTaste(']', 'BracketRight'), null);
  assert.equal(S.groessenTaste('k', 'KeyK'), null);
});
