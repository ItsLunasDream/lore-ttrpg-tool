/**
 * Die Montage-Schnittstelle des Nachschlagewerks (Konvention 7).
 *
 * Die Huelle ruft `mountNachschlagewerk` und bekommt zurueck, was sie zum
 * Anzeigen braucht. Kein eigenstaendiger Hauptprozess, aus demselben Grund
 * wie beim Encounter Creator: das Werkzeug laeuft nur in der Huelle.
 *
 * Der offizielle Bestand steht fest und kommt aus `@suite/srd`. Geschrieben
 * wird nur eines: die Hausregeln, als Markdown-Dateien unter
 * `<datenordner>/hausregeln`. Damit gehoert das Werkzeug in die Sicherung,
 * und die nimmt den Ordner von selbst mit.
 */
import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import type { Eintrag } from '@suite/eintraege';
import type { Teilnehmer } from '@suite/austausch';
import { ART_NAME, alleRegeln, regelNach } from '../shared/bestand';
import { kanal } from '../shared/kanaele';
import {
  alsMarkdown,
  freieKennung,
  leseHausregel,
  zuId,
  type Hausregel
} from '../shared/hausregeln';
import { leseNotizen, type Notiz } from '../shared/notizen';

/**
 * Die Notizen am Text, alle in einer Datei. Es sind Randbemerkungen, keine
 * Dokumente: eine Datei je Notiz waere ein Ordner voller Schnipsel.
 */
export const NOTIZDATEI = 'notizen.json';

/** Der Ordner der Hausregeln im Datenordner des Werkzeugs. */
export const ORDNER_NAME = 'hausregeln';

async function leseHausregeln(ordner: string): Promise<Hausregel[]> {
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: Hausregel[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      heraus.push(leseHausregel(await readFile(path.join(ordner, datei), 'utf8'), datei.slice(0, -3)));
    } catch {
      // Eine unlesbare Datei kippt die Liste nicht.
    }
  }
  return heraus;
}

/** Der Name, unter dem das Werkzeug in der Huelle und in der Suche steht. */
export const WERKZEUG = 'nachschlagewerk';

/**
 * Das Nachschlagewerk im Austausch (docs/austausch.md, „Regeln sind auch
 * Eintraege"):
 *
 * - Eine **Hausregel** reist ganz, als ihre Markdown-Datei. Daneben gelegt
 *   bekommt sie eine freie Kennung; ihr Name bleibt.
 * - Eine **offizielle Regel** reist nicht, sie wird genannt: jede Sammlung
 *   hat denselben Bestand. Angenommen wird dabei nichts geschrieben; die
 *   Huelle kann die Stelle oeffnen.
 * - Die **Notizen am Text** reisen gar nicht. Sie sind fuer einen selbst.
 */
export const austausch: Teilnehmer = {
  werkzeug: WERKZEUG,
  async gib(datenordner, kennung) {
    if (kennung.startsWith('hausregel/')) {
      const id = zuId(kennung.slice('hausregel/'.length));
      try {
        const inhalt = await readFile(path.join(datenordner, WERKZEUG, ORDNER_NAME, `${id}.md`), 'utf8');
        const regel = leseHausregel(inhalt, id);
        return { werkzeug: WERKZEUG, kennung: `hausregel/${id}`, name: regel.name, art: 'Hausregel', inhalt, bilder: [] };
      } catch {
        return null;
      }
    }
    const regel = regelNach(kennung);
    if (!regel) return null;
    return {
      werkzeug: WERKZEUG,
      kennung,
      name: regel.name.en,
      art: ART_NAME[regel.art].en,
      inhalt: null,
      bilder: []
    };
  },
  async gibtEs(datenordner, sendung) {
    // Ein Verweis auf den offiziellen Bestand gibt es immer — er wird aber
    // auch nie geschrieben, also gibt es nichts zu fragen.
    if (!sendung.kennung.startsWith('hausregel/')) return false;
    const id = zuId(sendung.kennung.slice('hausregel/'.length));
    return (await leseHausregeln(path.join(datenordner, WERKZEUG, ORDNER_NAME))).some((r) => r.id === id);
  },
  async nimmAn(datenordner, sendung, modus) {
    if (modus === 'verwerfen') return { ok: true };
    if (!sendung.kennung.startsWith('hausregel/')) {
      return regelNach(sendung.kennung)
        ? { ok: true, kennung: sendung.kennung }
        : { ok: false, grund: 'unbekannte Regel' };
    }
    if (sendung.inhalt === null) return { ok: false, grund: 'kein Inhalt' };
    const ordner = path.join(datenordner, WERKZEUG, ORDNER_NAME);
    await mkdir(ordner, { recursive: true });
    const wunsch = zuId(sendung.kennung.slice('hausregel/'.length));
    const vorhanden = (await leseHausregeln(ordner)).map((r) => r.id);
    const id = modus === 'daneben' ? freieKennung(wunsch, vorhanden) : wunsch;
    await writeFile(path.join(ordner, `${id}.md`), sendung.inhalt, 'utf8');
    return { ok: true, kennung: `hausregel/${id}` };
  }
};

export interface NachschlagewerkEmbedOptions {
  readonly distDir: string;
  /** Der eigene Datenordner; darin liegen die Hausregeln. */
  readonly datenordner: string;
  readonly devServerUrl?: string;
  readonly language?: string;
  readonly onLanguageChange?: (language: string) => void;
}

export interface NachschlagewerkEmbed {
  readonly preloadPath: string;
  readonly indexFile: string | null;
  readonly devServerUrl: string | null;
  readonly csp: string;
  flush(): Promise<void>;
  setLanguage(webContents: WebContents, language: string): Promise<void>;
  /** Zeigt einen Eintrag, den die Suche der Huelle gefunden hat. */
  zeigeEintrag(webContents: WebContents, kennung: string): Promise<boolean>;
}

/**
 * Die Content-Security-Policy.
 *
 * `style-src` braucht 'unsafe-inline', weil React Stile ueber
 * `style`-Attribute setzt. Kein `unsafe-eval`, kein `connect-src` nach
 * draussen: ein Nachschlagewerk, das offline sein soll, redet mit niemandem.
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

/**
 * Der offizielle Bestand, fuer die Suche der Huelle (Strg+K).
 *
 * DAS IST DER EIGENTLICHE GEWINN DIESES WERKZEUGS. Bisher fand die Suche
 * nur Selbstgebautes; ab hier findet „poisoned" den offiziellen Zustand UND
 * den eigenen aus dem Status Effect Creator, nebeneinander.
 *
 * Beide Sprachen als Stichworte: wer „prone" tippt, soll „Liegend" finden,
 * auch wenn die Huelle auf Deutsch steht. Die englischen Begriffe sind am
 * Tisch ohnehin im Umlauf. Der Name steht in der Sprache der Huelle — die
 * kennt dieser Leser nicht, also die deutsche als Anzeige und die englische
 * in den Stichworten; die Suche der Huelle gewichtet den Namen hoeher.
 *
 * `datenordner` wird nicht gebraucht und steht trotzdem in der Unterschrift:
 * alle Leser haben dieselbe, und die Huelle ruft sie gleich auf.
 */
export async function leseEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<Eintrag[]> {
  // Die Huelle gibt ihren Datenordner; darin hat jedes Werkzeug seinen.
  const hausregeln = await leseHausregeln(path.join(datenordner, WERKZEUG, ORDNER_NAME));
  const eigene: Eintrag[] = hausregeln.map((regel) => ({
    werkzeug: WERKZEUG,
    kennung: `hausregel/${regel.id}`,
    name: regel.name,
    art: sprache === 'de' ? 'Hausregel' : 'House rule',
    stichworte: `House rule ${regel.text.slice(0, 200)}`
  }));
  // Die Notizen an Textstellen: gefunden ueber ihren Text, geoeffnet wird
  // der Eintrag, an dem sie haengen.
  let notizen: Notiz[] = [];
  try {
    notizen = leseNotizen(await readFile(path.join(datenordner, WERKZEUG, NOTIZDATEI), 'utf8'));
  } catch {
    // Noch keine Notizen.
  }
  const notizEintraege: Eintrag[] = notizen.map((notiz) => {
    const regel = alleRegeln().find((r) => r.id === notiz.regel);
    return {
      werkzeug: WERKZEUG,
      kennung: `notiz/${notiz.id}`,
      name: notiz.text.split('\n')[0].slice(0, 80) || notiz.stelle.slice(0, 80),
      art: regel ? `Notiz · ${regel.name[notiz.sprache]}` : 'Notiz',
      stichworte: ['Note', notiz.stelle, notiz.text.slice(0, 300), regel?.name.en ?? ''].join(' ')
    };
  });
  // Die Ansicht „Gestalten" (docs/tiergestalt.md) als ein Treffer.
  const gestalten: Eintrag = {
    werkzeug: WERKZEUG,
    kennung: 'gestalten?vorgabe=tiergestalt',
    name: sprache === 'de' ? 'Tiergestalten' : 'Beast forms',
    art: sprache === 'de' ? 'Gestalten' : 'Forms',
    stichworte: 'Tiergestalt Wild Shape Gestalten Beast forms Druide Druid Vertrauter Familiar Verwandlung Polymorph Animal Shapes SRD'
  };
  return [gestalten, ...eigene, ...notizEintraege, ...alleRegeln().map((regel) => ({
    werkzeug: WERKZEUG,
    kennung: regel.id,
    // Name und Art in der Sprache der Sammlung; der andere Name bleibt als
    // Suchwort, damit „Prone" auch auf Deutsch findet und umgekehrt.
    name: regel.name[sprache],
    art: ART_NAME[regel.art][sprache],
    stichworte: [regel.name[sprache === 'de' ? 'en' : 'de'], ART_NAME[regel.art][sprache === 'de' ? 'en' : 'de'], 'SRD'].join(' ')
  }))];
}

export async function mountNachschlagewerk(
  options: NachschlagewerkEmbedOptions
): Promise<NachschlagewerkEmbed> {
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
  ipcMain.on(kanal('sprache:gewechselt'), (_event, language: string) => {
    options.onLanguageChange?.(language);
  });

  const ordner = path.join(options.datenordner, ORDNER_NAME);
  await mkdir(ordner, { recursive: true });

  const handle = (name: string, hoerer: (...a: never[]) => unknown) => {
    ipcMain.removeHandler(kanal(name));
    ipcMain.handle(kanal(name), hoerer as never);
  };

  handle('hausregeln:liste', async (): Promise<Hausregel[]> => leseHausregeln(ordner));

  /*
   * Beim ANLEGEN eine freie Kennung, beim Bearbeiten die alte: zwei
   * Hausregeln „Kritische Treffer" sollen sich nicht ueberschreiben, und
   * eine umbenannte soll keine Kopie hinterlassen.
   */
  handle(
    'hausregeln:speichern',
    async (_e: never, regel: Hausregel, neu: boolean): Promise<{ ok: boolean; id: string; text: string }> => {
      const vergeben = neu ? (await leseHausregeln(ordner)).map((r) => r.id) : [];
      const id = neu ? freieKennung(zuId(regel.name), vergeben) : zuId(regel.id);
      try {
        await writeFile(
          path.join(ordner, `${id}.md`),
          alsMarkdown({ ...regel, id, geaendert: new Date().toISOString() }),
          'utf8'
        );
        return { ok: true, id, text: '' };
      } catch (fehler) {
        return { ok: false, id, text: String(fehler instanceof Error ? fehler.message : fehler) };
      }
    }
  );

  const notizdatei = path.join(options.datenordner, NOTIZDATEI);
  handle('notizen:liste', async (): Promise<Notiz[]> => {
    try {
      return leseNotizen(await readFile(notizdatei, 'utf8'));
    } catch {
      return [];
    }
  });
  // Geschrieben wird immer die ganze Liste: sie ist klein, und so kann
  // keine Notiz zwischen zwei Teilschreibvorgaengen verloren gehen.
  handle('notizen:schreiben', async (_e: never, notizen: Notiz[]): Promise<boolean> => {
    try {
      await writeFile(notizdatei, `${JSON.stringify(leseNotizen(JSON.stringify(notizen)), null, 1)}\n`, 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  handle('hausregeln:loeschen', async (_e: never, id: string): Promise<boolean> => {
    try {
      await unlink(path.join(ordner, `${zuId(id)}.md`));
      return true;
    } catch {
      return false;
    }
  });

  return {
    preloadPath: path.join(options.distDir, 'preload.js'),
    indexFile: options.devServerUrl
      ? null
      : path.join(options.distDir, '..', 'renderer', 'index.html'),
    devServerUrl: options.devServerUrl ?? null,
    csp: CSP,
    flush: async () => {
      // Nichts zu sichern: der Bestand steht fest. Die Zusage steht trotzdem
      // in der Schnittstelle, damit die Huelle alle Werkzeuge gleich
      // behandeln kann — und die Hausregeln sie spaeter brauchen.
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
export function unmountNachschlagewerk(): void {
  for (const name of [
    'hausregeln:liste',
    'hausregeln:speichern',
    'hausregeln:loeschen',
    'notizen:liste',
    'notizen:schreiben'
  ]) {
    ipcMain.removeHandler(kanal(name));
  }
  ipcMain.removeAllListeners(kanal('sprache:gewechselt'));
}
