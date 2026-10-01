/**
 * Wasser mit dem Terrain-Pinsel (Rückmeldung 8).
 *
 * Geprüft wird am Bild: ein umfahrener See ist auch in der Mitte Wasser — als
 * Band gemalt hätte er dort ein Loch —, und ein Fluss trägt Wellen, ist also
 * nicht einfarbig.
 */
import { expect, test } from '@playwright/test';
import { oeffneEditor, werkzeug } from './harness';

test('ein umfahrener See ist auch in der Mitte Wasser', async ({ page }) => {
  await oeffneEditor(page);
  await werkzeug(page, 'terrain');

  const r = await page.evaluate(() => {
    const T = window.T;
    T.state().patchTerrain({ water: true, color: 0x3f7896, alpha: 1, width: 40, smoothing: 0 });
    T.pump(1);
    const c = T.canvas()!;
    const mx = Math.round(c.clientWidth / 2);
    const my = Math.round(c.clientHeight / 2);
    const punkte: Array<[number, number]> = [];
    for (let i = 0; i <= 36; i++) {
      const w = (i / 36) * Math.PI * 2;
      punkte.push([mx + Math.cos(w) * 160, my + Math.sin(w) * 120]);
    }
    T.stroke(punkte);
    T.pump(3);
    const [mitte] = T.probe([[mx, my]]);
    const doc = T.doc();
    const formen = Object.values(doc.objects).filter((o) => o.kind === 'shape');
    return { mitte, anzahl: formen.length, muster: formen[0]?.kind === 'shape' ? formen[0].fill?.pattern?.kind : null };
  });

  expect(r.anzahl).toBe(1);
  expect(r.muster).toBe('waves');
  // Blau überwiegt in der Mitte: dort ist See, nicht der Kartenhintergrund.
  expect(r.mitte[2]).toBeGreaterThan(r.mitte[0] + 30);
});

test('ein Fluss trägt Wellen und ist nicht einfarbig', async ({ page }) => {
  await oeffneEditor(page);
  await werkzeug(page, 'terrain');

  const farben = await page.evaluate(() => {
    const T = window.T;
    T.state().patchTerrain({ water: true, color: 0x3f7896, alpha: 1, width: 220, smoothing: 0 });
    T.pump(1);
    const c = T.canvas()!;
    const mx = Math.round(c.clientWidth / 2);
    const my = Math.round(c.clientHeight / 2);
    T.stroke([[mx - 250, my], [mx, my + 10], [mx + 250, my]]);
    T.pump(3);
    const proben: Array<[number, number]> = [];
    for (let x = -120; x <= 120; x += 6) for (let y = -30; y <= 30; y += 6) proben.push([mx + x, my + y]);
    return T.probe(proben).map((p) => p.slice(0, 3).join(','));
  });

  // Mehr als eine Farbe im Fluss: die Wellen sind zu sehen.
  expect(new Set(farben).size).toBeGreaterThan(3);
});
