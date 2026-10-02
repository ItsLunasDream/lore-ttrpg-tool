/**
 * Der Status Effect Creator.
 *
 * Zwei Reiter: bauen und die Sammlung. Einen Reiter „Pruefen" wie beim
 * Monster Creator gibt es bewusst nicht — es gibt hier nichts zu pruefen,
 * was man eintippen koennte. Ein Zustand aus einem Buch hat kein Gewicht,
 * das man ausrechnen wollte; er hat Wirkungen, und die stehen in der Liste.
 *
 * Die Waage steht direkt unter dem Blatt und nicht in einer Ecke: sie ist
 * der Teil, der beim Bauen tatsaechlich hilft.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { einzeln } from '@suite/tastatur';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import type { Eintrag } from '../shared/ablage';
import { alsLeib, freieKennung, zuId } from '../shared/ablage';
import { alsFoundryDatei } from '../shared/foundry';
import {
  erzeugeZustand,
  pruefeZustand,
  pruefeZustandsStimmigkeit,
  wuerfleNeu,
  type Zustand
} from '../shared/erzeuge';
import {
  geschaetztesGewicht,
  zieheKiNach,
  type KiBefund,
  type RohStufe,
  type RohZustand
} from '../shared/kiAufgaben';
import {
  ARTEN,
  HAERTEN,
  THEMEN,
  WIRKRICHTUNGEN,
  dauer as dauerVon,
  text,
  type Wirkrichtung
} from '../shared/tabellen';
import { bogen } from '../shared/karte';
import { erzeugePaket, paketId, ueberschneidung, type Paket } from '../shared/paket';
import { zuId as kennung } from '../shared/ablage';
import { api } from './api';
import { Blatt } from './Blatt';
import { Karte } from './Karte';
import { Sammlung } from './Sammlung';
import { Waage } from './Waage';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';

/** Der Zufall der Oberflaeche. Die reinen Funktionen bekommen ihn uebergeben. */
const wuerfel = () => Math.random();

type Reiter = 'bauen' | 'paket' | 'sammlung';

export function App() {
  // Strg+S und Klick kurz hintereinander: nur einmal speichern (sonst doppelte neue Einträge).
  const speichertGerade = useRef(false);
  const [sprache, setSpracheState] = useState<Language>(DEFAULT_LANGUAGE);
  const [reiter, setReiter] = useState<Reiter>('bauen');
  const [artId, setArtId] = useState('');
  const [themaId, setThemaId] = useState('');
  const [haerteId, setHaerteId] = useState('ernst');
  const [wirkrichtung, setWirkrichtung] = useState<Wirkrichtung>('debuff');
  const [stufen, setStufen] = useState(3);
  const [zustand, setZustand] = useState<Zustand | null>(null);
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [kiDa, setKiDa] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [kiWunsch, setKiWunsch] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);
  /** Warum eine KI-Antwort zurueckgewiesen wurde. Leer heisst: alles gut. */
  const [kiBefund, setKiBefund] = useState<KiBefund | null>(null);
  /**
   * Stufentexte, die die KI geschrieben hat.
   *
   * Sie ersetzen die Stichpunkte nur in der ANZEIGE. Die Wirkungen darunter
   * bleiben stehen, sonst verloere der Zustand sein Gewicht — und damit
   * genau das, was ihn von einer Textdatei unterscheidet.
   */
  const [ausformuliert, setAusformuliert] = useState<Record<number, string>>({});
  /** Bei KI-Stufen ist das Gewicht geschaetzt, nicht gerechnet. */
  const [geschaetzt, setGeschaetzt] = useState(false);
  const [kiGewicht, setKiGewicht] = useState<number | null>(null);
  /** Das zuletzt gewuerfelte Paket. */
  const [paket, setPaket] = useState<Paket | null>(null);
  const [paketAnzahl, setPaketAnzahl] = useState(4);
  /** Welche Zustaende gerade als Karte auf dem Schirm liegen. Leer heisst: keine. */
  const [karte, setKarte] = useState<readonly Zustand[] | null>(null);

  useEffect(() => {
    void api.ki.da().then(setKiDa);
    const ab = api.ki.beiWechsel(() => void api.ki.da().then(setKiDa));
    const abSprache = api.sprache.beiWechsel((neu) => {
      setLanguage(neu as Language);
      setSpracheState(neu as Language);
    });
    return () => {
      ab();
      abSprache();
    };
  }, []);

  const ladeSammlung = useCallback(async () => {
    setEintraege(await api.sammlung.liste());
  }, []);

  useEffect(() => {
    void ladeSammlung();
  }, [ladeSammlung]);

  const befund = useMemo(() => (zustand ? pruefeZustand(zustand) : null), [zustand]);
  const stimmig = useMemo(() => (zustand ? pruefeZustandsStimmigkeit(zustand) : null), [zustand]);

  /** Der Befund, wie er angezeigt wird — mit geschaetztem Gewicht, wenn die KI die Stufen schrieb. */
  const angezeigt = useMemo(() => {
    if (!befund) return null;
    if (kiGewicht === null) return befund;
    return { ...befund, gewicht: kiGewicht };
  }, [befund, kiGewicht]);

  /** Welcher gespeicherte Zustand gerade offen ist (fuer den Verlauf der Huelle). */
  const [offenId, setOffenId] = useState<string | null>(null);

  const zuruecksetzen = () => {
    setKiBefund(null);
    setAusformuliert({});
    setGeschaetzt(false);
    setKiGewicht(null);
  };

  const wuerfeln = () => {
    zuruecksetzen();
    setOffenId(null);
    setZustand(
      erzeugeZustand(
        {
          artId: artId || undefined,
          themaId: themaId || undefined,
          haerteId,
          wirkrichtung,
          stufen
        },
        getLanguage() === 'en' ? 'en' : 'de',
        wuerfel
      )
    );
  };

  /**
   * Den ganzen Zustand von der KI.
   *
   * Und danach die Bremse: was zurueckkommt, wird geprueft. Anders als beim
   * Monster Creator wird nicht nachgezogen, sondern die Tabellen uebernehmen
   * — mit Ansage, welcher Teil unbrauchbar war.
   */
  const frageKi = async () => {
    if (kiLaeuft) return;
    setKiLaeuft(true);
    setMeldung(null);
    try {
      const entwurf = erzeugeZustand(
        { artId: artId || undefined, themaId: themaId || undefined, haerteId, wirkrichtung, stufen },
        getLanguage() === 'en' ? 'en' : 'de',
        wuerfel
      );
      const ergebnis = await api.ki.frage(
        {
          aufgabe: 'zustand',
          artId: artId || undefined,
          themaId: themaId || undefined,
          haerteId,
          stufen,
          wunsch: kiWunsch.trim() || undefined
        },
        getLanguage()
      );
      if (!ergebnis.ok || !ergebnis.wert) {
        setMeldung(t((ergebnis.grund || 'error.aiOther') as TextKey));
        setZustand(entwurf);
        return;
      }

      const roh = ergebnis.wert as RohZustand;
      const { zustand: gemischt, befund: kiUrteil } = zieheKiNach(roh, entwurf);
      zuruecksetzen();
      setOffenId(null);
      setZustand(gemischt);

      if (kiUrteil.ok) {
        // Die Stufen der KI ersetzen die Anzeige, nicht die Wirkungen.
        uebernimmStufen(roh.stufen, gemischt);
      } else {
        setKiBefund(kiUrteil);
      }
    } catch (fehler) {
      setMeldung(String(fehler));
    } finally {
      setKiLaeuft(false);
    }
  };

  /** Stufentexte der KI uebernehmen und das Gewicht dazu schaetzen. */
  const uebernimmStufen = (roh: readonly RohStufe[], grundlage: Zustand) => {
    const texte: Record<number, string> = {};
    for (const stufe of roh) texte[stufe.nummer] = stufe.text;
    setAusformuliert(texte);
    setGeschaetzt(true);
    setKiGewicht(geschaetztesGewicht(roh, getLanguage() === 'en' ? 'en' : 'de'));
    // Die Zahl der Stufen richtet sich nach dem, was die KI geliefert hat.
    if (roh.length !== grundlage.stufen.length) {
      setZustand({
        ...grundlage,
        stufen: roh.map((stufe, stelle) => grundlage.stufen[stelle] ?? { nummer: stufe.nummer, wirkungen: [] })
      });
    }
  };

  /** Die Stichpunkte von der KI ausformulieren lassen. */
  const ausformulierenLassen = async () => {
    if (!zustand || kiLaeuft) return;
    setKiLaeuft(true);
    try {
      const ergebnis = await api.ki.frage(
        { aufgabe: 'ausformulieren', zustand, stufen: zustand.stufen.length },
        getLanguage()
      );
      if (!ergebnis.ok || !ergebnis.wert) {
        setMeldung(t((ergebnis.grund || 'error.aiOther') as TextKey));
        return;
      }
      const roh = ergebnis.wert as RohStufe[];
      const texte: Record<number, string> = {};
      for (const stufe of roh) texte[stufe.nummer] = stufe.text;
      /*
       * Nur die Anzeige. Das Gewicht bleibt das gerechnete, weil die
       * Wirkungen dieselben sind — es wurde nur anders aufgeschrieben.
       */
      setAusformuliert(texte);
    } catch (fehler) {
      setMeldung(String(fehler));
    } finally {
      setKiLaeuft(false);
    }
  };

  // `alsNeu`: „Als neu speichern" legt eine zweite Datei an, auch wenn das
  // Stueck schon in der Sammlung liegt (Wunsch aus dem Testbericht).
  const speichern = async (alsNeu = false) => {
    if (!zustand) return;
    // Das offene Stueck behaelt seine Datei. Alles andere bekommt eine freie
    // Kennung: ein neues gleichen Namens ersetzt kein gespeichertes still.
    const id = (alsNeu ? null : offenId) ?? freieKennung(zuId(zustand.name), eintraege.map((e) => e.id));
    const ergebnis = await api.sammlung.speichern(
      { ...zustand, id, geaendert: new Date().toISOString() },
      getLanguage()
    );
    if (ergebnis.ok) setOffenId(id);
    setMeldung(
      ergebnis.ok
        ? t('meldung.gespeichert', { name: zustand.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
    if (ergebnis.ok) await ladeSammlung();
  };

  const exportieren = async () => {
    if (!zustand) return;
    // Ohne die Kopfzahlen: in einer Notiz sind sie kein Dateikopf mehr,
    // sondern ein Absatz ueber dem Zustand.
    const markdown = alsLeib(
      { ...zustand, id: zuId(zustand.name), geaendert: new Date().toISOString() },
      getLanguage() === 'en' ? 'en' : 'de'
    );
    const ergebnis = await api.export(zustand.name, markdown);
    setMeldung(
      ergebnis.ok
        ? t('meldung.exportiert', { name: zustand.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
  };

  /**
   * Den Zustand als JSON fuer Foundry wegschreiben.
   *
   * Ein eigener Knopf neben dem Export in den Story Creator: das eine ist
   * ein Text zum Lesen, das andere eine Datei zum Einlesen.
   */
  const nachFoundry = async () => {
    if (!zustand) return;
    const datei = alsFoundryDatei(zustand, getLanguage() === 'en' ? 'en' : 'de', Math.random);
    const ergebnis = await api.foundry(datei.name, datei.inhalt);
    // Abgebrochen ist kein Fehler: dann bleibt die Leiste still.
    if (!ergebnis.ok && !ergebnis.text) return;
    setMeldung(
      ergebnis.ok
        ? t('meldung.foundry', { name: zustand.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
  };

  /**
   * Die Karte als PDF.
   *
   * Das HTML entsteht hier, gedruckt wird im Hauptprozess — der Renderer
   * hat keinen Zugriff auf die Platte, und das soll so bleiben.
   */
  const druckeKarte = async (zustaende: readonly Zustand[]) => {
    const html = bogen(zustaende, getLanguage() === 'en' ? 'en' : 'de', ausformuliert);
    const vorschlag = kennung(zustaende.length === 1 ? zustaende[0].name : (paket?.name ?? 'karten'));
    const ergebnis = await api.karte(html, vorschlag);
    if (!ergebnis.ok && ergebnis.text === '') {
      setMeldung(t('karte.abgebrochen'));
      return;
    }
    setMeldung(
      ergebnis.ok
        ? t('karte.gespeichert', { pfad: ergebnis.pfad })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
    if (ergebnis.ok) void api.karteZeigen(ergebnis.pfad);
  };

  const wuerflePaket = () => {
    setPaket(
      erzeugePaket(
        { themaId: themaId || undefined, haerteId, anzahl: paketAnzahl },
        getLanguage() === 'en' ? 'en' : 'de',
        wuerfel
      )
    );
  };

  /**
   * Ein ganzes Paket in die Sammlung — und dort bleibt es eines.
   *
   * Jeder Zustand traegt den Verweis aufs Paket in seinem Kopf. Damit
   * stehen sie in der Sammlung beieinander, statt einzeln an ihre
   * alphabetische Stelle zwischen fremde Eintraege zu rutschen. Der Grund,
   * warum man ein Paket wuerfelt, ist ja die Abstimmung untereinander; die
   * waere nach dem Speichern sonst nicht mehr zu sehen.
   */
  const speicherePaket = async () => {
    if (!paket) return;
    /*
     * Kennungen, die noch niemand hat — fuer das Paket UND fuer jeden
     * Zustand darin.
     *
     * Beide kommen aus gewuerfelten Namen, und Namen wiederholen sich: es
     * gibt sechsunddreissig Paketnamen. Ohne diese Runde bekaemen zwei
     * gleichnamige Pakete dieselbe Kennung und staenden in der Sammlung als
     * eines da, und ein gleichnamiger Zustand ueberschriebe den aelteren
     * stillschweigend.
     *
     * Die schon in dieser Schleife vergebenen kommen mit in den Topf: sonst
     * zoegen zwei gleichnamige Zustaende INNERHALB eines Pakets denselben
     * Zusammenstoss nach sich.
     */
    const vergebenePakete = new Set(eintraege.map((e) => e.paketId).filter(Boolean));
    const kennung = freieKennung(paketId(paket.name), vergebenePakete);
    const vergebeneZustaende = new Set(eintraege.map((e) => e.id));
    const zeitpunkt = new Date().toISOString();
    let gespeichert = 0;
    for (const einzelner of paket.zustaende) {
      const eigene = freieKennung(zuId(einzelner.name), vergebeneZustaende);
      vergebeneZustaende.add(eigene);
      const ergebnis = await api.sammlung.speichern(
        {
          ...einzelner,
          id: eigene,
          geaendert: zeitpunkt,
          paketId: kennung,
          paketName: paket.name
        },
        getLanguage()
      );
      if (ergebnis.ok) gespeichert += 1;
    }
    setMeldung(t('paket.gespeichert', { anzahl: gespeichert }));
    await ladeSammlung();
  };

  const oeffnen = async (id: string) => {
    const eintrag = eintraege.find((e) => e.id === id);
    if (!eintrag) return;
    /*
     * Geoeffnet wird ueber die Kopfzahlen, nicht ueber den Leib.
     *
     * Die Stufentexte gehen dabei verloren und werden neu gewuerfelt — das
     * ist der Preis dafuer, dass die Dateien von Hand aenderbar bleiben. Wie
     * beim Monster Creator, und aus demselben Grund.
     */
    zuruecksetzen();
    const grundlage = erzeugeZustand(
      {
        artId: eintrag.artId || undefined,
        themaId: eintrag.themaId || undefined,
        haerteId: eintrag.haerteId || undefined,
        stufen: Math.max(1, eintrag.stufen)
      },
      getLanguage() === 'en' ? 'en' : 'de',
      wuerfel
    );
    /*
     * Die Dauer kommt aus der Datei, wenn sie darin steht.
     *
     * Sonst wuerfelte das Oeffnen eine neue — und ein Zustand, den man
     * zweimal oeffnet, haette zweimal eine andere Dauer. Die Takte werden
     * dabei mitgezogen, damit die Stimmigkeit erhalten bleibt.
     */
    const gespeicherte = eintrag.dauerId ? dauerVon(eintrag.dauerId) : undefined;
    const mitDauer = gespeicherte
      ? {
          ...grundlage,
          dauer: text(gespeicherte.name, getLanguage() === 'en' ? 'en' : 'de'),
          dauerId: gespeicherte.id
        }
      : grundlage;
    setZustand({ ...mitDauer, name: eintrag.name, zeichen: eintrag.zeichen, farbe: eintrag.farbe });
    setArtId(eintrag.artId);
    setThemaId(eintrag.themaId);
    setHaerteId(eintrag.haerteId || 'ernst');
    setStufen(Math.max(1, eintrag.stufen));
    setReiter('bauen');
    setOffenId(id);
  };

  /*
   * Ein Treffer aus der Suche der Huelle (Strg+K).
   *
   * Derselbe Weg wie ein Klick in der eigenen Sammlung — `oeffnen` wechselt
   * auch den Reiter. Wer von aussen kommt, soll dasselbe sehen wie jemand,
   * der von innen klickt.
   */
  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" fuehrt
   * zum vorigen Reiter (Bauen, Paket, Sammlung), nicht zum vorigen Werkzeug
   * (Rueckmeldung).
   */
  // Beim Bauen ist der Ort der offene Zustand (falls gespeichert), sonst der Reiter.
  useEffect(() => api.ort.melde(reiter === 'bauen' ? offenId : reiter), [reiter, offenId]);
  useEffect(() =>
    api.ort.beiSprung((ziel) => {
      if (ziel === 'paket' || ziel === 'sammlung') setReiter(ziel);
      else if (ziel && ziel !== offenId) void oeffnen(ziel);
      else setReiter('bauen');
    })
  );

  useEffect(() => api.beiSuchtreffer((kennung) => void oeffnen(kennung)));

  const loeschen = async (eintrag: Eintrag) => {
    if (!window.confirm(`${eintrag.name}?`)) return;
    await api.sammlung.loeschen(eintrag.id);
    setMeldung(t('meldung.geloescht', { name: eintrag.name }));
    await ladeSammlung();
  };

  return (
    <div className="app" lang={sprache}>
      <header className="kopf">
        <div>
          <h1>{t('titel')}</h1>
          <p className="kopf__satz">{t('untertitel')}</p>
          <p className="kopf__regelwerk">{t('hinweis.regeln')}</p>
        </div>
        <nav className="reiter">
          {(['bauen', 'paket', 'sammlung'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={reiter === id ? 'reiter__knopf reiter__knopf--an' : 'reiter__knopf'}
              onClick={() => setReiter(id)}
            >
              {t(`reiter.${id}` as TextKey)}
            </button>
          ))}
        </nav>
      </header>

      {meldung && <p key={meldung} className="meldung motion-meldung-ok">{meldung}</p>}

      {reiter === 'bauen' && (
        <main className="bauen">
          <section className="regler">
            <label>
              {t('feld.art')}
              <select value={artId} onChange={(e) => setArtId(e.target.value)}>
                <option value="">{t('feld.beliebig')}</option>
                {ARTEN.map((art) => (
                  <option key={art.id} value={art.id}>
                    {text(art.name, sprache === 'en' ? 'en' : 'de')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.thema')}
              <select value={themaId} onChange={(e) => setThemaId(e.target.value)}>
                <option value="">{t('feld.beliebig')}</option>
                {THEMEN.map((thema) => (
                  <option key={thema.id} value={thema.id}>
                    {text(thema.name, sprache === 'en' ? 'en' : 'de')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.wirkrichtung')}
              <select
                value={wirkrichtung}
                onChange={(e) => setWirkrichtung(e.target.value as Wirkrichtung)}
              >
                {WIRKRICHTUNGEN.map((id) => (
                  <option key={id} value={id}>
                    {t(`richtung.${id}` as TextKey)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.haerte')}
              <select value={haerteId} onChange={(e) => setHaerteId(e.target.value)}>
                {HAERTEN.map((haerte) => (
                  <option key={haerte.id} value={haerte.id}>
                    {text(haerte.name, sprache === 'en' ? 'en' : 'de')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.stufen')}
              <select value={stufen} onChange={(e) => setStufen(Number(e.target.value))}>
                <option value={1}>{t('feld.ohneStufen')}</option>
                {[2, 3, 4, 5, 6].map((zahl) => (
                  <option key={zahl} value={zahl}>
                    {zahl}
                  </option>
                ))}
              </select>
            </label>

            <div className="regler__knoepfe">
              <button type="button" className="knopf knopf--haupt" onClick={wuerfeln}>
                {t('knopf.wuerfeln')}
              </button>
              {kiDa ? (
                <button type="button" className="knopf" disabled={kiLaeuft} onClick={() => void frageKi()}>
                  {kiLaeuft ? t('knopf.kiLaeuft') : t('knopf.ki')}
                </button>
              ) : (
                <span className="hinweis hinweis--klein">{t('ki.aus')}</span>
              )}
            </div>

            {kiDa && (
              <label className="regler__wunsch">
                {t('feld.kiWunsch')}
                <textarea
                  value={kiWunsch}
                  onChange={(e) => setKiWunsch(e.target.value)}
                  placeholder={t('feld.kiWunschBeispiel')}
                  rows={3}
                />
                <span className="hinweis hinweis--klein">{t('feld.kiWunschHinweis')}</span>
              </label>
            )}
          </section>

          {zustand && angezeigt && (
            <>
              <Blatt zustand={zustand} ausformuliert={ausformuliert} />
              <Waage
                befund={angezeigt}
                haerteId={zustand.haerteId}
                geschaetzt={geschaetzt}
                stimmig={stimmig ?? undefined}
              />

              {kiBefund && !kiBefund.ok && (
                <section className="kiHinweis">
                  <p>{t('ki.zurueckgewiesen')}</p>
                  <ul>
                    {kiBefund.gruende.map((grund) => (
                      <li key={grund}>{t(grund as TextKey)}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="werkzeuge">
                <button
                  type="button"
                  className="knopf knopf--klein"
                  onClick={() => setZustand(wuerfleNeu(zustand, 'name', getLanguage() === 'en' ? 'en' : 'de', wuerfel))}
                >
                  {t('knopf.neuerName')}
                </button>
                <button
                  type="button"
                  className="knopf knopf--klein"
                  onClick={() => setZustand(wuerfleNeu(zustand, 'kurzsatz', getLanguage() === 'en' ? 'en' : 'de', wuerfel))}
                >
                  {t('knopf.neuerSatz')}
                </button>
                <button
                  type="button"
                  className="knopf knopf--klein"
                  onClick={() => {
                    zuruecksetzen();
                    setZustand(wuerfleNeu(zustand, 'stufen', getLanguage() === 'en' ? 'en' : 'de', wuerfel));
                  }}
                >
                  {t('knopf.neueStufen')}
                </button>
                <button
                  type="button"
                  className="knopf knopf--klein"
                  onClick={() => setZustand(wuerfleNeu(zustand, 'zeichen', getLanguage() === 'en' ? 'en' : 'de', wuerfel))}
                >
                  {t('knopf.neuesZeichen')}
                </button>
                {kiDa && (
                  <button
                    type="button"
                    className="knopf knopf--klein"
                    disabled={kiLaeuft}
                    onClick={() => void ausformulierenLassen()}
                  >
                    {t('knopf.ausformulieren')}
                  </button>
                )}
              </section>

              <section className="abgang">
                <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speichern)}>
                  {t('knopf.speichern')}
                </button>
                {offenId && (
                  <button type="button" className="knopf" onClick={() => void speichern(true)}>
                    {t('knopf.alsNeu')}
                  </button>
                )}
                <button type="button" className="knopf" onClick={() => void exportieren()}>
                  {t('knopf.export')}
                </button>
                <button type="button" className="knopf" onClick={() => void nachFoundry()}>
                  {t('knopf.foundry')}
                </button>
                <button type="button" className="knopf" onClick={() => setKarte([zustand])}>
                  {t('knopf.karte')}
                </button>
              </section>
            </>
          )}
        </main>
      )}

      {reiter === 'paket' && (
        <main className="bauen">
          <section className="regler">
            <p className="hinweis hinweis--klein regler__satz">{t('paket.satz')}</p>
            <label>
              {t('feld.thema')}
              <select value={themaId} onChange={(e) => setThemaId(e.target.value)}>
                <option value="">{t('feld.beliebig')}</option>
                {THEMEN.map((thema) => (
                  <option key={thema.id} value={thema.id}>
                    {text(thema.name, sprache === 'en' ? 'en' : 'de')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.haerte')}
              <select value={haerteId} onChange={(e) => setHaerteId(e.target.value)}>
                {HAERTEN.map((haerte) => (
                  <option key={haerte.id} value={haerte.id}>
                    {text(haerte.name, sprache === 'en' ? 'en' : 'de')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('paket.anzahl')}
              <select value={paketAnzahl} onChange={(e) => setPaketAnzahl(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((zahl) => (
                  <option key={zahl} value={zahl}>
                    {zahl}
                  </option>
                ))}
              </select>
            </label>
            <div className="regler__knoepfe">
              <button type="button" className="knopf knopf--haupt" onClick={wuerflePaket}>
                {t('paket.wuerfeln')}
              </button>
            </div>
          </section>

          {paket === null ? (
            <p className="hinweis">{t('paket.leer')}</p>
          ) : (
            <>
              <h2 className="paket__name">{paket.name}</h2>
              <p className="hinweis hinweis--klein">
                {ueberschneidung(paket) === 0
                  ? t('paket.abgestimmt')
                  : t('paket.ueberschneidung', { anzahl: ueberschneidung(paket) })}
              </p>

              <div className="paket__liste">
                {paket.zustaende.map((einzelner, stelle) => (
                  <div className="paket__eintrag" key={`${einzelner.name}-${stelle}`}>
                    <Blatt zustand={einzelner} />
                    <button
                      type="button"
                      className="knopf knopf--klein"
                      onClick={() => {
                        setZustand(einzelner);
                        zuruecksetzen();
                        setReiter('bauen');
                      }}
                    >
                      {t('paket.oeffnen')}
                    </button>
                  </div>
                ))}
              </div>

              <section className="abgang">
                <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speicherePaket)}>
                  {t('paket.alleSpeichern')}
                </button>
                <button type="button" className="knopf" onClick={() => setKarte(paket.zustaende)}>
                  {t('paket.alleKarten')}
                </button>
              </section>
            </>
          )}
        </main>
      )}

      {reiter === 'sammlung' && (
        <main className="sammlungSeite">
          <Sammlung eintraege={eintraege} onOeffnen={(id) => void oeffnen(id)} onLoeschen={(e) => void loeschen(e)} />
        </main>
      )}

      {karte && (
        <Karte
          zustaende={karte}
          ausformuliert={ausformuliert}
          onSchliessen={() => setKarte(null)}
          onDrucken={() => void druckeKarte(karte)}
        />
      )}
    </div>
  );
}
