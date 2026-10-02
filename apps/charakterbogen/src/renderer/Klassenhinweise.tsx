/**
 * Hinweise nach Klasse und Stufe (Rückmeldung): was die Klassentabellen des
 * SRD sagen, mit „Übernehmen" dort, wo der Bogen abweicht. Zugeklappt wird
 * pro Gerät gemerkt.
 */
import { useState } from 'react';
import { getLanguage, t } from './i18n';
import type { Werte } from '../shared/bogen';
import { klassenhinweise } from '../shared/klassenhinweise';

const ZU_SPEICHER = 'charakterbogen.hinweiseZu';

function leseZu(): boolean {
  try {
    return localStorage.getItem(ZU_SPEICHER) === '1';
  } catch {
    return false;
  }
}

export function Klassenhinweise({ w, aendere }: { w: Werte; aendere: (wie: (w: Werte) => Werte) => void }) {
  const [zu, setZu] = useState(leseZu);
  const hinweise = klassenhinweise(w, getLanguage() === 'de' ? 'de' : 'en');
  if (!hinweise.length) return null;
  const abweichend = hinweise.filter((h) => h.abweichung).length;
  return (
    <details
      className="kasten klassenhinweise"
      data-klassenhinweise
      open={!zu}
      onToggle={(e) => {
        const jetztZu = !e.currentTarget.open;
        setZu(jetztZu);
        try {
          localStorage.setItem(ZU_SPEICHER, jetztZu ? '1' : '0');
        } catch {
          // dann eben nur für jetzt
        }
      }}
    >
      <summary>
        <strong>{t('hinweise.titel')}</strong>{' '}
        <span className={abweichend ? 'klassenhinweise__zahl' : 'leise'}>
          {abweichend ? t('hinweise.abweichung', { n: abweichend }) : t('hinweise.passt')}
        </span>
      </summary>
      <ul>
        {hinweise.map((h) => (
          <li key={h.art} className={h.abweichung ? 'is-ab' : undefined} data-hinweis={h.art} data-abweichung={h.abweichung ? '1' : '0'}>
            <span>{h.text}</span>
            {h.abweichung && h.uebernehmen ? (
              <button type="button" className="knopf--klein" data-hinweis-uebernehmen={h.art} title={t('hinweise.uebernehmenTitel')} onClick={() => aendere(h.uebernehmen!)}>
                {t('hinweise.uebernehmen')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="leise klassenhinweise__quelle">{t('hinweise.quelle')}</p>
    </details>
  );
}
