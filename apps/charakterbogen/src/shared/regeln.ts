/**
 * Was sich an einem Bogen sicher rechnen laesst, nach SRD 5.2 (Regeln von
 * 2024). Nur reine Funktionen, ohne Oberflaeche und ohne Datei.
 *
 * Bewusst wenig: Modifikatoren, Uebungsbonus, Boni auf Rettungswuerfe und
 * Fertigkeiten, passive Wahrnehmung, Zauber-SG. Klassenmerkmale und
 * Stufenaufstieg rechnet der Bogen nicht (siehe docs/charakterbogen.md).
 */

export type Sprache = 'de' | 'en';

export const ATTRIBUTE = ['sta', 'ges', 'kon', 'int', 'wei', 'cha'] as const;
export type Attribut = (typeof ATTRIBUTE)[number];

/** Kurz und lang, wie auf dem deutschen und englischen Bogen. */
export const ATTRIBUT_NAMEN: Record<Attribut, { kurz: [string, string]; lang: [string, string] }> = {
  sta: { kurz: ['STÄ', 'STR'], lang: ['Stärke', 'Strength'] },
  ges: { kurz: ['GES', 'DEX'], lang: ['Geschicklichkeit', 'Dexterity'] },
  kon: { kurz: ['KON', 'CON'], lang: ['Konstitution', 'Constitution'] },
  int: { kurz: ['INT', 'INT'], lang: ['Intelligenz', 'Intelligence'] },
  wei: { kurz: ['WEI', 'WIS'], lang: ['Weisheit', 'Wisdom'] },
  cha: { kurz: ['CHA', 'CHA'], lang: ['Charisma', 'Charisma'] }
};

export interface Fertigkeit {
  readonly id: string;
  readonly attribut: Attribut;
  readonly name: [string, string];
}

/**
 * Die 18 Fertigkeiten. Die deutschen Namen sind die der deutschen
 * SRD-Fassung (so stehen sie dort in „Geschicklichkeitswurf (Heimlichkeit)"
 * und aehnlichen Wendungen).
 */
export const FERTIGKEITEN: readonly Fertigkeit[] = [
  { id: 'akrobatik', attribut: 'ges', name: ['Akrobatik', 'Acrobatics'] },
  { id: 'arkane-kunde', attribut: 'int', name: ['Arkane Kunde', 'Arcana'] },
  { id: 'athletik', attribut: 'sta', name: ['Athletik', 'Athletics'] },
  { id: 'auftreten', attribut: 'cha', name: ['Auftreten', 'Performance'] },
  { id: 'einschuechtern', attribut: 'cha', name: ['Einschüchtern', 'Intimidation'] },
  { id: 'fingerfertigkeit', attribut: 'ges', name: ['Fingerfertigkeit', 'Sleight of Hand'] },
  { id: 'geschichte', attribut: 'int', name: ['Geschichte', 'History'] },
  { id: 'heilkunde', attribut: 'wei', name: ['Heilkunde', 'Medicine'] },
  { id: 'heimlichkeit', attribut: 'ges', name: ['Heimlichkeit', 'Stealth'] },
  { id: 'mit-tieren-umgehen', attribut: 'wei', name: ['Mit Tieren umgehen', 'Animal Handling'] },
  { id: 'motiv-erkennen', attribut: 'wei', name: ['Motiv erkennen', 'Insight'] },
  { id: 'nachforschungen', attribut: 'int', name: ['Nachforschungen', 'Investigation'] },
  { id: 'naturkunde', attribut: 'int', name: ['Naturkunde', 'Nature'] },
  { id: 'religion', attribut: 'int', name: ['Religion', 'Religion'] },
  { id: 'taeuschen', attribut: 'cha', name: ['Täuschen', 'Deception'] },
  { id: 'ueberlebenskunst', attribut: 'wei', name: ['Überlebenskunst', 'Survival'] },
  { id: 'ueberzeugen', attribut: 'cha', name: ['Überzeugen', 'Persuasion'] },
  { id: 'wahrnehmung', attribut: 'wei', name: ['Wahrnehmung', 'Perception'] }
];

/** 0 = keine Uebung, 1 = Uebung, 2 = Expertise (doppelter Uebungsbonus). */
export type Uebung = 0 | 1 | 2;

/** Modifikator eines Attributswerts: (Wert − 10) / 2, abgerundet. */
export function modifikator(wert: number): number {
  return Math.floor((wert - 10) / 2);
}

/** +2 auf Stufe 1–4, +3 auf 5–8, … +6 auf 17–20. */
export function uebungsbonus(gesamtstufe: number): number {
  const stufe = Math.min(20, Math.max(1, Math.floor(gesamtstufe) || 1));
  return 2 + Math.floor((stufe - 1) / 4);
}

export function mitVorzeichen(zahl: number): string {
  return zahl >= 0 ? `+${zahl}` : `−${Math.abs(zahl)}`;
}

export function fertigkeitsBonus(attributswert: number, uebung: Uebung, pb: number): number {
  return modifikator(attributswert) + uebung * pb;
}

/** Passive Wahrnehmung: 10 + Bonus auf Weisheit (Wahrnehmung). */
export function passiv(bonus: number): number {
  return 10 + bonus;
}

/** Zauber-SG: 8 + Zaubermodifikator + Uebungsbonus. */
export function zauberSg(attributswert: number, pb: number): number {
  return 8 + modifikator(attributswert) + pb;
}

export function zauberAngriff(attributswert: number, pb: number): number {
  return modifikator(attributswert) + pb;
}

/**
 * Traglast in Pfund (englisch) oder Kilogramm (deutsch), nach der Tabelle
 * „Traglast" des SRD: klein oder mittelgross Staerke × 15 lb bzw. × 7,5 kg.
 * Andere Groessen stehen in der Tabelle; der Bogen kennt vorerst nur diese.
 */
export function traglast(staerke: number, sprache: Sprache): number {
  return sprache === 'de' ? staerke * 7.5 : staerke * 15;
}
