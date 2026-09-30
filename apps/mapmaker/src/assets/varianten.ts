/**
 * Welche Variante ein Prop zeigt, hängt an seinem Seed.
 *
 * Steht hier und nicht im Renderer, damit der Inspektor dieselbe Rechnung
 * benutzt, ohne Pixi zu laden — zwei Rechnungen liefen auseinander, und der
 * Regler zeigte dann eine andere Variante als die Karte.
 */

import { hashSeed } from '@/model/rng';
import { getProp } from './library';

/** Variante zu einem Seed, 0 bis `variants - 1`. */
export function variantFor(propId: string, seed: number): number {
  const def = getProp(propId);
  if (!def || def.variants <= 1) return 0;
  return hashSeed(seed) % def.variants;
}

/**
 * Ein Seed, der die gewünschte Variante ergibt. Gesucht wird ab dem
 * bisherigen Seed aufwärts; die Varianten sind über die Seeds gleich
 * verteilt, nach wenigen Schritten ist einer gefunden.
 */
export function seedFuerVariante(propId: string, seed: number, ziel: number): number {
  const def = getProp(propId);
  if (!def || def.variants <= 1) return seed;
  const soll = ((ziel % def.variants) + def.variants) % def.variants;
  for (let s = seed + 1; s < seed + 100000; s++) if (hashSeed(s) % def.variants === soll) return s;
  return seed;
}
