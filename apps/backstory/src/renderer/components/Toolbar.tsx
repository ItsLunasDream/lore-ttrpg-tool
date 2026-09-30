import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useT, type Translate } from '../i18n';
import { IMAGE_WIDTHS } from '../editor/sizedImage';
import { leseBreite } from '../../shared/bildbreite';
import { ZOOM_NORMAL } from '../../shared/zoom';

interface Props {
  editor: Editor | null;
  onInsertImage: () => void;
  onEditLink: () => void;
  /** Vergroesserung des Notiztextes in Prozent. */
  zoom: number;
  onZoom: (prozent: number) => void;
  /** Wie viele Abschnitte gerade eingeklappt sind. */
  eingeklappt: number;
  onAllesAufklappen: () => void;
}

interface Action {
  label: string;
  title: (t: Translate) => string;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const ACTIONS: Action[] = [
  { label: 'B', title: (t) => t('toolbar.bold'), isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: (t) => t('toolbar.italic'), isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: (t) => t('toolbar.underline'), isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnterstrichen().run() },
  { label: 'S', title: (t) => t('toolbar.strike'), isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { label: 'H1', title: (t) => t('toolbar.heading', { level: 1 }), isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: (t) => t('toolbar.heading', { level: 2 }), isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: (t) => t('toolbar.heading', { level: 3 }), isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '•', title: (t) => t('toolbar.bulletList'), isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1.', title: (t) => t('toolbar.orderedList'), isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '❝', title: (t) => t('toolbar.quote'), isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: '</>', title: (t) => t('toolbar.code'), isActive: (e) => e.isActive('codeBlock'), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: '―', title: (t) => t('toolbar.rule'), run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    // Eine Trennlinie beendet den Abschnitt: was danach kommt, verschwindet
    // beim Einklappen der Ueberschrift darueber nicht (Rueckmeldung).
    label: '⤓',
    title: (t) => t('toolbar.abschnittEnde'),
    run: (e) => e.chain().focus().setHorizontalRule().run()
  },
  {
    label: '▦',
    title: (t) => t('toolbar.table'),
    isActive: (e) => e.isActive('table'),
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
  }
];

/** Nur sichtbar, wenn der Cursor in einer Tabelle steht. */
const TABLE_ACTIONS: Action[] = [
  { label: '+Z', title: (t) => t('table.addRow'), run: (e) => e.chain().focus().addRowAfter().run() },
  { label: '+S', title: (t) => t('table.addColumn'), run: (e) => e.chain().focus().addColumnAfter().run() },
  { label: '−Z', title: (t) => t('table.deleteRow'), run: (e) => e.chain().focus().deleteRow().run() },
  { label: '−S', title: (t) => t('table.deleteColumn'), run: (e) => e.chain().focus().deleteColumn().run() },
  { label: '⌫▦', title: (t) => t('table.delete'), run: (e) => e.chain().focus().deleteTable().run() }
];

/**
 * Eigene Breite fuer das ausgewaehlte Bild: "300" sind Bildpunkte, "50%" ein
 * Anteil der Textbreite.
 *
 * Das Feld zeigt, was am Bild steht, auch wenn die Breite ueber einen der
 * Knoepfe daneben gesetzt wurde. Eine Eingabe, aus der nichts wird, laesst
 * die Breite stehen und faellt beim Verlassen auf den geltenden Wert zurueck
 * — so schreibt ein Vertipper nichts Kaputtes in die Notiz.
 */
function BreitenFeld({ editor }: { editor: Editor }) {
  const t = useT();
  const gesetzt = (editor.getAttributes('image').width as string | null) ?? '';
  const [eingabe, setEingabe] = useState(gesetzt);

  // Bei einem anderen Bild oder nach einem Klick auf 200/400/100% steht dort
  // sonst noch die Zahl von vorhin.
  useEffect(() => setEingabe(gesetzt), [gesetzt]);

  function uebernimm() {
    const breite = leseBreite(eingabe);
    if (breite === null) {
      setEingabe(gesetzt);
      return;
    }
    editor.chain().focus().updateAttributes('image', { width: breite }).run();
  }

  return (
    <input
      className="toolbar__width"
      value={eingabe}
      placeholder={t('image.widthFree')}
      title={t('image.widthFreeHint')}
      onChange={(event) => setEingabe(event.target.value)}
      onBlur={uebernimm}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          uebernimm();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setEingabe(gesetzt);
        }
      }}
    />
  );
}

export function Toolbar({ editor, onInsertImage, onEditLink, zoom, onZoom, eingeklappt, onAllesAufklappen }: Props) {
  const t = useT();
  if (!editor) return <div className="toolbar" />;

  return (
    <div className="toolbar">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          title={action.title(t)}
          className={action.isActive?.(editor) ? 'is-active' : undefined}
          onMouseDown={(event) => {
            event.preventDefault();
            action.run(editor);
          }}
        >
          {action.label}
        </button>
      ))}
      {/* Nur innerhalb einer Tabelle: sonst waeren es acht tote Knoepfe. */}
      {editor.isActive('table')
        ? TABLE_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.title(t)}
              onMouseDown={(event) => {
                event.preventDefault();
                action.run(editor);
              }}
            >
              {action.label}
            </button>
          ))
        : null}

      {/* Nur wenn ein Bild ausgewaehlt ist: Markdown kennt keine Groesse,
          deshalb steht sie als Attribut am Bild. */}
      {editor.isActive('image') ? (
        <>
          {IMAGE_WIDTHS.map((entry) => (
            <button
              key={entry.label}
              type="button"
              title={t('image.width', { size: entry.label })}
              className={(editor.getAttributes('image').width ?? null) === entry.width ? 'is-active' : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                editor.chain().focus().updateAttributes('image', { width: entry.width }).run();
              }}
            >
              {entry.label}
            </button>
          ))}
          <BreitenFeld editor={editor} />
        </>
      ) : null}

      <button
        type="button"
        title={t('toolbar.link')}
        className={editor.isActive('link') ? 'is-active' : undefined}
        onMouseDown={(event) => {
          event.preventDefault();
          onEditLink();
        }}
      >
        🔗
      </button>

      <button
        type="button"
        title={t('image.insert')}
        onMouseDown={(event) => {
          event.preventDefault();
          onInsertImage();
        }}
      >
        ▣
      </button>

      <span className="toolbar__spacer" />
      {eingeklappt > 0 ? (
        <button
          type="button"
          title={t('editor.expandAll')}
          onMouseDown={(event) => {
            event.preventDefault();
            onAllesAufklappen();
          }}
        >
          ⇕
        </button>
      ) : null}
      {/* Der Faktor steht oben rechts und setzt sich per Klick zurueck — so
          braucht man das Tastenkuerzel nicht zu kennen. */}
      <button
        type="button"
        className="toolbar__zoom"
        title={t('editor.zoomReset')}
        disabled={zoom === ZOOM_NORMAL}
        onMouseDown={(event) => {
          event.preventDefault();
          onZoom(ZOOM_NORMAL);
        }}
      >
        {t('editor.zoom', { percent: zoom })}
      </button>
      {/* Ausgegraut, wenn es nichts zurueckzuholen gibt. Ein Pfeil, der
          gleich aussieht und nichts tut, sagt nichts ueber den Zustand. */}
      <button
        type="button"
        title={t('toolbar.undo')}
        disabled={!editor.can().chain().focus().undo().run()}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().undo().run();
        }}
      >
        ↶
      </button>
      <button
        type="button"
        title={t('toolbar.redo')}
        disabled={!editor.can().chain().focus().redo().run()}
        onMouseDown={(e) => {
          e.preventDefault();
          editor.chain().focus().redo().run();
        }}
      >
        ↷
      </button>
    </div>
  );
}
