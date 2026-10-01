/**
 * Licht-Werkzeug.
 *
 * Klick setzt ein Licht mit den Werten aus dem Panel, Ziehen bestimmt dabei
 * gleich die Reichweite. Die Reichweite wird in **Tiles** gespeichert, nicht in
 * Pixeln — so verlangt es das UVTT-Format, und Foundry rechnet daraus
 * dim = range × Feldgröße.
 */

import { Graphics } from 'pixi.js';
import { AddVttItems, PatchVttItems, RemoveVttItems } from '@/model/commands';
import { waehleGesetztes } from './auswahlNachSetzen';
import { makeId } from '@/model/ids';
import type { LightSource } from '@/model/types';
import { pickLight } from './vttPick';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

export class LightTool implements Tool {
  readonly cursor = 'crosshair';

  private placing: { id: string; x: number; y: number } | null = null;
  private preview = new Graphics();
  private attached = false;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    const tolerance = 14 / ctx.renderer.camera.zoom;

    if (e.button === 2) {
      const light = pickLight(ctx.doc, e.world, tolerance);
      if (light) ctx.exec(new RemoveVttItems({ lights: [light.id] }, t('cmd.removeLight')));
      return;
    }
    if (e.button !== 0) return;

    // Ein vorhandenes Licht anfassen heißt: Reichweite neu ziehen.
    const existing = pickLight(ctx.doc, e.world, tolerance);
    if (existing) {
      waehleGesetztes(ctx, { lights: [existing.id] });
      this.placing = { id: existing.id, x: existing.x, y: existing.y };
      ctx.beginTransaction();
      this.attach(ctx);
      return;
    }

    const s = ctx.state.light;
    const light: LightSource = {
      id: makeId('light'),
      x: e.world.x,
      y: e.world.y,
      range: s.range,
      intensity: s.intensity,
      color: s.color,
      alpha: s.alpha,
      shadows: s.shadows,
    };
    ctx.exec(new AddVttItems('lights', [light], t('cmd.addLight')));
    // Gleich ausgewählt: Farbe, Stärke und Schatten rechts wirken auf dieses Licht.
    waehleGesetztes(ctx, { lights: [light.id] });
    this.placing = { id: light.id, x: light.x, y: light.y };
    ctx.beginTransaction();
    this.attach(ctx);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.placing) return;
    const tile = ctx.doc.grid.tileSize;
    const distance = Math.hypot(e.world.x - this.placing.x, e.world.y - this.placing.y);
    // Unter einem Viertel Tile gilt der Zug als Klick; die Voreinstellung bleibt.
    if (distance < tile * 0.25) return;

    const range = Math.round((distance / tile) * 4) / 4;
    ctx.exec(
      new PatchVttItems(
        'lights',
        new Map([[this.placing.id, { range }]]),
        t('cmd.lightRange'),
        `light-range:${this.placing.id}`,
      ),
    );
    this.drawPreview(ctx, range);
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.placing) return;
    ctx.endTransaction();

    // Zuletzt gezogene Reichweite als neue Voreinstellung übernehmen.
    const light = ctx.doc.vtt.lights.find((l) => l.id === this.placing?.id);
    if (light) ctx.state.patchLight({ range: light.range });

    this.placing = null;
    this.detach(ctx);
  }

  deactivate(ctx: ToolContext): void {
    if (this.placing) ctx.endTransaction();
    this.placing = null;
    this.detach(ctx);
  }

  // -------------------------------------------------------------------------

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

  private drawPreview(ctx: ToolContext, range: number): void {
    if (!this.placing) return;
    const zoom = ctx.renderer.camera.zoom;
    const radius = range * ctx.doc.grid.tileSize;
    this.preview
      .clear()
      .circle(this.placing.x, this.placing.y, radius)
      .stroke({ width: Math.max(1, 2 / zoom), color: 0xffd98a, alpha: 0.9 });
  }
}
