import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('../dist/tests/entry.cjs');

test('Zeilen mit und ohne Spanne werden zu Eintraegen', () => {
  const e = L.alsEintraege('1-3: 2d6 × 10 Kupfer\n\n4: [Taschenkram]\n5–6: Rubin\nNur Text\n  ');
  assert.deepEqual(e, [
    { text: '2d6 × 10 Kupfer', von: 1, bis: 3 },
    { text: '[Taschenkram]', von: 4, bis: 4 },
    { text: 'Rubin', von: 5, bis: 6 },
    { text: 'Nur Text' }
  ]);
  assert.equal(L.alsZeilen(e), '1-3: 2d6 × 10 Kupfer\n4: [Taschenkram]\n5-6: Rubin\nNur Text');
});

test('eine vertauschte Spanne wird gerade gerueckt', () => {
  assert.deepEqual(L.alsEintraege('6-4: X'), [{ text: 'X', von: 4, bis: 6 }]);
});

test('eine Tabelle kommt aus der Datei zurueck, wie sie hineinging', () => {
  const t = {
    id: 'bande',
    name: 'Beute: Räuber "Rotbart"',
    wuerfel: '1W6',
    ohneZuruecklegen: true,
    eintraege: [{ text: 'Kupfer', von: 1, bis: 3 }, { text: '[Taschenkram]', von: 4, bis: 6 }],
    notiz: 'Zweite Zeile\nmit Umbruch',
    geaendert: '2026-09-22T20:00:00.000Z'
  };
  const zurueck = L.leseTabelle(L.alsMarkdown(t), 'bande');
  assert.deepEqual(zurueck, t);
});

test('eine von Hand geschriebene Datei ohne Kopf wird gelesen', () => {
  const t = L.leseTabelle('Ein paar Worte davor\n\n- Apfel\n* Birne\n\n## Notiz\n\nHallo', 'obst');
  assert.equal(t.name, 'obst');
  assert.deepEqual(t.eintraege, [{ text: 'Apfel' }, { text: 'Birne' }]);
  assert.equal(t.notiz, 'Hallo');
  assert.equal(t.ohneZuruecklegen, false);
});

test('Namen und Kennungen', () => {
  assert.equal(L.zuId('Beute einer Räuberbande'), 'beute-einer-raeuberbande');
  assert.equal(L.freieKennung('a', ['a', 'a-2']), 'a-3');
  assert.equal(L.naechsterName('Tabelle', ['Tabelle_1', 'tabelle_2']), 'Tabelle_3');
});

test('die Pruefung findet Luecken, Doppelte und Werte ausserhalb des Wuerfels', () => {
  const t = {
    id: 'x',
    name: 'X',
    wuerfel: '1d6',
    eintraege: [
      { text: 'a', von: 1, bis: 2 },
      { text: 'b', von: 2, bis: 3 },
      { text: 'c', von: 6, bis: 7 }
    ]
  };
  const arten = L.pruefe(t, [t]).map((b) => b.art + (b.von ? `${b.von}-${b.bis}` : b.zahl ?? ''));
  assert.deepEqual(arten, ['luecke4-5', 'doppelt2', 'ausserhalb7']);
});

test('die Pruefung meldet Wuerfel ohne Spannen, Spannen ohne Wuerfel und Unlesbares', () => {
  const art = (t) => L.pruefe({ id: 'x', name: 'X', ...t }, []).map((b) => b.art);
  assert.deepEqual(art({ wuerfel: '1d4', eintraege: [{ text: 'a' }] }), ['wuerfel-ohne-spannen']);
  assert.deepEqual(art({ eintraege: [{ text: 'a', von: 1, bis: 1 }] }), ['spannen-ohne-wuerfel']);
  assert.deepEqual(art({ wuerfel: 'viele', eintraege: [{ text: 'a' }] }), ['wuerfel-unlesbar']);
  assert.deepEqual(art({ wuerfel: '1W2', eintraege: [{ text: 'a', von: 1 }, { text: 'b', von: 2 }] }), []);
});

test('die Pruefung findet lose Verweise und den Verweis auf sich selbst', () => {
  const kram = { id: 'kram', name: 'Taschenkram', eintraege: [{ text: 'Kamm' }] };
  const t = { id: 't', name: 'Bande', eintraege: [{ text: '[taschenkram] und [Gibtsnicht]' }, { text: '[Bande]' }] };
  assert.deepEqual(
    L.pruefe(t, [kram, t]).map((b) => b.art),
    ['verweis-fehlt', 'verweis-selbst']
  );
});

test('riesige Spannen und Wuerfel legen die Pruefung nicht lahm', () => {
  const t = { id: 'x', name: 'X', wuerfel: '1d6', eintraege: [{ text: 'a', von: 1, bis: 100000000 }] };
  const beginn = Date.now();
  L.pruefe(t, []);
  L.pruefe({ ...t, wuerfel: '1d100000000' }, []);
  assert.ok(Date.now() - beginn < 500);
});

test('die Beispieltabellen verweisen in jeder Sprache nur auf vorhandene Tabellen und sind formal sauber', () => {
  for (const sprache of ['de', 'en']) {
    const satz = L.beispiele(sprache);
    assert.equal(satz.length, 3);
    for (const t of satz) assert.deepEqual(L.pruefe(t, satz), [], `${sprache}: ${t.name}`);
    assert.deepEqual(L.loseEnden(satz), []);
    // Und sie wuerfeln ohne offene Klammern und ohne ungewuerfelte Wuerfel.
    for (let i = 0; i < 50; i += 1) {
      const text = L.wuerfle(satz[2], satz, Math.random).text;
      assert.doesNotMatch(text, /\[|\d+[dW]\d+/, text);
    }
  }
});

test('die Beispiele beider Sprachen tragen dieselben Spannen und Wuerfel', () => {
  const de = L.beispiele('de');
  const en = L.beispiele('en');
  for (let i = 0; i < de.length; i += 1) {
    assert.equal(de[i].wuerfel, en[i].wuerfel);
    assert.equal(Boolean(de[i].ohneZuruecklegen), Boolean(en[i].ohneZuruecklegen));
    assert.deepEqual(
      de[i].eintraege.map((e) => [e.von, e.bis]),
      en[i].eintraege.map((e) => [e.von, e.bis])
    );
  }
});

test('die SRD-Tabelle ist in beiden Sprachen formal sauber und per Verweis erreichbar', () => {
  for (const sprache of ['de', 'en']) {
    const [tand] = L.srdTabellen(sprache);
    assert.ok(L.istSrd(tand.id));
    assert.equal(tand.eintraege.length, 100);
    assert.deepEqual(L.pruefe(tand, []), []);
    const bande = { id: 'b', name: 'B', eintraege: [{ text: `[${tand.name}]` }] };
    assert.deepEqual(L.pruefe(bande, [tand]), []);
    assert.ok(L.wuerfle(bande, [bande, tand], Math.random).text.length > 5);
  }
});

test('Waffen, Ruestung und Ausruestung aus dem SRD, mit Preis und ohne Zwischenzeilen', () => {
  for (const sprache of ['de', 'en']) {
    const [, waffen, ruestung, kram] = L.srdTabellen(sprache);
    assert.equal(waffen.eintraege.length, 38, sprache);
    assert.equal(ruestung.eintraege.length, 13, sprache);
    assert.equal(kram.eintraege.length, 82, sprache);
    for (const t of [waffen, ruestung, kram]) {
      assert.ok(L.istSrd(t.id));
      assert.deepEqual(L.pruefe(t, []), [], t.name);
    }
  }
  const [, waffen] = L.srdTabellen('de');
  assert.equal(waffen.name, 'Waffen');
  assert.ok(waffen.eintraege.some((e) => e.text === 'Langschwert (15 GM)'), JSON.stringify(waffen.eintraege.slice(0, 3)));
});

test('der Bestand des Magic Item Generators wird zu Tabellen, leere Seltenheiten fehlen', () => {
  const liste = [
    { name: 'Klinge des Morgenrots', seltenheit: 'rare' },
    { name: 'Amulett der Stille', seltenheit: 'rare' },
    { name: 'Stiefel', seltenheit: 'common' }
  ];
  const de = L.gegenstandsTabellen(liste, 'de');
  assert.deepEqual(de.map((t) => t.name), [
    'Magische Gegenstände',
    'Magische Gegenstände (Gewöhnlich)',
    'Magische Gegenstände (Selten)'
  ]);
  assert.deepEqual(de[2].eintraege.map((e) => e.text), ['Amulett der Stille', 'Klinge des Morgenrots']);
  assert.ok(de.every((t) => L.istGegenstandstabelle(t.id)));
  // Ein Verweis in einer eigenen Tabelle findet sie, Gross- und Kleinschreibung egal.
  const truhe = { id: 't', name: 'Truhe', eintraege: [{ text: '[magische gegenstände (selten)]' }] };
  assert.deepEqual(L.pruefe(truhe, de), []);
  assert.equal(L.gegenstandsTabellen([], 'en').length, 0);
});

test('Zeilen werden nummeriert, vorhandene Nummern bleiben', () => {
  // Noch keine Nummer: alle der Reihe nach, der Wuerfel passend dazu.
  assert.deepEqual(L.nummeriere('Schwert\nSchild\nSeil', ''), { zeilen: '1: Schwert\n2: Schild\n3: Seil', wuerfel: '1d3' });
  // Schon welche: die uebrigen bekommen die naechsten freien Zahlen.
  assert.deepEqual(L.nummeriere('1-4: Gold\nSilber', '1d6'), { zeilen: '1-4: Gold\n5: Silber', wuerfel: '1d6' });
  // Nichts zu tun: dieselben Werte.
  assert.deepEqual(L.nummeriere('1: A\n2: B', '1d2'), { zeilen: '1: A\n2: B', wuerfel: '1d2' });
  assert.deepEqual(L.nummeriere('', ''), { zeilen: '', wuerfel: '' });
  // Eine einzige Zeile bekommt eine Nummer, aber keinen Wuerfel „1d1".
  assert.deepEqual(L.nummeriere('Nur eins', ''), { zeilen: '1: Nur eins', wuerfel: '' });
});

test('Luecken und doppelte Nummern sperren das Wuerfeln, Hinweise nicht', () => {
  const tabelle = (zeilen, wuerfel) => ({ id: 't', name: 'T', wuerfel, eintraege: L.alsEintraege(zeilen) });
  const luecke = L.pruefe(tabelle('1-20: A\n23: B', '1d23'), []);
  assert.ok(luecke.some(L.sperrt), JSON.stringify(luecke));
  const doppelt = L.pruefe(tabelle('33: A\n33: B\n1-32: C', '1d33'), []);
  assert.ok(doppelt.some((b) => b.art === 'doppelt' && b.zahl === 33) && doppelt.some(L.sperrt));
  const verweis = L.pruefe(tabelle('1: A\n2: [Gibtsnicht]', '1d2'), []);
  assert.ok(verweis.some((b) => b.art === 'verweis-fehlt') && !verweis.some(L.sperrt), JSON.stringify(verweis));
});

test('"[" erkennt einen angefangenen Verweis und setzt den Namen ein', () => {
  assert.deepEqual(L.offenerVerweis('1: [Tas', 7), { von: 3, suche: 'Tas' });
  assert.equal(L.offenerVerweis('1: [Tasche] und', 15), null);
  assert.equal(L.offenerVerweis('1: [Tas\n2: x', 12), null);
  assert.equal(L.offenerVerweis('ohne', 4), null);
  assert.deepEqual(L.setzeVerweis('1: [Tas', 3, 7, 'Taschenkram'), { text: '1: [Taschenkram]', cursor: 16 });
  // Ein schon vorhandenes "]" wird nicht verdoppelt.
  assert.deepEqual(L.setzeVerweis('1: [T] Rest', 3, 5, 'Truhe'), { text: '1: [Truhe] Rest', cursor: 10 });
  assert.deepEqual(L.verweisVorschlaege(['Edelsteine', 'Taschenkram', 'Kleine Taschen', 'Taschenkram'], 'tasch'), [
    'Taschenkram',
    'Kleine Taschen'
  ]);
  assert.equal(L.verweisVorschlaege(['a', 'b', 'c'], '').length, 3);
});

// --- Testbericht ---

test('eine Zeile ohne Nummer in einer nummerierten Tabelle wird gemeldet und sperrt', () => {
  const t = { id: 'x', name: 'X', wuerfel: '1d4', eintraege: [{ text: 'a', von: 1, bis: 4 }, { text: 'b' }] };
  const b = L.pruefe(t, [t]);
  const ohne = b.find((x) => x.art === 'ohne-nummer');
  assert.equal(ohne?.anzahl, 1);
  assert.ok(L.sperrt(ohne));
});

test('ein Kreis ueber zwei Tabellen wird gemeldet', () => {
  const a = { id: 'a', name: 'A', eintraege: [{ text: '[B]' }] };
  const b = { id: 'b', name: 'B', eintraege: [{ text: '[A]' }] };
  assert.ok(L.pruefe(a, [a, b]).some((x) => x.art === 'verweis-kreis' && x.name === 'B'));
});

test('der von hier gesetzte Wuerfel waechst mit einer neuen Zeile', () => {
  const neu = L.nummeriere('1: a\n2: b\n3: c\nd', '1d3');
  assert.equal(neu.wuerfel, '1d4');
  // Ein bewusst anderer Wuerfel bleibt stehen.
  assert.equal(L.nummeriere('1: a\n2: b\nc', '1d20').wuerfel, '1d20');
});

test('sehr lange Namen ergeben eine kurze Kennung', () => {
  assert.ok(L.zuId('x'.repeat(300)).length <= 80);
});

test('Homebrew: eigene Tabelle, magische zusätzlich nach Seltenheit', () => {
  const t = L.gegenstandsTabellen(
    [
      { name: 'Sturmklinge', seltenheit: '', herkunft: 'homebrew' },
      { name: 'Funkelring', seltenheit: 'rare', herkunft: 'homebrew' },
      { name: 'Klinge des Morgenrots', seltenheit: 'rare' }
    ],
    'de'
  );
  const hb = t.find((x) => x.id === 'mi-homebrew');
  assert.deepEqual(hb.eintraege.map((e) => e.text).sort(), ['Funkelring', 'Sturmklinge'].sort());
  const alle = t.find((x) => x.id === 'mi-alle');
  assert.ok(!alle.eintraege.some((e) => e.text === 'Sturmklinge'), 'eine Waffe ohne Seltenheit ist kein magischer Gegenstand');
  assert.ok(alle.eintraege.some((e) => e.text === 'Funkelring'));
  assert.deepEqual(L.gegenstandsTabellen([{ name: 'Nur', seltenheit: '', herkunft: 'homebrew' }], 'de').map((x) => x.id), ['mi-homebrew']);
});
