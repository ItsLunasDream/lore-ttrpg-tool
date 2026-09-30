/**
 * Inventar und Geld eines Bogens. Fuer Figuren und Gruppeninventare gleich;
 * Ausgeruestet, Eingestimmt und Traglast gibt es nur bei Figuren.
 */
import { useState } from 'react';
import { api } from './api';
import { getLanguage, t } from './i18n';
import type { Kachel } from '../shared/ablage';
import type { Bogen, Muenzen } from '../shared/bogen';
import {
  MUENZARTEN,
  MUENZ_NAMEN,
  gewichtAnzeige,
  gewichtAusEingabe,
  gewichtFuerEingabe,
  inGold,
  neuerGegenstand,
  rechneUm,
  summen,
  type Gegenstand,
  type Muenzart
} from '../shared/inventar';
import { leseBetrag } from '../shared/bogen';
import { traglastLb } from '../shared/regeln';

interface Props {
  readonly bogen: Bogen;
  readonly andere: readonly Kachel[];
  readonly aendere: (wie: (b: Bogen) => Bogen) => void;
  /** Vor einer Uebergabe: den offenen Stand sicher auf die Platte bringen. */
  readonly speichereJetzt: () => Promise<void>;
  /** Nach einer Uebergabe: die geschriebenen Boegen uebernehmen. */
  readonly uebernimm: (boegen: readonly Bogen[]) => void;
  readonly setMeldung: (text: string) => void;
  readonly setFehler: (text: string) => void;
}

function gold(n: number, sprache: 'de' | 'en'): string {
  return `${n.toLocaleString(sprache === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 })} ${sprache === 'de' ? 'GM' : 'GP'}`;
}

export function InventarBlock({ bogen, andere, aendere, speichereJetzt, uebernimm, setMeldung, setFehler }: Props) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const i = sprache === 'de' ? 0 : 1;
  const figur = bogen.art === 'figur';
  const s = summen(bogen.gegenstaende, bogen.muenzen, bogen.muenzgewicht);
  const [offen, setOffen] = useState<string | null>(null);
  const [geben, setGeben] = useState<{ id: string; anzahl: number; an: string } | null>(null);
  const [geldGeben, setGeldGeben] = useState<{ betrag: Partial<Muenzen>; an: string } | null>(null);
  const [aufteilen, setAufteilen] = useState<Set<string> | null>(null);
  const ziele = andere.filter((k) => k.id !== bogen.id);
  const figuren = ziele.filter((k) => k.art === 'figur');

  const setG = (id: string, wie: (g: Gegenstand) => Gegenstand) =>
    aendere((b) => ({ ...b, gegenstaende: b.gegenstaende.map((g) => (g.id === id ? wie(g) : g)) }));

  const fuehreAus = async (arbeit: () => Promise<{ ok: boolean; boegen: Bogen[]; text: string }>, erfolg: string) => {
    await speichereJetzt();
    const antwort = await arbeit();
    if (antwort.ok) {
      uebernimm(antwort.boegen);
      setMeldung(erfolg);
    } else setFehler(antwort.text || t('geben.geht.nicht'));
  };

  const traglast = figur && bogen.werte ? traglastLb(bogen.werte.attribute.sta) : null;

  return (
    <div className="inventar">
      <h3>{t('geld')}</h3>
      <div className="muenzen">
        {MUENZARTEN.map((art) => (
          <Muenzfeld
            key={art}
            art={art}
            wert={bogen.muenzen[art]}
            aendern={(n) => aendere((b) => ({ ...b, muenzen: { ...b.muenzen, [art]: n } }))}
          />
        ))}
        <div className="kennzahl" data-geld-summe>
          <span className="feld__label">{t('geld.summe')}</span>
          <strong>{gold(inGold(bogen.muenzen), sprache)}</strong>
        </div>
      </div>
      <div className="leiste">
        <button type="button" className="knopf--klein" title={t('umrechnen.wenigeHinweis')} onClick={() => aendere((b) => ({ ...b, muenzen: rechneUm(b.muenzen, 'wenige') }))}>
          {t('umrechnen.wenige')}
        </button>
        <button type="button" className="knopf--klein" onClick={() => aendere((b) => ({ ...b, muenzen: rechneUm(b.muenzen, 'gold') }))}>
          {t('umrechnen.gold')}
        </button>
        {ziele.length ? (
          <button type="button" className="knopf--klein" data-geld-geben onClick={() => setGeldGeben({ betrag: {}, an: ziele[0].id })}>
            {t('geld.geben')}
          </button>
        ) : null}
        {!figur && figuren.length ? (
          <button type="button" className="knopf--klein" data-aufteilen onClick={() => setAufteilen(new Set(figuren.map((k) => k.id)))}>
            {t('aufteilen')}
          </button>
        ) : null}
        <label className="schalter">
          <input type="checkbox" checked={bogen.muenzgewicht} onChange={(e) => aendere((b) => ({ ...b, muenzgewicht: e.target.checked }))} />
          <span title={t('muenzgewicht.hinweis')}>{t('muenzgewicht')}</span>
        </label>
      </div>

      {geldGeben ? (
        <div className="dialogzeile" data-geld-dialog>
          {MUENZARTEN.map((art) => (
            <label key={art} className="feld feld--zahl">
              <span className="feld__label">{MUENZ_NAMEN[art].kurz[i]}</span>
              <input
                inputMode="numeric"
                data-geld-betrag={art}
                value={geldGeben.betrag[art] ?? ''}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(bogen.muenzen[art], Math.floor(Number(e.target.value) || 0)));
                  setGeldGeben((g) => (g ? { ...g, betrag: { ...g.betrag, [art]: n } } : g));
                }}
              />
            </label>
          ))}
          <ZielWahl ziele={ziele} wert={geldGeben.an} aendern={(an) => setGeldGeben((g) => (g ? { ...g, an } : g))} />
          <button
            type="button"
            className="knopf--haupt"
            data-geld-ok
            onClick={() => {
              const g = geldGeben;
              setGeldGeben(null);
              const an = ziele.find((k) => k.id === g.an)?.name ?? '';
              void fuehreAus(() => api.sammlung.uebergib(bogen.id, g.an, { art: 'geld', betrag: g.betrag }), t('geben.fertig', { an }));
            }}
          >
            {t('geben')}
          </button>
          <button type="button" onClick={() => setGeldGeben(null)}>
            {t('abbrechen')}
          </button>
        </div>
      ) : null}

      {aufteilen ? (
        <div className="dialogzeile" data-aufteilen-dialog>
          <span>{t('aufteilen.auf')}</span>
          {figuren.map((k) => (
            <label key={k.id} className="schalter">
              <input
                type="checkbox"
                checked={aufteilen.has(k.id)}
                onChange={(e) =>
                  setAufteilen((alt) => {
                    const neu = new Set(alt);
                    if (e.target.checked) neu.add(k.id);
                    else neu.delete(k.id);
                    return neu;
                  })
                }
              />
              <span>{k.name}</span>
            </label>
          ))}
          <button
            type="button"
            className="knopf--haupt"
            data-aufteilen-ok
            disabled={aufteilen.size === 0}
            onClick={() => {
              const an = [...aufteilen];
              setAufteilen(null);
              void fuehreAus(() => api.sammlung.aufteilen(bogen.id, an), t('aufteilen.fertig', { n: an.length }));
            }}
          >
            {t('aufteilen')}
          </button>
          <button type="button" onClick={() => setAufteilen(null)}>
            {t('abbrechen')}
          </button>
        </div>
      ) : null}

      <h3>{t('gegenstaende')}</h3>
      {bogen.gegenstaende.length === 0 ? <p className="leise">{t('gegenstaende.leer')}</p> : null}
      <div className="gegenstaende" data-gegenstaende>
        {bogen.gegenstaende.length ? (
          <div className={`gegenstand__kopf leise ${figur ? '' : 'gegenstand--gruppe'}`}>
            <span>{t('gegenstand.name')}</span>
            <span>{t('gegenstand.anzahl')}</span>
            <span>{t('gegenstand.gewicht', { einheit: sprache === 'de' ? 'kg' : 'lb' })}</span>
            <span>{t('gegenstand.wert', { einheit: sprache === 'de' ? 'GM' : 'GP' })}</span>
            {figur ? <span title={t('gegenstand.ausgeruestet')}>⚔</span> : null}
            {figur ? <span title={t('gegenstand.eingestimmt')}>✦</span> : null}
            <span />
          </div>
        ) : null}
        {bogen.gegenstaende.map((g) => (
          <div key={g.id} className="gegenstand">
            <div className={`gegenstand__zeile ${figur ? '' : 'gegenstand--gruppe'}`}>
              <input
                aria-label={t('gegenstand.name')}
                data-gegenstand-name={g.id}
                value={g.name}
                maxLength={120}
                onChange={(e) => setG(g.id, (x) => ({ ...x, name: e.target.value }))}
              />
              <input
                aria-label={t('gegenstand.anzahl')}
                inputMode="numeric"
                value={g.anzahl}
                onChange={(e) => setG(g.id, (x) => ({ ...x, anzahl: Math.max(1, Math.min(999999, Math.floor(Number(e.target.value) || 1))) }))}
              />
              <Kommazahl
                label={t('gegenstand.gewicht', { einheit: sprache === 'de' ? 'kg' : 'lb' })}
                wert={gewichtFuerEingabe(g.gewicht, sprache)}
                aendern={(text) => setG(g.id, (x) => ({ ...x, gewicht: gewichtAusEingabe(text, sprache) }))}
              />
              <Kommazahl
                label={t('gegenstand.wert', { einheit: sprache === 'de' ? 'GM' : 'GP' })}
                wert={g.wert === null ? '' : String(g.wert).replace('.', sprache === 'de' ? ',' : '.')}
                aendern={(text) => {
                  const n = Number(text.trim().replace(',', '.'));
                  setG(g.id, (x) => ({ ...x, wert: text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n }));
                }}
              />
              {figur ? (
                <input
                  type="checkbox"
                  aria-label={t('gegenstand.ausgeruestet')}
                  checked={g.ausgeruestet}
                  onChange={(e) => setG(g.id, (x) => ({ ...x, ausgeruestet: e.target.checked }))}
                />
              ) : null}
              {figur ? (
                <input
                  type="checkbox"
                  aria-label={t('gegenstand.eingestimmt')}
                  checked={g.eingestimmt}
                  onChange={(e) => {
                    const an = e.target.checked;
                    if (an && s.eingestimmt >= 3) setMeldung(t('eingestimmt.warnung'));
                    setG(g.id, (x) => ({ ...x, eingestimmt: an }));
                  }}
                />
              ) : null}
              <button type="button" className="knopf--klein" aria-label={t('gegenstand.mehr')} onClick={() => setOffen(offen === g.id ? null : g.id)}>
                {offen === g.id ? '▴' : '▾'}
              </button>
            </div>
            {offen === g.id ? (
              <div className="gegenstand__detail">
                <textarea
                  rows={3}
                  aria-label={t('gegenstand.beschreibung')}
                  placeholder={t('gegenstand.beschreibung')}
                  value={g.beschreibung}
                  onChange={(e) => setG(g.id, (x) => ({ ...x, beschreibung: e.target.value }))}
                />
                <div className="leiste">
                  {ziele.length ? (
                    geben && geben.id === g.id ? (
                      <>
                        <input
                          aria-label={t('gegenstand.anzahl')}
                          inputMode="numeric"
                          className="schmal"
                          value={geben.anzahl}
                          onChange={(e) =>
                            setGeben((x) => (x ? { ...x, anzahl: Math.max(1, Math.min(g.anzahl, Math.floor(Number(e.target.value) || 1))) } : x))
                          }
                        />
                        <ZielWahl ziele={ziele} wert={geben.an} aendern={(an) => setGeben((x) => (x ? { ...x, an } : x))} />
                        <button
                          type="button"
                          className="knopf--haupt knopf--klein"
                          data-geben-ok
                          onClick={() => {
                            const x = geben;
                            setGeben(null);
                            setOffen(null);
                            const an = ziele.find((k) => k.id === x.an)?.name ?? '';
                            void fuehreAus(
                              () => api.sammlung.uebergib(bogen.id, x.an, { art: 'gegenstand', gegenstandId: g.id, anzahl: x.anzahl }),
                              t('geben.fertig', { an })
                            );
                          }}
                        >
                          {t('geben')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="knopf--klein" data-geben={g.id} onClick={() => setGeben({ id: g.id, anzahl: g.anzahl, an: ziele[0].id })}>
                        {t('geben.an')}
                      </button>
                    )
                  ) : null}
                  <span className="leiste__rest" />
                  <button
                    type="button"
                    className="knopf--klein knopf--gefahr"
                    onClick={() => aendere((b) => ({ ...b, gegenstaende: b.gegenstaende.filter((x) => x.id !== g.id) }))}
                  >
                    {t('loeschen')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="knopf--klein"
        data-gegenstand-dazu
        onClick={() => {
          const neu = neuerGegenstand('');
          aendere((b) => ({ ...b, gegenstaende: [...b.gegenstaende, neu] }));
          setOffen(neu.id);
          window.setTimeout(() => (document.querySelector(`[data-gegenstand-name="${neu.id}"]`) as HTMLInputElement | null)?.focus(), 30);
        }}
      >
        {t('gegenstand.dazu')}
      </button>

      <p className="summen" data-summen>
        <span>
          {t('summe.gewicht')}: {s.gewichtUnvollstaendig ? `${t('mindestens')} ` : ''}
          {gewichtAnzeige(s.gewicht, sprache)}
          {traglast !== null ? ` / ${gewichtAnzeige(traglast, sprache)}` : ''}
        </span>
        <span>
          {t('summe.wert')}: {s.wertUnvollstaendig ? `${t('mindestens')} ` : ''}
          {gold(s.wert, sprache)}
        </span>
        {figur ? (
          <span className={s.eingestimmt > 3 ? 'stoerung' : undefined}>
            {t('eingestimmt')}: {s.eingestimmt} / 3
          </span>
        ) : null}
      </p>
      {traglast !== null && s.gewicht > traglast ? <p className="stoerung">{t('traglast.ueber')}</p> : null}

      {bogen.verlauf.length ? (
        <details className="verlauf">
          <summary>{t('verlauf')}</summary>
          <ul>
            {bogen.verlauf.slice(0, 50).map((v, n) => (
              <li key={n}>
                <span className="leise">{v.zeit ? new Date(v.zeit).toLocaleString(sprache === 'de' ? 'de-DE' : 'en-US') : ''}</span> {v.text}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ZielWahl({ ziele, wert, aendern }: { ziele: readonly Kachel[]; wert: string; aendern: (id: string) => void }) {
  return (
    <select aria-label={t('geben.an')} data-ziel value={wert} onChange={(e) => aendern(e.target.value)}>
      {ziele.map((k) => (
        <option key={k.id} value={k.id}>
          {k.art === 'gruppe' ? `▣ ${k.name}` : k.name}
        </option>
      ))}
    </select>
  );
}

/** Ein Muenzfeld: Zahl, oder +37 / -5 als Rechnung auf den alten Wert (Enter). */
function Muenzfeld({ art, wert, aendern }: { art: Muenzart; wert: number; aendern: (n: number) => void }) {
  const i = getLanguage() === 'de' ? 0 : 1;
  const [text, setText] = useState<string | null>(null);
  const uebernimm = () => {
    if (text === null) return;
    const roh = text.trim();
    if (/^[+\-−]/.test(roh)) {
      // „+37" legt dazu, „-5" nimmt weg; leseBetrag liest +x als positiv.
      const b = leseBetrag(roh);
      if (b !== null) aendern(Math.max(0, wert + b));
    } else if (roh !== '') {
      const n = Number(roh);
      if (Number.isFinite(n)) aendern(Math.max(0, Math.floor(n)));
    }
    setText(null);
  };
  return (
    <label className="feld feld--zahl muenze" title={MUENZ_NAMEN[art].lang[i]}>
      <span className="feld__label">{MUENZ_NAMEN[art].kurz[i]}</span>
      <input
        data-muenze={art}
        inputMode="numeric"
        value={text ?? String(wert)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={uebernimm}
        onKeyDown={(e) => {
          if (e.key === 'Enter') uebernimm();
          if (e.key === 'Escape') setText(null);
        }}
      />
    </label>
  );
}

/** Kommazahl, die waehrend des Tippens frei bleibt und beim Verlassen uebernommen wird. */
function Kommazahl({ label, wert, aendern }: { label: string; wert: string; aendern: (text: string) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      placeholder="?"
      value={text ?? wert}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== null) aendern(text);
        setText(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
