/**
 * Die Inspirationshilfe.
 *
 * Sechs Bausteine, ein Knopf. Der Anspruch ist derselbe wie beim NPC
 * Creator: es wird benutzt, waehrend die Gruppe schon am Tisch sitzt. Wer
 * erst zwanzig Felder ausfuellen muss, macht es einmal auf.
 *
 * Die vier Regler oben sind freie Felder mit Vorschlagsliste. Bekannte
 * Begriffe verengen die Tabellen, unbekannte lassen sie offen — beides ohne
 * Fehlermeldung. Eine feste Auswahl verbaute jeden Tisch, der etwas anderes
 * spielt.
 *
 * Jeder Baustein hat ein Schloss. Ohne das wuerfelt man den guten Aufhaenger
 * weg, waehrend man die Fraktionen sucht.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BAUSTEINE,
  erzeugeAufhaenger,
  erzeugeEntwurf,
  erzeugeFrist,
  erzeugeFigur,
  erzeugeFraktion,
  erzeugeOrt,
  erzeugeVerbindung,
  ersetzeFigur,
  fuegeFigurHinzu,
  benenneFigurUm,
  mitFreiemNamen,
  moeglichkeiten,
  vergebeneNamen,
  type Baustein,
  type Entwurf
} from '../shared/erzeuge';
import type { EntwurfsFigur, Fraktion, Ort, Verbindung } from '../shared/erzeuge';
import { alsKartennotizen, alsMarkdown, alsNotizen, doppelteTitel } from '../shared/notizen';
import { ZEITMARKEN } from '../shared/zeitstrahl';
// `beschriftung` heisst hier schon etwas anderes (der Text eines Paares).
import { berechneGeflecht } from '../shared/geflecht';
import { GeflechtBild, GeflechtVollbild } from './Geflecht';
import type { KiAufgabe, RohEntwurf } from '../shared/kiAufgaben';
import { baueEntwurf } from '../shared/uebernahme';
import {
  REGION_TEXTE,
  THEMA_TEXTE,
  TONFALL_TEXTE,
  UMFAENGE,
  UMFANG_TEXTE,
  alsRegionId,
  alsThemaId,
  alsTonfallId,
  text,
  type Paar,
  type UmfangId,
  type Zuschnitt
} from '../shared/tabellen';
import { getLanguage, onLanguageChange, t, type Language, type TextKey } from './i18n';
import { api } from './api';

/** Der Zufall dieses Werkzeugs. Die Erzeuger bekommen ihn uebergeben. */
const wuerfel = Math.random;

function beschriftung(paar: Paar, sprache: Language): string {
  return text(paar, sprache);
}

interface FeldProps {
  /** Die Beschriftung. Fehlt sie, steht der Wert fuer sich. */
  readonly name?: string;
  readonly wert: string;
  readonly aendere: (wert: string) => void;
  readonly klasse?: string;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Ein Feld, das man ueberschreiben kann.
 *
 * Alles im Entwurf ist von Hand aenderbar — der Wurf ist ein Vorschlag, kein
 * Ergebnis. Es sieht trotzdem nach Text aus und nicht nach Formular: ohne
 * Rahmen, ohne Hintergrund, bis man hineinklickt. Ein Entwurf, der wie ein
 * Antrag aussieht, liest sich am Tisch nicht.
 *
 * Ein `textarea` und kein `input`, weil die Saetze laenger sind als eine
 * Zeile; `field-sizing: content` im Stylesheet laesst es mitwachsen, statt
 * innen zu scrollen.
 */
function Feld({ name, wert, aendere, klasse, onFocus, onBlur }: FeldProps) {
  return (
    <label className={klasse ? `feld ${klasse}` : 'feld'}>
      {name && <span className="feld__name">{name}</span>}
      <textarea
        className="feld__wert"
        value={wert}
        rows={1}
        spellCheck
        onChange={(ereignis) => aendere(ereignis.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </label>
  );
}

export function App() {
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [festgehalten, setFestgehalten] = useState<readonly Baustein[]>([]);
  const [umfang, setUmfang] = useState<UmfangId>('bogen');
  const [regionText, setRegionText] = useState('');
  const [themaText, setThemaText] = useState('');
  const [tonfallText, setTonfallText] = useState('');
  const [titel, setTitel] = useState('');
  const [exportStand, setExportStand] = useState<'ruht' | 'laeuft' | 'fertig' | 'fehler'>('ruht');
  const [exportText, setExportText] = useState('');
  /** Wie viele Notizen beim letzten Uebernehmen schon da waren. */
  const [vorhanden, setVorhanden] = useState(0);
  const [kopiert, setKopiert] = useState(false);
  const [sprache, setSprache] = useState<Language>(getLanguage);
  /**
   * Ob eine KI eingerichtet ist.
   *
   * Ist sie es nicht, sind die Knoepfe gar nicht da — nicht ausgegraut.
   * Eingerichtet wird sie in der Huelle; ein grauer Knopf fuer etwas, das
   * man hier ohnehin nicht einschalten kann, waere eine Einladung zum
   * Suchen.
   */
  const [kiDa, setKiDa] = useState(false);
  /** Welche Stelle die KI gerade beantwortet, z. B. 'figur-2'. */
  const [kiLaeuft, setKiLaeuft] = useState<string | null>(null);
  const [kiFehler, setKiFehler] = useState<string | null>(null);
  /** Die Figuren der offenen Kampagne, wenn die Liste aufgeklappt ist. */
  const [kampagnenFiguren, setKampagnenFiguren] = useState<readonly { titel: string; kurz: string }[] | null>(
    null
  );
  /**
   * Ob es den Weg zum Karteneditor gibt.
   *
   * In der Huelle ja, am eigenen Entwicklungsserver nicht. Fehlt er, ist der
   * Knopf gar nicht da — ein ausgegrauter fuehrte zu der Frage, wo man ihn
   * einschaltet, und die Antwort waere „gar nicht".
   */
  const [karteDa, setKarteDa] = useState(false);

  useEffect(() => onLanguageChange(() => setSprache(getLanguage())), []);

  useEffect(() => {
    void api.karte.da().then(setKarteDa, () => setKarteDa(false));
  }, []);

  useEffect(() => {
    const frage = () => void api.ki.da().then(setKiDa, () => setKiDa(false));
    frage();
    // Und noch einmal, wenn die Einstellung sich aendert. Ohne das saehe man
    // die Knoepfe erst nach einem Neustart, wenn man die KI einschaltet.
    return api.ki.beiWechsel(frage);
  }, []);

  /**
   * Was eingestellt ist, als Marken.
   *
   * Getippt wird Text, gerechnet wird mit Marken. Unbekannter Text ergibt
   * eine leere Marke und damit „beliebig" — das ist kein Fehlerfall, sondern
   * der Normalfall fuer jede Welt, die nicht aus unserer Vorschlagsliste
   * stammt.
   */
  const zuschnitt: Zuschnitt = useMemo(
    () => ({
      umfang,
      region: alsRegionId(regionText),
      thema: alsThemaId(themaText),
      tonfall: alsTonfallId(tonfallText)
    }),
    [umfang, regionText, themaText, tonfallText]
  );

  /**
   * Das Geflecht als Bild.
   *
   * Die Liste darunter sagt, was zwischen zweien liegt; sie sagt nicht, wo
   * die Geschichte dicht ist und wer am Rand steht. Deshalb steht das Bild
   * ueber der Liste und nicht an ihrer Stelle — die Saetze selbst will man
   * lesen und aendern koennen.
   */
  const geflecht = useMemo(
    () => (entwurf ? berechneGeflecht(entwurf.figuren, entwurf.verbindungen) : null),
    [entwurf]
  );

  /**
   * Dieselbe Zeichnung gross, fuer das Vollbild.
   *
   * Neu gerechnet und nicht skaliert: die Anordnung haengt an der Flaeche.
   * Ein gedehntes Bild haette dieselben gedraengten Abstaende, nur groesser —
   * und genau die sind der Grund, warum man es gross ansehen will.
   *
   * Gerechnet wird erst, wenn das Vollbild offen ist. Bei jedem Wurf auf
   * Vorrat zu rechnen waere Arbeit fuer etwas, das meistens niemand oeffnet.
   */
  const [geflechtGross, setGeflechtGross] = useState(false);
  const grossesGeflecht = useMemo(
    () =>
      geflechtGross && entwurf
        ? berechneGeflecht(entwurf.figuren, entwurf.verbindungen, 1280, 760)
        : null,
    [geflechtGross, entwurf]
  );

  /**
   * Eigene Angaben, die in keiner Tabelle vorkommen.
   *
   * „Cyberpunk City" als Region ist voellig in Ordnung — nur kann das
   * Wuerfeln damit nichts anfangen: die Tabellen kennen Marken, keinen
   * freien Text. Ohne Hinweis wuerfelt man und wundert sich, warum nichts
   * davon nach Cyberpunk klingt.
   */
  const eigeneAngaben = useMemo(() => {
    const heraus: string[] = [];
    if (regionText.trim() && !alsRegionId(regionText)) heraus.push(regionText.trim());
    if (themaText.trim() && !alsThemaId(themaText)) heraus.push(themaText.trim());
    if (tonfallText.trim() && !alsTonfallId(tonfallText)) heraus.push(tonfallText.trim());
    return heraus;
  }, [regionText, themaText, tonfallText]);

  const zahlen = useMemo(() => moeglichkeiten(), []);
  const formatiert = useMemo(() => {
    const format = new Intl.NumberFormat(sprache === 'de' ? 'de-DE' : 'en-GB');
    return {
      aufhaenger: format.format(zahlen.aufhaenger),
      orte: format.format(zahlen.orte),
      figuren: format.format(zahlen.figuren)
    };
  }, [zahlen, sprache]);

  const wuerfleAlles = useCallback(() => {
    setEntwurf((vorher) => erzeugeEntwurf(zuschnitt, getLanguage(), wuerfel, festgehalten, vorher));
    setExportStand('ruht');
  }, [zuschnitt, festgehalten]);

  /**
   * Einen einzelnen Baustein neu wuerfeln.
   *
   * Sein eigenes Schloss zaehlt hier nicht: wer auf den Knopf DIESES
   * Bausteins drueckt, meint genau ihn. Ein Knopf, der nichts tut, weil
   * daneben ein Schloss zu ist, sieht aus wie ein Fehler.
   */
  const wuerfleBaustein = useCallback(
    (baustein: Baustein) => {
      setEntwurf((vorher) => {
        if (!vorher) return erzeugeEntwurf(zuschnitt, getLanguage(), wuerfel);
        const andere = BAUSTEINE.filter((eintrag) => eintrag !== baustein);
        return erzeugeEntwurf(zuschnitt, getLanguage(), wuerfel, andere, vorher);
      });
      setExportStand('ruht');
    },
    [zuschnitt]
  );

  /** Eine einzelne Zeile, ohne den Rest des Bausteins anzufassen. */
  const ersetze = useCallback((aendere: (alt: Entwurf) => Entwurf) => {
    setEntwurf((vorher) => (vorher ? aendere(vorher) : vorher));
    setExportStand('ruht');
  }, []);

  /**
   * Eine Aenderung von Hand.
   *
   * Wie `ersetze`, legt aber zusaetzlich das Schloss dieses Bausteins um.
   * Wer einen Satz selbst geschrieben hat, will ihn beim naechsten „Alles
   * würfeln" nicht verlieren — im NPC Creator haelt ein bearbeitetes Feld
   * sich aus demselben Grund selbst fest.
   */
  const bearbeite = useCallback(
    (baustein: Baustein, aendere: (alt: Entwurf) => Entwurf) => {
      ersetze(aendere);
      setFestgehalten((alt) => (alt.includes(baustein) ? alt : [...alt, baustein]));
    },
    [ersetze]
  );

  const setzeFraktion = useCallback(
    (stelle: number, feld: keyof Fraktion, wert: string) =>
      bearbeite('fraktionen', (alt) => ({
        ...alt,
        fraktionen: alt.fraktionen.map((eintrag, i) =>
          i === stelle ? { ...eintrag, [feld]: wert } : eintrag
        )
      })),
    [bearbeite]
  );

  const setzeFigur = useCallback(
    (stelle: number, feld: keyof EntwurfsFigur, wert: string) =>
      bearbeite('figuren', (alt) => ({
        ...alt,
        figuren: alt.figuren.map((eintrag, i) =>
          i === stelle ? { ...eintrag, [feld]: wert } : eintrag
        )
      })),
    [bearbeite]
  );

  const setzeOrt = useCallback(
    (stelle: number, feld: keyof Ort, wert: string) =>
      bearbeite('orte', (alt) => ({
        ...alt,
        orte: alt.orte.map((eintrag, i) => (i === stelle ? { ...eintrag, [feld]: wert } : eintrag))
      })),
    [bearbeite]
  );

  const setzeVerbindung = useCallback(
    (stelle: number, feld: keyof Verbindung, wert: string) =>
      bearbeite('verbindungen', (alt) => ({
        ...alt,
        verbindungen: alt.verbindungen.map((eintrag, i) =>
          i === stelle ? { ...eintrag, [feld]: wert } : eintrag
        )
      })),
    [bearbeite]
  );

  /**
   * Der Name, mit dem ein Figurenfeld angeklickt wurde.
   *
   * Gebraucht, um beim Verlassen genau einmal zu ersetzen. Zeichenweise
   * waehrend des Tippens zu ersetzen hiesse, beim Zwischenstand „E" jedes E
   * im ganzen Satz auszutauschen.
   */
  const alterName = useRef('');

  /**
   * Was in einem Regler stand, als man hineinklickte.
   *
   * Gebraucht, weil das Feld beim Hineinklicken geleert wird (siehe dort).
   * Wer nichts tippt und wieder herausklickt, soll seinen Wert wiederfinden.
   */
  const zurueckgelegt = useRef<Record<string, string>>({});

  /** Beim Verlassen des Namensfeldes die Verbindungen nachziehen. */
  const ziehNameNach = useCallback(
    (stelle: number) => {
      const vorher = alterName.current;
      alterName.current = '';
      setEntwurf((alt) =>
        alt ? benenneFigurUm(alt, stelle, alt.figuren[stelle]?.name ?? '', vorher) : alt
      );
    },
    []
  );

  /**
   * Die KI nach einem Baustein fragen.
   *
   * Immer nur nach einem: eine ganze Kampagne in einer Anfrage ist teuer und
   * am Ende sieht man einen Textblock, dem man nicht ansieht, was man davon
   * behalten will. Was die KI liefert, ersetzt genau eine Stelle — der Rest
   * des Entwurfs bleibt stehen.
   *
   * Der Zuschnitt geht als getippter Text mit, nicht als Marke: „Schwebende
   * Inseln" findet in keiner Tabelle eine Marke, ein Modell kann damit aber
   * etwas anfangen.
   */
  const frageKi = useCallback(
    async (schluessel: string, aufgabe: KiAufgabe, stelle = -1) => {
      if (kiLaeuft) return;
      setKiLaeuft(schluessel);
      setKiFehler(null);
      const jetzt = entwurf;
      const namen: [string, string] | undefined =
        aufgabe === 'verbindung' && jetzt
          ? [
              jetzt.figuren[jetzt.verbindungen[stelle].a]?.name ?? '?',
              jetzt.figuren[jetzt.verbindungen[stelle].b]?.name ?? '?'
            ]
          : undefined;

      try {
        const ergebnis = await api.ki.frage(
          {
            aufgabe,
            vorgaben: { umfang, region: regionText, thema: themaText, tonfall: tonfallText },
            entwurf: jetzt,
            namen,
            // Nur beim grossen Knopf von Belang: das Modell soll um die
            // festgehaltenen Bausteine herumbauen, statt sie zu ersetzen.
            festgehalten
          },
          getLanguage()
        );
        if (!ergebnis.ok || !ergebnis.wert) {
          setKiFehler(t(ergebnis.grund as TextKey));
          return;
        }
        uebernimmKi(aufgabe, stelle, ergebnis.wert);
      } catch (fehler) {
        setKiFehler(String(fehler));
      } finally {
        setKiLaeuft(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entwurf, kiLaeuft, umfang, regionText, themaText, tonfallText, zuschnitt, festgehalten]
  );

  /** Was die KI geliefert hat, an die richtige Stelle setzen. */
  const uebernimmKi = useCallback(
    (
      aufgabe: KiAufgabe,
      stelle: number,
      wert: Record<string, string> | readonly string[] | RohEntwurf
    ) => {
      /*
       * Der ganze Entwurf auf einmal.
       *
       * Eigener Weg, weil er als Einziger auch aus dem Nichts heraus
       * funktionieren muss: wer das Werkzeug oeffnet und sofort auf „Alles
       * von der KI" drueckt, hat noch keinen Entwurf, den man ergaenzen
       * koennte. `baueEntwurf` fuellt dabei aus den Tabellen auf, was die
       * Antwort auslaesst.
       */
      if (aufgabe === 'entwurf') {
        setEntwurf((alt) =>
          baueEntwurf(wert as RohEntwurf, alt, zuschnitt, getLanguage(), wuerfel, festgehalten)
        );
        setExportStand('ruht');
        return;
      }

      const feld = (name: string) => (wert as Record<string, string>)[name] ?? '';
      ersetze((alt) => {
        switch (aufgabe) {
          case 'aufhaenger':
            return {
              ...alt,
              aufhaenger: {
                ausloeser: feld('ausloeser'),
                betroffene: feld('betroffene'),
                komplikation: feld('komplikation'),
                frist: feld('frist')
              }
            };
          case 'fraktion':
            return {
              ...alt,
              fraktionen: alt.fraktionen.map((eintrag, i) =>
                i === stelle
                  ? {
                      name: feld('name'),
                      art: feld('art'),
                      ziel: feld('ziel'),
                      mittel: feld('mittel'),
                      schwaeche: feld('schwaeche')
                    }
                  : eintrag
              )
            };
          case 'figur':
            return ersetzeFigur(
              alt,
              stelle,
              {
                name: feld('name'),
                rolle: feld('rolle'),
                triebfeder: feld('triebfeder'),
                hebel: feld('hebel'),
                makel: feld('makel')
              },
              zuschnitt,
              getLanguage(),
              wuerfel
            );
          case 'ort':
            return {
              ...alt,
              orte: alt.orte.map((eintrag, i) =>
                i === stelle
                  ? {
                      name: feld('name'),
                      art: feld('art'),
                      merkmal: feld('merkmal'),
                      zustand: feld('zustand'),
                      karte: feld('karte'),
                      ausstattung: feld('ausstattung')
                    }
                  : eintrag
              )
            };
          case 'verbindung':
            return {
              ...alt,
              verbindungen: alt.verbindungen.map((eintrag, i) =>
                i === stelle
                  ? { ...eintrag, muster: feld('muster'), hin: feld('hin'), zurueck: feld('zurueck') }
                  : eintrag
              )
            };
          case 'zeitstrahl': {
            // Die Zeitmarken bleiben aus der Tabelle, nur die Ereignisse
            // kommen vom Modell: so passt die Liste weiter zum Umfang, auch
            // wenn das Modell zu viele oder zu wenige Schritte schickt.
            const schritte = wert as readonly string[];
            const marken = ZEITMARKEN[umfang];
            return {
              ...alt,
              zeitstrahl: schritte
                .slice(0, marken.length)
                .map((was, i) => ({ marke: marken[i][getLanguage() === 'de' ? 'de' : 'en'], was }))
            };
          }
          default:
            return alt;
        }
      });
    },
    [ersetze, umfang, zuschnitt, festgehalten]
  );

  /**
   * Die Liste der vorhandenen Figuren holen — erst auf Knopfdruck.
   *
   * Nicht beim Laden: das Werkzeug soll ohne Kampagne genauso laufen, und
   * eine Liste, die niemand aufgeschlagen hat, muss auch niemand lesen.
   */
  /*
   * Wohin uebernommen wird: vorbelegt mit der zuletzt im Story Creator
   * offenen Kampagne, waehlbar (Wunsch aus dem Testbericht).
   */
  const [kampagnen, setKampagnen] = useState<{ id: string; name: string }[]>([]);
  const [ziel, setZiel] = useState<string | null>(null);
  useEffect(() => {
    const frage = () =>
      void api.kampagnen?.().then((k) => {
        setKampagnen(k.liste);
        setZiel((alt) => (alt && k.liste.some((e) => e.id === alt) ? alt : k.aktuell));
      }, () => undefined);
    frage();
    window.addEventListener('focus', frage);
    return () => window.removeEventListener('focus', frage);
  }, []);

  const zeigeKampagnenFiguren = useCallback(async () => {
    if (kampagnenFiguren) {
      setKampagnenFiguren(null);
      return;
    }
    try {
      setKampagnenFiguren(await api.figuren(ziel));
    } catch {
      setKampagnenFiguren([]);
    }
  }, [kampagnenFiguren, ziel]);

  /** Eine vorhandene Figur dazunehmen — mit Anbindung ans Geflecht. */
  const holeFigur = useCallback(
    (titel: string) => {
      bearbeite('figuren', (alt) =>
        fuegeFigurHinzu(
          alt,
          {
            name: titel,
            // Die Rolle wird gewuerfelt, weil sie zu DIESEM Entwurf gehoert
            // und nicht zur Figur. Was sie sonst ausmacht, steht in ihrer
            // Notiz; es hier zu wiederholen hiesse, zwei Wahrheiten zu
            // pflegen.
            rolle: erzeugeFigur(zuschnitt, getLanguage(), wuerfel).rolle,
            triebfeder: '',
            hebel: '',
            makel: '',
            vorhanden: true
          },
          zuschnitt,
          getLanguage(),
          wuerfel
        )
      );
    },
    [bearbeite, zuschnitt]
  );

  const schalteSchloss = useCallback((baustein: Baustein) => {
    setFestgehalten((alt) =>
      alt.includes(baustein) ? alt.filter((eintrag) => eintrag !== baustein) : [...alt, baustein]
    );
  }, []);

  const uebernehmen = useCallback(async (ersetzen = false) => {
    if (!entwurf) return;
    setExportStand('laeuft');
    const notizen = alsNotizen(entwurf, getLanguage(), titel.trim() || t('export.titelVorgabe'));
    const doppelt = doppelteTitel(notizen);
    if (doppelt.length && !window.confirm(t('export.doppeltFrage', { namen: doppelt.join(', ') }))) {
      setExportStand('ruht');
      return;
    }
    try {
      const ergebnis = await api.export(notizen, ziel, ersetzen);
      setVorhanden(ergebnis.vorhanden ?? 0);
      setExportStand(ergebnis.ok ? 'fertig' : 'fehler');
      setExportText(
        ergebnis.ok
          ? t('export.fertig', { anzahl: ergebnis.angelegt, ziel: ergebnis.text })
          : t('export.fehler', { grund: ergebnis.text })
      );
    } catch (fehler) {
      setExportStand('fehler');
      setExportText(t('export.fehler', { grund: String(fehler) }));
    }
  }, [entwurf, titel, ziel]);

  // Gleiche Namen hießen gleiche Notiztitel; der Story Creator übersprange den zweiten.
  const doppelteNamen = useMemo(
    () => (entwurf ? doppelteTitel(alsNotizen(entwurf, getLanguage(), titel.trim() || t('export.titelVorgabe'))) : []),
    [entwurf, titel]
  );

  const kopieren = useCallback(async () => {
    if (!entwurf) return;
    const markdown = alsMarkdown(entwurf, getLanguage());
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      // Unter file:// ist die Zwischenablage nicht immer freigegeben. Der
      // alte Weg funktioniert dort noch.
      const feld = document.createElement('textarea');
      feld.value = markdown;
      document.body.appendChild(feld);
      feld.select();
      document.execCommand('copy');
      feld.remove();
    }
    setKopiert(true);
    window.setTimeout(() => setKopiert(false), 1500);
  }, [entwurf]);

  const regler = (
    schluessel: TextKey,
    wert: string,
    setze: (wert: string) => void,
    texte: Record<string, Paar>,
    listenId: string
  ) => (
    <label className="regler">
      <span className="regler__name">{t(schluessel)}</span>
      <input
        className="regler__feld"
        list={listenId}
        value={wert}
        placeholder={t('regler.beliebig')}
        onChange={(ereignis) => setze(ereignis.target.value)}
        /*
         * Beim Hineinklicken leeren, beim Verlassen zurueckholen.
         *
         * Die Vorschlagsliste eines `input` zeigt nur, was zum bereits
         * getippten Text passt. Nach einer Auswahl steht dort der volle
         * Begriff, und ein Klick auf den Pfeil zeigte genau diesen einen —
         * man musste erst von Hand loeschen, um die anderen zu sehen.
         *
         * Wer etwas tippt, bekommt ab dem ersten Zeichen wieder das normale
         * Filtern; wer nichts tippt, findet seinen Wert beim Verlassen
         * unveraendert vor.
         */
        onFocus={(ereignis) => {
          zurueckgelegt.current[listenId] = wert;
          if (wert) setze('');
          // Der Pfeil zeigt die Liste erst nach einer Aenderung neu an.
          ereignis.target.dispatchEvent(new Event('input', { bubbles: true }));
        }}
        onBlur={() => {
          const gemerkt = zurueckgelegt.current[listenId];
          if (gemerkt !== undefined) {
            if (!wert) setze(gemerkt);
            delete zurueckgelegt.current[listenId];
          }
        }}
      />
      <datalist id={listenId}>
        {Object.values(texte).map((paar) => (
          <option key={paar.de} value={beschriftung(paar, sprache)} />
        ))}
      </datalist>
    </label>
  );

  const kopf = (baustein: Baustein, hinweis?: TextKey, kiAufgabe?: KiAufgabe) => {
    const zu = festgehalten.includes(baustein);
    return (
      <header className="karte__kopf">
        <h2 className="karte__titel">{t(`baustein.${baustein}` as TextKey)}</h2>
        {hinweis && <p className="karte__hinweis">{t(hinweis)}</p>}
        <div className="karte__knoepfe">
          <button
            type="button"
            className={zu ? 'knopf knopf--aktiv' : 'knopf'}
            aria-pressed={zu}
            onClick={() => schalteSchloss(baustein)}
          >
            {zu ? t('knopf.losgeben') : t('knopf.festhalten')}
          </button>
          <button type="button" className="knopf" onClick={() => wuerfleBaustein(baustein)}>
            {t('knopf.nochmal')}
          </button>
          {kiDa && kiAufgabe && (
            <button
              type="button"
              className="knopf knopf--ki"
              disabled={kiLaeuft !== null}
              onClick={() => void frageKi(baustein, kiAufgabe)}
            >
              {kiLaeuft === baustein ? t('ki.laeuft') : t('ki.vorschlagen')}
            </button>
          )}
        </div>
      </header>
    );
  };

  /**
   * Der kleine KI-Knopf neben dem Wuerfelknopf.
   *
   * Nur da, wenn eine KI eingerichtet ist — sonst gar nicht, nicht ausgegraut.
   */
  const kiKnopf = (schluessel: string, aufgabe: KiAufgabe, stelle = -1) =>
    kiDa ? (
      <button
        type="button"
        className={kiLaeuft === schluessel ? 'zeile__knopf zeile__knopf--laeuft' : 'zeile__knopf'}
        title={t('ki.zeile')}
        disabled={kiLaeuft !== null}
        onClick={() => void frageKi(schluessel, aufgabe, stelle)}
      >
        {kiLaeuft === schluessel ? '…' : '✦'}
      </button>
    ) : null;

  /** Der kleine Knopf an einer einzelnen Zeile. */
  const zeilenKnopf = (beiKlick: () => void) => (
    <button type="button" className="zeile__knopf" title={t('knopf.zeileNeu')} onClick={beiKlick}>
      ⟳
    </button>
  );

  return (
    <div className="app">
      <header className="app__kopf">
        <h1 className="app__titel">{t('app.title')}</h1>
        <p className="app__unterzeile">{t('app.unterzeile')}</p>
      </header>

      <section className="regler-leiste">
        <label className="regler">
          <span className="regler__name">{t('regler.umfang')}</span>
          <select
            className="regler__feld"
            value={umfang}
            onChange={(ereignis) => setUmfang(ereignis.target.value as UmfangId)}
          >
            {UMFAENGE.map((eintrag) => (
              <option key={eintrag} value={eintrag}>
                {beschriftung(UMFANG_TEXTE[eintrag], sprache)}
              </option>
            ))}
          </select>
        </label>
        {regler('regler.region', regionText, setRegionText, REGION_TEXTE, 'liste-region')}
        {regler('regler.thema', themaText, setThemaText, THEMA_TEXTE, 'liste-thema')}
        {regler('regler.tonfall', tonfallText, setTonfallText, TONFALL_TEXTE, 'liste-tonfall')}
      </section>

      <div className="wurf">
        <button type="button" className="knopf knopf--gross" onClick={wuerfleAlles}>
          {t('knopf.allesWuerfeln')}
        </button>
        {kiDa && (
          <button
            type="button"
            className="knopf knopf--gross knopf--kigross"
            disabled={kiLaeuft !== null}
            title={t('ki.allesHinweis')}
            onClick={() => void frageKi('entwurf', 'entwurf')}
          >
            {kiLaeuft === 'entwurf' ? t('ki.laeuft') : t('ki.alles')}
          </button>
        )}
        <p className="wurf__zahlen">{t('moeglichkeiten', formatiert)}</p>
        {eigeneAngaben.length > 0 && (
          <p className="wurf__eigenes">
            {t(kiDa ? 'regler.nurKi' : 'regler.nurKiOhne', { eigene: eigeneAngaben.join(', ') })}
          </p>
        )}
      </div>

      {kiDa && <p className="ki-hinweis">{t('ki.hinweis')}</p>}
      {kiFehler && <p className="ki-fehler">{kiFehler}</p>}

      {!entwurf && <p className="leer">{t('leer')}</p>}

      {entwurf && entwurf.welt && (
        <section className="welt">
          <h2 className="welt__titel">{t('welt.titel')}</h2>
          <Feld
            wert={entwurf.welt}
            aendere={(wert) => ersetze((alt) => ({ ...alt, welt: wert }))}
          />
          <p className="welt__hinweis">{t('welt.hinweis')}</p>
        </section>
      )}

      {entwurf && (
        <main className="bausteine">
          <section className="karte">
            {kopf('aufhaenger', undefined, 'aufhaenger')}
            <ul className="zeilen">
              {(['ausloeser', 'betroffene', 'komplikation'] as const).map((feld) => (
                <li className="zeile" key={feld}>
                  <Feld
                    wert={entwurf.aufhaenger[feld]}
                    aendere={(wert) =>
                      bearbeite('aufhaenger', (alt) => ({
                        ...alt,
                        aufhaenger: { ...alt.aufhaenger, [feld]: wert }
                      }))
                    }
                  />
                  {zeilenKnopf(() =>
                    ersetze((alt) => ({
                      ...alt,
                      aufhaenger: {
                        ...alt.aufhaenger,
                        [feld]: erzeugeAufhaenger(zuschnitt, getLanguage(), wuerfel)[feld]
                      }
                    }))
                  )}
                </li>
              ))}
              <li className="zeile zeile--frist">
                <Feld
                  name={t('feld.frist')}
                  wert={entwurf.aufhaenger.frist}
                  aendere={(wert) =>
                    bearbeite('aufhaenger', (alt) => ({
                      ...alt,
                      aufhaenger: { ...alt.aufhaenger, frist: wert }
                    }))
                  }
                />
                {zeilenKnopf(() =>
                  ersetze((alt) => ({
                    ...alt,
                    aufhaenger: {
                      ...alt.aufhaenger,
                      // Gezielt nachgewuerfelt kommt immer eine Frist. Beim
                      // Wuerfeln des ganzen Aufhaengers faellt sie oft aus,
                      // und ein Knopf, der meistens nichts tut, sieht kaputt
                      // aus.
                      frist: erzeugeFrist(zuschnitt, getLanguage(), wuerfel)
                    }
                  }))
                )}
              </li>
            </ul>
          </section>

          <section className="karte">
            {kopf('fraktionen', 'hinweis.fraktionen')}
            <ul className="zeilen">
              {entwurf.fraktionen.map((fraktion, stelle) => (
                <li className="block" key={stelle}>
                  <div className="block__kopf">
                    <input
                      className="block__titel"
                      value={fraktion.name}
                      onChange={(ereignis) =>
                        setzeFraktion(stelle, 'name', ereignis.target.value)
                      }
                    />
                    {zeilenKnopf(() =>
                      ersetze((alt) => ({
                        ...alt,
                        fraktionen: alt.fraktionen.map((eintrag, i) =>
                          i === stelle
                            ? mitFreiemNamen(() => erzeugeFraktion(zuschnitt, getLanguage(), wuerfel), vergebeneNamen(alt, eintrag.name))
                            : eintrag
                        )
                      }))
                    )}
                    {kiKnopf(`fraktion-${stelle}`, 'fraktion', stelle)}
                  </div>
                  <Feld
                    klasse="feld--art"
                    wert={fraktion.art}
                    aendere={(wert) => setzeFraktion(stelle, 'art', wert)}
                  />
                  <Feld
                    name={t('feld.ziel')}
                    wert={fraktion.ziel}
                    aendere={(wert) => setzeFraktion(stelle, 'ziel', wert)}
                  />
                  <Feld
                    name={t('feld.mittel')}
                    wert={fraktion.mittel}
                    aendere={(wert) => setzeFraktion(stelle, 'mittel', wert)}
                  />
                  <Feld
                    name={t('feld.schwaeche')}
                    wert={fraktion.schwaeche}
                    aendere={(wert) => setzeFraktion(stelle, 'schwaeche', wert)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="karte">
            {kopf('figuren')}
            <button type="button" className="knopf knopf--breit" onClick={() => void zeigeKampagnenFiguren()}>
              {kampagnenFiguren ? t('holen.schliessen') : t('knopf.holen')}
            </button>
            {kampagnenFiguren && (
              <div className="holen">
                <p className="holen__hinweis">{t('holen.hinweis')}</p>
                {kampagnenFiguren.length === 0 && <p className="holen__leer">{t('holen.leer')}</p>}
                <ul className="holen__liste" data-pfeile="liste">
                  {kampagnenFiguren.map((figur) => {
                    const dabei = entwurf.figuren.some((eintrag) => eintrag.name === figur.titel);
                    return (
                      <li data-pfeil key={figur.titel}>
                        <button
                          type="button"
                          className="holen__eintrag"
                          disabled={dabei}
                          onClick={() => holeFigur(figur.titel)}
                        >
                          <span className="holen__name">{figur.titel}</span>
                          <span className="holen__kurz">{dabei ? t('holen.dabei') : figur.kurz}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <ul className="zeilen">
              {entwurf.figuren.map((figur, stelle) => (
                <li className="block" key={stelle}>
                  <div className="block__kopf">
                    <input
                      className="block__titel"
                      value={figur.name}
                      onChange={(ereignis) => setzeFigur(stelle, 'name', ereignis.target.value)}
                      // Beim Hineinklicken merken, beim Verlassen nachziehen:
                      // die Verbindungen tragen den Namen fest im Satz, und
                      // zeichenweise zu ersetzen wuerde einzelne Buchstaben
                      // im ganzen Text austauschen.
                      onFocus={() => (alterName.current = figur.name)}
                      onBlur={() => ziehNameNach(stelle)}
                    />
                    {figur.vorhanden && <span className="block__marke">{t('figur.vorhanden')}</span>}
                    {zeilenKnopf(() =>
                      ersetze((alt) =>
                        ersetzeFigur(
                          alt,
                          stelle,
                          mitFreiemNamen(() => erzeugeFigur(zuschnitt, getLanguage(), wuerfel), vergebeneNamen(alt, alt.figuren[stelle]?.name)),
                          zuschnitt,
                          getLanguage(),
                          wuerfel
                        )
                      )
                    )}
                    {kiKnopf(`figur-${stelle}`, 'figur', stelle)}
                  </div>
                  <Feld
                    name={t('feld.rolle')}
                    wert={figur.rolle}
                    aendere={(wert) => setzeFigur(stelle, 'rolle', wert)}
                  />
                  <Feld
                    name={t('feld.will')}
                    wert={figur.triebfeder}
                    aendere={(wert) => setzeFigur(stelle, 'triebfeder', wert)}
                  />
                  <Feld
                    name={t('feld.hat')}
                    wert={figur.hebel}
                    aendere={(wert) => setzeFigur(stelle, 'hebel', wert)}
                  />
                  <Feld
                    name={t('feld.haken')}
                    wert={figur.makel}
                    aendere={(wert) => setzeFigur(stelle, 'makel', wert)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="karte">
            {kopf('orte')}
            <ul className="zeilen">
              {entwurf.orte.map((ort, stelle) => (
                <li className="block" key={stelle}>
                  <div className="block__kopf">
                    <input
                      className="block__titel"
                      value={ort.name}
                      onChange={(ereignis) => setzeOrt(stelle, 'name', ereignis.target.value)}
                    />
                    {zeilenKnopf(() =>
                      ersetze((alt) => ({
                        ...alt,
                        orte: alt.orte.map((eintrag, i) =>
                          i === stelle
                            ? mitFreiemNamen(() => erzeugeOrt(zuschnitt, getLanguage(), wuerfel), vergebeneNamen(alt, eintrag.name))
                            : eintrag
                        )
                      }))
                    )}
                    {kiKnopf(`ort-${stelle}`, 'ort', stelle)}
                  </div>
                  <Feld
                    klasse="feld--art"
                    wert={ort.art}
                    aendere={(wert) => setzeOrt(stelle, 'art', wert)}
                  />
                  <Feld wert={ort.merkmal} aendere={(wert) => setzeOrt(stelle, 'merkmal', wert)} />
                  <Feld wert={ort.zustand} aendere={(wert) => setzeOrt(stelle, 'zustand', wert)} />
                  <Feld
                    name={t('feld.karte')}
                    wert={ort.karte}
                    aendere={(wert) => setzeOrt(stelle, 'karte', wert)}
                  />
                  {/* Was dort steht — die Zeile, aus der die Pins auf einer
                      neuen Karte werden. */}
                  <Feld
                    name={t('feld.ausstattung')}
                    wert={ort.ausstattung}
                    aendere={(wert) => setzeOrt(stelle, 'ausstattung', wert)}
                  />
                  {karteDa && (
                    <button
                      type="button"
                      className="knopf knopf--schmal"
                      title={t('karte.hinweis')}
                      disabled={!ort.name.trim()}
                      // Der Ort geht als Pins mit: eine leere Karte mit dem
                      // richtigen Namen hilft niemandem.
                      onClick={() => void api.karte.anlegen(ort.name, alsKartennotizen(ort, getLanguage()))}
                    >
                      {t('knopf.karte')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="karte">
            {kopf('verbindungen', 'hinweis.verbindungen')}
            {geflecht && geflecht.knoten.length >= 2 ? (
              /*
               * Ein Knopf und kein Bild mit `onClick`: so kommt man auch mit
               * der Tastatur hin, und Vorlesewerkzeuge sagen, dass hier etwas
               * aufgeht.
               */
              <button
                type="button"
                className="geflecht__knopf"
                onClick={() => setGeflechtGross(true)}
                title={t('geflecht.gross')}
                aria-label={t('geflecht.gross')}
              >
                <GeflechtBild netz={geflecht} markeId="geflecht-pfeil" alt={t('geflecht.alt')} />
                <span className="geflecht__lupe" aria-hidden="true">
                  ⤢
                </span>
              </button>
            ) : (
              <p className="geflecht__leer">{t('geflecht.leer')}</p>
            )}
            <ul className="zeilen">
              {entwurf.verbindungen.map((verbindung, stelle) => (
                <li className="block" key={stelle}>
                  <div className="block__kopf">
                    <input
                      className="block__titel"
                      value={verbindung.muster}
                      onChange={(ereignis) =>
                        setzeVerbindung(stelle, 'muster', ereignis.target.value)
                      }
                    />
                    {zeilenKnopf(() =>
                      ersetze((alt) => ({
                        ...alt,
                        verbindungen: alt.verbindungen.map((eintrag, i) =>
                          i === stelle
                            ? erzeugeVerbindung(
                                eintrag.a,
                                eintrag.b,
                                alt.figuren,
                                zuschnitt,
                                getLanguage(),
                                wuerfel
                              )
                            : eintrag
                        )
                      }))
                    )}
                    {kiKnopf(`verbindung-${stelle}`, 'verbindung', stelle)}
                  </div>
                  <Feld
                    wert={verbindung.hin}
                    aendere={(wert) => setzeVerbindung(stelle, 'hin', wert)}
                  />
                  <Feld
                    klasse="feld--zurueck"
                    wert={verbindung.zurueck}
                    aendere={(wert) => setzeVerbindung(stelle, 'zurueck', wert)}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="karte">
            {kopf('zeitstrahl', 'hinweis.zeitstrahl', 'zeitstrahl')}
            <ol className="zeitstrahl">
              {entwurf.zeitstrahl.map((punkt, stelle) => (
                <li key={stelle}>
                  <span className="zeitstrahl__marke">{punkt.marke}</span>
                  <Feld
                    wert={punkt.was}
                    aendere={(wert) =>
                      bearbeite('zeitstrahl', (alt) => ({
                        ...alt,
                        zeitstrahl: alt.zeitstrahl.map((eintrag, i) =>
                          i === stelle ? { ...eintrag, was: wert } : eintrag
                        )
                      }))
                    }
                  />
                </li>
              ))}
            </ol>
          </section>
        </main>
      )}

      {entwurf && (
        <footer className="fuss">
          <label className="fuss__titel">
            <span className="regler__name">{t('export.titel')}</span>
            <input
              className="regler__feld"
              value={titel}
              placeholder={t('export.titelVorgabe')}
              onChange={(ereignis) => setTitel(ereignis.target.value)}
            />
          </label>
          {kampagnen.length > 0 ? (
            <label className="regler">
              <span className="regler__name">{t('export.kampagne')}</span>
              <select
                className="regler__feld"
                data-ziel
                value={ziel ?? ''}
                onChange={(ereignis) => {
                  setZiel(ereignis.target.value);
                  // Die Figurenliste gehoert zur Kampagne: neu holen, wenn sie offen ist.
                  setKampagnenFiguren(null);
                }}
              >
                {kampagnen.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="fuss__knoepfe">
            <button type="button" className="knopf" onClick={kopieren}>
              {kopiert ? t('knopf.kopiert') : t('knopf.kopieren')}
            </button>
            <button
              type="button"
              className="knopf knopf--gross"
              disabled={exportStand === 'laeuft'}
              onClick={() => void uebernehmen()}
            >
              {exportStand === 'laeuft' ? t('knopf.exportLaeuft') : t('knopf.export')}
            </button>
          </div>
          <p className="fuss__hinweis">{t('export.hinweis')}</p>
          {doppelteNamen.length > 0 && (
            <p className="fuss__meldung fuss__meldung--warnung" role="alert" data-doppelt-warnung>
              {t('export.doppelt', { namen: doppelteNamen.join(', ') })}
            </p>
          )}
          {exportStand !== 'ruht' && exportStand !== 'laeuft' && (
            <p className={exportStand === 'fehler' ? 'fuss__meldung fuss__meldung--fehler' : 'fuss__meldung'}>
              {exportText}
              {vorhanden > 0 ? (
                <>
                  {' '}
                  <button type="button" className="knopf" data-aktualisieren onClick={() => void uebernehmen(true)}>
                    {t('export.aktualisieren', { anzahl: vorhanden })}
                  </button>
                </>
              ) : null}
            </p>
          )}
        </footer>
      )}

      {grossesGeflecht && (
        <GeflechtVollbild
          netz={grossesGeflecht}
          alt={t('geflecht.alt')}
          schliessenText={t('geflecht.zu')}
          onClose={() => setGeflechtGross(false)}
        />
      )}
    </div>
  );
}
