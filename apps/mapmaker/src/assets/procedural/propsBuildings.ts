/**
 * Fertige Gebäude von oben (Rückmeldung 2B).
 *
 * Auf einer Battlemap sieht man ein Haus, das man nicht betritt, von oben:
 * als Dach. Darum sind das hier Dachaufsichten — Satteldach, Walmdach,
 * Kegeldach — mit Traufe, First, Ziegelreihen und Schatten, nicht Grundrisse
 * mit Möbeln. Für betretbare Häuser gibt es den Raum-Generator.
 *
 * Jede Gebäudeart hat drei Bauformen, gewählt über den Variantenindex
 * (`variant % 3`); die zweite Hälfte der Varianten wiederholt die Formen mit
 * anderer Dachdeckung. So kommt jede Form sicher vor, und der Inspektor kann
 * gezielt zwischen ihnen wechseln.
 *
 * Maße in Pixeln bei 100 px je Feld: ein Wohnhaus ist gut 4 × 3 Felder groß.
 */

import type { Graphics } from 'pixi.js';
import type { Rng } from '@/model/rng';
import type { PropDef } from '../propTypes';
import { def } from './defineProp';
import { jitterColor, shade, PALETTE } from './draw';

// ---------------------------------------------------------------------------
// Dachdeckungen
// ---------------------------------------------------------------------------

type Deckung = 'ziegel' | 'schiefer' | 'stroh' | 'schindel';

const DECKFARBE: Record<Deckung, number[]> = {
  ziegel: [0x9a4b36, 0xa85a3c, 0x8c4232],
  schiefer: [0x566070, 0x4f5866, 0x606a78],
  stroh: [0xb89a5a, 0xa98c4f, 0xc2a566],
  schindel: [0x7a5a3a, 0x6d5134, 0x85633f],
};

/** Deckung für eine Variante: erste Hälfte warm, zweite Hälfte anders. */
function deckungFuer(variant: number, erste: Deckung, zweite: Deckung): Deckung {
  return variant < 3 ? erste : zweite;
}

function deckfarbe(rng: Rng, d: Deckung): number {
  return jitterColor(rng.pick(DECKFARBE[d]), rng, 0.05);
}

/** Schlagschatten des ganzen Baukörpers, nach rechts unten. */
function schatten(g: Graphics, pts: number[], weite = 8): void {
  const s: number[] = [];
  for (let i = 0; i < pts.length; i += 2) s.push(pts[i] + weite, pts[i + 1] + weite);
  g.poly(s).fill({ color: 0x000000, alpha: 0.28 });
}

/**
 * Reihen der Deckung zwischen zwei Linien quer zur Dachneigung.
 *
 * `reihe(t)` liefert Anfang und Ende einer Reihe bei Anteil t (0 an der
 * Traufe, 1 am First); gezeichnet wird je nach Deckung als Ziegelstoß,
 * Schieferplatte, Strohbüschel oder Schindel.
 */
function deckung(
  g: Graphics,
  rng: Rng,
  d: Deckung,
  farbe: number,
  reihe: (t: number) => [number, number, number, number],
  tiefe: number,
): void {
  const abstand = d === 'stroh' ? 5 : d === 'schiefer' ? 7 : 8;
  const n = Math.max(2, Math.floor(tiefe / abstand));
  const dunkel = shade(farbe, -0.35);
  for (let i = 1; i < n; i++) {
    const [x0, y0, x1, y1] = reihe(i / n);
    if (d === 'stroh') {
      // Stroh hat keine Fugen, sondern Büschel: kurze Striche längs der Neigung.
      const len = Math.hypot(x1 - x0, y1 - y0);
      const k = Math.floor(len / 4);
      for (let j = 0; j < k; j++) {
        const t = (j + rng.range(0, 0.8)) / k;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        g.moveTo(x, y).lineTo(x + rng.range(-1, 1), y + rng.range(-1, 1) + 3.5)
          .stroke({ width: 1, color: rng.bool() ? dunkel : shade(farbe, 0.25), alpha: 0.5 });
      }
      continue;
    }
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: d === 'schiefer' ? 1.1 : 1.4, color: dunkel, alpha: 0.55 });
    // Stoßfugen versetzt je Reihe — daran erkennt man Ziegel und Schindeln.
    const len = Math.hypot(x1 - x0, y1 - y0);
    const teil = d === 'schiefer' ? 9 : d === 'schindel' ? 7 : 10;
    const k = Math.floor(len / teil);
    const [px0, py0, px1, py1] = reihe((i - 1) / n);
    for (let j = 1; j < k; j++) {
      const t = (j + (i % 2 ? 0.5 : 0) + (d === 'schindel' ? rng.range(-0.25, 0.25) : 0)) / k;
      if (t >= 1) continue;
      const ax = x0 + (x1 - x0) * t;
      const ay = y0 + (y1 - y0) * t;
      const bx = px0 + (px1 - px0) * t;
      const by = py0 + (py1 - py0) * t;
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 0.9, color: dunkel, alpha: 0.35 });
    }
  }
}

/**
 * Satteldach über einem Rechteck. Der First läuft längs der längeren Seite
 * (oder wie `quer` sagt); die dem Licht (oben links) zugewandte Seite ist
 * heller.
 */
function satteldach(
  g: Graphics,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  d: Deckung,
  farbe: number,
  quer?: boolean,
): void {
  const laengs = quer === undefined ? w >= h : !quer;
  const hell = shade(farbe, 0.12);
  const dunkel = shade(farbe, -0.14);
  if (laengs) {
    const m = y + h / 2;
    g.rect(x, y, w, h / 2).fill({ color: hell });
    g.rect(x, m, w, h / 2).fill({ color: dunkel });
    deckung(g, rng, d, hell, (t) => [x, y + (h / 2) * t, x + w, y + (h / 2) * t], h / 2);
    deckung(g, rng, d, dunkel, (t) => [x, y + h - (h / 2) * t, x + w, y + h - (h / 2) * t], h / 2);
    g.moveTo(x, m).lineTo(x + w, m).stroke({ width: 3.2, color: shade(farbe, -0.4) });
    g.moveTo(x, m - 1.5).lineTo(x + w, m - 1.5).stroke({ width: 1, color: shade(farbe, 0.35), alpha: 0.6 });
  } else {
    const m = x + w / 2;
    g.rect(x, y, w / 2, h).fill({ color: hell });
    g.rect(m, y, w / 2, h).fill({ color: dunkel });
    deckung(g, rng, d, hell, (t) => [x + (w / 2) * t, y, x + (w / 2) * t, y + h], w / 2);
    deckung(g, rng, d, dunkel, (t) => [x + w - (w / 2) * t, y, x + w - (w / 2) * t, y + h], w / 2);
    g.moveTo(m, y).lineTo(m, y + h).stroke({ width: 3.2, color: shade(farbe, -0.4) });
    g.moveTo(m - 1.5, y).lineTo(m - 1.5, y + h).stroke({ width: 1, color: shade(farbe, 0.35), alpha: 0.6 });
  }
  g.rect(x, y, w, h).stroke({ width: 2, color: shade(farbe, -0.5) });
}

/**
 * Walmdach: vier Dachflächen, der First kürzer als das Haus. Jede Fläche hat
 * ihre eigene Helligkeit — so wirkt das Dach von oben räumlich.
 */
function walmdach(
  g: Graphics,
  rng: Rng,
  x: number,
  y: number,
  w: number,
  h: number,
  d: Deckung,
  farbe: number,
): void {
  const k = Math.min(w, h) / 2;
  const laengs = w >= h;
  // Firstpunkte.
  const [f0x, f0y, f1x, f1y] = laengs
    ? [x + k, y + h / 2, x + w - k, y + h / 2]
    : [x + w / 2, y + k, x + w / 2, y + h - k];
  const flaechen: Array<[number[], number]> = [
    [[x, y, x + w, y, f1x, f1y, f0x, f0y], 0.14], // oben
    [[x + w, y, x + w, y + h, f1x, f1y], -0.06], // rechts
    [[x, y + h, x + w, y + h, f1x, f1y, f0x, f0y], -0.16], // unten
    [[x, y, x, y + h, f0x, f0y], 0.06], // links
  ];
  for (const [pts, a] of flaechen) g.poly(pts).fill({ color: shade(farbe, a) });
  // Reihen auf den großen Flächen; die Enden folgen den Graten.
  const oben = (t: number): [number, number, number, number] => [
    x + (f0x - x) * t, y + (f0y - y) * t, x + w + (f1x - x - w) * t, y + (f1y - y) * t,
  ];
  const unten = (t: number): [number, number, number, number] => [
    x + (f0x - x) * t, y + h + (f0y - y - h) * t, x + w + (f1x - x - w) * t, y + h + (f1y - y - h) * t,
  ];
  deckung(g, rng, d, shade(farbe, 0.14), oben, laengs ? h / 2 : k);
  deckung(g, rng, d, shade(farbe, -0.16), unten, laengs ? h / 2 : k);
  const grat = shade(farbe, -0.42);
  for (const [ax, ay, bx, by] of [
    [x, y, f0x, f0y], [x, y + h, f0x, f0y], [x + w, y, f1x, f1y], [x + w, y + h, f1x, f1y], [f0x, f0y, f1x, f1y],
  ]) g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 2.4, color: grat });
  g.rect(x, y, w, h).stroke({ width: 2, color: shade(farbe, -0.5) });
}

/** Kegeldach eines runden Turms: Segmente, links oben hell. */
function kegeldach(g: Graphics, cx: number, cy: number, r: number, farbe: number, segmente = 16): void {
  for (let i = 0; i < segmente; i++) {
    const a0 = (i / segmente) * Math.PI * 2;
    const a1 = ((i + 1) / segmente) * Math.PI * 2;
    // Licht aus -135°: cos der Abweichung ergibt die Helligkeit.
    const licht = Math.cos((a0 + a1) / 2 + (Math.PI * 3) / 4);
    g.poly([cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r])
      .fill({ color: shade(farbe, licht * 0.2) });
  }
  for (let ring = 1; ring < 4; ring++) {
    g.circle(cx, cy, (r * ring) / 4).stroke({ width: 1, color: shade(farbe, -0.4), alpha: 0.4 });
  }
  g.circle(cx, cy, r).stroke({ width: 2, color: shade(farbe, -0.5) });
  g.circle(cx, cy, r * 0.08).fill({ color: shade(farbe, -0.5) });
}

/** Schornstein mit dunkler Öffnung und etwas Ruß. */
function schornstein(g: Graphics, x: number, y: number, s = 12): void {
  g.rect(x + 3, y + 3, s, s).fill({ color: 0x000000, alpha: 0.3 });
  g.rect(x, y, s, s).fill({ color: 0x8a7f74 }).stroke({ width: 1.5, color: 0x4a4038 });
  g.rect(x + s * 0.25, y + s * 0.25, s * 0.5, s * 0.5).fill({ color: 0x1e1a18 });
}

/** Zinnen entlang einer Strecke: kleine Klötze auf der Mauerkrone. */
function zinnen(g: Graphics, ax: number, ay: number, bx: number, by: number, farbe: number, dicke: number): void {
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.floor(len / 12);
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  for (let i = 0; i < n; i += 2) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const p = [
      ax + (bx - ax) * t0 + nx * dicke * 0.5, ay + (by - ay) * t0 + ny * dicke * 0.5,
      ax + (bx - ax) * t1 + nx * dicke * 0.5, ay + (by - ay) * t1 + ny * dicke * 0.5,
      ax + (bx - ax) * t1 + nx * dicke * 0.1, ay + (by - ay) * t1 + ny * dicke * 0.1,
      ax + (bx - ax) * t0 + nx * dicke * 0.1, ay + (by - ay) * t0 + ny * dicke * 0.1,
    ];
    g.poly(p).fill({ color: shade(farbe, 0.2) });
  }
}

/** Mauer als dickes Band mit Zinnen auf der Außenseite. */
function mauer(g: Graphics, pts: number[], farbe: number, dicke: number, geschlossen = true): void {
  const n = pts.length / 2;
  const bis = geschlossen ? n : n - 1;
  for (let i = 0; i < bis; i++) {
    const j = (i + 1) % n;
    const [ax, ay, bx, by] = [pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1]];
    g.moveTo(ax + 5, ay + 6).lineTo(bx + 5, by + 6).stroke({ width: dicke, color: 0x000000, alpha: 0.25 });
  }
  for (let i = 0; i < bis; i++) {
    const j = (i + 1) % n;
    const [ax, ay, bx, by] = [pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1]];
    g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: dicke, color: farbe, cap: 'square' });
    g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: dicke * 0.35, color: shade(farbe, -0.18), cap: 'square' });
    zinnen(g, ax, ay, bx, by, farbe, dicke);
  }
}

/** Runder Turm mit Zinnenkranz oder Kegeldach. */
function rundturm(g: Graphics, cx: number, cy: number, r: number, stein: number, dach: number | null): void {
  g.circle(cx + 6, cy + 7, r).fill({ color: 0x000000, alpha: 0.3 });
  g.circle(cx, cy, r).fill({ color: stein }).stroke({ width: 2, color: shade(stein, -0.45) });
  if (dach !== null) {
    kegeldach(g, cx, cy, r * 0.94, dach);
    return;
  }
  g.circle(cx, cy, r * 0.72).fill({ color: shade(stein, -0.2) });
  const n = Math.max(8, Math.round(r / 3));
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * Math.PI * 2;
    g.circle(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, r * 0.11).fill({ color: shade(stein, 0.18) });
  }
}

/** Boden rund ums Haus: gestampfte Erde oder Hof, leicht unregelmäßig. */
function hofflaeche(g: Graphics, rng: Rng, x: number, y: number, w: number, h: number, farbe: number): void {
  g.roundRect(x, y, w, h, 10).fill({ color: farbe, alpha: 0.9 });
  for (let i = 0; i < (w * h) / 900; i++) {
    g.circle(x + rng.range(6, w - 6), y + rng.range(6, h - 6), rng.range(1, 2.5))
      .fill({ color: shade(farbe, rng.range(-0.25, 0.15)), alpha: 0.5 });
  }
}

/** Zaun aus Pfosten und Latten um ein Rechteck, mit Lücke als Tor. */
function zaun(g: Graphics, x: number, y: number, w: number, h: number, torSeite: 0 | 1 | 2 | 3): void {
  const holz = PALETTE.woodDark;
  const seiten: Array<[number, number, number, number]> = [
    [x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y],
  ];
  seiten.forEach(([ax, ay, bx, by], i) => {
    const len = Math.hypot(bx - ax, by - ay);
    const stuecke: Array<[number, number]> = i === torSeite ? [[0, 0.4], [0.6, 1]] : [[0, 1]];
    for (const [t0, t1] of stuecke) {
      g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0).lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1)
        .stroke({ width: 2.2, color: holz });
      const n = Math.floor((len * (t1 - t0)) / 22);
      for (let k = 0; k <= n; k++) {
        const t = t0 + ((t1 - t0) * k) / Math.max(1, n);
        g.circle(ax + (bx - ax) * t, ay + (by - ay) * t, 2.6).fill({ color: shade(holz, -0.2) });
      }
    }
  });
}

/** Rechteckige Hausfläche als Punkte (für den Schatten). */
const rechteck = (x: number, y: number, w: number, h: number) => [x, y, x + w, y, x + w, y + h, x, y + h];

// ---------------------------------------------------------------------------
// Gebäude
// ---------------------------------------------------------------------------

const VARIANTEN = 6;

export const buildingProps: PropDef[] = [
  def('b_house', 'Wohnhaus', 'gebaeude', { w: 440, h: 340 }, ['haus', 'gebaeude', 'dorf', 'stadt'], (g, rng, v) => {
    const d = deckungFuer(v, 'ziegel', 'stroh');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    if (form === 0) {
      // Langhaus mit Satteldach.
      schatten(g, rechteck(-190, -110, 380, 220));
      satteldach(g, rng, -190, -110, 380, 220, d, f);
      schornstein(g, rng.range(-120, 80), -70);
    } else if (form === 1) {
      // Winkelhaus: zwei Flügel, der Seitenflügel quer.
      schatten(g, rechteck(40, -150, 150, 300));
      schatten(g, rechteck(-200, -60, 290, 200));
      satteldach(g, rng, 40, -150, 150, 300, d, f, true);
      satteldach(g, rng, -200, -60, 290, 200, d, f);
      schornstein(g, -140, -30);
    } else {
      // Haus mit Walmdach und Vorbau.
      schatten(g, rechteck(-170, -130, 340, 230));
      walmdach(g, rng, -170, -130, 340, 230, d, f);
      satteldach(g, rng, -50, 90, 100, 60, d, shade(f, -0.05), true);
      schornstein(g, 90, -90);
    }
  }, VARIANTEN),

  def('b_tavern', 'Taverne', 'gebaeude', { w: 640, h: 520 }, ['taverne', 'gasthaus', 'gebaeude', 'stadt'], (g, rng, v) => {
    const d = deckungFuer(v, 'ziegel', 'schindel');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    if (form === 0) {
      // Großes Haupthaus mit Anbau und Biergarten.
      hofflaeche(g, rng, -300, 100, 300, 140, 0x7b6a4f);
      schatten(g, rechteck(-300, -230, 480, 320));
      walmdach(g, rng, -300, -230, 480, 320, d, f);
      satteldach(g, rng, 180, -150, 120, 200, d, shade(f, -0.06), true);
      schornstein(g, -200, -150, 16);
      schornstein(g, 80, -60, 14);
      for (let i = 0; i < 3; i++) {
        const tx = -260 + i * 90;
        g.roundRect(tx, 150, 60, 30, 4).fill({ color: PALETTE.wood }).stroke({ width: 1.5, color: PALETTE.woodDark });
      }
    } else if (form === 1) {
      // Winkelbau um einen Hof mit Brunnen.
      hofflaeche(g, rng, -120, -80, 380, 300, 0x857559);
      schatten(g, [-300, -250, 300, -250, 300, -90, -140, -90, -140, 250, -300, 250]);
      satteldach(g, rng, -300, -250, 600, 160, d, f);
      satteldach(g, rng, -300, -90, 160, 340, d, f, true);
      g.circle(100, 80, 26).fill({ color: 0x8a8278 }).stroke({ width: 3, color: 0x4f4a44 });
      g.circle(100, 80, 16).fill({ color: 0x24394a });
      schornstein(g, 150, -220, 16);
      schornstein(g, -250, 120, 14);
    } else {
      // Drei Flügel um einen Innenhof (Rasthof).
      hofflaeche(g, rng, -140, -60, 280, 200, 0x857559);
      schatten(g, [-300, -250, 300, -250, 300, 250, 140, 250, 140, -60, -140, -60, -140, 250, -300, 250]);
      satteldach(g, rng, -300, -250, 600, 190, d, f);
      satteldach(g, rng, -300, -60, 160, 310, d, f, true);
      satteldach(g, rng, 140, -60, 160, 310, d, shade(f, -0.04), true);
      schornstein(g, -40, -200, 16);
    }
    // Wirtshausschild an der Straßenseite.
    g.rect(-22, 226, 44, 26).fill({ color: PALETTE.woodLight }).stroke({ width: 2, color: PALETTE.woodDark });
    g.circle(0, 239, 6).fill({ color: 0xd9b24a });
  }, VARIANTEN),

  def('b_castle', 'Burg', 'gebaeude', { w: 1000, h: 1000 }, ['burg', 'festung', 'gebaeude', 'mauer'], (g, rng, v) => {
    const stein = jitterColor(v < 3 ? 0x8b8a86 : 0x9c8f7c, rng, 0.05);
    const dachfarbe = v < 3 ? jitterColor(0x566070, rng, 0.05) : jitterColor(0x9a4b36, rng, 0.05);
    const form = v % 3;
    if (form === 0) {
      // Viereckige Anlage mit Ecktürmen und Bergfried in der Mitte.
      const r = 380;
      hofflaeche(g, rng, -r, -r, r * 2, r * 2, 0x7d7462);
      mauer(g, [-r, -r, r, -r, r, r, -r, r], stein, 34);
      for (const [x, y] of [[-r, -r], [r, -r], [r, r], [-r, r]]) rundturm(g, x, y, 62, stein, v < 3 ? null : dachfarbe);
      // Torhaus unten.
      g.rect(-60, r - 40, 120, 90).fill({ color: stein }).stroke({ width: 2, color: shade(stein, -0.45) });
      g.rect(-24, r - 40, 48, 90).fill({ color: 0x3a3228 });
      schatten(g, rechteck(-150, -170, 300, 260), 12);
      walmdach(g, rng, -150, -170, 300, 260, 'schiefer', dachfarbe);
      satteldach(g, rng, 170, 90, 180, 240, 'ziegel', jitterColor(0x9a4b36, rng, 0.05), true);
    } else if (form === 1) {
      // Unregelmäßiger Mauerring auf einem Hügel, runder Bergfried.
      const pts: number[] = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rng.range(-0.12, 0.12);
        const rr = rng.range(360, 440);
        pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.poly(pts).fill({ color: 0x7d7462 });
      mauer(g, pts, stein, 30);
      for (let i = 0; i < pts.length; i += 4) rundturm(g, pts[i], pts[i + 1], 48, stein, null);
      rundturm(g, -40, -40, 130, stein, dachfarbe);
      satteldach(g, rng, 90, 120, 220, 130, 'schindel', jitterColor(0x7a5a3a, rng, 0.05));
      satteldach(g, rng, -300, 60, 150, 220, 'ziegel', jitterColor(0x9a4b36, rng, 0.05), true);
    } else {
      // Konzentrische Burg: äußerer und innerer Ring.
      const au = 440;
      const inn = 250;
      hofflaeche(g, rng, -au, -au, au * 2, au * 2, 0x6f7a55);
      mauer(g, [-au, -au, au, -au, au, au, -au, au], stein, 26);
      hofflaeche(g, rng, -inn, -inn, inn * 2, inn * 2, 0x7d7462);
      mauer(g, [-inn, -inn, inn, -inn, inn, inn, -inn, inn], shade(stein, 0.05), 36);
      for (const [x, y] of [[-au, -au], [au, -au], [au, au], [-au, au], [0, -au], [0, au], [-au, 0], [au, 0]]) {
        rundturm(g, x, y, 42, stein, null);
      }
      for (const [x, y] of [[-inn, -inn], [inn, -inn], [inn, inn], [-inn, inn]]) {
        rundturm(g, x, y, 60, stein, dachfarbe);
      }
      schatten(g, rechteck(-110, -110, 220, 220), 12);
      walmdach(g, rng, -110, -110, 220, 220, 'schiefer', dachfarbe);
    }
  }, VARIANTEN),

  def('b_farm', 'Bauernhof', 'gebaeude', { w: 760, h: 560 }, ['hof', 'bauernhof', 'scheune', 'gebaeude', 'dorf'], (g, rng, v) => {
    const d = deckungFuer(v, 'stroh', 'ziegel');
    const f = deckfarbe(rng, d);
    const scheune = jitterColor(0x6d5134, rng, 0.06);
    const form = v % 3;
    hofflaeche(g, rng, -360, -250, 720, 500, 0x7b6d50);
    if (form === 0) {
      // Haus und Scheune im Winkel, Zaun ums Ganze.
      schatten(g, rechteck(-330, -220, 320, 200));
      satteldach(g, rng, -330, -220, 320, 200, d, f);
      schornstein(g, -240, -180);
      schatten(g, rechteck(60, -220, 260, 380));
      satteldach(g, rng, 60, -220, 260, 380, 'schindel', scheune, true);
      zaun(g, -350, -240, 700, 480, 2);
    } else if (form === 1) {
      // Dreiseithof: Haus, Stall, Scheune um einen Hof.
      schatten(g, rechteck(-340, -230, 680, 150));
      satteldach(g, rng, -340, -230, 680, 150, d, f);
      schatten(g, rechteck(-340, -60, 150, 280));
      satteldach(g, rng, -340, -60, 150, 280, 'schindel', scheune, true);
      schatten(g, rechteck(190, -60, 150, 280));
      satteldach(g, rng, 190, -60, 150, 280, 'schindel', shade(scheune, 0.06), true);
      g.circle(0, 80, 40).fill({ color: 0x5a4a30, alpha: 0.7 }); // Misthaufen
      schornstein(g, -60, -200);
    } else {
      // Einzelhof mit Feldstreifen und Heuhaufen.
      for (let i = 0; i < 6; i++) {
        g.rect(40, -230 + i * 76, 300, 64).fill({ color: rng.pick([0x9a8a4a, 0x7d8a44, 0x8a7a44]), alpha: 0.9 });
        for (let k = 0; k < 5; k++) {
          g.moveTo(44, -220 + i * 76 + k * 12).lineTo(336, -220 + i * 76 + k * 12)
            .stroke({ width: 1, color: 0x5a5030, alpha: 0.35 });
        }
      }
      schatten(g, rechteck(-320, -180, 280, 200));
      walmdach(g, rng, -320, -180, 280, 200, d, f);
      schornstein(g, -150, -140);
      for (const [x, y] of [[-260, 110], [-170, 150]]) {
        g.circle(x + 4, y + 5, 30).fill({ color: 0x000000, alpha: 0.25 });
        g.circle(x, y, 30).fill({ color: 0xc2a566 }).stroke({ width: 1.5, color: 0x8a7440 });
      }
      zaun(g, -350, 50, 360, 190, 0);
    }
  }, VARIANTEN),

  def('b_tower', 'Turm', 'gebaeude', { w: 340, h: 340 }, ['turm', 'wachturm', 'magier', 'gebaeude'], (g, rng, v) => {
    const stein = jitterColor(v < 3 ? 0x8b8a86 : 0x8a7d6e, rng, 0.05);
    const dach = v < 3 ? jitterColor(0x566070, rng, 0.05) : jitterColor(0x5a3f6b, rng, 0.05);
    const form = v % 3;
    if (form === 0) {
      rundturm(g, 0, 0, 140, stein, dach);
    } else if (form === 1) {
      // Eckiger Wachturm mit Zinnen und Luke.
      schatten(g, rechteck(-130, -130, 260, 260), 12);
      g.rect(-130, -130, 260, 260).fill({ color: stein }).stroke({ width: 2.5, color: shade(stein, -0.45) });
      g.rect(-100, -100, 200, 200).fill({ color: shade(stein, -0.15) });
      for (let i = 0; i < 10; i++) {
        const t = -125 + i * 26;
        for (const [x, y] of [[t, -128], [t, 110], [-128, t], [110, t]]) g.rect(x, y, 16, 16).fill({ color: shade(stein, 0.2) });
      }
      g.rect(-24, -24, 48, 48).fill({ color: PALETTE.woodDark }).stroke({ width: 2, color: 0x2e2418 });
      g.moveTo(-24, 0).lineTo(24, 0).stroke({ width: 1.5, color: 0x2e2418 });
    } else {
      // Achteckiger Turm mit Faltdach.
      const pts: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        pts.push(Math.cos(a) * 145, Math.sin(a) * 145);
      }
      schatten(g, pts, 12);
      g.poly(pts).fill({ color: stein }).stroke({ width: 2.5, color: shade(stein, -0.45) });
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        const licht = Math.cos(((i + 0.5) / 8) * Math.PI * 2 + Math.PI / 8 + (Math.PI * 3) / 4);
        g.poly([0, 0, pts[i * 2] * 0.9, pts[i * 2 + 1] * 0.9, pts[j * 2] * 0.9, pts[j * 2 + 1] * 0.9])
          .fill({ color: shade(dach, licht * 0.22) }).stroke({ width: 1.5, color: shade(dach, -0.45) });
      }
    }
  }, VARIANTEN),

  def('b_stall', 'Marktstand', 'gebaeude', { w: 260, h: 200 }, ['markt', 'stand', 'haendler', 'gebaeude'], (g, rng, v) => {
    const farben = [0xb8433a, 0x3d6b8c, 0x4f7a3a, 0xc08a2a, 0x7a4a8a, 0xd8d0bc];
    const a = farben[v % farben.length];
    const b = v < 3 ? 0xece4d0 : shade(a, 0.35);
    const form = v % 3;
    if (form === 0) {
      // Stand mit gestreifter Markise.
      schatten(g, rechteck(-115, -80, 230, 150));
      for (let i = 0; i < 8; i++) g.rect(-115 + i * 28.75, -80, 28.75, 150).fill({ color: i % 2 ? a : b });
      g.moveTo(-115, -5).lineTo(115, -5).stroke({ width: 2, color: shade(a, -0.4), alpha: 0.6 });
      g.rect(-115, -80, 230, 150).stroke({ width: 2, color: shade(a, -0.5) });
      for (let i = 0; i < 8; i++) g.circle(-102 + i * 29, 74, 6).fill({ color: i % 2 ? a : b }).stroke({ width: 1, color: shade(a, -0.5) });
    } else if (form === 1) {
      // Zeltstand mit Spitzdach.
      schatten(g, rechteck(-100, -90, 200, 180));
      walmdach(g, rng, -100, -90, 200, 180, 'schiefer', a);
      g.rect(-100, 70, 200, 26).fill({ color: PALETTE.wood }).stroke({ width: 1.5, color: PALETTE.woodDark });
      for (let i = 0; i < 6; i++) g.circle(-80 + i * 32, 83, 8).fill({ color: rng.pick([0xc0392b, 0xe0b040, 0x6a9a3a, 0x8a5a3a]) });
    } else {
      // Offener Tisch unter einem Sonnensegel an vier Pfosten.
      g.roundRect(-110, -40, 220, 90, 4).fill({ color: PALETTE.wood }).stroke({ width: 2, color: PALETTE.woodDark });
      for (let i = 0; i < 10; i++) {
        g.circle(-90 + (i % 5) * 44, -15 + Math.floor(i / 5) * 40, 12).fill({ color: rng.pick([0xc0392b, 0xe0b040, 0x6a9a3a, 0xd8d0bc, 0x8a5a3a]) });
      }
      g.poly([-125, -95, 125, -95, 110, 20, -110, 20]).fill({ color: a, alpha: 0.82 }).stroke({ width: 2, color: shade(a, -0.45) });
      for (const [x, y] of [[-120, -92], [120, -92], [-106, 16], [106, 16]]) g.circle(x, y, 5).fill({ color: PALETTE.woodDark });
    }
  }, VARIANTEN),

  def('b_chapel', 'Kapelle', 'gebaeude', { w: 560, h: 440 }, ['kirche', 'kapelle', 'tempel', 'gebaeude'], (g, rng, v) => {
    const d = deckungFuer(v, 'schiefer', 'ziegel');
    const f = deckfarbe(rng, d);
    const stein = jitterColor(0x9a978e, rng, 0.05);
    const form = v % 3;
    if (form === 0) {
      // Saalkirche mit runder Apsis und Glockenturm.
      schatten(g, rechteck(-200, -90, 360, 180));
      g.circle(170, 0, 92).fill({ color: 0x000000, alpha: 0.28 });
      kegeldach(g, 160, 0, 90, f, 12);
      satteldach(g, rng, -200, -90, 360, 180, d, f);
      g.rect(-270, -60, 120, 120).fill({ color: stein }).stroke({ width: 2, color: shade(stein, -0.45) });
      walmdach(g, rng, -262, -52, 104, 104, d, shade(f, -0.1));
    } else if (form === 1) {
      // Kreuzförmige Kirche mit Vierungsturm.
      schatten(g, [-260, -70, -80, -70, -80, -200, 80, -200, 80, -70, 260, -70, 260, 70, 80, 70, 80, 200, -80, 200, -80, 70, -260, 70]);
      satteldach(g, rng, -260, -70, 520, 140, d, f);
      satteldach(g, rng, -80, -200, 160, 400, d, f, true);
      walmdach(g, rng, -70, -70, 140, 140, d, shade(f, 0.08));
    } else {
      // Kleine Rundkapelle mit Friedhof.
      hofflaeche(g, rng, -260, -200, 520, 400, 0x6f7a55);
      for (let i = 0; i < 10; i++) {
        const x = rng.range(-230, 230);
        const y = rng.range(-180, 180);
        if (Math.hypot(x, y) < 170) continue;
        g.roundRect(x - 7, y - 11, 14, 22, 5).fill({ color: stein }).stroke({ width: 1, color: shade(stein, -0.5) });
      }
      g.circle(8, 10, 150).fill({ color: 0x000000, alpha: 0.28 });
      g.circle(0, 0, 150).fill({ color: stein });
      kegeldach(g, 0, 0, 140, f, 20);
      g.moveTo(-14, 0).lineTo(14, 0).stroke({ width: 3, color: 0xd9c88a });
      g.moveTo(0, -20).lineTo(0, 16).stroke({ width: 3, color: 0xd9c88a });
    }
  }, VARIANTEN),

  def('b_smithy', 'Schmiede', 'gebaeude', { w: 460, h: 360 }, ['schmiede', 'werkstatt', 'gebaeude', 'stadt'], (g, rng, v) => {
    const d = deckungFuer(v, 'schindel', 'ziegel');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    // Offener Arbeitsplatz: Esse, Amboss, Löschtrog.
    const werkplatz = (x: number, y: number) => {
      g.roundRect(x, y, 170, 120, 6).fill({ color: 0x5a5046 });
      g.circle(x + 40, y + 40, 26).fill({ color: 0x6a6058 }).stroke({ width: 2, color: 0x3a342e });
      g.circle(x + 40, y + 40, 12).fill({ color: 0xe0782a });
      g.roundRect(x + 90, y + 30, 50, 22, 5).fill({ color: 0x4a4e54 }).stroke({ width: 1.5, color: 0x2a2c30 });
      g.roundRect(x + 20, y + 80, 70, 26, 3).fill({ color: PALETTE.woodDark });
      g.rect(x + 25, y + 84, 60, 18).fill({ color: 0x2e4a5a });
    };
    if (form === 0) {
      schatten(g, rechteck(-210, -160, 260, 320));
      satteldach(g, rng, -210, -160, 260, 320, d, f, true);
      werkplatz(50, -60);
      schornstein(g, -120, 60, 20);
    } else if (form === 1) {
      werkplatz(-80, 50);
      schatten(g, rechteck(-210, -160, 420, 200));
      walmdach(g, rng, -210, -160, 420, 200, d, f);
      // Vordach über dem Werkplatz.
      g.rect(-100, 40, 210, 20).fill({ color: shade(f, -0.2) }).stroke({ width: 1.5, color: shade(f, -0.5) });
      schornstein(g, 120, -120, 20);
    } else {
      schatten(g, [-210, -160, 210, -160, 210, 160, 30, 160, 30, 0, -210, 0]);
      satteldach(g, rng, -210, -160, 420, 160, d, f);
      satteldach(g, rng, 30, 0, 180, 160, d, shade(f, -0.06), true);
      werkplatz(-190, 20);
      schornstein(g, -60, -110, 20);
    }
  }, VARIANTEN),

  def('b_windmill', 'Windmühle', 'gebaeude', { w: 440, h: 440 }, ['muehle', 'windmuehle', 'gebaeude', 'dorf'], (g, rng, v) => {
    const stein = jitterColor(0x9a978e, rng, 0.05);
    const d = deckungFuer(v, 'schindel', 'stroh');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    const winkel = (v * Math.PI) / 7;
    if (form === 1) {
      // Bockwindmühle: eckiges Holzhaus.
      schatten(g, rechteck(-80, -90, 160, 180));
      satteldach(g, rng, -80, -90, 160, 180, 'schindel', jitterColor(0x6d5134, rng, 0.05), true);
    } else {
      rundturm(g, 0, 0, form === 0 ? 100 : 120, form === 0 ? stein : jitterColor(0x8a6a4a, rng, 0.05), f);
    }
    // Flügel mit Gitter und Segeltuch.
    for (let i = 0; i < 4; i++) {
      const a = winkel + (i * Math.PI) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = (t: number, q: number) => c * t - s * q;
      const y = (t: number, q: number) => s * t + c * q;
      g.moveTo(0, 0).lineTo(x(210, 0), y(210, 0)).stroke({ width: 6, color: PALETTE.woodDark });
      g.poly([x(50, 4), y(50, 4), x(205, 4), y(205, 4), x(205, 34), y(205, 34), x(50, 30), y(50, 30)])
        .fill({ color: 0xe8e0cc, alpha: 0.85 }).stroke({ width: 1.5, color: PALETTE.woodDark });
      for (let k = 1; k < 6; k++) {
        const t = 50 + k * 26;
        g.moveTo(x(t, 4), y(t, 4)).lineTo(x(t, 32), y(t, 32)).stroke({ width: 1, color: PALETTE.woodDark, alpha: 0.7 });
      }
    }
    g.circle(0, 0, 14).fill({ color: PALETTE.woodDark }).stroke({ width: 2, color: 0x2e2418 });
  }, VARIANTEN),

  def('b_barn', 'Scheune', 'gebaeude', { w: 520, h: 360 }, ['scheune', 'stall', 'hof', 'gebaeude'], (g, rng, v) => {
    const d = deckungFuer(v, 'schindel', 'stroh');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    if (form === 0) {
      schatten(g, rechteck(-240, -150, 480, 300));
      satteldach(g, rng, -240, -150, 480, 300, d, f);
    } else if (form === 1) {
      // Scheune mit Pultdach-Anbau (Stall).
      schatten(g, rechteck(-240, -160, 480, 320));
      satteldach(g, rng, -240, -160, 340, 320, d, f, true);
      g.rect(100, -160, 140, 320).fill({ color: shade(f, -0.1) });
      deckung(g, rng, d, shade(f, -0.1), (t) => [100 + 140 * t, -160, 100 + 140 * t, 160], 140);
      g.rect(100, -160, 140, 320).stroke({ width: 2, color: shade(f, -0.5) });
    } else {
      // Offener Heuschober: Dach auf Pfosten, darunter Heu.
      g.roundRect(-220, -130, 440, 260, 8).fill({ color: 0xc2a566 });
      for (let i = 0; i < 60; i++) {
        const x = rng.range(-210, 210);
        const y = rng.range(-120, 120);
        g.moveTo(x, y).lineTo(x + rng.range(-6, 6), y + rng.range(-6, 6)).stroke({ width: 1.2, color: 0x8a7440, alpha: 0.6 });
      }
      satteldach(g, rng, -240, -150, 480, 130, d, f);
      for (const x of [-230, -80, 80, 230]) g.circle(x, 130, 8).fill({ color: PALETTE.woodDark });
    }
  }, VARIANTEN),

  def('b_hut', 'Hütte', 'gebaeude', { w: 260, h: 240 }, ['huette', 'kate', 'gebaeude', 'wald'], (g, rng, v) => {
    const d = deckungFuer(v, 'stroh', 'schindel');
    const f = deckfarbe(rng, d);
    const form = v % 3;
    if (form === 0) {
      schatten(g, rechteck(-110, -80, 220, 160));
      satteldach(g, rng, -110, -80, 220, 160, d, f);
      schornstein(g, 50, -60, 10);
    } else if (form === 1) {
      // Rundhütte.
      g.circle(6, 8, 105).fill({ color: 0x000000, alpha: 0.28 });
      kegeldach(g, 0, 0, 105, f, 18);
    } else {
      // Blockhütte mit Holzstapel.
      schatten(g, rechteck(-110, -90, 180, 150));
      walmdach(g, rng, -110, -90, 180, 150, d, f);
      for (let i = 0; i < 6; i++) {
        g.circle(90, -70 + i * 22, 10).fill({ color: PALETTE.wood }).stroke({ width: 1.2, color: PALETTE.woodDark });
        g.circle(90, -70 + i * 22, 4).stroke({ width: 1, color: PALETTE.woodDark, alpha: 0.6 });
      }
    }
  }, VARIANTEN),
];
