/**
 * Was die KI zum Magic Item Generator beitraegt.
 *
 * Wie beim Monster Creator: die KI schreibt, was Tabellen schlecht koennen —
 * eine Wirkung mit Eigenart, einen Namen, der zu ihr passt, einen Fluch mit
 * Geschichte. Ihre Zahlen entscheiden aber nichts: sie gehen durch
 * `pruefeKi` (pruefung.ts), und was zu stark ist fuer die Seltenheit, wird
 * mit Ansage gezogen.
 *
 * Plattformfrei, damit die Tests ohne Electron laufen.
 */
import { SELTENHEIT_NAME, type Seltenheit } from '@suite/srd';
import type { Gegenstand, Sprache } from './erzeuge';
import { ART_NAME, STUFE, type Art } from './tabellen';
import { grenzen } from './pruefung';

export const KI_AUFGABEN = ['gegenstand', 'wirkung', 'fluch', 'name'] as const;
export type KiAufgabe = (typeof KI_AUFGABEN)[number];

/** Eine Antwort ist kein Roman. */
export const MAX_ZEICHEN = 600;

export interface Frage {
  readonly aufgabe: KiAufgabe;
  readonly art: Art;
  readonly seltenheit: Seltenheit;
  /** Der bisherige Stand — fuer einzelne Felder. */
  readonly gegenstand?: Gegenstand | null;
  /** Welche Wirkung ersetzt wird (bei `wirkung`); fehlt, kommt eine dazu. */
  readonly stelle?: number;
  /** Was sich der Mensch wuenscht, in eigenen Worten. */
  readonly wunsch?: string;
}

export const FELDER: Record<KiAufgabe, readonly string[]> = {
  gegenstand: ['name', 'wirkungen', 'fluch', 'einstimmung'],
  wirkung: ['text'],
  fluch: ['text'],
  name: ['name']
};

export function systemAnweisung(sprache: Sprache): string {
  return sprache === 'de'
    ? [
        'Du hilfst beim Bau magischer Gegenstände für ein Pen-&-Paper-Rollenspiel (Regeln der fünften Edition, 2024).',
        'Du antwortest ausschließlich mit JSON, ohne Text davor oder danach.',
        `Jeder einzelne Text bleibt unter ${MAX_ZEICHEN} Zeichen und ist am Tisch vorlesbar.`,
        'Erfinde eigene Gegenstände. Kopiere keine bekannten Gegenstände und benenne keine um.',
        'Zahlen darfst du vorschlagen; sie werden an der Seltenheit geprüft und gegebenenfalls berichtigt.',
        'Keine Regelzitate, keine Seitenangaben, keine geschützten Eigennamen.'
      ].join('\n')
    : [
        'You help build magic items for a tabletop roleplaying game (fifth edition rules, 2024).',
        'You answer with JSON only, no text before or after.',
        `Every single text stays under ${MAX_ZEICHEN} characters and is readable at the table.`,
        'Invent your own items. Do not copy known items and do not rename them.',
        'You may suggest numbers; they are checked against the rarity and corrected if needed.',
        'No rules quotations, no page references, no protected names.'
      ].join('\n');
}

export function anweisung(frage: Frage, sprache: Sprache): string {
  const de = sprache === 'de';
  const g = grenzen(frage.art, frage.seltenheit);
  const teile: string[] = [];

  // Der eigene Wunsch zuerst: Modelle gewichten den Anfang staerker.
  if (frage.wunsch && frage.wunsch.trim()) {
    teile.push(
      de ? `Gewünscht ist: ${frage.wunsch.trim().slice(0, MAX_ZEICHEN)}` : `Wanted: ${frage.wunsch.trim().slice(0, MAX_ZEICHEN)}`,
      ''
    );
  }
  teile.push(
    de ? `Art: ${ART_NAME[frage.art].de}` : `Type: ${ART_NAME[frage.art].en}`,
    de ? `Seltenheit: ${SELTENHEIT_NAME[frage.seltenheit].de}` : `Rarity: ${SELTENHEIT_NAME[frage.seltenheit].en}`,
    '',
    de ? 'Grenzen für diese Seltenheit:' : 'Limits for this rarity:',
    de ? `- Bonus höchstens +${g.bonus}` : `- Bonus at most +${g.bonus}`,
    de ? `- Zusatzschaden höchstens ${g.schaden.replace('d', 'W')}` : `- Extra damage at most ${g.schaden}`,
    de ? `- Rettungswurf-SG höchstens ${g.sg}` : `- Save DC at most ${g.sg}`,
    de ? `- Zaubergrad höchstens ${g.grad}` : `- Spell level at most ${g.grad}`,
    de ? `- Höchstens ${g.wirkungen} Wirkungen` : `- At most ${g.wirkungen} properties`
  );

  if (frage.gegenstand) {
    const x = frage.gegenstand;
    teile.push(
      '',
      de ? 'Das steht schon:' : 'What is already there:',
      `- ${x.name}`,
      ...x.wirkungen.filter((w) => w.trim()).map((w, i) => `- ${i === frage.stelle ? (de ? '(wird ersetzt) ' : '(to be replaced) ') : ''}${w}`),
      ...(x.fluch.trim() ? [`- ${x.fluch}`] : [])
    );
  }

  const auftrag: Record<KiAufgabe, [string, string]> = {
    gegenstand: [
      `Erfinde einen ganzen Gegenstand: Name, 1 bis ${g.wirkungen} Wirkungen als je ein Satz (Liste "wirkungen"), "fluch" als Satz oder leer, "einstimmung" als true oder false.`,
      `Invent a whole item: a name, 1 to ${g.wirkungen} properties as one sentence each (list "wirkungen"), "fluch" as a sentence or empty, "einstimmung" as true or false.`
    ],
    wirkung: [
      'Erfinde genau eine neue Wirkung, die zum Gegenstand passt und keine vorhandene wiederholt. Ein Satz mit Zahlen, wo es Zahlen braucht.',
      'Invent exactly one new property that fits the item and repeats none of the existing ones. One sentence, with numbers where numbers are needed.'
    ],
    fluch: [
      'Erfinde einen Fluch für diesen Gegenstand. Er beginnt mit „Fluch:" und hat eine spürbare Folge am Tisch.',
      'Invent a curse for this item. It starts with "Curse:" and has a consequence the table will feel.'
    ],
    name: [
      'Erfinde einen Namen, der zu den Wirkungen passt. Kein bekannter Gegenstand.',
      'Invent a name that fits the properties. Not a known item.'
    ]
  };
  teile.push('', de ? auftrag[frage.aufgabe][0] : auftrag[frage.aufgabe][1]);
  teile.push(
    '',
    de ? 'Antworte als JSON mit genau diesen Schlüsseln:' : 'Answer as JSON with exactly these keys:',
    FELDER[frage.aufgabe].join(', ')
  );
  return teile.join('\n');
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim().slice(0, MAX_ZEICHEN) : '';
}

export interface RohGegenstand {
  readonly name: string;
  readonly wirkungen: readonly string[];
  readonly fluch: string;
  readonly einstimmung: boolean;
}

/**
 * Was aus der Antwort uebernommen werden kann, oder `null`. Was fehlt,
 * bleibt leer; was nicht passt, faellt weg.
 */
export function uebernehmbar(aufgabe: KiAufgabe, roh: unknown): RohGegenstand | string | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  if (aufgabe === 'gegenstand') {
    const wirkungen = Array.isArray(r.wirkungen) ? r.wirkungen.map(text).filter(Boolean).slice(0, 5) : [];
    if (!wirkungen.length) return null;
    return { name: text(r.name), wirkungen, fluch: text(r.fluch), einstimmung: r.einstimmung === true };
  }
  const wert = text(aufgabe === 'name' ? r.name : r.text);
  return wert || null;
}

/** Fuer die Tests: die Stufe, an der die Grenzen haengen. */
export function stufeVon(seltenheit: Seltenheit): number {
  return STUFE[seltenheit];
}
