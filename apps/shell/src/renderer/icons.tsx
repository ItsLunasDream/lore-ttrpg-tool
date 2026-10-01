/**
 * Die Symbole der Werkzeuge. Bewusst als Vektor im Quelltext und nicht als
 * Bilddatei: sie erben so `currentColor` und passen sich damit von selbst an
 * hell, dunkel und den Zustand der Kachel an, ohne dass es jedes Symbol
 * doppelt geben muss. Sie skalieren ausserdem von 26 auf 64 Pixel ohne
 * zweiten Satz Dateien.
 *
 * Alles Platzhalter — die endgueltigen Symbole kommen mit den endgueltigen
 * Namen.
 */
import { useState, type ReactElement } from 'react';

interface IconProps {
  readonly size?: number;
}

function Rahmen({ size = 26, children }: IconProps & { children: React.ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={size >= 48 ? 2 : 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Zettel, die durch Linien verbunden sind: Notizen und ihre Beziehungen. */
export const BackstoryIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <rect x="7" y="7" width="15" height="11" rx="2" />
    <rect x="26" y="6" width="15" height="11" rx="2" />
    <rect x="15" y="29" width="17" height="11" rx="2" />
    <line x1="14.5" y1="18" x2="20" y2="29" />
    <line x1="22" y1="12.5" x2="26" y2="11.5" />
    <line x1="33.5" y1="17" x2="27" y2="29" />
    <line x1="19" y1="33" x2="28" y2="33" />
    <line x1="19" y1="37" x2="25" y2="37" />
  </Rahmen>
);

/** Ein Rasterfeld mit angedeuteter Mauer: die Karte. */
export const MapmakerIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <rect x="8" y="8" width="28" height="28" />
    <line x1="17" y1="8" x2="17" y2="36" />
    <line x1="27" y1="8" x2="27" y2="36" />
    <line x1="8" y1="17" x2="36" y2="17" />
    <line x1="8" y1="27" x2="36" y2="27" />
    <line x1="10.5" y1="25.5" x2="10.5" y2="28.5" />
    <line x1="13.5" y1="25.5" x2="13.5" y2="28.5" />
    <line x1="16.5" y1="25.5" x2="16.5" y2="28.5" />
  </Rahmen>
);

/** Absteigend lange Balken mit Pfeil zurueck nach oben: die Zugreihenfolge. */
export const InitiativeIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <rect x="9" y="9" width="26" height="7" rx="3.5" />
    <rect x="9" y="20.5" width="20" height="7" rx="3.5" />
    <rect x="9" y="32" width="14" height="7" rx="3.5" />
    <path d="M41,35 C44,35 44,9 41,9" />
    <path d="M41,9 L37,7" />
    <path d="M41,9 L37,11" />
  </Rahmen>
);

/** Ein W20 in Aufsicht. */
export const DiceIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M24,8 L39,16 L24,24 L9,16 Z" />
    <path d="M9,16 L24,24 L24,42 L9,34 Z" />
    <path d="M39,16 L24,24 L24,42 L39,34 Z" />
    <circle cx="13" cy="23" r="1.4" />
    <circle cx="19" cy="35" r="1.4" />
    <circle cx="28" cy="22" r="1.4" />
    <circle cx="31" cy="29" r="1.4" />
    <circle cx="34" cy="36" r="1.4" />
  </Rahmen>
);

/** Eine Waage: Gruppe gegen Gegner, ausbalanciert. */
export const EncounterIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <line x1="15" y1="41" x2="33" y2="41" />
    <line x1="24" y1="41" x2="24" y2="11" />
    <line x1="9" y1="13" x2="39" y2="13" />
    <line x1="9" y1="13" x2="9" y2="19" />
    <line x1="39" y1="13" x2="39" y2="19" />
    <path d="M4,19 L9,23 L14,19" />
    <path d="M34,19 L39,23 L44,19" />
    <circle cx="9" cy="24" r="3" />
    <circle cx="36" cy="24" r="2" />
    <circle cx="42" cy="24" r="2" />
  </Rahmen>
);

/**
 * Ein aufgeschlagenes Buch mit Lesezeichen.
 *
 * Nur der Rueckfall: die Huelle nimmt ein eigenes Bild, sobald unter
 * `resources/symbole/nachschlagewerk.png` eines liegt.
 */
export const NachschlagewerkIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M24,14 C19,11 12,11 7,13 L7,37 C12,35 19,35 24,38" />
    <path d="M24,14 C29,11 36,11 41,13 L41,37 C36,35 29,35 24,38" />
    <line x1="24" y1="14" x2="24" y2="38" />
    <path d="M33,11.6 L33,22 L35.5,19.5 L38,22 L38,12" />
    <line x1="11" y1="19" x2="20" y2="19" />
    <line x1="11" y1="24" x2="20" y2="24" />
    <line x1="11" y1="29" x2="18" y2="29" />
  </Rahmen>
);

/**
 * Hammer auf einem Amboss: selbst geschmiedet.
 *
 * Nur der Rueckfall: die Huelle nimmt ein eigenes Bild, sobald unter
 * `resources/symbole/homebrew.png` eines liegt.
 */
export const HomebrewIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M10,30 L36,30 L32,35 L14,35 Z" />
    <path d="M18,35 L16,40 M30,35 L32,40" />
    <path d="M21,26 L31,12" />
    <path d="M27,9 L35,15 L33,18 L25,12 Z" />
    <path d="M12,22 L12,25 M10.5,23.5 L13.5,23.5" />
  </Rahmen>
);

/**
 * Ein Edelstein mit Funkeln.
 *
 * Nur der Rueckfall: die Huelle nimmt ein eigenes Bild, sobald unter
 * `resources/symbole/magicitems.png` eines liegt.
 */
export const MagicItemsIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M14,18 L20,11 L28,11 L34,18 L24,37 Z" />
    <path d="M14,18 L34,18" />
    <path d="M20,11 L22,18 L24,37 L26,18 L28,11" />
    <path d="M38,8 L38,14 M35,11 L41,11" />
    <path d="M10,30 L10,34 M8,32 L12,32" />
  </Rahmen>
);

/**
 * Eine Truhe mit Deckel und Schloss.
 *
 * Nur der Rueckfall: die Huelle nimmt ein eigenes Bild, sobald unter
 * `resources/symbole/loot.png` eines liegt.
 */
export const LootIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M9,21 L39,21 L39,37 L9,37 Z" />
    <path d="M9,21 C9,13 14,11 24,11 C34,11 39,13 39,21" />
    <path d="M9,27 L39,27" />
    <path d="M21,24 L27,24 L27,30 L21,30 Z" />
  </Rahmen>
);

/** Charakterbogen: ein Blatt mit Herz fuer die Trefferpunkte und zwei Zeilen. */
export const CharakterbogenIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M12,7 L32,7 L37,12 L37,41 L12,41 Z" />
    <path d="M24.5,24 C20,20 17,18 17,15.5 C17,13.5 18.6,12 20.5,12 C22.2,12 23.6,13 24.5,14.5 C25.4,13 26.8,12 28.5,12 C30.4,12 32,13.5 32,15.5 C32,18 29,20 24.5,24 Z" />
    <path d="M17,30 L32,30" />
    <path d="M17,35 L28,35" />
  </Rahmen>
);

/** Die Marke der Sammlung: ein Sechseck mit Stern. */
export const SuiteIcon = (p: IconProps) => (
  <Rahmen {...p}>
    <path d="M24,8 L38,16 L38,32 L24,40 L10,32 L10,16 Z" />
    <path d="M24,16 L26.47,21.53 L32,24 L26.47,26.47 L24,32 L21.53,26.47 L16,24 L21.53,21.53 Z" />
  </Rahmen>
);

/**
 * NPC Creator: Kopf und Schultern, daneben ein Funke.
 *
 * Eine Person allein waere vom Initiative Tracker kaum zu unterscheiden —
 * der Funke sagt, dass hier jemand entsteht und nicht verwaltet wird.
 */
function NpcIcon({ size = 26 }: IconProps): ReactElement {
  return (
    <Rahmen size={size}>
      <circle cx="20" cy="17" r="7" />
      <path d="M8 40c0-6.6 5.4-12 12-12s12 5.4 12 12" />
      <path d="M36 10v8M32 14h8" />
      <path d="M38 24v4M36 26h4" />
    </Rahmen>
  );
}

/**
 * Inspirationshilfe: ein Funke ueber drei verbundenen Punkten.
 *
 * Die Punkte sind das Geflecht — Figuren, Fraktionen, Orte und was zwischen
 * ihnen liegt. Der Funke allein waere vom NPC Creator kaum zu unterscheiden,
 * die Punkte allein saehen aus wie ein Graph.
 */
/**
 * Monster Creator: ein Schaedel mit Hoernern, auf einer Waage.
 *
 * Die Waage ist der Punkt. Das Werkzeug baut nicht nur ein Monster, es wiegt
 * es — und das ist der Teil, der es von einem Wuerfel unterscheidet.
 */
function MonsterIcon({ size = 26 }: IconProps): ReactElement {
  return (
    <Rahmen size={size}>
      <path d="M14 16c0-5 4-8 10-8s10 3 10 8v6c0 3-2 5-4 6h-12c-2-1-4-3-4-6z" />
      <path d="M14 14l-4-5M34 14l4-5" />
      <circle cx="19" cy="19" r="1.6" />
      <circle cx="29" cy="19" r="1.6" />
      <path d="M24 30v8M16 38h16" />
    </Rahmen>
  );
}

function InspirationIcon({ size = 26 }: IconProps): ReactElement {
  return (
    <Rahmen size={size}>
      <path d="M24 6v6M14 10l3 4M34 10l-3 4" />
      <circle cx="24" cy="22" r="4" />
      <circle cx="12" cy="38" r="4" />
      <circle cx="36" cy="38" r="4" />
      <path d="M21 25 14 34M27 25l7 9M16 38h16" />
    </Rahmen>
  );
}

/**
 * Der Status Effect Creator: eine Figur mit einer Marke darauf.
 *
 * Nicht das Zeichen eines einzelnen Zustands — die sind je Thema
 * verschieden. Was alle gemeinsam haben, ist die Stufenleiter daneben: ein
 * Zustand, der schlimmer wird.
 */
function ZustaendeIcon({ size = 26 }: IconProps): ReactElement {
  return (
    <Rahmen size={size}>
      <circle cx="17" cy="13" r="5" />
      <path d="M17 18v14M11 23h12M13 40l4-8M21 40l-4-8" />
      <path d="M32 36h10M32 28h8M32 20h6" />
    </Rahmen>
  );
}

/**
 * Teilen: zwei Figuren am Tisch, dazwischen zwei gegenlaeufige Pfeile.
 *
 * Nicht das uebliche „Teilen"-Zeichen aus Telefonen (drei Punkte): hier
 * geht es um Menschen am selben Tisch, die einander etwas reichen.
 */
function AustauschIcon({ size = 26 }: IconProps): ReactElement {
  return (
    <Rahmen size={size}>
      <circle cx="9" cy="14" r="4" />
      <path d="M3 30c0-5 3-8 6-8s6 3 6 8" />
      <circle cx="39" cy="14" r="4" />
      <path d="M33 30c0-5 3-8 6-8s6 3 6 8" />
      <path d="M17 34h14M27 30l4 4-4 4" />
      <path d="M31 42H17M21 38l-4 4 4 4" />
    </Rahmen>
  );
}

const NACH_ID: Record<string, (p: IconProps) => ReactElement> = {
  austausch: AustauschIcon,
  backstory: BackstoryIcon,
  mapmaker: MapmakerIcon,
  initiative: InitiativeIcon,
  dice: DiceIcon,
  npc: NpcIcon,
  inspiration: InspirationIcon,
  monster: MonsterIcon,
  zustaende: ZustaendeIcon,
  encounter: EncounterIcon,
  nachschlagewerk: NachschlagewerkIcon,
  magicitems: MagicItemsIcon,
  homebrew: HomebrewIcon,
  loot: LootIcon,
  charakterbogen: CharakterbogenIcon
};

/**
 * Symbol zu einer App-ID. Faellt auf die Marke der Sammlung zurueck, damit ein
 * neuer Eintrag im Verzeichnis nicht zu einer Luecke in der Kachel fuehrt.
 */
export function iconFuer(id: string): (p: IconProps) => ReactElement {
  return NACH_ID[id] ?? SuiteIcon;
}

/**
 * Das Symbol eines Werkzeugs: entweder ein eigenes Bild oder das eingebaute.
 *
 * Die eingebauten sind Vektoren und erben `currentColor` — sie passen sich
 * damit von selbst an den Zustand der Kachel an. Ein eigenes Bild kann das
 * nicht und soll es auch nicht: wer eines hinlegt, will genau dieses sehen.
 *
 * Laesst sich das Bild nicht anzeigen — kaputte Datei, unbekanntes Format,
 * das der Browser doch nicht mag —, faellt es still auf das eingebaute
 * zurueck. Ein Symbol ist kein Grund fuer eine Fehlermeldung.
 */
export function AppSymbol({
  id,
  size = 26,
  bild
}: {
  readonly id: string;
  readonly size?: number;
  /** Die data:-URL aus dem Symbolordner, oder undefined. */
  readonly bild?: string;
}): ReactElement {
  /*
   * Gemerkt wird, WELCHES Bild nicht ging — nicht bloss, DASS eines nicht
   * ging.
   *
   * Vorher stand hier ein `useState(false)`, das nie zurueckgesetzt wurde.
   * Einmal auf das eingebaute Symbol zurueckgefallen, blieb die Kachel dabei,
   * solange die Oberflaeche lief: „Symbole neu laden" holte die Datei zwar
   * frisch von der Platte, aber der Schalter stand weiter auf kaputt. Wer
   * eine fehlerhafte Datei ersetzte, sah sein Bild erst nach einem Neustart —
   * und hielt den Knopf zu Recht fuer wirkungslos.
   *
   * Mit der Kennung des gescheiterten Bildes gilt der Fehlschlag nur fuer
   * genau dieses Bild. Kommt ein anderes herein, wird es wieder versucht.
   */
  const [gescheitert, setGescheitert] = useState<string | null>(null);
  const Eingebaut = iconFuer(id);

  if (!bild || gescheitert === bild) return <Eingebaut size={size} />;

  return (
    <img
      className="app-symbol"
      src={bild}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      onError={() => setGescheitert(bild)}
    />
  );
}
