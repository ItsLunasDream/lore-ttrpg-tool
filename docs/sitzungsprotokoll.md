# Konzept: Sitzungsprotokoll

Rückmeldung: „Sitzungsprotokoll ist gut.“ (Vorschlag: Würfe, Kampfrunden und
Beute einer Sitzung landen automatisch als Notiz im Story Creator.)

**Stand:** Schritte 1–3 gebaut, in der Hülle (`apps/shell/src/main/protokoll.ts`,
`src/shared/protokoll.ts`, Dialog `Protokoll.tsx`), Rauchtest
`smoke-protokoll.cjs`. Nicht gebaut: KI-Zusammenfassung, Kurzbefehl für die
Zeile von Hand, Stufenaufstieg, Schwierigkeit/EP der Begegnung.

## Wie es gebaut ist

- **Knopf** in der Titelleiste: ○ aus, ● läuft (mit Zahl der Einträge).
  Der Dialog hat drei Zustände: beginnen, läuft (Zeile von Hand, beenden),
  Vorschau (Titel, Einträge abwählen, Zusammenfassung, Markdown-Vorschau,
  „Als Notiz anlegen" oder verwerfen).
- **Titel:** Steht im Campaign Calendar für heute ein festgelegter Termin,
  ist dessen Titel der Sitzungstitel; sonst „Sitzung N · Datum".
- **Werkzeuge** melden über den Kanal `huelle:protokoll` (die Hülle ordnet
  über den Absender zu):
  - Würfel: jeder Wurf; wichtig bei einer natürlichen 1 oder 20 auf einem
    gezählten W20 (verworfene Würfel bei Vorteil/Nachteil zählen nicht).
  - Initiative Tracker: Kampfbeginn, neue Runde, wer ausfällt (0 TP oder
    „raus"), Kampfende. Aus dem Vergleich vorher/nachher; Rückgängig ist
    kein Ereignis.
  - Encounter Creator: Begegnung mit Gegnern und Umgebung, beim Schieben in
    den Tracker.
  - Loot Generator: gewürfelte Beute (auch der Schnellwurf).
  - Charakterbogen: kurze und lange Rast, Geben von Gegenständen und Geld.
- **Raum:** Würfe anderer aus dem Chat (Zeilen mit 🎲), sonst kein Chat.
  Wer im Raum war, steht unter „Dabei".
- **Story Creator:** Notizen, die während der Sitzung offen waren.
- **Absturz:** Zwischenstand in `<userData>/protokoll/laufend.json`, beim
  nächsten Start wieder da.
- **Notiz:** Notiztyp „session", falls es ihn in der Kampagne gibt, sonst
  „note". Bekannte Notiztitel im Verlauf werden zu `[[Verweisen]]`.

## Lücken

- Würfe anderer aus dem Raum sind nie „wichtig": der Chat trägt nur den
  Text, nicht die einzelnen Würfel.
- Verdeckte Würfe der SL stehen nur im eigenen Protokoll der SL (wie
  gewünscht); wer nicht im Raum ist, bekommt fremde Würfe nicht mit.

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

Ohne Rückmeldung gelten die Vorschläge: kein Chat, alle Würfe sammeln und
nur die wichtigen im Verlauf, jede Person kann ein Protokoll führen.

1. **Chat mitschreiben?** Ja / nein / nur markierte Nachrichten.
2. **Alle Würfe oder nur besondere?** Bei vielen Würfen wird die Liste lang.
   Vorschlag: alle sammeln, in der Notiz nur Kampf, Beute, 1 und 20 und
   markierte Würfe; der Rest eingeklappt.
3. **Nur die SL oder alle?** Vorschlag: jede Person kann, die SL ist der
   Normalfall.
