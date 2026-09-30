/**
 * Dev-Werkzeuge für die Konsole. Wird nur im Dev-Build geladen.
 *
 * Hintergrund: solange das Browser-Fenster nicht sichtbar ist, feuert kein
 * requestAnimationFrame und Pixis Ticker steht still. `pump()` treibt Frames
 * von Hand an, `shot()` schreibt das gerenderte Bild über den Dev-Endpunkt
 * /__shot auf die Platte. Damit lässt sich das Rendering prüfen, ohne auf ein
 * Screenshot-Werkzeug angewiesen zu sein.
 */

import { Graphics, Rectangle, RenderTexture } from 'pixi.js';
import { allProps } from './assets/library';
import { Rng, hashSeed } from './model/rng';
import { getRenderer } from './engine/instance';
import { useEditor, type EditorState } from './model/store';
import * as commands from './model/commands';
import type { MapDocument } from './model/types';

export interface DevHarness {
  /**
   * Zustand und Dokument der *laufenden* Anwendung.
   *
   * Wichtig gegenüber einem `import()` aus der Konsole: nach einem Hot-Reload
   * serviert Vite Module mit Zeitstempel-Query, ein frischer Import liefert
   * dann eine zweite, leere Store-Instanz. Über diesen Weg liest man immer den
   * echten Zustand.
   */
  state(): EditorState;
  doc(): MapDocument;
  /** Welches Objekt hat ein sichtbares Sprite mit Textur? Für die Fehlersuche. */
  sprites(): Array<{ id: string; visible: boolean; textur: string | null }>;
  btn(text: string): HTMLButtonElement | undefined;
  card(name: string): HTMLElement | undefined;
  canvas(): HTMLCanvasElement | null;
  ptr(type: string, x: number, y: number, opts?: Record<string, unknown>): void;
  stroke(points: Array<[number, number]>): void;
  pump(n?: number): void;
  wait(ms: number): Promise<void>;
  look(x: number, y: number, zoom: number): void;
  /**
   * Farbe an Punkten des Bildschirms, aus dem fertig gezeichneten Bild.
   *
   * Manche Fragen lassen sich nur am Bild beantworten — ob eine Flaeche
   * ueberall gleich deckt zum Beispiel. Das Modell weiss das nicht, dort steht
   * nur ein Polygon.
   *
   * Die Punkte zaehlen wie bei `ptr` vom linken oberen Eck des Canvas, nicht
   * in Weltkoordinaten: so misst man dort, wo man geklickt hat.
   */
  probe(punkte: Array<[number, number]>): Array<[number, number, number, number]>;
  shot(name: string, width?: number): Promise<string>;
  /**
   * Kontaktbogen aller (oder ausgewählter) prozeduraler Props als PNG.
   *
   * Prop-Zeichnungen lassen sich nicht sinnvoll aus dem Quelltext beurteilen —
   * man muss sie sehen, nebeneinander, groß genug und beschriftet. Die Palette
   * taugt dafür nicht: dort sind sie 46 Pixel groß.
   */
  /** `varianten`: jede Variante einzeln statt nur der ersten. */
  propSheet(filter?: string, cell?: number, varianten?: boolean): string;
  /**
   * Die Befehlsschicht, fertig geladen.
   *
   * Damit lässt sich von außen ausführen, was sonst nur über Panels geht —
   * eine Ebene sperren, einen Layer löschen. **Wichtig ist der Weg hierüber**
   * statt eines `import('/src/model/commands.ts')` aus der Seite: nach einem
   * Hot-Reload serviert Vite Module mit Zeitstempel-Query, und ein frischer
   * Import liefert ein zweites Exemplar. Bei den Befehlen wäre das noch
   * harmlos, beim Store war es der teuer gelernte Fehler.
   */
  cmds: typeof commands;
}

function canvasEl(): HTMLCanvasElement | null {
  return document.querySelector('.canvas-host canvas');
}

export function installDevHarness(): void {
  const harness: DevHarness = {
    state: () => useEditor.getState(),
    cmds: commands,

    /**
     * Blick in die Sprites — welches Objekt hat eine Textur, welches nicht.
     * Für die Fehlersuche bei asynchron geladenen Bildern; ohne das muss man
     * raten, ob ein Prop fehlt oder nur unsichtbar ist.
     */
    sprites: () => {
      const r = getRenderer() as unknown as {
        objectViews?: Map<string, { node: { visible: boolean; texture?: { width: number; height: number } } }>;
      } | null;
      if (!r?.objectViews) return [];
      return [...r.objectViews.entries()].map(([id, v]) => ({
        id,
        visible: v.node.visible,
        textur: v.node.texture ? `${v.node.texture.width}x${v.node.texture.height}` : null,
      }));
    },

    doc: () => useEditor.getState().doc,

    btn: (text) =>
      [...document.querySelectorAll('button')].find((b) =>
        (b.textContent ?? '').trim().includes(text),
      ),

    card: (name) =>
      [...document.querySelectorAll<HTMLElement>('.prop-card')].find(
        (c) => c.querySelector('.label')?.textContent === name,
      ),

    canvas: canvasEl,

    ptr(type, x, y, opts = {}) {
      const c = canvasEl();
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          clientX: r.left + x,
          clientY: r.top + y,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          isPrimary: true,
          ...opts,
        }),
      );
    },

    stroke(points) {
      if (points.length === 0) return;
      this.ptr('pointerdown', points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) this.ptr('pointermove', points[i][0], points[i][1]);
      const last = points[points.length - 1];
      this.ptr('pointerup', last[0], last[1]);
    },

    pump(n = 3) {
      const r = getRenderer() as unknown as { frame(): void } | null;
      for (let i = 0; i < n; i++) r?.frame();
    },

    wait: (ms) => new Promise((res) => setTimeout(res, ms)),

    look(x, y, zoom) {
      const r = getRenderer();
      if (!r) return;
      r.camera.x = x;
      r.camera.y = y;
      r.camera.setZoom(zoom);
      this.pump(1);
    },

    propSheet(filter = '', cell = 150, varianten = false) {
      const r = getRenderer();
      if (!r) return '';
      const ids = filter ? filter.split(',') : [];
      const gewaehlt = allProps().filter(
        (d) => d.draw && (ids.length === 0 || ids.includes(d.id) || ids.includes(d.category)),
      );
      const defs = gewaehlt.flatMap((d) =>
        varianten ? Array.from({ length: d.variants }, (_, v) => ({ ...d, v })) : [{ ...d, v: 0 }],
      );
      const spalten = Math.max(1, Math.ceil(Math.sqrt(defs.length * 1.6)));
      const zeilen = Math.ceil(defs.length / spalten);
      const c = document.createElement('canvas');
      c.width = spalten * cell;
      c.height = zeilen * (cell + 18);
      const ctx = c.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#2b2b2e';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';

      defs.forEach((d, i) => {
        const g = new Graphics();
        d.draw?.(g, new Rng(hashSeed(1, d.id.length, d.name.length, d.v)), d.v);
        // Etwas Luft: ein Prop, das genau am Rahmen endet, wirkt beschnitten.
        const extent = Math.max(d.size.w, d.size.h) * 1.15;
        const x = (i % spalten) * cell;
        const y = Math.floor(i / spalten) * (cell + 18);
        ctx.fillStyle = i % 2 ? '#333338' : '#2f2f33';
        ctx.fillRect(x, y, cell, cell);
        try {
          const bild = r.app.renderer.extract.canvas({
            target: g,
            frame: new Rectangle(-extent / 2, -extent / 2, extent, extent),
            resolution: cell / extent,
            antialias: true,
          }) as HTMLCanvasElement;
          ctx.drawImage(bild, x, y, cell, cell);
        } catch {
          /* Ein Prop, das sich nicht zeichnen lässt, bleibt leer — auch das ist eine Antwort. */
        }
        g.destroy();
        ctx.fillStyle = '#ddd';
        ctx.fillText(varianten ? `${d.id} ${d.v}` : d.id, x + cell / 2, y + cell + 13);
      });

      return c.toDataURL('image/png');
    },

    probe(punkte) {
      const r = getRenderer();
      if (!r) return [];
      this.pump(2);
      const rt = RenderTexture.create({
        width: r.app.screen.width,
        height: r.app.screen.height,
        resolution: 1,
      });
      r.app.renderer.render({ container: r.app.stage, target: rt });
      const { pixels, width, height } = r.app.renderer.extract.pixels(rt);
      const c = canvasEl();
      const fx = c ? width / c.clientWidth : 1;
      const fy = c ? height / c.clientHeight : 1;
      const aus = punkte.map(([px, py]) => {
        const sx = Math.min(width - 1, Math.max(0, Math.round(px * fx)));
        const sy = Math.min(height - 1, Math.max(0, Math.round(py * fy)));
        const i = (sy * width + sx) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]] as [
          number,
          number,
          number,
          number,
        ];
      });
      rt.destroy(true);
      return aus;
    },

    async shot(name, width = 640) {
      const r = getRenderer();
      if (!r) return 'kein Renderer';
      this.pump(2);

      // Gezielt in eine Textur in Viewport-Größe rendern. Ein Extract der Bühne
      // würde stattdessen die gesamte Weltausdehnung abgreifen.
      const rt = RenderTexture.create({
        width: r.app.screen.width,
        height: r.app.screen.height,
        resolution: 1,
      });
      r.app.renderer.render({ container: r.app.stage, target: rt });
      const src = r.app.renderer.extract.canvas(rt) as HTMLCanvasElement;
      const H = Math.max(1, Math.round(src.height * (width / src.width)));
      const c = document.createElement('canvas');
      c.width = width;
      c.height = H;
      const ctx = c.getContext('2d');
      if (!ctx) return 'kein 2D-Kontext';
      ctx.fillStyle = '#14141a';
      ctx.fillRect(0, 0, width, H);
      ctx.drawImage(src, 0, 0, width, H);
      rt.destroy(true);

      const res = await fetch('/__shot', {
        method: 'POST',
        headers: { 'x-shot-name': name },
        body: c.toDataURL('image/jpeg', 0.82).slice('data:image/jpeg;base64,'.length),
      });
      return `${await res.text()} (${width}x${H})`;
    },
  };

  (globalThis as Record<string, unknown>).T = harness;
}
