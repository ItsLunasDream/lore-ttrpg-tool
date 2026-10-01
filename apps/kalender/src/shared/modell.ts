/**
 * Das Modell des Campaign Calendar (docs/kampagnenkalender.md).
 *
 * Eine Terminumfrage wie bei Crab.fit: Tage und ein Zeitfenster, alle
 * markieren im Raster, wann sie können („kann") oder notfalls können. Daraus
 * eine Heatmap und die besten Zeitfenster für die gewünschte Dauer. Die SL
 * legt einen Termin fest; der lässt sich als .ics in jeden Kalender holen.
 *
 * Antworten kommen über den Raum oder als Datei. Zusammengeführt wird nach
 * Namen (ohne Groß/klein), die neuere Antwort gewinnt. Reine Funktionen, die
 * Tests laufen ohne Electron.
 */

export type Stufe = 'kann' | 'notfalls';

export interface Antwort {
  /** Der Name, unter dem die Person antwortet; eindeutig je Umfrage. */
  readonly person: string;
  /** Feld → Stufe; fehlt ein Feld, kann die Person dann nicht. */
  readonly felder: Readonly<Record<string, Stufe>>;
  /** ISO-Zeitpunkt der letzten Änderung, zum Zusammenführen. */
  readonly zeit: string;
}

export interface Termin {
  readonly tag: string;
  /** Minuten ab Mitternacht. */
  readonly von: number;
  readonly bis: number;
}

export interface Umfrage {
  readonly id: string;
  readonly titel: string;
  /** Tage als „JJJJ-MM-TT", aufsteigend. */
  readonly tage: readonly string[];
  /** Zeitfenster in Minuten ab Mitternacht; `bis` ist exklusiv. */
  readonly von: number;
  readonly bis: number;
  /** 30 oder 60 Minuten je Feld. */
  readonly schritt: 30 | 60;
  /** Gewünschte Dauer einer Sitzung in Minuten. */
  readonly dauer: number;
  readonly antworten: readonly Antwort[];
  readonly termin: Termin | null;
  readonly notiz: string;
  readonly geaendert: string;
}

export const HOECHSTENS_TAGE = 31;

// --- Felder -------------------------------------------------------------------

export function feld(tag: string, minute: number): string {
  return `${tag}T${minute}`;
}

export function zeiten(u: Pick<Umfrage, 'von' | 'bis' | 'schritt'>): number[] {
  const heraus: number[] = [];
  for (let m = u.von; m < u.bis; m += u.schritt) heraus.push(m);
  return heraus;
}

export function uhrzeit(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Tage von `start` bis `ende` (einschließlich), nur an den gewählten Wochentagen (0 = Sonntag). */
export function tageZwischen(start: string, ende: string, wochentage: readonly number[] = [0, 1, 2, 3, 4, 5, 6]): string[] {
  const heraus: string[] = [];
  const a = new Date(`${start}T12:00:00Z`);
  const b = new Date(`${ende}T12:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return [];
  for (let d = a; d <= b && heraus.length < HOECHSTENS_TAGE; d = new Date(d.getTime() + 86_400_000)) {
    if (wochentage.includes(d.getUTCDay())) heraus.push(d.toISOString().slice(0, 10));
  }
  return heraus;
}

export function leereUmfrage(id: string, heute: string): Umfrage {
  const in13 = new Date(new Date(`${heute}T12:00:00Z`).getTime() + 13 * 86_400_000).toISOString().slice(0, 10);
  return {
    id,
    titel: '',
    tage: tageZwischen(heute, in13, [5, 6, 0]),
    von: 17 * 60,
    bis: 23 * 60,
    schritt: 60,
    dauer: 4 * 60,
    antworten: [],
    termin: null,
    notiz: '',
    geaendert: ''
  };
}

// --- Antworten ----------------------------------------------------------------

function gleicherName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Setzt oder ersetzt die Antwort einer Person; die neuere gewinnt. */
export function mitAntwort(u: Umfrage, a: Antwort): Umfrage {
  const alt = u.antworten.find((x) => gleicherName(x.person, a.person));
  if (alt && alt.zeit > a.zeit) return u;
  return { ...u, antworten: [...u.antworten.filter((x) => !gleicherName(x.person, a.person)), a] };
}

/** Zwei Stände derselben Umfrage zusammen: alle Antworten, je Person die neuere. */
export function fuehreZusammen(eigene: Umfrage, fremde: Umfrage): Umfrage {
  let heraus: Umfrage = eigene;
  for (const a of fremde.antworten) heraus = mitAntwort(heraus, a);
  // Ein festgelegter Termin geht nicht verloren, nur weil der andere Stand ihn noch nicht kennt.
  return { ...heraus, termin: heraus.termin ?? fremde.termin };
}

// --- Heatmap und beste Termine ------------------------------------------------

export interface Belegung {
  readonly kann: readonly string[];
  readonly notfalls: readonly string[];
  readonly nicht: readonly string[];
}

export function belegung(u: Umfrage, f: string): Belegung {
  const kann: string[] = [];
  const notfalls: string[] = [];
  const nicht: string[] = [];
  for (const a of u.antworten) {
    const s = a.felder[f];
    (s === 'kann' ? kann : s === 'notfalls' ? notfalls : nicht).push(a.person);
  }
  return { kann, notfalls, nicht };
}

/** Wert eines Felds für die Heatmap: „kann" zählt 1, „notfalls" ½. */
export function gewicht(b: Belegung): number {
  return b.kann.length + b.notfalls.length / 2;
}

export interface Vorschlag extends Termin {
  /** Wer im ganzen Fenster kann. */
  readonly kann: readonly string[];
  /** Wer im ganzen Fenster wenigstens notfalls kann (und nicht in „kann" steht). */
  readonly notfalls: readonly string[];
  readonly punkte: number;
}

/**
 * Die besten Zeitfenster der gewünschten Dauer. Eine Person zählt in einem
 * Fenster nur, wenn sie in JEDEM Feld kann (bzw. notfalls kann); eine Sitzung
 * mit halber Besetzung in der zweiten Hälfte hilft nicht.
 */
export function besteTermine(u: Umfrage, anzahl = 3): Vorschlag[] {
  const felderJe = Math.max(1, Math.ceil(u.dauer / u.schritt));
  const zs = zeiten(u);
  const alle: Vorschlag[] = [];
  for (const tag of u.tage) {
    for (let i = 0; i + felderJe <= zs.length; i += 1) {
      const fenster = zs.slice(i, i + felderJe);
      const kann: string[] = [];
      const notfalls: string[] = [];
      for (const a of u.antworten) {
        const stufen = fenster.map((m) => a.felder[feld(tag, m)]);
        if (stufen.every((s) => s === 'kann')) kann.push(a.person);
        else if (stufen.every((s) => s === 'kann' || s === 'notfalls')) notfalls.push(a.person);
      }
      const punkte = kann.length + notfalls.length / 2;
      if (punkte > 0) alle.push({ tag, von: fenster[0], bis: fenster[fenster.length - 1] + u.schritt, kann, notfalls, punkte });
    }
  }
  alle.sort((a, b) => b.punkte - a.punkte || b.kann.length - a.kann.length || a.tag.localeCompare(b.tag) || a.von - b.von);
  // Nicht dreimal fast derselbe Abend: je Tag nur der beste Vorschlag.
  const heraus: Vorschlag[] = [];
  for (const v of alle) {
    if (heraus.some((x) => x.tag === v.tag)) continue;
    heraus.push(v);
    if (heraus.length >= anzahl) break;
  }
  return heraus;
}

// --- .ics ---------------------------------------------------------------------

function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsZeit(tag: string, minute: number): string {
  // Über Mitternacht hinaus: der nächste Tag.
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCMinutes(minute);
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15);
}

/**
 * Der Termin als iCalendar (RFC 5545). Die Zeiten stehen als „floating
 * time" ohne Zeitzone: 19:00 bleibt 19:00 im Kalender, egal wo. Das passt zu
 * einer Gruppe am selben Ort; für Gruppen über Zeitzonen hinweg wäre eine
 * Zeitzone nötig (nicht gebaut).
 */
export function alsIcs(u: Umfrage, jetzt = new Date()): string | null {
  if (!u.termin) return null;
  const stempel = jetzt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lore TTRPG Tool//Campaign Calendar//DE',
    'BEGIN:VEVENT',
    `UID:${u.id}-${u.termin.tag}@lore-ttrpg-tool`,
    `DTSTAMP:${stempel}`,
    `DTSTART:${icsZeit(u.termin.tag, u.termin.von)}`,
    `DTEND:${icsZeit(u.termin.tag, u.termin.bis)}`,
    `SUMMARY:${icsText(u.titel || 'TTRPG')}`,
    ...(u.notiz.trim() ? [`DESCRIPTION:${icsText(u.notiz.trim())}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return `${zeilen.join('\r\n')}\r\n`;
}

// --- Prüfen beim Einlesen -----------------------------------------------------

const TAG = /^\d{4}-\d{2}-\d{2}$/;

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function minute(x: unknown, ersatz: number): number {
  const n = Math.round(Number(x));
  return Number.isFinite(n) && n >= 0 && n <= 24 * 60 ? n : ersatz;
}

export function bereinigeAntwort(x: unknown): Antwort | null {
  const r = obj(x);
  const person = typeof r.person === 'string' ? r.person.trim().slice(0, 60) : '';
  if (!person) return null;
  const felder: Record<string, Stufe> = {};
  for (const [k, v] of Object.entries(obj(r.felder)).slice(0, 2000)) {
    if (/^\d{4}-\d{2}-\d{2}T\d{1,4}$/.test(k) && (v === 'kann' || v === 'notfalls')) felder[k] = v;
  }
  return { person, felder, zeit: typeof r.zeit === 'string' ? r.zeit.slice(0, 40) : '' };
}

export function bereinige(roh: unknown, id: string): Umfrage {
  const r = obj(roh);
  const tage = (Array.isArray(r.tage) ? r.tage : []).filter((t): t is string => typeof t === 'string' && TAG.test(t)).slice(0, HOECHSTENS_TAGE);
  const von = minute(r.von, 17 * 60);
  const bis = Math.max(von + 30, minute(r.bis, 23 * 60));
  const schritt = r.schritt === 30 ? 30 : 60;
  const t = obj(r.termin);
  const termin =
    typeof t.tag === 'string' && TAG.test(t.tag) ? { tag: t.tag, von: minute(t.von, von), bis: Math.max(minute(t.von, von) + 30, minute(t.bis, bis)) } : null;
  const antworten: Antwort[] = [];
  for (const a of (Array.isArray(r.antworten) ? r.antworten : []).slice(0, 50)) {
    const sauber = bereinigeAntwort(a);
    if (sauber && !antworten.some((x) => gleicherName(x.person, sauber.person))) antworten.push(sauber);
  }
  return {
    id,
    titel: typeof r.titel === 'string' ? r.titel.slice(0, 120) : '',
    tage: [...new Set(tage)].sort(),
    von,
    bis,
    schritt,
    dauer: Math.max(schritt, Math.min(24 * 60, Math.round(Number(r.dauer) || 4 * 60))),
    antworten,
    termin,
    notiz: typeof r.notiz === 'string' ? r.notiz.slice(0, 5000) : '',
    geaendert: typeof r.geaendert === 'string' ? r.geaendert.slice(0, 40) : ''
  };
}

// --- Nachrichten im Raum ------------------------------------------------------

/** Was über den Raum geht. Klein: eine Umfrage oder eine Antwort. */
export type Nachricht =
  | { readonly art: 'umfrage'; readonly umfrage: Umfrage }
  | { readonly art: 'antwort'; readonly umfrageId: string; readonly antwort: Antwort };

export function leseNachricht(text: string): Nachricht | null {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return null;
  }
  const r = obj(roh);
  if (r.art === 'umfrage') {
    const u = obj(r.umfrage);
    const id = typeof u.id === 'string' && /^[a-z0-9-]{1,80}$/.test(u.id) ? u.id : '';
    return id ? { art: 'umfrage', umfrage: bereinige(u, id) } : null;
  }
  if (r.art === 'antwort' && typeof r.umfrageId === 'string' && /^[a-z0-9-]{1,80}$/.test(r.umfrageId)) {
    const a = bereinigeAntwort(r.antwort);
    return a ? { art: 'antwort', umfrageId: r.umfrageId, antwort: a } : null;
  }
  return null;
}

/** Eine eingegangene Nachricht auf den eigenen Stand anwenden; null = gehört zu keiner bekannten Umfrage. */
export function wendeAn(eigene: Umfrage | null, n: Nachricht): Umfrage | null {
  if (n.art === 'umfrage') return eigene ? fuehreZusammen({ ...n.umfrage, antworten: eigene.antworten }, n.umfrage) : n.umfrage;
  return eigene ? mitAntwort(eigene, n.antwort) : null;
}
