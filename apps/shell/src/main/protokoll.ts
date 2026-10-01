/**
 * Das Sitzungsprotokoll im Hauptprozess (docs/sitzungsprotokoll.md).
 *
 * Hält die laufende Sitzung und schreibt sie nach jeder Änderung (gebündelt)
 * nach `<userData>/protokoll/laufend.json`. Stürzt die App ab, ist die
 * Sitzung beim nächsten Start wieder da. Die Nummer der nächsten Sitzung
 * steht in `zaehler.json`.
 */
import { join } from 'node:path';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import {
  bereinigeMeldung,
  bereinigeSitzung,
  mitDabei,
  mitEintrag,
  mitNotiz,
  neueSitzung,
  type ProtokollArt,
  type Sitzung
} from '../shared/protokoll';

export class Protokollfuehrer {
  private sitzung: Sitzung | null = null;
  private zeitgeber: NodeJS.Timeout | null = null;
  private readonly ordner: string;

  constructor(
    userData: string,
    /** Nach jeder Änderung: die Hülle zeigt die Zahl der Einträge. */
    private readonly geaendert: (s: Sitzung | null) => void
  ) {
    this.ordner = join(userData, 'protokoll');
  }

  /** Beim Start: eine Sitzung, die bei einem Absturz offen blieb, zurückholen. */
  async lade(): Promise<void> {
    try {
      this.sitzung = bereinigeSitzung(JSON.parse(await readFile(join(this.ordner, 'laufend.json'), 'utf8')));
    } catch {
      this.sitzung = null;
    }
  }

  zustand(): Sitzung | null {
    return this.sitzung;
  }

  laeuft(): boolean {
    return this.sitzung !== null && this.sitzung.ende === null;
  }

  async naechsteNummer(): Promise<number> {
    try {
      const n = Number(JSON.parse(await readFile(join(this.ordner, 'zaehler.json'), 'utf8')).naechste);
      return Number.isInteger(n) && n > 0 ? n : 1;
    } catch {
      return 1;
    }
  }

  start(titel: string, dabei: readonly string[]): Sitzung {
    if (this.laeuft() && this.sitzung) return this.sitzung;
    this.setze(mitDabei(neueSitzung(new Date().toISOString(), titel), dabei));
    return this.sitzung ?? neueSitzung(new Date().toISOString(), titel);
  }

  melde(quelle: string, roh: unknown): void {
    if (!this.laeuft() || !this.sitzung) return;
    const m = bereinigeMeldung(roh);
    if (!m) return;
    this.setze(mitEintrag(this.sitzung, { ...m, quelle, zeit: new Date().toISOString() }));
  }

  eintrag(quelle: string, art: ProtokollArt, text: string, wichtig?: boolean): void {
    this.melde(quelle, { art, text, wichtig });
  }

  dabei(namen: readonly string[]): void {
    if (this.laeuft() && this.sitzung) this.setze(mitDabei(this.sitzung, namen));
  }

  notiz(titel: string): void {
    if (this.laeuft() && this.sitzung) this.setze(mitNotiz(this.sitzung, titel));
  }

  stopp(): Sitzung | null {
    if (!this.sitzung) return null;
    if (!this.sitzung.ende) this.setze({ ...this.sitzung, ende: new Date().toISOString() });
    return this.sitzung;
  }

  /** Aus der Vorschau: Titel und abgewählte Einträge übernehmen. */
  bearbeite(roh: unknown): Sitzung | null {
    const s = bereinigeSitzung(roh);
    if (!s || !this.sitzung) return this.sitzung;
    this.setze({ ...this.sitzung, titel: s.titel, eintraege: s.eintraege, ende: this.sitzung.ende ?? s.ende });
    return this.sitzung;
  }

  /** Nach dem Anlegen oder Verwerfen: weg damit; beim Anlegen zählt die Nummer hoch. */
  async schliesse(angelegt: boolean): Promise<void> {
    this.sitzung = null;
    if (this.zeitgeber) clearTimeout(this.zeitgeber);
    this.zeitgeber = null;
    await unlink(join(this.ordner, 'laufend.json')).catch(() => undefined);
    if (angelegt) {
      const n = await this.naechsteNummer();
      await mkdir(this.ordner, { recursive: true });
      await writeFile(join(this.ordner, 'zaehler.json'), JSON.stringify({ naechste: n + 1 }), 'utf8');
    }
    this.geaendert(null);
  }

  private setze(s: Sitzung): void {
    this.sitzung = s;
    this.geaendert(s);
    // Gebündelt schreiben: beim schnellen Würfeln nicht jede Zeile einzeln.
    if (this.zeitgeber) return;
    this.zeitgeber = setTimeout(() => {
      this.zeitgeber = null;
      void this.schreibe();
    }, 500);
  }

  async schreibe(): Promise<void> {
    if (!this.sitzung) return;
    try {
      await mkdir(this.ordner, { recursive: true });
      await writeFile(join(this.ordner, 'laufend.json'), JSON.stringify(this.sitzung), 'utf8');
    } catch {
      // Kein Platz oder keine Rechte: das Protokoll lebt dann nur im Speicher.
    }
  }
}
