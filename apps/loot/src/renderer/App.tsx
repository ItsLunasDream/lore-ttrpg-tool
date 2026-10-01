/**
 * Der Loot Generator.
 *
 * Zwei Ansichten wie in den anderen Werkzeugen: die Sammlung als Kacheln
 * mit Suche (und einem Wurf direkt von der Kachel, fuer den Spielabend),
 * und eine Tabelle zum Wuerfeln und Bearbeiten. Gewuerfelt wird immer auf
 * den Stand im Eingabefeld, auch ungespeichert — so sieht man beim
 * Schreiben sofort, was herauskommt.
 *
 * Siehe `docs/loot.md`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { wuerfle, wuerfleReihe, type Ergebnis } from '@suite/tabellen';
import { api } from './api';
import { NAMENSNENNUNG } from '@suite/srd';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';
import {
  alsEintraege,
  alsZeilen,
  naechsterName,
  pruefe,
  nummeriere,
  sperrt,
  offenerVerweis,
  setzeVerweis,
  verweisVorschlaege,
  type Befund,
  type Gespeichert,
  type Kachel,
  alsKachel
} from '../shared/ablage';
import { istSrd, srdTabellen } from '../shared/srd';
import { gegenstandsTabellen, istGegenstandstabelle } from '../shared/gegenstaende';

/** Was im Bearbeiten-Feld steht. Die Zeilen bleiben Text, bis gespeichert wird. */
interface Entwurf {
  readonly id: string;
  readonly name: string;
  readonly wuerfel: string;
  readonly ohneZuruecklegen: boolean;
  readonly zeilen: string;
  readonly notiz: string;
}

function alsEntwurf(g: Gespeichert): Entwurf {
  return {
    id: g.id,
    name: g.name,
    wuerfel: g.wuerfel ?? '',
    ohneZuruecklegen: Boolean(g.ohneZuruecklegen),
    zeilen: alsZeilen(g.eintraege),
    notiz: g.notiz
  };
}

function alsTabelle(e: Entwurf, ersatzName: string): Gespeichert {
  return {
    id: e.id,
    name: e.name.trim() || ersatzName,
    ...(e.wuerfel.trim() ? { wuerfel: e.wuerfel.trim() } : {}),
    ohneZuruecklegen: e.ohneZuruecklegen,
    eintraege: alsEintraege(e.zeilen),
    notiz: e.notiz,
    geaendert: ''
  };
}

/**
 * Ein Wurf als Notiz: die Ergebnisse als Liste, darunter, woher sie kamen.
 * Die Herkunft steht dabei, weil man sich spaeter fragt, welche Tabelle
 * das war — der Wurf selbst ist dann laengst vergessen.
 */
function alsNotiz(ergebnisse: readonly Ergebnis[]): string {
  const namen = new Set<string>();
  const sammle = (e: Ergebnis) => {
    if (!e.fehler) namen.add(e.tabelle);
    e.teile.forEach(sammle);
  };
  ergebnisse.forEach(sammle);
  return [...ergebnisse.map((e) => `- ${e.text}`), '', `*${[...namen].join(' · ')}*`, ''].join('\n');
}

/** Eingebaut und schreibgeschuetzt: aus dem SRD oder aus dem Magic Item Generator. */
function istFest(id: string): boolean {
  return istSrd(id) || istGegenstandstabelle(id);
}

/** Irgendwo im Baum etwas, das nicht aufging? */
/** Was gewürfelt wurde, als eine Zeile für das Sitzungsprotokoll der Hülle. */
function meldeBeute(ergebnisse: readonly Ergebnis[]): void {
  const gut = ergebnisse.filter((e) => !hatFehler(e) && e.text.trim());
  if (gut.length === 0) return;
  api.protokoll({ art: 'beute', text: `${gut[0].tabelle}: ${gut.map((e) => e.text.trim()).join('; ')}` });
}

function hatFehler(e: Ergebnis): boolean {
  return Boolean(e.fehler) || e.teile.some(hatFehler);
}

function befundText(b: Befund): string {
  const { art, ...rest } = b;
  if (b.art === 'luecke' && b.von === b.bis) return t('befund.luecke1', { von: b.von });
  return t(`befund.${art}` as TextKey, rest as Record<string, string | number>);
}

export function App() {
  const [, neuZeichnen] = useState(0);
  const [kacheln, setKacheln] = useState<readonly Kachel[]>([]);
  const [eigene, setEigene] = useState<readonly Gespeichert[]>([]);
  const [gegenstaende, setGegenstaende] = useState<readonly { name: string; seltenheit: string; herkunft?: string }[]>([]);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState<Entwurf | null>(null);
  const [istNeu, setIstNeu] = useState(false);
  const [veraendert, setVeraendert] = useState(false);
  const [anzahlText, setAnzahlText] = useState('1');
  // Leeren und neu tippen muss gehen: gezaehlt wird erst beim Wuerfeln.
  const anzahl = Math.max(1, Math.min(20, Math.floor(Number(anzahlText)) || 1));
  /*
   * Was „ohne Zuruecklegen" schon gezogen hat, ueber mehrere Klicks und den
   * Schnellwurf hinweg (Testbericht: galt nur innerhalb eines Klicks).
   * Zuruecklegen setzt es zurueck.
   */
  const gezogen = useRef<Map<string, Set<number>>>(new Map());
  const zeilenBeimFokus = useRef<string | null>(null);
  const [, gezogenZeichnen] = useState(0);
  const [ergebnisse, setErgebnisse] = useState<readonly Ergebnis[]>([]);
  const [schnell, setSchnell] = useState<Ergebnis | null>(null);
  // Jeder Wurf bekommt eigene Schluessel: sonst bliebe die Zeile stehen,
  // und ein neues Ergebnis kaeme ohne Bewegung herein.
  const wurfId = useMemo(() => Math.random().toString(36).slice(2), [ergebnisse]);
  const schnellId = useMemo(() => Math.random().toString(36).slice(2), [schnell]);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  // Die eingebauten Tabellen fuer `oeffne`, ohne es bei jedem Sprachwechsel neu zu bauen.
  const festRef = useRef<readonly Gespeichert[]>([]);
  // Angefangener Verweis im Eintragsfeld: "[" schlaegt die Tabellen vor.
  const [verweis, setVerweis] = useState<{ von: number; cursor: number; suche: string } | null>(null);
  const [markiert, setMarkiert] = useState(0);
  const zeilenRef = useRef<HTMLTextAreaElement>(null);

  const ladeListe = useCallback(async () => {
    const [k, a, g] = await Promise.all([api.sammlung.liste(), api.sammlung.alle(), api.gegenstaende()]);
    setKacheln(k);
    setEigene(a);
    setGegenstaende(g);
  }, []);

  useEffect(() => {
    void ladeListe();
    // Zurueck im Werkzeug: neu lesen. Im Magic Item Generator kann inzwischen
    // ein Gegenstand dazugekommen sein, und eine Datei kann von Hand
    // geaendert worden sein.
    const auffrischen = () => {
      if (document.visibilityState === 'visible') void ladeListe();
    };
    window.addEventListener('focus', auffrischen);
    document.addEventListener('visibilitychange', auffrischen);
    return () => {
      window.removeEventListener('focus', auffrischen);
      document.removeEventListener('visibilitychange', auffrischen);
    };
  }, [ladeListe]);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  const spr = getLanguage() === 'de' ? 'de' : 'en';
  // Die eingebauten Tabellen in der Sprache der Oberflaeche; ueber sie
  // laufen Verweise wie ueber jede eigene.
  // Dazu der Bestand des Magic Item Generators. Beides schreibgeschuetzt.
  const srd = useMemo(
    () => [...srdTabellen(spr), ...gegenstandsTabellen(gegenstaende, spr)],
    [spr, gegenstaende]
  );
  const srdKacheln = useMemo(() => srd.map(alsKachel), [srd]);
  const alle = useMemo(() => [...eigene, ...srd], [eigene, srd]);
  // Eigene Tabellen, deren Wuerfeln gesperrt ist: auch der Schnellwurf von
  // der Kachel wuerfelt sie nicht (Testbericht).
  const gesperrteIds = useMemo(
    () => new Set(eigene.filter((e) => pruefe(e, alle).some(sperrt)).map((e) => e.id)),
    [eigene, alle]
  );

  const oeffne = useCallback(async (id: string) => {
    const geladen = istFest(id) ? festRef.current.find((f) => f.id === id) : await api.sammlung.lesen(id);
    if (!geladen) {
      setFehler(t('fehler.lesen'));
      return;
    }
    setOffen(alsEntwurf(geladen));
    setIstNeu(false);
    setVeraendert(false);
    setErgebnisse([]);
    setMeldung('');
    setFehler('');
  }, []);

  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" aus
   * einem geoeffneten Eintrag fuehrt zur Liste, nicht zum vorigen Werkzeug
   * (Rueckmeldung). `null` ist die Liste, ein ungespeicherter Entwurf heisst
   * „entwurf" und laesst sich nicht wieder herstellen.
   */
  const ort = offen ? offen.id || 'entwurf' : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) {
          setOffen(null);
          setMeldung('');
          setFehler('');
          return;
        }
        if (ziel !== 'entwurf') void oeffne(ziel);
      }),
    [oeffne]
  );
  festRef.current = srd;

  useEffect(() => api.beiSuchtreffer((kennung) => void oeffne(kennung)), [oeffne]);

  const gefunden = useMemo(() => {
    const worte = suche.toLowerCase().split(/\s+/).filter(Boolean);
    return [...kacheln, ...srdKacheln]
      .filter((k) => {
        const heu = `${k.name} ${k.kurz}`.toLowerCase();
        return worte.every((w) => heu.includes(w));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [kacheln, srdKacheln, suche]);

  const ersatzName = useMemo(() => naechsterName(t('neu.name'), eigene.map((a) => a.name)), [eigene]);

  // Die Tabelle, wie sie gerade im Feld steht, und der Bestand drumherum:
  // Verweise auf sie selbst gehen auf die bearbeitete Fassung.
  const aktuell = useMemo(() => (offen ? alsTabelle(offen, ersatzName) : null), [offen, ersatzName]);
  const bestand = useMemo(() => {
    if (!aktuell) return alle;
    const ohne = alle.filter((a) => a.id !== aktuell.id || !aktuell.id);
    return [...ohne, aktuell];
  }, [alle, aktuell]);
  const befunde = useMemo(() => (aktuell ? pruefe(aktuell, alle) : []), [aktuell, alle]);
  // Was das Wuerfeln sperrt. Nur bei eigenen Tabellen: die eingebauten und
  // die aus dem Magic Item Generator kann hier niemand berichtigen.
  const sperre = befunde.filter(sperrt);
  // Eine eigene Tabelle mit dem Namen einer anderen: Verweise `[Name]`
  // treffen dann nur eine davon, und die eingebaute wird still verdeckt.
  const doppelterName = useMemo(() => {
    if (!aktuell || !aktuell.name.trim()) return false;
    const name = aktuell.name.trim().toLowerCase();
    return alle.some((a) => a.id !== aktuell.id && a.name.trim().toLowerCase() === name);
  }, [aktuell, alle]);
  const vorschlaege = useMemo(
    () =>
      verweis
        ? verweisVorschlaege(
            alle.filter((a) => !aktuell || a.id !== aktuell.id || !a.id).map((a) => a.name),
            verweis.suche
          )
        : [],
    [verweis, alle, aktuell]
  );
  const pruefeVerweis = (feld: HTMLTextAreaElement) => {
    const gefunden = feld.selectionStart === feld.selectionEnd ? offenerVerweis(feld.value, feld.selectionStart) : null;
    setVerweis(gefunden ? { ...gefunden, cursor: feld.selectionStart } : null);
    setMarkiert(0);
  };
  const nimmVerweis = (name: string) => {
    if (!offen || !verweis) return;
    const neu = setzeVerweis(offen.zeilen, verweis.von, verweis.cursor, name);
    setOffen({ ...offen, zeilen: neu.text });
    setVeraendert(true);
    setVerweis(null);
    requestAnimationFrame(() => {
      const feld = zeilenRef.current;
      if (!feld) return;
      feld.focus();
      feld.setSelectionRange(neu.cursor, neu.cursor);
    });
  };

  // --- Eine Tabelle ---------------------------------------------------------
  if (offen && aktuell) {
    const nurLesen = istFest(offen.id);
    const setze = (teil: Partial<Entwurf>) => {
      setOffen({ ...offen, ...teil });
      setVeraendert(true);
      setMeldung('');
    };

    const speichere = async () => {
      setFehler('');
      const ergebnis = await api.sammlung.speichern(aktuell, istNeu);
      if (!ergebnis.ok) {
        setFehler(t('fehler.speichern', { detail: ergebnis.text }));
        return;
      }
      setOffen({ ...offen, id: ergebnis.id, name: aktuell.name });
      setIstNeu(false);
      setVeraendert(false);
      setMeldung(t('gespeichert'));
      await ladeListe();
    };

    const insStory = async () => {
      const ergebnis = await api.story(t('story.titel', { name: aktuell.name }), alsNotiz(ergebnisse));
      if (ergebnis.ok) setMeldung(t('story.fertig', { text: ergebnis.text }));
      else setFehler(t('story.fehler', { text: ergebnis.text }));
    };

    const kopiere = async () => {
      try {
        await navigator.clipboard.writeText(ergebnisse.map((e) => e.text).join('\n'));
        setMeldung(t('wurf.kopiert'));
      } catch {
        // Ohne Zwischenablage bleibt der Text zum Markieren stehen.
      }
    };

    return (
      <div className="rahmen">
        <Kopf />
        <div className="leiste">
          <button
            type="button"
            className="knopf"
            onClick={() => {
              if (veraendert && !confirm(t('verwerfen.sicher'))) return;
              setOffen(null);
              setErgebnisse([]);
              setMeldung('');
              setFehler('');
            }}
          >
            ← {t('zurueck')}
          </button>
          <span className="leiste__luecke" />
          {nurLesen ? (
            <button
              type="button"
              className="knopf knopf--haupt"
              data-kopie
              onClick={() => {
                setOffen({ ...offen, id: '', name: t('srd.kopieName', { name: offen.name }) });
                setIstNeu(true);
                setVeraendert(true);
                setMeldung('');
              }}
            >
              {t('srd.kopie')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="knopf"
                data-weitergeben
                onClick={() => {
                  if (istNeu || veraendert) {
                    setMeldung(t('weitergeben.erst'));
                    return;
                  }
                  void (async () => {
                    const ergebnis = await api.sammlung.weitergeben(offen.id);
                    if (ergebnis.ok) setMeldung(t('weitergeben.fertig', { pfad: ergebnis.text }));
                    else if (ergebnis.text) setFehler(t('fehler.speichern', { detail: ergebnis.text }));
                  })();
                }}
              >
                {t('weitergeben')}
              </button>
              {!istNeu ? (
                <button
                  type="button"
                  className="knopf"
                  data-loeschen
                  onClick={() => {
                    if (!confirm(t('loeschen.sicher', { name: aktuell.name }))) return;
                    void (async () => {
                      await api.sammlung.loeschen(offen.id);
                      setOffen(null);
                      setErgebnisse([]);
                      await ladeListe();
                    })();
                  }}
                >
                  {t('loeschen')}
                </button>
              ) : null}
              <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => void speichere()}>
                {t('speichern')}
              </button>
            </>
          )}
        </div>

        <section className="karte wurfkarte">
          <div className="wurfzeile">
            <h2>{aktuell.name}</h2>
            <span className="leiste__luecke" />
            <label className="feld feld--zeile">
              <span className="feld__name">{t('wurf.anzahl')}</span>
              <input
                className="feld__eingabe feld__eingabe--zahl"
                type="number"
                min={1}
                max={20}
                value={anzahlText}
                data-anzahl
                onChange={(e) => setAnzahlText(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                onBlur={() => setAnzahlText(String(anzahl))}
              />
            </label>
            <button
              type="button"
              className="knopf knopf--haupt"
              data-wuerfeln
              disabled={aktuell.eintraege.length === 0 || (!nurLesen && sperre.length > 0)}
              title={!nurLesen && sperre.length > 0 ? befundText(sperre[0]) : undefined}
              onClick={() => {
                const neu = wuerfleReihe(aktuell, bestand, anzahl, Math.random, gezogen.current);
                setErgebnisse(neu);
                meldeBeute(neu);
                gezogenZeichnen((n) => n + 1);
                setMeldung('');
              }}
            >
              ⚄ {t('wuerfeln')}
            </button>
          </div>
          {aktuell.ohneZuruecklegen && (gezogen.current.get(aktuell.id)?.size ?? 0) > 0 ? (
            <p className="hinweis hinweis--klein" data-gezogen>
              {t('zurueckgelegt.hinweis', {
                n: gezogen.current.get(aktuell.id)?.size ?? 0,
                m: aktuell.eintraege.length
              })}{' '}
              <button
                type="button"
                className="knopf knopf--klein"
                data-zuruecklegen
                onClick={() => {
                  gezogen.current = new Map();
                  gezogenZeichnen((n) => n + 1);
                }}
              >
                {t('zurueckgelegt')}
              </button>
            </p>
          ) : null}
          {aktuell.eintraege.length === 0 ? <p className="hinweis">{t('wurf.leer')}</p> : null}
          {!nurLesen && doppelterName ? (
            <p className="hinweis" data-doppelter-name>
              {t('warnung.doppelterName', { name: aktuell.name })}
            </p>
          ) : null}
          {!nurLesen && sperre.length > 0 ? (
            <p className="fehler" data-gesperrt>
              {t('wurf.gesperrt')} {sperre.map(befundText).join(' ')}
            </p>
          ) : null}
          {nurLesen ? (
            <p className="hinweis hinweis--klein srd-hinweis" data-srd-hinweis>
              {istSrd(offen.id) ? `${t('srd.hinweis')} ${NAMENSNENNUNG[spr]}` : t('mi.hinweis')}
            </p>
          ) : null}
          {ergebnisse.length > 0 ? (
            <>
              <ol className="ergebnisse" data-ergebnisse>
                {ergebnisse.map((e, i) => (
                  <ErgebnisZeile key={`${wurfId}-${i}`} ergebnis={e} />
                ))}
              </ol>
              <div className="knopfreihe">
                <button type="button" className="knopf" onClick={() => void kopiere()}>
                  {t('wurf.kopieren')}
                </button>
                <button type="button" className="knopf" data-story onClick={() => void insStory()}>
                  {t('story')}
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="karte">
          <fieldset className="bearbeiten" disabled={nurLesen}>
          <div className="kopfzeile">
            <label className="feld feld--breit">
              <span className="feld__name">{t('feld.name')}</span>
              <input
                className="feld__eingabe"
                value={offen.name}
                placeholder={istNeu ? ersatzName : ''}
                data-feld="name"
                onChange={(e) => setze({ name: e.target.value })}
              />
            </label>
            <label className="feld">
              <span className="feld__name">{t('feld.wuerfel')}</span>
              <input
                className="feld__eingabe"
                value={offen.wuerfel}
                placeholder={t('feld.wuerfelHinweis')}
                data-feld="wuerfel"
                onChange={(e) => setze({ wuerfel: e.target.value })}
              />
            </label>
          </div>
          <label className="feld feld--haken" title={t('feld.ohneZuruecklegenHinweis')}>
            <input
              type="checkbox"
              checked={offen.ohneZuruecklegen}
              data-feld="ohneZuruecklegen"
              onChange={(e) => setze({ ohneZuruecklegen: e.target.checked })}
            />{' '}
            {t('feld.ohneZuruecklegen')}
            <span className="hinweis--klein"> · {t('feld.ohneZuruecklegenHinweis')}</span>
          </label>

          <label className="feld feld--hoch">
            <span className="feld__name">{t('feld.eintraege')}</span>
            <textarea
              className="feld__flaeche zeilenfeld"
              rows={12}
              spellCheck={false}
              value={offen.zeilen}
              data-feld="zeilen"
              ref={zeilenRef}
              aria-autocomplete="list"
              onChange={(e) => {
                setze({ zeilen: e.target.value });
                pruefeVerweis(e.target);
              }}
              onSelect={(e) => pruefeVerweis(e.currentTarget)}
              onKeyDown={(e) => {
                if (!verweis || vorschlaege.length === 0) return;
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const schritt = e.key === 'ArrowDown' ? 1 : -1;
                  setMarkiert((m) => (m + schritt + vorschlaege.length) % vorschlaege.length);
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  nimmVerweis(vorschlaege[Math.min(markiert, vorschlaege.length - 1)]);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setVerweis(null);
                }
              }}
              // Beim Verlassen bekommen Zeilen ohne Nummer die naechste freie
              // (und ein fehlender Wuerfel den passenden). Die Nummern bleiben
              // im Text und lassen sich dort aendern.
              // Nur, wenn im Feld etwas getippt wurde: ein Klick hinein und
              // wieder hinaus aendert die Tabelle nicht (Testbericht).
              onFocus={() => {
                zeilenBeimFokus.current = offen.zeilen;
              }}
              onBlur={() => {
                setVerweis(null);
                if (zeilenBeimFokus.current === offen.zeilen) return;
                const neu = nummeriere(offen.zeilen, offen.wuerfel);
                if (neu.zeilen !== offen.zeilen || neu.wuerfel !== offen.wuerfel) setze(neu);
              }}
            />
          </label>
          {verweis && vorschlaege.length > 0 ? (
            <ul className="vorschlaege" role="listbox" aria-label={t('feld.verweisVorschlaege')} data-vorschlaege>
              {vorschlaege.map((name, i) => (
                <li
                  key={name}
                  role="option"
                  aria-selected={i === markiert}
                  className={i === markiert ? 'vorschlaege__eintrag is-an' : 'vorschlaege__eintrag'}
                  data-vorschlag={name}
                  // mousedown statt click: sonst verliert das Feld vorher den
                  // Fokus, und onBlur schliesst die Liste.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    nimmVerweis(name);
                  }}
                  onMouseEnter={() => setMarkiert(i)}
                >
                  [{name}]
                </li>
              ))}
            </ul>
          ) : null}
          <p className="hinweis hinweis--klein">{t('feld.eintraegeHinweis')}</p>
          {befunde.length > 0 ? (
            <ul className="befunde" data-befunde>
              {befunde.map((b, i) => (
                <li key={i}>{befundText(b)}</li>
              ))}
            </ul>
          ) : null}

          <label className="feld feld--hoch">
            <span className="feld__name">{t('feld.notiz')}</span>
            <textarea
              className="feld__flaeche"
              rows={3}
              value={offen.notiz}
              onChange={(e) => setze({ notiz: e.target.value })}
            />
          </label>

          </fieldset>
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

      <div className="leiste">
        <input
          className="feld__eingabe leiste__suche"
          type="search"
          value={suche}
          placeholder={t('liste.suche')}
          aria-label={t('liste.suche')}
          onChange={(e) => setSuche(e.target.value)}
        />
        <span className="leiste__luecke" />
        <button
          type="button"
          className="knopf"
          data-einlesen
          onClick={() => {
            void (async () => {
              const ergebnis = await api.sammlung.einlesen();
              if (ergebnis.ok) {
                setMeldung(
                  ergebnis.namen.length ? t('einlesen.fertig', { namen: ergebnis.namen.join(', ') }) : t('einlesen.nichts')
                );
                await ladeListe();
              } else if (ergebnis.text) setFehler(t('fehler.speichern', { detail: ergebnis.text }));
            })();
          }}
        >
          {t('einlesen')}
        </button>
        <button
          type="button"
          className="knopf knopf--haupt"
          data-neu
          onClick={() => {
            setOffen({ id: '', name: '', wuerfel: '', ohneZuruecklegen: false, zeilen: '', notiz: '' });
            setIstNeu(true);
            setVeraendert(false);
            setErgebnisse([]);
            setMeldung('');
            setFehler('');
          }}
        >
          + {t('neu')}
        </button>
      </div>

      {schnell ? (
        <section className="karte schnellwurf" data-schnellwurf>
          <div className="wurfzeile">
            <h3>
              {t('wurf.letzter')}: {schnell.tabelle}
            </h3>
            <span className="leiste__luecke" />
            <button type="button" className="knopf" aria-label="×" onClick={() => setSchnell(null)}>
              ×
            </button>
          </div>
          <ol className="ergebnisse">
            <ErgebnisZeile key={schnellId} ergebnis={schnell} />
          </ol>
        </section>
      ) : null}

      <p className="anzahl">
        {gefunden.length === 1 ? t('liste.eine') : t('liste.anzahl', { anzahl: gefunden.length })}
      </p>

      {gefunden.length === 0 && kacheln.length === 0 && !suche ? (
        <p className="hinweis">{t('liste.leer')}</p>
      ) : gefunden.length === 0 ? (
        <p className="hinweis">{t('liste.nichts')}</p>
      ) : (
        <ul className="kacheln" data-pfeile="raster">
          {gefunden.map((k) => (
            <li data-pfeil key={k.id}>
              <button type="button" className="tabellenkachel" data-id={k.id} onClick={() => void oeffne(k.id)}>
                <span className="tabellenkachel__name">
                  {k.name}
                  {istFest(k.id) ? (
                    <span className="marke-srd"> {istSrd(k.id) ? t('srd') : t('mi.marke')}</span>
                  ) : null}
                </span>
                <span className="tabellenkachel__zahl">
                  {k.wuerfel || t('kachel.gleich')} ·{' '}
                  {k.anzahl === 1 ? t('kachel.eintrag') : t('kachel.eintraege', { anzahl: k.anzahl })}
                  {k.ohneZuruecklegen ? ` · ${t('kachel.ohneZuruecklegen')}` : ''}
                </span>
                {k.kurz ? <span className="tabellenkachel__unten">{k.kurz}</span> : null}
              </button>
              <button
                type="button"
                className="tabellenkachel__wurf"
                data-schnell={k.id}
                aria-label={t('schnell')}
                disabled={k.anzahl === 0 || gesperrteIds.has(k.id)}
                title={gesperrteIds.has(k.id) ? t('schnell.gesperrt') : t('schnell')}
                onClick={() => {
                  const tabelle = alle.find((a) => a.id === k.id);
                  if (!tabelle) return;
                  const neu = wuerfle(tabelle, alle, Math.random, 0, gezogen.current);
                  setSchnell(neu);
                  meldeBeute([neu]);
                }}
              >
                ⚄
              </button>
            </li>
          ))}
        </ul>
      )}
      {meldung ? <p className="meldung">{meldung}</p> : null}
      {fehler ? <p className="fehler">{fehler}</p> : null}
    </div>
  );
}

/** Ein Ergebnis mit aufklappbarer Herkunft, wenn es Verweise hatte. */
function ErgebnisZeile({ ergebnis }: { readonly ergebnis: Ergebnis }) {
  const unvollstaendig = hatFehler(ergebnis);
  return (
    <li className="ergebnis motion-eintritt" data-ergebnis>
      <span className="ergebnis__text">{ergebnis.text}</span>
      {unvollstaendig ? <span className="ergebnis__warnung"> ⚠ {t('wurf.unvollstaendig')}</span> : null}
      {ergebnis.teile.length > 0 || ergebnis.wurf !== undefined ? (
        <details className="herkunft">
          <summary>{t('wurf.herkunft')}</summary>
          <Baum ergebnis={ergebnis} />
        </details>
      ) : null}
    </li>
  );
}

function Baum({ ergebnis }: { readonly ergebnis: Ergebnis }) {
  return (
    <ul className="baum">
      <li>
        {ergebnis.fehler === 'fehlt' ? (
          <span className="baum__fehler">{t('baum.fehlt', { name: ergebnis.tabelle })}</span>
        ) : ergebnis.fehler === 'zu-tief' ? (
          <span className="baum__fehler">{t('baum.zutief', { name: ergebnis.tabelle })}</span>
        ) : ergebnis.fehler === 'kreis' ? (
          <span className="baum__fehler">{t('baum.kreis', { name: ergebnis.tabelle })}</span>
        ) : ergebnis.fehler === 'zu-viel' ? (
          <span className="baum__fehler">{t('baum.zuviel', { name: ergebnis.tabelle })}</span>
        ) : (
          <>
            <strong>{ergebnis.tabelle}</strong>
            {ergebnis.wurf !== undefined ? <span className="baum__wurf"> ({ergebnis.wurf})</span> : null}
            {': '}
            {ergebnis.text}
          </>
        )}
        {ergebnis.teile.map((teil, i) => (
          <Baum key={i} ergebnis={teil} />
        ))}
      </li>
    </ul>
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
