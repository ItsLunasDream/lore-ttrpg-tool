# LORE

**Library Of RPG Essentials**

*[This document in English: README.md](README.md)*

Werkzeuge für Pen-&-Paper-Kampagnen in einem Fenster. Keine Anmeldung, keine
Cloud: alles bleibt auf der eigenen Platte. Einzige Ausnahme ist die
KI-Anbindung, die man selbst einrichtet.

- **Initiative Tracker**: Kampfreihenfolge, Trefferpunkte, Zustände mit
  Dauer, Geländeereignisse, Gruppen für Horden.
- **Würfel**: d4 bis d100 und ein eigener Würfel, flach oder 3D, auch mit
  Abzug.
- **Story Creator**: Figuren, Orte, Beziehungen als Markdown-Notizen mit
  Wiki-Links.
- **Charakterbogen**: kleiner Bogen für D&D 5.5e, der mitrechnet.
- **NPC Creator**: Randfiguren aus Tabellen oder per KI.
- **Inspirationshilfe**: Gerüst für eine neue Kampagne (Aufhänger,
  Fraktionen, Figuren, Orte, Verbindungen, Zeitstrahl).
- **Monster Creator**: Homebrew-Monster, geprüft gegen Richtwerte je HG.
- **Status Effect Creator**: eigene Zustände mit Stufen, gewogen an den
  offiziellen.
- **Encounter Creator**: Begegnungen aus 331 SRD-Monstern und eigenen,
  Schwierigkeit nach Regelwerk, mit einem Klick in den Tracker.
- **Magic Item Creator**: magische Gegenstände nach Art und Seltenheit, Wert
  nach SRD.
- **Loot Generator**: eigene, verschachtelbare Zufallstabellen.
- **Nachschlagewerk**: SRD-Glossar, Ausrüstung, 339 Zauber, 258 magische
  Gegenstände, offline in beiden Sprachen, mit Hausregeln und Notizen.
- **TTRPG Map Editor**: Battlemaps und Weltkarten, Export als Universal VTT.

Namen und Symbole sind vorläufig.

## Herunterladen

1. Reiter **Actions** → oberster Lauf **Build**
2. **Artifacts** → `lore-windows` herunterladen und entpacken
3. `LORE-Setup-<version>.exe` (Installer) oder `LORE-portable-<version>.exe`

- SmartScreen warnt, weil die Datei nicht signiert ist: „Weitere
  Informationen" → „Trotzdem ausführen".
- Artefakte verfallen nach einem Tag; ein Release hält die Dateien dauerhaft.

## Selbst bauen

Befehle im Projektordner ausführen und **nach jedem `git pull` einmal
`npm install`** (`scripts/pruefe-installation.mjs` prüft das).

```bash
npm install
npm run dev             # Hülle mit Hot Reload
npm start               # Produktionsbuild
npm test                # Kernlogik, alle Workspaces
npm run typecheck
npm run smoke           # Rauchtest der gebauten Hülle
npm run smoke:backstory # Rauchtest Story Creator (eigener Lauf)
npm run roundtrip       # Speichern verändert das Markdown nicht
npm run dist:win        # Windows-Installer nach apps/shell/release/
```

- `scripts\bauen-win.cmd`: Pull, Install und Build in einem Rutsch unter
  Windows.
- Ein Werkzeug allein: `npm run dev:backstory` (auch `dev:mapmaker`,
  `dev:initiative`, `dev:dice`, `dev:npc`).
- Ein Workspace: `npm run <skript> -w apps/backstory`.
- Paket der Sammlung: `npm run dist:suite:win`, `dist:suite:linux`, danach
  `npm run verify:package:suite -- <pfad>`.

### Aufbau

```
apps/shell/           Hülle: Fenster, Startmenü, Schiene, Einstellungen, Teilen
apps/backstory/       Story Creator
apps/mapmaker/        TTRPG Map Editor (auch als Tauri-App)
apps/initiative/      Initiative Tracker
apps/dice/            Würfel
apps/npc/             NPC Creator
apps/inspiration/     Inspirationshilfe
apps/monster/         Monster Creator
apps/zustaende/       Status Effect Creator
apps/encounter/       Encounter Creator
apps/nachschlagewerk/ Nachschlagewerk
apps/magicitems/      Magic Item Creator
apps/loot/            Loot Generator
packages/dice/        Würfelausdrücke
packages/i18n/        Sprache und Textersetzung
packages/motion/      Zeiten und Animationen
packages/ki/          Sprachmodelle (Ollama, Claude, OpenAI-kompatibel)
packages/umgebungen/  Umgebungen
packages/einstellungen/ Werkzeug-Einstellungen für die Hülle
packages/foundry/     JSON-Export für Foundry VTT
packages/farben/      Farbrollen und Themen
packages/eintraege/   Einträge, die alle Werkzeuge verstehen (Suche, Teilen)
packages/tabellen/    Zufallstabellen
packages/uebergabe/   Übergabe von Begegnungen zwischen Werkzeugen
packages/srd/         Inhalte des SRD 5.2.1 in beiden Sprachen
```

`packages/*` sind plattformfrei (kein `node:*`, kein `electron`, keine
Browser-Globals).

## Die Hülle

- **Strg+K** durchsucht alle Werkzeuge zugleich, frisch von der Platte.
- **Sicherung**: Einstellungen → Sicherung schreibt ein ZIP des ganzen
  Datenordners (ohne API-Schlüssel). Wiederherstellen durch Entpacken in den
  Datenordner.
- **Teilen**: Einträge (Notizen, Monster, Hausregeln, …) als eine
  Markdown-Datei weitergeben, oder einen Raum im lokalen Netz öffnen, mit
  Chat und Paketen. Mit Passwort ist der Raum verschlüsselt, ohne nicht, und
  die App sagt das.
- **Farbthemen und Oberflächengröße** (80–200 %) gelten für alle Werkzeuge.
- **Einstellungen an einer Stelle**: jedes Werkzeug beschreibt seine Felder
  (`packages/einstellungen`), die Hülle zeichnet sie.
- **Zurück/vorwärts** mit den Daumentasten der Maus oder Alt+Pfeil.
- Geöffnete Werkzeuge bleiben geladen (rund 130 MB je Werkzeug), jedes in
  einer eigenen Electron-Sitzung. Der Story Creator wird im Hintergrund
  geladen, wenn ein anderes Werkzeug ihm etwas schickt.
- Einführung beim ersten Start und je Werkzeug; in den Einstellungen
  zurücksetzbar.
- Datenordner: `%APPDATA%\LORE` (ältere Installationen:
  `%APPDATA%\TTRPG-Tools`).
- Direkt in einem Werkzeug starten: `TTRPG_TOOLS_START_APP=backstory`.

**Eigene Symbole**: `<werkzeug-id>.png` (PNG, JPG, WebP, GIF, bis 2 MB, kein
SVG) in `symbole/` im Datenordner (nur lokal) oder in `apps/shell/symbole/`
(wird mit ausgeliefert). Mehr in `apps/shell/symbole/LIESMICH.md`.

## KI

Einmal in den Einstellungen der Hülle: **Ollama** (lokal), **Claude-API**
oder ein **OpenAI-kompatibler** Dienst. Der Schlüssel ist mit dem
Schlüsselbund des Systems verschlüsselt und erreicht nie einen Renderer.
Alles funktioniert auch ohne KI.

## Story Creator

Notizen sind Markdown mit YAML-Kopf, lesbar in jedem Editor oder in
Obsidian.

| Aktion | So geht's |
| --- | --- |
| Verlinken, neu aus Link, Markiertes verlinken | `[[` tippen |
| Link öffnen | Strg+Klick |
| Suchen und ersetzen | Strg+F, F3 / Umschalt+F3 |
| Umbenennen, löschen (mit Rückgängig) | Rechtsklick in der Notizliste |
| Ausschneiden, Kopieren, Einfügen, Rechtschreibvorschläge | Rechtsklick im Text |
| Zoom (20–500 %) | Strg+Mausrad, Strg+Plus/Minus/0 |
| Sichern, einlesen, Notiztypen | Menü „Kampagne" |
| Bild | Knopf ▣ oder hineinziehen |
| Export (MD, PDF), Verlauf, Graph, Hilfe | Kopfzeile |

- Eine Notiz gehört zu einer **Kampagne** und verlinkt nur darin.
- **Notiztypen** stehen je Kampagne in `campaign.json`.
- **Wiki-Links** ziehen beim Umbenennen mit; fehlende Ziele stehen unter
  „Offene Links". Umbenennen über den Titel passiert beim Verlassen des
  Felds.
- **Beziehungen** sind gerichtet und hängen am Notizpaar.
- **Bilder** werden nach `assets/` kopiert.
- **Verlauf** sichert höchstens alle zwei Minuten; Wiederherstellen ist
  umkehrbar.
- **Gelöschte Notizen** liegen im Papierkorb (`trash/` im Speicherort, die
  letzten 20 je Kampagne); „Rückgängig“ im Hinweis holt sie samt
  Beziehungen zurück.
- **Rechtschreibung** prüft wahlweise wie die Oberfläche, fest Deutsch oder
  Englisch, oder gar nicht (Einstellungen).
- **Schreibhilfe** fügt an der Schreibmarke ein; Vorschläge zum Notiztyp
  (Figur, Ort, Fraktion, Ereignis) stehen oben.
- **Der Assistent** schreibt nie in den Text.
- **Das Markdown bleibt erhalten**: Kommentare, Linktitel, `<spitze>` Links
  und enge Listen kommen so heraus, wie sie hineingingen.
- **Export**: PDF mit Inhaltsverzeichnis, Graph und Sprungzielen; Markdown
  mit Alias-Kopf, wenn der Dateiname vom Titel abweicht.

## Charakterbogen

- Kleiner Bogen für D&D 5.5e (2024): Attribute, Rettungswürfe, 18
  Fertigkeiten mit Übung und Expertise, RK, Initiative, TP, Trefferwürfel,
  Zustände, Erschöpfung, Heldische Inspiration, Angriffe, Notizen.
- Rechnet Modifikatoren, Übungsbonus, Fertigkeiten und passive Wahrnehmung.
- **Schaden / Heilung**: `-7` oder `7` zieht ab, `+5` heilt, Würfel gehen
  (`2w6+3`); temporäre TP zuerst. Rasten nach SRD 5.2.
- **Zauber**: SG und Angriff, Plätze je Grad (auch Paktmagie), Liste aus
  den 339 SRD-Zaubern oder eigenen, Wirken verbraucht einen Platz.
- **Inventar**: Gegenstände mit Gewicht und Wert, Geld in PM/GM/EM/SM/KM,
  Gruppeninventare, Geben und Aufteilen zwischen Bögen; Gewichte in kg und lb.
- Speichert von selbst als Markdown. Der Raum folgt
  (`docs/charakterbogen.md`).

## Initiative Tracker

- **Gruppen**: eine Initiative, eigene Trefferpunkte je Körper.
- **Zustände** mit Dauer zählen selbst ab. SRD- und eigene Zustände werden
  vorgeschlagen, mit Regeltext beim Drüberfahren.
- **Geländeereignisse** laufen bei Initiative 20, hinter Figuren mit 20.
- **Leertaste** = nächster Zug. Das Schadensfeld rechnet (`2d6+3`); ein `+`
  oder `-` vorn heilt. Enter übernimmt, Escape verwirft.
- **RK, Temp-HP, „Raus"** haben eigene Felder.
- Initiative ändern sortiert neu; die aktive Zeile bleibt und rollt in den
  Blick.
- **Statblock** per Klick bei Monstern aus dem Encounter Creator.
- **Strg+Z / Strg+Y** nimmt alles im Kampf zurück und wiederholt es.
- Begegnungen sind Markdown-Dateien in einer durchsuchbaren Sammlung; der
  laufende Kampf (samt Taktik-Notiz) liegt als JSON daneben.

## NPC Creator

- Name, Spezies, Tätigkeit, Auffälliges, Wille, Geheimnis, Eigenheit; jedes
  Feld neu würfeln, festhalten oder überschreiben.
- Namensklang: feminin, maskulin, neutral.
- Mit KI schlägt das Modell frei vor, ohne gelten die Tabellen.
- **Export** legt eine Notiz in der gewählten Kampagne an, mit der Spezies
  im Steckbrief. Gibt es sie schon, bietet der Knopf „Dort aktualisieren“ an.
- Die **Merkliste** bleibt über einen Neustart erhalten.

## Inspirationshilfe

- Sechs Bausteine: Aufhänger, Fraktionen, Figuren, Orte, Verbindungen,
  Zeitstrahl.
- Funktioniert ohne KI (über eine Million Kombinationen je Baustein).
- Regler: Umfang, Region, Thema, Tonfall. Jeder Baustein lässt sich
  festhalten oder überschreiben.
- Vorhandene Figuren der Kampagne lassen sich einbinden.
- Das Figurengeflecht als Bild, per Klick über den ganzen Schirm.
- „Karte anlegen" öffnet den Karteneditor mit den Notizen zum Ort als Pins.
- „Alles von der KI" entwirft alle sechs Bausteine aufeinander bezogen.
- **Übernehmen** legt Notizen und eine Übersicht in der gewählten Kampagne
  an. Vorhandene werden übersprungen oder auf Wunsch aktualisiert.

Konzept: `docs/inspirationshilfe.md`.

## Monster Creator

- **Die Prüfung** rechnet Verteidigungs- und Angriffs-HG getrennt und sagt,
  was sich drehen lässt; jeder Vorschlag ist ein Knopf.
- Zahlen der KI werden auf den Ziel-HG gezogen (mit Weg zurück), eigene
  bekommen nur einen Hinweis.
- **Statblock nach 2024**: Attribute, Bewegung, Initiative, passive
  Wahrnehmung, HG mit EP, ausgeschriebene Angriffe.
- Resistenzen und Immunitäten sind optional und in die Trefferpunkte
  eingerechnet.
- **Bearbeiten** nach dem Würfeln; die Prüfung rechnet live mit. „Als neu
  speichern" lässt das Original stehen.
- **Eigene Zustände** (eigener Haken): höchstens einer je Monster. Der
  Rettungswurf folgt dem Thema: KON (Kälte, Gift, Blut, …), GES (Feuer),
  ST (Sturm), WEI (Wahnsinn, Traum), INT (Leere, Zeit), CHA (Klang,
  Schatten, Fluch).
- **Vorhandenes Monster prüfen** durch Eintippen seiner Zahlen.
- Sammlung mit Suche (`untot 4`, `cr 3-6`); Dateien sind Markdown mit allen
  Zahlen im Kopf.

Richtwerte aus einer CC-BY-Quelle, siehe [NOTICE.md](NOTICE.md).

## Status Effect Creator

- Zustände mit Stufen, siebzehn Themen, Stufen als Stichpunkte.
- **Gewicht** im Vergleich zu bekannten Zuständen („etwa Erschöpfung 5").
- **Takte** von Dauer, Linderung und Verschlimmerung müssen passen; ein
  Widerspruch wird gemeldet.
- **Frist** (Runde, Stunde, Tag) und Rettungswurf mit SG und Zeitpunkt.
- Segen heißen „Stärker/Schwächer" statt „Schlimmer/Besser".
- **Pakete**: mehrere Zustände mit gemeinsamem Thema.
- **Karte zum Vorlesen**: vorn der Spielertext, hinten die Regel.
- „Als neu speichern" lässt das Original stehen.

## Encounter Creator

- Die Einordnung steht unter den Gegnern und nennt alle drei Budgets.
- Zusammenstellen nach Ziel-HG oder nach Schwierigkeit für die Gruppe.
- Mit einem Klick in den Tracker, jedes Monster mit Statblock.

Mehr: `docs/encounter.md`.

## Nachschlagewerk

- SRD-Regeln offline, mit Querverweisen und Vorschau beim Drüberfahren.
- Hausregeln in Markdown; `[[` schlägt Einträge zum Verlinken vor.
- Notizen an jeder Textstelle.

Mehr: `docs/nachschlagewerk.md`.

## Würfel

- Die Form unterscheidet die Arten; Farbe und Muster gelten für alle.
- Eine Zahl je Art, auch negativ: Linksklick legt dazu, Rechtsklick nimmt
  weg.
- Effekte beim Höchstwurf und bei einer 1, abschaltbar.
- Verlauf von 40 Würfen je Sitzung.
- **3D** (standardmäßig aus, braucht Grafikbeschleunigung): das Ergebnis
  kommt aus `wuerfle()`, die Physik animiert es nur.

## TTRPG Map Editor

`apps/mapmaker` hat eine eigene Historie und `CLAUDE.md`. Anpassungen für den
Workspace: `base: './'` in `vite.config.ts` und eine Typ-Notlösung für die
Vite-Plugins. Rust-Anteil, `e2e/` und `build:portable` sind nicht in der CI.

## Datenablage

```
<Speicherort Story Creator>/     änderbar unter Einstellungen → Speicherort
  campaigns/<id>/campaign.json
  campaigns/<id>/notes/<noteId>.md
  campaigns/<id>/assets/
  campaigns/<id>/history/<noteId>/
  writing-prompts.<sprache>.json

<Nutzerdatenverzeichnis>/
  einstellungen.json             Sprache, KI, verschlüsselter Schlüssel
  fenster.json                   Fenstergröße und -stelle
  symbole/                       eigene Symbole
```

- Selbst abgelegte Markdown-Dateien in `notes/` werden mitgelesen.
- Eine eingelesene Kampagne bekommt immer eine neue ID.
- Jede Datei trägt eine `schemaVersion`.

## Tests

| Befehl | Prüft |
| --- | --- |
| `npm test` | Kernlogik |
| `npm run typecheck` | Typen |
| `npm run smoke` | gebaute Hülle und alle Werkzeuge |
| `npm run smoke:backstory` | Story Creator (eigener Lauf!) |
| `npm run roundtrip` | Speichern verändert das Markdown nicht |
| `npm run verify:package:suite -- <pfad>` | gepacktes Paket startet |

## Grenzen

- Beim Kampagnenwechsel werden alle Notizen geladen (für einige hundert
  unkritisch).
- Umbenennen schreibt Dateien einzeln; ein Absturz mittendrin lässt einen
  Teil der Links auf dem alten Namen.
- Mehrdeutige Titel oder Aliasse werden in der Oberfläche nicht markiert.

Offene Aufgaben: [BACKLOG.md](BACKLOG.md). Handprüfung vor einem Release:
[TESTLISTE.md](TESTLISTE.md).

## Marken

Keine Verbindung zu Foundry Gaming LLC, Roll20, Owlbear Rodeo, Obsidian,
Anthropic oder Ollama, weder unterstützt noch geprüft. Die Namen beschreiben
nur, mit welchen Programmen und Diensten die Werkzeuge zusammenarbeiten.

## Über dieses Projekt

Code, Architektur und Dokumentation sind größtenteils mit
[Claude Code](https://claude.com/claude-code) entstanden. Beiträge sind
willkommen, mit oder ohne KI.

Kommentare, Commits und Projektunterlagen (`KONVENTIONEN.md`, `BACKLOG.md`,
`docs/`) sind auf Deutsch; die Oberfläche gibt es auf Deutsch und Englisch.

| `docs/` | Inhalt |
|---|---|
| `inspirationshilfe.md` | Inspirationshilfe |
| `monster.md` | Monster Creator |
| `statuseffekte.md` | Status Effect Creator |
| `encounter.md` | Encounter Creator |
| `austausch.md` | Teilen und Räume |
| `raum-online.md` | Anleitung: Raum übers Internet (Portfreigabe, IPv6) |
| `magicitems.md` | Magic Item Creator |
| `nachschlagewerk.md` | Nachschlagewerk |
| `loot.md` | Loot Generator |
| `inventar.md` | Inventar (Konzept, nicht gebaut) |
| `charakterbogen.md` | Charakterbogen mit Inventar und Rollen im Raum (Schritte 1 bis 3 gebaut) |

## Lizenz

[GNU Affero General Public License v3.0 oder neuer](LICENSE). Wird eine
veränderte Fassung über ein Netzwerk angeboten, muss ihr Quelltext
offenstehen. Ohne Gewährleistung.

**Ausnahme: die Symbole** in `apps/shell/symbole/` sind © ItsLunasDream,
alle Rechte vorbehalten ([LIZENZ.md](apps/shell/symbole/LIZENZ.md)). Eine
weitergegebene veränderte Fassung ersetzt sie oder lässt sie weg.

### Fremde Inhalte

Die Namensnennungen stehen in [NOTICE.md](NOTICE.md) und müssen mitgegeben
werden. Die Monster-Richtwerte stammen aus dem *Lazy GM's 5e Monster Builder
Resource Document* von Teos Abadía, Scott Fitzgerald Gray und Michael E. Shea
(CC-BY-4.0, mit Material aus dem SRD 5.1). Inhalte aus dem SRD 5.2.1
(CC-BY-4.0) tragen die in NOTICE.md vorgeschriebene Namensnennung. Aus dem
Dungeon Master's Guide stammt nichts.
