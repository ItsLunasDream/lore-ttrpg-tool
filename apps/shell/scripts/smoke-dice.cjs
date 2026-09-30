/**
 * Rauchtest des Wuerfels — in der Huelle, an der laufenden Anwendung.
 *
 * Die Modelltests unter apps/dice/tests pruefen die Rechnung: Pool, Ausdruck,
 * Abzugswuerfel, Lesbarkeit der Zahlenfarbe. Was sie nicht sehen koennen, ist,
 * ob ein Klick ankommt: ob die Formen gezeichnet werden, ob ein Rechtsklick
 * verringert statt das Kontextmenue zu oeffnen, ob die Effekte erscheinen und
 * ob hundert Wuerfel die Anwendung stehenlassen.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-dice.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dice-smoke-'));
app.setPath('userData', path.join(tmp, 'userData'));
process.env.TTRPG_TOOLS_START_APP = 'dice';
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};

const SETZ = `const setz = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, v); el.dispatchEvent(new Event('input',{bubbles:true})); };`;

app.whenReady().then(async () => {
  await warte(5000);
  const fenster = BaseWindow.getAllWindows()[0];
  const sicht = fenster?.contentView?.children?.find((v) => v.webContents?.getURL().includes('/apps/dice/'));
  pruefe(Boolean(sicht), 'der Wuerfel haengt als eigene Ansicht im Fenster');
  if (!sicht) {
    app.exit(1);
    return;
  }
  const js = (a) => sicht.webContents.executeJavaScript(a);

  /**
   * Echte Tastenanschlaege statt gesetzter Werte.
   *
   * Der Unterschied ist nicht theoretisch: ein Zahlenfeld nimmt ein getipptes
   * Minus nur an, solange es leer ist, und `el.value = '-'` verwirft es
   * sofort. Ein Fehler beim Modifikator war deshalb mit gesetzten Werten
   * ueberhaupt nicht zu sehen — und ein anderer, den es gar nicht gab,
   * schien vorhanden.
   */
  const tippe = async (text) => {
    for (const zeichen of text) {
      sicht.webContents.sendInputEvent({ type: 'keyDown', keyCode: zeichen });
      sicht.webContents.sendInputEvent({ type: 'char', keyCode: zeichen });
      sicht.webContents.sendInputEvent({ type: 'keyUp', keyCode: zeichen });
      await warte(45);
    }
  };
  const leereFeld = async () => {
    for (let i = 0; i < 12; i++) {
      sicht.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
      sicht.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
      await warte(25);
    }
  };

  const konsole = [];
  sicht.webContents.on('console-message', (_e, l, t) => {
    if (l < 2) return;
    // Ohne Grafikkarte meldet Chromium den Rueckfall auf Software-WebGL und
    // Treiberhinweise zur Leistung. Beides sagt etwas ueber die Umgebung und
    // nichts ueber die Anwendung.
    if (/software WebGL|GL Driver Message|GroupMarkerNotSet/.test(t)) return;
    konsole.push(t.slice(0, 160));
  });

  pruefe(await js("Boolean(document.querySelector('.wuerfelapp'))"), 'seine Oberflaeche steht');
  pruefe(await js("typeof window.dice === 'object'"), 'die Bruecke zum Hauptprozess ist da');
  pruefe(
    (await js("document.querySelectorAll('.artfeld').length")) === 8,
    'alle acht Wuerfelarten stehen zur Wahl'
  );

  // Jede Art muss eine eigene Form haben — sie ist das Einzige, woran man sie
  // erkennt. Verglichen werden die Pfaddaten der Umrisse.
  const formen = await js(
    "JSON.stringify([...document.querySelectorAll('.artfeld svg > path:first-of-type')].map(p => p.getAttribute('d')))"
  );
  const eindeutig = new Set(JSON.parse(formen));
  pruefe(eindeutig.size === 8, `alle acht Formen sind verschieden (${eindeutig.size} von 8)`);

  // Dasselbe fuer die vier Musterknoepfe. Sie zeigen denselben Wuerfel in
  // vier Mustern, unterscheiden sich also nur in der Fuellung. Hier lag ein
  // Fehler, den erst der Nutzer im Bild gesehen hat: die Kennung des
  // Farbverlaufs enthielt das Muster nicht, alle vier Definitionen hiessen
  // gleich, und weil bei doppelter Kennung im selben Dokument die erste
  // gewinnt, sahen alle vier Knoepfe aus wie der erste.
  //
  // Geprueft wird die Regel dahinter, nicht der eine Fall: keine zwei
  // Definitionen im Dokument duerfen denselben Namen bei verschiedenem
  // Inhalt tragen. Das faengt auch den naechsten Fall, etwa zwei Wuerfel
  // derselben Art in verschiedenen Farben nebeneinander.
  //
  // Zwei Anlaeufe davor taugten nicht, und beide fielen erst in der
  // Gegenprobe durch: ein Vergleich der Definitionen blieb gruen, weil im
  // Bildbaum auch beim Fehler vier verschiedene Verlaeufe stehen — sie werden
  // nur nicht gezeichnet. Ein Vergleich der aufgenommenen Bilder blieb
  // ebenfalls gruen, weil Marmor und Sternenhimmel zusaetzlich Adern und
  // Sterne zeichnen und der ausgewaehlte Knopf einen eigenen Hintergrund hat.
  const doppelte = JSON.parse(
    await js(`(() => {
      const nachName = new Map();
      for (const el of document.querySelectorAll('svg defs > [id]')) {
        const inhalt = el.tagName + ':' + el.getAttribute('cx') + ',' + el.getAttribute('cy') + ',' + el.getAttribute('r') +
          ',' + el.getAttribute('x1') + ',' + el.getAttribute('y1') + ',' + el.getAttribute('x2') + ',' + el.getAttribute('y2') +
          '|' + [...el.children].map((k) => k.tagName + k.getAttribute('offset') + k.getAttribute('stop-color') +
            k.getAttribute('stop-opacity') + (k.getAttribute('d') || '')).join(',');
        const bekannt = nachName.get(el.id);
        if (bekannt === undefined) nachName.set(el.id, inhalt);
        else if (bekannt !== inhalt) nachName.set(el.id, null);
      }
      return JSON.stringify([...nachName].filter(([, inhalt]) => inhalt === null).map(([name]) => name));
    })()`)
  );
  pruefe(
    doppelte.length === 0,
    `keine Definition traegt denselben Namen bei anderem Inhalt${doppelte.length ? ` (${doppelte.join(', ')})` : ''}`
  );
  pruefe(
    (await js("document.querySelectorAll('.musterknopf').length")) === 8,
    'alle acht Muster stehen zur Wahl'
  );

  // --- Klicken ------------------------------------------------------------
  await js("[...document.querySelectorAll('.artfeld .wuerfel')][5].click(); true");
  await warte(300);
  pruefe((await js("[...document.querySelectorAll('.artfeld__zahl')][5].value")) === '1', 'Linksklick legt einen dazu');

  await js(`(() => { const w = [...document.querySelectorAll('.artfeld .wuerfel')][5];
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const abgewehrt = !w.dispatchEvent(e);
    window.__abgewehrt = abgewehrt; return true; })()`);
  await warte(300);
  pruefe((await js("[...document.querySelectorAll('.artfeld__zahl')][5].value")) === '', 'Rechtsklick nimmt einen weg');
  pruefe(await js('window.__abgewehrt'), 'und unterdrueckt dabei das Kontextmenue');

  // --- Abzugswuerfel ------------------------------------------------------
  await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
    setz(f[5], '3'); setz(f[0], '-2'); setz(document.querySelector('.feld input'), '5'); return true; })()`);
  await warte(400);
  const ausdruck = await js("document.querySelector('.buehne__ausdruck').textContent");
  pruefe(ausdruck === '3d20 - 2d4 + 5', `der Ausdruck stimmt (${ausdruck})`);

  // --- Eintippen ----------------------------------------------------------
  // Der Nutzer hat ausdruecklich verlangt, die Anzahl eintippen zu koennen,
  // „eine 3 oder aber auch eine -2". Beim Modifikator ging genau das nicht:
  // im Feld stand immer eine Zahl, nie nichts, und ein Zahlenfeld haelt ein
  // getipptes Minus nur fest, solange es leer ist. Aus „-" und „5" wurde die
  // Anzeige „05", also +5, und ueber die Pfeile herunterzuklicken war der
  // einzige Weg zu einem Abzug.
  await js("document.querySelector('.feld input').focus(); document.querySelector('.feld input').select(); true");
  await leereFeld();
  await tippe('-7');
  await warte(200);
  const mod = await js("document.querySelector('.feld input').value");
  pruefe(mod === '-7', `ein negativer Modifikator laesst sich eintippen (${JSON.stringify(mod)})`);

  // Und er ist begrenzt: ohne Grenze stand „999999999" im Ausdruck und in der
  // Summe, wo die Zahl jede Wuerfelzahl daneben unlesbar machte.
  await js("document.querySelector('.feld input').focus(); document.querySelector('.feld input').select(); true");
  await leereFeld();
  await tippe('999999999');
  await warte(200);
  const gross = await js("document.querySelector('.feld input').value");
  pruefe(gross === '9999', `ein riesiger Modifikator wird gekappt (${JSON.stringify(gross)})`);

  // Zurueck auf den Wert, den die folgenden Pruefungen erwarten.
  await js("document.querySelector('.feld input').focus(); document.querySelector('.feld input').select(); true");
  await leereFeld();
  await tippe('5');
  await warte(200);
  const zurueck = await js("document.querySelector('.buehne__ausdruck').textContent");
  pruefe(zurueck === '3d20 - 2d4 + 5', `der Ausdruck steht wieder (${zurueck})`);

  await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
  await warte(1400);
  pruefe(
    (await js("document.querySelectorAll('.wuerfel--abzug').length")) === 2,
    'Abzugswuerfel sind als solche zu sehen'
  );

  // Die Summe muss zu den abgebildeten Zahlen passen — sonst rechnet man sie
  // im Kopf nach und haelt das Werkzeug fuer kaputt.
  const rechnung = await js(`(() => {
    const zahlen = [...document.querySelectorAll('.buehne__tisch .wuerfel')].map((w) => ({
      wert: Number(w.querySelector('text').textContent),
      abzug: w.classList.contains('wuerfel--abzug')
    }));
    const summe = zahlen.reduce((s, z) => s + (z.abzug ? -z.wert : z.wert), 0) + 5;
    return JSON.stringify({ summe, gezeigt: Number(document.querySelector('.buehne__summe-zahl').textContent) });
  })()`);
  const { summe, gezeigt } = JSON.parse(rechnung);
  pruefe(summe === gezeigt, `die Summe passt zu den Wuerfeln (${summe} gegen ${gezeigt})`);

  pruefe(
    (await js("document.querySelectorAll('.verlauf__liste li').length")) === 1,
    'der Wurf steht im Verlauf'
  );

  // --- Die Anzahl bleibt stehen -------------------------------------------
  pruefe(
    (await js("[...document.querySelectorAll('.artfeld__zahl')][5].value")) === '3',
    'die Anzahl setzt sich nach dem Wurf NICHT zurueck'
  );

  // --- Drehung -----------------------------------------------------------
  // Zwei Dinge, die im Bild sofort auffielen und im Bildbaum gar nicht:
  //
  // Der Wuerfel wanderte beim Drehen seitwaerts. In den Keyframes stand
  // `rotate(...) translateY(...)`, und so wirkt die Verschiebung entlang der
  // schon gedrehten Achse — bei jedem Winkel in eine andere Richtung. Er
  // beschrieb eine Bahn um sich herum, statt an seinem Platz zu huepfen.
  //
  // Und das Minuszeichen des Abzugswuerfels kreiste mit, weil die Animation
  // auf dem ganzen Feld lag statt auf dem Koerper. Es ist eine Markierung und
  // gehoert an seinen Platz.
  const mitte = (was) =>
    js(`(() => { const e = document.querySelector('${was}');
      if (!e) return null; const r = e.getBoundingClientRect();
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })()`);

  await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
    f.forEach((x) => setz(x, '')); setz(f[5], '1'); setz(f[0], '-1'); return true; })()`);
  await warte(300);
  // Einmal durchwuerfeln, bevor gemessen wird. Sonst liegt beim ersten Mal
  // noch das Ergebnis des vorigen Wurfs auf dem Tisch, mit anderer Anzahl —
  // die Wuerfel stehen dann woanders, und der Vergleich misst das Layout
  // statt der Drehung. Genau daran ist diese Pruefung zuerst gescheitert.
  await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
  await warte(1000);
  const abzugRuhe = await mitte('.buehne__tisch .wuerfel--abzug .wuerfel__abzug');
  const koerperRuhe = await mitte('.buehne__tisch .wuerfel--abzug svg');

  await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
  await warte(200);
  const abzugDreht = await mitte('.buehne__tisch .wuerfel--abzug .wuerfel__abzug');
  const koerperDreht = await mitte('.buehne__tisch .wuerfel--abzug svg');
  await warte(700);

  pruefe(
    Boolean(abzugRuhe) && JSON.stringify(abzugRuhe) === JSON.stringify(abzugDreht),
    `das Minuszeichen dreht sich nicht mit (${JSON.stringify(abzugRuhe)} -> ${JSON.stringify(abzugDreht)})`
  );
  // Nur die Hoehe darf sich aendern: der Wuerfel huepft, er wandert nicht.
  pruefe(
    Boolean(koerperRuhe) && Math.abs(koerperRuhe[0] - koerperDreht[0]) <= 1,
    `der Wuerfel dreht sich an seinem Platz (x ${koerperRuhe?.[0]} -> ${koerperDreht?.[0]})`
  );

  // --- Effekte ------------------------------------------------------------
  // Solange wuerfeln, bis eine 20 und eine 1 dabei sind. Bei 20 Wuerfeln ist
  // beides in wenigen Versuchen da; bleibt es aus, ist der Test nicht rot,
  // sondern sagt es.
  await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
    f.forEach((x) => setz(x, '0')); setz(f[5], '20'); return true; })()`);
  let glitzer = 0;
  let streifen = 0;
  for (let versuch = 0; versuch < 20 && (glitzer === 0 || streifen === 0); versuch++) {
    await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
    await warte(1000);
    glitzer = Math.max(glitzer, await js("document.querySelectorAll('.glitzer').length"));
    streifen = Math.max(streifen, await js("document.querySelectorAll('.streifen').length"));
  }
  pruefe(glitzer > 0, `der Hoechstwurf glitzert (${glitzer} gesehen)`);
  pruefe(streifen > 0, `die Eins bekommt Streifen (${streifen} gesehen)`);

  // Abgeschaltet heisst abgeschaltet.
  await js("[...document.querySelectorAll('.aussehen__schalter input')][0].click(); true");
  await warte(200);
  await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
  await warte(1200);
  pruefe(
    (await js("document.querySelectorAll('.glitzer').length")) === 0,
    'abgeschalteter Glitzer bleibt aus'
  );
  await js("[...document.querySelectorAll('.aussehen__schalter input')][0].click(); true");

  // --- Koerperdarstellung (3D) --------------------------------------------
  /*
   * Was hier geprueft wird, koennen die Modultests nicht sehen: sie rechnen
   * den Wurf, aber sie zeichnen ihn nicht. Ob die Leinwand ueberhaupt kommt,
   * ob der Schalter wirkt und ob die Zahlen auf den Koerpern zur Summe
   * passen, faellt nur an der laufenden Anwendung auf.
   *
   * Achtung bei den Konsolenmeldungen: ohne Grafikkarte meldet Chromium
   * „Automatic fallback to software WebGL has been deprecated". Das ist keine
   * Stoerung der Anwendung, sondern die Umgebung — die Meldung wird unten
   * ausgenommen, sonst faellt die Pruefung auf Konsolenfehler ueber sie.
   */
  const grafikDa = await js(
    "(() => { const c = document.createElement('canvas'); " +
      "return Boolean(c.getContext('webgl2') ?? c.getContext('webgl')); })()"
  );
  console.log(`  info Grafikbeschleunigung: ${grafikDa ? 'ja' : 'nein'}`);

  const schalter =
    "[...document.querySelectorAll('.aussehen__schalter')].find((l) => /3D/.test(l.textContent))";
  pruefe(await js(`Boolean(${schalter})`), 'der Schalter fuer die Koerper ist da');

  if (grafikDa) {
    await js(`${schalter}.querySelector('input').click(); true`);
    await warte(400);

    // Ein ueberschaubarer Wurf: drei Arten, sechs Wuerfel.
    await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
      f.forEach((x) => setz(x, '')); setz(f[5], '3'); setz(f[1], '2'); setz(f[3], '1');
      setz(document.querySelector('.feld input'), ''); return true; })()`);
    await warte(300);
    await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");

    // Auf das Signal der Buehne warten statt auf eine geratene Zeit: ohne
    // Grafikkarte laeuft die Anzeige mit rund 25 Bildern je Sekunde statt 60,
    // und eine feste Wartezeit war zuerst zu kurz.
    let messung = null;
    for (let versuch = 0; versuch < 60; versuch++) {
      await warte(500);
      messung = JSON.parse((await js('JSON.stringify(window.__wurf3d ?? null)')) ?? 'null');
      if (messung && messung.laeuft === false) break;
    }
    pruefe(Boolean(messung) && messung.laeuft === false, 'der Wurf kommt zum Ende');
    if (messung && messung.laeuft === false) {
      console.log(
        `  info Wurf: ${messung.schritte} Schritte, ${messung.bilder} Bilder, ` +
          `${messung.ms} ms, ${messung.proBild} Schritt(e) je Bild`
      );
      // Die Zahl der Bilder ist gedeckelt, die Millisekunden haengen an der
      // Grafik. Geprueft wird deshalb die Bilderzahl.
      pruefe(messung.bilder <= 170, `die Anzeige ist gedeckelt (${messung.bilder} Bilder)`);
    }

    pruefe(await js("Boolean(document.querySelector('.buehne3d canvas'))"), 'die Leinwand steht');
    pruefe(
      !(await js("Boolean(document.querySelector('.buehne__tisch'))")),
      'und die flachen Wuerfel sind weg'
    );

    // Die schaerfste Pruefung: die Zahlen, die die Anwendung nennt, muessen
    // zur Summe passen. Sie faellt um, sobald die Umnummerierung der Flaechen
    // oder das Ablesen der oberen Flaeche danebenliegt.
    const gezeigt = Number(await js("document.querySelector('.buehne__summe-zahl').textContent"));
    const abgelesen = (messung && messung.abgelesen) || [];
    const summeDerKoerper = abgelesen.reduce((a, b) => a + b, 0);
    pruefe(
      abgelesen.length === 6,
      `alle sechs Koerper liegen auf dem Tisch (${abgelesen.length})`
    );
    pruefe(
      summeDerKoerper === gezeigt,
      `die Zahlen auf den Koerpern ergeben die Summe (${abgelesen.join(' + ')} = ` +
        `${summeDerKoerper} gegen ${gezeigt})`
    );

    /*
     * Ueber jedem liegenden Koerper steht seine Augenzahl.
     *
     * Auf den Flaechen steht sie zwar auch, aber nur lesbar, wenn der
     * Blickwinkel stimmt — und die Kugeln fuer d100 und den eigenen Wuerfel
     * tragen ueberhaupt keine Beschriftung.
     */
    const marken = JSON.parse(
      await js(`JSON.stringify([...document.querySelectorAll('.marke3d__zahl')].map((m) => m.textContent))`)
    );
    pruefe(
      marken.length === abgelesen.length,
      `ueber jedem Wuerfel steht eine Zahl (${marken.length} Marken, ${abgelesen.length} Wuerfel)`
    );
    const ausMarken = marken
      .map((text) => Number(text.replace('\u2212', '-')))
      .reduce((a, b) => a + b, 0);
    pruefe(
      ausMarken === gezeigt,
      `die Zahlen ueber den Wuerfeln ergeben die Summe (${marken.join(', ')} = ${ausMarken} gegen ${gezeigt})`
    );

    /*
     * Ein neuer Wurf baut die Szene genau einmal auf.
     *
     * Zuerst gab es neben der Wuerfelliste eine Wurfnummer als zweiten
     * Ausloeser. Der Wurf steht aber erst nach der Anzeigeverzoegerung fest,
     * also lief die Szene zweimal — die Wuerfel fielen sichtbar zweimal.
     */
    await js('window.__aufbauten = 0; true');
    await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
    await warte(250);

    // Und die Marken des vorigen Wurfs sind sofort weg, nicht erst am Ende:
    // sonst schweben Zahlen ueber Wuerfeln, die schon wieder fliegen.
    pruefe(
      (await js("document.querySelectorAll('.marke3d').length")) === 0,
      'beim Rollen verschwinden die Marken des vorigen Wurfs sofort'
    );

    for (let versuch = 0; versuch < 60; versuch++) {
      await warte(500);
      const stand = JSON.parse((await js('JSON.stringify(window.__wurf3d ?? null)')) ?? 'null');
      if (stand && stand.laeuft === false) break;
    }
    await warte(600);
    const aufbauten = await js('window.__aufbauten');
    pruefe(aufbauten === 1, `die Szene wird je Wurf einmal aufgebaut (${aufbauten})`);

    /*
     * Die Leinwand folgt der Fenstergroesse.
     *
     * Ohne das behaelt sie ihre Punktzahl, und auf einem Bildschirm mit
     * anderer Aufloesung staucht das Bild die Wuerfel in die Breite.
     */
    fenster.setBounds({ x: 0, y: 0, width: 900, height: 640 });
    await warte(1200);
    const nachher = JSON.parse(
      await js(`(() => { const c = document.querySelector('.buehne3d canvas');
        const h = document.querySelector('.buehne3d');
        const cr = c.getBoundingClientRect(), hr = h.getBoundingClientRect();
        return JSON.stringify([Math.round(cr.width - hr.width), Math.round(cr.height - hr.height)]); })()`)
    );
    pruefe(
      Math.abs(nachher[0]) <= 2 && Math.abs(nachher[1]) <= 2,
      `die Leinwand folgt der Fenstergroesse (Abweichung ${nachher.join(' x ')})`
    );

    /*
     * Viele Wuerfel: die Zahlen muessen trotzdem kommen.
     *
     * Ab etwa fuenfzig Wuerfeln erschienen sie zeitweise gar nicht mehr. Der
     * Deckel der Anzeige begrenzt Bilder, nicht Sekunden, und wenn ein Bild
     * bei vielen Koerpern und schwacher Grafik lange braucht, laeuft die
     * Anzeige minutenlang. Der Zeitwaechter sass zuerst in der Bildschleife
     * und kam deshalb nie an die Reihe; jetzt haengt er an der Uhr.
     *
     * Diese Pruefung sichert das Ergebnis, nicht den Weg dorthin: ist die
     * Anzeige schnell genug, laeuft sie regulaer durch und die Notbremse
     * bleibt unbenutzt. Eine Gegenprobe mit abgeschalteter Notbremse blieb
     * deshalb gruen — der Fehler haengt an der Geschwindigkeit des Rechners,
     * und den Fall erzwingt der Test nicht.
     */
    await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
      f.forEach((x) => setz(x, '')); setz(f[5], '50'); return true; })()`);
    await warte(400);
    await js('window.__wurf3d = null; true');
    await js("document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); true");
    let vieleFertig = null;
    for (let versuch = 0; versuch < 40; versuch++) {
      await warte(500);
      vieleFertig = JSON.parse((await js('JSON.stringify(window.__wurf3d ?? null)')) ?? 'null');
      if (vieleFertig && vieleFertig.laeuft === false) break;
    }
    await warte(700);
    const vieleMarken = await js("document.querySelectorAll('.marke3d__zahl').length");
    pruefe(
      vieleMarken === 50,
      `auch bei fuenfzig Wuerfeln stehen alle Zahlen da (${vieleMarken})`
    );
    if (vieleFertig) console.log(`  info fuenfzig Wuerfel: ${vieleFertig.ms} ms`);

    // Zurueck auf flach: der Schalter muss in beide Richtungen wirken.
    await js(`${schalter}.querySelector('input').click(); true`);
    await warte(500);
    pruefe(
      await js("Boolean(document.querySelector('.buehne__tisch'))"),
      'ausgeschaltet kommen die flachen Wuerfel wieder'
    );
    pruefe(
      !(await js("Boolean(document.querySelector('.buehne3d'))")),
      'und die Leinwand ist weg'
    );
  } else {
    // Ohne Grafik faellt die Anwendung auf die flache Darstellung zurueck.
    // Das ist kein Randfall: Chromium hat den Rueckfall auf Software-WebGL
    // bereits als ueberholt gemeldet.
    await js(`${schalter}.querySelector('input').click(); true`);
    await warte(600);
    pruefe(
      await js("Boolean(document.querySelector('.buehne__tisch'))"),
      'ohne Grafikbeschleunigung bleibt es bei der flachen Darstellung'
    );
  }

  // --- Verlauf leeren -----------------------------------------------------
  const eintraege = await js("document.querySelectorAll('.verlauf__liste li').length");
  pruefe(eintraege > 0, `im Verlauf stehen Wuerfe (${eintraege})`);
  pruefe(await js("Boolean(document.querySelector('.verlauf__leeren'))"), 'der Knopf zum Leeren ist da');
  await js("document.querySelector('.verlauf__leeren').click(); true");
  await warte(400);
  pruefe(
    (await js("document.querySelectorAll('.verlauf__liste li').length")) === 0,
    'nach dem Leeren ist der Verlauf leer'
  );
  // Ohne Eintraege gibt es nichts zu leeren, also auch keinen Knopf.
  pruefe(
    !(await js("Boolean(document.querySelector('.verlauf__leeren'))")),
    'und der Knopf ist mit den Eintraegen verschwunden'
  );

  // --- Hundert Wuerfel ----------------------------------------------------
  // Der Nutzer nennt das einen Extremfall; realistisch sind rund zwanzig.
  // Gemessen wird trotzdem, damit die Zahl bekannt ist statt geschaetzt.
  await js(`(() => { ${SETZ} const f = [...document.querySelectorAll('.artfeld__zahl')];
    f.forEach((x) => setz(x, '0')); setz(f[5], '100'); return true; })()`);
  await warte(400);
  const gemessen = await js(`(() => new Promise((fertig) => {
    const knopf = document.querySelector('.auswahl__knoepfe .knopf--haupt');
    const bilder = [];
    let letzte = performance.now();
    let laeuft = true;
    function tick(jetzt) {
      bilder.push(jetzt - letzte);
      letzte = jetzt;
      if (laeuft) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    knopf.click();
    setTimeout(() => {
      laeuft = false;
      const sortiert = bilder.slice(1).sort((a, b) => a - b);
      fertig(JSON.stringify({
        anzahl: document.querySelectorAll('.buehne__tisch .wuerfel').length,
        p50: sortiert[Math.floor(sortiert.length * 0.5)],
        p95: sortiert[Math.floor(sortiert.length * 0.95)],
        max: sortiert[sortiert.length - 1]
      }));
    }, 1600);
  }))()`);
  const m = JSON.parse(gemessen);
  console.log(
    `  100 Wuerfel: ${m.anzahl} gezeichnet, Bildabstand p50 ${m.p50.toFixed(1)}ms, ` +
      `p95 ${m.p95.toFixed(1)}ms, max ${m.max.toFixed(1)}ms`
  );
  pruefe(m.anzahl === 100, 'alle hundert Wuerfel werden gezeichnet');
  // Die Grenze ist bewusst weit: hundert ist der Extremfall, und der darf
  // ruckeln. Was nicht passieren darf, ist Stillstand.
  pruefe(m.p95 < 120, `die Anwendung bleibt bedienbar (p95 ${m.p95.toFixed(1)}ms)`);

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' | ') || 'keine'})`);

  console.log(fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen.` : '\nWuerfel bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
