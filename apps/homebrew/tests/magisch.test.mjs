/**
 * Eichung magischer Gegenstaende von Hand (src/shared/magischEichung.ts):
 * dieselben Grenzen wie im Magic Item Generator, nur gemeldet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const H = require('../dist/tests/entry.cjs');

const mit = (teil) => ({ ...H.leererEintrag('magisch'), name: 'Amulett', ...teil });

test('ungewoehnlich: +1 im Rahmen, +3 zu stark', () => {
  assert.equal(H.eicheMagisch(mit({ wirkungen: ['Du erhältst +1 Bonus auf Angriffswürfe.'] })).urteil, 'im_rahmen');
  const e = H.eicheMagisch(mit({ wirkungen: ['Du erhältst +3 Bonus auf Angriffswürfe.'] }));
  assert.equal(e.urteil, 'ueber');
  assert.ok(e.befunde.some((b) => /\+3/.test(b.text.de) && /\+3/.test(b.text.en)));
});

test('SG und Zusatzschaden ueber der Grenze werden gemeldet', () => {
  const e = H.eicheMagisch(mit({ seltenheit: 'rare', wirkungen: ['Treffer verursachen zusätzlich 4W8 Feuerschaden.', 'Rettungswurf gegen SG 21.'] }));
  assert.equal(e.urteil, 'ueber');
  assert.equal(e.befunde.filter((b) => b.stufe === 'warnung').length, 2);
});

test('der Satz nennt Grenzen und SRD-Wert', () => {
  const e = H.eicheMagisch(mit({ seltenheit: 'rare' }));
  assert.match(e.satz.de, /Selten/);
  assert.match(e.satz.de, /4\.000 GM/);
  assert.match(e.satz.en, /4,000 GP/);
});

test('Trank mit Einstimmung: ein Hinweis', () => {
  const e = H.eicheMagisch(mit({ gegenstandsart: 'trank', einstimmung: true }));
  assert.ok(e.befunde.some((b) => b.stufe === 'hinweis'));
});

test('Foundry: nur magische Gegenstaende, mit Seltenheit, Einstimmung und SRD-Wert', () => {
  assert.equal(H.alsFoundryDatei(H.leererEintrag('waffe')), null);
  const d = H.alsFoundryDatei(mit({ seltenheit: 'rare', einstimmung: true, wirkungen: ['Leuchtet im Dunkeln.'] }), () => 0.5);
  const item = JSON.parse(d.inhalt);
  assert.equal(item.name, 'Amulett');
  assert.equal(item.system.rarity, 'rare');
  assert.equal(item.system.attunement, 'required');
  assert.equal(item.system.price.value, 4000);
  assert.match(item.system.description.value, /Leuchtet im Dunkeln/);
  assert.match(d.name, /\.json$/);
});

test('Foundry: das Bild steht in img (ungeprueft), ohne Bild bleibt das Standardsymbol', () => {
  const bild = 'data:image/jpeg;base64,AAAA';
  assert.equal(JSON.parse(H.alsFoundryDatei(mit({ bild })).inhalt).img, bild);
  assert.match(JSON.parse(H.alsFoundryDatei(mit({})).inhalt).img, /^icons\//);
});
