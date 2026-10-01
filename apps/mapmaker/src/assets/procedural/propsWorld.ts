/**
 * Weltkarten-Signaturen.
 *
 * Anders als die Battlemap-Props zeigen diese hier kein Objekt von oben,
 * sondern ein *Zeichen* dafür: ein Gebirge ist eine Reihe stilisierter Zacken,
 * kein Luftbild. Das ist die Bildsprache gezeichneter Karten, und in diesem
 * Maßstab die einzige, die lesbar bleibt — ein Wald aus einzelnen Baumkronen
 * wäre bei zwanzig Kilometern je Feld nur noch grünes Rauschen.
 */

import type { Graphics } from 'pixi.js';
import type { Rng } from '@/model/rng';
import type { PropDef } from '../propTypes';
import { def } from './defineProp';
import { jitterColor, shade } from './draw';

const TINTE = 0x3b3227;
const PERGAMENT = 0xd9c9a3;

/**
 * Runder, leicht unregelmäßiger Umriss.
 *
 * `blob` aus draw.ts wäre dasselbe, zieht aber die Battlemap-Palette mit —
 * hier reicht der Umriss, und die Signaturen sollen ihre eigene Handschrift
 * behalten.
 */
function blobUmriss(rng: Rng, radius: number, wobble: number, count = 18): number[] {
  const p1 = rng.range(0, Math.PI * 2);
  const p2 = rng.range(0, Math.PI * 2);
  const pts: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = radius * (1 + wobble * Math.sin(2 * a + p1) + wobble * 0.6 * Math.sin(3 * a + p2));
    pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.8);
  }
  return pts;
}


/** Boden-Schatten unter einer Signatur: flache Ellipse, hält sie auf der Karte. */
function bodenschatten(g: Graphics, x: number, y: number, rx: number, ry: number): void {
  g.ellipse(x, y, rx, ry).fill({ color: 0x000000, alpha: 0.18 });
}

/**
 * Häuschen von schräg vorn, wie auf gezeichneten Karten: Giebelseite mit
 * Tür und Fenster, Dachfläche daneben dunkler. `y` ist die Traufkante unten.
 */
function haeuschen(g: Graphics, x: number, y: number, w: number, h: number, wand: number, dach: number): void {
  const tiefe = w * 0.55;
  const dh = h * 0.75;
  // Seitenwand (rechts, im Schatten) und Dachfläche darüber.
  g.poly([x + w / 2, y, x + w / 2 + tiefe, y - tiefe * 0.35, x + w / 2 + tiefe, y - h - tiefe * 0.35, x + w / 2, y - h])
    .fill({ color: shade(wand, -0.22) });
  g.poly([x, y - h - dh, x + w / 2, y - h, x + w / 2 + tiefe, y - h - tiefe * 0.35, x + tiefe, y - h - dh - tiefe * 0.35])
    .fill({ color: shade(dach, -0.12) });
  // Giebelseite vorn.
  g.poly([x - w / 2, y, x + w / 2, y, x + w / 2, y - h, x, y - h - dh, x - w / 2, y - h]).fill({ color: wand });
  g.poly([x - w / 2 - 1.5, y - h + 1, x, y - h - dh - 1, x + w / 2 + 1.5, y - h + 1, x + w / 2, y - h + 3, x, y - h - dh + 3, x - w / 2, y - h + 3])
    .fill({ color: dach });
  g.rect(x - w * 0.12, y - h * 0.55, w * 0.24, h * 0.55).fill({ color: shade(wand, -0.55) });
  if (w > 9) g.rect(x - w * 0.36, y - h * 0.8, w * 0.16, h * 0.2).fill({ color: 0xe8d9a0, alpha: 0.85 });
  const umriss = [x - w / 2, y, x + w / 2, y, x + w / 2 + tiefe, y - tiefe * 0.35, x + w / 2 + tiefe, y - h - tiefe * 0.35,
    x + tiefe, y - h - dh - tiefe * 0.35, x, y - h - dh, x - w / 2, y - h];
  g.poly(umriss).stroke({ width: 1.1, color: TINTE, alpha: 0.8 });
  g.moveTo(x + w / 2, y).lineTo(x + w / 2, y - h).lineTo(x, y - h - dh).stroke({ width: 0.9, color: TINTE, alpha: 0.55 });
}

export const worldProps: PropDef[] = [
  def('w_mountain', 'Gebirge', 'welt', { w: 150, h: 80 }, ['berg', 'gebirge', 'welt'], (g, rng) => {
    const n = rng.int(3, 5);
    const breite = 100 / n;
    for (let i = 0; i < n; i++) {
      const x = -50 + i * breite + rng.range(-4, 4);
      const h = rng.range(24, 38) * (i === Math.floor(n / 2) ? 1.25 : 1);
      const c = jitterColor(0x8a8175, rng, 0.1);
      // Zwei Flanken plus eine hellere Sonnenseite — das reicht als Signatur.
      g.poly([x - breite * 0.6, 26, x, 26 - h, x + breite * 0.6, 26]).fill({ color: c });
      g.poly([x, 26 - h, x + breite * 0.6, 26, x + breite * 0.15, 26]).fill({
        color: shade(c, 0.28),
      });
      g.poly([x - breite * 0.6, 26, x, 26 - h, x + breite * 0.6, 26]).stroke({
        width: 1.4,
        color: TINTE,
        alpha: 0.7,
      });
    }
  }),

  def('w_hills', 'Hügel', 'welt', { w: 134, h: 50 }, ['huegel', 'welt'], (g, rng) => {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = -40 + i * (80 / n) + rng.range(-5, 5);
      const r = rng.range(14, 22);
      const c = jitterColor(0x8f9464, rng, 0.12);
      g.ellipse(x, 12, r, r * 0.55).fill({ color: c });
      g.moveTo(x - r, 12)
        .quadraticCurveTo(x, 12 - r * 0.9, x + r, 12)
        .stroke({ width: 1.4, color: TINTE, alpha: 0.65 });
    }
  }),

  def('w_forest', 'Waldstück', 'welt', { w: 112, h: 86 }, ['wald', 'baum', 'welt'], (g, rng) => {
    const n = rng.int(5, 9);
    for (let i = 0; i < n; i++) {
      const x = rng.range(-45, 45);
      const y = rng.range(-20, 26);
      const h = rng.range(14, 22);
      const c = jitterColor(0x4f6b38, rng, 0.16);
      // Kegel mit kurzem Stamm: das übliche Kartenzeichen für Nadelwald.
      g.poly([x - h * 0.42, y, x, y - h, x + h * 0.42, y]).fill({ color: c });
      g.rect(x - 1.2, y, 2.4, 4).fill({ color: shade(c, -0.45) });
      g.poly([x - h * 0.42, y, x, y - h, x + h * 0.42, y]).stroke({
        width: 1,
        color: TINTE,
        alpha: 0.6,
      });
    }
  }),

  def('w_town', 'Ortschaft', 'welt', 70, ['stadt', 'dorf', 'ort', 'welt'], (g, rng) => {
    // Eine Handvoll Häuschen um einen Kirchturm, hinten kleiner und höher
    // gesetzt: so liest sich das Zeichen als Ort und nicht als ein Haus.
    bodenschatten(g, 2, 20, 30, 7);
    const wand = jitterColor(0xd8c7a0, rng, 0.06);
    const dach = jitterColor(rng.pick([0xa0503a, 0x8a4a36, 0x7a5a3a]), rng, 0.08);
    // Kirchturm hinten.
    const kx = rng.range(-6, 6);
    g.rect(kx - 3.5, -18, 7, 22).fill({ color: shade(wand, -0.05) }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.poly([kx - 5, -18, kx, -32, kx + 5, -18]).fill({ color: shade(dach, -0.2) }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.rect(kx - 1, -12, 2, 4).fill({ color: TINTE, alpha: 0.7 });
    const plaetze: Array<[number, number, number]> = [
      [-16, 6, 0.85], [14, 5, 0.85], [-22, 18, 1], [0, 19, 1.05], [21, 17, 0.95],
    ];
    // Höchstens ein Haus fehlt: mit zwei Häusern wäre es kein Ort mehr.
    const fehlt = rng.bool(0.5) ? rng.int(0, 1) : -1;
    for (const [i, [x, y, f]] of plaetze.entries()) {
      if (i === fehlt) continue;
      haeuschen(g, x + rng.range(-1.5, 1.5), y, 11 * f, 7 * f, jitterColor(wand, rng, 0.05), jitterColor(dach, rng, 0.08));
    }
  }),
  def('w_city', 'Stadt', 'welt', 96, ['stadt', 'burg', 'welt'], (g, rng) => {
    // Befestigte Stadt: Mauer in Aufsicht von schräg vorn, Türme an den
    // Ecken, dahinter Dächer und zwei Türme, die über die Mauer ragen.
    bodenschatten(g, 2, 28, 42, 9);
    const stein = jitterColor(0xb3a994, rng, 0.05);
    const dach = jitterColor(0x9a4b36, rng, 0.08);
    const wand = jitterColor(0xd8c7a0, rng, 0.05);
    // Dächer hinter der Mauer.
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 10 + rng.range(-2, 2);
      haeuschen(g, x, -2 + rng.range(-3, 2), 9, 6, wand, jitterColor(dach, rng, 0.1));
    }
    // Hohe Türme: Kathedrale und Burgfried.
    g.rect(-10, -30, 8, 26).fill({ color: shade(stein, 0.05) }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.poly([-12, -30, -6, -44, 0, -30]).fill({ color: shade(dach, -0.2) }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.rect(12, -26, 10, 22).fill({ color: stein }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    for (let i = 0; i < 3; i++) g.rect(12 + i * 3.6, -29, 2.4, 3).fill({ color: stein }).stroke({ width: 0.8, color: TINTE, alpha: 0.7 });
    // Vordere Mauer mit Zinnen und Tor.
    g.rect(-36, 8, 72, 14).fill({ color: stein });
    g.rect(-36, 8, 72, 14).stroke({ width: 1.3, color: TINTE, alpha: 0.85 });
    for (let x = -35; x < 34; x += 5) g.rect(x, 5, 3, 3).fill({ color: stein }).stroke({ width: 0.7, color: TINTE, alpha: 0.7 });
    g.moveTo(-5, 22).lineTo(-5, 15).arc(0, 15, 5, Math.PI, 0).lineTo(5, 22).closePath().fill({ color: 0x2a221a });
    // Ecktürme.
    for (const x of [-38, 38]) {
      g.rect(x - 6, 0, 12, 24).fill({ color: shade(stein, x < 0 ? 0.06 : -0.08) });
      g.poly([x - 7.5, 0, x, -12, x + 7.5, 0]).fill({ color: shade(dach, -0.1) });
      g.rect(x - 6, 0, 12, 24).stroke({ width: 1.2, color: TINTE, alpha: 0.85 });
      g.poly([x - 7.5, 0, x, -12, x + 7.5, 0]).stroke({ width: 1.1, color: TINTE, alpha: 0.85 });
      g.rect(x - 1, 8, 2, 4).fill({ color: TINTE, alpha: 0.7 });
    }
  }),
  def('w_swamp', 'Sumpf', 'welt', { w: 108, h: 60 }, ['sumpf', 'moor', 'welt'], (g, rng) => {
    // Kartenzeichen für Sumpf: waagerechte Wasserlinien, dazwischen
    // Grasbüschel aus fächerförmigen Halmen — die Büschel machen es lesbar.
    const wasser = jitterColor(0x5f7f7a, rng, 0.08);
    const gras = jitterColor(0x5c6b43, rng, 0.12);
    for (let i = 0; i < 3; i++) {
      const x = rng.range(-40, 10);
      const y = rng.range(-14, 16);
      g.ellipse(x + 14, y, rng.range(12, 20), rng.range(3, 5)).fill({ color: wasser, alpha: 0.45 });
    }
    for (let i = 0; i < 7; i++) {
      const y = -18 + i * 6 + rng.range(-1, 1);
      const x = rng.range(-44, 0);
      const len = rng.range(14, 30);
      g.moveTo(x, y).lineTo(x + len, y).stroke({ width: 1.3, color: shade(wasser, -0.25), alpha: 0.75 });
    }
    for (let i = 0; i < rng.int(5, 7); i++) {
      const x = rng.range(-40, 40);
      const y = rng.range(-12, 20);
      const n = rng.int(4, 6);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.32;
        const l = rng.range(6, 10);
        g.moveTo(x, y).lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l).stroke({ width: 1.2, color: gras, alpha: 0.95 });
      }
      g.moveTo(x - 4, y).lineTo(x + 4, y).stroke({ width: 1, color: TINTE, alpha: 0.6 });
    }
  }),
  def('w_dunes', 'Dünen', 'welt', { w: 100, h: 50 }, ['wueste', 'duene', 'sand', 'welt'], (g, rng) => {
    const c = jitterColor(0xc9ab72, rng, 0.1);
    for (let i = 0; i < rng.int(3, 5); i++) {
      const x = rng.range(-40, 20);
      const y = rng.range(-16, 16);
      const w = rng.range(22, 38);
      g.moveTo(x, y)
        .quadraticCurveTo(x + w / 2, y - 9, x + w, y)
        .stroke({ width: 2, color: shade(c, -0.3), alpha: 0.8 });
    }
  }),

  def('w_compass', 'Kompassrose', 'welt', 140, ['kompass', 'nord', 'welt'], (g, rng) => {
    void rng;
    const r = 58;
    g.circle(0, 0, r).fill({ color: PERGAMENT, alpha: 0.25 });
    g.circle(0, 0, r).stroke({ width: 2, color: TINTE, alpha: 0.85 });
    g.circle(0, 0, r * 0.72).stroke({ width: 1, color: TINTE, alpha: 0.5 });

    // Vier lange Hauptstrahlen, vier kurze dazwischen — je zweifarbig, damit
    // die Rose auch klein noch als Rose zu erkennen ist.
    const strahl = (winkel: number, laenge: number, breite: number) => {
      const sx = Math.cos(winkel);
      const sy = Math.sin(winkel);
      const px = -sy * breite;
      const py = sx * breite;
      g.poly([sx * laenge, sy * laenge, px, py, 0, 0]).fill({ color: TINTE });
      g.poly([sx * laenge, sy * laenge, -px, -py, 0, 0]).fill({ color: shade(TINTE, 0.55) });
    };
    for (let i = 0; i < 4; i++) strahl((i / 4) * Math.PI * 2 - Math.PI / 2, r * 0.92, 7);
    for (let i = 0; i < 4; i++) strahl((i / 4) * Math.PI * 2 - Math.PI / 4, r * 0.55, 4.5);

    // Nordspitze hervorheben.
    g.poly([0, -r * 0.92, -6, -r * 0.62, 6, -r * 0.62]).fill({ color: 0x8c3b2a });
  }),

  def('w_scalebar', 'Maßstabsleiste', 'welt', { w: 160, h: 40 }, ['massstab', 'skala', 'welt'], (g, rng) => {
    void rng;
    const w = 140;
    const h = 12;
    const felder = 4;
    for (let i = 0; i < felder; i++) {
      g.rect(-w / 2 + (i * w) / felder, -h / 2, w / felder, h).fill({
        color: i % 2 === 0 ? TINTE : PERGAMENT,
      });
    }
    g.rect(-w / 2, -h / 2, w, h).stroke({ width: 1.5, color: TINTE });
    // Teilstriche nach unten, damit klar ist, wo gemessen wird.
    for (let i = 0; i <= felder; i++) {
      const x = -w / 2 + (i * w) / felder;
      g.moveTo(x, h / 2).lineTo(x, h / 2 + 5).stroke({ width: 1.5, color: TINTE });
    }
  }),

  // -------------------------------------------------------------------------
  // Gelände
  // -------------------------------------------------------------------------

  def('w_volcano', 'Vulkan', 'welt', { w: 120, h: 90 }, ['vulkan', 'berg', 'welt'], (g, rng) => {
    const c = jitterColor(0x6b5f57, rng, 0.1);
    const h = rng.range(46, 58);
    // Abgeschnittener Kegel: der Krater oben ist das, was ihn vom Berg trennt.
    const kraterHalb = rng.range(9, 13);
    g.poly([-42, 34, -kraterHalb, 34 - h, kraterHalb, 34 - h, 42, 34]).fill({ color: c });
    g.poly([0, 34 - h, kraterHalb, 34 - h, 42, 34, 10, 34]).fill({ color: shade(c, 0.26) });
    g.poly([-42, 34, -kraterHalb, 34 - h, kraterHalb, 34 - h, 42, 34]).stroke({
      width: 1.6,
      color: TINTE,
      alpha: 0.75,
    });
    g.ellipse(0, 34 - h, kraterHalb, kraterHalb * 0.4).fill({ color: 0x8c3b2a });
    // Lavazungen über die Flanke.
    for (let i = 0; i < rng.int(1, 3); i++) {
      const richtung = rng.range(-1, 1);
      g.moveTo(richtung * kraterHalb * 0.6, 34 - h)
        .quadraticCurveTo(richtung * 26, 34 - h * 0.4, richtung * 34, 32)
        .stroke({ width: rng.range(2.4, 4), color: 0xd06a2e, alpha: 0.9 });
    }
  }),

  def('w_glacier', 'Gletscher', 'welt', { w: 126, h: 70 }, ['eis', 'gletscher', 'schnee', 'welt'], (g, rng) => {
    const c = jitterColor(0xbcd4e0, rng, 0.08);
    for (let i = 0; i < rng.int(3, 5); i++) {
      const x = -40 + i * 22 + rng.range(-4, 4);
      const h = rng.range(22, 34);
      // Spitze Zacken statt runder Kuppen — Eis bricht kantig.
      g.poly([x - 12, 26, x, 26 - h, x + 12, 26]).fill({ color: c });
      g.poly([x, 26 - h, x + 12, 26, x + 3, 26]).fill({ color: shade(c, -0.22) });
      g.poly([x - 12, 26, x, 26 - h, x + 12, 26]).stroke({
        width: 1.3,
        color: 0x4a6b7c,
        alpha: 0.75,
      });
    }
  }),

  def('w_lake', 'See', 'welt', { w: 110, h: 80 }, ['see', 'wasser', 'welt'], (g, rng) => {
    const c = jitterColor(0x5b86a3, rng, 0.1);
    const pts: number[] = [];
    const n = 20;
    const p1 = rng.range(0, Math.PI * 2);
    const p2 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 40 * (1 + 0.22 * Math.sin(2 * a + p1) + 0.12 * Math.sin(3 * a + p2));
      pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.68);
    }
    g.poly(pts).fill({ color: c });
    g.poly(pts).stroke({ width: 1.8, color: TINTE, alpha: 0.75 });
    // Zwei Wellenlinien: das Kartenzeichen für offenes Wasser.
    for (let i = 0; i < 2; i++) {
      const y = -6 + i * 12;
      g.moveTo(-18, y)
        .quadraticCurveTo(-9, y - 3, 0, y)
        .quadraticCurveTo(9, y + 3, 18, y)
        .stroke({ width: 1.4, color: shade(c, -0.35), alpha: 0.8 });
    }
  }),

  def('w_waterfall', 'Wasserfall', 'welt', { w: 80, h: 90 }, ['wasserfall', 'fluss', 'welt'], (g, rng) => {
    const wasser = jitterColor(0x6f9ab5, rng, 0.06);
    const fels = 0x6b6158;

    // Der Fall ist eine *Fläche*, kein Bündel Striche: einzelne Linien lasen
    // sich im Kartenmaßstab als Tischbeine, nicht als Wasser.
    const halb = rng.range(13, 17);
    g.moveTo(-halb, -20)
      .lineTo(halb, -20)
      .lineTo(halb * 1.25, 20)
      .lineTo(-halb * 1.25, 20)
      .closePath()
      .fill({ color: wasser });
    // Senkrechte Schlieren geben dem Fall Bewegung.
    for (let i = 0; i < rng.int(3, 5); i++) {
      const t = rng.range(-0.75, 0.75);
      g.moveTo(halb * t, -18)
        .lineTo(halb * 1.25 * t, 18)
        .stroke({ width: 1.4, color: shade(wasser, 0.4), alpha: 0.6 });
    }

    // Felskante darüber, mit einer Lippe, über die das Wasser tritt.
    g.poly([-34, -34, 34, -34, 30, -20, -30, -20]).fill({ color: fels });
    g.poly([-34, -34, 34, -34, 30, -20, -30, -20]).stroke({
      width: 1.5,
      color: TINTE,
      alpha: 0.8,
    });
    g.moveTo(-halb, -21).quadraticCurveTo(0, -26, halb, -21).stroke({
      width: 2.6,
      color: shade(wasser, 0.5),
      alpha: 0.9,
    });

    // Gischtbecken unten: Ellipse plus ein paar Blasen.
    g.ellipse(0, 24, halb * 1.8, 8).fill({ color: shade(wasser, 0.3), alpha: 0.85 });
    g.ellipse(0, 24, halb * 1.8, 8).stroke({ width: 1.3, color: TINTE, alpha: 0.6 });
    for (let i = 0; i < rng.int(4, 7); i++) {
      g.circle(rng.range(-halb * 1.7, halb * 1.7), rng.range(19, 29), rng.range(2, 4)).fill({
        color: shade(wasser, 0.55),
        alpha: 0.8,
      });
    }
  }),

  def('w_oasis', 'Oase', 'welt', { w: 104, h: 70 }, ['oase', 'wueste', 'palme', 'welt'], (g, rng) => {
    g.ellipse(0, 12, 24, 12).fill({ color: 0x5b86a3 });
    g.ellipse(0, 12, 24, 12).stroke({ width: 1.5, color: TINTE, alpha: 0.7 });
    for (let i = 0; i < rng.int(2, 4); i++) {
      const x = rng.range(-30, 30);
      const h = rng.range(20, 30);
      g.moveTo(x, 12).quadraticCurveTo(x + rng.range(-5, 5), 12 - h * 0.6, x + rng.range(-8, 8), 12 - h)
        .stroke({ width: 2, color: 0x6d5533 });
      // Palmwedel als kurze Bögen vom Wipfel weg.
      const wx = x + rng.range(-8, 8);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI + (k / 4) * Math.PI;
        g.moveTo(wx, 12 - h)
          .quadraticCurveTo(wx + Math.cos(a) * 8, 12 - h + Math.sin(a) * 5 - 4, wx + Math.cos(a) * 14, 12 - h + 4)
          .stroke({ width: 1.6, color: 0x4f7a3a, alpha: 0.95 });
      }
    }
  }),

  def('w_deadwood', 'Totenwald', 'welt', { w: 120, h: 110 }, ['wald', 'tot', 'sumpf', 'welt'], (g, rng) => {
    // Dicht und dunkel: einzelne dünne Striche verschwinden im Kartenmaßstab,
    // und ein Totenwald soll als Fläche lesbar sein wie das Waldstück auch.
    const stamm = 0x453a2e;
    for (let i = 0; i < rng.int(9, 13); i++) {
      const x = rng.range(-44, 44);
      const y = rng.range(-14, 26);
      const h = rng.range(20, 32);
      g.moveTo(x, y).lineTo(x + rng.range(-2, 2), y - h).stroke({
        width: 2.6,
        color: stamm,
        alpha: 0.95,
      });
      // Kahle Äste — ohne Krone, das ist der ganze Unterschied zum Waldstück.
      for (let k = 0; k < rng.int(3, 5); k++) {
        const yy = y - h * rng.range(0.4, 1);
        const dir = rng.next() < 0.5 ? -1 : 1;
        const ex = x + dir * rng.range(5, 10);
        const ey = yy - rng.range(4, 9);
        g.moveTo(x, yy).lineTo(ex, ey).stroke({ width: 1.8, color: stamm, alpha: 0.9 });
        // Ein zweiter, kürzerer Zweig am Ende macht die Silhouette knorrig.
        if (rng.next() < 0.5) {
          g.moveTo(ex, ey).lineTo(ex + dir * rng.range(2, 5), ey - rng.range(2, 5)).stroke({
            width: 1.2,
            color: stamm,
            alpha: 0.8,
          });
        }
      }
    }
  }),

  // -------------------------------------------------------------------------
  // Orte und Bauwerke
  // -------------------------------------------------------------------------

  def('w_castle', 'Burg', 'welt', 80, ['burg', 'festung', 'welt'], (g, rng) => {
    const c = jitterColor(0x7d7468, rng, 0.1);
    // Bergfried in der Mitte, zwei Flankentürme, Zinnen obenauf.
    const turm = (x: number, breite: number, hoehe: number) => {
      g.rect(x - breite / 2, 16 - hoehe, breite, hoehe).fill({ color: c });
      g.rect(x - breite / 2, 16 - hoehe, breite, hoehe).stroke({ width: 1.2, color: TINTE, alpha: 0.8 });
      const zinnen = Math.max(2, Math.round(breite / 5));
      for (let i = 0; i < zinnen; i++) {
        const zx = x - breite / 2 + (i * breite) / zinnen;
        g.rect(zx, 16 - hoehe - 4, breite / zinnen / 2, 4).fill({ color: shade(c, -0.2) });
      }
    };
    turm(-16, 12, rng.range(18, 24));
    turm(16, 12, rng.range(18, 24));
    turm(0, 18, rng.range(28, 36));
    g.rect(-22, 4, 44, 12).fill({ color: shade(c, -0.12) });
    g.rect(-22, 4, 44, 12).stroke({ width: 1.2, color: TINTE, alpha: 0.8 });
  }),

  def('w_tower', 'Turm', 'welt', { w: 50, h: 80 }, ['turm', 'wachturm', 'welt'], (g, rng) => {
    const c = jitterColor(0x7d7468, rng, 0.1);
    const h = rng.range(38, 50);
    g.rect(-9, 30 - h, 18, h).fill({ color: c });
    g.rect(2, 30 - h, 7, h).fill({ color: shade(c, 0.22) });
    g.rect(-9, 30 - h, 18, h).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    // Spitzdach: unterscheidet den Turm vom Kamin.
    g.poly([-12, 30 - h, 0, 30 - h - 14, 12, 30 - h]).fill({ color: 0x6d4630 });
    g.poly([-12, 30 - h, 0, 30 - h - 14, 12, 30 - h]).stroke({ width: 1.2, color: TINTE, alpha: 0.8 });
  }),

  def('w_ruin', 'Ruine', 'welt', { w: 88, h: 64 }, ['ruine', 'verfallen', 'welt'], (g, rng) => {
    // Ein halber Torbogen und abgebrochene Mauern mit ausgefranster Krone:
    // am Bogen erkennt man ein Bauwerk, an der Krone den Verfall.
    bodenschatten(g, 0, 22, 36, 6);
    const c = jitterColor(0xa9a08f, rng, 0.08);
    const krone = (x: number, w: number, h: number) => {
      const pts = [x, 22, x + w, 22];
      const n = 5;
      for (let i = n; i >= 0; i--) pts.push(x + (w * i) / n, 22 - h + rng.range(-5, 3) * (i % 2 ? 1 : 0.4));
      g.poly(pts).fill({ color: c });
      g.poly(pts).stroke({ width: 1.1, color: TINTE, alpha: 0.8 });
      for (let k = 1; k < 3; k++) g.moveTo(x, 22 - (h * k) / 3).lineTo(x + w, 22 - (h * k) / 3).stroke({ width: 0.8, color: TINTE, alpha: 0.35 });
    };
    krone(-34, 12, rng.range(10, 16));
    // Bogen: linker Pfeiler ganz, rechter abgebrochen.
    g.rect(-16, -6, 6, 28).fill({ color: c }).stroke({ width: 1.1, color: TINTE, alpha: 0.8 });
    g.moveTo(-10, -6).arc(0, -6, 10, Math.PI, -Math.PI * 0.35).stroke({ width: 5, color: c });
    g.moveTo(-10, -6).arc(0, -6, 10, Math.PI, -Math.PI * 0.35).stroke({ width: 1, color: TINTE, alpha: 0.75 });
    g.rect(10, 8, 6, 14).fill({ color: c }).stroke({ width: 1.1, color: TINTE, alpha: 0.8 });
    krone(22, 14, rng.range(8, 14));
    for (let i = 0; i < 6; i++) {
      g.poly([0, 0, 3, -1, 4, 2, 1, 3].map((v, k) => v * rng.range(0.8, 1.4) + (k % 2 ? rng.range(18, 24) : rng.range(-30, 34))))
        .fill({ color: shade(c, -0.15) }).stroke({ width: 0.7, color: TINTE, alpha: 0.6 });
    }
  }),
  def('w_temple', 'Tempel', 'welt', { w: 80, h: 60 }, ['tempel', 'heiligtum', 'welt'], (g, rng) => {
    const c = jitterColor(0xd0c7b4, rng, 0.08);
    // Säulen und Giebel: das Zeichen für einen geweihten Ort.
    for (let i = 0; i < 4; i++) {
      const x = -21 + i * 14;
      g.rect(x - 3, -2, 6, 20).fill({ color: c });
      g.rect(x - 3, -2, 6, 20).stroke({ width: 1, color: TINTE, alpha: 0.7 });
    }
    g.rect(-28, -8, 56, 6).fill({ color: shade(c, -0.15) });
    g.poly([-30, -8, 0, -26, 30, -8]).fill({ color: c });
    g.poly([-30, -8, 0, -26, 30, -8]).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    g.rect(-32, 18, 64, 5).fill({ color: shade(c, -0.2) });
  }),

  def('w_mine', 'Bergwerk', 'welt', { w: 70, h: 60 }, ['mine', 'bergwerk', 'stollen', 'welt'], (g, rng) => {
    const c = jitterColor(0x6b5f57, rng, 0.1);
    g.poly([-30, 22, -16, -12, 16, -12, 30, 22]).fill({ color: c });
    g.poly([-30, 22, -16, -12, 16, -12, 30, 22]).stroke({ width: 1.4, color: TINTE, alpha: 0.75 });
    // Stollenmund als dunkler Bogen, mit Holzrahmen.
    g.moveTo(-11, 22).lineTo(-11, 6).arc(0, 6, 11, Math.PI, 0).lineTo(11, 22).closePath()
      .fill({ color: 0x241d17 });
    g.moveTo(-13, 22).lineTo(-13, 5).lineTo(13, 5).lineTo(13, 22).stroke({
      width: 2.4,
      color: 0x6d5533,
      alpha: 0.95,
    });
    void rng;
  }),

  def('w_farm', 'Felder', 'welt', { w: 140, h: 76 }, ['feld', 'acker', 'bauernhof', 'welt'], (g, rng) => {
    // Flickenteppich aus Feldern in Schrägaufsicht, dazwischen ein Hof.
    const farben = [0xb8a04f, 0x9aa55a, 0xc4ae62, 0x8a9a4e, 0xa98d4a];
    const felder: Array<[number, number, number, number]> = [];
    for (let r = 0; r < 2; r++) {
      let x = -60 + r * 8;
      while (x < 36) {
        const w = Math.min(rng.range(20, 30), 58 - x);
        felder.push([x, -12 + r * 16, w, 15]);
        x += w + 1.5;
      }
    }
    for (const [x, y, w, h] of felder) {
      const c = jitterColor(rng.pick(farben), rng, 0.06);
      // Parallelogramm statt Rechteck: die Karte ist leicht von schräg gesehen.
      const pts = [x, y + h, x + w, y + h, x + w + 5, y, x + 5, y];
      g.poly(pts).fill({ color: c });
      const n = 4;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        g.moveTo(x + 5 * (1 - t), y + h * t).lineTo(x + w + 5 * (1 - t), y + h * t).stroke({ width: 0.8, color: shade(c, -0.35), alpha: 0.7 });
      }
      g.poly(pts).stroke({ width: 0.9, color: TINTE, alpha: 0.55 });
    }
    // Hecken am Rand und der Hof.
    for (let i = 0; i < 8; i++) g.circle(-58 + i * 16 + rng.range(-3, 3), 22 + rng.range(-1, 1), 3).fill({ color: 0x4f6b38 }).stroke({ width: 0.7, color: TINTE, alpha: 0.5 });
    const hx = rng.range(-20, 20);
    bodenschatten(g, hx + 4, 21, 14, 4);
    haeuschen(g, hx, 20, 12, 8, 0xd8c7a0, jitterColor(0xb89a5a, rng, 0.08));
  }),
  def('w_bridge', 'Brücke', 'welt', { w: 90, h: 50 }, ['bruecke', 'fluss', 'welt'], (g, rng) => {
    void rng;
    const c = 0x8b8378;
    g.moveTo(-34, 10).quadraticCurveTo(0, -18, 34, 10).stroke({ width: 5, color: c });
    g.moveTo(-34, 10).quadraticCurveTo(0, -18, 34, 10).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    // Zwei Bögen darunter: sonst wäre es nur ein Strich über dem Fluss.
    for (const x of [-16, 16]) {
      g.moveTo(x - 10, 12).arc(x, 12, 10, Math.PI, 0).stroke({ width: 1.6, color: TINTE, alpha: 0.7 });
    }
    g.rect(-40, 12, 80, 4).fill({ color: shade(c, -0.35), alpha: 0.6 });
  }),

  def('w_camp', 'Lager', 'welt', { w: 74, h: 55 }, ['lager', 'zelt', 'welt'], (g, rng) => {
    for (let i = 0; i < rng.int(2, 4); i++) {
      const x = rng.range(-24, 24);
      const y = rng.range(-6, 12);
      const c = jitterColor(0xc4b393, rng, 0.12);
      g.poly([x - 11, y + 8, x, y - 12, x + 11, y + 8]).fill({ color: c });
      g.poly([x, y - 12, x + 11, y + 8, x + 3, y + 8]).fill({ color: shade(c, -0.22) });
      g.poly([x - 11, y + 8, x, y - 12, x + 11, y + 8]).stroke({ width: 1.2, color: TINTE, alpha: 0.75 });
    }
    // Feuerstelle in der Mitte.
    g.circle(0, 16, 4).fill({ color: 0xd07a2e });
    g.circle(0, 16, 6).stroke({ width: 1.2, color: TINTE, alpha: 0.6 });
  }),

  def('w_cave', 'Höhleneingang', 'welt', { w: 68, h: 56 }, ['hoehle', 'eingang', 'welt'], (g, rng) => {
    const c = jitterColor(0x7a7168, rng, 0.1);
    g.poly(blobUmriss(rng, 26, 0.2)).fill({ color: c });
    g.poly(blobUmriss(rng, 26, 0.2)).stroke({ width: 1.5, color: TINTE, alpha: 0.75 });
    // Der Eingang ist ein schwarzer Halbmond am unteren Rand.
    g.moveTo(-13, 16).arc(0, 16, 13, Math.PI, 0).closePath().fill({ color: 0x1d1813 });
  }),

  def('w_standingstones', 'Steinkreis', 'welt', 76, ['steinkreis', 'kult', 'welt'], (g, rng) => {
    // Kreis in Schrägaufsicht: hintere Steine zuerst, kleiner; jeder Stein
    // mit Sonnen- und Schattenseite und einem Deckstein über zwei Trägern.
    bodenschatten(g, 0, 8, 34, 14);
    g.ellipse(0, 6, 26, 11).fill({ color: 0x8a9460, alpha: 0.35 });
    const n = rng.int(7, 9);
    const steine: Array<[number, number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
      steine.push([Math.cos(a) * 26, 6 + Math.sin(a) * 11, a]);
    }
    steine.sort((p, q) => p[1] - q[1]);
    for (const [x, y] of steine) {
      const f = 0.8 + ((y + 5) / 22) * 0.3;
      const h = rng.range(13, 18) * f;
      const w = 5.5 * f;
      const c = jitterColor(0x9a9488, rng, 0.08);
      const pts = [x - w / 2, y, x + w / 2, y, x + w / 2 - 0.8, y - h, x - w / 2 + 0.6, y - h + rng.range(-1, 1)];
      g.poly(pts).fill({ color: c });
      g.poly([x + 0.2, y, x + w / 2, y, x + w / 2 - 0.8, y - h, x + 0.2, y - h]).fill({ color: shade(c, -0.2) });
      g.poly(pts).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    }
    // Deckstein in der Mitte über zwei Trägern.
    const c = jitterColor(0x9a9488, rng, 0.08);
    for (const x of [-6, 6]) g.rect(x - 2.5, -8, 5, 16).fill({ color: c }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.rect(-10, -12, 20, 5).fill({ color: shade(c, 0.1) }).stroke({ width: 1, color: TINTE, alpha: 0.8 });
  }),
  def('w_barrow', 'Grabhügel', 'welt', { w: 70, h: 50 }, ['grab', 'huegel', 'welt'], (g, rng) => {
    const c = jitterColor(0x7d8a58, rng, 0.12);
    // Kuppe von der Seite, nicht von oben: sonst säße der Eingang mitten auf
    // dem Hügel statt an seinem Fuß, und das läse sich als Loch.
    const fuss = 16;
    g.moveTo(-30, fuss).quadraticCurveTo(0, -24, 30, fuss).closePath().fill({ color: c });
    g.moveTo(0, -18).quadraticCurveTo(20, -8, 30, fuss).lineTo(6, fuss).closePath().fill({
      color: shade(c, 0.18),
    });
    g.moveTo(-30, fuss).quadraticCurveTo(0, -24, 30, fuss).closePath().stroke({
      width: 1.6,
      color: TINTE,
      alpha: 0.8,
    });
    // Der freigelegte Gang am Fuß macht aus dem Hügel ein Grab.
    g.moveTo(-7, fuss).lineTo(-7, fuss - 8).arc(0, fuss - 8, 7, Math.PI, 0).lineTo(7, fuss)
      .closePath().fill({ color: 0x1d1813 });
    // Türsturz und zwei Pfosten: der Steinrahmen des Ganges.
    g.rect(-10, fuss - 12, 20, 3.5).fill({ color: 0x8b8378 });
    g.rect(-10, fuss - 12, 20, 3.5).stroke({ width: 1, color: TINTE, alpha: 0.8 });
    g.rect(-9.5, fuss - 9, 3, 9).fill({ color: 0x8b8378 });
    g.rect(6.5, fuss - 9, 3, 9).fill({ color: 0x8b8378 });
  }),

  def('w_battlefield', 'Schlachtfeld', 'welt', { w: 80, h: 60 }, ['schlacht', 'kampf', 'welt'], (g, rng) => {
    // Gekreuzte Klingen — das übliche Zeichen für eine geschlagene Schlacht.
    const klinge = (winkel: number) => {
      const sx = Math.cos(winkel);
      const sy = Math.sin(winkel);
      g.moveTo(-sx * 26, -sy * 26).lineTo(sx * 26, sy * 26).stroke({ width: 4, color: 0x9aa0a6 });
      g.moveTo(-sx * 26, -sy * 26).lineTo(sx * 26, sy * 26).stroke({ width: 1, color: TINTE, alpha: 0.8 });
      // Parierstange quer zur Klinge, nahe dem Griff.
      g.moveTo(-sx * 14 - sy * 7, -sy * 14 + sx * 7)
        .lineTo(-sx * 14 + sy * 7, -sy * 14 - sx * 7)
        .stroke({ width: 3, color: 0x6d5533 });
    };
    klinge(Math.PI / 4);
    klinge(-Math.PI / 4);
    void rng;
  }),

  // -------------------------------------------------------------------------
  // Meer
  // -------------------------------------------------------------------------

  def('w_ship', 'Segelschiff', 'welt', { w: 80, h: 72 }, ['schiff', 'meer', 'welt'], (g, rng) => {
    const rumpf = 0x6d5533;
    g.moveTo(-28, 10).quadraticCurveTo(0, 26, 28, 10).lineTo(24, 4).lineTo(-24, 4).closePath()
      .fill({ color: rumpf });
    g.moveTo(-28, 10).quadraticCurveTo(0, 26, 28, 10).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    g.moveTo(0, 4).lineTo(0, -34).stroke({ width: 2.4, color: rumpf });
    /**
     * Rahsegel: oben an der Rah gerade gespannt, unten vom Wind ausgebaucht.
     * Nur an den Mast gehängt sähe es aus wie eine Flagge, und eine Kontur mit
     * zwei Bögen bekommt an der Nahtstelle eine Kerbe.
     */
    const segel = (oben: number, hoehe: number, rah: number, bauch: number) => {
      const unten = oben + hoehe;
      g.moveTo(-rah, oben)
        .lineTo(rah, oben)
        .lineTo(rah * 0.92, unten)
        .quadraticCurveTo(0, unten + bauch, -rah * 0.92, unten)
        .closePath()
        .fill({ color: 0xe4dac4 });
      g.moveTo(-rah, oben)
        .lineTo(rah, oben)
        .lineTo(rah * 0.92, unten)
        .quadraticCurveTo(0, unten + bauch, -rah * 0.92, unten)
        .closePath()
        .stroke({ width: 1.2, color: TINTE, alpha: 0.8 });
      // Rah als Balken, der beidseitig über das Segel hinaussteht.
      g.moveTo(-rah - 3, oben).lineTo(rah + 3, oben).stroke({ width: 2, color: rumpf });
    };
    segel(-31, 12, rng.range(11, 14), rng.range(3, 6));
    segel(-14, 13, rng.range(15, 18), rng.range(4, 7));
  }),

  def('w_seamonster', 'Seeungeheuer', 'welt', { w: 130, h: 70 }, ['ungeheuer', 'meer', 'welt'], (g, rng) => {
    const c = jitterColor(0x4f6b6b, rng, 0.12);
    // Kopf, dann Buckel, die aus dem Wasser tauchen — dazwischen ist Meer,
    // darum keine durchgehende Linie.
    g.moveTo(-44, 14).quadraticCurveTo(-40, -12, -26, -10).quadraticCurveTo(-18, -8, -20, 14)
      .closePath().fill({ color: c });
    g.circle(-34, -2, 2.2).fill({ color: 0xf0e6d0 });
    // Aufgerissenes Maul.
    g.moveTo(-44, 6).lineTo(-52, 10).lineTo(-44, 12).closePath().fill({ color: 0x8c3b2a });

    let x = -8;
    for (let i = 0; i < rng.int(3, 5); i++) {
      const w = rng.range(9, 13);
      const h = rng.range(8, 15);
      g.moveTo(x, 14).quadraticCurveTo(x + w / 2, 14 - h * 2, x + w, 14).closePath().fill({ color: c });
      g.moveTo(x, 14).quadraticCurveTo(x + w / 2, 14 - h * 2, x + w, 14)
        .stroke({ width: 1.2, color: TINTE, alpha: 0.7 });
      x += w + rng.range(2, 5);
    }
    // Wasserlinie, damit die Buckel auf etwas sitzen.
    g.moveTo(-52, 15).lineTo(52, 15).stroke({ width: 1.4, color: 0x5b86a3, alpha: 0.8 });
  }),

  def('w_whirlpool', 'Strudel', 'welt', 70, ['strudel', 'meer', 'welt'], (g, rng) => {
    const c = jitterColor(0x4a6f88, rng, 0.1);
    // Archimedische Spirale: gleichmäßiger Abstand, das liest sich als Sog.
    const drehung = rng.next() < 0.5 ? 1 : -1;
    for (let arm = 0; arm < 2; arm++) {
      const phase = arm * Math.PI;
      g.moveTo(0, 0);
      for (let i = 1; i <= 90; i++) {
        const t = (i / 90) * Math.PI * 3.2;
        const r = t * 3.1;
        g.lineTo(Math.cos(t * drehung + phase) * r, Math.sin(t * drehung + phase) * r * 0.75);
      }
      g.stroke({ width: 2.2, color: c, alpha: 0.9 });
    }
    g.ellipse(0, 0, 32, 24).stroke({ width: 1.2, color: c, alpha: 0.45 });
  }),

  def('w_lighthouse', 'Leuchtturm', 'welt', { w: 52, h: 85 }, ['leuchtturm', 'kueste', 'welt'], (g, rng) => {
    void rng;
    const h = 52;
    g.poly([-11, 32, -7, 32 - h, 7, 32 - h, 11, 32]).fill({ color: 0xe0d6c4 });
    // Rote Ringe: ohne sie wäre es nur ein weißer Turm.
    for (let i = 0; i < 3; i++) {
      const y = 32 - (h * (i + 0.5)) / 3;
      const breite = 7 + (4 * (32 - y)) / h;
      g.rect(-breite, y, breite * 2, 6).fill({ color: 0x9c4b3c, alpha: 0.9 });
    }
    g.poly([-11, 32, -7, 32 - h, 7, 32 - h, 11, 32]).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    g.rect(-8, 32 - h - 10, 16, 10).fill({ color: 0xf0c65a });
    g.rect(-8, 32 - h - 10, 16, 10).stroke({ width: 1.2, color: TINTE, alpha: 0.8 });
    g.poly([-10, 32 - h - 10, 0, 32 - h - 19, 10, 32 - h - 10]).fill({ color: 0x5a5048 });
    // Lichtkegel nach beiden Seiten.
    for (const dir of [-1, 1]) {
      g.poly([dir * 8, 32 - h - 5, dir * 26, 32 - h - 14, dir * 26, 32 - h + 4]).fill({
        color: 0xf0c65a,
        alpha: 0.28,
      });
    }
  }),

  def('w_harbour', 'Hafen', 'welt', { w: 90, h: 60 }, ['hafen', 'anleger', 'welt'], (g, rng) => {
    // Mole als Winkel ins Wasser. Allein wäre das nur ein grauer Haken —
    // erst das Boot im Windschatten macht daraus einen Hafen.
    g.moveTo(-34, -16).lineTo(6, -16).lineTo(6, 14).stroke({ width: 8, color: 0x8b8378 });
    g.moveTo(-34, -16).lineTo(6, -16).lineTo(6, 14).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    for (let i = 0; i < 3; i++) {
      g.circle(-26 + i * 14, -22, 2.4).fill({ color: 0x5a5048 });
    }

    const bx = rng.range(-18, -6);
    const by = rng.range(0, 8);
    g.moveTo(bx - 12, by).quadraticCurveTo(bx, by + 9, bx + 12, by).lineTo(bx + 9, by - 3)
      .lineTo(bx - 9, by - 3).closePath().fill({ color: 0x6d5533 });
    g.moveTo(bx, by - 3).lineTo(bx, by - 18).stroke({ width: 1.8, color: 0x6d5533 });
    g.poly([bx, by - 18, bx + 9, by - 10, bx, by - 6]).fill({ color: 0xe4dac4 });
    g.poly([bx, by - 18, bx + 9, by - 10, bx, by - 6]).stroke({
      width: 1,
      color: TINTE,
      alpha: 0.75,
    });

    g.moveTo(-40, 22).quadraticCurveTo(-20, 18, 0, 22).quadraticCurveTo(20, 26, 40, 22)
      .stroke({ width: 1.4, color: 0x5b86a3, alpha: 0.85 });
  }),

  // -------------------------------------------------------------------------
  // Kartenwerk
  // -------------------------------------------------------------------------

  def('w_windrose', 'Windrose schlicht', 'welt', 90, ['kompass', 'nord', 'windrose', 'welt'], (g, rng) => {
    void rng;
    const r = 38;
    // Nur vier Strahlen und ein Ring — für Karten, auf denen die große Rose
    // zu viel Platz nimmt.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const sx = Math.cos(a);
      const sy = Math.sin(a);
      g.poly([sx * r, sy * r, -sy * 5, sx * 5, sy * 5, -sx * 5]).fill({
        color: i === 0 ? 0x8c3b2a : TINTE,
      });
    }
    g.circle(0, 0, r * 0.3).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
  }),

  def('w_cartouche', 'Schriftband', 'welt', { w: 170, h: 60 }, ['band', 'titel', 'beschriftung', 'welt'], (g, rng) => {
    void rng;
    // Banderole zum Beschriften: der Text kommt als eigenes Textobjekt darüber.
    const w = 62;
    const h = 15;
    g.moveTo(-w, -h)
      .quadraticCurveTo(0, -h - 6, w, -h)
      .lineTo(w, h)
      .quadraticCurveTo(0, h + 6, -w, h)
      .closePath()
      .fill({ color: PERGAMENT });
    g.moveTo(-w, -h)
      .quadraticCurveTo(0, -h - 6, w, -h)
      .lineTo(w, h)
      .quadraticCurveTo(0, h + 6, -w, h)
      .closePath()
      .stroke({ width: 1.8, color: TINTE, alpha: 0.85 });
    // Eingeschlagene Enden links und rechts.
    for (const dir of [-1, 1]) {
      g.poly([dir * w, -h, dir * (w + 16), -h - 7, dir * (w + 16), h + 7, dir * w, h]).fill({
        color: shade(PERGAMENT, -0.18),
      });
      g.poly([dir * w, -h, dir * (w + 16), -h - 7, dir * (w + 16), h + 7, dir * w, h]).stroke({
        width: 1.5,
        color: TINTE,
        alpha: 0.85,
      });
      g.poly([dir * (w + 16), -h - 7, dir * (w + 8), 0, dir * (w + 16), h + 7]).fill({
        color: shade(PERGAMENT, -0.35),
      });
    }
  }),

  def('w_borderstone', 'Grenzstein', 'welt', { w: 40, h: 55 }, ['grenze', 'stein', 'welt'], (g, rng) => {
    const c = jitterColor(0x8b8378, rng, 0.1);
    g.poly([-8, 22, -6, -10, 0, -18, 6, -10, 8, 22]).fill({ color: c });
    g.poly([0, -18, 6, -10, 8, 22, 2, 22]).fill({ color: shade(c, 0.22) });
    g.poly([-8, 22, -6, -10, 0, -18, 6, -10, 8, 22]).stroke({ width: 1.4, color: TINTE, alpha: 0.8 });
    // Eingeritzte Marke.
    g.moveTo(-3, 0).lineTo(3, 0).moveTo(0, -3).lineTo(0, 6).stroke({
      width: 1.4,
      color: TINTE,
      alpha: 0.65,
    });
  }),
];
