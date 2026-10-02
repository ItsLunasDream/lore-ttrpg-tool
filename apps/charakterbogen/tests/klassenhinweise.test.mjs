import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

const figur = (klassen) => ({ ...B.neuerBogen('x', 'Mira').werte, klassen });
const finde = (h, art) => h.find((x) => x.art === art);

test('Klasse aus dem Namen, auch in weiblicher Form', () => {
  assert.equal(B.klasseAusName('Magierin'), 'magier');
  assert.equal(B.klasseAusName('Waldläuferin'), 'waldlaeufer');
  assert.equal(B.klasseAusName('Rogue'), 'schurke');
  assert.equal(B.klasseAusName('Barbarin'), 'barbar');
  assert.equal(B.klasseAusName('Bardin'), 'barde');
  assert.equal(B.klasseAusName('Händlerin'), null);
});

test('Zauberplätze nach SRD: voll, halb (aufgerundet), Mehrklassen, Pakt', () => {
  assert.deepEqual(B.zauberplaetze([{ name: 'Magier', stufe: 5 }]).plaetze, [4, 3, 2, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(B.zauberplaetze([{ name: 'Paladin', stufe: 1 }]).plaetze, [2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(B.zauberplaetze([{ name: 'Paladin', stufe: 5 }]).plaetze, [4, 2, 0, 0, 0, 0, 0, 0, 0]);
  // SRD-Beispiel: Waldläufer 4 / Zauberer 3 zählt als Stufe 5.
  assert.deepEqual(B.zauberplaetze([{ name: 'Ranger', stufe: 4 }, { name: 'Sorcerer', stufe: 3 }]).plaetze, [4, 3, 2, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(B.zauberplaetze([{ name: 'Wizard', stufe: 20 }]).plaetze, [4, 3, 3, 3, 3, 2, 2, 1, 1]);
  assert.deepEqual(B.zauberplaetze([{ name: 'Hexenmeister', stufe: 11 }]).pakt, { anzahl: 3, grad: 5 });
  assert.equal(B.zauberplaetze([{ name: 'Kämpfer', stufe: 5 }]), null);
});

test('Hinweise: Abweichungen erkennen und übernehmen', () => {
  let w = figur([{ name: 'Magier', stufe: 3 }]);
  const h = B.klassenhinweise(w, 'de');
  assert.equal(finde(h, 'trefferwuerfel').text, 'Trefferwürfel: 3W6');
  assert.equal(finde(h, 'rettung').text, 'Rettungswürfe: Intelligenz und Weisheit');
  assert.equal(finde(h, 'tricks').text, 'Zaubertricks: 3');
  assert.equal(finde(h, 'vorbereitet').text, 'Vorbereitete Zauber: 6');
  assert.equal(finde(h, 'plaetze').text, 'Zauberplätze: 4 / 2');
  for (const x of h) if (x.abweichung && x.uebernehmen) w = x.uebernehmen(w);
  const danach = B.klassenhinweise(w, 'de');
  assert.deepEqual(danach.filter((x) => x.abweichung && x.uebernehmen).map((x) => x.art), []);
  assert.deepEqual(w.rettung.sort(), ['int', 'wei']);
  assert.deepEqual(w.trefferwuerfel, [{ seiten: 6, gesamt: 3, uebrig: 3 }]);
  assert.equal(w.zauber.attribut, 'int');
  assert.equal(w.zauber.maxVorbereitet, 6);
  assert.deepEqual(w.zauber.plaetze.map((p) => p.max), [4, 2, 0, 0, 0, 0, 0, 0, 0]);
});

test('Hinweise: Rüstung nur dazu, Waffen nur in leere Felder, Pakt mit kurzer Rast', () => {
  let w = { ...figur([{ name: 'Warlock', stufe: 3 }]), waffenuebung: 'Langbogen', ruestungsuebung: { leicht: false, mittel: true, schwer: false, schilde: false } };
  const h = B.klassenhinweise(w, 'en');
  w = finde(h, 'ruestung').uebernehmen(w);
  assert.deepEqual(w.ruestungsuebung, { leicht: true, mittel: true, schwer: false, schilde: false });
  assert.equal(finde(h, 'waffen').abweichung, false);
  w = finde(h, 'pakt').uebernehmen(w);
  assert.equal(w.zauber.kurzeRast, true);
  assert.deepEqual(w.zauber.plaetze.map((p) => p.max), [0, 2, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(finde(h, 'pakt').text, 'Pact Magic: 2 level 2 slots (Short Rest)');
});

test('Mehrere Klassen: Trefferwürfel getrennt, Rettungswürfe der ersten', () => {
  const h = B.klassenhinweise(figur([{ name: 'Kämpfer', stufe: 2 }, { name: 'Magier', stufe: 1 }]), 'de');
  assert.equal(finde(h, 'trefferwuerfel').text, 'Trefferwürfel: 2W10 + 1W6');
  assert.equal(finde(h, 'rettung').text, 'Rettungswürfe: Stärke und Konstitution');
  assert.equal(B.klassenhinweise(figur([{ name: '', stufe: 1 }]), 'de').length, 0);
});

test('Zauber wirken: Angriffszauber erkannt, Zeile je nach Platz', () => {
  assert.equal(B.istAngriffszauber({ srd: 'fire-bolt', vorbereitet: false, immer: false, herkunft: '' }), true);
  assert.equal(B.istAngriffszauber({ srd: 'fireball', vorbereitet: false, immer: false, herkunft: '' }), false);
  assert.equal(B.istAngriffszauber({ eigen: { name: 'X', grad: 1, text: 'Führe einen Zauberangriff aus.' }, vorbereitet: false, immer: false, herkunft: '' }), true);
  assert.equal(B.wirkZeile('Feuerball', 3, 'de'), '✨ Feuerball gewirkt (Platz des 3. Grades)');
  assert.equal(B.wirkZeile('Fire Bolt', 0, 'en'), '✨ Fire Bolt cast (cantrip)');
  assert.equal(B.wirkZeile('Feuerball', null, 'de'), '✨ Feuerball gewirkt (ohne freien Platz)');
});

test('Neuer Bogen: Gemeinsprache vorbelegt; tote Figur in der Kachel', () => {
  assert.equal(B.neuerBogen('a', 'A', 'figur', 'de').werte.sprachen, 'Gemeinsprache');
  assert.equal(B.neuerBogen('a', 'A', 'figur', 'en').werte.sprachen, 'Common');
  const b = B.neuerBogen('a', 'A');
  assert.equal(B.alsKachel(b).tot, undefined);
  b.werte.todesrettung = { erfolge: 0, fehlschlaege: 3 };
  assert.equal(B.alsKachel(b).tot, true);
});
