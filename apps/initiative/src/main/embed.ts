/**
 * Die Montage-Schnittstelle des Initiative Trackers (Konvention 7).
 *
 * Die Huelle ruft `mountInitiative` und bekommt zurueck, was sie zum Anzeigen
 * braucht: Preload, Oberflaeche, die Content-Security-Policy und die
 * Sprachkopplung. Die Anwendung selbst merkt nicht, dass sie eingebettet
 * laeuft.
 *
 * Anders als der Story Creator bringt der Tracker keinen eigenen
 * eigenstaendigen Hauptprozess mit: er laeuft ausschliesslich in der Huelle.
 * Ein zweiter Einstiegspunkt waere Code, den niemand benutzt und den trotzdem
 * jeder pflegen muesste.
 */
import path from 'node:path';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { Ablage } from './ablage';
import { registriereIpc, entferneIpc } from './ipc';
import { behandleBildProtokoll, registriereBildSchema } from './bildProtokoll';
import { kanal, BILD_SCHEMA } from '../shared/kanaele';
import type { Uebergabe } from '@suite/uebergabe';
import { KEIN_RAUM, type RaumLage } from '../shared/teilen';

export { registriereBildSchema };

export interface InitiativeEmbedOptions {
  /** Wohin der Tracker seine Daten legt. */
  readonly userDataDir: string;
  /** Wo die gebaute Oberflaeche liegt (dist/renderer). */
  readonly distDir: string;
  /** Sitzung der eingebetteten Ansicht, fuer Protokoll und CSP. */
  readonly partition?: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  /** Wird gerufen, wenn *hier* die Sprache umgestellt wurde. */
  readonly onLanguageChange?: (language: string) => void;
  /**
   * Der Raum im lokalen Netz, von der Huelle durchgereicht (geteilte
   * Initiative). Fehlt er, gibt es nichts zu teilen.
   */
  readonly raum?: {
    sende(inhalt: string, an: string | null): boolean;
    /** Beim Laden: die Lage im Raum und was schon geteilt wurde. */
    anfang(): { lage: RaumLage; nachrichten: readonly { von: { id: string; name: string }; inhalt: string }[] };
  };
  /**
   * Die eigenen Zustaende aus dem Status Effect Creator, von der Huelle
   * gelesen. Der Tracker schlaegt sie neben denen des SRD vor.
   */
  readonly eigeneZustaende?: () => Promise<readonly { name: string; text: string }[]>;
  /** TP einer Figur aus dem Charakterbogen haben sich im Kampf geaendert: zurueck an den Bogen. */
  readonly bogenTp?: (kennung: string, hp: number, temp: number) => void;
}

export interface InitiativeEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  /** Die Richtlinie, die die Huelle ueber die Sitzung legt. */
  readonly csp: string;
  /** Sichert Ungespeichertes. Der Tracker schreibt laufend, hier bleibt wenig. */
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  /**
   * Zeigt einen Eintrag, den die Suche der Huelle gefunden hat.
   *
   * Antwortet `false`, wenn die Ansicht weg ist. Ob es den Eintrag noch
   * gibt, entscheidet die Oberflaeche — sie hat die Liste.
   */
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
  /**
   * Stellt eine Begegnung aus einem anderen Werkzeug zu.
   *
   * Uebernommen wird sie hier NICHT. Die Oberflaeche fragt erst dieselbe
   * Frage wie bei „Neue Begegnung" — laeuft ein Kampf oder steht etwas
   * Ungespeichertes da, wird von aussen nichts weggeworfen.
   */
  uebernimmBegegnung(webContents: WebContents, uebergabe: Uebergabe): Promise<boolean>;
  /**
   * Figuren aus dem Charakterbogen. `hinzufuegen`: neue anfuegen; sonst nur
   * vorhandene auffrischen (etwa nach einer Aenderung am Bogen).
   */
  figuren(webContents: WebContents, figuren: readonly unknown[], hinzufuegen: boolean): boolean;
  /** Eine Nachricht aus dem Raum (geteilte Initiative). */
  raumNachricht(webContents: WebContents, von: { id: string; name: string }, inhalt: string): void;
  /** Die Lage im Raum hat sich geaendert. */
  raumZustand(webContents: WebContents, lage: RaumLage): void;
}

/**
 * Die Content-Security-Policy des Trackers.
 *
 * `img-src` erlaubt das eigene Bildprotokoll — ohne diesen Eintrag blieben die
 * Bilder der Teilnehmer leer, und zwar ohne sichtbaren Fehler. `style-src`
 * braucht 'unsafe-inline', weil React Stile ueber `style`-Attribute setzt.
 * Kein `unsafe-eval`, kein `connect-src` nach draussen: der Tracker redet mit
 * niemandem.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${BILD_SCHEMA}:`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');

/**
 * Was dieses Werkzeug abgelegt hat, fuer die Suche der Huelle.
 *
 * Nur die Begegnungen: der laufende Kampf ist kein Eintrag, den man sucht,
 * sondern der Zustand des Abends. Die Teilnehmer gehoeren als Stichworte
 * dazu — wer eine Begegnung sucht, weiss oft nur noch, wer darin vorkam.
 */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  try {
    // `datenordner` ist die Wurzel der Huelle, nicht der Ordner dieses
    // Werkzeugs: jedes Werkzeug haengt seinen eigenen Unterordner an (siehe
    // `datenordner(id)` in der Huelle). Ohne das `initiative` hier laese die
    // Ablage in der Wurzel — und faende stumm nichts.
    const begegnungen = await new Ablage(path.join(datenordner, 'initiative')).listeBegegnungen();
    return begegnungen.map((begegnung) => ({
      werkzeug: 'initiative',
      kennung: begegnung.id,
      name: begegnung.name,
      art: sprache === 'de' ? 'Begegnung' : 'Encounter',
      stichworte: begegnung.teilnehmer.map((teilnehmer) => teilnehmer.name).join(' ')
    }));
  } catch {
    return [];
  }
}

export async function mountInitiative(
  options: InitiativeEmbedOptions
): Promise<InitiativeEmbed> {
  const ablage = new Ablage(options.userDataDir);
  await ablage.init();
  registriereIpc(ablage);
  behandleBildProtokoll(ablage, options.partition);

  // Meldet die Oberflaeche einen Sprachwechsel, reicht die Huelle ihn an die
  // anderen Werkzeuge weiter.
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
  ipcMain.on(kanal('sprache:gewechselt'), (_event, language: string) => {
    options.onLanguageChange?.(language);
  });

  ipcMain.removeHandler(kanal('raum:senden'));
  ipcMain.handle(kanal('raum:senden'), (_event, inhalt: string, an: string | null) =>
    typeof inhalt === 'string' ? (options.raum?.sende(inhalt, an) ?? false) : false
  );
  ipcMain.removeHandler(kanal('raum:anfang'));
  ipcMain.handle(kanal('raum:anfang'), () => options.raum?.anfang() ?? { lage: KEIN_RAUM, nachrichten: [] });
  ipcMain.removeAllListeners(kanal('bogen:tp'));
  ipcMain.on(kanal('bogen:tp'), (_e, kennung: unknown, hp: unknown, temp: unknown) => {
    if (typeof kennung !== 'string' || !kennung) return;
    options.bogenTp?.(kennung.slice(0, 120), Math.max(0, Math.round(Number(hp) || 0)), Math.max(0, Math.round(Number(temp) || 0)));
  });
  ipcMain.removeHandler(kanal('zustaende:eigene'));
  ipcMain.handle(kanal('zustaende:eigene'), async () => (await options.eigeneZustaende?.().catch(() => [])) ?? []);

  return {
    raumNachricht: (webContents, von, inhalt) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('raum:nachricht'), von, inhalt);
    },
    raumZustand: (webContents, lage) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('raum:zustand'), lage);
    },
    figuren: (webContents, figuren, hinzufuegen) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('figuren'), figuren, hinzufuegen);
      return true;
    },
    uebernimmBegegnung: async (webContents, uebergabe) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('uebergabe'), uebergabe);
      return true;
    },
    zeigeEintrag: async (webContents, kennung) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('suche:zeigen'), kennung);
      return true;
    },
    // Das Preload liegt neben dem gebuendelten Hauptprozessteil, die
    // Oberflaeche eine Ebene darueber.
    preloadPath: path.join(options.distDir, 'preload.js'),
    indexFile: options.devServerUrl ? null : path.join(options.distDir, '..', 'renderer', 'index.html'),
    devServerUrl: options.devServerUrl ?? null,
    csp: CSP,
    flush: async () => {
      // Der Tracker schreibt den laufenden Kampf bei jeder Aenderung. Hier
      // bleibt nichts zu sichern — die Zusage steht trotzdem in der
      // Schnittstelle, damit die Huelle alle Werkzeuge gleich behandeln kann.
    },
    setLanguage: async (webContents, language) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    }
  };
}

/** Meldet alles ab. Fuer Tests und einen sauberen Abbau. */
export function unmountInitiative(): void {
  entferneIpc();
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
  ipcMain.removeHandler(kanal('raum:senden'));
  ipcMain.removeHandler(kanal('raum:anfang'));
  ipcMain.removeHandler(kanal('zustaende:eigene'));
}
