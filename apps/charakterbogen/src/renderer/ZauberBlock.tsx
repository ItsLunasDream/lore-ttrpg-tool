/**
 * Der Zauberteil eines Bogens: Zauberattribut mit SG und Angriffsbonus,
 * Plaetze je Grad, die Liste und das Hinzufuegen aus dem SRD.
 */
import { useEffect, useMemo, useState } from 'react';
import { ausblendenUnd } from '@suite/motion/dom';
import { api } from './api';
import type { Zauber, Zauberklasse } from '@suite/srd/zauber';
import { Segment } from './Bedienung';
import { useWurf } from './Wurf';
import { probe } from '../shared/proben';
import { getLanguage, t } from './i18n';
import type { Werte } from '../shared/bogen';
import { ATTRIBUTE, ATTRIBUT_NAMEN, mitVorzeichen, zauberAngriff, zauberSg } from '../shared/regeln';
import {
  KLASSEN,
  NACH_ID,
  freierPlatz,
  gradVon,
  istAngriffszauber,
  rettungswuerfeVon,
  klassenAusNamen,
  leereZauberei,
  nameVon,
  sortiert,
  sucheZauber,
  verbrauche,
  vorbereiteteAnzahl,
  wirkZeile,
  type Zauberei,
  type ZauberEintrag
} from '../shared/zauber';

interface Props {
  readonly w: Werte;
  readonly pb: number;
  readonly aendere: (wie: (w: Werte) => Werte) => void;
}

export function ZauberBlock({ w, pb, aendere }: Props) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const i = sprache === 'de' ? 0 : 1;
  const z = w.zauber;
  const [suchen, setSuchen] = useState(false);
  const [offen, setOffen] = useState<number | null>(null);
  const { zeige } = useWurf();

  if (!z) {
    return (
      <div className="zauber zauber--aus">
        <p className="leise">{t('zauber.keine')}</p>
        <button
          type="button"
          data-zauber-an
          onClick={() => {
            // Vorbelegt mit dem Attribut der ersten passenden Klasse.
            const klasse = klassenAusNamen(w.klassen.map((k) => k.name))[0];
            const attribut =
              klasse === 'magier' ? 'int' : klasse === 'kleriker' || klasse === 'druide' || klasse === 'waldlaeufer' ? 'wei' : klasse ? 'cha' : 'int';
            aendere((x) => ({ ...x, zauber: leereZauberei(attribut) }));
          }}
        >
          {t('zauber.an')}
        </button>
      </div>
    );
  }

  const setZ = (wie: (z: Zauberei) => Zauberei) => aendere((x) => (x.zauber ? { ...x, zauber: wie(x.zauber) } : x));
  const wert = w.attribute[z.attribut];
  const liste = sortiert(z.liste, sprache);
  const vorbereitet = vorbereiteteAnzahl(z);

  /**
   * Wirken (Rückmeldung): die Zeile erscheint in der Wurfanzeige unten rechts,
   * nicht oben im Bogen, wo man sie beim Zauberteil nicht sieht. Ohne freien
   * Platz wird gefragt; Angriffszauber würfeln den Zauberangriff gleich mit.
   */
  const wirke = (e: ZauberEintrag) => {
    const grad = gradVon(e);
    const name = nameVon(e, sprache);
    let platz: number | null = 0;
    if (grad > 0) {
      const frei = freierPlatz(z, grad);
      if (frei === null && !window.confirm(t('zauber.ohnePlatz', { name, grad }))) return;
      if (frei !== null) setZ((x) => verbrauche(x, frei));
      platz = frei;
    }
    const rettung = rettungswuerfeVon(e);
    zeige(wirkZeile(name, platz, sprache, rettung.length ? { attribute: rettung, sg: zauberSg(wert, pb) } : undefined));
    if (istAngriffszauber(e)) zeige(probe(`${name} · ${t('zauber.angriff')}`, zauberAngriff(wert, pb)).text);
  };

  return (
    <div className="zauber">
      <div className="raster raster--zauberkopf">
        <div className="feld">
          <span className="feld__label">{t('zauber.attribut')}</span>
          <Segment
            klein
            label={t('zauber.attribut')}
            wert={z.attribut}
            daten={{ 'data-feld': 'zauberattribut' }}
            optionen={ATTRIBUTE.map((a) => ({ wert: a, text: ATTRIBUT_NAMEN[a].kurz[i], titel: ATTRIBUT_NAMEN[a].lang[i] }))}
            aendern={(v) => setZ((x) => ({ ...x, attribut: v }))}
          />
        </div>
        <div className="kennzahl" data-zauber-sg>
          <span className="feld__label">{t('zauber.sg')}</span>
          <strong>{zauberSg(wert, pb)}</strong>
        </div>
        <div className="kennzahl">
          <span className="feld__label">{t('zauber.angriff')}</span>
          <strong>{mitVorzeichen(zauberAngriff(wert, pb))}</strong>
        </div>
        <label className="feld feld--zahl" title={t('zauber.vorbereitetHinweis')}>
          <span className="feld__label">{t('zauber.vorbereitet')}</span>
          <span className="vorbereitet" data-vorbereitet>
            {vorbereitet} /{' '}
            <input
              aria-label={t('zauber.maxVorbereitet')}
              inputMode="numeric"
              value={z.maxVorbereitet ?? ''}
              placeholder="—"
              onChange={(e) => {
                const roh = e.target.value.trim();
                const n = Number(roh);
                setZ((x) => ({ ...x, maxVorbereitet: roh === '' || !Number.isFinite(n) ? null : Math.max(0, Math.min(99, Math.round(n))) }));
              }}
            />
          </span>
        </label>
      </div>

      <h3>{t('zauber.plaetze')}</h3>
      <div className="plaetze">
        {z.plaetze.map((p) => (
          <div className="platz" key={p.grad}>
            <span className="leise">{p.grad}</span>
            <input
              aria-label={t('zauber.plaetzeGrad', { grad: p.grad })}
              data-platz-max={p.grad}
              inputMode="numeric"
              value={p.max}
              onChange={(e) => {
                const n = Math.max(0, Math.min(9, Math.round(Number(e.target.value) || 0)));
                setZ((x) => ({
                  ...x,
                  plaetze: x.plaetze.map((q) => (q.grad === p.grad ? { ...q, max: n, verbraucht: Math.min(q.verbraucht, n) } : q))
                }));
              }}
            />
            <span className="punkte">
              {Array.from({ length: p.max }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  className={n < p.verbraucht ? 'punkt punkt--weg' : 'punkt'}
                  data-platz={`${p.grad}-${n}`}
                  aria-label={t('zauber.platzUmschalten', { grad: p.grad })}
                  title={t('zauber.platzUmschalten', { grad: p.grad })}
                  onClick={() =>
                    setZ((x) => ({
                      ...x,
                      plaetze: x.plaetze.map((q) =>
                        q.grad === p.grad ? { ...q, verbraucht: n < q.verbraucht ? n : n + 1 } : q
                      )
                    }))
                  }
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <label className="schalter">
        <input type="checkbox" checked={z.kurzeRast} onChange={(e) => setZ((x) => ({ ...x, kurzeRast: e.target.checked }))} />
        <span title={t('zauber.paktHinweis')}>{t('zauber.pakt')}</span>
      </label>

      <h3>{t('zauber.liste')}</h3>
      {liste.length === 0 ? <p className="leise">{t('zauber.leer')}</p> : null}
      <ul className="zauberliste" data-zauberliste>
        {liste.map((e) => {
          const idx = z.liste.indexOf(e);
          const srd = e.srd ? NACH_ID.get(e.srd) : undefined;
          const grad = gradVon(e);
          const aufgeklappt = offen === idx;
          return (
            <li key={`${e.srd ?? e.eigen?.name}-${idx}`} className={aufgeklappt ? 'is-auf' : undefined}>
              <div className="zauberzeile">
                <input
                  type="checkbox"
                  aria-label={t('zauber.vorbereitet')}
                  title={grad === 0 ? t('zauber.trick') : t('zauber.vorbereitet')}
                  disabled={grad === 0 || e.immer}
                  checked={grad === 0 || e.immer || e.vorbereitet}
                  onChange={(ev) =>
                    setZ((x) => ({ ...x, liste: x.liste.map((y, m) => (m === idx ? { ...y, vorbereitet: ev.target.checked } : y)) }))
                  }
                />
                <span className="zauberzeile__grad">{grad === 0 ? t('zauber.trickKurz') : grad}</span>
                <button type="button" className="zauberzeile__name" onClick={() => setOffen(aufgeklappt ? null : idx)}>
                  {nameVon(e, sprache)}
                </button>
                <span className="marken">
                  {srd?.konzentration ? <span className="marke" title={t('zauber.konzentration')}>K</span> : null}
                  {srd?.ritual ? <span className="marke" title={t('zauber.ritual')}>R</span> : null}
                  {e.immer ? <span className="marke" title={t('zauber.immer')}>★</span> : null}
                </span>
                <span className="leise zauberzeile__info">
                  {srd ? `${srd.eigenschaften[sprache].zeit} · ${srd.eigenschaften[sprache].reichweite}` : e.herkunft}
                </span>
                <button type="button" className="knopf--klein" data-wirken onClick={() => wirke(e)}>
                  {t('zauber.wirken')}
                </button>
              </div>
              {aufgeklappt ? (
                <div className="zauberdetail">
                  {srd ? (
                    <SrdZauberText srd={srd} sprache={sprache} />
                  ) : e.eigen ? (
                    <>
                    <div className="leiste">
                      <input
                        aria-label={t('zauber.name')}
                        value={e.eigen.name}
                        maxLength={80}
                        onChange={(ev) =>
                          setZ((x) => ({
                            ...x,
                            liste: x.liste.map((y, m) => (m === idx && y.eigen ? { ...y, eigen: { ...y.eigen, name: ev.target.value } } : y))
                          }))
                        }
                      />
                      <Segment
                        klein
                        label={t('zauber.grad')}
                        wert={e.eigen.grad}
                        optionen={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => ({
                          wert: g,
                          text: g === 0 ? t('zauber.trickKurz') : String(g),
                          titel: g === 0 ? t('zauber.tricks') : t('zauber.gradN', { grad: g })
                        }))}
                        aendern={(g) =>
                          setZ((x) => ({
                            ...x,
                            liste: x.liste.map((y, m) => (m === idx && y.eigen ? { ...y, eigen: { ...y.eigen, grad: g } } : y))
                          }))
                        }
                      />
                    </div>
                    <textarea
                      rows={4}
                      value={e.eigen.text}
                      aria-label={t('zauber.text')}
                      onChange={(ev) =>
                        setZ((x) => ({
                          ...x,
                          liste: x.liste.map((y, m) => (m === idx && y.eigen ? { ...y, eigen: { ...y.eigen, text: ev.target.value } } : y))
                        }))
                      }
                    />
                    </>
                  ) : null}
                  <div className="leiste">
                    <label className="schalter">
                      <input
                        type="checkbox"
                        checked={e.immer}
                        onChange={(ev) =>
                          setZ((x) => ({ ...x, liste: x.liste.map((y, m) => (m === idx ? { ...y, immer: ev.target.checked } : y)) }))
                        }
                      />
                      <span>{t('zauber.immer')}</span>
                    </label>
                    <input
                      aria-label={t('zauber.herkunft')}
                      placeholder={t('zauber.herkunft')}
                      value={e.herkunft}
                      maxLength={80}
                      onChange={(ev) =>
                        setZ((x) => ({ ...x, liste: x.liste.map((y, m) => (m === idx ? { ...y, herkunft: ev.target.value } : y)) }))
                      }
                    />
                    <button
                      type="button"
                      className="knopf--klein knopf--gefahr"
                      onClick={(ev) =>
                        ausblendenUnd(ev.currentTarget, () => {
                          setZ((x) => ({ ...x, liste: x.liste.filter((_, m) => m !== idx) }));
                          setOffen(null);
                        })
                      }
                    >
                      {t('zauber.weg')}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="leiste">
        <button type="button" className="knopf--klein" data-zauber-suchen onClick={() => setSuchen((s) => !s)}>
          {t('zauber.dazu')}
        </button>
        <button
          type="button"
          className="knopf--klein"
          onClick={() => {
            setZ((x) => ({ ...x, liste: [...x.liste, { eigen: { name: t('zauber.eigenName'), grad: 1, text: '' }, vorbereitet: false, immer: false, herkunft: '' }] }));
            setOffen(z.liste.length);
          }}
        >
          {t('zauber.eigen')}
        </button>
        <span className="leiste__rest" />
        <button
          type="button"
          className="knopf--klein knopf--gefahr"
          onClick={() => {
            if (z.liste.length && !window.confirm(t('zauber.ausSicher'))) return;
            aendere((x) => {
              const { zauber: _weg, ...rest } = x;
              return rest;
            });
          }}
        >
          {t('zauber.aus')}
        </button>
      </div>

      {suchen ? (
        <ZauberSuche
          vorhanden={new Set(z.liste.map((e) => e.srd).filter((x): x is string => Boolean(x)))}
          eigeneDrin={new Set(z.liste.map((e) => e.eigen?.name).filter((x): x is string => Boolean(x)))}
          klassen={klassenAusNamen(w.klassen.map((k) => k.name))}
          dazu={(id) => setZ((x) => ({ ...x, liste: [...x.liste, { srd: id, vorbereitet: false, immer: false, herkunft: '' }] }))}
          dazuEigen={(h) =>
            setZ((x) => ({ ...x, liste: [...x.liste, { eigen: { name: h.name, grad: h.grad, text: h.text }, vorbereitet: false, immer: false, herkunft: 'Homebrew' }] }))
          }
          schliessen={() => setSuchen(false)}
        />
      ) : null}
    </div>
  );
}

/** Ein eigener Zauber aus dem Homebrew Creator, wie die Huelle ihn liefert. */
interface HomebrewZauber {
  id: string;
  name: string;
  grad: number;
  text: string;
}

function ZauberSuche({
  vorhanden,
  eigeneDrin,
  klassen,
  dazu,
  dazuEigen,
  schliessen
}: {
  vorhanden: ReadonlySet<string>;
  eigeneDrin: ReadonlySet<string>;
  klassen: readonly Zauberklasse[];
  dazu: (id: string) => void;
  dazuEigen: (h: HomebrewZauber) => void;
  schliessen: () => void;
}) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const i = sprache === 'de' ? 0 : 1;
  const [anfrage, setAnfrage] = useState('');
  const [auf, setAuf] = useState<string | null>(null);
  const [grad, setGrad] = useState<number | null>(null);
  const [klasse, setKlasse] = useState<Zauberklasse | null>(klassen[0] ?? null);
  const treffer = useMemo(() => sucheZauber(anfrage, { grad, klasse }, sprache).slice(0, 80), [anfrage, grad, klasse, sprache]);
  // Eigene Zauber aus dem Homebrew Creator (docs/homebrew-creator.md); ohne Huelle bleibt die Liste leer.
  const [homebrew, setHomebrew] = useState<HomebrewZauber[]>([]);
  useEffect(() => {
    void (api.quellen.homebrewZauber?.() ?? Promise.resolve([])).then(setHomebrew, () => setHomebrew([]));
  }, []);
  const eigeneTreffer = useMemo(() => {
    const q = anfrage.trim().toLowerCase();
    return homebrew.filter((h) => (grad === null || h.grad === grad) && (!q || h.name.toLowerCase().includes(q) || h.text.toLowerCase().includes(q)));
  }, [homebrew, anfrage, grad]);
  return (
    <div className="zaubersuche" data-zaubersuche>
      <div className="leiste">
        <input
          autoFocus
          type="search"
          className="suche"
          data-zauber-anfrage
          placeholder={t('zauber.suchen')}
          value={anfrage}
          onChange={(e) => setAnfrage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') schliessen();
          }}
        />
        <button type="button" className="knopf--klein" onClick={schliessen}>
          {t('schliessen')}
        </button>
      </div>
      <div className="zaubersuche__filter">
        <Segment
          klein
          label={t('zauber.grad')}
          wert={grad === null ? 'alle' : String(grad)}
          optionen={[
            { wert: 'alle', text: t('zauber.alleGrade') },
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => ({
              wert: String(g),
              text: g === 0 ? t('zauber.trickKurz') : String(g),
              titel: g === 0 ? t('zauber.tricks') : t('zauber.gradN', { grad: g })
            }))
          ]}
          aendern={(v) => setGrad(v === 'alle' ? null : Number(v))}
        />
        <Segment
          klein
          label={t('klasse')}
          wert={klasse ?? 'alle'}
          optionen={[{ wert: 'alle', text: t('zauber.alleKlassen') }, ...KLASSEN.map((k) => ({ wert: k.id as string, text: k.name[i] }))]}
          aendern={(v) => setKlasse(v === 'alle' ? null : (v as Zauberklasse))}
        />
      </div>
      <ul className="zaubertreffer">
        {eigeneTreffer.map((h) => (
          <li key={`hb-${h.id}`} data-homebrew-zauber={h.id}>
            <span className="zauberzeile__grad">{h.grad === 0 ? t('zauber.trickKurz') : h.grad}</span>
            <button type="button" className="zauberzeile__name" aria-expanded={auf === `hb-${h.id}`} title={t('zauber.details')} onClick={() => setAuf(auf === `hb-${h.id}` ? null : `hb-${h.id}`)}>
              {h.name}
            </button>
            <span className="leise">Homebrew</span>
            <button type="button" className="knopf--klein" data-zauber-dazu-eigen={h.id} disabled={eigeneDrin.has(h.name)} onClick={() => dazuEigen(h)}>
              {eigeneDrin.has(h.name) ? t('zauber.drin') : '+'}
            </button>
            {auf === `hb-${h.id}` ? (
              <div className="zauberdetail zaubertreffer__detail">
                <p style={{ whiteSpace: 'pre-wrap' }}>{h.text || '—'}</p>
              </div>
            ) : null}
          </li>
        ))}
        {treffer.map((s) => (
          <li key={s.id} className={auf === s.id ? 'is-auf' : undefined}>
            <span className="zauberzeile__grad">{s.grad === 0 ? t('zauber.trickKurz') : s.grad}</span>
            {/* Rückmeldung: auch in der Liste der SRD-Zauber die Beschreibung sehen. */}
            <button
              type="button"
              className="zauberzeile__name"
              data-zauber-info={s.id}
              aria-expanded={auf === s.id}
              title={t('zauber.details')}
              onClick={() => setAuf(auf === s.id ? null : s.id)}
            >
              {s.name[sprache]}
            </button>
            <span className="leise">{s.eigenschaften[sprache].zeit}</span>
            <button
              type="button"
              className="knopf--klein"
              data-zauber-dazu={s.id}
              disabled={vorhanden.has(s.id)}
              onClick={() => dazu(s.id)}
            >
              {vorhanden.has(s.id) ? t('zauber.drin') : '+'}
            </button>
            {auf === s.id ? (
              <div className="zauberdetail zaubertreffer__detail" data-zauber-detail={s.id}>
                <p className="leise">{s.eigenschaften[sprache].reichweite}</p>
                <SrdZauberText srd={s} sprache={sprache} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {treffer.length === 0 && eigeneTreffer.length === 0 ? <p className="leise">{t('liste.nichts')}</p> : null}
    </div>
  );
}

/** Beschreibung eines SRD-Zaubers: Zeile mit Grad, Komponenten und Dauer, dann der Text. */
function SrdZauberText({ srd, sprache }: { srd: Zauber; sprache: 'de' | 'en' }) {
  return (
    <>
      <p className="leise">
        {srd.gradzeile[sprache]} · {srd.eigenschaften[sprache].komponenten} · {srd.eigenschaften[sprache].dauer}
      </p>
      {srd.bloecke[sprache].map((b, n) =>
        b.typ === 'tabelle' ? (
          <table key={n}>
            <thead>
              <tr>
                {b.kopf.map((k, m) => (
                  <th key={m}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.reihen.map((r, m) => (
                <tr key={m}>
                  {r.map((c, o) => (
                    <td key={o}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : b.typ === 'liste' ? (
          <ul key={n}>
            {b.eintraege.map((x, m) => (
              <li key={m}>{x}</li>
            ))}
          </ul>
        ) : (
          <p key={n}>{b.text}</p>
        )
      )}
    </>
  );
}
