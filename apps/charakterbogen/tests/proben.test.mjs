import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

const fest = (augen) => () => (augen - 1) / 20 + 0.001;
const werte = () => ({ ...B.neuerBogen('x', 'Mira').werte, tp: { aktuell: 0, max: 20, temp: 0 } });

test('Probe: d20 plus Bonus, Zeile mit 🎲', () => {
  const p = B.probe('Akrobatik', 5, fest(13));
  assert.equal(p.gesamt, 18);
  assert.equal(p.text, '🎲 Akrobatik: 18 (d20 13 +5)');
  assert.match(B.probe('Stärke', -1, fest(20)).text, /20!$/);
});

test('Todesrettungswurf nach SRD: 10+, 1 doppelt, 20 steht auf, drei = tot/stabil', () => {
  let w = werte();
  w = B.todesrettungWurf(w, 'Mira', 'de', fest(12)).werte;
  assert.deepEqual(w.todesrettung, { erfolge: 1, fehlschlaege: 0 });
  w = B.todesrettungWurf(w, 'Mira', 'de', fest(9)).werte;
  assert.deepEqual(w.todesrettung, { erfolge: 1, fehlschlaege: 1 });
  const zwei = B.todesrettungWurf(w, 'Mira', 'de', fest(1));
  assert.equal(zwei.ausgang, 'tot');
  assert.equal(B.istTot(zwei.werte), true);
  const auf = B.todesrettungWurf(werte(), 'Mira', 'en', fest(20));
  assert.equal(auf.ausgang, 'aufgestanden');
  assert.equal(auf.werte.tp.aktuell, 1);
  assert.match(auf.text, /^🎲 Mira · Death save: 20/);
  let s = { ...werte(), todesrettung: { erfolge: 2, fehlschlaege: 0 } };
  assert.equal(B.todesrettungWurf(s, 'Mira', 'de', fest(15)).ausgang, 'stabil');
});

test('Wieder TP: Todesrettung auf null (SRD), nicht mehr tot', () => {
  const tot = { ...werte(), todesrettung: { erfolge: 1, fehlschlaege: 3 } };
  assert.equal(B.istTot(tot), true);
  const geheilt = B.mitTodesrettung({ ...tot, tp: { ...tot.tp, aktuell: 5 } });
  assert.deepEqual(geheilt.todesrettung, { erfolge: 0, fehlschlaege: 0 });
  assert.equal(B.istTot({ ...tot, tp: { ...tot.tp, aktuell: 5 } }), false);
  assert.equal(B.mitTodesrettung(tot), tot);
  // Auch beim Laden, etwa wenn der Initiative Tracker die TP geschrieben hat.
  const b = B.neuerBogen('x', 'Mira');
  b.werte = { ...b.werte, tp: { aktuell: 3, max: 20, temp: 0 }, todesrettung: { erfolge: 2, fehlschlaege: 3 } };
  assert.deepEqual(B.bereinige(JSON.parse(JSON.stringify(b)), 'x').werte.todesrettung, { erfolge: 0, fehlschlaege: 0 });
});
