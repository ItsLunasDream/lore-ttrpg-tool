import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

test('SRD-Ausruestung: Waffen, Ruestungen und Abenteurerausruestung, zweisprachig', () => {
  const de = B.srdAusruestung('de');
  const en = B.srdAusruestung('en');
  assert.equal(de.length, en.length);
  assert.equal(de.filter((e) => e.kennung.startsWith('waffe:')).length, 38);
  assert.equal(de.filter((e) => e.kennung.startsWith('ruestung:')).length, 13);
  assert.ok(de.filter((e) => e.kennung.startsWith('ausruestung:')).length >= 60, 'Abenteurerausruestung gepaart');
  const platte = de.find((e) => e.kennung === 'ruestung:plate-armor');
  assert.equal(platte.name, 'Ritterrüstung');
  assert.equal(platte.wert, 1500);
  assert.equal(platte.gewicht, 65);
  assert.match(platte.beschreibung, /^RK 18/);
  const seil = en.find((e) => /^Rope$/.test(e.name));
  assert.ok(seil, 'Rope ist dabei');
  assert.ok(seil.gewicht > 0 && seil.wert > 0);
  const langschwert = B.sucheQuellen(de, 'langschwert')[0];
  assert.deepEqual(langschwert.waffe, { id: 'longsword', magie: 0, geuebt: true });
});

test('SRD-Magie und Umwandlung in einen Gegenstand', () => {
  const magie = B.srdMagie('de');
  assert.ok(magie.length > 200);
  const tasche = magie.find((m) => m.kennung === 'bag-of-holding');
  assert.equal(tasche.name, 'Nimmervoller Beutel');
  const g = B.alsGegenstand(tasche, 1);
  assert.equal(g.name, 'Nimmervoller Beutel');
  assert.deepEqual(g.quelle, { art: 'srd', kennung: 'bag-of-holding' });
  const w = B.alsGegenstand(B.sucheQuellen(B.srdAusruestung('de'), 'dolch')[0], 2);
  assert.equal(w.anzahl, 2);
  assert.equal(w.waffe.id, 'dagger');
  // Uebersteht die Pruefung beim Lesen.
  assert.equal(B.bereinigeGegenstaende([w])[0].waffe.id, 'dagger');
});
