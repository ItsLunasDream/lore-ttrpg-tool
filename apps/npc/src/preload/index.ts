/** Die Bruecke zwischen Oberflaeche und Hauptprozess. */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Feld, Figur, Wuensche } from '../shared/erzeuge';
import type { Sprache } from '../shared/tabellen';


/** Was bei einer KI-Anfrage herauskommt. Ein Fehler ist kein Absturz. */
export interface KiErgebnis<T> {
  readonly ok: boolean;
  readonly wert: T | null;
  /** Bei Misserfolg der Schluessel der Meldung, sonst leer. */
  readonly grund: string;
}

export interface ExportErgebnis {
  readonly ok: boolean;
  /** Der Titel der angelegten Notiz, oder der Grund fuer das Scheitern. */
  readonly text: string;
  /** Die Figur steht schon in der Kampagne. */
  readonly vorhanden?: boolean;
}

const api = {
  /**
   * Legt die Figur als Notiz im Story Creator an.
   *
   * Auf Knopfdruck und nicht von selbst: eine Figur, die man verwirft, soll
   * nicht schon im Archiv liegen.
   */
  export: (
    titel: string,
    markdown: string,
    kampagneId?: string | null,
    optionen?: { ersetzen?: boolean; felder?: Record<string, string> }
  ) => ipcRenderer.invoke(kanal('export'), titel, markdown, kampagneId ?? null, optionen ?? {}) as Promise<ExportErgebnis>,

  /** Die Kampagnen des Story Creators und die, an der zuletzt gearbeitet wurde. */
  kampagnen: () =>
    ipcRenderer.invoke(kanal('kampagnen')) as Promise<{ liste: { id: string; name: string }[]; aktuell: string | null }>,

  /**
   * Die KI.
   *
   * Eingerichtet wird sie in der Huelle, nicht hier. Ist keine da, sagt `da`
   * das, und die Oberflaeche zeigt die Knoepfe gar nicht erst — ausgegraute
   * Knoepfe fuer etwas, das man hier ohnehin nicht einschalten kann, waeren
   * eine Einladung zum Suchen.
   *
   * Die Anfrage geht vom Hauptprozess aus. Die Oberflaeche bekommt keinen
   * Netzzugriff und den API-Schluessel nie zu sehen.
   */
  ki: {
    da: () => ipcRenderer.invoke(kanal('ki:da')) as Promise<boolean>,
    /**
     * Die KI-Einstellung der Sammlung hat sich geaendert. Liefert eine
     * Funktion zum Abmelden zurueck.
     */
    beiWechsel: (callback: () => void): (() => void) => {
      const hoerer = () => callback();
      ipcRenderer.on(kanal('ki:gewechselt'), hoerer);
      return () => ipcRenderer.off(kanal('ki:gewechselt'), hoerer);
    },
    feld: (feld: Feld, figur: Figur, wuensche: Wuensche, sprache: Sprache) =>
      ipcRenderer.invoke(kanal('ki:feld'), feld, figur, wuensche, sprache) as Promise<
        KiErgebnis<string>
      >,
    figur: (figur: Figur | null, festgehalten: Feld[], wuensche: Wuensche, sprache: Sprache) =>
      ipcRenderer.invoke(kanal('ki:figur'), figur, festgehalten, wuensche, sprache) as Promise<
        KiErgebnis<Partial<Record<Feld, string>>>
      >
  }
};

export type NpcApi = typeof api;

contextBridge.exposeInMainWorld('npc', api);

/** Sprachkopplung mit der Huelle — nur dieser eine Kanal. */
contextBridge.exposeInMainWorld('ttrpgToolsSprache', {
  gewechselt: (language: string) => ipcRenderer.send(kanal('sprache:gewechselt'), language),
  onGesetzt: (callback: (language: string) => void) => {
    const hoerer = (_e: unknown, language: string) => callback(language);
    ipcRenderer.on(kanal('sprache:gesetzt'), hoerer);
    return () => ipcRenderer.off(kanal('sprache:gesetzt'), hoerer);
  }
});

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
