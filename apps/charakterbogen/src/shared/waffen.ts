/**
 * Waffenangriffe nach SRD 5.2 (docs/charakterbogen.md, „Waffenangriffe").
 *
 * Die Waffen kommen aus `@suite/srd/waffen` (Tabelle „Weapons" / „Waffen",
 * beide Sprachen gepaart; ein Test prueft alle 38).
 *
 * Gerechnet wird nach SRD: Angriff = Attributsmodifikator + Uebungsbonus
 * (wenn geuebt) + magischer Bonus. Nahkampf nimmt Staerke, Fernkampf
 * Geschicklichkeit, „Finesse" den besseren der beiden. Schaden = Wuerfel +
 * derselbe Modifikator + magischer Bonus; „Vielseitig" zweihaendig mit dem
 * groesseren Wuerfel. Ein kritischer Treffer (natuerliche 20) wuerfelt die
 * Schadenswuerfel doppelt.
 */
import { WAFFEN, waffeNach, type Waffe } from '@suite/srd/waffen';
import type { RandomSource } from '@suite/dice';
import { modifikator, type Attribut } from './regeln';
import type { Angriff, Bogen, Werte } from './bogen';
import { gesamtstufe } from './bogen';
import { uebungsbonus } from './regeln';

// Die Waffentabelle selbst liest @suite/srd/waffen (auch fuer den Homebrew Creator).
export { WAFFEN, waffeNach, type Waffe };

// --- Rechnen ----------------------------------------------------------------

/**
 * Jedes Attribut ist wählbar (Rückmeldung: Paktwaffe mit Charisma, Schillerndes
 * Schwert u. Ä.); „auto“ rechnet nach SRD mit Stärke oder Geschicklichkeit.
 */
export type AngriffsAttribut = 'auto' | Attribut;

/** Das Attribut, mit dem angegriffen wird. */
export function attributFuer(w: Werte, waffe: Waffe, wahl: AngriffsAttribut = 'auto'): Attribut {
  if (wahl !== 'auto') return wahl;
  if (waffe.fern) return 'ges';
  if (waffe.finesse) return w.attribute.ges > w.attribute.sta ? 'ges' : 'sta';
  return 'sta';
}

export interface Angriffswerte {
  /** Fester Bonus auf den Angriffswurf; null, wenn er sich nicht lesen laesst (freier Text). */
  readonly bonus: number | null;
  /** Wuerfelausdruck fuer den Schaden, z. B. „1d8+3"; leer, wenn unbekannt. */
  readonly schaden: string;
  /** Schadensart, sofern bekannt. */
  readonly art: string;
  readonly waffe: Waffe | null;
}

function mitZahl(ausdruck: string, zahl: number): string {
  if (!ausdruck) return '';
  if (zahl === 0) return ausdruck;
  if (/^\d+$/.test(ausdruck)) return String(Number(ausdruck) + zahl);
  return `${ausdruck}${zahl > 0 ? '+' : '-'}${Math.abs(zahl)}`;
}

/** Liest „+5", „5", „−1" als Zahl; sonst null. */
export function leseBonus(text: string): number | null {
  const roh = text.replace(/\s+/g, '').replace(/−/g, '-');
  if (!/^[+-]?\d{1,3}$/.test(roh)) return null;
  return Number(roh);
}

/** Werte eines Angriffs: mit Waffe gerechnet, sonst aus den freien Feldern. */
/**
 * Die Waffe eines Angriffs: eine SRD-Waffe nach Kennung oder die
 * mitgebrachten Werte einer eigenen (Homebrew Creator).
 */
export function waffeFuer(a: Pick<Angriff, 'waffe' | 'eigeneWaffe'> & { name?: string }): Waffe | null {
  if (a.eigeneWaffe) {
    const e = a.eigeneWaffe;
    return {
      id: a.waffe ?? 'eigen',
      name: [a.name ?? '', a.name ?? ''],
      kategorie: e.kategorie,
      fern: e.fern,
      wuerfel: e.wuerfel,
      vielseitig: e.vielseitig,
      art: e.art,
      finesse: e.finesse,
      eigenschaften: e.eigenschaften[0] || e.eigenschaften[1] ? e.eigenschaften : ['—', '—'],
      merkmale: [],
      reichweiteFern: null,
      meisterschaft: e.meisterschaft,
      meister: 'vex',
      gewicht: null,
      wert: null
    };
  }
  return waffeNach(a.waffe);
}

export function angriffswerte(w: Werte, a: Angriff, sprache: 'de' | 'en'): Angriffswerte {
  const i = sprache === 'de' ? 0 : 1;
  const waffe = waffeFuer(a);
  if (!waffe) {
    return { bonus: leseBonus(a.bonus), schaden: a.schaden.trim().toLowerCase().replace(/w/g, 'd').split(/\s+/)[0] ?? '', art: '', waffe: null };
  }
  const attr = attributFuer(w, waffe, a.attribut ?? 'auto');
  const mod = modifikator(w.attribute[attr]);
  const pb = uebungsbonus(gesamtstufe(w));
  const magie = a.magie ?? 0;
  const wuerfel = a.zweihaendig && waffe.vielseitig ? waffe.vielseitig : waffe.wuerfel;
  return {
    bonus: mod + (a.geuebt === false ? 0 : pb) + magie,
    schaden: mitZahl(wuerfel, mod + magie),
    art: waffe.art[i],
    waffe
  };
}

// --- Wuerfeln ---------------------------------------------------------------

export interface Wurfteil {
  readonly anzahl: number;
  readonly seiten: number;
  readonly wuerfe: readonly number[];
}

export interface Angriffswurf {
  readonly d20: number;
  readonly gesamt: number;
  readonly krit: boolean;
  readonly patzer: boolean;
  readonly schaden: number | null;
  /** Wie der Schaden zustande kam, lesbar: „1d8 [6] + 3". */
  readonly schadenText: string;
}

/**
 * Wuerfelt einen Ausdruck aus Summanden („1d8+1d6+3", „2d6-1", „1").
 * Bei `doppelt` (kritischer Treffer) werden alle Wuerfel zweimal geworfen.
 * Unlesbar → null.
 */
export function wuerfleAusdruck(ausdruck: string, rng: RandomSource = Math.random, doppelt = false): { summe: number; text: string } | null {
  const roh = ausdruck.replace(/\s+/g, '').toLowerCase().replace(/w/g, 'd').replace(/−/g, '-');
  if (!roh || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(roh)) return null;
  let summe = 0;
  const teile: string[] = [];
  for (const teil of roh.match(/[+-]?[^+-]+/g) ?? []) {
    const minus = teil.startsWith('-');
    const kern = teil.replace(/^[+-]/, '');
    let wert: number;
    let text: string;
    if (kern.includes('d')) {
      const [a, s] = kern.split('d');
      const anzahl = Math.min(100, Number(a || '1')) * (doppelt ? 2 : 1);
      const seiten = Number(s);
      if (!(anzahl > 0 && seiten > 1)) return null;
      const wuerfe = Array.from({ length: anzahl }, () => Math.floor(rng() * seiten) + 1);
      wert = wuerfe.reduce((x, y) => x + y, 0);
      text = `${anzahl}d${seiten} [${wuerfe.join(', ')}]`;
    } else {
      wert = Number(kern);
      text = kern;
    }
    summe += minus ? -wert : wert;
    teiles(teile, text, minus);
  }
  return { summe: Math.max(0, summe), text: teile.join(' ') };
}

function teiles(teile: string[], text: string, minus: boolean): void {
  teile.push(teile.length === 0 ? (minus ? `-${text}` : text) : `${minus ? '-' : '+'} ${text}`);
}

/** Was gewürfelt wird (Rückmeldung: drei Knöpfe). */
export type Wurfart = 'beides' | 'angriff' | 'schaden';

/** Angriffswurf und/oder Schaden. Ohne lesbaren Bonus zaehlt 0. */
export function wuerfleAngriff(werte: Angriffswerte, rng: RandomSource = Math.random, art: Wurfart = 'beides'): Angriffswurf {
  const mitAngriff = art === 'beides' || art === 'angriff';
  const d20 = mitAngriff ? Math.floor(rng() * 20) + 1 : 0;
  const krit = d20 === 20;
  const schaden = art !== 'angriff' && werte.schaden ? wuerfleAusdruck(werte.schaden, rng, krit) : null;
  return {
    d20,
    gesamt: mitAngriff ? d20 + (werte.bonus ?? 0) : 0,
    krit: d20 === 20,
    patzer: d20 === 1,
    schaden: schaden ? schaden.summe : null,
    schadenText: schaden ? schaden.text : ''
  };
}

/** Eine Chatzeile fuer den Raum. */
export function wurfZeile(name: string, werte: Angriffswerte, wurf: Angriffswurf, sprache: 'de' | 'en'): string {
  const de = sprache === 'de';
  const vorzeichen = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
  const schaden =
    wurf.schaden !== null ? `${de ? 'Schaden' : 'Damage'} ${wurf.schaden}${werte.art ? ` ${werte.art}` : ''} (${wurf.schadenText})` : '';
  // Nur Schaden: kein d20 gewürfelt.
  if (wurf.d20 === 0) return `⚔ ${name} · ${schaden || (de ? 'kein Schaden' : 'no damage')}`;
  const angriff = `${wurf.gesamt} (d20 ${wurf.d20}${werte.bonus ? ` ${vorzeichen(werte.bonus)}` : ''})`;
  const zusatz = wurf.krit ? (de ? ' · KRITISCH' : ' · CRITICAL') : wurf.patzer ? (de ? ' · Patzer' : ' · miss') : '';
  return `⚔ ${name}: ${angriff}${zusatz}${schaden ? ` · ${schaden}` : ''}`;
}

// --- Aus dem Inventar -------------------------------------------------------

/**
 * Angriffe aus ausgeruesteten Waffen im Inventar. Sie stehen nicht im Bogen,
 * sondern werden jedes Mal daraus gerechnet: wer die Waffe weggibt oder
 * ablegt, verliert den Angriff von selbst.
 */
export function angriffeAusInventar(b: Bogen): Angriff[] {
  return b.gegenstaende.flatMap((g) =>
    g.waffe && g.ausgeruestet && (g.waffe.eigen || waffeNach(g.waffe.id))
      ? [
          {
            name: g.name,
            bonus: '',
            schaden: '',
            notiz: '',
            waffe: g.waffe.id,
            magie: g.waffe.magie,
            geuebt: g.waffe.geuebt,
            attribut: 'auto' as const,
            ausInventar: g.id,
            ...(g.waffe.eigen ? { eigeneWaffe: g.waffe.eigen } : {})
          }
        ]
      : []
  );
}
