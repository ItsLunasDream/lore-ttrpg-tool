/**
 * Alle Karten einer Datei als UVTT, in einem ZIP (`model/mappe.ts`).
 *
 * Foundry v14 stapelt Ebenen in einer Szene („Scene Levels"). UVTT kennt
 * keine Ebenen, und für den Universal Battlemap Importer ist nicht belegt,
 * dass er welche anlegt. Der Weg ist deshalb: je Karte eine UVTT-Datei, obere
 * Etagen mit durchsichtigem Boden, in Foundry einzeln importieren und dann zu
 * einer Szene mit Ebenen zusammenführen (Community-Modul „Level Merger" oder
 * von Hand). Eine Szene mit Ebenen direkt zu schreiben, hieße ihr Format zu
 * raten — dafür liegt kein echter Export vor.
 */

import { strToU8, zipSync } from 'fflate';
import { kartenDarunter } from '@/model/mappe';
import type { MapDocument } from '@/model/types';

/** Von unten nach oben: was unter einer anderen Karte liegt, kommt zuerst. Sonst bleibt die Reihenfolge der Leiste. */
export function ebenenReihenfolge(karten: readonly MapDocument[]): MapDocument[] {
  return karten
    .map((k, i) => ({ k, i, tiefe: kartenDarunter(karten, k).length }))
    .sort((a, b) => a.tiefe - b.tiefe || a.i - b.i)
    .map((x) => x.k);
}

/** „01-Erdgeschoss.dd2vtt": die Nummer hält die Reihenfolge im Dateimanager. */
export function ebenenDateiname(stelle: number, name: string, endung: string): string {
  const sauber = name.trim().replace(/[<>:"/\\|?*\s]+/g, '_').replace(/\.+$/, '') || 'karte';
  return `${String(stelle + 1).padStart(2, '0')}-${sauber}.${endung}`;
}

export function ebenenZip(dateien: readonly { name: string; text: string }[], liesmich: string): Uint8Array {
  const inhalt: Record<string, Uint8Array> = { 'LIESMICH.txt': strToU8(liesmich) };
  for (const d of dateien) inhalt[d.name] = strToU8(d.text);
  // Die Bilder in den UVTT-Dateien sind schon komprimiert (WebP/PNG als base64).
  return zipSync(inhalt, { level: 6 });
}
