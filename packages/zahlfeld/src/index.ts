/**
 * Zahlen tippen, ohne dass das Feld dazwischenfunkt (Rückmeldung: bei
 * Minimum 5 wurde aus der „1“ von „10“ sofort eine 5, dann 50).
 *
 * Regel: Während des Tippens wird nur übernommen, was schon gültig ist.
 * Begrenzt wird erst beim Verlassen des Felds oder mit Enter; ein leeres
 * oder unlesbares Feld lässt den alten Wert stehen.
 *
 * Plattformfrei; die React-Hülle steht in ZahlFeld.tsx.
 */

export interface Bereich {
  readonly min?: number;
  readonly max?: number;
  /** Nur ganze Zahlen (Vorgabe). */
  readonly ganz?: boolean;
}

/** Die getippte Zahl, oder null, wenn (noch) keine dasteht. */
export function liesZahl(text: string): number | null {
  const roh = text.trim().replace(',', '.');
  if (roh === '' || roh === '-' || roh === '.') return null;
  const n = Number(roh);
  return Number.isFinite(n) ? n : null;
}

export function begrenze(n: number, b: Bereich): number {
  const g = b.ganz === false ? n : Math.round(n);
  return Math.min(b.max ?? Infinity, Math.max(b.min ?? -Infinity, g));
}

/** Was beim Tippen sofort übernommen wird: nur eine Zahl, die schon im Bereich liegt. */
export function waehrendDesTippens(text: string, b: Bereich): number | null {
  const n = liesZahl(text);
  if (n === null) return null;
  if (b.ganz !== false && !Number.isInteger(n)) return null;
  return n >= (b.min ?? -Infinity) && n <= (b.max ?? Infinity) ? n : null;
}

/** Was beim Verlassen übernommen wird; null = alten Wert behalten. */
export function amEnde(text: string, b: Bereich): number | null {
  const n = liesZahl(text);
  return n === null ? null : begrenze(n, b);
}
