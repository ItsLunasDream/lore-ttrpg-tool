/**
 * Gegenstaende und Geld zwischen zwei Boegen verschieben, als ein Schritt.
 *
 * Rein und ohne Datei: der Hauptprozess liest beide Boegen, ruft das hier
 * und schreibt beide zurueck. Spaeter im Raum macht es der Gastgeber genauso.
 * Beide Seiten bekommen einen Eintrag im Verlauf.
 */
import { MAX_VERLAUF, type Bogen, type Muenzen } from './bogen';
import { legeDazu, neueKennung, teileAuf, zieheAb, MUENZARTEN, MUENZ_NAMEN } from './inventar';

export type Uebergabe =
  | { readonly art: 'gegenstand'; readonly gegenstandId: string; readonly anzahl: number }
  | { readonly art: 'geld'; readonly betrag: Partial<Muenzen> };

function vermerke(b: Bogen, text: string, zeit: string): Bogen {
  return { ...b, verlauf: [{ zeit, text }, ...b.verlauf].slice(0, MAX_VERLAUF) };
}

export function geldText(betrag: Partial<Muenzen>, sprache: 'de' | 'en'): string {
  const i = sprache === 'de' ? 0 : 1;
  return MUENZARTEN.filter((a) => (betrag[a] ?? 0) > 0)
    .map((a) => `${betrag[a]} ${MUENZ_NAMEN[a].kurz[i]}`)
    .join(', ');
}

/**
 * Fuehrt die Uebergabe aus. `null`, wenn sie nicht geht (Gegenstand fehlt,
 * nicht genug davon, nicht genug Geld, gleicher Bogen).
 *
 * Ein Teil eines Stapels wird abgespalten: der Empfaenger bekommt einen neuen
 * Eintrag mit eigener Kennung. Gleichnamige Stapel beim Empfaenger werden
 * nicht zusammengelegt; ob zwei Heiltraenke wirklich gleich sind, weiss nur
 * der Mensch.
 */
export function uebergib(
  von: Bogen,
  nach: Bogen,
  was: Uebergabe,
  sprache: 'de' | 'en',
  zeit = new Date().toISOString()
): { von: Bogen; nach: Bogen } | null {
  if (von.id === nach.id) return null;
  const de = sprache === 'de';
  if (was.art === 'geld') {
    const rest = zieheAb(von.muenzen, was.betrag);
    const text = geldText(was.betrag, sprache);
    if (!rest || !text) return null;
    return {
      von: vermerke({ ...von, muenzen: rest }, de ? `${text} an ${nach.name}` : `${text} to ${nach.name}`, zeit),
      nach: vermerke({ ...nach, muenzen: legeDazu(nach.muenzen, was.betrag) }, de ? `${text} von ${von.name}` : `${text} from ${von.name}`, zeit)
    };
  }
  const g = von.gegenstaende.find((x) => x.id === was.gegenstandId);
  const anzahl = Math.floor(was.anzahl);
  if (!g || anzahl < 1 || anzahl > g.anzahl) return null;
  const bleibt =
    anzahl === g.anzahl
      ? von.gegenstaende.filter((x) => x.id !== g.id)
      : von.gegenstaende.map((x) => (x.id === g.id ? { ...x, anzahl: x.anzahl - anzahl } : x));
  // Ausgeruestet und eingestimmt bleiben beim alten Traeger.
  const neu = { ...g, id: anzahl === g.anzahl ? g.id : neueKennung(), anzahl, ausgeruestet: false, eingestimmt: false };
  const text = `${anzahl > 1 ? `${anzahl} × ` : ''}${g.name}`;
  return {
    von: vermerke({ ...von, gegenstaende: bleibt }, de ? `${text} an ${nach.name}` : `${text} to ${nach.name}`, zeit),
    nach: vermerke({ ...nach, gegenstaende: [...nach.gegenstaende, neu] }, de ? `${text} von ${von.name}` : `${text} from ${von.name}`, zeit)
  };
}

/**
 * Das Geld von `von` gleichmaessig auf `ziele` verteilen; was nicht aufgeht,
 * bleibt. `null`, wenn es nichts zu verteilen gibt. Alle bekommen einen
 * Eintrag im Verlauf.
 */
export function teileGeld(
  von: Bogen,
  ziele: readonly Bogen[],
  sprache: 'de' | 'en',
  zeit = new Date().toISOString()
): { von: Bogen; ziele: Bogen[]; text: string } | null {
  if (ziele.length === 0) return null;
  const { jeder, rest } = teileAuf(von.muenzen, ziele.length);
  const text = geldText(jeder, sprache);
  if (!text) return null;
  const de = sprache === 'de';
  const neu = ziele.map((b) =>
    vermerke({ ...b, muenzen: legeDazu(b.muenzen, jeder) }, de ? `${text} von ${von.name} (aufgeteilt)` : `${text} from ${von.name} (split)`, zeit)
  );
  const namen = neu.map((b) => b.name).join(', ');
  return {
    von: vermerke({ ...von, muenzen: rest }, de ? `Aufgeteilt: je ${text} an ${namen}` : `Split: ${text} each to ${namen}`, zeit),
    ziele: neu,
    text
  };
}
