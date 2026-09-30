# Konzept: Tiergestalten (Wild Shape) und verwandte Listen

Rückmeldung: „Druid Wildshape List. Hier soll man mögliche Druid Wildshapes
sehen, auch Moon Druid. Gibt es vielleicht für andere Klassen einen
ähnlichen Bedarf?"

**Stand:** Konzept, nichts gebaut. Die Regelangaben unten stammen aus dem
Gedächtnis und sind **vor dem Bau gegen das SRD 5.2.1 (PDF) zu prüfen**,
besonders die Stufentabelle der Tiergestalt. Ich kann mich dort irren.

## Kurz

Keine eigene App, sondern ein **Filter über die Tiere, die schon im
Nachschlagewerk stehen** (`packages/srd`, 91 Einträge mit `typ: "beast"`),
plus eine Anbindung an den Charakterbogen: Stufe und Klasse der Figur legen
den Filter fest, ein Klick auf eine Gestalt zeigt den Wertekasten und kann
ihn für die Dauer der Verwandlung neben den Bogen legen.

## Was das SRD hergibt und was nicht

- **Druide und Tiergestalt** stehen im SRD 5.2, ebenso die Tiere mit HG,
  Größe, Bewegung (als Text, z. B. „Fly 60 ft.") und Wertekasten.
- **Zirkel des Mondes (Moon Druid) steht nicht im SRD.** Das SRD enthält je
  Klasse nur eine Unterklasse; beim Druiden ist es meines Wissens der Zirkel
  des Landes. Texte und Regeln des Mondzirkels dürfen wir deshalb nicht
  mitliefern.
- Ausweg, der die Lizenz nicht berührt: eine **eigene Grenze** „Höchster HG"
  und „Flug erlaubt ab Stufe", frei einstellbar und als Hausregel
  speicherbar. Wer einen Mondzirkel spielt, trägt die Werte aus dem eigenen
  Buch ein. Die App nennt den Zirkel dabei nicht beim Namen.

## Regeln, die der Filter braucht (zu prüfen)

Tiergestalt nach 2024er Regeln, wie ich sie in Erinnerung habe:

| Druidenstufe | Bekannte Gestalten | Höchster HG | Flug |
| --- | --- | --- | --- |
| 2 | 4 | 1/4 | nein |
| 4 | 6 | 1/2 | nein |
| 8 | 8 | 1 | ja |

Temporäre TP beim Verwandeln in Höhe der Druidenstufe; Dauer bis zur
Hälfte der Stufe in Stunden. **Alles prüfen, bevor es in Code geht.**

## Oberfläche

- **Liste** aller Tiere, gefiltert nach: erlaubt für diese Stufe, HG,
  Größe, Bewegungsart (Laufen, Klettern, Schwimmen, Fliegen, Graben),
  Sinne (Dunkelsicht, Blindsicht). Sortierbar nach HG, TP, RK.
- **Bekannte Gestalten** markieren (Stern). Der Druide kennt nur eine
  begrenzte Zahl; die Liste zeigt „4 von 4 gewählt".
- **Vergleich**: zwei oder drei Gestalten nebeneinander (RK, TP,
  Bewegung, bester Angriff). Häufigste Frage am Tisch: „Was nehme ich
  zum Schwimmen?"
- **Verwandeln**: legt die Gestalt als Kasten neben den Bogen, mit
  temporären TP und einem Knopf „Zurückverwandeln". Im Raum sieht die SL
  die aktuelle Gestalt der Figur.

## Andere Klassen mit ähnlichem Bedarf

| Wer | Was | Im SRD? | Umsetzung |
| --- | --- | --- | --- |
| Alle mit *Vertrauten finden* (Magier, Hexenmeister) | Tiere mit HG 0 | Zauber ja | derselbe Filter, feste Grenze HG 0 |
| *Verwandlung* (Polymorph) | Tier mit HG ≤ Stufe des Ziels | ja | Filter mit HG-Grenze aus dem Ziel |
| *Tiergestalten* (Animal Shapes) | Tiere bis HG 4, höchstens groß | ja | fester Filter |
| *Wahre Verwandlung*, *Gestaltwandel* | beliebige Kreaturen bis HG | ja | Filter über alle Monster, nicht nur Tiere |
| *Reittier finden* | feste Gestalten | ja | kurze Liste, kein Filter nötig |
| Waldläufer mit Tiergefährte | eigener Wertekasten | nein (Unterklasse nicht im SRD) | nicht mitliefern; eigener Wertekasten im Monster Creator |

Daraus folgt: gebaut wird **ein Gestalten-Filter mit Voreinstellungen**
(„Tiergestalt Stufe 4", „Vertrauter", „Verwandlung bis HG 5"), nicht fünf
Werkzeuge. Eigene Voreinstellungen lassen sich speichern.

## Wo es sitzt

- Im **Nachschlagewerk** als Ansicht „Gestalten" über die Monsterdaten.
- Im **Charakterbogen** als Knopf bei der Klasse, der das Nachschlagewerk
  mit dem passenden Filter öffnet. Die Werkzeuge kennen einander nicht; die
  Hülle reicht den Filter durch, wie bei den Inventarquellen.
- In der **Suche (Strg+K)** über den Begriff „Tiergestalt" / „Wild Shape".

## Schritte

1. Tierdaten um maschinenlesbare Bewegungsarten ergänzen (aus dem
   Bewegungstext).
2. Filter und Voreinstellungen im Nachschlagewerk, Tests gegen die
   geprüfte Stufentabelle.
3. Anbindung Charakterbogen: Knopf, Verwandeln, temporäre TP.
4. Im Raum: aktuelle Gestalt für die SL sichtbar.

## Offene Fragen

1. Soll „Verwandeln" die TP im Bogen wirklich ändern (temporäre TP) oder
   nur anzeigen?
2. Eigene Tiere aus dem Monster Creator mit in die Liste?
