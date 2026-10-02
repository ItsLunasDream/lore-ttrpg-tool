/**
 * Mehrere Karten in einer Projektdatei — die Etagen eines Verlieses, ein Ort
 * und sein Keller (BACKLOG „Mehrere Karten in einer Datei").
 *
 * Eine Mappe ist schlicht die Liste der Karten einer Datei. Jede Karte bleibt
 * ein vollständiges `MapDocument`; Werkzeuge, Renderer und Exporte sehen immer
 * nur die gerade offene und wissen von den anderen nichts. Verbunden sind die
 * Karten über Notizen: `MapNote.zielKarte` nennt die Kennung (`meta.id`) einer
 * anderen Karte.
 *
 * Rein und ohne Oberfläche.
 */

import { createDocument } from './document';
import { makeId } from './ids';
import type { MapDocument } from './types';

/** Höchstens so viele Karten je Datei — eine Grenze gegen Versehen, keine Regel. */
export const MAX_KARTEN = 32;

/** Gibt der Karte eine Kennung, falls sie noch keine hat (ältere Dateien). */
export function mitKartenId(doc: MapDocument): MapDocument {
  if (!doc.meta.id) doc.meta.id = makeId('karte');
  return doc;
}

/**
 * Kennungen eindeutig machen. Eine Karte, die als Kopie einer anderen
 * entstand (oder zweimal in eine Datei geriet), hätte sonst dieselbe, und ein
 * Verweis spränge auf die falsche.
 */
export function eindeutigeIds(karten: readonly MapDocument[]): void {
  const gesehen = new Set<string>();
  for (const k of karten) {
    mitKartenId(k);
    if (gesehen.has(k.meta.id!)) k.meta.id = makeId('karte');
    gesehen.add(k.meta.id!);
  }
}

/**
 * Eine neue, leere Karte für dieselbe Datei: gleiche Größe und gleiches
 * Raster wie die Vorlage, denn Etagen liegen übereinander.
 */
export function neueKarteWie(vorlage: MapDocument, name: string): MapDocument {
  const doc = createDocument(vorlage.size.cols, vorlage.size.rows, name);
  doc.grid = { ...vorlage.grid };
  return doc;
}

/** Ein freier Name: „Etage 2", „Etage 3" … ohne einen vorhandenen zu doppeln. */
export function freierKartenName(karten: readonly MapDocument[], stamm: string): string {
  const namen = new Set(karten.map((k) => k.meta.name.trim().toLowerCase()));
  for (let n = karten.length + 1; ; n += 1) {
    const kandidat = `${stamm} ${n}`;
    if (!namen.has(kandidat.toLowerCase())) return kandidat;
  }
}

/**
 * Verweise auf eine Karte, die es nicht mehr gibt, entfernen. Gibt zurück,
 * wie viele Notizen betroffen waren; bewusst kein Rückgängig-Schritt, denn
 * das Entfernen der Karte selbst ist auch keiner.
 */
export function entferneVerweiseAuf(karten: readonly MapDocument[], id: string): number {
  let n = 0;
  for (const k of karten) {
    for (const note of k.vtt.notes) {
      if (note.zielKarte === id) {
        delete note.zielKarte;
        n += 1;
      }
    }
  }
  return n;
}

/** Die Stelle einer Karte in der Mappe, oder -1. */
export function stelleVon(karten: readonly MapDocument[], id: string | undefined): number {
  return id ? karten.findIndex((k) => k.meta.id === id) : -1;
}
