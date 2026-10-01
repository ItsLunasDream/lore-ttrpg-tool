/**
 * Eingebaute prozedurale Props.
 *
 * Jede `draw`-Funktion erhält einen eigenen Zufallsgenerator; unterschiedliche
 * Seeds ergeben unterschiedliche Varianten desselben Props. Dadurch sehen
 * hundert gestreute Steine nach hundert Steinen aus, nicht nach hundert Kopien.
 */

import type { PropDef } from '../propTypes';
import { def, type Draw } from './defineProp';
import {
  PALETTE,
  band,
  bevel,
  blob,
  contactShadow,
  fabric,
  grain,
  jitterColor,
  legs,
  offset,
  planks,
  scalePts,
  shade,
  shaded,
  star,
  strokes,
  spread,
} from './draw';
import { natureProps, remainsProps, waterProps } from './propsNature';
import { dungeonProps, lootProps, settlementProps } from './propsDungeon';
import { fantasyProps, variantProps } from './propsFantasy';
import { buildingProps } from './propsBuildings';
import { interiorProps } from './propsInterior';
import { moreProps } from './propsMore';
import { worldProps } from './propsWorld';
import { extraProps } from './propsExtra';

// ---------------------------------------------------------------------------
// Steine
// ---------------------------------------------------------------------------

const drawRock =
  (radius: number, wobble: number): Draw =>
  (g, rng) => {
    const base = jitterColor(PALETTE.stone, rng, 0.12);
    const pts = blob(rng, radius, wobble, 16, rng.range(0.75, 1));
    shaded(g, pts, base, { shadow: radius * 0.12, highlight: 0.3, outline: 0.5 });
    // Kanten andeuten: ein paar Facetten quer über den Stein.
    strokes(g, rng, rng.int(2, 4), radius * 0.5, radius * 0.5, shade(base, -0.35), 1.2, 0.5);
  };

const stones: PropDef[] = [
  def('stone_pebble', 'Kiesel', 'stein', { w: 18, h: 16 }, ['stein', 'klein', 'kies'], drawRock(6, 0.22)),
  def('stone_small', 'Stein klein', 'stein', { w: 32, h: 28 }, ['stein', 'klein'], drawRock(11, 0.2)),
  def('stone_medium', 'Stein mittel', 'stein', { w: 58, h: 50 }, ['stein'], drawRock(21, 0.18)),
  def('stone_large', 'Felsbrocken', 'stein', { w: 108, h: 94 }, ['stein', 'fels', 'gross'], drawRock(40, 0.16)),

  def('stone_cluster', 'Steinhaufen', 'stein', { w: 72, h: 70 }, ['stein', 'haufen', 'schutt'], (g, rng) => {
    const n = rng.int(4, 7);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 22;
      const r = rng.range(6, 14);
      const c = jitterColor(PALETTE.stone, rng, 0.16);
      const pts = offset(blob(rng, r, 0.22, 12, rng.range(0.8, 1)), Math.cos(a) * d, Math.sin(a) * d);
      shaded(g, pts, c, { shadow: 1.5, highlight: 0.25, outline: 0.45 });
    }
  }),

  def('rubble', 'Schutt', 'stein', { w: 66, h: 86 }, ['schutt', 'truemmer', 'ruine'], (g, rng) => {
    const n = rng.int(8, 14);
    for (let i = 0; i < n; i++) {
      const x = spread(rng, 12);
      const y = spread(rng, 12);
      const r = rng.range(2.5, 7);
      const c = jitterColor(PALETTE.stoneDark, rng, 0.2);
      g.poly(offset(blob(rng, r, 0.3, 7), x, y)).fill({ color: c });
    }
  }),

  def('boulder_mossy', 'Moosfelsen', 'stein', { w: 98, h: 86 }, ['stein', 'moos', 'wald'], (g, rng) => {
    const pts = blob(rng, 37, 0.16, 16, rng.range(0.8, 1));
    shaded(g, pts, jitterColor(PALETTE.stone, rng, 0.1), { shadow: 4, highlight: 0.28, outline: 0.5 });
    // Moos sitzt bevorzugt auf einer Seite, nicht rundum verteilt.
    const side = rng.range(0, Math.PI * 2);
    for (let i = 0; i < rng.int(3, 6); i++) {
      const a = side + spread(rng, 0.7);
      const d = rng.range(8, 26);
      g.poly(
        offset(blob(rng, rng.range(6, 12), 0.35, 10), Math.cos(a) * d, Math.sin(a) * d),
      ).fill({ color: jitterColor(PALETTE.leafDark, rng, 0.15), alpha: 0.85 });
    }
  }),
];

// ---------------------------------------------------------------------------
// Pflanzen und Bäume
// ---------------------------------------------------------------------------

const plants: PropDef[] = [
  def('grass_tuft', 'Grasbüschel', 'pflanze', { w: 38, h: 34 }, ['gras', 'busch', 'klein'], (g, rng) => {
    const c = jitterColor(PALETTE.grass, rng, 0.16);
    for (let i = 0; i < rng.int(9, 15); i++) {
      const x0 = spread(rng, 5);
      const lean = rng.range(-7, 7);
      const h = rng.range(9, 16);
      g.moveTo(x0, 6)
        .quadraticCurveTo(x0 + lean * 0.4, 6 - h * 0.6, x0 + lean, 6 - h)
        .stroke({ width: rng.range(1.2, 2.2), color: rng.bool(0.3) ? shade(c, -0.2) : c, alpha: 0.95 });
    }
  }),

  def('bush', 'Busch', 'pflanze', { w: 76, h: 78 }, ['busch', 'strauch'], (g, rng) => {
    const c = jitterColor(PALETTE.leaf, rng, 0.14);
    const outline = blob(rng, 27, 0.22, 20);
    g.poly(offset(outline, 3, 4)).fill({ color: 0x000000, alpha: 0.22 });
    g.poly(outline).fill({ color: shade(c, -0.28) });

    // Rundum verteilte Ballen statt weniger zufälliger Kleckse — sonst liest
    // sich der Busch als ein paar einzelne Blätter.
    const balls = rng.int(6, 9);
    for (let i = 0; i < balls; i++) {
      const a = (i / balls) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = rng.range(7, 14);
      const r = rng.range(9, 14);
      const shape = blob(rng, r, 0.32, 12);
      const bx = Math.cos(a) * d;
      const by = Math.sin(a) * d;
      g.poly(offset(shape, bx, by)).fill({ color: jitterColor(c, rng, 0.12) });
      g.poly(offset(scalePts(shape, 0.55), bx - r * 0.2, by - r * 0.24)).fill({
        color: shade(c, 0.18),
        alpha: 0.45,
      });
    }
  }),

  def('fern', 'Farn', 'pflanze', 48, ['farn', 'pflanze', 'wald'], (g, rng) => {
    const c = jitterColor(PALETTE.leafDark, rng, 0.15);
    const fronds = rng.int(5, 8);
    const phase = rng.range(0, Math.PI * 2);
    for (let i = 0; i < fronds; i++) {
      const a = phase + (i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const len = rng.range(14, 22);
      const ex = Math.cos(a) * len;
      const ey = Math.sin(a) * len;
      g.moveTo(0, 0)
        .quadraticCurveTo(ex * 0.4 - ey * 0.25, ey * 0.4 + ex * 0.25, ex, ey)
        .stroke({ width: 2.4, color: c, alpha: 0.95 });
    }
  }),

  def('flowers', 'Blumen', 'pflanze', { w: 44, h: 54 }, ['blume', 'wiese', 'deko'], (g, rng) => {
    const petal = rng.pick([0xd8697a, 0xe0c05a, 0xb07fd0, 0xe8e2d2]);
    for (let i = 0; i < rng.int(5, 9); i++) {
      const x = spread(rng, 8);
      const y = spread(rng, 8);
      g.moveTo(x, y + 7).lineTo(x, y).stroke({ width: 1.4, color: PALETTE.grass, alpha: 0.9 });
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + rng.range(0, 1);
        g.circle(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4, 1.9).fill({
          color: jitterColor(petal, rng, 0.12),
        });
      }
      g.circle(x, y, 1.4).fill({ color: 0xf3d98a });
    }
  }),

  def('mushrooms', 'Pilze', 'pflanze', 38, ['pilz', 'hoehle', 'wald'], (g, rng) => {
    const cap = rng.pick([0xb5533f, 0xc8a76a, 0x7f6fa8, 0xd4d0c4]);
    for (let i = 0; i < rng.int(3, 6); i++) {
      const x = spread(rng, 6);
      const y = spread(rng, 5);
      const r = rng.range(3, 6);
      g.rect(x - r * 0.28, y, r * 0.56, r * 1.1).fill({ color: 0xe6ddc8 });
      g.ellipse(x, y, r, r * 0.72).fill({ color: jitterColor(cap, rng, 0.12) });
      if (rng.bool(0.5)) {
        g.circle(x - r * 0.3, y - r * 0.15, r * 0.16).fill({ color: 0xffffff, alpha: 0.7 });
        g.circle(x + r * 0.35, y + r * 0.1, r * 0.13).fill({ color: 0xffffff, alpha: 0.7 });
      }
    }
  }),

  def('tree_deciduous', 'Laubbaum', 'baum', { w: 176, h: 172 }, ['baum', 'laub', 'wald'], (g, rng) => {
    const c = jitterColor(PALETTE.leaf, rng, 0.13);
    const outline = blob(rng, 58, 0.22, 26);

    // Gestaffelter Schatten statt einer harten Kopie: von oben gesehen soll der
    // Baum über dem Boden zu schweben scheinen, nicht aufgeklebt wirken.
    for (const [d, a] of [[11, 0.1], [8, 0.14], [5, 0.18]] as const) {
      g.poly(offset(outline, d, d * 1.1)).fill({ color: 0x000000, alpha: a });
    }

    g.poly(outline).fill({ color: shade(c, -0.3) });

    // Einzelne Laubballen mit eigener Lichtkante — das erzeugt die Textur, die
    // eine Krone von einem Farbklecks unterscheidet.
    const balls = rng.int(6, 9);
    for (let i = 0; i < balls; i++) {
      const a = (i / balls) * Math.PI * 2 + rng.range(-0.35, 0.35);
      const d = rng.range(14, 30);
      const r = rng.range(17, 26);
      const bx = Math.cos(a) * d;
      const by = Math.sin(a) * d;
      const shape = blob(rng, r, 0.3, 14);
      g.poly(offset(shape, bx + 2, by + 3)).fill({ color: shade(c, -0.35), alpha: 0.7 });
      g.poly(offset(shape, bx, by)).fill({ color: jitterColor(c, rng, 0.09) });
      g.poly(offset(scalePts(shape, 0.6), bx - r * 0.22, by - r * 0.26)).fill({
        color: shade(c, 0.2),
        alpha: 0.5,
      });
    }

    // Helle Mitte als Lichtpunkt der Krone.
    g.poly(offset(scalePts(outline, 0.4), -6, -8)).fill({ color: shade(c, 0.28), alpha: 0.45 });

    // Ein paar dunkle Lücken lassen den Stamm durchscheinen.
    for (let i = 0; i < rng.int(2, 4); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(10, 34);
      g.poly(
        offset(blob(rng, rng.range(3, 6), 0.4, 9), Math.cos(a) * d, Math.sin(a) * d),
      ).fill({ color: PALETTE.woodDark, alpha: 0.55 });
    }
  }),

  def('tree_pine', 'Nadelbaum', 'baum', 130, ['baum', 'nadel', 'tanne', 'wald'], (g, rng) => {
    const c = jitterColor(PALETTE.pine, rng, 0.1);
    const outer = star(rng, 52, 30, rng.int(9, 13));
    g.poly(offset(outer, 5, 6)).fill({ color: 0x000000, alpha: 0.28 });
    // Von außen nach innen heller, aber ohne Richtung Weiß zu kippen — sonst
    // wird das Grün fahl und wirkt blaustichig.
    g.poly(outer).fill({ color: shade(c, -0.3) });
    g.poly(star(rng, 36, 20, rng.int(8, 11))).fill({ color: shade(c, -0.12) });
    g.poly(star(rng, 21, 12, 8)).fill({ color: c });
    g.circle(0, 0, 3.5).fill({ color: PALETTE.woodDark });
  }),

  def('tree_dead', 'Toter Baum', 'baum', { w: 122, h: 118 }, ['baum', 'tot', 'kahl', 'sumpf'], (g, rng) => {
    const c = jitterColor(PALETTE.woodDark, rng, 0.12);
    const branches = rng.int(5, 8);
    const phase = rng.range(0, Math.PI * 2);
    for (let i = 0; i < branches; i++) {
      const a = phase + (i / branches) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const len = rng.range(24, 46);
      let x = 0;
      let y = 0;
      let dir = a;
      let w = 4.5;
      // Jeder Ast knickt zwei- bis dreimal ab — wirkt organischer als eine Gerade.
      for (let s = 0; s < rng.int(2, 4); s++) {
        const seg = len / 3;
        const nx = x + Math.cos(dir) * seg;
        const ny = y + Math.sin(dir) * seg;
        g.moveTo(x, y).lineTo(nx, ny).stroke({ width: w, color: c, cap: 'round' });
        x = nx;
        y = ny;
        dir += rng.range(-0.5, 0.5);
        w = Math.max(1.2, w * 0.68);
      }
    }
    g.circle(0, 0, 7).fill({ color: shade(c, 0.12) });
  }),

  def('stump', 'Baumstumpf', 'baum', 48, ['stumpf', 'holz', 'wald'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.12);
    const outer = blob(rng, 18, 0.14, 14);
    shaded(g, outer, c, { shadow: 2.5, outline: 0.5 });
    for (let r = 13; r > 2; r -= rng.range(2.5, 4.5)) {
      g.circle(rng.range(-1.5, 1.5), rng.range(-1.5, 1.5), r).stroke({
        width: 1,
        color: shade(c, -0.3),
        alpha: 0.6,
      });
    }
  }),

  def('log', 'Baumstamm', 'baum', { w: 120, h: 42 }, ['holz', 'stamm', 'wald'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.12);
    const len = rng.range(48, 56);
    const r = rng.range(9, 13);
    g.roundRect(-len + 2, -r + 3, len * 2, r * 2, r * 0.5).fill({ color: 0x000000, alpha: 0.22 });
    g.roundRect(-len, -r, len * 2, r * 2, r * 0.5).fill({ color: c });
    g.ellipse(-len + 3, 0, r * 0.4, r * 0.92).fill({ color: shade(c, 0.2) });
    for (let i = 0; i < rng.int(3, 6); i++) {
      const x = rng.range(-len * 0.8, len * 0.8);
      g.moveTo(x, -r * 0.7).lineTo(x + rng.range(-6, 6), r * 0.7).stroke({
        width: 1.1,
        color: shade(c, -0.3),
        alpha: 0.5,
      });
    }
  }),
];

// ---------------------------------------------------------------------------
// Boden und Spuren
// ---------------------------------------------------------------------------

const ground: PropDef[] = [
  def('gravel', 'Kies', 'boden', 70, ['kies', 'boden', 'weg'], (g, rng) => {
    for (let i = 0; i < rng.int(24, 40); i++) {
      const x = spread(rng, 13);
      const y = spread(rng, 13);
      g.circle(x, y, rng.range(1.2, 3.2)).fill({
        color: jitterColor(PALETTE.stoneLight, rng, 0.18),
        alpha: rng.range(0.6, 1),
      });
    }
  }),

  def('crack', 'Riss', 'boden', { w: 100, h: 90 }, ['riss', 'boden', 'schaden'], (g, rng) => {
    const c = shade(PALETTE.stoneDark, -0.25);
    const walk = (x: number, y: number, dir: number, len: number, w: number, depth: number) => {
      let cx = x;
      let cy = y;
      let d = dir;
      const steps = rng.int(3, 6);
      for (let i = 0; i < steps; i++) {
        const seg = len / steps;
        const nx = cx + Math.cos(d) * seg;
        const ny = cy + Math.sin(d) * seg;
        g.moveTo(cx, cy).lineTo(nx, ny).stroke({ width: w, color: c, alpha: 0.75, cap: 'round' });
        // Gelegentliche Verzweigung, sonst sieht der Riss wie eine Linie aus.
        if (depth < 2 && rng.bool(0.35)) {
          walk(nx, ny, d + rng.range(-1.1, 1.1), len * 0.5, w * 0.6, depth + 1);
        }
        cx = nx;
        cy = ny;
        d += rng.range(-0.45, 0.45);
      }
    };
    // Kurz genug, dass der Riss im eigenen Feld bleibt: ein Riss, der über
    // den Rahmen hinausläuft, wird beim Backen der Textur glatt abgeschnitten.
    walk(rng.range(-28, -14), rng.range(-8, 8), rng.range(-0.4, 0.4), rng.range(34, 48), 3, 0);
  }),

  def('puddle', 'Pfütze', 'boden', { w: 86, h: 80 }, ['wasser', 'pfuetze', 'boden'], (g, rng) => {
    const pts = blob(rng, 32, 0.24, 20, rng.range(0.5, 0.8));
    g.poly(pts).fill({ color: PALETTE.water, alpha: 0.55 });
    g.poly(scalePts(pts, 0.82)).fill({ color: shade(PALETTE.water, 0.25), alpha: 0.35 });
    g.poly(pts).stroke({ width: 1.5, color: shade(PALETTE.water, -0.3), alpha: 0.5 });
  }),

  def('bloodstain', 'Blutfleck', 'boden', { w: 86, h: 82 }, ['blut', 'fleck', 'kampf'], (g, rng) => {
    const c = 0x7a1f1f;
    g.poly(blob(rng, 24, 0.35, 18, rng.range(0.6, 1))).fill({ color: c, alpha: 0.7 });
    for (let i = 0; i < rng.int(4, 9); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(22, 40);
      g.circle(Math.cos(a) * d, Math.sin(a) * d, rng.range(1.5, 4)).fill({ color: c, alpha: 0.6 });
    }
  }),
];

// ---------------------------------------------------------------------------
// Möbel und Dungeon
// ---------------------------------------------------------------------------

const furniture: PropDef[] = [
  def('barrel', 'Fass', 'moebel', 56, ['fass', 'lager', 'taverne'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 24, 24, 2, 3);
    g.circle(0, 0, 24).fill({ color: c });
    // Dauben: einzelne Bretter, jedes etwas anders getönt — nicht bloß
    // Trennstriche auf einer Fläche.
    const dauben = 9;
    for (let i = 0; i < dauben; i++) {
      const a0 = (i / dauben) * Math.PI * 2;
      const a1 = ((i + 1) / dauben) * Math.PI * 2;
      const pts: number[] = [];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + ((a1 - a0) * k) / 4;
        pts.push(Math.cos(a) * 24, Math.sin(a) * 24);
      }
      pts.push(0, 0);
      g.poly(pts).fill({ color: shade(c, rng.range(-0.1, 0.1)), alpha: 0.9 });
    }
    for (const r of [21, 12]) {
      g.circle(0, 0, r).stroke({ width: 2.6, color: PALETTE.metalDark, alpha: 0.9 });
      g.circle(0, 0, r - 0.9).stroke({ width: 0.9, color: shade(PALETTE.metal, 0.35), alpha: 0.5 });
    }
    // Spundloch mit Zapfen.
    g.circle(0, 0, 6.5).fill({ color: shade(c, -0.3) });
    g.circle(-0.8, -0.8, 4.6).fill({ color: shade(c, 0.22) });
    g.circle(0, 0, 24).stroke({ width: 2, color: shade(c, -0.45) });
    g.arc(0, 0, 21, Math.PI * 1.05, Math.PI * 1.6).stroke({ width: 2.4, color: 0xffffff, alpha: 0.16 });
  }),

  def('crate', 'Kiste', 'moebel', 60, ['kiste', 'lager', 'holz'], (g, rng) => {
    const c = jitterColor(PALETTE.woodLight, rng, 0.1);
    const s = 25;
    contactShadow(g, s, s, 2.5, 3);
    // Deckel aus Brettern statt einer Fläche mit Kreuz darauf.
    planks(g, rng, -s, -s, s * 2, s * 2, c, 4);
    // Diagonalstrebe, wie sie ein Kistendeckel wirklich hat: ein Brett,
    // kein Strich.
    for (const [x0, y0, x1, y1] of [
      [-s, -s, s, s],
      [s, -s, -s, s],
    ]) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const nx = (-dy / len) * 3.2;
      const ny = (dx / len) * 3.2;
      g.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny])
        .fill({ color: shade(c, 0.1) });
      g.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny])
        .stroke({ width: 0.8, color: shade(c, -0.35), alpha: 0.6 });
    }
    // Eckbeschläge mit Nieten.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        g.rect(sx > 0 ? s - 9 : -s, sy > 0 ? s - 4 : -s, 9, 4)
          .fill({ color: PALETTE.metalDark, alpha: 0.9 });
        g.circle(sx * (s - 4.5), sy * (s - 2), 1.2).fill({ color: 0xd8dde3, alpha: 0.8 });
      }
    }
    g.rect(-s, -s, s * 2, s * 2).stroke({ width: 2.2, color: shade(c, -0.45) });
    bevel(g, -s, -s, s * 2, s * 2, c, 0.22);
  }),

  def('chest', 'Truhe', 'moebel', { w: 72, h: 50 }, ['truhe', 'schatz', 'beute'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 32, 22, 2.5, 3);
    planks(g, rng, -32, -22, 62, 42, c, 3);
    // Der gewölbte Deckel: heller Streifen oben, Schatten am Scharnier.
    g.rect(-32, -22, 62, 12).fill({ color: shade(c, 0.16) });
    g.rect(-32, -12, 62, 3).fill({ color: shade(c, -0.3), alpha: 0.6 });
    for (const x of [-24, 0, 22]) band(g, x - 3.5, -22, 7, 42, PALETTE.metalDark, 3);
    // Schloss mit Beschlagplatte.
    g.roundRect(-8, -8, 16, 16, 2).fill({ color: 0xb08a2e }).stroke({ width: 1, color: 0x6b520f });
    g.roundRect(-6, -6, 12, 12, 1.5).fill({ color: 0xd9b64a });
    g.circle(0, 1, 2.2).fill({ color: 0x3a2c10 });
    g.rect(-0.9, 1, 1.8, 4).fill({ color: 0x3a2c10 });
    g.roundRect(-32, -22, 62, 42, 3).stroke({ width: 2, color: shade(c, -0.5) });
  }),

  def('table_round', 'Tisch rund', 'moebel', 100, ['tisch', 'moebel', 'taverne'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 44, 44, 3, 4);
    // Beine schauen unter der Platte hervor — daran erkennt man von oben
    // einen Tisch und keine Scheibe.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
      // Etwas weiter außen als die Platte: sonst verdeckt sie die Beine
      // vollständig und der Tisch liegt wieder flach auf dem Boden.
      g.circle(Math.cos(a) * 42, Math.sin(a) * 42, 6).fill({ color: shade(c, -0.4) });
    }
    g.circle(0, 0, 44).fill({ color: c });
    // Radial verlegte Bretter statt Strichen auf einer Fläche.
    const bretter = 12;
    for (let i = 0; i < bretter; i++) {
      const a0 = (i / bretter) * Math.PI * 2;
      const a1 = ((i + 1) / bretter) * Math.PI * 2;
      const pts: number[] = [0, 0];
      for (let k = 0; k <= 4; k++) {
        const a = a0 + ((a1 - a0) * k) / 4;
        pts.push(Math.cos(a) * 44, Math.sin(a) * 44);
      }
      g.poly(pts).fill({ color: shade(c, rng.range(-0.07, 0.07)), alpha: 0.85 });
      g.moveTo(Math.cos(a0) * 8, Math.sin(a0) * 8)
        .lineTo(Math.cos(a0) * 43, Math.sin(a0) * 43)
        .stroke({ width: 0.9, color: shade(c, -0.3), alpha: 0.45 });
    }
    g.circle(0, 0, 8).fill({ color: shade(c, -0.18) });
    g.circle(0, 0, 44).stroke({ width: 2.5, color: shade(c, -0.45) });
    g.arc(0, 0, 41, Math.PI * 1.1, Math.PI * 1.65).stroke({ width: 3, color: 0xffffff, alpha: 0.14 });
  }),

  def('table_rect', 'Tisch lang', 'moebel', { w: 206, h: 94 }, ['tisch', 'bank', 'halle'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 88, 40, 3, 4);
    // Die Beine stehen absichtlich über die Platte hinaus — nur so sind sie
    // von oben zu sehen.
    legs(g, 86, 37, 10, c);
    planks(g, rng, -88, -40, 176, 80, c, 5);
    // Zarge: der schmale Rahmen unter der Platte, an dem die Beine sitzen.
    g.rect(-88, -40, 176, 80).stroke({ width: 2.5, color: shade(c, -0.45) });
    g.rect(-84, -36, 168, 72).stroke({ width: 1.2, color: shade(c, -0.28), alpha: 0.5 });
    bevel(g, -88, -40, 176, 80, c, 0.24);
  }),

  def('chair', 'Stuhl', 'moebel', 44, ['stuhl', 'sitz', 'moebel'], (g, rng) => {
    const c = jitterColor(PALETTE.woodLight, rng, 0.1);
    contactShadow(g, 16, 16, 2, 2.5);
    // Von oben: vier Beine, Sitzfläche, dahinter die Lehne mit Sprossen.
    legs(g, 14, 12, 5, c);
    g.roundRect(-15, -12, 30, 26, 3).fill({ color: c });
    grain(g, rng, -15, -12, 30, 26, shade(c, -0.3), 4, false, 0.3);
    g.roundRect(-15, -12, 30, 26, 3).stroke({ width: 1.6, color: shade(c, -0.45) });
    // Lehne: Rahmen und zwei Sprossen, nicht bloß ein Balken.
    g.roundRect(-16, -20, 32, 8, 2).fill({ color: shade(c, -0.12) });
    for (const x of [-8, 0, 8]) g.rect(x - 1.4, -19, 2.8, 6).fill({ color: shade(c, -0.34) });
    g.roundRect(-16, -20, 32, 8, 2).stroke({ width: 1.4, color: shade(c, -0.45) });
    g.rect(-13, -10, 26, 3).fill({ color: 0xffffff, alpha: 0.12 });
  }),

  def('bed', 'Bett', 'moebel', { w: 100, h: 164 }, ['bett', 'schlaf', 'gasthaus'], (g, rng) => {
    const wood = jitterColor(PALETTE.woodDark, rng, 0.1);
    const cloth = jitterColor(0xb8a98c, rng, 0.08);
    contactShadow(g, 46, 78, 3, 4);
    // Bettgestell aus Brettern, mit Kopf- und Fußbrett.
    planks(g, rng, -46, -78, 90, 154, wood, 3, true);
    g.roundRect(-46, -78, 90, 154, 4).stroke({ width: 2.2, color: shade(wood, -0.4) });
    g.rect(-46, -78, 90, 10).fill({ color: shade(wood, 0.18) });
    g.rect(-46, 66, 90, 10).fill({ color: shade(wood, 0.1) });
    // Matratze, Decke mit Falten, umgeschlagenes Laken, Kissen.
    g.roundRect(-40, -66, 78, 138, 3).fill({ color: shade(cloth, 0.25) });
    fabric(g, rng, -40, -30, 78, 100, cloth, 5);
    g.roundRect(-40, -34, 78, 10, 2).fill({ color: shade(cloth, 0.35) });
    g.roundRect(-34, -62, 66, 26, 6).fill({ color: 0xf2eee2 });
    g.roundRect(-34, -62, 66, 26, 6).stroke({ width: 1, color: 0xc9c2ae, alpha: 0.8 });
    g.moveTo(0, -58).lineTo(0, -40).stroke({ width: 1, color: 0xd8d2c2, alpha: 0.9 });
  }),

  def('bookshelf', 'Bücherregal', 'moebel', { w: 132, h: 50 }, ['regal', 'buch', 'bibliothek'], (g, rng) => {
    const wood = jitterColor(PALETTE.woodDark, rng, 0.1);
    g.rect(-62, -22, 126, 46).fill({ color: 0x000000, alpha: 0.2 });
    g.rect(-64, -24, 126, 46).fill({ color: wood }).stroke({ width: 2, color: shade(wood, -0.4) });
    let x = -60;
    while (x < 56) {
      const w = rng.range(4, 9);
      const h = rng.range(24, 38);
      g.rect(x, 20 - h, w, h).fill({
        color: rng.pick([0x8a3b32, 0x35566b, 0x4d6b3c, 0x8a6a2f, 0x5b3f6b]),
      });
      x += w + rng.range(0.5, 2.5);
    }
    g.moveTo(-64, 0).lineTo(62, 0).stroke({ width: 2.5, color: shade(wood, -0.3) });
  }),

  def('rug', 'Teppich', 'deko', { w: 196, h: 136 }, ['teppich', 'deko', 'boden'], (g, rng) => {
    const c = jitterColor(rng.pick([0x8a3b32, 0x35566b, 0x6b4a7a, 0x4d6b3c]), rng, 0.08);
    const hell = shade(c, 0.3);
    const dunkel = shade(c, -0.32);
    contactShadow(g, 92, 62, 2, 3, 0.22);
    g.roundRect(-92, -62, 184, 124, 3).fill({ color: c });
    // Fransen an den Schmalseiten — daran erkennt man einen Teppich sofort.
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 17; i++) {
        const y = -58 + i * 7.2;
        g.moveTo(sx * 92, y)
          .lineTo(sx * (92 + rng.range(3, 5.5)), y + rng.range(-1.5, 1.5))
          .stroke({ width: 1.6, color: shade(c, 0.45), alpha: 0.8 });
      }
    }
    // Zwei Bordüren mit Punktreihe statt bloßer Striche.
    g.roundRect(-84, -54, 168, 108, 2).fill({ color: dunkel, alpha: 0.5 });
    g.roundRect(-78, -48, 156, 96, 2).fill({ color: c });
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      g.circle(-81 + t * 162, -51, 2).fill({ color: hell, alpha: 0.65 });
      g.circle(-81 + t * 162, 51, 2).fill({ color: hell, alpha: 0.65 });
    }
    // Mittelfeld mit Medaillon und Eckornamenten.
    g.roundRect(-62, -36, 124, 72, 2).stroke({ width: 2.4, color: hell, alpha: 0.7 });
    g.ellipse(0, 0, 34, 22).fill({ color: dunkel, alpha: 0.55 });
    g.ellipse(0, 0, 34, 22).stroke({ width: 2, color: hell, alpha: 0.8 });
    g.ellipse(0, 0, 20, 12).stroke({ width: 1.6, color: hell, alpha: 0.6 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.circle(Math.cos(a) * 27, Math.sin(a) * 17, 2.6).fill({ color: hell, alpha: 0.75 });
    }
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        g.poly([sx * 56, sy * 30, sx * 40, sy * 30, sx * 56, sy * 16])
          .fill({ color: hell, alpha: 0.45 });
      }
    }
    // Etwas Abnutzung, sonst wirkt das Muster wie gedruckt.
    strokes(g, rng, rng.int(5, 10), 70, 12, shade(c, -0.2), 1.4, 0.25);
  }),
];

const dungeon: PropDef[] = [
  def('brazier', 'Feuerschale', 'dungeon', 54, ['feuer', 'licht', 'fackel'], (g, rng) => {
    g.circle(2, 2.5, 22).fill({ color: 0x000000, alpha: 0.25 });
    g.circle(0, 0, 22).fill({ color: PALETTE.metalDark }).stroke({ width: 2, color: 0x33383e });
    g.circle(0, 0, 16).fill({ color: 0x2a2622 });
    for (let i = 0; i < rng.int(5, 9); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, 12);
      g.circle(Math.cos(a) * d, Math.sin(a) * d, rng.range(3, 7)).fill({
        color: rng.pick([PALETTE.fire, 0xe4762c, 0xf6d05a]),
        alpha: 0.9,
      });
    }
    g.circle(0, 0, 6).fill({ color: 0xfbe8a6, alpha: 0.9 });
  }),

  def('campfire', 'Lagerfeuer', 'dungeon', 76, ['feuer', 'lager', 'rast'], (g, rng) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng.range(-0.15, 0.15);
      g.poly(
        offset(blob(rng, rng.range(5, 8), 0.25, 9), Math.cos(a) * 28, Math.sin(a) * 28),
      ).fill({ color: jitterColor(PALETTE.stone, rng, 0.15) });
    }
    // Scheite kreuzweise, deutlich dicker und heller als der Steinring —
    // sonst gehen sie zwischen Ring und Glut unter.
    for (let i = 0; i < 4; i++) {
      const a = rng.range(0, Math.PI) + (i / 4) * Math.PI;
      const len = rng.range(15, 19);
      g.moveTo(Math.cos(a) * len, Math.sin(a) * len)
        .lineTo(Math.cos(a + Math.PI) * len, Math.sin(a + Math.PI) * len)
        .stroke({ width: 6, color: jitterColor(PALETTE.wood, rng, 0.1), cap: 'round' });
      g.moveTo(Math.cos(a) * len, Math.sin(a) * len)
        .lineTo(Math.cos(a + Math.PI) * len, Math.sin(a + Math.PI) * len)
        .stroke({ width: 2, color: shade(PALETTE.woodDark, -0.2), alpha: 0.5, cap: 'round' });
    }
    g.circle(0, 0, 11).fill({ color: 0xe4762c, alpha: 0.9 });
    g.circle(0, 0, 7).fill({ color: PALETTE.fire });
    g.circle(0, 0, 3.5).fill({ color: 0xfbe8a6 });
  }),

  def('column', 'Säule', 'struktur', 70, ['saeule', 'struktur', 'tempel'], (g, rng) => {
    // Bewusst nicht stoneLight: eine Säule von oben ist eine Standfläche, kein
    // Leuchtpunkt — zu hell und sie sticht aus jeder Karte heraus.
    const c = jitterColor(PALETTE.stone, rng, 0.08);
    g.circle(4, 4, 31).fill({ color: 0x000000, alpha: 0.3 });
    g.circle(0, 0, 31).fill({ color: shade(c, -0.3) });
    g.circle(0, 0, 25).fill({ color: c });
    g.circle(0, 0, 25).stroke({ width: 1.5, color: shade(c, -0.4), alpha: 0.8 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.moveTo(Math.cos(a) * 12, Math.sin(a) * 12)
        .lineTo(Math.cos(a) * 24, Math.sin(a) * 24)
        .stroke({ width: 1.4, color: shade(c, -0.3), alpha: 0.6 });
    }
    g.circle(0, 0, 11).fill({ color: shade(c, 0.12) });
  }),

  def('stairs', 'Treppe', 'struktur', { w: 100, h: 120 }, ['treppe', 'struktur', 'auf'], (g, rng) => {
    const c = jitterColor(PALETTE.stone, rng, 0.08);
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const w = 46 - t * 12;
      const y = -56 + i * (112 / steps);
      g.rect(-w, y, w * 2, 112 / steps - 2).fill({ color: shade(c, -0.05 + t * 0.22) });
      g.rect(-w, y, w * 2, 112 / steps - 2).stroke({ width: 1, color: shade(c, -0.35), alpha: 0.6 });
    }
  }),

  def('bones', 'Knochen', 'deko', { w: 76, h: 64 }, ['knochen', 'skelett', 'tod'], (g, rng) => {
    const c = jitterColor(PALETTE.bone, rng, 0.06);
    for (let i = 0; i < rng.int(3, 6); i++) {
      const x = spread(rng, 10);
      const y = spread(rng, 10);
      const a = rng.range(0, Math.PI);
      const len = rng.range(9, 17);
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len;
      g.moveTo(x - dx, y - dy).lineTo(x + dx, y + dy).stroke({ width: 3.2, color: c, cap: 'round' });
      g.circle(x - dx, y - dy, 2.6).fill({ color: c });
      g.circle(x + dx, y + dy, 2.6).fill({ color: c });
    }
    if (rng.bool(0.4)) {
      g.circle(rng.range(-14, 14), rng.range(-14, 14), 7).fill({ color: c });
    }
  }),

  def('web', 'Spinnweben', 'deko', 90, ['spinne', 'netz', 'hoehle'], (g, rng) => {
    const c = 0xd8d8d8;
    const spokes = rng.int(6, 9);
    const phase = rng.range(0, Math.PI * 2);
    const reach = 40;
    for (let i = 0; i < spokes; i++) {
      const a = phase + (i / spokes) * Math.PI * 2;
      g.moveTo(0, 0).lineTo(Math.cos(a) * reach, Math.sin(a) * reach).stroke({
        width: 1,
        color: c,
        alpha: 0.5,
      });
    }
    for (let r = 8; r < reach; r += rng.range(6, 11)) {
      for (let i = 0; i < spokes; i++) {
        const a1 = phase + (i / spokes) * Math.PI * 2;
        const a2 = phase + ((i + 1) / spokes) * Math.PI * 2;
        const sag = r * 0.86;
        g.moveTo(Math.cos(a1) * r, Math.sin(a1) * r)
          .quadraticCurveTo(
            Math.cos((a1 + a2) / 2) * sag,
            Math.sin((a1 + a2) / 2) * sag,
            Math.cos(a2) * r,
            Math.sin(a2) * r,
          )
          .stroke({ width: 0.9, color: c, alpha: 0.4 });
      }
    }
  }),

  def('door_wood', 'Holztür', 'struktur', { w: 100, h: 26 }, ['tuer', 'holz', 'dungeon'], (g, rng) => {
    const c = jitterColor(PALETTE.wood, rng, 0.1);
    g.roundRect(-48, -11, 96, 22, 2).fill({ color: c }).stroke({ width: 2, color: shade(c, -0.45) });
    for (let i = 1; i < 6; i++) {
      const x = -48 + (96 / 6) * i;
      g.moveTo(x, -11).lineTo(x, 11).stroke({ width: 1.2, color: shade(c, -0.3), alpha: 0.6 });
    }
    g.rect(-44, -11, 5, 22).fill({ color: PALETTE.metalDark });
    g.rect(39, -11, 5, 22).fill({ color: PALETTE.metalDark });
    g.circle(30, 0, 3).fill({ color: 0xd9b64a });
  }),
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const BUILTIN_PROPS: PropDef[] = [
  ...stones,
  ...plants,
  ...ground,
  ...furniture,
  ...dungeon,
  ...natureProps,
  ...waterProps,
  ...remainsProps,
  ...dungeonProps,
  ...lootProps,
  ...settlementProps,
  ...variantProps,
  ...fantasyProps,
  ...worldProps,
  ...extraProps,
  ...buildingProps,
  ...interiorProps,
  ...moreProps,
];
