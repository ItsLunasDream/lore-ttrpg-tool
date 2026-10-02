/**
 * Der Homebrew Creator (docs/homebrew-creator.md).
 *
 * Zwei Ansichten wie in den anderen Werkzeugen: die Sammlung als Kacheln mit
 * Suche und Art-Filter, und ein Eintrag zum Bearbeiten. Neben den Feldern
 * steht die Eichung am SRD; sie warnt, sie verbietet nichts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ausblendenUnd } from '@suite/motion/dom';
import { useAktuell } from '@suite/motion/react';
import { einzeln } from '@suite/tastatur';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { SELTENHEIT_NAME } from '@suite/srd';
import { MEISTERSCHAFTEN, RUESTUNGSARTEN, WAFFEN_EIGENSCHAFTEN, type Meisterschaft, type RuestungsArt } from '@suite/srd/waffen';
import { api } from './api';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';
import {
  ARTEN,
  FLAECHEN,
  RETTUNGSWUERFE,
  SCHADENSARTEN,
  HOECHSTENS_WUERFEL,
  HOECHSTENS_ZUSATZ,
  ZAUBERKLASSEN,
  ZAUBERSCHULEN,
  ZAUBERWIRKUNGEN,
  leererEintrag,
  type Art,
  type Eintrag,
  type Magisch,
  type Ruestung,
  type Schadensart,
  type Waffe,
  type Zauber,
  type Zauberwirkung,
  type Zusatzschaden
} from '../shared/modell';
import type { Kachel } from '../shared/ablage';
import {
  ART_NAME,
  ART_ZEICHEN,
  EIGENSCHAFT_NAME,
  EIGENSCHAFT_TEXT,
  KLASSE_NAME,
  MEISTERSCHAFT_NAME,
  MEISTERSCHAFT_TEXT,
  RUESTUNGSART_NAME,
  SCHADENSART_NAME,
  SCHULE_NAME,
  SCHULE_TEXT
} from '../shared/texte';
import { ZUSTAENDE as SRD_ZUSTAENDE } from '@suite/srd/zustaende';
import { MagieFelder } from '@suite/magie/formular';
import { ZahlFeld } from '@suite/zahlfeld/feld';
import { eicheRuestung, eicheWaffe, type Eichung } from '../shared/eichung';
import { eicheZauber } from '../shared/zauberEichung';
import { eicheMagisch } from '../shared/magischEichung';
import { alsFoundryDatei, kannFoundry } from '../shared/foundry';

type Sprache = 'de' | 'en';

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

/** Arten, die schon einen Reiter haben. Die uebrigen folgen (docs/homebrew-creator.md, Schritte). */
export const BEREIT: readonly Art[] = ['waffe', 'ruestung', 'gegenstand', 'magisch', 'zauber'];

export function App() {
  // Strg+S und Klick kurz hintereinander: nur einmal speichern (sonst doppelte neue Einträge).
  const speichertGerade = useRef(false);
  const [, neuZeichnen] = useState(0);
  const [kacheln, setKacheln] = useState<readonly Kachel[]>([]);
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Art | ''>('');
  const [offen, setOffen] = useState<Eintrag | null>(null);
  const [istNeu, setIstNeu] = useState(false);
  const [stand, setStand] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');

  const setzeGrund = (e: Eintrag | null) => {
    setOffen(e);
    setStand(e ? JSON.stringify(e) : null);
  };
  const veraendert = offen !== null && stand !== null && JSON.stringify(offen) !== stand;
  const darfVerwerfen = () => !veraendert || confirm(t('verwerfen.sicher'));

  const ladeListe = useCallback(async () => setKacheln(await api.sammlung.liste()), []);
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

  const oeffne = async (id: string) => {
    const e = await api.sammlung.lesen(id);
    if (!e) {
      setFehler(t('fehler.lesen'));
      return;
    }
    setzeGrund(e);
    setIstNeu(false);
    setMeldung('');
    setFehler('');
  };

  // Der Verlauf der Huelle kennt den Ort im Werkzeug (null = Liste).
  const ort = offen ? offen.id || 'entwurf' : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) {
          setzeGrund(null);
          setIstNeu(false);
          return;
        }
        if (ziel !== 'entwurf') void oeffne(ziel);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(
    () => api.beiSuchtreffer((kennung) => void oeffne(kennung)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const spr = sprache();
  const gefunden = useMemo(() => {
    const worte = suche.toLowerCase().split(/\s+/).filter(Boolean);
    return [...kacheln]
      .filter((k) => !filter || k.art === filter)
      .filter((k) => {
        const heu = `${k.name} ${ART_NAME[k.art].de} ${ART_NAME[k.art].en} ${k.kurz.de} ${k.kurz.en}`.toLowerCase();
        return worte.every((w) => heu.includes(w));
      })
      .sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  }, [kacheln, suche, filter]);

  const neu = (art: Art) => {
    if (!darfVerwerfen()) return;
    setzeGrund(leererEintrag(art, sprache()));
    setIstNeu(true);
    setMeldung('');
    setFehler('');
  };

  const speichere = async (): Promise<Eintrag | null> => {
    if (!offen) return null;
    setFehler('');
    if (!offen.name.trim()) {
      setFehler(t('fehler.name'));
      return null;
    }
    const ergebnis = await api.sammlung.speichern({ ...offen, name: offen.name.trim() }, istNeu);
    if (!ergebnis.ok) {
      setFehler(t('fehler.speichern', { detail: ergebnis.text }));
      return null;
    }
    const gespeichert = (await api.sammlung.lesen(ergebnis.id)) ?? { ...offen, id: ergebnis.id };
    setzeGrund(gespeichert);
    setIstNeu(false);
    setMeldung(t('gespeichert'));
    await ladeListe();
    return gespeichert;
  };

  const neuLeiste = (
    <div className="leiste leiste--neu" data-pfeile="zeile">
      <span className="leiste__titel">{t('neu')}:</span>
      {BEREIT.map((a) => (
        <button key={a} type="button" className="knopf" data-neu={a} data-pfeil onClick={() => neu(a)}>
          <span aria-hidden="true">{ART_ZEICHEN[a]}</span> {ART_NAME[a][spr]}
        </button>
      ))}
    </div>
  );

  // --- Ein Eintrag -----------------------------------------------------------
  if (offen) {
    // Vom aktuellen Stand aus: ein verzögertes Löschen (Ausblenden) darf eine Eingabe dazwischen nicht überschreiben.
    const setze = (teil: Partial<Eintrag>) => {
      setOffen((alt) => (alt ? ({ ...alt, ...teil } as Eintrag) : alt));
      setMeldung('');
    };
    return (
      <div className="rahmen">
        <Kopf />
        <div className="leiste">
          <button
            type="button"
            className="knopf"
            data-zurueck
            onClick={() => {
              if (!darfVerwerfen()) return;
              setzeGrund(null);
              setIstNeu(false);
            }}
          >
            ← {t('zurueck')}
          </button>
          <span className="leiste__art">
            {ART_ZEICHEN[offen.art]} {ART_NAME[offen.art][spr]}
          </span>
          <span className="leiste__luecke" />
          <button
            type="button"
            className="knopf"
            data-loot
            onClick={() =>
              void (async () => {
                const g = await speichere();
                if (!g) return;
                const drin = !offen.imLoot;
                if (await (drin ? api.sammlung.inDenLoot(g.id) : api.sammlung.ausDemLoot(g.id))) {
                  setzeGrund({ ...g, imLoot: drin });
                  setMeldung(t(drin ? 'loot.fertig' : 'loot.heraus'));
                } else setFehler(t('loot.fehler'));
              })()
            }
          >
            {offen.imLoot ? t('loot.drin') : t('loot')}
          </button>
          {kannFoundry(offen) ? (
            <button
              type="button"
              className="knopf"
              data-foundry
              onClick={() =>
                void (async () => {
                  if (!offen.name.trim()) {
                    setFehler(t('fehler.name'));
                    return;
                  }
                  const datei = alsFoundryDatei(offen);
                  if (!datei) return;
                  const ergebnis = await api.foundry(datei.name, datei.inhalt);
                  if (ergebnis.ok) setMeldung(t('foundry.fertig', { pfad: ergebnis.text }));
                  else if (ergebnis.text) setFehler(ergebnis.text);
                })()
              }
            >
              {t('foundry')}
            </button>
          ) : null}
          <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speichere)}>
            {t('speichern')}
          </button>
        </div>

        <div className="bearbeiten">
          <section className="karte">
            <div className="kopfteil">
              <BildWahl bild={offen.bild} setze={(bild) => setze({ bild })} />
              <div className="kopfteil__felder">
                <label className="feld">
                  <span className="feld__name">{t('feld.name')}</span>
                  <input className="feld__eingabe" value={offen.name} data-feld="name" onChange={(e) => setze({ name: e.target.value })} />
                </label>
                {offen.art === 'zauber' ? null : (
                  <div className="zeile">
                    <Zahlfeld label={t('feld.preis')} wert={offen.preis} feld="preis" aendern={(preis) => setze({ preis })} />
                    <Zahlfeld label={t('feld.gewicht')} wert={offen.gewicht} feld="gewicht" aendern={(gewicht) => setze({ gewicht })} />
                    {offen.art === 'waffe' || offen.art === 'ruestung' || offen.art === 'gegenstand' ? (
                      <label className="feld feld--haken" title={t('feld.magischHinweis')}>
                        <input type="checkbox" checked={Boolean(offen.magisch)} data-feld="magisch" onChange={(e) => setze({ magisch: e.target.checked })} /> {t('feld.magisch')}
                      </label>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {offen.art === 'waffe' ? <WaffenFelder w={offen} setze={setze} /> : null}
            {offen.art === 'ruestung' ? <RuestungsFelder r={offen} setze={setze} /> : null}
            {offen.art === 'zauber' ? <ZauberFelder z={offen} setze={setze} /> : null}
            {offen.art === 'magisch' ? <MagischFelder m={offen} setze={setze} /> : null}

            <label className="feld feld--hoch">
              <span className="feld__name">{t('feld.beschreibung')}</span>
              <textarea
                className="feld__flaeche"
                rows={5}
                value={offen.beschreibung}
                data-feld="beschreibung"
                onChange={(e) => setze({ beschreibung: e.target.value })}
              />
            </label>
            {meldung ? <p key={meldung} className="meldung motion-meldung-ok" data-meldung>{meldung}</p> : null}
            {fehler ? <p className="fehler">{fehler}</p> : null}
          </section>

          <EichungsTafel e={offen} />
        </div>
      </div>
    );
  }

  // --- Die Sammlung ------------------------------------------------------------
  return (
    <div className="rahmen">
      <Kopf />
      {neuLeiste}
      <div className="leiste">
        <input
          className="feld__eingabe leiste__suche"
          type="search"
          value={suche}
          placeholder={t('liste.suche')}
          aria-label={t('liste.suche')}
          onChange={(e) => setSuche(e.target.value)}
        />
        <div className="chips" role="group" aria-label={t('filter.alle')}>
          {(['', ...ARTEN] as const).map((a) => (
            <button
              key={a || 'alle'}
              type="button"
              className={filter === a ? 'chip chip--an' : 'chip'}
              aria-pressed={filter === a}
              data-filter={a || 'alle'}
              onClick={() => setFilter(a)}
            >
              {a ? `${ART_ZEICHEN[a]} ${ART_NAME[a][spr]}` : t('filter.alle')}
            </button>
          ))}
        </div>
      </div>
      <p className="anzahl">{gefunden.length === 1 ? t('liste.eine') : t('liste.anzahl', { anzahl: gefunden.length })}</p>
      {kacheln.length === 0 ? (
        <p className="hinweis">{t('liste.leer')}</p>
      ) : gefunden.length === 0 ? (
        <p className="hinweis">{t('liste.nichts')}</p>
      ) : (
        <ul className="kacheln" data-pfeile="raster">
          {gefunden.map((k) => (
            <li data-pfeil key={k.id}>
              <button type="button" className="hbkachel" data-id={k.id} onClick={() => void (darfVerwerfen() && oeffne(k.id))}>
                {k.bild ? <img className="hbkachel__bild" src={k.bild} alt="" /> : <span className="hbkachel__zeichen" aria-hidden="true">{ART_ZEICHEN[k.art]}</span>}
                <span className="hbkachel__text">
                  <span className="hbkachel__name">{k.name}</span>
                  <span className="hbkachel__kurz">{k.kurz[spr]}</span>
                </span>
              </button>
              <button
                type="button"
                className="hbkachel__weg"
                aria-label={t('loeschen')}
                title={t('loeschen')}
                onClick={() => {
                  if (!confirm(t('loeschen.sicher', { name: k.name }))) return;
                  void api.sammlung.loeschen(k.id).then(ladeListe);
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

function Zahlfeld({ label, wert, feld, aendern }: { label: string; wert: number | null; feld: string; aendern: (n: number | null) => void }) {
  return (
    <label className="feld">
      <span className="feld__name">{label}</span>
      <input
        className="feld__eingabe feld__eingabe--kurz"
        type="number"
        min={0}
        step="any"
        value={wert ?? ''}
        data-feld={feld}
        onChange={(e) => aendern(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
      />
    </label>
  );
}

function Wahl<T extends string>({ label, wert, optionen, feld, aendern }: { label: string; wert: T; optionen: readonly { wert: T; text: string }[]; feld: string; aendern: (w: T) => void }) {
  return (
    <label className="feld">
      <span className="feld__name">{label}</span>
      <select className="feld__wahl" value={wert} data-feld={feld} onChange={(e) => aendern(e.target.value as T)}>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

const WUERFEL = ['1', '1d4', '1d6', '1d8', '1d10', '1d12', '2d4', '2d6', '2d8', '2d10', '2d12', '3d6', '3d8'];
const SEITEN = [4, 6, 8, 10, 12, 20] as const;

function wuerfelName(w: string, s: Sprache): string {
  return s === 'de' ? w.replace('d', 'W') : w;
}

/** „2d6" → 2 und 6; „3" → 3 und 0 (fester Wert ohne Würfel). */
function zerlege(w: string): { anzahl: number; seiten: number } {
  const m = /^(\d+)d(\d+)$/.exec(w);
  if (m) return { anzahl: Number(m[1]), seiten: Number(m[2]) };
  return { anzahl: Number(w) || 0, seiten: 0 };
}

function setzeZusammen(anzahl: number, seiten: number): string {
  return seiten ? `${Math.max(1, anzahl)}d${seiten}` : String(Math.max(0, anzahl));
}

/** Ein aufklappbarer Abschnitt; startet offen, der Zustand bleibt beim Tippen erhalten. */
function Abschnitt({ titel, kennung, children }: { titel: string; kennung: string; children: React.ReactNode }) {
  return (
    <details className="abschnitt" open data-abschnitt={kennung}>
      <summary className="abschnitt__kopf">{titel}</summary>
      <div className="abschnitt__inhalt">{children}</div>
    </details>
  );
}

/** Anzahl, Würfel und Plus getrennt (Rückmeldung: wie beim Zauber). */
function SchadenWahl({ wuerfel, plus, feld, aendern }: { wuerfel: string; plus: number; feld: string; aendern: (wuerfel: string, plus: number) => void }) {
  const s = sprache();
  const { anzahl, seiten } = zerlege(wuerfel);
  return (
    <span className="paar" data-schaden={feld}>
      <ZahlFeld
        className="feld__eingabe feld__eingabe--kurz"
        min={seiten ? 1 : 0}
        max={HOECHSTENS_WUERFEL}
        wert={anzahl}
        aria-label={t('feld.anzahl')}
        data-feld={`${feld}Anzahl`}
        aendern={(n) => aendern(setzeZusammen(n, seiten), plus)}
      />
      <select className="feld__wahl" value={seiten} aria-label={t('feld.wuerfelArt')} data-feld={`${feld}Seiten`} onChange={(e) => aendern(setzeZusammen(anzahl, Number(e.target.value)), plus)}>
        {SEITEN.map((w) => (
          <option key={w} value={w}>
            {s === 'de' ? 'W' : 'd'}
            {w}
          </option>
        ))}
        <option value={0}>{t('wuerfel.fest')}</option>
      </select>
      +
      <ZahlFeld
        className="feld__eingabe feld__eingabe--kurz"
        min={0}
        max={50}
        wert={plus}
        aria-label={t('feld.plus')}
        data-feld={`${feld}Plus`}
        aendern={(n) => aendern(wuerfel, n)}
      />
    </span>
  );
}

function WaffenFelder({ w, setze }: { w: Waffe; setze: (teil: Partial<Waffe>) => void }) {
  const aktuell = useAktuell(w);
  const s = sprache();
  const e = new Set(w.eigenschaften);
  const schalte = (x: (typeof WAFFEN_EIGENSCHAFTEN)[number]) => {
    const neu = new Set(e);
    if (neu.has(x)) neu.delete(x);
    else neu.add(x);
    // „Weitreichend" bringt 10 Fuß Reichweite mit, ohne es wieder 5.
    const reichweiteNah = x === 'reichweite' ? (neu.has(x) ? Math.max(10, w.reichweiteNah) : 5) : w.reichweiteNah;
    setze({ eigenschaften: WAFFEN_EIGENSCHAFTEN.filter((y) => neu.has(y)), reichweiteNah });
  };
  const setzeZusatz = (i: number, teil: Partial<Zusatzschaden>) => setze({ zusatz: w.zusatz.map((z, j) => (j === i ? { ...z, ...teil } : z)) });
  return (
    <div className="artfelder" data-waffe>
      <Abschnitt titel={t('abschnitt.grund')} kennung="grund">
        <div className="zeile">
          <Wahl
            label={t('feld.kategorie')}
            wert={w.kategorie}
            feld="kategorie"
            optionen={[
              { wert: 'einfach', text: t('kategorie.einfach') },
              { wert: 'kriegs', text: t('kategorie.kriegs') }
            ]}
            aendern={(kategorie) => setze({ kategorie })}
          />
          <Wahl
            label={t('feld.bonus')}
            wert={String(w.bonus)}
            feld="bonus"
            optionen={['0', '1', '2', '3'].map((x) => ({ wert: x, text: x === '0' ? t('bonus.kein') : `+${x}` }))}
            aendern={(x) => setze({ bonus: Number(x) })}
          />
        </div>
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.schaden')} kennung="schaden">
        <div className="zeile">
          <label className="feld">
            <span className="feld__name">{t('feld.wuerfel')}</span>
            <SchadenWahl wuerfel={w.wuerfel} plus={w.schadenPlus} feld="schaden" aendern={(wuerfel, schadenPlus) => setze({ wuerfel, schadenPlus })} />
          </label>
          <Wahl
            label={t('feld.schadensart')}
            wert={w.schadensart}
            feld="schadensart"
            optionen={SCHADENSARTEN.map((x) => ({ wert: x, text: SCHADENSART_NAME[x][s] }))}
            aendern={(schadensart: Schadensart) => setze({ schadensart })}
          />
        </div>
        {w.zusatz.map((z, i) => (
          <div className="zeile" key={i} data-zusatz={i} data-ausblenden>
            <label className="feld">
              <span className="feld__name">+ {t('feld.wuerfel')}</span>
              <SchadenWahl wuerfel={z.wuerfel} plus={z.plus} feld={`zusatz${i}`} aendern={(wuerfel, plus) => setzeZusatz(i, { wuerfel, plus })} />
            </label>
            <Wahl
              label={t('feld.schadensart')}
              wert={z.art}
              feld={`zusatz${i}Art`}
              optionen={SCHADENSARTEN.map((x) => ({ wert: x, text: SCHADENSART_NAME[x][s] }))}
              aendern={(art: Schadensart) => setzeZusatz(i, { art })}
            />
            <button type="button" className="knopf zusatz__weg" aria-label={t('schaden.weg')} title={t('schaden.weg')} onClick={(e) => ausblendenUnd(e.currentTarget, () => setze({ zusatz: aktuell.current.zusatz.filter((_, j) => j !== i) }))}>
              ✕
            </button>
          </div>
        ))}
        {w.zusatz.length < HOECHSTENS_ZUSATZ ? (
          <button type="button" className="knopf zusatz__dazu" data-zusatz-dazu onClick={() => setze({ zusatz: [...w.zusatz, { wuerfel: '1d6', plus: 0, art: 'feuer' }] })}>
            {t('schaden.dazu')}
          </button>
        ) : null}
        {e.has('vielseitig') ? (
          <div className="zeile">
            <Wahl
              label={t('feld.vielseitig')}
              wert={WUERFEL.includes(w.vielseitig) ? w.vielseitig : '1d10'}
              feld="vielseitig"
              optionen={WUERFEL.map((x) => ({ wert: x, text: wuerfelName(x, s) }))}
              aendern={(vielseitig) => setze({ vielseitig })}
            />
          </div>
        ) : null}
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.eigenschaften')} kennung="eigenschaften">
        <fieldset className="chips" data-eigenschaften>
          <legend className="feld__name">{t('feld.eigenschaften')}</legend>
          {WAFFEN_EIGENSCHAFTEN.map((x) => (
            <button
              key={x}
              type="button"
              className={e.has(x) ? 'chip chip--an' : 'chip'}
              aria-pressed={e.has(x)}
              data-eigenschaft={x}
              title={EIGENSCHAFT_TEXT[x][s]}
              onClick={() => schalte(x)}
            >
              {EIGENSCHAFT_NAME[x][s]}
            </button>
          ))}
        </fieldset>
        {w.eigenschaften.length ? (
          <ul className="erklaerung" data-eigenschaft-texte>
            {w.eigenschaften.map((x) => (
              <li key={x}>
                <strong>{EIGENSCHAFT_NAME[x][s]}:</strong> {EIGENSCHAFT_TEXT[x][s]}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="zeile">
          <Wahl
            label={t('feld.meisterschaft')}
            wert={w.meisterschaft}
            feld="meisterschaft"
            optionen={[{ wert: '' as const, text: t('meisterschaft.keine') }, ...MEISTERSCHAFTEN.map((x) => ({ wert: x, text: MEISTERSCHAFT_NAME[x][s] }))]}
            aendern={(meisterschaft: Meisterschaft | '') => setze({ meisterschaft })}
          />
        </div>
        {w.meisterschaft ? (
          <p className="erklaerung" data-meisterschaft-text>
            {MEISTERSCHAFT_TEXT[w.meisterschaft][s]}
          </p>
        ) : null}
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.reichweite')} kennung="reichweite">
        <div className="zeile">
          <Wahl
            label={t('feld.nahFern')}
            wert={w.fern ? 'fern' : 'nah'}
            feld="fernReichweite"
            optionen={[
              { wert: 'nah', text: t('nah') },
              { wert: 'fern', text: t('fern') }
            ]}
            aendern={(x) => setze({ fern: x === 'fern' })}
          />
          {!w.fern ? (
            <label className="feld">
              <span className="feld__name">{t('feld.reichweiteNah')}</span>
              <ZahlFeld
                className="feld__eingabe feld__eingabe--kurz"
                min={5}
                max={100}
                step={5}
                wert={w.reichweiteNah}
                data-feld="reichweiteNah"
                aendern={(reichweiteNah) => setze({ reichweiteNah })}
              />
            </label>
          ) : null}
          {w.fern || e.has('wurf') || e.has('munition') ? (
            <label className="feld">
              <span className="feld__name">{t('feld.reichweite')}</span>
              <span className="paar">
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={5} step={5} wert={w.reichweiteNormal} data-feld="reichweiteNormal" aendern={(reichweiteNormal) => setze({ reichweiteNormal })} />
                /
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={5} step={5} wert={w.reichweiteMax} data-feld="reichweiteMax" aendern={(reichweiteMax) => setze({ reichweiteMax })} />
              </span>
            </label>
          ) : null}
        </div>
        {!w.fern ? <p className="leise">{t('reichweite.hinweis')}</p> : null}
      </Abschnitt>
    </div>
  );
}

function RuestungsFelder({ r, setze }: { r: Ruestung; setze: (teil: Partial<Ruestung>) => void }) {
  const s = sprache();
  const schild = r.ruestungsart === 'schild';
  return (
    <div className="artfelder" data-ruestung>
      <Abschnitt titel={t('abschnitt.grund')} kennung="grund">
        <div className="zeile">
          <Wahl
            label={t('feld.ruestungsart')}
            wert={r.ruestungsart}
            feld="ruestungsart"
            optionen={RUESTUNGSARTEN.map((x) => ({ wert: x, text: RUESTUNGSART_NAME[x][s] }))}
            aendern={(ruestungsart: RuestungsArt) => setze({ ruestungsart, ...(ruestungsart === 'schild' ? { rk: 2 } : {}) })}
          />
          <label className="feld">
            <span className="feld__name">{schild ? t('feld.rkSchild') : t('feld.rk')}</span>
            <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={30} wert={r.rk} data-feld="rk" aendern={(rk) => setze({ rk })} />
          </label>
          <label className="feld">
            <span className="feld__name">{t('feld.staerke')}</span>
            <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={30} wert={r.staerke} data-feld="staerke" aendern={(staerke) => setze({ staerke })} />
          </label>
          <Wahl
            label={t('feld.bonus')}
            wert={String(r.bonus)}
            feld="bonus"
            optionen={['0', '1', '2', '3'].map((x) => ({ wert: x, text: x === '0' ? t('bonus.kein') : `+${x}` }))}
            aendern={(x) => setze({ bonus: Number(x) })}
          />
        </div>
        <label className="feld feld--haken">
          <input type="checkbox" checked={r.heimlichkeitNachteil} data-feld="heimlichkeit" onChange={(e) => setze({ heimlichkeitNachteil: e.target.checked })} />{' '}
          {t('feld.heimlichkeit')}
        </label>
      </Abschnitt>
    </div>
  );
}

/**
 * Auswahl mit den üblichen Werten aus dem SRD, aber frei beschreibbar:
 * „Eigener Text …" (oder ein Wert, der in keiner Vorlage steht) zeigt ein
 * Textfeld daneben.
 */
function WahlOderText({ label, wert, vorlagen, feld, aendern }: { label: string; wert: string; vorlagen: readonly string[]; feld: string; aendern: (w: string) => void }) {
  const [frei, setFrei] = useState(() => !vorlagen.includes(wert));
  const eigen = frei || !vorlagen.includes(wert);
  return (
    <label className="feld">
      <span className="feld__name">{label}</span>
      <span className="paar">
        <select
          className="feld__wahl"
          value={eigen ? '\u0000' : wert}
          data-feld={`${feld}Wahl`}
          onChange={(e) => {
            if (e.target.value === '\u0000') {
              setFrei(true);
              return;
            }
            setFrei(false);
            aendern(e.target.value);
          }}
        >
          {vorlagen.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          <option value={'\u0000'}>{t('eigen')}</option>
        </select>
        {eigen ? <input className="feld__eingabe" value={wert} data-feld={feld} onChange={(e) => aendern(e.target.value)} /> : null}
      </span>
    </label>
  );
}

/** Die üblichen Werte, im Wortlaut der SRD-Zauber (packages/srd, Feld zeit/reichweite/dauer). */
const VORLAGEN: Record<'zeit' | 'reichweite' | 'komponenten' | 'dauer', Record<Sprache, readonly string[]>> = {
  zeit: {
    de: ['Aktion', 'Bonusaktion', 'Reaktion', 'Keine Aktion', '1 Minute', '10 Minuten', '1 Stunde', '8 Stunden', '12 Stunden', '24 Stunden'],
    en: ['Action', 'Bonus Action', 'Reaction', 'No Action', '1 minute', '10 minutes', '1 hour', '8 hours', '12 hours', '24 hours']
  },
  reichweite: {
    de: ['Selbst', 'Berührung', '1,5 Meter', '3 Meter', '9 Meter', '18 Meter', '27 Meter', '36 Meter', '45 Meter', '90 Meter', '1,6 Kilometer', 'Sicht', 'Unbegrenzt'],
    en: ['Self', 'Touch', '5 feet', '10 feet', '30 feet', '60 feet', '90 feet', '120 feet', '150 feet', '300 feet', '1 mile', 'Sight', 'Unlimited']
  },
  komponenten: {
    de: ['V', 'G', 'V, G', 'V, M', 'G, M', 'V, G, M'],
    en: ['V', 'S', 'V, S', 'V, M', 'S, M', 'V, S, M']
  },
  dauer: {
    de: ['Unmittelbar', '1 Runde', '1 Minute', '10 Minuten', '1 Stunde', '8 Stunden', '24 Stunden', '10 Tage', 'Bis der Zauber gebannt wird'],
    en: ['Instantaneous', '1 round', '1 minute', '10 minutes', '1 hour', '8 hours', '24 hours', '10 days', 'Until dispelled']
  }
};

function Haken({ label, wert, feld, aendern }: { label: string; wert: boolean; feld: string; aendern: (w: boolean) => void }) {
  return (
    <label className="feld feld--haken">
      <input type="checkbox" checked={wert} data-feld={feld} onChange={(e) => aendern(e.target.checked)} /> {label}
    </label>
  );
}

const RETTUNG_NAME: Record<(typeof RETTUNGSWUERFE)[number], [string, string]> = {
  '': ['keiner', 'none'],
  sta: ['Stärke', 'Strength'],
  ges: ['Geschicklichkeit', 'Dexterity'],
  kon: ['Konstitution', 'Constitution'],
  int: ['Intelligenz', 'Intelligence'],
  wei: ['Weisheit', 'Wisdom'],
  cha: ['Charisma', 'Charisma']
};

/** Kommagetrennte Liste ↔ Feld; leere Teile fallen weg. */
function alsListe(text: string): string[] {
  return text.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12);
}

/** Ein Listenfeld, das beim Tippen den Text behält (Komma und Leerzeichen) und erst danach zerlegt. */
function ListenFeld({ label, wert, feld, platz, aendern }: { label: string; wert: readonly string[]; feld: string; platz: string; aendern: (w: string[]) => void }) {
  const [text, setText] = useState(wert.join(', '));
  useEffect(() => {
    if (alsListe(text).join('\u0000') !== wert.join('\u0000')) setText(wert.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert]);
  return (
    <label className="feld feld--breit">
      <span className="feld__name">{label}</span>
      <input
        className="feld__eingabe"
        value={text}
        placeholder={platz}
        data-feld={feld}
        onChange={(e) => {
          setText(e.target.value);
          aendern(alsListe(e.target.value));
        }}
      />
    </label>
  );
}

function ZauberFelder({ z, setze }: { z: Zauber; setze: (teil: Partial<Zauber>) => void }) {
  const s = sprache();
  const i = s === 'de' ? 0 : 1;
  const klassen = new Set(z.klassen);
  const [eigeneZustaende, setEigeneZustaende] = useState<string[]>([]);
  useEffect(() => {
    void api.sammlung.zustaende().then(setEigeneZustaende);
  }, []);
  const schalte = (k: (typeof ZAUBERKLASSEN)[number]) => {
    const neu = new Set(klassen);
    if (neu.has(k)) neu.delete(k);
    else neu.add(k);
    setze({ klassen: ZAUBERKLASSEN.filter((x) => neu.has(x)) });
  };
  const wirkt = (w: Zauberwirkung) => z.wirkungen.includes(w);
  const schalteWirkung = (w: Zauberwirkung) =>
    setze({ wirkungen: ZAUBERWIRKUNGEN.filter((x) => (x === w ? !wirkt(x) : wirkt(x))) });
  const srdZustaende = SRD_ZUSTAENDE.map((x) => x.name[s]);
  return (
    <div className="artfelder" data-zauber>
      <Abschnitt titel={t('abschnitt.grund')} kennung="grund">
        <div className="zeile">
          <Wahl
            label={t('feld.grad')}
            wert={String(z.grad)}
            feld="grad"
            optionen={Array.from({ length: 10 }, (_, g) => ({ wert: String(g), text: g === 0 ? t('grad.trick') : String(g) }))}
            aendern={(x) => setze({ grad: Number(x) })}
          />
          <Wahl
            label={t('feld.schule')}
            wert={z.schule}
            feld="schule"
            optionen={ZAUBERSCHULEN.map((x) => ({ wert: x, text: SCHULE_NAME[x][s] }))}
            aendern={(schule) => setze({ schule })}
          />
        </div>
        <p className="erklaerung" data-schule-text>
          {SCHULE_TEXT[z.schule][s]}
        </p>
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.klassen')} kennung="klassen">
        <fieldset className="chips" data-klassen>
          <legend className="feld__name">{t('feld.klassen')}</legend>
          {ZAUBERKLASSEN.map((k) => (
            <button key={k} type="button" className={klassen.has(k) ? 'chip chip--an' : 'chip'} aria-pressed={klassen.has(k)} data-klasse={k} onClick={() => schalte(k)}>
              {KLASSE_NAME[k][s]}
            </button>
          ))}
        </fieldset>
        <ListenFeld label={t('feld.eigeneKlassen')} wert={z.eigeneKlassen} feld="eigeneKlassen" platz={t('feld.eigeneKlassenPlatz')} aendern={(eigeneKlassen) => setze({ eigeneKlassen })} />
        <ListenFeld label={t('feld.unterklassen')} wert={z.unterklassen} feld="unterklassen" platz={t('feld.unterklassenPlatz')} aendern={(unterklassen) => setze({ unterklassen })} />
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.zauberwerte')} kennung="zauberwerte">
        <div className="zeile">
          <WahlOderText label={t('feld.zeit')} wert={z.zeit} vorlagen={VORLAGEN.zeit[s]} feld="zeit" aendern={(zeit) => setze({ zeit })} />
          <WahlOderText label={t('feld.zauberReichweite')} wert={z.reichweite} vorlagen={VORLAGEN.reichweite[s]} feld="zauberReichweite" aendern={(reichweite) => setze({ reichweite })} />
        </div>
        <div className="zeile">
          <WahlOderText label={t('feld.komponenten')} wert={z.komponenten} vorlagen={VORLAGEN.komponenten[s]} feld="komponenten" aendern={(komponenten) => setze({ komponenten })} />
          <WahlOderText label={t('feld.dauer')} wert={z.dauer} vorlagen={VORLAGEN.dauer[s]} feld="dauer" aendern={(dauer) => setze({ dauer })} />
        </div>
        <div className="zeile">
          <Haken label={t('feld.konzentration')} wert={z.konzentration} feld="konzentration" aendern={(konzentration) => setze({ konzentration })} />
          <Haken label={t('feld.ritual')} wert={z.ritual} feld="ritual" aendern={(ritual) => setze({ ritual })} />
        </div>
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.wirkung')} kennung="wirkung">
        <fieldset className="chips" data-wirkungen>
          <legend className="feld__name">{t('feld.zauberWirkung')}</legend>
          {ZAUBERWIRKUNGEN.map((w) => (
            <button key={w} type="button" className={wirkt(w) ? 'chip chip--an' : 'chip'} aria-pressed={wirkt(w)} data-wirkung-art={w} onClick={() => schalteWirkung(w)}>
              {t(`wirkung.${w}` as TextKey)}
            </button>
          ))}
        </fieldset>
        {z.wirkungen.length === 0 ? <p className="leise">{t('wirkung.keine')}</p> : null}
        {wirkt('schaden') ? (
          <div className="zeile">
            <label className="feld">
              <span className="feld__name">{t('feld.schaden')}</span>
              <span className="paar">
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={HOECHSTENS_WUERFEL} wert={z.schadenAnzahl} data-feld="schadenAnzahl" aendern={(schadenAnzahl) => setze({ schadenAnzahl })} />
                <select className="feld__wahl" value={String(z.schadenSeiten)} data-feld="schadenSeiten" onChange={(e) => setze({ schadenSeiten: Number(e.target.value) })}>
                  {SEITEN.map((w) => (
                    <option key={w} value={w}>
                      {s === 'de' ? 'W' : 'd'}
                      {w}
                    </option>
                  ))}
                </select>
                +
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={200} wert={z.schadenPlus} data-feld="schadenPlus" aendern={(schadenPlus) => setze({ schadenPlus })} />
              </span>
            </label>
            <Wahl
              label={t('feld.schadensart')}
              wert={z.schadensart}
              feld="schadensart"
              optionen={SCHADENSARTEN.map((x) => ({ wert: x, text: SCHADENSART_NAME[x][s] }))}
              aendern={(schadensart: Schadensart) => setze({ schadensart })}
            />
          </div>
        ) : null}
        {wirkt('heilung') ? (
          <div className="zeile">
            <label className="feld">
              <span className="feld__name">{t('feld.heilung')}</span>
              <span className="paar">
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={HOECHSTENS_WUERFEL} wert={z.heilAnzahl} data-feld="heilAnzahl" aendern={(heilAnzahl) => setze({ heilAnzahl })} />
                <select className="feld__wahl" value={String(z.heilSeiten)} data-feld="heilSeiten" onChange={(e) => setze({ heilSeiten: Number(e.target.value) })}>
                  {SEITEN.map((w) => (
                    <option key={w} value={w}>
                      {s === 'de' ? 'W' : 'd'}
                      {w}
                    </option>
                  ))}
                </select>
                +
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={0} max={200} wert={z.heilPlus} data-feld="heilPlus" aendern={(heilPlus) => setze({ heilPlus })} />
              </span>
            </label>
          </div>
        ) : null}
        {wirkt('zustand') ? (
          <div className="zeile">
            <label className="feld">
              <span className="feld__name">{t('feld.zustand')}</span>
              <span className="paar">
                <select
                  className="feld__wahl"
                  value={[...srdZustaende, ...eigeneZustaende].includes(z.zustand) ? z.zustand : '\u0000'}
                  data-feld="zustandWahl"
                  onChange={(e) => setze({ zustand: e.target.value === '\u0000' ? '' : e.target.value })}
                >
                  <optgroup label={t('zustand.srd')}>
                    {srdZustaende.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                  {eigeneZustaende.length ? (
                    <optgroup label={t('zustand.eigene')}>
                      {eigeneZustaende.map((n) => (
                        <option key={`e-${n}`} value={n}>
                          {n}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <option value={'\u0000'}>{t('eigen')}</option>
                </select>
                {[...srdZustaende, ...eigeneZustaende].includes(z.zustand) ? null : (
                  <input className="feld__eingabe" value={z.zustand} data-feld="zustand" onChange={(e) => setze({ zustand: e.target.value })} />
                )}
              </span>
            </label>
          </div>
        ) : null}
        <div className="zeile">
          <Wahl
            label={t('feld.ziel')}
            wert={z.ziel}
            feld="ziel"
            optionen={(['einzel', 'mehrere', 'flaeche'] as const).map((x) => ({ wert: x, text: t(`ziel.${x}` as TextKey) }))}
            aendern={(ziel) => setze({ ziel })}
          />
          {z.ziel === 'flaeche' ? (
            <>
              <Wahl
                label={t('feld.flaeche')}
                wert={z.flaeche}
                feld="flaeche"
                optionen={FLAECHEN.map((x) => ({ wert: x, text: t(`flaeche.${x}` as TextKey) }))}
                aendern={(flaeche) => setze({ flaeche })}
              />
              <label className="feld">
                <span className="feld__name">{t('feld.flaecheGroesse')}</span>
                <ZahlFeld className="feld__eingabe feld__eingabe--kurz" min={5} step={5} wert={z.flaecheGroesse} data-feld="flaecheGroesse" aendern={(flaecheGroesse) => setze({ flaecheGroesse })} />
              </label>
            </>
          ) : null}
        </div>
        <div className="zeile">
          <Wahl
            label={t('feld.rettungswurf')}
            wert={z.rettungswurf}
            feld="rettungswurf"
            optionen={RETTUNGSWUERFE.map((x) => ({ wert: x, text: RETTUNG_NAME[x][i] }))}
            aendern={(rettungswurf) => setze({ rettungswurf })}
          />
          {z.rettungswurf && wirkt('schaden') ? <Haken label={t('feld.halb')} wert={z.halbBeiErfolg} feld="halbBeiErfolg" aendern={(halbBeiErfolg) => setze({ halbBeiErfolg })} /> : null}
          <Haken label={t('feld.angriffswurf')} wert={z.angriffswurf} feld="angriffswurf" aendern={(angriffswurf) => setze({ angriffswurf })} />
        </div>
      </Abschnitt>
      <Abschnitt titel={t('abschnitt.hoeher')} kennung="hoeher">
        <label className="feld feld--hoch">
          <span className="feld__name">{t('feld.hoehererGrad')}</span>
          <textarea className="feld__flaeche" rows={2} value={z.hoehererGrad} data-feld="hoehererGrad" onChange={(e) => setze({ hoehererGrad: e.target.value })} />
        </label>
      </Abschnitt>
    </div>
  );
}

/** Das gemeinsame Formular aus @suite/magie, wie im Magic Item Generator. */
function MagischFelder({ m, setze }: { m: Magisch; setze: (teil: Partial<Magisch>) => void }) {
  const s = sprache();
  const felder = { art: m.gegenstandsart, seltenheit: m.seltenheit, einstimmung: m.einstimmung, wirkungen: m.wirkungen, fluch: m.fluch };
  return (
    <div className="artfelder" data-magisch>
      <MagieFelder
        g={felder}
        sprache={s}
        setze={(teil) => {
          const { art, wirkungen, ...rest } = teil;
          const neu: Partial<Magisch> = { ...rest, ...(art ? { gegenstandsart: art } : {}), ...(wirkungen ? { wirkungen: [...wirkungen] } : {}) };
          // Tränke und Schriftrollen verlangen nie Einstimmung (wie im Generator).
          if (art === 'trank' || art === 'schriftrolle') neu.einstimmung = false;
          setze(neu);
        }}
      />
    </div>
  );
}

function EichungsTafel({ e }: { e: Eintrag }) {
  if (e.art === 'zauber') return <EinfacheTafel eichung={eicheZauber(e)} hinweis="eichung.zauberHinweis" />;
  if (e.art === 'magisch') return <EinfacheTafel eichung={eicheMagisch(e)} hinweis="eichung.magischHinweis" />;
  const s = sprache();
  const eichung: Eichung<{ name: readonly [string, string] }> | null =
    e.art === 'waffe' ? eicheWaffe(e) : e.art === 'ruestung' ? eicheRuestung(e) : null;
  return (
    <aside className="karte eichung" data-eichung={eichung?.urteil ?? 'keine'}>
      <h2>{t('eichung')}</h2>
      {eichung ? (
        <>
          <p className={`eichung__urteil eichung__urteil--${eichung.urteil}`} data-urteil={eichung.urteil}>
            {t(`eichung.${eichung.urteil}` as TextKey)}
          </p>
          <p data-eichung-satz>{eichung.satz[s]}</p>
          {eichung.seltenheit ? (
            <p data-eichung-seltenheit>
              {t('eichung.seltenheit', {
                bonus: (e as Waffe | Ruestung).bonus,
                seltenheit: SELTENHEIT_NAME[eichung.seltenheit][s]
              })}
            </p>
          ) : null}
          {eichung.befunde.length ? (
            <ul className="eichung__befunde">
              {eichung.befunde.map((b) => (
                <li key={b.text.en} className={`befund befund--${b.stufe}`} data-befund={b.stufe}>
                  {b.text[s]}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="leise">{t('eichung.hinweis')}</p>
        </>
      ) : (
        <p className="leise">{t('eichung.bald')}</p>
      )}
    </aside>
  );
}

/** Die Tafel fuer Zauber und magische Gegenstaende: Urteil (falls es eines gibt), Satz, Befunde. */
function EinfacheTafel({ eichung, hinweis }: { eichung: { urteil: Eichung<never>['urteil'] | null; satz: { de: string; en: string }; befunde: readonly { stufe: string; text: { de: string; en: string } }[] }; hinweis: TextKey }) {
  const s = sprache();
  return (
    <aside className="karte eichung" data-eichung={eichung.urteil ?? 'keine'}>
      <h2>{t('eichung')}</h2>
      {eichung.urteil ? (
        <p className={`eichung__urteil eichung__urteil--${eichung.urteil}`} data-urteil={eichung.urteil}>
          {t(`eichung.${eichung.urteil}` as TextKey)}
        </p>
      ) : null}
      <p data-eichung-satz>{eichung.satz[s]}</p>
      {eichung.befunde.length ? (
        <ul className="eichung__befunde">
          {eichung.befunde.map((b) => (
            <li key={b.text.en} className={`befund befund--${b.stufe}`} data-befund={b.stufe}>
              {b.text[s]}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="leise">{t(hinweis)}</p>
    </aside>
  );
}

/** Das Bild des Eintrags: verkleinert (laengste Seite 480 px, JPEG) und als data:-Adresse gespeichert, wie das Porträt im Charakterbogen. */
const KANTE = 480;

function verkleinere(datei: File): Promise<string> {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('lesen'));
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('bild'));
      bild.onload = () => {
        const faktor = Math.min(1, KANTE / Math.max(bild.width, bild.height));
        const flaeche = document.createElement('canvas');
        flaeche.width = Math.max(1, Math.round(bild.width * faktor));
        flaeche.height = Math.max(1, Math.round(bild.height * faktor));
        const stift = flaeche.getContext('2d');
        if (!stift) return fehler(new Error('leinwand'));
        stift.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
        fertig(flaeche.toDataURL('image/jpeg', 0.86));
      };
      bild.src = String(leser.result);
    };
    leser.readAsDataURL(datei);
  });
}

function BildWahl({ bild, setze }: { bild: string | null; setze: (b: string | null) => void }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState('');
  return (
    <div className="bildwahl" data-bild>
      <button type="button" className="bildwahl__rahmen" title={bild ? t('bild.aendern') : t('bild.waehlen')} onClick={() => eingabe.current?.click()}>
        {bild ? <img src={bild} alt="" /> : <span className="bildwahl__leer">＋ {t('bild')}</span>}
      </button>
      <input
        ref={eingabe}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        data-bild-datei
        onChange={async (e) => {
          const datei = e.target.files?.[0];
          e.target.value = '';
          if (!datei) return;
          try {
            setFehler('');
            setze(await verkleinere(datei));
          } catch {
            setFehler(t('bild.fehler'));
          }
        }}
      />
      {bild ? (
        <button type="button" className="knopf knopf--klein" data-bild-weg onClick={() => setze(null)}>
          {t('bild.weg')}
        </button>
      ) : null}
      {fehler ? <p className="fehler">{fehler}</p> : null}
    </div>
  );
}
