import { describe, expect, it } from 'vitest';
import { seedFuerVariante, variantFor } from '@/assets/varianten';
import { BUILTIN_PROPS } from '@/assets/procedural/props';

describe('Varianten wählen', () => {
  it('findet zu jeder Variante einen Seed, vorwärts und rückwärts im Kreis', () => {
    const id = 'b_house';
    let seed = 42;
    const gesehen = new Set<number>();
    for (let i = 0; i < 6; i++) {
      const v = variantFor(id, seed);
      seed = seedFuerVariante(id, seed, v + 1);
      expect(variantFor(id, seed)).toBe((v + 1) % 6);
      gesehen.add(variantFor(id, seed));
    }
    expect(gesehen.size).toBe(6);
    const v = variantFor(id, seed);
    expect(variantFor(id, seedFuerVariante(id, seed, v - 1))).toBe((v + 5) % 6);
  });

  it('jedes Gebäude hat mindestens drei Bauformen', () => {
    const gebaeude = BUILTIN_PROPS.filter((p) => p.category === 'gebaeude');
    expect(gebaeude.length).toBeGreaterThanOrEqual(10);
    for (const p of gebaeude) expect(p.variants, p.id).toBeGreaterThanOrEqual(3);
  });
});
