/**
 * Die Texte des Loot Generators. Paarweise `[de, en]` wie in den anderen
 * Werkzeugen. Nur die Oberflaeche: die Tabellen selbst werden nicht
 * uebersetzt (siehe docs/loot.md).
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Loot Generator', 'Loot Generator'],
  untertitel: [
    'Eigene Zufallstabellen schreiben, verschachteln und würfeln.',
    'Write, nest and roll your own random tables.'
  ],
  'liste.leer': ['Noch keine Tabellen.', 'No tables yet.'],
  'liste.anzahl': ['{anzahl} Tabellen', '{anzahl} tables'],
  'liste.eine': ['1 Tabelle', '1 table'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'liste.suche': ['Suchen', 'Search'],
  neu: ['Neue Tabelle', 'New table'],
  'neu.name': ['Tabelle', 'Table'],
  einlesen: ['Einlesen', 'Import'],
  'einlesen.fertig': ['Eingelesen: {namen}', 'Imported: {namen}'],
  'einlesen.nichts': ['Keine Tabelle in der Datei gefunden.', 'No table found in the file.'],
  weitergeben: ['Weitergeben', 'Share'],
  'weitergeben.fertig': ['Gespeichert unter {pfad}', 'Saved to {pfad}'],
  'weitergeben.erst': ['Erst speichern, dann weitergeben.', 'Save first, then share.'],
  speichern: ['Speichern', 'Save'],
  gespeichert: ['Gespeichert.', 'Saved.'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['„{name}" wirklich löschen?', 'Really delete “{name}”?'],
  'verwerfen.sicher': ['Ungespeicherte Änderungen verwerfen?', 'Discard unsaved changes?'],
  zurueck: ['Zurück zur Liste', 'Back to the list'],
  wuerfeln: ['Würfeln', 'Roll'],
  schnell: ['Einmal würfeln', 'Roll once'],
  'wurf.anzahl': ['Anzahl', 'Count'],
  'wurf.leer': ['Diese Tabelle hat noch keine Einträge.', 'This table has no entries yet.'],
  'wurf.herkunft': ['Woher', 'Where from'],
  'wurf.kopieren': ['Kopieren', 'Copy'],
  'wurf.kopiert': ['Kopiert.', 'Copied.'],
  story: ['In den Story Creator', 'To the Story Creator'],
  'story.titel': ['Beute: {name}', 'Loot: {name}'],
  'story.fertig': ['Als Notiz angelegt: {text}', 'Created as a note: {text}'],
  'story.fehler': ['Nicht angelegt: {text}', 'Not created: {text}'],
  'wurf.letzter': ['Letzter Wurf', 'Last roll'],
  'wurf.unvollstaendig': ['Nicht alles ließ sich auflösen, siehe „Woher".', 'Not everything could be resolved, see “Where from”.'],
  'baum.fehlt': ['„{name}" gibt es nicht', '“{name}” does not exist'],
  'baum.zutief': ['„{name}": zu tief verschachtelt, hier abgebrochen', '“{name}”: nested too deeply, stopped here'],
  'baum.kreis': ['„{name}": Kreisverweis, hier abgebrochen', '“{name}”: circular reference, stopped here'],
  'baum.zuviel': ['„{name}": zu viele Würfe auf einmal, hier abgebrochen', '“{name}”: too many rolls at once, stopped here'],
  'befund.verweis-kreis': [
    '„[{name}]" führt über Verweise wieder hierher zurück; der Kreis wird beim Würfeln abgebrochen.',
    '“[{name}]” leads back here through references; the loop is cut off when rolling.'
  ],
  'befund.ohne-nummer': [
    'Die Tabelle hat Nummern, {anzahl} Zeile(n) aber keine: diese kämen nie dran.',
    'The table has numbers, but {anzahl} line(s) have none: they would never come up.'
  ],
  'zurueckgelegt': ['Gezogenes zurücklegen', 'Put drawn entries back'],
  'zurueckgelegt.hinweis': [
    'Ohne Zurücklegen: {n} von {m} schon gezogen, auch über mehrere Würfe.',
    'Without replacement: {n} of {m} already drawn, across several rolls.'
  ],
  'feld.name': ['Name', 'Name'],
  'feld.wuerfel': ['Würfel', 'Die'],
  'feld.wuerfelHinweis': ['z. B. 1d6 oder 1W100, leer = alle gleich', 'e.g. 1d6 or 1d100, empty = all equal'],
  'feld.ohneZuruecklegen': ['Ohne Zurücklegen', 'Without replacement'],
  'feld.ohneZuruecklegenHinweis': [
    'Bei mehreren Würfen kommt kein Eintrag doppelt, bis alle dran waren.',
    'When rolling several times, no entry repeats until all have come up.'
  ],
  'feld.eintraege': ['Einträge', 'Entries'],
  'feld.eintraegeHinweis': [
    'Eine Zeile je Eintrag. Die Nummern kommen von selbst, sobald du das Feld verlässt; ändern kannst du sie vorne in der Zeile, auch als Spanne: „1-3: 2d6 × 10 Kupfer". Andere Tabelle in eckigen Klammern: „[Taschenkram]"; nach „[" kommen Vorschläge. Würfel im Text werden ausgerechnet.',
    'One line per entry. Numbers are added when you leave the field; change them at the start of the line, also as a range: “1-3: 2d6 × 10 copper”. Another table in square brackets: “[Pocket Junk]”; typing “[” suggests tables. Dice in the text are rolled.'
  ],
  'feld.verweisVorschlaege': ['Passende Tabellen', 'Matching tables'],
  'feld.notiz': ['Notiz', 'Note'],
  'kachel.eintraege': ['{anzahl} Einträge', '{anzahl} entries'],
  'kachel.ohneZuruecklegen': ['ohne Zurücklegen', 'without replacement'],
  'kachel.gleich': ['gleich verteilt', 'equal odds'],
  'kachel.eintrag': ['1 Eintrag', '1 entry'],
  'schnell.gesperrt': ['Würfeln gesperrt: die Nummern passen nicht. Zum Berichtigen öffnen.', 'Rolling is blocked: the numbers do not fit. Open the table to fix it.'],
  'warnung.doppelterName': [
    'Eine andere Tabelle heißt schon „{name}". Verweise [{name}] treffen dann nur eine davon.',
    'Another table is already called "{name}". References [{name}] will then only reach one of them.'
  ],
  'befund.wuerfel-unlesbar': ['„{wuerfel}" ist kein Würfel, den das Werkzeug lesen kann.', '“{wuerfel}” is not a die the tool can read.'],
  'befund.spannen-ohne-wuerfel': [
    'Einträge haben Spannen, die Tabelle aber keinen Würfel: alle Einträge sind gleich wahrscheinlich.',
    'Entries have ranges but the table has no die: all entries are equally likely.'
  ],
  'befund.wuerfel-ohne-spannen': [
    'Die Tabelle hat einen Würfel, die Einträge aber keine Spannen: alle Einträge sind gleich wahrscheinlich.',
    'The table has a die but the entries have no ranges: all entries are equally likely.'
  ],
  'befund.luecke': ['Lücke {von}–{bis}: keine Zeile hat diese Nummern.', 'Gap {von}–{bis}: no line has these numbers.'],
  'befund.luecke1': ['Lücke bei {von}: keine Zeile hat diese Nummer.', 'Gap at {von}: no line has this number.'],
  'befund.doppelt': ['Die {zahl} ist zweimal vergeben.', '{zahl} is used twice.'],
  'wurf.gesperrt': ['Würfeln geht erst, wenn die Nummern passen:', 'Rolling is blocked until the numbers fit:'],
  'befund.ausserhalb': ['Die {zahl} kann der Würfel nicht zeigen.', 'The die cannot show {zahl}.'],
  'befund.verweis-fehlt': ['„[{name}]" zeigt auf keine Tabelle.', '“[{name}]” points to no table.'],
  'befund.verweis-selbst': [
    'Die Tabelle verweist auf sich selbst; nach zehn Ebenen bricht der Wurf ab.',
    'The table refers to itself; a roll stops after ten levels.'
  ],
  srd: ['SRD', 'SRD'],
  'srd.hinweis': [
    'Aus dem SRD 5.2.1, schreibgeschützt. Würfeln geht, ändern nur als Kopie.',
    'From the SRD 5.2.1, read-only. You can roll it; to change it, make a copy.'
  ],
  'mi.marke': ['Magic Items', 'Magic Items'],
  'mi.hinweis': [
    'Aus dem Magic Item Generator. Geändert wird dort; hier nur würfeln oder als eigene Tabelle kopieren.',
    'From the Magic Item Generator. Edit it there; here you can roll it or copy it as your own table.'
  ],
  'srd.kopie': ['Als eigene Tabelle kopieren', 'Copy as your own table'],
  'srd.kopieName': ['{name} (Kopie)', '{name} (copy)'],
  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': ['Diese Tabelle ließ sich nicht öffnen.', 'This table could not be opened.']
} as const;

export type TextKey = keyof typeof TEXTE;

let sprache: Language = DEFAULT_LANGUAGE;

export function setLanguage(neu: Language): void {
  sprache = neu;
}

export function getLanguage(): Language {
  return sprache;
}

export function t(key: TextKey, params?: Record<string, string | number>): string {
  const paar = TEXTE[key];
  let text: string = sprache === 'de' ? paar[0] : paar[1];
  if (params) {
    for (const [name, wert] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(wert));
    }
  }
  return text;
}
