/**
 * Integration: alle vier Werkzeuge in einer Sitzung, mit Wechseln dazwischen.
 * Gesucht sind die typischen Probleme: doppelt angemeldete IPC-Kanaele,
 * geteilte Sitzungen, verlorener Zustand beim Wechsel, Einstellungen die
 * einander ueberschreiben.
 *
 * Die anderen Rauchtests sehen je ein Werkzeug allein. Dieser sieht sie
 * zusammen — und nur dort fallen doppelte Kanaele, gemeinsame Sitzungen und
 * verlorener Zustand auf.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-integration.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'integ-'));
app.setPath('userData', path.join(tmp, 'userData'));
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
const sag = (t) => console.log(t);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => { sag(`  ${b ? 'ok  ' : 'FEHL'} ${t}`); if (!b) fehler.push(t); };

// Nichts darf haengen: ein blockierter Renderer wuerde den Lauf sonst
// stillstehen lassen, ohne dass man den Grund saehe.
const mitFrist = (versprechen, was) =>
  Promise.race([
    // Auch eine Ablehnung muss ein Wert werden: eine unbehandelte Ablehnung
    // liess den Lauf frueher wortlos stehenbleiben, bis der Zeitwaechter kam.
    Promise.resolve(versprechen).catch((f) => `((Fehler in ${was}: ${String(f).slice(0, 120)}))`),
    warte(8000).then(() => `((keine Antwort: ${was}))`)
  ]);

// Ein Zeitwaechter, damit ein Haenger als Fehlschlag endet statt die CI
// blockieren zu lassen.
setTimeout(() => {
  sag('\nABBRUCH: Zeitwaechter nach 180s');
  app.exit(2);
}, 180000);

app.whenReady().then(async () => {
  await warte(5000);
  const f = BaseWindow.getAllWindows()[0];
  if (!f) { sag('kein Fenster'); app.exit(1); return; }
  f.setBounds({ x: 0, y: 0, width: 1320, height: 820 });
  await warte(1200);
  const menue = f.contentView.children[0];
  const mjs = (a) => mitFrist(menue.webContents.executeJavaScript(a), 'Huelle');
  const konsole = [];
  const gesehen = new WeakSet();
  const lausche = (wc, wo) => {
    if (gesehen.has(wc)) return;
    gesehen.add(wc);
    wc.on('console-message', (_e, l, t) => { if (l >= 2) konsole.push(`${wo}: ${t.slice(0, 140)}`); });
  };
  lausche(menue.webContents, 'huelle');

  const NAMEN = ['backstory', 'mapmaker', 'initiative', 'dice'];

  /**
   * Die Ansicht eines Werkzeugs ueber ihre Adresse suchen.
   *
   * Nicht `children[1]`: die Huelle laesst geoeffnete Werkzeuge haengen,
   * damit ihr Zustand den Wechsel ueberlebt. Sobald zwei offen sind, zeigt
   * children[1] auf irgendeines von beiden — der Test lief dann gegen die
   * falsche Anwendung, fand ihre Elemente nicht und blieb an der Ablehnung
   * haengen.
   */
  const ansichtVon = (id) =>
    f.contentView.children.find((v) => v.webContents.getURL().includes(`/apps/${id}/`)) ?? null;
  const oeffne = async (id, wartezeit = 4500) => {
    // Ueber `data-app`, nicht ueber die Position: die Kacheln sind nach
    // Rolle gruppiert, und diese Reihenfolge darf sich aendern, ohne dass
    // der Test danach das falsche Werkzeug oeffnet.
    const ok = await mjs(`(() => { const k = document.querySelector('.kachel[data-app="${id}"]:not(:disabled)');
      if (!k) return false; k.click(); return true; })()`);
    if (ok !== true) { sag(`  (Kachel ${id} nicht anklickbar: ${ok})`); return null; }
    await warte(wartezeit);
    const sicht = ansichtVon(id);
    if (sicht) lausche(sicht.webContents, id);
    return sicht;
  };
  const heim = async () => {
    await mjs("(() => { const k = document.querySelector('.schiene__heim'); if (k) k.click(); return true; })()");
    await warte(1000);
  };

  sag('== Reihum oeffnen ==');
  for (const id of NAMEN) {
    const s = await oeffne(id);
    const steht = s ? await mitFrist(s.webContents.executeJavaScript('document.body.innerText.length > 0'), id) : false;
    pruefe(steht === true, `${id} kommt hoch`);
    await heim();
  }

  sag('\n== Wuerfel: Zustand ueberlebt den Wechsel ==');
  let d = await oeffne('dice');
  if (!d) { sag('Wuerfel liess sich nicht oeffnen'); app.exit(1); return; }
  const djs = (a) => mitFrist(d.webContents.executeJavaScript(a), 'dice');
  const SETZ = `const setz=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};`;
  await djs(`(() => { ${SETZ} setz([...document.querySelectorAll('.artfeld__zahl')][5],'3');
    setz(document.querySelector('.aussehen__farbe input'),'#e0af68');
    [...document.querySelectorAll('.musterknopf')][2].click(); return true; })()`);
  await warte(500);
  // Der Hauptknopf, nicht die Klappe „Roll mode" (die trifft /Roll/ zuerst).
  await djs(`(() => { document.querySelector('.auswahl__knoepfe .knopf--haupt').click(); return true; })()`);
  await warte(1000);
  const vorher = await djs("document.querySelector('.buehne__ausdruck').textContent");

  await heim();
  const t = await oeffne('initiative');
  pruefe(Boolean(t), 'der Tracker kommt dazwischen hoch');
  await heim();
  d = await oeffne('dice', 1500);
  const nachher = await djs("document.querySelector('.buehne__ausdruck').textContent");
  const farbe = await djs("document.querySelector('.aussehen__farbe input').value");
  const verlauf = await djs("document.querySelectorAll('.verlauf__liste li').length");
  pruefe(nachher === vorher, `die Auswahl ueberlebt den Wechsel (${vorher} -> ${nachher})`);
  pruefe(farbe === '#e0af68', `die Farbe ueberlebt den Wechsel (${farbe})`);
  pruefe(verlauf >= 1, `der Verlauf ueberlebt den Wechsel (${verlauf})`);

  sag('\n== Verlauf innerhalb eines Werkzeugs ==');
  //
  // Zurueck soll nicht nur das Werkzeug treffen, sondern die Stelle darin.
  // Geprueft wird der Story Creator: zwei Notizen oeffnen, zurueck, und
  // die erste muss wieder dastehen.
  {
    await heim();
    const b = await oeffne('backstory', 5000);
    if (!b) {
      sag('  --   Verlauf uebersprungen: der Story Creator kam nicht hoch');
    } else {
      const bjs = (a) => mitFrist(b.webContents.executeJavaScript(a), 'backstory');

      /** Traegt einen Namen in den offenen Dialog ein und legt an. */
      const anlegen = async (name) => {
        await bjs(`(() => {
          const feld = document.querySelector('.modal input');
          if (!feld) return false;
          const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setzer.call(feld, ${JSON.stringify(name)});
          feld.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        })()`);
        await warte(250);
        await bjs(`(() => { [...document.querySelectorAll('.modal button')].find(x=>/Anlegen|Create/i.test(x.textContent)).click(); return true; })()`);
        await warte(1300);
      };

      const neuerCharakter = () =>
        bjs(`(() => { const k=[...document.querySelectorAll('button')].find(x=>/^\\+ (Charakter|Character)$/.test(x.textContent.trim())); if (!k) return false; k.click(); return true; })()`);

      await bjs(`(() => { const k=[...document.querySelectorAll('button')].find(x=>/Erste Kampagne|first campaign/i.test(x.textContent)); if (k) k.click(); return true; })()`);
      await warte(700);
      await anlegen('Probe');

      await neuerCharakter();
      await warte(500);
      await anlegen('Erste');
      await neuerCharakter();
      await warte(500);
      await anlegen('Zweite');

      const offen = () => bjs("document.querySelector('.note-editor__title')?.value ?? ''");
      const zweite = await offen();
      pruefe(zweite === 'Zweite', `die zuletzt angelegte Notiz ist offen (${zweite})`);

      // Alt und Pfeil links in der Huelle: der Verlauf muss zur ersten Notiz
      // zurueckgehen, ohne das Werkzeug zu wechseln.
      await mjs("(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true })); return true; })()");
      await warte(1500);
      const nachZurueck = await offen();
      pruefe(nachZurueck === 'Erste', `zurueck fuehrt zur vorigen Notiz (${nachZurueck})`);
      pruefe(Boolean(ansichtVon('backstory')), 'und bleibt dabei im selben Werkzeug');

      await mjs("(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true })); return true; })()");
      await warte(1500);
      const nachVor = await offen();
      pruefe(nachVor === 'Zweite', `vorwaerts fuehrt wieder zur spaeteren Notiz (${nachVor})`);
    }
  }

  sag('\n== Getrennte Ablagen ==');
  for (const u of ['dice', 'initiative', 'backstory']) {
    let inhalt; try { inhalt = fs.readdirSync(path.join(tmp, 'userData', u)).sort().join(','); } catch { inhalt = '(fehlt)'; }
    sag(`  ${u}/: ${inhalt}`);
  }
  const datei = path.join(tmp, 'userData', 'dice', 'einstellungen.json');
  const dEin = fs.existsSync(datei) ? JSON.parse(fs.readFileSync(datei, 'utf8')) : {};
  pruefe(dEin.farbe === '#e0af68', `der Wuerfel schreibt in seine eigene Datei (${dEin.farbe})`);

  sag('\n== Schnelles Hin und Her ==');
  for (let i = 0; i < 4; i++) {
    await heim();
    await mjs("(() => { const k=[...document.querySelectorAll('.kachel:not(:disabled)')]; k[3] && k[3].click(); return true; })()");
    await warte(220);
    await mjs("(() => { const k=document.querySelector('.schiene__heim'); if (k) k.click(); return true; })()");
    await warte(220);
    await mjs("(() => { const k=[...document.querySelectorAll('.kachel:not(:disabled)')]; k[2] && k[2].click(); return true; })()");
    await warte(220);
  }
  await warte(3500);
  const lebt = ansichtVon('initiative') ?? ansichtVon('dice');
  pruefe(Boolean(lebt), 'nach schnellem Wechseln steht noch ein Werkzeug');
  const stoerung = await mjs("Boolean(document.querySelector('.stoerung'))");
  pruefe(stoerung === false, `und keine Stoerungsflaeche (${stoerung})`);
  if (lebt) {
    const inhalt = await mitFrist(lebt.webContents.executeJavaScript('document.body.innerText.length > 0'), 'zuletzt');
    pruefe(inhalt === true, 'und es ist bedienbar');
  }

  sag('\nKonsolenfehler: ' + (konsole.length ? konsole.join(' | ') : 'keine'));
  pruefe(konsole.length === 0, 'keine Konsolenfehler');
  sag(fehler.length ? `\n${fehler.length} Pruefung(en) fehlgeschlagen:\n  - ${fehler.join('\n  - ')}` : '\nIntegration bestanden.');
  app.exit(fehler.length ? 1 : 0);
});
