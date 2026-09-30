/**
 * Woher Gegenstaende ins Inventar kommen (docs/charakterbogen.md,
 * Schritt 7): SRD-Ausruestung (Waffen, Ruestungen, Abenteurerausruestung),
 * magische Gegenstaende des SRD, eigene aus dem Magic Item Creator und
 * Wuerfe auf Loot-Tabellen.
 *
 * Hier stehen nur die SRD-Quellen und die Umwandlung in einen Gegenstand.
 * Eigene Gegenstaende und Loot liefert die Huelle (die Werkzeuge kennen
 * einander nicht).
 */
import { AUSRUESTUNG } from '@suite/srd/ausruestung';
import { MAGISCHE_GEGENSTAENDE } from '@suite/srd/magische-gegenstaende';
import { neueKennung, type Gegenstand } from './inventar';
import { WAFFEN } from './waffen';

export type Quellart = 'srd' | 'srd-magie' | 'magicitem' | 'loot';

export interface Quelleintrag {
  readonly quelle: Quellart;
  readonly kennung: string;
  readonly name: string;
  /** Kurz, zum Suchen und Anzeigen: „Kriegswaffe", „Rüstung", „Wundersamer Gegenstand, selten". */
  readonly art: string;
  /** lb je Stueck. */
  readonly gewicht: number | null;
  /** GM je Stueck. */
  readonly wert: number | null;
  readonly beschreibung: string;
  readonly einstimmung?: boolean;
  readonly waffe?: { readonly id: string; readonly magie: number; readonly geuebt: boolean };
}

type Reihe = readonly string[];

function tabelle(id: string, sprache: 'de' | 'en'): Reihe[] {
  const e = AUSRUESTUNG.find((x) => x.id === id);
  const b = e?.bloecke[sprache].find((x) => x.typ === 'tabelle') as { reihen?: Reihe[] } | undefined;
  return b?.reihen ?? [];
}

function preisInGold(text: string): number | null {
  const m = /^([\d.,]+)\s*(GP|SP|CP|GM|SM|KM|PP|PM|EP|EM)$/i.exec(text.trim());
  if (!m) return null;
  // Englisch „1,500 GP", deutsch „1.500 GM": Tausendertrenner weg.
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
  const faktor: Record<string, number> = { GP: 1, GM: 1, SP: 0.1, SM: 0.1, CP: 0.01, KM: 0.01, PP: 10, PM: 10, EP: 0.5, EM: 0.5 };
  return Number.isFinite(n) ? Math.round(n * faktor[m[2].toUpperCase()] * 100) / 100 : null;
}

function gewichtLb(text: string): number | null {
  const m = /^([\d/.,]+)\s*lb/.exec(text.trim());
  if (!m) return null;
  const [a, b] = m[1].replace(',', '').split('/');
  const n = b ? Number(a) / Number(b) : Number(a);
  return Number.isFinite(n) ? n : null;
}

const ohneKlammer = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

function absaetze(bloecke: readonly { typ: string; text?: string }[]): string {
  return bloecke
    .filter((b) => typeof b.text === 'string')
    .map((b) => (b.typ === 'absatz' ? b.text : `• ${b.text}`))
    .join('\n\n')
    .slice(0, 4000);
}

let ausruestungCache: { de?: Quelleintrag[]; en?: Quelleintrag[] } = {};

/** Waffen, Ruestungen und Abenteurerausruestung des SRD. */
export function srdAusruestung(sprache: 'de' | 'en'): Quelleintrag[] {
  const fertig = ausruestungCache[sprache];
  if (fertig) return fertig;
  const i = sprache === 'de' ? 0 : 1;
  const de = sprache === 'de';
  const heraus: Quelleintrag[] = [];

  for (const w of WAFFEN) {
    heraus.push({
      quelle: 'srd',
      kennung: `waffe:${w.id}`,
      name: w.name[i],
      art: w.kategorie === 'einfach' ? (de ? 'Einfache Waffe' : 'Simple weapon') : de ? 'Kriegswaffe' : 'Martial weapon',
      gewicht: w.gewicht,
      wert: w.wert,
      beschreibung: `${w.wuerfel} ${w.art[i]} · ${w.eigenschaften[i]} · ${de ? 'Meisterschaft' : 'Mastery'}: ${w.meisterschaft[i]}`,
      waffe: { id: w.id, magie: 0, geuebt: true }
    });
  }

  // Ruestungen: beide Sprachen in derselben Reihenfolge (Ueberschriften mit leerer RK-Spalte).
  const rde = tabelle('armor', 'de');
  const ren = tabelle('armor', 'en');
  ren.forEach((r, n) => {
    const d = rde[n];
    if (!r[1] || !d) return;
    const z = de ? d : r;
    heraus.push({
      quelle: 'srd',
      kennung: `ruestung:${r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: z[0],
      art: de ? 'Rüstung' : 'Armor',
      gewicht: gewichtLb(r[4]),
      wert: preisInGold(r[5]),
      beschreibung: `${de ? 'RK' : 'AC'} ${z[1]}${z[2] && z[2] !== '—' && z[2] !== '−' ? ` · ${de ? 'Stärke' : 'Strength'} ${z[2]}` : ''}${
        z[3] && z[3] !== '—' && z[3] !== '−' ? ` · ${de ? 'Heimlichkeit' : 'Stealth'}: ${z[3]}` : ''
      }`
    });
  });

  // Abenteurerausruestung: Namen gepaart ueber die Eintraege, Gewicht und Preis aus der englischen Tabelle.
  const zeilen = new Map(tabelle('adventuring-gear', 'en').map((r) => [r[0], r]));
  for (const e of AUSRUESTUNG) {
    if (e.abschnitt.en !== 'Adventuring Gear' || e.kasten) continue;
    const r = zeilen.get(ohneKlammer(e.name.en));
    if (!r) continue;
    heraus.push({
      quelle: 'srd',
      kennung: `ausruestung:${e.id}`,
      name: ohneKlammer(e.name[sprache]),
      art: de ? 'Ausrüstung' : 'Gear',
      gewicht: gewichtLb(r[1]),
      wert: preisInGold(r[2]),
      beschreibung: absaetze(e.bloecke[sprache] as never)
    });
  }
  ausruestungCache = { ...ausruestungCache, [sprache]: heraus };
  return heraus;
}

let magieCache: { de?: Quelleintrag[]; en?: Quelleintrag[] } = {};

/** Die magischen Gegenstaende des SRD (ohne Gewicht und Preis: das SRD nennt nur die Seltenheit). */
export function srdMagie(sprache: 'de' | 'en'): Quelleintrag[] {
  const fertig = magieCache[sprache];
  if (fertig) return fertig;
  const heraus = MAGISCHE_GEGENSTAENDE.map(
    (m): Quelleintrag => ({
      quelle: 'srd-magie',
      kennung: m.id,
      name: m.name[sprache],
      art: m.kopfzeile[sprache],
      gewicht: null,
      wert: null,
      beschreibung: absaetze(m.bloecke[sprache] as never),
      einstimmung: m.einstimmung
    })
  );
  magieCache = { ...magieCache, [sprache]: heraus };
  return heraus;
}

/** Suche ueber Name und Art, alle Worte muessen passen. */
export function sucheQuellen(liste: readonly Quelleintrag[], anfrage: string, hoechstens = 60): Quelleintrag[] {
  const worte = anfrage.toLowerCase().split(/\s+/).filter(Boolean);
  return liste.filter((e) => worte.every((w) => `${e.name} ${e.art}`.toLowerCase().includes(w))).slice(0, hoechstens);
}

/** Ein Quelleintrag als Gegenstand im Inventar. */
export function alsGegenstand(e: Quelleintrag, anzahl = 1): Gegenstand {
  const art = e.quelle === 'magicitem' ? 'magicitem' : e.quelle === 'loot' ? 'loot' : 'srd';
  return {
    id: neueKennung(),
    name: e.name.slice(0, 120),
    beschreibung: e.beschreibung.slice(0, 20_000),
    anzahl: Math.max(1, Math.floor(anzahl)),
    gewicht: e.gewicht,
    wert: e.wert,
    ausgeruestet: false,
    eingestimmt: false,
    quelle: { art, kennung: e.kennung.slice(0, 120) },
    ...(e.waffe ? { waffe: { ...e.waffe } } : {})
  };
}
