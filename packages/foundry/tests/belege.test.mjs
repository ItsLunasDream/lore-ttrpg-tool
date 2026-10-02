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
  // Siehe oben: `magicalBonus` ist als Verzauberungsziel belegt (docs/magicitems.md).
  echt.add('system.magicalBonus');
  for (const art of ['waffe', 'ruestung', 'schild', 'wundersam', 'ring', 'stab', 'trank', 'schriftrolle']) {
    const meine = [
      ...pfade(
        alsFoundryGegenstand({
          name: 'Probe',
          art,
          seltenheit: 'rare',
          einstimmung: true,
          // Mit Bonus: sonst entstehen `magicalBonus` und der RK-Effekt nie,
          // und der Test prueft sie nicht (so blieb die alte Effektform unbemerkt).
          wirkungen: ['Wirkung.', '+1 bonus to attack rolls and AC'],
          fluch: 'Fluch.',
          wert: 4000
        })
      )
    ].map(ohneKennungen);
    const unbekannt = meine.filter((p) => !echt.has(p));
    assert.deepEqual(unbekannt, [], `${art}: steht in keinem echten Export: ${unbekannt.join(', ')}`);
  }
});

// --- Homebrew (dnd5e 6.0.5) --------------------------------------------------

const H = require('../dist/tests/entry.cjs');
const KOPF = { name: 'Probe', beschreibung: 'Text.', bild: null, preis: 10, gewicht: 2, magisch: true };
const WAFFE = {
  ...KOPF, kategorie: 'kriegs', fern: false, wuerfel: '1d8', schadenPlus: 0, schadensart: 'hieb',
  zusatz: [{ wuerfel: '1d6', plus: 0, art: 'feuer' }], reichweiteNah: 10, eigenschaften: ['vielseitig', 'reichweite'],
  vielseitig: '1d10', reichweiteNormal: 20, reichweiteMax: 60, meisterschaft: 'sap', bonus: 1
};
const ZAUBER = {
  ...KOPF, grad: 3, schule: 'hervorrufung', zeit: 'Aktion', reichweite: '150 Fuß', komponenten: 'V, G, M (Schwefel)',
  dauer: 'Sofort', konzentration: false, ritual: false, wirkungen: ['schaden', 'heilung'], schadenAnzahl: 8, schadenSeiten: 6,
  schadenPlus: 0, schadensart: 'feuer', heilAnzahl: 1, heilSeiten: 4, heilPlus: 0, ziel: 'flaeche', flaeche: 'kugel',
  flaecheGroesse: 20, rettungswurf: 'ges', angriffswurf: false, halbBeiErfolg: true, hoehererGrad: '+1W6 je Grad'
};
const echt6 = (...dateien) => new Set(dateien.flatMap((d) => [...pfade(beleg(d))].map(ohneKennungen)));
const unbekannt = (item, echt) => [...pfade(item)].map(ohneKennungen).filter((p) => !echt.has(p));
// Die Schadensteile einer Taetigkeit sind bei Waffe und Zauber dasselbe Feld;
// das Langschwert hat keine, die Zauber zeigen ihre Form.
const teilePfade = [...echt6('item-spell-save-6.json', 'item-spell-attack-6.json')].filter((p) => p.startsWith('system.activities.*.damage.parts'));
// `system.magicalBonus` setzt die offizielle Waffe +1/+2/+3 per Verzauberung
// (docs/magicitems.md); im Feldgeruest steht es nur als Wert, nicht als Pfad.
const waffenEcht = new Set([...echt6('item-weapon-6.json', 'item-weapon-bonus.json'), ...teilePfade, 'system.magicalBonus']);

test('Homebrew-Waffe, -Rüstung, -Gegenstand und -Zauber erfinden keine Felder (Belege aus 6.0.5)', () => {
  const id = 'AAAAAAAAAAAAAAAA';
  const faelle = [
    ['Waffe', H.alsFoundryWaffe(WAFFE, id), waffenEcht],
    ['Waffe fern', H.alsFoundryWaffe({ ...WAFFE, fern: true, eigenschaften: ['munition'], bonus: 0 }, id), waffenEcht],
    ['Rüstung', H.alsFoundryRuestung({ ...KOPF, ruestungsart: 'schwer', rk: 16, staerke: 13, heimlichkeitNachteil: true, bonus: 1 }), echt6('item-equipment-ruestung-6.json', 'item-equipment-schild.json')],
    ['Gegenstand', H.alsFoundryKram(KOPF), echt6('item-loot-eigen-6.json')],
    ['Zauber Rettungswurf', H.alsFoundryZauber(ZAUBER, id), echt6('item-spell-save-6.json', 'item-spell-attack-6.json')],
    ['Zauber Angriff', H.alsFoundryZauber({ ...ZAUBER, angriffswurf: true, rettungswurf: '', ziel: 'einzel' }, id), echt6('item-spell-save-6.json', 'item-spell-attack-6.json')]
  ];
  for (const [was, item, echt] of faelle) {
    const fremd = unbekannt(item, echt);
    assert.deepEqual(fremd, [], `${was}: steht in keinem echten Export: ${fremd.join(', ')}`);
  }
});

test('Homebrew: die Werte stehen dort, wo Foundry sie liest', () => {
  const w = H.alsFoundryWaffe(WAFFE, 'AAAAAAAAAAAAAAAA');
  assert.equal(w.type, 'weapon');
  assert.deepEqual(w.system.type, { value: 'martialM', baseItem: '' });
  assert.deepEqual([w.system.damage.base.number, w.system.damage.base.denomination, w.system.damage.base.types], [1, 8, ['slashing']]);
  assert.deepEqual([w.system.damage.versatile.number, w.system.damage.versatile.denomination], [1, 10]);
  assert.deepEqual(w.system.properties, ['ver', 'rch', 'mgc']);
  assert.equal(w.system.range.reach, 10);
  assert.equal(w.system.mastery, 'sap');
  assert.equal(w.system.magicalBonus, 1);
  assert.deepEqual(w.system.activities.AAAAAAAAAAAAAAAA.damage.parts[0].types, ['fire']);
  assert.equal(w._stats.systemVersion, '6.0.5');

  const z = H.alsFoundryZauber(ZAUBER, 'AAAAAAAAAAAAAAAA');
  const t = z.system.activities.AAAAAAAAAAAAAAAA;
  assert.deepEqual([z.type, z.system.level, z.system.school], ['spell', 3, 'evo']);
  assert.deepEqual(z.system.properties, ['vocal', 'somatic', 'material']);
  assert.equal(z.system.materials.value, 'Schwefel');
  assert.deepEqual(z.system.range, { value: '150', units: 'ft', special: '' });
  assert.deepEqual(z.system.target.template.type, 'sphere');
  assert.equal(t.type, 'save');
  assert.deepEqual(t.save.ability, ['dex']);
  assert.equal(t.damage.onSave, 'half');
  assert.deepEqual([t.damage.parts[0].number, t.damage.parts[0].denomination, t.damage.parts[0].scaling], [8, 6, { mode: 'whole', number: 1, formula: '' }]);
  assert.match(z.system.description.value, /Heilung \/ Healing:<\/strong> 1d4/);

  const r = H.alsFoundryRuestung({ ...KOPF, ruestungsart: 'mittel', rk: 13, staerke: 0, heimlichkeitNachteil: false, bonus: 0 });
  assert.deepEqual([r.type, r.system.type.value, r.system.armor.value, r.system.armor.dex, r.system.strength], ['equipment', 'medium', 13, 2, null]);

  const g = H.alsFoundryKram({ ...KOPF, bild: 'data:image/png;base64,AAAA' });
  assert.deepEqual([g.type, g.img], ['loot', 'data:image/png;base64,AAAA']);
});
