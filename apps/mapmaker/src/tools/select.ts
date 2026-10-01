/**
 * Auswahl-Werkzeug: anklicken, verschieben, Gummiband, Alt-Ziehen zum Klonen.
 *
 * Fasst zwei Welten an: Layer-Objekte und die VTT-Ebene. Beide bleiben im
 * Modell getrennt — Wände, Türen und Lichter liegen in eigenen Arrays und
 * werden mit eigenen Befehlen verändert. Der Auswahlfilter im Store
 * entscheidet, was davon gerade anfassbar ist.
 */

import { Graphics } from 'pixi.js';
import { PatchObjects, AddObjects, PatchVttItems } from '@/model/commands';
import { withAnchoredLabels } from '@/model/labelAnchor';
import { guideAt, guideOnMap, guidesOf, snapToGuides } from '@/model/guides';
import { SetGuides } from '@/model/commands';
import { snapPoint } from '@/model/grid';
import { translatePoints } from '@/model/geometry';
import {
  groupHandles,
  halfExtents,
  localCenterOffset,
  nearestHandle,
  objectCenter,
  pickHandle,
  pickInRect,
  pickAllObjects,
  pickObject,
  selectionBounds,
  type HandleId,
} from '@/engine/hitTest';
import { scalePatch } from '@/model/scaleObject';
import { insertPoint, movePoint, pickNode, removePoint } from '@/model/pathEdit';
import {
  allowsNonUniformScale,
  rotateAroundCenterPatch,
  rotateGroupPatch,
  scaleGroupPatch,
  type Point,
} from '@/model/groupTransform';
import { expandToGroups, isObjectEditable } from '@/model/document';
import { makeId } from '@/model/ids';
import { emptyVttSelection, vttSelectionSize } from '@/model/store';
import type { SelectFilter } from '@/model/toolSettings';
import type { MapObject, ObjectId, Portal, Wall } from '@/model/types';
import { pickNote, pickVtt, pickVttInRect } from './vttPick';
import { TextTool } from './text';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

type Mode = 'idle' | 'drag' | 'rubberband' | 'transform' | 'node' | 'guide';

/** Ausgangslage beim Ziehen an einem Griff. */
interface TransformStart {
  handle: HandleId;
  objectId: ObjectId;
  /** Mittelpunkt des Objekts — Dreh- und Skalierzentrum. */
  center: { x: number; y: number };
  /** Halbe Ausdehnung zu Beginn, für den Skalierfaktor. */
  half: { hw: number; hh: number };
  /**
   * Das Objekt, wie es beim Anfassen aussah.
   *
   * Der Faktor wird jedes Mal gegen *diesen* Stand gerechnet, nicht gegen den
   * laufend veränderten: sonst multipliziert sich jede Mausbewegung auf die
   * vorige und das Objekt wächst nach wenigen Pixeln ins Unermessliche.
   */
  startObject: MapObject;
  startRotation: number;
  /** Abstand der Mitte vom Ursprung im eigenen System — fuer die Drehung. */
  startLocalCenter: Point;
  /** Winkel vom Mittelpunkt zum Zeiger beim Anfassen. */
  startAngle: number;
  /**
   * Bei mehreren Objekten: alle Ausgangszustände. Leer heißt Einzelobjekt.
   *
   * Auch hier gilt, was oben zu `startObject` steht — gegen den Anfangszustand
   * rechnen, nicht gegen den laufenden.
   */
  startGroup: MapObject[];
}

/** Ausgangslage eines VTT-Elements beim Ziehen. */
interface VttStart {
  walls: Map<string, number[]>;
  portals: Map<string, [number, number, number, number]>;
  lights: Map<string, { x: number; y: number }>;
}

function emptyVttStart(): VttStart {
  return { walls: new Map(), portals: new Map(), lights: new Map() };
}

/** Darf dieses Objekt nach dem Filter angefasst werden? */
function objectAllowed(o: MapObject, filter: SelectFilter): boolean {
  if (o.kind === 'prop') return filter.props;
  if (o.kind === 'shape') return filter.shapes;
  return filter.texts;
}

export class SelectTool implements Tool {
  readonly cursor = 'default';

  private mode: Mode = 'idle';
  /** Die gerade gezogene Hilfslinie. */
  private guideId = '';
  private startWorld = { x: 0, y: 0 };
  private startPositions = new Map<ObjectId, { x: number; y: number }>();
  private vttStart: VttStart = emptyVttStart();
  /** Objekt, dessen Position beim Fangen maßgeblich ist. */
  private anchorId: ObjectId | null = null;
  /** Ankerpunkt, wenn nur VTT-Elemente gezogen werden. */
  private vttAnchor: { x: number; y: number } | null = null;
  private transform: TransformStart | null = null;
  /** Gezogener Stützpunkt beim Pfad-Bearbeiten. */
  private nodeIndex = -1;
  private rubber = new Graphics();
  private rubberAttached = false;
  private moved = false;
  /**
   * Durchklicken übereinanderliegender Objekte (Rückmeldung): Stelle des
   * letzten Klicks ohne Ziehen und der Stapel des laufenden Klicks.
   */
  private letzterKlick: { x: number; y: number } | null = null;
  private durchklick: { stapel: ObjectId[]; index: number } | null = null;
  /**
   * Das Textwerkzeug, das beim Doppelklick übernimmt.
   *
   * Gemeldet wurde „den Text einer Region kann man nicht bearbeiten". Man
   * konnte — aber nur, indem man vorher auf das Textwerkzeug wechselte, und
   * darauf kommt niemand: die Beschriftung entsteht beim Zeichnen der Region
   * zusammen mit der Fläche, also erwartet man sie auch dort zu ändern. Der
   * Doppelklick ist die Geste, die überall sonst Text öffnet.
   *
   * Eigene Instanz und nicht die des Managers — aus demselben Grund, aus dem
   * das Prop-Werkzeug eine eigene Auswahl mitführt: geteilter Zustand endet
   * in Zügen, die im falschen Werkzeug hängenbleiben.
   */
  private textTool = new TextTool();

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button !== 0) return;
    const { doc } = ctx;
    const state = ctx.state;
    const filter = state.selectFilter;

    this.startWorld = { ...e.world };
    this.moved = false;

    // Pfad-Bearbeitung geht allem vor: solange sie läuft, sind die Griffe auf
    // dem Objekt Stützpunkte und keine Skaliergriffe.
    if (this.tryEditPath(ctx, e)) return;

    // Griffe zuerst: sie liegen teils außerhalb des Objekts und würden sonst
    // vom Gummiband geschluckt.
    if (this.tryGrabHandle(ctx, e)) return;

    // Dann die Hilfslinien — aber nur mit sehr enger Toleranz und nur, wenn
    // kein Objekt darunter liegt. Eine Hilfslinie soll greifbar sein, ohne
    // Klicks zu stehlen, die dem Karteninhalt galten.
    if (this.tryGrabGuide(ctx, e)) return;

    const stapel = pickAllObjects(doc, e.world, ctx.renderer.textMetrics, (o) =>
      objectAllowed(o, filter),
    );
    let hit: MapObject | null = stapel[0] ?? null;

    // Erneuter Klick an derselben Stelle: das schon Gewählte bleibt der
    // Treffer (so lässt es sich weiter ziehen), und erst beim Loslassen ohne
    // Ziehen geht die Auswahl eine Ebene tiefer.
    this.durchklick = null;
    const gleicheStelle =
      !!this.letzterKlick &&
      Math.hypot(e.world.x - this.letzterKlick.x, e.world.y - this.letzterKlick.y) * ctx.renderer.camera.zoom < 5;
    if (hit && gleicheStelle && !e.shift && !e.alt && stapel.length > 1) {
      const index = stapel.findIndex((o) => state.selection.includes(o.id));
      if (index >= 0) {
        hit = stapel[index];
        this.durchklick = { stapel: stapel.map((o) => o.id), index };
      }
    }

    // Ein Objekt gewinnt gegen die VTT-Ebene: es liegt sichtbar obenauf,
    // während Wände und Lichter nur Hilfslinien sind.
    if (!hit) {
      const vttHit = pickVtt(doc, e.world, 14 / ctx.renderer.camera.zoom, filter);
      if (vttHit) {
        if (e.shift) {
          state.toggleVttSelection(vttHit.kind, vttHit.id, true);
        } else if (!state.vttSelection[vttHit.kind].includes(vttHit.id)) {
          state.setSelection([]);
          state.setVttSelection({ ...emptyVttSelection(), [vttHit.kind]: [vttHit.id] });
        }
        this.beginDrag(ctx);
        return;
      }

      this.mode = 'rubberband';
      if (!e.shift) state.clearSelection();
      this.attachRubber(ctx);
      return;
    }

    // Wer ein Objekt einer Gruppe anklickt, meint die ganze Gruppe.
    const getroffen = expandToGroups(doc, [hit.id]);

    let selection = state.selection;
    if (e.shift) {
      const schon = selection.includes(hit.id);
      const naechste = schon
        ? selection.filter((id) => !getroffen.includes(id))
        : [...new Set([...selection, ...getroffen])];
      state.setSelection(naechste);
      selection = naechste;
    } else if (!selection.includes(hit.id)) {
      state.setSelection(getroffen);
      state.setVttSelection(emptyVttSelection());
      selection = getroffen;
    }

    // Alt dupliziert: die Kopien werden gezogen, das Original bleibt liegen.
    if (e.alt && selection.length > 0) {
      selection = this.cloneSelection(ctx, selection);
    }

    this.anchorId = hit.id in ctx.doc.objects && selection.includes(hit.id) ? hit.id : selection[0];
    this.beginDrag(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (this.mode === 'node') {
      this.dragNode(ctx, e);
      return;
    }
    if (this.mode === 'transform') {
      this.applyTransform(ctx, e);
      return;
    }
    if (this.mode === 'rubberband') {
      this.drawRubber(ctx, e);
      return;
    }
    if (this.mode === 'guide') {
      this.dragGuide(ctx, e);
      return;
    }
    if (this.mode !== 'drag') return;
    if (this.startPositions.size === 0 && this.vttDragSize === 0) return;

    let dx = e.world.x - this.startWorld.x;
    let dy = e.world.y - this.startWorld.y;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) this.moved = true;

    // Fangen richtet sich nach dem angefassten Element; alle anderen behalten
    // ihren relativen Abstand, sonst zerfällt eine Gruppe beim Verschieben.
    const anchorStart = this.anchorId
      ? this.startPositions.get(this.anchorId)
      : (this.vttAnchor ?? undefined);
    if (anchorStart && !e.ctrl) {
      let ziel = { x: anchorStart.x + dx, y: anchorStart.y + dy };
      if (ctx.doc.grid.snap !== 'none') ziel = snapPoint(ctx.doc.grid, ziel);
      // Hilfslinien *nach* dem Raster und damit stärker als es: wer eine Linie
      // gesetzt hat, meint genau diese Stelle und nicht die Rasterecke daneben.
      ziel = snapToGuides(ctx.doc, ziel, 6 / ctx.renderer.camera.zoom);
      dx = ziel.x - anchorStart.x;
      dy = ziel.y - anchorStart.y;
    }

    if (this.startPositions.size > 0) {
      const patches = new Map<ObjectId, Record<string, unknown>>();
      for (const [id, start] of this.startPositions) {
        patches.set(id, { x: start.x + dx, y: start.y + dy });
      }
      ctx.exec(new PatchObjects(patches, t('cmd.move'), 'move'));
    }

    this.moveVtt(ctx, dx, dy);
  }

  onPointerUp(e: ToolPointerEvent, ctx: ToolContext): void {
    if (this.mode === 'rubberband') {
      const rect = {
        minX: Math.min(this.startWorld.x, e.world.x),
        minY: Math.min(this.startWorld.y, e.world.y),
        maxX: Math.max(this.startWorld.x, e.world.x),
        maxY: Math.max(this.startWorld.y, e.world.y),
      };
      // Winziges Rechteck heißt: es war ein Klick ins Leere, keine Auswahl.
      if (rect.maxX - rect.minX > 2 || rect.maxY - rect.minY > 2) {
        const filter = ctx.state.selectFilter;
        const ids = pickInRect(ctx.doc, rect, ctx.renderer.textMetrics, (o) =>
          objectAllowed(o, filter),
        );
        const mitGruppen = expandToGroups(ctx.doc, ids);
        const merged = e.shift
          ? [...new Set([...ctx.state.selection, ...mitGruppen])]
          : mitGruppen;
        ctx.state.setSelection(merged);

        const vttHits = pickVttInRect(ctx.doc, rect, filter);
        const next = e.shift
          ? { ...ctx.state.vttSelection }
          : emptyVttSelection();
        for (const ref of vttHits) {
          if (!next[ref.kind].includes(ref.id)) next[ref.kind] = [...next[ref.kind], ref.id];
        }
        ctx.state.setVttSelection(next);
      }
      this.detachRubber(ctx);
    }

    // Eine Hilfslinie, die außerhalb der Karte landet, ist weg — dieselbe
    // Geste wie in Zeichenprogrammen, und sie ist der einzige Weg, eine
    // einzelne wieder loszuwerden.
    if (this.mode === 'guide') {
      const guide = guidesOf(ctx.doc).find((g) => g.id === this.guideId);
      if (guide && !guideOnMap(guide, ctx.doc.size, ctx.doc.grid.tileSize)) {
        ctx.exec(
          new SetGuides(
            guidesOf(ctx.doc).filter((g) => g.id !== this.guideId),
            t('cmd.guides'),
            `guide:${this.guideId}`,
          ),
        );
      }
      ctx.endTransaction();
      this.guideId = '';
    }

    if (this.mode === 'drag' || this.mode === 'transform' || this.mode === 'node') {
      ctx.endTransaction();
    }

    // Durchklicken: ein Klick ohne Ziehen auf ein Objekt merkt sich die Stelle;
    // der nächste Klick dort wählt das Objekt darunter (am Ende wieder oben).
    const klickAufObjekt = this.mode === 'drag' && !this.moved && this.startPositions.size > 0;
    if (klickAufObjekt && this.durchklick) {
      const { stapel, index } = this.durchklick;
      const naechstes = stapel[(index + 1) % stapel.length];
      ctx.state.setSelection(expandToGroups(ctx.doc, [naechstes]));
      ctx.state.setVttSelection(emptyVttSelection());
    }
    this.letzterKlick = klickAufObjekt && !e.shift ? { ...this.startWorld } : null;
    this.durchklick = null;
    this.mode = 'idle';
    this.startPositions.clear();
    this.vttStart = emptyVttStart();
    this.anchorId = null;
    this.vttAnchor = null;
    this.transform = null;
    this.nodeIndex = -1;
  }

  /**
   * Doppelklick auf eine Beschriftung öffnet sie zum Bearbeiten.
   *
   * Bewusst ohne Werkzeugwechsel: wer eine Region ausgewählt hat und ihren
   * Namen ändert, will danach weiter auswählen, nicht plötzlich Text setzen.
   */
  onDoubleClick(e: ToolPointerEvent, ctx: ToolContext): void {
    const hit = pickObject(ctx.doc, e.world, ctx.renderer.textMetrics, (o) =>
      objectAllowed(o, ctx.state.selectFilter),
    );
    /*
     * Eine Notiz zählt hier mit, obwohl sie kein Objekt im Layer-Sinn ist.
     *
     * Sonst wäre das Notiz-Werkzeug der einzige Weg zum Text einer Notiz —
     * und wer beim Auswählen einen Pin doppelt anklickt, meint ganz sicher
     * nicht „neue Notiz daneben". Objekte gewinnen, wie beim einfachen Klick.
     */
    const notiz =
      !hit && ctx.state.selectFilter.notes
        ? pickNote(ctx.doc, e.world, 14 / ctx.renderer.camera.zoom)
        : null;
    if (!hit && !notiz) return;
    // Ein laufender Zug aus dem vorangegangenen Druck darf nicht offen bleiben.
    // Eine Hilfslinie, die außerhalb der Karte landet, ist weg — dieselbe
    // Geste wie in Zeichenprogrammen, und sie ist der einzige Weg, eine
    // einzelne wieder loszuwerden.
    if (this.mode === 'guide') {
      const guide = guidesOf(ctx.doc).find((g) => g.id === this.guideId);
      if (guide && !guideOnMap(guide, ctx.doc.size, ctx.doc.grid.tileSize)) {
        ctx.exec(
          new SetGuides(
            guidesOf(ctx.doc).filter((g) => g.id !== this.guideId),
            t('cmd.guides'),
            `guide:${this.guideId}`,
          ),
        );
      }
      ctx.endTransaction();
      this.guideId = '';
    }

    if (this.mode === 'drag' || this.mode === 'transform' || this.mode === 'node') {
      ctx.endTransaction();
    }
    this.mode = 'idle';

    if (notiz) {
      ctx.state.setSelection([]);
      ctx.state.setVttSelection({ ...emptyVttSelection(), notes: [notiz.id] });
      ctx.state.setEditingNoteId(notiz.id);
      return;
    }
    if (!hit) return;

    if (hit.kind === 'text') {
      ctx.state.setSelection([hit.id]);
      this.textTool.beginEdit(ctx, hit);
      return;
    }

    /**
     * Bei einer Zeichnung öffnet derselbe Doppelklick die Stützpunkte.
     *
     * Dieselbe Geste wie beim Text, aus demselben Grund: die Form ist da, wo
     * man sie sieht, also erwartet man sie auch dort zu ändern. Ein eigenes
     * Werkzeug in der Leiste fände nur, wer danach sucht.
     */
    if (hit.kind === 'shape' && isObjectEditable(ctx.doc, hit.id)) {
      ctx.state.setSelection([hit.id]);
      ctx.state.setEditingPathId(hit.id);
      ctx.state.setStatusMessage(t('status.pathEdit'));
    }
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): boolean {
    // Escape gehört während der Eingabe dem Textfeld, nicht der Auswahl.
    if (this.textTool.editing) return this.textTool.onKeyDown?.(e, ctx) ?? false;

    if (e.key === 'Escape' && ctx.state.editingPathId) {
      ctx.state.setEditingPathId(null);
      return true;
    }
    return false;
  }

  deactivate(ctx: ToolContext): void {
    if (this.textTool.editing) this.textTool.deactivate?.(ctx);
    if (this.mode === 'drag' || this.mode === 'transform' || this.mode === 'node') {
      ctx.endTransaction();
    }
    // Die Griffe gehören zu diesem Werkzeug; wer wechselt, soll sie nicht
    // an einem Objekt stehen lassen, das ein anderes Werkzeug gerade anfasst.
    if (ctx.state.editingPathId) ctx.state.setEditingPathId(null);
    this.detachRubber(ctx);
    this.mode = 'idle';
    this.startPositions.clear();
    this.vttStart = emptyVttStart();
  }

  // -------------------------------------------------------------------------

  /**
   * Liegt der Zeiger auf einem Griff? Dann beginnt Drehen oder Skalieren.
   *
   * Nur bei genau einem ausgewählten Objekt: eine Gruppe gemeinsam zu
   * transformieren ist etwas anderes, und der Renderer zeigt dafür auch
   * keine Griffe an.
   */
  /**
   * Würde ein Druck hier etwas an der bestehenden Auswahl anfassen?
   *
   * Reine Frage ohne Nebenwirkung — gedacht für andere Werkzeuge, die das
   * Auswahl-Werkzeug zeitweise übernehmen lassen wollen. Das Prop-Werkzeug
   * fragt danach: liegt der Zeiger auf einem Griff oder auf einem schon
   * ausgewählten Objekt, wird gedreht und skaliert statt neu gesetzt.
   *
   * Bewusst *nur* Griffe und bereits Ausgewähltes. Alles Weitere, was das
   * Auswahl-Werkzeug kann — Gummiband, neue Auswahl, VTT-Elemente —, gehört
   * nicht dazu: wer mit dem Prop-Werkzeug ins Leere klickt, will setzen.
   */
  wouldGrab(ctx: ToolContext, e: ToolPointerEvent): boolean {
    const sel = ctx.state.selection;
    if (sel.length === 0 || vttSelectionSize(ctx.state.vttSelection) > 0) return false;

    const zoom = ctx.renderer.camera.zoom;
    const toleranz = 9 / zoom;
    /**
     * Beweglich ist, was auch *anfassbar* ist.
     *
     * Nicht nur das Schloss am Objekt: ein gesperrter oder ausgeblendeter Layer
     * schützt seinen Inhalt genauso. `pickObject` beachtet das längst — eine
     * Auswahl, die vor dem Sperren entstanden ist, ließ sich aber weiter
     * ziehen, drehen und löschen. Das Schloss galt dann nur für neue Klicks.
     */
    const beweglich = sel.filter((id) => isObjectEditable(ctx.doc, id));
    if (beweglich.length === 0) return false;

    if (sel.length === 1) {
      const obj = ctx.doc.objects[sel[0]];
      if (obj && isObjectEditable(ctx.doc, obj.id) &&
          pickHandle(ctx.doc, obj, e.world, zoom, toleranz, ctx.renderer.textMetrics))
        return true;
    } else {
      const b = selectionBounds(ctx.doc, sel, ctx.renderer.textMetrics);
      if (b && nearestHandle(groupHandles(b, zoom), e.world, toleranz)) return true;
    }

    // Kein Griff — dann zählt noch, ob ein ausgewähltes Objekt selbst
    // getroffen ist. Das ist der Fall „schon gesetztes Prop verschieben".
    const hit = pickObject(ctx.doc, e.world, ctx.renderer.textMetrics, (o) =>
      objectAllowed(o, ctx.state.selectFilter),
    );
    return !!hit && sel.includes(hit.id) && !hit.locked;
  }

  /**
   * Pfad-Bearbeitung: Stützpunkt ziehen, einfügen, entfernen.
   *
   * Drei Gesten auf demselben Objekt, und die Reihenfolge entscheidet: erst
   * wird geprüft, ob ein vorhandener Punkt getroffen ist (ziehen, mit Alt
   * entfernen), dann, ob eine Kante getroffen ist (einfügen). Andersherum
   * bekäme man neben jedem Punkt einen zweiten, weil dort immer auch eine
   * Kante liegt.
   *
   * Ein Klick daneben beendet die Bearbeitung. Das ist der Weg hinaus, den
   * man von selbst findet — Escape kann es auch, aber daran denkt niemand.
   */
  private tryEditPath(ctx: ToolContext, e: ToolPointerEvent): boolean {
    const id = ctx.state.editingPathId;
    if (!id) return false;

    const obj = ctx.doc.objects[id];
    if (!obj || obj.kind !== 'shape' || !isObjectEditable(ctx.doc, id)) {
      ctx.state.setEditingPathId(null);
      return false;
    }

    const toleranz = 9 / ctx.renderer.camera.zoom;
    const node = pickNode(obj, e.world.x, e.world.y, toleranz);

    if (node) {
      if (e.alt) {
        const punkte = removePoint(obj, node.index);
        if (!punkte) {
          // Sagen, warum nichts passiert — sonst wirkt das Werkzeug kaputt.
          ctx.state.setStatusMessage(t('status.pathMinPoints'));
          return true;
        }
        ctx.exec(new PatchObjects(new Map([[id, { points: punkte }]]), t('cmd.removePoint')));
        return true;
      }
      this.mode = 'node';
      this.nodeIndex = node.index;
      ctx.beginTransaction();
      return true;
    }

    const eingefuegt = insertPoint(obj, e.world.x, e.world.y, toleranz * 1.5);
    if (eingefuegt) {
      ctx.exec(
        new PatchObjects(new Map([[id, { points: eingefuegt.points }]]), t('cmd.addPoint')),
      );
      // Gleich weiterziehen: der neue Punkt sitzt auf der Kante, und dort
      // wollte ihn niemand haben — er soll ja die Form ändern.
      this.mode = 'node';
      this.nodeIndex = eingefuegt.index;
      ctx.beginTransaction();
      return true;
    }

    ctx.state.setEditingPathId(null);
    return false;
  }

  /** Zieht den angefassten Stützpunkt mit. */
  private dragNode(ctx: ToolContext, e: ToolPointerEvent): void {
    const id = ctx.state.editingPathId;
    if (!id || this.nodeIndex < 0) return;
    const obj = ctx.doc.objects[id];
    if (!obj || obj.kind !== 'shape') return;

    const ziel = e.ctrl ? e.world : snapPoint(ctx.doc.grid, e.world);
    const punkte = movePoint(obj, this.nodeIndex, ziel.x, ziel.y);
    if (!punkte) return;
    this.moved = true;
    // mergeKey: das ganze Ziehen ist ein Rückgängig-Schritt, nicht hundert.
    ctx.exec(
      new PatchObjects(new Map([[id, { points: punkte }]]), t('cmd.movePoint'), `node:${id}`),
    );
  }

  private tryGrabHandle(ctx: ToolContext, e: ToolPointerEvent): boolean {
    const sel = ctx.state.selection;
    if (sel.length === 0 || vttSelectionSize(ctx.state.vttSelection) > 0) return false;

    const zoom = ctx.renderer.camera.zoom;
    const toleranz = 9 / zoom;

    if (sel.length === 1) {
      const obj = ctx.doc.objects[sel[0]];
      if (!obj || !isObjectEditable(ctx.doc, obj.id)) return false;
      const handle = pickHandle(ctx.doc, obj, e.world, zoom, toleranz, ctx.renderer.textMetrics);
      if (!handle) return false;

      const center = objectCenter(ctx.doc, obj);
      this.transform = {
        handle: handle.id,
        objectId: obj.id,
        center,
        half: halfExtents(ctx.doc, obj, ctx.renderer.textMetrics),
        startObject: structuredClone(obj),
        startRotation: obj.rotation,
        startLocalCenter: localCenterOffset(obj),
        startAngle: Math.atan2(e.world.y - center.y, e.world.x - center.x),
        startGroup: [],
      };
      this.mode = 'transform';
      ctx.beginTransaction();
      return true;
    }

    // Mehrfachauswahl: Griffe auf der gemeinsamen Hülle.
    const beweglich = sel
      .filter((id) => isObjectEditable(ctx.doc, id))
      .map((id) => ctx.doc.objects[id]);
    if (beweglich.length === 0) return false;
    const b = selectionBounds(ctx.doc, sel, ctx.renderer.textMetrics);
    if (!b) return false;

    const handle = nearestHandle(groupHandles(b, zoom), e.world, toleranz);
    if (!handle) return false;

    const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    this.transform = {
      handle: handle.id,
      objectId: beweglich[0].id,
      center,
      half: { hw: (b.maxX - b.minX) / 2, hh: (b.maxY - b.minY) / 2 },
      startObject: structuredClone(beweglich[0]),
      startRotation: 0,
      startLocalCenter: { x: 0, y: 0 },
      startAngle: Math.atan2(e.world.y - center.y, e.world.x - center.x),
      startGroup: beweglich.map((o) => structuredClone(o)),
    };
    this.mode = 'transform';
    ctx.beginTransaction();
    return true;
  }

  private applyTransform(ctx: ToolContext, e: ToolPointerEvent): void {
    const tr = this.transform;
    if (!tr) return;
    if (tr.startGroup.length > 0) {
      this.applyGroupTransform(ctx, e, tr);
      return;
    }
    const obj = ctx.doc.objects[tr.objectId];
    if (!obj) return;
    this.moved = true;

    if (tr.handle === 'rotate') {
      const winkel = Math.atan2(e.world.y - tr.center.y, e.world.x - tr.center.x);
      let rotation = tr.startRotation + (winkel - tr.startAngle);
      // Dreh-Fang aus den Grid-Einstellungen; Strg hebt ihn auf.
      const schritt = ctx.doc.grid.rotationSnapDeg;
      if (schritt > 0 && !e.ctrl) {
        const rad = (schritt * Math.PI) / 180;
        rotation = Math.round(rotation / rad) * rad;
      }
      ctx.exec(
        new PatchObjects(
          new Map([[obj.id, rotateAroundCenterPatch(tr.startLocalCenter, tr.center, rotation)]]),
          t('sel.rotation'),
          'transform-rot',
        ),
      );
      return;
    }

    // Skalieren: der Zeiger wird ins unrotierte System des Objekts gerechnet,
    // dann ergibt sich der Faktor aus dem Abstand zum Mittelpunkt.
    const cos = Math.cos(-tr.startRotation);
    const sin = Math.sin(-tr.startRotation);
    const dx = e.world.x - tr.center.x;
    const dy = e.world.y - tr.center.y;
    const lx = Math.abs(dx * cos - dy * sin);
    const ly = Math.abs(dx * sin + dy * cos);

    let fx = tr.half.hw > 0.001 ? lx / tr.half.hw : 1;
    let fy = tr.half.hh > 0.001 ? ly / tr.half.hh : 1;
    // Umschalt hält die Seitenverhältnisse — der übliche Griff.
    if (e.shift) {
      const f = Math.max(fx, fy);
      fx = f;
      fy = f;
    }

    const patch = scalePatch(tr.startObject, fx, fy);
    if (!patch) return;
    ctx.exec(
      new PatchObjects(new Map([[obj.id, patch]]), t('sel.scale'), 'transform-scale'),
    );
  }

  /**
   * Dieselbe Geste für mehrere Objekte.
   *
   * Gedreht und skaliert wird um den Mittelpunkt der gemeinsamen Hülle; die
   * Rechnung selbst steht im Modell (`groupTransform.ts`), damit sie prüfbar
   * ist und der Sonderfall der gedrehten Mitglieder dort erklärt steht.
   */
  private applyGroupTransform(
    ctx: ToolContext,
    e: ToolPointerEvent,
    tr: TransformStart,
  ): void {
    this.moved = true;

    if (tr.handle === 'rotate') {
      const winkel = Math.atan2(e.world.y - tr.center.y, e.world.x - tr.center.x);
      let delta = winkel - tr.startAngle;
      const schritt = ctx.doc.grid.rotationSnapDeg;
      if (schritt > 0 && !e.ctrl) {
        const rad = (schritt * Math.PI) / 180;
        delta = Math.round(delta / rad) * rad;
      }
      ctx.exec(
        new PatchObjects(
          rotateGroupPatch(tr.startGroup, tr.center, delta),
          t('sel.rotation'),
          'group-rot',
        ),
      );
      return;
    }

    const lx = Math.abs(e.world.x - tr.center.x);
    const ly = Math.abs(e.world.y - tr.center.y);
    let fx = tr.half.hw > 0.001 ? lx / tr.half.hw : 1;
    let fy = tr.half.hh > 0.001 ? ly / tr.half.hh : 1;
    // Umschalt hält die Seitenverhältnisse — und bei gedrehten Mitgliedern
    // bleibt ohnehin nur das, siehe groupTransform.ts.
    if (e.shift || !allowsNonUniformScale(tr.startGroup)) {
      const f = Math.max(fx, fy);
      fx = f;
      fy = f;
    }

    ctx.exec(
      new PatchObjects(
        scaleGroupPatch(tr.startGroup, tr.center, fx, fy),
        t('sel.scale'),
        'group-scale',
      ),
    );
  }

  private get vttDragSize(): number {
    return this.vttStart.walls.size + this.vttStart.portals.size + this.vttStart.lights.size;
  }

  /**
   * Eine Hilfslinie unter dem Zeiger anfassen.
   *
   * Erst wenn dort kein Objekt liegt: der Karteninhalt hat Vorrang. Gezogen
   * wird sie über denselben Befehl wie beim Herausziehen aus dem Lineal, mit
   * demselben Verschmelzungsschlüssel — also ein Rückgängig-Schritt. Wer sie
   * aus der Karte hinausschiebt, wird sie los.
   */
  private tryGrabGuide(ctx: ToolContext, e: ToolPointerEvent): boolean {
    if (!ctx.state.rulers) return false;
    if (pickObject(ctx.doc, e.world, ctx.renderer.textMetrics, () => true)) return false;
    const guide = guideAt(ctx.doc, e.world, 5 / ctx.renderer.camera.zoom);
    if (!guide) return false;
    this.mode = 'guide';
    this.guideId = guide.id;
    ctx.beginTransaction();
    return true;
  }

  private dragGuide(ctx: ToolContext, e: ToolPointerEvent): void {
    const alt = guidesOf(ctx.doc).find((g) => g.id === this.guideId);
    if (!alt) return;
    const pos = alt.axis === 'x' ? e.world.x : e.world.y;
    const rest = guidesOf(ctx.doc).filter((g) => g.id !== this.guideId);
    ctx.exec(
      new SetGuides([...rest, { ...alt, pos }], t('cmd.guides'), `guide:${this.guideId}`),
    );
  }

  /** Merkt sich die Ausgangslage aller ausgewählten Elemente und öffnet den Undo-Schritt. */
  private beginDrag(ctx: ToolContext): void {
    this.mode = 'drag';
    this.startPositions.clear();
    this.vttStart = emptyVttStart();
    this.vttAnchor = null;

    // Beschriftungen mit Anschluss fahren mit, auch wenn sie nicht ausgewählt
    // sind: „hängt daran" heißt genau das. Sie laufen dabei durch denselben
    // Befehl wie alles andere, also stimmt auch das Rückgängig.
    for (const id of withAnchoredLabels(ctx.doc, ctx.state.selection)) {
      const o = ctx.doc.objects[id];
      if (o && isObjectEditable(ctx.doc, id)) this.startPositions.set(id, { x: o.x, y: o.y });
    }

    const sel = ctx.state.vttSelection;
    for (const wall of ctx.doc.vtt.walls) {
      if (sel.walls.includes(wall.id)) this.vttStart.walls.set(wall.id, [...wall.points]);
    }
    for (const portal of ctx.doc.vtt.portals) {
      if (sel.portals.includes(portal.id)) {
        this.vttStart.portals.set(portal.id, [...portal.bounds]);
      }
    }
    for (const light of ctx.doc.vtt.lights) {
      if (sel.lights.includes(light.id)) {
        this.vttStart.lights.set(light.id, { x: light.x, y: light.y });
      }
    }

    // Ohne Objekt in der Auswahl bestimmt das erste VTT-Element den Fang.
    if (this.startPositions.size === 0) {
      const wall = this.vttStart.walls.values().next();
      const portal = this.vttStart.portals.values().next();
      const light = this.vttStart.lights.values().next();
      if (!wall.done) this.vttAnchor = { x: wall.value[0], y: wall.value[1] };
      else if (!portal.done) this.vttAnchor = { x: portal.value[0], y: portal.value[1] };
      else if (!light.done) this.vttAnchor = { ...light.value };
    }

    ctx.beginTransaction();
  }

  /** Verschiebt die ausgewählten VTT-Elemente um dx/dy — je Art ein Befehl. */
  private moveVtt(ctx: ToolContext, dx: number, dy: number): void {
    if (this.vttStart.walls.size > 0) {
      const patches = new Map<string, Record<string, unknown>>();
      for (const [id, points] of this.vttStart.walls) {
        patches.set(id, { points: translatePoints(points, dx, dy) } satisfies Partial<Wall>);
      }
      ctx.exec(new PatchVttItems('walls', patches, t('cmd.move'), 'move-walls'));
    }

    if (this.vttStart.portals.size > 0) {
      const patches = new Map<string, Record<string, unknown>>();
      for (const [id, b] of this.vttStart.portals) {
        patches.set(id, {
          bounds: [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy],
        } satisfies Partial<Portal>);
      }
      ctx.exec(new PatchVttItems('portals', patches, t('cmd.move'), 'move-portals'));
    }

    if (this.vttStart.lights.size > 0) {
      const patches = new Map<string, Record<string, unknown>>();
      for (const [id, p] of this.vttStart.lights) {
        patches.set(id, { x: p.x + dx, y: p.y + dy });
      }
      ctx.exec(new PatchVttItems('lights', patches, t('cmd.move'), 'move-lights'));
    }
  }

  private cloneSelection(ctx: ToolContext, ids: ObjectId[]): ObjectId[] {
    const clones: MapObject[] = [];
    for (const id of ids) {
      const src = ctx.doc.objects[id];
      if (!src) continue;
      clones.push({ ...src, id: makeId('obj') } as MapObject);
    }
    if (clones.length === 0) return ids;
    ctx.exec(new AddObjects(clones, t('cmd.duplicate')));
    const newIds = clones.map((c) => c.id);
    ctx.state.setSelection(newIds);
    return newIds;
  }

  private attachRubber(ctx: ToolContext): void {
    if (!this.rubberAttached) {
      ctx.renderer.addOverlay(this.rubber);
      this.rubberAttached = true;
    }
    this.rubber.clear();
  }

  private detachRubber(ctx: ToolContext): void {
    this.rubber.clear();
    if (this.rubberAttached) {
      ctx.renderer.removeOverlay(this.rubber);
      this.rubberAttached = false;
    }
  }

  private drawRubber(ctx: ToolContext, e: ToolPointerEvent): void {
    const zoom = ctx.renderer.camera.zoom;
    const x = Math.min(this.startWorld.x, e.world.x);
    const y = Math.min(this.startWorld.y, e.world.y);
    const w = Math.abs(e.world.x - this.startWorld.x);
    const h = Math.abs(e.world.y - this.startWorld.y);
    this.rubber
      .clear()
      .rect(x, y, w, h)
      .fill({ color: 0x4da3ff, alpha: 0.12 })
      .rect(x, y, w, h)
      .stroke({ width: 1 / zoom, color: 0x4da3ff, alpha: 0.9 });
  }

  /** Wurde bei diesem Zug tatsächlich bewegt? Für Klick-ohne-Bewegung-Logik. */
  get didMove(): boolean {
    return this.moved;
  }
}
