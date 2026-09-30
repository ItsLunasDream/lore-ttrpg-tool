import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

const GASTGEBER = { id: 'gastgeber', name: 'Lea', sl: true };
const ANNA = { id: 'g1', name: 'Anna' };
const BEN = { id: 'g2', name: 'Ben' };

function figur(name, tp = 20) {
  const b = B.neuerBogen(B.zuId(name), name);
  return { ...b, werte: { ...b.werte, tp: { max: tp, aktuell: tp, temp: 0 }, rk: 15 } };
}

function tisch() {
  const t = new B.LiveTisch(() => '2026-01-01T00:00:00.000Z');
  t.setzePersonen([GASTGEBER, ANNA, BEN]);
  return t;
}

const an = (aus, id) => aus.filter((a) => a.an === id).map((a) => a.meldung);

test('Schritte aus zwei Staenden: nur was sich geaendert hat, Listen als Ganzes', () => {
  const alt = figur('Thorin');
  const neu = {
    ...alt,
    name: 'Thorin II',
    fassung: 9,
    werte: { ...alt.werte, rk: 16, angriffe: [{ name: 'Axt', bonus: '+5', schaden: '1d8+3', notiz: '' }] }
  };
  const schritte = B.schritteAus(alt, neu);
  assert.deepEqual(
    schritte.map((s) => s.pfad.join('.')).sort(),
    ['name', 'werte.angriffe', 'werte.rk']
  );
  let b = alt;
  for (const s of schritte) b = B.wendeSchrittAn(b, s);
  assert.equal(b.name, 'Thorin II');
  assert.equal(b.werte.rk, 16);
  assert.equal(b.werte.angriffe[0].name, 'Axt');
  assert.equal(b.fassung, alt.fassung, 'die Fassung setzt nur der Tisch');
});

test('Unerlaubte Schritte werden verworfen', () => {
  const b = figur('Thorin');
  assert.equal(B.wendeSchrittAn(b, { typ: 'feld', pfad: ['id'], wert: 'x' }), null);
  assert.equal(B.wendeSchrittAn(b, { typ: 'feld', pfad: ['verlauf'], wert: [] }), null);
  assert.equal(B.wendeSchrittAn(b, { typ: 'feld', pfad: ['werte', '__proto__', 'x'], wert: 1 }), null);
  assert.equal(B.wendeSchrittAn(b, { typ: 'betrag', text: 'abc' }), null);
  // Unsinn im Wert wird zurechtgerueckt, wie beim Lesen einer Datei.
  const r = B.wendeSchrittAn(b, { typ: 'feld', pfad: ['werte', 'rk'], wert: 'viel' });
  assert.equal(typeof r.werte.rk, 'number');
});

test('Zwei Treffer gleichzeitig: beide zaehlen', () => {
  const t = tisch();
  t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf', 30) });
  const id = 'g1/anna-elf';
  t.anfrage('g1', { art: 'schritte', id, nr: 1, schritte: [{ typ: 'betrag', text: '-7' }] });
  t.anfrage('gastgeber', { art: 'schritte', id, nr: 1, schritte: [{ typ: 'betrag', text: '5' }] });
  const bogen = t.ansichtFuer('g1')[0].bogen;
  assert.equal(bogen.werte.tp.aktuell, 18);
});

test('Rechte: fremde Boegen aendert nur die SL; Freigabe steuert die Sicht', () => {
  const t = tisch();
  const aus = t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf') });
  const id = 'g1/anna-elf';
  // Vorgabe Uebersicht: Ben sieht TP-Stufe, nicht den Bogen.
  const benSicht = an(aus, 'g2')[0].eintrag;
  assert.equal(benSicht.sicht, 'uebersicht');
  assert.equal(benSicht.bogen, undefined);
  assert.equal(benSicht.uebersicht.tpStufe, 'voll');
  assert.equal(an(aus, 'gastgeber')[0].eintrag.sicht, 'voll', 'die SL sieht alles');

  const abgelehnt = t.anfrage('g2', { art: 'schritte', id, nr: 1, schritte: [{ typ: 'feld', pfad: ['name'], wert: 'X' }] });
  assert.equal(an(abgelehnt, 'g2')[0].grund, 'recht');
  assert.equal(t.anfrage('g2', { art: 'freigabe', id, freigabe: 'alles' })[0].meldung.grund, 'recht');

  const nichts = t.anfrage('g1', { art: 'freigabe', id, freigabe: 'nichts' });
  assert.equal(an(nichts, 'g2')[0].art, 'weg');
  assert.equal(t.ansichtFuer('g2').length, 0);
  t.anfrage('g1', { art: 'freigabe', id, freigabe: 'alles' });
  assert.equal(t.ansichtFuer('g2')[0].sicht, 'voll');
  assert.equal(t.ansichtFuer('g2')[0].darfAendern, false);
});

test('SL-Aenderungen: sichtbar markiert, still nur fuer die SL, bestaetigen raeumt auf', () => {
  const t = tisch();
  t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf') });
  const id = 'g1/anna-elf';
  t.anfrage('gastgeber', { art: 'schritte', id, nr: 1, schritte: [{ typ: 'feld', pfad: ['werte', 'rk'], wert: 12 }] });
  t.anfrage('gastgeber', { art: 'schritte', id, nr: 2, still: true, schritte: [{ typ: 'feld', pfad: ['werte', 'zustaende'], wert: ['vergiftet'] }] });
  const anna = t.ansichtFuer('g1')[0];
  assert.equal(anna.slAenderungen.length, 1, 'die stille sieht Anna nicht');
  assert.deepEqual(anna.slAenderungen[0].felder, ['werte.rk']);
  assert.equal(anna.slAenderungen[0].alt['werte.rk'], '15', 'der alte Wert fuers Darueberfahren');
  assert.equal(anna.bogen.werte.zustaende[0], 'vergiftet', 'aber die Wirkung schon');
  assert.equal(t.ansichtFuer('gastgeber')[0].slAenderungen.length, 2);
  // Eigene Aenderungen markieren nichts.
  t.anfrage('g1', { art: 'schritte', id, nr: 1, schritte: [{ typ: 'feld', pfad: ['notizen'], wert: 'x' }] });
  assert.equal(t.ansichtFuer('g1')[0].slAenderungen.length, 1);
  assert.equal(t.anfrage('gastgeber', { art: 'bestaetige', id })[0].meldung.grund, 'recht', 'bestaetigen kann nur die Besitzerin');
  t.anfrage('g1', { art: 'bestaetige', id });
  assert.equal(t.ansichtFuer('g1')[0].slAenderungen.length, 0);
  assert.equal(t.ansichtFuer('gastgeber')[0].slAenderungen.length, 2, 'die SL behaelt den Verlauf');
});

test('Quittung, Fassung und wer zuletzt geaendert hat', () => {
  const t = tisch();
  t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf') });
  const id = 'g1/anna-elf';
  const aus = t.anfrage('g1', { art: 'schritte', id, nr: 7, schritte: [{ typ: 'feld', pfad: ['werte', 'rk'], wert: 17 }] });
  const e = an(aus, 'g1')[0].eintrag;
  assert.equal(e.quittung, 7);
  assert.equal(e.bogen.fassung, 1);
  assert.equal(e.zuletzt.name, 'Anna');
  assert.equal(an(aus, 'gastgeber')[0].eintrag.quittung, 0, 'die Quittung gilt je Person');
});

test('Wer geht, nimmt seine Boegen mit; Rollenwechsel verteilt neu', () => {
  const t = tisch();
  t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf') });
  t.anfrage('g2', { art: 'bringe', bogen: figur('Ben Zwerg') });
  const neu = t.setzePersonen([GASTGEBER, { ...BEN, sl: true }]);
  assert.ok(neu.every((a) => a.meldung.art === 'stand'));
  assert.deepEqual(t.ansichtFuer('gastgeber').map((e) => e.id), ['g2/ben-zwerg']);
  assert.equal(t.anfrage('g1', { art: 'hallo' }).length, 0, 'wer weg ist, bekommt nichts');
});

test('Grenzen: hoechstens zwoelf Boegen je Person', () => {
  const t = tisch();
  for (let n = 0; n < B.MAX_BOEGEN_JE_PERSON; n += 1) t.anfrage('g1', { art: 'bringe', bogen: figur(`Figur ${n}`) });
  const aus = t.anfrage('g1', { art: 'bringe', bogen: figur('Eine zu viel') });
  assert.equal(aus[0].meldung.grund, 'voll');
  // Denselben Bogen noch einmal bringen ersetzt ihn.
  assert.equal(t.anfrage('g1', { art: 'bringe', bogen: figur('Figur 0') })[0].meldung.art, 'bogen');
});

test('Meldungen vom Gastgeber werden geprueft', () => {
  assert.equal(B.leseMeldung('kein json'), null);
  assert.equal(B.leseMeldung(JSON.stringify({ art: 'bogen', eintrag: { id: 1 } })), null);
  const t = tisch();
  const aus = t.anfrage('g1', { art: 'bringe', bogen: figur('Anna Elf') });
  const gelesen = B.leseMeldung(JSON.stringify(an(aus, 'g1')[0]));
  assert.equal(gelesen.eintrag.bogen.name, 'Anna Elf');
});
