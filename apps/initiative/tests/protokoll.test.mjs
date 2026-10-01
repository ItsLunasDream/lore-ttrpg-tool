import test from 'node:test';
import assert from 'node:assert/strict';
import entry from '../dist/tests/entry.cjs';

const { leererKampf, neuerTeilnehmer, beginne, naechsterZug, aendereHp, kampfEreignisse } = entry;

function kampfMit(...namen) {
  const teilnehmer = namen.map((name, i) => {
    const t = neuerTeilnehmer(name);
    return { ...t, initiative: 20 - i, koerper: [{ ...t.koerper[0], hp: 5, hpMax: 5 }] };
  });
  return { ...leererKampf(), name: 'Brücke', teilnehmer };
}

test('Protokoll: Beginn, Runde, Ausfall, Ende', () => {
  const vorher = kampfMit('Anna', 'Goblin');
  const laeuft = beginne(vorher);
  assert.deepEqual(kampfEreignisse(vorher, laeuft, 'de').map((m) => m.art), ['kampf-beginn']);
  assert.match(kampfEreignisse(vorher, laeuft, 'de')[0].text, /Brücke \(Anna, Goblin\)/);

  const zug2 = naechsterZug(naechsterZug(laeuft));
  assert.equal(zug2.runde, 2);
  assert.deepEqual(kampfEreignisse(naechsterZug(laeuft), zug2, 'en'), [{ art: 'runde', text: 'Round 2' }]);
  // Zurück ist kein Ereignis.
  assert.deepEqual(kampfEreignisse(zug2, laeuft, 'de'), []);

  const g = zug2.teilnehmer.find((t) => t.name === 'Goblin');
  const tot = aendereHp(zug2, g.id, g.koerper[0].id, 9);
  assert.deepEqual(kampfEreignisse(zug2, tot, 'de'), [{ art: 'raus', text: 'Goblin fällt aus' }]);
  assert.deepEqual(kampfEreignisse(tot, tot, 'de'), []);

  const ende = { ...tot, laeuft: false, amZug: -1, runde: 0 };
  assert.deepEqual(kampfEreignisse(tot, ende, 'de'), [{ art: 'kampf-ende', text: 'Kampf endet: Brücke (Runde 2)' }]);
});
