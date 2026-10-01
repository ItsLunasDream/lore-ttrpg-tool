/**
 * Die Texte des Campaign Calendar, paarweise `[de, en]`.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Campaign Calendar', 'Campaign Calendar'],
  untertitel: [
    'Termine finden wie bei Crab.fit: alle markieren, wann sie können, die Heatmap zeigt die besten Abende.',
    'Find dates like on Crab.fit: everyone marks when they can, the heatmap shows the best evenings.'
  ],
  'neu': ['Neue Umfrage', 'New poll'],
  'einlesen': ['Datei einlesen', 'Import file'],
  'eingelesen': ['Eingelesen und zusammengeführt.', 'Imported and merged.'],
  'liste.leer': ['Noch keine Umfrage. Lege eine an oder lies eine Datei ein.', 'No poll yet. Create one or import a file.'],
  'naechste': ['Nächste Termine', 'Upcoming sessions'],
  'umfragen': ['Umfragen', 'Polls'],
  'antworten': ['{n} Antworten', '{n} answers'],
  'ohneTitel': ['Ohne Titel', 'Untitled'],
  zurueck: ['Zurück', 'Back'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['Umfrage „{name}" löschen?', 'Delete poll “{name}”?'],
  'feld.titel': ['Titel', 'Title'],
  'feld.titelPlatz': ['z. B. Sitzung 13', 'e.g. Session 13'],
  einstellungen: ['Zeitraum und Uhrzeit', 'Dates and times'],
  'feld.von': ['Von', 'From'],
  'feld.bis': ['Bis', 'To'],
  'feld.tage': ['Wochentage', 'Weekdays'],
  'feld.uhrVon': ['Ab', 'From'],
  'feld.uhrBis': ['Bis', 'Until'],
  'feld.schritt': ['Raster', 'Grid'],
  'feld.dauer': ['Dauer einer Sitzung', 'Session length'],
  'minuten': ['{n} Min.', '{n} min'],
  'stunden': ['{n} Std.', '{n} h'],
  'ich': ['Ich antworte als', 'I answer as'],
  'ich.platz': ['Dein Name', 'Your name'],
  'ich.fehlt': ['Erst einen Namen eintragen, dann markieren.', 'Enter a name first, then mark.'],
  'modus.kann': ['Kann', 'Available'],
  'modus.notfalls': ['Notfalls', 'If need be'],
  'meine': ['Meine Zeiten', 'My availability'],
  'meine.hinweis': ['Ziehen markiert, nochmal ziehen entfernt.', 'Drag to mark, drag again to remove.'],
  'alle': ['Alle', 'Everyone'],
  'alle.leer': ['Noch niemand hat geantwortet.', 'No one has answered yet.'],
  'beste': ['Beste Termine', 'Best dates'],
  'beste.leer': ['Noch kein Zeitfenster, in dem jemand die ganze Dauer kann.', 'No window yet in which anyone is free for the whole length.'],
  'beste.kann': ['kann: {namen}', 'available: {namen}'],
  'beste.notfalls': ['notfalls: {namen}', 'if need be: {namen}'],
  festlegen: ['Festlegen', 'Set date'],
  'termin': ['Termin', 'Session'],
  'termin.loesen': ['Termin lösen', 'Clear date'],
  ics: ['In den Kalender (.ics)', 'Add to calendar (.ics)'],
  'ics.fertig': ['Gespeichert: {pfad}', 'Saved: {pfad}'],
  teilen: ['Im Raum teilen', 'Share in room'],
  'teilen.fertig': ['Im Raum geteilt. Antworten kommen von selbst zurück.', 'Shared in the room. Answers come back on their own.'],
  'teilen.aus': ['Kein Raum offen. Als Datei weitergeben geht immer.', 'No room open. Passing on as a file always works.'],
  datei: ['Als Datei weitergeben', 'Pass on as file'],
  'datei.fertig': [
    'Gespeichert: {pfad}. Schicke die Datei herum; wer sie einliest, markiert und zurückschickt, landet hier beim Einlesen.',
    'Saved: {pfad}. Send the file around; whoever imports it, marks and sends it back ends up here when you import it.'
  ],
  'fehlen': ['Im Raum, noch ohne Antwort: {namen}', 'In the room, no answer yet: {namen}'],
  'zeitzone': [
    'Uhrzeiten ohne Zeitzone: gedacht für eine Gruppe in derselben Zeitzone.',
    'Times without time zone: meant for a group in the same time zone.'
  ],
  'notiz': ['Notiz', 'Note']
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
