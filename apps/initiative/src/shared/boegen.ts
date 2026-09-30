/**
 * Figuren aus dem Charakterbogen (docs/charakterbogen.md, Schritt 7).
 *
 * Der Bogen schickt Name, TP, RK und Initiativebonus; hier werden daraus
 * Spielerfiguren. Eine Figur haengt ueber `bogen` an ihrem Bogen: kommt sie
 * noch einmal, wird sie aufgefrischt statt verdoppelt. Aendern sich im
 * Kampf ihre TP, meldet der Tracker das zurueck (`tpAenderungen`), und der
 * Bogen schreibt es mit.
 *
 * Rein und ohne Oberflaeche.
 */
import { neuerTeilnehmer } from './kampf';
import type { Kampf, Teilnehmer } from './types';

export interface Figur {
  /** Die Kennung des Bogens; im Raum `<Person>/<Bogen>`. */
  readonly kennung: string;
  readonly name: string;
  readonly tp: number;
  readonly tpMax: number;
  readonly tempTp: number;
  readonly rk: number;
  readonly iniMod: number;
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
        iniMod: zahl(r.iniMod, -20, 20)
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
export function uebernimmFiguren(kampf: Kampf, figuren: readonly Figur[], hinzufuegen: boolean): Kampf {
  let geaendert = false;
  let teilnehmer = kampf.teilnehmer.map((t) => {
    const f = t.bogen ? figuren.find((x) => x.kennung === t.bogen) : undefined;
    if (!f) return t;
    const neu = frische(t, f);
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
        { ...t, feinwert: f.iniMod, rk: f.rk, bogen: f.kennung, koerper: [{ ...t.koerper[0], hp: f.tp, hpMax: f.tpMax, tempHp: f.tempTp }] }
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
