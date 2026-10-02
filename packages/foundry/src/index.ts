/**
 * Monster und Zustaende so schreiben, dass Foundry VTT sie einliest.
 *
 * Gebaut nach vier echten Exporten aus einer laufenden Welt (Foundry-Kern
 * 14, System `dnd5e` 5.3.3, Regeln 2024): ein selbstgebautes Monster, ein
 * offizielles, ein selbstgebauter Zustand und ein offizielles Klassenmerkmal.
 * Was in dieser Datei steht, steht so auch dort — geraten wurde nichts.
 *
 * Wo die Belege nicht reichten, steht es als Kommentar an der Stelle, statt
 * dass hier ein Feld auftaucht, das niemand geprueft hat.
 *
 * Plattformfrei: keine Dateien, kein `crypto`, keine Browser-Globals. Wer
 * Kennungen braucht, gibt einen Zaehler oder Zufall herein.
 */

/** Was in `_stats` steht. Foundry prueft daran, ob es die Datei versteht. */
export const FOUNDRY_KERN = '14.364';
export const DND5E_SYSTEM = 'dnd5e';
export const DND5E_FASSUNG = '5.3.3';
/** „2024" sind die Regeln der aktuellen Grundregelwerke. */
export const REGELN = '2024';

/**
 * Eine Foundry-Kennung: 16 Zeichen aus Buchstaben und Ziffern.
 *
 * Dieselbe Form wie in den Beispielen („ucKh5bmBqewauByA"). Der Zufall kommt
 * von aussen, damit ein Test dieselbe Datei zweimal erzeugen kann.
 */
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function kennung(rng: () => number): string {
  let aus = '';
  for (let i = 0; i < 16; i += 1) {
    aus += ZEICHEN[Math.floor(rng() * ZEICHEN.length)] ?? 'a';
  }
  return aus;
}

function stats(): Record<string, unknown> {
  return {
    coreVersion: FOUNDRY_KERN,
    systemId: DND5E_SYSTEM,
    systemVersion: DND5E_FASSUNG,
    compendiumSource: null,
    duplicateSource: null
  };
}

/**
 * Text zu HTML.
 *
 * Foundry legt Beschreibungen als HTML ab; die Beispiele zeigen `<p>`-Bloecke
 * und `<ul>`. Unsere Texte sind einfache Absaetze, also reicht: maskieren,
 * an Leerzeilen trennen, jeden Teil in einen Absatz.
 *
 * Maskiert wird zuerst. Ein Monstername mit `&` oder ein Zustandstext mit
 * `<` wuerde sonst im Statblock als kaputtes Markup landen — und in Foundry
 * sieht man das erst, wenn man die Karte aufmacht.
 */
export function alsHtml(text: string): string {
  const roh = text.trim();
  if (!roh) return '';
  return roh
    .split(/\n\s*\n/)
    .map((absatz) => `<p>${maskiere(absatz).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Monster
// ---------------------------------------------------------------------------

/** Die sechs Attribute unter den Namen, die dnd5e benutzt. */
export type FoundryAttribut = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

/** Unsere Kuerzel auf die von dnd5e. */
export const ATTRIBUT_NACH_FOUNDRY: Readonly<Record<string, FoundryAttribut>> = {
  st: 'str',
  ge: 'dex',
  ko: 'con',
  in: 'int',
  we: 'wis',
  ch: 'cha'
};

/**
 * Die Bewegungsarten unter den Namen, die dnd5e benutzt.
 *
 * `gehen` heisst dort `walk`. Die uebrigen tragen ohnehin die englischen
 * Namen, die wir auch im Statblock zeigen.
 */
export const GANGART_NACH_FOUNDRY: Readonly<Record<string, string>> = {
  gehen: 'walk',
  klettern: 'climb',
  schwimmen: 'swim',
  fliegen: 'fly',
  graben: 'burrow'
};

/**
 * Die Groessen unter den Kuerzeln, die dnd5e benutzt.
 *
 * Im Beispiel steht `"size": "med"`. Die uebrigen Kuerzel folgen derselben
 * Bauart; `tiny` ist die Ausnahme, es wird nicht gekuerzt.
 */
export const GROESSE_NACH_FOUNDRY: Readonly<Record<string, string>> = {
  winzig: 'tiny',
  klein: 'sm',
  mittel: 'med',
  gross: 'lg',
  riesig: 'huge',
  gewaltig: 'grg'
};

/** Was der Umwandler ueber ein Monster wissen muss. */
export interface MonsterEingabe {
  readonly name: string;
  /** Der Herausforderungsgrad als Text: „1/2", „9". */
  readonly cr: string;
  readonly tp: number;
  readonly rk: number;
  /** Die sechs Attributwerte unter unseren Kuerzeln (st, ge, ko, in, we, ch). */
  readonly attribute: Readonly<Record<string, number>>;
  /** Welches Attribut die Angriffe traegt. */
  readonly hauptattribut: string;
  readonly gangarten: readonly { readonly art: string; readonly fuss: number }[];
  /** Die Art des Wesens auf Englisch, wie dnd5e sie kennt: „undead", „beast". */
  readonly artEnglisch: string;
  /** Die Groesse unter unserer Kennung. Fehlt sie, gilt mittel. */
  readonly groesse?: string;
  readonly widerstaende: {
    /** Englische Namen der Schadensarten — dieselben Kennungen wie in dnd5e. */
    readonly resistenzen: readonly string[];
    readonly immunitaeten: readonly string[];
    readonly verwundbarkeiten: readonly string[];
  };
  readonly faehigkeiten: readonly { readonly name: string; readonly text: string }[];
  readonly angriffe: readonly AngriffEingabe[];
  /** Ein Satz, was es ist. Landet in der Biographie. */
  readonly satz?: string;
}

export interface AngriffEingabe {
  readonly name: string;
  readonly art: 'nah' | 'fern' | 'flaeche';
  /** Der Wuerfelausdruck: „2d8 + 4". */
  readonly wuerfel: string;
  /** Der englische Name der Schadensart. */
  readonly schadensart: string;
  /** Nahkampf: Reichweite in Fuss. Fernkampf: normale Weite. */
  readonly reichweite?: number;
  readonly weite?: readonly [number, number];
  /** Wie oft pro Runde. Steht in der Beschreibung, nicht als Feld. */
  readonly anzahl?: number;
}

/**
 * Ein Wuerfelausdruck, auseinandergenommen.
 *
 * „2d8 + 4" wird zu {anzahl: 2, seiten: 8, bonus: 4}. Foundry legt Schaden
 * nicht als Text ab, sondern in genau diesen drei Feldern.
 *
 * `null`, wenn nichts Brauchbares darin steht. Der Aufrufer laesst den
 * Schaden dann weg, statt eine 0 hinzuschreiben, die nach einer Aussage
 * aussieht.
 */
export function zerlegeWuerfel(
  ausdruck: string
): { anzahl: number; seiten: number; bonus: number } | null {
  const treffer = /(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?/i.exec(ausdruck);
  if (!treffer) return null;
  const anzahl = Number(treffer[1]);
  const seiten = Number(treffer[2]);
  if (!Number.isFinite(anzahl) || !Number.isFinite(seiten) || anzahl < 1 || seiten < 1) return null;
  const betrag = treffer[4] ? Number(treffer[4]) : 0;
  const bonus = treffer[3] === '-' ? -betrag : betrag;
  return { anzahl, seiten, bonus };
}

/** Der Herausforderungsgrad als Zahl. „1/2" wird 0.5, wie in den Beispielen. */
export function alsGradZahl(cr: string): number {
  const bruch = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(cr);
  if (bruch) {
    const oben = Number(bruch[1]);
    const unten = Number(bruch[2]);
    return unten === 0 ? 0 : oben / unten;
  }
  const zahl = Number(cr);
  return Number.isFinite(zahl) ? zahl : 0;
}

/**
 * Ein Angriff als Gegenstand.
 *
 * Nahkampf und Fernkampf werden `weapon` mit einer `attack`-Taetigkeit —
 * genau so steht der „Arcane Burst" des offiziellen Archmage da. Der
 * Angriffsbonus wird NICHT hineingeschrieben: die Taetigkeit nennt nur das
 * Attribut (`attack.ability`), und Foundry rechnet Attribut plus
 * Uebungsbonus selbst. Unser Statblock rechnet ihn genauso aus, die Zahlen
 * stimmen also ueberein — und ein Monster, das in Foundry nachtraeglich
 * einen Grad hoeher geschoben wird, rechnet dort weiter richtig.
 *
 * Flaechenangriffe werden `feat`: sie haben keinen Angriffswurf, sondern
 * einen Rettungswurf. Den Rettungs-SG hier einzutragen waere ein Feld, das
 * ich in keinem Beispiel eines MONSTERS gesehen habe — der Zustand „Absolute
 * Zero" zeigt eine `save`-Taetigkeit an einem `feat`, aber an einem Item,
 * nicht an einer Kreatur. Deshalb steht der SG im Text, wo er sicher richtig
 * ankommt, und nicht in einem Feld, das vielleicht anders heisst.
 */
function angriffAlsGegenstand(
  angriff: AngriffEingabe,
  hauptattribut: FoundryAttribut,
  rng: () => number
): Record<string, unknown> {
  const schaden = zerlegeWuerfel(angriff.wuerfel);
  const beschreibung = angriff.anzahl && angriff.anzahl > 1
    ? alsHtml(`${angriff.anzahl}× pro Runde. / ${angriff.anzahl}× per round.`)
    : '';

  if (angriff.art === 'flaeche') {
    return {
      name: angriff.name,
      type: 'feat',
      _id: kennung(rng),
      img: 'icons/svg/aura.svg',
      system: {
        description: { value: alsHtml(`${angriff.wuerfel} ${angriff.schadensart}.`), chat: '' },
        identifier: kleinUndBindestrich(angriff.name),
        source: { revision: 1, rules: REGELN },
        type: { value: 'monster', subtype: '' },
        activities: {},
        properties: [],
        requirements: ''
      },
      effects: [],
      folder: null,
      sort: 0,
      flags: {},
      ownership: { default: 0 },
      _stats: stats()
    };
  }

  const taetigkeit = kennung(rng);
  return {
    name: angriff.name,
    type: 'weapon',
    _id: kennung(rng),
    img: 'systems/dnd5e/icons/svg/items/weapon.svg',
    system: {
      activities: {
        [taetigkeit]: {
          _id: taetigkeit,
          type: 'attack',
          img: '',
          sort: 0,
          activation: { type: 'action', override: false, condition: '' },
          consumption: { scaling: { allowed: false }, spellSlot: true, targets: [] },
          description: { chatFlavor: '' },
          duration: { units: 'inst', concentration: false, override: false },
          effects: [],
          flags: {},
          range: { units: 'self', override: false },
          target: {
            template: { contiguous: false, stationary: false, units: 'ft', type: '' },
            affects: { choice: false, type: '' },
            override: false,
            prompt: true
          },
          uses: { spent: 0, recovery: [], max: '' },
          attack: {
            critical: { threshold: null },
            flat: false,
            type: { value: '', classification: '' },
            ability: hauptattribut,
            bonus: ''
          },
          // Leere `parts` mit `includeBase`: der Schaden steht unten in
          // `system.damage.base`, die Taetigkeit nimmt ihn von dort. So
          // machen es beide Beispiele.
          damage: { critical: { bonus: '' }, includeBase: true, parts: [] },
          name: ''
        }
      },
      uses: { spent: 0, recovery: [], max: '' },
      description: { value: beschreibung, chat: '' },
      identifier: 'weapon',
      source: { revision: 1, rules: REGELN },
      identified: true,
      unidentified: { description: '' },
      container: null,
      quantity: 1,
      weight: { value: 0, units: 'lb' },
      price: { value: 0, denomination: 'gp' },
      rarity: '',
      attunement: '',
      attuned: false,
      equipped: true,
      crew: { value: [] },
      ammunition: {},
      armor: {},
      damage: {
        base: schaden
          ? {
              types: [angriff.schadensart],
              custom: { enabled: false },
              scaling: { number: 1 },
              number: schaden.anzahl,
              denomination: schaden.seiten,
              bonus: schaden.bonus === 0 ? '' : String(schaden.bonus)
            }
          : { types: [], custom: { enabled: false }, scaling: { number: 1 } },
        versatile: { types: [], custom: { enabled: false }, scaling: { number: 1 } }
      },
      properties: [],
      // `null` heisst „Vorgabe" — bei einem NSC ist das geuebt. Das
      // offizielle Beispiel steht genauso da.
      proficient: null,
      range:
        angriff.art === 'fern'
          ? {
              units: 'ft',
              value: angriff.weite?.[0] ?? null,
              long: angriff.weite?.[1] ?? null,
              reach: null
            }
          : { units: 'ft', value: null, long: null, reach: angriff.reichweite ?? 5 },
      type: { value: 'natural', baseItem: '' },
      mastery: ''
    },
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    _stats: stats()
  };
}

/** Eine Faehigkeit als Gegenstand — dieselbe Bauart wie „Reckless Attack". */
function faehigkeitAlsGegenstand(
  faehigkeit: { readonly name: string; readonly text: string },
  rng: () => number
): Record<string, unknown> {
  return {
    name: faehigkeit.name,
    type: 'feat',
    _id: kennung(rng),
    img: 'icons/svg/book.svg',
    system: {
      activities: {},
      uses: { spent: 0, recovery: [], max: '' },
      advancement: {},
      description: { value: alsHtml(faehigkeit.text), chat: '' },
      identifier: kleinUndBindestrich(faehigkeit.name),
      source: { revision: 1, rules: REGELN },
      crewed: false,
      enchant: {},
      prerequisites: { items: [], repeatable: false, level: null },
      properties: [],
      requirements: '',
      type: { value: 'monster', subtype: '' }
    },
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    ownership: { default: 0 },
    _stats: stats()
  };
}

/**
 * Ein Monster als Foundry-Akteur (`npc`).
 *
 * Die Ruestungsklasse steht als `calc: "flat"`: unsere Zahl ist die
 * Wahrheit, sie soll nicht aus einer Ruestung nachgerechnet werden, die das
 * Monster gar nicht traegt. Genau so steht es im selbstgebauten Beispiel.
 */
export function alsFoundryMonster(
  monster: MonsterEingabe,
  rng: () => number
): Record<string, unknown> {
  const haupt = ATTRIBUT_NACH_FOUNDRY[monster.hauptattribut] ?? 'str';

  const attribute: Record<string, unknown> = {};
  for (const [unser, ihr] of Object.entries(ATTRIBUT_NACH_FOUNDRY)) {
    attribute[ihr] = {
      value: monster.attribute[unser] ?? 10,
      proficient: 0,
      max: null,
      bonuses: { check: '', save: '' },
      check: { roll: { min: null, max: null, mode: 0 } },
      save: { roll: { min: null, max: null, mode: 0 } }
    };
  }

  const bewegung: Record<string, unknown> = {
    units: 'ft',
    hover: false,
    ignoredDifficultTerrain: [],
    walk: '',
    burrow: '',
    climb: '',
    fly: '',
    swim: '',
    bonus: '',
    special: ''
  };
  for (const gangart of monster.gangarten) {
    const name = GANGART_NACH_FOUNDRY[gangart.art];
    if (name) bewegung[name] = String(gangart.fuss);
  }

  return {
    name: monster.name,
    type: 'npc',
    img: 'icons/svg/mystery-man.svg',
    system: {
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      abilities: attribute,
      bonuses: {},
      skills: {},
      tools: {},
      spells: {},
      attributes: {
        ac: { calc: 'flat', flat: monster.rk },
        init: { ability: '', roll: { min: null, max: null, mode: 0 }, bonus: '' },
        movement: bewegung,
        attunement: { max: 3 },
        senses: {
          ranges: { blindsight: null, darkvision: null, tremorsense: null, truesight: null },
          units: 'ft',
          special: ''
        },
        spellcasting: '',
        exhaustion: 0,
        // Genau wie im echten Export: `temp` und `tempmax` stehen dort auf
        // `null`, nicht auf 0 — „nichts“ und „null Punkte“ sind zweierlei.
        hp: { value: monster.tp, max: monster.tp, temp: null, tempmax: null, formula: '', dt: null }
      },
      details: {
        biography: { value: alsHtml(monster.satz ?? ''), public: '' },
        alignment: '',
        ideal: '',
        bond: '',
        flaw: '',
        race: null,
        type: { value: monster.artEnglisch, subtype: '', swarm: '', custom: '' },
        habitat: { value: [], custom: '' },
        cr: alsGradZahl(monster.cr),
        treasure: { value: [] }
      },
      resources: {},
      source: { revision: 1, rules: REGELN },
      traits: {
        size: GROESSE_NACH_FOUNDRY[monster.groesse ?? 'mittel'] ?? 'med',
        di: { value: [...monster.widerstaende.immunitaeten], custom: '', bypasses: [] },
        dr: { value: [...monster.widerstaende.resistenzen], custom: '', bypasses: [] },
        dv: { value: [...monster.widerstaende.verwundbarkeiten], custom: '', bypasses: [] },
        dm: { amount: {}, bypasses: [] },
        ci: { value: [], custom: '' },
        languages: { value: [], custom: '', communication: {} },
        important: false
      }
    },
    items: [
      ...monster.faehigkeiten.map((f) => faehigkeitAlsGegenstand(f, rng)),
      ...monster.angriffe.map((a) => angriffAlsGegenstand(a, haupt, rng))
    ],
    effects: [],
    folder: null,
    ownership: { default: 0 },
    flags: {},
    _stats: stats()
  };
}

// ---------------------------------------------------------------------------
// Zustaende
// ---------------------------------------------------------------------------

export interface ZustandEingabe {
  readonly name: string;
  /** Ein Satz, was er tut. */
  readonly kurzsatz: string;
  /** Die Stufen, jede mit ihren Wirkungen als fertigem Text. */
  readonly stufen: readonly { readonly nummer: number; readonly wirkungen: readonly string[] }[];
  readonly dauer: string;
  readonly verschlimmerung: string;
  readonly linderung: string;
}

/**
 * Ein Zustand als Foundry-Gegenstand (`feat`).
 *
 * Dieselbe Bauart wie „Absolute Zero" aus der laufenden Welt: ein `feat`
 * vom Typ `monster`, dessen ganze Regel im HTML der Beschreibung steht.
 *
 * Ohne `_id`: ein Gegenstand, der fuer sich exportiert wird, traegt keine —
 * die vergibt Foundry beim Einlesen. Nur EINGEBETTETE Gegenstaende (die
 * Faehigkeiten und Angriffe in einem Monster) haben eine, weil das Monster
 * sie untereinander auseinanderhalten muss. Erst der Abgleich mit dem echten
 * Export hat das gezeigt; vorher stand hier eine.
 *
 * Bewusst OHNE `ActiveEffect`. Ein Zustand wie „Bewegung um 10 Fuss
 * verringert" liesse sich als Aenderung an `system.attributes.movement.walk`
 * schreiben — aber unsere Wirkungen sind Saetze, keine Feldnamen, und aus
 * einem Satz den richtigen Schluessel zu raten hiesse, Regeln zu erfinden,
 * die am Tisch dann falsch wirken. Der Text steht da, wo ihn jemand liest.
 */
export function alsFoundryZustand(zustand: ZustandEingabe): Record<string, unknown> {
  const teile: string[] = [];
  if (zustand.kurzsatz.trim()) teile.push(`<p>${maskiere(zustand.kurzsatz.trim())}</p>`);

  for (const stufe of zustand.stufen) {
    if (zustand.stufen.length > 1) {
      teile.push(`<h4>${maskiere(`Stufe ${stufe.nummer} / Level ${stufe.nummer}`)}</h4>`);
    }
    if (stufe.wirkungen.length > 0) {
      teile.push(
        `<ul>${stufe.wirkungen.map((w) => `<li><p>${maskiere(w)}</p></li>`).join('')}</ul>`
      );
    }
  }

  const zeile = (titel: string, wert: string) =>
    wert.trim() ? `<p><strong>${maskiere(titel)}:</strong> ${maskiere(wert.trim())}</p>` : '';
  teile.push(zeile('Dauer / Duration', zustand.dauer));
  teile.push(zeile('Verschlimmerung / Worsens', zustand.verschlimmerung));
  teile.push(zeile('Linderung / Eases', zustand.linderung));

  return {
    name: zustand.name,
    type: 'feat',
    img: 'icons/svg/aura.svg',
    system: {
      activities: {},
      uses: { spent: 0, recovery: [], max: '' },
      advancement: {},
      description: { value: teile.filter(Boolean).join(''), chat: '' },
      identifier: kleinUndBindestrich(zustand.name),
      source: { revision: 1, rules: REGELN },
      crewed: false,
      enchant: {},
      prerequisites: { items: [], repeatable: false, level: null },
      properties: [],
      requirements: '',
      type: { value: 'monster', subtype: '' }
    },
    effects: [],
    folder: null,
    flags: {},
    _stats: stats(),
    ownership: { default: 0 }
  };
}

/** „Absolute Zero" wird „absolute-zero" — wie das `identifier`-Feld im Beispiel. */
export function kleinUndBindestrich(name: string): string {
  return (
    name
      .toLowerCase()
      // Die Umlaute ZUERST. Nach `normalize('NFD')` sind sie in Buchstabe
      // plus Zeichen zerlegt und treffen auf kein /ä/ mehr — „Kälte“ würde
      // dann „ka-lte“ statt „kaelte“.
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      // Der Rest der Akzente fällt weg, statt zu einem Bindestrich zu
      // werden: „Café“ wird „cafe“.
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed'
  );
}

/**
 * Ein Dateiname, wie Foundry ihn beim Export vergibt.
 *
 * „fvtt-Actor-relentless-warrior-hGO8CVAuR6lUb8Gh.json" — Art, Name,
 * Kennung. Wer die Datei spaeter wiederfindet, erkennt daran sofort, was
 * drin ist.
 */
export function dateiname(art: 'Actor' | 'Item', name: string, id: string): string {
  return `fvtt-${art}-${kleinUndBindestrich(name)}-${id}.json`;
}

// ---------------------------------------------------------------------------
// Magische Gegenstaende
// ---------------------------------------------------------------------------

export type GegenstandsArt =
  | 'waffe'
  | 'ruestung'
  | 'schild'
  | 'wundersam'
  | 'ring'
  | 'stab'
  | 'trank'
  | 'schriftrolle';

export interface GegenstandEingabe {
  readonly name: string;
  readonly art: GegenstandsArt;
  /** `common` … `legendary`, in der Schreibweise von Foundry (`veryRare`). */
  readonly seltenheit: string;
  readonly einstimmung: boolean;
  readonly wirkungen: readonly string[];
  readonly fluch: string;
  /** Wert in Goldmuenzen. */
  readonly wert: number;
  /** Die Notiz der Spielleitung; steht als eigener Absatz in der Beschreibung. */
  readonly notiz?: string;
}

/**
 * Der Zahlenbonus einer Waffe, Ruestung oder eines Schilds, wie er in den
 * Wirkungen steht („+2 auf Angriffs- und Schadenswuerfe", „+1 bonus to AC").
 * Nur 1 bis 3; alles andere ist kein Bonus im Sinne des SRD.
 */
export function zahlenbonus(wirkungen: readonly string[]): number | null {
  for (const w of wirkungen) {
    const treffer = /(^|[^\d])\+([1-3])(?!\d)/.exec(w);
    if (treffer && /(Angriff|attack|RK|AC|Rüstungsklasse|Armor Class)/i.test(w)) return Number(treffer[2]);
  }
  return null;
}

/**
 * Welcher Foundry-Typ zu welcher Art gehoert.
 *
 * BELEGT an echten Exporten (docs/magicitems.md): Waffe (`weapon`),
 * Wundersames (`equipment`/`wondrous`), Schild (`equipment`/`shield`), Stab
 * (`equipment`/`rod`) und Trank (`consumable`/`potion`).
 *
 * NICHT belegt, sondern aus den Typlisten des dnd5e-Systems: Ring
 * (`equipment`/`ring`), Ruestung (`equipment`/`medium`) und Schriftrolle
 * (`consumable`/`scroll`). Die Felder sind dieselben wie bei den belegten
 * Geschwistern; ob Foundry die Werte so annimmt, ist an einem echten Import
 * noch zu pruefen.
 */
const GEGENSTANDSTYP: Record<GegenstandsArt, { readonly type: string; readonly value: string }> = {
  waffe: { type: 'weapon', value: '' },
  ruestung: { type: 'equipment', value: 'medium' },
  schild: { type: 'equipment', value: 'shield' },
  wundersam: { type: 'equipment', value: 'wondrous' },
  ring: { type: 'equipment', value: 'ring' },
  stab: { type: 'equipment', value: 'rod' },
  trank: { type: 'consumable', value: 'potion' },
  schriftrolle: { type: 'consumable', value: 'scroll' }
};

/**
 * Ein magischer Gegenstand als Foundry-Item.
 *
 * Wie beim Zustand OHNE Effekte und Taetigkeiten: die Wirkungen sind Saetze,
 * keine Feldnamen. Seltenheit, Einstimmung und Preis stehen in den Feldern,
 * die Foundry dafuer hat; alles andere steht als Liste in der Beschreibung,
 * wo es jemand liest. Ein Verbrauchsgegenstand verbraucht sich selbst
 * (`uses.max: "1"`, `autoDestroy`), wie der Heiltrank im Beleg.
 */
export function alsFoundryGegenstand(g: GegenstandEingabe): Record<string, unknown> {
  const typ = GEGENSTANDSTYP[g.art];
  const teile: string[] = [];
  const wirkungen = g.wirkungen.filter((w) => w.trim());
  if (wirkungen.length) teile.push(`<ul>${wirkungen.map((w) => `<li><p>${maskiere(w.trim())}</p></li>`).join('')}</ul>`);
  if (g.fluch.trim()) teile.push(`<p><strong>${maskiere(g.fluch.trim())}</strong></p>`);
  if (g.notiz?.trim()) teile.push(`<p><em>${maskiere(g.notiz.trim())}</em></p>`);

  const verbrauch = typ.type === 'consumable';
  const system: Record<string, unknown> = {
    activities: {},
    attuned: false,
    attunement: g.einstimmung ? 'required' : '',
    container: null,
    description: { value: teile.join(''), chat: '' },
    equipped: false,
    identified: true,
    identifier: kleinUndBindestrich(g.name),
    price: { value: g.wert, denomination: 'gp' },
    properties: ['mgc'],
    quantity: 1,
    rarity: g.seltenheit,
    source: { revision: 1, rules: REGELN },
    type: typ.type === 'equipment' ? { value: typ.value, baseItem: '' } : { value: typ.value, subtype: '' },
    unidentified: { description: '' },
    uses: verbrauch ? { max: '1', spent: 0, recovery: [], autoDestroy: true } : { max: '', spent: 0, recovery: [] },
    weight: { value: 0, units: 'lb' }
  };
  if (typ.type === 'weapon') system.type = { value: '', baseItem: '' };

  /*
   * Der Bonus als Mechanik, nicht nur als Satz (Wunsch aus dem Testbericht).
   * Waffe: `system.magicalBonus`, wie im Beleg (docs/magicitems.md).
   * Ruestung und Schild: ein uebertragener Effekt auf
   * `system.attributes.ac.bonus`, wie beim belegten Schild.
   */
  const bonus = g.art === 'waffe' || g.art === 'ruestung' || g.art === 'schild' ? zahlenbonus(wirkungen) : null;
  const effects: Record<string, unknown>[] = [];
  if (bonus !== null && g.art === 'waffe') system.magicalBonus = bonus;
  if (bonus !== null && g.art !== 'waffe') {
    effects.push({
      name: `${g.name || 'Bonus'} (+${bonus} AC)`,
      img: 'icons/svg/shield.svg',
      transfer: true,
      disabled: false,
      // Wie im Beleg (Schild, Foundry 14): `system.changes[]` mit `type: add`
      // und der Zahl als Wert. Die alte Form (`changes[]` mit `mode`) kennt
      // Foundry 14 nicht mehr. `phase` ist im Beleg gesetzt, aber sein Wert
      // ist nicht festgehalten; es bleibt weg, Foundry setzt die Vorgabe.
      system: { changes: [{ key: 'system.attributes.ac.bonus', type: 'add', value: bonus, priority: null }] },
      flags: {}
    });
  }

  return {
    name: g.name,
    type: typ.type,
    img: verbrauch ? 'icons/svg/tankard.svg' : 'icons/svg/item-bag.svg',
    system,
    effects,
    folder: null,
    flags: {},
    _stats: stats(),
    ownership: { default: 0 }
  };
}

export * from './homebrew';
