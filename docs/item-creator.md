# Konzept: Item Creator (Homebrew mit Eichung)

Rückmeldung: „Spell/Weapon Creator", dann entschieden: **ein Werkzeug
„Item Creator"**, **mit Eichung**. Der bisherige Magic Item Creator heißt
künftig **Magic Item Generator**, damit der Unterschied klar ist:

| Werkzeug | Macht | Wer entscheidet |
| --- | --- | --- |
| Magic Item Generator (heute „Creator") | würfelt magische Gegenstände aus Tabellen | der Zufall, die SL wählt aus |
| Item Creator (neu) | baut einen Gegenstand Feld für Feld | die Person am Werkzeug, die Eichung warnt |

**Stand:** Konzept, nichts gebaut.

## Umbenennung

- Sichtbare Namen: Kachel, Schiene, Einführung, Suche, Doku
  (`app.magicitems.name`, `einfuehrung.ts`, `docs/magicitems.md`, README).
  Gefunden: 27 Dateien mit „Magic Item Creator".
- **Intern bleibt `magicitems`** (Ordner, IPC-Kanäle, Datenordner,
  Kennungen in Bögen und Loot-Tabellen). Eine interne Umbenennung bricht
  gespeicherte Daten und bringt keinen Nutzen.
- Deutsch: „Magic Item Generator" bleibt englisch wie die anderen
  Werkzeugnamen (Loot Generator, Story Creator).

## Was der Item Creator baut

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
   **Offene Frage 1** unten: Zauber sind keine Items.

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
  Inventarquelle „Eigene" um den Item Creator erweitert.
- **Loot Generator**: eigene Gegenstände als Tabelleneinträge, wie heute
  die aus dem Generator.
- **Nachschlagewerk**: eigene Einträge in der Liste, als „Homebrew"
  gekennzeichnet, getrennt vom SRD (wie die Hausregeln).
- **Teilen/Raum** und **Foundry-Export** wie bei Monstern und magischen
  Gegenständen.
- **Strg+K**: findet eigene Einträge.

Die Werkzeuge kennen einander nicht; die Hülle reicht die Daten durch,
wie heute bei den Inventarquellen.

## Schritte

1. Umbenennung „Magic Item Generator" (nur sichtbare Namen).
2. Gemeinsames Paket für die Punkteskala magischer Gegenstände (aus dem
   Generator herausgelöst, Tests mitnehmen).
3. Item Creator: Gerüst, Ablage, Reiter Waffe und Rüstung mit Eichung
   und Tests gegen die SRD-Tabellen.
4. Anbindung Charakterbogen (Waffenangriffe, Inventar), Loot,
   Nachschlagewerk, Suche.
5. Reiter Zauber: Eichpunkte auswählen und prüfen, Band je Grad, Tests;
   Anbindung Zauberliste des Bogens.
6. Gegenstand und magischer Gegenstand von Hand; Foundry-Export.

## Offene Fragen

1. **Zauber im Item Creator?** Ein Zauber ist kein Gegenstand. Optionen:
   Reiter im Item Creator (ein Werkzeug weniger, Name passt nicht ganz),
   eigenes Werkzeug „Spell Creator" (gleicher Unterbau), oder den Item
   Creator „Homebrew Creator" nennen. Ich würde nach deiner Wahl bauen.
2. **Deutscher Name**: bleiben „Item Creator" / „Magic Item Generator"
   auch in der deutschen Oberfläche englisch (wie die übrigen
   Werkzeugnamen)?
3. **Eigene Waffen auch mit Bild** (wie Monster), oder reicht Text?
