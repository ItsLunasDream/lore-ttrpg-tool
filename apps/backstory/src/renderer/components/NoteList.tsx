import { useState } from 'react';
import { findNoteType } from '../../shared/noteTypes';
import type { Note, NoteType, SearchHit, UnreadableNote } from '../../shared/types';
import type { NoteIndex, SearchFilters } from '../noteIndex';
import { ContextMenu } from './ContextMenu';
import { HighlightedText } from './HighlightedText';
import { useT } from '../i18n';

interface Props {
  index: NoteIndex;
  notes: Note[];
  /** Treffer der Volltextsuche, nach Notiz-ID. Leer, wenn nicht gesucht wird. */
  hits: Map<string, SearchHit>;
  activeNoteId: string | null;
  /**
   * IDs der Notizen mit ungespeicherten Aenderungen.
   *
   * Ohne Autosave koennen mehrere Notizen gleichzeitig ungespeichert sein.
   * Ohne Markierung in der Liste findet man sie nicht wieder — man muesste
   * sich merken, was man angefasst hat.
   */
  ungespeichert: ReadonlySet<string>;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSelect: (noteId: string) => void;
  onCreate: (type: NoteType) => void;
  /** Dateien, die sich nicht lesen lassen. Leer im Normalfall. */
  unreadable: UnreadableNote[];
  onRevealVault: () => void;
  /** Rechtsklick auf eine Notiz: umbenennen. */
  onRename: (note: Note) => void;
  /** Rechtsklick auf eine Notiz: loeschen. Fragt vorher nach. */
  onDelete: (note: Note) => void;
}

export function NoteList({
  index,
  notes,
  hits,
  activeNoteId,
  ungespeichert,
  filters,
  onFiltersChange,
  onSelect,
  onCreate,
  unreadable,
  onRevealVault,
  onRename,
  onDelete
}: Props) {
  const t = useT();
  /** Das offene Rechtsklickmenue: Stelle und betroffene Notiz. */
  const [menue, setMenue] = useState<{ x: number; y: number; note: Note } | null>(null);
  const grouped = index.types
    .map((def) => ({ def, entries: notes.filter((note) => note.type === def.id) }))
    .filter((group) => group.entries.length > 0);

  // Notizen, deren Typ geloescht wurde, wuerden sonst unsichtbar werden.
  const orphans = notes.filter((note) => !index.types.some((def) => def.id === note.type));
  if (orphans.length) {
    grouped.push({ def: { id: '__orphan', label: t('list.withoutType'), plural: t('list.withoutType'), fields: [] }, entries: orphans });
  }

  const badNames = unreadable.filter((entry) => entry.reason === 'name').length;

  return (
    <div className="note-list">
      {unreadable.length ? (
        <p className="note-list__broken">
          {unreadable.length === 1
            ? t('list.unreadableOne')
            : t('list.unreadable', { count: unreadable.length })}{' '}
          {/*
            Liegt es am Dateinamen, hilft ein Umbenennen. Ohne diesen Hinweis
            waere nicht zu erraten, was an der Datei falsch ist.
          */}
          {badNames ? (
            <>
              {badNames === 1 ? t('list.unreadableNameOne') : t('list.unreadableName', { count: badNames })}{' '}
            </>
          ) : null}
          <button type="button" className="link-button" onClick={onRevealVault}>
            {t('list.unreadableOpen')}
          </button>
        </p>
      ) : null}

      <div className="note-list__search">
        <input
          type="search"
          value={filters.query}
          placeholder={t('list.search')}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
        />
      </div>

      <div className="note-list__filters">
        <select
          value={filters.type}
          onChange={(event) => onFiltersChange({ ...filters, type: event.target.value as NoteType | 'all' })}
        >
          <option value="all">{t('list.allTypes')}</option>
          {index.types.map((def) => (
            <option value={def.id} key={def.id}>
              {def.plural}
            </option>
          ))}
        </select>
        <select
          value={filters.tag ?? ''}
          onChange={(event) => onFiltersChange({ ...filters, tag: event.target.value || null })}
        >
          <option value="">{t('list.allTags')}</option>
          {index.tags.map((tag) => (
            <option value={tag} key={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <div className="note-list__new">
        {index.types.map((def) => (
          <button type="button" key={def.id} onClick={() => onCreate(def.id)} title={t('list.newNoteOf', { label: def.label })}>
            + {def.label}
          </button>
        ))}
      </div>

      <div className="note-list__scroll" data-pfeile="liste">
        {grouped.length === 0 ? (
          <p className="note-list__empty">{index.notes.length === 0 ? t('list.emptyCampaign') : t('list.noMatch')}</p>
        ) : (
          grouped.map(({ def, entries }) => (
            <section key={def.id}>
              <h4 className="note-list__group">{def.plural}</h4>
              <ul>
                {entries.map((note) => {
                  const hit = hits.get(note.id);
                  return (
                    <li key={note.id}>
                      <button
                        type="button"
                        className={note.id === activeNoteId ? 'is-active' : undefined}
                        onClick={() => onSelect(note.id)}
                        onContextMenu={(ereignis) => {
                          ereignis.preventDefault();
                          // Die Notiz wird dabei ausgewaehlt. Ein Menue ueber
                          // einer Zeile, die nicht die offene ist, laedt zum
                          // Verwechseln ein — und Loeschen ist endgueltig.
                          onSelect(note.id);
                          setMenue({ x: ereignis.clientX, y: ereignis.clientY, note });
                        }}
                      >
                        <span className="note-list__title">
                          {hit?.field === 'title' ? (
                            <HighlightedText text={hit.snippet} matches={hit.matches} />
                          ) : note.title.trim() ? (
                            note.title
                          ) : (
                            // Ohne Titel stand hier nur der Punkt „ungespeichert" (Testbericht).
                            <em className="note-list__ohne-titel">{t('list.untitled')}</em>
                          )}
                          {ungespeichert.has(note.id) ? (
                            <span
                              className="note-list__ungespeichert"
                              title={t('list.unsaved')}
                              aria-label={t('list.unsaved')}
                            >
                              •
                            </span>
                          ) : null}
                        </span>

                        {hit && hit.field !== 'title' ? (
                          <span className="note-list__snippet">
                            {hit.label ? <span className="note-list__snippet-label">{hit.label}: </span> : null}
                            <HighlightedText text={hit.snippet} matches={hit.matches} />
                            {hit.bodyMatches > 1 ? (
                              <span className="note-list__more"> +{hit.bodyMatches - 1}</span>
                            ) : null}
                          </span>
                        ) : note.tags.length ? (
                          <span className="note-list__tags">{note.tags.join(' · ')}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      {menue ? (
        <ContextMenu
          x={menue.x}
          y={menue.y}
          onClose={() => setMenue(null)}
          items={[
            { label: t('list.rename'), onSelect: () => onRename(menue.note) },
            { label: t('editor.delete'), danger: true, onSelect: () => onDelete(menue.note) }
          ]}
        />
      ) : null}

      <p className="note-list__total">
        {t('list.total', { total: index.notes.length, visible: notes.length })}
        {filters.type !== 'all' ? ` · ${findNoteType(index.types, filters.type).plural}` : ''}
      </p>
    </div>
  );
}
