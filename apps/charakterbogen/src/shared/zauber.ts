/**
 * Die Zauber eines Bogens: Plaetze, Liste, Wirken.
 *
 * Die SRD-Zauber kommen aus `@suite/srd/zauber`. Gespeichert wird nur ihre
 * Kennung; Name und Text holt die Oberflaeche in ihrer Sprache. Eigene
 * Zauber tragen Name, Grad und Text selbst.
 *
 * Plaetze und vorbereitete Zauber traegt man selbst ein; die Werte der
 * Klassentabellen schlaegt `klassenhinweise.ts` vor (docs/charakterbogen.md).
 */
import { ZAUBER, type Zauber, type Zauberklasse } from '@suite/srd/zauber';
import { ATTRIBUTE, ATTRIBUT_NAMEN, type Attribut } from './regeln';

/**
 * Ein eigener Zauber. Aus dem Homebrew Creator kommen Zeitaufwand,
 * Reichweite, Schaden und Heilung mit (Rückmeldung: Homebrew-Zeile wie bei
 * SRD-Zaubern, Schaden beim Wirken).
 */
export interface EigenerZauber {
  name: string;
  grad: number;
  text: string;
  zeit?: string;
  reichweite?: string;
  /** Würfelausdruck wie „8d6+2“. */
  schaden?: string;
  schadensart?: string;
  heilung?: string;
}

export interface ZauberEintrag {
  /** Kennung eines SRD-Zaubers. */
  srd?: string;
  /** Oder ein eigener Zauber. */
  eigen?: EigenerZauber;
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

const ANGRIFF = /\b(melee|ranged) spell attack/i;
const ANGRIFF_EIGEN = /spell attack|zauberangriff/i;

/**
 * Ob der Zauber einen Zauberangriff verlangt (Rückmeldung: beim Wirken
 * gleich mitwürfeln). SRD: „make a melee/ranged spell attack" im englischen
 * Text (21 Zauber); eigene Zauber: das Wort im Text.
 */
export function istAngriffszauber(e: ZauberEintrag): boolean {
  if (e.eigen) return ANGRIFF_EIGEN.test(e.eigen.text);
  const z = e.srd ? NACH_ID.get(e.srd) : undefined;
  return Boolean(z?.bloecke.en.some((b) => 'text' in b && ANGRIFF.test(b.text)));
}

const RETTUNG_EN: Record<string, Attribut> = {
  strength: 'sta',
  dexterity: 'ges',
  constitution: 'kon',
  intelligence: 'int',
  wisdom: 'wei',
  charisma: 'cha'
};
const RETTUNG_DE: Record<string, Attribut> = {
  'stärke': 'sta',
  geschicklichkeit: 'ges',
  konstitution: 'kon',
  intelligenz: 'int',
  weisheit: 'wei',
  charisma: 'cha'
};
// Einzahl: „Dexterity saving throw“; „saving throws“ (Vorteil auf …) zählt nicht.
const RETTUNG_SRD = /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw\b(?!s)/gi;
const RETTUNG_EIGEN_DE = /\b(Stärke|Geschicklichkeit|Konstitution|Intelligenz|Weisheit|Charisma)-?[Rr]ettungswurf\b/gi;

/**
 * Welche Rettungswürfe ein Zauber verlangt, in der Reihenfolge des Textes
 * (Rückmeldung: beim Wirken den SG zeigen). SRD: der englische Text, 131
 * Zauber; eigene Zauber: deutsch oder englisch im Text.
 */
export function rettungswuerfeVon(e: ZauberEintrag): Attribut[] {
  const heraus: Attribut[] = [];
  const nimm = (text: string, muster: RegExp, tabelle: Record<string, Attribut>) => {
    for (const m of text.matchAll(muster)) {
      const a = tabelle[m[1].toLowerCase()];
      if (a && !heraus.includes(a)) heraus.push(a);
    }
  };
  if (e.eigen) {
    nimm(e.eigen.text, RETTUNG_EIGEN_DE, RETTUNG_DE);
    nimm(e.eigen.text, RETTUNG_SRD, RETTUNG_EN);
    return heraus;
  }
  const z = e.srd ? NACH_ID.get(e.srd) : undefined;
  for (const b of z?.bloecke.en ?? []) if ('text' in b) nimm(b.text, RETTUNG_SRD, RETTUNG_EN);
  return heraus;
}

export interface ZauberWurf {
  readonly art: 'schaden' | 'heilung';
  /** Würfelausdruck mit „d“, z. B. „8d6“ oder „2d8+3“. */
  readonly ausdruck: string;
  /** Schadensart in der Sprache der Oberfläche („Feuerschaden“, „Fire“), leer bei Heilung. */
  readonly bezeichnung: string;
}

const SCHADEN_EN = /(\d+d\d+(?:\s*\+\s*\d+)?)\s+([A-Z][a-z]+)\s+damage/;
// „8W6 Feuerschaden“ oder „1W10 nekrotischen Schaden“ (wird zu „nekrotischer Schaden“).
const SCHADEN_DE = /(\d+W\d+(?:\s*\+\s*\d+)?)\s+(?:([A-ZÄÖÜ][a-zäöüß]*schaden)|([a-zäöüß]+)en Schaden)/;
const HEILUNG_EN = /Hit Points equal to (\d+d\d+) plus your spellcasting ability modifier/;
const HOCH_EN = /(?:damage|healing) increases by (\d+)d(\d+) for each spell slot level above (\d)/;
const TRICK_EN = /levels 5 \((\d+d\d+)\), 11 \((\d+d\d+)\), and 17 \((\d+d\d+)\)/;
const WUERFEL_EIGEN = /(\d+)\s*[dDwW]\s*(\d+)(?:\s*\+\s*(\d+))?/;

/**
 * Schaden oder Heilung eines Zaubers zum Würfeln (Rückmeldung: Feuerball
 * zeigte den SG, aber keinen Schaden). SRD: aus dem englischen Text, mit
 * höherem Platz („increases by 1d6 for each spell slot level above 3“) und
 * Zaubertrick-Stufen („levels 5 (2d10), 11 …“); die Bezeichnung aus dem
 * deutschen Text. Eigene Zauber: was der Homebrew Creator mitgibt, sonst der
 * erste Würfel im Text. Mehrere Geschosse oder Strahlen sind ein Wurf je
 * Treffer; gewürfelt wird einer.
 */
export function zauberWurf(
  e: ZauberEintrag,
  platz: number | null,
  stufe: number,
  attributMod: number,
  sprache: 'de' | 'en'
): ZauberWurf | null {
  if (e.eigen) {
    const g = e.eigen;
    if (g.schaden) return { art: 'schaden', ausdruck: g.schaden, bezeichnung: g.schadensart ?? '' };
    if (g.heilung) return { art: 'heilung', ausdruck: g.heilung, bezeichnung: '' };
    const m = WUERFEL_EIGEN.exec(g.text);
    if (!m) return null;
    const heilt = /heil|heal/i.test(g.text) && !/schaden|damage/i.test(g.text);
    return { art: heilt ? 'heilung' : 'schaden', ausdruck: `${m[1]}d${m[2]}${m[3] ? `+${m[3]}` : ''}`, bezeichnung: '' };
  }
  const z = e.srd ? NACH_ID.get(e.srd) : undefined;
  if (!z) return null;
  const en = z.bloecke.en.map((b) => ('text' in b ? b.text : '')).join(' ');
  const de = z.bloecke.de.map((b) => ('text' in b ? b.text : '')).join(' ');
  const mehr = (ausdruck: string): string => {
    const h = HOCH_EN.exec(en);
    if (!h || platz === null || platz <= Number(h[3])) return ausdruck;
    return `${ausdruck}+${Number(h[1]) * (platz - Number(h[3]))}d${h[2]}`;
  };
  const schaden = SCHADEN_EN.exec(en);
  if (schaden) {
    let ausdruck = schaden[1].replace(/\s+/g, '');
    const t = z.grad === 0 ? TRICK_EN.exec(en) : null;
    if (t) ausdruck = stufe >= 17 ? t[3] : stufe >= 11 ? t[2] : stufe >= 5 ? t[1] : ausdruck;
    const deutsch = SCHADEN_DE.exec(de);
    const deName = deutsch ? (deutsch[2] ?? `${deutsch[3]}er Schaden`) : schaden[2];
    return { art: 'schaden', ausdruck: mehr(ausdruck), bezeichnung: sprache === 'de' ? deName : schaden[2] };
  }
  const heilung = HEILUNG_EN.exec(en);
  if (heilung) {
    const mod = attributMod ? `${attributMod > 0 ? '+' : '-'}${Math.abs(attributMod)}` : '';
    return { art: 'heilung', ausdruck: mehr(heilung[1]) + mod, bezeichnung: '' };
  }
  return null;
}

/**
 * Die Zeile zum Wirken für Anzeige und Raum. `platz` ist der verbrauchte
 * Grad; 0 = Zaubertrick, null = gewirkt ohne freien Platz.
 */
export function wirkZeile(
  name: string,
  platz: number | null,
  sprache: 'de' | 'en',
  rettung?: { readonly attribute: readonly Attribut[]; readonly sg: number }
): string {
  const de = sprache === 'de';
  const wie =
    platz === 0
      ? de ? 'Zaubertrick' : 'cantrip'
      : platz === null
        ? de ? 'ohne freien Platz' : 'without a free slot'
        : de ? `Platz des ${platz}. Grades` : `level ${platz} slot`;
  const kurz = (a: Attribut) => ATTRIBUT_NAMEN[a].kurz[de ? 0 : 1];
  const sg =
    rettung && rettung.attribute.length
      ? de
        ? ` · Rettungswurf ${rettung.attribute.map(kurz).join(' oder ')}, SG ${rettung.sg}`
        : ` · ${rettung.attribute.map(kurz).join(' or ')} save, DC ${rettung.sg}`
      : '';
  return `✨ ${de ? `${name} gewirkt` : `${name} cast`} (${wie})${sg}`;
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

function wahlText<K extends string>(roh: Record<string, unknown>, feld: K, laenge: number): Partial<Record<K, string>> {
  const w = roh[feld];
  return typeof w === 'string' && w.trim() ? ({ [feld]: w.trim().slice(0, laenge) } as Partial<Record<K, string>>) : {};
}

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
              text: typeof eigen.text === 'string' ? eigen.text.slice(0, 5000) : '',
              ...wahlText(eigen, 'zeit', 80),
              ...wahlText(eigen, 'reichweite', 80),
              ...wahlText(eigen, 'schaden', 40),
              ...wahlText(eigen, 'schadensart', 40),
              ...wahlText(eigen, 'heilung', 40)
            },
            ...basis
          }
        ];
      }
      return [];
    })
  };
}
