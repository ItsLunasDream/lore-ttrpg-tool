/**
 * Das Einbetten der Anwendungen.
 *
 * Jede Anwendung bringt eine Montage-Schnittstelle mit (Konvention 7). Die
 * Huelle ruft sie auf, bekommt Preload und Oberflaeche zurueck und haengt eine
 * Ansicht ins Fenster. Der Code der Anwendung bleibt dabei unveraendert: sie
 * merkt nicht, dass sie in einer Huelle laeuft.
 *
 * Wie verschieden die Anwendungen darunter gebaut sind, sieht man an den zwei
 * bisherigen: der Story Creator bringt einen ganzen Hauptprozess mit,
 * Speicherort und knapp vierzig IPC-Kanaele; der Karteneditor ist eine reine
 * Web-Anwendung ohne Preload, die ueber die File System Access API speichert.
 * Fuer die Huelle sind beide dasselbe — eine Ansicht, die sie laedt, zeigt und
 * versteckt.
 *
 * Der Import geht quer ueber die Anwendungsgrenze, mit relativem Pfad. Das
 * ist Absicht und die einzige erlaubte Richtung: die Huelle darf in eine
 * Anwendung hineingreifen, eine Anwendung nie in die Huelle und nie in eine
 * andere Anwendung. Sonst waeren sie nicht mehr einzeln lauffaehig, und genau
 * das sollen sie bleiben.
 */
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { app, session as electronSession, WebContentsView, shell } from 'electron';
import type { BaseWindow } from 'electron';
import type { WebContents } from 'electron';
import {
  mountBackstory,
  registerAssetScheme as registerBackstoryScheme,
  type BackstoryEmbed
} from '../../../backstory/src/main/embed';
import { mountMapmaker } from '../../../mapmaker/src/embed';
import { translate as storyText, type MessageKey } from '../../../backstory/src/shared/i18n';
import { hasLinkReservedChars } from '../../../backstory/src/shared/wikilinks';
import {
  mountInitiative,
  registriereBildSchema as registriereInitiativeSchema
} from '../../../initiative/src/main/embed';
import { mountDice } from '../../../dice/src/main/embed';
import { mountNpc } from '../../../npc/src/main/embed';
import { mountInspiration } from '../../../inspiration/src/main/embed';
import { mountMonster } from '../../../monster/src/main/embed';
import { leseEintraege as leseZustaendeEintraege, mountZustaende } from '../../../zustaende/src/main/embed';
import { mountEncounter } from '../../../encounter/src/main/embed';
import { mountNachschlagewerk } from '../../../nachschlagewerk/src/main/embed';
import { leseFuerInventar, leseNamenUndSeltenheit, mountMagicItems } from '../../../magicitems/src/main/embed';
import {
  leseFuerInventar as leseHomebrewFuerInventar,
  leseZauberFuerBogen as leseHomebrewZauber,
  leseFuerLoot as leseHomebrewFuerLoot,
  leseFuerNachschlagewerk as leseHomebrewFuerNachschlagewerk,
  mountHomebrew
} from '../../../homebrew/src/main/embed';
import { leseFuerLoot as leseOrteFuerLoot, mountOrte } from '../../../orte/src/main/embed';
import { mountKalender } from '../../../kalender/src/main/embed';
import { leseTabellen, mountLoot } from '../../../loot/src/main/embed';
import { srdTabellen } from '../../../loot/src/shared/srd';
import { gegenstandsTabellen } from '../../../loot/src/shared/gegenstaende';
import { wuerfle as wuerfleTabelle } from '@suite/tabellen';
import { groessenTaste } from '../shared/tasten';
import { mountCharakterbogen } from '../../../charakterbogen/src/main/embed';
import { ersetzeStoryBlock } from '../../../charakterbogen/src/shared/ablage';
import type { KiQuelle } from './ki';
import type { Uebergabe } from '@suite/uebergabe';
import type { Language } from '../shared/i18n';
import type { Werkzeugeinstellungen, Wert } from '@suite/einstellungen';

export interface MontierteApp {
  readonly id: string;
  readonly sicht: WebContentsView;
  /**
   * Beginnt eine leere Karte unter diesem Namen. Nur der Karteneditor kann
   * das; alle anderen lassen es weg.
   */
  neueKarte?(name: string, notizen?: readonly { title: string; text: string }[]): void;
  /**
   * Nimmt eine Begegnung aus einem anderen Werkzeug an. Nur der Initiative
   * Tracker kann das; alle anderen lassen es weg.
   */
  uebernimmBegegnung?(uebergabe: Uebergabe): Promise<boolean>;
  /** Figuren aus dem Charakterbogen annehmen (nur der Initiative Tracker). */
  figuren?(figuren: readonly unknown[], hinzufuegen: boolean): boolean;
  /** Neue TP aus dem Initiative Tracker an einen Bogen (nur der Charakterbogen). */
  setzeTp?(kennung: string, hp: number, temp: number): Promise<void>;
  /**
   * Bringt die Anwendung an eine Stelle zurueck, die der Verlauf kennt.
   * Werkzeuge ohne eigene Stellen lassen das weg.
   */
  springeZuOrt?(ort: string | null): void;
  /**
   * Laedt die Oberflaeche der Anwendung in ihre Ansicht — und noch einmal,
   * wenn es beim ersten Mal nicht ging.
   *
   * Getrennt vom Montieren, und das ist keine Kosmetik. Beim Montieren
   * entstehen Dinge, die es *einmal* geben darf: die IPC-Kanaele der
   * Anwendung und ihr eigenes Protokoll. Solange beides am Laden hing, riss
   * ein Ladefehler die ganze Montage mit — und der naechste Versuch scheiterte
   * dann nicht mehr an der fehlenden Datei, sondern an
   * „Failed to register protocol". Ein Werkzeug, das einmal nicht hochkam,
   * blieb bis zum Neustart der Huelle kaputt, selbst nachdem die fehlenden
   * Dateien gebaut waren.
   */
  nachladen(): Promise<void>;
  /**
   * Ob die Oberflaeche schon drin ist.
   *
   * Die Huelle darf nur nachladen, wenn noch nichts geladen ist: ein erneutes
   * Laden wirft den Zustand der Anwendung weg — offene Notiz, Auswahl,
   * Bildlauf. Beim Wechsel hin und her waere jedes Mal alles zurueckgesetzt.
   */
  istGeladen(): boolean;
  /** Sichert Ungespeichertes und wartet darauf. */
  flush(): Promise<void>;
  /**
   * Fragt vor dem Schliessen nach Ungespeichertem und antwortet, ob
   * geschlossen werden darf.
   *
   * Fehlt bei Anwendungen, die nichts zu verlieren haben — die Huelle wertet
   * ein fehlendes `darfSchliessen` als „ja". `flush` reicht dafuer nicht: es
   * schreibt kommentarlos, und wer den Autosave ausschaltet, will gefragt
   * werden.
   */
  darfSchliessen?(elternfenster: BaseWindow): Promise<boolean>;
  /**
   * Setzt die Sprache dieser Anwendung von aussen — fehlt, wenn eine
   * Anwendung das (noch) nicht unterstuetzt. Die Huelle ruft das bei jeder
   * offenen Anwendung ausser der meldenden auf, wenn irgendwo umgestellt
   * wird.
   */
  setLanguage?(language: Language): Promise<void>;
  /**
   * Sagt der Anwendung, dass sich die KI-Einstellung der Sammlung geaendert
   * hat — fehlt bei Anwendungen ohne KI.
   *
   * Die Huelle ruft das bei jeder offenen Anwendung auf. Ohne diese Meldung
   * fragen sie den Zustand nur einmal beim Laden ab, und wer die KI umstellt,
   * saehe davon nichts.
   */
  meldeKiWechsel?(): void;
  /**
   * Was dieses Werkzeug an eigenen Einstellungen hat, damit die Huelle es in
   * ihrem Dialog zeigen kann.
   *
   * Warum nicht einfach ein eigener Dialog im Werkzeug? Weil es dann zwei
   * Stellen gaebe, an denen man Einstellungen sucht, und man immer in der
   * falschen zuerst nachsieht. Das Werkzeug beschreibt, WAS es gibt, die
   * Huelle malt es — das Feldschema steht in @suite/einstellungen.
   *
   * Fehlt bei Werkzeugen ohne eigene Einstellungen.
   */
  werkzeugEinstellungen?(): Promise<Werkzeugeinstellungen | null>;
  /**
   * Nimmt einen geaenderten Wert entgegen und liefert den Stand danach.
   *
   * Der Stand danach ist nicht die Eingabe: das Werkzeug darf Werte
   * zurechtruecken, und ein Schalter kann andere Felder sperren. Die Huelle
   * zeigt, was zurueckkommt.
   */
  setzeWerkzeugEinstellung?(feldId: string, wert: Wert): Promise<Werkzeugeinstellungen | null>;
  /** Loest einen Knopf aus (Ordner waehlen, Wort entfernen, ...). */
  werkzeugBefehl?(befehlId: string, wert?: string): Promise<Werkzeugeinstellungen | null>;
  /**
   * Zeigt einen Eintrag, den die Suche gefunden hat.
   *
   * Antwortet `false`, wenn es ihn nicht (mehr) gibt. Fehlt bei Werkzeugen,
   * die nichts ablegen — die tauchen in der Suche ohnehin nicht auf.
   */
  zeigeEintrag?(kennung: string): Promise<boolean>;
  /** Eine Werkzeugnachricht aus dem Raum. Nur, wer mitmacht (Initiative). */
  raumNachricht?(von: { id: string; name: string }, inhalt: string): void;
  /** Die Lage im Raum hat sich geaendert. */
  raumZustand?(lage: RaumLage): void;
}

/** Was ein Werkzeug vom Raum wissen muss. Dieselbe Form wie im Tracker. */
export interface RaumLage {
  readonly rolle: 'aus' | 'gastgeber' | 'gast';
  readonly ich: { readonly id: string; readonly name: string } | null;
  readonly personen: readonly { readonly id: string; readonly name: string; readonly sl?: boolean }[];
  /** Nur beim Gastgeber eines gespeicherten Raums: seine Einstellungen. */
  readonly einstellungen?: { readonly gruppeNehmen: boolean; readonly slMarkieren: boolean };
  /** Nur beim Gastgeber eines gespeicherten Raums: die Kennung des Gruppeninventars. */
  readonly gruppeninventar?: string | null;
}

/** Was die Huelle jeder Anwendung beim Montieren mitgibt. */
export interface MontageHaken {
  /** Die Sprache der Sammlung, mit der die Anwendung beginnen soll. */
  readonly language: Language;
  /**
   * Wird gerufen, wenn *in dieser Anwendung* die Sprache umgestellt wurde —
   * ueber ihr eigenes Sprachmenue, nicht durch ein `setLanguage` von aussen.
   */
  readonly onLanguageChange: (language: Language) => void;
  /**
   * Wird gerufen, wenn sich in einer anderen Anwendung etwas getan hat.
   *
   * Nicht die Anwendung, in der man gerade steht, meldet etwas ueber sich —
   * sie meldet, dass anderswo etwas dazugekommen ist. Der NPC Creator legt
   * eine Figur im Story Creator an und meldet „backstory"; die Huelle
   * laesst daraufhin eine Farbe ueber dessen Symbol wischen.
   *
   * Die Animation gehoert bewusst in die Huelle und nicht in die Anwendung:
   * sie soll ueberall gleich aussehen, gleich wer sie ausloest.
   */
  readonly onEreignis?: (appId: string) => void;
  /**
   * Montiert den Story Creator unsichtbar, falls er noch nicht offen war.
   * Ohne das scheiterte „In den Story Creator" in Monster und Zustaende,
   * solange man ihn nicht einmal selbst geoeffnet hatte (Testbericht).
   */
  readonly stelleStoryBereit?: () => Promise<void>;
  /**
   * Beginnt im Karteneditor eine leere Karte unter diesem Namen.
   *
   * Steht hier und nicht als Draht zwischen den beiden Anwendungen: die
   * Inspirationshilfe kennt den Karteneditor nicht, und er kennt sie nicht.
   * Die Huelle holt ihn nach vorn und stellt den Namen zu, sobald er steht.
   */
  readonly oeffneKarte?: (
    name: string,
    notizen: readonly { title: string; text: string }[]
  ) => Promise<boolean>;
  /**
   * Holt den Initiative Tracker nach vorn und stellt ihm eine Begegnung zu.
   *
   * Derselbe Weg wie `oeffneKarte` und aus demselben Grund: der Encounter
   * Creator kennt den Tracker nicht, und der Tracker kennt ihn nicht. Was
   * dort mit der Begegnung geschieht, entscheidet der Tracker — er fragt
   * erst, ob ein laufender Kampf verlorenginge.
   */
  readonly inDenTracker?: (uebergabe: Uebergabe) => Promise<boolean>;
  /**
   * Figuren aus dem Charakterbogen an den Tracker. Mit `hinzufuegen` wird er
   * nach vorn geholt und legt neue an; sonst frischt er nur auf, was er hat.
   */
  readonly figurenAnTracker?: (figuren: readonly unknown[], hinzufuegen: boolean) => void;
  /** Neue TP aus dem Tracker an den Charakterbogen. */
  readonly bogenTp?: (kennung: string, hp: number, temp: number) => void;
  /** Holt den Story Creator nach vorn und zeigt eine Notiz (`<Kampagne>/<Notiz>`). */
  readonly zeigeInStory?: (kennung: string) => void;
  /** Holt das Nachschlagewerk nach vorn und zeigt einen Eintrag oder Filter. */
  readonly zeigeImNachschlagewerk?: (kennung: string) => void;
  /**
   * Die KI-Anbindung der Sammlung.
   *
   * Eingerichtet wird sie einmal in der Huelle; die Werkzeuge bekommen sie
   * durchgereicht, statt jedes eine eigene zu fuehren. Eine Funktion und kein
   * Schnappschuss: wer sie umstellt, soll das im naechsten Klick merken.
   */
  readonly kiQuelle?: KiQuelle;
  /**
   * Der Raum im lokalen Netz, fuer Werkzeuge, die darueber synchronisieren
   * (geteilte Initiative). `anfang` liefert beim Laden die Lage und die
   * zuletzt geteilten Staende, damit ein spaet geoeffnetes Werkzeug nicht
   * auf die naechste Aenderung warten muss.
   */
  readonly raum?: {
    sende(werkzeug: string, inhalt: string, an: string | null): boolean;
    /** Eine gewoehnliche Chatzeile, etwa ein Wurf aus dem Wuerfel. */
    chatte(text: string, an: string | null): boolean;
    /** Das Gruppeninventar mit dem gespeicherten Raum merken (Charakterbogen). */
    merkeGruppe?(id: string): void;
    anfang(werkzeug: string): {
      lage: RaumLage;
      nachrichten: readonly { von: { id: string; name: string }; inhalt: string }[];
    };
  };
  /**
   * Die Anwendung meldet, wo sie gerade steht — im Story Creator die
   * offene Notiz. Der Verlauf der Huelle merkt sich das, damit zurueck nicht
   * nur das Werkzeug trifft, sondern die Stelle darin.
   */
  readonly onOrt?: (ort: string | null) => void;
}

/**
 * Meldet die eigenen Protokolle aller Anwendungen an.
 *
 * Muss vor `app.whenReady()` laufen — danach duerfen keine Schemata mehr
 * angemeldet werden, und der Story Creator koennte seine Bilder nicht
 * ausliefern. Deshalb steht das getrennt vom Montieren, das erst danach geht.
 */
export function registerSchemes(): void {
  registerBackstoryScheme();
  registriereInitiativeSchema();
}

/**
 * Wo die Dateien einer eingebetteten Anwendung liegen.
 *
 * `__dirname` hilft hier nicht: der *Code* der Anwendung ist beim Buendeln in
 * die Huelle gewandert, ihre *Dateien* — Preload, Oberflaeche, Bilder — sind
 * dort geblieben, wo sie gebaut wurden.
 *
 * Und sie liegen an zwei verschiedenen Orten, je nachdem, wie die Huelle
 * laeuft:
 *
 * - **Im Workspace** neben der Huelle, unter `apps/<id>/dist`.
 * - **Im gepackten Paket** unter `resources/apps/<id>/dist`. Dorthin legt sie
 *   electron-builder ueber `extraResources`. Bewusst nicht ins asar-Archiv:
 *   die Anwendungen bringen ihre eigenen Unterordner und Bilder mit, und was
 *   ausserhalb liegt, laesst sich mit gewoehnlichen Mitteln ansehen, wenn
 *   etwas fehlt.
 *
 * Ein Rauchtest prueft beide Faelle — den ersten beim Entwickeln, den zweiten
 * am fertigen Paket.
 */
export function appDistDir(id: string, ...weiter: string[]): string {
  const wurzel = app.isPackaged
    ? join(process.resourcesPath, 'apps', id, 'dist')
    : join(__dirname, '..', '..', '..', id, 'dist');
  return join(wurzel, ...weiter);
}

/**
 * Wo das *eigenstaendige* Programm einer Anwendung seine Daten haette.
 *
 * Electron leitet den Datenordner aus dem Namen der Anwendung ab, und der ist
 * eigenstaendig ein anderer als hier: die Huelle heisst „LORE" (frueher „TTRPG-Tools", siehe datenordner.ts), das
 * gepackte Einzelprogramm „Story Creator", und aus dem Workspace
 * gestartet gilt der Name aus seiner package.json. Alle drei liegen
 * nebeneinander im selben uebergeordneten Verzeichnis.
 *
 * Zurueckgegeben werden die Speicherorte, nicht die Datenordner: die
 * Uebernahme setzt den Speicherort, nicht die Einstellungen der anderen
 * Installation.
 */
function fruehereSpeicherorte(id: string): string[] {
  const namen: Record<string, string[]> = {
    // Gepackt und aus dem Workspace — beide Schreibweisen kommen vor.
    backstory: ['Story Creator', 'backstory-creator']
  };
  const daneben = app.getPath('appData');
  return (namen[id] ?? []).map((name) => join(daneben, name, 'vault'));
}

/** Wohin eine Anwendung ihre Daten legt. */
function datenordner(id: string): string {
  // Jede Anwendung bekommt einen eigenen Unterordner. Ein gemeinsamer waere
  // bequemer, aber zwei Anwendungen mit je einer settings.json wuerden sich
  // gegenseitig ueberschreiben.
  return join(app.getPath('userData'), id);
}

/**
 * Die Sitzung, in der eine Anwendung laeuft.
 *
 * Jede bekommt ihre eigene. Alle Ansichten laden ueber `file://`, und dort ist
 * der Ursprung fuer alle derselbe — ohne getrennte Sitzungen teilten sich die
 * Anwendungen also localStorage, IndexedDB und Zwischenspeicher. Der
 * Karteneditor legt dort seine Prop-Bibliothek, seine Tastenbelegung und die
 * zuletzt geoeffneten Karten ab; ein zweites Programm mit einem gleich
 * benannten Schluessel wuerde ihm hineinschreiben.
 *
 * `persist:` heisst, dass der Inhalt einen Neustart uebersteht. Ohne das waere
 * jede Einstellung nach dem Schliessen weg.
 */
function sitzung(id: string): string {
  return `persist:${id}`;
}

/**
 * Legt die Content-Security-Policy einer Anwendung ueber ihre Sitzung.
 *
 * Als Kopfzeile und nicht als <meta> im HTML, weil dieselbe gebaute Seite auch
 * ausserhalb der Huelle laeuft — der Karteneditor etwa unter Tauri, dessen
 * Aufrufe an den nativen Teil ueber eigene Protokolle gehen. Was hier gilt,
 * gilt damit nur hier.
 *
 * Ohne Richtlinie darf eine Seite Code von ueberall nachladen und Text als
 * Code ausfuehren. In einer Huelle mit Dateizugriff waere das der Weg, auf dem
 * eine praeparierte Kartendatei fremden Code mit den Rechten der Anwendung
 * laufen liesse.
 */
function setzeCsp(partition: string, richtlinie: string): void {
  electronSession.fromPartition(partition).webRequest.onHeadersReceived((details, weiter) => {
    weiter({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [richtlinie]
      }
    });
  });
}

/** Gemeinsame Absicherung fuer jede eingebettete Ansicht. */
function sichereAb(sicht: WebContentsView, devServerUrl: string | null): void {
  // Externe Links gehoeren in den Systembrowser. Ohne das laege auf einer
  // fremden Seite dieselbe Bruecke zum Dateisystem wie auf der eigenen.
  sicht.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  sicht.webContents.on('will-navigate', (event, url) => {
    if (devServerUrl && url.startsWith(devServerUrl)) return;
    event.preventDefault();
    const ziel = new URL(url);
    if (ziel.protocol === 'http:' || ziel.protocol === 'https:') void shell.openExternal(ziel.href);
  });

  /*
   * Strg+K oeffnet die Suche — in JEDEM Werkzeug.
   *
   * Liegt der Fokus in einer eingebetteten Ansicht, sieht die Oberflaeche
   * der Huelle den Tastendruck nicht: es sind getrennte Fenster im selben
   * Prozess. Frueher meldete ihn deshalb das Preload jedes Werkzeugs
   * weiter — derselbe Block, viermal kopiert, und in fuenf Werkzeugen
   * schlicht vergessen. Wer im Story Creator oder beim Wuerfeln Strg+K
   * drueckte, bekam nichts.
   *
   * `before-input-event` sieht dieselbe Taste im Hauptprozess, und zwar
   * fuer jede Ansicht, die hier durchlaeuft. Eine Stelle statt neun, und
   * ein neues Werkzeug bekommt es, ohne dass jemand daran denkt.
   */
  sicht.webContents.on('before-input-event', (event, eingabe) => {
    if (eingabe.type !== 'keyDown') return;
    // F6: zurück in die Hülle (Schiene). Tab kommt aus einer eingebetteten
    // Ansicht nicht heraus; ohne diese Taste säße man per Tastatur fest.
    if (eingabe.key === 'F6' && !eingabe.control && !eingabe.alt && !eingabe.meta && !eingabe.shift) {
      event.preventDefault();
      huellenFokus?.();
      return;
    }
    // F1: die Hilfe der Hülle. Der Map Maker hat eine eigene, ausführlichere; die bleibt ihm.
    if (eingabe.key === 'F1' && !eingabe.control && !eingabe.alt && !eingabe.meta && !eingabe.shift && !sicht.webContents.getURL().includes('/apps/mapmaker/')) {
      event.preventDefault();
      huellenHilfe?.();
      return;
    }
    if (!(eingabe.control || eingabe.meta)) return;
    // Strg+Alt und Plus, Minus, 0: die Groesse der ganzen Oberflaeche.
    // Strg allein bleibt den Werkzeugen (Zoom im Story Creator).
    const stufe = eingabe.alt ? groessenTaste(eingabe.key, eingabe.code) : null;
    if (stufe && huellenGroesse) {
      event.preventDefault();
      huellenGroesse(stufe);
      return;
    }
    if (eingabe.key.toLowerCase() !== 'k') return;
    huellenSuche?.();
  });
}

export { groessenTaste } from '../shared/tasten';

let huellenGroesse: ((stufe: 'groesser' | 'kleiner' | 'zurueck') => void) | null = null;

/** Was Strg+Alt+Plus/Minus/0 in einem Werkzeug tut; die Huelle traegt es ein. */
export function setzeGroessentaste(hoerer: (stufe: 'groesser' | 'kleiner' | 'zurueck') => void): void {
  huellenGroesse = hoerer;
}

/**
 * Was passiert, wenn in einem Werkzeug Strg+K gedrueckt wird.
 *
 * Die Huelle traegt es beim Start ein. Hier steht nur der Haken, damit
 * `sichereAb` nichts ueber sie wissen muss.
 */
let huellenSuche: (() => void) | null = null;

/** Was F6 in einem Werkzeug tut: den Fokus an die Hülle geben. */
let huellenFokus: (() => void) | null = null;

export function setzeFokustaste(hoerer: () => void): void {
  huellenFokus = hoerer;
}

let huellenHilfe: (() => void) | null = null;

/** Was F1 in einem Werkzeug tut: die Hilfe der Hülle öffnen. */
export function setzeHilfetaste(hoerer: () => void): void {
  huellenHilfe = hoerer;
}

export function setzeSuchtaste(hoerer: () => void): void {
  huellenSuche = hoerer;
}

/** Laedt in eine Ansicht, was die Montage-Schnittstelle angegeben hat. */
async function lade(
  sicht: WebContentsView,
  quelle: { devServerUrl: string | null; indexFile: string | null }
): Promise<void> {
  if (quelle.devServerUrl) await sicht.webContents.loadURL(quelle.devServerUrl);
  else await sicht.webContents.loadFile(quelle.indexFile!);
  /*
   * „Geladen" heisst noch nicht, dass die Oberflaeche zuhoert: React meldet
   * seine Empfaenger erst in Effekten nach dem ersten Zeichnen an. Was die
   * Huelle direkt danach zustellte (Figuren, Begegnung, Kartenname, Treffer
   * der Suche), ging sonst verloren (Rueckmeldung „In die Initiative").
   * Zwei Takte der Ereignisschleife reichen dafuer; Timer laufen auch in
   * einer unsichtbaren Ansicht.
   */
  await sicht.webContents
    .executeJavaScript('new Promise((r) => setTimeout(() => setTimeout(r, 60), 0))')
    .catch(() => undefined);
}

/**
 * Baut die Ansicht einer Anwendung und laedt sie.
 *
 * Gibt `null` zurueck, wenn die Huelle die Anwendung noch nicht einbetten
 * kann. Die Oberflaeche zeigt dann ihre Platzhalterflaeche — besser als ein
 * Fehler fuer etwas, das erklaertermassen noch nicht fertig ist.
 */
/**
 * Die Sprache der Sammlung fuer Meldungen, die die Huelle selbst schreibt
 * (etwa „erst den Story Creator oeffnen"). `haken.language` ist nur die
 * Sprache beim Montieren; umgestellt wird ueber `setzeSammlungssprache`.
 */
let sammlungssprache: Language = 'en';
export function setzeSammlungssprache(language: Language): void {
  sammlungssprache = language;
}
function zweisprachig(de: string, en: string): string {
  return sammlungssprache === 'de' ? de : en;
}
const OHNE_STORY = () =>
  zweisprachig(
    'Öffne den Story Creator einmal, dann weiß die Sammlung, wohin.',
    'Open the Story Creator once, then the collection knows where to put it.'
  );
/**
 * Fehler des Story Creators in lesbarem Text.
 *
 * Der Vault wirft Schluessel wie `error.linkChars`; die standen roh in der
 * Oberflaeche des NPC Creators und der Inspirationshilfe (Testbericht).
 */
function fehlerText(fehler: unknown): string {
  const f = fehler as { key?: unknown; params?: Record<string, string | number> } | null;
  if (f && typeof f.key === 'string' && f.key.startsWith('error.')) {
    return storyText(sammlungssprache, f.key as MessageKey, f.params);
  }
  return fehler instanceof Error ? fehler.message : String(fehler);
}

/**
 * Die eigenen Zustaende aus der Sammlung des Status Effect Creators.
 *
 * Direkt von der Platte, wie die Monster fuer den Encounter Creator: kein
 * zweiter Bestand, und was eben gebaut wurde, ist sofort da. Der Text ist
 * der Leib der Datei ohne Kopf und ohne die Ueberschrift mit dem Namen.
 */
export async function leseEigeneZustaende(): Promise<{ name: string; text: string; thema: string; art: string }[]> {
  const ordner = join(datenordner('zustaende'), 'zustaende');
  let dateien: string[];
  try {
    dateien = await readdir(ordner);
  } catch {
    return [];
  }
  const heraus: { name: string; text: string; thema: string; art: string }[] = [];
  for (const datei of dateien) {
    if (!datei.endsWith('.md')) continue;
    try {
      const inhalt = await readFile(join(ordner, datei), 'utf8');
      const kopf = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(inhalt);
      const kopfzeilen = kopf?.[1].split(/\r?\n/) ?? [];
      const feld = (schluessel: string) =>
        (kopfzeilen.find((z) => z.startsWith(`${schluessel}:`))?.slice(schluessel.length + 1).trim() ?? '').replace(/^"|"$/g, '');
      const nameZeile = kopfzeilen.find((z) => z.startsWith('name:'));
      let name = nameZeile ? nameZeile.slice(5).trim() : datei.slice(0, -3);
      if (name.startsWith('"')) {
        try {
          name = JSON.parse(name) as string;
        } catch {
          // Roh lassen.
        }
      }
      const leib = (kopf ? inhalt.slice(kopf[0].length) : inhalt).replace(/^#\s+.*\r?\n+/, '').trim();
      // Thema und Art: der Monster Creator waehlt danach den Rettungswurf.
      heraus.push({ name, text: leib.slice(0, 1500), thema: feld('thema'), art: feld('art') });
    } catch {
      // Eine kaputte Datei nimmt nicht die ganze Liste mit.
    }
  }
  return heraus.sort((a, b) => a.name.localeCompare(b.name));
}

/** Die Notiz mit diesem Titel oder Alias, oder null. */
async function findeNotiz(kampagneId: string, titel: string) {
  if (!backstoryEmbed) return null;
  const gesucht = titel.trim().toLowerCase();
  const notizen = await backstoryEmbed.vault.listNotes(kampagneId);
  return (
    notizen.find(
      (notiz) =>
        notiz.title.trim().toLowerCase() === gesucht ||
        notiz.aliases.some((alias) => alias.trim().toLowerCase() === gesucht)
    ) ?? null
  );
}

/** Nur Werte fuer Felder, die der Notiztyp wirklich hat, und nur Textfelder. */
function nurBekannteFelder(
  def: { fields: readonly { key: string; type: string }[] } | undefined,
  felder: Readonly<Record<string, string>> | undefined
): Record<string, string> {
  if (!def || !felder) return {};
  const erlaubt = new Set(def.fields.filter((f) => f.type === 'text' || f.type === 'textarea').map((f) => f.key));
  return Object.fromEntries(Object.entries(felder).filter(([key, wert]) => erlaubt.has(key) && wert.trim()));
}

const OHNE_KAMPAGNE = () =>
  zweisprachig('Es gibt noch keine Kampagne, in die das passt.', 'There is no campaign yet to put this in.');

export async function mountApp(id: string, haken: MontageHaken): Promise<MontierteApp | null> {
  sammlungssprache = haken.language;
  if (id === 'backstory') return montiereBackstory(id, haken);
  if (id === 'mapmaker') return montiereMapmaker(id, haken);
  if (id === 'initiative') return montiereInitiative(id, haken);
  if (id === 'dice') return montiereDice(id, haken);
  if (id === 'npc') return montiereNpc(id, haken);
  if (id === 'inspiration') return montiereInspiration(id, haken);
  if (id === 'monster') return montiereMonster(id, haken);
  if (id === 'zustaende') return montiereZustaende(id, haken);
  if (id === 'encounter') return montiereEncounter(id, haken);
  if (id === 'nachschlagewerk') return montiereNachschlagewerk(id, haken);
  if (id === 'magicitems') return montiereMagicItems(id, haken);
  if (id === 'homebrew') return montiereHomebrew(id, haken);
  if (id === 'orte') return montiereOrte(id, haken);
  if (id === 'kalender') return montiereKalender(id, haken);
  if (id === 'loot') return montiereLoot(id, haken);
  if (id === 'charakterbogen') return montiereCharakterbogen(id, haken);
  return null;
}

async function montiereDice(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountDice({
    userDataDir: datenordner(id),
    distDir: appDistDir(id, 'main'),
    partition: sitzung(id),
    devServerUrl: process.env.DICE_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    raum: haken.raum
      ? {
          lage: () => {
            const lage = haken.raum!.anfang('dice').lage;
            return { rolle: lage.rolle, ichId: lage.ich?.id ?? null, slIds: lage.personen.filter((p) => p.sl).map((p) => p.id) };
          },
          chatte: (text, an) => haken.raum!.chatte(text, an)
        }
      : undefined
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language)
  };
}

/**
 * Der NPC Creator.
 *
 * Er bekommt von der Huelle eine Funktion zum Anlegen — den Vault selbst
 * bekommt er nicht zu sehen. So bleibt die Kenntnis darueber, wo Notizen
 * liegen und welche Kampagne offen ist, an einer Stelle.
 */
/**
 * Der Notiztyp, unter dem ein Werkzeug seine Notiz anlegt.
 *
 * Nicht fest verdrahten: die Notiztypen gehoeren der Kampagne, und wer sie
 * umbaut, hat sie gar nicht mehr alle. `createNote` weist einen unbekannten
 * Typ mit `error.unknownNoteType` ab — genau das ist beim Monster Creator
 * passiert, der unter „creature" anlegte, das es in keiner Vorlage gibt.
 *
 * Deshalb: die Wunschliste der Reihe nach durchgehen und den ersten Typ
 * nehmen, den die Kampagne wirklich kennt. Bleibt keiner uebrig, den ersten
 * ueberhaupt — eine Kampagne ohne Notiztypen gibt es nicht.
 */
/**
 * Die Kampagnen des Story Creators, fuer die Auswahl im NPC Creator und in
 * der Inspirationshilfe (Wunsch aus dem Testbericht: man sah nicht, wohin
 * die Figur geht). `aktuell` ist die, an der zuletzt gearbeitet wurde.
 */
async function zielKampagnen(stelleStoryBereit?: () => Promise<void>): Promise<{
  liste: { id: string; name: string }[];
  aktuell: string | null;
}> {
  if (!backstoryEmbed) await stelleStoryBereit?.().catch(() => undefined);
  if (!backstoryEmbed) return { liste: [], aktuell: null };
  const kampagnen = await backstoryEmbed.vault.listCampaigns();
  const letzte = backstoryEmbed.aktuelleEinstellungen().lastCampaignId;
  const aktuell = kampagnen.find((k) => k.id === letzte)?.id ?? kampagnen[0]?.id ?? null;
  return { liste: kampagnen.map((k) => ({ id: k.id, name: k.name })), aktuell };
}

/** Die gewaehlte Kampagne, sonst die zuletzt offene, sonst die erste. */
function waehleKampagne<K extends { id: string }>(kampagnen: readonly K[], gewuenscht?: string | null): K {
  const letzte = backstoryEmbed?.aktuelleEinstellungen().lastCampaignId;
  return (
    kampagnen.find((k) => k.id === gewuenscht) ?? kampagnen.find((k) => k.id === letzte) ?? kampagnen[0]
  );
}

function passenderNotiztyp(kampagne: { noteTypes: { id: string }[] }, wuensche: readonly string[]): string {
  for (const wunsch of wuensche) {
    if (kampagne.noteTypes.some((typ) => typ.id === wunsch)) return wunsch;
  }
  return kampagne.noteTypes[0]?.id ?? 'note';
}

/**
 * Legt eine Notiz in der Kampagne an, an der gerade gearbeitet wird, und
 * sagt dem Story Creator Bescheid. Der gemeinsame Weg fuer Monster,
 * Zustaende und Beute; der NPC Creator hat eigene Texte.
 */
async function legeNotizAn(
  titel: string,
  markdown: string,
  wuensche: readonly string[],
  haken: MontageHaken
): Promise<{ ok: boolean; text: string; kennung?: string }> {
  if (!backstoryEmbed) await haken.stelleStoryBereit?.().catch(() => undefined);
  if (!backstoryEmbed) {
    return { ok: false, text: OHNE_STORY() };
  }
  const kampagnen = await backstoryEmbed.vault.listCampaigns();
  if (kampagnen.length === 0) {
    return { ok: false, text: OHNE_KAMPAGNE() };
  }
  const letzte = backstoryEmbed.aktuelleEinstellungen().lastCampaignId;
  const kampagne = kampagnen.find((eintrag) => eintrag.id === letzte) ?? kampagnen[0];
  const typ = passenderNotiztyp(kampagne, wuensche);
  let kennung: string;
  try {
    const notiz = await backstoryEmbed.vault.createNote(kampagne.id, typ, titel);
    await backstoryEmbed.vault.saveNote(kampagne.id, { ...notiz, body: markdown });
    kennung = `${kampagne.id}/${notiz.id}`;
  } catch (fehler) {
    return { ok: false, text: fehlerText(fehler) };
  }

  // Dem Story Creator sagen, dass etwas dazugekommen ist — sonst liegt
  // die Notiz auf der Platte und seine offene Liste zeigt sie nicht.
  if (backstorySicht && !backstorySicht.webContents.isDestroyed()) {
    backstoryEmbed.meldeFremdeAenderung(backstorySicht.webContents);
  }
  haken.onEreignis?.('backstory');
  return { ok: true, text: `${titel} → ${kampagne.name}`, kennung };
}

/** Die Notiz eines Sitzungsprotokolls (docs/sitzungsprotokoll.md); Typ „Sitzung", wenn es ihn gibt. */
export function legeSitzungsnotizAn(titel: string, markdown: string, haken: MontageHaken) {
  return legeNotizAn(titel, markdown, ['session', 'note'], haken);
}

/** Titel aller Notizen der offenen Kampagne, damit das Protokoll sie verlinken kann. */
export async function bekannteNotiztitel(): Promise<string[]> {
  if (!backstoryEmbed) return [];
  try {
    const kampagnen = await backstoryEmbed.vault.listCampaigns();
    const letzte = backstoryEmbed.aktuelleEinstellungen().lastCampaignId;
    const kampagne = kampagnen.find((k) => k.id === letzte) ?? kampagnen[0];
    if (!kampagne) return [];
    return (await backstoryEmbed.vault.listNotes(kampagne.id)).map((n) => n.title);
  } catch {
    return [];
  }
}

/** Der Titel einer Notiz der offenen Kampagne aus ihrer Kennung (so meldet der Story Creator seinen Ort). */
export async function notizTitelVon(notizId: string): Promise<string | null> {
  if (!backstoryEmbed || !notizId) return null;
  try {
    const kampagnen = await backstoryEmbed.vault.listCampaigns();
    const letzte = backstoryEmbed.aktuelleEinstellungen().lastCampaignId;
    const kampagne = kampagnen.find((k) => k.id === letzte) ?? kampagnen[0];
    if (!kampagne) return null;
    return (await backstoryEmbed.vault.getNote(kampagne.id, notizId)).title;
  } catch {
    return null;
  }
}

/**
 * Schreibt den Abschnitt des Charakterbogens in seine Notiz (stetiger
 * Abgleich, nur Bogen → Notiz). Was ausserhalb der Markierungen steht,
 * bleibt; siehe `ersetzeStoryBlock`.
 */
async function aktualisiereStoryNotiz(kennung: string, block: string, haken: MontageHaken): Promise<boolean> {
  if (!backstoryEmbed) await haken.stelleStoryBereit?.().catch(() => undefined);
  const teiler = kennung.indexOf('/');
  if (!backstoryEmbed || teiler <= 0) return false;
  const kampagne = kennung.slice(0, teiler);
  let notiz;
  try {
    notiz = await backstoryEmbed.vault.getNote(kampagne, kennung.slice(teiler + 1));
  } catch {
    return false;
  }
  const neu = ersetzeStoryBlock(notiz.body, block);
  if (neu === notiz.body) return true;
  await backstoryEmbed.vault.saveNote(kampagne, { ...notiz, body: neu });
  if (backstorySicht && !backstorySicht.webContents.isDestroyed()) {
    backstoryEmbed.meldeFremdeAenderung(backstorySicht.webContents);
  }
  return true;
}

/** Gibt es die Notiz `<Kampagne>/<Notiz>` noch? */
async function storyNotizDa(kennung: string, haken: MontageHaken): Promise<boolean> {
  if (!backstoryEmbed) await haken.stelleStoryBereit?.().catch(() => undefined);
  const teiler = kennung.indexOf('/');
  if (!backstoryEmbed || teiler <= 0) return false;
  try {
    await backstoryEmbed.vault.getNote(kennung.slice(0, teiler), kennung.slice(teiler + 1));
    return true;
  } catch {
    return false;
  }
}

/**
 * Sagt einem offenen Story Creator, dass auf der Platte etwas dazugekommen
 * ist (Austausch). Ist er zu, gibt es niemandem etwas zu sagen: beim
 * naechsten Oeffnen liest er ohnehin frisch.
 */
export function meldeStoryCreatorAenderung(): void {
  if (backstoryEmbed && backstorySicht && !backstorySicht.webContents.isDestroyed()) {
    backstoryEmbed.meldeFremdeAenderung(backstorySicht.webContents);
  }
}

async function montiereNpc(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountNpc({
    distDir: appDistDir(id, 'main'),
    devServerUrl: process.env.NPC_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    // Auch hier die KI der Sammlung. Der NPC Creator hat keine eigene Ablage
    // und soll auch keine eigene Einstellung bekommen.
    kiQuelle: haken.kiQuelle,
    kampagnen: () => zielKampagnen(haken.stelleStoryBereit),
    anlegen: async (
      titel: string,
      markdown: string,
      kampagneId?: string | null,
      optionen?: { ersetzen?: boolean; felder?: Readonly<Record<string, string>> }
    ) => {
      if (!backstoryEmbed) await haken.stelleStoryBereit?.().catch(() => undefined);
      if (!backstoryEmbed) {
        return {
          ok: false,
          text: OHNE_STORY()
        };
      }
      const kampagnen = await backstoryEmbed.vault.listCampaigns();
      if (kampagnen.length === 0) {
        return {
          ok: false,
          text: zweisprachig(
            'Es gibt noch keine Kampagne, in die die Figur passt.',
            'There is no campaign yet for this character.'
          )
        };
      }
      // Die Kampagne, an der gerade gearbeitet wird. Der Story Creator
      // merkt sie sich in seinen Einstellungen; abgefragt wird der aktuelle
      // Stand und nicht der Schnappschuss vom Montagezeitpunkt, sonst landete
      // die Figur nach einem Kampagnenwechsel in der falschen Sammlung.
      //
      // Gewaehlt werden kann sie im NPC Creator selbst; vorbelegt ist die
      // zuletzt offene (Testbericht: man sah nicht, wohin es geht).
      const kampagne = waehleKampagne(kampagnen, kampagneId);

      // Zweimal „Senden" legte zwei Notizen gleichen Namens an (Testbericht).
      // Eine vorhandene Figur wird nicht verdoppelt; auf ausdruecklichen
      // Wunsch wird sie aktualisiert. Die alte Fassung bleibt im Verlauf.
      const vorhandene = await findeNotiz(kampagne.id, titel);
      if (vorhandene && !optionen?.ersetzen) {
        return {
          ok: false,
          vorhanden: true,
          text: zweisprachig(
            `„${titel}" gibt es in ${kampagne.name} schon.`,
            `"${titel}" already exists in ${kampagne.name}.`
          )
        };
      }
      try {
        if (vorhandene) {
          const def = kampagne.noteTypes.find((d) => d.id === vorhandene.type);
          await backstoryEmbed.vault.saveNote(kampagne.id, {
            ...vorhandene,
            body: markdown,
            fields: { ...vorhandene.fields, ...nurBekannteFelder(def, optionen?.felder) }
          });
        } else {
          const typ = passenderNotiztyp(kampagne, ['character', 'note']);
          const def = kampagne.noteTypes.find((d) => d.id === typ);
          const notiz = await backstoryEmbed.vault.createNote(kampagne.id, typ, titel);
          await backstoryEmbed.vault.saveNote(kampagne.id, {
            ...notiz,
            body: markdown,
            fields: { ...notiz.fields, ...nurBekannteFelder(def, optionen?.felder) }
          });
        }
      } catch (fehler) {
        return { ok: false, text: fehlerText(fehler) };
      }

      // Dem Story Creator sagen, dass etwas dazugekommen ist. Ohne das
      // liegt die Notiz zwar auf der Platte, seine offene Liste zeigt sie
      // aber nicht — und es sieht aus, als waere der Export ins Leere
      // gelaufen.
      if (backstorySicht && !backstorySicht.webContents.isDestroyed()) {
        backstoryEmbed.meldeFremdeAenderung(backstorySicht.webContents);
      }
      haken.onEreignis?.('backstory');
      return { ok: true, text: `${titel} → ${kampagne.name}` };
    }
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language)    ,
    // Die KI wird in der Huelle eingerichtet; dieses Werkzeug muss es
    // erfahren, sonst fragt es den Zustand nur beim Laden ab.
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents)
  };
}

/**
 * Die Inspirationshilfe.
 *
 * Wie der NPC Creator bekommt sie eine Funktion zum Anlegen und sieht den
 * Vault nie. Der Unterschied: hier kommen mehrere Notizen auf einmal, mit
 * Wiki-Verweisen untereinander. Sie muessen deshalb alle in dieselbe
 * Kampagne, und die wird einmal zu Beginn bestimmt — nicht je Notiz, sonst
 * koennte ein Kampagnenwechsel mitten im Anlegen das Geflecht zerreissen.
 */
/**
 * Legt mehrere Notizen auf einmal an (Inspirationshilfe, Settlement
 * Generator): erst alle Titel prüfen, dann anlegen; was es schon gibt, wird
 * übersprungen oder auf Wunsch ersetzt.
 */
async function legeNotizenAn(
  notizen: readonly { typ: string; titel: string; markdown: string }[],
  kampagneId: string | null | undefined,
  optionen: { ersetzen?: boolean } | undefined,
  haken: MontageHaken
): Promise<{ ok: boolean; text: string; angelegt: number; vorhanden?: number }> {
  if (!backstoryEmbed) await haken.stelleStoryBereit?.().catch(() => undefined);
  if (!backstoryEmbed) {
    return {
      ok: false,
      text: OHNE_STORY(),
      angelegt: 0
    };
  }
  if (notizen.length === 0) {
    return {
      ok: false,
      text: zweisprachig('Es gibt nichts zu übernehmen.', 'There is nothing to take over.'),
      angelegt: 0
    };
  }
  const kampagnen = await backstoryEmbed.vault.listCampaigns();
  if (kampagnen.length === 0) {
    return { ok: false, text: OHNE_KAMPAGNE(), angelegt: 0 };
  }
  const kampagne = waehleKampagne(kampagnen, kampagneId);

  /*
   * Erst pruefen, dann anlegen. Ein Titel mit [ ] | scheiterte sonst
   * mitten im Geflecht, und die Haelfte lag schon da (Testbericht).
   */
  const kaputt = notizen.find((notiz) => !notiz.titel.trim() || hasLinkReservedChars(notiz.titel));
  if (kaputt) {
    const schluessel: MessageKey = kaputt.titel.trim() ? 'error.linkChars' : 'error.noteTitle';
    return { ok: false, text: storyText(sammlungssprache, schluessel, { name: kaputt.titel }), angelegt: 0 };
  }

  /*
   * Was es schon gibt, wird uebersprungen. Zweimal senden legte vorher
   * das ganze Geflecht doppelt an, obwohl dort „nichts wird
   * ueberschrieben" steht — und jeder Verweis war danach mehrdeutig.
   */
  let angelegt = 0;
  let uebersprungen = 0;
  let aktualisiert = 0;
  try {
    for (const notiz of notizen) {
      const vorhandene = await findeNotiz(kampagne.id, notiz.titel);
      if (vorhandene) {
        // Auf ausdruecklichen Wunsch den Text ersetzen; Steckbrief,
        // Aliasse und Beziehungen bleiben, die alte Fassung im Verlauf.
        if (optionen?.ersetzen) {
          await backstoryEmbed.vault.saveNote(kampagne.id, { ...vorhandene, body: notiz.markdown });
          aktualisiert += 1;
        } else {
          uebersprungen += 1;
        }
        continue;
      }
      const neu = await backstoryEmbed.vault.createNote(kampagne.id, notiz.typ, notiz.titel);
      await backstoryEmbed.vault.saveNote(kampagne.id, { ...neu, body: notiz.markdown });
      angelegt += 1;
    }
  } catch (fehler) {
    // Was schon liegt, bleibt liegen: geloescht wird hier nichts, was
    // der Nutzer nicht selbst geloescht hat.
    return {
      ok: false,
      text: `${fehlerText(fehler)} ${zweisprachig(`(${angelegt} angelegt)`, `(${angelegt} created)`)}`,
      angelegt
    };
  }
  if (angelegt === 0 && aktualisiert === 0 && uebersprungen > 0) {
    return {
      ok: false,
      text: zweisprachig(
        `Alles davon steht schon in ${kampagne.name}; nichts doppelt angelegt.`,
        `All of it is already in ${kampagne.name}; nothing was duplicated.`
      ),
      angelegt: 0,
      vorhanden: uebersprungen
    };
  }

  // Dem Story Creator sagen, dass etwas dazugekommen ist. Ohne das
  // liegen die Notizen zwar auf der Platte, seine offene Liste zeigt sie
  // aber nicht.
  if (backstorySicht && !backstorySicht.webContents.isDestroyed()) {
    backstoryEmbed.meldeFremdeAenderung(backstorySicht.webContents);
  }
  haken.onEreignis?.('backstory');
  return {
    ok: true,
    text:
      uebersprungen > 0
        ? zweisprachig(
            `${kampagne.name} (${uebersprungen} schon vorhanden, übersprungen)`,
            `${kampagne.name} (${uebersprungen} already there, skipped)`
          )
        : aktualisiert > 0
          ? zweisprachig(
              `${kampagne.name} (${aktualisiert} aktualisiert)`,
              `${kampagne.name} (${aktualisiert} updated)`
            )
          : kampagne.name,
    angelegt,
    vorhanden: uebersprungen
  };
}

async function montiereInspiration(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountInspiration({
    distDir: appDistDir(id, 'main'),
    devServerUrl: process.env.INSPIRATION_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    // Die KI der Sammlung, wie im NPC Creator. Ein eigener Zugang je Werkzeug
    // waere eine zweite Stelle, an der derselbe Schluessel liegt.
    kiQuelle: haken.kiQuelle,
    /**
     * Wer in der offenen Kampagne schon steht.
     *
     * Damit kommen auch die Figuren des NPC Creators herein: der legt sie als
     * Notiz in derselben Kampagne ab. Ein eigener Draht zwischen den beiden
     * Werkzeugen waere der falsche Weg — sie sollen einzeln lauffaehig
     * bleiben, und die Kampagne ist ohnehin die Stelle, an der die Wahrheit
     * liegt.
     */
    // Der Weg zum Karteneditor. Nicht direkt: die Huelle holt ihn nach vorn.
    karteAnlegen: haken.oeffneKarte,
    kampagnen: () => zielKampagnen(haken.stelleStoryBereit),
    figuren: async (kampagneId?: string | null) => {
      if (!backstoryEmbed) return [];
      const kampagnen = await backstoryEmbed.vault.listCampaigns();
      if (kampagnen.length === 0) return [];
      const kampagne = waehleKampagne(kampagnen, kampagneId);
      const notizen = await backstoryEmbed.vault.listNotes(kampagne.id);
      return notizen
        .filter((notiz) => notiz.type === 'character')
        .map((notiz) => ({
          titel: notiz.title,
          // Die erste Zeile mit Inhalt, ohne Auszeichnung — sie steht in der
          // Auswahlliste und soll die Figur wiedererkennbar machen, nicht die
          // ganze Notiz zeigen.
          kurz: (notiz.body ?? '')
            .split('\n')
            .map((zeile) => zeile.replace(/[*_#>`[\]]/g, '').trim())
            .find((zeile) => zeile.length > 0)
            ?.slice(0, 90) ?? ''
        }));
    },
    anlegen: (notizen, kampagneId?: string | null, optionen?: { ersetzen?: boolean }) =>
      legeNotizenAn(notizen, kampagneId, optionen, haken)
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents)
  };
}

async function montiereInitiative(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountInitiative({
    userDataDir: datenordner(id),
    // Der Tracker buendelt seinen Hauptprozessteil nach dist/main, die
    // Oberflaeche nach dist/renderer — wie der Story Creator.
    distDir: appDistDir(id, 'main'),
    partition: sitzung(id),
    devServerUrl: process.env.INITIATIVE_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    raum: haken.raum
      ? {
          sende: (inhalt, an) => haken.raum?.sende('initiative', inhalt, an) ?? false,
          anfang: () =>
            haken.raum?.anfang('initiative') ?? { lage: { rolle: 'aus', ich: null, personen: [] }, nachrichten: [] }
        }
      : undefined,
    eigeneZustaende: leseEigeneZustaende,
    bogenTp: (kennung, hp, temp) => haken.bogenTp?.(kennung, hp, temp)
  });

  // Vor dem Laden: die Kopfzeile muss stehen, bevor die erste Antwort kommt.
  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      // Wie beim Karteneditor: der Tracker liest seine Sprache aus dem
      // eigenen Browserspeicher, bevor die Huelle ihm etwas sagen kann.
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    // Die Suche der Huelle (Strg+K) springt hierher.
    zeigeEintrag: (kennung) =>
      eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung),
    // Eine Begegnung aus dem Encounter Creator. Angenommen wird sie in der
    // Oberflaeche des Trackers, und erst nach seiner eigenen Rueckfrage.
    uebernimmBegegnung: (uebergabe) =>
      eingebettet.uebernimmBegegnung(sicht.webContents as WebContents, uebergabe),
    figuren: (figuren, hinzufuegen) => eingebettet.figuren(sicht.webContents as WebContents, figuren, hinzufuegen),
    // Die geteilte Initiative: Nachrichten und Lage aus dem Raum.
    raumNachricht: (von, inhalt) => eingebettet.raumNachricht(sicht.webContents as WebContents, von, inhalt),
    raumZustand: (lage) => eingebettet.raumZustand(sicht.webContents as WebContents, lage)
  };
}

/**
 * Der Vault des Story Creators, sobald er montiert ist.
 *
 * Der NPC Creator legt seine Figuren dort ab, kennt den Vault aber nicht und
 * soll ihn auch nicht kennen: die Huelle reicht den Zugriff durch. Ist der
 * Story Creator nie geoeffnet worden, steht hier null — und der Export
 * sagt das ehrlich, statt stumm ins Leere zu schreiben.
 */
let backstoryEmbed: BackstoryEmbed | null = null;
/**
 * Die Ansicht des Story Creators, solange er montiert ist.
 *
 * Gebraucht, um ihm zu sagen, dass hinter seinem Ruecken eine Notiz
 * dazugekommen ist. Der Embed allein reicht dafuer nicht: `send` braucht die
 * webContents, und die gehoeren zur Ansicht.
 */
let backstorySicht: WebContentsView | null = null;

async function montiereBackstory(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountBackstory({
    userDataDir: datenordner(id),
    distDir: appDistDir(id, 'main'),
    partition: sitzung(id),
    devServerUrl: process.env.BACKSTORY_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: haken.onLanguageChange,
    // Wer den Story Creator bisher einzeln benutzt hat, soll seine
    // Kampagnen hier wiederfinden und nicht vor einer leeren Sammlung stehen.
    uebernahmeKandidaten: fruehereSpeicherorte(id),
    // In der Huelle wird die KI einmal fuer alle eingerichtet. Der eigene
    // Abschnitt in den Einstellungen dieser Anwendung verschwindet dadurch.
    kiQuelle: haken.kiQuelle,
    // Die Huelle fuehrt die Einstellungen; der eigene Dialog faellt weg.
    inHuelle: true
  });

  // Fuer den NPC Creator: er legt Figuren hier ab, ohne den Vault zu kennen.
  backstoryEmbed = eingebettet;

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);
  // Rechtsklick auf ein angestrichenes Wort soll auch hier Vorschlaege
  // bringen, nicht nur in der eigenstaendigen Anwendung.
  eingebettet.richteRechtschreibungEin(sicht.webContents);
  // Welche Notiz offen ist, gehoert in den Verlauf der Huelle.
  if (haken.onOrt) eingebettet.beobachteVerlauf(sicht.webContents, haken.onOrt);
  // Damit der NPC Creator ihm sagen kann, dass eine Figur dazugekommen ist.
  backstorySicht = sicht;

  let geladen = false;
  return {
    id,
    sicht,
    springeZuOrt: (ort) => eingebettet.springeZuOrt(sicht.webContents as WebContents, ort),
    nachladen: async () => {
      await lade(sicht, eingebettet);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(sicht.webContents as WebContents),
    darfSchliessen: (elternfenster) =>
      eingebettet.darfSchliessen(sicht.webContents as WebContents, elternfenster),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language)    ,
    // Die KI wird in der Huelle eingerichtet; dieses Werkzeug muss es
    // erfahren, sonst fragt es den Zustand nur beim Laden ab.
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents),
    // Seine eigenen Einstellungen stehen im Dialog der Huelle, nicht in einem
    // zweiten Dialog im Werkzeug.
    werkzeugEinstellungen: () => eingebettet.werkzeugEinstellungen(sicht.webContents as WebContents),
    setzeWerkzeugEinstellung: (feldId, wert) =>
      eingebettet.setzeWerkzeugEinstellung(sicht.webContents as WebContents, feldId, wert),
    werkzeugBefehl: (befehlId, wert) =>
      eingebettet.werkzeugBefehl(sicht.webContents as WebContents, befehlId, wert)
  };
}

async function montiereMapmaker(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = mountMapmaker({
    // Der Karteneditor hat keinen Hauptprozess; sein Vite-Build liegt direkt
    // in dist/, nicht in dist/renderer/ wie beim Story Creator.
    distDir: appDistDir(id),
    devServerUrl: process.env.MAPMAKER_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: haken.onLanguageChange
  });

  // Vor dem Laden: die Kopfzeile muss stehen, bevor die erste Antwort kommt.
  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      // Der Karteneditor liest seine Sprache beim Start aus seinem eigenen
      // Browserspeicher, bevor die Huelle ihm etwas sagen kann — anders als
      // beim Story Creator gibt es hier keine gemeinsam gelesene
      // Einstellungsdatei. Dieser Aufruf gleicht das nach jedem Laden an.
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    // Eine leere Karte unter einem gegebenen Namen — angestossen aus der
    // Inspirationshilfe, ueber die Huelle. Mehr geht bewusst nicht: eine
    // Karte aus Text zu zeichnen hiesse, sein Datenmodell von aussen zu
    // bedienen (siehe docs/inspirationshilfe.md).
    neueKarte: (name: string, notizen = []) =>
      eingebettet.neueKarte(sicht.webContents as WebContents, name, [...notizen])
  };
}

/**
 * Der Monster Creator.
 *
 * Er bekommt einen eigenen Datenordner, und das ist die Stelle, an der der
 * Encounter Creator spaeter ansetzt: dieselben Dateien, kein Kanal zwischen
 * den beiden Werkzeugen. Deshalb liegt der Ordner unter dem Datenordner
 * DIESES Werkzeugs und nicht irgendwo im Sitzungszustand.
 */
async function montiereMonster(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountMonster({
    distDir: appDistDir(id, 'main'),
    devServerUrl: process.env.MONSTER_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    datenordner: datenordner(id),
    // Die KI der Sammlung, wie ueberall. Ein eigener Zugang je Werkzeug waere
    // eine zweite Stelle, an der derselbe Schluessel liegt.
    kiQuelle: haken.kiQuelle,
    // Fuer den Haken „Eigene Zustaende einbauen".
    eigeneZustaende: leseEigeneZustaende,
    // „creature" gibt es in keiner Vorlage — ein Monster ist hier eine
    // Figur, und notfalls eine freie Notiz.
    anlegen: (titel, markdown) => legeNotizAn(titel, markdown, ['creature', 'character', 'note'], haken)
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents),
    // Die Suche der Huelle (Strg+K) springt hierher.
    zeigeEintrag: (kennung) =>
      eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

async function montiereEncounter(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountEncounter({
    distDir: appDistDir(id, 'main'),
    devServerUrl: process.env.ENCOUNTER_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    datenordner: datenordner(id),
    /*
     * Der Ordner des Monster Creators.
     *
     * Die Huelle kennt beide Werkzeuge und reicht den Pfad durch; keines
     * von beiden soll ueber das andere Bescheid wissen. Zweimal `monster`,
     * weil die Ablage im Datenordner des Werkzeugs noch einen Ordner
     * anlegt — dieselbe Stelle, an der die Suche lange danebengegriffen
     * hat.
     */
    monsterordner: join(datenordner('monster'), 'monster'),
    inDenTracker: (uebergabe) => haken.inDenTracker?.(uebergabe) ?? Promise.resolve(false)
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    // Die Suche der Huelle (Strg+K) springt hierher.
    zeigeEintrag: (kennung) =>
      eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
    // Die Gruppe am Tisch stellt man im Werkzeug selbst ein, nicht im
    // Dialog der Huelle: sie aendert sich von Abend zu Abend.
  };
}

/**
 * Das Nachschlagewerk.
 *
 * Kein Datenordner, noch nicht: der Bestand ist der offizielle und kommt aus
 * `@suite/srd`. Der Ordner kommt mit den Hausregeln.
 */
async function montiereNachschlagewerk(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountNachschlagewerk({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.NACHSCHLAGEWERK_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    // Eintraege aus dem Homebrew Creator, neben dem SRD (docs/homebrew-creator.md).
    homebrew: () => leseHomebrewFuerNachschlagewerk(app.getPath('userData'))
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    // Die Suche der Huelle (Strg+K) springt hierher — und das ist bei
    // diesem Werkzeug der haeufigste Weg hinein.
    zeigeEintrag: (kennung) =>
      eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

async function montiereZustaende(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountZustaende({
    distDir: appDistDir(id, 'main'),
    devServerUrl: process.env.ZUSTAENDE_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    datenordner: datenordner(id),
    // Die KI der Sammlung, wie ueberall. Ein eigener Zugang je Werkzeug waere
    // eine zweite Stelle, an der derselbe Schluessel liegt.
    kiQuelle: haken.kiQuelle,
    // Ein Zustand ist keine Figur und kein Ort — er ist eine Notiz.
    anlegen: (titel, markdown) => legeNotizAn(titel, markdown, ['note', 'event'], haken)
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents),
    // Die Suche der Huelle (Strg+K) springt hierher.
    zeigeEintrag: (kennung) =>
      eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

/** Der Magic Item Generator. Eine Ablage im eigenen Datenordner, sonst wie das Nachschlagewerk. */
async function montiereMagicItems(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountMagicItems({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.MAGICITEMS_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    onEreignis: haken.onEreignis,
    kiQuelle: haken.kiQuelle
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung),
    meldeKiWechsel: () => eingebettet.meldeKiWechsel(sicht.webContents as WebContents)
  };
}

/** Der Homebrew Creator (docs/homebrew-creator.md). Gebaut wie der Magic Item Generator, ohne KI. */
async function montiereHomebrew(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountHomebrew({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.HOMEBREW_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    onEreignis: haken.onEreignis,
    eigeneZustaende: async () =>
      (await leseZustaendeEintraege(app.getPath('userData'), sammlungssprache === 'de' ? 'de' : 'en')).map((e) => e.name),
    // Eine Sammlung magischer Gegenstände für Generator und Homebrew Creator.
    magieOrdner: join(datenordner('magicitems'), 'gegenstaende')
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

/**
 * Der Campaign Calendar (docs/kampagnenkalender.md). Nachrichten im Raum
 * fuehrt die Huelle selbst in die Ablage (index.ts, nimmRaumNachricht);
 * das offene Werkzeug laedt danach nur neu.
 */
async function montiereKalender(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountKalender({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.KALENDER_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    raum: haken.raum
      ? {
          sende: (inhalt, an) => haken.raum?.sende('kalender', inhalt, an) ?? false,
          lage: () => haken.raum?.anfang('kalender').lage ?? { rolle: 'aus', ich: null, personen: [] }
        }
      : undefined
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung),
    raumNachricht: () => eingebettet.raumNachricht(sicht.webContents as WebContents),
    raumZustand: (lage) => eingebettet.raumZustand(sicht.webContents as WebContents, lage)
  };
}

/** Der Settlement Generator (docs/ortsgenerator.md). Notizen wie die Inspirationshilfe. */
async function montiereOrte(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountOrte({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.ORTE_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    onEreignis: haken.onEreignis,
    kampagnen: () => zielKampagnen(haken.stelleStoryBereit),
    anlegen: (notizen, kampagneId, optionen) => legeNotizenAn(notizen, kampagneId, optionen, haken)
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

/** Der Loot Generator. Gebaut wie der Magic Item Generator. */
async function montiereLoot(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountLoot({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.LOOT_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    // Keine Vorlage kennt einen Typ fuer Gegenstaende; wer sich „item"
    // selbst angelegt hat, bekommt ihn, sonst wird es eine Notiz.
    anlegen: (titel, markdown) => legeNotizAn(titel, markdown, ['item', 'note'], haken),
    // Der Bestand des Magic Item Generators, gelesen wie fuer die Suche: die
    // beiden Werkzeuge kennen einander nicht, die Huelle kennt beide.
    gegenstaende: async () => [
      ...(await leseNamenUndSeltenheit(app.getPath('userData'))),
      ...(await leseHomebrewFuerLoot(app.getPath('userData'))),
      ...(await leseOrteFuerLoot(app.getPath('userData')))
    ]
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung)
  };
}

/** Alle Loot-Tabellen, wie der Loot Generator sie zeigt: eigene, SRD und die aus dem Magic Item Generator. */
async function alleLootTabellen(sprache: 'de' | 'en') {
  const datenordner = app.getPath('userData');
  // Dieselben Quellen wie im Loot Generator selbst (montiereLoot): sonst
  // fehlten im Bogen die Tabellen „Homebrew" und die der Läden.
  const [eigene, magie, homebrew, orte] = await Promise.all([
    leseTabellen(datenordner),
    leseNamenUndSeltenheit(datenordner),
    leseHomebrewFuerLoot(datenordner),
    leseOrteFuerLoot(datenordner)
  ]);
  return [...eigene, ...srdTabellen(sprache), ...gegenstandsTabellen([...magie, ...homebrew, ...orte], sprache)];
}

/** Der Charakterbogen. Gebaut wie der Loot Generator. */
async function montiereCharakterbogen(id: string, haken: MontageHaken): Promise<MontierteApp> {
  const eingebettet = await mountCharakterbogen({
    distDir: appDistDir(id, 'main'),
    datenordner: datenordner(id),
    devServerUrl: process.env.CHARAKTERBOGEN_DEV_SERVER_URL,
    language: haken.language,
    onLanguageChange: (language) => haken.onLanguageChange(language as Language),
    raum: haken.raum
      ? {
          sende: (inhalt, an) => haken.raum?.sende('charakterbogen', inhalt, an) ?? false,
          lage: () => haken.raum?.anfang('charakterbogen').lage ?? { rolle: 'aus', ich: null, personen: [] },
          merkeGruppe: (bogenId) => haken.raum?.merkeGruppe?.(bogenId),
          chatte: (text, an) => haken.raum?.chatte(text, an) ?? false
        }
      : undefined,
    tracker: (figuren, hinzufuegen) => haken.figurenAnTracker?.(figuren, hinzufuegen),
    story: {
      anlegen: (titel, markdown) => legeNotizAn(titel, markdown, ['character', 'npc', 'creature', 'note'], haken),
      oeffne: async (kennung) => {
        if (!(await storyNotizDa(kennung, haken))) return false;
        haken.zeigeInStory?.(kennung);
        return true;
      },
      aktualisiere: (kennung, block) => aktualisiereStoryNotiz(kennung, block, haken)
    },
    eigeneZustaende: async () => (await leseEigeneZustaende()).map((z) => ({ name: z.name, text: z.text })),
    nachschlagen: (kennung) => haken.zeigeImNachschlagewerk?.(kennung),
    // Quellen fuers Inventar aus anderen Werkzeugen. Die Werkzeuge kennen
    // einander nicht; die Huelle liest fuer den Charakterbogen mit.
    quellen: {
      magicitems: (sprache) => leseFuerInventar(app.getPath('userData'), sprache),
      homebrew: async (sprache) => [...(await leseHomebrewFuerInventar(app.getPath('userData'), sprache))],
      homebrewZauber: (sprache) => leseHomebrewZauber(app.getPath('userData'), sprache),
      lootTabellen: async (sprache) => (await alleLootTabellen(sprache)).map((x) => ({ id: x.id, name: x.name })),
      lootWuerfle: async (tabellenId, sprache) => {
        const alle = await alleLootTabellen(sprache);
        const tabelle = alle.find((x) => x.id === tabellenId);
        return tabelle ? wuerfleTabelle(tabelle, alle, Math.random).text : null;
      }
    }
  });

  setzeCsp(sitzung(id), eingebettet.csp);

  const sicht = new WebContentsView({
    webPreferences: {
      preload: eingebettet.preloadPath,
      partition: sitzung(id),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  sichereAb(sicht, eingebettet.devServerUrl);

  let geladen = false;
  return {
    id,
    sicht,
    nachladen: async () => {
      await lade(sicht, eingebettet);
      await eingebettet.setLanguage(sicht.webContents as WebContents, haken.language);
      geladen = true;
    },
    istGeladen: () => geladen,
    flush: () => eingebettet.flush(),
    setLanguage: (language) => eingebettet.setLanguage(sicht.webContents as WebContents, language),
    zeigeEintrag: (kennung) => eingebettet.zeigeEintrag(sicht.webContents as WebContents, kennung),
    // Boegen im Raum: Nachrichten und Lage.
    raumNachricht: (von, inhalt) => eingebettet.raumNachricht(sicht.webContents as WebContents, von, inhalt),
    raumZustand: (lage) => eingebettet.raumZustand(sicht.webContents as WebContents, lage),
    setzeTp: (kennung, hp, temp) => eingebettet.setzeTp(kennung, hp, temp)
  };
}
