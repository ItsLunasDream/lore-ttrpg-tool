/**
 * Was die KI als Ganzes geschickt hat, in das Muster einpassen.
 *
 * Der grosse Knopf fragt nach allem auf einmal, und genau dabei kann ein
 * Modell auf jede erdenkliche Weise danebenliegen: zu wenige Figuren, gar
 * keine Orte, ein Zeitstrahl mit zwei Schritten statt sechs. Die Antwort
 * trotzdem zu nehmen, wie sie kommt, hiesse, dem Regler „Umfang" zu
 * widersprechen und ein halbes Geruest hinzustellen.
 *
 * Deshalb hier: was da ist, wird genommen; was fehlt, kommt aus den
 * Tabellen; was zu viel ist, faellt weg. Die Tabellen sind ohnehin der
 * Normalweg — sie hier als Netz zu benutzen, kostet nichts.
 *
 * Und was festgehalten ist, bleibt festgehalten. Das Modell weiss davon
 * (die Anfrage sagt es ihm), aber verlassen kann man sich darauf nicht.
 */
import {
  erzeugeAufhaenger,
  erzeugeFigur,
  erzeugeFraktion,
  erzeugeOrt,
  erzeugeVerbindungen,
  erzeugeZeitstrahl,
  mitFreiemNamen,
  vergebeneNamen,
  type Baustein,
  type Entwurf,
  type EntwurfsFigur,
  type Fraktion,
  type Ort,
  type Verbindung,
  type Zeitpunkt
} from './erzeuge';
import type { RohEntwurf } from './kiAufgaben';
import { MENGEN, text, type Sprache, type Zuschnitt } from './tabellen';
import { ZEITMARKEN } from './zeitstrahl';

/**
 * Nimmt, was da ist, und fuellt auf.
 *
 * Nicht andersherum (erst wuerfeln, dann ueberschreiben): so steht am Ende
 * immer die richtige Anzahl da, und die Stellen sind stabil — daran haengen
 * die Verbindungen.
 */
function fuelleAuf<T>(gelesen: readonly T[], anzahl: number, wuerfle: () => T): T[] {
  const heraus = gelesen.slice(0, anzahl);
  while (heraus.length < anzahl) heraus.push(wuerfle());
  return heraus;
}

export function baueEntwurf(
  roh: RohEntwurf,
  vorlage: Entwurf | null,
  zuschnitt: Zuschnitt,
  sprache: Sprache,
  rng: () => number,
  festgehalten: readonly Baustein[] = []
): Entwurf {
  const behalten = (baustein: Baustein) => festgehalten.includes(baustein) && vorlage !== null;
  const menge = MENGEN[zuschnitt.umfang];
  // Was aufgefüllt wird, nimmt keinen Namen, den es schon gibt (sonst fiele beim Export eine Notiz weg).
  const vergeben = vergebeneNamen({
    fraktionen: behalten('fraktionen') ? vorlage!.fraktionen : roh.fraktionen,
    figuren: behalten('figuren') ? vorlage!.figuren : roh.figuren,
    orte: behalten('orte') ? vorlage!.orte : roh.orte
  });

  /*
   * Die Weltbeschreibung haengt an keinem Baustein und hat kein Schloss: sie
   * beschreibt den ganzen Entwurf.
   *
   * Die bisherige bleibt nur stehen, wenn ueberhaupt etwas festgehalten ist.
   * Sonst ist dies ein neuer Anfang — und ein Satz ueber Piratenbuchten ueber
   * einem frisch gewuerfelten Cyberpunk-Entwurf war genau der Eindruck, die
   * Vorgaben kaemen nicht an.
   */
  const welt = roh.welt || (festgehalten.length > 0 ? (vorlage?.welt ?? '') : '');

  const aufhaenger = behalten('aufhaenger')
    ? vorlage!.aufhaenger
    : roh.aufhaenger
      ? {
          ausloeser: roh.aufhaenger.ausloeser,
          betroffene: roh.aufhaenger.betroffene,
          komplikation: roh.aufhaenger.komplikation,
          frist: roh.aufhaenger.frist ?? ''
        }
      : erzeugeAufhaenger(zuschnitt, sprache, rng);

  const fraktionen: Fraktion[] = behalten('fraktionen')
    ? [...vorlage!.fraktionen]
    : fuelleAuf(
        roh.fraktionen.map((eintrag) => ({
          name: eintrag.name,
          art: eintrag.art,
          ziel: eintrag.ziel,
          mittel: eintrag.mittel,
          schwaeche: eintrag.schwaeche
        })),
        menge.fraktionen,
        () => mitFreiemNamen(() => erzeugeFraktion(zuschnitt, sprache, rng), vergeben)
      );

  const figuren: EntwurfsFigur[] = behalten('figuren')
    ? [...vorlage!.figuren]
    : fuelleAuf(
        roh.figuren.map((eintrag) => ({
          name: eintrag.name,
          rolle: eintrag.rolle,
          triebfeder: eintrag.triebfeder,
          hebel: eintrag.hebel,
          makel: eintrag.makel
        })),
        menge.figuren,
        () => mitFreiemNamen(() => erzeugeFigur(zuschnitt, sprache, rng), vergeben)
      );

  const orte: Ort[] = behalten('orte')
    ? [...vorlage!.orte]
    : fuelleAuf(
        roh.orte.map((eintrag) => ({
          name: eintrag.name,
          art: eintrag.art,
          merkmal: eintrag.merkmal,
          zustand: eintrag.zustand,
          karte: eintrag.karte,
          ausstattung: eintrag.ausstattung ?? ''
        })),
        menge.orte,
        () => mitFreiemNamen(() => erzeugeOrt(zuschnitt, sprache, rng), vergeben)
      );

  /*
   * Verbindungen sind der einzige Teil, der auf einen anderen zeigt: ihre
   * Nummern meinen Stellen in `figuren`. Was darueber hinausgeht, ist schon
   * beim Lesen weggefallen; hier faellt weg, was durch das Auffuellen oder
   * ein Schloss ins Leere zeigen wuerde.
   */
  const gueltig = (verbindung: { a: number; b: number }) =>
    verbindung.a < figuren.length && verbindung.b < figuren.length && verbindung.a !== verbindung.b;

  let verbindungen: Verbindung[];
  if (behalten('verbindungen')) {
    verbindungen = vorlage!.verbindungen.filter(gueltig);
  } else {
    const gelesen = roh.verbindungen.filter(gueltig);
    // Nichts Brauchbares dabei: dann aus den Tabellen, damit keine Figur
    // ohne Anschluss dasteht. Ein Geflecht ohne Linien ist der Baustein,
    // wegen dem das Werkzeug gebaut wurde.
    verbindungen =
      gelesen.length > 0
        ? gelesen.map((eintrag) => ({ ...eintrag }))
        : erzeugeVerbindungen(figuren, zuschnitt, sprache, rng);
  }

  let zeitstrahl: Zeitpunkt[];
  if (behalten('zeitstrahl')) {
    zeitstrahl = [...vorlage!.zeitstrahl];
  } else {
    const marken = ZEITMARKEN[zuschnitt.umfang];
    const anzahl = Math.min(menge.schritte, marken.length);
    // Die Zeitmarken bleiben aus der Tabelle, nur die Ereignisse kommen vom
    // Modell: sonst passt die Liste nicht mehr zum eingestellten Umfang.
    const ausTabelle = erzeugeZeitstrahl(zuschnitt, sprache, rng);
    zeitstrahl = Array.from({ length: anzahl }, (_, i) => ({
      marke: text(marken[i], sprache),
      was: roh.zeitstrahl[i] ?? ausTabelle[i]?.was ?? ''
    })).filter((punkt) => punkt.was !== '');
  }

  return { welt, aufhaenger, fraktionen, figuren, orte, verbindungen, zeitstrahl };
}
