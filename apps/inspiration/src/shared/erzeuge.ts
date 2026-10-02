/**
 * Aus den Tabellen wird ein Entwurf.
 *
 * Reine Funktionen mit uebergebenem Zufallsgeber, wie im NPC Creator. Nur so
 * laesst sich pruefen, was man sonst nur hoffen kann: dass zweimal
 * Wuerfeln zweierlei ergibt, dass ein festgehaltener Baustein wirklich stehen
 * bleibt und dass ein Zuschnitt die Auswahl verengt, ohne sie leerzuraeumen.
 *
 * Der Entwurf traegt fertige Texte, keine Verweise in die Tabellen — jedes
 * Feld soll von Hand aenderbar sein, und ein selbst geschriebener Satz hat
 * in keiner Tabelle eine Stelle. Der Preis dafuer ist derselbe wie dort: ein
 * fertiger Entwurf wechselt die Sprache nicht mit. Das ist die richtige
 * Seite des Tauschs, denn sonst uebersetzte man eigene Arbeit weg.
 */
import { AUSLOESER, BETROFFENE, FRISTEN, KOMPLIKATIONEN } from './haken';
import {
  FRAKTION_ART,
  FRAKTION_FORM,
  FRAKTION_MITTEL,
  FRAKTION_SCHWAECHE,
  FRAKTION_ZIEL,
  FRAKTION_ZUSATZ
} from './fraktionen';
import { HEBEL, MAKEL, ROLLEN, RUFNAMEN, TRIEBFEDERN } from './figuren';
import {
  NAME_ERSTE,
  NAME_ZWEITE,
  ORT_ART,
  ORT_AUSSTATTUNG,
  ORT_KARTE,
  ORT_MERKMAL,
  ORT_ZUSTAND
} from './orte';
import { VERBINDUNGEN, fuelle } from './verbindungen';
import { SCHRITTE, ZEITMARKEN, type Schritt } from './zeitstrahl';
import {
  MENGEN,
  passend,
  text,
  type Eintrag,
  type Paar,
  type Sprache,
  type Zuschnitt
} from './tabellen';

/** Die sechs Bausteine. Jeder einzeln erzeugbar und einzeln festhaltbar. */
export const BAUSTEINE = [
  'aufhaenger',
  'fraktionen',
  'figuren',
  'orte',
  'verbindungen',
  'zeitstrahl'
] as const;
export type Baustein = (typeof BAUSTEINE)[number];

export interface Aufhaenger {
  readonly ausloeser: string;
  readonly betroffene: string;
  readonly komplikation: string;
  /** Leer, wenn die Sache keine Uhr hat — und das ist oft das Unangenehmere. */
  readonly frist: string;
}

export interface Fraktion {
  readonly name: string;
  readonly art: string;
  readonly ziel: string;
  readonly mittel: string;
  readonly schwaeche: string;
}

export interface EntwurfsFigur {
  readonly name: string;
  readonly rolle: string;
  readonly triebfeder: string;
  readonly hebel: string;
  readonly makel: string;
  /**
   * Ob es diese Figur in der Kampagne schon gibt.
   *
   * Dann wird beim Uebernehmen KEINE Notiz fuer sie angelegt — die gibt es
   * ja. Die Verweise auf ihren Namen treffen die vorhandene Notiz, und im
   * Graph haengt sie danach am neuen Geflecht. Ohne diese Unterscheidung
   * haette man nach dem zweiten Entwurf jede Figur doppelt.
   */
  readonly vorhanden?: boolean;
}

export interface Ort {
  readonly name: string;
  readonly art: string;
  readonly merkmal: string;
  readonly zustand: string;
  /** Ein Satz darueber, was auf einer Karte davon stehen wuerde. */
  readonly karte: string;
  /**
   * Was in der Szene steht, als ein Feld mit Semikolon dazwischen.
   *
   * Eine Zeichenkette und keine Liste, damit sie sich wie jedes andere Feld
   * bearbeiten und nachwuerfeln laesst — die Oberflaeche kennt nur Felder
   * aus Text. Aufgetrennt wird erst dort, wo einzelne Stuecke gebraucht
   * werden: als Pins auf einer Karte. Siehe `ausstattungsstuecke()`.
   */
  readonly ausstattung: string;
}

export interface Verbindung {
  /** Stellen in `figuren`. Fuer das Geflecht, das spaeter gezeichnet wird. */
  readonly a: number;
  readonly b: number;
  readonly muster: string;
  /** Wie A auf B sieht, mit eingesetzten Namen. */
  readonly hin: string;
  readonly zurueck: string;
}

export interface Zeitpunkt {
  readonly marke: string;
  readonly was: string;
}

export interface Entwurf {
  /**
   * Ein, zwei Saetze darueber, in welcher Welt das spielt.
   *
   * Leer, wenn gewuerfelt wurde: die Tabellen beschreiben keine Welt, sie
   * liefern Bausteine, die in viele passen. Die KI dagegen bekommt die
   * Regler im Wortlaut und kann sagen, was sie daraus gemacht hat — bei
   * eigenen Angaben („Cyberpunk City", „Freiheit") ist das der Unterschied
   * zwischen „passt irgendwie" und „genau das".
   */
  readonly welt: string;
  readonly aufhaenger: Aufhaenger;
  readonly fraktionen: readonly Fraktion[];
  readonly figuren: readonly EntwurfsFigur[];
  readonly orte: readonly Ort[];
  readonly verbindungen: readonly Verbindung[];
  readonly zeitstrahl: readonly Zeitpunkt[];
}

/** Wie oft ein Aufhaenger eine Frist bekommt. */
export const FRIST_CHANCE = 0.6;

function waehle<T>(liste: readonly T[], rng: () => number): T {
  if (liste.length === 0) throw new Error('leere Liste');
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))];
}

/**
 * Mehrere verschiedene Eintraege.
 *
 * Ohne „verschieden" stuenden bei drei Orten schon mal zwei gleiche
 * nebeneinander — bei vierzig Eintraegen ist das haeufiger, als man denkt
 * (Geburtstagsparadoxon), und es sieht nach einem Fehler aus, weil es einer
 * ist. Reicht die Liste nicht, wird wiederholt statt abgebrochen.
 */
function waehleMehrere<T>(liste: readonly T[], anzahl: number, rng: () => number): T[] {
  const uebrig = [...liste];
  const heraus: T[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    if (uebrig.length === 0) heraus.push(waehle(liste, rng));
    else heraus.push(uebrig.splice(Math.floor(rng() * uebrig.length), 1)[0]);
  }
  return heraus;
}

function ausTabelle(liste: readonly Eintrag[], zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): string {
  return text(waehle(passend(liste, zuschnitt), rng), sprache);
}

function ausPaaren(liste: readonly Paar[], sprache: Sprache, rng: () => number): string {
  return text(waehle(liste, rng), sprache);
}

/** Wie viele Dinge in einer Szene stehen. Drei fuellen eine Flaeche, ohne sie zuzustellen. */
export const AUSSTATTUNGSSTUECKE = 3;

/** Womit die Stuecke der Ausstattung aneinandergereiht werden. */
export const AUSSTATTUNG_TRENNER = '; ';

/**
 * Mehrere verschiedene Eintraege aus einer Tabelle.
 *
 * Ohne Wiederholung: zweimal derselbe Brunnen auf einer Karte ist kein
 * Ort, sondern ein Fehler. Ist die Tabelle nach dem Zuschnitt kuerzer als
 * gewuenscht, kommt eben weniger heraus.
 */
function mehrereAus(
  liste: readonly Eintrag[],
  zuschnitt: Zuschnitt,
  anzahl: number,
  sprache: Sprache,
  rng: () => number
): string[] {
  const vorrat = [...passend(liste, zuschnitt)];
  const heraus: string[] = [];
  while (heraus.length < anzahl && vorrat.length > 0) {
    const stelle = Math.floor(rng() * vorrat.length);
    heraus.push(text(vorrat.splice(stelle, 1)[0], sprache));
  }
  return heraus;
}

// --- Die einzelnen Bausteine ------------------------------------------------

export function erzeugeAufhaenger(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): Aufhaenger {
  return {
    ausloeser: ausTabelle(AUSLOESER, zuschnitt, sprache, rng),
    betroffene: ausTabelle(BETROFFENE, zuschnitt, sprache, rng),
    komplikation: ausTabelle(KOMPLIKATIONEN, zuschnitt, sprache, rng),
    frist: rng() < FRIST_CHANCE ? ausTabelle(FRISTEN, zuschnitt, sprache, rng) : ''
  };
}

/**
 * Eine Frist, und zwar immer eine.
 *
 * Fuer den Knopf an genau dieser Zeile. Beim Wuerfeln des ganzen Aufhaengers
 * faellt die Frist oft aus, und das ist so gewollt; ein Knopf, der in vier
 * von zehn Faellen ein leeres Feld hinterlaesst, sieht dagegen aus, als
 * reagiere er nicht. Derselbe Unterschied wie bei der Eigenheit im NPC
 * Creator.
 */
export function erzeugeFrist(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): string {
  return ausTabelle(FRISTEN, zuschnitt, sprache, rng);
}

/** Ein Ortsname aus zwei Haelften: Rabenstein, Nebelhafen, Aschbrücke. */
export function erzeugeName(sprache: Sprache, rng: () => number): string {
  const erste = ausPaaren(NAME_ERSTE, sprache, rng);
  const zweite = ausPaaren(NAME_ZWEITE, sprache, rng);
  // Im Englischen trennt ein Apostroph-Name („King's") das Wort; sonst wird
  // zusammengeschrieben wie im Deutschen.
  const getrennt = erste.endsWith('’s');
  return getrennt ? `${erste} ${zweite}` : erste + zweite;
}

export function erzeugeFraktion(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): Fraktion {
  return {
    name: `${ausPaaren(FRAKTION_FORM, sprache, rng)} ${ausPaaren(FRAKTION_ZUSATZ, sprache, rng)}`,
    art: ausTabelle(FRAKTION_ART, zuschnitt, sprache, rng),
    ziel: ausTabelle(FRAKTION_ZIEL, zuschnitt, sprache, rng),
    mittel: ausPaaren(FRAKTION_MITTEL, sprache, rng),
    schwaeche: ausPaaren(FRAKTION_SCHWAECHE, sprache, rng)
  };
}

export function erzeugeFigur(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): EntwurfsFigur {
  return {
    name: `${waehle(RUFNAMEN, rng)} ${erzeugeName(sprache, rng)}`,
    rolle: ausTabelle(ROLLEN, zuschnitt, sprache, rng),
    triebfeder: ausTabelle(TRIEBFEDERN, zuschnitt, sprache, rng),
    hebel: ausPaaren(HEBEL, sprache, rng),
    makel: ausPaaren(MAKEL, sprache, rng)
  };
}

export function erzeugeOrt(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): Ort {
  return {
    name: erzeugeName(sprache, rng),
    art: ausTabelle(ORT_ART, zuschnitt, sprache, rng),
    merkmal: ausTabelle(ORT_MERKMAL, zuschnitt, sprache, rng),
    zustand: ausTabelle(ORT_ZUSTAND, zuschnitt, sprache, rng),
    karte: ausPaaren(ORT_KARTE, sprache, rng),
    ausstattung: mehrereAus(
      ORT_AUSSTATTUNG,
      zuschnitt,
      AUSSTATTUNGSSTUECKE,
      sprache,
      rng
    ).join(AUSSTATTUNG_TRENNER)
  };
}

/**
 * Eine Verbindung zwischen zwei bestimmten Figuren.
 *
 * Die Namen werden hier eingesetzt und nicht erst beim Anzeigen. Wer eine
 * Figur danach umbenennt, sieht den alten Namen stehen — das ist der Preis
 * dafuer, dass jede Zeile fuer sich bearbeitbar ist, und derselbe Tausch wie
 * bei allen anderen Feldern.
 */
export function erzeugeVerbindung(
  a: number,
  b: number,
  figuren: readonly EntwurfsFigur[],
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number
): Verbindung {
  const muster = waehle(passend(VERBINDUNGEN, zuschnitt), rng);
  const nameA = figuren[a]?.name ?? '?';
  const nameB = figuren[b]?.name ?? '?';
  return {
    a,
    b,
    muster: text(muster, sprache),
    hin: fuelle(text(muster.hin, sprache), nameA, nameB),
    zurueck: fuelle(text(muster.zurueck, sprache), nameA, nameB)
  };
}

/**
 * Wer mit wem.
 *
 * Eine Verbindung weniger als Figuren, entlang einer gemischten Reihe. So
 * haengt jede Figur an mindestens einer anderen und niemand steht allein —
 * bei rein zufaelligen Paaren gibt es regelmaessig eine Figur, die mit
 * niemandem zu tun hat, und die ist am Tisch nutzlos.
 */
export function erzeugeVerbindungen(
  figuren: readonly EntwurfsFigur[],
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number
): Verbindung[] {
  if (figuren.length < 2) return [];
  const reihe = figuren.map((_, i) => i);
  for (let i = reihe.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
  }
  const heraus: Verbindung[] = [];
  for (let i = 0; i + 1 < reihe.length; i += 1) {
    heraus.push(erzeugeVerbindung(reihe[i], reihe[i + 1], figuren, zuschnitt, sprache, rng));
  }
  return heraus;
}

/**
 * Was passiert, wenn niemand eingreift.
 *
 * Je Zeitmarke ein Schritt, und die Wucht steigt mit: das erste Drittel aus
 * Stufe 1, das letzte aus Stufe 3.
 */
export function erzeugeZeitstrahl(zuschnitt: Zuschnitt, sprache: Sprache, rng: () => number): Zeitpunkt[] {
  const marken = ZEITMARKEN[zuschnitt.umfang];
  const anzahl = Math.min(MENGEN[zuschnitt.umfang].schritte, marken.length);
  const moeglich = passend(SCHRITTE, zuschnitt) as readonly Schritt[];

  const genutzt = new Set<string>();
  const heraus: Zeitpunkt[] = [];
  for (let i = 0; i < anzahl; i += 1) {
    const anteil = anzahl === 1 ? 1 : i / (anzahl - 1);
    const stufe = anteil < 0.34 ? 1 : anteil < 0.75 ? 2 : 3;
    // Reicht eine Stufe nach dem Zuschnitt nicht, wird auf alle Schritte
    // dieser Stufe ausgewichen, und erst danach auf irgendeinen. Lieber ein
    // Schritt, der nicht ganz zur Region passt, als zweimal derselbe.
    const inStufe = moeglich.filter((s) => s.stufe === stufe && !genutzt.has(s.de));
    const alle = SCHRITTE.filter((s) => s.stufe === stufe && !genutzt.has(s.de));
    const quelle = inStufe.length > 0 ? inStufe : alle.length > 0 ? alle : SCHRITTE;
    const gewaehlt = waehle(quelle, rng);
    genutzt.add(gewaehlt.de);
    heraus.push({ marke: text(marken[i], sprache), was: text(gewaehlt, sprache) });
  }
  return heraus;
}

// --- Der ganze Entwurf ------------------------------------------------------

export const LEERER_ENTWURF: Entwurf = {
  welt: '',
  aufhaenger: { ausloeser: '', betroffene: '', komplikation: '', frist: '' },
  fraktionen: [],
  figuren: [],
  orte: [],
  verbindungen: [],
  zeitstrahl: []
};

/**
 * Alles auf einmal.
 *
 * `festgehalten` nennt die Bausteine, die aus `vorher` uebernommen werden —
 * das Schloss je Baustein, wie im NPC Creator. Verbindungen haengen an den
 * Figuren: wer die Figuren neu wuerfelt und die Verbindungen festhaelt,
 * bekommt seine Verbindungen zurueck, soweit die Stellen noch besetzt sind.
 */
/** Namen, die im Entwurf schon vergeben sind, klein geschrieben; `ausser` zählt nicht mit. */
export function vergebeneNamen(
  entwurf: { readonly [K in 'fraktionen' | 'figuren' | 'orte']: readonly { readonly name?: string }[] },
  ausser = ''
): Set<string> {
  const namen = [...entwurf.fraktionen, ...entwurf.figuren, ...entwurf.orte].map((x) => (x.name ?? '').trim().toLowerCase());
  const heraus = new Set(namen);
  if (ausser && namen.filter((n) => n === ausser.trim().toLowerCase()).length === 1) heraus.delete(ausser.trim().toLowerCase());
  return heraus;
}

/**
 * Würfelt neu, bis der Name noch frei ist, und merkt ihn sich.
 *
 * Jeder Name wird im Story Creator zu einer eigenen Notiz; zwei gleiche
 * Namen hießen zwei gleiche Titel, und der Export übersprang die zweite
 * („already there, skipped"). Aufgefallen als seltener Fehlschlag im
 * Smoke-Test. Nach 30 Versuchen bleibt es beim letzten Wurf.
 */
export function mitFreiemNamen<T extends { readonly name: string }>(erzeuge: () => T, vergeben: Set<string>): T {
  let x = erzeuge();
  for (let versuch = 0; versuch < 30 && vergeben.has(x.name.trim().toLowerCase()); versuch += 1) x = erzeuge();
  vergeben.add(x.name.trim().toLowerCase());
  return x;
}

export function erzeugeEntwurf(
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number,
  festgehalten: readonly Baustein[] = [],
  vorher: Entwurf | null = null
): Entwurf {
  const behalten = new Set(festgehalten);
  const halte = (baustein: Baustein) => behalten.has(baustein) && vorher !== null;
  const menge = MENGEN[zuschnitt.umfang];

  const aufhaenger = halte('aufhaenger')
    ? vorher!.aufhaenger
    : erzeugeAufhaenger(zuschnitt, sprache, rng);

  // Festgehaltene Namen zuerst; neu Gewürfeltes weicht ihnen und einander aus.
  const vergeben = vergebeneNamen({
    fraktionen: halte('fraktionen') ? vorher!.fraktionen : [],
    figuren: halte('figuren') ? vorher!.figuren : [],
    orte: halte('orte') ? vorher!.orte : []
  });

  const fraktionen = halte('fraktionen')
    ? vorher!.fraktionen
    : Array.from({ length: menge.fraktionen }, () => mitFreiemNamen(() => erzeugeFraktion(zuschnitt, sprache, rng), vergeben));

  const figuren = halte('figuren')
    ? vorher!.figuren
    : Array.from({ length: menge.figuren }, () => mitFreiemNamen(() => erzeugeFigur(zuschnitt, sprache, rng), vergeben));

  const orte = halte('orte')
    ? vorher!.orte
    : waehleMehrere(
        Array.from({ length: Math.max(menge.orte * 2, 8) }, () => mitFreiemNamen(() => erzeugeOrt(zuschnitt, sprache, rng), vergeben)),
        menge.orte,
        rng
      );

  const verbindungen = halte('verbindungen')
    ? vorher!.verbindungen.filter((v) => v.a < figuren.length && v.b < figuren.length)
    : erzeugeVerbindungen(figuren, zuschnitt, sprache, rng);

  const zeitstrahl = halte('zeitstrahl')
    ? vorher!.zeitstrahl
    : erzeugeZeitstrahl(zuschnitt, sprache, rng);

  return {
    // Gewuerfelt gibt es keine Weltbeschreibung; eine vorhandene bleibt
    // stehen, statt beim naechsten Wurf verloren zu gehen.
    welt: vorher?.welt ?? '',
    aufhaenger,
    fraktionen,
    figuren,
    orte,
    verbindungen,
    zeitstrahl
  };
}

/**
 * Eine Figur dazunehmen — und sie gleich anbinden.
 *
 * Fuer Figuren, die es schon gibt (aus der offenen Kampagne). Ohne die
 * Verbindung stuende sie als Name in der Liste und haette mit der Geschichte
 * nichts zu tun; genau das Verbinden ist aber der Grund, sie zu holen.
 */
export function fuegeFigurHinzu(
  entwurf: Entwurf,
  figur: EntwurfsFigur,
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number
): Entwurf {
  const figuren = [...entwurf.figuren, figur];
  const neue = figuren.length - 1;
  if (neue === 0) return { ...entwurf, figuren };

  const andere = Math.floor(rng() * neue);
  return {
    ...entwurf,
    figuren,
    verbindungen: [
      ...entwurf.verbindungen,
      erzeugeVerbindung(andere, neue, figuren, zuschnitt, sprache, rng)
    ]
  };
}

/**
 * Eine einzelne Figur austauschen — mit ihren Verbindungen.
 *
 * Wer eine Figur allein neu wuerfelt, bekommt einen neuen Namen; in den
 * Verbindungen stuende weiter der alte, denn dort sind die Namen fest
 * eingesetzt. Am Tisch waere das ein Geflecht mit einer Person, die es nicht
 * mehr gibt. Darum werden genau die Verbindungen dieser Stelle neu gezogen,
 * alle anderen bleiben, wie sie sind.
 */
export function ersetzeFigur(
  entwurf: Entwurf,
  stelle: number,
  figur: EntwurfsFigur,
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number
): Entwurf {
  const figuren = entwurf.figuren.map((eintrag, i) => (i === stelle ? figur : eintrag));
  return {
    ...entwurf,
    figuren,
    verbindungen: entwurf.verbindungen.map((verbindung) =>
      verbindung.a === stelle || verbindung.b === stelle
        ? erzeugeVerbindung(verbindung.a, verbindung.b, figuren, zuschnitt, sprache, rng)
        : verbindung
    )
  };
}

/**
 * Eine Figur umbenennen — und die Verbindungen mit.
 *
 * Fuer die Bearbeitung von Hand. Die Namen stehen in den Verbindungen fest
 * eingesetzt, weil dort jede Zeile fuer sich bearbeitbar sein soll; wer eine
 * Figur umtauft, wuerde sonst ein Geflecht hinterlassen, das von jemandem
 * spricht, den es nicht mehr gibt.
 *
 * `alterName` wird ausdruecklich uebergeben und nicht aus dem Entwurf
 * genommen. Der Grund ist die Bedienung: das Namensfeld schreibt bei jedem
 * Tastendruck in den Entwurf, und ein zeichenweises Ersetzen wuerde
 * zwischendurch einzelne Buchstaben im ganzen Satz austauschen. Die
 * Oberflaeche merkt sich darum den Namen beim Hineinklicken und ruft dies
 * hier erst beim Verlassen des Feldes auf — einmal, mit dem vollen alten
 * Namen.
 *
 * Ist einer der beiden Namen leer oder sind sie gleich, bleiben die
 * Verbindungen unangetastet.
 */
export function benenneFigurUm(
  entwurf: Entwurf,
  stelle: number,
  name: string,
  alterName: string
): Entwurf {
  const figuren = entwurf.figuren.map((eintrag, i) => (i === stelle ? { ...eintrag, name } : eintrag));
  if (!alterName || !name || alterName === name) return { ...entwurf, figuren };

  const tausche = (text: string) => text.split(alterName).join(name);
  return {
    ...entwurf,
    figuren,
    verbindungen: entwurf.verbindungen.map((verbindung) =>
      verbindung.a === stelle || verbindung.b === stelle
        ? { ...verbindung, hin: tausche(verbindung.hin), zurueck: tausche(verbindung.zurueck) }
        : verbindung
    )
  };
}

/**
 * Wie viele verschiedene Ergebnisse in den Tabellen stecken.
 *
 * Steht in der Oberflaeche unter dem Wuerfelknopf. Das ist keine Spielerei:
 * der Vorwurf an solche Werkzeuge ist, dass nach dem fuenften Wurf alles
 * gleich aussieht, und diese Zahl ist die Antwort darauf — nachrechenbar aus
 * den Tabellen selbst, nicht behauptet.
 */
export function moeglichkeiten(): {
  aufhaenger: number;
  fraktionen: number;
  figuren: number;
  orte: number;
  verbindungen: number;
} {
  return {
    aufhaenger: AUSLOESER.length * BETROFFENE.length * KOMPLIKATIONEN.length * (FRISTEN.length + 1),
    fraktionen:
      FRAKTION_FORM.length *
      FRAKTION_ZUSATZ.length *
      FRAKTION_ART.length *
      FRAKTION_ZIEL.length *
      FRAKTION_MITTEL.length *
      FRAKTION_SCHWAECHE.length,
    figuren:
      RUFNAMEN.length *
      NAME_ERSTE.length *
      NAME_ZWEITE.length *
      ROLLEN.length *
      TRIEBFEDERN.length *
      HEBEL.length *
      MAKEL.length,
    orte:
      NAME_ERSTE.length *
      NAME_ZWEITE.length *
      ORT_ART.length *
      ORT_MERKMAL.length *
      ORT_ZUSTAND.length *
      ORT_KARTE.length *
      ORT_AUSSTATTUNG.length,
    verbindungen: VERBINDUNGEN.length
  };
}
