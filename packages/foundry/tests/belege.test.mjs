/**
 * Der Abgleich mit der Wirklichkeit.
 *
 * Unter tests/belege/ liegt das FELDGERUEST echter Foundry-Exporte: nur
 * Schluessel und Typen, keine Inhalte. Die Exporte selbst gehoeren nicht
 * hierher — ein Teil ist offizielles Material, und alle tragen Welt- und
 * Nutzerkennungen aus einer fremden Installation. `scripts/geruest.mjs`
 * macht aus einem Export ein Geruest.
 *
 * Die acht `item-equipment-*`, `item-consumable-*` und `item-weapon*`-
 * Belege gehoeren noch zu keinem Export von uns: sie sind die Vorarbeit
 * fuer den Magic Item Generator (docs/magicitems.md) und stehen hier, damit
 * die Form beim Bauen belegt ist und nicht geraten wird.
 *
 * Geprueft wird die eine Eigenschaft, auf die es ankommt: **wir erfinden
 * keine Felder.** Jeder Schluessel, den wir schreiben, kommt in einem echten
 * Export vor. Die Gegenrichtung wird bewusst NICHT geprueft — Foundry fuellt
 * beim Einlesen alles auf, was fehlt (`attributes.death`, `hd`, `loyalty`,
 * `prototypeToken` …), und diese Felder hier zu erzwingen hiesse, Vorgaben
 * festzuschreiben, die das System besser selbst kennt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { alsFoundryMonster, alsFoundryZustand, alsFoundryGegenstand } = require('../dist/tests/entry.cjs');

const beleg = (datei) =>
  JSON.parse(readFileSync(new URL(`./belege/${datei}`, import.meta.url), 'utf8'))._geruest;

/**
 * Sammelt jeden Pfad, den ein Objekt hat: „system.attributes.ac.calc".
 *
 * Listen werden mit `[]` abgekuerzt — die Gegenstaende eines Monsters sind
 * gleich gebaut, und der erste steht fuer alle.
 */
function pfade(wert, vorn = '', aus = new Set()) {
  if (Array.isArray(wert)) {
    if (wert.length > 0) pfade(wert[0], `${vorn}[]`, aus);
    return aus;
  }
  if (wert && typeof wert === 'object') {
    for (const [k, v] of Object.entries(wert)) {
      const pfad = vorn ? `${vorn}.${k}` : k;
      aus.add(pfad);
      pfade(v, pfad, aus);
    }
  }
  return aus;
}

/**
 * Kennungen im Pfad durch `*` ersetzen.
 *
 * Die Taetigkeiten eines Gegenstands stehen unter ihrer eigenen 16-stelligen
 * Kennung (`activities.aWnnebczttWsxTQI`). Verglichen wird die Stelle, nicht
 * der Zufall, der sie benennt.
 */
function ohneKennungen(pfad) {
  return pfad.replace(/\.[A-Za-z0-9]{16}(?=\.|$)/g, '.*');
}

function fester() {
  let n = 0;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

const MONSTER = {
  name: 'Probe',
  cr: '9',
  tp: 140,
  rk: 18,
  attribute: { st: 17, ge: 15, ko: 15, in: 6, we: 10, ch: 8 },
  hauptattribut: 'st',
  gangarten: [{ art: 'gehen', fuss: 30 }],
  artEnglisch: 'undead',
  groesse: 'mittel',
  widerstaende: { resistenzen: [], immunitaeten: ['poison'], verwundbarkeiten: ['cold'] },
  faehigkeiten: [{ name: 'Probe', text: 'Text.' }],
  angriffe: [
    { name: 'Nah', art: 'nah', wuerfel: '1d10 + 3', schadensart: 'slashing', reichweite: 5 },
    { name: 'Fern', art: 'fern', wuerfel: '2d6', schadensart: 'cold', weite: [60, 120] },
    { name: 'Flaeche', art: 'flaeche', wuerfel: '6d8', schadensart: 'cold' }
  ]
};

test('das Monster erfindet keine Felder, die es in Foundry nicht gibt', () => {
  const echt = new Set(
    [...pfade(beleg('actor-npc.json')), ...pfade(beleg('actor-npc-offiziell.json'))].map(
      ohneKennungen
    )
  );
  const meine = [...pfade(alsFoundryMonster(MONSTER, fester()))].map(ohneKennungen);

  const unbekannt = meine.filter((p) => !echt.has(p));
  assert.deepEqual(unbekannt, [], `steht in keinem echten Export: ${unbekannt.join(', ')}`);
});

test('der Zustand erfindet keine Felder, die es in Foundry nicht gibt', () => {
  const echt = new Set([...pfade(beleg('item-feat.json'))].map(ohneKennungen));
  const meine = [
    ...pfade(
      alsFoundryZustand({
        name: 'Probe',
        kurzsatz: 'Kurz.',
        stufen: [{ nummer: 1, wirkungen: ['Wirkung.'] }],
        dauer: 'Eine Stunde',
        verschlimmerung: '',
        linderung: ''
      })
    )
  ].map(ohneKennungen);

  const unbekannt = meine.filter((p) => !echt.has(p));
  assert.deepEqual(unbekannt, [], `steht in keinem echten Export: ${unbekannt.join(', ')}`);
});

test('die Felder, die Foundry zum Anzeigen wirklich braucht, sind da', () => {
  // Die Gegenprobe zum Test darueber: „nichts erfunden" allein waere auch
  // von einer leeren Datei erfuellt.
  const a = alsFoundryMonster(MONSTER, fester());
  for (const pfad of [
    'name',
    'type',
    'system.abilities.str.value',
    'system.attributes.ac.flat',
    'system.attributes.hp.max',
    'system.attributes.movement.walk',
    'system.details.cr',
    'system.details.type.value',
    'system.traits.size',
    'items[].name',
    '_stats.systemId'
  ]) {
    assert.ok(pfade(a).has(pfad), `fehlt: ${pfad}`);
  }
});

test('ein magischer Gegenstand erfindet keine Felder, die es in Foundry nicht gibt', () => {
  const echt = new Set(
    [
      'item-equipment-wondrous.json',
      'item-equipment-schild.json',
      'item-equipment-stab.json',
      'item-consumable-trank-ohne-taetigkeit.json',
      'item-weapon.json'
    ].flatMap((datei) => [...pfade(beleg(datei))].map(ohneKennungen))
  );
  for (const art of ['waffe', 'ruestung', 'schild', 'wundersam', 'ring', 'stab', 'trank', 'schriftrolle']) {
    const meine = [
      ...pfade(
        alsFoundryGegenstand({
          name: 'Probe',
          art,
          seltenheit: 'rare',
          einstimmung: true,
          wirkungen: ['Wirkung.'],
          fluch: 'Fluch.',
          wert: 4000
        })
      )
    ].map(ohneKennungen);
    const unbekannt = meine.filter((p) => !echt.has(p));
    assert.deepEqual(unbekannt, [], `${art}: steht in keinem echten Export: ${unbekannt.join(', ')}`);
  }
});
