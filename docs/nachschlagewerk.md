# Nachschlagewerk

Die Regeln offline dabei haben — die offiziellen und die eigenen —, in
derselben Suche wie alles andere.

**Stand:** Das ganze Regelglossar des SRD 5.2.1 ist drin: 155 Einträge,
wörtlich in beiden Sprachen, gruppiert nach Regeln, Zuständen, Aktionen,
Wirkungsbereichen, Gefahren und Haltungen. Tabellen stehen als Tabellen da,
Listen, die Einträge nennen („Aktionen", „Zustände"), sind anklickbar, und
„Siehe auch" führt als Knopf zum Ziel. Suche im Namen *und* im Text, auf
Wunsch beide Sprachfassungen nebeneinander; Strg+K findet alle 155.
Querverweise sind gebaut: kuratierte Begriffe (`@suite/srd/verweise`) werden
im Text erkannt, nur beim ersten Vorkommen und nie im eigenen Eintrag;
Darüberfahren zeigt eine Vorschau, ein Klick öffnet. Anders als im Story
Creator reicht ein einfacher Klick (Strg+Klick geht auch): hier wird nur
gelesen, nicht geschrieben.

Zauber sind gebaut (Stufe 7): alle 339, beide Sprachen,
mit Grad, Schule und Klassen unter dem Namen und den vier Eigenschaften
(Zeitaufwand, Reichweite, Komponenten, Wirkungsdauer) vor dem Text. 317
automatisch gepaart, 25 von Hand.

Ausrüstung ist gebaut (Stufe 7, Rest): das ganze Kapitel, 180 Einträge in
beiden Sprachen, von Münzen über Waffen, Eigenschaften, Meisterschaften,
Rüstung, Werkzeug und Abenteuerausrüstung bis zu Reittieren, Lebenshaltung,
Diensten und dem Herstellen; dazu die drei Infokästen („Ausrüstung
verkaufen", „Improvisierte Waffen", „Zaubern in Rüstung") als eigene
Einträge. Unter dem Namen steht der Abschnitt („Schwer · Eigenschaften").
Alle 15 Tabellen stehen bei ihrem Eintrag, nicht wo der Druck Platz hatte,
und haben in beiden Sprachen dieselbe Form; die Waffentabelle mit sechs
Spalten und den Zwischenzeilen („Einfache Nahkampfwaffen") über die ganze
Breite. 64 automatisch gepaart, 116 von Hand (die Einheiten, Pfund gegen
Kilogramm, lassen die Zahlen selten übereinstimmen). Grenze: die
Zwischenköpfe „Other Tools" / „Anderes Werkzeug" fallen weg; die Werkzeuge
darunter sind vollständig da.

Magische Gegenstände sind gebaut (Stufe 6): alle 258 aus dem SRD 5.2.1,
beide Sprachen, mit der gedruckten Zeile unter dem Namen („Wundersamer
Gegenstand, selten (erfordert Einstimmung)"), Tabellen als Tabellen und
Wertekästen zeilentreu. Gepaart sind 106 automatisch und 152 von Hand, die
Tabellen beider Sprachen haben nachweislich dieselbe Form (siehe
`packages/srd/werkzeug/README.md`). Grenzen: Absätze innerhalb eines
Gegenstands werden zu einem zusammengezogen (wie im Glossar), und die
Wertekästen stehen als Zeilen da, nicht als Statblock.

Hausregeln sind gebaut: „+ Hausregel" in der Liste oder „Hausregel dazu" an
einer offiziellen Regel. Sie liegen als Markdown unter
`<Datenordner>/nachschlagewerk/hausregeln/`, stehen in der Liste ganz oben,
werden von Strg+K gefunden und nicht übersetzt. Zeigt eine Hausregel auf
eine offizielle Regel, trägt diese die Marke „An diesem Tisch gilt: …".
`[[Name]]` in einer Hausregel verweist auf einen Eintrag; ein Verweis ins
Leere ist rot gewellt statt still Text.

Notizen am Text sind gebaut: Text markieren, „Notiz" klicken, schreiben.
Verankert am Block, am ausgewählten Text und am wievielten Vorkommen, nicht
an Zeichenpositionen; abgelegt in `<Datenordner>/nachschlagewerk/notizen.json`.
Die Stelle ist hinterlegt, ein Klick darauf öffnet die Notiz. Unter dem
Eintrag stehen alle seine Notizen, auch die, deren Stelle nicht mehr
gefunden wird (rot markiert). Strg+K findet Notizen über ihren Text; der
Treffer öffnet den Eintrag und rollt zur Stelle. Noch nicht an Tabellen
oder Listen.

## Wofür es da ist — und wofür nicht

Gute Nachschlagewerke zum SRD gibt es im Netz reichlich, und sie sind besser
gepflegt, als dieses es je sein wird. Zwei Dinge können sie nicht:

> **Offline, und in derselben Suche wie die eigenen Monster, Zustände und
> Begegnungen.**
>
> **Und die Hausregeln stehen daneben, an der Regel, die sie ändern.**

Der zweite Punkt ist der stärkere. Offline zu sein ist am Tisch ohne WLAN
etwas wert, aber es ist Bequemlichkeit. Dass die eigene Krit-Regel genau
dort auftaucht, wo jemand „Critical Hit" nachschlägt, ist es nicht — das
löst ein Problem, das jeder Tisch hat und niemand gelöst bekommt, weil
Hausregeln immer irgendwo anders liegen als die Regeln, die sie ändern.

Ohne diese beiden Gründe braucht niemand diese Anwendung, und das gehört so
gesagt, bevor jemand anfängt, mehrere hundert Seiten zu erfassen.

Der zweite Nutzen ist nach innen gerichtet: dieselben Daten tragen die
Eichung des Magic Item Generators (`docs/magicitems.md`) und die
Schwierigkeitszahlen des Encounter Creators (`docs/encounter.md`). Das
Nachschlagewerk ist die sichtbare Seite eines Bestands, den es ohnehin
geben muss.

## Der Regeltext steht zweisprachig da

**Diese Entscheidung ist revidiert.** Sie lautete ursprünglich „der
Regeltext bleibt englisch", und der Grund war ein sachlicher: das SRD gebe
es nur auf Englisch, und maschinell übersetzt wäre er genau dort falsch, wo
es weh tut — bei Zahlen, Bedingungen, Wirkungsdauern und Reichweiten.

**Die Voraussetzung stimmt nicht mehr.** Das Systemreferenzdokument 5.2.1
liegt in einer offiziellen deutschen Fassung vor, unter derselben Lizenz.
Damit fällt der einzige Einwand weg: es wird nicht übersetzt, sondern beide
Fassungen werden wörtlich übernommen. Beide liegen unter
`packages/srd/quelle/`.

Also:

- **Die Oberfläche** ist zweisprachig wie überall — Knöpfe, Überschriften,
  Kategorien, Suchfeld.
- **Der Regeltext** ebenfalls, als `Paar {de, en}` wie jeder andere Text in
  dieser Sammlung. Er folgt der Sprache der Hülle.
- **Übersetzt wird nichts selbst.** Was in keiner der beiden Fassungen
  steht, steht auch hier nicht. Eine selbstgebaute Übersetzung wäre genau
  der Fehler, den der ursprüngliche Einwand beschrieben hat.

Eine Sache bleibt davon übrig und ist wichtig: **die englische Fassung ist
das Maßgebliche.** Bei einer Abweichung zwischen beiden gilt sie, und die
deutsche ist eine Übersetzung — das steht so in keinem der beiden
Dokumente, ist aber die übliche Annahme und die sicherere.

### Woran man merkt, dass die Übernahme stimmt

Der Text wird aus den beiden PDFs ausgelesen, nicht abgetippt. Dabei
entstehen Fehler, die man nicht sieht, wenn man nicht danach sucht: die
Zweispaltigkeit trennt Wörter mit Bindestrichen, der Seitenkopf rutscht
mitten in einen Absatz, ein Eintrag läuft in den nächsten hinein, und in
Zahlen landen Leerzeichen — „11, 50 0" statt 11.500.

Deshalb prüft `packages/srd` nicht nur Werte, sondern die Übernahme selbst:
dass beide Sprachfassungen gleich viele Absätze haben, dass kein Eintrag
Text des nächsten trägt, dass keine Seitenkopfreste darin stehen. **Zwei
Fassungen zu haben ist dabei der beste Schutz** — eine Zahl, die in beiden
gleich dasteht, ist mit ziemlicher Sicherheit richtig gelesen.

## Was hinein soll, und was nicht

Nicht das ganze SRD. Das Dokument hat über 350 Seiten, und der größte Teil
davon wird am Tisch nie nachgeschlagen. Was man mitten im Spiel sucht, ist
ein schmaler Ausschnitt:

| Drin | Warum |
|---|---|
| **Zustände** | Das Meistgesuchte überhaupt, und kurz |
| **Regel-Glossar** | „Was heißt nochmal Cover?" — genau dafür |
| **Zauber** | Lang, aber ständig gebraucht |
| **Magische Gegenstände** | Trägt zugleich die Eichung für den Magic Item Generator |
| **Ausrüstung** | Waffeneigenschaften, Reichweiten, Preise |

| Draußen | Warum |
|---|---|
| **Klassen, Talente, Herkünfte** | Schlägt man bei der Erschaffung nach, nicht im Kampf — und dafür hat man Zeit und ein Browserfenster |
| **Monster** | Der Monster Creator ist das Werkzeug dafür. Eine mitgelieferte Monsterliste wäre eine eigene Entscheidung, siehe unten |

Das ist grob ein Drittel des Dokuments und der Großteil des Nutzens.

## Wo die Daten liegen

**`packages/srd/`, und zwar von Anfang an.**

Das ist die eine Entscheidung, die jetzt fällt und später teuer wäre. Drei
Werkzeuge brauchen denselben Bestand:

- das Nachschlagewerk den Text,
- der Magic Item Generator die Gegenstände als Eichpunkte,
- der Encounter Creator die Schwierigkeitszahlen.

Läge er in der Anwendung, die ihn zuerst braucht, hätten die anderen beiden
entweder eine Kopie oder eine Abhängigkeit auf eine Anwendung — und
Anwendungen hängen hier nicht voneinander ab, das ist Konvention 7.

Das Paket ist plattformfrei wie alle unter `packages/`: nur Daten und reine
Funktionen. Die Form ist Markdown im Text und getippte Tabellen für alles,
was gerechnet wird — dieselbe Teilung wie im Monster Creator zwischen
`richtwerte.ts` (Zahlen) und den Fähigkeitstexten.

## Wie es an die Sammlung andockt

Nichts Neues zu bauen. Das Nachschlagewerk beantwortet die zwei Sätze aus
`packages/eintraege`:

    „Gib mir deine Einträge."
    „Zeig mir diesen Eintrag."

Damit taucht es in Strg+K auf, ohne dass die Hülle etwas über es lernt.

**Das ist zugleich das beste Argument für die Anwendung.** Die Suche über
alles wird erst dann richtig etwas wert, wenn „poisoned" den offiziellen
Zustand *und* den eigenen findet, den man vor drei Monaten gebaut hat. Heute
sucht sie nur im Selbstgebauten.

Zwei weitere Kleinigkeiten:

- **Rolle `alle`, nicht `leitung`.** Ein Nachschlagewerk brauchen Spielende
  genauso, und die Kachelseite gruppiert danach (#134).
- **Es schreibt doch.** Der offizielle Bestand ist unveränderlich, die
  Hausregeln sind es nicht — siehe den nächsten Abschnitt. Damit braucht das
  Werkzeug eine Ablage wie die anderen, und es gehört in die Sicherung.

## Hausregeln stehen neben den offiziellen

**Das ist der Teil, der aus einem Nachschlagewerk ein Werkzeug macht.**

Jeder Tisch hat eigene Regeln: wie kritische Treffer gewürfelt werden, was
bei einer langen Rast sonst noch geht, ob man aus dem Liegen aufstehen darf
und wie teuer das ist. Heute stehen die irgendwo — in einer Notiz, in einem
Kanal, im Kopf der Spielleitung. Genau dort sucht sie am Spielabend niemand.

Also bekommt das Werkzeug einen zweiten Bestand: **Hausregeln, selbst
geschrieben, neben den offiziellen und in derselben Liste.**

### Die wichtigste Eigenschaft: sie hängen an der offiziellen Regel

Zwei getrennte Listen wären die naheliegende und die falsche Lösung. Wer
„Critical Hit" nachschlägt, liest die offizielle Regel, nickt, und vergisst,
dass am eigenen Tisch seit einem Jahr etwas anderes gilt. Der Fehler ist
nicht, dass die Hausregel fehlt — sie steht ja da, eine Liste weiter. Der
Fehler ist, dass niemand an der Stelle danach sucht.

Deshalb: **eine Hausregel darf auf die offizielle Regel zeigen, die sie
ändert.** Steht so ein Verweis, dann trägt die offizielle Regel eine
sichtbare Marke — „an diesem Tisch gilt etwas anderes" — mit einem Sprung
dorthin. Eine Hausregel ohne Verweis ist auch in Ordnung; nicht jede Regel
ändert eine vorhandene, manche kommt einfach dazu.

### Was dabei zu beachten ist

- **Nicht übersetzen.** Dieselbe Festlegung wie beim Loot Generator
  (`docs/loot.md`): was die Spielleitung schreibt, kommt so zurück, wie sie
  es geschrieben hat. Der offizielle Text ist englisch, eine Hausregel darf
  deutsch sein, und beide stehen nebeneinander. Das sieht gemischt aus und
  ist trotzdem richtig — die Alternative wäre, den Text der Spielleitung
  durch eine Maschine zu schicken.
- **Der offizielle Bestand bleibt unangetastet.** Eine Hausregel überschreibt
  nie, sie legt sich daneben. Sonst weiß nach einem halben Jahr niemand mehr,
  was die Regel eigentlich sagt und was der Tisch daraus gemacht hat — und
  genau das braucht man, wenn jemand Neues mitspielt.
- **Hausregeln sind Einträge** wie alles andere (`packages/eintraege`). Strg+K
  findet sie neben der offiziellen Regel, dem eigenen Zustand und dem eigenen
  Monster.
- **Markdown**, wie überall. Eine Hausregel ist ein Text mit Namen, kein
  Formular.

## Querverweise mit Vorschau

Regeln verweisen ständig aufeinander. „Grappled" steht im Text von
„Restrained", „difficult terrain" in einem halben Dutzend anderer Regeln,
und eine Hausregel zum kritischen Treffer ist ohne die offizielle daneben
nur die halbe Antwort. Wer dafür jedes Mal die Liste hochscrollt, hat das
Werkzeug schon verloren.

**Es soll sich verhalten wie im Story Creator:** ein Verweis ist
hervorgehoben, beim Darüberfahren kommt eine Karte mit einer Vorschau des
Ziels, und erst Strg+Klick wechselt wirklich die Seite. Das ist dort
gebaut und bewährt (`InfoCard`, `wikiLinkExtension`), und es ist dieselbe
Handhabung — wer sie einmal gelernt hat, soll sie nicht zweimal lernen.

### Zwei Sorten Verweis, und warum

Der Unterschied zum Story Creator ist der Bestand: dort schreibt man jeden
Text selbst, hier ist der offizielle Regeltext **unveränderlich und
wörtlich**. `[[Grappled]]` in einen SRD-Absatz zu schreiben hieße, ihn zu
ändern — genau das darf nicht passieren (siehe Namensnennung).

Deshalb zwei Mechanismen:

- **Im offiziellen Text: erkannt, nicht geschrieben.** Beim Anzeigen wird
  der Text gegen eine gepflegte Liste von Begriffen geprüft und die Treffer
  werden zu Verweisen. **Die Datei auf der Platte bleibt Zeichen für
  Zeichen, wie sie war.** Die Liste gehört zu `packages/srd/` und ist eine
  bewusste Auswahl, keine Ableitung aus allen Einträgen.
- **In Hausregeln und Notizen: `[[Name]]`**, genau wie im Story Creator,
  mit derselben Vorschlagsliste beim Tippen. Diese Texte gehören dem Tisch,
  dort darf geschrieben werden.

### Die Gefahr ist das Zuviel

Ein automatischer Verweis auf jedes Vorkommen jedes Begriffs macht aus
einem Regeltext ein blaues Feld. Drei Regeln dagegen, und sie sind nicht
verhandelbar:

- **Nur kuratierte Begriffe.** Zustände, definierte Spielbegriffe,
  benannte Aktionen. Nicht „action", nicht „damage", nicht jedes Wort, das
  zufällig auch ein Eintrag ist.
- **Nur das erste Vorkommen je Abschnitt.** Wer „Prone" dreimal in vier
  Zeilen liest, braucht nicht dreimal denselben Verweis.
- **Nie im eigenen Eintrag.** Der Text von „Prone" verweist nicht auf
  „Prone". Das klingt selbstverständlich und ist der Fehler, den solche
  Verfahren zuerst machen.

### Was in der Vorschau steht

Dasselbe Prinzip wie die Kurzinfo im Story Creator: **genug, um die Frage
zu beantworten, ohne die Seite zu wechseln.** Name, Art, die ersten Sätze
des Textes. Dazu eine Marke, wenn an der offiziellen Regel eine Hausregel
hängt — sonst liest man in der Vorschau die offizielle und handelt am Tisch
nach der falschen.

Eine Regel, deren Text ohnehin vier Zeilen hat, steht vollständig in der
Karte. Ein Zauber nicht; dort ist die Vorschau ein Anfang und der Klick der
Rest.

### Was noch zu klären ist

- **Ob ein Verweis das Werkzeug verlassen darf.** „Poisoned" gibt es
  offiziell und womöglich auch als eigenen Status Effect. Beides in einer
  Vorschau zu zeigen wäre stark — aber die Anwendungen hängen nicht
  voneinander ab, und die Vorschau müsste über die Hülle laufen. Erste
  Fassung: nur der eigene Bestand. Der Weg dorthin steht, falls es sich
  lohnt (`packages/eintraege`, derselbe Weg wie Strg+K).
- **Was bei einem Verweis ins Leere passiert.** Im Story Creator ist ein
  unaufgelöster Verweis sichtbar anders eingefärbt, und das ist richtig.
  Bei einer gelöschten Hausregel gilt dasselbe: **sichtbar kaputt ist
  besser als stillschweigend Text.**
- **Ob die Vorschau auch an der Trefferliste der Suche hängt.** Naheliegend,
  aber ein eigener Schritt.

## Notizen am Text

Neben den Hausregeln, die für sich stehen, gibt es das Kleine: eine
Bemerkung, die an **einer Stelle** im Regeltext hängt. „Wir würfeln das
anders", „hier hat Jan letztes Mal nachgefragt", „gilt bei uns nur im
Kampf".

So soll es gehen: **Textabschnitt auswählen, Notiz schreiben.** Die Stelle
bleibt danach dezent hinterlegt, und wer darüberfährt, sieht die Notiz.
Über Sitzungen hinweg gespeichert.

### Warum das neben den Hausregeln steht und sie nicht ersetzt

Es sind zwei verschiedene Dinge, und beide zu haben ist kein Luxus:

- Eine **Hausregel** ist eine Ansage an den Tisch. Sie hat einen Namen, man
  schickt sie herum, sie steht für sich.
- Eine **Notiz** ist eine Randbemerkung. Sie hat keinen Namen, sie gehört
  an genau diese Zeile, und sie geht niemanden außer einen selbst etwas an.

Wer nur Hausregeln hätte, schriebe Randbemerkungen als winzige Hausregeln —
und die Liste wäre nach einem Monat unbenutzbar.

### Woran eine Notiz hängt

**Das ist der Teil, der schiefgehen kann, und er gehört vor dem Bauen
entschieden.** Eine Notiz an „Zeichen 214 bis 263" zu hängen ist die
naheliegende Lösung und die zerbrechliche: sobald der Regeltext einmal neu
erfasst wird — ein Tippfehler raus, ein Absatz anders umgebrochen —, rutschen
alle Notizen des Dokuments um ein paar Zeichen und stehen mitten im Wort.

Der haltbarere Weg ist, **den ausgewählten Text mitzuspeichern** und die
Stelle beim Öffnen wiederzufinden:

1. Die Kennung des Regelabschnitts (nicht des ganzen Dokuments).
2. Den ausgewählten Text selbst.
3. Das wievielte Vorkommen dieses Textes im Abschnitt es ist.

Findet sich der Text nicht mehr, ist die Notiz **nicht weg**, sondern hängt
oben am Abschnitt mit dem Vermerk, dass ihre Stelle verschwunden ist. Eine
Notiz still fallen zu lassen wäre das Schlimmste — man merkt es erst, wenn
man sie sucht.

### Wo sie liegen

In der Ablage des Nachschlagewerks, nach Abschnitt, nicht im Regeltext
selbst. Der offizielle Bestand kommt aus `packages/srd/` und wird beim
nächsten Update überschrieben; was dort hineingeschrieben wäre, wäre dann
weg.

Und wie überall: **nicht übersetzen.** Was man hinschreibt, steht so da.

### Was noch zu klären ist

- **Ob Notizen in die Suche gehören.** Dafür spricht viel — „wo war noch
  die Stelle, zu der ich was geschrieben habe?" ist eine echte Frage. Dagegen
  spricht, dass eine Randbemerkung ohne Namen in einer Trefferliste schlecht
  aussieht. Vermutlich: ja, aber mit dem Abschnitt als Namen.
- **Ob sie mitverschickt werden.** Eher nein, siehe unten: eine Hausregel
  ist für den Tisch, eine Notiz für einen selbst. Wer eine Bemerkung teilen
  will, macht eine Hausregel daraus — und genau dieser Knopf wäre die
  richtige Brücke zwischen beiden.

## Regeln verschicken

Die Austausch-App (`docs/austausch.md`) soll Regeln an den Tisch schicken
können — und hier gibt es einen Unterschied, den man gleich richtig macht:

- **Hausregeln werden verschickt**, ganz, mit Text. Sie sind der Grund für
  die Sache: die Gruppe soll nachlesen können, was am Tisch gilt, ohne
  nachzufragen.
- **Offizielle Regeln werden nicht verschickt, sondern genannt.** Jede
  Installation hat denselben Bestand; den Text mitzuschicken wäre Ballast.
  Es genügt die Kennung, und beim Empfänger geht die Stelle auf. Wer eine
  Hausregel bekommt, die auf „Critical Hit" zeigt, sieht bei sich beides.

Das passt ohne Umbau in die Schnittstelle, die `docs/austausch.md` schon
beschreibt (Werkzeug, Kennung, Name, Art, Inhalt): eine Hausregel ist ein
Eintrag mit Inhalt, ein Verweis auf eine offizielle Regel ein Eintrag ohne.

Ein Nebeneffekt, der die Entscheidung zusätzlich trägt: eine Hausregel zu
verschicken ist lizenzrechtlich unbedenklich, weil sie vom Tisch stammt.
Beim offiziellen Text stellte sich die Frage, ob die Namensnennung mitreisen
muss — sie stellt sich nicht, wenn er gar nicht mitreist.

## Abgrenzung zum Status Effect Creator

Sie überschneiden sich nicht, sie ergänzen sich:

- Der **Status Effect Creator** erzeugt *eigene* Zustände.
- Das **Nachschlagewerk** hält die *offiziellen*.

Dass in der Suche beide nebeneinander stehen, ist der Gewinn und nicht die
Doppelung: „Kälte" findet die offizielle Regel und die drei eigenen
Zustände, die man dazu gebaut hat.

Die Hausregeln sind davon noch einmal verschieden und gehören trotzdem
hierher: ein selbst gebauter *Zustand* ist ein Ding, das im Spiel auf einer
Figur liegt — dafür ist der Status Effect Creator da, mit Stufen, Dauer und
Foundry-Export. Eine *Hausregel* ist ein Satz darüber, wie gespielt wird.
Die Faustregel: wer es einer Figur anheften kann, baut es dort; wer es der
Gruppe ansagt, schreibt es hier.

## Namensnennung

Wörtlich vorgeschrieben, und die Bedingung, unter der das Material überhaupt
benutzt werden darf:

> This work includes material from the System Reference Document 5.2.1
> ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the
> Creative Commons Attribution 4.0 International License, available at
> https://creativecommons.org/licenses/by/4.0/legalcode.

Dazu die deutsche Fassung desselben Satzes, wenn die Hülle auf Deutsch
steht. Beide liegen wörtlich in `packages/srd/src/namensnennung.ts`.

Darüber hinaus ausdrücklich **keine weitere Nennung** von Wizards — keine
Logos, keine Marken. Erlaubt wäre laut Dokument einzig der Hinweis
„kompatibel mit der fünften Edition"; die Sammlung macht davon keinen
Gebrauch. Steht in `NOTICE.md` und gehört genauso in den Über-Dialog.

Für #125 (der Name der Sammlung nach außen) folgt daraus eine Schranke: der
Name darf keine fremde Marke tragen.

## Zu klären

- **Woher der Text kommt.** Das SRD liegt als PDF vor. Daraus sauberes
  Markdown zu machen ist die eigentliche Arbeit dieses Werkzeugs — und es ist
  Fleißarbeit mit Korrekturlesen, kein Programmierproblem. Ob es eine
  brauchbare maschinenlesbare Fassung unter derselben Lizenz gibt, ist vor
  dem Anfangen zu prüfen; von Hand abzutippen wäre die schlechteste aller
  Möglichkeiten.
- **Ob Monster dazukommen.** Der Encounter Creator hätte gern eine Liste
  bekannter Monster zum Vergleich. Das wäre derselbe Bestand, aber deutlich
  mehr Text. Eigene Entscheidung, nicht nebenbei.
- **Wie eine Notiz auf einem Berührungsbildschirm entsteht.** Auswählen und
  dann einen Knopf treffen ist mit der Maus selbstverständlich und mit dem
  Finger fummelig. Das betrifft die ganze Sammlung und nicht nur dieses
  Werkzeug — gehört zu #61 (Barrierefreiheit) und nicht hierher.
- **Ob eine Hausregel mehr Form braucht als Text.** „Kritische Treffer:
  doppelte Würfel statt doppeltem Ergebnis" ist ein Satz. „Bei einer langen
  Rast darf man zusätzlich eines von vier Dingen tun" ist eine Liste mit
  Regeln daran. Ob das über Markdown hinaus Struktur braucht — etwa, damit
  der Würfel-Werkzeug die Krit-Regel kennt —, sollte man erst entscheiden,
  wenn zwanzig echte Hausregeln dastehen. Vorher gerät die Form zu eng.
- **Wie die Suche im Regeltext arbeitet.** `packages/eintraege` sucht in
  Name, Art und Stichworten, ausdrücklich nicht im Volltext. Für ein
  Nachschlagewerk ist das womöglich zu wenig — wer „difficult terrain" sucht,
  meint die Stelle im Text. Eine Volltextsuche gehört dann in dieses Werkzeug
  und nicht in das gemeinsame Paket.

## Ein möglicher Zuschnitt

1. **`packages/srd/` mit den Zuständen und dem Regel-Glossar.** Der kürzeste
   Teil, der ständig gebraucht wird, und er trägt sofort etwas: die Suche
   findet ab da offizielle Zustände.
2. **Oberfläche und Einbettung.** Liste, Text, Suchfeld. Baugleich zu den
   vorhandenen Werkzeugen.
3. **Hausregeln.** Ablage, Bearbeiten, der Verweis auf die offizielle Regel
   und die Marke an dieser. Der Teil, der das Werkzeug von einem PDF
   unterscheidet.
4. **Querverweise mit Vorschau.** Erkannte Begriffe im offiziellen Text,
   `[[Name]]` in den Hausregeln, die Karte beim Darüberfahren. Braucht die
   Begriffsliste aus Stufe 1 und die Hausregeln aus Stufe 3.
5. **Notizen am Text.** Auswählen, schreiben, hinterlegt lassen. Baut auf
   der Ablage aus Stufe 3 auf und ist ohne sie nicht sinnvoll.
6. **Magische Gegenstände.** Damit steht zugleich die Eichung für
   `docs/magicitems.md`.
7. **Zauber und Ausrüstung.** Der lange Teil, und der, den man auch erstmal
   weglassen kann. Gebaut.

Stufe 1 bis 3 zusammen ergeben schon ein Werkzeug, das man am Tisch aufmacht.
Stufe 4 und 5 sind das, was man danach nicht mehr hergeben will. Das Verschicken
kommt mit der Austausch-App, nicht vorher.
