/**
 * Was die KI zum Settlement Generator beiträgt (Rückmeldung: „Ask AI" wieder
 * einbauen).
 *
 * Die KI schreibt nur Texte: Name, Herrschaft, Wirtschaft, Besonderheit,
 * Problem, Gerüchte, Name und Spezialität des Gasthauses. Läden, Waren,
 * Preise und Personen bleiben bei den Tabellen und dem SRD; da hätte eine
 * erfundene Zahl nichts zu suchen.
 *
 * Plattformfrei, damit die Tests ohne Electron laufen.
 */
import type { Geruecht, Ort } from './erzeuge';
import type { Sprache } from './tabellen';
import { GROESSE_NAME } from './tabellen';

export const KI_FELDER = ['name', 'herrschaft', 'wirtschaft', 'besonderheit', 'problem', 'geruechte', 'gasthaus'] as const;
export type KiFeld = (typeof KI_FELDER)[number];

/** Ein Text bleibt am Tisch vorlesbar. */
export const MAX_ZEICHEN = 400;

export function systemAnweisung(sprache: Sprache): string {
  return sprache === 'de'
    ? [
        'Du hilfst beim Ausgestalten von Siedlungen für ein Pen-&-Paper-Rollenspiel (Fantasy, fünfte Edition).',
        'Du antwortest ausschließlich mit JSON, ohne Text davor oder danach.',
        `Jeder Text bleibt unter ${MAX_ZEICHEN} Zeichen, konkret und am Tisch vorlesbar.`,
        'Erfinde Eigenes. Keine geschützten Eigennamen, keine Orte aus bekannten Welten.'
      ].join('\n')
    : [
        'You help flesh out settlements for a tabletop roleplaying game (fantasy, fifth edition).',
        'You answer with JSON only, no text before or after.',
        `Every text stays under ${MAX_ZEICHEN} characters, concrete and readable at the table.`,
        'Invent your own. No protected names, no places from known settings.'
      ].join('\n');
}

const BESCHREIBUNG: Record<KiFeld, { de: string; en: string }> = {
  name: { de: '"name": Name der Siedlung', en: '"name": name of the settlement' },
  herrschaft: { de: '"herrschaft": wer herrscht und wie (ein Satz)', en: '"herrschaft": who rules and how (one sentence)' },
  wirtschaft: { de: '"wirtschaft": wovon der Ort lebt (ein Satz)', en: '"wirtschaft": what the place lives on (one sentence)' },
  besonderheit: { de: '"besonderheit": was den Ort besonders macht (ein Satz)', en: '"besonderheit": what makes the place special (one sentence)' },
  problem: { de: '"problem": ein aktuelles Problem, in das Abenteurer geraten können', en: '"problem": a current problem adventurers can get drawn into' },
  geruechte: {
    de: '"geruechte": Liste von 3 Gerüchten, je {"text": "...", "wahr": true|false}',
    en: '"geruechte": list of 3 rumours, each {"text": "...", "wahr": true|false}'
  },
  gasthaus: {
    de: '"gasthaus": {"name": "...", "spezialitaet": "Speise oder Getränk des Hauses"}',
    en: '"gasthaus": {"name": "...", "spezialitaet": "the house dish or drink"}'
  }
};

/** Die Anfrage für die gewünschten Felder; der übrige Ort gibt den Zusammenhang. */
export function anweisung(ort: Ort, felder: readonly KiFeld[], wunsch: string, sprache: Sprache, lage: string): string {
  const de = sprache === 'de';
  const teile: string[] = [];
  if (wunsch.trim()) teile.push(de ? `Gewünscht ist: ${wunsch.trim().slice(0, MAX_ZEICHEN)}` : `Wanted: ${wunsch.trim().slice(0, MAX_ZEICHEN)}`, '');
  teile.push(
    de ? 'Die Siedlung bisher:' : 'The settlement so far:',
    `- ${de ? 'Größe' : 'Size'}: ${GROESSE_NAME[ort.groesse][sprache]}, ${ort.einwohner} ${de ? 'Einwohner' : 'inhabitants'}`,
    `- ${de ? 'Lage' : 'Location'}: ${lage}`
  );
  for (const f of ['name', 'herrschaft', 'wirtschaft', 'besonderheit', 'problem'] as const) {
    if (!felder.includes(f) && ort[f].trim()) teile.push(`- ${f}: ${ort[f].trim().slice(0, MAX_ZEICHEN)}`);
  }
  if (!felder.includes('gasthaus')) teile.push(`- ${de ? 'Gasthaus' : 'Inn'}: ${ort.gasthaus.name}`);
  teile.push('', de ? 'Schreibe neu (JSON-Objekt mit genau diesen Schlüsseln):' : 'Write anew (JSON object with exactly these keys):');
  for (const f of felder) teile.push(`- ${BESCHREIBUNG[f][sprache]}`);
  return teile.join('\n');
}

function text(x: unknown): string | null {
  return typeof x === 'string' && x.trim() ? x.replace(/\s+/g, ' ').trim().slice(0, MAX_ZEICHEN) : null;
}

/**
 * Was sich aus der Antwort übernehmen lässt, nur für die gefragten Felder.
 * Leer (`{}`), wenn nichts Brauchbares kam.
 */
export function uebernehme(ort: Ort, felder: readonly KiFeld[], gelesen: unknown): Partial<Ort> {
  if (!gelesen || typeof gelesen !== 'object' || Array.isArray(gelesen)) return {};
  const r = gelesen as Record<string, unknown>;
  const heraus: { -readonly [K in keyof Ort]?: Ort[K] } = {};
  for (const f of ['name', 'herrschaft', 'wirtschaft', 'besonderheit', 'problem'] as const) {
    if (!felder.includes(f)) continue;
    const t = text(r[f]);
    if (t) heraus[f] = f === 'name' ? t.slice(0, 80) : t;
  }
  if (felder.includes('geruechte') && Array.isArray(r.geruechte)) {
    const g: Geruecht[] = [];
    for (const x of r.geruechte.slice(0, 6)) {
      const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
      const t = text(typeof x === 'string' ? x : o.text);
      if (t) g.push({ text: t, wahr: o.wahr !== false });
    }
    if (g.length) heraus.geruechte = g;
  }
  if (felder.includes('gasthaus') && r.gasthaus && typeof r.gasthaus === 'object') {
    const o = r.gasthaus as Record<string, unknown>;
    const name = text(o.name);
    const spezialitaet = text(o.spezialitaet);
    if (name || spezialitaet) {
      heraus.gasthaus = { ...ort.gasthaus, ...(name ? { name: name.slice(0, 80) } : {}), ...(spezialitaet ? { spezialitaet } : {}) };
    }
  }
  return heraus;
}
