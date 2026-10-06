/**
 * Der Raum im lokalen Netz (docs/austausch.md, Stufe 2): Netz und Ablauf.
 *
 * Das Protokoll steht in `@suite/austausch` (raum.ts). Hier steht, wer
 * was wann schickt:
 *
 * - **Suchen**: auf UDP `RAUM_SUCHPORT` lauschen und sammeln, welche Raeume
 *   sich ankuendigen. Ein Raum, der sich 8 Sekunden nicht meldet, faellt aus
 *   der Liste.
 * - **Eroeffnen**: einen TCP-Dienst auf einem freien Port starten und alle
 *   2 Sekunden ins Netz rufen, dass es ihn gibt. Der Gastgeber ist selbst
 *   eine Person im Raum und verteilt alle Nachrichten.
 * - **Beitreten**: sich mit dem Gastgeber verbinden, die Herausforderung
 *   mit dem Passwort beantworten, Namen bekommen.
 *
 * Der Chat lebt nur, solange der Raum offen ist (vorlaeufig; ob er
 * gespeichert wird, entscheidet die Nutzerin).
 *
 * Ohne Electron: nur node:net, node:dgram, node:crypto. So laesst sich der
 * ganze Ablauf mit zwei Diensten in einem Prozess pruefen.
 */
import { createPublicKey, randomBytes, sign as unterschreibe, verify as pruefeUnterschrift, type KeyObject } from 'node:crypto';
import { createSocket, type Socket as UdpSocket } from 'node:dgram';
import { createServer, connect, type Server, type Socket } from 'node:net';
import { networkInterfaces } from 'node:os';
import {
  eindeutigerName,
  kodiere,
  leseAnkuendigung,
  leseNachricht,
  lesePaket,
  MAX_CHAT,
  MAX_PERSONEN,
  MAX_WARTEND,
  MAX_ZEILE,
  MAX_ZEILE_VOR_ANMELDUNG,
  RAUM_INTERNETPORT,
  RAUM_SUCHPORT,
  RAUM_VERSION,
  Zeilenleser,
  type Nachricht,
  type Person
} from '@suite/austausch';
import { Leitungsschutz, nachweis, nachweisStimmt, neueNonce, neuesSalz, stammschluessel } from './raumkrypto';

export interface GefundenerRaum {
  readonly raum: string;
  readonly gastgeber: string;
  readonly adresse: string;
  readonly port: number;
  readonly geschuetzt: boolean;
}

export interface Chatzeile {
  readonly von: Person;
  /** `null`: an alle. */
  readonly an: Person | null;
  readonly text: string;
  readonly zeit: string;
  readonly eigene: boolean;
  /** Bei einem Paket: die Namen der Eintraege darin (der Text bleibt leer). */
  readonly dateien?: readonly string[];
  /** Dieselben Eintraege mit Werkzeug und Kennung, damit ein Klick sie oeffnet. */
  readonly eintraege?: readonly { werkzeug: string; kennung: string; name: string }[];
  /** Eine Zeile der App selbst: `von` ist gekommen oder gegangen. */
  readonly system?: 'kommt' | 'geht';
}

/** Der Chat des Raums, aus dem man gerade kam, zum Nachlesen. */
export interface LetzterRaum {
  readonly raum: string;
  readonly chat: readonly Chatzeile[];
}

export interface Raumzustand {
  readonly rolle: 'aus' | 'gastgeber' | 'gast';
  readonly raum: string;
  readonly ich: Person | null;
  readonly personen: readonly Person[];
  readonly chat: readonly Chatzeile[];
  /** Nur beim Gastgeber: wo die anderen ihn erreichen, falls die Liste nicht geht. */
  readonly port: number | null;
  /** Nur beim Gastgeber: seine Adressen im lokalen Netz (IPv4). */
  readonly adressen: readonly string[];
  /** Nur beim Gastgeber: seine oeffentlichen IPv6-Adressen (ueber das Internet erreichbar, wenn die Firewall laesst). */
  readonly ipv6: readonly string[];
  /** Ob der Verkehr verschluesselt ist (der Raum hat ein Passwort). */
  readonly verschluesselt: boolean;
  /** Nur beim Gastgeber: ob der Raum auch ueber das Internet gedacht ist (fester Port). */
  readonly internet: boolean;
  /** Nur beim Gast: die zuletzt gemessene Laufzeit zum Gastgeber und zurueck, in ms. */
  readonly ping: number | null;
  /** Nur beim Gastgeber: der Ping zu jedem Gast, nach Personen-ID. */
  readonly pings: Readonly<Record<string, number>>;
  /**
   * Nur ausserhalb eines Raums: der Chat des letzten, damit er nach dem
   * Schliessen nicht sofort weg ist (Testbericht). `null`, wenn es keinen gab.
   */
  readonly letzter: LetzterRaum | null;
}

/** Die Namen der Eintraege eines Pakets; laesst es sich nicht lesen, der Titel. */
function eintraegeIn(paket: string): { werkzeug: string; kennung: string; name: string }[] {
  try {
    return lesePaket(paket).sendungen.map((s) => ({ werkzeug: s.werkzeug, kennung: s.kennung, name: s.name }));
  } catch {
    return [];
  }
}

function namenIn(paket: string, titel: string): string[] {
  try {
    const namen = lesePaket(paket).sendungen.map((s) => s.name);
    if (namen.length > 0) return namen;
  } catch {
    // Unten der Titel.
  }
  return [titel];
}

/** Die eigenen IPv4-Adressen im lokalen Netz, ohne die Schleife. */
export function eigeneAdressen(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a): a is NonNullable<typeof a> => Boolean(a) && a!.family === 'IPv4' && !a!.internal)
    .map((a) => a.address);
}

/**
 * Die eigenen IPv6-Adressen, ueber die man aus dem Internet erreichbar sein
 * kann: global (2000::/3), nicht die lokalen (fe80::, fc00::/7, ::1).
 */
export function eigeneIpv6(): string[] {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter(
          (a): a is NonNullable<typeof a> =>
            Boolean(a) && (a!.family === 'IPv6' || (a!.family as unknown) === 6) && !a!.internal && /^[23]/i.test(a!.address)
        )
        .map((a) => a.address)
    )
  ];
}

/** Warum eine Verbindung nicht zustande kam, so dass man etwas damit anfangen kann. */
export type Verbindungsgrund = 'verbindung' | 'getrennt' | 'geschlossen' | 'nichtErreichbar' | 'abgewiesen' | 'unbekannt';

function grundAus(fehler: unknown): Verbindungsgrund {
  const code = (fehler as { code?: string } | null)?.code ?? '';
  if (code === 'ECONNREFUSED') return 'abgewiesen';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'unbekannt';
  if (['ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ZEIT'].includes(code)) return 'nichtErreichbar';
  return 'verbindung';
}

export type Raumereignis =
  | { readonly art: 'raeume'; readonly raeume: readonly GefundenerRaum[] }
  | { readonly art: 'zustand'; readonly zustand: Raumzustand }
  /**
   * Nur die Messwerte: der Ping aendert sich alle paar Sekunden, dafuer
   * reicht ein kleines Ereignis statt des ganzen Zustands mit Chat.
   */
  | { readonly art: 'ping'; readonly ping: number | null; readonly pings: Readonly<Record<string, number>> }
  | { readonly art: 'chat'; readonly zeile: Chatzeile }
  | { readonly art: 'paket'; readonly von: Person; readonly an: Person | null; readonly titel: string; readonly paket: string }
  | { readonly art: 'werkzeug'; readonly von: Person; readonly werkzeug: string; readonly inhalt: string }
  /** Nur beim Gastgeber: die gemerkten Rollen haben sich geaendert (zum Speichern). */
  | { readonly art: 'rollen'; readonly rollen: Readonly<Record<string, GemerkteRolle>> }
  | { readonly art: 'fehler'; readonly grund: 'passwort' | 'voll' | 'version' | Verbindungsgrund };

/** Eine gemerkte Rolle, nach Tischschluessel. Der Name ist nur zum Anzeigen. */
export interface GemerkteRolle {
  readonly name: string;
  readonly sl: boolean;
}

/** Der Tischschluessel dieser Installation (Ed25519). */
export interface Tischschluessel {
  /** SPKI als Base64: so reist er, so wird er gemerkt. */
  readonly oeffentlich: string;
  readonly privat: KeyObject;
}

/** Was unterschrieben wird: die Zufallszahl des Gastgebers und der Raumname. */
function zuUnterschreiben(nonce: string, raum: string): Buffer {
  return Buffer.from(`${nonce}:${raum}`, 'utf8');
}

interface Gastverbindung {
  person: Person | null;
  /** Der geprueft vorgezeigte Tischschluessel, sonst null. */
  schluessel?: string | null;
  socket: Socket;
  nonce: string;
  /** Ab der Anmeldung, wenn der Raum ein Passwort hat. */
  schutz: Leitungsschutz | null;
}

/** Wie lange ein Beitritt auf Antwort wartet, bevor er aufgibt. */
const BEITRITT_FRIST_MS = 10_000;
/** Wie oft ein Gast die Laufzeit zum Gastgeber misst. */
const PING_TAKT_MS = 3_000;

export class Raumdienst {
  private rolle: Raumzustand['rolle'] = 'aus';
  private raumName = '';
  private ich: Person | null = null;
  private personen: Person[] = [];
  private chat: Chatzeile[] = [];
  private letzter: LetzterRaum | null = null;

  // Gastgeber
  private server: Server | null = null;
  private gaeste = new Set<Gastverbindung>();
  private salz = '';
  private stamm: Buffer | null = null;
  private internet = false;
  private rufer: UdpSocket | null = null;
  private rufTakt: NodeJS.Timeout | null = null;
  /** Gemerkte Rollen nach Tischschluessel (aus dem gespeicherten Raum). */
  private rollen = new Map<string, GemerkteRolle>();

  // Gast
  private leitung: Socket | null = null;
  private leitungsschutz: Leitungsschutz | null = null;
  // Ping beim Gast: alle PING_TAKT_MS eine Messung, die offene merkt sich ihre Startzeit.
  private ping: number | null = null;
  private pingTakt: ReturnType<typeof setInterval> | null = null;
  /** Beim Gastgeber: schickt die letzte Ankuendigung („zu") und schliesst den Rufer. */
  private abschied: (() => void) | null = null;
  private pingOffen = new Map<number, number>();
  // Beim Gastgeber: der Ping zu jedem Gast; offene Messungen mit Person und Startzeit.
  private gastPings = new Map<string, number>();
  private gastPingOffen = new Map<number, { id: string; start: number }>();
  private pingZaehler = 0;

  // Suche
  private lauscher: UdpSocket | null = null;
  private gefunden = new Map<string, GefundenerRaum & { gesehen: number }>();
  private suchTakt: NodeJS.Timeout | null = null;

  constructor(
    private readonly melde: (ereignis: Raumereignis) => void,
    private readonly optionen: { suchport?: number; rufziel?: string; schluessel?: () => Tischschluessel | null } = {}
  ) {}

  private schluessel(): Tischschluessel | null {
    try {
      return this.optionen.schluessel?.() ?? null;
    } catch {
      return null;
    }
  }

  private get suchport(): number {
    return this.optionen.suchport ?? RAUM_SUCHPORT;
  }

  zustand(): Raumzustand {
    return {
      rolle: this.rolle,
      raum: this.raumName,
      ich: this.ich,
      personen: this.personen,
      chat: this.chat,
      port: this.server ? ((this.server.address() as { port: number } | null)?.port ?? null) : null,
      adressen: this.server ? eigeneAdressen() : [],
      ipv6: this.server ? eigeneIpv6() : [],
      verschluesselt: this.rolle === 'gastgeber' ? this.stamm !== null : this.leitungsschutz !== null,
      internet: this.rolle === 'gastgeber' && this.internet,
      ping: this.rolle === 'gast' ? this.ping : null,
      pings: this.rolle === 'gastgeber' ? Object.fromEntries(this.gastPings) : {},
      letzter: this.rolle === 'aus' ? this.letzter : null
    };
  }

  /** Den nachzulesenden Chat des letzten Raums verwerfen. */
  vergissLetzten(): void {
    if (!this.letzter) return;
    this.letzter = null;
    this.meldeZustand();
  }

  /**
   * Die Personenliste setzen und im Chat vermerken, wer gekommen oder
   * gegangen ist. Die eigene Person bekommt keine Zeile.
   */
  private setzePersonen(neu: Person[]): void {
    const alt = this.personen;
    this.personen = neu;
    const zeit = new Date().toISOString();
    const zeilen: Chatzeile[] = [];
    for (const p of neu)
      if (p.id !== this.ich?.id && !alt.some((a) => a.id === p.id))
        zeilen.push({ von: p, an: null, text: '', zeit, eigene: false, system: 'kommt' });
    for (const p of alt)
      if (p.id !== this.ich?.id && !neu.some((n) => n.id === p.id))
        zeilen.push({ von: p, an: null, text: '', zeit, eigene: false, system: 'geht' });
    for (const zeile of zeilen) {
      this.chat = [...this.chat, zeile].slice(-500);
      this.melde({ art: 'chat', zeile });
    }
  }

  private meldeZustand(): void {
    this.melde({ art: 'zustand', zustand: this.zustand() });
  }

  private meldePing(): void {
    this.melde({
      art: 'ping',
      ping: this.rolle === 'gast' ? this.ping : null,
      pings: this.rolle === 'gastgeber' ? Object.fromEntries(this.gastPings) : {}
    });
  }

  /* ---------------------------------------------------------------- Suche */

  suche(): void {
    if (this.lauscher) return;
    const s = createSocket({ type: 'udp4', reuseAddr: true });
    s.on('error', () => {
      // Port belegt oder kein Netz: die Liste bleibt leer, Beitreten ueber
      // die Adresse geht weiter.
      s.close();
      if (this.lauscher === s) this.lauscher = null;
    });
    s.on('message', (daten, woher) => {
      const a = leseAnkuendigung(daten.toString('utf8'));
      if (!a || a.version !== RAUM_VERSION) return;
      const schluessel = `${woher.address}:${a.port}`;
      if (a.zu) {
        if (this.gefunden.delete(schluessel)) this.meldeRaeume();
        return;
      }
      const alt = this.gefunden.get(schluessel);
      this.gefunden.set(schluessel, {
        raum: a.raum,
        gastgeber: a.gastgeber,
        adresse: woher.address,
        port: a.port,
        geschuetzt: a.geschuetzt,
        gesehen: Date.now()
      });
      // Jeder Raum meldet sich alle zwei Sekunden; die Oberflaeche erfaehrt
      // nur, was neu ist oder sich geaendert hat.
      if (!alt || alt.raum !== a.raum || alt.gastgeber !== a.gastgeber || alt.geschuetzt !== a.geschuetzt) this.meldeRaeume();
    });
    s.bind(this.suchport);
    this.lauscher = s;
    this.suchTakt = setInterval(() => {
      const vorher = this.gefunden.size;
      for (const [k, r] of this.gefunden) if (Date.now() - r.gesehen > 8000) this.gefunden.delete(k);
      if (this.gefunden.size !== vorher) this.meldeRaeume();
    }, 2000);
  }

  /**
   * Liste leeren und neu sammeln. Die Gastgeber melden sich alle zwei
   * Sekunden; wer noch da ist, steht gleich wieder drin. Gegen Eintraege,
   * die haengen geblieben sind, und fuer das Gefuehl, etwas getan zu haben.
   */
  aktualisiereSuche(): void {
    this.suche();
    this.gefunden.clear();
    this.meldeRaeume();
  }

  raeume(): GefundenerRaum[] {
    return [...this.gefunden.values()].map(({ gesehen: _g, ...r }) => r);
  }

  private meldeRaeume(): void {
    this.melde({ art: 'raeume', raeume: this.raeume() });
  }

  beendeSuche(): void {
    if (this.suchTakt) clearInterval(this.suchTakt);
    this.suchTakt = null;
    this.lauscher?.close();
    this.lauscher = null;
    this.gefunden.clear();
  }

  /* ------------------------------------------------------------ Gastgeber */

  /**
   * Einen Raum eroeffnen.
   *
   * Im lokalen Netz nimmt er einen freien Port. Ueber das Internet braucht er
   * einen festen (fuer die Portfreigabe im Router) und ein Passwort: ohne
   * Verschluesselung geht nichts ueber fremde Leitungen. Gelauscht wird auf
   * IPv4 und IPv6 zugleich; wo es kein IPv6 gibt, nur auf IPv4.
   */
  async eroeffne(
    raum: string,
    passwort: string,
    name: string,
    optionen: { internet?: boolean; port?: number; sl?: boolean; rollen?: Readonly<Record<string, GemerkteRolle>> } = {}
  ): Promise<number> {
    this.verlasse();
    this.rollen = new Map(Object.entries(optionen.rollen ?? {}));
    const internet = optionen.internet === true;
    if (internet && !passwort) throw new Error('passwort-noetig');
    this.salz = passwort ? neuesSalz() : '';
    this.stamm = passwort ? await stammschluessel(passwort, this.salz) : null;
    this.internet = internet;
    const wunschport = internet ? (optionen.port ?? RAUM_INTERNETPORT) : 0;
    const server = createServer((socket) => this.nimmGastAuf(socket));
    const lausche = (host: string) =>
      new Promise<void>((fertig, fehler) => {
        const beiFehler = (e: Error) => {
          server.off('listening', beiBereit);
          fehler(e);
        };
        const beiBereit = () => {
          server.off('error', beiFehler);
          fertig();
        };
        server.once('error', beiFehler);
        server.once('listening', beiBereit);
        server.listen({ port: wunschport, host, ipv6Only: false });
      });
    try {
      await lausche('::');
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'EADDRINUSE') throw new Error('port-belegt');
      // Kein IPv6 auf diesem Rechner: dann eben nur IPv4.
      try {
        await lausche('0.0.0.0');
      } catch (e2) {
        if ((e2 as { code?: string }).code === 'EADDRINUSE') throw new Error('port-belegt');
        throw e2;
      }
    }
    this.server = server;
    this.raumName = raum.trim().slice(0, 40) || name;
    const eigener = this.schluessel()?.oeffentlich;
    const gemerkt = eigener ? this.rollen.get(eigener) : undefined;
    // Ausdruecklich angegeben gilt; sonst was gemerkt ist; sonst leitet, wer eroeffnet.
    const sl = optionen.sl ?? gemerkt?.sl ?? true;
    this.ich = { id: 'gastgeber', name: eindeutigerName(name, []), ...(sl ? { sl: true } : {}) };
    if (eigener) this.merkeRolle(eigener, this.ich);
    this.personen = [this.ich];
    this.chat = [];
    this.letzter = null;
    this.rolle = 'gastgeber';
    const port = (server.address() as { port: number }).port;
    this.starteRuf(port);
    this.starteGastPing();
    this.meldeZustand();
    return port;
  }

  private starteRuf(port: number): void {
    const rufer = createSocket({ type: 'udp4', reuseAddr: true });
    rufer.on('error', () => undefined);
    rufer.bind(() => {
      try {
        rufer.setBroadcast(true);
      } catch {
        // Ohne Broadcast kein Eintrag in der Liste; Beitreten ueber die
        // Adresse geht trotzdem.
      }
    });
    this.rufer = rufer;
    const ankuendigung = (zu: boolean) =>
      kodiere({
        typ: 'ttrpg-raum',
        version: RAUM_VERSION,
        raum: this.raumName,
        gastgeber: this.ich?.name ?? '',
        port,
        geschuetzt: this.stamm !== null,
        ...(zu ? { zu: true } : {})
      });
    const ziel = this.optionen.rufziel ?? '255.255.255.255';
    const rufe = () => {
      if (!this.ich) return;
      rufer.send(ankuendigung(false), this.suchport, ziel, () => undefined);
    };
    // Beim Schliessen: „zu" ankuendigen, damit der Raum sofort aus den
    // Listen verschwindet, statt noch Sekunden darin zu stehen.
    this.abschied = () => {
      const text = ankuendigung(true);
      rufer.send(text, this.suchport, ziel, () => rufer.close());
    };
    setTimeout(rufe, 100);
    this.rufTakt = setInterval(rufe, 2000);
  }

  private nimmGastAuf(socket: Socket): void {
    socket.setEncoding('utf8');
    const gast: Gastverbindung = { person: null, socket, nonce: neueNonce(), schutz: null };
    // Vor der Anmeldung kurz und klein: wer das Passwort nicht kennt, soll
    // den Raum weder mit offenen Leitungen füllen noch mit einer riesigen
    // Zeile den Speicher (Prüfung vor der Veröffentlichung).
    const leser = new Zeilenleser(MAX_ZEILE_VOR_ANMELDUNG);
    const angemeldet = [...this.gaeste].filter((g) => g.person).length;
    if (angemeldet >= MAX_PERSONEN - 1) {
      socket.end(kodiere({ typ: 'abgelehnt', grund: 'voll' }));
      return;
    }
    if (this.gaeste.size - angemeldet >= MAX_WARTEND) {
      socket.destroy();
      return;
    }
    const frist = setTimeout(() => {
      if (!gast.person) socket.destroy();
    }, BEITRITT_FRIST_MS);
    this.gaeste.add(gast);
    socket.write(kodiere({ typ: 'herausforderung', raum: this.raumName, nonce: gast.nonce, salz: this.salz }));
    socket.on('data', (stueck: string) => {
      let zeilen: string[];
      try {
        zeilen = leser.schiebe(stueck);
      } catch {
        socket.destroy();
        return;
      }
      for (const zeile of zeilen) {
        // Nach der Anmeldung nur noch Verschluesseltes; was sich nicht
        // entschluesseln laesst, ist gefaelscht oder vertauscht: Leitung zu.
        const klar = gast.schutz ? gast.schutz.entpacke(zeile) : zeile;
        if (klar === null) {
          socket.destroy();
          return;
        }
        const n = leseNachricht(klar);
        if (n) this.vonGast(gast, n);
        if (gast.person && leser.max !== MAX_ZEILE) {
          clearTimeout(frist);
          leser.max = MAX_ZEILE;
        }
      }
    });
    const weg = () => {
      clearTimeout(frist);
      if (!this.gaeste.delete(gast)) return;
      if (gast.person) {
        this.gastPings.delete(gast.person.id);
        this.setzePersonen(this.personen.filter((p) => p.id !== gast.person?.id));
        this.verteilePersonen();
      }
    };
    socket.on('close', weg);
    socket.on('error', weg);
  }

  private vonGast(gast: Gastverbindung, n: Nachricht): void {
    if (!gast.person) {
      if (n.typ !== 'hallo') return;
      if (n.version !== RAUM_VERSION) {
        gast.socket.end(kodiere({ typ: 'abgelehnt', grund: 'version' }));
        return;
      }
      if (this.stamm) {
        if (!n.gastNonce || !nachweisStimmt(this.stamm, gast.nonce, n.gastNonce, n.nachweis)) {
          gast.socket.end(kodiere({ typ: 'abgelehnt', grund: 'passwort' }));
          return;
        }
        gast.schutz = new Leitungsschutz(this.stamm, gast.nonce, n.gastNonce, 'gastgeber');
      }
      gast.schluessel = null;
      if (n.schluessel && n.unterschrift) {
        try {
          const offen = createPublicKey({ key: Buffer.from(n.schluessel, 'base64'), format: 'der', type: 'spki' });
          if (pruefeUnterschrift(null, zuUnterschreiben(gast.nonce, this.raumName), offen, Buffer.from(n.unterschrift, 'base64'))) {
            gast.schluessel = n.schluessel;
          }
        } catch {
          // Kein gueltiger Schluessel: ein Gast ohne Gedaechtnis.
        }
      }
      const gemerkt = gast.schluessel ? this.rollen.get(gast.schluessel) : undefined;
      gast.person = {
        id: randomBytes(6).toString('hex'),
        name: eindeutigerName(n.name, this.personen.map((p) => p.name)),
        ...(gemerkt?.sl ? { sl: true } : {})
      };
      if (gast.schluessel) this.merkeRolle(gast.schluessel, gast.person);
      this.setzePersonen([...this.personen, gast.person]);
      this.schreibe(gast, { typ: 'willkommen', du: gast.person, personen: this.personen });
      this.verteilePersonen();
      return;
    }
    if (n.typ === 'pong') {
      const offen = this.gastPingOffen.get(n.n);
      if (!offen || offen.id !== gast.person.id) return;
      this.gastPingOffen.delete(n.n);
      const ms = Math.max(0, Math.round(performance.now() - offen.start));
      if (this.gastPings.get(offen.id) !== ms) {
        this.gastPings.set(offen.id, ms);
        this.meldePing();
      }
      return;
    }
    if (n.typ === 'ping') {
      // Sofort zurueck, damit die Messung nur die Leitung misst.
      this.schreibe(gast, { typ: 'pong', n: n.n });
      return;
    }
    if (n.typ === 'name') {
      const alt = gast.person;
      const neu = {
        ...alt,
        name: eindeutigerName(n.name.trim(), this.personen.filter((p) => p.id !== alt.id).map((p) => p.name))
      };
      gast.person = neu;
      this.personen = this.personen.map((p) => (p.id === neu.id ? neu : p));
      if (gast.schluessel) this.merkeRolle(gast.schluessel, neu);
      this.verteilePersonen();
      return;
    }
    if (n.typ === 'rolle') {
      this.setzeRolle(gast.person.id, n.person, n.sl);
      return;
    }
    // Absender ist, wer die Leitung haelt — nicht, wer im Feld steht.
    if (n.typ === 'chat') this.verteile({ ...n, von: gast.person.id, zeit: new Date().toISOString() });
    if (n.typ === 'paket') this.verteile({ ...n, von: gast.person.id, zeit: new Date().toISOString() });
    if (n.typ === 'werkzeug') this.verteile({ ...n, von: gast.person.id, zeit: new Date().toISOString() });
  }

  /** Eine Nachricht an einen Gast, verschluesselt, wenn der Raum ein Passwort hat. */
  private schreibe(gast: Gastverbindung, n: Nachricht): void {
    gast.socket.write(gast.schutz ? gast.schutz.verpacke(kodiere(n).slice(0, -1)) : kodiere(n));
  }

  /** Merkt die Rolle einer Person unter ihrem Schluessel und meldet es zum Speichern. */
  private merkeRolle(schluessel: string, person: Person): void {
    const alt = this.rollen.get(schluessel);
    const neu = { name: person.name, sl: person.sl === true };
    if (alt && alt.name === neu.name && alt.sl === neu.sl) return;
    this.rollen.set(schluessel, neu);
    this.melde({ art: 'rollen', rollen: Object.fromEntries(this.rollen) });
  }

  /**
   * Beim Gastgeber: Person `ziel` wird SL oder gibt die Rolle ab, auf Bitte
   * von `von`. Erlaubt, wenn `von` SL ist, oder wenn es gar keine SL gibt und
   * `von` der Gastgeber ist. Die letzte SL kann die Rolle nicht abgeben.
   * Liefert, ob es geklappt hat.
   */
  private setzeRolle(von: string, ziel: string, sl: boolean): boolean {
    const slZahl = this.personen.filter((p) => p.sl).length;
    const bittender = this.personen.find((p) => p.id === von);
    const darf = bittender?.sl === true || (slZahl === 0 && von === this.ich?.id);
    const person = this.personen.find((p) => p.id === ziel);
    if (!darf || !person || (person.sl === true) === sl) return false;
    if (!sl && slZahl <= 1) return false;
    const neu: Person = sl ? { ...person, sl: true } : { id: person.id, name: person.name };
    this.personen = this.personen.map((p) => (p.id === ziel ? neu : p));
    if (this.ich?.id === ziel) this.ich = neu;
    let schluessel: string | null | undefined;
    if (this.ich?.id === ziel) schluessel = this.schluessel()?.oeffentlich;
    for (const g of this.gaeste) {
      if (g.person?.id === ziel) {
        g.person = neu;
        schluessel = g.schluessel;
      }
    }
    if (schluessel) this.merkeRolle(schluessel, neu);
    this.verteilePersonen();
    return true;
  }

  /**
   * Jemanden zur SL machen oder die Rolle abgeben. Der Gastgeber entscheidet
   * selbst, ein Gast bittet ihn darum. Ob es geklappt hat, zeigt die
   * naechste Personenliste.
   */
  slRolle(ziel: string, sl: boolean): boolean {
    if (!this.ich) return false;
    if (this.rolle === 'gastgeber') return this.setzeRolle(this.ich.id, ziel, sl);
    if (this.rolle === 'gast') return this.schreibeLeitung({ typ: 'rolle', person: ziel, sl });
    return false;
  }

  /** Die gemerkten Rollen des offenen Raums (beim Gastgeber). */
  gemerkteRollen(): Record<string, GemerkteRolle> {
    return Object.fromEntries(this.rollen);
  }

  private verteilePersonen(): void {
    for (const g of this.gaeste) if (g.person) this.schreibe(g, { typ: 'personen', personen: this.personen });
    this.meldeZustand();
  }

  /** Beim Gastgeber: an alle oder an eine Person, und an den Absender zurueck. */
  private verteile(n: Extract<Nachricht, { typ: 'chat' | 'paket' | 'werkzeug' }>): void {
    for (const g of this.gaeste) {
      if (!g.person) continue;
      if (n.an === null || g.person.id === n.an || g.person.id === n.von) this.schreibe(g, n);
    }
    if (n.an === null || n.an === this.ich?.id || n.von === this.ich?.id) this.empfange(n);
  }

  /* ----------------------------------------------------------------- Gast */

  /**
   * Einem Raum beitreten, im lokalen Netz oder ueber das Internet (IPv4,
   * IPv6 oder ein Name). Nach `BEITRITT_FRIST_MS` ohne Antwort gibt er auf:
   * ein Router ohne Portfreigabe verschluckt Anfragen oft stumm.
   */
  trittBei(adresse: string, port: number, passwort: string, name: string): Promise<void> {
    this.verlasse();
    return new Promise((fertig) => {
      const host = adresse.trim().replace(/^\[(.*)\]$/, '$1');
      const socket = connect({ host, port });
      socket.setEncoding('utf8');
      socket.setTimeout(BEITRITT_FRIST_MS);
      socket.on('timeout', () => socket.destroy(Object.assign(new Error('Zeit'), { code: 'ZEIT' })));
      this.leitung = socket;
      const leser = new Zeilenleser();
      let erledigt = false;
      let abgelehnt = false;
      // Der Gastgeber hat mit Absicht geschlossen: dann ist es kein Abriss.
      let geschlossen = false;
      const ende = () => {
        if (!erledigt) {
          erledigt = true;
          fertig();
        }
      };
      const verarbeite = (n: Nachricht) => {
        if (n.typ === 'herausforderung') {
          this.raumName = n.raum;
          void this.antworte(socket, n.nonce, n.salz, passwort, name);
        } else if (n.typ === 'willkommen') {
          socket.setTimeout(0);
          this.rolle = 'gast';
          this.ich = n.du;
          this.personen = [...n.personen];
          this.chat = [];
          this.letzter = null;
          this.meldeZustand();
          this.startePing();
          ende();
        } else if (n.typ === 'abgelehnt') {
          // Die Absage ist der Grund; das Schliessen danach meldet nichts mehr.
          abgelehnt = true;
          this.melde({ art: 'fehler', grund: n.grund });
          ende();
        } else if (n.typ === 'schluss') {
          geschlossen = true;
        } else if (n.typ === 'personen') {
          this.setzePersonen([...n.personen]);
          // Der eigene Name kann sich geaendert haben (umbenannt, eindeutig gemacht).
          const selbst = this.personen.find((p) => p.id === this.ich?.id);
          if (selbst) this.ich = selbst;
          this.meldeZustand();
        } else if (n.typ === 'pong') {
          this.pongAngekommen(n.n);
        } else if (n.typ === 'ping') {
          this.schreibeLeitung({ typ: 'pong', n: n.n });
        } else if (n.typ === 'chat' || n.typ === 'paket' || n.typ === 'werkzeug') {
          this.empfange(n);
        }
      };
      socket.on('data', (stueck: string) => {
        let zeilen: string[];
        try {
          zeilen = leser.schiebe(stueck);
        } catch {
          socket.destroy();
          return;
        }
        for (const zeile of zeilen) {
          let klar: string | null = zeile;
          if (this.leitungsschutz && zeile.startsWith('~')) {
            klar = this.leitungsschutz.entpacke(zeile);
            if (klar === null) {
              socket.destroy();
              return;
            }
          }
          const n = leseNachricht(klar);
          if (!n) continue;
          // Im Klartext darf nach der Anmeldung nur noch eine Absage kommen.
          if (this.leitungsschutz && !zeile.startsWith('~') && n.typ !== 'abgelehnt') continue;
          verarbeite(n);
        }
      });
      const zu = (grund: Verbindungsgrund) => {
        if (this.leitung !== socket) return;
        const warDrin = this.rolle === 'gast';
        this.leitung = null;
        this.leitungsschutz = null;
        this.setzeZurueck();
        if (!abgelehnt) this.melde({ art: 'fehler', grund: warDrin ? (geschlossen ? 'geschlossen' : 'getrennt') : grund });
        this.meldeZustand();
        ende();
      };
      let letzterFehler: unknown = null;
      socket.on('error', (e) => {
        letzterFehler = e;
      });
      socket.on('close', () => zu(letzterFehler ? grundAus(letzterFehler) : 'getrennt'));
    });
  }

  /** Die Antwort auf die Herausforderung; mit Passwort ab dann verschluesselt. */
  private async antworte(socket: Socket, nonce: string, salz: string, passwort: string, name: string): Promise<void> {
    const gastNonce = neueNonce();
    let nachweisText = '';
    let schutz: Leitungsschutz | null = null;
    if (salz && passwort) {
      const stamm = await stammschluessel(passwort, salz);
      nachweisText = nachweis(stamm, nonce, gastNonce);
      schutz = new Leitungsschutz(stamm, nonce, gastNonce, 'gast');
    }
    if (this.leitung !== socket) return;
    const eigener = this.schluessel();
    let ausweis = {};
    if (eigener) {
      try {
        ausweis = {
          schluessel: eigener.oeffentlich,
          unterschrift: unterschreibe(null, zuUnterschreiben(nonce, this.raumName), eigener.privat).toString('base64')
        };
      } catch {
        // Ohne Ausweis geht es auch.
      }
    }
    socket.write(kodiere({ typ: 'hallo', name, nachweis: nachweisText, version: RAUM_VERSION, gastNonce, ...ausweis }));
    this.leitungsschutz = schutz;
  }

  /** Beim Gast: regelmaessig die Laufzeit zum Gastgeber messen. */
  private startePing(): void {
    this.stoppePing();
    const miss = () => {
      const n = ++this.pingZaehler;
      this.pingOffen.set(n, performance.now());
      // Alte, nie beantwortete Messungen nicht ewig mitschleppen.
      for (const alt of this.pingOffen.keys()) if (alt < n - 5) this.pingOffen.delete(alt);
      this.schreibeLeitung({ typ: 'ping', n });
    };
    miss();
    this.pingTakt = setInterval(miss, PING_TAKT_MS);
  }

  /** Beim Gastgeber: dieselbe Messung zu jedem Gast, im selben Takt. */
  private starteGastPing(): void {
    this.stoppePing();
    this.pingTakt = setInterval(() => {
      const jetzt = performance.now();
      for (const [n, offen] of this.gastPingOffen) if (jetzt - offen.start > PING_TAKT_MS * 5) this.gastPingOffen.delete(n);
      for (const g of this.gaeste) {
        if (!g.person) continue;
        const n = ++this.pingZaehler;
        this.gastPingOffen.set(n, { id: g.person.id, start: jetzt });
        this.schreibe(g, { typ: 'ping', n });
      }
    }, PING_TAKT_MS);
  }

  private stoppePing(): void {
    if (this.pingTakt) clearInterval(this.pingTakt);
    this.pingTakt = null;
    this.pingOffen.clear();
    this.gastPingOffen.clear();
    this.gastPings.clear();
    this.ping = null;
  }

  private pongAngekommen(n: number): void {
    const start = this.pingOffen.get(n);
    if (start === undefined) return;
    this.pingOffen.delete(n);
    const neu = Math.max(0, Math.round(performance.now() - start));
    if (neu === this.ping) return;
    this.ping = neu;
    this.meldePing();
  }

  /** Eine Nachricht an den Gastgeber, verschluesselt, wenn die Leitung es ist. */
  private schreibeLeitung(n: Nachricht): boolean {
    if (!this.leitung) return false;
    this.leitung.write(this.leitungsschutz ? this.leitungsschutz.verpacke(kodiere(n).slice(0, -1)) : kodiere(n));
    return true;
  }

  /* ------------------------------------------------------------ Beide Seiten */

  private person(id: string): Person {
    return this.personen.find((p) => p.id === id) ?? { id, name: '?' };
  }

  private empfange(n: Extract<Nachricht, { typ: 'chat' | 'paket' | 'werkzeug' }>): void {
    const von = this.person(n.von);
    if (n.typ === 'werkzeug') {
      // Die eigene kommt beim Gastgeber als Echo zurueck; das Werkzeug
      // kennt seinen Stand schon.
      if (von.id !== this.ich?.id) this.melde({ art: 'werkzeug', von, werkzeug: n.werkzeug, inhalt: n.inhalt });
      return;
    }
    const an = n.an === null ? null : this.person(n.an);
    if (n.typ === 'chat') {
      const zeile: Chatzeile = { von, an, text: n.text, zeit: n.zeit, eigene: von.id === this.ich?.id };
      this.chat = [...this.chat, zeile].slice(-500);
      this.melde({ art: 'chat', zeile });
    } else {
      // Im Chat steht, wer was geschickt hat, auch beim Absender selbst.
      const zeile: Chatzeile = { von, an, text: '', zeit: n.zeit, eigene: von.id === this.ich?.id, dateien: namenIn(n.paket, n.titel), eintraege: eintraegeIn(n.paket) };
      this.chat = [...this.chat, zeile].slice(-500);
      this.melde({ art: 'chat', zeile });
      if (von.id !== this.ich?.id) this.melde({ art: 'paket', von, an, titel: n.titel, paket: n.paket });
    }
  }

  /** Eine Chatnachricht an alle (`an` = null) oder an eine Person. */
  chatte(text: string, an: string | null): boolean {
    const sauber = text.trim().slice(0, MAX_CHAT);
    if (!sauber || !this.ich) return false;
    const n = { typ: 'chat' as const, von: this.ich.id, an, text: sauber, zeit: new Date().toISOString() };
    if (this.rolle === 'gastgeber') this.verteile(n);
    else return this.schreibeLeitung(n);
    return true;
  }

  /** Ein Paket (als Text) an alle oder an eine Person. */
  sende(paket: string, titel: string, an: string | null): boolean {
    if (!this.ich) return false;
    const n = { typ: 'paket' as const, von: this.ich.id, an, titel: titel.slice(0, 500), paket, zeit: new Date().toISOString() };
    if (this.rolle === 'gastgeber') this.verteile(n);
    else return this.schreibeLeitung(n);
    return true;
  }

  /** Eine Nachricht eines Werkzeugs an alle (`an` = null) oder an eine Person. */
  /**
   * Den eigenen Namen im offenen Raum aendern. Der Gastgeber setzt ihn
   * selbst und verteilt die Liste; ein Gast bittet den Gastgeber darum, der
   * ihn eindeutig macht und die Liste an alle schickt.
   */
  umbenennen(name: string): boolean {
    const neuName = name.trim().slice(0, 40);
    if (!neuName || !this.ich) return false;
    if (this.rolle === 'gastgeber') {
      const ich = this.ich;
      this.ich = {
        ...ich,
        name: eindeutigerName(neuName, this.personen.filter((p) => p.id !== ich.id).map((p) => p.name))
      };
      this.personen = this.personen.map((p) => (p.id === ich.id ? this.ich! : p));
      this.verteilePersonen();
      return true;
    }
    if (this.rolle === 'gast') return this.schreibeLeitung({ typ: 'name', name: neuName });
    return false;
  }

  sendeWerkzeug(werkzeug: string, inhalt: string, an: string | null): boolean {
    if (!this.ich) return false;
    const n = { typ: 'werkzeug' as const, von: this.ich.id, an, werkzeug, inhalt, zeit: new Date().toISOString() };
    if (this.rolle === 'gastgeber') this.verteile(n);
    else return this.schreibeLeitung(n);
    return true;
  }

  private setzeZurueck(): void {
    if (this.rolle !== 'aus' && this.chat.length > 0) this.letzter = { raum: this.raumName, chat: this.chat };
    this.stoppePing();
    this.rolle = 'aus';
    this.ich = null;
    this.personen = [];
    this.chat = [];
    this.raumName = '';
  }

  verlasse(): void {
    if (this.rufTakt) clearInterval(this.rufTakt);
    this.rufTakt = null;
    if (this.abschied) {
      try {
        this.abschied();
      } catch {
        this.rufer?.close();
      }
    } else this.rufer?.close();
    this.abschied = null;
    this.rufer = null;
    // Die Gaeste erfahren, dass geschlossen wurde, statt einen Abriss zu sehen.
    for (const g of this.gaeste) {
      if (g.person) {
        try {
          this.schreibe(g, { typ: 'schluss' });
        } catch {
          // Leitung schon weg.
        }
        g.socket.end();
      } else g.socket.destroy();
    }
    this.gaeste.clear();
    this.server?.close();
    this.server = null;
    const leitung = this.leitung;
    this.leitung = null;
    this.leitungsschutz = null;
    leitung?.destroy();
    this.stamm = null;
    this.salz = '';
    this.internet = false;
    const war = this.rolle !== 'aus';
    this.setzeZurueck();
    if (war) this.meldeZustand();
  }

  beende(): void {
    this.verlasse();
    this.beendeSuche();
  }
}
