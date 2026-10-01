/**
 * Tiergestalt im Bogen (docs/tiergestalt.md): bekannte Gestalten, Nutzungen,
 * Verwandeln und Zurueckverwandeln.
 *
 * Die Grenzen je Druidenstufe kommen aus `@suite/srd/gestalten` (dort gegen
 * das SRD 5.2.1 geprueft). Hier steht nur, was mit dem Bogen geschieht:
 * - Verwandeln verbraucht eine Nutzung und gibt temporaere TP in Hoehe der
 *   Druidenstufe. Temporaere TP addieren sich nicht; nach SRD waehlt man,
 *   welche man behaelt. Der Bogen nimmt die hoeheren.
 * - Zurueckverwandeln laesst die temporaeren TP stehen: das SRD laesst sie
 *   beim Ende der Gestalt nicht verfallen.
 * - Kurze Rast: eine Nutzung zurueck, lange Rast: alle.
 */
import { gestaltNach, tiergestaltFuer } from '@suite/srd/gestalten';
import type { Werte } from './bogen';

export interface Tiergestalt {
  /** Kennungen der SRD-Tiere („wolf"). */
  bekannt: string[];
  /** Verbrauchte Nutzungen seit der letzten langen Rast. */
  verbraucht: number;
  /** Die Gestalt, in der die Figur gerade ist. */
  aktiv?: string;
}

/** Klassennamen, die als Druide zaehlen; frei geschrieben, darum grosszuegig. */
const DRUIDE = /\bdruid(e|in)?\b/i;

/** Die Stufe in der Klasse Druide, 0 ohne. */
export function druidenstufe(w: Werte): number {
  return w.klassen.filter((k) => DRUIDE.test(k.name)).reduce((s, k) => s + (k.stufe || 0), 0);
}

function stand(w: Werte): Tiergestalt {
  return w.tiergestalt ?? { bekannt: [], verbraucht: 0 };
}

export function nutzungenUebrig(w: Werte): number {
  const regel = tiergestaltFuer(druidenstufe(w));
  return regel ? Math.max(0, regel.nutzungen - stand(w).verbraucht) : 0;
}

export function lerneGestalt(w: Werte, id: string): Werte {
  const s = stand(w);
  if (!gestaltNach(id) || s.bekannt.includes(id)) return w;
  return { ...w, tiergestalt: { ...s, bekannt: [...s.bekannt, id] } };
}

export function vergissGestalt(w: Werte, id: string): Werte {
  const s = stand(w);
  return { ...w, tiergestalt: { ...s, bekannt: s.bekannt.filter((x) => x !== id) } };
}

/** Verwandeln; ohne Nutzung, ohne Stufe 2 oder in eine unbekannte Gestalt: unveraendert. */
export function verwandle(w: Werte, id: string): Werte {
  const regel = tiergestaltFuer(druidenstufe(w));
  const s = stand(w);
  if (!regel || !gestaltNach(id) || !s.bekannt.includes(id) || nutzungenUebrig(w) <= 0) return w;
  return {
    ...w,
    tp: { ...w.tp, temp: Math.max(w.tp.temp, regel.tempTp) },
    tiergestalt: { ...s, verbraucht: s.verbraucht + 1, aktiv: id }
  };
}

export function verwandleZurueck(w: Werte): Werte {
  if (!w.tiergestalt?.aktiv) return w;
  const { aktiv: _weg, ...rest } = w.tiergestalt;
  return { ...w, tiergestalt: rest };
}

export function rasteTiergestalt(w: Werte, rast: 'kurz' | 'lang'): Werte {
  if (!w.tiergestalt) return w;
  const verbraucht = rast === 'lang' ? 0 : Math.max(0, w.tiergestalt.verbraucht - 1);
  return { ...w, tiergestalt: { ...w.tiergestalt, verbraucht } };
}

/** Beim Einlesen: nur bekannte SRD-Tiere, Zahlen im Rahmen. */
export function bereinigeTiergestalt(roh: unknown): Tiergestalt | undefined {
  if (!roh || typeof roh !== 'object') return undefined;
  const r = roh as Record<string, unknown>;
  const bekannt = Array.isArray(r.bekannt)
    ? [...new Set(r.bekannt.filter((x): x is string => typeof x === 'string' && Boolean(gestaltNach(x))))].slice(0, 30)
    : [];
  const v = Number(r.verbraucht);
  const verbraucht = Number.isFinite(v) ? Math.min(10, Math.max(0, Math.round(v))) : 0;
  const aktiv = typeof r.aktiv === 'string' && gestaltNach(r.aktiv) ? r.aktiv : undefined;
  return { bekannt, verbraucht, ...(aktiv ? { aktiv } : {}) };
}
