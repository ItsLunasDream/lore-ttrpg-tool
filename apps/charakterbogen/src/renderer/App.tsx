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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { api } from './api';
import { setLanguage, t } from './i18n';
import { InventarBlock } from './InventarBlock';
import { Figurenbogen, Kompaktbogen } from './Figurenbogen';
import { GestaltKasten } from './TiergestaltBlock';
import { DesignWahl } from './DesignWahl';
import { angriffeAusInventar } from '../shared/waffen';
import { LiveLeiste, LiveListe, SlHinweis, SlMarke, SlMarkenKontext, markenAus } from './LiveTeile';
import { alsKachel, figurAus, type Kachel } from '../shared/ablage';
import { schritteAus, type Anfrage, type Schritt } from '../shared/live';
import type { LiveZustand } from '../main/live';
import { neuerBogen, type Bogen, type Werte } from '../shared/bogen';
import { designVariablen, designVon } from '../shared/design';

/** Wartezeit bis zum Speichern nach der letzten Aenderung. */
const SPEICHER_PAUSE = 600;
/** Im Raum: so lange sammeln, bevor Aenderungen zum Gastgeber gehen. */
const SENDE_PAUSE = 250;
const OHNE_RAUM: LiveZustand = { rolle: 'aus', ich: null, ichSl: false, eintraege: [], abgelehnt: null };

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
  /** Kompaktansicht je Bogen; gemerkt in diesem Fenster, nicht im Bogen (jede Person wählt selbst). */
  const [kompakt, setKompakt] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem('charakterbogen.kompakt') ?? '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const schalteKompakt = (id: string) =>
    setKompakt((k) => {
      const neu = { ...k, [id]: !k[id] };
      try {
        window.localStorage.setItem('charakterbogen.kompakt', JSON.stringify(neu));
      } catch {
        /* ohne Speicher gilt die Wahl bis zum Schließen */
      }
      return neu;
    });
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

  // Der Initiative Tracker hat TP eines Bogens auf der Platte geaendert.
  // Wird gerade getippt, kommen nur die TP herein, der Rest bleibt, wie er ist.
  useEffect(
    () =>
      api.beiExtern((b) => {
        const jetzt = offenRef.current;
        if (jetzt && jetzt.id === b.id && schmutzig.current && jetzt.werte && b.werte) {
          offenRef.current = { ...jetzt, werte: { ...jetzt.werte, tp: b.werte.tp } };
          setOffen(offenRef.current);
          return;
        }
        uebernimm([b]);
      }),
    [uebernimm]
  );

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
          <LiveListe
            live={live}
            eigene={kacheln}
            oeffne={(id) => void oeffneLive(id)}
            bringe={(id) => void bringe(id)}
            alleInTracker={() => {
              const figuren = live.eintraege.flatMap((e) => {
                const f = e.bogen ? figurAus(e.bogen, e.id) : null;
                return f ? [f] : [];
              });
              if (figuren.length) void api.tracker(figuren);
            }}
          />
        ) : null}
        {kacheln.length === 0 ? (
          <p className="leer">{t('liste.leer')}</p>
        ) : gefunden.length === 0 ? (
          <p className="leer">{t('liste.nichts')}</p>
        ) : (
          <ul className="kacheln" data-pfeile="raster">
            {gefunden.map((k) => (
              <li data-pfeil key={k.id}>
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
        {darf ? <DesignWahl
            design={offen.design}
            aendern={(wie) =>
              aendere((b) => {
                // Vom aktuellen Stand aus: zwei schnelle Klicks sollen sich nicht gegenseitig ueberschreiben.
                const { farbe, papier, schrift } = designVon(b.design);
                return { ...b, design: wie({ farbe: farbe.id, papier: papier.id, schrift: schrift.id }) };
              })
            }
          /> : null}
        {offen.art === 'figur' && darf ? (
          offen.storyNotiz ? (
            <span className="knopfpaar">
              <button
                type="button"
                data-story-oeffnen
                title={t('story.oeffnen')}
                onClick={async () => {
                  const kennung = offen.storyNotiz?.kennung;
                  if (!kennung) return;
                  const da = await api.story.oeffne(kennung);
                  if (!da) {
                    aendere((b) => {
                      const { storyNotiz: _weg, ...rest } = b;
                      return rest;
                    });
                    setFehler(t('story.fehlt'));
                  }
                }}
              >
                ✎ {t('story')}
              </button>
              <button
                type="button"
                data-story-sync
                className={offen.storyNotiz.sync ? 'ist-an' : ''}
                aria-pressed={offen.storyNotiz.sync === true}
                title={t('story.sync.titel')}
                onClick={() => {
                  const an = !offen.storyNotiz?.sync;
                  aendere((b) => (b.storyNotiz ? { ...b, storyNotiz: { ...b.storyNotiz, sync: an } } : b));
                  // Beim Einschalten sofort abgleichen; danach nach jedem Speichern.
                  if (an && offenRef.current) {
                    void api.story.jetzt(offenRef.current).then((ok) => {
                      if (ok) setMeldung(t('story.sync.an'));
                      else setFehler(t('story.fehlt'));
                    });
                  }
                }}
              >
                ↻ {t('story.sync')}
              </button>
              <button
                type="button"
                className="knopf--leise"
                data-story-loesen
                title={t('story.loesen.titel')}
                onClick={() =>
                  aendere((b) => {
                    const { storyNotiz: _weg, ...rest } = b;
                    return rest;
                  })
                }
              >
                {t('story.loesen')}
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-story-anlegen
              title={t('story.anlegen')}
              onClick={async () => {
                if (!liveEintrag) await speichereJetzt();
                const antwort = await api.story.anlegen(offen);
                if (antwort.ok && antwort.kennung) {
                  const kennung = antwort.kennung;
                  aendere((b) => ({ ...b, storyNotiz: { kennung, titel: b.name } }));
                  setMeldung(t('story.angelegt', { text: antwort.text }));
                } else if (antwort.text) setFehler(antwort.text);
              }}
            >
              ✎ {t('story.anlegen')}
            </button>
          )
        ) : null}
        {offen.art === 'figur' ? (
          <button
            type="button"
            data-ansicht-kompakt
            aria-pressed={Boolean(kompakt[offen.id])}
            title={t('ansicht.kompaktHinweis')}
            onClick={() => schalteKompakt(offen.id)}
          >
            {kompakt[offen.id] ? t('ansicht.voll') : t('ansicht.kompakt')}
          </button>
        ) : null}
        {offen.art === 'figur' && (!liveEintrag || liveEintrag.darfAendern) ? (
          <button
            type="button"
            data-in-tracker
            title={t('tracker.titel')}
            onClick={async () => {
              if (!liveEintrag) await speichereJetzt();
              else sendeGesammelt();
              const f = figurAus(offen, liveEintrag ? liveEintrag.id : offen.id);
              if (f) void api.tracker([f]);
            }}
          >
            {t('tracker')}
          </button>
        ) : null}
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
        <div
          className={`blatt${designVon(offen.design).papier.dunkel ? ' blatt--dunkel' : ''}`}
          style={designVariablen(offen.design) as CSSProperties}
          data-papier={designVon(offen.design).papier.id}
          data-schrift={designVon(offen.design).schrift.id}
        >
        {/* Ohne Recht zum Aendern: alles sichtbar, nichts bedienbar. */}
        <fieldset className="bogenfeld" disabled={!darf} data-nurlesen={!darf}>
          <label className="blatt__name">
            <input
              data-feld="name"
              value={offen.name}
              maxLength={120}
              placeholder={t('name')}
              onChange={(e) => aendere((b) => ({ ...b, name: e.target.value }))}
            />
            <span className="linie__label">
              {offen.art === 'gruppe' ? t('gruppe') : t('name')} <SlMarke feld="name" />
            </span>
          </label>

          {offen.werte && kompakt[offen.id] ? (
            <Kompaktbogen werte={offen.werte} aendere={aendereWerte} setMeldung={setMeldung} name={offen.name} />
          ) : offen.werte ? (
            // In Tiergestalt liegt der Kasten der Gestalt neben dem Bogen.
            <div className={offen.werte.tiergestalt?.aktiv ? 'mit-gestalt' : 'ohne-gestalt'}>
            <div className="mit-gestalt__bogen">
            <Figurenbogen
              name={offen.name}
              werte={offen.werte}
              aendere={aendereWerte}
              setMeldung={setMeldung}
              ausInventar={angriffeAusInventar(offen)}
              imRaum={live.rolle !== 'aus'}
              bild={offen.bild}
              setzeBild={(bild) =>
                aendere((b) => {
                  if (bild) return { ...b, bild };
                  const { bild: _weg, ...rest } = b;
                  return rest;
                })
              }
            />
            </div>
            <GestaltKasten w={offen.werte} aendere={aendereWerte} />
            </div>
          ) : null}

          <section className="kasten" data-block="inventar">
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

          {kompakt[offen.id] && offen.werte ? null : (
          <section className="kasten">
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
          )}
        </fieldset>
        </div>
      </SlMarkenKontext.Provider>
    </div>
  );
}
