/**
 * Raum-Werkzeug: aus einem aufgezogenen Rechteck entstehen umschließende Wände
 * und ein Boden in einem Arbeitsgang.
 *
 * Der übliche Weg — Boden zeichnen, Werkzeug wechseln, vier Wände nachziehen,
 * an den Ecken sauber schließen — ist für den häufigsten Fall eines Dungeons zu
 * umständlich, und die Ecken werden dabei selten dicht. Hier ist der Wandzug
 * von vornherein geschlossen: durch die Ecken leckt in Foundry keine Sicht.
 *
 * Beides ist ein Undo-Schritt, weil es für den Benutzer ein Vorgang war.
 */

import { Graphics } from 'pixi.js';
import { AddObjects, AddVttItems, CompositeCommand, type Command } from '@/model/commands';
import { stilFuer, waehleGesetztes } from './auswahlNachSetzen';
import { snapPoint } from '@/model/grid';
import { makeId } from '@/model/ids';
import type { MapDocument, Wall } from '@/model/types';
import { canHoldObjects } from '@/model/document';
import { createShape } from './factory';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

export class RoomTool implements Tool {
  readonly cursor = 'crosshair';

  private start: { x: number; y: number } | null = null;
  private current: { x: number; y: number } | null = null;
  private preview = new Graphics();
  private attached = false;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button !== 0) return;
    this.start = this.place(ctx, e);
    this.current = { ...this.start };
    this.attach(ctx);
    this.drawPreview(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.start) return;
    this.current = this.place(ctx, e);
    this.drawPreview(ctx);
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.start || !this.current) return;
    const rect = this.rect();
    this.reset(ctx);
    if (!rect) return;

    const s = ctx.state.room;
    const [x0, y0, x1, y1] = rect;

    // Ein Raum ohne beides wäre ein Klick ins Nichts — dann lieber nichts tun
    // und sagen, woran es liegt.
    if (!s.createWalls && !s.createFloor) {
      ctx.state.setStatusMessage(t('room.nothingEnabled'));
      return;
    }

    // Boden und Wände sind ein Benutzervorgang und gehören in einen
    // Undo-Schritt — dafür braucht es den zusammengesetzten Befehl, denn eine
    // Transaktion verschmilzt nur gleichartige Befehle.
    const parts: Command[] = [];
    const layerId = ctx.state.activeLayerId;

    let bodenId: string | null = null;
    if (s.createFloor) {
      if (canHoldObjects(ctx.doc, layerId)) {
        const floor = createShape(
          ctx.doc,
          layerId,
          {
            ...ctx.state.draw,
            shape: 'rect',
            useFill: true,
            fillColor: s.floorColor,
            fillAlpha: 1,
            useStroke: false,
          },
          x0,
          y0,
          [0, 0, x1 - x0, y1 - y0],
          true,
        );
        bodenId = floor.id;
        parts.push(new AddObjects([floor], t('cmd.room')));
      } else {
        ctx.state.setStatusMessage(t('room.layerCannotHold'));
      }
    }

    let wandId: string | null = null;
    if (s.createWalls) {
      const wall: Wall = {
        id: makeId('wall'),
        // Geschlossener Zug: die vierte Kante entsteht aus `closed`, nicht aus
        // einem doppelten Punkt. So gibt es an der Schlussecke keine Lücke.
        points: [x0, y0, x1, y0, x1, y1, x0, y1],
        type: s.wallType,
        closed: true,
        // Sichtbares Mauerwerk als Teil der Wand (model/vttVisuals.ts). Ohne
        // das stünde der Raum für Foundry bereit, im Bild wäre er aber leer.
        ...stilFuer(ctx, s.style),
      };
      wandId = wall.id;
      parts.push(new AddVttItems('walls', [wall], t('cmd.room')));
    }

    if (parts.length === 1) ctx.exec(parts[0]);
    else if (parts.length > 1) ctx.exec(new CompositeCommand(parts, t('cmd.room')));
    // Gleich ausgewählt: Wandtyp, Mauerwerk und Bodenfarbe rechts wirken auf diesen Raum.
    waehleGesetztes(ctx, { walls: wandId ? [wandId] : [] }, bodenId ? [bodenId] : []);
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  // -------------------------------------------------------------------------

  /** Ecken fangen immer am Raster — ein Raum zwischen zwei Feldern ergibt keinen Sinn. */
  private place(ctx: ToolContext, e: ToolPointerEvent): { x: number; y: number } {
    if (e.ctrl) return { ...e.world };
    return snapPoint(ctx.doc.grid, e.world, 'corner');
  }

  /** Normalisiertes Rechteck, oder null wenn es kleiner als ein Feld ist. */
  private rect(): [number, number, number, number] | null {
    if (!this.start || !this.current) return null;
    const x0 = Math.min(this.start.x, this.current.x);
    const y0 = Math.min(this.start.y, this.current.y);
    const x1 = Math.max(this.start.x, this.current.x);
    const y1 = Math.max(this.start.y, this.current.y);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return [x0, y0, x1, y1];
  }

  private attach(ctx: ToolContext): void {
    if (!this.attached) {
      ctx.renderer.addOverlay(this.preview);
      this.attached = true;
    }
  }

  private reset(ctx: ToolContext): void {
    this.start = null;
    this.current = null;
    this.preview.clear();
    if (this.attached) {
      ctx.renderer.removeOverlay(this.preview);
      this.attached = false;
    }
  }

  private drawPreview(ctx: ToolContext): void {
    const rect = this.rect();
    this.preview.clear();
    if (!rect) return;
    const [x0, y0, x1, y1] = rect;
    const s = ctx.state.room;
    const zoom = ctx.renderer.camera.zoom;

    if (s.createFloor) {
      this.preview
        .rect(x0, y0, x1 - x0, y1 - y0)
        .fill({ color: s.floorColor, alpha: 0.5 });
    }
    if (s.createWalls) {
      this.preview
        .rect(x0, y0, x1 - x0, y1 - y0)
        .stroke({ width: Math.max(2, 4 / zoom), color: 0xff6b6b, alpha: 0.95 });
    }

    // Maße einblenden: beim Aufziehen will man Felder zählen, nicht Pixel.
    this.drawSize(ctx.doc, rect, zoom);
  }

  private drawSize(doc: MapDocument, rect: [number, number, number, number], zoom: number): void {
    const tile = doc.grid.tileSize;
    const cols = Math.round((rect[2] - rect[0]) / tile);
    const rows = Math.round((rect[3] - rect[1]) / tile);
    if (cols < 1 || rows < 1) return;
    // Ein Punkteraster an den Feldgrenzen macht die Größe ablesbar, ohne dass
    // hier Text gerendert werden müsste — der Renderer hält den Overlay schlank.
    const r = Math.max(1, 2 / zoom);
    for (let c = 0; c <= cols; c++) {
      for (let row = 0; row <= rows; row++) {
        this.preview
          .circle(rect[0] + c * tile, rect[1] + row * tile, r)
          .fill({ color: 0xffffff, alpha: 0.35 });
      }
    }
  }
}
