/**
 * Bruecke zwischen Huellen-Oberflaeche und Hauptprozess.
 *
 * Nur benannte Funktionen werden freigegeben, kein durchgereichtes
 * `ipcRenderer`. Sonst koennte jede Zeile im Renderer jeden Kanal aufrufen —
 * auch die der eingebetteten Anwendungen.
 */
import type { Sitzung } from '../shared/protokoll';
import { contextBridge, ipcRenderer } from 'electron';
import type { GefundenerRaum, Raumereignis, Raumzustand } from '../main/raum';
import type { GespeicherterRaum, Raumeinstellungen } from '../main/raeume';

/** Ein angekommenes Paket, ohne seinen Inhalt. */
export interface Raumpaket {
  readonly id: number;
  readonly von: string;
  readonly titel: string;
  readonly zeit: string;
}
/** Was aus dem Raum an die Oberflaeche geht. */
export type RaumereignisOberflaeche =
  | Exclude<Raumereignis, { art: 'paket' | 'rollen' }>
  | { readonly art: 'pakete'; readonly pakete: readonly Raumpaket[] }
  | { readonly art: 'gespeichert'; readonly raeume: readonly GespeicherterRaum[] };
import type { Ankunft } from '../main/austausch';
import type { Modus } from '@suite/austausch';
import type { ShellSettings } from '../main/settings';
import type { Werkzeugeinstellungen, Wert } from '@suite/einstellungen';
import type { Eintrag } from '@suite/eintraege';

const api = {
  /**
   * Zurueck und vorwaerts. Der Befehl kommt aus dem Hauptprozess: die
   * Daumentasten der Maus erreichen die Oberflaeche der Huelle nicht, wenn
   * gerade eine eingebettete Anwendung den Fokus hat.
   */
  verlauf: {
    /** Bringt ein Werkzeug an eine Stelle zurueck, die der Verlauf kennt. */
    springe: (id: string, ort: string | null): Promise<boolean> =>
      ipcRenderer.invoke('verlauf:springe', id, ort),
    /** Ein Werkzeug meldet, wo es gerade steht. */
    beiOrt: (fn: (id: string, ort: string | null) => void): (() => void) => {
      const hoerer = (_e: unknown, id: string, ort: string | null) => fn(id, ort);
      ipcRenderer.on('verlauf:ort', hoerer);
      return () => {
        ipcRenderer.off('verlauf:ort', hoerer);
      };
    },
    beiBefehl: (fn: (richtung: 'zurueck' | 'vorwaerts') => void): (() => void) => {
      const hoerer = (_e: unknown, richtung: 'zurueck' | 'vorwaerts') => fn(richtung);
      ipcRenderer.on('verlauf:befehl', hoerer);
      return () => {
        ipcRenderer.off('verlauf:befehl', hoerer);
      };
    }
  },
  fenster: {
    minimieren: () => ipcRenderer.invoke('fenster:minimieren') as Promise<void>,
    maximierenUmschalten: () => ipcRenderer.invoke('fenster:maximieren-umschalten') as Promise<boolean>,
    schliessen: () => ipcRenderer.invoke('fenster:schliessen') as Promise<void>,
    istMaximiert: () => ipcRenderer.invoke('fenster:ist-maximiert') as Promise<boolean>,
    /**
     * Meldet Maximieren und Wiederherstellen, auch wenn es ueber den
     * Fensterrahmen des Systems ausgeloest wurde (Doppelklick, Tastenkuerzel,
     * Anschnappen am Bildschirmrand). Ohne diese Meldung zeigte der Knopf in
     * der Titelleiste dann das falsche Symbol.
     *
     * Liefert eine Funktion zum Abmelden zurueck.
     */
    beiZustandswechsel: (fn: (zustand: { maximiert: boolean }) => void): (() => void) => {
      const hoerer = (_e: unknown, zustand: { maximiert: boolean }) => fn(zustand);
      ipcRenderer.on('fenster:zustand', hoerer);
      // Bewusst mit Block: `ipcRenderer.off` liefert den IpcRenderer zurueck,
      // und React erwartet von einer Aufraeumfunktion nichts als undefined.
      return () => {
        ipcRenderer.off('fenster:zustand', hoerer);
      };
    }
  },
  app: {
    version: () => ipcRenderer.invoke('app:version') as Promise<string>,
    plattform: () => ipcRenderer.invoke('app:plattform') as Promise<string>,
    /**
     * Holt eine Anwendung nach vorn und montiert sie beim ersten Mal.
     *
     * Antwortet mit `false`, wenn die Huelle sie noch nicht einbetten kann.
     * Die Oberflaeche zeigt dann weiter ihre Platzhalterflaeche.
     */
    /**
     * Holt ein Werkzeug nach vorn. Antwortet mit dem Zustand, nicht mit
     * „ging / ging nicht": ein Werkzeug, das es noch nicht gibt, und eines,
     * dessen Dateien fehlen, brauchen verschiedene Antworten auf dem Schirm.
     */
    /**
     * `fruehestensMs` haelt die Ansicht so lange zurueck.
     *
     * Gebraucht fuer den Uebergang aus dem Startmenue: dort waechst das
     * Symbol ueber den Schirm, und die Ansicht darf sich nicht mitten hinein
     * schieben. Montiert wird trotzdem sofort — die Zeit geht also nicht
     * verloren, sie wird nur nicht vorzeitig sichtbar.
     */
    zeigen: (id: string, fruehestensMs = 0) =>
      ipcRenderer.invoke('app:zeigen', id, fruehestensMs) as Promise<
        import('../main/index').ZeigenErgebnis
      >,
    /** Zurueck ins Startmenue. Die Anwendungen bleiben geladen. */
    startmenue: () => ipcRenderer.invoke('app:startmenue') as Promise<void>,
    /**
     * Meldet, dass ein Dialog der Huelle auf- oder zugeht. Die vorn liegende
     * Anwendung tritt so lange zurueck, sonst deckt sie ihn zu.
     */
    dialog: (offen: boolean) => ipcRenderer.invoke('app:dialog', offen) as Promise<void>,
    /**
     * Meldet, dass der Hauptprozess beim Start schon ein Werkzeug geoeffnet
     * hat (TTRPG_TOOLS_START_APP). Die Oberflaeche zeigt sonst ihr
     * Startmenue, waehrend dahinter bereits eine Anwendung liegt.
     *
     * Liefert eine Funktion zum Abmelden zurueck.
     */
    beiStartMitWerkzeug: (fn: (id: string) => void): (() => void) => {
      const hoerer = (_e: unknown, id: string) => fn(id);
      ipcRenderer.on('app:gestartet-mit', hoerer);
      return () => {
        ipcRenderer.off('app:gestartet-mit', hoerer);
      };
    },
    /**
     * Meldet, dass sich in einer anderen Anwendung etwas getan hat.
     *
     * Liefert die ID der Anwendung, in der es geschah — die Oberflaeche laesst
     * daraufhin eine Farbe ueber deren Symbol wischen. Abmelden ueber die
     * zurueckgegebene Funktion.
     */
    beiEreignis: (fn: (id: string) => void): (() => void) => {
      const hoerer = (_e: unknown, id: string) => fn(id);
      ipcRenderer.on('app:ereignis', hoerer);
      return () => {
        ipcRenderer.off('app:ereignis', hoerer);
      };
    },
    /**
     * Der Hauptprozess bittet darum, ein Werkzeug zu zeigen.
     *
     * Bisher wechselte die Anwendung nur auf Klick oder ueber den Verlauf.
     * Fuer „Karte anlegen" in der Inspirationshilfe muss der Wechsel aber von
     * innen kommen: das Werkzeug reicht einen Ortsnamen an die Huelle, und
     * die holt den Karteneditor nach vorn.
     */
    beiOeffnen: (fn: (id: string) => void): (() => void) => {
      const hoerer = (_e: unknown, id: string) => fn(id);
      ipcRenderer.on('app:oeffne', hoerer);
      return () => {
        ipcRenderer.off('app:oeffne', hoerer);
      };
    },
    /** Oeffnet eine http(s)-Adresse im Browser des Systems. */
    oeffneExtern: (adresse: string) =>
      ipcRenderer.invoke('app:oeffne-extern', adresse) as Promise<void>
  },
  bewegung: {
    /**
     * Meldet dem Hauptprozess, ob das System weniger Bewegung wuenscht.
     *
     * `prefers-reduced-motion` ist nur in einer Darstellung zu beantworten;
     * der Hauptprozess braucht die Auskunft aber fuer die Einfahrt der
     * eingebetteten Ansichten, die er selbst treibt. Deshalb dieser Weg
     * hinaus statt einer Abfrage hinein.
     */
    reduziert: (reduziert: boolean) => ipcRenderer.send('bewegung:reduziert', reduziert)
  },
  symbole: {
    /**
     * Eigene Symbole, als data:-URL je Kennung des Werkzeugs. Fehlt eines,
     * steht es nicht darin, und die Oberflaeche nimmt das eingebaute.
     */
    lesen: () => ipcRenderer.invoke('symbole:lesen') as Promise<Record<string, string>>,
    /** Oeffnet den Ordner im Dateimanager. Liefert seinen Pfad zurueck. */
    ordnerOeffnen: () => ipcRenderer.invoke('symbole:ordner') as Promise<string>
  },
  ki: {
    /**
     * Bereitschaft der KI. `beschreibung` traegt bei Erfolg das Modell, sonst
     * den Grund — bereits in der eingestellten Sprache.
     */
    status: () =>
      ipcRenderer.invoke('ki:status') as Promise<{
        anbieter: string;
        bereit: boolean;
        beschreibung: string;
        hatSchluessel: boolean;
      }>,
    /**
     * Legt den API-Schluessel ab. Ein leerer Text entfernt ihn.
     *
     * Zurueck kommt er nie. Scheitert das Verschluesseln, weil das System
     * keinen Schluesselbund bietet, wirft der Aufruf — im Klartext abzulegen
     * waere schlechter, als es zu lassen.
     */
    setzeSchluessel: (schluessel: string) =>
      ipcRenderer.invoke('ki:schluessel-setzen', schluessel) as Promise<boolean>
  },
  /**
   * Die Suche ueber alle Werkzeuge hinweg (Strg+K).
   *
   * Liefert, was die Werkzeuge abgelegt haben — gesucht wird in der
   * Oberflaeche, damit jeder Tastendruck nicht ueber die Bruecke muss.
   */
  /** F6: Fokus zwischen Hülle und Werkzeug wechseln. */
  fokus: {
    zumWerkzeug: () => ipcRenderer.send('fokus:werkzeug'),
    beiHuelle: (fn: () => void): (() => void) => {
      const hoerer = () => fn();
      ipcRenderer.on('fokus:huelle', hoerer);
      return () => {
        ipcRenderer.off('fokus:huelle', hoerer);
      };
    }
  },
  /** Sitzungsprotokoll (docs/sitzungsprotokoll.md). */
  protokoll: {
    zustand: () => ipcRenderer.invoke('protokoll:zustand') as Promise<Sitzung | null>,
    start: () => ipcRenderer.invoke('protokoll:start') as Promise<Sitzung>,
    hand: (text: string) => ipcRenderer.invoke('protokoll:hand', text) as Promise<Sitzung | null>,
    stopp: () => ipcRenderer.invoke('protokoll:stopp') as Promise<Sitzung | null>,
    bearbeite: (s: Sitzung) => ipcRenderer.invoke('protokoll:bearbeite', s) as Promise<Sitzung | null>,
    vorschau: (zusammenfassung: string) => ipcRenderer.invoke('protokoll:vorschau', zusammenfassung) as Promise<string>,
    anlegen: (zusammenfassung: string) => ipcRenderer.invoke('protokoll:anlegen', zusammenfassung) as Promise<{ ok: boolean; text: string }>,
    verwerfen: () => ipcRenderer.invoke('protokoll:verwerfen') as Promise<boolean>,
    kiDa: () => ipcRenderer.invoke('protokoll:kiDa') as Promise<boolean>,
    ki: () => ipcRenderer.invoke('protokoll:ki') as Promise<{ ok: boolean; text: string }>,
    beiAenderung: (fn: (z: { laeuft: boolean; anzahl: number } | null) => void): (() => void) => {
      const hoerer = (_e: unknown, z: { laeuft: boolean; anzahl: number } | null) => fn(z);
      ipcRenderer.on('protokoll:geaendert', hoerer);
      return () => {
        ipcRenderer.off('protokoll:geaendert', hoerer);
      };
    }
  },
  /** F1 in einem Werkzeug (über den Hauptprozess, wie Strg+K). */
  hilfe: {
    beiTaste: (fn: () => void): (() => void) => {
      const hoerer = () => fn();
      ipcRenderer.on('hilfe:oeffnen', hoerer);
      return () => {
        ipcRenderer.off('hilfe:oeffnen', hoerer);
      };
    }
  },
  suche: {
    eintraege: () => ipcRenderer.invoke('suche:eintraege') as Promise<Eintrag[]>,
    /**
     * Zeigt einen Treffer in seinem Werkzeug.
     *
     * Antwortet `false`, wenn das Werkzeug damit nichts anfangen kann —
     * dann steht man immerhin darin und muss nur noch selbst suchen.
     */
    zeige: (werkzeug: string, kennung: string) =>
      ipcRenderer.invoke('suche:zeigen', werkzeug, kennung) as Promise<boolean>,
    /**
     * Strg+K wurde in einem WERKZEUG gedrueckt.
     *
     * Die Tastendruecke einer eingebetteten Ansicht erreichen die Huelle
     * nicht, wenn dort der Fokus liegt. Denselben Weg gehen schon die
     * Daumentasten der Maus.
     */
    beiTastenkuerzel: (fn: () => void): (() => void) => {
      const hoerer = () => fn();
      ipcRenderer.on('suche:oeffnen', hoerer);
      return () => {
        ipcRenderer.off('suche:oeffnen', hoerer);
      };
    }
  },
  /**
   * Der Austausch (docs/austausch.md, Stufe 1): Eintraege als Paketdatei
   * weitergeben und aus einer einlesen. Der Dateipfad ist optional und nur
   * fuer den Rauchtest; sonst fragt ein Dateidialog.
   */
  austausch: {
    teilbar: () => ipcRenderer.invoke('austausch:teilbar') as Promise<Eintrag[]>,
    /** Zuletzt geoeffnete Orte in den Werkzeugen, neueste zuerst. */
    zuletzt: () => ipcRenderer.invoke('austausch:zuletzt') as Promise<{ werkzeug: string; ort: string }[]>,
    speichern: (auswahl: { werkzeug: string; kennung: string }[], datei?: string) =>
      ipcRenderer.invoke('austausch:speichern', auswahl, datei) as Promise<{
        ok: boolean;
        abgebrochen: boolean;
        anzahl: number;
        datei?: string;
      }>,
    oeffnen: (datei?: string) =>
      ipcRenderer.invoke('austausch:oeffnen', datei) as Promise<{
        ok: boolean;
        abgebrochen: boolean;
        grund?: string;
        ankuenfte?: Ankunft[];
        ziele?: Record<string, { id: string; name: string }[]>;
      }>,
    konflikte: (ziele: Record<string, string>) =>
      ipcRenderer.invoke('austausch:konflikte', ziele) as Promise<boolean[]>,
    vorschau: (werkzeug: string, kennung: string) =>
      ipcRenderer.invoke('austausch:vorschau', werkzeug, kennung) as Promise<string>,
    ankunftText: (nummer: number, voll: boolean) =>
      ipcRenderer.invoke('austausch:ankunftText', nummer, voll) as Promise<string>,
    annehmen: (entscheidungen: { nummer: number; modus?: Modus }[], ziele: Record<string, string>) =>
      ipcRenderer.invoke('austausch:annehmen', entscheidungen, ziele) as Promise<
        { ok: boolean; kennung?: string; grund?: string; werkzeug: string; name: string }[]
      >
  },
  /**
   * Der Raum im lokalen Netz oder ueber das Internet (Portfreigabe, IPv6):
   * Chat an alle oder an eine Person, Pakete ebenso. Mit Passwort
   * verschluesselt.
   */
  raum: {
    zustand: () =>
      ipcRenderer.invoke('raum:zustand') as Promise<{
        zustand: Raumzustand;
        raeume: GefundenerRaum[];
        pakete: Raumpaket[];
      }>,
    suchen: () => ipcRenderer.invoke('raum:suchen') as Promise<GefundenerRaum[]>,
    aktualisieren: () => ipcRenderer.invoke('raum:aktualisieren') as Promise<GefundenerRaum[]>,
    passwortGemerkt: (id: string) => ipcRenderer.invoke('raum:passwortGemerkt', id) as Promise<boolean>,
    passwort: () => ipcRenderer.invoke('raum:passwort') as Promise<string>,
    eroeffnen: (name: string, passwort: string, optionen: { internet?: boolean; port?: number; sl?: boolean; raumId?: string } = {}) =>
      ipcRenderer.invoke('raum:eroeffnen', name, passwort, optionen) as Promise<{
        ok: boolean;
        port?: number;
        raumId?: string;
        grund?: string;
      }>,
    /** Jemanden zur SL machen (`true`) oder die Rolle abgeben (`false`). */
    rolle: (ziel: string, sl: boolean) => ipcRenderer.invoke('raum:rolle', ziel, sl) as Promise<boolean>,
    /** Gespeicherte Raeume dieses Gastgebers, ohne Passwort. */
    gespeicherte: () => ipcRenderer.invoke('raum:gespeicherte') as Promise<GespeicherterRaum[]>,
    gespeichertLoeschen: (id: string) => ipcRenderer.invoke('raum:gespeichertLoeschen', id) as Promise<boolean>,
    gespeichertUmbenennen: (id: string, name: string) =>
      ipcRenderer.invoke('raum:gespeichertUmbenennen', id, name) as Promise<boolean>,
    gespeichertExport: (id: string) =>
      ipcRenderer.invoke('raum:gespeichertExport', id) as Promise<{ ok: boolean; abgebrochen?: boolean }>,
    gespeichertImport: () =>
      ipcRenderer.invoke('raum:gespeichertImport') as Promise<{ ok: boolean; abgebrochen?: boolean; raum?: GespeicherterRaum }>,
    einstellungen: (aenderung: Partial<Raumeinstellungen>) =>
      ipcRenderer.invoke('raum:einstellungen', aenderung) as Promise<Raumeinstellungen | null>,
    kopieren: (text: string) => ipcRenderer.invoke('raum:kopieren', text) as Promise<boolean>,
    oeffentlicheIp: () => ipcRenderer.invoke('raum:oeffentlicheIp') as Promise<string | null>,
    beitreten: (adresse: string, port: number, passwort: string) =>
      ipcRenderer.invoke('raum:beitreten', adresse, port, passwort) as Promise<Raumzustand>,
    verlassen: () => ipcRenderer.invoke('raum:verlassen') as Promise<Raumzustand>,
    chat: (text: string, an: string | null) => ipcRenderer.invoke('raum:chat', text, an) as Promise<boolean>,
    paketMitEintrag: (werkzeug: string, kennung: string) => ipcRenderer.invoke('raum:paketMitEintrag', werkzeug, kennung) as Promise<number | null>,
    paketVerwerfen: (id: number | null) => ipcRenderer.invoke('raum:paketVerwerfen', id) as Promise<boolean>,
    vergessen: () => ipcRenderer.invoke('raum:vergessen') as Promise<Raumzustand>,
    umbenennen: (name: string) => ipcRenderer.invoke('raum:umbenennen', name) as Promise<boolean>,
    senden: (auswahl: { werkzeug: string; kennung: string }[], an: string | null) =>
      ipcRenderer.invoke('raum:senden', auswahl, an) as Promise<{ ok: boolean; anzahl: number }>,
    paketAnsehen: (id: number) =>
      ipcRenderer.invoke('austausch:raumpaket', id) as Promise<{
        ok: boolean;
        abgebrochen: boolean;
        grund?: string;
        ankuenfte?: Ankunft[];
        ziele?: Record<string, { id: string; name: string }[]>;
      }>,
    beiEreignis: (fn: (ereignis: RaumereignisOberflaeche) => void): (() => void) => {
      const hoerer = (_e: unknown, ereignis: RaumereignisOberflaeche) => fn(ereignis);
      ipcRenderer.on('raum:ereignis', hoerer);
      return () => {
        ipcRenderer.off('raum:ereignis', hoerer);
      };
    }
  },
  /** Eine Sicherung der ganzen Sammlung — alle Werkzeuge, nicht nur eines. */
  sicherung: {
    /**
     * Fragt nach einem Ort und schreibt dorthin. `ok: false` mit leerem
     * `text` heisst: abgebrochen. Das ist kein Fehler, sondern eine
     * Entscheidung.
     */
    schreiben: () =>
      ipcRenderer.invoke('sicherung:schreiben') as Promise<{
        ok: boolean;
        text: string;
        dateien: number;
      }>,
    /** Oeffnet den Datenordner im Dateimanager. */
    ordnerOeffnen: () => ipcRenderer.invoke('sicherung:ordner') as Promise<string>
  },
  einstellungen: {
    lesen: () => ipcRenderer.invoke('einstellungen:lesen') as Promise<ShellSettings>,
    /**
     * Schreibt und liefert den bereinigten Stand zurueck, der danach gilt.
     *
     * Teilstuecke sind erlaubt und die Regel: was nicht mitkommt, bleibt
     * stehen. Der API-Schluessel laesst sich hierueber nicht setzen — dafuer
     * gibt es `ki.setzeSchluessel`, und gelesen wird er nie.
     */
    schreiben: (neu: Partial<ShellSettings>) =>
      ipcRenderer.invoke('einstellungen:schreiben', neu) as Promise<ShellSettings>,
    /**
     * Die Sprache wurde von aussen geaendert — nicht ueber den
     * Einstellungen-Dialog dieses Fensters, sondern ueber das Sprachmenue
     * einer eingebetteten Anwendung oder eine andere Sitzung. Ohne diesen
     * Kanal wüsste die Titelleiste nichts von der Änderung.
     *
     * Liefert eine Funktion zum Abmelden zurueck.
     */
    /** Strg+Alt und Plus, Minus, 0 in der Huelle selbst: eine Stufe groesser, kleiner, zurueck. */
    groesseTaste: (stufe: 'groesser' | 'kleiner' | 'zurueck') => ipcRenderer.send('groesse:taste', stufe),
    /** Die Groesse wurde per Tastenkuerzel geaendert; die Anzeige zieht nach. */
    beiGroesseVonAussen: (fn: (groesse: number) => void): (() => void) => {
      const hoerer = (_e: unknown, groesse: number) => fn(groesse);
      ipcRenderer.on('einstellungen:groesse-extern', hoerer);
      return () => {
        ipcRenderer.off('einstellungen:groesse-extern', hoerer);
      };
    },
    beiSprachwechselVonAussen: (fn: (language: ShellSettings['language']) => void): (() => void) => {
      const hoerer = (_e: unknown, language: ShellSettings['language']) => fn(language);
      ipcRenderer.on('einstellungen:sprache-extern', hoerer);
      return () => {
        ipcRenderer.off('einstellungen:sprache-extern', hoerer);
      };
    },
    /**
     * Das Farbthema hat sich geaendert. Gefaerbt wird die Ansicht vom
     * Hauptprozess; hier kommt nur die Kennung an, damit der Waehler im
     * Dialog weiss, was gerade gilt.
     */
    beiThemawechselVonAussen: (fn: (thema: string) => void): (() => void) => {
      const hoerer = (_e: unknown, thema: string) => fn(thema);
      ipcRenderer.on('einstellungen:thema-extern', hoerer);
      return () => {
        ipcRenderer.off('einstellungen:thema-extern', hoerer);
      };
    }
  },
  /**
   * Die Einstellungen der einzelnen Werkzeuge.
   *
   * Sie liegen nicht hier, sondern in den Werkzeugen selbst — die Huelle
   * holt nur deren Beschreibung und malt sie in ihren eigenen Dialog. So
   * gibt es eine Stelle, an der man Einstellungen sucht, und nicht zwei.
   */
  werkzeug: {
    /** Was dieses Werkzeug an Einstellungen hat, oder `null`: keine. */
    einstellungen: (appId: string) =>
      ipcRenderer.invoke('werkzeug:einstellungen', appId) as Promise<Werkzeugeinstellungen | null>,
    /** Setzt ein Feld und liefert den Stand danach. */
    setzen: (appId: string, feldId: string, wert: Wert) =>
      ipcRenderer.invoke('werkzeug:einstellung-setzen', appId, feldId, wert) as Promise<
        Werkzeugeinstellungen | null
      >,
    /** Loest einen Knopf aus (Ordner waehlen, Wort entfernen, ...). */
    befehl: (appId: string, befehlId: string, wert?: string) =>
      ipcRenderer.invoke('werkzeug:einstellung-befehl', appId, befehlId, wert) as Promise<
        Werkzeugeinstellungen | null
      >
  }
};

export type ShellApi = typeof api;

contextBridge.exposeInMainWorld('shell', api);

/*
 * Die Daumentasten der Maus und Alt+Pfeil, an die Huelle gemeldet.
 *
 * Hier und nicht in der Oberflaeche: das Preload sieht dasselbe Dokument,
 * braucht dafuer aber keine Zeile im Anwendungscode — die Taste hat mit dem
 * Werkzeug nichts zu tun, sie gehoert der Huelle.
 *
 * Gehoert wird auf DREI Mausereignisse, nicht auf eines. `button` 3 ist
 * zurueck, 4 ist vorwaerts; welches der drei Ereignisse eine Seitentaste
 * ausloest, haengt am System, und auf dem Windows-Geraet kam mit `mouseup`
 * allein in einem eingebetteten Werkzeug nichts an. Mehrfach zu melden
 * schadet nicht: der Hauptprozess hat eine Sperrfrist und macht daraus
 * einen Schritt.
 *
 * Alt und Pfeil geht denselben Weg. In der Huelle allein zu lauschen reicht
 * nicht — liegt ein Werkzeug vorn, ist das hier ein anderes Dokument, und
 * die Tastatur kommt dort an und nicht drueben.
 *
 * Die Art des Ereignisses geht mit. Sie kostet nichts und beantwortet im
 * Zweifel die Frage, die man sonst nur raten kann: WAS ist angekommen.
 *
 * Von Hand getippt statt ueber `window`: dieselbe Datei wird zweimal
 * geprueft, einmal mit DOM-Typen und einmal ohne.
 */
const verlaufsDokument = globalThis as unknown as {
  addEventListener(
    art: string,
    hoerer: (ereignis: { readonly button?: number; readonly key?: string; readonly altKey?: boolean }) => void,
    erfassen: boolean
  ): void;
};

function meldeVerlaufsTaste(richtung: 'zurueck' | 'vorwaerts', art: string): void {
  ipcRenderer.send('huelle:verlauf-taste', richtung, art);
}

for (const art of ['mouseup', 'auxclick', 'pointerup']) {
  verlaufsDokument.addEventListener(
    art,
    (ereignis) => {
      if (ereignis.button === 3) meldeVerlaufsTaste('zurueck', art);
      else if (ereignis.button === 4) meldeVerlaufsTaste('vorwaerts', art);
    },
    true
  );
}

verlaufsDokument.addEventListener(
  'keydown',
  (ereignis) => {
    if (!ereignis.altKey) return;
    if (ereignis.key === 'ArrowLeft') meldeVerlaufsTaste('zurueck', 'alt-pfeil');
    else if (ereignis.key === 'ArrowRight') meldeVerlaufsTaste('vorwaerts', 'alt-pfeil');
  },
  true
);
