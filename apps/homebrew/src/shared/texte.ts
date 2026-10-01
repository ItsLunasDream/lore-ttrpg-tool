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

/*
 * Ein Satz je Eigenschaft, Meisterschaft und Schule: eigene Kurzfassungen
 * der SRD-5.2-Regeln, kein Zitat. Die vollen Regeln stehen im Nachschlagewerk.
 */
export const EIGENSCHAFT_TEXT: Record<WaffenEigenschaft, Paar> = {
  finesse: { de: 'Angriff und Schaden wahlweise mit Stärke oder Geschicklichkeit.', en: 'Attack and damage use your choice of Strength or Dexterity.' },
  leicht: { de: 'Erlaubt einen Zusatzangriff mit einer zweiten leichten Waffe als Bonusaktion.', en: 'Allows an extra attack with a second Light weapon as a Bonus Action.' },
  schwer: { de: 'Nachteil auf Angriffe, wenn Stärke (Nahkampf) bzw. Geschicklichkeit (Fernkampf) unter 13 liegt.', en: 'Disadvantage on attacks if Strength (melee) or Dexterity (ranged) is below 13.' },
  zweihaendig: { de: 'Braucht zum Angreifen beide Hände.', en: 'Requires two hands when you attack with it.' },
  vielseitig: { de: 'Ein- oder zweihändig; zweihändig mit größerem Schadenswürfel.', en: 'One- or two-handed; two-handed uses a larger damage die.' },
  reichweite: { de: 'Erhöht die Reichweite im Nahkampf um 1,5 m (5 ft.).', en: 'Adds 5 feet to your reach when you attack with it.' },
  wurf: { de: 'Kann geworfen werden; Fernkampfangriff mit demselben Attribut wie im Nahkampf.', en: 'Can be thrown for a ranged attack using the same ability as for melee.' },
  munition: { de: 'Braucht Munition für Fernkampfangriffe; danach lässt sich die Hälfte wiederfinden.', en: 'Needs ammunition for ranged attacks; half can be recovered afterwards.' },
  laden: { de: 'Nur ein Schuss je Aktion, Bonusaktion oder Reaktion, egal wie viele Angriffe.', en: 'Only one shot per action, Bonus Action or Reaction, regardless of extra attacks.' }
};

export const MEISTERSCHAFT_TEXT: Record<Meisterschaft, Paar> = {
  cleave: { de: 'Bei Treffer ein zweiter Angriff gegen eine andere Kreatur in der Nähe, einmal pro Zug, ohne Attributsmodifikator beim Schaden.', en: 'On a hit, a second attack against another creature nearby, once per turn, without ability modifier to damage.' },
  graze: { de: 'Bei Fehlschlag trotzdem Schaden in Höhe des Attributsmodifikators.', en: 'On a miss, still deal damage equal to the ability modifier.' },
  nick: { de: 'Der Zusatzangriff der leichten Waffe wird Teil der Angriffsaktion statt Bonusaktion.', en: 'The extra Light weapon attack becomes part of the Attack action instead of a Bonus Action.' },
  push: { de: 'Bei Treffer das Ziel (höchstens groß) bis zu 3 m (10 ft.) wegstoßen.', en: 'On a hit, push the target (Large or smaller) up to 10 feet away.' },
  sap: { de: 'Bei Treffer hat das Ziel Nachteil auf seinen nächsten Angriff.', en: 'On a hit, the target has Disadvantage on its next attack roll.' },
  slow: { de: 'Bei Treffer mit Schaden sinkt die Bewegung des Ziels um 3 m (10 ft.) bis zu deinem nächsten Zug.', en: 'On a damaging hit, the target’s Speed drops by 10 feet until your next turn.' },
  topple: { de: 'Bei Treffer Rettungswurf auf Konstitution, sonst liegt das Ziel am Boden.', en: 'On a hit, the target makes a Constitution save or falls Prone.' },
  vex: { de: 'Bei Treffer mit Schaden Vorteil auf deinen nächsten Angriff gegen dieses Ziel.', en: 'On a damaging hit, you have Advantage on your next attack against that target.' }
};

export const SCHULE_TEXT: Record<Zauberschule, Paar> = {
  bann: { de: 'Schützt, wehrt ab oder beendet schädliche Wirkungen.', en: 'Protects, wards off or ends harmful effects.' },
  beschwoerung: { de: 'Ruft Kreaturen oder Dinge herbei oder versetzt sie.', en: 'Summons or transports creatures and objects.' },
  erkenntnis: { de: 'Enthüllt Wissen: Verborgenes, Fernes, Kommendes.', en: 'Reveals information: hidden, distant or future.' },
  verzauberung: { de: 'Beeinflusst Geist und Verhalten anderer.', en: 'Influences the minds and behaviour of others.' },
  hervorrufung: { de: 'Formt Energie, oft zerstörerisch (Feuer, Blitz, Kraft).', en: 'Shapes energy, often destructively (fire, lightning, force).' },
  illusion: { de: 'Täuscht Sinne oder Verstand.', en: 'Deceives the senses or the mind.' },
  nekromantie: { de: 'Wirkt auf Leben und Tod, Lebenskraft und Untote.', en: 'Works on life and death, life force and the undead.' },
  verwandlung: { de: 'Verändert Kreaturen, Dinge oder Umgebung.', en: 'Changes creatures, objects or surroundings.' }
};

/** Schadenswürfel mit Plus, wie „1W8 + 2". */
export function wuerfelMitPlus(wuerfel: string, plus: number, s: 'de' | 'en'): string {
  const w = wuerfel === '0' ? '' : wuerfelText(wuerfel, s);
  if (!plus) return w || '0';
  return w ? `${w} + ${plus}` : String(plus);
}

/** Der ganze Schaden einer Waffe: „1W8 + 2 Hieb + 1W6 Feuer". */
export function waffenSchaden(e: Extract<Eintrag, { art: 'waffe' }>, s: 'de' | 'en'): string {
  return [
    `${wuerfelMitPlus(e.wuerfel, e.schadenPlus, s)} ${SCHADENSART_NAME[e.schadensart][s]}`,
    ...e.zusatz.map((z) => `${wuerfelMitPlus(z.wuerfel, z.plus, s)} ${SCHADENSART_NAME[z.art][s]}`)
  ].join(' + ');
}

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
        `${waffenSchaden(e, s)}${bonus}`,
        eigenschaftenText(e, s),
        !e.fern && e.reichweiteNah !== 5 ? `${de ? 'Reichweite' : 'Reach'} ${weite(e.reichweiteNah, s)}` : '',
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
      const w = de ? 'W' : 'd';
      const schaden =
        e.wirkungen.includes('schaden') && e.schadenAnzahl
          ? `${e.schadenAnzahl}${w}${e.schadenSeiten}${e.schadenPlus ? ` + ${e.schadenPlus}` : ''} ${SCHADENSART_NAME[e.schadensart][s]}`
          : '';
      const heilung =
        e.wirkungen.includes('heilung') && (e.heilAnzahl || e.heilPlus)
          ? `${de ? 'Heilung' : 'Healing'} ${e.heilAnzahl ? `${e.heilAnzahl}${w}${e.heilSeiten}` : ''}${e.heilAnzahl && e.heilPlus ? ' + ' : ''}${e.heilPlus || ''}`
          : '';
      const zustand = e.wirkungen.includes('zustand') && e.zustand.trim() ? e.zustand.trim() : '';
      return [grad, schaden, heilung, zustand, e.konzentration ? (de ? 'Konzentration' : 'Concentration') : ''].filter(Boolean).join(' · ');
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
  const klassen = [...z.klassen.map((k) => KLASSE_NAME[k][s]), ...z.eigeneKlassen].join(', ');
  if (klassen) teile.push(`${s === 'de' ? 'Klassen' : 'Classes'}: ${klassen}`);
  if (z.unterklassen.length) teile.push(`${s === 'de' ? 'Unterklassen' : 'Subclasses'}: ${z.unterklassen.join(', ')}`);
  if (z.beschreibung.trim()) teile.push('', z.beschreibung.trim());
  if (z.hoehererGrad.trim()) teile.push('', `${s === 'de' ? 'Höhere Grade' : 'Higher levels'}: ${z.hoehererGrad.trim()}`);
  return teile.join('\n');
}
