/** Rechtes Panel: Karte, Grid, Auswahl, Zeichnen, Text und Pinsel. */

import { useState } from 'react';
import {
  AddObjects,
  PatchGrid,
  SetGuides,
  PatchObjects,
  ResizeMap,
  SetObjectGroup,
  SetBackground,
  SetEbene,
  type ResizeAnchor,
} from '@/model/commands';
import { buildScaleBar } from '@/model/scaleBar';
import { isDark } from '@/model/color';
import { defaultTargetLayer } from '@/model/document';
import { mapPixelSize } from '@/model/grid';
import { useEditor } from '@/model/store';
import { moeglicheUnterlagen } from '@/model/mappe';
import { align, distribute, type Deltas, type Item as AlignItem } from '@/model/align';
import { getRenderer } from '@/engine/instance';
import { makeId } from '@/model/ids';
import { canAnchor } from '@/model/labelAnchor';
import { guidesOf } from '@/model/guides';
import { getProp, propName } from '@/assets/library';
import { seedFuerVariante, variantFor } from '@/assets/varianten';
import { importFont, importedFonts } from '@/assets/fontStore';
import { worldAABB } from '@/engine/hitTest';
import type { DrawSettings, RouteSettings } from '@/model/toolSettings';
import { defaultTerrain } from '@/model/toolSettings';
import { istWasser, WASSER_FARBE } from '@/model/wasser';
import type { PropLight } from '@/model/types';
import { lichtFuerProp } from '@/assets/propLights';
import { PATTERN_KINDS } from '@/model/types';
import { gridDistance } from '@/model/grid';
import type {
  GridMetric,
  GridSettings as GridSettingsType,
  GridType,
  MapObject,
  PatternKind,
  PropObject,
  SnapMode,
} from '@/model/types';
import { useT } from '@/i18n/useT';
import type { StringKey } from '@/i18n';
import { ColorField, NumberField, RangeField, Row, Section, Select, Slider, Toggle } from './controls';

type ShapeObj = Extract<MapObject, { kind: 'shape' }>;
type TextObj = Extract<MapObject, { kind: 'text' }>;

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------------------

export function MapSettings() {
  const { t } = useT();
  const doc = useEditor((s) => s.doc);
  const rev = useEditor((s) => s.rev);
  const exec = useEditor((s) => s.exec);

  const [cols, setCols] = useState(doc.size.cols);
  const [rows, setRows] = useState(doc.size.rows);
  const [anchor, setAnchor] = useState<ResizeAnchor>('top-left');

  // Nach Undo/Redo sollen die Felder wieder zur Karte passen.
  const [syncedRev, setSyncedRev] = useState(rev);
  if (syncedRev !== rev && (cols !== doc.size.cols || rows !== doc.size.rows)) {
    setSyncedRev(rev);
    setCols(doc.size.cols);
    setRows(doc.size.rows);
  }

  const dirty = cols !== doc.size.cols || rows !== doc.size.rows;

  return (
    <Section title={t('map.title')}>
      <NumberField label={t('map.cols')} value={cols} min={1} max={400} onChange={setCols} />
      <NumberField label={t('map.rows')} value={rows} min={1} max={400} onChange={setRows} />
      <Row label={t('map.anchor')}>
        <AnchorPicker value={anchor} onChange={setAnchor} />
      </Row>
      <button disabled={!dirty} onClick={() => exec(new ResizeMap(cols, rows, anchor))}>
        {t('map.applySize')}
      </button>
      <ColorField
        label={t('map.background')}
        value={doc.background}
        onChange={(v) => exec(new SetBackground(v))}
      />
      <p className="hint">
        {t('map.sizeHint', {
          cols: doc.size.cols,
          rows: doc.size.rows,
          w: Math.round(doc.size.cols * doc.grid.tileSize),
          h: Math.round(doc.size.rows * doc.grid.tileSize),
          tile: doc.grid.tileSize,
        })}
      </p>
    </Section>
  );
}

/**
 * Wie die offene Karte über einer anderen derselben Datei liegt
 * (`model/mappe.ts`). Erscheint erst, wenn die Datei mehrere Karten hat.
 */
export function EbenenSettings() {
  const { t } = useT();
  const doc = useEditor((s) => s.doc);
  const karten = useEditor((s) => s.karten);
  const rev = useEditor((s) => s.rev);
  const exec = useEditor((s) => s.exec);
  const deckkraft = useEditor((s) => s.unterlageDeckkraft);
  const setDeckkraft = useEditor((s) => s.setUnterlageDeckkraft);
  void rev;
  if (karten.length < 2) return null;

  return (
    <Section title={t('ebene.title')}>
      <Select<string>
        label={t('ebene.liegtUeber')}
        value={doc.ebene?.liegtUeber ?? ''}
        options={[
          { value: '', label: t('ebene.keine') },
          ...moeglicheUnterlagen(karten, doc)
            .filter((k) => k.meta.id)
            .map((k) => ({ value: k.meta.id!, label: k.meta.name })),
        ]}
        onChange={(v) => exec(new SetEbene({ liegtUeber: v || undefined }))}
      />
      <Toggle
        label={t('ebene.transparent')}
        checked={!!doc.ebene?.bodenTransparent}
        onChange={(v) => exec(new SetEbene({ bodenTransparent: v }))}
      />
      {doc.ebene?.liegtUeber ? (
        <Slider label={t('ebene.deckkraft')} min={0} max={1} step={0.05} value={deckkraft} onChange={setDeckkraft} />
      ) : null}
      <p className="hint">{t('ebene.hinweis')}</p>
    </Section>
  );
}

/** Neun Felder — bestimmt, an welcher Kante beim Ändern angebaut wird. */
function AnchorPicker({
  value,
  onChange,
}: {
  value: ResizeAnchor;
  onChange: (v: ResizeAnchor) => void;
}) {
  const cells: ResizeAnchor[] = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right',
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 22px)', gap: 2 }}>
      {cells.map((c) => (
        <button
          key={c}
          className={`icon${value === c ? ' active' : ''}`}
          style={{ padding: 0, height: 22, minWidth: 22 }}
          title={c}
          onClick={() => onChange(c)}
        >
          ·
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function GridSettings() {
  const { t } = useT();
  const doc = useEditor((s) => s.doc);
  const exec = useEditor((s) => s.exec);
  const g = doc.grid;
  const abstand = gridDistance(g);
  const setStatus = useEditor((s) => s.setStatusMessage);
  const rulers = useEditor((s) => s.rulers);
  const setRulers = useEditor((s) => s.setRulers);
  const rev = useEditor((s) => s.rev);
  void rev;
  const hilfslinien = guidesOf(doc);

  const patch = (p: Partial<GridSettingsType>, label = t('grid.title'), key?: string) =>
    exec(new PatchGrid(p, label, key));


  /**
   * Setzt die Leiste in die linke untere Ecke der Karte.
   *
   * Dorthin, wo auf einer gedruckten Karte der Maßstab steht — und nicht unter
   * den Zeiger: der Knopf sitzt im Panel, der Zeiger also nicht auf der Karte.
   * Verschieben lässt sie sich danach wie jedes andere Objekt.
   */
  const setzeMassstab = () => {
    const layerId = defaultTargetLayer(doc);
    if (!layerId) {
      setStatus(t('status.layerLocked'));
      return;
    }
    const flaeche = mapPixelSize(doc.grid, doc.size);
    // Höhe nach der Kartenbreite, nicht nach der Feldgröße: eine Weltkarte hat
    // dieselben 100-px-Felder wie eine Taverne, ist aber zwanzigmal so breit —
    // eine Leiste in Feldhöhe wäre dort ein Strich mit unlesbaren Zahlen.
    const hoehe = Math.max(8, flaeche.width * 0.012);
    const dunkel = isDark(doc.background);
    const bar = buildScaleBar(doc, {
      layerId,
      x: doc.grid.tileSize * 0.5,
      y: flaeche.height - doc.grid.tileSize * 0.7,
      // Ein knappes Viertel der Kartenbreite: lang genug zum Ablesen, kurz
      // genug, um nicht quer über die Karte zu laufen.
      targetWidth: flaeche.width * 0.22,
      height: hoehe,
      // Nach dem Kartenhintergrund: auf Pergament dunkle Zahlen, auf einer
      // nächtlichen Battlemap helle. Ohne das steht die Leiste manchmal
      // unsichtbar auf der Karte, und niemand sucht dort nach ihr.
      color: dunkel ? 0xf2e8d5 : 0x1c1a17,
      backgroundColor: dunkel ? 0x1c1a17 : 0xf2e8d5,
      fontFamily: 'Georgia, serif',
    });
    exec(new AddObjects(bar.objects, t('grid.addScaleBar')));
    setStatus(t('grid.scaleBarAdded', { distance: bar.distance, unit: abstand.unit }));
  };

  return (
    <Section title={t('grid.title')}>
      <Select<GridType>
        label={t('grid.type')}
        value={g.type}
        options={[
          { value: 'square', label: t('grid.square') },
          { value: 'hexPointy', label: t('grid.hexPointy') },
          { value: 'hexFlat', label: t('grid.hexFlat') },
        ]}
        onChange={(v) => patch({ type: v }, t('grid.type'))}
      />
      <NumberField
        label={t('grid.tileSize')}
        value={g.tileSize}
        min={8}
        max={400}
        onChange={(v) => patch({ tileSize: v }, t('grid.tileSize'))}
      />
      <Toggle label={t('grid.visible')} checked={g.visible} onChange={(v) => patch({ visible: v })} />
      <Slider
        label={t('grid.opacity')}
        min={0}
        max={1}
        step={0.01}
        value={g.opacity}
        onChange={(v) => patch({ opacity: v }, t('grid.opacity'), 'grid-op')}
        format={pct}
      />
      <ColorField label={t('grid.color')} value={g.color} onChange={(v) => patch({ color: v })} />
      <Slider
        label={t('grid.lineWidth')}
        min={0.5}
        max={6}
        step={0.5}
        value={g.lineWidth}
        onChange={(v) => patch({ lineWidth: v }, t('grid.lineWidth'), 'grid-lw')}
      />
      <NumberField
        label={t('grid.offsetX')}
        value={g.offsetX}
        onChange={(v) => patch({ offsetX: v })}
      />
      <NumberField
        label={t('grid.offsetY')}
        value={g.offsetY}
        onChange={(v) => patch({ offsetY: v })}
      />
      <Select<SnapMode>
        label={t('grid.snap')}
        value={g.snap}
        options={[
          { value: 'none', label: t('grid.snapOff') },
          { value: 'tile', label: t('grid.snapTile') },
          { value: 'half', label: t('grid.snapHalf') },
          { value: 'quarter', label: t('grid.snapQuarter') },
          { value: 'corner', label: t('grid.snapCorner') },
        ]}
        onChange={(v) => patch({ snap: v }, t('grid.snap'))}
      />
      <div className="divider" />
      <Toggle label={t('guides.show')} checked={rulers} onChange={setRulers} />
      <p className="hint">{t('guides.showHint')}</p>
      {hilfslinien.length > 0 ? (
        <div className="row-inline">
          <span className="value">{t('guides.count', { n: hilfslinien.length })}</span>
          <button
            onClick={() => exec(new SetGuides([], t('guides.clear')))}
            title={t('guides.clearHint')}
          >
            {t('guides.clear')}
          </button>
        </div>
      ) : null}
      <div className="divider" />

      <NumberField
        label={t('grid.rotationSnap')}
        value={g.rotationSnapDeg}
        min={0}
        max={90}
        step={5}
        onChange={(v) => patch({ rotationSnapDeg: v })}
      />
      <p className="hint">{t('grid.ctrlHint')}</p>

      {/*
        Der Maßstab steht beim Raster, weil ein Feld die Einheit *ist*, in der
        auf einer Karte gerechnet wird. Messwerkzeug und Maßstabsleiste ziehen
        ihre Zahlen von hier — sonst müsste man dieselbe Angabe zweimal
        pflegen und hätte über kurz oder lang zwei verschiedene.
      */}
      <NumberField
        label={t('grid.perTile')}
        value={abstand.perTile}
        min={0.01}
        max={10000}
        step={0.5}
        onChange={(v) => patch({ distance: { ...abstand, perTile: v } }, t('grid.distanceTitle'))}
      />
      <Row label={t('grid.unit')}>
        <input
          type="text"
          value={abstand.unit}
          maxLength={6}
          onChange={(e) =>
            patch({ distance: { ...abstand, unit: e.target.value } }, t('grid.distanceTitle'), 'grid-unit')
          }
        />
      </Row>
      {g.type === 'square' ? (
        <Select<GridMetric>
          label={t('grid.metric')}
          value={abstand.metric}
          options={[
            { value: 'chebyshev', label: t('metric.chebyshev') },
            { value: 'alternating', label: t('metric.alternating') },
            { value: 'euclidean', label: t('metric.euclidean') },
            { value: 'manhattan', label: t('metric.manhattan') },
          ]}
          onChange={(v) => patch({ distance: { ...abstand, metric: v } }, t('grid.metric'))}
        />
      ) : (
        <p className="hint">{t('grid.metricHexHint')}</p>
      )}

      {/*
        Der Knopf steht hier und nicht bei den Props: die Leiste rechnet mit
        genau den Angaben darüber, und wer sie ändert, sieht hier gleich, wie
        man das Ergebnis auf die Karte bekommt. Die gezeichnete
        Kartensignatur „Maßstabsleiste" bleibt daneben bestehen — sie ist
        Zierrat ohne Zahlen, und manchmal ist genau das gewollt.
      */}
      <button onClick={setzeMassstab}>{t('grid.addScaleBar')}</button>
      <p className="hint">{t('grid.addScaleBarHint')}</p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

/** Terrain-Pinsel: Bodenflächen malen. */
export function TerrainSettingsPanel() {
  const { t } = useT();
  const vorgabe = useEditor((s) => s.terrain);
  const patchVorgabe = useEditor((s) => s.patchTerrain);
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const exec = useEditor((s) => s.exec);
  const rev = useEditor((s) => s.rev);
  void rev;
  // Terrainflächen: gefüllte, ungestrichene Polygone (so legt der Pinsel sie an).
  const flaechen = selection
    .map((id) => doc.objects[id])
    .filter((o): o is ShapeObj => !!o && o.kind === 'shape' && o.shape === 'polygon' && !!o.fill && (!o.stroke || istWasser(o.fill)));
  const f0 = flaechen[0];
  const terrain = f0?.fill ? { ...vorgabe, color: f0.fill.color, alpha: f0.fill.alpha } : vorgabe;
  /** Farbe und Deckkraft wirken auch auf die Auswahl; Breite und Glättung stecken in der Form. */
  const patch = (p: Partial<typeof vorgabe>) => {
    patchVorgabe(p);
    if (flaechen.length === 0 || (p.color === undefined && p.alpha === undefined)) return;
    exec(
      new PatchObjects(
        new Map(
          flaechen.map((o) => [
            o.id,
            { fill: { ...o.fill!, ...(p.color !== undefined ? { color: p.color } : {}), ...(p.alpha !== undefined ? { alpha: p.alpha } : {}) } },
          ]),
        ),
        t('cmd.terrain'),
        `terrain-panel:${Object.keys(p).join(',')}`,
      ),
    );
  };

  return (
    <Section title={t('terrain.title')}>
      <Toggle
        label={t('terrain.water')}
        checked={!!vorgabe.water}
        onChange={(v) =>
          // Beim Umschalten auf Wasser die Bodenfarbe gegen Wasserblau
          // tauschen; eine selbst gewählte Farbe bleibt.
          patchVorgabe({
            water: v,
            ...(v && vorgabe.color === defaultTerrain().color ? { color: WASSER_FARBE } : {}),
            ...(!v && vorgabe.color === WASSER_FARBE ? { color: defaultTerrain().color } : {}),
          })
        }
      />
      <ColorField label={t('terrain.color')} value={terrain.color} onChange={(v) => patch({ color: v })} />
      <Slider
        label={t('terrain.width')}
        min={10}
        max={600}
        step={5}
        value={terrain.width}
        onChange={(v) => patch({ width: v })}
        format={(v) => `${Math.round(v)} px`}
      />
      <Slider
        label={t('terrain.opacity')}
        min={0.05}
        max={1}
        step={0.01}
        value={terrain.alpha}
        onChange={(v) => patch({ alpha: v })}
        format={pct}
      />
      <Slider
        label={t('terrain.smoothing')}
        min={0}
        max={1}
        step={0.05}
        value={terrain.smoothing}
        onChange={(v) => patch({ smoothing: v })}
        format={pct}
      />
      {flaechen.length > 0 ? <p className="hint">{t('terrain.selectionHint')}</p> : null}
      <p className="hint">{t(vorgabe.water ? 'terrain.waterHint' : 'terrain.hint')}</p>
    </Section>
  );
}

/** Platzierung einzelner Props. */
/** Reiserouten: Tagesmarsch, Marken, Strich. */
export function RouteSettingsPanel() {
  const { t } = useT();
  const route = useEditor((s) => s.route);
  const patch = useEditor((s) => s.patchRoute);
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const exec = useEditor((s) => s.exec);
  const rev = useEditor((s) => s.rev);
  void rev;
  const einheit = doc.grid.distance?.unit ?? 'm';

  const selected = selection
    .map((id) => doc.objects[id])
    .filter((o): o is ShapeObj => !!o && o.kind === 'shape' && !!o.route);

  /**
   * Übernimmt eine Änderung als neue Vorgabe **und** auf die ausgewählten
   * Routen.
   *
   * Ohne den zweiten Teil verstellt man den Tagesmarsch einer gerade gezogenen
   * Route und nichts passiert — die Einstellung gälte erst für die nächste.
   * Genau dieselbe Falle steckte einmal in den Zeichen- und Texteinstellungen.
   */
  const apply = (
    settingsPatch: Partial<RouteSettings>,
    build: (o: ShapeObj) => Record<string, unknown>,
    label: string,
    mergeKey?: string,
  ) => {
    patch(settingsPatch);
    if (selected.length === 0) return;
    const map = new Map<string, Record<string, unknown>>();
    for (const o of selected) map.set(o.id, build(o));
    exec(new PatchObjects(map, label, mergeKey));
  };

  /**
   * Angezeigt wird, was die Auswahl sagt — sonst die Vorgabe.
   *
   * Sonst stünde beim Anklicken einer Route der Wert des Werkzeugs im Regler
   * und nicht der der Route, und der erste Griff daran verstellte sie
   * unbeabsichtigt.
   */
  const current = selected[0];
  const perDay = current?.route?.perDay ?? route.perDay;
  const marks = current?.route?.marks ?? route.marks;
  const color = current?.stroke?.color ?? route.color;
  const width = current?.stroke?.width ?? route.width;

  return (
    <Section title={t('route.title')}>
      <Slider
        label={t('route.perDay')}
        min={1}
        max={200}
        step={1}
        value={perDay}
        onChange={(v) =>
          apply(
            { perDay: v },
            (o) => ({ route: { ...(o.route ?? { marks: true }), perDay: v } }),
            t('route.perDay'),
            'route-day',
          )
        }
        format={(v) => `${v} ${einheit}`}
      />
      <Toggle
        label={t('route.marks')}
        checked={marks}
        onChange={(v) =>
          apply(
            { marks: v },
            (o) => ({ route: { ...(o.route ?? { perDay: route.perDay }), marks: v } }),
            t('route.marks'),
          )
        }
      />
      <ColorField
        label={t('route.color')}
        value={color}
        onChange={(v) =>
          apply(
            { color: v },
            (o) => ({ stroke: o.stroke ? { ...o.stroke, color: v } : null }),
            t('route.color'),
            'route-color',
          )
        }
      />
      <Slider
        label={t('route.width')}
        min={1}
        max={20}
        step={1}
        value={width}
        onChange={(v) =>
          apply(
            { width: v },
            (o) => ({ stroke: o.stroke ? { ...o.stroke, width: v } : null }),
            t('route.width'),
            'route-width',
          )
        }
      />
      <p className="hint">{t('route.hint')}</p>
    </Section>
  );
}

/**
 * Symmetrie und Kacheln.
 *
 * Eigener Bereich statt eines Schalters in jedem Werkzeug: es gilt für alle,
 * die Objekte anlegen, und wäre viermal derselbe Kasten.
 */
export function SymmetryPanel() {
  const { t } = useT();
  const sym = useEditor((s) => s.symmetry);
  const patch = useEditor((s) => s.patchSymmetry);
  const doc = useEditor((s) => s.doc);
  const rev = useEditor((s) => s.rev);
  void rev;

  const linien = guidesOf(doc);
  const senkrecht = linien.find((g) => g.axis === 'x');
  const waagerecht = linien.find((g) => g.axis === 'y');
  const eigeneAchse = sym.axisX !== null || sym.axisY !== null;

  return (
    <Section title={t('sym.title')}>
      <Toggle
        label={t('sym.vertical')}
        checked={sym.vertical}
        onChange={(v) => patch({ vertical: v })}
      />
      <Toggle
        label={t('sym.horizontal')}
        checked={sym.horizontal}
        onChange={(v) => patch({ horizontal: v })}
      />
      <Row label={t('sym.axis')}>
        <span className="value">
          {eigeneAchse
            ? `${sym.axisX !== null ? Math.round(sym.axisX / doc.grid.tileSize) : '—'} / ${
                sym.axisY !== null ? Math.round(sym.axisY / doc.grid.tileSize) : '—'
              }`
            : t('sym.axisCenter')}
        </span>
      </Row>
      <div className="row-inline">
        <button
          disabled={!senkrecht && !waagerecht}
          onClick={() => patch({ axisX: senkrecht?.pos ?? null, axisY: waagerecht?.pos ?? null })}
          title={t('sym.axisFromGuidesHint')}
        >
          {t('sym.axisFromGuides')}
        </button>
        {eigeneAchse ? (
          <button onClick={() => patch({ axisX: null, axisY: null })}>{t('sym.axisCenter')}</button>
        ) : null}
      </div>
      {!senkrecht && !waagerecht ? <p className="hint">{t('sym.axisNone')}</p> : null}

      <div className="divider" />
      <Toggle label={t('sym.tile')} checked={sym.tile} onChange={(v) => patch({ tile: v })} />
      <p className="hint">{t('sym.tileHint')}</p>
      <p className="hint">{t('sym.hint')}</p>
    </Section>
  );
}

/** Radiergummi: nur die Größe — was radiert wird, entscheidet der Zeiger. */
export function EraseSettingsPanel() {
  const { t } = useT();
  const erase = useEditor((s) => s.erase);
  const patch = useEditor((s) => s.patchErase);

  return (
    <Section title={t('erase.title')}>
      <Slider
        label={t('erase.radius')}
        min={4}
        max={200}
        step={1}
        value={erase.radius}
        onChange={(v) => patch({ radius: v })}
        format={(v) => `${v} px`}
      />
      <p className="hint">{t('erase.hint')}</p>
    </Section>
  );
}

export function PropSettingsPanel() {
  const { t } = useT();
  const prop = useEditor((s) => s.prop);
  const patch = useEditor((s) => s.patchProp);
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);

  // „Aus Auswahl übernehmen" braucht genau ein ausgewähltes Prop — bei
  // mehreren wäre nicht bestimmt, welches gemeint ist.
  const vorlage =
    selection.length === 1 && doc.objects[selection[0]]?.kind === 'prop'
      ? (doc.objects[selection[0]] as PropObject)
      : null;

  return (
    <Section title={t('propTool.title')}>
      <Toggle
        label={t('propTool.randomRotation')}
        checked={prop.randomRotation}
        onChange={(v) => patch({ randomRotation: v })}
      />
      <p className="hint">{t('propTool.hint')}</p>

      <p className="subhead">{t('propTool.defaults')}</p>
      <Row>
        <div className="chips fill">
          <button
            disabled={!vorlage}
            title={t('propTool.fromSelectionHint')}
            onClick={() =>
              vorlage &&
              patch({
                scale: vorlage.scaleX,
                tint: vorlage.tint,
                opacity: vorlage.opacity,
                flipX: vorlage.flipX,
                flipY: vorlage.flipY,
              })
            }
          >
            {t('propTool.fromSelection')}
          </button>
          <button
            onClick={() =>
              patch({ scale: 1, tint: null, opacity: 1, flipX: false, flipY: false })
            }
          >
            {t('propTool.reset')}
          </button>
        </div>
      </Row>
      <Slider
        label={t('sel.size')}
        min={0.05}
        max={6}
        step={0.05}
        value={prop.scale}
        onChange={(v) => patch({ scale: v })}
        format={pct}
      />
      <ColorField
        label={t('sel.color')}
        value={prop.tint}
        allowNone
        onChange={(v) => patch({ tint: v })}
        onNone={() => patch({ tint: null })}
      />
      <Slider
        label={t('sel.opacity')}
        min={0}
        max={1}
        step={0.01}
        value={prop.opacity}
        onChange={(v) => patch({ opacity: v })}
        format={pct}
      />
      <Row label={t('sel.mirror')}>
        <div className="row-inline">
          <button
            className={prop.flipX ? 'active' : ''}
            onClick={() => patch({ flipX: !prop.flipX })}
          >
            ↔
          </button>
          <button
            className={prop.flipY ? 'active' : ''}
            onClick={() => patch({ flipY: !prop.flipY })}
          >
            ↕
          </button>
        </div>
      </Row>
      <p className="hint">{t('propTool.defaultsHint')}</p>
      <p className="hint">{t('propTool.grabHint')}</p>
    </Section>
  );
}

export function ObjectInspector() {
  const { t } = useT();
  const doc = useEditor((s) => s.doc);
  const rev = useEditor((s) => s.rev);
  const selection = useEditor((s) => s.selection);
  const exec = useEditor((s) => s.exec);
  void rev;

  const objects = selection.map((id) => doc.objects[id]).filter(Boolean) as MapObject[];
  if (objects.length === 0) {
    return (
      <Section title={t('sel.title')}>
        <div className="empty">{t('sel.empty')}</div>
      </Section>
    );
  }

  const first = objects[0];
  const patchAll = (p: Record<string, unknown>, label: string, key?: string) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const o of objects) map.set(o.id, p);
    exec(new PatchObjects(map, label, key));
  };
  /** Ändert das Licht aller ausgewählten leuchtenden Props, jedes vom eigenen Stand aus. */
  const patchLicht = (p: Partial<PropLight>, key?: string) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const o of objects) {
      if (o.kind === 'prop' && o.light) map.set(o.id, { light: { ...o.light, ...p } });
    }
    if (map.size > 0) exec(new PatchObjects(map, t('sel.propLight'), key));
  };
  /** Alle ausgewählten Props derselben Art eine Variante weiter oder zurück. */
  const wechsleVariante = (schritt: number) => {
    if (first.kind !== 'prop') return;
    const ziel = variantFor(first.propId, first.seed) + schritt;
    const map = new Map<string, Record<string, unknown>>();
    for (const o of objects) {
      if (o.kind !== 'prop' || o.propId !== first.propId) continue;
      map.set(o.id, { seed: seedFuerVariante(o.propId, o.seed, ziel) });
    }
    if (map.size > 0) exec(new PatchObjects(map, t('sel.variant')));
  };
  const shiftBy = (axis: 'x' | 'y', target: number) => {
    const delta = target - first[axis];
    const map = new Map<string, Record<string, unknown>>();
    for (const o of objects) map.set(o.id, { [axis]: o[axis] + delta });
    exec(new PatchObjects(map, 'XY'));
  };

  /**
   * Ausrichten und Verteilen.
   *
   * Gerechnet wird über die Hüllen, nicht über die Ankerpunkte — bei einer
   * Zeichnung liegt der Ursprung dort, wo der Strich begann. Die Textmaße
   * kommen vom Renderer, weil das Modell sie nicht kennen kann.
   */
  const arrange = (fn: (items: AlignItem[]) => Deltas, label: string) => {
    const metrics = getRenderer()?.textMetrics;
    const items: AlignItem[] = objects.map((o) => ({
      id: o.id,
      bounds: worldAABB(doc, o, metrics),
    }));
    const deltas = fn(items);
    if (deltas.size === 0) return;
    const map = new Map<string, Record<string, unknown>>();
    for (const [id, d] of deltas) {
      const o = doc.objects[id];
      if (o) map.set(id, { x: o.x + d.dx, y: o.y + d.dy });
    }
    exec(new PatchObjects(map, label));
  };

  return (
    <Section title={t('sel.titleCount', { count: objects.length })}>
      {objects.length > 1 || objects.some((o) => o.groupId) ? (
        <Row label={t('sel.group')}>
          <div className="chips">
            {objects.length > 1 ? (
              <button
                onClick={() =>
                  exec(
                    new SetObjectGroup(
                      objects.map((o) => o.id),
                      makeId('grp'),
                      t('cmd.groupObjects'),
                    ),
                  )
                }
              >
                {t('sel.groupButton')}
              </button>
            ) : null}
            {objects.some((o) => o.groupId) ? (
              <button
                onClick={() =>
                  exec(
                    new SetObjectGroup(
                      objects.map((o) => o.id),
                      null,
                      t('cmd.ungroupObjects'),
                    ),
                  )
                }
              >
                {t('sel.ungroupButton')}
              </button>
            ) : null}
          </div>
        </Row>
      ) : null}
      {objects.length > 1 ? (
        <>
          <Row label={t('sel.align')}>
            <div className="chips">
              <button title={t('sel.alignLeft')} onClick={() => arrange((i) => align(i, 'left'), t('sel.align'))}>⇤</button>
              <button title={t('sel.alignCenterX')} onClick={() => arrange((i) => align(i, 'centerX'), t('sel.align'))}>↔</button>
              <button title={t('sel.alignRight')} onClick={() => arrange((i) => align(i, 'right'), t('sel.align'))}>⇥</button>
              <button title={t('sel.alignTop')} onClick={() => arrange((i) => align(i, 'top'), t('sel.align'))}>⇡</button>
              <button title={t('sel.alignCenterY')} onClick={() => arrange((i) => align(i, 'centerY'), t('sel.align'))}>↕</button>
              <button title={t('sel.alignBottom')} onClick={() => arrange((i) => align(i, 'bottom'), t('sel.align'))}>⇣</button>
            </div>
          </Row>
          {objects.length > 2 ? (
            <Row label={t('sel.distribute')}>
              <div className="chips">
                <button title={t('sel.distributeH')} onClick={() => arrange((i) => distribute(i, 'horizontal'), t('sel.distribute'))}>⇹</button>
                <button title={t('sel.distributeV')} onClick={() => arrange((i) => distribute(i, 'vertical'), t('sel.distribute'))}>⇳</button>
              </div>
            </Row>
          ) : null}
        </>
      ) : null}
      <NumberField label="X" value={Math.round(first.x)} onChange={(v) => shiftBy('x', v)} />
      <NumberField label="Y" value={Math.round(first.y)} onChange={(v) => shiftBy('y', v)} />
      <Slider
        label={t('sel.rotation')}
        min={-180}
        max={180}
        step={1}
        value={Math.round((first.rotation * 180) / Math.PI)}
        onChange={(v) => patchAll({ rotation: (v * Math.PI) / 180 }, t('sel.rotation'), 'rot')}
        format={(v) => `${v}°`}
      />
      <Slider
        label={t('sel.opacity')}
        min={0}
        max={1}
        step={0.01}
        value={first.opacity}
        onChange={(v) => patchAll({ opacity: v }, t('sel.opacity'), 'obj-op')}
        format={pct}
      />

      {first.kind === 'prop' ? (
        <>
          <Slider
            label={t('sel.size')}
            min={0.05}
            max={6}
            step={0.05}
            value={first.scaleX}
            onChange={(v) => patchAll({ scaleX: v, scaleY: v }, t('sel.size'), 'scale')}
            format={pct}
          />
          <ColorField
            label={t('sel.color')}
            value={first.tint}
            allowNone
            onChange={(v) => patchAll({ tint: v }, t('sel.color'))}
            onNone={() => patchAll({ tint: null }, t('sel.color'))}
          />
          <Row label={t('sel.mirror')}>
            <div className="row-inline">
              <button onClick={() => patchAll({ flipX: !first.flipX }, t('sel.mirror'))}>↔</button>
              <button onClick={() => patchAll({ flipY: !first.flipY }, t('sel.mirror'))}>↕</button>
            </div>
          </Row>
          {/*
            Variante wählen: bei Gebäuden der Grundriss, bei Steinen und
            Bäumen die Form. Wirkt auf alle ausgewählten Props derselben Art.
          */}
          {(getProp(first.propId)?.variants ?? 1) > 1 ? (
            <Row label={t('sel.variant')}>
              <div className="row-inline">
                <button
                  aria-label={t('sel.variantPrev')}
                  onClick={() => wechsleVariante(-1)}
                >
                  ◀
                </button>
                <span className="variante">
                  {variantFor(first.propId, first.seed) + 1} / {getProp(first.propId)?.variants}
                </span>
                <button
                  aria-label={t('sel.variantNext')}
                  onClick={() => wechsleVariante(1)}
                >
                  ▶
                </button>
              </div>
            </Row>
          ) : null}
          {/* Licht als Teil des Props (model/propLights.ts): hier und nur hier bearbeitet. */}
          <Toggle
            label={t('sel.propLight')}
            checked={!!first.light}
            onChange={(v) => {
              const map = new Map<string, Record<string, unknown>>();
              for (const o of objects) {
                if (o.kind !== 'prop') continue;
                map.set(o.id, { light: v ? (o.light ?? lichtFuerProp(o.propId) ?? { range: 4, color: 0xffcc88, intensity: 1 }) : null });
              }
              exec(new PatchObjects(map, t('sel.propLight')));
            }}
          />
          {first.light ? (
            <>
              <Slider
                label={t('light.range')}
                min={0.5}
                max={30}
                step={0.5}
                value={first.light.range}
                onChange={(v) => patchLicht({ range: v }, 'prop-licht-range')}
                format={(v) => (v === 1 ? t('light.rangeUnitOne') : t('light.rangeUnit', { n: v }))}
              />
              <ColorField label={t('light.color')} value={first.light.color} onChange={(v) => patchLicht({ color: v })} />
              <Slider
                label={t('light.intensity')}
                min={0}
                max={4}
                step={0.05}
                value={first.light.intensity}
                onChange={(v) => patchLicht({ intensity: v }, 'prop-licht-int')}
              />
            </>
          ) : null}
        </>
      ) : null}

      <Toggle
        label={t('sel.locked')}
        checked={first.locked}
        onChange={(v) => patchAll({ locked: v }, t('sel.locked'))}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function DrawSettingsPanel() {
  const { t } = useT();
  const draw = useEditor((s) => s.draw);
  const patch = useEditor((s) => s.patchDraw);
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);
  const exec = useEditor((s) => s.exec);
  const rev = useEditor((s) => s.rev);
  void rev;

  const selected = selection
    .map((id) => doc.objects[id])
    .filter((o): o is ShapeObj => !!o && o.kind === 'shape');

  /**
   * Übernimmt eine Änderung als neue Vorgabe **und** auf die Auswahl.
   *
   * Ohne den zweiten Teil ändert man die Farbe einer gerade gezeichneten Form
   * und nichts passiert — die Einstellung gälte erst für die nächste.
   */
  const apply = (
    settingsPatch: Partial<DrawSettings>,
    build: (o: ShapeObj) => Record<string, unknown>,
    label: string,
    mergeKey?: string,
  ) => {
    patch(settingsPatch);
    if (selected.length === 0) return;
    const map = new Map<string, Record<string, unknown>>();
    for (const o of selected) map.set(o.id, build(o));
    exec(new PatchObjects(map, label, mergeKey));
  };

  // Angezeigt wird, was die Auswahl tatsächlich hat — sonst stehen im Panel
  // andere Werte als auf der Karte.
  const first = selected[0];
  const view = {
    strokeColor: first?.stroke?.color ?? draw.strokeColor,
    strokeWidth: first?.stroke?.width ?? draw.strokeWidth,
    strokeAlpha: first?.stroke?.alpha ?? draw.strokeAlpha,
    fillColor: first?.fill?.color ?? draw.fillColor,
    fillAlpha: first?.fill?.alpha ?? draw.fillAlpha,
    useStroke: first ? !!first.stroke : draw.useStroke,
    useFill: first ? !!first.fill : draw.useFill,
    blend: first?.blend ?? draw.blend,
    gradient: first?.fill ? !!first.fill.gradient : draw.fillGradient,
    fillColor2: first?.fill?.gradient?.color ?? draw.fillColor2,
    fillAngle: first?.fill?.gradient?.angle ?? draw.fillAngle,
    gradientType: first?.fill?.gradient?.type ?? draw.fillGradientType,
    pattern: first?.fill ? !!first.fill.pattern : draw.fillPattern,
    patternKind: first?.fill?.pattern?.kind ?? draw.patternKind,
    patternSize: first?.fill?.pattern?.size ?? draw.patternSize,
    patternColor: first?.fill?.pattern?.color ?? draw.patternColor,
    patternAlpha: first?.fill?.pattern?.alpha ?? draw.patternAlpha,
    patternAngle: first?.fill?.pattern?.angle ?? draw.patternAngle,
  };

  const strokeOf = (o: ShapeObj, over: Record<string, unknown>) => ({
    stroke: {
      color: draw.strokeColor,
      width: draw.strokeWidth,
      alpha: draw.strokeAlpha,
      dash: draw.dash,
      ...o.stroke,
      ...over,
    },
  });
  const fillOf = (o: ShapeObj, over: Record<string, unknown>) => ({
    fill: { color: draw.fillColor, alpha: draw.fillAlpha, ...o.fill, ...over },
  });
  /** Vorhandener Verlauf der Form, sonst die Werte aus dem Panel. */
  const gradientOf = (o: ShapeObj) =>
    o.fill?.gradient ?? {
      color: draw.fillColor2,
      angle: draw.fillAngle,
      type: draw.fillGradientType,
    };
  /** Vorhandenes Muster der Form, sonst die Werte aus dem Panel. */
  const patternOf = (o: ShapeObj) =>
    o.fill?.pattern ?? {
      kind: draw.patternKind,
      size: draw.patternSize,
      color: draw.patternColor,
      alpha: draw.patternAlpha,
      angle: draw.patternAngle,
    };

  return (
    <Section title={t('draw.title')}>
      <Select
        label={t('draw.shape')}
        value={draw.shape}
        options={[
          { value: 'freehand', label: t('draw.freehand') },
          { value: 'line', label: t('draw.line') },
          { value: 'rect', label: t('draw.rect') },
          { value: 'ellipse', label: t('draw.ellipse') },
          { value: 'polygon', label: t('draw.polygon') },
        ]}
        onChange={(v) => patch({ shape: v })}
      />

      <Toggle
        label={t('draw.stroke')}
        checked={view.useStroke}
        onChange={(v) =>
          apply({ useStroke: v }, (o) => (v ? strokeOf(o, {}) : { stroke: null }), t('draw.stroke'))
        }
      />
      {view.useStroke ? (
        <>
          <ColorField
            label={t('draw.strokeColor')}
            value={view.strokeColor}
            onChange={(v) =>
              apply({ strokeColor: v }, (o) => strokeOf(o, { color: v }), t('draw.strokeColor'))
            }
          />
          <Slider
            label={t('draw.width')}
            min={0.5}
            max={80}
            step={0.5}
            value={view.strokeWidth}
            onChange={(v) =>
              apply({ strokeWidth: v }, (o) => strokeOf(o, { width: v }), t('draw.width'), 'sw')
            }
          />
          <Slider
            label={t('draw.opacity')}
            min={0}
            max={1}
            step={0.01}
            value={view.strokeAlpha}
            onChange={(v) =>
              apply({ strokeAlpha: v }, (o) => strokeOf(o, { alpha: v }), t('draw.opacity'), 'sa')
            }
            format={pct}
          />
        </>
      ) : null}

      <Toggle
        label={t('draw.fill')}
        checked={view.useFill}
        onChange={(v) =>
          apply({ useFill: v }, (o) => (v ? fillOf(o, {}) : { fill: null }), t('draw.fill'))
        }
      />
      {view.useFill ? (
        <>
          <ColorField
            label={t('draw.fillColor')}
            value={view.fillColor}
            onChange={(v) =>
              apply({ fillColor: v }, (o) => fillOf(o, { color: v }), t('draw.fillColor'))
            }
          />
          <Slider
            label={t('draw.opacity')}
            min={0}
            max={1}
            step={0.01}
            value={view.fillAlpha}
            onChange={(v) =>
              apply({ fillAlpha: v }, (o) => fillOf(o, { alpha: v }), t('draw.opacity'), 'fa')
            }
            format={pct}
          />
          <Toggle
            label={t('draw.gradient')}
            checked={view.gradient}
            onChange={(v) =>
              apply(
                { fillGradient: v },
                (o) =>
                  fillOf(o, {
                    gradient: v
                      ? {
                          color: view.fillColor2,
                          angle: view.fillAngle,
                          type: view.gradientType,
                        }
                      : null,
                  }),
                t('draw.gradient'),
              )
            }
          />
          {view.gradient ? (
            <>
              <ColorField
                label={t('draw.gradientColor')}
                value={view.fillColor2}
                onChange={(v) =>
                  apply(
                    { fillColor2: v },
                    (o) => fillOf(o, { gradient: { ...gradientOf(o), color: v } }),
                    t('draw.gradientColor'),
                  )
                }
              />
              <Select<'linear' | 'radial'>
                label={t('draw.gradientType')}
                value={view.gradientType}
                options={[
                  { value: 'linear', label: t('draw.gradientLinear') },
                  { value: 'radial', label: t('draw.gradientRadial') },
                ]}
                onChange={(v) =>
                  apply(
                    { fillGradientType: v },
                    (o) => fillOf(o, { gradient: { ...gradientOf(o), type: v } }),
                    t('draw.gradientType'),
                  )
                }
              />
              {view.gradientType === 'linear' ? (
                <Slider
                  label={t('draw.gradientAngle')}
                  min={0}
                  max={360}
                  step={5}
                  value={view.fillAngle}
                  onChange={(v) =>
                    apply(
                      { fillAngle: v },
                      (o) => fillOf(o, { gradient: { ...gradientOf(o), angle: v } }),
                      t('draw.gradientAngle'),
                      'ga',
                    )
                  }
                  format={(v) => `${Math.round(v)}°`}
                />
              ) : null}
            </>
          ) : null}

          <Toggle
            label={t('draw.pattern')}
            checked={view.pattern}
            onChange={(v) =>
              apply(
                { fillPattern: v },
                (o) =>
                  fillOf(o, {
                    pattern: v
                      ? {
                          kind: view.patternKind,
                          size: view.patternSize,
                          color: view.patternColor,
                          alpha: view.patternAlpha,
                          angle: view.patternAngle,
                        }
                      : null,
                  }),
                t('draw.pattern'),
              )
            }
          />
          {view.pattern ? (
            <>
              <Select<PatternKind>
                label={t('draw.patternKind')}
                value={view.patternKind}
                options={PATTERN_KINDS.map((k) => ({
                  value: k,
                  label: t(`pattern.${k}` as StringKey),
                }))}
                onChange={(v) =>
                  apply(
                    { patternKind: v },
                    (o) => fillOf(o, { pattern: { ...patternOf(o), kind: v } }),
                    t('draw.patternKind'),
                  )
                }
              />
              <Slider
                label={t('draw.patternSize')}
                min={10}
                max={400}
                step={5}
                value={view.patternSize}
                onChange={(v) =>
                  apply(
                    { patternSize: v },
                    (o) => fillOf(o, { pattern: { ...patternOf(o), size: v } }),
                    t('draw.patternSize'),
                    'ps',
                  )
                }
                format={(v) => `${Math.round(v)} px`}
              />
              <ColorField
                label={t('draw.patternColor')}
                value={view.patternColor}
                onChange={(v) =>
                  apply(
                    { patternColor: v },
                    (o) => fillOf(o, { pattern: { ...patternOf(o), color: v } }),
                    t('draw.patternColor'),
                  )
                }
              />
              <Slider
                label={t('draw.patternAlpha')}
                min={0}
                max={1}
                step={0.05}
                value={view.patternAlpha}
                onChange={(v) =>
                  apply(
                    { patternAlpha: v },
                    (o) => fillOf(o, { pattern: { ...patternOf(o), alpha: v } }),
                    t('draw.patternAlpha'),
                    'pa',
                  )
                }
                format={pct}
              />
              <Slider
                label={t('draw.patternAngle')}
                min={0}
                max={180}
                step={5}
                value={view.patternAngle}
                onChange={(v) =>
                  apply(
                    { patternAngle: v },
                    (o) => fillOf(o, { pattern: { ...patternOf(o), angle: v } }),
                    t('draw.patternAngle'),
                    'pang',
                  )
                }
                format={(v) => `${Math.round(v)}°`}
              />
            </>
          ) : null}
        </>
      ) : null}

      {draw.shape === 'freehand' && selected.length === 0 ? (
        <Slider
          label={t('draw.smoothing')}
          min={0}
          max={1}
          step={0.05}
          value={draw.smoothing}
          onChange={(v) => patch({ smoothing: v })}
        />
      ) : null}

      <Select
        label={t('draw.blend')}
        value={view.blend}
        options={(['normal', 'multiply', 'screen', 'overlay'] as const).map((mode) => ({
          value: mode,
          label: t(`blend.${mode}` as StringKey),
        }))}
        onChange={(v) => apply({ blend: v }, () => ({ blend: v }), t('draw.blend'))}
      />

      {selected.length > 0 ? (
        <p className="hint">{t('draw.appliesToSelection', { count: selected.length })}</p>
      ) : (
        <p className="hint">
          {draw.shape === 'polygon'
            ? t('draw.polygonHint')
            : draw.shape === 'freehand'
              ? t('draw.freehandHint')
              : t('draw.shapeHint')}
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------

const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet' },
  { value: '"Palatino Linotype", "Book Antiqua", serif', label: 'Palatino' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Impact, sans-serif', label: 'Impact' },
];

export function TextSettingsPanel() {
  const { t } = useT();
  const [fonts, setFonts] = useState(() => importedFonts());
  const [fontError, setFontError] = useState<string | null>(null);
  const text = useEditor((s) => s.text);
  const patch = useEditor((s) => s.patchText);
  const selection = useEditor((s) => s.selection);
  const doc = useEditor((s) => s.doc);
  const exec = useEditor((s) => s.exec);
  const rev = useEditor((s) => s.rev);
  void rev;

  const selected = selection
    .map((id) => doc.objects[id])
    .filter((o): o is TextObj => !!o && o.kind === 'text');

  const apply = (p: Record<string, unknown>, label: string, key?: string) => {
    patch(p as Parameters<typeof patch>[0]);
    if (selected.length === 0) return;
    const map = new Map<string, Record<string, unknown>>();
    for (const o of selected) map.set(o.id, p);
    exec(new PatchObjects(map, label, key));
  };

  const current = selected[0] ?? text;

  /**
   * Anheften braucht *zwei* Dinge: die Beschriftung und das, woran sie hängen
   * soll. Darum wird hier die ganze Auswahl betrachtet und nicht nur der Text.
   */
  const alleGewaehlt = selection.map((id) => doc.objects[id]).filter(Boolean);
  const andere = alleGewaehlt.filter((o) => o && o.kind !== 'text');
  const kannAnheften =
    selected.length === 1 &&
    andere.length === 1 &&
    canAnchor(doc, selected[0].id, andere[0]!.id);
  const wirt =
    selected.length === 1 && selected[0].anchorId
      ? (doc.objects[selected[0].anchorId] ?? null)
      : null;

  const anheften = () => {
    if (!kannAnheften) return;
    exec(
      new PatchObjects(
        new Map([[selected[0].id, { anchorId: andere[0]!.id }]]),
        t('cmd.anchorLabel'),
      ),
    );
  };

  const loesen = () => {
    exec(
      new PatchObjects(
        new Map(selected.map((o) => [o.id, { anchorId: null }])),
        t('cmd.detachLabel'),
      ),
    );
  };

  /** Kurze Bezeichnung eines Objekts für die Anzeige. */
  const objektName = (o: MapObject): string =>
    o.kind === 'prop'
      ? (getProp(o.propId) ? propName(getProp(o.propId)!) : o.propId)
      : o.kind === 'text'
        ? o.text.slice(0, 24) || t('obj.text')
        : t('obj.shape');

  /**
   * Auswahlliste: eingebaute Schriften, importierte, und — falls der Text eine
   * Schrift nennt, die es hier gerade nicht gibt — auch die. Sonst spränge die
   * Anzeige beim Öffnen einer Karte auf eine andere Schrift, ohne dass sich am
   * Text etwas geändert hätte.
   */
  const fontOptions = [
    ...FONT_OPTIONS,
    ...fonts.map((f) => ({ value: f.family, label: `${f.family} ★` })),
  ];
  if (!fontOptions.some((f) => f.value === current.fontFamily)) {
    fontOptions.push({ value: current.fontFamily, label: current.fontFamily });
  }

  const importFonts = async (dateien: FileList | null) => {
    if (!dateien || dateien.length === 0) return;
    setFontError(null);
    let neue = 0;
    for (const datei of Array.from(dateien)) {
      const bytes = new Uint8Array(await datei.arrayBuffer());
      const f = await importFont(datei.name, bytes);
      if (f) {
        neue++;
        // Direkt übernehmen: wer eine Schrift lädt, will sie benutzen.
        apply({ fontFamily: f.family }, t('text.font'));
      }
    }
    setFonts(importedFonts());
    if (neue === 0) setFontError(t('text.fontImportFailed'));
  };

  return (
    <Section title={selected.length > 0 ? t('text.titleCount', { count: selected.length }) : t('text.title')}>
      {/*
        Der Inhalt lässt sich hier nur bei *genau einem* ausgewählten Text
        ändern — bei mehreren gäbe es kein gemeinsames „den Text", und ein
        Feld, das beim Tippen alle gleichnamig macht, wäre eine Falle.

        Dass es dieses Feld überhaupt gibt, hat einen gemeldeten Grund: die
        Beschriftung einer Region entsteht zusammen mit der Fläche, also sucht
        man sie auch dort, wo die Fläche ihre Einstellungen hat — und nicht im
        Textwerkzeug, auf das man erst umschalten müsste.
      */}
      {selected.length === 1 ? (
        <Row label={t('text.content')}>
          <textarea
            className="text-content"
            rows={2}
            value={selected[0].text}
            onChange={(e) =>
              exec(new PatchObjects({ [selected[0].id]: { text: e.target.value } }, t('cmd.editText'), `txt:${selected[0].id}`))
            }
          />
        </Row>
      ) : null}
      <Select
        label={t('text.font')}
        value={current.fontFamily}
        options={fontOptions}
        onChange={(v) => apply({ fontFamily: v }, t('text.font'))}
      />
      <Row label={t('text.fontImport')}>
        <input
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          multiple
          onChange={(e) => {
            void importFonts(e.target.files);
            // Zurücksetzen, damit dieselbe Datei ein zweites Mal auslöst.
            e.target.value = '';
          }}
        />
      </Row>
      {fontError ? <p className="warn">{fontError}</p> : null}
      <p className="hint">{t('text.fontImportHint')}</p>
      <NumberField
        label={t('text.size')}
        value={current.fontSize}
        min={4}
        max={400}
        onChange={(v) => apply({ fontSize: v }, t('text.size'))}
      />
      <Row label={t('text.style')}>
        <div className="row-inline">
          <button
            className={current.bold ? 'active' : ''}
            style={{ fontWeight: 'bold' }}
            onClick={() => apply({ bold: !current.bold }, t('text.style'))}
          >
            {t('text.bold')}
          </button>
          <button
            className={current.italic ? 'active' : ''}
            style={{ fontStyle: 'italic' }}
            onClick={() => apply({ italic: !current.italic }, t('text.style'))}
          >
            {t('text.italic')}
          </button>
        </div>
      </Row>
      <Select
        label={t('text.align')}
        value={current.align}
        options={[
          { value: 'left', label: t('text.alignLeft') },
          { value: 'center', label: t('text.alignCenter') },
          { value: 'right', label: t('text.alignRight') },
        ]}
        onChange={(v) => apply({ align: v }, t('text.align'))}
      />
      <ColorField
        label={t('text.color')}
        value={current.color}
        onChange={(v) => apply({ color: v }, t('text.color'))}
      />
      <Slider
        label={t('text.letterSpacing')}
        min={-5}
        max={30}
        step={0.5}
        value={current.letterSpacing}
        onChange={(v) => apply({ letterSpacing: v }, t('text.letterSpacing'), 'ls')}
      />
      <Slider
        label={t('text.lineHeight')}
        min={0.7}
        max={3}
        step={0.05}
        value={current.lineHeight}
        onChange={(v) => apply({ lineHeight: v }, t('text.lineHeight'), 'lh')}
      />
      {selected.length > 0 ? (
        <>
          <div className="divider" />
          <strong className="sub">{t('text.anchor')}</strong>
          {selected.length === 1 && selected[0].anchorId ? (
            <>
              <p className="hint">
                {wirt
                  ? t('text.anchorOn', { name: objektName(wirt) })
                  : t('text.anchorLost')}
              </p>
              <button onClick={loesen}>{t('text.anchorDetach')}</button>
            </>
          ) : (
            <>
              <button disabled={!kannAnheften} onClick={anheften}>
                {t('text.anchorAttach')}
              </button>
              <p className="hint">
                {kannAnheften ? t('text.anchorAttachHint') : t('text.anchorNeedsTwo')}
              </p>
            </>
          )}
          <div className="divider" />
        </>
      ) : null}

      <Slider
        label={t('text.curvature')}
        min={-1}
        max={1}
        step={0.05}
        value={current.curvature ?? 0}
        onChange={(v) => apply({ curvature: v }, t('text.curvature'), 'tcv')}
      />
      {Math.abs(current.curvature ?? 0) >= 0.01 ? (
        <p className="hint">{t('text.curvatureHint')}</p>
      ) : null}
      <Slider
        label={t('text.outline')}
        min={0}
        max={16}
        step={0.5}
        value={current.strokeWidth}
        onChange={(v) => apply({ strokeWidth: v }, t('text.outline'), 'tsw')}
      />
      {current.strokeWidth > 0 ? (
        <ColorField
          label={t('text.outlineColor')}
          value={current.strokeColor}
          onChange={(v) => apply({ strokeColor: v }, t('text.outlineColor'))}
        />
      ) : null}

      <p className="hint">
        {selected.length > 0 ? t('text.selectionHint') : t('text.placeHint')}
      </p>
    </Section>
  );
}

// ---------------------------------------------------------------------------

export function BrushSettingsPanel() {
  const { t } = useT();
  const brush = useEditor((s) => s.brush);
  const patch = useEditor((s) => s.patchBrush);
  const presets = useEditor((s) => s.brushPresets);
  const addPreset = useEditor((s) => s.addBrushPreset);
  const applyPreset = useEditor((s) => s.applyBrushPreset);
  const removePreset = useEditor((s) => s.removeBrushPreset);
  const [presetName, setPresetName] = useState('');

  return (
    <Section title={t('brush.title')}>
      <Select
        label={t('brush.mode')}
        value={brush.mode}
        options={[
          { value: 'scatter', label: t('brush.scatter') },
          { value: 'single', label: t('brush.single') },
          { value: 'line', label: t('brush.lineMode') },
        ]}
        onChange={(v) => patch({ mode: v })}
      />
      <Slider
        label={t('brush.radius')}
        min={4}
        max={800}
        step={1}
        value={brush.radius}
        onChange={(v) => patch({ radius: v })}
        format={(v) => `${Math.round(v)} px`}
      />
      <Slider
        label={t('brush.density')}
        min={1}
        max={25}
        step={1}
        value={brush.density}
        onChange={(v) => patch({ density: v })}
      />
      <RangeField
        label={t('brush.size')}
        min={0.05}
        max={4}
        lo={brush.scaleMin}
        hi={brush.scaleMax}
        onChange={(lo, hi) => patch({ scaleMin: lo, scaleMax: hi })}
        format={pct}
      />
      <Toggle
        label={t('brush.rotate')}
        checked={brush.rotate}
        onChange={(v) => patch({ rotate: v })}
      />
      {brush.rotate ? (
        <RangeField
          label={t('brush.rotation')}
          min={0}
          max={360}
          step={5}
          lo={(brush.rotationMin * 180) / Math.PI}
          hi={(brush.rotationMax * 180) / Math.PI}
          onChange={(lo, hi) =>
            patch({ rotationMin: (lo * Math.PI) / 180, rotationMax: (hi * Math.PI) / 180 })
          }
          format={(v) => `${Math.round(v)}°`}
        />
      ) : null}
      <RangeField
        label={t('brush.opacity')}
        min={0.05}
        max={1}
        lo={brush.opacityMin}
        hi={brush.opacityMax}
        onChange={(lo, hi) => patch({ opacityMin: lo, opacityMax: hi })}
        format={pct}
      />
      <Slider
        label={t('brush.spacing')}
        min={0}
        max={2}
        step={0.05}
        value={brush.spacing}
        onChange={(v) => patch({ spacing: v })}
        format={(v) => (v === 0 ? t('brush.spacingOff') : pct(v))}
      />
      <Slider
        label={t('brush.falloff')}
        min={0}
        max={1}
        step={0.05}
        value={brush.falloff}
        onChange={(v) => patch({ falloff: v })}
      />
      <Slider
        label={t('brush.flipChance')}
        min={0}
        max={1}
        step={0.05}
        value={brush.flipChance}
        onChange={(v) => patch({ flipChance: v })}
        format={pct}
      />
      <Toggle
        label={t('brush.alignToStroke')}
        checked={brush.alignToStroke}
        onChange={(v) => patch({ alignToStroke: v })}
      />

      <Slider
        label={t('brush.hue')}
        min={0}
        max={50}
        value={brush.hueJitter}
        onChange={(v) => patch({ hueJitter: v })}
      />
      <Slider
        label={t('brush.saturation')}
        min={0}
        max={50}
        value={brush.satJitter}
        onChange={(v) => patch({ satJitter: v })}
      />
      <Slider
        label={t('brush.lightness')}
        min={0}
        max={50}
        value={brush.lightJitter}
        onChange={(v) => patch({ lightJitter: v })}
      />

      <p className="hint">{t('brush.hint')}</p>

      <div className="row-inline">
        <input
          type="text"
          placeholder={t('brush.presetName')}
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <button
          disabled={!presetName.trim()}
          onClick={() => {
            addPreset(presetName.trim());
            setPresetName('');
          }}
        >
          {t('brush.savePreset')}
        </button>
      </div>
      {presets.length > 0 ? (
        <div className="chips">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                removePreset(p.id);
              }}
              title={t('brush.presetHint')}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
