/**
 * Mehrere Karten in einer Datei, mit echten Klicks (model/mappe.ts).
 *
 * Die Modelltests sehen den Store; hier geht es darum, dass die Leiste
 * wirklich wechselt, der Doppelklick umbenennt und der Knopf in der Notiz auf
 * die verwiesene Karte springt — und dass die Bühne danach die andere Karte
 * zeigt und nicht die alte stehen bleibt.
 */

import { expect, test } from '@playwright/test';
import { oeffneEditor, tippen, werkzeug } from './harness';

const name = (page: import('@playwright/test').Page) => page.evaluate(() => window.T.doc().meta.name);

test('Karte anlegen, umbenennen, wechseln und per Notiz hinspringen', async ({ page }) => {
  await oeffneEditor(page);
  const erste = await name(page);

  await page.locator('[data-karte-neu]').click();
  await page.waitForTimeout(200);
  expect(await page.locator('[data-karte]').count()).toBe(2);
  expect(await name(page)).toMatch(/^(Etage|Level) 2$/);

  // Doppelklick benennt um; Enter übernimmt.
  await page.locator('[data-karte="1"]').dblclick();
  await page.locator('[data-karte-name="1"]').fill('Keller');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect(await name(page)).toBe('Keller');

  // Zurück nach oben, dort eine Notiz mit Verweis auf den Keller.
  await page.locator('[data-karte="0"]').click();
  await page.waitForTimeout(200);
  expect(await name(page)).toBe(erste);
  await werkzeug(page, 'note');
  await tippen(page, 400, 300);
  await page.waitForTimeout(350);
  const auswahl = page.locator('.modal select').last();
  await auswahl.selectOption({ label: 'Keller' });
  await page.waitForTimeout(150);
  await page.locator('[data-note-ziel]').click();
  await page.waitForTimeout(250);
  expect(await name(page)).toBe('Keller');
  expect(await page.locator('.modal').count()).toBe(0);

  // Oben hängt der Verweis an der Notiz.
  const ziel = await page.evaluate(() => {
    const s = window.T.state();
    return { verweis: s.karten[0].vtt.notes[0]?.zielKarte, keller: s.karten[1].meta.id };
  });
  expect(ziel.verweis).toBe(ziel.keller);
});
