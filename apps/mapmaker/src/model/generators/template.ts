/**
 * Fertige Räume statt leerer Grundrisse.
 *
 * Die Generatoren können Grundrisse — Gänge, Häuserblöcke, Waldstücke — aber
 * das, womit eine Spielrunde tatsächlich anfängt, ist ein *bestückter* Raum:
 * eine Taverne, in der Tische stehen und ein Feuer brennt. Genau der Schritt
 * vom Grundriss zum Ort fehlte, und er lässt sich nicht sinnvoll auswürfeln:
 * ein zufällig verteilter Schankraum sieht aus wie ein Lager mit Stühlen.
 *
 * Deshalb hier von Hand gesetzte Anordnungen, mit Zufall nur in den
 * Kleinigkeiten — welcher Stuhl schief steht, wo die Fässer liegen, wie viele
 * Krüge auf dem Tresen. Die Anordnung selbst bleibt, wie sie gemeint ist.
 *
 * Das Ergebnis ist ein ganz normales `GeneratedMap`: alles wird zu Objekten,
 * die man anfassen, verschieben und löschen kann. Eine Vorlage ist ein
 * Anfang, kein Gehäuse.
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

/** Kartengröße je Vorlage, in Feldern. */
const GROESSE: Record<TemplateId, { cols: number; rows: number }> = {
  tavern: { cols: 16, rows: 14 },
  guardhouse: { cols: 14, rows: 11 },
  cottage: { cols: 11, rows: 10 },
  shrine: { cols: 12, rows: 12 },
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

  constructor(
    private rng: Rng,
    private s: number,
    cols: number,
    rows: number,
    private opts: TemplateOptions,
  ) {
    this.out = emptyResult(cols, rows);
  }

  boden(c: number, r: number, w: number, h: number, color: number): void {
    const x0 = c * this.s;
    const y0 = r * this.s;
    const x1 = (c + w) * this.s;
    const y1 = (r + h) * this.s;
    this.out.floors.push({ points: [x0, y0, x1, y0, x1, y1, x0, y1], color });
  }

  /** Unregelmäßige Fläche — für alles, was nicht gebaut, sondern gewachsen ist. */
  fleck(c: number, r: number, radius: number, color: number, wobble = 0.22): void {
    const punkte: number[] = [];
    const n = 20;
    const p1 = this.rng.range(0, Math.PI * 2);
    const p2 = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rad =
        radius * (1 + wobble * Math.sin(2 * a + p1) + wobble * 0.55 * Math.sin(3 * a + p2));
      punkte.push((c + Math.cos(a) * rad) * this.s, (r + Math.sin(a) * rad) * this.s);
    }
    this.out.floors.push({ points: punkte, color });
  }

  /** Ein Band von A nach B — Wege, Bäche, Läufer. */
  band(c0: number, r0: number, c1: number, r1: number, breite: number, color: number): void {
    const dx = c1 - c0;
    const dy = r1 - r0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (breite / 2);
    const ny = (dx / len) * (breite / 2);
    this.out.floors.push({
      points: [
        (c0 + nx) * this.s, (r0 + ny) * this.s,
        (c1 + nx) * this.s, (r1 + ny) * this.s,
        (c1 - nx) * this.s, (r1 - ny) * this.s,
        (c0 - nx) * this.s, (r0 - ny) * this.s,
      ],
      color,
    });
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
    this.out.props.push({ propId: id, x: c * this.s, y: r * this.s, scale, rotation });
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
    });
  }

  licht(c: number, r: number, reichweite: number): void {
    if (!this.opts.lights) return;
    // Reichweite in Feldern, wie UVTT sie will — nicht in Pixeln (war 100-fach zu gross).
    this.out.lights.push({ x: c * this.s, y: r * this.s, range: reichweite });
  }

  /** Stühle rund um einen Tisch — der Griff, den ein Speisesaal braucht. */
  stuehle(c: number, r: number, abstand: number, anzahl: number): void {
    const phase = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < anzahl; i++) {
      const a = phase + (i / anzahl) * Math.PI * 2;
      this.out.props.push({
        propId: 'chair',
        x: (c + Math.cos(a) * abstand) * this.s,
        y: (r + Math.sin(a) * abstand) * this.s,
        // Die Lehne zeigt nach außen, sonst sitzt man mit dem Rücken zum Tisch.
        rotation: a - Math.PI / 2 + this.rng.range(-0.25, 0.25),
        scale: 1,
      });
    }
  }

  get zufall(): Rng {
    return this.rng;
  }
}

const HOLZ = 0x6b5335;
const DIELE = 0x7d6141;
const STEIN = 0x6f6a62;
const GRAS = 0x5f7a44;
const ERDE = 0x7a6244;
const WEG = 0xa8925f;

export function generateTemplate(opts: TemplateOptions): GeneratedMap {
  const rng = new Rng(opts.seed);
  const g = GROESSE[opts.variant];
  const b = new Bau(rng, opts.tileSize, g.cols, g.rows, { ...opts, cols: g.cols, rows: g.rows });

  switch (opts.variant) {
    case 'tavern':
      taverne(b, rng);
      break;
    case 'guardhouse':
      wachhaus(b, rng);
      break;
    case 'cottage':
      kate(b, rng);
      break;
    case 'shrine':
      schrein(b, rng);
      break;
    case 'clearing':
      lichtung(b, rng);
      break;
    case 'crossroads':
      wegkreuzung(b, rng);
      break;
  }
  return b.out;
}

// ---------------------------------------------------------------------------

/**
 * Schankraum mit Tresen, Feuerstelle und Treppe.
 *
 * Die Anordnung ist die einer echten Wirtsstube: Tresen an der Rückwand, weil
 * man von dort den Raum überblickt; Feuer an der Seitenwand mit den nächsten
 * Tischen davor, weil dort im Winter alle sitzen wollen; Tür in der Ecke, damit
 * der Zug nicht durch den Raum bläst.
 */
function taverne(b: Bau, rng: Rng): void {
  b.boden(1, 1, 14, 12, DIELE);
  b.wand(1, 1, 14, 12);
  b.tuer(3, 13, true);

  // Tresen als eigener Wandzug: eine Theke ist eine Sichtbarriere, aber keine
  // Wand bis zur Decke — für die Kartendarstellung reicht der Zug.
  b.boden(9, 2, 5, 1.4, HOLZ);
  b.zug([[9, 2], [14, 2], [14, 3.4], [9, 3.4], [9, 2]]);
  for (let i = 0; i < 4; i++) b.prop('pottery', 9.7 + i * 1.1, 2.7, rng.range(0.5, 0.7));
  b.prop('barrel', 13, 4.6, 0.9);
  b.prop('barrel_lying', 11.6, 4.7, 0.85);
  b.prop('barrels_stack', 13.2, 6.2, 0.9);
  b.prop('shelf_crates', 12, 1.6, 0.8);

  // Kamin an der Westwand, davor die besten Plätze.
  b.prop('fireplace', 1.9, 6.5, 1, Math.PI / 2);
  b.licht(2.6, 6.5, 5);
  b.prop('rug', 4.6, 6.5, 0.7);

  // Vier Tische: zwei am Feuer, zwei zur Tür hin. Runde Tische im Gastraum,
  // eine lange Tafel für die große Runde.
  for (const [c, r] of [[4.6, 4.4], [4.6, 8.8]] as Array<[number, number]>) {
    b.prop('table_round', c, r, 0.75);
    b.stuehle(c, r, 1.25, rng.int(3, 4));
  }
  b.prop('table_rect', 9.5, 9.5, 0.75, Math.PI / 2);
  b.stuehle(9.5, 9.5, 1.6, 4);
  b.prop('table_round', 12.5, 9.2, 0.7);
  b.stuehle(12.5, 9.2, 1.2, 3);

  // Treppe nach oben in die Gästezimmer, daneben Kleinkram.
  b.prop('stairs', 2.2, 11.4, 0.9, Math.PI / 2);
  b.streu('crate', 7.4, 2.4, 0.15);
  b.streu('sacks', 8.2, 3.2, 0.15);
  if (rng.bool(0.6)) b.streu('chair_toppled', 7, 11.6, 0.3);
  if (rng.bool(0.5)) b.streu('bloodstain', rng.range(6, 12), rng.range(10.5, 12), 0.2, [0.5, 0.8]);

  // Wandfackeln, gleichmäßig verteilt: der Raum soll überall zu sehen sein.
  for (const [c, r] of [[7, 1.6], [14.4, 7.5], [1.6, 10]] as Array<[number, number]>) {
    b.prop('wall_torch', c, r, 0.8);
    b.licht(c, r, 4);
  }
}

/**
 * Wachhaus mit Zelle.
 *
 * Der ganze Bau ist um die Zelle herum organisiert: Gitter, davor der Tisch,
 * an dem gewacht wird, dahinter die Kammer mit den Pritschen. Eine Zelle in
 * einer Ecke ohne Sichtlinie wäre kein Wachhaus, sondern ein Keller.
 */
function wachhaus(b: Bau, rng: Rng): void {
  b.boden(1, 1, 12, 9, STEIN);
  b.wand(1, 1, 12, 9);
  b.tuer(2, 10, true);

  // Zelle rechts, mit Gittertür zum Wachraum.
  b.boden(9, 1, 4, 5, 0x5d5850);
  b.zug([[9, 1], [9, 6], [13, 6]]);
  b.tuer(9, 3, false);
  b.prop('door_barred', 9, 3.5, 0.8, Math.PI / 2);
  b.streu('bedroll', 11.8, 2, 0.2, [0.85, 0.95]);
  b.streu('hay', 10.4, 4.6, 0.4);
  b.streu('bones', 11.6, 5.2, 0.3, [0.7, 0.9]);
  b.prop('chains', 12.4, 1.8, 0.8);

  // Wachraum: Tisch mit Stühlen, davon einer schief.
  b.prop('table_rect', 5, 3, 0.6);
  b.stuehle(5, 3, 1.5, 3);
  b.prop('lantern', 5, 3, 0.7);
  b.licht(5, 3, 4.5);

  // Ausrüstung an der Nordwand, Pritschen an der Südwand.
  b.prop('weapon_rack', 3, 1.7, 0.85);
  b.prop('armour_stand', 6.8, 1.8, 0.8);
  b.prop('chest', 1.9, 2.2, 0.8, Math.PI / 2);
  for (let i = 0; i < 3; i++) b.prop('bedroll', 2.4 + i * 1.6, 8.4, 0.85);
  b.prop('brazier', 7.6, 8.4, 0.9);
  b.licht(7.6, 8.4, 4);
  if (rng.bool(0.6)) b.streu('barrel', 6.4, 6.6, 0.2);
  b.streu('crate', 4.4, 6.4, 0.2);
}

/** Einraumkate: Bett, Herd, Tisch — das Zuhause einer Familie in einem Zimmer. */
function kate(b: Bau, rng: Rng): void {
  b.boden(1, 1, 9, 8, HOLZ);
  b.wand(1, 1, 9, 8);
  b.tuer(4, 9, true);

  b.prop('fireplace', 1.9, 3, 0.9, Math.PI / 2);
  b.licht(2.6, 3, 4.5);
  b.prop('cauldron', 3.2, 3, 0.6);

  b.prop('bed', 8.2, 2.6, 0.7, Math.PI / 2);
  b.prop('crib', 8.4, 4.6, 0.7);
  b.prop('wardrobe', 8.4, 6.6, 0.75, Math.PI / 2);

  b.prop('table_rect', 4.6, 6.2, 0.5);
  b.stuehle(4.6, 6.2, 1.3, rng.int(2, 3));
  b.prop('chest', 2.2, 7.6, 0.7);
  b.prop('shelf_crates', 5.4, 1.7, 0.6);
  b.streu('pottery', 6.6, 2.2, 0.2, [0.6, 0.8]);
  b.streu('woodpile', 2.4, 5.4, 0.2, [0.7, 0.85]);
  if (rng.bool(0.5)) b.streu('bird_nest', 6.8, 8, 0.3, [0.6, 0.8]);
}

/** Schrein: Altar in der Achse, Säulen links und rechts, Feuer davor. */
function schrein(b: Bau, rng: Rng): void {
  b.boden(1, 1, 10, 10, STEIN);
  b.wand(1, 1, 10, 10);
  b.tuer(5, 11, true);
  b.boden(5, 2, 2, 9, 0x7c766c);

  b.prop('altar', 6, 2.8, 0.85);
  b.prop('statue', 6, 1.9, 0.7);
  b.licht(6, 2.8, 5);
  for (const c of [3.2, 8.8]) {
    for (const r of [3.2, 5.6, 8]) b.prop('column', c, r, 0.9);
  }
  for (const c of [4.2, 7.8]) {
    b.prop('brazier', c, 4.4, 0.8);
    b.licht(c, 4.4, 4);
  }
  b.prop('rug', 6, 7.4, 0.55, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    b.prop('bench', 4, 6.2 + i * 1.4, 0.55);
    b.prop('bench', 8, 6.2 + i * 1.4, 0.55);
  }
  if (rng.bool(0.6)) b.streu('coins', 6, 3.8, 0.25, [0.6, 0.9]);
  b.streu('candelabra', 2.2, 9.4, 0.2, [0.7, 0.9]);
}

/**
 * Waldlichtung mit Lager.
 *
 * Kein Bauwerk, also keine Wände — die Sichtlinien macht hier der Bewuchs, und
 * den kann Universal VTT ohnehin nicht ausdrücken. Was zählt, ist das Bild:
 * Feuer in der Mitte, Sitzgelegenheiten drumherum, Bäume als Saum.
 */
function lichtung(b: Bau, rng: Rng): void {
  // Grundfläche als volles Rechteck und erst darauf der Fleck: ein Blob als
  // Untergrund ragt bei ungünstigem Zufall über den Kartenrand hinaus, und was
  // draußen liegt, fehlt im Bild-Export.
  b.boden(0, 0, 20, 18, 0x4e6b3c);
  b.fleck(10, 9, 7.4, GRAS, 0.14);
  b.fleck(10, 9, 4.8, ERDE, 0.3);

  b.prop('cookfire', 10, 9, 1.3);
  b.licht(10, 9, 6);
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2) + (i / 3) * Math.PI * 2;
    b.prop('log', 10 + Math.cos(a) * 2.2, 9 + Math.sin(a) * 2.2, 0.8, a + Math.PI / 2);
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.range(0, 1) + i * Math.PI;
    b.streu('tent', 10 + Math.cos(a) * 3.8, 9 + Math.sin(a) * 3.2, 0.3, [0.9, 1]);
  }
  b.streu('woodpile', 7.2, 11.4, 0.3, [0.8, 1]);
  b.streu('barrel', 12.8, 11.6, 0.3, [0.7, 0.85]);
  b.streu('crate', 12.4, 6.4, 0.3, [0.7, 0.9]);

  // Baumsaum: ein dichter Ring als Waldkante, dazu Unterholz nach innen.
  const baeume = ['tree_deciduous', 'tree_pine', 'tree_birch', 'tree_deciduous'];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const d = rng.range(7.0, 8.2);
    b.streu(rng.pick(baeume), 10 + Math.cos(a) * d, 9 + Math.sin(a) * d * 0.94, 0.3, [0.85, 1.1]);
  }
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(5.4, 6.8);
    b.streu(rng.pick(['bush', 'fern', 'grass_tuft', 'mushrooms', 'stone_medium', 'berry_bush']),
      10 + Math.cos(a) * d, 9 + Math.sin(a) * d * 0.94, 0.35, [0.8, 1.1]);
  }
  // Ein Weg, der hineinführt — eine Lichtung ohne Zugang ist eine Insel.
  b.band(10, 18.5, 10, 12.4, 1.6, WEG);
}

/**
 * Wegkreuzung mit Wegweiser.
 *
 * Der Ort, an dem Reisegruppen einander begegnen: zwei Wege, ein Schild, ein
 * Brunnen zum Rasten. Rundum Wildnis, damit klar ist, dass hier niemand wohnt.
 */
function wegkreuzung(b: Bau, rng: Rng): void {
  // Volle Grundfläche statt eines Flecks — siehe Lichtung.
  b.boden(0, 0, 18, 18, GRAS);
  b.band(9, -0.5, 9, 18.5, 2.2, WEG);
  b.band(-0.5, 9, 18.5, 9, 2.2, WEG);
  b.fleck(9, 9, 2.4, WEG, 0.18);

  b.prop('signpost', 10.4, 7.6, 0.9);
  b.prop('well', 7.2, 10.8, 0.85);
  b.prop('bench', 10.8, 10.9, 0.7);
  if (rng.bool(0.6)) {
    b.prop('cart', rng.range(11.5, 13), rng.range(8.2, 9.8), 0.85, rng.range(-0.3, 0.3));
  }
  if (rng.bool(0.5)) b.prop('w_borderstone', 7.4, 7.4, 0.8);

  // Bewuchs überall außer auf den Wegen — sonst wachsen Büsche in der Fahrbahn.
  const frei = (c: number, r: number) => Math.abs(c - 9) > 2 && Math.abs(r - 9) > 2;
  const pflanzen = ['bush', 'grass_tuft', 'fern', 'flowers', 'stone_small', 'stone_medium', 'flower_patch'];
  for (let i = 0; i < 60; i++) {
    const c = rng.range(1, 17);
    const r = rng.range(1, 17);
    if (!frei(c, r)) continue;
    b.streu(rng.pick(pflanzen), c, r, 0.25, [0.75, 1.1]);
  }
  for (let i = 0; i < 14; i++) {
    const c = rng.range(1.4, 16.6);
    const r = rng.range(1.4, 16.6);
    if (!frei(c, r) || Math.hypot(c - 9, r - 9) < 5) continue;
    b.streu(rng.pick(['tree_deciduous', 'tree_pine', 'tree_birch']), c, r, 0.3, [0.9, 1.1]);
  }
}
