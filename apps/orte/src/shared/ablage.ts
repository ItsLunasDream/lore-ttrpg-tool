/**
 * Ablage und Export des Settlement Generators.
 *
 * Ablage wie im Homebrew Creator: eine Markdown-Datei je Ort, oben lesbar,
 * unten der Ort als JSON-Block, aus dem das Werkzeug liest. Jede Eingabe
 * (Datei oder Oberfläche) läuft durch `bereinige`.
 *
 * Export: eine Notiz für den Ort, je eine für Gasthaus, Läden und Personen,
 * mit [[Verweisen]] untereinander (Typen wie in der Inspirationshilfe).
 */
import type { Figur } from '../../../npc/src/shared/erzeuge';
import { alsMarkdown as figurAlsMarkdown } from '../../../npc/src/shared/erzeuge';
import { lageName, zauberdiensteFuer, type Gasthaus, type Geruecht, type Laden, type Ort, type Person, type Ware } from './erzeuge';
import {
  GASTHAUS_PREISE,
  GETRAENKE,
  GROESSEN,
  GROESSE_NAME,
  LADENARTEN,
  LAGEN,
  QUALITAETEN,
  QUALITAET_NAME,
  type Sprache
} from './tabellen';

export const MARKE = '```ort';

/** Ein gespeicherter Ort: der Ort plus Verwaltung. */
export interface Gespeichert extends Ort {
  readonly id: string;
  readonly sprache: Sprache;
  readonly notiz: string;
  readonly imLoot: boolean;
  readonly geaendert: string;
}

// --- Prüfen beim Einlesen -----------------------------------------------------

function t(x: unknown, max = 400): string {
  return typeof x === 'string' ? x.slice(0, max) : '';
}

function eins<T extends string>(x: unknown, liste: readonly T[], ersatz: T): T {
  return (liste as readonly string[]).includes(x as string) ? (x as T) : ersatz;
}

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function liste(x: unknown, max: number): unknown[] {
  return Array.isArray(x) ? x.slice(0, max) : [];
}

function figur(x: unknown): Figur {
  const r = obj(x);
  return {
    name: t(r.name, 120),
    spezies: t(r.spezies),
    beruf: t(r.beruf),
    aussehen: t(r.aussehen),
    motivation: t(r.motivation),
    geheimnis: t(r.geheimnis),
    eigenheit: t(r.eigenheit)
  };
}

function person(x: unknown): Person {
  const r = obj(x);
  return { rolle: t(r.rolle, 80), figur: figur(r.figur) };
}

function ware(x: unknown): Ware {
  const r = obj(x);
  const preis = typeof r.preis === 'number' && Number.isFinite(r.preis) && r.preis >= 0 ? Math.min(r.preis, 1e7) : null;
  const s = eins(r.seltenheit, ['common', 'uncommon', 'rare', 'veryRare', 'legendary'] as const, 'common');
  return { name: t(r.name, 160), preis, ...(r.seltenheit ? { seltenheit: s } : {}) };
}

export function bereinige(roh: unknown, id: string): Gespeichert {
  const r = obj(roh);
  const g = obj(r.gasthaus);
  return {
    id,
    sprache: r.sprache === 'en' ? 'en' : 'de',
    name: t(r.name, 120) || id,
    groesse: eins(r.groesse, GROESSEN, 'dorf'),
    einwohner: Math.max(0, Math.min(1_000_000, Math.round(Number(r.einwohner) || 0))),
    lage: eins(r.lage, LAGEN, 'ebene'),
    herrschaft: t(r.herrschaft),
    wirtschaft: t(r.wirtschaft),
    besonderheit: t(r.besonderheit),
    problem: t(r.problem),
    geruechte: liste(r.geruechte, 12).map((x): Geruecht => ({ text: t(obj(x).text), wahr: obj(x).wahr === true })),
    gasthaus: {
      name: t(g.name, 120),
      qualitaet: eins(g.qualitaet, QUALITAETEN, 'einfach'),
      spezialitaet: t(g.spezialitaet, 200),
      wirt: person(g.wirt)
    },
    laeden: liste(r.laeden, 12).map((x): Laden => {
      const l = obj(x);
      return {
        art: eins(l.art, LADENARTEN, 'kraemer'),
        name: t(l.name, 120),
        inhaber: person(l.inhaber),
        waren: liste(l.waren, 40).map(ware)
      };
    }),
    personen: liste(r.personen, 12).map(person),
    notiz: t(r.notiz, 20_000),
    imLoot: r.imLoot === true,
    geaendert: t(r.geaendert, 40)
  };
}

// --- Datei --------------------------------------------------------------------

export function zuId(name: string): string {
  const sauber = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return sauber || 'ort';
}

export function freieKennung(wunsch: string, vergeben: Iterable<string>): string {
  const belegt = new Set(vergeben);
  if (!belegt.has(wunsch)) return wunsch;
  let n = 2;
  while (belegt.has(`${wunsch}-${n}`)) n += 1;
  return `${wunsch}-${n}`;
}

export function alsDatei(o: Gespeichert): string {
  return [`# ${o.name}`, '', `*${kurzzeile(o, o.sprache)}*`, '', MARKE, JSON.stringify(o, null, 1), '```', ''].join('\n');
}

export function leseDatei(inhalt: string, id: string): Gespeichert {
  const start = inhalt.lastIndexOf(MARKE);
  if (start >= 0) {
    const rumpf = inhalt.slice(start + MARKE.length);
    const ende = rumpf.indexOf('\n```');
    try {
      return bereinige(JSON.parse(ende >= 0 ? rumpf.slice(0, ende) : rumpf), id);
    } catch {
      // Kaputtes JSON: wie ohne Block.
    }
  }
  return bereinige({ name: /^#\s+(.+)$/m.exec(inhalt)?.[1]?.trim() ?? id }, id);
}

// --- Texte --------------------------------------------------------------------

export function preisText(gm: number | null, s: Sprache): string {
  if (gm === null) return '—';
  const de = s === 'de';
  // Kleine Beträge in Silber und Kupfer, wie im SRD gedruckt.
  if (gm < 0.1) return `${Math.round(gm * 100)} ${de ? 'KM' : 'CP'}`;
  if (gm < 1) return `${Math.round(gm * 10)} ${de ? 'SM' : 'SP'}`;
  return `${gm.toLocaleString(de ? 'de-DE' : 'en-US')} ${de ? 'GM' : 'GP'}`;
}

export function kurzzeile(o: Ort, s: Sprache): string {
  const zahl = o.einwohner.toLocaleString(s === 'de' ? 'de-DE' : 'en-US');
  return `${GROESSE_NAME[o.groesse][s]} · ${lageName(o.lage, s)} · ${zahl} ${s === 'de' ? 'Einwohner' : 'inhabitants'}`;
}

export interface Kachel {
  readonly id: string;
  readonly name: string;
  readonly kurz: string;
  readonly groesse: Ort['groesse'];
  readonly geaendert: string;
  readonly imLoot: boolean;
}

export function alsKachel(o: Gespeichert): Kachel {
  return { id: o.id, name: o.name, kurz: kurzzeile(o, o.sprache), groesse: o.groesse, geaendert: o.geaendert, imLoot: o.imLoot };
}

// --- Export in den Story Creator ----------------------------------------------

export interface Notiz {
  readonly typ: 'note' | 'character' | 'location';
  readonly titel: string;
  readonly markdown: string;
}

/** Zeichen, die in Notiztiteln Verweise brechen. */
function titel(x: string): string {
  return x.replace(/[[\]|#^]/g, '').trim();
}

function personText(p: Person, ort: string, s: Sprache): string {
  return `**${s === 'de' ? 'Rolle' : 'Role'}:** ${p.rolle} ([[${titel(ort)}]])\n\n${figurAlsMarkdown(p.figur, s)}`;
}

function warenTabelle(waren: readonly Ware[], s: Sprache): string {
  const kopf = s === 'de' ? '| Ware | Preis |\n|---|---|' : '| Item | Price |\n|---|---|';
  return [kopf, ...waren.map((w) => `| ${w.name.replace(/\|/g, '/')} | ${preisText(w.preis, s)} |`)].join('\n');
}

function gasthausText(g: Gasthaus, ort: string, s: Sprache): string {
  const de = s === 'de';
  const p = GASTHAUS_PREISE[g.qualitaet];
  const zeilen = [
    `**${de ? 'Ort' : 'Location'}:** [[${titel(ort)}]]`,
    `**${de ? 'Wirtsleute' : 'Innkeeper'}:** [[${titel(g.wirt.figur.name)}]]`,
    `**${de ? 'Qualität' : 'Quality'}:** ${QUALITAET_NAME[g.qualitaet][s]}`,
    `**${de ? 'Spezialität' : 'Speciality'}:** ${g.spezialitaet}`,
    '',
    `| ${de ? 'Angebot' : 'Offer'} | ${de ? 'Preis' : 'Price'} |\n|---|---|`,
    `| ${de ? 'Übernachtung' : 'Night’s stay'} | ${preisText(p.nacht, s)} |`,
    `| ${de ? 'Mahlzeit' : 'Meal'} | ${preisText(p.mahlzeit, s)} |`,
    ...GETRAENKE.map((x) => `| ${x.name[s]} | ${preisText(x.preis, s)} |`),
    '',
    `*${de ? 'Preise: SRD 5.2.1, „Essen, Trinken und Unterkunft".' : 'Prices: SRD 5.2.1, “Food, Drink, and Lodging”.'}*`
  ];
  return zeilen.join('\n');
}

function ladenText(l: Laden, ort: string, s: Sprache): string {
  const de = s === 'de';
  return [
    `**${de ? 'Ort' : 'Location'}:** [[${titel(ort)}]]`,
    '',
    `**${de ? 'Inhaber:in' : 'Owner'}:** [[${titel(l.inhaber.figur.name)}]]`,
    '',
    warenTabelle(l.waren, s),
    '',
    `*${de ? 'Preise aus dem SRD 5.2.1.' : 'Prices from the SRD 5.2.1.'}*`
  ].join('\n');
}

export function ortText(o: Ort, s: Sprache, notiz = ''): string {
  const de = s === 'de';
  const z = (k: string, v: string) => `**${k}:** ${v}`;
  const teile = [
    `*${kurzzeile(o, s)}*`,
    '',
    z(de ? 'Herrschaft' : 'Rule', o.herrschaft),
    '',
    z(de ? 'Wirtschaft' : 'Economy', o.wirtschaft),
    '',
    z(de ? 'Besonderheit' : 'Notable', o.besonderheit),
    '',
    z(de ? 'Problem' : 'Trouble', o.problem),
    '',
    `## ${de ? 'Gasthaus' : 'Inn'}`,
    '',
    `[[${titel(o.gasthaus.name)}]]`,
    '',
    `## ${de ? 'Läden' : 'Shops'}`,
    '',
    ...o.laeden.map((l) => `- [[${titel(l.name)}]]`),
    '',
    `## ${de ? 'Personen' : 'People'}`,
    '',
    ...o.personen.map((p) => `- [[${titel(p.figur.name)}]], ${p.rolle}`),
    '',
    `## ${de ? 'Zauberwirken' : 'Spellcasting'}`,
    '',
    ...zauberdiensteFuer(o.groesse).map(
      (d) => `- ${d.grade === '0' ? (de ? 'Zaubertrick' : 'Cantrip') : `${de ? 'Grad' : 'Level'} ${d.grade}`}: ${preisText(d.kosten, s)}`
    ),
    '',
    `*${de ? 'SRD 5.2.1, „Zauberwirken-Dienstleistungen"; teure Komponenten kommen dazu.' : 'SRD 5.2.1, “Spellcasting Services”; expensive components are extra.'}*`,
    '',
    `## ${de ? 'Gerüchte (nur SL)' : 'Rumours (GM only)'}`,
    '',
    ...o.geruechte.map((g: Geruecht) => `- ${g.text} *(${g.wahr ? (de ? 'wahr' : 'true') : de ? 'falsch' : 'false'})*`)
  ];
  if (notiz.trim()) teile.push('', `## ${de ? 'Notizen' : 'Notes'}`, '', notiz.trim());
  return teile.join('\n');
}

/**
 * Alle Notizen eines Orts für den Story Creator. Zwei Personen mit gleichem
 * Namen bekommen ihre Rolle in den Titel, sonst würde die zweite als
 * „schon vorhanden" übersprungen und der Verweis zeigte auf die erste.
 */
export function alsNotizen(o: Ort, s: Sprache, notiz = ''): Notiz[] {
  const alle: Person[] = [o.gasthaus.wirt, ...o.laeden.map((l) => l.inhaber), ...o.personen];
  const zaehler = new Map<string, number>();
  for (const p of alle) zaehler.set(p.figur.name, (zaehler.get(p.figur.name) ?? 0) + 1);
  const eindeutig = (p: Person): Person =>
    (zaehler.get(p.figur.name) ?? 0) > 1 ? { ...p, figur: { ...p.figur, name: `${p.figur.name} (${p.rolle})` } } : p;
  const ort: Ort = {
    ...o,
    gasthaus: { ...o.gasthaus, wirt: eindeutig(o.gasthaus.wirt) },
    laeden: o.laeden.map((l) => ({ ...l, inhaber: eindeutig(l.inhaber) })),
    personen: o.personen.map(eindeutig)
  };
  const personen: Person[] = [ort.gasthaus.wirt, ...ort.laeden.map((l) => l.inhaber), ...ort.personen];
  return [
    { typ: 'location', titel: titel(ort.name), markdown: ortText(ort, s, notiz) },
    { typ: 'location', titel: titel(ort.gasthaus.name), markdown: gasthausText(ort.gasthaus, ort.name, s) },
    ...ort.laeden.map((l): Notiz => ({ typ: 'location', titel: titel(l.name), markdown: ladenText(l, ort.name, s) })),
    ...personen.map((p): Notiz => ({ typ: 'character', titel: titel(p.figur.name), markdown: personText(p, ort.name, s) }))
  ];
}

/** Die Läden als Loot-Tabellen: „Schmiede Mara (Rabenfurt)" mit Waren und Preis. */
export function alsLootTabellen(o: Gespeichert): { name: string; eintraege: string[] }[] {
  const s = o.sprache;
  return o.laeden
    .filter((l) => l.waren.length)
    .map((l) => ({ name: `${l.name} (${o.name})`, eintraege: l.waren.map((w) => `${w.name} (${preisText(w.preis, s)})`) }));
}
