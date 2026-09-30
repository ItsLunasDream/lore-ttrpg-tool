import test from 'node:test';
import assert from 'node:assert/strict';
import entry from '../dist/tests/entry.cjs';

const { zahlenFarbe, bereinige, STANDARD } = entry;

const SCHWARZ = '#101319';
const WEISS = '#ffffff';

// Der eigentliche Grund fuer diese Rechnung: die Wuerfelfarbe ist frei
// waehlbar, und auf Hellgelb ist eine weisse Zahl unlesbar. Das faellt erst am
// Spieltisch auf, wenn niemand mehr etwas daran aendern kann.
test('helle Farben bekommen eine dunkle Zahl', () => {
  for (const farbe of ['#ffffff', '#ffff00', '#ffd700', '#90ee90', '#e0e0e0']) {
    assert.equal(zahlenFarbe(farbe), SCHWARZ, `${farbe} braucht eine dunkle Zahl`);
  }
});

test('dunkle Farben bekommen eine helle Zahl', () => {
  for (const farbe of ['#000000', '#000080', '#301934', '#8b0000', '#2f4f4f']) {
    assert.equal(zahlenFarbe(farbe), WEISS, `${farbe} braucht eine helle Zahl`);
  }
});

// Gruen traegt viel mehr zur empfundenen Helligkeit bei als Blau. Mit dem
// einfachen Mittel der drei Kanaele bekaeme reines Blau eine dunkle Zahl,
// obwohl es dunkel wirkt — und reines Gruen eine helle, obwohl es hell ist.
test('die Kanaele werden nach ihrem Beitrag zur Helligkeit gewichtet', () => {
  assert.equal(zahlenFarbe('#0000ff'), WEISS, 'reines Blau ist dunkel');
  assert.equal(zahlenFarbe('#00ff00'), SCHWARZ, 'reines Gruen ist hell');
  const mittel = (0 + 255 + 0) / 3;
  assert.ok(mittel < 128, 'das einfache Mittel haette Gruen fuer dunkel gehalten');
});

test('die Standardfarbe der Anwendung ist lesbar', () => {
  assert.ok([SCHWARZ, WEISS].includes(zahlenFarbe(STANDARD.farbe)));
});

test('eine unbrauchbare Farbe fuehrt nicht zu unsichtbarer Schrift', () => {
  assert.equal(zahlenFarbe('quatsch'), WEISS);
  assert.equal(zahlenFarbe(''), WEISS);
});

// --- Einstellungen lesen ---------------------------------------------------

test('was fehlt, wird durch den Standard ersetzt', () => {
  const e = bereinige({});
  assert.equal(e.farbe, STANDARD.farbe);
  assert.equal(e.muster, STANDARD.muster);
  assert.equal(e.glitzerAn, true);
});

test('eine kaputte Farbe wird verworfen', () => {
  assert.equal(bereinige({ farbe: 'rot' }).farbe, STANDARD.farbe);
  assert.equal(bereinige({ farbe: '#ff0000' }).farbe, '#ff0000');
});

test('ein unbekanntes Muster wird verworfen', () => {
  assert.equal(bereinige({ muster: 'pappe' }).muster, STANDARD.muster);
  assert.equal(bereinige({ muster: 'holz' }).muster, 'holz');
  assert.equal(bereinige({ muster: 'marmor' }).muster, 'marmor');
});

test('die Seitenzahl des eigenen Wuerfels bleibt in ihren Grenzen', () => {
  assert.equal(bereinige({ eigeneSeiten: 1 }).eigeneSeiten, 2, 'ein Wuerfel mit einer Seite ist keiner');
  assert.equal(bereinige({ eigeneSeiten: 99999 }).eigeneSeiten, 1000);
  assert.equal(bereinige({ eigeneSeiten: 7 }).eigeneSeiten, 7);
});

test('abgeschaltete Effekte bleiben abgeschaltet', () => {
  assert.equal(bereinige({ glitzerAn: false }).glitzerAn, false);
  assert.equal(bereinige({ streifenAn: false }).streifenAn, false);
});

test('null und Unsinn ergeben den Standard, statt zu werfen', () => {
  assert.deepEqual(bereinige(null), STANDARD);
  assert.deepEqual(bereinige('quatsch'), STANDARD);
});
