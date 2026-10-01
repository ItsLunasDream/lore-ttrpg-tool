/**
 * Zeitzonen im Campaign Calendar.
 *
 * Eine Umfrage merkt sich die Zeitzone der Person, die sie anlegt. Die Felder
 * („JJJJ-MM-TT" + Minute) gelten in dieser Zone. Wer woanders sitzt, sieht
 * das Raster in der eigenen Zone: dieselben Felder, nur mit umgerechneten
 * Tagen und Uhrzeiten. Ohne Zone (ältere Umfragen) wird nicht umgerechnet.
 *
 * Ohne Bibliothek, nur mit Intl; das kann Electron (Chromium/Node) vollständig.
 */
// Bewusst ohne Import aus modell.ts: modell.ts braucht `zuUtc` für die .ics.
interface Umfrage {
  readonly zone: string;
  readonly tage: readonly string[];
  readonly von: number;
  readonly bis: number;
  readonly schritt: number;
}
const feld = (tag: string, minute: number) => `${tag}T${minute}`;
function zeiten(u: Pick<Umfrage, 'von' | 'bis' | 'schritt'>): number[] {
  const heraus: number[] = [];
  for (let m = u.von; m < u.bis; m += u.schritt) heraus.push(m);
  return heraus;
}

const formate = new Map<string, Intl.DateTimeFormat>();

function format(zone: string): Intl.DateTimeFormat {
  let f = formate.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    formate.set(zone, f);
  }
  return f;
}

export function istZone(zone: string): boolean {
  if (!zone) return false;
  try {
    format(zone);
    return true;
  } catch {
    return false;
  }
}

/** Die Zone dieses Rechners, z. B. „Europe/Berlin". */
export function eigeneZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Alle Zonen, die Intl kennt (für die Auswahl). */
export function alleZonen(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return [eigeneZone(), 'UTC'];
  }
}

/** Ortszeit eines UTC-Zeitpunkts in einer Zone. */
export function ausUtc(ms: number, zone: string): { tag: string; minute: number } {
  const teile: Record<string, string> = {};
  for (const p of format(zone).formatToParts(new Date(ms))) teile[p.type] = p.value;
  return { tag: `${teile.year}-${teile.month}-${teile.day}`, minute: Number(teile.hour) * 60 + Number(teile.minute) };
}

/** Abstand der Zone zu UTC in Minuten zu einem Zeitpunkt. */
function versatz(zone: string, ms: number): number {
  const o = ausUtc(ms, zone);
  const alsUtc = Date.parse(`${o.tag}T00:00:00Z`) + o.minute * 60_000;
  return Math.round((alsUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** UTC-Zeitpunkt einer Ortszeit; Minuten über 24 Uhr hinaus zählen in den nächsten Tag. */
export function zuUtc(tag: string, minute: number, zone: string): number {
  const naiv = Date.parse(`${tag}T00:00:00Z`) + minute * 60_000;
  let ms = naiv - versatz(zone, naiv) * 60_000;
  // Um eine Zeitumstellung herum stimmt der erste Versatz nicht immer.
  const zweiter = naiv - versatz(zone, ms) * 60_000;
  if (zweiter !== ms) ms = zweiter;
  return ms;
}

/** Eine Zeit der Umfrage (in ihrer Zone) in der Zone der betrachtenden Person. */
export function umgerechnet(u: Pick<Umfrage, 'zone'>, tag: string, minute: number, ziel: string): { tag: string; minute: number } {
  if (!u.zone || u.zone === ziel || !istZone(u.zone) || !istZone(ziel)) return { tag, minute };
  return ausUtc(zuUtc(tag, minute, u.zone), ziel);
}

/** Ein Zeitraum der Umfrage in der Zielzone; `bis` darf über Mitternacht gehen. */
export function zeitraum(u: Pick<Umfrage, 'zone'>, t: { tag: string; von: number; bis: number }, ziel: string): { tag: string; von: number; bis: number } {
  const a = umgerechnet(u, t.tag, t.von, ziel);
  return { tag: a.tag, von: a.minute, bis: a.minute + (t.bis - t.von) };
}

export interface Ansicht {
  /** Spalten in der Zielzone. */
  readonly tage: readonly string[];
  /** Zeilen in der Zielzone (Minuten ab Mitternacht). */
  readonly minuten: readonly number[];
  /** Das Feld der Umfrage hinter einer Zelle, oder null (Zelle gehört nicht zur Umfrage). */
  feldAn(tag: string, minute: number): string | null;
}

/** Das Raster einer Umfrage so, wie es in der Zielzone aussieht. */
export function ansicht(u: Umfrage, ziel: string): Ansicht {
  const zs = zeiten(u);
  if (!u.zone || u.zone === ziel || !istZone(u.zone) || !istZone(ziel)) {
    const gueltig = new Set(u.tage);
    return {
      tage: u.tage,
      minuten: zs,
      feldAn: (tag, minute) => (gueltig.has(tag) && zs.includes(minute) ? feld(tag, minute) : null)
    };
  }
  const karte = new Map<string, string>();
  const tage = new Set<string>();
  const minuten = new Set<number>();
  for (const tag of u.tage) {
    for (const m of zs) {
      const o = ausUtc(zuUtc(tag, m, u.zone), ziel);
      karte.set(`${o.tag}T${o.minute}`, feld(tag, m));
      tage.add(o.tag);
      minuten.add(o.minute);
    }
  }
  return {
    tage: [...tage].sort(),
    minuten: [...minuten].sort((a, b) => a - b),
    feldAn: (tag, minute) => karte.get(`${tag}T${minute}`) ?? null
  };
}
