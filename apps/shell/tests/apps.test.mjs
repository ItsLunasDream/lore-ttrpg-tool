import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  APPS,
  CHROME,
  ROLLEN,
  ROLLE_KEY,
  STATUS_KEY,
  appsMitRolle,
  findApp,
  istWaehlbar,
  berechneAppFlaeche,
  translate
} =
  require('../dist/tests/entry.cjs');

test('jede App hat eine eindeutige ID', () => {
  const ids = APPS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte IDs wuerden IPC-Kanaele kollidieren lassen');
});

test('IDs taugen als Praefix fuer Kanaele und Dateinamen', () => {
  // Dieselbe Zeichenmenge wie Regel 3 der Konventionen: die IDs landen in
  // Kanalnamen und spaeter in Pfaden.
  for (const app of APPS) {
    assert.match(app.id, /^[A-Za-z0-9_-]+$/, `ungueltige ID: ${app.id}`);
  }
});

test('jede App hat einen bekannten Zustand', () => {
  for (const app of APPS) {
    assert.ok(
      ['bereit', 'vorbereitet', 'geplant'].includes(app.status),
      `${app.id} hat Zustand ${app.status}`
    );
  }
});

test('findApp findet und liefert sonst undefined', () => {
  assert.equal(findApp('backstory')?.id, 'backstory');
  assert.equal(findApp('gibt-es-nicht'), undefined);
});

test('die Anwendungsflaeche laesst genau Titelleiste und Schiene frei', () => {
  const flaeche = berechneAppFlaeche(1280, 860);
  assert.deepEqual(flaeche, {
    x: CHROME.schieneBreite,
    y: CHROME.titelleisteHoehe,
    width: 1280 - CHROME.schieneBreite,
    height: 860 - CHROME.titelleisteHoehe
  });
});

test('die Anwendungsflaeche wird nie negativ', () => {
  // Waehrend eines Fensterwechsels kann kurz eine Groesse von 0 durchlaufen.
  const flaeche = berechneAppFlaeche(0, 0);
  assert.equal(flaeche.width, 0);
  assert.equal(flaeche.height, 0);
});

test('nur geplante Werkzeuge sind gesperrt', () => {
  assert.equal(istWaehlbar('bereit'), true);
  assert.equal(istWaehlbar('vorbereitet'), true, 'in Arbeit heisst anklickbar, nur noch nicht eingebettet');
  assert.equal(istWaehlbar('geplant'), false);
});

test('jeder Zustand hat einen Textschluessel fuer die Kachel', () => {
  for (const app of APPS) {
    assert.ok(STATUS_KEY[app.status], `kein Schluessel fuer ${app.status}`);
  }
});

/*
 * Die Rolle am Tisch.
 *
 * Neun Kacheln nebeneinander sind eine Wand; gruppiert findet man, was man
 * sucht. Geprueft wird, dass die Einteilung vollstaendig ist und die
 * Gruppen zusammen wieder alle Werkzeuge ergeben — eine Kachel, die in
 * keiner Gruppe landet, waere von der Startseite verschwunden.
 */
test('jedes Werkzeug hat eine Rolle, und es gibt nur die beiden', () => {
  for (const app of APPS) {
    assert.ok(ROLLEN.includes(app.rolle), `${app.id}: ${app.rolle}`);
  }
});

test('die Gruppen ergeben zusammen wieder alle Werkzeuge', () => {
  const ausGruppen = ROLLEN.flatMap((rolle) => appsMitRolle(rolle).map((a) => a.id));
  assert.deepEqual(ausGruppen.sort(), APPS.map((a) => a.id).sort());
  // Und keines doppelt: sonst stuende eine Kachel zweimal da.
  assert.equal(new Set(ausGruppen).size, ausGruppen.length);
});

test('keine Gruppe ist leer', () => {
  // Eine leere Gruppe waere eine Ueberschrift ohne Inhalt.
  for (const rolle of ROLLEN) {
    assert.ok(appsMitRolle(rolle).length > 0, `${rolle} ist leer`);
  }
});

test('jede Gruppe hat eine Ueberschrift in beiden Sprachen', () => {
  for (const rolle of ROLLEN) {
    const schluessel = ROLLE_KEY[rolle];
    assert.ok(schluessel, rolle);
    for (const sprache of ['de', 'en']) {
      assert.notEqual(translate(sprache, schluessel), schluessel, `${rolle} in ${sprache}`);
    }
  }
});

test('Wuerfel, Story Creator, Nachschlagewerk, Charakterbogen und Kalender gehoeren allen', () => {
  // Die eine inhaltliche Festlegung, die es hier gibt: an der Kampagne
  // schreiben beide Seiten mit, gewuerfelt wird von allen, und
  // nachgeschlagen auch — am Tisch meist von jemand anderem als dem, der
  // leitet. Den Charakterbogen fuehren die Spielenden selbst, und auf eine
  // Terminumfrage antworten alle. Alles andere ist Vorbereitung oder Leitung.
  const fuerAlle = appsMitRolle('alle').map((a) => a.id).sort();
  assert.deepEqual(fuerAlle, ['backstory', 'charakterbogen', 'dice', 'kalender', 'nachschlagewerk']);
});

test('bei vergroesserter Oberflaeche rueckt die Anwendung mit Titelleiste und Schiene', () => {
  const flaeche = berechneAppFlaeche(1280, 860, 150);
  assert.equal(flaeche.x, Math.round(CHROME.schieneBreite * 1.5));
  assert.equal(flaeche.y, Math.round(CHROME.titelleisteHoehe * 1.5));
  assert.equal(flaeche.width, 1280 - flaeche.x);
  assert.equal(flaeche.height, 860 - flaeche.y);
});

test('jede App steht in der Dateinamen-Tabelle von symbole/LIESMICH.md', async () => {
  const { readFile } = await import('node:fs/promises');
  const liesmich = await readFile(new URL('../symbole/LIESMICH.md', import.meta.url), 'utf8');
  const fehlend = APPS.filter((a) => !liesmich.includes(`\`${a.id}.png\``)).map((a) => a.id);
  assert.deepEqual(fehlend, [], 'neue Werkzeuge in symbole/LIESMICH.md eintragen');
});

test('jedes mitgelieferte Symbol gehört zu einem Werkzeug (Tippfehler im Dateinamen)', async () => {
  const { readdir } = await import('node:fs/promises');
  const bekannt = new Set([...APPS.map((a) => a.id), 'austausch', 'banner']);
  const dateien = await readdir(new URL('../symbole/', import.meta.url));
  const fremd = dateien
    .filter((d) => /\.(png|jpe?g|webp|gif)$/i.test(d))
    .filter((d) => !bekannt.has(d.replace(/\.[^.]+$/, '')));
  assert.deepEqual(fremd, [], 'Dateiname muss die Kennung des Werkzeugs sein, siehe symbole/LIESMICH.md');
});
