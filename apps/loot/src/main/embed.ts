/**
 * Die Montage-Schnittstelle des Loot Generators (Konvention 7).
 *
 * Die Huelle ruft `mountLoot` und bekommt zurueck, was sie zum Anzeigen
 * braucht. Kein eigenstaendiger Hauptprozess: das Werkzeug laeuft nur in
 * der Huelle, wie der Magic Item Generator.
 *
 * Abgelegt wird je Tabelle eine Markdown-Datei unter
 * `<datenordner>/tabellen`. Die Datei ist zugleich das Format zum
 * Weitergeben: „Weitergeben" schreibt sie irgendwohin, „Einlesen" holt
 * fremde herein. Die Sicherung der Huelle nimmt den Ordner von selbst mit.
 */
import { srdTabellen } from '../shared/srd';
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { kanal } from '../shared/kanaele';
import {
  alsKachel,
  alsMarkdown,
  freieKennung,
  leseTabelle,
  zuId,
  type Gespeichert,
  type Kachel
} from '../shared/ablage';
import { beispiele } from '../shared/beispiele';

/** Der Name, unter dem das Werkzeug in der Huelle und in der Suche steht. */
export const WERKZEUG = 'loot';
export const ORDNER_NAME = 'tabellen';

export interface LootEmbedOptions {
  readonly distDir: string;
  /** Der eigene Datenordner. */
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Legt eine Notiz im Story Creator an. Fehlt sie, meldet der Export es ehrlich. */
  readonly anlegen?: (titel: string, markdown: string) => Promise<{ ok: boolean; text: string }>;
  /** Die Gegenstaende des Magic Item Generators, von der Huelle durchgereicht. */
  readonly gegenstaende?: () => Promise<{ name: string; seltenheit: string }[]>;
}

export interface LootEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
}

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

async function leseAlle(ordner: string): Promise<Gespeichert[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Gespeichert[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(leseTabelle(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

/**
 * Was dieses Werkzeug abgelegt hat, fuer die Suche der Huelle. Die Huelle
 * gibt ihren Datenordner; darin hat jedes Werkzeug seinen eigenen.
 */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  // Die eingebauten SRD-Tabellen gehoeren dazu (Rueckmeldung: nur Eigene waren zu finden).
  const alle = [...(await leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME))), ...srdTabellen(sprache)];
  return alle.map((t) => ({
    werkzeug: WERKZEUG,
    kennung: t.id,
    name: t.name,
    art: sprache === 'de' ? 'Zufallstabelle' : 'Random table',
    stichworte: [...(t.aliase ?? []), 'random table', 'loot', 'Beute', t.eintraege.map((e) => e.text).join(' ').slice(0, 300)].join(' ')
  }));
}

/** Die eigenen Tabellen, fuer andere Werkzeuge ueber die Huelle (Charakterbogen: Beute wuerfeln). */
export async function leseTabellen(datenordner: string): Promise<Gespeichert[]> {
  return leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME));
}

export async function mountLoot(options: LootEmbedOptions): Promise<LootEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  // `mkdir` meldet den ersten neu angelegten Pfad — nur dann ist es der
  // erste Start, und nur dann kommen die Beispiele. Wer sie loescht, soll
  // sie nicht beim naechsten Start wiederfinden.
  const neuAngelegt = await mkdir(ordner, { recursive: true });
  if (neuAngelegt) {
    for (const t of beispiele(options.language ?? 'en')) {
      try {
        await writeFile(
          path.join(ordner, `${t.id}.md`),
          alsMarkdown({ ...t, geaendert: new Date().toISOString() }),
          'utf8'
        );
      } catch {
        // Ohne Beispiele geht es auch.
      }
    }
  }

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };
  const fensterVon = (ereignis: never) =>
    BrowserWindow.fromWebContents((ereignis as { sender: WebContents }).sender);

  handle('liste', async (): Promise<Kachel[]> => (await leseAlle(ordner)).map(alsKachel));

  // Alle Tabellen ganz: zum Wuerfeln braucht die Oberflaeche die Ziele
  // der Verweise. Tabellen sind klein, das geht in einem Rutsch.
  handle('alle', async (): Promise<Gespeichert[]> => leseAlle(ordner));

  handle('lesen', async (_e: never, id: string): Promise<Gespeichert | null> => {
    try {
      return leseTabelle(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
    } catch {
      return null;
    }
  });

  /*
   * Beim ANLEGEN eine freie Kennung, beim Bearbeiten die alte: zwei
   * Tabellen gleichen Namens sollen sich nicht ueberschreiben.
   */
  handle(
    'speichern',
    async (_e: never, t: Gespeichert, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
      const vergeben = neu ? (await leseAlle(ordner)).map((x) => x.id) : [];
      const id = neu ? freieKennung(zuId(t.name), vergeben) : zuId(t.id);
      try {
        await writeFile(
          path.join(ordner, `${id}.md`),
          alsMarkdown({ ...t, id, geaendert: new Date().toISOString() }),
          'utf8'
        );
        return { ok: true, id, text: '' };
      } catch (fehler) {
        return { ok: false, id, text: String(fehler instanceof Error ? fehler.message : fehler) };
      }
    }
  );

  handle('loeschen', async (_e: never, id: string): Promise<boolean> => {
    try {
      await unlink(path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

  /** Eine Tabelle als Datei weitergeben. */
  handle('weitergeben', async (ereignis: never, id: string): Promise<{ ok: boolean; text: string }> => {
    try {
      const inhalt = await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8');
      const fenster = fensterVon(ereignis);
      const frage = { defaultPath: `${zuId(id)}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] };
      const ergebnis = fenster ? await dialog.showSaveDialog(fenster, frage) : await dialog.showSaveDialog(frage);
      if (ergebnis.canceled || !ergebnis.filePath) return { ok: false, text: '' };
      await writeFile(ergebnis.filePath, inhalt, 'utf8');
      return { ok: true, text: ergebnis.filePath };
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  /**
   * Tabellen von anderen einlesen. Jede bekommt eine freie Kennung, nichts
   * Vorhandenes wird ueberschrieben. Meldet die Namen der eingelesenen.
   */
  handle('einlesen', async (ereignis: never): Promise<{ ok: boolean; namen: string[]; text: string }> => {
    try {
      const fenster = fensterVon(ereignis);
      const frage = {
        properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
        filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }]
      };
      const ergebnis = fenster ? await dialog.showOpenDialog(fenster, frage) : await dialog.showOpenDialog(frage);
      if (ergebnis.canceled || ergebnis.filePaths.length === 0) return { ok: false, namen: [], text: '' };
      const vergeben = (await leseAlle(ordner)).map((x) => x.id);
      const namen: string[] = [];
      for (const datei of ergebnis.filePaths) {
        const ersatz = path.basename(datei).replace(/\.(md|txt)$/i, '');
        const t = leseTabelle(await readFile(datei, 'utf8'), ersatz);
        if (t.eintraege.length === 0) continue;
        const id = freieKennung(zuId(t.name), vergeben);
        vergeben.push(id);
        await writeFile(path.join(ordner, `${id}.md`), alsMarkdown({ ...t, id, geaendert: new Date().toISOString() }), 'utf8');
        namen.push(t.name);
      }
      return { ok: true, namen, text: '' };
    } catch (fehler) {
      return { ok: false, namen: [], text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  handle('gegenstaende', async (): Promise<{ name: string; seltenheit: string }[]> => {
    try {
      return (await options.gegenstaende?.()) ?? [];
    } catch {
      return [];
    }
  });

  /** Ein Wurf als Notiz in den Story Creator. */
  handle('story', async (_e: never, titel: string, markdown: string): Promise<{ ok: boolean; text: string }> => {
    if (!options.anlegen) return { ok: false, text: 'Der Story Creator ist nicht verfügbar.' };
    try {
      return await options.anlegen(titel, markdown);
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
  ipcMain.on(kanal('sprache:gewechselt'), (_event, language: string) => {
    options.onLanguageChange?.(language);
  });

  return {
    preloadPath: path.join(options.distDir, 'preload.js'),
    indexFile: options.devServerUrl ? null : path.join(options.distDir, '..', 'renderer', 'index.html'),
    devServerUrl: options.devServerUrl ?? null,
    csp: CSP,
    flush: async () => {
      // Gespeichert wird auf Knopfdruck; hier bleibt nichts liegen.
    },
    setLanguage: async (webContents, language) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    },
    zeigeEintrag: async (webContents, kennung) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('suche:zeigen'), kennung);
      return true;
    }
  };
}

/** Meldet alles ab. Fuer Tests und einen sauberen Abbau. */
export function unmountLoot(): void {
  for (const name of ['liste', 'alle', 'lesen', 'speichern', 'loeschen', 'weitergeben', 'einlesen', 'story', 'gegenstaende']) {
    ipcMain.removeHandler(kanal(name));
  }
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
