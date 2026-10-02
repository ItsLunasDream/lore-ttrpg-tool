/**
 * Das Passwort eigener Räume, damit „Fortsetzen" ohne neues Eintippen geht
 * (Rückmeldung). Verschlüsselt mit dem Schlüsselbund des Betriebssystems
 * (`verschluessle` wie beim KI-Schlüssel); steht der nicht zur Verfügung,
 * wird nichts gemerkt und das Passwort wie bisher neu eingegeben.
 *
 * Eigene Datei neben den gespeicherten Räumen: die lassen sich exportieren
 * und weitergeben, das Passwort soll dabei nicht mitreisen.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { entschluessle, verschluessle } from './ki';

export class Raumpasswoerter {
  constructor(private readonly datei: string) {}

  private async lies(): Promise<Record<string, string>> {
    try {
      const roh = JSON.parse(await readFile(this.datei, 'utf8')) as unknown;
      return roh && typeof roh === 'object' ? (roh as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /** Das gemerkte Passwort, oder '' (keins, oder nicht mehr lesbar). */
  async gib(raumId: string): Promise<string> {
    const abgelegt = (await this.lies())[raumId];
    return typeof abgelegt === 'string' ? entschluessle(abgelegt) : '';
  }

  /** Merkt das Passwort; ein leeres Passwort vergisst es. */
  async merke(raumId: string, passwort: string): Promise<boolean> {
    const alle = await this.lies();
    if (!passwort) delete alle[raumId];
    else {
      const verschluesselt = verschluessle(passwort);
      if (!verschluesselt) return false;
      alle[raumId] = verschluesselt;
    }
    await mkdir(dirname(this.datei), { recursive: true });
    await writeFile(this.datei, JSON.stringify(alle), 'utf8');
    return true;
  }
}
