/**
 * React-Hülle für `leuchteGeaendertes` (Rückmeldung: beim Neuwürfeln sah man
 * kaum, was sich geändert hat).
 *
 * Nach jeder Änderung von `daten` leuchten die Felder mit `data-wurf-feld`
 * auf, deren Inhalt jetzt anders ist; das Feld mit dem Fokus nicht, denn das
 * hat man selbst getippt. Wechselt `kennung` (ein anderer Eintrag wird
 * geöffnet), wird nur neu gemerkt, nichts leuchtet.
 */
import { useEffect, useRef } from 'react';
import { feldStand, leuchteGeaendertes, spieleAb } from './dom';

export function useWurfLeuchten(daten: unknown, kennung = '', auswahl = '[data-wurf-feld]'): void {
  const stand = useRef<Map<Element, string> | null>(null);
  const letzte = useRef(kennung);
  useEffect(() => {
    const neu = feldStand(document, auswahl);
    if (letzte.current === kennung) leuchteGeaendertes(stand.current, neu);
    stand.current = neu;
    letzte.current = kennung;
  }, [daten, kennung, auswahl]);
}

/**
 * Lässt ein Element rot (weniger) oder grün (mehr) aufblitzen, wenn sich
 * `wert` ändert (Rückmeldung: Schaden und Heilung sichtbar machen). Beim
 * ersten Zeichnen und bei einem Wechsel von `kennung` (anderer Bogen,
 * andere Figur) blitzt nichts.
 */
export function useWertBlitz(ref: { readonly current: Element | null }, wert: number, kennung = ''): void {
  const vorher = useRef<{ wert: number; kennung: string } | null>(null);
  useEffect(() => {
    const alt = vorher.current;
    vorher.current = { wert, kennung };
    if (!alt || alt.kennung !== kennung || alt.wert === wert) return;
    spieleAb(ref.current, wert < alt.wert ? 'motion-schaden' : 'motion-heilung');
  }, [wert, kennung, ref]);
}

/**
 * Der Wert vom letzten Rendern, für verzögerte Aktionen wie `ausblendenUnd`.
 * Ohne das arbeitet das Löschen nach dem Ausblenden mit dem Stand vom Klick und
 * überschreibt eine Eingabe, die in der Zwischenzeit kam.
 */
export function useAktuell<T>(wert: T): { readonly current: T } {
  const ref = useRef(wert);
  ref.current = wert;
  return ref;
}
