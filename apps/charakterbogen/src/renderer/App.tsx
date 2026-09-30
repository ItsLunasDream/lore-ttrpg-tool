/**
 * Der Charakterbogen.
 *
 * Zwei Ansichten wie in den anderen Werkzeugen: die Sammlung der Boegen und
 * ein offener Bogen. Gespeichert wird von selbst, kurz nach jeder Aenderung
 * (ein Bogen am Spieltisch wird staendig angefasst, ein Speichern-Knopf
 * wuerde vergessen).
 *
 * Siehe `docs/charakterbogen.md`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { ZUSTAENDE } from '@suite/srd';
import { api } from './api';
import { getLanguage, setLanguage, t } from './i18n';
import { ZauberBlock } from './ZauberBlock';
import { InventarBlock } from './InventarBlock';
import { LiveLeiste, LiveListe, SlHinweis, SlMarke, SlMarkenKontext, markenAus } from './LiveTeile';
import { alsKachel, type Kachel } from '../shared/ablage';
import { schritteAus, type Anfrage, type Schritt } from '../shared/live';
import type { LiveZustand } from '../main/live';
import {
  gesamtstufe,
  initiativeBonus,
  kurzeRast,
  langeRast,
  leseBetrag,
  neuerBogen,
  wendeBetragAn,
  type Bogen,
  type Werte
} from '../shared/bogen';
import {
  ATTRIBUTE,
  ATTRIBUT_NAMEN,
  FERTIGKEITEN,
  fertigkeitsBonus,
  mitVorzeichen,
  modifikator,
  passiv,
  uebungsbonus,
  type Attribut,
  type Uebung
} from '../shared/regeln';

/** Wartezeit bis zum Speichern nach der letzten Aenderung. */
const SPEICHER_PAUSE = 600;
/** Im Raum: so lange sammeln, bevor Aenderungen zum Gastgeber gehen. */
const SENDE_PAUSE = 250;
const OHNE_RAUM: LiveZustand = { rolle: 'aus', ich: null, ichSl: false, eintraege: [], abgelehnt: null };

function zahlAus(text: string, ersatz: number): number {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : ersatz;
}

export function App() {
  const [, neuZeichnen] = useState(0);
  const [kacheln, setKacheln] = useState<readonly Kachel[]>([]);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<Bogen | null>(null);
  const [stand, setStand] = useState<'ruht' | 'laeuft' | 'fertig' | 'fehler'>('ruht');
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');

  /*
   * Boegen im Raum. Ist `liveId` gesetzt, zeigt der offene Bogen den Stand
   * beim Gastgeber: Aenderungen gehen als Schritte hin, gespeichert wird
   * nicht hier, sondern beim Gastgeber und bei der Person, der er gehoert.
   */
  const [live, setLive] = useState<LiveZustand>(OHNE_RAUM);
  const [liveId, setLiveId] = useState<string | null>(null);
  const liveIdRef = useRef<string | null>(null);
  /** Der Stand, zu dem die Schritte schon unterwegs sind. */
  const gesendetRef = useRef<Bogen | null>(null);
  const nrRef = useRef(0);
  /** Die letzte Schrittnummer je Bogen im Raum: der Gastgeber quittiert je Bogen. */
  const nrJe = useRef(new Map<string, number>());
  const sendeTakt = useRef<number | null>(null);
  const [still, setStill] = useState(false);
  const stillRef = useRef(false);
  stillRef.current = still;
  /** Nach „In den Raum bringen": diesen Bogen oeffnen, sobald er da ist. */
  const wartetAuf = useRef<string | null>(null);
  const letzteAblehnung = useRef<string | null>(null);

  // Speichern: immer der neueste Stand, nie zwei Aufrufe gleichzeitig.
  const offenRef = useRef<Bogen | null>(null);
  const zeitgeber = useRef<number | null>(null);
  const laeuft = useRef<Promise<void> | null>(null);
  const schmutzig = useRef(false);

  const ladeListe = useCallback(async () => {
    setKacheln(await api.sammlung.liste());
  }, []);

  const speichereJetzt = useCallback(async () => {
    if (zeitgeber.current !== null) {
      window.clearTimeout(zeitgeber.current);
      zeitgeber.current = null;
    }
    while (laeuft.current) await laeuft.current;
    const bogen = offenRef.current;
    if (!bogen || !schmutzig.current) return;
    schmutzig.current = false;
    setStand('laeuft');
    const arbeit = (async () => {
      const antwort = await api.sammlung.speichern(bogen, false);
      if (antwort.ok && antwort.bogen) {
        // Fassung und Zeit vom Hauptprozess uebernehmen, ohne eine
        // inzwischen getippte Aenderung zu ueberschreiben.
        const gespeichert = antwort.bogen;
        const jetzt = offenRef.current;
        if (jetzt && jetzt.id === gespeichert.id) {
          offenRef.current = { ...jetzt, fassung: gespeichert.fassung, geaendert: gespeichert.geaendert };
          setOffen(offenRef.current);
        }
        setKacheln((alt) => alt.map((k) => (k.id === gespeichert.id ? alsKachel(gespeichert) : k)));
        setStand('fertig');
      } else {
        schmutzig.current = true;
        setStand('fehler');
        setFehler(t('fehler.speichern', { detail: antwort.text }));
      }
    })();
    laeuft.current = arbeit;
    try {
      await arbeit;
    } finally {
      laeuft.current = null;
    }
  }, []);

  /** Schickt die gesammelten Schritte (und einen besonderen dazu) zum Gastgeber. */
  const schicke = useCallback((schritte: Schritt[]) => {
    const id = liveIdRef.current;
    if (!id || schritte.length === 0) return;
    nrRef.current += 1;
    void api.live.anfrage({ art: 'schritte', id, nr: nrRef.current, schritte, still: stillRef.current });
  }, []);
  const sendeGesammelt = useCallback(() => {
    if (sendeTakt.current !== null) window.clearTimeout(sendeTakt.current);
    sendeTakt.current = null;
    const vorher = gesendetRef.current;
    const jetzt = offenRef.current;
    if (!vorher || !jetzt) return;
    schicke(schritteAus(vorher, jetzt));
    gesendetRef.current = jetzt;
  }, [schicke]);

  /**
   * Jede Aenderung am offenen Bogen geht hier durch. `schritt` ist fuer
   * Aenderungen, die im Raum nicht als neuer Wert reisen duerfen (Schaden:
   * zwei Treffer zugleich sollen beide zaehlen).
   */
  const aendere = useCallback(
    (wie: (b: Bogen) => Bogen, schritt?: Schritt) => {
      const alt = offenRef.current;
      if (!alt) return;
      const neu = wie(alt);
      offenRef.current = neu;
      setOffen(neu);
      if (liveIdRef.current) {
        if (schritt && gesendetRef.current) {
          schicke([...schritteAus(gesendetRef.current, alt), schritt]);
          gesendetRef.current = neu;
        } else {
          if (sendeTakt.current !== null) window.clearTimeout(sendeTakt.current);
          sendeTakt.current = window.setTimeout(sendeGesammelt, SENDE_PAUSE);
        }
        return;
      }
      schmutzig.current = true;
      setStand('ruht');
      if (zeitgeber.current !== null) window.clearTimeout(zeitgeber.current);
      zeitgeber.current = window.setTimeout(() => void speichereJetzt(), SPEICHER_PAUSE);
    },
    [speichereJetzt, schicke, sendeGesammelt]
  );

  const aendereWerte = useCallback(
    (wie: (w: Werte) => Werte, schritt?: Schritt) => aendere((b) => (b.werte ? { ...b, werte: wie(b.werte) } : b), schritt),
    [aendere]
  );

  const anfrage = useCallback((a: Anfrage) => void api.live.anfrage(a), []);

  const oeffneLive = useCallback(
    async (id: string, zustand?: LiveZustand) => {
      await speichereJetzt();
      const e = (zustand ?? live).eintraege.find((x) => x.id === id);
      if (!e?.bogen) return;
      setMeldung('');
      setFehler('');
      liveIdRef.current = id;
      setLiveId(id);
      nrRef.current = Math.max(nrJe.current.get(id) ?? 0, e.quittung);
      gesendetRef.current = e.bogen;
      offenRef.current = e.bogen;
      schmutzig.current = false;
      setStill(false);
      setOffen(e.bogen);
    },
    [live, speichereJetzt]
  );

  /** Den Live-Bogen verlassen; Ausstehendes geht vorher noch hinaus. */
  const verlasseLive = useCallback(() => {
    if (!liveIdRef.current) return;
    sendeGesammelt();
    nrJe.current.set(liveIdRef.current, nrRef.current);
    liveIdRef.current = null;
    gesendetRef.current = null;
    setLiveId(null);
  }, [sendeGesammelt]);

  useEffect(() => {
    void api.live.zustand().then(setLive);
    return api.live.beiStand(setLive);
  }, []);

  // Ein neuer Stand vom Gastgeber: den offenen Bogen nachziehen, sobald alle
  // eigenen Schritte drin sind (sonst sprängen getippte Zeichen zurück).
  useEffect(() => {
    if (live.abgelehnt && live.abgelehnt !== letzteAblehnung.current) setFehler(t(`live.abgelehnt.${live.abgelehnt}` as Parameters<typeof t>[0]));
    letzteAblehnung.current = live.abgelehnt;
    const warte = wartetAuf.current;
    if (warte && live.eintraege.some((e) => e.id === warte)) {
      wartetAuf.current = null;
      void oeffneLive(warte, live);
      return;
    }
    const id = liveIdRef.current;
    if (!id) return;
    const e = live.eintraege.find((x) => x.id === id);
    if (!e?.bogen) {
      verlasseLive();
      offenRef.current = null;
      setOffen(null);
      setMeldung(t('live.weg'));
      void ladeListe();
      return;
    }
    if (sendeTakt.current === null && e.quittung >= nrRef.current) {
      offenRef.current = e.bogen;
      gesendetRef.current = e.bogen;
      setOffen(e.bogen);
    }
  }, [live, oeffneLive, verlasseLive, ladeListe]);

  useEffect(() => {
    void ladeListe();
    const auffrischen = () => {
      if (document.visibilityState === 'visible' && !offenRef.current) void ladeListe();
    };
    const verlassen = () => void speichereJetzt();
    window.addEventListener('focus', auffrischen);
    document.addEventListener('visibilitychange', auffrischen);
    window.addEventListener('beforeunload', verlassen);
    window.addEventListener('blur', verlassen);
    return () => {
      window.removeEventListener('focus', auffrischen);
      document.removeEventListener('visibilitychange', auffrischen);
      window.removeEventListener('beforeunload', verlassen);
      window.removeEventListener('blur', verlassen);
    };
  }, [ladeListe, speichereJetzt]);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  const oeffne = useCallback(
    async (id: string) => {
      // Ist der eigene Bogen gerade im Raum, gilt der Stand dort.
      const imRaum = live.eintraege.find((e) => e.besitzer.id === live.ich && e.bogen?.id === id);
      if (imRaum) {
        await oeffneLive(imRaum.id);
        return;
      }
      verlasseLive();
      await speichereJetzt();
      const bogen = await api.sammlung.lesen(id);
      setMeldung('');
      if (!bogen) {
        setFehler(t('fehler.lesen'));
        return;
      }
      setFehler('');
      offenRef.current = bogen;
      setOffen(bogen);
      setStand('ruht');
    },
    [speichereJetzt, live, oeffneLive, verlasseLive]
  );

  /** Boegen, die der Hauptprozess gerade geschrieben hat (Uebergabe, Aufteilen). */
  const uebernimm = useCallback((boegen: readonly Bogen[]) => {
    const jetzt = offenRef.current;
    const neu = jetzt ? boegen.find((b) => b.id === jetzt.id) : undefined;
    if (neu) {
      offenRef.current = neu;
      schmutzig.current = false;
      setOffen(neu);
    }
    setKacheln((alt) => alt.map((k) => boegen.find((b) => b.id === k.id)).map((b, n) => (b ? alsKachel(b) : alt[n])));
  }, []);

  const schliesse = useCallback(async () => {
    verlasseLive();
    await speichereJetzt();
    offenRef.current = null;
    setOffen(null);
    setMeldung('');
    setFehler('');
    void ladeListe();
  }, [ladeListe, speichereJetzt, verlasseLive]);

  const bringe = useCallback(
    async (bogenId: string) => {
      if (!live.ich) return;
      if (offenRef.current?.id === bogenId && !liveIdRef.current) await speichereJetzt();
      wartetAuf.current = `${live.ich}/${bogenId}`;
      await api.live.bringe(bogenId);
    },
    [live.ich, speichereJetzt]
  );

  const anlegen = useCallback(async (art: Bogen['art'] = 'figur') => {
    const vorlage = neuerBogen('neu', art === 'gruppe' ? t('neu.gruppeName') : t('neu.name'), art);
    const antwort = await api.sammlung.speichern(vorlage, true);
    if (!antwort.ok || !antwort.bogen) {
      setFehler(t('fehler.speichern', { detail: antwort.text }));
      return;
    }
    await ladeListe();
    offenRef.current = antwort.bogen;
    setOffen(antwort.bogen);
    setStand('fertig');
  }, [ladeListe]);

  // Verlauf der Huelle: offener Bogen oder Liste.
  const ort = offen ? (liveId ? `live:${liveId}` : offen.id) : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) void schliesse();
        else if (ziel.startsWith('live:')) void oeffneLive(ziel.slice(5));
        else void oeffne(ziel);
      }),
    [oeffne, oeffneLive, schliesse]
  );
  useEffect(() => api.beiSuchtreffer((kennung) => void oeffne(kennung)), [oeffne]);

  const gefunden = useMemo(() => {
    const worte = suche.toLowerCase().split(/\s+/).filter(Boolean);
    return kacheln
      .filter((k) => worte.every((w) => `${k.name} ${k.kurz}`.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [kacheln, suche]);

  if (!offen) {
    return (
      <div className="rahmen">
        <header className="kopf">
          <h1>{t('titel')}</h1>
          <p>{t('untertitel')}</p>
        </header>
        <div className="leiste">
          <input
            type="search"
            className="suche"
            placeholder={t('liste.suche')}
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          <button type="button" className="knopf--haupt" data-neu onClick={() => void anlegen()}>
            {t('neu')}
          </button>
          <button type="button" data-neu-gruppe onClick={() => void anlegen('gruppe')}>
            {t('neu.gruppe')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const antwort = await api.sammlung.einlesen();
              if (antwort.ok) {
                setMeldung(t('einlesen.fertig', { namen: antwort.namen.join(', ') }));
                void ladeListe();
              } else if (antwort.text) setFehler(antwort.text);
            }}
          >
            {t('einlesen')}
          </button>
        </div>
        {meldung ? <p className="meldung">{meldung}</p> : null}
        {fehler ? <p className="stoerung">{fehler}</p> : null}
        {live.rolle !== 'aus' ? (
          <LiveListe live={live} eigene={kacheln} oeffne={(id) => void oeffneLive(id)} bringe={(id) => void bringe(id)} />
        ) : null}
        {kacheln.length === 0 ? (
          <p className="leer">{t('liste.leer')}</p>
        ) : gefunden.length === 0 ? (
          <p className="leer">{t('liste.nichts')}</p>
        ) : (
          <ul className="kacheln">
            {gefunden.map((k) => (
              <li key={k.id}>
                <button type="button" className="kachel" data-bogen={k.id} onClick={() => void oeffne(k.id)}>
                  <span className="kachel__name">{k.name}</span>
                  <span className="kachel__kurz">{k.art === 'gruppe' ? t('gruppe') : k.kurz || '—'}</span>
                  {k.tp ? <span className="kachel__tp">{k.tp}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const liveEintrag = liveId ? live.eintraege.find((e) => e.id === liveId) ?? null : null;
  const meiner = liveEintrag ? liveEintrag.besitzer.id === live.ich : true;
  const darf = liveEintrag ? liveEintrag.darfAendern : true;
  // Ziele fuers Geben im Raum: alle anderen Boegen dort, mit Besitzer im Namen.
  const liveZiele: Kachel[] = liveEintrag
    ? live.eintraege
        .filter((e) => e.id !== liveEintrag.id)
        .map((e) => ({
          id: e.id,
          name: e.uebersicht.art === 'gruppe' || e.besitzer.id === live.ich ? e.uebersicht.name : `${e.uebersicht.name} (${e.besitzer.name})`,
          art: e.uebersicht.art,
          kurz: e.uebersicht.kurz,
          tp: '',
          geaendert: ''
        }))
    : [];
  // Marken nur fuer die Person, der der Bogen gehoert; die SL hat ihren Verlauf.
  const marken = liveEintrag && meiner ? markenAus(liveEintrag.slAenderungen) : new Map();

  return (
    <div className="rahmen">
      <div className="leiste leiste--bogen">
        <button type="button" onClick={() => void schliesse()}>
          ← {t('zurueck')}
        </button>
        <span className={`stand stand--${stand}`} data-stand={stand} aria-live="polite">
          {!liveEintrag ? (stand === 'laeuft' ? t('speichern.laeuft') : stand === 'fertig' ? t('speichern.fertig') : '') : ''}
        </span>
        <span className="leiste__rest" />
        {!liveEintrag && live.rolle !== 'aus' ? (
          <button type="button" data-bringe-offen onClick={() => void bringe(offen.id)}>
            {t('live.bringe')}
          </button>
        ) : null}
        {!liveEintrag ? (
          <>
            <button
              type="button"
              onClick={async () => {
                await speichereJetzt();
                const antwort = await api.sammlung.weitergeben(offen.id);
                if (antwort.ok) setMeldung(t('weitergeben.fertig', { pfad: antwort.text }));
                else if (antwort.text) setFehler(antwort.text);
              }}
            >
              {t('weitergeben')}
            </button>
            <button
              type="button"
              className="knopf--gefahr"
              onClick={async () => {
                if (!window.confirm(t('loeschen.sicher', { name: offen.name }))) return;
                if (zeitgeber.current !== null) window.clearTimeout(zeitgeber.current);
                schmutzig.current = false;
                await api.sammlung.loeschen(offen.id);
                offenRef.current = null;
                setOffen(null);
                void ladeListe();
              }}
            >
              {t('loeschen')}
            </button>
          </>
        ) : null}
      </div>
      {liveEintrag ? <LiveLeiste e={liveEintrag} live={live} still={still} setStill={setStill} anfrage={anfrage} /> : null}
      {liveEintrag ? <SlHinweis e={liveEintrag} meiner={meiner} bestaetige={() => anfrage({ art: 'bestaetige', id: liveEintrag.id })} /> : null}
      {meldung ? <p className="meldung">{meldung}</p> : null}
      {fehler ? <p className="stoerung">{fehler}</p> : null}

      <SlMarkenKontext.Provider value={marken}>
        {/* Ohne Recht zum Aendern: alles sichtbar, nichts bedienbar. */}
        <fieldset className="bogenfeld" disabled={!darf} data-nurlesen={!darf}>
          <label className="feld feld--name">
            <span className="feld__label">
              {t('name')} <SlMarke feld="name" />
            </span>
            <input
              data-feld="name"
              value={offen.name}
              maxLength={120}
              onChange={(e) => aendere((b) => ({ ...b, name: e.target.value }))}
            />
          </label>

          {offen.werte ? <Figurenbogen werte={offen.werte} aendere={aendereWerte} setMeldung={setMeldung} /> : null}

          <section className="block" data-block="inventar">
            <h2>
              {offen.art === 'gruppe' ? t('gruppe') : t('inventar')} <SlMarke feld="gegenstaende" /> <SlMarke feld="muenzen" />
            </h2>
            <InventarBlock
              bogen={offen}
              // Im Raum: die anderen Boegen dort; Geben geht ueber den Gastgeber, nicht ueber die Platte.
              andere={liveEintrag ? liveZiele : kacheln}
              raum={
                liveEintrag
                  ? {
                      gib: (nach, was) => {
                        sendeGesammelt();
                        anfrage({ art: 'gib', von: liveEintrag.id, nach, was });
                      },
                      teile: (an) => {
                        sendeGesammelt();
                        anfrage({ art: 'aufteilen', von: liveEintrag.id, an });
                      }
                    }
                  : undefined
              }
              aendere={aendere}
              speichereJetzt={speichereJetzt}
              uebernimm={uebernimm}
              setMeldung={setMeldung}
              setFehler={setFehler}
            />
          </section>

          <section className="block">
            <h2>
              {t('notizen')} <SlMarke feld="notizen" />
            </h2>
            <textarea
              className="notizen"
              rows={8}
              placeholder={t('notizen.platzhalter')}
              value={offen.notizen}
              onChange={(e) => aendere((b) => ({ ...b, notizen: e.target.value }))}
            />
          </section>
        </fieldset>
      </SlMarkenKontext.Provider>
    </div>
  );
}

// --- Der Bogen einer Figur -------------------------------------------------

interface FigurProps {
  readonly werte: Werte;
  readonly aendere: (wie: (w: Werte) => Werte, schritt?: Schritt) => void;
  readonly setMeldung: (text: string) => void;
}

function Figurenbogen({ werte: w, aendere, setMeldung }: FigurProps) {
  const i = getLanguage() === 'de' ? 0 : 1;
  const stufe = gesamtstufe(w);
  const pb = uebungsbonus(stufe);
  const wahrnehmung = fertigkeitsBonus(w.attribute.wei, w.fertigkeiten.wahrnehmung ?? 0, pb);

  return (
    <>
      <section className="block raster raster--kopf">
        <Textfeld label={t('spieler')} wert={w.spieler} feld="spieler" aendern={(v) => aendere((x) => ({ ...x, spieler: v }))} />
        <Textfeld label={t('spezies')} wert={w.spezies} feld="spezies" aendern={(v) => aendere((x) => ({ ...x, spezies: v }))} />
        <Textfeld label={t('hintergrund')} wert={w.hintergrund} feld="hintergrund" aendern={(v) => aendere((x) => ({ ...x, hintergrund: v }))} />
        <div className="klassen">
          {w.klassen.map((k, n) => (
            <div className="klassen__zeile" key={n}>
              <input
                aria-label={t('klasse')}
                placeholder={t('klasse')}
                data-feld={`klasse-${n}`}
                value={k.name}
                maxLength={60}
                onChange={(e) =>
                  aendere((x) => ({ ...x, klassen: x.klassen.map((kk, m) => (m === n ? { ...kk, name: e.target.value } : kk)) }))
                }
              />
              <Zahl
                label={t('stufe')}
                wert={k.stufe}
                min={1}
                max={20}
                feld={`stufe-${n}`}
                aendern={(v) =>
                  aendere((x) => ({ ...x, klassen: x.klassen.map((kk, m) => (m === n ? { ...kk, stufe: v } : kk)) }))
                }
              />
              {w.klassen.length > 1 ? (
                <button
                  type="button"
                  className="knopf--klein"
                  aria-label={t('klasse.weg')}
                  title={t('klasse.weg')}
                  onClick={() => aendere((x) => ({ ...x, klassen: x.klassen.filter((_, m) => m !== n) }))}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <div className="klassen__fuss">
            {w.klassen.length < 6 ? (
              <button
                type="button"
                className="knopf--klein"
                onClick={() => aendere((x) => ({ ...x, klassen: [...x.klassen, { name: '', stufe: 1 }] }))}
              >
                {t('klasse.dazu')}
              </button>
            ) : null}
            <span className="leise" data-pb={pb}>
              {t('gesamtstufe', { stufe, pb: mitVorzeichen(pb) })}
            </span>
          </div>
        </div>
      </section>

      <div className="spalten">
        <section className="block">
          <h2>
          {t('attribute')} <SlMarke feld="attribute" />
        </h2>
          <div className="attribute">
            {ATTRIBUTE.map((a) => (
              <AttributKarte key={a} a={a} w={w} pb={pb} aendere={aendere} />
            ))}
          </div>
        </section>

        <section className="block">
          <h2>
          {t('fertigkeiten')} <SlMarke feld="fertigkeiten" />
        </h2>
          <ul className="fertigkeiten" title={t('fertigkeit.stufe')}>
            {FERTIGKEITEN.map((f) => {
              const u: Uebung = w.fertigkeiten[f.id] ?? 0;
              const bonus = fertigkeitsBonus(w.attribute[f.attribut], u, pb);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`uebung uebung--${u}`}
                    data-fertigkeit={f.id}
                    aria-label={`${f.name[i]}: ${['—', '●', '◆'][u]}`}
                    onClick={() =>
                      aendere((x) => {
                        const neu = ((u + 1) % 3) as Uebung;
                        const rest = { ...x.fertigkeiten };
                        if (neu === 0) delete rest[f.id];
                        else rest[f.id] = neu;
                        return { ...x, fertigkeiten: rest };
                      })
                    }
                  >
                    {['○', '●', '◆'][u]}
                  </button>
                  <span className="fertigkeiten__bonus" data-bonus={f.id}>
                    {mitVorzeichen(bonus)}
                  </span>
                  <span>{f.name[i]}</span>
                  <span className="leise">{ATTRIBUT_NAMEN[f.attribut].kurz[i]}</span>
                </li>
              );
            })}
          </ul>
          <p className="leise" data-passiv>
            {t('passiv')}: <strong>{passiv(wahrnehmung)}</strong>
          </p>
        </section>

        <section className="block">
          <h2>{t('kampf')}</h2>
          <div className="raster raster--kampf">
            <Zahl label={t('rk')} wert={w.rk} min={0} max={99} feld="rk" aendern={(v) => aendere((x) => ({ ...x, rk: v }))} />
            <label className="feld">
              <span className="feld__label">{t('initiative')}</span>
              <input
                data-feld="initiative"
                inputMode="numeric"
                placeholder={mitVorzeichen(initiativeBonus({ ...w, initiative: null }))}
                title={t('initiative.auto')}
                value={w.initiative === null ? '' : String(w.initiative)}
                onChange={(e) => {
                  const roh = e.target.value.trim();
                  aendere((x) => ({ ...x, initiative: roh === '' || roh === '-' ? null : zahlAus(roh, 0) }));
                }}
              />
            </label>
            <Textfeld
              label={t('bewegung')}
              wert={w.bewegung}
              feld="bewegung"
              platzhalter={t('bewegung.platzhalter')}
              aendern={(v) => aendere((x) => ({ ...x, bewegung: v }))}
            />
          </div>
          <Trefferpunkte w={w} aendere={aendere} setMeldung={setMeldung} />
          <Trefferwuerfel w={w} aendere={aendere} />
          <Rasten w={w} aendere={aendere} setMeldung={setMeldung} />
        </section>
      </div>

      <section className="block">
        <h2>
          {t('zustaende')} <SlMarke feld="zustaende" />
        </h2>
        <Zustaende w={w} aendere={aendere} />
      </section>

      <section className="block">
        <h2>
          {t('angriffe')} <SlMarke feld="angriffe" />
        </h2>
        <Angriffe w={w} aendere={aendere} />
      </section>

      <section className="block" data-block="zauber">
        <h2>
          {t('zauber')} <SlMarke feld="zauber" />
        </h2>
        <ZauberBlock w={w} pb={pb} aendere={aendere} setMeldung={setMeldung} />
      </section>
    </>
  );
}

function AttributKarte({
  a,
  w,
  pb,
  aendere
}: {
  a: Attribut;
  w: Werte;
  pb: number;
  aendere: (wie: (w: Werte) => Werte) => void;
}) {
  const i = getLanguage() === 'de' ? 0 : 1;
  const wert = w.attribute[a];
  const geuebt = w.rettung.includes(a);
  return (
    <div className="attribut" title={ATTRIBUT_NAMEN[a].lang[i]}>
      <span className="attribut__name">{ATTRIBUT_NAMEN[a].kurz[i]}</span>
      <span className="attribut__mod" data-mod={a}>
        {mitVorzeichen(modifikator(wert))}
      </span>
      <Zahl
        label={ATTRIBUT_NAMEN[a].lang[i]}
        versteckt
        wert={wert}
        min={1}
        max={30}
        feld={`attribut-${a}`}
        aendern={(v) => aendere((x) => ({ ...x, attribute: { ...x.attribute, [a]: v } }))}
      />
      <label className="attribut__rettung" title={t('rettung.uebung')}>
        <input
          type="checkbox"
          checked={geuebt}
          data-rettung={a}
          onChange={(e) =>
            aendere((x) => ({
              ...x,
              rettung: e.target.checked ? ATTRIBUTE.filter((k) => k === a || x.rettung.includes(k)) : x.rettung.filter((k) => k !== a)
            }))
          }
        />
        <span>
          {t('rettung.einer')} {mitVorzeichen(modifikator(wert) + (geuebt ? pb : 0))}
        </span>
      </label>
    </div>
  );
}

interface TeilProps {
  readonly w: Werte;
  readonly aendere: FigurProps['aendere'];
  readonly setMeldung: (text: string) => void;
}

function Trefferpunkte({ w, aendere, setMeldung }: TeilProps) {
  const [eingabe, setEingabe] = useState('');
  const [hinweis, setHinweis] = useState('');
  const anteil = w.tp.max > 0 ? w.tp.aktuell / w.tp.max : 0;
  const uebernimm = () => {
    const betrag = leseBetrag(eingabe);
    if (betrag === null) {
      setHinweis(t('tp.unlesbar'));
      return;
    }
    // Im Raum reist der Betrag, nicht der neue Stand: zwei Treffer zugleich zaehlen beide.
    aendere((x) => wendeBetragAn(x, betrag), { typ: 'betrag', text: betrag > 0 ? `+${betrag}` : String(betrag) });
    setEingabe('');
    setHinweis('');
    setMeldung(betrag < 0 ? t('tp.schaden', { n: -betrag }) : t('tp.heilung', { n: betrag }));
  };
  return (
    <div className="tp">
      <h3>
        {t('tp')} <SlMarke feld="tp" />
      </h3>
      <div className="tp__balken" aria-hidden="true">
        <span style={{ width: `${Math.round(anteil * 100)}%` }} className={anteil <= 0.25 ? 'kritisch' : anteil <= 0.5 ? 'angeschlagen' : ''} />
      </div>
      <div className="raster raster--tp">
        <Zahl label={t('tp.aktuell')} wert={w.tp.aktuell} min={0} max={w.tp.max} feld="tp-aktuell" aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, aktuell: v } }))} />
        <Zahl
          label={t('tp.max')}
          wert={w.tp.max}
          min={1}
          max={9999}
          feld="tp-max"
          aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, max: v, aktuell: Math.min(x.tp.aktuell, v) } }))}
        />
        <Zahl label={t('tp.temp')} wert={w.tp.temp} min={0} max={9999} feld="tp-temp" aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, temp: v } }))} />
      </div>
      <label className="feld">
        <span className="feld__label">{t('tp.feld')}</span>
        <input
          data-feld="tp-betrag"
          value={eingabe}
          placeholder="-7 / +5 / 2w6+3"
          title={t('tp.feldHinweis')}
          onChange={(e) => {
            setEingabe(e.target.value);
            setHinweis('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') uebernimm();
            if (e.key === 'Escape') setEingabe('');
          }}
        />
      </label>
      <p className="leise">{hinweis || t('tp.feldHinweis')}</p>
      {w.tp.aktuell === 0 ? (
        <div className="todesrettung" data-todesrettung>
          <h3>{t('todesrettung')}</h3>
          {(['erfolge', 'fehlschlaege'] as const).map((art) => (
            <div key={art} className="todesrettung__zeile">
              <span>{t(`todesrettung.${art}`)}</span>
              {[1, 2, 3].map((n) => (
                <input
                  key={n}
                  type="checkbox"
                  aria-label={`${t(`todesrettung.${art}`)} ${n}`}
                  checked={w.todesrettung[art] >= n}
                  onChange={() =>
                    aendere((x) => ({
                      ...x,
                      todesrettung: { ...x.todesrettung, [art]: x.todesrettung[art] >= n ? n - 1 : n }
                    }))
                  }
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Trefferwuerfel({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  return (
    <div className="tw">
      <h3>{t('trefferwuerfel')}</h3>
      {w.trefferwuerfel.map((tw, n) => (
        <div className="tw__zeile" key={n}>
          <select
            aria-label={t('trefferwuerfel')}
            value={tw.seiten}
            onChange={(e) =>
              aendere((x) => ({
                ...x,
                trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, seiten: Number(e.target.value) } : y))
              }))
            }
          >
            {[6, 8, 10, 12].map((s) => (
              <option key={s} value={s}>
                {getLanguage() === 'de' ? `W${s}` : `d${s}`}
              </option>
            ))}
          </select>
          <Zahl
            label={t('tw.uebrig')}
            wert={tw.uebrig}
            min={0}
            max={tw.gesamt}
            feld={`tw-uebrig-${n}`}
            aendern={(v) =>
              aendere((x) => ({ ...x, trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, uebrig: v } : y)) }))
            }
          />
          <span>/</span>
          <Zahl
            label={t('trefferwuerfel')}
            versteckt
            wert={tw.gesamt}
            min={0}
            max={20}
            feld={`tw-gesamt-${n}`}
            aendern={(v) =>
              aendere((x) => ({
                ...x,
                trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, gesamt: v, uebrig: Math.min(y.uebrig, v) } : y))
              }))
            }
          />
          {w.trefferwuerfel.length > 1 ? (
            <button
              type="button"
              className="knopf--klein"
              aria-label="×"
              onClick={() => aendere((x) => ({ ...x, trefferwuerfel: x.trefferwuerfel.filter((_, m) => m !== n) }))}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {w.trefferwuerfel.length < 4 ? (
        <button
          type="button"
          className="knopf--klein"
          onClick={() => aendere((x) => ({ ...x, trefferwuerfel: [...x.trefferwuerfel, { seiten: 8, gesamt: 1, uebrig: 1 }] }))}
        >
          {t('tw.dazu')}
        </button>
      ) : null}
    </div>
  );
}

function Rasten({ w, aendere, setMeldung }: TeilProps) {
  const [kurz, setKurz] = useState<Record<number, number> | null>(null);
  return (
    <div className="rasten">
      <h3>{t('rasten')}</h3>
      <div className="leiste">
        <button type="button" data-rast="kurz" disabled={w.tp.aktuell === 0} onClick={() => setKurz({})} title={w.tp.aktuell === 0 ? t('rast.langOhneTp') : t('rast.kurzHinweis')}>
          {t('rast.kurz')}
        </button>
        <button
          type="button"
          data-rast="lang"
          disabled={w.tp.aktuell === 0}
          title={w.tp.aktuell === 0 ? t('rast.langOhneTp') : t('rast.langHinweis')}
          onClick={() => {
            aendere(langeRast);
            setMeldung(t('rast.langFertig', { tp: w.tp.max }));
          }}
        >
          {t('rast.lang')}
        </button>
      </div>
      {kurz ? (
        <div className="kurzrast" data-kurzrast>
          <p className="leise">{t('rast.kurzHinweis')}</p>
          {w.trefferwuerfel.map((tw) => (
            <Zahl
              key={tw.seiten}
              label={`${getLanguage() === 'de' ? 'W' : 'd'}${tw.seiten} (${tw.uebrig} ${t('tw.uebrig')})`}
              wert={kurz[tw.seiten] ?? 0}
              min={0}
              max={tw.uebrig}
              feld={`kurz-${tw.seiten}`}
              aendern={(v) => setKurz((k) => ({ ...(k ?? {}), [tw.seiten]: v }))}
            />
          ))}
          <div className="leiste">
            <button
              type="button"
              className="knopf--haupt"
              data-kurz-wuerfeln
              onClick={() => {
                let ergebnis: ReturnType<typeof kurzeRast> | null = null;
                aendere((x) => {
                  ergebnis = kurzeRast(x, kurz);
                  return ergebnis.werte;
                });
                const e = ergebnis as ReturnType<typeof kurzeRast> | null;
                if (e) {
                  const summe = e.wuerfe.reduce((s, x) => s + x.geheilt, 0);
                  setMeldung(t('rast.kurzFertig', { wuerfe: e.wuerfe.map((x) => x.wurf).join(', ') || '—', summe }));
                }
                setKurz(null);
              }}
            >
              {t('rast.wuerfeln')}
            </button>
            <button type="button" onClick={() => setKurz(null)}>
              {t('abbrechen')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Zustaende({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const i = getLanguage() === 'de' ? 'de' : 'en';
  const [waehlen, setWaehlen] = useState(false);
  // Erschoepfung hat ein eigenes Feld mit Stufen.
  const auswahl = ZUSTAENDE.filter((z) => z.id !== 'exhaustion' && !w.zustaende.includes(z.id));
  return (
    <div className="zustaende">
      <ul className="chips">
        {w.zustaende.map((id) => {
          const z = ZUSTAENDE.find((x) => x.id === id);
          const name = z ? z.name[i] : id;
          return (
            <li key={id}>
              <span className="chip" title={z ? z.text[i] : ''}>
                {name}
                <button
                  type="button"
                  aria-label={t('zustand.weg', { name })}
                  onClick={() => aendere((x) => ({ ...x, zustaende: x.zustaende.filter((y) => y !== id) }))}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
        <li>
          {waehlen ? (
            <select
              autoFocus
              aria-label={t('zustand.dazu')}
              defaultValue=""
              onBlur={() => setWaehlen(false)}
              onChange={(e) => {
                const id = e.target.value;
                if (id) aendere((x) => ({ ...x, zustaende: [...x.zustaende, id] }));
                setWaehlen(false);
              }}
            >
              <option value="">{t('zustand.dazu')}</option>
              {auswahl.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name[i]}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className="knopf--klein" data-zustand-dazu onClick={() => setWaehlen(true)}>
              {t('zustand.dazu')}
            </button>
          )}
        </li>
      </ul>
      <div className="raster raster--zustand">
        <label className="feld" title={t('erschoepfung.hinweis')}>
          <span className="feld__label">{t('erschoepfung')}</span>
          <select
            data-feld="erschoepfung"
            value={w.erschoepfung}
            onChange={(e) => aendere((x) => ({ ...x, erschoepfung: Number(e.target.value) }))}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="schalter">
          <input
            type="checkbox"
            data-feld="inspiration"
            checked={w.inspiration}
            onChange={(e) => aendere((x) => ({ ...x, inspiration: e.target.checked }))}
          />
          <span>{t('inspiration')}</span>
        </label>
      </div>
    </div>
  );
}

function Angriffe({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const setze = (n: number, feld: 'name' | 'bonus' | 'schaden' | 'notiz', wert: string) =>
    aendere((x) => ({ ...x, angriffe: x.angriffe.map((a, m) => (m === n ? { ...a, [feld]: wert } : a)) }));
  return (
    <div className="angriffe">
      {w.angriffe.length ? (
        <div className="angriffe__kopf leise">
          <span>{t('angriff.name')}</span>
          <span>{t('angriff.bonus')}</span>
          <span>{t('angriff.schaden')}</span>
          <span>{t('angriff.notiz')}</span>
          <span />
        </div>
      ) : null}
      {w.angriffe.map((a, n) => (
        <div className="angriffe__zeile" key={n}>
          <input aria-label={t('angriff.name')} value={a.name} maxLength={80} onChange={(e) => setze(n, 'name', e.target.value)} />
          <input aria-label={t('angriff.bonus')} value={a.bonus} maxLength={20} onChange={(e) => setze(n, 'bonus', e.target.value)} />
          <input aria-label={t('angriff.schaden')} value={a.schaden} maxLength={60} onChange={(e) => setze(n, 'schaden', e.target.value)} />
          <input aria-label={t('angriff.notiz')} value={a.notiz} maxLength={200} onChange={(e) => setze(n, 'notiz', e.target.value)} />
          <button
            type="button"
            className="knopf--klein"
            aria-label={t('angriff.weg')}
            title={t('angriff.weg')}
            onClick={() => aendere((x) => ({ ...x, angriffe: x.angriffe.filter((_, m) => m !== n) }))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="knopf--klein"
        data-angriff-dazu
        onClick={() => aendere((x) => ({ ...x, angriffe: [...x.angriffe, { name: '', bonus: '', schaden: '', notiz: '' }] }))}
      >
        {t('angriff.dazu')}
      </button>
    </div>
  );
}

// --- Kleine Felder ---------------------------------------------------------

function Textfeld({
  label,
  wert,
  feld,
  platzhalter,
  aendern
}: {
  label: string;
  wert: string;
  feld: string;
  platzhalter?: string;
  aendern: (v: string) => void;
}) {
  return (
    <label className="feld">
      <span className="feld__label">
        {label} <SlMarke feld={feld} />
      </span>
      <input data-feld={feld} value={wert} maxLength={80} placeholder={platzhalter} onChange={(e) => aendern(e.target.value)} />
    </label>
  );
}

/**
 * Zahlenfeld, das waehrend des Tippens auch leer sein darf. Uebernommen wird
 * jede gueltige Zahl sofort, begrenzt beim Verlassen.
 */
function Zahl({
  label,
  wert,
  min,
  max,
  feld,
  versteckt,
  aendern
}: {
  label: string;
  wert: number;
  min: number;
  max: number;
  feld: string;
  versteckt?: boolean;
  aendern: (v: number) => void;
}) {
  const [text, setText] = useState(String(wert));
  const fokus = useRef(false);
  useEffect(() => {
    if (!fokus.current) setText(String(wert));
  }, [wert]);
  const begrenze = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <label className={versteckt ? 'feld feld--zahl feld--ohneLabel' : 'feld feld--zahl'}>
      <span className={versteckt ? 'unsichtbar' : 'feld__label'}>
        {label} {versteckt ? null : <SlMarke feld={feld} />}
      </span>
      <input
        data-feld={feld}
        inputMode="numeric"
        value={text}
        onFocus={() => {
          fokus.current = true;
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) aendern(begrenze(Math.round(n)));
        }}
        onBlur={() => {
          fokus.current = false;
          const n = Number(text);
          const gueltig = text.trim() !== '' && Number.isFinite(n) ? begrenze(Math.round(n)) : wert;
          setText(String(gueltig));
          if (gueltig !== wert) aendern(gueltig);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const neu = begrenze(wert + (e.key === 'ArrowUp' ? 1 : -1));
            setText(String(neu));
            aendern(neu);
          }
        }}
      />
    </label>
  );
}
