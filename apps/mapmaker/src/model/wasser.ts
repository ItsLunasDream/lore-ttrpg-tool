/**
 * Wasser im Terrain-Pinsel (Rückmeldung 8).
 *
 * Eine rein blaue Fläche liest sich auf der Karte als Farbfleck, nicht als
 * Wasser. Erkennbar wird Wasser an drei Dingen, die hier zusammenkommen:
 * Wellenlinien auf der Fläche, eine helle Uferkante und ein tieferer Ton.
 * Alles bleibt eine gewöhnliche Zeichnung — Muster und Strich sind die, die
 * jede Fläche haben kann, und lassen sich danach frei ändern.
 */

import type { Fill, Stroke } from './types';

/** Wasserblau als Vorgabe, wenn der Pinsel noch die Bodenfarbe trägt. */
export const WASSER_FARBE = 0x3f7896;

/** Heller Ton für Wellen und Ufer. */
const GISCHT = 0xd8eef3;

/** Füllung und Uferkante einer Wasserfläche. */
export function wasserAussehen(color: number, alpha: number, tileSize: number): { fill: Fill; stroke: Stroke } {
  return {
    fill: {
      color,
      alpha,
      // Wellen etwa eine Feldbreite groß: kleiner flimmern sie, größer
      // sehen sie aus wie Schrift.
      pattern: { kind: 'waves', size: Math.max(24, tileSize * 1.1), color: GISCHT, alpha: 0.35, angle: 0 },
    },
    stroke: {
      color: GISCHT,
      width: Math.max(3, tileSize * 0.08),
      alpha: 0.7,
      dash: [],
    },
  };
}

/** Ist diese Fläche eine Wasserfläche aus dem Pinsel? */
export function istWasser(fill: Fill | null | undefined): boolean {
  return fill?.pattern?.kind === 'waves';
}

/**
 * Endet der Zug dort, wo er begann, ist ein See gemeint: dann zählt der
 * umfahrene Umriss, nicht das Band. Ein Kreis aus einem breiten Band hätte
 * sonst ein Loch in der Mitte.
 *
 * Nähe gemessen an der Pinselbreite, mindestens aber an einem Feld — ein
 * dünner Pinsel trifft seinen Anfang sonst nie.
 */
export function istRundum(punkte: number[], breite: number, tileSize: number): boolean {
  const n = punkte.length;
  if (n < 12) return false;
  const dx = punkte[n - 2] - punkte[0];
  const dy = punkte[n - 1] - punkte[1];
  const naehe = Math.max(breite, tileSize);
  if (Math.hypot(dx, dy) > naehe) return false;
  // Ein kurzer Hin-und-her-Strich endet auch am Anfang; ein See umschließt
  // eine Fläche, die deutlich größer ist als der Anfangsabstand.
  let flaeche = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    flaeche += punkte[i] * punkte[j + 1] - punkte[j] * punkte[i + 1];
  }
  return Math.abs(flaeche) / 2 > naehe * naehe * 2;
}
