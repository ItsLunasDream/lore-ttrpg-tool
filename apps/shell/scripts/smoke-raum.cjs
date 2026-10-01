/**
 * Rauchtest: der Raum im lokalen Netz (docs/austausch.md, Stufe 2).
 *
 * Die App eroeffnet den Raum ueber ihre Oberflaeche. Ein Gast, von Hand
 * gebaut aus dem Protokoll (eine JSON-Zeile je Nachricht), tritt ueber
 * 127.0.0.1 bei. Geprueft: Name, Passwort, Chat an alle, Direktnachricht,
 * ein Paket vom Gast, das in der App angenommen wird, eins von der App an
 * genau den Gast, und der Zaehler am Knopf bei geschlossenem Dialog.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-raum.cjs --no-sandbox
 * Mit BILD=<pfad.png> wird der Chat abgelichtet.
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { gast } = require('./raumgast.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raum-smoke-'));
const userData = path.join(tmp, 'userData');
const monsterOrdner = path.join(userData, 'monster', 'monster');
fs.mkdirSync(monsterOrdner, { recursive: true });
fs.writeFileSync(path.join(monsterOrdner, 'ork.md'), '---\nid: ork\nname: Ork\ncr: "1"\n---\n# Ork\n');
// Ein Gegenstand aus dem Magic Item Generator: auch er laesst sich teilen.
const gegenstandOrdner = path.join(userData, 'magicitems', 'gegenstaende');
fs.mkdirSync(gegenstandOrdner, { recursive: true });
fs.writeFileSync(
  path.join(gegenstandOrdner, 'klinge.md'),
  '---\nname: Klinge\nart: waffe\nseltenheit: rare\neinstimmung: nein\nwert: 4000\ngeaendert: 2026-01-01\n---\n## Wirkungen\n\n- Glaenzt.\n'
);
fs.writeFileSync(path.join(userData, 'einstellungen.json'), JSON.stringify({ language: 'en', einfuehrungGesehen: ['suite', 'dice'] }));
app.setPath('userData', userData);
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const fehler = [];
const pruefe = (b, t) => {
  console.log(`  ${b ? 'ok  ' : 'FEHL'} ${t}`);
  if (!b) fehler.push(t);
};
async function bis(bedingung, ms = 4000) {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) return false;
    await warte(50);
  }
  return true;
}


app.whenReady().then(async () => {
  await warte(4000);
  const fenster = BaseWindow.getAllWindows()[0];
  fenster.setBounds({ x: 0, y: 0, width: 1280, height: 900 });
  const huelle = fenster.contentView.children[0];
  const js = (a) => huelle.webContents.executeJavaScript(a);
  const setze = (sel, wert) =>
    js(`(() => { const el = document.querySelector(${JSON.stringify(sel)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(wert)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const konsole = [];
  huelle.webContents.on('console-message', (_e, l, t) => {
    if (l >= 2) konsole.push(t.slice(0, 160));
  });

  // --- Raum eroeffnen ueber die Oberflaeche --------------------------------
  await js(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-richtung="raum"]').click(); true`);
  await warte(500);
  // Aktualisieren: der Kreis dreht.
  await js(`document.querySelector('[data-raum-aktualisieren]').click(); true`);
  const anzeige = () => js("document.querySelector('[data-raum-anzeige]')?.dataset.raumAnzeige");
  await warte(150);
  pruefe((await anzeige()) === 'dreht', '„Aktualisieren" laesst den Kreis drehen');
  await warte(1100);
  pruefe((await anzeige()) === 'fertig', 'nach einer Sekunde steht ein Haken da');
  await warte(1100);
  pruefe((await anzeige()) === 'ruhe', 'und eine Sekunde spaeter nichts mehr');
  await setze('[data-tischname]', 'Spielleitung');
  await setze('[data-raumname]', 'Freitagsrunde');
  await setze('[data-raum-passwort]', 'pw');
  await warte(300);
  await js(`document.querySelector('[data-raum-eroeffnen]').click(); true`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-raum=\"drin\"]'))")), 'der Raum ist eroeffnet');
  const einstellungen = JSON.parse(fs.readFileSync(path.join(userData, 'einstellungen.json'), 'utf8'));
  pruefe(einstellungen.tischName === 'Spielleitung', 'der eigene Name steht in den Einstellungen');
  const { zustand } = await js('window.shell.raum.zustand()');
  pruefe(zustand.rolle === 'gastgeber' && zustand.port > 0, `die App ist Gastgeber (Port ${zustand.port})`);
  pruefe(zustand.ich.name === 'Spielleitung', 'unter dem eigenen Namen');
  pruefe(zustand.ich.sl === true, 'mit Haken „Ich leite" ist der Gastgeber SL');
  pruefe(
    await bis(async () => /SL|GM/.test(await js("document.querySelector('[data-person=\"Spielleitung\"]')?.textContent ?? ''"))),
    'und traegt die Marke SL'
  );
  const raumDateien = () => {
    try {
      return fs.readdirSync(path.join(userData, 'raeume')).filter((n) => n.endsWith('.json'));
    } catch {
      return [];
    }
  };
  pruefe(raumDateien().length === 1, 'der Raum ist gespeichert');
  pruefe(!fs.readFileSync(path.join(userData, 'raeume', raumDateien()[0]), 'utf8').includes('"pw"'), 'ohne Passwort');
  pruefe(fs.existsSync(path.join(userData, 'tischschluessel.json')), 'der Tischschluessel ist angelegt');
  pruefe(
    /Freitagsrunde/.test(await js("document.querySelector('[data-im-raum]')?.textContent ?? ''")),
    'links neben „Teilen" steht der gruene Raumknopf mit dem Raumnamen'
  );

  // --- Falsches und richtiges Passwort --------------------------------------
  const eve = gast(zustand.port, 'falsch', 'Eve');
  pruefe(await bis(() => eve.alle.some((n) => n.typ === 'abgelehnt' && n.grund === 'passwort')), 'ein falsches Passwort wird abgelehnt');
  const anna = gast(zustand.port, 'pw', 'Anna');
  pruefe(await bis(() => anna.ich !== null), 'mit dem richtigen kommt Anna herein');
  pruefe(
    await bis(async () => /Anna/.test(await js("document.querySelector('[data-personen]')?.textContent ?? ''"))),
    'und steht in der Liste der Personen'
  );
  pruefe(anna.verschluesselt, 'mit Passwort ist Annas Leitung verschluesselt');
  anna.schreibe({ typ: 'ping', n: 42 });
  pruefe(await bis(() => anna.alle.some((n) => n.typ === 'pong' && n.n === 42)), 'der Gastgeber beantwortet ein Ping sofort (fuer die Anzeige in ms)');
  pruefe(
    await bis(async () => /\(\d+ ms\)/.test(await js("document.querySelector('[data-person=\"Anna\"]')?.textContent ?? ''")), 6000),
    'der Gastgeber sieht Annas Ping in ms'
  );
  pruefe(
    (await js("document.querySelector('[data-raum-verschluesselt]')?.dataset.raumVerschluesselt")) === 'true',
    'die Marke zeigt „verschluesselt"'
  );

  // --- Chat -------------------------------------------------------------------
  anna.schreibe({ typ: 'chat', von: 'gefaelscht', an: null, text: 'Hallo Runde', zeit: '' });
  pruefe(
    await bis(async () => /Anna\s*Hallo Runde/.test(await js("document.querySelector('[data-chat]').textContent"))),
    'eine Nachricht an alle erscheint, unter Annas Namen (nicht dem gefaelschten)'
  );
  await js(`(() => { const s = document.querySelector('[data-chat-an]'); s.value = ${JSON.stringify(anna.ich.id)};
    s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await warte(200);
  await setze('[data-chat-text]', 'Nur fuer dich');
  await js(`document.querySelector('[data-chat-senden]').click(); true`);
  pruefe(
    await bis(() => anna.alle.some((n) => n.typ === 'chat' && n.text === 'Nur fuer dich' && n.an === anna.ich.id)),
    'eine Direktnachricht kommt bei Anna an'
  );
  pruefe(
    await bis(async () => Boolean(await js("document.querySelector('.raum__zeile.is-privat')"))),
    'und ist im Chat als privat markiert'
  );
  if (process.env.BILD) {
    const bild = await huelle.webContents.capturePage();
    fs.writeFileSync(process.env.BILD, bild.toPNG());
  }

  // --- Ein Paket von Anna, angenommen in der App -----------------------------
  const paket = [
    '# LORE',
    '',
    '<!-- ttrpg:paket {"version":1,"erstellt":""} -->',
    '',
    '<!-- ttrpg:eintrag {"werkzeug":"monster","kennung":"ghul","name":"Ghul","art":"Monster"} -->',
    '---',
    'id: ghul',
    'name: Ghul',
    '---',
    '# Ghul',
    '<!-- ttrpg:ende -->',
    ''
  ].join('\n');
  // Dialog zu: der Zaehler am Knopf soll anspringen.
  await js("document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
  await warte(500);
  await js(`document.querySelector('[data-im-raum]').click(); true`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-raum=\"drin\"]'))")), 'ein Klick auf den gruenen Knopf oeffnet den Raum');
  await js("document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
  await warte(500);
  anna.schreibe({ typ: 'paket', von: anna.ich.id, an: 'gastgeber', titel: '1: Ghul', paket, zeit: '' });
  pruefe(await bis(async () => Boolean(await js("document.querySelector('[data-ungelesen]')"))), 'bei geschlossenem Dialog zaehlt der Knopf mit');
  anna.schreibe({ typ: 'chat', von: anna.ich.id, an: null, text: 'Seid ihr da?', zeit: '' });
  pruefe(
    await bis(async () => (await js("document.querySelector('[data-ungelesen]')?.textContent")) === '2'),
    'Paket und Nachricht: der Knopf zeigt 2'
  );
  const pakete = (await js('window.shell.raum.zustand()')).pakete;
  pruefe(pakete.length === 1 && pakete[0].von === 'Anna', 'das Paket wartet in der App');
  // Dialog auf, Paket per Doppelklick ansehen.
  await js(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(800);
  pruefe(
    /Anna/.test(await js("document.querySelector('[data-chat-dateien]')?.closest('.raum__zeile')?.textContent ?? ''")) &&
      /Ghul/.test(await js("document.querySelector('[data-chat-dateien]')?.textContent ?? ''")),
    'im Chat steht, dass Anna den Ghul geteilt hat'
  );
  await js(`document.querySelector('[data-raumpaket]').closest('li').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-ankunft=\"0\"]'))")), 'Doppelklick auf das Paket zeigt seinen Inhalt');
  // Vorschau beim Darueberfahren.
  await js(`document.querySelector('[data-ankunft="0"]').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); true`);
  pruefe(
    await bis(async () => /Ghul/.test(await js("document.querySelector('[data-vorschau^=\"ankunft:\"]')?.textContent ?? ''"))),
    'darueberfahren zeigt eine Vorschau des angekommenen Eintrags'
  );
  await js(`document.querySelector('[data-ankunft="0"]').dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); true`);
  // Doppelklick: eigenes Fenster mit dem ganzen Text, von dort speichern.
  await js(`document.querySelector('[data-ankunft="0"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); true`);
  pruefe(
    await bis(async () => /Ghul/.test(await js("document.querySelector('[data-ankunft-text]')?.textContent ?? ''"))),
    'Doppelklick oeffnet ein Fenster mit dem ganzen Text'
  );
  if (process.env.BILD_FENSTER) {
    await warte(600);
    fs.writeFileSync(process.env.BILD_FENSTER, (await huelle.webContents.capturePage()).toPNG());
  }
  await js(`document.querySelector('[data-fenster-speichern]').click(); true`);
  pruefe(
    await bis(() => fs.existsSync(path.join(monsterOrdner, 'ghul.md'))),
    'aus dem Fenster gespeichert: der Ghul liegt im Monster Creator'
  );
  pruefe(await bis(async () => /✓/.test(await js("document.querySelector('[data-fenster-meldung]')?.textContent ?? ''"))), 'das Fenster meldet es');
  await js(`document.querySelector('[data-ankunftsfenster]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await warte(300);
  pruefe(
    (await js("Boolean(document.querySelector('[data-ankunftsfenster]'))")) === false && (await js("Boolean(document.querySelector('.dialog'))")),
    'Escape schliesst nur das Fenster, der Dialog bleibt'
  );

  // Mehr als fuenf Eintraege: fuenf Namen, dann eine Zahl; ein Klick zeigt alle.
  const viele = ['# LORE', '', '<!-- ttrpg:paket {"version":1,"erstellt":""} -->', ''];
  for (let i = 1; i <= 7; i += 1) {
    viele.push(`<!-- ttrpg:eintrag {"werkzeug":"monster","kennung":"m${i}","name":"Monster ${i}","art":"Monster"} -->`, '---', `id: m${i}`, `name: Monster ${i}`, '---', `# Monster ${i}`, '<!-- ttrpg:ende -->', '');
  }
  anna.schreibe({ typ: 'paket', von: anna.ich.id, an: 'gastgeber', titel: '7', paket: viele.join('\n'), zeit: '' });
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-chat-dateien=\"7\"]'))")), 'eine Chatzeile fuer sieben Eintraege');
  const zeile7 = await js("document.querySelector('[data-chat-dateien=\"7\"]').textContent");
  pruefe(/Monster 5/.test(zeile7) && !/Monster 6/.test(zeile7) && /2/.test(zeile7), `sie nennt fuenf und zaehlt den Rest (${zeile7.trim()})`);
  await js(`document.querySelector('[data-chat-dateien="7"]').click(); true`);
  pruefe(
    await bis(async () => (await js("document.querySelectorAll('[data-chat-alle-dateien] li').length")) === 7),
    'ein Klick zeigt alle sieben'
  );
  await js("document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true");
  await warte(500);

  // --- Ein Paket an genau Anna ---------------------------------------------
  const ben = gast(zustand.port, 'pw', 'Ben');
  await bis(() => ben.ich !== null);
  const gesendet = await js(`window.shell.raum.senden([{ werkzeug: 'monster', kennung: 'ork' }], ${JSON.stringify(anna.ich.id)})`);
  pruefe(gesendet.ok, 'die App schickt ein Monster in den Raum');
  pruefe(await bis(() => anna.alle.some((n) => n.typ === 'paket' && /# Ork/.test(n.paket))), 'Anna bekommt es');
  pruefe(
    (await js('window.shell.raum.zustand()')).zustand.chat.some((z) => z.eigene && z.dateien && z.dateien[0] === 'Ork'),
    'und im eigenen Chat steht, was man geteilt hat'
  );
  await warte(300);
  pruefe(!ben.alle.some((n) => n.typ === 'paket'), 'Ben nicht');

  // --- Weitere Apps: ein magischer Gegenstand -------------------------------
  const gegenstand = await js(`window.shell.raum.senden([{ werkzeug: 'magicitems', kennung: 'klinge' }], null)`);
  pruefe(gegenstand.ok && gegenstand.anzahl === 1, 'auch ein magischer Gegenstand geht in den Raum');
  pruefe(await bis(() => ben.alle.some((n) => n.typ === 'paket' && /Glaenzt/.test(n.paket))), 'und kommt an');

  // --- Wuerfe aus dem Wuerfel -------------------------------------------------
  await js(`document.querySelector('[data-app="dice"]').click(); true`);
  await warte(4500);
  const wuerfel = fenster.contentView.children.find((v) => v.webContents.getURL().includes('/apps/dice/'));
  const djs = (a) => wuerfel.webContents.executeJavaScript(a);
  await djs(`document.querySelector('[data-teilen-wurf="alle"]').click(); true`);
  await warte(300);
  await djs("[...document.querySelectorAll('.artfeld .wuerfel')][5].click(); true");
  await djs("[...document.querySelectorAll('button')].find(b => /^(Roll|Rollen)$/.test(b.textContent.trim())).click(); true");
  pruefe(
    await bis(() => anna.alle.some((n) => n.typ === 'chat' && /^🎲 /.test(n.text) && n.an === null), 6000),
    'ein Wurf geht an alle im Raum'
  );
  await djs(`document.querySelector('[data-teilen-wurf="dm"]').click(); true`);
  await warte(300);
  const vorher = anna.alle.length;
  await djs("[...document.querySelectorAll('button')].find(b => /^(Roll|Rollen)$/.test(b.textContent.trim())).click(); true");
  pruefe(
    await bis(async () => /host|leitest/i.test(await djs("document.querySelector('[data-teilen-meldung]')?.textContent ?? ''")), 6000),
    'als Gastgeber bleibt ein Wurf „nur an DM" hier'
  );
  pruefe(!anna.alle.slice(vorher).some((n) => n.typ === 'chat' && /^🎲 /.test(n.text)), 'und geht nicht hinaus');

  // --- Rollen: Anna per Rechtsklick zur SL machen ---------------------------
  await js(`document.querySelector('[data-app-zurueck], [data-start]')?.click(); true`);
  await js(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-richtung="raum"]')?.click(); true`);
  await warte(500);
  await js(`(() => { const el = document.querySelector('[data-person="Anna"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 })); return true; })()`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-sl-machen]'))")), 'Rechtsklick auf Anna bietet „Zur SL machen"');
  if (process.env.BILD_ROLLEN) fs.writeFileSync(process.env.BILD_ROLLEN, (await huelle.webContents.capturePage()).toPNG());
  await js(`document.querySelector('[data-sl-machen]').click(); true`);
  pruefe(
    await bis(() => anna.alle.some((n) => n.typ === 'personen' && n.personen.some((p) => p.name === 'Anna' && p.sl === true))),
    'Anna ist SL, und alle erfahren es'
  );
  const vorSl = anna.alle.length;
  await djs(`document.querySelector('[data-teilen-wurf="dm"]').click(); true`);
  await djs("[...document.querySelectorAll('button')].find(b => /^(Roll|Rollen)$/.test(b.textContent.trim())).click(); true");
  pruefe(
    await bis(() => anna.alle.slice(vorSl).some((n) => n.typ === 'chat' && /^🎲 /.test(n.text) && n.an === anna.ich.id), 6000),
    'ein Wurf „nur an SL" geht jetzt an Anna, die andere SL'
  );
  await js(`(() => { const el = document.querySelector('[data-person="Spielleitung"]');
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 })); return true; })()`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-sl-abgeben]'))")), 'bei sich selbst: „SL-Rolle abgeben"');
  await js(`document.querySelector('[data-sl-abgeben]').click(); true`);
  pruefe(
    await bis(async () => (await js('window.shell.raum.zustand()')).zustand.ich.sl !== true),
    'mit einer zweiten SL im Raum geht das'
  );

  // --- Raum schliessen -------------------------------------------------------
  await js('window.shell.raum.verlassen()');
  pruefe(await bis(() => anna.getrennt && ben.getrennt), 'der Raum ist zu, die Gaeste sind getrennt');
  pruefe((await js('window.shell.raum.zustand()')).zustand.rolle === 'aus', 'und die App ist wieder draussen');
  pruefe(await bis(async () => !(await js("Boolean(document.querySelector('[data-im-raum]'))"))), 'der gruene Raumknopf ist weg');
  pruefe(!anna.klartextNachAnmeldung && !ben.klartextNachAnmeldung, 'nach der Anmeldung kam nichts im Klartext');
  anna.zu();
  ben.zu();
  eve.zu();

  // --- Gespeicherter Raum: fortsetzen -----------------------------------------
  await js(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-richtung="raum"]')?.click(); true`);
  pruefe(
    await bis(async () => js("Boolean(document.querySelector('[data-gespeichert=\"Freitagsrunde\"]'))")),
    'unter „Meine Raeume" steht die Freitagsrunde'
  );
  await js(`document.querySelector('[data-fortsetzen="Freitagsrunde"]').click(); true`);
  await warte(300);
  if (process.env.BILD_RAEUME) fs.writeFileSync(process.env.BILD_RAEUME, (await huelle.webContents.capturePage()).toPNG());
  pruefe((await js("document.querySelector('[data-raumname]').value")) === 'Freitagsrunde', '„Fortsetzen" traegt den Namen ein');
  pruefe((await js("document.querySelector('[data-raum-passwort]').value")) === '', 'das Passwort muss neu eingegeben werden');
  pruefe(!(await js("Boolean(document.querySelector('[data-raum-sl]'))")), 'beim Fortsetzen entscheiden die gemerkten Rollen, kein Haken');
  await setze('[data-raum-passwort]', 'pw2');
  await js(`document.querySelector('[data-raum-eroeffnen]').click(); true`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-raum=\"drin\"]'))")), 'der Raum ist wieder offen');
  pruefe(
    (await js('window.shell.raum.zustand()')).zustand.ich.sl !== true,
    'und der Gastgeber ist, wie gemerkt, keine SL mehr'
  );
  pruefe(raumDateien().length === 1, 'es bleibt ein gespeicherter Raum, kein zweiter');
  await js('window.shell.raum.verlassen()');
  await warte(300);

  // --- Raum ueber das Internet: fester Port, Passwort noetig ------------------
  await js(`document.querySelector('[data-teilen-knopf]').click(); true`);
  await warte(800);
  await js(`document.querySelector('[data-richtung="raum"]').click(); true`);
  await warte(500);
  await js(`document.querySelector('[data-raum-internet]').click(); true`);
  await warte(200);
  await setze('[data-raum-port]', '47913');
  await setze('[data-raum-passwort]', '');
  await warte(200);
  pruefe(await js("document.querySelector('[data-raum-eroeffnen]').disabled"), 'ohne Passwort laesst sich kein Internetraum eroeffnen');
  await setze('[data-raum-passwort]', 'geheim');
  await warte(200);
  await js(`document.querySelector('[data-raum-eroeffnen]').click(); true`);
  pruefe(await bis(async () => js("Boolean(document.querySelector('[data-raum=\"drin\"]'))")), 'mit Passwort ist er offen');
  const netz = (await js('window.shell.raum.zustand()')).zustand;
  pruefe(netz.internet && netz.port === 47913 && netz.verschluesselt, `fester Port ${netz.port}, verschluesselt`);
  pruefe(await js("Boolean(document.querySelector('[data-raum-adresse=\"lan\"]'))"), 'die Adresse im lokalen Netz steht da');
  pruefe(/47913/.test(await js("document.querySelector('[data-raum-portfreigabe]')?.textContent ?? ''")), 'der Hinweis zur Portfreigabe nennt den Port');
  await js(`document.querySelector('[data-raum-einladung]').click(); true`);
  pruefe(
    await bis(() => /47913/.test(require('electron').clipboard.readText()) && !/geheim/.test(require('electron').clipboard.readText())),
    'die Einladung liegt in der Zwischenablage, mit Port, ohne Passwort'
  );
  if (process.env.BILD_NETZ) await warte(3000);
  if (process.env.BILD_NETZ) fs.writeFileSync(process.env.BILD_NETZ, (await huelle.webContents.capturePage()).toPNG());
  const hatV6 = Object.values(require('node:os').networkInterfaces()).flat().some((a) => a && a.address === '::1');
  if (hatV6) {
    const carla = gast(47913, 'geheim', 'Carla', '::1');
    pruefe(await bis(() => carla.ich !== null), 'ein Gast kommt ueber IPv6 (::1) herein');
    carla.zu();
  } else console.log('  (kein ::1 auf diesem Rechner, IPv6-Beitritt uebersprungen)');
  await js('window.shell.raum.verlassen()');

  pruefe(konsole.length === 0, `keine Konsolenfehler (${konsole.join(' / ') || 'keine'})`);
  console.log(fehler.length === 0 ? '\nRaum bestanden.' : `\n${fehler.length} Fehler.`);
  app.exit(fehler.length === 0 ? 0 : 1);
});
