# Drittinhalte und Namensnennung

Der Quelltext von LORE steht unter der AGPL-3.0-or-later (siehe
[LICENSE](LICENSE)). Einzelne **Daten** darin stammen aus fremden Werken, die
unter anderen Lizenzen stehen. Diese Lizenzen verlangen eine Namensnennung,
und die steht hier.

**Ausnahme: die Symbole.** Die Bilder in `apps/shell/symbole/` stehen nicht
unter der AGPL, sondern: Copyright © ItsLunasDream, alle Rechte vorbehalten
(siehe [apps/shell/symbole/LIZENZ.md](apps/shell/symbole/LIZENZ.md)). Wer
LORE verändert weitergibt, ersetzt sie oder lässt sie weg.

Diese Datei ist nicht schmückendes Beiwerk: sie wegzulassen wäre ein
Lizenzbruch. Wer LORE weitergibt — als Quelltext, als Installer oder
als veränderte Fassung —, gibt sie mit.

---

## Lazy GM's 5e Monster Builder Resource Document

Betrifft: `apps/monster/src/shared/richtwerte.ts` (die Richtwerte je
Herausforderungsgrad) und `apps/monster/src/shared/eichung.ts` (die sieben
Musterblöcke, die als Eichdaten dienen).

> This work includes material taken from the [Lazy GM's 5e Monster Builder
> Resource Document](https://slyflourish.com/lazy_5e_monster_building_resource_document.html)
> written by Teos Abadía of [Alphastream.org](https://alphastream.org), Scott
> Fitzgerald Gray of [Insaneangel.com](https://insaneangel.com), and Michael
> E. Shea of [SlyFlourish.com](https://slyflourish.com), available under a
> [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).

Das Material ist copyright 2023 Scott Fitzgerald Gray, Teos Abadía und
Michael E. Shea.

## System Reference Document 5.1

Betrifft: dieselben Dateien, mittelbar — das Dokument oben enthält seinerseits
Material aus dem SRD 5.1.

> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> <https://dnd.wizards.com/resources/systems-reference-document>. The SRD 5.1
> is licensed under the Creative Commons Attribution 4.0 International License
> available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Systemreferenzdokument 5.2.1

Betrifft: `packages/srd/` — die Zustände, die Schwierigkeitszahlen des
Encounter Creators, die Regeltexte des Nachschlagewerks und später die
Eichgegenstände des Magic Item Generators.

Anders als beim SRD 5.1 oben ist das hier **unmittelbar**: das Material kommt
direkt aus dem SRD 5.2.1, nicht über ein drittes Dokument. Beide
Sprachfassungen des Dokuments liegen unter `packages/srd/quelle/`, damit sich
jede Zahl und jeder Satz nachprüfen lässt.

Die vorgeschriebene Namensnennung, englisch:

> This work includes material from the System Reference Document 5.2.1
> ("SRD 5.2.1") by Wizards of the Coast LLC, available at
> <https://www.dndbeyond.com/srd>. The SRD 5.2.1 is licensed under the
> Creative Commons Attribution 4.0 International License, available at
> <https://creativecommons.org/licenses/by/4.0/legalcode>.

Und deutsch:

> Dieses Werk enthält Material aus dem Systemreferenzdokument 5.2.1
> („SRD 5.2.1") von Wizards of the Coast LLC, verfügbar unter
> <https://www.dndbeyond.com/srd>. Das SRD 5.2.1 ist lizenziert gemäß
> Creative Commons Namensnennung 4.0 International Public License
> (verfügbar unter <https://creativecommons.org/licenses/by/4.0/legalcode.de>).

Diese Sätze sind **wörtlich vorgeschrieben** und stehen genauso im Über-Dialog
der Anwendung; im Code liegen sie in `packages/srd/src/namensnennung.ts`.

Wizards of the Coast verlangt ausdrücklich, dass darüber hinaus **keine
weitere Nennung** von Wizards oder seinen Konzerngesellschaften erfolgt.
Ausgenommen ist laut Dokument genau eine Ergänzung: der Hinweis, dass ein
Werk „kompatibel mit der fünften Edition" oder „5E-kompatibel" ist. Diese
Sammlung macht davon keinen Gebrauch, weil sie ihn nicht braucht. Wer sonst
etwas hinzufügt, verletzt die Bedingung, unter der das Material überhaupt
benutzt werden darf.

Das SRD 5.2.1 steht unter der
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode).

---

## Was hier ausdrücklich NICHT liegt

Aus dem *Dungeon Master's Guide* stammt nichts. Dessen Kapitel zum Monsterbau
steht nicht im SRD und ist nicht frei lizenziert — auch nicht „nur die
Zahlen". Wer die Richtwerte erweitert, nimmt sie aus einer Quelle, deren
Lizenz das erlaubt, und trägt sie hier ein.

## Schriften

Der Charakterbogen liefert freie Schriften mit (Alegreya, Cinzel, IM Fell
English, MedievalSharp, Uncial Antiqua, Caveat). Sie stehen unter der SIL
Open Font License 1.1; Urheber und Lizenztexte stehen in
[apps/charakterbogen/SCHRIFTEN.md](apps/charakterbogen/SCHRIFTEN.md).

## Bibliotheken

Die Abhängigkeiten aus `node_modules` sind nicht einzeln aufgeführt; ihre
Lizenzen liegen in den Paketen selbst. Stand der letzten Durchsicht waren sie
sämtlich permissiv (MIT, ISC, Apache-2.0, BSD, BlueOak).
