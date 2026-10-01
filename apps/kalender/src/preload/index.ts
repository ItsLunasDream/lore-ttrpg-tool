/**
 * Die Bruecke des Campaign Calendar: Ablage, Raum, Dateien (.ics und
 * Umfrage), Sprache und Spruenge aus der Suche.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Umfrage } from '../shared/modell';
import type { RaumLage } from '../main/embed';

const api = {
  /**
   * Der Ort im Werkzeug fuer den Verlauf der Huelle (eine offene Tabelle,
   * ein Gegenstand, ein Eintrag; `null` fuer die Liste). Gemeinsamer Kanal
   * aller Werkzeuge, siehe `huelle:ort` in der Huelle.
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
  sammlung: {
    liste: () => ipcRenderer.invoke(kanal('liste')) as Promise<Umfrage[]>,
    lesen: (id: string) => ipcRenderer.invoke(kanal('lesen'), id) as Promise<Umfrage | null>,
    speichern: (u: Umfrage) => ipcRenderer.invoke(kanal('speichern'), u) as Promise<{ ok: boolean; text: string }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('loeschen'), id) as Promise<boolean>
  },
  datei: {
    ics: (id: string) => ipcRenderer.invoke(kanal('ics'), id) as Promise<{ ok: boolean; text: string }>,
    exportiere: (id: string) => ipcRenderer.invoke(kanal('datei:export'), id) as Promise<{ ok: boolean; text: string }>,
    importiere: () => ipcRenderer.invoke(kanal('datei:import')) as Promise<{ ok: boolean; id: string; text: string }>
  },
  raum: {
    sende: (inhalt: string) => ipcRenderer.invoke(kanal('raum:senden'), inhalt) as Promise<boolean>,
    lage: () => ipcRenderer.invoke(kanal('raum:lage')) as Promise<RaumLage>,
    beiNeu: (hoerer: () => void) => {
      const lauscher = () => hoerer();
      ipcRenderer.on(kanal('raum:neu'), lauscher);
      return () => {
        ipcRenderer.off(kanal('raum:neu'), lauscher);
      };
    },
    beiZustand: (hoerer: (lage: RaumLage) => void) => {
      const lauscher = (_e: unknown, lage: RaumLage) => hoerer(lage);
      ipcRenderer.on(kanal('raum:zustand'), lauscher);
      return () => {
        ipcRenderer.off(kanal('raum:zustand'), lauscher);
      };
    }
  },
  beiSuchtreffer: (hoerer: (kennung: string) => void) => {
    const lauscher = (_e: unknown, kennung: string) => hoerer(kennung);
    ipcRenderer.on(kanal('suche:zeigen'), lauscher);
    return () => {
      ipcRenderer.off(kanal('suche:zeigen'), lauscher);
    };
  },
  sprache: {
    melde: (sprache: string) => ipcRenderer.send(kanal('sprache:gewechselt'), sprache),
    beiWechsel: (hoerer: (sprache: string) => void) => {
      const lauscher = (_e: unknown, sprache: string) => hoerer(sprache);
      ipcRenderer.on(kanal('sprache:gesetzt'), lauscher);
      return () => {
        ipcRenderer.off(kanal('sprache:gesetzt'), lauscher);
      };
    }
  }
};

export type KalenderApi = typeof api;

contextBridge.exposeInMainWorld('kalender', api);
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

