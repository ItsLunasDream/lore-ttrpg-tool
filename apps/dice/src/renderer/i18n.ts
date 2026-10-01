/** Texte des Wuerfels, Deutsch und Englisch paarweise. */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const texte = {
  'app.title': ['Würfel', 'Dice'],
  'pool.leer': ['Wähle Würfel aus', 'Pick some dice'],
  'pool.hinweis': [
    'Linksklick legt einen dazu, Rechtsklick nimmt einen weg. Negative Anzahl zieht ab.',
    'Left click adds one, right click removes one. A negative count subtracts.'
  ],
  'knopf.rollen': ['Rollen', 'Roll'],
  'knopf.leeren': ['Leeren', 'Clear'],
  'feld.modifikator': ['Modifikator', 'Modifier'],
  'feld.seiten': ['Seiten', 'Sides'],
  'feld.ausdruck': ['Ausdruck', 'Expression'],
  'feld.ausdruckHinweis': [
    'Etwa 2d6+3 oder 1W20 - 1W4. Enter setzt die Auswahl und rollt.',
    'Such as 2d6+3 or 1d20 - 1d4. Enter sets the pool and rolls.'
  ],
  'feld.ausdruckFehler': ['Das ist kein Würfelausdruck (etwa 2d6+3).', 'That is not a dice expression (such as 2d6+3).'],
  'wurfart.titel': ['Wurfart', 'Roll mode'],
  'wurfart.normal': ['Normal', 'Normal'],
  'wurfart.vorteil': ['Vorteil', 'Advantage'],
  'wurfart.nachteil': ['Nachteil', 'Disadvantage'],
  'wurfart.w20Hinweis': ['Gilt für jeden W20: zweimal werfen, einer zählt.', 'Applies to every d20: roll twice, one counts.'],
  'wurfart.explodiert': ['Explodierend (Höchstzahl würfelt nach)', 'Exploding (a max roll rolls again)'],
  'wurfart.behalte': ['Höchste behalten:', 'Keep highest:'],
  'wurfart.alle': ['alle', 'all'],
  'ergebnis': ['Ergebnis', 'Result'],
  'verlauf.titel': ['Verlauf', 'History'],
  'verlauf.leer': ['Noch nichts gewürfelt', 'Nothing rolled yet'],
  'verlauf.hinweis': ['Nur für diese Sitzung', 'This session only'],
  'verlauf.holen': ['Diesen Wurf zurückholen', 'Load this pool again'],
  'verlauf.leeren': ['Verlauf leeren', 'Clear history'],
  'teilen.titel': ['Würfe im Raum teilen', 'Share rolls in the room'],
  'teilen.aus': ['Nicht teilen', 'Don’t share'],
  'teilen.alle': ['An alle', 'Everyone'],
  'teilen.dm': ['Nur an SL', 'DM only'],
  'teilen.keinRaum': [
    'Du bist in keinem Raum. Öffne einen unter „Teilen“, dann gehen die Würfe hinaus.',
    'You are not in a room. Open one under “Share” and rolls will go out.'
  ],
  'teilen.gesendetAlle': ['Wurf an alle geschickt.', 'Roll sent to everyone.'],
  'teilen.gesendetDm': ['Wurf an die Spielleitung geschickt.', 'Roll sent to the DM.'],
  'teilen.selbstDm': ['Du leitest den Raum: der Wurf bleibt bei dir.', 'You host the room: the roll stays with you.'],
  'teilen.fehler': ['Der Wurf konnte nicht geschickt werden.', 'The roll could not be sent.'],
  'aussehen.titel': ['Aussehen', 'Appearance'],
  'aussehen.farbe': ['Farbe', 'Colour'],
  'aussehen.muster': ['Muster', 'Pattern'],
  'muster.schlicht': ['Schlicht', 'Plain'],
  'muster.marmor': ['Marmor', 'Marble'],
  'muster.metall': ['Metall', 'Metal'],
  'muster.sternenhimmel': ['Sternenhimmel', 'Starfield'],
  'muster.lack': ['Lack', 'Gloss'],
  'muster.perlmutt': ['Perlmutt', 'Pearl'],
  'muster.kristall': ['Kristall', 'Crystal'],
  'muster.holz': ['Holz', 'Wood'],
  'aussehen.dreiD': ['Würfel als Körper (3D)', 'Dice as solids (3D)'],
  'aussehen.dreiDfehlt': [
    'Keine Grafikbeschleunigung — es bleibt bei der flachen Darstellung.',
    'No graphics acceleration — staying with the flat view.'
  ],
  'effekt.glitzer': ['Glitzer bei Höchstwurf', 'Sparkle on max roll'],
  'effekt.streifen': ['Streifen bei einer 1', 'Gloom lines on a 1'],
  'abzug': ['Abzug', 'Subtracted']
} as const;

export type TextKey = keyof typeof texte;

const STORAGE_KEY = 'ttrpg-dice.language';

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
