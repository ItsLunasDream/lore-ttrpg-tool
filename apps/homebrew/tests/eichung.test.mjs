/**
 * Eichung von Waffen und Ruestungen (src/shared/eichung.ts).
 *
 * Leave-one-out: jede SRD-Waffe wird gegen die uebrigen geprueft. Das ist das
 * ehrliche Mass dafuer, wie oft die Eichung bei Waffen anschlaegt, die das
 * SRD selbst fuer richtig haelt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const H = require('../dist/tests/entry.cjs');

const kern = (w) => ({ kategorie: w.kategorie, fern: w.fern, wuerfel: w.wuerfel, merkmale: w.merkmale });

test('Leave-one-out Waffen: nur die Pistole gilt als zu stark', () => {
  const zuStark = H.WAFFEN.filter((w) => ['ueber', 'weit_ueber'].includes(H.urteilWaffe(kern(w), w.id).urteil)).map((w) => w.id);
  assert.deepEqual(zuStark, ['pistol']);
  const gemeldet = H.WAFFEN.filter((w) => H.urteilWaffe(kern(w), w.id).urteil !== 'im_rahmen');
  assert.ok(gemeldet.length <= 3, gemeldet.map((w) => w.id).join(', '));
});

test('Leave-one-out Ruestungen: nie „weit ueber", „ueber" nur die besten ihrer Art', () => {
  const urteile = H.RUESTUNGEN.map((r) => [r.id, H.urteilRuestung(r, r.id).urteil]);
  assert.ok(urteile.every(([, u]) => u !== 'weit_ueber'));
  assert.deepEqual(
    urteile.filter(([, u]) => u === 'ueber').map(([id]) => id),
    ['studded-leather-armor', 'half-plate-armor', 'plate-armor']
  );
});

function waffe(teil) {
  return { ...H.leererEintrag('waffe'), ...teil };
}

test('ein Langschwert-Nachbau ist im Rahmen, ein 2W8-Langschwert nicht', () => {
  const lang = waffe({ kategorie: 'kriegs', wuerfel: '1d8', eigenschaften: ['vielseitig'], vielseitig: '1d10' });
  assert.equal(H.eicheWaffe(lang).urteil, 'im_rahmen');
  assert.ok(H.eicheWaffe(lang).vergleich.some((w) => w.id === 'longsword'));
  const stark = waffe({ kategorie: 'kriegs', wuerfel: '2d8', eigenschaften: ['vielseitig'], vielseitig: '2d10' });
  assert.equal(H.eicheWaffe(stark).urteil, 'weit_ueber');
});

test('Widersprueche werden gemeldet', () => {
  const w = waffe({ eigenschaften: ['leicht', 'zweihaendig'] });
  assert.ok(H.eicheWaffe(w).befunde.some((b) => b.stufe === 'warnung' && /Leicht und zweihändig/.test(b.text.de)));
  const v = waffe({ eigenschaften: ['vielseitig'], wuerfel: '1d8', vielseitig: '1d6' });
  assert.ok(H.eicheWaffe(v).befunde.some((b) => /zweihändige Würfel/.test(b.text.de)));
});

test('magischer Bonus: Seltenheit aus den Eichpunkten des SRD', () => {
  assert.equal(H.eicheWaffe(waffe({ bonus: 0 })).seltenheit, null);
  assert.equal(H.eicheWaffe(waffe({ bonus: 1 })).seltenheit, 'uncommon');
  assert.equal(H.eicheWaffe(waffe({ bonus: 3 })).seltenheit, 'veryRare');
  const r = { ...H.leererEintrag('ruestung'), bonus: 1 };
  assert.equal(H.eicheRuestung(r).seltenheit, 'rare');
});

test('Ruestung: Brustplatte ohne Nachteil ist SRD, Ritterruestung ohne Staerke billig ist ueber', () => {
  const brust = { ...H.leererEintrag('ruestung'), ruestungsart: 'mittel', rk: 14, preis: 400 };
  assert.equal(H.eicheRuestung(brust).urteil, 'im_rahmen');
  const billig = { ...H.leererEintrag('ruestung'), ruestungsart: 'schwer', rk: 18, staerke: 0, heimlichkeitNachteil: false, preis: 100 };
  assert.equal(H.eicheRuestung(billig).urteil, 'ueber');
  const riesig = { ...H.leererEintrag('ruestung'), ruestungsart: 'leicht', rk: 15 };
  assert.equal(H.eicheRuestung(riesig).urteil, 'weit_ueber');
});

test('bereinige: Unsinn wird zu gueltigen Werten', () => {
  const e = H.bereinige({ art: 'waffe', name: 'X', wuerfel: 'drei', eigenschaften: ['leicht', 'fliegend'], bonus: 9, bild: 'javascript:x' }, 'x');
  assert.equal(e.wuerfel, '1d8');
  assert.deepEqual(e.eigenschaften, ['leicht']);
  assert.equal(e.bonus, 3);
  assert.equal(e.bild, null);
  assert.equal(H.bereinige({ art: 'gibtsnicht' }, 'y').art, 'gegenstand');
});

test('Inventar: eine eigene Waffe bringt ihre Kampfwerte mit, Zauber kommen nicht ins Inventar', () => {
  const w = { ...H.leererEintrag('waffe'), id: 'sturmklinge', name: 'Sturmklinge', wuerfel: '1d8', eigenschaften: ['finesse', 'vielseitig'], vielseitig: '1d10', schadensart: 'blitz', bonus: 1 };
  const x = H.inventarEintrag(w, 'de');
  assert.equal(x.quelle, 'homebrew');
  assert.equal(x.waffe.magie, 1);
  assert.deepEqual(x.waffe.eigen.art, ['Blitz', 'Lightning']);
  assert.equal(x.waffe.eigen.vielseitig, '1d10');
  assert.equal(x.waffe.eigen.finesse, true);
  assert.match(x.waffe.eigen.eigenschaften[0], /Vielseitig \(1W10\)/);
  assert.equal(H.inventarEintrag({ ...H.leererEintrag('zauber'), name: 'Z' }, 'de'), null);
});

test('Waffe: Plus und Zusatzschaden zählen zum Schnitt, alte Dateien bekommen Standardwerte', () => {
  const basis = { ...H.leererEintrag('waffe'), wuerfel: '1d8', kategorie: 'kriegs', fern: false };
  const mit = { ...basis, schadenPlus: 2, zusatz: [{ wuerfel: '1d6', plus: 0, art: 'feuer' }] };
  assert.equal(H.zusatzSchnitt(mit), 2 + 3.5);
  assert.ok(H.eicheWaffe(mit).befunde.some((b) => /Plus/.test(b.text.de)));
  assert.equal(H.kurzzeile(mit, 'de').includes('1W8 + 2 Hieb + 1W6 Feuer'), true);
  // Datei von vor dieser Änderung: ohne die neuen Felder.
  const alt = H.bereinige({ art: 'waffe', name: 'Alt', wuerfel: '1d8', eigenschaften: ['reichweite'] }, 'alt');
  assert.deepEqual([alt.schadenPlus, alt.zusatz, alt.reichweiteNah], [0, [], 10]);
  const kaputt = H.bereinige({ art: 'waffe', zusatz: [{ wuerfel: 'xx', plus: 999, art: 'nix' }, 1, 2, 3, 4, 5] }, 'k');
  assert.equal(kaputt.zusatz.length, 4);
  assert.deepEqual(kaputt.zusatz[0], { wuerfel: '1d6', plus: 50, art: 'feuer' });
});

test('Zauber: Wirkungen, eigene Klassen und Unterklassen', () => {
  const alt = H.bereinige({ art: 'zauber', name: 'Alt', schadenAnzahl: 3 }, 'a');
  assert.deepEqual(alt.wirkungen, ['schaden'], 'alter Zauber mit Würfeln bleibt ein Schadenszauber');
  assert.deepEqual(H.bereinige({ art: 'zauber', name: 'Hand' }, 'h').wirkungen, []);
  const heil = { ...H.leererEintrag('zauber'), wirkungen: ['heilung', 'zustand'], heilAnzahl: 2, heilSeiten: 8, heilPlus: 0, zustand: 'Gelähmt', eigeneKlassen: ['Blutjäger'], unterklassen: ['Kleriker: Lichtdomäne'] };
  const e = H.eicheZauber(heil);
  assert.equal(e.urteil, null);
  assert.ok(e.befunde.some((b) => /Heilung im Schnitt 9/.test(b.text.de)));
  assert.ok(e.befunde.some((b) => /Zustände/.test(b.text.de)));
  const text = H.zauberText(heil, 'de');
  assert.match(text, /Heilung 2W8/);
  assert.match(text, /Gelähmt/);
  assert.match(text, /Klassen: Blutjäger/);
  assert.match(text, /Unterklassen: Kleriker: Lichtdomäne/);
  // Schadenswürfel ohne angehakten Schaden zählen nicht.
  assert.equal(H.eicheZauber({ ...heil, schadenAnzahl: 8 }).urteil, null);
});

test('Erklärungen: jede Eigenschaft, Meisterschaft und Schule hat einen Satz in beiden Sprachen', () => {
  for (const tab of [H.EIGENSCHAFT_TEXT, H.MEISTERSCHAFT_TEXT, H.SCHULE_TEXT]) {
    for (const [k, p] of Object.entries(tab)) assert.ok(p.de.length > 10 && p.en.length > 10, k);
  }
  assert.equal(Object.keys(H.MEISTERSCHAFT_TEXT).length, 8);
  assert.equal(Object.keys(H.SCHULE_TEXT).length, 8);
});
