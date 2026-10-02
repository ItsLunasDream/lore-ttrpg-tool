import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

const fest = (...werte) => {
  let n = 0;
  return () => werte[n++ % werte.length];
};
const e = (srd) => ({ srd, vorbereitet: false, immer: false, herkunft: '' });

test('Schaden/Heilung-Feld: Würfelausdruck liefert Betrag und Wurf', () => {
  const r = B.leseBetragMitWurf('3d8+2', fest(0, 0.5, 0.99));
  assert.equal(r.betrag, -(1 + 5 + 8 + 2));
  assert.equal(r.wurf, '3d8 [1, 5, 8] + 2');
  assert.equal(B.leseBetragMitWurf('-7').wurf, '');
  assert.equal(B.leseBetragMitWurf('+2W4', fest(0.99)).betrag, 8);
  assert.equal(B.leseBetrag('-7'), -7);
});

test('Angriff: jedes Attribut wählbar, nur Angriff, nur Schaden', () => {
  const w = { ...B.neuerBogen('x', 'Mira').werte, attribute: { sta: 8, ges: 10, kon: 10, int: 10, wei: 10, cha: 18 } };
  const a = { name: 'Paktklinge', bonus: '', schaden: '', notiz: '', waffe: 'longsword', attribut: 'cha', geuebt: true, magie: 0 };
  const werte = B.angriffswerte(w, a, 'de');
  assert.equal(werte.bonus, 4 + 2);
  assert.equal(werte.schaden, '1d8+4');
  const nurAngriff = B.wuerfleAngriff(werte, fest(0.5), 'angriff');
  assert.equal(nurAngriff.schaden, null);
  assert.equal(nurAngriff.d20, 11);
  const nurSchaden = B.wuerfleAngriff(werte, fest(0.5), 'schaden');
  assert.equal(nurSchaden.d20, 0);
  assert.match(B.wurfZeile('Paktklinge', werte, nurSchaden, 'de'), /^⚔ Paktklinge · Schaden \d+/);
  const b = B.neuerBogen('x', 'Mira');
  b.werte.angriffe = [a];
  assert.equal(B.bereinige(JSON.parse(JSON.stringify(b)), 'x').werte.angriffe[0].attribut, 'cha');
});

test('Zauber: Schaden mit höherem Platz, Zaubertrick-Stufen, Heilung, Homebrew', () => {
  assert.deepEqual(B.zauberWurf(e('fireball'), 3, 5, 3, 'de'), { art: 'schaden', ausdruck: '8d6', bezeichnung: 'Feuerschaden' });
  assert.equal(B.zauberWurf(e('fireball'), 5, 9, 3, 'en').ausdruck, '8d6+2d6');
  assert.equal(B.zauberWurf(e('fire-bolt'), 0, 1, 3, 'en').ausdruck, '1d10');
  assert.equal(B.zauberWurf(e('fire-bolt'), 0, 11, 3, 'en').ausdruck, '3d10');
  assert.equal(B.zauberWurf(e('chill-touch'), 0, 1, 3, 'de').bezeichnung, 'nekrotischer Schaden');
  assert.deepEqual(B.zauberWurf(e('cure-wounds'), 2, 3, 3, 'de'), { art: 'heilung', ausdruck: '2d8+2d8+3', bezeichnung: '' });
  assert.equal(B.zauberWurf(e('bless'), 1, 1, 3, 'de'), null);
  const hb = { eigen: { name: 'Blitz', grad: 1, text: '', schaden: '2d6+1', schadensart: 'Blitz' }, vorbereitet: false, immer: false, herkunft: 'Homebrew' };
  assert.deepEqual(B.zauberWurf(hb, 1, 1, 3, 'de'), { art: 'schaden', ausdruck: '2d6+1', bezeichnung: 'Blitz' });
});

test('Story-Notiz: keine Überschrift „# Name", Zauber ohne verschachtelte Liste, alte Notiz ohne Markierung', () => {
  const b = B.neuerBogen('x', 'Mira', 'figur', 'de');
  b.werte.zauber = B.leereZauberei('int');
  b.werte.zauber.liste = [e('fire-bolt'), { ...e('bane'), vorbereitet: true }];
  const text = B.storyText(b, 'de');
  assert.doesNotMatch(text, /^# /m);
  assert.match(text, /^- Grad 1 · Verderben ●$/m);
  assert.doesNotMatch(text, /^- \d+\. /m);
  const block = B.storyBlock(b, 'de');
  // Alte Notiz: nur Bogentext ohne Markierungen → ersetzt, nicht doppelt.
  const alt = `# Mira\n\n${text}`;
  assert.equal(B.ersetzeStoryBlock(alt, block), `${block}\n`);
  // Mit eigenem Abschnitt bleibt sie und der Bogen kommt dazu.
  const eigen = `${text}\n## Meine Ideen\n\nSie sucht ihren Bruder.`;
  assert.ok(B.ersetzeStoryBlock(eigen, block).startsWith(eigen.trimEnd()));
  // Mit Markierungen wird nur der Abschnitt getauscht.
  assert.equal(B.ersetzeStoryBlock(`Vorne\n\n${block}\n\nHinten`, block.replace('Mira', 'Mira')), `Vorne\n\n${block}\n\nHinten`);
});

test('Geschosse und Strahlen: Anzahl nach Platz bzw. Stufe', () => {
  const mm = B.zauberWurf(e('magic-missile'), 1, 1, 3, 'de');
  assert.equal(mm.ausdruck, '1d4+1');
  assert.deepEqual(mm.mehrfach, { anzahl: 3, angriffJe: false, stueck: 'Geschoss' });
  assert.equal(B.zauberWurf(e('magic-missile'), 4, 7, 3, 'de').mehrfach.anzahl, 6);
  const sr = B.zauberWurf(e('scorching-ray'), 3, 5, 3, 'en');
  assert.equal(sr.ausdruck, '2d6');
  assert.deepEqual(sr.mehrfach, { anzahl: 4, angriffJe: true, stueck: 'ray' });
  assert.equal(B.zauberWurf(e('eldritch-blast'), 0, 1, 3, 'de').mehrfach.anzahl, 1);
  assert.equal(B.zauberWurf(e('eldritch-blast'), 0, 11, 3, 'de').mehrfach.anzahl, 3);
  assert.equal(B.zauberWurf(e('eldritch-blast'), 0, 17, 3, 'de').ausdruck, '1d10');
  assert.equal(B.zauberWurf(e('fireball'), 3, 5, 3, 'de').mehrfach, undefined);
});

test('Geschosse: eine Zeile mit jedem Wurf und der Summe', () => {
  const mm = B.zauberWurf(e('magic-missile'), 1, 1, 3, 'de');
  const z = B.mehrfachZeilen('Magisches Geschoss', mm, 5, 'de', fest(0, 0.5, 0.99));
  assert.equal(z.length, 1);
  // 1d4+1 je Geschoss: 2, 4, 5
  assert.match(z[0].text, /Schaden: 11 .*\(3 Geschosse à 1d4\+1: 2 \+ 4 \+ 5\)/);
});

test('Strahlen: je Strahl ein Angriff, eine 20 verdoppelt, eine 1 verfehlt', () => {
  const sr = B.zauberWurf(e('scorching-ray'), 2, 5, 3, 'de');
  // Strahl 1: d20 = 20, dann 4 Würfel; Strahl 2: d20 = 1; Strahl 3: d20 = 11, dann 2 Würfel.
  const z = B.mehrfachZeilen('Sengender Strahl', sr, 5, 'de', fest(0.99, 0, 0, 0, 0, 0, 0.5, 0.99, 0.99));
  assert.equal(z.length, 4);
  assert.equal(z[0].d20, 20);
  assert.match(z[0].text, /Strahl 1\/3: 25 .*Schaden 4 .*4d6/);
  assert.equal(z[1].d20, 1);
  assert.match(z[1].text, /daneben/);
  assert.doesNotMatch(z[1].text, /Schaden/);
  assert.match(z[2].text, /Strahl 3\/3: 16 .*Schaden 12 /);
  assert.match(z[3].text, /Schaden: 16 .*gegen RK/);
  assert.equal(z[3].d20, undefined);
});

test('Zustände zwischen Bogen und Tracker: Schlüssel hin, Delta zurück', () => {
  const b = B.neuerBogen('x', 'Mira');
  const mitZ = { ...b, werte: { ...b.werte, zustaende: ['poisoned', 'eigen:Segen des Mondes'] } };
  assert.deepEqual(B.figurAus(mitZ, 'x').zustaende, ['poisoned', 'Segen des Mondes']);
  assert.deepEqual(B.mitZustandsDelta(['poisoned', 'eigen:Segen des Mondes'], ['prone', 'Fluch', 'exhaustion'], ['Segen des Mondes']), ['poisoned', 'prone', 'eigen:Fluch']);
  assert.deepEqual(B.mitZustandsDelta(['prone'], ['prone'], []), ['prone']);
});
