/**
 * Karten übereinander: der 1. Stock mit durchsichtigem Boden zeigt das
 * Erdgeschoss darunter, und im Export ist er dort wirklich durchsichtig
 * (model/mappe.ts, ui/Unterlage.tsx, io/exportImage.ts renderFremdeKarte).
 */

import { expect, test } from '@playwright/test';
import { oeffneEditor } from './harness';

test('durchsichtiger Boden: Unterlage im Editor, Transparenz im Export', async ({ page }) => {
  await oeffneEditor(page);
  // Erdgeschoss knallrot, damit man es durchscheinen sieht.
  await page.evaluate(() => {
    const T = window.T;
    T.state().exec(new T.cmds.SetBackground(0xff0000));
  });
  await page.locator('[data-karte-neu]').click();
  await page.waitForTimeout(400);

  // Mitte der Bühne liegt auf der Karte (eingepasst).
  const mitte = await page.evaluate(() => {
    const c = window.T.canvas()!;
    return [c.clientWidth / 2, c.clientHeight / 2] as [number, number];
  });
  const [r, g, b] = (await page.evaluate((p) => window.T.probe([p]), mitte))[0];
  expect(r).toBeGreaterThan(g + 60);
  expect(r).toBeGreaterThan(b + 60);

  // Im Export des 1. Stocks: durchsichtig, nicht rot.
  const [, , , alpha] = (await page.evaluate(() => window.T.exportProbe([[40, 40]])))[0];
  expect(alpha).toBe(0);
  // Das Erdgeschoss selbst bleibt im Export deckend rot.
  const eg = (await page.evaluate(() => window.T.exportProbe([[40, 40]], 0)))[0];
  expect(eg[0]).toBeGreaterThan(200);
  expect(eg[3]).toBe(255);
  // Die Bühne zeigt danach wieder den 1. Stock, nicht das Erdgeschoss.
  expect(await page.evaluate(() => window.T.doc().meta.name)).toMatch(/^(Etage|Level) 2$/);

  // Boden wieder deckend: das Rot verschwindet am Schirm.
  await page.evaluate(() => {
    const T = window.T;
    T.state().exec(new T.cmds.SetEbene({ bodenTransparent: false }));
  });
  await page.waitForTimeout(200);
  const [r2, g2] = (await page.evaluate((p) => window.T.probe([p]), mitte))[0];
  expect(r2).toBeLessThan(g2 + 40);
});

test('alle Ebenen als ZIP: je Karte eine UVTT-Datei, von unten nach oben', async ({ page }) => {
  await oeffneEditor(page);
  await page.locator('[data-karte-neu]').click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^(Datei|File) ▾$/ }).click();
  await page.getByRole('button', { name: /^VTT…$/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-uvtt-alle]').click()]);
  expect(download.suggestedFilename()).toMatch(/-ebenen\.zip$/);
  const pfad = await download.path();
  const { unzipSync, strFromU8 } = await import('fflate');
  const { readFileSync } = await import('node:fs');
  const dateien = unzipSync(new Uint8Array(readFileSync(pfad!)));
  const namen = Object.keys(dateien).sort();
  expect(namen).toHaveLength(3);
  expect(namen[0]).toMatch(/^01-.*\.dd2vtt$/);
  expect(namen[1]).toMatch(/^02-(Etage|Level)_2\.dd2vtt$/);
  expect(namen[2]).toBe('LIESMICH.txt');
  const oben = JSON.parse(strFromU8(dateien[namen[1]]));
  expect(typeof oben.image).toBe('string');
  expect(oben.image.length).toBeGreaterThan(100);
  // Die Bühne zeigt danach weiter die offene Karte.
  expect(await page.evaluate(() => window.T.doc().meta.name)).toMatch(/^(Etage|Level) 2$/);
});
