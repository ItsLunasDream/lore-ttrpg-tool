/** Texte der Inspirationshilfe, Deutsch und Englisch paarweise. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const texte = {
  'app.title': ['Inspirationshilfe', 'Inspiration'],
  'app.unterzeile': [
    'Ein Gerüst für eine Kampagne: wer will was, wer steht wem im Weg, wo passiert es.',
    'A scaffold for a campaign: who wants what, who is in whose way, where it happens.'
  ],

  'regler.umfang': ['Umfang', 'Scope'],
  'regler.region': ['Region', 'Region'],
  'regler.thema': ['Thema', 'Theme'],
  'regler.tonfall': ['Tonfall', 'Tone'],
  'regler.beliebig': ['beliebig', 'any'],
  'regler.frei': [
    'Eigener Text ist erlaubt — er schränkt die Tabellen dann nicht ein.',
    'Your own wording is fine — it simply does not narrow the tables.'
  ],
  'regler.nurKi': [
    'Eigene Angaben ({eigene}) kennen die Tabellen nicht — gewürfelt wird ohne sie. Die KI-Knöpfe nehmen sie mit.',
    'Your own wording ({eigene}) means nothing to the tables — rolling ignores it. The AI buttons take it along.'
  ],
  'regler.nurKiOhne': [
    'Eigene Angaben ({eigene}) kennen die Tabellen nicht — gewürfelt wird ohne sie. Mit eingerichteter KI ließe sich damit etwas anfangen.',
    'Your own wording ({eigene}) means nothing to the tables — rolling ignores it. With an AI set up, it would be put to use.'
  ],

  'knopf.allesWuerfeln': ['Alles würfeln', 'Roll everything'],
  'knopf.nochmal': ['Neu würfeln', 'Reroll'],
  'knopf.festhalten': ['Festhalten', 'Lock'],
  'knopf.losgeben': ['Freigeben', 'Unlock'],
  'knopf.zeileNeu': ['Diese Zeile neu würfeln', 'Reroll this line'],
  'knopf.export': ['In den Story Creator', 'Send to Story Creator'],
  'knopf.exportLaeuft': ['Wird angelegt …', 'Creating …'],
  'knopf.kopieren': ['Als Text kopieren', 'Copy as text'],
  'knopf.kopiert': ['Kopiert', 'Copied'],

  'leer': [
    'Noch nichts gewürfelt. Stell den Umfang ein und drück auf „Alles würfeln".',
    'Nothing rolled yet. Set the scope and press “Roll everything”.'
  ],
  'moeglichkeiten': [
    '{aufhaenger} Aufhänger, {orte} Orte und {figuren} Figuren stecken in den Tabellen — ganz ohne KI.',
    '{aufhaenger} hooks, {orte} places and {figuren} characters sit in the tables — with no AI at all.'
  ],

  'welt.titel': ['Die Welt', 'The world'],
  'welt.hinweis': [
    'Von der KI, aus deinen Angaben. Beim Würfeln bleibt das leer — die Tabellen liefern Bausteine, keine Welt.',
    'From the AI, out of your settings. Rolling leaves this empty — the tables deliver building blocks, not a world.'
  ],

  'baustein.aufhaenger': ['Aufhänger', 'Hook'],
  'baustein.fraktionen': ['Fraktionen', 'Factions'],
  'baustein.figuren': ['Figuren', 'Characters'],
  'baustein.orte': ['Orte', 'Places'],
  'baustein.verbindungen': ['Verbindungen', 'Connections'],
  'baustein.zeitstrahl': ['Wenn niemand eingreift', 'If nobody intervenes'],

  'hinweis.fraktionen': [
    'Zwei Ziele, die einander im Weg stehen, ergeben Handlung von selbst.',
    'Two goals in each other’s way produce plot by themselves.'
  ],
  'hinweis.verbindungen': [
    'Gerichtet: beide sehen dieselbe Sache verschieden.',
    'Directed: the two of them see the same thing differently.'
  ],
  'hinweis.zeitstrahl': [
    'Der Zeitstrahl läuft auch, wenn die Gruppe woanders ist.',
    'The clock runs even while the party is somewhere else.'
  ],

  'feld.frist': ['Frist', 'Deadline'],
  'feld.ziel': ['Ziel', 'Goal'],
  'feld.mittel': ['Mittel', 'Methods'],
  'feld.schwaeche': ['Schwachstelle', 'Weak point'],
  'feld.rolle': ['Rolle', 'Role'],
  'feld.will': ['Will', 'Wants'],
  'feld.hat': ['Hat', 'Holds'],
  'feld.haken': ['Haken', 'Snag'],
  'feld.karte': ['Auf der Karte', 'On the map'],
  'feld.ausstattung': ['Was dort steht', 'What stands there'],

  'knopf.karte': ['Karte anlegen', 'Start a map'],
  'karte.hinweis': [
    'Öffnet den Karteneditor und beginnt dort eine leere Karte unter diesem Namen.',
    'Opens the map editor and starts an empty map under this name.'
  ],

  'geflecht.alt': [
    'Das Geflecht: Figuren als Punkte, Verbindungen als Pfeile.',
    'The web: characters as dots, connections as arrows.'
  ],
  'geflecht.gross': ['Größer ansehen', 'View larger'],
  'geflecht.zu': ['Schließen', 'Close'],
  'geflecht.leer': [
    'Zwei Figuren, dann steht hier ein Geflecht.',
    'Two characters, and a web appears here.'
  ],

  'knopf.holen': ['Aus der Kampagne', 'From the campaign'],
  'holen.titel': ['Figuren, die es schon gibt', 'Characters that already exist'],
  'holen.hinweis': [
    'Aus der offenen Kampagne des Story Creators — dort landen auch die Figuren des NPC Creators. Wer hier dazukommt, wird verbunden und bekommt beim Übernehmen keine zweite Notiz.',
    'From the open campaign in the Story Creator — that is where NPC Creator characters end up too. Whoever joins here gets connected and will not get a second note on export.'
  ],
  'holen.leer': [
    'In der offenen Kampagne steht noch keine Figur.',
    'There is no character in the open campaign yet.'
  ],
  'holen.dabei': ['schon dabei', 'already here'],
  'holen.schliessen': ['Schließen', 'Close'],
  'figur.vorhanden': ['aus der Kampagne', 'from the campaign'],

  'export.titel': ['Titel der Übersichtsnotiz', 'Title of the overview note'],
  'export.kampagne': ['In die Kampagne', 'Into campaign'],
  'export.titelVorgabe': ['Überblick', 'Overview'],
  'export.hinweis': [
    'Legt je Figur, Ort und Fraktion eine Notiz an, dazu eine Übersicht mit Verweisen. Nichts wird überschrieben.',
    'Creates a note per character, place and faction, plus a linked overview. Nothing is overwritten.'
  ],
  'export.fertig': ['{anzahl} Notizen angelegt: {ziel}', '{anzahl} notes created: {ziel}'],
  'export.aktualisieren': ['Vorhandene aktualisieren ({anzahl})', 'Update existing ({anzahl})'],
  'export.leer': ['Erst würfeln, dann übernehmen.', 'Roll something first, then send it over.'],
  'export.fehler': ['Das hat nicht geklappt: {grund}', 'That did not work: {grund}'],

  'ki.alles': ['Alles von der KI', 'All from the AI'],
  'ki.allesHinweis': [
    'Ein Zug: die KI entwirft alle sechs Bausteine aufeinander bezogen. Was sie auslässt, kommt aus den Tabellen; festgehaltene Bausteine bleiben stehen.',
    'One go: the AI drafts all six blocks as one piece. Whatever it leaves out comes from the tables; locked blocks stay as they are.'
  ],
  'ki.vorschlagen': ['Von der KI', 'Ask the AI'],
  'ki.laeuft': ['Die KI denkt …', 'The AI is thinking …'],
  'ki.zeile': ['Von der KI vorschlagen lassen', 'Let the AI suggest this'],
  'ki.hinweis': [
    'Die KI schlägt frei vor, nicht aus den Tabellen — und sie versteht auch eigene Regionen wie „Schwebende Inseln". Eingerichtet wird sie in den Einstellungen des Rahmens.',
    'The AI suggests freely, not from the tables — and it understands regions of your own, such as “floating islands”. It is set up in the shell settings.'
  ],

  'error.aiNoProvider': [
    'Es ist keine KI eingerichtet.',
    'No AI is set up.'
  ],
  'error.aiKeinJson': [
    'Die KI hat geantwortet, aber nicht so, dass sich etwas übernehmen ließe. Versuch es noch einmal.',
    'The AI answered, but not in a way anything could be taken from. Try again.'
  ],
  'error.aiNoConnection': ['Keine Verbindung: Läuft Ollama?', 'No connection: is Ollama running?'],
  'error.aiTimeout': [
    'Zeitüberschreitung. Läuft Ollama, und ist das Modell geladen?',
    'Timed out. Is Ollama running and the model loaded?'
  ],
  'error.aiHttp': ['Der Anbieter meldet einen Fehler.', 'The provider reported an error.'],
  'error.aiEmpty': ['Die KI hat nichts geliefert.', 'The AI returned nothing.'],
  'error.aiAuth': [
    'Der API-Schlüssel wird nicht akzeptiert.',
    'The API key is not accepted.'
  ],
  'error.aiRateLimit': [
    'Zu viele Anfragen. Versuch es gleich noch einmal.',
    'Too many requests. Try again in a moment.'
  ],
  'error.aiModelMissing': [
    'Dieses Modell gibt es nicht oder du hast keinen Zugriff darauf.',
    'That model does not exist or you have no access to it.'
  ],
  'error.aiRefused': [
    'Die Anfrage wurde abgelehnt. Formuliere die Vorgaben anders.',
    'The request was declined. Phrase the constraints differently.'
  ],
  'error.aiNoModels': [
    'In Ollama ist kein Modell installiert.',
    'No model is installed in Ollama.'
  ],
  'error.aiModelNotInstalled': [
    'Das eingestellte Modell ist in Ollama nicht installiert.',
    'The selected model is not installed in Ollama.'
  ],
  'error.aiNoKey': ['Kein API-Schlüssel hinterlegt. Eintragen unter „Einstellungen“ in der Titelleiste → KI.', 'No API key stored. Enter it under “Settings” in the title bar → AI.'],
  'error.aiOther': ['Die KI meldet einen Fehler.', 'The AI reported an error.']
} as const;

export type TextKey = keyof typeof texte;

const STORAGE_KEY = 'ttrpg-inspiration.language';

interface SpracheBruecke {
  gewechselt(language: string): void;
  onGesetzt(callback: (language: string) => void): () => void;
}
declare global {
  interface Window {
    ttrpgToolsSprache?: SpracheBruecke;
  }
}

let aktuell: Language = erkenne();
const hoerer = new Set<() => void>();

function erkenne(): Language {
  try {
    const gespeichert = localStorage.getItem(STORAGE_KEY);
    if (gespeichert && (LANGUAGES as readonly string[]).includes(gespeichert)) {
      return gespeichert as Language;
    }
  } catch {
    /* Privater Modus — dann die Browsersprache. */
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('de') ? 'de' : 'en';
}

export function getLanguage(): Language {
  return aktuell;
}

function uebernimm(language: Language): void {
  if (language === aktuell) return;
  aktuell = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* Gilt dann nur fuer diese Sitzung. */
  }
  for (const fn of hoerer) fn();
}

export function setLanguage(language: Language): void {
  if (language === aktuell) return;
  uebernimm(language);
  if (typeof window !== 'undefined') window.ttrpgToolsSprache?.gewechselt(language);
}

export function onLanguageChange(fn: () => void): () => void {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

if (typeof window !== 'undefined' && window.ttrpgToolsSprache) {
  // `uebernimm` statt `setLanguage`: sonst meldete dieses Modul die Aenderung
  // postwendend zurueck und die Huelle benachrichtigte sich im Kreis.
  window.ttrpgToolsSprache.onGesetzt((language) => {
    if ((LANGUAGES as readonly string[]).includes(language)) uebernimm(language as Language);
  });
}

export function t(key: TextKey, params?: Record<string, string | number>): string {
  const eintrag = texte[key];
  if (!eintrag) return key;
  let text: string = eintrag[aktuell === 'de' ? 0 : 1];
  if (params) for (const name in params) text = text.replaceAll(`{${name}}`, String(params[name]));
  return text;
}
