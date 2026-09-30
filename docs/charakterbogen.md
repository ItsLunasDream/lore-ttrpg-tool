# Konzept: Charakterbogen mit Inventar

Ein kleiner Charakterbogen für D&D 5e (SRD 5.2) mit Inventar, der im Raum
live mitläuft: Spieler sehen und pflegen ihre Figur, die Spielleitung (SL)
hat Zugriff auf alle Bögen, Gegenstände wandern zwischen Figuren, und es gibt
ein gemeinsames Gruppeninventar.

**Stand:** Konzept, nichts davon ist gebaut. Es nimmt `docs/inventar.md`
auf und ersetzt dessen Teil „Im Raum“. Offene Fragen stehen am Ende.

## Abgrenzung

- **Klein** heißt: Werte eintragen und rechnen, was sich sicher rechnen
  lässt (Modifikatoren, Übungsbonus, Summen). Keine Regel-Engine: keine
  Klassenmerkmale, keine automatische Zauberliste, kein Stufenaufstieg mit
  Assistent. Das kann D&D Beyond besser, und es wäre ein eigenes Projekt.
- Ein eigenes Werkzeug mit Kachel („Charakterbogen“), nicht im
  Teilen-Dialog. Beantwortet Frage 1 aus `docs/inventar.md`: Bogen und
  Inventar sind zu groß für einen Dialog.
- Ohne Raum voll nutzbar, als lokale Sammlung von Bögen.

## Der Bogen

| Bereich | Felder | Gerechnet |
| --- | --- | --- |
| Kopf | Name, Spieler:in, Spezies, Klasse(n) mit Stufe, Hintergrund, Porträt | Gesamtstufe, Übungsbonus (+2 bis +6) |
| Attribute | STÄ, GES, KON, INT, WEI, CHA | Modifikator |
| Rettungswürfe | Übung je Attribut | Bonus |
| Fertigkeiten | 18 Fertigkeiten: keine / Übung / Expertise | Bonus, passive Wahrnehmung |
| Kampf | RK, Initiative (überschreibbar), Bewegung, Trefferwürfel (gesamt/übrig) | Initiative aus GES |
| Trefferpunkte | Maximum, aktuell, temporär | Anzeige „34 / 41 (+5)“ |
| Zustand | Zustände aus dem SRD, Erschöpfung 0–6, Todesrettungswürfe, Heldische Inspiration | |
| Angriffe | freie Zeilen: Name, Angriffsbonus, Schaden, Notiz | |
| Zauber (optional) | Zauberattribut, Plätze je Grad (max/verbraucht) | Zauber-SG, Angriffsbonus |
| Inventar | siehe unten | Gewicht, Wert, Traglast |
| Notizen | Markdown | |

Eingaben mit Rechnung wie im Initiative Tracker: Ins TP-Feld `-7` schreiben
zieht ab, `+5` heilt; Schaden frisst zuerst die temporären TP.

Kurze Rast und lange Rast als Knöpfe: lange Rast füllt TP und Zauberplätze
und gibt die Hälfte der Trefferwürfel zurück (Regel des SRD, beim Bauen gegen
den Text prüfen). Was genau zurückkommt, zeigt der Knopf vorher an.

## Inventar

Übernimmt `docs/inventar.md`: eigene Gegenstände (Name, Beschreibung,
Anzahl, Gewicht, Wert), dazu Magic Items, SRD-Ausrüstung und Loot als Kopie
mit Herkunft; Münzen als fünf Zähler (KM, SM, EM, GM, PM); Summen für
Gewicht und Wert; Traglast aus STÄ.

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
- Die Rollen kennt der Gastgeber und verteilt sie mit der Personenliste. Sie
  gelten für die Dauer des Raums. Beim nächsten Raum mit demselben Namen
  schlägt die App die letzten Rollen nach Namen vor, setzt sie aber nicht
  von selbst.

**Freigabe eines Bogens** für die anderen Spieler:innen, einstellbar je
Bogen: *nichts*, *Übersicht* (Name, Klasse, Stufe, TP-Stufe, RK, Zustände)
oder *alles*. Die SL sieht immer alles. Vorgabe: Übersicht.

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
  sichern“). Gruppeninventare speichern alle SL und der Gastgeber.
- **Gastgeber geht**: Der Raum endet ohnehin (so ist er gebaut). Alle haben
  den letzten verteilten Stand; nichts geht verloren, was schon angekommen
  war.

### Sachen teilen

- **Gegenstand geben**: Rechtsklick → „Geben an …“ (Person oder
  Gruppeninventar). Im Raum ist das ein Schritt beim Gastgeber: aus dem einen
  Inventar heraus, ins andere hinein, in einem Zug. Mit Anzahl („3 von 10
  Pfeilen“). Die SL kann auch zwischen zwei fremden Bögen verschieben.
- **Münzen geben** genauso, als Betrag.
- **Aus dem Gruppeninventar nehmen**: je Gruppeninventar einstellbar, ob
  Spieler:innen selbst nehmen dürfen oder nur die SL verteilt.
- **Einen Bogen oder Gegenstand als Kopie teilen**: wie heute über
  Teilen → Paket; landet beim Empfänger als eigener, nicht verknüpfter Bogen.

### Übertragung

Über den bestehenden Raum, Nachrichtentyp `werkzeug` mit
`werkzeug: 'charakterbogen'` (wie die geteilte Initiative). Die Hülle liest
den Inhalt nicht; das Werkzeug prüft ihn. Die Rollen gehören der Hülle
(sie gelten für alle Werkzeuge, siehe unten) und brauchen zwei neue
Nachrichten im Raumprotokoll: `rollen` (Gastgeber an alle) und
`rolleSetzen` (Anfrage an den Gastgeber). Das Protokoll bekommt dafür
Fassung 3.

**Grenze:** Der Gastgeber prüft die Rechte. Wer den Raum hält, könnte mit
einer veränderten App alles ändern. Für eine Runde unter Bekannten reicht
das; es sollte aber in der Oberfläche nicht nach mehr aussehen.

## Andere Werkzeuge

- **Initiative Tracker**: Spielerfiguren aus den Bögen übernehmen (Name,
  RK, TP, Initiativebonus). Schaden im geteilten Kampf schreibt in den Bogen
  und umgekehrt. Heute ordnet der Tracker Figuren einer Person zu; das
  würde zur Zuordnung zu einem Bogen.
- **SL-Rolle für alle Werkzeuge**: Der Würfel schickt heute „Nur an SL“ an
  den Gastgeber. Mit Rollen ginge das an alle SL. Ebenso im geteilten Kampf.
- **Encounter Creator**: Gruppengröße und Stufen aus den Bögen im Raum.
- **Loot Generator**: „Ins Inventar“ zeigt auch die Gruppeninventare.
- **Story Creator**: Bogen als Notiz exportieren (Werte als Steckbrief).

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
    klassen: { name: string; stufe: number }[];
    spezies: string;
    hintergrund: string;
    attribute: Record<'sta' | 'ges' | 'kon' | 'int' | 'wei' | 'cha', number>;
    rettung: string[];                        // Attribute mit Übung
    fertigkeiten: Record<string, 1 | 2>;      // 1 = Übung, 2 = Expertise
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
    zauber?: { attribut: string; plaetze: { grad: number; max: number; verbraucht: number }[] };
  };
  muenzen: { km: number; sm: number; em: number; gm: number; pm: number };
  gegenstaende: InventarGegenstand[];         // aus docs/inventar.md
  notizen: string;
  fassung: number;
}
```

## Reihenfolge

1. Werkzeug, Ablage, Bogen ohne Raum (Werte, Rechnungen, TP-Eingabe).
2. Inventar nach `docs/inventar.md` (eigene Gegenstände, Summen, Münzen).
3. Rollen in Hülle und Raumprotokoll (SL, mehrere SL, übertragen).
4. Bögen im Raum: Gastgeber führt, Schritte, Freigabe, Sichtbarkeit.
5. Geben zwischen Bögen und Gruppeninventar.
6. Quellen fürs Inventar (Magic Items, SRD, Loot) und Initiative-Anbindung.

Schritt 3 lohnt sich auch allein: Würfel und Initiative profitieren sofort.

## Zu klären

1. Nur D&D 5e (2024), oder soll der Bogen später andere Systeme tragen? Das
   Datenmodell oben ist bewusst 5e-spezifisch.
2. Zauber: reichen Plätze und SG, oder braucht es eine Zauberliste (dann
   mit Verweis ins Nachschlagewerk)?
3. Dürfen Spieler:innen standardmäßig aus dem Gruppeninventar nehmen?
4. Sollen die Rollen den Raum überdauern (gemerkt nach Name), oder jedes Mal
   neu vergeben werden? Vorschlag oben: vorschlagen, nicht setzen.
5. Soll die SL Änderungen an Spielerbögen sichtbar markieren („von der SL
   geändert“), oder still?
6. Gehört das Gruppeninventar dem Raum (weg, wenn der Raum endet, außer
   jemand speichert) oder immer einer SL?
