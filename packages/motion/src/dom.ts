/**
 * Rückmeldungen, die am DOM hängen (Rückmeldung: „mehr Animationen, wo sie
 * etwas sagen“). Getrennt von index.ts, weil dort keine Browser-Globals
 * stehen sollen. Die Klassen stehen in motion.css.
 *
 * - `spieleAb`: eine Animationsklasse (neu) abspielen, auch zweimal hintereinander.
 * - `feldStand`/`leuchteGeaendertes`: nach einem Wurf leuchtet auf, was sich geändert hat
 *   (React: `useWurfLeuchten` in react.ts).
 * - `ausblendenUnd`: blendet den Eintrag aus und führt dann erst das Löschen aus.
 */

/** Längste Animationsdauer, auf die gewartet wird, falls `animationend` ausbleibt. */
const NOTFALL_MS = 700;

export function spieleAb(el: Element | null | undefined, klasse: string): void {
  if (!el) return;
  el.classList.remove(klasse);
  // Neu anstoßen: ohne erzwungenes Layout liefe dieselbe Animation nicht zweimal.
  void (el as HTMLElement).offsetWidth;
  el.classList.add(klasse);
  const weg = () => el.classList.remove(klasse);
  el.addEventListener('animationend', weg, { once: true });
  window.setTimeout(weg, NOTFALL_MS * 2);
}

function inhalt(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value;
  return el.textContent ?? '';
}

/** Der Inhalt aller Felder mit `auswahl`, für den Vergleich nach einer Änderung. */
export function feldStand(wurzel: ParentNode = document, auswahl = '[data-wurf-feld]'): Map<Element, string> {
  const stand = new Map<Element, string>();
  for (const el of wurzel.querySelectorAll(auswahl)) stand.set(el, inhalt(el));
  return stand;
}

/**
 * Lässt aufleuchten, was sich gegenüber `alt` geändert hat oder neu dazukam,
 * außer dem Feld, in dem gerade getippt wird (das hat man selbst geändert).
 * Ohne alten Stand (erster Blick) leuchtet nichts.
 */
export function leuchteGeaendertes(alt: ReadonlyMap<Element, string> | null, neu: ReadonlyMap<Element, string>): void {
  if (!alt || alt.size === 0) return;
  const fokus = document.activeElement;
  for (const [el, wert] of neu) {
    if (alt.get(el) === wert) continue;
    if (fokus && (el === fokus || el.contains(fokus))) continue;
    spieleAb(el, 'motion-neu');
  }
}

/**
 * Vor einer Änderung aufrufen, die Dinge „anschaltet“ (Rast füllt Plätze und
 * Würfel auf); die zurückgegebene Funktion danach. Alles, was jetzt auf
 * `auswahl` passt und vorher nicht, spielt `klasse` ab.
 */
export function vorDemAuffuellen(auswahl: string, klasse = 'motion-auffuellen', wurzel: ParentNode = document): () => void {
  const vorher = new Set(wurzel.querySelectorAll(auswahl));
  return () =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        for (const el of wurzel.querySelectorAll(auswahl)) if (!vorher.has(el)) spieleAb(el, klasse);
      })
    );
}

/**
 * Löschen mit Ausblenden: Der nächste Behälter mit `data-ausblenden` (sonst
 * ein `li`) blendet aus, danach läuft `aktion`. Ohne Behälter läuft sie sofort.
 */
export function ausblendenUnd(ausloeser: EventTarget | null, aktion: () => void): void {
  const el = ausloeser instanceof Element ? ausloeser.closest('[data-ausblenden], li') : null;
  if (!el) {
    aktion();
    return;
  }
  let fertig = false;
  const los = () => {
    if (fertig) return;
    fertig = true;
    aktion();
    // Listen mit der Stelle als Schlüssel nehmen das Element für den nächsten
    // Eintrag weiter; ausgeblendet bliebe der sonst unsichtbar. Nach dem
    // Zeichnen wieder sichtbar machen.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => el.classList.remove('motion-weg')));
  };
  el.classList.add('motion-weg');
  el.addEventListener('animationend', los, { once: true });
  window.setTimeout(los, NOTFALL_MS);
}
