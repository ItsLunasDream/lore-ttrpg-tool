/**
 * Magische Gegenstände liegen in der Ablage des Magic Item Generators
 * (Rückmeldung: „Blank Item" gab es doppelt; eine Sammlung für beide).
 * Hier die Übersetzung zwischen dem Eintrag des Homebrew Creators und dem
 * Gegenstand des Generators.
 *
 * Kennungen aus dieser Ablage beginnen im Homebrew Creator mit „@"; eigene
 * Dateinamen können das nicht (zuId lässt nur a–z, 0–9 und „-" übrig).
 */
import { gegenstandswert } from '@suite/srd';
import { VERBRAUCH } from '@suite/magie/tabellen';
import type { Gegenstand } from '@suite/magie/erzeuge';
import type { Magisch } from './modell';

export const MAGIE_PRAEFIX = '@';

export function istMagieKennung(id: string): boolean {
  return id.startsWith(MAGIE_PRAEFIX);
}

export function magieId(id: string): string {
  return istMagieKennung(id) ? id.slice(MAGIE_PRAEFIX.length) : id;
}

/** Eintrag → Gegenstand des Generators. Ohne Preis gilt der Wert laut SRD-Tabelle. */
export function alsGegenstand(m: Magisch, id: string): Gegenstand {
  return {
    id,
    name: m.name,
    art: m.gegenstandsart,
    seltenheit: m.seltenheit,
    einstimmung: m.einstimmung,
    wirkungen: m.wirkungen.filter((w) => w.trim()),
    fluch: m.fluch,
    wert: m.preis ?? gegenstandswert(m.seltenheit, { verbrauch: VERBRAUCH[m.gegenstandsart] }),
    notiz: m.beschreibung,
    geaendert: m.geaendert,
    ...(m.imLoot ? { imLoot: true } : {}),
    ...(m.bild ? { bild: m.bild } : {}),
    ...(m.gewicht !== null ? { gewicht: m.gewicht } : {})
  };
}

/** Gegenstand des Generators → Eintrag; die Kennung bekommt das „@". */
export function ausGegenstand(g: Gegenstand): Magisch {
  return {
    id: `${MAGIE_PRAEFIX}${g.id}`,
    art: 'magisch',
    name: g.name,
    beschreibung: g.notiz,
    bild: g.bild ?? null,
    preis: g.wert,
    gewicht: g.gewicht ?? null,
    geaendert: g.geaendert,
    ...(g.imLoot ? { imLoot: true } : {}),
    gegenstandsart: g.art,
    seltenheit: g.seltenheit,
    einstimmung: g.einstimmung,
    wirkungen: g.wirkungen.length ? [...g.wirkungen] : [''],
    fluch: g.fluch
  };
}
