/**
 * Gespeicherte Raeume und der Tischschluessel (docs/charakterbogen.md,
 * „Rollen und gespeicherte Raeume").
 *
 * Der Gastgeber speichert einen Raum mit Namen, Port, Internet-Schalter und
 * den gemerkten Rollen je Tischschluessel. Das Passwort steht nicht hier
 * (die Datei laesst sich exportieren), sondern verschluesselt daneben in
 * `raumPasswort.ts`, damit „Fortsetzen" ohne neues Eintippen geht.
 *
 * Der Tischschluessel ist ein Ed25519-Schluesselpaar je Installation. Mit ihm
 * erkennt der Gastgeber eine Person wieder, auch unter anderem Namen.
 *
 * Ohne Electron: nur node:fs und node:crypto, damit es sich pruefen laesst.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GemerkteRolle, Tischschluessel } from './raum';

export interface GespeicherterRaum {
  readonly id: string;
  readonly name: string;
  readonly internet: boolean;
  /** Nur mit Internet von Bedeutung; sonst sucht sich der Raum einen freien Port. */
  readonly port: number | null;
  readonly rollen: Readonly<Record<string, GemerkteRolle>>;
  /** Kennung des Gruppeninventars im Charakterbogen, falls verknuepft. */
  readonly gruppeninventar: string | null;
  readonly einstellungen: Raumeinstellungen;
  readonly geaendert: string;
}

export interface Raumeinstellungen {
  /** Duerfen Spieler:innen aus dem Gruppeninventar nehmen? */
  readonly gruppeNehmen: boolean;
  /** Aenderungen der SL an fremden Boegen sichtbar markieren (die SL kann je Aenderung still aendern). */
  readonly slMarkieren: boolean;
}

export const VORGABE_RAUMEINSTELLUNGEN: Raumeinstellungen = { gruppeNehmen: true, slMarkieren: true };

const MAX_ROLLEN = 200;

/** Liest einen Raum aus unsicherer Quelle (Datei, Import). Unbrauchbar: null. */
export function bereinigeRaum(roh: unknown): GespeicherterRaum | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 60) : '';
  if (!name) return null;
  const id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : neueRaumId();
  const rollen: Record<string, GemerkteRolle> = {};
  if (r.rollen && typeof r.rollen === 'object') {
    for (const [schluessel, wert] of Object.entries(r.rollen as Record<string, unknown>).slice(0, MAX_ROLLEN)) {
      if (!/^[A-Za-z0-9+/=]{20,200}$/.test(schluessel) || !wert || typeof wert !== 'object') continue;
      const w = wert as Record<string, unknown>;
      rollen[schluessel] = { name: typeof w.name === 'string' ? w.name.slice(0, 40) : '', sl: w.sl === true };
    }
  }
  const e = r.einstellungen && typeof r.einstellungen === 'object' ? (r.einstellungen as Record<string, unknown>) : {};
  const port = Number(r.port);
  return {
    id,
    name,
    internet: r.internet === true,
    port: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null,
    rollen,
    gruppeninventar: typeof r.gruppeninventar === 'string' && r.gruppeninventar ? r.gruppeninventar.slice(0, 120) : null,
    einstellungen: {
      gruppeNehmen: typeof e.gruppeNehmen === 'boolean' ? e.gruppeNehmen : VORGABE_RAUMEINSTELLUNGEN.gruppeNehmen,
      slMarkieren: typeof e.slMarkieren === 'boolean' ? e.slMarkieren : VORGABE_RAUMEINSTELLUNGEN.slMarkieren
    },
    geaendert: typeof r.geaendert === 'string' ? r.geaendert.slice(0, 40) : new Date().toISOString()
  };
}

export function neueRaumId(): string {
  return `raum-${randomBytes(5).toString('hex')}`;
}

/** Nacheinander schreiben, erst daneben, dann umbenennen (wie die Einstellungen). */
let kette: Promise<unknown> = Promise.resolve();
function inReihe<T>(arbeit: () => Promise<T>): Promise<T> {
  const lauf = kette.then(arbeit, arbeit);
  kette = lauf.catch(() => undefined);
  return lauf;
}

export class Raumablage {
  constructor(private readonly ordner: string) {}

  private datei(id: string): string {
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new Error('ungueltige-id');
    return join(this.ordner, `${id}.json`);
  }

  async liste(): Promise<GespeicherterRaum[]> {
    let namen: string[] = [];
    try {
      namen = await readdir(this.ordner);
    } catch {
      return [];
    }
    const raeume: GespeicherterRaum[] = [];
    for (const n of namen) {
      if (!n.endsWith('.json')) continue;
      const r = await this.lies(n.slice(0, -5));
      if (r) raeume.push(r);
    }
    return raeume.sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  }

  async lies(id: string): Promise<GespeicherterRaum | null> {
    try {
      const r = bereinigeRaum(JSON.parse(await readFile(this.datei(id), 'utf8')));
      return r && r.id === id ? r : null;
    } catch {
      return null;
    }
  }

  speichere(raum: GespeicherterRaum): Promise<GespeicherterRaum> {
    return inReihe(async () => {
      const sauber = bereinigeRaum({ ...raum, geaendert: new Date().toISOString() });
      if (!sauber) throw new Error('ungueltig');
      await mkdir(this.ordner, { recursive: true });
      const ziel = this.datei(sauber.id);
      await writeFile(`${ziel}.neu`, JSON.stringify(sauber, null, 2), 'utf8');
      await rename(`${ziel}.neu`, ziel);
      return sauber;
    });
  }

  loesche(id: string): Promise<boolean> {
    return inReihe(async () => {
      try {
        await rm(this.datei(id));
        return true;
      } catch {
        return false;
      }
    });
  }

  /** Einlesen aus einer exportierten Datei; bekommt eine neue ID, falls die schon vergeben ist. */
  async lesEin(text: string): Promise<GespeicherterRaum | null> {
    let roh: unknown;
    try {
      roh = JSON.parse(text);
    } catch {
      return null;
    }
    const r = bereinigeRaum(roh);
    if (!r) return null;
    const frei = (await this.lies(r.id)) ? { ...r, id: neueRaumId() } : r;
    return this.speichere(frei);
  }
}

/**
 * Laedt den Tischschluessel oder legt ihn beim ersten Mal an. Synchron, weil
 * er beim Eroeffnen und Beitreten sofort gebraucht wird. Kaputt: neu anlegen
 * (die alten Rollen erkennen einen dann nicht mehr, das ist verkraftbar).
 */
export function ladeTischschluessel(datei: string): Tischschluessel {
  try {
    const roh = JSON.parse(readFileSync(datei, 'utf8')) as { privat?: unknown };
    if (typeof roh.privat === 'string') {
      const privat = createPrivateKey(roh.privat);
      const oeffentlich = (createPublicKey(privat).export({ format: 'der', type: 'spki' }) as Buffer).toString('base64');
      return { oeffentlich, privat };
    }
  } catch {
    // Neu anlegen.
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(datei), { recursive: true });
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
  writeFileSync(`${datei}.neu`, JSON.stringify({ privat: pem }), { encoding: 'utf8', mode: 0o600 });
  renameSync(`${datei}.neu`, datei);
  return { oeffentlich: (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64'), privat: privateKey };
}
