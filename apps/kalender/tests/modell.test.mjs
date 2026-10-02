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

test('Filter: Personen ausblenden, Mindestzahl, Pflichtperson', () => {
  let u = basis();
  u = K.mitAntwort(u, { person: 'SL', felder: alle('2026-10-02', 18 * 60, 21 * 60), zeit: '1' });
  u = K.mitAntwort(u, { person: 'Mira', felder: { ...alle('2026-10-02', 18 * 60, 21 * 60), ...alle('2026-10-03', 18 * 60, 21 * 60) }, zeit: '1' });
  u = K.mitAntwort(u, { person: 'Jo', felder: alle('2026-10-03', 18 * 60, 21 * 60), zeit: '1' });
  // Ohne Filter: beide Tage mit je zwei Leuten.
  assert.equal(K.besteTermine(u).length, 2);
  // Die SL muss dabei sein: nur Freitag.
  assert.deepEqual(K.besteTermine(u, 3, { pflicht: ['sl'] }).map((v) => v.tag), ['2026-10-02']);
  // Mindestens drei: niemand.
  assert.deepEqual(K.besteTermine(u, 3, { mindestens: 3 }), []);
  // Jo ausgeblendet: am Samstag nur noch Mira.
  const ohneJo = K.besteTermine(u, 3, { personen: ['SL', 'Mira'] });
  assert.deepEqual(ohneJo[0].kann, ['SL', 'Mira']);
  assert.deepEqual(ohneJo.find((v) => v.tag === '2026-10-03').kann, ['Mira']);
});

test('Ohne Dauer: der längste Block mit den meisten Leuten', () => {
  let u = { ...basis(), dauer: null };
  u = K.mitAntwort(u, { person: 'A', felder: alle('2026-10-02', 18 * 60, 23 * 60), zeit: '1' });
  u = K.mitAntwort(u, { person: 'B', felder: alle('2026-10-02', 19 * 60, 22 * 60), zeit: '1' });
  const [v] = K.besteTermine(u);
  assert.equal(v.von, 19 * 60);
  assert.equal(v.bis, 22 * 60);
  assert.deepEqual(v.kann, ['A', 'B']);
  // Bleibt beim Einlesen offen.
  assert.equal(K.bereinige(u, 'x').dauer, null);
});

test('Zeitzonen: Raster und Termin umgerechnet, .ics in UTC', () => {
  const u = { ...basis(), zone: 'Europe/Berlin', tage: ['2026-10-02'], von: 18 * 60, bis: 20 * 60, termin: { tag: '2026-10-02', von: 19 * 60, bis: 23 * 60 } };
  // Berlin ist im Oktober UTC+2, New York UTC-4: sechs Stunden früher.
  const a = K.ansicht(u, 'America/New_York');
  assert.deepEqual(a.tage, ['2026-10-02']);
  assert.deepEqual(a.minuten, [12 * 60, 13 * 60]);
  assert.equal(a.feldAn('2026-10-02', 12 * 60), K.feld('2026-10-02', 18 * 60));
  assert.equal(a.feldAn('2026-10-02', 18 * 60), null);
  // Tokio (UTC+9): sieben Stunden später, über Mitternacht in den nächsten Tag.
  const z = K.zeitraum(u, u.termin, 'Asia/Tokyo');
  assert.deepEqual(z, { tag: '2026-10-03', von: 2 * 60, bis: 6 * 60 });
  assert.match(K.alsIcs(u, new Date('2026-10-01T08:00:00Z')), /DTSTART:20261002T170000Z\r\nDTEND:20261002T210000Z/);
  // Ohne Zone: keine Umrechnung.
  assert.equal(K.ansicht({ ...u, zone: '' }, 'Asia/Tokyo').feldAn('2026-10-02', 18 * 60), K.feld('2026-10-02', 18 * 60));
  // Zeitumstellung: 25. Oktober 2026 endet die Sommerzeit in Berlin.
  assert.equal(new Date(K.zuUtc('2026-10-25', 12 * 60, 'Europe/Berlin')).toISOString(), '2026-10-25T11:00:00.000Z');
  assert.equal(new Date(K.zuUtc('2026-10-24', 12 * 60, 'Europe/Berlin')).toISOString(), '2026-10-24T10:00:00.000Z');
});

test('Raster: 15, 30, 60 Minuten; neu 30, alte Umfragen ohne Angabe 60', () => {
  assert.equal(K.leereUmfrage('x', '2026-10-01').schritt, 30);
  assert.deepEqual(K.zeiten({ von: 18 * 60, bis: 19 * 60, schritt: 15 }), [1080, 1095, 1110, 1125]);
  const roh = JSON.parse(JSON.stringify(basis()));
  assert.equal(K.bereinige({ ...roh, schritt: 15 }, 'x').schritt, 15);
  assert.equal(K.bereinige({ ...roh, schritt: 45 }, 'x').schritt, 30);
  const { schritt: _weg, ...ohne } = roh;
  assert.equal(K.bereinige(ohne, 'x').schritt, 60);
});

test('15-Minuten-Raster: Dauer zählt in Vierteln', () => {
  const u = { ...basis(), schritt: 15, dauer: 60, tage: ['2026-10-02'] };
  const f = {};
  for (let m = 19 * 60; m < 20 * 60 + 15; m += 15) f[K.feld('2026-10-02', m)] = 'kann';
  const mit = K.mitAntwort(u, { person: 'Mira', felder: f, geaendert: '' });
  const [erster] = K.besteTermine(mit);
  assert.equal(erster.bis - erster.von, 60);
  assert.equal(erster.von, 19 * 60);
});
