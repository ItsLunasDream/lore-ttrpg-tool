/**
 * Ein Homebrew-Eintrag so, wie der Charakterbogen ihn ins Inventar nimmt
 * (docs/homebrew-creator.md, „Wohin die Ergebnisse gehen").
 *
 * Eine eigene Waffe bringt ihre Kampfwerte mit (`waffe.eigen`), denn der
 * Bogen kennt diese Sammlung nicht; er rechnet damit wie mit einer
 * SRD-Waffe. Ruestungen kommen als Gegenstand; die RK bleibt im Bogen ein
 * eigenes Feld. Zauber gehoeren nicht ins Inventar.
 */
import { SELTENHEIT_NAME } from '@suite/srd';
import type { Eintrag } from './modell';
import { ART_NAME, MEISTERSCHAFT_NAME, SCHADENSART_NAME, eigenschaftenText, kurzzeile, wuerfelMitPlus } from './texte';

export interface InventarEintrag {
  readonly quelle: 'homebrew';
  readonly kennung: string;
  readonly name: string;
  readonly art: string;
  readonly gewicht: number | null;
  readonly wert: number | null;
  readonly beschreibung: string;
  readonly einstimmung?: boolean;
  readonly bild?: string;
  readonly waffe?: {
    readonly id: string;
    readonly magie: number;
    readonly geuebt: boolean;
    readonly eigen: {
      readonly kategorie: 'einfach' | 'kriegs';
      readonly fern: boolean;
      readonly wuerfel: string;
      readonly vielseitig: string | null;
      readonly art: [string, string];
      readonly finesse: boolean;
      readonly eigenschaften: [string, string];
      readonly meisterschaft: [string, string];
    };
  };
}

function artMitZusatz(e: Extract<Eintrag, { art: 'waffe' }>, s: 'de' | 'en'): string {
  const plus = e.schadenPlus ? `+${e.schadenPlus} ` : '';
  const extra = e.zusatz.map((z) => ` + ${wuerfelMitPlus(z.wuerfel, z.plus, s)} ${SCHADENSART_NAME[z.art][s]}`).join('');
  return `${plus}${SCHADENSART_NAME[e.schadensart][s]}${extra}`;
}

export function inventarEintrag(e: Eintrag, s: 'de' | 'en'): InventarEintrag | null {
  if (e.art === 'zauber') return null;
  const de = s === 'de';
  const art =
    e.art === 'magisch'
      ? `${ART_NAME.magisch[s]}, ${SELTENHEIT_NAME[e.seltenheit][s]}${e.einstimmung ? (de ? ' (Einstimmung)' : ' (attunement)') : ''}`
      : `Homebrew · ${ART_NAME[e.art][s]}`;
  const beschreibung = [
    e.art === 'gegenstand' || e.art === 'magisch' ? '' : kurzzeile(e, s),
    e.beschreibung.trim(),
    ...(e.art === 'magisch' ? e.wirkungen.filter((w) => w.trim()) : []),
    e.art === 'magisch' && e.fluch.trim() ? `${de ? 'Fluch' : 'Curse'}: ${e.fluch.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
  const basis = {
    quelle: 'homebrew' as const,
    kennung: e.id,
    name: e.name,
    art,
    gewicht: e.gewicht,
    wert: e.preis,
    beschreibung,
    ...(e.art === 'magisch' ? { einstimmung: e.einstimmung } : {}),
    ...(e.bild ? { bild: e.bild } : {})
  };
  if (e.art !== 'waffe') return basis;
  return {
    ...basis,
    waffe: {
      id: `hb-${e.id}`.slice(0, 40),
      magie: e.bonus,
      geuebt: true,
      eigen: {
        kategorie: e.kategorie,
        fern: e.fern,
        wuerfel: e.wuerfel,
        vielseitig: e.eigenschaften.includes('vielseitig') ? e.vielseitig : null,
        // Plus und Zusatzschaden reisen im Text der Schadensart mit: der Bogen rechnet nur mit einem Würfel.
        art: [artMitZusatz(e, 'de'), artMitZusatz(e, 'en')],
        finesse: e.eigenschaften.includes('finesse'),
        eigenschaften: [eigenschaftenText(e, 'de') || '—', eigenschaftenText(e, 'en') || '—'],
        meisterschaft: [MEISTERSCHAFT_NAME[e.meisterschaft].de, MEISTERSCHAFT_NAME[e.meisterschaft].en]
      }
    }
  };
}

