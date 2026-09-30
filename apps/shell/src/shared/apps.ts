/**
 * Das Verzeichnis der Werkzeuge, die die Huelle kennt.
 *
 * Es steht in `shared`, weil beide Seiten es brauchen und beide dieselbe
 * Wahrheit sehen muessen: die Oberflaeche zeichnet daraus Kacheln und
 * Schiene, der Hauptprozess entscheidet daraus, welche Anwendung er
 * montiert. Zwei getrennte Listen wuerden frueher oder spaeter
 * auseinanderlaufen.
 *
 * Kein `electron`, kein `node:*` — die Datei wird in beide Prozesse
 * gebuendelt.
 *
 * Namen und Beschreibungen stehen nicht hier, sondern im Woerterbuch unter
 * `app.<id>.name` und `app.<id>.description`. Sonst gaebe es die Texte in
 * zwei Sprachen an zwei Orten.
 */
import type { MessageKey } from './i18n';

/**
 * Wie weit ein Werkzeug ist.
 *
 * `bereit`      — eingebettet und benutzbar.
 * `vorbereitet` — die Anwendung gibt es, die Huelle kann sie aber noch nicht
 *                 einbetten. Die Kachel laesst sich trotzdem anklicken und
 *                 fuehrt auf eine Flaeche, die genau das sagt. Damit ist der
 *                 Wechsel selbst schon benutzbar und pruefbar, statt bis zum
 *                 Einbetten tot dazuliegen.
 * `geplant`     — noch nicht gebaut, Kachel sichtbar, aber nicht anklickbar.
 *                 Sie steht bewusst jetzt schon da: die Huelle soll zeigen,
 *                 wohin die Sammlung waechst, statt spaeter ueberraschend
 *                 Knoepfe nachwachsen zu lassen.
 */
export type AppStatus = 'bereit' | 'vorbereitet' | 'geplant';

/** Ob eine Kachel oder ein Schieneneintrag angeklickt werden darf. */
export function istWaehlbar(status: AppStatus): boolean {
  return status !== 'geplant';
}



/**
 * Wer ein Werkzeug am Tisch benutzt.
 *
 * `leitung` — fast nur die Spielleitung: Monster, Zustaende, Begegnungen,
 *             Karten, der Tracker, die Inspirationshilfe, Randfiguren.
 * `alle`    — beide Seiten gleichermassen. Die Kampagne lesen und
 *             mitschreiben tun alle; wuerfeln erst recht.
 *
 * Wozu die Unterscheidung? Neun Kacheln nebeneinander sind eine Wand. In
 * zwei benannten Gruppen findet man, was man sucht, ohne jedes Mal alle zu
 * lesen — und wer als Spieler dazukommt, sieht sofort, was ihn angeht.
 *
 * Es ist eine Sortierung, keine Sperre: jede Kachel bleibt anklickbar.
 */
export type Rolle = 'leitung' | 'alle';

/**
 * Die Reihenfolge der Gruppen auf der Startseite.
 *
 * „Fuer alle" zuerst, obwohl es die kleinere Gruppe ist und die Sammlung
 * ueberwiegend Werkzeuge zum Leiten hat. Zwei Gruende: die beiden sind die,
 * die jede Sitzung anfasst, und der Story Creator bleibt damit die erste
 * Kachel — dort hat er immer gestanden.
 *
 * Sieben Kacheln zuerst und die beiden meistbenutzten darunter waere die
 * Wand gewesen, gegen die die Gruppierung angetreten ist.
 */
export const ROLLEN: readonly Rolle[] = ['alle', 'leitung'];

/** Schluessel der Ueberschrift ueber einer Gruppe. */
export const ROLLE_KEY: Record<Rolle, MessageKey> = {
  leitung: 'menu.groupGm',
  alle: 'menu.groupAll'
};

export interface AppEntry {
  /** Stabiler Bezeichner. Wird zum Praefix der IPC-Kanaele und zum Schluessel im Fensterzustand. */
  readonly id: string;
  readonly status: AppStatus;
  readonly rolle: Rolle;
  /**
   * Ob das Werkzeug eigene Einstellungen hat, die im Dialog der Huelle
   * stehen. Fest hier und nicht beim Werkzeug erfragt: ein Werkzeug, das
   * nicht laeuft, kann nicht antworten, und die Liste soll nicht davon
   * abhaengen, was man gerade offen hat. Sprache, Thema und KI gehoeren
   * der Huelle und zaehlen nicht.
   */
  readonly einstellungen?: true;
}

/** Schluessel des Anzeigenamens. Arbeitstitel — die endgueltigen Namen kommen spaeter. */
export function nameKey(id: string): MessageKey {
  return `app.${id}.name` as MessageKey;
}

/** Schluessel des Satzes, der auf der Kachel unter dem Namen steht. */
export function descriptionKey(id: string): MessageKey {
  return `app.${id}.description` as MessageKey;
}

/** Schluessel der Marke, die unten auf der Kachel steht. */
export const STATUS_KEY: Record<AppStatus, MessageKey> = {
  bereit: 'status.ready',
  vorbereitet: 'status.inProgress',
  geplant: 'status.planned'
};

/*
 * Die Reihenfolge ist die der Kacheln, innerhalb der Gruppen.
 *
 * Der Story Creator und die Wuerfel stehen bei „alle": an der Kampagne
 * schreiben beide Seiten mit, und gewuerfelt wird ohnehin von allen. Alles
 * andere ist Vorbereitung oder Leitung am Tisch.
 */
export const APPS: readonly AppEntry[] = [
  { id: 'backstory', status: 'bereit', rolle: 'alle', einstellungen: true },
  { id: 'dice', status: 'bereit', rolle: 'alle' },
  // Bei „alle": den eigenen Bogen fuehren die Spielenden, die SL alle.
  { id: 'charakterbogen', status: 'bereit', rolle: 'alle' },
  // Bei „alle", nicht bei „leitung": ein Nachschlagewerk brauchen Spielende
  // genauso, und am Tisch schlaegt meist jemand anderes nach als der, der
  // leitet.
  { id: 'nachschlagewerk', status: 'bereit', rolle: 'alle' },
  { id: 'monster', status: 'bereit', rolle: 'leitung' },
  { id: 'zustaende', status: 'bereit', rolle: 'leitung' },
  { id: 'magicitems', status: 'bereit', rolle: 'leitung' },
  { id: 'loot', status: 'bereit', rolle: 'leitung' },
  { id: 'initiative', status: 'bereit', rolle: 'leitung' },
  { id: 'mapmaker', status: 'bereit', rolle: 'leitung' },
  { id: 'npc', status: 'bereit', rolle: 'leitung' },
  { id: 'inspiration', status: 'bereit', rolle: 'leitung' },
  { id: 'encounter', status: 'bereit', rolle: 'leitung' }
];

/**
 * Die Werkzeuge einer Rolle, in der Reihenfolge der Liste.
 *
 * Ueber `APPS` gefiltert und nicht als zweite Liste gefuehrt: zwei Listen
 * laufen auseinander, sobald ein Werkzeug dazukommt.
 */
export function appsMitRolle(rolle: Rolle): readonly AppEntry[] {
  return APPS.filter((eintrag) => eintrag.rolle === rolle);
}

/** Liefert den Eintrag zu einer ID, oder `undefined`, wenn es ihn nicht gibt. */
export function findApp(id: string): AppEntry | undefined {
  return APPS.find((entry) => entry.id === id);
}

/**
 * Masse der Huelle in CSS-Pixeln. Der Hauptprozess rechnet damit die Flaeche
 * der eingebetteten Anwendung aus, die Oberflaeche zeichnet damit Titelleiste
 * und Schiene. Beide muessen exakt dieselben Zahlen benutzen, sonst klafft
 * eine Luecke oder die Schiene liegt unter der Anwendung.
 */
export const CHROME = {
  titelleisteHoehe: 40,
  schieneBreite: 56
} as const;

/**
 * Die Flaeche, die einer eingebetteten Anwendung im Fenster bleibt: alles
 * unterhalb der Titelleiste und rechts der Schiene.
 *
 * Steht hier und nicht im Hauptprozess, weil die Zahlen dieselben sein muessen
 * wie die, mit denen die Oberflaeche ihre Titelleiste und Schiene zeichnet.
 * Zwei Rechnungen an zwei Orten waeren genau die Art Fehler, die sich als
 * Ein-Pixel-Spalt zeigt und niemand findet.
 */
export function berechneAppFlaeche(
  fensterBreite: number,
  fensterHoehe: number,
  groesse = 100
): { x: number; y: number; width: number; height: number } {
  // Titelleiste und Schiene sind CSS-Pixel der Huelle. Ist die Oberflaeche
  // vergroessert, sind sie im Fenster entsprechend breiter; die Anwendung
  // muss dann weiter rechts und weiter unten anfangen.
  const schiene = Math.round((CHROME.schieneBreite * groesse) / 100);
  const titel = Math.round((CHROME.titelleisteHoehe * groesse) / 100);
  return {
    x: schiene,
    y: titel,
    // Sehr kleine Fenster sind durch minWidth/minHeight ausgeschlossen, aber
    // waehrend eines Wechsels kann kurz eine Groesse von 0 durchlaufen. Eine
    // negative Breite wuerde Electron werfen lassen.
    width: Math.max(0, fensterBreite - schiene),
    height: Math.max(0, fensterHoehe - titel)
  };
}

/**
 * Die waehlbaren Groessen der ganzen Oberflaeche, in Prozent (#61).
 *
 * Feste Stufen statt eines Schiebers: eine krumme Zahl wie 117 Prozent
 * zeichnet Linien und Schrift unscharf, und wer die Groesse sucht, will
 * „etwas groesser", nicht einen Wert.
 */
export const GROESSEN = [80, 90, 100, 110, 125, 150, 175, 200] as const;
export const VORGABE_GROESSE = 100;

/** Eine Groesse aus der Datei, auf eine erlaubte Stufe gebracht. */
export function gueltigeGroesse(roh: unknown): number {
  return typeof roh === 'number' && (GROESSEN as readonly number[]).includes(roh) ? roh : VORGABE_GROESSE;
}
