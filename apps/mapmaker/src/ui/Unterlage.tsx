/**
 * Die Karten unter der offenen im Editor zeigen (`model/mappe.ts`): durch den
 * durchsichtigen Boden des 1. Stocks sieht man den Hof im Erdgeschoss.
 *
 * Der Renderer spiegelt nur die offene Karte; die darunter kommen als Bilder
 * herein (`renderFremdeKarte`). Die Bilder werden je Karte gemerkt und erst
 * neu gerendert, wenn man die Karte verlassen hat — nur dort kann sie sich
 * geändert haben.
 */

import { useEffect, useRef } from 'react';
import { getRenderer } from '@/engine/instance';
import { renderFremdeKarte } from '@/io/exportImage';
import { mapPixelSize } from '@/model/grid';
import { kartenDarunter } from '@/model/mappe';
import { useEditor } from '@/model/store';
import type { MapDocument } from '@/model/types';

interface Bild {
  canvas: HTMLCanvasElement;
  breite: number;
  hoehe: number;
}

const bilder = new WeakMap<MapDocument, Bild>();

/** Längste Bildkante der Unterlage: genug zum Erkennen, klein genug für eine Textur. */
const KANTE = 4096;

function bildVon(doc: MapDocument, offen: MapDocument): Bild | null {
  const gemerkt = bilder.get(doc);
  if (gemerkt) return gemerkt;
  const renderer = getRenderer();
  if (!renderer) return null;
  const pixelsPerTile = Math.max(4, Math.min(doc.grid.tileSize, Math.floor(KANTE / Math.max(doc.size.cols, doc.size.rows, 1))));
  const canvas = renderFremdeKarte(renderer, doc, offen, {
    pixelsPerTile,
    format: 'png',
    quality: 1,
    includeGrid: false,
    includeBackground: true,
  });
  const { width, height } = mapPixelSize(doc.grid, doc.size);
  const bild = { canvas, breite: width, hoehe: height };
  bilder.set(doc, bild);
  return bild;
}

export function Unterlage({ bereit }: { bereit: boolean }) {
  const doc = useEditor((s) => s.doc);
  const karten = useEditor((s) => s.karten);
  const deckkraft = useEditor((s) => s.unterlageDeckkraft);
  const rev = useEditor((s) => s.rev);
  const vorher = useRef<MapDocument | null>(null);

  // Die eben verlassene Karte kann sich geändert haben: ihr Bild verwerfen.
  if (vorher.current && vorher.current !== doc) bilder.delete(vorher.current);
  vorher.current = doc;

  // Nur neu aufbauen, wenn sich ändert, was darunter liegt; nicht bei jedem Strich.
  const kette = kartenDarunter(karten, doc);
  const schluessel = kette.map((k) => k.meta.id).join('|');
  void rev;

  useEffect(() => {
    const renderer = getRenderer();
    if (!bereit || !renderer) return;
    const liste = kartenDarunter(useEditor.getState().karten, doc)
      .map((k) => bildVon(k, doc))
      .filter((b): b is Bild => !!b);
    renderer.setzeUnterlage(liste, deckkraft);
  }, [bereit, doc, schluessel, deckkraft]);

  return null;
}
