/**
 * Die Montage-Schnittstelle des Homebrew Creators (Konvention 7,
 * docs/homebrew-creator.md).
 *
 * Abgelegt wird je Eintrag eine Markdown-Datei unter
 * `<datenordner>/eintraege`. Die Sicherung der Huelle nimmt den Ordner
 * von selbst mit.
 *
 * Magische Gegenstände liegen NICHT hier, sondern in der Ablage des Magic
 * Item Generators (`magieOrdner`), damit beide Werkzeuge dieselbe Sammlung
 * sehen. Ältere magische Einträge zieht `mountHomebrew` beim Start dorthin um.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag as SuchEintrag } from '@suite/eintraege';
import { kanal } from '../shared/kanaele';
import { alsKachel, alsMarkdown, freieKennung, leseEintrag, zuId, type Kachel } from '../shared/ablage';
import type { Eintrag, Magisch } from '../shared/modell';
import { alsMarkdown as magieAlsMarkdown, freieKennung as freieMagieKennung, leseGegenstand, zuId as magieZuId } from '@suite/magie/ablage';
import { alsGegenstand, ausGegenstand, istMagieKennung, magieId } from '../shared/magisch';
import { inventarEintrag, type InventarEintrag } from '../shared/inventar';
import { ART_NAME, kurzzeile, zauberEigenschaften, zauberText } from '../shared/texte';

export const WERKZEUG = 'homebrew';
export const ORDNER_NAME = 'eintraege';
/** Die Ablage des Magic Item Generators, von `<userData>` aus. */
const MAGIE_ORDNER = path.join('magicitems', 'gegenstaende');

export interface HomebrewEmbedOptions {
  readonly distDir: string;
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
  /** Meldet der Huelle, dass in einem anderen Werkzeug etwas dazukam (Wisch). */
  readonly onEreignis?: (appId: string) => void;
  /** Namen der eigenen Zustände aus dem Status Effect Creator (Auswahl bei Zaubern). */
  readonly eigeneZustaende?: () => Promise<string[]>;
  /**
   * Ordner der magischen Gegenstände (Ablage des Magic Item Generators).
   * Fehlt er, bleiben magische Gegenstände in der eigenen Ablage.
   */
  readonly magieOrdner?: string;
}

export interface HomebrewEmbed {
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

async function leseOrdner(ordner: string): Promise<Eintrag[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Eintrag[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(leseEintrag(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

/**
 * Die eigenen Einträge, für andere Werkzeuge über die Hülle (Bogen, Loot,
 * Suche). Magische Gegenstände liefert dort der Magic Item Generator; hier
 * steht höchstens ein alter, noch nicht umgezogener (dann liegt er nur hier,
 * nichts erscheint doppelt).
 */
export async function leseAlle(datenordner: string): Promise<Eintrag[]> {
  return leseOrdner(path.join(datenordner, WERKZEUG, ORDNER_NAME));
}

async function leseMagie(ordner: string): Promise<Magisch[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Magisch[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(ausGegenstand(leseGegenstand(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3))));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

/**
 * Zieht magische Einträge aus der eigenen Ablage in die des Generators um
 * (einmal, beim Start). Die alte Datei verschwindet erst, wenn die neue liegt.
 */
export async function zieheMagieUm(eigenerOrdner: string, magieOrdner: string): Promise<number> {
  const alte = (await leseOrdner(eigenerOrdner)).filter((e): e is Magisch => e.art === 'magisch');
  if (!alte.length) return 0;
  await mkdir(magieOrdner, { recursive: true });
  const vergeben = (await leseMagie(magieOrdner)).map((m) => magieId(m.id));
  let umgezogen = 0;
  for (const m of alte) {
    const id = freieMagieKennung(magieZuId(m.name || m.id), vergeben);
    vergeben.push(id);
    try {
      await writeFile(path.join(magieOrdner, `${id}.md`), magieAlsMarkdown(alsGegenstand(m, id)), 'utf8');
      await unlink(path.join(eigenerOrdner, `${zuId(m.id)}.md`));
      umgezogen += 1;
    } catch {
      // Bleibt liegen; der nächste Start versucht es wieder.
    }
  }
  return umgezogen;
}

/** Fuer die Suche der Huelle (Strg+K). */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<SuchEintrag[]> {
  const alle = await leseAlle(datenordner);
  return alle.map((e) => ({
    werkzeug: WERKZEUG,
    kennung: e.id,
    name: e.name,
    art: `Homebrew · ${ART_NAME[e.art][sprache]}`,
    stichworte: ['Homebrew', ART_NAME[e.art].de, ART_NAME[e.art].en, kurzzeile(e, 'en'), e.beschreibung.slice(0, 200)].join(' ')
  }));
}

/**
 * Alles ausser Zaubern, so wie der Charakterbogen es ins Inventar nimmt;
 * eigene Waffen mit ihren Kampfwerten. Die Huelle reicht es durch.
 */
export async function leseFuerInventar(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<InventarEintrag[]> {
  return (await leseAlle(datenordner)).flatMap((e) => {
    const x = inventarEintrag(e, sprache);
    return x ? [x] : [];
  });
}

/** Eigene Zauber fuer die Zauberliste des Charakterbogens (ueber die Huelle). */
export async function leseZauberFuerBogen(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<{ id: string; name: string; grad: number; text: string }[]> {
  return (await leseAlle(datenordner)).flatMap((e) => (e.art === 'zauber' ? [{ id: e.id, name: e.name, grad: e.grad, text: zauberText(e, sprache) }] : []));
}

/** Alle Eintraege fuer das Nachschlagewerk: Name, Kurzzeile und Text je Sprache. */
export async function leseFuerNachschlagewerk(datenordner: string): Promise<
  { id: string; name: string; unterzeile: { de: string; en: string }; absaetze: { de: string[]; en: string[] }; bild?: string }[]
> {
  const absaetze = (e: Eintrag, s: 'de' | 'en'): string[] => {
    const teile = e.beschreibung.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    if (e.art === 'zauber') teile.unshift(zauberEigenschaften(e, s));
    if (e.art === 'magisch') {
      teile.push(...e.wirkungen.filter((w) => w.trim()));
      if (e.fluch.trim()) teile.push(`${s === 'de' ? 'Fluch' : 'Curse'}: ${e.fluch.trim()}`);
    }
    if (e.art === 'zauber' && e.hoehererGrad.trim()) teile.push(`${s === 'de' ? 'Höhere Grade' : 'Higher levels'}: ${e.hoehererGrad.trim()}`);
    return teile;
  };
  // Magische Gegenstände aus der gemeinsamen Ablage stehen hier mit dabei.
  const alle: Eintrag[] = [...(await leseAlle(datenordner)), ...(await leseMagie(path.join(datenordner, MAGIE_ORDNER)))];
  return alle.map((e) => ({
    id: e.id,
    name: e.name,
    unterzeile: { de: `Homebrew · ${kurzzeile(e, 'de')}`, en: `Homebrew · ${kurzzeile(e, 'en')}` },
    absaetze: { de: absaetze(e, 'de'), en: absaetze(e, 'en') },
    ...(e.bild ? { bild: e.bild } : {})
  }));
}

/**
 * Was in den Loot Generator geschickt wurde: Name, bei magischen Gegenstaenden
 * die Seltenheit. Der Loot Generator legt daraus die Tabelle „Homebrew" an.
 */
export async function leseFuerLoot(datenordner: string): Promise<{ name: string; seltenheit: string; herkunft: 'homebrew' }[]> {
  return (await leseAlle(datenordner))
    .filter((e) => e.imLoot && e.art !== 'zauber')
    .map((e) => ({ name: e.name, seltenheit: e.art === 'magisch' ? e.seltenheit : '', herkunft: 'homebrew' as const }));
}

export async function mountHomebrew(options: HomebrewEmbedOptions): Promise<HomebrewEmbed> {
  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });
  const magie = options.magieOrdner ?? null;
  if (magie) await zieheMagieUm(ordner, magie).catch(() => 0);
  const magieDatei = (id: string) => path.join(magie ?? ordner, `${magieZuId(magieId(id))}.md`);

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };

  handle('zustaende', async (): Promise<string[]> => {
    try {
      return (await options.eigeneZustaende?.()) ?? [];
    } catch {
      return [];
    }
  });
  handle('liste', async (): Promise<Kachel[]> => [...(await leseOrdner(ordner)), ...(magie ? await leseMagie(magie) : [])].map(alsKachel));

  handle('lesen', async (_e: never, id: string): Promise<Eintrag | null> => {
    try {
      if (magie && istMagieKennung(id)) return ausGegenstand(leseGegenstand(await readFile(magieDatei(id), 'utf8'), magieZuId(magieId(id))));
      return leseEintrag(await readFile(path.join(ordner, `${zuId(id)}.md`), 'utf8'), zuId(id));
    } catch {
      return null;
    }
  });

  // Magisch: in die Ablage des Generators, durch dessen Einlesen geprüft.
  const speichereMagie = async (roh: Eintrag, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
    const geprueft = leseEintrag(alsMarkdown({ ...roh, id: 'x', geaendert: new Date().toISOString() }), 'x');
    if (geprueft.art !== 'magisch' || !magie) return { ok: false, id: '', text: 'art' };
    const vergeben = neu ? (await leseMagie(magie)).map((m) => magieId(m.id)) : [];
    const id = neu || !istMagieKennung(roh.id) ? freieMagieKennung(magieZuId(roh.name), vergeben) : magieZuId(magieId(roh.id));
    try {
      await mkdir(magie, { recursive: true });
      const g = leseGegenstand(magieAlsMarkdown(alsGegenstand(geprueft, id)), id);
      await writeFile(path.join(magie, `${id}.md`), magieAlsMarkdown(g), 'utf8');
      return { ok: true, id: `@${id}`, text: '' };
    } catch (fehler) {
      return { ok: false, id: `@${id}`, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  };

  // Beim ANLEGEN eine freie Kennung, beim Bearbeiten die alte.
  handle('speichern', async (_e: never, roh: Eintrag, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
    if (magie && roh.art === 'magisch') return speichereMagie(roh, neu);
    const vergeben = neu ? (await leseOrdner(ordner)).map((x) => x.id) : [];
    const id = neu ? freieKennung(zuId(roh.name), vergeben) : zuId(roh.id);
    try {
      // Durch das Einlesen geschickt: was die Oberflaeche schickt, wird
      // genauso geprueft wie eine Datei von der Platte.
      const sauber = leseEintrag(alsMarkdown({ ...roh, id, geaendert: new Date().toISOString() }), id);
      await writeFile(path.join(ordner, `${id}.md`), alsMarkdown(sauber), 'utf8');
      return { ok: true, id, text: '' };
    } catch (fehler) {
      return { ok: false, id, text: String(fehler instanceof Error ? fehler.message : fehler) };
    }
  });

  const setzeLoot = async (id: string, drin: boolean): Promise<boolean> => {
    if (magie && istMagieKennung(id)) {
      try {
        const g = leseGegenstand(await readFile(magieDatei(id), 'utf8'), magieZuId(magieId(id)));
        await writeFile(magieDatei(id), magieAlsMarkdown({ ...g, imLoot: drin }), 'utf8');
        if (drin) options.onEreignis?.('loot');
        return true;
      } catch {
        return false;
      }
    }
    const datei = path.join(ordner, `${zuId(id)}.md`);
    try {
      const e = leseEintrag(await readFile(datei, 'utf8'), zuId(id));
      await writeFile(datei, alsMarkdown({ ...e, imLoot: drin }), 'utf8');
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
      await unlink(magie && istMagieKennung(id) ? magieDatei(id) : path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

  // Eine Datei fuer Foundry wegschreiben (wie im Magic Item Generator).
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

export function unmountHomebrew(): void {
  for (const name of ['liste', 'lesen', 'speichern', 'inDenLoot', 'ausDemLoot', 'loeschen', 'foundry', 'zustaende']) ipcMain.removeHandler(kanal(name));
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
