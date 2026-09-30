/**
 * Was der Wuerfel sich merkt.
 *
 * Das Aussehen und die Schalter fuer die Effekte sind Einstellungen und
 * bleiben. Der Verlauf nicht — er gehoert zur Sitzung und wird bewusst nicht
 * geschrieben.
 */
export const MUSTER = ['schlicht', 'marmor', 'metall', 'sternenhimmel', 'lack', 'perlmutt', 'kristall', 'holz'] as const;
export type Muster = (typeof MUSTER)[number];

export interface Einstellungen {
  readonly schemaVersion: number;
  /** Grundfarbe aller Wuerfel als #rrggbb. Frei waehlbar. */
  readonly farbe: string;
  readonly muster: Muster;
  readonly glitzerAn: boolean;
  /**
   * Ob die Wuerfel als Koerper fallen statt als flache Umrisse zu drehen.
   *
   * Standard ist aus: die flache Darstellung laeuft ueberall, die andere
   * braucht Grafikbeschleunigung. Wer sie will, schaltet sie ein.
   */
  readonly dreiD: boolean;
  readonly streifenAn: boolean;
  /** Seitenzahl des eigenen Wuerfels. */
  readonly eigeneSeiten: number;
  readonly sprache: 'de' | 'en';
  /**
   * Ob Wuerfe in den Raum gehen (Teilen, im lokalen Netz): gar nicht, an
   * alle oder nur an die Spielleitung (den Gastgeber des Raums).
   */
  readonly teilen: Teilen;
}

export const TEILEN = ['aus', 'alle', 'dm'] as const;
export type Teilen = (typeof TEILEN)[number];

export const STANDARD: Einstellungen = {
  schemaVersion: 1,
  farbe: '#7aa2f7',
  muster: 'schlicht',
  glitzerAn: true,
  streifenAn: true,
  dreiD: false,
  eigeneSeiten: 3,
  sprache: 'en',
  teilen: 'aus'
};

/**
 * Liest Einstellungen nachsichtig: was fehlt oder unsinnig ist, wird durch
 * den Standardwert ersetzt, statt die Datei abzulehnen.
 */
export function bereinige(roh: unknown): Einstellungen {
  const e = (roh ?? {}) as Partial<Einstellungen>;
  const farbe = typeof e.farbe === 'string' && /^#[0-9a-f]{6}$/i.test(e.farbe) ? e.farbe : STANDARD.farbe;
  const muster = MUSTER.includes(e.muster as Muster) ? (e.muster as Muster) : STANDARD.muster;
  const seiten =
    typeof e.eigeneSeiten === 'number' && Number.isFinite(e.eigeneSeiten)
      ? Math.max(2, Math.min(1000, Math.trunc(e.eigeneSeiten)))
      : STANDARD.eigeneSeiten;
  return {
    schemaVersion: 1,
    farbe,
    muster,
    glitzerAn: e.glitzerAn !== false,
    streifenAn: e.streifenAn !== false,
    // Anders herum als die beiden darueber: aus ist der Standard, also zaehlt
    // nur ein ausdrueckliches true.
    dreiD: e.dreiD === true,
    eigeneSeiten: seiten,
    sprache: e.sprache === 'de' ? 'de' : 'en',
    teilen: TEILEN.includes(e.teilen as Teilen) ? (e.teilen as Teilen) : STANDARD.teilen
  };
}

/**
 * Die Farbe, in der die Zahl auf dem Wuerfel steht.
 *
 * Berechnet und nicht eingestellt, und das ist der Grund: die Wuerfelfarbe ist
 * frei waehlbar, und auf Hellgelb ist eine weisse Zahl unlesbar. Das faellt
 * erst am Spieltisch auf, wenn niemand mehr etwas daran aendern kann.
 *
 * Gerechnet wird mit der relativen Leuchtdichte nach WCAG — nicht mit dem
 * einfachen Mittel der drei Kanaele: Gruen traegt viel mehr zur empfundenen
 * Helligkeit bei als Blau, und ein reines Blau bekaeme sonst eine schwarze
 * Zahl, obwohl es dunkel wirkt.
 */
export function zahlenFarbe(farbe: string): string {
  const treffer = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(farbe);
  if (!treffer) return '#ffffff';
  const kanal = (hex: string): number => {
    const wert = parseInt(hex, 16) / 255;
    // Die Gammakorrektur gehoert dazu: ohne sie liegt die Schwelle falsch.
    return wert <= 0.04045 ? wert / 12.92 : ((wert + 0.055) / 1.055) ** 2.4;
  };
  const leuchtdichte =
    0.2126 * kanal(treffer[1]) + 0.7152 * kanal(treffer[2]) + 0.0722 * kanal(treffer[3]);
  // 0.179 ist die Schwelle, an der Schwarz und Weiss gleich gut lesbar sind
  // (beide erreichen dort ein Kontrastverhaeltnis von rund 4.5:1).
  return leuchtdichte > 0.179 ? '#101319' : '#ffffff';
}
