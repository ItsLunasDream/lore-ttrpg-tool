/**
 * Hauptprozess der Huelle.
 *
 * Aufbau: ein rahmenloses `BaseWindow`. Darin liegt zuunterst die Ansicht mit
 * der Huelle selbst (Titelleiste, Startmenue, Schiene). Sie belegt das ganze
 * Fenster. Sobald ein Werkzeug eingebettet wird, kommt dessen Ansicht
 * *darueber* und laesst oben und links genau so viel frei, wie Titelleiste und
 * Schiene brauchen — die Huelle schaut also als L-Form darunter hervor.
 *
 * Warum so und nicht die Huelle in mehreren Ansichten: eine Ansicht ist immer
 * ein Rechteck. Eine L-Form liesse sich nur aus zwei Ansichten bauen, die dann
 * zwei getrennte Dokumente waeren und ihren Zustand ueber IPC abgleichen
 * muessten. Eine Ansicht, teilweise verdeckt, ist der einfachere Weg zum
 * gleichen Bild.
 *
 * In diesem Bauabschnitt wird noch keine Anwendung eingebettet; die Huelle
 * steht fuer sich. Die Aufteilung ist aber schon so angelegt, dass das
 * Einbetten spaeter nichts daran umstellt.
 */
// Zuerst: der Datenordner, bevor irgendetwas ihn erfragt.
import './datenordner';
import { app, BaseWindow, WebContentsView, dialog, clipboard, ipcMain, net, screen, shell, type IpcMainInvokeEvent, type WebContents } from 'electron';
/**
 * Startzeit messen, wenn TTRPG_TOOLS_STARTZEIT gesetzt ist.
 *
 * Gebaut, weil die Frage „warum dauert der Start so lange?\" von einem
 * Windows-Rechner kam und hier keiner steht. Geraten haette ich dabei mit
 * hoher Wahrscheinlichkeit daneben: hier unter Linux vergehen bis zum
 * Startmenue rund eine halbe Sekunde, und davon entfaellt fast nichts auf
 * den eigenen Code.
 *
 * Kostet im Normalfall nichts: ohne die Variable wird nur eine Zahl
 * abgelegt und nie wieder angesehen.
 */
const START_GEMESSEN = Boolean(process.env.TTRPG_TOOLS_STARTZEIT);
const startBeginn = Date.now() - Math.round(process.uptime() * 1000);
const startMarken: [string, number][] = [];

function startMarke(was: string): void {
  if (!START_GEMESSEN) return;
  startMarken.push([was, Date.now()]);
}

function startBericht(): void {
  if (!START_GEMESSEN || startMarken.length === 0) return;
  console.log('[shell] Startzeit:');
  let vorher = startBeginn;
  for (const [was, zeit] of startMarken) {
    console.log(`  ${String(zeit - vorher).padStart(6)} ms   ${was}`);
    vorher = zeit;
  }
  console.log(`  ${String(Date.now() - startBeginn).padStart(6)} ms   GESAMT`);
}
import { join } from 'node:path';
import { appendFileSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { berechneAppFlaeche, GROESSEN, VORGABE_GROESSE } from '../shared/apps';
import {
  meldeStoryCreatorAenderung,
  mountApp,
  setzeSammlungssprache,
  registerSchemes,
  setzeSuchtaste,
  setzeGroessentaste,
  type MontageHaken,
  type MontierteApp,
  type RaumLage
} from './apps';
import type { Wert } from '@suite/einstellungen';
import type { Uebergabe } from '@suite/uebergabe';
import { beobachteFarbe, gewaehlteGroesse, setzeGroesse, setzeThema as setzeFarbthema } from './farbe';
import { schreibeSicherung } from './sicherung';
import { alleEintraege } from './suche';
import {
  ankuenfte,
  konflikte,
  lesePaketDatei,
  nimmAn as nimmAustauschAn,
  schnuere,
  schreibePaket,
  teilbar,
  sendungsText,
  vorschau as austauschVorschau,
  zieleFuer
} from './austausch';
import { alsPaket, gastname, lesePaket, PaketFehler, PAKET_ENDUNG, type Modus, type Paket } from '@suite/austausch';
import { Raumdienst, type Raumereignis, type Raumzustand, type Tischschluessel } from './raum';
import { ladeTischschluessel, neueRaumId, Raumablage, VORGABE_RAUMEINSTELLUNGEN, type GespeicherterRaum } from './raeume';
import { sicherungsname } from '../shared/sicherung';
import { brichFahrtAb, fahreEin } from './fahrt';
import {
  DEFAULT_SETTINGS,
  ohneSchluessel,
  readSettings,
  writeSettings,
  type ShellSettings
} from './settings';
import { anbieterAus, entschluessle, verschluessle } from './ki';
import {
  leseSymbole,
  mitgelieferterOrdner,
  richteSymbolOrdnerEin,
  symbolOrdner
} from './symbole';
import { findeKiUebernahme } from './kiUebernahme';
import { translate } from '../shared/i18n';
import type { Language } from '../shared/i18n';
import {
  readWindowState,
  writeWindowState,
  writeWindowStateSync,
  MIN_WIDTH,
  MIN_HEIGHT,
  type WindowState
} from './windowState';

const devServerUrl = process.env.SHELL_DEV_SERVER_URL;

// Muss vor app.whenReady stehen: danach nimmt Electron keine Schemata mehr
// an, und die eingebetteten Anwendungen koennten ihre Bilder nicht liefern.
registerSchemes();

let fenster: BaseWindow | null = null;
let huelle: WebContentsView | null = null;
/**
 * Die bereits geoeffneten Anwendungen, nach ID.
 *
 * Sie bleiben geladen, wenn man wegwechselt, und werden nur unsichtbar
 * gestellt. Das ist der Grund, warum ein Wechsel nichts verliert: eine
 * halb getippte Notiz, die Scrollposition, ein offener Dialog stehen beim
 * Zurueckkommen noch da. Der Preis ist Arbeitsspeicher — gemessen rund
 * 130 MB je zusaetzlich geoeffneter Anwendung.
 */
const offen = new Map<string, MontierteApp>();
/**
 * Welche Anwendung gerade vorn liegt, oder `null` im Startmenue.
 *
 * Gebraucht, weil die Huelle sie zwischendurch verdecken muss: ihre Dialoge
 * liegen in *ihrer* Ansicht, und die liegt unter den Anwendungen. Ohne das
 * zeitweilige Verbergen stuende ein geoeffneter Dialog im DOM, waere aber
 * hinter der Anwendung nicht zu sehen.
 */
let aktiveApp: string | null = null;
let zustandsDatei = '';
let einstellungsDatei = '';
/**
 * Die Einstellungen, wie sie zuletzt auf der Platte standen.
 *
 * Gebraucht, weil die KI-Quelle synchron antworten muss: die eingebetteten
 * Anwendungen fragen sie mitten im Bearbeiten einer Anfrage, und dort auf
 * eine Datei zu warten waere eine Verzoegerung ohne Gegenwert. Geschrieben
 * wird weiterhin ueber `writeSettings`; hier steht nur die Kopie.
 */
let gemerkteEinstellungen: ShellSettings = DEFAULT_SETTINGS;
/** Zeitgeber, der das Speichern der Fensterlage buendelt. */
let speicherZeitgeber: NodeJS.Timeout | null = null;
/** Wird gesetzt, sobald die Anwendungen ihr Ungespeichertes gesichert haben. */
let darfSchliessen = false;
/**
 * Ob das System weniger Bewegung wuenscht.
 *
 * Der Hauptprozess kann `prefers-reduced-motion` nicht selbst lesen — das ist
 * eine Frage an die Darstellung, nicht an das Betriebssystem, und es gibt
 * dafuer keine Electron-API. Die Oberflaeche der Huelle fragt es ueber
 * `matchMedia` ab und meldet es hierher, beim Start und bei jeder Aenderung.
 * Bis die erste Meldung da ist, wird animiert; das ist die haeufigere
 * Einstellung, und die Huelle traegt in dieser Zeit ohnehin nur ihr
 * Startmenue.
 */
let wenigerBewegung = false;

/**
 * Legt die Huellenansicht auf die volle Fenstergroesse.
 *
 * Auch wenn eine Anwendung eingebettet ist, bleibt die Huelle so gross: sie
 * wird dann nur groesstenteils verdeckt. Dadurch bleibt ihr Layout stabil,
 * statt bei jedem Wechsel neu umzubrechen.
 */
function legeHuelleAus(): void {
  if (!fenster || !huelle) return;
  // Eine laufende Fahrt setzt gleich wieder ihre eigenen Bounds. Wird das
  // Fenster waehrenddessen umgestellt, muss sie weichen — sonst zoege die
  // Fahrt die Ansicht auf die alte Groesse zurueck.
  brichFahrtAb();
  const { width, height } = fenster.getContentBounds();
  huelle.setBounds({ x: 0, y: 0, width, height });

  // Die Anwendungen liegen darueber und lassen Titelleiste und Schiene frei.
  // Auch die unsichtbaren werden mitgelegt: sonst stuenden sie beim naechsten
  // Hervorholen in der Groesse von vorletzter Woche da und muessten erst
  // umbrechen.
  const flaeche = berechneAppFlaeche(width, height, gewaehlteGroesse());
  for (const montiert of offen.values()) {
    montiert.sicht.setBounds(flaeche);
  }
}

/**
 * Holt eine Anwendung nach vorn und laesst sie dabei einfahren.
 *
 * Die Fahrt gehoert zum Wechsel des Werkzeugs, nicht zu jedem
 * Sichtbarmachen: kommt eine Anwendung nach dem Schliessen eines Dialogs
 * zurueck, ist sie nicht *neu* da, und eine Bewegung waere dort nur Unruhe.
 */
function holeNachVorn(montiert: MontierteApp, mitFahrt: boolean): void {
  if (!fenster) return;
  legeHuelleAus();
  montiert.sicht.setVisible(true);
  if (mitFahrt) {
    const { width, height } = fenster.getContentBounds();
    fahreEin(montiert.sicht, berechneAppFlaeche(width, height, gewaehlteGroesse()), wenigerBewegung);
  }
  // Ohne das behielte die Huelle die Tastatur, und Tippen im Editor kaeme
  // nicht an.
  montiert.sicht.webContents.focus();
}

/**
 * Fragt jede offene Anwendung, ob geschlossen werden darf.
 *
 * Der Reihe nach und nicht nebenlaeufig: jede kann einen Dialog aufmachen,
 * und zwei gleichzeitig waeren nicht zu bedienen. Sagt eine nein, wird sofort
 * abgebrochen — die uebrigen werden dann gar nicht erst gefragt, sonst
 * beantwortete man Fragen zu einem Schliessen, das schon abgesagt ist.
 */
/**
 * Wer einen Raum mit Gaesten haelt, wird vor dem Beenden gefragt: sonst
 * fliegen alle ohne Vorwarnung raus (Testbericht).
 */
function darfRaumSchliessen(): boolean {
  const z = raumDienst?.zustand();
  if (!fenster || !z || z.rolle !== 'gastgeber' || z.personen.length <= 1) return true;
  const de = gemerkteEinstellungen.language === 'de';
  const wahl = dialog.showMessageBoxSync(fenster, {
    type: 'question',
    buttons: de ? ['Raum schließen und beenden', 'Abbrechen'] : ['Close room and quit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: de ? 'Du hältst einen Raum mit Gästen.' : 'You are hosting a room with guests.',
    detail: de ? 'Beim Beenden fliegen alle aus dem Raum.' : 'Quitting removes everyone from the room.'
  });
  return wahl === 0;
}

async function frageAlleVorDemSchliessen(): Promise<boolean> {
  if (!darfRaumSchliessen()) return false;
  for (const montiert of offen.values()) {
    if (!montiert.darfSchliessen) {
      await montiert.flush();
      continue;
    }
    // Die fragende Anwendung nach vorn holen, sonst zeigt der Dialog auf ein
    // Werkzeug, das gar nicht zu sehen ist.
    if (fenster && montiert.id !== aktiveApp) {
      verbergeAlle();
      aktiveApp = montiert.id;
      holeNachVorn(montiert, false);
    }
    if (!fenster) return true;
    if (!(await montiert.darfSchliessen(fenster))) return false;
  }
  return true;
}

function merkeFensterlage(): void {
  if (!fenster) return;
  if (speicherZeitgeber) clearTimeout(speicherZeitgeber);
  // Beim Ziehen feuert `resize` dutzendfach pro Sekunde. Ungebuendelt
  // schriebe das die Datei staendig neu.
  speicherZeitgeber = setTimeout(() => {
    const zustand = aktuelleLage();
    if (zustand) void writeWindowState(zustandsDatei, zustand);
  }, 400);
}

/** Stellt alle eingebetteten Anwendungen unsichtbar. */
function verbergeAlle(): void {
  for (const montiert of offen.values()) {
    montiert.sicht.setVisible(false);
  }
}

/**
 * Was eine Anwendung beim Montieren braucht: die aktuelle Sammlungssprache,
 * und einen Weg, eine eigene Aenderung zu melden.
 *
 * `herkunft` ist die ID der Anwendung selbst — kommt eine Aenderung von dort
 * zurueck, muss sie nicht noch einmal informiert werden.
 */
/**
 * Sagt allen offenen Werkzeugen, dass sich die KI-Einstellung geaendert hat.
 *
 * Auch dem, in dem gerade gearbeitet wird: anders als bei der Sprache gibt es
 * hier keine "Ursprungs"-Anwendung, die schon Bescheid wuesste — eingestellt
 * wird die KI immer in der Huelle.
 */
/** Die Anwendung meldet, wo sie steht. Die Oberflaeche fuehrt den Verlauf. */
/**
 * Was zuletzt geoeffnet war, neueste zuerst — fuer „Zuletzt geoeffnet" im
 * Dialog Teilen. Nur Sitzungszustand, wie der Verlauf selbst.
 */
const zuletztGeoeffnet: { werkzeug: string; ort: string }[] = [];

function meldeOrt(appId: string, ort: string | null): void {
  huelle?.webContents.send('verlauf:ort', appId, ort);
  if (ort && ort !== 'entwurf') {
    const alt = zuletztGeoeffnet.findIndex((z) => z.werkzeug === appId && z.ort === ort);
    if (alt >= 0) zuletztGeoeffnet.splice(alt, 1);
    zuletztGeoeffnet.unshift({ werkzeug: appId, ort });
    zuletztGeoeffnet.length = Math.min(zuletztGeoeffnet.length, 30);
  }
}

/**
 * Zurueck oder vorwaerts an die Oberflaeche der Huelle.
 *
 * Mit Sperrfrist, weil dieselbe Geste auf zwei Wegen ankommen kann: als
 * `app-command` am Fenster und als Maustaste im Dokument der Ansicht (siehe
 * unten). Welcher Weg traegt, haengt am System — und wo beide tragen, waere
 * ein Druck sonst zwei Schritte im Verlauf.
 */
let letzterVerlaufsbefehl = 0;
const VERLAUF_SPERRE_MS = 300;

/**
 * Ein Protokoll fuer die Daumentasten, wenn TTRPG_TOOLS_TASTEN_LOG gesetzt ist.
 *
 * Es gibt Geraete und Systeme, auf denen die Seitentasten nicht dort
 * ankommen, wo man es erwartet — und von hier aus laesst sich das nicht
 * nachstellen: dieser Rechner hat keine Maus mit Seitentasten, und was unter
 * Windows passiert, ist eine Vermutung, solange es niemand misst.
 *
 * Deshalb schreibt die Huelle auf Wunsch mit, WAS ankommt und WOHER. Eine
 * Zeile je Signal, in `maustasten.log` im Datenordner. Wer den Fehler
 * meldet, schickt die Datei mit, und aus dem Raten wird ein Befund.
 *
 * Standardmaessig aus: im Normalbetrieb will niemand eine Datei, die bei
 * jedem Klick waechst.
 */
const tastenProtokoll = process.env.TTRPG_TOOLS_TASTEN_LOG === '1';
let protokollDatei = '';

function protokolliere(zeile: string): void {
  if (!tastenProtokoll) return;
  try {
    appendFileSync(protokollDatei, `${new Date().toISOString()} ${zeile}\n`, 'utf8');
  } catch {
    // Ein Protokoll, das sich nicht schreiben laesst, darf nichts kaputt
    // machen. Es ist eine Diagnosehilfe, kein Teil des Betriebs.
  }
}

function meldeVerlauf(richtung: 'zurueck' | 'vorwaerts', woher = '?'): void {
  const jetzt = Date.now();
  if (jetzt - letzterVerlaufsbefehl < VERLAUF_SPERRE_MS) {
    protokolliere(`verworfen (Sperrfrist)  ${richtung}  ${woher}`);
    return;
  }
  letzterVerlaufsbefehl = jetzt;
  protokolliere(`ausgefuehrt             ${richtung}  ${woher}`);
  huelle?.webContents.send('verlauf:befehl', richtung);
}

/**
 * Das Thema an alle Ansichten — die der Huelle eingeschlossen.
 *
 * Ein Weg und nicht zwei: die Huelle faerbte sich anfangs selbst im
 * Renderer, und das ging schief, sobald die Einstellung von woanders kam
 * (aus einem Skript, aus dem Rauchtest). Jetzt bekommt sie dieselbe
 * eingespritzte Regel wie jedes Werkzeug, und die Oberflaeche erfaehrt nur
 * noch die Kennung fuer ihren Waehler.
 */
async function verteileThema(themaId: string): Promise<void> {
  await setzeFarbthema(themaId);
  huelle?.webContents.send('einstellungen:thema-extern', themaId);
}

function meldeKiWechsel(): void {
  for (const montiert of offen.values()) montiert.meldeKiWechsel?.();
}

/**
 * Ein Kartenname, der auf den Karteneditor wartet.
 *
 * Die Inspirationshilfe stoesst „Karte anlegen" an; der Karteneditor muss
 * dafuer erst montiert, geladen und sichtbar sein. Bis dahin liegt der Name
 * hier. Zugestellt wird er am Ende von `app:zeigen` — und danach vergessen,
 * damit der naechste Wechsel von Hand nicht noch einmal eine leere Karte
 * beginnt.
 */
let wartendeKarte: { name: string; notizen: readonly { title: string; text: string }[] } | null =
  null;

/**
 * Holt den Karteneditor nach vorn und beginnt dort eine leere Karte.
 *
 * Der Wechsel laeuft ueber die Oberflaeche der Huelle und nicht am
 * Hauptprozess vorbei: nur sie kennt ihren Verlauf, ihre Schiene und die
 * Animation. Ohne das saehe man die Ansicht wechseln, waehrend die Schiene
 * weiter das alte Werkzeug markiert.
 */
/**
 * Dasselbe fuer den Weg in den Initiative Tracker.
 *
 * Der Encounter Creator schiebt eine Begegnung hinueber; der Tracker muss
 * dafuer erst montiert, geladen und sichtbar sein. Bis dahin liegt sie
 * hier — wie der Kartenname darueber, aus demselben Grund und mit
 * derselben Regel: nach dem Zustellen vergessen, damit der naechste
 * Wechsel von Hand nicht dieselbe Begegnung noch einmal hereinschiebt.
 */
let wartendeBegegnung: Uebergabe | null = null;

/**
 * Holt den Tracker nach vorn und stellt ihm eine Begegnung zu.
 *
 * Was dort damit geschieht, entscheidet er selbst: seine Oberflaeche
 * fragt erst dieselbe Frage wie bei „Neue Begegnung". Von hier aus wird
 * nichts weggeworfen.
 */
async function oeffneBegegnungImTracker(uebergabe: Uebergabe): Promise<boolean> {
  if (!huelle) return false;
  wartendeBegegnung = uebergabe;
  huelle.webContents.send('app:oeffne', 'initiative');

  // Steht er schon vorn, kommt kein Wechsel mehr — dann jetzt zustellen.
  if (aktiveApp === 'initiative') {
    const montiert = offen.get('initiative');
    if (montiert?.uebernimmBegegnung && montiert.istGeladen()) {
      await montiert.uebernimmBegegnung(uebergabe);
      wartendeBegegnung = null;
    }
  }
  return true;
}

async function oeffneKarteImEditor(
  name: string,
  notizen: readonly { title: string; text: string }[] = []
): Promise<boolean> {
  const sauber = name.trim();
  if (!sauber || !huelle) return false;
  wartendeKarte = { name: sauber, notizen };
  huelle.webContents.send('app:oeffne', 'mapmaker');

  // Steht er schon vorn, kommt kein Wechsel mehr — dann jetzt zustellen.
  if (aktiveApp === 'mapmaker') {
    const montiert = offen.get('mapmaker');
    if (montiert?.neueKarte && montiert.istGeladen()) {
      montiert.neueKarte(sauber, notizen);
      wartendeKarte = null;
    }
  }
  return true;
}

/**
 * Der Raum im lokalen Netz (Austausch, Stufe 2). Modulweit, weil ihn neben
 * den IPC-Kanaelen auch die Werkzeuge erreichen (geteilte Initiative).
 * Angelegt wird er beim Einrichten der Kanaele.
 */
let raumDienst: Raumdienst | null = null;
/**
 * Der zuletzt geteilte Stand je Person, fuer ein Werkzeug, das erst spaeter
 * aufgeht: der Tracker soll den geteilten Kampf sofort zeigen und nicht erst
 * nach der naechsten Aenderung.
 */
const geteilteStaende = new Map<string, { von: { id: string; name: string }; inhalt: string }>();

/** Beim Gastgeber eines gespeicherten Raums: was die Werkzeuge davon wissen muessen. */
let raumZusatz: Pick<RaumLage, 'einstellungen' | 'gruppeninventar'> = {};
/** Setzt die Einrichtung des Raums (siehe unten); bis dahin geschieht nichts. */
let merkeGruppeImRaum: (id: string) => void = () => undefined;

function raumLage(): RaumLage {
  const z = raumDienst?.zustand();
  if (!z) return { rolle: 'aus', ich: null, personen: [] };
  return { rolle: z.rolle, ich: z.ich, personen: z.personen, ...(z.rolle === 'gastgeber' ? raumZusatz : {}) };
}

/** Die Lage an alle offenen Werkzeuge. */
function meldeRaumLage(): void {
  const lage = raumLage();
  for (const montiert of offen.values()) montiert.raumZustand?.(lage);
}

/**
 * Montiert ein Werkzeug, ohne es zu zeigen. Es steht danach in `offen`
 * wie jedes andere; geladen wird seine Oberflaeche erst beim ersten Zeigen.
 */
async function montiereImHintergrund(id: string): Promise<void> {
  if (offen.has(id) || !fenster) return;
  const einstellungen = await readSettings(einstellungsDatei);
  const montiert = await mountApp(id, montageHaken(id, einstellungen.language));
  if (!montiert || offen.has(id)) return;
  offen.set(id, montiert);
  beobachteFarbe(montiert.sicht.webContents as WebContents);
  montiert.sicht.setVisible(false);
  fenster.contentView.addChildView(montiert.sicht);
}

function montageHaken(herkunft: string, sprache: Language): MontageHaken {
  return {
    language: sprache,
    onLanguageChange: (language) => void aktualisiereSammlungssprache(language, herkunft),
    // Meldet der Oberflaeche, dass sich in einer ANDEREN Anwendung etwas
    // getan hat. Die Huelle laesst dann eine Farbe ueber deren Symbol
    // wischen — einheitlich fuer alle Werkzeuge, gleich wer es ausloest.
    onEreignis: (appId) => huelle?.webContents.send('app:ereignis', appId),
    stelleStoryBereit: () => montiereImHintergrund('backstory'),
    onOrt: (ort) => meldeOrt(herkunft, ort),
    raum: {
      sende: (werkzeug, inhalt, an) => raumDienst?.sendeWerkzeug(werkzeug, inhalt, an) ?? false,
      chatte: (text, an) => raumDienst?.chatte(text, an) ?? false,
      merkeGruppe: (id) => merkeGruppeImRaum(id),
      anfang: (werkzeug) => ({
        lage: raumLage(),
        nachrichten: werkzeug === 'initiative' ? [...geteilteStaende.values()] : []
      })
    },
    // Die KI wird einmal in der Huelle eingerichtet und hier durchgereicht.
    // Bei jedem Aufruf frisch gelesen: wer sie umstellt, soll das im
    // naechsten Klick merken und nicht erst nach einem Neustart.
    kiQuelle: () => ({
      einstellungen: gemerkteEinstellungen.ki,
      schluessel: entschluessle(gemerkteEinstellungen.claudeSchluessel)
    }),
    oeffneKarte: oeffneKarteImEditor,
    inDenTracker: oeffneBegegnungImTracker
  };
}

/**
 * Die eine Stelle, an der die Sprache der Sammlung geaendert wird.
 *
 * Gerufen wird sie aus zwei Richtungen: wenn jemand sie in den Einstellungen
 * der Huelle umstellt, und wenn eine der eingebetteten Anwendungen sie ueber
 * ihr eigenes Sprachmenue umstellt. Beide Richtungen laufen hier zusammen und
 * fuehren zu demselben Ergebnis — genau das war die Anforderung: eine
 * Aenderung an irgendeiner Stelle soll ueberall ankommen.
 *
 * `herkunft` bekommt die Aenderung nicht noch einmal geschickt: sie weiss es
 * ja schon, sie hat sie ausgeloest. Fuer die Huelle selbst (Aenderung im
 * Einstellungen-Dialog) ist das `null` — dort gibt es keine `offen`-Anwendung,
 * die sich selbst meldet.
 */
async function aktualisiereSammlungssprache(language: Language, herkunft: string | null): Promise<void> {
  const aktuell = await readSettings(einstellungsDatei);
  if (aktuell.language === language) return;
  gemerkteEinstellungen = { ...aktuell, language };
  await writeSettings(einstellungsDatei, gemerkteEinstellungen);
  setzeSammlungssprache(language);

  // Die Oberflaeche der Huelle selbst (Titelleiste, Startmenue, Schiene, die
  // Einstellungen, falls sie gerade offen sind) muss ebenfalls nachziehen.
  huelle?.webContents.send('einstellungen:sprache-extern', language);

  for (const [id, montiert] of offen) {
    if (id === herkunft) continue;
    void montiert.setLanguage?.(language);
  }
}

/** Die Lage, wie sie gemerkt werden soll — oder `null`, wenn kein Fenster da ist. */
function aktuelleLage(): WindowState | null {
  if (!fenster) return null;
  const maximized = fenster.isMaximized();
  // Im maximierten Zustand die normale Groesse behalten, sonst startet das
  // Fenster nach dem Wiederherstellen bildschirmfuellend "klein".
  const bounds = maximized ? fenster.getNormalBounds() : fenster.getBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized };
}

async function erzeugeFenster(): Promise<void> {
  zustandsDatei = join(app.getPath('userData'), 'fenster.json');
  const zustand = await readWindowState(
    zustandsDatei,
    screen.getAllDisplays().map((d) => d.workArea)
  );

  fenster = new BaseWindow({
    x: zustand.x,
    y: zustand.y,
    width: zustand.width,
    height: zustand.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    backgroundColor: '#14161c',
    show: false,
    title: 'LORE'
  });

  huelle = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  /*
   * Die Daumentasten der Maus, Weg 1 von 2.
   *
   * Das Fenster meldet sie als `app-command`, unabhaengig davon, welche
   * Ansicht den Fokus hat. Nachgemessen (Linux, X11, echte Tastenereignisse
   * in genau diesen Aufbau): der Weg traegt dort auch dann, wenn der Zeiger
   * ueber der eingebetteten Ansicht liegt.
   *
   * Verlassen kann man sich darauf trotzdem nicht. Unter Windows greift
   * Chromium die Seitentasten in der Ansicht selbst ab und macht daraus
   * „zurueck" fuer DIESE Ansicht — die hat keinen Verlauf, es passiert
   * nichts, und die Meldung kommt hier nie an. Genau so wurde es berichtet.
   * Deshalb gibt es Weg 2: die Preloads der Werkzeuge hoeren die Taste im
   * Dokument und melden sie unten ueber `huelle:verlauf-taste`.
   *
   * Beide Wege enden in `meldeVerlauf`, und das hat eine Sperrfrist — wo
   * beide tragen, soll ein Druck ein Schritt bleiben.
   */
  fenster.on('app-command', (_ereignis: unknown, befehl: string) => {
    protokolliere(`app-command am Fenster: ${befehl}`);
    if (befehl === 'browser-backward') meldeVerlauf('zurueck', 'app-command');
    else if (befehl === 'browser-forward') meldeVerlauf('vorwaerts', 'app-command');
  });

  fenster.contentView.addChildView(huelle);
  legeHuelleAus();

  // Die Huelle laedt nur ihr eigenes Dokument. Alles andere — ein Link in
  // einem Text, ein umgeleiteter Aufruf — verlaesst die Anwendung und gehoert
  // in den Browser des Systems, nicht in dieses Fenster.
  huelle.webContents.on('will-navigate', (event, url) => {
    if (devServerUrl && url.startsWith(devServerUrl)) return;
    event.preventDefault();
    const ziel = new URL(url);
    if (ziel.protocol === 'http:' || ziel.protocol === 'https:') void shell.openExternal(ziel.href);
  });
  huelle.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Anmelden statt faerben: gefaerbt wird bei `dom-ready`, und das kommt
  // gleich. Vor dem Laden einzuspritzen haelt den Start an — siehe farbe.ts.
  await setzeFarbthema(gemerkteEinstellungen.thema);
  setzeGroesse(gemerkteEinstellungen.groesse);
  beobachteFarbe(huelle.webContents as WebContents);

  if (devServerUrl) {
    await huelle.webContents.loadURL(devServerUrl);
  } else {
    await huelle.webContents.loadFile(join(__dirname, '../renderer/index.html'));
  }

  fenster.on('resize', () => {
    legeHuelleAus();
    merkeFensterlage();
  });
  fenster.on('move', merkeFensterlage);
  fenster.on('maximize', () => {
    merkeFensterlage();
    huelle?.webContents.send('fenster:zustand', { maximiert: true });
  });
  fenster.on('unmaximize', () => {
    merkeFensterlage();
    huelle?.webContents.send('fenster:zustand', { maximiert: false });
  });
  // `window-all-closed` feuert fuer BrowserWindow. Diese Huelle benutzt ein
  // BaseWindow, deshalb wird das Beenden hier von Hand ausgeloest — sonst
  // laeuft der Prozess nach dem Schliessen unsichtbar weiter.
  // Beim Schliessen ein letztes Mal, und zwar blockierend: ein noch
  // ausstehender Zeitgeber kaeme nach dem Ende des Prozesses nicht mehr zum
  // Zug. Ohne das ginge die Lage verloren, wenn jemand das Fenster zieht und
  // sofort schliesst — oder es nie bewegt und trotzdem eine Lage erwartet.
  fenster.on('close', (event: Electron.Event) => {
    if (speicherZeitgeber) clearTimeout(speicherZeitgeber);
    const zustand = aktuelleLage();
    if (zustand) writeWindowStateSync(zustandsDatei, zustand);

    // Den eingebetteten Anwendungen Gelegenheit geben, Ungespeichertes zu
    // sichern. Das geht nur asynchron, das Schliessen wird deshalb einmal
    // aufgehalten und danach wiederholt. `darfSchliessen` verhindert, dass
    // sich das im Kreis dreht.
    if (darfSchliessen) return;
    if (offen.size === 0) {
      if (!darfRaumSchliessen()) event.preventDefault();
      return;
    }
    event.preventDefault();
    void frageAlleVorDemSchliessen().then((erlaubt) => {
      // Abgebrochen: das Fenster bleibt offen, und `darfSchliessen` bleibt
      // falsch, damit der naechste Versuch wieder fragt.
      if (!erlaubt) return;
      darfSchliessen = true;
      fenster?.close();
    });
  });

  fenster.on('closed', () => {
    fenster = null;
    huelle = null;
    if (process.platform !== 'darwin') app.quit();
  });

  if (zustand.maximized) fenster.maximize();
  fenster.show();

  await starteMitWerkzeug();
}

/**
 * Zeile, mit der die Startfolge meldet, dass das vorgeoeffnete Werkzeug steht.
 * Wird von apps/shell/scripts/verify-package.mjs gelesen — wer sie aendert,
 * aendert sie dort mit.
 */
const BEREIT_MARKE = '[shell] bereit-mit';

/**
 * Oeffnet beim Start gleich ein Werkzeug, wenn TTRPG_TOOLS_START_APP eine ID
 * nennt.
 *
 * Gedacht fuer zweierlei: eine Verknuepfung, die direkt in einem bestimmten
 * Werkzeug landet — und die Pruefung des gepackten Pakets, die sonst nur
 * feststellen koennte, dass die Huelle hochkommt. Ob die Anwendungen darin
 * *auch* laden, haengt an Pfaden, die im Paket anders sind als im Workspace;
 * ohne diesen Weg klickt dort niemand auf eine Kachel, und ein falscher Pfad
 * zeigte sich erst der Person, die das Paket benutzt.
 */
async function starteMitWerkzeug(): Promise<void> {
  const id = process.env.TTRPG_TOOLS_START_APP;
  if (!id || !fenster) return;

  const einstellungen = await readSettings(einstellungsDatei);
  const montiert = await mountApp(id, montageHaken(id, einstellungen.language));
  if (!montiert) {
    console.error(`[shell] Unbekanntes Werkzeug in TTRPG_TOOLS_START_APP: ${id}`);
    return;
  }
  beobachteFarbe(montiert.sicht.webContents as WebContents);
  await montiert.nachladen();
  offen.set(id, montiert);
  aktiveApp = id;
  fenster.contentView.addChildView(montiert.sicht);
  // Ohne Fahrt: hier wird nicht gewechselt, hier faengt alles an. Eine
  // Bewegung beim allerersten Bild sieht nach Ladehemmung aus.
  holeNachVorn(montiert, false);
  huelle?.webContents.send('app:gestartet-mit', id);
  // Erst hier ist das Werkzeug wirklich geladen und sichtbar — `mountApp`
  // wartet auf `loadFile`. Die Pruefung des gepackten Pakets beendet den
  // Prozess, sobald sie ihr Signal sieht; nimmt sie ein frueheres (die
  // Einstellungsdatei, spaeter der Speicherort des Werkzeugs), trifft sie
  // mitten ins Laden, und `loadFile` bricht mit ERR_FAILED ab. Zweimal
  // dieselbe Falle, beim zweiten Mal nur eine Stufe spaeter. Ein Signal muss
  // *nach* dem stehen, was es bezeugt.
  console.log(`${BEREIT_MARKE} ${id}`);
}

/**
 * Die Fassung dieser Anwendung.
 *
 * Nicht `app.getVersion()`: das liefert ausserhalb eines gepackten Pakets die
 * Fassung von Electron, nicht die eigene — in der Entwicklung stand deshalb
 * „Fassung 33.4.11" im Startmenue. Gelesen wird die package.json, die
 * electron-builder ohnehin mit ins Paket legt.
 */
function eigeneFassung(): string {
  try {
    const datei = join(__dirname, '..', '..', 'package.json');
    const inhalt = JSON.parse(readFileSync(datei, 'utf8')) as { version?: string };
    return inhalt.version ?? app.getVersion();
  } catch {
    return app.getVersion();
  }
}

/** Registriert einen Kanal und faengt Fehler ab, statt sie zum Renderer zu werfen. */
function handle<T>(kanal: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => T | Promise<T>): void {
  ipcMain.handle(kanal, async (event, ...args) => fn(event, ...args));
}

/**
 * Was aus `app:zeigen` zurueckkommt.
 *
 * Bewusst kein `boolean` mehr: „falsch" beantwortete zwei ganz verschiedene
 * Fragen — „dieses Werkzeug gibt es noch nicht" und „es ist kaputt" — und
 * die Oberflaeche zeigte fuer beide denselben Platzhalter.
 */
export type ZeigenErgebnis =
  | { zustand: 'offen' }
  | { zustand: 'nicht-einbettbar' }
  | { zustand: 'fehler'; grund: 'dateien-fehlen' | 'sonst'; detail: string };

/** Warum ein Paket nicht lesbar war, in der Sprache der Oberflaeche. */
function paketGrund(fehler: unknown): string {
  if (fehler instanceof PaketFehler) return fehler.text(gemerkteEinstellungen?.language === 'de' ? 'de' : 'en');
  return fehler instanceof Error ? fehler.message : String(fehler);
}

/** Uebersetzt einen Montagefehler in etwas, das die Oberflaeche zeigen kann. */
function fehlerErgebnis(fehler: unknown): ZeigenErgebnis {
  const text = fehler instanceof Error ? fehler.message : String(fehler);
  console.error('[shell] Werkzeug liess sich nicht montieren:', fehler);
  // ERR_FILE_NOT_FOUND heisst hier immer dasselbe: die Anwendung wurde nicht
  // gebaut. Das ist der eine Fall, zu dem sich etwas Hilfreiches sagen laesst.
  const dateienFehlen = text.includes('ERR_FILE_NOT_FOUND') || text.includes('ENOENT');
  return { zustand: 'fehler', grund: dateienFehlen ? 'dateien-fehlen' : 'sonst', detail: text };
}

function registriereKanaele(): void {
  handle('fenster:minimieren', () => {
    fenster?.minimize();
  });
  handle('fenster:maximieren-umschalten', () => {
    if (!fenster) return false;
    if (fenster.isMaximized()) fenster.unmaximize();
    else fenster.maximize();
    return fenster.isMaximized();
  });
  handle('fenster:schliessen', () => {
    fenster?.close();
  });
  handle('fenster:ist-maximiert', () => fenster?.isMaximized() ?? false);
  handle('app:version', () => eigeneFassung());

  handle('einstellungen:lesen', async () => ohneSchluessel(await readSettings(einstellungsDatei)));

  /**
   * Eigene Symbole, als data:-URL je Kennung.
   *
   * Bei jedem Aufruf frisch von der Platte: wer ein Bild austauscht, drueckt
   * in den Einstellungen auf "neu laden" und will es dann auch sehen.
   */
  handle('symbole:lesen', () =>
    leseSymbole(
      app.getPath('userData'),
      // Die mitgelieferten zuerst, die eigenen stechen sie.
      mitgelieferterOrdner(app.isPackaged, process.resourcesPath)
    )
  );

  /** Oeffnet den Symbolordner im Dateimanager des Systems. */
  handle('symbole:ordner', async () => {
    const ordner = symbolOrdner(app.getPath('userData'));
    // Anlegen, falls ihn jemand geloescht hat — sonst oeffnet sich nichts
    // und es sieht aus, als sei der Knopf kaputt.
    await richteSymbolOrdnerEin(app.getPath('userData'));
    await shell.openPath(ordner);
    return ordner;
  });
  /**
   * Schreibt die Einstellungen und gibt zurueck, was danach gilt.
   *
   * Die Antwort ist nicht die Eingabe: `writeSettings` raeumt ungueltige
   * Werte weg, und die Oberflaeche soll den bereinigten Stand anzeigen statt
   * eines, den es so nicht gibt.
   */
  handle('einstellungen:schreiben', async (_event, neu: Partial<ShellSettings>) => {
    const vorher = await readSettings(einstellungsDatei);
    // Zusammengefuehrt, nicht ersetzt: die Oberflaeche schickt nur, was sie
    // geaendert hat. Wuerde das als ganze Einstellungsdatei gelten, raeumte
    // ein Sprachwechsel die KI-Einstellung weg.
    //
    // Der Schluessel kommt dabei immer aus dem Bestand, nie aus der
    // Oberflaeche: sie bekommt ihn nicht zu sehen und wuerde ihn sonst mit
    // einem leeren Feld ueberschreiben.
    await writeSettings(einstellungsDatei, {
      ...vorher,
      ...neu,
      claudeSchluessel: vorher.claudeSchluessel
    });
    const aktualisiert = await readSettings(einstellungsDatei);
    gemerkteEinstellungen = aktualisiert;
    // Die Werkzeuge fragen den KI-Zustand nur beim Laden ab. Aendert sich die
    // Einstellung hier, muessen sie es erfahren — sonst sieht man den
    // Assistenten weiter, obwohl die KI aus ist, und die Knoepfe im NPC
    // Creator fehlen, obwohl sie an ist.
    if (JSON.stringify(aktualisiert.ki) !== JSON.stringify(vorher.ki)) meldeKiWechsel();
    // Die Sprache hier zu aendern ist der Weg ueber den Einstellungen-Dialog
    // der Huelle; es gibt keine "Ursprungs"-Anwendung, die schon Bescheid
    // weiss, deshalb bekommen alle offenen Anwendungen die Meldung.
    if (aktualisiert.language !== vorher.language) {
      setzeSammlungssprache(aktualisiert.language);
      for (const montiert of offen.values()) void montiert.setLanguage?.(aktualisiert.language);
    }
    // Das Thema gilt fuer das ganze Fenster. Die Huelle faerbt sich selbst
    // (sie hat die Einstellungen ja gerade geschrieben); die Werkzeuge
    // bekommen die Regel eingespritzt, siehe farbe.ts.
    if (aktualisiert.thema !== vorher.thema) {
      void verteileThema(aktualisiert.thema);
    }
    // Die Groesse ebenso; dazu rutschen die Werkzeuge an die neue Kante von
    // Titelleiste und Schiene.
    if (aktualisiert.groesse !== vorher.groesse) {
      setzeGroesse(aktualisiert.groesse);
      legeHuelleAus();
    }
    return ohneSchluessel(aktualisiert);
  });

  /*
   * Die Einstellungen der einzelnen Werkzeuge.
   *
   * Die Huelle kennt sie nicht und soll sie nicht kennen. Sie fragt das
   * Werkzeug, was es einzustellen gibt, malt das in ihren eigenen Dialog und
   * schickt Aenderungen zurueck. Ein Werkzeug ohne eigene Einstellungen
   * liefert `null`, und der Dialog laesst den Abschnitt dann weg.
   *
   * Nur montierte Werkzeuge antworten: was noch nie offen war, hat auch noch
   * keine Einstellungen geladen. Der Dialog fragt deshalb genau die ab, die
   * gerade laufen.
   */
  handle('werkzeug:einstellungen', async (_event, appId: string) => {
    const montiert = offen.get(appId);
    return (await montiert?.werkzeugEinstellungen?.()) ?? null;
  });

  handle(
    'werkzeug:einstellung-setzen',
    async (_event, appId: string, feldId: string, wert: Wert) => {
      const montiert = offen.get(appId);
      return (await montiert?.setzeWerkzeugEinstellung?.(feldId, wert)) ?? null;
    }
  );

  handle(
    'werkzeug:einstellung-befehl',
    async (_event, appId: string, befehlId: string, wert?: string) => {
      const montiert = offen.get(appId);
      return (await montiert?.werkzeugBefehl?.(befehlId, wert)) ?? null;
    }
  );

  /**
   * Was alle Werkzeuge abgelegt haben — fuer die Suche mit Strg+K.
   *
   * Bei jedem Oeffnen frisch von der Platte. Siehe suche.ts, warum kein
   * Verzeichnis gefuehrt wird.
   */
  handle('suche:eintraege', () =>
    alleEintraege(app.getPath('userData'), gemerkteEinstellungen.language === 'de' ? 'de' : 'en')
  );

  /*
   * Der Austausch (docs/austausch.md, Stufe 1): weitergeben als Paketdatei,
   * einlesen aus einer. Das eingelesene Paket bleibt hier im Hauptprozess,
   * bis angenommen ist; die Oberflaeche bekommt nur, was sie zum Entscheiden
   * braucht, nicht die Bilder.
   *
   * Der optionale Dateipfad ist fuer den Rauchtest: ein Dateidialog laesst
   * sich dort nicht bedienen.
   */
  let eingang: Paket | null = null;

  handle('austausch:teilbar', () =>
    teilbar(app.getPath('userData'), gemerkteEinstellungen.language === 'de' ? 'de' : 'en')
  );
  handle('austausch:vorschau', (_event, werkzeug: string, kennung: string) =>
    austauschVorschau(
      app.getPath('userData'),
      String(werkzeug),
      String(kennung),
      gemerkteEinstellungen?.language === 'de' ? 'de' : 'en'
    )
  );
  // Der Text einer angekommenen Sendung, bevor sie angenommen ist: kurz fuer
  // die Vorschau, lang fuer das Fenster.
  handle('austausch:ankunftText', (_event, nummer: number, voll: boolean) => {
    const sendung = eingang?.sendungen[Number(nummer)];
    if (!sendung) return '';
    return sendungsText(sendung, gemerkteEinstellungen?.language === 'de' ? 'de' : 'en', voll ? 60000 : 700);
  });
  handle('austausch:zuletzt', () => [...zuletztGeoeffnet]);

  handle(
    'austausch:speichern',
    async (_event, auswahl: { werkzeug: string; kennung: string }[], datei?: string) => {
      let ziel = datei;
      if (!ziel) {
        if (!fenster) return { ok: false, abgebrochen: true, anzahl: 0 };
        const heute = new Date().toISOString().slice(0, 10);
        const antwort = await dialog.showSaveDialog(fenster as never, {
          defaultPath: `paket-${heute}${PAKET_ENDUNG}`,
          filters: [{ name: 'LORE', extensions: ['md'] }]
        });
        if (antwort.canceled || !antwort.filePath) return { ok: false, abgebrochen: true, anzahl: 0 };
        ziel = antwort.filePath;
      }
      const paket = await schnuere(app.getPath('userData'), auswahl);
      await schreibePaket(ziel, paket);
      return { ok: true, abgebrochen: false, anzahl: paket.sendungen.length, datei: ziel };
    }
  );

  handle('austausch:oeffnen', async (_event, datei?: string) => {
    let quelle = datei;
    if (!quelle) {
      if (!fenster) return { ok: false, abgebrochen: true };
      const antwort = await dialog.showOpenDialog(fenster as never, {
        properties: ['openFile'],
        filters: [{ name: 'LORE', extensions: ['md'] }]
      });
      if (antwort.canceled || !antwort.filePaths[0]) return { ok: false, abgebrochen: true };
      quelle = antwort.filePaths[0];
    }
    try {
      eingang = await lesePaketDatei(quelle);
    } catch (fehler) {
      eingang = null;
      return { ok: false, abgebrochen: false, grund: paketGrund(fehler) };
    }
    return {
      ok: true,
      abgebrochen: false,
      ankuenfte: ankuenfte(eingang, gemerkteEinstellungen?.language === 'de' ? 'de' : 'en'),
      ziele: await zieleFuer(app.getPath('userData'), eingang.sendungen.map((s) => s.werkzeug))
    };
  });

  /*
   * Der Raum im lokalen Netz (Stufe 2). Der Dienst lebt im Hauptprozess,
   * damit Chat und Verbindung einen geschlossenen Dialog ueberstehen.
   * Angekommene Pakete warten hier, bis jemand sie ansieht; angesehen wird
   * ueber denselben Weg wie eine Paketdatei.
   */
  const raumPakete: { id: number; von: string; titel: string; paket: string; zeit: string }[] = [];
  // Nachrichten an einen noch nicht montierten Charakterbogen, in Reihe.
  let bogenImRaum: Promise<unknown> = Promise.resolve();
  let naechstesRaumpaket = 1;
  let raumRolle: Raumzustand['rolle'] = 'aus';
  const meldePakete = () =>
    huelle?.webContents.send('raum:ereignis', { art: 'pakete', pakete: raumPakete.map(({ paket: _p, ...rest }) => rest) });

  /*
   * Gespeicherte Raeume (docs/charakterbogen.md). Der offene Raum des
   * Gastgebers wird bei jeder Rollenaenderung gespeichert, das Passwort nie.
   * Der Tischschluessel wird erst geladen, wenn ein Raum ihn braucht.
   */
  const raumAblage = new Raumablage(join(app.getPath('userData'), 'raeume'));
  let tischschluessel: Tischschluessel | null = null;
  const holeTischschluessel = () => (tischschluessel ??= ladeTischschluessel(join(app.getPath('userData'), 'tischschluessel.json')));
  let offenerRaum: GespeicherterRaum | null = null;
  const meldeRaumliste = () =>
    void raumAblage.liste().then((liste) => huelle?.webContents.send('raum:ereignis', { art: 'gespeichert', raeume: liste }));
  const sichereOffenenRaum = async (aenderung: Partial<GespeicherterRaum>) => {
    if (!offenerRaum) return;
    // Erst im Speicher aendern, dann schreiben: zwei Aenderungen kurz
    // hintereinander ueberschreiben sich so nicht gegenseitig.
    offenerRaum = { ...offenerRaum, ...aenderung };
    raumZusatz = { einstellungen: offenerRaum.einstellungen, gruppeninventar: offenerRaum.gruppeninventar };
    await raumAblage.speichere(offenerRaum);
    meldeRaumliste();
  };

  merkeGruppeImRaum = (id) => {
    if (offenerRaum && offenerRaum.gruppeninventar !== id) void sichereOffenenRaum({ gruppeninventar: id }).catch(() => undefined);
  };

  const raum = new Raumdienst((ereignis: Raumereignis) => {
    if (ereignis.art === 'rollen') {
      void sichereOffenenRaum({ rollen: ereignis.rollen }).catch(() => undefined);
      return;
    }
    if (ereignis.art === 'werkzeug') {
      // Nicht an die Oberflaeche der Huelle: sie reicht nur weiter. Den
      // letzten Stand der Initiative je Person merken (siehe oben).
      if (ereignis.werkzeug === 'initiative') {
        let art = '';
        try {
          art = String((JSON.parse(ereignis.inhalt) as { art?: unknown }).art ?? '');
        } catch {
          // Unlesbar: das Werkzeug verwirft es ohnehin.
        }
        if (art === 'stand') geteilteStaende.set(ereignis.von.id, { von: ereignis.von, inhalt: ereignis.inhalt });
        if (art === 'ende') geteilteStaende.delete(ereignis.von.id);
      }
      // Boegen im Raum brauchen den Charakterbogen auch, wenn niemand ihn
      // gerade offen hat: dann wird er still montiert, der Reihe nach.
      if (ereignis.werkzeug === 'charakterbogen' && !offen.has('charakterbogen')) {
        const { von, inhalt } = ereignis;
        bogenImRaum = bogenImRaum
          .then(() => montiereImHintergrund('charakterbogen'))
          .then(() => offen.get('charakterbogen')?.raumNachricht?.(von, inhalt))
          .catch(() => undefined);
        return;
      }
      offen.get(ereignis.werkzeug)?.raumNachricht?.(ereignis.von, ereignis.inhalt);
      return;
    }
    if (ereignis.art === 'zustand') {
      if (ereignis.zustand.rolle === 'aus') geteilteStaende.clear();
      // Ein neuer Raum faengt ohne die Pakete des alten an (Testbericht:
      // „Angekommen" wuchs nur).
      if (ereignis.zustand.rolle !== 'aus' && raumRolle === 'aus' && raumPakete.length > 0) {
        raumPakete.length = 0;
        meldePakete();
      }
      raumRolle = ereignis.zustand.rolle;
      if (raumRolle !== 'gastgeber') {
        offenerRaum = null;
        raumZusatz = {};
      }
      // Wer gegangen ist, hat auch nichts mehr geteilt.
      const da = new Set(ereignis.zustand.personen.map((p) => p.id));
      for (const id of [...geteilteStaende.keys()]) if (!da.has(id)) geteilteStaende.delete(id);
      meldeRaumLage();
    }
    if (ereignis.art === 'paket') {
      raumPakete.push({
        id: naechstesRaumpaket++,
        von: ereignis.von.name,
        titel: ereignis.titel,
        paket: ereignis.paket,
        zeit: new Date().toISOString()
      });
      meldePakete();
      return;
    }
    huelle?.webContents.send('raum:ereignis', ereignis);
  }, { schluessel: holeTischschluessel });
  raumDienst = raum;
  app.on('will-quit', () => raum.beende());
  /** Der eigene Name, sonst ein Gastname mit einer Zahl, die selten doppelt ist. */
  const meinName = () =>
    gemerkteEinstellungen.tischName ||
    gastname(1 + Math.floor(Math.random() * 99), gemerkteEinstellungen.language === 'de' ? 'de' : 'en');

  handle('raum:zustand', () => ({
    zustand: raum.zustand(),
    raeume: raum.raeume(),
    pakete: raumPakete.map(({ paket: _p, ...rest }) => rest)
  }));
  handle('raum:suchen', () => {
    raum.suche();
    return raum.raeume();
  });
  handle('raum:aktualisieren', () => {
    raum.aktualisiereSuche();
    return raum.raeume();
  });
  handle(
    'raum:eroeffnen',
    async (_event, name: string, passwort: string, optionen?: { internet?: boolean; port?: number; sl?: boolean; raumId?: string }) => {
      try {
        const internet = optionen?.internet === true;
        const port = Number.isInteger(optionen?.port) ? optionen!.port : undefined;
        // Fortsetzen: Rollen und Einstellungen aus dem gespeicherten Raum. Neu: ein neuer Eintrag.
        const gespeichert = typeof optionen?.raumId === 'string' ? await raumAblage.lies(optionen.raumId) : null;
        const sl = typeof optionen?.sl === 'boolean' ? optionen.sl : undefined;
        const offen = await raum.eroeffne(name, passwort, meinName(), { internet, port, sl, rollen: gespeichert?.rollen ?? {} });
        offenerRaum = await raumAblage.speichere({
          id: gespeichert?.id ?? neueRaumId(),
          name: name.trim().slice(0, 60) || gespeichert?.name || 'Raum',
          internet,
          port: internet ? offen : null,
          rollen: raum.gemerkteRollen(),
          gruppeninventar: gespeichert?.gruppeninventar ?? null,
          einstellungen: gespeichert?.einstellungen ?? VORGABE_RAUMEINSTELLUNGEN,
          geaendert: ''
        });
        raumZusatz = { einstellungen: offenerRaum.einstellungen, gruppeninventar: offenerRaum.gruppeninventar };
        meldeRaumliste();
        meldeRaumLage();
        return { ok: true, port: offen, raumId: offenerRaum.id };
      } catch (fehler) {
        return { ok: false, grund: fehler instanceof Error ? fehler.message : String(fehler) };
      }
    }
  );
  handle('raum:rolle', (_event, ziel: string, sl: boolean) => typeof ziel === 'string' && raum.slRolle(ziel, sl === true));
  handle('raum:gespeicherte', () => raumAblage.liste());
  handle('raum:gespeichertLoeschen', async (_event, id: string) => {
    if (offenerRaum?.id === id) return false;
    const ok = await raumAblage.loesche(String(id));
    meldeRaumliste();
    return ok;
  });
  handle('raum:gespeichertUmbenennen', async (_event, id: string, name: string) => {
    const r = await raumAblage.lies(String(id));
    const neu = String(name ?? '').trim().slice(0, 60);
    if (!r || !neu) return false;
    const gespeichert = await raumAblage.speichere({ ...r, name: neu });
    if (offenerRaum?.id === r.id) offenerRaum = gespeichert;
    meldeRaumliste();
    return true;
  });
  handle('raum:einstellungen', async (_event, aenderung: Partial<GespeicherterRaum['einstellungen']>) => {
    if (!offenerRaum) return null;
    await sichereOffenenRaum({ einstellungen: { ...offenerRaum.einstellungen, ...(aenderung ?? {}) } });
    meldeRaumLage();
    return offenerRaum?.einstellungen ?? null;
  });
  // Export als Datei fuer den Gastgeberwechsel; das Passwort steht nicht darin.
  handle('raum:gespeichertExport', async (_event, id: string) => {
    const r = await raumAblage.lies(String(id));
    if (!r || !fenster) return { ok: false };
    const antwort = await dialog.showSaveDialog(fenster as never, {
      defaultPath: `${r.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'raum'}.lore-raum.json`,
      filters: [{ name: 'LORE', extensions: ['json'] }]
    });
    if (antwort.canceled || !antwort.filePath) return { ok: false, abgebrochen: true };
    await writeFile(antwort.filePath, JSON.stringify(r, null, 2), 'utf8');
    return { ok: true };
  });
  handle('raum:gespeichertImport', async () => {
    if (!fenster) return { ok: false };
    const antwort = await dialog.showOpenDialog(fenster as never, {
      properties: ['openFile'],
      filters: [{ name: 'LORE', extensions: ['json'] }]
    });
    if (antwort.canceled || !antwort.filePaths[0]) return { ok: false, abgebrochen: true };
    try {
      const text = await readFile(antwort.filePaths[0], 'utf8');
      if (text.length > 2_000_000) return { ok: false };
      const r = await raumAblage.lesEin(text);
      meldeRaumliste();
      return r ? { ok: true, raum: r } : { ok: false };
    } catch {
      return { ok: false };
    }
  });
  handle('raum:beitreten', async (_event, adresse: string, port: number, passwort: string) => {
    await raum.trittBei(adresse, port, passwort, meinName());
    return raum.zustand();
  });
  // Die oeffentliche IPv4 fuer Gaeste ueber das Internet. Nur auf Knopfdruck:
  // dafuer wird ein fremder Dienst gefragt, der dabei die eigene IP sieht.
  handle('raum:oeffentlicheIp', async () => {
    try {
      const antwort = await net.fetch('https://api.ipify.org?format=text', { signal: AbortSignal.timeout(8000) });
      const text = (await antwort.text()).trim();
      return antwort.ok && /^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : null;
    } catch {
      return null;
    }
  });
  handle('raum:kopieren', (_event, text: string) => {
    // Eine Einladung mit mehreren Adressen hat leicht ueber 200 Zeichen.
    if (typeof text !== 'string' || text.length > 4000) return false;
    clipboard.writeText(text);
    return true;
  });
  handle('raum:verlassen', () => {
    raum.verlasse();
    return raum.zustand();
  });
  handle('raum:chat', (_event, text: string, an: string | null) => raum.chatte(text, an));
  // Angekommene Pakete wegwerfen: eines (nach ID) oder alle (`null`).
  handle('raum:paketVerwerfen', (_event, id: number | null) => {
    if (id === null) raumPakete.length = 0;
    else {
      const stelle = raumPakete.findIndex((p) => p.id === id);
      if (stelle >= 0) raumPakete.splice(stelle, 1);
    }
    meldePakete();
    return true;
  });
  handle('raum:vergessen', () => {
    raum.vergissLetzten();
    return raum.zustand();
  });
  // Im offenen Raum umbenennen: gilt sofort im Raum und bleibt als eigener
  // Name in den Einstellungen, wie beim Eroeffnen.
  handle('raum:umbenennen', async (_event, name: string) => {
    if (!raum.umbenennen(name)) return false;
    const vorher = await readSettings(einstellungsDatei);
    await writeSettings(einstellungsDatei, { ...vorher, tischName: name.trim().slice(0, 40) });
    gemerkteEinstellungen = await readSettings(einstellungsDatei);
    return true;
  });
  handle('raum:senden', async (_event, auswahl: { werkzeug: string; kennung: string }[], an: string | null) => {
    const paket = await schnuere(app.getPath('userData'), auswahl);
    if (paket.sendungen.length === 0) return { ok: false, anzahl: 0 };
    const namen = paket.sendungen.map((s) => s.name);
    const titel = `${namen.length}: ${namen.slice(0, 4).join(', ')}${namen.length > 4 ? ', …' : ''}`;
    return { ok: raum.sende(alsPaket(paket), titel, an), anzahl: paket.sendungen.length };
  });
  handle('austausch:raumpaket', async (_event, id: number) => {
    const angekommen = raumPakete.find((p) => p.id === id);
    if (!angekommen) return { ok: false, abgebrochen: false, grund: 'weg' };
    try {
      eingang = lesePaket(angekommen.paket);
    } catch (fehler) {
      eingang = null;
      return { ok: false, abgebrochen: false, grund: paketGrund(fehler) };
    }
    return {
      ok: true,
      abgebrochen: false,
      ankuenfte: ankuenfte(eingang, gemerkteEinstellungen?.language === 'de' ? 'de' : 'en'),
      ziele: await zieleFuer(app.getPath('userData'), eingang.sendungen.map((s) => s.werkzeug))
    };
  });

  handle('austausch:konflikte', async (_event, ziele: Record<string, string>) =>
    eingang ? konflikte(app.getPath('userData'), eingang, ziele) : []
  );

  handle(
    'austausch:annehmen',
    async (_event, entscheidungen: { nummer: number; modus?: Modus }[], ziele: Record<string, string>) => {
      if (!eingang) return [];
      const ergebnisse = await nimmAustauschAn(app.getPath('userData'), eingang, entscheidungen, ziele);
      // Offene Werkzeuge erfahren davon; ein geschlossenes liest beim
      // naechsten Oeffnen ohnehin frisch.
      const angekommen = ergebnisse.filter((e) => e.ok && e.kennung);
      for (const werkzeug of new Set(angekommen.map((e) => e.werkzeug))) {
        huelle?.webContents.send('app:ereignis', werkzeug);
        if (werkzeug === 'backstory') {
          meldeStoryCreatorAenderung();
          continue;
        }
        const letzte = angekommen.filter((e) => e.werkzeug === werkzeug).at(-1);
        if (letzte?.kennung) void offen.get(werkzeug)?.zeigeEintrag?.(letzte.kennung);
      }
      return ergebnisse;
    }
  );

  /**
   * Zeigt einen Treffer in seinem Werkzeug.
   *
   * Nur, wenn es schon montiert ist — die Oberflaeche wechselt vorher
   * dorthin, und erst dann kommt der Sprung. Dieselbe Reihenfolge wie beim
   * Verlauf, und aus demselben Grund: ein Sprung in eine Anwendung, die
   * noch gar nicht laeuft, kaeme vor ihrem ersten Zeichnen an.
   */
  handle('suche:zeigen', async (_event, werkzeug: string, kennung: string) => {
    const montiert = offen.get(werkzeug);
    if (!montiert) return false;
    return (await montiert.zeigeEintrag?.(kennung)) ?? false;
  });

  /**
   * Eine Sicherung der ganzen Sammlung.
   *
   * Bisher sicherte nur der Story Creator, und auch nur seine Kampagne.
   * Hier geht der ganze Datenordner hinein: Kampagnen, Monster, Zustaende,
   * Begegnungen, Karten, eigene Symbole und die Einstellungen.
   *
   * Vor dem Packen wird geschrieben, was noch im Speicher haengt — sonst
   * fehlt in der Sicherung genau die Notiz, an der man gerade sass.
   */
  handle('sicherung:schreiben', async () => {
    const vorschlag = sicherungsname(new Date());
    const frage = {
      defaultPath: vorschlag,
      filters: [{ name: 'ZIP', extensions: ['zip'] }]
    };
    const ergebnis = fenster
      ? await dialog.showSaveDialog(fenster, frage)
      : await dialog.showSaveDialog(frage);
    if (ergebnis.canceled || !ergebnis.filePath) return { ok: false, text: '', dateien: 0 };

    for (const montiert of offen.values()) await montiert.flush();
    const bericht = await schreibeSicherung(app.getPath('userData'), ergebnis.filePath);
    return { ok: true, text: ergebnis.filePath, dateien: bericht.dateien };
  });

  /** Oeffnet den Datenordner — von Hand zurueckspielen geht nur dort. */
  handle('sicherung:ordner', async () => {
    const ordner = app.getPath('userData');
    await shell.openPath(ordner);
    return ordner;
  });

  /**
   * Bereitschaft der KI.
   *
   * Der Grund wird hier uebersetzt, wo die eingestellte Sprache bekannt ist —
   * die Anbieter liefern Schluessel, keine fertigen Texte.
   */
  handle('ki:status', async () => {
    const einstellungen = await readSettings(einstellungsDatei);
    // Nicht bloss "es steht etwas in der Datei", sondern "es laesst sich
    // auch aufmachen". Ein Block aus einem anderen Konto oder von einem neu
    // aufgesetzten System ist so gut wie keiner, und die Oberflaeche soll
    // nicht "Ein Schluessel ist hinterlegt" neben "Kein API-Schluessel
    // hinterlegt" stellen.
    const hatSchluessel = Boolean(entschluessle(einstellungen.claudeSchluessel));
    const anbieter = anbieterAus(einstellungen);
    if (!anbieter) return { anbieter: 'none', bereit: false, beschreibung: '', hatSchluessel };

    const zustand = await anbieter.pruefe();
    return {
      anbieter: anbieter.id,
      bereit: zustand.bereit,
      beschreibung: zustand.bereit
        ? zustand.beschreibung
        : translate(einstellungen.language, zustand.schluessel, zustand.werte),
      hatSchluessel
    };
  });

  /** Der Schluessel wird verschluesselt abgelegt und nie zurueckgegeben. */
  handle('ki:schluessel-setzen', async (_event, schluessel: string) => {
    const verschluesselt = verschluessle(schluessel.trim());
    if (verschluesselt === null) {
      // Lieber gar nicht speichern als im Klartext. Die Oberflaeche sagt das
      // weiter, statt so zu tun, als waere es gelungen.
      throw new Error('KEIN_SCHLUESSELBUND');
    }
    const vorher = await readSettings(einstellungsDatei);
    gemerkteEinstellungen = { ...vorher, claudeSchluessel: verschluesselt };
    await writeSettings(einstellungsDatei, gemerkteEinstellungen);
    // Ein Schluessel, der dazukommt oder wegfaellt, entscheidet genauso
    // darueber, ob die KI benutzbar ist, wie der Anbieter selbst.
    meldeKiWechsel();
    return Boolean(verschluesselt);
  });

  /**
   * Zeigt eine Anwendung an und montiert sie beim ersten Mal.
   *
   * Antwortet mit `true`, wenn eine Ansicht davorliegt, und mit `false`, wenn
   * die Huelle diese Anwendung noch nicht einbetten kann. Die Oberflaeche
   * zeigt dann ihre Platzhalterflaeche weiter — sie muss dafuer wissen, ob
   * hinter ihr etwas liegt, sonst schriebe sie ihren Text unter eine
   * laufende Anwendung.
   */
  /**
   * Bringt ein Werkzeug an eine Stelle zurueck, die der Verlauf kennt.
   *
   * Nur, wenn es schon montiert ist: ein Sprung in eine Anwendung, die noch
   * gar nicht laeuft, kaeme vor ihrem ersten Zeichnen an und ginge ins
   * Leere. Die Oberflaeche zeigt sie erst, dann kommt der Sprung.
   */
  handle('verlauf:springe', async (_event, id: string, ort: string | null): Promise<boolean> => {
    const montiert = offen.get(id);
    if (!montiert) return false;
    // Der Story Creator hat einen eigenen Weg; alle anderen den gemeinsamen.
    if (montiert.springeZuOrt) montiert.springeZuOrt(ort);
    else if (!montiert.sicht.webContents.isDestroyed()) montiert.sicht.webContents.send('huelle:ort-springe', ort);
    return true;
  });

  /*
   * Der gemeinsame Weg fuer den Verlauf INNERHALB eines Werkzeugs: es meldet,
   * wo es steht (eine offene Tabelle, ein Gegenstand, ein Eintrag), und die
   * Huelle nimmt das in ihren Verlauf auf. „Zurueck" aus einer offenen
   * Tabelle fuehrt so zur Liste und nicht zum vorigen Werkzeug
   * (Rueckmeldung). Zugeordnet wird ueber den Absender, nicht ueber eine
   * Angabe im Inhalt.
   */
  ipcMain.on('huelle:ort', (ereignis, ort: unknown) => {
    for (const [id, montiert] of offen) {
      if (montiert.sicht.webContents !== ereignis.sender) continue;
      meldeOrt(id, typeof ort === 'string' && ort ? ort.slice(0, 200) : null);
      return;
    }
  });

  handle('app:zeigen', async (_event, id: string, fruehestensMs = 0): Promise<ZeigenErgebnis> => {
    if (!fenster) return { zustand: 'nicht-einbettbar' };
    const begonnen = Date.now();

    verbergeAlle();
    aktiveApp = id;

    let montiert = offen.get(id);
    if (!montiert) {
      const einstellungen = await readSettings(einstellungsDatei);
      try {
        montiert = (await mountApp(id, montageHaken(id, einstellungen.language))) ?? undefined;
      } catch (fehler) {
        aktiveApp = null;
        return fehlerErgebnis(fehler);
      }
      if (!montiert) return { zustand: 'nicht-einbettbar' };
      // Auch eine Anwendung, deren Oberflaeche gleich nicht laedt, bleibt hier
      // stehen. Ihre Kanaele und ihr Protokoll sind angemeldet, und beides
      // laesst sich nicht ein zweites Mal anmelden — sie noch einmal zu
      // montieren scheiterte an „Failed to register protocol", und das
      // Werkzeug waere bis zum Neustart der Huelle unbrauchbar, selbst wenn
      // die fehlenden Dateien inzwischen da sind.
      offen.set(id, montiert);
      beobachteFarbe(montiert.sicht.webContents as WebContents);
      fenster.contentView.addChildView(montiert.sicht);
    }

    try {
      // Nur laden, wenn noch nichts drin ist: beim ersten Mal, oder beim
      // zweiten Versuch nach einem Fehlschlag. Bei jedem Wechsel neu zu laden
      // waere bequemer zu schreiben und falsch — es wuerfe den Zustand der
      // Anwendung weg, offene Notiz und Auswahl mitsamt. Der Rauchtest der
      // Huelle prueft genau das.
      if (!montiert.istGeladen()) await montiert.nachladen();
    } catch (fehler) {
      // Der haeufigste Grund ist banal: die Anwendung wurde nie gebaut, ihre
      // index.html gibt es nicht. Frueher warf dieser Kanal die Ablehnung bis
      // in die Oberflaeche durch, wo sie niemand auffing — die Flaeche blieb
      // beim Platzhalter stehen, und der behauptete obendrein, das Einbetten
      // sei noch gar nicht gebaut. Wer das sah, suchte den Fehler an der
      // falschen Stelle. Jetzt kommt heraus, *was* fehlt.
      montiert.sicht.setVisible(false);
      aktiveApp = null;
      return fehlerErgebnis(fehler);
    }

    /*
     * Nicht vor der Zeit hervorkommen.
     *
     * Beim Wechsel aus dem Startmenue waechst in der Huelle das Symbol ueber
     * den Schirm. Schoebe sich die Ansicht mitten hinein, sieht es aus, als
     * haette jemand die Animation abgeschnitten. Montiert und geladen wurde
     * waehrenddessen — gewartet wird nur auf den Rest.
     */
    const rest = fruehestensMs - (Date.now() - begonnen);
    if (rest > 0) await new Promise((fertig) => setTimeout(fertig, rest));

    // `holeNachVorn` legt vorher neu aus: das Fenster kann seit dem letzten
    // Mal eine andere Groesse haben.
    holeNachVorn(montiert, true);

    // Wartet ein Kartenname auf genau dieses Werkzeug, wird er jetzt
    // zugestellt — erst hier ist es geladen und kann darauf antworten.
    if (wartendeKarte && montiert.neueKarte) {
      montiert.neueKarte(wartendeKarte.name, wartendeKarte.notizen);
      wartendeKarte = null;
    }

    // Dasselbe fuer eine Begegnung, die auf den Tracker wartet.
    if (wartendeBegegnung && montiert.uebernimmBegegnung) {
      await montiert.uebernimmBegegnung(wartendeBegegnung);
      wartendeBegegnung = null;
    }
    return { zustand: 'offen' };
  });

  /** Zurueck ins Startmenue: alle Anwendungen bleiben geladen, aber unsichtbar. */
  handle('app:startmenue', () => {
    verbergeAlle();
    aktiveApp = null;
    huelle?.webContents.focus();
  });

  /**
   * Die Daumentasten der Maus, Weg 2 von 2.
   *
   * Gemeldet vom Preload des Werkzeugs, das die Taste im Dokument gesehen
   * hat — dort kommen die Seitentasten als `button` 3 und 4 an, auf jedem
   * System und auch dann, wenn Chromium sie in der Ansicht selbst abfaengt
   * und das Fenster deshalb nichts mitbekommt.
   *
   * Ein gemeinsamer Kanalname ohne Werkzeug-Praefix, weil die Meldung nichts
   * mit dem Werkzeug zu tun hat: sie sagt nur, dass eine Taste gedrueckt
   * wurde. Der Absender wird trotzdem geprueft — angenommen wird sie nur von
   * der Huelle selbst oder einer montierten Ansicht dieses Fensters.
   *
   * Auch die Huelle meldet ueber diesen Umweg und nicht kurz intern: nur so
   * laufen alle Wege durch dieselbe Sperrfrist. Die kurze Abkuerzung gab es
   * einmal, und im Startmenue sprang der Verlauf dann zwei Stellen weit,
   * weil dort beide Wege zugleich trugen.
   */
  ipcMain.on('huelle:verlauf-taste', (ereignis, richtung: unknown, art: unknown) => {
    const ausHuelle = ereignis.sender === huelle?.webContents;
    const werkzeug = [...offen.entries()].find(
      ([, montiert]) => montiert.sicht.webContents === ereignis.sender
    );
    const woher = ausHuelle ? 'Huelle' : (werkzeug?.[0] ?? 'unbekannt');
    protokolliere(`Dokument (${woher}): ${String(art)} → ${String(richtung)}`);
    if (!ausHuelle && !werkzeug) return;
    if (richtung === 'zurueck' || richtung === 'vorwaerts') meldeVerlauf(richtung, `${woher}/${String(art)}`);
  });

  /**
   * Meldet, dass ein Dialog der Huelle auf- oder zugeht.
   *
   * Solange einer offen ist, tritt die vorn liegende Anwendung zurueck —
   * sonst deckt sie den Dialog zu. Beim Schliessen kommt sie zurueck.
   */
  handle('app:dialog', (_event, offenerDialog: boolean) => {
    if (offenerDialog) {
      verbergeAlle();
      huelle?.webContents.focus();
      return;
    }
    const montiert = aktiveApp ? offen.get(aktiveApp) : undefined;
    if (!montiert) return;
    holeNachVorn(montiert, false);
  });

  /**
   * Die Oberflaeche meldet, ob das System weniger Bewegung wuenscht.
   *
   * Sie ist die einzige Stelle, die das beantworten kann: `matchMedia` gibt
   * es nur in einer Darstellung. Der Hauptprozess braucht die Auskunft fuer
   * die Einfahrt der Ansichten, die er selbst treibt.
   */
  /*
   * Strg+K in einem Werkzeug.
   *
   * Dasselbe Muster wie bei den Daumentasten der Maus: das Preload jedes
   * Werkzeugs hoert mit und meldet hierher, weil die Huelle den
   * Tastendruck sonst nicht sieht.
   */
  /*
   * Strg+K aus einem Werkzeug.
   *
   * Zwei Wege fuehren hierher, und beide sollen es: `before-input-event`
   * auf jeder eingebetteten Ansicht (siehe `sichereAb`) und — fuer die
   * Oberflaeche der Huelle selbst — ihr eigener Tastenlauscher.
   */
  /*
   * Strg+Alt und Plus, Minus, 0: die Oberflaeche eine Stufe groesser,
   * kleiner oder zurueck auf 100 Prozent (Wunsch aus dem Testbericht).
   */
  const stufeGroesse = async (stufe: 'groesser' | 'kleiner' | 'zurueck') => {
    const vorher = await readSettings(einstellungsDatei);
    const stellen = GROESSEN as readonly number[];
    const jetzt = Math.max(0, stellen.indexOf(vorher.groesse));
    const neu =
      stufe === 'zurueck'
        ? VORGABE_GROESSE
        : stellen[Math.min(stellen.length - 1, Math.max(0, jetzt + (stufe === 'groesser' ? 1 : -1)))];
    if (neu === vorher.groesse) return;
    await writeSettings(einstellungsDatei, { ...vorher, groesse: neu });
    gemerkteEinstellungen = await readSettings(einstellungsDatei);
    setzeGroesse(gemerkteEinstellungen.groesse);
    legeHuelleAus();
    huelle?.webContents.send('einstellungen:groesse-extern', gemerkteEinstellungen.groesse);
  };
  setzeGroessentaste((stufe) => void stufeGroesse(stufe));
  ipcMain.on('groesse:taste', (_event, stufe: unknown) => {
    if (stufe === 'groesser' || stufe === 'kleiner' || stufe === 'zurueck') void stufeGroesse(stufe);
  });

  const oeffneSuche = () => huelle?.webContents.send('suche:oeffnen');
  setzeSuchtaste(oeffneSuche);
  ipcMain.on('suche:taste', oeffneSuche);

  ipcMain.on('bewegung:reduziert', (_event, reduziert: boolean) => {
    wenigerBewegung = Boolean(reduziert);
    if (wenigerBewegung) brichFahrtAb();
  });
  handle('app:plattform', () => process.platform);
  /**
   * Oeffnet eine Adresse im Browser des Systems.
   *
   * Nur http und https: `shell.openExternal` startet sonst, was auch immer das
   * System mit dem Schema verbindet — bei `file:` waere das der Dateimanager,
   * bei exotischeren Schemata Schlimmeres.
   */
  handle('app:oeffne-extern', (_event, adresse: string) => {
    if (adresse.startsWith('http://') || adresse.startsWith('https://')) {
      void shell.openExternal(adresse);
    }
  });
}

/*
 * Ein Auffangnetz im Hauptprozess.
 *
 * Ein Fehler, den niemand faengt, beendet den Prozess — und mit ihm die
 * ganze Sammlung, samt allem, was in den anderen Werkzeugen offen ist. Das
 * ist der Bericht "beim Anlegen einer Notiz stuerzt alles ab": was genau
 * schiefging, stand nirgends, weil das Fenster mit der Meldung verschwand.
 *
 * Hier wird nichts repariert. Der Fehler landet in der Konsole und in der
 * Protokolldatei des Systems, und die Anwendung bleibt stehen, damit die
 * Person speichern kann, was sie offen hat.
 */
process.on('uncaughtException', (fehler) => {
  console.error('[shell] Unbehandelter Fehler im Hauptprozess:', fehler);
});

process.on('unhandledRejection', (grund) => {
  console.error('[shell] Unbehandelte Ablehnung im Hauptprozess:', grund);
});

app.whenReady().then(async () => {
  startMarke('Electron bereit');
  einstellungsDatei = join(app.getPath('userData'), 'einstellungen.json');
  protokollDatei = join(app.getPath('userData'), 'maustasten.log');
  if (tastenProtokoll) {
    console.log(`[shell] Tastenprotokoll an: ${protokollDatei}`);
    protokolliere('--- Start ---');
  }
  const gelesen = await readSettings(einstellungsDatei);

  // Wer die KI frueher im Story Creator eingerichtet hat, soll sie nicht
  // neu eintippen muessen — ein API-Schluessel ist nichts, was man eben
  // nachschlaegt. Passiert genau einmal: danach steht hier etwas, und die
  // Uebernahme greift nicht mehr.
  const uebernommen = await findeKiUebernahme(
    gelesen,
    join(app.getPath('userData'), 'backstory', 'settings.json')
  );
  if (uebernommen) console.log('[shell] KI-Einstellung aus dem Story Creator uebernommen');

  // Einmal anlegen, wenn es sie noch nicht gibt. Zwei Gruende: wer nachsehen
  // will, was sich einstellen laesst, findet die Datei, statt raten zu
  // muessen — und sie ist der Beleg dafuer, dass der Hauptprozess bis hierher
  // gekommen ist. Die Pruefung des gepackten Pakets wartet darauf.
  gemerkteEinstellungen = { ...gelesen, ...uebernommen };
  await writeSettings(einstellungsDatei, gemerkteEinstellungen);

  // Den Symbolordner gleich anlegen, samt Liesmich. Wer eigene Bilder
  // einsetzen will, soll den Ordner vorfinden und nicht raten muessen, wie
  // er heisst.
  await richteSymbolOrdnerEin(app.getPath('userData'));
  startMarke('Einstellungen gelesen und geschrieben');
  registriereKanaele();
  startMarke('Kanaele angemeldet');
  await erzeugeFenster();
  startMarke('Fenster steht');
  startBericht();
  app.on('activate', () => {
    if (!fenster) void erzeugeFenster();
  });
});
