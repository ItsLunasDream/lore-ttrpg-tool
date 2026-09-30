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

test('Zauber: Klassen aus Namen, Suche in beiden Sprachen', () => {
  assert.deepEqual(B.klassenAusNamen(['Magierin', 'Waldläuferin', 'Kämpfer']).sort(), ['magier', 'waldlaeufer']);
  assert.deepEqual(B.klassenAusNamen(['Wizard']), ['magier']);
  const feuer = B.sucheZauber('feuerball', {}, 'de');
  assert.equal(feuer[0]?.id, 'fireball');
  assert.equal(B.sucheZauber('fireball', {}, 'en')[0]?.id, 'fireball');
  assert.ok(B.sucheZauber('', { grad: 0, klasse: 'magier' }, 'de').every((z) => z.grad === 0 && z.klassen.includes('magier')));
});

test('Zauber: Plaetze verbrauchen, lange Rast fuellt, kurze nur bei Paktmagie', () => {
  let w = { ...B.leereWerte(), zauber: B.leereZauberei('int') };
  w.zauber.plaetze[0].max = 2;
  w.zauber.plaetze[2].max = 1;
  assert.equal(B.freierPlatz(w.zauber, 1), 1);
  w = { ...w, zauber: B.verbrauche(B.verbrauche(w.zauber, 1), 1) };
  assert.equal(B.freierPlatz(w.zauber, 1), 3, 'Grad 1 leer, naechster freier ist 3');
  assert.equal(B.verbrauche(w.zauber, 1).plaetze[0].verbraucht, 2, 'mehr als max geht nicht');
  assert.equal(B.kurzeRast(w, {}).werte.zauber.plaetze[0].verbraucht, 2);
  assert.equal(B.langeRast(w).zauber.plaetze[0].verbraucht, 0);
  const pakt = { ...w, zauber: { ...w.zauber, kurzeRast: true } };
  assert.equal(B.kurzeRast(pakt, {}).werte.zauber.plaetze[0].verbraucht, 0);
});

test('Zauber: vorbereitete zaehlen ohne Zaubertricks und ohne „immer"', () => {
  const z = B.leereZauberei();
  z.liste = [
    { srd: 'fire-bolt', vorbereitet: true, immer: false, herkunft: '' },
    { srd: 'fireball', vorbereitet: true, immer: false, herkunft: '' },
    { srd: 'shield', vorbereitet: true, immer: true, herkunft: '' },
    { eigen: { name: 'Nebelhand', grad: 1, text: '' }, vorbereitet: true, immer: false, herkunft: '' }
  ];
  assert.equal(B.vorbereiteteAnzahl(z), 2);
  assert.deepEqual(B.sortiert(z.liste, 'de').map((e) => B.nameVon(e, 'de')), ['Feuerpfeil', 'Nebelhand', 'Schild', 'Feuerball']);
});

test('Zauber: ueberstehen Speichern und Einlesen, Unsinn faellt weg', () => {
  const b = B.neuerBogen('z', 'Zaubernde');
  b.werte.zauber = B.leereZauberei('cha');
  b.werte.zauber.plaetze[0] = { grad: 1, max: 4, verbraucht: 1 };
  b.werte.zauber.liste = [{ srd: 'magic-missile', vorbereitet: true, immer: false, herkunft: 'Buch' }];
  assert.deepEqual(B.leseBogen(B.alsMarkdown(b, 'en'), 'z'), b);
  const u = B.bereinige({ werte: { zauber: { attribut: 'xx', plaetze: [{ grad: 1, max: 50, verbraucht: 99 }], liste: [{}, { eigen: { name: '' } }] } } }, 'u');
  assert.equal(u.werte.zauber.attribut, 'int');
  assert.deepEqual(u.werte.zauber.plaetze[0], { grad: 1, max: 9, verbraucht: 9 });
  assert.equal(u.werte.zauber.liste.length, 0);
});

const geld = (pm = 0, gm = 0, em = 0, sm = 0, km = 0) => ({ pm, gm, em, sm, km });

test('Geld: Wert in Gold nach der Tabelle des SRD', () => {
  assert.equal(B.inGold(geld(1, 2, 1, 3, 4)), 10 + 2 + 0.5 + 0.3 + 0.04);
  assert.equal(B.anzahlMuenzen(geld(1, 2, 1, 3, 4)), 11);
});

test('Geld umrechnen: wenige Muenzen ohne Elektrum, oder alles in Gold', () => {
  assert.deepEqual(B.rechneUm(geld(0, 0, 3, 25, 130), 'wenige'), geld(0, 5, 0, 3, 0));
  assert.deepEqual(B.rechneUm(geld(0, 0, 0, 0, 1234), 'wenige'), geld(1, 2, 0, 3, 4));
  assert.deepEqual(B.rechneUm(geld(2, 0, 0, 0, 5), 'gold'), geld(0, 20, 0, 0, 5));
});

test('Geld: abziehen nur, wenn es reicht; aufteilen mit Rest', () => {
  assert.equal(B.zieheAb(geld(0, 5), { gm: 6 }), null);
  assert.deepEqual(B.zieheAb(geld(0, 5, 0, 2), { gm: 5, sm: 1 }), geld(0, 0, 0, 1));
  const { jeder, rest } = B.teileAuf(geld(1, 10, 0, 7), 3);
  assert.deepEqual(jeder, geld(0, 3, 0, 2));
  assert.deepEqual(rest, geld(1, 1, 0, 1));
});

test('Summen: unbekannte Werte markieren, Muenzgewicht nur auf Wunsch', () => {
  const liste = [
    { ...B.neuerGegenstand('Seil'), anzahl: 2, gewicht: 5, wert: 1 },
    { ...B.neuerGegenstand('Ring'), gewicht: null, wert: null, eingestimmt: true }
  ];
  const s = B.summen(liste, geld(0, 50), false);
  assert.equal(s.gewicht, 10);
  assert.equal(s.gewichtUnvollstaendig, true);
  assert.equal(s.wert, 52);
  assert.equal(s.eingestimmt, 1);
  assert.equal(B.summen(liste, geld(0, 50), true).gewicht, 11, '50 Muenzen = 1 lb');
  // Beide Einheiten, damit am Tisch niemand umrechnen muss.
  assert.equal(B.gewichtAnzeige(11, 'de'), '5,5 kg (11 lb)');
  assert.equal(B.gewichtAnzeige(11, 'en'), '11 lb (5.5 kg)');
  assert.equal(B.gewichtAusEingabe('2,5', 'de'), 5);
  assert.equal(B.gewichtAusEingabe('', 'de'), null);
});

test('Uebergabe: Teil eines Stapels, ganzer Stapel, Geld, mit Verlauf', () => {
  const a = B.neuerBogen('a', 'Mira');
  const gruppe = B.neuerBogen('g', 'Gruppe', 'gruppe');
  a.gegenstaende = [{ ...B.neuerGegenstand('Pfeil'), anzahl: 20, ausgeruestet: true }];
  a.muenzen = geld(0, 10);
  const teil = B.uebergib(a, gruppe, { art: 'gegenstand', gegenstandId: a.gegenstaende[0].id, anzahl: 5 }, 'de', 'T');
  assert.equal(teil.von.gegenstaende[0].anzahl, 15);
  assert.equal(teil.nach.gegenstaende[0].anzahl, 5);
  assert.notEqual(teil.nach.gegenstaende[0].id, a.gegenstaende[0].id);
  assert.equal(teil.nach.gegenstaende[0].ausgeruestet, false);
  assert.deepEqual(teil.nach.verlauf[0], { zeit: 'T', text: '5 × Pfeil von Mira' });
  const ganz = B.uebergib(teil.von, teil.nach, { art: 'gegenstand', gegenstandId: a.gegenstaende[0].id, anzahl: 15 }, 'de');
  assert.equal(ganz.von.gegenstaende.length, 0);
  assert.equal(B.uebergib(a, gruppe, { art: 'gegenstand', gegenstandId: 'x', anzahl: 1 }, 'de'), null);
  assert.equal(B.uebergib(a, a, { art: 'geld', betrag: { gm: 1 } }, 'de'), null);
  assert.equal(B.uebergib(a, gruppe, { art: 'geld', betrag: { gm: 11 } }, 'de'), null);
  const g = B.uebergib(a, gruppe, { art: 'geld', betrag: { gm: 4 } }, 'en');
  assert.equal(g.von.muenzen.gm, 6);
  assert.equal(g.nach.muenzen.gm, 4);
  assert.equal(g.von.verlauf[0].text, '4 GP to Gruppe');
});

test('Inventar ueberlebt Speichern und Einlesen', () => {
  const b = B.neuerBogen('i', 'Inventar');
  b.gegenstaende = [{ ...B.neuerGegenstand('Seil'), gewicht: 5, wert: 1, quelle: { art: 'srd', kennung: 'rope' } }];
  b.muenzen = geld(1, 2, 3, 4, 5);
  b.muenzgewicht = true;
  b.verlauf = [{ zeit: 'T', text: 'x' }];
  assert.deepEqual(B.leseBogen(B.alsMarkdown(b, 'de'), 'i'), b);
  const u = B.bereinige({ gegenstaende: [{ name: '' }, { name: 'A', anzahl: -3, gewicht: -1, wert: 'x' }] }, 'u');
  assert.equal(u.gegenstaende.length, 1);
  assert.equal(u.gegenstaende[0].anzahl, 1);
  assert.equal(u.gegenstaende[0].gewicht, null);
});
