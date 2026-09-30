/**
 * Die Montage-Schnittstelle des NPC Creators (Konvention 7).
 *
 * Wie bei den anderen Werkzeugen: die Huelle ruft `mountNpc` und bekommt
 * zurueck, was sie zum Anzeigen braucht. Kein eigenstaendiger Hauptprozess.
 *
 * Der NPC Creator hat keine eigene Ablage — die Figuren gehoeren in den
 * Story Creator, und die Merkliste lebt nur in der Sitzung. Gespeichert
 * wird hier nichts.
 */
import path from 'node:path';
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { baueAnbieter, KiFehler, leseJsonAntwort } from '@suite/ki';
import type { KiEinstellungen } from '@suite/ki/einstellungen';
import { kanal } from '../shared/kanaele';
import {
  feldAnweisung,
  figurAnweisung,
  systemAnweisung,
  uebernehmbareFelder,
  uebernehmbarerWert
} from '../shared/kiAufgaben';
import type { Feld, Figur, Wuensche } from '../shared/erzeuge';
import type { Sprache } from '../shared/tabellen';

export interface ExportErgebnis {
  readonly ok: boolean;
  readonly text: string;
  /** Die Figur steht schon in der Kampagne; die Oberflaeche bietet Aktualisieren an. */
  readonly vorhanden?: boolean;
}

/** Wie angelegt wird. */
export interface ExportOptionen {
  /** Eine vorhandene gleichnamige Notiz aktualisieren statt abzulehnen. */
  readonly ersetzen?: boolean;
  /** Werte fuer die Steckbrieffelder, nach Feldschluessel (z. B. species). */
  readonly felder?: Readonly<Record<string, string>>;
}

/**
 * Wie eine Figur ins Archiv kommt.
 *
 * Die Huelle reicht das durch, weil nur sie weiss, ob der Story Creator
 * ueberhaupt montiert ist und welche Kampagne offen steht. Der NPC Creator
 * kennt den Vault nicht und soll ihn auch nicht kennen.
 */
export type Anleger = (
  titel: string,
  markdown: string,
  kampagneId?: string | null,
  optionen?: ExportOptionen
) => Promise<ExportErgebnis>;

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
export interface KiErgebnis<T> {
  readonly ok: boolean;
  /** Bei Erfolg das Ergebnis, sonst null. */
  readonly wert: T | null;
  /** Bei Misserfolg der Schluessel der Meldung, sonst leer. */
  readonly grund: string;
}

export interface NpcEmbedOptions {
  readonly distDir: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Legt die Figur an. Fehlt sie, meldet der Export das ehrlich. */
  readonly anlegen?: Anleger;
  /** Die Kampagnen, in die angelegt werden kann, und die vorbelegte. */
  readonly kampagnen?: () => Promise<{ liste: { id: string; name: string }[]; aktuell: string | null }>;
  /** Die KI der Sammlung. Fehlt sie, gibt es hier keine KI. */
  readonly kiQuelle?: KiQuelle;
}

export interface NpcEmbed {
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
 * Alles aus den eigenen Dateien. `style-src` braucht 'unsafe-inline', weil
 * React Stile ueber `style`-Attribute setzt; `connect-src` geht nirgendwohin.
 *
 * Das gilt auch mit KI: die Anfrage geht vom Hauptprozess aus, nicht von der
 * Oberflaeche. So bleibt der Renderer ohne Netzzugriff, und der API-Schluessel
 * erreicht ihn nie. Diese Zeile muss deshalb NICHT geoeffnet werden.
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

export async function mountNpc(options: NpcEmbedOptions): Promise<NpcEmbed> {
  // Erst abmelden: nach einem Fehlschlag kann dieselbe Anwendung ein zweites
  // Mal montiert werden, und `handle` weist einen zweiten Handler ab.
  ipcMain.removeHandler(kanal('export'));
  ipcMain.handle(
    kanal('export'),
    async (_e, titel: string, markdown: string, kampagneId?: string | null, optionen?: ExportOptionen) => {
    if (!options.anlegen) {
      return { ok: false, text: 'Der Story Creator ist nicht verfügbar.' };
    }
    try {
      return await options.anlegen(titel, markdown, kampagneId ?? null, {
        ersetzen: optionen?.ersetzen === true,
        felder: optionen?.felder ?? {}
      });
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  }
  );

  ipcMain.removeHandler(kanal('kampagnen'));
  ipcMain.handle(kanal('kampagnen'), async () =>
    options.kampagnen ? await options.kampagnen().catch(() => ({ liste: [], aktuell: null })) : { liste: [], aktuell: null }
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

  /**
   * Fragt das Modell und liest JSON aus der Antwort.
   *
   * Ein Fehler kommt als Ergebnis zurueck und nicht als Ausnahme: die
   * Oberflaeche soll ihn anzeigen und die Figur stehen lassen, nicht in einen
   * abgebrochenen Aufruf laufen.
   */
  async function frage<T>(
    sprache: Sprache,
    anweisung: string,
    auswerten: (gelesen: unknown) => T | null
  ): Promise<KiErgebnis<T>> {
    const gewaehlt = anbieter();
    if (!gewaehlt) return { ok: false, wert: null, grund: 'error.aiNoProvider' };

    try {
      const antwort = await gewaehlt.frage(
        {
          system: systemAnweisung(sprache),
          nachrichten: [{ rolle: 'user', inhalt: anweisung }]
        },
        // Teiltexte interessieren hier nicht: es kommt ein kurzes JSON, und
        // ein halb geschriebenes JSON kann die Oberflaeche nicht anzeigen.
        () => {}
      );

      const gelesen = leseJsonAntwort(antwort);
      if (gelesen === null) return { ok: false, wert: null, grund: 'error.aiKeinJson' };

      const wert = auswerten(gelesen);
      if (wert === null) return { ok: false, wert: null, grund: 'error.aiKeinJson' };
      return { ok: true, wert, grund: '' };
    } catch (fehler) {
      if (fehler instanceof KiFehler) return { ok: false, wert: null, grund: fehler.schluessel };
      return { ok: false, wert: null, grund: 'error.aiOther' };
    }
  }

  /** Ob die KI ueberhaupt da ist. Die Oberflaeche blendet die Knoepfe danach ein. */
  ipcMain.removeHandler(kanal('ki:da'));
  ipcMain.handle(kanal('ki:da'), () => anbieter() !== null);

  ipcMain.removeHandler(kanal('ki:feld'));
  ipcMain.handle(
    kanal('ki:feld'),
    (_e, feld: Feld, figur: Figur, wuensche: Wuensche, sprache: Sprache) =>
      frage(sprache, feldAnweisung(feld, figur, wuensche, sprache), uebernehmbarerWert)
  );

  ipcMain.removeHandler(kanal('ki:figur'));
  ipcMain.handle(
    kanal('ki:figur'),
    (_e, figur: Figur | null, festgehalten: Feld[], wuensche: Wuensche, sprache: Sprache) =>
      frage(sprache, figurAnweisung(figur, festgehalten, wuensche, sprache), (gelesen) => {
        const felder = uebernehmbareFelder(gelesen);
        // Kommt gar nichts Brauchbares zurueck, gilt das als Fehlschlag. Eine
        // Figur, bei der sich nichts geaendert hat, sieht sonst aus wie ein
        // Knopf, der nicht reagiert.
        return Object.keys(felder).length > 0 ? felder : null;
      })
  );

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
      // Nichts zu sichern: die Merkliste lebt nur in der Sitzung, und Figuren
      // wandern auf Knopfdruck in den Story Creator.
    },
    setLanguage: async (webContents, language) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    },
    meldeKiWechsel: (webContents) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('ki:gewechselt'));
    }
  };
}
