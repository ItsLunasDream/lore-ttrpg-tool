/**
 * Trefferprüfung auf der VTT-Ebene.
 *
 * Getrennt von hitTest.ts, weil Wände, Türen und Lichter keine Objekte im
 * Layer-Sinn sind: sie liegen nicht in Layern, haben keine z-Reihenfolge und
 * werden nie exportiert.
 */

import {
  boundsOf,
  pointSegmentDistanceSq,
  segmentIntersectsRect,
  type Rect,
} from '@/model/geometry';
import { abstandZurNotiz, notenForm } from '@/model/noteShape';
import type { LightSource, MapDocument, MapNote, Portal, Wall } from '@/model/types';
import type { SelectFilter } from '@/model/toolSettings';
import type { Point } from '@/model/grid';

/** Verweis auf ein VTT-Element. Die Arrays im Dokument sind je Art getrennt. */
export type VttRef =
  | { kind: 'walls'; id: string }
  | { kind: 'portals'; id: string }
  | { kind: 'lights'; id: string }
  | { kind: 'notes'; id: string };

export interface WallHit {
  wall: Wall;
  /** Index des getroffenen Segments (Punkt i und i+1). */
  segment: number;
  /** Lotfußpunkt auf dem Segment. */
  x: number;
  y: number;
  /** Richtung des Segments im Bogenmaß. */
  angle: number;
  distance: number;
}

/** Lotfußpunkt und Parameter t auf einer Strecke. */
function project(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: ax + t * dx, y: ay + t * dy, t };
}

/** Nächstgelegene Wand innerhalb der Toleranz. */
export function pickWall(doc: MapDocument, p: Point, tolerance: number): WallHit | null {
  let best: WallHit | null = null;
  let bestDistSq = tolerance * tolerance;

  for (const wall of doc.vtt.walls) {
    const pts = wall.points;
    const segments = wall.closed ? pts.length / 2 : pts.length / 2 - 1;
    for (let i = 0; i < segments; i++) {
      const j = ((i + 1) * 2) % pts.length;
      const ax = pts[i * 2];
      const ay = pts[i * 2 + 1];
      const bx = pts[j];
      const by = pts[j + 1];
      const d = pointSegmentDistanceSq(p.x, p.y, ax, ay, bx, by);
      if (d < bestDistSq) {
        bestDistSq = d;
        const proj = project(p.x, p.y, ax, ay, bx, by);
        best = {
          wall,
          segment: i,
          x: proj.x,
          y: proj.y,
          angle: Math.atan2(by - ay, bx - ax),
          distance: Math.sqrt(d),
        };
      }
    }
  }
  return best;
}

export function pickPortal(doc: MapDocument, p: Point, tolerance: number): Portal | null {
  let best: Portal | null = null;
  let bestDistSq = tolerance * tolerance;
  for (const portal of doc.vtt.portals) {
    const [x0, y0, x1, y1] = portal.bounds;
    const d = pointSegmentDistanceSq(p.x, p.y, x0, y0, x1, y1);
    if (d < bestDistSq) {
      bestDistSq = d;
      best = portal;
    }
  }
  return best;
}

/** Licht am nächsten zum Punkt — getroffen wird der Mittelpunkt, nicht der Radius. */
export function pickLight(doc: MapDocument, p: Point, tolerance: number): LightSource | null {
  let best: LightSource | null = null;
  let bestDistSq = tolerance * tolerance;
  for (const light of doc.vtt.lights) {
    // Licht eines Props wird am Prop bearbeitet (model/propLights.ts).
    if (light.propLink) continue;
    const d = (light.x - p.x) ** 2 + (light.y - p.y) ** 2;
    if (d < bestDistSq) {
      bestDistSq = d;
      best = light;
    }
  }
  return best;
}

/**
 * Notiz am nächsten zum Punkt.
 *
 * Getroffen wird der ganze Pin, Kopf und Stiel, plus der Toleranzsaum außen
 * herum. Früher zählte allein der Abstand zu `x`/`y` — und das ist die
 * Spitze, nicht der Kopf. Bei der Vorgabegröße liegt die Kopfmitte rund
 * vierzig Einheiten über der Spitze, die Toleranz war sechzehn: der sichtbare
 * Teil des Pins war damit unanklickbar, und das Notiz-Werkzeug legte bei
 * jedem Versuch eine neue Notiz an, statt die vorhandene zu öffnen.
 */
export function pickNote(doc: MapDocument, p: Point, tolerance: number): MapNote | null {
  let best: MapNote | null = null;
  let bestAbstand = tolerance;
  for (const note of doc.vtt.notes) {
    const abstand = abstandZurNotiz(notenForm(note, doc.grid.tileSize), p.x, p.y);
    // `<=`, damit ein Klick mitten in den Kopf (Abstand 0) auch dann zählt,
    // wenn die Toleranz 0 wäre.
    if (abstand <= bestAbstand) {
      bestAbstand = abstand;
      best = note;
    }
  }
  return best;
}

/** Darf diese Wand angefasst werden? Fenster stehen im Filter eigens. */
function wallAllowed(wall: Wall, filter: SelectFilter): boolean {
  return wall.type === 'window' ? filter.windows : filter.walls;
}

/**
 * Nächstgelegenes VTT-Element am Punkt, über alle Arten hinweg.
 *
 * Lichter werden bevorzugt, wenn sie in Reichweite liegen: sie sind Punkte,
 * Wände dagegen lange Strecken, die sonst fast immer zuerst treffen — ein
 * Licht direkt auf einer Wand wäre nie anzuklicken.
 */
export function pickVtt(
  doc: MapDocument,
  p: Point,
  tolerance: number,
  filter: SelectFilter,
): VttRef | null {
  if (filter.notes) {
    const note = pickNote(doc, p, tolerance);
    if (note) return { kind: 'notes', id: note.id };
  }
  if (filter.lights) {
    const light = pickLight(doc, p, tolerance);
    if (light) return { kind: 'lights', id: light.id };
  }
  if (filter.doors) {
    const portal = pickPortal(doc, p, tolerance);
    if (portal) return { kind: 'portals', id: portal.id };
  }
  if (filter.walls || filter.windows) {
    const hit = pickWall(doc, p, tolerance);
    if (hit && wallAllowed(hit.wall, filter)) return { kind: 'walls', id: hit.wall.id };
  }
  return null;
}

/** Hülle eines VTT-Elements. Lichter bekommen einen Griff von Handbreite. */
export function vttItemBounds(
  doc: MapDocument,
  ref: VttRef,
  lightHandle = 8,
): Rect | null {
  if (ref.kind === 'walls') {
    const wall = doc.vtt.walls.find((w) => w.id === ref.id);
    return wall ? boundsOf(wall.points) : null;
  }
  if (ref.kind === 'portals') {
    const portal = doc.vtt.portals.find((x) => x.id === ref.id);
    return portal ? boundsOf(portal.bounds) : null;
  }
  if (ref.kind === 'notes') {
    const note = doc.vtt.notes.find((n) => n.id === ref.id);
    if (!note) return null;
    // Die Hülle des Tropfens, nicht ein Quadrat um die Spitze: sonst säße der
    // Auswahlrahmen neben dem Pin, den er meint.
    const form = notenForm(note, doc.grid.tileSize);
    return {
      minX: form.kopfX - form.r,
      minY: form.kopfY - form.r,
      maxX: form.kopfX + form.r,
      maxY: form.spitzeY,
    };
  }
  const light = doc.vtt.lights.find((l) => l.id === ref.id);
  if (!light) return null;
  return {
    minX: light.x - lightHandle,
    minY: light.y - lightHandle,
    maxX: light.x + lightHandle,
    maxY: light.y + lightHandle,
  };
}

/**
 * VTT-Elemente im Auswahlrechteck.
 *
 * Wände und Türen zählen, sobald eines ihrer Segmente das Rechteck schneidet —
 * die bloße Hülle zu prüfen griffe bei langen schrägen Zügen viel zu weit.
 */
export function pickVttInRect(
  doc: MapDocument,
  rect: Rect,
  filter: SelectFilter,
): VttRef[] {
  const out: VttRef[] = [];

  if (filter.walls || filter.windows) {
    for (const wall of doc.vtt.walls) {
      if (!wallAllowed(wall, filter)) continue;
      const pts = wall.points;
      const segments = wall.closed ? pts.length / 2 : pts.length / 2 - 1;
      for (let i = 0; i < segments; i++) {
        const j = ((i + 1) * 2) % pts.length;
        if (segmentIntersectsRect(pts[i * 2], pts[i * 2 + 1], pts[j], pts[j + 1], rect)) {
          out.push({ kind: 'walls', id: wall.id });
          break;
        }
      }
    }
  }

  if (filter.doors) {
    for (const portal of doc.vtt.portals) {
      const [x0, y0, x1, y1] = portal.bounds;
      if (segmentIntersectsRect(x0, y0, x1, y1, rect)) {
        out.push({ kind: 'portals', id: portal.id });
      }
    }
  }

  if (filter.notes) {
    for (const note of doc.vtt.notes) {
      if (
        note.x >= rect.minX &&
        note.x <= rect.maxX &&
        note.y >= rect.minY &&
        note.y <= rect.maxY
      ) {
        out.push({ kind: 'notes', id: note.id });
      }
    }
  }

  if (filter.lights) {
    for (const light of doc.vtt.lights) {
      if (light.propLink) continue;
      if (
        light.x >= rect.minX &&
        light.x <= rect.maxX &&
        light.y >= rect.minY &&
        light.y <= rect.maxY
      ) {
        out.push({ kind: 'lights', id: light.id });
      }
    }
  }

  return out;
}

/**
 * Fängt an vorhandenen Wand-Stützpunkten.
 *
 * Ohne das entstehen an Ecken haarfeine Lücken, durch die in Foundry Sicht
 * hindurchleckt — im Editor sieht man davon nichts.
 */
export function snapToWallVertex(doc: MapDocument, p: Point, tolerance: number): Point | null {
  let best: Point | null = null;
  let bestDistSq = tolerance * tolerance;
  for (const wall of doc.vtt.walls) {
    for (let i = 0; i < wall.points.length; i += 2) {
      const d = (wall.points[i] - p.x) ** 2 + (wall.points[i + 1] - p.y) ** 2;
      if (d < bestDistSq) {
        bestDistSq = d;
        best = { x: wall.points[i], y: wall.points[i + 1] };
      }
    }
  }
  return best;
}
