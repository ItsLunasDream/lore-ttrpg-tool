/**
 * Öffnungen: Türen und Fenster.
 *
 * Beide werden gezogen wie Wände. Liegt eine Wand in Reichweite und ist der Fang
 * eingeschaltet, wird die Öffnung auf deren Richtung projiziert — so sitzt sie
 * sauber in der Wand statt schräg darüber. Ohne Fang lässt sich frei ziehen,
 * etwa für einen freistehenden Torbogen.
 *
 * Türen werden zu `portals`, Fenster zu Wänden vom Typ `window`. Das ist keine
 * Willkür: im Universal-VTT-Format landen Türen in `portals` und Fenster in
 * `objects_line_of_sight`.
 */

import { Graphics } from 'pixi.js';
import {
  AddVttItems,
  PatchVttItems,
  RemoveVttItems,
  type Command,
} from '@/model/commands';
import { snapPoint } from '@/model/grid';
import { makeId } from '@/model/ids';
import { stilFuer, waehleGesetztes } from './auswahlNachSetzen';
import type { Portal, Wall } from '@/model/types';
import { pickPortal, pickWall } from './vttPick';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

interface Anchor {
  x: number;
  y: number;
  /** Richtung der Wand, an der gefangen wurde; null bei freier Platzierung. */
  wallAngle: number | null;
}

export class PortalTool implements Tool {
  readonly cursor = 'crosshair';

  /**
   * Tür oder Fenster steckt im Werkzeug, nicht in einer Einstellung: als
   * Aufklappmenü im Panel war der Unterschied nicht auffindbar, und es wirkte,
   * als gäbe es nur Türen.
   */
  constructor(private readonly kind: 'door' | 'window') {}

  private start: Anchor | null = null;
  private current: [number, number, number, number] | null = null;
  private dragged = false;
  private preview = new Graphics();
  private attached = false;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    const tolerance = 14 / ctx.renderer.camera.zoom;

    /**
     * Jedes Werkzeug fasst nur an, was es selbst setzt.
     *
     * Vorher griffen beide Zweige auf *Türen* zu, gleich welches Werkzeug
     * aktiv war. In einer Wand mit Tür und Fenster nebeneinander — der
     * Normalfall an einer Hauswand — hieß das: der Versuch, ein Fenster neben
     * die Tür zu setzen, schaltete stattdessen die Tür auf. Und ein
     * Rechtsklick mit dem Fenster-Werkzeug löschte die Tür.
     *
     * Fenster bleiben trotzdem mit dem Wandwerkzeug löschbar; sie sind Wände
     * vom Typ `window` und werden dort ganz normal getroffen.
     */
    const istTuer = this.kind === 'door';

    if (e.button === 2) {
      if (istTuer) {
        const portal = pickPortal(ctx.doc, e.world, tolerance);
        if (portal) ctx.exec(new RemoveVttItems({ portals: [portal.id] }, t('cmd.removeDoor')));
        return;
      }
      const hit = pickWall(ctx.doc, e.world, tolerance);
      if (hit && hit.wall.type === 'window') {
        ctx.exec(new RemoveVttItems({ walls: [hit.wall.id] }, t('cmd.removeWindow')));
      }
      return;
    }
    if (e.button !== 0) return;

    // Klick auf eine vorhandene Tür schaltet zwischen offen und geschlossen.
    const existing = istTuer ? pickPortal(ctx.doc, e.world, tolerance) : null;
    if (existing) {
      ctx.exec(
        new PatchVttItems(
          'portals',
          new Map([[existing.id, { closed: !existing.closed }]]),
          existing.closed ? t('cmd.openDoor') : t('cmd.closeDoor'),
        ),
      );
      return;
    }

    this.start = this.anchorAt(ctx, e);
    this.dragged = false;
    this.current = this.boundsFor(ctx, this.start.x, this.start.y);
    this.attach(ctx);
    this.drawPreview(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.start) return;
    const end = this.endAt(ctx, e);
    const dx = end.x - this.start.x;
    const dy = end.y - this.start.y;
    if (Math.hypot(dx, dy) > ctx.doc.grid.tileSize * 0.15) this.dragged = true;
    this.current = this.boundsFor(ctx, end.x, end.y);
    this.drawPreview(ctx);
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.start || !this.current) return;
    const bounds = this.current;

    // Zu kurze Öffnungen sind fast immer ein verrutschter Klick.
    if (Math.hypot(bounds[2] - bounds[0], bounds[3] - bounds[1]) < 1) {
      this.reset(ctx);
      return;
    }

    const label = this.kind === 'window' ? t('cmd.addWindow') : t('cmd.addDoor');
    const parts: Command[] = [];

    const stil = stilFuer(ctx, ctx.state.opening.style);
    let gesetzt: { walls?: string[]; portals?: string[] };
    if (this.kind === 'window') {
      const wall: Wall = {
        id: makeId('wall'),
        points: [...bounds],
        type: 'window',
        closed: false,
        ...stil,
      };
      parts.push(new AddVttItems('walls', [wall], label));
      gesetzt = { walls: [wall.id] };
    } else {
      const portal: Portal = {
        id: makeId('portal'),
        bounds,
        closed: true,
        // Ohne Wand darunter ist die Tür freistehend — genau das sagt das Flag aus.
        freestanding: this.start.wallAngle === null,
        // Sichtbares Stück als Teil der Tür (model/vttVisuals.ts).
        ...stil,
      };
      parts.push(new AddVttItems('portals', [portal], label));
      gesetzt = { portals: [portal.id] };
    }

    ctx.exec(parts[0]);
    waehleGesetztes(ctx, gesetzt);
    this.reset(ctx);
  }

  deactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  // -------------------------------------------------------------------------

  /** Startpunkt: an der Wand, am Raster oder frei. */
  private anchorAt(ctx: ToolContext, e: ToolPointerEvent): Anchor {
    if (ctx.state.opening.snapToWalls && !e.ctrl) {
      const hit = pickWall(ctx.doc, e.world, 40 / ctx.renderer.camera.zoom);
      if (hit) return { x: hit.x, y: hit.y, wallAngle: hit.angle };
    }
    if (e.ctrl) return { x: e.world.x, y: e.world.y, wallAngle: null };
    const p = snapPoint(ctx.doc.grid, e.world, 'corner');
    return { x: p.x, y: p.y, wallAngle: null };
  }

  private endAt(ctx: ToolContext, e: ToolPointerEvent): { x: number; y: number } {
    if (e.ctrl) return e.world;
    if (ctx.state.opening.snapToWalls) {
      const hit = pickWall(ctx.doc, e.world, 60 / ctx.renderer.camera.zoom);
      if (hit) return { x: hit.x, y: hit.y };
    }
    return snapPoint(ctx.doc.grid, e.world, 'corner');
  }

  /**
   * Öffnung vom Anker zum Zielpunkt. Hängt sie an einer Wand, wird auf deren
   * Richtung projiziert; ohne Ziehen ist sie ein Tile lang.
   */
  private boundsFor(
    ctx: ToolContext,
    endX: number,
    endY: number,
  ): [number, number, number, number] {
    const start = this.start!;
    const tile = ctx.doc.grid.tileSize;
    const dx = endX - start.x;
    const dy = endY - start.y;
    const distance = Math.hypot(dx, dy);

    if (start.wallAngle !== null) {
      const along = dx * Math.cos(start.wallAngle) + dy * Math.sin(start.wallAngle);
      const length = Math.abs(along) < tile * 0.25 ? tile : along;
      const half = Math.abs(along) < tile * 0.25 ? length / 2 : 0;
      return [
        start.x - Math.cos(start.wallAngle) * half,
        start.y - Math.sin(start.wallAngle) * half,
        start.x + Math.cos(start.wallAngle) * (length - half),
        start.y + Math.sin(start.wallAngle) * (length - half),
      ];
    }

    if (distance < tile * 0.25) {
      // Freistehend und ohne Ziehen: waagerecht, ein Tile breit, mittig.
      return [start.x - tile / 2, start.y, start.x + tile / 2, start.y];
    }
    return [start.x, start.y, endX, endY];
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
    this.dragged = false;
    this.preview.clear();
    if (this.attached) {
      ctx.renderer.removeOverlay(this.preview);
      this.attached = false;
    }
  }

  private drawPreview(ctx: ToolContext): void {
    if (!this.current) return;
    const [x0, y0, x1, y1] = this.current;
    const zoom = ctx.renderer.camera.zoom;
    const isWindow = this.kind === 'window';
    const color = isWindow ? 0x4dd2ff : 0xffc23d;

    const g = this.preview.clear();
    g.moveTo(x0, y0)
      .lineTo(x1, y1)
      .stroke({ width: Math.max(2, 5 / zoom), color, alpha: 0.95, cap: 'round' });

    // Endpunkte markieren, damit die Länge beim Ziehen ablesbar ist.
    const r = Math.max(2, 3.5 / zoom);
    g.circle(x0, y0, r).fill({ color, alpha: 0.9 });
    g.circle(x1, y1, r).fill({ color, alpha: 0.9 });

    if (!this.dragged && this.start?.wallAngle === null) {
      // Freistehend ohne Ziehen: sichtbar machen, dass hier keine Wand gefangen wurde.
      g.circle(this.start.x, this.start.y, Math.max(3, 8 / zoom)).stroke({
        width: Math.max(1, 1.5 / zoom),
        color,
        alpha: 0.4,
      });
    }
  }
}
