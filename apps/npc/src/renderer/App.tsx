/**
 * Der NPC Creator.
 *
 * Ein Knopf, eine fertige Figur. Alles andere ordnet sich dem unter: das
 * Werkzeug wird benutzt, waehrend die Gruppe wartet, und wer in dem Moment
 * erst Felder ausfuellen muss, benutzt es beim naechsten Mal nicht mehr.
 *
 * Jedes Feld laesst sich einzeln nachwuerfeln und einzeln festhalten. Ohne
 * das Festhalten wuerfelt man den guten Namen weg, waehrend man den Beruf
 * sucht.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  alsMarkdown,
  erzeugeFeld,
  erzeugeFigur,
  FELDER,
  NAMENSKLANG,
  STANDARD_WUENSCHE,
  type Feld,
  type Figur,
  type Namensklang,
  type Wuensche
} from '../shared/erzeuge';
import { ARCHETYPEN, SPEZIES, text } from '../shared/tabellen';
import { getLanguage, onLanguageChange, t, type Language, type TextKey } from './i18n';
import { api } from './api';

/** Die Felder in der Reihenfolge, in der sie gelesen werden. */
const REIHENFOLGE: readonly Feld[] = FELDER;

interface Gemerkt {
  readonly id: number;
  readonly figur: Figur;
}

const MERKLISTE = 'npc.merkliste';

/** Liest die gemerkten Figuren; Unlesbares faellt still weg. */
function ladeMerkliste(): Gemerkt[] {
  try {
    const roh = JSON.parse(localStorage.getItem(MERKLISTE) ?? '[]') as unknown;
    if (!Array.isArray(roh)) return [];
    return roh
      .filter(
        (e): e is Gemerkt =>
          typeof e === 'object' && e !== null && typeof e.id === 'number' && typeof e.figur?.name === 'string'
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function App() {
  const [figur, setFigur] = useState<Figur | null>(null);
  const [festgehalten, setFestgehalten] = useState<readonly Feld[]>([]);
  const [wuensche, setWuensche] = useState<Wuensche>(STANDARD_WUENSCHE);
  // Die Merkliste ueberlebt einen Neustart (Wunsch aus dem Testbericht).
  const [gemerkt, setGemerkt] = useState<Gemerkt[]>(ladeMerkliste);
  useEffect(() => {
    try {
      localStorage.setItem(MERKLISTE, JSON.stringify(gemerkt));
    } catch {
      // Ohne Speicher bleibt sie eben bis zum Schliessen.
    }
  }, [gemerkt]);
  const [vorhanden, setVorhanden] = useState(false);
  const [exportStand, setExportStand] = useState<'ruht' | 'laeuft' | 'fertig' | 'fehler'>('ruht');
  const [exportText, setExportText] = useState('');
  const [, setSprache] = useState<Language>(getLanguage);
  /**
   * Ob eine KI eingerichtet ist.
   *
   * Ist sie es nicht, sind die Knoepfe gar nicht da — nicht ausgegraut.
   * Eingerichtet wird sie in der Huelle, hier gibt es dafuer nichts zu
   * klicken, und ein grauer Knopf waere eine Einladung zum Suchen.
   */
  const [kiDa, setKiDa] = useState(false);
  /** Welches Feld die KI gerade beantwortet, 'alle' fuer die ganze Figur. */
  const [kiLaeuft, setKiLaeuft] = useState<Feld | 'alle' | null>(null);
  const [kiFehler, setKiFehler] = useState<string | null>(null);

  useEffect(() => onLanguageChange(() => setSprache(getLanguage())), []);

  useEffect(() => {
    const frage = () => void api.ki.da().then(setKiDa, () => setKiDa(false));
    frage();
    // Und noch einmal, wenn die Einstellung sich aendert. Ohne das saehe man
    // die Knoepfe erst nach einem Neustart, wenn man die KI einschaltet.
    return api.ki.beiWechsel(frage);
  }, []);

  const wuerfle = useCallback(() => {
    setFigur((vorher) => erzeugeFigur(wuensche, getLanguage(), Math.random, festgehalten, vorher));
    setExportStand('ruht');
  }, [wuensche, festgehalten]);

  const nachwuerfeln = useCallback(
    (feld: Feld) => {
      setFigur((vorher) =>
        vorher
          ? // `true`: gezielt nachgewuerfelt. Bei der Eigenheit kommt dann
            // immer etwas, waehrend sie beim Erzeugen einer ganzen Figur
            // meistens ausfaellt.
            { ...vorher, [feld]: erzeugeFeld(feld, wuensche, getLanguage(), Math.random, true) }
          : vorher
      );
      setExportStand('ruht');
    },
    [wuensche]
  );

  /**
   * Ein Feld von Hand aendern.
   *
   * Wer etwas schreibt, will es behalten — deshalb wird das Feld dabei von
   * selbst festgehalten. Ohne das waere die eigene Zeile beim naechsten Klick
   * auf „Neue Figur" weg, und das merkt man erst, wenn es zu spaet ist. Dass
   * es passiert, sieht man am Schloss, das zugeht.
   */
  const aendere = useCallback((feld: Feld, wert: string) => {
    setFigur((vorher) => (vorher ? { ...vorher, [feld]: wert } : vorher));
    setFestgehalten((vorher) => (vorher.includes(feld) ? vorher : [...vorher, feld]));
    setExportStand('ruht');
  }, []);

  const schalteFest = useCallback((feld: Feld) => {
    setFestgehalten((vorher) =>
      vorher.includes(feld) ? vorher.filter((eintrag) => eintrag !== feld) : [...vorher, feld]
    );
  }, []);

  /**
   * Ein Feld von der KI vorschlagen lassen.
   *
   * Das Ergebnis landet im selben Eingabefeld wie ein getippter Text und
   * wird genauso festgehalten: es ist jetzt der Wert, den man behalten will,
   * und der naechste Wurf soll ihn nicht wegraeumen.
   *
   * Schlaegt es fehl, bleibt die Figur unangetastet. Ein halb ersetztes Feld
   * waere schlimmer als keins.
   */
  const kiFeld = useCallback(
    async (feld: Feld) => {
      if (!figur) return;
      setKiLaeuft(feld);
      setKiFehler(null);
      const ergebnis = await api.ki.feld(feld, figur, wuensche, getLanguage());
      setKiLaeuft(null);
      if (!ergebnis.ok || ergebnis.wert === null) {
        setKiFehler(t(ergebnis.grund as TextKey));
        return;
      }
      aendere(feld, ergebnis.wert);
    },
    [figur, wuensche, aendere]
  );

  /**
   * Eine ganze Figur von der KI.
   *
   * Festgehaltene Felder bleiben stehen, genau wie beim Wuerfeln — sonst
   * waere das Schloss hier wirkungslos, und das faellt erst auf, wenn der
   * gute Name weg ist.
   */
  const kiFigur = useCallback(async () => {
    setKiLaeuft('alle');
    setKiFehler(null);
    const ergebnis = await api.ki.figur(figur, [...festgehalten], wuensche, getLanguage());
    setKiLaeuft(null);
    if (!ergebnis.ok || ergebnis.wert === null) {
      setKiFehler(t(ergebnis.grund as TextKey));
      return;
    }
    const neu = ergebnis.wert;
    setFigur((vorher) => {
      // Als Grundlage die vorhandene Figur, damit festgehaltene Felder und
      // solche, zu denen die KI nichts geliefert hat, stehen bleiben. Gibt es
      // noch keine, wird erst eine gewuerfelt: dann fuellt die KI nur die
      // Luecken, und leer bleibt nichts.
      const grundlage =
        vorher ?? erzeugeFigur(wuensche, getLanguage(), Math.random, festgehalten, null);
      const zusammen = { ...grundlage };
      for (const feld of FELDER) {
        if (festgehalten.includes(feld)) continue;
        const wert = neu[feld];
        if (wert !== undefined) zusammen[feld] = wert;
      }
      return zusammen;
    });
    setExportStand('ruht');
  }, [figur, festgehalten, wuensche]);

  /*
   * Wohin die Figur geht: die Kampagnen des Story Creators, vorbelegt mit der
   * zuletzt offenen. Beim Zurueckkommen ins Fenster neu gefragt, damit eine
   * eben angelegte Kampagne dabei ist.
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

  const exportiere = useCallback(
    async (ersetzen = false) => {
      if (!figur) return;
      setExportStand('laeuft');
      // Exportiert wird in der Sprache, in der man gerade arbeitet: die Notiz
      // landet zwischen anderen Notizen derselben Kampagne. Die Spezies geht
      // zusaetzlich in das Steckbrieffeld, wenn der Notiztyp eins hat.
      const ergebnis = await api.export(figur.name, alsMarkdown(figur, getLanguage()), ziel, {
        ersetzen,
        felder: figur.spezies ? { species: figur.spezies } : {}
      });
      setExportStand(ergebnis.ok ? 'fertig' : 'fehler');
      setExportText(ergebnis.text);
      setVorhanden(!ergebnis.ok && ergebnis.vorhanden === true);
    },
    [figur, ziel]
  );

  // Gewuerfelt wird in der Sprache, in der gearbeitet wird. Eine bereits
  // gewuerfelte Figur wechselt NICHT mit: sie koennte von Hand bearbeitet
  // sein, und eine Uebersetzung wuerde diese Arbeit ueberschreiben.
  const sprache = getLanguage();

  return (
    <div className="npcapp">
      <aside className="vorgaben">
        <span className="vorgaben__titel">{t('wunsch.titel')}</span>

        <label className="feld">
          <span className="feld__label">{t('wunsch.archetyp')}</span>
          <select
            value={wuensche.archetyp}
            onChange={(e) => setWuensche((v) => ({ ...v, archetyp: e.target.value }))}
          >
            {ARCHETYPEN.map((archetyp) => (
              <option key={archetyp.id} value={archetyp.id}>
                {t(`archetyp.${archetyp.id}` as TextKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="feld">
          <span className="feld__label">{t('wunsch.klang')}</span>
          <select
            value={wuensche.klang ?? ''}
            onChange={(e) =>
              setWuensche((v) => ({ ...v, klang: (e.target.value || null) as Namensklang | null }))
            }
          >
            <option value="">{t('wunsch.gemischt')}</option>
            {NAMENSKLANG.map((klang) => (
              <option key={klang} value={klang}>
                {t(`klang.${klang}` as TextKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="feld">
          <span className="feld__label">{t('wunsch.spezies')}</span>
          <select
            value={wuensche.spezies >= 0 ? String(wuensche.spezies) : ''}
            onChange={(e) =>
              setWuensche((v) => ({ ...v, spezies: e.target.value === '' ? -1 : Number(e.target.value) }))
            }
          >
            <option value="">{t('wunsch.beliebig')}</option>
            {SPEZIES.map((art, nummer) => (
              <option key={art.de} value={nummer}>
                {text(art, sprache)}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="knopf--haupt" onClick={wuerfle}>
          {t('knopf.wuerfeln')}
        </button>

        {kiDa ? (
          <>
            <button
              type="button"
              className="knopf--ki"
              onClick={() => void kiFigur()}
              disabled={kiLaeuft !== null}
            >
              {kiLaeuft === 'alle' ? t('ki.figurLaeuft') : t('ki.figur')}
            </button>
            <p className="vorgaben__hinweis">{t('ki.hinweis')}</p>
          </>
        ) : null}
      </aside>

      <main className="buehne">
        {figur ? (
          <>
            <h1 className="figur__name">{figur.name}</h1>
            <p className="figur__zeile">
              {figur.spezies} · {figur.beruf}
            </p>

            <div className="figur">
              {REIHENFOLGE.map((feld) => (
                <Zeile
                  key={feld}
                  feld={feld}
                  wert={figur[feld]}
                  fest={festgehalten.includes(feld)}
                  onAendern={(wert) => aendere(feld, wert)}
                  onNachwuerfeln={() => nachwuerfeln(feld)}
                  onFest={() => schalteFest(feld)}
                  onKi={kiDa ? () => void kiFeld(feld) : undefined}
                  kiLaeuft={kiLaeuft === feld}
                  kiGesperrt={kiLaeuft !== null}
                />
              ))}
            </div>

            <div className="buehne__knoepfe">
              {/* Der Export laeuft auf Knopfdruck und nicht von selbst: eine
                  Figur, die man verwirft, soll nicht schon im Archiv liegen. */}
              {kampagnen.length > 0 ? (
                <label className="ziel" title={t('ziel.hinweis')}>
                  {t('ziel.kampagne')}
                  <select data-ziel value={ziel ?? ''} onChange={(e) => setZiel(e.target.value)}>
                    {kampagnen.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className="knopf--haupt"
                onClick={() => void exportiere()}
                disabled={exportStand === 'laeuft'}
              >
                {exportStand === 'laeuft'
                  ? t('knopf.exportLaeuft')
                  : exportStand === 'fertig'
                    ? t('knopf.exportFertig')
                    : t('knopf.export')}
              </button>
              <button
                type="button"
                onClick={() =>
                  setGemerkt((vorher) =>
                    [{ id: (vorher[0]?.id ?? 0) + 1, figur }, ...vorher].slice(0, 20)
                  )
                }
              >
                {t('ablage.merken')}
              </button>
            </div>

            {exportStand === 'fehler' ? (
              <p className="stoerung">
                {exportText}
                {vorhanden ? (
                  <>
                    {' '}
                    <button type="button" data-aktualisieren onClick={() => void exportiere(true)}>
                      {t('knopf.aktualisieren')}
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
            {kiFehler ? <p className="stoerung">{kiFehler}</p> : null}
          </>
        ) : (
          <p className="buehne__leer">{t('leer')}</p>
        )}
      </main>

      <section className="merkliste">
        <header className="merkliste__kopf">
          <span className="merkliste__titel">{t('ablage.titel')}</span>
          <span className="merkliste__hinweis">{t('ablage.leer')}</span>
          {gemerkt.length > 0 ? (
            <button type="button" className="merkliste__leeren" onClick={() => setGemerkt([])}>
              {t('ablage.leeren')}
            </button>
          ) : null}
        </header>
        <ol className="merkliste__liste" data-pfeile="liste">
          {gemerkt.map((eintrag) => (
            <li data-pfeil key={eintrag.id}>
              <button
                type="button"
                onClick={() => {
                  setFigur(eintrag.figur);
                  setExportStand('ruht');
                }}
                title={t('ablage.holen')}
              >
                <span className="merkliste__name">{eintrag.figur.name}</span>
                <span className="merkliste__rolle">
                  {eintrag.figur.spezies} · {eintrag.figur.beruf}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * Eine Zeile: Beschriftung, bearbeitbarer Wert, die beiden Knoepfe.
 *
 * Der Wert steht in einem Textfeld und nicht als Text. Ein Generator, dessen
 * Ergebnis man nur annehmen oder verwerfen kann, zwingt zum Weiterwuerfeln,
 * bis zufaellig alles passt — dabei fehlt meist nur ein Wort.
 */
function Zeile({
  feld,
  wert,
  fest,
  onAendern,
  onNachwuerfeln,
  onFest,
  onKi,
  kiLaeuft,
  kiGesperrt
}: {
  feld: Feld;
  wert: string;
  fest: boolean;
  onAendern: (wert: string) => void;
  onNachwuerfeln: () => void;
  onFest: () => void;
  /** Fehlt, wenn keine KI eingerichtet ist — dann ist der Knopf gar nicht da. */
  onKi?: () => void;
  kiLaeuft: boolean;
  /** Waehrend irgendeine KI-Anfrage laeuft, ist keine zweite moeglich. */
  kiGesperrt: boolean;
}) {
  // Ein leeres Feld ist bei der Eigenheit der Normalfall und keine Luecke —
  // deshalb steht dort ein Platzhalter und nicht nichts.
  const leer = wert === '';
  return (
    <div className={`zeile ${fest ? 'zeile--fest' : ''} ${leer ? 'zeile--leer' : ''}`}>
      <label className="zeile__label" htmlFor={`feld-${feld}`}>
        {t(`feld.${feld}` as TextKey)}
      </label>
      <input
        id={`feld-${feld}`}
        className="zeile__wert"
        value={wert}
        placeholder={feld === 'eigenheit' ? t('feld.eigenheitLeer') : ''}
        onChange={(ereignis) => onAendern(ereignis.target.value)}
        spellCheck={false}
      />
      <span className="zeile__knoepfe">
        {/* Festgehalten heisst festgehalten: auch das einzelne Nachwuerfeln laesst das Feld in Ruhe (Testbericht). */}
        <button
          type="button"
          onClick={onNachwuerfeln}
          disabled={fest}
          title={fest ? t('knopf.nachwuerfelnGesperrt') : t('knopf.nachwuerfeln')}
        >
          ↻
        </button>
        {onKi ? (
          <button
            type="button"
            className="zeile__ki"
            onClick={onKi}
            disabled={kiGesperrt}
            title={t('ki.feld')}
            aria-label={t('ki.feld')}
          >
            {kiLaeuft ? '…' : '✦'}
          </button>
        ) : null}
        <button
          type="button"
          className="zeile__schloss"
          onClick={onFest}
          title={fest ? t('knopf.losgeben') : t('knopf.festhalten')}
          aria-pressed={fest}
        >
          {fest ? '🔒' : '🔓'}
        </button>
      </span>
    </div>
  );
}
