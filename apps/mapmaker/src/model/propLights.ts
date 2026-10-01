/**
 * Licht als Teil des Props.
 *
 * Wie beim Mauerwerk (`vttVisuals.ts`): das VTT-Licht einer Fackel ist reine
 * Folge des Props. Es entsteht, wandert und verschwindet mit ihm, auch beim
 * Rückgängig. Geändert wird es am Prop (`PropObject.light`), nicht am Licht.
 */

import type { DocChange } from './commands';
import type { LightSource, MapDocument, ObjectId, PropObject } from './types';

export function propLichtId(propId: ObjectId): string {
  return `lp-${propId}`;
}

function sollLicht(o: PropObject): LightSource | null {
  if (!o.light) return null;
  return {
    id: propLichtId(o.id),
    x: o.x,
    y: o.y,
    range: o.light.range,
    intensity: o.light.intensity,
    color: o.light.color,
    alpha: 1,
    shadows: true,
    propLink: o.id,
  };
}

function gleich(a: LightSource, b: LightSource): boolean {
  return (
    a.x === b.x && a.y === b.y && a.range === b.range && a.intensity === b.intensity &&
    a.color === b.color && a.alpha === b.alpha && a.shadows === b.shadows && a.propLink === b.propLink
  );
}

/**
 * Gleicht die Lichter an die Props an. Mit `ids` nur für diese Objekte (der
 * Normalfall: ein Befehl meldet, was er angefasst hat), sonst für alle.
 * Liefert, ob sich an den Lichtern etwas geändert hat.
 */
export function syncPropLights(doc: MapDocument, ids?: readonly ObjectId[]): boolean {
  const lichter = doc.vtt.lights;
  let geaendert = false;
  const pruefe = ids ? new Set(ids) : null;

  // Verwaiste oder überholte Lichter entfernen.
  for (let i = lichter.length - 1; i >= 0; i--) {
    const l = lichter[i];
    if (!l.propLink) continue;
    if (pruefe && !pruefe.has(l.propLink)) continue;
    const o = doc.objects[l.propLink];
    if (!o || o.kind !== 'prop' || !o.light) {
      lichter.splice(i, 1);
      geaendert = true;
    }
  }

  const kandidaten = ids ?? Object.keys(doc.objects);
  for (const id of kandidaten) {
    const o = doc.objects[id];
    if (!o || o.kind !== 'prop') continue;
    const soll = sollLicht(o);
    if (!soll) continue;
    const i = lichter.findIndex((l) => l.id === soll.id);
    if (i < 0) {
      lichter.push(soll);
      geaendert = true;
    } else if (!gleich(lichter[i], soll)) {
      lichter[i] = soll;
      geaendert = true;
    }
  }
  return geaendert;
}

/** Welche Objekte müssen nach diesen Änderungen geprüft werden? null heißt: alle. */
export function lichtKandidaten(changes: readonly DocChange[]): ObjectId[] | null | undefined {
  let ids: ObjectId[] | undefined;
  for (const c of changes) {
    if (c.type === 'all' || c.type === 'layers') return null;
    if (c.type === 'objects') (ids ??= []).push(...c.ids);
  }
  return ids;
}
