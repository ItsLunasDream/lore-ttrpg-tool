import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { Raumablage, bereinigeRaum, ladeTischschluessel, VORGABE_RAUMEINSTELLUNGEN } = require('../dist/tests/entry.cjs');

const SCHLUESSEL = 'MCowBQYDK2VwAyEAabcdefghijklmnopqrstuvwxyz0123456789ABCDEFG=';

async function ordner() {
  return mkdtemp(join(tmpdir(), 'raeume-'));
}

test('Raum speichern, lesen, auflisten, loeschen; ohne Passwort', async () => {
  const wurzel = await ordner();
  try {
    const ablage = new Raumablage(join(wurzel, 'raeume'));
    assert.deepEqual(await ablage.liste(), []);
    const r = await ablage.speichere({
      id: 'raum-abc',
      name: 'Freitagsrunde',
      internet: true,
      port: 47000,
      rollen: { [SCHLUESSEL]: { name: 'Anna', sl: true } },
      gruppeninventar: null,
      einstellungen: VORGABE_RAUMEINSTELLUNGEN,
      geaendert: '',
      passwort: 'geheim'
    });
    assert.equal(r.name, 'Freitagsrunde');
    const text = await readFile(join(wurzel, 'raeume', 'raum-abc.json'), 'utf8');
    assert.ok(!text.includes('geheim'), 'kein Passwort in der Datei');
    assert.deepEqual((await ablage.lies('raum-abc')).rollen[SCHLUESSEL], { name: 'Anna', sl: true });
    assert.equal((await ablage.liste()).length, 1);
    assert.equal(await ablage.loesche('raum-abc'), true);
    assert.deepEqual(await ablage.liste(), []);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
});

test('Unsichere Eingaben werden bereinigt', () => {
  assert.equal(bereinigeRaum({ name: '   ' }), null);
  assert.equal(bereinigeRaum('x'), null);
  const r = bereinigeRaum({
    id: '../boese',
    name: 'Runde',
    port: 80,
    rollen: { 'kein schluessel!': { name: 'X', sl: true }, [SCHLUESSEL]: { name: 'B', sl: 'ja' } },
    einstellungen: { gruppeNehmen: false }
  });
  assert.match(r.id, /^raum-[0-9a-f]+$/);
  assert.equal(r.port, null);
  assert.deepEqual(Object.keys(r.rollen), [SCHLUESSEL]);
  assert.equal(r.rollen[SCHLUESSEL].sl, false);
  assert.deepEqual(r.einstellungen, { gruppeNehmen: false, slMarkieren: true });
});

test('Einlesen: vergebene ID bekommt eine neue, Muell wird abgelehnt', async () => {
  const wurzel = await ordner();
  try {
    const ablage = new Raumablage(wurzel);
    const erster = await ablage.lesEin(JSON.stringify({ id: 'raum-eins', name: 'A' }));
    assert.equal(erster.id, 'raum-eins');
    const zweiter = await ablage.lesEin(JSON.stringify({ id: 'raum-eins', name: 'B' }));
    assert.notEqual(zweiter.id, 'raum-eins');
    assert.equal(await ablage.lesEin('kein json'), null);
    assert.equal((await readdir(wurzel)).filter((n) => n.endsWith('.json')).length, 2);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
});

test('Tischschluessel: einmal angelegt, danach derselbe; kaputt wird ersetzt', async () => {
  const wurzel = await ordner();
  try {
    const datei = join(wurzel, 'tischschluessel.json');
    const a = ladeTischschluessel(datei);
    const b = ladeTischschluessel(datei);
    assert.equal(a.oeffentlich, b.oeffentlich);
    await writeFile(datei, 'kaputt', 'utf8');
    const c = ladeTischschluessel(datei);
    assert.notEqual(c.oeffentlich, a.oeffentlich);
  } finally {
    await rm(wurzel, { recursive: true, force: true });
  }
});
