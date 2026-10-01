/**
 * Namen zu den Werten, in beiden Sprachen, und die Kurzzeile eines
 * Eintrags. Begriffe wie im SRD 5.2.1 (deutsche und englische Fassung:
 * Waffentabelle, Rüstungstabelle, Schadensarten im Regelglossar).
 */
import type { Paar } from '@suite/srd';
import type { Meisterschaft, RuestungsArt, WaffenEigenschaft } from '@suite/srd/waffen';
import type { Art, Eintrag, Schadensart } from './modell';

export const ART_NAME: Record<Art, Paar> = {
  waffe: { de: 'Waffe', en: 'Weapon' },
  ruestung: { de: 'Rüstung', en: 'Armor' },
  gegenstand: { de: 'Gegenstand', en: 'Item' },
  magisch: { de: 'Magischer Gegenstand', en: 'Magic item' },
  zauber: { de: 'Zauber', en: 'Spell' }
};

export const ART_ZEICHEN: Record<Art, string> = {
  waffe: '⚔',
  ruestung: '🛡',
  gegenstand: '🎒',
  magisch: '✨',
  zauber: '📜'
};

export const EIGENSCHAFT_NAME: Record<WaffenEigenschaft, Paar> = {
  finesse: { de: 'Finesse', en: 'Finesse' },
  leicht: { de: 'Leicht', en: 'Light' },
  schwer: { de: 'Schwer', en: 'Heavy' },
  zweihaendig: { de: 'Zweihändig', en: 'Two-Handed' },
  vielseitig: { de: 'Vielseitig', en: 'Versatile' },
  reichweite: { de: 'Weitreichend', en: 'Reach' },
  wurf: { de: 'Wurfwaffe', en: 'Thrown' },
  munition: { de: 'Geschosse', en: 'Ammunition' },
  laden: { de: 'Laden', en: 'Loading' }
};

export const MEISTERSCHAFT_NAME: Record<Meisterschaft, Paar> = {
  cleave: { de: 'Spalten', en: 'Cleave' },
  graze: { de: 'Streifen', en: 'Graze' },
  nick: { de: 'Einkerben', en: 'Nick' },
  push: { de: 'Stoßen', en: 'Push' },
  sap: { de: 'Auslaugen', en: 'Sap' },
  slow: { de: 'Verlangsamen', en: 'Slow' },
  topple: { de: 'Umstoßen', en: 'Topple' },
  vex: { de: 'Plagen', en: 'Vex' }
};

export const SCHADENSART_NAME: Record<Schadensart, Paar> = {
  stich: { de: 'Stich', en: 'Piercing' },
  hieb: { de: 'Hieb', en: 'Slashing' },
  wucht: { de: 'Wucht', en: 'Bludgeoning' },
  saeure: { de: 'Säure', en: 'Acid' },
  kaelte: { de: 'Kälte', en: 'Cold' },
  feuer: { de: 'Feuer', en: 'Fire' },
  energie: { de: 'Energie', en: 'Force' },
  blitz: { de: 'Blitz', en: 'Lightning' },
  nekrotisch: { de: 'Nekrotisch', en: 'Necrotic' },
  gift: { de: 'Gift', en: 'Poison' },
  psychisch: { de: 'Psychisch', en: 'Psychic' },
  gleissend: { de: 'Gleißend', en: 'Radiant' },
  schall: { de: 'Schall', en: 'Thunder' }
};

export const RUESTUNGSART_NAME: Record<RuestungsArt, Paar> = {
  leicht: { de: 'Leichte Rüstung', en: 'Light Armor' },
  mittel: { de: 'Mittelschwere Rüstung', en: 'Medium Armor' },
  schwer: { de: 'Schwere Rüstung', en: 'Heavy Armor' },
  schild: { de: 'Schild', en: 'Shield' }
};

/** Fuss in der Sprache: englisch „20 ft.", deutsch in Metern wie im SRD (6 m). */
export function weite(fuss: number, s: 'de' | 'en'): string {
  if (s === 'en') return `${fuss} ft.`;
  const m = Math.round(fuss * 0.3 * 10) / 10;
  return `${String(m).replace('.', ',')} m`;
}

function wuerfelText(w: string, s: 'de' | 'en'): string {
  return s === 'de' ? w.replace('d', 'W') : w;
}

/** Die Eigenschaften einer Waffe wie in der SRD-Tabelle. */
export function eigenschaftenText(e: Extract<Eintrag, { art: 'waffe' }>, s: 'de' | 'en'): string {
  return e.eigenschaften
    .map((x) => {
      const name = EIGENSCHAFT_NAME[x][s];
      if (x === 'vielseitig') return `${name} (${wuerfelText(e.vielseitig, s)})`;
      if (x === 'wurf' || x === 'munition') {
        const r = s === 'de'
          ? `${weite(e.reichweiteNormal, s).replace(' m', '')}/${weite(e.reichweiteMax, s)}`
          : `${e.reichweiteNormal}/${e.reichweiteMax}`;
        return `${name} (${s === 'de' ? 'Reichweite' : 'Range'} ${r})`;
      }
      return name;
    })
    .join(', ');
}

/** Eine Zeile unter dem Namen: was es ist und die wichtigsten Werte. */
export function kurzzeile(e: Eintrag, s: 'de' | 'en'): string {
  const de = s === 'de';
  switch (e.art) {
    case 'waffe': {
      const kat = e.kategorie === 'einfach' ? (de ? 'Einfache' : 'Simple') : de ? 'Kriegs' : 'Martial';
      const nf = e.fern ? (de ? 'Fernkampfwaffe' : 'Ranged Weapon') : de ? 'Nahkampfwaffe' : 'Melee Weapon';
      const bonus = e.bonus ? ` +${e.bonus}` : '';
      const teile = [
        de ? (e.kategorie === 'einfach' ? `${kat} ${nf}` : `${kat}${nf.toLowerCase()}`) : `${kat} ${nf}`,
        `${wuerfelText(e.wuerfel, s)} ${SCHADENSART_NAME[e.schadensart][s]}${bonus}`,
        eigenschaftenText(e, s),
        MEISTERSCHAFT_NAME[e.meisterschaft][s]
      ];
      return teile.filter(Boolean).join(' · ');
    }
    case 'ruestung': {
      const ges = e.ruestungsart === 'leicht' ? (de ? ' + GES' : ' + Dex') : e.ruestungsart === 'mittel' ? (de ? ' + GES (max. 2)' : ' + Dex (max 2)') : '';
      const rk = e.ruestungsart === 'schild' ? `+${e.rk + e.bonus}` : `${e.rk + e.bonus}${ges}`;
      const teile = [
        RUESTUNGSART_NAME[e.ruestungsart][s],
        `${de ? 'RK' : 'AC'} ${rk}`,
        e.staerke ? `${de ? 'Stä.' : 'Str'} ${e.staerke}` : '',
        e.heimlichkeitNachteil ? (de ? 'Heimlichkeit: Nachteil' : 'Stealth: Disadvantage') : ''
      ];
      return teile.filter(Boolean).join(' · ');
    }
    case 'gegenstand':
      return ART_NAME.gegenstand[s];
    case 'magisch':
      return `${ART_NAME.magisch[s]}${e.einstimmung ? (de ? ' (Einstimmung)' : ' (attunement)') : ''}`;
    case 'zauber': {
      const grad = e.grad === 0 ? (de ? 'Zaubertrick' : 'Cantrip') : de ? `Grad ${e.grad}` : `Level ${e.grad}`;
      const schaden = e.schadenAnzahl ? `${e.schadenAnzahl}${de ? 'W' : 'd'}${e.schadenSeiten} ${SCHADENSART_NAME[e.schadensart][s]}` : '';
      return [grad, schaden, e.konzentration ? (de ? 'Konzentration' : 'Concentration') : ''].filter(Boolean).join(' · ');
    }
  }
}
