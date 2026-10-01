/**
 * Rückmeldung: „Wenn ich einen Raum platziere und dann rechts den Wandtyp
 * ändere, wird das nicht auf den aktuell platzierten angewandt." Und: VTT-Wand
 * und sichtbare Wand ließen sich auseinandernehmen.
 *
 * Hier über die echte Seitenleiste: Raum ziehen, rechts umstellen, prüfen,
 * dass die Wand und ihr Mauerwerk mitgehen.
 */

import { expect, test } from '@playwright/test';
import { oeffneEditor, werkzeug, ziehen } from './harness';

test('Einstellungen rechts wirken auf den eben gesetzten Raum', async ({ page }) => {
  await oeffneEditor(page);
  await page.evaluate(() => window.T.state().patchRoom({ createWalls: true, createFloor: true, style: 'stone', wallType: 'normal' }));
  await werkzeug(page, 'room');
  await ziehen(page, 200, 200, 420, 360);

  const nachher = () =>
    page.evaluate(() => {
      const d = window.T.doc();
      const w = d.vtt.walls[0];
      const mauer = Object.values(d.objects).find(
        (o) => o.kind === 'shape' && (o as { vttLink?: { id: string } }).vttLink?.id === w?.id,
      ) as { stroke: { color: number }; x: number } | undefined;
      return { typ: w?.type, stil: w?.style, farbe: mauer?.stroke.color ?? null, x: mauer?.x ?? null, gewaehlt: window.T.state().vttSelection.walls };
    });

  const vorher = await nachher();
  expect(vorher.stil).toBe('stone');
  expect(vorher.farbe).not.toBeNull();
  expect(vorher.gewaehlt).toHaveLength(1);

  // Wandtyp und Mauerwerk über die Auswahllisten der Seitenleiste.
  const zeile = (label: RegExp) =>
    page.locator('.row').filter({ has: page.locator('label', { hasText: label }) }).locator('select').first();
  const panel = zeile(/^(Typ|Type)$/);
  await panel.selectOption('ethereal');
  const stil = zeile(/^(Sichtbares Wandstück|Visible wall piece)$/);
  await stil.selectOption('wood');
  await page.waitForTimeout(150);

  const danach = await nachher();
  expect(danach.typ).toBe('ethereal');
  expect(danach.stil).toBe('wood');
  expect(danach.farbe).not.toBe(vorher.farbe);

  // Rückgängig nimmt Stil und Mauerwerk gemeinsam zurück.
  await page.evaluate(() => window.T.state().undo());
  await page.waitForTimeout(100);
  const zurueck = await nachher();
  expect(zurueck.stil).toBe('stone');
  expect(zurueck.farbe).toBe(vorher.farbe);
});
