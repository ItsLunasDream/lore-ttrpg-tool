/**
 * Die Bruecke des Charakterbogens: Ablage, Weitergeben, Sprache und die
 * Spruenge aus der Suche der Huelle. Gerechnet wird in der Oberflaeche.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { kanal } from '../shared/kanaele';
import type { Figur, Kachel } from '../shared/ablage';
import type { Bogen } from '../shared/bogen';
import type { Uebergabe } from '../shared/uebergabe';
import type { Anfrage } from '../shared/live';
import type { Quelleintrag } from '../shared/quellen';
import type { LiveZustand } from '../main/live';

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
    lesen: (id: string) => ipcRenderer.invoke(kanal('lesen'), id) as Promise<Bogen | null>,
    speichern: (b: Bogen, neu: boolean) =>
      ipcRenderer.invoke(kanal('speichern'), b, neu) as Promise<Antwort & { bogen: Bogen | null }>,
    loeschen: (id: string) => ipcRenderer.invoke(kanal('loeschen'), id) as Promise<boolean>,
    weitergeben: (id: string) => ipcRenderer.invoke(kanal('weitergeben'), id) as Promise<Antwort>,
    einlesen: () => ipcRenderer.invoke(kanal('einlesen')) as Promise<Antwort & { namen: string[] }>,
    uebergib: (vonId: string, nachId: string, was: Uebergabe) =>
      ipcRenderer.invoke(kanal('uebergib'), vonId, nachId, was) as Promise<Antwort & { boegen: Bogen[] }>,
    aufteilen: (vonId: string, anIds: string[]) =>
      ipcRenderer.invoke(kanal('aufteilen'), vonId, anIds) as Promise<Antwort & { boegen: Bogen[] }>
  },
  /** Boegen im Raum (docs/charakterbogen.md, „Live im Raum"). */
  live: {
    zustand: () => ipcRenderer.invoke(kanal('live:zustand')) as Promise<LiveZustand>,
    anfrage: (a: Anfrage) => ipcRenderer.invoke(kanal('live:anfrage'), a) as Promise<boolean>,
    bringe: (id: string) => ipcRenderer.invoke(kanal('live:bringe'), id) as Promise<boolean>,
    beiStand: (hoerer: (zustand: LiveZustand) => void) => {
      const lauscher = (_e: unknown, zustand: LiveZustand) => hoerer(zustand);
      ipcRenderer.on(kanal('live'), lauscher);
      return () => {
        ipcRenderer.off(kanal('live'), lauscher);
      };
    }
  },
  /** Quellen fuers Inventar aus anderen Werkzeugen (ueber die Huelle). */
  quellen: {
    magicitems: () =>
      ipcRenderer.invoke(kanal('quellen:magicitems')) as Promise<
        { id: string; name: string; art: string; einstimmung: boolean; beschreibung: string; wert: number }[]
      >,
    homebrew: () => ipcRenderer.invoke(kanal('quellen:homebrew')) as Promise<Quelleintrag[]>,
    homebrewZauber: () => ipcRenderer.invoke(kanal('quellen:homebrewZauber')) as Promise<{ id: string; name: string; grad: number; text: string }[]>,
    lootTabellen: () => ipcRenderer.invoke(kanal('quellen:lootTabellen')) as Promise<{ id: string; name: string }[]>,
    lootWuerfle: (id: string) => ipcRenderer.invoke(kanal('quellen:lootWuerfle'), id) as Promise<string | null>
  },
  /** Notiz im Story Creator anlegen oder oeffnen. */
  story: {
    anlegen: (bogen: Bogen, sync = false) =>
      ipcRenderer.invoke(kanal('story:anlegen'), bogen, sync) as Promise<{ ok: boolean; text: string; kennung?: string }>,
    /** Den Abschnitt in der Notiz jetzt neu schreiben. */
    jetzt: (bogen: Bogen) => ipcRenderer.invoke(kanal('story:jetzt'), bogen) as Promise<boolean>,
    oeffne: (kennung: string) => ipcRenderer.invoke(kanal('story:oeffne'), kennung) as Promise<boolean>
  },
  /** Das Nachschlagewerk mit einem Eintrag oder Filter oeffnen (`gestalten?…`). */
  nachschlagen: (kennung: string) => ipcRenderer.invoke(kanal('nachschlagen'), kennung) as Promise<boolean>,
  /** Eigene Zustaende aus dem Status Effect Creator. */
  eigeneZustaende: () => ipcRenderer.invoke(kanal('zustaende:eigene')) as Promise<{ name: string; text: string }[]>,
  /** Figuren in den Initiative Tracker. */
  tracker: (figuren: Figur[]) => ipcRenderer.invoke(kanal('tracker'), figuren) as Promise<boolean>,
  /** Ein Bogen wurde von aussen geaendert (Initiative Tracker). */
  beiExtern: (hoerer: (bogen: Bogen) => void) => {
    const lauscher = (_e: unknown, bogen: Bogen) => hoerer(bogen);
    ipcRenderer.on(kanal('extern'), lauscher);
    return () => {
      ipcRenderer.off(kanal('extern'), lauscher);
    };
  },
  /** Einen Wurf in den Raum: an alle, oder an jede SL. */
  wurf: (text: string, ziel: 'alle' | 'sl') =>
    ipcRenderer.invoke(kanal('wurf'), text, ziel) as Promise<'ok' | 'selbst' | 'aus' | 'fehler'>,
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

export type BogenApi = typeof api;

contextBridge.exposeInMainWorld('charakterbogen', api);
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

