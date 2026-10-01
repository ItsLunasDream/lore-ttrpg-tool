/**
 * Die Oberflaeche des Nachschlagewerks.
 *
 * Zwei Spalten: links die Liste mit dem Suchfeld, rechts der Eintrag. Kein
 * Seitenwechsel beim Auswaehlen — wer nachschlaegt, will zurueck zur Liste,
 * ohne sie neu aufzubauen, und die Suche soll stehen bleiben.
 */
import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { NAMENSNENNUNG, type Sprache } from '@suite/srd';
import { api } from './api';
import { getLanguage, setLanguage, t } from './i18n';
import {
  ARTEN,
  ART_GRUPPE,
  ART_NAME,
  alleRegeln,
  alsRegel,
  glossarId,
  homebrewAlsRegel,
  type HomebrewEintrag,
  regelFuerGlossar,
  regelMitNamen,
  unterpunkt,
  type Regel
} from '../shared/bestand';
import type { Glossarblock } from '@suite/srd/glossar';
import { finde } from '../shared/suche';
import { verlinke } from '../shared/verweise';
import { zerlege, type Hausregel } from '../shared/hausregeln';
import { findetStelle, markiere, nteStelle, vorkommenBei, type Notiz } from '../shared/notizen';
import { Verweisfeld } from './Verweisfeld';
import { Gestalten, LEERER_AUFRUF, leseAufruf, type Gestaltaufruf } from './Gestalten';

/**
 * Die Notizen am Text: welche es gibt, und wie man eine oeffnet. Als Kontext
 * aus demselben Grund wie die Verweise — sie stecken tief in den Bloecken.
 */
interface Notizkontext {
  readonly notizen: readonly Notiz[];
  readonly oeffne: (notiz: Notiz, rect: DOMRect, neu: boolean) => void;
}

const NotizKontext = createContext<Notizkontext>({ notizen: [], oeffne: () => undefined });

/** Der Text eines Blocks, an dem eine Notiz haengen kann; sonst `undefined`. */
function blocktext(block: Glossarblock | undefined, s: Sprache): string | undefined {
  return block && (block.typ === 'absatz' || block.typ === 'punkt' || block.typ === 'stichpunkt')
    ? block.text[s]
    : undefined;
}

/**
 * Was ein Verweis kann: oeffnen und seine Vorschau zeigen. Als Kontext, weil
 * Verweise tief in Bloecken, Listen und Saetzen stecken.
 */
interface Verweiskontext {
  /** Ein Eintrag nach Kennung, offiziell oder Hausregel. */
  readonly nach: (id: string) => Regel | undefined;
  readonly oeffne: (id: string) => void;
  readonly zeige: (id: string, rect: DOMRect) => void;
  readonly verberge: () => void;
}

const VerweisKontext = createContext<Verweiskontext>({
  nach: () => undefined,
  oeffne: () => undefined,
  zeige: () => undefined,
  verberge: () => undefined
});

/** Wie lange der Zeiger auf einem Verweis ruhen muss, bis die Karte kommt. */
const VORSCHAU_NACH_MS = 250;
/** Wie lange sie stehen bleibt, wenn der Zeiger den Verweis verlaesst — Zeit, auf die Karte zu wechseln. */
const VORSCHAU_BLEIBT_MS = 200;

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

function andere(spr: Sprache): Sprache {
  return spr === 'de' ? 'en' : 'de';
}

/**
 * Der Name in der zweiten Sprache, oder nichts.
 *
 * Nur auf Deutsch steht der englische Name dabei: wer auf Englisch spielt,
 * braucht den deutschen nicht und liest ihn als Rauschen (Rueckmeldung).
 * Umgekehrt ist er nuetzlich, weil Runden oft mit englischen Begriffen
 * spielen.
 */
function zweitName(regel: Regel, spr: Sprache): string | null {
  // Selbst geschriebenes (Hausregel, Homebrew) hat nur einen Namen.
  if (regel.art === 'hausregel' || regel.art === 'homebrew') return null;
  return spr === 'de' ? regel.name.en : null;
}

export function App() {
  const [, neuZeichnen] = useState(0);
  const [suche, setSuche] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);
  /**
   * Die zweite Sprache daneben.
   *
   * Weil die englische Fassung die massgebliche ist: wer auf Deutsch
   * liest und bei einer Formulierung stutzt, soll das Original daneben
   * sehen koennen, ohne die ganze Huelle umzustellen.
   */
  const [daneben, setDaneben] = useState(false);
  const [vorschau, setVorschau] = useState<{ id: string; rect: DOMRect } | null>(null);
  const uhr = useRef<number | null>(null);
  const [hausregeln, setHausregeln] = useState<readonly Hausregel[]>([]);
  /** Die Hausregel, die gerade geschrieben wird. `neu`: noch nicht auf der Platte. */
  const [bearbeitung, setBearbeitung] = useState<{ regel: Hausregel; neu: boolean } | null>(null);
  const [fehler, setFehler] = useState('');
  const [notizen, setNotizen] = useState<readonly Notiz[]>([]);
  /** Die Notiz im kleinen Fenster: eine neue oder eine, die man bearbeitet. */
  const [notizfenster, setNotizfenster] = useState<{ notiz: Notiz; rect: DOMRect; neu: boolean } | null>(null);
  /**
   * Regeln oder Gestalten (docs/tiergestalt.md). Ein neuer Aufruf von aussen
   * (Charakterbogen) zaehlt `nr` hoch, damit die Ansicht mit seinen Werten
   * neu anfaengt statt die alten Filter zu behalten.
   */
  const [ansicht, setAnsicht] = useState<'regeln' | 'gestalten'>('regeln');
  const [gestaltaufruf, setGestaltaufruf] = useState<{ aufruf: Gestaltaufruf; nr: number }>({ aufruf: LEERER_AUFRUF, nr: 0 });
  const zeigeGestalten = (aufruf: Gestaltaufruf) => {
    setAnsicht('gestalten');
    setGestaltaufruf((alt) => ({ aufruf, nr: alt.nr + 1 }));
  };

  useEffect(() => {
    void api.notizen.liste().then(setNotizen, () => setNotizen([]));
  }, []);

  const schreibeNotizen = async (neu: readonly Notiz[]) => {
    setNotizen(neu);
    if (!(await api.notizen.schreiben([...neu]))) setFehler(t('notiz.fehler'));
  };

  const notizwege = useMemo<Notizkontext>(
    () => ({ notizen, oeffne: (notiz, rect, neu) => setNotizfenster({ notiz, rect, neu }) }),
    [notizen]
  );

  const ladeHausregeln = async () => {
    try {
      setHausregeln(await api.hausregeln.liste());
    } catch {
      setHausregeln([]);
    }
  };
  useEffect(() => {
    void ladeHausregeln();
  }, []);

  /*
   * Eintraege aus dem Homebrew Creator. Neu gelesen, wenn das Fenster den
   * Fokus bekommt: wer dort etwas speichert und hierher wechselt, soll es
   * sehen, ohne neu zu starten.
   */
  const [homebrew, setHomebrew] = useState<readonly HomebrewEintrag[]>([]);
  useEffect(() => {
    const lade = () => void api.homebrew.liste().then(setHomebrew, () => setHomebrew([]));
    lade();
    window.addEventListener('focus', lade);
    return () => window.removeEventListener('focus', lade);
  }, []);

  const regeln = useMemo(
    () => [...hausregeln.map(alsRegel), ...homebrew.map(homebrewAlsRegel), ...alleRegeln()],
    [hausregeln, homebrew]
  );
  const regelnRef = useRef(regeln);
  regelnRef.current = regeln;
  const nach = (id: string) => regelnRef.current.find((regel) => regel.id === id);

  const warteDann = (ms: number, tun: () => void) => {
    if (uhr.current !== null) window.clearTimeout(uhr.current);
    uhr.current = window.setTimeout(() => {
      uhr.current = null;
      tun();
    }, ms);
  };

  const verweise = useMemo<Verweiskontext>(
    () => ({
      nach,
      oeffne: (id) => {
        if (uhr.current !== null) window.clearTimeout(uhr.current);
        setVorschau(null);
        setBearbeitung(null);
        setOffenId(id);
      },
      zeige: (id, rect) => warteDann(VORSCHAU_NACH_MS, () => setVorschau({ id, rect })),
      verberge: () => warteDann(VORSCHAU_BLEIBT_MS, () => setVorschau(null))
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const spr = sprache();
  const treffer = useMemo(() => finde(regeln, suche, spr), [regeln, suche, spr]);
  const offen = offenId ? regeln.find((regel) => regel.id === offenId) : undefined;

  const speichereHausregel = async (regel: Hausregel, neu: boolean) => {
    setFehler('');
    const name = regel.name.trim();
    if (!name) {
      setFehler(t('haus.nameFehlt'));
      return;
    }
    const ergebnis = await api.hausregeln.speichern({ ...regel, name }, neu);
    if (!ergebnis.ok) {
      setFehler(t('haus.fehler', { detail: ergebnis.text }));
      return;
    }
    await ladeHausregeln();
    setBearbeitung(null);
    setOffenId(`hausregel/${ergebnis.id}`);
  };

  const loescheHausregel = async (regel: Hausregel) => {
    if (!confirm(t('haus.loeschenSicher', { name: regel.name }))) return;
    await api.hausregeln.loeschen(regel.id);
    await ladeHausregeln();
    setOffenId(regel.bezug || null);
  };

  const neueHausregel = (bezug: string) =>
    setBearbeitung({ regel: { id: '', name: '', bezug, text: '', geaendert: '' }, neu: true });

  /*
   * Die Sprache kommt aus der Huelle, nicht aus einem eigenen Waehler.
   * Zwei Stellen fuer dieselbe Einstellung heisst, dass man immer in der
   * falschen nachsieht.
   */
  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" fuehrt
   * zum vorigen Eintrag oder zur Liste, nicht zum vorigen Werkzeug
   * (Rueckmeldung).
   */
  useEffect(() => api.ort.melde(ansicht === 'gestalten' ? 'gestalten' : offenId), [offenId, ansicht]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        setBearbeitung(null);
        if (ziel === 'gestalten') {
          setAnsicht('gestalten');
          return;
        }
        setAnsicht('regeln');
        setOffenId(ziel);
      }),
    []
  );

  /** Ein Treffer aus der Suche der Huelle (Strg+K) oeffnet den Eintrag. */
  useEffect(
    () =>
      api.beiSuchtreffer((kennung) => {
        // Hausregeln kommen erst mit dem Lesen der Platte; darum hier nicht
        // pruefen, ob es den Eintrag gibt — gibt es ihn nicht, steht rechts
        // der leere Hinweis.
        setBearbeitung(null);
        setSuche('');
        const aufruf = leseAufruf(kennung);
        if (aufruf) {
          zeigeGestalten(aufruf);
          return;
        }
        setAnsicht('regeln');
        // Eine Hausregel kann gerade erst angekommen sein (Austausch).
        if (kennung.startsWith('hausregel/')) void ladeHausregeln();
        if (!kennung.startsWith('notiz/')) {
          setOffenId(kennung);
          return;
        }
        // Eine Notiz: den Eintrag oeffnen, an dem sie haengt, und zu ihrem
        // Absatz rollen.
        void api.notizen.liste().then((liste) => {
          const notiz = liste.find((n) => `notiz/${n.id}` === kennung);
          if (!notiz) return;
          setNotizen(liste);
          setOffenId(notiz.regel);
          setTimeout(() => {
            document.querySelector(`[data-block="${notiz.block}"]`)?.scrollIntoView({ block: 'center' });
          }, 100);
        });
      }),
    []
  );

  // Gruppiert nach Art, in der festen Reihenfolge der Arten. Mit Suche
  // bleibt die Reihenfolge der Guete: dann zaehlt, was am besten passt,
  // nicht, wozu es gehoert.
  const gruppen = useMemo(() => {
    if (suche.trim()) return [{ art: null, treffer }];
    return ARTEN.map((art) => ({
      art,
      treffer: treffer
        .filter((eintrag) => eintrag.regel.art === art)
        .sort((a, b) => a.regel.name[spr].localeCompare(b.regel.name[spr], spr))
    })).filter((gruppe) => gruppe.treffer.length > 0);
  }, [suche, treffer, spr]);

  return (
    <VerweisKontext.Provider value={verweise}>
    <NotizKontext.Provider value={notizwege}>
    <div className="rahmen">
      <header className="kopf">
        <h1>{t('titel')}</h1>
        <p>{t('untertitel')}</p>
        <div className="kopf__ansicht" role="tablist">
          {(['regeln', 'gestalten'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              className={ansicht === a ? 'reiter reiter--an' : 'reiter'}
              aria-selected={ansicht === a}
              data-ansicht={a}
              onClick={() => setAnsicht(a)}
            >
              {t(a === 'regeln' ? 'ansicht.regeln' : 'ansicht.gestalten')}
            </button>
          ))}
        </div>
      </header>

      {ansicht === 'gestalten' ? (
        <Gestalten key={gestaltaufruf.nr} aufruf={gestaltaufruf.aufruf} spr={spr} />
      ) : (
      <div className="spalten">
        <nav className="liste" data-pfeile="liste" aria-label={t('titel')}>
          <input
            className="liste__suche"
            type="search"
            value={suche}
            placeholder={t('suche.platzhalter')}
            aria-label={t('suche')}
            onChange={(e) => setSuche(e.target.value)}
          />
          <button type="button" className="knopf liste__neu" data-hausregel-neu onClick={() => neueHausregel('')}>
            + {t('haus.neu')}
          </button>
          {suche.trim() ? (
            <p className="liste__anzahl">
              {treffer.length === 0 ? t('suche.nichts') : t('suche.anzahl', { anzahl: treffer.length })}
            </p>
          ) : null}

          {gruppen.map((gruppe) => (
            <section key={gruppe.art ?? 'treffer'} className="liste__gruppe">
              {gruppe.art ? <h2>{ART_GRUPPE[gruppe.art][spr]}</h2> : null}
              <ul>
                {gruppe.treffer.map(({ regel, stelle }) => (
                  <li key={regel.id}>
                    <button
                      type="button"
                      className={
                        regel.id === offenId ? 'eintrag eintrag--offen' : 'eintrag'
                      }
                      data-regel={regel.id}
                      aria-current={regel.id === offenId ? 'true' : undefined}
                      onClick={() => {
                        setBearbeitung(null);
                        setOffenId(regel.id);
                      }}
                    >
                      <span className="eintrag__name">{regel.name[spr]}</span>
                      {regel.art === 'hausregel' || regel.art === 'homebrew' || !zweitName(regel, spr) ? null : (
                        <span className="eintrag__anders">{zweitName(regel, spr)}</span>
                      )}
                      {/* Die Fundstelle, wenn es nicht am Namen lag: sie ist
                          der Grund, warum der Eintrag ueberhaupt dasteht. */}
                      {stelle ? <span className="eintrag__stelle">{stelle}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <main className="blatt">
          {bearbeitung ? (
            <Hausregelformular
              regel={bearbeitung.regel}
              neu={bearbeitung.neu}
              regeln={regeln}
              fehler={fehler}
              speichern={(regel) => void speichereHausregel(regel, bearbeitung.neu)}
              abbrechen={() => {
                setBearbeitung(null);
                setFehler('');
              }}
            />
          ) : offen && offen.art === 'hausregel' ? (
            <Hausblatt
              regel={hausregeln.find((h) => `hausregel/${h.id}` === offen.id) as Hausregel}
              bearbeiten={(regel) => setBearbeitung({ regel, neu: false })}
              loeschen={(regel) => void loescheHausregel(regel)}
            />
          ) : offen ? (
            <Blatt
              regel={offen}
              daneben={daneben}
              onDaneben={() => setDaneben(!daneben)}
              amTisch={hausregeln.filter((h) => h.bezug === offen.id)}
              hausregelDazu={() => neueHausregel(offen.id)}
            />
          ) : (
            <div className="blatt__leer">
              <h2>{t('leer.titel')}</h2>
              <p>{t('leer.satz')}</p>
            </div>
          )}
        </main>
      </div>
      )}

      {/*
        Die Namensnennung, woertlich und in der Sprache der Huelle. Sie steht
        auch im Ueber-Dialog; hier steht sie, weil dieses Werkzeug fast nur
        aus fremdem Material besteht und man wissen soll, woher es kommt.
      */}
      <footer className="fuss">
        <span className="fuss__marke">{t('quelle')}</span> {NAMENSNENNUNG[spr]}
      </footer>

      {vorschau && nach(vorschau.id) ? (
        <Vorschau
          regel={nach(vorschau.id) as Regel}
          rect={vorschau.rect}
          bleib={() => {
            if (uhr.current !== null) window.clearTimeout(uhr.current);
          }}
          geh={() => verweise.verberge()}
        />
      ) : null}
      {notizfenster ? (
        <Notizfenster
          notiz={notizfenster.notiz}
          rect={notizfenster.rect}
          neu={notizfenster.neu}
          speichern={(text) => {
            const fertig = { ...notizfenster.notiz, text, geaendert: new Date().toISOString() };
            void schreibeNotizen(
              notizfenster.neu
                ? [...notizen, fertig]
                : notizen.map((n) => (n.id === fertig.id ? fertig : n))
            );
            setNotizfenster(null);
          }}
          loeschen={() => {
            void schreibeNotizen(notizen.filter((n) => n.id !== notizfenster.notiz.id));
            setNotizfenster(null);
          }}
          schliessen={() => setNotizfenster(null)}
        />
      ) : null}
    </div>
    </NotizKontext.Provider>
    </VerweisKontext.Provider>
  );
}

const NOTIZ_BREIT = 300;

/** Das kleine Fenster fuer eine Notiz: schreiben, aendern, loeschen. */
function Notizfenster({
  notiz,
  rect,
  neu,
  speichern,
  loeschen,
  schliessen
}: {
  readonly notiz: Notiz;
  readonly rect: DOMRect;
  readonly neu: boolean;
  readonly speichern: (text: string) => void;
  readonly loeschen: () => void;
  readonly schliessen: () => void;
}) {
  const [text, setText] = useState(notiz.text);
  const links = Math.max(8, Math.min(rect.left, window.innerWidth - NOTIZ_BREIT - 8));
  const oben = rect.bottom + 220 > window.innerHeight;
  const lage = oben
    ? { left: links, bottom: window.innerHeight - rect.top + 6, width: NOTIZ_BREIT }
    : { left: links, top: rect.bottom + 6, width: NOTIZ_BREIT };
  return (
    <div className="notizfenster" style={lage} role="dialog" aria-label={t('notiz.titel')} data-notizfenster>
      <p className="notizfenster__stelle">„{notiz.stelle}"</p>
      <textarea
        autoFocus
        rows={4}
        value={text}
        placeholder={t('notiz.platzhalter')}
        data-notiz-text
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') schliessen();
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) speichern(text.trim());
        }}
      />
      <div className="regel__knoepfe">
        <button
          type="button"
          className="knopf knopf--haupt"
          data-notiz-speichern
          disabled={!text.trim()}
          onClick={() => speichern(text.trim())}
        >
          {t('haus.speichern')}
        </button>
        {neu ? null : (
          <button type="button" className="knopf" data-notiz-loeschen onClick={loeschen}>
            {t('haus.loeschen')}
          </button>
        )}
        <button type="button" className="knopf" onClick={schliessen}>
          {t('haus.abbrechen')}
        </button>
      </div>
    </div>
  );
}

/**
 * Ein Verweis im Text. Darueberfahren zeigt die Vorschau, ein Klick oeffnet
 * den Eintrag — mit oder ohne Strg: im Story Creator braucht es Strg, weil
 * man dort im Text schreibt; hier liest man nur, und Strg+Klick geht
 * trotzdem.
 */
function Verweis({
  id,
  kind,
  leise
}: {
  readonly id: string;
  readonly kind: ReactNode;
  readonly leise?: boolean;
}) {
  const { oeffne, zeige, verberge } = useContext(VerweisKontext);
  return (
    <button
      type="button"
      className={leise ? 'verweis verweis--leise' : 'verweis verweis--text'}
      data-ziel={id}
      onMouseEnter={(e) => zeige(id, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={verberge}
      onFocus={(e) => zeige(id, e.currentTarget.getBoundingClientRect())}
      onBlur={verberge}
      onClick={() => oeffne(id)}
    >
      {kind}
    </button>
  );
}

const KARTE_BREIT = 320;

/** Die Vorschau: Name, Art, der Anfang des Textes. Genug, um die Frage zu beantworten. */
function Vorschau({
  regel,
  rect,
  bleib,
  geh
}: {
  readonly regel: Regel;
  readonly rect: DOMRect;
  readonly bleib: () => void;
  readonly geh: () => void;
}) {
  const spr = sprache();
  const { oeffne } = useContext(VerweisKontext);
  const links = Math.max(8, Math.min(rect.left, window.innerWidth - KARTE_BREIT - 8));
  const oben = rect.bottom + 260 > window.innerHeight;
  const lage = oben
    ? { left: links, bottom: window.innerHeight - rect.top + 6, width: KARTE_BREIT }
    : { left: links, top: rect.bottom + 6, width: KARTE_BREIT };
  // Eine kurze Regel steht ganz da; eine lange wird nach etwa 420 Zeichen
  // an einer Satzgrenze abgeschnitten.
  const text = regel.text[spr];
  const kurz = text.length <= 480 ? text : `${text.slice(0, 420).replace(/[^.!?:]*$/, '')} …`;
  return (
    <div
      className="vorschau"
      style={lage}
      role="dialog"
      aria-label={regel.name[spr]}
      data-vorschau={regel.id}
      onMouseEnter={bleib}
      onMouseLeave={geh}
    >
      <div className="vorschau__kopf">
        <strong>{regel.name[spr]}</strong>
        <span className="vorschau__art">{ART_NAME[regel.art][spr]}</span>
      </div>
      {zweitName(regel, spr) ? <p className="vorschau__anders">{zweitName(regel, spr)}</p> : null}
      {kurz.split(/\n{2,}/).map((absatz, i) => (
        <p key={i} className="vorschau__text">
          {absatz}
        </p>
      ))}
      <button type="button" className="vorschau__oeffnen" onClick={() => oeffne(regel.id)}>
        {t('vorschau.oeffnen')}
      </button>
    </div>
  );
}

function Blatt({
  regel,
  daneben,
  onDaneben,
  amTisch,
  hausregelDazu
}: {
  readonly regel: Regel;
  readonly daneben: boolean;
  readonly onDaneben: () => void;
  /** Hausregeln, die diese Regel aendern. */
  readonly amTisch: readonly Hausregel[];
  readonly hausregelDazu: () => void;
}) {
  const spr = sprache();
  const { nach } = useContext(VerweisKontext);
  const { notizen, oeffne: oeffneNotiz } = useContext(NotizKontext);
  // Die zweite Fassung daneben gibt es nur auf Deutsch, aus demselben Grund.
  const sprachen: Sprache[] = daneben && spr === 'de' ? [spr, andere(spr)] : [spr];
  const meine = notizen.filter((n) => n.regel === regel.id);
  /** Eine Auswahl im Text, aus der eine Notiz werden kann. */
  const [auswahl, setAuswahl] = useState<{ notiz: Notiz; rect: DOMRect } | null>(null);

  /*
   * Text auswaehlen, dann erscheint der Knopf „Notiz". Verankert wird am
   * Block, am ausgewaehlten Text und am wievielten Vorkommen — nicht an
   * Zeichenpositionen (docs/nachschlagewerk.md).
   */
  const nimmAuswahl = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setAuswahl(null);
      return;
    }
    const bereich = sel.getRangeAt(0);
    const element = (knoten: Node) => (knoten instanceof Element ? knoten : knoten.parentElement);
    const start = element(bereich.startContainer)?.closest<HTMLElement>('[data-block]');
    const ende = element(bereich.endContainer)?.closest<HTMLElement>('[data-block]');
    const stelle = sel.toString().trim();
    if (!start || start !== ende || !stelle) {
      setAuswahl(null);
      return;
    }
    const index = Number(start.dataset.block);
    const s = (start.dataset.sprache === 'en' ? 'en' : 'de') as Sprache;
    const quelle = blocktext(regel.bloecke[index], s);
    if (quelle === undefined) return;
    const bisher = document.createRange();
    bisher.setStart(start, 0);
    bisher.setEnd(bereich.startContainer, bereich.startOffset);
    const offset = bisher.toString().length;
    const vorkommen = vorkommenBei(quelle, stelle, offset);
    if (nteStelle(quelle, stelle, vorkommen) < 0) return;
    setAuswahl({
      rect: bereich.getBoundingClientRect(),
      notiz: {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        regel: regel.id,
        sprache: s,
        block: index,
        stelle,
        vorkommen,
        text: '',
        geaendert: ''
      }
    });
  };

  return (
    <article key={regel.id} className="regel motion-erscheinen" data-regel={regel.id}>
      <header className="regel__kopf">
        <div>
          <span className="regel__art">{ART_NAME[regel.art][spr]}</span>
          <h2>{regel.name[spr]}</h2>
          {zweitName(regel, spr) ? <p className="regel__anders">{zweitName(regel, spr)}</p> : null}
          {regel.bild ? <img className="regel__bild" src={regel.bild} alt="" data-regel-bild /> : null}
          {regel.unterzeile ? (
            <p className="regel__unterzeile" data-unterzeile>
              {regel.unterzeile[spr]}
            </p>
          ) : null}
        </div>
        <div className="regel__knoepfe">
          {spr === 'de' ? (
            <button type="button" className="knopf" data-daneben onClick={onDaneben}>
              {daneben ? t('daneben.aus') : t('daneben')}
            </button>
          ) : null}
          <button type="button" className="knopf" data-hausregel-dazu onClick={hausregelDazu}>
            + {t('haus.dazu')}
          </button>
        </div>
      </header>

      {/*
        DIE MARKE. Wer hier nachschlaegt, liest sonst die offizielle Regel und
        vergisst, dass am eigenen Tisch etwas anderes gilt.
      */}
      {amTisch.length > 0 ? (
        <p className="regel__amtisch" data-amtisch>
          <span>{t('haus.amTisch')}</span>{' '}
          {amTisch.map((h, i) => (
            <span key={h.id}>
              {i > 0 ? ', ' : null}
              <Verweis id={`hausregel/${h.id}`} kind={h.name} leise />
            </span>
          ))}
        </p>
      ) : null}

      <div className={sprachen.length > 1 ? 'regel__fassungen regel__fassungen--zwei' : 'regel__fassungen'}>
        {sprachen.map((s) => (
          <section key={s} className="regel__fassung" lang={s} data-sprache={s} onMouseUp={nimmAuswahl}>
            {sprachen.length > 1 ? <h3>{s === 'de' ? 'Deutsch' : 'English'}</h3> : null}
            {(() => {
              // Je Sprachfassung ein eigenes Gedaechtnis: „nur das erste
              // Vorkommen" gilt ueber alle Bloecke dieses Eintrags.
              const gesehen = new Set<string>();
              return regel.bloecke.map((block, index) => (
                <Block
                  key={index}
                  index={index}
                  block={block}
                  sprache={s}
                  eigenes={glossarId(regel)}
                  gesehen={gesehen}
                  notizen={meine.filter((n) => n.sprache === s && n.block === index)}
                  fremde={meine.filter((n) => n.sprache !== s && n.block === index)}
                />
              ));
            })()}
          </section>
        ))}
      </div>

      {auswahl ? (
        <button
          type="button"
          className="notizknopf"
          data-notiz-neu
          style={{ left: auswahl.rect.left, top: auswahl.rect.bottom + 4 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            oeffneNotiz(auswahl.notiz, auswahl.rect, true);
            setAuswahl(null);
          }}
        >
          ✎ {t('notiz.neu')}
        </button>
      ) : null}

      {/*
        Alle Notizen dieses Eintrags, auch die, deren Stelle verschwunden
        ist. Eine Notiz still fallen zu lassen waere das Schlimmste — man
        merkt es erst, wenn man sie sucht.
      */}
      {meine.length > 0 ? (
        <section className="regel__notizen" data-notizen>
          <h3>{t('notiz.titelMehr')}</h3>
          {meine.map((n) => {
            const da = findetStelle(n, blocktext(regel.bloecke[n.block], n.sprache));
            return (
              <button
                key={n.id}
                type="button"
                className={da ? 'notizzeile' : 'notizzeile notizzeile--weg'}
                onClick={(e) => oeffneNotiz(n, e.currentTarget.getBoundingClientRect(), false)}
              >
                <span className="notizzeile__stelle">„{n.stelle}"</span>
                <span className="notizzeile__text">{n.text}</span>
                {da ? null : <span className="notizzeile__weg">{t('notiz.weg')}</span>}
              </button>
            );
          })}
        </section>
      ) : null}

      {regel.verweise.length > 0 ? (
        <nav className="regel__verweise" aria-label={t('verweise')}>
          <span>{t('verweise')}</span>
          {regel.verweise.map((id) => {
            const ziel = nach(id);
            return ziel ? (
              <span key={id} className="verweis-knopf" data-verweis={id}>
                <Verweis id={id} kind={ziel.name[spr]} />
              </span>
            ) : null;
          })}
        </nav>
      ) : null}

      {spr === 'de' ? <p className="regel__massgeblich">{t('massgeblich')}</p> : null}
    </article>
  );
}

/**
 * Eine Hausregel lesen. Keine zweite Sprache: uebersetzt wird nicht, was die
 * Spielleitung schreibt. `[[Name]]` wird zum Verweis — ein Verweis ins Leere
 * steht sichtbar anders da, statt still Text zu werden.
 */
function Hausblatt({
  regel,
  bearbeiten,
  loeschen
}: {
  readonly regel: Hausregel | undefined;
  readonly bearbeiten: (regel: Hausregel) => void;
  readonly loeschen: (regel: Hausregel) => void;
}) {
  const spr = sprache();
  const { nach } = useContext(VerweisKontext);
  if (!regel) return null;
  const bezug = regel.bezug ? nach(regel.bezug) : undefined;
  return (
    <article key={regel.id} className="regel regel--haus motion-erscheinen" data-regel={`hausregel/${regel.id}`}>
      <header className="regel__kopf">
        <div>
          <span className="regel__art">{ART_NAME.hausregel[spr]}</span>
          <h2>{regel.name}</h2>
        </div>
        <div className="regel__knoepfe">
          <button type="button" className="knopf" data-hausregel-bearbeiten onClick={() => bearbeiten(regel)}>
            {t('haus.bearbeiten')}
          </button>
          <button type="button" className="knopf" onClick={() => loeschen(regel)}>
            {t('haus.loeschen')}
          </button>
        </div>
      </header>
      {regel.bezug ? (
        <p className="regel__amtisch">
          {t('haus.aendert')}{' '}
          {bezug ? (
            <Verweis id={bezug.id} kind={bezug.name[spr]} leise />
          ) : (
            <span className="verweis--kaputt">{regel.bezug}</span>
          )}
        </p>
      ) : null}
      <section className="regel__fassung">
        <Hausmarkdown text={regel.text} />
      </section>
    </article>
  );
}

/**
 * Das Markdown einer Hausregel, soweit man es fuer Regeltext braucht
 * (Testbericht: der Hinweis versprach Markdown, gezeigt wurde es roh):
 * Absaetze, Zeilenumbrueche, Listen mit „-"/„*" oder „1.", Ueberschriften
 * mit „#", **fett** und *kursiv*. Die `[[Verweise]]` bleiben Verweise.
 * Kein HTML: was jemand tippt, wird nie als Markup ausgefuehrt.
 */
function Hausmarkdown({ text }: { readonly text: string }) {
  const bloecke = text.replace(/\r\n/g, '\n').split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {bloecke.map((block, i) => {
        const zeilen = block.split('\n');
        if (zeilen.every((z) => /^\s*[-*]\s+/.test(z))) {
          return (
            <ul key={i} className="regel__liste">
              {zeilen.map((z, j) => (
                <li key={j}>
                  <Hausinline text={z.replace(/^\s*[-*]\s+/, '')} />
                </li>
              ))}
            </ul>
          );
        }
        if (zeilen.every((z) => /^\s*\d+[.)]\s+/.test(z))) {
          return (
            <ol key={i} className="regel__liste">
              {zeilen.map((z, j) => (
                <li key={j}>
                  <Hausinline text={z.replace(/^\s*\d+[.)]\s+/, '')} />
                </li>
              ))}
            </ol>
          );
        }
        const kopf = /^(#{1,3})\s+(.*)$/.exec(zeilen[0]);
        if (kopf && zeilen.length === 1) {
          return kopf[1].length === 1 ? (
            <h3 key={i}>
              <Hausinline text={kopf[2]} />
            </h3>
          ) : (
            <h4 key={i}>
              <Hausinline text={kopf[2]} />
            </h4>
          );
        }
        return (
          <p key={i} className="regel__einleitung">
            {zeilen.map((z, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                <Hausinline text={z} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** **fett**, *kursiv* und _kursiv_ innerhalb einer Zeile, dazu die Verweise. */
function Hausinline({ text }: { readonly text: string }) {
  const teile = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {teile.map((teil, i) => {
        if (/^\*\*[^*]+\*\*$/.test(teil)) return <strong key={i}><Hausverweise text={teil.slice(2, -2)} /></strong>;
        if (/^\*[^*]+\*$/.test(teil) || /^_[^_]+_$/.test(teil)) return <em key={i}><Hausverweise text={teil.slice(1, -1)} /></em>;
        return teil ? <Hausverweise key={i} text={teil} /> : null;
      })}
    </>
  );
}

function Hausverweise({ text }: { readonly text: string }) {
  const { nach } = useContext(VerweisKontext);
  const alle = alleRegeln();
  return (
    <>
      {zerlege(text).map((stueck, i) => {
        if (typeof stueck === 'string') return stueck;
        const gesucht = stueck.verweis.toLowerCase();
        const ziel =
          alle.find((r) => r.name.de.toLowerCase() === gesucht || r.name.en.toLowerCase() === gesucht) ??
          nach(stueck.verweis);
        return ziel ? (
          <Verweis key={i} id={ziel.id} kind={stueck.verweis} leise />
        ) : (
          <span key={i} className="verweis--kaputt" title={t('haus.insLeere')}>
            {stueck.verweis}
          </span>
        );
      })}
    </>
  );
}

function Hausregelformular({
  regel,
  neu,
  regeln,
  fehler,
  speichern,
  abbrechen
}: {
  readonly regel: Hausregel;
  readonly neu: boolean;
  readonly regeln: readonly Regel[];
  readonly fehler: string;
  readonly speichern: (regel: Hausregel) => void;
  readonly abbrechen: () => void;
}) {
  const spr = sprache();
  const [entwurf, setEntwurf] = useState(regel);
  const offizielle = useMemo(
    () =>
      regeln
        .filter((r) => r.art !== 'hausregel')
        .sort((a, b) => a.name[spr].localeCompare(b.name[spr], spr)),
    [regeln, spr]
  );
  // Fuer „[[" im Text: alle Eintraege mit ihrer Art, die eigene Regel nicht.
  const verweisVorschlaege = useMemo(
    () =>
      regeln
        .filter((r) => r.id !== `hausregel/${regel.id}`)
        .map((r) => ({ name: r.name[spr], art: ART_NAME[r.art]?.[spr] ?? '' })),
    [regeln, spr, regel.id]
  );
  return (
    <form
      className="hausformular"
      data-hausregel-formular
      onSubmit={(e) => {
        e.preventDefault();
        speichern(entwurf);
      }}
    >
      <h2>{neu ? t('haus.neu') : t('haus.bearbeiten')}</h2>
      <label className="hausformular__feld">
        <span>{t('haus.name')}</span>
        <input
          autoFocus
          value={entwurf.name}
          data-feld="name"
          onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
        />
      </label>
      <label className="hausformular__feld">
        <span>{t('haus.bezug')}</span>
        <select
          value={entwurf.bezug}
          data-feld="bezug"
          onChange={(e) => setEntwurf({ ...entwurf, bezug: e.target.value })}
        >
          <option value="">{t('haus.keinBezug')}</option>
          {offizielle.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name[spr]}
            </option>
          ))}
        </select>
      </label>
      <label className="hausformular__feld">
        <span>{t('haus.text')}</span>
        <Verweisfeld
          rows={10}
          wert={entwurf.text}
          data-feld="text"
          placeholder={t('haus.textHinweis')}
          vorschlaege={verweisVorschlaege}
          setze={(text) => setEntwurf({ ...entwurf, text })}
        />
      </label>
      {fehler ? <p className="hausformular__fehler">{fehler}</p> : null}
      <div className="regel__knoepfe">
        <button type="submit" className="knopf knopf--haupt" data-hausregel-speichern>
          {t('haus.speichern')}
        </button>
        <button type="button" className="knopf" onClick={abbrechen}>
          {t('haus.abbrechen')}
        </button>
      </div>
    </form>
  );
}

/** Ein Text mit seinen erkannten Verweisen. */
function Verlinkt({
  text,
  sprache: s,
  eigenes,
  gesehen,
  notizen = [],
  quelle = text,
  versatz = 0
}: {
  readonly text: string;
  readonly sprache: Sprache;
  readonly eigenes: string;
  readonly gesehen: Set<string>;
  /** Notizen an diesem Block. */
  readonly notizen?: readonly Notiz[];
  /** Der ganze Blocktext und wo `text` darin anfaengt — fuer die Notizstellen. */
  readonly quelle?: string;
  readonly versatz?: number;
}) {
  const { oeffne } = useContext(NotizKontext);
  const verweise = (stueck: string, schluessel: string) =>
    verlinke(stueck, s, eigenes, gesehen).map((teil, i) => {
      if (typeof teil === 'string') return teil;
      const ziel = regelFuerGlossar(teil.ziel);
      return ziel ? <Verweis key={`${schluessel}-${i}`} id={ziel.id} kind={teil.text} leise /> : teil.text;
    });
  return (
    <>
      {markiere(text, quelle, versatz, notizen).map((stueck, i) =>
        typeof stueck === 'string' ? (
          verweise(stueck, String(i))
        ) : (
          <mark
            key={`m${i}`}
            className="notizstelle"
            data-notiz={stueck.notiz.id}
            title={stueck.notiz.text}
            onClick={(e) => oeffne(stueck.notiz, e.currentTarget.getBoundingClientRect(), false)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              oeffne(stueck.notiz, e.currentTarget.getBoundingClientRect(), false);
            }}
          >
            {stueck.text}
          </mark>
        )
      )}
    </>
  );
}

function Block({
  index,
  block,
  sprache: s,
  eigenes,
  gesehen,
  notizen,
  fremde = []
}: {
  readonly index: number;
  readonly block: Glossarblock;
  readonly sprache: Sprache;
  readonly eigenes: string;
  readonly gesehen: Set<string>;
  readonly notizen: readonly Notiz[];
  /**
   * Notizen, die in der anderen Sprachfassung an diesem Block haengen. Ihre
   * Stelle laesst sich hier nicht finden, aber der Block ist derselbe: ein
   * Zeichen am Ende, damit sie beim Sprachwechsel nicht verschwinden.
   */
  readonly fremde?: readonly Notiz[];
}) {
  const { oeffne } = useContext(NotizKontext);
  const fremdeMarken = fremde.map((n) => (
    <button
      key={n.id}
      type="button"
      className="notizmarke"
      data-fremde-notiz={n.id}
      title={`„${n.stelle}": ${n.text}`}
      onClick={(e) => oeffne(n, e.currentTarget.getBoundingClientRect(), false)}
    >
      ✎
    </button>
  ));
  if (block.typ === 'tabelle') {
    return (
      <table className="regel__tabelle">
        {block.titel[s] ? <caption>{block.titel[s]}</caption> : null}
        <thead>
          <tr>
            {block.kopf[s].map((zelle, i) => (
              <th key={i} scope="col">
                {zelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.reihen[s].map((reihe, i) =>
            // Eine Zwischenzeile („Simple Melee Weapons") hat nur die erste
            // Zelle und geht ueber die ganze Breite.
            reihe.length > 1 && reihe.slice(1).every((zelle) => !zelle) ? (
              <tr key={i} className="regel__zwischen">
                <td colSpan={reihe.length}>{reihe[0]}</td>
              </tr>
            ) : (
              <tr key={i}>
                {reihe.map((zelle, j) => (
                  <td key={j}>{zelle}</td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    );
  }
  if (block.typ === 'liste') {
    return (
      <>
        {block.titel[s] ? <p className="regel__listentitel">{block.titel[s]}</p> : null}
        <ul className="regel__liste">
          {block.eintraege[s].map((eintrag) => {
            // Nennt der Punkt einen Eintrag des Glossars, fuehrt er dorthin.
            const ziel = regelMitNamen(eintrag, s);
            return (
              <li key={eintrag}>
                {ziel ? <Verweis id={ziel.id} kind={eintrag} leise /> : eintrag}
              </li>
            );
          })}
        </ul>
      </>
    );
  }
  if (block.typ === 'absatz') {
    return (
      <p className="regel__einleitung" data-block={index} data-sprache={s}>
        <Verlinkt text={block.text[s]} sprache={s} eigenes={eigenes} gesehen={gesehen} notizen={notizen} />
        {fremdeMarken}
      </p>
    );
  }
  const teil = unterpunkt(block.text[s]);
  return (
    <p
      className={block.typ === 'stichpunkt' ? 'regel__punkt regel__punkt--tief' : 'regel__punkt'}
      data-block={index}
      data-sprache={s}
    >
      {teil.kopf ? <strong>{teil.kopf} </strong> : null}
      <Verlinkt
        text={teil.rest}
        sprache={s}
        eigenes={eigenes}
        gesehen={gesehen}
        notizen={notizen}
        quelle={block.text[s]}
        versatz={block.text[s].length - teil.rest.length}
      />
      {fremdeMarken}
    </p>
  );
}
