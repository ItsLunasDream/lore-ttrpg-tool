/**
 * Eichung von Waffen und Ruestungen am SRD 5.2.1 (docs/homebrew-creator.md).
 *
 * KEINE FORMEL. Das SRD ist nicht ganz regelmaessig (die Handaxt, leicht und
 * Wurfwaffe, macht 1W6; die Sichel, nur leicht, 1W4). Eine starre Regel
 * wuerde deshalb SRD-Waffen selbst als zu stark melden. Statt dessen:
 *
 * - Waffen: Vergleich mit den SRD-Waffen derselben Kategorie (einfach/
 *   Kriegswaffe) und derselben Art (Nah/Fern), die in den Merkmalen am
 *   aehnlichsten sind. Deren Schaden ist das Band. Ein Leave-one-out-Test
 *   (tests/eichung.test.mjs) haelt fest, wie viele SRD-Waffen diese
 *   Pruefung gegen die uebrigen bestehen.
 * - Ruestungen: Vergleich mit den SRD-Ruestungen derselben Art. Hoehere RK
 *   als die beste, oder gleiche RK mit weniger Nachteilen, wird gemeldet.
 * - Magischer Bonus: Seltenheit aus den Eichpunkten des Magic Item
 *   Generators (@suite/magie): Waffe +1 ungewoehnlich, +2 selten, +3 sehr
 *   selten; Ruestung +1 selten, +2 sehr selten, +3 legendaer.
 *
 * Die Eichung verbietet nichts; sie sagt, wo der Eintrag im SRD steht.
 */
import type { Paar, Seltenheit } from '@suite/srd';
import { RUESTUNGEN, WAFFEN, schnittVon, type Ruestung as SrdRuestung, type Waffe as SrdWaffe, type WaffenEigenschaft } from '@suite/srd/waffen';
import { EICHPUNKTE } from '@suite/magie/eichpunkte';
import type { Ruestung, Waffe } from './modell';

export type Urteil = 'im_rahmen' | 'unter' | 'ueber' | 'weit_ueber';

export interface Befund {
  readonly stufe: 'hinweis' | 'warnung';
  readonly text: Paar;
}

export interface Eichung<T> {
  readonly urteil: Urteil;
  /** Was das Urteil in einem Satz sagt. */
  readonly satz: Paar;
  /** Die SRD-Eintraege, mit denen verglichen wurde. */
  readonly vergleich: readonly T[];
  readonly befunde: readonly Befund[];
  /** Seltenheit, die der magische Bonus verlangt; null ohne Bonus. */
  readonly seltenheit: Seltenheit | null;
}

/** Merkmale, die den Schaden einer Waffe bestimmen (Meisterschaft zaehlt nicht). */
const SCHADENSMERKMALE: readonly WaffenEigenschaft[] = ['leicht', 'schwer', 'zweihaendig', 'vielseitig', 'finesse', 'reichweite', 'wurf', 'laden', 'munition'];

function aehnlichkeit(a: readonly WaffenEigenschaft[], b: readonly WaffenEigenschaft[]): number {
  const A = new Set(a.filter((x) => SCHADENSMERKMALE.includes(x)));
  const B = new Set(b.filter((x) => SCHADENSMERKMALE.includes(x)));
  const vereint = new Set([...A, ...B]);
  if (vereint.size === 0) return 1;
  let gemeinsam = 0;
  for (const x of A) if (B.has(x)) gemeinsam += 1;
  return gemeinsam / vereint.size;
}

function seltenheitFuer(wirkung: 'waffe-bonus' | 'ruestung-bonus', bonus: number): Seltenheit | null {
  if (bonus <= 0) return null;
  const p = EICHPUNKTE.find((e) => e.wirkung === wirkung && e.bonus === bonus);
  return p ? p.seltenheit : null;
}

/** Eine Wuerfelstufe: 1W6 → 1W8 hebt den Schnitt um 1. */
export const SPIELRAUM = 1;

function zahlText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.0', '');
}

/** Eckdaten einer Waffe, wie die Eichung sie braucht; auch fuer SRD-Waffen. */
export interface Waffenkern {
  readonly kategorie: 'einfach' | 'kriegs';
  readonly fern: boolean;
  readonly wuerfel: string;
  readonly merkmale: readonly WaffenEigenschaft[];
}

/**
 * Das Band fuer eine Waffe: die aehnlichsten SRD-Waffen derselben Gruppe.
 * `ohne`: eine SRD-Waffe auslassen (Leave-one-out im Test).
 */
export function waffenBand(w: Waffenkern, ohne?: string): { min: number; max: number; gruppenMax: number; vergleich: SrdWaffe[] } {
  const gruppe = WAFFEN.filter((x) => x.kategorie === w.kategorie && x.fern === w.fern && x.id !== ohne);
  let beste = -1;
  let vergleich: SrdWaffe[] = [];
  for (const x of gruppe) {
    const a = aehnlichkeit(w.merkmale, x.merkmale);
    if (a > beste + 1e-9) {
      beste = a;
      vergleich = [x];
    } else if (Math.abs(a - beste) < 1e-9) vergleich.push(x);
  }
  const schnitte = vergleich.map((x) => schnittVon(x.wuerfel) ?? 0);
  return {
    min: Math.min(...schnitte),
    max: Math.max(...schnitte),
    gruppenMax: Math.max(...gruppe.map((x) => schnittVon(x.wuerfel) ?? 0)),
    vergleich
  };
}

export function urteilWaffe(w: Waffenkern, ohne?: string): { urteil: Urteil; schnitt: number; band: ReturnType<typeof waffenBand> } {
  const schnitt = schnittVon(w.wuerfel) ?? 0;
  const band = waffenBand(w, ohne);
  // Eine Wuerfelstufe (im Schnitt +1) Spielraum: das SRD selbst weicht so
  // weit ab (Handaxt 1W6, leichter Hammer 1W4, gleiche Merkmale).
  const urteil: Urteil =
    schnitt > band.gruppenMax + SPIELRAUM
      ? 'weit_ueber'
      : schnitt > band.max + SPIELRAUM
        ? 'ueber'
        : schnitt < band.min - SPIELRAUM
          ? 'unter'
          : 'im_rahmen';
  return { urteil, schnitt, band };
}

export function eicheWaffe(w: Waffe): Eichung<SrdWaffe> {
  const { urteil, schnitt, band } = urteilWaffe({ kategorie: w.kategorie, fern: w.fern, wuerfel: w.wuerfel, merkmale: w.eigenschaften });
  const bandText = band.min === band.max ? zahlText(band.min) : `${zahlText(band.min)}–${zahlText(band.max)}`;
  const namen = (s: 'de' | 'en') => band.vergleich.map((x) => x.name[s === 'de' ? 0 : 1]).join(', ');
  const satz: Paar = {
    im_rahmen: {
      de: `Schaden im Schnitt ${zahlText(schnitt)}, im Rahmen der ähnlichsten SRD-Waffen (${bandText}: ${namen('de')}).`,
      en: `Average damage ${zahlText(schnitt)}, within the most similar SRD weapons (${bandText}: ${namen('en')}).`
    },
    unter: {
      de: `Schaden im Schnitt ${zahlText(schnitt)}, schwächer als die ähnlichsten SRD-Waffen (${bandText}: ${namen('de')}).`,
      en: `Average damage ${zahlText(schnitt)}, weaker than the most similar SRD weapons (${bandText}: ${namen('en')}).`
    },
    ueber: {
      de: `Schaden im Schnitt ${zahlText(schnitt)}, stärker als die ähnlichsten SRD-Waffen (${bandText}: ${namen('de')}).`,
      en: `Average damage ${zahlText(schnitt)}, stronger than the most similar SRD weapons (${bandText}: ${namen('en')}).`
    },
    weit_ueber: {
      de: `Schaden im Schnitt ${zahlText(schnitt)}, stärker als jede SRD-Waffe dieser Gruppe (höchstens ${zahlText(band.gruppenMax)}).`,
      en: `Average damage ${zahlText(schnitt)}, stronger than any SRD weapon in this group (at most ${zahlText(band.gruppenMax)}).`
    }
  }[urteil];

  const e = new Set(w.eigenschaften);
  const befunde: Befund[] = [];
  const warn = (de: string, en: string) => befunde.push({ stufe: 'warnung', text: { de, en } });
  const hin = (de: string, en: string) => befunde.push({ stufe: 'hinweis', text: { de, en } });
  if (schnittVon(w.wuerfel) === null) warn('Der Schadenswürfel ist nicht lesbar (z. B. „1d8").', 'The damage die cannot be read (e.g. “1d8”).');
  if (e.has('leicht') && e.has('zweihaendig')) warn('Leicht und zweihändig zugleich: keine SRD-Waffe ist beides.', 'Light and two-handed at once: no SRD weapon is both.');
  if (e.has('leicht') && e.has('schwer')) warn('Leicht und schwer zugleich widerspricht sich.', 'Light and heavy at once contradict each other.');
  if (e.has('vielseitig') && e.has('zweihaendig')) warn('Vielseitig heißt ein- oder zweihändig; zusammen mit „zweihändig" ergibt das keinen Sinn.', 'Versatile means one- or two-handed; together with “two-handed” it makes no sense.');
  if (e.has('vielseitig')) {
    const ein = schnittVon(w.wuerfel) ?? 0;
    const zwei = schnittVon(w.vielseitig) ?? 0;
    if (zwei <= ein) warn('Der zweihändige Würfel (vielseitig) sollte größer sein als der einhändige.', 'The two-handed die (versatile) should be larger than the one-handed one.');
    else if (zwei - ein > 1.01) hin('Im SRD ist der vielseitige Würfel genau eine Stufe größer (1W8 → 1W10).', 'In the SRD the versatile die is exactly one step larger (1d8 → 1d10).');
  }
  if ((e.has('wurf') || e.has('munition')) && !(w.reichweiteNormal > 0 && w.reichweiteMax >= w.reichweiteNormal))
    warn('Die Reichweite braucht zwei Zahlen, die zweite mindestens so groß wie die erste.', 'Range needs two numbers, the second at least as large as the first.');
  if (w.fern && !e.has('munition')) hin('Alle SRD-Fernkampfwaffen haben „Munition".', 'All SRD ranged weapons have “Ammunition”.');
  if (!w.fern && e.has('munition')) hin('„Munition" haben im SRD nur Fernkampfwaffen.', 'In the SRD only ranged weapons have “Ammunition”.');
  if (e.has('finesse') && e.has('schwer')) hin('Keine SRD-Waffe ist zugleich Finesse und schwer.', 'No SRD weapon is both finesse and heavy.');
  if (e.has('laden') && !e.has('munition')) hin('„Laden" gibt es im SRD nur bei Waffen mit Munition.', 'In the SRD “Loading” only appears with “Ammunition”.');
  const preise = band.vergleich.map((x) => x.wert).filter((p): p is number => p !== null);
  if (w.preis !== null && preise.length) {
    const lo = Math.min(...preise);
    const hi = Math.max(...preise);
    if (w.preis < lo / 2 || w.preis > hi * 2)
      hin(`Preis weit weg von den Vergleichswaffen (${lo}–${hi} GM).`, `Price far from the comparable weapons (${lo}–${hi} GP).`);
  }
  return { urteil, satz, vergleich: band.vergleich, befunde, seltenheit: seltenheitFuer('waffe-bonus', w.bonus) };
}

/** Eckdaten einer Ruestung fuer die Eichung; auch fuer SRD-Ruestungen. */
export interface Ruestungskern {
  readonly art: SrdRuestung['art'];
  readonly rk: number;
  readonly staerke: number | null;
  readonly heimlichkeitNachteil: boolean;
  readonly wert: number | null;
}

export function urteilRuestung(r: Ruestungskern, ohne?: string): { urteil: Urteil; gleich: SrdRuestung[]; gruppe: SrdRuestung[]; besserAls: SrdRuestung[] } {
  const gruppe = RUESTUNGEN.filter((x) => x.art === r.art && x.id !== ohne);
  if (!gruppe.length) return { urteil: 'im_rahmen', gleich: [], gruppe, besserAls: [] };
  const max = Math.max(...gruppe.map((x) => x.rk));
  const min = Math.min(...gruppe.map((x) => x.rk));
  const gleich = gruppe.filter((x) => x.rk === r.rk);
  // „Besser als X": gleiche RK, in keinem Punkt schlechter, in einem besser,
  // und nicht teurer. Im SRD selbst kostet die Ruestung ohne Nachteil mehr
  // (Lederruestung 10 GM gegen gepolsterte 5 GM); das ist der Ausgleich.
  const besserAls = gleich.filter((x) => {
    const st = (r.staerke ?? 0) <= (x.staerke ?? 0);
    const hm = !r.heimlichkeitNachteil || x.heimlichkeitNachteil;
    const echtBesser = (r.staerke ?? 0) < (x.staerke ?? 0) || (!r.heimlichkeitNachteil && x.heimlichkeitNachteil);
    const nichtTeurer = r.wert === null || x.wert === null || r.wert <= x.wert;
    return st && hm && echtBesser && nichtTeurer;
  });
  // Nur „ueber", wenn es KEINE SRD-Ruestung mit gleicher RK gibt, die genauso
  // gut ist (dann ist der Eintrag nichts Neues).
  const gleichGut = gleich.some(
    (x) =>
      (x.staerke ?? 0) <= (r.staerke ?? 0) &&
      (!x.heimlichkeitNachteil || r.heimlichkeitNachteil) &&
      (x.wert === null || r.wert === null || x.wert <= r.wert)
  );
  // Eine RK ueber der besten SRD-Ruestung ist „ueber", mehr als eine „weit ueber".
  const urteil: Urteil =
    r.rk > max + 1 ? 'weit_ueber' : r.rk > max ? 'ueber' : r.rk < min ? 'unter' : besserAls.length && !gleichGut ? 'ueber' : 'im_rahmen';
  return { urteil, gleich, gruppe, besserAls };
}

export function eicheRuestung(r: Ruestung): Eichung<SrdRuestung> {
  const kern: Ruestungskern = { art: r.ruestungsart, rk: r.rk, staerke: r.staerke || null, heimlichkeitNachteil: r.heimlichkeitNachteil, wert: r.preis };
  const { urteil, gleich, gruppe, besserAls } = urteilRuestung(kern);
  const max = Math.max(...gruppe.map((x) => x.rk));
  const namen = (liste: SrdRuestung[], s: 'de' | 'en') => liste.map((x) => x.name[s === 'de' ? 0 : 1]).join(', ');
  const satz: Paar = {
    im_rahmen: gleich.length
      ? { de: `RK ${r.rk} wie ${namen(gleich, 'de')}.`, en: `AC ${r.rk} like ${namen(gleich, 'en')}.` }
      : { de: `RK ${r.rk} liegt zwischen den SRD-Rüstungen dieser Art.`, en: `AC ${r.rk} lies between the SRD armors of this kind.` },
    unter: { de: `RK ${r.rk} unter jeder SRD-Rüstung dieser Art.`, en: `AC ${r.rk} below every SRD armor of this kind.` },
    ueber:
      r.rk > max
        ? { de: `RK ${r.rk}, eins über der besten SRD-Rüstung dieser Art (${max}).`, en: `AC ${r.rk}, one above the best SRD armor of this kind (${max}).` }
        : {
            de: `RK ${r.rk} wie ${namen(besserAls, 'de')}, aber mit weniger Nachteilen und nicht teurer.`,
            en: `AC ${r.rk} like ${namen(besserAls, 'en')}, but with fewer drawbacks and no higher price.`
          },
    weit_ueber: {
      de: `RK ${r.rk} über jeder SRD-Rüstung dieser Art (höchstens ${max}).`,
      en: `AC ${r.rk} above every SRD armor of this kind (at most ${max}).`
    }
  }[urteil];
  const befunde: Befund[] = [];
  const preise = (gleich.length ? gleich : gruppe).map((x) => x.wert).filter((p): p is number => p !== null);
  if (r.preis !== null && preise.length && r.preis < Math.min(...preise) / 2)
    befunde.push({
      stufe: 'hinweis',
      text: { de: `Deutlich billiger als vergleichbare SRD-Rüstungen (ab ${Math.min(...preise)} GM).`, en: `Much cheaper than comparable SRD armor (from ${Math.min(...preise)} GP).` }
    });
  if (r.ruestungsart === 'schwer' && r.rk >= 16 && !r.staerke)
    befunde.push({
      stufe: 'hinweis',
      text: { de: 'Schwere SRD-Rüstungen ab RK 16 verlangen Stärke 13 oder 15.', en: 'Heavy SRD armor from AC 16 requires Strength 13 or 15.' }
    });
  if (r.ruestungsart === 'leicht' && r.staerke)
    befunde.push({ stufe: 'hinweis', text: { de: 'Keine leichte SRD-Rüstung verlangt Stärke.', en: 'No light SRD armor requires Strength.' } });
  return { urteil, satz, vergleich: gleich.length ? gleich : gruppe, befunde, seltenheit: seltenheitFuer('ruestung-bonus', r.bonus) };
}
