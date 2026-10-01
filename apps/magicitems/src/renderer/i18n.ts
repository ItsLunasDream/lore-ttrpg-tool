/**
 * Die Texte des Magic Item Generators. Paarweise `[de, en]` wie in den
 * anderen Werkzeugen.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Magic Item Generator', 'Magic Item Generator'],
  untertitel: [
    'Magische Gegenstände würfeln, anpassen und ablegen.',
    'Roll, adjust and store magic items.'
  ],
  'liste.leer': ['Noch keine Gegenstände.', 'No items yet.'],
  'liste.anzahl': ['{anzahl} Gegenstände', '{anzahl} items'],
  'liste.eine': ['1 Gegenstand', '1 item'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'liste.suche': ['Suchen', 'Search'],
  'erzeuger.art': ['Art', 'Type'],
  'erzeuger.seltenheit': ['Seltenheit', 'Rarity'],
  'erzeuger.zufall': ['Zufällig', 'Random'],
  'erzeuger.los': ['Würfeln', 'Roll'],
  'erzeuger.fluch': ['Fluch möglich', 'Curse possible'],
  leer: ['Leerer Gegenstand', 'Blank item'],
  speichern: ['Speichern', 'Save'],
  gespeichert: ['Gespeichert.', 'Saved.'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['„{name}" wirklich löschen?', 'Really delete “{name}”?'],
  'erzeuger.naechster': ['Nächster Wurf:', 'Next roll:'],
  'verwerfen.sicher': ['Ungespeicherte Änderungen verwerfen?', 'Discard unsaved changes?'],
  zurueck: ['Zurück zur Liste', 'Back to the list'],
  nochmal: ['Neu würfeln', 'Reroll'],
  'feld.name': ['Name', 'Name'],
  'feld.einstimmung': ['Erfordert Einstimmung', 'Requires attunement'],
  'feld.wirkungen': ['Wirkungen', 'Properties'],
  'feld.wirkungDazu': ['Wirkung', 'Property'],
  'feld.neueWirkung': ['Neue Wirkung hinzufügen:', 'Add new property:'],
  'feld.neuGewuerfelt': ['Gewürfelt', 'Rolled'],
  'feld.neuKi': ['Von der KI', 'From AI'],
  'feld.neuLeer': ['Leer', 'Blank'],
  'feld.wirkungWeg': ['Wirkung entfernen', 'Remove property'],
  'feld.wirkungNeu': ['Diese Wirkung neu würfeln', 'Reroll this property'],
  'feld.wirkungWuerfeln': ['Wirkung würfeln', 'Roll a property'],
  'feld.fluchWuerfeln': ['Fluch würfeln', 'Roll a curse'],
  'feld.fluchNeu': ['Fluch neu würfeln', 'Reroll curse'],
  'feld.fluch': ['Fluch', 'Curse'],
  'feld.fluchHinweis': ['Leer lassen, wenn der Gegenstand nicht verflucht ist.', 'Leave empty if the item is not cursed.'],
  'feld.notiz': ['Notiz', 'Note'],
  'feld.wert': ['Wert: {wert} GM', 'Value: {wert} GP'],
  'wert.hinweis': [
    'Nach der Tabelle „Seltenheit und Wert" des SRD 5.2.1; Tränke und Schriftrollen verbrauchen sich.',
    'From the SRD 5.2.1 “Magic Item Rarities and Values” table; potions and scrolls are consumables.'
  ],
  anpassen: ['Wirkungen für „{seltenheit}" neu würfeln', 'Reroll properties for “{seltenheit}”'],
  'anpassen.sicher': [
    'Die Wirkungen werden durch neu gewürfelte ersetzt. Name, Fluch und Notiz bleiben.',
    'The properties will be replaced by newly rolled ones. Name, curse and note stay.'
  ],
  foundry: ['Als JSON exportieren', 'Export as JSON'],
  'foundry.fertig': ['Als JSON gespeichert: {pfad}', 'Saved as JSON: {pfad}'],
  'foundry.ohneName': ['Erst einen Namen eingeben, dann exportieren.', 'Enter a name before exporting.'],
  'foundry.leer': ['Der Gegenstand hat keine Wirkungen. Trotzdem exportieren?', 'The item has no properties. Export anyway?'],
  loot: ['An den Loot Generator', 'Send to Loot Generator'],
  'loot.drin': ['Im Loot Generator ✓', 'In Loot Generator ✓'],
  'loot.herausHinweis': ['Klicken nimmt ihn wieder aus dem Loot Generator.', 'Click to take it out of the Loot Generator again.'],
  'loot.heraus': ['Aus dem Loot Generator genommen.', 'Taken out of the Loot Generator.'],
  'feld.wertName': ['Wert (GM)', 'Value (GP)'],
  'wert.vorschlag': ['Vorschlag: {wert}', 'Suggested: {wert}'],
  'loot.fertig': ['Steht jetzt im Loot Generator.', 'Now in the Loot Generator.'],
  'loot.fehler': ['Konnte nicht an den Loot Generator geben.', 'Could not send to the Loot Generator.'],
  einstimmung: ['Einstimmung', 'Attunement'],
  verflucht: ['verflucht', 'cursed'],
  'ki.knopf': ['✦ KI fragen', '✦ Ask the AI'],
  'ki.laeuft': ['KI denkt …', 'AI is thinking …'],
  'ki.wunsch': ['Wunsch an die KI (optional)', 'Wish for the AI (optional)'],
  'ki.wunschBeispiel': ['z. B. ein Kompass, der zu verlorenen Dingen zeigt', 'e.g. a compass that points to lost things'],
  'ki.feld': ['Von der KI', 'From the AI'],
  'ki.wirkung': ['✦ Wirkung von der KI', '✦ Property from the AI'],
  'ki.berichtigt': [
    'Die KI lag über der Seltenheit. Gezogen wurde:',
    'The AI went beyond the rarity. Pulled back:'
  ],
  'fehler.kiKeinAnbieter': ['Es ist keine KI eingerichtet.', 'No AI is set up.'],
  'fehler.kiKeinJson': ['Die Antwort war nicht lesbar.', 'The answer could not be read.'],
  'error.aiOther': ['Die KI meldet einen Fehler.', 'The AI reports an error.'],
  'error.aiNoConnection': ['Keine Verbindung zur KI.', 'No connection to the AI.'],
  'error.aiTimeout': ['Die KI antwortet nicht.', 'The AI is not answering.'],
  'error.aiAuth': ['Der API-Schlüssel wird nicht akzeptiert.', 'The API key is not accepted.'],
  'error.aiRateLimit': ['Zu viele Anfragen. Gleich noch einmal.', 'Too many requests. Try again shortly.'],
  'error.aiEmpty': ['Die KI hat nichts geantwortet.', 'The AI returned nothing.'],
  'error.aiHttp': ['Die KI meldet einen Fehler.', 'The AI reports an error.'],
  'error.aiModelMissing': ['Kein Modell eingestellt.', 'No model selected.'],
  'error.aiModelNotInstalled': ['Das Modell ist nicht installiert.', 'The model is not installed.'],
  'error.aiNoKey': ['Kein API-Schlüssel hinterlegt. Eintragen unter „Einstellungen“ in der Titelleiste → KI.', 'No API key stored. Enter it under “Settings” in the title bar → AI.'],
  'error.aiNoModels': ['Keine Modelle gefunden.', 'No models found.'],
  'error.aiRefused': ['Die KI hat die Anfrage abgelehnt.', 'The AI declined the request.'],
  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': ['Dieser Gegenstand ließ sich nicht öffnen.', 'This item could not be opened.']
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
