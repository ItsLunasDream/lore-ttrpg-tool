/**
 * Eichung magischer Gegenstaende von Hand (docs/homebrew-creator.md, Reiter 4).
 *
 * Dieselben Grenzen wie im Magic Item Generator (@suite/magie/pruefung):
 * Bonus, Zusatzschaden, SG, Zaubergrad und Anzahl der Wirkungen je
 * Seltenheit, geeicht an SRD-Gegenstaenden. Der Generator zieht damit
 * Vorschlaege der KI zurecht; hier wird nur gemeldet, nichts geaendert.
 *
 * Grenze der Methode: gelesen werden nur Zahlen in festen Mustern
 * („+2 Bonus", „2W6 … Schaden", „SG 15", „(Grad 3)"). Was frei formuliert
 * ist, sieht die Eichung nicht; das sagt die Oberflaeche.
 */
import type { Paar } from '@suite/srd';
import { SELTENHEIT_NAME, gegenstandswert } from '@suite/srd';
import { grenzen, pruefeKi } from '@suite/magie/pruefung';
import { ART_NAME as MAGIE_ART_NAME, VERBRAUCH } from '@suite/magie/tabellen';
import type { Befund, Urteil } from './eichung';
import type { Magisch } from './modell';

export interface MagischEichung {
  readonly urteil: Urteil;
  readonly satz: Paar;
  readonly befunde: readonly Befund[];
}

function wuerfel(w: string, s: 'de' | 'en'): string {
  return s === 'de' ? w.replace('d', 'W') : w;
}

export function eicheMagisch(m: Magisch): MagischEichung {
  const gr = grenzen(m.gegenstandsart, m.seltenheit);
  const satz = (s: 'de' | 'en'): string => {
    const wo = `${SELTENHEIT_NAME[m.seltenheit][s]} · ${MAGIE_ART_NAME[m.gegenstandsart][s]}`;
    const gm = gegenstandswert(m.seltenheit, { verbrauch: VERBRAUCH[m.gegenstandsart] });
    const wert = `${gm.toLocaleString(s === 'de' ? 'de-DE' : 'en-US')} ${s === 'de' ? 'GM' : 'GP'}`;
    return s === 'de'
      ? `${wo}: höchstens Bonus +${gr.bonus}, Zusatzschaden ${wuerfel(gr.schaden, s)}, SG ${gr.sg}, Zaubergrad ${gr.grad}, ${gr.wirkungen} Wirkungen. Wert laut SRD: ${wert}.`
      : `${wo}: at most a +${gr.bonus} bonus, ${gr.schaden} extra damage, DC ${gr.sg}, spell level ${gr.grad}, ${gr.wirkungen} properties. Value per the SRD: ${wert}.`;
  };
  const befunde: Befund[] = [];
  for (const s of ['de', 'en'] as const) {
    const { zeilen } = pruefeKi(
      {
        id: m.id,
        name: m.name,
        art: m.gegenstandsart,
        seltenheit: m.seltenheit,
        einstimmung: m.einstimmung,
        wirkungen: m.wirkungen.filter((w) => w.trim()),
        fluch: m.fluch,
        wert: 0,
        notiz: '',
        geaendert: ''
      },
      s
    );
    zeilen.forEach((z, i) => {
      if (s === 'de') befunde.push({ stufe: 'warnung', text: { de: z, en: z } });
      else if (befunde[i]) befunde[i] = { ...befunde[i], text: { de: befunde[i].text.de, en: z } };
    });
  }
  if (VERBRAUCH[m.gegenstandsart] && m.einstimmung)
    befunde.push({
      stufe: 'hinweis',
      text: { de: 'Tränke und Schriftrollen brauchen im SRD keine Einstimmung.', en: 'Potions and scrolls never require attunement in the SRD.' }
    });
  return {
    urteil: befunde.some((b) => b.stufe === 'warnung') ? 'ueber' : 'im_rahmen',
    satz: { de: satz('de'), en: satz('en') },
    befunde
  };
}
