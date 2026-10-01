/**
 * Die Montage-Schnittstelle des Settlement Generators (Konvention 7,
 * docs/ortsgenerator.md).
 *
 * Abgelegt wird je Ort eine Markdown-Datei unter `<datenordner>/orte`. Der
 * Export in den Story Creator und die Kampagnenliste kommen von der Hülle,
 * wie bei Inspirationshilfe und NPC Creator.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { kanal } from '../shared/kanaele';
import { alsDatei, alsKachel, alsLootTabellen, alsNotizen, freieKennung, kurzzeile, leseDatei, zuId, type Gespeichert, type Kachel, type Notiz } from '../shared/ablage';
import { GROESSE_NAME } from '../shared/tabellen';

export const WERKZEUG = 'orte';
export const ORDNER_NAME = 'orte';

/** Wie die Hülle mehrere Notizen anlegt (derselbe Weg wie bei der Inspirationshilfe). */
export type Anleger = (
  notizen: readonly Notiz[],
  kampagneId?: string | null,
  optionen?: { ersetzen?: boolean }
) => Promise<{ ok: boolean; text: string; angelegt: number; vorhanden?: number }>;

export interface OrteEmbedOptions {
  readonly distDir: string;
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  readonly onEreignis?: (appId: string) => void;
  readonly anlegen?: Anleger;
  readonly kampagnen?: () => Promise<{ liste: { id: string; name: string }[]; aktuell: string | null }>;
}

export interface OrteEmbed {
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

async function leseOrdner(ordner: string): Promise<Gespeichert[]> {
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
      heraus.push(leseDatei(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

export async function leseAlle(datenordner: string): Promise<Gespeichert[]> {
  return leseOrdner(path.join(datenordner, WERKZEUG, ORDNER_NAME));
}

/** Für die Suche der Hülle (Strg+K). */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  return (await leseAlle(datenordner)).map((o) => ({
    werkzeug: WERKZEUG,
    kennung: o.id,
    name: o.name,
    art: GROESSE_NAME[o.groesse][sprache],
    stichworte: [
      kurzzeile(o, 'de'),
      kurzzeile(o, 'en'),
      o.gasthaus.name,
      ...o.laeden.map((l) => l.name),
      ...o.personen.map((p) => p.figur.name),
      o.problem
    ].join(' ')
  }));
}

/**
 * Die Läden der Orte, die in den Loot Generator geschickt wurden: je Ware ein
 * Eintrag mit dem Namen der Tabelle (Laden und Ort). Der Loot Generator macht
 * daraus je Laden eine Tabelle (gegenstandsTabellen, `herkunft: 'ort'`).
 */
export async function leseFuerLoot(
  datenordner: string
): Promise<{ name: string; seltenheit: string; herkunft: 'ort'; tabelle: string }[]> {
  return (await leseAlle(datenordner))
    .filter((o) => o.imLoot)
    .flatMap((o) => alsLootTabellen(o).flatMap((t) => t.eintraege.map((name) => ({ name, seltenheit: '', herkunft: 'ort' as const, tabelle: t.name }))));
}

export async function mountOrte(options: OrteEmbedOptions): Promise<OrteEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };

  handle('liste', async (): Promise<Kachel[]> => (await leseOrdner(ordner)).map(alsKachel));

  handle('lesen', async (_e: never, id: string): Promise<Gespeichert | null> => {
    try {
      return leseDatei(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
    } catch {
      return null;
    }
  });

  handle('speichern', async (_e: never, roh: Gespeichert, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
    const vergeben = neu ? (await leseOrdner(ordner)).map((x) => x.id) : [];
    const id = neu ? freieKennung(zuId(roh.name), vergeben) : zuId(roh.id);
    try {
      const sauber = leseDatei(alsDatei({ ...roh, id, geaendert: new Date().toISOString() }), id);
      await writeFile(path.join(ordner, `${id}.md`), alsDatei(sauber), 'utf8');
      return { ok: true, id, text: '' };
    } catch (fehler) {
      return { ok: false, id, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  const setzeLoot = async (id: string, drin: boolean): Promise<boolean> => {
    const datei = path.join(ordner, `${zuId(id)}.md`);
    try {
      const o = leseDatei(await readFile(datei, 'utf8'), zuId(id));
      await writeFile(datei, alsDatei({ ...o, imLoot: drin }), 'utf8');
      if (drin) options.onEreignis?.('loot');
      return true;
    } catch {
      return false;
    }
  };
  handle('inDenLoot', async (_e: never, id: string) => setzeLoot(id, true));
  handle('ausDemLoot', async (_e: never, id: string) => setzeLoot(id, false));

  handle('loeschen', async (_e: never, id: string): Promise<boolean> => {
    try {
      await unlink(path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

  handle('kampagnen', async () => {
    try {
      return (await options.kampagnen?.()) ?? { liste: [], aktuell: null };
    } catch {
      return { liste: [], aktuell: null };
    }
  });

  handle('export', async (_e: never, o: Gespeichert, kampagneId: string | null, ersetzen: boolean) => {
    if (!options.anlegen) return { ok: false, text: 'Der Story Creator ist nicht verfügbar.', angelegt: 0 };
    try {
      const sauber = leseDatei(alsDatei(o), zuId(o.id || o.name));
      return await options.anlegen(alsNotizen(sauber, sauber.sprache, sauber.notiz), kampagneId, { ersetzen });
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler), angelegt: 0 };
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
      // Gespeichert wird auf Knopfdruck.
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

export function unmountOrte(): void {
  for (const name of ['liste', 'lesen', 'speichern', 'inDenLoot', 'ausDemLoot', 'loeschen', 'kampagnen', 'export']) ipcMain.removeHandler(kanal(name));
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
