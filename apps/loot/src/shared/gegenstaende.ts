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

export function istGegenstandstabelle(id: string): boolean {
  return id.startsWith(GEGENSTAND_PRAEFIX);
}

export function gegenstandsTabellen(
  liste: readonly { readonly name: string; readonly seltenheit: string }[],
  sprache: 'de' | 'en'
): Gespeichert[] {
  if (liste.length === 0) return [];
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
  return heraus;
}
