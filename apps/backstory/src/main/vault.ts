import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter';
import { hasLinkReservedChars, rewriteWikiLinks } from '../shared/wikilinks';
import { DEFAULT_NOTE_TYPES, isKnownNoteType, toKey, vorlageNotiztypen } from '../shared/noteTypes';
import { defaultPrompts } from '../shared/writingPrompts';
import type { PromptCategory } from '../shared/writingPrompts';
import { SCHEMA_VERSION, istRechtschreibwahl } from '../shared/types';
import type {
  AppSettings,
  Campaign,
  FieldDef,
  Note,
  NoteType,
  NoteTypeDef,
  NoteVersion,
  GraphPosition,
  OrphanedAsset,
  Relation,
  UnreadableNote
} from '../shared/types';
import { DEFAULT_LANGUAGE, isLanguage } from '../shared/i18n';
import { begrenzeZoom, ZOOM_NORMAL } from '../shared/zoom';
import { leseArchiv, schreibeArchiv, type EingelesenesArchiv } from './einlesen';
import type { Language } from '../shared/i18n';
import type { MessageKey, MessageParams } from '../shared/i18n';

const CAMPAIGNS_DIR = 'campaigns';
const NOTES_DIR = 'notes';
const ASSETS_DIR = 'assets';
const CAMPAIGN_FILE = 'campaign.json';
const HISTORY_DIR = 'history';
/** Geloeschte Notizen, damit sich das Loeschen rueckgaengig machen laesst. Liegt neben campaigns/. */
const TRASH_DIR = 'trash';
/** So viele geloeschte Notizen je Kampagne bleiben liegen; die aeltesten gehen zuerst. */
const TRASH_KEEP = 20;
/**
 * Die Vorschlagsdatei — eine je Sprache.
 *
 * Frueher gab es nur eine, und sie wurde beim ersten Start in der damals
 * eingestellten Sprache geschrieben. Danach wurde sie gelesen, gleich welche
 * Sprache gerade galt: wer sie auf Deutsch angelegt hatte, bekam auch mit
 * englischer Oberflaeche deutsche Vorschlaege. Die Tabelle war zweisprachig,
 * die Datei nicht.
 *
 * Je Sprache eine Datei, weil sie Nutzerdatei ist: wer eigene Vorschlaege
 * ergaenzt, tut das in der Sprache, in der er schreibt, und eine
 * automatische Uebersetzung gaebe es dafuer ohnehin nicht.
 */
const PROMPTS_FILE = 'writing-prompts.json';

function promptsDatei(language: Language): string {
  return `writing-prompts.${language}.json`;
}

/**
 * Ob an einer Vorschlagsliste ueberhaupt etwas geaendert wurde.
 *
 * Verglichen wird gegen beide mitgelieferten Vorlagen. Stimmt sie mit einer
 * ueberein, steckt keine Arbeit darin, die es zu retten gaebe.
 */
function istBearbeitet(liste: PromptCategory[]): boolean {
  // Die alte Datei kannte weder `types` noch die Kategorien fuer Orte,
  // Fraktionen und Ereignisse. Verglichen wird daher mit der Vorlage von damals.
  const kern = (k: PromptCategory) => ({ id: k.id, label: k.label, options: k.options });
  const damals = (sprache: Language) =>
    defaultPrompts(sprache)
      .filter((k) => !k.types || k.types.includes('character'))
      .map(kern);
  const heute = (sprache: Language) => defaultPrompts(sprache).map(kern);
  const ohneTypen = JSON.stringify(liste.map(kern));
  const vorlagen = [damals('de'), damals('en'), heute('de'), heute('en')];
  return !vorlagen.some((vorlage) => JSON.stringify(vorlage) === ohneTypen);
}

/**
 * Ergaenzt eine Liste von vor der Typ-Zuordnung um die Kategorien fuer andere
 * Notiztypen. Nur einmal: danach traegt die Datei `types`, und was man dort
 * loescht, bleibt geloescht.
 */
function ergaenzeTypKategorien(liste: PromptCategory[], sprache: Language): PromptCategory[] | null {
  if (liste.some((k) => k.types)) return null;
  const vorhanden = new Set(liste.map((k) => k.id));
  const vorlage = defaultPrompts(sprache);
  const typen = new Map(vorlage.map((k) => [k.id, k.types]));
  const neu = vorlage.filter((k) => k.types && !k.types.includes('character') && !vorhanden.has(k.id));
  // Die mitgelieferten Figuren-Kategorien bekommen ihren Typ nachgetragen.
  return [...liste.map((k) => (typen.get(k.id) ? { ...k, types: typen.get(k.id) } : k)), ...neu];
}

/**
 * Mindestabstand zwischen zwei Versionen derselben Notiz. Ohne diese Sperre
 * wuerde der Autosave im Sekundentakt hunderte fast gleicher Staende anlegen.
 * Innerhalb des Fensters bleibt der aelteste Stand erhalten, man kommt also
 * verlaesslich zwei, vier, sechs Minuten zurueck. Frueher waren es fuenf:
 * wer nach vier Minuten Arbeit etwas zurueckholen wollte, fand nur den
 * leeren Anfangsstand (Testbericht). Bei 50 Fassungen reicht das fuer gut
 * anderthalb Stunden ununterbrochenes Schreiben.
 */
const HISTORY_MIN_INTERVAL_MS = 2 * 60 * 1000;

export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'];
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
/** Nur Dateinamen ohne Pfadanteile, damit nichts aus assets/ ausbrechen kann. */
const SAFE_ASSET_NAME = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

/**
 * Fehler mit uebersetzbarem Text. Der Hauptprozess kennt die eingestellte
 * Sprache nicht an jeder Stelle, deshalb wird nur der Schluessel geworfen und
 * erst in der IPC-Schicht uebersetzt.
 */
export class VaultError extends Error {
  constructor(readonly key: MessageKey, readonly params?: MessageParams) {
    super(key);
    this.name = 'VaultError';
  }
}

export interface HistoryOptions {
  enabled: boolean;
  maxVersions: number;
}

/**
 * Ablage auf der Platte:
 *
 *   <vaultRoot>/
 *     campaigns/
 *       <campaignId>/
 *         campaign.json
 *         notes/<noteId>.md            Frontmatter + Markdown-Rumpf
 *         assets/                      Bilder der Kampagne
 *         history/<noteId>/<zeit>.md   Frühere Staende der Notiz
 *
 * Jede Kampagne ist ein echter Container: Notizen gehoeren zu genau einer
 * Kampagne und sind nur innerhalb dieser verlinkbar.
 */
export class Vault {
  private history: HistoryOptions = { enabled: true, maxVersions: 50 };

  constructor(private root: string) {}

  setHistoryOptions(options: HistoryOptions): void {
    this.history = { enabled: options.enabled, maxVersions: Math.max(1, Math.min(500, options.maxVersions)) };
  }

  get vaultRoot(): string {
    return this.root;
  }

  setRoot(root: string): void {
    this.root = root;
  }

  private campaignDir(campaignId: string): string {
    assertSafeId(campaignId);
    return path.join(this.root, CAMPAIGNS_DIR, campaignId);
  }

  /**
   * Verzeichnis der Bilder einer Kampagne. Bilder werden hineinkopiert, damit
   * die Kampagne vollstaendig bleibt und sich als ZIP sichern laesst.
   */
  assetsDir(campaignId: string): string {
    return path.join(this.campaignDir(campaignId), ASSETS_DIR);
  }

  /** Vollstaendiger Pfad einer Bilddatei, mit Pruefung des Dateinamens. */
  assetFile(campaignId: string, fileName: string): string {
    if (!SAFE_ASSET_NAME.test(fileName)) throw new VaultError('error.invalidAsset', { name: fileName });
    return path.join(this.assetsDir(campaignId), fileName);
  }

  /**
   * Legt ein Bild in der Kampagne ab und liefert den relativen Verweis, so
   * wie er im Markdown steht. Der Dateiname wird neu vergeben, damit zwei
   * gleichnamige Bilder sich nicht gegenseitig ueberschreiben.
   */
  async saveAsset(campaignId: string, originalName: string, data: Uint8Array): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
      throw new VaultError('error.unsupportedImage', { extension: extension || originalName });
    }
    if (data.byteLength > MAX_ASSET_BYTES) {
      throw new VaultError('error.imageTooLarge', { limit: Math.round(MAX_ASSET_BYTES / 1024 / 1024) });
    }

    const dir = this.assetsDir(campaignId);
    await fs.mkdir(dir, { recursive: true });

    const fileName = `${randomUUID()}${extension}`;
    await writeAtomic(path.join(dir, fileName), Buffer.from(data));
    return `${ASSETS_DIR}/${fileName}`;
  }

  /**
   * Bilddateien, auf die keine Notiz mehr verweist.
   *
   * Der Versionsverlauf wird mitgelesen: eine alte Fassung darf nicht auf ein
   * geloeschtes Bild zeigen, sonst zerreisst das Wiederherstellen. Wer
   * aggressiver aufraeumen will, schaltet den Verlauf ab.
   */
  async listOrphanedAssets(campaignId: string): Promise<OrphanedAsset[]> {
    const dir = this.assetsDir(campaignId);

    let files: string[];
    try {
      files = (await fs.readdir(dir, { withFileTypes: true }))
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
    if (files.length === 0) return [];

    const used = new Set<string>();
    for (const note of await this.listNotes(campaignId)) {
      for (const reference of collectAssetReferences(note.fields, note.body)) used.add(reference);
    }
    for (const reference of await this.assetsUsedInHistory(campaignId)) used.add(reference);
    // Bilder geloeschter Notizen im Papierkorb behalten, sonst fehlen sie nach dem Wiederherstellen.
    try {
      for (const eintrag of await fs.readdir(this.trashDir(campaignId))) {
        try {
          const { data, body } = parseFrontmatter(await fs.readFile(path.join(this.trashDir(campaignId), eintrag, 'note.md'), 'utf8'));
          for (const reference of collectAssetReferences(asStringRecord(data.fields), body)) used.add(reference);
        } catch {
          // Unvollstaendiger Eintrag, uebergehen.
        }
      }
    } catch {
      // Kein Papierkorb.
    }

    const orphans: OrphanedAsset[] = [];
    for (const name of files) {
      if (used.has(name)) continue;
      try {
        orphans.push({ name, bytes: (await fs.stat(path.join(dir, name))).size });
      } catch {
        // Datei ist zwischenzeitlich verschwunden, dann gibt es nichts zu tun.
      }
    }
    return orphans.sort((a, b) => b.bytes - a.bytes);
  }

  /** Bildverweise aus allen gesicherten Fassungen aller Notizen. */
  private async assetsUsedInHistory(campaignId: string): Promise<Set<string>> {
    const used = new Set<string>();
    const root = path.join(this.campaignDir(campaignId), HISTORY_DIR);

    let noteDirs: string[];
    try {
      noteDirs = (await fs.readdir(root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return used;
    }

    for (const noteId of noteDirs) {
      for (const fileName of await this.listVersionFiles(campaignId, noteId)) {
        try {
          const raw = await fs.readFile(path.join(root, noteId, fileName), 'utf8');
          const { data, body } = parseFrontmatter(raw);
          for (const reference of collectAssetReferences(asStringRecord(data.fields), body)) used.add(reference);
        } catch {
          // Beschaedigte Fassung uebergehen, lieber ein Bild zu viel behalten.
        }
      }
    }
    return used;
  }

  /** Loescht die genannten Bilddateien. Ergibt die Anzahl geloeschter Dateien. */
  async deleteAssets(campaignId: string, names: string[]): Promise<number> {
    let removed = 0;
    for (const name of names) {
      const file = this.assetFile(campaignId, name);
      try {
        await fs.rm(file);
        removed += 1;
      } catch {
        // Bereits geloescht, das ist kein Fehler.
      }
    }
    return removed;
  }

  private noteFile(campaignId: string, noteId: string): string {
    assertSafeId(noteId);
    return path.join(this.campaignDir(campaignId), NOTES_DIR, `${noteId}.md`);
  }

  async init(): Promise<void> {
    await fs.mkdir(path.join(this.root, CAMPAIGNS_DIR), { recursive: true });
  }

  /**
   * Schreibhilfe-Listen. Beim ersten Start werden die Vorschlaege als Datei
   * angelegt und sind danach Nutzerdatei: eigene Eintraege lassen sich dort
   * ergaenzen oder die Vorlage komplett ersetzen.
   */
  async readPrompts(language: Language): Promise<PromptCategory[]> {
    const file = path.join(this.root, promptsDatei(language));
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as unknown;
      const normalized = normalizePrompts(parsed);
      if (normalized.length) {
        const ergaenzt = ergaenzeTypKategorien(normalized, language);
        if (ergaenzt) {
          await writeJson(file, ergaenzt);
          return ergaenzt;
        }
        return normalized;
      }
    } catch {
      // Datei fehlt oder ist unlesbar, unten wird weitergesucht.
    }

    /*
     * Die alte, sprachlose Datei uebernehmen, falls es sie gibt: wer eigene
     * Vorschlaege gepflegt hat, soll sie nicht verlieren.
     *
     * Aber nur dann. Eine Datei, die noch genau der Vorlage entspricht,
     * enthaelt keine Arbeit und wird verworfen — sonst landete sie in der
     * Sprache, die beim ersten Oeffnen der Schreibhilfe zufaellig eingestellt
     * war, und wer danach umschaltete, bekaeme dort die Liste der anderen
     * Sprache zu sehen. Welche Sprache in der alten Datei steht, weiss
     * niemand; darum ist Wegwerfen hier das Ehrlichere.
     *
     * Wurde sie bearbeitet, gilt sie fuer die gerade eingestellte Sprache.
     * Passt das nicht, genuegt es, die Datei zu loeschen.
     */
    const alt = path.join(this.root, PROMPTS_FILE);
    try {
      const parsed = JSON.parse(await fs.readFile(alt, 'utf8')) as unknown;
      const normalized = normalizePrompts(parsed);
      if (normalized.length && istBearbeitet(normalized)) {
        await writeJson(file, normalized);
        await fs.rm(alt, { force: true });
        return normalized;
      }
      if (normalized.length) await fs.rm(alt, { force: true });
    } catch {
      // Gab es nicht — dann eben die Vorlage.
    }

    const seeded = defaultPrompts(language);
    await writeJson(file, seeded);
    return seeded;
  }

  promptsFile(language: Language): string {
    return path.join(this.root, promptsDatei(language));
  }

  // --- Kampagnen -----------------------------------------------------------

  async listCampaigns(): Promise<Campaign[]> {
    const dir = path.join(this.root, CAMPAIGNS_DIR);
    await fs.mkdir(dir, { recursive: true });
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const campaigns: Campaign[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        campaigns.push(await this.readCampaign(entry.name));
      } catch {
        // Verzeichnis ohne gueltige campaign.json wird ignoriert statt die Liste zu sprengen.
      }
    }
    return campaigns.sort((a, b) => a.name.localeCompare(b.name, 'de-DE'));
  }

  /**
   * Liest campaign.json und ergaenzt fehlende Angaben. Kampagnen aus einer
   * Version ohne eigene Notiztypen bekommen dabei die Vorlage eingetragen
   * und einmalig zurueckgeschrieben.
   */
  private async readCampaign(campaignId: string): Promise<Campaign> {
    const file = path.join(this.campaignDir(campaignId), CAMPAIGN_FILE);
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as Partial<Campaign>;

    const migrated = !Array.isArray(parsed.noteTypes) || parsed.noteTypes.length === 0;
    const campaign: Campaign = {
      id: campaignId,
      schemaVersion: SCHEMA_VERSION,
      name: parsed.name ?? campaignId,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      noteTypes: migrated ? structuredClone(DEFAULT_NOTE_TYPES) : normalizeNoteTypes(parsed.noteTypes as NoteTypeDef[]),
      graphPositions: normalizeGraphPositions(parsed.graphPositions)
    };

    if (migrated) await writeJson(file, campaign);
    return campaign;
  }

  async getCampaign(campaignId: string): Promise<Campaign> {
    return this.readCampaign(campaignId);
  }

  /** Ersetzt die Notiztypen einer Kampagne, nach Pruefung auf Vollstaendigkeit. */
  async updateNoteTypes(campaignId: string, noteTypes: NoteTypeDef[]): Promise<Campaign> {
    return this.inOrder(campaignId, async () => {
      const campaign = await this.readCampaign(campaignId);
      const updated: Campaign = { ...campaign, noteTypes: validateNoteTypes(noteTypes) };
      await writeJson(path.join(this.campaignDir(campaignId), CAMPAIGN_FILE), updated);
      return updated;
    });
  }

  /**
   * Merkt sich die von Hand gesetzten Stellen der Knoten. Ein leeres Objekt
   * wirft sie weg, das macht "Neu anordnen".
   */
  async saveGraphPositions(campaignId: string, positions: Record<string, GraphPosition>): Promise<Campaign> {
    return this.inOrder(campaignId, async () => {
      const campaign = await this.readCampaign(campaignId);

      // Nur Stellen zu Notizen, die es noch gibt. Die Oberflaeche schickt die
      // ganze Liste; kennt sie eine geloeschte Notiz noch, brachte sie deren
      // Stelle sonst zurueck und die Liste wuechse immer weiter.
      //
      // Gelesen werden nur die Dateinamen, nicht die Notizen: das Ablegen
      // eines Knotens soll nicht die ganze Kampagne durchgehen, und eine
      // Notiz mit kaputtem Kopf gaebe es zwar zu lesen nicht, ihre Stelle
      // duerfte sie aber trotzdem behalten.
      const known = await this.noteIds(campaignId);
      const kept = Object.fromEntries(
        Object.entries(normalizeGraphPositions(positions)).filter(([noteId]) => known.has(noteId))
      );

      const updated: Campaign = { ...campaign, graphPositions: kept };
      await writeJson(path.join(this.campaignDir(campaignId), CAMPAIGN_FILE), updated);
      return updated;
    });
  }

  /**
   * Reiht Aenderungen an campaign.json hintereinander auf.
   *
   * Jede liest den Stand, ergaenzt und schreibt zurueck. Ueberlappen sich
   * zwei, lesen beide denselben Stand und die zweite schreibt die erste
   * weg: beim Ablegen mehrerer Knoten kurz nacheinander waere jedes Mal
   * eine Stelle verloren.
   */
  private inOrder<T>(campaignId: string, work: () => Promise<T>): Promise<T> {
    const queued = (this.pending.get(campaignId) ?? Promise.resolve()).then(work, work);
    // Fehler duerfen die Reihe nicht abreissen lassen, deshalb abgefangen.
    this.pending.set(campaignId, queued.then(() => undefined, () => undefined));
    return queued;
  }

  private readonly pending = new Map<string, Promise<void>>();

  /**
   * Die Notiztypen kommen in der Sprache, in der gerade gearbeitet wird. Ab
   * hier gehoeren sie der Kampagne: ein spaeterer Sprachwechsel zieht sie
   * nicht mit, er wuerde sonst eigene Beschriftungen ueberschreiben.
   */
  async createCampaign(name: string, language: Language = DEFAULT_LANGUAGE): Promise<Campaign> {
    const trimmed = name.trim();
    if (!trimmed) throw new VaultError('error.campaignName');

    const campaign: Campaign = {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      name: trimmed,
      createdAt: new Date().toISOString(),
      noteTypes: structuredClone(vorlageNotiztypen(language)),
      graphPositions: {}
    };
    const dir = this.campaignDir(campaign.id);
    await fs.mkdir(path.join(dir, NOTES_DIR), { recursive: true });
    await fs.mkdir(path.join(dir, ASSETS_DIR), { recursive: true });
    await writeJson(path.join(dir, CAMPAIGN_FILE), campaign);
    return campaign;
  }

  /**
   * Liest eine gesicherte Kampagne aus einem ZIP ein.
   *
   * Sie bekommt IMMER eine neue Kennung, auch wenn die aus dem Archiv noch
   * frei waere. Eine vorhandene Kampagne wird dadurch nie ueberschrieben —
   * das waere der Fehler, bei dem jemand Arbeit verliert und es erst Wochen
   * spaeter merkt.
   */
  async importCampaign(archivDatei: string, zusatz = 'importiert'): Promise<Campaign> {
    let inhalt: Buffer;
    try {
      inhalt = await fs.readFile(archivDatei);
    } catch {
      throw new VaultError('error.importUnreadable');
    }

    let gelesen: EingelesenesArchiv | null;
    try {
      gelesen = leseArchiv(new Uint8Array(inhalt));
    } catch {
      throw new VaultError('error.importUnreadable');
    }
    if (!gelesen) throw new VaultError('error.importNoCampaign');

    const roh = gelesen.kampagne;
    /*
     * Gibt es den Namen schon, bekommt die eingelesene einen Zusatz: sonst
     * standen zwei gleiche Namen im Kampagnenmenue, nicht zu unterscheiden
     * (Testbericht).
     */
    const grundname = String(roh.name).trim() || 'Kampagne';
    const vergeben = new Set((await this.listCampaigns()).map((k) => k.name.trim().toLowerCase()));
    let name = grundname;
    for (let n = 1; vergeben.has(name.toLowerCase()); n += 1) {
      name = n === 1 ? `${grundname} (${zusatz})` : `${grundname} (${zusatz} ${n})`;
    }
    const campaign: Campaign = {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      name,
      createdAt: typeof roh.createdAt === 'string' ? roh.createdAt : new Date().toISOString(),
      noteTypes: normalizeNoteTypes(roh.noteTypes as NoteTypeDef[]),
      graphPositions:
        roh.graphPositions && typeof roh.graphPositions === 'object'
          ? (roh.graphPositions as Campaign['graphPositions'])
          : {}
    };

    const dir = this.campaignDir(campaign.id);
    await fs.mkdir(path.join(dir, NOTES_DIR), { recursive: true });
    await fs.mkdir(path.join(dir, ASSETS_DIR), { recursive: true });
    await schreibeArchiv(dir, gelesen.dateien);
    await writeJson(path.join(dir, CAMPAIGN_FILE), campaign);
    return campaign;
  }

  async renameCampaign(campaignId: string, name: string): Promise<Campaign> {
    const trimmed = name.trim();
    if (!trimmed) throw new VaultError('error.campaignName');

    return this.inOrder(campaignId, async () => {
      const campaign = await this.readCampaign(campaignId);
      const updated: Campaign = { ...campaign, name: trimmed };
      await writeJson(path.join(this.campaignDir(campaignId), CAMPAIGN_FILE), updated);
      return updated;
    });
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    await fs.rm(this.campaignDir(campaignId), { recursive: true, force: true });
    await fs.rm(this.trashDir(campaignId), { recursive: true, force: true });
  }

  // --- Notizen -------------------------------------------------------------

  async listNotes(campaignId: string): Promise<Note[]> {
    const dir = path.join(this.campaignDir(campaignId), NOTES_DIR);
    await fs.mkdir(dir, { recursive: true });
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const notes: Note[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const noteId = entry.name.slice(0, -3);
      try {
        notes.push(await this.getNote(campaignId, noteId));
      } catch {
        // Kaputte Einzeldatei darf nicht die ganze Kampagne unlesbar machen.
      }
    }
    return notes.sort((a, b) => a.title.localeCompare(b.title, 'de-DE'));
  }

  /**
   * Die IDs aller Notizdateien, ohne sie zu lesen.
   *
   * Ein Fehler wird nicht verschluckt: hielte man ihn fuer "keine Notizen",
   * loeschte der naechste Schreibvorgang alle gemerkten Stellen. Nur ein
   * fehlender Ordner ist harmlos, den gibt es vor der ersten Notiz nicht.
   */
  private async noteIds(campaignId: string): Promise<Set<string>> {
    const dir = path.join(this.campaignDir(campaignId), NOTES_DIR);

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return new Set();
    }

    return new Set(
      entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name.slice(0, -3))
    );
  }

  /**
   * Notizdateien, die sich nicht lesen lassen, etwa weil das Frontmatter von
   * Hand kaputt bearbeitet wurde.
   *
   * `listNotes` uebergeht sie, damit eine einzelne Datei nicht die ganze
   * Kampagne unlesbar macht. Stillschweigend verschwinden duerfen sie aber
   * nicht: sonst faellt der Verlust erst auf, wenn es zu spaet ist.
   *
   * Ein Ordner, der sich nicht lesen laesst, gilt deshalb nicht als "nichts
   * kaputt". Nur ein fehlender ist harmlos.
   */
  async findUnreadableNotes(campaignId: string): Promise<UnreadableNote[]> {
    const dir = path.join(this.campaignDir(campaignId), NOTES_DIR);

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return [];
    }

    const broken: UnreadableNote[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const id = entry.name.slice(0, -3);
      try {
        await this.getNote(campaignId, id);
      } catch {
        // Der Dateiname wird zur ID. Ist er der Grund, laesst sich das mit
        // einem Umbenennen beheben; bei kaputtem Inhalt hilft nur der
        // Texteditor. Der Unterschied gehoert in den Hinweis.
        broken.push({ name: entry.name, reason: SAFE_ID.test(id) ? 'content' : 'name' });
      }
    }
    return broken.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getNote(campaignId: string, noteId: string): Promise<Note> {
    const raw = await fs.readFile(this.noteFile(campaignId, noteId), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    return normalizeNote(noteId, data, body);
  }

  /** Die Notiz als Text, genau so, wie sie auf der Platte liegt (Austausch). */
  async rohNotiz(campaignId: string, noteId: string): Promise<string> {
    return fs.readFile(this.noteFile(campaignId, noteId), 'utf8');
  }

  /**
   * Nimmt eine Notiz aus einer anderen Sammlung an (docs/austausch.md).
   *
   * - `daneben`: gibt es die Kennung hier schon, bekommt die Notiz eine
   *   neue. Nichts wird ueberschrieben.
   * - `uebernehmen`: die vorhandene Fassung wird ersetzt.
   *
   * Ein Titel, den hier schon eine ANDERE Notiz traegt, bekommt eine Zahl
   * dahinter — sonst zeigten [[Verweise]] auf zwei Notizen. Den Notiztyp
   * legt die Kampagne an, wenn sie ihn nicht kennt, unter der Beschriftung
   * des Absenders. Bilder landen in `assets/` unter neuem Namen, der Text
   * zeigt auf sie. Beziehungen auf Notizen, die es hier nicht gibt, fallen
   * weg: sie zeigten ins Leere.
   */
  async empfangeNotiz(
    campaignId: string,
    roh: string,
    bilder: readonly { name: string; daten: Uint8Array }[],
    modus: 'uebernehmen' | 'daneben',
    typName?: string
  ): Promise<Note> {
    const { data, body } = parseFrontmatter(roh);
    const vorhandene = await this.listNotes(campaignId);
    const wunsch = typeof data.id === 'string' && data.id ? data.id : randomUUID();
    assertSafeId(wunsch);
    const gibt = vorhandene.some((n) => n.id === wunsch);
    const id = modus === 'daneben' && gibt ? randomUUID() : wunsch;
    let note = normalizeNote(id, data, body);

    const belegt = new Set(vorhandene.filter((n) => n.id !== id).map((n) => n.title.toLocaleLowerCase('de-DE')));
    if (belegt.has(note.title.toLocaleLowerCase('de-DE'))) {
      let n = 2;
      while (belegt.has(`${note.title} (${n})`.toLocaleLowerCase('de-DE'))) n += 1;
      note = { ...note, title: `${note.title} (${n})` };
    }

    const campaign = await this.readCampaign(campaignId);
    if (!isKnownNoteType(campaign.noteTypes, note.type)) {
      const name = typName?.trim() || note.type;
      await this.updateNoteTypes(campaignId, [
        ...campaign.noteTypes,
        { id: note.type, label: name, plural: name, fields: [] }
      ]);
    }

    let text = note.body;
    for (const bild of bilder) {
      const neu = await this.saveAsset(campaignId, bild.name, bild.daten);
      text = text.split(`](${bild.name})`).join(`](${neu})`);
    }
    const ids = new Set([...vorhandene.map((n) => n.id), id]);
    note = { ...note, body: text, relations: note.relations.filter((r) => ids.has(r.targetId)) };
    await this.writeNote(campaignId, note);
    return note;
  }

  async createNote(campaignId: string, type: NoteType, title: string): Promise<Note> {
    const trimmed = title.trim();
    if (!trimmed) throw new VaultError('error.noteTitle');
    assertLinkable(trimmed);

    const campaign = await this.readCampaign(campaignId);
    if (!isKnownNoteType(campaign.noteTypes, type)) {
      throw new VaultError('error.unknownNoteType', { type });
    }

    const now = new Date().toISOString();
    const note: Note = {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      type,
      title: trimmed,
      aliases: [],
      tags: [],
      fields: {},
      relations: [],
      createdAt: now,
      updatedAt: now,
      body: ''
    };
    await this.writeNote(campaignId, note);
    return note;
  }

  async saveNote(campaignId: string, note: Note): Promise<Note> {
    const trimmed = note.title.trim();
    if (!trimmed) throw new VaultError('error.noteTitle');
    assertLinkable(trimmed);
    for (const alias of note.aliases) assertLinkable(alias);

    const updated: Note = {
      ...note,
      title: trimmed,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString()
    };
    let vorher: Note | null = null;
    try {
      vorher = await this.getNote(campaignId, note.id);
    } catch {
      // Neu: es gibt noch keine Aliasse, die nachzuziehen waeren.
    }
    await this.writeNote(campaignId, updated);
    if (vorher) await this.zieheAliasVerweiseNach(campaignId, vorher, updated);
    return updated;
  }

  /**
   * Ein Alias faellt weg oder wird ersetzt: die [[Links]] darauf ziehen mit
   * (Testbericht: nur der Titel wurde nachgezogen). Ein weggefallener Alias
   * zeigt danach auf den Titel, ein ersetzter auf den neuen Alias. Wie beim
   * Umbenennen bleibt stehen, was sich eine andere Notiz mit diesem Namen
   * teilt. Die eigene Notiz bleibt unberuehrt; sie ist gerade offen.
   */
  private async zieheAliasVerweiseNach(campaignId: string, vorher: Note, nachher: Note): Promise<number> {
    const norm = (name: string) => name.trim().toLowerCase();
    const jetzt = new Set(nachher.aliases.map(norm));
    const frueher = new Set(vorher.aliases.map(norm));
    const weg = vorher.aliases.filter((alias) => !jetzt.has(norm(alias)));
    if (weg.length === 0) return 0;
    const neu = nachher.aliases.filter((alias) => !frueher.has(norm(alias)));
    const alle = await this.listNotes(campaignId);
    let umgeschrieben = 0;
    for (const [i, alt] of weg.entries()) {
      const ziel = neu[i] ?? nachher.title;
      const geteilt = alle.some(
        (other) =>
          other.id !== nachher.id &&
          (norm(other.title) === norm(alt) || other.aliases.some((alias) => norm(alias) === norm(alt)))
      );
      if (geteilt) continue;
      for (const other of alle) {
        if (other.id === nachher.id) continue;
        const body = rewriteWikiLinks(other.body, alt, ziel);
        if (body === other.body) continue;
        other.body = body;
        await this.writeNote(campaignId, { ...other, body, updatedAt: new Date().toISOString() });
        umgeschrieben += 1;
      }
    }
    return umgeschrieben;
  }

  /**
   * Benennt eine Notiz um und zieht alle [[Links]] in der Kampagne mit.
   * Damit bleibt der Klartext lesbar, ohne dass Umbenennen Links zerreisst.
   */
  async renameNote(campaignId: string, noteId: string, newTitle: string): Promise<{ note: Note; rewritten: number }> {
    const trimmed = newTitle.trim();
    if (!trimmed) throw new VaultError('error.noteTitle');
    assertLinkable(trimmed);

    const note = await this.getNote(campaignId, noteId);
    if (note.title === trimmed) return { note, rewritten: 0 };

    // Vor dem ersten Schreibzugriff pruefen. Scheitert es erst beim Speichern
    // am Ende, waeren die Links in anderen Notizen schon umgeschrieben, der
    // Titel aber nicht, und ein zweiter Versuch faende nichts mehr.
    for (const alias of note.aliases) assertLinkable(alias);

    /*
     * Teilt sich der alte Titel mit einer anderen Notiz, gehoeren die
     * [[Links]] darauf nicht eindeutig zu dieser. Dann bleiben sie stehen —
     * lieber ein Link, den man selbst nachzieht, als einer, der still auf
     * eine fremde Notiz umgebogen wird (Testbericht: aus [[Bo]] wurde
     * [[Borin]], obwohl es eine eigene Notiz „Bo" gab).
     */
    const alle = await this.listNotes(campaignId);
    const alterName = note.title.trim().toLowerCase();
    const geteilt = alle.some(
      (other) =>
        other.id !== noteId &&
        (other.title.trim().toLowerCase() === alterName ||
          other.aliases.some((alias) => alias.trim().toLowerCase() === alterName))
    );

    let rewritten = 0;
    let ownBody = note.body;
    if (geteilt) {
      const updated = await this.saveNote(campaignId, { ...note, title: trimmed });
      return { note: updated, rewritten: 0 };
    }

    // Erst die Verweise umschreiben, den Titel zuletzt setzen. Bricht es
    // dazwischen ab, traegt die Notiz noch den alten Titel und ein erneutes
    // Umbenennen holt den Rest nach. Andersherum waere der Zustand nicht
    // mehr zu reparieren.
    for (const other of alle) {
      const body = rewriteWikiLinks(other.body, note.title, trimmed);
      if (body === other.body) continue;

      // Verlinkt sich die Notiz selbst, wird das zusammen mit dem Titel
      // gespeichert, sonst bliebe dort der alte Name stehen.
      if (other.id === noteId) {
        ownBody = body;
        continue;
      }

      await this.writeNote(campaignId, { ...other, body, updatedAt: new Date().toISOString() });
      rewritten += 1;
    }

    const updated = await this.saveNote(campaignId, { ...note, title: trimmed, body: ownBody });
    return { note: updated, rewritten };
  }

  private trashDir(campaignId: string, noteId?: string): string {
    assertSafeId(campaignId);
    if (noteId !== undefined) assertSafeId(noteId);
    const dir = path.join(this.root, TRASH_DIR, campaignId);
    return noteId === undefined ? dir : path.join(dir, noteId);
  }

  async deleteNote(campaignId: string, noteId: string): Promise<void> {
    // Nicht gleich weg, sondern in den Papierkorb: Text, Verlauf, die
    // Beziehungen anderer Notizen auf diese und die Stelle im Graphen.
    // Damit laesst sich das Loeschen vollstaendig rueckgaengig machen.
    const ablage = this.trashDir(campaignId, noteId);
    await fs.rm(ablage, { recursive: true, force: true });
    await fs.mkdir(ablage, { recursive: true });
    let hatteDatei = true;
    try {
      await fs.copyFile(this.noteFile(campaignId, noteId), path.join(ablage, 'note.md'));
    } catch {
      hatteDatei = false;
    }
    try {
      await fs.cp(this.historyDir(campaignId, noteId), path.join(ablage, HISTORY_DIR), { recursive: true });
    } catch {
      // Kein Verlauf, nichts mitzunehmen.
    }

    await fs.rm(this.noteFile(campaignId, noteId), { force: true });
    await fs.rm(this.historyDir(campaignId, noteId), { recursive: true, force: true });

    // Beziehungen auf die geloeschte Notiz wuerden sonst ins Leere zeigen.
    const entfernt: { noteId: string; relation: Relation }[] = [];
    for (const other of await this.listNotes(campaignId)) {
      const relations = other.relations.filter((relation) => relation.targetId !== noteId);
      if (relations.length === other.relations.length) continue;
      for (const relation of other.relations) {
        if (relation.targetId === noteId) entfernt.push({ noteId: other.id, relation });
      }
      await this.writeNote(campaignId, { ...other, relations, updatedAt: new Date().toISOString() });
    }
    let position: GraphPosition | undefined;
    try {
      position = (await this.readCampaign(campaignId)).graphPositions[noteId];
    } catch {
      position = undefined;
    }
    if (hatteDatei) {
      await writeJson(path.join(ablage, 'meta.json'), { deletedAt: new Date().toISOString(), relations: entfernt, position });
      await this.raeumePapierkorb(campaignId);
    } else {
      await fs.rm(ablage, { recursive: true, force: true });
    }

    // Auch die gemerkte Stelle im Graphen raeumen, sonst waechst die Liste
    // mit jeder geloeschten Notiz weiter. Lesen und Schreiben gehoeren dabei
    // in denselben Schritt der Reihe: dazwischen koennte sonst eine gerade
    // abgelegte Stelle ankommen, die dieser Schritt wieder wegschriebe.
    await this.inOrder(campaignId, async () => {
      const campaign = await this.readCampaign(campaignId);
      if (!campaign.graphPositions[noteId]) return;

      const { [noteId]: _entfernt, ...rest } = campaign.graphPositions;
      const updated: Campaign = { ...campaign, graphPositions: rest };
      await writeJson(path.join(this.campaignDir(campaignId), CAMPAIGN_FILE), updated);
    });
  }

  /** Holt eine geloeschte Notiz aus dem Papierkorb zurueck, samt Beziehungen und Verlauf. */
  async restoreNote(campaignId: string, noteId: string): Promise<Note> {
    const ablage = this.trashDir(campaignId, noteId);
    let raw: string;
    try {
      raw = await fs.readFile(path.join(ablage, 'note.md'), 'utf8');
    } catch {
      throw new VaultError('error.restoreGone');
    }
    const ziel = this.noteFile(campaignId, noteId);
    try {
      await fs.access(ziel);
      throw new VaultError('error.restoreGone');
    } catch (error) {
      if (error instanceof VaultError) throw error;
    }
    await fs.mkdir(path.dirname(ziel), { recursive: true });
    await writeAtomic(ziel, raw);
    try {
      await fs.cp(path.join(ablage, HISTORY_DIR), this.historyDir(campaignId, noteId), { recursive: true });
    } catch {
      // Es gab keinen Verlauf.
    }

    let meta: { relations?: { noteId: string; relation: Relation }[]; position?: GraphPosition } = {};
    try {
      meta = JSON.parse(await fs.readFile(path.join(ablage, 'meta.json'), 'utf8'));
    } catch {
      meta = {};
    }
    const jeNotiz = new Map<string, Relation[]>();
    for (const eintrag of meta.relations ?? []) {
      jeNotiz.set(eintrag.noteId, [...(jeNotiz.get(eintrag.noteId) ?? []), eintrag.relation]);
    }
    for (const other of await this.listNotes(campaignId)) {
      const zurueck = jeNotiz.get(other.id);
      if (!zurueck) continue;
      const neu = zurueck.filter((relation) => !other.relations.some((r) => r.id === relation.id));
      if (!neu.length) continue;
      await this.writeNote(campaignId, { ...other, relations: [...other.relations, ...neu], updatedAt: new Date().toISOString() });
    }
    if (meta.position) {
      const position = meta.position;
      await this.inOrder(campaignId, async () => {
        const campaign = await this.readCampaign(campaignId);
        const updated: Campaign = { ...campaign, graphPositions: { ...campaign.graphPositions, [noteId]: position } };
        await writeJson(path.join(this.campaignDir(campaignId), CAMPAIGN_FILE), updated);
      });
    }
    await fs.rm(ablage, { recursive: true, force: true });
    return this.getNote(campaignId, noteId);
  }

  /** Behaelt nur die letzten TRASH_KEEP geloeschten Notizen einer Kampagne. */
  private async raeumePapierkorb(campaignId: string): Promise<void> {
    const dir = this.trashDir(campaignId);
    let namen: string[];
    try {
      namen = (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return;
    }
    if (namen.length <= TRASH_KEEP) return;
    const mitZeit = await Promise.all(
      namen.map(async (name) => ({ name, zeit: (await fs.stat(path.join(dir, name)).catch(() => null))?.mtimeMs ?? 0 }))
    );
    mitZeit.sort((a, b) => b.zeit - a.zeit);
    for (const alt of mitZeit.slice(TRASH_KEEP)) await fs.rm(path.join(dir, alt.name), { recursive: true, force: true });
  }

  private async writeNote(campaignId: string, note: Note): Promise<void> {
    const file = this.noteFile(campaignId, note.id);
    await fs.mkdir(path.dirname(file), { recursive: true });

    const { body, ...meta } = note;
    const content = stringifyFrontmatter(
      { ...meta, ...(await this.foreignKeys(file, meta)) } as unknown as Record<string, unknown>,
      body
    );

    await this.snapshot(campaignId, note.id, content);
    await writeAtomic(file, content);
  }

  /**
   * Frontmatter-Angaben, die nicht zum Datenmodell gehoeren. Die Dateien
   * sollen in Obsidian oder einem Texteditor bearbeitbar bleiben; ergaenzt
   * jemand dort eigene Schluessel, wuerde ein Speichern sie sonst
   * stillschweigend loeschen.
   */
  private async foreignKeys(file: string, known: object): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      return {};
    }

    let data: Record<string, unknown>;
    try {
      ({ data } = parseFrontmatter(raw));
    } catch {
      // Kaputtes YAML: nichts zu retten, findUnreadableNotes meldet es.
      return {};
    }

    const foreign: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!Object.hasOwn(known, key)) foreign[key] = value;
    }
    return foreign;
  }

  // --- Versionsverlauf -----------------------------------------------------

  private historyDir(campaignId: string, noteId: string): string {
    assertSafeId(noteId);
    return path.join(this.campaignDir(campaignId), HISTORY_DIR, noteId);
  }

  /**
   * Sichert den Stand, der gerade auf der Platte liegt, bevor er ueberschrieben
   * wird. Unveraenderte Speichervorgaenge und solche innerhalb des Sperrfensters
   * legen keine Version an.
   */
  private async snapshot(campaignId: string, noteId: string, nextContent: string): Promise<void> {
    if (!this.history.enabled) return;

    let current: string;
    try {
      current = await fs.readFile(this.noteFile(campaignId, noteId), 'utf8');
    } catch {
      return; // Neue Notiz, es gibt noch nichts zu sichern.
    }
    if (current === nextContent) return;

    const newest = (await this.listVersionFiles(campaignId, noteId))[0];
    if (newest && Date.now() - versionTime(newest) < HISTORY_MIN_INTERVAL_MS) return;

    await this.writeVersion(campaignId, noteId, current);
  }

  /**
   * Legt den uebergebenen Stand als Version ab und raeumt die aeltesten weg.
   * Ohne Sperrfenster: wer das braucht, prueft es vorher selbst.
   */
  private async writeVersion(campaignId: string, noteId: string, content: string): Promise<void> {
    const dir = this.historyDir(campaignId, noteId);
    const versions = await this.listVersionFiles(campaignId, noteId);

    await fs.mkdir(dir, { recursive: true });
    await writeAtomic(path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`), content);

    for (const stale of versions.slice(this.history.maxVersions - 1)) {
      await fs.rm(path.join(dir, stale), { force: true });
    }
  }

  /** Dateinamen der Versionen, neueste zuerst. */
  private async listVersionFiles(campaignId: string, noteId: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.historyDir(campaignId, noteId));
      return entries.filter((name) => name.endsWith('.md')).sort().reverse();
    } catch {
      return [];
    }
  }

  async listVersions(campaignId: string, noteId: string): Promise<NoteVersion[]> {
    const dir = this.historyDir(campaignId, noteId);
    const versions: NoteVersion[] = [];

    for (const fileName of await this.listVersionFiles(campaignId, noteId)) {
      try {
        const { data, body } = parseFrontmatter(await fs.readFile(path.join(dir, fileName), 'utf8'));
        versions.push({
          id: fileName.replace(/\.md$/, ''),
          savedAt: new Date(versionTime(fileName)).toISOString(),
          title: typeof data.title === 'string' ? data.title : '',
          body
        });
      } catch {
        // Beschaedigte Einzeldatei darf den Verlauf nicht unlesbar machen.
      }
    }
    return versions;
  }

  /**
   * Stellt eine alte Fassung wieder her. Der aktuelle Stand wandert vorher in
   * den Verlauf, das Zurueckholen ist also selbst umkehrbar.
   */
  async restoreVersion(campaignId: string, noteId: string, versionId: string): Promise<Note> {
    assertSafeId(versionId);
    const file = path.join(this.historyDir(campaignId, noteId), `${versionId}.md`);

    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch {
      throw new VaultError('error.versionMissing');
    }

    const { data, body } = parseFrontmatter(raw);
    const restored = normalizeNote(noteId, data, body);
    const current = await this.getNote(campaignId, noteId);

    // Der Stand von jetzt muss in den Verlauf, bevor er ueberschrieben wird,
    // und zwar ohne Ruecksicht auf das Sperrfenster. Sonst waere gerade das
    // Zurueckholen nicht umkehrbar, obwohl der Dialog genau das zusagt: wer
    // eine Stunde schreibt und dabei jede Minute speichert, hat innerhalb des
    // Fensters keine Version, und der ganze Text waere weg. Der Schnappschuss
    // aus writeNote greift danach nicht mehr, er sieht die frische Fassung.
    if (this.history.enabled) {
      try {
        await this.writeVersion(campaignId, noteId, await fs.readFile(this.noteFile(campaignId, noteId), 'utf8'));
      } catch {
        // Keine Datei auf der Platte, dann gibt es nichts zu sichern.
      }
    }

    // Erstellungszeit und Notiz-ID bleiben die der lebenden Notiz.
    return this.saveNote(campaignId, { ...restored, id: noteId, createdAt: current.createdAt });
  }
}

// --- Hilfsfunktionen -------------------------------------------------------

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/** Verhindert, dass eine manipulierte ID aus dem Vault-Verzeichnis ausbricht. */
function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new VaultError('error.invalidId', { id });
  }
}

/**
 * Titel und Aliase sind Linkziele. Enthalten sie [ ] oder |, laesst sich die
 * Notiz nicht mehr eindeutig verlinken, und ein Umbenennen wuerde bestehende
 * Links in der ganzen Kampagne zerreissen.
 */
function assertLinkable(name: string): void {
  if (hasLinkReservedChars(name)) {
    throw new VaultError('error.linkChars', { name });
  }
}

/**
 * Bildverweise einer Notiz, unabhaengig vom Feldtyp. Bewusst grosszuegig:
 * lieber ein Bild zu viel behalten als eines loeschen, das noch gebraucht wird.
 */
function collectAssetReferences(fields: Record<string, string>, body: string): Set<string> {
  const found = new Set<string>();

  for (const match of body.matchAll(/assets\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)/g)) found.add(match[1]);
  for (const value of Object.values(fields)) {
    const match = /^assets\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)$/.exec(value.trim());
    if (match) found.add(match[1]);
  }
  return found;
}

/** Zeitstempel aus dem Dateinamen einer Version. */
function versionTime(fileName: string): number {
  const stamp = fileName.replace(/\.md$/, '');
  const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

let writeCounter = 0;

/**
 * Fehlercodes, die unter Windows eine kurzlebige Sperre bedeuten: ein
 * Virenscanner, die Dateisuche oder eine Ordnersynchronisation hat die Datei
 * gerade offen. Nach einem Augenblick geht es wieder.
 */
const LOCKED_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

/**
 * Schreibt ueber eine Nebendatei und benennt sie um. Bricht der Vorgang
 * mittendrin ab, steht auf der Platte entweder der alte oder der neue Stand,
 * nie ein halber.
 */
async function writeAtomic(file: string, content: string | Buffer): Promise<void> {
  // Fortlaufende Nummer, nicht nur die Prozess-ID: laufen zwei Schreibvorgaenge
  // auf dieselbe Datei gleichzeitig, schrieben sie sonst beide in dieselbe
  // Nebendatei und das Ergebnis waere Bruch.
  const tmp = `${file}.tmp-${process.pid}-${writeCounter++}`;
  await fs.writeFile(tmp, content);

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, file);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code ?? '';
        if (attempt >= 4 || !LOCKED_CODES.has(code)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      }
    }
  } catch (error) {
    // Sonst bliebe die Nebendatei im Speicherort liegen und landete in der
    // ZIP-Sicherung. Der eigentliche Fehler bleibt der, der zaehlt.
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') result[key] = entry;
    else if (typeof entry === 'number') result[key] = String(entry);
  }
  return result;
}

function asRelations(value: unknown): Relation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.targetId !== 'string') return [];
    return [{
      id: typeof record.id === 'string' ? record.id : randomUUID(),
      targetId: record.targetId,
      type: typeof record.type === 'string' ? record.type : '',
      note: typeof record.note === 'string' ? record.note : ''
    }];
  });
}

/**
 * Macht aus rohem Frontmatter eine vollstaendige Notiz, auch wenn Felder
 * fehlen. Der Typ wird nicht gegen die Kampagne geprueft: ein geloeschter Typ
 * bleibt in der Datei stehen, damit nichts verloren geht.
 */
function normalizeNote(noteId: string, data: Record<string, unknown>, body: string): Note {
  const now = new Date().toISOString();
  const type = typeof data.type === 'string' && data.type.trim() ? data.type.trim() : 'note';

  return {
    id: noteId,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : SCHEMA_VERSION,
    type,
    title: noteTitle(data.title, body),
    aliases: asStringArray(data.aliases),
    tags: asStringArray(data.tags),
    fields: asStringRecord(data.fields),
    relations: asRelations(data.relations),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
    body
  };
}

/**
 * Titel einer Notiz. Steht keiner im Kopf, wird die erste Zeile genommen,
 * wenn sie eine Ueberschrift ist: so bekommt eine Markdown-Datei, die jemand
 * aus einem anderen Programm in den Ordner legt, einen brauchbaren Namen
 * statt „Ohne Titel". Die Ueberschrift bleibt im Text stehen.
 */
function noteTitle(raw: unknown, body: string): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  const heading = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(body.split('\n', 1)[0] ?? '');
  const found = heading?.[1].trim();
  if (found && !hasLinkReservedChars(found)) return found;

  return 'Ohne Titel';
}

/**
 * Nimmt nur Eintraege mit zwei endlichen Zahlen. Eine kaputte Angabe wuerde
 * den Knoten sonst ins Nirgendwo setzen, wo er nicht mehr zu fassen waere.
 */
function normalizeGraphPositions(value: unknown): Record<string, GraphPosition> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const positions: Record<string, GraphPosition> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const { x, y } = entry as { x?: unknown; y?: unknown };
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    positions[id] = { x, y };
  }
  return positions;
}

const FIELD_TYPES: FieldDef['type'][] = ['text', 'textarea', 'number', 'url', 'image', 'select', 'date', 'checkbox'];

/**
 * Prueft Notiztypen aus der Oberflaeche, bevor sie geschrieben werden.
 * Doppelte Schluessel wuerden dazu fuehren, dass zwei Felder denselben Wert
 * teilen, doppelte Typ-IDs, dass Notizen dem falschen Typ zugeordnet werden.
 */
function validateNoteTypes(types: NoteTypeDef[]): NoteTypeDef[] {
  if (!Array.isArray(types) || types.length === 0) {
    throw new VaultError('error.needsOneType');
  }

  const seenTypes = new Set<string>();
  return types.map((def) => {
    const id = String(def.id ?? '').trim();
    const label = String(def.label ?? '').trim();
    if (!id) throw new VaultError('error.typeWithoutId');
    if (!label) throw new VaultError('error.typeNeedsLabel', { id });
    if (seenTypes.has(id)) throw new VaultError('error.duplicateType', { id });
    seenTypes.add(id);

    const seenFields = new Set<string>();
    const fields = (Array.isArray(def.fields) ? def.fields : []).map((field) => {
      const key = String(field.key ?? '').trim();
      const fieldLabel = String(field.label ?? '').trim();
      if (!key) throw new VaultError('error.fieldWithoutKey', { label });
      if (!fieldLabel) throw new VaultError('error.fieldNeedsLabel', { label });
      if (seenFields.has(key)) throw new VaultError('error.duplicateField', { key, label });
      seenFields.add(key);

      const normalized: FieldDef = {
        key,
        label: fieldLabel,
        type: FIELD_TYPES.includes(field.type) ? field.type : 'text'
      };
      const placeholder = String(field.placeholder ?? '').trim();
      if (placeholder) normalized.placeholder = placeholder;

      const options = asStringArray(field.options);
      if (normalized.type === 'select') {
        if (options.length === 0) throw new VaultError('error.selectNeedsOptions', { label: fieldLabel });
        normalized.options = options;
      }
      return normalized;
    });

    return { id, label, plural: String(def.plural ?? '').trim() || label, fields };
  });
}

/** Wie validateNoteTypes, repariert aber statt zu werfen. Fuer das Lesen von der Platte. */
function normalizeNoteTypes(types: NoteTypeDef[]): NoteTypeDef[] {
  const seenTypes = new Set<string>();
  const normalized = types.flatMap((def) => {
    const id = String(def?.id ?? '').trim();
    if (!id || seenTypes.has(id)) return [];
    seenTypes.add(id);

    const label = String(def.label ?? '').trim() || id;
    const seenFields = new Set<string>();
    const fields = (Array.isArray(def.fields) ? def.fields : []).flatMap((field) => {
      const fieldLabel = String(field?.label ?? '').trim();
      if (!fieldLabel) return [];
      const key = String(field.key ?? '').trim() || toKey(fieldLabel, seenFields);
      if (seenFields.has(key)) return [];
      seenFields.add(key);

      const result: FieldDef = {
        key,
        label: fieldLabel,
        type: FIELD_TYPES.includes(field.type) ? field.type : 'text'
      };
      const placeholder = String(field.placeholder ?? '').trim();
      if (placeholder) result.placeholder = placeholder;

      const options = asStringArray(field.options);
      if (result.type === 'select') {
        // Eine Auswahlliste ohne Werte waere unbedienbar, dann lieber Text.
        if (options.length === 0) result.type = 'text';
        else result.options = options;
      }
      return [result];
    });

    return [{ id, label, plural: String(def.plural ?? '').trim() || label, fields }];
  });

  return normalized.length ? normalized : structuredClone(DEFAULT_NOTE_TYPES);
}

/** Repariert eine von Hand bearbeitete Datei, statt an ihr zu scheitern. */
function normalizePrompts(value: unknown): PromptCategory[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;

    const label = typeof record.label === 'string' ? record.label.trim() : '';
    const options = Array.isArray(record.options)
      ? record.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
      : [];
    if (!label || options.length === 0) return [];

    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : toKey(label);
    const types = Array.isArray(record.types)
      ? record.types.filter((typ): typ is string => typeof typ === 'string' && typ.trim().length > 0)
      : [];
    return [{ id, label, options: options.map((option) => option.trim()), ...(types.length ? { types } : {}) }];
  });
}

// --- Einstellungen ---------------------------------------------------------

export function defaultSettings(vaultRoot: string): AppSettings {
  return {
    schemaVersion: SCHEMA_VERSION,
    vaultRoot,
    language: DEFAULT_LANGUAGE,
    autosaveEnabled: true,
    autosaveDelayMs: 1500,
    historyEnabled: true,
    historyMaxVersions: 50,
    aiProvider: 'none',
    ollamaBaseUrl: 'http://127.0.0.1:11434',
    ollamaModel: 'llama3.1',
    claudeModel: 'claude-opus-5',
    claudeApiKeyEncrypted: '',
    aiSendLinkedNotes: true,
    editorZoom: ZOOM_NORMAL,
    spellcheck: 'auto',
    lastCampaignId: null
  };
}

export async function readSettings(file: string, fallbackRoot: string): Promise<AppSettings> {
  const defaults = defaultSettings(fallbackRoot);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as Partial<AppSettings>;
    return {
      ...defaults,
      ...parsed,
      schemaVersion: SCHEMA_VERSION,
      vaultRoot: typeof parsed.vaultRoot === 'string' && parsed.vaultRoot ? parsed.vaultRoot : defaults.vaultRoot,
      autosaveDelayMs: clampDelay(parsed.autosaveDelayMs ?? defaults.autosaveDelayMs),
      historyMaxVersions: clampVersions(parsed.historyMaxVersions ?? defaults.historyMaxVersions),
      language: isLanguage(parsed.language) ? parsed.language : defaults.language,
      editorZoom: begrenzeZoom(parsed.editorZoom ?? defaults.editorZoom),
      spellcheck: istRechtschreibwahl(parsed.spellcheck) ? parsed.spellcheck : defaults.spellcheck
    };
  } catch {
    return defaults;
  }
}

export async function writeSettings(file: string, settings: AppSettings): Promise<AppSettings> {
  const normalized: AppSettings = {
    ...settings,
    schemaVersion: SCHEMA_VERSION,
    autosaveDelayMs: clampDelay(settings.autosaveDelayMs),
    historyMaxVersions: clampVersions(settings.historyMaxVersions),
    editorZoom: begrenzeZoom(settings.editorZoom)
  };
  await writeJson(file, normalized);
  return normalized;
}

function clampVersions(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(500, Math.max(1, Math.round(value)));
}

function clampDelay(value: number): number {
  if (!Number.isFinite(value)) return 1500;
  return Math.min(30_000, Math.max(300, Math.round(value)));
}
