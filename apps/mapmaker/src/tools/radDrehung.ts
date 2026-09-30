/**
 * Drehen der Auswahl mit dem Mausrad (Rückmeldung).
 *
 * Shift+Rad dreht in Rastschritten (Dreh-Fang aus den Rastereinstellungen,
 * ohne den 15°), Strg+Shift+Rad fein in 1°-Schritten. Strg allein bleibt beim
 * Zoomen: Touchpads schicken ihre Zwei-Finger-Geste als Rad mit Strg.
 */

import { PatchObjects } from '@/model/commands';
import { isObjectEditable } from '@/model/document';
import { rotateAroundCenterPatch, rotateGroupPatch } from '@/model/groupTransform';
import type { MapDocument, ObjectId } from '@/model/types';
import { localCenterOffset, objectCenter, selectionBounds, type TextMetrics } from '@/engine/hitTest';
import { t } from '@/i18n';

/** Winkelschritt in Grad für einen Radschritt. */
export function radSchritt(doc: MapDocument, fein: boolean): number {
  if (fein) return 1;
  return doc.grid.rotationSnapDeg > 0 ? doc.grid.rotationSnapDeg : 15;
}

/**
 * Befehl, der die Auswahl um `grad` dreht; null, wenn nichts drehbar ist.
 * Mehrere Radschritte kurz hintereinander werden ein Rückgängig-Schritt.
 */
export function radDrehBefehl(
  doc: MapDocument,
  ids: readonly ObjectId[],
  grad: number,
  metrics?: TextMetrics,
): PatchObjects | null {
  const objekte = ids.filter((id) => isObjectEditable(doc, id)).map((id) => doc.objects[id]);
  if (objekte.length === 0) return null;
  const delta = (grad * Math.PI) / 180;

  if (objekte.length === 1) {
    const o = objekte[0];
    const patch = rotateAroundCenterPatch(localCenterOffset(o), objectCenter(doc, o), o.rotation + delta);
    return new PatchObjects(new Map([[o.id, patch]]), t('sel.rotation'), 'rad-drehung');
  }
  const b = selectionBounds(doc, objekte.map((o) => o.id), metrics);
  if (!b) return null;
  const mitte = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  return new PatchObjects(rotateGroupPatch(objekte, mitte, delta), t('sel.rotation'), 'rad-drehung');
}
