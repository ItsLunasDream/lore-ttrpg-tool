/**
 * Hinweise nach Klasse und Stufe (Rückmeldung): Trefferwürfel,
 * Rettungswürfe, Rüstung, Waffen, Werkzeug, Fertigkeiten zur Wahl,
 * Zaubertricks, vorbereitete Zauber und Zauberplätze.
 *
 * Die Zahlen stehen in den Klassentabellen des SRD 5.2.1 („Core … Traits",
 * „… Features", „Multiclass Spellcaster"); abgeschrieben aus beiden PDFs in
 * packages/srd/quelle und dort nachgeprüft. Halbe Zauberwirkende (Paladin,
 * Waldläufer) haben die Plätze der vollen Tabelle auf halber Stufe,
 * aufgerundet; so steht es auch in der Mehrklassenregel.
 *
 * Bei mehreren Klassen gelten Rettungswürfe, Rüstung, Waffen und Werkzeug
 * der ersten Klasse (Mehrklassen-Regeln geben für weitere Klassen nur einen
 * Teil davon; das steht nicht hier). Es bleiben Hinweise: übernommen wird
 * nur, was man anklickt.
 */
import type { Ruestungsuebung, Werte } from './bogen';
import { FERTIGKEITEN, type Attribut } from './regeln';
import { leereZauberei } from './zauber';

export type Klasse =
  | 'barbar'
  | 'barde'
  | 'druide'
  | 'hexenmeister'
  | 'kaempfer'
  | 'kleriker'
  | 'magier'
  | 'moench'
  | 'paladin'
  | 'schurke'
  | 'waldlaeufer'
  | 'zauberer';

type Paar = readonly [string, string];
type Zwanzig = readonly number[];

interface Klassendaten {
  readonly name: Paar;
  /** Anfänge, an denen der Name erkannt wird („Magierin" → „magier"). */
  readonly muster: readonly string[];
  readonly tw: number;
  readonly rettung: readonly [Attribut, Attribut];
  readonly ruestung: Ruestungsuebung;
  readonly waffen: Paar;
  readonly werkzeug?: Paar;
  /** Anzahl und Kennungen aus FERTIGKEITEN; null = beliebige. */
  readonly fertigkeiten: { readonly anzahl: number; readonly aus: readonly string[] | null };
  readonly zauber?: {
    readonly art: 'voll' | 'halb' | 'pakt';
    readonly attribut: Attribut;
    /** Je Stufe 1–20; fehlt bei Klassen ohne Zaubertricks. */
    readonly tricks?: Zwanzig;
    readonly vorbereitet: Zwanzig;
  };
}

const KEINE: Ruestungsuebung = { leicht: false, mittel: false, schwer: false, schilde: false };
const LEICHT: Ruestungsuebung = { ...KEINE, leicht: true };
const LEICHT_SCHILD: Ruestungsuebung = { ...LEICHT, schilde: true };
const MITTEL: Ruestungsuebung = { leicht: true, mittel: true, schwer: false, schilde: true };
const ALLE: Ruestungsuebung = { leicht: true, mittel: true, schwer: true, schilde: true };

const EINFACH: Paar = ['Einfache Waffen', 'Simple weapons'];
const KRIEG: Paar = ['Einfache Waffen und Kriegswaffen', 'Simple and Martial weapons'];

/** Zaubertricks: bis Stufe 3, 4–9, ab 10. */
function tricks(a: number, b: number, c: number): Zwanzig {
  return Array.from({ length: 20 }, (_, i) => (i < 3 ? a : i < 9 ? b : c));
}

const VORBEREITET_VOLL: Zwanzig = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const VORBEREITET_HALB: Zwanzig = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];

export const KLASSENDATEN: Readonly<Record<Klasse, Klassendaten>> = {
  barbar: {
    name: ['Barbar', 'Barbarian'],
    muster: ['barbar'],
    tw: 12,
    rettung: ['sta', 'kon'],
    ruestung: MITTEL,
    waffen: KRIEG,
    fertigkeiten: { anzahl: 2, aus: ['mit-tieren-umgehen', 'athletik', 'einschuechtern', 'naturkunde', 'wahrnehmung', 'ueberlebenskunst'] }
  },
  barde: {
    name: ['Barde', 'Bard'],
    muster: ['barde', 'bardin', 'bard'],
    tw: 8,
    rettung: ['ges', 'cha'],
    ruestung: LEICHT,
    waffen: EINFACH,
    werkzeug: ['Drei Musikinstrumente deiner Wahl', 'Three Musical Instruments of your choice'],
    fertigkeiten: { anzahl: 3, aus: null },
    zauber: { art: 'voll', attribut: 'cha', tricks: tricks(2, 3, 4), vorbereitet: VORBEREITET_VOLL }
  },
  druide: {
    name: ['Druide', 'Druid'],
    muster: ['druid'],
    tw: 8,
    rettung: ['int', 'wei'],
    ruestung: LEICHT_SCHILD,
    waffen: EINFACH,
    werkzeug: ['Kräuterkundeausrüstung', 'Herbalism Kit'],
    fertigkeiten: {
      anzahl: 2,
      aus: ['mit-tieren-umgehen', 'arkane-kunde', 'motiv-erkennen', 'heilkunde', 'naturkunde', 'wahrnehmung', 'religion', 'ueberlebenskunst']
    },
    zauber: { art: 'voll', attribut: 'wei', tricks: tricks(2, 3, 4), vorbereitet: VORBEREITET_VOLL }
  },
  hexenmeister: {
    name: ['Hexenmeister', 'Warlock'],
    muster: ['hexenmeister', 'warlock'],
    tw: 8,
    rettung: ['wei', 'cha'],
    ruestung: LEICHT,
    waffen: EINFACH,
    fertigkeiten: { anzahl: 2, aus: ['arkane-kunde', 'taeuschen', 'geschichte', 'einschuechtern', 'nachforschungen', 'naturkunde', 'religion'] },
    zauber: {
      art: 'pakt',
      attribut: 'cha',
      tricks: tricks(2, 3, 4),
      vorbereitet: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
    }
  },
  kaempfer: {
    name: ['Kämpfer', 'Fighter'],
    muster: ['kämpfer', 'kaempfer', 'fighter'],
    tw: 10,
    rettung: ['sta', 'kon'],
    ruestung: ALLE,
    waffen: KRIEG,
    fertigkeiten: {
      anzahl: 2,
      aus: ['akrobatik', 'mit-tieren-umgehen', 'athletik', 'geschichte', 'motiv-erkennen', 'einschuechtern', 'ueberzeugen', 'wahrnehmung', 'ueberlebenskunst']
    }
  },
  kleriker: {
    name: ['Kleriker', 'Cleric'],
    muster: ['kleriker', 'cleric'],
    tw: 8,
    rettung: ['wei', 'cha'],
    ruestung: MITTEL,
    waffen: EINFACH,
    fertigkeiten: { anzahl: 2, aus: ['geschichte', 'motiv-erkennen', 'heilkunde', 'ueberzeugen', 'religion'] },
    zauber: { art: 'voll', attribut: 'wei', tricks: tricks(3, 4, 5), vorbereitet: VORBEREITET_VOLL }
  },
  magier: {
    name: ['Magier', 'Wizard'],
    muster: ['magier', 'wizard'],
    tw: 6,
    rettung: ['int', 'wei'],
    ruestung: KEINE,
    waffen: EINFACH,
    fertigkeiten: { anzahl: 2, aus: ['arkane-kunde', 'geschichte', 'motiv-erkennen', 'nachforschungen', 'heilkunde', 'naturkunde', 'religion'] },
    zauber: {
      art: 'voll',
      attribut: 'int',
      tricks: tricks(3, 4, 5),
      vorbereitet: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25]
    }
  },
  moench: {
    name: ['Mönch', 'Monk'],
    muster: ['mönch', 'moench', 'monk'],
    tw: 8,
    rettung: ['sta', 'ges'],
    ruestung: KEINE,
    waffen: ['Einfache Waffen und Kriegswaffen mit der Eigenschaft Leicht', 'Simple weapons and Martial weapons that have the Light property'],
    werkzeug: ['Eine Art Handwerkszeug oder ein Musikinstrument', "One type of Artisan's Tools or Musical Instrument"],
    fertigkeiten: { anzahl: 2, aus: ['akrobatik', 'athletik', 'geschichte', 'motiv-erkennen', 'religion', 'heimlichkeit'] }
  },
  paladin: {
    name: ['Paladin', 'Paladin'],
    muster: ['paladin'],
    tw: 10,
    rettung: ['wei', 'cha'],
    ruestung: ALLE,
    waffen: KRIEG,
    fertigkeiten: { anzahl: 2, aus: ['athletik', 'motiv-erkennen', 'einschuechtern', 'heilkunde', 'ueberzeugen', 'religion'] },
    zauber: { art: 'halb', attribut: 'cha', vorbereitet: VORBEREITET_HALB }
  },
  schurke: {
    name: ['Schurke', 'Rogue'],
    muster: ['schurk', 'rogue'],
    tw: 8,
    rettung: ['ges', 'int'],
    ruestung: LEICHT,
    waffen: [
      'Einfache Waffen und Kriegswaffen mit der Eigenschaft Finesse oder Leicht',
      'Simple weapons and Martial weapons that have the Finesse or Light property'
    ],
    werkzeug: ['Diebeswerkzeug', "Thieves' Tools"],
    fertigkeiten: {
      anzahl: 4,
      aus: ['akrobatik', 'athletik', 'taeuschen', 'motiv-erkennen', 'einschuechtern', 'nachforschungen', 'wahrnehmung', 'ueberzeugen', 'fingerfertigkeit', 'heimlichkeit']
    }
  },
  waldlaeufer: {
    name: ['Waldläufer', 'Ranger'],
    muster: ['waldläufer', 'waldlaeufer', 'ranger'],
    tw: 10,
    rettung: ['sta', 'ges'],
    ruestung: MITTEL,
    waffen: KRIEG,
    fertigkeiten: {
      anzahl: 3,
      aus: ['mit-tieren-umgehen', 'athletik', 'motiv-erkennen', 'nachforschungen', 'naturkunde', 'wahrnehmung', 'heimlichkeit', 'ueberlebenskunst']
    },
    zauber: { art: 'halb', attribut: 'wei', vorbereitet: VORBEREITET_HALB }
  },
  zauberer: {
    name: ['Zauberer', 'Sorcerer'],
    muster: ['zauberer', 'zauberin', 'sorcerer'],
    tw: 6,
    rettung: ['kon', 'cha'],
    ruestung: KEINE,
    waffen: EINFACH,
    fertigkeiten: { anzahl: 2, aus: ['arkane-kunde', 'taeuschen', 'motiv-erkennen', 'einschuechtern', 'ueberzeugen', 'religion'] },
    zauber: {
      art: 'voll',
      attribut: 'cha',
      tricks: tricks(4, 5, 6),
      vorbereitet: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
    }
  }
};

/** Welche Klasse ein eingetragener Name meint; null, wenn keine passt. */
export function klasseAusName(roh: string): Klasse | null {
  const name = roh.trim().toLowerCase();
  if (!name) return null;
  for (const [k, d] of Object.entries(KLASSENDATEN) as [Klasse, Klassendaten][]) {
    if (d.muster.some((m) => name.startsWith(m))) return k;
  }
  return null;
}

/** „Multiclass Spellcaster" im SRD: Plätze der Grade 1–9 je Zauberstufe 1–20. */
export const PLAETZE: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

/** Paktmagie des Hexenmeisters: Anzahl der Plätze und ihr Grad je Stufe. */
const PAKT_ANZAHL: Zwanzig = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PAKT_GRAD: Zwanzig = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

function stufeIn(n: number): number {
  return Math.max(1, Math.min(20, Math.round(n) || 1));
}

export interface Zauberplaetze {
  /** Grade 1–9, je die Anzahl. */
  readonly plaetze: readonly number[];
  readonly pakt: { readonly anzahl: number; readonly grad: number } | null;
}

/** Plätze nach der Mehrklassenregel; null, wenn keine Klasse zaubert. */
export function zauberplaetze(klassen: readonly { name: string; stufe: number }[]): Zauberplaetze | null {
  let stufe = 0;
  let pakt: Zauberplaetze['pakt'] = null;
  for (const k of klassen) {
    const id = klasseAusName(k.name);
    const art = id ? KLASSENDATEN[id].zauber?.art : undefined;
    const s = stufeIn(k.stufe);
    if (art === 'voll') stufe += s;
    else if (art === 'halb') stufe += Math.ceil(s / 2);
    else if (art === 'pakt') pakt = { anzahl: PAKT_ANZAHL[s - 1], grad: PAKT_GRAD[s - 1] };
  }
  if (!stufe && !pakt) return null;
  const reihe = stufe ? PLAETZE[Math.min(20, stufe) - 1] : [];
  return { plaetze: Array.from({ length: 9 }, (_, i) => reihe[i] ?? 0), pakt };
}

export type HinweisArt =
  | 'trefferwuerfel'
  | 'rettung'
  | 'ruestung'
  | 'waffen'
  | 'werkzeug'
  | 'fertigkeiten'
  | 'zauberattribut'
  | 'tricks'
  | 'vorbereitet'
  | 'plaetze'
  | 'pakt';

export interface Hinweis {
  readonly art: HinweisArt;
  /** Was die Klassentabelle sagt, in der Sprache der Oberfläche. */
  readonly text: string;
  /** Ob der Bogen davon abweicht. */
  readonly abweichung: boolean;
  /** Übernimmt den Wert der Tabelle; fehlt, wo es nichts zu übernehmen gibt. */
  readonly uebernehmen?: (w: Werte) => Werte;
}

const ATTR: Record<Attribut, Paar> = {
  sta: ['Stärke', 'Strength'],
  ges: ['Geschicklichkeit', 'Dexterity'],
  kon: ['Konstitution', 'Constitution'],
  int: ['Intelligenz', 'Intelligence'],
  wei: ['Weisheit', 'Wisdom'],
  cha: ['Charisma', 'Charisma']
};

function ruestungText(r: Ruestungsuebung, de: boolean): string {
  const teile = [
    r.leicht ? (de ? 'leicht' : 'light') : '',
    r.mittel ? (de ? 'mittelschwer' : 'medium') : '',
    r.schwer ? (de ? 'schwer' : 'heavy') : '',
    r.schilde ? (de ? 'Schilde' : 'shields') : ''
  ].filter(Boolean);
  return teile.length ? teile.join(', ') : de ? 'keine' : 'none';
}

const gleicheMenge = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Die Hinweise zu den eingetragenen Klassen; leer, wenn keine erkannt wird. */
export function klassenhinweise(w: Werte, sprache: 'de' | 'en'): Hinweis[] {
  const de = sprache === 'de';
  const i = de ? 0 : 1;
  const erkannt = w.klassen
    .map((k) => ({ id: klasseAusName(k.name), stufe: stufeIn(k.stufe) }))
    .filter((k): k is { id: Klasse; stufe: number } => k.id !== null);
  if (!erkannt.length) return [];
  const heraus: Hinweis[] = [];
  const erste = KLASSENDATEN[erkannt[0].id];

  // Trefferwürfel: alle Klassen, gleiche Würfel zusammen.
  const tw = new Map<number, number>();
  for (const k of erkannt) {
    const s = KLASSENDATEN[k.id].tw;
    tw.set(s, (tw.get(s) ?? 0) + k.stufe);
  }
  const twSoll = [...tw.entries()].sort((a, b) => b[0] - a[0]);
  const twIst = w.trefferwuerfel.filter((t) => t.gesamt > 0);
  heraus.push({
    art: 'trefferwuerfel',
    text: `${de ? 'Trefferwürfel' : 'Hit dice'}: ${twSoll.map(([s, n]) => `${n}${de ? 'W' : 'd'}${s}`).join(' + ')}`,
    abweichung: twSoll.length !== twIst.length || twSoll.some(([s, n]) => !twIst.some((t) => t.seiten === s && t.gesamt === n)),
    uebernehmen: (x) => ({
      ...x,
      trefferwuerfel: twSoll.map(([seiten, gesamt]) => {
        const alt = x.trefferwuerfel.find((t) => t.seiten === seiten);
        return { seiten, gesamt, uebrig: alt ? Math.min(gesamt, alt.uebrig) : gesamt };
      })
    })
  });

  heraus.push({
    art: 'rettung',
    text: `${de ? 'Rettungswürfe' : 'Saving throws'}: ${erste.rettung.map((a) => ATTR[a][i]).join(de ? ' und ' : ' and ')}`,
    abweichung: !gleicheMenge(w.rettung, erste.rettung),
    uebernehmen: (x) => ({ ...x, rettung: [...erste.rettung] })
  });

  const r = erste.ruestung;
  heraus.push({
    art: 'ruestung',
    text: `${de ? 'Rüstung' : 'Armor'}: ${ruestungText(r, de)}`,
    abweichung: (Object.keys(r) as (keyof Ruestungsuebung)[]).some((k) => r[k] && !w.ruestungsuebung[k]),
    // Nur dazu, nichts weg: anderes kann aus Talenten oder der Spezies kommen.
    uebernehmen: (x) => ({
      ...x,
      ruestungsuebung: {
        leicht: x.ruestungsuebung.leicht || r.leicht,
        mittel: x.ruestungsuebung.mittel || r.mittel,
        schwer: x.ruestungsuebung.schwer || r.schwer,
        schilde: x.ruestungsuebung.schilde || r.schilde
      }
    })
  });

  heraus.push({
    art: 'waffen',
    text: `${de ? 'Waffen' : 'Weapons'}: ${erste.waffen[i]}`,
    abweichung: !w.waffenuebung.trim(),
    uebernehmen: (x) => (x.waffenuebung.trim() ? x : { ...x, waffenuebung: erste.waffen[i] })
  });

  if (erste.werkzeug) {
    const wz = erste.werkzeug[i];
    heraus.push({
      art: 'werkzeug',
      text: `${de ? 'Werkzeug' : 'Tools'}: ${wz}`,
      abweichung: !w.werkzeuguebung.trim(),
      uebernehmen: (x) => (x.werkzeuguebung.trim() ? x : { ...x, werkzeuguebung: wz })
    });
  }

  const f = erste.fertigkeiten;
  const namen = f.aus ? f.aus.map((id) => FERTIGKEITEN.find((x) => x.id === id)?.name[i] ?? id) : null;
  const geuebt = Object.values(w.fertigkeiten).filter((u) => u >= 1).length;
  heraus.push({
    art: 'fertigkeiten',
    text: namen
      ? `${de ? `Fertigkeiten: ${f.anzahl} aus` : `Skills: choose ${f.anzahl} from`} ${namen.join(', ')}`
      : de
        ? `Fertigkeiten: ${f.anzahl} beliebige`
        : `Skills: any ${f.anzahl}`,
    // Spezies und Hintergrund geben weitere; weniger als die Klasse allein ist sicher zu wenig.
    abweichung: geuebt < f.anzahl
  });

  // Zauber: Attribut und Zahlen der ersten zaubernden Klasse, Plätze nach der Mehrklassenregel.
  const zaubernd = erkannt.filter((k) => KLASSENDATEN[k.id].zauber);
  if (zaubernd.length) {
    const zk = KLASSENDATEN[zaubernd[0].id].zauber!;
    heraus.push({
      art: 'zauberattribut',
      text: `${de ? 'Zauberattribut' : 'Spellcasting ability'}: ${ATTR[zk.attribut][i]}`,
      abweichung: w.zauber?.attribut !== zk.attribut,
      uebernehmen: (x) => ({ ...x, zauber: { ...(x.zauber ?? leereZauberei(zk.attribut)), attribut: zk.attribut } })
    });
    const tricksText = zaubernd
      .filter((k) => KLASSENDATEN[k.id].zauber?.tricks)
      .map((k) => `${KLASSENDATEN[k.id].zauber!.tricks![k.stufe - 1]}${zaubernd.length > 1 ? ` (${KLASSENDATEN[k.id].name[i]})` : ''}`);
    if (tricksText.length) {
      heraus.push({ art: 'tricks', text: `${de ? 'Zaubertricks' : 'Cantrips'}: ${tricksText.join(' + ')}`, abweichung: false });
    }
    const vorbereitet = zaubernd.reduce((s, k) => s + KLASSENDATEN[k.id].zauber!.vorbereitet[k.stufe - 1], 0);
    heraus.push({
      art: 'vorbereitet',
      text: `${de ? 'Vorbereitete Zauber' : 'Prepared spells'}: ${vorbereitet}`,
      abweichung: (w.zauber?.maxVorbereitet ?? null) !== vorbereitet,
      uebernehmen: (x) => ({ ...x, zauber: { ...(x.zauber ?? leereZauberei(zk.attribut)), maxVorbereitet: vorbereitet } })
    });
    const p = zauberplaetze(w.klassen)!;
    const nurPakt = p.pakt !== null && p.plaetze.every((n) => n === 0);
    if (p.plaetze.some((n) => n > 0)) {
      const soll = p.plaetze;
      heraus.push({
        art: 'plaetze',
        text: `${de ? 'Zauberplätze' : 'Spell slots'}: ${soll.filter((n) => n > 0).join(' / ')}`,
        abweichung: !w.zauber || w.zauber.plaetze.some((q) => q.max !== soll[q.grad - 1]),
        uebernehmen: (x) => {
          const z = x.zauber ?? leereZauberei(zk.attribut);
          return {
            ...x,
            zauber: { ...z, plaetze: z.plaetze.map((q) => ({ ...q, max: soll[q.grad - 1], verbraucht: Math.min(q.verbraucht, soll[q.grad - 1]) })) }
          };
        }
      });
    }
    if (p.pakt) {
      const { anzahl, grad } = p.pakt;
      heraus.push({
        art: 'pakt',
        text: de ? `Paktmagie: ${anzahl} Plätze des ${grad}. Grades (kurze Rast)` : `Pact Magic: ${anzahl} level ${grad} slots (Short Rest)`,
        abweichung: nurPakt && (!w.zauber || !w.zauber.kurzeRast || w.zauber.plaetze.some((q) => q.max !== (q.grad === grad ? anzahl : 0))),
        // Ein Bogen hat eine Reihe Plätze; mit anderen Zauberklassen trägt man die Paktplätze selbst ein.
        ...(nurPakt
          ? {
              uebernehmen: (x: Werte) => {
                const z = x.zauber ?? leereZauberei(zk.attribut);
                return {
                  ...x,
                  zauber: {
                    ...z,
                    kurzeRast: true,
                    plaetze: z.plaetze.map((q) => {
                      const max = q.grad === grad ? anzahl : 0;
                      return { ...q, max, verbraucht: Math.min(q.verbraucht, max) };
                    })
                  }
                };
              }
            }
          : {})
      });
    }
  }
  return heraus;
}
