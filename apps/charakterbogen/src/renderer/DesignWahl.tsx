/**
 * Aussehen eines Bogens: Farbe als Farbtupfer, Papier als kleine Flaechen,
 * Schrift als Probezeile in der Schrift selbst. Alles ein Klick, keine Listen.
 */
import { useEffect, useRef, useState } from 'react';
import { getLanguage, t } from './i18n';
import type { Design } from '../shared/bogen';
import { FARBEN, PAPIERE, SCHRIFTEN, VORGABE_DESIGN, designVon } from '../shared/design';

export function DesignWahl({ design, aendern }: { design: Design | undefined; aendern: (wie: (d: Design) => Design) => void }) {
  const i = getLanguage() === 'de' ? 0 : 1;
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);
  const jetzt = designVon(design);
  const d: Design = { farbe: jetzt.farbe.id, papier: jetzt.papier.id, schrift: jetzt.schrift.id };

  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (rahmen.current && !rahmen.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('mousedown', zu);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('mousedown', zu);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  return (
    <div className="designwahl" ref={rahmen}>
      <button type="button" data-design-knopf aria-expanded={offen} onClick={() => setOffen((o) => !o)} title={t('design.titel')}>
        <span className="designwahl__tupfer" style={{ background: jetzt.papier.dunkel ? jetzt.farbe.dunkel : jetzt.farbe.hell }} aria-hidden="true" />
        {t('design')}
      </button>
      {offen ? (
        <div className="designwahl__tafel" role="dialog" aria-label={t('design.titel')} data-design>
          <h3>{t('design.farbe')}</h3>
          <div className="tupfer" role="radiogroup" aria-label={t('design.farbe')}>
            {FARBEN.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={f.id === d.farbe}
                aria-label={f.name[i]}
                title={f.name[i]}
                data-design-farbe={f.id}
                className={f.id === d.farbe ? 'ist-an' : ''}
                style={{ background: jetzt.papier.dunkel ? f.dunkel : f.hell }}
                onClick={() => aendern((x) => ({ ...x, farbe: f.id }))}
              />
            ))}
          </div>
          <h3>{t('design.papier')}</h3>
          <div className="papiere" role="radiogroup" aria-label={t('design.papier')}>
            {PAPIERE.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === d.papier}
                data-design-papier={p.id}
                className={p.id === d.papier ? 'ist-an' : ''}
                style={{ background: p.grund, color: p.text, borderColor: p.linie }}
                onClick={() => aendern((x) => ({ ...x, papier: p.id }))}
              >
                <span className="papiere__kasten" style={{ background: p.kasten, borderColor: p.linie }} />
                {p.name[i]}
              </button>
            ))}
          </div>
          <h3>{t('design.schrift')}</h3>
          <div className="schriften" role="radiogroup" aria-label={t('design.schrift')}>
            {SCHRIFTEN.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === d.schrift}
                data-design-schrift={s.id}
                className={s.id === d.schrift ? 'ist-an' : ''}
                onClick={() => aendern((x) => ({ ...x, schrift: s.id }))}
              >
                <span style={{ fontFamily: s.titel }} className="schriften__probe">
                  {t('design.probe')}
                </span>
                <span className="leise">{s.name}</span>
              </button>
            ))}
          </div>
          <div className="leiste">
            <span className="leiste__rest" />
            <button type="button" className="knopf--klein" onClick={() => aendern(() => ({ ...VORGABE_DESIGN }))}>
              ↺
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
