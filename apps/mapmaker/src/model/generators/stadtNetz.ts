/**
 * Gewachsenes Straßennetz mit Häuserreihen.
 *
 * Rückmeldung zum alten Grundriss: „Nicht einfach nur sinnlos generierte
 * Wege." Er schnitt den Ort mit Geraden in Blöcke; heraus kamen Straßen wie
 * Sprünge im Glas, spitze Einmündungen und Häuser, die verstreut mitten in
 * den Blöcken standen.
 *
 * Hier wird ein Ort so angelegt, wie ein mittelalterlicher Ort gemeinhin
 * gewachsen ist (allgemeines Wissen über Stadtgrundrisse, keine geprüfte
 * Einzelquelle):
 *
 * - **Markt** nahe der Mitte, als unregelmäßiges Viereck.
 * - **Hauptstraßen** laufen leicht geschwungen vom Markt zu den Ausfällen
 *   (bei einer Mauer: zu den Toren).
 * - **Nebengassen**: eine Ringgasse etwa auf halbem Weg zum Rand,
 *   Quergassen zwischen benachbarten Hauptstraßen, kurze Stichgassen.
 * - **Häuser stehen an den Straßen**, traufseitig, Wand an Wand, mit der Tür
 *   zur Straße; dahinter bleiben Höfe und Gärten. Zuerst am Markt und an den
 *   Hauptstraßen, dann an den Gassen.
 *
 * Alle Maße in Feldern. Belegt wird in halben Feldern, damit Häuser an
 * schrägen Straßen nicht ganze Felder verschenken.
 */

import type { Rng } from '../rng';
import type { CityHouse, Poly } from './cityPlan';
import { imPoly, ueberlappen } from './cityPlan';

export interface Pkt {
  x: number;
  y: number;
}

export interface Strassenzug {
  punkte: Pkt[];
  /** Volle Breite in Feldern. */
  breite: number;
  art: 'haupt' | 'gasse' | 'kai';
}

export interface NetzOptionen {
  /** Bauland (Ortsumriss oder ein Ufer davon), im Uhrzeigersinn egal. */
  flaeche: Poly;
  /** Mitte des Ortsteils — dort liegt der Markt, wenn es einen gibt. */
  mitte: Pkt;
  /** Richtungen der Ausfallstraßen (Bogenmaß). */
  ausfaelle: number[];
  /** Zusätzliche Ziele, zu denen Hauptstraßen führen (Brücken, Kai). */
  ziele?: Pkt[];
  markt: boolean;
  hauptBreite: number;
  gassenBreite: number;
  hausMin: number;
  hausMax: number;
  hausTiefe: number;
  /** Ringgassen als Anteil der Strecke Mitte–Rand; Bergstadt hat mehrere. */
  ringe: number[];
  /** Wie stark die Hauptstraßen schwingen, 0–1. */
  schwung: number;
  /** Darf hier gebaut oder gegangen werden (Wasser, Kartenrand)? */
  frei: (x: number, y: number) => boolean;
  /** Kartenmaße, für die Belegung. */
  cols: number;
  rows: number;
  /** Vorgegebene Züge (Kai), die mitbelegt und bebaut werden. */
  vorgabe?: Strassenzug[];
}

export interface Netz {
  zuege: Strassenzug[];
  markt: Poly | null;
  haeuser: CityHouse[];
  /** Die großen Häuser am Markt (Kirche, Rathaus) — für die Gebäudearten. */
  amMarkt: number[];
}

// ---------------------------------------------------------------------------

/** Belegung in Vierteln eines Feldes (Straßen und Markt). */
const AUFLOESUNG = 4;
class Raster {
  private z: Uint8Array;
  private b: number;
  private h: number;
  constructor(cols: number, rows: number) {
    this.b = Math.ceil(cols * AUFLOESUNG) + 2;
    this.h = Math.ceil(rows * AUFLOESUNG) + 2;
    this.z = new Uint8Array(this.b * this.h);
  }
  private idx(x: number, y: number): number {
    const c = Math.floor(x * AUFLOESUNG);
    const r = Math.floor(y * AUFLOESUNG);
    if (c < 0 || r < 0 || c >= this.b || r >= this.h) return -1;
    return r * this.b + c;
  }
  belegt(x: number, y: number): boolean {
    const i = this.idx(x, y);
    return i < 0 || this.z[i] !== 0;
  }
  setze(x: number, y: number): void {
    const i = this.idx(x, y);
    if (i >= 0) this.z[i] = 1;
  }
}

/** Abstand eines Punkts zu einer Strecke. */
function abstandStrecke(p: Pkt, a: Pkt, b: Pkt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Geschwungener Zug zwischen zwei Punkten, Stützpunkte etwa alle zwei Felder. */
export function geschwungen(rng: Rng, a: Pkt, b: Pkt, bogen: number, zitter = 0.35): Pkt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hub = rng.range(-bogen, bogen) * len;
  const n = Math.max(2, Math.ceil(len / 2));
  const out: Pkt[] = [];
  let z = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    z = Math.max(-1, Math.min(1, z * 0.6 + rng.range(-zitter, zitter)));
    const bauch = Math.sin(Math.PI * t) * hub + (i > 0 && i < n ? z : 0);
    out.push({ x: a.x + dx * t + nx * bauch, y: a.y + dy * t + ny * bauch });
  }
  return out;
}

/** Wo verlässt ein Strahl aus `m` in Richtung `w` das Polygon? */
function randInRichtung(poly: Poly, m: Pkt, w: number): Pkt {
  const dx = Math.cos(w);
  const dy = Math.sin(w);
  let t = 0;
  for (let schritt = 8; schritt >= 0.25; schritt /= 2) {
    while (imPoly(poly, m.x + dx * (t + schritt), m.y + dy * (t + schritt), 0)) t += schritt;
  }
  return { x: m.x + dx * t, y: m.y + dy * t };
}

/** Punkt bei Anteil `t` entlang eines Zugs. */
function aufZug(z: Pkt[], t: number): Pkt {
  const i = Math.max(0, Math.min(z.length - 1, Math.round(t * (z.length - 1))));
  return z[i];
}

function huelle(p: Poly): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  return [x0, y0, x1, y1];
}

// ---------------------------------------------------------------------------

export function baueNetz(rng: Rng, o: NetzOptionen): Netz {
  const zuege: Strassenzug[] = [...(o.vorgabe ?? [])];
  const belegt = new Raster(o.cols, o.rows);
  const imOrt = (x: number, y: number) => imPoly(o.flaeche, x, y, 0) && o.frei(x, y);

  // --- Markt ---------------------------------------------------------------
  let markt: Poly | null = null;
  let marktRadius = 0;
  if (o.markt) {
    const a = o.hausMax * rng.range(1.2, 1.6);
    const b = o.hausMax * rng.range(0.9, 1.25);
    const dreh = rng.range(0, Math.PI);
    const ecken: Pkt[] = [
      { x: -a, y: -b }, { x: a, y: -b }, { x: a, y: b }, { x: -a, y: b },
    ].map((p) => ({ x: p.x * rng.range(0.8, 1.15), y: p.y * rng.range(0.8, 1.15) }));
    markt = ecken.flatMap((p) => [
      o.mitte.x + p.x * Math.cos(dreh) - p.y * Math.sin(dreh),
      o.mitte.y + p.x * Math.sin(dreh) + p.y * Math.cos(dreh),
    ]);
    marktRadius = Math.max(a, b);
  }

  // --- Hauptstraßen --------------------------------------------------------
  const haupt: Pkt[][] = [];
  const ziele: Pkt[] = [
    ...o.ausfaelle.map((w) => randInRichtung(o.flaeche, o.mitte, w)),
    ...(o.ziele ?? []),
  ];
  for (const ziel of ziele) {
    const w = Math.atan2(ziel.y - o.mitte.y, ziel.x - o.mitte.x);
    const start = { x: o.mitte.x + Math.cos(w) * marktRadius * 0.7, y: o.mitte.y + Math.sin(w) * marktRadius * 0.7 };
    const zug = geschwungen(rng, start, ziel, 0.12 * o.schwung);
    haupt.push(zug);
    zuege.push({ punkte: zug, breite: o.hauptBreite, art: 'haupt' });
  }
  // Nach Winkel ordnen, damit Nachbarn nebeneinander liegen.
  const winkelVon = (z: Pkt[]) => Math.atan2(z[z.length - 1].y - o.mitte.y, z[z.length - 1].x - o.mitte.x);
  const geordnet = [...haupt].sort((p, q) => winkelVon(p) - winkelVon(q));

  // --- Ringgassen ----------------------------------------------------------
  const ringStufen = [0, ...o.ringe, 1];
  for (let ri = 0; ri < o.ringe.length; ri++) {
    const anteil = o.ringe[ri];
    // Platz zum Nachbarring (oder zu Markt und Rand), als Anteil des Radius.
    const luecke = Math.min(anteil - ringStufen[ri], ringStufen[ri + 2] - anteil);
    const mindest = o.hausTiefe * 2 + o.gassenBreite;
    const ring: Array<Pkt | null> = [];
    const schritte = 36;
    let wackel = 0;
    for (let i = 0; i <= schritte; i++) {
      const w = (i / schritte) * Math.PI * 2;
      const rand = randInRichtung(o.flaeche, o.mitte, w);
      wackel = Math.max(-0.08, Math.min(0.08, wackel + rng.range(-0.03, 0.03)));
      const f = anteil + wackel;
      const radial = Math.hypot(rand.x - o.mitte.x, rand.y - o.mitte.y);
      // Wo die Ringe zusammenrücken (nahe der Mitte, an der Küste), passen
      // keine zwei Häuserreihen dazwischen; dort setzt der Ring aus, sonst
      // entsteht ein Bündel paralleler Gassen.
      if (radial * luecke < mindest || Math.hypot(o.mitte.x - (o.mitte.x + (rand.x - o.mitte.x) * f), o.mitte.y - (o.mitte.y + (rand.y - o.mitte.y) * f)) < marktRadius + mindest) {
        ring.push(null);
        continue;
      }
      ring.push({ x: o.mitte.x + (rand.x - o.mitte.x) * f, y: o.mitte.y + (rand.y - o.mitte.y) * f });
    }
    // In zusammenhängende Stücke auf freiem Grund zerlegen.
    let stueck: Pkt[] = [];
    for (const p of ring) {
      if (p && imOrt(p.x, p.y)) stueck.push(p);
      else {
        if (stueck.length >= 3) zuege.push({ punkte: stueck, breite: o.gassenBreite, art: 'gasse' });
        stueck = [];
      }
    }
    if (stueck.length >= 3) zuege.push({ punkte: stueck, breite: o.gassenBreite, art: 'gasse' });
  }

  // --- Speichengassen zwischen den Ringen -----------------------------------
  // Ohne sie bleibt zwischen zwei Ringen ein langer Streifen, in dessen Mitte
  // kein Haus an eine Straße grenzt. Abstand entlang des Rings: einige Häuser.
  const stufen = [marktRadius > 0 ? 0 : 0.12, ...o.ringe, 1];
  const hauptWinkel = haupt.map(winkelVon);
  // Vom Markt selbst gehen schon die Hauptstraßen ab; dort keine Speichen.
  for (let k = marktRadius > 0 ? 1 : 0; k + 1 < stufen.length; k++) {
    const innen = stufen[k];
    const aussen = stufen[k + 1];
    const umfang = Math.PI * 2 * aussen * Math.max(...ziele.map((z) => Math.hypot(z.x - o.mitte.x, z.y - o.mitte.y)), 1);
    const n = Math.max(0, Math.floor(umfang / (o.hausMax * 9)));
    const versatz = rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const w = versatz + (i / n) * Math.PI * 2 + rng.range(-0.1, 0.1);
      // Nicht direkt neben einer Hauptstraße.
      const naechste = Math.min(...hauptWinkel.map((h) => Math.abs(Math.atan2(Math.sin(w - h), Math.cos(w - h)))));
      if (naechste < 0.18) continue;
      const rand = randInRichtung(o.flaeche, o.mitte, w);
      const f0 = Math.max(innen, marktRadius / Math.max(1, Math.hypot(rand.x - o.mitte.x, rand.y - o.mitte.y)));
      const p0 = { x: o.mitte.x + (rand.x - o.mitte.x) * f0, y: o.mitte.y + (rand.y - o.mitte.y) * f0 };
      const p1 = { x: o.mitte.x + (rand.x - o.mitte.x) * (aussen - 0.02), y: o.mitte.y + (rand.y - o.mitte.y) * (aussen - 0.02) };
      const zug = geschwungen(rng, p0, p1, 0.1 * o.schwung, 0.2).filter((p) => imOrt(p.x, p.y));
      if (zug.length >= 3) zuege.push({ punkte: zug, breite: o.gassenBreite, art: 'gasse' });
    }
  }

  // --- Quergassen zwischen benachbarten Hauptstraßen -----------------------
  for (let i = 0; i < geordnet.length && geordnet.length > 1; i++) {
    const a = geordnet[i];
    const b = geordnet[(i + 1) % geordnet.length];
    for (const t of [rng.range(0.3, 0.45), rng.range(0.7, 0.85)]) {
      if (!rng.bool(0.4)) continue;
      const pa = aufZug(a, t);
      const pb = aufZug(b, t + rng.range(-0.1, 0.1));
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > o.hausMax * 9) continue;
      const zug = geschwungen(rng, pa, pb, 0.18, 0.25).filter((p) => imOrt(p.x, p.y));
      if (zug.length >= 3) zuege.push({ punkte: zug, breite: o.gassenBreite, art: 'gasse' });
    }
  }

  // --- Stichgassen ----------------------------------------------------------
  for (const z of haupt) {
    for (let k = 0; k < 2; k++) {
      if (!rng.bool(0.3)) continue;
      const i = rng.int(2, Math.max(2, z.length - 3));
      const p = z[i];
      const q = z[Math.min(z.length - 1, i + 1)];
      const d = Math.atan2(q.y - p.y, q.x - p.x) + (rng.bool() ? 1 : -1) * (Math.PI / 2 + rng.range(-0.3, 0.3));
      const laenge = o.hausTiefe * rng.range(2, 3.5);
      const ende = { x: p.x + Math.cos(d) * laenge, y: p.y + Math.sin(d) * laenge };
      const zug = geschwungen(rng, p, ende, 0.1, 0.2).filter((x) => imOrt(x.x, x.y));
      if (zug.length >= 2) zuege.push({ punkte: zug, breite: o.gassenBreite, art: 'gasse' });
    }
  }

  // --- Straßen und Markt belegen ---------------------------------------------
  const belegeZug = (z: Strassenzug) => {
    const halb = z.breite / 2;
    const q = 1 / AUFLOESUNG;
    for (let i = 0; i + 1 < z.punkte.length; i++) {
      const a = z.punkte[i];
      const b = z.punkte[i + 1];
      const x0 = Math.min(a.x, b.x) - halb;
      const x1 = Math.max(a.x, b.x) + halb;
      const y0 = Math.min(a.y, b.y) - halb;
      const y1 = Math.max(a.y, b.y) + halb;
      for (let y = Math.floor(y0 * AUFLOESUNG) * q; y <= y1; y += q) {
        for (let x = Math.floor(x0 * AUFLOESUNG) * q; x <= x1; x += q) {
          if (abstandStrecke({ x: x + q / 2, y: y + q / 2 }, a, b) <= halb) belegt.setze(x + q / 2, y + q / 2);
        }
      }
    }
  };
  for (const z of zuege) belegeZug(z);
  if (markt) {
    const q = 1 / AUFLOESUNG;
    for (let y = 0; y < o.rows; y += q) {
      for (let x = 0; x < o.cols; x += q) if (imPoly(markt, x + q / 2, y + q / 2, -0.1)) belegt.setze(x + q / 2, y + q / 2);
    }
  }

  // --- Häuser an den Straßen ------------------------------------------------
  const haeuser: CityHouse[] = [];
  const boxen: Array<[number, number, number, number]> = [];
  const amMarkt: number[] = [];

  /**
   * Versucht ein Haus mit der Front an Punkt `f` (Mitte der Front), Richtung
   * `d` (entlang der Straße) und Normale `n` (von der Straße weg).
   */
  const setzeHaus = (f: Pkt, dx: number, dy: number, nx: number, ny: number, breite: number, tiefe: number): boolean => {
    const ecken: Pkt[] = [
      { x: f.x - dx * breite / 2, y: f.y - dy * breite / 2 },
      { x: f.x + dx * breite / 2, y: f.y + dy * breite / 2 },
      { x: f.x + dx * breite / 2 + nx * tiefe, y: f.y + dy * breite / 2 + ny * tiefe },
      { x: f.x - dx * breite / 2 + nx * tiefe, y: f.y - dy * breite / 2 + ny * tiefe },
    ];
    // Proben im Innern, alle halbe Felder.
    const proben: Pkt[] = [];
    for (let u = 0.1; u <= breite - 0.1 + 1e-6; u += 0.3) {
      for (let v = 0.1; v <= tiefe - 0.1 + 1e-6; v += 0.3) {
        proben.push({ x: ecken[0].x + dx * u + nx * v, y: ecken[0].y + dy * u + ny * v });
      }
    }
    for (const p of proben) if (belegt.belegt(p.x, p.y) || !imOrt(p.x, p.y)) return false;
    // Die Proben sind grob; schräge Nachbarn können sich an den Ecken
    // dazwischen schneiden. Deshalb zusätzlich exakt gegen die Nachbarn.
    const poly = ecken.flatMap((p) => [p.x, p.y]);
    const box = huelle(poly);
    for (let i = 0; i < haeuser.length; i++) {
      const b = boxen[i];
      if (b[0] >= box[2] || b[2] <= box[0] || b[1] >= box[3] || b[3] <= box[1]) continue;
      if (ueberlappen(poly, haeuser[i].points)) return false;
    }
    boxen.push(box);
    const tuer = Math.min(1, breite - 0.6);
    haeuser.push({
      points: ecken.flatMap((p) => [p.x, p.y]),
      door: [f.x - dx * tuer / 2, f.y - dy * tuer / 2, f.x + dx * tuer / 2, f.y + dy * tuer / 2],
    });
    return true;
  };

  /** Beide Straßenseiten entlanggehen und Haus an Haus setzen. */
  const reihe = (punkte: Pkt[], abstand: number, gross = false) => {
    for (const seite of [1, -1]) {
      let rest = rng.range(0, 1.5);
      for (let i = 0; i + 1 < punkte.length; i++) {
        const a = punkte[i];
        const b = punkte[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1e-6) continue;
        const dx = (b.x - a.x) / len;
        const dy = (b.y - a.y) / len;
        const nx = -dy * seite;
        const ny = dx * seite;
        let pos = rest;
        while (pos < len) {
          const breite = gross ? o.hausMax * rng.range(1.2, 1.6) : rng.range(o.hausMin, o.hausMax);
          const tiefe = gross ? o.hausTiefe * rng.range(1.4, 1.9) : o.hausTiefe * rng.range(0.85, 1.25);
          const m = pos + breite / 2;
          const f = { x: a.x + dx * m + nx * abstand, y: a.y + dy * m + ny * abstand };
          if (setzeHaus(f, dx, dy, nx, ny, breite, tiefe)) {
            if (gross) amMarkt.push(haeuser.length - 1);
            // Meist Wand an Wand, manchmal eine schmale Durchfahrt.
            pos += breite + (rng.bool(0.15) ? rng.range(0.8, 1.5) : 0.02);
          } else {
            pos += 0.25;
          }
        }
        rest = pos - len;
      }
    }
  };

  // Zuerst um den Markt: die großen Häuser (Kirche, Rathaus, Gasthaus).
  if (markt) {
    const rundum: Pkt[] = [];
    for (let i = 0; i <= 4; i++) rundum.push({ x: markt[(i % 4) * 2], y: markt[(i % 4) * 2 + 1] });
    // Außen liegt links oder rechts, je nach Umlaufsinn; `reihe` probiert beide.
    reihe(rundum, 0.3, true);
    reihe(rundum, 0.3);
  }
  for (const z of zuege.filter((z) => z.art === 'haupt' || z.art === 'kai')) reihe(z.punkte, z.breite / 2 + 0.3);
  for (const z of zuege.filter((z) => z.art === 'gasse')) reihe(z.punkte, z.breite / 2 + 0.3);

  return { zuege, markt, haeuser, amMarkt };
}
