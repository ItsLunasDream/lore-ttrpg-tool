/**
 * Die Montage-Schnittstelle des Magic Item Creators (Konvention 7).
 *
 * Die Huelle ruft `mountMagicItems` und bekommt zurueck, was sie zum
 * Anzeigen braucht. Kein eigenstaendiger Hauptprozess: das Werkzeug laeuft
 * nur in der Huelle, wie Encounter und Nachschlagewerk.
 *
 * Abgelegt wird je Gegenstand eine Markdown-Datei unter
 * `<datenordner>/gegenstaende`. Die Sicherung der Huelle nimmt den Ordner
 * von selbst mit.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { SELTENHEIT_NAME } from '@suite/srd';
import { baueAnbieter, KiFehler, leseJsonAntwort } from '@suite/ki';
import type { KiEinstellungen } from '@suite/ki/einstellungen';
import { anweisung, systemAnweisung, uebernehmbar, type Frage } from '../shared/kiAufgaben';
import type { Sprache } from '../shared/erzeuge';
import { kanal } from '../shared/kanaele';
import { alsEintrag, alsMarkdown, freieKennung, leseGegenstand, zuId, type Eintrag } from '../shared/ablage';
import type { Gegenstand } from '../shared/erzeuge';
import { ART_NAME } from '../shared/tabellen';

/** Der Name, unter dem das Werkzeug in der Huelle und in der Suche steht. */
export const WERKZEUG = 'magicitems';
export const ORDNER_NAME = 'gegenstaende';

export interface MagicItemsEmbedOptions {
  readonly distDir: string;
  /** Der eigene Datenordner. */
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Meldet der Huelle, dass in einem anderen Werkzeug etwas dazukam (Wisch). */
  readonly onEreignis?: (appId: string) => void;
  /** Die KI der Huelle, bei jedem Aufruf frisch gelesen. */
  readonly kiQuelle?: () => { einstellungen: KiEinstellungen; schluessel: string };
}

export interface MagicItemsEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
  meldeKiWechsel(webContents: WebContents): void;
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

async function leseAlle(ordner: string): Promise<Gegenstand[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Gegenstand[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(leseGegenstand(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
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
  const alle = await leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME));
  return alle.map((g) => ({
    werkzeug: WERKZEUG,
    kennung: g.id,
    name: g.name,
    art: `${ART_NAME[g.art][sprache]} · ${SELTENHEIT_NAME[g.seltenheit][sprache]}`,
    stichworte: [ART_NAME[g.art].en, SELTENHEIT_NAME[g.seltenheit].en, g.wirkungen.join(' ').slice(0, 200)].join(' ')
  }));
}

/**
 * Alle abgelegten Gegenstaende so, wie der Charakterbogen sie ins Inventar
 * uebernimmt: Name, Art und Seltenheit als Text, Wirkungen und Fluch als
 * Beschreibung, Wert in GM. Die Huelle reicht es durch.
 */
export async function leseFuerInventar(
  datenordner: string,
  sprache: 'de' | 'en' = 'de'
): Promise<{ id: string; name: string; art: string; einstimmung: boolean; beschreibung: string; wert: number }[]> {
  const alle = await leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME));
  const de = sprache === 'de';
  return alle.map((g) => ({
    id: g.id,
    name: g.name,
    art: `${ART_NAME[g.art][sprache]}, ${SELTENHEIT_NAME[g.seltenheit][sprache]}${g.einstimmung ? (de ? ' (Einstimmung)' : ' (attunement)') : ''}`,
    einstimmung: g.einstimmung,
    beschreibung: [
      ...g.wirkungen,
      ...(g.fluch ? [`${de ? 'Fluch' : 'Curse'}: ${g.fluch}`] : []),
      ...(g.notiz ? [g.notiz] : [])
    ].join('\n\n'),
    wert: g.wert
  }));
}

/**
 * Name und Seltenheit aller abgelegten Gegenstaende. Fuer den Loot
 * Generator, dem die Huelle das durchreicht — die Werkzeuge kennen
 * einander nicht.
 */
export async function leseNamenUndSeltenheit(
  datenordner: string
): Promise<{ name: string; seltenheit: string }[]> {
  const alle = await leseAlle(path.join(datenordner, WERKZEUG, ORDNER_NAME));
  // Nur, was ausdruecklich in den Loot Generator geschickt wurde.
  return alle.filter((g) => g.imLoot).map((g) => ({ name: g.name, seltenheit: g.seltenheit }));
}

export async function mountMagicItems(options: MagicItemsEmbedOptions): Promise<MagicItemsEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };

  handle('liste', async (): Promise<Eintrag[]> => (await leseAlle(ordner)).map(alsEintrag));

  handle('lesen', async (_e: never, id: string): Promise<Gegenstand | null> => {
    try {
      return leseGegenstand(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
    } catch {
      return null;
    }
  });

  /*
   * Beim ANLEGEN eine freie Kennung, beim Bearbeiten die alte: zwei
   * Gegenstaende gleichen Namens sollen sich nicht ueberschreiben.
   */
  handle(
    'speichern',
    async (_e: never, g: Gegenstand, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
      const vergeben = neu ? (await leseAlle(ordner)).map((x) => x.id) : [];
      const id = neu ? freieKennung(zuId(g.name), vergeben) : zuId(g.id);
      try {
        await writeFile(
          path.join(ordner, `${id}.md`),
          alsMarkdown({ ...g, id, geaendert: new Date().toISOString() }),
          'utf8'
        );
        return { ok: true, id, text: '' };
      } catch (fehler) {
        return { ok: false, id, text: String(fehler instanceof Error ? fehler.message : fehler) };
      }
    }
  );

  /*
   * In den Loot Generator: das Merkmal setzen und der Huelle melden, damit
   * die Farbe ueber das Symbol des Loot Generators wischt — derselbe Weg
   * wie beim NPC Creator in den Story Creator.
   */
  handle('inDenLoot', async (_e: never, id: string): Promise<boolean> => {
    const datei = path.join(ordner, `${zuId(id)}.md`);
    try {
      const g = leseGegenstand(await readFile(datei, 'utf8'), zuId(id));
      await writeFile(datei, alsMarkdown({ ...g, imLoot: true }), 'utf8');
      options.onEreignis?.('loot');
      return true;
    } catch {
      return false;
    }
  });

  // Wieder heraus aus dem Loot Generator (Wunsch aus dem Testbericht: der Knopf blieb fuer immer „drin").
  handle('ausDemLoot', async (_e: never, id: string): Promise<boolean> => {
    const datei = path.join(ordner, `${zuId(id)}.md`);
    try {
      const g = leseGegenstand(await readFile(datei, 'utf8'), zuId(id));
      await writeFile(datei, alsMarkdown({ ...g, imLoot: false }), 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  handle('loeschen', async (_e: never, id: string): Promise<boolean> => {
    try {
      await unlink(path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

  /*
   * Eine Datei fuer Foundry wegschreiben. Derselbe kurze Handler wie im
   * Monster und Status Effect Creator — ein geteiltes Paket mit `electron`
   * darin verbietet Regel 4.
   */
  handle('foundry', async (ereignis: never, vorschlag: string, inhalt: string) => {
    try {
      const fenster = BrowserWindow.fromWebContents((ereignis as { sender: WebContents }).sender);
      const frage = { defaultPath: vorschlag, filters: [{ name: 'JSON', extensions: ['json'] }] };
      const ergebnis = fenster ? await dialog.showSaveDialog(fenster, frage) : await dialog.showSaveDialog(frage);
      if (ergebnis.canceled || !ergebnis.filePath) return { ok: false, text: '' };
      await writeFile(ergebnis.filePath, inhalt, 'utf8');
      return { ok: true, text: ergebnis.filePath };
    } catch (fehler) {
      return { ok: false, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  /* ---------- KI ---------- */

  const anbieter = () => {
    if (!options.kiQuelle) return null;
    const quelle = options.kiQuelle();
    return baueAnbieter(quelle.einstellungen, quelle.schluessel);
  };
  handle('ki:da', () => anbieter() !== null);
  handle('ki:frage', async (_e: never, frage: Frage, sprache: Sprache) => {
    const gewaehlt = anbieter();
    if (!gewaehlt) return { ok: false, wert: null, grund: 'fehler.kiKeinAnbieter' };
    try {
      const antwort = await gewaehlt.frage(
        { system: systemAnweisung(sprache), nachrichten: [{ rolle: 'user', inhalt: anweisung(frage, sprache) }] },
        () => {}
      );
      const gelesen = leseJsonAntwort(antwort);
      const wert = gelesen === null ? null : uebernehmbar(frage.aufgabe, gelesen);
      if (wert === null) return { ok: false, wert: null, grund: 'fehler.kiKeinJson' };
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
    },
    meldeKiWechsel: (webContents) => {
      if (!webContents.isDestroyed()) webContents.send(kanal('ki:gewechselt'));
    }
  };
}

/** Meldet alles ab. Fuer Tests und einen sauberen Abbau. */
export function unmountMagicItems(): void {
  for (const name of ['liste', 'lesen', 'speichern', 'inDenLoot', 'ausDemLoot', 'loeschen', 'foundry', 'ki:da', 'ki:frage']) ipcMain.removeHandler(kanal(name));
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
