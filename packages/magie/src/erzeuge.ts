/**
 * Wuerfelt einen magischen Gegenstand aus den Tabellen.
 *
 * Eingabe: Art und Seltenheit (beide optional, sonst gewuerfelt), die
 * Sprache und eine Zufallsquelle. Ausgabe: ein fertiger Gegenstand mit Name,
 * Wirkungen als Saetzen, Einstimmung und Wert. Die Saetze stehen in der
 * gewaehlten Sprache fest — was danach bearbeitet wird, gehoert dem
 * Menschen und wird nicht uebersetzt.
 *
 * Plattformfrei und mit einstellbarem Zufall, damit die Tests nicht vom
 * Glueck abhaengen.
 */
import { SELTENHEITEN, gegenstandswert, type Seltenheit } from '@suite/srd';
import { EICHPUNKTE } from './eichpunkte';
import {
  ARTEN,
  ATTRIBUTE,
  BEINAME,
  FERTIGKEITEN,
  FLUECHE,
  GRUNDWORT,
  KREATURENTYPEN,
  SCHADENSARTEN,
  STUFE,
  VERBRAUCH,
  WIRKUNGEN,
  ZAUBER,
  ZUSTAENDE,
  type Art,
  type Wirkung
} from './tabellen';

export type Sprache = 'de' | 'en';
export type Zufall = () => number;

export interface Gegenstand {
  readonly id: string;
  readonly name: string;
  readonly art: Art;
  readonly seltenheit: Seltenheit;
  readonly einstimmung: boolean;
  /** Je Wirkung ein Satz. */
  readonly wirkungen: readonly string[];
  /** Leer, wenn der Gegenstand nicht verflucht ist. */
  readonly fluch: string;
  /** Wert in Goldmuenzen, nach der Tabelle des SRD. */
  readonly wert: number;
  readonly notiz: string;
  readonly geaendert: string;
  /**
   * Steht im Loot Generator. Nur auf ausdruecklichen Wunsch („Send to Loot
   * Generator"), nicht schon durch Speichern: nicht jeder gebaute
   * Gegenstand soll als Beute auftauchen.
   */
  readonly imLoot?: boolean;
}

function eins<T>(liste: readonly T[], zufall: Zufall): T {
  return liste[Math.floor(zufall() * liste.length)];
}

/** Der Bonus je Seltenheit: Ungewoehnlich +1, Selten +2, Sehr selten +3. */
function bonus(stufe: number): number {
  return Math.max(1, Math.min(3, stufe));
}

/**
 * Zusatzschaden je Seltenheit. Die Flammenzunge (selten) macht 2W6, der
 * Drachentoeter (selten) 3W6 gegen Drachen — unsere Staffel liegt bei
 * selten also auf 2W6.
 */
const SCHADEN = ['1W4', '1W6', '2W6', '3W6', '3W6'];
const SCHADEN_EN = ['1d4', '1d6', '2d6', '3d6', '3d6'];

/** Heilung eines Tranks je Seltenheit (wie die Heiltraenke des SRD gestaffelt). */
const HEILUNG = ['2W4 + 2', '4W4 + 4', '8W4 + 8', '10W4 + 20', '10W4 + 20'];
const HEILUNG_EN = ['2d4 + 2', '4d4 + 4', '8d4 + 8', '10d4 + 20', '10d4 + 20'];

/** Der hoechste Zaubergrad je Seltenheit, fuer Staebe und Schriftrollen. */
const HOECHSTER_GRAD = [1, 3, 5, 7, 9];

/** Der hoechste Zaubergrad einer Seltenheit (fuer den Wert einer Schriftrolle). */
export function hoechsterGrad(seltenheit: Seltenheit): number {
  return HOECHSTER_GRAD[Math.max(0, SELTENHEITEN.indexOf(seltenheit))] ?? 1;
}
/** SG eines Stabs je Seltenheit. */
const STAB_SG = [13, 13, 15, 17, 19];

export interface Gefuellt {
  readonly text: string;
  /** Der Zaubergrad, wenn die Wirkung einen Zauber traegt (fuer den Wert der Schriftrolle). */
  readonly grad?: number;
}

export function fuelle(wirkung: Wirkung, stufe: number, sprache: Sprache, zufall: Zufall): Gefuellt {
  const de = sprache === 'de';
  let grad: number | undefined;
  // Der Versatz wirkt auf die rohe Stufe: Ruestung legendaer ist +3, nicht
  // erst auf +3 gedeckelt und dann um eins gesenkt.
  const b = wirkung.bonus?.fest ?? bonus(stufe + (wirkung.bonus?.versatz ?? 0));
  const werte: Record<string, string> = {
    bonus: `+${b}`,
    schaden: (de ? SCHADEN : SCHADEN_EN)[stufe],
    art: eins(SCHADENSARTEN, zufall)[sprache],
    typ: eins(KREATURENTYPEN, zufall)[sprache],
    zustand: eins(ZUSTAENDE, zufall)[sprache],
    attribut: eins(ATTRIBUTE, zufall)[sprache],
    fertigkeit: eins(FERTIGKEITEN, zufall)[sprache],
    heilung: (de ? HEILUNG : HEILUNG_EN)[stufe],
    ladungen: String(3 + stufe * 2),
    // Nutzungen am Tag und temporaere TP fuer die eigenen Wirkungen: bewusst
    // knapper als Ladungen und Heilung, weil sie jeden Tag wiederkommen.
    mal: String(Math.max(1, stufe)),
    tp: String(5 * Math.max(1, stufe)),
    wurf: String(STAB_SG[stufe])
  };
  if (wirkung.text.de.includes('{zauber}')) {
    // Schriftrollen tragen den hoechsten Grad ihrer Seltenheit oder knapp
    // darunter; taegliche Zauber bleiben zwei Grade darunter, sonst waere
    // „einmal am Tag Feuerball" schon ungewoehnlich.
    const oben = HOECHSTER_GRAD[stufe] - (wirkung.id === 'schriftrolle-zauber' ? 0 : 2);
    const unten = wirkung.id === 'schriftrolle-zauber' ? Math.max(0, oben - 1) : 1;
    grad = Math.max(unten, Math.min(oben, unten + Math.floor(zufall() * (oben - unten + 1))));
    grad = Math.max(0, grad);
    werte.zauber = eins(ZAUBER[grad], zufall)[sprache];
    werte.grad = String(grad);
  }
  let text = wirkung.text[sprache];
  for (const [name, wert] of Object.entries(werte)) text = text.split(`{${name}}`).join(wert);
  return { text, grad };
}

/**
 * Wirkungen nach dem Muster eines Gegenstands aus dem SRD: alle, die nicht
 * `eigen-` heissen (die meisten sind daran geeicht, siehe eichpunkte.ts;
 * die uebrigen sind SRD-Gegenstaende nachgebaut, etwa „Zauberstab mit
 * Ladungen" oder die Schriftrolle). Besteht ein Gegenstand NUR aus solchen,
 * ist er ein SRD-Gegenstand mit neuem Namen — ein Heiltrank, der
 * „Elixier des Nebels" heisst (Rueckmeldung). Der Erzeuger mischt dann eine
 * eigene Wirkung hinein.
 */
export function istSrdGleich(wirkung: Wirkung): boolean {
  return !wirkung.id.startsWith('eigen-');
}

/** Ob die Eichpunkte eine Wirkung kennen — fuer die Tests der Eichung. */
export function istGeeicht(wirkung: Wirkung): boolean {
  return EICHPUNKTE.some((p) => p.wirkung === wirkung.id);
}

/** Was fuer diese Art und Seltenheit in Frage kommt. */
function vorratFuer(art: Art, stufe: number): Wirkung[] {
  const moeglich = WIRKUNGEN.filter((w) => w.arten.includes(art) && w.ab <= stufe && w.bis >= stufe);
  // Faellt fuer diese Seltenheit nichts, nimm, was der Art am naechsten liegt.
  return moeglich.length
    ? moeglich
    : WIRKUNGEN.filter((w) => w.arten.includes(art))
        .sort((a, b) => Math.abs(a.ab - stufe) - Math.abs(b.ab - stufe))
        .slice(0, 1);
}

/**
 * Eine einzelne Wirkung wuerfeln — fuer „Wirkung wuerfeln" und das
 * Nachwuerfeln einer Zeile. `vorhanden` sind die Texte, die schon dastehen:
 * dieselbe Wirkung zweimal waere keine neue.
 */
export function wuerfleWirkung(
  art: Art,
  seltenheit: Seltenheit,
  sprache: Sprache,
  vorhanden: readonly string[] = [],
  zufall: Zufall = Math.random
): string {
  const stufe = STUFE[seltenheit];
  const vorrat = vorratFuer(art, stufe);
  let text = '';
  for (let versuch = 0; versuch < 30; versuch += 1) {
    text = fuelle(eins(vorrat, zufall), stufe, sprache, zufall).text;
    if (!vorhanden.includes(text)) break;
  }
  return text;
}

/** Ein Fluch mit gefuellten Platzhaltern; `ausser` wird gemieden. */
export function wuerfleFluch(sprache: Sprache, ausser = '', zufall: Zufall = Math.random): string {
  let text = '';
  for (let versuch = 0; versuch < 20; versuch += 1) {
    text = eins(FLUECHE, zufall)[sprache]
      .split('{art}').join(eins(SCHADENSARTEN, zufall)[sprache])
      .split('{typ}').join(eins(KREATURENTYPEN, zufall)[sprache])
      .split('{zustand}').join(eins(ZUSTAENDE, zufall)[sprache]);
    if (text !== ausser) break;
  }
  return text;
}

/** Wie viele Wirkungen ein Gegenstand dieser Seltenheit traegt. */
function anzahlWirkungen(art: Art, stufe: number): number {
  if (art === 'trank' || art === 'schriftrolle') return 1;
  return stufe >= 3 ? 3 : stufe >= 1 ? 2 : 1;
}

export interface Wunsch {
  readonly art?: Art;
  readonly seltenheit?: Seltenheit;
  /** Wahrscheinlichkeit eines Fluchs, 0 bis 1. Voreinstellung: 0,1. */
  readonly fluchChance?: number;
}

export function erzeuge(wunsch: Wunsch, sprache: Sprache, zufall: Zufall = Math.random): Gegenstand {
  const art = wunsch.art ?? eins(ARTEN, zufall);
  const seltenheit = wunsch.seltenheit ?? eins(SELTENHEITEN, zufall);
  const stufe = STUFE[seltenheit];

  const vorrat = vorratFuer(art, stufe);
  // Schriftrollen tragen immer ihren Zauber zuerst: an ihm haengt der Wert.
  const grundlage = art === 'schriftrolle' ? vorrat.filter((w) => w.id === 'schriftrolle-zauber') : [];

  const gewaehlt: Wirkung[] = [...grundlage];
  const ziel = Math.min(anzahlWirkungen(art, stufe), vorrat.length);
  // Nebenwirkungen nie als Hauptwirkung: sie kommen nur unten als Beigabe.
  // Gibt es fuer diese Stufe keine echte Wirkung, nimm die naechstliegende.
  const echt = vorrat.filter((w) => !w.zusatz);
  const haupt = echt.length
    ? echt
    : WIRKUNGEN.filter((w) => w.arten.includes(art) && !w.zusatz)
        .sort((a, b) => Math.abs(a.bis - stufe) - Math.abs(b.bis - stufe))
        .slice(0, 1);
  for (let versuch = 0; gewaehlt.length < ziel && versuch < 50 && haupt.length; versuch += 1) {
    const w = eins(haupt, zufall);
    if (!gewaehlt.includes(w)) gewaehlt.push(w);
  }

  /*
   * Nie ein SRD-Gegenstand mit neuem Namen: stehen nur geeichte Wirkungen
   * da, kommt eine eigene dazu. Bei einem Gegenstand mit mehreren
   * Wirkungen ersetzt sie die letzte (die Zahl der Wirkungen folgt der
   * Seltenheit), bei einem mit nur einer (Trank, Schriftrolle, gewoehnlich)
   * kommt sie hinzu.
   */
  const eigene = vorrat.filter((w) => !istSrdGleich(w) && !gewaehlt.includes(w));
  if (gewaehlt.every(istSrdGleich) && eigene.length) {
    const dazu = eins(eigene, zufall);
    // Eine Nebenwirkung ersetzt nie die einzige echte Wirkung.
    if (gewaehlt.length >= 2 && !dazu.zusatz) gewaehlt[gewaehlt.length - 1] = dazu;
    else gewaehlt.push(dazu);
  }
  const gefuellt = gewaehlt.map((w) => fuelle(w, stufe, sprache, zufall));

  // Traenke und Schriftrollen bekommen keinen zufaelligen Fluch: die Flueche
  // sprechen von Einstimmung und vom Tragen, und beides kennt ein Trank nicht.
  const verbrauchbar = art === 'trank' || art === 'schriftrolle';
  const fluch = !verbrauchbar && zufall() < (wunsch.fluchChance ?? 0.1) ? wuerfleFluch(sprache, '', zufall) : '';
  const grund = eins(GRUNDWORT[art], zufall)[sprache];
  const beiname = eins(BEINAME, zufall)[sprache];
  const scrollGrad = art === 'schriftrolle' ? gefuellt[0]?.grad : undefined;

  return {
    id: '',
    name: `${grund} ${beiname}`,
    art,
    seltenheit,
    // Traenke und Schriftrollen verlangen nie Einstimmung; sonst entscheidet
    // die staerkste Wirkung. Ein Fluch bindet immer.
    einstimmung:
      art !== 'trank' && art !== 'schriftrolle' && (gewaehlt.some((w) => w.einstimmung) || Boolean(fluch)),
    wirkungen: gefuellt.map((g) => g.text),
    fluch,
    wert: gegenstandswert(seltenheit, { verbrauch: VERBRAUCH[art], schriftrolleGrad: scrollGrad }),
    notiz: '',
    geaendert: ''
  };
}
