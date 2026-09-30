/**
 * Welche Bloecke unter einer eingeklappten Ueberschrift liegen.
 *
 * Der Editor kennt keine Abschnitte, nur eine flache Folge von Bloecken.
 * "Alles, was hierarchisch darunter steht" muss deshalb gerechnet werden:
 * ein Abschnitt reicht von seiner Ueberschrift bis zur naechsten
 * Ueberschrift gleicher oder hoeherer Ebene.
 *
 * Plattformfrei und ohne Editor, damit sich die Rechnung pruefen laesst.
 */

/**
 * Die Ebene je Block: 1 bis 6 fuer eine Ueberschrift, 0 fuer eine
 * Trennlinie, null fuer alles andere.
 *
 * Die Trennlinie beendet jeden Abschnitt (Rueckmeldung): was darunter
 * steht, gehoert zu keiner Ueberschrift darueber und bleibt beim Einklappen
 * sichtbar — etwa ein Bild nach einem Abschnitt.
 */
export type Stufen = readonly (number | null)[];

/** Die laufenden Nummern der Ueberschriften, in Dokumentreihenfolge. */
export function ueberschriften(stufen: Stufen): number[] {
  const nummern: number[] = [];
  stufen.forEach((stufe, index) => {
    if (stufe !== null && stufe > 0) nummern.push(index);
  });
  return nummern;
}

/**
 * Der Bereich unter einer Ueberschrift, ohne sie selbst.
 *
 * Gibt `[von, bis)` zurueck. Steht direkt danach schon die naechste
 * Ueberschrift derselben Ebene, ist der Bereich leer.
 */
export function abschnitt(stufen: Stufen, index: number): { von: number; bis: number } {
  const eigene = stufen[index];
  if (eigene === null || eigene === undefined || eigene === 0) return { von: index + 1, bis: index + 1 };

  let bis = index + 1;
  while (bis < stufen.length) {
    const stufe = stufen[bis];
    if (stufe !== null && stufe <= eigene) break;
    bis += 1;
  }
  return { von: index + 1, bis };
}

/**
 * Welche Bloecke verschwinden.
 *
 * `eingeklappt` traegt die laufende Nummer der Ueberschrift (die wievielte
 * im Dokument), nicht ihre Blockstelle: beim Tippen im Text verschiebt sich
 * die Stelle staendig, die Reihenfolge der Ueberschriften dagegen nicht.
 *
 * Eingeklappte Ueberschriften ineinander sind kein Sonderfall: liegt die
 * aeussere zu, ist die innere ohnehin versteckt.
 */
export function versteckteBloecke(stufen: Stufen, eingeklappt: ReadonlySet<number>): Set<number> {
  const versteckt = new Set<number>();
  const nummern = ueberschriften(stufen);

  for (const nummer of eingeklappt) {
    const index = nummern[nummer];
    if (index === undefined) continue;

    const { von, bis } = abschnitt(stufen, index);
    for (let i = von; i < bis; i += 1) versteckt.add(i);
  }
  return versteckt;
}

/** Ob unter der Ueberschrift ueberhaupt etwas steht, das sich einklappen liesse. */
export function hatInhalt(stufen: Stufen, index: number): boolean {
  const { von, bis } = abschnitt(stufen, index);
  return bis > von;
}
