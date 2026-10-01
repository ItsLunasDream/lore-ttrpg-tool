/**
 * Die Bruecke des Encounter Creators.
 *
 * Der Renderer hat keinen Node-Zugriff; alles, was er darf, steht hier.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Begegnung, Eintrag } from '../shared/ablage';
import type { Monsterkarte } from '../shared/monsterliste';
import type { Uebergabe } from '@suite/uebergabe';
import type { Gruppe } from '../shared/schwierigkeit';

const api = {
  /** Eine Begegnung geht in den Tracker: Zeile im Sitzungsprotokoll der Hülle (docs/sitzungsprotokoll.md). */
  protokoll: (meldung: { art: 'begegnung'; text: string }) => ipcRenderer.send('huelle:protokoll', meldung),
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
  sammlung: {
    liste: () => ipcRenderer.invoke(kanal('liste')) as Promise<Eintrag[]>,
    lesen: (id: string) => ipcRenderer.invoke(kanal('lesen'), id) as Promise<Begegnung | null>,
    /**
     * `neu` entscheidet, ob eine freie Kennung gesucht wird.
     *
     * Beim Anlegen ja — zwei Begegnungen „Hinterhalt" sind der Normalfall
     * und duerfen einander nicht ueberschreiben. Beim Bearbeiten nein,
     * sonst zoege jedes Speichern eine Kopie nach sich.
     */
    speichern: (begegnung: Begegnung, neu: boolean) =>
      ipcRenderer.invoke(kanal('speichern'), begegnung, neu) as Promise<{
        ok: boolean;
        id: string;
        text: string;
      }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('loeschen'), id) as Promise<boolean>
  },
  /** Die Monster des Monster Creators, direkt von der Platte. */
  monster: {
    liste: () => ipcRenderer.invoke(kanal('monster:liste')) as Promise<Monsterkarte[]>
  },
  /**
   * Schiebt die offene Begegnung in den Initiative Tracker.
   *
   * `false` heisst: es ging nicht — die Huelle fehlt, oder der Tracker
   * liess sich nicht holen. Die Oberflaeche sagt das dann auch.
   */
  inDenTracker: (uebergabe: Uebergabe) =>
    ipcRenderer.invoke(kanal('tracker'), uebergabe) as Promise<boolean>,
  /** Die Gruppe am Tisch, aus den Einstellungen der Huelle. */
  gruppe: {
    lesen: () => ipcRenderer.invoke(kanal('gruppe')) as Promise<Gruppe>,
    setzen: (zeile: string) => ipcRenderer.invoke(kanal('gruppe:setzen'), zeile) as Promise<Gruppe>,
    beiWechsel: (hoerer: (gruppe: Gruppe) => void) => {
      const lauscher = (_e: unknown, gruppe: Gruppe) => hoerer(gruppe);
      ipcRenderer.on(kanal('gruppe:gesetzt'), lauscher);
      return () => {
        ipcRenderer.off(kanal('gruppe:gesetzt'), lauscher);
      };
    }
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

export type EncounterApi = typeof api;

contextBridge.exposeInMainWorld('encounter', api);

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

