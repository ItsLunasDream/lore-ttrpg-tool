/**
 * Die Bruecke des Loot Generators: Ablage, Weitergeben, Sprache und die
 * Spruenge aus der Suche der Huelle. Gewuerfelt wird in der Oberflaeche.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Gespeichert, Kachel } from '../shared/ablage';

type Antwort = { ok: boolean; text: string };

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
    liste: () => ipcRenderer.invoke(kanal('liste')) as Promise<Kachel[]>,
    alle: () => ipcRenderer.invoke(kanal('alle')) as Promise<Gespeichert[]>,
    lesen: (id: string) => ipcRenderer.invoke(kanal('lesen'), id) as Promise<Gespeichert | null>,
    speichern: (t: Gespeichert, neu: boolean) =>
      ipcRenderer.invoke(kanal('speichern'), t, neu) as Promise<Antwort & { id: string }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('loeschen'), id) as Promise<boolean>,
    weitergeben: (id: string) => ipcRenderer.invoke(kanal('weitergeben'), id) as Promise<Antwort>,
    einlesen: () => ipcRenderer.invoke(kanal('einlesen')) as Promise<Antwort & { namen: string[] }>
  },
  gegenstaende: () => ipcRenderer.invoke(kanal('gegenstaende')) as Promise<{ name: string; seltenheit: string; herkunft?: string }[]>,
  story: (titel: string, markdown: string) => ipcRenderer.invoke(kanal('story'), titel, markdown) as Promise<Antwort>,
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

export type LootApi = typeof api;

contextBridge.exposeInMainWorld('loot', api);
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

