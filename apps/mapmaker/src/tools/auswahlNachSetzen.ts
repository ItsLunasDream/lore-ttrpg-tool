/**
 * Gemeinsames der Setz-Werkzeuge (Wand, Raum, Tür, Fenster, Licht, Notiz).
 *
 * Rückmeldung: Wer einen Raum setzt und dann rechts den Wandtyp ändert, sah
 * keine Wirkung — die Einstellung galt erst für den nächsten. Darum ist das
 * eben Gesetzte danach ausgewählt, und die Panels wirken auf die Auswahl
 * (siehe „Einstellungen wirken auf die Auswahl" in CLAUDE.md).
 */

import { canHoldObjects } from '@/model/document';
import { emptyVttSelection, type VttKind } from '@/model/store';
import type { LayerId, ObjectId } from '@/model/types';
import type { WallStyleId } from '@/assets/wallStyles';
import type { ToolContext } from './types';
import { t } from '@/i18n';

/** Stil-Felder für eine neue Wand oder Tür; leer, wenn kein Mauerwerk entstehen kann. */
export function stilFuer(ctx: ToolContext, style: WallStyleId): { style?: string; styleLayerId?: LayerId } {
  if (style === 'none') return {};
  const layerId = ctx.state.activeLayerId;
  if (!canHoldObjects(ctx.doc, layerId)) {
    // Nicht wortlos fallenlassen: wer einen Stil gewählt hat und nichts sieht, sucht den Fehler bei sich.
    ctx.state.setStatusMessage(t('wallStyle.layerCannotHold'));
    return {};
  }
  return { style, styleLayerId: layerId };
}

/** Wählt das eben Gesetzte aus, VTT-Teile und Objekte zusammen. */
export function waehleGesetztes(
  ctx: ToolContext,
  vtt: Partial<Record<VttKind, string[]>>,
  objekte: ObjectId[] = [],
): void {
  ctx.state.setSelection(objekte);
  ctx.state.setVttSelection({ ...emptyVttSelection(), ...vtt });
}
