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
 * Ordnet die Straenge an: je Strang eine Zeile, jede Notiz eine Spalte.
 * Regeln wie bei Git:
 *
 * - Im Strang folgt jede Notiz rechts von der vorigen.
 * - Ein abzweigender Strang beginnt rechts von seiner Abzweignotiz.
 * - Die Mündungsnotiz liegt rechts von der letzten Notiz des mündenden
 *   Strangs (Rückmeldung: sonst sah eine Mündung wie eine Abzweigung aus).
 *   Dafür rücken nur die Notizen ab der Mündung nach rechts; davor bleibt
 *   eine Lücke im Strang, wie in einem Git-Graphen.
 *
 * Gelöst durch Nachschieben, bis nichts mehr rückt (längster Weg). Ringe
 * lassen sich nicht erfüllen; nach begrenzt vielen Runden wird der Stand
 * genommen.
 */
export function ordneStraenge(straenge: readonly Strang[]): { knoten: Knoten[]; kanten: Kante[]; spalten: number } {
  const nachId = new Map(straenge.map((s) => [s.id, s]));
  const zeile = new Map(straenge.map((s, i) => [s.id, i]));
  /** Spalte je Notiz, je Strang. */
  const spalteVon = new Map(straenge.map((s) => [s.id, s.notizen.map((_, i) => i)]));
  const gesamt = straenge.reduce((n, s) => n + s.notizen.length, 0);
  for (let runde = 0; runde <= gesamt + 1; runde += 1) {
    let geaendert = false;
    const mindestens = (id: string, i: number, wert: number) => {
      const liste = spalteVon.get(id)!;
      if (wert > liste[i]) {
        liste[i] = wert;
        geaendert = true;
      }
    };
    for (const s of straenge) {
      const eigene = spalteVon.get(s.id)!;
      if (s.von && s.notizen.length) {
        const eltern = nachId.get(s.von.strang);
        const stelle = eltern ? eltern.notizen.indexOf(s.von.notiz) : -1;
        if (eltern && stelle >= 0) mindestens(s.id, 0, spalteVon.get(eltern.id)![stelle] + 1);
      }
      for (let i = 1; i < eigene.length; i += 1) mindestens(s.id, i, eigene[i - 1] + 1);
      if (s.nach && s.notizen.length) {
        const ziel = nachId.get(s.nach.strang);
        const stelle = ziel ? ziel.notizen.indexOf(s.nach.notiz) : -1;
        if (ziel && stelle >= 0) mindestens(ziel.id, stelle, eigene[eigene.length - 1] + 1);
      }
    }
    if (!geaendert) break;
  }

  const knoten: Knoten[] = [];
  const kanten: Kante[] = [];
  const ort = (strang: string, notiz: string) => {
    const s = nachId.get(strang);
    if (!s) return null;
    const i = s.notizen.indexOf(notiz);
    return i < 0 ? null : { spalte: spalteVon.get(strang)![i], zeile: zeile.get(strang)! };
  };

  let spalten = 0;
  for (const s of straenge) {
    const sp = spalteVon.get(s.id)!;
    const z = zeile.get(s.id)!;
    s.notizen.forEach((notiz, i) => {
      knoten.push({ strang: s.id, notiz, spalte: sp[i], zeile: z });
      spalten = Math.max(spalten, sp[i] + 1);
      if (i > 0) kanten.push({ von: { spalte: sp[i - 1], zeile: z }, nach: { spalte: sp[i], zeile: z }, art: 'folge', strang: s.id });
    });
    if (s.von && s.notizen.length) {
      const a = ort(s.von.strang, s.von.notiz);
      if (a) kanten.push({ von: a, nach: { spalte: sp[0], zeile: z }, art: 'abzweig', strang: s.id });
    }
    if (s.nach && s.notizen.length) {
      const b = ort(s.nach.strang, s.nach.notiz);
      if (b) kanten.push({ von: { spalte: sp[sp.length - 1], zeile: z }, nach: b, art: 'muendung', strang: s.id });
    }
  }
  return { knoten, kanten, spalten };
}
