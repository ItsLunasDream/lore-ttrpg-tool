/**
 * Einzelne Props platzieren.
 *
 * Zeigt eine halbtransparente Vorschau an der Fangposition, damit klar ist,
 * wo das Prop landet, bevor man klickt — und zwar schon mit Größe, Farbe und
 * Deckkraft aus den Vorgaben, sonst überrascht das Ergebnis.
 *
 * Das Werkzeug kann außerdem *bedienen*, nicht nur setzen: liegt der Zeiger
 * auf einem Griff der bestehenden Auswahl oder auf einem schon ausgewählten
 * Objekt, übernimmt für diesen Zug das Auswahl-Werkzeug. Sonst müsste man
 * nach jedem gesetzten Prop erst umschalten, nur um es zu drehen — und danach
 * wieder zurück.
 *
 * Dafür wird das Auswahl-Werkzeug *benutzt* und nicht nachgebaut: Drehen,
 * Skalieren und das Zusammenspiel mit Gruppen stecken dort in geprüftem Code,
 * und zwei Fassungen davon liefen unweigerlich auseinander.
 */

import { Sprite } from 'pixi.js';
import { grundSkala } from '@/assets/library';
import { AddObjects } from '@/model/commands';
import { symmetryCopies } from '@/model/symmetry';
import { snapPoint } from '@/model/grid';
import { canHoldObjects } from '@/model/document';
import { t } from '@/i18n';
import { lichtFuerProp } from '@/assets/propLights';
import { getPropTexture, variantFor } from '@/engine/propTextures';
import { tileScale } from '@/engine/hitTest';
import { createProp } from './factory';
import { SelectTool } from './select';
import type { Tool, ToolContext, ToolPointerEvent } from './types';

export class PropTool implements Tool {
  readonly cursor = 'crosshair';

  private ghost = new Sprite();
  private attached = false;
  private ghostKey = '';
  /** Seed der Vorschau; wird nach dem Setzen erneuert, damit Varianten wechseln. */
  private previewSeed = Math.floor(Math.random() * 0xffffff);

  /**
   * Das Auswahl-Werkzeug, das hier mitläuft.
   *
   * Eigene Instanz und nicht die des Managers: die hat ihren eigenen Zustand
   * (laufender Zug, Gummiband), und den zwei Werkzeugen zu teilen führte zu
   * Zügen, die im falschen Werkzeug enden.
   */
  private select = new SelectTool();
  /** Läuft dieser Zug gerade über das Auswahl-Werkzeug? */
  private delegating = false;

  /**
   * Setzt dieser Druck ein Prop, statt die Auswahl anzufassen?
   *
   * Alt erzwingt das Setzen — gedacht für den Fall, dass ein neues Prop genau
   * auf einem schon ausgewählten landen soll. Nicht Strg: das schaltet hier
   * seit jeher das Fangen ab und soll das auch weiter tun.
   */
  private placesInstead(e: ToolPointerEvent, ctx: ToolContext): boolean {
    return e.alt || !this.select.wouldGrab(ctx, e);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (this.delegating) {
      this.select.onPointerMove?.(e, ctx);
      return;
    }

    const propId = ctx.state.activePropId;
    if (!propId) {
      this.detach(ctx);
      return;
    }

    // Über einem Griff wäre die Vorschau eine Lüge: dort wird nichts gesetzt.
    if (!this.placesInstead(e, ctx)) {
      this.detach(ctx);
      return;
    }
    this.updateGhost(ctx, propId, e);
  }

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    if (e.button !== 0) return;

    if (!this.placesInstead(e, ctx)) {
      this.delegating = true;
      this.detach(ctx);
      this.select.onPointerDown?.(e, ctx);
      return;
    }

    const propId = ctx.state.activePropId;
    if (!propId) {
      ctx.state.setStatusMessage(t('status.needProp'));
      return;
    }

    const layerId = ctx.state.activeLayerId;
    if (!canHoldObjects(ctx.doc, layerId)) {
      ctx.state.setStatusMessage(t('status.layerLocked'));
      return;
    }

    const s = ctx.state.prop;
    const p = e.ctrl ? e.world : snapPoint(ctx.doc.grid, e.world);
    // Standardmäßig gerade: wer einzeln platziert, will meist eine bestimmte
    // Ausrichtung. Die Zufallsdrehung ist zuschaltbar, etwa für Steine.
    const rotation = s.randomRotation ? Math.random() * Math.PI * 2 : 0;
    const obj = createProp(ctx.doc, layerId, propId, p.x, p.y, {
      seed: this.previewSeed,
      rotation,
      scaleX: s.scale * grundSkala(propId),
      scaleY: s.scale * grundSkala(propId),
      tint: s.tint,
      opacity: s.opacity,
      flipX: s.flipX,
      flipY: s.flipY,
      // Fackel, Kohlebecken & Co. bringen ihr VTT-Licht gleich mit.
      light: lichtFuerProp(propId) ?? null,
    });
    // Spiegelungen und Kachelkopien hängen an denselben Befehl: für den
    // Benutzer war es ein Setzen, also ist es ein Rückgängig-Schritt.
    const kopien = symmetryCopies(ctx.doc, [obj], ctx.state.symmetry);
    ctx.exec(new AddObjects([obj, ...kopien], t('cmd.placeProp')));
    ctx.state.setSelection([obj.id]);

    this.previewSeed = Math.floor(Math.random() * 0xffffff);
    this.updateGhost(ctx, propId, e);
  }

  onPointerUp(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.delegating) return;
    this.select.onPointerUp?.(e, ctx);
    this.delegating = false;
  }

  deactivate(ctx: ToolContext): void {
    // Einen laufenden Zug des Auswahl-Werkzeugs sauber beenden, sonst bleibt
    // dessen Transaktion offen und der nächste Undo-Schritt umfasst zu viel.
    if (this.delegating) {
      this.select.deactivate?.(ctx);
      this.delegating = false;
    }
    this.detach(ctx);
  }

  private updateGhost(ctx: ToolContext, propId: string, e: ToolPointerEvent): void {
    const variant = variantFor(propId, this.previewSeed);
    const key = `${propId}#${variant}`;
    if (key !== this.ghostKey) {
      const tex = getPropTexture(ctx.renderer.app.renderer, propId, variant);
      if (tex) {
        this.ghost.texture = tex;
        this.ghostKey = key;
      }
    }
    if (!this.ghost.texture) return;

    if (!this.attached) {
      this.ghost.anchor.set(0.5);
      ctx.renderer.addOverlay(this.ghost);
      this.attached = true;
    }

    const s = ctx.state.prop;
    const p = e.ctrl ? e.world : snapPoint(ctx.doc.grid, e.world);
    this.ghost.position.set(p.x, p.y);
    // Vorgaben mitzeigen: die Vorschau ist sonst kein Vorgriff, sondern nur
    // ein Umriss, und die eingestellte Größe fällt erst nach dem Klick auf.
    const k = tileScale(ctx.doc) * s.scale * (ctx.state.activePropId ? grundSkala(ctx.state.activePropId) : 1);
    this.ghost.scale.set(s.flipX ? -k : k, s.flipY ? -k : k);
    this.ghost.tint = s.tint ?? 0xffffff;
    this.ghost.alpha = 0.55 * s.opacity;
    this.ghost.visible = true;
  }

  private detach(ctx: ToolContext): void {
    if (this.attached) {
      ctx.renderer.removeOverlay(this.ghost);
      this.attached = false;
    }
    this.ghost.visible = false;
  }
}
