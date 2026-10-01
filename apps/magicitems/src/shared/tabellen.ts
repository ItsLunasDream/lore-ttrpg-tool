/**
 * Die Tabellen des Magic Item Generators: Arten, Wirkungen, Namen.
 *
 * Zweisprachig als Paar, wie in den anderen Werkzeugen. Die Wirkungen sind
 * EIGENE Formulierungen nach dem Muster, das man aus dem Regelwerk kennt
 * („+1 auf Angriffs- und Schadenswuerfe"), keine abgeschriebenen Gegenstaende.
 *
 * Jede Wirkung sagt, ab welcher Seltenheit sie vorkommt und bei welchen Arten.
 * Welche Seltenheit eine Wirkung „wert ist", ist unsere Einschaetzung — das
 * Regelwerk kennt keine Formel dafuer (docs/magicitems.md). Die Eichung an
 * SRD-Gegenstaenden ist ein eigener Schritt (#143).
 */
import type { Paar, Seltenheit } from '@suite/srd';

export const ARTEN = [
  'waffe',
  'ruestung',
  'schild',
  'wundersam',
  'ring',
  'stab',
  'trank',
  'schriftrolle'
] as const;
export type Art = (typeof ARTEN)[number];

export const ART_NAME: Record<Art, Paar> = {
  waffe: { de: 'Waffe', en: 'Weapon' },
  ruestung: { de: 'Rüstung', en: 'Armor' },
  schild: { de: 'Schild', en: 'Shield' },
  wundersam: { de: 'Wundersamer Gegenstand', en: 'Wondrous Item' },
  ring: { de: 'Ring', en: 'Ring' },
  stab: { de: 'Zauberstab', en: 'Wand' },
  trank: { de: 'Trank', en: 'Potion' },
  schriftrolle: { de: 'Schriftrolle', en: 'Scroll' }
};

/** Ein Zeichen je Art, fuer die Kacheln. */
export const ART_ZEICHEN: Record<Art, string> = {
  waffe: '⚔',
  ruestung: '⛨',
  schild: '⛉',
  wundersam: '✧',
  ring: '◯',
  stab: '⚚',
  trank: '⚱',
  schriftrolle: '✉'
};

/** Verbraucht sich beim Benutzen (halber Wert nach dem SRD). */
export const VERBRAUCH: Record<Art, boolean> = {
  waffe: false,
  ruestung: false,
  schild: false,
  wundersam: false,
  ring: false,
  stab: false,
  trank: true,
  schriftrolle: true
};

export const STUFE: Record<Seltenheit, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  veryRare: 3,
  legendary: 4
};

/**
 * Eine Wirkung. `text` traegt Platzhalter, die der Erzeuger aus `werte`
 * fuellt: {bonus}, {schaden}, {art}, {zauber}, {ladungen}, {wurf}.
 */
export interface Wirkung {
  readonly id: string;
  readonly arten: readonly Art[];
  /** Ab dieser Seltenheit (Stufe 0 bis 4). */
  readonly ab: number;
  /** Bis zu dieser Seltenheit. */
  readonly bis: number;
  /** Braucht der Gegenstand Einstimmung, wenn er diese Wirkung traegt? */
  readonly einstimmung: boolean;
  readonly text: Paar;
  /**
   * Wie {bonus} aus der Seltenheit folgt. Ohne Angabe: Ungewoehnlich +1,
   * Selten +2, Sehr selten +3. `versatz: -1` fuer Ruestungen (Selten +1),
   * `fest` fuer einen Bonus, der nicht mitwaechst (Schutzumhang: immer +1).
   * Beides aus den Eichpunkten des SRD, siehe eichpunkte.ts.
   */
  readonly bonus?: { readonly versatz?: number; readonly fest?: number };
  /**
   * Nur als Beigabe, nie allein: eine Nebenwirkung ist kein Trank. Der
   * Erzeuger nimmt sie nur als zweite Wirkung dazu.
   */
  readonly zusatz?: boolean;
}

export const SCHADENSARTEN: readonly Paar[] = [
  { de: 'Feuer', en: 'Fire' },
  { de: 'Kälte', en: 'Cold' },
  { de: 'Blitz', en: 'Lightning' },
  { de: 'Säure', en: 'Acid' },
  { de: 'Gift', en: 'Poison' },
  { de: 'Schall', en: 'Thunder' },
  { de: 'Nekrotisch', en: 'Necrotic' },
  { de: 'Gleißend', en: 'Radiant' },
  { de: 'Psychisch', en: 'Psychic' }
];

export const KREATURENTYPEN: readonly Paar[] = [
  { de: 'Untote', en: 'Undead' },
  { de: 'Drachen', en: 'Dragons' },
  { de: 'Unholde', en: 'Fiends' },
  { de: 'Riesen', en: 'Giants' },
  { de: 'Aberrationen', en: 'Aberrations' },
  { de: 'Feenwesen', en: 'Fey' },
  { de: 'Monstrositäten', en: 'Monstrosities' },
  { de: 'Konstrukte', en: 'Constructs' }
];

export const ZUSTAENDE: readonly Paar[] = [
  { de: 'Verängstigt', en: 'Frightened' },
  { de: 'Bezaubert', en: 'Charmed' },
  { de: 'Vergiftet', en: 'Poisoned' },
  { de: 'Gelähmt', en: 'Paralyzed' },
  { de: 'Liegend', en: 'Prone' },
  { de: 'Festgesetzt', en: 'Restrained' }
];

/** Zauber je Grad, fuer Stab und Schriftrolle. Namen wie im SRD 5.2.1. */
export const ZAUBER: readonly (readonly Paar[])[] = [
  [
    { de: 'Feuerpfeil', en: 'Fire Bolt' },
    { de: 'Licht', en: 'Light' },
    { de: 'Magierhand', en: 'Mage Hand' }
  ],
  [
    { de: 'Magisches Geschoss', en: 'Magic Missile' },
    { de: 'Wunden heilen', en: 'Cure Wounds' },
    { de: 'Schild', en: 'Shield' },
    { de: 'Donnerwoge', en: 'Thunderwave' }
  ],
  [
    { de: 'Unsichtbarkeit', en: 'Invisibility' },
    { de: 'Nebelschritt', en: 'Misty Step' },
    { de: 'Person festhalten', en: 'Hold Person' }
  ],
  [
    { de: 'Feuerball', en: 'Fireball' },
    { de: 'Blitz', en: 'Lightning Bolt' },
    { de: 'Fliegen', en: 'Fly' },
    { de: 'Gegenzauber', en: 'Counterspell' }
  ],
  [
    { de: 'Verwandlung', en: 'Polymorph' },
    { de: 'Dimensionstür', en: 'Dimension Door' },
    { de: 'Eissturm', en: 'Ice Storm' }
  ],
  [
    { de: 'Kältekegel', en: 'Cone of Cold' },
    { de: 'Monster festhalten', en: 'Hold Monster' }
  ],
  [
    { de: 'Kettenblitz', en: 'Chain Lightning' },
    { de: 'Auflösung', en: 'Disintegrate' }
  ],
  [{ de: 'Teleportieren', en: 'Teleport' }],
  [{ de: 'Sonnenstrahl', en: 'Sunburst' }],
  [{ de: 'Wunsch', en: 'Wish' }]
];

export const WIRKUNGEN: readonly Wirkung[] = [
  // --- Waffen -------------------------------------------------------------
  {
    id: 'waffe-bonus',
    arten: ['waffe'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Du erhältst {bonus} auf Angriffs- und Schadenswürfe mit dieser magischen Waffe.',
      en: 'You gain a {bonus} bonus to attack rolls and damage rolls made with this magic weapon.'
    }
  },
  {
    id: 'waffe-element',
    arten: ['waffe'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Bei einem Treffer verursacht die Waffe zusätzlich {schaden} {art}schaden.',
      en: 'On a hit, the weapon deals an extra {schaden} {art} damage.'
    }
  },
  {
    id: 'waffe-bann',
    arten: ['waffe'],
    ab: 2,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Gegen {typ} verursacht die Waffe zusätzlich {schaden} Schaden der Waffenart.',
      en: 'Against {typ}, the weapon deals an extra {schaden} damage of the weapon’s type.'
    }
  },
  {
    id: 'waffe-rueckkehr',
    arten: ['waffe'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Nach einem Fernkampfangriff fliegt die Waffe sofort in deine Hand zurück.',
      en: 'Immediately after you make a ranged attack with it, the weapon flies back to your hand.'
    }
  },
  {
    id: 'waffe-licht',
    arten: ['waffe'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Auf ein Befehlswort gibt die Klinge helles Licht in 3 Metern und dämmriges Licht in weiteren 3 Metern ab.',
      en: 'On a command word, the weapon sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.'
    }
  },
  // --- Ruestung und Schild --------------------------------------------------
  {
    // Eine Ruestung +1 ist im SRD selten, +3 legendaer — eine Stufe teurer
    // als der Schild mit demselben Bonus.
    id: 'ruestung-bonus',
    arten: ['ruestung'],
    ab: 2,
    bis: 4,
    einstimmung: false,
    bonus: { versatz: -1 },
    text: {
      de: 'Solange du sie trägst, erhältst du {bonus} auf deine Rüstungsklasse.',
      en: 'You have a {bonus} bonus to Armor Class while wearing this armor.'
    }
  },
  {
    id: 'schild-bonus',
    arten: ['schild'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Solange du den Schild führst, erhältst du {bonus} auf deine Rüstungsklasse.',
      en: 'While holding this Shield, you have a {bonus} bonus to Armor Class.'
    }
  },
  {
    id: 'resistenz',
    arten: ['ruestung', 'schild', 'ring', 'wundersam'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Solange du ihn trägst, hast du Resistenz gegen {art}schaden.',
      en: 'You have Resistance to {art} damage while wearing it.'
    }
  },
  {
    id: 'ruestung-leise',
    arten: ['ruestung'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Die Rüstung verursacht keinen Nachteil bei Geschicklichkeitswürfen (Heimlichkeit).',
      en: 'The armor doesn’t impose Disadvantage on Dexterity (Stealth) checks.'
    }
  },
  {
    id: 'schild-geschosse',
    arten: ['schild'],
    ab: 2,
    bis: 2,
    einstimmung: true,
    text: {
      de: 'Trifft dich ein Fernkampfangriff, kannst du ihn als Reaktion auf dich statt auf ein Ziel neben dir lenken; du hast dabei +2 auf die RK.',
      en: 'When a ranged attack targets a creature near you, you can take a Reaction to become the target instead, with a +2 bonus to AC against it.'
    }
  },
  // --- Wundersames, Ringe ---------------------------------------------------
  {
    id: 'rettung-vorteil',
    arten: ['wundersam', 'ring'],
    ab: 1,
    bis: 2,
    einstimmung: true,
    text: {
      de: 'Du bist bei Rettungswürfen im Vorteil, um den Zustand {zustand} zu vermeiden oder zu beenden.',
      en: 'You have Advantage on saving throws to avoid or end the {zustand} condition.'
    }
  },
  {
    id: 'dunkelsicht',
    arten: ['wundersam', 'ring'],
    ab: 1,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Solange du ihn trägst, hast du Dunkelsicht auf 18 Meter.',
      en: 'While wearing it, you have Darkvision with a range of 60 feet.'
    }
  },
  {
    id: 'bewegung',
    arten: ['wundersam'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Deine Bewegungsrate steigt um 3 Meter.',
      en: 'Your Speed increases by 10 feet.'
    }
  },
  {
    // Stulpen der Ogerkraft und Stirnband des Intellekts sind ungewoehnlich,
    // das Amulett der Gesundheit selten.
    id: 'attribut',
    arten: ['wundersam'],
    ab: 1,
    bis: 2,
    einstimmung: true,
    text: {
      de: 'Dein {attribut}wert beträgt 19, solange du ihn trägst. Ist er ohnehin 19 oder höher, bewirkt er nichts.',
      en: 'Your {attribut} score is 19 while you wear it. It has no effect if your score is already 19 or higher.'
    }
  },
  {
    // Schutzumhang (ungewoehnlich) und Schutzring (selten) geben beide +1.
    id: 'rettung-bonus',
    arten: ['ring', 'wundersam'],
    ab: 1,
    bis: 2,
    einstimmung: true,
    bonus: { fest: 1 },
    text: {
      de: 'Du erhältst {bonus} auf Rettungswürfe und auf deine Rüstungsklasse.',
      en: 'You gain a {bonus} bonus to saving throws and to Armor Class.'
    }
  },
  {
    // Gefluegelte Stiefel sind ungewoehnlich — mit vier Stunden am Tag.
    id: 'fliegen',
    arten: ['wundersam', 'ring'],
    ab: 1,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Bis zu vier Stunden am Tag hast du eine Flugbewegungsrate, die deiner Bewegungsrate entspricht.',
      en: 'For up to 4 hours per day, you have a Fly Speed equal to your Speed.'
    }
  },
  {
    id: 'telepathie',
    arten: ['wundersam', 'ring'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Du kannst telepathisch mit jeder Kreatur im Umkreis von 18 Metern sprechen, die eine Sprache beherrscht.',
      en: 'You can communicate telepathically with any creature within 60 feet that knows a language.'
    }
  },
  {
    id: 'zauber-taeglich',
    arten: ['wundersam', 'ring'],
    ab: 1,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Einmal täglich kannst du damit {zauber} wirken. Die Fähigkeit lädt sich im Morgengrauen wieder auf.',
      en: 'Once per day, you can cast {zauber} from it. The property recharges at dawn.'
    }
  },
  // --- Zauberstab -----------------------------------------------------------
  {
    id: 'stab-ladungen',
    arten: ['stab'],
    ab: 1,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Der Stab hat {ladungen} Ladungen. Du kannst eine verbrauchen, um {zauber} zu wirken (Zauberrettungswurf-SG {wurf}). Im Morgengrauen erhält er 1W{ladungen} Ladungen zurück.',
      en: 'The wand has {ladungen} charges. You can expend 1 charge to cast {zauber} (save DC {wurf}). It regains 1d{ladungen} expended charges daily at dawn.'
    }
  },
  {
    id: 'stab-bonus',
    arten: ['stab'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Solange du ihn hältst, erhältst du {bonus} auf Zauberangriffswürfe und auf den SG deiner Zauber.',
      en: 'While holding it, you gain a {bonus} bonus to spell attack rolls and to the saving throw DCs of your spells.'
    }
  },
  // --- Traenke und Schriftrollen --------------------------------------------
  {
    id: 'trank-heilung',
    arten: ['trank'],
    ab: 0,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Wer den Trank trinkt, erhält {heilung} Trefferpunkte zurück.',
      en: 'You regain {heilung} Hit Points when you drink this potion.'
    }
  },
  {
    id: 'trank-resistenz',
    arten: ['trank'],
    ab: 1,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Eine Stunde lang hast du Resistenz gegen {art}schaden.',
      en: 'For 1 hour, you have Resistance to {art} damage.'
    }
  },
  {
    id: 'trank-fliegen',
    arten: ['trank'],
    ab: 3,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Eine Stunde lang hast du eine Flugbewegungsrate von 18 Metern und kannst schweben.',
      en: 'For 1 hour, you have a Fly Speed of 60 feet and can hover.'
    }
  },
  // --- Eigene Wirkungen -----------------------------------------------------
  //
  // Keine davon steht fuer einen Gegenstand des SRD; sie mischen dessen
  // Bausteine (Zustaende, Zauber, Schadensarten, Rettungswuerfe) neu. Der
  // Erzeuger sorgt dafuer, dass jeder Gegenstand mindestens eine davon
  // traegt — sonst kaeme ein Heiltrank mit neuem Namen heraus
  // (Rueckmeldung, siehe erzeuge.ts).
  {
    id: 'eigen-waffe-zustand',
    arten: ['waffe'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Triffst du eine Kreatur mit dieser Waffe, muss sie einen Konstitutionsrettungswurf (SG {wurf}) bestehen oder ist bis zum Ende ihres nächsten Zuges {zustand}. Danach erst wieder im Morgengrauen.',
      en: 'When you hit a creature with this weapon, it must succeed on a DC {wurf} Constitution saving throw or have the {zustand} condition until the end of its next turn. Once used, this property can’t be used again until the next dawn.'
    }
  },
  {
    id: 'eigen-waffe-krit',
    arten: ['waffe'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Bei einem kritischen Treffer mit dieser Waffe erleidet das Ziel zusätzlich {schaden} {art}schaden, und du erhältst Trefferpunkte in Höhe der Hälfte davon zurück.',
      en: 'When you score a Critical Hit with this weapon, the target takes an extra {schaden} {art} damage, and you regain Hit Points equal to half that damage.'
    }
  },
  {
    id: 'eigen-waffe-ladungen',
    arten: ['waffe'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Die Waffe hat {ladungen} Ladungen. Bei einem Treffer kannst du eine verbrauchen: das Ziel erleidet zusätzlich {schaden} {art}schaden und wird bis zu 3 Meter von dir weggestoßen. Im Morgengrauen kehren alle Ladungen zurück.',
      en: 'The weapon has {ladungen} charges. When you hit, you can expend 1 charge: the target takes an extra {schaden} {art} damage and is pushed up to 10 feet away from you. It regains all expended charges daily at dawn.'
    }
  },
  {
    id: 'eigen-waffe-wache',
    arten: ['waffe', 'ruestung', 'wundersam'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Solange du den Gegenstand trägst oder hältst, kannst du nicht überrascht werden und erhältst {bonus} auf Initiativewürfe.',
      en: 'While you wear or hold the item, you can’t be surprised, and you gain a {bonus} bonus to Initiative rolls.'
    }
  },
  {
    id: 'eigen-waffe-ernte',
    arten: ['waffe'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Bringst du eine Kreatur mit dieser Waffe auf 0 Trefferpunkte, erhältst du {tp} temporäre Trefferpunkte.',
      en: 'When you reduce a creature to 0 Hit Points with this weapon, you gain {tp} Temporary Hit Points.'
    }
  },
  {
    id: 'eigen-waffe-zauber',
    arten: ['waffe'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Als Magieaktion kannst du aus der Waffe {zauber} wirken (Rettungswurf-SG {wurf}). Danach erst wieder im Morgengrauen.',
      en: 'As a Magic action, you can cast {zauber} from the weapon (save DC {wurf}). Once used, this property can’t be used again until the next dawn.'
    }
  },
  {
    id: 'eigen-waffe-schatten',
    arten: ['waffe'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Im dämmrigen Licht oder in Dunkelheit bist du mit dieser Waffe bei Angriffen gegen Kreaturen im Vorteil, die dich nicht sehen können, und die Klinge wirft kein Licht zurück.',
      en: 'In Dim Light or Darkness, you have Advantage on attack rolls with this weapon against creatures that can’t see you, and the weapon reflects no light.'
    }
  },
  {
    id: 'eigen-waffe-ruf',
    arten: ['waffe'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Als Bonusaktion lässt du die Waffe summen. Verbündete im Umkreis von 9 Metern hören den Ton deutlich, auch durch eine geschlossene Tür.',
      en: 'As a Bonus Action, you can make the weapon hum. Allies within 30 feet hear it clearly, even through a closed door.'
    }
  },
  {
    id: 'eigen-waffe-rein',
    arten: ['waffe', 'ruestung', 'schild'],
    ab: 0,
    bis: 0,
    einstimmung: false,
    text: {
      de: 'Der Gegenstand rostet und verschmutzt nie; Blut und Schlamm perlen ab. Einmal täglich kann er Ausbessern auf sich selbst wirken.',
      en: 'The item never rusts or tarnishes, and blood and grime slide off it. Once per day, it can cast Mending on itself.'
    }
  },
  {
    id: 'eigen-waffe-spur',
    arten: ['waffe'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Hast du mit der Waffe in der letzten Stunde eine Kreatur getroffen, weißt du, in welcher Richtung sie sich befindet, solange sie höchstens 1,5 Kilometer entfernt ist.',
      en: 'If you hit a creature with this weapon within the last hour, you know the direction to that creature while it is within 1 mile of you.'
    }
  },
  {
    id: 'eigen-ruestung-vergeltung',
    arten: ['ruestung', 'schild'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Trifft dich eine Kreatur im Umkreis von 1,5 Metern mit einem Nahkampfangriff, kannst du als Reaktion {schaden} {art}schaden gegen sie auslösen.',
      en: 'When a creature within 5 feet of you hits you with a melee attack, you can take a Reaction to deal {schaden} {art} damage to it.'
    }
  },
  {
    id: 'eigen-zustand-immun',
    arten: ['ruestung', 'schild', 'ring', 'wundersam'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Solange du eingestimmt bist, kannst du nicht {zustand} werden.',
      en: 'While attuned to the item, you have Immunity to the {zustand} condition.'
    }
  },
  {
    id: 'eigen-rast-schutz',
    arten: ['ruestung', 'wundersam', 'ring'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Beendest du eine kurze Rast, erhältst du {tp} temporäre Trefferpunkte.',
      en: 'When you finish a Short Rest, you gain {tp} Temporary Hit Points.'
    }
  },
  {
    id: 'eigen-ruestung-schwimmen',
    arten: ['ruestung'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Du hast eine Schwimmbewegungsrate in Höhe deiner Bewegungsrate, und die Rüstung verursacht keinen Nachteil bei Heimlichkeit.',
      en: 'You have a Swim Speed equal to your Speed, and the armor doesn’t impose Disadvantage on Dexterity (Stealth) checks.'
    }
  },
  {
    id: 'eigen-schild-reaktion',
    arten: ['schild', 'ring'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Wirst du von einem Angriff getroffen, kannst du als Reaktion den Zauber Schild aus dem Gegenstand wirken. Danach erst wieder im Morgengrauen.',
      en: 'When you are hit by an attack roll, you can take a Reaction to cast Shield from the item. Once used, this property can’t be used again until the next dawn.'
    }
  },
  {
    id: 'eigen-schild-deckung',
    arten: ['schild'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Als Bonusaktion kannst du den Schild aufpflanzen. Bis du dich bewegst, haben du und ein Verbündeter neben dir halbe Deckung.',
      en: 'As a Bonus Action, you can plant the shield. Until you move, you and one ally adjacent to you have Half Cover.'
    }
  },
  {
    id: 'eigen-fertigkeit',
    arten: ['wundersam', 'ring', 'ruestung'],
    ab: 0,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Du bist bei Würfen auf {fertigkeit} im Vorteil.',
      en: 'You have Advantage on {fertigkeit} checks.'
    }
  },
  {
    id: 'eigen-sprachen',
    arten: ['wundersam', 'ring'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Du verstehst die wörtliche Bedeutung jeder gesprochenen Sprache, die du hörst.',
      en: 'You understand the literal meaning of any spoken language that you hear.'
    }
  },
  {
    id: 'eigen-licht',
    arten: ['wundersam', 'ring', 'schild', 'stab'],
    ab: 0,
    bis: 0,
    einstimmung: false,
    text: {
      de: 'Als Bonusaktion wirft der Gegenstand helles Licht im Radius von 3 Metern und dämmriges Licht weitere 3 Meter, oder er erlischt wieder. Das Licht hat eine Farbe deiner Wahl.',
      en: 'As a Bonus Action, the item sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet, or goes dark. The light is a color of your choice.'
    }
  },
  {
    id: 'eigen-tiere',
    arten: ['wundersam', 'ring', 'stab'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Einmal täglich kannst du aus dem Gegenstand Mit Tieren sprechen wirken.',
      en: 'Once per day, you can cast Speak with Animals from the item.'
    }
  },
  {
    id: 'eigen-speicher',
    arten: ['ring', 'wundersam', 'stab'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Der Gegenstand speichert einmal {zauber}. Du kannst den Zauber daraus wirken (Rettungswurf-SG {wurf}); wer ihn beherrscht, kann ihn wieder hineinwirken.',
      en: 'The item stores one casting of {zauber}. You can cast the spell from it (save DC {wurf}); anyone who knows the spell can cast it into the item to refill it.'
    }
  },
  {
    id: 'eigen-sprung',
    arten: ['wundersam', 'ring'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Als Bonusaktion kannst du dich bis zu 9 Meter weit an einen freien Ort teleportieren, den du sehen kannst. Das geht {mal}-mal, im Morgengrauen wieder so oft.',
      en: 'As a Bonus Action, you can teleport up to 30 feet to an unoccupied space you can see. You can do so {mal} times, regaining all uses daily at dawn.'
    }
  },
  {
    id: 'eigen-glueck',
    arten: ['wundersam', 'ring', 'waffe'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Scheitert ein W20-Test, kannst du ihn wiederholen und musst das neue Ergebnis nehmen. Danach erst wieder im Morgengrauen.',
      en: 'When you fail a D20 Test, you can reroll the die and must use the new roll. Once used, this property can’t be used again until the next dawn.'
    }
  },
  {
    id: 'eigen-warnung',
    arten: ['wundersam', 'waffe', 'ring'],
    ab: 1,
    bis: 2,
    einstimmung: true,
    text: {
      de: 'Nähert sich dir ein Wesen der Art {typ} auf 18 Meter, wird der Gegenstand warm. Du weißt dann nicht, wo es ist, aber dass es da ist.',
      en: 'When one of the {typ} comes within 60 feet of you, the item grows warm. You don’t learn where it is, only that it is near.'
    }
  },
  {
    id: 'eigen-atem',
    arten: ['wundersam', 'ring'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Wendest du bei einer kurzen Rast Trefferwürfel auf, erhältst du je Würfel 1 Trefferpunkt zusätzlich zurück.',
      en: 'When you spend Hit Point Dice during a Short Rest, you regain 1 additional Hit Point per die.'
    }
  },
  {
    id: 'eigen-konzentration',
    arten: ['wundersam', 'ring', 'stab'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Du bist bei Konstitutionsrettungswürfen im Vorteil, um die Konzentration auf einen Zauber aufrechtzuerhalten.',
      en: 'You have Advantage on Constitution saving throws that you make to maintain Concentration.'
    }
  },
  {
    id: 'eigen-kampfbeginn',
    arten: ['wundersam', 'ruestung', 'schild', 'ring'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Würfelst du Initiative, erhältst du {tp} temporäre Trefferpunkte.',
      en: 'When you roll Initiative, you gain {tp} Temporary Hit Points.'
    }
  },
  {
    id: 'eigen-abschuetteln',
    arten: ['wundersam', 'ring', 'ruestung'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Zu Beginn jedes deiner Züge kannst du den Zustand {zustand} bei dir beenden.',
      en: 'At the start of each of your turns, you can end the {zustand} condition on yourself.'
    }
  },
  {
    id: 'eigen-zauberabwehr',
    arten: ['wundersam', 'ring', 'schild'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Wirkt eine Kreatur, die du sehen kannst, einen Zauber auf dich, kannst du als Reaktion beim Rettungswurf dagegen im Vorteil sein.',
      en: 'When a creature you can see casts a spell that targets you, you can take a Reaction to give yourself Advantage on any saving throw against that spell.'
    }
  },
  {
    id: 'eigen-last',
    arten: ['wundersam', 'ring'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Deine Tragkraft verdoppelt sich, und du bist bei Stärkewürfen zum Schieben, Ziehen oder Heben im Vorteil.',
      en: 'Your carrying capacity doubles, and you have Advantage on Strength checks made to push, drag, or lift.'
    }
  },
  {
    id: 'eigen-schatten',
    arten: ['wundersam', 'ring'],
    ab: 2,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Als Magieaktion wirst du unsichtbar, bis du angreifst, einen Zauber wirkst oder dein nächster Zug endet. Das geht {mal}-mal, im Morgengrauen wieder so oft.',
      en: 'As a Magic action, you become Invisible until you attack, cast a spell, or your next turn ends. You can do so {mal} times, regaining all uses daily at dawn.'
    }
  },
  {
    id: 'eigen-stab-verstaerkung',
    arten: ['stab'],
    ab: 2,
    bis: 4,
    einstimmung: true,
    text: {
      de: 'Der Stab hat {ladungen} Ladungen. Wirkst du einen Zauber ab Grad 1, kannst du eine verbrauchen, damit ein Ziel des Zaubers zusätzlich {schaden} {art}schaden erleidet. Im Morgengrauen kehren alle Ladungen zurück.',
      en: 'The wand has {ladungen} charges. When you cast a spell of level 1 or higher, you can expend 1 charge to deal an extra {schaden} {art} damage to one target of the spell. It regains all expended charges daily at dawn.'
    }
  },
  {
    id: 'eigen-stab-trick',
    arten: ['stab'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Solange du ihn hältst, kennst du einen Zaubertrick deiner Wahl von der Liste der Magier. Im Morgengrauen kannst du ihn tauschen.',
      en: 'While holding it, you know one cantrip of your choice from the Wizard spell list. You can change the cantrip at dawn.'
    }
  },
  {
    id: 'eigen-stab-zwang',
    arten: ['stab'],
    ab: 1,
    bis: 3,
    einstimmung: true,
    text: {
      de: 'Der Stab hat {ladungen} Ladungen. Besteht eine Kreatur den Rettungswurf gegen einen deiner Zauber, kannst du eine verbrauchen und sie zum Wiederholen zwingen. Im Morgengrauen kehren alle Ladungen zurück.',
      en: 'The wand has {ladungen} charges. When a creature succeeds on a saving throw against one of your spells, you can expend 1 charge to force it to reroll. It regains all expended charges daily at dawn.'
    }
  },
  {
    id: 'eigen-trank-dunkelsicht',
    arten: ['trank'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Acht Stunden lang hast du Dunkelsicht auf 18 Meter.',
      en: 'For 8 hours, you have Darkvision with a range of 60 feet.'
    }
  },
  {
    id: 'eigen-trank-reinigung',
    arten: ['trank'],
    ab: 0,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Der Trank beendet bei dir den Zustand {zustand}. Eine Stunde lang bist du bei Rettungswürfen dagegen im Vorteil.',
      en: 'Drinking it ends the {zustand} condition on you, and for 1 hour you have Advantage on saving throws against it.'
    }
  },
  {
    id: 'eigen-trank-attribut',
    arten: ['trank'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Eine Stunde lang bist du bei Würfen und Rettungswürfen auf {attribut} im Vorteil.',
      en: 'For 1 hour, you have Advantage on {attribut} checks and saving throws.'
    }
  },
  {
    id: 'eigen-trank-tiere',
    arten: ['trank'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Eine Stunde lang kannst du mit Tieren sprechen, als wirktest du Mit Tieren sprechen.',
      en: 'For 1 hour, you can communicate with Beasts as if you had cast Speak with Animals.'
    }
  },
  {
    id: 'eigen-trank-sprung',
    arten: ['trank'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Eine Minute lang verdreifacht sich deine Sprungweite, und du erleidest keinen Fallschaden.',
      en: 'For 1 minute, your jump distance is tripled, and you take no damage from falling.'
    }
  },
  {
    id: 'eigen-trank-mut',
    arten: ['trank'],
    ab: 1,
    bis: 2,
    einstimmung: false,
    text: {
      de: 'Eine Minute lang kannst du nicht verängstigt werden und erhältst zu Beginn jedes deiner Züge 5 temporäre Trefferpunkte.',
      en: 'For 1 minute, you can’t be Frightened, and you gain 5 Temporary Hit Points at the start of each of your turns.'
    }
  },
  {
    id: 'eigen-trank-waffe',
    arten: ['trank'],
    ab: 1,
    bis: 3,
    einstimmung: false,
    text: {
      de: 'Eine Minute lang verursachen deine Waffenangriffe bei einem Treffer zusätzlich {schaden} {art}schaden.',
      en: 'For 1 minute, your weapon attacks deal an extra {schaden} {art} damage on a hit.'
    }
  },
  {
    id: 'eigen-trank-wasser',
    arten: ['trank'],
    ab: 0,
    bis: 1,
    einstimmung: false,
    text: {
      de: 'Eine Stunde lang kannst du unter Wasser atmen und hast eine Schwimmbewegungsrate in Höhe deiner Bewegungsrate.',
      en: 'For 1 hour, you can breathe underwater and have a Swim Speed equal to your Speed.'
    }
  },
  {
    id: 'eigen-trank-standhaft',
    arten: ['trank'],
    ab: 3,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Eine Minute lang hast du Resistenz gegen alle Schadensarten und kannst weder bezaubert noch verängstigt werden.',
      en: 'For 1 minute, you have Resistance to all damage, and you can’t be Charmed or Frightened.'
    }
  },
  {
    id: 'eigen-trank-wiederkehr',
    arten: ['trank'],
    ab: 4,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Fällst du in den nächsten 24 Stunden auf 0 Trefferpunkte, sinkst du stattdessen auf 1 und erhältst {heilung} Trefferpunkte zurück. Danach endet die Wirkung.',
      en: 'If you drop to 0 Hit Points within the next 24 hours, you drop to 1 Hit Point instead and regain {heilung} Hit Points. The effect then ends.'
    }
  },
  {
    id: 'eigen-trank-zeit',
    arten: ['trank'],
    ab: 3,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Eine Minute lang ist deine Bewegungsrate verdoppelt, du erhältst +2 auf die RK und kannst in jedem Zug eine zusätzliche Aktion für Angreifen (ein Angriff), Spurt, Rückzug, Verstecken oder Gegenstand benutzen ausführen.',
      en: 'For 1 minute, your Speed is doubled, you gain a +2 bonus to AC, and on each of your turns you can take one additional action to Attack (one attack only), Dash, Disengage, Hide, or Utilize.'
    }
  },
  {
    id: 'eigen-trank-leuchten',
    zusatz: true,
    arten: ['trank'],
    ab: 0,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Nebenwirkung: Eine Stunde lang leuchtet deine Haut schwach (dämmriges Licht im Radius von 1,5 Metern).',
      en: 'Side effect: For 1 hour, your skin glows faintly, shedding Dim Light in a 5-foot radius.'
    }
  },
  {
    id: 'eigen-trank-stimme',
    zusatz: true,
    arten: ['trank'],
    ab: 0,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Nebenwirkung: Eine Stunde lang klingt deine Stimme tief und hallend; du bist bei Täuschungswürfen im Nachteil, bei Einschüchterungswürfen im Vorteil.',
      en: 'Side effect: For 1 hour, your voice is deep and echoing; you have Disadvantage on Charisma (Deception) checks and Advantage on Charisma (Intimidation) checks.'
    }
  },
  {
    id: 'eigen-rolle-jeder',
    arten: ['schriftrolle'],
    ab: 0,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Jede Kreatur kann den Zauber aus der Schriftrolle wirken. Wer ihn nicht auf der eigenen Zauberliste hat, muss dafür einen Intelligenzwurf (SG {wurf}) bestehen, sonst zerfällt die Rolle wirkungslos.',
      en: 'Any creature can cast the spell from this scroll. A creature that doesn’t have the spell on its spell list must succeed on a DC {wurf} Intelligence check, or the scroll crumbles without effect.'
    }
  },
  {
    id: 'eigen-rolle-spur',
    zusatz: true,
    arten: ['schriftrolle'],
    ab: 0,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Die Tinte glüht schwach, solange sich ein Wesen der Art {typ} im Umkreis von 18 Metern befindet.',
      en: 'The ink glows faintly while one of the {typ} is within 60 feet of the scroll.'
    }
  },
  {
    id: 'eigen-rolle-stark',
    arten: ['schriftrolle'],
    ab: 1,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Aus dieser Rolle gewirkt, hat der Zauber einen Rettungswurf-SG von {wurf}, und sein Schaden übergeht Resistenz.',
      en: 'When cast from this scroll, the spell has a save DC of {wurf}, and its damage ignores Resistance.'
    }
  },
  {
    id: 'schriftrolle-zauber',
    arten: ['schriftrolle'],
    ab: 0,
    bis: 4,
    einstimmung: false,
    text: {
      de: 'Die Schriftrolle enthält den Zauber {zauber} (Grad {grad}). Nach dem Wirken zerfällt sie zu Staub.',
      en: 'The scroll holds the spell {zauber} (level {grad}). Once cast, it crumbles to dust.'
    }
  }
];

/**
 * Nachteile, die man dazuwuerfeln kann. Ein Fluch macht einen Gegenstand
 * leichter, nicht schwerer (docs/magicitems.md).
 */
export const FLUECHE: readonly Paar[] = [
  {
    de: 'Fluch: Du kannst dich nicht freiwillig von dem Gegenstand trennen, bis der Fluch gebrochen wird.',
    en: 'Curse: You are unwilling to part with the item until the curse is broken.'
  },
  {
    de: 'Fluch: Solange du eingestimmt bist, bist du bei Weisheitsrettungswürfen im Nachteil.',
    en: 'Curse: While attuned, you have Disadvantage on Wisdom saving throws.'
  },
  {
    de: 'Fluch: Jede Nacht flüstert der Gegenstand; nach einer langen Rast erhältst du eine Stufe Erschöpfung, wenn du einen Konstitutionsrettungswurf (SG 12) nicht bestehst.',
    en: 'Curse: The item whispers at night; after a Long Rest, you gain 1 Exhaustion level unless you succeed on a DC 12 Constitution saving throw.'
  },
  {
    de: 'Fluch: Du bist gegenüber {art}schaden verwundbar, solange du eingestimmt bist.',
    en: 'Curse: While attuned, you have Vulnerability to {art} damage.'
  },
  {
    de: 'Fluch: Wesen der Art {typ} spüren dich auf 18 Meter und sind dir gegenüber stets feindselig.',
    en: 'Curse: The {typ} can sense you within 60 feet and are always hostile toward you.'
  },
  {
    de: 'Fluch: Bei einer gewürfelten 1 auf einen Angriffswurf bist du bis zum Ende deines nächsten Zuges {zustand}.',
    en: 'Curse: When you roll a 1 on an attack roll, you have the {zustand} condition until the end of your next turn.'
  },
  {
    de: 'Fluch: Du kannst keine Heilung durch Zauber erhalten, solange du den Gegenstand trägst; Tränke wirken normal.',
    en: 'Curse: While you carry the item, you can’t regain Hit Points from spells; potions work normally.'
  },
  {
    de: 'Fluch: Der Gegenstand verlangt Blut. Nach jeder langen Rast verlierst du 1W6 Trefferpunkte, die du erst nach der nächsten langen Rast zurückgewinnen kannst.',
    en: 'Curse: The item demands blood. After each Long Rest, you lose 1d6 Hit Points that you can’t regain until your next Long Rest.'
  },
  {
    de: 'Fluch: Deine Stimme wird zu einem Flüstern. Du kannst keine Zauber mit verbaler Komponente wirken, die lauter als ein Flüstern sein müssen, und bist bei Überzeugungswürfen im Nachteil.',
    en: 'Curse: Your voice fades to a whisper. You have Disadvantage on Charisma (Persuasion) checks, and creatures more than 10 feet away can’t hear you speak.'
  },
  {
    de: 'Fluch: Tiere meiden dich. Reittiere und Vertraute werden in deiner Nähe unruhig, und du bist bei Würfen auf Mit Tieren umgehen im Nachteil.',
    en: 'Curse: Beasts shun you. Mounts and familiars grow restless near you, and you have Disadvantage on Wisdom (Animal Handling) checks.'
  },
  {
    de: 'Fluch: Einmal am Tag, zu einem Zeitpunkt nach Wahl der Spielleitung, spricht der Gegenstand laut einen Satz, der deinen Standort verrät.',
    en: 'Curse: Once per day, at a time of the GM’s choice, the item speaks a sentence aloud that gives away your location.'
  },
  {
    de: 'Fluch: Du verlierst die Fähigkeit, im Dunkeln zu sehen. Hast du Dunkelsicht, fällt sie weg, solange du eingestimmt bist.',
    en: 'Curse: While attuned, you lose Darkvision if you have it, and Dim Light counts as Darkness for you.'
  }
];

/** Fertigkeiten des SRD 5.2.1, fuer {fertigkeit}. */
export const FERTIGKEITEN: readonly Paar[] = [
  { de: 'Athletik', en: 'Strength (Athletics)' },
  { de: 'Akrobatik', en: 'Dexterity (Acrobatics)' },
  { de: 'Fingerfertigkeit', en: 'Dexterity (Sleight of Hand)' },
  { de: 'Heimlichkeit', en: 'Dexterity (Stealth)' },
  { de: 'Arkane Kunde', en: 'Intelligence (Arcana)' },
  { de: 'Geschichte', en: 'Intelligence (History)' },
  { de: 'Nachforschungen', en: 'Intelligence (Investigation)' },
  { de: 'Naturkunde', en: 'Intelligence (Nature)' },
  { de: 'Religion', en: 'Intelligence (Religion)' },
  { de: 'Mit Tieren umgehen', en: 'Wisdom (Animal Handling)' },
  { de: 'Motiv erkennen', en: 'Wisdom (Insight)' },
  { de: 'Heilkunde', en: 'Wisdom (Medicine)' },
  { de: 'Wahrnehmung', en: 'Wisdom (Perception)' },
  { de: 'Überlebenskunst', en: 'Wisdom (Survival)' },
  { de: 'Täuschen', en: 'Charisma (Deception)' },
  { de: 'Einschüchtern', en: 'Charisma (Intimidation)' },
  { de: 'Auftreten', en: 'Charisma (Performance)' },
  { de: 'Überzeugen', en: 'Charisma (Persuasion)' }
];

export const ATTRIBUTE: readonly Paar[] = [
  { de: 'Stärke', en: 'Strength' },
  { de: 'Geschicklichkeit', en: 'Dexterity' },
  { de: 'Konstitution', en: 'Constitution' },
  { de: 'Intelligenz', en: 'Intelligence' },
  { de: 'Weisheit', en: 'Wisdom' },
  { de: 'Charisma', en: 'Charisma' }
];

/** Grundwoerter fuer Namen, je Art. */
export const GRUNDWORT: Record<Art, readonly Paar[]> = {
  waffe: [
    { de: 'Klinge', en: 'Blade' },
    { de: 'Axt', en: 'Axe' },
    { de: 'Speer', en: 'Spear' },
    { de: 'Bogen', en: 'Bow' },
    { de: 'Hammer', en: 'Hammer' },
    { de: 'Dolch', en: 'Dagger' },
    { de: 'Sichel', en: 'Sickle' },
    { de: 'Morgenstern', en: 'Morningstar' },
    { de: 'Armbrust', en: 'Crossbow' },
    { de: 'Säbel', en: 'Sabre' }
  ],
  ruestung: [
    { de: 'Harnisch', en: 'Harness' },
    { de: 'Kettenhemd', en: 'Mail' },
    { de: 'Lederwams', en: 'Jerkin' }
  ],
  schild: [
    { de: 'Schild', en: 'Shield' },
    { de: 'Tartsche', en: 'Buckler' }
  ],
  wundersam: [
    { de: 'Amulett', en: 'Amulet' },
    { de: 'Umhang', en: 'Cloak' },
    { de: 'Stiefel', en: 'Boots' },
    { de: 'Gürtel', en: 'Belt' },
    { de: 'Brosche', en: 'Brooch' },
    { de: 'Handschuhe', en: 'Gloves' },
    { de: 'Laterne', en: 'Lantern' },
    { de: 'Maske', en: 'Mask' },
    { de: 'Kompass', en: 'Compass' },
    { de: 'Spieluhr', en: 'Music Box' },
    { de: 'Feder', en: 'Quill' },
    { de: 'Glocke', en: 'Bell' }
  ],
  ring: [
    { de: 'Ring', en: 'Ring' },
    { de: 'Siegelring', en: 'Signet' }
  ],
  stab: [
    { de: 'Zauberstab', en: 'Wand' },
    { de: 'Rute', en: 'Rod' }
  ],
  trank: [
    { de: 'Trank', en: 'Potion' },
    { de: 'Elixier', en: 'Elixir' },
    { de: 'Tinktur', en: 'Tincture' },
    { de: 'Sud', en: 'Draught' }
  ],
  schriftrolle: [{ de: 'Schriftrolle', en: 'Scroll' }]
};

/** Beinamen: „… des Morgenrots" / „… of Dawn". */
export const BEINAME: readonly Paar[] = [
  { de: 'des Morgenrots', en: 'of Dawn' },
  { de: 'der Stille', en: 'of Silence' },
  { de: 'des Wächters', en: 'of the Warden' },
  { de: 'der Tiefe', en: 'of the Deep' },
  { de: 'des Sturms', en: 'of the Storm' },
  { de: 'der Asche', en: 'of Ashes' },
  { de: 'des Wanderers', en: 'of the Wanderer' },
  { de: 'der letzten Wacht', en: 'of the Last Watch' },
  { de: 'des Nebels', en: 'of Mist' },
  { de: 'der Königin', en: 'of the Queen' },
  { de: 'des Grauen Pilgers', en: 'of the Grey Pilgrim' },
  { de: 'der Sieben Glocken', en: 'of the Seven Bells' },
  { de: 'des Verlorenen Mondes', en: 'of the Lost Moon' },
  { de: 'der Salzhexe', en: 'of the Salt Witch' },
  { de: 'des Eisernen Eides', en: 'of the Iron Oath' },
  { de: 'der Glut', en: 'of Embers' },
  { de: 'des Fährmanns', en: 'of the Ferryman' },
  { de: 'der Dornenkrone', en: 'of the Thorn Crown' },
  { de: 'des Schweigenden Chors', en: 'of the Silent Choir' },
  { de: 'der Sternwarte', en: 'of the Observatory' }
];
