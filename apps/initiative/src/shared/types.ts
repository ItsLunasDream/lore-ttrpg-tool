/**
 * Datentypen des Initiative Trackers.
 *
 * Systemneutral: die Regeln stecken nicht hier drin. Ein Eintrag hat einen
 * Initiativewert, Trefferpunkte und Zustaende — was diese Zahlen bedeuten und
 * wie man sie ermittelt, entscheidet der Tisch. D&D-Bequemlichkeiten (Wurf
 * mit Modifikator) kommen als Zugabe obendrauf, nicht als Voraussetzung.
 */

/** Fassung des Dateiformats (Konvention 2). */
export const SCHEMA_VERSION = 1;

/**
 * Ein Mitglied einer Gruppe — oder der einzige „Koerper\" eines gewoehnlichen
 * Eintrags.
 *
 * Gruppen sind der Grund, warum Trefferpunkte nicht direkt am Eintrag haengen:
 * sechs Goblins wuerfeln *eine* Initiative, haben aber sechs getrennte
 * Trefferpunktesaetze. Ein Eintrag mit genau einem Mitglied ist der
 * Normalfall und sieht in der Oberflaeche aus wie eine einzelne Kreatur.
 */
export interface Koerper {
  readonly id: string;
  /** Zusatz zum Namen des Eintrags, etwa „1\", „2\" — leer beim Einzelwesen. */
  readonly marke: string;
  readonly hp: number;
  readonly hpMax: number;
  /** Zeitweilige Trefferpunkte. Werden vor den echten abgezogen. */
  readonly tempHp: number;
  /** Von Hand ausgetragen, ohne den Eintrag zu loeschen. */
  readonly raus: boolean;
}

/**
 * Wann ein Zustand endet.
 *
 * Die drei Zeitpunkte sind die, die D&D fuer Effekte benutzt; damit sind die
 * allermeisten Zauber abgedeckt. `offen` ist der vierte Fall: laeuft, bis
 * jemand ihn wegnimmt — nicht jeder Zustand hat eine Dauer, und eine
 * erfundene waere schlimmer als keine.
 */
export const DAUERN = ['offen', 'zugBeginn', 'zugEnde', 'rundeEnde'] as const;
export type Dauer = (typeof DAUERN)[number];

/**
 * Ein Zustand, der zu einem bestimmten Zeitpunkt ablaeuft.
 */
export interface Zustand {
  readonly id: string;
  readonly name: string;
  readonly dauer: Dauer;
  /**
   * Wie oft der Endpunkt noch erreicht werden muss. `null` bei `offen`.
   *
   * Meist 1 — „bis zum Ende deines naechsten Zuges\". Groesser fuer Effekte,
   * die mehrere Runden halten: „drei Runden\" ist dreimal „bis zum Ende
   * deines Zuges\".
   */
  readonly rundenRest: number | null;
  /**
   * Gesetzt waehrend des eigenen Zuges der betroffenen Figur.
   *
   * Das ist die Stelle, an der sich am Tisch alle streiten. Wer sich in
   * seinem eigenen Zug einen Effekt „bis zum Ende deines naechsten Zuges\"
   * auflaedt, wird ihn nicht Sekunden spaeter wieder los — gemeint ist der
   * Zug in der naechsten Runde. Der erste eigene Zugwechsel zaehlt deshalb
   * nicht mit, er loescht nur diese Markierung.
   */
  readonly frisch: boolean;
}

export interface Teilnehmer {
  readonly id: string;
  readonly name: string;
  readonly initiative: number;
  /**
   * Entscheidet Gleichstaende. In D&D ist das die Geschicklichkeit; hier
   * heisst es neutral „Feinwert\", weil das Werkzeug kein System vorschreibt.
   */
  readonly feinwert: number;
  /** Spielerfiguren stehen im Kampf anders da: sie werden nicht ausgewuerfelt. */
  readonly istSpieler: boolean;
  /**
   * Kein Lebewesen, sondern das Gelaende: Rauch, der jede Runde zieht,
   * Wasser, das steigt, die Falle, die nachlaedt.
   *
   * Steht bei Initiative 20 in der Reihenfolge, hinter allen Figuren mit
   * derselben Zahl — so wie die Unterschlupfaktion im Regelwerk. Nicht ganz
   * oben: wer 22 gewuerfelt hat, ist vorher dran.
   *
   * Hat keine Trefferpunkte und wird nicht ausgewuerfelt.
   */
  readonly istTerrain: boolean;
  readonly koerper: readonly Koerper[];
  readonly zustaende: readonly Zustand[];
  /** Dateiname im Bildordner des Trackers, oder null. */
  readonly bild: string | null;
  readonly notiz: string;
  /** Ruestungsklasse, wenn bekannt. Fehlt sie, zeigt die Zeile nichts. */
  readonly rk?: number;
  /** Der Statblock als Markdown, wenn er aus dem Encounter Creator kam. */
  readonly statblock?: string;
  /** Kennung des Charakterbogens, wenn die Figur aus einem kam: TP gehen dorthin zurueck. */
  readonly bogen?: string;
}

/** Der laufende Kampf. Sitzungszustand, kein Dokument. */
export interface Kampf {
  readonly schemaVersion: number;
  readonly begegnungId: string | null;
  readonly name: string;
  readonly teilnehmer: readonly Teilnehmer[];
  /** Index in der sortierten Reihenfolge, oder -1, wenn noch nicht begonnen. */
  readonly amZug: number;
  readonly runde: number;
  /** Ob der Kampf laeuft. Vorher lassen sich Werte in Ruhe eintragen. */
  readonly laeuft: boolean;
  /**
   * Wem im Raum eine Figur gehoert (Teilnehmer-Kennung -> Name der Person),
   * fuer die geteilte Initiative. Nach Namen und nicht nach Kennung: die
   * Kennung im Raum ist jedes Mal neu, der Name am Tisch bleibt.
   */
  readonly besitz?: Readonly<Record<string, string>>;
  /** Die Taktik-Notiz des laufenden Kampfs (nur in kampf.json). */
  readonly taktik?: string;
}

/** Eine gespeicherte Begegnung: Markdown mit YAML-Kopf (Konvention 1). */
export interface Begegnung {
  readonly schemaVersion: number;
  readonly id: string;
  readonly name: string;
  readonly teilnehmer: readonly Teilnehmer[];
  /** Der Rumpf des Dokuments: Taktik, Notizen, was der Tisch braucht. */
  readonly taktik: string;
}
