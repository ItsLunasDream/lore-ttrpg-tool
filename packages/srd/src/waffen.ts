/**
 * Waffen und Rüstungen des SRD 5.2.1 als Daten, gelesen aus den Tabellen
 * „Weapons" / „Waffen" und „Armor" / „Rüstung" in `ausruestung.ts`.
 *
 * Beide Sprachen sind dort je fuer sich alphabetisch sortiert; gepaart wird
 * bei den Waffen ueber Gruppe, Schadenswuerfel, Schadensart, Preis und
 * Meisterschaft, bei den Ruestungen ueber die Reihenfolge innerhalb der
 * Gruppe (beide Tabellen stehen in derselben Folge). Die Tests pruefen,
 * dass alle 38 Waffen und 13 Ruestungen gepaart werden.
 *
 * Genutzt vom Charakterbogen (Angriffe) und vom Homebrew Creator (Eichung).
 */
import { AUSRUESTUNG } from './ausruestung';

export type WaffenEigenschaft =
  | 'finesse'
  | 'leicht'
  | 'schwer'
  | 'zweihaendig'
  | 'vielseitig'
  | 'reichweite'
  | 'wurf'
  | 'munition'
  | 'laden';

export const WAFFEN_EIGENSCHAFTEN: readonly WaffenEigenschaft[] = [
  'finesse',
  'leicht',
  'schwer',
  'zweihaendig',
  'vielseitig',
  'reichweite',
  'wurf',
  'munition',
  'laden'
];

const EIGENSCHAFT_EN: Record<WaffenEigenschaft, RegExp> = {
  finesse: /\bFinesse\b/,
  leicht: /\bLight\b/,
  schwer: /\bHeavy\b/,
  zweihaendig: /\bTwo-Handed\b/,
  vielseitig: /\bVersatile\b/,
  reichweite: /\bReach\b/,
  wurf: /\bThrown\b/,
  munition: /\bAmmunition\b/,
  laden: /\bLoading\b/
};

export type Meisterschaft = 'nick' | 'vex' | 'slow' | 'sap' | 'topple' | 'push' | 'graze' | 'cleave';
export const MEISTERSCHAFTEN: readonly Meisterschaft[] = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'];

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
  /** Der Text der Eigenschaften, wie gedruckt. */
  readonly eigenschaften: readonly [string, string];
  /** Maschinenlesbar. */
  readonly merkmale: readonly WaffenEigenschaft[];
  /** Reichweite bei Wurf- und Munitionswaffen, in Fuss. */
  readonly reichweiteFern: { readonly normal: number; readonly max: number } | null;
  readonly meisterschaft: readonly [string, string];
  readonly meister: Meisterschaft;
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

function tabelle(id: string, titel: Record<'de' | 'en', string>, sprache: 'de' | 'en'): Reihe[] {
  const eintrag = AUSRUESTUNG.find((e) => e.id === id);
  const block = eintrag?.bloecke[sprache].find(
    (b) => b.typ === 'tabelle' && (b as { titel?: string }).titel === titel[sprache]
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

/** „15 GP", „1,500 GP", „1.500 GM", „5 CP" → Gold. */
export function preisInGold(text: string): number | null {
  const m = /^([\d.,]+)\s*(GP|SP|CP|GM|SM|KM|PP|PM|EP|EM)$/i.exec(text.trim());
  if (!m) return null;
  const roh = m[1];
  // Tausendertrenner: „1,500" (en) und „1.500" (de); ein Komma mit einer
  // oder zwei Stellen dahinter ist ein Dezimalkomma.
  const n = /^\d{1,3}([.,]\d{3})+$/.test(roh) ? Number(roh.replace(/[.,]/g, '')) : Number(roh.replace(',', '.'));
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

function liesWaffen(): Waffe[] {
  const titel = { de: 'Waffen', en: 'Weapons' };
  const de = new Map(mitGruppe(tabelle('weapons', titel, 'de')).map(({ gruppe, r }) => [schluessel(gruppe, r, true), r]));
  return mitGruppe(tabelle('weapons', titel, 'en')).flatMap(({ gruppe, r }) => {
    const d = de.get(schluessel(gruppe, r, false));
    if (!d) return [];
    const vielseitig = /Versatile \((\d+d\d+)\)/.exec(r[2]);
    const fernweite = /Range (\d+)\/(\d+)/.exec(r[2]);
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
        merkmale: WAFFEN_EIGENSCHAFTEN.filter((e) => EIGENSCHAFT_EN[e].test(r[2])),
        reichweiteFern: fernweite ? { normal: Number(fernweite[1]), max: Number(fernweite[2]) } : null,
        meisterschaft: [d[3], r[3]] as const,
        meister: r[3].toLowerCase() as Meisterschaft,
        gewicht: gewichtLb(r[4]),
        wert: preisInGold(r[5])
      }
    ];
  });
}

export const WAFFEN: readonly Waffe[] = liesWaffen();
const WAFFE_NACH_ID = new Map(WAFFEN.map((w) => [w.id, w]));

export function waffeNach(id: string | undefined | null): Waffe | null {
  return id ? WAFFE_NACH_ID.get(id) ?? null : null;
}

// --- Ruestungen ---------------------------------------------------------------

export type RuestungsArt = 'leicht' | 'mittel' | 'schwer' | 'schild';
export const RUESTUNGSARTEN: readonly RuestungsArt[] = ['leicht', 'mittel', 'schwer', 'schild'];

export interface Ruestung {
  readonly id: string;
  readonly name: readonly [string, string];
  readonly art: RuestungsArt;
  /** Grundwert der RK; beim Schild der Bonus (2). */
  readonly rk: number;
  /** Wie viel GES dazukommt: voll (leicht), hoechstens 2 (mittel), nichts (schwer, Schild). */
  readonly ges: 'voll' | 'max2' | 'kein';
  /** Stärke-Anforderung, null wenn keine. */
  readonly staerke: number | null;
  readonly heimlichkeitNachteil: boolean;
  readonly gewicht: number | null;
  readonly wert: number | null;
}

const ART_DER_GRUPPE: readonly RuestungsArt[] = ['leicht', 'mittel', 'schwer', 'schild'];

function liesRuestungen(): Ruestung[] {
  const titel = { de: 'Rüstung', en: 'Armor' };
  const en = mitGruppe(tabelle('armor', titel, 'en'));
  const de = mitGruppe(tabelle('armor', titel, 'de'));
  if (en.length !== de.length) return [];
  return en.map(({ gruppe, r }, i) => {
    const art = ART_DER_GRUPPE[gruppe] ?? 'schwer';
    const zahl = /([+]?\d+)/.exec(r[1]);
    const staerke = /Str (\d+)/.exec(r[2]);
    return {
      id: zuId(r[0]),
      name: [de[i].r[0], r[0]] as const,
      art,
      rk: zahl ? Math.abs(Number(zahl[1])) : 0,
      ges: art === 'leicht' ? ('voll' as const) : art === 'mittel' ? ('max2' as const) : ('kein' as const),
      staerke: staerke ? Number(staerke[1]) : null,
      heimlichkeitNachteil: /Disadvantage/.test(r[3]),
      gewicht: gewichtLb(r[4]),
      wert: preisInGold(r[5])
    };
  });
}

export const RUESTUNGEN: readonly Ruestung[] = liesRuestungen();

/** Durchschnitt eines Wuerfelausdrucks wie „2d6" oder „1"; null, wenn unlesbar. */
export function schnittVon(ausdruck: string): number | null {
  const m = /^(\d+)(?:d(\d+))?$/.exec(ausdruck.trim().toLowerCase().replace('w', 'd'));
  if (!m) return null;
  return m[2] ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 : Number(m[1]);
}
