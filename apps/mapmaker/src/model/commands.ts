/**
 * Undo/Redo nach dem Command-Pattern.
 *
 * Jeder Befehl beschreibt selbst, was er verändert hat (DocChange[]). Der
 * Renderer wertet das aus und aktualisiert gezielt statt alles neu zu bauen —
 * bei zwanzigtausend Props der Unterschied zwischen flüssig und unbenutzbar.
 *
 * Befehle mutieren das Dokument direkt. Das ist Absicht: bei Kartengrößen bis
 * 150×150 Tiles wäre unveränderliches Kopieren pro Pinselpunkt zu teuer.
 */

import { makeId } from './ids';
import { mapPixelSize } from './grid';
import { flattenLayers, layerSubtree, nextZ, siblingsOf, touchModified, wouldCycle } from './document';
import { t } from '@/i18n';
import type { FilterSettings } from './filters';
import {
  SYSTEM_GRID,
  SYSTEM_VTT,
  isSystemLayer,
  type Ebene,
  type GridSettings,
  type Guide,
  type HeightMap,
  type Layer,
  type LayerId,
  type MapDocument,
  type MapObject,
  type ObjectId,
} from './types';

// ---------------------------------------------------------------------------
// Änderungsmeldungen
// ---------------------------------------------------------------------------

export type DocChange =
  /** Diese Objekte wurden hinzugefügt, geändert oder entfernt. */
  | { type: 'objects'; ids: ObjectId[] }
  /** Layer-Stapel, Sichtbarkeit, Deckkraft oder Blendmodus haben sich geändert. */
  | { type: 'layers' }
  | { type: 'grid' }
  | { type: 'vtt' }
  /** Hilfslinien sind dazugekommen, verschoben oder verschwunden. */
  | { type: 'guides' }
  /**
   * Das Höhenfeld dieser Rasterebene hat sich geändert.
   *
   * `minRow`/`maxRow` grenzen ein, welche Zeilen betroffen sind. Der Renderer
   * färbt nur diese neu ein — über das ganze Feld zu laufen kostete auf einer
   * 150×150-Karte neun Millisekunden je Bild, mehr als die Hälfte des
   * Bildbudgets, obwohl ein Pinselabdruck nur ein paar Zeilen anfasst.
   * Fehlen sie, wird alles neu eingefärbt.
   */
  | { type: 'height'; layerId: LayerId; minRow?: number; maxRow?: number }
  /** Kartengröße oder Hintergrund — Renderer muss die Bühne neu vermessen. */
  | { type: 'canvas' }
  /**
   * Kartenname. Am Bild ändert sich nichts, aber die Oberfläche zeigt ihn —
   * der Renderer darf das getrost überlesen.
   */
  | { type: 'meta' }
  /** Alles neu — nach Laden einer Projektdatei. */
  | { type: 'all' };

export interface Command {
  label: string;
  /**
   * Wenn gesetzt, verschmilzt der Befehl mit dem direkt davor ausgeführten
   * Befehl gleichen Schlüssels. Für Schieberegler, damit ein Zug nicht
   * hundert Undo-Schritte erzeugt.
   */
  mergeKey?: string;
  do(doc: MapDocument): DocChange[];
  undo(doc: MapDocument): DocChange[];
  /**
   * Nimmt den folgenden Befehl in sich auf — ein Pinselstrich, ein Ziehvorgang.
   *
   * **Gibt zurück, ob das gelungen ist.** Ein `absorb`, das nicht passt (andere
   * Art, andere Ebene, anderes Ziel), muss `false` melden: die History wirft
   * den Befehl sonst weg, obwohl seine Wirkung schon im Dokument steht — und
   * dann gibt es keinen Weg mehr zurück. Genau daran hing ein Fehler, den erst
   * der Zufallslauf gefunden hat.
   */
  absorb?(next: Command): boolean;
}

/**
 * Mehrere Befehle als ein Undo-Schritt.
 *
 * `beginTransaction()` allein reicht dafür nicht: die Klammer verschmilzt nur
 * *gleichartige* Befehle über ihren `mergeKey`. Wo ein Vorgang verschiedene
 * Dinge anfasst — ein Raum erzeugt Wände *und* einen Boden, Entf löscht
 * Objekte *und* VTT-Elemente — liegen sonst zwei Einträge im Verlauf, und ein
 * Rückgängig nimmt nur die Hälfte zurück.
 *
 * Rückgängig läuft in umgekehrter Reihenfolge, damit Befehle, die aufeinander
 * aufbauen, sauber abgewickelt werden.
 */
export class CompositeCommand implements Command {
  label: string;

  constructor(
    private commands: Command[],
    label?: string,
  ) {
    this.label = label ?? commands[0]?.label ?? '';
  }

  do(doc: MapDocument): DocChange[] {
    const changes: DocChange[] = [];
    for (const cmd of this.commands) changes.push(...cmd.do(doc));
    return changes;
  }

  undo(doc: MapDocument): DocChange[] {
    const changes: DocChange[] = [];
    for (let i = this.commands.length - 1; i >= 0; i--) {
      changes.push(...this.commands[i].undo(doc));
    }
    return changes;
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const MERGE_WINDOW_MS = 600;

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private lastExecAt = 0;
  private limit: number;
  private txDepth = 0;

  constructor(limit = 200) {
    this.limit = limit;
  }

  /**
   * Klammert einen zusammenhängenden Vorgang — einen Ziehvorgang, einen
   * Pinselstrich. Innerhalb der Klammer verschmelzen gleichartige Befehle
   * unabhängig davon, wie lange der Benutzer zwischendurch innehält.
   */
  beginTransaction(): void {
    this.txDepth++;
  }

  endTransaction(): void {
    this.txDepth = Math.max(0, this.txDepth - 1);
    if (this.txDepth === 0) this.lastExecAt = 0;
  }

  /**
   * Läuft gerade eine geklammerte Folge — ein Zug, ein Pinselstrich?
   *
   * Das automatische Speichern fragt danach: mitten in einen Strich zu
   * schreiben ergäbe eine Datei mit einem halben Strich darin.
   */
  get inTransaction(): boolean {
    return this.txDepth > 0;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }
  get redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null;
  }

  exec(doc: MapDocument, cmd: Command): DocChange[] {
    const changes = cmd.do(doc);
    touchModified(doc);

    const prev = this.undoStack.at(-1);
    const canMerge =
      !!cmd.mergeKey &&
      !!prev &&
      prev.mergeKey === cmd.mergeKey &&
      !!prev.absorb &&
      (this.txDepth > 0 || Date.now() - this.lastExecAt < MERGE_WINDOW_MS);

    // `absorb` darf ablehnen — dann bleibt der Befehl ein eigener Schritt.
    // Ihn trotzdem zu verwerfen hieße: seine Wirkung steht im Dokument, aber
    // kein Rückgängig kommt mehr daran.
    if (canMerge && prev!.absorb!(cmd)) {
      // aufgenommen — nichts weiter zu tun
    } else {
      this.undoStack.push(cmd);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }

    this.redoStack.length = 0;
    this.lastExecAt = Date.now();
    return changes;
  }

  undo(doc: MapDocument): DocChange[] | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    const changes = cmd.undo(doc);
    this.redoStack.push(cmd);
    touchModified(doc);
    this.lastExecAt = 0;
    return changes;
  }

  redo(doc: MapDocument): DocChange[] | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    const changes = cmd.do(doc);
    this.undoStack.push(cmd);
    touchModified(doc);
    this.lastExecAt = 0;
    return changes;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lastExecAt = 0;
  }
}

// ---------------------------------------------------------------------------
// Objekt-Befehle
// ---------------------------------------------------------------------------

/** Fügt fertige Objekte ein. Ein ganzer Pinselstrich kommt als *ein* Befehl. */
export class AddObjects implements Command {
  label: string;
  mergeKey?: string;
  private objects: MapObject[];

  constructor(objects: MapObject[], label = t('cmd.addObjects'), mergeKey?: string) {
    this.objects = objects;
    this.label = label;
    this.mergeKey = mergeKey;
  }

  /** Ein Pinselstrich kommt in vielen Häppchen an, soll aber ein Undo-Schritt sein. */
  absorb(next: Command): boolean {
    if (!(next instanceof AddObjects)) return false;
    this.objects.push(...next.objects);
    return true;
  }

  do(doc: MapDocument): DocChange[] {
    for (const o of this.objects) doc.objects[o.id] = o;
    return [{ type: 'objects', ids: this.objects.map((o) => o.id) }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const o of this.objects) delete doc.objects[o.id];
    return [{ type: 'objects', ids: this.objects.map((o) => o.id) }];
  }
}

/**
 * Ersetzt eine Menge Objekte durch eine andere — der Radiergummi.
 *
 * Ein Radierstrich kann alles drei auf einmal tun: einen Zug kürzen (dasselbe
 * Objekt mit weniger Punkten), ihn zerlegen (ein Objekt wird zu zweien) und
 * ihn ganz entfernen. Als Patch, Add und Remove nebeneinander wäre das ein
 * Rückgängig-Schritt aus drei Teilen; hier ist es einer.
 *
 * `before` ist der Stand vor dem *ganzen* Strich, nicht vor dem letzten
 * Häppchen: beim Verschmelzen übernimmt der Befehl nur das neue Ergebnis und
 * behält seinen Ausgangsstand. Ein Rückgängig führt damit an den Anfang des
 * Strichs zurück, wie bei jedem anderen Zug auch.
 */
export class EraseStrokes implements Command {
  label: string;
  mergeKey?: string;

  constructor(
    private before: MapObject[],
    private after: MapObject[],
    label = t('cmd.erase'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  private betroffene(): ObjectId[] {
    return [...new Set([...this.before.map((o) => o.id), ...this.after.map((o) => o.id)])];
  }

  do(doc: MapDocument): DocChange[] {
    for (const o of this.before) delete doc.objects[o.id];
    for (const o of this.after) doc.objects[o.id] = o;
    return [{ type: 'objects', ids: this.betroffene() }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const o of this.after) delete doc.objects[o.id];
    for (const o of this.before) doc.objects[o.id] = o;
    return [{ type: 'objects', ids: this.betroffene() }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof EraseStrokes)) return false;
    // Das Ergebnis ist immer das neueste. Der Ausgangsstand dagegen wächst:
    // ein Strich wandert über die Karte und trifft unterwegs Züge, die er zu
    // Beginn noch gar nicht kannte. Nur ihre erste Fassung zählt — würde sie
    // fehlen, löschte das Rückgängig sie, statt sie wiederherzustellen.
    const bekannt = new Set(this.before.map((o) => o.id));
    for (const o of next.before) {
      if (!bekannt.has(o.id)) this.before.push(o);
    }
    this.after = next.after;
    return true;
  }
}

export class RemoveObjects implements Command {
  label: string;
  private ids: ObjectId[];
  private removed: MapObject[] = [];

  constructor(ids: ObjectId[], label = t('cmd.removeObjects')) {
    this.ids = ids;
    this.label = label;
  }

  do(doc: MapDocument): DocChange[] {
    this.removed = [];
    for (const id of this.ids) {
      const o = doc.objects[id];
      if (!o) continue;
      this.removed.push(o);
      delete doc.objects[id];
    }
    return [{ type: 'objects', ids: this.ids }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const o of this.removed) doc.objects[o.id] = o;
    return [{ type: 'objects', ids: this.ids }];
  }
}

/**
 * Objekte zu einer Gruppe zusammenfassen oder die Gruppierung lösen.
 *
 * Eine Kennung am Objekt, kein Baum: Gruppen sind hier eine Auswahlhilfe, keine
 * zweite Hierarchie neben dem Layer-Stapel.
 */
export class SetObjectGroup implements Command {
  label: string;
  private previous = new Map<ObjectId, string | null | undefined>();

  constructor(
    private ids: ObjectId[],
    private groupId: string | null,
    label = t('cmd.groupObjects'),
  ) {
    this.label = label;
  }

  do(doc: MapDocument): DocChange[] {
    if (this.previous.size === 0) {
      for (const id of this.ids) {
        const o = doc.objects[id];
        if (o) this.previous.set(id, o.groupId);
      }
    }
    for (const id of this.ids) {
      const o = doc.objects[id];
      if (o) o.groupId = this.groupId;
    }
    return [{ type: 'objects', ids: this.ids }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const [id, vorher] of this.previous) {
      const o = doc.objects[id];
      if (o) o.groupId = vorher ?? null;
    }
    return [{ type: 'objects', ids: this.ids }];
  }
}

type ObjectPatch = Partial<Omit<MapObject, 'id' | 'kind'>> & Record<string, unknown>;

/**
 * Generische Eigenschaftsänderung an mehreren Objekten. Deckt Verschieben,
 * Drehen, Skalieren, Färben und alle Inspektor-Felder ab — ein Befehl statt
 * einem Dutzend fast identischer Klassen.
 */
export class PatchObjects implements Command {
  label: string;
  mergeKey?: string;
  private patches: Map<ObjectId, ObjectPatch>;
  private inverse: Map<ObjectId, ObjectPatch> = new Map();

  constructor(
    patches: Map<ObjectId, ObjectPatch> | Record<ObjectId, ObjectPatch>,
    label = t('cmd.patchObjects'),
    mergeKey?: string,
  ) {
    this.patches = patches instanceof Map ? patches : new Map(Object.entries(patches));
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    // Inverse nur beim ersten Ausführen aufzeichnen; bei Redo steht sie schon.
    const recordInverse = this.inverse.size === 0;
    for (const [id, patch] of this.patches) {
      const o = doc.objects[id] as unknown as Record<string, unknown>;
      if (!o) continue;
      if (recordInverse) {
        const inv: ObjectPatch = {};
        for (const key in patch) inv[key] = o[key];
        this.inverse.set(id, inv);
      }
      Object.assign(o, patch);
    }
    return [{ type: 'objects', ids: [...this.patches.keys()] }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const [id, patch] of this.inverse) {
      const o = doc.objects[id] as unknown as Record<string, unknown>;
      if (o) Object.assign(o, patch);
    }
    return [{ type: 'objects', ids: [...this.patches.keys()] }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PatchObjects)) return false;
    for (const [id, patch] of next.patches) {
      // Die eigene Inverse bleibt der Ausgangszustand vor dem ersten Befehl.
      if (!this.inverse.has(id)) this.inverse.set(id, next.inverse.get(id) ?? {});
      this.patches.set(id, { ...(this.patches.get(id) ?? {}), ...patch });
    }
    return true;
  }
}

/** Verschiebt Objekte an den Anfang oder das Ende ihres Layers. */
export class ReorderObjects implements Command {
  label: string;
  private ids: ObjectId[];
  private toFront: boolean;
  private previousZ = new Map<ObjectId, number>();

  constructor(ids: ObjectId[], toFront: boolean) {
    this.ids = ids;
    this.toFront = toFront;
    this.label = toFront ? t('cmd.toFront') : t('cmd.toBack');
  }

  do(doc: MapDocument): DocChange[] {
    this.previousZ.clear();
    for (const id of this.ids) {
      const o = doc.objects[id];
      if (!o) continue;
      this.previousZ.set(id, o.z);
      o.z = this.toFront ? nextZ(doc, o.layerId) : this.minZ(doc, o.layerId) - 1;
    }
    return [{ type: 'objects', ids: this.ids }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const [id, z] of this.previousZ) {
      const o = doc.objects[id];
      if (o) o.z = z;
    }
    return [{ type: 'objects', ids: this.ids }];
  }

  private minZ(doc: MapDocument, layerId: LayerId): number {
    let min = 0;
    for (const id in doc.objects) {
      const o = doc.objects[id];
      if (o.layerId === layerId && o.z < min) min = o.z;
    }
    return min;
  }
}

/** Schiebt eine Auswahl in einen anderen Layer, ohne sie zu verschieben. */
export class MoveObjectsToLayer implements Command {
  label = t('cmd.moveToLayer');
  private ids: ObjectId[];
  private targetId: LayerId;
  private previous = new Map<ObjectId, { layerId: LayerId; z: number }>();

  constructor(ids: ObjectId[], targetId: LayerId) {
    this.ids = ids;
    this.targetId = targetId;
  }

  do(doc: MapDocument): DocChange[] {
    this.previous.clear();
    let z = nextZ(doc, this.targetId);
    for (const id of this.ids) {
      const o = doc.objects[id];
      if (!o) continue;
      this.previous.set(id, { layerId: o.layerId, z: o.z });
      o.layerId = this.targetId;
      o.z = z++;
    }
    return [{ type: 'objects', ids: this.ids }, { type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    for (const [id, prev] of this.previous) {
      const o = doc.objects[id];
      if (o) {
        o.layerId = prev.layerId;
        o.z = prev.z;
      }
    }
    return [{ type: 'objects', ids: this.ids }, { type: 'layers' }];
  }
}

// ---------------------------------------------------------------------------
// Layer-Befehle
// ---------------------------------------------------------------------------

export class AddLayer implements Command {
  label: string;
  private layer: Layer;
  private index: number;

  /** `index` zählt innerhalb der Geschwister, -1 heißt „ganz oben". */
  constructor(layer: Layer, index = -1) {
    this.layer = layer;
    this.index = index;
    this.label = layer.isGroup ? t('cmd.addGroup') : t('cmd.addLayer');
  }

  do(doc: MapDocument): DocChange[] {
    doc.layers[this.layer.id] = this.layer;
    const list = this.layer.parentId ? doc.layers[this.layer.parentId].children : doc.rootLayers;
    const at = this.index < 0 ? list.length : Math.min(this.index, list.length);
    list.splice(at, 0, this.layer.id);
    this.index = at;
    return [{ type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    const list = this.layer.parentId ? doc.layers[this.layer.parentId].children : doc.rootLayers;
    const at = list.indexOf(this.layer.id);
    if (at >= 0) list.splice(at, 1);
    delete doc.layers[this.layer.id];
    return [{ type: 'layers' }];
  }
}

/** Löscht einen Layer samt Untergruppen und allen darin liegenden Objekten. */
export class RemoveLayer implements Command {
  label = t('cmd.removeLayer');
  private id: LayerId;
  private removedLayers: Layer[] = [];
  private removedObjects: MapObject[] = [];
  private parentId: LayerId | null = null;
  private index = -1;
  /**
   * Hat `do` überhaupt etwas getan?
   *
   * `do` steigt bei einer Systemebene wortlos aus, der Befehl landet aber
   * trotzdem im Verlauf. Ohne diese Notiz würde `undo` die Kennung danach in
   * den Stapel einfügen, obwohl die Ebene nie entfernt wurde — sie stünde
   * zweimal darin.
   */
  private applied = false;

  constructor(id: LayerId) {
    this.id = id;
  }

  do(doc: MapDocument): DocChange[] {
    const layer = doc.layers[this.id];
    if (!layer || isSystemLayer(this.id)) return [];
    this.applied = true;

    const subtree = layerSubtree(doc, this.id);
    const subtreeSet = new Set(subtree);

    this.removedObjects = [];
    for (const oid in doc.objects) {
      if (subtreeSet.has(doc.objects[oid].layerId)) this.removedObjects.push(doc.objects[oid]);
    }
    for (const o of this.removedObjects) delete doc.objects[o.id];

    this.removedLayers = subtree.map((lid) => doc.layers[lid]);
    for (const lid of subtree) delete doc.layers[lid];

    this.parentId = layer.parentId;
    const list = siblingsOfList(doc, this.parentId);
    this.index = list.indexOf(this.id);
    if (this.index >= 0) list.splice(this.index, 1);

    return [{ type: 'layers' }, { type: 'objects', ids: this.removedObjects.map((o) => o.id) }];
  }

  undo(doc: MapDocument): DocChange[] {
    if (!this.applied) return [];
    for (const l of this.removedLayers) doc.layers[l.id] = l;
    for (const o of this.removedObjects) doc.objects[o.id] = o;
    const list = siblingsOfList(doc, this.parentId);
    list.splice(Math.max(0, this.index), 0, this.id);
    return [{ type: 'layers' }, { type: 'objects', ids: this.removedObjects.map((o) => o.id) }];
  }
}

function siblingsOfList(doc: MapDocument, parentId: LayerId | null): LayerId[] {
  return parentId ? doc.layers[parentId].children : doc.rootLayers;
}

export class PatchLayer implements Command {
  label: string;
  mergeKey?: string;
  private id: LayerId;
  private patch: Partial<Layer>;
  private inverse: Partial<Layer> = {};
  private recorded = false;

  constructor(id: LayerId, patch: Partial<Layer>, label = t('cmd.patchLayer'), mergeKey?: string) {
    this.id = id;
    this.patch = patch;
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    const l = doc.layers[this.id] as unknown as Record<string, unknown>;
    if (!l) return [];
    if (!this.recorded) {
      for (const key in this.patch) (this.inverse as Record<string, unknown>)[key] = l[key];
      this.recorded = true;
    }
    Object.assign(l, this.patch);
    return [{ type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    const l = doc.layers[this.id];
    if (l) Object.assign(l, this.inverse);
    return [{ type: 'layers' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PatchLayer) || next.id !== this.id) return false;
    Object.assign(this.patch, next.patch);
    return true;
  }
}

/** Hängt einen Layer an eine andere Stelle im Stapel — Drag & Drop im Panel. */
export class MoveLayer implements Command {
  label = t('cmd.moveLayer');
  private id: LayerId;
  private newParent: LayerId | null;
  private newIndex: number;
  private oldParent: LayerId | null = null;
  private oldIndex = -1;
  /**
   * Hat `do` überhaupt etwas getan? Siehe `RemoveLayer`.
   *
   * Hier ist der Fall aus der Bedienung erreichbar: eine Gruppe auf einen
   * eigenen Nachfahren zu ziehen wird abgewiesen, sichtbar passiert nichts —
   * und ein anschließendes Rückgängig hätte die Ebene ein zweites Mal in den
   * Stapel gehängt.
   */
  private applied = false;

  constructor(id: LayerId, newParent: LayerId | null, newIndex: number) {
    this.id = id;
    this.newParent = newParent;
    this.newIndex = newIndex;
  }

  do(doc: MapDocument): DocChange[] {
    const layer = doc.layers[this.id];
    if (!layer) return [];
    if (wouldCycle(doc, this.id, this.newParent)) return [];
    if (this.newParent && !doc.layers[this.newParent]?.isGroup) return [];

    this.applied = true;
    this.oldParent = layer.parentId;
    const from = siblingsOfList(doc, this.oldParent);
    this.oldIndex = from.indexOf(this.id);
    if (this.oldIndex >= 0) from.splice(this.oldIndex, 1);

    const to = siblingsOfList(doc, this.newParent);
    to.splice(Math.max(0, Math.min(this.newIndex, to.length)), 0, this.id);
    layer.parentId = this.newParent;
    return [{ type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    if (!this.applied) return [];
    const layer = doc.layers[this.id];
    if (!layer) return [];
    const to = siblingsOfList(doc, this.newParent);
    const at = to.indexOf(this.id);
    if (at >= 0) to.splice(at, 1);
    const from = siblingsOfList(doc, this.oldParent);
    from.splice(Math.max(0, this.oldIndex), 0, this.id);
    layer.parentId = this.oldParent;
    return [{ type: 'layers' }];
  }
}

/**
 * Führt einen Layer mit dem darunterliegenden zusammen: alle Objekte wandern
 * hinüber, der obere Layer verschwindet.
 */
export class MergeLayerDown implements Command {
  label = t('cmd.mergeDown');
  private id: LayerId;
  private targetId: LayerId | null = null;
  private moved: Array<{ id: ObjectId; layerId: LayerId; z: number }> = [];
  private removeCmd: RemoveLayer | null = null;

  constructor(id: LayerId) {
    this.id = id;
  }

  /** Der nächste Objekt-Layer unterhalb im aufgeklappten Stapel. */
  private findTarget(doc: MapDocument): LayerId | null {
    const flat = flattenLayers(doc);
    const idx = flat.findIndex((l) => l.id === this.id);
    for (let i = idx - 1; i >= 0; i--) {
      const l = flat[i];
      if (!l.isGroup && !isSystemLayer(l.id)) return l.id;
    }
    return null;
  }

  do(doc: MapDocument): DocChange[] {
    const layer = doc.layers[this.id];
    if (!layer || layer.isGroup || isSystemLayer(this.id)) return [];
    this.targetId = this.targetId ?? this.findTarget(doc);
    if (!this.targetId) return [];

    this.moved = [];
    let z = nextZ(doc, this.targetId);
    for (const o of Object.values(doc.objects)) {
      if (o.layerId !== this.id) continue;
      this.moved.push({ id: o.id, layerId: o.layerId, z: o.z });
      o.layerId = this.targetId;
      o.z = z++;
    }

    this.removeCmd = new RemoveLayer(this.id);
    this.removeCmd.do(doc);
    return [{ type: 'layers' }, { type: 'objects', ids: this.moved.map((m) => m.id) }];
  }

  undo(doc: MapDocument): DocChange[] {
    this.removeCmd?.undo(doc);
    for (const m of this.moved) {
      const o = doc.objects[m.id];
      if (o) {
        o.layerId = m.layerId;
        o.z = m.z;
      }
    }
    return [{ type: 'layers' }, { type: 'objects', ids: this.moved.map((m) => m.id) }];
  }
}

/** Steckt bestehende Layer in eine neue Gruppe. */
export class GroupLayers implements Command {
  label = t('cmd.group');
  private ids: LayerId[];
  private group: Layer;
  private previous: Array<{ id: LayerId; parentId: LayerId | null; index: number }> = [];

  constructor(ids: LayerId[], group: Layer) {
    this.ids = ids;
    this.group = group;
  }

  do(doc: MapDocument): DocChange[] {
    // Doppelte Kennungen entfernen: sonst landet dieselbe Ebene zweimal in
    // `children`, steht danach zweimal im Stapel und lässt sich nicht mehr
    // sauber zurücknehmen — ein Schaden, den man erst in der Projektdatei sieht.
    const gewaehlt = [...new Set(this.ids)].filter((id) => doc.layers[id] && !isSystemLayer(id));

    /**
     * Wer schon in einer gewählten Gruppe steckt, kommt von allein mit.
     *
     * Ihn *zusätzlich* zum Mitglied zu machen, hängte die Gruppe unter ihr
     * eigenes Kind: die neue Gruppe käme neben das oberste Mitglied, und das
     * steht dann innerhalb der neuen Gruppe. Beide Ebenen wären danach von der
     * Wurzel aus nicht mehr erreichbar — die Karte hätte sie noch, der Stapel
     * nicht mehr.
     */
    const drin = new Set<LayerId>();
    for (const id of gewaehlt)
      for (const k of layerSubtree(doc, id)) if (k !== id) drin.add(k);
    const members = gewaehlt.filter((id) => !drin.has(id));
    if (members.length === 0) return [];

    // Die Gruppe erscheint dort, wo das oberste Mitglied stand.
    const flat = flattenLayers(doc).map((l) => l.id);
    const topMost = members.reduce((a, b) => (flat.indexOf(a) > flat.indexOf(b) ? a : b));
    const anchor = doc.layers[topMost];
    const anchorList = siblingsOfList(doc, anchor.parentId);
    const anchorIndex = anchorList.indexOf(topMost);

    this.previous = members.map((id) => {
      const l = doc.layers[id];
      const list = siblingsOfList(doc, l.parentId);
      return { id, parentId: l.parentId, index: list.indexOf(id) };
    });

    // Von oben nach unten entfernen, damit die gemerkten Indizes gültig bleiben.
    for (const p of [...this.previous].sort((a, b) => b.index - a.index)) {
      const list = siblingsOfList(doc, p.parentId);
      const at = list.indexOf(p.id);
      if (at >= 0) list.splice(at, 1);
    }

    this.group.isGroup = true;
    this.group.parentId = anchor.parentId;
    this.group.children = [...members];
    doc.layers[this.group.id] = this.group;
    for (const id of members) doc.layers[id].parentId = this.group.id;

    const insertAt = Math.min(anchorIndex, anchorList.length);
    anchorList.splice(Math.max(0, insertAt), 0, this.group.id);
    return [{ type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    const list = siblingsOfList(doc, this.group.parentId);
    const at = list.indexOf(this.group.id);
    if (at >= 0) list.splice(at, 1);
    delete doc.layers[this.group.id];

    for (const p of [...this.previous].sort((a, b) => a.index - b.index)) {
      const l = doc.layers[p.id];
      if (!l) continue;
      l.parentId = p.parentId;
      const target = siblingsOfList(doc, p.parentId);
      target.splice(Math.min(p.index, target.length), 0, p.id);
    }
    return [{ type: 'layers' }];
  }
}

// ---------------------------------------------------------------------------
// Dokument-Befehle
// ---------------------------------------------------------------------------

/**
 * Hilfslinien setzen.
 *
 * Ersetzt die ganze Liste statt einzelner Befehle für Anlegen, Verschieben und
 * Löschen. Es sind eine Handvoll Linien; drei Befehlsklassen für so wenig wären
 * mehr Bauwerk als Nutzen, und der Rückgängig-Schritt ist so oder so einer.
 */
export class SetGuides implements Command {
  label: string;
  mergeKey?: string;
  private previous: Guide[] | undefined;

  constructor(
    private next: Guide[],
    label = t('cmd.guides'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    if (this.previous === undefined) this.previous = doc.guides ? [...doc.guides] : [];
    doc.guides = [...this.next];
    return [{ type: 'guides' }];
  }

  undo(doc: MapDocument): DocChange[] {
    doc.guides = [...(this.previous ?? [])];
    return [{ type: 'guides' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof SetGuides)) return false;
    this.next = next.next;
    return true;
  }
}

export class PatchGrid implements Command {
  label: string;
  mergeKey?: string;
  private patch: Partial<GridSettings>;
  private inverse: Partial<GridSettings> = {};
  private recorded = false;

  constructor(patch: Partial<GridSettings>, label = t('cmd.patchGrid'), mergeKey?: string) {
    this.patch = patch;
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    const g = doc.grid as unknown as Record<string, unknown>;
    if (!this.recorded) {
      for (const key in this.patch) (this.inverse as Record<string, unknown>)[key] = g[key];
      this.recorded = true;
    }
    Object.assign(g, this.patch);
    // tileSize verändert die Kartenmaße, also muss die Bühne neu vermessen werden.
    return 'tileSize' in this.patch || 'type' in this.patch
      ? [{ type: 'grid' }, { type: 'canvas' }]
      : [{ type: 'grid' }];
  }

  undo(doc: MapDocument): DocChange[] {
    Object.assign(doc.grid, this.inverse);
    return [{ type: 'grid' }, { type: 'canvas' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PatchGrid)) return false;
    Object.assign(this.patch, next.patch);
    return true;
  }
}

export type ResizeAnchor =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

const ANCHOR_FACTORS: Record<ResizeAnchor, { fx: number; fy: number }> = {
  'top-left': { fx: 0, fy: 0 },
  top: { fx: 0.5, fy: 0 },
  'top-right': { fx: 1, fy: 0 },
  left: { fx: 0, fy: 0.5 },
  center: { fx: 0.5, fy: 0.5 },
  right: { fx: 1, fy: 0.5 },
  'bottom-left': { fx: 0, fy: 1 },
  bottom: { fx: 0.5, fy: 1 },
  'bottom-right': { fx: 1, fy: 1 },
};

/**
 * Ändert die Kartengröße in Tile-Einheiten. Der Anker bestimmt, an welcher
 * Kante angebaut bzw. beschnitten wird; der Inhalt wird entsprechend
 * mitverschoben, damit er relativ zum Anker stehen bleibt.
 */
export class ResizeMap implements Command {
  label = t('cmd.resizeMap');
  private cols: number;
  private rows: number;
  private anchor: ResizeAnchor;
  private oldSize = { cols: 0, rows: 0 };
  private shift = { dx: 0, dy: 0 };

  constructor(cols: number, rows: number, anchor: ResizeAnchor = 'top-left') {
    this.cols = Math.max(1, Math.round(cols));
    this.rows = Math.max(1, Math.round(rows));
    this.anchor = anchor;
  }

  do(doc: MapDocument): DocChange[] {
    this.oldSize = { ...doc.size };
    const before = mapPixelSize(doc.grid, doc.size);
    doc.size = { cols: this.cols, rows: this.rows };
    const after = mapPixelSize(doc.grid, doc.size);

    const { fx, fy } = ANCHOR_FACTORS[this.anchor];
    this.shift = { dx: (after.width - before.width) * fx, dy: (after.height - before.height) * fy };
    applyShift(doc, this.shift.dx, this.shift.dy);

    return [{ type: 'canvas' }, { type: 'objects', ids: Object.keys(doc.objects) }, { type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    applyShift(doc, -this.shift.dx, -this.shift.dy);
    doc.size = { ...this.oldSize };
    return [{ type: 'canvas' }, { type: 'objects', ids: Object.keys(doc.objects) }, { type: 'vtt' }];
  }
}

/** Verschiebt sämtlichen Karteninhalt — Objekte wie VTT-Geometrie. */
function applyShift(doc: MapDocument, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  for (const id in doc.objects) {
    doc.objects[id].x += dx;
    doc.objects[id].y += dy;
  }
  for (const w of doc.vtt.walls) {
    for (let i = 0; i < w.points.length; i += 2) {
      w.points[i] += dx;
      w.points[i + 1] += dy;
    }
  }
  for (const p of doc.vtt.portals) {
    p.bounds[0] += dx;
    p.bounds[1] += dy;
    p.bounds[2] += dx;
    p.bounds[3] += dy;
  }
  for (const l of doc.vtt.lights) {
    l.x += dx;
    l.y += dy;
  }
}

/**
 * Benennt die Karte um.
 *
 * Über einen Befehl und nicht durch direktes Setzen von `meta.name`: der Name
 * steht in der Titelzeile, im vorgeschlagenen Dateinamen und in jeder
 * gespeicherten Datei. Ihn am Verlauf vorbei zu ändern hieße, dass ein
 * Rückgängig ihn stehen ließe.
 */
export class RenameMap implements Command {
  label = t('cmd.renameMap');
  mergeKey?: string;
  private previous = '';
  private recorded = false;

  constructor(
    private name: string,
    mergeKey?: string,
  ) {
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    if (!this.recorded) {
      this.previous = doc.meta.name;
      this.recorded = true;
    }
    doc.meta.name = this.name;
    return [{ type: 'meta' }];
  }

  undo(doc: MapDocument): DocChange[] {
    doc.meta.name = this.previous;
    return [{ type: 'meta' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof RenameMap)) return false;
    this.name = next.name;
    return true;
  }
}

/** Lage über einer anderen Karte (`MapDocument.ebene`), ein Rückgängig-Schritt. */
export class SetEbene implements Command {
  label = t('cmd.ebene');
  private previous: Ebene | undefined;
  private recorded = false;

  constructor(private readonly patch: Ebene) {}

  do(doc: MapDocument): DocChange[] {
    if (!this.recorded) {
      this.previous = doc.ebene ? { ...doc.ebene } : undefined;
      this.recorded = true;
    }
    const neu: Ebene = { ...doc.ebene, ...this.patch };
    if (!neu.liegtUeber) delete neu.liegtUeber;
    if (!neu.bodenTransparent) delete neu.bodenTransparent;
    if (Object.keys(neu).length) doc.ebene = neu;
    else delete doc.ebene;
    return [{ type: 'canvas' }];
  }

  undo(doc: MapDocument): DocChange[] {
    if (this.previous) doc.ebene = { ...this.previous };
    else delete doc.ebene;
    return [{ type: 'canvas' }];
  }
}

export class SetBackground implements Command {
  label = t('cmd.background');
  mergeKey = 'background';
  private color: number;
  private previous = 0;
  private recorded = false;

  constructor(color: number) {
    this.color = color;
  }

  do(doc: MapDocument): DocChange[] {
    if (!this.recorded) {
      this.previous = doc.background;
      this.recorded = true;
    }
    doc.background = this.color;
    return [{ type: 'canvas' }];
  }

  undo(doc: MapDocument): DocChange[] {
    doc.background = this.previous;
    return [{ type: 'canvas' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof SetBackground)) return false;
    this.color = next.color;
    return true;
  }
}

// ---------------------------------------------------------------------------
// VTT-Ebene: Wände, Türen, Lichter, Notizen
// ---------------------------------------------------------------------------

export type VttKind = 'walls' | 'portals' | 'lights' | 'notes';

/** Fügt Wände, Türen, Lichter oder Notizen hinzu. Ein Wandzug ist ein Undo-Schritt. */
export class AddVttItems<K extends VttKind> implements Command {
  label: string;
  mergeKey?: string;

  constructor(
    private kind: K,
    private items: MapDocument['vtt'][K],
    label = t('cmd.vttAdd'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    (doc.vtt[this.kind] as unknown[]).push(...(this.items as unknown[]));
    return [{ type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    const ids = new Set((this.items as Array<{ id: string }>).map((i) => i.id));
    doc.vtt[this.kind] = (doc.vtt[this.kind] as Array<{ id: string }>).filter(
      (i) => !ids.has(i.id),
    ) as MapDocument['vtt'][K];
    return [{ type: 'vtt' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof AddVttItems) || next.kind !== this.kind) return false;
    (this.items as unknown[]).push(...(next.items as unknown[]));
    return true;
  }
}

/** Löscht VTT-Elemente und merkt sich ihre Position im Array für das Undo. */
export class RemoveVttItems implements Command {
  label: string;
  private removed: Array<{ kind: VttKind; index: number; item: unknown }> = [];

  constructor(
    private targets: Partial<Record<VttKind, string[]>>,
    label = t('cmd.vttRemove'),
  ) {
    this.label = label;
  }

  do(doc: MapDocument): DocChange[] {
    this.removed = [];
    for (const kind of ['walls', 'portals', 'lights', 'notes'] as VttKind[]) {
      const ids = this.targets[kind];
      if (!ids || ids.length === 0) continue;
      const wanted = new Set(ids);
      const list = doc.vtt[kind] as Array<{ id: string }>;
      // Von hinten, damit die gemerkten Indizes beim Wiedereinfügen stimmen.
      for (let i = list.length - 1; i >= 0; i--) {
        if (wanted.has(list[i].id)) {
          this.removed.push({ kind, index: i, item: list[i] });
          list.splice(i, 1);
        }
      }
    }
    return [{ type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    // Aufsteigend einfügen, sonst verschieben sich die Zielpositionen.
    for (const entry of [...this.removed].sort((a, b) => a.index - b.index)) {
      (doc.vtt[entry.kind] as unknown[]).splice(entry.index, 0, entry.item);
    }
    return [{ type: 'vtt' }];
  }
}

/** Ändert Eigenschaften einzelner VTT-Elemente. */
export class PatchVttItems implements Command {
  label: string;
  mergeKey?: string;
  private inverse = new Map<string, Record<string, unknown>>();

  constructor(
    private kind: VttKind,
    private patches: Map<string, Record<string, unknown>>,
    label = t('cmd.vttPatch'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    const recordInverse = this.inverse.size === 0;
    const list = doc.vtt[this.kind] as unknown as Array<Record<string, unknown> & { id: string }>;
    for (const item of list) {
      const patch = this.patches.get(item.id);
      if (!patch) continue;
      if (recordInverse) {
        const inv: Record<string, unknown> = {};
        for (const key in patch) inv[key] = item[key];
        this.inverse.set(item.id, inv);
      }
      Object.assign(item, patch);
    }
    return [{ type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    const list = doc.vtt[this.kind] as unknown as Array<Record<string, unknown> & { id: string }>;
    for (const item of list) {
      const inv = this.inverse.get(item.id);
      if (inv) Object.assign(item, inv);
    }
    return [{ type: 'vtt' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PatchVttItems) || next.kind !== this.kind) return false;
    for (const [id, patch] of next.patches) {
      if (!this.inverse.has(id)) this.inverse.set(id, next.inverse.get(id) ?? {});
      this.patches.set(id, { ...(this.patches.get(id) ?? {}), ...patch });
    }
    return true;
  }
}

/**
 * Filter eines Layers oder der ganzen Karte setzen.
 *
 * `layerId: null` meint die Karte. Beides in einem Befehl, weil es dieselbe
 * Sache ist — nur einmal auf einen Container, einmal auf alle.
 */
export class SetFilters implements Command {
  label: string;
  mergeKey?: string;
  private previous: FilterSettings | null | undefined;
  private recorded = false;

  constructor(
    private layerId: LayerId | null,
    private next: FilterSettings | null,
    label = t('cmd.filters'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    if (this.layerId === null) {
      if (!this.recorded) {
        this.previous = doc.filters;
        this.recorded = true;
      }
      doc.filters = this.next;
    } else {
      const layer = doc.layers[this.layerId];
      if (!layer) return [];
      if (!this.recorded) {
        this.previous = layer.filters;
        this.recorded = true;
      }
      layer.filters = this.next;
    }
    return [{ type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    // Nichts gemerkt heißt: `do` ist ausgestiegen, weil es die Ebene nicht
    // gab. Dann darf `undo` auch nichts setzen — sonst löscht es die Filter
    // einer Ebene, die es inzwischen wieder gibt.
    if (!this.recorded) return [];
    // Genau das zurückschreiben, was vorher dastand — auch „gar nichts".
    // `?? null` hätte aus einem nie gesetzten Feld ein gesetztes `null`
    // gemacht: gleichbedeutend, aber eben nicht mehr derselbe Zustand, und
    // in jeder gespeicherten Datei ein Feld mehr.
    if (this.layerId === null) doc.filters = this.previous;
    else {
      const layer = doc.layers[this.layerId];
      if (layer) layer.filters = this.previous;
    }
    return [{ type: 'layers' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof SetFilters) || next.layerId !== this.layerId) return false;
    this.next = next.next;
    return true;
  }
}

/** Umgebungslicht und „Licht ist ins Bild gebacken"-Flag. */
export class PatchVttEnvironment implements Command {
  label = t('cmd.ambient');
  mergeKey = 'vtt-env';
  private inverse: Partial<MapDocument['vtt']> = {};
  private recorded = false;

  constructor(private patch: Partial<MapDocument['vtt']>) {}

  do(doc: MapDocument): DocChange[] {
    const v = doc.vtt as unknown as Record<string, unknown>;
    if (!this.recorded) {
      for (const key in this.patch) (this.inverse as Record<string, unknown>)[key] = v[key];
      this.recorded = true;
    }
    Object.assign(v, this.patch);
    return [{ type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    Object.assign(doc.vtt, this.inverse);
    return [{ type: 'vtt' }];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PatchVttEnvironment)) return false;
    Object.assign(this.patch, next.patch);
    return true;
  }
}

/** Ersetzt die gesamte VTT-Ebene — für „Wände ableiten" und den UVTT-Import. */
export class ReplaceVtt implements Command {
  label: string;
  private previous: MapDocument['vtt'] | null = null;

  constructor(
    private next: MapDocument['vtt'],
    label = t('cmd.replaceWalls'),
  ) {
    this.label = label;
  }

  do(doc: MapDocument): DocChange[] {
    this.previous = doc.vtt;
    doc.vtt = this.next;
    return [{ type: 'vtt' }];
  }

  undo(doc: MapDocument): DocChange[] {
    if (this.previous) doc.vtt = this.previous;
    return [{ type: 'vtt' }];
  }
}

// ---------------------------------------------------------------------------
// Bequemlichkeit
// ---------------------------------------------------------------------------

/** Neuer, leerer Objekt-Layer über dem gerade aktiven. */
export function newObjectLayer(name: string): Layer {
  return {
    id: makeId('lyr'),
    name,
    isGroup: false,
    parentId: null,
    children: [],
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    includeInExport: true,
  };
}

export function newGroupLayer(name: string): Layer {
  return { ...newObjectLayer(name), id: makeId('grp'), isGroup: true };
}

/** Position eines Layers innerhalb seiner Geschwister. */
export function indexInSiblings(doc: MapDocument, id: LayerId): number {
  return siblingsOf(doc, id).indexOf(id);
}

export { SYSTEM_GRID, SYSTEM_VTT };

// ---------------------------------------------------------------------------
// Rasterebenen
// ---------------------------------------------------------------------------

/**
 * Höhenwerte einzelner Felder setzen.
 *
 * Die Änderungen liegen als Karte von Feldindex auf Wert vor, nicht als
 * Rechteck: ein Pinselabdruck ist rund, und ein Rechteck darum herum
 * speicherte für jeden Zug ein Vielfaches an unveränderten Werten.
 *
 * Wie bei `PatchVttItems` merkt sich der Befehl beim ersten Ausführen die
 * alten Werte. Beim Verschmelzen zweier Abdrücke gewinnt der *ältere*
 * Ausgangswert — sonst führte das Rückgängigmachen eines Strichs nur bis zum
 * vorletzten Abdruck zurück.
 */
export class PaintHeight implements Command {
  label: string;
  mergeKey?: string;
  private previous = new Map<number, number>();

  constructor(
    private layerId: LayerId,
    private values: Map<number, number>,
    label = t('cmd.paintHeight'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    const map = doc.heightMaps?.[this.layerId];
    if (!map) return [];
    const merken = this.previous.size === 0;
    for (const [index, wert] of this.values) {
      if (index < 0 || index >= map.data.length) continue;
      if (merken) this.previous.set(index, map.data[index]);
      map.data[index] = wert;
    }
    return [this.change(map.cols, this.values.keys())];
  }

  undo(doc: MapDocument): DocChange[] {
    const map = doc.heightMaps?.[this.layerId];
    if (!map) return [];
    for (const [index, wert] of this.previous) map.data[index] = wert;
    return [this.change(map.cols, this.previous.keys())];
  }

  /** Betroffene Zeilen aus den Feldindizes. */
  private change(cols: number, indices: Iterable<number>): DocChange {
    let minRow = Infinity;
    let maxRow = -Infinity;
    for (const i of indices) {
      const r = Math.floor(i / cols);
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
    }
    return Number.isFinite(minRow)
      ? { type: 'height', layerId: this.layerId, minRow, maxRow }
      : { type: 'height', layerId: this.layerId };
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PaintHeight) || next.layerId !== this.layerId) return false;
    for (const [index, wert] of next.values) {
      // Nur wenn dieser Befehl das Feld noch nie angefasst hat, zählt der
      // Ausgangswert des neuen — sonst bleibt der ältere stehen.
      if (!this.previous.has(index)) {
        this.previous.set(index, next.previous.get(index) ?? wert);
      }
      this.values.set(index, wert);
    }
    return true;
  }
}

/**
 * Rasterebene anlegen oder entfernen.
 *
 * Das Höhenfeld hängt am Layer, wird aber getrennt gehalten (siehe
 * `MapDocument.heightMaps`). Ein eigener Befehl, damit beides in einem
 * Undo-Schritt zusammenbleibt.
 */
export class SetHeightMap implements Command {
  label: string;
  private previous: HeightMap | null | undefined;

  constructor(
    private layerId: LayerId,
    private map: HeightMap | null,
    label = t('cmd.heightLayer'),
  ) {
    this.label = label;
  }

  do(doc: MapDocument): DocChange[] {
    if (!doc.heightMaps) doc.heightMaps = {};
    this.previous = doc.heightMaps[this.layerId] ?? null;
    if (this.map) doc.heightMaps[this.layerId] = this.map;
    else delete doc.heightMaps[this.layerId];

    const layer = doc.layers[this.layerId];
    if (layer) layer.kind = this.map ? 'height' : 'objects';
    return [{ type: 'height', layerId: this.layerId }, { type: 'layers' }];
  }

  undo(doc: MapDocument): DocChange[] {
    if (!doc.heightMaps) doc.heightMaps = {};
    if (this.previous) doc.heightMaps[this.layerId] = this.previous;
    else delete doc.heightMaps[this.layerId];

    const layer = doc.layers[this.layerId];
    if (layer) layer.kind = this.previous ? 'height' : 'objects';
    return [{ type: 'height', layerId: this.layerId }, { type: 'layers' }];
  }
}

/**
 * Biome einzelner Stützstellen setzen.
 *
 * Eigener Befehl statt eines Felds in `PaintHeight`: Höhe und Biom werden
 * nicht zusammen gemalt, und ein Befehl, der beides könnte, müsste bei jedem
 * Rückgängig beides prüfen. Aufbau und Verschmelzen sind sonst dieselben.
 */
export class PaintBiome implements Command {
  label: string;
  mergeKey?: string;
  private previous = new Map<number, number>();

  constructor(
    private layerId: LayerId,
    private values: Map<number, number>,
    label = t('cmd.paintBiome'),
    mergeKey?: string,
  ) {
    this.label = label;
    this.mergeKey = mergeKey;
  }

  do(doc: MapDocument): DocChange[] {
    const map = doc.heightMaps?.[this.layerId];
    if (!map) return [];
    // Das Biomfeld entsteht erst, wenn wirklich eines gemalt wird.
    if (!map.biome) map.biome = new Array<number>(map.data.length).fill(0);

    const merken = this.previous.size === 0;
    for (const [index, wert] of this.values) {
      if (index < 0 || index >= map.biome.length) continue;
      if (merken) this.previous.set(index, map.biome[index]);
      map.biome[index] = wert;
    }
    return [this.change(map.cols, this.values.keys())];
  }

  undo(doc: MapDocument): DocChange[] {
    const map = doc.heightMaps?.[this.layerId];
    if (!map?.biome) return [];
    for (const [index, wert] of this.previous) map.biome[index] = wert;
    return [this.change(map.cols, this.previous.keys())];
  }

  absorb(next: Command): boolean {
    if (!(next instanceof PaintBiome) || next.layerId !== this.layerId) return false;
    for (const [index, wert] of next.values) {
      if (!this.previous.has(index)) {
        this.previous.set(index, next.previous.get(index) ?? wert);
      }
      this.values.set(index, wert);
    }
    return true;
  }

  private change(cols: number, indices: Iterable<number>): DocChange {
    let minRow = Infinity;
    let maxRow = -Infinity;
    for (const i of indices) {
      const r = Math.floor(i / cols);
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
    }
    return Number.isFinite(minRow)
      ? { type: 'height', layerId: this.layerId, minRow, maxRow }
      : { type: 'height', layerId: this.layerId };
  }
}
