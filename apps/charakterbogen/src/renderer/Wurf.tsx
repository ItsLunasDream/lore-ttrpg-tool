/**
 * Würfeln vom Bogen (Rückmeldung): ein Klick auf Name oder Bonus einer
 * Fertigkeit, eines Attributs, eines Rettungswurfs oder auf die Initiative.
 *
 * Die Ergebnisse stehen unten rechts im Bogen, gestapelt: neue unten,
 * ältere rutschen hoch und gehen nach 25 s. Im Raum geht es, je nach Wahl,
 * an alle, nur an die SL oder an niemanden (gemerkt pro Gerät).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

/** Wie lange eine Zeile stehen bleibt (Rückmeldung: 20–30 s) und wie viele höchstens. */
const STEHT_MS = 25_000;
const RAUS_MS = 600;
const HOECHSTENS = 6;

interface Zeile {
  nr: number;
  text: string;
  hinweis: string;
  /** Läuft gerade aus (Animation), danach weg. */
  geht: boolean;
}

export function WurfBuehne({ imRaum, children }: { imRaum: boolean; children: ReactNode }) {
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [ziel, setZielZustand] = useState<Ziel>(leseZiel);
  const zaehler = useRef(0);
  const uhren = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const alle = uhren.current;
    return () => {
      for (const u of alle) clearTimeout(u);
    };
  }, []);
  const spaeter = useCallback((ms: number, tu: () => void) => {
    const u = setTimeout(() => {
      uhren.current.delete(u);
      tu();
    }, ms);
    uhren.current.add(u);
  }, []);
  const setZiel = (z: Ziel) => {
    setZielZustand(z);
    try {
      localStorage.setItem(ZIEL_SPEICHER, z);
    } catch {
      // ohne Speicher eben nur für jetzt
    }
  };

  const entferne = useCallback(
    (nr: number) => {
      setZeilen((alt) => alt.map((z) => (z.nr === nr ? { ...z, geht: true } : z)));
      spaeter(RAUS_MS, () => setZeilen((alt) => alt.filter((z) => z.nr !== nr)));
    },
    [spaeter]
  );

  const zeige = useCallback(
    (text: string) => {
      const nr = ++zaehler.current;
      // Neue Zeilen kommen unten dazu, ältere rutschen nach oben; die älteste fällt bei Überlauf weg.
      setZeilen((alt) => [...alt, { nr, text, hinweis: '', geht: false }].slice(-HOECHSTENS));
      spaeter(STEHT_MS, () => entferne(nr));
      if (!imRaum || ziel === 'nicht') return;
      void api.wurf(text, ziel).then((antwort) => {
        const hinweis =
          antwort === 'ok' ? t(ziel === 'sl' ? 'wurf.anSl' : 'wurf.anAlle') : antwort === 'selbst' ? t('wurf.selbst') : antwort === 'aus' ? '' : t('wurf.fehler');
        setZeilen((alt) => alt.map((z) => (z.nr === nr ? { ...z, hinweis } : z)));
      });
    },
    [imRaum, ziel, spaeter, entferne]
  );
  const wuerfle = useCallback((name: string, bonus: number) => zeige(probe(name, bonus).text), [zeige]);

  return (
    <WurfKontext.Provider value={{ wuerfle, zeige }}>
      {children}
      {zeilen.length ? (
        <div className="wurfanzeige" role="status" aria-live="polite" data-wurfanzeige>
          {imRaum ? (
            <span className="wurfanzeige__ziel" role="radiogroup" aria-label={t('wurf.ziel')}>
              {(['nicht', 'alle', 'sl'] as const).map((z) => (
                <button key={z} type="button" role="radio" aria-checked={ziel === z} className={ziel === z ? 'ist-an' : ''} onClick={() => setZiel(z)}>
                  {t(`wurf.${z}`)}
                </button>
              ))}
            </span>
          ) : null}
          {zeilen.map((z) => (
            <div key={z.nr} className={z.geht ? 'wurfanzeige__zeile is-geht' : 'wurfanzeige__zeile'} data-wurf-zeile>
              <span className="wurfanzeige__text" data-wurf-text>
                {z.text.replace(/^🎲\s*/, '')}
              </span>
              {z.hinweis ? <span className="leise wurfanzeige__hinweis">{z.hinweis}</span> : null}
              <button type="button" className="knopf--klein knopf--leise" aria-label={t('wurf.zu')} onClick={() => entferne(z.nr)}>
                ×
              </button>
            </div>
          ))}
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
