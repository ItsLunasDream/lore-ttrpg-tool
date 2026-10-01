import { describe, expect, it } from 'vitest';
import { istRundum, istWasser, wasserAussehen } from '@/model/wasser';

const kreis = (r: number, n = 24, schliessen = true) => {
  const p: number[] = [];
  const bis = schliessen ? n : n - 6;
  for (let i = 0; i <= bis; i++) {
    const w = (i / n) * Math.PI * 2;
    p.push(500 + Math.cos(w) * r, 500 + Math.sin(w) * r);
  }
  return p;
};

describe('Wasser im Terrain-Pinsel', () => {
  it('sieht nach Wasser aus: Wellen und helle Uferkante', () => {
    const a = wasserAussehen(0x3f7896, 1, 100);
    expect(a.fill.pattern?.kind).toBe('waves');
    expect(a.stroke.width).toBeGreaterThan(0);
    expect(istWasser(a.fill)).toBe(true);
    expect(istWasser({ color: 1, alpha: 1 })).toBe(false);
  });

  it('ein umfahrener Umriss wird zum See', () => {
    expect(istRundum(kreis(400), 120, 100)).toBe(true);
  });

  it('ein offener Zug bleibt ein Fluss', () => {
    expect(istRundum(kreis(400, 24, false), 120, 100)).toBe(false);
    const gerade = Array.from({ length: 20 }, (_, i) => [i * 50, 0]).flat();
    expect(istRundum(gerade, 120, 100)).toBe(false);
  });

  it('ein kurzes Hin und Her ist kein See', () => {
    const hin = [0, 0, 60, 0, 120, 0, 180, 5, 120, 5, 60, 5, 0, 3];
    expect(istRundum(hin, 120, 100)).toBe(false);
  });
});
