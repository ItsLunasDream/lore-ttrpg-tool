/**
 * Inventar und Geld eines Bogens (Figur oder Gruppe).
 *
 * Gewicht wird in Pfund gespeichert, wie im SRD. Die deutsche Oberflaeche
 * zeigt Kilogramm mit dem Faktor der deutschen SRD-Fassung (1 lb = 0,5 kg,
 * etwa „Stärke × 15 lb" = „Stärke × 7,5 kg"). Werte in Goldmuenzen je Stueck.
 * Leer (null) heisst unbekannt, nicht 0.
 */
import type { Muenzen } from './bogen';

export interface Gegenstand {
  id: string;
  name: string;
  beschreibung: string;
  anzahl: number;
  /** lb je Stueck. */
  gewicht: number | null;
  /** GM je Stueck. */
  wert: number | null;
  ausgeruestet: boolean;
  eingestimmt: boolean;
  /** Woher er kam, zum spaeteren Auffrischen. */
  quelle?: { art: 'magicitem' | 'srd' | 'loot'; kennung: string };
}

export const MUENZARTEN = ['pm', 'gm', 'em', 'sm', 'km'] as const;
export type Muenzart = (typeof MUENZARTEN)[number];

/** Wert in Kupfer, damit ganzzahlig gerechnet wird. */
export const IN_KUPFER: Record<Muenzart, number> = { pm: 1000, gm: 100, em: 50, sm: 10, km: 1 };

export const MUENZ_NAMEN: Record<Muenzart, { kurz: [string, string]; lang: [string, string] }> = {
  pm: { kurz: ['PM', 'PP'], lang: ['Platin', 'Platinum'] },
  gm: { kurz: ['GM', 'GP'], lang: ['Gold', 'Gold'] },
  em: { kurz: ['EM', 'EP'], lang: ['Elektrum', 'Electrum'] },
  sm: { kurz: ['SM', 'SP'], lang: ['Silber', 'Silver'] },
  km: { kurz: ['KM', 'CP'], lang: ['Kupfer', 'Copper'] }
};

/** SRD: fünfzig Münzen wiegen ein Pfund. */
export const MUENZEN_JE_PFUND = 50;

export function neueKennung(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function neuerGegenstand(name: string): Gegenstand {
  return { id: neueKennung(), name, beschreibung: '', anzahl: 1, gewicht: null, wert: null, ausgeruestet: false, eingestimmt: false };
}

// --- Geld ------------------------------------------------------------------

export function inKupfer(m: Muenzen): number {
  return MUENZARTEN.reduce((s, art) => s + m[art] * IN_KUPFER[art], 0);
}

/** Summe in GM, auf zwei Stellen. */
export function inGold(m: Muenzen): number {
  return inKupfer(m) / 100;
}

export function anzahlMuenzen(m: Muenzen): number {
  return MUENZARTEN.reduce((s, art) => s + m[art], 0);
}

/**
 * Umrechnen, nur auf Knopfdruck.
 *
 * - `wenige`: so wenige Muenzen wie moeglich, ohne Elektrum (das nimmt am
 *   Tisch kaum jemand gern).
 * - `gold`: alles in Gold, der Rest in Silber und Kupfer. Platin bleibt Gold.
 */
export function rechneUm(m: Muenzen, art: 'wenige' | 'gold'): Muenzen {
  let rest = inKupfer(m);
  const heraus: Muenzen = { pm: 0, gm: 0, em: 0, sm: 0, km: 0 };
  const folge: Muenzart[] = art === 'wenige' ? ['pm', 'gm', 'sm', 'km'] : ['gm', 'sm', 'km'];
  for (const a of folge) {
    heraus[a] = Math.floor(rest / IN_KUPFER[a]);
    rest -= heraus[a] * IN_KUPFER[a];
  }
  return heraus;
}

/** Zieht einen Betrag ab. Reicht es in einer Muenzart nicht, geht nichts ab (null). */
export function zieheAb(m: Muenzen, betrag: Partial<Muenzen>): Muenzen | null {
  const heraus = { ...m };
  for (const a of MUENZARTEN) {
    const n = Math.max(0, Math.floor(betrag[a] ?? 0));
    if (heraus[a] < n) return null;
    heraus[a] -= n;
  }
  return heraus;
}

export function legeDazu(m: Muenzen, betrag: Partial<Muenzen>): Muenzen {
  const heraus = { ...m };
  for (const a of MUENZARTEN) heraus[a] += Math.max(0, Math.floor(betrag[a] ?? 0));
  return heraus;
}

/**
 * Teilt Geld gleichmaessig auf `n` Personen. Je Muenzart wird ganzzahlig
 * geteilt; was nicht aufgeht, bleibt als Rest (in der Gruppe).
 */
export function teileAuf(m: Muenzen, n: number): { jeder: Muenzen; rest: Muenzen } {
  const k = Math.max(1, Math.floor(n));
  const jeder: Muenzen = { pm: 0, gm: 0, em: 0, sm: 0, km: 0 };
  const rest: Muenzen = { pm: 0, gm: 0, em: 0, sm: 0, km: 0 };
  for (const a of MUENZARTEN) {
    jeder[a] = Math.floor(m[a] / k);
    rest[a] = m[a] - jeder[a] * k;
  }
  return { jeder, rest };
}

// --- Summen ----------------------------------------------------------------

export interface Summen {
  /** lb, ohne unbekannte. */
  gewicht: number;
  gewichtUnvollstaendig: boolean;
  /** GM, Gegenstaende plus Geld. */
  wert: number;
  wertUnvollstaendig: boolean;
  eingestimmt: number;
}

export function summen(liste: readonly Gegenstand[], m: Muenzen, muenzgewicht: boolean): Summen {
  let gewicht = muenzgewicht ? anzahlMuenzen(m) / MUENZEN_JE_PFUND : 0;
  let wert = inGold(m);
  let gewichtUnvollstaendig = false;
  let wertUnvollstaendig = false;
  for (const g of liste) {
    if (g.gewicht === null) gewichtUnvollstaendig = true;
    else gewicht += g.gewicht * g.anzahl;
    if (g.wert === null) wertUnvollstaendig = true;
    else wert += g.wert * g.anzahl;
  }
  return {
    gewicht: Math.round(gewicht * 100) / 100,
    gewichtUnvollstaendig,
    wert: Math.round(wert * 100) / 100,
    wertUnvollstaendig,
    eingestimmt: liste.filter((g) => g.eingestimmt).length
  };
}

/**
 * Gewicht fuer die Anzeige, immer in beiden Einheiten: deutsch „5,5 kg
 * (11 lb)", englisch „11 lb (5.5 kg)". Sonst muesste am Tisch umgerechnet
 * werden, wenn nicht alle dieselbe Sprache eingestellt haben. Umgerechnet
 * mit dem Faktor der deutschen SRD-Fassung (1 lb = 0,5 kg), nicht mit
 * 0,4536: so stimmen die Zahlen mit den gedruckten Tabellen ueberein.
 */
export function gewichtAnzeige(lb: number, sprache: 'de' | 'en'): string {
  const zahl = (n: number, ort: string) => n.toLocaleString(ort, { maximumFractionDigits: 2 });
  if (sprache === 'de') return `${zahl(lb / 2, 'de-DE')} kg (${zahl(lb, 'de-DE')} lb)`;
  return `${zahl(lb, 'en-US')} lb (${zahl(lb / 2, 'en-US')} kg)`;
}

/** Aus einer Eingabe in Anzeige-Einheit wieder Pfund. */
export function gewichtAusEingabe(text: string, sprache: 'de' | 'en'): number | null {
  const roh = text.trim().replace(',', '.');
  if (!roh) return null;
  const n = Number(roh);
  if (!Number.isFinite(n) || n < 0) return null;
  return sprache === 'de' ? n * 2 : n;
}

export function gewichtFuerEingabe(lb: number | null, sprache: 'de' | 'en'): string {
  if (lb === null) return '';
  const wert = sprache === 'de' ? lb / 2 : lb;
  return String(Math.round(wert * 1000) / 1000).replace('.', sprache === 'de' ? ',' : '.');
}

// --- Pruefen beim Einlesen -------------------------------------------------

function zahlOderNull(wert: unknown, max: number): number | null {
  if (wert === null || wert === undefined || wert === '') return null;
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : null;
}

export function bereinigeGegenstaende(roh: unknown): Gegenstand[] {
  if (!Array.isArray(roh)) return [];
  return roh.slice(0, 500).flatMap((x): Gegenstand[] => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.slice(0, 120) : '';
    if (!name.trim()) return [];
    const q = r.quelle && typeof r.quelle === 'object' ? (r.quelle as Record<string, unknown>) : null;
    const quelle =
      q && ['magicitem', 'srd', 'loot'].includes(q.art as string) && typeof q.kennung === 'string'
        ? { art: q.art as 'magicitem' | 'srd' | 'loot', kennung: q.kennung.slice(0, 120) }
        : undefined;
    return [
      {
        id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : neueKennung(),
        name,
        beschreibung: typeof r.beschreibung === 'string' ? r.beschreibung.slice(0, 20_000) : '',
        anzahl: Math.max(1, Math.min(999_999, Math.round(Number(r.anzahl) || 1))),
        gewicht: zahlOderNull(r.gewicht, 100_000),
        wert: zahlOderNull(r.wert, 100_000_000),
        ausgeruestet: r.ausgeruestet === true,
        eingestimmt: r.eingestimmt === true,
        ...(quelle ? { quelle } : {})
      }
    ];
  });
}
