/**
 * Die Prop-Bibliothek als Ganzes.
 *
 * Props werden von Hand geschrieben, und die immer gleichen Flüchtigkeitsfehler
 * fallen erst spät auf: eine doppelt vergebene Id überschreibt stillschweigend
 * ein anderes Prop, ein fehlender Wörterbuch-Schlüssel zeigt in der englischen
 * Oberfläche einen deutschen Namen — genau das war eine gemeldete Beschwerde —,
 * und eine Zeichnung, die über ihre angegebene Größe hinausläuft, wird im Bild
 * beschnitten. Alles drei ist hier zu prüfen und nirgends sonst.
 */

import { describe, expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { BUILTIN_PROPS } from '@/assets/procedural/props';
import { CATEGORY_ORDER } from '@/assets/propTypes';
import { Rng } from '@/model/rng';
import { strings } from '@/i18n/strings';

describe('Prop-Bibliothek', () => {
  it('vergibt jede Id nur einmal', () => {
    const gesehen = new Map<string, number>();
    for (const p of BUILTIN_PROPS) gesehen.set(p.id, (gesehen.get(p.id) ?? 0) + 1);
    const doppelt = [...gesehen].filter(([, n]) => n > 1).map(([id]) => id);
    expect(doppelt).toEqual([]);
  });

  it('nennt für jedes eingebaute Prop einen Namen in beiden Sprachen', () => {
    const fehlend = BUILTIN_PROPS.filter((p) => !(`prop.${p.id}` in strings)).map((p) => p.id);
    expect(fehlend).toEqual([]);
  });

  it('benutzt nur bekannte Kategorien und sinnvolle Größen', () => {
    for (const p of BUILTIN_PROPS) {
      expect(CATEGORY_ORDER, p.id).toContain(p.category);
      expect(p.size.w, p.id).toBeGreaterThan(0);
      expect(p.size.h, p.id).toBeGreaterThan(0);
      // Ein Prop, das größer als vier Tiles ist, sprengt jede Battlemap.
      // Ausnahme Gebäude: eine Burg ist zehn Felder groß, das ist ihr Zweck.
      expect(Math.max(p.size.w, p.size.h), p.id).toBeLessThanOrEqual(p.category === 'gebaeude' ? 1000 : 400);
      expect(p.tags.length, p.id).toBeGreaterThan(0);
      expect(p.variants, p.id).toBeGreaterThan(0);
    }
  });

  /**
   * Zeichnen im Test ohne Grafikkarte: `Graphics` sammelt die Anweisungen im
   * Speicher, gerendert wird nichts. Das genügt — geprüft wird, dass keine
   * Zeichnung wirft und dass jede *irgendetwas* zeichnet. Ein Prop, das
   * versehentlich nichts ausgibt, wäre in der Palette ein leeres Kästchen.
   */
  it('zeichnet jede Variante ohne Fehler und nicht ins Leere', () => {
    for (const p of BUILTIN_PROPS) {
      if (!p.draw) continue;
      for (const seed of [1, 7, 99]) {
        const g = new Graphics();
        expect(() => p.draw?.(g, new Rng(seed), seed % p.variants), `${p.id}/${seed}`).not.toThrow();
        expect(g.context.instructions.length, `${p.id}/${seed}`).toBeGreaterThan(0);
        g.destroy();
      }
    }
  });

  /**
   * Die angegebene Größe ist kein Schmuck: der Rahmen für Vorschaubild und
   * Textur wird daraus berechnet. Wer darüber hinaus zeichnet, wird
   * abgeschnitten — beim Poller sah das aus wie eine riesige Spirale.
   */
  it('bleibt im angegebenen Rahmen', () => {
    // Alle Überschreitungen sammeln statt beim ersten abzubrechen: sonst
    // findet man sie einzeln, über viele Läufe verteilt.
    const zuGross: string[] = [];
    // Wenig Toleranz, und die nur absolut: eine Strichbreite darf überstehen,
    // eine ganze Zeichnung nicht. Prozentuale Nachsicht würde bei großen Props
    // gerade das durchgehen lassen, was am meisten abgeschnitten wird.
    const luft = 1;
    for (const p of BUILTIN_PROPS) {
      if (!p.draw) continue;
      // Viele Seeds, nicht drei: die Ausdehnung schwankt mit der Variante, und
      // der eine Seed, bei dem eine Ranke zu weit läuft, ist genau der, den
      // eine kleine Stichprobe verfehlt.
      for (let seed = 1; seed <= 16; seed++) {
        const g = new Graphics();
        p.draw(g, new Rng(seed), seed % p.variants);
        const b = g.getLocalBounds();
        g.destroy();
        const dx = Math.max(-b.minX, b.maxX) / ((p.size.w / 2) * luft + 4);
        const dy = Math.max(-b.minY, b.maxY) / ((p.size.h / 2) * luft + 4);
        if (dx > 1 || dy > 1) {
          zuGross.push(`${p.id}/${seed}: ${dx.toFixed(2)}x breit, ${dy.toFixed(2)}x hoch`);
        }
      }
    }
    expect(zuGross).toEqual([]);
  });
});
