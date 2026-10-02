import { useState } from 'react';
import { ausblendenUnd } from '@suite/motion/dom';
import { RELATION_SUGGESTIONS, findNoteType } from '../../shared/noteTypes';
import type { Note, Relation } from '../../shared/types';
import type { NoteIndex } from '../noteIndex';
import { useT } from '../i18n';

interface Props {
  note: Note;
  index: NoteIndex;
  onChange: (relations: Relation[]) => void;
  onOpenNote: (noteId: string) => void;
  /** Legt bei der Zielnotiz eine Beziehung zurueck auf diese an. */
  onAddReverse: (targetId: string) => void;
}

/**
 * Beziehungen sind gerichtet und haengen am Notizpaar, nicht an der einzelnen
 * Textstelle. Der Fliesstext bleibt dadurch frei von Beziehungssyntax, und
 * dieselbe Beziehung wird nur einmal gepflegt.
 */
export function RelationsPanel({ note, index, onChange, onOpenNote, onAddReverse }: Props) {
  const t = useT();
  const [targetId, setTargetId] = useState('');

  const others = index.notes.filter((candidate) => candidate.id !== note.id);
  const available = others.filter(
    (candidate) => !note.relations.some((relation) => relation.targetId === candidate.id)
  );

  function add() {
    if (!targetId) return;
    onChange([...note.relations, { id: crypto.randomUUID(), targetId, type: '', note: '' }]);
    setTargetId('');
  }

  function update(id: string, patch: Partial<Relation>) {
    onChange(note.relations.map((relation) => (relation.id === id ? { ...relation, ...patch } : relation)));
  }

  return (
    <section className="panel">
      <h3 className="panel__title">
        {t('relations.title')} <span className="panel__count">{note.relations.length}</span>
      </h3>
      <p className="panel__hint">{t('relations.hint', { title: note.title })}</p>

      <ul className="relations">
        {note.relations.map((relation) => {
          const target = index.byId.get(relation.targetId);
          return (
            <li className="relation" key={relation.id}>
              <div className="relation__head">
                {target ? (
                  <button type="button" className="link-button" onClick={() => onOpenNote(target.id)}>
                    {target.title}
                  </button>
                ) : (
                  <span className="relation__missing">{t('relations.missing')}</span>
                )}
                {target ? <span className="badge">{findNoteType(index.types, target.type).label}</span> : null}
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('relations.remove')}
                  onClick={(e) => ausblendenUnd(e.currentTarget, () => onChange(note.relations.filter((entry) => entry.id !== relation.id)))}
                >
                  ×
                </button>
              </div>
              <input
                list="relation-types"
                className="relation__type"
                placeholder={t('relations.typePlaceholder')}
                value={relation.type}
                onChange={(event) => update(relation.id, { type: event.target.value })}
              />
              <textarea
                className="relation__note"
                rows={2}
                placeholder={t('relations.notePlaceholder')}
                value={relation.note}
                onChange={(event) => update(relation.id, { note: event.target.value })}
              />

              {/* Beziehungen sind gerichtet. Fehlt die Gegenrichtung, ist das
                  oft Absicht, manchmal aber nur vergessen. */}
              {target && !target.relations.some((entry) => entry.targetId === note.id) ? (
                <div className="relation__reverse">
                  <span>{t('relations.addReverseHint', { title: target.title })}</span>
                  <button type="button" className="link-button" onClick={() => onAddReverse(target.id)}>
                    {t('relations.addReverse')}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <datalist id="relation-types">
        {RELATION_SUGGESTIONS.map((suggestion) => (
          <option value={suggestion} key={suggestion} />
        ))}
      </datalist>

      {available.length === 0 ? (
        // Eine leere Auswahlliste ohne Erklaerung sieht aus wie ein Fehler.
        <p className="panel__empty">
          {others.length === 0 ? t('relations.needsSecondNote') : t('relations.allLinked')}
        </p>
      ) : (
        <div className="relations__add">
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            <option value="">{t('relations.choose')}</option>
            {available.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.title} ({findNoteType(index.types, candidate.type).label})
              </option>
            ))}
          </select>
          <button type="button" onClick={add} disabled={!targetId}>
            {t('relations.add')}
          </button>
        </div>
      )}
    </section>
  );
}
