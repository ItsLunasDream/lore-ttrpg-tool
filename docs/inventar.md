# Konzept: Inventar im Teilen-Dialog

Ein Inventar für die Gruppe am Tisch: wer trägt was, wie schwer ist es, was
ist es wert. Es sitzt im Dialog „Teilen" (der Share-App der Hülle), weil es
dort ohnehin um Dinge geht, die zwischen Personen wandern, und weil der Raum
dort schon offen ist.

**Stand:** Konzept, nichts davon ist gebaut. Offene Fragen stehen am Ende.
Der Charakterbogen (`docs/charakterbogen.md`) nimmt dieses Inventar auf und
ersetzt den Abschnitt „Im Raum“; Frage 1 und 4 beantwortet er dort.

## Was es können soll

- Mehrere Inventare in der Sammlung: je Figur eines und eines für die Gruppe
  („Gemeinsame Beute", die Truhe im Lager, das Packpferd).
- Gegenstände hinzufügen aus vier Quellen:
  1. **Eigene Gegenstände**, so unkompliziert wie auf D&D Beyond.
  2. **Magic Items** aus der Sammlung des Magic Item Generators.
  3. **SRD**: Ausrüstung (Waffen, Rüstungen, Werkzeug, Abenteuerausrüstung)
     und magische Gegenstände aus `packages/srd`.
  4. **Loot**: ein Wurf des Loot Generators, Zeile für Zeile.
- Anzahl ändern, verschieben (von Figur zu Figur oder in die Gruppe),
  löschen.
- Summen: Gesamtgewicht und Gesamtwert je Inventar.

## Eigene Gegenstände

Ein kleiner Dialog, fünf Felder, mehr nicht:

| Feld         | Vorgabe | Hinweis                                       |
|--------------|---------|-----------------------------------------------|
| Name         | leer    | Pflicht, sonst nichts                         |
| Beschreibung | leer    | Mehrzeilig, Markdown wie im Story Creator     |
| Anzahl       | 1       | Ganze Zahl ab 1                               |
| Gewicht      | leer    | Pfund je Stück, Kommazahl erlaubt             |
| Goldwert     | leer    | GM je Stück, Kommazahl erlaubt (0,1 = 1 SM)   |

Leer heißt „unbekannt" und nicht 0: eine Summe, in der unbekannte Werte
stecken, sagt das dazu („mindestens 34 lb"). Gewicht und Wert gelten **je
Stück**, wie auf D&D Beyond; die Zeile zeigt beides, Stück und Summe.

„Anlegen" schließt den Dialog, „Anlegen und nächster" lässt ihn offen und
leert die Felder. Wer nach einem Kampf zehn Dinge einträgt, klickt sonst
zehnmal auf „Hinzufügen".

## Gegenstände aus anderen Quellen

Ein Dialog „Hinzufügen" mit Suche oben und Filter-Chips wie im Teilen-Dialog:
*Eigene*, *Magic Items*, *SRD-Ausrüstung*, *SRD magisch*. Die Auswahlliste
kann dieselbe sein wie beim Teilen (`Auswahl.tsx`), mit Vorschau beim
Darüberfahren.

**Übernommen wird eine Kopie**, kein Verweis. Name, Beschreibung, Gewicht
und Wert stehen danach im Inventar selbst. Grund: ein Inventar ist ein
Spielstand. Ändert jemand später den Gegenstand im Magic Item Generator, soll
sich nicht still das Schwert in der Tasche einer Figur mitändern. Die
Herkunft wird mitgeschrieben (Quelle und Kennung), damit man den Eintrag
von Hand „auffrischen" kann.

Was die Quellen hergeben:

| Quelle              | Name | Beschreibung | Gewicht | Wert |
|---------------------|------|--------------|---------|------|
| Magic Item Generator  | ja   | Wirkungen, Fluch, Notiz | nein | ja (`wert`) |
| SRD magisch         | ja   | Text         | nein    | nein, siehe unten |
| SRD Waffen/Rüstung  | ja   | Text         | aus der Tabelle | aus der Tabelle |
| SRD Abenteuerausrüstung | ja | Text       | zu prüfen | zu prüfen |
| Loot                | ja   | die Zeile    | nein    | nur Münzen |

Zu den Lücken, ehrlich:

- **Gewicht und Preis im SRD** stehen nicht als eigene Felder in
  `packages/srd`, sondern in den Tabellen der Abschnitte „Weapons" und
  „Armor" (Spalten Cost und Weight). Für Abenteuerausrüstung und Werkzeug
  steht der Preis zwar in der Kennung („alchemist-s-fire-50-gp"), ob das
  Gewicht irgendwo maschinenlesbar steht, habe ich nicht geprüft. Beim
  Bauen muss daraus eine kleine Tabelle `gewichtUndPreis` in
  `packages/srd` werden; was fehlt, bleibt leer statt geraten.
- **Magische Gegenstände des SRD** haben keinen Preis. Der Magic Item
  Creator hat eine Werttabelle nach Seltenheit; die kann als Vorschlag
  dienen („Selten: 4.000 GM"), gekennzeichnet als Schätzung.

### Loot

Im Loot Generator bekommt das Ergebnis eines Wurfs einen Knopf „Ins
Inventar". Er fragt, in welches, und legt je Zeile einen Gegenstand an.
Münzen („37 GM", „2d6 × 10 SM" nach dem Wurf) werden erkannt und landen im
Münzbeutel des Inventars statt als Gegenstand. Verweist eine Zeile auf ein
Magic Item der Sammlung, kommt der ganze Gegenstand mit.

## Münzen (Vorschlag)

Fünf Zähler je Inventar: KM, SM, EM, GM, PM. Ohne sie landet jede
Beute-Münze als Gegenstand „37 GM" in der Liste, und rechnen lässt sich
damit nicht. Der Gesamtwert zählt die Münzen mit. Umrechnen („alles in
GM") ist ein eigener Knopf, nicht automatisch.

## Traglast (Vorschlag)

Wenn eine Figur einen Stärkewert hat: Traglast nach der Tabelle „Carrying
Capacity" des SRD (abhängig von der Größe; die genauen Faktoren beim Bauen
aus der Tabelle übernehmen) und eine Anzeige „34 / 150 lb". Ohne Stärkewert keine Anzeige, keine Warnung.
Das ist bewusst schwach: das Werkzeug soll zählen, nicht die Regeln
durchsetzen.

## Im Raum

Das Inventar lebt beim Einzelnen. Der Raum bekommt zwei Wege:

- **Gegenstand geben:** Rechtsklick → „Geben an …" schickt den Eintrag als
  Paket an eine Person. Beim Empfänger fragt der Ankunftsdialog, in welches
  Inventar er soll. Beim Geber verschwindet er erst, wenn der Empfänger
  angenommen hat.
- **Gruppeninventar zeigen:** Die Spielleitung kann das Gruppeninventar
  lesend teilen; alle sehen dieselbe Liste, ändern kann nur, wer sie
  angelegt hat. Mitschreiben aller wäre schöner, braucht aber
  Konfliktlösung, und die gehört nicht in die erste Fassung.

## Ablage

Je Inventar eine Markdown-Datei im Ordner der Hülle
(`userData/austausch/inventare/<id>.md`), wie bei den anderen Werkzeugen:
Kopf mit Name, Münzen und Schema, darunter je Gegenstand ein Abschnitt. So
lässt sich ein Inventar auch mit dem vorhandenen Teilen weitergeben und in
der Sicherung der Sammlung mitnehmen.

Ein Gegenstand im Datenmodell:

```ts
interface InventarGegenstand {
  id: string;
  name: string;
  beschreibung: string;      // Markdown
  anzahl: number;            // ab 1
  gewicht: number | null;    // lb je Stück, null = unbekannt
  wert: number | null;       // GM je Stück, null = unbekannt
  quelle?: { art: 'magicitem' | 'srd' | 'loot'; kennung: string };
  ausgeruestet?: boolean;    // spaeter
  eingestimmt?: boolean;     // spaeter, fuer Magic Items
}
```

## Oberfläche

- Neuer Reiter **„Inventar"** im Teilen-Dialog, neben „Raum" und
  „Weitergeben".
- Links die Inventare (Figuren und Gruppe), rechts die Liste des gewählten:
  Name, Anzahl, Gewicht, Wert, Summenzeile unten. Ein Klick klappt die
  Beschreibung auf.
- Oben „+ Eigener Gegenstand" und „+ Aus der Sammlung".
- Ziehen zwischen Inventaren verschiebt; mit Strg kopiert es.

## Reihenfolge

1. Datenmodell, Ablage, eigene Gegenstände, Liste mit Summen.
2. Hinzufügen aus Magic Items und SRD (mit der Tabelle `gewichtUndPreis`).
3. Loot: Knopf „Ins Inventar" und Münzbeutel.
4. Raum: Geben und Gruppeninventar lesend teilen.
5. Traglast, Ausgerüstet/Eingestimmt, Export als Markdown.

## Zu klären

1. Gehört das Inventar wirklich in den Teilen-Dialog, oder als eigene
   Kachel mit eigener Schiene? Im Dialog ist es schnell zur Hand, aber der
   Dialog wird damit voller.
2. Münzen als eigene Zähler, ja oder nein?
3. Traglast anzeigen, ja oder nein?
4. Soll die Spielleitung die Inventare der Spieler sehen können (nur mit
   deren Freigabe)?
5. Gewicht in Pfund (wie im SRD) oder umschaltbar auf kg?
