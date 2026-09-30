/** Die Bruecke zwischen Oberflaeche und Hauptprozess. */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Frage, RohEntwurf } from '../shared/kiAufgaben';
import type { KampagnenFigur } from '../main/embed';
import type { Notiz } from '../shared/notizen';
import type { Sprache } from '../shared/tabellen';

export interface KiErgebnis {
  readonly ok: boolean;
  readonly wert: Record<string, string> | readonly string[] | RohEntwurf | null;
  /** Bei Misserfolg der Schluessel der Meldung, sonst leer. */
  readonly grund: string;
}

export interface ExportErgebnis {
  readonly ok: boolean;
  /** Bei Erfolg eine kurze Bilanz, sonst der Grund fuer das Scheitern. */
  readonly text: string;
  /** Wie viele Notizen angelegt wurden. */
  readonly angelegt: number;
  /** Wie viele schon da waren und uebersprungen wurden. */
  readonly vorhanden?: number;
}

const api = {
  /**
   * Legt den Entwurf als Notizen in der offenen Kampagne an.
   *
   * Auf Knopfdruck und nicht von selbst: „Entwurf hier, Wahrheit dort" —
   * was nicht uebernommen wurde, hat im Archiv nichts verloren.
   */
  export: (notizen: readonly Notiz[], kampagneId?: string | null, ersetzen = false) =>
    ipcRenderer.invoke(kanal('export'), notizen, kampagneId ?? null, ersetzen) as Promise<ExportErgebnis>,

  /** Die Kampagnen des Story Creators und die, an der zuletzt gearbeitet wurde. */
  kampagnen: () =>
    ipcRenderer.invoke(kanal('kampagnen')) as Promise<{ liste: { id: string; name: string }[]; aktuell: string | null }>,

  /**
   * Die Figuren, die es in der offenen Kampagne schon gibt.
   *
   * Darueber kommen auch die des NPC Creators herein: was dort gewuerfelt und
   * uebernommen wurde, liegt anschliessend als Notiz in derselben Kampagne.
   */
  figuren: (kampagneId?: string | null) =>
    ipcRenderer.invoke(kanal('figuren'), kampagneId ?? null) as Promise<readonly KampagnenFigur[]>,

  /**
   * Der Karteneditor.
   *
   * `da` sagt, ob es den Weg ueberhaupt gibt; `anlegen` holt den Editor nach
   * vorn und beginnt dort eine leere Karte unter diesem Namen.
   */
  karte: {
    da: () => ipcRenderer.invoke(kanal('karte:da')) as Promise<boolean>,
    anlegen: (name: string, notizen: readonly { title: string; text: string }[] = []) =>
      ipcRenderer.invoke(kanal('karte'), name, notizen) as Promise<boolean>
  },

  /**
   * Die KI.
   *
   * Eingerichtet wird sie in der Huelle, nicht hier. Ist keine da, sagt `da`
   * das, und die Oberflaeche zeigt die Knoepfe gar nicht erst.
   *
   * Die Anfrage geht vom Hauptprozess aus. Die Oberflaeche bekommt keinen
   * Netzzugriff und den API-Schluessel nie zu sehen.
   */
  ki: {
    da: () => ipcRenderer.invoke(kanal('ki:da')) as Promise<boolean>,
    beiWechsel: (callback: () => void): (() => void) => {
      const hoerer = () => callback();
      ipcRenderer.on(kanal('ki:gewechselt'), hoerer);
      return () => ipcRenderer.off(kanal('ki:gewechselt'), hoerer);
    },
    frage: (frage: Frage, sprache: Sprache) =>
      ipcRenderer.invoke(kanal('ki:frage'), frage, sprache) as Promise<KiErgebnis>
  }
};

export type InspirationApi = typeof api;

contextBridge.exposeInMainWorld('inspiration', api);

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
