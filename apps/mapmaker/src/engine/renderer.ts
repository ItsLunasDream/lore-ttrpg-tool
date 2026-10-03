/**
 * Pixi-Renderer.
 *
 * Der Renderer besitzt das Dokument nicht, er spiegelt es. Änderungen kommen als
 * feinkörnige DocChange-Ereignisse herein und werden gezielt angewandt: ein
 * verschobenes Prop aktualisiert genau ein Sprite, nicht die ganze Szene.
 */

/**
 * Muss vor jedem anderen Pixi-Import stehen.
 *
 * Pixi baut seine Shader-Programme zur Laufzeit mit `new Function` zusammen.
 * Unter einer Content-Security-Policy ohne `unsafe-eval` verweigert der
 * Browser das, und die Bühne startet gar nicht erst — mit genau dem Hinweis
 * auf dieses Modul. Es ersetzt die erzeugten Funktionen durch eine langsamere,
 * aber gleichwertige Variante ohne Codeerzeugung.
 *
 * Der Name führt in die Irre: das Modul *erlaubt* kein `unsafe-eval`, es macht
 * es überflüssig. Ohne diesen Import müsste die Richtlinie in
 * `vite.config.ts` `unsafe-eval` zulassen — und damit die eine Regel
 * aufweichen, deretwegen es sie gibt.
 */
import 'pixi.js/unsafe-eval';
import {
  Application,
  Container,
  Culler,
  Graphics,
  Matrix,
  RenderTexture,
  Sprite,
  Text,
  Texture,
  type BLEND_MODES,
} from 'pixi.js';
import {
  subscribeChanges,
  useEditor,
  vttSelectionSize,
  type VttSelection,
} from '@/model/store';
import type { DocChange } from '@/model/commands';
import { flattenLayers, isEffectivelyVisible } from '@/model/document';
import { mapPixelSize } from '@/model/grid';
import { dashPolyline } from '@/model/geometry';
import { arcPath, layoutOnPath } from '@/model/textPath';
import { pathNodes } from '@/model/pathEdit';
import { dayLengthInPixels, markLength, routeMarks } from '@/model/routeMarks';
import { buildFilters } from './buildFilters';
import { buildGradient } from './buildGradient';
import { buildPattern } from './buildPattern';
import type { ToolId } from '@/model/toolSettings';
import {
  SYSTEM_GRID,
  SYSTEM_VTT,
  type LayerId,
  type MapDocument,
  type MapObject,
  type ObjectId,
  type ShapeObject,
  type TextObject,
} from '@/model/types';
import { getProp, onLibraryChange } from '@/assets/library';
import { Camera } from './camera';
import { GridOverlay } from './gridOverlay';
import { GuideOverlay } from './guideOverlay';
import { VttOverlay } from './vttOverlay';
import { HeightLayerView } from './heightLayer';
import { getPropTexture, onTextureReady, variantFor } from './propTextures';
import {
  groupHandles,
  halfExtents,
  objectCenter,
  objectHandles,
  selectionBounds,
  tileScale,
  worldAABB,
  type Handle,
  type TextMetrics,
} from './hitTest';

interface ObjectView {
  node: Container;
  /** Erkennt, wann ein Sprite neu gebaut werden muss statt nur aktualisiert. */
  key: string;
}

/**
 * Werkzeuge, die an der VTT-Ebene arbeiten.
 *
 * Das Notiz-Werkzeug gehört dazu: Notiz-Pins liegen ebenfalls dort und wären
 * sonst beim Setzen unsichtbar.
 */
const VTT_TOOLS = new Set<ToolId>(['wall', 'room', 'door', 'window', 'light', 'note']);

export class MapRenderer {
  readonly app = new Application();
  readonly camera = new Camera();

  /** Alles, worauf die Kameratransformation wirkt. */
  readonly world = new Container();
  /** Auswahlrahmen, Pinselvorschau — ebenfalls in Weltkoordinaten. */
  readonly overlay = new Container();
  /** Vom Renderer gemessene Textmaße, die das Modell nicht kennen kann. */
  readonly textMetrics: TextMetrics = new Map();

  private mapBackground = new Graphics();
  /**
   * Die Karten darunter (`model/mappe.ts`), als fertige Bilder: der Renderer
   * spiegelt nur ein Dokument, die anderen kommen als Bild herein
   * (`setzeUnterlage`). Geht nie in einen Export.
   */
  private unterlage = new Container();
  private unterlageTexturen: Texture[] = [];
  private stack = new Container();
  private gridOverlay = new GridOverlay();
  private vttOverlay = new VttOverlay();
  private guideOverlay = new GuideOverlay();
  private selectionGfx = new Graphics();
  /** Woran zuletzt gezeichnet wurde — siehe `drawSelection`. */
  private lastSelectionRef: unknown = null;
  private lastVttSelectionRef: unknown = null;
  private lastSelectionState = '';
  private vignetteGfx = new Graphics();
  /** Zuletzt gesetzte globale Filter, als Zeichenkette — spart das Neubauen je Frame. */
  private globalFilterKey = '';
  /** Kamera- und Bestandszustand beim letzten Culling-Durchgang. */
  private lastCullState = '';

  private layerContainers = new Map<LayerId, Container>();
  /** Rasterebenen; je Höhen-Layer eine eigene Ansicht. */
  private heightViews = new Map<LayerId, HeightLayerView>();
  private dirtyHeights = new Map<LayerId, { minRow: number; maxRow: number } | null>();
  private objectViews = new Map<ObjectId, ObjectView>();
  /**
   * Objekte, die ein Werkzeug vorübergehend ausblendet.
   *
   * Bewusst *nicht* im Dokument. Das Textwerkzeug versteckte den Originaltext
   * während der Eingabe über einen Befehl, damit er nicht doppelt dasteht —
   * und schrieb damit „Deckkraft 0" in den Verlauf. Ein einziges Rückgängig
   * nach dem Umbenennen landete dann genau dazwischen: alter Text, unsichtbar.
   * Sichtbarkeit auf Zeit ist Sache der Anzeige, nicht der Karte.
   */
  private hiddenObjects = new Set<ObjectId>();

  private unsubscribers: Array<() => void> = [];
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private onWindowResize: () => void = () => {};
  /** Solange die Bühne noch nie eine gültige Größe hatte, muss neu eingepasst werden. */
  private awaitingFirstFit = true;
  private frameErrorLogged = false;
  /** Neu zu zeichnende Objekte, gesammelt bis zum nächsten Frame. */
  private dirtyObjects = new Set<ObjectId>();
  private dirtyLayers = false;
  private dirtyCanvas = false;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x14141a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
    });
    this.attachTo(host);

    this.world.addChild(this.unterlage, this.mapBackground, this.stack, this.vignetteGfx, this.overlay);
    // Hilfslinien in das Overlay, nicht in den Layer-Stapel: sie gehören
    // niemandem und gehen in keinen Export. `hide(this.overlay)` beim Export
    // nimmt sie damit gleich mit heraus.
    this.overlay.addChild(this.guideOverlay.view, this.selectionGfx);
    this.app.stage.addChild(this.world);

    this.initialized = true;
    this.rebuildAll();

    this.unsubscribers.push(
      subscribeChanges((changes) => this.onChanges(changes)),
      onTextureReady((propId) => this.onTextureReady(propId)),
      onLibraryChange(() => this.markAllObjectsDirty()),
    );

    this.app.ticker.add(() => this.frame());
  }

  /**
   * Hängt den Canvas in ein (neues) Host-Element und beobachtet dessen Größe.
   *
   * Bewusst ein ResizeObserver statt Pixis `resizeTo`: das hört nur auf
   * Fenster-Resize. Wird die Ansicht ein- oder ausgeblendet oder ändert sich
   * die Panelbreite, bleibt der Canvas sonst auf der alten — womöglich auf
   * einer Null-Größe — stehen und verschwindet.
   */
  attachTo(host: HTMLElement): void {
    if (this.app.canvas.parentElement !== host) host.appendChild(this.app.canvas);

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.applyHostSize(host));
    this.resizeObserver.observe(host);

    // Zusätzlich am Fenster horchen: ResizeObserver-Meldungen kommen erst zum
    // Frame-Ende und werden in nicht sichtbaren Tabs gedrosselt.
    window.removeEventListener('resize', this.onWindowResize);
    this.onWindowResize = () => this.applyHostSize(host);
    window.addEventListener('resize', this.onWindowResize);

    this.applyHostSize(host);
  }

  private applyHostSize(host: HTMLElement): void {
    const w = Math.floor(host.clientWidth);
    const h = Math.floor(host.clientHeight);
    // Null-Messungen ignorieren — sie kommen beim Ein-/Ausblenden vor und
    // würden den Canvas dauerhaft kollabieren lassen.
    if (w < 1 || h < 1) return;
    if (this.app.renderer.width !== w || this.app.renderer.height !== h) {
      this.app.renderer.resize(w, h);
    }
    this.camera.setViewport(w, h);
    if (this.awaitingFirstFit) {
      this.awaitingFirstFit = false;
      this.fitToDocument();
      useEditor.getState().setZoom(this.camera.zoom);
    }
    // Direkt einen Frame zeichnen, damit nach dem Einblenden nichts leer bleibt.
    this.frame();
  }

  destroy(): void {
    for (const un of this.unsubscribers) un();
    this.unsubscribers = [];
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.onWindowResize);
    this.gridOverlay.destroy();
    this.vttOverlay.destroy();
    this.guideOverlay.destroy();
    this.app.destroy(true, { children: true });
    this.initialized = false;
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  /**
   * Ein Bild aufbauen. Öffentlich, damit Größenänderungen sofort zeichnen können.
   *
   * Der Rumpf ist gekapselt: eine Ausnahme hier liefe sonst aus dem Ticker
   * heraus und ließe die Bühne stehen, ohne dass man die Ursache sähe.
   */
  frame(): void {
    if (!this.initialized) return;
    try {
      this.renderFrame();
    } catch (err) {
      if (!this.frameErrorLogged) {
        this.frameErrorLogged = true;
        console.error('[renderer] Fehler beim Zeichnen — weitere werden unterdrückt:', err);
      }
    }
  }

  private renderFrame(): void {
    const doc = useEditor.getState().doc;

    this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    this.camera.applyTo(this.world);

    if (this.dirtyCanvas) {
      this.dirtyCanvas = false;
      this.drawMapBackground(doc);
    }
    if (this.dirtyLayers) {
      this.dirtyLayers = false;
      this.syncLayers(doc);
    }
    // Nach syncLayers, damit eine gerade entstandene Rasterebene schon in
    // diesem Durchgang ihr Bild bekommt.
    this.refreshHeights(doc);
    if (this.dirtyObjects.size > 0) {
      const ids = [...this.dirtyObjects];
      this.dirtyObjects.clear();
      for (const id of ids) this.syncObject(doc, id);
      // Ein verschobenes Objekt kann in den Blick geraten oder aus ihm heraus.
      this.lastCullState = '';
      // Und seine Maße können sich geändert haben, ohne dass `rev` das sagt:
      // eine nachgeladene Schrift ändert die Textbreite, ein fertig gebackenes
      // Prop seine Textur. Der Auswahlrahmen muss dann mit.
      this.lastSelectionState = '';
    }

    this.applyGlobalFilters(doc);
    this.syncVttVisibility(doc);
    this.gridOverlay.update(doc.grid, doc.size, this.camera);
    this.vttOverlay.update(doc, this.camera);
    this.guideOverlay.update(doc.guides ?? [], this.camera);
    this.drawVignette(doc);
    this.drawSelection(doc);

    this.pruefeFlaechenSchaerfe(doc);
    this.cullIfNeeded(doc);
  }

  /**
   * Blendet die VTT-Ebene ein, solange ein Werkzeug daran arbeitet.
   *
   * Wände, Türen und Lichter sind nur als rote Hilfslinien zu sehen, und die
   * hängen an der Sichtbarkeit der VTT-Ebene. Wer sie ausgeblendet hat und
   * dann zum Wand-Werkzeug greift, zöge blind: das Gezogene erscheint nicht,
   * schon Vorhandenes auch nicht, und ob man an eine bestehende Wand
   * angeschlossen hat, sieht man erst nach dem Einblenden.
   *
   * Deshalb gewinnt hier das Werkzeug — auch gegen die Solo-Ansicht. Das
   * Dokument bleibt unangetastet; ausgeblendet ist die Ebene weiterhin, sobald
   * ein anderes Werkzeug aktiv ist.
   *
   * Läuft in jedem Bild und nicht in `syncLayers`: ein Werkzeugwechsel ist
   * keine Änderung am Dokument und macht die Ebenen nicht „dirty".
   */
  private syncVttVisibility(doc: MapDocument): void {
    const state = useEditor.getState();
    const solo = state.soloLayerId;
    const sichtbar =
      isEffectivelyVisible(doc, SYSTEM_VTT) && (solo === null || solo === SYSTEM_VTT);
    this.vttOverlay.view.visible = sichtbar || VTT_TOOLS.has(state.tool);
  }

  /**
   * Culling nur, wenn sich etwas daran ändern konnte.
   *
   * Der Durchgang läuft über *alle* Objekte, nicht nur über die sichtbaren.
   * Bei zwanzigtausend Props kostet er damit ungefähr so viel, wie er spart —
   * gemessen war die hineingezoomte Ansicht keinen Deut schneller als die
   * eingepasste. Solange Kamera und Objektbestand stillstehen, ändert sich am
   * Ergebnis aber nichts, und genau das ist beim Arbeiten der Normalfall:
   * man schaut auf einen Ausschnitt und setzt Props.
   */
  private cullIfNeeded(doc: MapDocument): void {
    const anzahl = Object.keys(doc.objects).length;
    // Unter dieser Grenze kostet der Test mehr, als er bringt.
    if (anzahl <= 400) return;

    const zustand = `${this.camera.x.toFixed(1)},${this.camera.y.toFixed(1)},${this.camera.zoom.toFixed(4)},${this.app.screen.width},${this.app.screen.height},${anzahl}`;
    if (zustand === this.lastCullState) return;
    this.lastCullState = zustand;
    Culler.shared.cull(this.world, this.app.screen, true);
  }

  // -------------------------------------------------------------------------
  // Änderungen
  // -------------------------------------------------------------------------

  private onChanges(changes: DocChange[]): void {
    for (const c of changes) {
      switch (c.type) {
        case 'objects':
          for (const id of c.ids) this.dirtyObjects.add(id);
          break;
        case 'layers':
          this.dirtyLayers = true;
          break;
        case 'canvas':
          this.dirtyCanvas = true;
          this.gridOverlay.update(
            useEditor.getState().doc.grid,
            useEditor.getState().doc.size,
            this.camera,
            true,
          );
          break;
        case 'grid':
          this.dirtyCanvas = true;
          break;
        case 'vtt':
          this.vttOverlay.invalidate();
          break;
        case 'height': {
          // Zeilenbereiche mehrerer Änderungen zusammenfassen; fehlt einer,
          // gilt die ganze Ebene als fällig.
          const alt = this.dirtyHeights.get(c.layerId);
          const neu =
            c.minRow === undefined || c.maxRow === undefined
              ? null
              : { minRow: c.minRow, maxRow: c.maxRow };
          if (alt === undefined) this.dirtyHeights.set(c.layerId, neu);
          else if (alt !== null && neu !== null) {
            alt.minRow = Math.min(alt.minRow, neu.minRow);
            alt.maxRow = Math.max(alt.maxRow, neu.maxRow);
          } else this.dirtyHeights.set(c.layerId, null);
          break;
        }
        case 'all':
          this.rebuildAll();
          // Ein neues Dokument bringt eine neue Größe mit; die Kamera stünde
          // sonst weiter auf dem Ausschnitt der alten Karte und zeigte ins
          // Leere. `all` kommt nur von loadDocument, nicht von Undo/Redo —
          // deshalb ist das Einpassen hier richtig aufgehoben und muss nicht
          // an jeder Aufrufstelle wiederholt werden.
          this.fitToDocument();
          useEditor.getState().setZoom(this.camera.zoom);
          break;
      }
    }
  }

  private onTextureReady(propId: string): void {
    const doc = useEditor.getState().doc;
    for (const id in doc.objects) {
      const o = doc.objects[id];
      if (o.kind === 'prop' && o.propId === propId) this.dirtyObjects.add(id);
    }
  }

  private markAllObjectsDirty(): void {
    const doc = useEditor.getState().doc;
    for (const id in doc.objects) this.dirtyObjects.add(id);
  }

  /**
   * Vollständiger Neuaufbau — nach dem Laden einer Projektdatei.
   *
   * Mit `fremd` baut er kurz eine andere Karte derselben Datei auf, um sie als
   * Bild zu exportieren (`io/exportImage.ts`, `renderFremdeKarte`); danach muss
   * ein Aufruf ohne Argument die offene Karte wiederherstellen.
   */
  rebuildAll(fremd?: MapDocument): void {
    if (!this.initialized) return;
    const doc = fremd ?? useEditor.getState().doc;

    for (const view of this.objectViews.values()) view.node.destroy({ children: true });
    this.objectViews.clear();
    this.textMetrics.clear();
    this.layerContainers.clear();
    this.stack.removeChildren();

    this.drawMapBackground(doc);
    this.syncLayers(doc);
    for (const id in doc.objects) this.syncObject(doc, id);
    this.gridOverlay.update(doc.grid, doc.size, this.camera, true);
    this.vttOverlay.invalidate();
    this.guideOverlay.update(doc.guides ?? [], this.camera, true);
  }

  // -------------------------------------------------------------------------
  // Bühne
  // -------------------------------------------------------------------------

  private drawMapBackground(doc: MapDocument): void {
    const { width, height } = mapPixelSize(doc.grid, doc.size);
    this.mapBackground.clear();
    // Durchsichtiger Boden: kein Hintergrund, die Karte darunter scheint durch.
    if (!doc.ebene?.bodenTransparent) this.mapBackground.rect(0, 0, width, height).fill({ color: doc.background });
    this.mapBackground
      .rect(0, 0, width, height)
      .stroke({ width: 2 / this.camera.zoom, color: 0x000000, alpha: 0.5 });
  }

  /**
   * Die Karten darunter als Bilder, von unten nach oben. `breite`/`hoehe`
   * je Bild in Weltpixeln: die Bilder werden kleiner gerendert und hier
   * wieder auf Kartengröße gezogen. Leer räumt die Unterlage ab.
   */
  setzeUnterlage(bilder: readonly { canvas: HTMLCanvasElement; breite: number; hoehe: number }[], deckkraft: number): void {
    this.unterlage.removeChildren().forEach((c) => c.destroy());
    for (const t of this.unterlageTexturen) t.destroy(true);
    this.unterlageTexturen = [];
    for (const b of bilder) {
      const textur = Texture.from(b.canvas);
      this.unterlageTexturen.push(textur);
      const sprite = new Sprite(textur);
      sprite.width = b.breite;
      sprite.height = b.hoehe;
      this.unterlage.addChild(sprite);
    }
    this.unterlage.alpha = deckkraft;
  }

  /**
   * Baut den Layer-Stapel nach. Die Systemebenen stehen im selben Stapel wie die
   * Benutzerebenen, damit das Grid wirklich dort landet, wo es im Panel steht.
   */
  private syncLayers(doc: MapDocument): void {
    const flat = flattenLayers(doc);
    const wanted = new Set(flat.map((l) => l.id));

    for (const [id, container] of this.layerContainers) {
      if (!wanted.has(id)) {
        container.removeChildren();
        container.destroy();
        this.layerContainers.delete(id);
      }
    }

    for (const [id, view] of this.heightViews) {
      // Auch ein Layer, der vom Raster zurück auf Objekte gestellt wurde,
      // verliert hier seine Ansicht — sonst bliebe das alte Bild stehen.
      if (!wanted.has(id) || doc.layers[id]?.kind !== 'height') {
        view.destroy();
        this.heightViews.delete(id);
      }
    }

    this.stack.removeChildren();

    for (const layer of flat) {
      if (layer.isGroup) continue;

      let container: Container;
      if (layer.id === SYSTEM_GRID) {
        container = this.gridOverlay.view as unknown as Container;
      } else if (layer.id === SYSTEM_VTT) {
        container = this.vttOverlay.view;
      } else if (layer.kind === 'height') {
        container = this.heightViewFor(layer.id).view;
      } else {
        container = this.layerContainers.get(layer.id) ?? new Container();
        container.sortableChildren = true;
        this.layerContainers.set(layer.id, container);
      }

      // Gruppen-Sichtbarkeit und -Deckkraft multiplizieren sich mit hinein,
      // weil Gruppen selbst keine eigenen Container bekommen.
      // Die Solo-Ansicht kommt obendrauf: sie blendet aus, ohne das Dokument
      // anzufassen, und taucht deshalb auch nicht im Undo-Verlauf auf.
      const solo = useEditor.getState().soloLayerId;
      container.visible =
        isEffectivelyVisible(doc, layer.id) && (solo === null || solo === layer.id);
      container.alpha = effectiveAlpha(doc, layer.id);
      container.blendMode = layer.blend as BLEND_MODES;
      // null statt einer leeren Liste: jeder Filter kostet in Pixi einen
      // eigenen Render-Durchgang, ein neutraler wäre reine Verschwendung.
      container.filters = buildFilters(layer.filters) ?? [];
      this.stack.addChild(container);
    }

    // Objekte, deren Layer neu entstanden ist, brauchen ein neues Zuhause.
    for (const [id, view] of this.objectViews) {
      const obj = doc.objects[id];
      const parent = obj ? this.layerContainers.get(obj.layerId) : undefined;
      if (parent && view.node.parent !== parent) parent.addChild(view.node);
    }
  }

  /**
   * Ansicht einer Rasterebene, bei Bedarf neu gebaut.
   *
   * Die Textur wird gleich mit aufgefrischt: eine Ebene, die erst in diesem
   * Durchgang entsteht, hätte sonst bis zur nächsten Änderung ein leeres Bild.
   */
  private heightViewFor(id: LayerId): HeightLayerView {
    let view = this.heightViews.get(id);
    if (!view) {
      view = new HeightLayerView();
      this.heightViews.set(id, view);
      this.dirtyHeights.set(id, null);
    }
    return view;
  }

  /**
   * Alle Rasterebenen neu einfärben.
   *
   * Nötig, wenn sich etwas an der *Darstellung* geändert hat statt am
   * Höhenfeld — die Schattierung steckt in der Textur, nicht im Dokument, und
   * käme über keine Dokumentänderung hier an.
   */
  invalidateHeights(): void {
    for (const id of this.heightViews.keys()) this.dirtyHeights.set(id, null);
  }

  /** Frischt die Texturen der geänderten Rasterebenen auf. */
  private refreshHeights(doc: MapDocument): void {
    if (this.dirtyHeights.size === 0) return;
    const size = mapPixelSize(doc.grid, doc.size);
    const relief = useEditor.getState().height.relief;
    for (const [id, bereich] of this.dirtyHeights) {
      const view = this.heightViews.get(id);
      const map = doc.heightMaps?.[id];
      if (!view || !map) continue;
      view.update(
        map,
        size.width,
        size.height,
        relief,
        bereich?.minRow ?? 0,
        bereich?.maxRow ?? map.rows - 1,
      );
    }
    this.dirtyHeights.clear();
  }

  // -------------------------------------------------------------------------
  // Objekte
  // -------------------------------------------------------------------------

  private syncObject(doc: MapDocument, id: ObjectId): void {
    const obj = doc.objects[id];
    const existing = this.objectViews.get(id);

    if (!obj) {
      if (existing) {
        existing.node.destroy({ children: true });
        this.objectViews.delete(id);
        this.textMetrics.delete(id);
      }
      // Ein gelöschtes Objekt bleibt sonst für immer in der Ausblendliste —
      // und wäre nach einem Rückgängig unsichtbar wieder da.
      this.hiddenObjects.delete(id);
      return;
    }

    const parent = this.layerContainers.get(obj.layerId);
    if (!parent) {
      // Layer noch nicht aufgebaut — beim nächsten syncLayers wird nachgeholt.
      this.dirtyLayers = true;
      this.dirtyObjects.add(id);
      return;
    }

    const key = viewKey(obj);
    let view = existing;
    if (!view || view.key !== key) {
      existing?.node.destroy({ children: true });
      const node = this.createNode(doc, obj);
      if (!node) {
        this.objectViews.delete(id);
        return;
      }
      view = { node, key };
      this.objectViews.set(id, view);
    }

    if (view.node.parent !== parent) parent.addChild(view.node);
    this.refreshPropTexture(obj, view.node);
    this.applyTransform(doc, obj, view.node);
    // Nach einem Neuaufbau steht das Sprite wieder auf sichtbar; hier gilt
    // wieder, was das Werkzeug gesetzt hat.
    if (this.hiddenObjects.has(id)) view.node.visible = false;
  }

  /**
   * Ein Objekt vorübergehend aus der Anzeige nehmen, ohne das Dokument
   * anzufassen — siehe `hiddenObjects`.
   */
  setObjectHidden(id: ObjectId, hidden: boolean): void {
    if (hidden) this.hiddenObjects.add(id);
    else this.hiddenObjects.delete(id);
    const view = this.objectViews.get(id);
    if (view) view.node.visible = !hidden;
  }

  /**
   * Holt eine nachgeladene Textur an ein bestehendes Sprite.
   *
   * `viewKey` ändert sich nicht, wenn ein asynchron geladenes Bild eintrifft —
   * das Sprite würde sonst wiederverwendet und bliebe für immer unsichtbar.
   * Betrifft nur importierte Assets; prozedurale Texturen entstehen sofort.
   */
  private refreshPropTexture(obj: MapObject, node: Container): void {
    if (obj.kind !== 'prop' || !(node instanceof Sprite) || node.visible) return;
    const texture = getPropTexture(this.app.renderer, obj.propId, variantFor(obj.propId, obj.seed));
    if (!texture) return;
    node.texture = texture;
    node.visible = true;
  }

  private createNode(doc: MapDocument, obj: MapObject): Container | null {
    switch (obj.kind) {
      case 'prop': {
        const variant = variantFor(obj.propId, obj.seed);
        const texture = getPropTexture(this.app.renderer, obj.propId, variant);
        const sprite = new Sprite(texture ?? undefined);
        sprite.anchor.set(0.5);
        // Ohne Textur bleibt ein Platzhalter stehen, bis das Bild geladen ist.
        sprite.visible = !!texture;
        return sprite;
      }
      case 'shape':
        return this.alsBild(obj) ? this.buildFlaechenBild(obj) : this.buildShape(obj);
      case 'text':
        return this.buildText(doc, obj);
    }
  }

  /**
   * Gehört diese Fläche als eigenes Bild in die Szene?
   *
   * Nur für die schlichte durchscheinende Füllung ohne Strich und ohne Muster
   * — das ist der Terrain-Pinsel. Wo ein Strich dazukommt, hat er seine eigene
   * Deckkraft, die sich nicht mit der der Füllung in einem Bild verrechnen
   * lässt; dort bleibt es beim Zeichnen wie bisher.
   */
  private alsBild(obj: ShapeObject): boolean {
    return (
      !!obj.fill &&
      obj.fill.alpha < 1 &&
      !obj.stroke &&
      !obj.fill.pattern &&
      obj.shape !== 'line' &&
      obj.points.length >= 6
    );
  }

  private buildFlaechenBild(obj: ShapeObject): FlaechenBild {
    const bild = new FlaechenBild();
    bild.fuellDeckkraft = obj.fill?.alpha ?? 1;
    this.backeFlaeche(obj, bild);
    return bild;
  }

  /** Zeichnet die Fläche voll deckend in eine frische Textur. */
  private backeFlaeche(obj: ShapeObject, bild: FlaechenBild): void {
    const pts = obj.points;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);
      maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]);
      maxY = Math.max(maxY, pts[i + 1]);
    }
    // Ein Rand, damit die weiche Kante nicht am Bildrand abgeschnitten wird.
    const rand = 2;
    const breite = Math.max(1, maxX - minX) + rand * 2;
    const hoehe = Math.max(1, maxY - minY) + rand * 2;

    const zoom = this.camera.zoom;
    const deckel = Math.min(MAX_TEXEL / breite, MAX_TEXEL / hoehe);
    const aufloesung = Math.max(0.05, Math.min(zoom, deckel));

    const g = new Graphics();
    this.tracePath(g, obj);
    const verlauf = buildGradient(obj.fill!);
    if (verlauf) g.fill({ fill: verlauf, alpha: 1 });
    else g.fill({ color: obj.fill!.color, alpha: 1 });

    const tex = RenderTexture.create({
      width: Math.max(1, Math.round(breite * aufloesung)),
      height: Math.max(1, Math.round(hoehe * aufloesung)),
      resolution: 1,
      antialias: true,
    });
    this.app.renderer.render({
      container: g,
      target: tex,
      clear: true,
      transform: new Matrix(
        aufloesung,
        0,
        0,
        aufloesung,
        (-minX + rand) * aufloesung,
        (-minY + rand) * aufloesung,
      ),
    });
    g.destroy();

    const alt = bild.texture;
    bild.texture = tex;
    if (alt && alt !== tex) alt.destroy(true);
    bild.position.set(minX - rand, minY - rand);
    bild.scale.set(1 / aufloesung);
    bild.zoomDerTextur = aufloesung;
  }

  /**
   * Backt Flächen nach, die für die jetzige Zoomstufe zu grob geworden sind.
   *
   * Läuft je Bild höchstens dann, wenn der Zoom sich verdoppelt oder halbiert
   * hat — sonst würde bei jedem Mausrad-Schritt alles neu gezeichnet.
   */
  private pruefeFlaechenSchaerfe(doc: MapDocument): void {
    const zoom = this.camera.zoom;
    for (const [id, view] of this.objectViews) {
      const bild = view.node;
      if (!(bild instanceof FlaechenBild)) continue;
      const faktor = zoom / bild.zoomDerTextur;
      if (faktor <= SCHAERFE_TOLERANZ && faktor >= 1 / SCHAERFE_TOLERANZ) continue;
      const obj = doc.objects[id];
      if (obj?.kind !== 'shape') continue;
      this.backeFlaeche(obj, bild);
    }
  }

  private buildShape(obj: ShapeObject): Graphics {
    const g = new Graphics();
    const pts = obj.points;
    if (pts.length < 4) return g;

    const dashes = this.dashedPath(obj);

    if (obj.fill && obj.shape !== 'line') {
      this.tracePath(g, obj);
      const verlauf = buildGradient(obj.fill);
      if (verlauf) g.fill({ fill: verlauf, alpha: obj.fill.alpha });
      else g.fill({ color: obj.fill.color, alpha: obj.fill.alpha });

      // Das Muster liegt über der Farbe und braucht denselben Pfad noch einmal.
      const muster = buildPattern(obj.fill.pattern);
      if (muster) {
        this.tracePath(g, obj);
        g.fill({ fill: muster, alpha: obj.fill.alpha });
      }
    }

    if (obj.stroke) {
      // Bei einem Strichmuster tritt der gestückelte Pfad an die Stelle des
      // durchgezogenen; die Füllung oben hat ihren eigenen Pfad bekommen.
      if (dashes) {
        for (const seg of dashes) {
          g.moveTo(seg[0], seg[1]);
          for (let i = 2; i < seg.length; i += 2) g.lineTo(seg[i], seg[i + 1]);
        }
      } else {
        this.tracePath(g, obj);
      }
      g.stroke({
        width: obj.stroke.width,
        color: obj.stroke.color,
        alpha: obj.stroke.alpha,
        cap: 'round',
        join: 'round',
      });

      /**
       * Muster im Strich: derselbe Pfad ein zweites Mal, gefüllt statt gefärbt.
       *
       * Wie bei der Fläche liegt das Muster *über* der Farbe — eine Steinwand
       * ist eine Grundfarbe mit Fugen, nicht ein Fugenmuster im Leeren. Ein
       * Strich ohne Grundfarbe darunter wäre an den Lücken durchsichtig.
       */
      const strichMuster = buildPattern(obj.stroke.pattern);
      if (strichMuster) {
        if (dashes) {
          for (const seg of dashes) {
            g.moveTo(seg[0], seg[1]);
            for (let i = 2; i < seg.length; i += 2) g.lineTo(seg[i], seg[i + 1]);
          }
        } else {
          this.tracePath(g, obj);
        }
        g.stroke({
          width: obj.stroke.width,
          fill: strichMuster,
          alpha: obj.stroke.alpha,
          cap: 'round',
          join: 'round',
        });
      }
    }

    this.drawRouteMarks(g, obj);

    g.blendMode = obj.blend as BLEND_MODES;
    return g;
  }

  /**
   * Tagesmarken einer Reiseroute — Querstriche auf dem Weg.
   *
   * Quer und nicht als Punkt: ein Punkt auf einer gestrichelten Linie geht
   * darin unter, ein Querstrich nicht. Die Länge hängt an der Strichstärke,
   * damit eine dünne Route feine Marken bekommt und eine dicke kräftige.
   */
  private drawRouteMarks(g: Graphics, obj: ShapeObject): void {
    const route = obj.route;
    if (!route || !route.marks || !obj.stroke) return;

    const abstand = dayLengthInPixels(useEditor.getState().doc.grid, route.perDay);
    if (abstand <= 0) return;

    const marks = routeMarks(obj.points, abstand);
    if (marks.length === 0) return;

    const laenge = markLength(abstand, obj.stroke.width);
    for (const mark of marks) {
      // Senkrecht zur Wegrichtung.
      const nx = -Math.sin(mark.angle) * laenge;
      const ny = Math.cos(mark.angle) * laenge;
      g.moveTo(mark.x - nx, mark.y - ny).lineTo(mark.x + nx, mark.y + ny);
    }
    g.stroke({
      width: Math.max(1, obj.stroke.width * 0.9),
      color: obj.stroke.color,
      alpha: obj.stroke.alpha,
      cap: 'round',
    });
  }

  /** Legt den Umriss der Form an, ohne ihn zu füllen oder zu streichen. */
  private tracePath(g: Graphics, obj: ShapeObject): void {
    const pts = obj.points;
    switch (obj.shape) {
      case 'rect': {
        const [x0, y0, x1, y1] = pts;
        g.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        break;
      }
      case 'ellipse': {
        const [x0, y0, x1, y1] = pts;
        g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2);
        break;
      }
      case 'line':
        g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]);
        break;
      default:
        g.poly(pts, obj.closed);
        break;
    }
  }

  /**
   * Strichmuster in Einzelstücke zerlegen, oder null wenn durchgezogen.
   *
   * Pixi kann keine gestrichelten Striche, deshalb wird der Pfad selbst
   * gestückelt. Ellipsen bleiben außen vor — sie ließen sich nur über eine
   * Näherung als Polygon stricheln, und das lohnt hier nicht.
   */
  private dashedPath(obj: ShapeObject): number[][] | null {
    const dash = obj.stroke?.dash;
    if (!dash || dash.length === 0 || obj.shape === 'ellipse') return null;

    const pts = obj.points;
    if (obj.shape === 'rect') {
      const [x0, y0, x1, y1] = pts;
      const ax = Math.min(x0, x1);
      const ay = Math.min(y0, y1);
      const bx = Math.max(x0, x1);
      const by = Math.max(y0, y1);
      return dashPolyline([ax, ay, bx, ay, bx, by, ax, by], dash, true);
    }
    return dashPolyline(pts, dash, obj.shape !== 'line' && obj.closed);
  }

  private buildText(doc: MapDocument, obj: TextObject): Container {
    if (obj.curvature && Math.abs(obj.curvature) >= 0.01 && obj.text.length > 0) {
      return this.buildCurvedText(obj);
    }
    const t = new Text({
      text: obj.text,
      style: {
        fontFamily: obj.fontFamily,
        fontSize: obj.fontSize,
        fontWeight: obj.bold ? 'bold' : 'normal',
        fontStyle: obj.italic ? 'italic' : 'normal',
        fill: obj.color,
        align: obj.align,
        letterSpacing: obj.letterSpacing,
        lineHeight: obj.fontSize * obj.lineHeight,
        stroke:
          obj.strokeColor !== null && obj.strokeWidth > 0
            ? { color: obj.strokeColor, width: obj.strokeWidth, join: 'round' }
            : undefined,
      },
      resolution: 2,
    });
    t.anchor.set(0.5);
    // Echte Maße zurückmelden, damit Trefferprüfung und Auswahlrahmen stimmen.
    this.textMetrics.set(obj.id, { w: t.width, h: t.height });
    void doc;
    return t;
  }

  /**
   * Text auf einem Bogen: je Zeichen ein eigenes Text-Objekt.
   *
   * Pixi kann keinen Text an einem Pfad ausrichten. Die Zeichen einzeln zu
   * setzen ist der übliche Weg — bei Beschriftungen geht es um wenige Dutzend,
   * nicht um Fließtext.
   */
  private buildCurvedText(obj: TextObject): Container {
    const gruppe = new Container();
    const stil = {
      fontFamily: obj.fontFamily,
      fontSize: obj.fontSize,
      fontWeight: (obj.bold ? 'bold' : 'normal') as 'bold' | 'normal',
      fontStyle: (obj.italic ? 'italic' : 'normal') as 'italic' | 'normal',
      fill: obj.color,
      stroke:
        obj.strokeColor !== null && obj.strokeWidth > 0
          ? { color: obj.strokeColor, width: obj.strokeWidth, join: 'round' as const }
          : undefined,
    };

    // Zeilenumbrüche ergeben auf einem Bogen keinen Sinn; sie werden zu Leerzeichen.
    const zeichen = [...obj.text.replace(/\n/g, ' ')];
    const glyphen = zeichen.map((z) => new Text({ text: z, style: stil, resolution: 2 }));
    const breiten = glyphen.map((g) => g.width);
    const gesamt =
      breiten.reduce((a, b) => a + b, 0) + obj.letterSpacing * Math.max(0, breiten.length - 1);

    const pfad = arcPath(gesamt, obj.curvature ?? 0);
    const plaetze = layoutOnPath(pfad, breiten, obj.letterSpacing, 'center');

    for (const platz of plaetze) {
      const g = glyphen[platz.index];
      g.anchor.set(0.5);
      g.position.set(platz.x, platz.y);
      g.rotation = platz.angle;
      gruppe.addChild(g);
    }
    // Nicht benutzte Glyphen (bei leerem Layout) wieder freigeben.
    for (let i = 0; i < glyphen.length; i++) {
      if (!glyphen[i].parent) glyphen[i].destroy();
    }

    const b = gruppe.getLocalBounds();
    this.textMetrics.set(obj.id, { w: b.width, h: b.height });
    return gruppe;
  }

  private applyTransform(doc: MapDocument, obj: MapObject, node: Container): void {
    node.position.set(obj.x, obj.y);
    node.rotation = obj.rotation;
    // Bei einem Flaechenbild steckt die Deckkraft der Fuellung nicht im Bild —
    // dort ist sie voll deckend, damit die Lagen des Striches nicht durchschlagen.
    node.alpha = obj.opacity * (node instanceof FlaechenBild ? node.fuellDeckkraft : 1);
    node.zIndex = obj.z;

    if (obj.kind === 'prop') {
      const sprite = node as Sprite;
      const s = tileScale(doc);
      sprite.scale.set(obj.scaleX * s * (obj.flipX ? -1 : 1), obj.scaleY * s * (obj.flipY ? -1 : 1));
      sprite.tint = obj.tint ?? 0xffffff;

      if (!sprite.texture || sprite.texture.width <= 1) {
        const texture = getPropTexture(this.app.renderer, obj.propId, variantFor(obj.propId, obj.seed));
        if (texture) {
          sprite.texture = texture;
          sprite.visible = true;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Auswahl
  // -------------------------------------------------------------------------

  /**
   * Filter über der ganzen Karte.
   *
   * Sitzen auf `stack` und nicht auf `world`: die Overlays für Auswahl und
   * VTT-Ebene sollen ungefiltert bleiben — ein weichgezeichneter Auswahlrahmen
   * wäre nicht mehr zu treffen.
   */
  private applyGlobalFilters(doc: MapDocument): void {
    const schluessel = JSON.stringify(doc.filters ?? null);
    if (schluessel === this.globalFilterKey) return;
    this.globalFilterKey = schluessel;
    this.stack.filters = buildFilters(doc.filters) ?? [];
  }

  /**
   * Vignette als gezeichnete Fläche über der Karte.
   *
   * Kein Filter: als Shader bräuchte sie eigenen Code, und über mehrere Layer
   * gelegt ergäbe sie mehrere Abdunkelungen statt einer. Als Teil der Welt
   * landet sie zugleich unverändert im Bild-Export.
   */
  private drawVignette(doc: MapDocument): void {
    const staerke = doc.filters?.vignette ?? 0;
    this.vignetteGfx.clear();
    if (staerke <= 0) return;

    const { width, height } = mapPixelSize(doc.grid, doc.size);
    // Ringe von außen nach innen mit fallender Deckkraft. Ein Farbverlauf wäre
    // schöner, aber schon wenige Ringe sind bei dieser Größe nicht zu
    // unterscheiden — und das hier funktioniert überall gleich.
    const ringe = 14;
    for (let i = 0; i < ringe; i++) {
      const t2 = i / ringe;
      const einzug = (width / 2) * t2 * 0.9;
      const einzugY = (height / 2) * t2 * 0.9;
      this.vignetteGfx
        .rect(einzug, einzugY, width - einzug * 2, height - einzugY * 2)
        .stroke({
          width: Math.max(width, height) / ringe / 2,
          color: 0x000000,
          alpha: (staerke * (1 - t2)) / ringe,
        });
    }
  }

  /**
   * Zeichnet die Auswahl neu — aber nur, wenn sie danach anders aussähe.
   *
   * Gemessen bei „alles auswählen" auf einer vollen Karte: der Aufbau der
   * Umrisse für zwanzigtausend Objekte kostet ein ganzes Bildbudget, und ohne
   * diesen Vergleich fiele er in *jedem* Bild an, obwohl sich nichts rührt.
   *
   * Was den Umriss ändert, steht im Schlüssel: die Auswahl selbst (der Store
   * legt bei jeder Änderung ein neues Array an, ein Vergleich der Referenz
   * genügt also und kostet nicht zwanzigtausend Vergleiche), der Zoom — er
   * steckt in der Strichstärke —, und `rev` für alles am Dokument, also auch
   * ein gezogenes Objekt.
   */
  private drawSelection(doc: MapDocument): void {
    const { selection, vttSelection, rev, editingPathId } = useEditor.getState();
    // editingPathId gehört in den Zustandsschlüssel: das Ein- und Aussteigen
    // ändert weder Auswahl noch rev, die Griffe müssen aber erscheinen.
    const zustand = `${rev}|${this.camera.zoom.toFixed(4)}|${editingPathId ?? ''}`;
    if (
      selection === this.lastSelectionRef &&
      vttSelection === this.lastVttSelectionRef &&
      zustand === this.lastSelectionState
    )
      return;
    this.lastSelectionRef = selection;
    this.lastVttSelectionRef = vttSelection;
    this.lastSelectionState = zustand;

    this.selectionGfx.clear();
    const vttCount = vttSelectionSize(vttSelection);
    if (selection.length === 0 && vttCount === 0) return;

    const lw = 1.5 / this.camera.zoom;

    // Erst alle Rechtecke sammeln, dann *ein* `stroke()`. Je Rechteck zu
    // stroken ergibt dieselbe Zeichnung, kostet bei zwanzigtausend Objekten
    // aber das Vierfache — jeder Aufruf legt einen eigenen Zeichenweg an.
    let rechtecke = 0;
    for (const id of selection) {
      const o = doc.objects[id];
      if (!o) continue;
      const b = worldAABB(doc, o, this.textMetrics);
      this.selectionGfx.rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      rechtecke++;
    }
    if (rechtecke > 0)
      this.selectionGfx.stroke({ width: lw, color: 0x4da3ff, alpha: 0.9 });

    // VTT-Elemente bekommen keinen Rahmen, sondern werden nachgezeichnet:
    // ein Kasten um einen langen Wandzug sagt nichts darüber, welche Wand
    // gemeint ist.
    this.drawVttSelection(doc, vttSelection, lw);

    // Griffe: bei einem Objekt auf dessen gedrehtem Rechteck, bei mehreren auf
    // der gemeinsamen Hülle. Ein gemeinsamer Winkel ist bei unterschiedlich
    // gedrehten Mitgliedern gar nicht bestimmt.
    if (vttCount === 0 && selection.length === 1) {
      const obj = doc.objects[selection[0]];
      // Beim Bearbeiten eines Pfades stehen die Stützpunkte an der Stelle der
      // Eck- und Drehgriffe. Beides zugleich wären zwei Griffsätze auf
      // demselben Objekt, von denen der eine die Form ändert und der andere
      // die Punkte — nicht auseinanderzuhalten und kaum zu treffen.
      if (obj && obj.kind === 'shape' && obj.id === editingPathId) {
        this.drawPathNodes(obj, lw);
      } else if (obj) {
        this.drawHandles(doc, obj, lw);
      }
    }

    if (vttCount === 0 && selection.length > 1) {
      const b = selectionBounds(doc, selection, this.textMetrics);
      if (b) {
        this.selectionGfx
          .rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
          .stroke({ width: lw, color: 0x4da3ff, alpha: 0.45 });

        const griffe = groupHandles(b, this.camera.zoom);
        const dreh = griffe.find((h) => h.id === 'rotate');
        if (dreh) {
          this.selectionGfx
            .moveTo((b.minX + b.maxX) / 2, b.minY)
            .lineTo(dreh.x, dreh.y)
            .stroke({ width: lw, color: 0x4da3ff, alpha: 0.7 });
        }
        this.drawHandleDots(griffe, lw);
      }
    }
  }

  /**
   * Stützpunkte einer Zeichnung, die gerade bearbeitet wird.
   *
   * Runde Griffe, damit sie sich von den eckigen Skaliergriffen unterscheiden:
   * die beiden tun Verschiedenes, und auf einem Bildschirm voller Linien ist
   * die Form der einzige Unterschied, den man noch sieht.
   */
  private drawPathNodes(obj: ShapeObject, lw: number): void {
    // Der Umriss noch einmal nachgezeichnet: bei einer gefüllten Fläche liegen
    // die Griffe sonst scheinbar im Nichts.
    const nodes = pathNodes(obj);
    if (nodes.length > 1) {
      this.selectionGfx.moveTo(nodes[0].x, nodes[0].y);
      for (let i = 1; i < nodes.length; i++) this.selectionGfx.lineTo(nodes[i].x, nodes[i].y);
      if (obj.closed) this.selectionGfx.lineTo(nodes[0].x, nodes[0].y);
      this.selectionGfx.stroke({ width: lw, color: 0xffc23d, alpha: 0.8 });
    }

    // Feste Bildschirmgröße, wie bei den übrigen Griffen.
    const r = 5 / this.camera.zoom;
    for (const node of nodes) {
      this.selectionGfx
        .circle(node.x, node.y, r)
        .fill({ color: 0x1a1a20 })
        .circle(node.x, node.y, r)
        .stroke({ width: lw, color: 0xffc23d, alpha: 1 });
    }
  }

  /** Eck- und Drehgriffe des ausgewählten Objekts. */
  private drawHandles(doc: MapDocument, obj: MapObject, lw: number): void {
    const zoom = this.camera.zoom;
    const handles = objectHandles(doc, obj, zoom, this.textMetrics);

    const dreh = handles.find((h) => h.id === 'rotate');
    if (dreh) {
      // Linie von der Oberkante zum Drehgriff, damit die Zugehörigkeit klar ist.
      const c = objectCenter(doc, obj);
      const { hh } = halfExtents(doc, obj, this.textMetrics);
      const cos = Math.cos(obj.rotation);
      const sin = Math.sin(obj.rotation);
      const oben = { x: c.x + hh * sin, y: c.y - hh * cos };
      this.selectionGfx
        .moveTo(oben.x, oben.y)
        .lineTo(dreh.x, dreh.y)
        .stroke({ width: lw, color: 0x4da3ff, alpha: 0.7 });
    }

    this.drawHandleDots(handles, lw);
  }

  /** Zeichnet die Griffpunkte selbst — für Einzelobjekt und Gruppe gleich. */
  private drawHandleDots(handles: Handle[], lw: number): void {
    // Feste Bildschirmgröße: ein Griff, der beim Herauszoomen mitschrumpft,
    // ist nicht mehr zu treffen.
    const r = 5 / this.camera.zoom;
    for (const h of handles) {
      if (h.id === 'rotate') {
        this.selectionGfx
          .circle(h.x, h.y, r)
          .fill({ color: 0x1a1a20 })
          .circle(h.x, h.y, r)
          .stroke({ width: lw, color: 0x4da3ff, alpha: 1 });
      } else {
        this.selectionGfx
          .rect(h.x - r, h.y - r, r * 2, r * 2)
          .fill({ color: 0x1a1a20 })
          .rect(h.x - r, h.y - r, r * 2, r * 2)
          .stroke({ width: lw, color: 0x4da3ff, alpha: 1 });
      }
    }
  }

  private drawVttSelection(doc: MapDocument, sel: VttSelection, lw: number): void {
    const width = lw * 3;
    const color = 0x4da3ff;

    for (const wall of doc.vtt.walls) {
      if (!sel.walls.includes(wall.id)) continue;
      const pts = wall.points;
      if (pts.length < 4) continue;
      this.selectionGfx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) this.selectionGfx.lineTo(pts[i], pts[i + 1]);
      if (wall.closed) this.selectionGfx.lineTo(pts[0], pts[1]);
      this.selectionGfx.stroke({ width, color, alpha: 0.75, cap: 'round' });
    }

    for (const portal of doc.vtt.portals) {
      if (!sel.portals.includes(portal.id)) continue;
      const [x0, y0, x1, y1] = portal.bounds;
      this.selectionGfx
        .moveTo(x0, y0)
        .lineTo(x1, y1)
        .stroke({ width, color, alpha: 0.75, cap: 'round' });
    }

    for (const light of doc.vtt.lights) {
      if (!sel.lights.includes(light.id)) continue;
      this.selectionGfx
        .circle(light.x, light.y, Math.max(6, 10 / this.camera.zoom))
        .stroke({ width: lw * 2, color, alpha: 0.9 });
    }

    for (const note of doc.vtt.notes) {
      if (!sel.notes.includes(note.id)) continue;
      // Um den Kopf des Pins, nicht um die Spitze — dort sitzt das, was man sieht.
      const r = (note.size * doc.grid.tileSize) / 2;
      this.selectionGfx
        .circle(note.x, note.y - r, r * 0.95)
        .stroke({ width: lw * 2, color, alpha: 0.9 });
    }
  }

  // -------------------------------------------------------------------------
  // Hilfsmittel für Werkzeuge
  // -------------------------------------------------------------------------

  /**
   * Passt die Karte ins Bild ein. Misst dabei über `app.screen` statt über das
   * Host-Element: direkt nach dem Mounten hat der Container noch keine Größe,
   * und ein Fit auf null Pixel landet am Zoom-Minimum.
   */
  fitToDocument(padding = 40): boolean {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w <= 1 || h <= 1) return false;
    const doc = useEditor.getState().doc;
    const size = mapPixelSize(doc.grid, doc.size);
    this.camera.setViewport(w, h);
    this.camera.fit(size.width, size.height, padding);
    return true;
  }

  /**
   * Schaltet die Bühne in den Export-Zustand und liefert eine Funktion, die
   * alles zurücksetzt.
   *
   * Was hier ausgeblendet wird, ist der Unterschied zwischen einem Screenshot
   * und einer brauchbaren Karte: Auswahlrahmen, Pinselvorschau und vor allem
   * die VTT-Ebene gehören nie ins Bild. Wände und Lichter beschreiben, was das
   * VTT bauen soll — sie sind keine Bildinhalte.
   */
  beginExport(options: {
    includeGrid: boolean;
    includeBackground: boolean;
    /** Nur diesen einen Layer zeigen — für den Export einzelner Ebenen. */
    onlyLayer?: LayerId;
    /** Filter für diesen Durchgang abschalten. */
    ignoreFilters?: boolean;
    /** Die Karte, die gerade aufgebaut ist, wenn es nicht die offene ist. */
    doc?: MapDocument;
  }): () => void {
    const doc = options.doc ?? useEditor.getState().doc;
    const restore: Array<() => void> = [];

    const hide = (node: Container) => {
      const previous = node.visible;
      node.visible = false;
      restore.push(() => {
        node.visible = previous;
      });
    };

    hide(this.overlay);
    hide(this.vttOverlay.view);

    if (options.ignoreFilters) {
      // Filter für diesen Durchgang abnehmen und danach wieder anhängen.
      // Der gemerkte Schlüssel muss mit zurück, sonst hält applyGlobalFilters
      // den Zustand für aktuell und setzt sie nie wieder.
      const globalVorher = [...(this.stack.filters ?? [])];
      const keyVorher = this.globalFilterKey;
      this.stack.filters = [];
      hide(this.vignetteGfx);
      restore.push(() => {
        this.stack.filters = globalVorher;
        this.globalFilterKey = keyVorher;
      });
      for (const [, container] of this.layerContainers) {
        const vorher = [...(container.filters ?? [])];
        container.filters = [];
        restore.push(() => {
          container.filters = vorher;
        });
      }
    }
    if (!options.includeGrid) hide(this.gridOverlay.view as unknown as Container);
    if (!options.includeBackground || doc.ebene?.bodenTransparent) hide(this.mapBackground);
    // Die Karten darunter sind nur Anschauung im Editor.
    hide(this.unterlage);

    // Layer, die im Panel vom Export ausgenommen sind, verschwinden ebenfalls.
    for (const [id, container] of this.layerContainers) {
      const layer = doc.layers[id];
      if (layer && !layer.includeInExport) hide(container);
      else if (options.onlyLayer !== undefined && id !== options.onlyLayer) hide(container);
    }

    const previousCamera = { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom };
    const previousTransform = {
      x: this.world.position.x,
      y: this.world.position.y,
      scale: this.world.scale.x,
    };
    restore.push(() => {
      this.camera.x = previousCamera.x;
      this.camera.y = previousCamera.y;
      this.camera.setZoom(previousCamera.zoom);
      this.world.position.set(previousTransform.x, previousTransform.y);
      this.world.scale.set(previousTransform.scale);
    });

    return () => {
      for (let i = restore.length - 1; i >= 0; i--) restore[i]();
    };
  }

  /**
   * Stellt die Welt so ein, dass Weltpunkt (originX, originY) links oben im
   * Renderziel landet — Grundlage für kachelweises Exportieren.
   */
  setExportView(originX: number, originY: number, scale: number): void {
    this.world.scale.set(scale);
    this.world.position.set(-originX * scale, -originY * scale);
  }

  /** Container für kurzlebige Werkzeug-Vorschauen (Pinselkreis, Gummiband). */
  addOverlay(node: Container): void {
    this.overlay.addChild(node);
  }

  removeOverlay(node: Container): void {
    if (node.parent === this.overlay) this.overlay.removeChild(node);
  }
}

function effectiveAlpha(doc: MapDocument, id: LayerId): number {
  const layer = doc.layers[id];
  if (!layer) return 0;
  let alpha = layer.opacity;
  let parent = layer.parentId;
  while (parent) {
    const p = doc.layers[parent];
    if (!p) break;
    alpha *= p.opacity;
    parent = p.parentId;
  }
  return alpha;
}

/**
 * Prüfsumme über die Stützpunkte.
 *
 * Die Zahl selbst interessiert nicht — nur, ob sie sich geändert hat. Die
 * ganzen Koordinaten in den Schlüssel zu schreiben wäre bei einem Freihandzug
 * aus zweitausend Punkten eine Zeichenkette von zwanzigtausend Zeichen, die bei
 * jedem Bild neu entstünde. Auf Viertelpixel gerundet, weil feiner niemand
 * sieht und Gleitkommarauschen sonst grundlos neu zeichnen ließe.
 */
function pointsHash(points: number[]): number {
  let h = 2166136261;
  for (let i = 0; i < points.length; i++) {
    h ^= Math.round(points[i] * 4);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Ändert sich dieser Schlüssel, muss der Knoten neu gebaut statt aktualisiert
 * werden.
 *
 * **Was hier hineingehört.** Alles, was in die Zeichnung *eingebacken* wird.
 * Position, Drehung, Deckkraft und bei Props Färbung und Spiegelung setzt
 * `applyTransform` bei jedem Abgleich neu — die stehen deshalb nicht hier. Die
 * Geometrie einer Zeichnung dagegen steckt fest im Graphics-Objekt: ohne die
 * Punkte im Schlüssel blieb ein verschobener Stützpunkt im Bild stehen, wo er
 * war, obwohl das Modell längst den neuen Ort kannte.
 */
/**
 * Eine gefüllte Fläche als eigenes Bild statt als Zeichnung.
 *
 * **Warum das sein muss.** Eine mit dem Terrain-Pinsel gemalte Fläche ist ein
 * einziges Polygon, dessen Kontur sich überschlägt — überall dort, wo der
 * Strich sich selbst kreuzt oder enger biegt, als der Pinsel breit ist. Beim
 * Zeichnen wird so ein Polygon in Dreiecke zerlegt, die einander überlappen,
 * und überlappende Dreiecke werden zweimal gefüllt. Bei voller Deckkraft
 * sieht man davon nichts; sobald die Fläche durchscheinend ist, treten die
 * Lagen des Striches hervor, und aus dem Boden wird ein Stapel.
 *
 * Der Ausweg: die Fläche einmal **voll deckend** in ein eigenes Bild zeichnen
 * — dort schadet die doppelte Füllung nicht, deckend über deckend bleibt
 * deckend — und dieses Bild dann mit der gewünschten Deckkraft anzeigen. Das
 * Bild ist ein einziges Viereck, da gibt es nichts mehr zu überlappen.
 *
 * `cacheAsTexture` von Pixi tut dem Anschein nach dasselbe, hat den Fehler in
 * der Messung aber nicht behoben — deshalb die eigene Textur, die wir in der
 * Hand haben.
 *
 * **Die Schärfe** hängt an der Zoomstufe, mit der das Bild gebacken wurde.
 * `zoomDerTextur` hält sie fest; der Renderer backt neu, wenn sich der Zoom
 * weit genug davon entfernt hat. Ohne das wäre die Fläche beim Hineinzoomen
 * matschig.
 */
class FlaechenBild extends Sprite {
  /** Deckkraft der Füllung — steckt nicht im Bild, sondern kommt hier obendrauf. */
  fuellDeckkraft = 1;
  /** Bei welcher Zoomstufe gebacken wurde. */
  zoomDerTextur = 1;

  override destroy(options?: Parameters<Sprite['destroy']>[0]): void {
    const tex = this.texture;
    super.destroy(options);
    // Die Textur gehört diesem Sprite allein; ohne das bliebe sie im Speicher.
    tex?.destroy(true);
  }
}

/** So weit darf der Zoom von der gebackenen Schärfe abweichen, bevor neu gebacken wird. */
const SCHAERFE_TOLERANZ = 2;
/** Deckel für die Bildgröße, damit eine riesige Fläche nicht den Speicher sprengt. */
const MAX_TEXEL = 2048;

function viewKey(obj: MapObject): string {
  switch (obj.kind) {
    case 'prop':
      return `prop:${obj.propId}:${variantFor(obj.propId, obj.seed)}`;
    case 'shape':
      return `shape:${obj.shape}:${obj.points.length}:${pointsHash(obj.points)}:${obj.closed}:${obj.stroke?.width ?? 0}:${
        obj.stroke?.color ?? -1
      }:${obj.fill?.color ?? -1}:${obj.fill?.alpha ?? -1}:${obj.stroke?.alpha ?? -1}:${obj.blend}:${
        obj.fill?.gradient
          ? `${obj.fill.gradient.color},${obj.fill.gradient.angle},${obj.fill.gradient.type}`
          : ''
      }:${obj.stroke?.dash.join(',') ?? ''}:${
        obj.fill?.pattern
          ? `${obj.fill.pattern.kind},${obj.fill.pattern.size},${obj.fill.pattern.color},${obj.fill.pattern.alpha},${obj.fill.pattern.angle}`
          : ''
      }:${obj.route ? `${obj.route.perDay},${obj.route.marks}` : ''}`;
    case 'text':
      return `text:${obj.text}:${obj.fontFamily}:${obj.fontSize}:${obj.bold}:${obj.italic}:${obj.color}:${obj.align}:${obj.letterSpacing}:${obj.lineHeight}:${obj.strokeColor}:${obj.strokeWidth}:${obj.curvature ?? 0}`;
  }
}

/** Nur für Tests und Werkzeuge: prüft, ob ein Prop bereits eine Textur hat. */
export function propDefExists(propId: string): boolean {
  return !!getProp(propId);
}
