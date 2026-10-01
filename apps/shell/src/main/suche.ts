/**
 * Die Suche ueber alle Werkzeuge hinweg.
 *
 * Die Huelle fragt jedes Werkzeug, was es abgelegt hat, und sucht darin.
 * Das Suchen selbst steht in `@suite/eintraege` und ist dort geprueft; hier
 * steht nur, WEN sie fragt und wie oft.
 *
 * **Von der Platte, nicht aus der Oberflaeche.** Jeder Leser liest den
 * Datenordner seines Werkzeugs direkt. Ueber die Oberflaeche zu gehen waere
 * naheliegender gewesen und falsch: dann faende man nur, was man in dieser
 * Sitzung schon einmal offen hatte — und gerade das, was man lange nicht
 * angefasst hat, sucht man am ehesten.
 *
 * **Gezaehlt wird nicht.** Die Eintraege werden bei jedem Oeffnen der Suche
 * frisch geholt, nicht in einem Verzeichnis gefuehrt. Ein Verzeichnis
 * muesste gepflegt werden, und ein ungepflegtes Verzeichnis zeigt Dinge,
 * die es nicht mehr gibt. Bei einigen hundert Dateien ist das Lesen
 * schnell genug; wenn es das einmal nicht mehr ist, ist der Zwischenspeicher
 * eine eigene Aufgabe mit eigener Begruendung.
 */
import type { Eintrag } from '@suite/eintraege';
import { leseEintraege as leseMonster } from '../../../monster/src/main/embed';
import { leseEintraege as leseZustaende } from '../../../zustaende/src/main/embed';
import { leseEintraege as leseBegegnungen } from '../../../initiative/src/main/embed';
import { leseEintraege as leseEncounter } from '../../../encounter/src/main/embed';
import { leseEintraege as leseNotizen } from '../../../backstory/src/main/embed';
import { leseEintraege as leseRegeln } from '../../../nachschlagewerk/src/main/embed';
import { leseEintraege as leseGegenstaende } from '../../../magicitems/src/main/embed';
import { leseEintraege as leseHomebrew } from '../../../homebrew/src/main/embed';
import { leseEintraege as leseOrte } from '../../../orte/src/main/embed';
import { leseEintraege as leseKalender } from '../../../kalender/src/main/embed';
import { leseEintraege as leseTabellen } from '../../../loot/src/main/embed';
import { leseEintraege as leseBoegen } from '../../../charakterbogen/src/main/embed';

/**
 * Die Leser, je Werkzeug einer.
 *
 * Ein Werkzeug ohne Leser taucht in der Suche nicht auf — das ist kein
 * Mangel, sondern die Form: wer mitmachen will, beantwortet „gib mir deine
 * Eintraege", und die Huelle muss darueber nichts wissen.
 *
 * Der Story Creator kam spaeter dazu als die uebrigen, und zwar aus zwei
 * Gruenden: seine Notizen haengen an Kampagnen, die Kennung muss also
 * beides tragen — und sein Vault entscheidet selbst, wo er liegt.
 */
const LESER: readonly ((datenordner: string, sprache: 'de' | 'en') => Promise<readonly Eintrag[]>)[] = [
  leseMonster,
  leseZustaende,
  leseBegegnungen,
  leseEncounter,
  leseNotizen,
  // Der einzige Leser, der nichts von der Platte liest: der offizielle
  // Bestand steht fest. Er steht trotzdem hier, damit die Suche ihn
  // genauso findet wie alles Selbstgebaute.
  leseRegeln,
  leseGegenstaende,
  leseHomebrew,
  leseOrte,
  leseKalender,
  leseTabellen,
  leseBoegen
];

/**
 * Alles, was die Werkzeuge abgelegt haben.
 *
 * Die Leser laufen nebeneinander: sie lesen verschiedene Ordner, und
 * nacheinander waere die Suche so langsam wie die Summe statt wie das
 * langsamste Stueck.
 *
 * Ein Leser, der wirft, nimmt die anderen nicht mit. Eine Suche ohne die
 * Monster ist besser als gar keine — und dass etwas fehlt, sieht man.
 */
export async function alleEintraege(datenordner: string, sprache: 'de' | 'en' = 'de'): Promise<readonly Eintrag[]> {
  const ergebnisse = await Promise.allSettled(LESER.map((lese) => lese(datenordner, sprache)));
  const heraus: Eintrag[] = [];
  for (const ergebnis of ergebnisse) {
    if (ergebnis.status === 'fulfilled') heraus.push(...ergebnis.value);
    else console.error('[shell] Ein Werkzeug konnte seine Eintraege nicht liefern:', ergebnis.reason);
  }
  return heraus;
}
