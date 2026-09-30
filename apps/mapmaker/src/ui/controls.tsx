/** Kleine, wiederverwendbare Bedienelemente. */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { fromHex, toHex } from '@/model/color';
import { alsKnopf } from '@suite/tastatur';

export function Section({
  title,
  children,
  defaultOpen = true,
  actions,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <header onClick={() => setOpen((o) => !o)} {...alsKnopf(() => setOpen((o) => !o))} aria-expanded={open}>
        <span>
          {open ? '▾' : '▸'} {title}
        </span>
        {actions ? <span onClick={(e) => e.stopPropagation()}>{actions}</span> : null}
      </header>
      {open ? <div className="body">{children}</div> : null}
    </div>
  );
}

export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className={label ? 'row' : 'row wide'}>
      {label ? <label>{label}</label> : null}
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="row">
      <label>{label}</label>
      <div className="row-inline">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        <span className="value">{format ? format(value) : round(value)}</span>
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  // Lokaler Text, damit man beim Tippen auch leer oder "-" haben darf.
  const [text, setText] = useState(String(round(value)));
  useEffect(() => setText(String(round(value))), [value]);

  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
    else setText(String(round(value)));
  };

  return (
    <div className="row">
      <label>{label}</label>
      <input
        type="number"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  allowNone = false,
  onNone,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  allowNone?: boolean;
  onNone?: () => void;
}) {
  const id = useId();
  return (
    <div className="row">
      <label htmlFor={id}>{label}</label>
      <div className="row-inline">
        <input
          id={id}
          type="color"
          value={toHex(value ?? 0xffffff)}
          onChange={(e) => onChange(fromHex(e.target.value))}
        />
        <input
          type="text"
          value={value === null ? '—' : toHex(value)}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(fromHex(v));
          }}
        />
        {allowNone ? (
          <button className="ghost icon" title="Keine Farbe" onClick={onNone}>
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="row">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Zwei gekoppelte Regler für einen Wertebereich (min/max). */
export function RangeField({
  label,
  min,
  max,
  lo,
  hi,
  step = 0.05,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  lo: number;
  hi: number;
  step?: number;
  onChange: (lo: number, hi: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = format ?? ((v: number) => round(v).toString());
  return (
    <div className="row">
      <label>{label}</label>
      <div className="row-inline">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange(Math.min(Number(e.target.value), hi), hi)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo))}
        />
        <span className="value">
          {fmt(lo)}–{fmt(hi)}
        </span>
      </div>
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function clamp(v: number, min?: number, max?: number): number {
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
}

/**
 * Esc schließt einen Dialog.
 *
 * Jeder Dialog hat sein ✕ und schließt beim Klick daneben — nur Esc fehlte, und
 * das ist der Griff, den man ohne Hinsehen macht.
 *
 * **Zwei Dinge, die hier nicht offensichtlich sind.**
 *
 * Erstens hängt der Zuhörer *einmal* und liest die Rückmeldefunktion aus einer
 * Ablage. Hinge er an `onClose`, würde er bei jedem Neuzeichnen abgemeldet und
 * neu angemeldet — und wer während einer laufenden Tastenverarbeitung
 * abgemeldet wird, kommt nicht mehr dran. Genau das ist passiert: der stets
 * eingehängte Notiz-Dialog schloss sich als Erster, das löste ein Neuzeichnen
 * aus, und der Hilfe-Dialog verlor seinen Zuhörer mitten im Ereignis.
 *
 * Zweitens muss ein Dialog, der gerade nichts zeigt, auch nicht auf Esc hören.
 * `enabled` ist dafür da — sonst verbraucht ein unsichtbarer Dialog die Taste.
 *
 * Auf dem Fenster und nicht auf dem Dialog-Element: der Fokus kann in einem
 * Eingabefeld liegen, auf einem Knopf oder nirgends.
 */
export function useEscapeClose(onClose: () => void, enabled = true): void {
  const rueckruf = useRef(onClose);
  rueckruf.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      rueckruf.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
