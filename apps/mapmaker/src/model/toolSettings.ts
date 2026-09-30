/** Einstellungen der Werkzeuge. Leben im Store, nicht im Dokument. */

import type { BlendMode, NoteIcon, PatternKind, ShapeKind, WallSenses, WallType } from './types';
import type { WallStyleId } from '@/assets/wallStyles';

export type ToolId =
  | 'select'
  | 'pan'
  | 'prop'
  | 'brush'
  | 'draw'
  | 'text'
  | 'terrain'
  | 'wall'
  | 'room'
  | 'door'
  | 'window'
  | 'light'
  | 'note'
  | 'height'
  | 'region'
  | 'measure'
  | 'stamp'
  | 'erase'
  | 'route';

/**
 * Tastenkürzel der Werkzeuge.
 *
 * Steht hier und nicht im Manager, weil zwei Stellen es brauchen: der Manager
 * schaltet damit um, die Werkzeugleiste zeigt es an. Zweimal geschrieben liefe
 * es auseinander — genau das war `VttKind` schon einmal.
 */
export const TOOL_SHORTCUTS: Record<ToolId, string> = {
  select: 'V',
  pan: 'H',
  prop: 'P',
  brush: 'B',
  draw: 'D',
  text: 'T',
  terrain: 'G',
  wall: 'W',
  room: 'R',
  door: 'O',
  window: 'F',
  light: 'L',
  note: 'N',
  height: 'E',
  region: 'K',
  measure: 'M',
  stamp: 'S',
  erase: 'X',
  route: 'U',
};

/**
 * Streu-Pinsel. Die Ranges erzeugen die Variation, die handplatzierte Props
 * mühsam macht: jeder Stempel bekommt eigene Größe, Drehung und Farbnuance.
 */
export interface BrushSettings {
  /** Ein oder mehrere Props; pro Stempel wird gewichtet ausgewürfelt. */
  propIds: string[];
  weights: number[];
  radius: number;
  /** Stempelversuche je Vorschubschritt. Höher = dichter. */
  density: number;
  scaleMin: number;
  scaleMax: number;
  rotationMin: number;
  rotationMax: number;
  /** Farbabweichung in Prozentpunkten von Farbton/Sättigung/Helligkeit. */
  hueJitter: number;
  satJitter: number;
  lightJitter: number;
  opacityMin: number;
  opacityMax: number;
  flipChance: number;
  /** Mindestabstand zwischen Stempeln, als Faktor der Prop-Größe. */
  spacing: number;
  /** Props zur Pinselrichtung ausrichten statt zufällig zu drehen. */
  alignToStroke: boolean;
  /**
   * Überhaupt drehen. Aus heißt: jedes Prop steht so, wie es gezeichnet wurde.
   * Für Möbel, Kisten und alles mit erkennbarem Oben ist eine Zufallsdrehung
   * falsch — der Bereichsregler allein sagt das nicht deutlich genug.
   */
  rotate: boolean;
  /** Weicher Rand: Wahrscheinlichkeit fällt zum Radius hin ab. */
  falloff: number;
  mode: 'scatter' | 'single' | 'line';
}

export function defaultBrush(): BrushSettings {
  return {
    propIds: [],
    weights: [],
    radius: 80,
    density: 5,
    scaleMin: 0.6,
    scaleMax: 1.4,
    rotationMin: 0,
    rotationMax: Math.PI * 2,
    hueJitter: 0,
    satJitter: 10,
    lightJitter: 12,
    opacityMin: 1,
    opacityMax: 1,
    flipChance: 0.5,
    spacing: 0.7,
    alignToStroke: false,
    rotate: true,
    falloff: 0.35,
    mode: 'scatter',
  };
}

export interface BrushPreset {
  id: string;
  name: string;
  settings: BrushSettings;
}

export interface DrawSettings {
  shape: ShapeKind;
  strokeColor: number;
  strokeWidth: number;
  strokeAlpha: number;
  dash: number[];
  fillColor: number;
  fillAlpha: number;
  /** Zweite Farbe und Richtung für einen Verlauf; aus heißt einfarbig. */
  fillGradient: boolean;
  fillColor2: number;
  fillAngle: number;
  fillGradientType: 'linear' | 'radial';
  /** Muster über der Füllfarbe; aus heißt nur Farbe. */
  fillPattern: boolean;
  patternKind: PatternKind;
  patternSize: number;
  patternColor: number;
  patternAlpha: number;
  patternAngle: number;
  useStroke: boolean;
  useFill: boolean;
  blend: BlendMode;
  /** Glättung für Freihand: 0 = roh, 1 = stark geglättet. */
  smoothing: number;
}

export function defaultDraw(): DrawSettings {
  return {
    shape: 'freehand',
    strokeColor: 0x222222,
    strokeWidth: 6,
    strokeAlpha: 1,
    dash: [],
    fillColor: 0x6b7a5a,
    fillAlpha: 1,
    fillGradient: false,
    fillColor2: 0x3f5233,
    fillAngle: 90,
    fillGradientType: 'linear',
    fillPattern: false,
    patternKind: 'bricks',
    // Eine Kachel je Feld: Ziegel und Dielen sitzen damit im Raster, und das
    // ist auf einer Battlemap fast immer das Gewollte.
    patternSize: 100,
    patternColor: 0x000000,
    patternAlpha: 0.35,
    patternAngle: 0,
    useStroke: true,
    useFill: false,
    blend: 'normal',
    smoothing: 0.5,
  };
}

export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: number;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  strokeColor: number | null;
  strokeWidth: number;
  /** Wölbung des Textpfads, -1 bis 1; 0 heißt gerade. */
  curvature: number;
}

export function defaultText(): TextSettings {
  return {
    fontFamily: 'Georgia, serif',
    fontSize: 32,
    bold: false,
    italic: false,
    color: 0xf2eee4,
    align: 'left',
    letterSpacing: 0,
    lineHeight: 1.2,
    strokeColor: 0x000000,
    strokeWidth: 0,
    curvature: 0,
  };
}

/**
 * Terrain-Pinsel: Bodenflächen malen statt umranden.
 *
 * Die Breite ist die des Bandes, nicht ein Radius — so entspricht sie dem,
 * was man beim Ziehen sieht.
 */
export interface TerrainSettings {
  color: number;
  alpha: number;
  width: number;
  /** Glättung der Mittellinie, 0–1. */
  smoothing: number;
  /** Wasser statt Boden: Wellen, Uferkante, umfahrener Umriss wird zum See. */
  water?: boolean;
}

export function defaultTerrain(): TerrainSettings {
  return { color: 0x6b7a5a, alpha: 1, width: 120, smoothing: 0.5 };
}

/** Einzelne Props platzieren. */
/**
 * Vorgaben für neu gesetzte Props.
 *
 * Größe, Farbe, Deckkraft und Spiegelung stehen hier und nicht nur am schon
 * gesetzten Objekt: wer zwanzig Bäume in derselben Größe braucht, will sie
 * nicht zwanzigmal einzeln nachstellen. Es sind dieselben Werte, die der
 * Inspektor an einem ausgewählten Prop zeigt — nur eben *vorher*.
 *
 * Die Drehung fehlt hier bewusst: die ist entweder null oder zufällig, und
 * dafür gibt es `randomRotation`. Eine feste Vorgabe wäre bei jedem zweiten
 * Prop im Weg.
 */
export interface PropSettings {
  /**
   * Beim Setzen zufällig drehen. Standardmäßig aus: wer ein einzelnes Prop
   * bewusst platziert, will es meist gerade haben. Für Steine und Büsche
   * lohnt es sich, für eine Truhe nicht.
   */
  randomRotation: boolean;
  /** Größe als Faktor, 1 = wie gezeichnet. */
  scale: number;
  /** Einfärbung; null heißt keine. */
  tint: number | null;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
}

/**
 * Reiserouten.
 *
 * Der Tagesmarsch steht in der Distanzeinheit des Rasters, nicht in Feldern:
 * „40 km am Tag" ist die Angabe, die in jedem Regelwerk steht, und sie bleibt
 * richtig, wenn jemand die Feldgröße ändert.
 */
export interface RouteSettings {
  /** Tagesmarsch in der Einheit des Rasters. */
  perDay: number;
  marks: boolean;
  color: number;
  width: number;
}

export function defaultRoute(): RouteSettings {
  // 40 km ist der Fußmarsch eines Tages in den meisten Regelwerken; bei einer
  // Karte in Metern ist die Zahl ohnehin das Erste, was jemand verstellt.
  // Sechs Weltpixel: auf einer eingepassten Weltkarte ist ein dünnerer Strich
  // ein Haar. Eine Route wird angesehen, nicht hineingezoomt.
  return { perDay: 40, marks: true, color: 0x8b3a2f, width: 6 };
}

/**
 * Radiergummi. Nur der Radius — was radiert wird, entscheidet der Zeiger.
 */
export interface EraseSettings {
  /** Radius in Weltpixeln. */
  radius: number;
}

export function defaultErase(): EraseSettings {
  // Ungefähr ein Viertel Feld: groß genug, um eine Linie sicher zu treffen,
  // klein genug, um eine Ecke stehen zu lassen.
  return { radius: 25 };
}

/**
 * Bausteine setzen. Nur die Drehung — Größe und Farbe stecken in den Objekten
 * des Bausteins selbst, und wer sie ändern will, stellt den Baustein neu
 * zusammen. Ein Regler, der eine ganze Anordnung einfärbt, ergäbe Matsch.
 */
export interface StampSettings {
  /** Drehung der ganzen Anordnung in Grad. */
  rotation: number;
}

export function defaultStamp(): StampSettings {
  return { rotation: 0 };
}

export function defaultProp(): PropSettings {
  return {
    randomRotation: false,
    scale: 1,
    tint: null,
    opacity: 1,
    flipX: false,
    flipY: false,
  };
}

export interface WallSettings {
  type: WallType;
  /**
   * Sichtbares Wandstück, das beim Ziehen mitentsteht. 'none' lässt es bei der
   * reinen VTT-Geometrie — die wandert nach Foundry, ist im Bild aber unsichtbar.
   */
  style: WallStyleId;
  /**
   * Abweichende Sperren für neue Wandzüge.
   *
   * `null` heißt „was der Typ vorgibt". Ein eigener Satz wird dann an jeden
   * neuen Zug mitgegeben — wer eine Reihe Fensterbänke zieht, soll ihn nicht
   * hinterher einzeln setzen müssen.
   */
  senses: WallSenses | null;
}

/**
 * Raum-Werkzeug: Rechteck aufziehen, Wände und Boden entstehen zusammen.
 *
 * Beides einzeln abschaltbar, weil beide Hälften für sich nützlich sind — mal
 * braucht es nur den Grundriss für Foundry, mal nur die Bodenfläche unter einem
 * schon gezogenen Wandring.
 */
export interface RoomSettings {
  wallType: WallType;
  createWalls: boolean;
  createFloor: boolean;
  floorColor: number;
  /**
   * Sichtbares Wandmaterial, wie beim Wand-Werkzeug.
   *
   * Fehlte bisher ganz: ein Raum brachte die Geometrie für Foundry mit, aber
   * im Bild war die Wand nicht zu sehen — man musste sie hinterher von Hand
   * nachziehen.
   */
  style: WallStyleId;
}

export function defaultRoom(): RoomSettings {
  return {
    wallType: 'normal',
    createWalls: true,
    createFloor: true,
    floorColor: 0x6b6152,
    style: 'stone',
  };
}

/**
 * Legende: was hineinkommt.
 *
 * Gespeichert wird, was *abgewählt* ist — nicht, was ausgewählt ist. Das ist
 * der Unterschied zwischen „diese Liste gilt" und „diese Ausnahmen gelten":
 * malt man nach dem Abwählen ein weiteres Biom auf die Karte, ist es von
 * allein dabei, statt still zu fehlen, weil es in einer alten Auswahl nicht
 * stand.
 */
export interface LegendSettings {
  /** Schlüssel der abgewählten Einträge, in der Form `biome:3` / `prop:w_town`. */
  excluded: string[];
  /**
   * Von Hand aufgenommene Einträge, die auf der Karte nicht vorkommen.
   *
   * Nur Art und Schlüssel: Name und Farbe holt der Aufbau aus derselben
   * Quelle wie bei den gefundenen, sonst liefen sie nach einem Sprachwechsel
   * auseinander.
   */
  extra: Array<{ kind: 'biome' | 'prop'; key: string }>;
}

export function defaultLegend(): LegendSettings {
  return { excluded: [], extra: [] };
}

/**
 * Was das Auswahl-Werkzeug anfassen darf.
 *
 * Ohne Filter wäre die VTT-Ebene kaum bedienbar: Wände liegen über dem Boden,
 * den man gerade verschieben will, und Lichter sitzen mitten auf den Props.
 * Wer an den Möbeln arbeitet, schaltet die VTT-Arten ab und umgekehrt.
 *
 * Fenster stehen eigens neben den Wänden, obwohl sie im Modell Wände vom Typ
 * `window` sind — für die Bedienung sind es zwei verschiedene Dinge.
 */
export interface SelectFilter {
  props: boolean;
  shapes: boolean;
  texts: boolean;
  walls: boolean;
  doors: boolean;
  windows: boolean;
  lights: boolean;
  notes: boolean;
}

export function defaultSelectFilter(): SelectFilter {
  return {
    props: true,
    shapes: true,
    texts: true,
    walls: true,
    doors: true,
    windows: true,
    lights: true,
    notes: true,
  };
}

/**
 * Öffnungen: Türen und Fenster.
 *
 * Beide werden wie Wände gezogen. Der Fang an vorhandenen Wänden ist abschaltbar,
 * weil eine freistehende Tür durchaus gewollt sein kann — ein Torbogen im Freien
 * etwa.
 *
 * Welche Art gesetzt wird, sagt das gewählte Werkzeug — es gibt je eines für Tür
 * und Fenster. Als Auswahl in diesem Panel war der Unterschied nicht auffindbar,
 * obwohl er in Foundry real ist: Türen werden zu `portals`, Fenster zu
 * `objects_line_of_sight`.
 */
export interface OpeningSettings {
  snapToWalls: boolean;
  /** Sichtbares Stück zur Öffnung, wie bei den Wänden. */
  style: WallStyleId;
}

export function defaultOpening(): OpeningSettings {
  return { snapToWalls: true, style: 'none' };
}

export interface LightSettings {
  range: number;
  intensity: number;
  color: number;
  alpha: number;
  shadows: boolean;
}

export function defaultLight(): LightSettings {
  return { range: 4, intensity: 1, color: 0xffcc88, alpha: 1, shadows: true };
}

/**
 * Notiz-Werkzeug.
 *
 * `playerVisible` steht bewusst hier und nicht fest im Modell: die meisten
 * Notizen sind Vorbereitung der Spielleitung, aber wer eine Karte mit
 * Beschriftungen für die Runde baut, will das andersherum — und will es
 * einmal einstellen, nicht bei jeder Notiz.
 */
export interface NoteSettings {
  icon: NoteIcon;
  size: number;
  color: number;
  playerVisible: boolean;
}

/**
 * Höhen-Pinsel.
 *
 * `mode` ist die eigentliche Entscheidung: derselbe Pinsel hebt an, senkt ab,
 * glättet oder ebnet ein. Vier Werkzeuge daraus zu machen hieße, vier Knöpfe
 * mit denselben zwei Reglern zu haben.
 *
 * `relief` gehört nicht zum Pinsel, sondern zur Darstellung — es steht hier,
 * weil es keine Eigenschaft der Karte ist: wie stark schattiert angezeigt
 * wird, ist eine Einstellung des Betrachters und gehört nicht mitgespeichert.
 */
export type HeightMode = 'raise' | 'lower' | 'smooth' | 'flatten' | 'biome';

export interface HeightSettings {
  mode: HeightMode;
  /** Radius in Feldern. */
  radius: number;
  /** Wirkung je Pinselschritt, 0 bis 1. */
  strength: number;
  /** Zielhöhe beim Einebnen, 0 bis 1. */
  target: number;
  /** Stärke der Schattierung in der Anzeige. */
  relief: number;
  /** Gewähltes Biom, 1-basiert; 0 heißt: gemaltes Biom wieder entfernen. */
  biome: number;
}

/**
 * Regionen und Grenzen.
 *
 * Zeichnen ließe sich eine Region auch mit dem Polygon-Werkzeug: gestrichelter
 * Rand und halbdurchsichtige Füllung gibt es dort längst. Das Werkzeug nimmt
 * einem die drei Schritte ab — Fläche, Grenze und Name entstehen zusammen und
 * in *einem* Undo-Schritt, und sie gehören danach als Gruppe zusammen.
 */
export interface RegionSettings {
  fillColor: number;
  fillAlpha: number;
  borderColor: number;
  borderWidth: number;
  /** Strichmuster der Grenze in Pixeln; leer = durchgezogen. */
  dash: number[];
  /** Namen mit anlegen? */
  withLabel: boolean;
  labelSize: number;
  labelColor: number;
}

export function defaultRegion(): RegionSettings {
  return {
    fillColor: 0x8a6ab0,
    // Deutlich durchsichtig: eine Region liegt *über* der Karte und darf
    // nicht verdecken, was darunter steht.
    fillAlpha: 0.22,
    borderColor: 0x9d7ed0,
    // Kräftiger als eine gewöhnliche Kontur: eine Grenze soll auch in der
    // eingepassten Ansicht noch als Grenze zu erkennen sein.
    borderWidth: 6,
    dash: [14, 9],
    withLabel: true,
    labelSize: 48,
    labelColor: 0xe8dcff,
  };
}

export function defaultHeight(): HeightSettings {
  return { mode: 'raise', radius: 4, strength: 0.25, target: 0.5, relief: 1, biome: 3 };
}

export function defaultNote(): NoteSettings {
  return { icon: 'marker', size: 1, color: 0xffd98a, playerVisible: false };
}
