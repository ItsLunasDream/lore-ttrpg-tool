# TTRPG Map Editor

Karteneditor für Pen-&-Paper-Rollenspiele: Battlemaps und Weltkarten zeichnen und als
Universal VTT exportieren — für Foundry, Roll20 und Owlbear Rodeo —, inklusive Wänden,
Türen und Lichtern. Kein offizielles Produkt dieser Anbieter, siehe README.md.

Offene Punkte und die Reihenfolge, in der sie angegangen werden: [BACKLOG.md](BACKLOG.md).

**Liegt seit Bauabschnitt 4 als `apps/mapmaker` im Workspace von
`dnd-suite`** (siehe die Wurzel-`KONVENTIONEN.md`). `npm install` läuft
deshalb an der Wurzel des Repositories, nicht hier — alle Befehle unten
funktionieren trotzdem unverändert aus diesem Ordner heraus, npm findet die
gemeinsam installierten Abhängigkeiten selbst.

## Befehle

```bash
npm run dev       # Dev-Server auf http://localhost:5173
npm test          # Vitest einmalig
npm run typecheck # tsc ohne Emit
npm run build     # Typecheck + Produktionsbuild
npm run build:portable  # alles in *eine* HTML-Datei (dist-portable/index.html)
npm run tauri:dev       # Desktop-Hülle im Entwicklungsmodus (braucht Rust + Systembibliotheken)
npm run tauri:build     # Desktop-Installer bauen
```

### Rollup läuft als WASM, nicht nativ

`package.json` bindet `rollup` per Alias auf **`@rollup/wasm-node`**. Das ist
Absicht und darf nicht „aufgeräumt" werden.

Seit dem Umzug in den `dnd-suite`-Workspace (Bauabschnitt 4) steht der
erzwingende Teil davon — der `overrides`-Eintrag — nicht mehr hier, sondern in
der `package.json` der Workspace-Wurzel: npm beachtet `overrides` nur dort,
siehe Konvention 8. Der Alias in den `devDependencies` unten bleibt trotzdem
stehen, als Dokumentation direkt neben der Abhängigkeit, die er betrifft.

Grund: Auf dem Entwicklungsrechner blockiert eine Windows-Application-Control-
Richtlinie das Laden von `rollup.win32-x64-msvc.node`
(`ERR_DLOPEN_FAILED`, „An Application Control policy has blocked this file"). Der
GNU-Build scheitert ebenfalls, ihm fehlen die MinGW-Laufzeit-DLLs. Rollup 4 hat
weder eine Umgebungsvariable noch einen automatischen Fallback — es lädt die
native Datei oder wirft. Die Fehlermeldung behauptet dabei einen npm-Bug bei
optionalen Abhängigkeiten; das führt in die Irre, die Datei ist vorhanden und
wird nur nicht geladen. Ohne den Alias startet nicht einmal der Dev-Server, weil
Vite Rollup schon beim Import zieht.

Der WASM-Build ist dieselbe Version vom selben Team, nur langsamer. Wer ihn
ersetzen will, muss vorher `node -e "require('rollup')"` auf dem Zielrechner
prüfen.

`build:portable` ist kein Nebenprodukt, sondern der Weg für Rechner, auf denen
sich nichts bauen lässt. Damit die Datei per Doppelklick über `file://` läuft, müssen
drei Dinge zusammenkommen (alle in `vite.config.ts` begründet): eingebettete
dynamische Importe, weil Pixi seine Renderer sonst nachlädt; eingebettete
Assets und CSS; und `__VITE_PRELOAD__` muss weg, sonst startet die Bühne nicht.
Beim Einsetzen in die HTML *nie* `String.replace` mit einem Ersatz-String
benutzen — minifizierter Code enthält `$&`, und das wird dort als Platzhalter
gedeutet.

Vor dem Abschluss einer Änderung: `npm run typecheck` **und** `npm test`.

### End-to-End im Browser

```bash
npx playwright install chromium   # einmalig
npm run test:e2e                  # startet den Dev-Server selbst
npm run test:e2e:ui               # zum Zusehen
```

`e2e/` prüft, was keine Modellprüfung sehen kann: dass ein Klick auf die Karte
wirklich etwas setzt. Drei Fehler haben das erzwungen — ein Werkzeugwechsel,
der sich über den Store totlief und danach jeden Klick zur Auswahl machte; ein
Fenster-Werkzeug, das Türen umschaltete; eine Wand aus zwei identischen
Punkten, weil ein Tippen kein `pointermove` schickt. Alle drei liefen an den
Modelltests vorbei.

Bedient wird über `window.T` (`src/devHarness.ts`), nicht über Playwrights
`mouse`: der Canvas hat keine anfassbaren Elemente, und die interessante Größe
ist die Weltkoordinate. Was ein Test aus der Seite heraus braucht, gehört an
`T` — `T.cmds` reicht die Befehlsschicht durch. Ein `import('/src/…')` aus der
Seite wäre der bekannte Fehler: Vite serviert nach einem Hot-Reload ein zweites
Exemplar.

Liegt bereits ein Chromium auf dem Rechner (Container, CI-Image), zeigt
`PLAYWRIGHT_CHROMIUM_PATH` darauf, statt Playwright eine eigene Fassung suchen
zu lassen.

**Ein Test, der den Fehler nicht fängt, ist keiner.** Bei jedem Fund lohnt die
Gegenprobe: den alten Stand kurz wiederherstellen und zusehen, dass der neue
Test fehlschlägt. Beim Fenster-Werkzeug lag der erste Anlauf daneben — der
Klick saß außerhalb der Fangreichweite, der Test war grün und wertlos.

### Desktop-Hülle (Tauri)

`src-tauri/` verpackt denselben Web-Kern als Desktop-App (Windows, macOS,
Linux) — kein zweiter Anwendungscode, nur ein natives Fenster darum.
Auslöser war der Dateizugriff: Firefox und Safari können bis heute nicht
überschreiben (`io/saveTarget.ts`), und Tauris eigenes WebView bringt die
File System Access API ebenfalls nicht mit — `window.showSaveFilePicker`
bleibt dort `undefined`, genau wie in Firefox. Ohne einen dritten Zweig wäre
der Desktop-Build also aufs Herunterladen zurückgefallen, obwohl er echten
Dateizugriff hat.

`io/saveTarget.ts` unterscheidet deshalb drei Fälle, nicht zwei: Browser mit
File System Access API (Chromium), Browser ohne (Download-Rückfall), und die
Tauri-Hülle (natives `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`,
per `isTauri()` aus `@tauri-apps/api/core` erkannt). Die drei Plugin-Importe
sind dynamisch (`await import(...)`) und laufen nur unter Tauri wirklich —
ein Browser-Build lädt sie nie aus, und im `build:portable`-Bündel liegen sie
zwar mit drin (dort werden dynamische Importe eingebettet, siehe oben), sind
aber totes Gewicht: `isTauri()` liefert dort immer `false`. Was unter Tauri
noch fehlt: „Zuletzt geöffnete Karten" (`io/recentFiles.ts`) kennt nur
`FileSystemFileHandle` und bleibt dort vorerst leer — wie heute schon in
Firefox und Safari.

**In dieser Entwicklungsumgebung lässt sich `cargo build`/`tauri build`
nicht bis zum Ende prüfen** — es fehlen `libgtk-3-dev`/`libwebkit2gtk-4.1-dev`,
und die Paketquellen sind von hier aus nicht erreichbar (mehrere `404` beim
Versuch, auch für einzelne Pakete). `cargo check` kommt bis `gdk-sys` (rund
fünfzig Pakete tief) und bricht dort ab, weil `gdk-3.0.pc` fehlt — das
Cargo-Setup selbst ist also so weit geprüft, wie es ohne diese
Systembibliotheken geht. Wer hier weiterbaut und eine echte Linux-Umgebung
zur Hand hat: `apt install libgtk-3-dev libwebkit2gtk-4.1-dev
libayatana-appindicator3-dev librsvg2-dev` (Debian/Ubuntu-Namen; siehe
offizielle Tauri-Dokumentation für andere Distributionen) vor dem ersten
`npm run tauri:dev`.

## Architektur

Strikte Trennung zwischen Modell und Rendering — sie ist die tragende Entscheidung
des Projekts, nicht bloß Ordnung:

- **`src/model/`** — reines, serialisierbares TypeScript. Kein Pixi, kein React.
  Dadurch sind Undo/Redo, Speichern und Tests unabhängig vom Rendering.
  - `types.ts` Datentypen, `document.ts` Erzeugung/Abfragen, `commands.ts` Undo/Redo,
    `store.ts` Zustand-Store, `grid.ts` Rastermathematik, `rng.ts` gesäter Zufall.
- **`src/engine/`** — Pixi-Renderer. *Spiegelt* das Dokument, besitzt es nicht.
- **`src/tools/`** — Werkzeuge hinter einem gemeinsamen Interface (`tools/types.ts`).
- **`src/assets/`** — Prop-Bibliothek: prozedurale Vektor-Props und importierte Bilder.
- **`src/ui/`** — React-Panels.
- **`tests/`** — Vitest über die Modellschicht.

### Regeln, die sich aus der Architektur ergeben

- **Das Dokument wird mutiert, nicht ersetzt.** Bei Karten bis 150×150 Tiles und
  zehntausenden Props wäre unveränderliches Kopieren pro Pinselpunkt zu teuer.
  Damit React trotzdem neu rendert, zählt `rev` im Store hoch.
- **Jede Änderung am Dokument läuft über einen Command** (`src/model/commands.ts`).
  Direktes Mutieren umgeht Undo/Redo und die Renderer-Benachrichtigung.
- **Commands melden, was sie verändert haben** (`DocChange[]`). Der Renderer
  aktualisiert gezielt — ein verschobenes Prop betrifft genau ein Sprite.
- **Ein Benutzervorgang ist ein Undo-Schritt.** Ziehen und Pinselstriche werden mit
  `beginTransaction()` / `endTransaction()` geklammert und über `mergeKey` verschmolzen.
- **Prozedurale Props werden je Variante einmal in eine Textur gebacken**
  (`engine/propTextures.ts`), danach sind es nur noch Sprites in einem Batch.
- **Städte wachsen an Straßen, nicht durch Streuen.** Der Stadt-Generator
  (`model/generators/stadtNetz.ts`) legt zuerst ein Netz an: Markt,
  geschwungene Hauptstraßen zu den Ausfällen, Ringgassen, Speichen und
  Quergassen. Die Häuser stehen Wand an Wand an beiden Straßenseiten, die
  großen zuerst am Markt. Zurückweisungsverfahren — würfeln und wegwerfen —
  sahen bei jedem Startwert gleich aus; die frühere Blockteilung
  (`cityPlan.ts`, nur noch für Hilfsfunktionen) gab gerade Schnitte und
  verstreute Häuser. Wie viele Häuser hineinpassen, wird über den *Maßstab*
  gesucht, nicht ausgerechnet; überzählige fallen von außen nach innen weg.
  Haus gegen Haus wird exakt geprüft (Trennachsensatz), das Raster gilt nur
  für Straßen — ein grobes Raster wies Nachbarn Wand an Wand ab.
- **Einstellungen wirken auf die Auswahl, nicht nur auf das Nächste.** Ein
  Panel, das nur die Werkzeugvorgabe schreibt, sieht aus wie ein kaputter
  Regler: man verstellt etwas und nichts passiert. Jedes Panel, das
  Objekteigenschaften zeigt, übernimmt darum beides — Vorgabe *und* Auswahl —
  und zeigt an, was die Auswahl sagt. Und es erscheint, sobald ein passendes
  Objekt ausgewählt ist, nicht erst beim zugehörigen Werkzeug.
- **Mauerwerk ist Teil der Wand.** Wand und Tür tragen ihren Stil selbst
  (`style`, `styleLayerId`); die sichtbare Zeichnung leitet
  `model/vttVisuals.ts` nach jedem Befehl, Rückgängig und Wiederholen daraus
  ab. Sie ist nicht einzeln anfassbar (`isObjectEditable`) und braucht keinen
  eigenen Rückgängig-Schritt. Wer Wände neu anlegt, setzt den Stil an der Wand
  und legt **keine** lose Zeichnung daneben — genau das ließ sich früher
  auseinanderziehen.
- **Setz-Werkzeuge wählen aus, was sie gesetzt haben** (`tools/auswahlNachSetzen.ts`),
  damit die Einstellungen rechts sofort auf das eben Gesetzte wirken.
- **Wer eine Eigenschaft hinzufügt, die man sieht, ergänzt `viewKey`.** Der
  Renderer baut einen Knoten nur neu, wenn dieser Schlüssel sich ändert. Fehlt
  die Eigenschaft darin, ist die Änderung im Modell da und im Bild nicht — bei
  den Tagesmarken einer Reiseroute genau so passiert.
- **Der VTT-Layer landet nie im Bild-Export.** Wände, Türen und Lichter beschreiben,
  was Foundry bauen soll — nicht, was zu sehen ist.

### Layer

Kein fester Layer-Satz: das Dokument hält einen frei anlegbaren Stapel. Objekt-Layer
nehmen gemischt Props, Zeichnungen, Text und Flächen auf. Grid und VTT sind
Systemebenen (`SYSTEM_GRID`, `SYSTEM_VTT`) — sie stehen im selben Stapel und sind
frei positionierbar, lassen sich aber nicht löschen.

## Export

- **Bild**: PNG/WebP/JPEG, Auflösung in px pro Tile wählbar.
- **Universal VTT** (`.uvtt`/`.dd2vtt`): Import in Foundry über das Modul
  *Universal Battlemap Importer* (`dd-import`) — Foundry kann UVTT nicht nativ.
  Drei Fallstricke, alle in `io/uvtt.ts` festgehalten:
  1. **Koordinaten sind Grid-Einheiten, nicht Pixel.**
  2. **Lichtfarben sind AARRGGBB**, Alpha zuerst. Der Importer macht
     `"#" + light.color.substring(2)`; bei RRGGBBAA würde aus einem warmen
     `ffcc88` ein violettes `cc88ff`.
  3. **`portals.rotation` ist im Bogenmaß.**
  `io/uvtt.ts` hat auch einen **Reader**: jeder Export wird sofort gegengelesen,
  und fremde `.dd2vtt`-Dateien lassen sich öffnen.
- **Projekt**: `.ttmap` = ZIP mit `scene.json`, benutzten Assets und Vorschaubild.
  Weitere Karten derselben Datei liegen unter `maps/`, Reihenfolge im Manifest
  (`model/mappe.ts`, `io/project.ts`).

## Sprache

Code-Kommentare und Commit-Messages auf Deutsch.

**Oberflächentexte laufen über `src/i18n/`.** Deutsch und Englisch stehen paarweise
in `strings.ts` (`[de, en]`) — zwei getrennte Wörterbücher laufen auseinander.
Kein neuer sichtbarer Text ohne Schlüssel; `tests/i18n.test.ts` prüft
Vollständigkeit und gleiche Platzhalter in beiden Sprachen.

- In Komponenten: `const { t } = useT()` — rendert bei Sprachwechsel neu.
- Außerhalb von React (Werkzeuge, Befehle): `import { t } from '@/i18n'`.
- Befehlsnamen (`cmd.*`) sind Oberfläche: sie stehen im Rückgängig-Tooltip.
- Layernamen und der Kartenname werden beim Anlegen übersetzt und dann
  **mitgespeichert** — sie sind Daten und ändern sich bei einem Sprachwechsel nicht.

## Dev-Hilfen

`src/devHarness.ts` hängt im Dev-Build ein `T`-Objekt ans Fenster: `T.ptr()`,
`T.stroke()`, `T.pump()`, `T.shot()`, `T.propSheet()`. Gedacht für automatisierte Bedienung und
visuelle Kontrolle ohne Screenshot-Werkzeug — `T.shot()` schreibt über den
Dev-Endpunkt `/__shot` nach `.dev-shots/`.

Zwei Fallen beim automatisierten Prüfen, beide teuer gelernt:

- In einem **nicht sichtbaren** Browser-Tab feuert kein `requestAnimationFrame`,
  also steht Pixis Ticker still. `T.pump()` treibt Frames dann von Hand an.
- **Zustand nie über `import('/src/model/store.ts')` aus der Konsole lesen.**
  Nach einem Hot-Reload serviert Vite Module mit Zeitstempel-Query; ein frischer
  Import liefert eine zweite, leere Store-Instanz und damit Messwerte, die nach
  einem Fehler aussehen, wo keiner ist. `T.state()` und `T.doc()` benutzen.
- **Prop-Zeichnungen lassen sich nicht im Quelltext beurteilen.** `T.propSheet()`
  liefert einen Kontaktbogen aller (oder ausgewählter) Props als PNG-Data-URL —
  groß genug, beschriftet, nebeneinander. In der Palette sind sie 46 Pixel groß,
  und dort sieht jedes Prop passabel aus.
- Synthetische `dispatchEvent`-Klicks lösen **keine Standardaktion** aus. Fehler,
  die am Fokuswechsel nach einem echten Klick hängen, zeigen sich damit nicht.
