# Konzept: Homebrew Creator (mit Eichung)

Rückmeldung: „Spell/Weapon Creator", dann entschieden: **ein Werkzeug
„Homebrew Creator"** (zuerst „Item Creator"; umbenannt, weil auch Zauber
hineingehören), **Zauber als Reiter**, **mit Eichung**. Der bisherige Magic Item Creator heißt
künftig **Magic Item Generator**, damit der Unterschied klar ist:

| Werkzeug | Macht | Wer entscheidet |
| --- | --- | --- |
| Magic Item Generator (heute „Creator") | würfelt magische Gegenstände aus Tabellen | der Zufall, die SL wählt aus |
| Homebrew Creator (neu) | baut Waffen, Rüstungen, Gegenstände und Zauber Feld für Feld | die Person am Werkzeug, die Eichung warnt |

**Stand:** gebaut, siehe „Stand" unten.

## Umbenennung

- Sichtbare Namen: Kachel, Schiene, Einführung, Suche, Doku
  (`app.magicitems.name`, `einfuehrung.ts`, `docs/magicitems.md`, README).
  Umgesetzt: alle sichtbaren Namen, Kommentare und Doku (außer dem
  Verlauf in BACKLOG.md).
- **Intern bleibt `magicitems`** (Ordner, IPC-Kanäle, Datenordner,
  Kennungen in Bögen und Loot-Tabellen). Eine interne Umbenennung bricht
  gespeicherte Daten und bringt keinen Nutzen.
- Deutsch: „Magic Item Generator" bleibt englisch wie die anderen
  Werkzeugnamen (Loot Generator, Story Creator). Entschieden.

## Was der Homebrew Creator baut

Reiter, je mit eigener Eichung:

1. **Waffe**: Kategorie (einfach/Kriegswaffe), Nah/Fern, Schadenswürfel
   und -art, Eigenschaften (Finesse, Leicht, Schwer, Zweihändig,
   Vielseitig, Reichweite, Wurfwaffe, Munition, Laden), genau eine
   Meisterschaft, Gewicht, Preis.
2. **Rüstung**: Art (leicht/mittel/schwer/Schild), RK-Formel, Stärke-
   Anforderung, Nachteil auf Heimlichkeit, Gewicht, Preis.
3. **Gegenstand** (Ausrüstung, Werkzeug, Tand): Text, Gewicht, Preis.
4. **Magischer Gegenstand von Hand**: Seltenheit, Einstimmung, Wirkungen.
   Nutzt die **Punkteskala des Generators** (`apps/magicitems/src/shared/
   pruefung.ts`, 31 SRD-Eichpunkte), die dafür in ein gemeinsames Paket
   wandert. Auch Waffe und Rüstung können hier „+1" usw. bekommen.
5. **Zauber**: Grad, Schule, Klassen, Zeitaufwand, Reichweite,
   Komponenten, Dauer, Konzentration, Ritual, Text; dazu die eichbaren
   Teile maschinenlesbar: Schaden (Würfel, Art), Ziel (Einzelziel oder
   Fläche mit Form und Größe), Rettungswurf oder Angriffswurf, Wirkung bei
   Erfolg (halber/kein Schaden), Zustand, Skalierung pro höherem Grad.
   Entschieden: Zauber als Reiter im selben Werkzeug.

## Eichung: wie, und was ich dazu nicht weiß

Wie beim Generator gilt: **keine erfundene Formel, sondern Vergleich mit
dem SRD.** Das Werkzeug sagt „liegt im Bereich der SRD-Waffen dieser
Kategorie" oder „stärker als jede vergleichbare SRD-Waffe", und nennt die
nächsten SRD-Vergleiche. Es verbietet nichts.

### Waffen (38 SRD-Waffen)

- Vergleichsgruppe: gleiche Kategorie und Nah/Fern.
- Grundwert: durchschnittlicher Schaden (1W8 = 4,5; 2W6 = 7).
- Eigenschaften verschieben, was angemessen ist (Zweihändig/Schwer ↔
  größerer Würfel, Leicht/Finesse ↔ kleinerer). **Die Gewichte dieser
  Verschiebungen sind nicht offiziell**; sie werden aus Paaren im SRD
  abgelesen, die sich in genau einem Punkt unterscheiden, und als
  Eichpunkte mit Test festgehalten. Wo kein Paar existiert, gibt es
  keine Aussage, nur „ähnlichste SRD-Waffe".
- Meisterschaft: genau eine, aus den acht des SRD.
- Preis und Gewicht: Bereich der Vergleichsgruppe, nur Hinweis.

### Rüstungen (12 Rüstungen und der Schild)

- Je Art: RK gegen die SRD-Rüstungen derselben Art, mit Preis, Stärke-
  Anforderung und Heimlichkeit als Ausgleich. Wenige Punkte, darum nur
  „liegt zwischen X und Y" bzw. „über der besten SRD-Rüstung dieser Art".

### Zauber (339 SRD-Zauber)

- Ein offizielles Richtwertblatt für Zauberschaden habe ich im SRD 5.2.1
  **nicht gefunden** (Suche im PDF nach den üblichen Überschriften).
  Die Eichung kommt deshalb aus den Zaubern selbst.
- Erste grobe Auszählung (automatisch, fehlerbehaftet): je Grad nur
  etwa **2 bis 12 Schadenszauber**, viele mit Sonderfällen (Schaden über
  Runden, Beschwörungen, Bedingungen). Beispiel, das sicher passt:
  *Fireball*, Grad 3, Fläche, 8W6 = 28 im Schnitt.
- Darum: **handverlesene Eichpunkte** (Ziel: 2 bis 4 je Grad und
  Zielart), daraus ein Band „üblicher Schaden je Grad, Einzelziel vs.
  Fläche", als Tabelle im Code mit Test, genau wie die 31 Eichpunkte des
  Generators. Konzentration, Rettungswurf-Halbierung und Zusatzzustände
  verschieben das Band; diese Verschiebungen sind Schätzungen und werden
  als solche angezeigt.
- Zauber **ohne Schaden** (Bezaubern, Teleport, Schutz) lassen sich so
  kaum eichen. Dort zeigt das Werkzeug nur die ähnlichsten SRD-Zauber
  (gleicher Grad, gleiche Schule, gleicher Zustand) zum Vergleich.

### Gegenstände

- Nur Preis und Gewicht gegen ähnliche Ausrüstung. Keine Bewertung.

## Wohin die Ergebnisse gehen

- **Charakterbogen**: eigene Waffen rechnen wie SRD-Waffen
  (`apps/charakterbogen/src/shared/waffen.ts` bekommt eine zweite
  Quelle); eigene Zauber stehen in der Zauberliste neben den SRD-Zaubern;
  eigene Rüstung als Gegenstand (die RK bleibt im Bogen ein eigenes Feld).
  Inventarquelle „Eigene" um den Homebrew Creator erweitert.
- **Loot Generator**: eigene Gegenstände als Tabelleneinträge, wie heute
  die aus dem Generator.
- **Nachschlagewerk**: eigene Einträge in der Liste, als „Homebrew"
  gekennzeichnet, getrennt vom SRD (wie die Hausregeln).
- **Teilen/Raum** und **Foundry-Export** wie bei Monstern und magischen
  Gegenständen.
- **Strg+K**: findet eigene Einträge.

Die Werkzeuge kennen einander nicht; die Hülle reicht die Daten durch,
wie heute bei den Inventarquellen.

## Stand

Alle sechs Schritte sind umgesetzt (Rauchtest `apps/shell/scripts/smoke-homebrew.cjs`):

1. Umbenennung „Magic Item Generator" (nur sichtbare Namen, intern `magicitems`).
2. `packages/magie`: Punkteskala und Eichpunkte aus dem Generator, mit Tests.
3. Reiter Waffe und Rüstung mit Eichung (`apps/homebrew/src/shared/eichung.ts`).
   Leave-one-out über die SRD-Waffen: nur die Pistole gilt als „stärker".
4. Anbindung Charakterbogen (Angriffe rechnen mit den eigenen Werten, Inventar
   „Eigene"), Loot (Tabelle „Homebrew"), Nachschlagewerk, Strg+K, Teilen.
5. Reiter Zauber (`zauberEichung.ts`): 37 handverlesene SRD-Zauber mit
   sofortigem Schaden als Eichpunkte, je Grad und Zielart; jeder Punkt wird im
   Test am SRD-Wortlaut geprüft. Fehlende Grade werden zwischen den Nachbarn
   gemittelt. „Stärker" ab 25 % über dem stärksten Vergleich, „deutlich" ab
   60 %; diese Grenzen sind **geschätzt**, nicht aus dem SRD. Leave-one-out
   meldet drei SRD-Zauber als stark: Sengender Strahl (für Grad 2 bleibt ohne
   ihn nur der Säurepfeil), Auflösung (10W6 + 40) und Meteoritenschwarm
   (einziger Punkt in Grad 9). Eigene Zauber erscheinen in der Zaubersuche
   des Bogens und werden dort als eigener Zauber mit Herkunft „Homebrew"
   übernommen.
6. Gegenstand und magischer Gegenstand von Hand. Der magische Gegenstand
   nutzt die Grenzen des Generators (`@suite/magie/pruefung`) und meldet
   nur, statt zu ändern. Foundry-Export für alle fünf Arten (siehe unten).

Bild je Eintrag: auf der Kachel, in der aufgeklappten Iteminfo des Bogens
und im Nachschlagewerk.

### Rückmeldungen danach (Oktober 2026)

- **Zauber:** Zeitaufwand, Reichweite, Komponenten und Dauer als Auswahl im
  Wortlaut der SRD-Zauber, mit „Eigener Text …" für alles andere. Eigene
  Klassen und Unterklassen frei schreibbar. Wirkung: Schaden, Heilung,
  Zustand (SRD und eigene aus dem Status Effect Creator) oder nichts davon
  (z. B. Magierhand). Geeicht wird weiterhin nur Schaden; zu Heilung und
  Zuständen stehen Vergleiche als Hinweis da (Wunden heilen 2W8, Heilendes
  Wort 2W4, Person festhalten: Gelähmt; im SRD-Paket nachgeprüft). Ein Satz
  zu jeder Schule.
- **Waffe:** Schaden als Anzahl, Würfel und Plus; weitere Schadenszeilen für
  gemischten Schaden; Reichweite im Nahkampf (5 Fuß, mit „Weitreichend" 10).
  Plus und Zusatzschaden zählen in der Eichung. Je ein Satz zu Eigenschaften
  und Meisterschaften (eigene Kurzfassungen, kein SRD-Zitat).
- **Abschnitte zuklappbar** in allen Arten.
- **Strg+S** speichert, in allen Werkzeugen mit Speichern-Knopf
  (`packages/tastatur`); der Knopf pulsiert dabei kurz, auch beim Klick.
- **Nah/Fern** steht nur unter „Reichweite“, nicht mehr doppelt unter
  „Grundlagen“.
- **Zahlenfelder** prüfen Minimum und Maximum erst beim Verlassen oder mit
  Enter (`packages/zahlfeld`); „10“ lässt sich bei Minimum 5 tippen. Dasselbe
  Feld nutzen Encounter Builder, Initiative Tracker, Monster-Bearbeitung und
  die Anzahl im Inventar des Charakterbogens.
- **Magischer Gegenstand = eine Sammlung mit dem Generator.** Er liegt in
  der Ablage des Magic Item Generators (`magicitems/gegenstaende`, Format aus
  `@suite/magie/ablage`, jetzt mit Bild und Gewicht). Das Formular für Art,
  Seltenheit, Einstimmung, Wirkungen und Fluch ist dasselbe
  (`@suite/magie/formular`); der Generator steckt seine KI-Knöpfe hinein.
  Ältere magische Einträge des Homebrew Creators ziehen beim Öffnen um.
  Im Homebrew Creator tragen sie eine Kennung mit „@".

### Was fehlt oder unsicher ist

- **Foundry-Export** für Waffe, Rüstung, Gegenstand und Zauber
  (`packages/foundry/src/homebrew.ts`), gebaut nach echten Exporten aus
  Foundry 14.368 / dnd5e 6.0.5 (Langschwert, Kettenhemd, Feuerball,
  Chromatische Kugel, Diebeswerkzeug, selbst angelegter Schlüssel; Gerüste
  in `packages/foundry/tests/belege/*-6.json`). Ein Test prüft, dass kein
  Feld erfunden ist. Ungeprüft sind einzelne WERTE, die nur aus den
  Typlisten von dnd5e stammen (im Code mit „UNGEPRÜFT“ markiert), etwa
  Fernkampfweiten, leichte/schwere Rüstung, andere Schulen und Schablonen.
  Ein einfacher Gegenstand wird `loot` wie der Schlüssel. Heilung steht bei
  Zaubern im Text (keine Heil-Tätigkeit: dafür liegt kein Beleg aus 6.0.5
  vor), ebenso Zauber ohne Angriff und Rettungswurf.
- **RK-Bonus als Effekt** in der Form von Foundry 14 (`system.changes[]` mit
  `type: add`). Vorher stand er in der alten Form (`changes[]` mit `mode`);
  das betraf auch magische Rüstungen und Schilde aus dem Magic Item
  Generator.
- **Bild im Foundry-Export ungeprüft.** Foundry selbst legt im Feld `img`
  einen Pfad auf dem Server ab (Beleg: `assets/…png`). Wir schreiben die
  `data:`-Adresse hinein. Ob Foundry das beim Import annimmt, ist an keinem
  echten Import getestet.
- **Magischer Gegenstand:** gelesen werden nur Zahlen in festen Mustern
  („+2 Bonus", „2W6 … Schaden", „SG 15", „(Grad 3)"). Frei Formuliertes
  sieht die Eichung nicht; die Oberfläche sagt das.
- **Gegenstand:** keine Eichung (geplant war nur ein Hinweis zu Preis und
  Gewicht).
- **Zauber ohne Schaden:** keine Eichung, nur Hinweise.
- **Zusatzschaden im Charakterbogen:** der Bogen rechnet mit einem Würfel;
  Plus und weitere Schadenszeilen stehen dort nur im Text der Schadensart.
- **Magische Gegenstände im Nachschlagewerk:** dort stehen jetzt alle aus
  der gemeinsamen Sammlung, auch gewürfelte aus dem Generator.

## Entschieden

- Ein Werkzeug „Homebrew Creator", Zauber als Reiter, mit Eichung.
- Die Namen „Homebrew Creator" und „Magic Item Generator" bleiben auch in
  der deutschen Oberfläche englisch.
- **Bild je Eintrag möglich** (optional, hochgeladen) für Waffe, Rüstung,
  Gegenstand, magischen Gegenstand und Zauber. Es erscheint auf der Kachel
  im Homebrew Creator, in der aufgeklappten Iteminfo im Inventar des
  Bogens, im Eintrag im Nachschlagewerk und im Foundry-Export (Bildfeld).
  Umsetzung wie das Porträt im Charakterbogen: verkleinert und als Daten
  im Eintrag gespeichert, mit Größengrenze.

Offen: ein Import unseres Exports mit Bild in Foundry, um das Bildfeld zu prüfen.
