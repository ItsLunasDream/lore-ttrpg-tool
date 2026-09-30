/**
 * Handlungsstraenge (Rueckmeldung): mehrere Plots als Zweige, grafisch.
 * Jeder Strang eine Zeile; ein Zweig beginnt hinter der Notiz, an der er
 * abzweigt, und kann am Ende in einen anderen Strang muenden. Rechts die
 * Leiste zum Bearbeiten. Datenmodell und Anordnung: shared/straenge.ts.
 */
import { useMemo, useState } from 'react';
import type { NoteIndex } from '../noteIndex';
import type { Note } from '../../shared/types';
import { ordneStraenge, STRANG_FARBEN, type Anschluss, type Strang } from '../../shared/straenge';
import { useT } from '../i18n';

interface Props {
  index: NoteIndex;
  straenge: readonly Strang[];
  speichern: (straenge: Strang[]) => void;
  activeNoteId: string | null;
  onOpenNote: (noteId: string) => void;
  onHover: (note: Note | null, rect: DOMRect | null) => void;
}

const SPALTE = 160;
const ZEILE = 120;
const RAND_X = 130;
const RAND_Y = 60;

const neueId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Handlungsstraenge({ index, straenge, speichern, activeNoteId, onOpenNote, onHover }: Props) {
  const t = useT();
  const [gewaehlt, setGewaehlt] = useState<string | null>(straenge[0]?.id ?? null);
  const nachId = useMemo(() => new Map(index.notes.map((n) => [n.id, n])), [index.notes]);
  // Geloeschte Notizen nicht als leere Knoten zeigen; gespeichert wird bereinigt (vault.savePlots).
  const sichtbar = useMemo(
    () =>
      straenge.map((s) => ({
        ...s,
        notizen: s.notizen.filter((n) => nachId.has(n)),
        von: s.von && nachId.has(s.von.notiz) ? s.von : null,
        nach: s.nach && nachId.has(s.nach.notiz) ? s.nach : null
      })),
    [straenge, nachId]
  );
  const { knoten, kanten, spalten } = useMemo(() => ordneStraenge(sichtbar), [sichtbar]);
  const strang = straenge.find((s) => s.id === gewaehlt) ?? null;

  const aendere = (id: string, wie: (s: Strang) => Strang) => speichern(straenge.map((s) => (s.id === id ? wie(s) : s)));
  const breite = RAND_X + Math.max(1, spalten) * SPALTE + 40;
  const hoehe = RAND_Y * 2 + Math.max(1, straenge.length) * ZEILE - 40;
  const x = (spalte: number) => RAND_X + spalte * SPALTE + SPALTE / 2;
  const y = (zeile: number) => RAND_Y + zeile * ZEILE;

  const pfad = (a: { spalte: number; zeile: number }, b: { spalte: number; zeile: number }) => {
    const x1 = x(a.spalte), y1 = y(a.zeile), x2 = x(b.spalte), y2 = y(b.zeile);
    if (y1 === y2) return `M${x1},${y1} L${x2},${y2}`;
    // Gleiche Spalte: seitlich ausbiegen, sonst laeuft die Linie durch die Titel.
    if (x1 === x2) return `M${x1 + 11},${y1} C${x1 + 70},${y1} ${x2 + 70},${y2} ${x2 + 11},${y2}`;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  // Alle Notizen der anderen Straenge, als Ziel fuer Abzweig und Muendung.
  const anschluesse = (selbst: string) =>
    straenge
      .filter((s) => s.id !== selbst)
      .flatMap((s) => s.notizen.map((n) => ({ strang: s, notiz: n, titel: nachId.get(n)?.title ?? n })));

  return (
    <div className="straenge">
      <div className="straenge__flaeche">
        {straenge.length === 0 ? (
          <p className="zeitstrahl__leer">{t('plots.empty')}</p>
        ) : (
          <svg width={breite} height={hoehe} className="straenge__svg" role="img" aria-label={t('plots.title')}>
            {straenge.map((s, i) => (
              <g key={s.id} className={`straenge__zeile${s.id === gewaehlt ? ' is-active' : ''}`} onClick={() => setGewaehlt(s.id)}>
                <rect x={0} y={y(i) - ZEILE / 2 + 6} width={breite} height={ZEILE - 12} rx={8} className="straenge__band" />
                <text x={12} y={y(i) + 5} className="straenge__name" fill={STRANG_FARBEN[s.farbe]}>
                  {s.name || t('plots.unnamed')}
                </text>
              </g>
            ))}
            {kanten.map((k, i) => {
              const farbe = STRANG_FARBEN[straenge.find((s) => s.id === k.strang)?.farbe ?? 0];
              return <path key={i} d={pfad(k.von, k.nach)} className={`straenge__kante straenge__kante--${k.art}`} stroke={farbe} />;
            })}
            {knoten.map((k) => {
              const note = nachId.get(k.notiz);
              const farbe = STRANG_FARBEN[straenge.find((s) => s.id === k.strang)?.farbe ?? 0];
              return (
                <g
                  key={`${k.strang}/${k.notiz}`}
                  className={`straenge__knoten${k.notiz === activeNoteId ? ' is-active' : ''}`}
                  transform={`translate(${x(k.spalte)} ${y(k.zeile)})`}
                  data-strang-knoten={k.notiz}
                  onClick={() => onOpenNote(k.notiz)}
                  onMouseEnter={(e) => note && onHover(note, (e.currentTarget as SVGGElement).getBoundingClientRect())}
                  onMouseLeave={() => onHover(null, null)}
                >
                  <circle r={11} fill={farbe} />
                  <text y={30} className="straenge__titel">
                    {(note?.title ?? '?').length > 20 ? `${(note?.title ?? '').slice(0, 19)}…` : note?.title ?? '?'}
                  </text>
                  {note?.fields.date ? (
                    <text y={-20} className="straenge__zeit">
                      {note.fields.date}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <aside className="straenge__leiste">
        <div className="straenge__kopf">
          <strong>{t('plots.title')}</strong>
          <button
            type="button"
            data-strang-neu
            onClick={() => {
              const neu: Strang = { id: neueId(), name: t('plots.newName', { n: straenge.length + 1 }), farbe: straenge.length % STRANG_FARBEN.length, notizen: [] };
              speichern([...straenge, neu]);
              setGewaehlt(neu.id);
            }}
          >
            + {t('plots.new')}
          </button>
        </div>
        <div className="straenge__chips">
          {straenge.map((s) => (
            <button key={s.id} type="button" className={s.id === gewaehlt ? 'is-active' : undefined} onClick={() => setGewaehlt(s.id)}>
              <span className="graph__swatch" style={{ background: STRANG_FARBEN[s.farbe] }} />
              {s.name || t('plots.unnamed')}
            </button>
          ))}
        </div>

        {strang ? (
          <div className="straenge__bearbeiten" data-strang={strang.id}>
            <label className="straenge__feld">
              <span>{t('plots.name')}</span>
              <input value={strang.name} maxLength={80} data-strang-name onChange={(e) => aendere(strang.id, (s) => ({ ...s, name: e.target.value }))} />
            </label>
            <div className="straenge__farben" role="radiogroup" aria-label={t('plots.color')}>
              {STRANG_FARBEN.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={strang.farbe === i}
                  className={strang.farbe === i ? 'is-active' : undefined}
                  style={{ background: f }}
                  aria-label={f}
                  onClick={() => aendere(strang.id, (s) => ({ ...s, farbe: i }))}
                />
              ))}
            </div>

            <h4>{t('plots.notes')}</h4>
            <ol className="straenge__liste">
              {strang.notizen.map((n, i) => (
                <li key={n}>
                  <span>{nachId.get(n)?.title ?? n}</span>
                  <button type="button" aria-label="↑" disabled={i === 0} onClick={() => aendere(strang.id, (s) => ({ ...s, notizen: tausche(s.notizen, i, i - 1) }))}>
                    ↑
                  </button>
                  <button type="button" aria-label="↓" disabled={i === strang.notizen.length - 1} onClick={() => aendere(strang.id, (s) => ({ ...s, notizen: tausche(s.notizen, i, i + 1) }))}>
                    ↓
                  </button>
                  <button type="button" aria-label={t('plots.remove')} title={t('plots.remove')} onClick={() => aendere(strang.id, (s) => ({ ...s, notizen: s.notizen.filter((x) => x !== n) }))}>
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <Wahl
              platzhalter={t('plots.addNote')}
              punkte={index.notes.filter((n) => !strang.notizen.includes(n.id)).map((n) => ({ id: n.id, text: n.title }))}
              daten="data-strang-notiz-suche"
              waehle={(id) => aendere(strang.id, (s) => ({ ...s, notizen: [...s.notizen, id] }))}
            />

            <h4>{t('plots.branchFrom')}</h4>
            <Anschlusswahl
              wert={strang.von ?? null}
              punkte={anschluesse(strang.id)}
              keiner={t('plots.none')}
              platzhalter={t('plots.pickNote')}
              daten="data-strang-von"
              aendern={(a) => aendere(strang.id, (s) => ({ ...s, von: a }))}
              nachId={nachId}
              straenge={straenge}
            />
            <h4>{t('plots.mergeInto')}</h4>
            <Anschlusswahl
              wert={strang.nach ?? null}
              punkte={anschluesse(strang.id)}
              keiner={t('plots.none')}
              platzhalter={t('plots.pickNote')}
              daten="data-strang-nach"
              aendern={(a) => aendere(strang.id, (s) => ({ ...s, nach: a }))}
              nachId={nachId}
              straenge={straenge}
            />

            <button
              type="button"
              className="straenge__weg"
              onClick={() => {
                if (!window.confirm(t('plots.deleteConfirm', { name: strang.name || t('plots.unnamed') }))) return;
                // Anschluesse anderer Straenge an diesen fallen mit weg.
                const rest = straenge
                  .filter((s) => s.id !== strang.id)
                  .map((s) => ({ ...s, von: s.von?.strang === strang.id ? null : s.von, nach: s.nach?.strang === strang.id ? null : s.nach }));
                speichern(rest);
                setGewaehlt(rest[0]?.id ?? null);
              }}
            >
              {t('plots.delete')}
            </button>
          </div>
        ) : (
          <p className="straenge__hinweis">{t('plots.hint')}</p>
        )}
      </aside>
    </div>
  );
}

function tausche<T>(liste: readonly T[], a: number, b: number): T[] {
  const neu = [...liste];
  [neu[a], neu[b]] = [neu[b], neu[a]];
  return neu;
}

/** Suchfeld mit Trefferliste statt Auswahlliste. */
function Wahl({ platzhalter, punkte, waehle, daten }: { platzhalter: string; punkte: { id: string; text: string; info?: string }[]; waehle: (id: string) => void; daten: string }) {
  const [text, setText] = useState('');
  const treffer = text.trim() ? punkte.filter((p) => `${p.text} ${p.info ?? ''}`.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <div className="straenge__wahl">
      <input
        type="search"
        placeholder={platzhalter}
        value={text}
        {...{ [daten]: '' }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && treffer[0]) {
            waehle(treffer[0].id);
            setText('');
          }
        }}
      />
      {treffer.length ? (
        <ul>
          {treffer.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-wahl={p.id}
                onClick={() => {
                  waehle(p.id);
                  setText('');
                }}
              >
                {p.text}
                {p.info ? <span className="straenge__info">{p.info}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Anschlusswahl({
  wert,
  punkte,
  keiner,
  platzhalter,
  aendern,
  daten,
  nachId,
  straenge
}: {
  wert: Anschluss | null;
  punkte: { strang: Strang; notiz: string; titel: string }[];
  keiner: string;
  platzhalter: string;
  aendern: (a: Anschluss | null) => void;
  daten: string;
  nachId: ReadonlyMap<string, Note>;
  straenge: readonly Strang[];
}) {
  if (wert) {
    const s = straenge.find((x) => x.id === wert.strang);
    return (
      <div className="straenge__anschluss">
        <span className="graph__swatch" style={{ background: STRANG_FARBEN[s?.farbe ?? 0] }} />
        <span>
          {s?.name} › {nachId.get(wert.notiz)?.title ?? wert.notiz}
        </span>
        <button type="button" onClick={() => aendern(null)} title={keiner}>
          ×
        </button>
      </div>
    );
  }
  return (
    <Wahl
      platzhalter={platzhalter}
      daten={daten}
      punkte={punkte.map((p) => ({ id: `${p.strang.id}\u0000${p.notiz}`, text: p.titel, info: p.strang.name }))}
      waehle={(id) => {
        const [strang, notiz] = id.split('\u0000');
        aendern({ strang, notiz });
      }}
    />
  );
}
