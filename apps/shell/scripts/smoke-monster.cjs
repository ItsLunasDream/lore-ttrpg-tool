/**
 * Der Monster Creator in der Huelle.
 *
 * Geprueft wird der Weg, den kein Modelltest sieht: laedt das Werkzeug,
 * wuerfelt es ein Monster, steht der Befund da, und landet ein gespeichertes
 * Monster wirklich als Datei im Datenordner — mit allen Zahlen im Kopf, denn
 * daran haengt spaeter der Encounter Creator.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-monster.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'monster-'));
const userData = path.join(tmp, 'userData');
app.setPath('userData', userData);
process.env.TTRPG_TOOLS_START_APP = 'monster';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

process.on('unhandledRejection', (grund) => {
  console.log('FEHLER: unbehandelte Ablehnung:', grund);
  app.exit(1);
});

app.whenReady().then(async () => {
  await warte(5000);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1320, height: 900 });
  await warte(800);

  const sicht = fenster.contentView.children.find((ansicht) =>
    ansicht.webContents.getURL().includes('/apps/monster/')
  );
  pruefe(Boolean(sicht), 'die Ansicht des Monster Creators ist da');
  if (!sicht) {
    app.exit(1);
    return;
  }
  const js = (a) => sicht.webContents.executeJavaScript(a);
  const menue = fenster.contentView.children[0];
  const mjs = (a) => menue.webContents.executeJavaScript(a);

  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  // --- Wuerfeln -------------------------------------------------------------
  console.log('\nEin Monster wuerfeln:');
  pruefe(await js("Boolean(document.querySelector('.regler'))"), 'die Regler stehen da');

  // Grad 8 einstellen, damit die Zahlen gross genug sind, um sie zu erkennen.
  await js(`(() => {
    const feld = document.querySelector('.regler select');
    const setzer = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setzer.call(feld, '8');
    feld.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await warte(200);

  await js("[...document.querySelectorAll('.knopf')].find(k => /Roll|Würfeln/.test(k.textContent)).click(); true");
  await warte(600);

  const name = await js("document.querySelector('.statblock__name')?.textContent ?? ''");
  pruefe(name.length > 2, `ein Monster steht da (${name})`);
  pruefe(
    await js("Boolean(document.querySelector('.befund'))"),
    'und der Befund steht darunter'
  );

  // --- Der Statblock traegt, was ein Statblock traegt ------------------------
  /*
   * Die Zeilen, die am Tisch gebraucht werden. „Schaden pro Runde" allein
   * hat niemandem gesagt, was passiert, wenn das Monster dran ist — jetzt
   * steht der einzelne Angriff da, mit Waffe, Reichweite und Schadensart.
   */
  pruefe(
    (await js("document.querySelectorAll('.statblock__attribute th').length")) === 6,
    'die sechs Attribute stehen in einer Reihe'
  );
  const grund = await js("[...document.querySelectorAll('.statblock__zeile')].map(z => z.textContent).join(' | ')");
  // Die Huelle laeuft im Rauchtest auf Englisch, die Anwendung folgt ihr.
  for (const [de, en] of [['Rüstungsklasse', 'Armor class'], ['Trefferpunkte', 'Hit points'], ['Bewegung', 'Speed']]) {
    pruefe(grund.includes(de) || grund.includes(en), `die Zeile „${en}" steht da`);
  }
  pruefe(/Fuß|ft\./.test(grund), 'und die Bewegung steht in Fuß');

  const aktionen = await js("[...document.querySelectorAll('.statblock__eintrag')].map(e => e.textContent).join(' | ')");
  pruefe(
    /auf Treffer|Rettungswurf|to hit|saving throw/.test(aktionen),
    'mindestens ein Angriff mit Trefferbonus oder Rettungswurf'
  );
  pruefe(/\dd\d/.test(aktionen), 'und mit einem Wuerfelausdruck');

  const ueberschriften = await js("[...document.querySelectorAll('.statblock__ueberschrift')].map(u => u.textContent).join(', ')");
  pruefe(
    /Aktionen|Actions/.test(ueberschriften),
    `die Abschnitte sind sortiert (${ueberschriften})`
  );

  // --- Legendaer an macht einen sichtbaren Unterschied -----------------------
  const ohneLegende = await js(
    "[...document.querySelectorAll('.statblock__ueberschrift')].some(u => /Legend/.test(u.textContent))"
  );
  await js(`(() => {
    const kaestchen = document.querySelector('.regler__kaestchen input');
    kaestchen.click();
    return true;
  })()`);
  await warte(150);
  await js("[...document.querySelectorAll('.knopf')].find(k => /Roll|Würfeln/.test(k.textContent)).click(); true");
  await warte(600);
  const mitLegende = await js(
    "[...document.querySelectorAll('.statblock__ueberschrift')].some(u => /Legend/.test(u.textContent))"
  );
  pruefe(mitLegende && !ohneLegende, 'der Schalter fuer legendaere Aktionen aendert den Block');

  // Zurueck, damit der Rest wie vorher laeuft.
  await js("document.querySelector('.regler__kaestchen input').click(); true");
  await warte(150);
  await js("[...document.querySelectorAll('.knopf')].find(k => /Roll|Würfeln/.test(k.textContent)).click(); true");
  await warte(600);
  const name2 = await js("document.querySelector('.statblock__name')?.textContent ?? ''");
  pruefe(name2.length > 2, `und danach steht wieder ein Monster da (${name2})`);

  // --- Der Befund sagt „passt" ---------------------------------------------
  /*
   * Der Erzeuger baut gegen dieselben Richtwerte, gegen die die Pruefung
   * rechnet. Waere das nicht so, meckerte das Werkzeug an seinen eigenen
   * Monstern herum — und niemand wuerde ihm noch glauben.
   */
  pruefe(
    await js("document.querySelector('.befund').className.includes('befund--gut')"),
    'ein frisch gewuerfeltes Monster besteht die eigene Pruefung'
  );
  pruefe(
    (await js("document.querySelectorAll('.haelfte').length")) === 2,
    'beide Haelften werden getrennt ausgewiesen'
  );

  // --- Bearbeiten -----------------------------------------------------------
  console.log('\nVon Hand bearbeiten:');
  const klickeKnopf = (muster) => js(`(() => {
    const knopf = [...document.querySelectorAll('.werkzeuge .knopf')].find((k) => ${muster}.test(k.textContent));
    if (knopf) knopf.click();
    return Boolean(knopf);
  })()`);
  const alterName = await js("document.querySelector('.statblock__name')?.textContent ?? ''");
  pruefe(await klickeKnopf('/^(Edit|Bearbeiten)$/'), 'der Knopf „Bearbeiten" ist da');
  await warte(300);
  pruefe(await js("Boolean(document.querySelector('[data-bearbeiten]'))"), 'die Bearbeiten-Ansicht geht auf');
  const setzeName = (name) => js(`(() => {
    const feld = document.querySelector('[data-bearbeiten] input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(feld, ${JSON.stringify(name)});
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await setzeName('Probebiest');
  await warte(200);
  await klickeKnopf('/^(Done|Fertig)$/');
  await warte(300);
  pruefe(
    (await js("document.querySelector('.statblock__name')?.textContent ?? ''")) === 'Probebiest',
    'der geaenderte Name steht im Statblock'
  );
  // Zurueck zum alten Namen, damit die Schritte danach wie vorher laufen.
  // Dabei eine Fähigkeit dazu und wieder weg, und noch während sie ausblendet
  // den Namen tippen: das Löschen darf die Eingabe nicht überschreiben.
  await klickeKnopf('/^(Edit|Bearbeiten)$/');
  await warte(200);
  const faehigkeiten = () => js("document.querySelectorAll('.bearbeiten__faehigkeit').length");
  const vorherFaehig = await faehigkeiten();
  await js("[...document.querySelectorAll('[data-bearbeiten] .knopf')].find((k) => /^(Add feature|Fähigkeit hinzufügen)$/.test(k.textContent.trim()))?.click(); true");
  await warte(200);
  pruefe((await faehigkeiten()) === vorherFaehig + 1, 'eine Fähigkeit kommt dazu');
  await js("[...document.querySelectorAll('.bearbeiten__faehigkeit')].at(-1).querySelector('.bearbeiten__reihe .knopf').click(); true");
  await warte(30);
  await setzeName(alterName);
  await warte(600);
  pruefe((await faehigkeiten()) === vorherFaehig, 'und ist nach dem Ausblenden wieder weg');
  pruefe(
    (await js("document.querySelector('[data-bearbeiten] input').value")) === alterName,
    'der Name, getippt während des Ausblendens, bleibt stehen'
  );
  await klickeKnopf('/^(Done|Fertig)$/');
  await warte(300);

  // --- Speichern ------------------------------------------------------------
  console.log('\nIn die Sammlung:');
  await js("[...document.querySelectorAll('.knopf')].find(k => /collection|Sammlung/i.test(k.textContent)).click(); true");
  await warte(900);

  // Jedes Werkzeug hat einen eigenen Unterordner im Datenordner (siehe
  // `datenordner()` in apps.ts), darin liegt der Ordner `monster`. Genau
  // diesen Pfad wird spaeter der Encounter Creator lesen.
  const ordner = path.join(userData, 'monster', 'monster');
  const dateien = fs.existsSync(ordner) ? fs.readdirSync(ordner).filter((d) => d.endsWith('.md')) : [];
  pruefe(dateien.length === 1, `eine Datei liegt im Ordner (${dateien.join(', ') || 'keine'})`);

  if (dateien.length > 0) {
    const inhalt = fs.readFileSync(path.join(ordner, dateien[0]), 'utf8');
    /*
     * Der Kopf ist die Schnittstelle zum Encounter Creator: er muss die
     * Zahlen tragen, damit niemand den Statblock zerlegen muss.
     */
    for (const feld of ['cr:', 'tp:', 'rk:', 'schaden_pro_runde:', 'angriffsbonus:', 'thema:', 'rolle:']) {
      pruefe(inhalt.includes(feld), `der Kopf traegt ${feld}`);
    }
    pruefe(/^# .+/m.test(inhalt), 'und der Leib traegt den Namen als Ueberschrift');
    for (const feld of ['st:', 'ge:', 'ko:', 'in:', 'we:', 'ch:', 'tempo:']) {
      pruefe(inhalt.includes(feld), `der Kopf traegt ${feld}`);
    }
  }

  // --- Die Sammlung ---------------------------------------------------------
  console.log('\nDie Sammlung:');
  await js("[...document.querySelectorAll('.reiter__knopf')].find(k => /Collection|Sammlung/.test(k.textContent)).click(); true");
  await warte(500);
  pruefe(
    (await js("document.querySelectorAll('.monsterkachel').length")) === 1,
    'das gespeicherte Monster steht als Kachel da'
  );

  // Die Suche: ein Feld fuer Name, Art und Grad.
  const suchen = async (text) => {
    await js(`(() => {
      const feld = document.querySelector('.sammlung__suche');
      const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setzer.call(feld, ${JSON.stringify(text)});
      feld.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await warte(250);
    return js("document.querySelectorAll('.monsterkachel').length");
  };

  pruefe((await suchen('8')) === 1, 'eine Zahl sucht den Grad');
  pruefe((await suchen('99')) === 0, 'ein anderer Grad findet nichts');
  pruefe((await suchen(name2.slice(0, 4))) === 1, 'der Anfang des Namens findet es wieder');
  await suchen('');

  // --- Umschalten auf die Liste --------------------------------------------
  await js("[...document.querySelectorAll('.sammlung__ansicht .knopf')].at(-1).click(); true");
  await warte(300);
  pruefe(
    (await js("document.querySelectorAll('.monsterliste tbody tr').length")) === 1,
    'die Liste zeigt dasselbe Monster'
  );

  // --- Pruefen von Hand -----------------------------------------------------
  console.log('\nEin vorhandenes Monster pruefen:');
  await js("[...document.querySelectorAll('.reiter__knopf')].find(k => /Check|Prüfen/.test(k.textContent)).click(); true");
  await warte(400);
  pruefe(await js("Boolean(document.querySelector('.pruefen .befund'))"), 'der Befund steht auch hier');

  // Absichtlich zu viele Trefferpunkte: die Ampel muss anschlagen.
  await js(`(() => {
    const felder = [...document.querySelectorAll('.pruefen input[type=number]')];
    const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setzer.call(felder[0], '900');
    felder[0].dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await warte(400);
  pruefe(
    await js("document.querySelector('.pruefen .befund').className.includes('befund--hoch')"),
    'neunhundert Trefferpunkte bei Grad 5 gelten als zu stark'
  );
  pruefe(
    (await js("document.querySelectorAll('.pruefen .befund__vorschlaege li').length")) > 0,
    'und es steht dabei, was sich drehen laesst'
  );

  // --- In den Story Creator -------------------------------------------------
  /*
   * Der Weg, der lange kaputt war und es niemandem gesagt hat.
   *
   * Der Monster Creator legte die Notiz unter dem Typ „creature" an, den es
   * in keiner Notiztyp-Vorlage gibt; der Story Creator wies das mit
   * `error.unknownNoteType` ab. Gemerkt hat das niemand, weil dieser
   * Rauchtest den Export gar nicht anfasste — er sah nur den Monster
   * Creator fuer sich, und der meldet einen Fehlschlag genauso ruhig wie
   * einen Erfolg.
   *
   * Deshalb laeuft der Weg hier jetzt ganz durch: Kampagne anlegen,
   * exportieren, auf der Platte nachsehen.
   */
  console.log('\nIn den Story Creator:');
  // Ueber die Schiene, nicht ueber die Kacheln: das Startmenue liegt
  // hinter der offenen Anwendung, und seine Kacheln sind von hier aus nicht
  // anklickbar.
  await mjs(`(() => {
    const eintrag = [...document.querySelectorAll('.schiene__eintrag:not(:disabled)')]
      .find((k) => /Story|Backstory/i.test(k.title));
    if (!eintrag) return false;
    eintrag.click();
    return true;
  })()`);
  await warte(5000);
  const bs = fenster.contentView.children.find((ansicht) =>
    ansicht.webContents.getURL().includes('/apps/backstory/')
  );
  pruefe(Boolean(bs), 'der Story Creator kommt hoch');

  if (bs) {
    const kampagne = await bs.webContents.executeJavaScript(`(async () => {
      const auspacken = (antwort) => (antwort && 'value' in antwort ? antwort.value : antwort);
      const liste = auspacken(await window.api.campaigns.list()) ?? [];
      if (liste.length > 0) return liste[0].name;
      return auspacken(await window.api.campaigns.create('Testrunde')).name;
    })()`);
    pruefe(typeof kampagne === 'string' && kampagne.length > 0, `eine Kampagne steht bereit (${kampagne})`);

    // Zurueck zum Monster Creator und exportieren.
    await mjs(`(() => {
      const eintrag = [...document.querySelectorAll('.schiene__eintrag:not(:disabled)')]
        .find((k) => /Monster/i.test(k.title));
      if (!eintrag) return false;
      eintrag.click();
      return true;
    })()`);
    await warte(2500);
    // Zurueck auf den Reiter „Bauen": der Test stand zuletzt beim Pruefen,
    // und dort gibt es keinen Export.
    await js(`(() => {
      const reiter = [...document.querySelectorAll('.reiter__knopf')].find((k) =>
        /Build|Bauen/.test(k.textContent)
      );
      if (reiter) reiter.click();
      return true;
    })()`);
    await warte(400);

    const geklickt = await js(`(() => {
      const knopf = [...document.querySelectorAll('.knopf')].find((k) =>
        /Story Creator/i.test(k.textContent)
      );
      if (!knopf) return false;
      knopf.click();
      return true;
    })()`);
    pruefe(geklickt === true, 'der Knopf „In den Story Creator" ist da');
    await warte(1500);
    /*
     * Der Knopf fuer Foundry.
     *
     * Geklickt wird er NICHT: er oeffnet einen Dateidialog des Systems, und
     * der bliebe im Rauchtest offen stehen. Dass die erzeugte Datei stimmt,
     * pruefen die Modultests (packages/foundry und apps/monster/tests/foundry).
     * Hier geht es um die Verdrahtung: steht der Knopf da, und bietet die
     * Bruecke den Kanal an, den er ruft?
     */
    const foundryKnopf = await js(
      `[...document.querySelectorAll('.knopf')].some((k) => /Foundry/i.test(k.textContent))`
    );
    pruefe(foundryKnopf === true, 'der Knopf „Für Foundry (JSON)" ist da');
    pruefe(
      (await js("typeof window.monster.foundry")) === 'function',
      'und die Bruecke bietet den Kanal dafuer an'
    );


    const meldung = await js("document.querySelector('.meldung')?.textContent ?? ''");
    pruefe(
      !/error\.|unknownNoteType|did not work|ging nicht/i.test(meldung),
      `der Export meldet keinen Fehler (${meldung})`
    );

    // Wo der Vault liegt, sagt der Story Creator selbst — der Ort steht in
    // seinen Einstellungen und ist nicht fest verdrahtet.
    const wurzel = await bs.webContents.executeJavaScript(`(async () => {
      const antwort = await window.api.settings.get();
      const wert = antwort && 'value' in antwort ? antwort.value : antwort;
      return wert.vaultRoot;
    })()`);
    const kampagnenOrdner = path.join(wurzel, 'campaigns');
    const gefunden = [];
    if (fs.existsSync(kampagnenOrdner)) {
      for (const eintrag of fs.readdirSync(kampagnenOrdner)) {
        const notizen = path.join(kampagnenOrdner, eintrag, 'notes');
        if (fs.existsSync(notizen)) gefunden.push(...fs.readdirSync(notizen));
      }
    }
    pruefe(gefunden.length > 0, `die Notiz liegt in der Kampagne (${gefunden.join(', ') || 'nichts'})`);
  }

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nMonster Creator bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
