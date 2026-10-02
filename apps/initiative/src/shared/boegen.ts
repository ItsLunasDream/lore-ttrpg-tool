/**
 * Figuren aus dem Charakterbogen (docs/charakterbogen.md, Schritt 7).
 *
 * Der Bogen schickt Name, TP, RK und Initiativebonus; hier werden daraus
 * Spielerfiguren. Eine Figur haengt ueber `bogen` an ihrem Bogen: kommt sie
 * noch einmal, wird sie aufgefrischt statt verdoppelt. Aendern sich im
 * Kampf ihre TP, meldet der Tracker das zurueck (`tpAenderungen`), und der
 * Bogen schreibt es mit.
 *
 * Zustände gehen in beide Richtungen, als Schlüssel: die SRD-Kennung
 * („poisoned“) oder der Name eines eigenen Zustands. Jede Seite schickt nur,
 * was seit dem zuletzt bekannten Stand dazukam oder wegfiel; so laufen
 * gleichzeitige Änderungen nicht übereinander und nichts im Kreis.
 * Erschöpfung bleibt außen vor: der Bogen führt sie als Stufe.
 *
 * Rein und ohne Oberflaeche.
 */
import { ZUSTAENDE } from '@suite/srd/zustaende';
import { neueId, neuerTeilnehmer } from './kampf';
import type { Kampf, Teilnehmer, Zustand } from './types';

export interface Figur {
  /** Die Kennung des Bogens; im Raum `<Person>/<Bogen>`. */
  readonly kennung: string;
  readonly name: string;
  readonly tp: number;
  readonly tpMax: number;
  readonly tempTp: number;
  readonly rk: number;
  readonly iniMod: number;
  /** Zustände als Schlüssel; fehlt bei einem Bogen, der sie nicht schickt. */
  readonly zustaende?: readonly string[];
}

/** Was mit den Zuständen einer Figur geschehen soll. */
export type ZustandsDelta =
  | { readonly ersetze: readonly string[] }
  | { readonly hinzu: readonly string[]; readonly weg: readonly string[] };

/** Der Schlüssel zu einem Namen im Tracker: SRD-Kennung (in beiden Sprachen erkannt) oder der Name. */
export function zustandSchluessel(name: string): string {
  const n = name.trim().toLowerCase();
  return ZUSTAENDE.find((z) => z.name.de.toLowerCase() === n || z.name.en.toLowerCase() === n)?.id ?? name.trim();
}

export function zustandName(schluessel: string, sprache: 'de' | 'en'): string {
  return ZUSTAENDE.find((z) => z.id === schluessel)?.name[sprache] ?? schluessel;
}

const OHNE = 'exhaustion';

function schluesselVon(t: Teilnehmer): string[] {
  return [...new Set(t.zustaende.map((z) => zustandSchluessel(z.name)))].filter((k) => k && k !== OHNE);
}

/**
 * Das Delta für eine ankommende Figur. Ohne bekannten Stand gilt der Bogen
 * (wie bei den TP); sonst nur, was sich am Bogen seitdem geändert hat.
 * `bekannt` wird nachgezogen.
 */
export function zustandsDelta(f: Figur, bekannt: Map<string, readonly string[]>): ZustandsDelta | null {
  if (!f.zustaende) return null;
  const jetzt = f.zustaende.filter((k) => k !== OHNE);
  const vorher = bekannt.get(f.kennung);
  bekannt.set(f.kennung, jetzt);
  if (!vorher) return { ersetze: jetzt };
  const hinzu = jetzt.filter((k) => !vorher.includes(k));
  const weg = vorher.filter((k) => !jetzt.includes(k));
  return hinzu.length || weg.length ? { hinzu, weg } : null;
}

function wendeZustaendeAn(t: Teilnehmer, delta: ZustandsDelta, sprache: 'de' | 'en'): Teilnehmer {
  const da = schluesselVon(t);
  const soll = 'ersetze' in delta ? delta.ersetze : [...da.filter((k) => !delta.weg.includes(k)), ...delta.hinzu];
  const behalten = t.zustaende.filter((z) => {
    const k = zustandSchluessel(z.name);
    return k === OHNE || soll.includes(k);
  });
  const neu: Zustand[] = soll
    .filter((k) => !behalten.some((z) => zustandSchluessel(z.name) === k))
    .map((k) => ({ id: neueId(), name: zustandName(k, sprache), dauer: 'offen', rundenRest: null, frisch: false }));
  if (neu.length === 0 && behalten.length === t.zustaende.length) return t;
  return { ...t, zustaende: [...behalten, ...neu] };
}

export function leseFiguren(roh: unknown): Figur[] {
  if (!Array.isArray(roh)) return [];
  return roh.slice(0, 50).flatMap((x): Figur[] => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const zahl = (w: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(w) || 0)));
    if (typeof r.kennung !== 'string' || !r.kennung || typeof r.name !== 'string') return [];
    return [
      {
        kennung: r.kennung.slice(0, 120),
        name: r.name.slice(0, 120) || '?',
        tp: zahl(r.tp, 0, 9999),
        tpMax: zahl(r.tpMax, 0, 9999),
        tempTp: zahl(r.tempTp, 0, 9999),
        rk: zahl(r.rk, 0, 99),
        iniMod: zahl(r.iniMod, -20, 20),
        ...(Array.isArray(r.zustaende)
          ? { zustaende: r.zustaende.filter((z): z is string => typeof z === 'string' && z.trim() !== '').slice(0, 30).map((z) => z.trim().slice(0, 60)) }
          : {})
      }
    ];
  });
}

function frische(t: Teilnehmer, f: Figur): Teilnehmer {
  const [k, ...rest] = t.koerper;
  if (!k) return t;
  const gleich = t.name === f.name && t.rk === f.rk && k.hp === f.tp && k.hpMax === f.tpMax && k.tempHp === f.tempTp;
  if (gleich) return t;
  return { ...t, name: f.name, rk: f.rk, koerper: [{ ...k, hp: f.tp, hpMax: f.tpMax, tempHp: f.tempTp }, ...rest] };
}

/**
 * Figuren in den Kampf: vorhandene (gleicher Bogen) frischen, neue anfuegen
 * (nur mit `hinzufuegen`). Initiative bleibt 0 zum Eintragen; der Bonus
 * steht als Feinwert fuer Gleichstaende. Nichts geaendert → derselbe Kampf.
 */
export function uebernimmFiguren(
  kampf: Kampf,
  figuren: readonly Figur[],
  hinzufuegen: boolean,
  deltas: ReadonlyMap<string, ZustandsDelta> = new Map(),
  sprache: 'de' | 'en' = 'de'
): Kampf {
  let geaendert = false;
  const mitZustaenden = (t: Teilnehmer, kennung: string) => {
    const d = deltas.get(kennung);
    return d ? wendeZustaendeAn(t, d, sprache) : t;
  };
  let teilnehmer = kampf.teilnehmer.map((t) => {
    const f = t.bogen ? figuren.find((x) => x.kennung === t.bogen) : undefined;
    if (!f) return t;
    const neu = mitZustaenden(frische(t, f), f.kennung);
    if (neu !== t) geaendert = true;
    return neu;
  });
  if (hinzufuegen) {
    const da = new Set(teilnehmer.map((t) => t.bogen).filter(Boolean));
    for (const f of figuren) {
      if (da.has(f.kennung)) continue;
      const t = neuerTeilnehmer(f.name, true);
      teilnehmer = [
        ...teilnehmer,
        mitZustaenden(
          { ...t, feinwert: f.iniMod, rk: f.rk, bogen: f.kennung, koerper: [{ ...t.koerper[0], hp: f.tp, hpMax: f.tpMax, tempHp: f.tempTp }] },
          f.kennung
        )
      ];
      geaendert = true;
    }
  }
  return geaendert ? { ...kampf, teilnehmer } : kampf;
}

/**
 * Welche Figuren im Kampf andere TP haben als zuletzt bekannt. `bekannt`
 * wird dabei nachgezogen, damit dieselbe Aenderung nicht zweimal geht.
 */
export function tpAenderungen(
  kampf: Kampf,
  bekannt: Map<string, { hp: number; temp: number }>
): { kennung: string; hp: number; temp: number }[] {
  const heraus: { kennung: string; hp: number; temp: number }[] = [];
  for (const t of kampf.teilnehmer) {
    const k = t.koerper[0];
    if (!t.bogen || !k) continue;
    const alt = bekannt.get(t.bogen);
    if (!alt) {
      bekannt.set(t.bogen, { hp: k.hp, temp: k.tempHp });
      continue;
    }
    if (alt.hp !== k.hp || alt.temp !== k.tempHp) {
      bekannt.set(t.bogen, { hp: k.hp, temp: k.tempHp });
      heraus.push({ kennung: t.bogen, hp: k.hp, temp: k.tempHp });
    }
  }
  return heraus;
}

/**
 * Welche Figuren im Kampf andere Zustände haben als zuletzt bekannt, als
 * Delta für den Bogen. Wie `tpAenderungen`: das erste Mal wird nur gemerkt.
 */
export function zustandAenderungen(
  kampf: Kampf,
  bekannt: Map<string, readonly string[]>
): { kennung: string; hinzu: string[]; weg: string[] }[] {
  const heraus: { kennung: string; hinzu: string[]; weg: string[] }[] = [];
  for (const t of kampf.teilnehmer) {
    if (!t.bogen) continue;
    const jetzt = schluesselVon(t);
    const vorher = bekannt.get(t.bogen);
    bekannt.set(t.bogen, jetzt);
    if (!vorher) continue;
    const hinzu = jetzt.filter((k) => !vorher.includes(k));
    const weg = vorher.filter((k) => !jetzt.includes(k));
    if (hinzu.length || weg.length) heraus.push({ kennung: t.bogen, hinzu, weg });
  }
  return heraus;
}
