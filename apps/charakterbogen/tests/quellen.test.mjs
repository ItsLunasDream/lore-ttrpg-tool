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

test('Loot: Wurf wird mit SRD-Gegenstaenden abgeglichen (Wert, Beschreibung, Waffe, Herkunft)', () => {
  const e = B.lootAlsEintrag('Longsword (15 GP)', 'srd-waffen', 'Weapons', 'en');
  assert.equal(e.name, 'Longsword');
  assert.equal(e.wert, 15);
  assert.equal(e.gewicht, 3);
  assert.ok(e.waffe, 'Waffenwerte kommen mit');
  assert.match(e.beschreibung, /1d8/);
  assert.match(e.beschreibung, /\(Loot table: Weapons\)$/);
  // Englischer Wurf, deutscher Bogen: deutscher Name, gleiche Werte.
  const de = B.lootAlsEintrag('Longsword (15 GP)', 'srd-waffen', 'Waffen', 'de');
  assert.equal(de.name, 'Langschwert');
  assert.equal(de.wert, 15);
  assert.match(de.beschreibung, /\(Loot-Tabelle: Waffen\)$/);
});

test('Loot: Unbekanntes behaelt den Wurf, der Preis in Klammern wird gelesen', () => {
  const e = B.lootAlsEintrag('Goldene Brosche mit Rubin (250 GM)', 't1', 'Schmuck', 'de');
  assert.equal(e.name, 'Goldene Brosche mit Rubin');
  assert.equal(e.wert, 250);
  assert.match(e.beschreibung, /Goldene Brosche mit Rubin \(250 GM\)/);
  const ohne = B.lootAlsEintrag('Ein zerbrochener Kompass', 't1', 'Krimskrams', 'de');
  assert.equal(ohne.wert, null);
  assert.equal(ohne.name, 'Ein zerbrochener Kompass');
});

test('Loot: eigener Gegenstand aus dem Magic Item Generator wird erkannt', () => {
  const eigene = [{ quelle: 'magicitem', kennung: 'm1', name: 'Klinge der Morgenroete', art: 'Waffe, selten', gewicht: null, wert: 800, beschreibung: 'Leuchtet im Morgengrauen.' }];
  const e = B.lootAlsEintrag('Klinge der Morgenroete', 'mi-selten', 'Selten', 'de', eigene);
  assert.equal(e.quelle, 'magicitem');
  assert.equal(e.wert, 800);
  assert.match(e.beschreibung, /^Leuchtet im Morgengrauen\./);
});
