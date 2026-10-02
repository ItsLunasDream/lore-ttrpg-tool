/**
 * Das Sitzungsprotokoll (docs/sitzungsprotokoll.md), der reine Teil.
 *
 * Die Hülle schreibt mit, solange eine Sitzung läuft: Ereignisse aus den
 * Werkzeugen (Kanal `huelle:protokoll`), Würfe anderer aus dem Raum, wer da
 * war und welche Notizen offen waren. Am Ende wird daraus eine Notiz.
 *
 * Entschieden (Vorschläge aus dem Konzept): der Chat wird nicht
 * mitgeschrieben, nur Zeilen von Hand; alle Würfe werden gesammelt, die Notiz
 * zeigt im Verlauf nur die wichtigen (Kampf, Beute, 1 und 20, Zeilen von
 * Hand), alle Würfe stehen darunter unter eigener Überschrift, die sich im
 * Story Creator einklappen lässt.
 */

export const PROTOKOLL_ARTEN = [
  'wurf',
  'kampf-beginn',
  'runde',
  'raus',
  'kampf-ende',
  'begegnung',
  'beute',
  'gegeben',
  'rast',
  'hand'
] as const;
export type ProtokollArt = (typeof PROTOKOLL_ARTEN)[number];

export interface ProtokollEintrag {
  readonly id: number;
  /** ISO-Zeit. */
  readonly zeit: string;
  readonly art: ProtokollArt;
  /** Werkzeug, aus dem es kam, oder 'raum'/'hand'. */
  readonly quelle: string;
  /** Der fertige Satz in der Sprache, in der er entstand. */
  readonly text: string;
  /** Steht im Verlauf der Notiz; sonst nur unter „Alle Würfe". */
  readonly wichtig: boolean;
  /** In der Vorschau abgewählt. */
  readonly weg?: boolean;
}

export interface Sitzung {
  readonly beginn: string;
  readonly ende: string | null;
  readonly titel: string;
  /** Wer im Raum war (Namen), gesammelt über die ganze Sitzung. */
  readonly dabei: readonly string[];
  /** Titel von Notizen, die während der Sitzung offen waren. */
  readonly notizen: readonly string[];
  readonly eintraege: readonly ProtokollEintrag[];
  readonly naechsteId: number;
}

export const HOECHSTENS_EINTRAEGE = 2000;

export function neueSitzung(beginn: string, titel: string): Sitzung {
  return { beginn, ende: null, titel, dabei: [], notizen: [], eintraege: [], naechsteId: 1 };
}

/** Was ein Werkzeug schicken darf; alles andere wird verworfen. */
export function bereinigeMeldung(roh: unknown): { art: ProtokollArt; text: string; wichtig?: boolean } | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  if (!(PROTOKOLL_ARTEN as readonly string[]).includes(r.art as string)) return null;
  const text = typeof r.text === 'string' ? r.text.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
  if (!text) return null;
  // Ohne Angabe entscheidet `standardWichtig` nach der Art.
  return { art: r.art as ProtokollArt, text, ...(typeof r.wichtig === 'boolean' ? { wichtig: r.wichtig } : {}) };
}

/** Wichtig ist alles außer gewöhnlichen Würfen. */
export function standardWichtig(art: ProtokollArt): boolean {
  return art !== 'wurf';
}

export function mitEintrag(
  s: Sitzung,
  e: { art: ProtokollArt; quelle: string; text: string; wichtig?: boolean; zeit: string }
): Sitzung {
  if (s.ende) return s;
  const eintrag: ProtokollEintrag = {
    id: s.naechsteId,
    zeit: e.zeit,
    art: e.art,
    quelle: e.quelle,
    text: e.text,
    wichtig: e.wichtig ?? standardWichtig(e.art)
  };
  return { ...s, eintraege: [...s.eintraege, eintrag].slice(-HOECHSTENS_EINTRAEGE), naechsteId: s.naechsteId + 1 };
}

export function mitDabei(s: Sitzung, namen: readonly string[]): Sitzung {
  const neu = namen.filter((n) => n && !s.dabei.includes(n));
  return neu.length ? { ...s, dabei: [...s.dabei, ...neu] } : s;
}

export function mitNotiz(s: Sitzung, titel: string): Sitzung {
  return titel && !s.notizen.includes(titel) ? { ...s, notizen: [...s.notizen, titel].slice(-200) } : s;
}

/**
 * Ein Wurf aus dem Raum-Chat: Zeilen des Würfels beginnen mit „🎲". Andere
 * Chatzeilen sind kein Wurf und werden nicht mitgeschrieben.
 */
export function wurfAusChat(text: string): string | null {
  const t = text.trim();
  return t.startsWith('🎲') ? t.slice(2).trim().slice(0, 300) : null;
}

// --- Die Notiz ----------------------------------------------------------------

function uhr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function datum(iso: string, s: 'de' | 'en'): string {
  return new Date(iso).toLocaleDateString(s === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function standardTitel(nummer: number, beginn: string, s: 'de' | 'en'): string {
  return `${s === 'de' ? 'Sitzung' : 'Session'} ${nummer} · ${datum(beginn, s)}`;
}

/** Bekannte Notiztitel im Text werden zu [[Verweisen]] (nur ganze Wörter, längste zuerst). */
export function verlinke(text: string, titel: readonly string[]): string {
  let heraus = text;
  const sortiert = [...titel].filter((t) => t.length >= 3 && !/[[\]|]/.test(t)).sort((a, b) => b.length - a.length);
  for (const t of sortiert) {
    const muster = new RegExp(`(?<![\\p{L}\\[])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\]])`, 'u');
    heraus = heraus.replace(muster, `[[${t}]]`);
  }
  return heraus;
}

export function alsMarkdown(s: Sitzung, sprache: 'de' | 'en', zusammenfassung = '', bekannteTitel: readonly string[] = []): string {
  const de = sprache === 'de';
  const aktiv = s.eintraege.filter((e) => !e.weg);
  const wichtig = aktiv.filter((e) => e.wichtig);
  const wuerfe = aktiv.filter((e) => e.art === 'wurf');
  const zeilen = [
    `${de ? 'Dabei' : 'Present'}: ${s.dabei.length ? s.dabei.join(', ') : '—'} · ${uhr(s.beginn)}–${s.ende ? uhr(s.ende) : '…'}`,
    '',
    `## ${de ? 'Zusammenfassung' : 'Summary'}`,
    '',
    zusammenfassung.trim() || (de ? '*(noch leer)*' : '*(empty)*'),
    '',
    `## ${de ? 'Verlauf' : 'Timeline'}`,
    '',
    ...(wichtig.length ? wichtig.map((e) => `- ${uhr(e.zeit)} ${verlinke(e.text, bekannteTitel)}`) : [de ? '*(nichts Besonderes)*' : '*(nothing notable)*'])
  ];
  if (s.notizen.length) {
    zeilen.push('', `## ${de ? 'Offene Notizen' : 'Notes opened'}`, '', ...s.notizen.map((t) => `- [[${t}]]`));
  }
  if (wuerfe.length) {
    zeilen.push('', `## ${de ? 'Alle Würfe' : 'All rolls'}`, '', ...wuerfe.map((e) => `- ${uhr(e.zeit)} ${e.text}`));
  }
  return zeilen.join('\n');
}

/** Prüfen beim Einlesen des Zwischenstands (nach einem Absturz). */
export function bereinigeSitzung(roh: unknown): Sitzung | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.beginn !== 'string' || Number.isNaN(Date.parse(r.beginn))) return null;
  const eintraege: ProtokollEintrag[] = [];
  for (const x of Array.isArray(r.eintraege) ? r.eintraege.slice(-HOECHSTENS_EINTRAEGE) : []) {
    const m = bereinigeMeldung(x);
    const e = x as Record<string, unknown>;
    if (!m || typeof e.zeit !== 'string' || typeof e.id !== 'number') continue;
    eintraege.push({ id: e.id, zeit: e.zeit, art: m.art, quelle: typeof e.quelle === 'string' ? e.quelle.slice(0, 40) : '', text: m.text, wichtig: e.wichtig === true, ...(e.weg === true ? { weg: true } : {}) });
  }
  const namen = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 120)).slice(0, 200) : []);
  return {
    beginn: r.beginn,
    ende: typeof r.ende === 'string' ? r.ende : null,
    titel: typeof r.titel === 'string' ? r.titel.slice(0, 160) : '',
    dabei: namen(r.dabei),
    notizen: namen(r.notizen),
    eintraege,
    naechsteId: Math.max(1, ...eintraege.map((e) => e.id + 1), Number(r.naechsteId) || 1)
  };
}

// --- KI-Zusammenfassung --------------------------------------------------------

/**
 * Die Anfrage für eine Zusammenfassung der Sitzung (Rückmeldung). Mit
 * Verlauf, Zeilen von Hand, Anwesenden und offenen Notizen; gewöhnliche
 * Würfe nur als Zahl, sie erzählen nichts. Das Ergebnis ist ein Vorschlag im
 * Feld „Zusammenfassung", nie automatisch übernommen.
 */
export function kiAnfrage(s: Sitzung, sprache: 'de' | 'en'): { system: string; nutzer: string } {
  const de = sprache === 'de';
  const aktiv = s.eintraege.filter((e) => !e.weg);
  const wichtig = aktiv.filter((e) => e.wichtig).slice(-150);
  const wuerfe = aktiv.filter((e) => !e.wichtig && e.art === 'wurf').length;
  const system = de
    ? 'Du fasst eine Pen-&-Paper-Sitzung zusammen. Schreibe 3 bis 6 Sätze auf Deutsch, im Präteritum, sachlich, ohne Überschrift und ohne Aufzählung. Erfinde nichts, was nicht im Protokoll steht.'
    : 'You summarise a tabletop roleplaying session. Write 3 to 6 sentences in English, past tense, plain, no heading and no bullet list. Do not invent anything that is not in the log.';
  const nutzer = [
    `${de ? 'Titel' : 'Title'}: ${s.titel}`,
    `${de ? 'Dabei' : 'Present'}: ${s.dabei.join(', ') || '—'}`,
    s.notizen.length ? `${de ? 'Offene Notizen' : 'Notes opened'}: ${s.notizen.join(', ')}` : '',
    '',
    de ? 'Verlauf:' : 'Log:',
    ...wichtig.map((e) => `- ${uhr(e.zeit)} ${e.text}`),
    wuerfe ? (de ? `(dazu ${wuerfe} gewöhnliche Würfe)` : `(plus ${wuerfe} ordinary rolls)`) : ''
  ]
    .filter((z) => z !== '')
    .join('\n');
  return { system, nutzer };
}

/** Die Antwort der KI als Text fürs Feld: ohne Zaun, ohne Überschrift, begrenzt. */
export function bereinigeZusammenfassung(text: string): string {
  return text
    .replace(/^\s*```[a-z]*\s*|\s*```\s*$/g, '')
    .replace(/^#+\s.*\n+/, '')
    .trim()
    .slice(0, 3000);
}
