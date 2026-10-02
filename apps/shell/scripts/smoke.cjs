/**
 * Rauchtest der Huelle: startet die gebaute Anwendung wirklich und prueft die
 * Oberflaeche im laufenden Fenster.
 *
 * Bewusst wird der echte Hauptprozess geladen und kein nachgebautes Fenster
 * aufgemacht. Ein Nachbau haette hier zuerst gemeldet, alles sei in Ordnung,
 * obwohl kein einziger IPC-Kanal registriert war — genau die Sorte Fehler, um
 * derentwillen es diesen Test gibt.
 *
 * Laeuft mit eigenem userData-Verzeichnis, damit der Test die Fensterlage der
 * Person nicht ueberschreibt, die ihn ausfuehrt.
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-smoke-'));
app.setPath('userData', path.join(tmp, 'userData'));

// Erst jetzt: der Hauptprozess haengt sich an `whenReady` und legt sein
// Fenster im userData-Verzeichnis von oben ab.
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

async function warteAufFenster(versuche = 40) {
  for (let i = 0; i < versuche; i++) {
    const fenster = BaseWindow.getAllWindows()[0];
    const sicht = fenster?.contentView?.children?.[0];
    if (sicht?.webContents && !sicht.webContents.isLoading()) return { fenster, sicht };
    await warte(250);
  }
  return {};
}

/**
 * Prueft, ob die Dateien einer Anwendung dort liegen, wo `appDistDir` in
 * src/main/apps.ts sie sucht.
 *
 * Steht hier und nicht bei den Modultests: das sind Bau-Ergebnisse, und die
 * Modultests laufen in der CI ohne vorherigen Build. Genau daran ist dieser
 * Test zuerst gescheitert.
 *
 * Wert hat er trotzdem: laufen die Pfade auseinander, bleibt die Ansicht sonst
 * einfach leer, ohne Fehlermeldung. Hier steht dann, welche Datei fehlt.
 */
function appDist(id, ...weiter) {
  return path.join(__dirname, '..', 'dist', 'main', '..', '..', '..', id, 'dist', ...weiter);
}

function pruefeDateienDerApps() {
  // Story Creator: eigener Hauptprozess, also Preload und eine Oberflaeche
  // unter dist/renderer.
  const bs = appDist('backstory', 'main');
  pruefe(fs.existsSync(path.join(bs, 'preload.js')), `backstory: preload.js liegt unter ${bs}`);
  pruefe(
    fs.existsSync(path.join(bs, '..', 'renderer', 'index.html')),
    `backstory: index.html liegt neben ${bs}`
  );

  // Karteneditor: reine Web-Anwendung, sein Vite-Build liegt direkt in dist/.
  const mm = appDist('mapmaker');
  pruefe(fs.existsSync(path.join(mm, 'index.html')), `mapmaker: index.html liegt unter ${mm}`);
}

app.whenReady().then(async () => {
  pruefeDateienDerApps();

  const { fenster, sicht } = await warteAufFenster();
  if (!fenster || !sicht) {
    console.error('Kein Fenster mit geladener Ansicht gefunden.');
    app.exit(1);
    return;
  }

  const konsolenfehler = [];
  sicht.webContents.on('console-message', (_e, level, text) => {
    if (level >= 2) konsolenfehler.push(text.slice(0, 200));
  });

  // Das Fenster steht schon; die Oberflaeche darin braucht noch einen Moment
  // fuer ihren ersten Durchlauf samt IPC-Abfragen.
  await warte(1500);
  const js = (ausdruck) => sicht.webContents.executeJavaScript(ausdruck);

  pruefe(fenster.getBounds().width >= 960, 'Fenster mindestens in Mindestbreite');
  pruefe(await js('typeof window.shell === "object"'), 'Preload-Bruecke ist da');
  pruefe(await js("Boolean(document.querySelector('.titelleiste'))"), 'Titelleiste gerendert');
  pruefe(await js("Boolean(document.querySelector('.menue'))"), 'Startmenue gerendert');
  pruefe((await js("document.querySelectorAll('.kachel').length")) >= 5, 'mindestens fuenf Kacheln');
  /*
   * Ein Symbol ist ein SVG ODER ein Bild.
   *
   * Hier stand vorher nur „`.kachel svg` so oft wie `.kachel`". Das war
   * richtig, solange es keine eigenen Symbole gab — sobald eine PNG-Datei im
   * mitgelieferten Ordner liegt, rendert `AppSymbol` ein `img` statt des
   * eingebauten Vektors, und die Zahlen gehen auseinander. Die Pruefung ist
   * deshalb genau an dem Tag umgekippt, an dem die Symbole dazukamen — und
   * zwar in `main`, waehrend die Verzweigung ohne die Bilder gruen blieb.
   */
  pruefe(
    await js(
      "[...document.querySelectorAll('.kachel')].every((k) => k.querySelector('svg, img.app-symbol'))"
    ),
    'jede Kachel hat ein Symbol'
  );

  /*
   * Die Kacheln stehen in Gruppen nach Rolle am Tisch.
   *
   * Geprueft wird nicht nur, DASS es Ueberschriften gibt, sondern dass
   * zusammen wieder alle Kacheln herauskommen. Eine Kachel, die in keiner
   * Gruppe landet, waere von der Startseite verschwunden — und das faellt
   * an einer blossen Zahl nicht auf.
   */
  pruefe(
    (await js("document.querySelectorAll('.menue__gruppenname').length")) === 2,
    `zwei Gruppen auf der Kachelseite (${await js("document.querySelectorAll('.menue__gruppenname').length")})`
  );
  const inGruppen = await js("document.querySelectorAll('.menue__gruppe .kachel').length");
  const alleKacheln = await js("document.querySelectorAll('.kachel').length");
  pruefe(
    inGruppen === alleKacheln,
    `jede Kachel steht in einer Gruppe (${inGruppen} von ${alleKacheln})`
  );
  const gruppen = await js(
    "[...document.querySelectorAll('.menue__gruppe')].map((g) => g.querySelectorAll('.kachel').length)"
  );
  pruefe(
    gruppen.every((zahl) => zahl > 0),
    `keine leere Gruppe (${gruppen.join(', ')})`
  );
  pruefe((await js("document.querySelectorAll('.fensterknopf').length")) === 3, 'drei Fensterknoepfe');
  // Die Schiene erscheint erst, wenn ein Werkzeug gewaehlt ist.
  pruefe(!(await js("Boolean(document.querySelector('.schiene'))")), 'keine Schiene im Startmenue');
  // Prueft, dass die Kanaele wirklich registriert sind: die Fassung kommt aus
  // dem Hauptprozess.
  pruefe(await js("Boolean(document.querySelector('.menue__version'))"), 'Fassung aus dem Hauptprozess');
  // Voreingestellt ist Englisch. Stuende hier Deutsch, waere die
  // Sprachwahl irgendwo ueberschrieben worden.
  pruefe(
    (await js("document.querySelector('.menue__gruppenname').textContent")) ===
      'For everyone at the table',
    'Oberflaeche startet auf Englisch'
  );

  // Fensterknoepfe echt betaetigen. Die IPC-Kanaele sind der Teil, den die
  // Modultests nicht sehen koennen.
  //
  // Ob das Fenster danach wirklich maximiert ist, haengt aber am
  // Fenstermanager. Unter xvfb, wie es in der CI laeuft, gibt es keinen, und
  // `maximize()` bleibt folgenlos — auch direkt aufgerufen. Deshalb wird das
  // erst geprueft, nachdem festgestellt wurde, dass Maximieren hier ueberhaupt
  // geht. Sonst meldete dieser Test einen Umgebungsmangel als Fehler der
  // Anwendung.
  fenster.maximize();
  await warte(700);
  const maximierenMoeglich = fenster.isMaximized();
  fenster.unmaximize();
  await warte(400);

  await js("document.querySelector('[aria-label=\"Maximize\"]').click()");
  await warte(700);
  if (maximierenMoeglich) {
    pruefe(fenster.isMaximized(), 'Maximieren-Knopf maximiert das Fenster');
    await js("document.querySelector('[aria-label=\"Restore\"]').click()");
    await warte(700);
    pruefe(!fenster.isMaximized(), 'Wiederherstellen-Knopf stellt wieder her');
  } else {
    // Der Kanal wird trotzdem geprueft: der Klick oben haette sonst einen
    // Konsolenfehler hinterlassen, und den faengt die Pruefung am Ende ab.
    console.log('  --   Maximieren uebersprungen: kein Fenstermanager (xvfb)');
  }

  // Wechsel ins Werkzeug: die erste bereite Kachel anklicken. Solange keine
  // bereit ist, wird dieser Teil uebersprungen statt zu scheitern — sonst
  // muesste der Test bei jedem Bauabschnitt umgeschrieben werden.
  if ((await js("document.querySelectorAll('.kachel:not(:disabled)').length")) > 0) {
    /*
     * Waehrend des Ladens muss der Ladekreis stehen. Vorher blieb die
     * Flaeche leer, und ein langsamer Start sah aus wie ein haengendes
     * Programm.
     *
     * Beobachtet statt abgefragt: wie lange das Laden dauert, steht nicht
     * fest, und ein einzelner Blick danach traefe je nach Rechner mal ins
     * Leere. Gesucht wird deshalb, ob der Kreis *irgendwann* da war.
     */
    /*
     * Der Uebergang aus dem Startmenue: das Symbol der Kachel waechst ueber
     * den Schirm, und erst danach kommt der Ladekreis, falls noch geladen
     * wird.
     *
     * Beobachtet statt abgefragt: wie lange das Laden dauert, steht nicht
     * fest, und ein einzelner Blick danach traefe je nach Rechner mal ins
     * Leere. Festgehalten wird auch die Groesse, denn ein Feld, das sofort
     * den ganzen Schirm fuellt, waere kein Wachsen.
     *
     * Bewusst OHNE await: die Beobachtung muss laufen, waehrend geklickt
     * wird. Abgewartet wird sie unten.
     */
    const beobachtung = js(`(() => new Promise((fertig) => {
      const breiten = [];
      const uhr = setInterval(() => {
        const feld = document.querySelector('.uebergang');
        if (feld) breiten.push(Math.round(feld.getBoundingClientRect().width));
      }, 20);
      setTimeout(() => { clearInterval(uhr); fertig(breiten); }, 1200);
    }))()`);
    await js("document.querySelector('.kachel:not(:disabled)').click()");
    const breiten = await beobachtung;
    await warte(600);
    pruefe(breiten.length > 0, 'beim Klick auf eine Kachel laeuft der Uebergang');
    pruefe(
      breiten.length > 1 && breiten[breiten.length - 1] > breiten[0],
      `das Feld waechst wirklich (${breiten[0]} → ${breiten[breiten.length - 1]})`
    );
    pruefe(
      !(await js("Boolean(document.querySelector('.uebergang'))")),
      'und ist wieder weg, sobald das Werkzeug offen ist'
    );
    pruefe(await js("Boolean(document.querySelector('.schiene'))"), 'Schiene nach Wechsel da');
    /*
     * Geprueft wird die REGEL, nicht eine Anzahl.
     *
     * Vorher stand hier „mehr als null gesperrte Eintraege". Das ging
     * durch, solange es ein geplantes Werkzeug gab — und schlug fehl, als
     * der Encounter Creator fertig wurde und keines mehr uebrig war.
     * Gepassthat die Zahl, gemeint war die Regel: gesperrt ist genau das,
     * was noch nicht zu oeffnen ist.
     */
    const gesperrt = await js(
      "document.querySelectorAll('.schiene__eintrag:disabled').length"
    );
    const geplant = await js(
      "document.querySelectorAll('.schiene__eintrag--geplant').length"
    );
    pruefe(
      gesperrt === geplant,
      `gesperrt sind genau die geplanten Werkzeuge (${gesperrt} von ${geplant})`
    );
    await js("document.querySelector('.schiene__heim').click()");
    await warte(500);
    pruefe(await js("Boolean(document.querySelector('.menue'))"), 'zurueck im Startmenue');

    // ---- Verlauf: zurueck und vorwaerts ----
    //
    // Die Daumentasten der Maus lassen sich hier nicht druecken —
    // sendInputEvent kennt nur links, mitte, rechts. Geprueft wird deshalb
    // derselbe Weg, den sie nehmen: Alt und Pfeiltaste in der Huelle.
    const altPfeil = (taste) =>
      js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '${taste}', altKey: true, bubbles: true })); true`);

    await altPfeil('ArrowLeft');
    await warte(900);
    pruefe(
      !(await js("Boolean(document.querySelector('.menue'))")),
      'Alt und Pfeil links geht zum vorigen Werkzeug zurueck'
    );

    await altPfeil('ArrowRight');
    await warte(900);
    pruefe(
      await js("Boolean(document.querySelector('.menue'))"),
      'Alt und Pfeil rechts fuehrt wieder ins Startmenue'
    );

    // Am Anfang des Verlaufs passiert nichts, kein Rundlauf.
    await altPfeil('ArrowRight');
    await warte(600);
    pruefe(
      await js("Boolean(document.querySelector('.menue'))"),
      'am Ende des Verlaufs bleibt die Stelle stehen'
    );
  } else {
    console.log('  --   Kachelwechsel uebersprungen: keine waehlbare Kachel');
  }

  // ---- Die eingebettete Anwendung ----
  //
  // Der Teil oben sieht nur die Huelle. Ob die Anwendung darin wirklich
  // hochkommt, ihr Preload ankommt und die IPC-Kanaele antworten, kann nur
  // eine Pruefung in ihrer eigenen Ansicht beantworten.
  const bereiteKachel = "document.querySelector('.kachel--bereit')";
  if (await js(`Boolean(${bereiteKachel})`)) {
    await js(`${bereiteKachel}.click()`);
    // Der Story Creator liest beim Start Einstellungen und Speicherort.
    await warte(5000);

    const eingebettet = fenster.contentView.children[1];
    pruefe(Boolean(eingebettet), 'die Anwendung haengt als eigene Ansicht im Fenster');

    if (eingebettet) {
      const appJs = (ausdruck) => eingebettet.webContents.executeJavaScript(ausdruck);
      const appFehler = [];
      eingebettet.webContents.on('console-message', (_e, level, text) => {
        if (level >= 2) appFehler.push(text.slice(0, 200));
      });

      pruefe(await appJs('typeof window.api === "object"'), 'ihr Preload ist angekommen');
      pruefe(
        await appJs("Boolean(document.querySelector('.campaign-bar'))"),
        'ihre Oberflaeche ist da'
      );
      // Die schaerfste Pruefung: der Wert kommt ueber einen IPC-Kanal aus dem
      // Hauptprozess der Huelle. Antwortet er nicht, bleibt die Anwendung im
      // Ladezustand stehen.
      const geladen = await appJs(
        "document.body.innerText.includes('No campaign yet.') || " +
          "document.body.innerText.includes('Keine Kampagne vorhanden.')"
      );
      pruefe(geladen, 'ihre IPC-Kanaele antworten (Speicherort gelesen)');

      // Die Flaeche muss unter Titelleiste und Schiene liegen, nicht darueber.
      const b = eingebettet.getBounds();
      pruefe(b.x === 56 && b.y === 40, `ihre Flaeche laesst die Huelle frei (x=${b.x}, y=${b.y})`);

      // Wegwechseln und zurueck: der Zustand muss stehen bleiben. Das ist der
      // Grund, warum die Ansichten geladen bleiben statt neu zu laden.
      await appJs('window.__marke = 4711; window.__marke');
      await js("document.querySelector('.schiene__heim').click()");
      await warte(800);
      // `getVisible` gibt es auf einer WebContentsView in Electron 33 nicht.
      // Ersatzweise wird geprueft, was die Huelle selbst zeigt: im Startmenue
      // steht ihr Menue wieder da, also liegt nichts davor.
      pruefe(await js("Boolean(document.querySelector('.menue'))"), 'im Startmenue liegt sie hinten');
      await js(`${bereiteKachel}.click()`);
      await warte(1500);
      pruefe(
        await js("Boolean(document.querySelector('.buehne__flaeche'))"),
        'nach dem Zurueckwechseln liegt sie wieder vorn'
      );
      pruefe(
        (await appJs('window.__marke ?? null')) === 4711,
        'ihr Zustand hat den Wechsel ueberstanden'
      );
      pruefe(
        fenster.contentView.children.length === 2,
        'sie wurde nicht ein zweites Mal montiert'
      );

      pruefe(appFehler.length === 0, `keine Konsolenfehler in ihr (${appFehler.join(' | ') || 'keine'})`);
    }
  }

  // ---- Die zweite Anwendung: der Karteneditor ----
  //
  // Er ist anders gebaut als der Story Creator — kein Hauptprozess, kein
  // Preload, er speichert ueber die File System Access API und den
  // Browserspeicher. Genau deshalb steht er hier: die Huelle soll beide gleich
  // behandeln koennen.
  // Gewechselt wird ueber die Schiene, nicht ueber eine Kachel: an dieser
  // Stelle liegt der Story Creator vorn, und im Startmenue war die Huelle
  // zuletzt nicht mehr.
  // Bewegung: dass das gemeinsame Paket wirklich geladen ist, sieht man nur
  // an einer aufgeloesten Variablen. Fehlt der Import, sind alle Uebergaenge
  // still auf 0s — es sieht dann nicht kaputt aus, nur tot.
  // Verglichen wird in Millisekunden, nicht als Text: der Minifier schreibt
  // `220ms` zu `.22s` um, und ein Vergleich mit der Zeichenkette aus der
  // Quelle war deshalb im gebauten Stand falsch — obwohl alles stimmte.
  const platzDauer = await js(`(() => {
    const roh = getComputedStyle(document.documentElement)
      .getPropertyValue('--motion-place')
      .trim();
    if (roh.endsWith('ms')) return parseFloat(roh);
    if (roh.endsWith('s')) return parseFloat(roh) * 1000;
    return NaN;
  })()`);
  pruefe(platzDauer === 220, `die gemeinsamen Bewegungszeiten sind geladen (${platzDauer}ms)`);
  const markeVorher = await js(
    "document.querySelector('.schiene__marke')?.style.transform ?? ''"
  );
  pruefe(markeVorher.startsWith('translateY('), `der Marker der Schiene steht (${markeVorher})`);

  /*
   * Ueber den Namen und nicht ueber die Stelle in der Schiene.
   *
   * Hier stand `[...][1]`. Das hielt, solange der Karteneditor der zweite
   * Eintrag war — bis die Kacheln nach Rolle am Tisch sortiert wurden und
   * an der Stelle die Wuerfel standen. Der Test suchte dann eine
   * Zeichenflaeche im Wuerfelwerkzeug und meldete sie als fehlend.
   */
  const kartenEintrag =
    "[...document.querySelectorAll('.schiene__eintrag')].find((e) => /Map|Karten/i.test(e.textContent))";
  if (await js(`Boolean(${kartenEintrag})`)) {
    await js(`${kartenEintrag}.click()`);
    // PixiJS baut seinen Renderer auf, das dauert.
    await warte(6000);

    const karten = fenster.contentView.children[2];
    pruefe(Boolean(karten), 'der Karteneditor haengt als eigene Ansicht im Fenster');

    if (karten) {
      const kartenJs = (ausdruck) => karten.webContents.executeJavaScript(ausdruck);
    const appFehlerKarten = [];
    karten.webContents.on('console-message', (_e, level, text) => {
      if (level >= 2) appFehlerKarten.push(text.slice(0, 200));
    });
      pruefe(
        (await kartenJs("document.getElementById('root')?.children.length ?? 0")) > 0,
        'seine Oberflaeche ist da'
      );

      // Der Marker muss mitgewandert sein — sonst zeigt die Schiene weiter auf
      // das Werkzeug von vorhin.
      const markeNachher = await js(
        "document.querySelector('.schiene__marke')?.style.transform ?? ''"
      );
      pruefe(
        markeNachher.startsWith('translateY(') && markeNachher !== markeVorher,
        `der Marker ist mitgewandert (${markeVorher} -> ${markeNachher})`
      );

      // Die Einfahrt faehrt die Ansicht von rechts an ihren Platz. Kommt sie
      // dort nicht genau an, steht das Werkzeug dauerhaft um ein paar Punkte
      // verschoben — mit einem Streifen Huelle daneben, den niemand erklaeren
      // kann. Verglichen wird mit der Ansicht des Story Creators: beide
      // bekommen dieselbe Flaeche, und so steht die Sollgroesse nicht ein
      // zweites Mal in diesem Skript. Gewartet wird grosszuegig, die Fahrt
      // dauert 220ms.
      await warte(800);
      const lage = karten.getBounds();
      const gleicheFlaeche = fenster.contentView.children[1].getBounds();
      pruefe(
        lage.x === gleicheFlaeche.x &&
          lage.y === gleicheFlaeche.y &&
          lage.width === gleicheFlaeche.width &&
          lage.height === gleicheFlaeche.height,
        `die Einfahrt kommt genau an (${JSON.stringify(lage)} statt ${JSON.stringify(
          gleicheFlaeche
        )})`
      );
      // Die schaerfste Pruefung fuer ihn: ohne Renderer gibt es kein Canvas,
      // und ohne relative Pfade im Buendel laedt unter file:// gar nichts.
      pruefe(await kartenJs('Boolean(document.querySelector("canvas"))'), 'seine Zeichenflaeche steht');

      // Getrennte Sitzungen: was er in den Browserspeicher legt, darf beim
      // Story Creator nicht auftauchen.
      await kartenJs("localStorage.setItem('probe.trennung', 'karten'); true");
      const bs = fenster.contentView.children[1];
      const fremd = await bs.webContents.executeJavaScript(
        "localStorage.getItem('probe.trennung')"
      );
      pruefe(fremd === null, `getrennter Browserspeicher (beim Nachbarn: ${JSON.stringify(fremd)})`);
      await kartenJs("localStorage.removeItem('probe.trennung'); true");

      // Hin und her: beide bleiben geladen, keine wird neu aufgebaut.
      await js("document.querySelector('.schiene__eintrag').click()");
      await warte(1500);
      await js(`${kartenEintrag}.click()`);
      await warte(1500);
      pruefe(
        fenster.contentView.children.length === 3,
        `nach dem Hin und Her immer noch drei Ansichten (${fenster.contentView.children.length})`
      );
      pruefe(
        await kartenJs('Boolean(document.querySelector("canvas"))'),
        'seine Zeichenflaeche hat den Wechsel ueberstanden'
      );

      // Die Huelle legt ihm eine Content-Security-Policy ueber die Sitzung.
      // Dass die Zeichenflaeche oben steht, ist schon der halbe Beleg: ohne
      // das eval-freie Pixi-Modul liesse sie sich unter dieser Richtlinie gar
      // nicht aufbauen. Hier kommt der Rest.
      pruefe(
        (await kartenJs(
          "document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]') === null"
        )),
        'seine Seite bringt selbst keine Richtlinie mit (die kommt aus der Huelle)'
      );
      // Vor der Probe unten festhalten: die weist absichtlich ein Skript ab
      // und erzeugt damit selbst eine Meldung, die hier nicht mitzaehlen darf.
      pruefe(
        appFehlerKarten.filter((m) => /Content Security Policy/i.test(m)).length === 0,
        'die Anwendung selbst verstoesst nicht gegen die Richtlinie'
      );

      const cspVerstoss = await kartenJs(`(async () => {
        // Der Beweis, dass die Richtlinie wirklich greift: ein Skript von
        // einer fremden Adresse muss abgewiesen werden.
        try {
          await new Promise((fertig, daneben) => {
            const s = document.createElement('script');
            s.src = 'https://example.invalid/x.js';
            s.onload = () => fertig();
            s.onerror = () => daneben(new Error('abgewiesen'));
            document.head.appendChild(s);
            setTimeout(() => daneben(new Error('Zeit abgelaufen')), 2000);
          });
          return 'DURCHGELASSEN';
        } catch {
          return 'abgewiesen';
        }
      })()`);
      pruefe(cspVerstoss === 'abgewiesen', `fremde Skripte werden abgewiesen (${cspVerstoss})`);

      // ---- Sprachkopplung ----
      //
      // Anforderung: aendert man die Sprache an irgendeiner Stelle, gilt sie
      // ueberall — in der Huelle selbst und in jeder eingebetteten Anwendung,
      // unabhaengig davon, wo umgestellt wurde. Geprueft wird beide
      // Richtungen: einmal ausgeloest im Karteneditor, einmal im Backstory
      // Creator.
      //
      // Der Karteneditor hat kein eigenes Sprachmenue in der Werkzeugleiste,
      // es steckt im Hilfe-Dialog (F1 / „? Help").
      await kartenJs(`(() => {
        const hilfe = [...document.querySelectorAll('button')].find((b) =>
          /help/i.test(b.textContent)
        );
        hilfe?.click();
      })()`);
      await warte(700);
      await kartenJs(`(() => {
        const wahl = document.querySelector('#help-language');
        const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setzer.call(wahl, 'de');
        wahl.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await warte(1200);

      pruefe(
        await bs.webContents.executeJavaScript(
          "document.body.innerText.includes('Keine Kampagne vorhanden.')"
        ),
        'der Story Creator hat die vom Karteneditor gesetzte Sprache uebernommen'
      );
      pruefe(
        (await js("document.querySelector('[data-einstellungen-knopf]').textContent")) === 'Einstellungen',
        'die Huelle selbst hat ebenfalls auf Deutsch umgeschaltet'
      );

      /*
       * Und zurueck, diesmal ueber die Sprache DES STORY CREATORS.
       *
       * Die steht jetzt im Einstellungen-Dialog der Huelle, im Abschnitt des
       * Werkzeugs — der eigene Dialog im Werkzeug faellt eingebettet weg.
       * Frueher lief dieser Schritt dort; als er wegfiel, blieb der Rauchtest
       * an `document.querySelector('.field select')` haengen, das es nicht
       * mehr gab. Die gepruefte Sache ist dieselbe geblieben: eine Umstellung
       * am Werkzeug erreicht die Huelle und alle anderen Werkzeuge.
       */
      await js("[...document.querySelectorAll('.schiene__eintrag')][0].click()");
      await warte(1000);
      await js(
        `[...document.querySelectorAll('.titelleiste__knopf')].find(b => /^(Settings|Einstellungen)$/.test(b.textContent.trim())).click(); true`
      );
      await warte(900);
      const sprachwahlGesetzt = await js(`(() => {
        const wahl = [...document.querySelectorAll('.werkzeugfelder__gruppe select')]
          .find((s) => [...s.options].some((o) => o.value === 'en'));
        if (!wahl) return false;
        const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
        setzer.call(wahl, 'en');
        wahl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      pruefe(
        sprachwahlGesetzt,
        'die Sprache des Story Creators steht im Dialog der Huelle'
      );
      await warte(1500);
      // Den Dialog wieder zu, sonst liegt er ueber dem naechsten Abschnitt.
      await js(
        `[...document.querySelectorAll('button')].find(b => /^(Close|Schließen)$/.test(b.textContent.trim()))?.click(); true`
      );
      await warte(500);

      pruefe(
        (await js("document.querySelector('[data-einstellungen-knopf]').textContent")) === 'Settings',
        'eine Aenderung im Story Creator erreicht auch die Huelle'
      );
      pruefe(
        await kartenJs(
          "[...document.querySelectorAll('button')].some((b) => b.textContent.trim().endsWith('Help'))"
        ),
        'und den Karteneditor — die Kopplung wirkt in beide Richtungen'
      );
    }
  }

  // ---- Dialoge der Huelle ----
  //
  // Sie liegen in der Ansicht der Huelle, und die liegt *unter* den
  // Anwendungen. Der interessante Fall ist deshalb der mit einer geoeffneten
  // Anwendung: ohne das Zuruecktreten waere der Dialog im DOM und trotzdem
  // nicht zu sehen.
  await js("document.querySelector('[data-einstellungen-knopf]').click()");
  await warte(900);
  pruefe(await js("Boolean(document.querySelector('.dialog'))"), 'Einstellungen gehen auf');
  pruefe(
    fenster.contentView.children.length > 1 &&
      fenster.contentView.children[1].getBounds().height > 0,
    'die Anwendung ist noch da, nur zurueckgetreten'
  );

  // Sprache umstellen: der Wert muss auf der Platte landen und die Oberflaeche
  // sofort umschalten.
  //
  // Die Sprache steht unter „Aussehen" und ist kein Klappfeld mehr, sondern
  // zwei Knoepfe. Gesucht wird ueber `data-sprache`, nicht ueber die
  // Beschriftung — die haengt ja gerade an der Sprache.
  await js(`(() => {
    const bereich = document.querySelector('.einst__nav-knopf[data-bereich="aussehen"]');
    if (bereich) bereich.click();
    return true;
  })()`);
  await warte(400);
  await js(`(() => {
    const knopf = document.querySelector('.segment__knopf[data-sprache="de"]');
    if (!knopf) return false;
    knopf.click();
    return true;
  })()`);
  await warte(900);
  pruefe(
    (await js("document.querySelector('.einst__nav-titel').textContent")) === 'Einstellungen',
    'die Oberflaeche schaltet sofort auf Deutsch'
  );
  const einstellungsDatei = path.join(app.getPath('userData'), 'einstellungen.json');
  pruefe(fs.existsSync(einstellungsDatei), 'die Einstellungen wurden gespeichert');
  if (fs.existsSync(einstellungsDatei)) {
    pruefe(
      JSON.parse(fs.readFileSync(einstellungsDatei, 'utf8')).language === 'de',
      'und zwar mit der gewaehlten Sprache'
    );
  }
  pruefe(!(await js("Boolean(document.querySelector('.feld__fehler'))")), 'ohne Fehlermeldung');

  // Escape schliesst.
  await js(`document.querySelector('.dialog').dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  )`);
  await warte(700);
  pruefe(!(await js("Boolean(document.querySelector('.dialog'))")), 'Escape schliesst den Dialog');

  // Ueber: die Fassung muss darin stehen, sonst kaeme sie nicht durch.
  await js("document.querySelector('[data-ueber-knopf]').click()");
  await warte(900);
  pruefe(await js("Boolean(document.querySelector('.ueber'))"), 'Über geht auf');
  pruefe(
    await js("document.querySelector('.ueber').textContent.includes('AGPL') || " +
      "document.querySelector('.ueber').textContent.includes('Affero')"),
    'die Lizenz steht darin'
  );
  pruefe(
    (await js("document.querySelectorAll('.ueber__verweise button').length")) === 3,
    'drei Verweise: Quelltext, Lizenz und Hinweise (CC-BY-Nennung)'
  );
  await js("document.querySelector('.dialog__knopf').click()");
  await warte(700);
  pruefe(!(await js("Boolean(document.querySelector('.dialog'))")), 'und geht wieder zu');

  // Die Fensterlage muss nach einem Verschieben auf der Platte stehen. Der
  // Schreibvorgang ist gebuendelt, deshalb das Warten.
  const zustandsDatei = path.join(app.getPath('userData'), 'fenster.json');
  fenster.setBounds({ x: 60, y: 40, width: 1100, height: 800 });
  await warte(1200);
  pruefe(fs.existsSync(zustandsDatei), 'Fensterlage wurde gemerkt');
  if (fs.existsSync(zustandsDatei)) {
    const gemerkt = JSON.parse(fs.readFileSync(zustandsDatei, 'utf8'));
    pruefe(gemerkt.width === 1100 && gemerkt.height === 800, 'die gemerkte Groesse stimmt');
  }

  pruefe(konsolenfehler.length === 0, `keine Konsolenfehler (${konsolenfehler.join(' | ') || 'keine'})`);

  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  if (fehlschlaege.length > 0) {
    console.error(`\n${fehlschlaege.length} Pruefung(en) fehlgeschlagen.`);
    app.exit(1);
  } else {
    console.log('\nRauchtest der Huelle bestanden.');
    app.exit(0);
  }
});
