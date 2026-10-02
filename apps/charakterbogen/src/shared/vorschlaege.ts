/**
 * Vorschläge beim Tippen (Rückmeldung: „Comm" schlägt „Common" vor).
 *
 * Werkzeuge und Waffen kommen aus @suite/srd und sind damit belegt.
 * Spezies, Hintergründe, Klassen, Sprachen, Gesinnungen und Größen stehen
 * hier von Hand; die deutschen Namen sind am deutschen SRD 5.2.1
 * (packages/srd/quelle) nachgeprüft: Inhaltsverzeichnis, Tabellen
 * „Standardsprachen“/„Seltene Sprachen“, „Kreaturengröße und Bereich“,
 * Gesinnungen.
 *
 * Es sind nur Vorschläge: jedes Feld nimmt weiter jeden Text.
 */
import { AUSRUESTUNG } from '@suite/srd/ausruestung';
import { WAFFEN } from '@suite/srd/waffen';

type Paar = readonly [string, string];

export const SPEZIES: readonly Paar[] = [
  ['Drachenblütiger', 'Dragonborn'],
  ['Zwerg', 'Dwarf'],
  ['Elf', 'Elf'],
  ['Gnom', 'Gnome'],
  ['Goliath', 'Goliath'],
  ['Halbling', 'Halfling'],
  ['Mensch', 'Human'],
  ['Ork', 'Orc'],
  ['Tiefling', 'Tiefling']
];

export const HINTERGRUENDE: readonly Paar[] = [
  ['Akolyth', 'Acolyte'],
  ['Krimineller', 'Criminal'],
  ['Weiser', 'Sage'],
  ['Soldat', 'Soldier']
];

export const KLASSEN: readonly Paar[] = [
  ['Barbar', 'Barbarian'],
  ['Barde', 'Bard'],
  ['Kleriker', 'Cleric'],
  ['Druide', 'Druid'],
  ['Kämpfer', 'Fighter'],
  ['Mönch', 'Monk'],
  ['Paladin', 'Paladin'],
  ['Waldläufer', 'Ranger'],
  ['Schurke', 'Rogue'],
  ['Zauberer', 'Sorcerer'],
  ['Hexenmeister', 'Warlock'],
  ['Magier', 'Wizard']
];

export const SPRACHEN: readonly Paar[] = [
  ['Gemeinsprache', 'Common'],
  ['Gebärden-Gemeinsprache', 'Common Sign Language'],
  ['Drakonisch', 'Draconic'],
  ['Zwergisch', 'Dwarvish'],
  ['Elfisch', 'Elvish'],
  ['Riesisch', 'Giant'],
  ['Gnomisch', 'Gnomish'],
  ['Goblinisch', 'Goblin'],
  ['Halblingisch', 'Halfling'],
  ['Orkisch', 'Orc'],
  ['Abyssisch', 'Abyssal'],
  ['Celestisch', 'Celestial'],
  ['Tiefensprache', 'Deep Speech'],
  ['Druidisch', 'Druidic'],
  ['Infernalisch', 'Infernal'],
  ['Urtümlich', 'Primordial'],
  ['Sylvanisch', 'Sylvan'],
  ['Diebessprache', 'Thieves’ Cant'],
  ['Gemeinsprache der Unterreiche', 'Undercommon']
];

export const GESINNUNGEN: readonly Paar[] = [
  ['rechtschaffen gut', 'Lawful Good'],
  ['neutral gut', 'Neutral Good'],
  ['chaotisch gut', 'Chaotic Good'],
  ['rechtschaffen neutral', 'Lawful Neutral'],
  ['neutral', 'Neutral'],
  ['chaotisch neutral', 'Chaotic Neutral'],
  ['rechtschaffen böse', 'Lawful Evil'],
  ['neutral böse', 'Neutral Evil'],
  ['chaotisch böse', 'Chaotic Evil'],
  ['gesinnungslos', 'Unaligned']
];

export const GROESSEN: readonly Paar[] = [
  ['Winzig', 'Tiny'],
  ['Klein', 'Small'],
  ['Mittel', 'Medium'],
  ['Groß', 'Large']
];

/** Werkzeuge aus der Ausrüstung des SRD, ohne Preis („Diebeswerkzeug (25 GM)" → „Diebeswerkzeug"). */
export const WERKZEUGE: readonly Paar[] = AUSRUESTUNG.filter((e) => e.abschnitt.en === 'Tools').map(
  (e) => [e.name.de.replace(/\s*\([^)]*\)\s*$/, ''), e.name.en.replace(/\s*\([^)]*\)\s*$/, '')] as const
);

export const WAFFEN_VORSCHLAEGE: readonly Paar[] = [
  ['Einfache Waffen', 'Simple weapons'],
  ['Kriegswaffen', 'Martial weapons'],
  ...WAFFEN.map((w) => w.name)
];

export type Vorschlagsart = 'spezies' | 'hintergrund' | 'klasse' | 'sprachen' | 'gesinnung' | 'groesse' | 'werkzeug' | 'waffen';

const LISTEN: Record<Vorschlagsart, readonly Paar[]> = {
  spezies: SPEZIES,
  hintergrund: HINTERGRUENDE,
  klasse: KLASSEN,
  sprachen: SPRACHEN,
  gesinnung: GESINNUNGEN,
  groesse: GROESSEN,
  werkzeug: WERKZEUGE,
  waffen: WAFFEN_VORSCHLAEGE
};

export function vorschlagsliste(art: Vorschlagsart, sprache: 'de' | 'en'): string[] {
  return [...new Set(LISTEN[art].map((p) => p[sprache === 'de' ? 0 : 1]))];
}

/**
 * Vorschläge zum gerade getippten Teil. In Listenfeldern (Sprachen,
 * Werkzeuge, Waffen) zählt nur, was nach dem letzten Komma steht; was schon
 * im Feld steht, wird nicht noch einmal vorgeschlagen. Anfang vor Mitte.
 */
export function vorschlaege(eingabe: string, liste: readonly string[], mehrere: boolean, hoechstens = 8): string[] {
  const teile = mehrere ? eingabe.split(',') : [eingabe];
  const jetzt = teile[teile.length - 1].trim().toLowerCase();
  if (!jetzt) return [];
  const schon = new Set(teile.slice(0, -1).map((x) => x.trim().toLowerCase()));
  const offen = liste.filter((x) => !schon.has(x.toLowerCase()) && x.toLowerCase() !== jetzt);
  const vorn = offen.filter((x) => x.toLowerCase().startsWith(jetzt));
  const mitte = offen.filter((x) => !x.toLowerCase().startsWith(jetzt) && x.toLowerCase().includes(jetzt));
  return [...vorn, ...mitte].slice(0, hoechstens);
}

/** Setzt den gewählten Vorschlag für den getippten Teil ein. */
export function setzeEin(eingabe: string, wahl: string, mehrere: boolean): string {
  if (!mehrere) return wahl;
  const teile = eingabe.split(',');
  teile[teile.length - 1] = teile.length > 1 ? ` ${wahl}` : wahl;
  return teile.join(',');
}
