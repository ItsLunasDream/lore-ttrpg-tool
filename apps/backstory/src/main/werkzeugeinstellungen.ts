/**
 * Die eigenen Einstellungen des Story Creators, so beschrieben, dass die
 * Huelle sie in ihrem Dialog zeigen kann.
 *
 * Warum nicht der eigene Dialog? Weil es sonst zwei Stellen gibt, an denen
 * man Einstellungen sucht, und man immer zuerst in der falschen nachsieht.
 * Eingebettet fuehrt die Huelle sie; allein gestartet gibt es keine Huelle,
 * dann bleibt der eigene Dialog der einzige Weg — deshalb faellt er nicht
 * weg, sondern nur dort, wo er doppelt waere.
 *
 * Die Texte stehen hier in beiden Sprachen und nicht im i18n der
 * Oberflaeche: gemalt wird in der Huelle, in DEREN Sprache, und die kann von
 * der des Werkzeugs abweichen.
 */
import { dialog, BrowserWindow, type Session, type WebContents } from 'electron';
import type { Werkzeugeinstellungen, Wert } from '@suite/einstellungen';
import { pruefeWert } from '@suite/einstellungen';
import type { AppSettings, Rechtschreibwahl } from '../shared/types';
import { setzePruefsprache } from './rechtschreibung';

/** Woran das Modul kommt, ohne den Rest des Hauptprozesses zu kennen. */
export interface Umgebung {
  readonly einstellungen: () => AppSettings;
  readonly schreibe: (teil: Partial<AppSettings>) => Promise<AppSettings>;
  /** Die Sitzung der Ansicht — daran haengt das eigene Woerterbuch. */
  readonly sitzung: () => Session | null;
  /** Neuer Speicherort. `null`, wenn abgebrochen wurde. */
  readonly waehleSpeicherort: () => Promise<AppSettings | null>;
  readonly zeigeSpeicherort: () => Promise<void>;
}

/** Die Felder, die die Huelle kennt. Ein Tippfehler faellt hier auf, nicht erst im Betrieb. */
const FELD = {
  autosave: 'autosaveEnabled',
  autosaveMs: 'autosaveDelayMs',
  verlauf: 'historyEnabled',
  verlaufMax: 'historyMaxVersions',
  ort: 'vaultRoot',
  pruefung: 'spellcheck',
  woerter: 'woerter'
} as const;

/** Die Knoepfe. */
export const BEFEHL = {
  ortWaehlen: 'ortWaehlen',
  ortZeigen: 'ortZeigen',
  /** Ein Wort aus dem eigenen Woerterbuch streichen. Traegt das Wort mit. */
  wortWeg: FELD.woerter
} as const;

export async function baueBeschreibung(umgebung: Umgebung): Promise<Werkzeugeinstellungen> {
  const s = umgebung.einstellungen();
  const sitzung = umgebung.sitzung();
  /*
   * Ohne Ansicht gibt es keine Sitzung und damit kein Woerterbuch. Dann eine
   * leere Liste statt eines Fehlers: der Rest der Einstellungen stimmt ja.
   *
   * `await`, obwohl Electron die Liste sofort liefert — die Typen sagen
   * Promise, und darauf ist hier Verlass, nicht auf die Laufzeit.
   */
  const woerter = sitzung ? await sitzung.listWordsInSpellCheckerDictionary() : [];

  return {
    appId: 'backstory',
    gruppen: [
      {
        id: 'schreiben',
        name: { de: 'Schreiben', en: 'Writing' },
        felder: [
          {
            art: 'schalter',
            id: FELD.autosave,
            name: { de: 'Automatisch speichern', en: 'Save automatically' },
            wert: s.autosaveEnabled
          },
          {
            art: 'zahl',
            id: FELD.autosaveMs,
            name: { de: 'Wartezeit bis zum Speichern', en: 'Wait before saving' },
            einheit: { de: 'ms', en: 'ms' },
            wert: s.autosaveDelayMs,
            min: 300,
            max: 30000,
            schritt: 100,
            haengtAn: FELD.autosave
          },
          {
            art: 'schalter',
            id: FELD.verlauf,
            name: { de: 'Fassungen aufheben', en: 'Keep past versions' },
            wert: s.historyEnabled
          },
          {
            art: 'zahl',
            id: FELD.verlaufMax,
            name: { de: 'Wie viele Fassungen', en: 'How many versions' },
            wert: s.historyMaxVersions,
            min: 1,
            max: 500,
            haengtAn: FELD.verlauf
          }
        ]
      },
      {
        id: 'ort',
        name: { de: 'Speicherort', en: 'Storage' },
        felder: [
          {
            art: 'pfad',
            id: FELD.ort,
            name: { de: 'Ordner', en: 'Folder' },
            hinweis: {
              de: 'Alle Notizen liegen als Markdown-Dateien darin. Ein Wechsel öffnet den neuen Ordner; nichts wird verschoben.',
              en: 'All notes live in there as Markdown files. Switching opens the new folder; nothing is moved.'
            },
            wert: s.vaultRoot,
            knoepfe: [
              { id: BEFEHL.ortWaehlen, name: { de: 'Ordner wählen', en: 'Choose folder' } },
              { id: BEFEHL.ortZeigen, name: { de: 'Ordner öffnen', en: 'Open folder' } }
            ]
          }
        ]
      },
      {
        id: 'rechtschreibung',
        name: { de: 'Rechtschreibung', en: 'Spelling' },
        felder: [
          {
            art: 'auswahl',
            id: FELD.pruefung,
            name: { de: 'Prüfen in', en: 'Check in' },
            hinweis: {
              de: 'Unabhängig von der Sprache der Oberfläche. „Aus“ streicht nichts mehr an.',
              en: 'Independent of the interface language. “Off” stops underlining.'
            },
            wert: s.spellcheck,
            optionen: [
              { id: 'auto', name: { de: 'Wie die Oberfläche', en: 'Same as interface' } },
              { id: 'de', name: { de: 'Deutsch', en: 'German' } },
              { id: 'en', name: { de: 'Englisch', en: 'English' } },
              { id: 'off', name: { de: 'Aus', en: 'Off' } }
            ]
          },
          {
            art: 'sammlung',
            id: FELD.woerter,
            name: { de: 'Eigene Wörter', en: 'Your own words' },
            hinweis: {
              de: 'Aufgenommen wird per Rechtsklick im Text. Hier kommt man wieder heraus.',
              en: 'Words are added by right-clicking in the text. This is the way back out.'
            },
            eintraege: woerter,
            leer: { de: 'Noch keine.', en: 'None yet.' },
            entfernen: { de: 'Entfernen', en: 'Remove' }
          }
        ]
      }
    ]
  };
}

/**
 * Nimmt einen geaenderten Wert entgegen und liefert den Stand danach.
 *
 * Geprueft wird gegen die eigene Beschreibung: die Huelle schickt, was in
 * ihrem Bedienteil stand, und ein leer geraeumtes Zahlenfeld darf nicht als
 * `NaN` in der Einstellungsdatei landen. Ein Wert, der die Pruefung nicht
 * besteht, aendert nichts — die Huelle bekommt den alten Stand zurueck und
 * zeigt damit wieder, was wirklich gilt.
 */
export async function setzeWert(
  umgebung: Umgebung,
  feldId: string,
  roh: Wert
): Promise<Werkzeugeinstellungen> {
  const vorher = await baueBeschreibung(umgebung);
  const feld = vorher.gruppen.flatMap((g) => g.felder).find((f) => f.id === feldId);
  if (!feld) return vorher;

  const wert = pruefeWert(feld, roh);
  if (wert === null) return vorher;

  switch (feldId) {
    case FELD.autosave:
      await umgebung.schreibe({ autosaveEnabled: wert as boolean });
      break;
    case FELD.autosaveMs:
      await umgebung.schreibe({ autosaveDelayMs: wert as number });
      break;
    case FELD.verlauf:
      await umgebung.schreibe({ historyEnabled: wert as boolean });
      break;
    case FELD.verlaufMax:
      await umgebung.schreibe({ historyMaxVersions: wert as number });
      break;
    case FELD.pruefung: {
      const neu = await umgebung.schreibe({ spellcheck: wert as Rechtschreibwahl });
      const sitzung = umgebung.sitzung();
      if (sitzung) setzePruefsprache(sitzung, neu.language, neu.spellcheck);
      break;
    }
    default:
      return vorher;
  }
  return baueBeschreibung(umgebung);
}

/** Loest einen Knopf aus und liefert den Stand danach. */
export async function fuehreBefehlAus(
  umgebung: Umgebung,
  befehlId: string,
  wert?: string
): Promise<Werkzeugeinstellungen> {
  switch (befehlId) {
    case BEFEHL.ortWaehlen:
      await umgebung.waehleSpeicherort();
      break;
    case BEFEHL.ortZeigen:
      await umgebung.zeigeSpeicherort();
      break;
    case BEFEHL.wortWeg:
      if (wert) umgebung.sitzung()?.removeWordFromSpellCheckerDictionary(wert);
      break;
  }
  return baueBeschreibung(umgebung);
}

/**
 * Fragt nach einem Ordner.
 *
 * Steht hier und nicht im IPC-Modul, weil der Weg ueber die Huelle keinen
 * Renderer-Aufruf hat, an dem ein Fenster haengt. Ohne Elternfenster ist der
 * Dialog freischwebend — unschoen, aber besser als keiner.
 */
export async function frageNachOrdner(webContents: WebContents | null): Promise<string | null> {
  const fenster = webContents ? BrowserWindow.fromWebContents(webContents) : null;
  const ergebnis = fenster
    ? await dialog.showOpenDialog(fenster, { properties: ['openDirectory', 'createDirectory'] })
    : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (ergebnis.canceled || !ergebnis.filePaths[0]) return null;
  return ergebnis.filePaths[0];
}
