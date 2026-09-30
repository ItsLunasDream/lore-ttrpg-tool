import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

/** Ein Zufall, der der Reihe nach die gegebenen Werte liefert (0 bis <1). */
function folge(...werte) {
  let i = 0;
  return () => werte[i++ % werte.length];
}

test('Modifikator und Uebungsbonus nach SRD', () => {
  assert.equal(B.modifikator(10), 0);
  assert.equal(B.modifikator(9), -1);
  assert.equal(B.modifikator(1), -5);
  assert.equal(B.modifikator(20), 5);
  assert.deepEqual([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(B.uebungsbonus), [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.equal(B.uebungsbonus(0), 2, 'unsinnige Stufe faellt auf 1');
});

test('Fertigkeiten: Uebung und Expertise, passive Wahrnehmung, Zauber-SG', () => {
  assert.equal(B.FERTIGKEITEN.length, 18);
  assert.equal(B.fertigkeitsBonus(14, 1, 3), 5);
  assert.equal(B.fertigkeitsBonus(14, 2, 3), 8);
  assert.equal(B.passiv(B.fertigkeitsBonus(12, 1, 2)), 13);
  assert.equal(B.zauberSg(16, 3), 14);
  assert.equal(B.zauberAngriff(16, 3), 6);
});

test('Schaden/Heilung lesen: -7 und 7 Schaden, +7 Heilung, Wuerfel', () => {
  assert.equal(B.leseBetrag('7'), -7);
  assert.equal(B.leseBetrag('-7'), -7);
  assert.equal(B.leseBetrag('−7'), -7);
  assert.equal(B.leseBetrag('+5'), 5);
  assert.equal(B.leseBetrag('3+4'), -7);
  assert.equal(B.leseBetrag('+2w4+2', folge(0, 0.99)), 1 + 4 + 2);
  assert.equal(B.leseBetrag('abc'), null);
  assert.equal(B.leseBetrag(''), null);
  assert.equal(B.leseBetrag('0'), null);
});

test('Schaden frisst erst temporaere TP, Heilung nur bis Maximum', () => {
  const w = { ...B.leereWerte(), tp: { max: 20, aktuell: 15, temp: 5 } };
  const nach = B.wendeBetragAn(w, -8);
  assert.deepEqual(nach.tp, { max: 20, aktuell: 12, temp: 0 });
  assert.deepEqual(B.wendeBetragAn(nach, -100).tp.aktuell, 0);
  assert.equal(B.wendeBetragAn(nach, 50).tp.aktuell, 20);
});

test('Heilung von 0 setzt die Todesrettungswuerfe zurueck', () => {
  const w = { ...B.leereWerte(), tp: { max: 20, aktuell: 0, temp: 0 }, todesrettung: { erfolge: 2, fehlschlaege: 1 } };
  const nach = B.wendeBetragAn(w, 3);
  assert.equal(nach.tp.aktuell, 3);
  assert.deepEqual(nach.todesrettung, { erfolge: 0, fehlschlaege: 0 });
});

test('Lange Rast: alle TP und alle Trefferwuerfel, eine Erschoepfung weniger', () => {
  const w = {
    ...B.leereWerte(),
    tp: { max: 30, aktuell: 4, temp: 2 },
    trefferwuerfel: [{ seiten: 10, gesamt: 5, uebrig: 1 }],
    erschoepfung: 2
  };
  const nach = B.langeRast(w);
  assert.equal(nach.tp.aktuell, 30);
  assert.equal(nach.trefferwuerfel[0].uebrig, 5);
  assert.equal(nach.erschoepfung, 1);
});

test('Kurze Rast: Wuerfel plus KON, mindestens 1 je Wuerfel', () => {
  const w = {
    ...B.leereWerte(),
    attribute: { ...B.leereWerte().attribute, kon: 6 },
    tp: { max: 30, aktuell: 10, temp: 0 },
    trefferwuerfel: [{ seiten: 8, gesamt: 3, uebrig: 3 }]
  };
  // Wuerfe 1 und 8, KON -2: 1-2 → 1 (Mindestwert), 8-2 → 6.
  const { werte, wuerfe } = B.kurzeRast(w, { 8: 2 }, folge(0, 0.99));
  assert.deepEqual(wuerfe.map((x) => x.geheilt), [1, 6]);
  assert.equal(werte.tp.aktuell, 17);
  assert.equal(werte.trefferwuerfel[0].uebrig, 1);
  // Mehr als uebrig geht nicht.
  assert.equal(B.kurzeRast(werte, { 8: 9 }, folge(0.5)).werte.trefferwuerfel[0].uebrig, 0);
});

test('Ablage: Datei hin und zurueck ergibt denselben Bogen', () => {
  const b = B.neuerBogen('mira', 'Mira Sturmhand');
  b.werte.klassen = [{ name: 'Waldläuferin', stufe: 5 }];
  b.werte.fertigkeiten = { heimlichkeit: 2, wahrnehmung: 1 };
  b.werte.angriffe = [{ name: 'Langbogen', bonus: '+7', schaden: '1d8+4', notiz: '' }];
  b.notizen = 'Hat einen `Code`-Block?\n```\nnein\n```';
  const md = B.alsMarkdown(b, 'de');
  assert.match(md, /^---\nname: Mira Sturmhand\n/);
  assert.match(md, /^stufe: 5$/m);
  assert.match(md, /Heimlichkeit \+6/, 'Expertise mit PB +3 auf GES 10');
  const zurueck = B.leseBogen(md, 'mira');
  assert.deepEqual(zurueck, b);
});

test('Ablage: kaputte oder fremde Dateien werden zu einem gueltigen Bogen', () => {
  const b = B.leseBogen('---\nname: "Von Hand"\n---\nNur Text.', 'hand');
  assert.equal(b.name, 'Von Hand');
  assert.equal(b.werte.tp.max, 10);
  const u = B.bereinige({ werte: { tp: { max: 5, aktuell: 99 }, attribute: { sta: 99 }, fertigkeiten: { athletik: 7, quatsch: 1 } } }, 'x');
  assert.equal(u.werte.tp.aktuell, 5);
  assert.equal(u.werte.attribute.sta, 30);
  assert.deepEqual(u.werte.fertigkeiten, { athletik: 2 });
});

test('Kennungen: frei und ohne Umlaute', () => {
  assert.equal(B.zuId('Ägir der Große'), 'aegir-der-grosse');
  assert.equal(B.freieKennung('mira', ['mira', 'mira-2']), 'mira-3');
});
