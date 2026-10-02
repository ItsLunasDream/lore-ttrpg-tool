/**
 * Der Magic Item Generator.
 *
 * Zwei Ansichten wie in den anderen Werkzeugen: die Sammlung als Kacheln mit
 * Suche und dem Erzeuger darueber, und ein Gegenstand zum Bearbeiten. Ein
 * gewuerfelter Gegenstand ist ein Entwurf — auf die Platte kommt er erst mit
 * „Speichern".
 *
 * Siehe `docs/magicitems.md`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { einzeln } from '@suite/tastatur';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { SELTENHEITEN, SELTENHEIT_NAME, gegenstandswert, type Seltenheit } from '@suite/srd';
import { MagieFelder } from '@suite/magie/formular';
import { api } from './api';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';
import { erzeuge, hoechsterGrad, type Gegenstand, type Sprache } from '../shared/erzeuge';
import type { Eintrag } from '../shared/ablage';
import type { Frage, RohGegenstand } from '../shared/kiAufgaben';
import { pruefeKi } from '../shared/pruefung';
import { alsFoundryDatei } from '../shared/foundry';
import { ARTEN, ART_NAME, ART_ZEICHEN, VERBRAUCH, type Art } from '../shared/tabellen';

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

/** Die Farbe der Seltenheit, wie man sie aus Spielen kennt. */
const FARBE: Record<Seltenheit, string> = {
  common: '#9aa0a6',
  uncommon: '#4caf6a',
  rare: '#4a8fe0',
  veryRare: '#a064e0',
  legendary: '#e0a33a'
};

function zahl(wert: number): string {
  return wert.toLocaleString(sprache() === 'de' ? 'de-DE' : 'en-US');
}

function leer(): Gegenstand {
  return {
    id: '',
    name: '',
    art: 'wundersam',
    seltenheit: 'uncommon',
    einstimmung: false,
    wirkungen: [''],
    fluch: '',
    wert: gegenstandswert('uncommon'),
    notiz: '',
    geaendert: ''
  };
}

export function App() {
  // Strg+S und Klick kurz hintereinander: nur einmal speichern (sonst doppelte neue Einträge).
  const speichertGerade = useRef(false);
  const [, neuZeichnen] = useState(0);
  const [eintraege, setEintraege] = useState<readonly Eintrag[]>([]);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<Gegenstand | null>(null);
  const [istNeu, setIstNeu] = useState(false);
  const [art, setArt] = useState<Art | ''>('');
  const [seltenheit, setSeltenheit] = useState<Seltenheit | ''>('');
  const [fluch, setFluch] = useState(true);
  const [meldung, setMeldung] = useState('');
  // Fuer welche Seltenheit die Wirkungen gewuerfelt wurden. Weicht die
  // eingestellte davon ab, bietet ein Knopf neue Wirkungen an — von selbst
  // ueberschrieben wird nichts, die Texte gehoeren der Spielleitung.
  // Fuer welche Seltenheit UND Art die Wirkungen gewuerfelt wurden: aendert
  // sich eins davon, bietet der Knopf „anpassen" neue an (Testbericht: bei
  // einer anderen Art blieben Waffenwirkungen an einer Schriftrolle stehen).
  const [wirkungenFuer, setWirkungenFuer] = useState<string | null>(null);
  const [fehler, setFehler] = useState('');
  /*
   * Die KI, wie beim Monster Creator: sie schreibt, die Pruefung zieht ihre
   * Zahlen auf die Seltenheit, und hier steht, was gezogen wurde.
   */
  const [kiDa, setKiDa] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [kiWunsch, setKiWunsch] = useState('');
  const [kiZeilen, setKiZeilen] = useState<readonly string[]>([]);

  useEffect(() => {
    void api.ki.da().then(setKiDa);
    return api.ki.beiWechsel(() => void api.ki.da().then(setKiDa));
  }, []);

  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" aus
   * einem geoeffneten Eintrag fuehrt zur Liste, nicht zum vorigen Werkzeug
   * (Rueckmeldung). `null` ist die Liste, ein ungespeicherter Entwurf heisst
   * „entwurf" und laesst sich nicht wieder herstellen.
   */
  /*
   * Was zuletzt erzeugt, geladen oder gespeichert wurde. Weicht der offene
   * Gegenstand davon ab, hat man daran gearbeitet: dann fragen Neu-Wuerfeln,
   * Zurueck und „Leer" nach, statt die Aenderung still zu verwerfen.
   */
  const [stand, setStand] = useState<string | null>(null);
  const setzeGrund = (g: Gegenstand | null) => {
    setOffen(g);
    setStand(g ? JSON.stringify(g) : null);
  };
  const veraendert = offen !== null && stand !== null && JSON.stringify(offen) !== stand;
  const darfVerwerfen = () => !veraendert || confirm(t('verwerfen.sicher'));

  const ort = offen ? offen.id || 'entwurf' : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) {
          setzeGrund(null);
          setIstNeu(false);
          setMeldung('');
          setKiZeilen([]);
          return;
        }
        if (ziel === 'entwurf') return;
        void api.sammlung.lesen(ziel).then((g) => {
          if (!g) return;
          setzeGrund(g);
          setWirkungenFuer(`${g.seltenheit}|${g.art}`);
          setIstNeu(false);
        });
      }),
    []
  );

  /** Fragt die KI; bei einem Fehler steht er unten, und es kommt `null`. */
  const frageKi = async (frage: Frage): Promise<unknown> => {
    if (kiLaeuft) return null;
    setKiLaeuft(true);
    setFehler('');
    setMeldung('');
    try {
      const ergebnis = await api.ki.frage({ ...frage, wunsch: kiWunsch.trim() || undefined }, sprache());
      if (!ergebnis.ok || !ergebnis.wert) {
        setFehler(t((ergebnis.grund || 'error.aiOther') as TextKey));
        return null;
      }
      return ergebnis.wert;
    } finally {
      setKiLaeuft(false);
    }
  };

  /** Uebernimmt einen Stand der KI — immer durch die Pruefung. */
  const mitPruefung = (g: Gegenstand) => {
    const geprueft = pruefeKi(g, sprache());
    setKiZeilen(geprueft.zeilen);
    return geprueft.gegenstand;
  };

  const ganzerGegenstandVonKi = async () => {
    const zielArt = art || erzeuge({}, sprache()).art;
    const zielSeltenheit = seltenheit || erzeuge({ art: zielArt }, sprache()).seltenheit;
    const wert = (await frageKi({ aufgabe: 'gegenstand', art: zielArt, seltenheit: zielSeltenheit })) as RohGegenstand | null;
    if (!wert) return;
    if (!darfVerwerfen()) return;
    const grundlage = erzeuge({ art: zielArt, seltenheit: zielSeltenheit, fluchChance: 0 }, sprache());
    const neu = mitPruefung({
      ...grundlage,
      name: wert.name || grundlage.name,
      wirkungen: [...wert.wirkungen],
      fluch: wert.fluch,
      einstimmung: wert.einstimmung
    });
    setzeGrund(neu);
    setWirkungenFuer(`${neu.seltenheit}|${neu.art}`);
    setIstNeu(true);
  };

  const ladeListe = useCallback(async () => {
    setEintraege(await api.sammlung.liste());
  }, []);

  useEffect(() => {
    void ladeListe();
  }, [ladeListe]);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  useEffect(
    () =>
      api.beiSuchtreffer((kennung) => {
        void (async () => {
          const geladen = await api.sammlung.lesen(kennung);
          if (geladen) {
            setzeGrund(geladen);
            setWirkungenFuer(`${geladen.seltenheit}|${geladen.art}`);
            setIstNeu(false);
          } else setFehler(t('fehler.lesen'));
        })();
      }),
    []
  );

  const spr = sprache();
  const gefunden = useMemo(() => {
    const worte = suche.toLowerCase().split(/\s+/).filter(Boolean);
    return [...eintraege]
      .filter((e) => {
        const heu = `${e.name} ${ART_NAME[e.art].de} ${ART_NAME[e.art].en} ${SELTENHEIT_NAME[e.seltenheit].de} ${SELTENHEIT_NAME[e.seltenheit].en} ${e.kurz}`.toLowerCase();
        return worte.every((w) => heu.includes(w));
      })
      .sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  }, [eintraege, suche]);

  const wuerfle = () => {
    if (!darfVerwerfen()) return;
    setKiZeilen([]);
    const neu = erzeuge(
      { art: art || undefined, seltenheit: seltenheit || undefined, fluchChance: fluch ? 0.1 : 0 },
      spr
    );
    setzeGrund(neu);
    setWirkungenFuer(`${neu.seltenheit}|${neu.art}`);
    setIstNeu(true);
    setMeldung('');
    setFehler('');
  };

  const speichere = async (): Promise<Gegenstand | null> => {
    if (!offen) return null;
    setFehler('');
    const name = offen.name.trim() || ART_NAME[offen.art][spr];
    const fertig = { ...offen, name, wirkungen: offen.wirkungen.filter((w) => w.trim()) };
    const ergebnis = await api.sammlung.speichern(fertig, istNeu);
    if (!ergebnis.ok) {
      setFehler(t('fehler.speichern', { detail: ergebnis.text }));
      return null;
    }
    setzeGrund({ ...fertig, id: ergebnis.id });
    setIstNeu(false);
    setMeldung(t('gespeichert'));
    await ladeListe();
    return { ...fertig, id: ergebnis.id };
  };

  /*
   * In den Loot Generator. Ein ungespeicherter Entwurf wird vorher
   * gespeichert — in den Loot kann nur, was auch in der Sammlung steht.
   */
  const inDenLoot = async () => {
    if (!offen) return;
    const gespeichert = await speichere();
    if (!gespeichert) return;
    if (await api.sammlung.inDenLoot(gespeichert.id)) {
      setzeGrund({ ...gespeichert, imLoot: true });
      setMeldung(t('loot.fertig'));
    } else setFehler(t('loot.fehler'));
  };

  const ausDemLoot = async () => {
    if (!offen?.id) return;
    if (await api.sammlung.ausDemLoot(offen.id)) {
      setzeGrund({ ...offen, imLoot: false });
      setMeldung(t('loot.heraus'));
    } else setFehler(t('loot.fehler'));
  };

  /*
   * Die Leiste des Erzeugers steht in BEIDEN Ansichten: auch mit einem
   * offenen Gegenstand soll man Art und Seltenheit fuer den naechsten
   * einstellen koennen, und „Neu wuerfeln" darf nach dem Speichern nicht
   * verschwinden (Rueckmeldung).
   */
  const erzeugerLeiste = (imGegenstand: boolean) => (
    <>
      {/*
        Der Erzeuger steht oben und ist mit einem Klick benutzt: nichts
        waehlen heisst Zufall. Wer eine Art oder Seltenheit festlegt, bekommt
        genau die.
      */}
      <div className="erzeuger">
        {/* Im offenen Gegenstand gibt es zwei Auswahlen fuer Art und
            Seltenheit: diese hier gilt fuer den NAECHSTEN Wurf, die unten fuer
            den offenen Gegenstand. Das Etikett sagt es (Testbericht). */}
        {imGegenstand ? <span className="erzeuger__etikett">{t('erzeuger.naechster')}</span> : null}
        <select
          className="feld__wahl"
          aria-label={t('erzeuger.art')}
          value={art}
          data-erzeuger="art"
          onChange={(e) => setArt(e.target.value as Art | '')}
        >
          <option value="">
            {t('erzeuger.art')}: {t('erzeuger.zufall')}
          </option>
          {ARTEN.map((a) => (
            <option key={a} value={a}>
              {ART_ZEICHEN[a]} {ART_NAME[a][spr]}
            </option>
          ))}
        </select>
        <select
          className="feld__wahl"
          aria-label={t('erzeuger.seltenheit')}
          value={seltenheit}
          data-erzeuger="seltenheit"
          onChange={(e) => setSeltenheit(e.target.value as Seltenheit | '')}
        >
          <option value="">
            {t('erzeuger.seltenheit')}: {t('erzeuger.zufall')}
          </option>
          {SELTENHEITEN.map((s) => (
            <option key={s} value={s}>
              {SELTENHEIT_NAME[s][spr]}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={fluch} onChange={(e) => setFluch(e.target.checked)} />{' '}
          {t('erzeuger.fluch')}
        </label>
        <span className="leiste__luecke" />
        <button type="button" className="knopf" data-leer onClick={() => {
          if (!darfVerwerfen()) return;
          setzeGrund(leer());
          setWirkungenFuer(null);
          setIstNeu(true);
        }}>
          + {t('leer')}
        </button>
        <button
          type="button"
          className="knopf knopf--haupt"
          data-wuerfeln
          data-nochmal={imGegenstand ? true : undefined}
          onClick={wuerfle}
        >
          ⚄ {imGegenstand ? t('nochmal') : t('erzeuger.los')}
        </button>
        {kiDa ? (
          <button type="button" className="knopf" data-ki disabled={kiLaeuft} onClick={() => void ganzerGegenstandVonKi()}>
            {kiLaeuft ? t('ki.laeuft') : t('ki.knopf')}
          </button>
        ) : null}
      </div>
      {kiDa ? (
        <input
          className="feld__eingabe erzeuger__wunsch"
          value={kiWunsch}
          data-ki-wunsch
          aria-label={t('ki.wunsch')}
          placeholder={`${t('ki.wunsch')}: ${t('ki.wunschBeispiel')}`}
          onChange={(e) => setKiWunsch(e.target.value)}
        />
      ) : null}
    </>
  );

  // --- Ein Gegenstand -------------------------------------------------------
  if (offen) {
    const setze = (teil: Partial<Gegenstand>) => {
      const neu = { ...offen, ...teil };
      // Der Wert folgt der Seltenheit — ausser bei der Schriftrolle, deren
      // Wert am Zaubergrad haengt und beim Wuerfeln schon feststand.
      if (teil.seltenheit || teil.art) {
        // Die Schriftrolle rechnet mit dem hoechsten Zaubergrad ihrer
        // Seltenheit: sonst kostete eine gewoehnliche Rolle, die eben noch
        // eine legendaere Waffe war, 100.000 GM (Testbericht).
        neu.wert = gegenstandswert(neu.seltenheit, {
          verbrauch: VERBRAUCH[neu.art],
          schriftrolleGrad: neu.art === 'schriftrolle' ? hoechsterGrad(neu.seltenheit) : undefined
        });
      }
      // Traenke und Schriftrollen verlangen nie Einstimmung.
      if (teil.art && (neu.art === 'trank' || neu.art === 'schriftrolle')) neu.einstimmung = false;
      setOffen(neu);
      setMeldung('');
    };
    /** Eine Wirkung (ersetzt `stelle` oder kommt dazu) oder den Fluch von der KI. */
    const feldVonKi = async (aufgabe: 'wirkung' | 'fluch', stelle?: number) => {
      const text = (await frageKi({ aufgabe, art: offen.art, seltenheit: offen.seltenheit, gegenstand: offen, stelle })) as
        | string
        | null;
      if (!text) return;
      const neu =
        aufgabe === 'fluch'
          ? { ...offen, fluch: text }
          : {
              ...offen,
              wirkungen:
                stelle === undefined
                  ? [...offen.wirkungen.filter((w) => w.trim()), text]
                  : offen.wirkungen.map((x, j) => (j === stelle ? text : x))
            };
      setOffen(mitPruefung(neu));
    };

    return (
      <div className="rahmen">
        <Kopf />
        {erzeugerLeiste(true)}
        <div className="leiste">
          <button
            type="button"
            className="knopf"
            onClick={() => {
              if (!darfVerwerfen()) return;
              setzeGrund(null);
              setIstNeu(false);
              setMeldung('');
              setKiZeilen([]);
            }}
          >
            ← {t('zurueck')}
          </button>
          <span className="leiste__luecke" />
          <button
            type="button"
            className="knopf"
            data-foundry
            onClick={() => {
              void (async () => {
                // Ein leerer Gegenstand ohne Namen wird nicht still exportiert (Testbericht).
                if (!offen.name.trim()) {
                  setFehler(t('foundry.ohneName'));
                  return;
                }
                if (!offen.wirkungen.some((w) => w.trim()) && !offen.fluch.trim() && !confirm(t('foundry.leer'))) return;
                const datei = alsFoundryDatei(offen);
                const ergebnis = await api.foundry(datei.name, datei.inhalt);
                if (ergebnis.ok) setMeldung(t('foundry.fertig', { pfad: ergebnis.text }));
                else if (ergebnis.text) setFehler(t('fehler.speichern', { detail: ergebnis.text }));
              })();
            }}
          >
            {t('foundry')}
          </button>
          <button
            type="button"
            className="knopf"
            data-loot
            title={offen.imLoot ? t('loot.herausHinweis') : undefined}
            onClick={() => void (offen.imLoot ? ausDemLoot() : inDenLoot())}
          >
            {offen.imLoot ? t('loot.drin') : t('loot')}
          </button>
          <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speichere)}>
            {t('speichern')}
          </button>
        </div>

        <section className="karte">
          <label className="feld">
            <span className="feld__name">{t('feld.name')}</span>
            <input
              className="feld__eingabe"
              value={offen.name}
              data-feld="name"
              onChange={(e) => setze({ name: e.target.value })}
            />
          </label>

          <MagieFelder
            g={offen}
            sprache={spr}
            setze={setze}
            nachKopf={
              <>
            {/* Der Wert laesst sich von Hand setzen (Wunsch aus dem Testbericht); der Vorschlag nach der Tabelle bleibt einen Klick entfernt. */}
            <label className="feld wert" title={t('wert.hinweis')} data-wert>
              <span className="feld__name">{t('feld.wertName')}</span>
              <input
                type="number"
                min={0}
                className="feld__eingabe feld__eingabe--kurz"
                data-feld="wert"
                value={offen.wert}
                onChange={(e) => {
                  const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                  setOffen({ ...offen, wert: n });
                }}
              />
              {(() => {
                const vorschlag = gegenstandswert(offen.seltenheit, {
                  verbrauch: VERBRAUCH[offen.art],
                  schriftrolleGrad: offen.art === 'schriftrolle' ? hoechsterGrad(offen.seltenheit) : undefined
                });
                return vorschlag !== offen.wert ? (
                  <button type="button" className="knopf knopf--klein" data-wert-vorschlag onClick={() => setOffen({ ...offen, wert: vorschlag })}>
                    {t('wert.vorschlag', { wert: zahl(vorschlag) })}
                  </button>
                ) : null;
              })()}
            </label>
            {wirkungenFuer && wirkungenFuer !== `${offen.seltenheit}|${offen.art}` ? (
              <p className="anpassen">
                <button
                  type="button"
                  className="knopf"
                  data-anpassen
                  onClick={() => {
                    if (offen.wirkungen.some((w) => w.trim()) && !confirm(t('anpassen.sicher'))) return;
                    const neu = erzeuge({ art: offen.art, seltenheit: offen.seltenheit, fluchChance: 0 }, spr);
                    setze({ wirkungen: neu.wirkungen, einstimmung: neu.einstimmung || Boolean(offen.fluch.trim()) });
                    setWirkungenFuer(`${offen.seltenheit}|${offen.art}`);
                  }}
                >
                  ⚄ {t('anpassen', { seltenheit: SELTENHEIT_NAME[offen.seltenheit][spr] })}
                </button>
              </p>
            ) : null}
              </>
            }
            wirkungKnoepfe={(i) =>
              kiDa ? (
                <button
                  type="button"
                  className="knopf"
                  data-wirkung-ki={i}
                  disabled={kiLaeuft}
                  aria-label={t('ki.feld')}
                  title={t('ki.feld')}
                  onClick={() => void feldVonKi('wirkung', i)}
                >
                  ✦
                </button>
              ) : null
            }
            neueWirkungKnoepfe={
              kiDa ? (
                <button type="button" className="knopf" data-wirkung-ki-neu disabled={kiLaeuft} onClick={() => void feldVonKi('wirkung')}>
                  {kiLaeuft ? t('ki.laeuft') : `✦ ${t('feld.neuKi')}`}
                </button>
              ) : null
            }
            fluchKnoepfe={
              kiDa ? (
                <button type="button" className="knopf" data-fluch-ki disabled={kiLaeuft} onClick={() => void feldVonKi('fluch')}>
                  {kiLaeuft ? t('ki.laeuft') : `✦ ${t('feld.neuKi')}`}
                </button>
              ) : null
            }
          />

          <label className="feld feld--hoch">
            <span className="feld__name">{t('feld.notiz')}</span>
            <textarea
              className="feld__flaeche"
              rows={5}
              value={offen.notiz}
              onChange={(e) => setze({ notiz: e.target.value })}
            />
          </label>

          {kiZeilen.length ? (
            <section className="kiHinweis" data-ki-berichtigt>
              <p>{t('ki.berichtigt')}</p>
              <ul>
                {kiZeilen.map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {meldung ? <p className="meldung">{meldung}</p> : null}
          {fehler ? <p className="fehler">{fehler}</p> : null}
        </section>
      </div>
    );
  }

  // --- Die Sammlung ---------------------------------------------------------
  return (
    <div className="rahmen">
      <Kopf />

      {erzeugerLeiste(false)}

      <div className="leiste">
        <input
          className="feld__eingabe leiste__suche"
          type="search"
          value={suche}
          placeholder={t('liste.suche')}
          aria-label={t('liste.suche')}
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      <p className="anzahl">
        {gefunden.length === 1 ? t('liste.eine') : t('liste.anzahl', { anzahl: gefunden.length })}
      </p>

      {eintraege.length === 0 ? (
        <p className="hinweis">{t('liste.leer')}</p>
      ) : gefunden.length === 0 ? (
        <p className="hinweis">{t('liste.nichts')}</p>
      ) : (
        <ul className="kacheln" data-pfeile="raster">
          {gefunden.map((e) => (
            <li data-pfeil key={e.id}>
              <button
                type="button"
                className="gegenstandskachel"
                data-id={e.id}
                style={{ '--marke': FARBE[e.seltenheit] } as CSSProperties}
                onClick={() => {
                  void (async () => {
                    const geladen = await api.sammlung.lesen(e.id);
                    if (geladen) {
                      setzeGrund(geladen);
                      setWirkungenFuer(`${geladen.seltenheit}|${geladen.art}`);
                      setIstNeu(false);
                    } else setFehler(t('fehler.lesen'));
                  })();
                }}
              >
                <span className="gegenstandskachel__name">
                  <span className="gegenstandskachel__zeichen" aria-hidden="true">
                    {ART_ZEICHEN[e.art]}
                  </span>{' '}
                  {e.name}
                </span>
                <span className="gegenstandskachel__zahl">
                  <span className="seltenheit">{SELTENHEIT_NAME[e.seltenheit][spr]}</span> ·{' '}
                  {ART_NAME[e.art][spr]}
                  {e.einstimmung ? ` · ${t('einstimmung')}` : ''}
                  {e.verflucht ? ` · ${t('verflucht')}` : ''}
                </span>
                {e.kurz ? <span className="gegenstandskachel__unten">{e.kurz}</span> : null}
              </button>
              <button
                type="button"
                className="gegenstandskachel__weg"
                aria-label={t('loeschen')}
                title={t('loeschen')}
                onClick={() => {
                  if (!confirm(t('loeschen.sicher', { name: e.name }))) return;
                  void (async () => {
                    await api.sammlung.loeschen(e.id);
                    await ladeListe();
                  })();
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {fehler ? <p className="fehler">{fehler}</p> : null}
    </div>
  );
}

function Kopf() {
  return (
    <header className="kopf">
      <h1>{t('titel')}</h1>
      <p>{t('untertitel')}</p>
    </header>
  );
}
