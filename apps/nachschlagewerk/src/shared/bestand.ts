/**
 * Was das Nachschlagewerk kennt.
 *
 * Der offizielle Bestand ist das ganze Regelglossar aus `@suite/srd` (155
 * Eintraege, beide Sprachen) und wird hier nur in eine einheitliche Form
 * gebracht: ein Eintrag hat eine Art, einen Namen, Bloecke und Verweise.
 *
 * Die Hausregeln (#145) kommen spaeter aus einer eigenen Ablage dazu und
 * stehen NEBEN dem offiziellen Bestand, nicht darin: der eine ist
 * unveraenderlich, die anderen gehoeren dem Tisch.
 *
 * Plattformfrei und ohne Oberflaeche — der Hauptprozess liefert daraus die
 * Eintraege fuer die Suche der Huelle, die Oberflaeche zeigt sie.
 */
import type { Paar } from '@suite/srd';
import { GLOSSAR, type Glossarblock } from '@suite/srd/glossar';
import { MAGISCHE_GEGENSTAENDE, type MagischerGegenstand } from '@suite/srd/magische-gegenstaende';
import { ZAUBER, type Zauber } from '@suite/srd/zauber';
import { AUSRUESTUNG, type Ausruestung } from '@suite/srd/ausruestung';
import type { Hausregel } from './hausregeln';

/**
 * Die Arten, in der Reihenfolge, in der sie in der Liste stehen. Sie kommen
 * aus dem Schlagwort, das das Glossar hinter einen Namen setzt
 * („Blinded [Condition]"); Eintraege ohne Schlagwort sind Regeln.
 */
export const ARTEN = [
  'hausregel',
  'homebrew',
  'regel',
  'zustand',
  'aktion',
  'wirkungsbereich',
  'gefahr',
  'haltung',
  'ausruestung',
  'zauber',
  'gegenstand'
] as const;
export type Art = (typeof ARTEN)[number];

export const ART_NAME: Record<Art, Paar> = {
  hausregel: { de: 'Hausregel', en: 'House rule' },
  homebrew: { de: 'Homebrew', en: 'Homebrew' },
  regel: { de: 'Regel', en: 'Rule' },
  zustand: { de: 'Zustand', en: 'Condition' },
  aktion: { de: 'Aktion', en: 'Action' },
  wirkungsbereich: { de: 'Wirkungsbereich', en: 'Area of Effect' },
  gefahr: { de: 'Gefahr', en: 'Hazard' },
  haltung: { de: 'Haltung', en: 'Attitude' },
  ausruestung: { de: 'Ausrüstung', en: 'Equipment' },
  zauber: { de: 'Zauber', en: 'Spell' },
  gegenstand: { de: 'Magischer Gegenstand', en: 'Magic Item' }
};

/** Die Ueberschrift einer Gruppe in der Liste: Mehrzahl. */
export const ART_GRUPPE: Record<Art, Paar> = {
  hausregel: { de: 'Hausregeln', en: 'House rules' },
  homebrew: { de: 'Homebrew', en: 'Homebrew' },
  regel: { de: 'Regeln', en: 'Rules' },
  zustand: { de: 'Zustände', en: 'Conditions' },
  aktion: { de: 'Aktionen', en: 'Actions' },
  wirkungsbereich: { de: 'Wirkungsbereiche', en: 'Areas of Effect' },
  gefahr: { de: 'Gefahren', en: 'Hazards' },
  haltung: { de: 'Haltungen', en: 'Attitudes' },
  ausruestung: { de: 'Ausrüstung', en: 'Equipment' },
  zauber: { de: 'Zauber', en: 'Spells' },
  gegenstand: { de: 'Magische Gegenstände', en: 'Magic Items' }
};

export interface Regel {
  /** `<art>/<kennung>` — eindeutig ueber alle Arten hinweg. */
  readonly id: string;
  readonly art: Art;
  readonly name: Paar;
  /** Eine Zeile unter dem Namen, wie gedruckt: „Wondrous Item, Rare (Requires Attunement)". */
  readonly unterzeile?: Paar;
  /** Der ganze Text, Absatz fuer Absatz mit Leerzeile getrennt — fuer die Suche. */
  readonly text: Paar;
  /** Wie er gezeigt wird: Absaetze, Unterpunkte, Tabellen, Listen. */
  readonly bloecke: readonly Glossarblock[];
  /** Die Kennungen (`<art>/<kennung>`) der Eintraege, auf die er verweist. */
  readonly verweise: readonly string[];
  /** Bild eines Homebrew-Eintrags, als data:-Adresse. */
  readonly bild?: string;
}

function flach(bloecke: readonly Glossarblock[], sprache: 'de' | 'en'): string {
  return bloecke
    .map((b) => {
      if (b.typ === 'tabelle') {
        return [b.titel[sprache], b.kopf[sprache].join(' '), ...b.reihen[sprache].map((r) => r.join(' '))]
          .filter(Boolean)
          .join('\n');
      }
      if (b.typ === 'liste') return [b.titel[sprache], ...b.eintraege[sprache]].filter(Boolean).join('\n');
      return b.text[sprache];
    })
    .join('\n\n');
}

/**
 * Eine Hausregel in derselben Form wie ein offizieller Eintrag, damit Liste,
 * Suche und Vorschau sie gleich behandeln. Der Name steht in beiden Sprachen
 * gleich da: uebersetzt wird nicht, was die Spielleitung schreibt.
 */
export function alsRegel(hausregel: Hausregel): Regel {
  const name = { de: hausregel.name, en: hausregel.name };
  const text = { de: hausregel.text, en: hausregel.text };
  return {
    id: `hausregel/${hausregel.id}`,
    art: 'hausregel',
    name,
    text,
    bloecke: hausregel.text
      .split(/\n{2,}/)
      .filter((absatz) => absatz.trim())
      .map((absatz) => ({ typ: 'absatz' as const, text: { de: absatz, en: absatz } })),
    verweise: hausregel.bezug ? [hausregel.bezug] : []
  };
}

/**
 * Ein Eintrag aus dem Homebrew Creator, wie die Huelle ihn durchreicht
 * (docs/homebrew-creator.md). Er steht neben dem SRD, nicht darin, wie die
 * Hausregeln; geaendert wird er im Homebrew Creator.
 */
export interface HomebrewEintrag {
  readonly id: string;
  readonly name: string;
  /** „Homebrew · Waffe · Kriegsnahkampfwaffe · 1W8 Hieb …" je Sprache. */
  readonly unterzeile: Paar;
  /** Beschreibung, Wirkungen usw. je Sprache, Absatz fuer Absatz. */
  readonly absaetze: { readonly de: readonly string[]; readonly en: readonly string[] };
  readonly bild?: string;
}

export function homebrewAlsRegel(h: HomebrewEintrag): Regel {
  const n = Math.max(h.absaetze.de.length, h.absaetze.en.length);
  const bloecke: Glossarblock[] = Array.from({ length: n }, (_, i) => ({
    typ: 'absatz' as const,
    text: { de: h.absaetze.de[i] ?? h.absaetze.en[i] ?? '', en: h.absaetze.en[i] ?? h.absaetze.de[i] ?? '' }
  }));
  return {
    id: `homebrew/${h.id}`,
    art: 'homebrew',
    name: { de: h.name, en: h.name },
    unterzeile: h.unterzeile,
    text: { de: h.absaetze.de.join('\n\n'), en: h.absaetze.en.join('\n\n') },
    bloecke,
    verweise: [],
    // Nur ein Bild als data:-Adresse; alles andere laesst die CSP ohnehin nicht zu.
    ...(h.bild && /^data:image\/(png|jpeg|webp);base64,/.test(h.bild) ? { bild: h.bild } : {})
  };
}

/**
 * Ein magischer Gegenstand in der Form eines Eintrags. Die Bloecke stehen im
 * Paket je Sprache, in derselben Folge (dort geprueft); hier werden sie
 * paarweise zusammengelegt, wie das Glossar sie liefert.
 */
/** Bloecke, die im Paket je Sprache in derselben Folge stehen, paarweise. */
function paarweise(g: { readonly id: string; readonly bloecke: MagischerGegenstand['bloecke'] }): Glossarblock[] {
  return g.bloecke.en.map((en, i) => {
    const de = g.bloecke.de[i];
    if (en.typ === 'tabelle' && de.typ === 'tabelle') {
      return {
        typ: 'tabelle',
        titel: { de: de.titel, en: en.titel },
        kopf: { de: de.kopf, en: en.kopf },
        reihen: { de: de.reihen, en: en.reihen }
      };
    }
    if (en.typ === 'liste' && de.typ === 'liste') {
      return { typ: 'liste', titel: { de: de.titel, en: en.titel }, eintraege: { de: de.eintraege, en: en.eintraege } };
    }
    if ('text' in en && 'text' in de) return { typ: en.typ, text: { de: de.text, en: en.text } };
    throw new Error(`Blockfolge verschieden: ${g.id}`);
  });
}

function gegenstandAlsRegel(g: MagischerGegenstand): Regel {
  const bloecke = paarweise(g);
  return {
    id: `gegenstand/${g.id}`,
    art: 'gegenstand',
    name: g.name,
    unterzeile: g.kopfzeile,
    text: { de: flach(bloecke, 'de'), en: flach(bloecke, 'en') },
    bloecke,
    verweise: []
  };
}

const EIGENSCHAFT_NAME: Record<keyof Zauber['eigenschaften']['de'], Paar> = {
  zeit: { de: 'Zeitaufwand', en: 'Casting Time' },
  reichweite: { de: 'Reichweite', en: 'Range' },
  komponenten: { de: 'Komponenten', en: 'Components' },
  dauer: { de: 'Wirkungsdauer', en: 'Duration' }
};

/**
 * Ein Zauber in der Form eines Eintrags. Die vier Eigenschaften stehen als
 * fette Kopfzeilen vor dem Text, wie im Buch.
 */
function zauberAlsRegel(z: Zauber): Regel {
  const eigenschaften: Glossarblock[] = (['zeit', 'reichweite', 'komponenten', 'dauer'] as const).map((k) => ({
    typ: 'stichpunkt',
    text: {
      de: `${EIGENSCHAFT_NAME[k].de}: ${z.eigenschaften.de[k]}`,
      en: `${EIGENSCHAFT_NAME[k].en}: ${z.eigenschaften.en[k]}`
    }
  }));
  const bloecke = [...eigenschaften, ...paarweise(z)];
  return {
    id: `zauber/${z.id}`,
    art: 'zauber',
    name: z.name,
    unterzeile: z.gradzeile,
    text: { de: flach(bloecke, 'de'), en: flach(bloecke, 'en') },
    bloecke,
    verweise: []
  };
}

/**
 * Ein Eintrag aus dem Kapitel Ausruestung. Unter dem Namen steht der
 * Abschnitt („Schwer" allein sagt wenig, „Schwer · Eigenschaften" genug),
 * ausser beim Abschnittskopf selbst.
 */
function ausruestungAlsRegel(a: Ausruestung): Regel {
  const bloecke = paarweise(a);
  const eigener = a.name.en === a.abschnitt.en;
  return {
    id: `ausruestung/${a.id}`,
    art: 'ausruestung',
    name: a.name,
    ...(eigener ? {} : { unterzeile: a.abschnitt }),
    text: { de: flach(bloecke, 'de'), en: flach(bloecke, 'en') },
    bloecke,
    verweise: []
  };
}

/*
 * Einzelne Waffen und Ruestungen als eigene Eintraege (Wunsch aus dem
 * Testbericht: „longsword" fand nur die Sammeltabelle).
 *
 * Die Zeilen stehen im SRD je Sprache alphabetisch, also in verschiedener
 * Folge. Gepaart wird deshalb ueber das, was in beiden gleich ist: die
 * Gruppe (Einfache Nahkampfwaffen …), bei Waffen Wuerfel, Schadensart,
 * Meisterschaft und Preis, bei Ruestung die Zahl der RK und der Preis. Ein
 * Test besteht darauf, dass jede Zeile genau einen Partner hat.
 */
const SCHADENSART: Record<string, string> = { Hieb: 'slashing', Stich: 'piercing', Wucht: 'bludgeoning' };
const MEISTERSCHAFTEN = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'];

function preis(text: string): string {
  return text.replace('GM', 'GP').replace('SM', 'SP').replace('KM', 'CP').replace(/[.,]/g, '').trim();
}

function tabelleVon(id: string, sprache: 'de' | 'en'): { kopf: readonly string[]; reihen: readonly (readonly string[])[] } | null {
  const eintrag = AUSRUESTUNG.find((a) => a.id === id);
  const block = eintrag?.bloecke[sprache].find((b) => b.typ === 'tabelle');
  return block && block.typ === 'tabelle' ? block : null;
}

/** Die Zeilen einer Tabelle, je mit ihrer Gruppe und einem sprachfreien Schluessel. */
function zeilen(
  id: string,
  sprache: 'de' | 'en',
  schluessel: (reihe: readonly string[]) => string
): { reihe: readonly string[]; gruppe: string; schluessel: string }[] {
  const tabelle = tabelleVon(id, sprache);
  if (!tabelle) return [];
  const heraus: { reihe: readonly string[]; gruppe: string; schluessel: string }[] = [];
  let gruppe = '';
  let nr = -1;
  for (const reihe of tabelle.reihen) {
    if (reihe.slice(1).every((zelle) => !zelle)) {
      gruppe = reihe[0];
      nr += 1;
      continue;
    }
    heraus.push({ reihe, gruppe, schluessel: `${nr}|${schluessel(reihe)}` });
  }
  return heraus;
}

export function einzelstuecke(): Regel[] {
  const meister = new Map(
    AUSRUESTUNG.filter((a) => MEISTERSCHAFTEN.includes(a.id)).map((a) => [a.name.de, a.name.en])
  );
  const waffe = (sprache: 'de' | 'en') => (r: readonly string[]) => {
    const [wuerfel = '', art = ''] = r[1].replace(/(\d)W(\d)/g, '$1d$2').split(/\s+/);
    const schadensart = sprache === 'de' ? SCHADENSART[art] ?? art : art.toLowerCase();
    const meisterschaft = sprache === 'de' ? meister.get(r[3]) ?? r[3] : r[3];
    return [wuerfel, schadensart, meisterschaft, preis(r[5])].join('|');
  };
  const ruestung = () => (r: readonly string[]) => [r[1].replace(/\D/g, ''), preis(r[5])].join('|');

  const heraus: Regel[] = [];
  for (const [id, art, schluessel] of [
    ['weapons', 'waffe', waffe],
    ['armor', 'ruestung', ruestung]
  ] as const) {
    const de = zeilen(id, 'de', schluessel('de'));
    const en = zeilen(id, 'en', schluessel('en'));
    const kopf = { de: tabelleVon(id, 'de')?.kopf ?? [], en: tabelleVon(id, 'en')?.kopf ?? [] };
    const abschnitt = AUSRUESTUNG.find((a) => a.id === id)?.name ?? { de: '', en: '' };
    for (const e of en) {
      const passend = de.filter((d) => d.schluessel === e.schluessel);
      if (passend.length !== 1) continue;
      const d = passend[0];
      const bloecke: Glossarblock[] = e.reihe.slice(1).map((_, i) => ({
        typ: 'stichpunkt' as const,
        text: { de: `${kopf.de[i + 1]}: ${d.reihe[i + 1]}`, en: `${kopf.en[i + 1]}: ${e.reihe[i + 1]}` }
      }));
      heraus.push({
        id: `ausruestung/${art}-${e.reihe[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        art: 'ausruestung',
        name: { de: d.reihe[0], en: e.reihe[0] },
        unterzeile: { de: `${abschnitt.de} · ${d.gruppe}`, en: `${abschnitt.en} · ${e.gruppe}` },
        text: { de: flach(bloecke, 'de'), en: flach(bloecke, 'en') },
        bloecke,
        verweise: [`ausruestung/${id}`]
      });
    }
  }
  return heraus;
}

let bestand: readonly Regel[] | null = null;

export function alleRegeln(): readonly Regel[] {
  if (bestand) return bestand;
  const artVon = new Map(GLOSSAR.map((e) => [e.id, (e.tag ?? 'regel') as Art]));
  bestand = GLOSSAR.map((e) => ({
    id: `${artVon.get(e.id)}/${e.id}`,
    art: artVon.get(e.id) ?? 'regel',
    name: e.name,
    text: { de: flach(e.bloecke, 'de'), en: flach(e.bloecke, 'en') },
    bloecke: e.bloecke,
    verweise: e.verweise.map((v) => `${artVon.get(v) ?? 'regel'}/${v}`)
  }));
  bestand = [
    ...bestand,
    ...AUSRUESTUNG.map(ausruestungAlsRegel),
    ...einzelstuecke(),
    ...ZAUBER.map(zauberAlsRegel),
    ...MAGISCHE_GEGENSTAENDE.map(gegenstandAlsRegel)
  ];
  return bestand;
}

/** Der Eintrag zu einer Kennung des Glossars („prone" -> „zustand/prone"). */
export function regelFuerGlossar(glossarId: string): Regel | undefined {
  return alleRegeln().find((regel) => regel.id.endsWith(`/${glossarId}`));
}

/** Die Kennung im Glossar: „zustand/prone" -> „prone". */
export function glossarId(regel: Regel): string {
  return regel.id.slice(regel.id.indexOf('/') + 1);
}

export function regelNach(id: string): Regel | undefined {
  return alleRegeln().find((regel) => regel.id === id);
}

/**
 * Der Eintrag, den ein Listenpunkt nennt: „Blinded" in der Liste der
 * Zustaende, „Magie wirken" in der deutschen Liste der Aktionen (der
 * Eintrag heisst dort „Magie").
 */
const LISTENNAMEN: Record<string, string> = { 'Magie wirken': 'Magie', Erschöpft: 'Erschöpfung' };

export function regelMitNamen(name: string, sprache: 'de' | 'en'): Regel | undefined {
  const gesucht = sprache === 'de' ? LISTENNAMEN[name] ?? name : name;
  return alleRegeln().find((regel) => regel.name[sprache] === gesucht);
}

/**
 * Ein Absatz aus dem Regeltext, aufgeteilt in Unterpunkt und Rest.
 *
 * Die Unterpunkte stehen im Dokument fett vor dem Satz — „Attacks
 * Affected." oder „Beeinträchtigte Angriffe:". In beiden Sprachen mit
 * einem anderen Satzzeichen, deshalb hier und nicht in der Oberflaeche.
 * Der Einleitungssatz hat keinen Unterpunkt.
 */
export interface Absatz {
  readonly kopf: string | null;
  readonly rest: string;
}

/**
 * Ein einzelner Unterpunkt: fetter Kopf und Rest. `null` als Kopf, wenn der
 * Text keinen traegt.
 */
export function unterpunkt(text: string): Absatz {
  const treffer = /^([^.:]{2,60}[.:])\s+([\s\S]+)$/.exec(text.trim());
  return treffer ? { kopf: treffer[1], rest: treffer[2] } : { kopf: null, rest: text.trim() };
}

export function absaetze(text: string): Absatz[] {
  return text
    .split(/\n{2,}/)
    .map((teil) => teil.trim())
    .filter(Boolean)
    .map((teil, index) => {
      // Der erste Absatz ist die Einleitung („While you have …") und hat
      // nie einen Unterpunkt, auch wenn er mit einem Doppelpunkt endet.
      if (index === 0) return { kopf: null, rest: teil };
      const treffer = /^([^.:]{2,60}[.:])\s+([\s\S]+)$/.exec(teil);
      return treffer ? { kopf: treffer[1], rest: treffer[2] } : { kopf: null, rest: teil };
    });
}
