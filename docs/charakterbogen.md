# Konzept: Charakterbogen mit Inventar

Ein kleiner Charakterbogen für D&D 5.5e (Regeln von 2024, SRD 5.2) mit
Inventar, der im Raum
live mitläuft: Spieler sehen und pflegen ihre Figur, die Spielleitung (SL)
hat Zugriff auf alle Bögen, Gegenstände wandern zwischen Figuren, und es gibt
ein gemeinsames Gruppeninventar.

**Stand:** Alle sieben Schritte sind gebaut: Bogen, Zauberliste, Inventar mit Geld und Gruppeninventar; Rollen im Raum, Tischschlüssel, gespeicherte Räume; Bögen live im Raum mit Freigabe und SL-Markierung; Geben im Raum; Quellen fürs Inventar und Anbindung an den Initiative Tracker. Dazu Waffenangriffe. Offene Punkte stehen bei den einzelnen Abschnitten und unter „Später“. Es nimmt `docs/inventar.md`
auf und ersetzt dessen Teil „Im Raum“. Entschieden sind: nur 5.5e,
Zauberliste, Spieler:innen dürfen aus dem Gruppeninventar nehmen, Rollen
überdauern den Raum. Offene Fragen stehen am Ende.

## Abgrenzung

- **Klein** heißt: Werte eintragen und rechnen, was sich sicher rechnen
  lässt (Modifikatoren, Übungsbonus, Summen). Keine Regel-Engine: keine
  Klassenmerkmale, keine Prüfung, ob ein Zauber zur Klasse passt, kein
  Stufenaufstieg mit Assistent. Das kann D&D Beyond besser, und es wäre ein eigenes Projekt.
- Ein eigenes Werkzeug mit Kachel („Charakterbogen“), nicht im
  Teilen-Dialog. Beantwortet Frage 1 aus `docs/inventar.md`: Bogen und
  Inventar sind zu groß für einen Dialog.
- Ohne Raum voll nutzbar, als lokale Sammlung von Bögen.

## Der Bogen

| Bereich | Felder | Gerechnet |
| --- | --- | --- |
| Kopf | Name, Spieler:in, Spezies, Klasse(n) mit Stufe und Unterklasse, Hintergrund, Gesinnung, Größe, EP | Gesamtstufe, Übungsbonus (+2 bis +6) |
| Attribute | STÄ, GES, KON, INT, WEI, CHA | Modifikator |
| Rettungswürfe | Übung je Attribut | Bonus |
| Fertigkeiten | 18 Fertigkeiten, alphabetisch in der Sprache der Anzeige: keine / halbe Übung / Übung / Expertise; Schalter „Alleskönner“ | Bonus, passive Wahrnehmung, Nachforschungen, Motiv erkennen |
| Übung und Training | Rüstung (leicht, mittel, schwer, Schilde), Waffen, Werkzeuge, Sprachen | |
| Sinne, Verteidigung | Sinne, Resistenzen, Immunitäten, Anfälligkeiten | |
| Kampf | RK, Initiative (überschreibbar), Bewegung, Trefferwürfel (gesamt/übrig) | Initiative aus GES (+ halber Übungsbonus mit Alleskönner) |
| Trefferpunkte | Maximum, aktuell, temporär | Anzeige „34 / 41 (+5)“ |
| Zustand | Zustände aus dem SRD und eigene aus dem Status Effect Creator, Erschöpfung 0–6, Todesrettungswürfe, Heldische Inspiration | Wirkung der Erschöpfungsstufe |
| Begrenzte Fähigkeiten | Name, Höchstwert, übrig, kurze oder lange Rast | füllen sich bei der passenden Rast |
| Merkmale, Figur | Klassenmerkmale, Speziesmerkmale, Talente, Aussehen, Persönlichkeit und Geschichte | |
| Angriffe | freie Zeilen: Name, Angriffsbonus, Schaden, Notiz | |
| Zauber (optional) | Zauberattribut, Plätze je Grad (max/verbraucht), Zauberliste | Zauber-SG, Angriffsbonus |
| Inventar | siehe unten | Gewicht, Wert, Traglast |
| Notizen | Markdown | |

Eingaben mit Rechnung wie im Initiative Tracker: Ins TP-Feld `-7` schreiben
zieht ab, `+5` heilt; Schaden frisst zuerst die temporären TP.

Kurze Rast und lange Rast als Knöpfe. Lange Rast nach SRD 5.2: alle TP und
**alle** Trefferwürfel zurück (nicht die Hälfte wie in den Regeln von 2014),
eine Erschöpfungsstufe weniger; mit 0 TP geht keine Rast. Kurze Rast:
Trefferwürfel ausgeben, je Würfel Wurf + KON-Modifikator, mindestens 1 TP.
Zauberplätze kommen mit der Zauberliste dazu.

**Stand:** Schritte 1 bis 3 sind gebaut (`apps/charakterbogen`): Werte, Rechnungen,
TP-Feld, Todesrettungswürfe, Trefferwürfel, Rasten, Zustände, Angriffe,
Notizen, Ablage als Markdown, Suche und Teilen über die Hülle; dazu die
Zauberliste wie unten beschrieben.

## Zauberliste

- **Hinzufügen** aus den 339 SRD-Zaubern (`packages/srd`, zweisprachig) mit
  Suche und Filtern nach Grad und Klasse; die Klasse des Bogens ist
  vorgewählt, ein Zauber anderer Klassen geht trotzdem (Subklassen, Talente,
  Gegenstände). Dazu **eigene Zauber** als freie Zeile mit Name, Grad und Text.
- Je Zauber: **vorbereitet** (Haken), **immer vorbereitet** (etwa durch die
  Subklasse), Herkunft als freier Text („Magic Initiate“).
- Die Liste gruppiert nach Grad, Zaubertricks oben. Konzentration und
  Ritual stehen als Marke dran, dazu Zeitaufwand und Reichweite.
- **Wirken** verbraucht den niedrigsten freien Platz ab dem Grad des
  Zaubers und meldet sich in der Wurfanzeige unten rechts. Ist keiner frei,
  fragt der Bogen, ob trotzdem gewirkt wird (dann ohne Platz). Zauber mit
  Zauberangriff (SRD: „melee/ranged spell attack“, 21 Zauber; eigene: das
  Wort im Text) würfeln den Angriff gleich mit (`shared/zauber.ts`
  `istAngriffszauber`). Ein Klick auf den Namen öffnet den Text wie im
  Nachschlagewerk, in der Liste wie in der Suche.
- Wie viele Zauber vorbereitet sein dürfen, zählt die App mit. Die Zahl aus
  der Klassentabelle schlagen die Hinweise vor (unten).
- Gespeichert wird die SRD-Kennung, nicht der Text. Aus dem Nachschlagewerk
  kommt er in der Sprache der Oberfläche. Eigene Zauber tragen ihren Text
  selbst.

## Inventar

Übernimmt `docs/inventar.md`: eigene Gegenstände (Name, Beschreibung,
Anzahl, Gewicht, Wert), dazu Magic Items, SRD-Ausrüstung und Loot als Kopie
mit Herkunft; Geld in eigenen Feldern (siehe unten); Summen für
Gewicht und Wert; Traglast aus STÄ.

### Geld

Jedes Inventar hat fünf eigene Felder für Geld, oben über der
Gegenstandsliste, auch jedes Gruppeninventar:

| Feld | Kurz | Wert in GM |
| --- | --- | --- |
| Platin | PM | 10 |
| Gold | GM | 1 |
| Elektrum | EM | 0,5 |
| Silber | SM | 0,1 |
| Kupfer | KM | 0,01 |

- Ganze Zahlen ab 0. Eingabe mit Rechnung wie bei den TP: `+37` oder `-5`
  im Goldfeld.
- Daneben die Summe in GM („insgesamt 412,3 GM“). Sie zählt zum Gesamtwert
  des Inventars.
- Geld ist nie ein Gegenstand der Liste. Loot-Zeilen wie „37 GM“ landen
  direkt in den Feldern.
- **Umrechnen** nur auf Knopfdruck („in möglichst wenige Münzen“ oder
  „alles in Gold“), nie von selbst: wer 300 Kupfer in der Tasche hat, soll
  sie auch behalten.
- **Geben** mit Betrag je Münzart, auch ins und aus dem Gruppeninventar;
  im Raum ein Schritt beim Gastgeber wie bei Gegenständen.
- **Aufteilen**: im Gruppeninventar ein Knopf „Gleichmäßig aufteilen“ auf
  gewählte Figuren. Was sich nicht glatt teilen lässt, bleibt in der Gruppe
  und wird angezeigt.
- Gewicht von Münzen (SRD: 50 Münzen wiegen ein Pfund, deutsch „etwa ein
  halbes Kilo“) zählt nur, wenn man es einschaltet.
- **Gewichte stehen immer in beiden Einheiten**: deutsch „5,5 kg (11 lb)“,
  englisch „11 lb (5.5 kg)“, damit am Tisch niemand umrechnen muss.
  Gespeichert wird in Pfund, umgerechnet mit dem Faktor der deutschen
  SRD-Fassung (1 lb = 0,5 kg), damit die Zahlen zu den Tabellen passen.
- **Ohne Raum** geht Geben und Aufteilen zwischen Bögen auf demselben
  Rechner (etwa bei der SL): ein Schritt im Hauptprozess, beide Bögen
  bekommen einen Eintrag im Verlauf.

Neu am Bogen:

- **Ausgerüstet** und **Eingestimmt** je Gegenstand; höchstens drei
  eingestimmte, die App warnt beim vierten, verbietet ihn aber nicht.
- **Gruppeninventar**: ein eigener Bogen ohne Werte, nur Inventar und
  Münzen („Gemeinsame Beute“, Truhe, Packpferd). Es kann mehrere geben.

## Rollen im Raum

| Rolle | Darf |
| --- | --- |
| **SL** | alle Bögen lesen und ändern, Gruppeninventare anlegen und löschen, Rollen vergeben |
| **Spieler:in** | eigene Bögen ändern; andere Bögen sehen, soweit deren Freigabe es erlaubt; Gruppeninventar ändern (einstellbar, siehe unten) |
| **Zuschauer:in** | nur sehen, was für alle freigegeben ist |

- **Mehrere SL** sind erlaubt. Rollen hängen an der Person im Raum.
- **Übertragen**: Jede SL kann im Raum per Rechtsklick auf eine Person
  „Zur SL machen“ oder „SL-Rolle abgeben“. Abgeben geht nur, solange danach
  noch mindestens eine SL im Raum ist, außer der Raum hatte nie eine.
- Beim Eröffnen fragt der Raum „Ich leite (SL)“, vorbelegt mit ja. Gastgeber
  und SL sind damit **nicht** dasselbe: Wer den Raum technisch hält, muss
  nicht leiten.
- Die Rollen kennt der Gastgeber und verteilt sie mit der Personenliste.
- **Rollen überdauern den Raum.** Sie stehen im gespeicherten Raum (siehe
  unten) und gelten wieder, sobald die Person beitritt.
- Erkannt wird eine Person am **Tischschlüssel**: Jede Installation legt
  einmal ein zufälliges Schlüsselpaar an und beweist beim Beitreten, dass
  sie den geheimen Teil hat. Am Namen allein geht es nicht, sonst bekäme
  jede:r SL-Rechte, der sich so nennt wie die SL. Wer die App neu
  installiert, bekommt die Rolle einmal von Hand neu. Wer den Rechner mit
  einer Sicherung der Sammlung wechselt, behält den Schlüssel (er liegt als
  `tischschluessel.json` im Datenordner und ist in der Sicherung). Eine
  Sicherung deshalb nicht weitergeben: wer sie hat, kann sich als diese
  Person ausweisen.

**Gebaut (Schritt 4):**

- Protokoll: `hallo` trägt optional den öffentlichen Schlüssel (Ed25519,
  SPKI) und eine Unterschrift über `Zufallszahl:Raumname`; ohne gültige
  Unterschrift gilt der Schlüssel nicht. `Person.sl` und die Nachricht
  `rolle` sind neu, alle Felder optional, die Protokollversion bleibt 2.
  Ältere Gäste kommen also weiter herein, nur ohne Wiedererkennung.
- Ernennen darf jede SL; gibt es keine SL, der Gastgeber. Die letzte SL kann
  nicht abgeben. Ein Gast bittet den Gastgeber, der prüft.
- Im Reiter Raum: Haken „Ich leite (SL)“, Marke „SL“ an Namen, Rechtsklick
  (oder Menütaste) auf einen Namen für „Zur SL machen“ / „SL-Rolle abgeben“.
- Würfel: „Nur an SL“ geht an jede SL im Raum als eigene Direktnachricht.
  Ist man selbst die einzige SL, bleibt der Wurf verdeckt hier.
- Noch nicht: Zuschauer:innen und die Rechte an Bögen. Beides kommt mit
  Schritt 5, weil es erst dann etwas zu schützen gibt.

**Freigabe eines Bogens** für die anderen Spieler:innen, einstellbar je
Bogen: *nichts*, *Übersicht* (Name, Klasse, Stufe, TP-Stufe, RK, Zustände)
oder *alles*. Die SL sieht immer alles. Vorgabe: Übersicht.

**Änderungen durch die SL** an einem Spielerbogen sind standardmäßig
sichtbar: Das geänderte Feld leuchtet kurz auf, trägt danach eine kleine
Marke „SL“ (beim Darüberfahren: wer, wann, alter Wert), und oben am Bogen
steht „3 Änderungen durch die SL“ mit Liste; ein Klick bestätigt sie weg.
Die SL kann das per Klick umgehen: Ein Schalter „Still ändern“ in ihrer
Leiste gilt, bis sie ihn wieder ausschaltet, und ist sichtbar an, solange er
an ist. Stille Änderungen stehen nur im Verlauf, den die SL sieht. Das ist
gewollt (etwa für Flüche, die die Figur nicht bemerkt), heißt aber auch:
Spieler:innen können sich nicht darauf verlassen, jede Änderung zu sehen.

## Live im Raum

### Wer den Stand führt

Solange ein Raum offen ist, führt **der Charakterbogen beim Gastgeber** den
Stand aller geteilten Bögen, wie beim geteilten Kampf im Initiative Tracker.
Jede Änderung geht als Anfrage dorthin, wird gegen die Rolle geprüft, der
Reihe nach angewandt und an alle verteilt, die den Bogen sehen dürfen.

Warum nicht jeder für sich: Mit einer einzigen Stelle, die schreibt, gibt es
keine Konflikte zwischen zwei gleichzeitigen Änderungen, und eine Übergabe
von Gegenständen ist ein einziger Schritt statt eines Hin und Her, das
mittendrin abreißen kann.

- **Änderungen sind Schritte, keine ganzen Bögen**: „TP −7“, „Gegenstand X
  Anzahl 3“, „Feld RK = 16“. Zwei gleichzeitige Treffer ergeben so beide
  Abzüge, statt dass einer den anderen überschreibt. Bei zwei gleichzeitigen
  Werten fürs selbe Feld gewinnt der später angekommene; die Oberfläche
  zeigt kurz, wer zuletzt geändert hat.
- Jeder Bogen trägt eine **Fassungsnummer**. Wer eine Lücke bemerkt (etwa
  nach einem Aussetzer), holt den ganzen Bogen neu.
- **Beitreten**: Wer einen Raum betritt, wählt, welche eigenen Bögen er
  hineinbringt. Die gehen einmal ganz an den Gastgeber, danach nur noch
  Schritte.
- **Verlassen**: Jede:r behält den letzten Stand der eigenen Bögen lokal.
  Die SL behält auf Wunsch eine Kopie aller Bögen („Stand der Runde
  sichern“). Gruppeninventare speichert der Gastgeber mit dem Raum.
- **Gastgeber geht**: Der Raum endet ohnehin (so ist er gebaut). Alle haben
  den letzten verteilten Stand; nichts geht verloren, was schon angekommen
  war.

### Gebaut (Schritt 5)

- **Kern** in `apps/charakterbogen/src/shared/live.ts` (`LiveTisch`, rein
  und mit Modultests), **Leitung** in `src/main/live.ts`. Der Tisch lebt im
  Hauptprozess des Gastgebers; Nachrichten an einen noch nicht geöffneten
  Charakterbogen montiert die Hülle still im Hintergrund.
- **Anfragen** an den Gastgeber: `hallo`, `bringe`, `schritte`, `zurueck`,
  `freigabe`, `bestaetige`. **Meldungen** zurück: `stand`, `bogen`, `weg`,
  `abgelehnt`. Alles als Werkzeugnachricht `charakterbogen`.
- **Abweichung vom Konzept:** Schritte reisen nur zum Gastgeber. Zurück
  kommt der ganze Bogen (oder seine Übersicht) mit Fassung und Quittung
  („deine Schritte bis Nr. n sind drin“). So kann keine Lücke entstehen, und
  das Nachholen entfällt. Die Oberfläche übernimmt einen neuen Stand erst,
  wenn alle eigenen Schritte quittiert sind; getippte Zeichen springen so
  nicht zurück.
- **Schritte** entstehen aus dem Unterschied zweier Stände (Objekte werden
  durchlaufen, Listen gehen als Ganzes). Schaden und Heilung reisen als
  eigener Schritt `betrag`, damit zwei Treffer zugleich beide zählen. Bei
  Listen (Gegenstände, Angriffe) gewinnt die spätere Änderung.
- **Freigabe** je Bogen (nichts, Übersicht, alles), Vorgabe Übersicht. Die
  Übersicht zeigt Name, Klasse, TP-Stufe (unverletzt, leicht, schwer, am
  Boden), RK und Zustände.
- **SL-Markierung:** Änderungen einer SL an fremden Bögen stehen oben am
  Bogen der Person, der er gehört („n Änderungen durch die SL“, Knopf
  „Gesehen“), und als Marke „SL“ an den Feldern (beim Darüberfahren: wer,
  wann, alter Wert). „Still ändern“ ist ein Schalter der SL je Bogen; stille
  Änderungen sieht nur die SL in ihrem Verlauf.
- **Speichern:** Wer einen eigenen Bogen im Raum hat, bekommt jeden Stand
  auf die eigene Platte (kurz gesammelt). Fremde Bögen landen nie auf der
  Platte, auch nicht beim Gastgeber.
- **Grenzen:** höchstens zwölf Bögen je Person; ein großer Stand wird in
  einzelne Bögen zerlegt (Raumgrenze 2 MB je Nachricht).
- Noch nicht: „Stand der Runde sichern“ für die SL, Zuschauer:innen.

### Sachen teilen

- **Gegenstand geben**: Rechtsklick → „Geben an …“ (Person oder
  Gruppeninventar). Im Raum ist das ein Schritt beim Gastgeber: aus dem einen
  Inventar heraus, ins andere hinein, in einem Zug. Mit Anzahl („3 von 10
  Pfeilen“). Die SL kann auch zwischen zwei fremden Bögen verschieben.
- **Geld geben** genauso, als Betrag je Münzart (siehe „Geld“).
- **Aus dem Gruppeninventar nehmen**: Spieler:innen dürfen selbst nehmen
  und hineinlegen. Die SL kann das je Gruppeninventar abschalten; dann
  verteilt nur sie. Jede Entnahme steht mit Name und Zeit im Verlauf des
  Gruppeninventars.
- **Einen Bogen oder Gegenstand als Kopie teilen**: wie heute über
  Teilen → Paket; landet beim Empfänger als eigener, nicht verknüpfter Bogen.

**Gebaut (Schritt 6):**

- Anfragen `gib` (Gegenstand mit Anzahl oder Geld, von einem Bogen im Raum
  zu einem anderen) und `aufteilen` (Geld gleichmäßig verteilen, der Rest
  bleibt). Beides ist beim Gastgeber ein Schritt, beide Seiten bekommen
  einen Eintrag im Verlauf.
- Geben darf, wem der gebende Bogen gehört, und jede SL (auch zwischen zwei
  fremden Bögen). Ziel kann jeder Bogen im Raum sein.
- **Gruppeninventar im Raum:** Freigabe „alles“ von Anfang an. Solange die
  Raumeinstellung „Spieler:innen dürfen aus dem Gruppeninventar nehmen“ an
  ist (Vorgabe), dürfen alle es ändern, daraus nehmen und hineinlegen; jede
  Änderung steht mit Namen im Verlauf, SL-Marken gibt es dort nicht. Ist
  sie aus, verteilt nur die SL; hineinlegen aus dem eigenen Bogen geht
  weiter.
- Bringt der Gastgeber ein Gruppeninventar herein, merkt sich der
  gespeicherte Raum dessen Kennung. Beim Fortsetzen kommt es von selbst
  wieder in den Raum. Die Datei liegt beim Gastgeber in seinen Bögen, wird
  also nicht in die Raumdatei kopiert.
- Die Raumeinstellungen („aus dem Gruppeninventar nehmen“, „Änderungen der
  SL markieren“) stehen beim Gastgeber im Reiter Raum. Ohne Markieren ist
  jede SL-Änderung still.
- Nicht gebaut: Rechtsklick „Geben an …“ direkt an einem Gegenstand; es
  bleibt beim Knopf „Geben an“ im aufgeklappten Gegenstand wie bisher.

### Übertragung

Über den bestehenden Raum, Nachrichtentyp `werkzeug` mit
`werkzeug: 'charakterbogen'` (wie die geteilte Initiative). Die Hülle liest
den Inhalt nicht; das Werkzeug prüft ihn. Die Rollen gehören der Hülle
(sie gelten für alle Werkzeuge): Gebaut ist das als `sl` an der Person in
der Personenliste und als Anfrage `rolle` an den Gastgeber. Weil alle
Felder optional sind, bleibt das Protokoll bei Fassung 2.

**Grenze:** Der Gastgeber prüft die Rechte. Wer den Raum hält, könnte mit
einer veränderten App alles ändern. Für eine Runde unter Bekannten reicht
das; es sollte aber in der Oberfläche nicht nach mehr aussehen.

## Gespeicherte Räume

Der Gastgeber speichert den Raum, damit die Runde nächste Woche genau dort
weitermacht.

**Was drinsteht:**

- Name des Raums, Port und ob übers Internet.
- **Personen mit Rolle**: Tischschlüssel, zuletzt benutzter Name, Rolle.
- **Gruppeninventare** samt Geld und Verlauf.
- **Einstellungen des Raums**: ob Spieler:innen aus dem Gruppeninventar
  nehmen dürfen, Vorgabe für die Freigabe neuer Bögen, ob SL-Änderungen
  markiert werden.
- Wer zuletzt welchen Bogen hineingebracht hat (nur Kennung und Name, nicht
  der Bogen selbst: der gehört den Spieler:innen).

**Nicht drin: das Passwort.** Es wird beim Wiedereröffnen neu eingegeben.
Gespeichert, auch verschlüsselt, läge auf der Platte des Gastgebers alles,
was man zum Mitlesen braucht.

**Bedienung:**

- Gespeichert wird von selbst: beim Eröffnen und bei jeder Änderung einer
  Rolle (gebaut). Ab Schritt 6 auch bei jeder Änderung am Gruppeninventar.
  Fortsetzen geht über „Meine Räume“: Name, Internet und Port werden
  eingetragen, das Passwort nicht. Beim Fortsetzen entscheiden die gemerkten
  Rollen, der Haken „Ich leite“ entfällt.
- Im Reiter Raum steht eine Liste **„Meine Räume“**: fortsetzen, umbenennen,
  löschen (mit Rückfrage), als Datei exportieren, einlesen (gebaut).
- **Gastgeber wechseln**: Export als Datei (`*.lore-raum.json`), die neue
  Person liest sie ein und eröffnet den Raum bei sich. Die Rollen kommen mit;
  der Schlüssel der Person, die bisher Gastgeber war, steht darin wie jeder
  andere; sie wird also als Gast wiedererkannt. Das Gruppeninventar reist nicht mit: es ist
  ein Bogen und geht über Teilen oder „Weitergeben“ an die neue Person.
- Die Einstellungen des Raums (aus dem Gruppeninventar nehmen, SL-Änderungen
  markieren) stehen in der Datei, Vorgabe jeweils ja, und sind beim
  Gastgeber im Reiter Raum schaltbar.
- Ablage: eine Datei je Raum im Datenordner der Hülle
  (`userData/raeume/<id>.json`), in der Sicherung der Sammlung enthalten.

## Quellen fürs Inventar (Schritt 7)

Gebaut: Im Inventar (Figur und Gruppe) öffnet „+ Aus Quelle …“ vier Reiter.

- **SRD-Ausrüstung:** 38 Waffen (als Waffe markiert, also gleich als
  Angriff nutzbar, sobald ausgerüstet), 13 Rüstungen (RK, Stärke,
  Heimlichkeit in der Beschreibung) und die Abenteurerausrüstung mit Gewicht
  und Preis. Gepaart wie bei den Waffen; die Rüstungstabelle steht in beiden
  Sprachen in derselben Reihenfolge, die Abenteurerausrüstung wird über die
  gepaarten Einträge des Kapitels gefunden.
- **SRD magisch:** alle magischen Gegenstände des SRD mit Text; Gewicht und
  Preis nennt das SRD dafür nicht, die Felder bleiben leer.
- **Eigene (Homebrew):** alles, was im Magic Item Generator gespeichert ist,
  mit Art, Seltenheit, Einstimmung, Wirkungen, Fluch und Wert. Die Hülle
  liest das für den Bogen mit (die Werkzeuge kennen einander nicht).
- **Loot-Tabelle:** eine Tabelle des Loot Generators wählen (eigene, SRD,
  und die aus dem Magic Item Generator), würfeln, das Ergebnis mit einem
  Klick ins Inventar. Gewürfelt wird in der Hülle mit derselben Logik wie im
  Loot Generator.
- Jeder übernommene Gegenstand merkt sich seine Herkunft (`quelle`: Art und
  Kennung). Auffrischen aus der Quelle, wenn sich dort etwas ändert, ist
  noch nicht gebaut.

## Initiative Tracker (Schritt 7)

Gebaut:

- **„In die Initiative“** am Bogen einer Figur schickt Name, TP, RK und
  Initiativebonus in den Tracker und holt ihn nach vorn. Dort steht sie als
  Spielerfigur (Initiative zum Eintragen, der Bonus als Feinwert für
  Gleichstände). Ein zweites Mal frischt sie auf statt sie zu verdoppeln;
  dafür merkt sich der Tracker die Kennung des Bogens (`bogen`).
- Im Raum hat die SL oben in „Im Raum“ den Knopf **„Alle Figuren in die
  Initiative“** für alle Figuren, die sie ganz sieht.
- **TP in beide Richtungen:** Schaden oder Heilung im Tracker gehen an den
  Bogen (auf der Platte, oder im Raum als Schritt, sofern man den Bogen
  ändern darf). Ändert sich der Bogen (gespeichert oder im Raum), frischt
  der Tracker die Figur auf, wenn er offen ist; er wird dafür nicht
  geweckt. Gesendet werden feste Werte, keine Differenzen, und der Tracker
  merkt sich, was der Bogen schon weiß: nichts läuft im Kreis.
- Tippt man am Bogen gerade, wenn neue TP aus dem Tracker kommen, werden
  nur die TP übernommen.
- Grenzen: Zustände, Todesrettungswürfe und Initiative gehen nicht zurück
  an den Bogen. Im geteilten Kampf schreibt jede Person nur in Bögen, die
  sie ändern darf.

## Hinweise nach Klasse und Stufe

Unter dem Kopf (`shared/klassenhinweise.ts`, `renderer/Klassenhinweise.tsx`):
Trefferwürfel, Rettungswürfe, Rüstung, Waffen, Werkzeug, Fertigkeiten zur
Wahl, Zauberattribut, Zaubertricks, vorbereitete Zauber und Zauberplätze
für die eingetragenen Klassen. Die Zahlen sind aus den Klassentabellen des
SRD 5.2.1 („Core … Traits“, „… Features“, „Multiclass Spellcaster“) und an
beiden PDFs in `packages/srd/quelle` geprüft.

- Weicht der Bogen ab, ist die Zeile markiert und hat „Übernehmen“. Rüstung
  wird nur ergänzt, Waffen und Werkzeug nur in leere Felder geschrieben.
- Mehrere Klassen: Trefferwürfel aller Klassen, Plätze nach der
  Mehrklassenregel (volle Stufen + halbe Stufen von Paladin und Waldläufer,
  aufgerundet); Rettungswürfe, Rüstung, Waffen und Werkzeug der ersten
  Klasse. Paktmagie hat eigene Plätze; allein übernimmt sie Plätze und
  „kurze Rast“, zusammen mit anderen Zauberklassen bleibt sie ein Hinweis.
- Zugeklappt wird pro Gerät gemerkt.

## Aussehen und Bedienung

Gebaut auf Wunsch nach Schritt 7:

- **Klassischer Aufbau:** Kopf mit Linienfeldern, eine Leiste mit den sechs
  Attributen (großer Modifikator, Wert im Oval), Übungsbonus, Bewegung und
  Inspiration, darunter drei Spalten: Rettungswürfe, passive Werte und
  Übungen; Fertigkeiten und Verteidigung; Initiative (Sechseck), RK
  (Schild), TP, Todesrettungswürfe, Trefferwürfel, Rasten, Zustände und
  begrenzte Fähigkeiten. Darunter Angriffe, Zauber, Merkmale, Figur,
  Inventar, Notizen.
- **Übungspunkt:** leer, halb, voll, doppelt umrandet; per CSS gezeichnet und
  deshalb überall gleich groß (vorher Schriftzeichen unterschiedlicher Größe).
- **Halbe Übung:** Ein Klick schaltet 0 → ½ → 1 → 2 → 0. Der Bonus ist
  „Modifikator + Übungsbonus × Stufe“, abgerundet. „Alleskönner“ gibt allen
  ungeübten Fertigkeiten und der Initiative den halben Übungsbonus
  (SRD 5.2: die Initiative ist ein Geschicklichkeitswurf).
- **Keine Auswahllisten mehr:** Segmente für wenige Werte (Trefferwürfel,
  Attribut, Magie, Wurfziel, Freigabe, Zauberattribut, Zaubergrad und
  -klasse, Loot-Tabelle), Punkte für Stufen (Erschöpfung, Todesrettung,
  Nutzungen, Trefferwürfel bei der kurzen Rast), eine Suchwahl für lange
  Listen (Waffen, Zustände, Ziel beim Geben, Bogen in den Raum bringen).
  Code: `renderer/Bedienung.tsx`.
- **Aussehen je Bogen** (`Bogen.design`, `shared/design.ts`): zehn
  Akzentfarben, sechs Papiere (Pergament, Hell, Leinen, Dunkel, Nacht,
  Schiefer), sieben Schriften (System, Alegreya, Cinzel, IM Fell English,
  MedievalSharp, Uncial Antiqua, Caveat). Die Schriften stehen unter der OFL
  und werden mitgeliefert (`@fontsource`, nur Latin); Lizenztexte in
  `apps/charakterbogen/SCHRIFTEN.md`. Im Raum reist das Aussehen mit dem
  Bogen.
- **Story Creator:** „Notiz im Story Creator anlegen“ legt in der zuletzt
  benutzten Kampagne eine Notiz mit der Lesefassung der Figur an und merkt
  sich die Verknüpfung (`Bogen.storyNotiz`). Danach öffnet der Knopf „Notiz“
  den Story Creator an dieser Stelle; gibt es die Notiz nicht mehr, wird die
  Verknüpfung gelöst. Mit **„↻ Synchron“** wird die Notiz stetig
  nachgeführt (nur Bogen → Notiz): Der Bogen schreibt nach jedem Speichern
  (gebündelt, 1,5 s) nur den Abschnitt zwischen
  `<!-- charakterbogen:anfang -->` und `<!-- charakterbogen:ende -->` neu;
  was davor oder danach in der Notiz steht, bleibt. Änderungen innerhalb des
  Abschnitts überschreibt der Bogen.
- **Wurfanzeige:** Würfe und gewirkte Zauber stapeln sich unten rechts, neue
  unten (sie leuchten kurz auf), ältere rutschen hoch und gehen nach 25 s;
  höchstens sechs.
- **Tote Figur** (drei fehlgeschlagene Todesrettungswürfe): Der Bogen ist
  ausgegraut, bleibt aber bedienbar; in der Liste steht „☠ Tot“ neben den TP.
  Sobald die Figur wieder TP hat, gehen Erfolge und Fehlschläge auf null
  (SRD 5.2.1, Death Saving Throws), egal ob über das Feld, eine Heilung, den
  Initiative Tracker oder beim Laden (`mitTodesrettung` in `shared/bogen.ts`).
- **Neue Bögen** haben die Gemeinsprache unter Sprachen.
- **Eigene Zustände:** Die Zustände aus dem Status Effect Creator stehen in
  der Suchwahl unter „Eigene“ und tragen ihren Text als Hinweis; im Bogen
  als `eigen:<Name>`.

## Waffenangriffe

Gebaut (nach Schritt 6, auf Wunsch vor Schritt 7):

- **SRD-Waffen:** alle 38 Waffen aus der Tabelle „Waffen“ des SRD 5.2
  (`@suite/srd/ausruestung`), zweisprachig. Beide Sprachen sind dort je
  für sich alphabetisch sortiert; gepaart wird über Gruppe,
  Schadenswürfel, Schadensart, Preis und Meisterschaft (ein Test prüft,
  dass das für alle eindeutig ist). Code: `shared/waffen.ts`.
- **Rechnung:** Angriff = Attributsmodifikator + Übungsbonus (wenn geübt)
  + magischer Bonus (+1 bis +3). Nahkampf nimmt Stärke, Fernkampf
  Geschicklichkeit, „Finesse“ den besseren Wert; das Attribut lässt sich
  von Hand festlegen. Schaden = Würfel + derselbe Modifikator + Magie;
  „Vielseitig“ zweihändig mit dem größeren Würfel. Eigenschaften und
  Meisterschaft stehen unter dem Angriff. Ob die Figur die Meisterschaft
  nutzen darf, rechnet der Bogen nicht (Klassenmerkmal).
- **Freie Angriffe** bleiben: ohne Waffe gelten Bonus und Schaden aus den
  Textfeldern (etwa „+4“ und „2W6+1 Feuer“).
- **Würfeln:** 🎲 an jedem Angriff würfelt W20 + Bonus und den Schaden;
  eine natürliche 20 würfelt die Schadenswürfel doppelt. Im Raum wählt man
  „nicht teilen“, „an alle“ oder „nur an SL“ (an jede SL; wer selbst die
  einzige SL ist, behält den Wurf verdeckt). Der Wurf geht als Chatzeile
  mit ⚔ in den Raum.
- **Inventar:** Ein Gegenstand kann als SRD-Waffe markiert werden (mit
  Magie und Übung). Ausgerüstet steht er von selbst unter Angriffe; wer
  ihn ablegt oder weggibt, verliert den Angriff. Diese Angriffe werden
  jedes Mal gerechnet, nicht gespeichert.
- Grenzen: kein Vorteil/Nachteil am Angriffsknopf (dafür den Würfel
  nehmen), keine Zusatzwürfe wie Hinterhältiger Angriff, keine
  Munitionszählung.

## Andere Werkzeuge

- **Initiative Tracker**: gebaut, siehe „Initiative Tracker (Schritt 7)“.
- **SL-Rolle für alle Werkzeuge**: Der Würfel schickt „Nur an SL“ an alle
  SL (gebaut). Werkzeuge bekommen die Rollen über die Personenliste
  (`sl` an der Person). Im geteilten Kampf ist das noch offen.
- **Encounter Creator**: Gruppengröße und Stufen aus den Bögen im Raum.
- **Loot Generator**: gebaut andersherum: der Bogen würfelt über „Aus Quelle
  … → Loot-Tabelle“. Ein Knopf „Ins Inventar“ im Loot Generator selbst
  fehlt noch.
- **Story Creator**: gebaut, siehe „Aussehen und Bedienung“ (Notiz anlegen,
  öffnen, auf Wunsch stetig nachführen).

## Ablage

Je Bogen eine Markdown-Datei mit YAML-Kopf im Ordner des Werkzeugs, wie bei
den anderen Werkzeugen, damit Sicherung und Teilen ohne Sonderweg gehen.
Werte stehen im Kopf, Notizen und Gegenstandsbeschreibungen im Text.

```ts
interface Bogen {
  id: string;
  art: 'figur' | 'gruppe';
  name: string;
  freigabe: 'nichts' | 'uebersicht' | 'alles';
  werte?: {
    klassen: { name: string; stufe: number; unterklasse?: string }[];
    spezies: string;
    hintergrund: string;
    attribute: Record<'sta' | 'ges' | 'kon' | 'int' | 'wei' | 'cha', number>;
    rettung: string[];                        // Attribute mit Übung
    fertigkeiten: Record<string, 0.5 | 1 | 2>; // halb, Übung, Expertise
    alleskoenner: boolean;                    // halbe Übung auf alles Ungeübte
    rk: number;
    initiative: number | null;                // null = aus GES
    bewegung: number;
    tp: { max: number; aktuell: number; temp: number };
    trefferwuerfel: { art: string; gesamt: number; uebrig: number }[];
    zustaende: string[];
    erschoepfung: number;                     // 0 bis 6
    todesrettung: { erfolge: number; fehlschlaege: number };
    inspiration: boolean;
    angriffe: { name: string; bonus: string; schaden: string; notiz: string }[];
    ep: number; gesinnung: string; groesse: string;
    ruestungsuebung: { leicht: boolean; mittel: boolean; schwer: boolean; schilde: boolean };
    waffenuebung: string; werkzeuguebung: string; sprachen: string;
    sinne: string; resistenzen: string; immunitaeten: string; anfaelligkeiten: string;
    klassenmerkmale: string; speziesmerkmale: string; talente: string;
    aussehen: string; persoenlichkeit: string;
    ressourcen: { name: string; max: number; uebrig: number; rast: 'kurz' | 'lang' }[];
    zauber?: {
      attribut: string;
      plaetze: { grad: number; max: number; verbraucht: number }[];
      maxVorbereitet: number | null;          // von Hand, nicht gerechnet
      liste: {
        srd?: string;                         // Kennung in packages/srd
        eigen?: { name: string; grad: number; text: string };
        vorbereitet: boolean;
        immer: boolean;                       // immer vorbereitet
        herkunft: string;
      }[];
    };
  };
  muenzen: { km: number; sm: number; em: number; gm: number; pm: number };
  gegenstaende: InventarGegenstand[];         // aus docs/inventar.md
  notizen: string;
  design?: { farbe: string; papier: string; schrift: string };
  storyNotiz?: { kennung: string; titel: string; sync?: boolean }; // `<Kampagne>/<Notiz>`
  fassung: number;
}
```

## Reihenfolge

1. Werkzeug, Ablage, Bogen ohne Raum (Werte, Rechnungen, TP-Eingabe).
2. Zauberliste mit SRD-Zaubern und eigenen.
3. Inventar nach `docs/inventar.md` (eigene Gegenstände, Summen, Münzen).
4. Rollen in Hülle und Raumprotokoll (SL, mehrere SL, übertragen,
   Tischschlüssel) und gespeicherte Räume.
5. Bögen im Raum: Gastgeber führt, Schritte, Freigabe, Sichtbarkeit.
6. Geben zwischen Bögen und Gruppeninventar.
7. Quellen fürs Inventar (Magic Items, SRD, Loot) und Initiative-Anbindung.

Schritt 4 lohnt sich auch allein: Würfel und Initiative profitieren sofort.

## Später

Notiert, noch nicht geplant:

- **Waffen-Creator:** eigene Waffen bauen (Homebrew), mit Schaden,
  Eigenschaften und Meisterschaft wie die SRD-Waffen, damit der Bogen sie
  genauso rechnet.
- **Zauber-Homebrew:** eigene Zauber anlegen, die in der Zauberliste des
  Bogens neben den SRD-Zaubern stehen.

  Beides ist als Konzept ausgearbeitet: `docs/homebrew-creator.md`.

## Zu klären

Entschieden: nur 5.5e (2024); mit Zauberliste; Spieler:innen dürfen aus
dem Gruppeninventar nehmen; Rollen überdauern den Raum; SL-Änderungen
standardmäßig sichtbar, per Klick still; der Gastgeber speichert den Raum
mit Rollen, Gruppeninventar und Einstellungen.

Derzeit keine offenen Fragen.
