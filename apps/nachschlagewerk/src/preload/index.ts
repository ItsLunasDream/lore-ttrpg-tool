/**
 * Die Bruecke des Nachschlagewerks.
 *
 * Duenn, weil der offizielle Bestand in der Oberflaeche selbst liegt:
 * `@suite/srd` ist plattformfrei und wird mitgebuendelt. Ueber die Bruecke
 * laufen die Hausregeln, die Sprache und die Spruenge aus der Suche.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Hausregel } from '../shared/hausregeln';
import type { Notiz } from '../shared/notizen';
import type { HomebrewEintrag } from '../shared/bestand';

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
  notizen: {
    liste: () => ipcRenderer.invoke(kanal('notizen:liste')) as Promise<Notiz[]>,
    schreiben: (notizen: Notiz[]) => ipcRenderer.invoke(kanal('notizen:schreiben'), notizen) as Promise<boolean>
  },
  /** Eintraege aus dem Homebrew Creator (ueber die Huelle). */
  homebrew: {
    liste: () => ipcRenderer.invoke(kanal('homebrew:liste')) as Promise<HomebrewEintrag[]>
  },
  hausregeln: {
    liste: () => ipcRenderer.invoke(kanal('hausregeln:liste')) as Promise<Hausregel[]>,
    speichern: (regel: Hausregel, neu: boolean) =>
      ipcRenderer.invoke(kanal('hausregeln:speichern'), regel, neu) as Promise<{
        ok: boolean;
        id: string;
        text: string;
      }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('hausregeln:loeschen'), id) as Promise<boolean>
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

export type NachschlagewerkApi = typeof api;

contextBridge.exposeInMainWorld('nachschlagewerk', api);
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

