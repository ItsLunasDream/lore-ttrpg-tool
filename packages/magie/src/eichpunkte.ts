/**
 * Eichpunkte: Gegenstaende aus dem SRD 5.2.1, an denen die Wirkungen dieses
 * Werkzeugs gemessen werden.
 *
 * DIESE DATEI IST ERZEUGT (packages/srd/werkzeug/gegenstaende_eichung.py).
 * Welcher Gegenstand fuer welche Wirkung steht, ist von Hand gewaehlt;
 * Seltenheit, Bonus und Heilformel sind aus dem PDF gelesen. Der Test
 * packages/magie/tests/eichung.test.mjs prueft den Erzeuger daran.
 */

export interface Eichpunkt {
  readonly wirkung: string;
  /** Der Name im englischen SRD. */
  readonly name: string;
  readonly seltenheit: 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';
  readonly bonus?: number;
  readonly formel?: string;
}

export const EICHPUNKTE: readonly Eichpunkt[] = [
  {
    "wirkung": "waffe-bonus",
    "name": "Weapon, +1, +2, or +3 (+1)",
    "seltenheit": "uncommon",
    "bonus": 1
  },
  {
    "wirkung": "waffe-bonus",
    "name": "Weapon, +1, +2, or +3 (+2)",
    "seltenheit": "rare",
    "bonus": 2
  },
  {
    "wirkung": "waffe-bonus",
    "name": "Weapon, +1, +2, or +3 (+3)",
    "seltenheit": "veryRare",
    "bonus": 3
  },
  {
    "wirkung": "ruestung-bonus",
    "name": "Armor, +1, +2, or +3 (+1)",
    "seltenheit": "rare",
    "bonus": 1
  },
  {
    "wirkung": "ruestung-bonus",
    "name": "Armor, +1, +2, or +3 (+2)",
    "seltenheit": "veryRare",
    "bonus": 2
  },
  {
    "wirkung": "ruestung-bonus",
    "name": "Armor, +1, +2, or +3 (+3)",
    "seltenheit": "legendary",
    "bonus": 3
  },
  {
    "wirkung": "schild-bonus",
    "name": "Shield, +1, +2, or +3 (+1)",
    "seltenheit": "uncommon",
    "bonus": 1
  },
  {
    "wirkung": "schild-bonus",
    "name": "Shield, +1, +2, or +3 (+2)",
    "seltenheit": "rare",
    "bonus": 2
  },
  {
    "wirkung": "schild-bonus",
    "name": "Shield, +1, +2, or +3 (+3)",
    "seltenheit": "veryRare",
    "bonus": 3
  },
  {
    "wirkung": "stab-bonus",
    "name": "Wand of the War Mage, +1, +2, or +3 (+1)",
    "seltenheit": "uncommon",
    "bonus": 1
  },
  {
    "wirkung": "stab-bonus",
    "name": "Wand of the War Mage, +1, +2, or +3 (+2)",
    "seltenheit": "rare",
    "bonus": 2
  },
  {
    "wirkung": "stab-bonus",
    "name": "Wand of the War Mage, +1, +2, or +3 (+3)",
    "seltenheit": "veryRare",
    "bonus": 3
  },
  {
    "wirkung": "rettung-bonus",
    "name": "Cloak of Protection",
    "seltenheit": "uncommon",
    "bonus": 1
  },
  {
    "wirkung": "rettung-bonus",
    "name": "Ring of Protection",
    "seltenheit": "rare",
    "bonus": 1
  },
  {
    "wirkung": "attribut",
    "name": "Gauntlets of Ogre Power",
    "seltenheit": "uncommon"
  },
  {
    "wirkung": "attribut",
    "name": "Headband of Intellect",
    "seltenheit": "uncommon"
  },
  {
    "wirkung": "attribut",
    "name": "Amulet of Health",
    "seltenheit": "rare"
  },
  {
    "wirkung": "resistenz",
    "name": "Armor of Resistance",
    "seltenheit": "rare"
  },
  {
    "wirkung": "resistenz",
    "name": "Ring of Resistance",
    "seltenheit": "rare"
  },
  {
    "wirkung": "trank-resistenz",
    "name": "Potion of Resistance",
    "seltenheit": "uncommon"
  },
  {
    "wirkung": "dunkelsicht",
    "name": "Goggles of Night",
    "seltenheit": "uncommon"
  },
  {
    "wirkung": "fliegen",
    "name": "Winged Boots",
    "seltenheit": "uncommon"
  },
  {
    "wirkung": "fliegen",
    "name": "Wings of Flying",
    "seltenheit": "rare"
  },
  {
    "wirkung": "trank-fliegen",
    "name": "Potion of Flying",
    "seltenheit": "veryRare"
  },
  {
    "wirkung": "waffe-element",
    "name": "Flame Tongue",
    "seltenheit": "rare"
  },
  {
    "wirkung": "waffe-bann",
    "name": "Dragon Slayer",
    "seltenheit": "rare"
  },
  {
    "wirkung": "waffe-bann",
    "name": "Giant Slayer",
    "seltenheit": "rare"
  },
  {
    "wirkung": "trank-heilung",
    "name": "Potion of Healing (Common)",
    "seltenheit": "common",
    "formel": "2d4 + 2"
  },
  {
    "wirkung": "trank-heilung",
    "name": "Potion of Healing (Uncommon)",
    "seltenheit": "uncommon",
    "formel": "4d4 + 4"
  },
  {
    "wirkung": "trank-heilung",
    "name": "Potion of Healing (Rare)",
    "seltenheit": "rare",
    "formel": "8d4 + 8"
  },
  {
    "wirkung": "trank-heilung",
    "name": "Potion of Healing (Very Rare)",
    "seltenheit": "veryRare",
    "formel": "10d4 + 20"
  }
];
