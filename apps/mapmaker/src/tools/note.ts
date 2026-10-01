/**
 * Notiz-Werkzeug.
 *
 * Klick setzt einen Pin und öffnet gleich den Editor — eine Notiz ohne Text
 * wäre sinnlos, also soll niemand erst suchen müssen, wo man ihn eintippt.
 * Klick auf einen vorhandenen Pin öffnet ihn wieder, Ziehen verschiebt ihn,
 * Rechtsklick löscht ihn. Dieselbe Handhabung wie beim Licht-Werkzeug.
 */

import { AddVttItems, PatchVttItems, RemoveVttItems } from '@/model/commands';
import { waehleGesetztes } from './auswahlNachSetzen';
import { makeId } from '@/model/ids';
import { snapPoint } from '@/model/grid';
import type { MapNote } from '@/model/types';
import { pickNote } from './vttPick';
import type { Tool, ToolContext, ToolPointerEvent } from './types';
import { t } from '@/i18n';

export class NoteTool implements Tool {
  readonly cursor = 'crosshair';

  private dragging: { id: string; dx: number; dy: number; moved: boolean } | null = null;

  onPointerDown(e: ToolPointerEvent, ctx: ToolContext): void {
    const tolerance = 16 / ctx.renderer.camera.zoom;

    if (e.button === 2) {
      const note = pickNote(ctx.doc, e.world, tolerance);
      if (note) {
        if (ctx.state.editingNoteId === note.id) ctx.state.setEditingNoteId(null);
        ctx.exec(new RemoveVttItems({ notes: [note.id] }, t('cmd.removeNote')));
      }
      return;
    }
    if (e.button !== 0) return;

    const existing = pickNote(ctx.doc, e.world, tolerance);
    if (existing) {
      waehleGesetztes(ctx, { notes: [existing.id] });
      // Erst beim Loslassen entscheidet sich, ob das ein Klick oder ein Zug war.
      this.dragging = {
        id: existing.id,
        dx: existing.x - e.world.x,
        dy: existing.y - e.world.y,
        moved: false,
      };
      ctx.beginTransaction();
      return;
    }

    const p = e.ctrl ? e.world : snapPoint(ctx.doc.grid, e.world);
    const s = ctx.state.note;
    const note: MapNote = {
      id: makeId('note'),
      x: p.x,
      y: p.y,
      title: '',
      text: '',
      icon: s.icon,
      size: s.size,
      color: s.color,
      playerVisible: s.playerVisible,
    };
    ctx.exec(new AddVttItems('notes', [note], t('cmd.addNote')));
    waehleGesetztes(ctx, { notes: [note.id] });
    ctx.state.setEditingNoteId(note.id);
  }

  onPointerMove(e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.dragging) return;
    const x = e.world.x + this.dragging.dx;
    const y = e.world.y + this.dragging.dy;
    const p = e.ctrl ? { x, y } : snapPoint(ctx.doc.grid, { x, y });

    const note = ctx.doc.vtt.notes.find((n) => n.id === this.dragging?.id);
    if (!note) return;
    if (!this.dragging.moved && Math.hypot(note.x - p.x, note.y - p.y) < 1) return;

    this.dragging.moved = true;
    ctx.exec(
      new PatchVttItems(
        'notes',
        new Map([[this.dragging.id, { x: p.x, y: p.y }]]),
        t('cmd.moveNote'),
        `note-move:${this.dragging.id}`,
      ),
    );
  }

  onPointerUp(_e: ToolPointerEvent, ctx: ToolContext): void {
    if (!this.dragging) return;
    ctx.endTransaction();
    // Nicht verschoben heißt: der Pin sollte geöffnet werden.
    if (!this.dragging.moved) ctx.state.setEditingNoteId(this.dragging.id);
    this.dragging = null;
  }

  deactivate(ctx: ToolContext): void {
    if (this.dragging) ctx.endTransaction();
    this.dragging = null;
  }
}
