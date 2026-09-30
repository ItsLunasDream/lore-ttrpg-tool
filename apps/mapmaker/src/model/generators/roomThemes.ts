/**
 * Raumthemen für den Dungeon-Generator.
 *
 * Ein Dungeon, dessen Räume gleichmäßig mit Schutt und Knochen bestreut sind,
 * sieht aus wie ein Grundriss mit Rauschen darauf. Was einen Raum erzählbar
 * macht, ist die *Kombination*: ein langer Tisch mit Stühlen ist ein
 * Speisesaal, Fässer und Töpfe daneben sind die Küche dazu — und dass beides
 * nebeneinander liegt, ist die eigentliche Aussage.
 *
 * Deshalb zwei Dinge hier und nicht im Generator:
 *
 * 1. **Möbel haben Plätze, nicht Koordinaten.** Ein Tisch steht mittig,
 *    Stühle stehen um ihn herum, Regale und Fässer an der Wand, Kleinkram
 *    irgendwo. Zufällig verteilt sähe auch ein Speisesaal nach Lagerraum aus.
 * 2. **Räume kennen ihre Nachbarn.** Jede Raumart nennt, was gut neben ihr
 *    liegt; der Generator vergibt die Arten entlang des Korridor-Graphen und
 *    greift bevorzugt in diese Liste. So entsteht die Küche neben dem
 *    Speisesaal, statt dass beides zufällig über die Karte verstreut wird.
 */

import type { Rng } from '../rng';

export type DungeonTheme = 'none' | 'random' | 'plain' | 'castle' | 'temple' | 'crypt';

/** Themen, die sich auswählen lassen — 'none' und 'random' sind Sonderfälle. */
export const DUNGEON_THEMES: DungeonTheme[] = ['none', 'random', 'plain', 'castle', 'temple', 'crypt'];

export interface RoomKind {
  id: string;
  /** Schlüssel im Wörterbuch; die Namen sind Oberfläche. */
  nameKey: string;
  /** Ein großes Möbel in der Raummitte; leer heißt: keins. */
  center: string[];
  /** Was sich um das mittige Möbel gruppiert — Stühle um den Tisch. */
  around: string[];
  /** Was an der Wand steht. */
  walls: string[];
  /** Kleinkram, überall. */
  scatter: string[];
  /** Raumarten, die gut daneben liegen. */
  neighbours: string[];
  /** Fackel- oder Kerzenlicht in diesem Raum, 0–1. */
  lit: number;
}

/**
 * Alle Raumarten, nach Thema.
 *
 * `neighbours` verweist nur innerhalb desselben Themas — eine Krypta neben
 * einer Schlossküche wäre ein Zufall, kein Zusammenhang.
 */
export const ROOM_KINDS: Record<Exclude<DungeonTheme, 'none' | 'random'>, RoomKind[]> = {
  plain: [
    {
      id: 'storage',
      nameKey: 'room.storage',
      center: [],
      around: [],
      walls: ['crate', 'barrel', 'hay'],
      scatter: ['pottery', 'rubble'],
      neighbours: ['storage', 'rubbleRoom', 'dKitchen', 'dCistern', 'dSmithy'],
      lit: 0.35,
    },
    {
      id: 'rubbleRoom',
      nameKey: 'room.rubble',
      center: [],
      around: [],
      walls: ['rubble', 'stone_medium'],
      scatter: ['rubble', 'bones', 'web', 'stone_small'],
      neighbours: ['rubbleRoom', 'storage', 'empty', 'dCollapsed', 'dSpider'],
      lit: 0.15,
    },
    {
      id: 'empty',
      nameKey: 'room.empty',
      center: [],
      around: [],
      walls: [],
      scatter: ['rubble', 'web'],
      neighbours: ['rubbleRoom', 'storage', 'dStairs', 'dTrap'],
      lit: 0.25,
    },
    // Rückmeldung: „genau drei Raumtypen: Storage, Rubble Room, Empty Room.
    // Mindestens 20." Das voreingestellte Thema hatte wirklich nur diese drei.
    {
      id: 'dDining',
      nameKey: 'room.diningHall',
      center: ['dining_set', 'table_rect', 'table_long'],
      around: ['chair'],
      walls: ['barrel', 'bench', 'banner', 'cupboard', 'wine_rack'],
      scatter: ['pottery', 'rug'],
      neighbours: ['dKitchen', 'storage', 'dBarracks'],
      lit: 0.85,
    },
    {
      id: 'dKitchen',
      nameKey: 'room.kitchen',
      center: ['cookfire', 'stove'],
      around: ['stool'],
      walls: ['barrel', 'shelf_crates', 'sacks', 'crate', 'pantry_shelf', 'cupboard'],
      scatter: ['pottery', 'woodpile'],
      neighbours: ['dDining', 'storage', 'dCistern'],
      lit: 0.8,
    },
    {
      id: 'dTrap',
      nameKey: 'room.trap',
      center: ['spike_pit', 'pit'],
      around: ['pressure_plate'],
      walls: ['lever', 'skeleton'],
      scatter: ['bones', 'beartrap', 'pressure_plate', 'bloodstain'],
      neighbours: ['dTreasure', 'empty', 'dTomb'],
      lit: 0.1,
    },
    {
      id: 'dRitual',
      nameKey: 'room.ritual',
      center: ['rune_circle'],
      around: ['candelabra', 'candles'],
      walls: ['brazier', 'statue', 'tapestry'],
      scatter: ['blood_pool', 'skull', 'bloodstain', 'scroll'],
      neighbours: ['dShrine', 'dLibrary', 'dPortal'],
      lit: 0.9,
    },
    {
      id: 'dPrison',
      nameKey: 'room.prison',
      center: [],
      around: [],
      walls: ['cage', 'chains', 'bedroll'],
      scatter: ['bones', 'skull', 'bloodstain', 'pottery'],
      neighbours: ['dTorture', 'dGuard'],
      lit: 0.3,
    },
    {
      id: 'dTorture',
      nameKey: 'room.torture',
      center: ['torture_rack'],
      around: ['brazier'],
      walls: ['chains', 'cage', 'weapon_rack', 'iron_maiden'],
      scatter: ['bloodstain', 'blood_pool', 'bones'],
      neighbours: ['dPrison', 'dGuard'],
      lit: 0.7,
    },
    {
      id: 'dGuard',
      nameKey: 'room.guard',
      center: ['table_round'],
      around: ['stool'],
      walls: ['weapon_rack', 'armour_stand', 'barrel', 'wall_torch'],
      scatter: ['bedroll', 'pottery'],
      neighbours: ['dBarracks', 'dPrison', 'dArmoury'],
      lit: 0.85,
    },
    {
      id: 'dBarracks',
      nameKey: 'room.barracks',
      center: [],
      around: [],
      walls: ['bed', 'bunk_bed', 'bedroll', 'chest', 'wardrobe'],
      scatter: ['bedroll', 'pottery', 'rug'],
      neighbours: ['dGuard', 'dDining', 'dArmoury'],
      lit: 0.6,
    },
    {
      id: 'dArmoury',
      nameKey: 'room.armoury',
      center: [],
      around: [],
      walls: ['weapon_rack', 'armour_stand', 'weapons', 'shield', 'crate'],
      scatter: ['weapons'],
      neighbours: ['dGuard', 'dSmithy'],
      lit: 0.5,
    },
    {
      id: 'dAlchemy',
      nameKey: 'room.alchemy',
      center: ['alchemy_table'],
      around: ['stool'],
      walls: ['potion_shelf', 'bookshelf', 'cauldron'],
      scatter: ['pottery', 'books', 'crystals'],
      neighbours: ['dLibrary', 'storage', 'dStudy'],
      lit: 0.85,
    },
    {
      id: 'dLibrary',
      nameKey: 'room.library',
      center: ['table_rect'],
      around: ['chair'],
      walls: ['bookshelf', 'bookshelf', 'lectern'],
      scatter: ['books', 'scroll'],
      neighbours: ['dStudy', 'dAlchemy', 'dRitual'],
      lit: 0.85,
    },
    {
      id: 'dStudy',
      nameKey: 'room.study',
      center: ['desk'],
      around: ['chair'],
      walls: ['bookshelf', 'map_table', 'chest', 'globe'],
      scatter: ['scroll', 'books', 'rug'],
      neighbours: ['dLibrary', 'dTreasure'],
      lit: 0.8,
    },
    {
      id: 'dTreasure',
      nameKey: 'room.treasure',
      center: ['chest_open'],
      around: ['chest'],
      walls: ['chest', 'statue', 'treasure_pile'],
      scatter: ['coins', 'gems'],
      neighbours: ['dTrap', 'dStudy', 'dThrone'],
      lit: 0.4,
    },
    {
      id: 'dCistern',
      nameKey: 'room.cistern',
      center: ['well'],
      around: [],
      walls: ['barrel', 'trough'],
      scatter: ['puddle', 'pottery'],
      neighbours: ['dKitchen', 'storage', 'dMushroom'],
      lit: 0.2,
    },
    {
      id: 'dSmithy',
      nameKey: 'room.smithy',
      center: ['anvil'],
      around: ['grindstone'],
      walls: ['forge', 'woodpile', 'weapon_rack'],
      scatter: ['weapons', 'crate'],
      neighbours: ['dArmoury', 'storage'],
      lit: 0.9,
    },
    {
      id: 'dMushroom',
      nameKey: 'room.mushroom',
      center: ['giant_mushroom'],
      around: [],
      walls: ['mushrooms_glowing', 'mushrooms'],
      scatter: ['mushrooms', 'mushrooms_glowing', 'puddle'],
      neighbours: ['dSpider', 'dCistern'],
      lit: 0.15,
    },
    {
      id: 'dSpider',
      nameKey: 'room.spider',
      center: ['web_sac'],
      around: [],
      walls: ['web'],
      scatter: ['web', 'bones', 'skeleton', 'corpse'],
      neighbours: ['dMushroom', 'rubbleRoom'],
      lit: 0.05,
    },
    {
      id: 'dShrine',
      nameKey: 'room.shrine',
      center: ['statue'],
      around: ['candelabra'],
      walls: ['column', 'brazier'],
      scatter: ['coins', 'rug'],
      neighbours: ['dRitual', 'dTomb'],
      lit: 0.9,
    },
    {
      id: 'dTomb',
      nameKey: 'room.tomb',
      center: ['sarcophagus', 'coffin'],
      around: ['candelabra'],
      walls: ['column', 'gravestone'],
      scatter: ['bones', 'web', 'skull'],
      neighbours: ['dRitual', 'dTreasure', 'dShrine'],
      lit: 0.35,
    },
    {
      id: 'dCollapsed',
      nameKey: 'room.collapsed',
      center: ['column_broken'],
      around: [],
      walls: ['rubble', 'statue_broken', 'column_broken'],
      scatter: ['rubble', 'crack', 'stone_small'],
      neighbours: ['rubbleRoom', 'empty'],
      lit: 0.1,
    },
    {
      id: 'dThrone',
      nameKey: 'room.throne',
      center: ['throne'],
      around: ['brazier'],
      walls: ['column', 'banner', 'tapestry'],
      scatter: ['rug'],
      neighbours: ['dGuard', 'dTreasure', 'dDining'],
      lit: 1,
    },
    {
      id: 'dPortal',
      nameKey: 'room.portal',
      center: ['portal_arch', 'magic_portal'],
      around: ['crystals'],
      walls: ['brazier', 'column'],
      scatter: ['crystals', 'rune_circle'],
      neighbours: ['dRitual', 'dShrine'],
      lit: 0.7,
    },
    {
      id: 'dStairs',
      nameKey: 'room.stairs',
      center: ['stairs_spiral'],
      around: [],
      walls: ['wall_torch'],
      scatter: ['rubble', 'bones'],
      neighbours: ['empty', 'dGuard', 'storage'],
      lit: 0.5,
    },
  ],

  castle: [
    {
      id: 'hall',
      nameKey: 'room.hall',
      center: ['table_rect'],
      around: ['chair'],
      walls: ['barrel', 'column'],
      scatter: ['pottery', 'rug'],
      // Die Küche gehört an den Saal — der Fall, um den es geht.
      neighbours: ['kitchen', 'pantry', 'throne'],
      lit: 0.9,
    },
    {
      id: 'kitchen',
      nameKey: 'room.kitchen',
      center: ['table_round'],
      around: ['barrel'],
      walls: ['crate', 'barrel', 'pottery'],
      scatter: ['pottery', 'hay'],
      neighbours: ['hall', 'pantry'],
      lit: 0.8,
    },
    {
      id: 'pantry',
      nameKey: 'room.pantry',
      center: [],
      around: [],
      walls: ['crate', 'barrel', 'hay', 'chest'],
      scatter: ['pottery'],
      neighbours: ['kitchen', 'hall'],
      lit: 0.4,
    },
    {
      id: 'bedchamber',
      nameKey: 'room.bedchamber',
      center: ['bed'],
      around: ['chest'],
      walls: ['chest', 'mirror'],
      scatter: ['rug'],
      neighbours: ['bedchamber', 'guard'],
      lit: 0.7,
    },
    {
      id: 'guard',
      nameKey: 'room.guard',
      center: ['table_round'],
      around: ['chair'],
      walls: ['weapons', 'shield', 'crate'],
      scatter: ['bedroll'],
      neighbours: ['bedchamber', 'armoury', 'hall'],
      lit: 0.8,
    },
    {
      id: 'armoury',
      nameKey: 'room.armoury',
      center: [],
      around: [],
      walls: ['weapons', 'shield', 'crate', 'chest'],
      scatter: [],
      neighbours: ['guard'],
      lit: 0.5,
    },
    {
      id: 'throne',
      nameKey: 'room.throne',
      center: ['statue'],
      around: ['column'],
      walls: ['column', 'brazier'],
      scatter: ['rug'],
      neighbours: ['hall', 'guard'],
      lit: 1,
    },
  ],

  temple: [
    {
      id: 'sanctum',
      nameKey: 'room.sanctum',
      center: ['altar'],
      around: ['brazier', 'column'],
      walls: ['column', 'statue'],
      scatter: ['rug', 'coins'],
      neighbours: ['vestry', 'library', 'shrine'],
      lit: 1,
    },
    {
      id: 'library',
      nameKey: 'room.library',
      center: ['table_rect'],
      around: ['chair'],
      walls: ['bookshelf', 'bookshelf', 'chest'],
      scatter: ['books', 'scroll'],
      neighbours: ['sanctum', 'cell'],
      lit: 0.85,
    },
    {
      id: 'cell',
      nameKey: 'room.cell',
      center: [],
      around: [],
      walls: ['bedroll', 'chest'],
      scatter: ['books'],
      neighbours: ['cell', 'library', 'vestry'],
      lit: 0.4,
    },
    {
      id: 'vestry',
      nameKey: 'room.vestry',
      center: ['well'],
      around: ['brazier'],
      walls: ['chest', 'statue'],
      scatter: ['pottery'],
      neighbours: ['sanctum', 'cell'],
      lit: 0.7,
    },
    {
      id: 'shrine',
      nameKey: 'room.shrine',
      center: ['statue'],
      around: ['brazier'],
      walls: ['column'],
      scatter: ['coins', 'rug'],
      neighbours: ['sanctum'],
      lit: 0.9,
    },
  ],

  crypt: [
    {
      id: 'tomb',
      nameKey: 'room.tomb',
      center: ['sarcophagus', 'coffin'],
      around: ['brazier'],
      walls: ['gravestone', 'column'],
      scatter: ['bones', 'skull', 'web'],
      neighbours: ['ossuary', 'tomb', 'offering'],
      lit: 0.35,
    },
    {
      id: 'ossuary',
      nameKey: 'room.ossuary',
      center: [],
      around: [],
      walls: ['gravestone', 'bones'],
      scatter: ['bones', 'skull', 'skeleton', 'web'],
      neighbours: ['tomb', 'ossuary'],
      lit: 0.2,
    },
    {
      id: 'offering',
      nameKey: 'room.offering',
      center: ['altar'],
      around: ['brazier'],
      walls: ['statue', 'column'],
      scatter: ['coins', 'skull', 'blood_pool'],
      neighbours: ['tomb', 'ossuary', 'catacomb', 'cryptShrine'],
      lit: 0.6,
    },
    {
      id: 'catacomb',
      nameKey: 'room.catacomb',
      center: [],
      around: [],
      walls: ['skull_pile', 'gravestone', 'bones'],
      scatter: ['bones', 'skull', 'web'],
      neighbours: ['ossuary', 'tomb', 'embalming'],
      lit: 0.2,
    },
    {
      id: 'embalming',
      nameKey: 'room.embalming',
      center: ['table_rect'],
      around: ['pottery'],
      walls: ['chest', 'potion_shelf', 'shelf_crates'],
      scatter: ['pottery', 'bloodstain'],
      neighbours: ['tomb', 'catacomb'],
      lit: 0.6,
    },
    {
      id: 'cryptShrine',
      nameKey: 'room.shrine',
      center: ['statue'],
      around: ['candelabra'],
      walls: ['column'],
      scatter: ['coins', 'skull'],
      neighbours: ['offering', 'tomb'],
      lit: 0.8,
    },
  ],
};

/** Alle Raumarten quer über alle Themen — für 'random'. */
function alleArten(): RoomKind[] {
  return Object.values(ROOM_KINDS).flat();
}

export function roomKindsFor(theme: DungeonTheme): RoomKind[] {
  if (theme === 'none') return [];
  if (theme === 'random') return alleArten();
  return ROOM_KINDS[theme];
}

/**
 * Vergibt Raumarten entlang der Nachbarschaft.
 *
 * `parent[i]` ist der Raum, an den Raum `i` beim Bau des Korridor-Graphen
 * angeschlossen wurde; -1 heißt: Wurzel. Die Reihenfolge muss so sein, dass
 * jeder Elternraum vor seinem Kind drankommt — dann steht dessen Art schon
 * fest, wenn das Kind sie braucht.
 *
 * Mit `treue` lässt sich einstellen, wie streng die Nachbarschaft genommen
 * wird. Ganz ohne Ausreißer bekäme man Ketten aus lauter Küchen; ganz ohne
 * Bindung wieder Zufall.
 */
export function assignRoomKinds(
  rng: Rng,
  parent: number[],
  arten: RoomKind[],
  treue = 0.75,
): RoomKind[] {
  if (arten.length === 0) return [];
  const nachId = new Map(arten.map((a) => [a.id, a]));
  const out: RoomKind[] = [];

  for (let i = 0; i < parent.length; i++) {
    const p = parent[i];
    const eltern = p >= 0 ? out[p] : undefined;
    if (eltern && rng.bool(treue)) {
      // Nur Nachbarn, die es im gewählten Thema überhaupt gibt.
      const moeglich = eltern.neighbours.map((id) => nachId.get(id)).filter((a): a is RoomKind => !!a);
      if (moeglich.length > 0) {
        out.push(rng.pick(moeglich));
        continue;
      }
    }
    out.push(rng.pick(arten));
  }
  return out;
}
