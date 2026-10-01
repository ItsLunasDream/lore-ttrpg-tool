/** Ablage und Export (src/shared/ablage.ts). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const O = require('../dist/tests/entry.cjs');

function zufall(seed) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const ort = O.erzeugeOrt({ groesse: 'stadt', lage: 'kueste' }, 'de', zufall(3));
const gespeichert = { ...ort, id: 'x', sprache: 'de', notiz: '', imLoot: false, geaendert: '' };

test('Datei hin und zurück verliert nichts', () => {
  const zurueck = O.leseDatei(O.alsDatei(gespeichert), 'x');
  assert.deepEqual(zurueck, gespeichert);
});

test('bereinige: Unsinn wird zu einem gültigen, leeren Ort', () => {
  const o = O.bereinige({ groesse: 'metropole', laeden: 'nein', einwohner: -5, gasthaus: 3 }, 'kaputt');
  assert.equal(o.groesse, 'dorf');
  assert.deepEqual(o.laeden, []);
  assert.equal(o.einwohner, 0);
  assert.equal(o.name, 'kaputt');
});

test('Export: Ort, Gasthaus, Läden und Personen als Notizen mit Verweisen, keine doppelten Titel', () => {
  const notizen = O.alsNotizen(ort, 'de');
  assert.equal(notizen[0].titel, ort.name);
  assert.equal(notizen[0].typ, 'location');
  assert.ok(notizen[0].markdown.includes(`[[${ort.gasthaus.name}]]`));
  const titel = notizen.map((n) => n.titel);
  assert.equal(new Set(titel).size, titel.length);
  assert.equal(notizen.length, 2 + ort.laeden.length + 1 + ort.laeden.length + ort.personen.length);
  assert.ok(notizen.every((n) => !/[[\]|]/.test(n.titel)));
});

test('Preise wie im SRD gedruckt: 4 KM, 5 SM, 1.500 GM', () => {
  assert.equal(O.preisText(0.04, 'de'), '4 KM');
  assert.equal(O.preisText(0.5, 'de'), '5 SM');
  assert.equal(O.preisText(1500, 'de'), '1.500 GM');
  assert.equal(O.preisText(1500, 'en'), '1,500 GP');
});

test('Läden als Loot-Tabellen mit Preis', () => {
  const t = O.alsLootTabellen(gespeichert);
  assert.equal(t.length, ort.laeden.length);
  assert.match(t[0].eintraege[0], /\(.+\)$/);
});
