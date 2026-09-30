/**
 * Was ein Werkzeug abgelegt hat, in einer Form, die alle verstehen.
 *
 * Die gemeinsame Schnittstelle, die das Konzept der Austausch-App als den
 * groesseren Brocken benannt hat (`docs/austausch.md`). Heute gibt es nur
 * Einzelbruecken zwischen je zwei Werkzeugen — Monster → Story Creator, NPC
 * → Story Creator, Inspiration → Karteneditor. Ein viertes und fuenftes Paar
 * zu verdrahten waere die Art Wachstum, bei der am Ende niemand mehr weiss,
 * wer mit wem redet.
 *
 * Zwei Saetze reichen:
 *
 *     „Gib mir deine Eintraege."
 *     „Zeig mir diesen Eintrag."
 *
 * Wer beide beantwortet, macht mit. Wer nicht, taucht nicht auf. Dieselbe
 * Form wie bei `@suite/einstellungen` — ein optionaler Haken je Werkzeug,
 * und die Huelle muss ueber ein neues Werkzeug nichts wissen.
 *
 * Der erste Nutzer ist die werkzeuguebergreifende Suche (Strg+K). Der
 * zweite waere der Austausch am Tisch.
 *
 * Plattformfrei: nur Daten und reine Funktionen. Wer die Eintraege von der
 * Platte holt, tut das im Hauptprozess.
 */

/** Ein Ding, das ein Werkzeug abgelegt hat. */
export interface Eintrag {
  /** Welches Werkzeug es hat. Dorthin springt die Suche. */
  readonly werkzeug: string;
  /**
   * Eindeutig INNERHALB des Werkzeugs.
   *
   * Nicht global: jedes Werkzeug vergibt seine Kennungen selbst, und sie
   * nachtraeglich eindeutig zu machen hiesse, in jede Ablage einzugreifen.
   * Wer einen Eintrag meint, nennt beides — Werkzeug und Kennung.
   */
  readonly kennung: string;
  readonly name: string;
  /**
   * Was es ist, in der Sprache des Werkzeugs: „Notiz", „Monster",
   * „Begegnung". Steht auf der Trefferzeile, damit man zwei gleichnamige
   * Dinge auseinanderhalten kann.
   */
  readonly art: string;
  /**
   * Weiteres, worin gesucht werden soll — Teilnehmer einer Begegnung, das
   * Thema eines Monsters, der Anfang einer Notiz.
   *
   * Nicht der ganze Text: die Suche soll im Speicher laufen und schnell
   * sein. Wer eine Volltextsuche will, baut sie im Werkzeug.
   */
  readonly stichworte?: string;
  /**
   * Wann es zuletzt gespeichert wurde, als ISO-Zeit. Fuer „Zuletzt
   * hinzugefuegt" im Teilen; fehlt, wo es keinen Sinn hat (offizielle
   * Regeln).
   */
  readonly geaendert?: string;
}

/**
 * Das „Werkzeug" der Eintraege, die keine sind.
 *
 * Die Werkzeuge selbst stehen mit in der Trefferliste: wer „Inspiration"
 * tippt, meint meistens die Anwendung und nicht eine Notiz darin. Sie
 * kommen nicht von einem Leser, sondern von der Huelle — die kennt ihre
 * eigenen Anwendungen.
 *
 * Ein eigener Name statt eines Feldes `istApp`, damit die Buendelung sie
 * von selbst zusammen anzeigt und nichts eine Ausnahme kennen muss.
 */
export const WERKZEUG_APP = 'app';

/** Wo ein Eintrag steht: Werkzeug und Kennung zusammen. */
export function eintragsSchluessel(eintrag: Eintrag): string {
  return `${eintrag.werkzeug}/${eintrag.kennung}`;
}

/**
 * Kleinschreibung, Umlaute vereinheitlicht.
 *
 * Damit „Bär" auf „bar" passt — dieselbe Regel wie in den Suchen der
 * einzelnen Werkzeuge. Sie stand dort dreimal; hier steht sie einmal.
 */
export function schluessel(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');
}

/**
 * Weitere Worte fuer die Art eines Eintrags, je Werkzeug und in beiden
 * Sprachen.
 *
 * Wer „Armor Table“ oder „Rüstung Zufallstabelle“ tippt, meint die Tabelle
 * „Armor“ (Rueckmeldung): das Wort fuer die Art soll mitsuchen, egal in
 * welcher Sprache die Anzeige steht. Stehen hier, damit nicht jeder Leser
 * seine Synonyme selbst pflegt.
 */
export const ART_WORTE: Readonly<Record<string, string>> = {
  loot: 'table tables random table random tables loot tabelle tabellen zufallstabelle zufallstabellen beute',
  monster: 'monster monsters creature creatures kreatur kreaturen statblock',
  zustaende: 'condition conditions status effect effects zustand zustaende effekt effekte',
  initiative: 'encounter encounters combat fight begegnung begegnungen kampf initiative participant teilnehmer',
  encounter: 'encounter encounters begegnung begegnungen',
  backstory: 'note notes notiz notizen story',
  nachschlagewerk: 'rule rules regel regeln reference nachschlagewerk srd',
  magicitems: 'item items magic item magic items gegenstand gegenstaende magischer gegenstand',
  charakterbogen: 'character sheet sheet charakterbogen bogen figur character',
  app: 'app tool werkzeug anwendung'
};

/** Alles, worin gesucht wird. */
export function heuhaufen(eintrag: Eintrag): string {
  return schluessel([eintrag.name, eintrag.art, eintrag.stichworte ?? '', ART_WORTE[eintrag.werkzeug] ?? ''].join(' '));
}

/** Die Worte, die nur die Art beschreiben (Art selbst und ihre Synonyme). */
function artWorte(eintrag: Eintrag): Set<string> {
  return new Set(schluessel(`${eintrag.art} ${ART_WORTE[eintrag.werkzeug] ?? ''}`).split(/[\s·,()]+/).filter(Boolean));
}

/**
 * Ob ein Eintrag zur Suche passt.
 *
 * In Worten, nicht als eine Zeichenkette: „ghul wald" findet die Begegnung
 * „Waldlager", in der ein Ghul steht. Alle Worte muessen vorkommen, nicht
 * irgendeines — sonst wird die Liste mit jedem getippten Wort laenger statt
 * kuerzer.
 */
export function passt(eintrag: Eintrag, suche: string): boolean {
  const worte = schluessel(suche).split(/\s+/).filter(Boolean);
  if (worte.length === 0) return true;
  const stroh = heuhaufen(eintrag);
  return worte.every((wort) => stroh.includes(wort));
}

/**
 * Wie gut ein Eintrag passt. Groesser ist besser.
 *
 * Die Reihenfolge ist der halbe Wert einer Suche ueber alles: bei zwanzig
 * Treffern aus fuenf Werkzeugen entscheidet sie, ob man den gesuchten sofort
 * sieht oder scrollt.
 *
 * Gewichtet wird, WO der Treffer sass und WIE genau:
 * - der ganze Name ist der beste Treffer,
 * - der Anfang des Namens der zweitbeste,
 * - irgendwo im Namen der drittbeste,
 * - nur in den Stichworten der schwaechste.
 */
export function guete(eintrag: Eintrag, suche: string): number {
  const gesucht = schluessel(suche).trim();
  if (!gesucht) return 0;
  const name = schluessel(eintrag.name);

  /*
   * Eine Anwendung schlaegt bei gleichem Namen alles andere.
   *
   * Wer „Monster" tippt, will den Monster Creator aufmachen und nicht das
   * eine Monster, das zufaellig „Monster" heisst. Der Aufschlag ist klein
   * genug, dass ein genauer Treffer in einem Werkzeug eine ungenaue
   * Anwendung immer noch schlaegt.
   */
  const aufschlag = eintrag.werkzeug === WERKZEUG_APP ? 5 : 0;

  if (name === gesucht) return 100 + aufschlag;
  if (name.startsWith(gesucht)) return 75 + aufschlag;
  if (name.includes(gesucht)) return 50 + aufschlag;

  // Mehrere Worte, die zusammen nur ueber Name und Stichworte aufgehen.
  const worte = gesucht.split(/\s+/).filter(Boolean);
  const imNamen = worte.filter((wort) => name.includes(wort)).length;
  if (imNamen === worte.length) return 40;

  /*
   * Name plus Art: „armor table“ findet die Tabelle „Armor“. Was nicht im
   * Namen steht, muss die Art beschreiben; dann zaehlt der Rest wie eine
   * Suche nach dem Namen allein, knapp darunter.
   */
  const art = artWorte(eintrag);
  const rest = worte.filter((wort) => !name.includes(wort));
  const namensteil = worte.filter((wort) => name.includes(wort)).join(' ');
  if (namensteil && rest.every((wort) => [...art].some((a) => a.startsWith(wort)))) {
    if (name === namensteil) return 95 + aufschlag;
    if (name.startsWith(namensteil)) return 70 + aufschlag;
    return 45 + aufschlag;
  }
  return 10 + imNamen;
}

/**
 * Die Treffer, die besten zuerst.
 *
 * Bei gleicher Guete entscheidet der Name — damit die Liste sich beim
 * Tippen nicht umsortiert, ohne dass sich etwas geaendert haette.
 */
export function finde(
  eintraege: readonly Eintrag[],
  suche: string,
  hoechstens = 40
): readonly Eintrag[] {
  const getroffen = eintraege.filter((eintrag) => passt(eintrag, suche));
  const sortiert = [...getroffen].sort((a, b) => {
    const unterschied = guete(b, suche) - guete(a, suche);
    if (unterschied !== 0) return unterschied;
    return a.name.localeCompare(b.name, 'de');
  });
  return sortiert.slice(0, hoechstens);
}

/** Die Treffer nach Werkzeug gebuendelt, in der Reihenfolge der besten. */
export interface Buendel {
  readonly werkzeug: string;
  readonly eintraege: readonly Eintrag[];
}

export function buendle(eintraege: readonly Eintrag[]): readonly Buendel[] {
  const nachWerkzeug = new Map<string, Eintrag[]>();
  for (const eintrag of eintraege) {
    const liste = nachWerkzeug.get(eintrag.werkzeug);
    if (liste) liste.push(eintrag);
    else nachWerkzeug.set(eintrag.werkzeug, [eintrag]);
  }
  // `Map` haelt die Einfuegereihenfolge — und die ist die der Treffer. Das
  // Werkzeug mit dem besten Treffer steht damit oben.
  return [...nachWerkzeug].map(([werkzeug, liste]) => ({ werkzeug, eintraege: liste }));
}
