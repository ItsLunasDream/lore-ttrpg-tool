/**
 * Ein einzelner Wuerfel.
 *
 * Die Form kommt aus shared/formen.ts, die Farbe aus den Einstellungen, die
 * Zahlenfarbe wird aus der Farbe berechnet. Beim Rollen dreht und wackelt er;
 * danach bleibt die Zahl stehen, bis erneut gewuerfelt wird.
 */
import { FORMEN, type Art } from '../shared/formen';
import { zahlenFarbe, type Muster } from '../shared/einstellungen';

/**
 * Wo die Funken sitzen und wann sie aufblitzen.
 *
 * Feste Stellen statt Zufall: bei hundert Wuerfeln wuerde jeder Wurf sonst
 * hundertmal neu rechnen, und niemand sieht den Unterschied. Die Verzoegerung
 * laesst sie nacheinander aufblitzen — gleichzeitig sieht es nach einem
 * Blitzlicht aus, nicht nach Glitzer.
 */
const FUNKEN = [
  { x: 8, y: 14, verzug: 0 },
  { x: 82, y: 8, verzug: 120 },
  { x: 92, y: 62, verzug: 260 },
  { x: 14, y: 74, verzug: 190 },
  { x: 50, y: -6, verzug: 330 },
  { x: 46, y: 92, verzug: 80 }
] as const;

/**
 * Sterne und Adern.
 *
 * Feste Stellen, kein Zufall: bei zwanzig Wuerfeln waeren zwanzig verschiedene
 * Sternbilder unruhig, und gerechnet wuerde bei jedem Wurf neu. Beide Muster
 * lagen zuerst nur als Farbverlauf vor — „Sternenhimmel" ohne Sterne und
 * „Marmor" ohne Adern sahen im Bild fast aus wie das schlichte Muster.
 */
const STERNE = [
  { x: 30, y: 34, r: 2.2 },
  { x: 62, y: 26, r: 1.5 },
  { x: 72, y: 48, r: 2 },
  { x: 40, y: 58, r: 1.4 },
  { x: 54, y: 70, r: 1.8 },
  { x: 24, y: 50, r: 1.3 }
] as const;

const ADERN = [
  'M 18 62 C 34 48, 44 66, 62 44 S 78 34, 88 40',
  'M 26 30 C 38 40, 52 26, 66 38',
  'M 40 82 C 52 70, 64 78, 78 66'
] as const;

interface Props {
  readonly art: Art;
  /** Die Zahl, oder `null`, solange nicht gewuerfelt wurde. */
  readonly augen: number | null;
  readonly farbe: string;
  readonly muster: Muster;
  readonly groesse: number;
  /** Ob dieser Wuerfel abgezogen wird. */
  readonly abzug?: boolean;
  readonly rollt?: boolean;
  readonly hoechst?: boolean;
  readonly tiefst?: boolean;
  /** Liegt da, zaehlt aber nicht (Vorteil, Nachteil, hoechste N). */
  readonly verworfen?: boolean;
  /**
   * Verzoegerung in Millisekunden. Wuerfel starten leicht versetzt — alle
   * gleichzeitig sieht nach einer Maschine aus, nicht nach Wuerfeln.
   */
  readonly verzug?: number;
  readonly onClick?: () => void;
  readonly onContextMenu?: (ereignis: React.MouseEvent) => void;
  readonly titel?: string;
}

export function Wuerfel({
  art,
  augen,
  farbe,
  muster,
  groesse,
  abzug = false,
  rollt = false,
  hoechst = false,
  tiefst = false,
  verworfen = false,
  verzug = 0,
  onClick,
  onContextMenu,
  titel
}: Props) {
  const form = FORMEN[art];
  const schrift = zahlenFarbe(farbe);
  /**
   * Die Kennung des Farbverlaufs.
   *
   * Sie muss alles enthalten, was den Verlauf bestimmt — Muster und Farbe.
   * Genau das fehlte hier zuerst, und der Fehler war im Bild sofort zu sehen:
   * die vier Musterknoepfe zeigen denselben Wuerfel in vier Mustern, hatten
   * dieselbe Kennung und sahen deshalb alle vier gleich aus. Zwei Verlaeufe
   * mit demselben Namen im selben Dokument fallen zusammen, und der erste
   * gewinnt.
   *
   * Zwei Wuerfel mit gleicher Art, gleichem Muster und gleicher Farbe teilen
   * sich den Verlauf weiterhin — sie sehen ohnehin gleich aus, und ein
   * Verlauf je Wuerfel waere bei hundert Stueck hundert Definitionen.
   *
   * Das Doppelkreuz der Farbe muss weg: es beendet in einer `url(#...)` den
   * Verweis.
   */
  const kennung = `w-${art}-${muster}-${farbe.replace('#', '')}-${groesse}`;

  const klassen = [
    'wuerfel',
    rollt ? 'wuerfel--rollt' : '',
    abzug ? 'wuerfel--abzug' : '',
    hoechst ? 'wuerfel--hoechst' : '',
    tiefst ? 'wuerfel--tiefst' : '',
    verworfen ? 'wuerfel--verworfen' : '',
    onClick ? 'wuerfel--klickbar' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const Wurzel = onClick ? 'button' : 'span';

  return (
    <Wurzel
      className={klassen}
      // Der Versatz geht als Variable an das SVG, das sich dreht — nicht als
      // animationDelay hierher: hier laeuft keine Animation mehr, seit das
      // Minuszeichen des Abzugswuerfels nicht mehr mitkreisen soll.
      style={
        { width: groesse, height: groesse, ['--wuerfel-verzug']: `${verzug}ms` } as React.CSSProperties
      }
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={titel}
      type={onClick ? 'button' : undefined}
    >
      <svg viewBox="0 0 100 100" width={groesse} height={groesse} aria-hidden="true">
        <defs>
          <Musterung kennung={kennung} muster={muster} farbe={farbe} />
        </defs>

        <path d={form.umriss} fill={`url(#${kennung})`} stroke={schrift} strokeOpacity="0.45" strokeWidth="1.5" />

        {/* Die Facetten machen den Koerper plastisch. Ohne sie wirkt jede Art
            wie ein flacher Aufkleber. */}
        {form.facetten.map((facette, nummer) => (
          <path
            key={nummer}
            d={facette}
            fill="none"
            stroke={schrift}
            strokeOpacity="0.38"
            strokeWidth="1.2"
          />
        ))}

        <Deko kennung={kennung} muster={muster} umriss={form.umriss} />

        {augen !== null ? (
          <text
            x="50"
            y={form.zahlY}
            textAnchor="middle"
            fill={schrift}
            fontSize={form.zahlGroesse}
            fontWeight="700"
            // Ziffern gleicher Breite: sonst huepft die Zahl beim Wechsel von
            // 9 auf 10 im Wuerfel herum.
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {augen}
          </text>
        ) : null}
      </svg>

      {abzug ? (
        <span className="wuerfel__abzug" aria-hidden="true">
          −
        </span>
      ) : null}

      {/*
        Die Effekte liegen ueber dem Wuerfel und nicht im SVG: als eigene
        Elemente kosten sie nichts, solange sie fehlen — und bei hundert
        Wuerfeln zaehlt genau das. Ein Filter im SVG haette auf jedem Wuerfel
        gerechnet, auch auf den ruhigen.
      */}
      {hoechst ? (
        <span className="glitzer" aria-hidden="true">
          {FUNKEN.map((funke, nummer) => (
            <span
              key={nummer}
              className="glitzer__funke"
              style={{ left: `${funke.x}%`, top: `${funke.y}%`, animationDelay: `${funke.verzug}ms` }}
            />
          ))}
        </span>
      ) : null}

      {tiefst ? (
        <span className="streifen" aria-hidden="true">
          <span className="streifen__linie" />
          <span className="streifen__linie" />
          <span className="streifen__linie" />
          <span className="streifen__linie" />
        </span>
      ) : null}
    </Wurzel>
  );
}

/**
 * Die Fuellung — je nach Muster ein Verlauf, ein Farbwechsel oder Punkte.
 *
 * Alle Muster leiten sich aus der einen gewaehlten Farbe ab, statt eigene
 * Farben mitzubringen: sonst waere die freie Farbwahl nur beim schlichten
 * Muster wirksam.
 */
function Musterung({ kennung, muster, farbe }: { kennung: string; muster: Muster; farbe: string }) {
  if (muster === 'metall') {
    // Harte Kanten zwischen hell und dunkel: das liest sich als Metall,
    // waehrend ein weicher Verlauf nach Plastik aussieht.
    return (
      // Mehrere Lichtbaender wie bei poliertem Chrom (Rueckmeldung: sah nicht nach Metall aus).
      <linearGradient id={kennung} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="12%" stopColor={farbe} />
        <stop offset="30%" stopColor="#1a1a1a" stopOpacity="0.85" />
        <stop offset="44%" stopColor={farbe} />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
        <stop offset="56%" stopColor={farbe} />
        <stop offset="78%" stopColor="#0d0d0d" stopOpacity="0.8" />
        <stop offset="92%" stopColor={farbe} />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6" />
      </linearGradient>
    );
  }

  if (muster === 'lack') {
    // Ein harter Glanzpunkt oben links, sonst satte Farbe.
    return (
      <radialGradient id={kennung} cx="30%" cy="22%" r="85%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="10%" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="16%" stopColor={farbe} />
        <stop offset="100%" stopColor={farbe} stopOpacity="0.9" />
      </radialGradient>
    );
  }

  if (muster === 'perlmutt') {
    return (
      <linearGradient id={kennung} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fdf2ff" />
        <stop offset="25%" stopColor={farbe} stopOpacity="0.55" />
        <stop offset="45%" stopColor="#d7f5ff" />
        <stop offset="65%" stopColor={farbe} stopOpacity="0.7" />
        <stop offset="85%" stopColor="#fff6dd" />
        <stop offset="100%" stopColor={farbe} stopOpacity="0.8" />
      </linearGradient>
    );
  }

  if (muster === 'kristall') {
    // Durchscheinend: die Farbe nur halb deckend, mit hellen Kanten.
    return (
      <linearGradient id={kennung} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="22%" stopColor={farbe} stopOpacity="0.45" />
        <stop offset="50%" stopColor={farbe} stopOpacity="0.3" />
        <stop offset="52%" stopColor="#ffffff" stopOpacity="0.6" />
        <stop offset="56%" stopColor={farbe} stopOpacity="0.35" />
        <stop offset="100%" stopColor={farbe} stopOpacity="0.65" />
      </linearGradient>
    );
  }

  if (muster === 'holz') {
    // Maserung als dichte Streifen im Verlauf.
    return (
      <linearGradient id={kennung} x1="0" y1="0" x2="0.3" y2="1" spreadMethod="repeat">
        <stop offset="0%" stopColor={farbe} />
        <stop offset="30%" stopColor={farbe} stopOpacity="0.75" />
        <stop offset="34%" stopColor="#2a1606" stopOpacity="0.55" />
        <stop offset="40%" stopColor={farbe} stopOpacity="0.85" />
        <stop offset="100%" stopColor={farbe} />
      </linearGradient>
    );
  }

  if (muster === 'marmor') {
    return (
      <radialGradient id={kennung} cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="45%" stopColor={farbe} />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
      </radialGradient>
    );
  }

  if (muster === 'sternenhimmel') {
    return (
      <radialGradient id={kennung} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor={farbe} />
        <stop offset="30%" stopColor={farbe} stopOpacity="0.85" />
        <stop offset="100%" stopColor="#05060a" />
      </radialGradient>
    );
  }

  // Schlicht: die Farbe selbst, oben eine Spur heller. Der Verlauf muss von
  // der Farbe ausgehen und nicht von Weiss nach Schwarz — sonst waere der
  // Wuerfel durchsichtig und die gewaehlte Farbe wirkungslos.
  return (
    <linearGradient id={kennung} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={farbe} />
      <stop offset="100%" stopColor={farbe} stopOpacity="0.82" />
    </linearGradient>
  );
}

/**
 * Was ueber der Fuellung liegt: Sterne beim Sternenhimmel, Adern beim Marmor.
 *
 * Geklippt am Umriss, sonst stehen die Adern ueber den Rand hinaus. Der
 * Schnittpfad haengt an derselben Kennung wie der Verlauf: Wuerfel, die
 * gleich aussehen, schreiben ihn zwar mehrfach ins Dokument, aber mit
 * gleichem Inhalt — anders als bei den Verlaeufen macht das Zusammenfallen
 * hier nichts. Die Sterne und Adern selbst kosten je Wuerfel ein paar
 * Elemente ohne Bewegung.
 *
 * Beide liegen unter der Zahl, weil sie im Bildbaum vorher stehen — die Zahl
 * bleibt lesbar.
 */
function Deko({ kennung, muster, umriss }: { kennung: string; muster: Muster; umriss: string }) {
  if (muster !== 'sternenhimmel' && muster !== 'marmor') return null;

  const schnitt = `${kennung}-schnitt`;

  return (
    <>
      <defs>
        <clipPath id={schnitt}>
          <path d={umriss} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${schnitt})`}>
        {muster === 'sternenhimmel'
          ? STERNE.map((stern, nummer) => (
              <circle key={nummer} cx={stern.x} cy={stern.y} r={stern.r} fill="#ffffff" fillOpacity="0.9" />
            ))
          : ADERN.map((ader, nummer) => (
              <path
                key={nummer}
                d={ader}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.4"
                strokeWidth={nummer === 0 ? 2.4 : 1.4}
                strokeLinecap="round"
              />
            ))}
      </g>
    </>
  );
}
