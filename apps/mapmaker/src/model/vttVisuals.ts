/**
 * Sichtbares Mauerwerk als Teil von Wand und Tür.
 *
 * Rückmeldung: VTT-Wand und Steinwand waren zwei Objekte, die sich
 * auseinanderziehen ließen. Jetzt trägt die Wand ihren Stil selbst
 * (`Wall.style`, `Wall.styleLayerId`), und die Zeichnung wird daraus
 * abgeleitet: nach jedem Befehl, jedem Rückgängig und Wiederholen und beim
 * Laden. Weil sie reine Folge der Wand ist, braucht sie keinen eigenen
 * Rückgängig-Schritt — geht die Wand zurück, geht das Mauerwerk mit.
 *
 * Die Zeichnung bleibt ein gewöhnliches Objekt auf einem Layer, damit
 * Bildexport, Filter und Reihenfolge ohne Sonderweg funktionieren. Einzeln
 * anfassen lässt sie sich nicht (`isObjectEditable`).
 */

import { buildWallShape, getWallStyle, WALL_STYLES, type WallStyleId } from '@/assets/wallStyles';
import { isSystemLayer } from './types';
import type { DocChange } from './commands';
import type { LayerId, MapDocument, ObjectId, ShapeObject } from './types';

/** Feste Kennung der Zeichnung zu einer Wand oder Tür. */
export function visualId(itemId: string): ObjectId {
  return `vis-${itemId}`;
}

interface Soll {
  kind: 'walls' | 'portals';
  itemId: string;
  points: number[];
  closed: boolean;
  style: WallStyleId;
  layerId: LayerId;
}

function darfTragen(doc: MapDocument, layerId: LayerId): boolean {
  const l = doc.layers[layerId];
  return !!l && !l.isGroup && !isSystemLayer(layerId) && l.kind !== 'height';
}

/** Brauchen diese Änderungen einen Abgleich? Pinselstriche sollen ihn nicht bezahlen. */
export function braucheAbgleich(changes: readonly DocChange[]): boolean {
  return changes.some((c) => c.type === 'vtt' || c.type === 'layers' || c.type === 'grid' || c.type === 'all');
}

/**
 * Bringt die Zeichnungen auf den Stand der Wände. Liefert die geänderten
 * Objektkennungen (leer, wenn alles stimmte).
 */
export function syncVttVisuals(doc: MapDocument): ObjectId[] {
  const soll = new Map<ObjectId, Soll>();
  for (const w of doc.vtt.walls) {
    if (!w.style || !w.styleLayerId || !getWallStyle(w.style as WallStyleId)) continue;
    soll.set(visualId(w.id), { kind: 'walls', itemId: w.id, points: w.points, closed: w.closed, style: w.style as WallStyleId, layerId: w.styleLayerId });
  }
  for (const p of doc.vtt.portals) {
    if (!p.style || !p.styleLayerId || !getWallStyle(p.style as WallStyleId)) continue;
    soll.set(visualId(p.id), { kind: 'portals', itemId: p.id, points: [...p.bounds], closed: false, style: p.style as WallStyleId, layerId: p.styleLayerId });
  }

  const geaendert: ObjectId[] = [];
  for (const id in doc.objects) {
    const o = doc.objects[id];
    if (o.kind === 'shape' && o.vttLink && !soll.has(id)) {
      delete doc.objects[id];
      geaendert.push(id);
    }
  }

  for (const [id, s] of soll) {
    const alt = doc.objects[id];
    const gebaut = darfTragen(doc, s.layerId) ? buildWallShape(doc, s.layerId, s.style, s.points, s.closed) : null;
    if (!gebaut) {
      if (alt) {
        delete doc.objects[id];
        geaendert.push(id);
      }
      continue;
    }
    const neu: ShapeObject = {
      ...gebaut,
      id,
      vttLink: { kind: s.kind, id: s.itemId },
      // Stelle im Stapel behalten, sonst springt die Wand bei jeder Änderung nach vorn.
      z: alt && alt.layerId === s.layerId ? alt.z : gebaut.z,
    };
    if (!alt || JSON.stringify(alt) !== JSON.stringify(neu)) {
      doc.objects[id] = neu;
      geaendert.push(id);
    }
  }
  return geaendert;
}

/**
 * Ältere Karten: Mauerwerk lag als lose Zeichnung neben der Wand. Passt eine
 * Zeichnung Punkt für Punkt auf eine Wand oder Tür und trägt sie die Farbe
 * eines Wandstils, wird sie zum Stil der Wand. Was nicht eindeutig passt,
 * bleibt, wie es ist.
 */
export function verknuepfeAltesMauerwerk(doc: MapDocument): number {
  const nachFarbe = new Map(WALL_STYLES.map((st) => [st.color, st.id]));
  const schluessel = (pts: readonly number[]) => pts.map((v) => Math.round(v)).join(',');
  const waende = new Map<string, { kind: 'walls' | 'portals'; id: string }>();
  for (const w of doc.vtt.walls) if (!w.style) waende.set(schluessel(w.points), { kind: 'walls', id: w.id });
  for (const p of doc.vtt.portals) if (!p.style) waende.set(schluessel(p.bounds), { kind: 'portals', id: p.id });

  let anzahl = 0;
  for (const id of Object.keys(doc.objects)) {
    const o = doc.objects[id];
    if (o.kind !== 'shape' || o.vttLink || o.shape !== 'polygon' || !o.stroke || o.fill || o.rotation !== 0) continue;
    const stil = nachFarbe.get(o.stroke.color);
    if (!stil) continue;
    const welt: number[] = [];
    for (let i = 0; i < o.points.length; i += 2) welt.push(o.points[i] + o.x, o.points[i + 1] + o.y);
    const ziel = waende.get(schluessel(welt));
    if (!ziel) continue;
    if (ziel.kind === 'walls') {
      const w = doc.vtt.walls.find((x) => x.id === ziel.id)!;
      w.style = stil;
      w.styleLayerId = o.layerId;
    } else {
      const p = doc.vtt.portals.find((x) => x.id === ziel.id)!;
      p.style = stil;
      p.styleLayerId = o.layerId;
    }
    waende.delete(schluessel(welt));
    delete doc.objects[id];
    anzahl++;
  }
  return anzahl;
}
