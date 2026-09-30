/**
 * Ein Bogen als Markdown-Datei.
 *
 * Drei Teile, von oben nach unten:
 *
 * 1. YAML-Kopf mit den Kernwerten (Name, Stufe, RK, TP …). Den lesen andere
 *    Werkzeuge, ohne den Rest zu zerlegen, etwa spaeter der Initiative
 *    Tracker. Er wird bei jedem Speichern aus den Daten neu geschrieben.
 * 2. Der Bogen zum Lesen, in jedem Texteditor.
 * 3. Ein JSON-Block mit dem ganzen Bogen. Nur er ist die Quelle fuer dieses
 *    Werkzeug; Kopf und Lesefassung sind Ableitungen. Wer die Datei von Hand
 *    aendert, aendert deshalb den JSON-Block.
 *
 * Plattformfrei: nur Text bauen und lesen.
 */
import { bereinige, gesamtstufe, initiativeBonus, type Bogen } from './bogen';
import {
  ATTRIBUTE,
  ATTRIBUT_NAMEN,
  FERTIGKEITEN,
  fertigkeitsBonus,
  modifikator,
  mitVorzeichen,
  uebungsbonus,
  type Sprache
} from './regeln';

const MARKE = '```json bogen';

export interface Kachel {
  readonly id: string;
  readonly name: string;
  readonly art: Bogen['art'];
  /** „Waldläuferin 5 · Elf" oder leer. */
  readonly kurz: string;
  readonly tp: string;
  readonly geaendert: string;
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
    .slice(0, 60);
  return sauber || 'bogen';
}

/** Eine freie Kennung: der Wunsch, sonst mit Zahl dahinter. Nichts wird still ueberschrieben. */
export function freieKennung(wunsch: string, vergeben: Iterable<string>): string {
  const belegt = new Set(vergeben);
  if (!belegt.has(wunsch)) return wunsch;
  for (let n = 2; ; n += 1) {
    if (!belegt.has(`${wunsch}-${n}`)) return `${wunsch}-${n}`;
  }
}

function yaml(wert: string | number): string {
  if (typeof wert === 'number') return String(wert);
  return /^[A-Za-z0-9äöüÄÖÜß ._-]*$/.test(wert) && wert.trim() === wert && wert !== '' ? wert : JSON.stringify(wert);
}

export function klassenText(b: Bogen): string {
  return (b.werte?.klassen ?? [])
    .filter((k) => k.name.trim())
    .map((k) => `${k.name.trim()} ${k.stufe}`)
    .join(' / ');
}

export function alsKachel(b: Bogen): Kachel {
  const w = b.werte;
  return {
    id: b.id,
    name: b.name,
    art: b.art,
    kurz: [klassenText(b), w?.spezies.trim() ?? ''].filter(Boolean).join(' · '),
    tp: w ? `${w.tp.aktuell}/${w.tp.max}${w.tp.temp ? ` (+${w.tp.temp})` : ''}` : '',
    geaendert: b.geaendert
  };
}

/** Die Datei. `sprache` betrifft nur die Lesefassung; die Daten sind sprachlos. */
export function alsMarkdown(b: Bogen, sprache: Sprache): string {
  const i = sprache === 'de' ? 0 : 1;
  const kopf: string[] = ['---', `name: ${yaml(b.name)}`, `art: ${b.art}`, `schema: ${b.schema}`];
  const teile: string[] = [];
  const w = b.werte;
  if (w) {
    const pb = uebungsbonus(gesamtstufe(w));
    kopf.push(
      `klassen: ${yaml(klassenText(b))}`,
      `stufe: ${gesamtstufe(w)}`,
      `rk: ${w.rk}`,
      `tp_max: ${w.tp.max}`,
      `tp: ${w.tp.aktuell}`,
      `initiative: ${initiativeBonus(w)}`
    );
    const L = (de: string, en: string) => (i === 0 ? de : en);
    teile.push(`# ${b.name}`, '');
    const zeile = [klassenText(b), w.spezies, w.hintergrund].filter((x) => x.trim()).join(' · ');
    if (zeile) teile.push(zeile, '');
    teile.push(
      `**${L('RK', 'AC')}** ${w.rk} · **${L('TP', 'HP')}** ${w.tp.aktuell}/${w.tp.max}${w.tp.temp ? ` (+${w.tp.temp})` : ''} · **${L('Initiative', 'Initiative')}** ${mitVorzeichen(initiativeBonus(w))}${w.bewegung.trim() ? ` · **${L('Bewegung', 'Speed')}** ${w.bewegung.trim()}` : ''} · **${L('Übungsbonus', 'Proficiency')}** ${mitVorzeichen(pb)}`,
      ''
    );
    teile.push(`| ${ATTRIBUTE.map((a) => ATTRIBUT_NAMEN[a].kurz[i]).join(' | ')} |`, `|${ATTRIBUTE.map(() => '---').join('|')}|`);
    teile.push(`| ${ATTRIBUTE.map((a) => `${w.attribute[a]} (${mitVorzeichen(modifikator(w.attribute[a]))})`).join(' | ')} |`, '');
    const geuebt = FERTIGKEITEN.filter((f) => w.fertigkeiten[f.id]);
    if (geuebt.length) {
      teile.push(
        `**${L('Fertigkeiten', 'Skills')}:** ` +
          geuebt.map((f) => `${f.name[i]} ${mitVorzeichen(fertigkeitsBonus(w.attribute[f.attribut], w.fertigkeiten[f.id], pb))}`).join(', '),
        ''
      );
    }
    if (w.angriffe.length) {
      teile.push(`## ${L('Angriffe', 'Attacks')}`, '');
      for (const a of w.angriffe) teile.push(`- **${a.name}** ${a.bonus} · ${a.schaden}${a.notiz ? ` · ${a.notiz}` : ''}`);
      teile.push('');
    }
  } else {
    teile.push(`# ${b.name}`, '');
  }
  if (b.notizen.trim()) teile.push(`## ${i === 0 ? 'Notizen' : 'Notes'}`, '', b.notizen.trim(), '');
  kopf.push(`geaendert: ${yaml(b.geaendert)}`, '---', '');
  return [...kopf, ...teile, MARKE, JSON.stringify(b, null, 2), '```', ''].join('\n');
}

/** Liest eine Datei. Ohne JSON-Block (etwa von Hand angelegt) wird es ein leerer Bogen mit dem Namen aus dem Kopf. */
export function leseBogen(inhalt: string, id: string): Bogen {
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
  const name = /^name:\s*(.+)$/m.exec(inhalt)?.[1]?.trim().replace(/^"(.*)"$/, '$1') ?? id;
  return bereinige({ name }, id);
}
