/**
 * Würfeln direkt vom Bogen (Rückmeldung): Attributswürfe, Rettungswürfe,
 * Fertigkeiten, Initiative und Todesrettungswürfe.
 *
 * Die Chatzeile beginnt mit „🎲" wie beim Würfel-Werkzeug; so landet sie im
 * Raum und im Sitzungsprotokoll der Hülle als Wurf.
 *
 * Todesrettungswurf nach SRD 5.2: 10 oder mehr Erfolg, darunter Fehlschlag;
 * eine 1 zählt als zwei Fehlschläge; eine 20 bringt 1 TP zurück (dann sind
 * die Rettungswürfe vorbei). Drei Erfolge: stabil; drei Fehlschläge: tot.
 */
import type { Werte } from './bogen';

export type Zufall = () => number;

export interface Probe {
  readonly d20: number;
  readonly gesamt: number;
  readonly text: string;
}

function vorzeichen(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function probe(name: string, bonus: number, rng: Zufall = Math.random): Probe {
  const d20 = Math.floor(rng() * 20) + 1;
  const gesamt = d20 + bonus;
  const zusatz = d20 === 20 ? ' · 20!' : d20 === 1 ? ' · 1!' : '';
  return { d20, gesamt, text: `🎲 ${name}: ${gesamt} (d20 ${d20}${bonus ? ` ${vorzeichen(bonus)}` : ''})${zusatz}` };
}

export type Todesausgang = 'erfolg' | 'fehlschlag' | 'doppelt' | 'aufgestanden' | 'stabil' | 'tot';

/** Drei Fehlschläge bei 0 TP; wer wieder TP hat, lebt (Fehlschläge gehen dann auf null). */
export function istTot(w: Pick<Werte, 'todesrettung' | 'tp'>): boolean {
  return w.todesrettung.fehlschlaege >= 3 && w.tp.aktuell <= 0;
}

/** Ein Todesrettungswurf; liefert den neuen Stand, was passiert ist und die Chatzeile. */
export function todesrettungWurf(
  w: Werte,
  name: string,
  sprache: 'de' | 'en',
  rng: Zufall = Math.random
): { werte: Werte; ausgang: Todesausgang; d20: number; text: string } {
  const de = sprache === 'de';
  const d20 = Math.floor(rng() * 20) + 1;
  let { erfolge, fehlschlaege } = w.todesrettung;
  let werte: Werte = w;
  let ausgang: Todesausgang;
  if (d20 === 20) {
    werte = { ...w, tp: { ...w.tp, aktuell: Math.max(1, w.tp.aktuell) }, todesrettung: { erfolge: 0, fehlschlaege: 0 } };
    ausgang = 'aufgestanden';
  } else {
    if (d20 === 1) fehlschlaege = Math.min(3, fehlschlaege + 2);
    else if (d20 >= 10) erfolge = Math.min(3, erfolge + 1);
    else fehlschlaege = Math.min(3, fehlschlaege + 1);
    ausgang = fehlschlaege >= 3 ? 'tot' : erfolge >= 3 ? 'stabil' : d20 === 1 ? 'doppelt' : d20 >= 10 ? 'erfolg' : 'fehlschlag';
    werte = { ...w, todesrettung: { erfolge, fehlschlaege } };
  }
  const wort: Record<Todesausgang, [string, string]> = {
    erfolg: ['Erfolg', 'success'],
    fehlschlag: ['Fehlschlag', 'failure'],
    doppelt: ['zwei Fehlschläge', 'two failures'],
    aufgestanden: ['1 TP zurück, wieder bei Bewusstsein', 'regains 1 HP and wakes up'],
    stabil: ['stabil', 'stable'],
    tot: ['tot', 'dead']
  };
  const titel = de ? 'Todesrettungswurf' : 'Death save';
  return { werte, ausgang, d20, text: `🎲 ${name} · ${titel}: ${d20} · ${wort[ausgang][de ? 0 : 1]}` };
}
