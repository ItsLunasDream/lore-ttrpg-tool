/**
 * Mauerwerk als Teil der Wand (Rückmeldung: VTT-Wand und Steinwand ließen
 * sich auseinandernehmen) und Auswahl des eben Gesetzten (Rückmeldung:
 * Wandtyp nach dem Setzen eines Raums ändern wirkte nicht).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument, defaultTargetLayer, isObjectEditable } from '@/model/document';
import { useEditor } from '@/model/store';
import { AddVttItems, PatchVttItems, RemoveVttItems } from '@/model/commands';
import { syncVttVisuals, verknuepfeAltesMauerwerk, visualId } from '@/model/vttVisuals';
import { buildWallShape } from '@/assets/wallStyles';
import { RoomTool } from '@/tools/room';
import type { MapDocument, ShapeObject, Wall } from '@/model/types';
import { pointerEvent, toolHarness } from './toolContext';

function karte(): { doc: MapDocument; layer: string } {
  const doc = createDocument(20, 20);
  doc.grid.tileSize = 100;
  return { doc, layer: defaultTargetLayer(doc)! };
}

function wand(layer: string, extra: Partial<Wall> = {}): Wall {
  return { id: 'w1', points: [0, 0, 500, 0], type: 'normal', closed: false, style: 'stone', styleLayerId: layer, ...extra };
}

const mauer = (doc: MapDocument) => doc.objects[visualId('w1')] as ShapeObject | undefined;

describe('Mauerwerk folgt der Wand', () => {
  let doc: MapDocument;
  let layer: string;
  beforeEach(() => {
    ({ doc, layer } = karte());
    useEditor.getState().loadDocument(doc);
  });

  it('entsteht mit der Wand und ist nicht einzeln anfassbar', () => {
    useEditor.getState().exec(new AddVttItems('walls', [wand(layer)]));
    const m = mauer(doc);
    expect(m?.vttLink).toEqual({ kind: 'walls', id: 'w1' });
    expect(isObjectEditable(doc, m!.id)).toBe(false);
    useEditor.getState().setSelection([m!.id]);
    expect(useEditor.getState().selection).toEqual([]);
  });

  it('wandert mit, wenn die Wand bewegt wird, und geht beim Rückgängig mit zurück', () => {
    const st = useEditor.getState();
    st.exec(new AddVttItems('walls', [wand(layer)]));
    st.exec(new PatchVttItems('walls', new Map([['w1', { points: [100, 100, 600, 100] }]])));
    expect([mauer(doc)!.x, mauer(doc)!.y]).toEqual([100, 100]);
    st.undo();
    expect([mauer(doc)!.x, mauer(doc)!.y]).toEqual([0, 0]);
    st.undo();
    expect(mauer(doc)).toBeUndefined();
    st.redo();
    expect(mauer(doc)).toBeDefined();
  });

  it('verschwindet mit der Wand und mit „kein Stil"', () => {
    const st = useEditor.getState();
    st.exec(new AddVttItems('walls', [wand(layer)]));
    st.exec(new PatchVttItems('walls', new Map([['w1', { style: undefined, styleLayerId: undefined }]])));
    expect(mauer(doc)).toBeUndefined();
    st.undo();
    expect(mauer(doc)).toBeDefined();
    st.exec(new RemoveVttItems({ walls: ['w1'] }));
    expect(mauer(doc)).toBeUndefined();
  });

  it('ändert den Stil an Ort und Stelle', () => {
    const st = useEditor.getState();
    st.exec(new AddVttItems('walls', [wand(layer)]));
    const z = mauer(doc)!.z;
    st.exec(new PatchVttItems('walls', new Map([['w1', { style: 'wood' }]])));
    expect(mauer(doc)!.stroke!.color).toBe(buildWallShape(doc, layer, 'wood', [0, 0, 500, 0], false)!.stroke!.color);
    expect(mauer(doc)!.z).toBe(z);
  });
});

describe('ältere Karten', () => {
  it('hängt passendes loses Mauerwerk an seine Wand', () => {
    const { doc, layer } = karte();
    doc.vtt.walls = [{ id: 'w1', points: [0, 0, 500, 0], type: 'normal', closed: false }];
    const lose = buildWallShape(doc, layer, 'brick', [0, 0, 500, 0], false)!;
    const fremd = buildWallShape(doc, layer, 'brick', [0, 900, 500, 900], false)!;
    doc.objects[lose.id] = lose;
    doc.objects[fremd.id] = fremd;

    expect(verknuepfeAltesMauerwerk(doc)).toBe(1);
    expect(doc.vtt.walls[0].style).toBe('brick');
    expect(doc.objects[lose.id]).toBeUndefined();
    expect(doc.objects[fremd.id]).toBeDefined();
    syncVttVisuals(doc);
    expect(mauer(doc)?.vttLink?.id).toBe('w1');
  });
});

describe('Raum-Werkzeug', () => {
  it('wählt den gesetzten Raum aus und trägt das Mauerwerk an der Wand', () => {
    const { doc, layer } = karte();
    const h = toolHarness(doc);
    useEditor.setState({
      activeLayerId: layer,
      room: { ...useEditor.getState().room, createWalls: true, createFloor: true, style: 'stone' },
    });
    const tool = new RoomTool();
    tool.onPointerDown(pointerEvent(0, 0), h.ctx);
    tool.onPointerMove(pointerEvent(300, 300), h.ctx);
    tool.onPointerUp(pointerEvent(300, 300), h.ctx);

    const w = h.doc.vtt.walls[0];
    expect(w.style).toBe('stone');
    expect(w.styleLayerId).toBe(layer);
    // Kein loses Mauerwerk mehr: nur der Boden liegt als Objekt da.
    expect(Object.values(h.doc.objects).filter((o) => o.kind === 'shape' && o.stroke)).toHaveLength(0);
    const st = useEditor.getState();
    expect(st.vttSelection.walls).toEqual([w.id]);
    expect(st.selection).toHaveLength(1);
  });
});

describe('Licht als Teil des Props', () => {
  it('Fackel bringt ihr Licht mit, es wandert mit und geht mit zurück', async () => {
    const { AddObjects, PatchObjects, RemoveObjects } = await import('@/model/commands');
    const { createProp } = await import('@/tools/factory');
    const { lichtFuerProp } = await import('@/assets/propLights');
    const { propLichtId } = await import('@/model/propLights');
    const { doc, layer } = karte();
    useEditor.getState().loadDocument(doc);
    const st = useEditor.getState();
    const fackel = createProp(doc, layer, 'wall_torch', 300, 300, { light: lichtFuerProp('wall_torch') ?? null });
    const licht = () => doc.vtt.lights.find((l) => l.id === propLichtId(fackel.id));

    st.exec(new AddObjects([fackel]));
    expect(licht()).toMatchObject({ x: 300, y: 300, range: 8, propLink: fackel.id });

    st.exec(new PatchObjects(new Map([[fackel.id, { x: 500 }]])));
    expect(licht()?.x).toBe(500);

    st.exec(new PatchObjects(new Map([[fackel.id, { light: null }]])));
    expect(licht()).toBeUndefined();
    st.undo();
    expect(licht()?.range).toBe(8);

    st.exec(new RemoveObjects([fackel.id]));
    expect(licht()).toBeUndefined();
    st.undo();
    expect(licht()?.x).toBe(500);
  });

  it('ein Stein leuchtet nicht', async () => {
    const { lichtFuerProp } = await import('@/assets/propLights');
    expect(lichtFuerProp('boulder')).toBeUndefined();
  });
});
