/**
 * Aus den Tabellen wird ein Ort (docs/ortsgenerator.md).
 *
 * Wie im NPC Creator: reine Funktionen mit übergebenem Zufallsgeber, der Ort
 * trägt fertige Texte in der Sprache, in der gewürfelt wurde, und einzelne
 * Teile lassen sich festhalten und neu würfeln. Personen kommen aus dem
 * Erzeuger des NPC Creators, damit sie dort weiterbearbeitet werden können.
 *
 * Waren und Preise kommen aus dem SRD (@suite/srd): Waffen, Rüstungen und
 * Abenteurerausrüstung mit ihren Preisen, magische Gegenstände mit dem Wert
 * ihrer Seltenheit. Welche Läden es wo gibt, ist eine Annahme (tabellen.ts).
 */
import { gegenstandswert, type Seltenheit } from '@suite/srd';
import { MAGISCHE_GEGENSTAENDE } from '@suite/srd/magische-gegenstaende';
import { RUESTUNGEN, WAFFEN } from '@suite/srd/waffen';
import { umgebungNach } from '@suite/umgebungen';
// Quer in andere Werkzeuge: dieselben Personen wie im NPC Creator, dieselbe
// Liste der SRD-Ausrüstung wie im Charakterbogen. Nur reine Module, kein
// Electron; die Werkzeuge bleiben einzeln lauffähig.
import { erzeugeFigur, STANDARD_WUENSCHE as NPC_WUENSCHE, type Figur, type Namensklang } from '../../../npc/src/shared/erzeuge';
import { srdAusruestung } from '../../../charakterbogen/src/shared/quellen';
import {
  ALCHEMIE_WAREN,
  BESONDERHEIT,
  EINWOHNER,
  GASTHAUS_ADJEKTIV,
  GASTHAUS_NOMEN,
  GASTHAUS_QUALITAET,
  GERUECHT_WAHR,
  GERUECHTE,
  GERUECHTE_ANZAHL,
  GROESSEN,
  HERRSCHAFT,
  INHABER,
  INHABER_EN,
  LADEN_NAME,
  LAEDEN_JE_GROESSE,
  LAGEN,
  MAGIE_KAUFBAR,
  NAME_ANFANG,
  NAME_ENDE,
  PERSONEN_ANZAHL,
  PROBLEM,
  ROLLEN,
  SPEZIALITAET,
  WAREN_ANZAHL,
  WIRTSCHAFT,
  ZAUBERDIENSTE,
  text,
  type Groesse,
  type Ladenart,
  type Lage,
  type Paar,
  type Qualitaet,
  type Rolle,
  type Sprache
} from './tabellen';

export type Zufall = () => number;

export interface Person {
  /** „Bürgermeisterin", „Wirt:in", „Mayor". */
  readonly rolle: string;
  readonly figur: Figur;
}

export interface Ware {
  readonly name: string;
  /** GM; null, wenn das SRD keinen Preis nennt. */
  readonly preis: number | null;
  /** Bei magischen Gegenständen die Seltenheit. */
  readonly seltenheit?: Seltenheit;
}

export interface Laden {
  readonly art: Ladenart;
  readonly name: string;
  readonly inhaber: Person;
  readonly waren: readonly Ware[];
}

export interface Gasthaus {
  readonly name: string;
  readonly qualitaet: Qualitaet;
  readonly spezialitaet: string;
  readonly wirt: Person;
}

export interface Geruecht {
  readonly text: string;
  /** Nur für die SL. */
  readonly wahr: boolean;
}

export interface Ort {
  readonly name: string;
  readonly groesse: Groesse;
  readonly einwohner: number;
  readonly lage: Lage;
  readonly herrschaft: string;
  readonly wirtschaft: string;
  readonly besonderheit: string;
  readonly problem: string;
  readonly geruechte: readonly Geruecht[];
  readonly gasthaus: Gasthaus;
  readonly laeden: readonly Laden[];
  readonly personen: readonly Person[];
}

/** Was sich einzeln festhalten und neu würfeln lässt. */
export const FELDER = [
  'name',
  'lage',
  'herrschaft',
  'wirtschaft',
  'besonderheit',
  'problem',
  'geruechte',
  'gasthaus',
  'laeden',
  'personen'
] as const;
export type Feld = (typeof FELDER)[number];

export interface Wuensche {
  /** Feste Größe oder null für gewürfelt. */
  readonly groesse: Groesse | null;
  /** Feste Lage oder null für gewürfelt. */
  readonly lage: Lage | null;
}

export const STANDARD_WUENSCHE: Wuensche = { groesse: null, lage: null };

// --- Hilfen -------------------------------------------------------------------

function waehle<T>(liste: readonly T[], rng: Zufall): T {
  if (liste.length === 0) throw new Error('leere Liste');
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))];
}

function zwischen([a, b]: readonly [number, number], rng: Zufall): number {
  return a + Math.floor(rng() * (b - a + 1));
}

/** `anzahl` verschiedene aus der Liste, in gewürfelter Reihenfolge. */
function mehrere<T>(liste: readonly T[], anzahl: number, rng: Zufall): T[] {
  const rest = [...liste];
  const heraus: T[] = [];
  while (heraus.length < anzahl && rest.length > 0) {
    heraus.push(rest.splice(Math.min(rest.length - 1, Math.floor(rng() * rest.length)), 1)[0]);
  }
  return heraus;
}

function passtZurLage<T extends { readonly lagen?: readonly Lage[] }>(liste: readonly T[], lage: Lage): T[] {
  const passend = liste.filter((x) => !x.lagen || x.lagen.includes(lage));
  return passend.length ? passend : [...liste];
}

const KLAENGE: readonly Namensklang[] = ['weiblich', 'maennlich', 'neutral'];

function person(rolle: Rolle['de'], rolleEn: string, sprache: Sprache, rng: Zufall): Person {
  const klang = waehle(KLAENGE, rng);
  const figur = erzeugeFigur({ ...NPC_WUENSCHE, klang }, sprache, rng);
  const de = klang === 'weiblich' ? rolle.w : klang === 'maennlich' ? rolle.m : rolle.n;
  return { rolle: sprache === 'de' ? de : rolleEn, figur };
}

/** Der Rufname ohne Beinamen, für Ladennamen („Schmiede Mara"). */
function rufname(p: Person): string {
  return p.figur.name.split(' ')[0];
}

// --- Teile --------------------------------------------------------------------

export function erzeugeName(lage: Lage, sprache: Sprache, rng: Zufall): string {
  const a = waehle(NAME_ANFANG, rng);
  const e = waehle(passtZurLage(NAME_ENDE, lage), rng);
  return `${a[sprache]}${e[sprache]}`;
}

export function erzeugeGasthaus(groesse: Groesse, sprache: Sprache, rng: Zufall): Gasthaus {
  const adj = waehle(GASTHAUS_ADJEKTIV, rng);
  const nomen = waehle(GASTHAUS_NOMEN, rng);
  const name = sprache === 'de' ? `${nomen.g === 'f' ? 'Zur' : 'Zum'} ${adj.de} ${nomen.de}` : `The ${adj.en} ${nomen.en}`;
  return {
    name,
    qualitaet: waehle(GASTHAUS_QUALITAET[groesse], rng),
    spezialitaet: text(waehle(SPEZIALITAET, rng), sprache),
    wirt: person(INHABER.wirt, INHABER_EN.wirt, sprache, rng)
  };
}

/** Was ein Laden dieser Art in dieser Größe überhaupt führen kann. */
export function warenAuswahl(art: Ladenart, groesse: Groesse, sprache: Sprache): Ware[] {
  const i = sprache === 'de' ? 0 : 1;
  switch (art) {
    case 'kraemer':
      return srdAusruestung(sprache)
        .filter((e) => e.kennung.startsWith('ausruestung:') && e.wert !== null && !ALCHEMIE_WAREN.includes(e.kennung.slice(12)))
        .map((e) => ({ name: e.name, preis: e.wert }));
    case 'alchemist':
      return srdAusruestung(sprache)
        .filter((e) => ALCHEMIE_WAREN.includes(e.kennung.slice('ausruestung:'.length)))
        .map((e) => ({ name: e.name, preis: e.wert }));
    case 'schmied': {
      const waffen = WAFFEN.filter((w) => !w.fern && (groesse !== 'dorf' || w.kategorie === 'einfach'));
      const ruestungen = groesse === 'dorf' ? [] : RUESTUNGEN.filter((r) => groesse === 'stadt' || r.art !== 'schwer');
      return [...waffen, ...ruestungen].map((x) => ({ name: x.name[i], preis: x.wert }));
    }
    case 'bogner':
      return WAFFEN.filter((w) => w.fern).map((w) => ({ name: w.name[i], preis: w.wert }));
    case 'magie': {
      const erlaubt = MAGIE_KAUFBAR[groesse];
      return MAGISCHE_GEGENSTAENDE.flatMap((m): Ware[] => {
        // Nur Gegenstände mit genau einer Seltenheit (nicht „+1, +2 oder +3",
        // nicht „varies"); Schriftrollen haben einen eigenen Wert je Grad.
        if (m.seltenheiten.length !== 1 || m.kategorie === 'schriftrolle') return [];
        const s = m.seltenheiten[0];
        if (s === 'varies' || s === 'artifact' || !erlaubt.includes(s)) return [];
        return [{ name: m.name[sprache], preis: gegenstandswert(s, { verbrauch: m.kategorie === 'trank' }), seltenheit: s }];
      });
    }
  }
}

export function erzeugeLaden(art: Ladenart, groesse: Groesse, sprache: Sprache, rng: Zufall): Laden {
  const inhaber = person(INHABER[art], INHABER_EN[art], sprache, rng);
  const auswahl = warenAuswahl(art, groesse, sprache);
  const anzahl = art === 'magie' ? (groesse === 'stadt' ? zwischen([4, 8], rng) : zwischen([2, 4], rng)) : zwischen(WAREN_ANZAHL[groesse], rng);
  const waren = mehrere(auswahl, anzahl, rng).sort((a, b) => (a.preis ?? 0) - (b.preis ?? 0) || a.name.localeCompare(b.name));
  const name = sprache === 'de' ? `${LADEN_NAME[art].de} ${rufname(inhaber)}` : `${rufname(inhaber)}’s ${LADEN_NAME[art].en}`;
  return { art, name, inhaber, waren };
}

export function erzeugeLaeden(groesse: Groesse, sprache: Sprache, rng: Zufall): Laden[] {
  return LAEDEN_JE_GROESSE[groesse].map((art) => erzeugeLaden(art, groesse, sprache, rng));
}

const RANG: Record<Groesse, number> = { dorf: 0, kleinstadt: 1, stadt: 2 };

export function erzeugePersonen(groesse: Groesse, sprache: Sprache, rng: Zufall): Person[] {
  const moeglich = ROLLEN.filter((r) => RANG[r.ab] <= RANG[groesse]);
  // Das Oberhaupt gibt es immer; der Rest wird gezogen.
  const oberhaupt = moeglich.find((r) => r.id === 'oberhaupt');
  const rest = mehrere(
    moeglich.filter((r) => r !== oberhaupt),
    PERSONEN_ANZAHL[groesse] - (oberhaupt ? 1 : 0),
    rng
  );
  return [...(oberhaupt ? [oberhaupt] : []), ...rest].map((r) => person(r.de, r.en, sprache, rng));
}

export function erzeugeGeruechte(groesse: Groesse, sprache: Sprache, rng: Zufall): Geruecht[] {
  return mehrere(GERUECHTE, zwischen(GERUECHTE_ANZAHL[groesse], rng), rng).map((g: Paar) => ({
    text: text(g, sprache),
    wahr: rng() < GERUECHT_WAHR
  }));
}

/**
 * Ein ganzer Ort. `festgehalten` nennt die Teile, die aus `vorher` bleiben.
 * Größe und Lage gelten aus den Wünschen; ohne Wunsch bleiben sie beim
 * Nachwürfeln, wenn ein Teil festgehalten ist, das davon abhängt.
 */
export function erzeugeOrt(
  wuensche: Wuensche,
  sprache: Sprache,
  rng: Zufall,
  festgehalten: readonly Feld[] = [],
  vorher: Ort | null = null
): Ort {
  const halte = new Set(vorher ? festgehalten : []);
  // Größe: Wunsch, sonst die alte, wenn Läden oder Personen festgehalten sind
  // (sonst passten die nicht mehr), sonst gewürfelt.
  const groesse =
    wuensche.groesse ??
    (vorher && (halte.has('laeden') || halte.has('personen') || halte.has('gasthaus')) ? vorher.groesse : waehle(GROESSEN, rng));
  const lage = wuensche.lage ?? (vorher && halte.has('lage') ? vorher.lage : waehle(LAGEN, rng));
  const nimm = <K extends Feld & keyof Ort>(feld: K, neu: () => Ort[K]): Ort[K] => (vorher && halte.has(feld) ? vorher[feld] : neu());
  return {
    name: nimm('name', () => erzeugeName(lage, sprache, rng)),
    groesse,
    einwohner: vorher && vorher.groesse === groesse && halte.has('personen') ? vorher.einwohner : zwischen(EINWOHNER[groesse], rng),
    lage,
    herrschaft: nimm('herrschaft', () => text(waehle(HERRSCHAFT, rng), sprache)),
    wirtschaft: nimm('wirtschaft', () => text(waehle(passtZurLage(WIRTSCHAFT, lage), rng), sprache)),
    besonderheit: nimm('besonderheit', () => text(waehle(BESONDERHEIT, rng), sprache)),
    problem: nimm('problem', () => text(waehle(PROBLEM, rng), sprache)),
    geruechte: nimm('geruechte', () => erzeugeGeruechte(groesse, sprache, rng)),
    gasthaus: nimm('gasthaus', () => erzeugeGasthaus(groesse, sprache, rng)),
    laeden: nimm('laeden', () => erzeugeLaeden(groesse, sprache, rng)),
    personen: nimm('personen', () => erzeugePersonen(groesse, sprache, rng))
  };
}

/** Ein einzelnes Teil neu, der Rest bleibt. */
export function wuerfleNeu(ort: Ort, feld: Feld, sprache: Sprache, rng: Zufall): Ort {
  const behalten = FELDER.filter((f) => f !== feld);
  return erzeugeOrt({ groesse: ort.groesse, lage: feld === 'lage' ? null : ort.lage }, sprache, rng, behalten, ort);
}

/** Die Zauberdienste, die es in dieser Größe gibt (SRD). */
export function zauberdiensteFuer(groesse: Groesse) {
  return ZAUBERDIENSTE.filter((z) => z.orte.includes(groesse));
}

/** Der Name der Lage aus @suite/umgebungen. */
export function lageName(lage: Lage, sprache: Sprache): string {
  return umgebungNach(lage)?.name[sprache] ?? lage;
}
