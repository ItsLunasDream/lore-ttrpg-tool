/**
 * Projektdatei `.ttmap`.
 *
 * Ein ZIP-Archiv statt einer nackten JSON-Datei: importierte Bilder und Fonts
 * liegen mit drin. Damit lässt sich die Datei auf einen anderen Rechner kopieren
 * und alles ist da — bei Pfadverweisen wäre sie dort kaputt.
 *
 * Aufbau:
 *   manifest.json    Schema- und Anwendungsversion, Erstellungszeit
 *   scene.json       vollständiges Dokument
 *   assets/…         nur die tatsächlich benutzten importierten Bilder
 *   fonts/…          nur die tatsächlich benutzten importierten Schriften
 *   thumbnail.webp   Vorschaubild
 *   versions/…       die letzten Fassungen von scene.json
 *   maps/…           weitere Karten derselben Datei (Etagen, `model/mappe.ts`)
 *
 * **Mehrere Karten.** Die erste steht weiter in `scene.json`, die übrigen
 * unter `maps/`; Reihenfolge und welche zuletzt offen war, nennt das
 * Manifest (`karten`, `aktiv`). Eine ältere Fassung des Editors öffnet so
 * wenigstens die erste Karte, statt die Datei abzuweisen. Eine Fassung unter
 * `versions/` enthält bei mehreren Karten alle (`{ mappe: […] }`), sonst
 * nur das Dokument wie bisher.
 *
 * **Warum die alten Fassungen mit ins Archiv gehören.** Eine Projektdatei ist
 * die Arbeit von Stunden, und Speichern überschreibt sie ohne Rückfrage — ein
 * versehentlich gelöschter Layer plus Strg+S, und der Stand von vorhin ist weg.
 * Sie *neben* die Datei zu legen hilft nicht: die Kopie bliebe beim Weitergeben
 * oder Verschieben zurück. Im Archiv wandert sie mit.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { SCHEMA_VERSION, type MapDocument } from '@/model/types';
import { createDocument } from '@/model/document';

export const TTMAP_EXTENSION = 'ttmap';
const APP_VERSION = '1.0.0';

/**
 * So viele alte Fassungen bleiben im Archiv.
 *
 * Drei und nicht dreißig: jede ist ein vollständiges Dokument, und bei einer
 * großen Karte wächst die Datei sonst mit jedem Speichern spürbar. Drei decken
 * den Fall ab, um den es geht — „ich habe eben etwas kaputtgemacht und schon
 * zweimal gespeichert".
 */
export const MAX_VERSIONS = 3;

export interface ProjectManifest {
  schemaVersion: number;
  appVersion: string;
  savedAt: string;
  /** Dateinamen unter assets/, auf die scene.json verweist. */
  assets: string[];
  /**
   * Dateinamen unter fonts/. Optional, weil ältere Archive das Feld nicht
   * kennen — deren `fonts/` ist dann schlicht leer.
   */
  fonts?: string[];
  /** Frühere Fassungen, neueste zuerst. Optional aus demselben Grund. */
  versions?: ProjectVersionInfo[];
  /** Alle Karten der Datei in ihrer Reihenfolge; fehlt bei nur einer. */
  karten?: { file: string; name: string }[];
  /** Welche Karte zuletzt offen war (Stelle in `karten`). */
  aktiv?: number;
}

/** Eine frühere Fassung im Archiv. */
export interface ProjectVersionInfo {
  /** Dateiname unter versions/. */
  file: string;
  /** Wann diese Fassung gespeichert wurde. */
  savedAt: string;
}

/** Eine frühere Fassung samt ihrer Daten. */
export interface ProjectVersion extends ProjectVersionInfo {
  data: Uint8Array;
}

export interface ProjectBundle {
  /** Die erste Karte; bei nur einer die einzige. */
  doc: MapDocument;
  /** Alle Karten der Datei, die erste vorn. */
  karten: MapDocument[];
  /** Die zuletzt offene Karte. */
  aktiv: number;
  manifest: ProjectManifest;
  /** Rohdaten der eingebetteten Assets, Schlüssel ohne "assets/"-Präfix. */
  assets: Map<string, Uint8Array>;
  /** Rohdaten der eingebetteten Schriften, Schlüssel ohne "fonts/"-Präfix. */
  fonts: Map<string, Uint8Array>;
  /** Frühere Fassungen, neueste zuerst. */
  versions: ProjectVersion[];
}

/** Was beim Öffnen einer fremden oder älteren Datei auffiel. */
export interface LoadReport {
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export function packProject(
  doc: MapDocument,
  assets: Map<string, Uint8Array> = new Map(),
  thumbnail?: Uint8Array,
  fonts: Map<string, Uint8Array> = new Map(),
  /** Frühere Fassungen, neueste zuerst — aus `historyFrom` der alten Datei. */
  versions: ProjectVersion[] = [],
): Uint8Array {
  return packMappe([doc], 0, assets, thumbnail, fonts, versions);
}

/** Wo die Karte an Stelle `i` im Archiv liegt. */
function kartenDatei(i: number): string {
  return i === 0 ? 'scene.json' : `maps/karte-${i}.json`;
}

/** Wie `packProject`, für mehrere Karten. Bilder und Schriften gelten für alle. */
export function packMappe(
  karten: readonly MapDocument[],
  aktiv: number,
  assets: Map<string, Uint8Array> = new Map(),
  thumbnail?: Uint8Array,
  fonts: Map<string, Uint8Array> = new Map(),
  versions: ProjectVersion[] = [],
): Uint8Array {
  if (karten.length === 0) throw new Error('Keine Karte zum Speichern.');
  const behalten = versions.slice(0, MAX_VERSIONS);
  const manifest: ProjectManifest = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    assets: [...assets.keys()],
    fonts: [...fonts.keys()],
    versions: behalten.map(({ file, savedAt }) => ({ file, savedAt })),
    ...(karten.length > 1
      ? { karten: karten.map((k, i) => ({ file: kartenDatei(i), name: k.meta.name })), aktiv }
      : {}),
  };

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };
  karten.forEach((k, i) => {
    files[kartenDatei(i)] = strToU8(JSON.stringify(k));
  });
  for (const [name, data] of assets) files[`assets/${name}`] = data;
  for (const [name, data] of fonts) files[`fonts/${name}`] = data;
  for (const version of behalten) files[`versions/${version.file}`] = version.data;
  if (thumbnail) files['thumbnail.webp'] = thumbnail;

  // Bilder sind bereits komprimiert; sie erneut zu deflaten kostet nur Zeit.
  return zipSync(files, { level: 6 });
}

/** Dateiname einer Fassung; der Zeitstempel muss durch einen Dateinamen passen. */
function versionFilename(savedAt: string): string {
  return `${savedAt.replace(/[:.]/g, '-')}.json`;
}

/**
 * Zieht aus dem *bisherigen* Archiv die Fassungen für das nächste.
 *
 * Der bisherige Stand wird zur neuesten Fassung, die vorhandenen rücken nach.
 * Aufzurufen, bevor eine Datei überschrieben wird — danach ist der alte Stand
 * weg, und genau darum geht es.
 *
 * Ausgepackt wird nur, was gebraucht wird: `scene.json`, `manifest.json` und
 * `versions/`. Die Bilder eines großen Archivs zu entpacken, um sie sofort
 * wegzuwerfen, wäre bei jedem Speichern eine Verschwendung.
 */
export function historyFrom(existing: Uint8Array): ProjectVersion[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(existing, {
      filter: (file) =>
        file.name === 'scene.json' ||
        file.name === 'manifest.json' ||
        file.name.startsWith('maps/') ||
        file.name.startsWith('versions/'),
    });
  } catch {
    // Kein lesbares Archiv — dann gibt es eben keine Vorgeschichte. Das
    // Speichern deswegen abzubrechen wäre die schlechtere Antwort.
    return [];
  }

  const scene = files['scene.json'];
  if (!scene) return [];

  let savedAt = '';
  let manifest: ProjectManifest | null = null;
  try {
    manifest = files['manifest.json']
      ? (JSON.parse(strFromU8(files['manifest.json'])) as ProjectManifest)
      : null;
    savedAt = manifest?.savedAt ?? '';
  } catch {
    savedAt = '';
  }
  if (!savedAt) savedAt = new Date().toISOString();

  // Bei mehreren Karten wandern alle in die Fassung, nicht nur die erste.
  let daten = scene;
  const liste = manifest?.karten ?? [];
  if (liste.length > 1) {
    const teile = liste.map((k) => files[k.file]).filter((x): x is Uint8Array => !!x).map((x) => strFromU8(x));
    daten = strToU8(`{"mappe":[${teile.join(',')}],"aktiv":${Number(manifest?.aktiv) || 0}}`);
  }

  const alte = versionsFromFiles(files);
  const neueste: ProjectVersion = { file: versionFilename(savedAt), savedAt, data: daten };
  // Gleiche Zeitstempel könnten sich sonst gegenseitig überschreiben.
  const ohneDoppel = alte.filter((v) => v.file !== neueste.file);
  return [neueste, ...ohneDoppel].slice(0, MAX_VERSIONS);
}

/** Fassungen aus einem bereits entpackten Archiv, neueste zuerst. */
function versionsFromFiles(files: Record<string, Uint8Array>): ProjectVersion[] {
  const out: ProjectVersion[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (!path.startsWith('versions/') || path.length <= 'versions/'.length) continue;
    const file = path.slice('versions/'.length);
    // Der Zeitstempel steckt im Namen; das Manifest ist nur die schönere Quelle.
    const savedAt = file.replace(/\.json$/, '').replace(/-(\d\d)-(\d\d)-(\d\d\d)Z$/, ':$1:$2.$3Z');
    out.push({ file, savedAt, data });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Liest ein Dokument aus einer früheren Fassung — bei mehreren Karten alle. */
export function documentFromVersion(data: Uint8Array): {
  doc: MapDocument;
  karten: MapDocument[];
  aktiv: number;
  report: LoadReport;
} {
  const report: LoadReport = { warnings: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(data));
  } catch {
    throw new Error('Die gespeicherte Fassung ist beschädigt.');
  }
  const mappe = (parsed as { mappe?: unknown; aktiv?: unknown })?.mappe;
  if (Array.isArray(mappe) && mappe.length > 0) {
    const karten = mappe.map((k) => migrate(k, report));
    const aktiv = Math.max(0, Math.min(Number((parsed as { aktiv?: unknown }).aktiv) || 0, karten.length - 1));
    return { doc: karten[0], karten, aktiv, report };
  }
  const doc = migrate(parsed, report);
  return { doc, karten: [doc], aktiv: 0, report };
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export function unpackProject(data: Uint8Array): { bundle: ProjectBundle; report: LoadReport } {
  const report: LoadReport = { warnings: [] };

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('Datei ist kein gültiges .ttmap-Archiv.');
  }

  const sceneRaw = files['scene.json'];
  if (!sceneRaw) throw new Error('Im Archiv fehlt scene.json.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(sceneRaw));
  } catch {
    throw new Error('scene.json ist beschädigt.');
  }

  let manifest: ProjectManifest;
  try {
    manifest = files['manifest.json']
      ? (JSON.parse(strFromU8(files['manifest.json'])) as ProjectManifest)
      : { schemaVersion: 0, appVersion: 'unbekannt', savedAt: '', assets: [], fonts: [] };
  } catch {
    manifest = { schemaVersion: 0, appVersion: 'unbekannt', savedAt: '', assets: [], fonts: [] };
    report.warnings.push('manifest.json war unlesbar und wurde ignoriert.');
  }

  const doc = migrate(parsed, report);

  // Weitere Karten derselben Datei. Eine fehlende oder kaputte wird
  // übersprungen, mit Warnung — die übrigen sollen trotzdem aufgehen.
  const karten: MapDocument[] = [doc];
  for (const eintrag of (manifest.karten ?? []).slice(1)) {
    const roh = files[eintrag.file];
    try {
      if (!roh) throw new Error('fehlt');
      karten.push(migrate(JSON.parse(strFromU8(roh)), report));
    } catch {
      report.warnings.push(`Die Karte „${eintrag.name}" war nicht lesbar und wurde ausgelassen.`);
    }
  }
  const aktiv = Math.max(0, Math.min(Number(manifest.aktiv) || 0, karten.length - 1));

  const assets = new Map<string, Uint8Array>();
  const fonts = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('assets/') && path.length > 'assets/'.length) {
      assets.set(path.slice('assets/'.length), content);
    } else if (path.startsWith('fonts/') && path.length > 'fonts/'.length) {
      fonts.set(path.slice('fonts/'.length), content);
    }
  }

  // Der Zeitstempel aus dem Manifest ist der genauere; der Dateiname ist nur
  // die Rückfallebene für Archive ohne Eintrag.
  const ausManifest = new Map((manifest.versions ?? []).map((v) => [v.file, v.savedAt]));
  const versions = versionsFromFiles(files).map((v) => ({
    ...v,
    savedAt: ausManifest.get(v.file) ?? v.savedAt,
  }));

  return { bundle: { doc, karten, aktiv, manifest, assets, fonts, versions }, report };
}

/**
 * Bringt ein geladenes Dokument auf den aktuellen Stand und füllt Lücken.
 *
 * Bewusst tolerant: eine Projektdatei ist die Arbeit von Stunden. Lieber eine
 * Karte mit Warnung öffnen als sie wegen eines fehlenden Feldes verweigern.
 */
export function migrate(raw: unknown, report: LoadReport): MapDocument {
  if (!raw || typeof raw !== 'object') throw new Error('scene.json enthält kein Dokument.');
  const input = raw as Partial<MapDocument> & Record<string, unknown>;

  const version = typeof input.schemaVersion === 'number' ? input.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    report.warnings.push(
      `Die Datei stammt aus einer neueren Version (Schema ${version}, hier ${SCHEMA_VERSION}). ` +
        'Unbekannte Angaben werden ignoriert.',
    );
  }

  // Als Grundlage ein frisches Dokument, damit jedes Feld belegt ist.
  const fallback = createDocument(
    input.size?.cols ?? 30,
    input.size?.rows ?? 20,
    input.meta?.name ?? 'Unbenannte Karte',
  );

  const doc: MapDocument = {
    schemaVersion: SCHEMA_VERSION,
    meta: { ...fallback.meta, ...(input.meta ?? {}) },
    size: { ...fallback.size, ...(input.size ?? {}) },
    grid: { ...fallback.grid, ...(input.grid ?? {}) },
    background: typeof input.background === 'number' ? input.background : fallback.background,
    layers: input.layers ?? fallback.layers,
    rootLayers: input.rootLayers ?? fallback.rootLayers,
    objects: input.objects ?? {},
    vtt: { ...fallback.vtt, ...(input.vtt ?? {}) },
  };

  // Diese beiden sind optional und wurden hier lange schlicht vergessen: die
  // Filter über der ganzen Karte gingen bei *jedem* Speichern verloren, ohne
  // dass es auffiel — die Höhenfelder wären es gleich mit geworden. Wer dem
  // Dokument ein Feld hinzufügt, muss es auch hier eintragen: `migrate` baut
  // das Dokument bewusst Feld für Feld auf, damit eine fremde Datei nichts
  // Unbekanntes einschleust.
  //
  // Nur setzen, wenn die Datei sie mitbringt: sonst bekäme jede frisch
  // gespeicherte Karte ein leeres `heightMaps` und ein `filters: null`
  // eingetragen, die dort nichts zu suchen haben.
  if (input.filters !== undefined) doc.filters = input.filters;
  if (input.heightMaps !== undefined) doc.heightMaps = input.heightMaps;

  // Hilfslinien: nur, was Hand und Fuß hat. Eine Linie ohne Achse oder mit
  // einer Position, die keine Zahl ist, würde den Renderer nicht stören, aber
  // beim Fangen zu Werten führen, die niemand erklären kann.
  if (Array.isArray(input.guides)) {
    const brauchbar = input.guides.filter(
      (g) =>
        !!g &&
        typeof g.id === 'string' &&
        (g.axis === 'x' || g.axis === 'y') &&
        Number.isFinite(g.pos),
    );
    if (brauchbar.length !== input.guides.length) {
      report.warnings.push('Unbrauchbare Hilfslinien wurden verworfen.');
    }
    if (brauchbar.length > 0) doc.guides = brauchbar;
  }

  // Höhenfelder, deren Layer es nicht mehr gibt oder deren Größe nicht zum
  // Feld passt, wären ein stiller Fehler im Renderer.
  for (const [id, map] of Object.entries(doc.heightMaps ?? {})) {
    const gueltig =
      !!doc.layers[id] &&
      !!map &&
      Number.isFinite(map.cols) &&
      Number.isFinite(map.rows) &&
      Array.isArray(map.data) &&
      map.data.length === map.cols * map.rows;
    if (!gueltig) {
      delete doc.heightMaps![id];
      report.warnings.push(`Das Höhenfeld einer Ebene war unbrauchbar und wurde verworfen.`);
      continue;
    }
    // Ältere Dateien kennen die Auflösung nicht; damals war es eine je Feld.
    if (!Number.isFinite(map.samplesPerTile) || map.samplesPerTile <= 0) {
      map.samplesPerTile = 1;
    }
  }

  // Objekte ohne existierenden Layer würden unsichtbar im Dokument hängen.
  const known = new Set(Object.keys(doc.layers));
  const target =
    doc.rootLayers.find((id) => known.has(id) && !doc.layers[id].isGroup) ?? doc.rootLayers[0];
  let orphans = 0;
  for (const id of Object.keys(doc.objects)) {
    const o = doc.objects[id];
    if (!known.has(o.layerId)) {
      o.layerId = target;
      orphans++;
    }
  }
  if (orphans > 0) {
    report.warnings.push(`${orphans} Objekt(e) verwiesen auf fehlende Layer und wurden verschoben.`);
  }

  // Verweise auf gelöschte Layer im Stapel aussortieren.
  doc.rootLayers = doc.rootLayers.filter((id) => known.has(id));
  for (const layer of Object.values(doc.layers)) {
    if (layer.isGroup) layer.children = layer.children.filter((id) => known.has(id));
  }

  return doc;
}

/** Bequemer Einstieg für den Datei-Dialog. */
export async function readProjectFile(
  file: File,
): Promise<{ bundle: ProjectBundle; report: LoadReport }> {
  const buffer = await file.arrayBuffer();
  return unpackProject(new Uint8Array(buffer));
}
