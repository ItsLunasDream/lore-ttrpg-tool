/**
 * Der Zeitstrahl neben dem Graph (Rueckmeldung): die Ereignisse der
 * Kampagne in zeitlicher Folge, als Knoten auf einer Linie. Ein Klick
 * oeffnet die Notiz, Ueberfahren zeigt die Kurzinfo.
 *
 * Aufgenommen wird jede Notiz vom Typ „Ereignis“ und jede andere mit einem
 * ausgefuellten Feld `date`. Die Reihenfolge kommt aus `shared/zeitstrahl`.
 */
import { useMemo } from 'react';
import type { NoteIndex } from '../noteIndex';
import type { Note } from '../../shared/types';
import { vergleicheZeit, zeitSchluessel } from '../../shared/zeitstrahl';
import { typFarbe } from '../../shared/graphFarben';
import { useT } from '../i18n';

interface Props {
  index: NoteIndex;
  activeNoteId: string | null;
  onOpenNote: (noteId: string) => void;
  onHover: (note: Note | null, rect: DOMRect | null) => void;
}

export function Zeitstrahl({ index, activeNoteId, onOpenNote, onHover }: Props) {
  const t = useT();
  const ereignisse = useMemo(
    () =>
      index.notes
        .filter((n) => n.type === 'event' || (n.fields.date ?? '').trim())
        .map((n) => ({ note: n, zeit: (n.fields.date ?? '').trim(), titel: n.title }))
        .sort(vergleicheZeit),
    [index.notes]
  );
  const datiert = ereignisse.filter((e) => zeitSchluessel(e.zeit));
  const ohne = ereignisse.filter((e) => !zeitSchluessel(e.zeit));

  if (ereignisse.length === 0) return <p className="zeitstrahl__leer">{t('timeline.empty')}</p>;

  const knoten = (e: (typeof ereignisse)[number], nummer: number) => (
    <li key={e.note.id} className={`zeitstrahl__punkt${nummer % 2 ? ' zeitstrahl__punkt--unten' : ''}`}>
      <button
        type="button"
        className={`zeitstrahl__knoten${e.note.id === activeNoteId ? ' is-active' : ''}`}
        data-zeitstrahl={e.note.id}
        style={{ ['--farbe' as string]: typFarbe(index.types, e.note.type) }}
        onClick={() => onOpenNote(e.note.id)}
        onMouseEnter={(ev) => onHover(e.note, ev.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => onHover(null, null)}
        onFocus={(ev) => onHover(e.note, ev.currentTarget.getBoundingClientRect())}
        onBlur={() => onHover(null, null)}
      >
        <span className="zeitstrahl__marke" aria-hidden="true" />
        <span className="zeitstrahl__text">
          <span className="zeitstrahl__zeit">{e.zeit || '—'}</span>
          <span className="zeitstrahl__titel">{e.titel}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="zeitstrahl">
      {datiert.length ? (
        <ol className="zeitstrahl__linie" aria-label={t('timeline.title')}>
          {datiert.map(knoten)}
        </ol>
      ) : null}
      {ohne.length ? (
        <section className="zeitstrahl__ohne">
          <h3>{t('timeline.undated')}</h3>
          <ol className="zeitstrahl__linie zeitstrahl__linie--ohne">{ohne.map(knoten)}</ol>
        </section>
      ) : null}
      <p className="graph__hint">{t('timeline.hint')}</p>
    </div>
  );
}
