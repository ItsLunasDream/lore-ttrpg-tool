/**
 * Generator-Registry und Anwendung aufs Dokument.
 *
 * Das Ergebnis wird in ganz normale Objekte übersetzt: Bodenflächen werden
 * Zeichnungen, Wände und Türen landen auf der VTT-Ebene, Streugut sind Props.
 * Alles ist danach anfassbar, verschiebbar und löschbar — und alles zusammen
 * ist ein einziger Undo-Schritt, weil es für den Benutzer ein Vorgang war.
 */

import { AddObjects, AddVttItems, CompositeCommand, PatchGrid, type Command } from '../commands';
import { nextZ } from '../document';
import { makeId } from '../ids';
import { t, type StringKey } from '@/i18n';
import { lichtFuerProp } from '@/assets/propLights';
import type { LayerId, MapDocument, MapNote, Portal, PropObject, ShapeObject, Wall } from '../types';
import { generateCave, generateIsland, type CaveOptions, type IslandOptions } from './cave';
import { generateDungeon, type DungeonOptions } from './dungeon';
import { generateForest, type ForestOptions } from './forest';
import { generateTown, type TownOptions } from './town';
import { defaultCaveOptions, defaultIslandOptions } from './cave';
import { defaultDungeonOptions } from './dungeon';
import { defaultForestOptions } from './forest';
import { defaultTownOptions } from './town';
import { generateWorld, defaultWorldOptions, type WorldOptions } from './world';
import {
  generateTemplate,
  defaultTemplateOptions,
  templateSize,
  type TemplateOptions,
} from './template';
import type { GeneratedMap } from './types';

export type GeneratorId = 'template' | 'dungeon' | 'cave' | 'forest' | 'town' | 'island' | 'world';

export const GENERATOR_IDS: GeneratorId[] = [
  // Die Vorlagen zuerst: wer den Dialog öffnet, will meistens schnell etwas
  // Fertiges, und ein leerer Grundriss ist der zweite Schritt, nicht der erste.
  'template',
  'dungeon',
  'cave',
  'forest',
  'town',
  'island',
  'world',
];

/** Alle Parametersätze in einem Objekt — so muss die Oberfläche nur einen Zustand halten. */
export interface GeneratorParams {
  dungeon: Omit<DungeonOptions, 'seed' | 'tileSize'>;
  cave: Omit<CaveOptions, 'seed' | 'tileSize'>;
  forest: Omit<ForestOptions, 'seed' | 'tileSize'>;
  town: Omit<TownOptions, 'seed' | 'tileSize'>;
  island: Omit<IslandOptions, 'seed' | 'tileSize'>;
  world: Omit<WorldOptions, 'seed' | 'tileSize'>;
  template: Omit<TemplateOptions, 'seed' | 'tileSize'>;
}

export function defaultGeneratorParams(): GeneratorParams {
  return {
    dungeon: defaultDungeonOptions(),
    cave: defaultCaveOptions(),
    forest: defaultForestOptions(),
    town: defaultTownOptions(),
    island: defaultIslandOptions(),
    world: defaultWorldOptions(),
    template: defaultTemplateOptions(),
  };
}

export function runGenerator(
  id: GeneratorId,
  params: GeneratorParams,
  seed: number,
  tileSize: number,
): GeneratedMap {
  switch (id) {
    case 'dungeon':
      return generateDungeon({ ...params.dungeon, seed, tileSize });
    case 'cave':
      return generateCave({ ...params.cave, seed, tileSize });
    case 'forest':
      return generateForest({ ...params.forest, seed, tileSize });
    case 'town':
      return generateTown({ ...params.town, seed, tileSize });
    case 'island':
      return generateIsland({ ...params.island, seed, tileSize });
    case 'world':
      return generateWorld({ ...params.world, seed, tileSize });
    case 'template': {
      // Die Größe gehört zur Vorlage und nicht zur Einstellung: eine Taverne
      // auf achtzig Feldern wäre keine Taverne, sondern eine Halle mit vier
      // Tischen darin.
      const g = templateSize(params.template.variant);
      return generateTemplate({ ...params.template, ...g, seed, tileSize });
    }
  }
}

/**
 * Übersetzt ein Ergebnis in Befehle.
 *
 * `floorLayer` und `propLayer` dürfen derselbe Layer sein; getrennt ist es
 * übersichtlicher, weil man den Boden dann sperren kann, während man die
 * Ausstattung umräumt.
 */
export function buildGeneratorCommands(
  doc: MapDocument,
  result: GeneratedMap,
  floorLayer: LayerId,
  propLayer: LayerId,
  label: string,
): Command[] {
  const teile: Command[] = [];
  const objekte: Array<ShapeObject | PropObject> = [];

  // Das Raster zuerst: die Koordinaten der Objekte sind Weltpixel und ändern
  // sich dadurch nicht, aber das Raster darunter soll schon stimmen, wenn sie
  // erscheinen.
  if (result.gridType && result.gridType !== doc.grid.type) {
    teile.push(new PatchGrid({ type: result.gridType }, label));
  }

  let z = nextZ(doc, floorLayer);
  for (const flaeche of result.floors) {
    if (flaeche.points.length < 6) continue;
    const ox = flaeche.points[0];
    const oy = flaeche.points[1];
    const lokal = flaeche.points.map((v, i) => (i % 2 === 0 ? v - ox : v - oy));
    objekte.push({
      id: makeId('obj'),
      kind: 'shape',
      layerId: floorLayer,
      shape: 'polygon',
      x: ox,
      y: oy,
      rotation: 0,
      opacity: 1,
      z: z++,
      locked: false,
      points: lokal,
      closed: true,
      blend: 'normal',
      stroke: null,
      fill: { color: flaeche.color, alpha: 1 },
    });
  }

  /**
   * Die Props stapeln sich *über* den Böden — auch wenn beide im selben Layer
   * landen, was der Normalfall ist: der Dialog reicht zweimal die aktive Ebene
   * herein.
   *
   * Vorher wurde `nextZ` für beide getrennt und *vor* dem Einfügen bestimmt.
   * Bei gleichem Layer kamen dabei zweimal dieselben Werte heraus, die
   * Bereiche überlappten, und die zuerst gesetzten Props lagen unter den
   * Böden. Am Lagerfeuer der Waldlichtung war das gut zu sehen: die Feuerstelle
   * verschwand vollständig unter der Lichtungsfläche, und übrig blieb der
   * Lichtpunkt darüber — es sah aus, als hätte der Generator sie vergessen.
   */
  let pz = propLayer === floorLayer ? z : nextZ(doc, propLayer);
  for (const p of result.props) {
    objekte.push({
      id: makeId('obj'),
      kind: 'prop',
      layerId: propLayer,
      propId: p.propId,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      scaleX: p.scale,
      scaleY: p.scale,
      tint: null,
      flipX: false,
      flipY: false,
      opacity: 1,
      z: pz++,
      locked: false,
      seed: Math.floor(Math.random() * 0xffffff),
      // Leuchtende Props tragen ihr Licht selbst (model/propLights.ts).
      light: p.ohneLicht ? null : (lichtFuerProp(p.propId) ?? null),
    });
  }

  if (objekte.length > 0) teile.push(new AddObjects(objekte, label));

  if (result.walls.length > 0) {
    const waende: Wall[] = result.walls.map((w) => ({
      id: makeId('wall'),
      points: [...w.points],
      type: 'normal',
      closed: w.closed,
    }));
    teile.push(new AddVttItems('walls', waende, label));
  }

  if (result.doors.length > 0) {
    const tueren: Portal[] = result.doors.map((d) => ({
      id: makeId('portal'),
      bounds: [...d.bounds] as [number, number, number, number],
      closed: true,
      freestanding: false,
    }));
    teile.push(new AddVttItems('portals', tueren, label));
  }

  // Lichter, die schon an einem leuchtenden Prop hängen, nicht doppelt setzen.
  const leuchten = result.props.filter((p) => !p.ohneLicht && lichtFuerProp(p.propId));
  const freieLichter = result.lights.filter(
    (l) => !leuchten.some((p) => Math.hypot(p.x - l.x, p.y - l.y) < doc.grid.tileSize),
  );
  if (freieLichter.length > 0) {
    teile.push(
      new AddVttItems(
        'lights',
        freieLichter.map((l) => ({
          id: makeId('light'),
          x: l.x,
          y: l.y,
          range: l.range,
          intensity: 1,
          color: 0xffcc88,
          alpha: 1,
          shadows: true,
        })),
        label,
      ),
    );
  }

  if (result.notes.length > 0) {
    // Raumschlüssel: `nameKey` kommt unübersetzt aus dem Generator, hier wird
    // daraus der endgültige, mitgespeicherte Text — genau wie bei Layernamen.
    const notizen: MapNote[] = result.notes.map((n) => ({
      id: makeId('note'),
      x: n.x,
      y: n.y,
      title: `${n.index}. ${t(n.nameKey as StringKey)}`,
      text: t(n.nameKey as StringKey),
      icon: 'info',
      size: 1,
      color: 0xffd98a,
      playerVisible: false,
    }));
    teile.push(new AddVttItems('notes', notizen, label));
  }

  return teile;
}

/** Fasst die Befehle zu einem Undo-Schritt zusammen. */
export function generatorCommand(teile: Command[], label: string): Command | null {
  if (teile.length === 0) return null;
  return teile.length === 1 ? teile[0] : new CompositeCommand(teile, label);
}

export type { GeneratedMap } from './types';
