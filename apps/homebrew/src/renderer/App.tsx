/**
 * Der Homebrew Creator (docs/homebrew-creator.md).
 *
 * Zwei Ansichten wie in den anderen Werkzeugen: die Sammlung als Kacheln mit
 * Suche und Art-Filter, und ein Eintrag zum Bearbeiten. Neben den Feldern
 * steht die Eichung am SRD; sie warnt, sie verbietet nichts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ZAUBERKLASSEN,
  ZAUBERSCHULEN,
  leererEintrag,
  type Art,
  type Eintrag,
  type Ruestung,
  type Schadensart,
  type Waffe,
  type Zauber
} from '../shared/modell';
import type { Kachel } from '../shared/ablage';
import {
  ART_NAME,
  ART_ZEICHEN,
  EIGENSCHAFT_NAME,
  KLASSE_NAME,
  MEISTERSCHAFT_NAME,
  RUESTUNGSART_NAME,
  SCHADENSART_NAME,
  SCHULE_NAME
} from '../shared/texte';
import { eicheRuestung, eicheWaffe, type Eichung } from '../shared/eichung';
import { eicheZauber } from '../shared/zauberEichung';

type Sprache = 'de' | 'en';

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

/** Arten, die schon einen Reiter haben. Die uebrigen folgen (docs/homebrew-creator.md, Schritte). */
export const BEREIT: readonly Art[] = ['waffe', 'ruestung', 'gegenstand', 'zauber'];

export function App() {
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
    const setze = (teil: Partial<Eintrag>) => {
      setOffen({ ...offen, ...teil } as Eintrag);
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
          <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => void speichere()}>
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
                  </div>
                )}
              </div>
            </div>

            {offen.art === 'waffe' ? <WaffenFelder w={offen} setze={setze} /> : null}
            {offen.art === 'ruestung' ? <RuestungsFelder r={offen} setze={setze} /> : null}
            {offen.art === 'zauber' ? <ZauberFelder z={offen} setze={setze} /> : null}

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
            {meldung ? <p className="meldung" data-meldung>{meldung}</p> : null}
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

function wuerfelName(w: string, s: Sprache): string {
  return s === 'de' ? w.replace('d', 'W') : w;
}

function WaffenFelder({ w, setze }: { w: Waffe; setze: (teil: Partial<Waffe>) => void }) {
  const s = sprache();
  const e = new Set(w.eigenschaften);
  const schalte = (x: (typeof WAFFEN_EIGENSCHAFTEN)[number]) => {
    const neu = new Set(e);
    if (neu.has(x)) neu.delete(x);
    else neu.add(x);
    setze({ eigenschaften: WAFFEN_EIGENSCHAFTEN.filter((y) => neu.has(y)) });
  };
  return (
    <div className="artfelder" data-waffe>
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
          label={t('feld.nahFern')}
          wert={w.fern ? 'fern' : 'nah'}
          feld="fern"
          optionen={[
            { wert: 'nah', text: t('nah') },
            { wert: 'fern', text: t('fern') }
          ]}
          aendern={(x) => setze({ fern: x === 'fern' })}
        />
        <Wahl
          label={t('feld.wuerfel')}
          wert={WUERFEL.includes(w.wuerfel) ? w.wuerfel : '1d8'}
          feld="wuerfel"
          optionen={WUERFEL.map((x) => ({ wert: x, text: wuerfelName(x, s) }))}
          aendern={(wuerfel) => setze({ wuerfel })}
        />
        <Wahl
          label={t('feld.schadensart')}
          wert={w.schadensart}
          feld="schadensart"
          optionen={SCHADENSARTEN.map((x) => ({ wert: x, text: SCHADENSART_NAME[x][s] }))}
          aendern={(schadensart: Schadensart) => setze({ schadensart })}
        />
      </div>
      <fieldset className="chips" data-eigenschaften>
        <legend className="feld__name">{t('feld.eigenschaften')}</legend>
        {WAFFEN_EIGENSCHAFTEN.map((x) => (
          <button key={x} type="button" className={e.has(x) ? 'chip chip--an' : 'chip'} aria-pressed={e.has(x)} data-eigenschaft={x} onClick={() => schalte(x)}>
            {EIGENSCHAFT_NAME[x][s]}
          </button>
        ))}
      </fieldset>
      <div className="zeile">
        {e.has('vielseitig') ? (
          <Wahl
            label={t('feld.vielseitig')}
            wert={WUERFEL.includes(w.vielseitig) ? w.vielseitig : '1d10'}
            feld="vielseitig"
            optionen={WUERFEL.map((x) => ({ wert: x, text: wuerfelName(x, s) }))}
            aendern={(vielseitig) => setze({ vielseitig })}
          />
        ) : null}
        {e.has('wurf') || e.has('munition') ? (
          <label className="feld">
            <span className="feld__name">{t('feld.reichweite')}</span>
            <span className="paar">
              <input className="feld__eingabe feld__eingabe--kurz" type="number" min={5} step={5} value={w.reichweiteNormal} data-feld="reichweiteNormal" onChange={(x) => setze({ reichweiteNormal: Math.max(5, Number(x.target.value) || 5) })} />
              /
              <input className="feld__eingabe feld__eingabe--kurz" type="number" min={5} step={5} value={w.reichweiteMax} data-feld="reichweiteMax" onChange={(x) => setze({ reichweiteMax: Math.max(5, Number(x.target.value) || 5) })} />
            </span>
          </label>
        ) : null}
        <Wahl
          label={t('feld.meisterschaft')}
          wert={w.meisterschaft}
          feld="meisterschaft"
          optionen={MEISTERSCHAFTEN.map((x) => ({ wert: x, text: MEISTERSCHAFT_NAME[x][s] }))}
          aendern={(meisterschaft: Meisterschaft) => setze({ meisterschaft })}
        />
        <Wahl
          label={t('feld.bonus')}
          wert={String(w.bonus)}
          feld="bonus"
          optionen={['0', '1', '2', '3'].map((x) => ({ wert: x, text: x === '0' ? t('bonus.kein') : `+${x}` }))}
          aendern={(x) => setze({ bonus: Number(x) })}
        />
      </div>
    </div>
  );
}

function RuestungsFelder({ r, setze }: { r: Ruestung; setze: (teil: Partial<Ruestung>) => void }) {
  const s = sprache();
  const schild = r.ruestungsart === 'schild';
  return (
    <div className="artfelder" data-ruestung>
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
          <input className="feld__eingabe feld__eingabe--kurz" type="number" min={0} max={30} value={r.rk} data-feld="rk" onChange={(e) => setze({ rk: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
        </label>
        <label className="feld">
          <span className="feld__name">{t('feld.staerke')}</span>
          <input className="feld__eingabe feld__eingabe--kurz" type="number" min={0} max={30} value={r.staerke} data-feld="staerke" onChange={(e) => setze({ staerke: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
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
    </div>
  );
}

function Textfeld({ label, wert, feld, aendern }: { label: string; wert: string; feld: string; aendern: (w: string) => void }) {
  return (
    <label className="feld">
      <span className="feld__name">{label}</span>
      <input className="feld__eingabe" value={wert} data-feld={feld} onChange={(e) => aendern(e.target.value)} />
    </label>
  );
}

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

function ZauberFelder({ z, setze }: { z: Zauber; setze: (teil: Partial<Zauber>) => void }) {
  const s = sprache();
  const i = s === 'de' ? 0 : 1;
  const klassen = new Set(z.klassen);
  const schalte = (k: (typeof ZAUBERKLASSEN)[number]) => {
    const neu = new Set(klassen);
    if (neu.has(k)) neu.delete(k);
    else neu.add(k);
    setze({ klassen: ZAUBERKLASSEN.filter((x) => neu.has(x)) });
  };
  return (
    <div className="artfelder" data-zauber>
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
      <fieldset className="chips" data-klassen>
        <legend className="feld__name">{t('feld.klassen')}</legend>
        {ZAUBERKLASSEN.map((k) => (
          <button key={k} type="button" className={klassen.has(k) ? 'chip chip--an' : 'chip'} aria-pressed={klassen.has(k)} data-klasse={k} onClick={() => schalte(k)}>
            {KLASSE_NAME[k][s]}
          </button>
        ))}
      </fieldset>
      <div className="zeile">
        <Textfeld label={t('feld.zeit')} wert={z.zeit} feld="zeit" aendern={(zeit) => setze({ zeit })} />
        <Textfeld label={t('feld.zauberReichweite')} wert={z.reichweite} feld="zauberReichweite" aendern={(reichweite) => setze({ reichweite })} />
        <Textfeld label={t('feld.komponenten')} wert={z.komponenten} feld="komponenten" aendern={(komponenten) => setze({ komponenten })} />
        <Textfeld label={t('feld.dauer')} wert={z.dauer} feld="dauer" aendern={(dauer) => setze({ dauer })} />
      </div>
      <div className="zeile">
        <Haken label={t('feld.konzentration')} wert={z.konzentration} feld="konzentration" aendern={(konzentration) => setze({ konzentration })} />
        <Haken label={t('feld.ritual')} wert={z.ritual} feld="ritual" aendern={(ritual) => setze({ ritual })} />
      </div>
      <h3 className="feld__name">{t('feld.schaden')}</h3>
      <div className="zeile">
        <label className="feld">
          <span className="feld__name">{t('feld.wuerfel')}</span>
          <span className="paar">
            <input className="feld__eingabe feld__eingabe--kurz" type="number" min={0} max={40} value={z.schadenAnzahl} data-feld="schadenAnzahl" onChange={(e) => setze({ schadenAnzahl: Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0))) })} />
            <select className="feld__wahl" value={String(z.schadenSeiten)} data-feld="schadenSeiten" onChange={(e) => setze({ schadenSeiten: Number(e.target.value) })}>
              {[4, 6, 8, 10, 12].map((w) => (
                <option key={w} value={w}>
                  {s === 'de' ? 'W' : 'd'}
                  {w}
                </option>
              ))}
            </select>
            +
            <input className="feld__eingabe feld__eingabe--kurz" type="number" min={0} max={200} value={z.schadenPlus} data-feld="schadenPlus" onChange={(e) => setze({ schadenPlus: Math.max(0, Math.min(200, Math.round(Number(e.target.value) || 0))) })} />
          </span>
        </label>
        <Wahl
          label={t('feld.schadensart')}
          wert={z.schadensart}
          feld="schadensart"
          optionen={SCHADENSARTEN.map((x) => ({ wert: x, text: SCHADENSART_NAME[x][s] }))}
          aendern={(schadensart: Schadensart) => setze({ schadensart })}
        />
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
              <input className="feld__eingabe feld__eingabe--kurz" type="number" min={5} step={5} value={z.flaecheGroesse} data-feld="flaecheGroesse" onChange={(e) => setze({ flaecheGroesse: Math.max(5, Math.round(Number(e.target.value) || 5)) })} />
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
        {z.rettungswurf ? <Haken label={t('feld.halb')} wert={z.halbBeiErfolg} feld="halbBeiErfolg" aendern={(halbBeiErfolg) => setze({ halbBeiErfolg })} /> : null}
        <Haken label={t('feld.angriffswurf')} wert={z.angriffswurf} feld="angriffswurf" aendern={(angriffswurf) => setze({ angriffswurf })} />
      </div>
      <label className="feld feld--hoch">
        <span className="feld__name">{t('feld.hoehererGrad')}</span>
        <textarea className="feld__flaeche" rows={2} value={z.hoehererGrad} data-feld="hoehererGrad" onChange={(e) => setze({ hoehererGrad: e.target.value })} />
      </label>
    </div>
  );
}

function EichungsTafel({ e }: { e: Eintrag }) {
  if (e.art === 'zauber') return <ZauberEichungsTafel z={e} />;
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

function ZauberEichungsTafel({ z }: { z: Zauber }) {
  const s = sprache();
  const eichung = eicheZauber(z);
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
      <p className="leise">{t('eichung.zauberHinweis')}</p>
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
