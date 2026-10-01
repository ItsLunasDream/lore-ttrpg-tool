import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

function figur(werte = {}) {
  const b = B.bereinige({ name: 'Mira', art: 'figur' }, 'mira');
  return { ...b, werte: { ...b.werte, ...werte } };
}

test('Halbe Uebung: halber Bonus, abgerundet', () => {
  assert.equal(B.fertigkeitsBonus(10, 0.5, 2), 1);
  assert.equal(B.fertigkeitsBonus(10, 0.5, 3), 1);
  assert.equal(B.fertigkeitsBonus(10, 0.5, 4), 2);
  assert.deepEqual(B.UEBUNGEN, [0, 0.5, 1, 2]);
});

test('Alleskoenner: ungeuebte Fertigkeiten und Initiative, geuebte bleiben', () => {
  const b = figur({ alleskoenner: true, fertigkeiten: { athletik: 1 }, klassen: [{ name: 'Barde', stufe: 5 }] });
  assert.equal(B.uebungIn(b.werte, 'akrobatik'), 0.5);
  assert.equal(B.uebungIn(b.werte, 'athletik'), 1);
  // Stufe 5: Uebungsbonus 3, halb abgerundet 1.
  assert.equal(B.initiativeBonus(b.werte), 1);
  assert.equal(B.passiverWert(b.werte, 'wahrnehmung'), 11);
  assert.equal(B.initiativeBonus({ ...b.werte, initiative: 4 }), 4, 'feste Initiative gewinnt');
});

test('Bereinigen behaelt 0.5, neue Felder, Design und Story-Notiz', () => {
  const roh = figur({
    fertigkeiten: { akrobatik: 0.5, athletik: 0.7, heimlichkeit: 2 },
    ep: 900,
    gesinnung: 'Chaotisch gut',
    ruestungsuebung: { leicht: true, schwer: 'ja' },
    sprachen: 'Gemeinsprache, Elfisch',
    klassen: [{ name: 'Magier', stufe: 3, unterklasse: 'Hervorrufung' }],
    ressourcen: [{ name: 'Arkane Erholung', max: 1, uebrig: 5, rast: 'lang' }, { name: '' }],
    sinne: 'Dunkelsicht 18 m'
  });
  const b = B.bereinige({ ...roh, design: { farbe: 'blau', papier: 'nacht', schrift: '<script>' }, storyNotiz: { kennung: 'k/n', titel: 'Mira' } }, 'mira');
  const w = b.werte;
  assert.equal(w.fertigkeiten.akrobatik, 0.5);
  assert.equal(w.fertigkeiten.athletik, 1, 'andere Brueche werden gerundet');
  assert.equal(w.fertigkeiten.heimlichkeit, 2);
  assert.equal(w.ep, 900);
  assert.deepEqual(w.ruestungsuebung, { leicht: true, mittel: false, schwer: false, schilde: false });
  assert.equal(w.klassen[0].unterklasse, 'Hervorrufung');
  assert.deepEqual(w.ressourcen, [{ name: 'Arkane Erholung', max: 1, uebrig: 1, rast: 'lang' }]);
  assert.equal(w.sinne, 'Dunkelsicht 18 m');
  assert.deepEqual(b.design, { farbe: 'blau', papier: 'nacht', schrift: '' });
  assert.deepEqual(b.storyNotiz, { kennung: 'k/n', titel: 'Mira' });
  assert.equal(B.designVon(b.design).schrift.id, 'roemisch', 'unbekannte Schrift: Vorgabe');
  // Alte Boegen ohne neue Felder
  const alt = B.bereinige({ name: 'Alt', art: 'figur', werte: { attribute: {} } }, 'alt');
  assert.equal(alt.werte.alleskoenner, false);
  assert.deepEqual(alt.werte.ressourcen, []);
  assert.equal(alt.design, undefined);
});

test('Rasten fuellen Ressourcen', () => {
  const w = figur({
    ressourcen: [
      { name: 'Kanalisieren', max: 2, uebrig: 0, rast: 'kurz' },
      { name: 'Kampfrausch', max: 3, uebrig: 1, rast: 'lang' }
    ]
  }).werte;
  assert.deepEqual(B.fuelleRessourcen(w.ressourcen, 'kurz').map((r) => r.uebrig), [2, 1]);
  assert.deepEqual(B.langeRast(w).ressourcen.map((r) => r.uebrig), [2, 3]);
});

test('Fertigkeiten alphabetisch je Sprache', () => {
  const en = B.fertigkeitenSortiert('en').map((f) => f.name[1]);
  assert.deepEqual(en.slice(0, 3), ['Acrobatics', 'Animal Handling', 'Arcana']);
  assert.deepEqual(en, [...en].sort((a, b) => a.localeCompare(b, 'en')));
  const de = B.fertigkeitenSortiert('de').map((f) => f.name[0]);
  assert.equal(de[de.length - 1], 'Wahrnehmung');
});

test('Lesefassung nennt neue Felder', () => {
  const b = figur({ sprachen: 'Elfisch', klassenmerkmale: 'Arkane Erholung', alleskoenner: true });
  const md = B.alsMarkdown(b, 'de');
  assert.match(md, /\*\*Sprachen:\*\* Elfisch/);
  assert.match(md, /## Klassenmerkmale/);
  assert.match(md, /\*\*Passiv:\*\* Wahrnehmung 11/);
  assert.match(md, /Akrobatik \+1/);
});

test('Story-Abschnitt: ersetzt nur zwischen den Markierungen', () => {
  const b = figur({ sprachen: 'Elfisch' });
  const block = B.storyBlock(b, 'de');
  assert.match(block, /^<!-- charakterbogen:anfang -->/);
  assert.match(block, /<!-- charakterbogen:ende -->$/);
  const vorher = `Meine Gedanken zu Mira.\n\n${B.storyBlock(figur({ sprachen: 'Zwergisch' }), 'de')}\n\nNachwort bleibt.`;
  const nachher = B.ersetzeStoryBlock(vorher, block);
  assert.match(nachher, /^Meine Gedanken zu Mira\./);
  assert.match(nachher, /Nachwort bleibt\.$/);
  assert.match(nachher, /Elfisch/);
  assert.doesNotMatch(nachher, /Zwergisch/);
  // Der Editor schreibt Kommentare ohne Leerzeichen zurueck.
  const kompakt = vorher.replace('<!-- charakterbogen:anfang -->', '<!--charakterbogen:anfang-->');
  assert.match(B.ersetzeStoryBlock(kompakt, block), /Elfisch/);
  // Ohne Abschnitt: unten angehaengt, Text davor bleibt.
  const neu = B.ersetzeStoryBlock('Nur Text.', block);
  assert.match(neu, /^Nur Text\.\n\n<!-- charakterbogen:anfang -->/);
  // Ein $ im Bogen wird nicht als Ersetzungsmuster gelesen.
  const geld = B.storyBlock(figur({ sprachen: 'Preis $& $1' }), 'de');
  assert.match(B.ersetzeStoryBlock(vorher, geld), /Preis \$& \$1/);
});
