import { describe, expect, it } from 'vitest';
import { GEBAEUDE_SKALA, allProps, grundSkala } from '@/assets/library';

// Rückmeldung: Gebäude-Props sind viel zu groß; sie starten bei 20 %.
describe('Grundgröße beim Platzieren', () => {
  it('Gebäude starten bei 20 %, alles andere bei 100 %', () => {
    const gebaeude = allProps().filter((p) => p.category === 'gebaeude');
    expect(gebaeude.length).toBeGreaterThan(0);
    for (const p of gebaeude) expect(grundSkala(p.id)).toBe(GEBAEUDE_SKALA);
    const anderes = allProps().find((p) => p.category !== 'gebaeude');
    expect(grundSkala(anderes!.id)).toBe(1);
    expect(grundSkala('gibt-es-nicht')).toBe(1);
  });
});
