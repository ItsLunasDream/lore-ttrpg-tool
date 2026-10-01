/** Sitzungsprotokoll, der reine Teil (src/shared/protokoll.ts). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../dist/tests/entry.cjs');

const zeit = (h, m) => new Date(2026, 9, 1, h, m).toISOString();

test('Meldungen: nur bekannte Arten, Text gekürzt, Unsinn verworfen', () => {
  assert.equal(P.bereinigeMeldung({ art: 'boese', text: 'x' }), null);
  assert.equal(P.bereinigeMeldung({ art: 'wurf', text: '   ' }), null);
  assert.equal(P.bereinigeMeldung({ art: 'wurf', text: 'a'.repeat(900) }).text.length, 400);
});

test('wichtig: alles außer gewöhnlichen Würfen, solange das Werkzeug nichts anderes sagt', () => {
  assert.equal(P.standardWichtig('wurf'), false);
  assert.equal(P.standardWichtig('beute'), true);
  // Ohne Angabe darf die Meldung nicht „unwichtig" erzwingen (Rauchtest: der Verlauf blieb leer).
  const ohne = P.bereinigeMeldung({ art: 'kampf-beginn', text: 'Kampf beginnt' });
  assert.equal('wichtig' in ohne, false);
  const s = P.mitEintrag(P.neueSitzung(zeit(19, 0), ''), { ...ohne, quelle: 'initiative', zeit: zeit(19, 1) });
  assert.equal(s.eintraege[0].wichtig, true);
  assert.equal(P.bereinigeMeldung({ art: 'wurf', text: '1d20: 20', wichtig: true }).wichtig, true);
});

test('nach dem Ende wird nichts mehr angehängt; Anwesende und Notizen ohne Doppelte', () => {
  let s = P.neueSitzung(zeit(19, 0), '');
  s = P.mitEintrag(s, { art: 'wurf', quelle: 'dice', text: '1d20: 12', zeit: zeit(19, 5) });
  s = P.mitDabei(P.mitDabei(s, ['Mira', 'Jo']), ['Jo', 'Sam']);
  s = P.mitNotiz(P.mitNotiz(s, 'Goblinbande'), 'Goblinbande');
  assert.deepEqual(s.dabei, ['Mira', 'Jo', 'Sam']);
  assert.deepEqual(s.notizen, ['Goblinbande']);
  const zu = { ...s, ende: zeit(22, 0) };
  assert.equal(P.mitEintrag(zu, { art: 'hand', quelle: 'hand', text: 'x', zeit: zeit(22, 1) }).eintraege.length, 1);
});

test('Würfe aus dem Chat: nur Zeilen mit 🎲', () => {
  assert.equal(P.wurfAusChat('🎲 1d20+3: 17  (14 + 3)'), '1d20+3: 17  (14 + 3)');
  assert.equal(P.wurfAusChat('Hallo zusammen'), null);
});

test('Notiz: Verlauf nur Wichtiges mit Verweisen, alle Würfe unten, Abgewähltes fehlt', () => {
  let s = P.neueSitzung(zeit(19, 0), 'Sitzung 12');
  s = P.mitDabei(s, ['Mira']);
  s = P.mitEintrag(s, { art: 'kampf-beginn', quelle: 'initiative', text: 'Kampf gegen Goblinbande begonnen', zeit: zeit(19, 20) });
  s = P.mitEintrag(s, { art: 'wurf', quelle: 'dice', text: '1d20: 12', zeit: zeit(19, 21) });
  s = P.mitEintrag(s, { art: 'wurf', quelle: 'dice', text: '1d20: 20', wichtig: true, zeit: zeit(19, 22) });
  s = P.mitEintrag(s, { art: 'hand', quelle: 'hand', text: 'Geheim', zeit: zeit(19, 30) });
  s = { ...s, ende: zeit(22, 40), eintraege: s.eintraege.map((e) => (e.text === 'Geheim' ? { ...e, weg: true } : e)) };
  const md = P.alsMarkdown(s, 'de', 'Die Gruppe kam an.', ['Goblinbande']);
  assert.match(md, /Dabei: Mira · 19:00–22:40/);
  assert.match(md, /- 19:20 Kampf gegen \[\[Goblinbande\]\] begonnen/);
  const verlauf = md.split('## Verlauf')[1].split('##')[0];
  assert.ok(!/1d20: 12/.test(verlauf), 'gewöhnlicher Wurf nicht im Verlauf');
  assert.ok(/1d20: 20/.test(verlauf), 'eine 20 im Verlauf');
  assert.match(md.split('## Alle Würfe')[1], /1d20: 12/);
  assert.ok(!/Geheim/.test(md), 'abgewählter Eintrag fehlt');
});

test('Verweise: längste Titel zuerst, keine doppelten Klammern, keine Wortteile', () => {
  assert.equal(P.verlinke('Ork und Orkhäuptling', ['Ork', 'Orkhäuptling']), '[[Ork]] und [[Orkhäuptling]]');
  assert.equal(P.verlinke('Borkenhaut', ['Ork']), 'Borkenhaut');
});

test('Zwischenstand: bereinigt, kaputte Einträge fallen weg', () => {
  const s = P.bereinigeSitzung({ beginn: zeit(19, 0), eintraege: [{ id: 3, zeit: zeit(19, 1), art: 'wurf', text: 'x' }, { art: 'boese' }], dabei: ['A', 5] });
  assert.equal(s.eintraege.length, 1);
  assert.deepEqual(s.dabei, ['A']);
  assert.equal(s.naechsteId, 4);
  assert.equal(P.bereinigeSitzung({ beginn: 'kein Datum' }), null);
});
