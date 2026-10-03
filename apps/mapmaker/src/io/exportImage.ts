/**
 * Bild-Export.
 *
 * Große Karten werden **kachelweise** gerendert und auf einem 2D-Canvas
 * zusammengesetzt. Eine 150×150-Tile-Karte bei 100 px/Tile wären 15 000 ×
 * 15 000 Pixel — mehr, als eine einzelne WebGL-Textur hält.
 */

import { RenderTexture } from 'pixi.js';
import { t } from '@/i18n';
import { mapPixelSize } from '@/model/grid';
import type { LayerId, MapDocument } from '@/model/types';
import type { MapRenderer } from '@/engine/renderer';

export type ImageFormat = 'png' | 'webp' | 'jpeg';

export interface ImageExportOptions {
  /** Auflösung der Ausgabe. Nicht zu verwechseln mit der Tile-Größe im Dokument. */
  pixelsPerTile: number;
  format: ImageFormat;
  /** 0–1, nur für webp und jpeg. */
  quality: number;
  includeGrid: boolean;
  /** Ohne Hintergrund wird PNG/WebP transparent — praktisch für Overlays. */
  includeBackground: boolean;
  /**
   * Nur diesen Layer zeichnen. Für die Ausgabe jeder Ebene als eigene Datei —
   * damit lässt sich eine Karte in einem Bildprogramm weiterbearbeiten oder in
   * einem VTT als Overlay ein- und ausblenden.
   */
  onlyLayer?: LayerId;
  /**
   * Filter für diesen Export abschalten.
   *
   * Für den VTT-Export: Foundry rechnet sein Licht selbst, ein bereits
   * eingefärbtes Bild ließe sich dort nicht mehr aufhellen.
   */
  ignoreFilters?: boolean;
}

export function defaultExportOptions(doc: MapDocument): ImageExportOptions {
  return {
    pixelsPerTile: doc.grid.tileSize,
    format: 'webp',
    quality: 0.92,
    // Foundry zeichnet sein eigenes Grid — doppelte Linien sind der häufigste
    // Ärger beim Import, deshalb standardmäßig aus.
    includeGrid: false,
    includeBackground: true,
  };
}

/** Kantenlänge einer Render-Kachel. Konservativ gegenüber dem WebGL-Limit. */
const TILE = 2048;

/**
 * Browser begrenzen die Fläche eines 2D-Canvas. Chrome liegt bei rund 268
 * Megapixeln; darüber liefert getContext still ein leeres Bild.
 */
export const MAX_CANVAS_PIXELS = 256 * 1024 * 1024;
export const MAX_CANVAS_SIDE = 16384;

export interface ExportSizeInfo {
  width: number;
  height: number;
  megapixels: number;
  tooLarge: boolean;
  reason: string | null;
}

export function exportSize(doc: MapDocument, pixelsPerTile: number): ExportSizeInfo {
  const base = mapPixelSize(doc.grid, doc.size);
  const scale = pixelsPerTile / doc.grid.tileSize;
  const width = Math.max(1, Math.round(base.width * scale));
  const height = Math.max(1, Math.round(base.height * scale));
  const pixels = width * height;

  let reason: string | null = null;
  if (width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    reason = t('export.reasonSide', { max: MAX_CANVAS_SIDE });
  } else if (pixels > MAX_CANVAS_PIXELS) {
    reason = t('export.reasonArea');
  }

  return {
    width,
    height,
    megapixels: Math.round((pixels / 1_000_000) * 10) / 10,
    tooLarge: reason !== null,
    reason,
  };
}

/** Kacheln, die ein Export dieser Größe braucht — die Zahl hinter dem Balken. */
export function tileCount(size: { width: number; height: number }): number {
  if (size.width <= 0 || size.height <= 0) return 0;
  return Math.ceil(size.width / TILE) * Math.ceil(size.height / TILE);
}

export interface ExportProgress {
  /** Fertige Kacheln. */
  done: number;
  /** Kacheln insgesamt. */
  total: number;
}

/**
 * Kachelt die Karte und gibt nach jeder Kachel ab.
 *
 * Als Generator und nicht zweimal geschrieben: der synchrone Weg zieht ihn in
 * einem Zug leer, der asynchrone lässt zwischen den Kacheln den Browser ans
 * Bild. Eine 150×150-Karte bei 100 px je Feld braucht 14 s, und die stecken
 * fast ganz im Rücklesen von der Grafikkarte — ohne Rückmeldung sieht das aus
 * wie ein Absturz.
 *
 * Der Ticker steht währenddessen. Zwischen zwei Kacheln kann also nichts von
 * selbst zeichnen; die Welt-Transformation wird ohnehin für jede Kachel neu
 * gesetzt.
 */
function* renderTiles(
  renderer: MapRenderer,
  doc: MapDocument,
  options: ImageExportOptions,
): Generator<ExportProgress, HTMLCanvasElement> {
  const size = exportSize(doc, options.pixelsPerTile);
  if (size.tooLarge) throw new Error(`Export nicht möglich: ${size.reason}`);

  const scale = options.pixelsPerTile / doc.grid.tileSize;
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D-Kontext nicht verfügbar');

  const total = tileCount(size);
  let done = 0;

  const wasRunning = renderer.app.ticker.started;
  renderer.app.ticker.stop();
  const restore = renderer.beginExport({
    includeGrid: options.includeGrid,
    includeBackground: options.includeBackground,
    onlyLayer: options.onlyLayer,
    ignoreFilters: options.ignoreFilters,
    doc,
  });

  try {
    for (let ty = 0; ty < size.height; ty += TILE) {
      for (let tx = 0; tx < size.width; tx += TILE) {
        const w = Math.min(TILE, size.width - tx);
        const h = Math.min(TILE, size.height - ty);

        const target = RenderTexture.create({ width: w, height: h, resolution: 1 });
        // Weltkoordinate der Kachelecke: zurückgerechnet auf die Dokumentgröße.
        renderer.setExportView(tx / scale, ty / scale, scale);
        renderer.app.renderer.render({ container: renderer.world, target, clear: true });

        /**
         * Die Pixel direkt holen und direkt setzen.
         *
         * `extract.canvas()` legt für jede Kachel ein eigenes Canvas an und
         * schreibt die Pixel dort hinein; das `drawImage` danach kopiert sie
         * ein zweites Mal. Bei einer 150×150-Karte mit 100 px je Feld sind das
         * 64 Kacheln — gemessen 18,2 s gegenüber 15,0 s auf diesem Weg.
         *
         * Das Bild ist dabei dasselbe, nicht nur ein ähnliches: über 1,9
         * Millionen Bytes mit halbdurchsichtigen und getönten Props kam kein
         * einziges abweichendes Byte heraus.
         */
        const roh = renderer.app.renderer.extract.pixels(target);
        // Der Typ sagt `ArrayBufferLike`, weil er einen `SharedArrayBuffer`
        // nicht ausschließt; ein Rücklesen aus WebGL liefert nie einen.
        const daten = roh.pixels as Uint8ClampedArray<ArrayBuffer>;
        ctx.putImageData(new ImageData(daten, roh.width, roh.height), tx, ty);
        target.destroy(true);

        done++;
        yield { done, total };
      }
    }
  } finally {
    // Läuft auch, wenn der Aufrufer den Generator abbricht — sonst bliebe die
    // Bühne in der Export-Ansicht stehen und der Ticker aus.
    restore();
    if (wasRunning) renderer.app.ticker.start();
  }

  return out;
}

/**
 * Rendert die Karte in ein Canvas.
 *
 * Läuft synchron zwischen Anhalten und Fortsetzen des Tickers — dazwischen darf
 * nichts anderes die Welt-Transformation anfassen.
 */
export function renderMapToCanvas(
  renderer: MapRenderer,
  doc: MapDocument,
  options: ImageExportOptions,
): HTMLCanvasElement {
  const durchlauf = renderTiles(renderer, doc, options);
  let schritt = durchlauf.next();
  while (!schritt.done) schritt = durchlauf.next();
  return schritt.value;
}

/**
 * Gibt zwischen zwei Kacheln an den Browser ab.
 *
 * Nicht `requestAnimationFrame`: in einem nicht sichtbaren Tab feuert der gar
 * nicht, und der Export bliebe für immer stehen. `setTimeout` wäre dort auf
 * eine Sekunde gedrosselt — bei 64 Kacheln also eine Minute Wartezeit obendrauf.
 * Ein MessageChannel kennt beide Fallen nicht: er stellt eine Makroaufgabe ein,
 * ungedrosselt, und der Browser zeichnet zwischen zwei Makroaufgaben.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const kanal = new MessageChannel();
    kanal.port1.onmessage = () => {
      kanal.port1.close();
      resolve();
    };
    kanal.port2.postMessage(null);
  });
}

/**
 * Wie `renderMapToCanvas`, aber mit Rückmeldung je Kachel.
 *
 * Der Weg für die Oberfläche: eine große Karte braucht zweistellige Sekunden,
 * und die gehören angezeigt.
 */
export async function renderMapToCanvasAsync(
  renderer: MapRenderer,
  doc: MapDocument,
  options: ImageExportOptions,
  onProgress?: (progress: ExportProgress) => void,
): Promise<HTMLCanvasElement> {
  const durchlauf = renderTiles(renderer, doc, options);
  for (;;) {
    const schritt = durchlauf.next();
    if (schritt.done) return schritt.value;
    onProgress?.(schritt.value);
    await yieldToBrowser();
  }
}

const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
};

export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht kodiert werden'))),
      MIME[format],
      format === 'png' ? undefined : quality,
    );
  });
}

/** Base64 ohne data:-Präfix — genau das, was die UVTT-Datei erwartet. */
export async function canvasToBase64(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number,
): Promise<string> {
  const blob = await canvasToBlob(canvas, format, quality);
  const buffer = await blob.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

export function bytesToBase64(bytes: Uint8Array): string {
  // In Blöcken, weil String.fromCharCode bei sehr großen Arrays den Aufrufstapel
  // sprengt — bei Kartenbildern sind mehrere Megabyte der Normalfall.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst freigeben, wenn der Download angestoßen ist.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Dateiname aus dem Kartennamen, ohne für Dateisysteme heikle Zeichen. */
export function safeFilename(name: string, extension: string): string {
  const base = name.trim().replace(/[<>:"/\\|?*\s]+/g, '_').replace(/\.+$/, '') || 'karte';
  return `${base}.${extension}`;
}

/**
 * Eine andere Karte derselben Datei als Bild (`model/mappe.ts`).
 *
 * Der Renderer spiegelt nur die offene Karte. Für die Unterlage im Editor und
 * den Export aller Ebenen baut er die andere kurz auf, rendert sie und baut
 * danach die offene wieder auf — alles in einem Zug, ohne dass ein Bild der
 * fremden Karte auf dem Schirm erscheint. Ist `doc` die offene Karte, ist es
 * dasselbe wie `renderMapToCanvas`.
 */
export function renderFremdeKarte(
  renderer: MapRenderer,
  doc: MapDocument,
  offen: MapDocument,
  options: ImageExportOptions,
): HTMLCanvasElement {
  if (doc === offen) return renderMapToCanvas(renderer, doc, options);
  renderer.rebuildAll(doc);
  try {
    return renderMapToCanvas(renderer, doc, options);
  } finally {
    renderer.rebuildAll();
  }
}
