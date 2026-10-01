/**
 * Ein Gegenstand als Markdown-Datei.
 *
 *   ---
 *   name: Klinge des Morgenrots
 *   art: waffe
 *   seltenheit: rare
 *   einstimmung: ja
 *   wert: 4000
 *   gewicht: 3          (wenn bekannt)
 *   bild: data:image/…  (wenn eines gewählt ist)
 *   ---
 *   ## Wirkungen
 *
 *   - Du erhältst +2 auf Angriffs- und Schadenswürfe …
 *
 *   ## Fluch
 *
 *   …
 *
 *   ## Notiz
 *
 *   …
 *
 * Lesbar ohne das Werkzeug — in einem Texteditor oder im Story Creator.
 * Plattformfrei, damit die Tests ohne Electron laufen.
 *
 * Gemeinsame Ablage von Magic Item Generator und Homebrew Creator: beide
 * schreiben magische Gegenstände hierher (Rückmeldung: keine doppelte
 * Sammlung).
 */
import { SELTENHEITEN, type Seltenheit } from '@suite/srd';
import { ARTEN, type Art } from './tabellen';
import type { Gegenstand } from './erzeuge';

/** Größte erlaubte Bilddaten (wie im Homebrew Creator und Charakterbogen). */
export const BILD_HOECHSTENS = 600_000;

export function istBild(x: string): boolean {
  return x.length <= BILD_HOECHSTENS && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x);
}

export function zuId(name: string): string {
  const sauber = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Dateinamen haben Grenzen (ENAMETOOLONG bei sehr langen Namen).
    .slice(0, 80)
    .replace(/-+$/, '');
  return sauber || 'gegenstand';
}

export function freieKennung(wunsch: string, vergeben: Iterable<string>): string {
  const belegt = new Set(vergeben);
  if (!belegt.has(wunsch)) return wunsch;
  let n = 2;
  while (belegt.has(`${wunsch}-${n}`)) n += 1;
  return `${wunsch}-${n}`;
}

function kopfwert(wert: string): string {
  return /[:#"'\n]|^\s|\s$/.test(wert) ? JSON.stringify(wert.replace(/\n/g, ' ')) : wert;
}

export function alsMarkdown(g: Gegenstand): string {
  const teile = [
    '---',
    `name: ${kopfwert(g.name)}`,
    `art: ${g.art}`,
    `seltenheit: ${g.seltenheit}`,
    `einstimmung: ${g.einstimmung ? 'ja' : 'nein'}`,
    `wert: ${g.wert}`,
    ...(typeof g.gewicht === 'number' ? [`gewicht: ${g.gewicht}`] : []),
    ...(g.bild && istBild(g.bild) ? [`bild: ${g.bild}`] : []),
    ...(g.imLoot ? ['loot: ja'] : []),
    `geaendert: ${g.geaendert}`,
    '---',
    '## Wirkungen',
    '',
    ...g.wirkungen.filter((w) => w.trim()).map((w) => `- ${w.replace(/\n/g, ' ').trim()}`),
    ''
  ];
  if (g.fluch.trim()) teile.push('## Fluch', '', g.fluch.trim(), '');
  if (g.notiz.trim()) teile.push('## Notiz', '', g.notiz.trim(), '');
  return teile.join('\n');
}

function abschnitt(leib: string, titel: string): string {
  const m = new RegExp(`^## ${titel}\\s*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm').exec(leib);
  return m ? m[1].trim() : '';
}

export function leseGegenstand(inhalt: string, ersatzId: string): Gegenstand {
  const treffer = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(inhalt);
  const kopf: Record<string, string> = {};
  if (treffer) {
    for (const zeile of treffer[1].split(/\r?\n/)) {
      const stelle = zeile.indexOf(':');
      if (stelle <= 0) continue;
      let wert = zeile.slice(stelle + 1).trim();
      if (wert.startsWith('"')) {
        try {
          wert = JSON.parse(wert) as string;
        } catch {
          wert = wert.replace(/^"|"$/g, '');
        }
      }
      kopf[zeile.slice(0, stelle).trim()] = wert;
    }
  }
  const leib = (treffer ? treffer[2] : inhalt).replace(/\r\n/g, '\n');
  const art = (ARTEN as readonly string[]).includes(kopf.art) ? (kopf.art as Art) : 'wundersam';
  const seltenheit = (SELTENHEITEN as readonly string[]).includes(kopf.seltenheit)
    ? (kopf.seltenheit as Seltenheit)
    : 'common';
  const wert = Number(kopf.wert);
  return {
    id: ersatzId,
    name: kopf.name || ersatzId,
    art,
    seltenheit,
    einstimmung: kopf.einstimmung === 'ja',
    wirkungen: abschnitt(leib, 'Wirkungen')
      .split('\n')
      .map((z) => z.replace(/^-\s*/, '').trim())
      .filter(Boolean),
    fluch: abschnitt(leib, 'Fluch'),
    wert: Number.isFinite(wert) ? wert : 0,
    notiz: abschnitt(leib, 'Notiz'),
    geaendert: kopf.geaendert ?? '',
    imLoot: kopf.loot === 'ja',
    // Nur wenn vorhanden: ältere Dateien bleiben beim Lesen genau, wie sie waren.
    ...(istBild(kopf.bild ?? '') ? { bild: kopf.bild } : {}),
    ...(kopf.gewicht !== undefined && kopf.gewicht !== '' && Number.isFinite(Number(kopf.gewicht)) ? { gewicht: Math.max(0, Number(kopf.gewicht)) } : {})
  };
}

/** Was die Kachel und die Suche brauchen. */
export interface Eintrag {
  readonly id: string;
  readonly name: string;
  readonly art: Art;
  readonly seltenheit: Seltenheit;
  readonly einstimmung: boolean;
  readonly verflucht: boolean;
  /** Der Anfang der ersten Wirkung, fuer die Kachel und die Suche. */
  readonly kurz: string;
  readonly geaendert: string;
}

export function alsEintrag(g: Gegenstand): Eintrag {
  return {
    id: g.id,
    name: g.name,
    art: g.art,
    seltenheit: g.seltenheit,
    einstimmung: g.einstimmung,
    verflucht: Boolean(g.fluch.trim()),
    kurz: g.wirkungen.join(' ').slice(0, 200),
    geaendert: g.geaendert
  };
}
