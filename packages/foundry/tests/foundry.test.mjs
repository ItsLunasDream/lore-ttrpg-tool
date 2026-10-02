import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  alsFoundryGegenstand,
  zahlenbonus,
  alsFoundryMonster,
  alsFoundryZustand,
  alsGradZahl,
  alsHtml,
  dateiname,
  kennung,
  kleinUndBindestrich,
  maskiere,
  zerlegeWuerfel
} = require('../dist/tests/entry.cjs');

/**
 * Ein Wuerfel, der sich wiederholt. Damit ist jede erzeugte Datei
 * vorhersagbar und der Test vergleicht nicht gegen Zufall.
 */
function fester(start = 0) {
  let n = start;
  return () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
}

const MONSTER = {
  name: 'Frostwächter',
  cr: '5',
  tp: 90,
  rk: 15,
  attribute: { st: 18, ge: 12, ko: 16, in: 8, we: 11, ch: 7 },
  hauptattribut: 'st',
  gangarten: [
    { art: 'gehen', fuss: 30 },
    { art: 'klettern', fuss: 20 }
  ],
  artEnglisch: 'elemental',
  groesse: 'gross',
  widerstaende: {
    resistenzen: ['slashing'],
    immunitaeten: ['cold'],
    verwundbarkeiten: ['fire']
  },
  faehigkeiten: [{ name: 'Eishaut', text: 'Wer es berührt, nimmt 3 Kälteschaden.' }],
  angriffe: [
    {
      name: 'Klaue',
      art: 'nah',
      wuerfel: '2d8 + 4',
      schadensart: 'slashing',
      reichweite: 10,
      anzahl: 2
    },
    {
      name: 'Frostsplitter',
      art: 'fern',
      wuerfel: '3d6',
      schadensart: 'cold',
      weite: [60, 120]
    },
    { name: 'Frostatem', art: 'flaeche', wuerfel: '6d8', schadensart: 'cold' }
  ],
  satz: 'Ein Wächter aus lebendigem Eis.'
};

test('ein Wuerfelausdruck wird auseinandergenommen', () => {
  assert.deepEqual(zerlegeWuerfel('2d8 + 4'), { anzahl: 2, seiten: 8, bonus: 4 });
  assert.deepEqual(zerlegeWuerfel('3d6'), { anzahl: 3, seiten: 6, bonus: 0 });
  assert.deepEqual(zerlegeWuerfel('1d12 - 1'), { anzahl: 1, seiten: 12, bonus: -1 });
  assert.equal(zerlegeWuerfel('kein Wuerfel'), null);
});

test('der Grad wird zur Zahl, Brueche eingeschlossen', () => {
  assert.equal(alsGradZahl('9'), 9);
  assert.equal(alsGradZahl('1/2'), 0.5);
  assert.equal(alsGradZahl('1/8'), 0.125);
  assert.equal(alsGradZahl('0'), 0);
});

test('Text wird zu Absaetzen, und Markup wird maskiert', () => {
  assert.equal(alsHtml('Eins\n\nZwei'), '<p>Eins</p><p>Zwei</p>');
  assert.equal(alsHtml(''), '');
  assert.equal(maskiere('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;');
  // Der wichtige Fall: spitze Klammern im Text werden nicht zu Markup.
  assert.ok(!alsHtml('Reichweite < 10').includes('< 10'));
});

test('aus einem Namen wird eine Kennung wie im Beispiel', () => {
  assert.equal(kleinUndBindestrich('Absolute Zero'), 'absolute-zero');
  assert.equal(kleinUndBindestrich('Kälte'), 'kaelte');
  assert.equal(kleinUndBindestrich('Café  Noir'), 'cafe-noir');
  assert.equal(kleinUndBindestrich('!!!'), 'unnamed');
});

test('eine Kennung hat 16 erlaubte Zeichen', () => {
  const id = kennung(fester());
  assert.equal(id.length, 16);
  assert.match(id, /^[A-Za-z0-9]{16}$/);
});

test('der Dateiname folgt dem von Foundry', () => {
  assert.equal(
    dateiname('Actor', 'Relentless Warrior', 'hGO8CVAuR6lUb8Gh'),
    'fvtt-Actor-relentless-warrior-hGO8CVAuR6lUb8Gh.json'
  );
});

test('ein Monster wird ein npc mit den Feldern, die dnd5e liest', () => {
  const a = alsFoundryMonster(MONSTER, fester());

  assert.equal(a.type, 'npc');
  assert.equal(a.name, 'Frostwächter');
  assert.equal(a._stats.systemId, 'dnd5e');

  // Die Ruestungsklasse steht flach: unsere Zahl ist die Wahrheit und soll
  // nicht aus einer Ruestung nachgerechnet werden, die es nicht traegt.
  assert.deepEqual(a.system.attributes.ac, { calc: 'flat', flat: 15 });
  assert.equal(a.system.attributes.hp.max, 90);
  assert.equal(a.system.attributes.hp.value, 90);

  // Attribute unter den Namen von dnd5e, nicht unter unseren.
  assert.equal(a.system.abilities.str.value, 18);
  assert.equal(a.system.abilities.cha.value, 7);
  assert.equal(a.system.abilities.ge, undefined);

  assert.equal(a.system.attributes.movement.walk, '30');
  assert.equal(a.system.attributes.movement.climb, '20');
  assert.equal(a.system.attributes.movement.fly, '');

  assert.equal(a.system.details.cr, 5);
  assert.equal(a.system.details.type.value, 'elemental');
  assert.equal(a.system.traits.size, 'lg');
  assert.deepEqual(a.system.traits.di.value, ['cold']);
  assert.deepEqual(a.system.traits.dr.value, ['slashing']);
  assert.deepEqual(a.system.traits.dv.value, ['fire']);
});

test('Faehigkeiten und Angriffe werden Gegenstaende', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const namen = a.items.map((i) => `${i.type}:${i.name}`);
  assert.deepEqual(namen, [
    'feat:Eishaut',
    'weapon:Klaue',
    'weapon:Frostsplitter',
    'feat:Frostatem'
  ]);
});

test('ein Nahkampfangriff traegt Schaden, Reichweite und das Hauptattribut', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const klaue = a.items.find((i) => i.name === 'Klaue');

  assert.deepEqual(klaue.system.damage.base.types, ['slashing']);
  assert.equal(klaue.system.damage.base.number, 2);
  assert.equal(klaue.system.damage.base.denomination, 8);
  assert.equal(klaue.system.damage.base.bonus, '4');
  assert.equal(klaue.system.range.reach, 10);
  assert.equal(klaue.system.range.value, null);

  // Der Angriffsbonus steht NICHT als Zahl da: Foundry rechnet ihn aus
  // Attribut und Uebungsbonus. Die Taetigkeit nennt nur das Attribut.
  const taetigkeit = Object.values(klaue.system.activities)[0];
  assert.equal(taetigkeit.type, 'attack');
  assert.equal(taetigkeit.attack.ability, 'str');
  assert.equal(taetigkeit.attack.bonus, '');
  assert.equal(taetigkeit.attack.flat, false);
  // Der Schaden kommt aus `system.damage.base`, deshalb bleibt `parts` leer.
  assert.equal(taetigkeit.damage.includeBase, true);
  assert.deepEqual(taetigkeit.damage.parts, []);
});

test('ein Fernkampfangriff traegt beide Weiten und keine Reichweite', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const splitter = a.items.find((i) => i.name === 'Frostsplitter');
  assert.equal(splitter.system.range.value, 60);
  assert.equal(splitter.system.range.long, 120);
  assert.equal(splitter.system.range.reach, null);
  // Ohne Bonus im Ausdruck bleibt das Bonusfeld leer und steht nicht auf "0".
  assert.equal(splitter.system.damage.base.bonus, '');
});

test('ein Flaechenangriff wird ein feat ohne Angriffswurf', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const atem = a.items.find((i) => i.name === 'Frostatem');
  assert.equal(atem.type, 'feat');
  assert.deepEqual(atem.system.activities, {});
});

test('jeder Gegenstand bekommt eine eigene Kennung', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const ids = a.items.map((i) => i._id);
  assert.equal(new Set(ids).size, ids.length, `doppelt: ${ids.join(', ')}`);
});

test('das Ganze ueberlebt JSON — nichts Unserialisierbares darin', () => {
  const a = alsFoundryMonster(MONSTER, fester());
  const wieder = JSON.parse(JSON.stringify(a));
  assert.deepEqual(wieder, a);
});

const ZUSTAND = {
  name: 'Absolute Kälte',
  kurzsatz: 'Das Ziel friert von innen.',
  stufen: [
    { nummer: 1, wirkungen: ['Bewegung um 10 Fuß verringert.'] },
    { nummer: 2, wirkungen: ['Nachteil auf Angriffswürfe.', 'Keine Reaktionen.'] }
  ],
  dauer: 'Eine Stunde',
  verschlimmerung: 'Eine Stufe je Runde im Eiswind',
  linderung: 'Eine Stufe bei einer Quelle von Wärme'
};

test('ein Zustand wird ein feat mit seiner Regel im HTML', () => {
  const i = alsFoundryZustand(ZUSTAND);

  assert.equal(i.type, 'feat');
  assert.equal(i.name, 'Absolute Kälte');
  assert.equal(i.system.type.value, 'monster');
  assert.equal(i.system.identifier, 'absolute-kaelte');
  assert.equal(i.system.source.rules, '2024');

  const html = i.system.description.value;
  assert.ok(html.includes('Das Ziel friert von innen.'), html);
  assert.ok(html.includes('Bewegung um 10 Fuß verringert.'), html);
  assert.ok(html.includes('Keine Reaktionen.'), html);
  assert.ok(html.includes('Eine Stunde'), html);
  assert.ok(html.includes('Eiswind'), html);
  assert.ok(html.includes('Wärme'), html);
  // Gestufte Zustaende bekommen Zwischenueberschriften, damit am Tisch
  // klar ist, was zu welcher Stufe gehoert.
  assert.ok(html.includes('Stufe 2'), html);
});

test('ein Zustand mit einer Stufe bekommt keine Zwischenueberschrift', () => {
  const i = alsFoundryZustand(
    { ...ZUSTAND, stufen: [{ nummer: 1, wirkungen: ['Geblendet.'] }] }
  );
  assert.ok(!i.system.description.value.includes('Stufe 1'));
  assert.ok(i.system.description.value.includes('Geblendet.'));
});

test('leere Felder erzeugen keine leeren Zeilen', () => {
  const i = alsFoundryZustand(
    { ...ZUSTAND, verschlimmerung: '', linderung: '   ' }
  );
  const html = i.system.description.value;
  assert.ok(!html.includes('Worsens'), html);
  assert.ok(!html.includes('Eases'), html);
});

test('ein Zustand ueberlebt JSON', () => {
  const i = alsFoundryZustand(ZUSTAND);
  assert.deepEqual(JSON.parse(JSON.stringify(i)), i);
});


test('Gegenstand: Bonus als Mechanik, Notiz in der Beschreibung', () => {
  const basis = { seltenheit: 'rare', einstimmung: false, fluch: '', wert: 4000 };
  const waffe = alsFoundryGegenstand({
    ...basis,
    name: 'Klinge',
    art: 'waffe',
    wirkungen: ['Du erhältst +2 auf Angriffs- und Schadenswürfe mit dieser magischen Waffe.'],
    notiz: 'Gehoerte dem Baron'
  });
  assert.equal(waffe.system.magicalBonus, 2);
  assert.match(waffe.system.description.value, /Gehoerte dem Baron/);
  const ruestung = alsFoundryGegenstand({ ...basis, name: 'Platte', art: 'ruestung', wirkungen: ['You have a +1 bonus to AC while wearing this armor.'] });
  assert.equal(ruestung.effects.length, 1);
  assert.equal(ruestung.effects[0].system.changes[0].key, 'system.attributes.ac.bonus');
  assert.deepEqual([ruestung.effects[0].system.changes[0].type, ruestung.effects[0].system.changes[0].value], ['add', 1]);
  // Ohne Angriff/RK im Satz ist „+1" kein Bonus.
  assert.equal(zahlenbonus(['Ladungen: +1 pro Tag']), null);
  const ring = alsFoundryGegenstand({ ...basis, name: 'Ring', art: 'ring', wirkungen: ['+1 to AC'] });
  assert.equal(ring.effects.length, 0);
});
