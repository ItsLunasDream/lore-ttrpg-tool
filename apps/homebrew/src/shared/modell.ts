/**
 * Was der Homebrew Creator baut (docs/homebrew-creator.md): Waffe, Rüstung,
 * Gegenstand, magischer Gegenstand und Zauber.
 *
 * Ein Eintrag hat einen gemeinsamen Kopf (Name, Beschreibung, Bild, Preis,
 * Gewicht) und je Art seine Werte. Alle Arten stehen von Anfang an im
 * Modell, damit eine gespeicherte Datei nicht umgebaut werden muss, wenn
 * ein Reiter dazukommt.
 *
 * Plattformfrei, damit die Tests ohne Electron laufen.
 */
import { SELTENHEITEN, type Seltenheit } from '@suite/srd';
import {
  MEISTERSCHAFTEN,
  RUESTUNGSARTEN,
  WAFFEN_EIGENSCHAFTEN,
  type Meisterschaft,
  type RuestungsArt,
  type WaffenEigenschaft
} from '@suite/srd/waffen';

export const ARTEN = ['waffe', 'ruestung', 'gegenstand', 'magisch', 'zauber'] as const;
export type Art = (typeof ARTEN)[number];

export const SCHADENSARTEN = [
  'stich',
  'hieb',
  'wucht',
  'saeure',
  'kaelte',
  'feuer',
  'energie',
  'blitz',
  'nekrotisch',
  'gift',
  'psychisch',
  'gleissend',
  'schall'
] as const;
export type Schadensart = (typeof SCHADENSARTEN)[number];

/** Groesste erlaubte Bilddaten; die Oberflaeche verkleinert vorher (wie im Charakterbogen). */
export const BILD_HOECHSTENS = 600_000;

interface Kopf {
  id: string;
  name: string;
  beschreibung: string;
  /** data:image/…;base64,… oder nichts. */
  bild: string | null;
  /** GM, null wenn keiner. */
  preis: number | null;
  /** lb, null wenn keines. */
  gewicht: number | null;
  geaendert: string;
  /** In den Loot Generator geschickt. */
  imLoot?: boolean;
}

export interface Waffe extends Kopf {
  art: 'waffe';
  kategorie: 'einfach' | 'kriegs';
  fern: boolean;
  /** „1d8", „2d6" oder „1". */
  wuerfel: string;
  schadensart: Schadensart;
  eigenschaften: WaffenEigenschaft[];
  /** Bei „vielseitig": der Wuerfel zweihaendig. */
  vielseitig: string;
  /** Bei Wurf- und Munitionswaffen, in Fuss. */
  reichweiteNormal: number;
  reichweiteMax: number;
  meisterschaft: Meisterschaft;
  /** Magischer Bonus 0 bis 3. */
  bonus: number;
}

export interface Ruestung extends Kopf {
  art: 'ruestung';
  ruestungsart: RuestungsArt;
  /** Grundwert; beim Schild der Bonus. */
  rk: number;
  /** Stärke-Anforderung, 0 = keine. */
  staerke: number;
  heimlichkeitNachteil: boolean;
  bonus: number;
}

export interface Gegenstand extends Kopf {
  art: 'gegenstand';
}

export interface Magisch extends Kopf {
  art: 'magisch';
  /** Art aus @suite/magie (waffe, ruestung, ring, stab, …). */
  gegenstandsart: string;
  seltenheit: Seltenheit;
  einstimmung: boolean;
  wirkungen: string[];
  fluch: string;
}

export const ZAUBERSCHULEN = [
  'bann',
  'beschwoerung',
  'erkenntnis',
  'verzauberung',
  'hervorrufung',
  'illusion',
  'nekromantie',
  'verwandlung'
] as const;
export type Zauberschule = (typeof ZAUBERSCHULEN)[number];

export const ZAUBERKLASSEN = ['barde', 'druide', 'hexenmeister', 'kleriker', 'magier', 'paladin', 'waldlaeufer', 'zauberer'] as const;
export type Zauberklasse = (typeof ZAUBERKLASSEN)[number];

export const FLAECHEN = ['kugel', 'kegel', 'linie', 'wuerfel', 'zylinder', 'ausstrahlung'] as const;
export type Flaeche = (typeof FLAECHEN)[number];

export const RETTUNGSWUERFE = ['', 'sta', 'ges', 'kon', 'int', 'wei', 'cha'] as const;
export type Rettungswurf = (typeof RETTUNGSWUERFE)[number];

export interface Zauber extends Kopf {
  art: 'zauber';
  /** 0 = Zaubertrick. */
  grad: number;
  schule: Zauberschule;
  klassen: Zauberklasse[];
  zeit: string;
  reichweite: string;
  komponenten: string;
  dauer: string;
  konzentration: boolean;
  ritual: boolean;
  /** Schaden fuer die Eichung; anzahl 0 = kein Schaden. */
  schadenAnzahl: number;
  schadenSeiten: number;
  /** Festes Plus wie bei „10W6 + 40". */
  schadenPlus: number;
  schadensart: Schadensart;
  /** Einzelziel oder Flaeche. */
  ziel: 'einzel' | 'mehrere' | 'flaeche';
  flaeche: Flaeche;
  /** Fuss: Radius, Laenge oder Kantenlaenge. */
  flaecheGroesse: number;
  /** Leer = kein Rettungswurf. */
  rettungswurf: Rettungswurf;
  angriffswurf: boolean;
  /** Bei erfolgreichem Rettungswurf halber Schaden. */
  halbBeiErfolg: boolean;
  /** Was ein hoeherer Grad bringt, frei. */
  hoehererGrad: string;
}

export type Eintrag = Waffe | Ruestung | Gegenstand | Magisch | Zauber;

function kopf(name = ''): Kopf {
  return { id: '', name, beschreibung: '', bild: null, preis: null, gewicht: null, geaendert: '' };
}

export function leererEintrag(art: Art, sprache: 'de' | 'en' = 'de'): Eintrag {
  switch (art) {
    case 'waffe':
      return {
        ...kopf(),
        art,
        kategorie: 'kriegs',
        fern: false,
        wuerfel: '1d8',
        schadensart: 'hieb',
        eigenschaften: [],
        vielseitig: '1d10',
        reichweiteNormal: 20,
        reichweiteMax: 60,
        meisterschaft: 'sap',
        bonus: 0,
        preis: 15,
        gewicht: 3
      };
    case 'ruestung':
      return { ...kopf(), art, ruestungsart: 'mittel', rk: 14, staerke: 0, heimlichkeitNachteil: false, bonus: 0, preis: 400, gewicht: 20 };
    case 'gegenstand':
      return { ...kopf(), art };
    case 'magisch':
      return { ...kopf(), art, gegenstandsart: 'wundersam', seltenheit: 'uncommon', einstimmung: false, wirkungen: [''], fluch: '' };
    case 'zauber':
      return {
        ...kopf(),
        art,
        grad: 1,
        schule: 'hervorrufung',
        klassen: [],
        // Wortlaut wie in den SRD-Zaubern der jeweiligen Sprache.
        zeit: sprache === 'de' ? 'Aktion' : 'Action',
        reichweite: sprache === 'de' ? '18 Meter' : '60 feet',
        komponenten: sprache === 'de' ? 'V, G' : 'V, S',
        dauer: sprache === 'de' ? 'Unmittelbar' : 'Instantaneous',
        konzentration: false,
        ritual: false,
        schadenAnzahl: 0,
        schadenSeiten: 6,
        schadenPlus: 0,
        schadensart: 'feuer',
        ziel: 'einzel',
        flaeche: 'kugel',
        flaecheGroesse: 20,
        rettungswurf: '',
        angriffswurf: false,
        halbBeiErfolg: false,
        hoehererGrad: ''
      };
  }
}

// --- Pruefen beim Einlesen -------------------------------------------------

function text(x: unknown, max = 5000): string {
  return typeof x === 'string' ? x.slice(0, max) : '';
}

function zahl(x: unknown, ersatz: number, min: number, max: number): number {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : ersatz;
}

function oderNull(x: unknown, max: number): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : null;
}

function eins<T extends string>(x: unknown, liste: readonly T[], ersatz: T): T {
  return (liste as readonly string[]).includes(x as string) ? (x as T) : ersatz;
}

function wuerfelText(x: unknown, ersatz: string): string {
  const s = text(x, 12).trim().toLowerCase().replace('w', 'd');
  return /^(\d{1,2}d\d{1,3}|\d{1,3})$/.test(s) ? s : ersatz;
}

/** Macht aus beliebigem JSON einen gueltigen Eintrag (Datei von Hand bearbeitet, Austausch). */
export function bereinige(roh: unknown, id: string): Eintrag {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const art = eins(r.art, ARTEN, 'gegenstand');
  const leer = leererEintrag(art);
  const bild =
    typeof r.bild === 'string' && r.bild.length <= BILD_HOECHSTENS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r.bild)
      ? r.bild
      : null;
  const k: Kopf = {
    id,
    name: text(r.name, 120),
    beschreibung: text(r.beschreibung, 20_000),
    bild,
    preis: oderNull(r.preis, 10_000_000),
    gewicht: oderNull(r.gewicht, 100_000),
    geaendert: text(r.geaendert, 40),
    ...(r.imLoot === true ? { imLoot: true } : {})
  };
  switch (leer.art) {
    case 'waffe': {
      const eigenschaften = Array.isArray(r.eigenschaften)
        ? WAFFEN_EIGENSCHAFTEN.filter((e) => (r.eigenschaften as unknown[]).includes(e))
        : [];
      return {
        ...leer,
        ...k,
        kategorie: r.kategorie === 'einfach' ? 'einfach' : 'kriegs',
        fern: r.fern === true,
        wuerfel: wuerfelText(r.wuerfel, leer.wuerfel),
        schadensart: eins(r.schadensart, SCHADENSARTEN, leer.schadensart),
        eigenschaften,
        vielseitig: wuerfelText(r.vielseitig, leer.vielseitig),
        reichweiteNormal: Math.round(zahl(r.reichweiteNormal, leer.reichweiteNormal, 5, 2000)),
        reichweiteMax: Math.round(zahl(r.reichweiteMax, leer.reichweiteMax, 5, 6000)),
        meisterschaft: eins(r.meisterschaft, MEISTERSCHAFTEN, leer.meisterschaft),
        bonus: Math.round(zahl(r.bonus, 0, 0, 3))
      };
    }
    case 'ruestung':
      return {
        ...leer,
        ...k,
        ruestungsart: eins(r.ruestungsart, RUESTUNGSARTEN, leer.ruestungsart),
        rk: Math.round(zahl(r.rk, leer.rk, 0, 30)),
        staerke: Math.round(zahl(r.staerke, 0, 0, 30)),
        heimlichkeitNachteil: r.heimlichkeitNachteil === true,
        bonus: Math.round(zahl(r.bonus, 0, 0, 3))
      };
    case 'gegenstand':
      return { ...leer, ...k };
    case 'magisch':
      return {
        ...leer,
        ...k,
        gegenstandsart: text(r.gegenstandsart, 40) || leer.gegenstandsart,
        seltenheit: eins(r.seltenheit, SELTENHEITEN, leer.seltenheit),
        einstimmung: r.einstimmung === true,
        wirkungen: Array.isArray(r.wirkungen) ? r.wirkungen.map((w) => text(w, 2000)).slice(0, 12) : [],
        fluch: text(r.fluch, 2000)
      };
    case 'zauber':
      return {
        ...leer,
        ...k,
        grad: Math.round(zahl(r.grad, leer.grad, 0, 9)),
        schule: eins(r.schule, ZAUBERSCHULEN, leer.schule),
        klassen: Array.isArray(r.klassen) ? ZAUBERKLASSEN.filter((c) => (r.klassen as unknown[]).includes(c)) : [],
        zeit: text(r.zeit, 80) || leer.zeit,
        reichweite: text(r.reichweite, 80) || leer.reichweite,
        komponenten: text(r.komponenten, 200) || leer.komponenten,
        dauer: text(r.dauer, 80) || leer.dauer,
        konzentration: r.konzentration === true,
        ritual: r.ritual === true,
        schadenAnzahl: Math.round(zahl(r.schadenAnzahl, 0, 0, 40)),
        schadenSeiten: Number(eins(String(r.schadenSeiten), ['4', '6', '8', '10', '12'] as const, '6')),
        schadenPlus: Math.round(zahl(r.schadenPlus, 0, 0, 200)),
        schadensart: eins(r.schadensart, SCHADENSARTEN, leer.schadensart),
        ziel: r.ziel === 'flaeche' ? 'flaeche' : r.ziel === 'mehrere' ? 'mehrere' : 'einzel',
        flaeche: eins(r.flaeche, FLAECHEN, leer.flaeche),
        flaecheGroesse: Math.round(zahl(r.flaecheGroesse, leer.flaecheGroesse, 5, 1000)),
        rettungswurf: eins(r.rettungswurf, RETTUNGSWUERFE, ''),
        angriffswurf: r.angriffswurf === true,
        halbBeiErfolg: r.halbBeiErfolg === true,
        hoehererGrad: text(r.hoehererGrad, 2000)
      };
  }
}
