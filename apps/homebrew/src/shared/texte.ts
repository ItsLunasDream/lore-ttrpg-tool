/**
 * Namen zu den Werten, in beiden Sprachen, und die Kurzzeile eines
 * Eintrags. Begriffe wie im SRD 5.2.1 (deutsche und englische Fassung:
 * Waffentabelle, Rüstungstabelle, Schadensarten im Regelglossar).
 */
import type { Paar } from '@suite/srd';
import type { Meisterschaft, RuestungsArt, WaffenEigenschaft } from '@suite/srd/waffen';
import type { Art, Eintrag, Schadensart, Zauberklasse, Zauberschule } from './modell';

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

/** Schulen wie in den Gradzeilen des SRD („Zaubertrick der Hervorrufung", „Evocation Cantrip"); der Test prueft das. */
export const SCHULE_NAME: Record<Zauberschule, Paar> = {
  bann: { de: 'Bann', en: 'Abjuration' },
  beschwoerung: { de: 'Beschwörung', en: 'Conjuration' },
  erkenntnis: { de: 'Erkenntnis', en: 'Divination' },
  verzauberung: { de: 'Verzauberung', en: 'Enchantment' },
  hervorrufung: { de: 'Hervorrufung', en: 'Evocation' },
  illusion: { de: 'Illusion', en: 'Illusion' },
  nekromantie: { de: 'Nekromantie', en: 'Necromancy' },
  verwandlung: { de: 'Verwandlung', en: 'Transmutation' }
};

/** Klassen wie in den Gradzeilen des SRD; der Test prueft das. */
export const KLASSE_NAME: Record<Zauberklasse, Paar> = {
  barde: { de: 'Barde', en: 'Bard' },
  druide: { de: 'Druide', en: 'Druid' },
  hexenmeister: { de: 'Hexenmeister', en: 'Warlock' },
  kleriker: { de: 'Kleriker', en: 'Cleric' },
  magier: { de: 'Magier', en: 'Wizard' },
  paladin: { de: 'Paladin', en: 'Paladin' },
  waldlaeufer: { de: 'Waldläufer', en: 'Ranger' },
  zauberer: { de: 'Zauberer', en: 'Sorcerer' }
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
      const schule = SCHULE_NAME[e.schule][s];
      const grad = e.grad === 0 ? (de ? `Zaubertrick, ${schule}` : `${schule} Cantrip`) : de ? `${schule}, Grad ${e.grad}` : `Level ${e.grad} ${schule}`;
      const schaden = e.schadenAnzahl ? `${e.schadenAnzahl}${de ? 'W' : 'd'}${e.schadenSeiten}${e.schadenPlus ? ` + ${e.schadenPlus}` : ''} ${SCHADENSART_NAME[e.schadensart][s]}` : '';
      return [grad, schaden, e.konzentration ? (de ? 'Konzentration' : 'Concentration') : ''].filter(Boolean).join(' · ');
    }
  }
}

/** Die Kopfzeile eines Zaubers wie im SRD: Zeitaufwand, Reichweite, Komponenten, Wirkungsdauer. */
export function zauberEigenschaften(z: Extract<Eintrag, { art: 'zauber' }>, s: 'de' | 'en'): string {
  const de = s === 'de';
  const dauer = z.konzentration && !/konzentration|concentration/i.test(z.dauer) ? `${de ? 'Konzentration' : 'Concentration'}, ${z.dauer}` : z.dauer;
  return [
    `${de ? 'Zeitaufwand' : 'Casting Time'}: ${z.zeit}${z.ritual ? (de ? ' oder Ritual' : ' or Ritual') : ''}`,
    `${de ? 'Reichweite' : 'Range'}: ${z.reichweite}`,
    `${de ? 'Komponenten' : 'Components'}: ${z.komponenten}`,
    `${de ? 'Wirkungsdauer' : 'Duration'}: ${dauer}`
  ].join(' · ');
}

/** Der ganze Text eines eigenen Zaubers, fuer die Zauberliste des Bogens. */
export function zauberText(z: Extract<Eintrag, { art: 'zauber' }>, s: 'de' | 'en'): string {
  const teile = [kurzzeile(z, s), zauberEigenschaften(z, s)];
  const klassen = z.klassen.map((k) => KLASSE_NAME[k][s]).join(', ');
  if (klassen) teile.push(`${s === 'de' ? 'Klassen' : 'Classes'}: ${klassen}`);
  if (z.beschreibung.trim()) teile.push('', z.beschreibung.trim());
  if (z.hoehererGrad.trim()) teile.push('', `${s === 'de' ? 'Höhere Grade' : 'Higher levels'}: ${z.hoehererGrad.trim()}`);
  return teile.join('\n');
}
