/**
 * Mehr Einrichtung (Rückmeldung 2A).
 *
 * Wohnräume, Küche, Bad, Werkstatt und Salon: was bisher fehlte, um ein
 * Haus von innen einzurichten, ohne dass jeder Raum aus Tisch, Stuhl und
 * Fass besteht. Stil wie die übrigen Möbel — Aufsicht, Kontaktschatten,
 * Holzmaserung, Stoff mit Falten.
 */

import type { Graphics } from 'pixi.js';
import type { Rng } from '@/model/rng';
import type { PropDef } from '../propTypes';
import { def } from './defineProp';
import { bevel, contactShadow, fabric, grain, jitterColor, legs, PALETTE, planks, shade } from './draw';

const STOFFE = [0x8a3b32, 0x35566b, 0x4d6b3c, 0x6b4a7a, 0x8a6a2f];

/** Gepolsterter Sitz mit Armlehnen und Rückenlehne oben. */
function polster(g: Graphics, rng: Rng, w: number, h: number, stoff: number, holz: number, plaetze: number): void {
  contactShadow(g, w / 2, h / 2, 3, 4);
  g.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: holz }).stroke({ width: 2, color: shade(holz, -0.45) });
  // Rückenlehne und Armlehnen als dickere Polsterwülste.
  g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.3, 6).fill({ color: shade(stoff, -0.12) });
  g.roundRect(-w / 2 + 3, -h / 2 + 3, 14, h - 6, 6).fill({ color: shade(stoff, -0.08) });
  g.roundRect(w / 2 - 17, -h / 2 + 3, 14, h - 6, 6).fill({ color: shade(stoff, -0.08) });
  // Sitzkissen.
  const innen = w - 34;
  const kw = innen / plaetze;
  for (let i = 0; i < plaetze; i++) {
    const x = -w / 2 + 17 + i * kw;
    g.roundRect(x + 1, -h / 2 + h * 0.3 + 2, kw - 2, h * 0.7 - 7, 5).fill({ color: stoff });
    g.roundRect(x + 3, -h / 2 + h * 0.3 + 4, kw - 6, 5, 3).fill({ color: shade(stoff, 0.2), alpha: 0.6 });
  }
  void rng;
}

export const interiorProps: PropDef[] = [
  def('sofa', 'Sofa', 'moebel', { w: 190, h: 90 }, ['sofa', 'sitz', 'wohnen', 'salon'], (g, rng) => {
    polster(g, rng, 180, 80, jitterColor(rng.pick(STOFFE), rng, 0.06), jitterColor(PALETTE.woodDark, rng, 0.08), 3);
  }),

  def('armchair', 'Sessel', 'moebel', { w: 90, h: 90 }, ['sessel', 'sitz', 'wohnen', 'salon'], (g, rng) => {
    polster(g, rng, 80, 78, jitterColor(rng.pick(STOFFE), rng, 0.06), jitterColor(PALETTE.woodDark, rng, 0.08), 1);
  }),

  def('bed_double', 'Doppelbett', 'moebel', { w: 176, h: 208 }, ['bett', 'schlaf', 'wohnen'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodDark, rng, 0.1);
    const decke = jitterColor(rng.pick(STOFFE), rng, 0.06);
    contactShadow(g, 80, 96, 3, 4);
    planks(g, rng, -80, -96, 160, 190, holz, 4, true);
    g.roundRect(-80, -96, 160, 190, 4).stroke({ width: 2.4, color: shade(holz, -0.4) });
    g.rect(-80, -96, 160, 14).fill({ color: shade(holz, 0.15) });
    g.roundRect(-72, -78, 144, 164, 3).fill({ color: 0xece6d6 });
    fabric(g, rng, -72, -30, 144, 116, decke, 6);
    g.roundRect(-72, -34, 144, 12, 2).fill({ color: shade(decke, 0.3) });
    for (const x of [-66, 4]) {
      g.roundRect(x, -74, 62, 30, 8).fill({ color: 0xf4f0e4 }).stroke({ width: 1, color: 0xc9c2ae });
    }
  }),

  def('bunk_bed', 'Stockbett', 'moebel', { w: 100, h: 180 }, ['bett', 'schlaf', 'kaserne', 'schiff'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 46, 86, 3, 4);
    // Von oben sieht man das obere Bett; die Leiter hängt an der Seite.
    g.roundRect(-46, -86, 92, 172, 3).fill({ color: holz }).stroke({ width: 2.4, color: shade(holz, -0.45) });
    g.roundRect(-40, -80, 80, 160, 2).fill({ color: 0xd8cfb8 });
    fabric(g, rng, -40, -40, 80, 120, jitterColor(0x7a6a50, rng, 0.08), 4);
    g.roundRect(-34, -76, 68, 24, 6).fill({ color: 0xece6d6 });
    for (const [x, y] of [[-46, -86], [40, -86], [-46, 80], [40, 80]]) g.rect(x, y, 6, 6).fill({ color: shade(holz, -0.3) });
    g.rect(46, -40, 6, 90).fill({ color: shade(holz, -0.1) });
    for (let i = 0; i < 5; i++) g.rect(44, -34 + i * 18, 10, 3).fill({ color: shade(holz, -0.35) });
  }),

  def('nightstand', 'Nachttisch', 'moebel', 46, ['nachttisch', 'schlaf', 'wohnen'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodLight, rng, 0.1);
    contactShadow(g, 20, 20, 2, 3);
    g.roundRect(-20, -20, 40, 40, 3).fill({ color: holz }).stroke({ width: 1.8, color: shade(holz, -0.45) });
    grain(g, rng, -18, -18, 36, 36, shade(holz, -0.3), 4);
    bevel(g, -20, -20, 40, 40, holz);
    // Kerze mit Halter.
    g.circle(6, -4, 7).fill({ color: 0xb8a070 }).stroke({ width: 1, color: 0x6a5a38 });
    g.circle(6, -4, 3).fill({ color: 0xf2ead2 });
    g.circle(6, -4, 1.4).fill({ color: 0xffb040 });
  }),

  def('dresser', 'Kommode', 'moebel', { w: 110, h: 54 }, ['kommode', 'schrank', 'wohnen'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 52, 24, 3, 4);
    g.roundRect(-52, -24, 104, 46, 3).fill({ color: holz }).stroke({ width: 2, color: shade(holz, -0.45) });
    grain(g, rng, -50, -22, 100, 42, shade(holz, -0.3), 7);
    bevel(g, -52, -24, 104, 46, holz);
    // Vorderkante mit drei Schubladengriffen.
    g.rect(-52, 16, 104, 6).fill({ color: shade(holz, -0.25) });
    for (const x of [-32, 0, 32]) g.circle(x, 19, 2.2).fill({ color: 0xc9a44a });
    // Obendrauf: Waschschüssel oder Spiegel.
    if (rng.bool()) {
      g.ellipse(-20, -4, 16, 11).fill({ color: 0xe8e4dc }).stroke({ width: 1.2, color: 0x8a8478 });
      g.ellipse(-20, -4, 10, 6).fill({ color: 0x9ab4c0 });
    } else {
      g.roundRect(-40, -18, 30, 8, 2).fill({ color: 0xa8c0cc }).stroke({ width: 1.2, color: 0xc9a44a });
    }
  }),

  def('cupboard', 'Geschirrschrank', 'moebel', { w: 130, h: 56 }, ['schrank', 'kueche', 'geschirr'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodDark, rng, 0.1);
    contactShadow(g, 62, 26, 3, 4);
    g.rect(-62, -26, 124, 50).fill({ color: holz }).stroke({ width: 2, color: shade(holz, -0.45) });
    // Oberes Bord mit Tellern und Krügen, von oben gesehen.
    g.rect(-58, -22, 116, 24).fill({ color: shade(holz, -0.2) });
    let x = -52;
    while (x < 50) {
      if (rng.bool(0.6)) {
        g.circle(x + 6, -10, 7).fill({ color: 0xe8e0cc }).stroke({ width: 1, color: 0x9a9280 });
        g.circle(x + 6, -10, 3.5).stroke({ width: 0.8, color: 0x9a9280, alpha: 0.7 });
      } else {
        g.circle(x + 6, -10, 5.5).fill({ color: rng.pick([0x8a5a3a, 0x5a6a7a, 0x7a8a5a]) });
        g.circle(x + 6, -10, 2.5).fill({ color: 0x2a2018 });
      }
      x += 14;
    }
    g.rect(-62, 6, 124, 18).fill({ color: holz });
    grain(g, rng, -60, 8, 120, 14, shade(holz, -0.3), 3);
    g.moveTo(0, 6).lineTo(0, 24).stroke({ width: 1.5, color: shade(holz, -0.45) });
  }),

  def('stove', 'Herd', 'moebel', { w: 110, h: 76 }, ['herd', 'kueche', 'feuer'], (g, rng) => {
    const stein = jitterColor(0x7a746c, rng, 0.06);
    contactShadow(g, 52, 34, 3, 4);
    g.roundRect(-52, -34, 104, 68, 4).fill({ color: stein }).stroke({ width: 2, color: shade(stein, -0.45) });
    // Eiserne Platte mit zwei Kochstellen und einem Topf.
    g.roundRect(-44, -26, 88, 44, 3).fill({ color: 0x3a3a3e }).stroke({ width: 1.5, color: 0x1e1e22 });
    for (const x of [-20, 20]) {
      g.circle(x, -4, 13).stroke({ width: 1.5, color: 0x5a5a60 });
      g.circle(x, -4, 7).stroke({ width: 1.2, color: 0x5a5a60 });
    }
    g.circle(20, -4, 12).fill({ color: 0x5a4a3a }).stroke({ width: 1.5, color: 0x2a2018 });
    g.circle(20, -4, 8).fill({ color: rng.pick([0x9a7a3a, 0x7a5a3a, 0xb09050]) });
    // Feuerloch vorn.
    g.roundRect(-20, 22, 40, 10, 3).fill({ color: 0x1e1814 });
    g.roundRect(-14, 24, 28, 6, 2).fill({ color: 0xe07a2a, alpha: 0.9 });
  }),

  def('counter', 'Theke', 'moebel', { w: 272, h: 66 }, ['theke', 'tresen', 'taverne', 'laden'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 116, 28, 3, 4);
    planks(g, rng, -116, -28, 232, 54, holz, 3, false);
    g.roundRect(-116, -28, 232, 54, 3).stroke({ width: 2.2, color: shade(holz, -0.45) });
    g.rect(-116, -28, 232, 6).fill({ color: shade(holz, 0.2), alpha: 0.7 });
    // Krüge, Flaschen, ein Tuch.
    for (let i = 0; i < 5; i++) {
      const x = rng.range(-100, 100);
      if (rng.bool()) {
        g.circle(x, rng.range(-12, 8), 6).fill({ color: 0x8a7a5a }).stroke({ width: 1.2, color: 0x4a3a28 });
      } else {
        g.circle(x, rng.range(-12, 8), 4).fill({ color: rng.pick([0x3a6a4a, 0x6a3a2a, 0x2a4a6a]) }).stroke({ width: 1, color: 0x1a1a1a });
      }
    }
    g.roundRect(rng.range(-60, 40), -6, 24, 14, 2).fill({ color: 0xe8e0cc, alpha: 0.9 });
  }),

  def('bathtub', 'Badezuber', 'moebel', { w: 150, h: 90 }, ['bad', 'wanne', 'waschen'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 70, 40, 3, 4);
    g.ellipse(0, 0, 70, 40).fill({ color: holz }).stroke({ width: 2.4, color: shade(holz, -0.45) });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.moveTo(Math.cos(a) * 60, Math.sin(a) * 32).lineTo(Math.cos(a) * 70, Math.sin(a) * 40).stroke({ width: 1, color: shade(holz, -0.4) });
    }
    // Eiserne Reifen und Wasser mit Schaum.
    g.ellipse(0, 0, 66, 37).stroke({ width: 2, color: PALETTE.metalDark });
    g.ellipse(0, 0, 58, 30).fill({ color: 0x7aa6ba });
    for (let i = 0; i < 8; i++) g.circle(rng.range(-40, 40), rng.range(-18, 18), rng.range(2, 5)).fill({ color: 0xf2f4f4, alpha: 0.7 });
  }),

  def('washbasin', 'Waschtisch', 'moebel', { w: 80, h: 56 }, ['waschen', 'bad', 'schuessel'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodLight, rng, 0.1);
    legs(g, 34, 22, 6, holz);
    g.roundRect(-36, -24, 72, 46, 3).fill({ color: holz }).stroke({ width: 1.8, color: shade(holz, -0.45) });
    g.ellipse(-4, 0, 22, 16).fill({ color: 0xe8e4dc }).stroke({ width: 1.4, color: 0x8a8478 });
    g.ellipse(-4, 0, 15, 10).fill({ color: 0x9ab4c0 });
    g.circle(24, -10, 7).fill({ color: 0xd8d0c0 }).stroke({ width: 1.2, color: 0x8a8478 });
    g.roundRect(18, 6, 14, 12, 2).fill({ color: 0xf0ece0, alpha: 0.9 });
  }),

  def('privy', 'Abort', 'moebel', 70, ['abort', 'bad', 'huette'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.1);
    contactShadow(g, 30, 30, 3, 4);
    planks(g, rng, -30, -30, 60, 60, holz, 4, true);
    g.rect(-30, -30, 60, 60).stroke({ width: 2, color: shade(holz, -0.45) });
    g.roundRect(-24, -8, 48, 30, 3).fill({ color: shade(holz, 0.1) }).stroke({ width: 1.2, color: shade(holz, -0.4) });
    g.ellipse(0, 7, 9, 7).fill({ color: 0x1a1410 });
  }),

  def('harpsichord', 'Cembalo', 'moebel', { w: 110, h: 170 }, ['musik', 'instrument', 'salon'], (g, rng) => {
    const holz = jitterColor(0x4a3020, rng, 0.08);
    contactShadow(g, 50, 80, 3, 4);
    // Flügelform: vorn breit, hinten schräg zulaufend.
    const form = [-48, -80, 48, -80, 48, 20, 10, 80, -48, 80];
    g.poly(form).fill({ color: holz }).stroke({ width: 2.2, color: shade(holz, -0.5) });
    g.poly([-40, -58, 40, -58, 40, 16, 6, 70, -40, 70]).fill({ color: 0xc8a870 });
    for (let i = 0; i < 12; i++) {
      const x = -36 + i * 6.5;
      g.moveTo(x, -56).lineTo(x, 70 - Math.max(0, x - 6) * 1.5).stroke({ width: 0.7, color: 0x5a4a30, alpha: 0.7 });
    }
    // Tastatur.
    g.rect(-44, -78, 88, 18).fill({ color: 0xf2ecd8 });
    for (let i = 0; i < 14; i++) g.moveTo(-44 + i * 6.3, -78).lineTo(-44 + i * 6.3, -60).stroke({ width: 0.7, color: 0x5a5040 });
    for (let i = 0; i < 13; i++) if (i % 7 !== 2 && i % 7 !== 6) g.rect(-41 + i * 6.3, -78, 3, 10).fill({ color: 0x1a1410 });
  }),

  def('harp', 'Harfe', 'moebel', { w: 60, h: 100 }, ['musik', 'instrument', 'salon'], (g, rng) => {
    const holz = jitterColor(0x8a5a2a, rng, 0.08);
    contactShadow(g, 20, 40, 2, 3);
    g.moveTo(-16, 44).lineTo(-16, -40).quadraticCurveTo(10, -50, 22, -30).lineTo(-16, 44)
      .stroke({ width: 6, color: holz });
    for (let i = 1; i < 9; i++) {
      const y = -40 + i * 9;
      const x = -16 + (i / 9) * 36 * (1 - i / 12);
      g.moveTo(-16, y).lineTo(x + 4, y - 4).stroke({ width: 0.8, color: 0xe8dcb0 });
    }
    g.circle(22, -30, 4).fill({ color: 0xd9b24a });
  }),

  def('spinning_wheel', 'Spinnrad', 'moebel', { w: 110, h: 70 }, ['spinnen', 'handwerk', 'wohnen'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 48, 26, 2, 3);
    // Das Rad von oben ist eine schmale Scheibe, die Bank ein Brett.
    g.roundRect(-46, -8, 92, 18, 4).fill({ color: holz }).stroke({ width: 1.6, color: shade(holz, -0.45) });
    g.ellipse(-18, 0, 8, 30).fill({ color: shade(holz, -0.1) }).stroke({ width: 1.6, color: shade(holz, -0.5) });
    g.moveTo(-18, -30).lineTo(-18, 30).stroke({ width: 1, color: shade(holz, -0.4) });
    g.circle(30, 0, 7).fill({ color: 0xe8e0c8 }).stroke({ width: 1, color: 0x9a9070 });
    g.moveTo(-18, -28).lineTo(30, -5).stroke({ width: 0.8, color: 0xe8e0c8 });
  }),

  def('loom', 'Webstuhl', 'moebel', { w: 150, h: 110 }, ['weben', 'handwerk', 'werkstatt'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    const garn = jitterColor(rng.pick(STOFFE), rng, 0.08);
    contactShadow(g, 70, 50, 3, 4);
    for (const x of [-70, 62]) g.rect(x, -50, 8, 100).fill({ color: holz }).stroke({ width: 1.5, color: shade(holz, -0.45) });
    for (const y of [-50, -20, 42]) g.rect(-70, y, 140, 8).fill({ color: shade(holz, 0.08) }).stroke({ width: 1.2, color: shade(holz, -0.45) });
    // Kettfäden und schon gewebtes Tuch.
    for (let i = 0; i < 26; i++) g.moveTo(-60 + i * 4.8, -42).lineTo(-60 + i * 4.8, -20).stroke({ width: 0.8, color: 0xe8dcb8 });
    g.rect(-60, -12, 120, 54).fill({ color: garn });
    for (let i = 0; i < 9; i++) g.moveTo(-60, -8 + i * 6).lineTo(60, -8 + i * 6).stroke({ width: 1, color: shade(garn, -0.25), alpha: 0.6 });
  }),

  def('easel', 'Staffelei', 'moebel', { w: 80, h: 70 }, ['malen', 'kunst', 'werkstatt'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodLight, rng, 0.08);
    contactShadow(g, 30, 22, 2, 3);
    // Dreibein von oben und das Bild als schmale Leinwandkante.
    for (const [x, y] of [[-30, 22], [30, 22], [0, -26]]) g.moveTo(0, 0).lineTo(x, y).stroke({ width: 4, color: holz });
    g.roundRect(-34, 4, 68, 8, 2).fill({ color: 0xf2ecd8 }).stroke({ width: 1.2, color: 0x8a7a5a });
    for (let i = 0; i < 4; i++) g.circle(-24 + i * 14, 8, 2.4).fill({ color: rng.pick([0xc0392b, 0x2e6da4, 0xe0b040, 0x3a8a4a]) });
    g.ellipse(22, -16, 12, 8).fill({ color: 0xc8a870 }).stroke({ width: 1, color: 0x6a5030 });
  }),

  def('globe', 'Globus', 'moebel', 60, ['globus', 'studierstube', 'bibliothek'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodDark, rng, 0.08);
    contactShadow(g, 24, 24, 2, 3);
    g.circle(0, 0, 26).stroke({ width: 4, color: holz });
    g.circle(0, 0, 22).fill({ color: 0x6f9ab0 });
    for (let i = 0; i < 4; i++) {
      const mx = rng.range(-8, 8);
      const my = rng.range(-8, 8);
      const f = rng.range(0.5, 0.9);
      g.poly([-8, -6, 4, -12, 10, -2, 2, 6, -6, 4].map((v, k) => v * f + (k % 2 ? my : mx)))
        .fill({ color: 0xc8b078 });
    }
    g.ellipse(0, 0, 22, 8).stroke({ width: 0.8, color: 0x2a4a5a, alpha: 0.6 });
    g.moveTo(0, -22).lineTo(0, 22).stroke({ width: 0.8, color: 0x2a4a5a, alpha: 0.6 });
    g.circle(-8, -8, 5).fill({ color: 0xffffff, alpha: 0.25 });
  }),

  def('potted_plant', 'Topfpflanze', 'moebel', 56, ['pflanze', 'topf', 'wohnen', 'deko'], (g, rng) => {
    contactShadow(g, 18, 18, 2, 3);
    g.circle(0, 0, 18).fill({ color: 0xa0583a }).stroke({ width: 2, color: 0x5a2e1e });
    g.circle(0, 0, 14).fill({ color: 0x4a3a2a });
    const blatt = jitterColor(PALETTE.leaf, rng, 0.12);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const l = rng.range(16, 24);
      g.ellipse(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, l * 0.5, 5)
        .fill({ color: shade(blatt, rng.range(-0.15, 0.15)) });
    }
    g.circle(0, 0, 4).fill({ color: shade(blatt, 0.2) });
  }),

  def('table_long', 'Tafel', 'moebel', { w: 326, h: 100 }, ['tisch', 'tafel', 'speisesaal', 'fest'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    legs(g, 140, 38, 10, holz);
    contactShadow(g, 142, 40, 3, 4);
    planks(g, rng, -142, -40, 284, 80, holz, 4, false);
    g.roundRect(-142, -40, 284, 80, 4).stroke({ width: 2.4, color: shade(holz, -0.45) });
    // Tischläufer, Teller, Becher, Kerzen.
    g.rect(-130, -8, 260, 16).fill({ color: jitterColor(0x8a3b32, rng, 0.08), alpha: 0.85 });
    for (let i = 0; i < 6; i++) {
      const x = -110 + i * 44;
      for (const y of [-26, 26]) {
        g.circle(x, y, 9).fill({ color: 0xe8e0cc }).stroke({ width: 1, color: 0x9a9280 });
        g.circle(x + 13, y * 0.8, 3.5).fill({ color: 0x8a7a5a });
      }
    }
    for (const x of [-60, 0, 60]) {
      g.circle(x, 0, 4).fill({ color: 0xf2ead2 });
      g.circle(x, 0, 1.6).fill({ color: 0xffb040 });
    }
  }),

  def('wine_rack', 'Weinregal', 'moebel', { w: 130, h: 50 }, ['wein', 'keller', 'regal', 'taverne'], (g, rng) => {
    const holz = jitterColor(PALETTE.woodDark, rng, 0.08);
    contactShadow(g, 62, 22, 3, 4);
    g.rect(-62, -22, 124, 44).fill({ color: holz }).stroke({ width: 2, color: shade(holz, -0.45) });
    // Flaschenböden in Reihen, einige Fächer leer.
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        const x = -54 + c * 13.5;
        const y = -13 + r * 13;
        g.circle(x, y, 5.5).fill({ color: shade(holz, -0.35) });
        if (rng.bool(0.75)) g.circle(x, y, 4.2).fill({ color: rng.pick([0x2a4a2a, 0x4a1a1a, 0x3a3a1a]) });
      }
    }
  }),

  def('pantry_shelf', 'Vorratsregal', 'moebel', { w: 130, h: 50 }, ['vorrat', 'kueche', 'regal', 'keller'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 62, 22, 3, 4);
    g.rect(-62, -22, 124, 44).fill({ color: holz }).stroke({ width: 2, color: shade(holz, -0.45) });
    let x = -56;
    while (x < 34) {
      const art = rng.int(0, 3);
      if (art === 0) {
        g.circle(x + 7, 0, 7).fill({ color: 0xc8b890 }).stroke({ width: 1, color: 0x7a6a48 });
        g.circle(x + 7, 0, 4).fill({ color: rng.pick([0xa04030, 0xd09030, 0x6a8a3a]) });
        x += 16;
      } else if (art === 1) {
        g.roundRect(x, -14, 18, 26, 4).fill({ color: 0xd8c8a0 }).stroke({ width: 1, color: 0x8a7a50 });
        g.moveTo(x + 4, -8).lineTo(x + 14, -8).stroke({ width: 1, color: 0x8a7a50 });
        x += 21;
      } else if (art === 2) {
        g.ellipse(x + 10, 0, 10, 12).fill({ color: 0xe0c070 }).stroke({ width: 1, color: 0x8a6a30 });
        x += 22;
      } else {
        g.circle(x + 6, -6, 5).fill({ color: 0xb04a2a });
        g.circle(x + 8, 6, 5).fill({ color: 0x9a3a2a });
        x += 16;
      }
    }
  }),

  def('washtub', 'Waschzuber', 'moebel', 70, ['waschen', 'wasser', 'hof'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 30, 30, 2, 3);
    g.circle(0, 0, 30).fill({ color: holz }).stroke({ width: 2.2, color: shade(holz, -0.45) });
    g.circle(0, 0, 28).stroke({ width: 2, color: PALETTE.metalDark });
    g.circle(0, 0, 23).fill({ color: 0x86aab8 });
    // Waschbrett schräg darin.
    g.roundRect(-6, -20, 14, 34, 2).fill({ color: shade(holz, 0.15) }).stroke({ width: 1, color: shade(holz, -0.4) });
    for (let i = 0; i < 6; i++) g.moveTo(-4, -16 + i * 5).lineTo(6, -16 + i * 5).stroke({ width: 0.8, color: shade(holz, -0.4) });
  }),
];
