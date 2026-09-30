# Konzept: Austausch am Tisch

Ein Werkzeug, mit dem eine Gruppe, die in Person spielt und die Sammlung
auf mehreren Rechnern hat, Sachen hin- und herschickt: Notizen, Monster,
Zustände, Nachrichten.

**Stand:** Stufe 1 ist gebaut: die gemeinsame Schnittstelle
(`packages/austausch`) und der Dialog „Teilen" in der Hülle. Es machen alle
Werkzeuge mit Einträgen mit: Story Creator, Monster Creator,
Nachschlagewerk, Zustände, Initiative (Begegnungen), Encounter, Magic Items
und Loot. Die fünf zuletzt genannten legen je eine Markdown-Datei pro
Eintrag ab; für sie baut die Hülle den Teilnehmer selbst
(`ordnerTeilnehmer` in `apps/shell/src/main/austausch.ts`). Bilder der
Initiative reisen dabei nicht mit. Weitergegeben wird als Paketdatei oder
über den Raum.

**Die Auswahl im Dialog:** doppelt so breit wie die übrigen Dialoge. Oben
„Zuletzt geöffnet" (aus dem Verlauf der Hülle) und „Zuletzt hinzugefügt"
(nach der Speicherzeit, auch Geändertes), beide offen; darunter je App eine
Gruppe, eingeklappt, auch die über 900 offiziellen Regeln. Eine Suche
klappt die Gruppen mit Treffern auf. Beim Darüberfahren zeigt eine
Vorschau den Anfang des Eintrags.

**Würfe:** Der Würfel kann jeden Wurf in den Raum schicken, einstellbar
„Nicht teilen", „An alle" oder „Nur an DM" (an den Gastgeber). Wer selbst
Gastgeber ist, würfelt mit „Nur an DM" verdeckt: nichts geht hinaus. Ein
Wurf ist eine gewöhnliche Chatzeile mit 🎲 davor.

**Neues im Raum** zeigt ein rotes Abzeichen mit der Zahl am Knopf
„Teilen", solange der Dialog zu ist: Nachrichten anderer, Würfe und neu
angekommene Pakete. Die Liste der Räume im Netz aktualisiert sich von
selbst (Ankündigung alle 2 Sekunden, verschwundene Räume nach 8 Sekunden);
„Aktualisieren" leert sie und sammelt neu, ein kleiner Kreis dreht dabei und
auch dann, wenn sich die Liste von selbst ändert.

Stufe 2 ist gebaut, in einer ersten Fassung: der **Raum im lokalen Netz**
mit Chat, Direktnachrichten und Paketen an alle oder an eine Person
(Reiter „Raum" im Dialog „Teilen"). Der Chatverlauf wird nicht
gespeichert: er lebt nur, solange der Raum offen ist (entschieden).

**Wie Stufe 2 gebaut ist:**

- Wer einen Raum eröffnet, ist **Gastgeber**: ein TCP-Dienst auf einem
  freien Port, dazu alle 2 Sekunden eine Ankündigung per UDP-Broadcast
  (Port 47811). Die anderen sehen den Raum in der Liste und verbinden sich
  mit dem Gastgeber; er verteilt alles. Lässt ein Netz Broadcasts nicht
  durch, tritt man über die Adresse bei, die beim Gastgeber steht.
- Auf der Leitung steht je Zeile eine JSON-Nachricht (Protokoll in
  `packages/austausch/src/raum.ts`, Fassung 2). Das **Passwort reist
  nie**: der Gastgeber schickt Salz und Zufallszahl, der Gast leitet mit
  scrypt denselben Schlüssel ab und antwortet mit einem HMAC-Nachweis und
  einer eigenen Zufallszahl.
- **Mit Passwort ist der Raum verschlüsselt** (`apps/shell/src/main/raumkrypto.ts`):
  aus Schlüssel und beiden Zufallszahlen entsteht je Richtung ein
  Sitzungsschlüssel (HKDF), jede Zeile ist AES-256-GCM mit Zähler.
  Veränderte, wiederholte oder vertauschte Zeilen trennen die Leitung.
  Grenze: wer das Passwort kennt, kann mitlesen. **Ohne Passwort** bleibt
  der Raum offen; die App sagt das beim Eröffnen und bei Direktnachrichten
  und zeigt im Raum „verschlüsselt“ oder „nicht verschlüsselt“.
- **Über das Internet** (Häkchen „Auch über das Internet“, Anleitung für
  Gastgeber in `docs/raum-online.md`): der Raum
  bekommt einen **festen Port** (Vorgabe 47812) und **braucht ein
  Passwort**. Der Gastgeber lauscht auf IPv4 und IPv6. Erreichbar ist er
  - per **Portfreigabe** (IPv4): im Router den TCP-Port an die lokale
    Adresse des Gastgebers weiterleiten. Die öffentliche IPv4 zeigt die App
    auf Knopfdruck (fragt api.ipify.org, das dabei die IP sieht). Geht
    **nicht hinter CGNAT oder DS-Lite**, wie oft bei Kabel und Mobilfunk.
  - per **IPv6**: die App zeigt die öffentlichen IPv6-Adressen; im Router
    muss eingehender TCP-Verkehr auf den Port für diesen Rechner erlaubt
    sein.
  - Kein fremder Server, kein UPnP, kein VPN (entschieden). Beitreten geht
    über das Adressfeld: `1.2.3.4:47812`, `[2001:db8::1]:47812`, eine
    nackte IPv6 oder ein Name; ohne Port gilt 47812.
  - Bisher nur lokal getestet (auch über `::1`), **nicht über echte
    Anschlüsse**.
- Der Absender einer Nachricht ist, wer die Leitung hält, nicht, was im
  Feld steht: ein Gast kann sich nicht als jemand anderes ausgeben.
- Der eigene Name steht in den Einstellungen (`tischName`); ohne ihn gibt
  es einen Gastnamen („Gast 42"). Doppelte Namen bekommen eine Zahl.
- Angekommene Pakete warten im Reiter „Empfangen" und werden über
  denselben Weg angesehen und angenommen wie eine Paketdatei. Am Knopf
  „Teilen" zählt eine Zahl neue Nachrichten und Pakete mit.
- Angekommene Einträge zeigen beim Darüberfahren eine Vorschau. Ein
  Doppelklick öffnet sie in einem eigenen Fenster über dem Dialog, mit dem
  ganzen Text und „In meine Sammlung speichern“. Ein Doppelklick auf ein
  Paket öffnet es wie „Ansehen“.
- Geteilte Einträge stehen im Chat, beim Absender und bei allen, die sie
  bekommen: die ersten fünf Namen, dann „und N weitere“. Ein Klick klappt
  die ganze Liste auf.
- Solange man in einem Raum ist, steht links neben „Teilen“ ein grüner
  Knopf mit Raumname, Zahl der Personen und (als Gast) dem Ping; ein Klick
  öffnet den Raum.
- **Ping:** Gast und Gastgeber messen alle 3 Sekunden die Laufzeit
  (`ping`/`pong` im Protokoll, verschlüsselt wie alles andere). Der Gast
  sieht seinen Ping zum Gastgeber, der Gastgeber den Ping zu jedem Gast
  neben dessen Namen.
- Ein Raum, der schließt, meldet das per Broadcast (`zu: true`) und
  verschwindet sofort aus den Listen im Netz, statt noch Sekunden darin zu
  stehen. Geht die Meldung verloren, läuft er wie bisher nach 8 Sekunden
  aus.
- Beim Gastgeber: „Einladung kopieren“ legt Raumname und alle Adressen als
  Text in die Zwischenablage, ohne Passwort. Bei einem Raum übers Internet
  wird die öffentliche IPv4 gleich beim Eröffnen erfragt (api.ipify.org).
- Höchstens 16 Personen, eine Zeile höchstens 80 MB.
- Unter Windows fragt die Firewall beim ersten Eröffnen, ob die App im
  Netz erreichbar sein darf. Ohne Zustimmung findet niemand den Raum.
- Geprüft in `packages/austausch` (Protokoll), in `apps/shell/tests`
  (Gastgeber und Gäste in einem Prozess: Namen, Passwort, Chat,
  Direktnachricht, Paket an eine Person, Raumliste) und im Rauchtest
  `smoke-raum.cjs` (die App als Gastgeber, ein Gast aus dem Protokoll).

**Entschieden (Nutzerin, 23.09.):**

- Die Schnittstelle hat dieselbe Form wie die Einstellungen: ein optionaler
  Haken je Werkzeug, die Hülle vermittelt.
- Angenommen wird auch, wenn das Zielwerkzeug zu ist: die Werkzeuge
  schreiben direkt in ihre Ablage, beim nächsten Öffnen ist der Eintrag da.
- Räume findet man über eine **Liste im Netz** (Stufe 2).
- **Bilder reisen mit**, als Base64 im Paket.
- Im Raum gibt es außerdem einen **Chat**: Nachrichten an alle und
  **Direktnachrichten** an eine Person. **Dateien und Einträge** lassen sich
  ebenso an alle oder an **einzelne Personen** schicken. Jede Person gibt
  sich einen **Namen** (Einstellung „Dein Name am Tisch"); ohne eigenen
  Namen gilt ein generischer („Gast 1"). Doppelte Namen bekommen im Raum
  eine Zahl. Ohne Raumpasswort ist die Verbindung unverschlüsselt; dann
  sagt die App bei Direktnachrichten sichtbar, dass sie im selben Netz
  mitlesbar sind.
- Der **Initiative Tracker** kann seinen Kampf im Raum **teilen**
  (Knopf „Im Raum teilen", nur sichtbar im Raum). Wer teilt, führt den
  Kampf; die anderen sehen ihn live über der eigenen Liste. Gefiltert:
  Spielerfiguren mit genauen TP, alle anderen nur mit Name, Reihenfolge,
  Zuständen und einer groben Stufe (unverletzt, angeschlagen, schwer
  verletzt, kampfunfähig), ohne TP und RK. Mit dem Schalter
  „Gegnerzustand zeigen“ lässt sich auch die Stufe ganz ausblenden. Über das Rechtsklickmenü einer
  Zeile gehört eine Figur einer Person im Raum; diese Person darf deren TP
  und Zustände ändern. Die Änderung geht an den Teilenden, der sie gegen
  die Zuordnung prüft und den neuen Stand an alle schickt. Alles andere
  wird abgewiesen. Geprüft in `apps/initiative/tests/teilen.test.mjs` und
  im Rauchtest `smoke-initiative-raum.cjs`.

**Aufbau des Dialogs (nach Rückmeldung):** Der **Raum** ist der erste Reiter
und die Hauptsache. Darin stehen Chat, „Einträge in den Raum schicken“ und
„Angekommen“; der eigene Name lässt sich auch im offenen Raum ändern.
„**Als Datei**“ fasst Weitergeben und Empfangen zusammen, als Weg ohne
Netz. Das ist tatsächlich eine Art ausgewählte Sicherung, mit zwei
Unterschieden zur Sicherung der ganzen Sammlung: es geht nur, was man
auswählt, und es wird beim Empfänger eingefügt (mit Rückfrage bei
Doppelten), statt dessen Sammlung zu ersetzen. Die Auswahl ist nach Apps
gruppiert, mit Filter-Chips je App (mehrere gleichzeitig, mit Anzahl), der
Suche darunter und „Alle wählen“ je Gruppe. Die Teilen-App hat ein eigenes
Symbol (`austausch`, ersetzbar durch `austausch.png` im Symbolordner).

**Wie Stufe 1 gebaut ist:**

- Eine Sendung ist das Markdown, das das Werkzeug ohnehin ablegt, dazu
  Name, Art und die Bilder. Ein Paket ist eine lesbare Markdown-Datei
  (`.ttrpg.md`); die Verwaltung steht in HTML-Kommentaren.
- Gibt es eine Kennung schon, wird gefragt: daneben legen (Vorgabe),
  übernehmen oder verwerfen. Daneben gelegt bekommt der Eintrag eine freie
  Kennung, eine Notiz auch einen eindeutigen Titel („Der König (2)").
- Eine Notiz geht in eine Kampagne, die der Empfänger wählt. Kennt die
  Kampagne den Notiztyp nicht, wird er mit der Beschriftung des Absenders
  angelegt. Beziehungen auf Notizen, die es beim Empfänger nicht gibt,
  fallen weg.
- Offizielle Regeln reisen als Verweis, Hausregeln ganz, Notizen am
  Regeltext gar nicht.
- Offene Werkzeuge erfahren vom Empfang: der Story Creator liest neu,
  Monster Creator und Nachschlagewerk zeigen den angekommenen Eintrag.
- Geprüft in `packages/austausch` (Paketformat), im Vault-Test des Story
  Creators (Empfang mit Bild und Typ) und im Rauchtest
  `smoke-austausch.cjs` (ganzer Weg, Werkzeuge geschlossen).

## Die Reihenfolge, um die es geht

Der erste Reflex bei diesem Punkt ist die Verbindung — wie finden sich zwei
Rechner, was ist mit dem Router, geht das ohne Server. Das ist der falsche
Anfang.

**Das größere Problem liegt innen.** Ein Werkzeug, das von allen anderen
etwas holt und an alle etwas zurückgibt, braucht eine gemeinsame
Schnittstelle zu ihnen. Die gibt es heute nicht. Es gibt drei Einzelbrücken
zwischen je zwei Werkzeugen:

- Monster Creator → Story Creator (legt eine Notiz an)
- NPC Creator → Story Creator (legt eine Figur an)
- Inspirationshilfe → Karteneditor (beginnt eine Karte)

Jede davon ist für ihren einen Fall gebaut. Ein viertes, fünftes und
sechstes Paar zu verdrahten wäre die Art Wachstum, bei der am Ende niemand
mehr weiß, wer mit wem redet.

Also: **erst die Schnittstelle, dann das Netz.** Die Verbindung ist das
kleinere Problem, und sie ist ohne die Schnittstelle nutzlos.

## Teil 1: Die gemeinsame Schnittstelle

Zwei Sätze, mehr braucht es nicht:

> **„Gib mir deine Einträge."**
> **„Nimm diesen Eintrag an."**

Ein Werkzeug, das mitmacht, beantwortet beide. Ein Werkzeug, das nicht
mitmacht, taucht schlicht nicht auf. Genau dieselbe Form hat gerade die
Einstellungs-Schnittstelle bekommen (`packages/einstellungen`, ein
optionaler Haken je Werkzeug), und sie hat sich bewährt: die Hülle muss über
ein neues Werkzeug nichts wissen.

Was ein Eintrag mitbringen muss:

| Feld | Wozu |
|---|---|
| Werkzeug | Woher er stammt und wohin er zurückgehört |
| Kennung | Damit „derselbe Eintrag" erkennbar ist |
| Name | Zum Anzeigen in der Liste |
| Art | Notiz, Monster, Zustand, Begegnung … |
| Inhalt | Das Markdown, das die Werkzeuge ohnehin schreiben |

**Markdown als Transportform, nicht JSON.** Jedes Werkzeug schreibt seine
Ablage schon so, und wer eine empfangene Datei von Hand aufmacht, soll etwas
lesen können. Das ist dieselbe Entscheidung wie überall in der Sammlung.

### Regeln sind auch Einträge

Das Nachschlagewerk (`docs/nachschlagewerk.md`) hält neben den offiziellen
Regeln die **Hausregeln** des Tisches — wie kritische Treffer gewürfelt
werden, was bei einer langen Rast sonst noch geht. Genau die will man
verschicken: die Gruppe soll nachlesen können, was gilt, ohne zu fragen.

Dabei gilt eine Unterscheidung, die man gleich richtig macht:

- **Eine Hausregel reist ganz**, mit Text. Sie stammt vom Tisch, es gibt sie
  nirgends sonst.
- **Eine offizielle Regel reist nicht, sie wird genannt.** Jede Installation
  hat denselben Bestand; den Text mitzuschicken wäre Ballast. Es genügt die
  Kennung, und beim Empfänger geht die Stelle auf.

Die **Notizen am Regeltext** (kleine Bemerkungen an einer Stelle, siehe
`docs/nachschlagewerk.md`) reisen dagegen gar nicht: sie sind für einen
selbst geschrieben und hängen an einer Textstelle, die beim Empfänger
womöglich anders verläuft. Wer eine Bemerkung teilen will, macht eine
Hausregel daraus — und genau dieser Knopf ist die Brücke zwischen beiden.

Das passt ohne Umbau in die Tabelle oben: eine Hausregel ist ein Eintrag mit
Inhalt, ein Verweis auf eine offizielle Regel einer ohne. Nebenbei erledigt
sich damit die Frage, ob die vorgeschriebene Namensnennung des SRD
mitreisen muss — sie stellt sich nicht, wenn der offizielle Text gar nicht
mitreist.

### Wo Empfangenes landet

Die Ablagen sind heute getrennt: jedes Werkzeug hat seinen eigenen Ordner.
Das soll so bleiben — ein Monster gehört in den Monsterordner, auch wenn es
von jemand anderem kommt.

**Nichts überschreibt stillschweigend.** Kommt ein Eintrag mit einer
Kennung, die es hier schon gibt, wird gefragt: übernehmen, daneben legen
oder verwerfen. „Daneben legen" ist die Vorgabe. Beim Übernehmen die
falsche Fassung zu verlieren ist der Fehler, bei dem jemand Arbeit verliert
— und das ist die Sorte, die diese Sammlung an anderer Stelle schon
konsequent vermeidet.

## Teil 2: Wer was sehen darf

**Die Spielleitung schickt nicht alles an alle.** Ein Monster mit Statblock
an einen Spieler ist ein Spoiler, und ein Werkzeug, das das erst nach dem
Klick merkt, hat den Abend verdorben.

Vorschlag, bewusst einfach:

- **Es wird nur auf Zuruf geschickt.** Kein Abonnement, kein „alles
  synchronisieren". Wer etwas teilt, wählt es aus und wählt, an wen.
- **An alle oder an einen.** Mehr Abstufungen braucht ein Tisch mit fünf
  Leuten nicht.
- **Nichts wird geholt.** Man kann nicht in die Sammlung eines anderen
  sehen und sich etwas nehmen. Das ist keine Sicherheitsmaßnahme, sondern
  eine über die Rolle: die Spielleitung entscheidet, was die Gruppe weiß.

Damit ist die Rechteverwaltung: es gibt keine. Wer sendet, entscheidet. Das
ist für einen Tisch angemessen und spart ein Rollenmodell, das sowieso
niemand pflegt.

## Teil 3: Die Verbindung

Erst hier. Ein benannter Raum mit Passwort, Peer-to-Peer.

### Stufe 1: dasselbe Netz

Im selben WLAN finden sich die Geräte über mDNS/Bonjour und reden direkt
miteinander. Dafür braucht es nichts weiter — **„ohne Server" gilt hier
wirklich.**

Das Passwort regelt den **Zutritt zum Raum**, mehr nicht. Verschlüsselung
ist ein eigener Punkt und kommt extra. Solange sie fehlt, gilt:

> **Alles im Raum liegt für jeden im selben Netz offen.**

Im eigenen WLAN am Spieltisch ist das vertretbar. In einem fremden Netz
(Bibliothek, Laden, Uni) ist es das nicht. **Dieser Satz gehört in die
Oberfläche, nicht nur in diese Datei** — sichtbar, wenn ein Raum aufgemacht
wird, nicht in einer Hilfe, die niemand liest.

### Stufe 2: über das Internet

Hier muss ich der Wunschvorstellung widersprechen: **ohne Server geht das
nicht ganz.**

Über das Internet scheitert Peer-to-Peer fast immer an den Routern (NAT).
Zwei Rechner hinter zwei Anschlüssen finden einander nicht von selbst; es
braucht einen fremden Helfer zum Kennenlernen (STUN, dazu eine Stelle, die
die Kontaktdaten vermittelt). Bei ungünstigen Anschlüssen läuft der Verkehr
sogar dauerhaft über einen Relay — dann ist es kein Peer-to-Peer mehr,
sondern ein Server mit zusätzlichen Schritten.

Daraus folgt:

- „Ohne Server" ist für Stufe 1 zu halten und für Stufe 2 nur mit
  Einschränkung.
- **Über das Internet darf es ohne Verschlüsselung gar nicht erst gehen.**
  Im eigenen WLAN ist offener Verkehr eine vertretbare Abkürzung; über
  fremde Leitungen ist er keine.

Stufe 2 ist damit kein Ausbau von Stufe 1, sondern ein eigener Punkt mit
eigener Entscheidung. Sie gehört nicht in dieselbe Planung.

**Entschieden und gebaut:** der Gastgeber ist der Server. Erreichbar über
Portfreigabe oder IPv6, ohne Vermittler, ohne UPnP, ohne VPN, und nur mit
Passwort und damit verschlüsselt. Wer hinter CGNAT oder DS-Lite sitzt und
kein IPv6 hat, kann so keinen Raum übers Internet öffnen (beitreten geht
trotzdem).

## Was zuerst

Die Reihenfolge fällt aus dem Obigen von selbst:

1. **Die Schnittstelle** in zwei oder drei Werkzeugen. Schon ohne jedes
   Netz nützlich — sie ist das, was eine werkzeugübergreifende Suche
   (Strg+K, steht auch auf der Liste) genauso braucht.
2. **Der Raum im lokalen Netz**, mit dem Hinweis auf offenen Verkehr.
3. **Senden auf Zuruf**, mit der Rückfrage beim Annehmen.
4. *Später und getrennt:* Verschlüsselung, und erst danach das Internet
   (beides gebaut, siehe oben).

Stufe 1 lohnt sich auch allein. Das ist das beste Zeichen dafür, dass der
Schnitt stimmt.

## Zu klären

- **Ob die Schnittstelle dieselbe Form bekommt wie die der Einstellungen.**
  Ich würde ja sagen: ein optionaler Haken je Werkzeug, die Hülle vermittelt.
  Dann gibt es ein Muster statt zweier.
- **Wie ein Raum heißt und wie man beitritt.** Name plus Passwort ist die
  Entscheidung; wie der Name gefunden wird (Liste im Netz? Eintippen?) ist
  offen.
- **Was mit Bildern passiert.** Eine Notiz kann Bilder haben, ein Monster
  nicht. Markdown allein transportiert sie nicht mit — für die erste Fassung
  vermutlich: Text ja, Bilder nein, und das sichtbar sagen.
- **Ob ein Werkzeug offen sein muss, um etwas anzunehmen.** Heute antworten
  nur montierte Werkzeuge auf Anfragen der Hülle. Für Einstellungen ist das
  richtig; für ankommende Einträge wäre es überraschend, wenn ein Monster
  verloren geht, weil der Monster Creator gerade zu ist.
