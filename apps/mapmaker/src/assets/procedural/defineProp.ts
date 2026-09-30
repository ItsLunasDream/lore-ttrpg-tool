/**
 * Bauhelfer für prozedurale Props.
 *
 * Steht eigens, damit die Prop-Sammlungen nach Themen auf mehrere Dateien
 * verteilt werden können, ohne sich gegenseitig zu importieren.
 */

import type { Graphics } from 'pixi.js';
import type { Rng } from '@/model/rng';
import type { PropDef } from '../propTypes';

/**
 * Zeichnet eine Variante. `variant` ist der Index (0 bis `variants - 1`);
 * die meisten Props brauchen ihn nicht und nehmen nur den Zufall. Gebäude
 * wählen damit ihren Grundriss, damit jede Form sicher vorkommt — über den
 * Zufall allein fehlte bei acht Varianten mitunter eine ganze Bauart.
 */
export type Draw = (g: Graphics, rng: Rng, variant: number) => void;

export function def(
  id: string,
  name: string,
  category: PropDef['category'],
  size: number | { w: number; h: number },
  tags: string[],
  draw: Draw,
  variants = 8,
): PropDef {
  return {
    id,
    name,
    category,
    tags,
    source: 'builtin',
    size: typeof size === 'number' ? { w: size, h: size } : size,
    tintable: true,
    variants,
    draw,
  };
}
