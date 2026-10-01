/**
 * Generator-Dialog: Typ wählen, Parameter einstellen, Vorschau ansehen, anwenden.
 *
 * Die Vorschau ist bewusst ein schlichtes SVG und nicht der Pixi-Renderer: sie
 * soll den Grundriss zeigen, bevor irgendetwas ins Dokument geschrieben wird.
 * Ein Generator, dessen Ergebnis man erst nach dem Anwenden sieht, zwingt zu
 * einer Kette aus Anwenden und Rückgängig.
 */

import { useEffect, useMemo, useState } from 'react';
import { useEditor } from '@/model/store';
import { canHoldObjects } from '@/model/document';
import {
  GENERATOR_IDS,
  buildGeneratorCommands,
  generatorCommand,
  runGenerator,
  type GeneratorId,
  type GeneratorParams,
} from '@/model/generators';
import { ResizeMap } from '@/model/commands';
import { getRenderer } from '@/engine/instance';
import { useT } from '@/i18n/useT';
import type { StringKey } from '@/i18n';
import { NumberField, Row, Select, Slider, Toggle, useEscapeClose } from './controls';
import { DUNGEON_THEMES, type DungeonTheme } from '@/model/generators/roomThemes';
import {
  TOWN_SHAPES,
  TOWN_SURROUNDS,
  type TownShape,
  type TownSurround,
} from '@/model/generators/town';
import { TEMPLATE_IDS, templateSize, type TemplateId } from '@/model/generators/template';
import type { ForestWater } from '@/model/generators/forest';
import { ladeGeneratorMerker, speichereGeneratorMerker, type GeneratorZiel } from './generatorMerker';

const NAME: Record<GeneratorId, StringKey> = {
  template: 'gen.template',
  dungeon: 'gen.dungeon',
  cave: 'gen.cave',
  forest: 'gen.forest',
  town: 'gen.town',
  island: 'gen.island',
  world: 'gen.world',
};

const BESCHREIBUNG: Record<GeneratorId, StringKey> = {
  template: 'gen.templateHint',
  dungeon: 'gen.dungeonHint',
  cave: 'gen.caveHint',
  forest: 'gen.forestHint',
  town: 'gen.townHint',
  island: 'gen.islandHint',
  world: 'gen.worldHint',
};

const zufallsSeed = () => Math.floor(Math.random() * 0xffffff);

export function GeneratorDialog({
  onClose,
  neueKarte,
}: {
  onClose: () => void;
  /**
   * Legt eine leere Karte an, mit derselben Rückfrage wie „Neu" im
   * Datei-Menü; false, wenn abgebrochen wurde.
   */
  neueKarte?: () => boolean;
}) {
  const { t } = useT();
  useEscapeClose(onClose);
  const doc = useEditor((s) => s.doc);
  const exec = useEditor((s) => s.exec);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const setStatus = useEditor((s) => s.setStatusMessage);

  // Einstellungen bleiben über Sitzungen erhalten (generatorMerker.ts).
  const [start] = useState(ladeGeneratorMerker);
  const [id, setId] = useState<GeneratorId>(start.id);
  const [params, setParams] = useState<GeneratorParams>(start.params);
  const [seed, setSeed] = useState(zufallsSeed);
  const [resize, setResize] = useState(start.resize);
  const [ziel, setZiel] = useState<GeneratorZiel>(start.ziel);
  useEffect(() => {
    speichereGeneratorMerker({ id, params, resize, ziel });
  }, [id, params, resize, ziel]);

  const ergebnis = useMemo(
    () => runGenerator(id, params, seed, doc.grid.tileSize),
    [id, params, seed, doc.grid.tileSize],
  );

  const patch = <K extends GeneratorId>(key: K, teil: Partial<GeneratorParams[K]>) => {
    setParams((p) => ({ ...p, [key]: { ...p[key], ...teil } }));
  };

  const anwenden = () => {
    // In eine neue Karte: dieselbe Rückfrage wie bei „Neu", wenn die jetzige
    // Inhalt hat (Rückmeldung: „auch hier nachfragen").
    const inNeue = ziel === 'neu' && !!neueKarte;
    if (inNeue && !neueKarte!()) return;
    const st = useEditor.getState();
    const aktDoc = st.doc;
    const layer = inNeue ? st.activeLayerId : activeLayerId;
    if (!canHoldObjects(aktDoc, layer)) {
      setStatus(t('gen.layerLocked'));
      return;
    }
    const label = t('gen.command', { name: t(NAME[id]) });
    const teile = buildGeneratorCommands(aktDoc, ergebnis, layer, layer, label);
    // Die Karte zuerst passend machen: sonst ragt der Grundriss über den Rand.
    // Eine neue Karte bekommt immer die Größe des Ergebnisses.
    if (resize || inNeue) {
      teile.unshift(new ResizeMap(ergebnis.size.cols, ergebnis.size.rows, 'top-left'));
    }
    const cmd = generatorCommand(teile, label);
    if (cmd) exec(cmd);
    // Die Karte hat jetzt meist eine andere Größe; ohne Einpassen stünde die
    // Kamera weiter auf dem alten Ausschnitt und man sähe eine Ecke.
    if (resize || inNeue) getRenderer()?.fitToDocument();
    onClose();
  };

  const felder = () => {
    switch (id) {
      case 'dungeon': {
        const p = params.dungeon;
        return (
          <>
            <Slider label={t('gen.roomCount')} min={2} max={30} value={p.roomCount}
              onChange={(v) => patch('dungeon', { roomCount: v })} />
            <Slider label={t('gen.roomMin')} min={3} max={12} value={p.roomMin}
              onChange={(v) => patch('dungeon', { roomMin: Math.min(v, p.roomMax) })} />
            <Slider label={t('gen.roomMax')} min={3} max={20} value={p.roomMax}
              onChange={(v) => patch('dungeon', { roomMax: Math.max(v, p.roomMin) })} />
            <Slider label={t('gen.corridorWidth')} min={1} max={5} value={p.corridorWidth}
              onChange={(v) => patch('dungeon', { corridorWidth: v })} />
            <Slider label={t('gen.winding')} min={0} max={1} step={0.05} value={p.winding}
              onChange={(v) => patch('dungeon', { winding: v })} format={prozent} />
            <Slider label={t('gen.doorChance')} min={0} max={1} step={0.05} value={p.doorChance}
              onChange={(v) => patch('dungeon', { doorChance: v })} format={prozent} />
            <Slider label={t('gen.spread')} min={0} max={1} step={0.05} value={p.spread}
              onChange={(v) => patch('dungeon', { spread: v })}
              format={(v) => (v < 0.34 ? t('gen.spreadClose') : v > 0.66 ? t('gen.spreadWide') : prozent(v))} />
            {p.decorate ? (
              <>
                <Select<DungeonTheme>
                  label={t('gen.theme')}
                  value={p.theme}
                  options={DUNGEON_THEMES.map((id) => ({
                    value: id,
                    label: t(`theme.${id}` as StringKey),
                  }))}
                  onChange={(v) => patch('dungeon', { theme: v })}
                />
                <p className="hint">{t('gen.themeHint')}</p>
                <Toggle label={t('gen.roomKey')} checked={p.roomKey}
                  onChange={(v) => patch('dungeon', { roomKey: v })} />
                <p className="hint">{t('gen.roomKeyHint')}</p>
              </>
            ) : null}
            <Toggle label={t('gen.decorate')} checked={p.decorate}
              onChange={(v) => patch('dungeon', { decorate: v })} />
          </>
        );
      }
      case 'cave': {
        const p = params.cave;
        return (
          <>
            <Slider label={t('gen.density')} min={0.3} max={0.65} step={0.01} value={p.density}
              onChange={(v) => patch('cave', { density: v })} format={prozent} />
            <Slider label={t('gen.smoothing')} min={0} max={8} value={p.smoothing}
              onChange={(v) => patch('cave', { smoothing: v })} />
            <Toggle label={t('gen.decorate')} checked={p.decorate}
              onChange={(v) => patch('cave', { decorate: v })} />
          </>
        );
      }
      case 'forest': {
        const p = params.forest;
        return (
          <>
            <Slider label={t('gen.spacing')} min={1} max={5} step={0.1} value={p.spacing}
              onChange={(v) => patch('forest', { spacing: v })} format={(v) => `${v.toFixed(1)} Tiles`} />
            <Slider label={t('gen.pineShare')} min={0} max={1} step={0.05} value={p.pineShare}
              onChange={(v) => patch('forest', { pineShare: v })} format={prozent} />
            <Slider label={t('gen.clearings')} min={0} max={8} value={p.clearings}
              onChange={(v) => patch('forest', { clearings: v })} />
            <Toggle label={t('gen.path')} checked={p.path}
              onChange={(v) => patch('forest', { path: v })} />
            <Toggle label={t('gen.undergrowth')} checked={p.undergrowth}
              onChange={(v) => patch('forest', { undergrowth: v })} />
            <Select<ForestWater>
              label={t('gen.water')}
              value={p.water}
              options={[
                { value: 'random', label: t('gen.waterRandom') },
                { value: 'none', label: t('gen.waterNone') },
                { value: 'pond', label: t('gen.waterPond') },
                { value: 'stream', label: t('gen.waterStream') },
                { value: 'lake', label: t('gen.waterLake') },
                { value: 'river', label: t('gen.waterRiver') },
              ]}
              onChange={(v) => patch('forest', { water: v })}
            />
            <Slider label={t('gen.rocks')} min={0} max={1} step={0.05} value={p.rocks}
              onChange={(v) => patch('forest', { rocks: v })} format={prozent} />
            <Slider label={t('gen.hills')} min={0} max={6} value={p.hills}
              onChange={(v) => patch('forest', { hills: v })} />
          </>
        );
      }
      case 'town': {
        const p = params.town;
        return (
          <>
            <Toggle label={t('gen.overview')} checked={!!p.uebersicht}
              onChange={(v) => patch('town', { uebersicht: v })} />
            {p.uebersicht ? (
              <p className="hint">{t('gen.overviewHint')}</p>
            ) : (
              <>
                <Slider label={t('gen.buildingCount')} min={3} max={300} value={p.buildingCount}
                  onChange={(v) => patch('town', { buildingCount: v })} />
                <Slider label={t('gen.buildingMin')} min={2} max={10} value={p.buildingMin}
                  onChange={(v) => patch('town', { buildingMin: Math.min(v, p.buildingMax) })} />
                <Slider label={t('gen.buildingMax')} min={2} max={16} value={p.buildingMax}
                  onChange={(v) => patch('town', { buildingMax: Math.max(v, p.buildingMin) })} />
                <Slider label={t('gen.streetWidth')} min={2} max={6} value={p.streetWidth}
                  onChange={(v) => patch('town', { streetWidth: v })} />
              </>
            )}
            <Toggle label={t('gen.market')} checked={p.market}
              onChange={(v) => patch('town', { market: v })} />
            <Toggle label={t('gen.cityWall')} checked={p.cityWall}
              onChange={(v) => patch('town', { cityWall: v })} />
            <Select<TownShape>
              label={t('gen.shape')}
              value={p.shape}
              options={TOWN_SHAPES.map((id) => ({ value: id, label: t(`shape.${id}` as StringKey) }))}
              onChange={(v) => patch('town', { shape: v })}
            />
            <Slider label={t('gen.margin')} min={0} max={12} value={p.margin}
              onChange={(v) => patch('town', { margin: v })} format={(v) => `${v} Tiles`} />
            {p.margin > 0 ? (
              <Select<TownSurround>
                label={t('gen.surround')}
                value={p.surround}
                options={TOWN_SURROUNDS.map((id) => ({ value: id, label: t(`surround.${id}` as StringKey) }))}
                onChange={(v) => patch('town', { surround: v })}
              />
            ) : null}
            <Toggle label={t('gen.decorate')} checked={p.decorate}
              onChange={(v) => patch('town', { decorate: v })} />
          </>
        );
      }
      case 'template': {
        const p = params.template;
        return (
          <>
            <Toggle label={t('gen.decorate')} checked={p.furnish}
              onChange={(v) => patch('template', { furnish: v })} />
            <Toggle label={t('gen.templateLights')} checked={p.lights}
              onChange={(v) => patch('template', { lights: v })} />
          </>
        );
      }
      case 'world': {
        const p = params.world;
        return (
          <>
            <Slider label={t('gen.seaLevel')} min={0.2} max={0.7} step={0.01} value={p.seaLevel}
              onChange={(v) => patch('world', { seaLevel: v })} format={prozent} />
            <Slider label={t('gen.landScale')} min={0.02} max={0.12} step={0.005} value={p.scale}
              onChange={(v) => patch('world', { scale: v })}
              format={(v) => (v < 0.05 ? t('gen.landLarge') : v > 0.085 ? t('gen.landSmall') : t('gen.landMedium'))} />
            <Slider label={t('gen.octaves')} min={1} max={7} value={p.octaves}
              onChange={(v) => patch('world', { octaves: v })} />
            <Slider label={t('gen.rivers')} min={0} max={20} value={p.rivers}
              onChange={(v) => patch('world', { rivers: v })} />
            <Slider label={t('gen.settlements')} min={0} max={20} value={p.settlements}
              onChange={(v) => patch('world', { settlements: v })} />
            {p.settlements > 1 ? (
              <>
                <Toggle label={t('gen.roads')} checked={p.roads}
                  onChange={(v) => patch('world', { roads: v })} />
                {p.roads ? <p className="hint">{t('gen.roadsHint')}</p> : null}
              </>
            ) : null}
            <Toggle label={t('gen.decorate')} checked={p.decorate}
              onChange={(v) => patch('world', { decorate: v })} />
            <Toggle label={t('gen.cartouche')} checked={p.cartouche}
              onChange={(v) => patch('world', { cartouche: v })} />
            <Select<'noise' | 'plates'>
              label={t('gen.worldVariant')}
              value={p.variant}
              options={[
                { value: 'noise', label: t('gen.variantNoise') },
                { value: 'plates', label: t('gen.variantPlates') },
              ]}
              onChange={(v) => patch('world', { variant: v })}
            />
            {p.variant === 'plates' ? (
              <>
                <Slider label={t('gen.landShare')} min={0.15} max={0.8} step={0.05}
                  value={p.landShare} onChange={(v) => patch('world', { landShare: v })} format={prozent} />
                <p className="hint">{t('gen.variantPlatesHint')}</p>
              </>
            ) : null}
            <Toggle label={t('gen.hexGrid')} checked={p.hexGrid}
              onChange={(v) => patch('world', { hexGrid: v })} />
            <p className="hint">{t('gen.hexGridHint')}</p>
          </>
        );
      }
      case 'island': {
        const p = params.island;
        return (
          <>
            <Slider label={t('gen.density')} min={0.35} max={0.7} step={0.01} value={p.density}
              onChange={(v) => patch('island', { density: v })} format={prozent} />
            <Slider label={t('gen.roughness')} min={0} max={1} step={0.05} value={p.roughness}
              onChange={(v) => patch('island', { roughness: v })} format={prozent} />
            <Slider label={t('gen.smoothing')} min={0} max={8} value={p.smoothing}
              onChange={(v) => patch('island', { smoothing: v })} />
            <Toggle label={t('gen.decorate')} checked={p.decorate}
              onChange={(v) => patch('island', { decorate: v })} />
          </>
        );
      }
    }
  };

  const groesse = id === 'template' ? templateSize(params.template.variant)
    : id === 'dungeon' ? params.dungeon
    : id === 'cave' ? params.cave
    : id === 'forest' ? params.forest
    : id === 'town' ? params.town
    : id === 'world' ? params.world
    : params.island;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{t('gen.title')}</h3>
          <button className="ghost icon" onClick={onClose} title={t('export.close')}>
            ✕
          </button>
        </header>

        <div className="modal-body gen-body">
          <div className="gen-controls">
            {/*
              Die Vorlagen stehen einzeln in der Liste (Rückmeldung: „Was ist
              Template für eine Vorlage? Mach daraus extra Vorlagen für Taverne
              etc."), intern bleiben sie ein Generator mit Variante.
            */}
            <Select<string>
              label={t('gen.type')}
              value={id === 'template' ? `template:${params.template.variant}` : id}
              options={[
                ...TEMPLATE_IDS.map((v) => ({ value: `template:${v}`, label: t(`template.${v}` as StringKey) })),
                ...GENERATOR_IDS.filter((g) => g !== 'template').map((g) => ({ value: g, label: t(NAME[g]) })),
              ]}
              onChange={(v) => {
                if (v.startsWith('template:')) {
                  setId('template');
                  patch('template', { variant: v.slice('template:'.length) as TemplateId });
                } else setId(v as GeneratorId);
              }}
            />
            <p className="hint">
              {id === 'template' ? t(`template.${params.template.variant}Hint` as StringKey) : t(BESCHREIBUNG[id])}
            </p>

            <div className="divider" />

            <Row label={t('gen.seed')}>
              <div className="row-inline">
                <span className="value">{seed}</span>
                <button onClick={() => setSeed(zufallsSeed())}>{t('gen.reroll')}</button>
              </div>
            </Row>
            {/*
              Bei Vorlagen keine Größenfelder: die Anordnung ist von Hand
              gesetzt und passt in genau diese Maße. Eine Taverne auf achtzig
              Feldern wäre eine Halle mit vier Tischen darin.
            */}
            {id === 'template' ? null : (
              <>
                <NumberField label={t('gen.cols')} min={10} max={150} value={groesse.cols}
                  onChange={(v) => patch(id, { cols: v } as never)} />
                <NumberField label={t('gen.rows')} min={10} max={150} value={groesse.rows}
                  onChange={(v) => patch(id, { rows: v } as never)} />
              </>
            )}

            <div className="divider" />
            {felder()}

            <div className="divider" />
            {neueKarte ? (
              <Select<GeneratorZiel>
                label={t('gen.target')}
                value={ziel}
                options={[
                  { value: 'aktuell', label: t('gen.targetCurrent') },
                  { value: 'neu', label: t('gen.targetNew') },
                ]}
                onChange={setZiel}
              />
            ) : null}
            {ziel === 'neu' && neueKarte ? null : (
              <Toggle label={t('gen.resize')} checked={resize} onChange={setResize} />
            )}
            <p className="hint">{t('gen.applyHint')}</p>
          </div>

          <div className="gen-preview">
            <Vorschau ergebnis={ergebnis} tileSize={doc.grid.tileSize} />
            <p className="hint">
              {t('gen.counts', {
                floors: ergebnis.floors.length,
                walls: ergebnis.walls.length,
                doors: ergebnis.doors.length,
                props: ergebnis.props.length,
              })}
            </p>
          </div>
        </div>

        <footer>
          <button onClick={onClose}>{t('export.close')}</button>
          <button className="primary" onClick={anwenden}>
            {t('gen.apply')}
          </button>
        </footer>
      </div>
    </div>
  );
}

const prozent = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Farbe und Größe eines Props in der Vorschau.
 *
 * Vorher war jedes Prop derselbe grüne Punkt. Das machte jeden Anteil-Regler
 * wirkungslos *in der Vorschau*: ob ein Wald zu null oder zu hundert Prozent
 * aus Nadelbäumen besteht, sah man erst nach dem Anwenden. Genau daran ist
 * gemeldet worden, der Generator selbst rechnete richtig.
 *
 * Bewusst grob nach Familie und nicht je Prop: die Vorschau soll den
 * Grundriss lesbar machen, keine zweite Bibliothek werden.
 */
function propArt(id: string): { farbe: string; r: number; deckkraft: number } {
  // Bläuliches Grün, nicht dunkelgrün: auf dem Waldboden wäre reines
  // Dunkelgrün praktisch unsichtbar — genau daran fiel der Regler durch.
  if (id.startsWith('tree_pine') || id === 'w_forest_pine')
    return { farbe: '#3fa07e', r: 0.2, deckkraft: 1 };
  if (id.startsWith('tree_') || id.startsWith('w_forest'))
    return { farbe: '#7cc06a', r: 0.2, deckkraft: 0.95 };
  if (id.startsWith('stone') || id.startsWith('rock') || id.startsWith('boulder') || id.startsWith('w_mountain') || id.startsWith('w_hill'))
    return { farbe: '#a9a196', r: 0.16, deckkraft: 0.9 };
  if (id.startsWith('w_town') || id.startsWith('w_city') || id.startsWith('house') || id.startsWith('hut'))
    return { farbe: '#e0a34f', r: 0.24, deckkraft: 1 };
  if (id.startsWith('w_dunes') || id === 'haystack' || id === 'hay')
    return { farbe: '#d8c48a', r: 0.16, deckkraft: 0.9 };
  if (id.startsWith('reed') || id.startsWith('lily') || id.startsWith('w_swamp'))
    return { farbe: '#4f8fa8', r: 0.14, deckkraft: 0.9 };
  // Alles Übrige ist Unterholz und Kleinkram: klein und blass, damit es die
  // Bäume nicht zudeckt — in der Zahl ist es ihnen weit überlegen.
  return { farbe: '#8ba36b', r: 0.1, deckkraft: 0.5 };
}

/** Grundriss-Vorschau als SVG — Flächen, Wände, Türen, Props als Punkte. */
function Vorschau({
  ergebnis,
  tileSize,
}: {
  ergebnis: ReturnType<typeof runGenerator>;
  tileSize: number;
}) {
  const w = ergebnis.size.cols * tileSize;
  const h = ergebnis.size.rows * tileSize;
  const punkte = (p: number[]) => {
    const out: string[] = [];
    for (let i = 0; i < p.length; i += 2) out.push(`${p[i]},${p[i + 1]}`);
    return out.join(' ');
  };

  return (
    <svg className="gen-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={w} height={h} fill="#1a1a20" />
      {ergebnis.floors.map((f, i) => (
        <polygon
          key={`f${i}`}
          points={punkte(f.points)}
          fill={`#${f.color.toString(16).padStart(6, '0')}`}
        />
      ))}
      {ergebnis.walls.map((wl, i) => (
        <polyline
          key={`w${i}`}
          points={punkte(wl.closed ? [...wl.points, wl.points[0], wl.points[1]] : wl.points)}
          fill="none"
          stroke="#ff5a5a"
          strokeWidth={tileSize * 0.12}
        />
      ))}
      {ergebnis.doors.map((d, i) => (
        <line
          key={`d${i}`}
          x1={d.bounds[0]}
          y1={d.bounds[1]}
          x2={d.bounds[2]}
          y2={d.bounds[3]}
          stroke="#ffc23d"
          strokeWidth={tileSize * 0.3}
          strokeLinecap="round"
        />
      ))}
      {ergebnis.props.map((p, i) => {
        const a = propArt(p.propId);
        return (
          <circle
            key={`p${i}`}
            cx={p.x}
            cy={p.y}
            r={tileSize * a.r}
            fill={a.farbe}
            opacity={a.deckkraft}
          />
        );
      })}
      {ergebnis.lights.map((l, i) => (
        <circle
          key={`l${i}`}
          cx={l.x}
          cy={l.y}
          r={l.range * tileSize * 0.5}
          fill="#ffcc88"
          opacity={0.12}
        />
      ))}
    </svg>
  );
}
