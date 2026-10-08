import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { meldeEinfuegeziel } from '../editor/einfuegen';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ContextMenu } from './ContextMenu';
import { SizedImage } from '../editor/sizedImage';
import { Unterstrichen } from '../editor/unterstrichen';
import { Kommentar } from '../editor/kommentar';
import { createEinklappExtension, einklappenPluginKey, klappeAllesAuf } from '../editor/einklappen';
import { createWikiLinkExtension, type SuggestionState } from '../editor/wikiLinkExtension';
import { createSearchHighlightExtension, replaceMatches, selectMatch } from '../editor/searchHighlight';
import { htmlToMarkdown, markdownToHtml, pastedMarkdownToHtml } from '../editor/markdown';
import { assetPath, assetUrl, isImageFile } from '../editor/assets';
import { api, call } from '../api';
import { normalizeName } from '../../shared/wikilinks';
import { begrenzeZoom, naechsteZoomstufe, ZOOM_NORMAL } from '../../shared/zoom';
import type { NoteIndex } from '../noteIndex';
import type { Note } from '../../shared/types';
import { findNoteType } from '../../shared/noteTypes';
import { Toolbar } from './Toolbar';
import { Modal } from './Modal';
import { useT } from '../i18n';

/** Was der Editor verlinken und was der Hauptprozess oeffnen darf. */
const LINK_PROTOCOLS = ['http', 'https', 'mailto'];

interface Props {
  noteId: string;
  markdown: string;
  index: NoteIndex;
  /** Aktueller Suchbegriff aus der Seitenleiste, leer wenn nicht gesucht wird. */
  searchQuery: string;
  campaignId: string;
  /**
   * Wird hochgezaehlt, wenn der Text von aussen ersetzt wurde, etwa beim
   * Wiederherstellen einer alten Fassung. Der Editor laedt dann neu, obwohl
   * dieselbe Notiz offen bleibt.
   */
  reloadKey: number;
  /** Legt ein Bild in der Kampagne ab und liefert den relativen Verweis. */
  onImportImage: (file: File) => Promise<string | null>;
  /** Oeffnet den Dateidialog und liefert den relativen Verweis. */
  onPickImage: () => Promise<string | null>;
  /** Meldung an die Anwendung, etwa nach dem Ersetzen. */
  onReport: (text: string) => void;
  onOpenExternal: (url: string) => void;
  onChange: (markdown: string) => void;
  onOpenNote: (noteId: string) => void;
  onCreateNote: (title: string) => void;
  onHoverNote: (note: Note | null, rect: DOMRect | null) => void;
  /** Vergroesserung des Notiztextes in Prozent. */
  zoom: number;
  onZoom: (prozent: number) => void;
}

const MAX_SUGGESTIONS = 8;


/**
 * Was eine Vorschlagsliste ausmacht: die Stelle und die getippte Anfrage.
 *
 * Die Ansicht meldet ihren Zustand bei JEDER Neuzeichnung, nicht nur beim
 * Tippen — und eine Neuzeichnung loest schon das Setzen der Auswahl aus.
 * Ohne diesen Schluessel sprang die Auswahl deshalb sofort wieder auf den
 * ersten Eintrag, und Escape schloss die Liste nur fuer einen Wimpernschlag.
 */
function vorschlagsSchluessel(state: SuggestionState | null): string | null {
  return state ? `${state.from}:${state.query}` : null;
}

function gleicherVorschlag(a: SuggestionState | null, b: SuggestionState | null): boolean {
  if (a === null || b === null) return a === b;
  return a.from === b.from && a.to === b.to && a.query === b.query && a.left === b.left && a.top === b.top;
}

export function BodyEditor({
  noteId,
  markdown,
  index,
  searchQuery,
  campaignId,
  reloadKey,
  onChange,
  onOpenNote,
  onCreateNote,
  onHoverNote,
  onImportImage,
  onPickImage,
  onReport,
  onOpenExternal,
  zoom,
  onZoom
}: Props) {
  const t = useT();
  const flaeche = useRef<HTMLDivElement>(null);
  /** Rechtsklick auf ein angestrichenes Wort: Stelle, Wort, Vorschlaege. */
  const [schreibmenue, setSchreibmenue] = useState<{
    x: number;
    y: number;
    wort: string;
    vorschlaege: string[];
  } | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [highlight, setHighlight] = useState(0);
  /** Der zuletzt gemeldete Vorschlag. Nur ein echter Wechsel setzt die Auswahl zurueck. */
  const letzterVorschlag = useRef<string | null>(null);
  /** Mit Escape weggeklickt. Kommt erst wieder, wenn sich die Anfrage aendert. */
  const abgelehnt = useRef<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(-1);
  // Eigene Suche im Dokument, unabhaengig von der Suche in der Seitenleiste.
  const [localSearch, setLocalSearch] = useState<{ query: string; replace: string } | null>(null);
  /** Adresse im Link-Dialog, null wenn er zu ist. */
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  // Ist die eigene Suche offen, gilt ihr Begriff, sonst der aus der Seitenleiste.
  const effectiveQuery = localSearch ? localSearch.query : searchQuery;
  const searchOpen = Boolean(localSearch) || Boolean(searchQuery.trim());

  // Handler laufen in ProseMirror-Plugins, die nur einmal erzeugt werden.
  // Ueber diese Ref sehen sie trotzdem immer den aktuellen Index.
  const indexRef = useRef(index);
  indexRef.current = index;

  const handlersRef = useRef({ onOpenNote, onHoverNote });
  handlersRef.current = { onOpenNote, onHoverNote };

  const queryRef = useRef(effectiveQuery);
  queryRef.current = effectiveQuery;
  const activeMatchRef = useRef(activeMatch);
  activeMatchRef.current = activeMatch;

  // Die ProseMirror-Handler entstehen einmal und brauchen deshalb Referenzen
  // auf die jeweils aktuellen Werte.
  const editorRef = useRef<Editor | null>(null);
  /**
   * Die Uebersetzung fuer die Erweiterung, die nur einmal gebaut wird. Ohne
   * Referenz truege der Pfeil die Beschriftung der Sprache von damals.
   */
  const tRef = useRef(t);
  tRef.current = t;
  const importRef = useRef({ campaignId, onImportImage });
  importRef.current = { campaignId, onImportImage };

  /**
   * Nimmt Bilder aus Zwischenablage oder Ziehen und Ablegen entgegen. Der
   * Import laeuft asynchron, deshalb wird das Ereignis sofort geschluckt und
   * das Bild nachtraeglich eingefuegt.
   */
  function importFromDataTransfer(transfer: DataTransfer | null): boolean {
    const files = [...(transfer?.files ?? [])].filter(isImageFile);
    if (files.length === 0) return false;

    void (async () => {
      for (const file of files) {
        const relativePath = await importRef.current.onImportImage(file);
        if (!relativePath) continue;
        editorRef.current
          ?.chain()
          .focus()
          .setImage({ src: assetUrl(importRef.current.campaignId, relativePath) })
          .run();
      }
    })();

    return true;
  }

  /**
   * Eingefuegter Klartext wird als Markdown gelesen: aus **fett** wird fetter
   * Text, aus einer Tabelle eine Tabelle. Die Dateien der Anwendung sind
   * Markdown, wer eine bestehende Backstory einfuegt, erwartet das.
   *
   * Nicht angefasst wird, was schon HTML mitbringt: aus dem Editor selbst
   * oder aus einem Browser kopierter Text traegt seine Formatierung bereits,
   * den soll ProseMirror wie gewohnt uebernehmen.
   */
  function pasteAsMarkdown(transfer: DataTransfer | null): boolean {
    const editor = editorRef.current;
    if (!editor || !transfer || transfer.types.includes('text/html')) return false;

    // In einem Codeblock gehoert Eingefuegtes woertlich hinein, sonst
    // verschwaenden aus "**p;" die Sterne.
    if (editor.isActive('codeBlock') || editor.isActive('code')) return false;

    const text = transfer.getData('text/plain');
    if (!text.trim()) return false;

    // Eine einzelne Adresse ueber markiertem Text soll ihn verlinken, das
    // erledigt die Link-Erweiterung. Ihr nicht dazwischenfunken.
    if (!editor.state.selection.empty && /^\S+$/.test(text.trim()) && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(text.trim())) {
      return false;
    }

    // Rohes HTML im eingefuegten Text bleibt Text: der Editor wuerde ein
    // unbekanntes Element samt Inhalt verwerfen.
    const html = pastedMarkdownToHtml(text, (target) =>
      assetUrl(importRef.current.campaignId, target)
    );

    // Text ohne eigene Absaetze bleibt im laufenden Absatz, sonst risse ein
    // eingefuegtes Wort den Satz auseinander. Nur ein einzelner Absatz zaehlt,
    // deshalb darf zwischen den Klammern kein weiterer stecken.
    const single = /^<p>((?:(?!<\/p>)[\s\S])*)<\/p>\s*$/.exec(html.trim());
    editor.chain().focus().insertContent(single ? single[1] : html).run();
    return true;
  }

  const searchHighlight = useMemo(
    () =>
      createSearchHighlightExtension({
        getQuery: () => queryRef.current,
        getActiveIndex: () => activeMatchRef.current,
        onMatchesChanged: setMatchCount
      }),
    []
  );

  const einklappen = useMemo(
    () => createEinklappExtension({ titel: (zu) => (zu ? tRef.current('editor.expand') : tRef.current('editor.collapse')) }),
    []
  );

  const wikiLink = useMemo(
    () =>
      createWikiLinkExtension({
        resolves: (target) => indexRef.current.byName.has(normalizeName(target)),
        onOpen: (target) => {
          const note = indexRef.current.byName.get(normalizeName(target));
          if (note) handlersRef.current.onOpenNote(note.id);
        },
        onHover: (target, rect) => {
          const note = target ? indexRef.current.byName.get(normalizeName(target)) ?? null : null;
          handlersRef.current.onHoverNote(note, rect);
        },
        onSuggestion: (state) => {
          const schluessel = vorschlagsSchluessel(state);
          if (schluessel !== null && schluessel === abgelehnt.current) {
            setSuggestion(null);
            return;
          }

          abgelehnt.current = null;
          if (schluessel !== letzterVorschlag.current) {
            letzterVorschlag.current = schluessel;
            setHighlight(0);
          }
          setSuggestion((vorher) => (gleicherVorschlag(vorher, state) ? vorher : state));
        }
      }),
    []
  );

  const editor = useEditor({
    // Tiptap 3 rendert sonst nicht mehr bei jeder Eingabe neu, und die
    // Werkzeugleiste zeigte Fett, Überschrift usw. nicht mehr als aktiv an.
    shouldRerenderOnTransaction: true,
    extensions: [
      // Die Werkzeugleiste bietet nur H1 bis H3 an, das reicht fuer eine
      // Backstory. Tiefere Ueberschriften muss der Editor trotzdem kennen,
      // sonst wuerde ein #### aus einer bestehenden Datei beim Speichern zu
      // gewoehnlichem Text.
      // Seit Tiptap 3 bringt das StarterKit Link und Unterstrichen selbst mit.
      // Beide gibt es hier schon (Link mit eigenen Attributen, `Unterstrichen`),
      // doppelt angemeldet stritten sie um denselben Namen. trailingNode
      // bleibt an: ohne den leeren Absatz am Ende ließ sich hinter einer
      // Tabelle am Notizende nichts mehr schreiben (Rundlauf in der CI).
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: false, underline: false }),
      Placeholder.configure({ placeholder: t('editor.placeholder') }),
      // Ohne diese Erweiterung kennt der Editor keine Links: [Text](URL) aus
      // der Datei verlor beim Speichern seine Adresse. Geoeffnet wird wie bei
      // Wiki-Links mit Strg+Klick, damit der Cursor sonst normal gesetzt
      // werden kann, und im Systembrowser statt im App-Fenster.
      // Titel und die Schreibweise in spitzen Klammern reisen mit, sonst
      // fehlten sie nach dem Speichern in der Datei (Testbericht).
      Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            title: { default: null },
            spitz: {
              default: null,
              parseHTML: (element) => element.getAttribute('data-spitz'),
              renderHTML: (attribute) => (attribute.spitz ? { 'data-spitz': attribute.spitz } : {})
            }
          };
        }
      }).configure({ openOnClick: false, autolink: false, protocols: LINK_PROTOCOLS }),
      Kommentar,
      // Ohne Tabellen zog der Editor alle Zellen zu einer Textwurst zusammen.
      // resizable false: Spaltenbreiten liessen sich in Markdown ohnehin nicht
      // ablegen, sie waeren beim naechsten Laden wieder weg.
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      // Ohne diese beiden kennt der Editor `- [x] erledigt` nicht: das
      // Ankreuzfeld faellt beim Laden weg und die Aufgabenliste waere beim
      // naechsten Speichern eine gewoehnliche Liste.
      TaskList,
      TaskItem.configure({ nested: true }),
      Unterstrichen,
      einklappen,
      wikiLink,
      searchHighlight,
      SizedImage.configure({ inline: false, allowBase64: false })
    ],
    content: markdownToHtml(markdown, (target) => assetUrl(campaignId, target)),
    onUpdate: ({ editor: instance }) => onChange(htmlToMarkdown(instance.getHTML(), assetPath)),

    editorProps: {
      // Bilder aus der Zwischenablage oder per Ziehen und Ablegen werden in
      // die Kampagne kopiert, nicht als Base64 in den Text geschrieben.
      handlePaste: (_view, event) =>
        importFromDataTransfer(event.clipboardData) || pasteAsMarkdown(event.clipboardData),
      handleDrop: (_view, event) => importFromDataTransfer((event as DragEvent).dataTransfer),

      handleDOMEvents: {
        mousedown: (_view, event) => {
          const href = (event.target as HTMLElement | null)?.closest('a')?.getAttribute('href');
          if (!href || !(event.ctrlKey || event.metaKey)) return false;

          // Alles andere waere ein Verweis, den der Editor gar nicht erst
          // anlegt, und der Hauptprozess wiese ihn ohnehin ab.
          // Kleingeschrieben vergleichen, HTTPS: ist derselbe Verweis. Ohne
          // Doppelpunkt gibt es kein Schema und nichts zu oeffnen.
          const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(href)?.[1].toLowerCase();
          if (!scheme || !LINK_PROTOCOLS.includes(scheme)) return false;

          event.preventDefault();
          onOpenExternal(href);
          return true;
        }
      }
    }
  });

  editorRef.current = editor;

  // Inhalt nur bei Notizwechsel oder ersetztem Text neu setzen, sonst
  // springt bei jedem Tastendruck der Cursor an den Anfang.
  const loaded = useRef(`${noteId}:${reloadKey}`);
  useEffect(() => {
    const marker = `${noteId}:${reloadKey}`;
    if (!editor || loaded.current === marker) return;
    loaded.current = marker;
    editor.commands.setContent(markdownToHtml(markdown, (target) => assetUrl(campaignId, target)), { emitUpdate: false });
  }, [editor, noteId, reloadKey, markdown, campaignId]);

  const insertImage = useCallback(
    (relativePath: string) => {
      editorRef.current?.chain().focus().setImage({ src: assetUrl(campaignId, relativePath) }).run();
    },
    [campaignId]
  );

  // Suchbegriff oder Notiz gewechselt: Dekorationen neu berechnen lassen und
  // die Auswahl der aktiven Fundstelle zuruecksetzen.
  useEffect(() => {
    setActiveMatch(-1);
    if (editor) editor.view.dispatch(editor.state.tr);
  }, [editor, effectiveQuery, noteId]);

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (!editor || matchCount === 0) return;
      const next = activeMatch === -1
        ? (direction === 1 ? 0 : matchCount - 1)
        : (activeMatch + direction + matchCount) % matchCount;
      setActiveMatch(next);
      selectMatch(editor.view, next, effectiveQuery);
    },
    [editor, matchCount, activeMatch, effectiveQuery]
  );

  // F3 und Umschalt+F3 springen zwischen den Fundstellen, wie in einem
  // Code-Editor. Ohne Suchbegriff passiert nichts.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setLocalSearch((previous) => previous ?? { query: '', replace: '' });
        // Der Fokus muss nach dem Rendern gesetzt werden.
        window.setTimeout(() => document.querySelector<HTMLInputElement>('.search-bar__query')?.select(), 0);
        return;
      }

      if (event.key === 'Escape' && localSearch) {
        event.preventDefault();
        setLocalSearch(null);
        editorRef.current?.commands.focus();
        return;
      }

      if (event.key === 'F3' && effectiveQuery.trim() && matchCount > 0) {
        event.preventDefault();
        goToMatch(event.shiftKey ? -1 : 1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [effectiveQuery, matchCount, goToMatch, localSearch]);

  /**
   * Setzt oder entfernt den Link auf der aktuellen Auswahl. Ohne Auswahl wird
   * die Adresse als Text eingefuegt und verlinkt, sonst passierte nichts
   * Sichtbares.
   */
  const applyLink = useCallback(
    (raw: string) => {
      const url = raw.trim();
      setLinkDraft(null);
      if (!editorRef.current) return;
      const chain = editorRef.current.chain().focus().extendMarkRange('link');

      if (!url) {
        chain.unsetLink().run();
        return;
      }

      if (editorRef.current.state.selection.empty && !editorRef.current.isActive('link')) {
        chain.insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
        return;
      }

      chain.setLink({ href: url }).run();
    },
    []
  );

  const replace = useCallback(
    (scope: number | 'all') => {
      if (!editor || !localSearch?.query.trim()) return;
      const count = replaceMatches(editor.view, localSearch.query, localSearch.replace, scope);
      if (count > 0) {
        setActiveMatch(-1);
        onReport(count === 1 ? t('search.replacedOne') : t('search.replaced', { count }));
      }
    },
    [editor, localSearch, onReport, t]
  );

  const candidates = useMemo(() => {
    if (!suggestion) return [];
    const needle = normalizeName(suggestion.query);
    const matches = index.notes.filter((note) => {
      if (note.id === noteId) return false;
      if (!needle) return true;
      return [note.title, ...note.aliases].some((name) => normalizeName(name).includes(needle));
    });
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [suggestion, index, noteId]);

  const canCreate = Boolean(suggestion?.query.trim()) && !index.byName.has(normalizeName(suggestion?.query ?? ''));
  const optionCount = candidates.length + (canCreate ? 1 : 0);

  const insertLink = useCallback(
    (title: string) => {
      if (!editor || !suggestion) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: suggestion.from, to: suggestion.to }, `[[${title}]]`)
        .run();
      setSuggestion(null);
    },
    [editor, suggestion]
  );

  /**
   * Strg und Mausrad, Strg+Plus, Strg+Minus, Strg+0 — wie im Browser.
   *
   * Der Lauscher haengt am Fenster und nicht am Editorfeld, weil der Fokus
   * beim Draehen am Rad auch auf der Werkzeugleiste stehen kann. Er greift
   * nur, solange eine Notiz offen ist; diese Komponente gibt es dann auch
   * nur dann.
   */
  /**
   * Rechtsklick auf ein falsch geschriebenes Wort.
   *
   * Was angestrichen ist, weiss nur Chromium, und das Ereignis dazu kommt im
   * Hauptprozess an. Von dort kommen Wort und Vorschlaege hierher, und das
   * Menue baut die Oberflaeche selbst — damit es aussieht wie die uebrigen.
   */
  useEffect(() => {
    return api.onRechtschreibung((treffer) => setSchreibmenue(treffer));
  }, []);

  // Die Schreibhilfe fuegt an der Schreibmarke ein, als eigener Absatz. Die
  // Auswahl bleibt im Zustand erhalten, auch waehrend der Dialog offen ist.
  // Stand die Marke in dieser Notiz noch nie, laege sie ganz vorn; dann
  // lieber wie frueher hinten anhaengen (der Aufrufer macht das bei false).
  const hatteFokus = useRef(false);
  useEffect(() => {
    hatteFokus.current = false;
  }, [noteId]);
  useEffect(() => {
    if (!editor) return;
    const merke = () => {
      hatteFokus.current = true;
    };
    editor.on('focus', merke);
    const abmelden = meldeEinfuegeziel((text) => {
      if (editor.isDestroyed || !hatteFokus.current) return false;
      return editor
        .chain()
        .focus()
        .insertContent({ type: 'paragraph', content: [{ type: 'text', text }] })
        .run();
    });
    return () => {
      editor.off('focus', merke);
      abmelden();
    };
  }, [editor]);

  /**
   * Ersetzt das angestrichene Wort an der Stelle, an der geklickt wurde.
   *
   * Ueber die Zeigerstelle und nicht ueber die Auswahl: das eigene Menue
   * setzt keine, und ohne Auswahl traefe eine Ersetzung ins Leere.
   */
  const ersetzeWort = useCallback(
    (treffer: { x: number; y: number; wort: string }, ersatz: string) => {
      if (!editor) return;
      const stelle = editor.view.posAtCoords({ left: treffer.x, top: treffer.y });
      if (!stelle) return;

      const $pos = editor.state.doc.resolve(stelle.pos);
      const text = $pos.parent.textBetween(0, $pos.parent.content.size, '\n', '\n');
      const versatz = $pos.parentOffset;
      const start = text.lastIndexOf(treffer.wort, versatz);
      if (start === -1 || start + treffer.wort.length < versatz) return;

      const von = $pos.pos - versatz + start;
      editor.chain().focus().insertContentAt({ from: von, to: von + treffer.wort.length }, ersatz).run();
    },
    [editor]
  );

  /**
   * Strg und Mausrad. Von Hand angemeldet und nicht ueber onWheel, weil React
   * Rad-Lauscher passiv anmeldet: preventDefault bliebe wirkungslos, und der
   * Browser zoomte zusaetzlich die ganze Seite.
   */
  useEffect(() => {
    const element = flaeche.current;
    if (!element) return;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      onZoom(naechsteZoomstufe(zoom, event.deltaY < 0 ? 1 : -1));
    }

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoom, onZoom]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        onZoom(naechsteZoomstufe(zoom, 1));
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        onZoom(naechsteZoomstufe(zoom, -1));
      } else if (event.key === '0') {
        event.preventDefault();
        onZoom(ZOOM_NORMAL);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoom, onZoom]);

  useEffect(() => {
    if (!suggestion || optionCount === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % optionCount);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((current) => (current - 1 + optionCount) % optionCount);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const picked = candidates[highlight];
        if (picked) {
          insertLink(picked.title);
        } else if (canCreate && suggestion) {
          const title = suggestion.query.trim();
          insertLink(title);
          onCreateNote(title);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        abgelehnt.current = vorschlagsSchluessel(suggestion);
        setSuggestion(null);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [suggestion, optionCount, candidates, highlight, canCreate, insertLink, onCreateNote]);

  return (
    <div className="body-editor">
      {searchOpen ? (
        <div className="search-bar">
          {localSearch ? (
            <>
              <input
                className="search-bar__query"
                value={localSearch.query}
                placeholder={t('search.inNote')}
                aria-label={t('search.inNote')}
                onChange={(event) => setLocalSearch({ ...localSearch, query: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    goToMatch(event.shiftKey ? -1 : 1);
                  }
                }}
              />
              <input
                className="search-bar__replace"
                value={localSearch.replace}
                placeholder={t('search.replaceWith')}
                aria-label={t('search.replaceWith')}
                onChange={(event) => setLocalSearch({ ...localSearch, replace: event.target.value })}
              />
            </>
          ) : (
            <span className="search-bar__term" title={t('search.fromSidebar')}>
              „{searchQuery.trim()}"
            </span>
          )}

          <span className="search-bar__count">
            {matchCount === 0
              ? t('search.noHit')
              : t('search.position', { current: activeMatch === -1 ? '–' : activeMatch + 1, total: matchCount })}
          </span>

          <button type="button" title={t('search.previous')} disabled={matchCount === 0} onClick={() => goToMatch(-1)}>
            ‹
          </button>
          <button type="button" title={t('search.next')} disabled={matchCount === 0} onClick={() => goToMatch(1)}>
            ›
          </button>

          {localSearch ? (
            <>
              <button type="button" disabled={matchCount === 0 || activeMatch === -1} onClick={() => replace(activeMatch)}>
                {t('search.replace')}
              </button>
              <button type="button" disabled={matchCount === 0} onClick={() => replace('all')}>
                {t('search.replaceAll')}
              </button>
              <button type="button" className="icon-button" title={t('search.close')} onClick={() => setLocalSearch(null)}>
                ×
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {linkDraft !== null && editor ? (
        <Modal
          title={t('link.title')}
          onClose={() => setLinkDraft(null)}
          footer={
            <button type="button" onClick={() => applyLink(linkDraft)}>
              {t('link.apply')}
            </button>
          }
        >
          <label className="field">
            <span className="field__label">{t('link.url')}</span>
            <input
              autoFocus
              value={linkDraft}
              placeholder="https://"
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyLink(linkDraft);
              }}
            />
          </label>
          <p className="panel__hint">{t('link.hint')}</p>
        </Modal>
      ) : null}

      <Toolbar
        editor={editor}
        zoom={zoom}
        onZoom={onZoom}
        // Nur, wenn ueberhaupt etwas zu ist. Ein toter Knopf sagt nichts
        // ueber den Zustand.
        eingeklappt={editor ? (einklappenPluginKey.getState(editor.state)?.size ?? 0) : 0}
        onAllesAufklappen={() => editor && klappeAllesAuf(editor.view)}
        onEditLink={() => setLinkDraft(editor?.getAttributes('link').href ?? '')}
        onInsertImage={() =>
          void onPickImage().then((relativePath) => {
            if (relativePath) insertImage(relativePath);
          })
        }
      />
      {/*
        ProseMirror faengt Drop und Einfuegen nur innerhalb des Textbereichs ab.
        Faellt ein Bild daneben, etwa in den Rand unterhalb des Textes, greift
        dieser Handler. Hat ProseMirror das Ereignis schon behandelt, ist
        defaultPrevented gesetzt und hier passiert nichts mehr.
      */}
      <div
        className="body-editor__surface"
        ref={flaeche}
        // `zoom` statt einer Schriftgroesse: so wachsen auch Bilder,
        // Tabellen und Abstaende mit, nicht nur der Text.
        style={{ zoom: begrenzeZoom(zoom) / 100 }}
        onDragOver={(event) => {
          if ([...event.dataTransfer.items].some((item) => item.kind === 'file')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (event.defaultPrevented) return;
          if (importFromDataTransfer(event.dataTransfer)) event.preventDefault();
        }}
        onPaste={(event) => {
          if (event.defaultPrevented) return;
          if (importFromDataTransfer(event.clipboardData)) event.preventDefault();
        }}
        onContextMenu={(event) => {
          // Kein preventDefault: sonst kaeme das Ereignis im Hauptprozess
          // nicht an, und mit ihm fehlten die Rechtschreibvorschlaege. Die
          // kommen danach und ergaenzen dieses Menue.
          setSchreibmenue({ x: event.clientX, y: event.clientY, wort: '', vorschlaege: [] });
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {schreibmenue ? (
        <ContextMenu
          x={schreibmenue.x}
          y={schreibmenue.y}
          onClose={() => setSchreibmenue(null)}
          items={[
            ...schreibmenue.vorschlaege.slice(0, 6).map((vorschlag) => ({
              label: vorschlag,
              onSelect: () => ersetzeWort(schreibmenue, vorschlag)
            })),
            ...(schreibmenue.wort
              ? [
                  {
                    label: t('spell.add', { word: schreibmenue.wort }),
                    onSelect: () => {
                      void call(api.woerterbuch.hinzufuegen(schreibmenue.wort)).then(
                        () => onReport(t('spell.added', { word: schreibmenue.wort })),
                        () => undefined
                      );
                    }
                  }
                ]
              : []),
            ...(['cut', 'copy', 'paste'] as const).map((art) => ({
              label: t(`edit.${art}`),
              onSelect: () => {
                // Erst zurueck in den Editor, sonst traefe es den Menueknopf.
                editor?.commands.focus();
                void call(api.zwischenablage(art)).catch(() => undefined);
              }
            }))
          ]}
        />
      ) : null}

      {suggestion && optionCount > 0 ? (
        <ul className="suggestions" style={{ left: suggestion.left, top: suggestion.top + 4 }}>
          {candidates.map((note, position) => (
            <li key={note.id}>
              <button
                type="button"
                className={position === highlight ? 'is-active' : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertLink(note.title);
                }}
              >
                <span>{note.title}</span>
                <span className="suggestions__type">{findNoteType(index.types, note.type).label}</span>
              </button>
            </li>
          ))}
          {canCreate ? (
            <li>
              <button
                type="button"
                className={candidates.length === highlight ? 'is-active' : undefined}
                onMouseDown={(event) => {
                  event.preventDefault();
                  const title = suggestion.query.trim();
                  insertLink(title);
                  onCreateNote(title);
                }}
              >
                <span>{t('suggest.createNew', { title: suggestion.query.trim() })}</span>
                <span className="suggestions__type">{t('suggest.new')}</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
