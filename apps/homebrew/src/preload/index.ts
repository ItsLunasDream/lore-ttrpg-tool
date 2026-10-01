/**
 * Die Bruecke des Homebrew Creators: Ablage, Loot, Foundry, Sprache und die
 * Spruenge aus der Suche der Huelle. Die Eichung rechnet die Oberflaeche.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Kachel } from '../shared/ablage';
import type { Eintrag } from '../shared/modell';

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
    /** Namen der eigenen Zustände (Status Effect Creator). */
    zustaende: () => ipcRenderer.invoke(kanal('zustaende')) as Promise<string[]>,
    lesen: (id: string) => ipcRenderer.invoke(kanal('lesen'), id) as Promise<Eintrag | null>,
    speichern: (g: Eintrag, neu: boolean) =>
      ipcRenderer.invoke(kanal('speichern'), g, neu) as Promise<{ ok: boolean; id: string; text: string }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('loeschen'), id) as Promise<boolean>,
    inDenLoot: (id: string) => ipcRenderer.invoke(kanal('inDenLoot'), id) as Promise<boolean>,
    ausDemLoot: (id: string) => ipcRenderer.invoke(kanal('ausDemLoot'), id) as Promise<boolean>
  },
  foundry: (vorschlag: string, inhalt: string) =>
    ipcRenderer.invoke(kanal('foundry'), vorschlag, inhalt) as Promise<{ ok: boolean; text: string }>,
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

export type HomebrewApi = typeof api;

contextBridge.exposeInMainWorld('homebrew', api);
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

