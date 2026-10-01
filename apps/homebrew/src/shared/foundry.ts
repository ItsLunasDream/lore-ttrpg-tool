/**
 * Foundry-Export des Homebrew Creators (docs/homebrew-creator.md).
 *
 * Nur fuer magische Gegenstaende: deren Format ist in `@suite/foundry` gegen
 * echte Exporte geprueft (docs/magicitems.md). Fuer Waffen, Ruestungen,
 * einfache Gegenstaende und Zauber liegt mir kein echter Export vor, an dem
 * ich die Felder pruefen koennte; geraten wird nicht.
 */
import { alsFoundryGegenstand, dateiname, kennung } from '@suite/foundry';
import { gegenstandswert } from '@suite/srd';
import { VERBRAUCH } from '@suite/magie/tabellen';
import type { Eintrag } from './modell';

export function kannFoundry(e: Eintrag): boolean {
  return e.art === 'magisch';
}

export function alsFoundryDatei(e: Eintrag, zufall: () => number = Math.random): { name: string; inhalt: string } | null {
  if (e.art !== 'magisch') return null;
  const item = alsFoundryGegenstand({
    name: e.name,
    art: e.gegenstandsart,
    seltenheit: e.seltenheit,
    einstimmung: e.einstimmung,
    wirkungen: e.wirkungen,
    fluch: e.fluch,
    // Eigener Preis, sonst der Wert laut SRD-Tabelle.
    wert: e.preis ?? gegenstandswert(e.seltenheit, { verbrauch: VERBRAUCH[e.gegenstandsart] }),
    notiz: e.beschreibung
  });
  return { name: dateiname('Item', e.name, kennung(zufall)), inhalt: `${JSON.stringify(item, null, 2)}\n` };
}
