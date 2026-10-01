/**
 * Merkt sich die Generator-Einstellungen (Rückmeldung: „Optionen merken, z. B.
 * bei Dungeon, ob man Keys mitgenerieren will. Nicht jedes Mal neu anklicken").
 *
 * Gemerkt wird je Generator, zusammengeführt mit den Vorgaben: kommt später
 * ein neues Feld dazu, fehlt es in der alten Ablage nicht, sondern trägt seine
 * Vorgabe. Der Startwert (Seed) wird nicht gemerkt; jede Sitzung soll eine
 * frische Karte vorschlagen.
 */

import {
  GENERATOR_IDS,
  defaultGeneratorParams,
  type GeneratorId,
  type GeneratorParams,
} from '@/model/generators';

const SCHLUESSEL = 'mapmaker.generator.v1';

export type GeneratorZiel = 'aktuell' | 'neu';

export interface GeneratorMerker {
  id: GeneratorId;
  params: GeneratorParams;
  resize: boolean;
  ziel: GeneratorZiel;
}

export function ladeGeneratorMerker(): GeneratorMerker {
  const vorgabe: GeneratorMerker = { id: 'dungeon', params: defaultGeneratorParams(), resize: true, ziel: 'aktuell' };
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return vorgabe;
    const d = JSON.parse(roh) as Partial<GeneratorMerker>;
    const params = { ...vorgabe.params };
    for (const g of GENERATOR_IDS) {
      const alt = d.params?.[g];
      if (alt && typeof alt === 'object') (params as Record<string, unknown>)[g] = { ...vorgabe.params[g], ...alt };
    }
    return {
      id: GENERATOR_IDS.includes(d.id as GeneratorId) ? (d.id as GeneratorId) : vorgabe.id,
      params,
      resize: typeof d.resize === 'boolean' ? d.resize : vorgabe.resize,
      ziel: d.ziel === 'neu' ? 'neu' : 'aktuell',
    };
  } catch {
    // Gesperrt oder kaputt: dann mit den Vorgaben.
    return vorgabe;
  }
}

export function speichereGeneratorMerker(m: GeneratorMerker): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(m));
  } catch {
    /* Ohne Speicher eben ohne Merken. */
  }
}
