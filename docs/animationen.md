# Animationen

Rückmeldung: „Schau, wo Animationen sinnvoll wären, z. B. beim Speichern.“
Grundsatz: Eine Animation sagt, dass eine Aktion angekommen ist oder was sich
geändert hat. Keine Zierde, nichts, was die Bedienung aufhält.

Alles kommt aus `packages/motion`:

- `motion.css`: Zeiten, Kurven, Klassen. Jedes Werkzeug bindet sie zuerst ein.
- `@suite/motion/dom`: `spieleAb`, `feldStand`/`leuchteGeaendertes`,
  `vorDemAuffuellen`, `ausblendenUnd`.
- `@suite/motion/react`: `useWurfLeuchten`, `useWertBlitz`.
- Strg+S und das Pulsieren des Speichern-Knopfs stehen in `packages/tastatur`.

| Was | Wo | Wie |
| --- | --- | --- |
| Speichern | alle Werkzeuge mit `[data-speichern]` | Knopf pulsiert (Klick und Strg+S) |
| Fehlermeldung | alle Werkzeuge | leuchtet beim Erscheinen rot auf (`p.fehler`, `p.stoerung`, `…__fehler`, `.motion-meldung-fehler`) |
| Erfolgsmeldung | `p.meldung` überall, Export in den Story Creator (Inspirationshilfe, NPC), Sitzungsprotokoll | leuchtet grün auf, bei jedem neuen Text |
| Neu gewürfelt | NPC, Inspirationshilfe, Settlement, Magic Items, Monster | geänderte Felder (`data-wurf-feld`) leuchten kurz auf; das Feld mit dem Fokus nicht, ein anderer Eintrag (`kennung`) auch nicht |
| Schaden/Heilung | Charakterbogen (TP-Kasten), Initiative Tracker (Körper) | rot bei weniger, grün bei mehr, auch wenn die TP von woanders kommen |
| Rast | Charakterbogen | aufgefüllte Zauberplätze und Punkte ploppen kurz auf |
| Löschen | Listen in Charakterbogen, Encounter, Homebrew, Monster, Initiative, Story Creator | Eintrag blendet aus (`data-ausblenden`), dann ist er weg |
| Kalender | Raster, beste Termine, Termin | Felder färben weich um, Vorschläge kommen herein, ein festgelegter Termin leuchtet auf |
| Würfe im Bogen | Charakterbogen | Stapel unten rechts (siehe charakterbogen.md) |
| Stabil | Charakterbogen | drei Erfolge leuchten, blenden aus (siehe charakterbogen.md) |

Loot hatte schon eine gestaffelte Einblendung neuer Würfe; dort blieb es dabei.

## Weniger Bewegung

Bei `prefers-reduced-motion` fällt Bewegung (Verschieben, Skalieren) weg.
Farbe bleibt, denn sie ist die Rückmeldung. Ausblenden wird zu reinem
Verblassen, Aufploppen entfällt.

## Neue Stellen

- Fehlermeldung: Klasse `motion-meldung-fehler` geben.
- Erfolgsmeldung: `key={text}` und `motion-meldung-ok`, dann leuchtet sie bei jedem neuen Text.
- Gewürfelte Felder: `data-wurf-feld` an das Feld, `useWurfLeuchten(daten, kennung)` in die Komponente.
- Löschen in einer Liste: `data-ausblenden` an die Zeile, `onClick={(e) => ausblendenUnd(e.currentTarget, () => …)}`.
  Bei Listen mit der Stelle als Schlüssel räumt `ausblendenUnd` die Klasse danach wieder ab.
