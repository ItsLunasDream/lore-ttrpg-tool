# Backlog

Offene Punkte aus der Benutzung, erfasst am 25.08.2026. Die Nummern sind die aus
der Meldung und bleiben als Referenz stehen; sortiert ist nach Priorität, nicht
nach Nummer.

**Stand 26.08.2026, morgens:** Die Punkte 1 bis 8 sind erledigt, ebenso die
Phasen 5 (Asset-Import), 6 (Generatoren) und 8 (Filter) sowie ein Teil von
Phase 7. Dazu kamen Notizen mit Weg nach Foundry, Text auf einem Bogen und
88 neue Props. Alles steht unten unter „Erledigt" mit dem, was dabei gelernt
wurde.

**Stand 26.08.2026, mittags:** Phase 7 ist damit vollständig — der
Weltkarten-*Modus* steht (Höhen- und Biom-Pinsel, Regionen, Legende, Text auf
einem Bogen), und mit den geglätteten Biomkanten ist auch der letzte offene
Punkt daraus erledigt. Aus dem ursprünglichen Plan ist nichts mehr offen. Was
darüber hinaus denkbar wäre, steht unter „Ideen für später".

## Aus dem ursprünglichen Plan noch offen

Der Stand unten ist am 25.08.2026 gegen den Quellcode geprüft, nicht aus dem
Gedächtnis notiert.

### Phase 7 — Weltkarten-Modus (teilweise)

**Fertig:** der Weltkarten-Generator (Höhe und Feuchte aus fraktalem
Simplex-Noise, Biome nach Whittaker, Küstenlinien, Flüsse per Downhill-Tracing)
und die Kartensignaturen — Gebirge, Hügel, Waldstück, Ortschaft, Stadt, Sumpf,
Dünen, Kompassrose, Maßstabsleiste. Damit lässt sich eine Weltkarte erzeugen und
danach von Hand weiterbearbeiten.

**Der Editor-Modus ist da:** Rasterebenen mit Höhen-Pinsel (anheben, absenken,
glätten, einebnen), Biom-Pinsel mit zehn Biomen, Regionen mit gestrichelter
Grenze und Namen, eine Legende aus dem, was auf der Karte steht, und
Beschriftungen auf einem Bogen. Damit lässt sich eine Weltkarte von Hand malen
statt nur erzeugen.

**Die kantigen Biomkanten sind erledigt** — und dabei war der erste Anlauf
falsch: die Textur feiner abzutasten macht die Treppe *nicht* kleiner, wenn die
Farbe von der nächsten Stützstelle kommt. Die Stufe ist dann immer noch eine
Stützstelle breit, nur schärfer gezeichnet. Es brauchte beides: feiner abtasten
*und* an der Kante die vier umliegenden Stützstellen anteilig mischen
(`engine/heightLayer.ts`). Die Daten bleiben hart — eine Stützstelle gehört
weiter zu genau einem Biom —, gemischt wird erst beim Einfärben. Nebenbei wird
die Küstenlinie eine Linie statt eines breiten Streifens, weil die Höhe jetzt
*vor* der Farbentscheidung interpoliert wird und nicht die Grafikkarte hinterher
fertige Farben verrührt.

Die Küstenlinien-Mathematik ist bereits da und wird geteilt:
`model/generators/grid.ts` (`traceOutlines`) bedient Höhle, Insel und Weltkarte.

Wichtig: Universal VTT beschreibt nur Quadratraster. Für Weltkarten ist der
Bild-Export der Hauptweg, nicht der VTT-Export — `io/uvtt.ts` warnt bereits
entsprechend.

## Kleinere Lücken aus dem Plan

Alles hier war im ursprünglichen Plan versprochen und ist beim Bauen liegen
geblieben. Einzeln klein, in Summe spürbar. Erledigtes ist herausgenommen und
steht unten.

**Leistung**

- ~~Chunk-basiertes Culling messen~~ — **gemessen und entschärft.** Bei 20 000
  Props auf 150×150 lag die Frame-Zeit bei 6 ms, und die hineingezoomte Ansicht
  war keinen Deut schneller als die eingepasste: der Culling-Durchgang läuft
  über *alle* Objekte und kostete ungefähr so viel, wie er sparte. Er läuft
  jetzt nur noch, wenn Kamera oder Objektbestand sich geändert haben — 20 000
  Props kosten damit 2,5 ms statt 6 ms, 2 000 Props 0,3 ms statt 0,8 ms.
  Chunk-basiertes Culling bleibt damit vorerst unnötig; erst jenseits von etwa
  50 000 Props lohnt eine erneute Messung.
- ~~RenderTexture-Backing für abgeschlossene Zeichen-Layer~~ — **gemessen, nicht
  nötig.** 2000 Freihandstriche à 24 Punkte kosten 0,3 ms je Bild, 500 davon
  1,4 ms (der Unterschied ist das Culling: bei 2000 liegt der größere Teil
  außerhalb des Bildes). Beides ist weit unter dem Bildbudget von 16 ms. Erst
  wenn eine Zeichenebene spürbar bremst, lohnt der Aufwand — und dann sollte
  erneut gemessen werden, statt es jetzt auf Verdacht zu bauen.
- ~~Texture-Atlas für viele kleine importierte Assets~~ — **gemessen, nicht
  nötig.** Die Sorge war, dass jede eigene Textur den Batch bricht. Tut sie
  nicht: 3000 Sprites kosten mit acht eingebauten Props 0,40 ms je Bild, mit
  40 importierten Texturen 0,37 ms und mit 120 importierten 0,38 ms — kein
  Unterschied. Pixi bindet mehrere Texturen je Zeichenaufruf, und erst weit
  jenseits davon würde es teuer. Gemessen mit `gl.finish()` je Bild, sonst
  misst man nur, wie schnell die Befehle in die Warteschlange fallen.
- ~~Auswahlrahmen bei vielen Objekten~~ — **war das Schlimmste und ist weg.**
  „Alles auswählen" auf einer vollen Karte kostete 46 ms *je Bild* — der
  Editor lief danach mit 21 Bildern je Sekunde, solange die Auswahl stand.
  Zwei Ursachen, beide behoben: der Rahmen wurde in jedem Bild neu aufgebaut,
  obwohl sich nichts rührte, und je Objekt lief ein eigenes `stroke()`. Jetzt
  wird nur noch gezeichnet, wenn Auswahl, Zoom oder Dokument sich geändert
  haben, und alle Rechtecke gehen in einen Zug. 46 ms → 2,6 ms, also so
  teuer wie ganz ohne Auswahl.
- ~~Bild-Export beschleunigen~~ — **gemessen und zum Teil gehoben.** Eine
  150×150-Karte mit 20 000 Props bei 100 px je Feld (225 MP) brauchte 16,5 s.
  Die Messung je Abschnitt zeigte, wo es liegt: Rendern 0,2 s, Texturen
  anlegen 0,004 s — und Rücklesen von der Grafikkarte 13,7 s plus `drawImage`
  4,3 s. Die naheliegende Idee, die Kachel-Texturen wiederzuverwenden, hätte
  also *nichts* gebracht. Was geholfen hat: `extract.pixels()` statt
  `extract.canvas()` und `putImageData` statt `drawImage` — das spart das
  Zwischen-Canvas je Kachel und eine von zwei Kopien. 16,5 s → 14,1 s, bei
  14 MP 2,1 s → 0,7 s. Geprüft, dass dabei dasselbe Bild herauskommt: bei
  einem Export über sechs Kacheln wich kein einziges von 96 Millionen Bytes ab.

  Was bleibt, ist das Rücklesen selbst, und das ist keine Ungeschicklichkeit
  mehr, sondern der Weg von der Grafikkarte in den Hauptspeicher. ~~Der nächste
  Schritt wäre darum kein Optimieren, sondern eine Fortschrittsanzeige.~~ —
  **gebaut**, siehe unten unter „Erledigt".

## Ideen für später

Auf Nachfrage gesammelt: was dem Editor noch fehlt, ohne dass es im
ursprünglichen Plan stand. Sortiert nach dem, was am meisten brächte — nicht
nach dem, was am schnellsten ginge. Jede Zeile nennt auch, woran sie hängt;
ein paar davon sind größer, als sie klingen.

### Was am meisten fehlt

Diese Liste ist am 31.08.2026 leergearbeitet worden. Was hier stand — Bausteine
und Ebenen-Vorlagen — ist gebaut; Karten-Vorlagen, Messwerkzeug und
Musterfüllung standen nur noch versehentlich hier und waren längst fertig.
Alles steht unten unter „Erledigt". Was als Nächstes am meisten brächte, steht
in den Abschnitten darunter.


### Generatoren

- ~~**Der Stadt-Generator streut, statt zu bauen.**~~ — **erledigt**
  (01.09.2026). Gemeldet waren „zwei Layouts, die immer fast gleich aussehen",
  gewünscht große Städte bis 300 Gebäude, kleiner skaliert, mit Straßen, die
  sich aus dem Ort ergeben; nachgereicht: „nicht nur parallele Straßen, Plätze
  auch außerhalb des Zentrums" und ein Rand von etwa einem Zehntel statt einem
  Viertel der Breite.
  Der alte Weg legte je Form ein festes Straßennetz an und würfelte die Häuser
  dazwischen — Position raten, wegwerfen, was auf einer Straße oder einem
  Nachbarn liegt. Ersetzt durch `model/generators/cityPlan.ts`: die Ortsfläche
  wird von *Geraden* geteilt, dazwischen bleibt die Straße; die Richtung folgt
  meist der langen Achse des Blocks, weicht aber jedes Mal ab und gelegentlich
  ganz. Häuser stehen als Reihen an den Blockkanten, ein Teil der Blöcke bleibt
  Platz. Die runde Stadt ist derselbe Apparat mit den ersten Schnitten durch die
  Mitte, das Flussdorf zwei Ufer, die vorher am geraden Flusslauf abgeschnitten
  wurden.
  Drei Dinge waren dabei die eigentliche Arbeit:
  1. **Die Hauszahl wird über den Maßstab getroffen, nicht über die Fläche.**
     Erst schrumpfte der Ort, bis die gewünschte Zahl hineinpasste — daher der
     breite Rand. Jetzt füllt der Ort immer die Karte, und Häuser, Gassen und
     Blockgrößen wachsen oder schrumpfen, bis die Zahl stimmt (binäre Suche über
     22 Maßstäbe, fünf Anläufe).
  2. **Keine Keile als Häuser.** Ein zu schmaler Block galt zunächst selbst als
     Gebäude; auf dem Plan lagen dann zwanzig Felder lange Dreiecke. Jetzt wird
     nur ein kleiner, gedrungener Block zum Haus, und Schnitte, die nur einen
     Splitter abtrennen, unterbleiben.
  3. **Fluss und Ufer teilten sich den Versatz nicht.** Der Schnitt kannte den
     zufälligen Versatz quer zum Lauf, die gezeichnete Mittellinie nicht — Ufer
     und Brücken lagen bis zu acht Felder *neben* dem Wasser. Sichtbar erst im
     Bild, in keinem Modelltest.
  Die Stadtmauer folgt seither dem Ortsumriss statt der Bildkante; die Tore
  sitzen dort, wo die Ausfallstraßen sie durchstoßen.

### Zeichnen und Gestalten

- **Boolesche Operationen** auf Flächen (vereinigen, abziehen, schneiden) —
  damit ließen sich Räume aus Rechtecken zusammensetzen statt nachzuzeichnen.
- ~~**Symmetrie- und Kachelmodus** beim Malen~~ — **erledigt** (03.09.2026).
  `model/symmetry.ts` macht aus einem gesetzten Objekt die Kopien, die
  Werkzeuge hängen sie an denselben Befehl — ein Rückgängig-Schritt. Drei
  Fallen dabei: die Drehung muss mitgespiegelt werden, bei zwei Achsen sind es
  *drei* Kopien (die vierte Ecke fehlt sonst), und Text wird nicht umgedreht.
  Die Achsen liegen in der Kartenmitte oder kommen aus den Hilfslinien.
- **Schlagschatten je Layer.** Die Filterkette kann es fast; es fehlt ein
  versetzt gezeichneter, weichgezeichneter Umriss.
- **Höhenlinien** als eigenes Zeichenwerkzeug, nicht nur als Generatorergebnis.

### VTT und Foundry

- ~~**Foundry-Scene-JSON** als zweiter Exportweg~~ — **verworfen** (01.09.2026,
  auf Ansage). Der Weg nach Foundry bleibt Universal VTT über das
  Importer-Modul, Notizen weiter über das Makro aus `io/foundryNotes.ts`.
- ~~**Töne und Stimmung**~~ — hing am Scene-JSON und fällt damit weg.
- ~~**Sichtsperren ohne Wand**~~ — **erledigt** (03.09.2026). `Wall.senses`
  führt Bewegung, Sicht, Licht und Schall einzeln; der UVTT-Export sortiert
  nach dem, was die Wand *tut*, und `io/foundryWalls.ts` trägt per Makro nach,
  was das Format nicht fassen kann.
- ~~**Roll20- und Owlbear-Rodeo-Eigenheiten** gegenlesen~~ — **erledigt**
  (03.09.2026), am Quelltext der Importer nachgelesen. Der teure Unterschied
  liegt nicht bei den Koordinaten, sondern bei den Farben: Foundry und Roll20
  lesen achtstellige Werte als AARRGGBB, Owlbear Rodeo als RRGGBBAA. Eine Datei
  kann nicht für beide stimmen — deshalb steht das Zielsystem im Export-Dialog.

### Weltkarten

- ~~**Beschriftung mit Anschluss an das Objekt**~~ — **erledigt** (03.09.2026).
  `TextObject.anchorId` verweist auf das Bezugsobjekt; gespeichert wird nur die
  Kennung, kein Abstand — sonst stünde der Ort zweimal da. Gewirkt wird nicht im
  Renderer, sondern dort, wo das Werkzeug die angefassten Objekte
  zusammenstellt.

### Bedienung

- ~~**Zuletzt geöffnete Karten** im Datei-Menü~~ — **erledigt** (03.09.2026).
  Wiederöffnen geht nur über das Handle der File System Access API; das
  überlebt nur IndexedDB. Wo es die API nicht gibt, bleibt die Liste leer und
  der Abschnitt erscheint gar nicht.
- ~~**Frei belegbare Tastenkürzel**~~ — **erledigt** (03.09.2026). Statt einer
  Kette von Abfragen eine Tabelle: benannte Handlung, normierte Kombination.
  Die Schreibweise entsteht an genau einer Stelle, sonst wären `ctrl+shift+z`
  und `shift+ctrl+z` zwei Belegungen für denselben Handgriff.
- ~~**Palette durchsuchen über Tags in beiden Sprachen**~~ — **erledigt**
  (03.09.2026) über eine Übersetzungstabelle in `assets/propTags.ts`; die Tags
  an gut zweihundert Props zu verdoppeln hätte zwei Listen ergeben, die
  auseinanderlaufen.
- **Minikarte** für große Karten; bei 150×150 Feldern ist Navigieren mühsam.
- ~~**Lineale und Hilfslinien** am Rand~~ — **erledigt** (03.09.2026). Die
  Lineale liegen als DOM-Canvas über der Bühne, nicht darin: sie stehen am Rand
  des Fensters, wandern nicht mit und gehen in keinen Export. Die Linien selbst
  stehen im Dokument und fangen beim Verschieben stärker als das Raster.
- ~~**Dunkles und helles Thema**~~ — **verworfen** (01.09.2026, auf Ansage).
  Die Oberfläche bleibt dunkel.

### Zusammenarbeit und Format

- ~~**Als Desktop-App verpacken** (Tauri, steht unten) — vor allem wegen des
  Dateizugriffs: Firefox und Safari können bis heute nicht überschreiben.~~ —
  **erledigt** (03.09.2026), siehe unten.
- ~~**Mehrere Karten in einer Datei** (Etagen eines Verlieses), mit Verweisen
  zwischen ihnen~~ — **erledigt** (02.10.2026). Reiter über der Bühne
  (`ui/KartenLeiste.tsx`): Klick öffnet, Doppelklick benennt um, „+ Karte"
  legt eine leere gleicher Größe an. Der Store hält alle Karten (`karten`),
  `doc` bleibt die offene — Werkzeuge und Renderer merken nichts davon. Jede
  Karte hat ihren eigenen Rückgängig-Verlauf; Wechseln ist keine Änderung an
  der Datei. Verweise stehen an der Notiz (`zielKarte` = `meta.id`), im
  Notiz-Dialog wählbar, mit Knopf „Zur Karte". In der `.ttmap` bleibt die
  erste Karte in `scene.json`, die übrigen liegen unter `maps/`; eine ältere
  Fassung des Editors öffnet so wenigstens die erste. Fassungen unter
  `versions/` enthalten alle Karten.
  Offen: Bild-, UVTT- und Foundry-Export nehmen nur die offene Karte; der
  Verweis geht nicht mit nach Foundry und ist am Pin nicht zu sehen.
- **Import aus Dungeondraft-Projektdateien**, nicht nur aus deren UVTT-Export.

## Danach denkbar

Stand am Ende des ursprünglichen Plans als „offene Punkte für später":

- ~~**Als Desktop-App verpacken** (Tauri) — der Web-Kern bliebe unverändert~~ —
  **erledigt** (03.09.2026), siehe unten.
- Roll20 und Owlbear Rodeo lesen beide Universal VTT und profitieren ohne
  Zusatzarbeit

## Neu aufgefallen

Beim Abarbeiten der Punkte oben entstanden:

- ~~Die Werkzeugleiste ist zu voll~~ — **erledigt.** Titel weg, Datei-Aktionen
  ins Klappmenü; von 1024 px Fensterbreite aufwärts passt alles. Weil die
  Symbolansicht damit zum Normalfall wird, tragen die Knöpfe jetzt ihr Kürzel
  in der Ecke und zeigen beim Überfahren den Namen. Wortabkürzungen *neben*
  dem Symbol gingen nicht: bei fünfzehn Werkzeugen kosten sie rund
  hundertachtzig Pixel, und bei 1400 sind nur sechsunddreißig übrig.

## Erledigt

**03.09.2026** — Eigene Prop-Gruppen:

- Auf Nachfrage: „Kann ich in der Prop-Palette eigene Gruppen anlegen?" — die
  zehn Kategorien (Stein, Pflanze, …) sind ein fester Typ, keine Benutzer­liste.
  Neu ist eine zweite, unabhängige Ordnung obendrauf: **selbst benannte
  Sammlungen**, in denen ein Prop — anders als bei der Kategorie — in
  beliebig vielen zugleich stecken darf.
- **`assets/propGroupStore.ts`**, nach demselben Muster wie Bausteine und
  Ebenen-Vorlagen (`createLocalLibrary`): lokal gespeichert, nicht in der
  Karte — wer sich „Taverne" zusammenstellt, will sie auf der nächsten Karte
  wiederhaben.
- **Zuordnungsmodus statt Rechtsklick oder Popover.** Ein Klick auf „+" bei
  einer Gruppe versetzt die ganze Palette in einen Modus, in dem ein
  Prop-Klick nur noch die Mitgliedschaft umschaltet — dabei bleiben alle
  Kategorie-Reiter bedienbar, man kann durch die ganze Bibliothek stöbern und
  einsammeln, statt nur die eine Kategorie zu sehen, in der man gerade steht.
  Ein eigener Bug dabei: eine frisch angelegte Gruppe sprang zuerst in ihre
  eigene (leere) Ansicht — dort ließ sich nichts anklicken, weil nichts drin
  war. Gefunden erst beim echten Durchklicken im Browser, nicht in den
  Modelltests: `activeGroupId` und `assignGroupId` mussten getrennt geführt
  werden, Zuordnen räumt die Gruppenansicht beiseite statt sie zu setzen.
- Gruppen erscheinen als zusätzliche, umbenennbare, löschbare Reiter neben
  den festen Kategorien, ★ und „Zuletzt".

**03.09.2026** — Desktop-App-Verpackung (Tauri):

- **`src-tauri/`** verpackt denselben Web-Kern als natives Fenster
  (Windows/macOS/Linux) — kein zweiter Anwendungscode. `npm run tauri:dev`
  und `npm run tauri:build` daneben in `package.json`.
- **Der eigentliche Grund war nie „eine App im Dock", sondern der
  Dateizugriff.** Firefox und Safari können bis heute nicht überschreiben
  (`io/saveTarget.ts`), aber Tauris eigenes WebView bringt die File System
  Access API ebenfalls nicht mit — ohne eigenen Zweig wäre der Desktop-Build
  also aufs Herunterladen zurückgefallen, obwohl er echten Dateizugriff *hat*.
  `saveTarget.ts` kennt jetzt drei Fälle statt zwei: File System Access API,
  Download-Rückfall, und die Tauri-Hülle über `@tauri-apps/plugin-dialog` +
  `@tauri-apps/plugin-fs`, per `isTauri()` erkannt. Die Plugin-Importe sind
  dynamisch und laufen nur unter Tauri wirklich; ein Browser-Build lädt sie
  nie aus.
- **„Zuletzt geöffnete Karten" bleibt unter Tauri vorerst leer** — die Liste
  hängt an `FileSystemFileHandle` (`io/recentFiles.ts`), das es dort nicht
  gibt. Genau das Verhalten, das Firefox und Safari heute schon zeigen; ein
  eigener Tauri-Speicher dafür ist ein eigener Schritt, kein blockierender.
- **App-Icon** aus einem kleinen, abhängigkeitsfreien PNG-Encoder erzeugt
  (keine Bildbibliothek zur Hand) und über `tauri icon` in alle Formate
  gewandelt — ein einfaches Faltkarten-Motiv, kein Anspruch auf Kunst.
- **Was sich in dieser Umgebung nicht zu Ende prüfen ließ:** `cargo
  build`/`tauri build` selbst. Es fehlen `libgtk-3-dev`/`libwebkit2gtk-4.1-dev`,
  und die Paketquellen sind von hier aus nicht erreichbar. `cargo check` kommt
  bis `gdk-sys` (rund fünfzig Pakete tief) und bricht dort ab, weil
  `gdk-3.0.pc` fehlt — das Cargo-Setup ist also so weit geprüft, wie es ohne
  die Systembibliotheken geht. Geprüft und grün: `tsc`, die volle
  Vitest-Suite (neu: `tests/saveTargetTauri.test.ts`, mit Gegenprobe für die
  Dateiendungs-Prüfung), sowie `npm run build` und `npm run build:portable` —
  beide unverändert erfolgreich, mit einer echten Browser-Regressionsprüfung
  (Playwright gegen den Dev-Server), dass Speichern/Speichern-unter/Quicksave
  im normalen Chromium-Zweig exakt wie vorher funktionieren.

**03.09.2026** — Stadt/Dorf: Gebäude mit Zweck statt anonymer Rechtecke, plus Gazetteer-Liste:

- **Neue Datei `buildingKinds.ts`**, nach demselben Muster wie die
  Dungeon-Raumthemen: eine Art bringt ihre eigenen Möbel mit. Anders als bei
  Dungeon-Räumen gibt es aber keinen Korridor-Graphen, entlang dessen sich
  Nachbarschaft vergeben ließe — ein Ort ist eine Fläche gleichwertiger
  Grundstücke, kein Gang von Raum zu Raum. Vergeben wird deshalb von der
  größten Grundfläche zur kleinsten (ein Rathaus passt nicht in eine Kate),
  gewichtet gewürfelt, mit einer Obergrenze je Art, die mit der Ortsgröße
  wächst: Gasthaus und Kramladen dürfen sich wiederholen, Schmiede, Tempel,
  Rathaus und Mühle kommen je Ort höchstens einmal vor. Rund ein Sechstel der
  Häuser wird auf diese Weise besonders, der Rest bleibt gewöhnliches
  Wohnhaus.
- **Jedes Gebäude bekommt, was zu seiner Art passt:** Möbel im Inneren (`imPoly`
  statt geratener Rechteckgrenzen, denn ein gedrungener Block *wird* zum Haus
  und kann mehr als vier Ecken haben), dazu ein einzelnes größeres Requisit
  an der Tür — Amboss vor der Schmiede, Fass vor dem Gasthaus, Marktstand vor
  dem Kramladen. Gewöhnliche Wohnhäuser bekommen Bett, Tisch, Stuhl, Truhe,
  aber kein Türrequisit; vorher stand in *keinem* Haus überhaupt ein Möbel.
- **Gazetteer-Liste**: für jedes besondere Gebäude eine GM-only-Notiz (wie
  beim Dungeon-Raumschlüssel), nummeriert im Uhrzeigersinn um die Ortsmitte —
  ein Rundgang, nicht die zufällige Entstehungsreihenfolge der Grundstücke.
  Gewöhnliche Wohnhäuser bekommen keine Notiz; eine Liste mit sechzig
  gleichlautenden „Wohnhaus"-Einträgen wäre kein Gazetteer, sondern Lärm.
- Kein neuer Schalter im Dialog: das Ganze hängt am vorhandenen
  `decorate` — demselben Hauptschalter, der bei Plätzen und Straßen schon
  entscheidet, ob überhaupt etwas hineinkommt.
- `GenLocationNote` (vormals `GenRoomNote`) ist jetzt ein geteilter Typ für
  beide Generatoren — Position, unübersetzter Schlüssel, laufende Nummer,
  ohne dass „Room" im Namen etwas vorwegnimmt, was hier keine Räume sind.

**03.09.2026** — Dungeon: Raumschlüssel-Liste (Read-Aloud):

- **Jeder Raum bekommt eine nummerierte GM-Notiz mit seiner Raumart** — der
  klassische Kartenschlüssel aus gedruckten Abenteuern („1. Wachstube, 2.
  Küche, …"), hier aus den ohnehin schon vergebenen Raumthemen statt frei
  erfunden. Nummeriert wird in `verbunden`-Reihenfolge, also entlang des
  Korridor-Graphen ab dem Eingangsraum — das ist die Reihenfolge, in der eine
  Gruppe den Dungeon tatsächlich durchquert, nicht die zufällige
  Platzierungsreihenfolge der Räume.
- Neuer Schalter im Generator-Dialog (`gen.roomKey`, Standard an), nur
  sichtbar mit gesetztem Raumthema — ohne Thema gibt es keine Raumart zu
  benennen.
- **`GeneratedMap` bekommt ein `notes`-Feld** (`GenRoomNote[]`: Position,
  unübersetzter `nameKey`, laufende Nummer), zu jedem Generator einheitlich
  über `emptyResult()`. Der Dungeon-Generator kennt kein `t()` und liefert
  bewusst nur den Schlüssel; übersetzt wird erst in
  `buildGeneratorCommands`, im selben Moment, in dem auch sonst generierter
  Text mitgespeichert wird — genau wie bei Layernamen. Die Notizen landen als
  `MapNote` auf der VTT-Ebene (Icon „info", `playerVisible: false`) und damit
  nie im Bild-Export.
- Der eigentliche Grund, warum das nicht einfach an Ort und Stelle im
  Generator geschehen konnte: die Raumplatzierung (`platziereRaeume`) und die
  Korridor-Reihenfolge (`verbunden`/`zuordnung`) bestehen bereits als
  benannte, geordnete Zwischenschritte aus dem Türen-Fix — die Notizliste
  reiht sich da nur ein, statt eine eigene Reihenfolge zu erfinden.

**01.09.2026, nachts** — Maßstab, der mitrechnet:

- **Ein Knopf im Raster-Panel setzt eine beschriftete Leiste auf die Karte**,
  mit den Zahlen, die direkt darüber eingestellt sind. Das Messwerkzeug zog
  seine Angaben längst von dort; die gezeichnete Kartensignatur
  „Maßstabsleiste" dagegen ist Zierrat aus vier Feldern ohne Zahlen — sie
  bleibt daneben bestehen, manchmal ist genau das gewollt.
- **Die runde Zahl gewinnt, nicht die Wunschbreite.** Gerundet wird auf die
  nächste Zahl der Reihe 1–2–5 (`niceDistance`); die Breite ergibt sich daraus.
  Andersherum stünde „47,3 km" auf der Leiste, und das ist kein Maßstab.
  Gerundet wird zur *nächsten*, nicht abwärts: aus 47,3 würde sonst 20, und
  zwei Drittel der Leiste blieben leer.
- **Herauskommen gewöhnliche Objekte** — Rechtecke und Texte, gruppiert, wie
  bei der Legende. Kein eigener Objekttyp, keine Sonderbehandlung im Renderer;
  die Leiste lässt sich danach verschieben und umfärben. Und wie die Legende
  wird sie erzeugt statt laufend nachgeführt: wer die Zahlen von Hand ändert,
  soll sie nicht beim nächsten Rasterwechsel verlieren.
- **Am Bildschirm nachgesehen und zweimal nachgebessert:** die Höhe hing an der
  Feldgröße — eine Weltkarte hat dieselben 100-px-Felder wie eine Taverne, ist
  aber zwanzigmal so breit, und die Leiste war dort ein Strich mit unlesbaren
  Zahlen. Und die Schriftfarbe stand fest auf Dunkel, also unsichtbar auf einer
  nächtlichen Karte; sie richtet sich jetzt nach dem Kartenhintergrund
  (`isDark` in `model/color.ts`).

**01.09.2026, nachts** — Reiserouten mit Tagesmarken (Werkzeug „U"):

- **Klick für Klick wie eine Wand**, Rechtsklick oder Enter schließt ab. Danach
  sagt die Statuszeile, wofür man die Route zeichnet: „Route: 340 km, 9
  Tagesmärsche."
- **Die Marken sitzen auf der Bogenlänge, nicht auf den Stützpunkten.** Ein Weg
  aus drei langen Geraden bekommt genauso viele Marken wie dieselbe Strecke aus
  dreißig kurzen. Sie tragen die Wegrichtung, damit der Querstrich quer steht.
- **Der Tagesmarsch steht in der Distanzeinheit des Rasters**, nicht in Feldern:
  „40 km am Tag" ist die Angabe aus dem Regelwerk, und sie bleibt richtig, wenn
  jemand die Feldgröße ändert.
- **Die Route ist eine gewöhnliche Zeichnung** mit einem `route`-Feld — keine
  neue Objektart. Damit lässt sie sich mit dem Auswahl-Werkzeug an den
  Stützpunkten nachbessern, und die Marken wandern mit. Ältere Projektdateien
  laden unverändert weiter, das Feld ist optional.
- **Am Bildschirm nachgesehen, nicht im Quelltext beurteilt** — und dabei den
  Fehler gefunden: die Länge des Querstrichs hing an der Strichstärke. Auf einer
  eingepassten Weltkarte war das ein Haar und beim Herauszoomen gar nichts. Sie
  richtet sich jetzt nach dem Tagesmarsch (`markLength`), mit der Strichstärke
  als Untergrenze für Battlemaps.

**01.09.2026, nachts** — Radiergummi für Zeichnungen (Werkzeug „X"):

- **Geschnitten wird der Linienzug, nicht das Bild.** Ein Strich ist im Modell
  eine Punktfolge; der Radiergummi nimmt einen Kreis heraus und lässt die Reste
  stehen. Aus einem Zug können dabei mehrere werden — genau das macht ein
  naives „Punkte im Kreis wegwerfen" falsch: es zöge die Lücke zu und ließe
  eine Gerade quer durch das Radierte stehen.
- **Der Schnitt liegt auf dem Kreisrand**, nicht am nächsten Stützpunkt
  (Strecke-Kreis-Schnitt in `model/eraseStroke.ts`). Sonst hinge das Ergebnis
  davon ab, wie fein jemand gezeichnet hat.
- **Bei einem Ring gehören erster und letzter Rest zusammen.** Der Rundgang
  beginnt an einem willkürlichen Stützpunkt; liegt der nicht im Radierten,
  entstünden dort zwei Enden, die in Wahrheit eines sind — sichtbar als Naht
  mitten im übrig gebliebenen Bogen.
- **Rechteck, Ellipse und Flächen ohne Strich bleiben unangetastet.** Die ersten
  beiden stehen über zwei Ecken fest, die letzten blieben als offener Zug ohne
  Füllung unsichtbar zurück. Die Statuszeile sagt es, statt still nichts zu tun.
- **Ein Strich ist ein Rückgängig-Schritt** (`EraseStrokes` mit `mergeKey`).
  Dabei zwei Fehler gefunden, beide von den Tests:
  *Der Ausgangsstand wächst mit* — ein Strich wandert über die Karte und trifft
  unterwegs Züge, die er zu Beginn nicht kannte; ohne sie löschte das
  Rückgängig sie, statt sie wiederherzustellen. Und *was der Strich selbst
  hervorbringt, gehört nicht in den Ausgangsstand*, sonst blieben Bruchstücke
  einer längst wieder ganzen Linie stehen.
- **Der Weg zwischen zwei Zeigerereignissen wird abgelaufen**, in Schritten von
  einem halben Radius — wie beim Pinsel. Ohne das radierte das Werkzeug nur
  dort, wo der Zeiger *gemeldet* wurde, und bei schneller Bewegung blieb eine
  Inselkette stehen. Aufgefallen ist das der E2E-Prüfung, nicht dem Modelltest.
- Und eine Lehre aus der Fehlersuche: die Prüfung „nichts geändert" verglich
  nur die *Anzahl* der Punkte. Ein gekürztes Ende hat gleich viele — der
  Schnitt fiel unter den Tisch, und zwischen den Radierkreisen blieben
  Bruchstücke stehen.

**01.09.2026, abends** — End-to-End-Prüfung im Browser:

- **`e2e/` mit Playwright**, gestartet über `npm run test:e2e`; der Dev-Server
  läuft dabei von selbst mit. In der CI ein eigener Lauf, weil er einen Browser
  braucht und länger dauert als alles andere zusammen.
- **Warum es die geben musste:** drei Fehler dieser Sitzung hat keine
  Modellprüfung gesehen — der Werkzeugwechsel, der sich über den Store totlief;
  das Fenster-Werkzeug, das Türen umschaltete; die Wand aus zwei identischen
  Punkten beim Tippen ohne Zeigerbewegung. Alle drei zeigen sich erst, wenn
  jemand wirklich klickt.
- **Bedient wird über `window.T`**, nicht über Playwrights `mouse`: der Canvas
  hat keine anfassbaren Elemente, und die interessante Größe ist die
  Weltkoordinate. Neu daran ist `T.cmds` — die Befehlsschicht durchgereicht,
  damit die Prüfungen kein `import('/src/…')` aus der Seite brauchen. Genau
  das ist der bekannte Fehler mit dem zweiten Modul-Exemplar nach einem
  Hot-Reload.
- **Und die Lehre aus dem ersten Anlauf:** der Fenster-Test war grün und
  wertlos — der Klick saß außerhalb der Fangreichweite, also traf er die Tür
  gar nicht. Erst die Gegenprobe (Fehler wieder einbauen, zusehen, dass der
  Test fällt) hat das gezeigt. Sie gehört zu jedem neuen Test dazu und steht
  jetzt in `CLAUDE.md`.

**01.09.2026, Stabilität (2)** — ein verlorener Undo-Schritt:

- **Die History verwarf Befehle, die gar nicht verschmolzen sind.** Bei
  gleichem `mergeKey` rief sie `absorb` und ließ den neuen Befehl fallen — auch
  dann, wenn `absorb` ihn ablehnte, weil er eine andere Ebene, eine andere Art
  oder ein anderes Ziel meinte. Seine Wirkung stand dann im Dokument, aber kein
  Rückgängig kam mehr daran, und ein Wiederholen setzte die Reihenfolge falsch
  zusammen.
- **Erreichbar über das Filter-Panel:** die Regler benutzen einen festen
  Schlüssel je Regler (`fx-b` für Helligkeit), das *Ziel* wechselt aber
  zwischen Karte und Ebene. Zwei Züge kurz nacheinander auf verschiedene Ziele
  — und der zweite ließ sich nicht mehr zurücknehmen.
- **`absorb` meldet jetzt, ob es angenommen hat.** Lehnt es ab, bleibt der
  Befehl ein eigener Schritt. Alle zwölf Fassungen sind entsprechend
  umgestellt.
- **Gefunden hat es der Zufallslauf**, nachdem er um `PatchVttEnvironment`,
  `RenameMap` und `ReplaceVtt` erweitert wurde: der neue Würfelverlauf traf die
  Stelle bei Startwert 2718. `tests/historyMerge.test.ts` nennt den Fall jetzt
  beim Namen, statt ihn dem Zufall zu überlassen.

**01.09.2026, Stabilitätsdurchgang** — drei Fehler, alle über neue Tests
festgehalten:

- **Das Fenster-Werkzeug fasste Türen an.** Tür und Fenster sind dasselbe
  Werkzeug mit verschiedener Art, aber die Griffe auf *vorhandene* Elemente
  fragten immer nach Türen. In einer Hauswand mit beidem nebeneinander — dem
  Normalfall — schaltete der Versuch, ein Fenster zu setzen, die Tür auf; ein
  Rechtsklick löschte sie. Jedes Werkzeug fasst jetzt nur an, was es selbst
  setzt. Fenster bleiben über das Wandwerkzeug löschbar, sie sind Wände vom
  Typ `window`.
- **Gesperrte Ebenen schützten nur halb.** `canHoldObjects` — das Tor, durch
  das jedes platzierende Werkzeug geht — prüfte das Schloss nicht, während
  `defaultTargetLayer` und `isObjectEditable` es längst beachteten. Man konnte
  in eine gesperrte Ebene malen und die Objekte danach nicht mehr anfassen,
  weil dieselbe Ebene sie schützte; übrig blieb Unrat, der sich nur nach dem
  Entsperren entfernen ließ. Und eine Auswahl, die *vor* dem Sperren entstand,
  ließ sich weiter ziehen, drehen und mit Entf löschen. Beides gilt jetzt
  durchgängig, auch beim Einfügen und Duplizieren.
- **Eine Bibliothek verwarf ihren Eintrag, wenn der Speicher zumachte.** Im
  privaten Modus wirft `localStorage`; der gerade zusammengestellte Baustein
  war damit im selben Moment weg. Er bleibt jetzt für die Sitzung erhalten, und
  die Meldung sagt, dass er den Neustart nicht überlebt.

Dazu eine Testumgebung für Werkzeuge (`tests/toolContext.ts`): ein `ToolContext`
ist nur ein Objekt aus Zugriffen, mit einem Doppel dafür lassen sich Werkzeuge
ganz gewöhnlich prüfen. Zwei der drei Fehler oben hätte keine Modellprüfung
gesehen — sie stecken in der Bedienung, nicht in der Rechnung.

**01.09.2026** — Fassungen im `.ttmap`:

- **Die letzten drei Stände wandern mit ins Archiv** (`versions/`), und das
  Datei-Menü bietet sie zum Wiederherstellen an. Speichern überschreibt eine
  Projektdatei ohne Rückfrage — ein versehentlich gelöschter Layer plus Strg+S,
  und die Arbeit von Stunden ist weg.
- **Im Archiv, nicht daneben.** Eine Sicherungskopie neben der Datei bliebe beim
  Weitergeben oder Verschieben zurück; im ZIP wandert sie mit.
- **Drei und nicht dreißig:** jede Fassung ist ein vollständiges Dokument, und
  bei einer großen Karte wüchse die Datei sonst mit jedem Speichern spürbar.
  Drei decken den Fall ab, um den es geht — „ich habe eben etwas kaputtgemacht
  und schon zweimal gespeichert".
- **Vor dem Überschreiben wird die alte Datei gelesen**, denn danach gibt es
  ihren Stand nirgends mehr. Ausgepackt wird dabei nur `scene.json`,
  `manifest.json` und `versions/` — die Bilder eines großen Archivs zu
  entpacken, um sie sofort wegzuwerfen, wäre bei jedem Speichern eine
  Verschwendung. (Der Lesevorgang selbst bleibt: bei sehr großen Dateien mit
  häufigem Autospeichern wäre das der nächste Punkt zum Messen.)
- **„Speichern unter" fragt jetzt zuerst nach dem Ziel** und baut das Archiv
  danach: wer im Dialog abbricht, hat sonst auf ein Archiv gewartet, das
  niemand bekommt — und die gewählte Datei lässt sich erst danach nach ihrem
  bisherigen Stand fragen.
- Wiederhergestellt wird nur im Editor; geschrieben wird erst beim nächsten
  Speichern. Rückgängig hilft dabei nicht, die Fassung ersetzt das Dokument
  samt Verlauf — darum die Rückfrage.

**01.09.2026** — Fehlersuche: es ließ sich nichts mehr platzieren.

Gemeldet als „das Werkzeug ist kaputt, es wählt immer nur aus" — und genau so
war es: der Manager blieb auf `select` stehen, während die Werkzeugleiste das
gewählte Werkzeug anzeigte. Im Browser nachgestellt und gefunden:

- **Ursache war eine Schleife über den Store.** `ToolManager.setTool` räumte das
  alte Werkzeug ab, *bevor* es `activeId` umsetzte. `deactivate` darf aber den
  Store anfassen — und jede Store-Änderung ruft die Subscription, die `s.tool`
  mit `activeId` vergleicht. Die sah dort noch das alte Werkzeug, rief erneut
  `setTool`, und so weiter: `RangeError: Maximum call stack size exceeded`. Der
  Aufrufer war die Werkzeugleiste, der Fehler landete in der Konsole, und der
  Manager blieb stehen, wo er war. Sichtbar war nur die Wirkung.
- **Zwei Auslöser, ein Fehler.** Neu war das Auswahl-Werkzeug, das beim Wechsel
  die Pfadbearbeitung beendet — das schrieb bei *jedem* Wechsel und machte den
  Editor unbenutzbar. Älter und seltener: `MeasureTool.deactivate` setzt die
  Statusmeldung zurück. Dieselbe Falle, nur bis dahin kaum getroffen.
- **Behoben an der Wurzel:** erst umschalten, dann abräumen. Dazu ein Wächter,
  der einen Wiedereintritt während des Wechsels abweist, und Setter, die nicht
  mehr schreiben, wenn sich nichts ändert (`setEditingPathId`,
  `setStatusMessage`, `setZoom`) — ein `set()` ohne Änderung benachrichtigt
  trotzdem jeden Abnehmer.
- **`tests/toolManager.test.ts` hält das fest.** Der Renderer ist dort ein
  Doppel; geprüft wird das Umschalten über die Subscription, also genau der Weg,
  auf dem es krachte. Gegenprobe gemacht: mit der alten Reihenfolge schlägt der
  Test mit demselben `RangeError` fehl.

Beim Nachstellen im Browser fielen zwei weitere Dinge auf, beide behoben:

- **Tippen ohne Zeigerbewegung ergab Wände ohne Länge.** Zwischen zwei Klicks
  ohne `pointermove` — auf einem Tablett der Normalfall, denn ein Tippen schickt
  keines — blieb der mitlaufende Punkt auf dem vorigen liegen. Herauskam ein Zug
  aus zwei identischen Punkten: in Foundry nichts, das man anfassen kann, und in
  der Prüfung vor dem Export zwei freie Enden. Jetzt zieht der Klick den
  mitlaufenden Punkt selbst nach, und entartete Züge werden gar nicht erst
  angelegt (`hasExtent` in `model/geometry.ts`). Dasselbe galt fürs Polygon im
  Zeichenwerkzeug.

**31.08.2026, spät** — die beiden offenen Kleinigkeiten aus „Neu aufgefallen":

- **Der Dateidialog findet `.ttmap` wieder.** Er filterte über `application/zip`,
  und Chromium gruppiert nach MIME-Typ — unter „ZIP-Archiv" tauchte die Datei in
  manchen Fassungen gar nicht auf. Jetzt hat sie einen eigenen Typ
  (`application/x-ttmap`), und der Dialog filtert nach der Endung. Der Typ steht
  nur im Dialog: geschrieben wird weiter ein ZIP, und der Download-Blob trägt
  weiter `application/zip` — daran hängt, was das System mit der Datei anfängt.
- **Die Generator-Vorschau unterscheidet die Props längst** (`propArt` in
  `ui/GeneratorDialog.tsx`, nach Familie mit eigener Farbe, Größe und
  Deckkraft). Der Punkt stand nur noch versehentlich offen; gegen den Code
  geprüft und herausgenommen.

**31.08.2026, spät** — Wandzüge zusammenführen:

- **Ein Knopf im VTT-Panel** führt Züge zusammen, deren Enden aufeinanderliegen.
  Keine automatische Bereinigung beim Zeichnen: wer zwei Züge bewusst getrennt
  hält, soll das dürfen. Die Statuszeile sagt, aus wie vielen wie wenige wurden
  — der Karte sieht man es nicht an, sie sieht hinterher genauso aus.
- **Nur Enden, keine T-Stöße.** Dass ein Ende mitten auf einem anderen Zug
  liegt, ist ein T-Stoß; ihn zu verschmelzen hieße, den anderen Zug irgendwo
  aufzutrennen — das wäre eine andere Wand als die gezeichnete.
- **Verschiedene Wandarten bleiben getrennt.** Eine Mauer und eine Fensterreihe
  sehen in Foundry verschieden aus, auch wenn sie sich berühren.
- **Schließt sich eine Kette zum Ring, fällt der doppelte Punkt weg** und
  `closed` übernimmt seine Aufgabe. Ihn stehen zu lassen ergäbe eine Kante der
  Länge null — und genau dort entsteht sonst die Lücke, um die es geht.
- Toleranz ist 1,5 Weltpixel: Rundungsfehler beim Fangen sollen verziehen
  werden, ein sichtbarer Spalt nicht.

**31.08.2026, spät** — Pfad nachträglich bearbeiten:

- **Doppelklick auf eine Zeichnung öffnet ihre Stützpunkte.** Ziehen verschiebt,
  ein Klick auf eine Kante fügt einen Punkt ein, Alt+Klick entfernt einen; Esc
  oder ein Klick daneben beendet. Dieselbe Geste wie beim Text, aus demselben
  Grund: die Form ist da, wo man sie sieht, also erwartet man sie auch dort zu
  ändern — ein eigenes Werkzeug in der Leiste fände nur, wer danach sucht.
- **Die Reihenfolge der Treffer entscheidet.** Erst der vorhandene Punkt, dann
  die Kante: andersherum bekäme man neben jedem Punkt einen zweiten, weil dort
  immer auch eine Kante liegt.
- **Rechteck und Ellipse lassen ihre Ecken ziehen, aber nicht vermehren.** Sie
  sind über zwei gegenüberliegende Ecken beschrieben, nicht über einen Linienzug
  — ein Rechteck mit drei Punkten wäre nichts mehr. Ebenso hat jede Form eine
  Untergrenze: ein Dreieck ohne dritte Ecke ist keine Fläche, sondern ein
  unsichtbarer Strich. Statt still nichts zu tun, sagt die Statuszeile, warum.
- **Die Umrechnung steht an einer Stelle** (`model/pathEdit.ts`). `points` liegt
  lokal und dreht sich mit dem Objekt; die Griffe stehen in Weltkoordinaten.
  Verteilt über die Werkzeuge wäre die Drehung garantiert irgendwo vergessen
  worden.
- **Die Griffe zeichnet der Renderer**, nicht das Werkzeug: dort greift die
  vorhandene Regel, nur bei geänderter Auswahl, Zoom oder `rev` neu zu zeichnen.
  Dafür musste `editingPathId` in den Zustandsschlüssel — Ein- und Aussteigen
  ändert weder Auswahl noch `rev`. Runde Griffe statt der eckigen Skaliergriffe,
  und beides nie gleichzeitig: zwei Griffsätze auf demselben Objekt, von denen
  einer die Form ändert und einer die Punkte, wären nicht auseinanderzuhalten.

**31.08.2026, abends** — Fortschrittsanzeige beim Bild-Export:

- **Die Kachelschleife gibt jetzt zwischen den Kacheln ab.** Ein Export von
  15 000 × 15 000 px braucht 64 Kacheln und vierzehn Sekunden; ohne jede
  Rückmeldung sah das aus wie ein Absturz. Bild- und VTT-Dialog zeigen einen
  Balken und „Kachel n von m", beim Ebenen-Export zusätzlich, welche Ebene
  gerade läuft.
- **Ein Generator statt zweier Schleifen.** `renderTiles` kachelt und hält nach
  jeder Kachel an; der synchrone Weg zieht ihn in einem Zug leer, der asynchrone
  lässt dazwischen den Browser ans Bild. Zweimal geschrieben wäre die Schleife
  auseinandergelaufen — und in ihr steckt die teuer gemessene Erkenntnis über
  `extract.pixels`.
- **Abgegeben wird über einen MessageChannel, nicht über rAF oder setTimeout.**
  Beide haben in einem nicht sichtbaren Tab eine Falle: `requestAnimationFrame`
  feuert dort gar nicht — der Export bliebe für immer stehen —, und `setTimeout`
  ist auf eine Sekunde gedrosselt, was bei 64 Kacheln eine Minute Wartezeit
  obendrauf legte. Ein MessageChannel kennt beides nicht und lässt den Browser
  trotzdem zeichnen.
- Das `finally` im Generator läuft auch beim Abbruch — sonst bliebe die Bühne in
  der Export-Ansicht stehen und der Ticker aus.

**31.08.2026, nachmittags** — Ebenen-Vorlagen, der letzte Punkt aus „Was am
meisten fehlt":

- **Ebenen-Vorlagen.** Den Stapel einer Karte sichern und wiederverwenden:
  Namen, Verschachtelung, Sichtbarkeit, Deckkraft, Mischmodus. Objekte gehören
  nicht dazu — dafür gibt es Bausteine und Karten-Vorlagen.
- **Zwei Wege, weil es zwei Lagen gibt.** Auf einer *frischen* Karte
  („Neu mit …" im Datei-Menü) ersetzt die Vorlage die vier Standardebenen;
  sie stehen zu lassen hieße, genau die Aufräumarbeit zu hinterlassen, die die
  Vorlage abnehmen soll, und zu retten ist auf einer leeren Karte nichts. Auf
  einer Karte, an der schon gearbeitet wurde, werden die Ebenen *angehängt* und
  nichts angetastet — als ein Rückgängig-Schritt.
- **Verschachtelung steckt als Index in der Liste, nicht als Kennung.** Kennungen
  werden beim Anwenden neu vergeben; eine Vorlage mit alten Kennungen ließe sich
  kein zweites Mal auf dieselbe Karte anwenden.
- **Die Kinderlisten bleiben beim Bauen leer.** `AddLayer` trägt jedes Kind in
  seine Gruppe ein — sie vorher zu füllen ergäbe jedes Kind doppelt. Ein Test
  hält beide Wege fest, den über Befehle und den über das frische Dokument.
- **Systemebenen stehen in keiner Vorlage.** Grid und VTT haben feste Kennungen
  und können nicht zweimal vorkommen; mitgeführt würden sie beim Anwenden
  entweder die vorhandenen überschreiben oder als tote Kopie danebenliegen.
- Nebenbei: die localStorage-Mechanik der Bausteine steht jetzt einmal in
  `assets/localLibrary.ts` und wird von beiden Bibliotheken benutzt. Zweimal
  geschrieben wäre sie auseinandergelaufen — genau das war `VttKind` schon
  einmal.

**31.08.2026, mittags** — Bausteine, aus „Was am meisten fehlt":

- **Bausteine (Stempel aus mehreren Objekten).** Auswahl benennen und sichern,
  danach als ein Stück setzen — mit Vorschau am Zeiger und einem Rückgängig-
  Schritt je Klick. Werkzeug „S", Liste unter der Prop-Palette.
- **Sie gehören dem Benutzer, nicht der Karte.** Ein gesetzter Baustein ist
  danach ein Haufen gewöhnlicher Objekte und hängt an nichts mehr; das Dokument
  braucht die Vorlage nie wieder. Gespeichert wird deshalb im localStorage
  (`assets/stampStore.ts`) und nicht im `.ttmap` — sonst wäre die eigene
  Sitzecke mit genau einer weitergegebenen Karte mitgewandert. Der
  Speichervorgang meldet zurück, ob es geklappt hat: der Browserspeicher ist
  auf wenige Megabyte begrenzt, und wer dort still scheitert, merkt es erst
  beim nächsten Start.
- **Der Ankerpunkt ist die Mitte der Anordnung**, nicht das erste Objekt.
  Gesetzt wird unter dem Zeiger, und gemeint ist dabei die Mitte dessen, was
  man sieht.
- **Beim Rasterwechsel werden Props bewusst ausgelassen.** Sie skalieren schon
  beim Zeichnen mit der Tile-Größe (`tileScale`); sie beim Setzen noch einmal
  zu strecken machte sie doppelt so groß. Abstände, Zeichnungen und Schrift
  dagegen stehen in Weltpixeln und müssen mitwachsen, sonst zerfällt eine auf
  100er-Raster gebaute Sitzecke auf einer 70er-Karte. `scalePatch` aus dem
  Transform-Code erledigt das und musste nicht neu geschrieben werden.
- **Die Gruppenzugehörigkeit wird beim Setzen gelöst.** Eine automatische Gruppe
  wäre eine Vermutung: wer eine Sitzecke setzt, rückt die Stühle danach oft
  einzeln. Zusammenfassen geht mit dem Auswahl-Werkzeug jederzeit.
- Dabei aufgefallen: **die Vorschau am Zeiger beim Prop-Werkzeug stand noch als
  offener Punkt**, ist aber längst gebaut (`tools/prop.ts` führt das Prop mit
  Größe, Farbe und Deckkraft mit). Der Eintrag ist herausgenommen.

**31.08.2026** — Prüfung vor dem Export, aus „VTT und Foundry":

- **Optionale Bereinigung im UVTT-Dialog.** `checkConsistency` bleibt, was sie
  war: eine reine Warnliste über Bildmaß und Raster, die immer mitläuft. Daneben
  steht jetzt ein Haken, der die VTT-Ebene prüft und in einer Vorschau zeigt,
  was sich ändern würde — mit Anzahl und Fundstelle in Feldkoordinaten, bevor
  irgendetwas passiert. Er wirkt **nur auf die Exportdatei**: kein Command, kein
  Eintrag im Rückgängig-Verlauf, die Karte im Editor bleibt, wie sie ist.
- **Türen werden nie gelöscht.** Eine freistehende Tür ist ein Torbogen und
  völlig in Ordnung — `Portal.freestanding` sagt genau das aus. Gemeldet wird
  nur die Tür, die sich als angehängt ausgibt, deren Wand aber verschwunden ist;
  sie wird in der Export-Kopie auf freistehend gesetzt, nicht entfernt.
- **Maßgeblich ist die Türmitte, nicht ihre Enden.** Beim Ziehen wird die Tür
  auf die Wandrichtung projiziert und darf dabei über das Wandende hinausragen.
  Beide Enden zu verlangen meldete darum reihenweise völlig gesunde Türen.
- **Ein Licht außerhalb der Karte ist kein Fehler.** Eine Fackel neben dem Rand
  leuchtet auf die Karte. Geprüft wird deshalb der Lichtkreis gegen die Fläche
  (`circleIntersectsRect`, neu in `model/geometry.ts`) und nicht der Mittelpunkt
  gegen ein Rechteck. Nur wenn der Kreis die Fläche gar nicht berührt, fällt das
  Licht aus dem Export.
- **T-Stoß und Tür zählen als Anschluss.** Ein Wandende gilt als frei, wenn es
  kein anderes Wandsegment berührt — auch mittendrin, denn ein T-Stoß leckt
  nicht. Und wer die Wand für eine Tür auftrennt, hat dort in Foundry ein
  Türsegment, keine Lücke. Ohne beides meldete die Prüfung Löcher, wo keine
  sind. Verbunden wird trotzdem nichts automatisch: welche Enden zusammengehören,
  wäre geraten, und zwei zufällig benachbarte Wände zu verschmelzen ist
  schlimmer als die Lücke.
- **Zwei Toleranzen, nicht eine.** Tür auf Wand darf großzügig ausfallen (2 px,
  wegen Projektion und Rundung), Wandstoß nicht (0,5 px): eine Lücke von zwei
  Pixeln ist in Foundry genau die Leckstelle, die gemeldet gehört.
- **Unsichtbare Wände zählen nicht mit**, weil sie gar nicht exportiert werden —
  eine Tür an einer solchen Wand steht in der Datei tatsächlich frei.
- Dabei zwei Kleinigkeiten im Dialog gefunden: die Gegenprobe verglich die
  eingelesene Datei mit `doc.vtt` und hätte jedes weggelassene Licht als
  Abweichung gemeldet (sie vergleicht jetzt mit dem tatsächlich Exportierten),
  und die Memos hingen allein an `doc` — das wird mutiert, nie ersetzt, also
  fehlte `rev` in den Abhängigkeiten und die Warnliste blieb stehen.

**26.08.2026, nachts** — Messwerkzeug und Vorlagen, aus „Was am meisten fehlt":

- **Messwerkzeug** mit Maßstab. Beides gehörte zusammen: ohne Angabe, wie weit
  ein Feld ist, kann man Felder zählen, aber keine Meter nennen. Gemessen wird
  von Feldmitte zu Feldmitte — eine Rastermetrik zählt Felder, und zwei Punkte
  im selben Feld sind null Felder auseinander; Strg misst frei. Im Quadrat ist
  die Metrik wählbar (5e, 5-10-5, Lineal, nur gerade Wege), im Hex nicht, weil
  es dort keine Diagonale gibt.
- **Karten-Vorlagen**: Taverne, Wachhaus, Kate, Schrein, Waldlichtung,
  Wegkreuzung. Von Hand gesetzte Anordnungen mit Zufall nur in den
  Kleinigkeiten — ein ausgewürfelter Schankraum sieht aus wie ein Lager mit
  Stühlen. Sie stehen als eigener Eintrag im Erzeugen-Dialog, ganz oben: wer
  ihn öffnet, will meist etwas Fertiges.
- **Dabei ein Fehler gefunden, der alle Generatoren betraf.** Böden und Props
  bekamen ihre z-Werte getrennt und *vor* dem Einfügen. Reicht der Dialog
  zweimal dieselbe Ebene herein — der Normalfall —, überlappten die Bereiche,
  und die zuerst gesetzten Props lagen unter den Böden. Am Lagerfeuer der
  Waldlichtung war es zu sehen: die Feuerstelle verschwand ganz, übrig blieb
  der Lichtpunkt darüber. Es sah aus, als hätte der Generator sie vergessen.

**26.08.2026, abends** — Weltkarte, Props und drei gemeldete Kleinigkeiten:

- **Der Weltkarten-Generator** war „zu abrupt", die Formen „losgelöst", und
  Bäume standen im Wasser. Drei verschiedene Ursachen, keine davon dort, wo man
  sie vermutet:
  1. Jedes Biom bekam seinen *eigenen* Umriss und wurde für sich geglättet.
     Glättung zieht eine Kontur nach innen — zwischen zwei Nachbarn klaffte
     danach eine Lücke, und durch die schaute der Ozean. Jetzt enthält jede
     Lage alles ab diesem Biom aufwärts; was die Glättung wegnimmt, gibt die
     Nachbarfarbe frei.
  2. Der schnurgerade Schnitt quer über den Kontinent saß in `traceOutlines`:
     wo sich zwei Bereiche über Eck berühren, beginnen *zwei* Umrisskanten,
     und die Zuordnung Punkt → Kante kannte nur eine. Der Ring blieb offen und
     schloss sich beim Füllen als Sehne. Betrifft alle Generatoren, aufgefallen
     ist es nur hier.
  3. Bäume im Wasser entstanden **nicht** durch eine falsche Biomprüfung — die
     sagt für eine Küstenzelle völlig richtig „Wald". Nach dem Glätten lag die
     Zelle nur nicht mehr an Land. Maßgeblich ist jetzt der Abstand zum Wasser.
  Neu dazu: Siedlungen nach Küsten- und Flussnähe, Straßen als günstigster Weg
  über das Höhenfeld (Dijkstra, `generators/path.ts`), Brücke an jeder Querung.
- **Regionsnamen ließen sich „nicht bearbeiten".** Ließen sie sich doch — aber
  nur nach einem Wechsel aufs Textwerkzeug, und darauf kommt niemand. Jetzt
  öffnet ein Doppelklick sie, und die Texteinstellungen erscheinen auch bei
  ausgewähltem Text, mit einem Feld für den Inhalt. Dabei fiel auf, dass das
  Textwerkzeug den Originaltext während der Eingabe über einen *Befehl*
  ausblendete: ein Rückgängig landete zwischen „alter Text" und „sichtbar".
- **„Ordner wählen" beim Prop-Import** tat ohne `showDirectoryPicker` genau
  dasselbe wie „Dateien wählen" — es griff auf dasselbe Feld zurück. Der
  fehlende Zwischenweg ist ein Feld mit `webkitdirectory`, das jeder heutige
  Browser kennt.
- **Props:** 41 neue, Material für die alten (Maserung, Fugen, Nieten, Falten,
  Beine unter der Platte). Der neue `tests/propLibrary.test.ts` fand dabei
  einen Fehler, der niemandem aufgefallen war: die Textur wird genau auf
  `def.size` zugeschnitten, und beim Wurzelwerk lag mehr als die Hälfte der
  Zeichnung außerhalb. Ursache meist `rng.gaussian()` ohne Grenze. Außerdem
  hatten 75 Props gar keinen Wörterbuch-Schlüssel und standen darum auch im
  englischen Programm auf Deutsch.
- **Vorschaubilder der Palette entstehen erst beim Sichtbarwerden.** Beim Start
  waren es 165 zu je 1,8 ms, sichtbar sind ein Dutzend.

**26.08.2026, morgens** — Notizen, Text auf einem Bogen, Rechtsklick und Props:

- **Notizen / Journal Notes.** Pin auf der Karte, Titel und Text, acht Symbole,
  Größe, Farbe und „für Spieler sichtbar". Sie stehen bei den VTT-Daten und
  nicht bei den Objekten, weil sie dasselbe beschreiben wie Wände und Lichter:
  was das VTT bauen soll, nicht was auf dem Bild zu sehen ist. Darum landen sie
  auch nie im Bild-Export — ein Test prüft das.
  **Der Weg nach Foundry war die eigentliche Frage.** Universal VTT kennt keine
  Notizen, und der verbreitete Importer legt auch keine an (nachgelesen in
  dessen README und in der Formatbeschreibung). Deshalb zwei Wege statt eines
  halben: in der `.uvtt`-Datei stehen sie unter `notes` mit — unbekannte Felder
  überliest jeder Importer, und der eigene Reader holt sie zurück —, und für
  Foundry erzeugt `io/foundryNotes.ts` ein Makro, das Journaleintrag und Pin
  anlegt und verbindet. Über die Oberfläche ließe sich nur eines von beidem
  importieren.
  Die Notiztexte stehen als JSON-Literal im Makro, nicht als eingebauter Code;
  sonst könnte ein Notiztext den Skriptaufbau zerlegen. Ein Test schießt darauf.
- **Text entlang eines Bogens.** Ein Regler von -1 bis 1 statt eines frei
  gezeichneten Pfades — für einen Namen über einer Bucht ist ein Bogen das, was
  gebraucht wird. `model/textPath.ts` rechnet allgemein auf Pfaden, falls doch
  gezeichnete dazukommen. Pixi kann Text nicht an einem Pfad ausrichten; der
  Renderer setzt darum je Zeichen ein eigenes Text-Objekt.
- **Polygone mit Rechtsklick abschließen**, wie beim Wandwerkzeug. Enter bleibt.
- **88 neue Props.** 26 Weltkarten-Signaturen (Vulkan, Gletscher, See,
  Wasserfall, Oase, Totenwald, Burg, Turm, Ruine, Tempel, Bergwerk, Felder,
  Brücke, Lager, Höhleneingang, Steinkreis, Grabhügel, Schlachtfeld,
  Segelschiff, Seeungeheuer, Strudel, Leuchtturm, Hafen, schlichte Windrose,
  Schriftband, Grenzstein) und 49 Fantasy-Props, davon 18 Varianten vorhandener
  Gegenstände.
  Dabei gelernt: **eine Prop-Variante ist etwas anderes als der Zufall in
  `draw`.** Der ändert Farbe und Maserung, nicht aber den *Zustand* eines
  Dings — ein offenes Fass, ein zerbrochener Tisch, eine gebrochene Säule
  brauchen jeweils ein eigenes Prop.
  Und: **von oben gezeichnet sieht vieles anders aus als gedacht.** Acht Props
  mussten nach dem Gegenlesen im Browser neu gezeichnet werden — der Wasserfall
  las sich als Tisch mit Beinen, der Amboss als grauer Klotz, die Kristalle als
  Nadelbäume. Jedes neue Prop gehört einmal wirklich angesehen.
- **Weltkarte aus tektonischen Platten** als zweite Variante im Generator.
  Nicht als zweites Rauschen mit anderen Werten — das wäre dasselbe in anderer
  Frequenz gewesen —, sondern über Plattenmittelpunkte: die nähere Platte gibt
  die Grundhöhe, der Abstand zur *zweiten* sagt, wie nah die Naht ist. Daraus
  entstehen Gebirge entlang der Nähte statt zufällig verstreut.
- **Musterfüllung** für Flächen: Schraffur, Kreuzschraffur, Ziegel, Dielen,
  Platten, Punkte, Schuppen, mit Weite, Farbe, Stärke und Drehung. Das Muster
  liegt über der Farbe, nicht an ihrer Stelle — ein Ziegelboden ist eine
  Grundfarbe *mit* Fugen. Die Weite steht in Weltpixeln, sonst wären Ziegel in
  einem großen Raum größer als in einem kleinen.
- **Transform-Griffe für mehrere Objekte.** Gedreht und skaliert wird um den
  Mittelpunkt der gemeinsamen Hülle; die Objekte wandern dabei mit, sonst
  behielte die Gruppe ihre Form nicht.
  Die offene Frage aus dem Backlog hat eine Antwort bekommen:
  **ungleichmäßiges Skalieren geht nur bei ungedrehten Gruppen.** Eine gedrehte
  Fläche in x zu strecken hieße, sie zu *scheren*, und Scherung kann das Modell
  nicht ausdrücken — ein Prop hat scaleX und scaleY in seinem eigenen
  Bezugssystem, keine Matrix. Statt still etwas Falsches zu rechnen, fällt der
  Fall auf gleichmäßiges Skalieren zurück.
- **Phase 7 — Rasterebenen, Höhen- und Biom-Pinsel.** Ein Layer kann statt
  Objekten ein Höhenfeld tragen; daraus wird eine Textur mit Farbrampe und
  Hangschattierung. Gelernt dabei:
  *Stützstellen statt Felder* — mit einem Wert je Kartenfeld sah jede Küste
  treppig aus.
  *Der Farbsprung an der Meereshöhe ist Absicht* — eine Küste ist eine Linie,
  kein Verlauf.
  *Das Höhenfeld hängt nicht am Layer-Objekt*, sondern liegt daneben: ein Layer
  wird überall herumgereicht, ein Array mit zehntausenden Zahlen daran machte
  jedes Kopieren teuer.
  *Gemalt wird auf einer Arbeitskopie* — der Befehl merkt sich beim ersten
  Ausführen die alten Werte, und die wären sonst schon verändert.
  Und gemessen: das ganze Feld neu einzufärben kostete auf 150×150 neun
  Millisekunden je Bild. Jetzt melden die Befehle ihren Zeilenbereich, der
  Renderer färbt nur diesen neu — 0,8 ms.
- **Eigene Schriftdatei importieren.** TTF, OTF und WOFF; geladene Schriften
  stehen mit ★ in der Liste und wandern mit ins `.ttmap` — aber nur, wenn ein
  Text sie auch benutzt. Der Kopf von `io/project.ts` versprach Schriften im
  Archiv von Anfang an; gebaut war bisher nur der Bildteil.
- **Automatisches Speichern.** Sichert still in die zuletzt gewählte Datei,
  abschaltbar, Abstand von einer bis fünfzehn Minuten. Die Entscheidung *ob*
  steht im Modell und ist geprüft — sie hat vier Bedingungen, von denen drei
  leicht zu vergessen sind: ohne Dateiziel gar nicht (der Rückfall wäre ein
  Download, und alle paar Minuten eine neue Datei wäre schlimmer als nichts),
  nicht ohne Änderung, und nie mitten in einem Zug.
- Nebenbei: **`VttKind` war zweimal definiert**, in `commands.ts` und in
  `store.ts`. Die Kopie hinkte hinterher, sobald eine Art dazukam.
- **Zwei alte Fehler gefunden.** `migrate` in `io/project.ts` baut das Dokument
  Feld für Feld auf, und die **Filter über der ganzen Karte standen dort
  nicht** — sie gingen bei *jedem* Speichern verloren, ohne dass es auffiel.
  Die Höhenfelder wären es gleich mit geworden. Wer dem Dokument ein Feld
  hinzufügt, muss es dort eintragen; ein Test hält die Stelle jetzt fest.


**26.08.2026, nachts** — Phasen 5, 8, Teil von 7 und mehrere kleinere Lücken:

- **Phase 5 — Asset-Import.** Ordner oder Dateien wählen, Unterordner werden zu
  Kategorien, Datei- und Ordnernamen zu Suchbegriffen. Beim Speichern wandern
  nur die *benutzten* Bilder ins Archiv, beim Öffnen entstehen daraus wieder
  Props. Offen blieb der Texture-Atlas (siehe oben).
  Dabei kamen drei Fehler ans Licht, alle außerhalb des neuen Codes:
  `Assets.load` wählt den Parser nach Dateiendung und scheiterte an blob:-URLs,
  `viewKey` erkannte nachgeladene Texturen nicht, und beim Wiederherstellen
  bekam die Id ein zweites „imp_".
- **Phase 8 — Filter.** Farbgrading, Einfärben, Weichzeichnen, Korn, Vignette,
  je Layer oder über der ganzen Karte, dazu sechs Vorlagen. Beim Bild-Export
  wirken sie von selbst; für den VTT-Export gibt es einen Schalter, der
  zugleich `baked_lighting` setzt.
  Gelernt: die Deckkraft eines ColorMatrixFilters wirkt auf die *ganze* Matrix.
  Einfärbung gehört deshalb in einen eigenen Filter, sonst werden Helligkeit
  und Sättigung nur anteilig angewandt.
- **Phase 7, erster Teil** — Weltkarten-Generator und neun Kartensignaturen.
- **UVTT-Import übernimmt das Kartenbild** — es wird ein gewöhnliches
  importiertes Prop auf dem Boden-Layer, mit der Auflösung aus der Datei
  deckungsgleich auf dem Raster.
- **Jeden Layer als eigene Bilddatei** ausgeben, ohne Grid und Hintergrund.
- **Layer isolieren** (Solo-Ansicht) — als Ansichtszustand, nicht als
  Dokumentänderung; sonst läge jedes Umschalten im Undo-Verlauf.
- **Transform-Griffe** zum Drehen und Skalieren, für ein einzelnes Objekt.
- **Objekte ausrichten und verteilen**, gerechnet über die Hüllen.
- **Favoriten und „zuletzt benutzt"** in der Prop-Palette.
- **Strichart** (`Stroke.dash`) wird ausgewertet — nötig für den Ruinen-Wandstil
  und seither für alle Zeichnungen außer Ellipsen.
- **Werkzeugleiste kürzt sich**, wenn der Platz knapp wird.

**26.08.2026** — Punkt 6 und Phase 6:

- **6. Mehr Props und Platzierungsoptionen.** Der Katalog wächst von 37 auf 81.
  Neu sind Natur (Laub, Ranken, Heu, Schilf, Seerosen, umgefallener und
  entwurzelter Baum), Wasser und Küste (Wellen, Seetang, Muscheln, Koralle,
  Treibholz), Überreste (Schädel, Tierschädel, Skelett, Gefallener, Blutlache,
  Eier), Dungeon (Altar, Sarkophag, Grabstein, Statue, Zahnrad, Bärenfalle,
  Falltür, Leiter, Wendeltreppe, Grube, Spiegel), Beute (Münzen, Edelsteine,
  Schriftrolle, Bücher, Schlafsack, Waffen, Schild, Krüge) und Siedlung (Zaun,
  Brunnen, Zelt, Wegweiser, Pflaster, Handkarren).
  Die Drehung beim Setzen ist jetzt abschaltbar — beim Pinsel als Schalter über
  dem Bereichsregler, beim Prop-Werkzeug umgekehrt als zuschaltbare Option.
  **Nicht** prozedural gebaut wurden Häuser, Marktstände und Pferde: die
  Einschätzung im Plan stimmt, als Zeichenfunktion werden sie nicht überzeugend.
  Sie gehören in den Asset-Import (Phase 5).
- **Phase 6 — Generatoren.** Dungeon, Höhle, Wald, Stadt/Dorf und Insel, alle
  mit Seed, Vorschau und editierbarem Ergebnis. Gemeinsames Fundament ist ein
  Belegungsraster mit Umriss-Verfolgung (`model/generators/grid.ts`).
  Dabei gelernt: **Chaikin verdoppelt je Durchgang die Punktzahl.** Ohne
  anschließendes Douglas-Peucker käme ein Höhlenumriss auf mehrere hundert
  Stützpunkte — in Foundry ebenso viele Wandsegmente. Wer weitere geglättete
  Geometrie erzeugt, muss genauso ausdünnen.

**25.08.2026, abends** — die Punkte 1 bis 5, 7 und 8:

- **1. „Neu" passt die Kamera ein.** Das Einpassen sitzt jetzt im Renderer beim
  DocChange `all`; der kommt ausschließlich von `loadDocument`, nicht von
  Undo/Redo. Damit entfielen die Wiederholungen an den Aufrufstellen.
- **2. Auswahl greift auf die VTT-Ebene.** Auswahlfilter je Art, Anklicken,
  Gummiband, Verschieben, Löschen und Inspektor für Wände, Türen, Fenster und
  Lichter. Die VTT-Auswahl steht als eigenes Feld neben `selection` — VTT-Elemente
  sind keine Layer-Objekte, und gemischt müsste jede Auswertungsstelle sie erst
  wieder auseinandersortieren. `segmentIntersectsRect` (Liang-Barsky) im Modell,
  damit das Gummiband lange schräge Wandzüge richtig trifft.
- **3. Tür und Fenster sind getrennte Werkzeuge.** Die Art steckt im Werkzeug
  statt in einer Einstellung; Kürzel O und F.
- **4. Sicherheitsabfrage im VTT-Panel**, mit Anzahl im Text und eigener
  Einzahlform — das Wörterbuch kennt bewusst keine Pluralregeln.
- **5. Schnellspeichern.** „Speichern" überschreibt ohne Dialog die zuletzt
  gewählte Datei (Strg+S), „Speichern unter…" fragt (Strg+Umschalt+S). Öffnen
  läuft, wo möglich, ebenfalls über den Picker, sonst wäre die geöffnete Datei
  kein Ziel. Nach „Neu" wird das Ziel vergessen. Firefox und Safari laden weiter
  herunter.
- **7. Sichtbare Wandstücke** in fünf Stilen zu Wänden, Türen und Fenstern —
  als gestrichene Zeichnung, nicht als Prop: Props sind Texturen fester Größe
  und müssten für eine beliebig lange Wand gekachelt werden.
- **8. Raum-Werkzeug**: Rechteck aufziehen erzeugt geschlossenen Wandring und
  Boden zugleich, beides abschaltbar.
- **Strichmuster wirken** (`Stroke.dash`), siehe „Kleinere Lücken" — war für den
  Ruinen-Stil nötig und gilt jetzt für alle Zeichnungen außer Ellipsen.

Zwei Dinge, die dabei gelernt wurden und beim Weiterbauen wichtig sind:

- **`beginTransaction()` fasst *nicht* verschiedene Befehle zu einem Undo-Schritt
  zusammen** — es verschmilzt nur gleichartige über ihren `mergeKey`. Wo ein
  Vorgang Verschiedenes anfasst, gehört `CompositeCommand` verwendet
  (`src/model/commands.ts`). Ohne ihn nahm ein Rückgängig nur die Hälfte zurück.
- **Die `checkConsistency`-Tests hingen an der Umgebungssprache.** Wer Tests über
  übersetzte Texte schreibt, muss die Sprache im Test festlegen.

**Früher:**

- Rechtsklick beendet den Wandzug (statt nur zu löschen)
- Texteingabe saß beim Tippen zu weit links
- Türen und Fenster frei ziehbar, Wandfang abschaltbar
- Zeichnen-Panel wirkt auf die ausgewählte Form
- Hilfe-Dialog mit Steuerung, erreichbar über F1
- Oberfläche auf Deutsch und Englisch
