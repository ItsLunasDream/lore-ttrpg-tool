/**
 * Musterfüllungen als wiederholbare Textur.
 *
 * Pixi kann eine Fläche mit einer Textur füllen, aber nicht mit einem Muster
 * beschreiben — die Kachel muss also selbst gezeichnet werden. Das passiert
 * einmal je Kombination aus Art, Größe, Farbe und Deckkraft und wird danach
 * behalten: eine Karte hat viele Flächen, aber wenige verschiedene Muster.
 *
 * Die Kacheln sind so gebaut, dass sie sich nahtlos aneinanderreihen. Das ist
 * die ganze Schwierigkeit daran: was am rechten Rand herausläuft, muss am
 * linken wieder hereinkommen, sonst zeigt sich bei jeder Wiederholung eine
 * Naht. Darum wird alles, was einen Rand berührt, auf beiden Seiten gezeichnet.
 */

import { FillPattern, Matrix, Texture } from 'pixi.js';
import type { PatternKind, PatternSpec } from '@/model/types';

/**
 * Auflösung der Kachel in Pixeln.
 *
 * Fest und nicht von `size` abhängig: die Kachel wird beim Füllen skaliert,
 * und eine feste Auflösung hält den Zwischenspeicher klein. 128 ist fein genug,
 * dass eine Fuge auch bei starkem Zoom nicht ausfranst.
 */
const TILE_PX = 128;

const cache = new Map<string, FillPattern>();

function toCss(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Zeichnet eine Kachel der angegebenen Art auf einen 2D-Kontext. */
function drawTile(ctx: CanvasRenderingContext2D, kind: PatternKind): void {
  const n = TILE_PX;
  ctx.lineCap = 'butt';

  switch (kind) {
    case 'hatch': {
      // Schräge Striche. Damit die Kachel aufgeht, laufen sie unter 45° und
      // werden dreimal versetzt gezeichnet.
      ctx.lineWidth = n * 0.05;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-n + i * n, n * 2);
        ctx.lineTo(n * 2 + i * n, -n);
        ctx.stroke();
      }
      break;
    }
    case 'crosshatch': {
      ctx.lineWidth = n * 0.04;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-n + i * n, n * 2);
        ctx.lineTo(n * 2 + i * n, -n);
        ctx.moveTo(-n + i * n, -n);
        ctx.lineTo(n * 2 + i * n, n * 2);
        ctx.stroke();
      }
      break;
    }
    case 'bricks': {
      // Zwei Reihen, die zweite um eine halbe Ziegellänge versetzt — sonst
      // stünden die Stoßfugen übereinander und es sähe aus wie ein Gitter.
      ctx.lineWidth = n * 0.045;
      const reihe = n / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(n, 0);
      ctx.moveTo(0, reihe);
      ctx.lineTo(n, reihe);
      // Stoßfugen: obere Reihe mittig, untere an den Rändern.
      ctx.moveTo(n / 2, 0);
      ctx.lineTo(n / 2, reihe);
      ctx.moveTo(0, reihe);
      ctx.lineTo(0, n);
      ctx.moveTo(n, reihe);
      ctx.lineTo(n, n);
      ctx.stroke();
      break;
    }
    case 'planks': {
      // Lange Dielen mit versetzten Stößen und etwas Maserung.
      ctx.lineWidth = n * 0.045;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(n, 0);
      ctx.moveTo(0, n / 3);
      ctx.lineTo(n, n / 3);
      ctx.moveTo(0, (n * 2) / 3);
      ctx.lineTo(n, (n * 2) / 3);
      ctx.moveTo(n * 0.35, 0);
      ctx.lineTo(n * 0.35, n / 3);
      ctx.moveTo(n * 0.75, n / 3);
      ctx.lineTo(n * 0.75, (n * 2) / 3);
      ctx.moveTo(n * 0.15, (n * 2) / 3);
      ctx.lineTo(n * 0.15, n);
      ctx.stroke();

      ctx.lineWidth = n * 0.012;
      ctx.beginPath();
      for (const y of [n * 0.16, n * 0.5, n * 0.84]) {
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(n * 0.3, y - n * 0.03, n * 0.7, y + n * 0.03, n, y);
      }
      ctx.stroke();
      break;
    }
    case 'tiles': {
      // Quadratische Platten, vier je Kachel.
      ctx.lineWidth = n * 0.04;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(n, 0);
      ctx.moveTo(0, n / 2);
      ctx.lineTo(n, n / 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, n);
      ctx.moveTo(n / 2, 0);
      ctx.lineTo(n / 2, n);
      ctx.stroke();
      break;
    }
    case 'dots': {
      // Versetztes Punktraster; die Randpunkte stehen an allen vier Seiten.
      const r = n * 0.06;
      const punkte: Array<[number, number]> = [
        [0, 0],
        [n, 0],
        [0, n],
        [n, n],
        [n / 2, n / 2],
      ];
      for (const [x, y] of punkte) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'waves': {
      // Kurze Wellenstriche, versetzt in zwei Reihen — das übliche Zeichen
      // für Wasser auf Karten. Jeder Strich liegt ganz innerhalb der Kachel,
      // deshalb gibt es keine Naht.
      ctx.lineWidth = n * 0.04;
      ctx.lineCap = 'round';
      const welle = (x: number, y: number) => {
        const b = n * 0.36;
        const h = n * 0.06;
        ctx.beginPath();
        ctx.moveTo(x - b / 2, y);
        ctx.bezierCurveTo(x - b / 4, y - h * 2, x - b / 8, y - h * 2, x, y);
        ctx.bezierCurveTo(x + b / 8, y + h * 2, x + b / 4, y + h * 2, x + b / 2, y);
        ctx.stroke();
      };
      welle(n * 0.28, n * 0.27);
      welle(n * 0.74, n * 0.76);
      break;
    }
    case 'scales': {
      // Schuppen: Halbkreise, die zweite Reihe um eine halbe Breite versetzt.
      ctx.lineWidth = n * 0.045;
      const r = n / 4;
      for (let reihe = 0; reihe < 2; reihe++) {
        const y = reihe * (n / 2);
        const versatz = reihe % 2 === 0 ? 0 : r;
        for (let i = -1; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(versatz + i * r * 2 + r, y, r, 0, Math.PI);
          ctx.stroke();
        }
      }
      break;
    }
  }
}

/**
 * Muster einer Füllung als Pixi-Fill.
 *
 * `null`, wenn die Füllung kein Muster hat oder kein Canvas zur Verfügung
 * steht — Letzteres nur in Tests ohne DOM.
 */
export function buildPattern(p: PatternSpec | null | undefined): FillPattern | null {
  if (!p || p.alpha <= 0 || p.size <= 0) return null;

  const key = `${p.kind}:${p.color}:${p.alpha}`;
  let muster = cache.get(key);

  if (!muster) {
    // Ohne DOM (Modelltests) gibt es kein Canvas und damit keine Kachel.
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const farbe = toCss(p.color, p.alpha);
    ctx.strokeStyle = farbe;
    ctx.fillStyle = farbe;
    drawTile(ctx, p.kind);

    muster = new FillPattern(Texture.from(canvas), 'repeat');
    cache.set(key, muster);
  }

  // Größe und Drehung stehen in der Abbildung, nicht in der Kachel: sonst
  // bekäme jede Größe eine eigene Textur.
  const skala = p.size / TILE_PX;
  const matrix = new Matrix().scale(skala, skala).rotate((p.angle * Math.PI) / 180);
  muster.transform = matrix;
  return muster;
}
