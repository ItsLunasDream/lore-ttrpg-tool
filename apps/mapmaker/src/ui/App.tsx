import { useState } from 'react';
import { useEditor, vttSelectionSize } from '@/model/store';
import { useT } from '@/i18n/useT';
import { CanvasHost } from './CanvasHost';
import { LayerPanel } from './LayerPanel';
import { PropLibrary } from './PropLibrary';
import { StampLibrary } from './StampLibrary';
import { LayerTemplates } from './LayerTemplates';
import { Toolbar } from './Toolbar';
import { FilterPanel } from './FilterPanel';
import { NoteDialog } from './NoteDialog';
import { KartenLeiste } from './KartenLeiste';
import {
  BrushSettingsPanel,
  DrawSettingsPanel,
  GridSettings,
  MapSettings,
  ObjectInspector,
  EraseSettingsPanel,
  SymmetryPanel,
  RouteSettingsPanel,
  PropSettingsPanel,
  TerrainSettingsPanel,
  TextSettingsPanel,
} from './Inspector';
import {
  LightSettingsPanel,
  OpeningSettingsPanel,
  RoomSettingsPanel,
  SelectFilterPanel,
  VttOverviewPanel,
  HeightSettingsPanel,
  LegendPanel,
  RegionSettingsPanel,
  NoteSettingsPanel,
  VttSelectionInspector,
  WallSettingsPanel,
} from './VttPanel';

export function App() {
  const { t } = useT();
  const [rendererReady, setRendererReady] = useState(false);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection);
  const vttSelection = useEditor((s) => s.vttSelection);
  const doc = useEditor((s) => s.doc);
  const rev = useEditor((s) => s.rev);
  const statusMessage = useEditor((s) => s.statusMessage);

  const objectCount = Object.keys(doc.objects).length;
  void rev;

  /**
   * Einstellungen erscheinen auch dann, wenn ein passendes Objekt *ausgewählt*
   * ist — nicht nur beim zugehörigen Werkzeug.
   *
   * Sonst müsste man zum Ändern erst das Werkzeug wechseln, und mit „Auswahl"
   * in der Hand sähe man von einer angeklickten Route gar nicht, was sie
   * ausmacht. Beim Text war genau das schon einmal der gemeldete Eindruck, der
   * Text ließe sich nicht ändern; bei den Routen stand es noch offen.
   */
  const ausgewaehlt = selection.map((id) => doc.objects[id]).filter(Boolean);
  const textAusgewaehlt = ausgewaehlt.some((o) => o?.kind === 'text');
  const routeAusgewaehlt = ausgewaehlt.some((o) => o?.kind === 'shape' && !!o.route);
  const formAusgewaehlt = ausgewaehlt.some((o) => o?.kind === 'shape');

  return (
    <div className="app">
      <Toolbar />
      <KartenLeiste />

      <div className="main">
        <aside className="side left">
          <LayerPanel />
          <LayerTemplates />
          <PropLibrary rendererReady={rendererReady} />
          <StampLibrary />
        </aside>

        <CanvasHost onReady={() => setRendererReady(true)} />

        <aside className="side right">
          <ObjectInspector />
          <VttSelectionInspector />
          {tool === 'select' ? <SelectFilterPanel /> : null}
          {tool === 'prop' ? <PropSettingsPanel /> : null}
          {tool === 'terrain' ? <TerrainSettingsPanel /> : null}
          {tool === 'brush' ? <BrushSettingsPanel /> : null}
          {tool === 'draw' || formAusgewaehlt ? <DrawSettingsPanel /> : null}
          {tool === 'erase' ? <EraseSettingsPanel /> : null}
          {tool === 'prop' || tool === 'brush' || tool === 'draw' || tool === 'stamp' ? (
            <SymmetryPanel />
          ) : null}
          {tool === 'route' || routeAusgewaehlt ? <RouteSettingsPanel /> : null}
          {tool === 'text' || textAusgewaehlt ? <TextSettingsPanel /> : null}
          {tool === 'wall' ? <WallSettingsPanel /> : null}
          {tool === 'room' ? <RoomSettingsPanel /> : null}
          {tool === 'door' || tool === 'window' ? <OpeningSettingsPanel kind={tool} /> : null}
          {tool === 'light' ? <LightSettingsPanel /> : null}
          {tool === 'note' ? <NoteSettingsPanel /> : null}
          {tool === 'height' ? <HeightSettingsPanel /> : null}
          {tool === 'region' ? <RegionSettingsPanel /> : null}
          <LegendPanel />
          <FilterPanel />
          <VttOverviewPanel />
          <GridSettings />
          <MapSettings />
        </aside>
      </div>

      <footer className="status">
        <span>{t('status.zoom', { z: Math.round(zoom * 100) })}</span>
        <span>{t('status.tiles', { cols: doc.size.cols, rows: doc.size.rows })}</span>
        <span>
          {objectCount === 1 ? t('status.objectsOne') : t('status.objects', { n: objectCount })}
        </span>
        <span>{t('status.selected', { n: selection.length + vttSelectionSize(vttSelection) })}</span>
        {statusMessage ? (
          <span className="status-message" style={{ marginLeft: 'auto' }}>
            {statusMessage}
          </span>
        ) : (
          <span style={{ marginLeft: 'auto' }}>{t('status.hints')}</span>
        )}
      </footer>

      <NoteDialog />
    </div>
  );
}
