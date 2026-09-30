/**
 * Raumthemen im Dungeon.
 *
 * Die Zusage ist nicht „jeder Raum bekommt Möbel" — das wäre bloß Streuung mit
 * anderen Props. Sie ist: *benachbarte* Räume gehören zusammen, die Küche
 * liegt am Speisesaal. Genau das wird hier geprüft, und zwar an der Kette, an
 * der der Generator die Arten vergibt.
 */

import { describe, expect, it } from 'vitest';
import { Rng } from '@/model/rng';
import { assignRoomKinds, roomKindsFor, ROOM_KINDS, DUNGEON_THEMES } from '@/model/generators/roomThemes';
import { generateDungeon, defaultDungeonOptions } from '@/model/generators/dungeon';

describe('Raumthemen', () => {
  it('kennt für jedes wählbare Thema Raumarten — außer den zwei Sonderfällen', () => {
    for (const th of DUNGEON_THEMES) {
      const arten = roomKindsFor(th);
      if (th === 'none') expect(arten).toHaveLength(0);
      else expect(arten.length).toBeGreaterThan(0);
    }
  });

  /**
   * Jeder `neighbours`-Verweis muss im eigenen Thema existieren. Ein Tippfehler
   * hier fiele sonst nicht auf: der Generator griffe stillschweigend zum
   * Zufall, und das Thema wirkte einfach schwächer.
   */
  it('verweist nur auf Raumarten, die es im selben Thema gibt', () => {
    for (const [thema, arten] of Object.entries(ROOM_KINDS)) {
      const ids = new Set(arten.map((a) => a.id));
      for (const a of arten) {
        for (const n of a.neighbours) {
          expect(ids.has(n), `${thema}/${a.id} verweist auf ${n}`).toBe(true);
        }
      }
    }
  });

  it('vergibt für jeden Raum genau eine Art', () => {
    const rng = new Rng(1);
    const eltern = [-1, 0, 1, 1, 0, 4];
    const arten = assignRoomKinds(rng, eltern, roomKindsFor('castle'));
    expect(arten).toHaveLength(eltern.length);
    for (const a of arten) expect(a).toBeTruthy();
  });

  /**
   * Der Kern: über viele Läufe muss die Nachbarschaft deutlich häufiger
   * passen, als der Zufall es hergäbe. Nicht „immer" — ein wenig Streuung ist
   * gewollt, sonst entstünden Ketten aus lauter Küchen.
   */
  it('setzt verwandte Räume nebeneinander, deutlich öfter als der Zufall', () => {
    const arten = roomKindsFor('castle');
    const eltern = [-1, 0, 1, 2, 3, 4, 5, 6];
    let passend = 0;
    let gesamt = 0;

    for (let seed = 0; seed < 300; seed++) {
      const zuordnung = assignRoomKinds(new Rng(seed), eltern, arten);
      for (let i = 1; i < eltern.length; i++) {
        gesamt++;
        if (zuordnung[eltern[i]].neighbours.includes(zuordnung[i].id)) passend++;
      }
    }

    // Zufällig wäre die Trefferquote etwa (mittlere Nachbarzahl / Artenzahl) —
    // bei sieben Arten und rund zweieinhalb Nachbarn also ungefähr 35 %.
    const quote = passend / gesamt;
    expect(quote).toBeGreaterThan(0.7);
    // Und eben nicht 100 %: die Ausreißer sind Absicht.
    expect(quote).toBeLessThan(0.99);
  });

  it('mischt bei „Zufall" über die Themen hinweg', () => {
    const alle = roomKindsFor('random');
    const nurSchloss = roomKindsFor('castle');
    expect(alle.length).toBeGreaterThan(nurSchloss.length);
  });
});

describe('Dungeon mit Thema', () => {
  const basis = { ...defaultDungeonOptions(), seed: 4, tileSize: 100 };

  it('stellt Räume je nach Thema unterschiedlich aus', () => {
    const schloss = generateDungeon({ ...basis, theme: 'castle' });
    const gruft = generateDungeon({ ...basis, theme: 'crypt' });

    const ids = (r: { props: Array<{ propId: string }> }) => new Set(r.props.map((p) => p.propId));
    const s = ids(schloss);
    const g = ids(gruft);

    // Jedes Thema bringt etwas mit, das im anderen nichts zu suchen hat.
    expect(s.has('chair') || s.has('barrel')).toBe(true);
    expect(g.has('sarcophagus') || g.has('gravestone')).toBe(true);
    expect(g.has('chair')).toBe(false);
  });

  it('lässt die Räume bei „keine Raumdeko" ohne Möbel', () => {
    const ohne = generateDungeon({ ...basis, theme: 'none', decorate: false });
    expect(ohne.props).toHaveLength(0);
  });

  /**
   * Der Abstand darf die verlangte Raumzahl nicht auffressen. Vorher kamen
   * bei weitem Abstand statt neun Räumen zwei heraus, ohne dass irgendwo
   * stand, warum — der Generator nimmt den Abstand jetzt so weit zurück, wie
   * die Karte es verlangt.
   */
  it('hält die Raumzahl auch bei weitem Abstand', () => {
    const flaeche = (r: { floors: Array<{ points: number[] }> }) =>
      r.floors.reduce((a, f) => a + f.points.length, 0);
    const eng = generateDungeon({ ...basis, spread: 0, theme: 'plain' });
    const weit = generateDungeon({ ...basis, spread: 1, theme: 'plain' });

    // Beide bauen einen ordentlichen Grundriss, nicht nur zwei Kammern.
    expect(flaeche(eng)).toBeGreaterThan(40);
    expect(flaeche(weit)).toBeGreaterThan(40);
    expect(weit.props.length).toBeGreaterThan(eng.props.length * 0.5);
  });
});

describe('Vielfalt der Raumtypen (Rückmeldung: nur drei zu sehen)', () => {
  it('das voreingestellte Thema kennt mindestens 20 Raumtypen', async () => {
    const { ROOM_KINDS } = await import('@/model/generators/roomThemes');
    expect(defaultDungeonOptions().theme).toBe('plain');
    expect(ROOM_KINDS.plain.length).toBeGreaterThanOrEqual(20);
  });

  it('jede Raumart nennt nur Props, die es gibt, und Nachbarn aus demselben Thema', async () => {
    const { ROOM_KINDS } = await import('@/model/generators/roomThemes');
    const { getProp } = await import('@/assets/library');
    for (const arten of Object.values(ROOM_KINDS)) {
      const ids = new Set(arten.map((a) => a.id));
      for (const a of arten) {
        for (const p of [...a.center, ...a.around, ...a.walls, ...a.scatter]) {
          expect(getProp(p), `${a.id}: ${p}`).toBeDefined();
        }
        for (const n of a.neighbours) expect(ids.has(n), `${a.id} -> ${n}`).toBe(true);
      }
    }
  });

  it('ein großer Dungeon bekommt viele verschiedene Räume', () => {
    const arten = new Set<string>();
    for (const seed of [1, 2, 3]) {
      const d = generateDungeon({ ...defaultDungeonOptions(), roomCount: 20, seed, tileSize: 100 });
      for (const n of d.notes) arten.add(n.nameKey);
    }
    expect(arten.size).toBeGreaterThanOrEqual(12);
  });
});
