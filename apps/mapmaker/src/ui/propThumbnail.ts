/**
 * Vorschaubilder für die Prop-Palette.
 *
 * Nutzt denselben Pixi-Renderer wie die Bühne und extrahiert ein Canvas-Element,
 * das direkt in den DOM gehängt wird. Ergebnisse werden gecached — die Palette
 * baut sich beim Scrollen sonst dutzendfach neu auf.
 */

import { Graphics, Rectangle } from 'pixi.js';
import { Rng, hashSeed } from '@/model/rng';
import type { PropDef } from '@/assets/propTypes';
import { getRenderer } from '@/engine/instance';

const cache = new Map<string, HTMLCanvasElement>();

const THUMB_SIZE = 92;

export function getThumbnail(def: PropDef): HTMLCanvasElement | null {
  const cached = cache.get(def.id);
  if (cached) return cached;

  const renderer = getRenderer();
  if (!renderer || !def.draw) return null;

  const g = new Graphics();
  def.draw(g, new Rng(hashSeed(1, def.id.length, def.name.length)), 0);

  // Quadratisches Frame um die Prop-Ausdehnung, damit breite und hohe Props
  // in der Palette gleich groß erscheinen.
  const extent = Math.max(def.size.w, def.size.h);
  const frame = new Rectangle(-extent / 2, -extent / 2, extent, extent);

  try {
    const canvas = renderer.app.renderer.extract.canvas({
      target: g,
      frame,
      resolution: THUMB_SIZE / extent,
      antialias: true,
    }) as HTMLCanvasElement;
    g.destroy();
    cache.set(def.id, canvas);
    return canvas;
  } catch {
    g.destroy();
    return null;
  }
}

export function clearThumbnailCache(): void {
  cache.clear();
}
