/** Terminumfrage (src/shared/modell.ts). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const K = require('../dist/tests/entry.cjs');

const basis = () => ({
  ...K.leereUmfrage('runde', '2026-10-01'),
  titel: 'Runde 12',
  tage: ['2026-10-02', '2026-10-03'],
  von: 18 * 60,
  bis: 23 * 60,
  schritt: 60,
  dauer: 3 * 60
});
const alle = (tag, von, bis, stufe = 'kann') => {
  const f = {};
  for (let m = von; m < bis; m += 60) f[K.feld(tag, m)] = stufe;
  return f;
};

test('Tage nur an gewählten Wochentagen, höchstens 31', () => {
  // 2026-10-02 ist ein Freitag.
  assert.deepEqual(K.tageZwischen('2026-10-01', '2026-10-07', [5, 6]), ['2026-10-02', '2026-10-03']);
  assert.equal(K.tageZwischen('2026-01-01', '2026-12-31').length, 31);
  assert.deepEqual(K.zeiten({ von: 18 * 60, bis: 20 * 60, schritt: 30 }), [1080, 1110, 1140, 1170]);
});

test('beste Termine: nur wer das ganze Fenster kann, je Tag ein Vorschlag', () => {
  let u = basis();
  u = K.mitAntwort(u, { person: 'Mira', felder: alle('2026-10-02', 18 * 60, 23 * 60), zeit: '1' });
  u = K.mitAntwort(u, { person: 'Jo', felder: alle('2026-10-02', 19 * 60, 22 * 60), zeit: '1' });
  u = K.mitAntwort(u, { person: 'Sam', felder: { ...alle('2026-10-02', 19 * 60, 23 * 60, 'notfalls'), ...alle('2026-10-03', 18 * 60, 21 * 60) }, zeit: '1' });
  const v = K.besteTermine(u);
  assert.equal(v[0].tag, '2026-10-02');
  assert.equal(v[0].von, 19 * 60);
  assert.equal(v[0].bis, 22 * 60);
  assert.deepEqual(v[0].kann.sort(), ['Jo', 'Mira']);
  assert.deepEqual(v[0].notfalls, ['Sam']);
  assert.equal(v.filter((x) => x.tag === '2026-10-02').length, 1);
  assert.equal(v[1].tag, '2026-10-03');
});

test('Zusammenführen: je Person die neuere Antwort, Name ohne Groß/klein', () => {
  let u = K.mitAntwort(basis(), { person: 'Mira', felder: { '2026-10-02T1080': 'kann' }, zeit: '2026-10-01T10:00' });
  u = K.mitAntwort(u, { person: 'mira', felder: {}, zeit: '2026-10-01T09:00' });
  assert.equal(Object.keys(u.antworten[0].felder).length, 1, 'ältere Antwort überschreibt nicht');
  const fremd = K.mitAntwort(basis(), { person: 'Jo', felder: {}, zeit: '1' });
  const z = K.fuehreZusammen(u, { ...fremd, termin: { tag: '2026-10-02', von: 1140, bis: 1320 } });
  assert.deepEqual(z.antworten.map((a) => a.person).sort(), ['Jo', 'Mira']);
  assert.equal(z.termin.von, 1140);
});

test('.ics mit Zeiten ohne Zeitzone und Zeilenende CRLF', () => {
  assert.equal(K.alsIcs(basis()), null);
  const ics = K.alsIcs({ ...basis(), termin: { tag: '2026-10-02', von: 19 * 60, bis: 25 * 60 } }, new Date('2026-10-01T08:00:00Z'));
  assert.match(ics, /DTSTART:20261002T190000\r\n/);
  assert.match(ics, /DTEND:20261003T010000\r\n/, 'über Mitternacht: nächster Tag');
  assert.match(ics, /SUMMARY:Runde 12/);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});

test('Nachrichten: Unsinn wird verworfen, Antworten treffen nur bekannte Umfragen', () => {
  assert.equal(K.leseNachricht('kein json'), null);
  assert.equal(K.leseNachricht(JSON.stringify({ art: 'antwort', umfrageId: '../x', antwort: { person: 'A' } })), null);
  const n = K.leseNachricht(JSON.stringify({ art: 'antwort', umfrageId: 'runde', antwort: { person: 'Mira', felder: { '2026-10-02T1080': 'kann', boese: 'ja' }, zeit: '2' } }));
  assert.deepEqual(n.antwort.felder, { '2026-10-02T1080': 'kann' });
  assert.equal(K.wendeAn(null, n), null);
  assert.equal(K.wendeAn(basis(), n).antworten.length, 1);
  const neu = K.leseNachricht(JSON.stringify({ art: 'umfrage', umfrage: { ...basis(), id: 'runde' } }));
  assert.equal(K.wendeAn(null, neu).titel, 'Runde 12');
});
