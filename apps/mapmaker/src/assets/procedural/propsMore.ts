/**
 * Mehr Props aus verschiedenen Kategorien (Rückmeldung 2D).
 *
 * Dorf und Hof (Brunnen, Vogelscheuche, Übungspuppe, Zielscheibe,
 * Laternenpfahl, Steg, Holzbrücke, Hecke, Gemüsebeet), Dungeon (Sarg,
 * eiserne Jungfrau, Kanalgitter, magisches Portal) und Deko (Schatzhaufen,
 * Kristallkugel, Kerzen).
 */

import type { PropDef } from '../propTypes';
import { def } from './defineProp';
import { blob, contactShadow, jitterColor, PALETTE, planks, shade } from './draw';

export const moreProps: PropDef[] = [
  def('fountain', 'Marktbrunnen', 'struktur', 180, ['brunnen', 'markt', 'wasser', 'stadt'], (g, rng) => {
    const stein = jitterColor(0xa8a294, rng, 0.05);
    contactShadow(g, 82, 82, 3, 4);
    // Achteckiges Becken mit breitem Rand, Wasser, Säule in der Mitte.
    const acht = (r: number) => {
      const p: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        p.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      return p;
    };
    g.poly(acht(84)).fill({ color: stein }).stroke({ width: 2.4, color: shade(stein, -0.45) });
    g.poly(acht(70)).fill({ color: 0x5f8ea4 });
    for (let i = 0; i < 3; i++) g.circle(0, 0, 30 + i * 12).stroke({ width: 1.4, color: 0xd8eef3, alpha: 0.45 - i * 0.1 });
    g.circle(0, 0, 22).fill({ color: shade(stein, 0.08) }).stroke({ width: 2, color: shade(stein, -0.45) });
    g.circle(0, 0, 10).fill({ color: 0x8ab8cc }).stroke({ width: 1.2, color: 0xd8eef3 });
  }),

  def('scarecrow', 'Vogelscheuche', 'struktur', { w: 100, h: 44 }, ['feld', 'hof', 'dorf'], (g, rng) => {
    const holz = PALETTE.woodDark;
    contactShadow(g, 30, 12, 2, 3, 0.25);
    g.moveTo(-40, 0).lineTo(40, 0).stroke({ width: 5, color: holz });
    g.roundRect(-18, -12, 36, 24, 6).fill({ color: jitterColor(0x6a5a8a, rng, 0.1) }).stroke({ width: 1.4, color: 0x2a2030 });
    for (const x of [-40, 40]) {
      for (let i = 0; i < 4; i++) g.moveTo(x, 0).lineTo(x + Math.sign(x) * 6 + rng.range(-3, 3), rng.range(-6, 6)).stroke({ width: 1.2, color: 0xc2a566 });
    }
    // Hut von oben.
    g.circle(0, 0, 16).fill({ color: 0xa88a4a }).stroke({ width: 1.4, color: 0x5a4a28 });
    g.circle(0, 0, 8).fill({ color: 0x8a6a3a });
  }),

  def('training_dummy', 'Übungspuppe', 'struktur', 70, ['kaserne', 'training', 'kampf'], (g, rng) => {
    contactShadow(g, 26, 14, 2, 3);
    g.moveTo(-30, 0).lineTo(30, 0).stroke({ width: 6, color: PALETTE.wood });
    g.ellipse(0, 0, 20, 14).fill({ color: 0xc8b078 }).stroke({ width: 1.6, color: 0x6a5a30 });
    for (let i = 0; i < 3; i++) g.moveTo(-18, -6 + i * 6).lineTo(18, -6 + i * 6).stroke({ width: 1, color: 0x8a7440, alpha: 0.7 });
    g.circle(0, 0, 9).fill({ color: 0xd8c08a }).stroke({ width: 1.4, color: 0x6a5a30 });
    // Ein Schnitt oder Pfeil darin.
    if (rng.bool()) g.moveTo(-4, -4).lineTo(10, -14).stroke({ width: 2, color: PALETTE.woodDark });
  }),

  def('archery_target', 'Zielscheibe', 'struktur', 80, ['bogen', 'training', 'kaserne'], (g, rng) => {
    contactShadow(g, 30, 14, 2, 3);
    g.rect(-34, 6, 68, 8).fill({ color: PALETTE.wood }).stroke({ width: 1.4, color: PALETTE.woodDark });
    const farben = [0xe8dcb8, 0x2a2a2a, 0x3a6aa4, 0xc0392b, 0xe0b040];
    // Von oben ist die Scheibe schräg gestellt: gestauchte Ellipsen.
    for (let i = 0; i < 5; i++) g.ellipse(0, 0, 30 - i * 6, 14 - i * 2.8).fill({ color: farben[i] });
    g.ellipse(0, 0, 30, 14).stroke({ width: 1.6, color: 0x3a2a18 });
    for (let i = 0; i < rng.int(1, 3); i++) {
      const x = rng.range(-16, 16);
      const y = rng.range(-6, 6);
      g.moveTo(x, y).lineTo(x + 4, y - 16).stroke({ width: 1.4, color: PALETTE.woodDark });
      g.poly([x + 4, y - 16, x + 1, y - 20, x + 7, y - 19]).fill({ color: 0xe8e0cc });
    }
  }),

  def('lamp_post', 'Laternenpfahl', 'struktur', 50, ['laterne', 'licht', 'stadt', 'strasse'], (g, rng) => {
    void rng;
    // Das Licht leuchtet von selbst: der Pfahl bekommt sein VTT-Licht
    // wie Fackel und Laterne (assets/propLights.ts).
    g.circle(0, 0, 20).fill({ color: 0xffd28a, alpha: 0.18 });
    contactShadow(g, 9, 9, 2, 3);
    g.circle(0, 0, 9).fill({ color: 0x3a3a3e }).stroke({ width: 1.6, color: 0x1e1e22 });
    g.circle(0, 0, 5).fill({ color: 0xffe0a0 });
    g.circle(-1.5, -1.5, 2).fill({ color: 0xffffff, alpha: 0.8 });
  }),

  def('dock', 'Steg', 'struktur', { w: 120, h: 340 }, ['steg', 'hafen', 'wasser', 'holz'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    // Pfähle zuerst, dann die Bohlen quer darüber.
    for (let i = 0; i < 5; i++) for (const x of [-52, 52]) g.circle(x, -150 + i * 75, 7).fill({ color: PALETTE.woodDark }).stroke({ width: 1.4, color: 0x2e2418 });
    g.rect(-48, -164, 96, 328).fill({ color: 0x000000, alpha: 0.2 });
    for (let i = 0; i < 26; i++) {
      const y = -166 + i * 12.6;
      if (rng.bool(0.04)) continue; // eine fehlende Bohle
      g.rect(-50 + rng.range(-1.5, 1.5), y, 100, 11).fill({ color: jitterColor(holz, rng, 0.06) }).stroke({ width: 1, color: shade(holz, -0.45) });
    }
    g.circle(-30, 140, 10).fill({ color: 0xc8b890 }).stroke({ width: 1.2, color: 0x6a5a38 });
  }),

  def('bridge_wood', 'Holzbrücke', 'struktur', { w: 380, h: 140 }, ['bruecke', 'fluss', 'holz'], (g, rng) => {
    const holz = jitterColor(PALETTE.wood, rng, 0.08);
    contactShadow(g, 180, 56, 4, 6, 0.25);
    planks(g, rng, -180, -48, 360, 96, holz, 18, true);
    g.rect(-180, -48, 360, 96).stroke({ width: 2, color: shade(holz, -0.45) });
    // Geländer an beiden Seiten mit Pfosten.
    for (const y of [-58, 50]) {
      g.rect(-184, y, 368, 8).fill({ color: shade(holz, -0.15) }).stroke({ width: 1.4, color: shade(holz, -0.5) });
      for (let i = 0; i < 7; i++) g.rect(-182 + i * 60, y - 2, 12, 12).fill({ color: PALETTE.woodDark });
    }
  }),

  def('hedge', 'Hecke', 'pflanze', { w: 214, h: 56 }, ['hecke', 'garten', 'hof'], (g, rng) => {
    const gruen = jitterColor(0x4f7a35, rng, 0.08);
    contactShadow(g, 96, 22, 3, 4);
    g.roundRect(-96, -22, 192, 44, 20).fill({ color: shade(gruen, -0.15) });
    for (let i = 0; i < 26; i++) {
      const x = -86 + (i / 25) * 172 + rng.range(-4, 4);
      const y = rng.range(-10, 10);
      g.circle(x, y, rng.range(10, 15)).fill({ color: shade(gruen, rng.range(-0.1, 0.12)) });
    }
    for (let i = 0; i < 18; i++) g.circle(rng.range(-86, 86), rng.range(-14, 6), rng.range(3, 6)).fill({ color: shade(gruen, 0.25), alpha: 0.6 });
  }),

  def('veg_bed', 'Gemüsebeet', 'pflanze', { w: 200, h: 110 }, ['beet', 'garten', 'hof', 'gemuese'], (g, rng) => {
    const erde = jitterColor(0x5a4430, rng, 0.06);
    contactShadow(g, 96, 50, 2, 3, 0.2);
    g.roundRect(-96, -50, 192, 100, 6).fill({ color: erde }).stroke({ width: 3, color: PALETTE.woodDark });
    const arten = [
      (x: number, y: number) => { g.circle(x, y, 7).fill({ color: 0x6a9a3a }); g.circle(x, y, 3).fill({ color: 0x8aba4a }); },
      (x: number, y: number) => { for (let k = 0; k < 4; k++) g.moveTo(x, y).lineTo(x + rng.range(-6, 6), y - 8).stroke({ width: 1.6, color: 0x5a8a2a }); g.circle(x, y + 2, 2.5).fill({ color: 0xe07a2a }); },
      (x: number, y: number) => { g.circle(x, y, 8).fill({ color: 0x8aa84a }).stroke({ width: 1, color: 0x5a7a2a }); },
    ];
    for (let r = 0; r < 4; r++) {
      const art = arten[rng.int(0, arten.length - 1)];
      for (let c = 0; c < 9; c++) art(-80 + c * 20 + rng.range(-2, 2), -34 + r * 23 + rng.range(-2, 2));
    }
  }),

  def('coffin', 'Sarg', 'dungeon', { w: 70, h: 150 }, ['sarg', 'gruft', 'tod', 'untot'], (g, rng) => {
    const holz = jitterColor(0x4a3020, rng, 0.08);
    contactShadow(g, 32, 70, 3, 4);
    // Klassische Sechseckform: an den Schultern am breitesten.
    const form = [-18, -72, 18, -72, 32, -40, 22, 72, -22, 72, -32, -40];
    g.poly(form).fill({ color: holz }).stroke({ width: 2.2, color: shade(holz, -0.5) });
    g.poly(form.map((v) => v * 0.82)).stroke({ width: 1.2, color: shade(holz, 0.2), alpha: 0.6 });
    if (rng.bool(0.4)) {
      // Deckel verrutscht, dunkler Spalt.
      g.poly([22, 72, -22, 72, -26, 40, 18, 44]).fill({ color: 0x120c08 });
    }
    g.moveTo(0, -46).lineTo(0, -6).stroke({ width: 3, color: 0xb8a070 });
    g.moveTo(-12, -32).lineTo(12, -32).stroke({ width: 3, color: 0xb8a070 });
  }),

  def('iron_maiden', 'Eiserne Jungfrau', 'dungeon', { w: 80, h: 110 }, ['folter', 'kerker', 'eisen'], (g, rng) => {
    const eisen = jitterColor(PALETTE.metalDark, rng, 0.08);
    contactShadow(g, 34, 48, 3, 4);
    g.ellipse(0, 0, 34, 50).fill({ color: eisen }).stroke({ width: 2.4, color: shade(eisen, -0.5) });
    g.moveTo(0, -50).lineTo(0, 50).stroke({ width: 2, color: shade(eisen, -0.5) });
    for (let i = 0; i < 6; i++) g.circle(rng.bool() ? -14 : 14, -36 + i * 14, 2.2).fill({ color: 0xc8ccd0 });
    g.ellipse(0, -34, 12, 10).fill({ color: shade(eisen, 0.15) }).stroke({ width: 1.2, color: shade(eisen, -0.5) });
    for (const x of [-4, 4]) g.circle(x, -36, 1.8).fill({ color: 0x0e0e10 });
  }),

  def('sewer_grate', 'Kanalgitter', 'dungeon', 80, ['kanal', 'gitter', 'stadt', 'kerker'], (g, rng) => {
    const stein = jitterColor(0x7a746c, rng, 0.06);
    g.rect(-36, -36, 72, 72).fill({ color: stein }).stroke({ width: 2, color: shade(stein, -0.45) });
    g.rect(-28, -28, 56, 56).fill({ color: 0x0e0c0a });
    for (let i = 0; i < 7; i++) g.rect(-28 + i * 9, -28, 3.5, 56).fill({ color: PALETTE.metalDark });
    g.rect(-28, -4, 56, 5).fill({ color: PALETTE.metalDark });
    g.rect(-28, -28, 56, 56).stroke({ width: 1.6, color: 0x3a3e44 });
    if (rng.bool()) g.poly(blob(rng, 10, 0.3, 12, 0.6).map((v, i) => v + (i % 2 ? 30 : -10))).fill({ color: 0x3a4a2a, alpha: 0.6 });
  }),

  def('magic_portal', 'Magisches Portal', 'dungeon', 180, ['portal', 'magie', 'teleport'], (g, rng) => {
    const farbe = rng.pick([0x9a5aff, 0x3ac8ff, 0x3aff9a, 0xff5a9a]);
    // Leuchtender Ring aus Runensteinen, Wirbel in der Mitte.
    g.circle(0, 0, 86).fill({ color: farbe, alpha: 0.12 });
    for (let i = 0; i < 5; i++) g.circle(0, 0, 70 - i * 12).fill({ color: farbe, alpha: 0.1 + i * 0.05 });
    for (let k = 0; k < 3; k++) {
      const start = (k / 3) * Math.PI * 2;
      g.moveTo(0, 0);
      for (let t = 0; t <= 1; t += 0.05) {
        const a = start + t * Math.PI * 2.2;
        g.lineTo(Math.cos(a) * t * 62, Math.sin(a) * t * 62);
      }
      g.stroke({ width: 3, color: shade(farbe, 0.5), alpha: 0.7 });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * 76;
      const y = Math.sin(a) * 76;
      g.roundRect(x - 7, y - 7, 14, 14, 3).fill({ color: 0x6a6660 }).stroke({ width: 1.2, color: 0x2a2826 });
      g.circle(x, y, 3).fill({ color: shade(farbe, 0.4) });
    }
  }),

  def('treasure_pile', 'Schatzhaufen', 'deko', 150, ['schatz', 'gold', 'hort', 'drache'], (g, rng) => {
    const gold = 0xd9b24a;
    g.poly(blob(rng, 64, 0.18, 22, 0.8)).fill({ color: shade(gold, -0.25) });
    for (let i = 0; i < 160; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 58;
      g.circle(Math.cos(a) * d, Math.sin(a) * d * 0.8, rng.range(3, 5)).fill({ color: shade(gold, rng.range(-0.2, 0.25)) })
        .stroke({ width: 0.6, color: 0x8a6a1a, alpha: 0.6 });
    }
    for (let i = 0; i < 8; i++) {
      const mx = rng.range(-44, 44);
      const my = rng.range(-34, 34);
      g.poly([0, -5, 4, 0, 0, 5, -4, 0].map((v, k) => v + (k % 2 ? my : mx)))
        .fill({ color: rng.pick([0xc0392b, 0x2e86de, 0x27ae60, 0x9b59b6]) })
        .stroke({ width: 0.8, color: 0xffffff, alpha: 0.5 });
    }
    g.roundRect(18, -30, 30, 20, 3).fill({ color: PALETTE.woodDark }).stroke({ width: 1.4, color: gold });
    g.circle(-28, 16, 9).fill({ color: gold }).stroke({ width: 1.4, color: 0x8a6a1a });
  }),

  def('crystal_ball', 'Kristallkugel', 'deko', 50, ['magie', 'wahrsager', 'kristall'], (g, rng) => {
    const glanz = rng.pick([0x9ec8ff, 0xc89eff, 0x9effd8]);
    contactShadow(g, 16, 16, 2, 3);
    g.circle(0, 0, 20).fill({ color: PALETTE.woodDark }).stroke({ width: 1.4, color: 0x2e2418 });
    g.circle(0, 0, 15).fill({ color: glanz, alpha: 0.8 }).stroke({ width: 1.2, color: shade(glanz, -0.4) });
    g.circle(2, 2, 7).fill({ color: shade(glanz, 0.4), alpha: 0.6 });
    g.circle(-5, -5, 4).fill({ color: 0xffffff, alpha: 0.8 });
  }),

  def('candles', 'Kerzen', 'deko', 60, ['kerze', 'licht', 'ritual', 'kirche'], (g, rng) => {
    const n = rng.int(3, 6);
    g.circle(0, 0, 24).fill({ color: 0xffd28a, alpha: 0.12 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = i === 0 ? 0 : rng.range(8, 18);
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const r = rng.range(3.5, 5.5);
      g.circle(x + 1, y + 1.5, r).fill({ color: 0x000000, alpha: 0.25 });
      g.circle(x, y, r).fill({ color: 0xf2ead2 }).stroke({ width: 0.8, color: 0xb8ac8a });
      g.circle(x, y, 1.6).fill({ color: 0xffb040 });
      // Wachs ist auf den Boden getropft.
      if (rng.bool(0.5)) g.circle(x + r, y + r * 0.6, 2).fill({ color: 0xe8e0c8 });
    }
  }),
];
