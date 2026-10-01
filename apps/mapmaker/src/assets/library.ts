/**
 * Prop-Bibliothek: eingebaute prozedurale Props plus später importierte Assets.
 *
 * Der Rest der Anwendung kennt nur Prop-Ids. Ob dahinter eine Zeichenfunktion
 * oder eine PNG-Datei steckt, entscheidet sich erst hier — dadurch behandelt
 * der Renderer beide Quellen gleich.
 */

import { BUILTIN_PROPS } from './procedural/props';
import { tagWords } from './propTags';
import {
  CATEGORY_ORDER,
  categoryLabel,
  propName,
  type PropCategory,
  type PropDef,
} from './propTypes';

const registry = new Map<string, PropDef>();
for (const p of BUILTIN_PROPS) registry.set(p.id, p);

const changeListeners = new Set<() => void>();

export function onLibraryChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function notify(): void {
  for (const fn of changeListeners) fn();
}

/**
 * Grundgröße beim Platzieren, je Prop. Gebäude sind als Draufsicht so groß
 * gezeichnet, dass sie neben Möbeln und Bäumen viel zu wuchtig wirken
 * (Rückmeldung); sie starten deshalb bei 20 %. Die Größe im Werkzeug und im
 * Inspector multipliziert sich darauf.
 */
export const GEBAEUDE_SKALA = 0.2;

export function grundSkala(propId: string): number {
  return getProp(propId)?.category === 'gebaeude' ? GEBAEUDE_SKALA : 1;
}

export function getProp(id: string): PropDef | undefined {
  return registry.get(id);
}

export function allProps(): PropDef[] {
  return [...registry.values()];
}

/** Registriert importierte Assets. Ids bestehender Props werden überschrieben. */
export function registerProps(defs: PropDef[]): void {
  for (const d of defs) registry.set(d.id, d);
  notify();
}

export function unregisterProps(ids: string[]): void {
  for (const id of ids) registry.delete(id);
  notify();
}

/** Nur importierte Props — die eingebauten lassen sich nicht entfernen. */
export function importedProps(): PropDef[] {
  return allProps().filter((p) => p.source === 'imported');
}

export function categoriesInUse(): PropCategory[] {
  const seen = new Set<PropCategory>();
  for (const p of registry.values()) seen.add(p.category);
  // Feste Reihenfolge statt Einfügereihenfolge, damit die Palette stabil bleibt.
  return CATEGORY_ORDER.filter((c) => seen.has(c));
}

/** Sucht über Name und Tags; leere Anfrage liefert die ganze Kategorie. */
export function searchProps(query: string, category: PropCategory | 'all' = 'all'): PropDef[] {
  const q = query.trim().toLowerCase();
  return allProps().filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (!q) return true;
    // Auch der übersetzte Name wird durchsucht: wer auf Englisch arbeitet, tippt
    // „boulder" und nicht „Felsbrocken". Bei den Schlagwörtern gilt dasselbe,
    // und zwar in *beide* Richtungen, unabhängig von der eingestellten Sprache:
    // „chest" soll die Truhe auch dann finden, wenn die Oberfläche deutsch ist.
    return (
      propName(p).toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      p.tags.some((tag) => tagWords(tag).some((w) => w.toLowerCase().includes(q)))
    );
  });
}

export { CATEGORY_ORDER, categoryLabel, propName };
export type { PropCategory, PropDef };
