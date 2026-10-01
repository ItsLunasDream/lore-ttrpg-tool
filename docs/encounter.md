# Konzept: Encounter Creator

Das Werkzeug hinter der Kachel `encounter`, die heute „später" sagt. Es
stellt eine Begegnung zusammen: welche Monster, wie viele, wo, und wie hart
das für diese Gruppe wird — und schiebt das Ergebnis in einem Zug in den
Initiative Tracker.

**Stand:** Alle fünf Stufen sind gebaut. Die Kachel ist echt, Begegnungen
lassen sich anlegen, benennen, mit einer Notiz versehen und in einer
Sammlung wiederfinden, die Monster kommen aus der eigenen Sammlung, eine
Umgebung hängt mit ihren zwei Sorten daran, „In den Tracker" schiebt das
Ganze in den Initiative Tracker, und unter den Gegnern steht die
Einordnung — aus `packages/srd` und damit aus dem Regelwerk selbst.

## Wozu

Zwischen „ich hätte gern einen Kampf" und „der Kampf läuft" liegen heute
drei Handgriffe, die alle von Hand gehen. Man sucht Monster zusammen,
schätzt im Kopf, ob das die Gruppe umbringt, und tippt sie danach im Tracker
ab. Der dritte Handgriff ist der ärgerlichste: er ist reine Abschrift von
etwas, das man schon hatte.

Genau das ist der Grund, warum das Werkzeug lohnt. Ein Encounter Creator,
der die fertige Begegnung nicht in den Tracker bekommt, spart nichts.

## Der Grundsatz

**Die Monster kommen aus der Sammlung, nicht aus einer Liste im Werkzeug.**
Der Monster Creator legt jedes Monster als Markdown-Datei in seinem Ordner
ab, mit dem Grad im Kopf. Das ist genau die Zahl, die die
Schwierigkeitsrechnung braucht. Der Encounter Creator liest diesen Ordner —
keinen Kanal zwischen zwei Werkzeugen, kein zweiter Bestand.

Dass die Ablage des Monster Creators ein eigener Ordner ist statt Notizen im
Story Creator, war schon damals mit diesem Werkzeug begründet
(`apps/monster/src/main/embed.ts`). Hier wird die Begründung eingelöst.

**Eine Begegnung ist eine Vorlage, kein Spielstand.** Der Tracker liest sie
und schreibt nicht zurück. Zwei Stände, die auseinanderlaufen, sind am Tisch
schlimmer als ein Stand, der nach dem Kampf eben nicht mehr stimmt. Wer die
Begegnung ein zweites Mal spielt, fängt bewusst wieder bei der Vorlage an.

## Was hineingeht

### Die Gruppe

Ohne sie ist „schwer" eine Behauptung. Gebraucht wird das Wenigste, das
reicht: **wie viele Spielfiguren und auf welcher Stufe.** Unterschiedliche
Stufen innerhalb einer Gruppe kommen vor, also eine kurze Liste statt einer
Zahl.

Wo das steht: im Werkzeug selbst, als aufklappbarer Abschnitt „Gruppe am
Tisch" über der Einordnung. Sie gilt für alle Begegnungen, wird also nicht
je Begegnung neu eingetippt. Ursprünglich stand sie in den Einstellungen
der Hülle; Rückmeldung: dort gehört hin, was man einmal festlegt, und die
Gruppe ändert sich öfter.

Offen: ob eine Kampagne im Story Creator ihre Gruppe mitbringen kann. Wäre
schöner, setzt aber voraus, dass Spielfiguren dort als eigener Notiztyp
erkennbar sind. **Für die erste Fassung: eigene Einstellung.**

### Die Monster

**Stand:** Ein Katalog führt die 331 Monster des SRD 5.2.1 (beide Sprachen,
aus `@suite/srd/monster`) und die eigenen aus dem Monster Creator in einer
Tabelle. Filter: Quelle (alle, offiziell, eigene), Typ, HG von–bis, nur
legendäre; sortierbar nach Name, Typ, HG, TP und RK. Ein Klick auf den Namen
zeigt den ganzen Wertekasten. Offizielle Monster tragen die Kennung
`srd:<id>` in der Begegnung.

**Zusammenstellen lassen:** Ziel als HG oder EP, optional die Zahl der
Gegner, Quelle (offiziell, eigene, gemischt) und Typ. Gegner, die schon in
der Begegnung stehen, bleiben auf Wunsch drin; so legt man Pflichtmonster
fest. Gesucht wird zufällig aus ein bis drei Monsterarten, der beste Treffer
gewinnt, unter gleich guten wird gelost. Ein HG als Ziel heißt „so viele EP
wie ein Monster dieses Grades"; das Regelwerk kennt keinen Grad für eine
ganze Begegnung, diese Übersetzung ist eine Lesehilfe. Weicht das Ergebnis
um mehr als 10 % ab oder landet es bei einem anderen Grad, steht das dabei.

Zwei Quellen, und die Reihenfolge ist Absicht:

1. **Die eigene Sammlung** aus dem Monster Creator. Das ist der Punkt, den
   du ausdrücklich wolltest, und er ist der wichtigere — wer sich ein
   Monster baut, will es auch einsetzen.
2. **Eine mitgelieferte Liste**, falls sie kommt. Dazu unten unter
   „Zu klären", denn daran hängt eine Lizenzfrage.

Gewählt wird mit Anzahl: „3× Frostwächter". Mehrere gleiche sind der
Normalfall, nicht die Ausnahme.

### Die Umgebung

**Zwei Sorten, und beide müssen vorkommen.** Das ist die Entscheidung, die
dieses Werkzeug von einer Monsterliste unterscheidet.

| Sorte | Beispiel | Wohin sie geht |
|---|---|---|
| Was man sieht | „Hohe Höhle, unten ein Wasserbecken, Hängebrücken ziehen sich hindurch." | Text zum Vorlesen, Grundlage für eine Karte |
| Was am Tisch wirkt | „Schneesturm: man sieht höchstens 30 Fuß weit." | Regel mit Zahl, als Terrain in den Tracker |

Ohne die zweite Sorte ist die Umgebung Deko. Ohne die erste ist sie eine
Tabellenzeile.

Beides ist wählbar oder gewürfelt. Die Grundlage steht schon:
`packages/umgebungen` hält sechzehn Umgebungen mit `anblick` (was man sieht)
und `regeln` (was wirkt, mit Zahl und Art). Das Paket entstand aus genau
dieser Planung; hier wird es benutzt statt ein viertes Mal gebaut.

## Die Schwierigkeitsrechnung

Der Teil, bei dem ich ehrlich sein muss.

Die Rechnung aus dem Regelwerk — Erfahrungspunkte je Grad, ein Faktor für
die Anzahl der Monster, Schwellen je Gruppenstufe — **kenne ich nicht so
belastbar, dass ich sie aus dem Kopf in Tabellen schreiben würde.** Die
Zahlen unterscheiden sich zwischen den Regelfassungen, und eine falsche
Schwelle ist schlimmer als gar keine: sie sieht aus wie eine Auskunft.

Der gangbare Weg ist derselbe wie beim Monster Creator: **eine Quelle mit
Lizenz suchen, die Zahlen von dort nehmen, und sie im Über-Dialog nennen.**
Der Monster Creator macht das bereits mit den Richtwerten je Grad (Lazy
GM's 5e Monster Builder Resource Document, CC-BY-4.0).

**Diese Frage ist inzwischen beantwortet.** Das SRD 5.2.1 steht unter
CC-BY-4.0, und die Zahlen dürfen mit der vorgeschriebenen Namensnennung
übernommen werden (siehe `NOTICE.md`). Sie gehören nach `packages/srd/`,
zusammen mit dem, was das Nachschlagewerk und der Magic Item Generator
brauchen — siehe `docs/nachschlagewerk.md`. Was bleibt, ist Fleißarbeit:
die Tabellen aus dem Dokument sauber herausholen und gegenlesen. **Der Bau
ist damit nicht mehr blockiert.**

**Beides steht jetzt da, und das ist Absicht.** Die Einordnung („Mittel")
kommt aus `packages/srd`: Erfahrungspunkte je Grad, Budget je Charakter
und Stufe, beides wörtlich aus dem Dokument. Darunter bleibt das
Verhältnis stehen — „Grade zusammen 9 gegen 4 Figuren auf Stufe 5".

Eine Einordnung allein ist eine Behauptung, die man glauben muss; daneben
die Zahlen zu sehen, aus denen sie entstanden ist, macht sie nachprüfbar.
Und wenn kein Gegner einen Grad hat, den die Tabelle kennt, ist das
Verhältnis die einzige Antwort, die dann noch ehrlich ist.

Vier Dinge daran sind Absicht:

- **Keine Ampel.** Die Einordnung färbt den Rand, nicht die Schrift, und
  rot ist nur „über hoch". Rot für „hoch" hieße, eine schwere Begegnung
  sei ein Fehler — sie ist eine Auskunft, keine Warnung.
- **„Über hoch" ist eine eigene Antwort.** Das Regelwerk kennt drei
  Budgets und hört bei „hoch" auf. Eine Begegnung mit dem Dreifachen des
  hohen Budgets weiter „hoch" zu nennen wäre eine Untertreibung, die am
  Tisch teuer wird. Wo genau die Grenze liegt, ist gesetzt und nicht
  abgeleitet; sie steht als benannte Konstante in `packages/srd`.
- **Ein Gegner ohne lesbaren Grad wird gezählt und genannt**, nicht als
  Null verrechnet. Eine Summe, in der drei Monster fehlen, sieht sonst
  genauso aus wie eine vollständige. Hat *kein* Gegner einen bekannten
  Grad, gibt es gar keine Einordnung — sonst bekäme eine Begegnung aus
  lauter selbstgebauten Monstern „unter niedrig", und das wäre gelogen.
- **Die Gruppe wird nicht geraten.** „4" könnte vier Figuren auf
  unbekannter Stufe heißen oder eine auf Stufe 4; die Zeile bleibt dann
  ungelesen, und das Werkzeug zeigt im Klartext, was es verstanden hat.

Die Gruppe wird als Zeilen aus Anzahl und Stufe eingetragen und in
`einstellungen.json` im Ordner des Werkzeugs als `Anzahl x Stufe` abgelegt,
mit Komma getrennt: `4x5` oder `3x4, 1x6`.

Eine neue Begegnung braucht keinen Namen: „Neue Begegnung" öffnet sie
sofort, und wer ohne Namen speichert, bekommt `Encounter_1`, `Encounter_2`
usw. (die kleinste freie Nummer).

**Nicht erfinden, was man nicht weiß, und es dazuschreiben.**

## Der Weg in den Initiative Tracker

Der eigentliche Zweck. Was mitwandern muss:

- **Die Monster als Teilnehmer** — Trefferpunkte, Rüstungsklasse,
  Initiative-Modifikator. Mehrere gleiche als „Wolf 1" bis „Wolf 4". Der
  Tracker hat für Gruppen gleicher Wesen schon eine Form (`koerper` je
  Teilnehmer), sie muss nur gefüllt werden.
- **Die Umgebung in ihren zwei Sorten.** Die Beschreibung als Text, die
  Gameplay-Regel als Terrain-Eintrag. `istTerrain` gibt es im Tracker
  bereits, samt Ereignissen je Runde — ein Schneesturm, der jede Runde
  wirkt, ist genau der Fall, für den das gebaut wurde.
- **Ein Verweis zurück auf die gespeicherte Begegnung**, damit ein zweiter
  Durchlauf nicht bei null anfängt.

Zwei Dinge, die dabei geklärt sein müssen, und beide sind es:

**Wenn im Tracker noch ein Kampf läuft**, kommt dieselbe Rückfrage wie bei
„Neue Begegnung". Die steht schon (`pruefeVerlust` in
`apps/initiative/src/shared/neuebegegnung.ts`) und unterscheidet bereits
zwischen „ein Kampf läuft" und „es gibt Ungespeichertes". Der Weg von außen
muss dieselbe Frage stellen, nicht eine zweite eigene.

**Zurückgeschrieben wird nicht.** Siehe Grundsatz oben.

### Wie der Weg gebaut ist

Die beiden Werkzeuge kennen einander nicht, und das bleibt so. Zwischen
ihnen steht `packages/uebergabe`: eine bewusst dünne Form aus Namen,
Zahlen und Sätzen, die beide Seiten ohne Kenntnis der anderen verstehen.
Der Encounter Creator füllt sie, die Hülle holt den Tracker nach vorn und
stellt sie zu, der Tracker baut daraus seine eigenen Teilnehmer
(`src/shared/uebernahme.ts`). Derselbe Weg wie „Karte anlegen" aus der
Inspirationshilfe.

Drei Entscheidungen, die man dem Ergebnis nicht ansieht:

- **Die Initiative wird nicht gewürfelt.** Sie steht auf null; der
  Zuschlag aus der Geschicklichkeit landet im Feinwert, den der Tracker
  ohnehin beim Auswürfeln benutzt. Eine Zahl, die von außen hereinkommt
  und aussieht wie gewürfelt, wäre schlimmer als eine leere.
- **Jede Regel wird ein eigener Terrain-Eintrag**, und die Regel steht in
  seinem Namen. Im Tracker ist der Name das einzige, was immer zu sehen
  ist — stünde dort nur „Wald", wäre die halbe Arbeit unsichtbar. Einzeln,
  weil sich ein einzelner Eintrag austragen lässt, wenn er nicht mehr
  gilt.
- **Der Kampf bekommt keine `begegnungId`.** Die Kennung gehört dem
  Encounter Creator; sie zu übernehmen hieße, dass „Speichern" im Tracker
  später in eine fremde Ablage zielt.

## Und der Karteneditor?

Die Beschreibung der Umgebung ist die Grundlage für eine Karte, und den Weg
dorthin gibt es schon: die Inspirationshilfe stößt „Karte anlegen" an, die
Hülle holt den Karteneditor nach vorn und stellt den Namen zu
(`oeffneKarteImEditor`). Derselbe Weg, dieselbe Brücke.

Für die erste Fassung ist das **nicht** nötig. Es gehört in die Liste, weil
es billig wird, sobald der Rest steht — nicht, weil es den Anfang trägt.

## Was das Werkzeug ablegt

Eine Begegnung als Markdown-Datei in einem eigenen Ordner, wie beim Monster
Creator und beim Status Effect Creator: Kopfzahlen oben, lesbarer Leib
darunter. Eine Sammlung mit Kacheln und Suche, dieselbe Handhabung wie
überall — wer sie einmal gelernt hat, soll sie nicht dreimal lernen.

## Zu klären

- ~~**Woher die Schwierigkeitszahlen kommen dürfen.**~~ Geklärt: SRD 5.2.1
  unter CC-BY-4.0, mit wörtlicher Namensnennung. Siehe oben und `NOTICE.md`.
- **Ob eine mitgelieferte Monsterliste dazukommt.** Lizenzrechtlich jetzt
  ebenfalls erlaubt; offen ist nur noch, ob sie den Aufwand wert ist. Ohne
  sie ist das Werkzeug nur für den brauchbar, der schon Monster gebaut hat
  — das ist eine echte Einschränkung, aber keine, die den Anfang
  verhindert.
- **Ob die Gruppe aus einer Kampagne kommen kann.** Siehe oben; erste
  Fassung ohne.
- **Was bei einem Monster passiert, das nach dem Speichern der Begegnung
  geändert wurde.** Die Vorlage hält einen Verweis; beim Öffnen wird neu
  gelesen. Damit ändert sich die Begegnung mit dem Monster — das ist
  gewollt. Gelöschte Monster müssen aber sichtbar fehlen und dürfen nicht
  stillschweigend verschwinden.

## Ein möglicher Zuschnitt

1. **Gerüst und Einbettung.** Die Kachel wird echt, das Werkzeug lädt, eine
   leere Begegnung lässt sich anlegen und speichern.
2. **Monster aus der Sammlung.** Lesen, suchen, mit Anzahl wählen. Ohne
   Schwierigkeitsrechnung — die Liste allein ist schon nützlich.
3. **Umgebung.** Aus `packages/umgebungen`, wählbar oder gewürfelt, beide
   Sorten sichtbar.
4. **In den Tracker.** Teilnehmer und Terrain in einem Zug, mit der
   Rückfrage bei laufendem Kampf.
5. **Schwierigkeit.** Erst das Verhältnis, später die Skala mit den Zahlen
   aus `packages/srd/`.

Stufe 4 ist der Punkt, ab dem sich das Werkzeug lohnt. Stufe 5 steht
vollständig, seit die Zahlen aus dem Dokument in `packages/srd` liegen.
