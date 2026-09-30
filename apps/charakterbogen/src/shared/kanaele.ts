/**
 * Namen der IPC-Kanaele, mit Praefix.
 *
 * `ipcMain.handle` ist global: in der Huelle laufen mehrere Anwendungen im
 * selben Hauptprozess, und zwei gleich benannte Kanaele schliessen sich
 * gegenseitig aus.
 */
export const PRAEFIX = 'charakterbogen';

export function kanal(name: string): string {
  return `${PRAEFIX}:${name}`;
}
