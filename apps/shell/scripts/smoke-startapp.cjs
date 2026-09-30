/**
 * Prueft den Direktstart in einem Werkzeug (TTRPG_TOOLS_START_APP).
 *
 * Eigener Lauf, weil er den Hauptprozess mit einer anderen Umgebung starten
 * muss als der gewoehnliche Rauchtest — beides in einem Prozess ginge nicht.
 *
 * Wichtig ist dabei nicht nur, dass die Anwendung vorn liegt, sondern auch,
 * dass die Oberflaeche der Huelle das mitbekommen hat: sonst zeigte sie ihr
 * Startmenue, waehrend dahinter schon eine Anwendung laeuft.
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-startapp-'));
app.setPath('userData', path.join(tmp, 'userData'));

process.env.TTRPG_TOOLS_START_APP = 'backstory';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const fehlschlaege = [];
function pruefe(bedingung, beschreibung) {
  if (bedingung) console.log(`  ok   ${beschreibung}`);
  else {
    console.log(`  FEHL ${beschreibung}`);
    fehlschlaege.push(beschreibung);
  }
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  // Der Direktstart montiert die Anwendung, das dauert.
  await warte(7000);

  const fenster = BaseWindow.getAllWindows()[0];
  pruefe(Boolean(fenster), 'Fenster ist da');
  if (!fenster) {
    app.exit(1);
    return;
  }

  pruefe(fenster.contentView.children.length === 2, 'Huelle und eine Anwendung liegen im Fenster');

  const huelle = fenster.contentView.children[0];
  const js = (ausdruck) => huelle.webContents.executeJavaScript(ausdruck);

  pruefe(!(await js("Boolean(document.querySelector('.menue'))")), 'kein Startmenue mehr zu sehen');
  pruefe(await js("Boolean(document.querySelector('.schiene'))"), 'die Schiene ist da');
  pruefe(
    (await js("document.querySelector('.titelleiste__pfad')?.textContent ?? ''")).includes(
      'Story Creator'
    ),
    'die Titelleiste nennt das Werkzeug'
  );
  // Der Platzhalter darf nicht stehen: dahinter liegt eine echte Anwendung.
  pruefe(!(await js("Boolean(document.querySelector('.platzhalter'))")), 'kein Platzhaltertext');

  const anwendung = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/backstory/'));
  pruefe(
    await anwendung.webContents.executeJavaScript("Boolean(document.querySelector('.campaign-bar'))"),
    'die Anwendung ist wirklich hochgekommen'
  );

  fs.rmSync(tmp, { recursive: true, force: true });
  if (fehlschlaege.length > 0) {
    console.error(`\n${fehlschlaege.length} Pruefung(en) fehlgeschlagen.`);
    app.exit(1);
  } else {
    console.log('\nDirektstart bestanden.');
    app.exit(0);
  }
});
