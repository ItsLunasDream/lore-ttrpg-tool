import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { Vault, VaultError, writeSettings } from './vault';
import { translate } from '../shared/i18n';
import { zipDirectory } from './export';
import { setzeErkannteSprachen, setzePruefsprache } from './rechtschreibung';
import { ALLOWED_IMAGE_EXTENSIONS } from './vault';
import { referencedAssets, renderNoteMarkdown, aliasKopf, toFileName } from './markdownExport';
import { exportNotesToPdf } from './pdfExport';
import type { PromptCategory } from '../shared/writingPrompts';
import { askProvider, createProvider, decryptSecret, encryptSecret, AiError } from './ai';
import type { KiQuelle } from './ai';
import { findNoteType } from '../shared/noteTypes';
import { channel } from '../shared/channels';
import { verlinkteNotizen } from '../shared/kiKontext';
import { zeichneGraph } from './graphBild';
import type {
  AiMessage,
  AiTask,
  AppSettings,
  Campaign,
  GraphPosition,
  Note,
  NoteType,
  NoteTypeDef,
  NoteVersion,
  OrphanedAsset,
  UnreadableNote
} from '../shared/types';

export interface IpcContext {
  vault: Vault;
  settingsFile: string;
  settings: AppSettings;
  /**
   * Wird gerufen, wenn hier die Sprache umgestellt wurde.
   *
   * Nur die Huelle setzt das: sie fuehrt die Sprache fuer die ganze Sammlung
   * und muss erfahren, wenn jemand sie in dieser Anwendung aendert — sonst
   * liefen die Werkzeuge auseinander. Eigenstaendig bleibt es leer.
   */
  onLanguageChange?: (language: AppSettings['language']) => void;
  /**
   * Gesetzt, wenn eine Huelle die KI fuer die ganze Sammlung fuehrt. Dann
   * gilt deren Einstellung statt der eigenen, und die Oberflaeche blendet
   * ihren KI-Abschnitt aus.
   */
  kiQuelle?: KiQuelle;
  /** Ob eine Huelle einbettet. Sie fuehrt dann die Einstellungen. */
  inHuelle?: boolean;
}

/** Fehler aus dem Main-Prozess kommen im Renderer als lesbare Meldung an. */
function makeHandler(context: IpcContext) {
  return function handle<Args extends unknown[], Result>(
    name: string,
    fn: (...args: Args) => Promise<Result>
  ): void {
    ipcMain.handle(channel(name), async (_event, ...args) => {
      try {
        return { ok: true as const, value: await fn(...(args as Args)) };
      } catch (error) {
        const language = context.settings.language;
        const message =
          error instanceof VaultError
            ? translate(language, error.key, error.params)
            : translate(language, 'error.unexpected', { detail: String(error) });
        if (!(error instanceof VaultError)) console.error(`[ipc] ${name}`, error);
        return { ok: false as const, error: message };
      }
    });
  };
}

/** Wie makeHandler, reicht aber das IPC-Ereignis durch, etwa fuer Teilantworten. */
function makeEventHandler(context: IpcContext) {
  return function handle<Args extends unknown[], Result>(
    name: string,
    fn: (event: IpcMainInvokeEvent, ...args: Args) => Promise<Result>
  ): void {
    ipcMain.handle(channel(name), async (event, ...args) => {
      try {
        return { ok: true as const, value: await fn(event, ...(args as Args)) };
      } catch (error) {
        const language = context.settings.language;
        const message =
          error instanceof VaultError
            ? translate(language, error.key, error.params)
            : translate(language, 'error.unexpected', { detail: String(error) });
        if (!(error instanceof VaultError)) console.error(`[ipc] ${name}`, error);
        return { ok: false as const, error: message };
      }
    });
  };
}

export function registerIpc(context: IpcContext): void {
  const { vault } = context;
  const handle = makeHandler(context);
  const handleWithEvent = makeEventHandler(context);

  handle<[], AppSettings>('settings:get', async () => context.settings);

  /**
   * Ob eine Huelle die Einstellungen fuehrt.
   *
   * Die Oberflaeche laesst ihren eigenen Einstellungen-Knopf dann weg: die
   * Felder stehen im Dialog der Huelle, und zwei Stellen fuer dieselbe Sache
   * heisst, dass man immer zuerst in der falschen nachsieht.
   */
  handle<[], boolean>('app:inHuelle', async () => Boolean(context.inHuelle));

  /** Fuer den Über-Dialog: welche Fassung gerade läuft. */
  handle<[], string>('app:version', async () => app.getVersion());

  handleWithEvent<[Partial<AppSettings>], AppSettings>('settings:update', async (event, patch) => {
    const vorher = context.settings.language;
    const kiVorher = context.settings.aiProvider;
    const pruefungVorher = context.settings.spellcheck;
    const next: AppSettings = { ...context.settings, ...patch, vaultRoot: context.settings.vaultRoot };
    context.settings = await writeSettings(context.settingsFile, next);
    vault.setHistoryOptions({
      enabled: context.settings.historyEnabled,
      maxVersions: context.settings.historyMaxVersions
    });
    if (context.settings.language !== vorher) context.onLanguageChange?.(context.settings.language);
    if (context.settings.spellcheck !== pruefungVorher && !event.sender.isDestroyed()) {
      setzePruefsprache(event.sender.session, context.settings.language, context.settings.spellcheck);
    }
    /*
     * Ein Wechsel des Anbieters entscheidet, ob es den Assistenten ueberhaupt
     * gibt. Aus dem eigenen Einstellungsdialog holt die Oberflaeche den
     * Zustand selbst nach; kommt die Aenderung von woanders — aus einem
     * Skript, aus einer zweiten Ansicht —, erfuhr sie bisher nichts davon und
     * zeigte einen Assistenten, den es nicht mehr gab. Dasselbe Signal
     * benutzt die Huelle, wenn sie die KI fuer die Sammlung fuehrt.
     */
    if (context.settings.aiProvider !== kiVorher && !event.sender.isDestroyed()) {
      event.sender.send(channel('app:ki-gewechselt'));
    }
    return context.settings;
  });

  handle<[], AppSettings | null>('settings:chooseVaultRoot', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;

    const root = result.filePaths[0];
    vault.setRoot(root);
    await vault.init();
    context.settings = await writeSettings(context.settingsFile, {
      ...context.settings,
      vaultRoot: root,
      lastCampaignId: null
    });
    return context.settings;
  });

  /**
   * Fragt vor einer Aktion, die den Stand auf der Platte braucht (Export,
   * Aufraeumen, der Assistent), was mit Ungespeichertem geschehen soll.
   *
   * Antwort: 'speichern' | 'ohne' | 'abbrechen'.
   *
   * Derselbe Dialog wie beim Schliessen, und aus demselben Grund nativ: er
   * muss auch dann sichtbar sein, wenn die Anwendung in der Huelle unter
   * deren eigenen Dialogen liegt.
   */
  handle<[number], 'speichern' | 'ohne' | 'abbrechen'>('app:frage-speichern', async (anzahl) => {
    const deutsch = context.settings.language === 'de';
    const fenster = BrowserWindow.getFocusedWindow();
    const optionen: Electron.MessageBoxOptions = {
      type: 'question',
      title: deutsch ? 'Nicht gespeicherte Änderungen' : 'Unsaved changes',
      message: deutsch
        ? anzahl === 1
          ? 'Eine Notiz ist nicht gespeichert.'
          : `${anzahl} Notizen sind nicht gespeichert.`
        : anzahl === 1
          ? 'One note is not saved.'
          : `${anzahl} notes are not saved.`,
      detail: deutsch
        ? 'Diese Aktion arbeitet mit dem Stand auf der Platte. Ungespeichertes fehlt darin.'
        : 'This action works on what is on disk. Unsaved changes are missing from it.',
      buttons: deutsch
        ? ['Speichern und fortfahren', 'Ohne Speichern fortfahren', 'Abbrechen']
        : ['Save and continue', 'Continue without saving', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    };
    const { response } = fenster
      ? await dialog.showMessageBox(fenster, optionen)
      : await dialog.showMessageBox(optionen);
    return response === 0 ? 'speichern' : response === 1 ? 'ohne' : 'abbrechen';
  });

  handle<[], PromptCategory[]>('prompts:get', () => vault.readPrompts(context.settings.language));

  handle<[], void>('prompts:reveal', async () => {
    await vault.readPrompts(context.settings.language);
    await shell.showItemInFolder(vault.promptsFile(context.settings.language));
  });

  handle<[], void>('vault:reveal', async () => {
    await fs.mkdir(vault.vaultRoot, { recursive: true });
    await shell.openPath(vault.vaultRoot);
  });

  handle<[], Campaign[]>('campaign:list', () => vault.listCampaigns());
  handle<[string], Campaign>('campaign:create', (name) =>
    vault.createCampaign(name, context.settings.language)
  );
  handle<[string, string], Campaign>('campaign:rename', (id, name) => vault.renameCampaign(id, name));
  handle<[string], void>('campaign:delete', (id) => vault.deleteCampaign(id));
  handle<[string], Campaign>('campaign:get', (id) => vault.getCampaign(id));
  handle<[string, Record<string, GraphPosition>], Campaign>('campaign:graphPositions', (id, positions) =>
    vault.saveGraphPositions(id, positions)
  );
  handle<[string, NoteTypeDef[]], Campaign>('campaign:updateNoteTypes', (id, types) =>
    vault.updateNoteTypes(id, types)
  );

  handle<[string], Note[]>('note:list', (campaignId) => vault.listNotes(campaignId));
  handle<[string], UnreadableNote[]>('note:unreadable', (campaignId) => vault.findUnreadableNotes(campaignId));
  handle<[string, NoteType, string], Note>('note:create', (campaignId, type, title) =>
    vault.createNote(campaignId, type, title)
  );
  handle<[string, Note], Note>('note:save', (campaignId, note) => vault.saveNote(campaignId, note));
  handle<[string, string, string], { note: Note; rewritten: number }>('note:rename', (campaignId, noteId, title) =>
    vault.renameNote(campaignId, noteId, title)
  );
  handle<[string, string], void>('note:delete', (campaignId, noteId) => vault.deleteNote(campaignId, noteId));
  handle<[string, string], Note>('note:restore', (campaignId, noteId) => vault.restoreNote(campaignId, noteId));

  handle<[string, string], NoteVersion[]>('history:list', (campaignId, noteId) =>
    vault.listVersions(campaignId, noteId)
  );
  handle<[string, string, string], Note>('history:restore', (campaignId, noteId, versionId) =>
    vault.restoreVersion(campaignId, noteId, versionId)
  );

  /** Bild ueber einen Dateidialog waehlen und in die Kampagne kopieren. */
  handle<[string], string | null>('asset:pick', async (campaignId) => {
    const window = BrowserWindow.getFocusedWindow();
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'Bilder', extensions: ALLOWED_IMAGE_EXTENSIONS.map((entry) => entry.slice(1)) }]
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;

    const source = result.filePaths[0];
    return vault.saveAsset(campaignId, path.basename(source), await fs.readFile(source));
  });

  /** Bild aus Zwischenablage oder Ziehen und Ablegen uebernehmen. */
  handle<[string, string, Uint8Array], string>('asset:save', (campaignId, name, data) =>
    vault.saveAsset(campaignId, name, data)
  );

  // --- KI-Assistent --------------------------------------------------------

  handle<
    [],
    { provider: string; ready: boolean; detail: string; hasKey: boolean; managedByShell: boolean }
  >('ai:status', async () => {
    const provider = createProvider(
      context.settings,
      decryptSecret(context.settings.claudeApiKeyEncrypted),
      context.kiQuelle
    );
    // Fuehrt die Huelle die KI, sagt sie auch, ob ein Schluessel da ist.
    const hasKey = context.kiQuelle
      ? Boolean(context.kiQuelle().schluessel)
      : Boolean(context.settings.claudeApiKeyEncrypted);
    const managedByShell = Boolean(context.kiQuelle);

    if (!provider) return { provider: 'none', ready: false, detail: '', hasKey, managedByShell };

    const zustand = await provider.pruefe();
    return {
      provider: provider.id,
      ready: zustand.bereit,
      // Der Grund wird hier uebersetzt, wo die eingestellte Sprache bekannt ist.
      detail: zustand.bereit
        ? zustand.beschreibung
        : translate(context.settings.language, zustand.schluessel, zustand.werte),
      hasKey,
      managedByShell
    };
  });

  /** Der Schluessel wird verschluesselt abgelegt und nie zurueckgegeben. */
  handle<[string], AppSettings>('ai:setApiKey', async (apiKey) => {
    // Fuehrt die Huelle die KI, gehoert der Schluessel dorthin. Hier einen
    // zweiten abzulegen hiesse, dass zwei Stellen sich widersprechen koennen
    // und die eine davon wirkungslos ist.
    if (context.kiQuelle) throw new VaultError('error.aiManagedByShell');

    const encrypted = encryptSecret(apiKey.trim());
    if (encrypted === null) throw new VaultError('error.noSecureStorage');

    context.settings = await writeSettings(context.settingsFile, {
      ...context.settings,
      claudeApiKeyEncrypted: encrypted
    });
    return context.settings;
  });

  handleWithEvent<[string, string, AiTask, string, AiMessage[], string], string>(
    'ai:ask',
    async (event, campaignId, noteId, task, streamId, history, followUp) => {
      const provider = createProvider(
        context.settings,
        decryptSecret(context.settings.claudeApiKeyEncrypted),
        context.kiQuelle
      );
      if (!provider) throw new VaultError('error.noAiProvider');

      const campaign = await vault.getCampaign(campaignId);
      const notes = await vault.listNotes(campaignId);
      const note = notes.find((entry) => entry.id === noteId);
      if (!note) throw new VaultError('error.noteMissing');

      try {
        return await askProvider(
          provider,
          {
            task,
            language: context.settings.language,
            note: describeNote(note, campaign.noteTypes),
            // Abschaltbar: weniger Text an ein kostenpflichtiges Modell,
            // und manchmal soll die Rueckmeldung nur die offene Notiz
            // betreffen.
            context: context.settings.aiSendLinkedNotes
              ? describeLinkedNotes(note, notes, campaign.noteTypes)
              : '',
            // Der Verlauf wird begrenzt, sonst waechst jede Rueckfrage die
            // Anfrage weiter auf und kostet mehr, ohne besser zu werden.
            history: history.slice(-8),
            followUp
          },
          // Teiltexte gehen als eigenes Ereignis an genau das Fenster, das
          // gefragt hat. Die Kennung ordnet sie der laufenden Anfrage zu.
          (chunk) => {
            if (!event.sender.isDestroyed()) event.sender.send(channel('ai:chunk'), streamId, chunk);
          }
        );
      } catch (error) {
        if (error instanceof AiError) throw new VaultError(error.schluessel, error.werte);
        throw error;
      }
    }
  );

  /**
   * Das Woerterbuch der Sitzung. Eigennamen aus der Kampagne stehen in keinem
   * Woerterbuch der Welt, und angestrichen bleiben sie sonst fuer immer.
   *
   * Ueber den Absender und nicht ueber die Standardsitzung: in der Huelle
   * laeuft jede Anwendung in ihrer eigenen (`persist:<id>`), und das
   * Woerterbuch haengt an ihr.
   */
  /**
   * Ausschneiden, Kopieren, Einfuegen aus dem eigenen Rechtsklickmenue.
   * Ueber den Hauptprozess, damit es genau wie Strg+X/C/V wirkt: dieselben
   * Einfuege-Wege im Editor, auch fuer Bilder aus der Zwischenablage.
   */
  handleWithEvent<['cut' | 'copy' | 'paste'], void>('edit:clipboard', async (event, art) => {
    if (art === 'cut') event.sender.cut();
    else if (art === 'copy') event.sender.copy();
    else if (art === 'paste') event.sender.paste();
  });

  /** Die im Text erkannten Sprachen (Oberflaeche), nur wirksam bei „auto“. */
  handleWithEvent<[string[]], void>('spell:erkannt', async (event, sprachen) => {
    if (event.sender.isDestroyed()) return;
    setzeErkannteSprachen(event.sender.session, Array.isArray(sprachen) ? sprachen : [], context.settings.language, context.settings.spellcheck);
  });

  handleWithEvent<[string], string[]>('spell:add', async (event, wort) => {
    const sitzung = event.sender.session;
    sitzung.addWordToSpellCheckerDictionary(wort);
    return sitzung.listWordsInSpellCheckerDictionary();
  });

  handleWithEvent<[string], string[]>('spell:remove', async (event, wort) => {
    const sitzung = event.sender.session;
    sitzung.removeWordFromSpellCheckerDictionary(wort);
    return sitzung.listWordsInSpellCheckerDictionary();
  });

  handleWithEvent<[], string[]>('spell:list', async (event) =>
    event.sender.session.listWordsInSpellCheckerDictionary()
  );

  handle<[string], OrphanedAsset[]>('asset:orphans', (campaignId) => vault.listOrphanedAssets(campaignId));
  handle<[string, string[]], number>('asset:deleteMany', (campaignId, names) =>
    vault.deleteAssets(campaignId, names)
  );

  handle<[string], void>('shell:openExternal', async (url) => {
    // Nur diese drei oeffnen, damit ein Link im Text keine beliebigen Handler
    // startet. mailto gehoert dazu, seit der Editor solche Links kennt.
    const parsed = new URL(url);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      throw new VaultError('error.externalProtocol');
    }
    await shell.openExternal(parsed.toString());
  });

  /**
   * Schreibt Notizen als lesbares Markdown in einen gewaehlten Ordner. Die
   * benutzten Bilder werden mitkopiert, damit der Export fuer sich steht.
   */
  async function exportMarkdown(campaignId: string, noteIds: string[] | null): Promise<{ path: string; count: number } | null> {
    const window = BrowserWindow.getFocusedWindow();
    const options = { properties: ['openDirectory' as const, 'createDirectory' as const] };
    const chosen = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (chosen.canceled || !chosen.filePaths[0]) return null;

    const campaign = await vault.getCampaign(campaignId);
    const allNotes = await vault.listNotes(campaignId);
    const selected = noteIds ? allNotes.filter((note) => noteIds.includes(note.id)) : allNotes;

    const targetDir = path.join(chosen.filePaths[0], sanitizeDirName(campaign.name));
    await fs.mkdir(targetDir, { recursive: true });

    const language = context.settings.language;
    const labels = {
      type: translate(language, 'export.type'),
      relations: translate(language, 'export.relations'),
      mentionedBy: translate(language, 'export.mentionedBy'),
      aliases: translate(language, 'export.aliases'),
      tags: translate(language, 'export.tags'),
      yes: translate(language, 'field.yes'),
      no: translate(language, 'field.no')
    };

    const usedNames = new Set<string>();
    const usedAssets = new Set<string>();

    for (const note of selected) {
      const fileName = toFileName(note.title, usedNames);
      usedNames.add(fileName);
      await fs.writeFile(
        path.join(targetDir, fileName),
        aliasKopf(note.title, fileName) + renderNoteMarkdown(note, campaign.noteTypes, allNotes, labels),
        'utf8'
      );
      for (const asset of referencedAssets(note, campaign.noteTypes)) usedAssets.add(asset);
    }

    if (usedAssets.size) {
      await fs.mkdir(path.join(targetDir, 'assets'), { recursive: true });
      for (const asset of usedAssets) {
        const fileName = asset.replace(/^assets\//, '');
        try {
          await fs.copyFile(vault.assetFile(campaignId, fileName), path.join(targetDir, 'assets', fileName));
        } catch {
          // Fehlendes Bild darf den Export nicht abbrechen.
        }
      }
    }

    return { path: targetDir, count: selected.length };
  }

  /** Notizen als PDF ausgeben, ueber ein unsichtbares Druckfenster. */
  async function exportPdf(
    campaignId: string,
    noteIds: string[] | null,
    suggestedName: string,
    inhaltsverzeichnis = false,
    mitGraph = false
  ) {
    const window = BrowserWindow.getFocusedWindow();
    const options = {
      defaultPath: `${slug(suggestedName)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    };
    const chosen = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (chosen.canceled || !chosen.filePath) return null;

    const campaign = await vault.getCampaign(campaignId);
    const allNotes = await vault.listNotes(campaignId);
    const selected = noteIds ? allNotes.filter((note) => noteIds.includes(note.id)) : allNotes;

    const language = context.settings.language;
    await exportNotesToPdf(
      selected,
      {
        types: campaign.noteTypes,
        allNotes,
        labels: {
          type: translate(language, 'export.type'),
          relations: translate(language, 'export.relations'),
          mentionedBy: translate(language, 'export.mentionedBy'),
          aliases: translate(language, 'export.aliases'),
          tags: translate(language, 'export.tags'),
          yes: translate(language, 'field.yes'),
          no: translate(language, 'field.no')
        },
        // Ein einzelner kaputter Verweis darf den ganzen Export nicht
        // abbrechen. Ein leerer Pfad ergibt nur ein fehlendes Bild.
        resolveAsset: (relativePath) => {
          try {
            return vault.assetFile(campaignId, relativePath.replace(/^assets\//, ''));
          } catch {
            return '';
          }
        },
        inhaltsverzeichnis,
        inhaltTitel: translate(language, 'export.toc'),
        // Das Netz der GANZEN Kampagne, nicht nur der ausgewaehlten Notizen:
        // ein halbes Netz zeigt Verbindungen ins Nichts.
        graphBild: mitGraph ? zeichneGraph(allNotes, campaign.noteTypes, campaign.graphPositions) : '',
        graphTitel: translate(language, 'export.graph')
      },
      chosen.filePath
    );

    return { path: chosen.filePath, count: selected.length };
  }

  handle<[string, string, string[] | null, boolean, boolean], { path: string; count: number } | null>(
    'export:campaignPdf',
    (campaignId, name, noteIds, inhaltsverzeichnis, mitGraph) =>
      exportPdf(campaignId, noteIds, name, inhaltsverzeichnis, mitGraph)
  );
  handle<[string, string, string], { path: string; count: number } | null>('export:notePdf', (campaignId, noteId, title) =>
    exportPdf(campaignId, [noteId], title)
  );

  handle<[string, string[] | null], { path: string; count: number } | null>(
    'export:campaignMarkdown',
    (campaignId, noteIds) => exportMarkdown(campaignId, noteIds)
  );
  handle<[string, string], { path: string; count: number } | null>('export:noteMarkdown', (campaignId, noteId) =>
    exportMarkdown(campaignId, [noteId])
  );

  handle<[string, string], string | null>('export:campaignZip', async (campaignId, campaignName) => {
    const window = BrowserWindow.getFocusedWindow();
    const suggested = `${slug(campaignName)}-${new Date().toISOString().slice(0, 10)}.zip`;
    const options = { defaultPath: suggested, filters: [{ name: 'ZIP-Archiv', extensions: ['zip'] }] };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;

    const sourceDir = path.join(vault.vaultRoot, 'campaigns', campaignId);
    await zipDirectory(sourceDir, result.filePath);
    return result.filePath;
  });

  /**
   * Der Weg zurueck. Die eingelesene Kampagne bekommt immer eine neue
   * Kennung; eine vorhandene wird nie ueberschrieben.
   */
  handle<[], Campaign | null>('campaign:import', async () => {
    const window = BrowserWindow.getFocusedWindow();
    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'ZIP-Archiv', extensions: ['zip'] }]
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;

    return vault.importCampaign(result.filePaths[0], context.settings.language === 'en' ? 'imported' : 'importiert');
  });
}

/** Ordnername aus dem Kampagnennamen, ohne Zeichen, die Dateisysteme stoeren. */
function sanitizeDirName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Kampagne';
}

/** Notiz als Klartext fuer das Modell, ohne YAML und ohne Bildverweise. */
function describeNote(note: Note, types: NoteTypeDef[], maxBodyChars = 8000): string {
  const def = findNoteType(types, note.type);
  const lines = [`Titel: ${note.title}`, `Typ: ${def.label}`];

  for (const field of def.fields) {
    const value = note.fields[field.key]?.trim();
    if (value && field.type !== 'image') lines.push(`${field.label}: ${value}`);
  }
  if (note.aliases.length) lines.push(`Aliase: ${note.aliases.join(', ')}`);

  const body = note.body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  lines.push('', body.length > maxBodyChars ? `${body.slice(0, maxBodyChars)} […]` : body);
  return lines.join('\n');
}

/**
 * Verlinkte Notizen als Kontext, gekuerzt. Ohne diese Grenze waechst die
 * Anfrage mit der Kampagne und wird teuer, ohne besser zu werden.
 */
function describeLinkedNotes(note: Note, notes: Note[], types: NoteTypeDef[], perNoteChars = 1200): string {
  return verlinkteNotizen(note, notes)
    .map((entry) => describeNote(entry, types, perNoteChars))
    .join('\n\n---\n\n');
}

function slug(name: string): string {
  return (
    name
      .toLocaleLowerCase('de-DE')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'kampagne'
  );
}
