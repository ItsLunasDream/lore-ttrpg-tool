import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NoteIndex } from '../noteIndex';
import type { GraphPosition } from '../../shared/types';
import { buildGraphEdges, buildGraphNodes, type GraphMode } from '../graph/build';
import { layoutGraph, type GraphNode } from '../graph/layout';
import { typFarbe } from '../../shared/graphFarben';
import { useT } from '../i18n';
import { InfoCard } from './InfoCard';
import { Zeitstrahl } from './Zeitstrahl';
import { Handlungsstraenge } from './Handlungsstraenge';
import type { Strang } from '../../shared/straenge';
import type { Note } from '../../shared/types';
import { alsKnopf } from '@suite/tastatur';

interface Props {
  index: NoteIndex;
  activeNoteId: string | null;
  /** Von Hand gesetzte Stellen aus der Kampagne. */
  positions: Record<string, GraphPosition>;
  onSavePositions: (positions: Record<string, GraphPosition>) => void;
  onOpenNote: (noteId: string) => void;
  onClose: () => void;
  /** Fuer die Bilder in der Kurzinfo. */
  campaignId: string;
  /** Handlungsstraenge der Kampagne. */
  plots: Strang[];
  onSavePlots: (plots: Strang[]) => void;
  /** Welcher Reiter offen ist; liegt bei der App, damit der Verlauf (Zurück) ihn kennt. */
  ansicht: GraphAnsicht;
  onAnsicht: (ansicht: GraphAnsicht) => void;
}

export type GraphAnsicht = 'graph' | 'zeit' | 'straenge';

const WIDTH = 1200;
const HEIGHT = 780;
/** Kleiner zoomt die Startansicht nicht: sonst wird ein einzelner Knoten riesig. */
const MIN_ANSICHT = 520;

/**
 * Die Startansicht: der Ausschnitt um die Knoten, im Seitenverhaeltnis der
 * Flaeche. Bei zwei Notizen standen sie sonst winzig am Rand der ganzen
 * Flaeche, mit Beschriftungen um 8 Pixel (Testbericht).
 */
function ansichtUm(knoten: readonly { x: number; y: number }[]): { x: number; y: number; width: number; height: number } {
  if (knoten.length === 0) return { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  const rand = 110;
  const minX = Math.min(...knoten.map((k) => k.x)) - rand;
  const maxX = Math.max(...knoten.map((k) => k.x)) + rand;
  const minY = Math.min(...knoten.map((k) => k.y)) - rand;
  const maxY = Math.max(...knoten.map((k) => k.y)) + rand;
  const verhaeltnis = HEIGHT / WIDTH;
  let breite = Math.max(MIN_ANSICHT, maxX - minX, (maxY - minY) / verhaeltnis);
  breite = Math.min(breite, WIDTH);
  const hoehe = breite * verhaeltnis;
  const mitteX = (minX + maxX) / 2;
  const mitteY = (minY + maxY) / 2;
  return { x: mitteX - breite / 2, y: mitteY - hoehe / 2, width: breite, height: hoehe };
}

/**
 * Ab dieser Kantenzahl ueberlagern sich die Beschriftungen so stark, dass sie
 * mehr stoeren als helfen. Dann erscheinen nur noch die der hervorgehobenen
 * Nachbarschaft.
 */
const LABEL_LIMIT = 20;

/**
 * Wie weit der Zeiger wandern darf, bevor aus dem Klick ein Ziehen wird —
 * in Einheiten der Zeichenflaeche, nicht in Bildpunkten.
 *
 * Ohne diese Schwelle war jeder Klick auch ein winziges Ziehen: der Knoten
 * bekam eine neue Stelle in der Kampagne, und beim Loslassen ging die Notiz
 * auf, obwohl niemand sie oeffnen wollte.
 */
const ZIEH_SCHWELLE = 4;

/**
 * Abstand der beiden Linien, wenn zwischen zwei Knoten in beide Richtungen
 * eine Verbindung besteht. Bewusst klein: beim Herauszoomen sollen sie wieder
 * wie eine Linie wirken.
 */
const EDGE_GAP = 5;

/** Wie weit die Beschriftung ueber ihre eigene Linie hinaus nach aussen rueckt. */
const LABEL_SIDE = 2.4;

/** Feste Farbreihe, damit Notiztypen wiedererkennbar bleiben. */

export function GraphView({ index, activeNoteId, positions: saved, onSavePositions, onOpenNote, onClose, campaignId, plots, onSavePlots, ansicht, onAnsicht: setAnsicht }: Props) {
  const t = useT();
  const [mode, setMode] = useState<GraphMode>('both');
  const [seed, setSeed] = useState(42);
  const [hovered, setHovered] = useState<string | null>(null);
  /** Graph oder Zeitstrahl (Rueckmeldung: Ereignisse in zeitlicher Folge). */
  /*
   * Kurzinfo beim Ueberfahren (Rueckmeldung), leicht verzoegert: sonst
   * flackerten beim Ueberstreichen des Graphen Karten auf.
   */
  const [karte, setKarte] = useState<{ note: Note; rect: DOMRect } | null>(null);
  const kartenTakt = useRef<number | null>(null);
  const zeigeKarte = useCallback((note: Note | null, rect: DOMRect | null) => {
    if (kartenTakt.current !== null) window.clearTimeout(kartenTakt.current);
    kartenTakt.current = null;
    if (!note || !rect) {
      setKarte(null);
      return;
    }
    kartenTakt.current = window.setTimeout(() => setKarte({ note, rect }), 350);
  }, []);
  useEffect(() => () => {
    if (kartenTakt.current !== null) window.clearTimeout(kartenTakt.current);
  }, []);
  /** Waehrend des Ziehens, damit der Knoten sofort folgt. */
  const [dragged, setDragged] = useState<Record<string, GraphPosition>>({});
  /**
   * Dasselbe noch einmal als Referenz. Beim Loslassen muss die zuletzt
   * gezogene Stelle sicher zur Hand sein: folgen die Ereignisse dicht
   * aufeinander, hat React zwischen Bewegung und Loslassen noch nicht neu
   * gezeichnet, und der Zustand waere im Handler noch der alte.
   */
  const dragRef = useRef<{ id: string; at: GraphPosition | null; von: GraphPosition | null } | null>(null);


  /**
   * Loslassen. `oeffnen` gilt nur beim Loslassen ueber der Flaeche.
   *
   * Hier und nicht in einem onClick am Knoten: nach einem Ziehen kommt der
   * Klick trotzdem, und er oeffnete die Notiz — wer einen Knoten nur
   * zurechtruecken wollte, landete darin. Am Loslassen steht dagegen fest,
   * ob gezogen wurde: `at` ist gesetzt, sobald die Schwelle ueberschritten
   * war.
   */
  const dropNode = useCallback(
    (oeffnen: boolean) => {
      const drop = dragRef.current;
      dragRef.current = null;
      setPanning(null);
      if (!drop) return;

      if (!drop.at) {
        if (oeffnen) onOpenNote(drop.id);
        return;
      }

      const next = { ...savedRef.current, [drop.id]: drop.at };
      savedRef.current = next;
      onSavePositions(next);
    },
    [onSavePositions, onOpenNote]
  );
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ x: 0, y: 0, width: WIDTH, height: HEIGHT });
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Ausgeblendete Typen fliegen samt ihrer Kanten raus, damit die Anordnung
  // den verbleibenden Knoten den ganzen Platz gibt.
  const visibleNotes = useMemo(
    () => index.notes.filter((note) => !hiddenTypes.has(note.type)),
    [index.notes, hiddenTypes]
  );
  const visibleIndex = useMemo(
    () => ({ ...index, notes: visibleNotes, byId: new Map(visibleNotes.map((note) => [note.id, note])) }),
    [index, visibleNotes]
  );

  const edges = useMemo(() => buildGraphEdges(visibleIndex, mode), [visibleIndex, mode]);
  const nodeSeeds = useMemo(() => buildGraphNodes(visibleNotes, edges), [visibleNotes, edges]);

  // Die gespeicherten Stellen gehen als feste Punkte in die Anordnung ein,
  // sind aber kein Anlass, sie neu zu berechnen: sonst rechnete jedes
  // Loslassen nach dem Ziehen das ganze Netz noch einmal durch. Deshalb
  // ueber eine Referenz statt ueber die Abhaengigkeiten.
  //
  // Die Referenz wird beim Ablegen sofort mitgeschrieben, nicht erst wenn
  // das Gespeicherte zurueckkommt: sonst verloere ein zweiter Zug kurz nach
  // dem ersten dessen Stelle wieder.
  const savedRef = useRef(saved);
  const lastProp = useRef(saved);
  if (lastProp.current !== saved) {
    lastProp.current = saved;
    savedRef.current = saved;
  }

  /**
   * Fingerabdruck des Netzes: welche Knoten, welche Kanten. Nur daran haengt
   * die Anordnung.
   *
   * An den Objekten selbst darf sie nicht haengen: die Kampagne wird nach
   * jedem Ablegen eines Knotens neu aus dem Hauptprozess geholt, und damit
   * sind Notiztypen, Index und Kanten neue Objekte, ohne dass sich am Netz
   * etwas geaendert haette. Wuerde danach neu gerechnet, sprangen beim
   * Verschieben eines Knotens alle anderen mit.
   */
  const shape = useMemo(
    () =>
      [
        // Sortiert, weil nur die Menge zaehlt: die Notizen stehen nach Titel
        // geordnet, und ein Sprachwechsel sortiert sie um, ohne dass sich am
        // Netz etwas aendert.
        nodeSeeds.map((node) => node.id).sort().join(','),
        edges.map((edge) => `${edge.kind}:${edge.source}>${edge.target}`).sort().join(',')
      ].join('|'),
    [nodeSeeds, edges]
  );

  const computed = useMemo(
    () => layoutGraph(nodeSeeds, edges, { width: WIDTH, height: HEIGHT, seed, fixed: savedRef.current }),
    // nodeSeeds und edges gehen bewusst nicht in die Abhaengigkeiten ein,
    // ihr Fingerabdruck vertritt sie.
    [shape, seed]
  );

  // Nach einer Neuberechnung zaehlt wieder das Ergebnis, das gerade Gezogene
  // ist darin schon enthalten.
  useEffect(() => {
    setDragged({});
    setView(ansichtUm(computed.map((node) => ({ ...node, ...(savedRef.current[node.id] ?? {}) }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed]);

  const nodes: GraphNode[] = useMemo(
    () => computed.map((node) => ({ ...node, ...(saved[node.id] ?? {}), ...(dragged[node.id] ?? {}) })),
    [computed, saved, dragged]
  );

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  // Die Farben stehen in shared, weil das Bild fuers PDF dieselben braucht.
  const typeColor = useCallback((typeId: string) => typFarbe(index.types, typeId), [index.types]);

  /**
   * Kanten, zu denen es eine Gegenrichtung gibt. Die beiden werden dann
   * versetzt gezeichnet, sonst liegen Linie und Beschriftung uebereinander
   * und es waere nicht zu erkennen, welche Bezeichnung wohin gilt.
   */
  const twoWay = useMemo(() => {
    const keys = new Set(edges.map((edge) => `${edge.kind}:${edge.source}:${edge.target}`));
    return new Set(
      edges
        .filter((edge) => keys.has(`${edge.kind}:${edge.target}:${edge.source}`))
        .map((edge) => `${edge.kind}:${edge.source}:${edge.target}`)
    );
  }, [edges]);

  /** Nachbarn des Knotens unter der Maus, fuer das Hervorheben. */
  const neighbours = useMemo(() => {
    if (!hovered) return null;
    const found = new Set<string>([hovered]);
    for (const edge of edges) {
      if (edge.source === hovered) found.add(edge.target);
      if (edge.target === hovered) found.add(edge.source);
    }
    return found;
  }, [hovered, edges]);

  /** Bildschirmkoordinate in Diagrammkoordinate, unter Beruecksichtigung des Zooms. */
  function toSvgPoint(event: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((event.clientY - rect.top) / rect.height) * view.height
    };
  }

  /** Zoomt um den Punkt unter dem Mauszeiger, nicht um die Bildmitte. */
  function zoomAt(factor: number, anchor: { x: number; y: number } | null) {
    setView((previous) => {
      const width = Math.min(WIDTH * 4, Math.max(WIDTH / 8, previous.width * factor));
      const scale = width / previous.width;
      const height = previous.height * scale;
      const point = anchor ?? { x: previous.x + previous.width / 2, y: previous.y + previous.height / 2 };
      return {
        width,
        height,
        x: point.x - (point.x - previous.x) * scale,
        y: point.y - (point.y - previous.y) * scale
      };
    });
  }

  // Beschriftungen nur zeigen, wenn sie lesbar bleiben: bei wenigen Kanten
  // immer, sonst nur rund um den Knoten unter der Maus.
  const showLabels = edges.length <= LABEL_LIMIT || neighbours !== null;

  return (
    <div className="graph">
      <header className="graph__bar">
        <div className="graph__ansichten" role="tablist">
          <button type="button" role="tab" data-ansicht="graph" aria-selected={ansicht === 'graph'} className={ansicht === 'graph' ? 'is-active' : undefined} onClick={() => setAnsicht('graph')}>
            {t('graph.title')}
          </button>
          <button type="button" role="tab" data-ansicht="zeit" aria-selected={ansicht === 'zeit'} className={ansicht === 'zeit' ? 'is-active' : undefined} onClick={() => { setKarte(null); setAnsicht('zeit'); }}>
            {t('timeline.title')}
          </button>
          <button type="button" role="tab" data-ansicht="straenge" aria-selected={ansicht === 'straenge'} className={ansicht === 'straenge' ? 'is-active' : undefined} onClick={() => { setKarte(null); setAnsicht('straenge'); }}>
            {t('plots.title')}
          </button>
        </div>

        {ansicht === 'graph' ? (<>
        <div className="graph__modes">
          {(['relations', 'mentions', 'both'] as GraphMode[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className={entry === mode ? 'is-active' : undefined}
              onClick={() => setMode(entry)}
            >
              {t(entry === 'relations' ? 'graph.relations' : entry === 'mentions' ? 'graph.mentions' : 'graph.both')}
            </button>
          ))}
        </div>

        <div className="graph__modes">
          <button
            type="button"
            className={hiddenTypes.size === 0 ? 'is-active' : undefined}
            onClick={() => setHiddenTypes(new Set())}
            title={t('graph.filterType')}
          >
            {t('graph.allTypes')}
          </button>
          {index.types.map((def) => (
            <button
              key={def.id}
              type="button"
              className={hiddenTypes.has(def.id) ? undefined : 'is-active'}
              onClick={() =>
                setHiddenTypes((previous) => {
                  const next = new Set(previous);
                  if (next.has(def.id)) next.delete(def.id);
                  else next.add(def.id);
                  return next;
                })
              }
            >
              <span className="graph__swatch" style={{ background: typeColor(def.id) }} />
              {def.label}
            </button>
          ))}
        </div>

        <span className="graph__count">{t('graph.nodes', { nodes: nodes.length, edges: edges.length })}</span>
        <span className="campaign-bar__spacer" />

        <button type="button" title={t('graph.zoomOut')} onClick={() => zoomAt(1.25, null)}>
          −
        </button>
        <button type="button" title={t('graph.zoomIn')} onClick={() => zoomAt(0.8, null)}>
          +
        </button>
        <button type="button" onClick={() => setView(ansichtUm(nodes))}>
          {t('graph.zoomReset')}
        </button>
        <button
          type="button"
          onClick={() => {
            // Neu anordnen wirft die von Hand gesetzten Stellen weg, das ist
            // der Sinn des Knopfes. Die Referenz muss vor dem neuen Anlauf
            // leer sein, sonst haelt die Berechnung die alten Knoten weiter
            // fest und der Knopf taete beim ersten Druck nichts.
            dragRef.current = null;
            savedRef.current = {};
            onSavePositions({});
            setDragged({});
            setSeed((previous) => previous + 1);
          }}
        >
          {t('graph.recalculate')}
        </button>
        </>) : <span className="graph__rest" />}
        <button type="button" onClick={onClose}>
          {t('graph.close')}
        </button>
      </header>

      {ansicht === 'graph' ? (<>
      {edges.length === 0 ? <p className="graph__empty">{t('graph.empty')}</p> : null}

      <svg
        ref={svgRef}
        className="graph__canvas"
        // Knoten mit den Pfeilen nach ihrer Lage auf dem Schirm erreichen.
        data-pfeile="raster"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={(event) => zoomAt(event.deltaY > 0 ? 1.12 : 0.89, toSvgPoint(event))}
        onMouseDown={(event) => {
          // Nur auf freier Flaeche verschieben, auf Knoten gilt das Ziehen.
          if (event.target === event.currentTarget) setPanning(toSvgPoint(event));
        }}
        onMouseMove={(event) => {
          const drag = dragRef.current;
          if (drag) {
            const point = toSvgPoint(event);
            if (point) {
              // Erst ab einer Schwelle wird daraus ein Ziehen. Sonst
              // verschiebt schon das Zittern der Hand beim Klicken den
              // Knoten und schreibt eine neue Stelle in die Kampagne.
              const weit =
                drag.at !== null ||
                drag.von === null ||
                Math.hypot(point.x - drag.von.x, point.y - drag.von.y) >= ZIEH_SCHWELLE;
              if (weit) {
                dragRef.current = { id: drag.id, at: point, von: drag.von };
                setDragged((previous) => ({ ...previous, [drag.id]: point }));
              }
            }
            return;
          }
          if (!panning) return;

          const point = toSvgPoint(event);
          if (!point) return;
          setView((previous) => ({
            ...previous,
            x: previous.x - (point.x - panning.x),
            y: previous.y - (point.y - panning.y)
          }));
        }}
        // Erst beim Loslassen speichern, nicht bei jeder Mausbewegung.
        onMouseUp={() => dropNode(true)}
        onMouseLeave={() => {
          // Verlaesst die Maus die Flaeche mitten im Ziehen, gilt der Knoten
          // trotzdem als abgelegt: sonst waere die Verschiebung beim naechsten
          // Oeffnen wieder weg. Geoeffnet wird dabei nichts — die Maus ist
          // ja gerade weggewandert.
          dropNode(false);
          setHovered(null);
        }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          if (!source || !target) return null;

          const dimmed = neighbours ? !(neighbours.has(edge.source) && neighbours.has(edge.target)) : false;
          const radius = 8 + Math.min(10, target.degree);
          const angle = Math.atan2(target.y - source.y, target.x - source.x);

          // Zur Seite versetzen, wenn es die Gegenrichtung auch gibt. Die
          // Senkrechte zur eigenen Richtung zeigt bei beiden Kanten
          // auseinander, jede landet also auf ihrer Seite. Der Betrag ist
          // klein, damit beim Herauszoomen wieder eine Linie daraus wird.
          const apart = twoWay.has(`${edge.kind}:${edge.source}:${edge.target}`);
          const sideX = apart ? -Math.sin(angle) * EDGE_GAP : 0;
          const sideY = apart ? Math.cos(angle) * EDGE_GAP : 0;

          return (
            <g
              key={`${edge.kind}-${edge.source}-${edge.target}`}
              className={`graph__edge graph__edge--${edge.kind}${dimmed ? ' is-dimmed' : ''}`}
            >
              <line
                x1={source.x + sideX}
                y1={source.y + sideY}
                x2={target.x - Math.cos(angle) * radius + sideX}
                y2={target.y - Math.sin(angle) * radius + sideY}
                markerEnd="url(#arrow)"
              />
              {edge.label && !dimmed && showLabels ? (
                // Die Beschriftung liegt aussen an ihrer eigenen Linie, damit
                // eindeutig ist, zu welcher Richtung sie gehoert.
                <text
                  x={(source.x + target.x) / 2 + sideX * LABEL_SIDE}
                  y={(source.y + target.y) / 2 + sideY * LABEL_SIDE - (apart ? 0 : 4)}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {nodes.map((node, nummer) => {
          const note = visibleIndex.byId.get(node.id);
          if (!note) return null;

          const dimmed = neighbours ? !neighbours.has(node.id) : false;
          const radius = 8 + Math.min(10, node.degree);

          return (
            <g
              key={node.id}
              data-id={node.id}
              className={`graph__node${dimmed ? ' is-dimmed' : ''}${node.id === activeNoteId ? ' is-active' : ''}`}
              /*
               * Gestaffelt, damit der Graph sich aufbaut statt aufzublitzen.
               * Gedeckelt, weil eine grosse Kampagne sonst sekundenlang
               * erschiene — der letzte Knoten darf nicht spuerbar spaeter da
               * sein als der erste.
               */
              style={{ animationDelay: `${Math.min(nummer, 20) * 18}ms` }}
              transform={`translate(${node.x} ${node.y})`}
              onMouseEnter={(event) => {
                setHovered(node.id);
                zeigeKarte(note, (event.currentTarget as SVGGElement).getBoundingClientRect());
              }}
              onMouseLeave={() => {
                setHovered(null);
                zeigeKarte(null, null);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                dragRef.current = { id: node.id, at: null, von: toSvgPoint(event) };
              }}
              // Tastatur: Enter öffnet, der Fokus zeigt die Kurzinfo wie das Überfahren.
              {...alsKnopf(() => onOpenNote(node.id))}
              data-pfeil
              aria-label={note.title}
              onFocus={(event) => {
                setHovered(node.id);
                zeigeKarte(note, (event.currentTarget as SVGGElement).getBoundingClientRect());
              }}
              onBlur={() => {
                setHovered(null);
                zeigeKarte(null, null);
              }}
            >
              <circle r={radius} fill={typeColor(note.type)} />
              {/* Der Umriss in Hintergrundfarbe haelt die Beschriftung ueber
                  Kanten und anderen Knoten lesbar. */}
              <text y={radius + 15} className="graph__label">
                {note.title}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="graph__hint">{t('graph.hintFull')}</p>
      </>
      ) : ansicht === 'zeit' ? (
        <Zeitstrahl index={index} activeNoteId={activeNoteId} onOpenNote={onOpenNote} onHover={zeigeKarte} />
      ) : (
        <Handlungsstraenge index={index} straenge={plots} speichern={onSavePlots} activeNoteId={activeNoteId} onOpenNote={onOpenNote} onHover={zeigeKarte} />
      )}
      {karte ? (
        <InfoCard note={karte.note} types={index.types} campaignId={campaignId} rect={karte.rect} onOpen={(id) => onOpenNote(id)} />
      ) : null}
    </div>
  );
}
