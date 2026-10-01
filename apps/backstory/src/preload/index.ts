import { contextBridge, ipcRenderer } from 'electron';
import type {
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
import type { PromptCategory } from '../shared/writingPrompts';
import type { AiMessage, AiTask } from '../shared/types';
import { channel } from '../shared/channels';

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Die kurzen Namen unten werden hier zu den vollen Kanalnamen. Siehe
// shared/channels.ts, warum es das Praefix gibt.
const invoke = <T>(name: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel(name), ...args) as Promise<IpcResult<T>>;

/**
 * Einzige Bruecke zwischen Renderer und Dateisystem. Der Renderer bekommt
 * bewusst keinen Node-Zugriff (contextIsolation), sondern nur diese Aufrufe.
 */
const api = {
  settings: {
    get: () => invoke<AppSettings>('settings:get'),
    update: (patch: Partial<AppSettings>) => invoke<AppSettings>('settings:update', patch),
    chooseVaultRoot: () => invoke<AppSettings | null>('settings:chooseVaultRoot')
  },
  app: {
    version: () => invoke<string>('app:version'),
    /** Ob eine Huelle einbettet und damit die Einstellungen fuehrt. */
    inHuelle: () => invoke<boolean>('app:inHuelle')
  },
  vault: {
    reveal: () => invoke<void>('vault:reveal')
  },
  /**
   * Das Fenster soll schliessen. Der Renderer sichert Ungespeichertes und
   * meldet sich mit `flushed` zurueck.
   */
  onFlush: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel('app:flush'), listener);
    return () => ipcRenderer.off(channel('app:flush'), listener);
  },
  flushed: () => ipcRenderer.send(channel('app:flushed')),
  /**
   * Fragt vor einer Aktion, die den Plattenstand braucht, was mit
   * Ungespeichertem geschehen soll.
   */
  frageSpeichern: (anzahl: number) =>
    invoke<'speichern' | 'ohne' | 'abbrechen'>('app:frage-speichern', anzahl),
  /**
   * Der Hauptprozess fragt vor dem Schliessen, was ungespeichert ist.
   *
   * Der Rueckruf liefert die Titel der betroffenen Notizen. Leer heisst: es
   * kann geschlossen werden, ohne jemanden zu fragen. `flush` beantwortet
   * diese Frage nicht — es speichert, und genau das soll bei
   * ausgeschaltetem Autosave nicht mehr ungefragt passieren.
   */
  onUngespeichertGefragt: (callback: () => string[]) => {
    const listener = () => ipcRenderer.send(channel('app:ungespeichert'), callback());
    ipcRenderer.on(channel('app:frage-ungespeichert'), listener);
    return () => ipcRenderer.off(channel('app:frage-ungespeichert'), listener);
  },
  /** Alles Ungespeicherte schreiben — die Antwort „Speichern" aus dem Dialog. */
  onSpeichereAlles: (callback: () => Promise<void>) => {
    const listener = () => {
      void callback().finally(() => ipcRenderer.send(channel('app:alles-gespeichert')));
    };
    ipcRenderer.on(channel('app:speichere-alles'), listener);
    return () => ipcRenderer.off(channel('app:speichere-alles'), listener);
  },
  /**
   * Die Sprache wurde von aussen gesetzt (aus der Huelle). Liefert eine
   * Funktion zum Abmelden zurueck.
   */
  onLanguageChange: (callback: (language: AppSettings['language']) => void): (() => void) => {
    const listener = (_e: unknown, language: AppSettings['language']) => callback(language);
    ipcRenderer.on(channel('app:sprache'), listener);
    return () => {
      ipcRenderer.off(channel('app:sprache'), listener);
    };
  },
  /**
   * Im Speicherort ist etwas dazugekommen, das nicht aus dieser Oberflaeche
   * stammt — der NPC Creator hat eine Figur abgelegt. Liefert eine Funktion
   * zum Abmelden zurueck.
   */
  /**
   * Die Suche der Huelle (Strg+K) hat eine Notiz gewaehlt, die hier liegt.
   *
   * Beides kommt mit: eine Notizkennung ist nur INNERHALB ihrer Kampagne
   * eindeutig, zwei Kampagnen duerfen einen „Koenig" haben. Liefert eine
   * Funktion zum Abmelden zurueck.
   */
  beiSuchtreffer: (
    callback: (ziel: { kampagne: string; notiz: string }) => void
  ): (() => void) => {
    const listener = (_e: unknown, ziel: { kampagne: string; notiz: string }) => callback(ziel);
    ipcRenderer.on(channel('suche:zeigen'), listener);
    return () => {
      ipcRenderer.off(channel('suche:zeigen'), listener);
    };
  },
  onFremdeAenderung: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel('app:fremde-aenderung'), listener);
    return () => {
      ipcRenderer.off(channel('app:fremde-aenderung'), listener);
    };
  },
  /**
   * Die Einstellungen wurden von aussen geaendert — im Dialog der Huelle.
   * Mitgeliefert wird der ganze neue Stand. Liefert eine Funktion zum
   * Abmelden zurueck.
   */
  onEinstellungen: (callback: (einstellungen: AppSettings) => void): (() => void) => {
    const listener = (_e: unknown, einstellungen: AppSettings) => callback(einstellungen);
    ipcRenderer.on(channel('app:einstellungen'), listener);
    return () => {
      ipcRenderer.off(channel('app:einstellungen'), listener);
    };
  },
  /**
   * Der Speicherort wurde von aussen gewechselt. Kampagnen und Notizen im
   * Speicher der Oberflaeche stimmen danach nicht mehr. Liefert eine
   * Funktion zum Abmelden zurueck.
   */
  onSpeicherortWechsel: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel('app:speicherort'), listener);
    return () => {
      ipcRenderer.off(channel('app:speicherort'), listener);
    };
  },
  /**
   * Die KI-Einstellung der Sammlung hat sich geaendert. Liefert eine Funktion
   * zum Abmelden zurueck.
   */
  onKiWechsel: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel('app:ki-gewechselt'), listener);
    return () => {
      ipcRenderer.off(channel('app:ki-gewechselt'), listener);
    };
  },
  /**
   * Rechtsklick auf ein falsch geschriebenes Wort. Das Ereignis kommt aus
   * dem Hauptprozess, weil nur dort steht, was Chromium angestrichen hat.
   * Liefert eine Funktion zum Abmelden zurueck.
   */
  onRechtschreibung: (
    callback: (treffer: { x: number; y: number; wort: string; vorschlaege: string[] }) => void
  ): (() => void) => {
    const listener = (_e: unknown, treffer: { x: number; y: number; wort: string; vorschlaege: string[] }) =>
      callback(treffer);
    ipcRenderer.on(channel('app:rechtschreibung'), listener);
    return () => {
      ipcRenderer.off(channel('app:rechtschreibung'), listener);
    };
  },
  /**
   * Der Verlauf der Huelle.
   *
   * `melde` sagt, welche Notiz gerade offen ist; `beiSprung` bringt einen
   * Schritt zurueck oder vorwaerts hierher. Laeuft die Anwendung
   * eigenstaendig, hoert niemand zu und nichts davon tut etwas.
   */
  verlauf: {
    melde: (ort: string | null) => ipcRenderer.send(channel('app:verlauf-melde'), ort),
    beiSprung: (callback: (ort: string | null) => void): (() => void) => {
      const listener = (_e: unknown, ort: string | null) => callback(ort);
      ipcRenderer.on(channel('app:verlauf-springe'), listener);
      return () => {
        ipcRenderer.off(channel('app:verlauf-springe'), listener);
      };
    }
  },
  /** Ausschneiden, Kopieren, Einfuegen am fokussierten Feld, wie mit der Tastatur. */
  zwischenablage: (art: 'cut' | 'copy' | 'paste') => invoke<void>('edit:clipboard', art),
  /** Das Woerterbuch der Sitzung. Jede Antwort ist die vollstaendige Liste. */
  woerterbuch: {
    liste: () => invoke<string[]>('spell:list'),
    hinzufuegen: (wort: string) => invoke<string[]>('spell:add', wort),
    entfernen: (wort: string) => invoke<string[]>('spell:remove', wort),
    /** Die im Text erkannten Sprachen melden (Pruefung bei „auto“). */
    erkannt: (sprachen: string[]) => invoke<void>('spell:erkannt', sprachen)
  },
  ai: {
    status: () =>
      invoke<{
        provider: string;
        ready: boolean;
        detail: string;
        hasKey: boolean;
        managedByShell: boolean;
      }>('ai:status'),
    setApiKey: (apiKey: string) => invoke<AppSettings>('ai:setApiKey', apiKey),
    ask: (
      campaignId: string,
      noteId: string,
      task: AiTask,
      streamId: string,
      history: AiMessage[],
      followUp: string
    ) => invoke<string>('ai:ask', campaignId, noteId, task, streamId, history, followUp),
    /**
     * Teiltexte der laufenden Antwort. Liefert eine Funktion zum Abmelden.
     * Der Renderer bekommt bewusst kein ipcRenderer, nur diesen Ausschnitt.
     */
    onChunk: (streamId: string, callback: (text: string) => void) => {
      const listener = (_event: unknown, id: string, text: string) => {
        if (id === streamId) callback(text);
      };
      ipcRenderer.on(channel('ai:chunk'), listener);
      return () => ipcRenderer.off(channel('ai:chunk'), listener);
    }
  },
  prompts: {
    get: () => invoke<PromptCategory[]>('prompts:get'),
    reveal: () => invoke<void>('prompts:reveal')
  },
  campaigns: {
    list: () => invoke<Campaign[]>('campaign:list'),
    create: (name: string) => invoke<Campaign>('campaign:create', name),
    rename: (id: string, name: string) => invoke<Campaign>('campaign:rename', id, name),
    remove: (id: string) => invoke<void>('campaign:delete', id),
    get: (id: string) => invoke<Campaign>('campaign:get', id),
    updateNoteTypes: (id: string, types: NoteTypeDef[]) =>
      invoke<Campaign>('campaign:updateNoteTypes', id, types),
    savePlots: (id: string, plots: unknown) => invoke<Campaign>('campaign:plots', id, plots),
    saveGraphPositions: (id: string, positions: Record<string, GraphPosition>) =>
      invoke<Campaign>('campaign:graphPositions', id, positions)
  },
  notes: {
    list: (campaignId: string) => invoke<Note[]>('note:list', campaignId),
    /** Dateien, die sich nicht lesen lassen und deshalb in der Liste fehlen. */
    unreadable: (campaignId: string) => invoke<UnreadableNote[]>('note:unreadable', campaignId),
    create: (campaignId: string, type: NoteType, title: string) =>
      invoke<Note>('note:create', campaignId, type, title),
    save: (campaignId: string, note: Note) => invoke<Note>('note:save', campaignId, note),
    rename: (campaignId: string, noteId: string, title: string) =>
      invoke<{ note: Note; rewritten: number }>('note:rename', campaignId, noteId, title),
    remove: (campaignId: string, noteId: string) => invoke<void>('note:delete', campaignId, noteId),
    restore: (campaignId: string, noteId: string) => invoke<Note>('note:restore', campaignId, noteId)
  },
  history: {
    list: (campaignId: string, noteId: string) => invoke<NoteVersion[]>('history:list', campaignId, noteId),
    restore: (campaignId: string, noteId: string, versionId: string) =>
      invoke<Note>('history:restore', campaignId, noteId, versionId)
  },
  assets: {
    /** Bild ueber einen Dateidialog waehlen. Liefert den relativen Verweis. */
    pick: (campaignId: string) => invoke<string | null>('asset:pick', campaignId),
    /** Bild aus Zwischenablage oder Ziehen und Ablegen uebernehmen. */
    save: (campaignId: string, name: string, data: Uint8Array) =>
      invoke<string>('asset:save', campaignId, name, data),
    /** Bilder, auf die keine Notiz und keine gesicherte Fassung mehr verweist. */
    orphans: (campaignId: string) => invoke<OrphanedAsset[]>('asset:orphans', campaignId),
    deleteMany: (campaignId: string, names: string[]) =>
      invoke<number>('asset:deleteMany', campaignId, names)
  },
  /** Liest eine gesicherte Kampagne ein. Null, wenn der Dialog abgebrochen wurde. */
  importCampaignZip: () => invoke<Campaign | null>('campaign:import'),
  exportCampaignZip: (campaignId: string, campaignName: string) =>
    invoke<string | null>('export:campaignZip', campaignId, campaignName),
  exportPdf: {
    campaign: (
      campaignId: string,
      name: string,
      noteIds: string[] | null,
      inhaltsverzeichnis: boolean,
      mitGraph: boolean
    ) =>
      invoke<{ path: string; count: number } | null>(
        'export:campaignPdf',
        campaignId,
        name,
        noteIds,
        inhaltsverzeichnis,
        mitGraph
      ),
    note: (campaignId: string, noteId: string, title: string) =>
      invoke<{ path: string; count: number } | null>('export:notePdf', campaignId, noteId, title)
  },
  exportMarkdown: {
    campaign: (campaignId: string, noteIds: string[] | null) =>
      invoke<{ path: string; count: number } | null>('export:campaignMarkdown', campaignId, noteIds),
    note: (campaignId: string, noteId: string) =>
      invoke<{ path: string; count: number } | null>('export:noteMarkdown', campaignId, noteId)
  },
  openExternal: (url: string) => invoke<void>('shell:openExternal', url)
};

export type BackstoryApi = typeof api;

contextBridge.exposeInMainWorld('api', api);

/*
 * Die Daumentasten der Maus und Alt+Pfeil, an die Huelle gemeldet.
 *
 * Hier und nicht in der Oberflaeche: das Preload sieht dasselbe Dokument,
 * braucht dafuer aber keine Zeile im Anwendungscode — die Taste hat mit dem
 * Werkzeug nichts zu tun, sie gehoert der Huelle.
 *
 * Gehoert wird auf DREI Mausereignisse, nicht auf eines. `button` 3 ist
 * zurueck, 4 ist vorwaerts; welches der drei Ereignisse eine Seitentaste
 * ausloest, haengt am System, und auf dem Windows-Geraet kam mit `mouseup`
 * allein in einem eingebetteten Werkzeug nichts an. Mehrfach zu melden
 * schadet nicht: der Hauptprozess hat eine Sperrfrist und macht daraus
 * einen Schritt.
 *
 * Alt und Pfeil geht denselben Weg. In der Huelle allein zu lauschen reicht
 * nicht — liegt ein Werkzeug vorn, ist das hier ein anderes Dokument, und
 * die Tastatur kommt dort an und nicht drueben.
 *
 * Die Art des Ereignisses geht mit. Sie kostet nichts und beantwortet im
 * Zweifel die Frage, die man sonst nur raten kann: WAS ist angekommen.
 *
 * Von Hand getippt statt ueber `window`: dieselbe Datei wird zweimal
 * geprueft, einmal mit DOM-Typen und einmal ohne.
 */
const verlaufsDokument = globalThis as unknown as {
  addEventListener(
    art: string,
    hoerer: (ereignis: { readonly button?: number; readonly key?: string; readonly altKey?: boolean }) => void,
    erfassen: boolean
  ): void;
};

function meldeVerlaufsTaste(richtung: 'zurueck' | 'vorwaerts', art: string): void {
  ipcRenderer.send('huelle:verlauf-taste', richtung, art);
}

for (const art of ['mouseup', 'auxclick', 'pointerup']) {
  verlaufsDokument.addEventListener(
    art,
    (ereignis) => {
      if (ereignis.button === 3) meldeVerlaufsTaste('zurueck', art);
      else if (ereignis.button === 4) meldeVerlaufsTaste('vorwaerts', art);
    },
    true
  );
}

verlaufsDokument.addEventListener(
  'keydown',
  (ereignis) => {
    if (!ereignis.altKey) return;
    if (ereignis.key === 'ArrowLeft') meldeVerlaufsTaste('zurueck', 'alt-pfeil');
    else if (ereignis.key === 'ArrowRight') meldeVerlaufsTaste('vorwaerts', 'alt-pfeil');
  },
  true
);
