/**
 * Gestalten: welche Tiere eine Figur annehmen kann (docs/tiergestalt.md).
 *
 * Die Grenzen stehen woertlich im SRD 5.2.1 und sind dort nachgelesen
 * (englische Fassung, S. 42 f. und die Zauber):
 * - Tiergestalt (Druide, „Beast Shapes"): Stufe 2: 4 Gestalten, HG 1/4,
 *   kein Flug; Stufe 4: 6, HG 1/2, kein Flug; Stufe 8: 8, HG 1, Flug.
 *   Nutzungen laut Klassentabelle: 2 ab Stufe 2, 3 ab 6, 4 ab 17.
 *   Temporaere TP beim Verwandeln: die Druidenstufe.
 * - Vertrauter finden: ein Tier mit HG 0.
 * - Verwandlung (Polymorph): ein Tier mit HG hoechstens gleich dem HG
 *   (oder der Stufe) des Ziels.
 * - Tiergestalten (Animal Shapes): HG hoechstens 4, hoechstens gross.
 *
 * Der Zirkel des Mondes steht nicht im SRD; dafuer gibt es die freie
 * Grenze („eigene"), ohne den Zirkel zu nennen.
 */
import { SRD_MONSTER, type MonsterGroesse, type SrdMonster } from './monster';
import type { Paar } from './namensnennung';

export type Bewegungsart = 'laufen' | 'klettern' | 'schwimmen' | 'fliegen' | 'graben';
export const BEWEGUNGSARTEN: readonly Bewegungsart[] = ['laufen', 'klettern', 'schwimmen', 'fliegen', 'graben'];

export const BEWEGUNGSART_NAME: Record<Bewegungsart, Paar> = {
  laufen: { de: 'Laufen', en: 'Walk' },
  klettern: { de: 'Klettern', en: 'Climb' },
  schwimmen: { de: 'Schwimmen', en: 'Swim' },
  fliegen: { de: 'Fliegen', en: 'Fly' },
  graben: { de: 'Graben', en: 'Burrow' }
};

export type Sinn = 'dunkelsicht' | 'blindsicht' | 'erschuetterungssinn';
export const SINNE: readonly Sinn[] = ['dunkelsicht', 'blindsicht', 'erschuetterungssinn'];
export const SINN_NAME: Record<Sinn, Paar> = {
  dunkelsicht: { de: 'Dunkelsicht', en: 'Darkvision' },
  blindsicht: { de: 'Blindsicht', en: 'Blindsight' },
  erschuetterungssinn: { de: 'Erschütterungssinn', en: 'Tremorsense' }
};

export const GROESSEN: readonly MonsterGroesse[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
export const GROESSE_NAME: Record<MonsterGroesse, Paar> = {
  tiny: { de: 'Winzig', en: 'Tiny' },
  small: { de: 'Klein', en: 'Small' },
  medium: { de: 'Mittelgroß', en: 'Medium' },
  large: { de: 'Groß', en: 'Large' },
  huge: { de: 'Riesig', en: 'Huge' },
  gargantuan: { de: 'Gigantisch', en: 'Gargantuan' }
};

/** Eine Gestalt: das Tier und was sich daraus maschinell lesen laesst. */
export interface Gestalt {
  readonly monster: SrdMonster;
  /** HG als Zahl: „1/4" → 0.25. */
  readonly hg: number;
  /** Bewegungsraten in Fuss, nur die vorhandenen. */
  readonly bewegung: Partial<Record<Bewegungsart, number>>;
  /** Reichweite der Sinne in Fuss, nur die vorhandenen. */
  readonly sinne: Partial<Record<Sinn, number>>;
  /** Ein Schwarm winziger Tiere. Ob der als Tiergestalt zaehlt, entscheidet der Tisch. */
  readonly schwarm: boolean;
}

export function hgZahl(hg: string): number {
  const [z, n] = hg.split('/');
  return n ? Number(z) / Number(n) : Number(z);
}

/** „30 ft., Climb or Fly 20 ft. (GM’s choice)" → { laufen: 30, klettern: 20, fliegen: 20 }. */
export function leseBewegung(text: string): Partial<Record<Bewegungsart, number>> {
  const aus: Partial<Record<Bewegungsart, number>> = {};
  const woerter: Record<string, Bewegungsart> = { climb: 'klettern', swim: 'schwimmen', fly: 'fliegen', burrow: 'graben' };
  for (const teil of text.split(',')) {
    const zahl = /(\d+)\s*ft\./.exec(teil);
    if (!zahl) continue;
    const arten = [...teil.toLowerCase().matchAll(/\b(climb|swim|fly|burrow)\b/g)].map((m) => woerter[m[1]]);
    if (arten.length === 0) aus.laufen = Number(zahl[1]);
    for (const art of arten) aus[art] = Number(zahl[1]);
  }
  return aus;
}

/** Die Sinne aus der englischen Zeile „Senses Blindsight 10 ft., Darkvision 60 ft.; …". */
export function leseSinne(zeilen: readonly string[]): Partial<Record<Sinn, number>> {
  const aus: Partial<Record<Sinn, number>> = {};
  const zeile = zeilen.find((z) => z.startsWith('Senses')) ?? '';
  const woerter: Record<string, Sinn> = { darkvision: 'dunkelsicht', blindsight: 'blindsicht', tremorsense: 'erschuetterungssinn' };
  for (const m of zeile.matchAll(/(Darkvision|Blindsight|Tremorsense) (\d+) ft\./g)) aus[woerter[m[1].toLowerCase()]] = Number(m[2]);
  return aus;
}

let alle: readonly Gestalt[] | null = null;

/** Alle Tiere des SRD als Gestalten, nach HG und Namen. */
export function alleGestalten(): readonly Gestalt[] {
  alle ??= SRD_MONSTER.filter((m) => m.typ === 'beast')
    .map((monster) => ({
      monster,
      hg: hgZahl(monster.hg),
      bewegung: leseBewegung(monster.bewegung.en),
      sinne: leseSinne(monster.zeilen.en),
      schwarm: /\bSwarm\b/.test(monster.art.en)
    }))
    .sort((a, b) => a.hg - b.hg || a.monster.name.en.localeCompare(b.monster.name.en));
  return alle;
}

export function gestaltNach(id: string): Gestalt | undefined {
  return alleGestalten().find((g) => g.monster.id === id);
}

/** Was eine Gestalt erfuellen muss. */
export interface Grenze {
  readonly maxHg: number;
  /** Nur genau dieser HG (Vertrauter: 0). */
  readonly nurHg?: number;
  readonly flug: boolean;
  readonly maxGroesse?: MonsterGroesse;
}

export function erfuellt(g: Gestalt, grenze: Grenze): boolean {
  if (grenze.nurHg !== undefined ? g.hg !== grenze.nurHg : g.hg > grenze.maxHg) return false;
  if (!grenze.flug && g.bewegung.fliegen !== undefined) return false;
  if (grenze.maxGroesse && GROESSEN.indexOf(g.monster.groesse) > GROESSEN.indexOf(grenze.maxGroesse)) return false;
  return true;
}

/** Tiergestalt des Druiden nach Stufe (SRD „Beast Shapes"); `null` unter Stufe 2. */
export interface Tiergestaltstufe {
  readonly bekannt: number;
  readonly maxHg: number;
  readonly flug: boolean;
  /** Nutzungen je langer Rast (Spalte „Wild Shape" der Klassentabelle). */
  readonly nutzungen: number;
  /** Temporaere TP beim Verwandeln. */
  readonly tempTp: number;
  /** Hoechstdauer in Stunden: die halbe Druidenstufe. */
  readonly stunden: number;
}

export function tiergestaltFuer(stufe: number): Tiergestaltstufe | null {
  const s = Math.floor(stufe);
  if (!(s >= 2)) return null;
  const stufeN = Math.min(s, 20);
  const [bekannt, maxHg, flug] = stufeN >= 8 ? [8, 1, true] : stufeN >= 4 ? [6, 0.5, false] : [4, 0.25, false];
  const nutzungen = stufeN >= 17 ? 4 : stufeN >= 6 ? 3 : 2;
  return { bekannt, maxHg, flug, nutzungen, tempTp: stufeN, stunden: Math.floor(stufeN / 2) };
}

/** Die Voreinstellungen des Filters. */
export type Vorgabe = 'tiergestalt' | 'vertrauter' | 'verwandlung' | 'tiergestalten' | 'eigene' | 'alle';
export const VORGABEN: readonly Vorgabe[] = ['tiergestalt', 'vertrauter', 'verwandlung', 'tiergestalten', 'eigene', 'alle'];

export const VORGABE_NAME: Record<Vorgabe, Paar> = {
  tiergestalt: { de: 'Tiergestalt (Druide)', en: 'Wild Shape (Druid)' },
  vertrauter: { de: 'Vertrauter finden', en: 'Find Familiar' },
  verwandlung: { de: 'Verwandlung', en: 'Polymorph' },
  tiergestalten: { de: 'Tiergestalten', en: 'Animal Shapes' },
  eigene: { de: 'Eigene Grenze', en: 'Custom limit' },
  alle: { de: 'Alle Tiere', en: 'All beasts' }
};

/**
 * Die Grenze einer Vorgabe. `wert`: Druidenstufe (Tiergestalt), HG oder
 * Stufe des Ziels (Verwandlung), Hoechst-HG (eigene); `flug` nur fuer die
 * eigene Grenze.
 */
export function grenzeFuer(vorgabe: Vorgabe, wert: number, flug = true): Grenze | null {
  switch (vorgabe) {
    case 'tiergestalt': {
      const t = tiergestaltFuer(wert);
      return t ? { maxHg: t.maxHg, flug: t.flug } : null;
    }
    case 'vertrauter':
      return { maxHg: 0, nurHg: 0, flug: true };
    case 'verwandlung':
      return { maxHg: Math.max(0, wert), flug: true };
    case 'tiergestalten':
      return { maxHg: 4, flug: true, maxGroesse: 'large' };
    case 'eigene':
      return { maxHg: Math.max(0, wert), flug };
    case 'alle':
      return { maxHg: Infinity, flug: true };
  }
}

/** HG zur Anzeige: 0.25 → „1/4". */
export function hgText(hg: number): string {
  if (hg === 0.125) return '1/8';
  if (hg === 0.25) return '1/4';
  if (hg === 0.5) return '1/2';
  return String(hg);
}
