/**
 * Oberflaeche der Huelle: Titelleiste, Startmenue und Schiene.
 *
 * Die Huelle kennt zwei Bilder. Ohne gewaehltes Werkzeug fuellt das Startmenue
 * mit den grossen Kacheln das Fenster. Mit gewaehltem Werkzeug schrumpft das
 * Menue zur schmalen Schiene links, dieselben Symbole in klein, und rechts
 * daneben bleibt die Flaeche fuer die Anwendung frei.
 *
 * Auf dieser Flaeche liegt die Ansicht der Anwendung. Sichtbar wird hier nur
 * etwas, wenn keine daraufliegt: weil das Werkzeug noch nicht einbettbar ist,
 * oder weil es sich nicht oeffnen liess.
 */
import { groessenTaste } from '../shared/tasten';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  APPS,
  CHROME,
  ROLLEN,
  ROLLE_KEY,
  STATUS_KEY,
  appsMitRolle,
  descriptionKey,
  findApp,
  istWaehlbar,
  nameKey,
  VORGABE_GROESSE
} from '../shared/apps';
import {
  DEFAULT_LANGUAGE,
  translate,
  type Language,
  type MessageKey,
  type MessageParams
} from '../shared/i18n';
import {
  LEERER_VERLAUF,
  aktuelleStelle,
  besuche,
  kannVorwaerts,
  kannZurueck,
  vorwaerts,
  zurueck,
  type Stelle,
  type Verlauf
} from '../shared/verlauf';
import { AppSymbol, SuiteIcon } from './icons';
import { KI_VOREINSTELLUNGEN, type KiEinstellungen } from '@suite/ki/einstellungen';
import { VORGABE_THEMA } from '@suite/farben';
import { WERKZEUG_APP, type Eintrag } from '@suite/eintraege';
import { Einstellungen, type KiZustandAnsicht } from './Einstellungen';
import { Suche } from './Suche';
import { Austausch } from './Austausch';
import { Protokoll } from './Protokoll';
import { Ueber } from './Ueber';
import { Einfuehrung } from './Einfuehrung';
import { WILLKOMMEN, einfuehrungFuer, stehtAus } from '../shared/einfuehrung';

declare global {
  interface Window {
    readonly shell: import('../preload/index').ShellApi;
  }
}

type Uebersetzer = (key: MessageKey, params?: MessageParams) => string;

/**
 * Was auf der Buehne los ist: das Ergebnis des Hauptprozesses, um den
 * Zwischenzustand `laedt` erweitert. Den kennt nur die Oberflaeche — der
 * Hauptprozess antwortet erst, wenn er fertig ist.
 */
type BuehnenZustand =
  | { zustand: 'laedt' }
  | import('../main/index').ZeigenErgebnis;

/**
 * Wie lange das Symbol braucht, um ueber den Schirm zu wachsen.
 *
 * Laenger als ein Ortswechsel (220 ms), weil hier wirklich etwas weit
 * unterwegs ist — von einer Kachel bis in jede Ecke. Kuerzer als eine halbe
 * Sekunde, weil man danach arbeiten will. Die Zahl steht hier und nicht in
 * @suite/motion: sie gilt fuer diesen einen Uebergang, den es nur in der
 * Huelle gibt.
 *
 * Dieselbe Zahl bekommt der Hauptprozess mit, damit er die Ansicht nicht
 * mitten hineinschiebt.
 */
const UEBERGANG_MS = 340;

/**
 * Wie lange nach einem Verlaufsschritt jeder Ortsbericht als dessen Antwort
 * gilt und deshalb nicht als neuer Besuch zaehlt.
 *
 * Grosszuegig bemessen: das Werkzeug muss erst geladen, dann gesprungen sein
 * und erst danach melden. Zu kurz kostet den Vorwaerts-Ast; zu lang kostet
 * hoechstens einen Eintrag, wenn jemand sofort nach einem Schritt zurueck
 * woanders hinklickt.
 */
const SPRUNG_RUHE_MS = 800;

export function App() {
  const [aktiv, setAktiv] = useState<string | null>(null);
  /**
   * Wo man war, wie im Browser.
   *
   * Eine Referenz und kein Zustand: nichts auf dem Schirm haengt daran, und
   * ein Zustand liesse die Oberflaeche bei jedem Wechsel ein zweites Mal
   * zeichnen. Sitzungszustand ist er ohnehin — beim naechsten Start faengt
   * er leer an, wie ein frisches Fenster auch.
   */
  // Die Startseite ist die erste Stelle: sonst ist „Zurück" nach dem ersten Werkzeug gesperrt (Testbericht).
  const verlauf = useRef<Verlauf>(besuche(LEERER_VERLAUF, { app: null }));
  /**
   * Bis wann ein Ortsbericht zu einem laufenden Verlaufsschritt gehoert.
   * `null`, solange kein Schritt laeuft.
   */
  const sprungLaeuft = useRef<number | null>(null);
  /**
   * `waehle` steht weiter unten, wird aber schon vom Verlauf gebraucht. Eine
   * Referenz ist ehrlicher als die Reihenfolge umzustellen: der Wechsel
   * haengt an vielem, der Verlauf nur an ihm.
   */
  const waehleRef = useRef<((id: string | null, von?: DOMRect, ausVerlauf?: boolean) => void) | null>(null);
  /** Welches Werkzeug sichtbar ist, auch fuer Lauscher, die nur einmal entstehen. */
  const aktivRef = useRef<string | null>(null);
  /**
   * Was auf der Buehne los ist.
   *
   * Frueher stand hier ein `boolean`. Der beantwortete zwei verschiedene
   * Fragen mit demselben Wort: „dieses Werkzeug gibt es noch nicht" und
   * „es liess sich nicht oeffnen" fuehrten beide zum selben Platzhalter,
   * und der behauptete, das Einbetten sei noch nicht gebaut. Wer mit einem
   * ungebauten Werkzeug darauf stiess, suchte den Fehler an der falschen
   * Stelle.
   *
   * `laedt` ist der Zustand zwischen Klick und Antwort. Ohne ihn zeigte die
   * Flaeche in dieser Zeit die Meldung des *vorigen* Versuchs.
   */
  const [buehne, setBuehne] = useState<BuehnenZustand>({ zustand: 'laedt' });
  const [maximiert, setMaximiert] = useState(false);
  // Sitzungsprotokoll: läuft eins, steht ein roter Punkt mit der Zahl der Einträge in der Titelleiste.
  const [sitzungLaeuft, setSitzungLaeuft] = useState<{ laeuft: boolean; anzahl: number } | null>(null);
  useEffect(() => {
    void window.shell.protokoll.zustand().then((s) => setSitzungLaeuft(s && s.ende === null ? { laeuft: true, anzahl: s.eintraege.length } : null));
    return window.shell.protokoll.beiAenderung((z) => setSitzungLaeuft(z && z.laeuft ? z : null));
  }, []);
  const [version, setVersion] = useState('');
  const [sprache, setSprache] = useState<Language>(DEFAULT_LANGUAGE);
  /**
   * Die KI-Anbindung der Sammlung. Der API-Schluessel steht nicht darin — er
   * bleibt im Hauptprozess, hier ist nur zu sehen, ob einer da ist.
   */
  const [ki, setKi] = useState<KiEinstellungen>(KI_VOREINSTELLUNGEN);
  const [kiZustand, setKiZustand] = useState<KiZustandAnsicht | null>(null);
  /**
   * Das Farbthema. Die Werkzeuge bekommen es als eingespritzte Regel vom
   * Hauptprozess (`farbe.ts`); die Huelle faerbt sich hier selbst.
   */
  const [thema, setThema] = useState(VORGABE_THEMA);
  /** Die Groesse der Oberflaeche in Prozent; gezoomt wird im Hauptprozess. */
  const [groesse, setGroesse] = useState(VORGABE_GROESSE);
  /**
   * Welche Werkzeuge schon einmal wirklich offen waren.
   *
   * Nur die koennen ihre eigenen Einstellungen beantworten — was nie montiert
   * wurde, hat sie noch nicht geladen. Der Einstellungen-Dialog fragt deshalb
   * genau diese ab. Einmal montiert, bleibt ein Werkzeug montiert, also
   * wandert hier auch nichts wieder heraus.
   */
  const [montierte, setMontierte] = useState<ReadonlySet<string>>(new Set());
  /**
   * Was die Werkzeuge abgelegt haben — fuer die Suche mit Strg+K.
   *
   * Bei jedem Oeffnen frisch geholt und nicht beim Start: wer sucht, will
   * finden, was er gerade eben angelegt hat.
   */
  const [eintraege, setEintraege] = useState<readonly Eintrag[]>([]);
  const [sucheLaedt, setSucheLaedt] = useState(false);

  const [wenigerBewegung, setWenigerBewegung] = useState(false);
  /**
   * Eigene Symbole aus dem Symbolordner, als data:-URL je Kennung.
   *
   * Leer ist der Normalfall — dann gelten ueberall die eingebauten.
   */
  const [symbole, setSymbole] = useState<Record<string, string>>({});
  /**
   * Der laufende Uebergang vom Symbol zum Werkzeug, oder `null`.
   *
   * `von` ist die Flaeche der angeklickten Kachel — dort faengt das Wachsen
   * an. `phase` trennt das Wachsen von dem, was danach kommt: ist das
   * Werkzeug dann noch nicht da, steht im ausgewachsenen Feld der Ladekreis.
   */
  const [uebergang, setUebergang] = useState<{
    id: string;
    von: DOMRect;
    phase: 'waechst' | 'wartet';
  } | null>(null);
  /** Welcher Dialog offen ist, oder `null`. Es ist immer hoechstens einer. */
  const [dialog, setDialog] = useState<'einstellungen' | 'ueber' | 'einfuehrung' | 'suche' | 'teilen' | 'protokoll' | null>(null);
  /**
   * Ob zurueck und vorwaerts gerade moeglich sind.
   *
   * Der Verlauf selbst liegt in einem Ref und loest kein Neuzeichnen aus —
   * das ist Absicht, er aendert sich bei jedem Wechsel. Fuer die zwei
   * Knoepfe in der Titelleiste braucht es aber einen Zustand, sonst blieben
   * sie ausgegraut stehen.
   */
  const [verlaufsStand, setVerlaufsStand] = useState({ zurueck: false, vorwaerts: false });
  /**
   * Welche Einfuehrung gerade gezeigt wird, und welche schon gesehen sind.
   *
   * `gesehen` ist `null`, solange die Einstellungen noch nicht gelesen sind.
   * Das ist nicht dasselbe wie „nichts gesehen": waere es eine leere Liste,
   * blitzte das Willkommen bei jedem Start kurz auf, auch beim hundertsten.
   *
   * Dazu ein Ref, weil `waehle` die Liste braucht und nicht bei jeder
   * Aenderung neu gebaut werden soll.
   */
  const [einfuehrungId, setEinfuehrungId] = useState<string | null>(null);
  const [gesehen, setGesehen] = useState<readonly string[] | null>(null);
  const gesehenRef = useRef<readonly string[] | null>(null);
  gesehenRef.current = gesehen;

  /**
   * Oeffnet oder schliesst einen Dialog und sagt es dem Hauptprozess.
   *
   * Der muss es wissen: die Dialoge liegen in der Ansicht der Huelle, und die
   * liegt unter den Anwendungen. Ohne diese Meldung waere ein geoeffneter
   * Dialog hinter der laufenden Anwendung nicht zu sehen.
   */
  const zeigeDialog = useCallback((welcher: 'einstellungen' | 'ueber' | 'einfuehrung' | 'suche' | 'teilen' | 'protokoll' | null) => {
    setDialog(welcher);
    void window.shell.app.dialog(welcher !== null);
  }, []);

  /*
   * Die Einfuehrungen.
   *
   * `dialogRef` gibt es, weil `zeigeEinfuehrung` aus einer Antwort des
   * Hauptprozesses heraus aufgerufen wird und dort der Zustand von vorhin
   * stuende.
   */
  const dialogRef = useRef<'einstellungen' | 'ueber' | 'einfuehrung' | 'suche' | 'teilen' | 'protokoll' | null>(null);
  dialogRef.current = dialog;

  /**
   * Zeigt die Einfuehrung eines Werkzeugs, wenn sie noch aussteht.
   *
   * Liegt schon ein Dialog vorn, passiert nichts. Die Einfuehrung bleibt dann
   * ungesehen und kommt beim naechsten Oeffnen von selbst wieder — das ist
   * besser, als zwei Fenster uebereinanderzulegen und eines davon ungelesen
   * als erledigt zu verbuchen. Dasselbe gilt, solange die Einstellungen noch
   * nicht gelesen sind: dann ist gar nicht bekannt, was schon gesehen wurde.
   */
  const zeigeEinfuehrung = useCallback(
    (id: string) => {
      if (dialogRef.current !== null) return;
      const bisher = gesehenRef.current;
      if (bisher === null) return;
      if (!stehtAus(id, bisher)) return;
      if (!einfuehrungFuer(id)) return;
      setEinfuehrungId(id);
      zeigeDialog('einfuehrung');
    },
    [zeigeDialog]
  );

  /**
   * Schliesst die Einfuehrung und merkt sie als gesehen.
   *
   * Gespeichert wird sofort und nicht erst beim Beenden: sonst kaeme nach
   * einem Absturz alles noch einmal.
   */
  const schliesseEinfuehrung = useCallback(() => {
    const id = einfuehrungId;
    setEinfuehrungId(null);
    zeigeDialog(null);
    if (id === null) return;
    const neu = [...new Set([...(gesehenRef.current ?? []), id])];
    setGesehen(neu);
    void window.shell.einstellungen
      .schreiben({ einfuehrungGesehen: neu })
      .then((gespeichert) => setGesehen(gespeichert.einfuehrungGesehen))
      // Laesst sich nicht speichern, bleibt die Einfuehrung fuer diese
      // Sitzung trotzdem weg. Sie beim naechsten Start wiederzusehen ist
      // laestig, aber kein Grund fuer eine Fehlermeldung.
      .catch((fehler: unknown) => console.error('[shell] Einfuehrung nicht gemerkt:', fehler));
  }, [einfuehrungId, zeigeDialog]);

  /** Setzt alle Einfuehrungen zurueck. Der Knopf dafuer steht in den Einstellungen. */
  const setzeEinfuehrungenZurueck = useCallback(async () => {
    const gespeichert = await window.shell.einstellungen.schreiben({ einfuehrungGesehen: [] });
    setGesehen(gespeichert.einfuehrungGesehen);
  }, []);

  useEffect(() => {
    void window.shell.app.version().then(setVersion);
    void window.shell.fenster.istMaximiert().then(setMaximiert);
    // Die gespeicherte Sprache kommt erst nach dem ersten Zeichnen an. Bis
    // dahin steht die Voreinstellung da — ein kurzer Wechsel ist besser als
    // ein leeres Fenster, das auf eine Datei wartet.
    void window.shell.einstellungen.lesen().then((e) => {
      setSprache(e.language);
      setKi(e.ki);
      setThema(e.thema);
      setGroesse(e.groesse);
      setGesehen(e.einfuehrungGesehen);
      // Das Willkommen beim allerersten Start. Es steht hier und nicht in
      // einem eigenen Effekt, weil es genau die Antwort braucht, die gerade
      // angekommen ist.
      if (stehtAus(WILLKOMMEN, e.einfuehrungGesehen)) {
        setEinfuehrungId(WILLKOMMEN);
        setDialog('einfuehrung');
        void window.shell.app.dialog(true);
      }
    });
    void window.shell.symbole.lesen().then(setSymbole, () => setSymbole({}));
    // Auch der Fensterrahmen des Systems kann maximieren. Ohne diese Meldung
    // zeigte der Knopf danach das falsche Symbol.
    const abmeldenZustand = window.shell.fenster.beiZustandswechsel(({ maximiert: m }) =>
      setMaximiert(m)
    );
    // Hat der Hauptprozess beim Start schon ein Werkzeug geoeffnet, liegt es
    // bereits vorn — die Oberflaeche muss nur nachziehen und darf es nicht
    // ein zweites Mal anfordern.
    const abmeldenStart = window.shell.app.beiStartMitWerkzeug((id) => {
      setAktiv(id);
      verlauf.current = besuche(verlauf.current, { app: id });
      setBuehne({ zustand: 'offen' });
    });
    // Eine der eingebetteten Anwendungen (oder eine andere Sitzung dieses
    // Fensters) kann die Sprache aendern, ohne dass hier der
    // Einstellungen-Dialog benutzt wurde. Ohne diesen Kanal wuesste die
    // Titelleiste nichts davon.
    const abmeldenSprache = window.shell.einstellungen.beiSprachwechselVonAussen(setSprache);
    return () => {
      abmeldenZustand();
      abmeldenStart();
      abmeldenSprache();
    };
  }, []);

  /**
   * Zurueck und vorwaerts, wie im Browser.
   *
   * Die Daumentasten der Maus kommen auf zwei Wegen herein — als
   * `app-command` vom Fenster und aus dem Dokument der vorn liegenden
   * Ansicht —, aber immer ueber den Hauptprozess. Der fuehrt beide zusammen
   * und sperrt kurz nach, damit ein Druck ein Schritt bleibt. Genau darum
   * hoert hier NICHT noch einmal jemand auf `mouseup`: dieser Weg liefe an
   * der Sperre vorbei, und im Startmenue sprang der Verlauf dann zwei
   * Stellen auf einmal. Alt und Pfeil geht zusaetzlich, solange die Huelle
   * den Fokus hat.
   */
  /** Die zwei Knoepfe in der Titelleiste nachziehen. Nach jedem Schritt. */
  const zieheVerlaufNach = useCallback(() => {
    setVerlaufsStand({
      zurueck: kannZurueck(verlauf.current),
      vorwaerts: kannVorwaerts(verlauf.current)
    });
  }, []);

  const geheZu = useCallback(
    (richtung: 'zurueck' | 'vorwaerts') => {
      const naechster = richtung === 'zurueck' ? zurueck(verlauf.current) : vorwaerts(verlauf.current);
      if (naechster === verlauf.current) return;

      verlauf.current = naechster;
      // Bis hierhin gilt jeder Ortsbericht als Folge dieses Sprungs. Die
      // Frist deckt den Uebergang der Ansicht und die Antwort des Werkzeugs.
      sprungLaeuft.current = Date.now() + UEBERGANG_MS + SPRUNG_RUHE_MS;
      zieheVerlaufNach();
      const ziel = aktuelleStelle(naechster);

      // Dasselbe Werkzeug, andere Stelle: dann bleibt die Ansicht stehen und
      // nur die Anwendung springt. Ein Wechsel waere hier falsch — er
      // zeichnete die Ansicht neu, ohne dass sich etwas geaendert haette.
      if (ziel && ziel.app !== null && ziel.app === aktivRef.current) {
        void window.shell.verlauf.springe(ziel.app, ziel.ort ?? null);
        return;
      }

      waehleRef.current?.(ziel?.app ?? null, undefined, true);
      // Das Werkzeug kommt erst hoch, dann der Sprung: vorher haette es
      // nichts, wohin es springen koennte.
      if (ziel?.app && ziel.ort) {
        const app = ziel.app;
        const ort = ziel.ort;
        window.setTimeout(() => void window.shell.verlauf.springe(app, ort), UEBERGANG_MS);
      }
    },
    [zieheVerlaufNach]
  );

  /**
   * Ein Werkzeug bittet darum, ein anderes zu zeigen.
   *
   * Bisher wechselte die Huelle nur auf Klick oder ueber den Verlauf. „Karte
   * anlegen" in der Inspirationshilfe braucht den Wechsel von innen: das
   * Werkzeug reicht der Huelle einen Ortsnamen, die holt den Karteneditor
   * nach vorn, und der Hauptprozess stellt den Namen zu, sobald er steht.
   */
  useEffect(() => {
    const ab = window.shell?.app?.beiOeffnen?.((id) => {
      if (id !== aktivRef.current) waehleRef.current?.(id);
    });
    return () => ab?.();
  }, []);

  /**
   * Ein Werkzeug meldet, wo es steht — im Story Creator die offene Notiz.
   *
   * Nur, wenn es auch das sichtbare ist: eine Anwendung, die im Hintergrund
   * liegt, kann beim Laden noch etwas melden, und das gehoert nicht in den
   * Verlauf.
   */
  useEffect(() => {
    return window.shell.verlauf.beiOrt((id, ort) => {
      if (id !== aktivRef.current) return;
      const stelle: Stelle = { app: id, ort: ort ?? undefined };

      /*
       * Ein Bericht, der die Antwort auf unseren eigenen Sprung ist, darf
       * nicht als neuer Besuch zaehlen: `besuche` wirft dabei den
       * Vorwaerts-Ast weg, und nach einem Schritt zurueck waere vorwaerts
       * sofort wieder tot. Browser machen es genauso.
       *
       * Warum nicht einfach auf Gleichheit pruefen: das Werkzeug meldet nach
       * einem Sprung nicht zwingend genau die Stelle, auf die gesprungen
       * wurde — steht im Verlauf nur das Werkzeug und keine Stelle darin,
       * meldet es die Stelle, auf der es stehen bleibt.
       */
      const sprung = sprungLaeuft.current;
      if (sprung !== null && Date.now() < sprung) return;
      sprungLaeuft.current = null;

      verlauf.current = besuche(verlauf.current, stelle);
      // Die Pfeile muessen es erfahren: sonst bleibt „Zurueck" grau, obwohl
      // es jetzt einen Schritt zurueck innerhalb des Werkzeugs gibt.
      zieheVerlaufNach();
    });
  }, [zieheVerlaufNach]);

  useEffect(() => {
    /*
     * Nur dieser eine Weg. Alt und Pfeil hoert das Preload ab und schickt es
     * durch den Hauptprozess, genau wie die Daumentasten — der sperrt kurz
     * nach, damit ein Druck ein Schritt bleibt. Ein zweiter Hoerer hier
     * liefe an der Sperre vorbei, und der Verlauf sprang dann zwei Stellen
     * auf einmal.
     */
    return window.shell.verlauf.beiBefehl(geheZu);
  }, [geheZu]);

  const t = useMemo<Uebersetzer>(
    () => (key, params) => translate(sprache, key, params),
    [sprache]
  );

  /*
   * Die Anwendungen selbst als Treffer.
   *
   * Sie kommen nicht von einem Leser: die Huelle kennt ihre eigenen
   * Anwendungen, und sie von der Platte zu holen waere ein Umweg um
   * Wissen, das hier ohnehin liegt. Die Beschreibung der Kachel kommt als
   * Stichwort mit — wer „Karte" tippt, findet so auch den Karteneditor,
   * der „Maps" heisst.
   */
  const appEintraege = useMemo<readonly Eintrag[]>(
    () =>
      APPS.filter((app) => istWaehlbar(app.status)).map((app) => ({
        werkzeug: WERKZEUG_APP,
        kennung: app.id,
        name: t(nameKey(app.id)),
        art: t('search.appArt'),
        // Beide Sprachen: „würfel" findet die Würfel auch in der englischen Oberfläche.
        stichworte: [
          t(descriptionKey(app.id)),
          translate('de', nameKey(app.id)),
          translate('en', nameKey(app.id)),
          translate('de', descriptionKey(app.id))
        ].join(' ')
      })),
    [t]
  );

  /**
   * Sagt dem Hauptprozess, ob weniger Bewegung gewuenscht ist.
   *
   * Er treibt die Einfahrt der eingebetteten Ansichten selbst — die sind
   * keine HTML-Elemente, CSS erreicht sie nicht. `prefers-reduced-motion`
   * laesst sich aber nur hier beantworten, also wird es hier abgefragt und
   * gemeldet, beim Start und wenn die Person die Einstellung im laufenden
   * Betrieb umstellt.
   */
  useEffect(() => {
    const abfrage = window.matchMedia('(prefers-reduced-motion: reduce)');
    const melde = () => {
      window.shell.bewegung.reduziert(abfrage.matches);
      // Auch hier gebraucht: der Uebergang vom Symbol zum Werkzeug ist die
      // groesste Bewegung der Huelle und faellt dann als Erstes weg.
      setWenigerBewegung(abfrage.matches);
    };
    melde();
    abfrage.addEventListener('change', melde);
    return () => abfrage.removeEventListener('change', melde);
  }, []);

  // Die Seite traegt die gewaehlte Sprache, damit Vorlesewerkzeuge und die
  // Silbentrennung des Browsers wissen, woran sie sind.
  useEffect(() => {
    document.documentElement.lang = sprache;
  }, [sprache]);

  const umschalten = useCallback(() => {
    void window.shell.fenster.maximierenUmschalten().then(setMaximiert);
  }, []);

  /**
   * Wechselt das Werkzeug. Der Hauptprozess montiert beim ersten Mal und legt
   * die Ansicht ueber die Huelle; hier wird nur noch gemerkt, was sichtbar
   * ist.
   */
  /*
   * Antwortet, wenn das Werkzeug wirklich steht.
   *
   * Fast alle Aufrufer werfen die Antwort weg — sie wollen nur hinwechseln.
   * Die Suche nicht: ihr Sprung kommt ins Leere, wenn er vor der Montage
   * ankommt, und stillschweigend.
   */
  const waehle = useCallback((id: string | null, von?: DOMRect, ausVerlauf = false): Promise<void> => {
    setAktiv(id);
    // Ein Schritt aus dem Verlauf traegt sich nicht selbst wieder ein, sonst
    // haenge man beim Zurueckgehen fest.
    if (!ausVerlauf) verlauf.current = besuche(verlauf.current, { app: id });
    zieheVerlaufNach();
    if (id === null) {
      setBuehne({ zustand: 'laedt' });
      setUebergang(null);
      return window.shell.app.startmenue().then(() => undefined);
    }
    setBuehne({ zustand: 'laedt' });

    /*
     * Der Uebergang: das Symbol der Kachel waechst ueber den Schirm.
     *
     * Nur, wenn der Klick von einer Kachel kam — ueber die Schiene wechselt
     * man staendig hin und her, und dort waere jedes Mal eine grosse
     * Bewegung eine Zumutung.
     *
     * Der Hauptprozess montiert waehrenddessen. Damit er die Ansicht nicht
     * mitten in die Animation schiebt, bekommt er die Dauer mit und wartet
     * sie ab — er verliert dadurch keine Zeit, er montiert ja parallel.
     */
    const mitBewegung = Boolean(von) && !wenigerBewegung;
    if (mitBewegung && von) setUebergang({ id, von, phase: 'waechst' });

    return window.shell.app
      .zeigen(id, mitBewegung ? UEBERGANG_MS : 0)
      .then((ergebnis) => {
        setUebergang(null);
        setBuehne(ergebnis);
        // Erst wenn das Werkzeug wirklich da ist. Eine Einfuehrung vor einer
        // Fehlermeldung waere die falsche Reihenfolge.
        if (ergebnis.zustand === 'offen') {
          zeigeEinfuehrung(id);
          setMontierte((vorher) => (vorher.has(id) ? vorher : new Set(vorher).add(id)));
        }
      })
      // Der Hauptprozess faengt Montagefehler selbst ab und meldet sie als
      // Zustand. Bleibt trotzdem eine Ablehnung uebrig, ist etwas an der
      // Bruecke kaputt — auch das gehoert auf den Schirm und nicht ins Nichts.
      .catch((fehler: unknown) => {
        console.error(`[shell] Werkzeug "${id}" liess sich nicht einbetten:`, fehler);
        setUebergang(null);
        setBuehne({
          zustand: 'fehler',
          grund: 'sonst',
          detail: fehler instanceof Error ? fehler.message : String(fehler)
        });
      });
  }, [wenigerBewegung, zeigeEinfuehrung, zieheVerlaufNach]);

  waehleRef.current = waehle;
  aktivRef.current = aktiv;

  /*
   * Gefaerbt wird NICHT hier.
   *
   * Der Hauptprozess spritzt die Regel in jede Ansicht — auch in diese. Ein
   * zweiter Weg nur fuer die Huelle ging schief, sobald die Einstellung von
   * woanders kam (aus einem Skript, aus dem Rauchtest): das Werkzeug wurde
   * hell, die Huelle blieb dunkel. Hier steht nur noch die Kennung, damit
   * der Waehler weiss, was gerade gilt.
   */
  useEffect(
    () => window.shell.einstellungen.beiThemawechselVonAussen(setThema),
    []
  );

  /*
   * Neues aus dem Raum, solange der Dialog „Teilen" zu ist: Nachrichten
   * anderer und angekommene Pakete. Der Zaehler steht am Knopf; beim
   * Oeffnen ist er weg.
   */
  const [ungelesen, setUngelesen] = useState(0);
  const dialogJetzt = useRef(dialog);
  dialogJetzt.current = dialog;
  // Pakete zaehlen nur, wenn eines dazukommt; ein angenommenes, das aus der
  // Liste verschwindet, ist nichts Neues.
  const paketeVorher = useRef(0);
  // Im Raum: ein gruener Knopf links neben „Teilen" mit Raumname und Zahl
  // der Personen; ein Klick oeffnet den Raum.
  const [imRaum, setImRaum] = useState<{ raum: string; personen: number; ping: number | null } | null>(null);
  /*
   * Ein Raumfehler bei geschlossenem Dialog (etwa: Verbindung abgerissen).
   * Er steht dann in der Titelleiste, bis Teilen geoeffnet wird, und der
   * Dialog zeigt ihn beim Oeffnen (Testbericht: sonst verschwand nur der
   * gruene Knopf).
   */
  const [raumFehler, setRaumFehler] = useState<string | null>(null);
  useEffect(() => {
    const setze = (z: { rolle: string; raum: string; personen: readonly unknown[]; ping: number | null }) =>
      setImRaum(z.rolle === 'aus' ? null : { raum: z.raum, personen: z.personen.length, ping: z.ping });
    void window.shell.raum.zustand().then((s) => setze(s.zustand), () => undefined);
    return window.shell.raum.beiEreignis((e) => {
      if (e.art === 'zustand') {
        setze(e.zustand);
        if (e.zustand.rolle !== 'aus') setRaumFehler(null);
      } else if (e.art === 'fehler') {
        if (dialogJetzt.current !== 'teilen') setRaumFehler(e.grund);
      } else if (e.art === 'ping') setImRaum((alt) => (alt && alt.ping !== e.ping ? { ...alt, ping: e.ping } : alt));
    });
  }, []);
  useEffect(
    () =>
      window.shell.raum.beiEreignis((e) => {
        if (e.art === 'pakete') {
          const neu = e.pakete.length - paketeVorher.current;
          paketeVorher.current = e.pakete.length;
          if (neu > 0 && dialogJetzt.current !== 'teilen') setUngelesen((n) => n + neu);
          return;
        }
        if (dialogJetzt.current === 'teilen') return;
        // Chat, auch Wuerfe aus dem Wuerfel-Werkzeug: sie kommen als Chat an.
        // Ein Paket zaehlt schon ueber die Liste der Pakete, seine Chatzeile nicht noch einmal.
        if (e.art === 'chat' && !e.zeile.eigene && !e.zeile.dateien) setUngelesen((n) => n + 1);
      }),
    []
  );
  useEffect(() => {
    if (dialog === 'teilen') setUngelesen(0);
  }, [dialog]);

  const setzeGroesse = useCallback(async (prozent: number) => {
    const e = await window.shell.einstellungen.schreiben({ groesse: prozent });
    setGroesse(e.groesse);
  }, []);

  const setzeThema = useCallback(async (neu: string) => {
    // Nur schreiben. Das Faerben und die Rueckmeldung kommen vom
    // Hauptprozess, auf demselben Weg wie bei jeder anderen Aenderung.
    await window.shell.einstellungen.schreiben({ thema: neu });
  }, []);

  /*
   * Strg+K oeffnet die Suche.
   *
   * Am `window` der Huelle und zusaetzlich aus den Werkzeugen gemeldet: die
   * Tastendruecke einer eingebetteten Ansicht erreichen die Huelle nicht,
   * wenn dort der Fokus liegt. Denselben Weg gehen schon die Daumentasten
   * der Maus.
   */
  const oeffneSuche = useCallback(() => {
    setSucheLaedt(true);
    zeigeDialog('suche');
    void window.shell.suche
      .eintraege()
      .then(setEintraege, () => setEintraege([]))
      .finally(() => setSucheLaedt(false));
  }, [zeigeDialog]);

  useEffect(() => {
    const beiTaste = (ereignis: KeyboardEvent) => {
      if ((ereignis.ctrlKey || ereignis.metaKey) && ereignis.altKey) {
        const stufe = groessenTaste(ereignis.key, ereignis.code);
        if (stufe) {
          ereignis.preventDefault();
          window.shell.einstellungen.groesseTaste(stufe);
          return;
        }
      }
      if ((ereignis.ctrlKey || ereignis.metaKey) && ereignis.key.toLowerCase() === 'k') {
        ereignis.preventDefault();
        oeffneSuche();
      }
      // F6: aus der Hülle ins offene Werkzeug (und von dort mit F6 zurück).
      if (ereignis.key === 'F6' && !ereignis.ctrlKey && !ereignis.altKey && !ereignis.metaKey && !ereignis.shiftKey) {
        ereignis.preventDefault();
        window.shell.fokus.zumWerkzeug();
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [oeffneSuche]);

  useEffect(() => window.shell.suche.beiTastenkuerzel(oeffneSuche), [oeffneSuche]);

  // F6 im Werkzeug: der Fokus landet auf dem aktiven Eintrag der Schiene.
  useEffect(
    () =>
      window.shell.fokus.beiHuelle(() => {
        const ziel =
          document.querySelector<HTMLElement>('.schiene__eintrag--an') ?? document.querySelector<HTMLElement>('.schiene__heim');
        ziel?.focus();
      }),
    []
  );
  useEffect(() => window.shell.einstellungen.beiGroesseVonAussen(setGroesse), []);

  const ladeSymboleNeu = useCallback(async () => {
    setSymbole(await window.shell.symbole.lesen());
  }, []);

  const setzeSprache = useCallback(async (neu: Language) => {
    const gespeichert = await window.shell.einstellungen.schreiben({ language: neu });
    // Angezeigt wird, was wirklich gespeichert wurde, nicht was angeklickt
    // wurde.
    setSprache(gespeichert.language);
  }, []);

  const setzeKi = useCallback(async (aenderung: Partial<KiEinstellungen>) => {
    const gespeichert = await window.shell.einstellungen.schreiben({ ki: { ...ki, ...aenderung } });
    // Angezeigt wird, was wirklich gespeichert wurde, nicht was angeklickt
    // wurde: `sanitizeSettings` raeumt ungueltige Werte weg.
    setKi(gespeichert.ki);
    // Der alte Befund gilt fuer die alte Einstellung. Ihn stehen zu lassen
    // waere die unangenehmere Sorte Fehler: er sagt "bereit" ueber etwas,
    // das gar nicht mehr eingestellt ist.
    setKiZustand(null);
  }, [ki]);

  const pruefeKi = useCallback(async () => {
    setKiZustand(await window.shell.ki.status());
  }, []);

  const setzeSchluessel = useCallback(async (schluessel: string) => {
    await window.shell.ki.setzeSchluessel(schluessel);
    setKiZustand(await window.shell.ki.status());
  }, []);

  const eintrag = aktiv ? findApp(aktiv) : undefined;

  return (
    <div className="huelle">
      <header
        className="titelleiste"
        style={{ height: CHROME.titelleisteHoehe }}
        onDoubleClick={umschalten}
      >
        <span className="titelleiste__marke" aria-hidden="true">
          <SuiteIcon size={18} />
        </span>
        {/*
         * Zurueck und vorwaerts zum Anfassen.
         *
         * Die Daumentasten der Maus sind der bequemere Weg, aber sie haengen
         * am Geraet und am System — auf dem Windows-Rechner kam in einem
         * offenen Werkzeug nichts an. Zwei Knoepfe haengen an nichts.
         *
         * Sie stehen links neben dem Namen, wo sie in jedem Browser stehen.
         */}
        <span className="titelleiste__verlauf">
          <button
            type="button"
            className="titelleiste__pfeil"
            aria-label={t('verlauf.zurueck')}
            title={t('verlauf.zurueck')}
            disabled={!verlaufsStand.zurueck}
            onClick={() => geheZu('zurueck')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M7.5 2 L3.5 6 L7.5 10" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            className="titelleiste__pfeil"
            aria-label={t('verlauf.vorwaerts')}
            title={t('verlauf.vorwaerts')}
            disabled={!verlaufsStand.vorwaerts}
            onClick={() => geheZu('vorwaerts')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4.5 2 L8.5 6 L4.5 10" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </span>
        <span className="titelleiste__name" title={t('menu.subtitle')}>
          LORE
        </span>
        {eintrag && <span className="titelleiste__pfad">› {t(nameKey(eintrag.id))}</span>}
        <span className="titelleiste__fueller" />
        {!imRaum && raumFehler && (
          <button
            type="button"
            className="titelleiste__knopf titelleiste__raumweg motion-erscheinen"
            data-raum-fehler-titel
            title={t(`room.error.${raumFehler}` as MessageKey)}
            onClick={() => zeigeDialog('teilen')}
          >
            ⚠ {t(`room.error.${raumFehler}` as MessageKey)}
          </button>
        )}
        {imRaum && (
          <button
            type="button"
            className="titelleiste__knopf titelleiste__raum motion-erscheinen"
            data-im-raum
            title={t('title.inRoom', { raum: imRaum.raum, n: imRaum.personen })}
            onClick={() => zeigeDialog('teilen')}
          >
            <span className="titelleiste__raumpunkt" aria-hidden="true" />
            <span className="titelleiste__raumname">{imRaum.raum}</span>
            <span className="titelleiste__raumzahl">{imRaum.personen}</span>
            {imRaum.ping !== null && (
              <span className="titelleiste__raumzahl" data-titel-ping>
                · {imRaum.ping} ms
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          className={sitzungLaeuft ? 'titelleiste__knopf titelleiste__sitzung' : 'titelleiste__knopf'}
          data-protokoll-knopf
          title={sitzungLaeuft ? t('session.badge') : t('session.title')}
          onClick={() => zeigeDialog('protokoll')}
        >
          {sitzungLaeuft ? '●' : '○'} {t('title.session')}
          {sitzungLaeuft && sitzungLaeuft.anzahl > 0 ? <span className="titelleiste__raumzahl"> {sitzungLaeuft.anzahl}</span> : null}
        </button>
        <button type="button" className="titelleiste__knopf titelleiste__knopf--symbol" data-teilen-knopf onClick={() => zeigeDialog('teilen')}>
          <AppSymbol id="austausch" size={16} bild={symbole.austausch} />
          {t('title.share')}
          {ungelesen > 0 && (
            <span className="titelleiste__zahl" data-ungelesen aria-label={t('share.unread', { n: ungelesen })}>
              {ungelesen > 99 ? '99+' : ungelesen}
            </span>
          )}
        </button>
        <button
          type="button"
          className="titelleiste__knopf"
          data-einstellungen-knopf
          onClick={() => zeigeDialog('einstellungen')}
        >
          {t('title.settings')}
        </button>
        <button type="button" className="titelleiste__knopf" data-ueber-knopf onClick={() => zeigeDialog('ueber')}>
          {t('title.about')}
        </button>
        <div className="fensterknoepfe">
          <button
            type="button"
            className="fensterknopf"
            aria-label={t('window.minimize')}
            onClick={() => void window.shell.fenster.minimieren()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            type="button"
            className="fensterknopf"
            aria-label={maximiert ? t('window.restore') : t('window.maximize')}
            onClick={umschalten}
          >
            {maximiert ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="3" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 3 V1 H9 V7 H7" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="fensterknopf fensterknopf--schliessen"
            aria-label={t('window.close')}
            onClick={() => void window.shell.fenster.schliessen()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </header>

      {eintrag ? (
        <Buehne
          eintrag={eintrag}
          aktiv={aktiv!}
          setAktiv={waehle}
          buehne={buehne}
          // Waehrend der Uebergang laeuft, traegt er die Ladeanzeige selbst.
          // Ohne das stuenden zwei gleichzeitig da: eine im wachsenden Feld
          // und eine daneben auf der Flaeche.
          uebergangLaeuft={uebergang !== null}
          symbole={symbole}
          t={t}
        />
      ) : (
        <Startmenue setAktiv={waehle} version={version} symbole={symbole} t={t} />
      )}

      {uebergang ? (
        <UebergangsFeld
          eintrag={uebergang}
          dauerMs={UEBERGANG_MS}
          onAusgewachsen={() =>
            setUebergang((vorher) => (vorher ? { ...vorher, phase: 'wartet' } : vorher))
          }
          bild={symbole[uebergang.id]}
          t={t}
        />
      ) : null}

      {dialog === 'einstellungen' && (
        <Einstellungen
          sprache={sprache}
          setzeSprache={setzeSprache}
          thema={thema}
          setzeThema={setzeThema}
          groesse={groesse}
          setzeGroesse={setzeGroesse}
          ki={ki}
          setzeKi={setzeKi}
          kiZustand={kiZustand}
          pruefeKi={pruefeKi}
          setzeSchluessel={setzeSchluessel}
          symbole={symbole}
          symbolordnerOeffnen={() => window.shell.symbole.ordnerOeffnen()}
          symboleNeuLaden={ladeSymboleNeu}
          einfuehrungenZuruecksetzen={setzeEinfuehrungenZurueck}
          sichern={() => window.shell.sicherung.schreiben()}
          datenordnerOeffnen={() => window.shell.sicherung.ordnerOeffnen()}
          /*
           * ALLE waehlbaren Werkzeuge, nicht nur die laufenden.
           *
           * Vorher standen hier nur die montierten — mit dem Grund, dass
           * ein nie geoeffnetes Werkzeug seine Einstellungen noch nicht
           * geladen hat und nichts beantworten koennte. Der Grund stimmt,
           * die Folge war trotzdem falsch: die Liste sah je nach
           * Vorgeschichte anders aus, und man musste ein Werkzeug oeffnen,
           * bevor man es einstellen konnte. Das ist verkehrt herum.
           *
           * Jetzt stehen alle da, die eigene Einstellungen HABEN; wer eines
           * waehlt, das nicht laeuft, bekommt statt der Felder einen Knopf,
           * der es oeffnet. Werkzeuge ohne eigene Einstellungen stehen gar
           * nicht in der Liste — eine leere Seite je Werkzeug war Rauschen.
           */
          werkzeuge={APPS.filter((app) => istWaehlbar(app.status) && app.einstellungen).map((app) => ({
            id: app.id,
            name: t(nameKey(app.id)),
            laeuft: montierte.has(app.id)
          }))}
          werkzeugOeffnen={async (appId) => {
            // Den Dialog zumachen, sonst laege er ueber dem Werkzeug, das
            // gerade hochkommt. Er ist ohnehin gleich wieder offen.
            zeigeDialog(null);
            await waehle(appId);
          }}
          werkzeugEinstellungen={(appId) => window.shell.werkzeug.einstellungen(appId)}
          werkzeugSetzen={(appId, feldId, wert) =>
            window.shell.werkzeug.setzen(appId, feldId, wert)
          }
          werkzeugBefehl={(appId, befehlId, wert) =>
            window.shell.werkzeug.befehl(appId, befehlId, wert)
          }
          onClose={() => zeigeDialog(null)}
          t={t}
        />
      )}
      {dialog === 'protokoll' && <Protokoll onClose={() => zeigeDialog(null)} t={t} />}
      {dialog === 'teilen' && (
        <Austausch
          onClose={() => {
            setRaumFehler(null);
            zeigeDialog(null);
          }}
          t={t}
          symbole={symbole}
          anfangsFehler={raumFehler}
        />
      )}

      {dialog === 'suche' && (
        <Suche
          eintraege={[...appEintraege, ...eintraege]}
          laedt={sucheLaedt}
          onWahl={(eintrag) => {
            /*
             * Eine Anwendung ist selbst ein Treffer.
             *
             * Wer „Inspiration" tippt, meint meistens die Anwendung und
             * nicht eine Notiz darin. Dann gibt es nichts zu zeigen — das
             * Oeffnen IST das Ergebnis.
             */
            if (eintrag.werkzeug === WERKZEUG_APP) {
              void waehle(eintrag.kennung);
              return;
            }
            // Erst hin, dann zeigen — und zwar abgewartet: die Huelle
            // schickt den Sprung an das montierte Werkzeug, und montiert
            // ist es erst, wenn `waehle` antwortet. Ohne das `await` kam
            // der Sprung vor der Montage an und fiel lautlos weg.
            void waehle(eintrag.werkzeug).then(() =>
              window.shell.suche.zeige(eintrag.werkzeug, eintrag.kennung)
            );
          }}
          onClose={() => zeigeDialog(null)}
          t={t}
        />
      )}
      {dialog === 'ueber' && (
        <Ueber version={version} onClose={() => zeigeDialog(null)} t={t} sprache={sprache} />
      )}
      {dialog === 'einfuehrung' && einfuehrungId !== null && (
        <Einfuehrung
          inhalt={einfuehrungFuer(einfuehrungId)!}
          sprache={sprache}
          bild={symbole[einfuehrungId]}
          onClose={schliesseEinfuehrung}
          t={t}
        />
      )}
    </div>
  );
}

function Startmenue({
  setAktiv,
  version,
  symbole,
  t
}: {
  /**
   * `von` ist die Flaeche der angeklickten Kachel.
   *
   * Der Uebergang beginnt dort und nicht in der Bildmitte: so verbindet er
   * die Kachel mit dem Werkzeug, das daraus wird, statt nur ein Effekt zu
   * sein.
   */
  setAktiv: (id: string, von: DOMRect) => void;
  version: string;
  /** Eigene Symbole je Kennung. Fehlt eines, gilt das eingebaute. */
  symbole: Record<string, string>;
  t: Uebersetzer;
}) {
  return (
    <main className="menue">
      {/*
        Oben der Titel — oder ein Banner, sobald eines da ist. Es kommt
        denselben Weg wie die Symbole: `banner.png` im Symbolordner, der
        mitgelieferte oder der eigene im Datenordner.
      */}
      {symbole.banner ? (
        <img className="menue__banner" src={symbole.banner} alt={t('menu.title')} />
      ) : (
        <h1 className="menue__titel">{t('menu.title')}</h1>
      )}
      {/* Das Banner traegt den Untertitel schon selbst (Rueckmeldung). */}
      {symbole.banner ? null : <p className="menue__untertitel">{t('menu.subtitle')}</p>}

      {/*
        Nach Rolle am Tisch gruppiert statt alle neun nebeneinander.
        Neun Kacheln in einer Reihe sind eine Wand; in zwei benannten
        Gruppen findet man, was man sucht, ohne jedes Mal alle zu lesen.

        Eine Sortierung, keine Sperre: jede Kachel bleibt anklickbar, und
        wer als Spielleitung am Story Creator schreibt, findet ihn da, wo
        er immer war.

        Die Verzoegerung laeuft ueber alle Gruppen hinweg weiter — sonst
        finge die zweite Gruppe wieder bei null an und die Seite baute sich
        zweimal auf.
      */}
      {(() => {
        let nummer = -1;
        return ROLLEN.map((rolle) => {
          const gruppe = appsMitRolle(rolle);
          if (gruppe.length === 0) return null;
          return (
            <section className="menue__gruppe" key={rolle}>
              <h2 className="menue__gruppenname">{t(ROLLE_KEY[rolle])}</h2>
              <div className="kacheln" data-pfeile="raster">
                {gruppe.map((app) => {
                  const waehlbar = istWaehlbar(app.status);
                  nummer += 1;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      // Damit die Rauchtests eine Kachel ueber ihr Werkzeug
                      // finden und nicht ueber die Position: die Reihenfolge
                      // hat sich schon zweimal geaendert, und beide Male
                      // klickten Tests danach auf das falsche Werkzeug.
                      data-app={app.id}
                      className={`kachel kachel--${app.status} motion-eintritt`}
                      // Gestaffelt, damit das Menue sich aufbaut statt
                      // aufzublitzen. Kurz gehalten: die letzte Kachel darf
                      // nicht spuerbar spaeter da sein als die erste, sonst
                      // wartet man auf sie.
                      style={{ animationDelay: `${nummer * 35}ms` }}
                      disabled={!waehlbar}
                      onClick={(ereignis) =>
                        setAktiv(app.id, ereignis.currentTarget.getBoundingClientRect())
                      }
                    >
                      <span className="kachel__icon">
                        <AppSymbol id={app.id} size={64} bild={symbole[app.id]} />
                      </span>
                      <span className="kachel__name">{t(nameKey(app.id))}</span>
                      <span className="kachel__text">{t(descriptionKey(app.id))}</span>
                      {/* „Bereit" sagt nichts, was die Kachel nicht schon sagt. */}
                      {app.status === 'bereit' ? null : (
                        <span className="kachel__marke">{t(STATUS_KEY[app.status])}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        });
      })()}

      {version && <p className="menue__version">{t('menu.version', { version })}</p>}
    </main>
  );
}

function Buehne({
  eintrag,
  aktiv,
  setAktiv,
  buehne,
  uebergangLaeuft,
  symbole,
  t
}: {
  eintrag: { id: string };
  aktiv: string;
  setAktiv: (id: string | null) => void;
  buehne: BuehnenZustand;
  uebergangLaeuft: boolean;
  symbole: Record<string, string>;
  t: Uebersetzer;
}) {
  const schiene = useRef<HTMLElement>(null);
  /** Wo der Marker steht (in Bildpunkten von oben), oder `null` vor der ersten Messung. */
  const [markeOben, setMarkeOben] = useState<number | null>(null);
  /**
   * Ob der Marker seine erste Stelle schon gefunden hat.
   *
   * Beim ersten Zeichnen darf er nicht wandern: er kaeme sonst von der
   * Oberkante der Schiene hereingefahren, obwohl gar nichts gewechselt hat.
   * Die Fahrt schaltet sich erst danach ein.
   */
  const gesetzt = useRef(false);
  const [wandert, setWandert] = useState(false);
  /*
   * Welche Werkzeuge gerade etwas gemeldet haben.
   *
   * Eine Farbe wischt ueber ihr Symbol und sagt: dort ist etwas dazugekommen.
   * Die Anzeige gehoert in die Huelle und nicht in die meldende Anwendung —
   * sie soll ueberall gleich aussehen, gleich wer sie ausloest.
   */
  const [gemeldet, setGemeldet] = useState<readonly string[]>([]);

  /**
   * Nimmt ein Werkzeug wieder aus der Meldung.
   *
   * Muss passieren, sonst liefe die Animation nur ein einziges Mal: eine
   * Klasse, die stehen bleibt, startet nicht neu.
   */
  const wischFertig = useCallback((id: string) => {
    setGemeldet((vorher) => vorher.filter((eintrag) => eintrag !== id));
  }, []);

  useEffect(() => {
    const notbremse = new Map<string, number>();
    const ab = window.shell?.app?.beiEreignis?.((id) => {
      setGemeldet((vorher) => (vorher.includes(id) ? vorher : [...vorher, id]));
      /*
       * Abgeraeumt wird, wenn die Animation zu Ende ist — sie meldet das
       * selbst (siehe onAnimationEnd an der Schiene).
       *
       * Vorher stand hier ein Zeitgeber mit 1400 ms, waehrend die CSS zwei
       * Durchgaenge zu 1100 ms lief: der zweite Wisch fing an und brach
       * mitten drin ab. Zwei Zahlen, die zusammenpassen mussten und es nicht
       * taten.
       *
       * Der Zeitgeber bleibt als Notbremse, deutlich laenger als die
       * Animation. Er greift nur, wenn gar kein `animationend` kommt — etwa
       * weil das Symbol waehrenddessen aus der Schiene verschwindet. Ohne ihn
       * bliebe die Farbe dann fuer immer stehen.
       */
      window.clearTimeout(notbremse.get(id));
      notbremse.set(id, window.setTimeout(() => wischFertig(id), 4000));
    });
    return () => {
      ab?.();
      for (const nummer of notbremse.values()) window.clearTimeout(nummer);
    };
  }, [wischFertig]);

  // Gemessen statt gerechnet: die Stelle haengt an Knopfhoehen, Abstaenden und
  // dem Trenner. Eine Formel dafuer waere bei der naechsten Aenderung an der
  // Schiene still falsch.
  useLayoutEffect(() => {
    const an = schiene.current?.querySelector<HTMLElement>('.schiene__eintrag--an');
    if (!an) {
      setMarkeOben(null);
      return;
    }
    setMarkeOben(an.offsetTop);
    if (gesetzt.current) setWandert(true);
    gesetzt.current = true;
  }, [aktiv]);

  return (
    <div className="buehne">
      <nav
        className="schiene"
        data-pfeile="liste"
        style={{ width: CHROME.schieneBreite }}
        aria-label="LORE"
        ref={schiene}
      >
        {markeOben !== null && (
          <span
            className={`schiene__marke ${wandert ? 'schiene__marke--wandert' : ''}`}
            style={{ transform: `translateY(${markeOben}px)` }}
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          className="schiene__heim"
          aria-label={t('rail.home')}
          title={t('rail.homeShort')}
          onClick={() => setAktiv(null)}
        >
          <SuiteIcon size={22} />
        </button>
        <span className="schiene__trenner" />
        {APPS.map((app) => {
          const waehlbar = istWaehlbar(app.status);
          const name = t(nameKey(app.id));
          return (
            <button
              key={app.id}
              type="button"
              data-schiene={app.id}
              className={`schiene__eintrag ${app.id === aktiv ? 'schiene__eintrag--an' : ''} ${
                waehlbar ? '' : 'schiene__eintrag--geplant'
              } ${gemeldet.includes(app.id) ? 'schiene__eintrag--gemeldet' : ''}`}
              disabled={!waehlbar}
              aria-current={app.id === aktiv ? 'page' : undefined}
              title={waehlbar ? name : `${name} — ${t(STATUS_KEY[app.status])}`}
              // Ohne Flaeche: ueber die Schiene wechselt man staendig hin und
              // her, und dort waere das grosse Wachsen jedes Mal eine
              // Zumutung. Der Uebergang gehoert dem Startmenue.
              onClick={() => setAktiv(app.id)}
              // Die Animation liegt auf ::after; ihr Ende steigt bis hierher
              // auf. So bleibt die Dauer allein in der CSS.
              onAnimationEnd={() => wischFertig(app.id)}
            >
              <AppSymbol id={app.id} size={26} bild={symbole[app.id]} />
            </button>
          );
        })}
      </nav>

      {/*
        Liegt eine Anwendung vor der Huelle, ist hier nichts zu zeigen: ihre
        Ansicht deckt die Flaeche vollstaendig ab. Ein Text an dieser Stelle
        waere unsichtbar, aber Vorlesewerkzeuge laesen ihn vor.
      */}
      {buehne.zustand === 'laedt' && uebergangLaeuft ? (
        // Der Uebergang deckt die Flaeche ohnehin ab und zeigt dort selbst,
        // dass geladen wird.
        <div className="buehne__flaeche" aria-hidden="true" />
      ) : buehne.zustand === 'laedt' ? (
        /*
         * Waehrend ein Werkzeug laedt, soll man sehen, dass etwas passiert.
         * Vorher blieb die Flaeche leer, und ein langsamer Start sah aus wie
         * ein haengendes Programm.
         *
         * Mit Text daneben, nicht nur mit dem Kreis: ein Kreis allein sagt
         * "es tut sich etwas", ein Text sagt, was. Bei weniger Bewegung
         * bleibt nur der Text (siehe styles.css) — dann steht da immer noch
         * etwas.
         */
        <main className="laedt" role="status">
          <span className="laedt__kreis" aria-hidden="true" />
          <p className="laedt__text">{t('stage.loading', { name: t(nameKey(eintrag.id)) })}</p>
        </main>
      ) : buehne.zustand === 'offen' ? (
        <div className="buehne__flaeche" aria-hidden="true" />
      ) : buehne.zustand === 'fehler' ? (
        <main className="stoerung" role="alert">
          <p className="stoerung__titel">
            {t('stage.failed.title', { name: t(nameKey(eintrag.id)) })}
          </p>
          <p className="stoerung__text">
            {t(buehne.grund === 'dateien-fehlen' ? 'stage.failed.missing' : 'stage.failed.other')}
          </p>
          {/* Die Rohmeldung bleibt sichtbar: sie ist das Einzige, womit sich
              ein Fall weiterverfolgen laesst, den die beiden Saetze oben nicht
              treffen. */}
          <p className="stoerung__detail">{t('stage.failed.detail', { detail: buehne.detail })}</p>
          <button type="button" className="stoerung__knopf" onClick={() => setAktiv(eintrag.id)}>
            {t('stage.failed.retry')}
          </button>
        </main>
      ) : (
        <main className="platzhalter">
          <p className="platzhalter__name">{t(nameKey(eintrag.id))}</p>
          <p className="platzhalter__text">{t(descriptionKey(eintrag.id))}</p>
          <p className="platzhalter__hinweis">{t('stage.placeholder')}</p>
        </main>
      )}
    </div>
  );
}


/**
 * Das Symbol der angeklickten Kachel, das ueber den Schirm waechst.
 *
 * Beginnt genau dort, wo die Kachel lag, und endet im ganzen Fenster. Ist
 * das Werkzeug dann noch nicht da, steht im ausgewachsenen Feld der
 * Ladekreis — der Uebergang traegt also zweierlei: er verbindet die Kachel
 * mit dem Werkzeug, und er ueberbrueckt die Zeit, in der sonst nichts zu
 * sehen waere.
 */
function UebergangsFeld({
  eintrag,
  dauerMs,
  onAusgewachsen,
  bild,
  t
}: {
  eintrag: { id: string; von: DOMRect; phase: 'waechst' | 'wartet' };
  dauerMs: number;
  onAusgewachsen: () => void;
  bild?: string;
  t: Uebersetzer;
}) {
  const [gross, setGross] = useState(false);

  /*
   * Erst im naechsten Bild wachsen lassen.
   *
   * Wird die Endgroesse im selben Durchgang gesetzt wie die Startgroesse,
   * sieht der Browser nur den Endzustand und es gibt gar keinen Uebergang.
   * Zwei `requestAnimationFrame`, weil eines nicht reicht: React zeichnet im
   * ersten, der Browser uebernimmt die Startwerte erst danach.
   */
  useEffect(() => {
    let zweites = 0;
    const erstes = requestAnimationFrame(() => {
      zweites = requestAnimationFrame(() => setGross(true));
    });
    return () => {
      cancelAnimationFrame(erstes);
      cancelAnimationFrame(zweites);
    };
  }, []);

  return (
    <div
      className={`uebergang ${gross ? 'uebergang--gross' : ''}`}
      /*
       * Die Dauer kommt als CSS-Variable aus dem Code, nicht aus der
       * Stilvorlage: dieselbe Zahl bekommt der Hauptprozess mit, damit er die
       * Ansicht nicht mitten in die Animation schiebt. Zwei Zahlen an zwei
       * Stellen liefen frueher oder spaeter auseinander.
       */
      style={{
        ['--uebergang-dauer' as string]: `${dauerMs}ms`,
        ...(gross
          ? {}
          : {
              left: eintrag.von.left,
              top: eintrag.von.top,
              width: eintrag.von.width,
              height: eintrag.von.height
            })
      }}
      onTransitionEnd={(ereignis) => {
        // Nur auf die Breite hoeren: alle vier Kanten melden sich, und drei
        // Meldungen davon sind dieselbe Nachricht.
        if (ereignis.propertyName === 'width') onAusgewachsen();
      }}
      aria-hidden="true"
    >
      <span className="uebergang__icon">
        <AppSymbol id={eintrag.id} size={64} bild={bild} />
      </span>
      {eintrag.phase === 'wartet' ? (
        <span className="uebergang__warten">
          <span className="laedt__kreis" />
          <span className="laedt__text">{t('stage.loading', { name: t(nameKey(eintrag.id)) })}</span>
        </span>
      ) : null}
    </div>
  );
}
