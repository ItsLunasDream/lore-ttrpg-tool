/**
 * Der Raum (docs/austausch.md, Stufe 2): das Protokoll.
 *
 * Wer einen Raum eroeffnet, ist Gastgeber. Er kuendigt den Raum im lokalen
 * Netz an (UDP, `RAUM_SUCHPORT`), die anderen sehen ihn in einer Liste und
 * verbinden sich mit ihm (TCP). Der Gastgeber verteilt: Chat an alle oder
 * an eine Person, Pakete ebenso. Ueber das Internet erreicht man ihn per
 * Portfreigabe oder IPv6 — ohne fremden Dienst dazwischen.
 *
 * Auf der Leitung steht je Zeile eine Nachricht als JSON. Das Passwort
 * reist nie: der Gastgeber schickt eine Zufallszahl und ein Salz, der Gast
 * antwortet mit einem Nachweis und einer eigenen Zufallszahl. Hat der Raum
 * ein Passwort, ist ab dann jede Zeile VERSCHLUESSELT (AES-256-GCM, der
 * Schluessel kommt aus dem Passwort; gerechnet im Hauptprozess). Ohne
 * Passwort bleibt der Verkehr offen — das geht nur im lokalen Netz, und die
 * Oberflaeche sagt es.
 *
 * Plattformfrei: nur Daten und reine Funktionen. Netz und Kryptografie
 * stehen im Hauptprozess der Huelle.
 */

export const RAUM_SUCHPORT = 47811;
/** 2: Verschluesselung und IPv6/Internet. Aeltere Fassungen werden abgewiesen. */
export const RAUM_VERSION = 2;
/** Der Port, den ein Raum ueber das Internet nimmt, wenn nichts anderes eingestellt ist. */
export const RAUM_INTERNETPORT = 47812;
/** Mehr Personen braucht ein Tisch nicht; mehr Verbindungen nimmt der Gastgeber nicht an. */
export const MAX_PERSONEN = 16;
/** Eine Zeile darf so lang sein wie ein Paket plus Umschlag. */
export const MAX_ZEILE = 80 * 1024 * 1024;
export const MAX_CHAT = 4000;
/** Eine Werkzeugnachricht (etwa der Stand der geteilten Initiative). */
export const MAX_WERKZEUG = 2 * 1024 * 1024;

export interface Person {
  readonly id: string;
  readonly name: string;
  /**
   * Spielleitung. Es kann mehrere geben. Gesetzt nur vom Gastgeber, der die
   * Rollen verwaltet; ein Gast kann darum bitten (`rolle`). Fehlt bei
   * aelteren Fassungen, dann gilt: keine SL.
   */
  readonly sl?: boolean;
}

/** Was ein Gastgeber alle paar Sekunden ins Netz ruft. */
export interface Ankuendigung {
  readonly typ: 'ttrpg-raum';
  readonly version: number;
  readonly raum: string;
  readonly gastgeber: string;
  readonly port: number;
  readonly geschuetzt: boolean;
  /** Der Raum schliesst: aus der Liste nehmen, statt ihn auslaufen zu lassen. */
  readonly zu?: boolean;
}

export type Nachricht =
  /** `salz` ist leer, wenn der Raum kein Passwort hat (dann unverschluesselt). */
  | { readonly typ: 'herausforderung'; readonly raum: string; readonly nonce: string; readonly salz: string }
  | {
      readonly typ: 'hallo';
      readonly name: string;
      readonly nachweis: string;
      readonly version: number;
      /** Die Zufallszahl des Gastes; geht mit in den Sitzungsschluessel. */
      readonly gastNonce: string;
      /**
       * Der oeffentliche Tischschluessel (Ed25519, SPKI, Base64) und die
       * Unterschrift ueber `<nonce>:<raum>`. Daran erkennt der Gastgeber
       * jemanden wieder, auch unter anderem Namen, und gibt gemerkte Rollen
       * zurueck. Fehlt beides, ist man ein Gast ohne Gedaechtnis.
       */
      readonly schluessel?: string;
      readonly unterschrift?: string;
    }
  | { readonly typ: 'willkommen'; readonly du: Person; readonly personen: readonly Person[] }
  | { readonly typ: 'abgelehnt'; readonly grund: 'passwort' | 'voll' | 'version' }
  | { readonly typ: 'personen'; readonly personen: readonly Person[] }
  /** Ein Gast nennt sich um; der Gastgeber macht den Namen eindeutig und verteilt die Liste. */
  | { readonly typ: 'name'; readonly name: string }
  /**
   * Laufzeitmessung: der Gast schickt `ping` mit einer Zahl, der Gastgeber
   * antwortet sofort mit `pong` und derselben Zahl. Die Zeit dazwischen ist
   * der Ping in Millisekunden.
   */
  | { readonly typ: 'ping'; readonly n: number }
  | { readonly typ: 'pong'; readonly n: number }
  /** Der Gastgeber schliesst den Raum mit Absicht; die Gaeste lesen dann nicht „Verbindung abgerissen". */
  | { readonly typ: 'schluss' }
  /**
   * Bitte an den Gastgeber: diese Person wird SL oder gibt die Rolle ab.
   * Er prueft, ob der Absender das darf, und verteilt die neue Liste.
   */
  | { readonly typ: 'rolle'; readonly person: string; readonly sl: boolean }
  | {
      readonly typ: 'chat';
      readonly von: string;
      /** `null`: an alle. Sonst die Kennung der einen Person. */
      readonly an: string | null;
      readonly text: string;
      readonly zeit: string;
    }
  | {
      readonly typ: 'paket';
      readonly von: string;
      readonly an: string | null;
      /** Was die Empfaenger in der Liste sehen: „3 Eintraege: Ghul, …". */
      readonly titel: string;
      /** Das Paket als Text (`alsPaket`). */
      readonly paket: string;
      readonly zeit: string;
    }
  | {
      /**
       * Eine Nachricht zwischen gleichen Werkzeugen, etwa der Stand der
       * geteilten Initiative. Die Huelle liest den Inhalt nicht, sie reicht
       * ihn an das Werkzeug; das Werkzeug prueft ihn selbst.
       */
      readonly typ: 'werkzeug';
      readonly von: string;
      readonly an: string | null;
      readonly werkzeug: string;
      readonly inhalt: string;
      readonly zeit: string;
    };

export function kodiere(nachricht: Nachricht | Ankuendigung): string {
  return `${JSON.stringify(nachricht)}\n`;
}

function istText(wert: unknown, max = 200): wert is string {
  return typeof wert === 'string' && wert.length <= max;
}

function istPerson(wert: unknown): wert is Person {
  const p = wert as Person;
  return (
    typeof wert === 'object' &&
    wert !== null &&
    istText(p.id, 64) &&
    istText(p.name, 64) &&
    (p.sl === undefined || typeof p.sl === 'boolean')
  );
}

/**
 * Prueft eine Nachricht von der Leitung. Alles, was nicht genau passt, ist
 * `null` — ein fremdes Programm auf demselben Port soll den Raum nicht
 * durcheinanderbringen.
 */
export function leseNachricht(zeile: string): Nachricht | null {
  let n: Record<string, unknown>;
  try {
    const wert = JSON.parse(zeile) as unknown;
    if (typeof wert !== 'object' || wert === null || Array.isArray(wert)) return null;
    n = wert as Record<string, unknown>;
  } catch {
    return null;
  }
  const an = n.an === null || istText(n.an, 64) ? (n.an as string | null) : undefined;
  switch (n.typ) {
    case 'herausforderung':
      return istText(n.raum, 64) && istText(n.nonce, 128) && istText(n.salz, 128)
        ? { typ: n.typ, raum: n.raum, nonce: n.nonce, salz: n.salz }
        : null;
    case 'hallo':
      // Die Fassung zuerst: eine alte App schickt kein gastNonce, soll aber
      // „falsche Fassung" hoeren und nicht stumm abgewiesen werden.
      if (typeof n.version !== 'number') return null;
      return istText(n.name, 64) && istText(n.nachweis, 256)
        ? {
            typ: n.typ,
            name: n.name,
            nachweis: n.nachweis,
            version: n.version,
            gastNonce: istText(n.gastNonce, 128) ? n.gastNonce : '',
            ...(istText(n.schluessel, 200) && istText(n.unterschrift, 200) ? { schluessel: n.schluessel, unterschrift: n.unterschrift } : {})
          }
        : null;
    case 'willkommen':
      return istPerson(n.du) && Array.isArray(n.personen) && n.personen.every(istPerson)
        ? { typ: n.typ, du: n.du, personen: n.personen }
        : null;
    case 'abgelehnt':
      return n.grund === 'passwort' || n.grund === 'voll' || n.grund === 'version' ? { typ: n.typ, grund: n.grund } : null;
    case 'personen':
      return Array.isArray(n.personen) && n.personen.every(istPerson) ? { typ: n.typ, personen: n.personen } : null;
    case 'name':
      return istText(n.name, 64) && n.name.trim() ? { typ: n.typ, name: n.name } : null;
    case 'schluss':
      return { typ: n.typ };
    case 'rolle':
      return istText(n.person, 64) && typeof n.sl === 'boolean' ? { typ: n.typ, person: n.person, sl: n.sl } : null;
    case 'ping':
    case 'pong':
      return Number.isSafeInteger(n.n) && (n.n as number) >= 0 ? { typ: n.typ, n: n.n as number } : null;
    case 'chat':
      return istText(n.von, 64) && an !== undefined && istText(n.text, MAX_CHAT) && istText(n.zeit, 40)
        ? { typ: n.typ, von: n.von, an, text: n.text, zeit: n.zeit }
        : null;
    case 'paket':
      return istText(n.von, 64) && an !== undefined && istText(n.titel, 500) && istText(n.paket, MAX_ZEILE) && istText(n.zeit, 40)
        ? { typ: n.typ, von: n.von, an, titel: n.titel, paket: n.paket, zeit: n.zeit }
        : null;
    case 'werkzeug':
      return istText(n.von, 64) && an !== undefined && istText(n.werkzeug, 40) && istText(n.inhalt, MAX_WERKZEUG) && istText(n.zeit, 40)
        ? { typ: n.typ, von: n.von, an, werkzeug: n.werkzeug, inhalt: n.inhalt, zeit: n.zeit }
        : null;
    default:
      return null;
  }
}

export function leseAnkuendigung(text: string): Ankuendigung | null {
  try {
    const a = JSON.parse(text) as Record<string, unknown>;
    if (
      a.typ === 'ttrpg-raum' &&
      typeof a.version === 'number' &&
      istText(a.raum, 64) &&
      istText(a.gastgeber, 64) &&
      typeof a.port === 'number' &&
      Number.isInteger(a.port) &&
      a.port > 0 &&
      a.port < 65536 &&
      typeof a.geschuetzt === 'boolean' &&
      (a.zu === undefined || typeof a.zu === 'boolean')
    ) {
      return a as unknown as Ankuendigung;
    }
  } catch {
    // unten
  }
  return null;
}

/**
 * Zerlegt einen Strom in Zeilen. TCP liefert Stuecke, keine Nachrichten:
 * eine Nachricht kann auf zwei Stuecke verteilt ankommen, zwei in einem.
 * Eine Zeile ueber `max` bricht ab — sonst liesse sich der Speicher des
 * Gastgebers mit einer endlosen Zeile fuellen.
 */
export class Zeilenleser {
  private rest = '';
  constructor(private readonly max = MAX_ZEILE) {}

  /** Die fertigen Zeilen. Wirft, wenn eine Zeile zu lang wird. */
  schiebe(stueck: string): string[] {
    this.rest += stueck;
    const teile = this.rest.split('\n');
    this.rest = teile.pop() ?? '';
    if (this.rest.length > this.max) throw new Error('Zeile zu lang');
    return teile.filter((t) => t.trim().length > 0);
  }
}

/** Der Name, den jemand ohne eigenen bekommt: „Gast 1", „Guest 1". */
export function gastname(nummer: number, sprache: 'de' | 'en' = 'de'): string {
  return `${sprache === 'de' ? 'Gast' : 'Guest'} ${nummer}`;
}

/** Ein Name, den im Raum noch niemand traegt: „Anna", „Anna (2)". */
export function eindeutigerName(wunsch: string, vergeben: Iterable<string>): string {
  const sauber = wunsch.replace(/\s+/g, ' ').trim().slice(0, 40) || 'Gast';
  const belegt = new Set([...vergeben].map((n) => n.toLocaleLowerCase('de-DE')));
  if (!belegt.has(sauber.toLocaleLowerCase('de-DE'))) return sauber;
  let n = 2;
  while (belegt.has(`${sauber} (${n})`.toLocaleLowerCase('de-DE'))) n += 1;
  return `${sauber} (${n})`;
}

/**
 * Eine Adresse, wie Menschen sie weitergeben: „192.168.1.20:47812",
 * „[2001:db8::5]:47812", „mein-name.dyndns.org:47812". Eine IPv6-Adresse
 * ohne Klammern (mehrere Doppelpunkte) wird ohne Port gelesen; dann gilt
 * `standardPort`. Ohne Port gilt er ebenso. `null`, wenn nichts Brauchbares
 * dasteht.
 */
export function leseAdresse(text: string, standardPort = RAUM_INTERNETPORT): { host: string; port: number } | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  const portOk = (p: number) => Number.isInteger(p) && p > 0 && p < 65536;
  const klammer = /^\[([0-9a-fA-F:.]+(?:%[\w.-]+)?)\](?::(\d{1,5}))?$/.exec(t);
  if (klammer) {
    const port = klammer[2] ? Number(klammer[2]) : standardPort;
    return klammer[1].includes(':') && portOk(port) ? { host: klammer[1], port } : null;
  }
  const doppelpunkte = (t.match(/:/g) ?? []).length;
  if (doppelpunkte >= 2) {
    // Nackte IPv6-Adresse: der Port laesst sich nicht abtrennen.
    return /^[0-9a-fA-F:.]+(%[\w.-]+)?$/.test(t) && portOk(standardPort) ? { host: t, port: standardPort } : null;
  }
  const [host, portText] = t.split(':');
  if (!/^[A-Za-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('-')) return null;
  const port = portText === undefined ? standardPort : /^\d{1,5}$/.test(portText) ? Number(portText) : NaN;
  return portOk(port) ? { host, port } : null;
}

/** Die Adresse zum Weitergeben: IPv6 in eckigen Klammern, damit der Port nicht verschwimmt. */
export function alsAdresse(host: string, port: number): string {
  return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}
