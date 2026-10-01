# Konzept: Stadt- und Ortsgenerator

Rückmeldung: „Stadt und Ortgenerator auch machen.“

**Stand:** Konzept, nichts gebaut.

## Idee

Ein Werkzeug **„Settlement Generator“** (Name offen) im Stil des NPC
Creators: Ein Klick würfelt einen ganzen Ort, einzelne Teile lassen sich
mit Schlössern festhalten und neu würfeln. Ergebnis wird eine Notiz (mit
Unternotizen) im Story Creator.

## Was gewürfelt wird

- **Größe:** Weiler, Dorf, Kleinstadt, Stadt, Großstadt. Die Größe steuert,
  wie viele Läden, Tempel und wichtige Personen es gibt.
- **Name** mit Namensklang (wie im NPC Creator).
- **Lage und Umgebung** aus `packages/umgebungen` (Küste, Gebirge, Wald …).
- **Herrschaft:** wer regiert, wie (Rat, Fürst, Gilden, Tempel …).
- **Wirtschaft:** wovon der Ort lebt, was er ausführt.
- **Besonderheit:** etwas, das man sich merkt (eine Brücke aus Knochen, ein
  Markt nur bei Neumond).
- **Problem oder Konflikt:** der Aufhänger für Abenteuer.
- **Gerüchte:** 3–6, teils wahr, teils falsch (markiert, nur für die SL).
- **Orte im Ort:**
  - Gasthaus/Taverne: Name, Wirt oder Wirtin, Spezialität, Preise.
  - Läden mit **Inventar**: Waren aus der SRD-Ausrüstung mit SRD-Preisen;
    Magieladen nur ab einer bestimmten Größe, mit Seltenheitsgrenze.
  - Tempel, Wache, Hafen usw. je nach Größe und Lage.
- **Wichtige Personen:** mit dem Erzeuger des NPC Creators gewürfelt, mit
  Rolle im Ort (Bürgermeisterin, Hehler, Priester).

## Was ich nicht weiß

- Das SRD 5.2.1 hat meines Wissens **keine Regeln** dafür, welche Waren es in
  welcher Ortsgröße gibt oder welche Seltenheit ein Magieladen führt. Die
  Grenzen wären meine Annahme, als solche gekennzeichnet und einstellbar.
- Ob es im SRD Tabellen zu Siedlungen gibt, prüfe ich vor dem Bau im PDF.
  Gibt es welche, gehen sie vor.

## Anbindung

- **Story Creator:** eine Notiz für den Ort, Unternotizen für Personen,
  Gasthaus und Läden, mit `[[Verweisen]]` und im Graphen verbunden.
- **NPC Creator:** derselbe Erzeuger für Personen; eine Person lässt sich
  dort weiterbearbeiten.
- **Loot Generator:** Ladeninventar als Tabelle („Schmiede von Rabenfurt“),
  damit man später nachwürfeln kann.
- **Charakterbogen:** im Raum aus einem Laden kaufen (Gold wird abgezogen).
  Das ist ein eigener, späterer Schritt.
- **Map Maker:** optional ein Ortsplan. Der Map Maker hat Generatoren; ob
  einer davon für Siedlungen taugt, prüfe ich vor dem Bau.
- **KI** (falls an): freie Vorschläge neben den Tabellen, wie im NPC Creator.

## Schritte

1. Tabellen und Erzeuger mit Tests (Größe steuert die Mengen).
2. Oberfläche mit Sofortwurf und Schlössern, Ablage, Hülle (Kachel, Suche,
   Teilen).
3. Läden mit Inventar und Preisen, Loot-Tabelle daraus.
4. Export in den Story Creator mit Unternotizen; KI-Vorschläge.
5. Optional: Kaufen im Raum, Ortsplan im Map Maker.

## Offene Fragen

1. **Eigenes Werkzeug** oder ein Reiter im NPC Creator? Vorschlag: eigenes
   Werkzeug, es wird zu groß für einen Reiter.
2. **Kaufen aus dem Laden** im Charakterbogen: gewünscht?
3. **Ortsplan** im Map Maker: gewünscht, oder reicht Text?
4. **Auch Orte außerhalb von Siedlungen** (Dungeon-Eingang, Ruine,
   Lichtung)? Dann eher „Ortsgenerator“ als „Siedlungsgenerator“.
