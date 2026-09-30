/**
 * Wald-Generator: Poisson-Disk-Sampling mit Dichtemaske.
 *
 * Reiner Zufall streut Bäume in Klumpen und lässt kahle Löcher — beides sieht
 * falsch aus. Poisson-Disk hält einen Mindestabstand ein und ergibt die
 * gleichmäßig-unregelmäßige Verteilung, die ein Wald von oben hat.
 *
 * Umgesetzt als Bridson-Verfahren: um einen bestehenden Punkt werden Kandidaten
 * im Ring zwischen r und 2r gewürfelt; wer weit genug von allen anderen liegt,
 * wird übernommen und selbst zum Ausgangspunkt.
 */

import { Rng, hashSeed } from '../rng';
import { strokeBand } from '../geometry';
import { emptyResult, type BaseOptions, type GeneratedMap } from './types';

export type ForestWater = 'random' | 'none' | 'pond' | 'stream' | 'lake' | 'river';

export interface ForestOptions extends BaseOptions {
  /** Mindestabstand der Bäume in Tiles. */
  spacing: number;
  /** Anteil Nadelbäume. */
  pineShare: number;
  /** Anzahl Lichtungen. */
  clearings: number;
  /** Pfad durch den Wald legen (Richtung und Verlauf würfeln). */
  path: boolean;
  /** Unterholz: Büsche, Farn, Pilze. */
  undergrowth: boolean;
  /**
   * Gewässer im Wald. 'random' würfelt je Karte (Rückmeldung: „Wald hat immer
   * gleiches Layout"); ein Waldstück hat meist höchstens eins davon.
   */
  water: ForestWater;
  /** Anteil Felsbrocken, 0–1. */
  rocks: number;
  /** Anzahl Hügelkuppen. */
  hills: number;
}

export function defaultForestOptions(): Omit<ForestOptions, 'seed' | 'tileSize'> {
  return {
    cols: 40,
    rows: 30,
    spacing: 1.6,
    pineShare: 0.4,
    clearings: 3,
    path: true,
    undergrowth: true,
    water: 'random',
    rocks: 0.15,
    hills: 0,
  };
}

/**
 * Unregelmäßiger runder Umriss.
 *
 * Ein exakter Kreis sieht gebaut aus; ein Tümpel und eine Hügelkuppe haben
 * beide eine Rundung, die *ungefähr* rund ist. Der Radius schwankt darum je
 * Winkel, und die Schwankung ist über den Umlauf zusammenhängend — sonst
 * entstünde ein Zackenstern statt einer Kuppe.
 */
function blob(rng: Rng, cx: number, cy: number, r: number, unruhe = 0.28, ecken = 18): number[] {
  // Ein Wert je Ecke, danach mit den Nachbarn verschliffen.
  const roh = Array.from({ length: ecken }, () => 1 + rng.range(-unruhe, unruhe));
  const glatt = roh.map((_, i) => {
    const a = roh[(i - 1 + ecken) % ecken];
    const b = roh[i];
    const c = roh[(i + 1) % ecken];
    return (a + 2 * b + c) / 4;
  });
  const out: number[] = [];
  for (let i = 0; i < ecken; i++) {
    const w = (i / ecken) * Math.PI * 2;
    out.push(cx + Math.cos(w) * r * glatt[i], cy + Math.sin(w) * r * glatt[i]);
  }
  return out;
}

interface Punkt {
  x: number;
  y: number;
}

/** Bridson-Sampling auf einer Fläche in Tile-Einheiten. */
function poisson(rng: Rng, cols: number, rows: number, r: number, versuche = 24): Punkt[] {
  const zellgroesse = r / Math.SQRT2;
  const gc = Math.ceil(cols / zellgroesse);
  const gr = Math.ceil(rows / zellgroesse);
  const raster = new Int32Array(gc * gr).fill(-1);
  const punkte: Punkt[] = [];
  const aktiv: number[] = [];

  const eintragen = (p: Punkt) => {
    const i = punkte.length;
    punkte.push(p);
    aktiv.push(i);
    const cx = Math.floor(p.x / zellgroesse);
    const cy = Math.floor(p.y / zellgroesse);
    if (cx >= 0 && cy >= 0 && cx < gc && cy < gr) raster[cy * gc + cx] = i;
  };

  const passt = (p: Punkt): boolean => {
    if (p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows) return false;
    const cx = Math.floor(p.x / zellgroesse);
    const cy = Math.floor(p.y / zellgroesse);
    for (let y = Math.max(0, cy - 2); y <= Math.min(gr - 1, cy + 2); y++) {
      for (let x = Math.max(0, cx - 2); x <= Math.min(gc - 1, cx + 2); x++) {
        const i = raster[y * gc + x];
        if (i < 0) continue;
        const q = punkte[i];
        if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) return false;
      }
    }
    return true;
  };

  eintragen({ x: rng.range(0, cols), y: rng.range(0, rows) });

  while (aktiv.length > 0) {
    const k = rng.int(0, aktiv.length - 1);
    const basis = punkte[aktiv[k]];
    let gefunden = false;
    for (let i = 0; i < versuche; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(r, 2 * r);
      const kandidat = { x: basis.x + Math.cos(a) * d, y: basis.y + Math.sin(a) * d };
      if (!passt(kandidat)) continue;
      eintragen(kandidat);
      gefunden = true;
      break;
    }
    // Kein Platz mehr um diesen Punkt — er scheidet aus der aktiven Liste aus.
    if (!gefunden) aktiv.splice(k, 1);
  }
  return punkte;
}

/** Punkt auf einem Kartenrand: 0 oben, 1 rechts, 2 unten, 3 links. */
function randPunkt(rng: Rng, seite: number, cols: number, rows: number): Punkt {
  switch (seite) {
    case 0: return { x: rng.range(cols * 0.15, cols * 0.85), y: -1 };
    case 1: return { x: cols + 1, y: rng.range(rows * 0.15, rows * 0.85) };
    case 2: return { x: rng.range(cols * 0.15, cols * 0.85), y: rows + 1 };
    default: return { x: -1, y: rng.range(rows * 0.15, rows * 0.85) };
  }
}

/**
 * Geschwungener Zug von A nach B über einen versetzten Mittelpunkt, dazu
 * etwas Zittern — Wege und Bäche laufen nie mit dem Lineal.
 */
function schwung(rng: Rng, a: Punkt, b: Punkt, ausschlag: number, schritt = 1.6): Punkt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bogen = rng.range(-ausschlag, ausschlag);
  const out: Punkt[] = [];
  const n = Math.max(2, Math.ceil(len / schritt));
  let zitter = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    zitter = Math.max(-1.2, Math.min(1.2, zitter + rng.range(-0.45, 0.45)));
    const bauch = Math.sin(Math.PI * t) * bogen + (i > 0 && i < n ? zitter : 0);
    out.push({ x: a.x + dx * t + nx * bauch, y: a.y + dy * t + ny * bauch });
  }
  return out;
}

const naeher = (p: Punkt, zug: readonly Punkt[], d: number): boolean =>
  zug.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < d * d);

export function generateForest(opts: ForestOptions): GeneratedMap {
  const { cols, rows } = opts;
  const s = opts.tileSize;
  const ergebnis = emptyResult(cols, rows);
  // Getrennte Zufallsquellen je Teil: schaltet man den Pfad aus, soll das
  // Wasser dasselbe bleiben, statt dass sich die ganze Karte verwürfelt.
  const rngWasser = new Rng(hashSeed(opts.seed, 1));
  const rngPfad = new Rng(hashSeed(opts.seed, 2));
  const rngLicht = new Rng(hashSeed(opts.seed, 3));
  const rng = new Rng(hashSeed(opts.seed, 4));

  // Waldboden in einem von drei Tönen: Laubwald, Nadelwald, Moor.
  const boden = rngLicht.pick([0x4c5c34, 0x445536, 0x505a3a]);
  ergebnis.floors.push({ points: [0, 0, cols * s, 0, cols * s, rows * s, 0, rows * s], color: boden });

  // ---- Wasser -------------------------------------------------------------
  const wasserArt =
    opts.water === 'random'
      ? rngWasser.pickWeighted(['none', 'pond', 'stream', 'lake', 'river'] as const, [0.3, 0.2, 0.25, 0.12, 0.13])
      : opts.water;
  const WASSER = 0x3d6b7d;
  const wasser: Array<(p: Punkt) => boolean> = [];
  const ufer: Punkt[] = [];
  let wasserZug: Punkt[] = [];
  let wasserBreite = 0;

  if (wasserArt === 'pond' || wasserArt === 'lake') {
    const see = wasserArt === 'lake';
    // Der See liegt am Rand und reicht über ihn hinaus, der Tümpel im Wald.
    const seite = rngWasser.int(0, 3);
    const rand = randPunkt(rngWasser, seite, cols, rows);
    const cx = see ? rand.x : rngWasser.range(cols * 0.25, cols * 0.75);
    const cy = see ? rand.y : rngWasser.range(rows * 0.25, rows * 0.75);
    const r = see ? rngWasser.range(Math.min(cols, rows) * 0.28, Math.min(cols, rows) * 0.42) : rngWasser.range(2.5, 5.5);
    ergebnis.floors.push({ points: blob(rngWasser, cx * s, cy * s, r * s, 0.3, 26), color: WASSER });
    wasser.push((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2 < (r * 1.3) ** 2);
    for (let i = 0; i < Math.round(r * 5); i++) {
      const w = rngWasser.range(0, Math.PI * 2);
      ufer.push({ x: cx + Math.cos(w) * r * rngWasser.range(1.08, 1.32), y: cy + Math.sin(w) * r * rngWasser.range(1.08, 1.32) });
    }
  } else if (wasserArt === 'stream' || wasserArt === 'river') {
    const fluss = wasserArt === 'river';
    const von = rngWasser.int(0, 3);
    const nach = (von + rngWasser.pick([1, 2, 2, 3])) % 4;
    wasserZug = schwung(rngWasser, randPunkt(rngWasser, von, cols, rows), randPunkt(rngWasser, nach, cols, rows), fluss ? 4 : 6);
    wasserBreite = fluss ? rngWasser.range(2.6, 4) : rngWasser.range(0.9, 1.5);
    // strokeBand nimmt die halbe Breite.
    ergebnis.floors.push({ points: strokeBand(wasserZug.flatMap((p) => [p.x * s, p.y * s]), (wasserBreite / 2) * s), color: WASSER });
    wasser.push((p) => naeher(p, wasserZug, wasserBreite / 2 + 0.6));
    for (const q of wasserZug) {
      for (const seite of [-1, 1]) {
        if (rngWasser.bool(0.5)) ufer.push({ x: q.x + seite * (wasserBreite / 2 + rngWasser.range(0.3, 0.9)), y: q.y + rngWasser.range(-0.6, 0.6) });
      }
    }
  }
  const imWasser = (p: Punkt): boolean => wasser.some((f) => f(p));

  // Schilf, Seerosen und Steine am Ufer.
  for (const u of ufer) {
    if (u.x < 0 || u.y < 0 || u.x > cols || u.y > rows) continue;
    ergebnis.props.push({
      propId: rngWasser.pick(['reeds', 'reeds', 'grass_tuft', 'stone_small', 'lilypads']),
      x: u.x * s,
      y: u.y * s,
      scale: rngWasser.range(0.7, 1.1),
      rotation: rngWasser.range(0, Math.PI * 2),
    });
  }

  // ---- Lichtungen ------------------------------------------------------------
  const lichtungen = Array.from({ length: Math.max(0, Math.round(opts.clearings)) }, () => ({
    x: rngLicht.range(cols * 0.12, cols * 0.88),
    y: rngLicht.range(rows * 0.12, rows * 0.88),
    r: rngLicht.range(2.2, 5.5),
  })).filter((l) => !imWasser(l));
  for (const l of lichtungen) {
    ergebnis.floors.push({ points: blob(rngLicht, l.x * s, l.y * s, l.r * 1.1 * s, 0.3, 22), color: 0x5f7a44 });
  }
  const inLichtung = (p: Punkt): boolean => lichtungen.some((l) => (p.x - l.x) ** 2 + (p.y - l.y) ** 2 < l.r * l.r);

  // ---- Pfad -------------------------------------------------------------------
  // Von einem zufälligen Rand zu einem anderen, manchmal über eine Lichtung,
  // manchmal mit Abzweig. Früher lief er immer waagerecht von links nach rechts.
  const pfade: Punkt[][] = [];
  if (opts.path) {
    const von = rngPfad.int(0, 3);
    const nach = (von + rngPfad.pick([1, 2, 2, 3])) % 4;
    const a = randPunkt(rngPfad, von, cols, rows);
    const b = randPunkt(rngPfad, nach, cols, rows);
    const ziel = lichtungen.length > 0 && rngPfad.bool(0.6) ? rngPfad.pick(lichtungen) : null;
    const haupt = ziel ? [...schwung(rngPfad, a, ziel, 3), ...schwung(rngPfad, ziel, b, 3).slice(1)] : schwung(rngPfad, a, b, 5);
    pfade.push(haupt);
    if (rngPfad.bool(0.4)) {
      const ab = haupt[Math.floor(haupt.length * rngPfad.range(0.3, 0.7))];
      const frei = [0, 1, 2, 3].filter((x) => x !== von && x !== nach);
      pfade.push(schwung(rngPfad, ab, randPunkt(rngPfad, rngPfad.pick(frei), cols, rows), 3));
    }
    for (const zug of pfade) {
      ergebnis.floors.push({ points: strokeBand(zug.flatMap((p) => [p.x * s, p.y * s]), 0.9 * s), color: 0x8a7a5c });
    }
    // Wo der Weg das Wasser kreuzt: Trittsteine als Furt.
    if (wasserZug.length > 0) {
      for (const zug of pfade) {
        for (const p of zug) {
          if (!naeher(p, wasserZug, wasserBreite / 2 + 0.3)) continue;
          for (let i = 0; i < Math.max(2, Math.round(wasserBreite * 1.5)); i++) {
            ergebnis.props.push({
              propId: 'stone_medium',
              x: (p.x + rngPfad.range(-0.5, 0.5)) * s,
              y: (p.y + rngPfad.range(-0.5, 0.5)) * s,
              scale: rngPfad.range(0.6, 0.85),
              rotation: rngPfad.range(0, Math.PI * 2),
            });
          }
        }
      }
    }
  }
  const aufPfad = (p: Punkt): boolean => pfade.some((zug) => naeher(p, zug, 1.4));

  // ---- Hügelkuppen -----------------------------------------------------------
  const kuppen = Array.from({ length: Math.max(0, Math.round(opts.hills)) }, () => ({
    x: rng.range(cols * 0.2, cols * 0.8),
    y: rng.range(rows * 0.2, rows * 0.8),
    r: rng.range(3.5, 6.5),
  }));
  for (const k of kuppen) {
    ergebnis.floors.push({ points: blob(rng, k.x * s, k.y * s, k.r * s, 0.22), color: 0x5c6b3c });
    const n = Math.round(k.r * 2.2);
    for (let i = 0; i < n; i++) {
      const w = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const d = k.r * rng.range(0.82, 1.02);
      ergebnis.props.push({
        propId: rng.pick(['stone_medium', 'boulder_mossy', 'stone_large']),
        x: (k.x + Math.cos(w) * d) * s,
        y: (k.y + Math.sin(w) * d) * s,
        scale: rng.range(0.7, 1.2),
        rotation: rng.range(0, Math.PI * 2),
      });
    }
  }

  const freiHalten = (p: Punkt): boolean => inLichtung(p) || aufPfad(p) || imWasser(p);

  // ---- Bäume ------------------------------------------------------------------
  // Art nach Standort: Weiden am Wasser, Birken an Lichtungsrändern, sonst
  // Laub oder Nadel nach Anteil; vereinzelt tote und umgestürzte Stämme.
  const amWasser = (p: Punkt) => wasser.length > 0 && !imWasser(p) && wasser.some((f) => f({ x: p.x + 1.6, y: p.y }) || f({ x: p.x - 1.6, y: p.y }) || f({ x: p.x, y: p.y + 1.6 }) || f({ x: p.x, y: p.y - 1.6 }));
  const amLichtungsrand = (p: Punkt) => lichtungen.some((l) => (p.x - l.x) ** 2 + (p.y - l.y) ** 2 < (l.r + 1.8) ** 2);
  for (const p of poisson(rng, cols, rows, opts.spacing)) {
    if (freiHalten(p)) continue;
    let art: string;
    const w = rng.next();
    if (amWasser(p) && w < 0.55) art = 'tree_willow';
    else if (w < 0.04) art = 'tree_dead';
    else if (w < 0.07) art = 'tree_fallen';
    else if (amLichtungsrand(p) && w < 0.35) art = 'tree_birch';
    else if (rng.next() < opts.pineShare) art = rng.bool(0.3) ? 'tree_pine_slim' : 'tree_pine';
    else art = rng.bool(0.15) ? 'tree_birch' : 'tree_deciduous';
    ergebnis.props.push({ propId: art, x: p.x * s, y: p.y * s, scale: rng.range(0.8, 1.35), rotation: rng.range(0, Math.PI * 2) });
  }

  if (opts.undergrowth) {
    const streu = ['bush', 'fern', 'grass_tuft', 'mushrooms', 'stone_small', 'leaves', 'log', 'berry_bush', 'flowers', 'stump'];
    for (const p of poisson(rng, cols, rows, opts.spacing * 0.55)) {
      if (aufPfad(p) || imWasser(p)) continue;
      if (inLichtung(p) && rng.bool(0.8)) continue;
      if (rng.bool(0.45)) continue;
      ergebnis.props.push({
        propId: inLichtung(p) ? rng.pick(['flowers', 'grass_tuft', 'flower_patch']) : rng.pick(streu),
        x: p.x * s,
        y: p.y * s,
        scale: rng.range(0.6, 1.15),
        rotation: rng.range(0, Math.PI * 2),
      });
    }
  }

  if (opts.rocks > 0) {
    for (const p of poisson(rng, cols, rows, opts.spacing * 1.4)) {
      if (aufPfad(p) || imWasser(p)) continue;
      if (!rng.bool(opts.rocks)) continue;
      ergebnis.props.push({
        propId: rng.pick(['stone_medium', 'boulder_mossy', 'stone_large', 'rubble']),
        x: p.x * s,
        y: p.y * s,
        scale: rng.range(0.7, 1.3),
        rotation: rng.range(0, Math.PI * 2),
      });
    }
  }

  // Flächen auf die Karte klemmen: ein See am Rand soll am Rand enden, nicht
  // weit darüber hinaus (was draußen liegt, fehlt ohnehin im Export).
  const W = cols * s;
  const H = rows * s;
  for (const f of ergebnis.floors) {
    for (let i = 0; i < f.points.length; i += 2) {
      f.points[i] = Math.max(0, Math.min(W, f.points[i]));
      f.points[i + 1] = Math.max(0, Math.min(H, f.points[i + 1]));
    }
  }
  ergebnis.props = ergebnis.props.filter((p) => p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H);
  return ergebnis;
}
