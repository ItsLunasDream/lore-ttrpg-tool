/**
 * Erzeuger und Ablage des Magic Item Generators.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../dist/tests/entry.cjs');

function zufall(start = 42) {
  let x = start;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

test('jede Art und Seltenheit ergibt einen Gegenstand mit Wirkung und ohne offene Platzhalter', () => {
  const z = zufall();
  for (const art of M.ARTEN) {
    for (const seltenheit of ['common', 'uncommon', 'rare', 'veryRare', 'legendary']) {
      for (const sprache of ['de', 'en']) {
        const g = M.erzeuge({ art, seltenheit }, sprache, z);
        assert.equal(g.art, art);
        assert.equal(g.seltenheit, seltenheit);
        assert.ok(g.wirkungen.length >= 1, `${art}/${seltenheit}`);
        for (const w of g.wirkungen) assert.ok(!/\{[a-z]+\}/.test(w), `${art}/${seltenheit}: ${w}`);
        assert.ok(g.name.length > 3);
        assert.ok(g.wert > 0);
      }
    }
  }
});

test('Traenke und Schriftrollen verlangen keine Einstimmung und kosten weniger', () => {
  const z = zufall(7);
  const trank = M.erzeuge({ art: 'trank', seltenheit: 'rare', fluchChance: 0 }, 'de', z);
  assert.equal(trank.einstimmung, false);
  assert.equal(trank.wert, 2000);
  const rolle = M.erzeuge({ art: 'schriftrolle', seltenheit: 'uncommon' }, 'de', z);
  assert.equal(rolle.einstimmung, false);
  // Doppelte Herstellungskosten eines Zaubers von Grad 2 oder 3.
  assert.ok([200, 300].includes(rolle.wert), String(rolle.wert));
});

test('eine Waffe traegt ihren Bonus passend zur Seltenheit', () => {
  const z = zufall(3);
  let gesehen = false;
  for (let i = 0; i < 30; i += 1) {
    const g = M.erzeuge({ art: 'waffe', seltenheit: 'veryRare', fluchChance: 0 }, 'de', z);
    if (g.wirkungen.some((w) => w.includes('+3 auf Angriffs'))) gesehen = true;
    assert.ok(!g.wirkungen.some((w) => /\+[12] auf Angriffs/.test(w)));
  }
  assert.ok(gesehen);
});

test('ohne Fluchchance nie verflucht, mit voller Chance immer', () => {
  const z = zufall(9);
  assert.equal(M.erzeuge({ fluchChance: 0 }, 'de', z).fluch, '');
  assert.ok(M.erzeuge({ art: 'ring', fluchChance: 1 }, 'en', z).fluch.startsWith('Curse'));
  // Traenke und Schriftrollen bekommen nie einen zufaelligen Fluch.
  assert.equal(M.erzeuge({ art: 'trank', fluchChance: 1 }, 'en', z).fluch, '');
});

test('ein Gegenstand kommt aus der Datei zurueck, wie er hineinging', () => {
  const g = {
    id: 'klinge',
    name: 'Klinge: des Morgenrots',
    art: 'waffe',
    seltenheit: 'rare',
    einstimmung: true,
    wirkungen: ['Erste Wirkung.', 'Zweite Wirkung.'],
    fluch: 'Fluch: nie wieder los.',
    wert: 4000,
    notiz: 'Liegt im Grab des Königs.\n\nZweiter Absatz.',
    geaendert: '2026-09-22T00:00:00.000Z',
    imLoot: false
  };
  assert.deepEqual(M.leseGegenstand(M.alsMarkdown(g), 'klinge'), g);
  // Das Merkmal „im Loot Generator" geht mit durch die Datei.
  const imLoot = { ...g, imLoot: true };
  assert.deepEqual(M.leseGegenstand(M.alsMarkdown(imLoot), 'klinge'), imLoot);
  assert.doesNotMatch(M.alsMarkdown(g), /^loot:/m);
});

test('Kennungen: lesbar und frei', () => {
  assert.equal(M.zuId('Klinge des Morgenröts'), 'klinge-des-morgenroets');
  assert.equal(M.freieKennung('a', ['a']), 'a-2');
});

test('der Foundry-Export traegt Seltenheit, Einstimmung und Preis in den Feldern', () => {
  const g = M.erzeuge({ art: 'trank', seltenheit: 'rare', fluchChance: 0 }, 'de', zufall(5));
  const datei = M.alsFoundryDatei(g, zufall(6));
  const item = JSON.parse(datei.inhalt);
  assert.match(datei.name, /^fvtt-Item-.+\.json$/);
  assert.equal(item.type, 'consumable');
  assert.equal(item.system.rarity, 'rare');
  assert.equal(item.system.price.value, 2000);
  assert.equal(item.system.uses.autoDestroy, true);
  assert.ok(item.system.description.value.includes('<li>'));
});

test('kein Gegenstand ist ein SRD-Gegenstand mit neuem Namen', () => {
  // Rueckmeldung: „Es wurde vorher ein Healing Potion mit anderem Namen
  // gemacht." Jeder Gegenstand traegt mindestens eine eigene Wirkung.
  const z = zufall(11);
  const eigen = (text, sprache) =>
    M.WIRKUNGEN.filter((w) => !M.istSrdGleich(w)).some((w) => {
      // Der feste Anfang einer Wirkung, vor dem ersten Platzhalter.
      const anfang = w.text[sprache].split('{')[0].slice(0, 25);
      return anfang.length > 8 && text.startsWith(anfang);
    });
  for (const art of M.ARTEN) {
    for (const seltenheit of ['common', 'uncommon', 'rare', 'veryRare', 'legendary']) {
      for (let i = 0; i < 15; i += 1) {
        const g = M.erzeuge({ art, seltenheit, fluchChance: 0 }, 'en', z);
        assert.ok(
          g.wirkungen.some((w) => eigen(w, 'en')),
          `${art}/${seltenheit}: nur SRD-Wirkungen: ${g.wirkungen.join(' | ')}`
        );
      }
    }
  }
});

test('der Vorrat ist deutlich groesser als die geeichten Wirkungen', () => {
  const eigene = M.WIRKUNGEN.filter((w) => !M.istSrdGleich(w));
  assert.ok(eigene.length >= 40, String(eigene.length));
  for (const art of M.ARTEN) assert.ok(eigene.some((w) => w.arten.includes(art)), art);
});

test('eine einzelne Wirkung und ein Fluch lassen sich nachwuerfeln', () => {
  const z = zufall(5);
  const vorher = M.wuerfleWirkung('ring', 'rare', 'de', [], z);
  assert.ok(vorher.length > 20 && !/\{[a-z]+\}/.test(vorher));
  for (let i = 0; i < 20; i += 1) assert.notEqual(M.wuerfleWirkung('ring', 'rare', 'de', [vorher], z), vorher);
  const fluch = M.wuerfleFluch('en', '', z);
  assert.ok(fluch.startsWith('Curse') && !/\{[a-z]+\}/.test(fluch));
  for (let i = 0; i < 20; i += 1) assert.notEqual(M.wuerfleFluch('en', fluch, z), fluch);
});

test('eine Nebenwirkung steht nie allein', () => {
  const z = zufall(23);
  const zusatz = M.WIRKUNGEN.filter((w) => w.zusatz).map((w) => w.text.en.slice(0, 20));
  for (const art of ['trank', 'schriftrolle']) {
    for (const seltenheit of ['common', 'uncommon', 'rare', 'veryRare', 'legendary']) {
      for (let i = 0; i < 20; i += 1) {
        const g = M.erzeuge({ art, seltenheit }, 'en', z);
        const echte = g.wirkungen.filter((w) => !zusatz.some((a) => w.startsWith(a)));
        assert.ok(echte.length >= 1, `${art}/${seltenheit}: ${g.wirkungen.join(' | ')}`);
      }
    }
  }
});
