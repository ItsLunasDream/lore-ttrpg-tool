import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { erkenneSprachen } = require('../dist/tests/entry.cjs');

test('deutsch, englisch, gemischt, zu wenig', () => {
  assert.deepEqual(erkenneSprachen('Mira ist die Tochter des Schmieds und lebt mit ihrem Bruder in der Stadt.').sprachen, ['de']);
  assert.deepEqual(erkenneSprachen('Mira is the daughter of the smith and she lives with her brother in the city.').sprachen, ['en']);
  assert.deepEqual(
    erkenneSprachen('Mira ist die Tochter des Schmieds und lebt in der Stadt. She says: "I will not go back to the forest, and you can not make me."').sprachen,
    ['de', 'en']
  );
  assert.deepEqual(erkenneSprachen('Falkenhand, Waldheim.').sprachen, []);
});
