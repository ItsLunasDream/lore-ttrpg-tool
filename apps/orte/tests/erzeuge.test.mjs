/**
 * Erzeuger des Settlement Generators (src/shared/erzeuge.ts).
 * Die SRD-Regeln (Zauberdienste, Magie nach Größe, Preise) stehen hier als
 * Test, damit sie nicht still verrutschen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const O = require('../dist/tests/entry.cjs');

function zufall(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

test('ein Ort hat alle Teile, Größe steuert Läden und Personen', () => {
  for (const groesse of O.GROESSEN) {
    const ort = O.erzeugeOrt({ groesse, lage: null }, 'de', zufall(7));
    assert.equal(ort.groesse, groesse);
    assert.ok(ort.name.length > 3);
    const [lo, hi] = O.EINWOHNER[groesse];
    assert.ok(ort.einwohner >= lo && ort.einwohner <= hi);
    assert.deepEqual(ort.laeden.map((l) => l.art), [...O.LAEDEN_JE_GROESSE[groesse]]);
    assert.equal(ort.personen.length, O.PERSONEN_ANZAHL[groesse]);
    assert.ok(ort.personen[0].rolle.startsWith('Bürgermeister'));
    assert.ok(O.GASTHAUS_QUALITAET[groesse].includes(ort.gasthaus.qualitaet));
    for (const l of ort.laeden) assert.ok(l.waren.length > 0, `${groesse}/${l.art} ohne Waren`);
  }
});

test('SRD: magische Gegenstände nur in Kleinstadt (gewöhnlich) und Stadt (bis selten)', () => {
  assert.equal(O.warenAuswahl('magie', 'dorf', 'de').length, 0);
  const klein = O.warenAuswahl('magie', 'kleinstadt', 'en');
  assert.ok(klein.length > 0 && klein.every((w) => w.seltenheit === 'common' && [50, 100].includes(w.preis)));
  const stadt = O.warenAuswahl('magie', 'stadt', 'en');
  assert.ok(stadt.some((w) => w.seltenheit === 'rare'));
  assert.ok(stadt.every((w) => ['common', 'uncommon', 'rare'].includes(w.seltenheit)));
});

test('SRD: Zauberdienste je Größe (Dorf bis Grad 2, Kleinstadt bis 5, Stadt bis 9)', () => {
  const hoechster = (g) => Math.max(...O.zauberdiensteFuer(g).map((z) => z.bis));
  assert.equal(hoechster('dorf'), 2);
  assert.equal(hoechster('kleinstadt'), 5);
  assert.equal(hoechster('stadt'), 9);
  assert.equal(O.ZAUBERDIENSTE.find((z) => z.grade === '9').kosten, 100000);
});

test('Waren kommen mit SRD-Preisen: Langschwert 15 GM, Dorfschmied ohne Kriegswaffen', () => {
  const stadt = O.warenAuswahl('schmied', 'stadt', 'en');
  assert.equal(stadt.find((w) => w.name === 'Longsword').preis, 15);
  assert.ok(stadt.some((w) => w.name === 'Plate Armor'));
  const dorf = O.warenAuswahl('schmied', 'dorf', 'en');
  assert.ok(!dorf.some((w) => w.name === 'Longsword'));
  assert.ok(O.warenAuswahl('alchemist', 'stadt', 'en').some((w) => /Alchemist/.test(w.name)));
  assert.equal(O.warenAuswahl('alchemist', 'stadt', 'de').length, O.ALCHEMIE_WAREN.length);
});

test('Festhalten: Name und Gasthaus bleiben, ein Teil neu würfeln ändert nur dieses', () => {
  const a = O.erzeugeOrt(O.STANDARD_WUENSCHE, 'de', zufall(1));
  const b = O.erzeugeOrt(O.STANDARD_WUENSCHE, 'de', zufall(99), ['name', 'gasthaus'], a);
  assert.equal(b.name, a.name);
  assert.deepEqual(b.gasthaus, a.gasthaus);
  assert.equal(b.groesse, a.groesse, 'Gasthaus festgehalten: Größe bleibt');
  const c = O.wuerfleNeu(a, 'problem', 'de', zufall(5));
  assert.equal(c.name, a.name);
  assert.deepEqual(c.laeden, a.laeden);
});

test('Hafen-Namen nur an der Küste, Gasthaus-Grammatik stimmt', () => {
  for (let i = 0; i < 200; i += 1) {
    const n = O.erzeugeName('gebirge', 'de', zufall(i));
    assert.ok(!/hafen$|münde$/.test(n), n);
    const g = O.erzeugeGasthaus('dorf', 'de', zufall(i));
    assert.match(g.name, /^Zu[mr] \S+en \S+/);
    const e = O.erzeugeGasthaus('dorf', 'en', zufall(i));
    assert.match(e.name, /^The /);
  }
});
