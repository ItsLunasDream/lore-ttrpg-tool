/**
 * Welche Sprache(n) ein Text hat, fuer die Rechtschreibpruefung
 * (Rueckmeldung: „Erkannte Sprache …“ wie bei Word, auch gemischt).
 *
 * Gezaehlt werden haeufige Fuellwoerter beider Sprachen. Das ist grob, aber
 * robust: Namen und Fantasiewoerter zaehlen nicht, und schon wenige Saetze
 * reichen. Eine Sprache gilt als vorhanden, wenn sie mindestens drei Treffer
 * und ein Fuenftel aller Treffer hat.
 */

const DE = new Set(
  'der die das und ist nicht ein eine einen einem einer ich du er sie es wir ihr mit auf fuer von zu den dem des im sich auch als aber noch nach wie wenn dass nur oder so bei aus hat haben war sind wird werden kann dann schon sein seine ihre ihm ihn man uns euch doch mir mich dir dich ueber unter vor hier dort wurde wieder'.split(' ')
);
const EN = new Set(
  'the and is not a an i you he she it we they with on for of to in that was were be been are this his her him them their there what which who would could should have has had from at by or but if so as do does did will can just about into than then when where your our my me us'.split(' ')
);

export type Pruefsprache = 'de' | 'en';

export function erkenneSprachen(text: string): { sprachen: Pruefsprache[]; treffer: number } {
  const worte = text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .split(/[^a-z']+/)
    .filter(Boolean);
  let de = 0;
  let en = 0;
  for (const w of worte) {
    // „die“ gibt es nur im Deutschen als Fuellwort, „a“/„i“ nur im Englischen; doppelte zaehlen beiden nicht.
    const inDe = DE.has(w);
    const inEn = EN.has(w);
    if (inDe && !inEn) de++;
    else if (inEn && !inDe) en++;
  }
  const summe = de + en;
  const sprachen: Pruefsprache[] = [];
  if (de >= 3 && de >= summe * 0.2) sprachen.push('de');
  if (en >= 3 && en >= summe * 0.2) sprachen.push('en');
  return { sprachen, treffer: summe };
}
