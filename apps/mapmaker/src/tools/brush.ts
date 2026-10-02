/**
 * Streu-Pinsel.
 *
 * Verteilt vorgewählte Props mit zufälliger Größe, Drehung und Farbnuance
 * entlang des Pinselwegs. Der ganze Strich landet als *ein* Undo-Schritt, wird
 * aber in Häppchen ausgeführt, damit man beim Malen sofort etwas sieht.
 */

import { Graphics } from 'pixi.js';
import { AddObjects, RemoveObjects } from '@/model/commands';
import { symmetryCopies } from '@/model/symmetry';
import { canHoldObjects } from '@/model/document';
import { t } from '@/i18n';
import { jitterHsl } from '@/model/color';
import { Rng } from '@/model/rng';
import { getProp, grundSkala } from '@/assets/library';
import { tileScale, worldAABB } from '@/engine/hitTest';
import type { MapObject, ObjectId, PropObject } from '@/model/types';
import { createProp } from './factory';
import type { Tool, ToolContext, ToolPointerEvent } from './types';

/** Beschleunigt die Abstandsprüfung innerhalb eines Strichs. */
class SpatialHash {
  private cells = new Map<string, Array<{ x: number; y: number; r: number }>>();
  constructor(private cellSize: number) {}

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  add(x: number, y: number, r: number): void {
    const k = this.key(x, y);
    const list = this.cells.get(k);
    if (list) list.push({ x, y, r });
    else this.cells.set(k, [{ x, y, r }]);
  }

  /** Liegt in Reichweite schon ein Stempel? */
  occupied(x: number, y: number, r: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const p of list) {
          const min = r + p.r;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < min * min) return true;
        }
      }
    }
    return false;
  }

  clear(): void {
    this.cells.clear();
  }
}

export class BrushTool implements Tool {
  readonly cursor = 'none';

  private painting = false;
  private erasing = false;
  private rng = new Rng(Date.now());
  private hash = new SpatialHash(64);
  private lastPos = { x: 0, y: 0 };
  private travelled = 0;
  private pending: MapObject[] = [];
  private strokeIds = new Set<ObjectId>();

  private preview = new Graphics();
  private previewAttached = false;

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    this.drawPreview(ctx, e);
    if (!this.painting) return;
    if (this.erasing) {
      this.eraseAt(ctx, e);
      return;
    }
    this.walkTo(ctx, e);
  }

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button !== 0 && e.button !== 2) return;
    const settings = ctx.state.brush;
    if (this.resolvePropIds(ctx).length === 0) {
      ctx.state.setStatusMessage(t('status.brushNoProp'));
      return;
    }
    if (!canHoldObjects(ctx.doc, ctx.state.activeLayerId)) {
      ctx.state.setStatusMessage(t('status.layerLocked'));
      return;
    }

    this.painting = true;
    // Rechte Maustaste oder Alt radiert — man will beim Streuen sofort korrigieren.
    this.erasing = e.button === 2 || e.alt;
    this.lastPos = { ...e.world };
    this.travelled = 0;
    this.hash.clear();
    this.strokeIds.clear();
    this.rng = new Rng((Math.random() * 0xffffffff) >>> 0);
    ctx.beginTransaction();

    if (this.erasing) {
      this.eraseAt(ctx, e);
      return;
    }

    if (settings.mode === 'single') {
      this.emit(ctx, this.makeStamp(ctx, e.world.x, e.world.y, 0));
      this.flush(ctx);
    } else {
      // Der erste Klick soll schon etwas setzen, nicht erst die Bewegung.
      const tries = Math.max(1, Math.round(settings.density));
      for (let k = 0; k < tries; k++) this.stampAround(ctx, e.world.x, e.world.y, 0);
      this.flush(ctx);
    }
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.painting) return;
    this.flush(ctx);
    ctx.endTransaction();
    this.painting = false;
    this.erasing = false;
  }

  deactivate(ctx: ToolContext): void {
    if (this.painting) {
      this.flush(ctx);
      ctx.endTransaction();
      this.painting = false;
    }
    if (this.previewAttached) {
      ctx.renderer.removeOverlay(this.preview);
      this.previewAttached = false;
    }
  }

  // -------------------------------------------------------------------------
  // Streuen
  // -------------------------------------------------------------------------

  /** Läuft den Weg seit dem letzten Ereignis ab und stempelt in festen Abständen. */
  private walkTo(ctx: ToolContext, e: ToolPointerEvent): void {
    const s = ctx.state.brush;
    const dx = e.world.x - this.lastPos.x;
    const dy = e.world.y - this.lastPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return;

    const angle = Math.atan2(dy, dx);
    // Fester Vorschub von knapp einem Drittel Radius: so überlappen sich die
    // Pinselkreise und es entstehen keine Lücken. Die Dichte steuert stattdessen,
    // wie viele Stempel je Schritt versucht werden.
    const step = Math.max(2, s.radius * 0.3);

    let remaining = dist;
    let px = this.lastPos.x;
    let py = this.lastPos.y;
    let budget = 0;

    while (this.travelled + remaining >= step && budget < 400) {
      const need = step - this.travelled;
      px += Math.cos(angle) * need;
      py += Math.sin(angle) * need;
      remaining -= need;
      this.travelled = 0;
      budget++;

      if (s.mode === 'line') {
        this.emit(ctx, this.makeStamp(ctx, px, py, angle));
      } else {
        const tries = Math.max(1, Math.round(s.density));
        for (let k = 0; k < tries; k++) this.stampAround(ctx, px, py, angle);
      }
    }
    this.travelled += remaining;
    this.lastPos = { ...e.world };

    if (this.pending.length >= 24) this.flush(ctx);
  }

  /** Ein Streu-Ereignis: ein Versuch innerhalb des Pinselkreises. */
  private stampAround(ctx: ToolContext, cx: number, cy: number, angle: number): void {
    const s = ctx.state.brush;
    const a = this.rng.range(0, Math.PI * 2);
    // Gleichverteilung wäre sqrt(u); der Exponent zieht die Dichte zur Mitte.
    const u = this.rng.next();
    const r = s.radius * Math.pow(u, 0.5 + s.falloff * 1.2);
    this.emit(ctx, this.makeStamp(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, angle));
  }

  private makeStamp(ctx: ToolContext, x: number, y: number, strokeAngle: number): PropObject | null {
    const s = ctx.state.brush;
    const ids = this.resolvePropIds(ctx);
    if (ids.length === 0) return null;

    const propId =
      ids.length === 1 ? ids[0] : this.rng.pickWeighted(ids, s.weights.length ? s.weights : ids.map(() => 1));
    const def = getProp(propId);
    if (!def) return null;

    const scale = this.rng.range(s.scaleMin, s.scaleMax) * grundSkala(propId);
    const footprint = (Math.max(def.size.w, def.size.h) / 2) * scale * tileScale(ctx.doc);
    const minDist = footprint * s.spacing;

    if (minDist > 0 && this.hash.occupied(x, y, minDist)) return null;
    this.hash.add(x, y, minDist);

    // Ohne Drehung bleibt jedes Prop so stehen, wie es gezeichnet wurde —
    // für Möbel und alles mit erkennbarem Oben ist Zufall hier falsch.
    let rotation = 0;
    if (s.rotate) {
      rotation = s.alignToStroke
        ? strokeAngle + this.rng.range(-0.2, 0.2)
        : this.rng.range(s.rotationMin, s.rotationMax);
    }

    const baseTint = def.tintable ? 0xffffff : 0xffffff;
    const tint =
      s.hueJitter || s.satJitter || s.lightJitter
        ? jitterHsl(baseTint, s.hueJitter, s.satJitter, s.lightJitter, () => this.rng.next())
        : null;

    return createProp(ctx.doc, ctx.state.activeLayerId, propId, x, y, {
      rotation,
      scaleX: scale,
      scaleY: scale,
      opacity: this.rng.range(s.opacityMin, s.opacityMax),
      flipX: this.rng.bool(s.flipChance),
      tint,
      seed: Math.floor(this.rng.next() * 0xffffff),
    });
  }

  private emit(ctx: ToolContext, obj: PropObject | null): void {
    if (!obj) return;
    // z fortlaufend vergeben, sonst liegen alle Stempel eines Strichs gleichauf.
    obj.z += this.pending.length + this.strokeIds.size;
    this.pending.push(obj);
    this.strokeIds.add(obj.id);
    void ctx;
  }

  private flush(ctx: ToolContext): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    const kopien = symmetryCopies(ctx.doc, batch, ctx.state.symmetry);
    ctx.exec(new AddObjects([...batch, ...kopien], t('cmd.brushStroke'), 'brush'));
  }

  // -------------------------------------------------------------------------
  // Radieren
  // -------------------------------------------------------------------------

  private eraseAt(ctx: ToolContext, e: ToolPointerEvent): void {
    const s = ctx.state.brush;
    const doc = ctx.doc;
    const r2 = s.radius * s.radius;
    const victims: ObjectId[] = [];

    for (const id in doc.objects) {
      const o = doc.objects[id];
      if (o.kind !== 'prop') continue;
      if (o.layerId !== ctx.state.activeLayerId) continue;
      if (o.locked) continue;
      const dx = o.x - e.world.x;
      const dy = o.y - e.world.y;
      if (dx * dx + dy * dy <= r2) victims.push(id);
    }
    if (victims.length > 0) ctx.exec(new RemoveObjects(victims, t('cmd.brushErase')));
    this.lastPos = { ...e.world };
  }

  // -------------------------------------------------------------------------

  private resolvePropIds(ctx: ToolContext): string[] {
    const s = ctx.state.brush;
    if (s.propIds.length > 0) return s.propIds.filter((id) => !!getProp(id));
    const active = ctx.state.activePropId;
    return active && getProp(active) ? [active] : [];
  }

  private drawPreview(ctx: ToolContext, e: ToolPointerEvent): void {
    if (!this.previewAttached) {
      ctx.renderer.addOverlay(this.preview);
      this.previewAttached = true;
    }
    const s = ctx.state.brush;
    const lw = Math.max(0.5, 1.5 / ctx.renderer.camera.zoom);
    const color = this.erasing || e.alt ? 0xff6b6b : 0x4da3ff;
    this.preview
      .clear()
      .circle(e.world.x, e.world.y, s.radius)
      .stroke({ width: lw, color, alpha: 0.85 })
      .circle(e.world.x, e.world.y, 2 / ctx.renderer.camera.zoom)
      .fill({ color, alpha: 0.8 });
  }
}

/** Ausdehnung eines Objekts — für Tests der Abstandslogik. */
export { worldAABB };
