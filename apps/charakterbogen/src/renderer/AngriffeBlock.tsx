/**
 * Angriffe: mit SRD-Waffe gerechnet oder frei eingetragen, dazu die
 * ausgeruesteten Waffen aus dem Inventar. Jeder Angriff laesst sich
 * wuerfeln; im Raum geht der Wurf auf Wunsch an alle oder nur an die SL.
 */
import { useState } from 'react';
import { api } from './api';
import { getLanguage, t } from './i18n';
import type { Angriff, Werte } from '../shared/bogen';
import type { Schritt } from '../shared/live';
import { mitVorzeichen } from '../shared/regeln';
import { angriffswerte, WAFFEN, wuerfleAngriff, wurfZeile } from '../shared/waffen';

type Ziel = 'nicht' | 'alle' | 'sl';

interface Props {
  readonly w: Werte;
  readonly aendere: (wie: (w: Werte) => Werte, schritt?: Schritt) => void;
  /** Aus ausgeruesteten Waffen im Inventar; nur zum Ansehen und Wuerfeln. */
  readonly ausInventar: readonly Angriff[];
  readonly imRaum: boolean;
}

export function AngriffeBlock({ w, aendere, ausInventar, imRaum }: Props) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const i = sprache === 'de' ? 0 : 1;
  const [ziel, setZiel] = useState<Ziel>('alle');
  const [ergebnis, setErgebnis] = useState<{ schluessel: string; text: string; hinweis: string } | null>(null);

  const setze = (n: number, teil: Partial<Angriff>) =>
    aendere((x) => ({ ...x, angriffe: x.angriffe.map((a, m) => (m === n ? { ...a, ...teil } : a)) }));

  const wuerfle = (a: Angriff, schluessel: string) => {
    const werte = angriffswerte(w, a, sprache);
    const wurf = wuerfleAngriff(werte);
    const name = a.name.trim() || (werte.waffe ? werte.waffe.name[i] : t('angriff.ohneName'));
    const text = wurfZeile(name, werte, wurf, sprache);
    setErgebnis({ schluessel, text, hinweis: '' });
    if (!imRaum || ziel === 'nicht') return;
    void api.wurf(text, ziel).then((antwort) => {
      const hinweis =
        antwort === 'ok' ? t(ziel === 'sl' ? 'wurf.anSl' : 'wurf.anAlle') : antwort === 'selbst' ? t('wurf.selbst') : antwort === 'aus' ? '' : t('wurf.fehler');
      setErgebnis((alt) => (alt && alt.schluessel === schluessel ? { ...alt, hinweis } : alt));
    });
  };

  const zeile = (a: Angriff, schluessel: string, n: number | null) => {
    const werte = angriffswerte(w, a, sprache);
    const waffe = werte.waffe;
    const fest = n === null;
    return (
      <div className="angriff" key={schluessel} data-angriff={schluessel}>
        <div className="angriff__zeile">
          <input
            aria-label={t('angriff.name')}
            placeholder={waffe ? waffe.name[i] : t('angriff.name')}
            value={a.name}
            maxLength={80}
            readOnly={fest}
            onChange={(e) => n !== null && setze(n, { name: e.target.value })}
          />
          {fest ? (
            <span className="leise angriff__herkunft" title={t('angriff.ausInventar.titel')}>
              {t('angriff.ausInventar')}
            </span>
          ) : (
            <select
              aria-label={t('angriff.waffe')}
              data-angriff-waffe
              value={a.waffe ?? ''}
              onChange={(e) =>
                n !== null &&
                setze(
                  n,
                  e.target.value
                    ? { waffe: e.target.value, attribut: a.attribut ?? 'auto', geuebt: a.geuebt ?? true, magie: a.magie ?? 0 }
                    : { waffe: undefined, attribut: undefined, geuebt: undefined, magie: undefined, zweihaendig: undefined }
                )
              }
            >
              <option value="">{t('angriff.frei')}</option>
              {(['einfach', 'kriegs'] as const).map((k) => (
                <optgroup key={k} label={t(k === 'einfach' ? 'waffe.einfach' : 'waffe.kriegs')}>
                  {WAFFEN.filter((x) => x.kategorie === k)
                    .slice()
                    .sort((x, y) => x.name[i].localeCompare(y.name[i]))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name[i]}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
          {waffe ? (
            <span className="angriff__wert" data-angriff-bonus title={t('angriff.bonus')}>
              {werte.bonus !== null ? mitVorzeichen(werte.bonus) : '—'}
            </span>
          ) : (
            <input
              aria-label={t('angriff.bonus')}
              placeholder="+5"
              value={a.bonus}
              maxLength={20}
              onChange={(e) => n !== null && setze(n, { bonus: e.target.value })}
            />
          )}
          {waffe ? (
            <span className="angriff__wert" data-angriff-schaden>
              {werte.schaden} {werte.art}
            </span>
          ) : (
            <input
              aria-label={t('angriff.schaden')}
              placeholder="1W8+3"
              value={a.schaden}
              maxLength={60}
              onChange={(e) => n !== null && setze(n, { schaden: e.target.value })}
            />
          )}
          <button type="button" className="knopf--klein" data-wuerfeln={schluessel} title={t('angriff.wuerfeln')} onClick={() => wuerfle(a, schluessel)}>
            🎲
          </button>
          {n !== null ? (
            <button
              type="button"
              className="knopf--klein"
              aria-label={t('angriff.weg')}
              title={t('angriff.weg')}
              onClick={() => aendere((x) => ({ ...x, angriffe: x.angriffe.filter((_, m) => m !== n) }))}
            >
              ×
            </button>
          ) : (
            <span />
          )}
        </div>
        {waffe && !fest ? (
          <div className="angriff__optionen">
            <label>
              {t('angriff.attribut')}
              <select value={a.attribut ?? 'auto'} onChange={(e) => n !== null && setze(n, { attribut: e.target.value as Angriff['attribut'] })}>
                <option value="auto">{t('angriff.attribut.auto')}</option>
                <option value="sta">{t('angriff.attribut.sta')}</option>
                <option value="ges">{t('angriff.attribut.ges')}</option>
              </select>
            </label>
            <label className="schalter">
              <input type="checkbox" checked={a.geuebt !== false} onChange={(e) => n !== null && setze(n, { geuebt: e.target.checked })} />
              {t('angriff.geuebt')}
            </label>
            <label>
              {t('angriff.magie')}
              <select value={a.magie ?? 0} onChange={(e) => n !== null && setze(n, { magie: Number(e.target.value) })}>
                {[0, 1, 2, 3].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? '—' : `+${m}`}
                  </option>
                ))}
              </select>
            </label>
            {waffe.vielseitig ? (
              <label className="schalter">
                <input type="checkbox" checked={a.zweihaendig === true} onChange={(e) => n !== null && setze(n, { zweihaendig: e.target.checked })} />
                {t('angriff.zweihaendig', { wuerfel: waffe.vielseitig })}
              </label>
            ) : null}
          </div>
        ) : null}
        {waffe ? (
          <p className="leise angriff__info">
            {waffe.eigenschaften[i] !== '—' && waffe.eigenschaften[i] !== '−' ? `${waffe.eigenschaften[i]} · ` : ''}
            {t('angriff.meisterschaft')}: {waffe.meisterschaft[i]}
          </p>
        ) : null}
        {!fest ? (
          <input
            className="angriff__notiz"
            aria-label={t('angriff.notiz')}
            placeholder={t('angriff.notiz')}
            value={a.notiz}
            maxLength={200}
            onChange={(e) => n !== null && setze(n, { notiz: e.target.value })}
          />
        ) : null}
        {ergebnis && ergebnis.schluessel === schluessel ? (
          <p className="angriff__ergebnis" data-wurf-ergebnis aria-live="polite">
            {ergebnis.text}
            {ergebnis.hinweis ? <span className="leise"> · {ergebnis.hinweis}</span> : null}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="angriffe">
      {imRaum ? (
        <label className="angriffe__ziel">
          {t('wurf.ziel')}
          <select data-wurf-ziel value={ziel} onChange={(e) => setZiel(e.target.value as Ziel)}>
            <option value="nicht">{t('wurf.nicht')}</option>
            <option value="alle">{t('wurf.alle')}</option>
            <option value="sl">{t('wurf.sl')}</option>
          </select>
        </label>
      ) : null}
      {ausInventar.map((a) => zeile(a, `inv-${a.ausInventar}`, null))}
      {w.angriffe.map((a, n) => zeile(a, `a-${n}`, n))}
      <div className="leiste">
        <button
          type="button"
          className="knopf--klein"
          data-angriff-dazu
          onClick={() => aendere((x) => ({ ...x, angriffe: [...x.angriffe, { name: '', bonus: '', schaden: '', notiz: '' }] }))}
        >
          {t('angriff.dazu')}
        </button>
      </div>
    </div>
  );
}
