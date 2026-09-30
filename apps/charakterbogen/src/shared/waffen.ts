/**
 * Waffenangriffe nach SRD 5.2 (docs/charakterbogen.md, „Waffenangriffe").
 *
 * Die Waffen kommen aus der Tabelle „Weapons" / „Waffen" in
 * `@suite/srd/ausruestung`. Beide Sprachen sind dort je fuer sich
 * alphabetisch sortiert; gepaart wird ueber Gruppe, Schadenswuerfel,
 * Schadensart, Preis und Meisterschaft. Das ist fuer alle 38 Waffen
 * eindeutig (ein Test prueft es).
 *
 * Gerechnet wird nach SRD: Angriff = Attributsmodifikator + Uebungsbonus
 * (wenn geuebt) + magischer Bonus. Nahkampf nimmt Staerke, Fernkampf
 * Geschicklichkeit, „Finesse" den besseren der beiden. Schaden = Wuerfel +
 * derselbe Modifikator + magischer Bonus; „Vielseitig" zweihaendig mit dem
 * groesseren Wuerfel. Ein kritischer Treffer (natuerliche 20) wuerfelt die
 * Schadenswuerfel doppelt.
 */
import { AUSRUESTUNG } from '@suite/srd/ausruestung';
import type { RandomSource } from '@suite/dice';
import { modifikator, type Attribut } from './regeln';
import type { Angriff, Bogen, Werte } from './bogen';
import { gesamtstufe } from './bogen';
import { uebungsbonus } from './regeln';

export interface Waffe {
  /** Aus dem englischen Namen: „longsword", „light-crossbow". */
  readonly id: string;
  readonly name: readonly [string, string];
  readonly kategorie: 'einfach' | 'kriegs';
  readonly fern: boolean;
  /** „1d8"; beim Blasrohr „1". */
  readonly wuerfel: string;
  /** Bei „Vielseitig": der Wuerfel zweihaendig. */
  readonly vielseitig: string | null;
  readonly art: readonly [string, string];
  readonly finesse: boolean;
  readonly eigenschaften: readonly [string, string];
  readonly meisterschaft: readonly [string, string];
  /** lb, null wenn keines angegeben. */
  readonly gewicht: number | null;
  /** GM. */
  readonly wert: number | null;
}

const MEISTER: Record<string, string> = {
  Nick: 'Einkerben',
  Vex: 'Plagen',
  Slow: 'Verlangsamen',
  Sap: 'Auslaugen',
  Topple: 'Umstoßen',
  Push: 'Stoßen',
  Graze: 'Streifen',
  Cleave: 'Spalten'
};
const ART: Record<string, string> = { Piercing: 'Stich', Slashing: 'Hieb', Bludgeoning: 'Wucht' };

type Reihe = readonly string[];

function tabelle(sprache: 'de' | 'en'): Reihe[] {
  const eintrag = AUSRUESTUNG.find((e) => e.id === 'weapons');
  const block = eintrag?.bloecke[sprache].find(
    (b) => b.typ === 'tabelle' && (b as { titel?: string }).titel === (sprache === 'de' ? 'Waffen' : 'Weapons')
  ) as { reihen?: Reihe[] } | undefined;
  return block?.reihen ?? [];
}

/** Gruppe je Reihe: Ueberschriftzeilen (leere Spalten) zaehlen hoch. */
function mitGruppe(reihen: Reihe[]): { gruppe: number; r: Reihe }[] {
  let gruppe = -1;
  return reihen.flatMap((r) => {
    if (!r[1]) {
      gruppe += 1;
      return [];
    }
    return [{ gruppe, r }];
  });
}

function wuerfelAus(schaden: string): string {
  return schaden.split(/\s+/)[0].toLowerCase().replace('w', 'd');
}

function preisInGold(text: string): number | null {
  const m = /^([\d.,]+)\s*(GP|SP|CP|GM|SM|KM|PP|PM|EP|EM)$/i.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const faktor: Record<string, number> = { GP: 1, GM: 1, SP: 0.1, SM: 0.1, CP: 0.01, KM: 0.01, PP: 10, PM: 10, EP: 0.5, EM: 0.5 };
  return Math.round(n * faktor[m[2].toUpperCase()] * 100) / 100;
}

function gewichtLb(text: string): number | null {
  const m = /^([\d/.]+)\s*lb/.exec(text.trim());
  if (!m) return null;
  const [a, b] = m[1].split('/');
  return b ? Number(a) / Number(b) : Number(a);
}

function schluessel(gruppe: number, r: Reihe, de: boolean): string {
  const [wuerfel, art] = r[1].split(/\s+/);
  const kosten = r[5].replace('GM', 'GP').replace('SM', 'SP').replace('KM', 'CP');
  const artDe = de ? art : ART[art] ?? art;
  const meister = de ? r[3] : MEISTER[r[3]] ?? r[3];
  return [gruppe, wuerfel.toLowerCase().replace('w', 'd'), artDe, kosten, meister].join('|');
}

function zuId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function lies(): Waffe[] {
  const de = new Map(mitGruppe(tabelle('de')).map(({ gruppe, r }) => [schluessel(gruppe, r, true), r]));
  return mitGruppe(tabelle('en')).flatMap(({ gruppe, r }) => {
    const d = de.get(schluessel(gruppe, r, false));
    if (!d) return [];
    const vielseitig = /Versatile \((\d+d\d+)\)/.exec(r[2]);
    return [
      {
        id: zuId(r[0]),
        name: [d[0], r[0]] as const,
        kategorie: gruppe < 2 ? ('einfach' as const) : ('kriegs' as const),
        fern: gruppe === 1 || gruppe === 3,
        wuerfel: wuerfelAus(r[1]),
        vielseitig: vielseitig ? vielseitig[1] : null,
        art: [d[1].split(/\s+/)[1] ?? '', r[1].split(/\s+/)[1] ?? ''] as const,
        finesse: /\bFinesse\b/.test(r[2]),
        eigenschaften: [d[2], r[2]] as const,
        meisterschaft: [d[3], r[3]] as const,
        gewicht: gewichtLb(r[4]),
        wert: preisInGold(r[5])
      }
    ];
  });
}

export const WAFFEN: readonly Waffe[] = lies();
const NACH_ID = new Map(WAFFEN.map((w) => [w.id, w]));

export function waffeNach(id: string | undefined | null): Waffe | null {
  return id ? NACH_ID.get(id) ?? null : null;
}

// --- Rechnen ----------------------------------------------------------------

export type AngriffsAttribut = 'auto' | Extract<Attribut, 'sta' | 'ges'>;

/** Das Attribut, mit dem angegriffen wird. */
export function attributFuer(w: Werte, waffe: Waffe, wahl: AngriffsAttribut = 'auto'): 'sta' | 'ges' {
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
export function angriffswerte(w: Werte, a: Angriff, sprache: 'de' | 'en'): Angriffswerte {
  const i = sprache === 'de' ? 0 : 1;
  const waffe = waffeNach(a.waffe);
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

/** Angriffswurf und Schaden. Ohne lesbaren Bonus zaehlt 0. */
export function wuerfleAngriff(werte: Angriffswerte, rng: RandomSource = Math.random): Angriffswurf {
  const d20 = Math.floor(rng() * 20) + 1;
  const krit = d20 === 20;
  const schaden = werte.schaden ? wuerfleAusdruck(werte.schaden, rng, krit) : null;
  return {
    d20,
    gesamt: d20 + (werte.bonus ?? 0),
    krit,
    patzer: d20 === 1,
    schaden: schaden ? schaden.summe : null,
    schadenText: schaden ? schaden.text : ''
  };
}

/** Eine Chatzeile fuer den Raum. */
export function wurfZeile(name: string, werte: Angriffswerte, wurf: Angriffswurf, sprache: 'de' | 'en'): string {
  const de = sprache === 'de';
  const vorzeichen = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
  const angriff = `${wurf.gesamt} (d20 ${wurf.d20}${werte.bonus ? ` ${vorzeichen(werte.bonus)}` : ''})`;
  const zusatz = wurf.krit ? (de ? ' · KRITISCH' : ' · CRITICAL') : wurf.patzer ? (de ? ' · Patzer' : ' · miss') : '';
  const schaden =
    wurf.schaden !== null ? ` · ${de ? 'Schaden' : 'Damage'} ${wurf.schaden}${werte.art ? ` ${werte.art}` : ''} (${wurf.schadenText})` : '';
  return `⚔ ${name}: ${angriff}${zusatz}${schaden}`;
}

// --- Aus dem Inventar -------------------------------------------------------

/**
 * Angriffe aus ausgeruesteten Waffen im Inventar. Sie stehen nicht im Bogen,
 * sondern werden jedes Mal daraus gerechnet: wer die Waffe weggibt oder
 * ablegt, verliert den Angriff von selbst.
 */
export function angriffeAusInventar(b: Bogen): Angriff[] {
  return b.gegenstaende.flatMap((g) =>
    g.waffe && g.ausgeruestet && waffeNach(g.waffe.id)
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
            ausInventar: g.id
          }
        ]
      : []
  );
}
