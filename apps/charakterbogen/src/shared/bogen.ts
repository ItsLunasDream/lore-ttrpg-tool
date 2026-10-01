/**
 * Ein Charakterbogen: Datenmodell, Pruefung und die Schritte, die an ihm
 * etwas aendern (Schaden und Heilung, Rasten).
 *
 * Plattformfrei. Alle Aenderungen liefern einen neuen Bogen; nichts wird an
 * Ort und Stelle veraendert. Das ist die Grundlage fuer den spaeteren
 * Live-Stand im Raum, wo Aenderungen als Schritte reisen.
 */
import { rollExpression, type RandomSource } from '@suite/dice';
import { ATTRIBUTE, FERTIGKEITEN, fertigkeitsBonus, modifikator, uebungsbonus, type Attribut, type Uebung } from './regeln';
import { bereinigeZauberei, fuellePlaetze, type Zauberei } from './zauber';
import { bereinigeGegenstaende, type EigeneWaffe, type Gegenstand } from './inventar';
import { bereinigeTiergestalt, rasteTiergestalt, type Tiergestalt } from './tiergestalt';

export const SCHEMA = 1;

export interface Klasse {
  name: string;
  stufe: number;
  /** Unterklasse („Schule der Hervorrufung"), frei. */
  unterklasse?: string;
}

/** Eine begrenzte Faehigkeit mit Nutzungen, etwa „Kampfrausch 3/3". */
export interface Ressource {
  name: string;
  max: number;
  uebrig: number;
  /** Wann sie zurueckkommt. */
  rast: 'kurz' | 'lang';
}

export interface Ruestungsuebung {
  leicht: boolean;
  mittel: boolean;
  schwer: boolean;
  schilde: boolean;
}

export interface Trefferwuerfel {
  /** Seitenzahl: 6, 8, 10 oder 12. */
  seiten: number;
  gesamt: number;
  uebrig: number;
}

export interface Angriff {
  name: string;
  /** Freier Text, wenn keine Waffe gewaehlt ist. */
  bonus: string;
  schaden: string;
  notiz: string;
  /** SRD-Waffe (Kennung aus `shared/waffen.ts`): dann rechnet der Bogen. */
  waffe?: string;
  /** Womit angegriffen wird; „auto" nach den Regeln der Waffe. */
  attribut?: 'auto' | 'sta' | 'ges';
  /** Uebung mit der Waffe (Vorgabe: ja). */
  geuebt?: boolean;
  /** Magischer Bonus (+1 bis +3) auf Angriff und Schaden. */
  magie?: number;
  /** Vielseitige Waffe zweihaendig fuehren. */
  zweihaendig?: boolean;
  /** Nur gerechnet, nie gespeichert: der Angriff kommt von diesem Gegenstand. */
  ausInventar?: string;
  /** Nur gerechnet, nie gespeichert: die Werte einer eigenen Waffe (Homebrew Creator). */
  eigeneWaffe?: EigeneWaffe;
}

export interface Werte {
  spieler: string;
  spezies: string;
  hintergrund: string;
  klassen: Klasse[];
  attribute: Record<Attribut, number>;
  /** Attribute mit Uebung im Rettungswurf. */
  rettung: Attribut[];
  /** Fertigkeit → 1 (Uebung) oder 2 (Expertise); fehlt = keine. */
  fertigkeiten: Record<string, Uebung>;
  rk: number;
  /** null = aus dem Geschicklichkeitsmodifikator. */
  initiative: number | null;
  /** Freitext, damit „9 m" und „30 ft." beide gehen. */
  bewegung: string;
  tp: { max: number; aktuell: number; temp: number };
  trefferwuerfel: Trefferwuerfel[];
  /** Kennungen der SRD-Zustaende. */
  zustaende: string[];
  /** 0 bis 6. */
  erschoepfung: number;
  todesrettung: { erfolge: number; fehlschlaege: number };
  inspiration: boolean;
  angriffe: Angriff[];
  /** Nur bei Figuren, die zaubern. */
  zauber?: Zauberei;
  /** Nur bei Druiden (docs/tiergestalt.md). */
  tiergestalt?: Tiergestalt;
  // --- Was ein Bogen sonst noch hat (Spielerbogen 2024) ---
  ep: number;
  gesinnung: string;
  groesse: string;
  /** Alleskönner: halbe Uebung auf alle ungeuebten Fertigkeiten und die Initiative. */
  alleskoenner: boolean;
  ruestungsuebung: Ruestungsuebung;
  waffenuebung: string;
  werkzeuguebung: string;
  sprachen: string;
  klassenmerkmale: string;
  speziesmerkmale: string;
  talente: string;
  aussehen: string;
  persoenlichkeit: string;
  ressourcen: Ressource[];
  /** „Dunkelsicht 18 m" usw. */
  sinne: string;
  resistenzen: string;
  immunitaeten: string;
  anfaelligkeiten: string;
}

/** Rahmenformen fuer das Bild. */
/** Rückmeldung: Kreis, Quadrat und Fenster sind gut, der Rest fällt weg (alte Bögen bekommen den Kreis). */
export const RAHMEN = ['kreis', 'eckig', 'bogen'] as const;
export type Rahmen = (typeof RAHMEN)[number];
/** Groesste erlaubte Bilddaten (die Oberflaeche verkleinert vorher). */
export const BILD_HOECHSTENS = 600_000;

/** Wie der Bogen aussieht; je Bogen. Kennungen aus `shared/design.ts`. */
export interface Design {
  farbe: string;
  papier: string;
  schrift: string;
}

export interface Muenzen {
  pm: number;
  gm: number;
  em: number;
  sm: number;
  km: number;
}

export interface Bogen {
  id: string;
  schema: number;
  art: 'figur' | 'gruppe';
  name: string;
  /** Nur bei Figuren. */
  werte?: Werte;
  muenzen: Muenzen;
  gegenstaende: Gegenstand[];
  /** Ob Muenzen mitgewogen werden (SRD: 50 Muenzen = 1 lb). Aus, bis man es einschaltet. */
  muenzgewicht: boolean;
  /** Wer was genommen oder gegeben hat; vor allem fuers Gruppeninventar. Neueste zuerst. */
  verlauf: VerlaufEintrag[];
  notizen: string;
  /** Aussehen dieses Bogens; fehlt es, gilt die Vorgabe. */
  design?: Design;
  /** Ein Bild der Figur (verkleinert, als data:-Adresse) mit Rahmen. */
  bild?: { daten: string; rahmen: Rahmen };
  /** Verknuepfte Notiz im Story Creator (`<Kampagne>/<Notiz>`). */
  storyNotiz?: { kennung: string; titel: string; sync?: boolean };
  /** Zaehlt bei jeder gespeicherten Aenderung hoch. */
  fassung: number;
  geaendert: string;
}

export interface VerlaufEintrag {
  zeit: string;
  text: string;
}

export const MAX_VERLAUF = 200;

export const LEERE_MUENZEN: Muenzen = { pm: 0, gm: 0, em: 0, sm: 0, km: 0 };

export function leereWerte(): Werte {
  return {
    spieler: '',
    spezies: '',
    hintergrund: '',
    klassen: [{ name: '', stufe: 1 }],
    attribute: { sta: 10, ges: 10, kon: 10, int: 10, wei: 10, cha: 10 },
    rettung: [],
    fertigkeiten: {},
    rk: 10,
    initiative: null,
    bewegung: '',
    tp: { max: 10, aktuell: 10, temp: 0 },
    trefferwuerfel: [{ seiten: 8, gesamt: 1, uebrig: 1 }],
    zustaende: [],
    erschoepfung: 0,
    todesrettung: { erfolge: 0, fehlschlaege: 0 },
    inspiration: false,
    angriffe: [],
    ep: 0,
    gesinnung: '',
    groesse: '',
    alleskoenner: false,
    ruestungsuebung: { leicht: false, mittel: false, schwer: false, schilde: false },
    waffenuebung: '',
    werkzeuguebung: '',
    sprachen: '',
    klassenmerkmale: '',
    speziesmerkmale: '',
    talente: '',
    aussehen: '',
    persoenlichkeit: '',
    ressourcen: [],
    sinne: '',
    resistenzen: '',
    immunitaeten: '',
    anfaelligkeiten: ''
  };
}

export function neuerBogen(id: string, name: string, art: Bogen['art'] = 'figur'): Bogen {
  return {
    id,
    schema: SCHEMA,
    art,
    name,
    ...(art === 'figur' ? { werte: leereWerte() } : {}),
    muenzen: { ...LEERE_MUENZEN },
    gegenstaende: [],
    muenzgewicht: false,
    verlauf: [],
    notizen: '',
    fassung: 0,
    geaendert: ''
  };
}

// --- Rechnungen am Bogen ---------------------------------------------------

export function gesamtstufe(w: Werte): number {
  return Math.max(1, w.klassen.reduce((summe, k) => summe + (k.stufe || 0), 0));
}

/** Die Uebung einer Fertigkeit, mit „Alleskönner" fuer die ungeuebten. */
export function uebungIn(w: Werte, fertigkeit: string): Uebung {
  return w.fertigkeiten[fertigkeit] ?? (w.alleskoenner ? 0.5 : 0);
}

/** Initiative ist ein Geschicklichkeitswurf: „Alleskönner" zaehlt mit (SRD 5.2). */
export function initiativeBonus(w: Werte): number {
  if (w.initiative !== null) return w.initiative;
  const halb = w.alleskoenner ? Math.floor(uebungsbonus(gesamtstufe(w)) / 2) : 0;
  return modifikator(w.attribute.ges) + halb;
}

/** Passiver Wert einer Fertigkeit: 10 + Bonus (Wahrnehmung, Nachforschung, Motiv erkennen). */
export function passiverWert(w: Werte, fertigkeit: string): number {
  const f = FERTIGKEITEN.find((x) => x.id === fertigkeit);
  if (!f) return 10;
  return 10 + fertigkeitsBonus(w.attribute[f.attribut], uebungIn(w, fertigkeit), uebungsbonus(gesamtstufe(w)));
}

/** Ressourcen nach einer Rast: lang fuellt alle, kurz nur die der kurzen Rast. */
export function fuelleRessourcen(liste: readonly Ressource[], rast: 'kurz' | 'lang'): Ressource[] {
  return liste.map((r) => (rast === 'lang' || r.rast === 'kurz' ? { ...r, uebrig: r.max } : r));
}

// --- Schaden und Heilung ---------------------------------------------------

/**
 * Liest das Feld „Schaden/Heilung": `7` oder `-7` ist Schaden, `+7`
 * Heilung. Summen und Wuerfel gehen (`2d6+3`, `3+4`). Unlesbar → null.
 *
 * Anders als im Initiative Tracker, wo ein Minus vorn heilt: auf einem Bogen
 * liest man „−7" als „sieben weniger".
 */
export function leseBetrag(text: string, rng: RandomSource = Math.random): number | null {
  const roh = text.replace(/\s+/g, '').toLowerCase().replace(/w/g, 'd').replace(/−/g, '-');
  if (!roh) return null;
  const heilt = roh.startsWith('+');
  const rest = roh.replace(/^[+-]/, '');
  if (!/^(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(rest)) return null;
  let summe = 0;
  for (const teil of rest.match(/[+-]?[^+-]+/g) ?? []) {
    const minus = teil.startsWith('-');
    const kern = teil.replace(/^[+-]/, '');
    let wert: number;
    if (kern.includes('d')) {
      const [anzahl, seiten] = kern.split('d');
      const n = Math.min(100, Number(anzahl || '1'));
      const s = Number(seiten);
      if (!(n > 0 && s > 1)) return null;
      wert = rollExpression(`${n}d${s}`, rng).total;
    } else {
      wert = Number(kern);
    }
    summe += minus ? -wert : wert;
  }
  if (!Number.isFinite(summe) || summe <= 0) return null;
  return heilt ? summe : -summe;
}

/**
 * Wendet einen Betrag an: negativ ist Schaden, positiv Heilung.
 *
 * Schaden frisst zuerst die temporaeren TP. Heilung fuellt nur echte TP und
 * hoechstens bis zum Maximum. Wer von 0 aus geheilt wird, verliert die
 * Todesrettungswuerfe (SRD: mit mindestens 1 TP ist man wieder stabil und
 * bei Bewusstsein).
 */
export function wendeBetragAn(w: Werte, betrag: number): Werte {
  const tp = { ...w.tp };
  let todesrettung = w.todesrettung;
  if (betrag < 0) {
    let schaden = -betrag;
    const ausTemp = Math.min(tp.temp, schaden);
    tp.temp -= ausTemp;
    schaden -= ausTemp;
    tp.aktuell = Math.max(0, tp.aktuell - schaden);
  } else if (betrag > 0) {
    if (tp.aktuell === 0) todesrettung = { erfolge: 0, fehlschlaege: 0 };
    tp.aktuell = Math.min(tp.max, tp.aktuell + betrag);
  }
  return { ...w, tp, todesrettung };
}

// --- Rasten ----------------------------------------------------------------

/**
 * Lange Rast nach SRD 5.2: alle verlorenen TP und alle verbrauchten
 * Trefferwuerfel zurueck, eine Erschoepfungsstufe weniger.
 * Voraussetzung ist mindestens 1 TP; darauf achtet die Oberflaeche.
 */
export function langeRast(w: Werte): Werte {
  return {
    ...w,
    tp: { ...w.tp, aktuell: w.tp.max },
    trefferwuerfel: w.trefferwuerfel.map((t) => ({ ...t, uebrig: t.gesamt })),
    erschoepfung: Math.max(0, w.erschoepfung - 1),
    todesrettung: { erfolge: 0, fehlschlaege: 0 },
    ressourcen: fuelleRessourcen(w.ressourcen, 'lang'),
    // Zauberplaetze kommen nach einer langen Rast zurueck (Klassenmerkmal
    // aller Zauberklassen im SRD).
    ...(w.zauber ? { zauber: fuellePlaetze(w.zauber) } : {}),
    ...(w.tiergestalt ? { tiergestalt: { ...w.tiergestalt, verbraucht: 0 } } : {})
  };
}

export interface RastWurf {
  readonly seiten: number;
  readonly wurf: number;
  readonly geheilt: number;
}

/**
 * Kurze Rast: Trefferwuerfel verbrauchen. Je Wuerfel: wuerfeln, KON-Mod
 * dazu, mindestens 1 TP (SRD 5.2). `anzahl` nennt je Seitenzahl, wie viele.
 */
export function kurzeRast(
  w: Werte,
  anzahl: Record<number, number>,
  rng: RandomSource = Math.random
): { werte: Werte; wuerfe: RastWurf[] } {
  const kon = modifikator(w.attribute.kon);
  const wuerfe: RastWurf[] = [];
  const trefferwuerfel = w.trefferwuerfel.map((t) => {
    const n = Math.max(0, Math.min(t.uebrig, Math.floor(anzahl[t.seiten] ?? 0)));
    for (let i = 0; i < n; i++) {
      const wurf = rollExpression(`1d${t.seiten}`, rng).total;
      wuerfe.push({ seiten: t.seiten, wurf, geheilt: Math.max(1, wurf + kon) });
    }
    return { ...t, uebrig: t.uebrig - n };
  });
  const summe = wuerfe.reduce((s, x) => s + x.geheilt, 0);
  // Paktmagie: die Plaetze kommen auch nach einer kurzen Rast zurueck.
  const zauber = w.zauber?.kurzeRast ? fuellePlaetze(w.zauber) : w.zauber;
  const geheilt = wendeBetragAn(
    rasteTiergestalt({ ...w, trefferwuerfel, ressourcen: fuelleRessourcen(w.ressourcen, 'kurz'), ...(zauber ? { zauber } : {}) }, 'kurz'),
    summe
  );
  return { werte: geheilt, wuerfe };
}

// --- Pruefen beim Einlesen -------------------------------------------------

function zahl(wert: unknown, ersatz: number, min = -Infinity, max = Infinity): number {
  const n = typeof wert === 'number' ? wert : Number(wert);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : ersatz;
}

function text(wert: unknown, max = 2000): string {
  return typeof wert === 'string' ? wert.slice(0, max) : '';
}

/**
 * Macht aus beliebigem JSON einen gueltigen Bogen. Fehlendes wird ergaenzt,
 * Unsinniges verworfen: eine von Hand bearbeitete Datei soll den Bogen
 * nicht unbrauchbar machen.
 */
export function bereinige(roh: unknown, id: string): Bogen {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const art = r.art === 'gruppe' ? 'gruppe' : 'figur';
  const basis = neuerBogen(id, text(r.name, 120) || id, art);
  const m = (r.muenzen && typeof r.muenzen === 'object' ? r.muenzen : {}) as Record<string, unknown>;
  const d = (r.design && typeof r.design === 'object' ? r.design : null) as Record<string, unknown> | null;
  const kennwort = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,30}$/.test(x) ? x : '');
  const design: Design | null = d ? { farbe: kennwort(d.farbe), papier: kennwort(d.papier), schrift: kennwort(d.schrift) } : null;
  const bl = (r.bild && typeof r.bild === 'object' ? r.bild : null) as Record<string, unknown> | null;
  const bild =
    bl && typeof bl.daten === 'string' && bl.daten.length <= BILD_HOECHSTENS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(bl.daten)
      ? { daten: bl.daten, rahmen: (RAHMEN as readonly string[]).includes(String(bl.rahmen)) ? (bl.rahmen as Rahmen) : 'kreis' }
      : null;
  const sn = (r.storyNotiz && typeof r.storyNotiz === 'object' ? r.storyNotiz : null) as Record<string, unknown> | null;
  const story =
    sn && typeof sn.kennung === 'string' && sn.kennung
      ? { kennung: sn.kennung.slice(0, 200), titel: text(sn.titel, 200), ...(sn.sync === true ? { sync: true } : {}) }
      : null;
  const bogen: Bogen = {
    ...basis,
    muenzen: {
      pm: zahl(m.pm, 0, 0),
      gm: zahl(m.gm, 0, 0),
      em: zahl(m.em, 0, 0),
      sm: zahl(m.sm, 0, 0),
      km: zahl(m.km, 0, 0)
    },
    gegenstaende: bereinigeGegenstaende(r.gegenstaende),
    muenzgewicht: r.muenzgewicht === true,
    verlauf: (Array.isArray(r.verlauf) ? r.verlauf : []).slice(0, MAX_VERLAUF).flatMap((v) => {
      const x = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
      return typeof x.text === 'string' && x.text ? [{ zeit: text(x.zeit, 40), text: x.text.slice(0, 300) }] : [];
    }),
    notizen: text(r.notizen, 100_000),
    ...(design ? { design } : {}),
    ...(bild ? { bild } : {}),
    ...(story ? { storyNotiz: story } : {}),
    fassung: zahl(r.fassung, 0, 0),
    geaendert: text(r.geaendert, 40)
  };
  if (art === 'gruppe') return bogen;

  const w = (r.werte && typeof r.werte === 'object' ? r.werte : {}) as Record<string, unknown>;
  const leer = leereWerte();
  const a = (w.attribute && typeof w.attribute === 'object' ? w.attribute : {}) as Record<string, unknown>;
  const attribute = Object.fromEntries(ATTRIBUTE.map((k) => [k, zahl(a[k], 10, 1, 30)])) as Record<Attribut, number>;
  const f = (w.fertigkeiten && typeof w.fertigkeiten === 'object' ? w.fertigkeiten : {}) as Record<string, unknown>;
  const fertigkeiten: Record<string, Uebung> = {};
  for (const fk of FERTIGKEITEN) {
    const roh = Number(f[fk.id]);
    const u = roh === 0.5 ? 0.5 : zahl(f[fk.id], 0, 0, 2);
    if (u > 0) fertigkeiten[fk.id] = u as Uebung;
  }
  const tp = (w.tp && typeof w.tp === 'object' ? w.tp : {}) as Record<string, unknown>;
  const max = zahl(tp.max, leer.tp.max, 1, 9999);
  const ts = (w.todesrettung && typeof w.todesrettung === 'object' ? w.todesrettung : {}) as Record<string, unknown>;
  const ru = (w.ruestungsuebung && typeof w.ruestungsuebung === 'object' ? w.ruestungsuebung : {}) as Record<string, unknown>;
  bogen.werte = {
    spieler: text(w.spieler, 80),
    spezies: text(w.spezies, 80),
    hintergrund: text(w.hintergrund, 80),
    klassen: Array.isArray(w.klassen)
      ? w.klassen.slice(0, 6).map((k) => {
          const kk = (k && typeof k === 'object' ? k : {}) as Record<string, unknown>;
          const unterklasse = text(kk.unterklasse, 80);
          return { name: text(kk.name, 60), stufe: zahl(kk.stufe, 1, 1, 20), ...(unterklasse ? { unterklasse } : {}) };
        })
      : leer.klassen,
    attribute,
    rettung: Array.isArray(w.rettung) ? ATTRIBUTE.filter((k) => (w.rettung as unknown[]).includes(k)) : [],
    fertigkeiten,
    rk: zahl(w.rk, 10, 0, 99),
    initiative: w.initiative === null || w.initiative === undefined ? null : zahl(w.initiative, 0, -20, 40),
    bewegung: text(w.bewegung, 60),
    tp: { max, aktuell: zahl(tp.aktuell, max, 0, max), temp: zahl(tp.temp, 0, 0, 9999) },
    trefferwuerfel: Array.isArray(w.trefferwuerfel)
      ? w.trefferwuerfel.slice(0, 4).map((t) => {
          const tt = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
          const seiten = [6, 8, 10, 12].includes(Number(tt.seiten)) ? Number(tt.seiten) : 8;
          const gesamt = zahl(tt.gesamt, 1, 0, 20);
          return { seiten, gesamt, uebrig: zahl(tt.uebrig, gesamt, 0, gesamt) };
        })
      : leer.trefferwuerfel,
    zustaende: Array.isArray(w.zustaende) ? w.zustaende.filter((z): z is string => typeof z === 'string').slice(0, 20) : [],
    erschoepfung: zahl(w.erschoepfung, 0, 0, 6),
    todesrettung: { erfolge: zahl(ts.erfolge, 0, 0, 3), fehlschlaege: zahl(ts.fehlschlaege, 0, 0, 3) },
    inspiration: w.inspiration === true,
    angriffe: Array.isArray(w.angriffe)
      ? w.angriffe.slice(0, 30).map((x) => {
          const xx = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
          const a: Angriff = { name: text(xx.name, 80), bonus: text(xx.bonus, 20), schaden: text(xx.schaden, 60), notiz: text(xx.notiz, 200) };
          if (typeof xx.waffe === 'string' && /^[a-z0-9-]{1,40}$/.test(xx.waffe)) {
            a.waffe = xx.waffe;
            a.attribut = xx.attribut === 'sta' || xx.attribut === 'ges' ? xx.attribut : 'auto';
            a.geuebt = xx.geuebt !== false;
            a.magie = zahl(xx.magie, 0, 0, 3);
            a.zweihaendig = xx.zweihaendig === true;
          }
          return a;
        })
      : [],
    ...(bereinigeZauberei(w.zauber) ? { zauber: bereinigeZauberei(w.zauber) } : {}),
    ...(bereinigeTiergestalt(w.tiergestalt) ? { tiergestalt: bereinigeTiergestalt(w.tiergestalt) } : {}),
    ep: zahl(w.ep, 0, 0, 10_000_000),
    gesinnung: text(w.gesinnung, 60),
    groesse: text(w.groesse, 40),
    alleskoenner: w.alleskoenner === true,
    ruestungsuebung: {
      leicht: ru.leicht === true,
      mittel: ru.mittel === true,
      schwer: ru.schwer === true,
      schilde: ru.schilde === true
    },
    waffenuebung: text(w.waffenuebung, 500),
    werkzeuguebung: text(w.werkzeuguebung, 500),
    sprachen: text(w.sprachen, 500),
    klassenmerkmale: text(w.klassenmerkmale, 20_000),
    speziesmerkmale: text(w.speziesmerkmale, 20_000),
    talente: text(w.talente, 20_000),
    aussehen: text(w.aussehen, 5000),
    persoenlichkeit: text(w.persoenlichkeit, 20_000),
    sinne: text(w.sinne, 500),
    resistenzen: text(w.resistenzen, 500),
    immunitaeten: text(w.immunitaeten, 500),
    anfaelligkeiten: text(w.anfaelligkeiten, 500),
    ressourcen: Array.isArray(w.ressourcen)
      ? w.ressourcen.slice(0, 30).flatMap((x): Ressource[] => {
          const rr = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
          const name = text(rr.name, 80);
          if (!name.trim()) return [];
          const rmax = zahl(rr.max, 1, 0, 99);
          return [{ name, max: rmax, uebrig: zahl(rr.uebrig, rmax, 0, rmax), rast: rr.rast === 'kurz' ? 'kurz' : 'lang' }];
        })
      : []
  };
  if (bogen.werte.klassen.length === 0) bogen.werte.klassen = leer.klassen;
  return bogen;
}
