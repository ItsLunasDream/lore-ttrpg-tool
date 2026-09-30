/**
 * Trefferprüfung und Ausdehnung von Objekten.
 *
 * Bewusst ohne Pixi: dieselbe Rechnung braucht später auch der Export und der
 * Rahmen-Auswahl-Test. Textmaße kann das Modell nicht kennen, die reicht der
 * Renderer über `metrics` nach.
 */

import { flattenLayers, isEffectivelyVisible, isObjectEditable, objectsOfLayer } from '@/model/document';
import { getProp } from '@/assets/library';
import { isSystemLayer, type MapDocument, type MapObject, type ObjectId } from '@/model/types';
import type { Point } from '@/model/grid';

export type TextMetrics = Map<ObjectId, { w: number; h: number }>;

/** Referenz-Tilegröße, auf die sich die Prop-Maße beziehen. */
export const REFERENCE_TILE = 100;

/** Maßstab, mit dem Props an die aktuelle Tile-Größe angepasst werden. */
export function tileScale(doc: MapDocument): number {
  return doc.grid.tileSize / REFERENCE_TILE;
}

/** Halbe Breite und Höhe im *lokalen*, unrotierten Koordinatensystem. */
export function halfExtents(
  doc: MapDocument,
  obj: MapObject,
  metrics?: TextMetrics,
): { hw: number; hh: number } {
  switch (obj.kind) {
    case 'prop': {
      const def = getProp(obj.propId);
      const s = tileScale(doc);
      const w = (def?.size.w ?? REFERENCE_TILE) * Math.abs(obj.scaleX) * s;
      const h = (def?.size.h ?? REFERENCE_TILE) * Math.abs(obj.scaleY) * s;
      return { hw: w / 2, hh: h / 2 };
    }
    case 'shape': {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < obj.points.length; i += 2) {
        if (obj.points[i] < minX) minX = obj.points[i];
        if (obj.points[i] > maxX) maxX = obj.points[i];
        if (obj.points[i + 1] < minY) minY = obj.points[i + 1];
        if (obj.points[i + 1] > maxY) maxY = obj.points[i + 1];
      }
      if (!Number.isFinite(minX)) return { hw: 0, hh: 0 };
      // Der Strich ragt über die Punkte hinaus, sonst greift der Auswahlrahmen zu eng.
      const pad = (obj.stroke?.width ?? 0) / 2;
      return { hw: (maxX - minX) / 2 + pad, hh: (maxY - minY) / 2 + pad };
    }
    case 'text': {
      const m = metrics?.get(obj.id);
      if (m) return { hw: m.w / 2, hh: m.h / 2 };
      // Grobe Schätzung, bis der Renderer echte Maße gemeldet hat.
      const lines = obj.text.split('\n');
      const longest = lines.reduce((a, l) => Math.max(a, l.length), 1);
      return {
        hw: (longest * obj.fontSize * 0.52) / 2,
        hh: (lines.length * obj.fontSize * obj.lineHeight) / 2,
      };
    }
  }
}

/**
 * Mittelpunkt in Weltkoordinaten. Props und Texte sitzen auf ihrem Ankerpunkt;
 * bei Shapes liegt der Ursprung dort, wo der Strich begann, also muss der
 * Mittelpunkt aus den Punkten berechnet und mitrotiert werden.
 */
export function objectCenter(_doc: MapDocument, obj: MapObject): Point {
  const local = localCenterOffset(obj);
  if (local.x === 0 && local.y === 0) return { x: obj.x, y: obj.y };
  const cos = Math.cos(obj.rotation);
  const sin = Math.sin(obj.rotation);
  return {
    x: obj.x + local.x * cos - local.y * sin,
    y: obj.y + local.x * sin + local.y * cos,
  };
}

/**
 * Abstand der Mitte vom Ursprung, im *eigenen* Bezugssystem des Objekts.
 *
 * Bleibt beim Drehen gleich — anders als der Weltmittelpunkt. Wer um die Mitte
 * drehen will, braucht genau diesen Wert (siehe `rotateAroundCenterPatch`).
 */
export function localCenterOffset(obj: MapObject): Point {
  if (obj.kind !== 'shape') return { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < obj.points.length; i += 2) {
    minX = Math.min(minX, obj.points[i]);
    maxX = Math.max(maxX, obj.points[i]);
    minY = Math.min(minY, obj.points[i + 1]);
    maxY = Math.max(maxY, obj.points[i + 1]);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** Achsenparallele Hülle in Weltkoordinaten — für Culling und Auswahlrahmen. */
export function worldAABB(
  doc: MapDocument,
  obj: MapObject,
  metrics?: TextMetrics,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const { hw, hh } = halfExtents(doc, obj, metrics);
  const c = objectCenter(doc, obj);
  const cos = Math.abs(Math.cos(obj.rotation));
  const sin = Math.abs(Math.sin(obj.rotation));
  const ex = hw * cos + hh * sin;
  const ey = hw * sin + hh * cos;
  return { minX: c.x - ex, minY: c.y - ey, maxX: c.x + ex, maxY: c.y + ey };
}

/** Liegt der Weltpunkt im (rotierten) Rechteck des Objekts? */
export function containsPoint(
  doc: MapDocument,
  obj: MapObject,
  p: Point,
  metrics?: TextMetrics,
): boolean {
  const c = objectCenter(doc, obj);
  const { hw, hh } = halfExtents(doc, obj, metrics);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cos = Math.cos(-obj.rotation);
  const sin = Math.sin(-obj.rotation);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}

/**
 * Oberstes anfassbares Objekt an einer Weltposition.
 * Sucht von der obersten Ebene abwärts — man erwartet zu treffen, was man sieht.
 *
 * `accept` blendet Objektarten aus, die der Auswahlfilter gerade sperrt.
 */
export function pickObject(
  doc: MapDocument,
  p: Point,
  metrics?: TextMetrics,
  accept?: (o: MapObject) => boolean,
): MapObject | null {
  const layers = flattenLayers(doc);
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.isGroup || isSystemLayer(layer.id)) continue;
    if (!isEffectivelyVisible(doc, layer.id)) continue;

    const objects = objectsOfLayer(doc, layer.id);
    for (let j = objects.length - 1; j >= 0; j--) {
      const o = objects[j];
      if (!isObjectEditable(doc, o.id)) continue;
      if (accept && !accept(o)) continue;
      if (containsPoint(doc, o, p, metrics)) return o;
    }
  }
  return null;
}

/**
 * Alle anfassbaren Objekte an einer Stelle, oberstes zuerst.
 *
 * Für das Durchklicken (Rückmeldung): liegen mehrere Objekte übereinander,
 * wählt jeder weitere Klick an derselben Stelle das nächste darunter.
 * Objekte einer Gruppe zählen einmal, sonst bliebe der Klick in der Gruppe
 * hängen.
 */
export function pickAllObjects(
  doc: MapDocument,
  p: Point,
  metrics?: TextMetrics,
  accept?: (o: MapObject) => boolean,
): MapObject[] {
  const out: MapObject[] = [];
  const gruppen = new Set<string>();
  const layers = flattenLayers(doc);
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.isGroup || isSystemLayer(layer.id)) continue;
    if (!isEffectivelyVisible(doc, layer.id)) continue;
    const objects = objectsOfLayer(doc, layer.id);
    for (let j = objects.length - 1; j >= 0; j--) {
      const o = objects[j];
      if (!isObjectEditable(doc, o.id)) continue;
      if (accept && !accept(o)) continue;
      if (!containsPoint(doc, o, p, metrics)) continue;
      if (o.groupId) {
        if (gruppen.has(o.groupId)) continue;
        gruppen.add(o.groupId);
      }
      out.push(o);
    }
  }
  return out;
}

/** Alle anfassbaren Objekte, deren Hülle im Rechteck liegt — Rubberband-Auswahl. */
export function pickInRect(
  doc: MapDocument,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  metrics?: TextMetrics,
  accept?: (o: MapObject) => boolean,
): ObjectId[] {
  const out: ObjectId[] = [];
  for (const id in doc.objects) {
    const o = doc.objects[id];
    if (!isObjectEditable(doc, id)) continue;
    if (isSystemLayer(o.layerId)) continue;
    if (accept && !accept(o)) continue;
    const b = worldAABB(doc, o, metrics);
    if (b.maxX < rect.minX || b.minX > rect.maxX) continue;
    if (b.maxY < rect.minY || b.minY > rect.maxY) continue;
    out.push(id);
  }
  return out;
}

/** Gemeinsame Hülle mehrerer Objekte. */
export function selectionBounds(
  doc: MapDocument,
  ids: ObjectId[],
  metrics?: TextMetrics,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const o = doc.objects[id];
    if (!o) continue;
    const b = worldAABB(doc, o, metrics);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

// ---------------------------------------------------------------------------
// Griffe zum Drehen und Skalieren
// ---------------------------------------------------------------------------

export type HandleId = 'nw' | 'ne' | 'se' | 'sw' | 'rotate';

export interface Handle {
  id: HandleId;
  x: number;
  y: number;
}

/** Abstand des Drehgriffs über der oberen Kante, in Bildschirmpixeln. */
export const ROTATE_HANDLE_OFFSET = 26;

/**
 * Griffe eines Objekts in Weltkoordinaten.
 *
 * Sie sitzen auf dem *rotierten* Rechteck, nicht auf der achsenparallelen
 * Hülle: ein gedrehtes Objekt an seiner Hülle anzufassen fühlt sich falsch an,
 * weil die Griffe dann nicht an den sichtbaren Ecken liegen.
 *
 * `zoom` geht ein, weil der Drehgriff einen festen Bildschirmabstand haben
 * soll — sonst klebt er beim Herauszoomen am Objekt.
 */
export function objectHandles(
  doc: MapDocument,
  obj: MapObject,
  zoom: number,
  metrics?: TextMetrics,
): Handle[] {
  const c = objectCenter(doc, obj);
  const { hw, hh } = halfExtents(doc, obj, metrics);
  const cos = Math.cos(obj.rotation);
  const sin = Math.sin(obj.rotation);

  const punkt = (lx: number, ly: number) => ({
    x: c.x + lx * cos - ly * sin,
    y: c.y + lx * sin + ly * cos,
  });

  const nw = punkt(-hw, -hh);
  const ne = punkt(hw, -hh);
  const se = punkt(hw, hh);
  const sw = punkt(-hw, hh);
  const rot = punkt(0, -hh - ROTATE_HANDLE_OFFSET / zoom);

  return [
    { id: 'nw', ...nw },
    { id: 'ne', ...ne },
    { id: 'se', ...se },
    { id: 'sw', ...sw },
    { id: 'rotate', ...rot },
  ];
}

/**
 * Griffe einer Mehrfachauswahl, auf der achsenparallelen Hülle.
 *
 * Anders als beim einzelnen Objekt *nicht* auf einem gedrehten Rechteck: die
 * Mitglieder können unterschiedlich gedreht sein, ein gemeinsamer Winkel ist
 * also gar nicht bestimmt. Die Hülle ist das, was man auch sieht.
 */
export function groupHandles(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  zoom: number,
): Handle[] {
  const { minX, minY, maxX, maxY } = bounds;
  return [
    { id: 'nw', x: minX, y: minY },
    { id: 'ne', x: maxX, y: minY },
    { id: 'se', x: maxX, y: maxY },
    { id: 'sw', x: minX, y: maxY },
    { id: 'rotate', x: (minX + maxX) / 2, y: minY - ROTATE_HANDLE_OFFSET / zoom },
  ];
}

/** Nächstgelegener Griff aus einer Liste, oder null. */
export function nearestHandle(handles: Handle[], p: Point, tolerance: number): Handle | null {
  let best: Handle | null = null;
  let bestDist = tolerance * tolerance;
  for (const h of handles) {
    const d = (h.x - p.x) ** 2 + (h.y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}

/** Griff unter dem Zeiger, oder null. `tolerance` in Weltpixeln. */
export function pickHandle(
  doc: MapDocument,
  obj: MapObject,
  p: Point,
  zoom: number,
  tolerance: number,
  metrics?: TextMetrics,
): Handle | null {
  return nearestHandle(objectHandles(doc, obj, zoom, metrics), p, tolerance);
}
