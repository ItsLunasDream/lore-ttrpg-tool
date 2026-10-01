/**
 * Die Tabellen des Settlement Generators (docs/ortsgenerator.md).
 *
 * Zwei Sorten Inhalt, sauber getrennt:
 *
 * - **Aus dem SRD 5.2.1** (Kapitel „Equipment"/„Ausrüstung" und „Magic
 *   Items"): die drei Ortsgrößen Village/Town/City, die Zauberwirken-
 *   Dienstleistungen je Größe, die Preise im Gasthaus nach Lebensstil und die
 *   Regel, in welchem Ort man magische Gegenstände welcher Seltenheit kaufen
 *   kann. Wortlaut und Zahlen stehen im Test gegen das PDF geprüft
 *   (tests/srd.test.mjs prüft die Zahlen gegen die eingelesenen Tabellen,
 *   soweit sie in @suite/srd liegen).
 * - **Eigene Tabellen** (Namen, Herrschaft, Wirtschaft, Besonderheiten,
 *   Probleme, Gerüchte, Gasthausnamen, welche Läden es wo gibt): nicht aus
 *   dem SRD, sondern geschrieben für dieses Werkzeug. Wo daraus eine Regel
 *   wird (welcher Laden ab welcher Größe), ist das eine Annahme und als solche
 *   in der Oberfläche gekennzeichnet.
 *
 * Jeder Eintrag zweisprachig, wie im NPC Creator.
 */
import type { Seltenheit } from '@suite/srd';

export interface Paar {
  readonly de: string;
  readonly en: string;
}
export type Sprache = 'de' | 'en';

export function text(p: Paar, s: Sprache): string {
  return p[s];
}

// --- Größe (SRD) -------------------------------------------------------------

/** Die drei Größen des SRD: „Village, town, or city" / „Dorf, Kleinstadt oder Stadt". */
export const GROESSEN = ['dorf', 'kleinstadt', 'stadt'] as const;
export type Groesse = (typeof GROESSEN)[number];

export const GROESSE_NAME: Record<Groesse, Paar> = {
  dorf: { de: 'Dorf', en: 'Village' },
  kleinstadt: { de: 'Kleinstadt', en: 'Town' },
  stadt: { de: 'Stadt', en: 'City' }
};

/**
 * Einwohnerzahlen. NICHT aus dem SRD (dort stehen keine), sondern eine
 * Annahme, damit die Zahl zur Größe passt.
 */
export const EINWOHNER: Record<Groesse, readonly [number, number]> = {
  dorf: [60, 400],
  kleinstadt: [1000, 6000],
  stadt: [10000, 40000]
};

// --- Zauberwirken als Dienstleistung (SRD) ------------------------------------

export interface Zauberdienst {
  /** „0" für Zaubertricks, sonst „1", „2", „3", „4–5", „6–8", „9". */
  readonly grade: string;
  /** Der höchste Grad der Zeile, zum Vergleichen. */
  readonly bis: number;
  readonly orte: readonly Groesse[];
  /** GM, ohne teure Komponenten (die kommen laut SRD dazu). */
  readonly kosten: number;
}

/** SRD 5.2.1, „Spellcasting Services" / „Zauberwirken-Dienstleistungen". */
export const ZAUBERDIENSTE: readonly Zauberdienst[] = [
  { grade: '0', bis: 0, orte: ['dorf', 'kleinstadt', 'stadt'], kosten: 30 },
  { grade: '1', bis: 1, orte: ['dorf', 'kleinstadt', 'stadt'], kosten: 50 },
  { grade: '2', bis: 2, orte: ['dorf', 'kleinstadt', 'stadt'], kosten: 200 },
  { grade: '3', bis: 3, orte: ['kleinstadt', 'stadt'], kosten: 300 },
  { grade: '4–5', bis: 5, orte: ['kleinstadt', 'stadt'], kosten: 2000 },
  { grade: '6–8', bis: 8, orte: ['stadt'], kosten: 20000 },
  { grade: '9', bis: 9, orte: ['stadt'], kosten: 100000 }
];

// --- Gasthaus (SRD) -----------------------------------------------------------

/** Die Lebensstile des SRD, soweit es dafür Gasthauspreise gibt. */
export const QUALITAETEN = ['aermlich', 'schlecht', 'einfach', 'komfortabel', 'wohlhabend', 'edel'] as const;
export type Qualitaet = (typeof QUALITAETEN)[number];

/** Namen wie im SRD (Squalid … Aristocratic / Ärmlich … Edel). */
export const QUALITAET_NAME: Record<Qualitaet, Paar> = {
  aermlich: { de: 'Ärmlich', en: 'Squalid' },
  schlecht: { de: 'Schlecht', en: 'Poor' },
  einfach: { de: 'Einfach', en: 'Modest' },
  komfortabel: { de: 'Komfortabel', en: 'Comfortable' },
  wohlhabend: { de: 'Wohlhabend', en: 'Wealthy' },
  edel: { de: 'Edel', en: 'Aristocratic' }
};

/** SRD 5.2.1, „Food, Drink, and Lodging": Übernachtung und Mahlzeit in GM. */
export const GASTHAUS_PREISE: Record<Qualitaet, { readonly nacht: number; readonly mahlzeit: number }> = {
  aermlich: { nacht: 0.07, mahlzeit: 0.01 },
  schlecht: { nacht: 0.1, mahlzeit: 0.02 },
  einfach: { nacht: 0.5, mahlzeit: 0.1 },
  komfortabel: { nacht: 0.8, mahlzeit: 0.2 },
  wohlhabend: { nacht: 2, mahlzeit: 0.3 },
  edel: { nacht: 4, mahlzeit: 0.6 }
};

/** SRD 5.2.1, dieselbe Tabelle: was es unabhängig vom Lebensstil gibt. */
export const GETRAENKE: readonly { readonly name: Paar; readonly preis: number }[] = [
  { name: { de: 'Bier (Humpen)', en: 'Ale (mug)' }, preis: 0.04 },
  { name: { de: 'Brot (Laib)', en: 'Bread (loaf)' }, preis: 0.02 },
  { name: { de: 'Käse (Ecke)', en: 'Cheese (wedge)' }, preis: 0.1 },
  { name: { de: 'Wein, gewöhnlich (Flasche)', en: 'Wine, common (bottle)' }, preis: 0.2 },
  { name: { de: 'Wein, fein (Flasche)', en: 'Wine, fine (bottle)' }, preis: 10 }
];

/** Welche Qualität ein Gasthaus je Größe haben kann. Annahme, nicht SRD. */
export const GASTHAUS_QUALITAET: Record<Groesse, readonly Qualitaet[]> = {
  dorf: ['aermlich', 'schlecht', 'einfach'],
  kleinstadt: ['schlecht', 'einfach', 'komfortabel'],
  stadt: ['einfach', 'komfortabel', 'wohlhabend', 'edel']
};

// --- Magische Gegenstände kaufen (SRD) ----------------------------------------

/**
 * SRD 5.2.1, „Magic Item Values by Rarity": „Common magic items can often be
 * bought in a town or city. Uncommon and Rare magic items are usually found
 * only in cities." Seltenere nur an „wundersamen Orten", also hier nie.
 *
 * Die deutsche Fassung schreibt bei „Common" „in Dörfern oder Städten"; die
 * englische „in a town or city". Hier gilt die englische, weil sie zur
 * Tabelle der Zauberdienste passt (Village/Town/City).
 */
export const MAGIE_KAUFBAR: Record<Groesse, readonly Seltenheit[]> = {
  dorf: [],
  kleinstadt: ['common'],
  stadt: ['common', 'uncommon', 'rare']
};

// --- Läden (Annahme) ----------------------------------------------------------

export const LADENARTEN = ['kraemer', 'schmied', 'bogner', 'alchemist', 'magie'] as const;
export type Ladenart = (typeof LADENARTEN)[number];

export const LADEN_NAME: Record<Ladenart, Paar> = {
  kraemer: { de: 'Krämerladen', en: 'General Store' },
  schmied: { de: 'Schmiede', en: 'Smithy' },
  bogner: { de: 'Bogner', en: 'Bowyer' },
  alchemist: { de: 'Alchemist', en: 'Alchemist' },
  magie: { de: 'Magieladen', en: 'Magic Shop' }
};

/**
 * Welche Läden es je Größe gibt. Annahme: das SRD regelt nur die magischen
 * Gegenstände (MAGIE_KAUFBAR), nicht, wo es Schmiede oder Bogner gibt.
 */
export const LAEDEN_JE_GROESSE: Record<Groesse, readonly Ladenart[]> = {
  dorf: ['kraemer', 'schmied'],
  kleinstadt: ['kraemer', 'schmied', 'bogner', 'alchemist', 'magie'],
  stadt: ['kraemer', 'schmied', 'bogner', 'alchemist', 'magie']
};

/** Wie viele Waren ein Laden zeigt, je Größe. Annahme. */
export const WAREN_ANZAHL: Record<Groesse, readonly [number, number]> = {
  dorf: [4, 6],
  kleinstadt: [6, 9],
  stadt: [8, 12]
};

/** Die Waren des Alchemisten: Kennungen der SRD-Abenteurerausrüstung. */
export const ALCHEMIE_WAREN: readonly string[] = [
  'acid-25-gp',
  'alchemist-s-fire-50-gp',
  'antitoxin-50-gp',
  'oil-1-sp',
  'perfume-5-gp',
  'holy-water-25-gp',
  'poison-basic-100-gp',
  'healer-s-kit-5-gp',
  'vial-1-gp'
];

// --- Personen (eigene Tabelle) --------------------------------------------------

export interface Rolle {
  readonly id: string;
  /** Deutsch je Namensklang; `n` neutral mit Doppelpunkt, wie im Rest der Sammlung. */
  readonly de: { readonly w: string; readonly m: string; readonly n: string };
  readonly en: string;
  /** Ab welcher Größe es die Rolle gibt. */
  readonly ab: Groesse;
}

export const ROLLEN: readonly Rolle[] = [
  { id: 'oberhaupt', de: { w: 'Bürgermeisterin', m: 'Bürgermeister', n: 'Bürgermeister:in' }, en: 'Mayor', ab: 'dorf' },
  { id: 'geweiht', de: { w: 'Priesterin', m: 'Priester', n: 'Priester:in' }, en: 'Priest', ab: 'dorf' },
  { id: 'heiler', de: { w: 'Heilerin', m: 'Heiler', n: 'Heiler:in' }, en: 'Healer', ab: 'dorf' },
  { id: 'wache', de: { w: 'Hauptfrau der Wache', m: 'Hauptmann der Wache', n: 'Wachhabende:r' }, en: 'Captain of the guard', ab: 'kleinstadt' },
  { id: 'kaufleute', de: { w: 'Händlerin', m: 'Händler', n: 'Händler:in' }, en: 'Merchant', ab: 'kleinstadt' },
  { id: 'hehler', de: { w: 'Hehlerin', m: 'Hehler', n: 'Hehler:in' }, en: 'Fence', ab: 'kleinstadt' },
  { id: 'gilde', de: { w: 'Gildenmeisterin', m: 'Gildenmeister', n: 'Gildenmeister:in' }, en: 'Guildmaster', ab: 'stadt' },
  { id: 'gelehrt', de: { w: 'Gelehrte', m: 'Gelehrter', n: 'Gelehrte:r' }, en: 'Scholar', ab: 'stadt' }
];

/** Ladeninhaber und Wirtsleute, je Namensklang. */
export const INHABER: Record<Ladenart | 'wirt', Rolle['de']> = {
  wirt: { w: 'Wirtin', m: 'Wirt', n: 'Wirt:in' },
  kraemer: { w: 'Krämerin', m: 'Krämer', n: 'Krämer:in' },
  schmied: { w: 'Schmiedin', m: 'Schmied', n: 'Schmied:in' },
  bogner: { w: 'Bognerin', m: 'Bogner', n: 'Bogner:in' },
  alchemist: { w: 'Alchemistin', m: 'Alchemist', n: 'Alchemist:in' },
  magie: { w: 'Magierin', m: 'Magier', n: 'Magier:in' }
};

export const INHABER_EN: Record<Ladenart | 'wirt', string> = {
  wirt: 'Innkeeper',
  kraemer: 'Shopkeeper',
  schmied: 'Blacksmith',
  bogner: 'Bowyer',
  alchemist: 'Alchemist',
  magie: 'Wizard'
};

/** Wie viele wichtige Personen außer Wirtsleuten und Läden. Annahme. */
export const PERSONEN_ANZAHL: Record<Groesse, number> = { dorf: 2, kleinstadt: 3, stadt: 4 };

// --- Lage ---------------------------------------------------------------------

/** Umgebungen aus @suite/umgebungen, in denen ein Ort stehen kann. */
export const LAGEN = ['ebene', 'wald', 'kueste', 'gebirge', 'sumpf', 'wueste', 'eiswueste', 'unterreich'] as const;
export type Lage = (typeof LAGEN)[number];

// --- Namen (eigene Tabelle) ---------------------------------------------------

/** Erste Hälfte, zusammengesetzt mit einer Endung: Raben + furt / Raven + ford. */
export const NAME_ANFANG: readonly Paar[] = [
  { de: 'Raben', en: 'Raven' },
  { de: 'Eichen', en: 'Oak' },
  { de: 'Stein', en: 'Stone' },
  { de: 'Wolfs', en: 'Wolf' },
  { de: 'Birken', en: 'Birch' },
  { de: 'Hirsch', en: 'Hart' },
  { de: 'Falken', en: 'Hawk' },
  { de: 'Kupfer', en: 'Copper' },
  { de: 'Silber', en: 'Silver' },
  { de: 'Grün', en: 'Green' },
  { de: 'Schwarz', en: 'Black' },
  { de: 'Weiß', en: 'White' },
  { de: 'Rot', en: 'Red' },
  { de: 'Nebel', en: 'Mist' },
  { de: 'Dorn', en: 'Thorn' },
  { de: 'Eschen', en: 'Ash' },
  { de: 'Mühl', en: 'Mill' },
  { de: 'Salz', en: 'Salt' },
  { de: 'Bären', en: 'Bear' },
  { de: 'Erlen', en: 'Alder' },
  { de: 'Fuchs', en: 'Fox' },
  { de: 'Krähen', en: 'Crow' },
  { de: 'Eisen', en: 'Iron' },
  { de: 'Gold', en: 'Gold' },
  { de: 'Kalt', en: 'Cold' },
  { de: 'Mond', en: 'Moon' },
  { de: 'Sonnen', en: 'Sun' },
  { de: 'Linden', en: 'Linden' }
];

export interface Endung extends Paar {
  /** Nur in diesen Lagen (Hafen nur an der Küste); leer = überall. */
  readonly lagen?: readonly Lage[];
}

export const NAME_ENDE: readonly Endung[] = [
  { de: 'furt', en: 'ford' },
  { de: 'bach', en: 'brook' },
  { de: 'berg', en: 'hill' },
  { de: 'tal', en: 'dale' },
  { de: 'heim', en: 'ham' },
  { de: 'dorf', en: 'thorpe' },
  { de: 'hausen', en: 'stead' },
  { de: 'brück', en: 'bridge' },
  { de: 'wald', en: 'wood', lagen: ['wald', 'ebene', 'gebirge'] },
  { de: 'see', en: 'mere' },
  { de: 'feld', en: 'field', lagen: ['ebene', 'wald'] },
  { de: 'quell', en: 'well' },
  { de: 'burg', en: 'bury' },
  { de: 'wacht', en: 'watch' },
  { de: 'hafen', en: 'haven', lagen: ['kueste'] },
  { de: 'münde', en: 'mouth', lagen: ['kueste'] },
  { de: 'kamm', en: 'ridge', lagen: ['gebirge', 'eiswueste'] },
  { de: 'moor', en: 'moor', lagen: ['sumpf', 'ebene'] },
  { de: 'sand', en: 'sands', lagen: ['wueste', 'kueste'] },
  { de: 'grund', en: 'deep', lagen: ['unterreich'] }
];

// --- Herrschaft, Wirtschaft, Besonderheit, Problem (eigene Tabellen) ---------

export const HERRSCHAFT: readonly Paar[] = [
  { de: 'Ein Ältestenrat entscheidet, langsam und nach alter Sitte.', en: 'A council of elders decides, slowly and by old custom.' },
  { de: 'Ein gewähltes Stadtoberhaupt, das um die nächste Wahl fürchtet.', en: 'An elected mayor who fears the next election.' },
  { de: 'Ein Fürstenhaus, dessen Erbe noch ein Kind ist.', en: 'A noble house whose heir is still a child.' },
  { de: 'Ein Bund der Gilden; wer zahlt, bestimmt.', en: 'A league of guilds; whoever pays decides.' },
  { de: 'Ein Tempelorden, der jedes Gesetz mit einer Predigt begründet.', en: 'A temple order that justifies every law with a sermon.' },
  { de: 'Eine Söldnerkompanie, die den Ort „beschützt“.', en: 'A mercenary company that “protects” the place.' },
  { de: 'Ein Kaufmannsrat, der sich nie einig ist.', en: 'A merchant council that never agrees.' },
  { de: 'Ein Vogt im Namen eines fernen Königreichs.', en: 'A reeve in the name of a distant kingdom.' },
  { de: 'Eine Magierakademie, die sich für Politik zu fein ist und trotzdem regiert.', en: 'A wizard academy too fine for politics that rules anyway.' },
  { de: 'Ein Druidenzirkel, der nur bei Vollmond Recht spricht.', en: 'A druid circle that holds court only at full moon.' },
  { de: 'Offiziell das Oberhaupt, in Wahrheit die Diebesgilde dahinter.', en: 'Officially the mayor, in truth the thieves’ guild behind them.' },
  { de: 'Niemand so recht; wer laut genug ist, setzt sich durch.', en: 'No one really; whoever is loud enough gets their way.' },
  { de: 'Ein Drache, dem der Ort jedes Jahr Tribut zahlt.', en: 'A dragon to whom the place pays tribute every year.' },
  { de: 'Eine alte Adelsfamilie, verarmt, aber stolz.', en: 'An old noble family, impoverished but proud.' }
];

export interface Wirtschaft extends Paar {
  readonly lagen?: readonly Lage[];
}

export const WIRTSCHAFT: readonly Wirtschaft[] = [
  { de: 'Fischfang und geräucherter Fisch', en: 'Fishing and smoked fish', lagen: ['kueste'] },
  { de: 'Schiffbau', en: 'Shipbuilding', lagen: ['kueste'] },
  { de: 'Salzsieden', en: 'Salt boiling', lagen: ['kueste', 'wueste'] },
  { de: 'Eisenerz aus den Stollen', en: 'Iron ore from the mines', lagen: ['gebirge'] },
  { de: 'Silberbergbau', en: 'Silver mining', lagen: ['gebirge', 'unterreich'] },
  { de: 'Holz und Holzkohle', en: 'Timber and charcoal', lagen: ['wald'] },
  { de: 'Pelze und Leder', en: 'Furs and leather', lagen: ['wald', 'eiswueste'] },
  { de: 'Torf', en: 'Peat', lagen: ['sumpf'] },
  { de: 'Heilkräuter', en: 'Healing herbs', lagen: ['sumpf', 'wald'] },
  { de: 'Getreide und Mühlen', en: 'Grain and mills', lagen: ['ebene'] },
  { de: 'Pferdezucht', en: 'Horse breeding', lagen: ['ebene'] },
  { de: 'Wein', en: 'Wine', lagen: ['ebene'] },
  { de: 'Schafwolle', en: 'Wool', lagen: ['ebene', 'gebirge'] },
  { de: 'Glasbläserei', en: 'Glassblowing', lagen: ['wueste'] },
  { de: 'Karawanenhandel', en: 'Caravan trade', lagen: ['wueste'] },
  { de: 'Walfang und Tran', en: 'Whaling and oil', lagen: ['eiswueste', 'kueste'] },
  { de: 'Pilzzucht', en: 'Mushroom farming', lagen: ['unterreich'] },
  { de: 'Edelsteinschleiferei', en: 'Gem cutting', lagen: ['unterreich', 'gebirge'] },
  { de: 'Handel an der Wegkreuzung', en: 'Trade at the crossroads' },
  { de: 'Pilger, die zu einem Heiligtum reisen', en: 'Pilgrims travelling to a shrine' },
  { de: 'Söldner, die hier angeworben werden', en: 'Mercenaries hired here' },
  { de: 'Schmuggel, offiziell nichts', en: 'Smuggling, officially nothing' }
];

export const BESONDERHEIT: readonly Paar[] = [
  { de: 'Eine Brücke aus riesigen Knochen führt über den Fluss.', en: 'A bridge of giant bones spans the river.' },
  { de: 'Der Markt findet nur bei Neumond statt.', en: 'The market is held only at the new moon.' },
  { de: 'Alle Häuser stehen auf Pfählen, auch die, die es nicht müssten.', en: 'Every house stands on stilts, even those that need not.' },
  { de: 'Mitten auf dem Platz wächst ein Baum, älter als der Ort.', en: 'In the square grows a tree older than the place.' },
  { de: 'Die Glocken läuten zu jeder vollen Stunde, aber niemand zieht an ihnen.', en: 'The bells ring every hour, but no one pulls them.' },
  { de: 'Eine Statue der Gründerin weint bei Regen rote Tränen.', en: 'A statue of the founder weeps red tears in the rain.' },
  { de: 'An Festtagen tragen alle Masken, und niemand darf sie abnehmen.', en: 'On feast days everyone wears masks, and no one may remove them.' },
  { de: 'Der Ort ist in den Brustkorb eines toten Riesen gebaut.', en: 'The place is built inside the ribcage of a dead giant.' },
  { de: 'Auf dem Marktplatz brennt eine Flamme, die nie erlischt.', en: 'A flame burns in the market square that never goes out.' },
  { de: 'Jede Gilde streicht ihre Straße in einer eigenen Farbe.', en: 'Each guild paints its street its own colour.' },
  { de: 'Es gibt keine Katzen, und niemand spricht darüber.', en: 'There are no cats, and no one talks about it.' },
  { de: 'Ein Turm steht schief und neigt sich jedes Jahr ein Stück mehr.', en: 'A tower leans and tilts a little further every year.' },
  { de: 'Die Toten werden in den Mauern beigesetzt.', en: 'The dead are buried within the walls.' },
  { de: 'Ein Gesetz verbietet, nach Sonnenuntergang zu pfeifen.', en: 'A law forbids whistling after sunset.' },
  { de: 'Durch den Ort fließt ein warmer Fluss, der nie gefriert.', en: 'A warm river flows through the place and never freezes.' },
  { de: 'Die Kinder kennen ein Lied, das kein Erwachsener gelehrt hat.', en: 'The children know a song no adult taught them.' },
  { de: 'Ein riesiges Uhrwerk treibt Mühlen, Tore und Brunnen an.', en: 'A huge clockwork drives mills, gates and wells.' },
  { de: 'Fremde müssen am Tor einen Stein abgeben und bekommen ihn beim Gehen zurück.', en: 'Strangers must leave a stone at the gate and get it back when they leave.' }
];

export const PROBLEM: readonly Paar[] = [
  { de: 'Die Brunnen trocknen aus, einer nach dem anderen.', en: 'The wells are drying up, one after another.' },
  { de: 'Wölfe kommen in diesem Winter bis an die Häuser.', en: 'This winter the wolves come right up to the houses.' },
  { de: 'Kinder verschwinden, immer in Nächten mit Nebel.', en: 'Children vanish, always on foggy nights.' },
  { de: 'Der Steuereintreiber verlangt das Doppelte und hat Bewaffnete dabei.', en: 'The tax collector demands double and brings armed men.' },
  { de: 'Räuber überfallen jeden Wagen auf der Straße zum Ort.', en: 'Bandits rob every cart on the road to town.' },
  { de: 'Ein Fluch lässt die Ernte auf dem Feld verfaulen.', en: 'A curse rots the harvest in the fields.' },
  { de: 'Zwei Familien liegen in Fehde; der Ort ist gespalten.', en: 'Two families are feuding; the place is split.' },
  { de: 'Ein Stollen ist eingestürzt, Leute sind noch drin.', en: 'A mine shaft collapsed with people still inside.' },
  { de: 'Eine Seuche geht um, und die Heilerin ist selbst krank.', en: 'A plague is spreading, and the healer is sick too.' },
  { de: 'Seltsame Lichter im Sumpf locken Leute hinaus.', en: 'Strange lights lure people out into the marsh.' },
  { de: 'Auf dem Friedhof stehen die Toten wieder auf.', en: 'The dead are rising in the graveyard.' },
  { de: 'Ein Kult wirbt im Gasthaus offen um Mitglieder.', en: 'A cult openly recruits in the inn.' },
  { de: 'Das Hochwasser steigt, und der Damm hält nicht mehr lange.', en: 'The flood is rising, and the dam will not hold much longer.' },
  { de: 'Das Oberhaupt ist krank, die Erben intrigieren.', en: 'The ruler is ill, and the heirs are scheming.' },
  { de: 'Schmuggler bestechen die Wache, und alle wissen es.', en: 'Smugglers bribe the guard, and everyone knows it.' },
  { de: 'Aus den Ruinen in der Nähe kommen nachts Ungeheuer.', en: 'Monsters come out of the nearby ruins at night.' },
  { de: 'Der Fluss ist flussaufwärts vergiftet worden.', en: 'The river has been poisoned upstream.' },
  { de: 'Ein Goldfund lockt Fremde, und die Preise explodieren.', en: 'A gold strike draws strangers, and prices explode.' },
  { de: 'Der Tribut an den Drachen ist fällig, und die Truhen sind leer.', en: 'The tribute to the dragon is due, and the coffers are empty.' },
  { de: 'Jemand vergiftet die Tiere auf den Weiden.', en: 'Someone is poisoning the animals in the pastures.' }
];

/** Gerüchte. Ob eines wahr ist, würfelt der Erzeuger; das sieht nur die SL. */
export const GERUECHTE: readonly Paar[] = [
  { de: 'Unter dem Tempel gibt es einen zweiten, älteren Tempel.', en: 'Beneath the temple lies a second, older temple.' },
  { de: 'Das Oberhaupt ist schon seit Monaten tot; jemand trägt sein Gesicht.', en: 'The mayor has been dead for months; someone wears their face.' },
  { de: 'Im alten Brunnen liegt ein Schatz, bewacht von etwas mit Zähnen.', en: 'There is treasure in the old well, guarded by something with teeth.' },
  { de: 'Die Wirtsleute verdünnen das Bier mit Flusswasser.', en: 'The innkeeper waters the ale with river water.' },
  { de: 'Ein Fremder hat letzte Woche mit Gold aus einem untergegangenen Reich bezahlt.', en: 'A stranger paid with gold from a fallen empire last week.' },
  { de: 'Die Schmiedin war früher Abenteurerin und hat einen Drachen erschlagen.', en: 'The blacksmith used to be an adventurer and slew a dragon.' },
  { de: 'Wer nachts am Wegkreuz einen Wunsch flüstert, bekommt eine Antwort.', en: 'Whoever whispers a wish at the crossroads at night gets an answer.' },
  { de: 'Die Wache sucht heimlich nach einem entflohenen Gefangenen.', en: 'The guard is secretly searching for an escaped prisoner.' },
  { de: 'Im Wald lebt eine Hexe, die Kranke heilt, wenn man ihr ein Geheimnis gibt.', en: 'A witch in the woods heals the sick in exchange for a secret.' },
  { de: 'Die Kaufleute planen, den Ort an einen Fürsten zu verkaufen.', en: 'The merchants plan to sell the place to a lord.' },
  { de: 'Der Friedhof ist voller leerer Gräber.', en: 'The graveyard is full of empty graves.' },
  { de: 'Ein Bote mit einer versiegelten Nachricht ist nie angekommen.', en: 'A courier with a sealed message never arrived.' },
  { de: 'Die Glocke im Turm wurde aus einem gestohlenen Götzenbild gegossen.', en: 'The tower bell was cast from a stolen idol.' },
  { de: 'In den Ruinen hat jemand neue Fackeln gesehen.', en: 'Someone has seen fresh torches in the ruins.' },
  { de: 'Ein Kind des Ortes kann mit Tieren sprechen.', en: 'A child of the village can speak with animals.' },
  { de: 'Die Diebesgilde sucht neue Leute, gut bezahlt.', en: 'The thieves’ guild is hiring, and pays well.' },
  { de: 'Im Gasthaus spukt es in Zimmer sieben.', en: 'Room seven at the inn is haunted.' },
  { de: 'Ein Magier sucht Freiwillige für ein Experiment.', en: 'A wizard is looking for volunteers for an experiment.' },
  { de: 'Die Ernte ist verflucht, weil jemand einen Grenzstein versetzt hat.', en: 'The harvest is cursed because someone moved a boundary stone.' },
  { de: 'Ein Schiff liegt seit Tagen im Hafen, ohne dass jemand an Bord geht.', en: 'A ship has lain in harbour for days and no one goes aboard.' },
  { de: 'Die Bürgermeisterin trifft sich nachts mit Fremden am Fluss.', en: 'The mayor meets strangers by the river at night.' },
  { de: 'Unter dem Marktplatz verlaufen alte Schmugglergänge.', en: 'Old smugglers’ tunnels run under the market square.' }
];

/** Wie oft ein Gerücht stimmt. */
export const GERUECHT_WAHR = 0.6;

export const GERUECHTE_ANZAHL: Record<Groesse, readonly [number, number]> = {
  dorf: [2, 3],
  kleinstadt: [3, 4],
  stadt: [4, 6]
};

// --- Gasthaus (eigene Tabellen) ---------------------------------------------

/** Adjektiv im Dativ nach bestimmtem Artikel („Zum Goldenen …"). */
export const GASTHAUS_ADJEKTIV: readonly Paar[] = [
  { de: 'Goldenen', en: 'Golden' },
  { de: 'Tanzenden', en: 'Dancing' },
  { de: 'Schlafenden', en: 'Sleeping' },
  { de: 'Grünen', en: 'Green' },
  { de: 'Lachenden', en: 'Laughing' },
  { de: 'Rostigen', en: 'Rusty' },
  { de: 'Silbernen', en: 'Silver' },
  { de: 'Einäugigen', en: 'One-Eyed' },
  { de: 'Betrunkenen', en: 'Drunken' },
  { de: 'Singenden', en: 'Singing' },
  { de: 'Blauen', en: 'Blue' },
  { de: 'Hinkenden', en: 'Limping' },
  { de: 'Alten', en: 'Old' },
  { de: 'Roten', en: 'Red' },
  { de: 'Müden', en: 'Weary' }
];

/** Hauptwort im Dativ mit Geschlecht (für „Zum"/„Zur"). */
export const GASTHAUS_NOMEN: readonly { readonly de: string; readonly en: string; readonly g: 'm' | 'f' | 'n' }[] = [
  { de: 'Hirsch', en: 'Stag', g: 'm' },
  { de: 'Bären', en: 'Bear', g: 'm' },
  { de: 'Drachen', en: 'Dragon', g: 'm' },
  { de: 'Krug', en: 'Tankard', g: 'm' },
  { de: 'Kessel', en: 'Kettle', g: 'm' },
  { de: 'Eber', en: 'Boar', g: 'm' },
  { de: 'Ritter', en: 'Knight', g: 'm' },
  { de: 'Anker', en: 'Anchor', g: 'm' },
  { de: 'Gans', en: 'Goose', g: 'f' },
  { de: 'Laterne', en: 'Lantern', g: 'f' },
  { de: 'Harfe', en: 'Harp', g: 'f' },
  { de: 'Krone', en: 'Crown', g: 'f' },
  { de: 'Eule', en: 'Owl', g: 'f' },
  { de: 'Horn', en: 'Horn', g: 'n' },
  { de: 'Fass', en: 'Barrel', g: 'n' },
  { de: 'Schwert', en: 'Sword', g: 'n' },
  { de: 'Einhorn', en: 'Unicorn', g: 'n' }
];

export const SPEZIALITAET: readonly Paar[] = [
  { de: 'Linseneintopf mit Speck', en: 'Lentil stew with bacon' },
  { de: 'Gebratener Aal', en: 'Fried eel' },
  { de: 'Honigbier', en: 'Honey ale' },
  { de: 'Pilzpastete', en: 'Mushroom pie' },
  { de: 'Wildschweinbraten', en: 'Roast boar' },
  { de: 'Scharfer Bohneneintopf', en: 'Spicy bean stew' },
  { de: 'Ziegenkäse mit Feigen', en: 'Goat cheese with figs' },
  { de: 'Fischsuppe, „heute frisch“', en: 'Fish soup, “fresh today”' },
  { de: 'Gewürzwein', en: 'Mulled wine' },
  { de: 'Schwarzbrot mit Schmalz', en: 'Rye bread with dripping' },
  { de: 'Kräuterschnaps nach Hausrezept', en: 'House herb liquor' },
  { de: 'Gefüllte Teigtaschen', en: 'Stuffed dumplings' },
  { de: 'Hammel mit Minze', en: 'Mutton with mint' },
  { de: 'Apfelkuchen, nur sonntags', en: 'Apple cake, Sundays only' }
];
