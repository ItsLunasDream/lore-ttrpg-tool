/**
 * Der Austausch aus Sicht der Huelle (docs/austausch.md, Stufe 1).
 *
 * Die Huelle vermittelt nur. Was eine Sendung ist und wie ein Paket
 * aussieht, steht in `@suite/austausch`; was ein Eintrag enthaelt und wie er
 * abgelegt wird, weiss das jeweilige Werkzeug (`austausch` in seiner
 * embed.ts). Hier steht, WER mitmacht, und der Weg dazwischen.
 *
 * Stufe 1 ohne Netz: weitergegeben wird als Datei, eingelesen aus einer
 * Datei. Genau derselbe Weg wird spaeter der Raum im lokalen Netz gehen —
 * nur dass das Paket dann nicht auf der Platte liegt, sondern ankommt.
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  alsPaket,
  freieKennung,
  setzeKopfwert,
  lesePaket,
  MAX_PAKET_BYTES,
  PaketFehler,
  VORGABE_MODUS,
  type Empfang,
  type Modus,
  type Paket,
  type Sendung,
  type Teilnehmer,
  type Ziel
} from '@suite/austausch';
import type { Eintrag } from '@suite/eintraege';
import { austausch as monster } from '../../../monster/src/main/embed';
import { austausch as notizen } from '../../../backstory/src/main/embed';
import { austausch as regeln } from '../../../nachschlagewerk/src/main/embed';
import { alleEintraege } from './suche';
import { regelNach } from '../../../nachschlagewerk/src/shared/bestand';
import { kopfzeilen, uebersetzeUeberschriften } from './vorschaukopf';

/** Eine Kennung, die gefahrlos zum Dateinamen werden darf. */
function sichereKennung(kennung: string): string | null {
  return /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,199}$/u.test(kennung) && !kennung.includes('..') ? kennung : null;
}

/** Der Name aus dem Kopf (`name: …`, auch in Anfuehrungszeichen), sonst die Kennung. */
function kopfname(inhalt: string, ersatz: string): string {
  const kopf = /^---\r?\n([\s\S]*?)\r?\n---/.exec(inhalt)?.[1] ?? '';
  const roh = /^name:\s*(.*)$/m.exec(kopf)?.[1]?.trim() ?? '';
  if (!roh) return ersatz;
  if (roh.startsWith('"')) {
    try {
      return String(JSON.parse(roh)) || ersatz;
    } catch {
      return ersatz;
    }
  }
  return roh.replace(/^'(.*)'$/, '$1') || ersatz;
}

/**
 * Ein Werkzeug, dessen Eintraege je eine Markdown-Datei in einem Ordner
 * sind: Zustaende, Begegnungen (Initiative und Encounter), magische
 * Gegenstaende, Zufallstabellen. Gleich gebaut wie der Monster Creator,
 * nur ohne dass jedes Werkzeug es noch einmal schreiben muss.
 *
 * Bilder reisen hier nicht mit (Bilder der Initiative bleiben daheim).
 */
function ordnerTeilnehmer(werkzeug: string, art: string, ordnerIn: (datenordner: string) => string): Teilnehmer {
  const vorhandene = async (ordner: string) => {
    try {
      return (await readdir(ordner)).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3));
    } catch {
      return [];
    }
  };
  return {
    werkzeug,
    async gib(datenordner, kennung) {
      const id = sichereKennung(kennung);
      if (!id) return null;
      try {
        const inhalt = await readFile(path.join(ordnerIn(datenordner), `${id}.md`), 'utf8');
        return { werkzeug, kennung: id, name: kopfname(inhalt, id), art, inhalt, bilder: [] };
      } catch {
        return null;
      }
    },
    async gibtEs(datenordner, sendung) {
      const id = sichereKennung(sendung.kennung);
      return id !== null && (await vorhandene(ordnerIn(datenordner))).includes(id);
    },
    async nimmAn(datenordner, sendung, modus) {
      if (modus === 'verwerfen') return { ok: true };
      if (sendung.inhalt === null) return { ok: false, grund: 'kein Inhalt' };
      const wunsch = sichereKennung(sendung.kennung);
      if (!wunsch) return { ok: false, grund: 'ungueltige Kennung' };
      const ordner = ordnerIn(datenordner);
      await mkdir(ordner, { recursive: true });
      const id = modus === 'daneben' ? freieKennung(wunsch, await vorhandene(ordner)) : wunsch;
      await writeFile(path.join(ordner, `${id}.md`), setzeKopfwert(sendung.inhalt, 'id', id), 'utf8');
      return { ok: true, kennung: id };
    }
  };
}

/**
 * Wer mitmacht. Ein Werkzeug ohne Eintrag hier taucht im Austausch nicht
 * auf; die Huelle muss ueber es nichts wissen.
 *
 * Die Ordner sind dieselben, die die Leser der Suche (suche.ts) lesen.
 */
/** Wo die Werkzeuge ihre Dateien ablegen, je eine Markdown-Datei pro Eintrag. */
const ORDNER: Readonly<Record<string, (datenordner: string) => string>> = {
  monster: (d) => path.join(d, 'monster', 'monster'),
  zustaende: (d) => path.join(d, 'zustaende', 'zustaende'),
  initiative: (d) => path.join(d, 'initiative', 'begegnungen'),
  encounter: (d) => path.join(d, 'encounter', 'encounter'),
  magicitems: (d) => path.join(d, 'magicitems', 'gegenstaende'),
  homebrew: (d) => path.join(d, 'homebrew', 'eintraege'),
  orte: (d) => path.join(d, 'orte', 'orte'),
  loot: (d) => path.join(d, 'loot', 'tabellen'),
  charakterbogen: (d) => path.join(d, 'charakterbogen', 'boegen')
};

const TEILNEHMER: ReadonlyMap<string, Teilnehmer> = new Map(
  [
    monster,
    notizen,
    regeln,
    ordnerTeilnehmer('zustaende', 'Zustand', ORDNER.zustaende),
    ordnerTeilnehmer('initiative', 'Begegnung', ORDNER.initiative),
    ordnerTeilnehmer('encounter', 'Begegnung', ORDNER.encounter),
    ordnerTeilnehmer('magicitems', 'Magischer Gegenstand', ORDNER.magicitems),
    ordnerTeilnehmer('homebrew', 'Homebrew', ORDNER.homebrew),
    ordnerTeilnehmer('orte', 'Ort', ORDNER.orte),
    ordnerTeilnehmer('loot', 'Zufallstabelle', ORDNER.loot),
    ordnerTeilnehmer('charakterbogen', 'Charakterbogen', ORDNER.charakterbogen)
  ].map((t) => [t.werkzeug, t])
);

export function machtMit(werkzeug: string): boolean {
  return TEILNEHMER.has(werkzeug);
}

/**
 * Was sich weitergeben laesst: die Eintraege der Suche aus den Werkzeugen,
 * die mitmachen. Ohne die Notizen am Regeltext — die sind fuer einen selbst
 * (docs/austausch.md).
 */
export async function teilbar(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<readonly Eintrag[]> {
  const eintraege = (await alleEintraege(datenordner, sprache)).filter(
    (e) => machtMit(e.werkzeug) && !(e.werkzeug === 'nachschlagewerk' && e.kennung.startsWith('notiz/'))
  );
  // „Zuletzt hinzugefuegt" braucht ein Datum. Wer keines mitbringt und als
  // Datei im eigenen Ordner liegt, bekommt das der Datei.
  return Promise.all(
    eintraege.map(async (e) => {
      if (e.geaendert) return e;
      // Hausregeln liegen als Datei im Nachschlagewerk; die offiziellen
      // Regeln haben kein Datum und bleiben ohne.
      const hausregel = e.werkzeug === 'nachschlagewerk' && e.kennung.startsWith('hausregel/');
      const ordner = hausregel ? (d: string) => path.join(d, 'nachschlagewerk', 'hausregeln') : ORDNER[e.werkzeug];
      const id = sichereKennung(hausregel ? e.kennung.slice('hausregel/'.length) : e.kennung);
      if (!ordner || !id) return e;
      try {
        return { ...e, geaendert: (await stat(path.join(ordner(datenordner), `${id}.md`))).mtime.toISOString() };
      } catch {
        return e;
      }
    })
  );
}


/**
 * Ein kurzer Blick in einen Eintrag, fuer die Vorschau beim Darueberfahren
 * im Teilen. Klartext, hoechstens einige hundert Zeichen.
 */
export async function vorschau(
  datenordner: string,
  werkzeug: string,
  kennung: string,
  sprache: 'de' | 'en'
): Promise<string> {
  if (werkzeug === 'nachschlagewerk' && !kennung.startsWith('hausregel/')) {
    return lesbar(regelNach(kennung)?.text[sprache] ?? '', 700);
  }
  const inhalt = (await TEILNEHMER.get(werkzeug)?.gib(datenordner, kennung))?.inhalt ?? '';
  return lesbar(kopfLesbar(werkzeug, inhalt, sprache), 700);
}

/**
 * Der Text einer empfangenen Sendung, bevor sie angenommen ist: fuer die
 * Vorschau (kurz) und das Fenster (lang). Eine Regel reist als Verweis und
 * kommt aus dem eigenen Nachschlagewerk.
 */
export function sendungsText(sendung: Paket['sendungen'][number], sprache: 'de' | 'en', max: number): string {
  if (sendung.inhalt === null) {
    return lesbar(sendung.werkzeug === 'nachschlagewerk' ? (regelNach(sendung.kennung)?.text[sprache] ?? '') : '', max);
  }
  return lesbar(kopfLesbar(sendung.werkzeug, sendung.inhalt, sprache), max);
}

/**
 * Der Kopf eines Eintrags als lesbare Zeilen in der eingestellten Sprache
 * (vorschaukopf.ts), darunter der Rumpf.
 */
function kopfLesbar(werkzeug: string, inhalt: string, sprache: 'de' | 'en'): string {
  const kopf = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(inhalt);
  const werte: Record<string, string> = {};
  for (const z of (kopf?.[1] ?? '').split(/\r?\n/)) {
    const t = /^(\w+):\s*(.*?)\s*$/.exec(z);
    if (t) werte[t[1]] = t[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  const rumpf = kopf ? inhalt.slice(kopf[0].length) : inhalt;
  const zeilen = kopfzeilen(werkzeug, werte, sprache).filter(Boolean);
  return [...zeilen, ...(zeilen.length ? [''] : []), uebersetzeUeberschriften(werkzeug, rumpf, sprache)].join('\n');
}

/** Ohne Bilder, Verweisklammern und Auszeichnung; gekuerzt auf `max` Zeichen. */
function lesbar(text: string, max: number): string {
  const klar = text
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
    .replace(/[*_`#>]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return klar.length > max ? `${klar.slice(0, max).trimEnd()} …` : klar;
}

/** Schnuert die gewaehlten Eintraege. Was es nicht mehr gibt, faellt heraus. */
export async function schnuere(
  datenordner: string,
  auswahl: readonly { werkzeug: string; kennung: string }[]
): Promise<Paket> {
  const sendungen: Sendung[] = [];
  for (const { werkzeug, kennung } of auswahl) {
    const sendung = await TEILNEHMER.get(werkzeug)?.gib(datenordner, kennung);
    if (sendung) sendungen.push(sendung);
  }
  return { version: 1, erstellt: new Date().toISOString(), sendungen };
}

export async function schreibePaket(datei: string, paket: Paket): Promise<void> {
  await writeFile(datei, alsPaket(paket), 'utf8');
}

/** Liest ein Paket von der Platte. Wirft `PaketFehler` mit einem lesbaren Grund. */
export async function lesePaketDatei(datei: string): Promise<Paket> {
  const groesse = (await stat(datei)).size;
  if (groesse > MAX_PAKET_BYTES) throw new PaketFehler('Die Datei ist zu gross fuer ein Paket', 'The file is too large for a package');
  return lesePaket(await readFile(datei, 'utf8'));
}

/** Eine empfangene Sendung, wie die Oberflaeche sie zum Entscheiden braucht. */
export interface Ankunft {
  readonly nummer: number;
  readonly werkzeug: string;
  readonly name: string;
  readonly art: string;
  readonly bilder: number;
  /** Eine offizielle Regel: sie wird nur genannt, nichts wird geschrieben. */
  readonly verweis: boolean;
  /** Ob ein Werkzeug hier sie annehmen kann. */
  readonly annehmbar: boolean;
}

export function ankuenfte(paket: Paket, sprache: 'de' | 'en' = 'de'): Ankunft[] {
  return paket.sendungen.map((s, nummer) => ({
    nummer,
    werkzeug: s.werkzeug,
    // Eine offizielle Regel reist als Verweis; ihren Namen kennt jede
    // Sammlung in beiden Sprachen.
    name: (s.inhalt === null && s.werkzeug === 'nachschlagewerk' ? regelNach(s.kennung)?.name[sprache] : undefined) ?? s.name,
    art: s.art,
    bilder: s.bilder.length,
    verweis: s.inhalt === null,
    annehmbar: machtMit(s.werkzeug)
  }));
}

/** Die Orte, an die etwas gehen kann, je Werkzeug (nur, wo es mehrere gibt). */
export async function zieleFuer(datenordner: string, werkzeuge: readonly string[]): Promise<Record<string, readonly Ziel[]>> {
  const heraus: Record<string, readonly Ziel[]> = {};
  for (const werkzeug of new Set(werkzeuge)) {
    const t = TEILNEHMER.get(werkzeug);
    if (t?.ziele) heraus[werkzeug] = await t.ziele(datenordner);
  }
  return heraus;
}

/** Welche Sendungen es im jeweiligen Ziel schon gibt. */
export async function konflikte(
  datenordner: string,
  paket: Paket,
  ziele: Readonly<Record<string, string>>
): Promise<boolean[]> {
  return Promise.all(
    paket.sendungen.map(async (s) => {
      const t = TEILNEHMER.get(s.werkzeug);
      return t ? t.gibtEs(datenordner, s, ziele[s.werkzeug]) : false;
    })
  );
}

/** Nimmt die Sendungen an, jede nach ihrer Entscheidung. */
export async function nimmAn(
  datenordner: string,
  paket: Paket,
  entscheidungen: readonly { nummer: number; modus?: Modus }[],
  ziele: Readonly<Record<string, string>>
): Promise<(Empfang & { werkzeug: string; name: string })[]> {
  const heraus: (Empfang & { werkzeug: string; name: string })[] = [];
  for (const { nummer, modus } of entscheidungen) {
    const s = paket.sendungen[nummer];
    if (!s) continue;
    const t = TEILNEHMER.get(s.werkzeug);
    if (!t) {
      heraus.push({ ok: false, grund: 'kein Werkzeug dafür', werkzeug: s.werkzeug, name: s.name });
      continue;
    }
    try {
      const empfang = await t.nimmAn(datenordner, s, modus ?? VORGABE_MODUS, ziele[s.werkzeug]);
      heraus.push({ ...empfang, werkzeug: s.werkzeug, name: s.name });
    } catch (fehler) {
      heraus.push({
        ok: false,
        grund: fehler instanceof Error ? fehler.message : String(fehler),
        werkzeug: s.werkzeug,
        name: s.name
      });
    }
  }
  return heraus;
}
