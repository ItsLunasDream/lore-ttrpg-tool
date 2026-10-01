# Mitgelieferte Symbole der Werkzeuge

**Die Bilder hier sind nicht frei:** alle Rechte vorbehalten, siehe
[LIZENZ.md](LIZENZ.md). Die AGPL des Repositorys gilt für sie nicht.

Was hier liegt, wird mit der Sammlung ausgeliefert und gilt für alle, die sie
installieren. Genau dafür ist dieser Ordner da: er gehört ins Repository,
nicht in den Datenordner auf einem Rechner.

## Dateinamen

Der Name ist die Kennung des Werkzeugs:

| Datei             | Werkzeug           |
| ----------------- | ------------------ |
| `backstory.png`   | Story Creator      |
| `mapmaker.png`    | Karteneditor       |
| `initiative.png`  | Initiative Tracker |
| `dice.png`        | Würfel             |
| `npc.png`         | NPC Creator        |
| `inspiration.png` | Inspirationshilfe  |
| `monster.png`     | Monster Creator    |
| `encounter.png`   | Encounter Creator  |
| `zustaende.png`   | Status Effect Creator |
| `nachschlagewerk.png` | Nachschlagewerk |
| `magicitems.png`  | Magic Item Generator |
| `loot.png`        | Loot Generator     |
| `austausch.png`   | Teilen (Titelleiste und Dialog) |
| `banner.png`      | Banner oben im Startmenü, statt des Titels |

Das Banner ist breit gedacht, etwa 4:1. Es wird nie höher als ein Fünftel
des Fensters gezeigt. Fehlt es, steht dort der Titel.

Gelesen wird jede Bilddatei im Ordner, ohne feste Liste — der Dateiname ist
die Kennung. Deshalb gilt ein Bild auch für ein Werkzeug, das es noch nicht
gibt: `encounter.png` steht auf der Kachel, die heute nur „später" sagt.

Erlaubt sind `.png`, `.jpg`, `.webp` und `.gif`, höchstens 2 MB je Datei.
Kein SVG: eine SVG-Datei kann Skripte enthalten, und das ist eine Tür, die
man für ein Symbol nicht aufmachen muss.

## Wie sie aussehen sollten

Quadratisch und mindestens 128 Pixel Kantenlänge. Dasselbe Bild steht groß
im Startmenü (64 Pixel), klein in der Schiene (26 Pixel) und noch einmal groß
im Übergang beim Öffnen — es muss also in jeder Größe lesbar bleiben.

Transparenter Hintergrund empfiehlt sich: die Kachel bringt ihren eigenen
mit, und ein weißes Rechteck darauf fällt unangenehm auf.

## Drei Ebenen, und wer gewinnt

1. **Eigene Bilder** im Ordner `symbole` des Datenordners. Wer sich dort
   etwas hinlegt, sieht das und nichts anderes.
2. **Diese hier**, mitgeliefert mit dem Programm.
3. **Die eingebauten Vektoren** im Quelltext, wenn weder das eine noch das
   andere da ist.

Ein leerer Ordner ist also völlig in Ordnung — dann gelten die eingebauten.
