/**
 * Die Bruecke zwischen Oberflaeche und Hauptprozess.
 *
 * Nur diese Funktionen sind aus dem Renderer erreichbar — kein `fs`, kein
 * `path`, kein `require`.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Begegnung, Kampf } from '../shared/types';
import type { Uebergabe } from '@suite/uebergabe';
import type { RaumLage } from '../shared/teilen';

const api = {
  /** Ereignisse für das Sitzungsprotokoll der Hülle (docs/sitzungsprotokoll.md). */
  protokoll: (meldung: { art: string; text: string; wichtig?: boolean }) => ipcRenderer.send('huelle:protokoll', meldung),
  /**
   * Wo das Werkzeug steht, fuer den Verlauf der Huelle und „Zuletzt
   * geoeffnet" im Teilen: die geladene Begegnung.
   */
  ort: {
    melde: (ort: string | null) => ipcRenderer.send('huelle:ort', ort),
    beiSprung: (hoerer: (ort: string | null) => void) => {
      const lauscher = (_e: unknown, ort: string | null) => hoerer(ort);
      ipcRenderer.on('huelle:ort-springe', lauscher);
      return () => {
        ipcRenderer.off('huelle:ort-springe', lauscher);
      };
    }
  },
  /**
   * Die Suche der Huelle hat einen Eintrag gewaehlt, der hier liegt.
   * Liefert eine Funktion zum Abmelden zurueck.
   */
  beiSuchtreffer: (hoerer: (kennung: string) => void) => {
    const lauscher = (_e: unknown, kennung: string) => hoerer(kennung);
    ipcRenderer.on(kanal('suche:zeigen'), lauscher);
    return () => {
      ipcRenderer.off(kanal('suche:zeigen'), lauscher);
    };
  },
  /**
   * Ein anderes Werkzeug schiebt eine Begegnung herein.
   *
   * Angenommen wird sie nicht hier, sondern in der Oberflaeche — und erst,
   * nachdem sie gefragt hat, ob etwas verlorenginge.
   */
  beiUebergabe: (hoerer: (uebergabe: Uebergabe) => void) => {
    const lauscher = (_e: unknown, uebergabe: Uebergabe) => hoerer(uebergabe);
    ipcRenderer.on(kanal('uebergabe'), lauscher);
    return () => {
      ipcRenderer.off(kanal('uebergabe'), lauscher);
    };
  },
  /** Figuren aus dem Charakterbogen (neu oder aufgefrischt). */
  beiFiguren: (hoerer: (figuren: unknown, hinzufuegen: boolean) => void) => {
    const lauscher = (_e: unknown, figuren: unknown, hinzufuegen: boolean) => hoerer(figuren, hinzufuegen === true);
    ipcRenderer.on(kanal('figuren'), lauscher);
    return () => {
      ipcRenderer.off(kanal('figuren'), lauscher);
    };
  },
  /** Neue TP einer Figur zurueck an ihren Bogen. */
  bogenTp: (kennung: string, hp: number, temp: number) => ipcRenderer.send(kanal('bogen:tp'), kennung, hp, temp),
  begegnungen: {
    liste: () => ipcRenderer.invoke(kanal('begegnungen:liste')) as Promise<Begegnung[]>,
    lesen: (id: string) => ipcRenderer.invoke(kanal('begegnungen:lesen'), id) as Promise<Begegnung>,
    speichern: (begegnung: Begegnung) =>
      ipcRenderer.invoke(kanal('begegnungen:speichern'), begegnung) as Promise<Begegnung>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('begegnungen:loeschen'), id) as Promise<void>
  },
  kampf: {
    lesen: () => ipcRenderer.invoke(kanal('kampf:lesen')) as Promise<Kampf | null>,
    schreiben: (kampf: Kampf) => ipcRenderer.invoke(kanal('kampf:schreiben'), kampf) as Promise<void>
  },
  bild: {
    waehlen: () => ipcRenderer.invoke(kanal('bild:waehlen')) as Promise<string | null>
  },
  /** Die eigenen Zustaende aus dem Status Effect Creator (ueber die Huelle). */
  eigeneZustaende: () =>
    ipcRenderer.invoke(kanal('zustaende:eigene')) as Promise<readonly { name: string; text: string }[]>,
  /** Der Raum im lokalen Netz: die geteilte Initiative. */
  raum: {
    sende: (inhalt: string, an: string | null) => ipcRenderer.invoke(kanal('raum:senden'), inhalt, an) as Promise<boolean>,
    anfang: () =>
      ipcRenderer.invoke(kanal('raum:anfang')) as Promise<{
        lage: RaumLage;
        nachrichten: { von: { id: string; name: string }; inhalt: string }[];
      }>,
    beiNachricht: (hoerer: (von: { id: string; name: string }, inhalt: string) => void) => {
      const lauscher = (_e: unknown, von: { id: string; name: string }, inhalt: string) => hoerer(von, inhalt);
      ipcRenderer.on(kanal('raum:nachricht'), lauscher);
      return () => {
        ipcRenderer.off(kanal('raum:nachricht'), lauscher);
      };
    },
    beiZustand: (hoerer: (lage: RaumLage) => void) => {
      const lauscher = (_e: unknown, lage: RaumLage) => hoerer(lage);
      ipcRenderer.on(kanal('raum:zustand'), lauscher);
      return () => {
        ipcRenderer.off(kanal('raum:zustand'), lauscher);
      };
    }
  }
};

export type InitiativeApi = typeof api;

contextBridge.exposeInMainWorld('initiative', api);

/**
 * Sprachkopplung mit der Huelle — dieselbe Bruecke wie beim Karteneditor.
 * Nur dieser eine Kanal, kein Zugriff auf sonst etwas.
 */
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

