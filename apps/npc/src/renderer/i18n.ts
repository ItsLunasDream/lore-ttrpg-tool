/** Texte des NPC Creators, Deutsch und Englisch paarweise. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const texte = {
  'app.title': ['NPC Creator', 'NPC Creator'],
  'knopf.wuerfeln': ['Neue Figur', 'New character'],
  'knopf.nachwuerfeln': ['Neu würfeln', 'Reroll'],
  'knopf.nachwuerfelnGesperrt': ['Festgehalten: erst das Schloss öffnen, dann neu würfeln', 'Locked: open the lock first, then reroll'],
  'knopf.festhalten': ['Festhalten', 'Lock'],
  'knopf.losgeben': ['Freigeben', 'Unlock'],
  'knopf.export': ['In den Story Creator', 'Send to Story Creator'],
  'knopf.aktualisieren': ['Dort aktualisieren', 'Update it there'],
  'ziel.kampagne': ['Kampagne:', 'Campaign:'],
  'ziel.hinweis': ['In diese Kampagne des Story Creators kommt die Figur.', 'The Story Creator campaign the character goes into.'],
  'knopf.exportLaeuft': ['Wird angelegt …', 'Creating …'],
  'knopf.exportFertig': ['Angelegt', 'Created'],
  'leer': ['Noch keine Figur — wirf eine.', 'No character yet — roll one.'],
  'feld.name': ['Name', 'Name'],
  'feld.spezies': ['Spezies', 'Species'],
  'feld.beruf': ['Tätigkeit', 'Occupation'],
  'feld.aussehen': ['Auffällig', 'Notable'],
  'feld.motivation': ['Will', 'Wants'],
  'feld.geheimnis': ['Verschweigt', 'Hides'],
  'feld.eigenheit': ['Eigenheit', 'Quirk'],
  'feld.eigenheitLeer': ['keine besondere', 'nothing particular'],
  'wunsch.titel': ['Vorgaben', 'Constraints'],
  'wunsch.archetyp': ['Rolle', 'Role'],
  'wunsch.klang': ['Namensklang', 'Name style'],
  'wunsch.spezies': ['Spezies', 'Species'],
  'wunsch.beliebig': ['beliebig', 'any'],
  'wunsch.gemischt': ['gemischt', 'mixed'],
  'klang.weiblich': ['feminin', 'feminine'],
  'klang.maennlich': ['maskulin', 'masculine'],
  'klang.neutral': ['neutral', 'neutral'],
  'archetyp.beliebig': ['beliebig', 'Any'],
  'archetyp.wache': ['Wache und Söldner', 'Guards and soldiers'],
  'archetyp.haendler': ['Handel und Schankstube', 'Trade and taverns'],
  'archetyp.handwerk': ['Handwerk', 'Crafts'],
  'archetyp.schatten': ['Halbwelt', 'Underworld'],
  'archetyp.gelehrte': ['Gelehrte und Klerus', 'Scholars and clergy'],
  'archetyp.landvolk': ['Land und Wildnis', 'Country and wilds'],
  'ablage.titel': ['Merkliste', 'Shortlist'],
  'ablage.leer': ['Nur für diese Sitzung', 'This session only'],
  'ablage.merken': ['Merken', 'Keep'],
  'ablage.holen': ['Diese Figur zurückholen', 'Load this character again'],
  'ablage.leeren': ['Liste leeren', 'Clear list'],

  'ki.figur': ['Von der KI', 'Ask the AI'],
  'ki.figurLaeuft': ['Die KI denkt …', 'The AI is thinking …'],
  'ki.feld': ['Von der KI vorschlagen lassen', 'Let the AI suggest this'],
  'ki.hinweis': [
    'Die KI schlägt frei vor, nicht aus den Tabellen. Eingerichtet wird sie in den Einstellungen des Rahmens.',
    'The AI suggests freely, not from the tables. It is set up in the shell settings.'
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

const STORAGE_KEY = 'ttrpg-npc.language';

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
