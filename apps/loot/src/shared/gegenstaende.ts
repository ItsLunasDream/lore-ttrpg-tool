/**
 * Der Bestand des Magic Item Generators als Tabellen.
 *
 * „Wuerfle einen seltenen magischen Gegenstand" soll auf die Gegenstaende
 * zeigen, die die Spielleitung schon gebaut hat, statt einen neuen zu
 * erfinden (siehe docs/loot.md, Abgrenzung). Die Huelle reicht Name und
 * Seltenheit durch; hier werden daraus Tabellen, eine fuer alle und eine
 * je Seltenheit, die es im Bestand gibt. Leere Seltenheiten fehlen mit
 * Absicht: ein Verweis darauf zeigt dann sichtbar „gibt es nicht", statt
 * still nichts zu liefern.
 *
 * Schreibgeschuetzt wie die SRD-Tabelle: geaendert wird der Bestand im
 * Magic Item Generator, nicht hier.
 */
import { SELTENHEITEN, SELTENHEIT_NAME, type Seltenheit } from '@suite/srd';
import type { Gespeichert } from './ablage';
import { woertlich } from '@suite/tabellen';

export const GEGENSTAND_PRAEFIX = 'mi-';

const GRUNDNAME = { de: 'Magische Gegenstände', en: 'Magic Items' } as const;
const HOMEBREW = { de: 'Homebrew', en: 'Homebrew' } as const;

export function istGegenstandstabelle(id: string): boolean {
  return id.startsWith(GEGENSTAND_PRAEFIX);
}

/**
 * `herkunft: 'homebrew'`: aus dem Homebrew Creator (docs/homebrew-creator.md).
 * Die stehen in einer eigenen Tabelle „Homebrew"; nur die magischen mit
 * Seltenheit stehen zusaetzlich bei den magischen Gegenstaenden.
 */
export function gegenstandsTabellen(
  roh: readonly { readonly name: string; readonly seltenheit: string; readonly herkunft?: string; readonly tabelle?: string }[],
  sprache: 'de' | 'en'
): Gespeichert[] {
  const orte = ladenTabellen(roh.filter((g) => g.herkunft === 'ort' && g.tabelle));
  roh = roh.filter((g) => g.herkunft !== 'ort');
  const homebrew = roh.filter((g) => g.herkunft === 'homebrew');
  const liste = roh.filter((g) => (SELTENHEITEN as readonly string[]).includes(g.seltenheit));
  const zusatz = (heraus: Gespeichert[]): Gespeichert[] => [...mitHomebrew(heraus), ...orte];
  const mitHomebrew = (heraus: Gespeichert[]) =>
    homebrew.length
      ? [
          ...heraus,
          {
            id: `${GEGENSTAND_PRAEFIX}homebrew`,
            name: HOMEBREW[sprache],
            aliase: [],
            eintraege: [...homebrew.map((g) => g.name)].sort((a, b) => a.localeCompare(b)).map((text) => ({ text: woertlich(text) })),
            notiz: '',
            geaendert: ''
          }
        ]
      : heraus;
  if (liste.length === 0) return zusatz([]);
  const tabelle = (id: string, name: string, namen: readonly string[], aliase: readonly string[]): Gespeichert => ({
    id: `${GEGENSTAND_PRAEFIX}${id}`,
    name,
    aliase,
    // Namen woertlich: „Ring of 2d4 Wishes" wird nicht gewuerfelt, „[…]" ist kein Verweis.
    eintraege: [...namen].sort((a, b) => a.localeCompare(b)).map((text) => ({ text: woertlich(text) })),
    notiz: '',
    geaendert: ''
  });
  const andere = sprache === 'de' ? 'en' : 'de';
  const heraus = [tabelle('alle', GRUNDNAME[sprache], liste.map((g) => g.name), [GRUNDNAME[andere]])];
  for (const s of SELTENHEITEN as readonly Seltenheit[]) {
    const namen = liste.filter((g) => g.seltenheit === s).map((g) => g.name);
    if (namen.length) {
      heraus.push(
        tabelle(s, `${GRUNDNAME[sprache]} (${SELTENHEIT_NAME[s][sprache]})`, namen, [
          `${GRUNDNAME[andere]} (${SELTENHEIT_NAME[s][andere]})`
        ])
      );
    }
  }
  return zusatz(heraus);
}

/**
 * `herkunft: 'ort'`: die Läden eines Orts aus dem Settlement Generator
 * (docs/ortsgenerator.md), je Laden eine Tabelle, Einträge „Ware (Preis)".
 */
function ladenTabellen(roh: readonly { readonly name: string; readonly tabelle?: string }[]): Gespeichert[] {
  const gruppen = new Map<string, string[]>();
  for (const g of roh) {
    const t = g.tabelle ?? '';
    gruppen.set(t, [...(gruppen.get(t) ?? []), g.name]);
  }
  return [...gruppen].map(([name, eintraege]) => ({
    id: `${GEGENSTAND_PRAEFIX}ort-${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`,
    name,
    aliase: [],
    eintraege: eintraege.map((text) => ({ text: woertlich(text) })),
    notiz: '',
    geaendert: ''
  }));
}
