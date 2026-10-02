/**
 * Foundry-Export des Homebrew Creators (docs/homebrew-creator.md).
 *
 * Magische Gegenstaende ueber `alsFoundryGegenstand` (belegt an Exporten
 * aus dnd5e 5.3.3, docs/magicitems.md); Waffen, Ruestungen, einfache
 * Gegenstaende und Zauber ueber `packages/foundry/src/homebrew.ts` (belegt an
 * Exporten aus dnd5e 6.0.5). Was dort nicht belegt ist, steht dort.
 *
 * Das Bild steht als data:-Adresse in `img`. UNGEPRUEFT: Foundry selbst
 * legt dort einen Pfad auf dem Server ab („assets/…png"); ob es eine
 * data:-Adresse beim Import annimmt, ist an keinem echten Import getestet.
 */
import {
  alsFoundryGegenstand,
  alsFoundryKram,
  alsFoundryRuestung,
  alsFoundryWaffe,
  alsFoundryZauber,
  dateiname,
  kennung
} from '@suite/foundry';
import { gegenstandswert } from '@suite/srd';
import { VERBRAUCH } from '@suite/magie/tabellen';
import type { Eintrag } from './modell';

export function kannFoundry(e: Eintrag): boolean {
  return ['magisch', 'waffe', 'ruestung', 'gegenstand', 'zauber'].includes(e.art);
}

function alsItem(e: Eintrag, zufall: () => number): Record<string, unknown> {
  switch (e.art) {
    case 'waffe':
      return alsFoundryWaffe(e, kennung(zufall));
    case 'ruestung':
      return alsFoundryRuestung(e);
    case 'gegenstand':
      return alsFoundryKram(e);
    case 'zauber':
      return alsFoundryZauber(e, kennung(zufall));
    case 'magisch': {
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
      if (e.bild) item.img = e.bild;
      return item;
    }
  }
}

export function alsFoundryDatei(e: Eintrag, zufall: () => number = Math.random): { name: string; inhalt: string } | null {
  if (!kannFoundry(e)) return null;
  return { name: dateiname('Item', e.name, kennung(zufall)), inhalt: `${JSON.stringify(alsItem(e, zufall), null, 2)}\n` };
}
