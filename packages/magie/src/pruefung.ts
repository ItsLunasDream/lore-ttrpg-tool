/**
 * Die Pruefung eines Gegenstands an seiner Seltenheit.
 *
 * Dieselbe Regel wie beim Monster Creator (kiAufgaben.ts dort): was die KI
 * vorschlaegt, wird gezogen, wenn es fuer die Seltenheit zu stark ist, und
 * die Oberflaeche sagt, was sich geaendert hat. Was ein Mensch von Hand
 * eintippt, bleibt, wie es ist — dafuer ist diese Datei nicht da.
 *
 * Die Grenzen folgen dem, was der Erzeuger selbst benutzt (erzeuge.ts) und
 * was am SRD geeicht ist: Bonus +1 bis +3, Zusatzschaden 1W4 bis 3W6, SG 13
 * bis 19, Zaubergrad 1 bis 9.
 */
import { gegenstandswert, type Seltenheit } from '@suite/srd';
import type { Gegenstand, Sprache } from './erzeuge';
import { STUFE, VERBRAUCH, type Art } from './tabellen';

const SCHADEN_EN = ['1d4', '1d6', '2d6', '3d6', '3d6'];
const SG = [13, 13, 15, 17, 19];
const GRAD = [1, 3, 5, 7, 9];

export interface Grenzen {
  readonly bonus: number;
  readonly schaden: string;
  readonly sg: number;
  readonly grad: number;
  readonly wirkungen: number;
}

export function grenzen(art: Art, seltenheit: Seltenheit): Grenzen {
  const stufe = STUFE[seltenheit];
  const verbrauch = art === 'trank' || art === 'schriftrolle';
  return {
    bonus: Math.max(1, Math.min(3, stufe)),
    schaden: SCHADEN_EN[stufe],
    sg: SG[stufe],
    grad: GRAD[stufe],
    wirkungen: verbrauch ? 2 : stufe >= 3 ? 3 : stufe >= 1 ? 2 : 1
  };
}

function schnitt(anzahl: number, seiten: number): number {
  return (anzahl * (seiten + 1)) / 2;
}

export interface Ergebnis {
  readonly gegenstand: Gegenstand;
  /** Was geaendert wurde, als lesbare Zeilen in der Sprache. */
  readonly zeilen: readonly string[];
}

/**
 * Zieht einen Gegenstand der KI auf seine Seltenheit.
 *
 * Nur Zahlen, die eindeutig zu lesen sind: „+4" wird zu „+2", „4d8"
 * Zusatzschaden zu „2d6", „DC 21" zu „DC 15". Ein Zaubergrad ueber der
 * Grenze und zu viele Wirkungen werden gemeldet, nicht umgeschrieben — dort
 * waere jede automatische Aenderung geraten.
 */
export function pruefeKi(g: Gegenstand, sprache: Sprache): Ergebnis {
  const de = sprache === 'de';
  const gr = grenzen(g.art, g.seltenheit);
  const zeilen: string[] = [];
  const w = de ? 'W' : 'd';
  const schadenGrenze = gr.schaden.replace('d', w);
  const [gA, gS] = gr.schaden.split('d').map(Number);

  const ziehe = (satz: string): string => {
    let neu = satz.replace(/\+(\d+)(?=\s*(?:bonus|auf|to|Bonus|zu))/g, (ganz, n: string) => {
      if (Number(n) <= gr.bonus) return ganz;
      zeilen.push(de ? `Bonus +${n} → +${gr.bonus}` : `Bonus +${n} → +${gr.bonus}`);
      return `+${gr.bonus}`;
    });
    // Zusatzschaden: nur in Saetzen ueber Schaden, nicht ueber Heilung.
    if (/damage|schaden/i.test(neu) && !/hit points|trefferpunkte/i.test(neu)) {
      neu = neu.replace(/(\d+)\s*[dW](\d+)/g, (ganz, a: string, s: string) => {
        if (schnitt(Number(a), Number(s)) <= schnitt(gA, gS)) return ganz;
        zeilen.push(`${a}${w}${s} → ${schadenGrenze}`);
        return schadenGrenze;
      });
    }
    neu = neu.replace(/\b(DC|SG)\s*(\d+)/g, (ganz, wort: string, n: string) => {
      if (Number(n) <= gr.sg) return ganz;
      zeilen.push(`${wort} ${n} → ${gr.sg}`);
      return `${wort} ${gr.sg}`;
    });
    const grad = /\((?:level|Grad)\s*(\d)\)/.exec(neu);
    if (grad && Number(grad[1]) > gr.grad) {
      zeilen.push(
        de
          ? `Zaubergrad ${grad[1]} liegt über der Grenze (${gr.grad}) — bitte von Hand prüfen.`
          : `Spell level ${grad[1]} is above the limit (${gr.grad}) — please check by hand.`
      );
    }
    return neu;
  };

  const wirkungen = g.wirkungen.map(ziehe);
  const fluch = g.fluch ? ziehe(g.fluch) : '';
  if (wirkungen.filter((x) => x.trim()).length > gr.wirkungen) {
    zeilen.push(
      de
        ? `${wirkungen.length} Wirkungen, üblich sind höchstens ${gr.wirkungen}.`
        : `${wirkungen.length} properties; at most ${gr.wirkungen} is usual.`
    );
  }
  const verbrauch = VERBRAUCH[g.art];
  return {
    gegenstand: {
      ...g,
      wirkungen,
      fluch,
      // Traenke und Schriftrollen kennen keine Einstimmung; der Wert kommt
      // immer aus der Tabelle des SRD, nie aus der Antwort.
      einstimmung: verbrauch ? false : g.einstimmung || Boolean(fluch.trim()),
      wert: g.art === 'schriftrolle' ? g.wert : gegenstandswert(g.seltenheit, { verbrauch })
    },
    zeilen
  };
}
