# Konzept: Kampagnenkalender (Terminfindung wie Crab.fit)

Rückmeldung: „Kampagnenkalender gut wie Crabfit.“

**Stand:** Konzept, nichts gebaut.

## Vorbild

Crab.fit ist eine Terminfindung im Browser, ohne Konto. Soweit ich es kenne
(aus dem Gedächtnis, nicht frisch nachgesehen):
- Jemand legt einen Zeitraum an: Tage und Uhrzeitfenster.
- Alle markieren per Ziehen im Raster, wann sie können.
- Eine Heatmap zeigt, wann die meisten können; beim Darüberfahren steht da,
  wer kann und wer nicht.

## Idee

Ein Werkzeug **„Campaign Calendar“** (Name offen) mit zwei Teilen:

1. **Terminumfrage** wie Crab.fit: Die SL legt Tage und ein Zeitfenster
   fest, alle markieren ihre freien Zeiten im Raster, die Heatmap zeigt die
   besten Zeiten. Die SL legt den Termin fest.
2. **Kalender** der Kampagne: festgelegte Sitzungen, mit Verweis auf das
   Sitzungsprotokoll (`docs/sitzungsprotokoll.md`) danach. Export als
   `.ics`, damit der Termin im eigenen Kalender (Handy, Outlook) landet.

## Bedienung der Umfrage

- Raster: Spalten = Tage, Zeilen = halbe oder ganze Stunden.
- Ziehen mit der Maus markiert, erneutes Ziehen entfernt. Tastatur:
  Pfeiltasten und Leertaste (wie in `docs/tastatur.md`).
- Zwei Stufen wie bei Doodle: „kann“ und „notfalls“. (Crab.fit hat das,
  soweit ich weiß, nicht; Vorschlag von mir.)
- Heatmap in den Farben des Themas; Darüberfahren zeigt die Namen.
- „Beste Termine“: die drei Zeitfenster mit den meisten Zusagen und
  mindestens der gewünschten Dauer (z. B. 4 Stunden am Stück).
- Wer fehlt noch, steht oben.

## Das eigentliche Problem: Wie kommen die Antworten zusammen?

Crab.fit hat einen Server, auf dem alle dieselbe Seite öffnen. Wir haben
(noch) keinen. Die Möglichkeiten:

| Weg | Wie | Haken |
|---|---|---|
| **Raum** | Antworten gehen live über den Raum | Alle müssen gleichzeitig verbunden sein, heute nur LAN oder Portfreigabe |
| **Datei** | SL schickt die Umfrage als Datei (Discord, Mail), alle füllen aus und schicken zurück, die SL liest sie ein | Umständlich, aber geht sofort und ohne Server |
| **Server** | wie Crab.fit, ein Link für alle | braucht den Server aus `docs/server.md` |

Vorschlag: **Raum und Datei** jetzt bauen, den Server-Weg später
dazunehmen, wenn er kommt. Die Umfrage merkt sich alle Antworten, egal
woher sie kamen.

## Schritte

1. Werkzeug-Gerüst, Ablage, Raster mit Ziehen, eigene Verfügbarkeit.
2. Heatmap, beste Termine, Termin festlegen, `.ics`-Export.
3. Antworten über den Raum und als Datei.
4. Kalenderansicht der Kampagne, Verknüpfung mit Sitzungsprotokoll,
   Rauchtest, Doku.

## Offene Fragen

1. **Wege für die Antworten:** Raum + Datei jetzt, Server später? Oder mit
   dem Server warten?
2. **„Notfalls“ als zweite Stufe:** ja oder nein?
3. **Ingame-Kalender** (Datum in der Spielwelt, Mondphasen, Feiertage):
   gehört das hier hinein oder nicht?
4. **Wiederkehrende Termine** („jeden zweiten Freitag“): nötig?
