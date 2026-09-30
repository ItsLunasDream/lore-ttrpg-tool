/**
 * Bedienelemente statt Auswahllisten: Segmente fuer wenige Werte, Pips fuer
 * Stufen (Erschoepfung), eine Suchwahl fuer lange Listen (Waffen, Zustaende).
 *
 * Jede Wahl traegt `data-wert`, damit Rauchtests sie finden.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Option<T extends string | number> {
  readonly wert: T;
  readonly text: ReactNode;
  readonly titel?: string;
}

/** Eine Reihe aneinanderliegender Knoepfe; genau einer ist an. */
export function Segment<T extends string | number>({
  optionen,
  wert,
  aendern,
  label,
  daten,
  klein
}: {
  optionen: readonly Option<T>[];
  wert: T;
  aendern: (v: T) => void;
  label: string;
  /** Kennzeichen fuer Tests, etwa `{ 'data-wurf-ziel': '' }`. */
  daten?: Record<string, string>;
  klein?: boolean;
}) {
  return (
    <div className={klein ? 'segment segment--klein' : 'segment'} role="radiogroup" aria-label={label} {...daten}>
      {optionen.map((o) => (
        <button
          key={String(o.wert)}
          type="button"
          role="radio"
          aria-checked={o.wert === wert}
          className={o.wert === wert ? 'ist-an' : ''}
          data-wert={String(o.wert)}
          title={o.titel}
          onClick={() => aendern(o.wert)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** Stufen als Punkte: Klick auf Stufe n setzt n, Klick auf die gesetzte nimmt eine zurueck. */
export function Pips({
  wert,
  max,
  aendern,
  label,
  titel,
  daten,
  gefahr
}: {
  wert: number;
  max: number;
  aendern: (v: number) => void;
  label: string;
  titel?: (n: number) => string;
  daten?: Record<string, string>;
  /** Ab dieser Stufe rot (Erschoepfung 6 = tot). */
  gefahr?: number;
}) {
  return (
    <div className="pips" role="group" aria-label={label} data-stufe={wert} {...daten}>
      {Array.from({ length: max }, (_, k) => k + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`pip${n <= wert ? ' ist-an' : ''}${gefahr !== undefined && n >= gefahr ? ' pip--gefahr' : ''}`}
          data-wert={n}
          aria-pressed={n <= wert}
          aria-label={`${label} ${n}`}
          title={titel?.(n)}
          onClick={() => aendern(n === wert ? n - 1 : n)}
        />
      ))}
    </div>
  );
}

export interface Wahlpunkt {
  readonly id: string;
  readonly name: string;
  /** Kleine Zeile darunter oder daneben. */
  readonly info?: string;
  /** Ueberschrift der Gruppe, in der der Punkt steht. */
  readonly gruppe?: string;
  readonly titel?: string;
}

/**
 * Knopf, der eine durchsuchbare Liste aufklappt. Fuer alles mit mehr als
 * einer Handvoll Moeglichkeiten.
 */
export function Suchwahl({
  punkte,
  wert,
  aendern,
  knopf,
  suche,
  leer,
  daten,
  klasse
}: {
  punkte: readonly Wahlpunkt[];
  wert?: string | null;
  aendern: (id: string) => void;
  /** Was auf dem Knopf steht. */
  knopf: ReactNode;
  suche: string;
  /** Ein erster Eintrag ohne Wert („Frei", „Keine Waffe"). */
  leer?: string;
  daten?: Record<string, string>;
  klasse?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const rahmen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (rahmen.current && !rahmen.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('mousedown', zu);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('mousedown', zu);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  const treffer = useMemo(() => {
    const worte = text.toLowerCase().split(/\s+/).filter(Boolean);
    return punkte.filter((p) => worte.every((w) => `${p.name} ${p.info ?? ''} ${p.gruppe ?? ''}`.toLowerCase().includes(w)));
  }, [punkte, text]);

  const waehle = (id: string) => {
    aendern(id);
    setOffen(false);
    setText('');
  };

  let letzteGruppe: string | undefined;
  return (
    <div className={`suchwahl ${klasse ?? ''}`} ref={rahmen} {...daten}>
      <button type="button" className="suchwahl__knopf" aria-expanded={offen} onClick={() => setOffen((o) => !o)}>
        {knopf}
        <span className="suchwahl__pfeil" aria-hidden="true">
          ▾
        </span>
      </button>
      {offen ? (
        <div className="suchwahl__tafel" role="dialog">
          <input
            type="search"
            autoFocus
            placeholder={suche}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && treffer[0]) {
                e.preventDefault();
                waehle(treffer[0].id);
              }
            }}
          />
          <ul role="listbox">
            {leer !== undefined && !text ? (
              <li>
                <button type="button" data-wert="" className={!wert ? 'ist-an' : ''} onClick={() => waehle('')}>
                  {leer}
                </button>
              </li>
            ) : null}
            {treffer.map((p) => {
              const kopf = p.gruppe && p.gruppe !== letzteGruppe ? p.gruppe : null;
              letzteGruppe = p.gruppe;
              return (
                <li key={p.id}>
                  {kopf ? <div className="suchwahl__gruppe">{kopf}</div> : null}
                  <button type="button" role="option" aria-selected={p.id === wert} data-wert={p.id} className={p.id === wert ? 'ist-an' : ''} title={p.titel} onClick={() => waehle(p.id)}>
                    <span>{p.name}</span>
                    {p.info ? <span className="leise">{p.info}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Ein Punkt, der eine Uebungsstufe zeigt: leer, halb, voll, doppelt. Alle gleich gross. */
export function Uebungspunkt({ stufe }: { stufe: number }) {
  const art = stufe >= 2 ? 'doppelt' : stufe >= 1 ? 'voll' : stufe > 0 ? 'halb' : 'leer';
  return <span className={`upunkt upunkt--${art}`} aria-hidden="true" />;
}
