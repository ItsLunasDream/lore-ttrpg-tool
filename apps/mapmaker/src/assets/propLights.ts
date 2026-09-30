/**
 * Props, die leuchten (Rückmeldung: „Platzierte Lichtquellen sollen direkt
 * ein VTT-Light mit platziert bekommen").
 *
 * Reichweite in Feldern, Farbe als 0xRRGGBB. Die Werte sind Ausgangspunkte
 * und lassen sich am Prop ändern; sie orientieren sich an D&D-Lichtquellen
 * (Fackel 20 ft hell + 20 ft dämmrig ≈ 8 Felder, Kerze ≈ 2).
 */

import type { PropLight } from '@/model/types';

export const LEUCHTENDE_PROPS: Readonly<Record<string, PropLight>> = {
  wall_torch: { range: 8, color: 0xffb35c, intensity: 1 },
  brazier: { range: 6, color: 0xff9d4a, intensity: 1 },
  campfire: { range: 8, color: 0xffa050, intensity: 1 },
  cookfire: { range: 5, color: 0xffa050, intensity: 0.9 },
  fireplace: { range: 6, color: 0xff9d4a, intensity: 1 },
  forge: { range: 5, color: 0xff7a3a, intensity: 1 },
  lantern: { range: 6, color: 0xffd28a, intensity: 1 },
  lamp_post: { range: 7, color: 0xffd28a, intensity: 1 },
  candles: { range: 2, color: 0xffd9a0, intensity: 0.7 },
  stove: { range: 2, color: 0xff9a4a, intensity: 0.6 },
  magic_portal: { range: 5, color: 0xb48aff, intensity: 0.8 },
  crystal_ball: { range: 1.5, color: 0x9ec8ff, intensity: 0.5 },
  candelabra: { range: 3, color: 0xffd9a0, intensity: 0.8 },
  mushrooms_glowing: { range: 2, color: 0x7fe0c8, intensity: 0.6 },
  crystals: { range: 2, color: 0x9ec8ff, intensity: 0.6 },
  lava_crack: { range: 3, color: 0xff5a28, intensity: 0.8 },
};

/** Licht für ein neu gesetztes Prop, oder undefined, wenn es nicht leuchtet. */
export function lichtFuerProp(propId: string): PropLight | undefined {
  const l = LEUCHTENDE_PROPS[propId];
  return l ? { ...l } : undefined;
}
