import type { Language } from './i18n';

/** Wird in jede Notiz- und Kampagnendatei geschrieben, damit spaetere Migrationen moeglich sind. */
export const SCHEMA_VERSION = 1;

/**
 * Notiztypen sind Daten, keine feste Aufzaehlung: sie liegen pro Kampagne in
 * campaign.json und lassen sich in der Oberflaeche anpassen.
 */
export type NoteType = string;

export type FieldType = 'text' | 'textarea' | 'number' | 'url' | 'image' | 'select' | 'date' | 'checkbox';

export interface FieldDef {
  /** Stabiler Schluessel, unter dem der Wert in der Notiz steht. Wird nie geaendert. */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Nur fuer die Feldart Auswahlliste. */
  options?: string[];
}

export interface NoteTypeDef {
  id: NoteType;
  label: string;
  /** Mehrzahl, fuer Ueberschriften und Filter. */
  plural: string;
  fields: FieldDef[];
}

/** Gerichtete Beziehung. A -> B und B -> A werden getrennt gepflegt. */
export interface Relation {
  id: string;
  targetId: string;
  /** Freitext, die Vorschlagsliste in der UI ist nur eine Hilfe. */
  type: string;
  note: string;
}

export interface NoteMeta {
  id: string;
  schemaVersion: number;
  type: NoteType;
  title: string;
  aliases: string[];
  tags: string[];
  fields: Record<string, string>;
  relations: Relation[];
  createdAt: string;
  updatedAt: string;
}

export interface Note extends NoteMeta {
  /** Markdown-Rumpf der Notiz. */
  body: string;
}

/** Eine Bilddatei, auf die keine Notiz mehr verweist. */
export interface OrphanedAsset {
  name: string;
  bytes: number;
}

/**
 * Eine Datei im Notizordner, die sich nicht lesen laesst.
 *
 * `name`: der Dateiname taugt nicht als ID, ein Umbenennen behebt es.
 * `content`: der Inhalt ist kaputt, meist der YAML-Kopf.
 */
export interface UnreadableNote {
  name: string;
  reason: 'name' | 'content';
}

/** Ein gesicherter Stand einer Notiz. */
export interface NoteVersion {
  id: string;
  savedAt: string;
  title: string;
  body: string;
}

/** Stelle eines Knotens im Graphen, von Hand gesetzt. */
export interface GraphPosition {
  x: number;
  y: number;
}

export interface Campaign {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  /** Notiztypen dieser Kampagne, samt ihrer Steckbrieffelder. */
  noteTypes: NoteTypeDef[];
  /**
   * Von Hand verschobene Knoten des Graphen, je Notiz-ID.
   *
   * Bewusst hier und nicht im Kopf der Notizdatei: eine Stelle im Graphen
   * sagt nichts ueber die Notiz aus und haette dort nichts zu suchen.
   */
  graphPositions: Record<string, GraphPosition>;
}

/**
 * Welche KI-Anbindung benutzt wird.
 *
 * Absichtlich hier ausgeschrieben und nicht aus @suite/ki bezogen: dieses
 * Modul liest auch die Oberflaeche, und ein Import aus dem KI-Paket zoege
 * dessen Abhaengigkeiten in das Buendel des Renderers. Die Werte sind
 * dieselben; ein Modultest haelt beide Listen zusammen.
 */
export type AiProviderId = 'none' | 'ollama' | 'claude';

/** Die drei Aufgaben, die der Assistent uebernimmt. Kein Textgenerator. */
export type AiTask = 'questions' | 'consistency' | 'style';

/** Eine Nachricht im Gespraech mit dem Assistenten. */
export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Rechtschreibpruefung: wie die Oberflaeche, fest eine Sprache oder aus. */
export type Rechtschreibwahl = 'auto' | 'de' | 'en' | 'off';

export function istRechtschreibwahl(wert: unknown): wert is Rechtschreibwahl {
  return wert === 'auto' || wert === 'de' || wert === 'en' || wert === 'off';
}

export interface AppSettings {
  schemaVersion: number;
  vaultRoot: string;
  language: Language;
  autosaveEnabled: boolean;
  autosaveDelayMs: number;
  historyEnabled: boolean;
  historyMaxVersions: number;
  /** Welche KI-Anbindung benutzt wird. 'none' schaltet die Sidebar ab. */
  aiProvider: AiProviderId;
  ollamaBaseUrl: string;
  ollamaModel: string;
  claudeModel: string;
  /** Verschluesselter API-Schluessel. Erreicht den Renderer nie. */
  claudeApiKeyEncrypted: string;
  /**
   * Ob die verlinkten Notizen als Kontext mitgeschickt werden.
   *
   * Aus zwei Gruenden abschaltbar: weniger Text an ein kostenpflichtiges
   * Modell, und manchmal soll die Rueckmeldung nur die offene Notiz
   * betreffen. An bleibt die Voreinstellung — so war es vorher.
   */
  aiSendLinkedNotes: boolean;
  /**
   * Vergroesserung des Notiztextes in Prozent. Gilt fuer alle Notizen und
   * nur fuer das Editorfeld.
   */
  editorZoom: number;
  /**
   * Sprache der Rechtschreibpruefung. 'auto' folgt der Oberflaeche; eigene
   * Wahl, weil man oft in der einen Sprache bedient und in der anderen schreibt.
   */
  spellcheck: Rechtschreibwahl;
  lastCampaignId: string | null;
}

/** Fundstelle innerhalb eines Textausschnitts, fuer die Hervorhebung. */
export interface SnippetMatch {
  from: number;
  to: number;
}

export interface SearchHit {
  noteId: string;
  title: string;
  type: NoteType;
  field: 'title' | 'alias' | 'tag' | 'body' | 'field';
  /** Vorangestellte Bezeichnung, z.B. "Alias" oder der Feldname. */
  label: string | null;
  /** Textausschnitt rund um den Treffer. */
  snippet: string;
  /** Fundstellen innerhalb von `snippet`. */
  matches: SnippetMatch[];
  /** Anzahl Fundstellen im gesamten Rumpf, unabhaengig vom Ausschnitt. */
  bodyMatches: number;
}
