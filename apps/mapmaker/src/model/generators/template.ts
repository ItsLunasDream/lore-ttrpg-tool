/**
 * Fertige Orte statt leerer Grundrisse: Taverne, Wachhaus, Kate, Schrein,
 * Waldlichtung, Wegkreuzung.
 *
 * Früher waren das von Hand gesetzte Anordnungen, in denen nur Kleinkram ein
 * Feld hin- und herrückte. Rückmeldung dazu: „Eine Vorlage, bei der sich Props
 * nur ein Feld hin oder her bewegen, hat keinen Mehrwert — das ist eine reine
 * Vorlage statt eines Generators." Und zur Taverne: Theke nicht nur an einer
 * Stelle, ein Platz für die Tische, Kisten und Fässer nicht mitten im
 * Tischbereich.
 *
 * Jetzt sind es Generatoren mit Regeln statt Koordinaten:
 *
 * - **Größe, Eingang und Zonen würfeln**, die Regeln bleiben: die Theke steht
 *   an einer Wand, dahinter liegt der Vorrat; das Feuer an einer anderen Wand
 *   mit den besten Plätzen davor; vom Eingang führt ein freier Laufweg in den
 *   Raum.
 * - **Eine Belegungskarte** (`Belegung`) verhindert, dass Möbel ineinander
 *   oder in Laufwege gestellt werden. Tische landen nur im Gastbereich,
 *   Kisten und Fässer nur hinter der Theke oder im Lager.
 * - **Gedreht und gespiegelt**: gebaut wird in einer Grundausrichtung, das
 *   fertige Ergebnis wird zufällig um 0/90/180/270° gedreht und gespiegelt.
 *   So steht die Theke mal im Norden, mal im Westen, ohne dass jede Regel
 *   viermal geschrieben werden muss.
 *
 * Das Ergebnis bleibt ein ganz normales `GeneratedMap`: alles wird zu
 * Objekten, die man anfassen, verschieben und löschen kann.
 */

import { Rng } from '../rng';
import { emptyResult, type BaseOptions, type GeneratedMap } from './types';

export type TemplateId =
  | 'tavern'
  | 'guardhouse'
  | 'cottage'
  | 'shrine'
  | 'clearing'
  | 'crossroads';

export const TEMPLATE_IDS: TemplateId[] = [
  'tavern',
  'guardhouse',
  'cottage',
  'shrine',
  'clearing',
  'crossroads',
];

export interface TemplateOptions extends BaseOptions {
  variant: TemplateId;
  /** Ausstattung setzen; aus bleibt der nackte Grundriss. */
  furnish: boolean;
  /** Fackeln und Feuerschein als Lichtquellen mitgeben. */
  lights: boolean;
}

/**
 * Richtgröße je Vorlage, in Feldern. Die tatsächliche Größe würfelt der
 * Generator um diesen Wert; das Ergebnis trägt sie in `size`.
 */
const GROESSE: Record<TemplateId, { cols: number; rows: number }> = {
  tavern: { cols: 18, rows: 16 },
  guardhouse: { cols: 15, rows: 12 },
  cottage: { cols: 12, rows: 11 },
  shrine: { cols: 13, rows: 14 },
  clearing: { cols: 20, rows: 18 },
  crossroads: { cols: 18, rows: 18 },
};

export function templateSize(id: TemplateId): { cols: number; rows: number } {
  return GROESSE[id];
}

export function defaultTemplateOptions(): Omit<TemplateOptions, 'seed' | 'tileSize'> {
  const g = GROESSE.tavern;
  return { cols: g.cols, rows: g.rows, variant: 'tavern', furnish: true, lights: true };
}

// ---------------------------------------------------------------------------
// Belegung
// ---------------------------------------------------------------------------

/**
 * Welche Flächen schon vergeben sind, in halben Feldern.
 *
 * Halbe Felder, weil ein Stuhl am Tisch eben keine ganze Zelle braucht; mit
 * ganzen Feldern passten in eine kleine Taverne kaum zwei Tische.
 */
class Belegung {
  private zellen: Uint8Array;
  private readonly b: number;
  private readonly h: number;

  constructor(cols: number, rows: number) {
    this.b = Math.ceil(cols * 2);
    this.h = Math.ceil(rows * 2);
    this.zellen = new Uint8Array(this.b * this.h);
  }

  private bereich(c0: number, r0: number, c1: number, r1: number): [number, number, number, number] {
    return [
      Math.max(0, Math.floor(c0 * 2)),
      Math.max(0, Math.floor(r0 * 2)),
      Math.min(this.b, Math.ceil(c1 * 2)),
      Math.min(this.h, Math.ceil(r1 * 2)),
    ];
  }

  frei(c0: number, r0: number, c1: number, r1: number): boolean {
    const [x0, y0, x1, y1] = this.bereich(c0, r0, c1, r1);
    if (x1 <= x0 || y1 <= y0) return false;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (this.zellen[y * this.b + x]) return false;
    return true;
  }

  belege(c0: number, r0: number, c1: number, r1: number): void {
    const [x0, y0, x1, y1] = this.bereich(c0, r0, c1, r1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.zellen[y * this.b + x] = 1;
  }
}

// ---------------------------------------------------------------------------
// Baukasten
// ---------------------------------------------------------------------------

/**
 * Baukasten für eine Vorlage.
 *
 * Alle Maße in Feldern; die Umrechnung in Weltpixel passiert genau hier und
 * nirgends sonst. Ein halbes Feld Versatz ist der Unterschied zwischen „Stuhl
 * am Tisch" und „Stuhl in der Wand", und den will man beim Setzen sehen, nicht
 * ausrechnen.
 */
class Bau {
  readonly out: GeneratedMap;
  readonly belegt: Belegung;

  constructor(
    private rng: Rng,
    private s: number,
    readonly cols: number,
    readonly rows: number,
    private opts: TemplateOptions,
  ) {
    this.out = emptyResult(cols, rows);
    this.belegt = new Belegung(cols, rows);
  }

  boden(c: number, r: number, w: number, h: number, color: number): void {
    const x0 = c * this.s;
    const y0 = r * this.s;
    const x1 = (c + w) * this.s;
    const y1 = (r + h) * this.s;
    this.out.floors.push({ points: [x0, y0, x1, y0, x1, y1, x0, y1], color });
  }

  /** Unregelmäßige Fläche — für alles, was nicht gebaut, sondern gewachsen ist. */
  fleck(c: number, r: number, radius: number, color: number, wobble = 0.22, streck = 1): void {
    const punkte: number[] = [];
    const n = 22;
    const p1 = this.rng.range(0, Math.PI * 2);
    const p2 = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad = radius * (1 + wobble * Math.sin(2 * a + p1) + wobble * 0.55 * Math.sin(3 * a + p2));
      punkte.push((c + Math.cos(a) * rad * streck) * this.s, (r + Math.sin(a) * rad) * this.s);
    }
    this.out.floors.push({ points: punkte, color });
  }

  /** Ein Band entlang eines Linienzugs — Wege, Bäche. */
  band(punkte: Array<[number, number]>, breite: number, color: number): void {
    for (let i = 0; i + 1 < punkte.length; i++) {
      const [c0, r0] = punkte[i];
      const [c1, r1] = punkte[i + 1];
      const dx = c1 - c0;
      const dy = r1 - r0;
      const len = Math.hypot(dx, dy) || 1;
      // Leicht verlängert, damit sich die Stücke an den Knicken überlappen.
      const ex = (dx / len) * breite * 0.3;
      const ey = (dy / len) * breite * 0.3;
      const nx = (-dy / len) * (breite / 2);
      const ny = (dx / len) * (breite / 2);
      this.out.floors.push({
        points: [
          (c0 - ex + nx) * this.s, (r0 - ey + ny) * this.s,
          (c1 + ex + nx) * this.s, (r1 + ey + ny) * this.s,
          (c1 + ex - nx) * this.s, (r1 + ey - ny) * this.s,
          (c0 - ex - nx) * this.s, (r0 - ey - ny) * this.s,
        ],
        color,
      });
    }
  }

  wand(c: number, r: number, w: number, h: number): void {
    const x0 = c * this.s;
    const y0 = r * this.s;
    const x1 = (c + w) * this.s;
    const y1 = (r + h) * this.s;
    this.out.walls.push({ points: [x0, y0, x1, y0, x1, y1, x0, y1], closed: true });
  }

  /** Freistehender Wandzug, etwa eine Trennwand oder ein Tresen. */
  zug(punkte: Array<[number, number]>): void {
    this.out.walls.push({ points: punkte.flatMap(([c, r]) => [c * this.s, r * this.s]), closed: false });
  }

  /** Tür, ein Feld breit; `waagerecht` heißt: in einer waagerechten Wand. */
  tuer(c: number, r: number, waagerecht: boolean, breite = 1): void {
    const x = c * this.s;
    const y = r * this.s;
    this.out.doors.push({
      bounds: waagerecht ? [x, y, x + breite * this.s, y] : [x, y, x, y + breite * this.s],
    });
  }

  prop(id: string, c: number, r: number, scale = 1, rotation = 0): void {
    if (!this.opts.furnish) return;
    this.out.props.push({ propId: id, x: c * this.s, y: r * this.s, scale, rotation, ohneLicht: !this.opts.lights });
  }

  /** Prop mit etwas Streuung — für alles, was nicht ausgerichtet stehen muss. */
  streu(id: string, c: number, r: number, spanne = 0.3, scale: [number, number] = [0.9, 1.1]): void {
    if (!this.opts.furnish) return;
    this.out.props.push({
      propId: id,
      x: (c + this.rng.range(-spanne, spanne)) * this.s,
      y: (r + this.rng.range(-spanne, spanne)) * this.s,
      scale: this.rng.range(scale[0], scale[1]),
      rotation: this.rng.range(0, Math.PI * 2),
      ohneLicht: !this.opts.lights,
    });
  }

  /** Freies Licht ohne Prop (Tageslicht, Mondschein über einer Lichtung). */
  licht(c: number, r: number, reichweite: number): void {
    if (!this.opts.lights) return;
    // Reichweite in Feldern, wie UVTT sie will — nicht in Pixeln (war 100-fach zu groß).
    this.out.lights.push({ x: c * this.s, y: r * this.s, range: reichweite });
  }

  /** Stühle rund um einen runden Tisch; die Lehne zeigt nach außen. */
  stuehleRund(c: number, r: number, abstand: number, anzahl: number): void {
    const phase = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < anzahl; i++) {
      const a = phase + (i / anzahl) * Math.PI * 2;
      this.prop('chair', c + Math.cos(a) * abstand, r + Math.sin(a) * abstand, 0.8, a - Math.PI / 2 + this.rng.range(-0.25, 0.25));
    }
  }

  /** Lange Tafel mit Bänken oder Stühlen an beiden Längsseiten. */
  tafel(c: number, r: number, laenge: number, quer: boolean, mitBaenken: boolean): void {
    const dreh = quer ? Math.PI / 2 : 0;
    this.prop('table_rect', c, r, 0.75, dreh);
    const n = Math.max(2, Math.round(laenge / 1.1));
    for (let i = 0; i < n; i++) {
      const t = -laenge / 2 + 0.55 + (i * (laenge - 1.1)) / Math.max(1, n - 1);
      for (const seite of [-1, 1]) {
        if (mitBaenken && i > 0) continue;
        const [dc, dr] = quer ? [seite * 1.05, t] : [t, seite * 1.05];
        if (mitBaenken) {
          const [bc, br] = quer ? [seite * 1.05, 0] : [0, seite * 1.05];
          this.prop('bench', c + bc, r + br, 0.75, dreh);
        } else {
          this.prop('chair', c + dc, r + dr, 0.8, (quer ? (seite > 0 ? Math.PI / 2 : -Math.PI / 2) : seite > 0 ? Math.PI : 0) + this.rng.range(-0.2, 0.2));
        }
      }
    }
  }

  /**
   * Dreht und spiegelt das fertige Ergebnis. Gebaut wird in einer
   * Grundausrichtung; erst hier entscheidet sich, wo Norden ist.
   */
  wende(vierteldrehungen: number, spiegeln: boolean): void {
    const W = this.cols * this.s;
    const H = this.rows * this.s;
    const q = ((vierteldrehungen % 4) + 4) % 4;
    const punkt = (x: number, y: number): [number, number] => {
      if (spiegeln) x = W - x;
      switch (q) {
        case 1: return [H - y, x];
        case 2: return [W - x, H - y];
        case 3: return [y, W - x];
        default: return [x, y];
      }
    };
    const winkel = (a: number) => (spiegeln ? Math.PI - a : a) + (q * Math.PI) / 2;
    const zug = (p: number[]) => {
      const out: number[] = [];
      for (let i = 0; i < p.length; i += 2) out.push(...punkt(p[i], p[i + 1]));
      return out;
    };
    const o = this.out;
    for (const f of o.floors) f.points = zug(f.points);
    for (const w of o.walls) w.points = zug(w.points);
    for (const d of o.doors) d.bounds = zug(d.bounds) as [number, number, number, number];
    for (const p of o.props) {
      [p.x, p.y] = punkt(p.x, p.y);
      p.rotation = winkel(p.rotation);
    }
    for (const l of o.lights) [l.x, l.y] = punkt(l.x, l.y);
    for (const n of o.notes) [n.x, n.y] = punkt(n.x, n.y);
    if (q % 2 === 1) o.size = { cols: this.rows, rows: this.cols };
  }

  get zufall(): Rng {
    return this.rng;
  }
}

const HOLZ = 0x6b5335;
const DIELE = 0x7d6141;
const DIELE_HELL = 0x8a6d4a;
const STEIN = 0x6f6a62;
const STEIN_DUNKEL = 0x5d5850;
const GRAS = 0x5f7a44;
const GRAS_DUNKEL = 0x4e6b3c;
const ERDE = 0x7a6244;
const WEG = 0xa8925f;
const WASSER = 0x3f6f8f;

export function generateTemplate(opts: TemplateOptions): GeneratedMap {
  const rng = new Rng(opts.seed);
  switch (opts.variant) {
    case 'tavern':
      return taverne(rng, opts);
    case 'guardhouse':
      return wachhaus(rng, opts);
    case 'cottage':
      return kate(rng, opts);
    case 'shrine':
      return schrein(rng, opts);
    case 'clearing':
      return lichtung(rng, opts);
    case 'crossroads':
      return wegkreuzung(rng, opts);
  }
}

/**
 * Mischt gleichmäßig (Fisher-Yates). `sort(() => zufall - 0.5)` mischt nicht
 * gleichmäßig: die Tische ballten sich, und halbe Säle blieben leer.
 */
function mische<T>(rng: Rng, liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/** Neuer Baukasten mit gewürfelter Größe (Rand von einem Feld rundum). */
function bau(rng: Rng, opts: TemplateOptions, innenB: number, innenH: number): Bau {
  return new Bau(rng, opts.tileSize, innenB + 2, innenH + 2, opts);
}

/** Zum Schluss: zufällig drehen und spiegeln. */
function fertig(b: Bau, rng: Rng): GeneratedMap {
  b.wende(rng.int(0, 3), rng.bool());
  return b.out;
}

/**
 * Wandfackeln im Abstand von etwa fünf Feldern an allen vier Wänden eines
 * Rechtecks; ausgelassen wird, was schon belegt ist (Tür, Theke, Kamin).
 */
function fackeln(b: Bau, c0: number, r0: number, c1: number, r1: number, abstand = 5): void {
  const setze = (c: number, r: number, rot: number) => {
    if (!b.belegt.frei(c - 0.4, r - 0.4, c + 0.4, r + 0.4)) return;
    b.prop('wall_torch', c, r, 0.75, rot);
    b.belegt.belege(c - 0.4, r - 0.4, c + 0.4, r + 0.4);
  };
  const nx = Math.max(1, Math.round((c1 - c0) / abstand));
  const ny = Math.max(1, Math.round((r1 - r0) / abstand));
  for (let i = 0; i < nx; i++) {
    const c = c0 + ((i + 0.5) * (c1 - c0)) / nx;
    setze(c, r0 + 0.35, 0);
    setze(c, r1 - 0.35, Math.PI);
  }
  for (let i = 0; i < ny; i++) {
    const r = r0 + ((i + 0.5) * (r1 - r0)) / ny;
    setze(c0 + 0.35, r, -Math.PI / 2);
    setze(c1 - 0.35, r, Math.PI / 2);
  }
}

// ---------------------------------------------------------------------------
// Taverne
// ---------------------------------------------------------------------------

/**
 * Wirtsstube.
 *
 * Grundausrichtung: Eingang in der Südwand. Die Theke steht an einer der
 * anderen Wände, gerade oder als L in einer Ecke; dahinter und nur dort der
 * Vorrat. Der Kamin kommt an eine Wand ohne Theke, mit Teppich und den ersten
 * Tischen davor. Vom Eingang führt ein Laufweg in den Raum. Bei genug Platz
 * liegt hinter einer Trennwand eine Küche oder ein Lager — dorthin gehören
 * Kisten, Säcke und Fässer, nicht zwischen die Tische.
 */
function taverne(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(14, 19);
  const H = rng.int(12, 16);
  const b = bau(rng, opts, W, H);
  const c0 = 1;
  const r0 = 1;
  const c1 = c0 + W;
  const r1 = r0 + H;

  b.boden(c0, r0, W, H, rng.bool(0.5) ? DIELE : DIELE_HELL);
  b.wand(c0, r0, W, H);

  // Hinterzimmer an der Nordwand, wenn der Raum tief genug ist.
  const hinterzimmer = H >= 14 && rng.bool(0.6);
  const tiefe = 4;
  const saalR0 = hinterzimmer ? r0 + tiefe : r0;
  if (hinterzimmer) {
    b.boden(c0, r0, W, tiefe, STEIN);
    b.zug([[c0, saalR0], [c1, saalR0]]);
    const tc = rng.range(c0 + 2, c1 - 3);
    b.tuer(tc, saalR0, true);
    b.belegt.belege(tc - 0.5, saalR0 - 1.2, tc + 1.5, saalR0 + 1.6);
    const kueche = rng.bool(0.6);
    if (kueche) {
      const herd = rng.bool() ? c0 + 1.5 : c1 - 1.5;
      b.prop('cookfire', herd, r0 + 1.3, 0.9);
      b.prop('cauldron', herd + (herd < (c0 + c1) / 2 ? 1.3 : -1.3), r0 + 1.3, 0.55);
      b.prop('table_rect', (c0 + c1) / 2, r0 + 2.2, 0.55);
    }
    // Vorrat an den Wänden des Hinterzimmers.
    const vorrat = ['barrel', 'crate', 'sacks', 'barrels_stack', 'shelf_crates', 'crate_open'];
    for (let c = c0 + 1; c < c1 - 0.5; c += rng.range(1.1, 1.8)) {
      if (!b.belegt.frei(c - 0.4, r0 + 0.2, c + 0.4, r0 + 1)) continue;
      if (rng.bool(kueche ? 0.45 : 0.8)) b.streu(rng.pick(vorrat), c, r0 + 0.65, 0.12, [0.7, 0.85]);
    }
    for (let c = c0 + 1.5; c < c1 - 1; c += rng.range(1.6, 2.6)) {
      if (Math.abs(c - tc - 0.5) < 1.5) continue;
      if (rng.bool(0.5)) b.streu(rng.pick(vorrat), c, saalR0 - 0.7, 0.15, [0.65, 0.8]);
    }
  }

  // Eingang in der Südwand, nicht direkt in der Ecke.
  const tuerC = rng.range(c0 + 2, c1 - 3);
  b.tuer(tuerC, r1, true);
  // Laufweg vom Eingang in den Raum hinein.
  b.belegt.belege(tuerC - 0.7, r1 - 3.2, tuerC + 1.7, r1);

  // Theke: an Ost-, West- oder (ohne Hinterzimmer) Nordwand.
  const thekenWaende: Array<'o' | 'w' | 'n'> = hinterzimmer ? ['o', 'w'] : ['o', 'w', 'n'];
  const thekenWand = rng.pick(thekenWaende);
  const lForm = rng.bool(0.45);
  const saalH = r1 - saalR0;
  const tiefeTheke = 1.3;
  const abstandWand = 1.5; // Platz für die Bedienung
  if (thekenWand === 'n') {
    const laenge = rng.range(4.5, Math.min(7, W - 5));
    const ta = rng.bool() ? c0 + 1 : c1 - 1 - laenge;
    const tr = saalR0 + abstandWand;
    b.boden(ta, tr, laenge, tiefeTheke, HOLZ);
    const zugPunkte: Array<[number, number]> = [[ta, saalR0], [ta, tr], [ta + laenge, tr], [ta + laenge, saalR0]];
    b.zug(zugPunkte.slice(1, 3));
    for (let i = 0; i < Math.floor(laenge / 1.2); i++) b.streu('pottery', ta + 0.7 + i * 1.2, tr + 0.65, 0.15, [0.5, 0.65]);
    // Hinter der Theke: Regale und Fässer an der Wand.
    for (let c = ta + 0.6; c < ta + laenge - 0.3; c += 1.2) b.streu(rng.pick(['barrels_stack', 'shelf_crates', 'barrel']), c, saalR0 + 0.6, 0.1, [0.7, 0.85]);
    b.belegt.belege(ta - 0.3, saalR0, ta + laenge + 0.3, tr + tiefeTheke + 1.2);
  } else {
    const west = thekenWand === 'w';
    const laenge = rng.range(4.5, Math.min(7.5, saalH - 3));
    const tr0 = lForm ? saalR0 + abstandWand : rng.range(saalR0 + 1, r1 - 1 - laenge - 2);
    const wandC = west ? c0 : c1;
    const tc = west ? c0 + abstandWand : c1 - abstandWand - tiefeTheke;
    b.boden(tc, tr0, tiefeTheke, laenge, HOLZ);
    const vorn = west ? tc + tiefeTheke : tc;
    b.zug([[vorn, tr0], [vorn, tr0 + laenge]]);
    if (lForm) {
      // L: Abschluss zur Nordwand hin, ein Durchgang bleibt am anderen Ende.
      b.zug([[wandC, tr0], [vorn, tr0]]);
    }
    for (let i = 0; i < Math.floor(laenge / 1.2); i++) b.streu('pottery', tc + tiefeTheke / 2, tr0 + 0.7 + i * 1.2, 0.12, [0.5, 0.65]);
    for (let r = tr0 + 0.6; r < tr0 + laenge - 0.2; r += 1.2) {
      b.streu(rng.pick(['barrels_stack', 'shelf_crates', 'barrel']), west ? c0 + 0.6 : c1 - 0.6, r, 0.1, [0.7, 0.85]);
    }
    const x0 = west ? c0 : tc - 1.2;
    const x1 = west ? tc + tiefeTheke + 1.2 : c1;
    b.belegt.belege(x0, tr0 - 0.3, x1, tr0 + laenge + 0.3);
  }

  // Kamin an einer Wand ohne Theke; mehrere Versuche, damit er nicht
  // wortlos fehlt, wenn die erste Stelle belegt ist.
  const kaminWaende = (['o', 'w', 'n'] as const).filter((w) => w !== thekenWand && !(w === 'n' && hinterzimmer));
  kamin: for (let versuch = 0; versuch < 24 && kaminWaende.length > 0; versuch++) {
    const wand = rng.pick(kaminWaende);
    if (wand === 'n') {
      const kc = rng.range(c0 + 2.5, c1 - 2.5);
      if (!b.belegt.frei(kc - 1.4, saalR0, kc + 1.4, saalR0 + 2.6)) continue;
      b.prop('fireplace', kc, saalR0 + 0.6, 1, 0);
      b.prop('rug', kc, saalR0 + 2.4, 0.7);
      b.belegt.belege(kc - 1.4, saalR0, kc + 1.4, saalR0 + 3);
      break kamin;
    }
    const west = wand === 'w';
    const kr = rng.range(saalR0 + 2, r1 - 2.5);
    const x0 = west ? c0 : c1 - 2.6;
    const x1 = west ? c0 + 2.6 : c1;
    if (!b.belegt.frei(x0, kr - 1.4, x1, kr + 1.4)) continue;
    b.prop('fireplace', west ? c0 + 0.6 : c1 - 0.6, kr, 1, west ? -Math.PI / 2 : Math.PI / 2);
    b.prop('rug', west ? c0 + 2.4 : c1 - 2.4, kr, 0.7, Math.PI / 2);
    b.belegt.belege(x0, kr - 1.4, x1, kr + 1.4);
    break kamin;
  }

  // Treppe in eine freie Ecke des Saals.
  if (rng.bool(0.7)) {
    const ecken: Array<[number, number]> = [[c0 + 1.1, r1 - 1.1], [c1 - 1.1, r1 - 1.1], [c0 + 1.1, saalR0 + 1.1], [c1 - 1.1, saalR0 + 1.1]];
    for (const [ec, er] of mische(rng, ecken)) {
      if (b.belegt.frei(ec - 1, er - 1, ec + 1, er + 1)) {
        b.prop('stairs', ec, er, 0.85, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
        b.belegt.belege(ec - 1.1, er - 1.1, ec + 1.1, er + 1.1);
        break;
      }
    }
  }

  // Bühne für Spielleute in einer freien Ecke.
  if (rng.bool(0.35)) {
    const ecken: Array<[number, number]> = [[c0 + 1.6, r1 - 1.6], [c1 - 1.6, r1 - 1.6], [c0 + 1.6, saalR0 + 1.6], [c1 - 1.6, saalR0 + 1.6]];
    for (const [ec, er] of mische(rng, ecken)) {
      if (b.belegt.frei(ec - 1.3, er - 1.3, ec + 1.3, er + 1.3)) {
        b.prop('rug_round', ec, er, 0.8);
        b.prop('stool', ec, er, 0.7);
        b.prop('lute', ec + 0.6, er + 0.3, 0.6, rng.range(0, Math.PI));
        b.belegt.belege(ec - 1.3, er - 1.3, ec + 1.3, er + 1.3);
        break;
      }
    }
  }

  // Tische: nur im freien Gastbereich, mit Abstand, gemischt rund und lang.
  const kandidaten: Array<[number, number]> = [];
  for (let c = c0 + 1.5; c <= c1 - 1.5; c += 0.5) {
    for (let r = saalR0 + 1.5; r <= r1 - 1.5; r += 0.5) kandidaten.push([c, r]);
  }
  mische(rng, kandidaten);
  let tische = 0;
  const maxTische = Math.floor((W * saalH) / 16);
  for (const [c, r] of kandidaten) {
    if (tische >= maxTische) break;
    const lang = rng.bool(0.3);
    const quer = rng.bool();
    // Platzbedarf samt Stühlen; dazu ein schmaler Gang zwischen den Tischen.
    const [hw, hh] = lang ? (quer ? [1.4, 1.9] : [1.9, 1.4]) : [1.25, 1.25];
    if (!b.belegt.frei(c - hw - 0.25, r - hh - 0.25, c + hw + 0.25, r + hh + 0.25)) continue;
    if (lang) b.tafel(c, r, 3, quer, rng.bool(0.4));
    else {
      b.prop('table_round', c, r, 0.7);
      b.stuehleRund(c, r, 1, rng.int(2, 4));
    }
    b.streu('pottery', c, r, 0.3, [0.45, 0.6]);
    b.belegt.belege(c - hw, r - hh, c + hw, r + hh);
    tische++;
  }

  // Spuren eines Abends, sparsam.
  if (rng.bool(0.5)) b.streu('chair_toppled', rng.range(c0 + 2, c1 - 2), rng.range(saalR0 + 2, r1 - 2), 0.3, [0.75, 0.85]);
  if (rng.bool(0.35)) b.streu('bloodstain', rng.range(c0 + 2, c1 - 2), rng.range(saalR0 + 2, r1 - 2), 0.2, [0.5, 0.8]);

  fackeln(b, c0, saalR0, c1, r1, 5);
  return fertig(b, rng);
}

// ---------------------------------------------------------------------------
// Wachhaus
// ---------------------------------------------------------------------------

/**
 * Wachhaus mit Zellen.
 *
 * Der Bau ist um die Zellen herum organisiert: Gitter, davor der Tisch, an
 * dem gewacht wird. Anzahl der Zellen, ihre Seite und die Lage von
 * Schlafraum und Waffenkammer würfeln.
 */
function wachhaus(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(12, 16);
  const H = rng.int(9, 12);
  const b = bau(rng, opts, W, H);
  const c0 = 1;
  const r0 = 1;
  const c1 = c0 + W;
  const r1 = r0 + H;
  b.boden(c0, r0, W, H, STEIN);
  b.wand(c0, r0, W, H);

  const tuerC = rng.range(c0 + 2, c1 - 3);
  b.tuer(tuerC, r1, true);
  b.belegt.belege(tuerC - 0.6, r1 - 2.6, tuerC + 1.6, r1);

  // Zellen an der Ostwand, je 3 Felder breit.
  const zellen = rng.int(1, Math.max(1, Math.floor((H - 1) / 3.2)));
  const zellB = 3.2;
  const zc = c1 - zellB;
  b.boden(zc, r0, zellB, zellen * 3, STEIN_DUNKEL);
  for (let i = 0; i < zellen; i++) {
    const zr = r0 + i * 3;
    b.zug([[zc, zr], [zc, zr + 3]]);
    if (i > 0) b.zug([[zc, zr], [c1, zr]]);
    b.tuer(zc, zr + 1, false);
    b.prop('door_barred', zc, zr + 1.5, 0.75, Math.PI / 2);
    b.streu(rng.pick(['bedroll', 'hay']), c1 - 1, zr + 0.9, 0.2, [0.8, 0.9]);
    if (rng.bool(0.6)) b.streu(rng.pick(['bones', 'chains', 'pottery', 'skull']), c1 - 1.4, zr + 2.1, 0.3, [0.6, 0.8]);
  }
  if (zellen * 3 < H) b.zug([[zc, r0 + zellen * 3], [c1, r0 + zellen * 3]]);
  b.belegt.belege(zc - 1.2, r0, c1, r0 + zellen * 3);

  // Wachtisch vor den Zellen.
  const tischR = r0 + Math.min(zellen * 3, H) / 2;
  const tischC = zc - 2.4;
  b.prop('table_rect', tischC, tischR, 0.6, Math.PI / 2);
  b.stuehleRund(tischC, tischR, 1.2, rng.int(2, 3));
  b.prop('lantern', tischC, tischR - 0.3, 0.6);
  b.belegt.belege(tischC - 1.4, tischR - 1.6, tischC + 1.4, tischR + 1.6);

  // Waffen und Rüstung an der Nordwand, Pritschen an der West- oder Südwand.
  for (let c = c0 + 1; c < zc - 3.5; c += rng.range(1.3, 1.9)) {
    b.prop(rng.pick(['weapon_rack', 'armour_stand', 'chest', 'shield']), c, r0 + 0.6, 0.8);
  }
  b.belegt.belege(c0, r0, zc - 3.5, r0 + 1.3);
  const pritschenWest = rng.bool();
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const [pc, pr] = pritschenWest ? [c0 + 0.8, r0 + 2.5 + i * 1.5] : [c0 + 1.2 + i * 1.6, r1 - 0.9];
    if (!b.belegt.frei(pc - 0.6, pr - 0.6, pc + 0.6, pr + 0.6)) continue;
    b.prop('bedroll', pc, pr, 0.85, pritschenWest ? Math.PI / 2 : 0);
    b.belegt.belege(pc - 0.7, pr - 0.7, pc + 0.7, pr + 0.7);
  }
  // Feuerbecken und Vorrat in freie Stellen.
  for (const id of ['brazier', 'barrel', 'crate']) {
    for (let v = 0; v < 12; v++) {
      const c = rng.range(c0 + 1, zc - 1.5);
      const r = rng.range(r0 + 1.5, r1 - 1);
      if (!b.belegt.frei(c - 0.6, r - 0.6, c + 0.6, r + 0.6)) continue;
      b.prop(id, c, r, id === 'brazier' ? 0.85 : 0.75);
      b.belegt.belege(c - 0.7, r - 0.7, c + 0.7, r + 0.7);
      break;
    }
  }
  fackeln(b, c0, r0, zc, r1, 6);
  return fertig(b, rng);
}

// ---------------------------------------------------------------------------
// Kate
// ---------------------------------------------------------------------------

/**
 * Einraumkate: Bett, Herd, Tisch — das Zuhause einer Familie in einem Zimmer.
 * Herd und Bett stehen an verschiedenen Wänden, der Tisch in der Mitte.
 * Manchmal mit Stall- oder Werkstattecke hinter einer halben Wand.
 */
function kate(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(8, 11);
  const H = rng.int(7, 9);
  const b = bau(rng, opts, W, H);
  const c0 = 1;
  const r0 = 1;
  const c1 = c0 + W;
  const r1 = r0 + H;
  b.boden(c0, r0, W, H, rng.bool() ? HOLZ : DIELE);
  b.wand(c0, r0, W, H);

  const tuerC = rng.range(c0 + 1.5, c1 - 2.5);
  b.tuer(tuerC, r1, true);
  b.belegt.belege(tuerC - 0.5, r1 - 2, tuerC + 1.5, r1);

  // Herd an West- oder Nordwand, Bett gegenüber.
  const herdWest = rng.bool();
  const [hc, hr, hrot] = herdWest ? [c0 + 0.6, rng.range(r0 + 1.5, r1 - 2), -Math.PI / 2] : [rng.range(c0 + 2, c1 - 2), r0 + 0.6, 0];
  b.prop('fireplace', hc, hr, 0.9, hrot);
  b.prop('cauldron', herdWest ? hc + 1.2 : hc, herdWest ? hr : hr + 1.2, 0.55);
  b.belegt.belege(hc - 1.3, hr - 1.3, hc + 1.8, hr + 1.8);

  const bettC = herdWest ? c1 - 1.1 : c0 + 1.1;
  const bettR = rng.range(r0 + 1.2, r0 + 2.2);
  b.prop('bed', bettC, bettR, 0.7, Math.PI / 2);
  b.belegt.belege(bettC - 1, bettR - 1.3, bettC + 1, bettR + 1.3);
  if (rng.bool(0.6)) {
    b.prop('crib', bettC, bettR + 2, 0.65);
    b.belegt.belege(bettC - 0.7, bettR + 1.3, bettC + 0.7, bettR + 2.7);
  }

  const tc = (c0 + c1) / 2 + rng.range(-0.8, 0.8);
  const tr = (r0 + r1) / 2 + rng.range(-0.5, 0.8);
  if (b.belegt.frei(tc - 1.2, tr - 1.2, tc + 1.2, tr + 1.2)) {
    b.prop(rng.bool() ? 'table_rect' : 'table_round', tc, tr, 0.55);
    b.stuehleRund(tc, tr, 1.1, rng.int(2, 4));
    b.belegt.belege(tc - 1.3, tr - 1.3, tc + 1.3, tr + 1.3);
  }

  // Hausrat an freie Wandstellen.
  const hausrat = ['wardrobe', 'chest', 'shelf_crates', 'woodpile', 'pottery', 'sacks', 'barrel'];
  for (let i = 0; i < 6; i++) {
    for (let v = 0; v < 10; v++) {
      const seite = rng.int(0, 3);
      const c = seite < 2 ? rng.range(c0 + 1, c1 - 1) : seite === 2 ? c0 + 0.6 : c1 - 0.6;
      const r = seite === 0 ? r0 + 0.6 : seite === 1 ? r1 - 0.6 : rng.range(r0 + 1, r1 - 1);
      if (!b.belegt.frei(c - 0.5, r - 0.5, c + 0.5, r + 0.5)) continue;
      b.streu(rng.pick(hausrat), c, r, 0.08, [0.6, 0.75]);
      b.belegt.belege(c - 0.6, r - 0.6, c + 0.6, r + 0.6);
      break;
    }
  }
  if (rng.bool(0.4)) b.streu('rug', tc, tr + 0.2, 0.2, [0.55, 0.65]);
  return fertig(b, rng);
}

// ---------------------------------------------------------------------------
// Schrein
// ---------------------------------------------------------------------------

/**
 * Schrein: Altar gegenüber dem Eingang, davor ein Mittelgang. Säulenzahl,
 * Bänke oder Teppiche, Seitennischen und Feuerbecken würfeln.
 */
function schrein(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(9, 13);
  const H = rng.int(10, 14);
  const b = bau(rng, opts, W, H);
  const c0 = 1;
  const r0 = 1;
  const c1 = c0 + W;
  const r1 = r0 + H;
  const mitte = (c0 + c1) / 2;
  b.boden(c0, r0, W, H, STEIN);
  b.wand(c0, r0, W, H);
  b.tuer(mitte - 0.5, r1, true);

  // Mittelgang als hellerer Streifen.
  const gang = rng.pick([1.6, 2, 2.4]);
  b.boden(mitte - gang / 2, r0 + 1, gang, H - 1, 0x7c766c);
  b.belegt.belege(mitte - gang / 2, r0 + 2.8, mitte + gang / 2, r1);

  // Altar mit Statue oder Rune dahinter.
  b.prop('altar', mitte, r0 + 1.8, 0.85);
  if (rng.bool(0.7)) b.prop('statue', mitte, r0 + 0.8, 0.7);
  else b.prop('rune_circle', mitte, r0 + 1.8, 1.1);
  b.belegt.belege(mitte - 1.8, r0, mitte + 1.8, r0 + 2.9);
  for (const seite of [-1, 1]) {
    b.prop(rng.pick(['brazier', 'candelabra']), mitte + seite * 1.7, r0 + 2, 0.8);
  }

  // Säulenreihen.
  const reihen = rng.int(2, 4);
  const saeulenC = Math.min(gang / 2 + rng.range(1.2, 2), W / 2 - 1.2);
  for (let i = 0; i < reihen; i++) {
    const r = r0 + 3.5 + (i * (H - 5)) / Math.max(1, reihen - 1);
    for (const seite of [-1, 1]) {
      const c = mitte + seite * saeulenC;
      b.prop(rng.bool(0.15) ? 'column_broken' : 'column', c, r, 0.85);
      b.belegt.belege(c - 0.5, r - 0.5, c + 0.5, r + 0.5);
    }
  }

  // Bänke beiderseits des Gangs oder Gebetsteppiche.
  const baenke = rng.bool(0.65);
  for (let r = r0 + 4; r < r1 - 1.5; r += baenke ? 1.4 : 1.8) {
    for (const seite of [-1, 1]) {
      const c = mitte + seite * (gang / 2 + 1.1);
      if (!b.belegt.frei(c - 0.6, r - 0.3, c + 0.6, r + 0.3)) continue;
      b.prop(baenke ? 'bench' : 'rug', c, r, baenke ? 0.55 : 0.35, baenke ? 0 : Math.PI / 2);
      b.belegt.belege(c - 0.7, r - 0.4, c + 0.7, r + 0.4);
    }
  }
  // Seitennischen mit Opfergaben.
  for (const seite of [-1, 1]) {
    if (!rng.bool(0.5)) continue;
    const c = seite < 0 ? c0 + 0.7 : c1 - 0.7;
    const r = rng.range(r0 + 3, r1 - 2);
    b.prop(rng.pick(['statue', 'candelabra', 'brazier']), c, r, 0.7);
    b.streu(rng.pick(['coins', 'pottery', 'flowers', 'scroll']), c + (seite < 0 ? 0.8 : -0.8), r, 0.2, [0.5, 0.7]);
  }
  if (rng.bool(0.4)) b.streu('coins', mitte, r0 + 2.9, 0.25, [0.6, 0.9]);
  return fertig(b, rng);
}

// ---------------------------------------------------------------------------
// Waldlichtung
// ---------------------------------------------------------------------------

/**
 * Waldlichtung.
 *
 * Kein Bauwerk, also keine Wände. Was sich ändert: Form der Lichtung, ob und
 * wo ein Weg hineinführt, ein Tümpel oder Bach, und was darauf ist —
 * ein Lager, ein Steinkreis, eine Ruine oder gar nichts.
 */
function lichtung(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(18, 24);
  const H = rng.int(16, 20);
  const b = new Bau(rng, opts.tileSize, W, H, opts);
  const cx = W / 2 + rng.range(-1.5, 1.5);
  const cy = H / 2 + rng.range(-1, 1);
  const radius = Math.min(W, H) * rng.range(0.3, 0.4);
  const streck = rng.range(0.85, 1.3);

  b.boden(0, 0, W, H, GRAS_DUNKEL);
  b.fleck(cx, cy, radius, GRAS, 0.16, streck);

  // Wasser: Tümpel am Rand der Lichtung oder ein Bach quer durch.
  const wasser = rng.pickWeighted(['kein', 'tuempel', 'bach'] as const, [0.4, 0.35, 0.25]);
  if (wasser === 'tuempel') {
    const a = rng.range(0, Math.PI * 2);
    const tc = cx + Math.cos(a) * radius * 0.55 * streck;
    const tr = cy + Math.sin(a) * radius * 0.55;
    b.fleck(tc, tr, rng.range(1.6, 2.4), WASSER, 0.25);
    b.belegt.belege(tc - 2.6, tr - 2.6, tc + 2.6, tr + 2.6);
    for (let i = 0; i < 6; i++) b.streu(rng.pick(['reeds', 'lilypads', 'stone_small']), tc + rng.range(-2, 2), tr + rng.range(-2, 2), 0.2, [0.7, 1]);
  } else if (wasser === 'bach') {
    const r0 = rng.range(2, H - 2);
    const r1 = rng.range(2, H - 2);
    const mitteR = (r0 + r1) / 2 + rng.range(-3, 3);
    const punkte: Array<[number, number]> = [[-0.5, r0], [W * 0.33, (r0 + mitteR) / 2 + rng.range(-1, 1)], [W * 0.66, (mitteR + r1) / 2 + rng.range(-1, 1)], [W + 0.5, r1]];
    b.band(punkte, rng.range(1.1, 1.6), WASSER);
    for (const [c, r] of punkte) b.belegt.belege(c - 1.5, r - 1.5, c + 1.5, r + 1.5);
    for (let i = 0; i < 8; i++) {
      const p = punkte[rng.int(0, punkte.length - 1)];
      b.streu(rng.pick(['reeds', 'stone_small', 'stone_medium']), p[0] + rng.range(-1, 1), p[1] + rng.range(-1.2, 1.2), 0.2, [0.7, 1]);
    }
  }

  // Weg hinein, von einer zufälligen Seite; manchmal keiner.
  if (rng.bool(0.7)) {
    const seite = rng.int(0, 3);
    const start: [number, number] = seite === 0 ? [rng.range(3, W - 3), -0.5] : seite === 1 ? [W + 0.5, rng.range(3, H - 3)] : seite === 2 ? [rng.range(3, W - 3), H + 0.5] : [-0.5, rng.range(3, H - 3)];
    const knick: [number, number] = [(start[0] + cx) / 2 + rng.range(-1.5, 1.5), (start[1] + cy) / 2 + rng.range(-1.5, 1.5)];
    b.band([start, knick, [cx, cy]], rng.range(1.3, 1.8), WEG);
  }

  // Was auf der Lichtung ist.
  const inhalt = rng.pickWeighted(['lager', 'steinkreis', 'ruine', 'leer'] as const, [0.45, 0.2, 0.2, 0.15]);
  b.belegt.belege(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8);
  if (inhalt === 'lager') {
    b.fleck(cx, cy, radius * 0.45, ERDE, 0.3);
    b.prop(rng.pick(['cookfire', 'campfire']), cx, cy, 1.2);
    for (let i = 0; i < rng.int(2, 4); i++) {
      const a = rng.range(0, Math.PI * 2) + (i / 3) * Math.PI * 2;
      b.prop('log', cx + Math.cos(a) * 2, cy + Math.sin(a) * 2, 0.75, a + Math.PI / 2);
    }
    for (let i = 0; i < rng.int(1, 3); i++) {
      const a = rng.range(0, Math.PI * 2);
      const c = cx + Math.cos(a) * radius * 0.6;
      const r = cy + Math.sin(a) * radius * 0.6;
      if (b.belegt.frei(c - 1, r - 1, c + 1, r + 1)) {
        b.prop('tent', c, r, 0.95, a + Math.PI / 2);
        b.belegt.belege(c - 1.2, r - 1.2, c + 1.2, r + 1.2);
      }
    }
    for (const id of ['woodpile', 'barrel', 'crate', 'bedroll', 'cart']) {
      if (!rng.bool(0.55)) continue;
      const a = rng.range(0, Math.PI * 2);
      b.streu(id, cx + Math.cos(a) * radius * 0.45, cy + Math.sin(a) * radius * 0.45, 0.3, [0.7, 0.9]);
    }
  } else if (inhalt === 'steinkreis') {
    const n = rng.int(6, 10);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.prop(rng.bool(0.8) ? 'stone_large' : 'boulder_mossy', cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, rng.range(0.8, 1.1), a);
    }
    b.prop(rng.pick(['altar', 'obelisk', 'rune_circle']), cx, cy, 0.9);
  } else if (inhalt === 'ruine') {
    for (let i = 0; i < rng.int(3, 6); i++) {
      b.streu(rng.pick(['column_broken', 'rubble', 'statue_broken', 'stone_medium']), cx + rng.range(-3, 3), cy + rng.range(-3, 3), 0.3, [0.8, 1.1]);
    }
    if (rng.bool(0.5)) b.prop('well', cx, cy, 0.85);
  }

  // Baumsaum und Unterholz.
  const baeume = rng.pick([
    ['tree_deciduous', 'tree_birch', 'tree_deciduous'],
    ['tree_pine', 'tree_pine_slim', 'tree_pine'],
    ['tree_deciduous', 'tree_pine', 'tree_birch', 'tree_willow'],
  ]);
  for (let i = 0; i < 90; i++) {
    const c = rng.range(0.5, W - 0.5);
    const r = rng.range(0.5, H - 0.5);
    const d = Math.hypot((c - cx) / streck, r - cy);
    if (d < radius * 1.05) continue;
    if (!b.belegt.frei(c - 0.5, r - 0.5, c + 0.5, r + 0.5)) continue;
    b.streu(rng.pick(baeume), c, r, 0.2, [0.85, 1.15]);
    b.belegt.belege(c - 0.7, r - 0.7, c + 0.7, r + 0.7);
  }
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = radius * rng.range(0.75, 1.05);
    b.streu(rng.pick(['bush', 'fern', 'grass_tuft', 'mushrooms', 'stone_medium', 'berry_bush', 'flowers']),
      cx + Math.cos(a) * d * streck, cy + Math.sin(a) * d, 0.35, [0.75, 1.05]);
  }
  return b.out;
}

// ---------------------------------------------------------------------------
// Wegkreuzung
// ---------------------------------------------------------------------------

/**
 * Wegkreuzung: T oder X, gerade oder geschwungen, dazu ein Rastplatz,
 * ein Galgen, ein Schrein oder eine Wegstation.
 */
function wegkreuzung(rng: Rng, opts: TemplateOptions): GeneratedMap {
  const W = rng.int(16, 20);
  const H = rng.int(16, 20);
  const b = new Bau(rng, opts.tileSize, W, H, opts);
  b.boden(0, 0, W, H, rng.bool(0.7) ? GRAS : 0x6f7a4c);
  const kc = W / 2 + rng.range(-2, 2);
  const kr = H / 2 + rng.range(-2, 2);
  const breite = rng.range(1.8, 2.6);
  const schwung = rng.range(0, 1.8);
  const arme = rng.bool(0.35) ? rng.int(0, 3) : -1; // -1: X, sonst fehlt dieser Arm (T)
  const enden: Array<[number, number]> = [
    [kc + rng.range(-2, 2), -0.5],
    [W + 0.5, kr + rng.range(-2, 2)],
    [kc + rng.range(-2, 2), H + 0.5],
    [-0.5, kr + rng.range(-2, 2)],
  ];
  enden.forEach((ende, i) => {
    if (i === arme) return;
    const mitte: [number, number] = [(ende[0] + kc) / 2 + rng.range(-schwung, schwung), (ende[1] + kr) / 2 + rng.range(-schwung, schwung)];
    b.band([ende, mitte, [kc, kr]], breite, WEG);
    for (let t = 0; t <= 1; t += 0.1) {
      const c = ende[0] + (kc - ende[0]) * t;
      const r = ende[1] + (kr - ende[1]) * t;
      b.belegt.belege(c - breite, r - breite, c + breite, r + breite);
    }
  });
  b.fleck(kc, kr, breite * 1.1, WEG, 0.18);

  // Wegweiser an der Kreuzung.
  b.prop('signpost', kc + breite * 0.9, kr - breite * 0.9, 0.9);

  // Was hier steht.
  const ort = rng.pickWeighted(['rast', 'galgen', 'schrein', 'station'] as const, [0.4, 0.15, 0.2, 0.25]);
  const eckeFrei = (): [number, number] | null => {
    for (let v = 0; v < 40; v++) {
      const c = rng.range(2, W - 2);
      const r = rng.range(2, H - 2);
      if (b.belegt.frei(c - 2, r - 2, c + 2, r + 2)) return [c, r];
    }
    return null;
  };
  const platz = eckeFrei();
  if (platz) {
    const [c, r] = platz;
    b.belegt.belege(c - 2.2, r - 2.2, c + 2.2, r + 2.2);
    if (ort === 'rast') {
      b.prop('well', c, r, 0.85);
      b.prop('bench', c + 1.5, r + 0.8, 0.7);
      if (rng.bool(0.6)) b.prop('cart', c - 1.6, r + 0.6, 0.85, rng.range(-0.4, 0.4));
      if (rng.bool(0.4)) b.prop('trough', c + 0.2, r - 1.4, 0.7);
    } else if (ort === 'galgen') {
      b.prop('gallows', c, r, 1);
      b.streu('bones', c + 0.8, r + 1, 0.3, [0.6, 0.8]);
      if (rng.bool(0.5)) b.streu('grave_cross', c - 1.5, r + 1.2, 0.3, [0.7, 0.9]);
    } else if (ort === 'schrein') {
      b.prop('statue', c, r, 0.8);
      b.prop('candelabra', c + 0.9, r + 0.6, 0.6);
      b.streu('flowers', c - 0.8, r + 0.7, 0.2, [0.6, 0.8]);
    } else {
      // Wegstation: kleine Hütte mit Tür zur Straße.
      b.boden(c - 1.8, r - 1.5, 3.6, 3, HOLZ);
      b.wand(c - 1.8, r - 1.5, 3.6, 3);
      b.tuer(c - 0.5, r + 1.5, true);
      b.prop('bed', c + 1, r - 0.5, 0.55, Math.PI / 2);
      b.prop('lantern', c - 1, r - 0.8, 0.55);
    }
  }
  if (rng.bool(0.5)) b.prop('w_borderstone', kc - breite, kr + breite, 0.75);

  // Bewuchs überall außer auf den Wegen.
  const pflanzen = ['bush', 'grass_tuft', 'fern', 'flowers', 'stone_small', 'stone_medium', 'flower_patch'];
  for (let i = 0; i < 80; i++) {
    const c = rng.range(0.5, W - 0.5);
    const r = rng.range(0.5, H - 0.5);
    if (!b.belegt.frei(c - 0.3, r - 0.3, c + 0.3, r + 0.3)) continue;
    b.streu(rng.pick(pflanzen), c, r, 0.2, [0.75, 1.1]);
  }
  const waldig = rng.range(8, 22);
  for (let i = 0; i < waldig; i++) {
    const c = rng.range(0.8, W - 0.8);
    const r = rng.range(0.8, H - 0.8);
    if (!b.belegt.frei(c - 0.8, r - 0.8, c + 0.8, r + 0.8)) continue;
    b.streu(rng.pick(['tree_deciduous', 'tree_pine', 'tree_birch']), c, r, 0.2, [0.9, 1.1]);
    b.belegt.belege(c - 0.9, r - 0.9, c + 0.9, r + 0.9);
  }
  return b.out;
}
