# Konzept: Kompaktansicht im Charakterbogen

Rückmeldung: „Abgespeckter Character Sheet mit HP, Temp HP, Spell Slots,
Hit Dice, AC, und wichtig hier das Inventar. Alles davon soll mit Share
geteilt oder sogar live synchronisiert werden können."

Entschieden: **kein eigenes Werkzeug**, sondern eine Ansicht des
bestehenden Charakterbogens (`docs/charakterbogen.md`). Die Daten, das
Speichern und die Live-Synchronisation im Raum gibt es schon; es fehlt nur
eine Ansicht, die am Tisch in eine Ecke passt.

**Stand:** Konzept, nichts gebaut.

## Was die Kompaktansicht zeigt

Eine Spalte, von oben nach unten nach Häufigkeit im Kampf:

1. **TP**: aktuell / Maximum, temporär; darunter drei Knöpfe
   „Schaden", „Heilen", „Temp" mit Zahlfeld (Enter wendet an).
2. **RK** und **Initiative**, groß.
3. **Zauberplätze** je Grad als Punkte zum Anklicken (wie im Bogen).
4. **Trefferwürfel**: übrig / gesamt, Knopf „Kurze Rast".
5. **Zustände** als Chips (nur anzeigen, Ändern im vollen Bogen).
6. **Inventar**: Namen mit Anzahl, aufklappbar wie im vollen Bogen;
   Gewicht und Wert nur als Summe unten. Gruppeninventar als zweiter
   Reiter.

Alles andere (Attribute, Fertigkeiten, Merkmale) fehlt bewusst. Ein
Knopf „Voller Bogen" wechselt zurück.

## Umschalten und Größe

- Umschalter oben rechts im Bogen: **Voll / Kompakt**. Gemerkt je Bogen.
- Die Kompaktansicht ist schmal genug für ein halbes Fenster (ab ca.
  320 px) und für ein Tablet hochkant.
- Optional: **eigenes kleines Fenster** („Abreißen"), das über anderen
  Werkzeugen liegen bleibt. Das braucht ein zweites Fenster in der Hülle;
  deshalb als eigener, späterer Schritt.

## Teilen und Live

Nichts Neues nötig: Die Ansicht liest und schreibt denselben Bogen, der im
Raum schon live läuft. Änderungen in der Kompaktansicht gehen denselben
Weg (Freigabe, SL-Markierung, Geben). Für Spieler:innen, die nur die
Kompaktansicht nutzen, gilt:

- **Geben** aus dem Inventar bleibt erreichbar (Rechtsklick oder Knopf
  an der Zeile).
- Die SL sieht in ihrer Übersicht aller Bögen standardmäßig die
  Kompaktansicht je Figur, nebeneinander. Das ist der eigentliche Gewinn:
  eine Zeile pro Figur mit TP, RK, Plätzen.

## Schritte

1. Ansicht „Kompakt" im Bogen, mit Umschalter; Tests für Schaden, Heilen,
   Temp (Temp wird zuerst verbraucht).
2. SL-Übersicht: alle Bögen im Raum als Kompaktkarten nebeneinander.
3. Später: abreißbares Fenster.

## Offene Fragen

1. Soll „Schaden" auch Konzentration abfragen (Hinweis „Konzentration:
   RW SG …")?
2. Soll die Kompaktansicht die Standardansicht für Spieler:innen im Raum
   sein?
