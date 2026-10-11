/**
 * Welche Browser-Berechtigungen eine Seite in der Hülle bekommt.
 *
 * Ohne eigenen Handler sagt Electron zu fast allem ja: Kamera, Mikrofon,
 * Standort, Benachrichtigungen. Keines der Werkzeuge braucht das, und eine
 * präparierte Datei, die doch Code einschleust, sollte es auch nicht bekommen.
 * Deshalb eine kurze Erlaubnisliste für jede Sitzung, nichts sonst.
 */

import type { Session } from 'electron';

/**
 * Was die Werkzeuge wirklich brauchen:
 * - `clipboard-sanitized-write`: „Kopieren“-Knöpfe (navigator.clipboard.writeText).
 * - `fileSystem`: der Karteneditor speichert über showSaveFilePicker und liest
 *   Asset-Ordner über showDirectoryPicker.
 * - `fullscreen`: Vollbild einzelner Ansichten.
 */
export const ERLAUBTE_BERECHTIGUNGEN: ReadonlySet<string> = new Set([
  'clipboard-sanitized-write',
  'fileSystem',
  'fullscreen'
]);

export function istErlaubt(berechtigung: string): boolean {
  return ERLAUBTE_BERECHTIGUNGEN.has(berechtigung);
}

/** Setzt Anfrage- und Prüf-Handler; für jede Sitzung einmal aufrufen. */
export function begrenzeBerechtigungen(sitzung: Session): void {
  sitzung.setPermissionRequestHandler((_inhalt, berechtigung, antwort) => antwort(istErlaubt(berechtigung)));
  sitzung.setPermissionCheckHandler((_inhalt, berechtigung) => istErlaubt(berechtigung));
}
