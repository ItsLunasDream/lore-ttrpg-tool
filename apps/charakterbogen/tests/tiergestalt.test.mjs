/** Tiergestalt im Bogen (docs/tiergestalt.md). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

function druide(stufe, extra = {}) {
  const w = B.leereWerte();
  return { ...w, klassen: [{ name: 'Druide', stufe }], tp: { max: 20, aktuell: 20, temp: 0 }, ...extra };
}

test('Druidenstufe aus frei geschriebenen Klassen', () => {
  assert.equal(B.druidenstufe(druide(4)), 4);
  assert.equal(B.druidenstufe({ ...druide(1), klassen: [{ name: 'Druid', stufe: 3 }, { name: 'Kämpfer', stufe: 2 }] }), 3);
  assert.equal(B.druidenstufe({ ...druide(1), klassen: [{ name: 'Magier', stufe: 5 }] }), 0);
});

test('Verwandeln: Nutzung weg, temporaere TP = Stufe, hoehere bleiben', () => {
  let w = B.lerneGestalt(druide(4), 'wolf');
  w = B.verwandle(w, 'wolf');
  assert.equal(w.tiergestalt.aktiv, 'wolf');
  assert.equal(w.tp.temp, 4);
  assert.equal(B.nutzungenUebrig(w), 1);
  const mitMehr = B.verwandle({ ...B.verwandleZurueck(w), tp: { ...w.tp, temp: 9 } }, 'wolf');
  assert.equal(mitMehr.tp.temp, 9, 'die hoeheren temporaeren TP bleiben');
  assert.equal(B.nutzungenUebrig(mitMehr), 0);
  const zurueck = B.verwandleZurueck(mitMehr);
  assert.equal(B.verwandle(zurueck, 'wolf'), zurueck, 'ohne Nutzung kein Verwandeln');
});

test('Zurueckverwandeln laesst die temporaeren TP stehen', () => {
  const w = B.verwandleZurueck(B.verwandle(B.lerneGestalt(druide(2), 'rat'), 'rat'));
  assert.equal(w.tiergestalt.aktiv, undefined);
  assert.equal(w.tp.temp, 2);
});

test('nur bekannte Gestalten, erst ab Stufe 2', () => {
  assert.equal(B.verwandle(druide(4), 'wolf').tiergestalt, undefined);
  const stufe1 = B.lerneGestalt(druide(1), 'wolf');
  assert.equal(B.verwandle(stufe1, 'wolf').tiergestalt.aktiv, undefined);
  assert.equal(B.lerneGestalt(druide(2), 'gibt-es-nicht').tiergestalt, undefined);
});

test('Rasten: kurz eine Nutzung zurueck, lang alle', () => {
  let w = B.lerneGestalt(druide(6), 'wolf');
  w = B.verwandle(B.verwandleZurueck(B.verwandle(w, 'wolf')), 'wolf');
  assert.equal(B.nutzungenUebrig(w), 1);
  const kurz = B.kurzeRast(w, {}).werte;
  assert.equal(B.nutzungenUebrig(kurz), 2);
  assert.equal(B.nutzungenUebrig(B.langeRast(w)), 3);
});

test('Einlesen: fremde Kennungen fallen weg', () => {
  const b = B.bereinige(({ name: 'X', art: 'figur', werte: { tiergestalt: { bekannt: ['wolf', 'drache', 'wolf'], verbraucht: 99, aktiv: 'nix' } } }), 'x');
  assert.deepEqual(b.werte.tiergestalt, { bekannt: ['wolf'], verbraucht: 10 });
});

test('die Uebersicht im Raum nennt die Gestalt', () => {
  const w = B.verwandle(B.lerneGestalt(druide(2), 'wolf'), 'wolf');
  const u = B.uebersichtVon({ id: 'a', name: 'Ilva', art: 'figur', werte: w });
  assert.equal(u.gestalt, 'wolf');
});
