/**
 * Verbindet DOM-Eingaben mit dem aktiven Werkzeug.
 *
 * Hier liegt auch alles, was werkzeugübergreifend gilt: Zoomen, temporäres
 * Schwenken mit Leertaste oder mittlerer Maustaste, Tastenkürzel, Copy/Paste.
 */

import {
  AddObjects,
  CompositeCommand,
  RemoveObjects,
  RemoveVttItems,
  ReorderObjects,
  SetObjectGroup,
  type Command,
} from '@/model/commands';
import { makeId } from '@/model/ids';
import { withAnchoredLabels } from '@/model/labelAnchor';
import { canHoldObjects, defaultTargetLayer, isObjectEditable } from '@/model/document';
import { useEditor, vttSelectionSize } from '@/model/store';
import type { MapObject } from '@/model/types';
import { type ToolId } from '@/model/toolSettings';
import { bindingLookup, comboOf, type KeyAction } from '@/model/keyBindings';
import { allBindings, onBindingsChange } from '@/assets/keyBindingStore';
import type { MapRenderer } from '@/engine/renderer';
import { BrushTool } from './brush';
import { DrawTool } from './draw';
import { LightTool } from './light';
import { NoteTool } from './note';
import { HeightTool } from './height';
import { RegionTool } from './region';
import { EraseTool } from './erase';
import { RouteTool } from './route';
import { StampTool } from './stamp';
import { MeasureTool } from './measure';
import { PanTool } from './pan';
import { PortalTool } from './portal';
import { PropTool } from './prop';
import { RoomTool } from './room';
import { TerrainTool } from './terrainPaint';
import { SelectTool } from './select';
import { TextTool } from './text';
import { WallTool } from './wall';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { radDrehBefehl, radSchritt } from './radDrehung';
import { t } from '@/i18n';

/** Interne Zwischenablage — die System-Zwischenablage kann keine Objekte halten. */
let clipboard: MapObject[] = [];



export class ToolManager {
  private tools: Partial<Record<ToolId, Tool>>;
  private panTool = new PanTool();
  private ctx: ToolContext;

  private activeId: ToolId = 'select';
  /** Aktiv, solange Leertaste oder mittlere Maustaste das Schwenken erzwingt. */
  private forcedPan = false;
  private spaceDown = false;
  private lastScreen = { x: 0, y: 0 };
  private pointerDown = false;
  /** Läuft gerade ein Werkzeugwechsel? Sperrt den Weg zurück durch `deactivate`. */
  private switching = false;
  /**
   * Kombination auf Handlung, einmal umgedreht.
   *
   * Neu gebaut, sobald sich die Belegung ändert — bei jedem Tastendruck die
   * ganze Tabelle zu durchsuchen wäre Arbeit für nichts.
   */
  private lookup = bindingLookup(allBindings());
  private detachers: Array<() => void> = [];

  constructor(
    private renderer: MapRenderer,
    private host: HTMLElement,
  ) {
    this.tools = {
      select: new SelectTool(),
      pan: this.panTool,
      prop: new PropTool(),
      brush: new BrushTool(),
      draw: new DrawTool(),
      text: new TextTool(),
      wall: new WallTool(),
      room: new RoomTool(),
      terrain: new TerrainTool(),
      door: new PortalTool('door'),
      window: new PortalTool('window'),
      light: new LightTool(),
      note: new NoteTool(),
      height: new HeightTool(),
      region: new RegionTool(),
      measure: new MeasureTool(),
      stamp: new StampTool(),
      erase: new EraseTool(),
      route: new RouteTool(),
    };

    this.ctx = {
      renderer,
      get doc() {
        return useEditor.getState().doc;
      },
      get state() {
        return useEditor.getState();
      },
      exec: (cmd) => useEditor.getState().exec(cmd),
      beginTransaction: () => useEditor.getState().beginTransaction(),
      endTransaction: () => useEditor.getState().endTransaction(),
      requestRender: () => {
        /* Der Ticker rendert ohnehin jeden Frame. */
      },
    };
  }

  attach(): void {
    const canvas = this.renderer.app.canvas;
    canvas.style.touchAction = 'none';

    const onDown = (e: PointerEvent) => this.handleDown(e);
    const onMove = (e: PointerEvent) => this.handleMove(e);
    const onUp = (e: PointerEvent) => this.handleUp(e);
    const onWheel = (e: WheelEvent) => this.handleWheel(e);
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onDouble = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.activeTool?.onDoubleClick?.(this.makeEvent(e), this.ctx);
    };
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
    const onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContext);
    canvas.addEventListener('dblclick', onDouble);
    const offBindings = onBindingsChange(() => {
      this.lookup = bindingLookup(allBindings());
    });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this.detachers = [
      () => canvas.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => canvas.removeEventListener('wheel', onWheel),
      () => canvas.removeEventListener('contextmenu', onContext),
      () => canvas.removeEventListener('dblclick', onDouble),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      useEditor.subscribe((s) => this.syncTool(s.tool)),
      offBindings,
    ];

    this.applyCursor();
  }

  /** Welches Werkzeug der Manager gerade bedient — die Wahrheit, nicht der Store. */
  get tool(): ToolId {
    return this.activeId;
  }

  /**
   * Zieht das Werkzeug des Stores nach.
   *
   * Eigene Methode und keine Closure in `attach()`: so lässt sich der Weg über
   * die Subscription im Test nachstellen, ohne einen Browser zu brauchen — und
   * an genau diesem Weg hing der Fehler oben.
   */
  syncTool(tool: ToolId): void {
    if (tool !== this.activeId) this.setTool(tool);
  }

  detach(): void {
    for (const d of this.detachers) d();
    this.detachers = [];
  }

  /**
   * Werkzeug wechseln.
   *
   * **Erst umschalten, dann abräumen — die Reihenfolge ist der ganze Punkt.**
   * `deactivate()` darf den Store anfassen: das Textwerkzeug schreibt seinen
   * Text fest, das Auswahl-Werkzeug beendet die Pfadbearbeitung. Jede
   * Store-Änderung ruft aber die Subscription unten in `attach()` auf, und die
   * vergleicht `s.tool` mit `this.activeId`. Stünde die Zuweisung *hinter*
   * dem `deactivate()`, sähe sie dort noch das alte Werkzeug, riefe erneut
   * `setTool` — und so weiter, bis der Aufrufstapel voll ist.
   *
   * Genau das ist passiert: ein `RangeError` beim ersten Werkzeugwechsel, der
   * Manager blieb auf `select` stehen, und jeder Klick auf die Karte wählte nur
   * noch aus, statt zu platzieren. Sichtbar war davon nichts außer einem Fehler
   * in der Konsole — die Werkzeugleiste zeigte das neue Werkzeug an, denn im
   * Store *war* es gewechselt.
   *
   * Der Wächter kommt dazu, weil die Reihenfolge allein nur diesen einen Weg
   * absichert: ein `deactivate`, das selbst ein Werkzeug wählt, käme sonst
   * mitten im Abräumen wieder herein.
   */
  setTool(id: ToolId): void {
    if (id === this.activeId || this.switching) return;
    const vorheriges = this.activeId;
    this.activeId = id;
    this.switching = true;
    try {
      this.tools[vorheriges]?.deactivate?.(this.ctx);
    } finally {
      this.switching = false;
    }
    this.applyCursor();
  }

  // -------------------------------------------------------------------------
  // Zeigereingaben
  // -------------------------------------------------------------------------

  private get activeTool(): Tool | undefined {
    if (this.forcedPan) return this.panTool;
    return this.tools[this.activeId];
  }

  private makeEvent(e: PointerEvent | MouseEvent): ToolPointerEvent {
    const rect = this.renderer.app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const world = this.renderer.camera.screenToWorld(sx, sy);
    const delta = { x: sx - this.lastScreen.x, y: sy - this.lastScreen.y };
    this.lastScreen = { x: sx, y: sy };
    return {
      world,
      screen: { x: sx, y: sy },
      deltaScreen: delta,
      button: e.button,
      buttons: e.buttons,
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
      pressure: 'pressure' in e ? e.pressure || 0.5 : 0.5,
      preventDefault: () => e.preventDefault(),
    };
  }

  private handleDown(e: PointerEvent): void {
    this.host.focus?.();
    // Position zuerst setzen, damit das erste Delta nicht aus dem Nichts springt.
    const rect = this.renderer.app.canvas.getBoundingClientRect();
    this.lastScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (e.button === 1 || this.spaceDown) {
      this.forcedPan = true;
      this.applyCursor();
    }
    this.pointerDown = true;
    try {
      // Wirft, wenn der Zeiger nicht (mehr) aktiv ist — kein Grund, den
      // gesamten Klick fallenzulassen.
      this.renderer.app.canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* Ohne Capture funktioniert das Ziehen über die window-Listener weiter. */
    }
    this.activeTool?.onPointerDown?.(this.makeEvent(e), this.ctx);
  }

  private handleMove(e: PointerEvent): void {
    // Bewegung außerhalb des Canvas nur verfolgen, wenn gerade gezogen wird.
    if (!this.pointerDown && e.target !== this.renderer.app.canvas) return;
    this.activeTool?.onPointerMove?.(this.makeEvent(e), this.ctx);
  }

  private handleUp(e: PointerEvent): void {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    this.activeTool?.onPointerUp?.(this.makeEvent(e), this.ctx);
    if (this.forcedPan && !this.spaceDown) {
      this.forcedPan = false;
      this.applyCursor();
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.renderer.app.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Alt+Rad verstellt die Pinselgröße statt zu zoomen — spart den Weg ins Panel.
    if (e.altKey && this.activeId === 'brush') {
      const s = useEditor.getState().brush;
      const next = Math.max(4, Math.min(2000, s.radius * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      useEditor.getState().patchBrush({ radius: next });
      return;
    }

    // Shift+Rad dreht die Auswahl, Strg+Shift fein (tools/radDrehung.ts).
    // Manche Browser melden Shift+Rad als waagerechtes Rollen, darum deltaX mit.
    if (e.shiftKey) {
      const state = useEditor.getState();
      const richtung = Math.sign(e.deltaY || e.deltaX);
      if (state.selection.length > 0 && richtung !== 0) {
        const grad = richtung * radSchritt(state.doc, e.ctrlKey);
        const befehl = radDrehBefehl(state.doc, state.selection, grad, this.renderer.textMetrics);
        if (befehl) state.exec(befehl);
        return;
      }
    }

    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.renderer.camera.zoomAt(sx, sy, factor);
    useEditor.getState().setZoom(this.renderer.camera.zoom);
  }

  // -------------------------------------------------------------------------
  // Tastatur
  // -------------------------------------------------------------------------

  /**
   * Ein Tastendruck.
   *
   * Früher stand hier eine Kette von Abfragen — erst Strg+Z, dann Strg+Y, dann
   * Strg+C. Jetzt wird die Kombination einmal in ihre festgelegte Schreibweise
   * gebracht und in der Belegung nachgeschlagen; was danach folgt, ist nur noch
   * die Handlung selbst. Nur so ließ sich die Belegung überhaupt umbelegbar
   * machen, ohne sie an zwei Stellen zu führen.
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    // In Eingabefeldern gehören die Tasten dem Feld, nicht dem Editor.
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    // Das aktive Werkzeug zuerst: es kennt Tasten, die nur in seinem Ablauf
    // etwas bedeuten (Enter beendet einen Wandzug, C schließt ihn).
    if (this.activeTool?.onKeyDown?.(e, this.ctx)) {
      e.preventDefault();
      return;
    }

    // Die Leertaste ist kein Kürzel, sondern ein Halten: sie schaltet, solange
    // sie gedrückt ist, und lässt sich darum nicht wie die anderen belegen.
    if (e.code === 'Space' && !this.spaceDown) {
      this.spaceDown = true;
      this.forcedPan = true;
      this.applyCursor();
      e.preventDefault();
      return;
    }

    const action = this.lookup[comboOf(e)];
    if (!action) return;
    if (this.runAction(action)) e.preventDefault();
  }

  /** Führt eine belegte Handlung aus; falsch heißt „nichts zu tun". */
  private runAction(action: KeyAction): boolean {
    const state = useEditor.getState();

    if (action.startsWith('tool.')) {
      state.setTool(action.slice(5) as ToolId);
      return true;
    }

    switch (action) {
      case 'edit.undo':
        state.undo();
        return true;
      case 'edit.redo':
        state.redo();
        return true;
      case 'edit.copy':
        this.copy();
        return true;
      case 'edit.paste':
        this.paste();
        return true;
      case 'edit.duplicate':
        this.duplicate();
        return true;
      case 'edit.selectAll':
        state.setSelection(
          Object.keys(state.doc.objects).filter((id) => !state.doc.objects[id].locked),
        );
        return true;
      case 'edit.deselect':
        state.clearSelection();
        return true;
      case 'edit.delete':
        return this.deleteSelection();
      case 'edit.group':
        if (state.selection.length > 1) {
          state.exec(new SetObjectGroup(state.selection, makeId('grp'), t('cmd.groupObjects')));
        }
        return true;
      case 'edit.ungroup':
        if (state.selection.length > 0) {
          state.exec(new SetObjectGroup(state.selection, null, t('cmd.ungroupObjects')));
        }
        return true;
      case 'edit.front':
        if (state.selection.length > 0) state.exec(new ReorderObjects(state.selection, true));
        return true;
      case 'edit.back':
        if (state.selection.length > 0) state.exec(new ReorderObjects(state.selection, false));
        return true;
      // Speichern hängt am Datei-Menü: nur dort gibt es das Dateiziel und den
      // Dialog. Der Manager meldet den Wunsch, gemacht wird es woanders.
      case 'file.save':
      case 'file.saveAs':
        window.dispatchEvent(new CustomEvent('ttmap-key-action', { detail: action }));
        return true;
    }
    return false;
  }

  /** Auswahl löschen — Objekte und VTT-Elemente in einem Undo-Schritt. */
  private deleteSelection(): boolean {
    const state = useEditor.getState();
    const vtt = state.vttSelection;
    const parts: Command[] = [];
    // Nur löschen, was auch anfassbar ist: ein gesperrter Layer schützt seinen
    // Inhalt sonst nur gegen die Maus, nicht gegen die Entf-Taste. Mit dem
    // Objekt geht seine Beschriftung: eine Bezeichnung ohne das Bezeichnete
    // stünde sonst allein auf der Karte.
    const loeschbar = withAnchoredLabels(state.doc, state.selection).filter((id) =>
      isObjectEditable(state.doc, id),
    );
    if (loeschbar.length > 0) {
      parts.push(new RemoveObjects(loeschbar, t('cmd.removeObjects')));
    }
    if (vttSelectionSize(vtt) > 0) {
      parts.push(
        new RemoveVttItems(
          { walls: vtt.walls, portals: vtt.portals, lights: vtt.lights },
          t('cmd.removeVttItems'),
        ),
      );
    }
    if (parts.length === 1) state.exec(parts[0]);
    else if (parts.length > 1) state.exec(new CompositeCommand(parts, t('cmd.removeSelection')));
    if (parts.length > 0) state.clearSelection();
    return true;
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.spaceDown = false;
      if (!this.pointerDown) {
        this.forcedPan = false;
        this.applyCursor();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Zwischenablage
  // -------------------------------------------------------------------------

  private copy(): void {
    const { doc, selection } = useEditor.getState();
    clipboard = selection
      .map((id) => doc.objects[id])
      .filter(Boolean)
      .map((o) => structuredClone(o));
  }

  private paste(): void {
    if (clipboard.length === 0) return;
    const state = useEditor.getState();
    /**
     * Ziel-Layer: der aktive, sonst der Herkunfts-Layer, sonst irgendein
     * offener.
     *
     * Der Herkunfts-Layer kann inzwischen gesperrt sein — dort einzufügen
     * legte Objekte ab, die sich nicht mehr anfassen lassen. Gibt es gar keinen
     * offenen Layer, wird nicht eingefügt und die Statuszeile sagt es; still
     * nichts zu tun sähe nach einem kaputten Strg+V aus.
     */
    const layerId = canHoldObjects(state.doc, state.activeLayerId)
      ? state.activeLayerId
      : canHoldObjects(state.doc, clipboard[0].layerId)
        ? clipboard[0].layerId
        : defaultTargetLayer(state.doc);
    if (!layerId) {
      state.setStatusMessage(t('status.layerLocked'));
      return;
    }

    // Relative Anordnung erhalten: die Auswahl wird als Ganzes zum Mauszeiger
    // versetzt, nicht jedes Objekt einzeln dorthin gelegt.
    const target = this.renderer.camera.screenToWorld(this.lastScreen.x, this.lastScreen.y);
    let cx = 0;
    let cy = 0;
    for (const o of clipboard) {
      cx += o.x;
      cy += o.y;
    }
    cx /= clipboard.length;
    cy /= clipboard.length;

    const copies = clipboard.map(
      (o) =>
        ({
          ...structuredClone(o),
          id: makeId('obj'),
          layerId,
          x: o.x - cx + target.x,
          y: o.y - cy + target.y,
        }) as MapObject,
    );
    state.exec(new AddObjects(copies, t('cmd.paste')));
    state.setSelection(copies.map((c) => c.id));
  }

  private duplicate(): void {
    const state = useEditor.getState();
    const offset = state.doc.grid.tileSize * 0.25;
    const copies = state.selection
      // Nur, was sich auch anfassen lässt: eine Kopie auf einem gesperrten
      // Layer wäre sofort unerreichbar.
      .filter((id) => isObjectEditable(state.doc, id))
      .map((id) => state.doc.objects[id])
      .filter(Boolean)
      .map(
        (o) =>
          ({
            ...structuredClone(o),
            id: makeId('obj'),
            x: o.x + offset,
            y: o.y + offset,
          }) as MapObject,
      );
    if (copies.length === 0) return;
    state.exec(new AddObjects(copies, t('cmd.duplicate')));
    state.setSelection(copies.map((c) => c.id));
  }

  private applyCursor(): void {
    const tool = this.activeTool;
    this.renderer.app.canvas.style.cursor = this.forcedPan ? 'grabbing' : (tool?.cursor ?? 'default');
  }
}
