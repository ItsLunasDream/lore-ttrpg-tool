/**
 * Stadt- und Dorf-Generator.
 *
 * Anders als beim Dungeon ist hier der Zwischenraum das Wichtige: Gebäude sind
 * geschlossene Blöcke, begangen wird die Straße dazwischen. Der Grundriss
 * entsteht deshalb umgekehrt — erst das Straßennetz, dann die Häuser in die
 * verbleibenden Blöcke.
 *
 * Das Teilen selbst steht in `cityPlan.ts` und arbeitet in Polygonen, nicht in
 * Rechtecken: Straßen laufen deshalb nicht alle parallel, Blöcke sind schief,
 * und ein Teil bleibt als Platz frei. Hier steht, was die Form ausmacht — wo
 * der Ort aufhört, wo Wasser ist, wo Ausfallstraßen und Tore sitzen — und wie
 * aus dem Plan Flächen, Wände und Türen werden.
 *
 * Die Häuser bekommen eigene Wandringe: in Foundry soll man nicht durch eine
 * Hauswand sehen, und Plätze bleiben frei begehbar.
 */

import { Rng } from '../rng';
import { strokeBand } from '../geometry';
import {
  centroid,
  clipHalf,
  convexHull,
  imPoly,
  orient,
  polyArea,
  type CityHouse,
  type Poly,
} from './cityPlan';
import { CellGrid } from './grid';
import { assignBuildingKinds, HOUSE_KIND } from './buildingKinds';
import { baueNetz, type Pkt, type Strassenzug } from './stadtNetz';
import { emptyResult, type BaseOptions, type GeneratedMap } from './types';

/**
 * Grundform der Siedlung.
 *
 * `grid` ist der gewachsene Ort am Straßenkreuz, `round` die ummauerte Stadt
 * mit sternförmigen Hauptstraßen, `river` das Dorf an einem Ufer. Mehr Formen
 * wären schnell beliebig; diese drei decken ab, was auf einer Karte vorkommt.
 */
export type TownShape = 'grid' | 'round' | 'river' | 'harbor' | 'hill';
export const TOWN_SHAPES: TownShape[] = ['grid', 'round', 'river', 'harbor', 'hill'];

/** Womit der Rand um die Siedlung gefüllt wird. */
export type TownSurround = 'none' | 'meadow' | 'forest' | 'water';
export const TOWN_SURROUNDS: TownSurround[] = ['none', 'meadow', 'forest', 'water'];

export interface TownOptions extends BaseOptions {
  /** Angestrebte Zahl Gebäude. Klein = Dorf, groß = Stadt. */
  buildingCount: number;
  buildingMin: number;
  buildingMax: number;
  /** Straßenbreite in Tiles. */
  streetWidth: number;
  /** Marktplatz in der Mitte. */
  market: boolean;
  /** Umlaufende Stadtmauer mit Toren. */
  cityWall: boolean;
  decorate: boolean;
  shape: TownShape;
  /**
   * Freier Rand um die Siedlung, in Tiles.
   *
   * Ohne Rand endet der Ort an der Bildkante, als wäre er abgeschnitten. Mit
   * Rand liegt er *in* einer Landschaft — und die lässt sich füllen.
   */
  margin: number;
  surround: TownSurround;
  /**
   * Übersichtskarte der ganzen Stadt (Rückmeldung C): kleine Häuser, schmale
   * Gassen, keine VTT-Wände je Haus — bei Hunderten Häusern wären das
   * Tausende Wände, die auf einer Übersicht niemand braucht.
   */
  uebersicht?: boolean;
}

export function defaultTownOptions(): Omit<TownOptions, 'seed' | 'tileSize'> {
  return {
    cols: 64,
    rows: 48,
    buildingCount: 60,
    buildingMin: 3,
    buildingMax: 6,
    streetWidth: 3,
    market: true,
    cityWall: false,
    decorate: true,
    shape: 'grid',
    // Schmal: der Ort soll die Karte füllen. Mit vier Feldern Rand und einer
    // zusätzlich geschrumpften Ortsfläche nahm der Rand ein Viertel des Bildes
    // ein; so ist es rund ein Zehntel.
    margin: 1,
    surround: 'meadow',
  };
}

/**
 * Die Häuser bestimmen ihre Größe, nicht die Fläche.
 *
 * Der Ort füllt immer die Karte — nur so bleibt der Rand schmal. Die gewünschte
 * Hauszahl wird deshalb über den *Maßstab* getroffen: kleine Häuser und schmale
 * Gassen für eine Stadt, große Höfe und breite Wege für ein Dorf. Gesucht wird
 * binär, weil die Zahl mit dem Maßstab fällt; fünf Anläufe genügen.
 */
const MASSSTAEBE = Array.from({ length: 24 }, (_, i) => 0.45 * 1.11 ** i);

export function generateTown(opts: TownOptions): GeneratedMap {
  if (opts.uebersicht) return ortBauen(opts, 1, Infinity).map;
  const ziel = Math.max(1, opts.buildingCount);
  const versuche = new Map<number, { map: GeneratedMap; gebaut: number }>();
  const bauen = (i: number) => {
    const da = versuche.get(i);
    if (da) return da;
    const neu = ortBauen(opts, MASSSTAEBE[i], ziel);
    versuche.set(i, neu);
    return neu;
  };

  // Der größte Maßstab, der noch genug Häuser trägt.
  let lo = 0;
  let hi = MASSSTAEBE.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bauen(mid).gebaut >= ziel) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return bauen(best).map;
}

/** Radius eines Rechtecks in Richtung `w`, von der Mitte aus. */
function radiusRechteck(w: number, a: number, b: number): number {
  const c = Math.abs(Math.cos(w));
  const s = Math.abs(Math.sin(w));
  return Math.min(c < 1e-6 ? Infinity : a / c, s < 1e-6 ? Infinity : b / s);
}

/** Radius einer Ellipse in Richtung `w`. */
function radiusEllipse(w: number, a: number, b: number): number {
  return 1 / Math.hypot(Math.cos(w) / a, Math.sin(w) / b);
}

/**
 * Wo trifft ein Strahl aus `(cx,cy)` das konvexe Polygon, und wie liegt dort
 * die Kante? Für Tore: das Tor muss *in* der Mauer liegen, nicht quer dazu.
 */
/**
 * Wie viele Ringgassen passen zwischen Markt und Rand? Zwischen zwei Gassen
 * sollen zwei Häuserreihen Rücken an Rücken stehen, mehr nicht — sonst bleibt
 * innen Land, das an keine Straße grenzt.
 */
function ringeFuer(teil: Poly, mitte: { x: number; y: number }, breite: number, tiefe: number, berg: boolean): number[] {
  if (berg) return [0.3, 0.55, 0.8];
  let summe = 0;
  for (let i = 0; i < teil.length; i += 2) summe += Math.hypot(teil[i] - mitte.x, teil[i + 1] - mitte.y);
  const radius = summe / (teil.length / 2);
  const abstand = tiefe * 2.6 + breite * 0.8;
  const n = Math.max(1, Math.round(radius / abstand) - 1);
  return Array.from({ length: n }, (_, i) => (i + 1) / (n + 1) + 0.04);
}

function strahlAufPoly(
  poly: number[],
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): { x: number; y: number; ex: number; ey: number } | null {
  const n = poly.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = poly[i * 2];
    const ay = poly[i * 2 + 1];
    const ex = poly[j * 2] - ax;
    const ey = poly[j * 2 + 1] - ay;
    const nenner = dx * ey - dy * ex;
    if (Math.abs(nenner) < 1e-9) continue;
    const t = ((ax - cx) * ey - (ay - cy) * ex) / nenner;
    const u = ((ax - cx) * dy - (ay - cy) * dx) / nenner;
    if (t <= 0 || u < 0 || u > 1) continue;
    const len = Math.hypot(ex, ey) || 1;
    return { x: cx + dx * t, y: cy + dy * t, ex: ex / len, ey: ey / len };
  }
  return null;
}

/** Wo trifft ein Strahl aus `(cx,cy)` das Rechteck? */
function strahlAufRechteck(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number] {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (x1 - cx) / dx);
  if (dx < -1e-9) t = Math.min(t, (x0 - cx) / dx);
  if (dy > 1e-9) t = Math.min(t, (y1 - cy) / dy);
  if (dy < -1e-9) t = Math.min(t, (y0 - cy) / dy);
  return [cx + dx * t, cy + dy * t];
}

function ortBauen(
  opts: TownOptions,
  massstab: number,
  ziel: number,
): { map: GeneratedMap; gebaut: number } {
  const rng = new Rng(opts.seed);
  const ergebnis = emptyResult(opts.cols, opts.rows);
  const s = opts.tileSize;

  const klein = !!opts.uebersicht;
  // Halbe Felder genügen als Raster: ganze Felder ließen zwischen 2 und 3
  // keinen Zwischenschritt, und die große Stadt fand keinen passenden Maßstab.
  const halb = (v: number) => Math.round(v * 2) / 2;
  const hausMin = klein ? 0.9 : Math.max(1.5, halb(opts.buildingMin * massstab));
  const hausMax = klein ? 2.2 : Math.max(hausMin + 1, halb(opts.buildingMax * massstab));
  // Tiefer als breit sähe ein Haus aus wie ein Turm; flacher als zwei Felder
  // wäre es ein Gang.
  const hausTiefe = klein ? 1.3 : Math.max(2, Math.round(((hausMin + hausMax) / 2) * 0.62));
  // Straßen wachsen mit, aber gedämpft: in einer Stadt aus dreihundert Häusern
  // sollen die Gassen eng sein, im Dorf der Weg trotzdem befahrbar.
  const strassenBreite = klein ? 1.4 : Math.max(2, opts.streetWidth * Math.min(1.3, Math.max(0.8, massstab)));

  const rand = (opts.cityWall ? 3 : 1) + Math.max(0, Math.round(opts.margin));
  const flaecheW = opts.cols - rand * 2;
  const flaecheH = opts.rows - rand * 2;
  const mx = rand + flaecheW / 2;
  const my = rand + flaecheH / 2;

  const flaeche = (points: number[], color: number) => {
    ergebnis.floors.push({ points: points.map((v) => v * s), color });
  };

  // --- Rand ----------------------------------------------------------------
  /**
   * Die Landschaft, in der der Ort liegt — zuerst und über die *ganze* Karte.
   * Der Ortsgrund wird gleich darübergelegt; nur den Ring zu füllen ließe in
   * der Mitte ein Loch, das bei runden Formen sichtbar wäre.
   */
  if (opts.margin > 0 && opts.surround !== 'none') {
    const grund = { meadow: 0x5f7043, forest: 0x40522f, water: 0x3d6b7d }[opts.surround];
    flaeche([0, 0, opts.cols, 0, opts.cols, opts.rows, 0, opts.rows], grund);
  }

  // --- Umriss --------------------------------------------------------------
  /**
   * Kein Rechteck und kein Kreis, sondern beides verwackelt.
   *
   * Ein Ort mit gerader Kante sieht gestanzt aus. Die Radien werden deshalb
   * einzeln verkürzt und das Ergebnis zur konvexen Hülle zusammengefasst —
   * unregelmäßig, aber konvex, worauf die Teilung angewiesen ist.
   */
  const ecken = opts.shape === 'round' ? 18 : 13;
  const rohPunkte: number[] = [];
  for (let i = 0; i < ecken; i++) {
    const w = (i / ecken) * Math.PI * 2 + rng.range(-0.07, 0.07);
    const rMax =
      opts.shape === 'round'
        ? radiusEllipse(w, flaecheW / 2, flaecheH / 2)
        : radiusRechteck(w, flaecheW / 2, flaecheH / 2);
    // Nur leicht verkürzt: der Rand um den Ort soll rund ein Zehntel der
    // Karte ausmachen, nicht ein Viertel.
    const f = opts.shape === 'round' ? rng.range(0.94, 1) : rng.range(0.94, 1);
    rohPunkte.push(mx + Math.cos(w) * rMax * f, my + Math.sin(w) * rMax * f);
  }
  const outline = orient(convexHull(rohPunkte));
  // Der Ortsgrund zuerst: Wasser, Pflaster und Häuser kommen darüber. Lag er
  // hinter dem Flussabschnitt, deckte er den Fluss innerhalb des Ortes wieder
  // zu — sichtbar blieb er nur draußen auf der Wiese.
  flaeche(outline, 0x6d6252);

  const strasse = new CellGrid(opts.cols, opts.rows);
  const gesperrt = new CellGrid(opts.cols, opts.rows);

  /** Ein konvexes Polygon in eine Maske rastern. */
  const rastern = (poly: Poly, maske: CellGrid) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < poly.length; i += 2) {
      x0 = Math.min(x0, poly[i]);
      x1 = Math.max(x1, poly[i]);
      y0 = Math.min(y0, poly[i + 1]);
      y1 = Math.max(y1, poly[i + 1]);
    }
    for (let r = Math.floor(y0); r <= Math.ceil(y1); r++) {
      for (let c = Math.floor(x0); c <= Math.ceil(x1); c++) {
        if (imPoly(poly, c + 0.5, r + 0.5, -0.6)) maske.set(c, r, 1);
      }
    }
  };

  /** Ein Band als Fläche zeichnen und in eine Maske rastern. */
  const bandMalen = (punkte: number[], breite: number, color: number, maske: CellGrid) => {
    ergebnis.floors.push({
      points: strokeBand(
        punkte.map((v) => v * s),
        (breite / 2) * s,
      ),
      color,
    });
    const halb = breite / 2;
    for (let i = 0; i + 3 < punkte.length; i += 2) {
      const ax = punkte[i];
      const ay = punkte[i + 1];
      const bx = punkte[i + 2];
      const by = punkte[i + 3];
      const schritte = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1;
      for (let k = 0; k <= schritte; k++) {
        const x = ax + ((bx - ax) * k) / schritte;
        const y = ay + ((by - ay) * k) / schritte;
        for (let dr = -Math.ceil(halb); dr <= Math.ceil(halb); dr++) {
          for (let dc = -Math.ceil(halb); dc <= Math.ceil(halb); dc++) {
            if (dc * dc + dr * dr > halb * halb) continue;
            maske.set(Math.round(x) + dc, Math.round(y) + dr, 1);
          }
        }
      }
    }
  };

  // --- Wasser --------------------------------------------------------------
  /**
   * Der Fluss teilt den Ort, bevor irgendetwas anderes geschieht.
   *
   * Er läuft schräg, nicht senkrecht — schon das bricht die Parallelität des
   * ganzen Grundrisses. Geschnitten wird an einer *geraden* Mittellinie, damit
   * beide Ufer konvex bleiben; gezeichnet wird darum herum leicht mäandernd,
   * mit Spiel genug, dass das Wasser im Schnittband bleibt.
   */
  const teilflaechen: Poly[] = [];
  const brueckenMitten: Array<[number, number]> = [];
  /** Zusätzliche Straßenzüge vor dem Netz (der Kai der Hafenstadt). */
  const vorgabeZuege: Strassenzug[] = [];
  /** Richtung, in der das Meer liegt (Hafenstadt); Ausfälle zeigen davon weg. */
  let meerRichtung: number | null = null;

  if (opts.shape === 'river') {
    const lauf = Math.PI / 2 + rng.range(-0.55, 0.55);
    const dx = Math.cos(lauf);
    const dy = Math.sin(lauf);
    const nx = -dy;
    const ny = dx;
    /**
     * Der Fluss liegt nicht zwangsläufig mittig — aber Schnitt und Zeichnung
     * müssen denselben Versatz kennen. Solange der Versatz nur in `mitte`
     * steckte, lagen Ufer und Brücken um bis zu acht Felder *neben* dem Wasser.
     */
    const versatz = rng.range(-flaecheW * 0.14, flaecheW * 0.14);
    const ox = mx + nx * versatz;
    const oy = my + ny * versatz;
    const mitte = ox * nx + oy * ny;
    const wasser = rng.range(2.6, 4.4);
    const ufer = Math.max(2, strassenBreite * 0.8);
    const halb = wasser / 2 + ufer;

    // Mittellinie über die ganze Karte hinaus, damit der Fluss nicht im Bild
    // anfängt.
    const laenge = opts.cols + opts.rows;
    const mittelLinie: number[] = [];
    for (let t = -laenge / 2; t <= laenge / 2; t += 4) {
      const seit = rng.range(-1, 1);
      mittelLinie.push(ox + dx * t + nx * seit, oy + dy * t + ny * seit);
    }

    // Ufer als Pflaster: der Streifen zwischen Wasser und Bauland.
    const karte = [0, 0, opts.cols, 0, opts.cols, opts.rows, 0, opts.rows];
    for (const seite of [-1, 1]) {
      const streifen = clipHalf(
        clipHalf(orient(karte), nx * seite, ny * seite, (mitte + halb * seite) * seite),
        -nx * seite,
        -ny * seite,
        -(mitte + (wasser / 2) * seite) * seite,
      );
      if (streifen.length >= 6) {
        flaeche(streifen, 0x8b8175);
        rastern(streifen, strasse);
      }
    }

    bandMalen(mittelLinie, wasser, 0x3d6b7d, gesperrt);
    // Etwas Uferluft in der Maske, damit kein Haus die Böschung berührt.
    bandMalen(mittelLinie, wasser + 1.4, 0x3d6b7d, gesperrt);

    const links = clipHalf(outline, nx, ny, mitte - halb);
    const rechts = clipHalf(outline, -nx, -ny, -(mitte + halb));
    for (const teil of [links, rechts]) if (polyArea(teil) > 4) teilflaechen.push(teil);

    // Brücken — ohne sie wären die Ufer zwei Orte.
    const bruecken = rng.int(1, 2);
    for (let i = 0; i < bruecken; i++) {
      const t = (i + 1) / (bruecken + 1) + rng.range(-0.12, 0.12);
      const pos = ox * dx + oy * dy + (t - 0.5) * flaecheH;
      const bruecke = clipHalf(
        clipHalf(
          clipHalf(clipHalf(orient(karte), dx, dy, pos + strassenBreite / 2), -dx, -dy, -(pos - strassenBreite / 2)),
          nx,
          ny,
          mitte + halb + 1,
        ),
        -nx,
        -ny,
        -(mitte - halb - 1),
      );
      if (bruecke.length >= 6) {
        brueckenMitten.push(centroid(bruecke));
        flaeche(bruecke, 0x8b8175);
        rastern(bruecke, strasse);
        // Über dem Wasser ist die Brücke begehbar.
        for (let r = 0; r < opts.rows; r++)
          for (let c = 0; c < opts.cols; c++)
            if (imPoly(bruecke, c + 0.5, r + 0.5, -0.6)) gesperrt.set(c, r, 0);
      }
    }
  } else if (opts.shape === 'harbor') {
    /**
     * Hafenstadt: eine Seite des Ortes liegt am Wasser. Die Küste läuft
     * leicht schräg, am Ufer entlang der Kai, von ihm aus Anleger ins
     * Wasser. Die Häuser stehen mit der Front zum Kai.
     */
    const w = rng.int(0, 3) * (Math.PI / 2) + rng.range(-0.25, 0.25);
    meerRichtung = w;
    const nx = Math.cos(w);
    const ny = Math.sin(w);
    // Küstenlinie: gut ein Drittel der Ortsbreite von der Mitte zum Wasser hin.
    const ausdehnung = Math.abs(nx) * flaecheW / 2 + Math.abs(ny) * flaecheH / 2;
    const kueste = mx * nx + my * ny + ausdehnung * rng.range(0.25, 0.4);
    const karte = [0, 0, opts.cols, 0, opts.cols, opts.rows, 0, opts.rows];
    const meer = clipHalf(orient(karte), -nx, -ny, -kueste);
    flaeche(meer, 0x3d6b7d);
    rastern(meer, gesperrt);
    const kaiBreite = Math.max(2, strassenBreite);
    const land = clipHalf(outline, nx, ny, kueste - kaiBreite);
    if (polyArea(land) > 4) teilflaechen.push(land);
    // Kai als Straßenzug an der Küste entlang.
    const tx = -ny;
    const ty = nx;
    const kaiLinie = kueste - kaiBreite / 2;
    const laengs = Math.abs(tx) * opts.cols + Math.abs(ty) * opts.rows;
    const laengsMitte = mx * tx + my * ty;
    const kai: Pkt[] = [];
    for (let t = -laengs; t <= laengs; t += 2) {
      // Punkt auf der Geraden n·p = kaiLinie, entlang der Küste verschoben.
      const x = nx * kaiLinie + tx * (laengsMitte + t);
      const y = ny * kaiLinie + ty * (laengsMitte + t);
      if (x >= -1 && y >= -1 && x <= opts.cols + 1 && y <= opts.rows + 1) kai.push({ x, y });
    }
    if (kai.length >= 2) vorgabeZuege.push({ punkte: kai, breite: kaiBreite, art: 'kai' });
    // Anleger: Holzstege ins Wasser, mit Booten und Poller.
    const anleger = rng.int(2, 4);
    for (let i = 0; i < anleger && kai.length > 4; i++) {
      const p = kai[Math.floor(((i + 0.5 + rng.range(-0.2, 0.2)) / anleger) * (kai.length - 1))];
      const laenge = rng.range(4, 8);
      const b = 1.4;
      const steg = [
        p.x + tx * -b / 2, p.y + ty * -b / 2,
        p.x + tx * b / 2, p.y + ty * b / 2,
        p.x + tx * b / 2 + nx * laenge, p.y + ty * b / 2 + ny * laenge,
        p.x + tx * -b / 2 + nx * laenge, p.y + ty * -b / 2 + ny * laenge,
      ];
      flaeche(steg, 0x7a5c3a);
      rastern(steg, strasse);
      for (let r = 0; r < opts.rows; r++)
        for (let c = 0; c < opts.cols; c++) if (imPoly(steg, c + 0.5, r + 0.5, -0.6)) gesperrt.set(c, r, 0);
      if (opts.decorate) {
        const seite = rng.bool() ? 1 : -1;
        ergebnis.props.push({ propId: 'rowboat', x: (p.x + tx * seite * 1.6 + nx * laenge * 0.6) * s, y: (p.y + ty * seite * 1.6 + ny * laenge * 0.6) * s, scale: rng.range(0.9, 1.1), rotation: w });
        ergebnis.props.push({ propId: 'mooring_post', x: (p.x + tx * seite * 0.6 + nx * laenge * 0.9) * s, y: (p.y + ty * seite * 0.6 + ny * laenge * 0.9) * s, scale: 0.8, rotation: 0 });
        for (const id of ['crate', 'barrel', 'fishing_net']) {
          if (rng.bool(0.6)) ergebnis.props.push({ propId: id, x: (p.x + tx * rng.range(-2, 2) - nx * 0.6) * s, y: (p.y + ty * rng.range(-2, 2) - ny * 0.6) * s, scale: rng.range(0.7, 0.9), rotation: rng.range(0, Math.PI) });
        }
      }
    }
  } else {
    teilflaechen.push(outline);
  }

  /**
   * Bergstadt: der Ort liegt auf einem Hügel. Hellere Ringe deuten die Höhe
   * an, oben steht eine Burg mit Hof; die Gassen laufen in Ringen um den Berg.
   */
  if (opts.shape === 'hill') {
    for (const [f, farbe] of [[0.72, 0x756a59], [0.46, 0x7e735f], [0.22, 0x877b66]] as Array<[number, number]>) {
      const ring: number[] = [];
      for (let i = 0; i < 24; i++) {
        const w = (i / 24) * Math.PI * 2;
        const rr = f * rng.range(0.94, 1.04);
        ring.push(mx + Math.cos(w) * (flaecheW / 2) * rr, my + Math.sin(w) * (flaecheH / 2) * rr);
      }
      flaeche(ring, farbe);
    }
  }

  // --- Grundriss -----------------------------------------------------------

  // --- Straßennetz und Häuser (stadtNetz.ts) --------------------------------
  const zuege: Strassenzug[] = [...vorgabeZuege];
  const plaetze: Poly[] = [];
  let markt: Poly | null = null;
  let haeuser: CityHouse[] = [];
  let marktHaeuser: CityHouse[] = [];
  const ausfaelle: number[] = [];
  let ortsMitte: Pkt = { x: mx, y: my };
  const frei = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < opts.cols && y < opts.rows && !gesperrt.filled(Math.floor(x), Math.floor(y));

  // Der größte Teil bekommt den Markt.
  const groesster = teilflaechen.reduce((a, b) => (polyArea(b) > polyArea(a) ? b : a), teilflaechen[0] ?? outline);
  teilflaechen.forEach((teil) => {
    const [cx, cy] = centroid(teil);
    // Die Mitte zur Kartenmitte hin, sonst liegt der Markt am Ufer.
    let mitte: Pkt = teil === groesster ? { x: (cx * 2 + mx) / 3, y: (cy * 2 + my) / 3 } : { x: cx, y: cy };
    // Der Markt der Hafenstadt liegt zum Wasser hin, der Handel kommt übers Meer.
    if (meerRichtung !== null) {
      const zumKai = Math.max(flaecheW, flaecheH) * 0.12;
      mitte = { x: mitte.x + Math.cos(meerRichtung) * zumKai, y: mitte.y + Math.sin(meerRichtung) * zumKai };
    }
    if (teil === groesster) ortsMitte = mitte;
    const anzahl = opts.shape === 'hill' ? rng.int(2, 3) : teilflaechen.length > 1 ? rng.int(2, 3) : rng.int(3, 5);
    const basis = rng.range(0, Math.PI * 2);
    const richtungen: number[] = [];
    for (let i = 0; i < anzahl; i++) {
      let w = basis + (i / anzahl) * Math.PI * 2 + rng.range(-0.35, 0.35);
      // In der Hafenstadt führen die Ausfälle landeinwärts.
      if (meerRichtung !== null) {
        const gegen = meerRichtung + Math.PI;
        w = gegen + ((i + 0.5) / anzahl - 0.5) * Math.PI * 1.3;
      }
      richtungen.push(w);
    }
    const ziele: Pkt[] = brueckenMitten
      .filter(([bx, by]) => Math.hypot(bx - cx, by - cy) < Math.max(flaecheW, flaecheH))
      .map(([bx, by]) => ({ x: bx, y: by }));
    if (vorgabeZuege.length > 0) {
      // Vom Markt eine oder zwei Straßen hinunter zum Kai.
      const kai = vorgabeZuege[0].punkte;
      for (let i = 0; i < rng.int(1, 2); i++) ziele.push(kai[Math.floor(kai.length * rng.range(0.3, 0.7))]);
    }
    const netz = baueNetz(rng, {
      flaeche: teil,
      mitte,
      ausfaelle: richtungen,
      ziele,
      markt: opts.market && teil === groesster,
      hauptBreite: strassenBreite,
      gassenBreite: Math.max(klein ? 1 : 1.6, strassenBreite * 0.7),
      hausMin,
      hausMax,
      hausTiefe,
      ringe: ringeFuer(teil, mitte, strassenBreite, hausTiefe, opts.shape === 'hill'),
      schwung: opts.shape === 'hill' ? 1.6 : opts.shape === 'grid' ? 0.5 : 1,
      frei,
      cols: opts.cols,
      rows: opts.rows,
      vorgabe: teil === groesster ? vorgabeZuege : [],
    });
    zuege.push(...netz.zuege.filter((z) => !vorgabeZuege.includes(z)));
    haeuser.push(...netz.haeuser);
    marktHaeuser.push(...netz.amMarkt.map((i) => netz.haeuser[i]));
    if (netz.markt) {
      markt = netz.markt;
      plaetze.push(netz.markt);
    }
    ausfaelle.push(...richtungen.map((w) => w));
    // Ausfallstraßen vom Ortsrand bis zur Kartenkante.
    for (const w of richtungen) {
      let t = 0;
      while (imPoly(teil, mitte.x + Math.cos(w) * (t + 0.5), mitte.y + Math.sin(w) * (t + 0.5), 0)) t += 0.5;
      const rx = mitte.x + Math.cos(w) * t;
      const ry = mitte.y + Math.sin(w) * t;
      const [zx, zy] = strahlAufRechteck(rx, ry, Math.cos(w), Math.sin(w), 0, 0, opts.cols, opts.rows);
      zuege.push({ punkte: [{ x: rx, y: ry }, { x: zx, y: zy }], breite: strassenBreite, art: 'haupt' });
    }
  });

  // --- Häuser auf die Zielzahl bringen -------------------------------------
  const gebaut = haeuser.length;
  if (gebaut > ziel) {
    // Von außen nach innen ausdünnen: ein Ort ist in der Mitte dicht und
    // franst zum Rand hin aus. Gleichmäßiges Ausdünnen ließ überall Lücken
    // in den Reihen. Die großen Häuser am Markt bleiben, sie tragen Kirche
    // und Rathaus.
    const gross = new Set(marktHaeuser);
    const abstand = (h: CityHouse) => {
      const [hx, hy] = centroid(h.points);
      // Etwas Zufall, damit der Rand nicht als glatter Kreis endet.
      return Math.hypot(hx - ortsMitte.x, hy - ortsMitte.y) * rng.range(0.9, 1.1);
    };
    const bewertet = haeuser.map((h) => ({ h, d: gross.has(h) ? -1 : abstand(h) }));
    bewertet.sort((p, q) => p.d - q.d);
    haeuser = bewertet.slice(0, ziel).map((x) => x.h);
  }
  // Gassen, an denen kein Haus mehr steht, fallen weg; Hauptstraßen und der
  // Kai bleiben, sie führen irgendwohin.
  if (haeuser.length > 0) {
    const mitten = haeuser.map((h) => centroid(h.points));
    const reichweite = hausTiefe * 1.6 + strassenBreite;
    for (let i = zuege.length - 1; i >= 0; i--) {
      const z = zuege[i];
      if (z.art !== 'gasse') continue;
      const genutzt = z.punkte.some((p) => mitten.some(([hx, hy]) => Math.abs(hx - p.x) < reichweite && Math.abs(hy - p.y) < reichweite));
      if (!genutzt) zuege.splice(i, 1);
    }
  }

  /**
   * Gebäudearten statt anonymer Rechtecke. Die größten Häuser bekommen die
   * besonderen Arten; die am Markt sind die größten.
   */
  const arten = opts.decorate && !klein
    ? assignBuildingKinds(
        rng,
        haeuser.map((h) => polyArea(h.points)),
      )
    : haeuser.map(() => HOUSE_KIND);

  // Bergstadt: die Straßen enden an der Burgmauer, nicht mitten im Hof.
  if (opts.shape === 'hill' && markt) {
    const hof = markt as Poly;
    for (const z of zuege) z.punkte = z.punkte.filter((p) => !imPoly(hof, p.x, p.y, 0.3));
  }

  // --- Zeichnen ------------------------------------------------------------
  for (const p of plaetze) {
    flaeche(p, 0x958a7c);
    rastern(p, strasse);
  }
  for (const z of zuege) {
    bandMalen(z.punkte.flatMap((p) => [p.x, p.y]), z.breite, z.art === 'kai' ? 0x8f8578 : 0x8b8175, strasse);
  }

  // Bergstadt: Burg mit Mauerring um den Hof oben auf dem Berg.
  const burgHof = markt as Poly | null;
  if (opts.shape === 'hill' && burgHof) {
    const [bx, by] = centroid(burgHof);
    const burg: number[] = [];
    for (let i = 0; i < burgHof.length; i += 2) {
      burg.push(bx + (burgHof[i] - bx) * 0.9, by + (burgHof[i + 1] - by) * 0.9);
    }
    ergebnis.walls.push({ points: burg.map((v) => v * s), closed: true });
    const tor = strahlAufPoly(burg, bx, by, Math.cos(ausfaelle[0] ?? 0), Math.sin(ausfaelle[0] ?? 0));
    if (tor) ergebnis.doors.push({ bounds: [(tor.x - tor.ex) * s, (tor.y - tor.ey) * s, (tor.x + tor.ex) * s, (tor.y + tor.ey) * s] });
    if (opts.decorate) {
      ergebnis.props.push({ propId: 'well', x: bx * s, y: by * s, scale: 1, rotation: 0 });
      ergebnis.props.push({ propId: 'banner', x: (bx + 1.5) * s, y: (by - 1.2) * s, scale: 0.9, rotation: 0 });
    }
  }

  /**
   * Ein Requisit innerhalb eines Hauses platzieren.
   *
   * Häuser sind nicht immer Rechtecke — ein gedrungener Block *wird* zum Haus
   * (siehe `bebauen` in `cityPlan.ts`) und kann mehr als vier Ecken haben.
   * Deshalb `imPoly` statt Grenzen aus Breite/Tiefe zu raten; ein paar
   * Anläufe genügen, ein Möbelstück, das partout nicht hineinpasst, entfällt
   * einfach — ein Haus ohne jedes Möbel bliebe trotzdem kein Rechteck ohne
   * Tür, denn die hat es so oder so.
   */
  const moebelImHaus = (h: CityHouse, propId: string) => {
    const [cx, cy] = centroid(h.points);
    const streuung = Math.sqrt(polyArea(h.points)) * 0.28;
    for (let versuch = 0; versuch < 6; versuch++) {
      const x = cx + rng.range(-streuung, streuung);
      const y = cy + rng.range(-streuung, streuung);
      if (!imPoly(h.points, x, y, 0.25)) continue;
      ergebnis.props.push({
        propId,
        x: x * s,
        y: y * s,
        scale: rng.range(0.8, 1.1),
        rotation: rng.bool() ? 0 : Math.PI / 2,
      });
      return;
    }
  };

  const gazetteer: Array<{ x: number; y: number; nameKey: string }> = [];

  haeuser.forEach((h, i) => {
    const art = arten[i];
    // Dächer in der Übersicht, sonst der Hausboden.
    flaeche(h.points, klein ? rng.pick([0x8c4a3a, 0x7a4636, 0x94583f, 0x6b5a4a]) : rng.pick([0x7a6247, 0x6f5a44, 0x83694c]));
    if (klein) return;
    ergebnis.walls.push({ points: h.points.map((v) => v * s), closed: true });
    ergebnis.doors.push({
      bounds: [h.door[0] * s, h.door[1] * s, h.door[2] * s, h.door[3] * s],
    });

    if (!opts.decorate) return;

    for (const propId of art.interior) {
      if (art !== HOUSE_KIND || rng.bool(0.6)) moebelImHaus(h, propId);
    }

    if (art.sign) {
      // Das Requisit an der Tür, ein Stück nach draußen versetzt — nach
      // innen stünde es im Weg, mitten in der Tür wäre es keine Tür mehr.
      const dx = h.door[2] - h.door[0];
      const dy = h.door[3] - h.door[1];
      const dmx = (h.door[0] + h.door[2]) / 2;
      const dmy = (h.door[1] + h.door[3]) / 2;
      const [hcx, hcy] = centroid(h.points);
      let nx = -dy;
      let ny = dx;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      // Die Normale, die von der Hausmitte weg zeigt, ist draußen.
      if ((dmx - hcx) * nx + (dmy - hcy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const sx = dmx + nx * 0.9;
      const sy = dmy + ny * 0.9;
      ergebnis.props.push({
        propId: art.sign,
        x: sx * s,
        y: sy * s,
        scale: rng.range(0.9, 1.1),
        rotation: Math.atan2(dy, dx),
      });
    }

    if (rng.bool(art.lit)) {
      const [cx, cy] = centroid(h.points);
      ergebnis.lights.push({ x: cx * s, y: cy * s, range: 4 });
    }

    if (art !== HOUSE_KIND) {
      const [cx, cy] = centroid(h.points);
      gazetteer.push({ x: cx * s, y: cy * s, nameKey: art.nameKey });
    }
  });

  if (gazetteer.length > 0) {
    // Lesereihenfolge: im Uhrzeigersinn um die Ortsmitte, wie ein Rundgang —
    // nicht die zufällige Reihenfolge, in der die Grundstücke entstanden.
    gazetteer.sort((a, b) => Math.atan2(a.y - my * s, a.x - mx * s) - Math.atan2(b.y - my * s, b.x - mx * s));
    gazetteer.forEach((g, i) => ergebnis.notes.push({ x: g.x, y: g.y, nameKey: g.nameKey, index: i + 1 }));
  }

  // --- Stadtmauer ----------------------------------------------------------
  /**
   * Die Mauer folgt dem Ort, nicht der Bildkante.
   *
   * Als Rechteck um die ganze Karte umschloss sie bei einer runden Stadt zur
   * Hälfte Wiese — eine Mauer, die nichts schützt. Genommen wird deshalb der
   * Ortsumriss, ein Stück nach außen geschoben; die Tore sitzen dort, wo die
   * Ausfallstraßen ihn durchstoßen, und liegen *in* der Mauer.
   */
  if (opts.cityWall) {
    const luft = 1.5;
    const mauer: number[] = [];
    for (let i = 0; i < outline.length; i += 2) {
      const vx = outline[i] - mx;
      const vy = outline[i + 1] - my;
      const len = Math.hypot(vx, vy) || 1;
      mauer.push(outline[i] + (vx / len) * luft, outline[i + 1] + (vy / len) * luft);
    }
    ergebnis.walls.push({ points: mauer.map((v) => v * s), closed: true });
    for (const w of ausfaelle) {
      const tor = strahlAufPoly(mauer, mx, my, Math.cos(w), Math.sin(w));
      if (!tor) continue;
      ergebnis.doors.push({
        bounds: [
          (tor.x - tor.ex) * s,
          (tor.y - tor.ey) * s,
          (tor.x + tor.ex) * s,
          (tor.y + tor.ey) * s,
        ],
      });
    }
  }

  // --- Ausstattung ---------------------------------------------------------
  if (opts.decorate) {
    for (const p of plaetze) {
      const [cx, cy] = centroid(p);
      const n = p === markt ? rng.int(3, 6) : rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const winkel = rng.range(0, Math.PI * 2);
        const weite = Math.sqrt(polyArea(p)) * rng.range(0.1, 0.3);
        const px = cx + Math.cos(winkel) * weite;
        const py = cy + Math.sin(winkel) * weite;
        if (!imPoly(p, px, py, 0.5)) continue;
        ergebnis.props.push({
          propId: rng.pick(['cart', 'crate', 'barrel', 'pottery', 'haystack']),
          x: px * s,
          y: py * s,
          scale: rng.range(0.85, 1.15),
          rotation: rng.bool() ? 0 : Math.PI / 2,
        });
      }
      if (p === markt) {
        ergebnis.props.push({ propId: 'well', x: cx * s, y: cy * s, scale: 1, rotation: 0 });
        ergebnis.lights.push({ x: cx * s, y: cy * s, range: 6 });
      }
    }

    // Kleinkram an den Straßen, aus der Maske gezogen.
    const strassenFelder: Array<[number, number]> = [];
    for (let r = 0; r < opts.rows; r++)
      for (let c = 0; c < opts.cols; c++)
        if (strasse.filled(c, r) && imPoly(outline, c + 0.5, r + 0.5, 0)) strassenFelder.push([c, r]);
    if (strassenFelder.length > 0) {
      const n = Math.min(28, Math.max(4, Math.round(strassenFelder.length / 30)));
      for (let i = 0; i < n; i++) {
        const [c, r] = rng.pick(strassenFelder);
        ergebnis.props.push({
          propId: rng.pick(['barrel', 'crate', 'fence', 'signpost', 'hay']),
          x: (c + rng.range(0, 1)) * s,
          y: (r + rng.range(0, 1)) * s,
          scale: rng.range(0.8, 1.1),
          rotation: rng.bool() ? 0 : Math.PI / 2,
        });
      }
    }
  }

  /**
   * Den Rand bepflanzen — erst hier, ganz am Ende.
   *
   * Die Bäume müssen wissen, wo Häuser und Straßen stehen, sonst wächst ein
   * Wald mitten auf dem Marktplatz. Gestreut wird nur außerhalb des Umrisses.
   */
  if (opts.margin > 0 && opts.surround !== 'none' && opts.surround !== 'water') {
    const belegt = new CellGrid(opts.cols, opts.rows);
    for (const h of haeuser) rastern(h.points, belegt);

    const dicht = opts.surround === 'forest' ? 0.5 : 0.12;
    const sorten =
      opts.surround === 'forest'
        ? ['tree_pine', 'tree_deciduous', 'tree_deciduous', 'bush', 'stone_medium']
        : ['grass_tuft', 'bush', 'flowers', 'haystack', 'stone_small'];

    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        if (imPoly(outline, c + 0.5, r + 0.5, 0)) continue;
        if (strasse.filled(c, r) || belegt.filled(c, r) || gesperrt.filled(c, r)) continue;
        if (!rng.bool(dicht)) continue;
        ergebnis.props.push({
          propId: rng.pick(sorten),
          x: (c + rng.range(0.15, 0.85)) * s,
          y: (r + rng.range(0.15, 0.85)) * s,
          scale: rng.range(0.75, 1.25),
          rotation: rng.range(0, Math.PI * 2),
        });
      }
    }
  }

  return { map: ergebnis, gebaut };
}
