/**
 * Durchklicken übereinanderliegender Objekte (Rückmeldung: „Wenn mehrere
 * Elemente übereinanderliegen, ist es schwierig diese auszuwählen").
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SelectTool } from '@/tools/select';
import { createDocument, defaultTargetLayer } from '@/model/document';
import { useEditor } from '@/model/store';
import type { MapDocument, ShapeObject } from '@/model/types';
import { pointerEvent, toolHarness } from './toolContext';

function rechteck(doc: MapDocument, id: string, z: number): ShapeObject {
  return {
    id, kind: 'shape', layerId: defaultTargetLayer(doc)!, x: 100, y: 100, rotation: 0, opacity: 1, z, locked: false,
    shape: 'rect', points: [0, 0, 200, 200], closed: true, blend: 'normal', stroke: null,
    fill: { color: 0x808080, alpha: 1 },
  };
}

function karte(): MapDocument {
  const doc = createDocument(20, 20);
  doc.grid.snap = 'none';
  for (const [id, z] of [['unten', 1], ['mitte', 2], ['oben', 3]] as const) doc.objects[id] = rechteck(doc, id, z);
  return doc;
}

function klick(tool: SelectTool, h: ReturnType<typeof toolHarness>, x = 150, y = 150) {
  tool.onPointerDown(pointerEvent(x, y), h.ctx);
  tool.onPointerUp(pointerEvent(x, y), h.ctx);
  return useEditor.getState().selection;
}

beforeEach(() => useEditor.setState({ selection: [], tool: 'select' }));

describe('Durchklicken', () => {
  it('wählt bei jedem Klick an derselben Stelle das nächste darunter, dann wieder oben', () => {
    const h = toolHarness(karte());
    const tool = new SelectTool();
    expect(klick(tool, h)).toEqual(['oben']);
    expect(klick(tool, h)).toEqual(['mitte']);
    expect(klick(tool, h)).toEqual(['unten']);
    expect(klick(tool, h)).toEqual(['oben']);
  });

  it('ein Klick an anderer Stelle fängt wieder oben an', () => {
    const h = toolHarness(karte());
    const tool = new SelectTool();
    klick(tool, h);
    klick(tool, h);
    expect(klick(tool, h, 250, 250)).toEqual(['oben']);
  });

  it('Ziehen bewegt das Gewählte und wechselt nicht', () => {
    const h = toolHarness(karte());
    const tool = new SelectTool();
    klick(tool, h);
    klick(tool, h); // „mitte" gewählt
    tool.onPointerDown(pointerEvent(150, 150), h.ctx);
    tool.onPointerMove(pointerEvent(180, 150), h.ctx);
    tool.onPointerUp(pointerEvent(180, 150), h.ctx);
    expect(useEditor.getState().selection).toEqual(['mitte']);
    expect(h.doc.objects.mitte.x).toBe(130);
    expect(h.doc.objects.oben.x).toBe(100);
  });
});

describe('Drehen mit dem Mausrad', () => {
  it('dreht ein Objekt um seine Mitte in Rastschritten und fein um 1°', async () => {
    const { radDrehBefehl, radSchritt } = await import('@/tools/radDrehung');
    const doc = karte();
    doc.grid.rotationSnapDeg = 0;
    expect(radSchritt(doc, false)).toBe(15);
    expect(radSchritt(doc, true)).toBe(1);
    const befehl = radDrehBefehl(doc, ['oben'], 90)!;
    befehl.do(doc);
    const o = doc.objects.oben;
    expect(o.rotation).toBeCloseTo(Math.PI / 2);
    // Mitte (200,200) bleibt stehen: Ursprung wandert auf (300,100).
    expect(o.x).toBeCloseTo(300);
    expect(o.y).toBeCloseTo(100);
  });

  it('dreht mehrere Objekte gemeinsam und lässt Gesperrtes aus', async () => {
    const { radDrehBefehl } = await import('@/tools/radDrehung');
    const doc = karte();
    doc.objects.unten.locked = true;
    const befehl = radDrehBefehl(doc, ['oben', 'mitte', 'unten'], 15)!;
    befehl.do(doc);
    expect(doc.objects.oben.rotation).toBeCloseTo(Math.PI / 12);
    expect(doc.objects.mitte.rotation).toBeCloseTo(Math.PI / 12);
    expect(doc.objects.unten.rotation).toBe(0);
  });
});
