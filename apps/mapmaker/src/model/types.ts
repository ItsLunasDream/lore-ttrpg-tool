/**
 * Datenmodell des Karteneditors.
 *
 * Bewusst frei von Pixi- und React-Bezügen: alles hier ist reines, serialisierbares
 * TypeScript. Der Renderer ist ein Konsument dieses Modells, nicht sein Besitzer.
 * Dadurch sind Undo/Redo, Speichern und Tests unabhängig vom Rendering.
 *
 * Weltkoordinaten sind Pixel bei der *Referenzauflösung* der Karte (grid.tileSize).
 * Die Umrechnung in Grid-Einheiten passiert erst beim Export (siehe io/uvtt.ts).
 */

import type { FilterSettings } from './filters';

export type ObjectId = string;
export type LayerId = string;

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export type GridType = 'square' | 'hexPointy' | 'hexFlat';

/** Fangraster beim Platzieren. */
export type SnapMode = 'none' | 'tile' | 'half' | 'quarter' | 'corner';

export interface GridSettings {
  type: GridType;
  /**
   * Kantenlänge (Quadrat) bzw. Breite/Höhe der Hex-Zelle in Pixeln.
   * Für hexPointy ist das die Breite, für hexFlat die Höhe — wie in Foundry.
   */
  tileSize: number;
  visible: boolean;
  color: number;
  opacity: number;
  lineWidth: number;
  offsetX: number;
  offsetY: number;
  snap: SnapMode;
  /** Rotations-Fang in Grad; 0 = frei. */
  rotationSnapDeg: number;
  /**
   * Wie weit ein Feld in der Spielwelt ist, und in welcher Einheit.
   *
   * Steht beim Raster und nicht bei den Metadaten: ein Feld *ist* die Einheit,
   * in der auf einer Karte gerechnet wird. Foundry nennt dasselbe
   * `gridDistance` und `gridUnits`.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen — fehlt es,
   * gilt die Vorgabe aus `defaultGrid()`.
   */
  distance?: GridDistance;
}

/** Maßstab und Metrik eines Rasters. */
export interface GridDistance {
  /** Spielweltdistanz eines Feldes, etwa 1.5 für „anderthalb Meter". */
  perTile: number;
  /** Einheit, wie sie angezeigt wird: „m", „ft", „km". */
  unit: string;
  /**
   * Wie diagonale Wege gezählt werden. Nur beim Quadratraster von Belang —
   * im Hexraster ist jeder Nachbar gleich weit, das ist gerade der Sinn.
   *
   * `chebyshev` ist die 5e-Regel (Diagonale zählt einfach), `alternating` die
   * ältere 5-10-5-Regel, `euclidean` misst wie mit dem Lineal.
   */
  metric: GridMetric;
}

export type GridMetric = 'chebyshev' | 'alternating' | 'euclidean' | 'manhattan';

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export type BlendMode =
  | 'normal'
  | 'add'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference';

/**
 * Reservierte Layer-Ids für Systemebenen. Sie stehen im selben Stapel wie die
 * Benutzer-Layer und sind darum frei positionierbar, lassen sich aber nicht
 * löschen und nehmen keine Objekte auf.
 */
export const SYSTEM_GRID: LayerId = '__grid__';
export const SYSTEM_VTT: LayerId = '__vtt__';

export function isSystemLayer(id: LayerId): boolean {
  return id === SYSTEM_GRID || id === SYSTEM_VTT;
}

/**
 * Was ein Layer aufnimmt.
 *
 * `objects` ist der Normalfall: Props, Zeichnungen, Text, Flächen. `height`
 * ist eine Rasterebene für Weltkarten — dort liegen keine Objekte, sondern ein
 * Höhenfeld, und gemalt wird nicht mit Formen, sondern mit einem Pinsel, der
 * anhebt und absenkt.
 *
 * Optional, damit ältere Projektdateien unverändert weiterladen; fehlt es,
 * ist der Layer ein Objektlayer.
 */
export type LayerKind = 'objects' | 'height';

/**
 * Höhenfeld einer Rasterebene.
 *
 * `cols`/`rows` sind *Stützstellen*, nicht Felder: `samplesPerTile` sagt, wie
 * viele davon auf ein Kartenfeld kommen. Mit einer Stützstelle je Feld sah
 * jede Küste treppig aus — das Raster einer Weltkarte ist grob, die Küste
 * darin aber die auffälligste Linie. Zwei je Feld kosten viermal so viel
 * Speicher und lösen es; die Datei ist ohnehin gezippt.
 *
 * `data` läuft zeilenweise, Werte von 0 (Tiefsee) bis 1 (Gipfel).
 */
export interface HeightMap {
  cols: number;
  rows: number;
  /** Stützstellen je Kartenfeld. */
  samplesPerTile: number;
  data: number[];
  /**
   * Gemalte Biome je Stützstelle, gleiche Länge wie `data`.
   *
   * 0 heißt: kein Biom gemalt, die Farbe kommt aus der Höhe. Sonst der Index
   * in `BIOMES`, um eins erhöht. Getrennt vom Höhenfeld und nicht als
   * zweiter Wert je Stützstelle, weil die meisten Karten gar kein Biom malen —
   * dann bleibt das Feld ganz weg und die Datei kleiner.
   *
   * Die Höhe bleibt auch dort erhalten, wo ein Biom gemalt ist: die
   * Schattierung kommt weiter aus der Steigung, und ein übermaltes Gebirge
   * sieht darum immer noch nach Gebirge aus.
   */
  biome?: number[];
}

/**
 * Malbare Biome.
 *
 * Eine feste, kurze Liste statt frei wählbarer Farben: auf einer Weltkarte
 * geht es darum, *Gegenden* zu unterscheiden, und dafür ist ein benannter
 * Satz besser als ein Farbwähler — die Karte bleibt in sich stimmig, und der
 * Name steht später in der Legende.
 */
export interface Biome {
  id: string;
  color: number;
}

export const BIOMES: Biome[] = [
  { id: 'water', color: 0x4b87ad },
  { id: 'marsh', color: 0x5f7a52 },
  { id: 'grass', color: 0x8fae5f },
  { id: 'forest', color: 0x4f7a42 },
  { id: 'taiga', color: 0x3f6350 },
  { id: 'steppe', color: 0xb5ac6a },
  { id: 'desert', color: 0xd9c48a },
  { id: 'badland', color: 0xa9714f },
  { id: 'rock', color: 0x8a8074 },
  { id: 'snow', color: 0xe8ecef },
];

/** Meereshöhe: darunter ist Wasser, darüber Land. */
export const SEA_LEVEL = 0.4;

export interface Layer {
  id: LayerId;
  name: string;
  /** Objektlayer oder Höhenraster; fehlt heißt `objects`. */
  kind?: LayerKind;
  /** Gruppen nehmen keine Objekte auf, nur weitere Layer. */
  isGroup: boolean;
  parentId: LayerId | null;
  /** Kinder von unten nach oben. Nur bei isGroup befüllt. */
  children: LayerId[];
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend: BlendMode;
  includeInExport: boolean;
  /**
   * Bildfilter dieses Layers. Fehlt oder null heißt: keine.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen — sie kennen
   * das Feld nicht, und das ist auch die richtige Vorgabe.
   */
  filters?: FilterSettings | null;
}

// ---------------------------------------------------------------------------
// Objekte
// ---------------------------------------------------------------------------

export interface BaseObject {
  id: ObjectId;
  layerId: LayerId;
  /** Weltkoordinaten des Ankerpunkts. */
  x: number;
  y: number;
  /** Bogenmaß. */
  rotation: number;
  opacity: number;
  /** Sortierung innerhalb des Layers, klein = weiter hinten. */
  z: number;
  locked: boolean;
  /**
   * Zugehörigkeit zu einer Objektgruppe; fehlt oder null heißt: keine.
   *
   * Bewusst nur eine Kennung am Objekt und kein Baum wie bei den Layern.
   * Gruppen sollen hier eine Auswahlhilfe sein — wer eines anfasst, fasst
   * alle an —, nicht eine zweite Hierarchie neben dem Layer-Stapel.
   * Verschachtelte Gruppen brächten Fragen mit sich (welche Ebene fasst man
   * an?), die den Nutzen nicht aufwiegen.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen.
   */
  groupId?: string | null;
}

export interface PropObject extends BaseObject {
  kind: 'prop';
  /** Verweist auf eine PropDef in der Bibliothek. */
  propId: string;
  scaleX: number;
  scaleY: number;
  /** 0xRRGGBB, oder null für Originalfarbe. */
  tint: number | null;
  flipX: boolean;
  flipY: boolean;
  /** Steuert prozedurale Varianten — gleicher Seed, gleiches Aussehen. */
  seed: number;
}

export type ShapeKind = 'freehand' | 'line' | 'rect' | 'ellipse' | 'polygon';

/**
 * Muster über einer Farbe — für Flächen wie für Striche.
 *
 * `size` ist die Kachelkante in Weltpixeln, nicht ein Anteil der Fläche —
 * sonst würden Ziegel in einem großen Raum größer als in einem kleinen.
 */
export interface PatternSpec {
  kind: PatternKind;
  size: number;
  color: number;
  alpha: number;
  /** Drehung des Musters in Grad. */
  angle: number;
}

export interface Stroke {
  color: number;
  width: number;
  alpha: number;
  /** Strichmuster in Pixeln, leer = durchgezogen. */
  dash: number[];
  /**
   * Muster *im* Strich; fehlt oder null heißt: nur Farbe.
   *
   * Dafür gibt es einen konkreten Anlass: eine Steinwand soll nach Stein
   * aussehen und nicht nach einem grauen Balken. Ein breiter Strich mit
   * Ziegelmuster ist dafür der richtige Weg und nicht eine gefüllte Fläche —
   * ein Strich folgt dem Linienzug mit sauberen Ecken und schließt einen Ring
   * von selbst, ein Band aus versetzten Punkten müsste beides nachbauen.
   */
  pattern?: PatternSpec | null;
}

/**
 * Musterarten für Flächen.
 *
 * Eine feste Auswahl statt frei gezeichneter Kacheln: die sieben decken ab,
 * wofür auf Karten Muster gebraucht werden — Boden, Wand, Dach, Wasser —, und
 * jede ist aus wenigen Linien gebaut und damit in jeder Größe scharf.
 */
export type PatternKind =
  | 'hatch'
  | 'crosshatch'
  | 'bricks'
  | 'planks'
  | 'tiles'
  | 'dots'
  | 'scales';

export const PATTERN_KINDS: PatternKind[] = [
  'hatch',
  'crosshatch',
  'bricks',
  'planks',
  'tiles',
  'dots',
  'scales',
];

export interface Fill {
  color: number;
  alpha: number;
  /**
   * Zweite Farbe für einen Verlauf; fehlt oder null heißt: einfarbig.
   *
   * Bewusst nur zwei Farben und ein Winkel statt beliebiger Farbstopps: für
   * Kartenflächen — Wasser, das nach außen dunkler wird, eine Wiese mit
   * Lichtstimmung — reicht das, und ein Stopp-Editor wäre viel Oberfläche für
   * einen seltenen Fall.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen.
   */
  gradient?: {
    color: number;
    /** Richtung in Grad; 0 = links nach rechts, 90 = oben nach unten. */
    angle: number;
    /** 'linear' oder 'radial' — radial läuft von der Mitte nach außen. */
    type: 'linear' | 'radial';
  } | null;
  /**
   * Muster *über* der Farbe; fehlt oder null heißt: nur Farbe.
   *
   * Bewusst obenauf und nicht anstelle der Farbe: ein Ziegelboden ist eine
   * Grundfarbe *mit* Fugen, ein Holzboden eine Grundfarbe *mit* Dielenkanten.
   * Ein Muster, das die Farbe ersetzt, könnte beides nicht.
   *
   * `size` ist die Kachelkante in Weltpixeln, nicht ein Anteil der Fläche —
   * sonst würden Ziegel in einem großen Raum größer als in einem kleinen.
   */
  pattern?: PatternSpec | null;
}

/**
 * Reiseroute: ein Weg mit Tagesmarken.
 *
 * Steht an der Zeichnung und nicht als eigene Objektart, weil eine Route eine
 * ist: ein Linienzug mit Strich und Farbe. Neu ist nur, dass sie weiß, wie
 * weit man an einem Tag kommt — und dass der Renderer daraus Querstriche
 * setzt. Fehlt das Feld, ist es eine gewöhnliche Zeichnung.
 */
export interface RouteSpec {
  /** Tagesmarsch in der Distanzeinheit des Rasters, etwa 40 für „40 km". */
  perDay: number;
  /** Querstriche zeichnen? Aus ergibt einen schlichten Weg. */
  marks: boolean;
}

export interface ShapeObject extends BaseObject {
  kind: 'shape';
  shape: ShapeKind;
  /** Lokale Koordinaten relativ zu (x,y), flach: [x0,y0,x1,y1,…]. */
  points: number[];
  stroke: Stroke | null;
  fill: Fill | null;
  closed: boolean;
  blend: BlendMode;
  /**
   * Reiseroute; fehlt oder null heißt: gewöhnliche Zeichnung.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen — sie kennen
   * das Feld nicht, und das ist auch die richtige Vorgabe.
   */
  route?: RouteSpec | null;
  /**
   * Gehört als Mauerwerk zu einer Wand oder Tür. Solche Zeichnungen sind
   * nicht einzeln anfassbar; sie folgen der Wand (`model/vttVisuals.ts`).
   */
  vttLink?: { kind: 'walls' | 'portals'; id: string };
}

export interface TextObject extends BaseObject {
  kind: 'text';
  text: string;
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
  /**
   * Wölbung des Textpfads, -1 bis 1; 0 oder fehlend heißt gerade.
   *
   * Statt eines frei gezeichneten Pfades ein einziger Wert: für
   * Weltkarten-Beschriftungen — ein Name über einer Bucht, über einem Gebirge —
   * ist ein Bogen das, was gebraucht wird, und er lässt sich mit einem Regler
   * einstellen statt mit einem zweiten Werkzeug.
   *
   * Der Renderer legt daraus einen Pfad an; `layoutOnPath` im Modell kann
   * beliebige Pfade, falls später doch gezeichnete dazukommen.
   */
  curvature?: number;
  /**
   * Bezugsobjekt, an dem die Beschriftung hängt.
   *
   * Wer das Objekt verschiebt, verschiebt die Beschriftung mit; wer es löscht,
   * löscht sie mit. Gespeichert wird nur die *Kennung*, nicht der Abstand: die
   * Beschriftung behält ihre eigenen Koordinaten und wird beim Verschieben um
   * denselben Betrag mitgenommen. Damit bleibt sie frei verschiebbar, ohne dass
   * ein zweiter Ort für dieselbe Information entsteht.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen.
   */
  anchorId?: ObjectId | null;
}

export type MapObject = PropObject | ShapeObject | TextObject;

// ---------------------------------------------------------------------------
// VTT-Daten (Wände, Türen, Lichter)
// ---------------------------------------------------------------------------

export type WallType = 'normal' | 'invisible' | 'ethereal' | 'window';

/**
 * Was ein Wandzug einzeln sperrt.
 *
 * Foundry führt diese vier Kanäle getrennt: eine Wand kann Licht aufhalten und
 * Sicht durchlassen, oder Schall schlucken, ohne sonst etwas zu tun. Universal
 * VTT kennt das nicht — dort gibt es nur „Sichtlinie" und „Objekt-Sichtlinie".
 * Deshalb steht es hier im Modell und geht über das Foundry-Makro hinaus, was
 * die Datei nicht fassen kann.
 */
export interface WallSenses {
  move: boolean;
  sight: boolean;
  light: boolean;
  sound: boolean;
}

export interface Wall {
  id: string;
  /** Zusammenhängender Wandzug in Weltpixeln, flach: [x0,y0,x1,y1,…]. */
  points: number[];
  type: WallType;
  closed: boolean;
  /**
   * Abweichende Sperren.
   *
   * Fehlt das Feld, gilt die Voreinstellung des Typs (`sensesOf` in
   * `model/wallSenses.ts`). Optional, damit ältere Karten unverändert weiter
   * gelten und eine gewöhnliche Wand nicht vier redundante Flags mitschleppt.
   */
  senses?: WallSenses;
  /**
   * Sichtbares Mauerwerk als Teil der Wand (Rückmeldung: Wand und Textur
   * ließen sich auseinandernehmen). Die Zeichnung dazu leitet
   * `model/vttVisuals.ts` nach jeder Änderung aus der Wand ab.
   */
  style?: string;
  /** Layer, auf dem das Mauerwerk liegt. */
  styleLayerId?: LayerId;
}

export interface Portal {
  id: string;
  /** Genau zwei Punkte in Weltpixeln: Anfang und Ende der Öffnung. */
  bounds: [number, number, number, number];
  closed: boolean;
  freestanding: boolean;
  /** Wie bei `Wall`: sichtbares Stück als Teil der Tür. */
  style?: string;
  styleLayerId?: LayerId;
}

export interface LightSource {
  id: string;
  x: number;
  y: number;
  /** Radius in Tiles — so verlangt es das UVTT-Format. */
  range: number;
  intensity: number;
  color: number;
  alpha: number;
  shadows: boolean;
}

/**
 * Symbol des Notiz-Pins. Bewusst eine kleine feste Auswahl statt freier
 * Bilddateien: die Namen müssen auf der anderen Seite — in Foundry — wieder
 * auf ein Icon treffen, und eine Auswahl, die dort ankommt, ist mehr wert als
 * eine, die beliebig ist.
 */
export type NoteIcon =
  | 'marker'
  | 'info'
  | 'danger'
  | 'treasure'
  | 'door'
  | 'secret'
  | 'combat'
  | 'quest';

export const NOTE_ICONS: NoteIcon[] = [
  'marker',
  'info',
  'danger',
  'treasure',
  'door',
  'secret',
  'combat',
  'quest',
];

/**
 * Notiz auf der Karte — in Foundry eine Journalnotiz mit Pin.
 *
 * Sie steht bei den VTT-Daten und nicht bei den Objekten, weil sie dasselbe
 * beschreibt wie Wände und Lichter: was das VTT bauen soll, nicht was auf dem
 * Bild zu sehen ist. Darum landet sie auch nie im Bild-Export.
 *
 * `text` ist der Inhalt der Journalseite. Absätze werden beim Erzeugen der
 * Foundry-Seite zu `<p>`; Formatierung darüber hinaus gibt es hier bewusst
 * nicht — wer mehr braucht, schreibt es in Foundry weiter.
 */
export interface MapNote {
  id: string;
  /** Weltpixel, wie bei allem anderen. */
  x: number;
  y: number;
  title: string;
  text: string;
  icon: NoteIcon;
  /** Kantenlänge des Pins in Tiles. */
  size: number;
  color: number;
  /**
   * Sehen Spieler den Pin? Falsch heißt: nur die Spielleitung.
   *
   * Das ist der übliche Fall — die meisten Notizen sind Vorbereitung, keine
   * Spielerinformation —, aber die Voreinstellung gehört ins Panel, nicht
   * hierher.
   */
  playerVisible: boolean;
}

export interface VttData {
  walls: Wall[];
  portals: Portal[];
  lights: LightSource[];
  /**
   * Notizen. Optional im Typ wäre bequemer für alte Dateien, aber `migrate`
   * füllt das Feld beim Laden auf — dafür bleibt jeder Lesezugriff einfach.
   */
  notes: MapNote[];
  ambientLight: number;
  ambientAlpha: number;
  bakedLighting: boolean;
}

// ---------------------------------------------------------------------------
// Dokument
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1;

/**
 * Eine Hilfslinie: waagerecht oder senkrecht, an einer Weltkoordinate.
 *
 * Im Dokument und nicht in der Ansicht: wer eine Karte an Hilfslinien
 * ausrichtet, will sie beim nächsten Öffnen wiederhaben. Sie werden nie
 * exportiert — weder ins Bild noch nach Foundry.
 */
export interface Guide {
  id: string;
  /** `x` ist eine senkrechte Linie an dieser x-Koordinate. */
  axis: 'x' | 'y';
  pos: number;
}

export interface MapDocument {
  schemaVersion: number;
  meta: {
    name: string;
    created: string;
    modified: string;
  };
  /** Kartengröße in Tile-Einheiten. */
  size: { cols: number; rows: number };
  grid: GridSettings;
  background: number;
  layers: Record<LayerId, Layer>;
  /** Wurzelebene des Layer-Stapels, von unten nach oben. */
  rootLayers: LayerId[];
  objects: Record<ObjectId, MapObject>;
  /**
   * Höhenfelder der Rasterebenen, nach Layer-Kennung.
   *
   * Getrennt von `layers` und nicht als Feld darin: das Layer-Objekt wird
   * überall herumgereicht und in Panels durchgezählt, und ein Array mit
   * zwanzigtausend Zahlen daran hängen zu haben, macht jedes Kopieren teuer.
   *
   * Optional, damit ältere Projektdateien unverändert weiterladen.
   */
  heightMaps?: Record<LayerId, HeightMap>;
  vtt: VttData;
  /** Filter über der ganzen Karte, zusätzlich zu denen einzelner Layer. */
  filters?: FilterSettings | null;
  /**
   * Hilfslinien am Lineal. Optional, damit ältere Projektdateien unverändert
   * weiterladen.
   */
  guides?: Guide[];
}
