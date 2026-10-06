/**
 * Zentraler Editor-Zustand.
 *
 * Das Dokument selbst wird *mutiert*, nicht ersetzt — bei zehntausenden Props
 * wäre Kopieren pro Pinselpunkt zu teuer. Damit React trotzdem neu rendert,
 * zählt `rev` bei jeder Änderung hoch. Der Pixi-Renderer hängt nicht an React,
 * sondern an den feinkörnigen DocChange-Ereignissen (siehe subscribeChanges).
 */

import { create } from 'zustand';
import { DEFAULT_AUTOSAVE_MINUTES, clampInterval } from '@/io/autoSave';
import { History, type Command, type DocChange, type VttKind } from './commands';
import { createDocument, defaultTargetLayer, uebersetzeStandardnamen } from './document';
import { MAX_KARTEN, eindeutigeIds, entferneVerweiseAuf, mitKartenId, neueKarteWie } from './mappe';
import { onLanguageChange } from '@/i18n';
import { braucheAbgleich, syncVttVisuals, verknuepfeAltesMauerwerk } from './vttVisuals';
import { lichtKandidaten, syncPropLights } from './propLights';
import { defaultSymmetry, type SymmetrySettings } from './symmetry';
import { SYSTEM_GRID, SYSTEM_VTT, type LayerId, type MapDocument, type ObjectId } from './types';
import {
  defaultBrush,
  defaultDraw,
  defaultLight,
  defaultOpening,
  defaultProp,
  defaultHeight,
  defaultNote,
  defaultRegion,
  defaultRoom,
  defaultLegend,
  defaultTerrain,
  defaultErase,
  defaultRoute,
  defaultSelectFilter,
  defaultStamp,
  defaultText,
  type BrushPreset,
  type BrushSettings,
  type DrawSettings,
  type EraseSettings,
  type HeightSettings,
  type LegendSettings,
  type LightSettings,
  type NoteSettings,
  type OpeningSettings,
  type PropSettings,
  type RegionSettings,
  type RoomSettings,
  type RouteSettings,
  type TerrainSettings,
  type SelectFilter,
  type StampSettings,
  type TextSettings,
  type ToolId,
  type WallSettings,
} from './toolSettings';

// ---------------------------------------------------------------------------
// Änderungs-Ereignisse für den Renderer
// ---------------------------------------------------------------------------

type ChangeListener = (changes: DocChange[]) => void;

const listeners = new Set<ChangeListener>();

export function subscribeChanges(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Haengt den Abgleich des Mauerwerks an (model/vttVisuals.ts): nach jeder
 * Aenderung an Waenden, Layern oder Raster folgt die Zeichnung der Wand.
 */
function mitMauerwerk(doc: MapDocument, changes: DocChange[]): DocChange[] {
  let out = changes;
  if (braucheAbgleich(changes)) {
    const ids = syncVttVisuals(doc);
    if (ids.length > 0) out = [...out, { type: 'objects', ids }];
  }
  // Licht leuchtender Props (model/propLights.ts) folgt dem Prop.
  const kandidaten = lichtKandidaten(out);
  if (kandidaten !== undefined && syncPropLights(doc, kandidaten ?? undefined)) {
    out = [...out, { type: 'vtt' }];
  }
  return out;
}

function emit(changes: DocChange[]): void {
  if (changes.length === 0) return;
  for (const fn of listeners) fn(changes);
}

// ---------------------------------------------------------------------------
// Auswahl auf der VTT-Ebene
// ---------------------------------------------------------------------------

/**
 * Die Arten liegen im Dokument in getrennten Arrays, die Auswahl ebenso.
 *
 * `VttKind` kommt aus `commands.ts` und wird hier nur weitergereicht. Zweimal
 * definiert war es einmal zu viel: die Kopie hier hinkte hinterher, als die
 * Notizen dazukamen.
 */
export type { VttKind };

export type VttSelection = Record<VttKind, string[]>;

export function emptyVttSelection(): VttSelection {
  return { walls: [], portals: [], lights: [], notes: [] };
}

export function vttSelectionSize(sel: VttSelection): number {
  return sel.walls.length + sel.portals.length + sel.lights.length + sel.notes.length;
}

/** Wirft aus der Auswahl, was es im Dokument nicht mehr gibt. */
function pruneVttSelection(doc: MapDocument, sel: VttSelection): VttSelection {
  const keep = (kind: VttKind) => {
    const alive = new Set(doc.vtt[kind].map((i) => i.id));
    return sel[kind].filter((id) => alive.has(id));
  };
  return {
    walls: keep('walls'),
    portals: keep('portals'),
    lights: keep('lights'),
    notes: keep('notes'),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface EditorState {
  doc: MapDocument;
  /** Zählt bei jeder Dokumentänderung hoch; erzwingt React-Rerender. */
  rev: number;
  history: History;

  selection: ObjectId[];
  /**
   * Ausgewählte VTT-Elemente, getrennt von `selection` gehalten.
   *
   * Wände, Türen und Lichter sind keine Layer-Objekte: sie liegen in eigenen
   * Arrays, haben keine z-Reihenfolge und werden nie exportiert. Sie in
   * `selection` zu mischen hieße, an jeder Auswertungsstelle erst wieder
   * auseinanderzusortieren.
   */
  vttSelection: VttSelection;
  /** Was das Auswahl-Werkzeug anfassen darf. */
  selectFilter: SelectFilter;
  /**
   * Solo-Ansicht: nur dieser Layer wird gezeichnet, alle anderen sind
   * ausgeblendet. Bewusst Ansichtszustand und keine Dokumentänderung — sonst
   * läge jedes Ein- und Ausschalten im Undo-Verlauf und wanderte mit in die
   * gespeicherte Datei.
   */
  soloLayerId: LayerId | null;
  activeLayerId: LayerId;
  tool: ToolId;

  brush: BrushSettings;
  brushPresets: BrushPreset[];
  draw: DrawSettings;
  text: TextSettings;
  prop: PropSettings;
  terrain: TerrainSettings;
  wall: WallSettings;
  legend: LegendSettings;
  room: RoomSettings;
  opening: OpeningSettings;
  light: LightSettings;
  note: NoteSettings;
  height: HeightSettings;
  region: RegionSettings;
  stamp: StampSettings;
  erase: EraseSettings;
  route: RouteSettings;

  /** Aktives Prop für Platzieren-Werkzeug und Pinsel. */
  activePropId: string | null;
  /**
   * Aktiver Baustein.
   *
   * Nur die Kennung: der Baustein selbst liegt in der Bibliothek neben der
   * Karte. Ihn hier zu halten hieße, zwei Wahrheiten zu pflegen, sobald jemand
   * ihn umbenennt oder löscht.
   */
  activeStampId: string | null;
  /**
   * Angeheftete Props und zuletzt benutzte, beides nur Oberfläche.
   *
   * Sie leben im Store und nicht im Dokument: welche Props jemand gern
   * benutzt, ist eine Gewohnheit des Benutzers und keine Eigenschaft der
   * Karte — mitgespeichert würde sie beim Weitergeben der Datei mitwandern.
   */
  favouriteProps: string[];
  recentProps: string[];

  /** Zoomfaktor der Kamera, nur zur Anzeige — die Wahrheit liegt in der Engine. */
  zoom: number;

  /**
   * Kurze Rückmeldung in der Statuszeile.
   *
   * Werkzeuge brechen sonst still ab, wenn etwa der aktive Layer gesperrt ist —
   * für den Benutzer sieht das aus, als sei die Anwendung kaputt.
   */
  statusMessage: string | null;
  setStatusMessage(message: string | null): void;

  /**
   * Automatisches Speichern.
   *
   * Ansichtszustand, kein Dokumentinhalt: wie oft jemand gesichert haben will,
   * ist eine Gewohnheit und keine Eigenschaft der Karte — mitgespeichert
   * wanderte sie beim Weitergeben der Datei mit.
   */
  /**
   * Spiegeln und Kacheln beim Setzen.
   *
   * Bei den Werkzeugeinstellungen und nicht im Dokument: es ist eine Art zu
   * arbeiten, wie der Rasterfang beim Ziehen, und nicht etwas, das die Karte
   * über sich weiß.
   */
  symmetry: SymmetrySettings;
  patchSymmetry(patch: Partial<SymmetrySettings>): void;
  /**
   * Lineale am Rand der Bühne.
   *
   * Ansichtssache, nicht Karteninhalt: die Hilfslinien selbst stehen im
   * Dokument, ob die Lineale eingeblendet sind, gilt nur für diese Sitzung.
   */
  rulers: boolean;
  setRulers(on: boolean): void;
  autoSave: boolean;
  autoSaveMinutes: number;
  setAutoSave(enabled: boolean): void;
  setAutoSaveMinutes(minutes: number): void;
  /** Änderungszähler beim letzten erfolgreichen Speichern. */
  lastSavedRev: number;
  setLastSavedRev(rev: number): void;
  /**
   * Notiz, deren Text gerade bearbeitet wird — null heißt: kein Dialog offen.
   *
   * Nur die Kennung, nicht die Notiz selbst: die steht im Dokument und wird
   * über Befehle geändert, sonst liefen zwei Wahrheiten nebeneinander.
   */
  editingNoteId: string | null;
  /**
   * Zeichnung, deren Stützpunkte gerade bearbeitet werden — null heißt: keine.
   *
   * Ansichtszustand, kein Dokumentinhalt: das Ein- und Aussteigen soll nicht im
   * Rückgängig-Verlauf landen und nicht mitgespeichert werden. Nur die Kennung,
   * denn das Objekt selbst steht im Dokument.
   */
  editingPathId: ObjectId | null;
  setEditingPathId(id: ObjectId | null): void;
  setEditingNoteId(id: string | null): void;

  exec(cmd: Command): void;
  undo(): void;
  redo(): void;
  /** Klammert einen Ziehvorgang oder Pinselstrich zu einem Undo-Schritt. */
  beginTransaction(): void;
  endTransaction(): void;

  setSelection(ids: ObjectId[]): void;
  toggleSelection(id: ObjectId, additive: boolean): void;
  clearSelection(): void;

  setVttSelection(sel: VttSelection): void;
  toggleVttSelection(kind: VttKind, id: string, additive: boolean): void;
  patchSelectFilter(patch: Partial<SelectFilter>): void;

  setActiveLayer(id: LayerId): void;
  /** Schaltet die Solo-Ansicht für diesen Layer um. */
  toggleSolo(id: LayerId): void;
  setTool(tool: ToolId): void;
  setActiveProp(id: string | null): void;
  setActiveStamp(id: string | null): void;
  toggleFavouriteProp(id: string): void;
  setZoom(z: number): void;

  patchBrush(patch: Partial<BrushSettings>): void;
  patchDraw(patch: Partial<DrawSettings>): void;
  patchText(patch: Partial<TextSettings>): void;
  patchProp(patch: Partial<PropSettings>): void;
  patchStamp(patch: Partial<StampSettings>): void;
  patchErase(patch: Partial<EraseSettings>): void;
  patchRoute(patch: Partial<RouteSettings>): void;
  patchTerrain(patch: Partial<TerrainSettings>): void;
  patchWall(patch: Partial<WallSettings>): void;
  patchLegend(patch: Partial<LegendSettings>): void;
  patchRoom(patch: Partial<RoomSettings>): void;
  patchOpening(patch: Partial<OpeningSettings>): void;
  patchLight(patch: Partial<LightSettings>): void;
  patchNote(patch: Partial<NoteSettings>): void;
  patchHeight(patch: Partial<HeightSettings>): void;
  patchRegion(patch: Partial<RegionSettings>): void;
  addBrushPreset(name: string): void;
  applyBrushPreset(id: string): void;
  removeBrushPreset(id: string): void;

  /** Ersetzt das gesamte Dokument, etwa nach dem Laden einer Projektdatei. */
  loadDocument(doc: MapDocument): void;

  /**
   * Alle Karten der Datei (`model/mappe.ts`); `doc` ist immer
   * `karten[aktiveKarte]`, dasselbe Objekt. Werkzeuge und Renderer sehen nur
   * `doc`.
   */
  karten: MapDocument[];
  aktiveKarte: number;
  /** Lädt eine ganze Mappe, etwa aus einer Projektdatei. */
  ladeMappe(karten: MapDocument[], aktiv?: number): void;
  /** Eine andere Karte der Datei öffnen. Ist keine Änderung an der Datei. */
  wechsleKarte(stelle: number): void;
  /** Eine leere Karte gleicher Größe anhängen und öffnen. */
  neueKarte(name: string): void;
  /** Eine Karte aus der Datei nehmen; Verweise auf sie verschwinden mit. */
  entferneKarte(stelle: number): void;
  benenneKarte(stelle: number, name: string): void;
  /** Wie deutlich die Karten darunter im Editor zu sehen sind (Ansicht, kein Dokument). */
  unterlageDeckkraft: number;
  setUnterlageDeckkraft(wert: number): void;
}

const initialDoc = mitKartenId(createDocument());

/*
 * Jede Karte behält ihren eigenen Rückgängig-Verlauf. Wer in der Etage
 * darunter etwas ändert und zurückkommt, soll hier nicht die Schritte von
 * dort rückgängig machen.
 */
const verlaeufe = new WeakMap<MapDocument, History>();

export const useEditor = create<EditorState>((set, get) => ({
  doc: initialDoc,
  karten: [initialDoc],
  aktiveKarte: 0,
  unterlageDeckkraft: 0.7,
  setUnterlageDeckkraft(wert) {
    set({ unterlageDeckkraft: Math.max(0, Math.min(1, wert)) });
  },
  rev: 0,
  history: new History(),

  selection: [],
  vttSelection: emptyVttSelection(),
  selectFilter: defaultSelectFilter(),
  soloLayerId: null,
  activeLayerId: defaultTargetLayer(initialDoc) ?? initialDoc.rootLayers[0],
  tool: 'select',

  brush: defaultBrush(),
  brushPresets: [],
  draw: defaultDraw(),
  text: defaultText(),
  prop: defaultProp(),
  terrain: defaultTerrain(),
  // Ab Werk mit sichtbarem Mauerwerk: „Wand" ohne etwas Sichtbares ist für
  // die meisten eine Überraschung, und wer nur die Geometrie für Foundry will,
  // stellt den Stil auf „keins".
  wall: { type: 'normal', style: 'stone', senses: null },
  legend: defaultLegend(),
  room: defaultRoom(),
  opening: defaultOpening(),
  light: defaultLight(),
  note: defaultNote(),
  height: defaultHeight(),
  region: defaultRegion(),
  stamp: defaultStamp(),
  erase: defaultErase(),
  route: defaultRoute(),

  activePropId: null,
  activeStampId: null,
  favouriteProps: [],
  recentProps: [],
  zoom: 1,
  statusMessage: null,
  symmetry: defaultSymmetry(),
  rulers: false,
  autoSave: true,
  autoSaveMinutes: DEFAULT_AUTOSAVE_MINUTES,
  lastSavedRev: 0,
  editingNoteId: null,
  editingPathId: null,

  exec(cmd) {
    const { doc, history } = get();
    const changes = mitMauerwerk(doc, history.exec(doc, cmd));
    emit(changes);
    set((s) => ({ rev: s.rev + 1 }));
  },

  beginTransaction() {
    get().history.beginTransaction();
  },

  endTransaction() {
    get().history.endTransaction();
  },

  undo() {
    const { doc, history } = get();
    const changes = history.undo(doc);
    if (!changes) return;
    emit(mitMauerwerk(doc, changes));
    // Objekte können verschwunden sein — verwaiste Auswahl bereinigen.
    set((s) => ({
      rev: s.rev + 1,
      selection: s.selection.filter((id) => !!doc.objects[id]),
      vttSelection: pruneVttSelection(doc, s.vttSelection),
    }));
  },

  redo() {
    const { doc, history } = get();
    const changes = history.redo(doc);
    if (!changes) return;
    emit(mitMauerwerk(doc, changes));
    set((s) => ({
      rev: s.rev + 1,
      selection: s.selection.filter((id) => !!doc.objects[id]),
      vttSelection: pruneVttSelection(doc, s.vttSelection),
    }));
  },

  setSelection(ids) {
    // Wer etwas anderes auswählt, bearbeitet den alten Pfad nicht mehr. Ohne
    // das blieben die Griffe an einem Objekt stehen, das gar nicht mehr
    // ausgewählt ist.
    // Mauerwerk einer Wand ist nicht einzeln wählbar (model/vttVisuals.ts),
    // auch nicht über „Alles auswählen".
    const doc = get().doc;
    ids = ids.filter((id) => {
      const o = doc.objects[id];
      return !(o && o.kind === 'shape' && o.vttLink);
    });
    set((s) => ({
      selection: ids,
      editingPathId:
        s.editingPathId && ids.includes(s.editingPathId) ? s.editingPathId : null,
    }));
  },

  toggleSelection(id, additive) {
    set((s) => {
      if (!additive) return { selection: [id] };
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] };
    });
  },

  clearSelection() {
    set({ selection: [], vttSelection: emptyVttSelection(), editingPathId: null });
  },

  setVttSelection(sel) {
    set({ vttSelection: sel });
  },

  toggleVttSelection(kind, id, additive) {
    set((s) => {
      const current = s.vttSelection[kind];
      if (!additive) {
        return { vttSelection: { ...emptyVttSelection(), [kind]: [id] }, selection: [] };
      }
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { vttSelection: { ...s.vttSelection, [kind]: next } };
    });
  },

  patchSelectFilter(patch) {
    set((s) => ({ selectFilter: { ...s.selectFilter, ...patch } }));
  },

  toggleSolo(id) {
    set((s) => ({ soloLayerId: s.soloLayerId === id ? null : id }));
    emit([{ type: 'layers' }]);
  },

  setActiveLayer(id) {
    if (id === SYSTEM_GRID || id === SYSTEM_VTT) return;
    set({ activeLayerId: id });
  },

  setTool(tool) {
    set({ tool });
  },

  setActiveProp(id) {
    set((s) => {
      if (id === null) return { activePropId: null };
      // Zuletzt benutzt: nach vorn, Dubletten raus, Liste kurz halten.
      const recent = [id, ...s.recentProps.filter((x) => x !== id)].slice(0, 12);
      return { activePropId: id, recentProps: recent };
    });
  },

  setActiveStamp(id) {
    set({ activeStampId: id });
  },

  toggleFavouriteProp(id) {
    set((s) => ({
      favouriteProps: s.favouriteProps.includes(id)
        ? s.favouriteProps.filter((x) => x !== id)
        : [...s.favouriteProps, id],
    }));
  },

  setZoom(z) {
    // Auch hier kein set() ohne Änderung: der Wert wird bei jedem Einpassen
    // und jedem Radschritt geschrieben, oft mit demselben Zoom.
    if (get().zoom === z) return;
    set({ zoom: z });
  },

  setEditingNoteId(id) {
    set({ editingNoteId: id });
  },

  setEditingPathId(id) {
    // Kein Schreiben ohne Änderung: jedes set() benachrichtigt sämtliche
    // Abnehmer, und dieser Aufruf läuft bei jedem Werkzeugwechsel mit.
    if (get().editingPathId === id) return;
    set({ editingPathId: id });
  },
  patchSymmetry(patch) {
    set((s) => ({ symmetry: { ...s.symmetry, ...patch } }));
  },

  setRulers(on) {
    set({ rulers: on });
  },

  setAutoSave(enabled) {
    set({ autoSave: enabled });
  },
  setAutoSaveMinutes(minutes) {
    set({ autoSaveMinutes: clampInterval(minutes) });
  },
  setLastSavedRev(rev) {
    set({ lastSavedRev: rev });
  },
  setStatusMessage(message) {
    // Kein Schreiben ohne Änderung. Werkzeuge räumen beim Wechsel ihre Meldung
    // weg, oft mit demselben Wert, der schon dasteht; jedes set() benachrichtigt
    // dagegen sämtliche Abnehmer — darunter der ToolManager.
    if (get().statusMessage === message) return;
    set({ statusMessage: message });
    if (message === null) return;
    // Nach kurzer Zeit wieder verschwinden, aber nur, wenn inzwischen keine
    // neuere Meldung gesetzt wurde.
    setTimeout(() => {
      if (get().statusMessage === message) set({ statusMessage: null });
    }, 5000);
  },

  patchBrush(patch) {
    set((s) => ({ brush: { ...s.brush, ...patch } }));
  },
  patchDraw(patch) {
    set((s) => ({ draw: { ...s.draw, ...patch } }));
  },
  patchText(patch) {
    set((s) => ({ text: { ...s.text, ...patch } }));
  },
  patchProp(patch) {
    set((s) => ({ prop: { ...s.prop, ...patch } }));
  },

  patchStamp(patch) {
    set((s) => ({ stamp: { ...s.stamp, ...patch } }));
  },

  patchErase(patch) {
    set((s) => ({ erase: { ...s.erase, ...patch } }));
  },

  patchRoute(patch) {
    set((s) => ({ route: { ...s.route, ...patch } }));
  },

  patchTerrain(patch) {
    set((s) => ({ terrain: { ...s.terrain, ...patch } }));
  },

  patchWall(patch) {
    set((s) => ({ wall: { ...s.wall, ...patch } }));
  },

  patchLegend(patch) {
    set((s) => ({ legend: { ...s.legend, ...patch } }));
  },

  patchRoom(patch) {
    set((s) => ({ room: { ...s.room, ...patch } }));
  },
  patchOpening(patch) {
    set((s) => ({ opening: { ...s.opening, ...patch } }));
  },
  patchLight(patch) {
    set((s) => ({ light: { ...s.light, ...patch } }));
  },
  patchNote(patch) {
    set((s) => ({ note: { ...s.note, ...patch } }));
  },
  patchHeight(patch) {
    set((s) => ({ height: { ...s.height, ...patch } }));
  },
  patchRegion(patch) {
    set((s) => ({ region: { ...s.region, ...patch } }));
  },

  addBrushPreset(name) {
    set((s) => ({
      brushPresets: [
        ...s.brushPresets,
        { id: `bp_${Date.now().toString(36)}`, name, settings: { ...s.brush } },
      ],
    }));
  },

  applyBrushPreset(id) {
    const preset = get().brushPresets.find((p) => p.id === id);
    if (preset) set({ brush: { ...preset.settings } });
  },

  removeBrushPreset(id) {
    set((s) => ({ brushPresets: s.brushPresets.filter((p) => p.id !== id) }));
  },

  loadDocument(doc) {
    get().ladeMappe([doc], 0);
  },

  ladeMappe(karten, aktiv = 0) {
    get().history.clear();
    const liste = karten.length ? karten.slice(0, MAX_KARTEN) : [createDocument()];
    eindeutigeIds(liste);
    for (const doc of liste) {
      // Alte Karten: loses Mauerwerk an seine Wand haengen, dann ableiten.
      verknuepfeAltesMauerwerk(doc);
      syncVttVisuals(doc);
      syncPropLights(doc);
    }
    const stelle = Math.max(0, Math.min(aktiv, liste.length - 1));
    const doc = liste[stelle];
    const history = new History();
    verlaeufe.set(doc, history);
    set({
      doc,
      karten: liste,
      aktiveKarte: stelle,
      history,
      rev: get().rev + 1,
      selection: [],
      vttSelection: emptyVttSelection(),
      editingNoteId: null,
      activeLayerId: defaultTargetLayer(doc) ?? doc.rootLayers[0],
    });
    emit([{ type: 'all' }]);
  },

  wechsleKarte(stelle) {
    const s = get();
    const doc = s.karten[stelle];
    if (!doc || stelle === s.aktiveKarte) return;
    verlaeufe.set(s.doc, s.history);
    const history = verlaeufe.get(doc) ?? new History();
    verlaeufe.set(doc, history);
    // Wechseln ist keine Bearbeitung: war die Datei gespeichert, bleibt sie es.
    const sauber = s.rev === s.lastSavedRev;
    set({
      doc,
      aktiveKarte: stelle,
      history,
      rev: s.rev + 1,
      ...(sauber ? { lastSavedRev: s.rev + 1 } : {}),
      selection: [],
      vttSelection: emptyVttSelection(),
      editingNoteId: null,
      soloLayerId: null,
      activeLayerId: defaultTargetLayer(doc) ?? doc.rootLayers[0],
    });
    emit([{ type: 'all' }]);
  },

  neueKarte(name) {
    const s = get();
    if (s.karten.length >= MAX_KARTEN) return;
    const neu = neueKarteWie(s.doc, name);
    set({ karten: [...s.karten, neu], rev: s.rev + 1 });
    // Das Anlegen hat `rev` schon erhöht, die Datei gilt also als geändert.
    get().wechsleKarte(s.karten.length);
  },

  entferneKarte(stelle) {
    const s = get();
    const weg = s.karten[stelle];
    if (!weg || s.karten.length <= 1) return;
    const karten = s.karten.filter((_, i) => i !== stelle);
    entferneVerweiseAuf(karten, weg.meta.id ?? '');
    if (stelle !== s.aktiveKarte) {
      set({ karten, aktiveKarte: s.aktiveKarte > stelle ? s.aktiveKarte - 1 : s.aktiveKarte, rev: s.rev + 1 });
      return;
    }
    // Die offene Karte geht: die Nachbarin übernimmt.
    const naechste = Math.min(stelle, karten.length - 1);
    const doc = karten[naechste];
    const history = verlaeufe.get(doc) ?? new History();
    set({
      karten,
      doc,
      aktiveKarte: naechste,
      history,
      rev: s.rev + 1,
      selection: [],
      vttSelection: emptyVttSelection(),
      editingNoteId: null,
      soloLayerId: null,
      activeLayerId: defaultTargetLayer(doc) ?? doc.rootLayers[0],
    });
    emit([{ type: 'all' }]);
  },

  benenneKarte(stelle, name) {
    const s = get();
    const k = s.karten[stelle];
    if (!k || !name.trim() || k.meta.name === name) return;
    k.meta.name = name;
    set({ karten: [...s.karten], rev: s.rev + 1 });
  },
}));

/** Direktzugriff außerhalb von React-Komponenten (Werkzeuge, Renderer). */
export const editor = {
  get state() {
    return useEditor.getState();
  },
  get doc() {
    return useEditor.getState().doc;
  },
};

/*
 * Die Sprache wechselt (die Huelle sagt sie oft erst nach dem Laden): die
 * Standardnamen ziehen mit, eigene Namen bleiben. Ein ungeaendertes Dokument
 * bleibt dabei ungeaendert — der Name ist keine Bearbeitung.
 */
onLanguageChange(() => {
  useEditor.setState((s) => {
    const doc = uebersetzeStandardnamen(s.doc);
    if (doc === s.doc) return {};
    const sauber = s.rev === s.lastSavedRev;
    // `doc` ist ein neues Objekt: in der Mappe und beim Verlauf mitziehen.
    verlaeufe.set(doc, s.history);
    const karten = s.karten.map((k, i) => (i === s.aktiveKarte ? doc : k));
    return { doc, karten, rev: s.rev + 1, ...(sauber ? { lastSavedRev: s.rev + 1 } : {}) };
  });
});
