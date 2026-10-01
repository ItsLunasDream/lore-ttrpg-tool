/**
 * Textur-Cache für Props.
 *
 * Prozedurale Props werden je Variante *einmal* in eine Textur gebacken. Danach
 * ist jede Platzierung nur noch ein Sprite, und tausende gestreute Steine landen
 * im selben Batch. Würde man pro Instanz Graphics zeichnen, bräche die Framerate
 * schon im dreistelligen Bereich ein.
 */

import { Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
import { Rng, hashSeed } from '@/model/rng';
import { getProp } from '@/assets/library';

const cache = new Map<string, Texture>();
const pending = new Set<string>();
const readyListeners = new Set<(propId: string) => void>();

/** Auflösungsfaktor der gebackenen Texturen — höher = schärfer beim Zoomen. */
const TEXTURE_RESOLUTION = 2;

export function onTextureReady(fn: (propId: string) => void): () => void {
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}

function keyOf(propId: string, variant: number): string {
  return `${propId}#${variant}`;
}

export { variantFor } from '@/assets/varianten';

/**
 * Liefert die Textur für eine Prop-Variante. Prozedurale Props entstehen
 * sofort, importierte werden asynchron geladen — bis dahin kommt null zurück
 * und `onTextureReady` meldet den Nachschlag.
 */
export function getPropTexture(
  renderer: Renderer,
  propId: string,
  variant: number,
): Texture | null {
  const key = keyOf(propId, variant);
  const cached = cache.get(key);
  if (cached) return cached;

  const def = getProp(propId);
  if (!def) return null;

  if (def.draw) {
    const g = new Graphics();
    // Der Seed koppelt Variante an Prop-Id: gleiche Variante, gleiches Aussehen,
    // aber zwei verschiedene Props teilen sich nicht dasselbe Zufallsmuster.
    const rng = new Rng(hashSeed(hashString(propId), variant + 1));
    def.draw(g, rng, variant);

    // Explizites Frame statt automatischer Bounds: sonst schneidet Pixi auf den
    // tatsächlich bemalten Bereich zu und das Prop sitzt nicht mehr mittig.
    const frame = new Rectangle(-def.size.w / 2, -def.size.h / 2, def.size.w, def.size.h);
    const texture = renderer.generateTexture({
      target: g,
      frame,
      resolution: TEXTURE_RESOLUTION,
      antialias: true,
    });
    g.destroy();
    cache.set(key, texture);
    return texture;
  }

  if (def.textureUrl && !pending.has(key)) {
    pending.add(key);
    loadImageTexture(def.textureUrl)
      .then((tex) => {
        cache.set(key, tex);
        pending.delete(key);
        for (const fn of readyListeners) fn(propId);
      })
      .catch((err) => {
        pending.delete(key);
        // Nicht verschlucken: ein stilles catch hat schon einmal verborgen,
        // dass importierte Bilder gar nicht ankamen.
        warnOnce(`Textur konnte nicht geladen werden (${propId}): ${String(err)}`);
      });
  }
  return null;
}

const gewarnt = new Set<string>();

function warnOnce(nachricht: string): void {
  if (gewarnt.has(nachricht)) return;
  gewarnt.add(nachricht);
  console.warn('[propTextures]', nachricht);
}

/**
 * Bild laden und daraus eine Textur bauen.
 *
 * Bewusst über ein `Image` statt über `Assets.load`: Pixi sucht sich den Parser
 * anhand der Dateiendung aus, und ein `blob:`-URL hat keine. Importierte Bilder
 * scheiterten dadurch stillschweigend — im Editor blieb an ihrer Stelle eine
 * leere Fläche, die man für ein Platzierungsproblem halten musste.
 */
async function loadImageTexture(url: string): Promise<Texture> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  // decode() wartet auf das fertig dekodierte Bild; ohne das kann die Textur
  // beim ersten Zeichnen noch leer sein.
  if (typeof img.decode === 'function') {
    await img.decode();
  } else {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Bild nicht lesbar'));
    });
  }
  return Texture.from(img);
}

/** Wirft die Texturen eines Props weg — nach Neuimport oder Bibliotheksänderung. */
export function invalidateProp(propId: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${propId}#`)) {
      cache.get(key)?.destroy(true);
      cache.delete(key);
    }
  }
}

export function clearTextureCache(): void {
  for (const tex of cache.values()) tex.destroy(true);
  cache.clear();
  pending.clear();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
