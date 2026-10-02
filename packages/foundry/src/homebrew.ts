/**
 * Waffen, Ruestungen, einfache Gegenstaende und Zauber aus dem Homebrew
 * Creator als Foundry-Item (docs/homebrew-creator.md).
 *
 * Gebaut nach sechs echten Exporten (Foundry 14.368, dnd5e 6.0.5, Regeln
 * 2024; Feldgerueste unter tests/belege/*-6.json): Langschwert, Kettenhemd,
 * Feuerball (Rettungswurf), Chromatische Kugel (Angriff), Diebeswerkzeug und
 * ein selbst angelegter Schluessel mit eigenem Bild. Der Test in
 * belege.test.mjs prueft, dass jedes Feld, das hier entsteht, in einem dieser
 * Exporte vorkommt.
 *
 * BELEGT sind die FELDER. Bei einigen WERTEN gab es nur ein Beispiel; die
 * uebrigen stammen aus den Typlisten des dnd5e-Systems und sind an keinem
 * Import geprueft. Sie stehen unten jeweils mit „UNGEPRUEFT" dabei.
 *
 * Die Fassung in `_stats` ist hier 6.0.5, nicht die 5.3.3 der Monster: die
 * Felder folgen den Exporten aus 6.0.5, und eine aeltere Angabe liesse
 * Foundry womoeglich Umbauten anwenden, die fuer diese Form nicht gedacht
 * sind.
 */
import { REGELN, alsHtml, kleinUndBindestrich, maskiere } from './index';

export const FOUNDRY_KERN_6 = '14.368';
export const DND5E_FASSUNG_6 = '6.0.5';

function stats6(): Record<string, unknown> {
  return { coreVersion: FOUNDRY_KERN_6, systemId: 'dnd5e', systemVersion: DND5E_FASSUNG_6, compendiumSource: null, duplicateSource: null };
}

/** Unsere Schadensarten unter den Kennungen von dnd5e. Belegt: slashing, fire; die uebrigen sind dieselben englischen Namen. */
export const SCHADENSART_NACH_FOUNDRY: Readonly<Record<string, string>> = {
  stich: 'piercing',
  hieb: 'slashing',
  wucht: 'bludgeoning',
  saeure: 'acid',
  kaelte: 'cold',
  feuer: 'fire',
  energie: 'force',
  blitz: 'lightning',
  nekrotisch: 'necrotic',
  gift: 'poison',
  psychisch: 'psychic',
  gleissend: 'radiant',
  schall: 'thunder'
};

/** Belegt: `ver` (Langschwert). UNGEPRUEFT: die uebrigen Kuerzel aus dnd5e. */
const EIGENSCHAFT_NACH_FOUNDRY: Readonly<Record<string, string>> = {
  finesse: 'fin',
  leicht: 'lgt',
  schwer: 'hvy',
  zweihaendig: 'two',
  vielseitig: 'ver',
  reichweite: 'rch',
  wurf: 'thr',
  munition: 'amm',
  laden: 'lod'
};

const ATTRIBUT: Readonly<Record<string, string>> = { sta: 'str', ges: 'dex', kon: 'con', int: 'int', wei: 'wis', cha: 'cha' };

/** Belegt: `evo` (Feuerball, Chromatische Kugel). UNGEPRUEFT: die uebrigen. */
const SCHULE: Readonly<Record<string, string>> = {
  bann: 'abj',
  beschwoerung: 'con',
  erkenntnis: 'div',
  verzauberung: 'enc',
  hervorrufung: 'evo',
  illusion: 'ill',
  nekromantie: 'nec',
  verwandlung: 'trs'
};

/** Belegt: `sphere` (Feuerball). UNGEPRUEFT: die uebrigen Schablonen. */
const FLAECHE: Readonly<Record<string, string>> = {
  kugel: 'sphere',
  kegel: 'cone',
  linie: 'line',
  wuerfel: 'cube',
  zylinder: 'cylinder',
  ausstrahlung: 'radius'
};

/** Was alle vier gemeinsam haben. */
export interface HomebrewKopf {
  readonly name: string;
  readonly beschreibung: string;
  /** Pfad oder data:-Adresse; leer = ein eingebautes Symbol. */
  readonly bild?: string | null;
  /** In GM. */
  readonly preis: number | null;
  /** In lb. */
  readonly gewicht: number | null;
  readonly magisch?: boolean;
}

/** Ein Wuerfelteil wie in den Belegen (`damage.parts[]`, `damage.base`). */
function teil(anzahl: number | null, seiten: number | null, plus: number, typen: readonly string[], skalierung = 0): Record<string, unknown> {
  return {
    number: anzahl,
    denomination: seiten,
    bonus: plus ? String(plus) : '',
    types: [...typen],
    custom: { enabled: false, formula: '' },
    scaling: skalierung ? { mode: 'whole', number: skalierung, formula: '' } : { mode: '', number: null, formula: '' },
    modifiers: []
  };
}

/** „2d6" → [2, 6]; „1" (Blasrohr) → [null, null] mit dem Wert als Plus. */
function wuerfel(text: string): { anzahl: number | null; seiten: number | null; fest: number } {
  const t = /^(\d+)d(\d+)$/i.exec(text.trim());
  if (t) return { anzahl: Number(t[1]), seiten: Number(t[2]), fest: 0 };
  return { anzahl: null, seiten: null, fest: Number(text) || 0 };
}

function grundfelder(k: HomebrewKopf, notiz = ''): Record<string, unknown> {
  return {
    description: { value: [alsHtml(k.beschreibung), notiz].join(''), chat: '' },
    identifier: kleinUndBindestrich(k.name),
    source: { revision: 1, rules: REGELN },
    identified: true,
    unidentified: { description: '' },
    container: null,
    quantity: 1,
    weight: { value: k.gewicht ?? 0, units: 'lb' },
    price: { value: k.preis ?? 0, denomination: 'gp' },
    rarities: []
  };
}

function huelle(k: HomebrewKopf, type: string, system: Record<string, unknown>, bild: string, effects: unknown[] = []): Record<string, unknown> {
  return {
    name: k.name,
    type,
    // Das eigene Bild steht im Beleg als Pfad auf dem Foundry-Server
    // („assets/…png"). Wir schreiben die data:-Adresse hinein. UNGEPRUEFT,
    // ob Foundry sie beim Import annimmt (docs/homebrew-creator.md).
    img: k.bild || bild,
    system,
    effects,
    folder: null,
    flags: {},
    _stats: stats6(),
    ownership: { default: 0 }
  };
}

/** Die Huelle einer Taetigkeit, wie sie in allen vier Belegen gleich aussieht. */
function taetigkeit(id: string, art: string, reichweite: Record<string, unknown>, mehr: Record<string, unknown>, konzentration = false): Record<string, unknown> {
  return {
    _id: id,
    type: art,
    activation: { type: 'action', value: null, override: false },
    consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: true },
    description: { chatFlavor: '', value: '' },
    duration: { units: 'inst', override: false, expiry: null, concentration: konzentration },
    effects: [],
    range: reichweite,
    target: { prompt: true, template: { contiguous: false, units: 'ft', stationary: false }, affects: { choice: false }, override: false },
    uses: { recovery: [], max: '', spent: 0 },
    sort: 0,
    name: '',
    img: '',
    behaviors: [],
    flags: {},
    visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
    ...mehr
  };
}

// ---------------------------------------------------------------------------
// Waffe
// ---------------------------------------------------------------------------

export interface WaffeEingabe extends HomebrewKopf {
  readonly kategorie: 'einfach' | 'kriegs';
  readonly fern: boolean;
  readonly wuerfel: string;
  readonly schadenPlus: number;
  readonly schadensart: string;
  readonly zusatz: readonly { readonly wuerfel: string; readonly plus: number; readonly art: string }[];
  readonly reichweiteNah: number;
  readonly eigenschaften: readonly string[];
  readonly vielseitig: string;
  readonly reichweiteNormal: number;
  readonly reichweiteMax: number;
  readonly meisterschaft: string;
  readonly bonus: number;
}

export function alsFoundryWaffe(w: WaffeEingabe, id: string): Record<string, unknown> {
  const haupt = wuerfel(w.wuerfel);
  const zweihand = wuerfel(w.vielseitig);
  const weit = w.fern || w.eigenschaften.includes('wurf');
  const zusatz = w.zusatz.map((z) => {
    const x = wuerfel(z.wuerfel);
    return teil(x.anzahl, x.seiten, x.fest + z.plus, [SCHADENSART_NACH_FOUNDRY[z.art] ?? z.art]);
  });
  const system: Record<string, unknown> = {
    ...grundfelder(w),
    attunement: '',
    cover: null,
    // Belegt nur beim Nahkampf (alles null). UNGEPRUEFT: Weiten und `reach` bei Fern-, Wurf- und Reichweitenwaffen.
    range: {
      value: weit ? w.reichweiteNormal : null,
      long: weit ? w.reichweiteMax : null,
      units: 'ft',
      reach: !w.fern && w.reichweiteNah > 5 ? w.reichweiteNah : null
    },
    uses: { max: '', recovery: [], spent: 0 },
    damage: {
      // `base` ist schmaler als die uebrigen Teile, genau so im Beleg.
      base: {
        number: haupt.anzahl,
        denomination: haupt.seiten,
        types: [SCHADENSART_NACH_FOUNDRY[w.schadensart] ?? w.schadensart],
        custom: { enabled: false },
        scaling: { number: 1 },
        bonus: haupt.fest + w.schadenPlus ? String(haupt.fest + w.schadenPlus) : '',
        modifiers: []
      },
      versatile: w.eigenschaften.includes('vielseitig') ? teil(zweihand.anzahl, zweihand.seiten, 0, []) : teil(null, null, 0, [])
    },
    armor: { value: null },
    hp: { value: null, max: null, dt: null, conditions: '' },
    // Belegt: `martialM`. UNGEPRUEFT: simpleM, simpleR, martialR nach demselben Muster.
    type: { value: `${w.kategorie === 'kriegs' ? 'martial' : 'simple'}${w.fern ? 'R' : 'M'}`, baseItem: '' },
    properties: [...w.eigenschaften.map((e) => EIGENSCHAFT_NACH_FOUNDRY[e]).filter(Boolean), ...(w.magisch || w.bonus ? ['mgc'] : [])],
    proficient: null,
    activities: {
      [id]: taetigkeit(
        id,
        'attack',
        { value: String(w.fern ? w.reichweiteNormal : w.reichweiteNah), units: 'ft', special: '', override: false },
        {
          attack: { ability: '', bonus: '', critical: { threshold: null }, flat: false, type: { value: w.fern ? 'ranged' : 'melee', classification: 'weapon' } },
          damage: { critical: { bonus: '' }, includeBase: true, parts: zusatz }
        }
      )
    },
    ammunition: {},
    mastery: w.meisterschaft,
    crew: { value: [] },
    attuned: false,
    equipped: false
  };
  // Der magische Bonus wie beim Magic Item Generator (Beleg item-weapon-bonus).
  if (w.bonus) system.magicalBonus = w.bonus;
  return huelle(w, 'weapon', system, 'icons/weapons/swords/greatsword-guard.webp');
}

// ---------------------------------------------------------------------------
// Ruestung
// ---------------------------------------------------------------------------

export interface RuestungEingabe extends HomebrewKopf {
  readonly ruestungsart: 'leicht' | 'mittel' | 'schwer' | 'schild';
  readonly rk: number;
  readonly staerke: number;
  readonly heimlichkeitNachteil: boolean;
  readonly bonus: number;
}

export function alsFoundryRuestung(r: RuestungEingabe): Record<string, unknown> {
  const system: Record<string, unknown> = {
    ...grundfelder(r),
    attunement: '',
    cover: null,
    uses: { max: '', recovery: [], spent: 0 },
    // Belegt: mittel mit `dex: 2`. UNGEPRUEFT: `dex: null` (leicht, voll) und `0` (schwer, Schild).
    armor: { value: r.rk, dex: r.ruestungsart === 'mittel' ? 2 : r.ruestungsart === 'leicht' ? null : 0 },
    hp: { value: null, max: null, dt: null, conditions: '' },
    // Belegt: `medium` (hier), `shield` (Magic Item Generator). UNGEPRUEFT: light, heavy.
    type: { value: { leicht: 'light', mittel: 'medium', schwer: 'heavy', schild: 'shield' }[r.ruestungsart], baseItem: '' },
    // UNGEPRUEFT: das Kuerzel `stealthDisadvantage`.
    properties: [...(r.heimlichkeitNachteil ? ['stealthDisadvantage'] : []), ...(r.magisch || r.bonus ? ['mgc'] : [])],
    speed: { value: null, conditions: '', units: 'ft' },
    strength: r.staerke || null,
    proficient: null,
    activities: {},
    crew: { value: [] },
    attuned: false,
    equipped: false
  };
  // Der Bonus als uebertragener Effekt auf die RK, wie beim belegten Schild.
  const effects = r.bonus
    ? [
        {
          name: `${r.name || 'Bonus'} (+${r.bonus} AC)`,
          img: 'icons/svg/shield.svg',
          transfer: true,
          disabled: false,
          // Dieselbe Form wie beim Magic Item Generator (siehe index.ts).
          system: { changes: [{ key: 'system.attributes.ac.bonus', type: 'add', value: r.bonus, priority: null }] },
          flags: {}
        }
      ]
    : [];
  return huelle(r, 'equipment', system, 'icons/equipment/chest/breastplate-scale-grey.webp', effects);
}

// ---------------------------------------------------------------------------
// Einfacher Gegenstand
// ---------------------------------------------------------------------------

/** Wie der selbst angelegte Schluessel im Beleg: `loot`, ohne Taetigkeiten. */
export function alsFoundryKram(g: HomebrewKopf): Record<string, unknown> {
  return huelle(
    g,
    'loot',
    { ...grundfelder(g), properties: g.magisch ? ['mgc'] : [], type: { value: '', subtype: '' } },
    'icons/svg/item-bag.svg'
  );
}

// ---------------------------------------------------------------------------
// Zauber
// ---------------------------------------------------------------------------

export interface ZauberEingabe extends HomebrewKopf {
  readonly grad: number;
  readonly schule: string;
  readonly zeit: string;
  readonly reichweite: string;
  readonly komponenten: string;
  readonly dauer: string;
  readonly konzentration: boolean;
  readonly ritual: boolean;
  readonly wirkungen: readonly string[];
  readonly schadenAnzahl: number;
  readonly schadenSeiten: number;
  readonly schadenPlus: number;
  readonly schadensart: string;
  readonly heilAnzahl: number;
  readonly heilSeiten: number;
  readonly heilPlus: number;
  readonly ziel: 'einzel' | 'mehrere' | 'flaeche';
  readonly flaeche: string;
  readonly flaecheGroesse: number;
  readonly rettungswurf: string;
  readonly angriffswurf: boolean;
  readonly halbBeiErfolg: boolean;
  readonly hoehererGrad: string;
}

/** „Aktion", „Bonusaktion", „Reaktion", „1 Minute" … in die Art von dnd5e. Belegt: `action`. */
function aktivierung(zeit: string): Record<string, unknown> {
  const t = zeit.toLowerCase();
  const zahl = Number(/(\d+)/.exec(t)?.[1] ?? '') || null;
  // UNGEPRUEFT: bonus, reaction, minute, hour.
  const art = /bonus/.test(t) ? 'bonus' : /reakt|react/.test(t) ? 'reaction' : /minut/.test(t) ? 'minute' : /stund|hour/.test(t) ? 'hour' : 'action';
  return { type: art, condition: '', value: art === 'minute' || art === 'hour' ? zahl : null };
}

/** Belegt: `inst`. UNGEPRUEFT: die Einheiten round, minute, hour, day und `spec`. */
function dauerFeld(dauer: string): Record<string, unknown> {
  const t = dauer.toLowerCase();
  if (!t.trim() || /sofort|instant/.test(t)) return { value: '', units: 'inst', expiry: null };
  const zahl = /(\d+)/.exec(t)?.[1] ?? '';
  const einheit = /runde|round/.test(t) ? 'round' : /minut/.test(t) ? 'minute' : /stund|hour/.test(t) ? 'hour' : /tag|day/.test(t) ? 'day' : '';
  return einheit && zahl ? { value: zahl, units: einheit, expiry: null } : { value: '', units: 'spec', expiry: null };
}

/** Belegt: Fuss. UNGEPRUEFT: self, touch. */
function reichweiteFeld(reichweite: string): Record<string, unknown> {
  const t = reichweite.toLowerCase();
  if (/selbst|self/.test(t)) return { value: '', units: 'self', special: '' };
  if (/berühr|touch/.test(t)) return { value: '', units: 'touch', special: '' };
  const fuss = /(\d+)/.exec(t)?.[1];
  return fuss ? { value: fuss, units: 'ft', special: '' } : { value: '', units: 'spec', special: maskiere(reichweite) };
}

export function alsFoundryZauber(z: ZauberEingabe, id: string): Record<string, unknown> {
  const k = z.komponenten;
  const material = /\(([^)]*)\)/.exec(k)?.[1] ?? '';
  const art = SCHADENSART_NACH_FOUNDRY[z.schadensart] ?? z.schadensart;
  // „1d6 je Grad darüber" → die Skalierung wie beim Feuerball (`whole`, 1).
  const mehr = /(\d+)\s*[dw]\s*(\d+)/i.exec(z.hoehererGrad);
  const skal = mehr && Number(mehr[2]) === z.schadenSeiten ? Number(mehr[1]) : 0;
  const schaden = z.wirkungen.includes('schaden') && z.schadenAnzahl > 0 ? [teil(z.schadenAnzahl, z.schadenSeiten, z.schadenPlus, [art], skal)] : [];
  const reichweite = { override: false, units: 'self' };

  // Angriff wie die Chromatische Kugel, Rettungswurf wie der Feuerball.
  // Ohne beides keine Taetigkeit: dafuer liegt kein Beleg vor.
  const taetigkeiten: Record<string, unknown> = {};
  if (z.angriffswurf) {
    taetigkeiten[id] = taetigkeit(
      id,
      'attack',
      reichweite,
      {
        attack: { ability: '', bonus: '', critical: { threshold: null }, flat: false, type: { value: /berühr|touch/i.test(z.reichweite) ? 'melee' : 'ranged', classification: 'spell' } },
        damage: { critical: { bonus: '' }, includeBase: true, parts: schaden }
      },
      z.konzentration
    );
  } else if (z.rettungswurf) {
    taetigkeiten[id] = taetigkeit(
      id,
      'save',
      reichweite,
      {
        damage: { onSave: z.halbBeiErfolg ? 'half' : 'none', parts: schaden },
        save: { ability: [ATTRIBUT[z.rettungswurf] ?? z.rettungswurf], dc: { calculation: 'spellcasting', formula: '' }, visible: true }
      },
      z.konzentration
    );
  }

  const zusatz = [
    z.wirkungen.includes('heilung') && z.heilAnzahl > 0
      ? `<p><strong>Heilung / Healing:</strong> ${z.heilAnzahl}d${z.heilSeiten}${z.heilPlus ? ` + ${z.heilPlus}` : ''}</p>`
      : '',
    z.hoehererGrad.trim() ? `<p><strong>Höherer Grad / Higher level:</strong> ${maskiere(z.hoehererGrad.trim())}</p>` : ''
  ].join('');

  const g = grundfelder(z, zusatz);
  const system: Record<string, unknown> = {
    description: g.description,
    source: g.source,
    activation: aktivierung(z.zeit),
    duration: dauerFeld(z.dauer),
    target: {
      affects: { choice: false, count: '', type: z.ziel === 'flaeche' ? 'creature' : '', special: '' },
      template: z.ziel === 'flaeche'
        ? { units: 'ft', type: FLAECHE[z.flaeche] ?? '', size: String(z.flaecheGroesse), contiguous: false, count: '', stationary: false }
        : { units: 'ft', contiguous: false, type: '', stationary: false }
    },
    range: reichweiteFeld(z.reichweite),
    uses: { max: '', recovery: [], spent: 0 },
    level: z.grad,
    school: SCHULE[z.schule] ?? '',
    // Belegt: vocal, somatic, material. UNGEPRUEFT: concentration, ritual.
    properties: [
      ...(/\bV\b/.test(k) ? ['vocal'] : []),
      ...(/\b[SG]\b/.test(k) ? ['somatic'] : []),
      ...(/\bM\b/.test(k) ? ['material'] : []),
      ...(z.konzentration ? ['concentration'] : []),
      ...(z.ritual ? ['ritual'] : [])
    ],
    materials: { value: material, consumed: false, cost: 0, supply: 0 },
    activities: taetigkeiten,
    identifier: g.identifier,
    method: 'spell',
    prepared: 0
  };
  return huelle(z, 'spell', system, 'icons/magic/light/explosion-star-small-teal-purple.webp');
}
