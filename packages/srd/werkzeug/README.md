# Werkzeuge zur Auslese des SRD

Python, nicht Teil des Builds. Gebraucht werden `pypdf` und `pdfplumber`
(`pip install pypdf pdfplumber`). Aufgerufen aus `packages/srd`:

```
python3 werkzeug/glossar_lesen.py  /tmp/glossar.json   # beide Sprachen auslesen (~1 min)
python3 werkzeug/glossar_pruefen.py /tmp/glossar.json  # Paarliste pruefen, 0 Widersprueche erwartet
python3 werkzeug/glossar_erzeugen.py /tmp/glossar.json # schreibt src/glossar.ts
python3 werkzeug/monster_lesen.py  /tmp/monster.json   # Wertekaesten beider Sprachen (einige Minuten)
python3 werkzeug/monster_erzeugen.py /tmp/monster.json # paart ueber die Zahlen, schreibt src/monster.ts
# Magische Gegenstaende: erst die Zeilen beider PDFs ablegen, dann lesen
python3 -c "import pickle,sys; sys.path.insert(0,'werkzeug'); from monster_lesen import lies_zeilen as z; [pickle.dump(z(s),open(f'/tmp/zeilen_{s}.pkl','wb')) for s in ('en','de')]"
python3 werkzeug/gegenstaende_lesen.py /tmp/zeilen_en.pkl /tmp/zeilen_de.pkl /tmp/gegenstaende.json
python3 werkzeug/gegenstaende_eichung.py /tmp/gegenstaende.json ../magie/src/eichpunkte.ts
python3 werkzeug/gegenstaende_text.py /tmp/zeilen_en.pkl /tmp/zeilen_de.pkl /tmp/gegenstaende.json /tmp/gtext.json
python3 werkzeug/gegenstaende_erzeugen.py /tmp/gtext.json   # schreibt src/magische-gegenstaende.ts
python3 werkzeug/zauber_lesen.py /tmp/zeilen_en.pkl /tmp/zeilen_de.pkl /tmp/zauber.json
python3 werkzeug/zauber_erzeugen.py /tmp/zauber.json   # schreibt src/zauber.ts
python3 werkzeug/ausruestung_lesen.py /tmp/zeilen_en.pkl /tmp/zeilen_de.pkl /tmp/ausruestung.json
python3 werkzeug/ausruestung_erzeugen.py /tmp/ausruestung.json   # schreibt src/ausruestung.ts
python3 werkzeug/tand_lesen.py src/tand.ts             # Trinkets / Requisiten, 1W100, beide Sprachen
```

- `glossar_lesen.py`: Eintraege, Absaetze, Unterpunkte nach Schriftart; die
  ausdrueckliche Liste der Satzfehler des Originals (`KORREKTUREN`).
- `glossar_tabellen.py`: Tabellen und Listen nach der Lage der Woerter.
- `glossar_paare.json`: welcher englische Eintrag welcher deutsche ist, von
  Hand zugeordnet und von `glossar_pruefen.py` gegen Aufbau, Wuerfel, SG und
  Verweise geprueft.
- `gegenstaende_lesen.py`: magische Gegenstaende beider Sprachen, erkannt an
  der Kopfzeile mit Kategorie und Seltenheit. Automatisch gepaart, wo
  Kategorie, Seltenheit, Einstimmung und Zahlen eindeutig sind (106), der
  Rest aus `gegenstaende_paare.json` (152, von Hand, gegen den Rahmen
  geprueft; zwei begruendete Ausnahmen in `ABWEICHUNGEN`).
- `gegenstaende_eichung.py`: Eichpunkte fuer den Magic Item Generator. Welcher
  Gegenstand fuer welche Wirkung steht, ist von Hand gewaehlt (`AUSWAHL`);
  die Zahlen kommen aus dem PDF.
- `tand_lesen.py`: die Tabelle „Trinkets" / „Requisiten", gepaart ueber die
  Nummer; bricht ab, wenn eine der hundert Nummern fehlt.
- `gegenstaende_text.py`: der Text der Gegenstaende als Bloecke wie im
  Glossar. Tabellen ueber den Tabellenbau des Glossars, mit Spalten aus den
  Luecken im Rumpf (`feine_spalten`, nur hier); nebeneinander gesetzte
  Tabellen werden eine, umbrechende mit wiederholtem Kopf auch; Wertekaesten
  zeilentreu; weiche Trennzeichen mitten in der Zeile nach dem Folgezeichen.
  Eine frei stehende Tabelle wird per `VERSCHIEBUNGEN` umgehaengt.
- `gegenstaende_erzeugen.py`: prueft (Paarung, Blockarten, Tabellenform
  beider Sprachen, keine weichen Trennzeichen) und schreibt die Datei.
- `zauber_lesen.py`: die 339 Zauber beider Sprachen. Die Zeilen des Kapitels
  werden erst nach Lage geordnet (im deutschen PDF steht auf Seite 144 die
  rechte Spalte im Datenstrom vor der linken). Gepaart ueber Grad, Schule,
  Klassen, Komponenten, Konzentration, Ritual und Zahlen (317 automatisch),
  der Rest aus `zauber_paare.json` (25, gegen denselben Rahmen geprueft;
  eine begruendete Ausnahme: Hypnotic Pattern hat verschiedene Komponenten).
- `zauber_erzeugen.py`: prueft und schreibt `src/zauber.ts`.
- `ausruestung_lesen.py`: das Kapitel Ausruestung beider Sprachen (180
  Eintraege). Wie das Glossar: eine Ueberschrift mit Text ist ein Eintrag,
  die Angaben der Werkzeuge („Ability: …") werden Unterpunkte. Die
  Tabellen mit Titel werden aus dem Textfluss genommen und per
  `TABELLE_ZU` an ihren Eintrag gehaengt (im Druck stehen sie, wo Platz
  war); die drei seitenbreiten (`BREIT`) nehmen alles in ihrem Band mit.
  Zwischenzeilen („Simple Melee Weapons") zaehlen nicht fuer die
  Spaltenluecken (`zwischenzeilen`, nur hier), die Tabelle „Essen, Trinken
  und Unterkunft" steht zweimal nebeneinander und wird untereinander
  gelesen. Infokaesten (`KASTEN`) werden eigene Eintraege. Zwei
  Trennfehler im deutschen Druck stehen in `KORREKTUREN`, jede muss
  greifen. Gepaart ueber Abschnitt, Preis, Tabellenform und Zahlen (64),
  der Rest aus `ausruestung_paare.json` (116, gegen Abschnitt, Preis und
  Tabellenform geprueft).
- `ausruestung_erzeugen.py`: prueft und schreibt `src/ausruestung.ts`.
