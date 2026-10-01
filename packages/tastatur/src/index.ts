/**
 * Bedienung ohne Maus (Rückmeldung „Allgemein 1": überall mit Pfeiltasten
 * und Tastenkombinationen hinkommen).
 *
 * Zwei Bausteine, in jedem Werkzeug gleich:
 *
 * - **Pfeiltasten in Gruppen.** Ein Behälter mit `data-pfeile="liste"`
 *   (oben/unten) oder `data-pfeile="raster"` (alle vier Richtungen, nach
 *   Lage auf dem Schirm) lässt den Fokus mit den Pfeilen zwischen seinen
 *   bedienbaren Elementen wandern; Pos1 und Ende springen an den Anfang und
 *   das Ende. Tab springt wie gewohnt in die nächste Gruppe. Ein einziger
 *   Hörer am Dokument (`installierePfeile`) genügt; neue Listen brauchen nur
 *   das Attribut.
 * - **Strg+S** klickt den Knopf mit `data-speichern`, wo es einen gibt.
 * - **Klickflächen, die keine Knöpfe sind** (`alsKnopf`): erreichbar mit
 *   Tab, ausgelöst mit Enter oder Leertaste.
 *
 * In Eingabefeldern bleiben die Pfeile beim Feld: dort bewegen sie den
 * Cursor, und das darf ihnen niemand wegnehmen.
 */

export type Richtung = 'hoch' | 'runter' | 'links' | 'rechts';

export interface Kasten {
  readonly x: number;
  readonly y: number;
  readonly b: number;
  readonly h: number;
}

/**
 * Nächster Kasten in einer Richtung, rein geometrisch (testbar ohne DOM).
 *
 * Gezählt wird der Abstand der Mitten, die Abweichung quer zur Richtung
 * dreifach; Kacheln in derselben Reihe (Spalte) gehen immer vor. So trifft
 * „rechts" die Nachbarkachel und nicht eine schräg darunter, die zufällig
 * näher liegt. Liefert -1, wenn in der Richtung nichts mehr kommt.
 */
export function naechsterInRichtung(kaesten: readonly Kasten[], von: number, richtung: Richtung): number {
  const a = kaesten[von];
  if (!a) return -1;
  const ax = a.x + a.b / 2;
  const ay = a.y + a.h / 2;
  let bester = -1;
  let besterWert = Infinity;
  kaesten.forEach((k, i) => {
    if (i === von) return;
    const dx = k.x + k.b / 2 - ax;
    const dy = k.y + k.h / 2 - ay;
    const vorwaerts = richtung === 'rechts' ? dx : richtung === 'links' ? -dx : richtung === 'runter' ? dy : -dy;
    const quer = richtung === 'rechts' || richtung === 'links' ? Math.abs(dy) : Math.abs(dx);
    // Nur was wirklich in der Richtung liegt.
    if (vorwaerts <= 1) return;
    // Was in derselben Reihe (oder Spalte) liegt, geht immer vor: sonst
    // gewönne eine Kachel schräg darunter, nur weil sie näher ist.
    const ueberlappt =
      richtung === 'rechts' || richtung === 'links'
        ? k.y < a.y + a.h && a.y < k.y + k.h
        : k.x < a.x + a.b && a.x < k.x + k.b;
    const wert = (ueberlappt ? 0 : 1e6) + vorwaerts + quer * 3;
    if (wert < besterWert) {
      besterWert = wert;
      bester = i;
    }
  });
  return bester;
}

const RICHTUNG: Record<string, Richtung> = {
  ArrowUp: 'hoch',
  ArrowDown: 'runter',
  ArrowLeft: 'links',
  ArrowRight: 'rechts'
};

/** Was in einer Gruppe den Fokus bekommen kann. */
const BEDIENBAR =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-pfeil]';

/** Tippt man gerade Text? Dann gehören die Pfeile dem Feld. */
export function istTextfeld(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const typ = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(typ);
}

function sichtbar(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Die Elemente einer Gruppe. Verschachtelte Gruppen zählen nicht mit:
 * die Knöpfe in einer Karte bilden ihre eigene Gruppe, wenn sie eine
 * haben wollen.
 */
function glieder(gruppe: HTMLElement): HTMLElement[] {
  // Markierte Glieder (`data-pfeil`) gehen vor: eine Kachel mit drei
  // Knöpfen darin soll als eine Einheit wandern, nicht als drei.
  const markiert = [...gruppe.querySelectorAll<HTMLElement>('[data-pfeil]')].filter(
    (el) => el.closest('[data-pfeile]') === gruppe && sichtbar(el)
  );
  if (markiert.length) return markiert;
  return [...gruppe.querySelectorAll<HTMLElement>(BEDIENBAR)].filter(
    (el) => el.closest('[data-pfeile]') === gruppe && sichtbar(el)
  );
}

/**
 * Pfeiltaste in einer Gruppe verarbeiten. Liefert true, wenn der Fokus
 * gewandert ist (dann ist das Ereignis verbraucht).
 */
export function pfeilInGruppe(ereignis: KeyboardEvent, dokument: Document = document): boolean {
  if (ereignis.altKey || ereignis.ctrlKey || ereignis.metaKey || ereignis.defaultPrevented) return false;
  const aktiv = dokument.activeElement as HTMLElement | null;
  if (!aktiv || istTextfeld(aktiv)) return false;
  const gruppe = aktiv.closest<HTMLElement>('[data-pfeile]');
  if (!gruppe) return false;
  const liste = glieder(gruppe);
  const von = liste.findIndex((el) => el === aktiv || el.contains(aktiv));
  if (von < 0) return false;

  let ziel = -1;
  if (ereignis.key === 'Home') ziel = 0;
  else if (ereignis.key === 'End') ziel = liste.length - 1;
  else {
    const richtung = RICHTUNG[ereignis.key];
    if (!richtung) return false;
    if (gruppe.dataset.pfeile === 'raster') {
      const kaesten = liste.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, b: r.width, h: r.height };
      });
      ziel = naechsterInRichtung(kaesten, von, richtung);
    } else if (gruppe.dataset.pfeile === 'zeile') {
      if (richtung === 'links') ziel = von - 1;
      if (richtung === 'rechts') ziel = von + 1;
    } else {
      if (richtung === 'hoch') ziel = von - 1;
      if (richtung === 'runter') ziel = von + 1;
    }
  }
  const el = liste[ziel];
  if (!el || ziel === von) return false;
  ereignis.preventDefault();
  // Ein Glied ohne eigenen Fokus (eine Karte mit Knöpfen) gibt ihn an
  // sein erstes bedienbares Kind weiter.
  const fokus = el.matches(BEDIENBAR.replace(', [data-pfeil]', '')) ? el : el.querySelector<HTMLElement>(BEDIENBAR) ?? el;
  fokus.focus();
  fokus.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  return true;
}

/**
 * Einmal je Fenster aufrufen. Hört am Dokument, damit auch später
 * gezeichnete Listen ohne weiteres Zutun mitmachen.
 */
export function installierePfeile(dokument: Document = document): () => void {
  const hoerer = (ereignis: KeyboardEvent) => {
    pfeilInGruppe(ereignis, dokument);
    speichernPerTaste(ereignis, dokument);
  };
  dokument.addEventListener('keydown', hoerer);
  return () => dokument.removeEventListener('keydown', hoerer);
}

/** Strg+S (macOS: Cmd+S), ohne Umschalt: „Speichern unter" bleibt dem Werkzeug. */
export function istSpeichertaste(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's';
}

/**
 * Strg+S löst den sichtbaren Knopf `[data-speichern]` aus, auch aus einem
 * Textfeld heraus (Rückmeldung: „Speichern mit Strg+S sollte immer gehen").
 * Werkzeuge mit eigenem Hörer (Story Creator) haben keinen solchen Knopf
 * oder verhindern das Ereignis vorher; dann passiert hier nichts.
 */
function speichernPerTaste(ereignis: KeyboardEvent, dokument: Document): void {
  if (ereignis.defaultPrevented || !istSpeichertaste(ereignis)) return;
  const knopf = [...dokument.querySelectorAll<HTMLButtonElement>('[data-speichern]')].find(
    (k) => !k.disabled && k.getClientRects().length > 0
  );
  if (!knopf) return;
  ereignis.preventDefault();
  knopf.click();
}

/** Enter oder Leertaste: die Tasten, die einen Knopf auslösen. */
export function istAusloeser(ereignis: { key: string }): boolean {
  return ereignis.key === 'Enter' || ereignis.key === ' ';
}

/**
 * Eigenschaften für eine Klickfläche, die kein `<button>` ist (eine Zeile,
 * eine Kopfzeile, ein SVG-Knoten): mit Tab erreichbar, mit Enter oder
 * Leertaste ausgelöst. Wo es geht, ist ein echter Knopf besser.
 */
export function alsKnopf(aktion: () => void): {
  role: 'button';
  tabIndex: 0;
  onKeyDown: (ereignis: { key: string; target: unknown; currentTarget: unknown; preventDefault(): void }) => void;
} {
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (ereignis) => {
      // Nur wenn die Fläche selbst den Fokus hat: ein Enter in einem Feld
      // darin gehört dem Feld.
      if (ereignis.target !== ereignis.currentTarget || !istAusloeser(ereignis)) return;
      ereignis.preventDefault();
      aktion();
    }
  };
}
