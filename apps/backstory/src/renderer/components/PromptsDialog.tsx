import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PromptCategory } from '../../shared/writingPrompts';
import { useT } from '../i18n';
import { Modal } from './Modal';
import { AssistantThread, kiAbgeschaltet, type AiStatus } from './AssistantThread';

interface Props {
  categories: PromptCategory[] | null;
  /** Typ der offenen Notiz. Passende Kategorien stehen oben und sind vorgewaehlt. */
  noteType?: string;
  aiStatus: AiStatus | null;
  aiSendLinked: boolean;
  onToggleAiSendLinked: (value: boolean) => void;
  aiLinkedCount: number;
  onInsert: (text: string) => void;
  onEditFile: () => void;
  onClose: () => void;
}

const ROLL_COUNT = 4;

function pickRandom(options: string[], count: number): string[] {
  const pool = [...options];
  const picked: string[] = [];
  while (picked.length < count && pool.length) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return picked;
}

/**
 * Startpunkte fuers Schreiben, ohne KI. Oben eine kleine Auswahl per Zufall,
 * darunter die vollstaendige Liste zum Stoebern.
 */
export function PromptsDialog(props: Props) {
  const { aiStatus, onInsert, onEditFile, onClose, noteType } = props;
  const categories = useMemo(() => {
    if (!props.categories || !noteType) return props.categories;
    const passt = (k: PromptCategory) => k.types?.includes(noteType) ?? false;
    return [...props.categories.filter(passt), ...props.categories.filter((k) => !passt(k))];
  }, [props.categories, noteType]);
  const t = useT();
  const [tab, setTab] = useState<'prompts' | 'ai'>('prompts');
  // Ist die KI aus, gibt es den Reiter nicht — dann bleiben die Vorschlaege,
  // die ohnehin ohne Modell auskommen.
  const ohneKi = kiAbgeschaltet(aiStatus);
  const reiter = ohneKi ? (['prompts'] as const) : (['prompts', 'ai'] as const);
  const aktiv = ohneKi ? 'prompts' : tab;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [rolled, setRolled] = useState<string[]>([]);

  const selected = useMemo(
    () => categories?.find((category) => category.id === categoryId) ?? categories?.[0] ?? null,
    [categories, categoryId]
  );

  const roll = useCallback(() => {
    setRolled(selected ? pickRandom(selected.options, ROLL_COUNT) : []);
  }, [selected]);

  useEffect(() => {
    roll();
  }, [roll]);

  return (
    <Modal
      title={t(ohneKi ? 'prompts.titleOhneKi' : 'prompts.title')}
      wide
      onClose={onClose}
      footer={
        <>
          {aktiv === 'prompts' ? (
            <button type="button" onClick={onEditFile}>
              {t('prompts.editFile')}
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </>
      }
    >
      {/*
        Die Vorschlaege kommen ohne KI aus, der Assistent fragt ein Modell.
        Der Unterschied muss auf einen Blick zu sehen sein, deshalb stehen
        beide Male ausgeschrieben in der Beschriftung.
      */}
      {/* Bei abgeschalteter KI bleibt nur ein Reiter — dann keine Leiste. */}
      {reiter.length > 1 ? (
        <div className="prompts__tabs">
          {reiter.map((entry) => (
            <button
              key={entry}
              type="button"
              className={aktiv === entry ? 'is-active' : undefined}
              onClick={() => setTab(entry)}
            >
              {t(entry === 'prompts' ? 'prompts.tabPrompts' : 'prompts.tabAi')}
            </button>
          ))}
        </div>
      ) : null}

      {aktiv === 'ai' ? (
        <AssistantThread
          status={aiStatus}
          variant="chat"
          sendLinked={props.aiSendLinked}
          onToggleSendLinked={props.onToggleAiSendLinked}
          linkedCount={props.aiLinkedCount}
        />
      ) : null}

      {aktiv === 'prompts' ? (
        categories === null ? (
        <p className="panel__empty">{t('app.loading')}</p>
      ) : categories.length === 0 ? (
        <p className="panel__empty">{t('prompts.empty')}</p>
      ) : (
        <div className="prompts">
          <ul className="prompts__categories">
            {categories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  className={category.id === selected?.id ? 'is-active' : undefined}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="prompts__detail">
            <div className="prompts__rolled">
              {rolled.map((option) => (
                <div className="prompts__option" key={option}>
                  <span>{option}</span>
                  <button type="button" className="link-button" onClick={() => onInsert(option)}>
                    {t('prompts.insert')}
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={roll}>
              {t('prompts.roll')}
            </button>

            <h4 className="type-editor__heading">{t('prompts.all')}</h4>
            <ul className="prompts__list">
              {selected?.options.map((option) => (
                <li key={option}>
                  <button type="button" onClick={() => onInsert(option)}>
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        )
      ) : null}

      {aktiv === 'prompts' ? <p className="modal__hint">{t('prompts.hint')}</p> : null}
    </Modal>
  );
}
