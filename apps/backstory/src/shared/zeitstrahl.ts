/**
 * Ordnung fuer den Zeitstrahl (Rueckmeldung): Ereignisse nach ihrem
 * Zeitpunkt. Der Zeitpunkt ist Freitext („1492 DR, Sommer“, „3. Mond,
 * Jahr 12“, „12.03.1490“), also wird nur gelesen, was sich sicher lesen
 * laesst: Zahlen, Monats- und Jahreszeitnamen (deutsch und englisch) und
 * ein „v. Chr.“/„BC“ fuer Jahre davor. Was sich nicht lesen laesst, steht
 * am Ende, in der Reihenfolge der Titel.
 */

const MONATE: Record<string, number> = {
  januar: 1, jan: 1, january: 1, jaenner: 1,
  februar: 2, feb: 2, february: 2,
  maerz: 3, mar: 3, march: 3, marz: 3,
  april: 4, apr: 4,
  mai: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11,
  dezember: 12, dez: 12, december: 12, dec: 12
};

/** Jahreszeiten als Monat ihrer Mitte, damit „Sommer 1492“ nach „Mai 1492“ kommt. */
const JAHRESZEITEN: Record<string, number> = {
  fruehling: 4, fruehjahr: 4, spring: 4, lenz: 4,
  sommer: 7, summer: 7,
  herbst: 10, autumn: 10, fall: 10,
  winter: 1
};

function normal(text: string): string {
  return text.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/**
 * Sortierschluessel [Jahr, Monat, Tag] oder null, wenn nichts zu lesen ist.
 * Fehlende Teile zaehlen als 0, damit „1492“ vor „März 1492“ steht.
 */
export function zeitSchluessel(zeitpunkt: string): [number, number, number] | null {
  const text = normal(zeitpunkt).trim();
  if (!text) return null;

  // 12.03.1490 oder 1490-03-12
  const punkt = /(\d{1,2})\.(\d{1,2})\.(-?\d{1,6})/.exec(text);
  if (punkt) return [Number(punkt[3]), Number(punkt[2]), Number(punkt[1])];
  const iso = /(-?\d{1,6})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3])];

  const worte = text.split(/[^a-z0-9.-]+/).filter(Boolean);
  let monat = 0;
  for (const w of worte) {
    const rein = w.replace(/\.$/, '');
    if (MONATE[rein] !== undefined) monat = MONATE[rein];
    else if (JAHRESZEITEN[rein] !== undefined && monat === 0) monat = JAHRESZEITEN[rein];
  }

  // Zahlen: die groesste ist das Jahr, eine kleine mit Punkt davor der Tag („3. Mai“).
  const zahlen = [...text.matchAll(/(-?\d+)(\.?)/g)].map((m) => ({ n: Number(m[1]), punkt: m[2] === '.' }));
  if (zahlen.length === 0 && monat === 0) return null;
  const jahrKandidat = zahlen.filter((z) => !z.punkt || Math.abs(z.n) > 31);
  let jahr = jahrKandidat.length ? jahrKandidat.reduce((a, b) => (Math.abs(b.n) > Math.abs(a.n) ? b : a)).n : 0;
  const tag = zahlen.find((z) => z.punkt && z.n >= 1 && z.n <= 31)?.n ?? 0;
  if (/\b(v\.?\s*chr|bc|bce|vor)\b/.test(text) && jahr > 0) jahr = -jahr;
  return [jahr, monat, tag];
}

/** Vergleich fuer Array.sort: lesbare Zeitpunkte zuerst, in zeitlicher Folge. */
export function vergleicheZeit(a: { zeit: string; titel: string }, b: { zeit: string; titel: string }): number {
  const sa = zeitSchluessel(a.zeit);
  const sb = zeitSchluessel(b.zeit);
  if (sa && !sb) return -1;
  if (!sa && sb) return 1;
  if (sa && sb) {
    for (let i = 0; i < 3; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
  }
  return a.titel.localeCompare(b.titel);
}
