/**
 * Ein `<input type="number">`, das erst nach der Eingabe begrenzt
 * (Regeln in index.ts). Alle übrigen Eigenschaften gehen an das Feld.
 */
import { useState, type InputHTMLAttributes } from 'react';
import { amEnde, waehrendDesTippens } from './index';

type Rest = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'defaultValue'>;

export interface ZahlFeldProps extends Rest {
  readonly wert: number;
  readonly min?: number;
  readonly max?: number;
  /** Nur ganze Zahlen (Vorgabe). */
  readonly ganz?: boolean;
  readonly aendern: (n: number) => void;
  /** Als schmales Textfeld mit Ziffern-Tastatur statt mit Pfeilen. */
  readonly alsText?: boolean;
}

export function ZahlFeld({ wert, min, max, ganz = true, aendern, alsText = false, onBlur, onKeyDown, ...rest }: ZahlFeldProps) {
  // null = nicht am Tippen; dann zeigt das Feld den Wert von außen.
  const [text, setText] = useState<string | null>(null);
  const bereich = { min, max, ganz };
  const fertig = () => {
    if (text === null) return;
    const n = amEnde(text, bereich);
    if (n !== null && n !== wert) aendern(n);
    setText(null);
  };
  return (
    <input
      {...rest}
      {...(alsText ? { type: 'text', inputMode: 'numeric' as const } : { type: 'number', min, max })}
      value={text ?? String(wert)}
      onChange={(e) => {
        setText(e.target.value);
        const n = waehrendDesTippens(e.target.value, bereich);
        if (n !== null && n !== wert) aendern(n);
      }}
      onBlur={(e) => {
        fertig();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') fertig();
        onKeyDown?.(e);
      }}
    />
  );
}
