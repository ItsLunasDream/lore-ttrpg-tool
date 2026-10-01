/** Beschreibung eines platzierbaren Props. */

import type { Graphics } from 'pixi.js';
import type { Rng } from '@/model/rng';
import { t } from '@/i18n';
import type { StringKey } from '@/i18n';

export type PropCategory =
  | 'stein'
  | 'pflanze'
  | 'baum'
  | 'boden'
  | 'moebel'
  | 'dungeon'
  | 'struktur'
  | 'deko'
  | 'welt'
  | 'gebaeude'
  | 'import';

export interface PropDef {
  id: string;
  name: string;
  category: PropCategory;
  tags: string[];
  source: 'builtin' | 'imported';
  /**
   * Basisgröße bei Skalierung 1, in Pixeln bezogen auf ein 100-px-Tile.
   * Bei anderer Tile-Größe skaliert der Renderer entsprechend.
   */
  size: { w: number; h: number };
  /** Lässt sich das Prop einfärben? Prozedurale Props: fast immer ja. */
  tintable: boolean;
  /** Anzahl unterscheidbarer prozeduraler Varianten. */
  variants: number;
  /**
   * Zeichnet eine Variante zentriert um (0,0). Nur bei prozeduralen Props.
   * Der Renderer ruft das einmal je Variante und cached das Ergebnis als Textur.
   */
  draw?: (g: Graphics, rng: Rng, variant: number) => void;
  /** Bei importierten Assets: Objekt-URL der Bilddatei. */
  textureUrl?: string;
}

/** Feste Reihenfolge der Kategorien in der Palette. */
export const CATEGORY_ORDER: PropCategory[] = [
  'stein',
  'pflanze',
  'baum',
  'boden',
  'moebel',
  'dungeon',
  'struktur',
  'deko',
  'gebaeude',
  'welt',
  'import',
];

/** Übersetzte Beschriftung einer Kategorie. */
export function categoryLabel(category: PropCategory): string {
  return t(`cat.${category}` as StringKey);
}

/**
 * Übersetzter Name eines Props.
 *
 * Eingebaute Props haben einen Schlüssel `prop.<id>`; importierte Assets tragen
 * ihren Dateinamen und werden durchgereicht.
 */
export function propName(def: Pick<PropDef, 'id' | 'name' | 'source'>): string {
  if (def.source !== 'builtin') return def.name;
  const translated = t(`prop.${def.id}` as StringKey);
  return translated === `prop.${def.id}` ? def.name : translated;
}
