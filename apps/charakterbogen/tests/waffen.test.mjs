import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const B = require('../dist/tests/entry.cjs');

function folge(...werte) {
  let i = 0;
  return () => werte[i++ % werte.length];
}

function werte(sta, ges, stufe = 1) {
  const w = B.leereWerte();
  return { ...w, attribute: { ...w.attribute, sta, ges }, klassen: [{ name: 'Kämpfer', stufe }] };
}

test('Alle 38 SRD-Waffen sind zweisprachig gepaart', () => {
  assert.equal(B.WAFFEN.length, 38);
  const ls = B.waffeNach('longsword');
  assert.deepEqual(ls.name, ['Langschwert', 'Longsword']);
  assert.equal(ls.wuerfel, '1d8');
  assert.equal(ls.vielseitig, '1d10');
  assert.deepEqual(ls.art, ['Hieb', 'Slashing']);
  assert.deepEqual(ls.meisterschaft, ['Auslaugen', 'Sap']);
  assert.equal(ls.kategorie, 'kriegs');
  assert.equal(ls.gewicht, 3);
  assert.equal(ls.wert, 15);
  // Die drei mit gleichem Preis und Wuerfel sind richtig auseinandergehalten.
  assert.equal(B.waffeNach('warhammer').name[0], 'Kriegshammer');
  assert.equal(B.waffeNach('morningstar').name[0], 'Morgenstern');
  assert.equal(B.waffeNach('war-pick').name[0], 'Kriegspicke');
  assert.equal(B.waffeNach('trident').name[0], 'Dreizack');
  const bogen = B.waffeNach('longbow');
  assert.equal(bogen.fern, true);
  assert.equal(B.waffeNach('dart').wert, 0.05);
  assert.equal(B.waffeNach('dart').gewicht, 0.25);
  assert.equal(B.waffeNach('blowgun').wuerfel, '1');
});

test('Angriff und Schaden nach SRD: Staerke, Finesse, Fernkampf, Uebung, Magie, vielseitig', () => {
  // STÄ 16 (+3), GES 14 (+2), Stufe 5: Übungsbonus +3.
  const w = werte(16, 14, 5);
  const a = (x) => B.angriffswerte(w, { name: '', bonus: '', schaden: '', notiz: '', ...x }, 'de');
  assert.deepEqual([a({ waffe: 'longsword' }).bonus, a({ waffe: 'longsword' }).schaden], [6, '1d8+3']);
  assert.equal(a({ waffe: 'longsword', zweihaendig: true }).schaden, '1d10+3');
  assert.equal(a({ waffe: 'longbow' }).bonus, 5, 'Fernkampf nimmt Geschicklichkeit');
  assert.equal(a({ waffe: 'rapier' }).bonus, 6, 'Finesse nimmt den besseren Wert');
  assert.equal(a({ waffe: 'rapier', attribut: 'ges' }).bonus, 5, 'ausdrücklich gewählt gilt');
  assert.equal(a({ waffe: 'longsword', geuebt: false }).bonus, 3);
  assert.deepEqual([a({ waffe: 'longsword', magie: 1 }).bonus, a({ waffe: 'longsword', magie: 1 }).schaden], [7, '1d8+4']);
  assert.equal(a({ waffe: 'longsword' }).art, 'Hieb');
  assert.equal(a({ waffe: 'blowgun' }).schaden, '3', 'Blasrohr: 1 + GES');
  // Ohne Waffe: freie Felder.
  assert.deepEqual([a({ bonus: '+4', schaden: '2W6+1 Feuer' }).bonus, a({ bonus: '+4', schaden: '2W6+1 Feuer' }).schaden], [4, '2d6+1']);
  assert.equal(a({ bonus: 'viel' }).bonus, null);
});

test('Wuerfeln: kritischer Treffer verdoppelt die Wuerfel, nicht den Modifikator', () => {
  const w = B.angriffswerte(werte(16, 10), { name: '', bonus: '', schaden: '', notiz: '', waffe: 'longsword' }, 'de');
  // d20 = 20 (0.99), dann zwei W8: 8 und 1.
  const krit = B.wuerfleAngriff(w, folge(0.99, 0.99, 0));
  assert.equal(krit.krit, true);
  assert.equal(krit.gesamt, 25);
  assert.equal(krit.schaden, 8 + 1 + 3);
  assert.match(krit.schadenText, /2d8 \[8, 1\] \+ 3/);
  const normal = B.wuerfleAngriff(w, folge(0.5, 0.5));
  assert.equal(normal.d20, 11);
  assert.equal(normal.schaden, 5 + 3);
  assert.match(B.wurfZeile('Langschwert', w, normal, 'de'), /^⚔ Langschwert: 16 \(d20 11 \+5\) · Schaden 8 Hieb/);
  assert.equal(B.wuerfleAusdruck('quatsch'), null);
  assert.equal(B.wuerfleAusdruck('1d6+1d4+2', folge(0, 0)).summe, 4);
});

test('Ausgeruestete Waffen im Inventar werden zu Angriffen, abgelegte nicht', () => {
  const b = B.neuerBogen('x', 'X');
  const g = (id, ausgeruestet, waffe) => ({ id, name: id, beschreibung: '', anzahl: 1, gewicht: 3, wert: 15, ausgeruestet, eingestimmt: false, waffe });
  const bogen = {
    ...b,
    gegenstaende: [
      g('Flammenzunge', true, { id: 'longsword', magie: 1, geuebt: true }),
      g('Dolch', false, { id: 'dagger', magie: 0, geuebt: true }),
      g('Seil', true, undefined)
    ]
  };
  const liste = B.angriffeAusInventar(bogen);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].name, 'Flammenzunge');
  assert.equal(liste[0].magie, 1);
  assert.equal(liste[0].ausInventar, 'Flammenzunge');
  // Uebersteht Speichern und Lesen (Waffe am Gegenstand, Angriffsfelder).
  const gelesen = B.bereinige(JSON.parse(JSON.stringify({ ...bogen, werte: { ...bogen.werte, angriffe: [{ name: 'A', bonus: '', schaden: '', notiz: '', waffe: 'rapier', magie: 9, attribut: 'x' }] } })), 'x');
  assert.deepEqual(gelesen.gegenstaende[0].waffe, { id: 'longsword', magie: 1, geuebt: true });
  assert.equal(gelesen.werte.angriffe[0].magie, 3);
  assert.equal(gelesen.werte.angriffe[0].attribut, 'auto');
});

test('eine eigene Waffe (Homebrew) rechnet wie eine SRD-Waffe', () => {
  const w = B.leereWerte();
  w.attribute.ges = 16;
  w.attribute.sta = 10;
  const eigen = { kategorie: 'kriegs', fern: false, wuerfel: '1d8', vielseitig: '1d10', art: ['Blitz', 'Lightning'], finesse: true, eigenschaften: ['Finesse', 'Finesse'], meisterschaft: ['Plagen', 'Vex'] };
  const a = { name: 'Sturmklinge', bonus: '', schaden: '', notiz: '', waffe: 'hb-sturmklinge', magie: 1, geuebt: true, attribut: 'auto', eigeneWaffe: eigen };
  const werte = B.angriffswerte(w, a, 'de');
  assert.equal(werte.bonus, 3 + 2 + 1, 'GES +3 (Finesse), Übung +2, Magie +1');
  assert.equal(werte.schaden, '1d8+4');
  assert.equal(werte.art, 'Blitz');
});

test('aus dem Inventar: eine ausgerüstete eigene Waffe wird zum Angriff, auch nach dem Einlesen', () => {
  const b = B.bereinige(
    {
      name: 'X',
      art: 'figur',
      gegenstaende: [
        { id: 'g1', name: 'Sturmklinge', anzahl: 1, ausgeruestet: true, quelle: { art: 'homebrew', kennung: 'sturmklinge' },
          waffe: { id: 'hb-sturmklinge', magie: 1, geuebt: true, eigen: { kategorie: 'kriegs', wuerfel: '1d8', art: ['Blitz', 'Lightning'], finesse: true, eigenschaften: ['Finesse', 'Finesse'], meisterschaft: ['Plagen', 'Vex'] } } }
      ]
    },
    'x'
  );
  assert.equal(b.gegenstaende[0].quelle.art, 'homebrew');
  const angriffe = B.angriffeAusInventar(b);
  assert.equal(angriffe.length, 1);
  assert.equal(angriffe[0].eigeneWaffe.wuerfel, '1d8');
  const kaputt = B.bereinige({ name: 'Y', art: 'figur', gegenstaende: [{ name: 'Z', ausgeruestet: true, waffe: { id: 'hb-z', eigen: { wuerfel: 'viel' } } }] }, 'y');
  assert.equal(kaputt.gegenstaende[0].waffe.eigen, undefined, 'unlesbarer Würfel: keine eigene Waffe');
  assert.equal(B.angriffeAusInventar(kaputt).length, 0);
});
