/**
 * Würfeln vom Bogen (Rückmeldung): ein Klick auf Name oder Bonus einer
 * Fertigkeit, eines Attributs, eines Rettungswurfs oder auf die Initiative.
 *
 * Das Ergebnis steht unten rechts im Bogen. Im Raum geht es, je nach Wahl,
 * an alle, nur an die SL oder an niemanden (gemerkt pro Gerät).
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { api } from './api';
import { t } from './i18n';
import { probe } from '../shared/proben';

type Ziel = 'nicht' | 'alle' | 'sl';
const ZIEL_SPEICHER = 'charakterbogen.wurfziel';

interface Kontext {
  /** Würfelt d20 + Bonus und zeigt das Ergebnis. */
  wuerfle(name: string, bonus: number): void;
  /** Zeigt eine fertige Zeile (z. B. Todesrettungswurf) und schickt sie in den Raum. */
  zeige(text: string): void;
}

const WurfKontext = createContext<Kontext>({ wuerfle: () => undefined, zeige: () => undefined });

export function useWurf(): Kontext {
  return useContext(WurfKontext);
}

function leseZiel(): Ziel {
  try {
    const z = localStorage.getItem(ZIEL_SPEICHER);
    return z === 'nicht' || z === 'sl' ? z : 'alle';
  } catch {
    return 'alle';
  }
}

export function WurfBuehne({ imRaum, children }: { imRaum: boolean; children: ReactNode }) {
  const [zeile, setZeile] = useState<{ text: string; hinweis: string; nr: number } | null>(null);
  const [ziel, setZielZustand] = useState<Ziel>(leseZiel);
  const setZiel = (z: Ziel) => {
    setZielZustand(z);
    try {
      localStorage.setItem(ZIEL_SPEICHER, z);
    } catch {
      // ohne Speicher eben nur für jetzt
    }
  };

  const zeige = useCallback(
    (text: string) => {
      const nr = Date.now();
      setZeile({ text, hinweis: '', nr });
      if (!imRaum || ziel === 'nicht') return;
      void api.wurf(text, ziel).then((antwort) => {
        const hinweis =
          antwort === 'ok' ? t(ziel === 'sl' ? 'wurf.anSl' : 'wurf.anAlle') : antwort === 'selbst' ? t('wurf.selbst') : antwort === 'aus' ? '' : t('wurf.fehler');
        setZeile((alt) => (alt && alt.nr === nr ? { ...alt, hinweis } : alt));
      });
    },
    [imRaum, ziel]
  );
  const wuerfle = useCallback((name: string, bonus: number) => zeige(probe(name, bonus).text), [zeige]);

  return (
    <WurfKontext.Provider value={{ wuerfle, zeige }}>
      {children}
      {zeile ? (
        <div className="wurfanzeige" role="status" data-wurfanzeige>
          <span data-wurf-text>{zeile.text.replace(/^🎲\s*/, '')}</span>
          {zeile.hinweis ? <span className="leise"> · {zeile.hinweis}</span> : null}
          {imRaum ? (
            <span className="wurfanzeige__ziel" role="radiogroup" aria-label={t('wurf.ziel')}>
              {(['nicht', 'alle', 'sl'] as const).map((z) => (
                <button key={z} type="button" role="radio" aria-checked={ziel === z} className={ziel === z ? 'ist-an' : ''} onClick={() => setZiel(z)}>
                  {t(`wurf.${z}`)}
                </button>
              ))}
            </span>
          ) : null}
          <button type="button" className="knopf--klein knopf--leise" aria-label={t('wurf.zu')} onClick={() => setZeile(null)}>
            ×
          </button>
        </div>
      ) : null}
    </WurfKontext.Provider>
  );
}

/** Ein Name oder Wert, der beim Klick würfelt. */
export function Wuerfelbar({ name, bonus, children, klasse, daten }: { name: string; bonus: number; children: ReactNode; klasse?: string; daten?: Record<string, string> }) {
  const { wuerfle } = useWurf();
  return (
    <button type="button" className={`wuerfelbar ${klasse ?? ''}`} title={t('wurf.klick', { name })} onClick={() => wuerfle(name, bonus)} {...daten}>
      {children}
    </button>
  );
}
