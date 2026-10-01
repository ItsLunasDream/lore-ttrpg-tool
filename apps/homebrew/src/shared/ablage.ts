/**
 * Ein Homebrew-Eintrag als Markdown-Datei: oben lesbar (Name, Werte,
 * Beschreibung), unten die Werte als JSON-Block, aus dem das Werkzeug liest.
 * Lesbar ohne das Werkzeug, in einem Texteditor oder im Story Creator.
 * Plattformfrei, damit die Tests ohne Electron laufen.
 */
import { bereinige, type Eintrag } from './modell';
import { kurzzeile } from './texte';

export const MARKE = '```homebrew';

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
  return sauber || 'eintrag';
}

export function freieKennung(wunsch: string, vergeben: Iterable<string>): string {
  const belegt = new Set(vergeben);
  if (!belegt.has(wunsch)) return wunsch;
  let n = 2;
  while (belegt.has(`${wunsch}-${n}`)) n += 1;
  return `${wunsch}-${n}`;
}

export function alsMarkdown(e: Eintrag): string {
  // Das Bild steht nur im JSON-Block: als Text waere es unlesbar lang.
  const teile = [`# ${e.name || '—'}`, '', `*${kurzzeile(e, 'de')}*`, ''];
  if (e.beschreibung.trim()) teile.push(e.beschreibung.trim(), '');
  if (e.art === 'magisch') {
    for (const w of e.wirkungen.filter((x) => x.trim())) teile.push(`- ${w.replace(/\n/g, ' ').trim()}`);
    if (e.fluch.trim()) teile.push('', `**Fluch:** ${e.fluch.trim()}`);
    teile.push('');
  }
  if (e.art === 'zauber' && e.hoehererGrad.trim()) teile.push(`**Höhere Grade:** ${e.hoehererGrad.trim()}`, '');
  teile.push(MARKE, JSON.stringify(e, null, 1), '```', '');
  return teile.join('\n');
}

export function leseEintrag(inhalt: string, id: string): Eintrag {
  const start = inhalt.lastIndexOf(MARKE);
  if (start >= 0) {
    const rumpf = inhalt.slice(start + MARKE.length);
    const ende = rumpf.indexOf('\n```');
    try {
      return bereinige(JSON.parse(ende >= 0 ? rumpf.slice(0, ende) : rumpf), id);
    } catch {
      // Kaputtes JSON: unten wie ohne Block.
    }
  }
  const name = /^#\s+(.+)$/m.exec(inhalt)?.[1]?.trim() ?? id;
  return bereinige({ name, art: 'gegenstand', beschreibung: inhalt.replace(/^#.*$/m, '').trim() }, id);
}

/** Was die Kachel und die Suche brauchen. */
export interface Kachel {
  readonly id: string;
  readonly name: string;
  readonly art: Eintrag['art'];
  readonly kurz: { readonly de: string; readonly en: string };
  readonly bild: string | null;
  readonly geaendert: string;
}

export function alsKachel(e: Eintrag): Kachel {
  return { id: e.id, name: e.name, art: e.art, kurz: { de: kurzzeile(e, 'de'), en: kurzzeile(e, 'en') }, bild: e.bild, geaendert: e.geaendert };
}
