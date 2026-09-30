/**
 * Grundformen und Rand der Siedlung.
 *
 * Die Tests prüfen nicht, wie es aussieht — das entscheidet der Blick. Sie
 * prüfen die Zusagen, die man dem Bild nicht ansieht: dass jede Form
 * überhaupt Häuser hervorbringt, dass keins im Fluss steht, und dass der Rand
 * frei bleibt.
 */

import { describe, expect, it } from 'vitest';
import { generateTown, defaultTownOptions, TOWN_SHAPES } from '@/model/generators/town';

const basis = { ...defaultTownOptions(), tileSize: 100 };
const seeds = [3, 11, 42, 7, 99];

describe('Grundformen der Siedlung', () => {
  /**
   * Der Fehler, der hier zu beheben war: die runde Stadt brachte null bis zwei
   * Häuser hervor statt vierzehn, weil Ringstraße und Speichen die Scheibe so
   * zerlegten, dass nichts Zusammenhängendes übrig blieb.
   */
  it('bringt bei jeder Form eine ordentliche Zahl Häuser hervor', () => {
    for (const shape of TOWN_SHAPES) {
      for (const seed of seeds) {
        const r = generateTown({ ...basis, seed, shape, surround: 'none' });
        expect(r.walls.length, `${shape}/${seed}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('gibt jedem Haus genau eine Tür', () => {
    for (const shape of TOWN_SHAPES) {
      const r = generateTown({ ...basis, seed: 5, shape, cityWall: false });
      expect(r.doors.length).toBe(r.walls.length);
    }
  });

  /**
   * Beim Flussdorf darf kein Haus im Wasser stehen. Geprüft über die
   * Wasserfläche: keine Hausecke darf darin liegen.
   */
  it('setzt beim Flussdorf kein Haus ins Wasser', () => {
    for (const seed of seeds) {
      const r = generateTown({ ...basis, seed, shape: 'river', surround: 'none' });
      const wasser = r.floors.filter((f) => f.color === 0x3d6b7d);
      expect(wasser.length).toBeGreaterThan(0);

      for (const haus of r.walls) {
        for (let i = 0; i < haus.points.length; i += 2) {
          const x = haus.points[i];
          const y = haus.points[i + 1];
          for (const w of wasser) expect(imPolygon(x, y, w.points)).toBe(false);
        }
      }
    }
  });

  it('legt bei runder Form keinen rechteckigen Grund unter die Ellipse', () => {
    const r = generateTown({ ...basis, seed: 3, shape: 'round', surround: 'none' });
    // Der Ortsgrund hat eine eigene Farbe; bei runder Form gibt es davon genau
    // eine Fläche, und die ist die Ellipse (mehr als vier Ecken).
    const grund = r.floors.filter((f) => f.color === 0x6d6252);
    expect(grund).toHaveLength(1);
    expect(grund[0].points.length).toBeGreaterThan(8);
  });
});

describe('Rand um die Siedlung', () => {
  it('streut ohne Rand nichts außerhalb', () => {
    const ohne = generateTown({ ...basis, seed: 3, margin: 0, surround: 'forest' });
    const mit = generateTown({ ...basis, seed: 3, margin: 6, surround: 'forest' });
    expect(mit.props.length).toBeGreaterThan(ohne.props.length);
  });

  it('bringt mehr Bewuchs bei Wald als bei Wiese', () => {
    const wiese = generateTown({ ...basis, seed: 3, margin: 6, surround: 'meadow' });
    const wald = generateTown({ ...basis, seed: 3, margin: 6, surround: 'forest' });
    const baeume = (r: { props: Array<{ propId: string }> }) =>
      r.props.filter((p) => p.propId.startsWith('tree_')).length;
    expect(baeume(wald)).toBeGreaterThan(baeume(wiese));
  });

  it('legt bei Wasser als Rand eine Wasserfläche unter die Karte', () => {
    const r = generateTown({ ...basis, seed: 3, margin: 6, surround: 'water' });
    expect(r.floors.some((f) => f.color === 0x3d6b7d)).toBe(true);
  });
});

/** Punkt-in-Polygon, Strahlverfahren. */
function imPolygon(x: number, y: number, pts: number[]): boolean {
  let drin = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

describe('Größe und Zahl', () => {
  /**
   * Die gewünschte Hauszahl wird getroffen, nicht angenähert. Vorher hing sie
   * daran, wie viel Platz die Streuung zufällig fand — bei dreihundert
   * gewünschten Häusern kamen vierzig heraus.
   */
  it('trifft die gewünschte Hauszahl', () => {
    for (const shape of TOWN_SHAPES) {
      for (const [cols, rows, anzahl] of [
        [64, 48, 12],
        [64, 48, 60],
        [120, 90, 300],
      ] as const) {
        for (const seed of [3, 17]) {
          const r = generateTown({ ...basis, cols, rows, shape, buildingCount: anzahl, seed });
          // Die Bergstadt hat oben eine Burg; ihre Mauer ist kein Haus.
          const burg = shape === 'hill' ? 1 : 0;
          expect(r.walls.length - burg, `${shape}/${anzahl}/${seed}`).toBe(anzahl);
        }
      }
    }
  });

  /**
   * Der Rand um den Ort soll rund ein Zehntel der Karte ausmachen. Er war
   * einmal ein Viertel, weil die Ortsfläche aus der Hauszahl gerechnet wurde
   * statt die Hausgröße aus der Fläche.
   */
  it('lässt nur einen schmalen Rand frei', () => {
    for (const shape of TOWN_SHAPES) {
      for (const seed of seeds) {
        const r = generateTown({ ...basis, shape, seed });
        const grund = r.floors.find((f) => f.color === 0x6d6252);
        expect(grund, shape).toBeDefined();
        const xs = grund!.points.filter((_, i) => i % 2 === 0);
        const ys = grund!.points.filter((_, i) => i % 2 === 1);
        const breite = (Math.max(...xs) - Math.min(...xs)) / (r.size.cols * basis.tileSize);
        const hoehe = (Math.max(...ys) - Math.min(...ys)) / (r.size.rows * basis.tileSize);
        expect(breite, `${shape}/${seed} Breite`).toBeGreaterThan(0.85);
        expect(hoehe, `${shape}/${seed} Höhe`).toBeGreaterThan(0.85);
      }
    }
  });

  /** Zwei Startwerte, zwei Grundrisse — nicht dasselbe mit anderen Häusern. */
  it('ergibt bei anderem Startwert einen anderen Ort', () => {
    for (const shape of TOWN_SHAPES) {
      const a = generateTown({ ...basis, shape, seed: 1 });
      const b = generateTown({ ...basis, shape, seed: 2 });
      const pflaster = (r: typeof a) =>
        JSON.stringify(r.floors.filter((f) => f.color === 0x8b8175).map((f) => f.points));
      expect(pflaster(a), shape).not.toBe(pflaster(b));
    }
  });
});

describe('Hafenstadt, Bergstadt und Übersicht', () => {
  it('die Hafenstadt liegt am Wasser, mit Anlegern und Booten', () => {
    for (const seed of [1, 2, 3]) {
      const r = generateTown({ ...basis, shape: 'harbor', seed });
      expect(r.floors.some((f) => f.color === 0x3d6b7d), `${seed}`).toBe(true);
      expect(r.floors.some((f) => f.color === 0x7a5c3a), `${seed}`).toBe(true);
      expect(r.props.some((p) => p.propId === 'rowboat'), `${seed}`).toBe(true);
    }
  });

  it('die Bergstadt hat oben eine Burg mit Tor', () => {
    const r = generateTown({ ...basis, shape: 'hill', seed: 5 });
    // Jedes Haus eine Wand und eine Tür, dazu Burgmauer und Burgtor.
    expect(r.walls.length).toBe(basis.buildingCount + 1);
    expect(r.doors.length).toBe(basis.buildingCount + 1);
  });

  it('die Übersicht füllt die Karte ohne Wände und Türen', () => {
    const r = generateTown({ ...basis, cols: 100, rows: 75, uebersicht: true, seed: 4 });
    expect(r.walls.length).toBe(0);
    expect(r.doors.length).toBe(0);
    // Viel mehr Häuser als die Vorgabe: die Zahl folgt aus der Fläche.
    const daecher = r.floors.filter((f) => [0x8c4a3a, 0x7a4636, 0x94583f, 0x6b5a4a].includes(f.color));
    expect(daecher.length).toBeGreaterThan(basis.buildingCount * 5);
  });
});
