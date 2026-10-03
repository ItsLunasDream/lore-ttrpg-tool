/** Dialog für den Universal-VTT-Export nach Foundry & Co. */

import { useMemo, useState } from 'react';
import { useEditor } from '@/model/store';
import { getRenderer } from '@/engine/instance';
import {
  canvasToBase64,
  exportSize,
  renderMapToCanvasAsync,
  renderFremdeKarte,
  type ExportProgress,
  downloadBlob,
  safeFilename,
  type ImageFormat,
} from '@/io/exportImage';
import {
  applyExportCleanup,
  buildUvtt,
  checkConsistency,
  isCleanupEmpty,
  parseUvtt,
  planExportCleanup,
  serializeUvtt,
  type CleanupItem,
} from '@/io/uvtt';
import { buildFoundryNotesMacro } from '@/io/foundryNotes';
import { buildFoundryWalls, buildFoundryWallsMacro } from '@/io/foundryWalls';
import { TARGET_TRAITS, VTT_TARGETS, targetWarnings, type VttTarget } from '@/io/vttTargets';
import { isNeutral } from '@/model/filters';
import { ebenenDateiname, ebenenReihenfolge, ebenenZip } from '@/io/ebenenExport';
import type { MapDocument } from '@/model/types';
import { useT } from '@/i18n/useT';
import { Row, Select, Slider, Toggle, useEscapeClose } from './controls';

const PRESETS = [70, 100, 140];

export function UvttDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  useEscapeClose(onClose);
  const doc = useEditor((s) => s.doc);
  const karten = useEditor((s) => s.karten);
  const rev = useEditor((s) => s.rev);
  const [pixelsPerGrid, setPixelsPerGrid] = useState(100);
  const [format, setFormat] = useState<ImageFormat>('webp');
  const [extension, setExtension] = useState<'dd2vtt' | 'uvtt'>('dd2vtt');
  /**
   * Für welchen Importer geschrieben wird.
   *
   * Foundry ist die Voreinstellung — der Weg, den das Projekt von Anfang an
   * geht. Owlbear Rodeo braucht die Farben andersherum; das kann keine Datei
   * gleichzeitig, also wird es hier entschieden.
   */
  const [target, setTarget] = useState<VttTarget>('foundry');
  const [includeGrid, setIncludeGrid] = useState(false);
  // Voreinstellung: nicht mitrendern. Foundry rechnet sein Licht selbst, und
  // ein bereits eingefärbtes Bild ließe sich dort nicht mehr aufhellen.
  const [bakeFilters, setBakeFilters] = useState(false);
  // Aus als Voreinstellung: ohne Zutun soll der Export sich nicht ändern.
  const [cleanup, setCleanup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<string | null>(null);
  const [macroNote, setMacroNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const size = useMemo(() => exportSize(doc, pixelsPerGrid), [doc, pixelsPerGrid]);
  // rev gehört in die Abhängigkeiten: das Dokument wird mutiert, nicht ersetzt —
  // seine Identität ändert sich nie, der Zähler dagegen bei jeder Änderung.
  const problems = useMemo(
    () => checkConsistency(doc, pixelsPerGrid),
    [doc, rev, pixelsPerGrid],
  );
  const plan = useMemo(() => planExportCleanup(doc), [doc, rev]);
  const zielHinweise = useMemo(() => targetWarnings(doc, target), [doc, rev, target]);
  const counts = doc.vtt;
  // Nur fragen, wenn es etwas zu entscheiden gibt.
  const filtersAktiv =
    !isNeutral(doc.filters) ||
    Object.values(doc.layers).some((l) => !isNeutral(l.filters));

  /** Fundstelle als Feldkoordinate — Weltpixel sagen niemandem etwas. */
  const spotOf = (item: CleanupItem) =>
    t('uvtt.cleanupAt', {
      col: Math.floor(item.x / doc.grid.tileSize),
      row: Math.floor(item.y / doc.grid.tileSize),
    });

  /** Kurze Liste der Fundstellen; bei vielen nur die ersten. */
  const spots = (items: CleanupItem[], limit = 6) => {
    const shown = items.slice(0, limit).map(spotOf).join(' · ');
    return items.length > limit
      ? `${shown} · ${t('uvtt.cleanupMore', { n: items.length - limit })}`
      : shown;
  };

  /** Dateiname ohne Endung, aus dem Kartennamen. */
  const baseName = () => doc.meta.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'karte';

  /** Wie viele Teilstücke das Wand-Makro anfassen würde. */
  const wandStuecke = useMemo(() => buildFoundryWalls(doc).length, [doc, rev]);

  const saveWallMacro = () => {
    downloadBlob(
      new Blob([buildFoundryWallsMacro(doc)], { type: 'text/javascript' }),
      `${baseName()}-wandsperren.js`,
    );
  };

  const copyWallMacro = async () => {
    try {
      await navigator.clipboard.writeText(buildFoundryWallsMacro(doc));
      setMacroNote(t('note.macroCopied'));
    } catch {
      saveWallMacro();
    }
  };

  const saveMacro = () => {
    downloadBlob(
      new Blob([buildFoundryNotesMacro(doc)], { type: 'text/javascript' }),
      `${baseName()}-notizen.js`,
    );
  };

  const copyMacro = async () => {
    try {
      await navigator.clipboard.writeText(buildFoundryNotesMacro(doc));
      setMacroNote(t('note.macroCopied'));
    } catch {
      // Ohne Zwischenablage-Recht bleibt der Weg über die Datei.
      saveMacro();
    }
  };

  const run = async () => {
    const renderer = getRenderer();
    if (!renderer) return;
    setBusy(true);
    setError(null);
    setVerified(null);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const canvas = await renderMapToCanvasAsync(
        renderer,
        doc,
        {
          pixelsPerTile: pixelsPerGrid,
          format,
          quality: 0.92,
          includeGrid,
          includeBackground: true,
          ignoreFilters: !bakeFilters,
        },
        setProgress,
      );
      const image = await canvasToBase64(canvas, format, 0.92);
      // Die Bereinigung wirkt nur hier: das Dokument selbst bleibt unangetastet.
      const vttOut = cleanup ? applyExportCleanup(doc.vtt, plan) : doc.vtt;
      // baked_lighting sagt dem VTT, ob Beleuchtung schon im Bild steckt.
      // Wandert die Nacht-Vorlage mit ins Bild, ist genau das der Fall.
      const file = buildUvtt(
        { ...doc, vtt: { ...vttOut, bakedLighting: bakeFilters && filtersAktiv } },
        { image, pixelsPerGrid, target },
      );
      const text = serializeUvtt(file);

      // Gegenprobe: die eben erzeugte Datei sofort wieder einlesen. Stimmen die
      // Zahlen nicht, liegt der Fehler hier und nicht erst in Foundry.
      // Mit derselben Farbreihenfolge gegenlesen, mit der geschrieben wurde:
      // sonst prüft die Gegenprobe etwas anderes, als in der Datei steht.
      const back = parseUvtt(text, doc.grid.tileSize, TARGET_TRAITS[target].colorOrder);
      // Verglichen wird mit dem Exportierten, nicht mit dem Dokument — sonst
      // meldete jede weggelassene Lichtquelle eine Abweichung.
      const ok =
        back.vtt.portals.length === vttOut.portals.length &&
        back.vtt.lights.length === vttOut.lights.length &&
        back.size.cols === doc.size.cols &&
        back.size.rows === doc.size.rows;
      setVerified(
        ok
          ? t('uvtt.verified', {
              walls: back.vtt.walls.length,
              portals: back.vtt.portals.length,
              lights: back.vtt.lights.length,
              cols: back.size.cols,
              rows: back.size.rows,
            })
          : t('uvtt.verifyFailed'),
      );

      downloadBlob(
        new Blob([text], { type: 'application/json' }),
        safeFilename(doc.meta.name, extension),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  /**
   * Alle Karten der Datei, je eine UVTT-Datei, zusammen in einem ZIP — für
   * Foundrys Ebenen (`io/ebenenExport.ts`). Mit denselben Einstellungen wie
   * der einzelne Export; die Bereinigung rechnet je Karte.
   */
  const runAlle = async () => {
    const renderer = getRenderer();
    if (!renderer) return;
    setBusy(true);
    setError(null);
    setVerified(null);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const filterAn = (k: MapDocument) =>
        !isNeutral(k.filters) || Object.values(k.layers).some((l) => !isNeutral(l.filters));
      const reihe = ebenenReihenfolge(karten);
      const dateien: { name: string; text: string }[] = [];
      for (const [i, k] of reihe.entries()) {
        setProgress({ done: i, total: reihe.length });
        await new Promise((r) => setTimeout(r, 0));
        const canvas = renderFremdeKarte(renderer, k, doc, {
          pixelsPerTile: pixelsPerGrid,
          format,
          quality: 0.92,
          includeGrid,
          includeBackground: true,
          ignoreFilters: !bakeFilters,
        });
        const image = await canvasToBase64(canvas, format, 0.92);
        const vttOut = cleanup ? applyExportCleanup(k.vtt, planExportCleanup(k)) : k.vtt;
        const file = buildUvtt(
          { ...k, vtt: { ...vttOut, bakedLighting: bakeFilters && filterAn(k) } },
          { image, pixelsPerGrid, target },
        );
        dateien.push({ name: ebenenDateiname(i, k.meta.name, extension), text: serializeUvtt(file) });
      }
      const liesmich = [t('uvtt.alleLiesmich'), '', ...dateien.map((d) => `- ${d.name}`)].join('\n');
      downloadBlob(new Blob([ebenenZip(dateien, liesmich) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `${baseName()}-ebenen.zip`);
      setVerified(t('uvtt.alleFertig', { n: dateien.length }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{t('uvtt.title')}</h3>
          <button className="ghost icon" onClick={onClose} title={t('export.close')}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          <Row label={t('export.resolution')}>
            <div className="chips">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={pixelsPerGrid === p ? 'active' : ''}
                  onClick={() => setPixelsPerGrid(p)}
                >
                  {p} px
                </button>
              ))}
            </div>
          </Row>
          <Slider
            label={t('export.perTile')}
            min={30}
            max={200}
            step={5}
            value={pixelsPerGrid}
            onChange={setPixelsPerGrid}
          />
          <Select<ImageFormat>
            label={t('uvtt.imageFormat')}
            value={format}
            options={[
              { value: 'webp', label: t('uvtt.webp') },
              { value: 'png', label: t('uvtt.png') },
            ]}
            onChange={setFormat}
          />
          <Select<VttTarget>
            label={t('uvtt.target')}
            value={target}
            options={VTT_TARGETS.map((v) => ({
              value: v,
              label: t(
                v === 'foundry'
                  ? 'uvtt.targetFoundry'
                  : v === 'roll20'
                    ? 'uvtt.targetRoll20'
                    : 'uvtt.targetOwlbear',
              ),
            }))}
            onChange={setTarget}
          />
          <p className="hint">{t('uvtt.targetHint')}</p>
          <Select<'dd2vtt' | 'uvtt'>
            label={t('uvtt.extension')}
            value={extension}
            options={[
              { value: 'dd2vtt', label: t('uvtt.dd2vtt') },
              { value: 'uvtt', label: t('uvtt.uvtt') },
            ]}
            onChange={setExtension}
          />
          <Toggle label={t('uvtt.gridIn')} checked={includeGrid} onChange={setIncludeGrid} />
          {filtersAktiv ? (
            <>
              <Toggle
                label={t('uvtt.bakeFilters')}
                checked={bakeFilters}
                onChange={setBakeFilters}
              />
              <p className="hint">{t('uvtt.bakeFiltersHint')}</p>
            </>
          ) : null}

          <p className="hint">
            {t('uvtt.contains', {
              walls: counts.walls.length,
              portals: counts.portals.length,
              lights: counts.lights.length,
              notes: counts.notes.length,
              w: size.width,
              h: size.height,
            })}
          </p>
          {includeGrid ? <p className="warn">{t('uvtt.gridWarn')}</p> : null}
          {counts.walls.length === 0 ? <p className="warn">{t('uvtt.noWalls')}</p> : null}
          {problems.map((p) => (
            <p className="warn" key={p}>
              {p}
            </p>
          ))}
          {zielHinweise.map((p) => (
            <p className="warn" key={p}>
              {p}
            </p>
          ))}

          {/*
            Abschnitte ohne Inhalt fallen weg (Rückmeldung): kein Bereinigen,
            wenn nichts zu bereinigen ist, kein Foundry-Hinweis und keine
            Foundry-Makros bei einem anderen Ziel oder ohne Wände/Notizen.
          */}
          {isCleanupEmpty(plan) ? null : (
            <Toggle label={t('uvtt.cleanup')} checked={cleanup} onChange={setCleanup} />
          )}
          {cleanup && !isCleanupEmpty(plan) ? (
            <>
              <p className="hint">{t('uvtt.cleanupHint')}</p>
              {isCleanupEmpty(plan) ? (
                <p className="hint">{t('uvtt.cleanupNone')}</p>
              ) : (
                <>
                  {plan.orphanDoors.length > 0 ? (
                    <p className="hint">
                      {plan.orphanDoors.length === 1
                        ? t('uvtt.cleanupDoorsOne')
                        : t('uvtt.cleanupDoors', { n: plan.orphanDoors.length })}
                      <br />
                      <span className="value">{spots(plan.orphanDoors)}</span>
                    </p>
                  ) : null}
                  {plan.uselessLights.length > 0 ? (
                    <p className="hint">
                      {plan.uselessLights.length === 1
                        ? t('uvtt.cleanupLightsOne')
                        : t('uvtt.cleanupLights', { n: plan.uselessLights.length })}
                      <br />
                      <span className="value">{spots(plan.uselessLights)}</span>
                    </p>
                  ) : null}
                  {plan.danglingWallEnds.length > 0 ? (
                    <p className="warn">
                      {plan.danglingWallEnds.length === 1
                        ? t('uvtt.cleanupWallsOne')
                        : t('uvtt.cleanupWalls', { n: plan.danglingWallEnds.length })}
                      <br />
                      <span className="value">{spots(plan.danglingWallEnds)}</span>
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : null}
          {verified ? <p className="hint">{verified}</p> : null}
          {error ? <p className="warn">{error}</p> : null}
          {progress ? (
            <>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
                <div style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              <p className="hint">
                {t('export.progress', { done: progress.done, total: progress.total })}
              </p>
            </>
          ) : null}

          {target === 'foundry' ? (
            <>
              <div className="divider" />
              <p className="hint">{t('uvtt.foundryHint')}</p>
            </>
          ) : null}

          {target === 'foundry' && wandStuecke > 0 ? (
            <>
              <div className="divider" />
              <h4>{t('wall.macroTitle')}</h4>
              <p className="hint">{t('wall.macroExplain')}</p>
              <p className="hint">{t('wall.macroCount', { n: wandStuecke })}</p>
              <div className="row-inline">
                <button onClick={saveWallMacro}>{t('wall.macroDownload')}</button>
                <button onClick={copyWallMacro}>{t('wall.macroCopy')}</button>
              </div>
            </>
          ) : null}

          {target === 'foundry' && counts.notes.length > 0 ? (
            <>
              <div className="divider" />
              <h4>{t('note.macroTitle')}</h4>
              <p className="hint">{t('note.macroExplain')}</p>
              <p className="hint">{t('note.macroSteps')}</p>
              <div className="row-inline">
                <button onClick={saveMacro}>{t('note.macroDownload')}</button>
                <button onClick={copyMacro}>{t('note.macroCopy')}</button>
                {macroNote ? <span className="value">{macroNote}</span> : null}
              </div>
            </>
          ) : null}
        </div>

        <footer>
          <button onClick={onClose}>{t('export.close')}</button>
          {karten.length > 1 ? (
            <button disabled={busy || size.tooLarge} onClick={runAlle} title={t('uvtt.alleHinweis')} data-uvtt-alle>
              {t('uvtt.alle', { n: karten.length })}
            </button>
          ) : null}
          <button className="primary" disabled={busy || size.tooLarge} onClick={run}>
            {busy ? t('export.rendering') : t('export.run')}
          </button>
        </footer>
      </div>
    </div>
  );
}
