/**
 * Variante eines Props im Inspektor wechseln (Rückmeldung 2B: Gebäude mit
 * mindestens drei Varianten — wählbar, nicht nur zufällig).
 */
import { expect, test } from '@playwright/test';
import { oeffneEditor } from './harness';

test('der Pfeil schaltet die Variante des ausgewählten Gebäudes weiter', async ({ page }) => {
  await oeffneEditor(page);
  await page.evaluate(() => {
    const T = window.T;
    const d = T.doc();
    const layer = d.rootLayers.find((id) => !d.layers[id].isGroup && !id.startsWith('__'))!;
    T.state().exec(
      new T.cmds.AddObjects(
        [
          {
            id: 'haus', layerId: layer, kind: 'prop', propId: 'b_house', x: 600, y: 600,
            rotation: 0, opacity: 1, z: 1, locked: false, scaleX: 1, scaleY: 1,
            tint: null, flipX: false, flipY: false, seed: 5,
          },
        ] as never,
        'Aufbau',
      ),
    );
    T.state().setSelection(['haus']);
  });
  const zaehler = page.locator('.row-inline .variante');
  await expect(zaehler).toBeVisible();
  const vorher = (await zaehler.textContent())!.trim();
  await page.getByRole('button', { name: /Next variant|Nächste Variante/ }).click();
  const nachher = (await zaehler.textContent())!.trim();
  const zahl = (s: string) => Number(s.split('/')[0]);
  expect(zahl(nachher)).toBe((zahl(vorher) % 6) + 1);
  // Rückgängig stellt die alte Variante wieder her.
  await page.evaluate(() => window.T.state().undo());
  await expect(zaehler).toHaveText(vorher);
});
