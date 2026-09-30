/**
 * Einfuegen an der Schreibmarke von ausserhalb des Editors, etwa aus der
 * Schreibhilfe. Der Editor meldet sich hier an, solange er offen ist; ohne
 * ihn liefert `fuegeEin` false, und der Aufrufer haengt den Text hinten an.
 */
type Ziel = (text: string) => boolean;

let ziel: Ziel | null = null;

export function meldeEinfuegeziel(neu: Ziel): () => void {
  ziel = neu;
  return () => {
    if (ziel === neu) ziel = null;
  };
}

export function fuegeEin(text: string): boolean {
  return ziel ? ziel(text) : false;
}
