/**
 * Terrain-Pinsel: Bodenflächen malen.
 *
 * Anders als das Zeichnen-Werkzeug entsteht hier keine Linie, sondern eine
 * *Fläche*: der gezogene Strich wird zu einem Band seiner Breite und als
 * gefüllte Form abgelegt. Damit lassen sich Wege, Wiesen und Schlammlöcher in
 * einem Zug malen, statt sie als Polygon zu umranden.
 *
 * Das Ergebnis ist eine gewöhnliche Zeichnung — verschiebbar, umfärbbar,
 * löschbar. Eine weiche Kante entsteht am saubersten über einen kleinen
 * Weichzeichner auf dem Terrain-Layer (Filter-Panel); pro Form gäbe es sonst
 * mehrere übereinandergelegte Kopien, die beim Verschieben auseinanderfallen.
 */

import { Graphics } from 'pixi.js';
import { AddObjects } from '@/model/commands';
import { canHoldObjects } from '@/model/document';
import { dropDensePoints, smoothStroke, strokeBand } from '@/model/geometry';
import { makeId } from '@/model/ids';
import { nextZ } from '@/model/document';
import type { ShapeObject } from '@/model/types';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';
import { istRundum, wasserAussehen } from '@/model/wasser';

export class TerrainTool implements Tool {
  readonly cursor = 'crosshair';

  private points: number[] = [];
  private painting = false;
  private preview = new Graphics();
  private attached = false;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button !== 0) return;
    if (!canHoldObjects(ctx.doc, ctx.state.activeLayerId)) {
      ctx.state.setStatusMessage(t('status.layerLocked'));
      return;
    }
    this.painting = true;
    this.points = [e.world.x, e.world.y];
    this.attach(ctx);
    this.drawPreview(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.painting) return;
    this.points.push(e.world.x, e.world.y);
    this.drawPreview(ctx);
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.painting) return;
    this.painting = false;

    const s = ctx.state.terrain;
    const mittellinie = this.aufbereiten(s.smoothing);
    if (mittellinie.length >= 4) {
      const band = this.form(mittellinie, ctx);
      // Ursprung auf den ersten Punkt legen, wie bei jeder anderen Zeichnung —
      // sonst ließe sich die Fläche später nicht um ihre Mitte drehen.
      const ox = band[0];
      const oy = band[1];
      const lokal = band.map((v, i) => (i % 2 === 0 ? v - ox : v - oy));

      const layerId = ctx.state.activeLayerId;
      const obj: ShapeObject = {
        id: makeId('obj'),
        kind: 'shape',
        layerId,
        shape: 'polygon',
        x: ox,
        y: oy,
        rotation: 0,
        opacity: 1,
        z: nextZ(ctx.doc, layerId),
        locked: false,
        points: lokal,
        closed: true,
        blend: 'normal',
        ...(s.water
          ? wasserAussehen(s.color, s.alpha, ctx.doc.grid.tileSize)
          : { stroke: null, fill: { color: s.color, alpha: s.alpha } }),
      };
      ctx.exec(new AddObjects([obj], t('cmd.terrain')));
      ctx.state.setSelection([obj.id]);
    }

    this.points = [];
    this.detach(ctx);
  }

  deactivate(ctx: ToolContext): void {
    this.painting = false;
    this.points = [];
    this.detach(ctx);
  }

  // -------------------------------------------------------------------------

  /**
   * Rohpunkte in eine brauchbare Mittellinie verwandeln.
   *
   * Ohne Ausdünnen kämen bei einem langen Zug tausende Punkte zusammen, und das
   * Band hätte doppelt so viele — für eine Bodenfläche völlig unnötig.
   */
  private aufbereiten(smoothing: number): number[] {
    if (this.points.length < 4) return this.points;
    const duenn = dropDensePoints(this.points, 4);
    return smoothing > 0 ? smoothStroke(duenn, smoothing) : duenn;
  }

  /** Band in Pinselbreite — oder beim Wasser der umfahrene See. */
  private form(mittellinie: number[], ctx: ToolContext): number[] {
    const s = ctx.state.terrain;
    if (s.water && istRundum(mittellinie, s.width, ctx.doc.grid.tileSize)) return mittellinie;
    return strokeBand(mittellinie, s.width / 2);
  }

  private attach(ctx: ToolContext): void {
    if (!this.attached) {
      ctx.renderer.addOverlay(this.preview);
      this.attached = true;
    }
  }

  private detach(ctx: ToolContext): void {
    this.preview.clear();
    if (this.attached) {
      ctx.renderer.removeOverlay(this.preview);
      this.attached = false;
    }
  }

  /**
   * Vorschau — bewusst über *dieselbe* Aufbereitung wie das Ergebnis.
   *
   * Vorher lief hier nur `dropDensePoints`, während beim Loslassen zusätzlich
   * geglättet wurde. Die Vorschau war dadurch eckig und das Ergebnis rund:
   * zwei verschiedene Formen für denselben Zug. Und mit `alpha * 0.75` schien
   * sie durch, auch wenn die eingestellte Deckkraft voll war — an einer
   * Kreuzung des Bandes sah man dann eine hellere Stelle, die es später nicht
   * gibt.
   *
   * Jetzt zeigt sie Form und Deckkraft so, wie sie werden. Dass sie noch nicht
   * gesetzt ist, sagt stattdessen die dünne Umrisslinie — die verfälscht
   * nichts, sondern kommt hinzu.
   */
  private drawPreview(ctx: ToolContext): void {
    const s = ctx.state.terrain;
    this.preview.clear();
    if (this.points.length < 4) return;
    const mittellinie = this.aufbereiten(s.smoothing);
    if (mittellinie.length < 4) return;
    const band = this.form(mittellinie, ctx);
    if (band.length < 6) return;
    this.preview
      .poly(band)
      .fill({ color: s.color, alpha: s.alpha })
      .stroke({ width: 1.5 / ctx.renderer.camera.zoom, color: 0xffffff, alpha: 0.5 });
  }
}
