/**
 * Ansicht „Gestalten": welche Tiere eine Figur annehmen kann
 * (docs/tiergestalt.md).
 *
 * Ein Filter ueber die 91 Tiere des SRD mit Voreinstellungen (Tiergestalt
 * nach Druidenstufe, Vertrauter, Verwandlung, Tiergestalten, eigene
 * Grenze), weiteren Filtern nach Bewegung, Groesse und Sinnen, einer
 * Sortierung und einem Vergleich von bis zu drei Gestalten. Die Regeln
 * selbst stehen in `@suite/srd/gestalten`.
 *
 * Kommt der Aufruf aus dem Charakterbogen, bringt er Vorgabe, Stufe und
 * die bekannten Gestalten der Figur mit (`gestalten?vorgabe=…`); die
 * bekannten sind hier nur markiert, gewaehlt werden sie im Bogen.
 */
import { useMemo, useState } from 'react';
import type { Sprache } from '@suite/srd';
import {
  BEWEGUNGSARTEN,
  BEWEGUNGSART_NAME,
  GROESSEN,
  GROESSE_NAME,
  SINNE,
  SINN_NAME,
  VORGABEN,
  VORGABE_NAME,
  alleGestalten,
  erfuellt,
  gestaltNach,
  grenzeFuer,
  hgText,
  tiergestaltFuer,
  type Bewegungsart,
  type Gestalt,
  type Sinn,
  type Vorgabe
} from '@suite/srd/gestalten';
import type { MonsterGroesse } from '@suite/srd/monster';
import { t } from './i18n';

/** Was ein Aufruf von aussen mitbringt. */
export interface Gestaltaufruf {
  readonly vorgabe: Vorgabe;
  readonly wert: number;
  readonly bekannt: readonly string[];
  readonly figur: string;
  readonly offen: string | null;
}

export const LEERER_AUFRUF: Gestaltaufruf = { vorgabe: 'tiergestalt', wert: 2, bekannt: [], figur: '', offen: null };

/** `gestalten?vorgabe=tiergestalt&wert=4&bekannt=wolf,rat&figur=Ilva` oder `gestalt/wolf`. */
export function leseAufruf(kennung: string): Gestaltaufruf | null {
  if (kennung.startsWith('gestalt/')) {
    const id = kennung.slice('gestalt/'.length);
    return gestaltNach(id) ? { ...LEERER_AUFRUF, vorgabe: 'alle', offen: id } : null;
  }
  if (kennung !== 'gestalten' && !kennung.startsWith('gestalten?')) return null;
  const p = new URLSearchParams(kennung.slice('gestalten'.length).replace(/^\?/, ''));
  const vorgabe = (VORGABEN as readonly string[]).includes(p.get('vorgabe') ?? '') ? (p.get('vorgabe') as Vorgabe) : 'tiergestalt';
  const wert = Number(p.get('wert'));
  return {
    vorgabe,
    wert: Number.isFinite(wert) && p.get('wert') !== null ? wert : LEERER_AUFRUF.wert,
    bekannt: (p.get('bekannt') ?? '').split(',').filter((id) => gestaltNach(id)),
    figur: p.get('figur') ?? '',
    offen: null
  };
}

type Sortierung = 'hg' | 'name' | 'tp' | 'rk';

/** Wie weit sie fliegt, schwimmt … als kurze Zeile: „40 ft., Klettern 30". */
function bewegungKurz(g: Gestalt, spr: Sprache): string {
  return BEWEGUNGSARTEN.filter((a) => g.bewegung[a] !== undefined)
    .map((a) => (a === 'laufen' ? `${g.bewegung[a]}` : `${BEWEGUNGSART_NAME[a][spr]} ${g.bewegung[a]}`))
    .join(', ');
}

export function Gestalten({ aufruf, spr }: { readonly aufruf: Gestaltaufruf; readonly spr: Sprache }) {
  const [vorgabe, setVorgabe] = useState<Vorgabe>(aufruf.vorgabe);
  const [wert, setWert] = useState(aufruf.wert);
  const [flug, setFlug] = useState(false);
  const [bewegung, setBewegung] = useState<ReadonlySet<Bewegungsart>>(new Set());
  const [sinne, setSinne] = useState<ReadonlySet<Sinn>>(new Set());
  const [maxGroesse, setMaxGroesse] = useState<MonsterGroesse | ''>('');
  const [schwaerme, setSchwaerme] = useState(true);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('hg');
  const [offen, setOffen] = useState<string | null>(aufruf.offen);
  const [vergleich, setVergleich] = useState<readonly string[]>([]);
  const bekannt = new Set(aufruf.bekannt);

  const grenze = grenzeFuer(vorgabe, wert, flug);
  const stufe = vorgabe === 'tiergestalt' ? tiergestaltFuer(wert) : null;

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const groesse = maxGroesse ? GROESSEN.indexOf(maxGroesse) : GROESSEN.length;
    return alleGestalten()
      .filter((g) => (grenze ? erfuellt(g, grenze) : false))
      .filter((g) => [...bewegung].every((a) => g.bewegung[a] !== undefined))
      .filter((g) => [...sinne].every((s) => g.sinne[s] !== undefined))
      .filter((g) => GROESSEN.indexOf(g.monster.groesse) <= groesse)
      .filter((g) => schwaerme || !g.schwarm)
      .filter((g) => !q || g.monster.name.de.toLowerCase().includes(q) || g.monster.name.en.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortierung === 'name') return a.monster.name[spr].localeCompare(b.monster.name[spr], spr);
        if (sortierung === 'tp') return b.monster.tp - a.monster.tp;
        if (sortierung === 'rk') return b.monster.rk - a.monster.rk;
        return a.hg - b.hg || a.monster.name[spr].localeCompare(b.monster.name[spr], spr);
      });
  }, [grenze?.maxHg, grenze?.flug, grenze?.nurHg, grenze?.maxGroesse, bewegung, sinne, maxGroesse, schwaerme, suche, sortierung, spr]);

  const schalte = <T,>(menge: ReadonlySet<T>, x: T): ReadonlySet<T> => {
    const neu = new Set(menge);
    if (neu.has(x)) neu.delete(x);
    else neu.add(x);
    return neu;
  };

  const vergleiche = (id: string) =>
    setVergleich((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id].slice(-3)));

  const wertFeld = vorgabe === 'tiergestalt' || vorgabe === 'verwandlung' || vorgabe === 'eigene';
  const wertName =
    vorgabe === 'tiergestalt' ? t('gestalt.stufe') : vorgabe === 'verwandlung' ? t('gestalt.zielHg') : t('gestalt.maxHg');

  const offenGestalt = offen ? gestaltNach(offen) : undefined;
  const imVergleich = vergleich.map((id) => gestaltNach(id)).filter((g): g is Gestalt => Boolean(g));

  return (
    <div className="spalten" data-gestalten>
      <nav className="liste gestalten__liste" aria-label={t('ansicht.gestalten')}>
        {aufruf.figur ? (
          <p className="gestalten__figur" data-gestalt-figur>
            {t('gestalt.fuer', { name: aufruf.figur })}
          </p>
        ) : null}
        <label className="gestalten__feld">
          <span>{t('gestalt.vorgabe')}</span>
          <select data-gestalt-vorgabe value={vorgabe} onChange={(e) => setVorgabe(e.target.value as Vorgabe)}>
            {VORGABEN.map((v) => (
              <option key={v} value={v}>
                {VORGABE_NAME[v][spr]}
              </option>
            ))}
          </select>
        </label>
        {wertFeld ? (
          <label className="gestalten__feld">
            <span>{wertName}</span>
            <input
              type="number"
              data-gestalt-wert
              min={0}
              max={30}
              step={vorgabe === 'tiergestalt' ? 1 : 0.125}
              value={wert}
              onChange={(e) => setWert(Number(e.target.value) || 0)}
            />
          </label>
        ) : null}
        {vorgabe === 'eigene' ? (
          <label className="gestalten__haken">
            <input type="checkbox" data-gestalt-flug checked={flug} onChange={(e) => setFlug(e.target.checked)} />
            {t('gestalt.flugErlaubt')}
          </label>
        ) : null}
        <p className="gestalten__regel" data-gestalt-regel>
          {stufe
            ? t('gestalt.regelStufe', {
                bekannt: stufe.bekannt,
                hg: hgText(stufe.maxHg),
                flug: stufe.flug ? t('gestalt.ja') : t('gestalt.nein'),
                nutzungen: stufe.nutzungen,
                temp: stufe.tempTp,
                stunden: stufe.stunden
              })
            : vorgabe === 'tiergestalt'
              ? t('gestalt.abStufe2')
              : vorgabe === 'eigene'
                ? t('gestalt.regelEigene')
                : vorgabe === 'vertrauter'
                  ? t('gestalt.regelVertrauter')
                  : vorgabe === 'verwandlung'
                    ? t('gestalt.regelVerwandlung')
                    : vorgabe === 'tiergestalten'
                      ? t('gestalt.regelTiergestalten')
                      : ''}
        </p>

        <fieldset className="gestalten__chips">
          <legend>{t('gestalt.bewegung')}</legend>
          {BEWEGUNGSARTEN.filter((a) => a !== 'laufen').map((a) => (
            <button
              key={a}
              type="button"
              className={bewegung.has(a) ? 'chip chip--an' : 'chip'}
              aria-pressed={bewegung.has(a)}
              data-gestalt-bewegung={a}
              onClick={() => setBewegung(schalte(bewegung, a))}
            >
              {BEWEGUNGSART_NAME[a][spr]}
            </button>
          ))}
        </fieldset>
        <fieldset className="gestalten__chips">
          <legend>{t('gestalt.sinne')}</legend>
          {SINNE.map((s) => (
            <button
              key={s}
              type="button"
              className={sinne.has(s) ? 'chip chip--an' : 'chip'}
              aria-pressed={sinne.has(s)}
              data-gestalt-sinn={s}
              onClick={() => setSinne(schalte(sinne, s))}
            >
              {SINN_NAME[s][spr]}
            </button>
          ))}
        </fieldset>
        <div className="gestalten__zeile">
          <label className="gestalten__feld">
            <span>{t('gestalt.maxGroesse')}</span>
            <select value={maxGroesse} onChange={(e) => setMaxGroesse(e.target.value as MonsterGroesse | '')}>
              <option value="">{t('gestalt.jede')}</option>
              {GROESSEN.map((g) => (
                <option key={g} value={g}>
                  ≤ {GROESSE_NAME[g][spr]}
                </option>
              ))}
            </select>
          </label>
          <label className="gestalten__feld">
            <span>{t('gestalt.sortierung')}</span>
            <select data-gestalt-sortierung value={sortierung} onChange={(e) => setSortierung(e.target.value as Sortierung)}>
              <option value="hg">{t('gestalt.nachHg')}</option>
              <option value="name">{t('gestalt.nachName')}</option>
              <option value="tp">{t('gestalt.nachTp')}</option>
              <option value="rk">{t('gestalt.nachRk')}</option>
            </select>
          </label>
        </div>
        <label className="gestalten__haken">
          <input type="checkbox" checked={schwaerme} onChange={(e) => setSchwaerme(e.target.checked)} />
          {t('gestalt.schwaerme')}
        </label>
        <input
          className="liste__suche"
          type="search"
          value={suche}
          placeholder={t('gestalt.suche')}
          aria-label={t('suche')}
          onChange={(e) => setSuche(e.target.value)}
        />
        <p className="liste__anzahl" data-gestalt-anzahl={liste.length}>
          {t('gestalt.anzahl', { anzahl: liste.length })}
          {aufruf.bekannt.length && stufe ? ` · ${t('gestalt.bekanntZahl', { n: aufruf.bekannt.length, max: stufe.bekannt })}` : ''}
        </p>
        <ul className="gestalten__eintraege" data-pfeile="liste">
          {liste.map((g) => (
            <li key={g.monster.id} className="gestalten__eintrag" data-pfeil>
              <button
                type="button"
                className={g.monster.id === offen ? 'eintrag eintrag--offen' : 'eintrag'}
                data-gestalt={g.monster.id}
                aria-current={g.monster.id === offen ? 'true' : undefined}
                onClick={() => setOffen(g.monster.id)}
              >
                <span className="eintrag__name">
                  {bekannt.has(g.monster.id) ? (
                    <span className="gestalten__stern" title={t('gestalt.bekannt')} data-gestalt-bekannt>
                      ★{' '}
                    </span>
                  ) : null}
                  {g.monster.name[spr]}
                  {g.schwarm ? <span className="gestalten__marke">{t('gestalt.schwarm')}</span> : null}
                </span>
                <span className="eintrag__stelle">
                  {t('gestalt.hg')} {g.monster.hg} · {t('gestalt.rk')} {g.monster.rk} · {t('gestalt.tp')} {g.monster.tp} ·{' '}
                  {bewegungKurz(g, spr)}
                </span>
              </button>
              <label className="gestalten__vergleich" title={t('gestalt.vergleichen')}>
                <input
                  type="checkbox"
                  data-gestalt-vergleich={g.monster.id}
                  checked={vergleich.includes(g.monster.id)}
                  onChange={() => vergleiche(g.monster.id)}
                  aria-label={`${t('gestalt.vergleichen')}: ${g.monster.name[spr]}`}
                />
              </label>
            </li>
          ))}
        </ul>
      </nav>

      <main className="blatt">
        {imVergleich.length >= 2 ? (
          <Vergleich gestalten={imVergleich} spr={spr} weg={(id) => vergleiche(id)} oeffne={(id) => {
            setVergleich([]);
            setOffen(id);
          }} />
        ) : offenGestalt ? (
          <article data-gestalt-blatt={offenGestalt.monster.id}>
            <header className="regel__kopf">
              <span className="regel__art">{t('gestalt.tier')}</span>
              <h2>{offenGestalt.monster.name[spr]}</h2>
              {spr === 'de' ? <span className="regel__anders">{offenGestalt.monster.name.en}</span> : null}
            </header>
            <Wertekasten gestalt={offenGestalt} spr={spr} />
          </article>
        ) : (
          <div className="blatt__leer">
            <h2>{t('gestalt.leerTitel')}</h2>
            <p>{t('gestalt.leerSatz')}</p>
          </div>
        )}
      </main>
    </div>
  );
}

/** Zwei oder drei Gestalten nebeneinander: die Frage am Tisch ist meist „was schwimmt am besten?". */
function Vergleich({
  gestalten,
  spr,
  weg,
  oeffne
}: {
  readonly gestalten: readonly Gestalt[];
  readonly spr: Sprache;
  readonly weg: (id: string) => void;
  readonly oeffne: (id: string) => void;
}) {
  const zeilen: { name: string; wert: (g: Gestalt) => string; zahl?: (g: Gestalt) => number }[] = [
    { name: t('gestalt.hg'), wert: (g) => g.monster.hg, zahl: (g) => g.hg },
    { name: t('gestalt.rk'), wert: (g) => String(g.monster.rk), zahl: (g) => g.monster.rk },
    { name: t('gestalt.tp'), wert: (g) => `${g.monster.tp} (${g.monster.tpFormel[spr]})`, zahl: (g) => g.monster.tp },
    { name: t('gestalt.groesse'), wert: (g) => GROESSE_NAME[g.monster.groesse][spr] },
    ...BEWEGUNGSARTEN.map((a) => ({
      name: BEWEGUNGSART_NAME[a][spr],
      wert: (g: Gestalt) => (g.bewegung[a] !== undefined ? `${g.bewegung[a]} ft.` : '—'),
      zahl: (g: Gestalt) => g.bewegung[a] ?? 0
    })),
    ...SINNE.map((s) => ({
      name: SINN_NAME[s][spr],
      wert: (g: Gestalt) => (g.sinne[s] !== undefined ? `${g.sinne[s]} ft.` : '—'),
      zahl: (g: Gestalt) => g.sinne[s] ?? 0
    })),
    {
      name: t('gestalt.angriffe'),
      wert: (g) =>
        g.monster.abschnitte
          .find((a) => a.id === 'aktionen')
          ?.eintraege.map((e) => e.name[spr])
          .join(', ') ?? '—'
    }
  ];
  return (
    <section className="gestalten__vergleichsblatt" data-gestalt-vergleichsblatt>
      <h2>{t('gestalt.vergleich')}</h2>
      <table className="regel__tabelle">
        <thead>
          <tr>
            <th />
            {gestalten.map((g) => (
              <th key={g.monster.id}>
                <button type="button" className="verweis" onClick={() => oeffne(g.monster.id)}>
                  {g.monster.name[spr]}
                </button>{' '}
                <button type="button" className="knopf gestalten__weg" aria-label={t('gestalt.ausVergleich')} onClick={() => weg(g.monster.id)}>
                  ×
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => {
            // Hervorgehoben wird nur, wo sich die Gestalten unterscheiden.
            const zahlen = z.zahl ? gestalten.map(z.zahl) : [];
            const best = zahlen.length && new Set(zahlen).size > 1 ? Math.max(...zahlen) : null;
            return (
              <tr key={z.name}>
                <th scope="row">{z.name}</th>
                {gestalten.map((g) => (
                  <td key={g.monster.id} className={best && z.zahl && z.zahl(g) === best ? 'gestalten__best' : undefined}>
                    {z.wert(g)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const ABSCHNITT_NAME: Record<string, [string, string]> = {
  merkmale: ['Merkmale', 'Traits'],
  aktionen: ['Aktionen', 'Actions'],
  bonusaktionen: ['Bonusaktionen', 'Bonus Actions'],
  reaktionen: ['Reaktionen', 'Reactions'],
  legendaer: ['Legendäre Aktionen', 'Legendary Actions']
};

const ATTRIBUTE: Record<Sprache, readonly string[]> = {
  de: ['Stä', 'Ges', 'Kon', 'Int', 'Wei', 'Cha'],
  en: ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']
};

/**
 * Der ganze Wertekasten, woertlich. Dieselbe Form wie im Encounter
 * Creator (Katalog.tsx); die Werkzeuge haengen nicht voneinander ab.
 */
function Wertekasten({ gestalt, spr }: { readonly gestalt: Gestalt; readonly spr: Sprache }) {
  const m = gestalt.monster;
  const de = spr === 'de';
  const mod = (wert: number) => {
    const z = Math.floor((wert - 10) / 2);
    return z >= 0 ? `+${z}` : `−${-z}`;
  };
  return (
    <div className="wertekasten">
      <p className="wertekasten__art">{m.art[spr]}</p>
      <p>
        <b>{de ? 'RK' : 'AC'}</b> {m.rk} · <b>Initiative</b> {m.initiative >= 0 ? '+' : '−'}
        {Math.abs(m.initiative)} · <b>{de ? 'TP' : 'HP'}</b> {m.tp} ({m.tpFormel[spr]})
      </p>
      <p>
        <b>{de ? 'Bewegungsrate' : 'Speed'}</b> {m.bewegung[spr]}
      </p>
      <div className="wertekasten__attribute">
        {m.attribute.map((wert, i) => (
          <span key={ATTRIBUTE[spr][i]}>
            <b>{ATTRIBUTE[spr][i]}</b> {wert} ({mod(wert)})
          </span>
        ))}
      </div>
      {m.zeilen[spr].map((zeile) => (
        <p key={zeile} className="wertekasten__zeile">
          {zeile}
        </p>
      ))}
      <p className="wertekasten__zeile">
        <b>{de ? 'HG' : 'CR'}</b> {m.hg} ({m.ep.toLocaleString(de ? 'de-DE' : 'en-US')} {de ? 'EP' : 'XP'})
      </p>
      {m.abschnitte.map((a) => (
        <section key={a.id} className="wertekasten__abschnitt">
          <h5>{ABSCHNITT_NAME[a.id]?.[de ? 0 : 1] ?? a.id}</h5>
          {a.einleitung[spr] ? <p>{a.einleitung[spr]}</p> : null}
          {a.eintraege.map((e) => (
            <p key={e.name.en}>
              <b>
                <i>
                  {e.name[spr]}
                  {de ? ':' : '.'}
                </i>
              </b>{' '}
              {e.text[spr]}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
