/**
 * Die Montage-Schnittstelle des Charakterbogens (Konvention 7).
 *
 * Wie der Loot Generator: kein eigener Hauptprozess, das Werkzeug laeuft nur
 * in der Huelle. Je Bogen eine Markdown-Datei unter
 * `<datenordner>/boegen` (Format in `shared/ablage.ts`). Die Sicherung der
 * Huelle nimmt den Ordner von selbst mit.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile, rename } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { kanal } from '../shared/kanaele';
import { alsKachel, alsMarkdown, freieKennung, klassenText, leseBogen, zuId, type Kachel } from '../shared/ablage';
import { bereinige, type Bogen } from '../shared/bogen';
import { uebergib, teileGeld, type Uebergabe } from '../shared/uebergabe';
import type { Sprache } from '../shared/regeln';
import type { Anfrage } from '../shared/live';
import { GASTGEBER, Liveleitung, type LiveZustand, type RaumLage } from './live';

export const WERKZEUG = 'charakterbogen';
export const ORDNER_NAME = 'boegen';

export interface BogenEmbedOptions {
  readonly distDir: string;
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Der Raum der Huelle, wenn es einen gibt: Boegen live teilen. */
  readonly raum?: {
    sende(inhalt: string, an: string | null): boolean;
    lage(): RaumLage;
    /** Das Gruppeninventar mit dem gespeicherten Raum merken. */
    merkeGruppe?(id: string): void;
    /** Eine Chatzeile in den Raum (Wuerfe). */
    chatte?(text: string, an: string | null): boolean;
  };
}

export interface BogenEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
  /** Eine Werkzeugnachricht aus dem Raum. */
  raumNachricht(webContents: WebContents, von: { id: string; name: string }, inhalt: string): void;
  /** Die Lage im Raum hat sich geaendert. */
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

async function leseAlle(ordner: string): Promise<Bogen[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Bogen[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(leseBogen(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

/** Erst in eine Nebendatei, dann umbenennen: ein Absturz mitten im Schreiben laesst den alten Stand stehen. */
async function schreibeSicher(datei: string, inhalt: string): Promise<void> {
  const neben = `${datei}.neu`;
  await writeFile(neben, inhalt, 'utf8');
  await rename(neben, datei);
}

/** Fuer die Suche der Huelle. */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  const alle = await leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME));
  return alle.map((b) => ({
    werkzeug: WERKZEUG,
    kennung: b.id,
    name: b.name,
    art:
      b.art === 'gruppe'
        ? sprache === 'de'
          ? 'Gruppeninventar'
          : 'Party inventory'
        : sprache === 'de'
          ? 'Charakterbogen'
          : 'Character sheet',
    stichworte: ['character sheet', 'Charakterbogen', b.werte?.spieler ?? '', klassenText(b), b.werte?.spezies ?? ''].join(' ')
  }));
}

export async function mountCharakterbogen(options: BogenEmbedOptions): Promise<BogenEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });
  let sprache: Sprache = options.language === 'de' ? 'de' : 'en';

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };
  const fensterVon = (ereignis: never) =>
    BrowserWindow.fromWebContents((ereignis as { sender: WebContents }).sender);

  const lies = async (id: string): Promise<Bogen> =>
    leseBogen(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
  const schreib = async (b: Bogen): Promise<Bogen> => {
    const neu = { ...b, fassung: b.fassung + 1, geaendert: new Date().toISOString() };
    await schreibeSicher(path.join(ordner, `${neu.id}.md`), alsMarkdown(neu, sprache));
    return neu;
  };
  /*
   * Mehrere Boegen in einem Schritt aendern. Nacheinander in einer Reihe,
   * damit zwei Uebergaben kurz hintereinander nicht denselben alten Stand
   * lesen und sich gegenseitig ueberschreiben.
   */
  let reihe: Promise<unknown> = Promise.resolve();
  const inReihe = <T>(arbeit: () => Promise<T>): Promise<T> => {
    const weiter = reihe.then(arbeit, arbeit);
    reihe = weiter.catch(() => undefined);
    return weiter;
  };

  /*
   * Boegen im Raum. Die Oberflaeche bekommt jeden neuen Stand geschickt; wohin,
   * weiss die Leitung erst, wenn die Huelle oder die Oberflaeche sich meldet.
   */
  let oberflaeche: WebContents | null = null;
  const leitung = new Liveleitung({
    sende: (inhalt, an) => options.raum?.sende(inhalt, an) ?? false,
    melde: (zustand: LiveZustand) => {
      if (oberflaeche && !oberflaeche.isDestroyed()) oberflaeche.send(kanal('live'), zustand);
    },
    speichereEigenen: (b) =>
      inReihe(async () => {
        // Nur, was es hier schon gibt: ein fremder Bogen landet nie still auf der Platte.
        const datei = path.join(ordner, `${zuId(b.id)}.md`);
        try {
          await readFile(datei, 'utf8');
        } catch {
          return;
        }
        await schreibeSicher(datei, alsMarkdown(bereinige(b, zuId(b.id)), sprache));
      }),
    lies: async (id) => {
      try {
        return await lies(id);
      } catch {
        return null;
      }
    },
    merkeGruppe: (id) => options.raum?.merkeGruppe?.(id),
    sprache: () => sprache
  });
  if (options.raum) leitung.setzeLage(options.raum.lage());
  const merkeOberflaeche = (ereignis: never) => {
    oberflaeche = (ereignis as { sender: WebContents }).sender;
  };
  handle('live:zustand', (ereignis: never) => {
    merkeOberflaeche(ereignis);
    return leitung.zustand();
  });
  handle('live:anfrage', (ereignis: never, a: Anfrage) => {
    merkeOberflaeche(ereignis);
    return leitung.anfrage(a);
  });
  /** Einen eigenen Bogen in den Raum bringen: gelesen wird hier, nicht in der Oberflaeche. */
  handle('live:bringe', async (ereignis: never, id: string) => {
    merkeOberflaeche(ereignis);
    try {
      return leitung.anfrage({ art: 'bringe', bogen: await lies(id) });
    } catch {
      return false;
    }
  });

  /** Ein Wurf vom Bogen in den Raum. „sl" geht an jede SL; wer selbst die einzige ist, behaelt ihn. */
  handle('wurf', (_e: never, text: string, ziel: 'alle' | 'sl') => {
    const raum = options.raum;
    const lage = raum?.lage();
    if (!raum?.chatte || !lage || lage.rolle === 'aus' || !lage.ich) return 'aus';
    const zeile = String(text).slice(0, 400);
    if (ziel !== 'sl') return raum.chatte(zeile, null) ? 'ok' : 'fehler';
    const sl = lage.personen.filter((p) => p.sl).map((p) => p.id);
    const an = (sl.length ? sl : [GASTGEBER]).filter((id) => id !== lage.ich!.id);
    if (an.length === 0) return 'selbst';
    return an.map((id) => raum.chatte!(zeile, id)).every(Boolean) ? 'ok' : 'fehler';
  });

  handle('liste', async (): Promise<Kachel[]> => (await leseAlle(ordner)).map(alsKachel));

  handle('lesen', async (_e: never, id: string): Promise<Bogen | null> => {
    try {
      return leseBogen(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
    } catch {
      return null;
    }
  });

  /*
   * Neu: freie Kennung aus dem Namen. Bestehend: die alte Kennung, auch wenn
   * der Name sich geaendert hat — sonst wuerde jede Umbenennung eine Kopie.
   */
  handle(
    'speichern',
    async (_e: never, roh: Bogen, neu: boolean): Promise<{ ok: boolean; bogen: Bogen | null; text: string }> => inReihe(async () => {
      try {
        const id = neu ? freieKennung(zuId(roh.name), (await leseAlle(ordner)).map((b) => b.id)) : zuId(roh.id);
        const bogen: Bogen = {
          ...bereinige(roh, id),
          fassung: (Number(roh.fassung) || 0) + 1,
          geaendert: new Date().toISOString()
        };
        await schreibeSicher(path.join(ordner, `${id}.md`), alsMarkdown(bogen, sprache));
        return { ok: true, bogen, text: '' };
      } catch (fehler) {
        return { ok: false, bogen: null, text: String(fehler instanceof Error ? fehler.message : fehler) };
      }
    })
  );

  /** Gegenstand oder Geld von einem Bogen zum anderen. */
  handle(
    'uebergib',
    async (_e: never, vonId: string, nachId: string, was: Uebergabe): Promise<{ ok: boolean; boegen: Bogen[]; text: string }> =>
      inReihe(async () => {
        try {
          const ergebnis = uebergib(await lies(vonId), await lies(nachId), was, sprache);
          if (!ergebnis) return { ok: false, boegen: [], text: '' };
          return { ok: true, boegen: [await schreib(ergebnis.von), await schreib(ergebnis.nach)], text: '' };
        } catch (fehler) {
          return { ok: false, boegen: [], text: String(fehler instanceof Error ? fehler.message : fehler) };
        }
      })
  );

  /** Das Geld eines Bogens gleichmaessig auf andere verteilen; der Rest bleibt. */
  handle(
    'aufteilen',
    async (_e: never, vonId: string, anIds: string[]): Promise<{ ok: boolean; boegen: Bogen[]; text: string }> =>
      inReihe(async () => {
        try {
          const ziele = [...new Set(anIds)].filter((id) => zuId(id) !== zuId(vonId));
          if (ziele.length === 0) return { ok: false, boegen: [], text: '' };
          const ergebnis = teileGeld(await lies(vonId), await Promise.all(ziele.map((id) => lies(id))), sprache);
          if (!ergebnis) return { ok: false, boegen: [], text: '' };
          const geschrieben: Bogen[] = [await schreib(ergebnis.von)];
          for (const b of ergebnis.ziele) geschrieben.push(await schreib(b));
          const text = ergebnis.text;
          return { ok: true, boegen: geschrieben, text };
        } catch (fehler) {
          return { ok: false, boegen: [], text: String(fehler instanceof Error ? fehler.message : fehler) };
        }
      })
  );

  handle('loeschen', async (_e: never, id: string): Promise<boolean> => {
    try {
      await unlink(path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

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

  handle('einlesen', async (ereignis: never): Promise<{ ok: boolean; namen: string[]; text: string }> => {
    try {
      const fenster = fensterVon(ereignis);
      const frage = {
        properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      };
      const ergebnis = fenster ? await dialog.showOpenDialog(fenster, frage) : await dialog.showOpenDialog(frage);
      if (ergebnis.canceled || ergebnis.filePaths.length === 0) return { ok: false, namen: [], text: '' };
      const vergeben = (await leseAlle(ordner)).map((b) => b.id);
      const namen: string[] = [];
      for (const datei of ergebnis.filePaths) {
        const gelesen = leseBogen(await readFile(datei, 'utf8'), 'x');
        const id = freieKennung(zuId(gelesen.name), vergeben);
        vergeben.push(id);
        const bogen = { ...gelesen, id, fassung: 0, geaendert: new Date().toISOString() };
        await schreibeSicher(path.join(ordner, `${id}.md`), alsMarkdown(bogen, sprache));
        namen.push(bogen.name);
      }
      return { ok: true, namen, text: '' };
    } catch (fehler) {
      return { ok: false, namen: [], text: String(fehler instanceof Error ? fehler.message : fehler) };
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
      // Die Oberflaeche speichert selbst, kurz nach jeder Aenderung und beim
      // Verlassen der Seite. Hier liegen nur Boegen aus dem Raum.
      await leitung.flush();
    },
    setLanguage: async (webContents, language) => {
      sprache = language === 'de' ? 'de' : 'en';
      if (!webContents.isDestroyed()) webContents.send(kanal('sprache:gesetzt'), language);
    },
    zeigeEintrag: async (webContents, kennung) => {
      if (webContents.isDestroyed()) return false;
      webContents.send(kanal('suche:zeigen'), kennung);
      return true;
    },
    raumNachricht: (webContents, von, inhalt) => {
      oberflaeche ??= webContents;
      leitung.nachricht(von, inhalt);
    },
    raumZustand: (webContents, lage) => {
      oberflaeche ??= webContents;
      leitung.setzeLage(lage);
    }
  };
}

export function unmountCharakterbogen(): void {
  for (const name of ['liste', 'lesen', 'speichern', 'loeschen', 'weitergeben', 'einlesen', 'uebergib', 'aufteilen', 'live:zustand', 'live:anfrage', 'live:bringe', 'wurf']) {
    ipcMain.removeHandler(kanal(name));
  }
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
