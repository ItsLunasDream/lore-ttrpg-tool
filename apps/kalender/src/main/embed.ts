/**
 * Die Montage-Schnittstelle des Campaign Calendar (Konvention 7,
 * docs/kampagnenkalender.md).
 *
 * Abgelegt wird je Umfrage eine Markdown-Datei unter `<datenordner>/umfragen`.
 * Antworten über den Raum führt die Hülle mit `nimmRaumNachricht` auch dann
 * zusammen, wenn das Werkzeug gerade nicht offen ist; ist es offen, lädt es
 * danach neu. Antworten als Datei: Export und Import über Dialoge.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { kanal } from '../shared/kanaele';
import { alsIcs, bereinige, fuehreZusammen, leseNachricht, wendeAn, type Umfrage } from '../shared/modell';

export const WERKZEUG = 'kalender';
export const ORDNER_NAME = 'umfragen';
const MARKE = '```kalender';

export interface RaumLage {
  readonly rolle: 'aus' | 'gastgeber' | 'gast';
  readonly ich: { readonly id: string; readonly name: string } | null;
  readonly personen: readonly { readonly id: string; readonly name: string; readonly sl?: boolean }[];
}

export interface KalenderEmbedOptions {
  readonly distDir: string;
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  readonly raum?: {
    sende(inhalt: string, an: string | null): boolean;
    lage(): RaumLage;
  };
}

export interface KalenderEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
  /** Nach einer Nachricht im Raum: die Oberfläche lädt neu. */
  raumNachricht(webContents: WebContents): void;
  raumZustand(webContents: WebContents, lage: RaumLage): void;
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

const KEIN_RAUM: RaumLage = { rolle: 'aus', ich: null, personen: [] };

// --- Ablage -------------------------------------------------------------------

export function alsDatei(u: Umfrage): string {
  return [`# ${u.titel || u.id}`, '', MARKE, JSON.stringify(u, null, 1), '```', ''].join('\n');
}

export function leseDatei(inhalt: string, id: string): Umfrage {
  const start = inhalt.lastIndexOf(MARKE);
  if (start >= 0) {
    const rumpf = inhalt.slice(start + MARKE.length);
    const ende = rumpf.indexOf('\n```');
    try {
      return bereinige(JSON.parse(ende >= 0 ? rumpf.slice(0, ende) : rumpf), id);
    } catch {
      // Kaputtes JSON: leer.
    }
  }
  return bereinige({ titel: /^#\s+(.+)$/m.exec(inhalt)?.[1]?.trim() ?? id }, id);
}

function sichereId(id: string): string | null {
  return /^[a-z0-9-]{1,80}$/.test(id) ? id : null;
}

async function leseOrdner(ordner: string): Promise<Umfrage[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Umfrage[] = [];
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

async function lies(ordner: string, id: string): Promise<Umfrage | null> {
  const sicher = sichereId(id);
  if (!sicher) return null;
  try {
    return leseDatei(await readFile(path.join(ordner, `${sicher}.md`), 'utf8'), sicher);
  } catch {
    return null;
  }
}

async function schreibe(ordner: string, u: Umfrage): Promise<void> {
  const sicher = sichereId(u.id);
  if (!sicher) throw new Error('ungültige Kennung');
  await mkdir(ordner, { recursive: true });
  await writeFile(path.join(ordner, `${sicher}.md`), alsDatei({ ...u, geaendert: new Date().toISOString() }), 'utf8');
}

function ordnerVon(datenordner: string): string {
  return path.join(datenordner, WERKZEUG, ORDNER_NAME);
}

/** Für die Suche der Hülle (Strg+K). */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  return (await leseOrdner(ordnerVon(datenordner))).map((u) => ({
    werkzeug: WERKZEUG,
    kennung: u.id,
    name: u.titel || u.id,
    art: sprache === 'de' ? 'Terminumfrage' : 'Scheduling poll',
    stichworte: [u.tage.join(' '), u.termin?.tag ?? '', u.antworten.map((a) => a.person).join(' ')].join(' ')
  }));
}

/**
 * Eine Nachricht aus dem Raum in die Ablage übernehmen. Die Hülle ruft das
 * für jede Nachricht an dieses Werkzeug, offen oder nicht. `true`, wenn sich
 * etwas geändert hat.
 */
export async function nimmRaumNachricht(datenordner: string, inhalt: string): Promise<boolean> {
  const n = leseNachricht(inhalt);
  if (!n) return false;
  const ordner = ordnerVon(datenordner);
  const id = n.art === 'umfrage' ? n.umfrage.id : n.umfrageId;
  const neu = wendeAn(await lies(ordner, id), n);
  if (!neu) return false;
  await schreibe(ordner, neu);
  return true;
}

// --- Montage ------------------------------------------------------------------

export async function mountKalender(options: KalenderEmbedOptions): Promise<KalenderEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };
  const fensterVon = (e: unknown) => BrowserWindow.fromWebContents((e as { sender: WebContents }).sender);

  handle('liste', async (): Promise<Umfrage[]> => leseOrdner(ordner));
  handle('lesen', async (_e: never, id: string) => lies(ordner, id));
  handle('speichern', async (_e: never, roh: Umfrage): Promise<{ ok: boolean; text: string }> => {
    const id = sichereId(String(roh?.id ?? ''));
    if (!id) return { ok: false, text: 'ungültige Kennung' };
    try {
      // Was schon liegt, kann neuere Antworten aus dem Raum haben: zusammenführen statt überschreiben.
      const vorhanden = await lies(ordner, id);
      const sauber = bereinige(roh, id);
      // Der Termin kommt aus der Oberfläche: wer ihn gelöst hat, will ihn nicht zurück.
      await schreibe(ordner, vorhanden ? { ...fuehreZusammen(sauber, vorhanden), termin: sauber.termin } : sauber);
      return { ok: true, text: '' };
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });
  handle('loeschen', async (_e: never, id: string): Promise<boolean> => {
    const sicher = sichereId(id);
    if (!sicher) return false;
    try {
      await unlink(path.join(ordner, `${sicher}.md`));
      return true;
    } catch {
      return false;
    }
  });

  // .ics für den eigenen Kalender.
  handle('ics', async (e: never, id: string): Promise<{ ok: boolean; text: string }> => {
    const u = await lies(ordner, id);
    const inhalt = u ? alsIcs(u) : null;
    if (!u || !inhalt) return { ok: false, text: '' };
    const fenster = fensterVon(e);
    const frage = { defaultPath: `${u.titel || u.id}.ics`, filters: [{ name: 'iCalendar', extensions: ['ics'] }] };
    const wahl = fenster ? await dialog.showSaveDialog(fenster, frage) : await dialog.showSaveDialog(frage);
    if (wahl.canceled || !wahl.filePath) return { ok: false, text: '' };
    await writeFile(wahl.filePath, inhalt, 'utf8');
    return { ok: true, text: wahl.filePath };
  });

  // Die Umfrage als Datei (für Discord, Mail …); dieselbe Datei kommt mit Antworten zurück.
  handle('datei:export', async (e: never, id: string): Promise<{ ok: boolean; text: string }> => {
    const u = await lies(ordner, id);
    if (!u) return { ok: false, text: '' };
    const fenster = fensterVon(e);
    const frage = { defaultPath: `${u.titel || u.id}.kalender.json`, filters: [{ name: 'Campaign Calendar', extensions: ['json'] }] };
    const wahl = fenster ? await dialog.showSaveDialog(fenster, frage) : await dialog.showSaveDialog(frage);
    if (wahl.canceled || !wahl.filePath) return { ok: false, text: '' };
    await writeFile(wahl.filePath, `${JSON.stringify({ art: 'umfrage', umfrage: u }, null, 1)}\n`, 'utf8');
    return { ok: true, text: wahl.filePath };
  });
  handle('datei:import', async (e: never): Promise<{ ok: boolean; id: string; text: string }> => {
    const fenster = fensterVon(e);
    const frage = { properties: ['openFile' as const], filters: [{ name: 'Campaign Calendar', extensions: ['json'] }] };
    const wahl = fenster ? await dialog.showOpenDialog(fenster, frage) : await dialog.showOpenDialog(frage);
    if (wahl.canceled || !wahl.filePaths[0]) return { ok: false, id: '', text: '' };
    try {
      const inhalt = await readFile(wahl.filePaths[0], 'utf8');
      const n = leseNachricht(inhalt.slice(0, 2_000_000));
      if (!n || n.art !== 'umfrage') return { ok: false, id: '', text: 'keine Umfrage' };
      const vorhanden = await lies(ordner, n.umfrage.id);
      await schreibe(ordner, vorhanden ? fuehreZusammen(vorhanden, n.umfrage) : n.umfrage);
      return { ok: true, id: n.umfrage.id, text: '' };
    } catch (fehler) {
      return { ok: false, id: '', text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  handle('raum:senden', async (_e: never, inhalt: string) => (typeof inhalt === 'string' ? (options.raum?.sende(inhalt, null) ?? false) : false));
  handle('raum:lage', async () => options.raum?.lage() ?? KEIN_RAUM);

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
      // Gespeichert wird bei jeder Änderung über die Oberfläche.
    },
    setLanguage: async (webContents, language) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    },
    zeigeEintrag: async (webContents, kennung) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('suche:zeigen'), kennung);
      return true;
    },
    raumNachricht: (webContents) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('raum:neu'));
    },
    raumZustand: (webContents, lage) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('raum:zustand'), lage);
    }
  };
}

export function unmountKalender(): void {
  for (const name of ['liste', 'lesen', 'speichern', 'loeschen', 'ics', 'datei:export', 'datei:import', 'raum:senden', 'raum:lage']) {
    ipcMain.removeHandler(kanal(name));
  }
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
