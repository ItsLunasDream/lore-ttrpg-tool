/**
 * Layer-Panel.
 *
 * Zeigt den kompletten Stapel von oben nach unten — inklusive der Systemebenen
 * Grid und VTT, die dadurch frei zwischen den Benutzerebenen einsortiert werden
 * können. Genau das ist der Punkt: „Grid über den Objekten" ist eine
 * Stapelposition, keine Sondereinstellung.
 */

import { useMemo, useState } from 'react';
import {
  AddLayer,
  GroupLayers,
  MergeLayerDown,
  MoveLayer,
  PatchLayer,
  RemoveLayer,
  newGroupLayer,
  newObjectLayer,
} from '@/model/commands';
import { ancestorsOf, flattenLayers } from '@/model/document';
import { useEditor } from '@/model/store';
import { SYSTEM_GRID, SYSTEM_VTT, isSystemLayer, type BlendMode, type Layer, type LayerId } from '@/model/types';
import { useT } from '@/i18n/useT';
import type { StringKey } from '@/i18n';
import { Row, Section, Select, Slider } from './controls';
import { alsKnopf } from '@suite/tastatur';

const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'soft-light',
  'hard-light',
  'color-dodge',
  'color-burn',
  'difference',
  'add',
];

export function LayerPanel() {
  const { t } = useT();
  const rev = useEditor((s) => s.rev);
  const doc = useEditor((s) => s.doc);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const exec = useEditor((s) => s.exec);
  const soloLayerId = useEditor((s) => s.soloLayerId);
  const toggleSolo = useEditor((s) => s.toggleSolo);
  const setActiveLayer = useEditor((s) => s.setActiveLayer);

  const [renaming, setRenaming] = useState<LayerId | null>(null);
  const [dragging, setDragging] = useState<LayerId | null>(null);

  // Von oben nach unten anzeigen — flattenLayers liefert unten-nach-oben.
  const flat = useMemo(() => flattenLayers(doc).slice().reverse(), [doc, rev]);
  const active = doc.layers[activeLayerId];

  const depthOf = (id: LayerId) => ancestorsOf(doc, id).length;

  const addLayer = () => {
    const layer = newObjectLayer(t('layers.defaultName', { n: Object.keys(doc.layers).length - 1 }));
    const anchor = doc.layers[activeLayerId];
    layer.parentId = anchor?.parentId ?? null;
    const siblings = layer.parentId ? doc.layers[layer.parentId].children : doc.rootLayers;
    exec(new AddLayer(layer, siblings.indexOf(activeLayerId) + 1));
    setActiveLayer(layer.id);
  };

  const addGroup = () => {
    const group = newGroupLayer(t('layers.groupName'));
    if (active && !isSystemLayer(active.id)) {
      exec(new GroupLayers([active.id], group));
    } else {
      exec(new AddLayer(group));
    }
  };

  const duplicateLayer = () => {
    if (!active || isSystemLayer(active.id) || active.isGroup) return;
    const copy = newObjectLayer(t('layers.copySuffix', { name: active.name }));
    copy.parentId = active.parentId;
    copy.opacity = active.opacity;
    copy.blend = active.blend;
    const siblings = active.parentId ? doc.layers[active.parentId].children : doc.rootLayers;
    exec(new AddLayer(copy, siblings.indexOf(active.id) + 1));
    setActiveLayer(copy.id);
  };

  const move = (id: LayerId, dir: 1 | -1) => {
    const layer = doc.layers[id];
    if (!layer) return;
    const siblings = layer.parentId ? doc.layers[layer.parentId].children : doc.rootLayers;
    const at = siblings.indexOf(id);
    const to = at + dir;
    if (to < 0 || to >= siblings.length) return;
    exec(new MoveLayer(id, layer.parentId, to));
  };

  const onDrop = (targetId: LayerId) => {
    if (!dragging || dragging === targetId) return;
    const target = doc.layers[targetId];
    if (!target) return;

    // In eine Gruppe fallen lassen heißt hineinlegen, sonst danebenlegen.
    if (target.isGroup) {
      exec(new MoveLayer(dragging, targetId, target.children.length));
    } else {
      const siblings = target.parentId ? doc.layers[target.parentId].children : doc.rootLayers;
      exec(new MoveLayer(dragging, target.parentId, siblings.indexOf(targetId)));
    }
    setDragging(null);
  };

  return (
    <Section
      title={t('layers.title')}
      actions={
        <div className="row-inline">
          <button className="ghost icon" title={t('layers.new')} onClick={addLayer}>
            ＋
          </button>
          <button className="ghost icon" title={t('layers.newGroup')} onClick={addGroup}>
            🗀
          </button>
        </div>
      }
    >
      <div className="layer-list" data-pfeile="liste" style={{ flexDirection: 'column' }}>
        {flat.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            depth={depthOf(layer.id)}
            active={layer.id === activeLayerId}
            renaming={renaming === layer.id}
            onStartRename={() => setRenaming(layer.id)}
            t={t}
            onRename={(name) => {
              if (name.trim()) exec(new PatchLayer(layer.id, { name: name.trim() }, t('layers.title')));
              setRenaming(null);
            }}
            onSelect={() => setActiveLayer(layer.id)}
            onToggleVisible={() =>
              exec(new PatchLayer(layer.id, { visible: !layer.visible }, t('cmd.visibility')))
            }
            onToggleSolo={() => toggleSolo(layer.id)}
            solo={soloLayerId === layer.id}
            onToggleLock={() => exec(new PatchLayer(layer.id, { locked: !layer.locked }, t('cmd.lock')))}
            onToggleExport={() =>
              exec(
                new PatchLayer(
                  layer.id,
                  { includeInExport: !layer.includeInExport },
                  t('cmd.exportFlag'),
                ),
              )
            }
            onDragStart={() => setDragging(layer.id)}
            onDrop={() => onDrop(layer.id)}
            isDragging={dragging === layer.id}
          />
        ))}
      </div>

      <div className="row-inline">
        <button
          className="icon"
          title={t('layers.up')}
          disabled={!active}
          onClick={() => active && move(active.id, 1)}
        >
          ↑
        </button>
        <button
          className="icon"
          title={t('layers.down')}
          disabled={!active}
          onClick={() => active && move(active.id, -1)}
        >
          ↓
        </button>
        <button
          className="icon"
          title={t('layers.duplicate')}
          disabled={!active || isSystemLayer(active.id) || active.isGroup}
          onClick={duplicateLayer}
        >
          ⧉
        </button>
        <button
          className="icon"
          title={t('layers.mergeDown')}
          disabled={!active || isSystemLayer(active.id) || active.isGroup}
          onClick={() => active && exec(new MergeLayerDown(active.id))}
        >
          ⤓
        </button>
        <button
          className="icon"
          title={t('layers.delete')}
          disabled={!active || isSystemLayer(active.id)}
          onClick={() => {
            if (!active) return;
            exec(new RemoveLayer(active.id));
          }}
        >
          🗑
        </button>
      </div>

      {active ? (
        <>
          <Slider
            label={t('layers.opacity')}
            min={0}
            max={1}
            step={0.01}
            value={active.opacity}
            onChange={(v) =>
              exec(
                new PatchLayer(active.id, { opacity: v }, t('layers.opacity'), `op:${active.id}`),
              )
            }
            format={(v) => `${Math.round(v * 100)}%`}
          />
          {!isSystemLayer(active.id) ? (
            <Select
              label={t('layers.blend')}
              value={active.blend}
              options={BLEND_MODES.map((mode) => ({
                value: mode,
                label: t(`blend.${mode}` as StringKey),
              }))}
              onChange={(v) => exec(new PatchLayer(active.id, { blend: v }, t('layers.blend')))}
            />
          ) : null}
          <Row label={t('layers.exportFlag')}>
            <input
              type="checkbox"
              checked={active.includeInExport}
              disabled={active.id === SYSTEM_VTT}
              onChange={() =>
                exec(
                  new PatchLayer(
                    active.id,
                    { includeInExport: !active.includeInExport },
                    t('cmd.exportFlag'),
                  ),
                )
              }
            />
          </Row>
          {active.id === SYSTEM_VTT ? <p className="hint">{t('layers.vttHint')}</p> : null}
          {active.id === SYSTEM_GRID ? <p className="hint">{t('layers.gridHint')}</p> : null}
        </>
      ) : null}
    </Section>
  );
}

function LayerRow({
  layer,
  depth,
  active,
  renaming,
  t,
  onStartRename,
  onRename,
  onSelect,
  onToggleVisible,
  onToggleSolo,
  solo,
  onToggleLock,
  onToggleExport,
  onDragStart,
  onDrop,
  isDragging,
}: {
  layer: Layer;
  depth: number;
  active: boolean;
  renaming: boolean;
  t: ReturnType<typeof useT>['t'];
  onStartRename: () => void;
  onRename: (name: string) => void;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleSolo: () => void;
  /** Ist gerade dieser Layer allein sichtbar geschaltet? */
  solo: boolean;
  onToggleLock: () => void;
  onToggleExport: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  isDragging: boolean;
}) {
  const system = isSystemLayer(layer.id);
  return (
    <div
      className={`layer${active ? ' active' : ''}${system ? ' system' : ''}`}
      style={{ paddingLeft: 6 + depth * 12, opacity: isDragging ? 0.5 : 1 }}
      onClick={onSelect}
      {...alsKnopf(onSelect)}
      data-pfeil
      aria-pressed={active}
      draggable={!system}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <button
        className={`toggle${layer.visible ? '' : ' off'}`}
        title={layer.visible ? t('layers.hide') : t('layers.show')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisible();
        }}
      >
        {layer.visible ? '👁' : '🚫'}
      </button>
      <button
        className={`toggle${solo ? '' : ' off'}`}
        title={solo ? t('layers.soloOff') : t('layers.solo')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSolo();
        }}
      >
        ◉
      </button>
      <button
        className={`toggle${layer.locked ? '' : ' off'}`}
        title={layer.locked ? t('layers.unlock') : t('layers.lock')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
      >
        {layer.locked ? '🔒' : '🔓'}
      </button>

      {renaming ? (
        <input
          autoFocus
          type="text"
          defaultValue={layer.name}
          onBlur={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') onRename(layer.name);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`name${system ? ' system-name' : ''}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!system) onStartRename();
          }}
        >
          {layer.isGroup ? '🗀 ' : ''}
          {layer.name}
        </span>
      )}

      <button
        className={`toggle${layer.includeInExport ? '' : ' off'}`}
        title={layer.includeInExport ? t('layers.inExport') : t('layers.notInExport')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExport();
        }}
      >
        ⤓
      </button>
    </div>
  );
}
