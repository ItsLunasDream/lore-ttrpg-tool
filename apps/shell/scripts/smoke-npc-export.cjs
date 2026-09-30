/**
 * Der ganze Weg vom Wuerfel bis zur Notiz.
 *
 * Kampagne bereitstellen, Figur wuerfeln, ein Feld von Hand aendern,
 * uebergeben — und dann nachsehen, ob die Notiz wirklich auf der Platte
 * liegt und ob das Symbol des Story Creators gewischt hat.
 *
 * Der andere Rauchtest (smoke-npc.cjs) sieht den NPC Creator allein und kann
 * den Export nur dabei beobachten, wie er sagt, dass es nicht geht. Erst
 * hier laufen beide Werkzeuge zusammen, und erst hier faellt auf, wenn die
 * Notiz im falschen Ort landet oder gar nicht ankommt.
 *
 * Aufruf: xvfb-run -a electron scripts/smoke-npc-export.cjs --no-sandbox
 */
const { app, BaseWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'npc-export-'));
app.setPath('userData', path.join(tmp, 'userData'));
require(path.join(__dirname, '..', 'dist', 'main', 'index.js'));
const warte=(ms)=>new Promise(r=>setTimeout(r,ms));
const fehler=[];
const pruefe=(b,t)=>{ console.log(`  ${b?'ok  ':'FEHL'} ${t}`); if(!b) fehler.push(t); };

app.whenReady().then(async()=>{
  await warte(4500);
  const f=BaseWindow.getAllWindows()[0];
  f.setBounds({x:0,y:0,width:1320,height:800}); await warte(800);
  const menue=f.contentView.children[0];
  const mjs=(a)=>menue.webContents.executeJavaScript(a);
  const sicht=(id)=>f.contentView.children.find(v=>v.webContents.getURL().includes(`/apps/${id}/`));

  // --- Backstory oeffnen und eine Kampagne anlegen -------------------------
  await mjs("[...document.querySelectorAll('.kachel:not(:disabled)')][0].click(); true");
  await warte(5000);
  const bs=sicht('backstory');
  pruefe(Boolean(bs),'der Story Creator kommt hoch');
  if(!bs){ app.exit(1); return; }
  const bjs=(a)=>bs.webContents.executeJavaScript(a);

  // Eine Kampagne muss es geben, sonst hat die Figur keinen Ort. Ob schon
  // eine da ist, entscheidet der Stand des Speicherorts — also erst nachsehen.
  const kampagnen = await bjs(`(async () => {
    // Die Bruecke des Story Creators verpackt jede Antwort in
    // { ok, value } — wer direkt auf .name zugreift, bekommt undefined.
    const auspacken = (antwort) => (antwort && 'value' in antwort ? antwort.value : antwort);
    const liste = auspacken(await window.api.campaigns.list()) ?? [];
    if (liste.length > 0) return liste.map((k) => k.name);
    const neu = auspacken(await window.api.campaigns.create('Testrunde'));
    return [neu.name]; })()`);
  pruefe(Array.isArray(kampagnen) && kampagnen.length > 0, `eine Kampagne steht bereit (${kampagnen})`);

  /*
   * Einmal neu laden.
   *
   * Die Kampagne ist eben erst ueber die Bruecke entstanden — der Backstory
   * Creator hat seine Liste aber beim Oeffnen geholt, als es noch keine gab,
   * und waehlt deshalb auch keine aus. Ohne dieses Neuladen pruefte der Test
   * unten gegen eine Oberflaeche ganz ohne Notizliste und faende auch dann
   * nichts, wenn alles stimmt.
   *
   * Nachgestellt wird damit die Lage, die eine Nutzerin wirklich hat: eine
   * Kampagne, die es beim Oeffnen schon gab.
   */
  bs.webContents.reload();
  await warte(4000);
  pruefe(
    (await bjs("Boolean(document.querySelector('.note-list'))")) === true,
    'nach dem Neuladen steht die Notizliste'
  );

  // --- Zum NPC Creator wechseln und eine Figur uebergeben ------------------
  await mjs("document.querySelector('.schiene__heim').click(); true"); await warte(900);
  const npcKachel = await mjs(`(() => { const k=[...document.querySelectorAll('.kachel:not(:disabled)')]
    .find(x => /NPC/.test(x.textContent)); if(!k) return false; k.click(); return true; })()`);
  pruefe(npcKachel===true,'die Kachel des NPC Creators ist da');
  await warte(4000);
  const npc=sicht('npc');
  pruefe(Boolean(npc),'der NPC Creator kommt hoch');
  if(!npc){ app.exit(1); return; }
  const njs=(a)=>npc.webContents.executeJavaScript(a);

  await njs(`[...document.querySelectorAll('button')].find(b=>/Neue Figur|New character/.test(b.textContent)).click(); true`);
  await warte(400);
  // Ein Feld von Hand aendern — das soll ja gehen.
  await njs(`(() => { const e=[...document.querySelectorAll('.zeile__wert')][4];
    const setz=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setz.call(e, 'will den Krug zurück, den der Bruder verkauft hat');
    e.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`);
  await warte(300);
  const name = await njs("document.querySelector('.figur__name').textContent");
  const bearbeitet = await njs("[...document.querySelectorAll('.zeile__wert')][4].value");
  pruefe(bearbeitet.includes('Krug'), 'ein Feld laesst sich von Hand aendern');
  pruefe(
    await njs("[...document.querySelectorAll('.zeile')][4].classList.contains('zeile--fest')"),
    'und wird dabei von selbst festgehalten'
  );

  await njs(`[...document.querySelectorAll('button')].find(b=>/Story Creator/.test(b.textContent)).click(); true`);
  // Frueh nachsehen: die Markierung haelt nur 1,4 Sekunden, und ein Blick
  // danach zeigt nichts — das sagt aber nichts darueber, ob sie da war.
  await warte(500);
  const wischtFrueh = await mjs("document.querySelectorAll('.schiene__eintrag--gemeldet').length");
  await warte(1300);
  const stoerung = await njs("document.querySelector('.stoerung')?.textContent ?? ''");
  pruefe(stoerung==='', `der Export meldet keinen Fehler (${stoerung||'keiner'})`);
  const knopf = await njs(`[...document.querySelectorAll('button')].find(b=>/Story Creator|Angelegt|Created/.test(b.textContent)).textContent`);
  pruefe(/Angelegt|Created/.test(knopf), `der Knopf meldet Vollzug (${knopf})`);

  // --- Wischt das Symbol? --------------------------------------------------
  pruefe(wischtFrueh>0, `das Symbol des Story Creators wischt (${wischtFrueh})`);
  const spaeter = await mjs("document.querySelectorAll('.schiene__eintrag--gemeldet').length");
  pruefe(spaeter===0, `und hoert danach wieder auf (${spaeter})`);

  // --- Liegt die Notiz wirklich? ------------------------------------------
  const vault = path.join(tmp,'userData','backstory','vault');
  const dateien = [];
  const suche = (ordner) => { for (const e of fs.readdirSync(ordner,{withFileTypes:true})) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) suche(p); else if (e.name.endsWith('.md')) dateien.push(p); } };
  try { suche(vault); } catch(e) { console.log('  (kein Vault:', e.message, ')'); }
  const treffer = dateien.map(p=>fs.readFileSync(p,'utf8')).filter(t=>t.includes('Krug'));
  pruefe(treffer.length===1, `die Notiz liegt auf der Platte (${dateien.length} Dateien, ${treffer.length} mit dem eigenen Satz)`);
  if (treffer[0]) console.log('\n--- Die Notiz ---\n' + treffer[0].slice(0,600));
  pruefe(/species: \S/.test(treffer[0] ?? ''), 'die Spezies steht im Steckbrieffeld');

  // --- Nochmal senden: kein Duplikat, dafuer „aktualisieren" ---------------
  await njs(`[...document.querySelectorAll('button')].find(b=>/Angelegt|Created/.test(b.textContent)).click(); true`);
  await warte(900);
  pruefe(
    await njs("Boolean(document.querySelector('[data-aktualisieren]'))"),
    'ein zweites Senden bietet Aktualisieren an'
  );
  await njs("document.querySelector('[data-aktualisieren]').click(); true");
  await warte(900);
  const nachher = [];
  const suche2 = (ordner) => { for (const e of fs.readdirSync(ordner,{withFileTypes:true})) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) { if (e.name !== 'history') suche2(p); } else if (e.name.endsWith('.md')) nachher.push(p); } };
  suche2(path.join(vault, 'campaigns'));
  const mitKrug = nachher.map(p=>fs.readFileSync(p,'utf8')).filter(t=>t.includes('Krug'));
  pruefe(mitKrug.length===1, `Aktualisieren legt nichts doppelt an (${mitKrug.length})`);

  // --- Und sieht man sie auch? --------------------------------------------
  /*
   * Der eigentlich gemeldete Fehler: "es kommt die Animation, aber die Notiz
   * wird einfach nicht angelegt."
   *
   * Auf der Platte liegt sie, wie oben nachgewiesen. Nur sieht der Backstory
   * Creator sie nicht: er hat seine Liste beim Oeffnen geladen, und niemand
   * sagt ihm, dass hinter seinem Ruecken etwas dazugekommen ist. Beim
   * Zurueckwechseln wird die Ansicht bewusst NICHT neu geladen — das wuerfe
   * den Zustand weg.
   *
   * "Manchmal geht es" passt dazu: wer den Story Creator erst nach dem
   * Export zum ersten Mal oeffnet oder zwischendurch die Kampagne wechselt,
   * bekommt eine frische Liste.
   */
  await mjs("document.querySelector('.schiene__heim').click(); true");
  await warte(700);
  await mjs(`(() => { const k=[...document.querySelectorAll('.kachel:not(:disabled)')]
    .find(x => /Story Creator/.test(x.textContent)); if(!k) return false; k.click(); return true; })()`);
  await warte(2500);

  const inDerListe = await bjs(
    "[...document.querySelectorAll('.note-list__title')].map(e => e.textContent).join(' | ')"
  );
  pruefe(
    typeof inDerListe === 'string' && inDerListe.includes(name),
    `die Figur steht in der Liste des Story Creators (${name})`
  );
  console.log('  (Liste: ' + inDerListe + ')');

  console.log(fehler.length?`\n${fehler.length} fehlgeschlagen`:'\nExportlauf bestanden.');
  app.exit(fehler.length?1:0);
});
