/**
 * Editor für eine einzelne Notiz.
 *
 * Der Text steht im Dokument, nicht im Dialog: getippt wird direkt über einen
 * Befehl, verschmolzen über den `mergeKey`, damit die ganze Eingabe *ein*
 * Undo-Schritt ist und nicht einer je Buchstabe.
 */

import { useEffect, useRef } from 'react';
import { PatchVttItems, RemoveVttItems } from '@/model/commands';
import { useEditor } from '@/model/store';
import { NOTE_ICONS, type NoteIcon } from '@/model/types';
import { stelleVon } from '@/model/mappe';
import { useT } from '@/i18n/useT';
import { ColorField, Row, Select, Slider, Toggle, useEscapeClose } from './controls';
import { noteIconKey } from './VttPanel';

export function NoteDialog() {
  const { t } = useT();
  const id = useEditor((s) => s.editingNoteId);
  const close = useEditor((s) => s.setEditingNoteId);
  const doc = useEditor((s) => s.doc);
  const rev = useEditor((s) => s.rev);
  const exec = useEditor((s) => s.exec);
  const patchDefaults = useEditor((s) => s.patchNote);
  const karten = useEditor((s) => s.karten);
  const wechsle = useEditor((s) => s.wechsleKarte);
  const titleRef = useRef<HTMLInputElement>(null);
  void rev;
  // Nur horchen, solange wirklich eine Notiz offen ist: der Dialog hängt immer
  // im Baum und zeigt sonst nichts — er würde Esc verbrauchen, ohne dass etwas
  // zu schließen wäre.
  useEscapeClose(() => close(null), !!id);

  const note = id ? doc.vtt.notes.find((n) => n.id === id) : undefined;

  useEffect(() => {
    if (note) titleRef.current?.focus();
    // Nur beim Öffnen einer anderen Notiz, nicht bei jedem Tastendruck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id || !note) return null;
  const ziel = stelleVon(karten, note.zielKarte);

  /**
   * `mergeKey` je Notiz und Feld: Tippen im Titel verschmilzt mit Tippen im
   * Titel, aber nicht mit dem Umschalten der Sichtbarkeit.
   */
  const patch = (p: Record<string, unknown>, feld: string, merge = true) => {
    exec(
      new PatchVttItems(
        'notes',
        new Map([[note.id, p]]),
        t('cmd.editNote'),
        merge ? `note:${note.id}:${feld}` : undefined,
      ),
    );
  };

  const remove = () => {
    close(null);
    exec(new RemoveVttItems({ notes: [note.id] }, t('cmd.removeNote')));
  };

  return (
    <div className="modal-backdrop" onClick={() => close(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{t('note.title')}</h3>
          <button className="ghost icon" onClick={() => close(null)} title={t('export.close')}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          <Row label={t('note.heading')}>
            <input
              ref={titleRef}
              type="text"
              value={note.title}
              placeholder={t('note.headingPlaceholder')}
              onChange={(e) => patch({ title: e.target.value }, 'title')}
            />
          </Row>

          <label className="note-body-label">
            {t('note.body')}
            <textarea
              className="note-body"
              rows={10}
              value={note.text}
              placeholder={t('note.bodyPlaceholder')}
              onChange={(e) => patch({ text: e.target.value }, 'text')}
            />
          </label>

          <Select<NoteIcon>
            label={t('note.icon')}
            value={note.icon}
            options={NOTE_ICONS.map((icon) => ({ value: icon, label: t(noteIconKey(icon)) }))}
            onChange={(v) => {
              patch({ icon: v }, 'icon', false);
              // Was gerade gewählt wurde, ist meist auch für die nächste Notiz
              // das Richtige.
              patchDefaults({ icon: v });
            }}
          />
          <Slider
            label={t('note.size')}
            min={0.4}
            max={4}
            step={0.1}
            value={note.size}
            onChange={(v) => patch({ size: v }, 'size')}
          />
          <ColorField
            label={t('note.color')}
            value={note.color}
            onChange={(v) => patch({ color: v }, 'color', false)}
          />
          <Toggle
            label={t('note.playerVisible')}
            checked={note.playerVisible}
            onChange={(v) => patch({ playerVisible: v }, 'visible', false)}
          />
          {/* Verweis auf eine andere Karte der Datei: die Treppe nach unten. */}
          {karten.length > 1 ? (
            <>
              <Select<string>
                label={t('note.zielKarte')}
                value={note.zielKarte ?? ''}
                options={[
                  { value: '', label: t('note.keinZiel') },
                  ...karten
                    .filter((k) => k !== doc && k.meta.id)
                    .map((k) => ({ value: k.meta.id!, label: k.meta.name })),
                ]}
                onChange={(v) => patch({ zielKarte: v || undefined }, 'ziel', false)}
              />
              {ziel >= 0 ? (
                <button
                  type="button"
                  data-note-ziel
                  onClick={() => {
                    close(null);
                    wechsle(ziel);
                  }}
                >
                  {t('note.zumZiel', { name: karten[ziel].meta.name })}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <footer>
          <button className="danger" onClick={remove}>
            {t('note.deleteThis')}
          </button>
          <button className="primary" onClick={() => close(null)}>
            {t('note.done')}
          </button>
        </footer>
      </div>
    </div>
  );
}
