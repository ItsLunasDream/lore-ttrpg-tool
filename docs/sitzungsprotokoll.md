# Konzept: Sitzungsprotokoll

Rückmeldung: „Sitzungsprotokoll ist gut.“ (Vorschlag: Würfe, Kampfrunden und
Beute einer Sitzung landen automatisch als Notiz im Story Creator.)

**Stand:** Konzept, nichts gebaut.

## Idee

Die Hülle schreibt während einer Sitzung mit, was in den Werkzeugen
passiert. Am Ende wird daraus eine Notiz im Story Creator: „Sitzung 12 ·
1. Oktober 2026“ mit Zeitleiste und Zusammenfassung. Niemand muss
nebenher Notizen tippen.

## Bedienung

- In der Hülle ein Knopf **„Sitzung beginnen“** (neben Teilen). Läuft eine
  Sitzung, zeigt die Schiene einen kleinen roten Punkt und die Dauer.
- **„Sitzung beenden“** öffnet eine Vorschau: Einträge abhaken oder
  streichen, Titel ändern, dann „Als Notiz anlegen“.
- Ohne begonnene Sitzung wird nichts mitgeschrieben.
- Mitten in der Sitzung: eine Zeile von Hand dazuschreiben („Die Gruppe
  verbündet sich mit den Schmugglern“). Kurzbefehl, damit es schnell geht.

## Was mitgeschrieben wird

| Quelle | Eintrag |
|---|---|
| Würfel | Wurf mit Ausdruck und Ergebnis, wer geworfen hat; Höchst- und Tiefstwurf markiert |
| Initiative Tracker | Kampf begonnen/beendet, Anzahl Runden, wer fiel oder bewusstlos wurde |
| Encounter Creator | welche Begegnung, Schwierigkeit, EP |
| Loot Generator | gewürfelte Beute |
| Charakterbogen | Gegenstände gegeben, Rasten, Stufenaufstieg (falls gebaut) |
| Raum | wer da war; Chat **nur auf Wunsch** (siehe Fragen) |
| Story Creator | Notizen, die während der Sitzung angelegt oder geöffnet wurden, als Verweise `[[…]]` |

Die Werkzeuge kennen das Protokoll nicht. Sie melden schon heute vieles an
die Hülle (Würfe in den Raum, Tracker, Geben). Die Hülle hängt sich dort ein
und schreibt mit, so wie bei der Suche und den Inventarquellen.

## Die Notiz

```
# Sitzung 12 · 1. Oktober 2026
Dabei: Alex (SL), Mira, Jo, Sam · 19:05–22:40

## Zusammenfassung
(von Hand oder, wenn die KI an ist, als Vorschlag zum Bearbeiten)

## Verlauf
- 19:20 Kampf gegen [[Goblinbande]]: 4 Runden, Schwierigkeit mittel, 200 EP
- 19:41 Mira würfelt eine 20 (Angriff)
- 20:10 Beute: 34 GM, [[Trank der Heilung]]
- 21:02 Notiz: Die Gruppe verbündet sich mit den Schmugglern
```

- Verweise auf vorhandene Notizen werden zu `[[Wiki-Links]]`, damit die
  Sitzung im Graphen hängt.
- Ein Ordner/Notiztyp „Sitzung“, damit alle Sitzungen nebeneinander stehen.
- Die KI-Zusammenfassung ist ein Vorschlag, nie automatisch übernommen.

## Wer was sieht

- Verdeckte Würfe der SL („an DM“) stehen nur im Protokoll der SL.
- Spielende können ein eigenes Protokoll führen; es enthält nur, was sie
  selbst gesehen haben.

## Schritte

1. Mitschreiben in der Hülle: Start/Stopp, Einträge im Speicher, Absicherung
   gegen Absturz (Zwischenstand auf die Platte).
2. Quellen anschließen: Würfel, Tracker, Encounter, Loot, Bogen, Raum.
3. Vorschau und Notiz im Story Creator; Notiztyp „Sitzung“.
4. KI-Zusammenfassung (optional), Rauchtest, Doku.

## Offene Fragen

1. **Chat mitschreiben?** Ja / nein / nur markierte Nachrichten.
2. **Alle Würfe oder nur besondere?** Bei vielen Würfen wird die Liste lang.
   Vorschlag: alle sammeln, in der Notiz nur Kampf, Beute, 1 und 20 und
   markierte Würfe; der Rest eingeklappt.
3. **Nur die SL oder alle?** Vorschlag: jede Person kann, die SL ist der
   Normalfall.
