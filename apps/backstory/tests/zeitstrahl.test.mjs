import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { zeitSchluessel, vergleicheZeit } = require('../dist/tests/entry.cjs');

test('Zeitpunkte aus Freitext lesen', () => {
  assert.deepEqual(zeitSchluessel('1492 DR, Sommer'), [1492, 7, 0]);
  assert.deepEqual(zeitSchluessel('3. Mai 1490'), [1490, 5, 3]);
  assert.deepEqual(zeitSchluessel('12.03.1490'), [1490, 3, 12]);
  assert.deepEqual(zeitSchluessel('1490-03-12'), [1490, 3, 12]);
  assert.deepEqual(zeitSchluessel('March 1491'), [1491, 3, 0]);
  assert.deepEqual(zeitSchluessel('200 v. Chr.'), [-200, 0, 0]);
  assert.equal(zeitSchluessel('vor langer Zeit'), null);
  assert.equal(zeitSchluessel(''), null);
});

test('Reihenfolge: gelesene zuerst, zeitlich; ungelesene am Ende nach Titel', () => {
  const liste = [
    { titel: 'Krönung', zeit: '1492, Sommer' },
    { titel: 'Sage', zeit: 'vor langer Zeit' },
    { titel: 'Gründung', zeit: '200 v. Chr.' },
    { titel: 'Belagerung', zeit: 'März 1492' },
    { titel: 'Anfang', zeit: '' }
  ];
  assert.deepEqual(
    [...liste].sort(vergleicheZeit).map((e) => e.titel),
    ['Gründung', 'Belagerung', 'Krönung', 'Anfang', 'Sage']
  );
});
