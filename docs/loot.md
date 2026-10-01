# Loot Generator (Konzept)

Eigene Zufallstabellen, verschachtelbar, und Beute nach Grad.

**Stand:** Stufe 1 bis 3 sind gebaut (`packages/tabellen`, `apps/loot`),
Stufe 4 (Beute nach Grad) geht so nicht: **das SRD 5.2.1 enthält keine
Schatztabellen nach Herausforderungsgrad** (gegen beide PDFs geprüft; sie
stehen im Spielleiterhandbuch, das nicht frei lizenziert ist). Eingebaut ist
stattdessen, was das SRD hat: die W100-Tabelle „Trinkets" / „Requisiten",
zweisprachig, schreibgeschützt, würfelbar und per `[Trinkets]` bzw.
`[Requisiten]` aus eigenen Tabellen erreichbar. Dazu die drei Tabellen
„Waffen", „Rüstung" und „Abenteurerausrüstung" aus dem Kapitel Ausrüstung,
jeder Gegenstand mit Preis, ohne Würfel (gleich wahrscheinlich), ebenfalls per
Verweis erreichbar (`[Waffen]` / `[Weapons]`). Was beim Bauen entschieden
wurde:

- **Eingabe als Zeilen.** Eine Zeile je Eintrag, die Spanne davor ist
  freiwillig (`1-3: 2d6 × 10 Kupfer`). Die Datei auf der Platte ist
  dieselbe Liste als Markdown, lesbar in jedem Texteditor.
- **Weitergeben:** die Ablagedatei genügt, kein eigenes Format.
  „Weitergeben" schreibt sie irgendwohin, „Einlesen" holt fremde herein,
  ohne etwas zu überschreiben.
- **Ohne Zurücklegen je Tabelle**, gültig innerhalb einer Wurfreihe und
  auch für verwiesene Tabellen. Ist eine Tabelle erschöpft, beginnt sie von
  vorn. Mit Spannen bleibt die Gewichtung erhalten.
- **Drei Beispieltabellen** beim allerersten Start, in der dann
  eingestellten Sprache. Bewusst als Ausnahme von „wir schreiben keine
  Tabellen": ein leeres Werkzeug ist eine hohe Hürde. Wer sie löscht,
  bekommt sie nicht wieder. Umkehrbar, falls unerwünscht.
- **Deutsche Würfel** (`2W6`) gelten wie `2d6`, im Text und als Würfel der
  Tabelle.
- **Formprüfung beim Tippen:** Lücken, doppelte Zahlen, Zahlen außerhalb
  des Würfels, unlesbarer Würfel, Verweise ins Leere und auf sich selbst.
- **Nummern von selbst:** Zeilen ohne Nummer bekommen beim Verlassen des
  Felds die nächste freie, ein leerer Würfel den passenden (`1dN`). Die
  Nummern stehen im Text und lassen sich dort ändern.
- **Würfeln gesperrt bei kaputter Form:** Lücken, doppelte Zahlen, Zahlen
  außerhalb des Würfels und ein unlesbarer Würfel sperren den Knopf, mit
  Begründung darunter. Verweise ins Leere sperren nicht.
- **Vorschläge nach „[":** passende Tabellen erscheinen unter dem Feld,
  Pfeiltasten und Enter/Tab wählen, Escape schließt.
- **Herkunft:** jedes Ergebnis hat ein aufklappbares „Woher" mit dem Baum
  der Würfe.

- **Story Creator:** „In den Story Creator" legt den Wurf als Notiz in der
  zuletzt benutzten Kampagne an, mit den beteiligten Tabellen darunter.

- **Bestand des Magic Item Generators:** die Hülle reicht Name und Seltenheit
  der abgelegten Gegenstände durch (die Werkzeuge kennen einander nicht).
  Daraus werden schreibgeschützte Tabellen „Magische Gegenstände" und je
  vorhandener Seltenheit „Magische Gegenstände (Selten)" usw., erreichbar
  per Verweis. Leere Seltenheiten fehlen mit Absicht, damit ein Verweis
  darauf sichtbar ins Leere zeigt.

Noch offen, denkbar als
Ersatz für Stufe 4, aber nicht gebaut: die SRD-Tabelle „Starting Equipment
at Higher Levels" (Gold und magische Gegenstände je Stufenbereich) als
Richtwert für Beute nach Stufe der Gruppe.

## Warum das kein weiterer Erzeuger ist

Monster Creator, NPC Creator, Status Effect Creator und Inspirationshilfe
haben alle dieselbe Form: **wir** schreiben die Tabellen, das Werkzeug würfelt
darauf. Die Tabellen stehen im Quelltext, sind zweisprachig und lassen sich
prüfen.

Hier ist es andersherum. **Die Tabellen schreibt die Spielleitung.** Das ist
der ganze Punkt und zugleich der Grund, warum das Werkzeug anders gebaut sein
muss als seine vier Geschwister:

| | die anderen vier | hier |
|---|---|---|
| Wer schreibt die Tabellen | wir, im Quelltext | die Spielleitung, zur Laufzeit |
| Zweisprachig | ja, Paar für Paar | nein — wer auf Deutsch schreibt, bekommt Deutsch zurück |
| Wo sie liegen | im Paket | in der Ablage, als Dateien |
| Was geprüft werden kann | Lücken, Doppelungen, Übersetzungen | nur die Form, nicht der Inhalt |

Daraus folgt eine Festlegung, die nicht verhandelbar ist: **eigene Tabellen
werden nicht übersetzt.** Ein Wurf auf „Beutel des Schmugglers" gibt zurück,
was dort steht, in der Sprache, in der es jemand hingeschrieben hat. Die
Oberfläche bleibt zweisprachig wie überall, der Inhalt nicht. Alles andere
hieße, den Text der Spielleitung durch eine Maschine zu schicken.

## Die Verschachtelung ist das Werkzeug

Eine flache Zufallstabelle ist ein Blatt Papier, dafür braucht niemand eine
Anwendung. Interessant wird es, wenn ein Eintrag auf eine andere Tabelle
zeigt:

    Beute einer Räuberbande (1d6)
      1-3  → 2d6 × 10 Kupfer
      4-5  → würfle auf [Taschenkram]
      6    → würfle auf [Etwas Magisches], und 1d4 × 10 Silber

    Taschenkram (1d8)
      1  Ein Kamm aus Knochen
      2  Drei Spielsteine, einer gefälscht
      …

Damit ist eine Tabelle sowohl ein Ergebnis als auch ein Baustein. Wer einmal
„Taschenkram" geschrieben hat, benutzt es in jeder Bande, jedem Wirtshaus,
jeder Leiche.

**Zwei Dinge, die die Verschachtelung mitbringt und die von Anfang an
bedacht gehören:**

- **Kreise.** A zeigt auf B, B auf A. Das ist kein Fehler der Spielleitung,
  sondern passiert beim Umbauen — und es darf die Anwendung nicht aufhängen.
  Die Tiefe wird gedeckelt (Vorschlag: zehn), und was am Deckel abbricht,
  wird als solches angezeigt und nicht verschwiegen.
- **Fehlende Ziele.** Eine Tabelle wird umbenannt oder gelöscht, ein Verweis
  darauf bleibt stehen. Das Ergebnis soll dann „[Taschenkram — gibt es
  nicht]" sagen und weiterwürfeln, nicht abbrechen. Am Tisch ist ein
  unvollständiges Ergebnis brauchbar, eine Fehlermeldung nicht.

## Würfel und Mengen

Ein Eintrag kann Würfel enthalten, und zwar an zwei Stellen:

- **Die Tabelle selbst** hat einen Würfel (`1d6`, `1d100`), und die Einträge
  haben Spannen (`1-3`, `4-5`). Wer keine Spannen will, schreibt keine — dann
  ist jeder Eintrag gleich wahrscheinlich, und das ist der Normalfall.
- **Der Text eines Eintrags** kann Würfel enthalten: `2d6 × 10 Kupfer`. Beim
  Würfeln wird das ausgerechnet und eingesetzt, wie `platzhalter.ts` es im
  Monster Creator schon tut. `packages/dice` kann den Ausdruck bereits lesen
  und werfen — nichts Neues zu bauen.

## Beute nach Grad

Der zweite Teil, und der kleinere: „die Gruppe hat einen Grad-7-Gegner
erledigt, was findet sie?" Dafür gibt es Tabellen im SRD 5.2.1, und die
Lizenzfrage ist beantwortet (siehe `NOTICE.md`).

**Das gehört nach `packages/srd/`, nicht in dieses Werkzeug** — dieselbe
Begründung wie beim Nachschlagewerk und beim Encounter Creator: drei
Werkzeuge lesen denselben Bestand, und Anwendungen hängen hier nicht
voneinander ab.

Für die Sammlung heißt das: Stufe 1 bis 3 gehen ohne SRD, Stufe 4 wartet auf
`packages/srd/`.

## Abgrenzung zum Magic Item Generator

Sie überschneiden sich an genau einer Stelle, und die ist auflösbar:

- Der **Magic Item Generator** *erzeugt* einen Gegenstand und legt ihn ab.
- Der **Loot Generator** *zieht* etwas — und wenn das etwas Magisches ist,
  soll er auf die abgelegten Gegenstände zeigen können, nicht einen eigenen
  erfinden. Gemeint sind nur die, die dort ausdrücklich „an den Loot
  Generator“ geschickt wurden (`loot: ja`), nicht jeder gespeicherte.

Also: ein Eintrag kann nicht nur auf eine andere Tabelle zeigen, sondern auch
auf einen Bestand eines anderen Werkzeugs („irgendein magischer Gegenstand
der Seltenheit *selten*"). Das ist dieselbe Form wie `packages/eintraege`,
nur in die andere Richtung gelesen — und es ist der Grund, diese Kopplung
erst zu bauen, wenn der Magic Item Generator steht. Bis dahin zeigt ein Eintrag
auf eine eigene Tabelle, und das reicht.

## Wie es an die Sammlung andockt

- **`packages/eintraege`:** jede Tabelle ist ein Eintrag. Damit findet Strg+K
  „Taschenkram", ohne dass das Werkzeug offen war.
- **Story Creator:** ein gewürfeltes Ergebnis als Notiz ablegen — dieselbe
  Brücke wie beim Monster und beim NPC.
- **Rolle `leitung`.** Beute würfelt die Spielleitung.
- **Einstellungen** über `packages/einstellungen`, wie alle.

## Zu klären

- **Ob Tabellen sich teilen lassen sollen.** Eine Tabelle als Datei
  weiterzugeben ist naheliegend und wäre schnell gebaut. Ob es ein eigenes
  Format braucht oder die Ablagedatei genügt, entscheidet sich beim Bauen der
  Ablage — nicht vorher.
- **Ob ein Wurf „ohne Zurücklegen" gehen muss.** Fünfmal auf dieselbe Tabelle
  würfeln und fünfmal dasselbe bekommen ist am Tisch ärgerlich. Die Frage ist
  nur, ob das je Wurf einstellbar sein soll oder je Tabelle. Mein Verdacht: je
  Tabelle, weil es eine Eigenschaft der Tabelle ist („die zwölf Wirtshausgäste
  sind zwölf verschiedene").
- **Ob eine Handvoll Beispieltabellen mitgeliefert wird.** Ein leeres Werkzeug
  beim ersten Start ist eine hohe Hürde. Drei kleine Beispiele wären
  freundlich — die müssten wir schreiben, also zweisprachig, und damit sind
  sie eine Ausnahme von der Regel oben. Bewusst entscheiden, nicht nebenbei.

## Ein möglicher Zuschnitt

1. **`packages/tabellen`.** Das Format einer Tabelle, das Würfeln darauf, die
   Verschachtelung mit Deckel und die freundliche Behandlung fehlender Ziele.
   Plattformfrei, rein, mit hineingereichtem `rng` — prüfbar ohne Oberfläche,
   wie `packages/eintraege`.
2. **Ablage und Oberfläche.** Tabellen anlegen, bearbeiten, würfeln. Kacheln
   und Suche baugleich zu Monster und Zustände.
3. **Verschachtelung sichtbar machen.** Ein Ergebnis zeigt, woher jedes Stück
   kam — sonst weiß man bei drei Ebenen nicht mehr, was man da würfelt.
4. **Beute nach Grad**, aus `packages/srd/`.

Stufe 1 und 2 ergeben schon das Werkzeug, das der Rückstand „am Tisch das
meistgebrauchte" meint. Stufe 3 macht es angenehm, Stufe 4 vollständig.
