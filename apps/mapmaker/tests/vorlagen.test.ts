/**
 * Vorlagen als Generatoren (Rückmeldungen E, F, G): sie sollen sich wirklich
 * unterscheiden, und die Taverne soll Sinn ergeben.
 */

import { describe, expect, it } from 'vitest';
import { generateTemplate, TEMPLATE_IDS, type TemplateId } from '@/model/generators/template';
import { getProp } from '@/assets/library';

const S = 100;
const erzeuge = (variant: TemplateId, seed: number) =>
  generateTemplate({ variant, seed, tileSize: S, cols: 0, rows: 0, furnish: true, lights: true });

describe('Vorlagen', () => {
  it('nennen nur Props, die es gibt', () => {
    for (const v of TEMPLATE_IDS) {
      for (let seed = 1; seed <= 8; seed++) {
        for (const p of erzeuge(v, seed).props) expect(getProp(p.propId), `${v}/${seed}: ${p.propId}`).toBeDefined();
      }
    }
  });

  it('unterscheiden sich im Grundriss, nicht nur im Kleinkram', () => {
    for (const v of TEMPLATE_IDS) {
      const formen = new Set<string>();
      for (let seed = 1; seed <= 8; seed++) {
        const m = erzeuge(v, seed);
        formen.add(`${m.size.cols}x${m.size.rows}|${m.doors.map((d) => d.bounds.map(Math.round).join(',')).join(';')}`);
      }
      expect(formen.size, v).toBeGreaterThanOrEqual(6);
    }
  });

  it('Taverne: Theke wechselt die Lage, Kamin fehlt nie, Fässer stehen nicht zwischen den Tischen', () => {
    const thekenLagen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const m = erzeuge('tavern', seed);
      const W = m.size.cols * S;
      const H = m.size.rows * S;
      expect(m.props.some((p) => p.propId === 'fireplace'), `Kamin ${seed}`).toBe(true);
      const tische = m.props.filter((p) => /^table/.test(p.propId));
      expect(tische.length, `Tische ${seed}`).toBeGreaterThanOrEqual(3);

      const theke = m.floors.find((f) => f.color === 0x6b5335 && f.points.length === 8);
      if (theke) {
        const cx = (theke.points[0] + theke.points[4]) / 2;
        const cy = (theke.points[1] + theke.points[5]) / 2;
        thekenLagen.add(`${Math.round((cx / W) * 3)},${Math.round((cy / H) * 3)}`);
      }
      const vorrat = m.props.filter((p) => /barrel|crate|sacks|shelf_crates/.test(p.propId));
      for (const f of vorrat) {
        for (const t of tische) {
          expect(Math.hypot(f.x - t.x, f.y - t.y), `Vorrat an Tisch ${seed}`).toBeGreaterThan(1.3 * S);
        }
      }
    }
    expect(thekenLagen.size).toBeGreaterThanOrEqual(4);
  });

  it('ohne „Licht mitgeben" leuchtet kein Prop', () => {
    const m = generateTemplate({ variant: 'tavern', seed: 3, tileSize: S, cols: 0, rows: 0, furnish: true, lights: false });
    expect(m.lights).toHaveLength(0);
    expect(m.props.filter((p) => p.propId === 'wall_torch').every((p) => p.ohneLicht)).toBe(true);
  });
});

describe('alle Generatoren', () => {
  it('nennen nur Props, die es gibt', async () => {
    const { GENERATOR_IDS, defaultGeneratorParams, runGenerator } = await import('@/model/generators');
    const fehlend = new Set<string>();
    for (const id of GENERATOR_IDS) {
      for (let seed = 1; seed <= 4; seed++) {
        for (const p of runGenerator(id, defaultGeneratorParams(), seed, 100).props) {
          if (!getProp(p.propId)) fehlend.add(`${id}: ${p.propId}`);
        }
      }
    }
    expect([...fehlend]).toEqual([]);
  });
});

describe('Wald (Rückmeldung: immer gleiches Layout, immer waagerechter Weg)', () => {
  const imPoly = (x: number, y: number, p: number[]) => {
    let c = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  it('würfelt Wasser und Wegrichtung, und kein Baum steht im Wasser', async () => {
    const { generateForest, defaultForestOptions } = await import('@/model/generators/forest');
    let mitWasser = 0;
    const wegRichtungen = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const m = generateForest({ ...defaultForestOptions(), seed, tileSize: 10 });
      const wasser = m.floors.filter((f) => f.color === 0x3d6b7d);
      if (wasser.length > 0) mitWasser++;
      for (const baum of m.props.filter((p) => p.propId.startsWith('tree_'))) {
        expect(wasser.some((w) => imPoly(baum.x, baum.y, w.points)), `Baum im Wasser, Seed ${seed}`).toBe(false);
      }
      const weg = m.floors.find((f) => f.color === 0x8a7a5c);
      if (weg) {
        const xs = weg.points.filter((_, i) => i % 2 === 0);
        const ys = weg.points.filter((_, i) => i % 2 === 1);
        wegRichtungen.add(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys) ? 'quer' : 'laengs');
      }
    }
    expect(mitWasser).toBeGreaterThanOrEqual(6);
    expect(wegRichtungen.size).toBe(2);
  });
});
