/**
 * Boegen live im Raum (docs/charakterbogen.md, „Live im Raum").
 *
 * Der Charakterbogen beim Gastgeber fuehrt den Stand aller Boegen, die
 * jemand in den Raum gebracht hat. Aenderungen kommen als Schritte an („Feld
 * X = Wert", „TP −7"), werden gegen die Rolle geprueft, der Reihe nach
 * angewandt und an alle verteilt, die den Bogen sehen duerfen. Verteilt wird
 * der ganze Bogen (oder seine Uebersicht), nicht der Schritt: so kann bei
 * niemandem eine Luecke entstehen, und die Boegen sind klein.
 *
 * Rein und ohne Netz: `LiveTisch` bekommt Anfragen und liefert, was an wen
 * geht. Die Leitung legt der Hauptprozess darum (main/live.ts).
 */
import { bereinige, leseBetrag, wendeBetragAn, MAX_VERLAUF, type Bogen } from './bogen';
import { klassenText, zuId } from './ablage';

export type Freigabe = 'nichts' | 'uebersicht' | 'alles';
export const FREIGABEN: readonly Freigabe[] = ['nichts', 'uebersicht', 'alles'];
export const VORGABE_FREIGABE: Freigabe = 'uebersicht';

/** Eine Aenderung. `feld` setzt einen Wert, `betrag` rechnet Schaden oder Heilung beim Gastgeber. */
export type Schritt =
  | { readonly typ: 'feld'; readonly pfad: readonly string[]; readonly wert?: unknown; readonly loeschen?: boolean }
  | { readonly typ: 'betrag'; readonly text: string };

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly sl?: boolean;
}

/** Eine Aenderung durch die SL an einem fremden Bogen. */
export interface SlAenderung {
  readonly zeit: string;
  readonly von: string;
  readonly felder: readonly string[];
  /** Der alte Wert je Feld, kurz, zum Darueberfahren. */
  readonly alt: Readonly<Record<string, string>>;
  /** Still: nur die SL sieht sie. */
  readonly still: boolean;
  /** Noch nicht von der Besitzerin bestaetigt. */
  readonly offen: boolean;
}

/** Was jemand von einem Bogen sieht, wenn die Freigabe nur die Uebersicht erlaubt. */
export interface Uebersicht {
  readonly name: string;
  readonly art: Bogen['art'];
  readonly kurz: string;
  /** Ungefaehr, nicht die Zahl: voll, leicht, schwer, am Boden. */
  readonly tpStufe: 'voll' | 'leicht' | 'schwer' | 'boden' | null;
  readonly rk: number | null;
  readonly zustaende: readonly string[];
}

/** Ein Bogen, wie ihn eine Person bekommt. */
export interface LiveEintrag {
  /** Kennung im Raum: `<Person>/<Bogen>`. */
  readonly id: string;
  readonly besitzer: { readonly id: string; readonly name: string };
  readonly freigabe: Freigabe;
  readonly sicht: 'voll' | 'uebersicht';
  readonly darfAendern: boolean;
  readonly bogen?: Bogen;
  readonly uebersicht: Uebersicht;
  /** Fuer die Besitzerin die offenen, fuer die SL alle. Sonst leer. */
  readonly slAenderungen: readonly SlAenderung[];
  /** Die hoechste Schrittnummer dieser Person, die schon drin ist. */
  readonly quittung: number;
  /** Wer zuletzt etwas geaendert hat. */
  readonly zuletzt: { readonly name: string; readonly zeit: string } | null;
}

/** Anfragen an den Gastgeber. */
export type Anfrage =
  | { readonly art: 'hallo' }
  | { readonly art: 'bringe'; readonly bogen: unknown }
  | { readonly art: 'schritte'; readonly id: string; readonly nr: number; readonly schritte: readonly Schritt[]; readonly still?: boolean }
  | { readonly art: 'zurueck'; readonly id: string }
  | { readonly art: 'freigabe'; readonly id: string; readonly freigabe: Freigabe }
  | { readonly art: 'bestaetige'; readonly id: string };

/** Was der Gastgeber schickt. */
export type Meldung =
  | { readonly art: 'stand'; readonly eintraege: readonly LiveEintrag[] }
  | { readonly art: 'bogen'; readonly eintrag: LiveEintrag }
  | { readonly art: 'weg'; readonly id: string }
  | { readonly art: 'abgelehnt'; readonly id: string | null; readonly grund: 'recht' | 'unbekannt' | 'ungueltig' | 'voll' };

export interface Ausgang {
  readonly an: string;
  readonly meldung: Meldung;
}

/** Hoechstens so viele Boegen je Person im Raum. */
export const MAX_BOEGEN_JE_PERSON = 12;
const MAX_SL_AENDERUNGEN = 50;
const MAX_SCHRITTE = 200;

// --- Schritte aus zwei Staenden ---------------------------------------------

/** Diese Felder reisen nie als Schritt: sie gehoeren dem Gastgeber oder der Datei. */
const NICHT_ALS_SCHRITT = new Set(['id', 'schema', 'art', 'fassung', 'geaendert', 'verlauf']);
/** Nur diese Felder oben am Bogen darf ein Schritt setzen. */
const ERLAUBT_OBEN = new Set(['name', 'notizen', 'werte', 'muenzen', 'gegenstaende', 'muenzgewicht']);
const VERBOTEN = new Set(['__proto__', 'prototype', 'constructor']);

function istObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function gleich(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Die Schritte von `alt` nach `neu`. Objekte werden durchlaufen, Listen und
 * einfache Werte sind ein Schritt: eine Liste (Gegenstaende, Angriffe) geht
 * als Ganzes. Das ist gewollt einfach; wer gleichzeitig dieselbe Liste
 * aendert, bei dem gewinnt die spaetere.
 */
export function schritteAus(alt: Bogen, neu: Bogen): Schritt[] {
  const heraus: Schritt[] = [];
  const lauf = (a: unknown, b: unknown, pfad: string[]) => {
    if (gleich(a, b)) return;
    if (istObjekt(a) && istObjekt(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (pfad.length === 0 && NICHT_ALS_SCHRITT.has(k)) continue;
        lauf(a[k], b[k], [...pfad, k]);
      }
      return;
    }
    heraus.push(b === undefined ? { typ: 'feld', pfad, loeschen: true } : { typ: 'feld', pfad, wert: b });
  };
  lauf(alt, neu, []);
  return heraus;
}

function wertBei(x: unknown, pfad: readonly string[]): unknown {
  let ort = x;
  for (const teil of pfad) ort = istObjekt(ort) ? ort[teil] : undefined;
  return ort;
}

function kurzerWert(x: unknown): string {
  if (x === undefined || x === null) return '—';
  const text = typeof x === 'string' ? x : JSON.stringify(x);
  return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}

function pfadGut(pfad: readonly unknown[]): pfad is readonly string[] {
  return (
    pfad.length >= 1 &&
    pfad.length <= 6 &&
    pfad.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 60 && !VERBOTEN.has(p)) &&
    ERLAUBT_OBEN.has(pfad[0] as string)
  );
}

/**
 * Wendet einen Schritt an. Ungueltig → null. Danach geht der Bogen durch
 * `bereinige`: was nicht passt (Text statt Zahl, zu lang), wird dort
 * zurechtgerueckt, wie beim Lesen einer Datei.
 */
export function wendeSchrittAn(bogen: Bogen, s: Schritt): Bogen | null {
  if (!s || typeof s !== 'object') return null;
  if (s.typ === 'betrag') {
    if (!bogen.werte || typeof s.text !== 'string' || s.text.length > 60) return null;
    const betrag = leseBetrag(s.text);
    if (betrag === null) return null;
    return { ...bogen, werte: wendeBetragAn(bogen.werte, betrag) };
  }
  if (s.typ !== 'feld' || !Array.isArray(s.pfad) || !pfadGut(s.pfad)) return null;
  const kopie = JSON.parse(JSON.stringify(bogen)) as Record<string, unknown>;
  let ort: Record<string, unknown> = kopie;
  for (const teil of s.pfad.slice(0, -1)) {
    const weiter = ort[teil];
    if (!istObjekt(weiter)) {
      if (weiter !== undefined) return null;
      ort[teil] = {};
    }
    ort = ort[teil] as Record<string, unknown>;
  }
  const letzter = s.pfad[s.pfad.length - 1];
  if (s.loeschen) delete ort[letzter];
  else ort[letzter] = s.wert === undefined ? null : JSON.parse(JSON.stringify(s.wert));
  const sauber = bereinige(kopie, bogen.id);
  return { ...sauber, fassung: bogen.fassung, geaendert: bogen.geaendert, verlauf: bogen.verlauf };
}

// --- Sichten ----------------------------------------------------------------

export function uebersichtVon(b: Bogen): Uebersicht {
  const w = b.werte;
  let tpStufe: Uebersicht['tpStufe'] = null;
  if (w) {
    const anteil = w.tp.max > 0 ? w.tp.aktuell / w.tp.max : 0;
    tpStufe = w.tp.aktuell <= 0 ? 'boden' : anteil >= 1 ? 'voll' : anteil > 0.5 ? 'leicht' : 'schwer';
  }
  return {
    name: b.name,
    art: b.art,
    kurz: [klassenText(b), w?.spezies.trim() ?? ''].filter(Boolean).join(' · '),
    tpStufe,
    rk: w ? w.rk : null,
    zustaende: w ? [...w.zustaende] : []
  };
}

interface Intern {
  readonly id: string;
  bogen: Bogen;
  readonly besitzer: { id: string; name: string };
  freigabe: Freigabe;
  sl: SlAenderung[];
  quittung: Record<string, number>;
  zuletzt: { name: string; zeit: string } | null;
}

/**
 * Der Stand beim Gastgeber. Kennt die Personen im Raum (mit Rolle) und die
 * Boegen darin.
 */
export class LiveTisch {
  private eintraege = new Map<string, Intern>();
  private personen: Person[] = [];

  constructor(private readonly jetzt: () => string = () => new Date().toISOString()) {}

  /** Die Personenliste hat sich geaendert. Wer geht, nimmt seine Boegen mit. */
  setzePersonen(personen: readonly Person[]): Ausgang[] {
    const vorher = new Map(this.personen.map((p) => [p.id, p]));
    this.personen = [...personen];
    const da = new Set(personen.map((p) => p.id));
    for (const [id, e] of this.eintraege) if (!da.has(e.besitzer.id)) this.eintraege.delete(id);
    // Neue Personen, geaenderte Rollen oder Abgaenge: alle bekommen den ganzen Stand neu.
    const anders =
      personen.length !== vorher.size ||
      personen.some((p) => {
        const alt = vorher.get(p.id);
        return !alt || (alt.sl === true) !== (p.sl === true) || alt.name !== p.name;
      });
    return anders ? this.standFuerAlle() : [];
  }

  /** Alle Boegen, wie `personId` sie sieht. */
  ansichtFuer(personId: string): LiveEintrag[] {
    const p = this.personen.find((x) => x.id === personId);
    if (!p) return [];
    return [...this.eintraege.values()].flatMap((e) => {
      const sicht = this.sicht(e, p);
      return sicht ? [sicht] : [];
    });
  }

  /** Nur die Boegen einer Person (zum Speichern beim Besitzer). */
  eigene(personId: string): Bogen[] {
    return [...this.eintraege.values()].filter((e) => e.besitzer.id === personId).map((e) => e.bogen);
  }

  anfrage(vonId: string, a: Anfrage): Ausgang[] {
    const von = this.personen.find((p) => p.id === vonId);
    if (!von || !a || typeof a !== 'object') return [];
    const ablehnen = (id: string | null, grund: Extract<Meldung, { art: 'abgelehnt' }>['grund']): Ausgang[] => [
      { an: vonId, meldung: { art: 'abgelehnt', id, grund } }
    ];
    switch (a.art) {
      case 'hallo':
        return [{ an: vonId, meldung: { art: 'stand', eintraege: this.ansichtFuer(vonId) } }];
      case 'bringe': {
        const roh = a.bogen as { id?: unknown } | null;
        if (!roh || typeof roh !== 'object') return ablehnen(null, 'ungueltig');
        const bogenId = zuId(typeof roh.id === 'string' ? roh.id : '');
        const id = `${vonId}/${bogenId}`;
        const alt = this.eintraege.get(id);
        if (!alt && this.eigene(vonId).length >= MAX_BOEGEN_JE_PERSON) return ablehnen(null, 'voll');
        const bogen = bereinige(roh, bogenId);
        const e: Intern = alt
          ? { ...alt, bogen }
          : { id, bogen, besitzer: { id: von.id, name: von.name }, freigabe: VORGABE_FREIGABE, sl: [], quittung: {}, zuletzt: null };
        this.eintraege.set(id, e);
        return this.verteile(e);
      }
      case 'zurueck': {
        const e = this.eintraege.get(String(a.id));
        if (!e) return ablehnen(String(a.id), 'unbekannt');
        if (e.besitzer.id !== vonId && !von.sl) return ablehnen(e.id, 'recht');
        this.eintraege.delete(e.id);
        return this.personen.map((p) => ({ an: p.id, meldung: { art: 'weg', id: e.id } }));
      }
      case 'freigabe': {
        const e = this.eintraege.get(String(a.id));
        if (!e) return ablehnen(String(a.id), 'unbekannt');
        if (e.besitzer.id !== vonId && !von.sl) return ablehnen(e.id, 'recht');
        if (!FREIGABEN.includes(a.freigabe)) return ablehnen(e.id, 'ungueltig');
        e.freigabe = a.freigabe;
        // Wer den Bogen nicht mehr sieht, bekommt „weg".
        return this.personen.map((p) => {
          const sicht = this.sicht(e, p);
          return { an: p.id, meldung: sicht ? { art: 'bogen', eintrag: sicht } : { art: 'weg', id: e.id } };
        });
      }
      case 'bestaetige': {
        const e = this.eintraege.get(String(a.id));
        if (!e) return ablehnen(String(a.id), 'unbekannt');
        if (e.besitzer.id !== vonId) return ablehnen(e.id, 'recht');
        e.sl = e.sl.map((x) => (x.offen ? { ...x, offen: false } : x));
        return this.verteile(e);
      }
      case 'schritte': {
        const e = this.eintraege.get(String(a.id));
        if (!e) return ablehnen(String(a.id), 'unbekannt');
        const istBesitzer = e.besitzer.id === vonId;
        if (!istBesitzer && !von.sl) return ablehnen(e.id, 'recht');
        if (!Array.isArray(a.schritte) || a.schritte.length > MAX_SCHRITTE) return ablehnen(e.id, 'ungueltig');
        let bogen = e.bogen;
        const felder: string[] = [];
        const alt: Record<string, string> = {};
        for (const s of a.schritte) {
          const neu = wendeSchrittAn(bogen, s);
          if (!neu) continue;
          const pfad = s.typ === 'betrag' ? ['werte', 'tp', 'aktuell'] : [...s.pfad];
          const feld = pfad.join('.');
          if (!felder.includes(feld)) {
            felder.push(feld);
            alt[feld] = kurzerWert(wertBei(bogen, pfad));
          }
          bogen = neu;
        }
        const nr = Number.isFinite(a.nr) ? Math.floor(a.nr) : 0;
        e.quittung[vonId] = Math.max(e.quittung[vonId] ?? 0, nr);
        if (felder.length > 0) {
          const zeit = this.jetzt();
          e.bogen = { ...bogen, fassung: e.bogen.fassung + 1, geaendert: zeit };
          e.zuletzt = { name: von.name, zeit };
          if (!istBesitzer) {
            const still = a.still === true;
            e.sl = [{ zeit, von: von.name, felder, alt, still, offen: !still }, ...e.sl].slice(0, MAX_SL_AENDERUNGEN);
            e.bogen = {
              ...e.bogen,
              verlauf: [{ zeit, text: `SL ${von.name}: ${felder.join(', ')}${still ? ' (still)' : ''}` }, ...e.bogen.verlauf].slice(
                0,
                MAX_VERLAUF
              )
            };
          }
        }
        return this.verteile(e);
      }
      default:
        return ablehnen(null, 'ungueltig');
    }
  }

  private sicht(e: Intern, p: Person): LiveEintrag | null {
    const istBesitzer = e.besitzer.id === p.id;
    const sl = p.sl === true;
    const voll = istBesitzer || sl || e.freigabe === 'alles';
    if (!voll && e.freigabe === 'nichts') return null;
    // Stille Aenderungen sieht nur die SL; die Besitzerin sieht nur offene.
    const slAenderungen = sl ? e.sl : istBesitzer ? e.sl.filter((x) => x.offen && !x.still) : [];
    return {
      id: e.id,
      besitzer: e.besitzer,
      freigabe: e.freigabe,
      sicht: voll ? 'voll' : 'uebersicht',
      darfAendern: istBesitzer || sl,
      ...(voll ? { bogen: e.bogen } : {}),
      uebersicht: uebersichtVon(e.bogen),
      slAenderungen,
      quittung: e.quittung[p.id] ?? 0,
      zuletzt: e.zuletzt
    };
  }

  private verteile(e: Intern): Ausgang[] {
    return this.personen.flatMap((p) => {
      const sicht = this.sicht(e, p);
      return sicht ? [{ an: p.id, meldung: { art: 'bogen', eintrag: sicht } as Meldung }] : [];
    });
  }

  private standFuerAlle(): Ausgang[] {
    return this.personen.map((p) => ({ an: p.id, meldung: { art: 'stand', eintraege: this.ansichtFuer(p.id) } }));
  }
}

/** Eine Meldung vom Gastgeber pruefen, bevor sie jemand anfasst. Unbrauchbar → null. */
export function leseMeldung(text: string): Meldung | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  if (!istObjekt(roh)) return null;
  const eintrag = (x: unknown): LiveEintrag | null => {
    if (!istObjekt(x) || typeof x.id !== 'string' || !istObjekt(x.besitzer) || !istObjekt(x.uebersicht)) return null;
    const bogenId = x.id.split('/').pop() ?? 'bogen';
    return {
      ...(x as unknown as LiveEintrag),
      ...(x.bogen ? { bogen: bereinige(x.bogen, zuId(bogenId)) } : {}),
      slAenderungen: Array.isArray(x.slAenderungen) ? (x.slAenderungen as SlAenderung[]).slice(0, MAX_SL_AENDERUNGEN) : [],
      quittung: Number(x.quittung) || 0
    };
  };
  switch (roh.art) {
    case 'stand':
      return Array.isArray(roh.eintraege)
        ? { art: 'stand', eintraege: roh.eintraege.flatMap((x) => (eintrag(x) ? [eintrag(x)!] : [])) }
        : null;
    case 'bogen': {
      const e = eintrag(roh.eintrag);
      return e ? { art: 'bogen', eintrag: e } : null;
    }
    case 'weg':
      return typeof roh.id === 'string' ? { art: 'weg', id: roh.id } : null;
    case 'abgelehnt':
      return { art: 'abgelehnt', id: typeof roh.id === 'string' ? roh.id : null, grund: roh.grund as never };
    default:
      return null;
  }
}
