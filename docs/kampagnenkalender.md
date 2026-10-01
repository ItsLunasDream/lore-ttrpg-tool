# Konzept: Kampagnenkalender (Terminfindung wie Crab.fit)

Rückmeldung: „Kampagnenkalender gut wie Crabfit.“

**Stand:** Gebaut als `apps/kalender` („Campaign Calendar"), Schritte 1–4.
Antworten über den Raum und als Datei; der Server-Weg folgt mit dem Server
(`docs/server.md`). Nicht gebaut: Ingame-Kalender, wiederkehrende Termine.

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

## Entschieden

- Raum und Datei jetzt, Server später; zweite Stufe „Notfalls" ja; kein
  Ingame-Kalender, keine wiederkehrenden Termine (Vorschläge aus dem
  Konzept, keine Rückmeldung dazu).

## Wie es gebaut ist

- **Bewertung der Zeitfenster:** Eine Person zählt in einem Fenster der
  gewünschten Dauer nur, wenn sie in jedem Feld kann (1 Punkt) bzw.
  wenigstens notfalls kann (½ Punkt). Je Tag erscheint nur der beste
  Vorschlag, damit nicht dreimal fast derselbe Abend auftaucht.
- **Zusammenführen:** nach Namen (ohne Groß/klein), die neuere Antwort
  gewinnt. Ein festgelegter Termin geht beim Zusammenführen nicht verloren.
- **Raum:** Die Hülle legt jede Nachricht an den Kalender selbst ab, auch
  wenn der Kalender gerade zu ist (`nimmRaumNachricht`); ist er offen, lädt
  er neu. Eigene Antworten gehen beim Loslassen an alle.
- **Datei:** „Als Datei weitergeben" speichert die Umfrage mit allen
  Antworten; wer sie einliest, markiert und zurückschickt, wird beim
  Einlesen zusammengeführt.
- **Markieren:** Klick oder Rechteck ziehen; die Startzelle entscheidet:
  leer = setzen, markiert = entfernen.
- **Filter in „Alle":** Personen ausblenden, „mindestens N" und „muss dabei
  sein" (z. B. die SL). Felder, die nicht passen, sind ausgegraut; die
  besten Termine richten sich danach.
- **Sitzungslänge offen:** dann zeigen die besten Termine die
  zusammenhängenden Blöcke mit den meisten Leuten, bei Gleichstand den
  längsten.
- **Zeitzonen:** Die Umfrage merkt sich die Zone der Person, die sie anlegt
  (änderbar). Alle sehen das Raster in der eigenen Zone (aus dem System,
  änderbar); die Felder bleiben dieselben, nur Tage und Uhrzeiten sind
  umgerechnet. Ältere Umfragen ohne Zone rechnen nicht um.
- **.ics:** mit Zone in UTC, ohne Zone als „floating time".

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
