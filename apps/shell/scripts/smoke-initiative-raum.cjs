/**
 * Rauchtest: die Initiative im Raum teilen (docs/austausch.md).
 *
 * Die App eroeffnet einen Raum und teilt ihren Kampf. Ein Gast, von Hand
 * gebaut aus dem Protokoll, tritt bei. Geprueft wird, was die Nutzerin
 * festgelegt hat:
 *
 * - Der Gast bekommt den Stand, Spielerfiguren mit genauen TP, Gegner nur
 *   mit grobem Zustand, ohne Zahlen.
 * - Eine Figur laesst sich dem Gast zuordnen; seine Aenderung an ihr kommt
 *   im Kampf an, eine an einem Gegner nicht.
 * - Ein geteilter Kampf des Gastes erscheint in der App zum Ansehen.
 * - „Teilen beenden" meldet das Ende.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-initiative-raum.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { gast } = require('./raumgast.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ini-raum-'));
const userData = path.join(tmp, 'userData');
const ordner = path.join(userData, 'initiative');
fs.mkdirSync(ordner, { recursive: true });
const koerper = (id, hp, hpMax) => ({ id, marke: '', hp, hpMax, tempHp: 0, raus: false });
const figur = (id, name, ini, spieler, k) => ({
  id, name, initiative: ini, feinwert: 0, istSpieler: spieler, istTerrain: false,
  koerper: [k], zustaende: [], bild: null, notiz: ''
});
fs.writeFileSync(
  path.join(ordner, 'kampf.json'),
  JSON.stringify({
    schemaVersion: 1, begegnungId: null, name: 'Bruecke', amZug: -1, runde: 0, laeuft: false,
    teilnehmer: [
      figur('held', 'Mira', 18, true, koerper('k1', 20, 24)),
      figur('ork', 'Ork', 12, false, koerper('k2', 5, 15))
    ]
  })
);
app.setPath('userData', userData);
process.env.TTRPG_TOOLS_START_APP = 'initiative';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};
async function bis(bedingung, ms = 5000) {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) return false;
    await warte(50);
  }
  return true;
}

/** Der letzte Stand der Initiative, den der Gast bekommen hat. */
const letzterStand = (g) => {
  const werkzeug = g.alle.filter((n) => n.typ === 'werkzeug' && n.werkzeug === 'initiative');
  for (let i = werkzeug.length - 1; i >= 0; i -= 1) {
    const b = JSON.parse(werkzeug[i].inhalt);
    if (b.art === 'stand' || b.art === 'ende') return b;
  }
  return null;
};

app.whenReady().then(async () => {
  await warte(5000);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  const huelle = fenster.contentView.children[0];
  const tracker = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/initiative/'));
  if (!tracker) {
    console.log('  FEHL der Tracker steht nicht');
    app.exit(1);
    return;
  }
  const hjs = (a) => huelle.webContents.executeJavaScript(a);
  const js = (a) => tracker.webContents.executeJavaScript(a);
  const konsole = [];
  tracker.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  pruefe(await js("!document.querySelector('[data-initiative-teilen]')"), 'ohne Raum gibt es keinen Teilen-Knopf');

  const auf = await hjs("window.shell.raum.eroeffnen('Runde', 'pw')");
  pruefe(auf.ok && auf.port > 0, `die Huelle eroeffnet einen Raum (Port ${auf.port})`);
  pruefe(
    await bis(() => js("Boolean(document.querySelector('[data-initiative-teilen]'))")),
    'dann erscheint der Teilen-Knopf im Tracker'
  );

  const anna = gast(auf.port, 'pw', 'Anna');
  pruefe(await bis(() => anna.ich !== null), 'Anna tritt bei');
  await warte(400);

  // --- Mira gehoert Anna: ueber das Menue der Zeile ------------------------
  await js(`(() => { const n = [...document.querySelectorAll('.zeile__name')].find(b => b.textContent.startsWith('Mira'));
    n.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 120 })); return true; })()`);
  await warte(300);
  const gewaehlt = await js(`(() => { const e = [...document.querySelectorAll('.kontextmenue button, [role=menuitem]')]
    .find(b => /Anna/.test(b.textContent)); if (!e) return false; e.click(); return true; })()`);
  pruefe(gewaehlt, 'das Menue der Zeile bietet Anna als Besitzerin an');
  pruefe(
    await bis(() => js("document.querySelector('[data-besitzer]')?.dataset.besitzer === 'Anna'")),
    'die Zeile traegt die Marke'
  );

  // --- Teilen ----------------------------------------------------------------
  await js("document.querySelector('[data-initiative-teilen]').click(); true");
  pruefe(await bis(() => letzterStand(anna)?.art === 'stand'), 'Anna bekommt den Stand');
  const stand = letzterStand(anna)?.stand;
  const mira = stand?.teilnehmer.find((t) => t.name === 'Mira');
  const ork = stand?.teilnehmer.find((t) => t.name === 'Ork');
  pruefe(mira?.koerper[0].hp === 20 && mira?.gehoert === 'Anna', 'Mira mit genauen TP und Anna als Besitzerin');
  pruefe(
    ork && ork.koerper[0].hp === undefined && ork.koerper[0].hpMax === undefined && ork.koerper[0].stufe === 'schwer',
    `der Ork nur grob (${JSON.stringify(ork?.koerper[0])})`
  );
  pruefe(stand?.teilnehmer[0]?.name === 'Mira', 'in der Reihenfolge der Initiative');

  // --- Aenderungen von Anna -------------------------------------------------
  const aendere = (aenderung) =>
    anna.schreibe({ typ: 'werkzeug', von: 'x', an: auf.ich ?? null, werkzeug: 'initiative', inhalt: JSON.stringify({ art: 'aenderung', aenderung }), zeit: '' });
  aendere({ art: 'hp', teilnehmerId: 'held', koerperId: 'k1', hp: 11 });
  pruefe(
    await bis(() => letzterStand(anna)?.stand?.teilnehmer.find((t) => t.id === 'held')?.koerper[0].hp === 11),
    'Annas TP fuer Mira kommen an und gehen als neuer Stand zurueck'
  );
  pruefe(
    await bis(async () => (await js("[...document.querySelectorAll('.koerper__hp')].map(e => e.value).join(',')")).startsWith('11')),
    'und stehen im Tracker'
  );
  aendere({ art: 'zustand-dazu', teilnehmerId: 'held', name: 'Liegend', runden: null });
  pruefe(
    await bis(() => letzterStand(anna)?.stand?.teilnehmer.find((t) => t.id === 'held')?.zustaende.some((z) => z.name === 'Liegend')),
    'ein Zustand von Anna kommt an'
  );
  aendere({ art: 'hp', teilnehmerId: 'ork', koerperId: 'k2', hp: 0 });
  await warte(800);
  const kampf = JSON.parse(fs.readFileSync(path.join(ordner, 'kampf.json'), 'utf8'));
  pruefe(kampf.teilnehmer.find((t) => t.id === 'ork').koerper[0].hp === 5, 'eine Aenderung am Gegner wird abgewiesen');

  // --- Annas eigener geteilter Kampf erscheint zum Ansehen ------------------
  const annasKampf = {
    version: 1, name: 'Nebenkampf', runde: 2, laeuft: true,
    teilnehmer: [{ id: 'w', name: 'Wolf', istSpieler: false, istTerrain: false, gehoert: null, amZug: true, zustaende: [],
      koerper: [{ id: 'kw', marke: '', stufe: 'angeschlagen', raus: false }] }]
  };
  anna.schreibe({ typ: 'werkzeug', von: 'x', an: null, werkzeug: 'initiative', inhalt: JSON.stringify({ art: 'stand', stand: annasKampf }), zeit: '' });
  pruefe(
    await bis(() => js("document.querySelector('[data-geteilt-zeile=\"Wolf\"] [data-stufe]')?.dataset.stufe === 'angeschlagen'")),
    'ein geteilter Kampf von Anna erscheint im Tracker'
  );

  // Gehoert eine Figur in Annas Kampf der App, laesst sie sich hier aendern;
  // die Aenderung geht nur an Anna.
  const { zustand } = await hjs('window.shell.raum.zustand()');
  const mitEigener = {
    ...annasKampf,
    teilnehmer: [
      ...annasKampf.teilnehmer,
      { id: 'b', name: 'Borin', istSpieler: true, istTerrain: false, gehoert: zustand.ich.name, amZug: false, zustaende: [],
        koerper: [{ id: 'kb', marke: '', hp: 30, hpMax: 30, tempHp: 0, stufe: 'unverletzt', raus: false }] }
    ]
  };
  anna.schreibe({ typ: 'werkzeug', von: 'x', an: null, werkzeug: 'initiative', inhalt: JSON.stringify({ art: 'stand', stand: mitEigener }), zeit: '' });
  pruefe(
    await bis(() => js("Boolean(document.querySelector('[data-geteilt-hp=\"Borin\"]'))")),
    'die eigene Figur in Annas Kampf hat ein TP-Feld'
  );
  await js(`(() => { const el = document.querySelector('[data-geteilt-hp="Borin"]'); el.value = '17';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return true; })()`);
  pruefe(
    await bis(() =>
      anna.alle.some((n) => n.typ === 'werkzeug' && /"art":"aenderung"/.test(n.inhalt) && JSON.parse(n.inhalt).aenderung.hp === 17)
    ),
    'die Aenderung geht an Anna'
  );
  anna.schreibe({ typ: 'werkzeug', von: 'x', an: null, werkzeug: 'initiative', inhalt: JSON.stringify({ art: 'ende' }), zeit: '' });
  pruefe(await bis(() => js("!document.querySelector('[data-geteilt]')")), 'und verschwindet mit ihrem Ende');

  // --- Gegnerzustand ganz aus ----------------------------------------------
  await js("document.querySelector('[data-initiative-stufen]').click(); true");
  pruefe(
    await bis(() => {
      const s = letzterStand(anna)?.stand;
      return s && s.teilnehmer.find((t) => t.id === 'ork')?.koerper.length === 0 && s.teilnehmer.find((t) => t.id === 'held')?.koerper[0].hp === 11;
    }),
    'ausgeschaltet sieht Anna vom Ork keinen Zustand mehr, von Mira weiter die TP'
  );

  // --- Beenden -----------------------------------------------------------------
  await js("document.querySelector('[data-initiative-teilen]').click(); true");
  pruefe(await bis(() => letzterStand(anna)?.art === 'ende'), '„Teilen beenden" meldet das Ende');

  anna.zu();
  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nInitiative im Raum bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
