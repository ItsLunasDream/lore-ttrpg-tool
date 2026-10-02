/**
 * Erzeugung und Abfrage von Dokumenten.
 *
 * Alle Funktionen hier sind entweder rein (Abfragen) oder mutieren das Dokument
 * direkt (Helfer, die ausschließlich von Commands aufgerufen werden). Der
 * Renderer ruft nur die Abfragen.
 */

import { makeId } from './ids';
import { t } from '@/i18n';
import { strings } from '@/i18n/strings';
import { defaultGrid, mapPixelSize } from './grid';
import {
  SCHEMA_VERSION,
  SYSTEM_GRID,
  SYSTEM_VTT,
  isSystemLayer,
  SEA_LEVEL,
  type HeightMap,
  type Layer,
  type LayerId,
  type MapDocument,
  type MapObject,
  type ObjectId,
} from './types';

// ---------------------------------------------------------------------------
// Erzeugung
// ---------------------------------------------------------------------------

export function makeLayer(name: string, patch: Partial<Layer> = {}): Layer {
  return {
    id: patch.id ?? makeId('lyr'),
    name,
    isGroup: false,
    parentId: null,
    children: [],
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    includeInExport: true,
    ...patch,
  };
}

/** Die Schluessel der Namen, die ein neues Dokument von sich aus bekommt. */
const STANDARDNAMEN = ['layer.floor', 'layer.drawing', 'layer.objects', 'layer.labels', 'layer.grid', 'layer.vtt'] as const;

/**
 * Die Standardnamen in die aktuelle Sprache ziehen.
 *
 * Namen sind Daten und bleiben, was sie beim Anlegen waren — aber nur, wenn
 * jemand sie gewaehlt hat. Das erste Dokument entsteht beim Laden, bevor die
 * Huelle die Sprache sagt, und hiess auf Deutsch „Untitled map" mit
 * englischen Ebenen (Testbericht). Umbenannt wird deshalb nur, was noch
 * genau einem Standardnamen in irgendeiner Sprache entspricht.
 */
export function uebersetzeStandardnamen(doc: MapDocument): MapDocument {
  const zuordnung = new Map<string, string>();
  for (const key of [...STANDARDNAMEN, 'map.untitled'] as const) {
    for (const fassung of strings[key]) zuordnung.set(fassung, t(key));
  }
  let geaendert = false;
  const layers: Record<LayerId, Layer> = {};
  for (const [id, layer] of Object.entries(doc.layers)) {
    const neu = zuordnung.get(layer.name);
    if (neu && neu !== layer.name) {
      layers[id] = { ...layer, name: neu };
      geaendert = true;
    } else layers[id] = layer;
  }
  const name = zuordnung.get(doc.meta.name) ?? doc.meta.name;
  if (name !== doc.meta.name) geaendert = true;
  return geaendert ? { ...doc, layers, meta: { ...doc.meta, name } } : doc;
}

/**
 * Neues Dokument mit dem Standard-Layerset. Die Systemebenen liegen im selben
 * Stapel wie die Benutzerebenen und sind darum frei verschiebbar: Grid über den
 * Objekten, der VTT-Layer ganz oben.
 */
export function createDocument(cols = 30, rows = 20, name?: string): MapDocument {
  const now = new Date().toISOString();

  // Layernamen sind Daten, keine Oberfläche: sie werden mitgespeichert und
  // bleiben, was sie beim Anlegen waren, auch wenn später die Sprache wechselt.
  const floor = makeLayer(t('layer.floor'));
  const drawing = makeLayer(t('layer.drawing'));
  const objects = makeLayer(t('layer.objects'));
  const labels = makeLayer(t('layer.labels'));

  const grid = makeLayer(t('layer.grid'), { id: SYSTEM_GRID });
  const vtt = makeLayer(t('layer.vtt'), { id: SYSTEM_VTT, includeInExport: false });

  const layers: Record<LayerId, Layer> = {};
  for (const l of [floor, drawing, objects, labels, grid, vtt]) layers[l.id] = l;

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { name: name ?? t('map.untitled'), created: now, modified: now, id: makeId('karte') },
    size: { cols, rows },
    grid: defaultGrid(),
    // Warmer Steinton: hell genug, dass ein schwarzes Grid und dunkle Props
    // darauf lesbar sind, und deutlich vom Bereich außerhalb der Karte abgesetzt.
    background: 0x37332e,
    layers,
    rootLayers: [floor.id, drawing.id, objects.id, labels.id, grid.id, vtt.id],
    objects: {},
    vtt: {
      walls: [],
      portals: [],
      lights: [],
      notes: [],
      ambientLight: 0xffffff,
      ambientAlpha: 1,
      bakedLighting: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Layer-Abfragen
// ---------------------------------------------------------------------------

/** Geschwister-Liste, in der ein Layer steckt (Wurzel oder Gruppenkinder). */
export function siblingsOf(doc: MapDocument, id: LayerId): LayerId[] {
  const layer = doc.layers[id];
  if (!layer) return doc.rootLayers;
  return layer.parentId ? doc.layers[layer.parentId].children : doc.rootLayers;
}

/** Alle Vorfahren eines Layers, vom direkten Elternteil aufwärts. */
export function ancestorsOf(doc: MapDocument, id: LayerId): Layer[] {
  const out: Layer[] = [];
  let cur = doc.layers[id]?.parentId;
  while (cur) {
    const l = doc.layers[cur];
    if (!l) break;
    out.push(l);
    cur = l.parentId;
  }
  return out;
}

/** Ist der Layer wirklich sichtbar, also er selbst und alle Gruppen darüber? */
export function isEffectivelyVisible(doc: MapDocument, id: LayerId): boolean {
  const layer = doc.layers[id];
  if (!layer || !layer.visible) return false;
  return ancestorsOf(doc, id).every((a) => a.visible);
}

/** Deckkraft inklusive aller Gruppen darüber. */
export function effectiveOpacity(doc: MapDocument, id: LayerId): number {
  const layer = doc.layers[id];
  if (!layer) return 0;
  return ancestorsOf(doc, id).reduce((acc, a) => acc * a.opacity, layer.opacity);
}

/** Gesperrt, wenn er selbst oder eine Gruppe darüber gesperrt ist. */
export function isEffectivelyLocked(doc: MapDocument, id: LayerId): boolean {
  const layer = doc.layers[id];
  if (!layer) return true;
  if (layer.locked) return true;
  return ancestorsOf(doc, id).some((a) => a.locked);
}

/**
 * Layer-Stapel von unten nach oben aufgelöst, Gruppen aufgeklappt.
 * Das ist die Reihenfolge, in der gerendert und exportiert wird.
 */
export function flattenLayers(doc: MapDocument): Layer[] {
  const out: Layer[] = [];
  const walk = (ids: LayerId[]) => {
    for (const id of ids) {
      const l = doc.layers[id];
      if (!l) continue;
      out.push(l);
      if (l.isGroup) walk(l.children);
    }
  };
  walk(doc.rootLayers);
  return out;
}

/** Alle Layer-Ids inklusive Nachfahren — für rekursives Löschen. */
export function layerSubtree(doc: MapDocument, id: LayerId): LayerId[] {
  const out: LayerId[] = [];
  const walk = (cur: LayerId) => {
    const l = doc.layers[cur];
    if (!l) return;
    out.push(cur);
    if (l.isGroup) l.children.forEach(walk);
  };
  walk(id);
  return out;
}

/** Würde das Einhängen von `id` unter `target` einen Zyklus erzeugen? */
export function wouldCycle(doc: MapDocument, id: LayerId, target: LayerId | null): boolean {
  if (!target) return false;
  if (id === target) return true;
  return ancestorsOf(doc, target).some((a) => a.id === id);
}

/** Der oberste nicht gesperrte, sichtbare Objekt-Layer — Fallback für neue Objekte. */
export function defaultTargetLayer(doc: MapDocument): LayerId | null {
  const flat = flattenLayers(doc);
  for (let i = flat.length - 1; i >= 0; i--) {
    const l = flat[i];
    if (l.isGroup || isSystemLayer(l.id)) continue;
    if (isEffectivelyLocked(doc, l.id)) continue;
    return l.id;
  }
  return null;
}

/**
 * Darf dieser Layer neue Objekte aufnehmen?
 *
 * Gruppen und Systemebenen können es nicht, Höhenebenen tragen Zahlen statt
 * Objekte — und **ein gesperrter Layer darf es nicht**. Das Sperren fehlte hier
 * lange, während `defaultTargetLayer` und `isObjectEditable` es längst
 * beachteten: man konnte in einen gesperrten Layer malen und die Objekte
 * danach nicht mehr anfassen, weil derselbe Layer sie schützte. Übrig blieb
 * Unrat, der sich nur nach dem Entsperren wieder entfernen ließ.
 */
export function canHoldObjects(doc: MapDocument, id: LayerId): boolean {
  const l = doc.layers[id];
  if (!l || l.isGroup || isSystemLayer(id) || l.kind === 'height') return false;
  return !isEffectivelyLocked(doc, id);
}

/** Ist das eine Rasterebene mit Höhenfeld? */
export function isHeightLayer(doc: MapDocument, id: LayerId): boolean {
  return doc.layers[id]?.kind === 'height';
}

/** Höhenfeld eines Layers, oder null. */
export function heightMapOf(doc: MapDocument, id: LayerId): HeightMap | null {
  return doc.heightMaps?.[id] ?? null;
}

/**
 * Leeres Höhenfeld in Kartengröße.
 *
 * Der Startwert liegt knapp unter der Meereshöhe: eine frische Rasterebene ist
 * damit offenes Meer, und Land entsteht durch Anheben. Andersherum — alles
 * Land, Meer durch Absenken — wäre für eine Weltkarte der seltenere Fall.
 */
export function makeHeightMap(
  tileCols: number,
  tileRows: number,
  samplesPerTile = 2,
  start = SEA_LEVEL - 0.08,
): HeightMap {
  const cols = Math.max(1, Math.round(tileCols * samplesPerTile));
  const rows = Math.max(1, Math.round(tileRows * samplesPerTile));
  return { cols, rows, samplesPerTile, data: new Array<number>(cols * rows).fill(start) };
}

// ---------------------------------------------------------------------------
// Objekt-Abfragen
// ---------------------------------------------------------------------------

export function objectsOfLayer(doc: MapDocument, layerId: LayerId): MapObject[] {
  const out: MapObject[] = [];
  for (const id in doc.objects) {
    const o = doc.objects[id];
    if (o.layerId === layerId) out.push(o);
  }
  out.sort((a, b) => a.z - b.z);
  return out;
}

/** Nächster freier z-Wert in einem Layer. */
export function nextZ(doc: MapDocument, layerId: LayerId): number {
  let max = 0;
  for (const id in doc.objects) {
    const o = doc.objects[id];
    if (o.layerId === layerId && o.z > max) max = o.z;
  }
  return max + 1;
}

/** Kann das Objekt angefasst werden — weder selbst noch sein Layer gesperrt? */
export function isObjectEditable(doc: MapDocument, id: ObjectId): boolean {
  const o = doc.objects[id];
  if (!o || o.locked) return false;
  // Mauerwerk einer Wand wird über die Wand bearbeitet, nicht einzeln.
  if (o.kind === 'shape' && o.vttLink) return false;
  return !isEffectivelyLocked(doc, o.layerId) && isEffectivelyVisible(doc, o.layerId);
}

export function documentPixelSize(doc: MapDocument): { width: number; height: number } {
  return mapPixelSize(doc.grid, doc.size);
}

export function touchModified(doc: MapDocument): void {
  doc.meta.modified = new Date().toISOString();
}

/**
 * Alle Objekte derselben Gruppe.
 *
 * Ohne Gruppe kommt nur das Objekt selbst zurück — so lässt sich der Aufruf
 * bedingungslos einsetzen, ohne vorher zu prüfen.
 */
export function groupMembers(doc: MapDocument, id: ObjectId): ObjectId[] {
  const obj = doc.objects[id];
  if (!obj) return [];
  if (!obj.groupId) return [id];
  const out: ObjectId[] = [];
  for (const other in doc.objects) {
    if (doc.objects[other].groupId === obj.groupId) out.push(other);
  }
  return out;
}

/**
 * Auswahl um die jeweiligen Gruppenmitglieder erweitern.
 *
 * Wer ein Objekt einer Gruppe anklickt, meint die ganze Gruppe — genau dafür
 * gibt es sie.
 */
export function expandToGroups(doc: MapDocument, ids: ObjectId[]): ObjectId[] {
  const out = new Set<ObjectId>();
  for (const id of ids) {
    for (const m of groupMembers(doc, id)) out.add(m);
  }
  return [...out];
}

/**
 * Ob auf dieser Karte schon etwas steht.
 *
 * Gebraucht vor allem beim Ueberschreiben: „Neu" fragte bisher nur nach,
 * wenn Objekte da waren. Wer nur eine Notiz gesetzt hatte — oder eine Wand,
 * ein Licht, eine Hilfslinie —, verlor sie wortlos. Das ist genau die Art
 * Verlust, die niemand bemerkt, bis er sie sucht.
 *
 * Der Kartenname zaehlt bewusst nicht mit: eine frisch benannte, sonst leere
 * Karte ist nichts, wofuer man nachfragen muesste.
 */
export function hatInhalt(doc: MapDocument): boolean {
  return (
    Object.keys(doc.objects).length > 0 ||
    doc.vtt.walls.length > 0 ||
    doc.vtt.portals.length > 0 ||
    doc.vtt.lights.length > 0 ||
    doc.vtt.notes.length > 0 ||
    (doc.guides?.length ?? 0) > 0 ||
    // Ein Hoehenfeld zaehlt erst, wenn darin wirklich gemalt wurde: beim
    // Anlegen einer Rasterebene entsteht es flach und voller Nullen.
    Object.values(doc.heightMaps ?? {}).some((feld) =>
      (feld?.data ?? []).some((wert) => wert !== SEA_LEVEL && wert !== 0)
    )
  );
}
