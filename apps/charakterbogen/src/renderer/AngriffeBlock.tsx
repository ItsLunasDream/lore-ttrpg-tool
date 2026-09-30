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
import { Segment, Suchwahl, type Wahlpunkt } from './Bedienung';

/** Die SRD-Waffen fuer die Suchwahl, nach Art gruppiert und alphabetisch. */
export function waffenpunkte(i: 0 | 1): Wahlpunkt[] {
  return (['einfach', 'kriegs'] as const).flatMap((k) =>
    WAFFEN.filter((x) => x.kategorie === k)
      .slice()
      .sort((x, y) => x.name[i].localeCompare(y.name[i]))
      .map((x) => ({ id: x.id, name: x.name[i], info: `${x.wuerfel} ${x.art[i]}`, gruppe: t(k === 'einfach' ? 'waffe.einfach' : 'waffe.kriegs') }))
  );
}

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
  const waffenPunkte = waffenpunkte(i);
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
            <Suchwahl
              daten={{ 'data-angriff-waffe': '' }}
              punkte={waffenPunkte}
              wert={a.waffe ?? ''}
              leer={t('angriff.frei')}
              suche={t('waffe.suche')}
              knopf={waffe ? waffe.name[i] : t('angriff.frei')}
              aendern={(id) =>
                n !== null &&
                setze(
                  n,
                  id
                    ? { waffe: id, attribut: a.attribut ?? 'auto', geuebt: a.geuebt ?? true, magie: a.magie ?? 0 }
                    : { waffe: undefined, attribut: undefined, geuebt: undefined, magie: undefined, zweihaendig: undefined }
                )
              }
            />
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
            🎲 {t('angriff.wuerfeln.kurz')}
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
            <Segment
              klein
              label={t('angriff.attribut')}
              wert={a.attribut ?? 'auto'}
              optionen={(['auto', 'sta', 'ges'] as const).map((x) => ({ wert: x, text: t(`angriff.attribut.${x}`) }))}
              aendern={(v) => n !== null && setze(n, { attribut: v })}
            />
            <label className="schalter">
              <input type="checkbox" checked={a.geuebt !== false} onChange={(e) => n !== null && setze(n, { geuebt: e.target.checked })} />
              {t('angriff.geuebt')}
            </label>
            <Segment
              klein
              label={t('angriff.magie')}
              wert={a.magie ?? 0}
              optionen={[0, 1, 2, 3].map((m) => ({ wert: m, text: m === 0 ? `${t('angriff.magie')} —` : `+${m}` }))}
              aendern={(v) => n !== null && setze(n, { magie: v })}
            />
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
        <div className="angriffe__ziel">
          <span className="leise">{t('wurf.ziel')}</span>
          <Segment
            klein
            label={t('wurf.ziel')}
            wert={ziel}
            daten={{ 'data-wurf-ziel': '' }}
            optionen={(['nicht', 'alle', 'sl'] as const).map((x) => ({ wert: x, text: t(`wurf.${x}`) }))}
            aendern={setZiel}
          />
        </div>
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
