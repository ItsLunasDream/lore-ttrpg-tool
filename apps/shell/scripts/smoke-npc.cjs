/**
 * Rauchtest des NPC Creators — in der Huelle, an der laufenden Anwendung.
 *
 * Die Modelltests unter apps/npc/tests pruefen die Tabellen und den Erzeuger:
 * dass es genug Namen gibt, dass Eigenheiten selten sind, dass ein
 * festgehaltenes Feld stehen bleibt. Was sie nicht sehen koennen, ist, ob ein
 * Klick ankommt und ob die Einbettung ueberhaupt haelt.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-npc.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'npc-smoke-'));
app.setPath('userData', path.join(tmp, 'userData'));
process.env.TTRPG_TOOLS_START_APP = 'npc';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

app.whenReady().then(async () => {
  await warte(5000);
  const fenster = BaseWindow.getAllWindows()[0];
  const sicht = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/npc/'));
  pruefe(Boolean(sicht), 'der NPC Creator haengt als eigene Ansicht im Fenster');
  if (!sicht) {
    app.exit(1);
    return;
  }

  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 760 });
  await warte(600);
  const js = (a) => sicht.webContents.executeJavaScript(a);
  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  pruefe(await js("Boolean(document.querySelector('.npcapp'))"), 'seine Oberflaeche steht');
  pruefe(await js("typeof window.npc === 'object'"), 'die Bruecke zum Hauptprozess ist da');

  const wuerfeln =
    "[...document.querySelectorAll('button')].find(b => /Neue Figur|New character/.test(b.textContent))";
  pruefe(await js(`Boolean(${wuerfeln})`), 'der Knopf fuer eine neue Figur ist da');

  // --- Eine Figur wuerfeln -------------------------------------------------
  await js(`${wuerfeln}.click(); true`);
  await warte(300);
  pruefe(
    (await js("document.querySelector('.figur__name')?.textContent ?? ''")).length > 0,
    'ein Klick erzeugt eine Figur mit Namen'
  );
  pruefe(
    (await js("document.querySelectorAll('.zeile').length")) === 7,
    'sie hat sieben Felder'
  );
  // Neu gewürfelt: was sich ändert, leuchtet kurz auf (Rückmeldung).
  await js(`${wuerfeln}.click(); true`);
  await warte(150);
  pruefe((await js("document.querySelectorAll('.zeile__wert.motion-neu').length")) > 0, 'beim Neuwürfeln leuchtet Geändertes auf');

  // --- Ein Feld festhalten -------------------------------------------------
  /*
   * Die wichtigste Pruefung der Bedienung: ohne das Festhalten wuerfelt man
   * den guten Namen weg, waehrend man den Beruf sucht. Geprueft wird an der
   * laufenden Anwendung, weil der Zustand in der Oberflaeche liegt und die
   * Modelltests nur die Funktion dahinter sehen.
   */
  const name = () => js("document.querySelector('.zeile__wert').value");
  const vorher = await name();
  await js("[...document.querySelectorAll('.zeile')][0].querySelector('.zeile__schloss').click(); true");
  await warte(200);
  pruefe(
    await js("[...document.querySelectorAll('.zeile')][0].classList.contains('zeile--fest')"),
    'das Feld ist als festgehalten zu sehen'
  );

  let gleich = true;
  for (let versuch = 0; versuch < 8; versuch++) {
    await js(`${wuerfeln}.click(); true`);
    await warte(160);
    if ((await name()) !== vorher) gleich = false;
  }
  pruefe(gleich, 'und bleibt ueber acht Wuerfe stehen');

  // Freigeben: danach darf er sich wieder aendern.
  await js("[...document.querySelectorAll('.zeile')][0].querySelector('.zeile__schloss').click(); true");
  await warte(160);
  let geaendert = false;
  for (let versuch = 0; versuch < 20 && !geaendert; versuch++) {
    await js(`${wuerfeln}.click(); true`);
    await warte(120);
    if ((await name()) !== vorher) geaendert = true;
  }
  pruefe(geaendert, 'freigegeben wuerfelt er wieder mit');

  // --- Merkliste -----------------------------------------------------------
  const merken =
    "[...document.querySelectorAll('button')].find(b => /Merken|Keep/.test(b.textContent))";
  await js(`${merken}.click(); true`);
  await warte(200);
  pruefe(
    (await js("document.querySelectorAll('.merkliste__liste li').length")) === 1,
    'eine gemerkte Figur steht in der Liste'
  );

  // --- Der Export ----------------------------------------------------------
  /*
   * Ohne geoeffneten Story Creator kann nichts angelegt werden. Wichtig
   * ist, dass das gesagt wird, statt stumm ins Leere zu schreiben — und dass
   * die Anwendung dabei nicht stehenbleibt.
   */
  const exportKnopf =
    "[...document.querySelectorAll('button')].find(b => /Story Creator/.test(b.textContent))";
  pruefe(await js(`Boolean(${exportKnopf})`), 'der Knopf zum Uebergeben ist da');
  await js(`${exportKnopf}.click(); true`);
  await warte(900);
  const meldung = await js("document.querySelector('.stoerung')?.textContent ?? ''");
  pruefe(
    meldung.length > 0,
    `ohne Story Creator sagt der Export, woran es liegt (${meldung || 'nichts'})`
  );

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' | ') || 'keine'})`);

  console.log(fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen.` : '\nNPC Creator bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
