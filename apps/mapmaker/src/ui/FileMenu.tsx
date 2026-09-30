/** Datei-Aktionen: neu, öffnen, speichern, exportieren. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '@/model/store';
import { allLayerTemplates, onLayerTemplatesChange } from '@/assets/layerTemplateStore';
import { applyTemplateToFreshDocument, type LayerTemplate } from '@/model/layerTemplates';
import { createDocument, defaultTargetLayer, hatInhalt } from '@/model/document';
import { AddVttItems, RenameMap } from '@/model/commands';
import { makeId } from '@/model/ids';
import type { MapNote } from '@/model/types';
import { getRenderer } from '@/engine/instance';
import {
  documentFromVersion,
  historyFrom,
  packProject,
  readProjectFile,
  TTMAP_EXTENSION,
  type ProjectVersion,
} from '@/io/project';
import { canvasToBlob, downloadBlob, renderMapToCanvas, safeFilename } from '@/io/exportImage';
import { parseUvtt } from '@/io/uvtt';
import { importUvttImage, restoreAssets, usedAssets } from '@/assets/importStore';
import { restoreFonts, usedFonts } from '@/assets/fontStore';
import {
  adoptSaveTarget,
  canPickSaveTarget,
  forgetSaveTarget,
  hasSaveTarget,
  pickOpenTarget,
  readSaveTarget,
  pickSaveTarget,
  saveTargetName,
  writeToSaveTarget,
} from '@/io/saveTarget';
import { isRecentSupported, recentFiles, type RecentEntry } from '@/io/recentFiles';
import { formatCombo } from '@/model/keyBindings';
import { bindingFor } from '@/assets/keyBindingStore';
import { useT } from '@/i18n/useT';
import { ExportDialog } from './ExportDialog';
import { UvttDialog } from './UvttDialog';
import { GeneratorDialog } from './GeneratorDialog';
import { SaveAsDialog } from './SaveAsDialog';
import { AUTOSAVE_INTERVALS, shouldAutoSave } from '@/io/autoSave';

export function FileMenu() {
  const { t } = useT();
  const doc = useEditor((s) => s.doc);
  const loadDocument = useEditor((s) => s.loadDocument);
  const [showExport, setShowExport] = useState(false);
  const [showUvtt, setShowUvtt] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Nur zur Anzeige: der Name lebt im Modul, hier soll sich der Knopf ändern.
  const [saveTarget, setSaveTarget] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tplRev, setTplRev] = useState(0);
  /**
   * Frühere Fassungen der gerade offenen Projektdatei.
   *
   * Aus der Datei gelesen und nicht mitgeführt: der Verlauf gehört zum Archiv,
   * nicht zur Sitzung. Nach „Neu" ist er darum leer, auch wenn vorher eine
   * Datei offen war.
   */
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  /**
   * Zuletzt geöffnete Karten.
   *
   * Erst beim Aufklappen geladen: die Liste steht in IndexedDB, und dafür beim
   * Start eine Abfrage abzusetzen, deren Ergebnis meist niemand sieht, wäre
   * verschenkt.
   */
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  /** Bildschirmlage des Menüs; siehe Kommentar beim Portal. */
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 });
  const fileInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const autoSave = useEditor((s) => s.autoSave);
  const autoSaveMinutes = useEditor((s) => s.autoSaveMinutes);
  const setAutoSave = useEditor((s) => s.setAutoSave);
  const setAutoSaveMinutes = useEditor((s) => s.setAutoSaveMinutes);
  /** Zeitpunkt des letzten Versuchs; im Ref, damit er keinen Rerender auslöst. */
  const letzterVersuch = useRef(Date.now());
  const laeuft = useRef(false);

  /**
   * Speichern per Taste.
   *
   * Die Taste selbst kennt der Werkzeug-Manager — dort steht die ganze
   * Belegung, und nur dort lässt sie sich umbelegen. Er meldet den Wunsch als
   * Ereignis; das Dateiziel und die Dialoge gibt es nur hier.
   */
  useEffect(() => {
    const onAction = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === 'file.save') void onQuickSave();
      if (action === 'file.saveAs') void onSaveAs();
    };
    window.addEventListener('ttmap-key-action', onAction);
    return () => window.removeEventListener('ttmap-key-action', onAction);
  });

  /**
   * Automatisches Speichern.
   *
   * Der Takt ist bewusst kurz und die Bedingung streng: geprüft wird jede
   * Sekunde, geschrieben nur, wenn `shouldAutoSave` es erlaubt. Andersherum —
   * ein Zeitgeber im Abstand des Intervalls — träfe regelmäßig mitten in einen
   * Pinselstrich und müsste dann bis zum nächsten Mal warten.
   *
   * `laeuft` verhindert, dass sich zwei Schreibvorgänge überholen: das Bauen
   * der Datei rendert ein Vorschaubild und dauert bei großen Karten spürbar.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = useEditor.getState();
      if (laeuft.current) return;
      const faellig = shouldAutoSave({
        enabled: s.autoSave,
        hasTarget: hasSaveTarget(),
        inTransaction: s.history.inTransaction,
        rev: s.rev,
        lastSavedRev: s.lastSavedRev,
        lastAttempt: letzterVersuch.current,
        now: Date.now(),
        intervalMs: s.autoSaveMinutes * 60_000,
      });
      if (!faellig) return;

      letzterVersuch.current = Date.now();
      laeuft.current = true;
      const stand = s.rev;
      void (async () => {
        try {
          await writeToSaveTarget(await buildProject());
          // Der Stand von *vor* dem Schreiben: was währenddessen dazukam,
          // gehört noch nicht in der Datei und soll das nächste Mal auslösen.
          useEditor.getState().setLastSavedRev(stand);
          flash(t('file.autoSaved', { name: saveTargetName() ?? '' }));
        } catch (err) {
          // Ein fehlgeschlagenes Autospeichern darf nicht stumm bleiben — sonst
          // hält man die Arbeit für gesichert, während sie es nicht ist.
          flash(t('file.autoSaveFailed', { error: err instanceof Error ? err.message : String(err) }));
        } finally {
          laeuft.current = false;
        }
      })();
    }, 1000);
    return () => window.clearInterval(timer);
  });

  /** Menüpunkt ausführen und zuklappen — ein offenes Menü über der Karte stört. */
  const run = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  /**
   * Lage des Menüs am Knopf ausrichten.
   *
   * Nötig, weil das Menü nicht *in* der Werkzeugleiste hängt: die scrollt
   * waagerecht und schneidet darum senkrecht ab (`overflow-y: hidden`). Ein
   * Menü darin war 243 Pixel hoch und einen Pixel sichtbar.
   */
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ left: Math.round(r.left), top: Math.round(r.bottom + 6) });
  }, [menuOpen]);

  // Klick daneben und Esc schließen das Menü. Ohne das bliebe es offen stehen,
  // sobald jemand es aus Versehen aufklappt.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const ziel = e.target as Node;
      // Das Menü hängt am body, nicht am Knopf — beide müssen gefragt werden.
      if (menuRef.current?.contains(ziel) || popupRef.current?.contains(ziel)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Eine frisch gesicherte Vorlage soll sofort im Menü stehen.
  useEffect(() => onLayerTemplatesChange(() => setTplRev((r) => r + 1)), []);
  const templates = useMemo(() => allLayerTemplates(), [tplRev, menuOpen]);

  const flash = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus((s) => (s === message ? null : s)), 4000);
  };

  const onNew = (template?: LayerTemplate): boolean => {
    // Gibt zurueck, ob wirklich eine neue Karte entstanden ist. Gebraucht
    // wird das vom Anstoss von aussen (siehe unten): wer die Rueckfrage
    // abbricht, soll auch nicht die alte Karte umbenannt bekommen.
    //
    // Gefragt wird, sobald IRGENDETWAS auf der Karte steht — frueher nur bei
    // Objekten. Wer eine Notiz gesetzt hatte oder eine Wand gezogen, verlor
    // sie wortlos.
    if (hatInhalt(doc) && !window.confirm(t('file.confirmNew'))) return false;
    const frisch = createDocument();
    // Auf einer frischen Karte ersetzt die Vorlage die Standardebenen: sie
    // stehen zu lassen hieße, genau die Aufräumarbeit zu hinterlassen, die die
    // Vorlage abnehmen soll. Zu retten ist dabei nichts — die Karte ist leer.
    loadDocument(template ? applyTemplateToFreshDocument(frisch, template) : frisch);
    // Sonst schriebe das nächste Quicksave die neue leere Karte über die alte Datei.
    forgetSaveTarget();
    setSaveTarget(null);
    setVersions([]);
    return true;
  };

  /**
   * Eine neue Karte, angestossen von aussen.
   *
   * Die Inspirationshilfe erzeugt Orte und schickt einen Namen herueber (ueber
   * die Huelle, nicht direkt — die Anwendungen kennen einander nicht). Mehr
   * kommt ueber diese Bruecke nicht: eine Karte aus Text zu zeichnen hiesse,
   * dieses Datenmodell von aussen zu bedienen.
   *
   * Die Rueckfrage von `onNew` gilt auch hier. Von aussen wird nichts
   * weggeworfen, was hier jemand gezeichnet hat.
   */
  useEffect(() => {
    const bruecke = (window as unknown as {
      ttrpgToolsKarte?: {
        onNeu(
          callback: (name: string, notizen?: { title: string; text: string }[]) => void
        ): () => void;
      };
    }).ttrpgToolsKarte;
    if (!bruecke) return;
    return bruecke.onNeu((name, notizen = []) => {
      const sauber = name.trim();
      if (!sauber) return;
      if (!onNew()) return;
      useEditor.getState().exec(new RenameMap(sauber));

      /*
       * Was die Inspirationshilfe ueber den Ort weiss, wird zu Pins.
       *
       * Eine leere Karte mit dem richtigen Namen war der erste Anlauf und zu
       * wenig: man stand vor einer leeren Flaeche und musste im anderen
       * Werkzeug nachlesen, was darauf gehoert. Jetzt steht es auf der Karte.
       * Gezeichnet wird weiterhin nichts — dafuer ist dieser Editor da.
       */
      const brauchbar = notizen.filter((notiz) => notiz && notiz.text.trim());
      if (brauchbar.length === 0) return;

      const zustand = useEditor.getState();
      const frisch = zustand.doc;
      const breite = frisch.size.cols * frisch.grid.tileSize;
      const hoehe = frisch.size.rows * frisch.grid.tileSize;
      const vorgabe = zustand.note;

      // Nebeneinander auf halber Hoehe, mit gleichem Abstand: eine Reihe, die
      // man beim Oeffnen sofort sieht und beliebig verschieben kann.
      const pins: MapNote[] = brauchbar.map((notiz, stelle) => ({
        id: makeId('note'),
        x: (breite / (brauchbar.length + 1)) * (stelle + 1),
        y: hoehe / 2,
        title: notiz.title.slice(0, 80),
        text: notiz.text,
        icon: vorgabe.icon,
        size: vorgabe.size,
        color: vorgabe.color,
        // Vorbereitung, keine Spielerinformation.
        playerVisible: false,
      }));
      zustand.exec(new AddVttItems('notes', pins, t('cmd.addNote')));
      // Sonst sieht man nur eine neue, scheinbar leere Flaeche: die Pins
      // liegen verteilt und muessen nicht im ersten Blickfeld liegen.
      flash(t('file.fromTool', { name: sauber, count: pins.length }));
    });
    // Ohne Abhaengigkeiten waere `onNew` bei jedem Rendern ein anderes, und
    // die Anmeldung liefe staendig neu. `doc` steckt darin, weil die
    // Rueckfrage davon abhaengt.
  }, [doc]);

  /**
   * Stellt eine frühere Fassung der offenen Datei her.
   *
   * Nur im Editor — geschrieben wird erst beim nächsten Speichern. Wer sich
   * vertut, kommt mit Rückgängig nicht zurück (die Fassung *ersetzt* das
   * Dokument samt Verlauf), darum die Rückfrage.
   */
  const onRestore = (version: ProjectVersion) => {
    if (!window.confirm(t('file.confirmRestore', { time: zeitpunkt(version.savedAt) }))) return;
    try {
      const { doc: alt } = documentFromVersion(version.data);
      loadDocument(alt);
      flash(t('file.restored', { time: zeitpunkt(version.savedAt) }));
    } catch (err) {
      flash(t('file.openFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  /** Zeitstempel für die Anzeige: Datum und Uhrzeit, ohne Sekundenbruchteile. */
  const zeitpunkt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString(undefined, {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  /**
   * Baut die Projektdatei samt Vorschaubild.
   *
   * `history` sind die Fassungen, die mit ins neue Archiv wandern — beim
   * Überschreiben einer vorhandenen Datei ist das ihr bisheriger Stand.
   */
  const buildProject = async (history: ProjectVersion[] = []): Promise<Uint8Array> => {
    // Vorschaubild klein halten: es dient der Wiedererkennung, nicht dem Druck.
    let thumbnail: Uint8Array | undefined;
    const renderer = getRenderer();
    if (renderer) {
      const perTile = Math.max(4, Math.min(24, Math.floor(640 / Math.max(doc.size.cols, 1))));
      const canvas = renderMapToCanvas(renderer, doc, {
        pixelsPerTile: perTile,
        format: 'webp',
        quality: 0.7,
        includeGrid: false,
        includeBackground: true,
      });
      const blob = await canvasToBlob(canvas, 'webp', 0.7);
      thumbnail = new Uint8Array(await blob.arrayBuffer());
    }
    // Nur die tatsächlich benutzten Assets: die ganze importierte Bibliothek
    // mitzuschreiben ergäbe unbrauchbar große Dateien.
    return packProject(doc, usedAssets(doc), thumbnail, usedFonts(doc), history);
  };

  /**
   * Quicksave: überschreibt die zuletzt gewählte Datei ohne Dialog.
   * Ohne Ziel — oder ohne die nötige Browser-API — wird daraus „Speichern unter".
   */
  const onQuickSave = async () => {
    if (!hasSaveTarget()) {
      await onSaveAs();
      return;
    }
    try {
      const stand = doc ? useEditor.getState().rev : 0;
      // Erst die alte Datei lesen, dann überschreiben: ihr Stand wird zur
      // jüngsten Fassung im neuen Archiv. Danach gäbe es ihn nirgends mehr.
      const vorher = await readSaveTarget();
      const history = vorher ? historyFrom(vorher) : [];
      await writeToSaveTarget(await buildProject(history));
      setVersions(history);
      useEditor.getState().setLastSavedRev(stand);
      flash(t('file.quickSaved', { name: saveTargetName() ?? '' }));
    } catch (err) {
      flash(t('file.saveFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  /**
   * „Speichern unter" mit bereits gewähltem Namen.
   *
   * Der Name landet auch im Dokument: sonst hieße die Karte in der Titelzeile
   * weiter „Unbenannte Karte", während die Datei anders heißt — und beim
   * nächsten „Speichern unter" schlüge wieder der alte Name vor.
   */
  const onSaveAs = async (neuerName?: string) => {
    try {
      if (neuerName && neuerName !== doc.meta.name) {
        useEditor.getState().exec(new RenameMap(neuerName));
      }
      const filename = safeFilename(doc.meta.name, TTMAP_EXTENSION);

      // Chromium und die Tauri-Hülle: Ziel wählen und merken, damit
      // Quicksave danach greift.
      if (canPickSaveTarget()) {
        // Erst fragen, dann bauen: wer im Dialog abbricht, soll nicht auf ein
        // Archiv gewartet haben, das niemand bekommt. Und die gewählte Datei
        // lässt sich erst danach nach ihrem bisherigen Stand fragen — wer eine
        // vorhandene Karte überschreibt, soll deren Fassung behalten.
        const gewaehlt = await pickSaveTarget(filename, TTMAP_EXTENSION, t('file.ttmapType'));
        if (!gewaehlt) return; // Im Dialog abgebrochen.
        const vorher = await readSaveTarget();
        const history = vorher ? historyFrom(vorher) : [];
        await writeToSaveTarget(await buildProject(history));
        setVersions(history);
        setSaveTarget(saveTargetName());
        useEditor.getState().setLastSavedRev(useEditor.getState().rev);
        flash(t('file.quickSaved', { name: saveTargetName() ?? '' }));
        return;
      }

      // Firefox und Safari: herunterladen, mehr geht dort nicht. Eine
      // Vorgeschichte gibt es hier nicht: der Browser sagt nicht einmal, wohin
      // die Datei gelegt wurde, geschweige denn, was dort vorher stand.
      downloadBlob(
        new Blob([(await buildProject()) as unknown as BlobPart], { type: 'application/zip' }),
        filename,
      );
      flash(t('file.saved'));
    } catch (err) {
      flash(t('file.saveFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  /**
   * Öffnen über die Picker-API, wo es sie gibt: nur so bleibt die Datei als
   * Speicherziel bekannt und Quicksave schreibt später dorthin zurück.
   */
  const onOpenClick = async () => {
    try {
      const picked = await pickOpenTarget(TTMAP_EXTENSION);
      if (picked === undefined) {
        fileInput.current?.click(); // Firefox, Safari
        return;
      }
      if (picked === null) return; // Abgebrochen.
      setSaveTarget(saveTargetName());
      await onOpen(picked);
    } catch (err) {
      flash(t('file.openFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  useEffect(() => {
    if (!menuOpen || !isRecentSupported()) return;
    let abgemeldet = false;
    void recentFiles.list().then((liste) => {
      if (!abgemeldet) setRecent(liste);
    });
    return () => {
      abgemeldet = true;
    };
  }, [menuOpen]);

  /**
   * Eine Karte aus der Liste öffnen.
   *
   * Das Handle wird dabei zum Speicherziel — wer eine Datei aus der Liste holt,
   * erwartet, dass Strg+S danach dorthin zurückschreibt.
   */
  const onRecent = async (entry: RecentEntry) => {
    const file = await recentFiles.open(entry);
    if (!file) {
      flash(t('file.recentDenied', { name: entry.name }));
      setRecent(await recentFiles.list());
      return;
    }
    adoptSaveTarget(entry.handle);
    setSaveTarget(saveTargetName());
    await onOpen(file);
  };

  const onOpen = async (file: File) => {
    try {
      // Universal-VTT-Dateien direkt einlesen: damit lässt sich der eigene
      // Export gegenprüfen und eine gekaufte Karte weiterbearbeiten.
      if (/\.(uvtt|dd2vtt|df2vtt)$/i.test(file.name)) {
        const text = await file.text();
        const next = createDocument();
        const result = parseUvtt(text, next.grid.tileSize);
        next.meta.name = file.name.replace(/\.[^.]+$/, '');
        next.size = result.size;
        next.vtt = result.vtt;

        // Das Kartenbild als Hintergrund-Prop einsetzen. Es deckungsgleich auf
        // das Raster zu legen ist der halbe Zweck des Imports — Wände und Türen
        // der Datei beziehen sich genau darauf.
        let bildHinweis = '';
        if (result.image) {
          const def = await importUvttImage(result.image, result.pixelsPerGrid, next.meta.name);
          const layer = defaultTargetLayer(next) ?? next.rootLayers[0];
          if (def && layer) {
            const tile = next.grid.tileSize;
            const objId = makeId('obj');
            next.objects[objId] = {
              id: objId,
              kind: 'prop',
              layerId: layer,
              propId: def.id,
              // Mittig: Props sitzen auf ihrem Mittelpunkt.
              x: (next.size.cols * tile) / 2,
              y: (next.size.rows * tile) / 2,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
              tint: null,
              flipX: false,
              flipY: false,
              opacity: 1,
              z: 0,
              locked: false,
              seed: 1,
            };
            bildHinweis = t('file.uvttImageAdded');
          } else {
            bildHinweis = t('file.uvttImageFailed');
          }
        }

        loadDocument(next);
        flash(
          [
            t('file.uvttLoaded', {
              walls: result.vtt.walls.length,
              portals: result.vtt.portals.length,
              lights: result.vtt.lights.length,
            }),
            bildHinweis,
            ...result.warnings,
          ]
            .filter(Boolean)
            .join(' '),
        );
        return;
      }

      const { bundle, report } = await readProjectFile(file);
      setVersions(bundle.versions);
      // Erst die Bilder registrieren, dann das Dokument laden — sonst sucht
      // der Renderer für einen Moment nach Props, die es noch nicht gibt.
      if (bundle.assets.size > 0) {
        await restoreAssets(bundle.assets, doc.grid.tileSize);
      }
      // Ebenso die Schriften, und ebenso vor dem Dokument: sonst zeigt der
      // erste Frame die Beschriftungen in der Ersatzschrift.
      if (bundle.fonts.size > 0) {
        await restoreFonts(bundle.fonts);
      }
      loadDocument(bundle.doc);
      flash(
        report.warnings.length > 0
          ? t('file.loadedWithWarnings', { warnings: report.warnings.join(' ') })
          : t('file.loaded', { name: bundle.doc.meta.name }),
      );
    } catch (err) {
      flash(t('file.openFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <>
      {/*
        Neu, Öffnen und Speichern liegen in einem Klappmenü statt nebeneinander
        in der Leiste. Vier Knöpfe für Dinge, die man selten und nie in Folge
        anfasst, drängten die Werkzeuge aus dem Bild — und Werkzeuge braucht man
        ständig. Strg+S bleibt davon unberührt und speichert weiterhin ohne
        Umweg über das Menü.
      */}
      <div className="menu" ref={menuRef}>
        <button
          className={menuOpen ? 'active' : ''}
          onClick={() => setMenuOpen((v) => !v)}
          title={t('file.menuHint')}
          aria-expanded={menuOpen}
        >
          {t('file.menu')} ▾{saveTarget ? ' •' : ''}
        </button>

        {menuOpen
          ? createPortal(
          <div
            className="menu-popup"
            role="menu"
            ref={popupRef}
            style={{ left: menuPos.left, top: menuPos.top }}
          >
            <button onClick={() => run(() => onNew())} title={t('file.newHint')}>
              {t('file.new')}
            </button>
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => run(() => onNew(tpl))}
                title={t('file.newWithTemplateHint')}
              >
                {t('file.newWithTemplate', { name: tpl.name })}
              </button>
            ))}
            <button onClick={() => run(() => void onOpenClick())} title={t('file.openHint')}>
              {t('file.open')}
            </button>
            {recent.length > 0 ? (
              <>
                <div className="menu-sep" />
                <p className="menu-note">{t('file.recentTitle')}</p>
                {recent.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => run(() => void onRecent(r))}
                    title={t('file.recentHint', { name: r.name })}
                  >
                    {r.name}
                  </button>
                ))}
                <button
                  className="ghost"
                  onClick={() =>
                    void recentFiles.clear().then(() => setRecent([]))
                  }
                  title={t('file.recentForgetHint')}
                >
                  {t('file.recentForget')}
                </button>
              </>
            ) : null}
            {versions.length > 0 ? (
              <>
                <div className="menu-sep" />
                <p className="menu-note">{t('file.versionsTitle')}</p>
                {versions.map((v) => (
                  <button
                    key={v.file}
                    onClick={() => run(() => onRestore(v))}
                    title={t('file.restoreHint')}
                  >
                    {t('file.versionEntry', { time: zeitpunkt(v.savedAt) })}
                  </button>
                ))}
              </>
            ) : null}
            <div className="menu-sep" />
            <button
              onClick={() => run(() => void onQuickSave())}
              title={saveTarget ? t('file.quickSaveHint', { name: saveTarget }) : t('file.saveHint')}
            >
              {t('file.save')}
              <span className="menu-key">{formatCombo(bindingFor('file.save'))}</span>
            </button>
            <button onClick={() => run(() => setShowSaveAs(true))} title={t('file.saveAsHint')}>
              {t('file.saveAs')}
              <span className="menu-key">{formatCombo(bindingFor('file.saveAs'))}</span>
            </button>
            {saveTarget ? <p className="menu-note">{t('file.targetIs', { name: saveTarget })}</p> : null}
            <div className="menu-sep" />
            <p className="menu-note">{t('file.exportTitle')}</p>
            <button onClick={() => run(() => setShowExport(true))} title={t('file.imageHint')}>
              {t('file.image')}
            </button>
            <button onClick={() => run(() => setShowUvtt(true))} title={t('file.vttHint')}>
              {t('file.vtt')}
            </button>
            <div className="menu-sep" />
            {/*
              Das Autospeichern tut nur zusammen mit einem Dateiziel etwas —
              ohne Ziel wäre der Rückfall ein Download, und alle paar Minuten
              eine neue Datei anzulegen wäre schlimmer als gar nichts. Darum ist
              es dann gesperrt und sagt, warum.
            */}
            <label
              className="autosave"
              title={saveTarget ? t('file.autoSaveHint') : t('file.autoSaveNeedsTarget')}
            >
              <input
                type="checkbox"
                checked={autoSave}
                disabled={!saveTarget}
                onChange={(e) => setAutoSave(e.target.checked)}
              />
              {t('file.autoSave')}
              {autoSave && saveTarget ? (
                <select
                  value={autoSaveMinutes}
                  onChange={(e) => setAutoSaveMinutes(Number(e.target.value))}
                >
                  {AUTOSAVE_INTERVALS.map((m) => (
                    <option key={m} value={m}>
                      {t('file.autoSaveEvery', { n: m })}
                    </option>
                  ))}
                </select>
              ) : null}
            </label>
          </div>,
          document.body,
            )
          : null}
      </div>
      {/*
        Der Generator bleibt in der Leiste: er baut Karteninhalt und wird beim
        Bauen benutzt. Bild- und VTT-Ausgabe sind dagegen Datei-Aktionen wie
        Speichern und stehen deshalb im selben Menü — das war auch die Breite,
        die den Werkzeugen fehlte.
      */}
      <button onClick={() => setShowGen(true)} title={t('gen.menuHint')}>
        {t('gen.menu')}
      </button>

      <input
        ref={fileInput}
        type="file"
        accept={`.${TTMAP_EXTENSION},.uvtt,.dd2vtt,.df2vtt`}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
          e.target.value = '';
          if (file) void onOpen(file);
        }}
      />

      {status ? <span className="toast">{status}</span> : null}
      {showExport ? <ExportDialog onClose={() => setShowExport(false)} /> : null}
      {showUvtt ? <UvttDialog onClose={() => setShowUvtt(false)} /> : null}
      {showGen ? <GeneratorDialog onClose={() => setShowGen(false)} neueKarte={() => onNew()} /> : null}
      <SaveAsDialog
        offen={showSaveAs}
        name={doc.meta.name}
        onAbbruch={() => setShowSaveAs(false)}
        onSpeichern={(n) => {
          setShowSaveAs(false);
          void onSaveAs(n);
        }}
      />
    </>
  );
}
