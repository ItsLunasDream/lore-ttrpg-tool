/**
 * Wand-Werkzeug: Wandzüge als Polylinie.
 *
 * Fängt zusätzlich zum Raster an vorhandenen Wand-Stützpunkten. Ohne das
 * bleiben an Ecken haarfeine Lücken, durch die in Foundry die Sicht leckt —
 * im Editor sieht man davon nichts, im Spiel schon.
 */

import { Graphics } from 'pixi.js';
import { AddVttItems, RemoveVttItems, type Command } from '@/model/commands';
import { snapPoint } from '@/model/grid';
import { dropDensePoints, hasExtent } from '@/model/geometry';
import { makeId } from '@/model/ids';
import type { Wall } from '@/model/types';
import { pickWall, snapToWallVertex } from './vttPick';
import { stilFuer, waehleGesetztes } from './auswahlNachSetzen';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

const WALL_COLORS: Record<Wall['type'], number> = {
  normal: 0xff4d4d,
  invisible: 0x8a8a8a,
  ethereal: 0x9b6bff,
  window: 0x4dd2ff,
};

export class WallTool implements Tool {
  readonly cursor = 'crosshair';

  private points: number[] = [];
  private building = false;
  private preview = new Graphics();
  private attached = false;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button === 2) {
      // Während eines Zugs beendet der Rechtsklick ihn und setzt die Wand.
      // Nur wenn gerade nichts gezogen wird, löscht er die Wand unter dem Zeiger.
      if (this.building) {
        this.points.length -= 2;
        this.finish(ctx);
        return;
      }
      const hit = pickWall(ctx.doc, e.world, this.tolerance(ctx));
      if (hit) ctx.exec(new RemoveVttItems({ walls: [hit.wall.id] }, t('cmd.removeWall')));
      return;
    }
    if (e.button !== 0) return;

    const p = this.place(ctx, e);
    if (!this.building) {
      this.building = true;
      this.points = [p.x, p.y];
      this.attach(ctx);
    } else {
      /**
       * Den mitlaufenden Punkt auf die getippte Stelle ziehen.
       *
       * Sonst hängt er dort, wo das letzte `pointermove` ihn gelassen hat — und
       * beim Tippen auf einem Tablett gibt es gar keines. Der Zug bekäme dann
       * lauter Punkte auf derselben Stelle: erst eine Wand ohne Länge, und seit
       * die abgewiesen wird, gar keine.
       */
      this.points[this.points.length - 2] = p.x;
      this.points[this.points.length - 1] = p.y;
    }
    // Doppelt gesetzter Punkt heißt: Zug beenden.
    const n = this.points.length;
    if (n >= 4 && Math.hypot(this.points[n - 4] - p.x, this.points[n - 3] - p.y) < 1) {
      this.points.length -= 2;
      this.finish(ctx);
      return;
    }
    this.points.push(p.x, p.y);
    this.drawPreview(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.building) return;
    const p = this.place(ctx, e);
    this.points[this.points.length - 2] = p.x;
    this.points[this.points.length - 1] = p.y;
    this.drawPreview(ctx);
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): boolean {
    if (!this.building) return false;
    if (e.key === 'Enter') {
      this.points.length -= 2;
      this.finish(ctx);
      return true;
    }
    if (e.key === 'Escape') {
      this.reset(ctx);
      return true;
    }
    if (e.key === 'Backspace' && this.points.length > 4) {
      this.points.splice(this.points.length - 4, 2);
      this.drawPreview(ctx);
      return true;
    }
    // c schließt den Zug zu einem Raum.
    if (e.key.toLowerCase() === 'c' && this.points.length >= 8) {
      this.points.length -= 2;
      this.finish(ctx, true);
      return true;
    }
    return false;
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  // -------------------------------------------------------------------------

  private tolerance(ctx: ToolContext): number {
    // In Bildschirmpixeln gedacht, damit der Fang beim Zoomen gleich anfühlt.
    return 12 / ctx.renderer.camera.zoom;
  }

  private place(ctx: ToolContext, e: ToolPointerEvent): { x: number; y: number } {
    if (e.ctrl) return e.world;
    const vertex = snapToWallVertex(ctx.doc, e.world, this.tolerance(ctx));
    if (vertex) return vertex;
    // Wände gehören an Zellgrenzen, nicht in Zellmitten.
    return snapPoint(ctx.doc.grid, e.world, 'corner');
  }

  private finish(ctx: ToolContext, closed = false): void {
    // Doppelpunkte heraus, bevor daraus eine Wand wird: ohne Zeigerbewegung
    // zwischen zwei Klicks liegt der mitlaufende Punkt noch auf dem vorigen,
    // und der Zug bekäme Segmente der Länge null. Auf einem Tablett ist das
    // der Normalfall — ein Tippen schickt kein pointermove.
    const punkte = dropDensePoints(this.points, 0.5);
    if (punkte.length >= 4 && hasExtent(punkte)) {
      const wall: Wall = {
        id: makeId('wall'),
        points: punkte,
        type: ctx.state.wall.type,
        closed,
        // Nur mitgeben, wenn abweichend: eine gewöhnliche Wand soll keine vier
        // redundanten Flags mitschleppen.
        ...(ctx.state.wall.senses ? { senses: { ...ctx.state.wall.senses } } : {}),
        // Mauerwerk als Teil der Wand; gezeichnet wird es in model/vttVisuals.ts.
        ...stilFuer(ctx, ctx.state.wall.style),
      };
      const parts: Command[] = [new AddVttItems('walls', [wall], t('cmd.addWall'))];

      // Ein Zug ist ein Undo-Schritt, auch wenn zwei Dinge entstehen.
      ctx.exec(parts[0]);
      // Gleich ausgewaehlt: Aenderungen rechts wirken auf die eben gezogene Wand.
      waehleGesetztes(ctx, { walls: [wall.id] });
    }
    this.reset(ctx);
  }

  private reset(ctx: ToolContext): void {
    this.building = false;
    this.points = [];
    this.preview.clear();
    if (this.attached) {
      ctx.renderer.removeOverlay(this.preview);
      this.attached = false;
    }
  }

  private attach(ctx: ToolContext): void {
    if (!this.attached) {
      ctx.renderer.addOverlay(this.preview);
      this.attached = true;
    }
  }

  private drawPreview(ctx: ToolContext): void {
    const g = this.preview;
    const zoom = ctx.renderer.camera.zoom;
    g.clear();
    if (this.points.length < 4) return;

    const color = WALL_COLORS[ctx.state.wall.type];
    g.moveTo(this.points[0], this.points[1]);
    for (let i = 2; i < this.points.length; i += 2) g.lineTo(this.points[i], this.points[i + 1]);
    g.stroke({ width: Math.max(1.5, 3 / zoom), color, alpha: 0.85, cap: 'round', join: 'round' });

    const r = Math.max(2, 4 / zoom);
    for (let i = 0; i < this.points.length; i += 2) {
      g.circle(this.points[i], this.points[i + 1], r).fill({ color, alpha: 0.9 });
    }
  }
}
