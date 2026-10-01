/**
 * Handlungsstraenge (Rueckmeldung): mehrere Plots als Zweige von Ereignissen.
 *
 * Ein Strang ist eine geordnete Folge von Notizen. Er kann an einer Notiz
 * eines anderen Strangs abzweigen („Plot B beginnt ab der zweiten Notiz von
 * A“) und am Ende in einen anderen Strang muenden. Gespeichert in der
 * Kampagne, wie die Stellen im Graphen: die Notizen selbst bleiben unberuehrt.
 *
 * Plattformfrei: Pruefen und Anordnen, beides getestet.
 */

export interface Anschluss {
  readonly strang: string;
  readonly notiz: string;
}

export interface Strang {
  readonly id: string;
  readonly name: string;
  /** Index in der Farbreihe. */
  readonly farbe: number;
  readonly notizen: readonly string[];
  /** Wo er abzweigt: nach dieser Notiz jenes Strangs beginnt er. */
  readonly von?: Anschluss | null;
  /** Wo er muendet: nach seiner letzten Notiz geht es dort weiter. */
  readonly nach?: Anschluss | null;
}

export const STRANG_FARBEN = ['#d98a7c', '#8ec3e0', '#a3c48b', '#c4a35a', '#b39ddb', '#7fb3a8', '#e0a3c8', '#9fa8b8'] as const;

const kennung = (x: unknown) => (typeof x === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(x) ? x : null);

function anschluss(x: unknown): Anschluss | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const strang = kennung(r.strang);
  const notiz = typeof r.notiz === 'string' && r.notiz.length <= 200 ? r.notiz : null;
  return strang && notiz ? { strang, notiz } : null;
}

/** Prueft, was von Platte oder Oberflaeche kommt. `bekannt`: Notizen, die es gibt. */
export function bereinigeStraenge(roh: unknown, bekannt?: ReadonlySet<string>): Strang[] {
  if (!Array.isArray(roh)) return [];
  const heraus: Strang[] = [];
  const ids = new Set<string>();
  for (const x of roh.slice(0, 60)) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const id = kennung(r.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const notizen = (Array.isArray(r.notizen) ? r.notizen : [])
      .filter((n): n is string => typeof n === 'string' && n.length <= 200)
      .filter((n) => !bekannt || bekannt.has(n))
      .slice(0, 300);
    heraus.push({
      id,
      name: typeof r.name === 'string' ? r.name.slice(0, 80) : '',
      farbe: Number.isInteger(r.farbe) ? Math.abs(Number(r.farbe)) % STRANG_FARBEN.length : heraus.length % STRANG_FARBEN.length,
      notizen,
      von: anschluss(r.von),
      nach: anschluss(r.nach)
    });
  }
  // Anschluesse nur an Straenge und Notizen, die es gibt, und nie an sich selbst.
  const nach = new Map(heraus.map((s) => [s.id, s]));
  const gueltig = (a: Anschluss | null | undefined, selbst: string) =>
    a && a.strang !== selbst && nach.get(a.strang)?.notizen.includes(a.notiz) ? a : null;
  return heraus.map((s) => ({ ...s, von: gueltig(s.von, s.id), nach: gueltig(s.nach, s.id) }));
}

export interface Knoten {
  readonly strang: string;
  readonly notiz: string;
  readonly spalte: number;
  readonly zeile: number;
}

export interface Kante {
  readonly von: { spalte: number; zeile: number };
  readonly nach: { spalte: number; zeile: number };
  readonly art: 'folge' | 'abzweig' | 'muendung';
  readonly strang: string;
}

/**
 * Ordnet die Straenge an: je Strang eine Zeile, die Spalte ist die Stelle in
 * der Folge. Ein abzweigender Strang beginnt eine Spalte hinter seiner
 * Abzweignotiz. Ringe (A zweigt von B, B von A) werden gebrochen: dann
 * beginnt der spaetere bei Spalte 0.
 */
export function ordneStraenge(straenge: readonly Strang[]): { knoten: Knoten[]; kanten: Kante[]; spalten: number } {
  const nachId = new Map(straenge.map((s) => [s.id, s]));
  const zeile = new Map(straenge.map((s, i) => [s.id, i]));
  const start = new Map<string, number>();
  const inArbeit = new Set<string>();

  const startVon = (s: Strang): number => {
    const fertig = start.get(s.id);
    if (fertig !== undefined) return fertig;
    let wert = 0;
    if (s.von && !inArbeit.has(s.id)) {
      inArbeit.add(s.id);
      const eltern = nachId.get(s.von.strang);
      const stelle = eltern ? eltern.notizen.indexOf(s.von.notiz) : -1;
      if (eltern && stelle >= 0 && !inArbeit.has(eltern.id)) wert = startVon(eltern) + stelle + 1;
      inArbeit.delete(s.id);
    }
    start.set(s.id, wert);
    return wert;
  };

  const knoten: Knoten[] = [];
  const kanten: Kante[] = [];
  const ort = (strang: string, notiz: string) => {
    const s = nachId.get(strang);
    if (!s) return null;
    const i = s.notizen.indexOf(notiz);
    return i < 0 ? null : { spalte: startVon(s) + i, zeile: zeile.get(strang)! };
  };

  let spalten = 0;
  for (const s of straenge) {
    const anfang = startVon(s);
    s.notizen.forEach((notiz, i) => {
      knoten.push({ strang: s.id, notiz, spalte: anfang + i, zeile: zeile.get(s.id)! });
      spalten = Math.max(spalten, anfang + i + 1);
      if (i > 0) kanten.push({ von: { spalte: anfang + i - 1, zeile: zeile.get(s.id)! }, nach: { spalte: anfang + i, zeile: zeile.get(s.id)! }, art: 'folge', strang: s.id });
    });
    if (s.von && s.notizen.length) {
      const a = ort(s.von.strang, s.von.notiz);
      if (a) kanten.push({ von: a, nach: { spalte: anfang, zeile: zeile.get(s.id)! }, art: 'abzweig', strang: s.id });
    }
    if (s.nach && s.notizen.length) {
      const b = ort(s.nach.strang, s.nach.notiz);
      if (b) kanten.push({ von: { spalte: anfang + s.notizen.length - 1, zeile: zeile.get(s.id)! }, nach: b, art: 'muendung', strang: s.id });
    }
  }
  return { knoten, kanten, spalten };
}
