/**
 * Ein Charakterbogen: Datenmodell, Pruefung und die Schritte, die an ihm
 * etwas aendern (Schaden und Heilung, Rasten).
 *
 * Plattformfrei. Alle Aenderungen liefern einen neuen Bogen; nichts wird an
 * Ort und Stelle veraendert. Das ist die Grundlage fuer den spaeteren
 * Live-Stand im Raum, wo Aenderungen als Schritte reisen.
 */
import { rollExpression, type RandomSource } from '@suite/dice';
import { ATTRIBUTE, FERTIGKEITEN, modifikator, type Attribut, type Uebung } from './regeln';
import { bereinigeZauberei, fuellePlaetze, type Zauberei } from './zauber';

export const SCHEMA = 1;

export interface Klasse {
  name: string;
  stufe: number;
}

export interface Trefferwuerfel {
  /** Seitenzahl: 6, 8, 10 oder 12. */
  seiten: number;
  gesamt: number;
  uebrig: number;
}

export interface Angriff {
  name: string;
  bonus: string;
  schaden: string;
  notiz: string;
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
  /** Kommt mit dem Inventar (Schritt 3). Bis dahin leer, aber schon im Format. */
  gegenstaende: unknown[];
  notizen: string;
  /** Zaehlt bei jeder gespeicherten Aenderung hoch. */
  fassung: number;
  geaendert: string;
}

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
    angriffe: []
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
    notizen: '',
    fassung: 0,
    geaendert: ''
  };
}

// --- Rechnungen am Bogen ---------------------------------------------------

export function gesamtstufe(w: Werte): number {
  return Math.max(1, w.klassen.reduce((summe, k) => summe + (k.stufe || 0), 0));
}

export function initiativeBonus(w: Werte): number {
  return w.initiative ?? modifikator(w.attribute.ges);
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
    // Zauberplaetze kommen nach einer langen Rast zurueck (Klassenmerkmal
    // aller Zauberklassen im SRD).
    ...(w.zauber ? { zauber: fuellePlaetze(w.zauber) } : {})
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
  const geheilt = wendeBetragAn({ ...w, trefferwuerfel, ...(zauber ? { zauber } : {}) }, summe);
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
  const bogen: Bogen = {
    ...basis,
    muenzen: {
      pm: zahl(m.pm, 0, 0),
      gm: zahl(m.gm, 0, 0),
      em: zahl(m.em, 0, 0),
      sm: zahl(m.sm, 0, 0),
      km: zahl(m.km, 0, 0)
    },
    gegenstaende: Array.isArray(r.gegenstaende) ? r.gegenstaende : [],
    notizen: text(r.notizen, 100_000),
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
    const u = zahl(f[fk.id], 0, 0, 2);
    if (u > 0) fertigkeiten[fk.id] = u as Uebung;
  }
  const tp = (w.tp && typeof w.tp === 'object' ? w.tp : {}) as Record<string, unknown>;
  const max = zahl(tp.max, leer.tp.max, 1, 9999);
  const ts = (w.todesrettung && typeof w.todesrettung === 'object' ? w.todesrettung : {}) as Record<string, unknown>;
  bogen.werte = {
    spieler: text(w.spieler, 80),
    spezies: text(w.spezies, 80),
    hintergrund: text(w.hintergrund, 80),
    klassen: Array.isArray(w.klassen)
      ? w.klassen.slice(0, 6).map((k) => {
          const kk = (k && typeof k === 'object' ? k : {}) as Record<string, unknown>;
          return { name: text(kk.name, 60), stufe: zahl(kk.stufe, 1, 1, 20) };
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
          return { name: text(xx.name, 80), bonus: text(xx.bonus, 20), schaden: text(xx.schaden, 60), notiz: text(xx.notiz, 200) };
        })
      : [],
    ...(bereinigeZauberei(w.zauber) ? { zauber: bereinigeZauberei(w.zauber) } : {})
  };
  if (bogen.werte.klassen.length === 0) bogen.werte.klassen = leer.klassen;
  return bogen;
}
