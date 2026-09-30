import { useEffect, useMemo, useRef, useState } from 'react';
import { beispieltext, CHECKED, findNoteType } from '../../shared/noteTypes';
import type { Note, Relation } from '../../shared/types';
import { backlinksFor, unresolvedLinks, type NoteIndex } from '../noteIndex';
import { hasLinkReservedChars, normalizeName } from '../../shared/wikilinks';
import { countWords } from '../editor/markdown';
import { erkenneSprachen } from '../../shared/spracherkennung';
import { api } from '../api';
import { BodyEditor } from './BodyEditor';
import { RelationsPanel } from './RelationsPanel';
import { BacklinksPanel } from './BacklinksPanel';
import { TokenInput } from './TokenInput';
import { ImageField } from './ImageField';
import { Menu } from './Menu';
import { AssistantPanel, type AiStatus } from './AssistantPanel';
import { useLanguage, useT } from '../i18n';

interface Props {
  note: Note;
  index: NoteIndex;
  dirty: boolean;
  saving: boolean;
  autosaveEnabled: boolean;
  onPatch: (patch: Partial<Note>) => void;
  onSave: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  onOpenPrompts: () => void;
  onReport: (text: string) => void;
  onAddReverseRelation: (targetId: string) => void;
  aiStatus: AiStatus | null;
  aiSendLinked: boolean;
  onToggleAiSendLinked: (value: boolean) => void;
  aiLinkedCount: number;
  editorZoom: number;
  onEditorZoom: (prozent: number) => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onExportCampaignZip: () => void;
  onExportCampaignMarkdown: () => void;
  onExportCampaignPdf: () => void;
  onOpenNote: (noteId: string) => void;
  onCreateNote: (title: string) => void;
  onHoverNote: (note: Note | null, rect: DOMRect | null) => void;
  onOpenExternal: (url: string) => void;
  onEditNoteTypes: () => void;
  /** Suchbegriff aus der Seitenleiste, fuer die Hervorhebung im Text. */
  searchQuery: string;
  campaignId: string;
  /** Hochgezaehlt, wenn der Text von aussen ersetzt wurde. */
  reloadKey: number;
  onImportImage: (file: File) => Promise<string | null>;
  onPickImage: () => Promise<string | null>;
}

export function NoteEditor(props: Props) {
  const t = useT();
  const { language } = useLanguage();
  const { note, index, dirty, saving, autosaveEnabled, onPatch, onSave, onRename, onDelete } = props;
  const def = findNoteType(index.types, note.type);

  const backlinks = useMemo(() => backlinksFor(index, note.id), [index, note.id]);
  const unresolved = useMemo(() => unresolvedLinks(index, note), [index, note]);
  const words = useMemo(() => countWords(note.body), [note.body]);
  /*
   * Welche Sprache(n) der Text hat, wie bei Word (Rueckmeldung). Gebuendelt,
   * damit nicht jeder Tastendruck die Woerterbuecher umstellt. Die Pruefung
   * folgt nur bei der Einstellung „automatisch“; der Hinweis steht immer da.
   */
  const [erkannt, setErkannt] = useState<string[]>([]);
  useEffect(() => {
    const takt = window.setTimeout(() => {
      const { sprachen } = erkenneSprachen(`${note.title}\n${note.body}`);
      setErkannt((alt) => (alt.join() === sprachen.join() ? alt : sprachen));
    }, 700);
    return () => window.clearTimeout(takt);
  }, [note.title, note.body]);
  useEffect(() => {
    void api.woerterbuch.erkannt(erkannt).catch(() => undefined);
  }, [erkannt]);

  // Teilt sich diese Notiz einen Namen mit einer anderen, treffen Links darauf
  // stillschweigend immer dieselbe. Darauf muss hingewiesen werden.
  const ambiguousName = useMemo(
    () => [note.title, ...note.aliases].find((name) => index.ambiguous.has(normalizeName(name))),
    [note.title, note.aliases, index.ambiguous]
  );

  // Der Vault lehnt solche Namen ab. Ohne Hinweis bliebe nur eine
  // Fehlermeldung beim Speichern, ohne dass klar waere, woran es liegt.
  const reservedName = useMemo(
    () => [note.title, ...note.aliases].find((name) => hasLinkReservedChars(name)),
    [note.title, note.aliases]
  );

  const status = t(saving ? 'editor.saving' : dirty ? 'editor.unsaved' : 'editor.saved');

  /*
   * Nach dem Speichern leuchtet der Status kurz gruen auf.
   *
   * Ausgeloest wird das vom Uebergang „speichert gerade\" zu „gespeichert\",
   * nicht vom Zustand „gespeichert\": sonst leuchtete es bei jedem
   * Neuzeichnen erneut, auch wenn seit Minuten nichts passiert ist. Beim
   * Autosave ist das die einzige Rueckmeldung, die es ueberhaupt gibt.
   */
  const [gespeichert, setGespeichert] = useState(false);
  const speicherteVorher = useRef(saving);
  useEffect(() => {
    if (speicherteVorher.current && !saving && !dirty) setGespeichert(true);
    speicherteVorher.current = saving;
  }, [saving, dirty]);

  return (
    <div className="note-editor">
      <header className="note-editor__head">
        <input
          className={`note-editor__title${note.title.trim() ? '' : ' note-editor__title--leer'}`}
          value={note.title}
          placeholder={t('editor.titleNeeded')}
          title={note.title.trim() ? undefined : t('error.noteTitle')}
          aria-invalid={!note.title.trim()}
          onChange={(event) => onPatch({ title: event.target.value })}
          onBlur={(event) => onRename(event.target.value)}
          aria-label={t('editor.title')}
        />
        <span className="badge">{def.label}</span>
        <span
          className={`status status--${dirty ? 'dirty' : 'clean'}${
            gespeichert ? ' status--gespeichert' : ''
          }`}
          // Die Klasse wieder abnehmen, sobald das Aufleuchten durch ist —
          // eine Klasse, die stehen bleibt, startet beim naechsten Mal nicht
          // neu.
          onAnimationEnd={() => setGespeichert(false)}
        >
          {status}
        </span>
        <span className="note-editor__words">{t('editor.words', { count: words })}</span>
        {erkannt.length ? (
          <span className="note-editor__sprache" data-erkannte-sprache={erkannt.join('+')} title={t('editor.spracheHinweis')}>
            {t('editor.sprache', { sprachen: erkannt.map((s) => t(s === 'de' ? 'editor.sprache.de' : 'editor.sprache.en')).join(' + ') })}
          </span>
        ) : null}
        <button type="button" onClick={onSave} disabled={!dirty || saving}>
          {t('editor.save')}
        </button>
        <button type="button" onClick={props.onOpenPrompts}>
          {t('prompts.open')}
        </button>
        <button type="button" onClick={props.onOpenHistory}>
          {t('history.open')}
        </button>
        {/* Alles, was ausgegeben wird, unter einem Knopf: die offene Notiz
            und die ganze Kampagne. Im Menue "Kampagne" stehen die unteren
            drei weiterhin — wer sie dort gelernt hat, soll sie nicht suchen
            muessen. */}
        <Menu
          label={t('export.note')}
          entries={[
            { label: t('export.markdownNote'), onSelect: props.onExportMarkdown },
            { label: t('export.pdfNote'), onSelect: props.onExportPdf },
            { label: t('export.markdownCampaign'), onSelect: props.onExportCampaignMarkdown, separated: true },
            { label: t('export.pdfCampaign'), onSelect: props.onExportCampaignPdf },
            { label: t('bar.exportZip'), onSelect: props.onExportCampaignZip }
          ]}
        />
        <button type="button" className="danger" onClick={onDelete}>
          {t('editor.delete')}
        </button>
      </header>

      {!autosaveEnabled && dirty ? (
        <p className="note-editor__warning">{t('editor.autosaveOffHint')}</p>
      ) : null}

      {reservedName ? (
        <p className="note-editor__warning note-editor__warning--danger">
          {t('error.linkChars', { name: reservedName })}
        </p>
      ) : null}

      {ambiguousName ? (
        <p className="note-editor__warning note-editor__warning--danger">
          {t('editor.ambiguous', { name: ambiguousName })}
        </p>
      ) : null}

      {/*
        Der `key` ist nicht schmueckendes Beiwerk: ohne ihn behaelt React beim
        Notizwechsel dasselbe Element, und eine CSS-Animation laeuft nur, wenn
        das Element neu entsteht. Das Einblenden bliebe also aus — genau bei
        dem Vorgang, fuer den es gedacht ist.
      */}
      <div className="note-editor__columns" key={note.id}>
        <div className="note-editor__main">
          <BodyEditor
            zoom={props.editorZoom}
            onZoom={props.onEditorZoom}
            noteId={note.id}
            markdown={note.body}
            index={index}
            searchQuery={props.searchQuery}
            campaignId={props.campaignId}
            reloadKey={props.reloadKey}
            onImportImage={props.onImportImage}
            onPickImage={props.onPickImage}
            onReport={props.onReport}
            onOpenExternal={props.onOpenExternal}
            onChange={(body) => onPatch({ body })}
            onOpenNote={props.onOpenNote}
            onCreateNote={props.onCreateNote}
            onHoverNote={props.onHoverNote}
          />
        </div>

        <aside className="note-editor__side">
          <section className="panel">
            <h3 className="panel__title">
              {t('editor.profile')}
              {/*
                Der Dialog liegt auch im Kampagnen-Menue. Dort findet ihn
                niemand, der gerade den Steckbrief vor sich hat und ein Feld
                umbenennen will.
              */}
              <button type="button" className="link-button panel__action" onClick={props.onEditNoteTypes}>
                {t('editor.editProfile')}
              </button>
            </h3>
            {def.fields.map((field) => {
              const value = note.fields[field.key] ?? '';
              /*
               * Der Beispieltext folgt der eingestellten Sprache, die
               * Beschriftung nicht: die gehoert der Kampagne. „z.B. sie/ihr"
               * neben einem Feld namens „Pronouns" war schlicht falsch.
               */
              const beispiel = beispieltext(note.type, field.key, field.placeholder, language);
              const setValue = (next: string) => onPatch({ fields: { ...note.fields, [field.key]: next } });

              return (
                <label className="field" key={field.key}>
                  <span className="field__label">{field.label}</span>
                  {field.type === 'image' ? (
                    <ImageField
                      campaignId={props.campaignId}
                      value={value}
                      onChange={setValue}
                      onPickImage={props.onPickImage}
                      onImportImage={props.onImportImage}
                    />
                  ) : field.type === 'select' ? (
                    <select value={value} onChange={(e) => setValue(e.target.value)}>
                      <option value="">{t('field.notSet')}</option>
                      {(field.options ?? []).map((option) => (
                        <option value={option} key={option}>
                          {option}
                        </option>
                      ))}
                      {/*
                        Ein eingetragener Wert, der nicht mehr zur Auswahl steht,
                        weil jemand die Liste geaendert hat. Ohne diesen Eintrag
                        stuende das Feld leer da, obwohl der Wert in der Datei
                        weiter vorhanden ist.
                      */}
                      {value && !(field.options ?? []).includes(value) ? (
                        <option value={value}>{t('field.notInList', { value })}</option>
                      ) : null}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      className="field__checkbox"
                      checked={Boolean(value)}
                      onChange={(e) => setValue(e.target.checked ? CHECKED : '')}
                    />
                  ) : field.type === 'date' ? (
                    <input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
                  ) : field.type === 'textarea' ? (
                    <textarea rows={3} value={value} placeholder={beispiel} onChange={(e) => setValue(e.target.value)} />
                  ) : (
                    <span className="field__row">
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={value}
                        placeholder={beispiel}
                        onChange={(e) => setValue(e.target.value)}
                      />
                      {field.type === 'url' && value.trim() ? (
                        <button type="button" className="link-button" onClick={() => props.onOpenExternal(value.trim())}>
                          {t('editor.open')}
                        </button>
                      ) : null}
                    </span>
                  )}
                </label>
              );
            })}

            <TokenInput
              label={t('editor.aliases')}
              values={note.aliases}
              placeholder={t('editor.aliasesHint')}
              onChange={(aliases) => onPatch({ aliases })}
            />
            <TokenInput
              label={t('editor.tags')}
              values={note.tags}
              placeholder={t('editor.tagsHint')}
              onChange={(tags) => onPatch({ tags })}
            />
          </section>

          <RelationsPanel
            note={note}
            index={index}
            onChange={(relations: Relation[]) => onPatch({ relations })}
            onOpenNote={props.onOpenNote}
            onAddReverse={props.onAddReverseRelation}
          />

          {/* Zurueckgesetzt wird das Gespraech im AssistantProvider. */}
          <AssistantPanel
            status={props.aiStatus}
            sendLinked={props.aiSendLinked}
            onToggleSendLinked={props.onToggleAiSendLinked}
            linkedCount={props.aiLinkedCount}
          />

          <BacklinksPanel
            backlinks={backlinks}
            types={index.types}
            unresolved={unresolved}
            onOpenNote={props.onOpenNote}
            onCreateNote={props.onCreateNote}
          />
        </aside>
      </div>
    </div>
  );
}
