/**
 * Die Zauber eines Bogens: Plaetze, Liste, Wirken.
 *
 * Die SRD-Zauber kommen aus `@suite/srd/zauber`. Gespeichert wird nur ihre
 * Kennung; Name und Text holt die Oberflaeche in ihrer Sprache. Eigene
 * Zauber tragen Name, Grad und Text selbst.
 *
 * Nicht gerechnet: wie viele Plaetze eine Klasse auf welcher Stufe hat und
 * wie viele Zauber vorbereitet sein duerfen. Das steht in den
 * Klassentabellen und traegt man selbst ein (docs/charakterbogen.md).
 */
import { ZAUBER, type Zauber, type Zauberklasse } from '@suite/srd/zauber';
import { ATTRIBUTE, type Attribut } from './regeln';

export interface ZauberEintrag {
  /** Kennung eines SRD-Zaubers. */
  srd?: string;
  /** Oder ein eigener Zauber. */
  eigen?: { name: string; grad: number; text: string };
  vorbereitet: boolean;
  /** Immer vorbereitet, etwa durch die Unterklasse. */
  immer: boolean;
  /** Freitext: „Magic Initiate", „Ring". */
  herkunft: string;
}

export interface Zauberplatz {
  /** 1 bis 9. */
  grad: number;
  max: number;
  verbraucht: number;
}

export interface Zauberei {
  attribut: Attribut;
  /** Grade 1–9, immer alle neun (max 0 = keine). */
  plaetze: Zauberplatz[];
  /** Plaetze kommen auch nach einer kurzen Rast zurueck (Paktmagie). */
  kurzeRast: boolean;
  /** Von Hand; null = keine Angabe. */
  maxVorbereitet: number | null;
  liste: ZauberEintrag[];
}

export const NACH_ID: ReadonlyMap<string, Zauber> = new Map(ZAUBER.map((z) => [z.id, z]));

export const KLASSEN: readonly { id: Zauberklasse; name: [string, string]; muster: readonly string[] }[] = [
  { id: 'barde', name: ['Barde', 'Bard'], muster: ['barde', 'bard'] },
  { id: 'druide', name: ['Druide', 'Druid'], muster: ['druide', 'druid'] },
  { id: 'hexenmeister', name: ['Hexenmeister', 'Warlock'], muster: ['hexenmeister', 'warlock'] },
  { id: 'kleriker', name: ['Kleriker', 'Cleric'], muster: ['kleriker', 'cleric'] },
  { id: 'magier', name: ['Magier', 'Wizard'], muster: ['magier', 'wizard'] },
  { id: 'paladin', name: ['Paladin', 'Paladin'], muster: ['paladin'] },
  { id: 'waldlaeufer', name: ['Waldläufer', 'Ranger'], muster: ['waldläufer', 'waldlaeufer', 'ranger'] },
  { id: 'zauberer', name: ['Zauberer', 'Sorcerer'], muster: ['zauberer', 'sorcerer'] }
];

/**
 * Welche Zauberklassen zu den Klassennamen eines Bogens passen. „Magierin"
 * findet „magier", „Waldläuferin" „waldläufer". Unbekanntes faellt weg.
 */
export function klassenAusNamen(namen: readonly string[]): Zauberklasse[] {
  const heraus = new Set<Zauberklasse>();
  for (const roh of namen) {
    const name = roh.trim().toLowerCase();
    for (const k of KLASSEN) if (k.muster.some((m) => name.startsWith(m))) heraus.add(k.id);
  }
  return [...heraus];
}

export function leereZauberei(attribut: Attribut = 'int'): Zauberei {
  return {
    attribut,
    plaetze: Array.from({ length: 9 }, (_, i) => ({ grad: i + 1, max: 0, verbraucht: 0 })),
    kurzeRast: false,
    maxVorbereitet: null,
    liste: []
  };
}

/** Grad eines Eintrags; unbekannte SRD-Kennung zaehlt als Zaubertrick. */
export function gradVon(e: ZauberEintrag): number {
  if (e.eigen) return e.eigen.grad;
  return (e.srd && NACH_ID.get(e.srd)?.grad) || 0;
}

export function nameVon(e: ZauberEintrag, sprache: 'de' | 'en'): string {
  if (e.eigen) return e.eigen.name;
  return (e.srd && NACH_ID.get(e.srd)?.name[sprache]) || e.srd || '';
}

/** Vorbereitet gezaehlt: ohne Zaubertricks und ohne „immer vorbereitet" (so zaehlen es die Regeln von 2024). */
export function vorbereiteteAnzahl(z: Zauberei): number {
  return z.liste.filter((e) => e.vorbereitet && !e.immer && gradVon(e) > 0).length;
}

/** Der niedrigste freie Platz ab `mindestens`, oder null. */
export function freierPlatz(z: Zauberei, mindestens: number): number | null {
  const p = z.plaetze.find((x) => x.grad >= mindestens && x.verbraucht < x.max);
  return p ? p.grad : null;
}

/** Verbraucht einen Platz des Grads. Ohne freien Platz bleibt alles, wie es ist. */
export function verbrauche(z: Zauberei, grad: number): Zauberei {
  return {
    ...z,
    plaetze: z.plaetze.map((p) => (p.grad === grad && p.verbraucht < p.max ? { ...p, verbraucht: p.verbraucht + 1 } : p))
  };
}

export function fuellePlaetze(z: Zauberei): Zauberei {
  return { ...z, plaetze: z.plaetze.map((p) => ({ ...p, verbraucht: 0 })) };
}

/** Nach Grad, dann Name; Zaubertricks zuerst. */
export function sortiert(liste: readonly ZauberEintrag[], sprache: 'de' | 'en'): ZauberEintrag[] {
  return [...liste].sort((a, b) => gradVon(a) - gradVon(b) || nameVon(a, sprache).localeCompare(nameVon(b, sprache)));
}

/** Suche in den SRD-Zaubern: Text in beiden Sprachen, dazu Grad und Klasse. */
export function sucheZauber(
  anfrage: string,
  filter: { grad?: number | null; klasse?: Zauberklasse | null },
  sprache: 'de' | 'en'
): Zauber[] {
  const worte = anfrage.toLowerCase().split(/\s+/).filter(Boolean);
  return ZAUBER.filter(
    (z) =>
      (filter.grad === undefined || filter.grad === null || z.grad === filter.grad) &&
      (!filter.klasse || z.klassen.includes(filter.klasse)) &&
      worte.every((w) => `${z.name.de} ${z.name.en}`.toLowerCase().includes(w))
  ).sort((a, b) => a.grad - b.grad || a.name[sprache].localeCompare(b.name[sprache]));
}

// --- Pruefen beim Einlesen -------------------------------------------------

function zahl(wert: unknown, ersatz: number, min: number, max: number): number {
  const n = typeof wert === 'number' ? wert : Number(wert);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : ersatz;
}

export function bereinigeZauberei(roh: unknown): Zauberei | undefined {
  if (!roh || typeof roh !== 'object') return undefined;
  const r = roh as Record<string, unknown>;
  const leer = leereZauberei();
  const plaetze = Array.isArray(r.plaetze) ? r.plaetze : [];
  return {
    attribut: ATTRIBUTE.includes(r.attribut as Attribut) ? (r.attribut as Attribut) : leer.attribut,
    plaetze: leer.plaetze.map((p) => {
      const x = plaetze.find((y) => y && typeof y === 'object' && (y as Record<string, unknown>).grad === p.grad) as
        | Record<string, unknown>
        | undefined;
      const max = zahl(x?.max, 0, 0, 9);
      return { grad: p.grad, max, verbraucht: zahl(x?.verbraucht, 0, 0, max) };
    }),
    kurzeRast: r.kurzeRast === true,
    maxVorbereitet: r.maxVorbereitet === null || r.maxVorbereitet === undefined ? null : zahl(r.maxVorbereitet, 0, 0, 99),
    liste: (Array.isArray(r.liste) ? r.liste : []).slice(0, 200).flatMap((e): ZauberEintrag[] => {
      if (!e || typeof e !== 'object') return [];
      const x = e as Record<string, unknown>;
      const basis = {
        vorbereitet: x.vorbereitet === true,
        immer: x.immer === true,
        herkunft: typeof x.herkunft === 'string' ? x.herkunft.slice(0, 80) : ''
      };
      if (typeof x.srd === 'string' && x.srd) return [{ srd: x.srd.slice(0, 80), ...basis }];
      const eigen = x.eigen && typeof x.eigen === 'object' ? (x.eigen as Record<string, unknown>) : null;
      if (eigen && typeof eigen.name === 'string' && eigen.name.trim()) {
        return [
          {
            eigen: {
              name: eigen.name.slice(0, 80),
              grad: zahl(eigen.grad, 0, 0, 9),
              text: typeof eigen.text === 'string' ? eigen.text.slice(0, 5000) : ''
            },
            ...basis
          }
        ];
      }
      return [];
    })
  };
}
