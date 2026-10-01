/**
 * Ergebnis eines Generators.
 *
 * Bewusst ein Beschreibungs-Objekt und kein fertiges Bild: was hier
 * herauskommt, wird anschließend in ganz normale Dokumentobjekte übersetzt.
 * Ein Generator, dessen Ergebnis man nicht anfassen kann, ist im Kartenbau
 * wertlos — dieselbe Überlegung wie bei `deriveWalls`.
 *
 * Alle Koordinaten sind Weltpixel.
 */

import type { GridType } from '../types';

export interface GenFloor {
  points: number[];
  color: number;
}

export interface GenWall {
  points: number[];
  closed: boolean;
}

export interface GenDoor {
  bounds: [number, number, number, number];
}

export interface GenProp {
  propId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /**
   * Ein leuchtendes Prop (Fackel, Kamin) bekommt sonst sein VTT-Licht; wahr
   * heißt: ohne, etwa wenn „Licht mitgeben" ausgeschaltet ist.
   */
  ohneLicht?: boolean;
}

export interface GenLight {
  x: number;
  y: number;
  range: number;
}

/**
 * Ein Eintrag für eine Kartenschlüssel- oder Gazetteer-Liste — ein
 * Verweis-Pin auf einen benannten Ort (Dungeon-Raum, Gebäude), keine
 * Zeichnung. `nameKey` ist unübersetzt: der Generator kennt kein `t()`, das
 * passiert erst beim Einfügen ins Dokument (`buildGeneratorCommands`), genau
 * wie bei Layernamen.
 */
export interface GenLocationNote {
  x: number;
  y: number;
  nameKey: string;
  /** Fortlaufend ab 1, in Lesereihenfolge (Erkundung, Rundgang). */
  index: number;
}

export interface GeneratedMap {
  /** Empfohlene Kartengröße in Tiles. */
  size: { cols: number; rows: number };
  floors: GenFloor[];
  walls: GenWall[];
  doors: GenDoor[];
  props: GenProp[];
  lights: GenLight[];
  notes: GenLocationNote[];
  /**
   * Rasterart, die zu diesem Ergebnis passt; fehlt heißt: lassen wie es ist.
   *
   * Nur die Weltkarte macht davon Gebrauch. Auf einer Battlemap zählt das
   * Quadratraster, weil Universal VTT nichts anderes kennt; auf einer
   * Weltkarte, die als Bild ausgegeben wird, ist das Hexfeld das übliche.
   */
  gridType?: GridType;
}

export function emptyResult(cols: number, rows: number): GeneratedMap {
  return { size: { cols, rows }, floors: [], walls: [], doors: [], props: [], lights: [], notes: [] };
}

/** Gemeinsame Angaben aller Generatoren. */
export interface BaseOptions {
  seed: number;
  cols: number;
  rows: number;
  tileSize: number;
}
