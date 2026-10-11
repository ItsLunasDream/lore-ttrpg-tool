/**
 * Texte des Trackers, Deutsch und Englisch paarweise.
 *
 * Dasselbe Vorgehen wie im Karteneditor: `[de, en]` in einer Tabelle, weil
 * zwei getrennte Woerterbuecher auseinanderlaufen. Ein Test prueft, dass
 * beide Seiten vollstaendig sind.
 */
export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const texte = {
  'app.title': ['Initiative', 'Initiative'],
  'leer.titel': ['Noch keine Begegnung', 'No encounter yet'],
  'leer.text': [
    'Lege Teilnehmer an oder oeffne eine gespeicherte Begegnung.',
    'Add participants or open a saved encounter.'
  ],
  'knopf.neu': ['Teilnehmer', 'Participant'],
  'knopf.beginnen': ['Kampf beginnen', 'Start combat'],
  'knopf.beenden': ['Kampf beenden', 'End combat'],
  'knopf.weiter': ['Weiter', 'Next'],
  'knopf.wuerfeln': ['Initiative würfeln', 'Roll initiative'],
  'knopf.duplizieren': ['Duplizieren', 'Duplicate'],
  'knopf.umbenennen': ['Umbenennen', 'Rename'],
  'knopf.terrain': ['Gelände', 'Terrain'],
  'knopf.zurueck': ['Rückgängig', 'Undo'],
  'knopf.vor': ['Wiederherstellen', 'Redo'],
  'knopf.zurueckTitel': ['Rückgängig (Strg+Z)', 'Undo (Ctrl+Z)'],
  'knopf.vorTitel': ['Wiederherstellen (Strg+Umschalt+Z)', 'Redo (Ctrl+Shift+Z)'],
  'terrain.vorgabe': ['Gelände', 'Terrain'],
  'terrain.hinweis': [
    'Kommt bei Initiative 20 an die Reihe, hinter Figuren mit derselben Zahl.',
    'Acts on initiative 20, after any creature with the same count.'
  ],
  'feld.dauer': ['Wann es endet', 'When it ends'],
  'dauer.offen': ['ohne Ende', 'no end'],
  'dauer.zugBeginn': ['zu Zugbeginn', 'at start of turn'],
  'dauer.zugEnde': ['zu Zugende', 'at end of turn'],
  'dauer.rundeEnde': ['am Rundenende', 'at end of round'],
  'dialog.umbenennen': ['Teilnehmende umbenennen', 'Rename participant'],
  'knopf.entfernen': ['Entfernen', 'Remove'],
  'knopf.speichern': ['Begegnung speichern', 'Save encounter'],
  'raum.teilen': ['Im Raum teilen', 'Share in the room'],
  'raum.teilenEnde': ['Teilen beenden', 'Stop sharing'],
  'raum.teilenTitel': [
    'Alle im Raum sehen den Kampf live mit. Von Gegnern nur Name und groben Zustand.',
    'Everyone in the room follows the combat live. Of enemies only the name and a rough state.'
  ],
  'raum.gehoert': ['Gehört zu {name}', 'Belongs to {name}'],
  'raum.stufen': ['Gegnerzustand zeigen', 'Show enemy state'],
  'raum.stufenTitel': [
    'Spieler sehen bei Gegnern grob, wie verletzt sie sind. Aus: gar nichts davon.',
    'Players see roughly how hurt enemies are. Off: nothing at all.'
  ],
  'raum.loesen': ['Zuordnung lösen', 'Remove owner'],
  'raum.geteilt': ['Geteilter Kampf von {name}', 'Shared combat by {name}'],
  'raum.deine': ['deine Figur', 'your character'],
  'raum.zustandNeu': ['Zustand …', 'Condition …'],
  'raum.runden': ['Runden', 'Rounds'],
  'raum.hpSetzen': ['TP setzen, Enter', 'Set HP, Enter'],
  'stufe.unverletzt': ['unverletzt', 'unhurt'],
  'stufe.angeschlagen': ['angeschlagen', 'bloodied lightly'],
  'stufe.schwer': ['schwer verletzt', 'badly hurt'],
  'stufe.kampfunfaehig': ['kampfunfähig', 'down'],
  // Heisst wie in den anderen Werkzeugen „Sammlung": derselbe Ort, derselbe
  // Name. „Oeffnen" sagte nicht, was aufgeht.
  'knopf.oeffnen': ['Sammlung', 'Collection'],
  'knopf.neueBegegnung': ['Neue Begegnung', 'New encounter'],
  'knopf.verwerfen': ['Verwerfen', 'Discard'],
  'knopf.bild': ['Bild wählen', 'Choose image'],
  'knopf.bildAendern': ['Bild ändern', 'Change image'],
  'knopf.bildWeg': ['Bild entfernen', 'Remove image'],
  'knopf.zustand': ['Zustand', 'Condition'],
  'feld.name': ['Name', 'Name'],
  'feld.initiative': ['Ini', 'Init'],
  'feld.feinwert': ['Feinwert', 'Tiebreak'],
  'feld.hp': ['TP', 'HP'],
  'feld.hpMax': ['TP max', 'HP max'],
  'feld.tempHp': ['Temp', 'Temp'],
  'feld.anzahl': ['Anzahl', 'Count'],
  'feld.raus': ['Raus', 'Out'],
  'feld.rk': ['RK', 'AC'],
  'zustand.eigen': ['Eigener Zustand', 'Own condition'],
  'knopf.statblock': ['Statblock zeigen', 'Show stat block'],
  'knopf.statblockKurz': ['Statblock', 'Stat block'],
  'feld.spieler': ['Spielerfigur', 'Player character'],
  'feld.notiz': ['Notiz', 'Note'],
  'feld.taktik': ['Taktik und Notizen', 'Tactics and notes'],
  'feld.runden': ['Runden', 'Rounds'],
  'runde': ['Runde {n}', 'Round {n}'],
  'amZug': ['Am Zug', 'Active'],
  'liegt': ['Liegt', 'Down'],
  'gruppe.mitglieder': ['{n} {{Mitglied|Mitglieder}}', '{n} {{member|members}}'],
  'schaden.hinweis': ['Schaden eintippen, Minus heilt', 'Type damage, minus heals'],
  'wurf.modifikator': ['Modifikator', 'Modifier'],
  'wurf.nurGegner': ['Nur Gegner würfeln', 'Roll for enemies only'],
  'begegnung.name': ['Name der Begegnung', 'Encounter name'],
  'begegnung.keine': ['Keine gespeicherten Begegnungen', 'No saved encounters'],
  'begegnung.titel': ['Begegnungen', 'Encounters'],
  'bestaetigen.neuLaeuft': [
    'Der Kampf läuft noch. Neue Begegnung anfangen?',
    'The fight is still running. Start a new encounter?'
  ],
  'bestaetigen.neuUngespeichert': [
    'Diese Aufstellung ist nicht gespeichert. Neue Begegnung anfangen?',
    'This line-up is not saved. Start a new encounter?'
  ],
  'bestaetigen.neuBeides': [
    'Der Kampf läuft noch und die Aufstellung ist nicht gespeichert. Neue Begegnung anfangen?',
    'The fight is still running and the line-up is not saved. Start a new encounter?'
  ],
  'begegnung.suche': [
    'Suche: Begegnung oder Teilnehmer',
    'Search: encounter or participant'
  ],
  'begegnung.teilnehmerzahl': ['{n} Teilnehmer', '{n} {{participant|participants}}'],
  'begegnung.ohneTeilnehmer': ['Ohne Teilnehmer', 'No participants'],
  'sammlung.sortieren': ['Sortieren', 'Sort'],
  'sammlung.nachName': ['Nach Namen', 'By name'],
  'sammlung.nachGroesse': ['Nach Größe', 'By size'],
  'sammlung.kacheln': ['Kacheln', 'Tiles'],
  'sammlung.liste': ['Liste', 'List'],
  'sammlung.anzahl': ['{n} gefunden', '{n} found'],
  'sammlung.nichts': ['Nichts gefunden', 'Nothing found'],
  'knopf.schliessen': ['Schließen', 'Close'],
  'msg.gespeichert': ['Begegnung gespeichert', 'Encounter saved'],
  'msg.geladen': ['Begegnung geladen', 'Encounter loaded'],
  'msg.figuren': ['{n} Figuren aus dem Charakterbogen übernommen', '{n} characters taken over from the character sheet'],
  'msg.uebernommen': [
    'Begegnung aus den Begegnungen übernommen',
    'Encounter taken over from Encounters'
  ],
  'taste.leertaste': ['Leertaste: weiter', 'Space: next'],
  'bestaetigen.beenden': [
    'Kampf wirklich beenden? Die Reihenfolge geht verloren.',
    'Really end combat? The order will be lost.'
  ],
  'bestaetigen.ersetzen': [
    'Es gibt schon eine Begegnung „{name}“. Ersetzen?',
    'An encounter "{name}" already exists. Replace it?'
  ],
  'knopf.ersetzen': ['Ersetzen', 'Replace'],
  'ja': ['Ja', 'Yes'],
  'nein': ['Nein', 'No']
} as const;

export type TextKey = keyof typeof texte;

const STORAGE_KEY = 'ttrpg-initiative.language';

/** Die Bruecke aus embed/preload — nur vorhanden, wenn eingebettet. */
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
    /* Privater Modus — dann eben die Browsersprache. */
  }
  // Alles, was nicht deutsch ist, bekommt Englisch (Konvention 6).
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('de') ? 'de' : 'en';
}

export function getLanguage(): Language {
  return aktuell;
}

/** Setzt lokal, ohne der Huelle Bescheid zu sagen. */
function uebernimm(language: Language): void {
  if (language === aktuell) return;
  aktuell = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* Dann gilt die Wahl nur fuer diese Sitzung. */
  }
  for (const fn of hoerer) fn();
}

export function setLanguage(language: Language): void {
  if (language === aktuell) return;
  uebernimm(language);
  // Eingebettet: der Huelle melden, damit sie es an die anderen Werkzeuge
  // weiterreicht. Sonst liefen sie auseinander.
  if (typeof window !== 'undefined') window.ttrpgToolsSprache?.gewechselt(language);
}

export function onLanguageChange(fn: () => void): () => void {
  hoerer.add(fn);
  return () => hoerer.delete(fn);
}

if (typeof window !== 'undefined' && window.ttrpgToolsSprache) {
  // `uebernimm` und nicht `setLanguage`: sonst meldete dieses Modul die
  // Aenderung postwendend zurueck und die Huelle benachrichtigte sich im Kreis.
  window.ttrpgToolsSprache.onGesetzt((language) => {
    if ((LANGUAGES as readonly string[]).includes(language)) uebernimm(language as Language);
  });
}

/**
 * `{{Einzahl|Mehrzahl}}` im Text waehlt nach der ersten Zahl in den
 * Parametern (`anzahl` oder `n` zuerst): aus „1 creatures" wird so „1 creature".
 */
function mitMehrzahl(text: string, params: Record<string, string | number>): string {
  if (!text.includes('{{')) return text;
  const zahl = params.anzahl ?? params.n ?? Object.values(params).find((wert) => typeof wert === 'number');
  return text.replace(/\{\{([^|}]*)\|([^}]*)\}\}/g, (_, eins: string, mehr: string) => (Number(zahl) === 1 ? eins : mehr));
}

/** Uebersetzt. Platzhalter `{n}` werden aus `params` ersetzt. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  const eintrag = texte[key];
  // Fehlt ein Schluessel, kommt er selbst zurueck — sichtbar falsch statt
  // leer, damit die Luecke beim Durchklicken auffaellt.
  if (!eintrag) return key;
  let text: string = eintrag[aktuell === 'de' ? 0 : 1];
  if (params) {
    for (const name in params) text = text.replaceAll(`{${name}}`, String(params[name]));
    text = mitMehrzahl(text, params);
  }
  return text;
}
