# Konzept: Stadt- und Ortsgenerator

Rückmeldung: „Stadt und Ortgenerator auch machen.“

**Stand:** Gebaut als `apps/orte` („Settlement Generator"), Schritte 1–4.
Nicht gebaut: Kaufen im Raum, Ortsplan, KI-Vorschläge, Personen im NPC
Creator weiterbearbeiten (sie kommen aus demselben Erzeuger, landen aber
als Notizen im Story Creator).

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

## Was aus dem SRD kommt (nachgesehen im PDF 5.2.1)

- **Ortsgrößen:** Village / Town / City (Dorf / Kleinstadt / Stadt), aus der
  Tabelle „Spellcasting Services".
- **Zauberwirken gegen Bezahlung:** Dorf bis Grad 2, Kleinstadt bis Grad 5,
  Stadt bis Grad 9, mit den Kosten der Tabelle (30 GM bis 100.000 GM).
- **Gasthaus:** Übernachtung und Mahlzeit je Lebensstil (Ärmlich bis Edel),
  dazu Bier, Brot, Käse und Wein („Food, Drink, and Lodging").
- **Magische Gegenstände kaufen:** gewöhnliche in Kleinstadt oder Stadt,
  ungewöhnliche und seltene nur in Städten („Magic Item Values by Rarity").
  Die deutsche Fassung schreibt bei gewöhnlichen „in Dörfern oder Städten";
  hier gilt die englische („in a town or city").
- **Waren und Preise:** Waffen, Rüstungen, Abenteurerausrüstung und magische
  Gegenstände mit den Preisen bzw. Werten des SRD.

## Was eine Annahme ist (so auch in der Oberfläche gekennzeichnet)

- Einwohnerzahlen je Größe.
- Welche Läden es ab welcher Größe gibt (Dorf: Krämer und Schmied mit
  einfachen Waffen; Kleinstadt und Stadt: dazu Bogner, Alchemist,
  Magieladen) und wie viele Waren sie zeigen.
- Die Qualität der Gasthäuser je Größe.

## Was ich vor dem Bau nicht wusste

- Das SRD 5.2.1 hat meines Wissens **keine Regeln** dafür, welche Waren es in
  welcher Ortsgröße gibt oder welche Seltenheit ein Magieladen führt. Die
  Grenzen wären meine Annahme, als solche gekennzeichnet und einstellbar.
- Ob es im SRD Tabellen zu Siedlungen gibt: geprüft, siehe oben. Eine
  Tabelle für Ladenwaren je Ortsgröße gibt es nicht.

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

## Entschieden

- Eigenes Werkzeug, nur Siedlungen; Kaufen im Raum und Ortsplan vorerst
  nicht (Vorschläge aus dem Konzept, keine Rückmeldung dazu).

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
