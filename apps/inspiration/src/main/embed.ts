/**
 * Die Montage-Schnittstelle der Inspirationshilfe (Konvention 7).
 *
 * Wie bei den anderen Werkzeugen: die Huelle ruft `mountInspiration` und
 * bekommt zurueck, was sie zum Anzeigen braucht. Kein eigenstaendiger
 * Hauptprozess.
 *
 * Eine eigene Ablage gibt es nicht, und das ist die wichtigste Entscheidung
 * des ganzen Werkzeugs (docs/inspirationshilfe.md): der Entwurf lebt in der
 * Sitzung, die Wahrheit liegt im Story Creator. Zwei Ablagen fuer
 * dieselbe Welt haetten frueher oder spaeter zwei verschiedene Welten
 * ergeben.
 */
import path from 'node:path';
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { baueAnbieter, KiFehler, leseJsonAntwort } from '@suite/ki';
import type { KiEinstellungen } from '@suite/ki/einstellungen';
import { kanal } from '../shared/kanaele';
import {
  anweisung,
  systemAnweisung,
  uebernehmbar,
  type Frage,
  type RohEntwurf
} from '../shared/kiAufgaben';
import type { Notiz } from '../shared/notizen';
import type { Sprache } from '../shared/tabellen';

export interface ExportErgebnis {
  readonly ok: boolean;
  readonly text: string;
  readonly angelegt: number;
  /** Wie viele schon in der Kampagne standen und uebersprungen wurden. */
  readonly vorhanden?: number;
}

/**
 * Wie Notizen ins Archiv kommen.
 *
 * Die Huelle reicht das durch, weil nur sie weiss, ob der Story Creator
 * montiert ist und welche Kampagne offen steht — genauso wie beim NPC
 * Creator.
 */
export type Anleger = (
  notizen: readonly Notiz[],
  kampagneId?: string | null,
  optionen?: { readonly ersetzen?: boolean }
) => Promise<ExportErgebnis>;

/** Eine Figur, die es in der offenen Kampagne schon gibt. */
export interface KampagnenFigur {
  readonly titel: string;
  /** Die erste Zeile ihrer Notiz, damit man sie in der Liste wiedererkennt. */
  readonly kurz: string;
}

/**
 * Wer schon in der Kampagne steht.
 *
 * Auch das reicht die Huelle durch — dieses Werkzeug kennt den Vault nicht.
 * Gemeint sind ausdruecklich die Figuren des Story Creators, und darueber
 * auch die des NPC Creators: was dort gewuerfelt und uebernommen wurde, liegt
 * anschliessend als Notiz in derselben Kampagne.
 */
export type Figurenquelle = (kampagneId?: string | null) => Promise<readonly KampagnenFigur[]>;

/**
 * Beginnt im Karteneditor eine leere Karte unter diesem Namen.
 *
 * Wieder ueber die Huelle und nicht direkt: dieses Werkzeug kennt den
 * Karteneditor nicht. Mehr als der Name geht auch nicht hinueber — eine
 * Karte aus Text zu zeichnen hiesse, sein Datenmodell von aussen zu
 * bedienen, und das ist ein Projekt fuer sich (docs/inspirationshilfe.md).
 */
export type Kartenanleger = (
  name: string,
  notizen: readonly { title: string; text: string }[]
) => Promise<boolean>;

/**
 * Woher die KI-Anbindung kommt.
 *
 * Die Huelle richtet sie einmal fuer die ganze Sammlung ein und reicht sie
 * durch; dieses Werkzeug fuehrt keine eigene. Fehlt sie, gibt es hier keine
 * KI — und die Knoepfe dafuer sind gar nicht erst da.
 *
 * Eine Funktion und kein Schnappschuss: wer sie umstellt, soll das im
 * naechsten Klick merken.
 */
export type KiQuelle = () => { einstellungen: KiEinstellungen; schluessel: string };

/** Was bei einer KI-Anfrage herauskommt. Ein Fehler ist kein Absturz. */
export interface KiErgebnis {
  readonly ok: boolean;
  /** Bei Erfolg die Felder des Bausteins (oder die Schritte), sonst null. */
  readonly wert: Record<string, string> | readonly string[] | RohEntwurf | null;
  /** Bei Misserfolg der Schluessel der Meldung, sonst leer. */
  readonly grund: string;
}

export interface InspirationEmbedOptions {
  readonly distDir: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Legt die Notizen an. Fehlt sie, meldet der Export das ehrlich. */
  readonly anlegen?: Anleger;
  /** Die KI der Sammlung. Fehlt sie, gibt es hier keine KI. */
  readonly kiQuelle?: KiQuelle;
  /** Die Figuren der offenen Kampagne. Fehlt sie, bleibt die Liste leer. */
  readonly figuren?: Figurenquelle;
  /** Der Weg zum Karteneditor. Fehlt er, gibt es den Knopf nicht. */
  readonly karteAnlegen?: Kartenanleger;
  /** Die Kampagnen, in die uebernommen werden kann, und die vorbelegte. */
  readonly kampagnen?: () => Promise<{ liste: { id: string; name: string }[]; aktuell: string | null }>;
}

export interface InspirationEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  /**
   * Sagt der Oberflaeche, dass sich die KI-Einstellung der Sammlung geaendert
   * hat.
   *
   * Ohne das fragt sie nur einmal beim Laden, ob eine KI da ist: wer sie
   * danach einschaltet, saehe die Knoepfe erst nach einem Neustart.
   */
  meldeKiWechsel(webContents: WebContents): void;
}

/**
 * Die Richtlinie.
 *
 * Alles aus den eigenen Dateien; `connect-src` geht nirgendwohin. Das
 * Werkzeug wuerfelt aus Tabellen, es braucht kein Netz.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');

export async function mountInspiration(
  options: InspirationEmbedOptions
): Promise<InspirationEmbed> {
  // Erst abmelden: nach einem Fehlschlag kann dieselbe Anwendung ein zweites
  // Mal montiert werden, und `handle` weist einen zweiten Handler ab.
  ipcMain.removeHandler(kanal('export'));
  ipcMain.handle(kanal('export'), async (_e, notizen: Notiz[], kampagneId?: string | null, ersetzen?: boolean) => {
    if (!options.anlegen) {
      return { ok: false, text: 'Der Story Creator ist nicht verfügbar.', angelegt: 0 };
    }
    try {
      return await options.anlegen(notizen, kampagneId ?? null, { ersetzen: ersetzen === true });
    } catch (fehler) {
      return {
        ok: false,
        text: String(fehler instanceof Error ? fehler.message : fehler),
        angelegt: 0
      };
    }
  });

  ipcMain.removeHandler(kanal('kampagnen'));
  ipcMain.handle(kanal('kampagnen'), async () =>
    options.kampagnen ? await options.kampagnen().catch(() => ({ liste: [], aktuell: null })) : { liste: [], aktuell: null }
  );

  ipcMain.removeHandler(kanal('figuren'));
  ipcMain.handle(kanal('figuren'), async (_e, kampagneId?: string | null): Promise<readonly KampagnenFigur[]> => {
    if (!options.figuren) return [];
    try {
      return await options.figuren(kampagneId ?? null);
    } catch {
      // Eine leere Liste ist hier die ehrlichere Antwort als ein Fehler: die
      // Oberflaeche sagt dann „niemand da", und das stimmt aus ihrer Sicht.
      return [];
    }
  });

  /**
   * Ob es den Weg zum Karteneditor gibt.
   *
   * Die Oberflaeche blendet den Knopf danach ein. Ohne Huelle — etwa im
   * Entwicklungsserver allein — gibt es ihn gar nicht erst, statt ausgegraut
   * dazustehen.
   */
  ipcMain.removeHandler(kanal('karte:da'));
  ipcMain.handle(kanal('karte:da'), () => Boolean(options.karteAnlegen));

  ipcMain.removeHandler(kanal('karte'));
  ipcMain.handle(
    kanal('karte'),
    async (_e, name: string, notizen: { title: string; text: string }[] = []): Promise<boolean> => {
    if (!options.karteAnlegen) return false;
    try {
      return await options.karteAnlegen(name, notizen);
    } catch {
      return false;
    }
    }
  );

  // --- KI ------------------------------------------------------------------

  /**
   * Baut den Anbieter fuer diese eine Anfrage.
   *
   * Jedes Mal neu, weil die Einstellung sich zwischendurch geaendert haben
   * kann. Das kostet nichts: es ist ein Objekt, keine Verbindung.
   */
  const anbieter = () => {
    if (!options.kiQuelle) return null;
    const quelle = options.kiQuelle();
    return baueAnbieter(quelle.einstellungen, quelle.schluessel);
  };

  /** Ob die KI ueberhaupt da ist. Die Oberflaeche blendet die Knoepfe danach ein. */
  ipcMain.removeHandler(kanal('ki:da'));
  ipcMain.handle(kanal('ki:da'), () => anbieter() !== null);

  /**
   * Einen Baustein vorschlagen lassen.
   *
   * Ein Fehler kommt als Ergebnis zurueck und nicht als Ausnahme: die
   * Oberflaeche soll ihn anzeigen und den Entwurf stehen lassen, nicht in
   * einen abgebrochenen Aufruf laufen.
   */
  ipcMain.removeHandler(kanal('ki:frage'));
  ipcMain.handle(kanal('ki:frage'), async (_e, frage: Frage, sprache: Sprache): Promise<KiErgebnis> => {
    const gewaehlt = anbieter();
    if (!gewaehlt) return { ok: false, wert: null, grund: 'error.aiNoProvider' };

    try {
      const antwort = await gewaehlt.frage(
        {
          system: systemAnweisung(sprache),
          nachrichten: [{ rolle: 'user', inhalt: anweisung(frage, sprache) }]
        },
        // Teiltexte interessieren hier nicht: es kommt ein kurzes JSON, und
        // ein halb geschriebenes JSON kann die Oberflaeche nicht anzeigen.
        () => {}
      );

      const gelesen = leseJsonAntwort(antwort);
      if (gelesen === null) return { ok: false, wert: null, grund: 'error.aiKeinJson' };

      const wert = uebernehmbar(frage.aufgabe, gelesen);
      if (wert === null) return { ok: false, wert: null, grund: 'error.aiKeinJson' };
      return { ok: true, wert, grund: '' };
    } catch (fehler) {
      if (fehler instanceof KiFehler) return { ok: false, wert: null, grund: fehler.schluessel };
      return { ok: false, wert: null, grund: 'error.aiOther' };
    }
  });

  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
  ipcMain.on(kanal('sprache:gewechselt'), (_event, language: string) => {
    options.onLanguageChange?.(language);
  });

  return {
    preloadPath: path.join(options.distDir, 'preload.js'),
    indexFile: options.devServerUrl
      ? null
      : path.join(options.distDir, '..', 'renderer', 'index.html'),
    devServerUrl: options.devServerUrl ?? null,
    csp: CSP,
    flush: async () => {
      // Nichts zu sichern: der Entwurf lebt in der Sitzung, und was bleiben
      // soll, ist beim Uebernehmen schon drueben.
    },
    setLanguage: async (webContents, language) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    },
    meldeKiWechsel: (webContents) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('ki:gewechselt'));
    }
  };
}
