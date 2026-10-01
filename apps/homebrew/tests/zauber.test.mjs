/**
 * Eichung von Zaubern (src/shared/zauberEichung.ts).
 *
 * Jeder Eichpunkt wird am SRD-Text geprueft (Grad, Wuerfel im Wortlaut),
 * damit die Tabelle nicht still falsch wird. Dazu Leave-one-out wie bei den
 * Waffen: wie oft schlaegt die Eichung bei SRD-Zaubern selbst an?
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const H = require('../dist/tests/entry.cjs');

const text = (z) => z.bloecke.en.map((b) => b.text ?? '').join(' ');

test('jeder Eichpunkt steht so im SRD: Grad und Wuerfel im Wortlaut', () => {
  for (const p of H.ZAUBERPUNKTE) {
    const z = H.ZAUBER.find((x) => x.id === p.id);
    assert.ok(z, `${p.id} fehlt im SRD`);
    assert.equal(z.grad, p.grad, p.id);
    assert.equal(z.konzentration, false, `${p.id}: Eichpunkte ohne Konzentration`);
    for (const w of p.wuerfel) assert.ok(text(z).includes(w), `${p.id}: ${w} nicht im Text`);
    if (p.plus) assert.ok(text(z).includes(`${p.wuerfel[0]} + ${p.plus}`), `${p.id}: + ${p.plus}`);
  }
});

test('Leave-one-out: was die Eichung bei SRD-Zaubern selbst meldet', () => {
  const urteile = H.ZAUBERPUNKTE.map((p) => [p.id, H.urteilZauber(p.grad, p.ziel, H.punktSchnitt(p), p.id)]);
  const stark = urteile.filter(([, u]) => u === 'ueber' || u === 'weit_ueber').map(([id]) => id);
  // Ehrlich festgehalten:
  // - scorching-ray: ohne ihn bleibt fuer Grad 2 nur der Saeurepfeil (10); drei Strahlen sind 21.
  // - disintegrate: 10W6 + 40 liegt klar ueber Leid und Kettenblitz, gilt auch am Tisch als stark.
  // - meteor-swarm: einziger Grad-9-Punkt; ohne ihn gilt Grad 8 (Sonnenexplosion 42).
  assert.deepEqual(stark, ['scorching-ray', 'disintegrate', 'meteor-swarm']);
  assert.ok(urteile.filter(([, u]) => u !== 'im_rahmen').length <= 8);
});

test('ein Feuerball mit 8W6 ist im Rahmen, mit 14W6 deutlich staerker', () => {
  const z = { ...H.leererEintrag('zauber'), name: 'X', grad: 3, ziel: 'flaeche', schadenAnzahl: 8, schadenSeiten: 6, rettungswurf: 'ges', halbBeiErfolg: true };
  const e = H.eicheZauber(z);
  assert.equal(e.urteil, 'im_rahmen');
  assert.match(e.satz.de, /Feuerball/);
  assert.equal(H.eicheZauber({ ...z, schadenAnzahl: 14 }).urteil, 'weit_ueber');
  assert.equal(H.eicheZauber({ ...z, schadenAnzahl: 3 }).urteil, 'unter');
});

test('Grad ohne eigenen Eichpunkt wird gemittelt, Zauber ohne Schaden nicht geeicht', () => {
  const b = H.zauberBand(3, 'einzel');
  assert.equal(b.gemittelt, true);
  assert.ok(b.lo > 0 && b.hi < Infinity);
  const ohne = H.eicheZauber({ ...H.leererEintrag('zauber'), name: 'Y', schadenAnzahl: 0 });
  assert.equal(ohne.urteil, null);
});

test('Hinweise: Konzentration und Flaeche ohne halben Schaden', () => {
  const z = { ...H.leererEintrag('zauber'), name: 'Z', grad: 3, ziel: 'flaeche', schadenAnzahl: 8, schadenSeiten: 6, rettungswurf: 'ges', halbBeiErfolg: false, konzentration: true, dauer: 'Konzentration, bis zu 1 Minute' };
  const texte = H.eicheZauber(z).befunde.map((b) => b.text.de).join(' ');
  assert.match(texte, /Konzentration/);
  assert.match(texte, /halben Schaden/);
});

test('Schul- und Klassennamen stehen so in den Gradzeilen des SRD', () => {
  for (const z of H.ZAUBER) {
    const s = H.SCHULE_NAME[z.schule];
    assert.ok(z.gradzeile.en.includes(s.en), `${z.id}: ${s.en}`);
    const deStamm = s.de.replace('ö', 'ö');
    assert.ok(z.gradzeile.de.includes(deStamm) || z.gradzeile.de.includes(deStamm.replace('Bann', 'Banns')), `${z.id}: ${s.de} in ${z.gradzeile.de}`);
    for (const k of z.klassen) {
      assert.ok(z.gradzeile.en.includes(H.KLASSE_NAME[k].en), `${z.id}: ${k}`);
      assert.ok(z.gradzeile.de.includes(H.KLASSE_NAME[k].de), `${z.id}: ${k}`);
    }
  }
});
