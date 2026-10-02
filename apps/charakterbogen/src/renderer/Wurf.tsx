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
  zeige(text: string, extra?: Zusatz): void;
}

/** Was eine Zeile über den Text hinaus weiß. */
export interface Zusatz {
  /** Die gewürfelte Augenzahl eines echten d20: bei 20 und 1 der Effekt wie im Würfel-Werkzeug. */
  readonly d20?: number;
  /** Nur anzeigen, nicht in den Raum schicken (das Werkzeug schickt selbst). */
  readonly lokal?: boolean;
}

const WurfKontext = createContext<Kontext>({ wuerfle: () => undefined, zeige: () => undefined });

/**
 * Die Zahlen, auf die es ankommt, groß und fett (Rückmeldung: „sonst sucht
 * man erst"): die erste Zahl nach dem Doppelpunkt und die nach
 * „Schaden"/„Heilung" (auch englisch).
 */
const WICHTIG = /(:\s*|(?:Schaden|Heilung|Damage|Healing)\s+)(\d+)/g;

export function hebeHervor(text: string): ReactNode[] {
  const teile: ReactNode[] = [];
  let rest = 0;
  for (const m of text.matchAll(WICHTIG)) {
    const anfang = (m.index ?? 0) + m[1].length;
    teile.push(text.slice(rest, anfang));
    teile.push(
      <strong key={anfang} className="wurfanzeige__zahl" data-wurf-zahl>
        {m[2]}
      </strong>
    );
    rest = anfang + m[2].length;
  }
  teile.push(text.slice(rest));
  return teile;
}

/** Funken wie beim Höchstwurf im Würfel-Werkzeug (apps/dice, Wuerfel.tsx). */
const FUNKEN = [
  { x: 4, y: 22, verzug: 0 },
  { x: 28, y: 12, verzug: 120 },
  { x: 58, y: 18, verzug: 260 },
  { x: 95, y: 30, verzug: 190 },
  { x: 86, y: 80, verzug: 330 },
  { x: 40, y: 84, verzug: 80 }
] as const;

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
  d20?: number;
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
    (text: string, extra?: Zusatz) => {
      const nr = ++zaehler.current;
      // Neue Zeilen kommen unten dazu, ältere rutschen nach oben; die älteste fällt bei Überlauf weg.
      setZeilen((alt) => [...alt, { nr, text, hinweis: '', geht: false, d20: extra?.d20 }].slice(-HOECHSTENS));
      spaeter(STEHT_MS, () => entferne(nr));
      if (extra?.lokal || !imRaum || ziel === 'nicht') return;
      void api.wurf(text, ziel).then((antwort) => {
        const hinweis =
          antwort === 'ok' ? t(ziel === 'sl' ? 'wurf.anSl' : 'wurf.anAlle') : antwort === 'selbst' ? t('wurf.selbst') : antwort === 'aus' ? '' : t('wurf.fehler');
        setZeilen((alt) => alt.map((z) => (z.nr === nr ? { ...z, hinweis } : z)));
      });
    },
    [imRaum, ziel, spaeter, entferne]
  );
  const wuerfle = useCallback(
    (name: string, bonus: number) => {
      const p = probe(name, bonus);
      zeige(p.text, { d20: p.d20 });
    },
    [zeige]
  );

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
            <div
              key={z.nr}
              className={`wurfanzeige__zeile${z.geht ? ' is-geht' : ''}${z.d20 === 20 ? ' ist-nat20' : z.d20 === 1 ? ' ist-nat1' : ''}`}
              data-wurf-zeile
              data-nat={z.d20 === 20 ? '20' : z.d20 === 1 ? '1' : undefined}
            >
              <span className="wurfanzeige__text" data-wurf-text>
                {hebeHervor(z.text.replace(/^🎲\s*/, ''))}
              </span>
              {z.d20 === 20 ? (
                <span className="wurf-glitzer" aria-hidden="true">
                  {FUNKEN.map((f, n) => (
                    <span key={n} className="wurf-glitzer__funke" style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.verzug}ms` }} />
                  ))}
                </span>
              ) : null}
              {z.d20 === 1 ? (
                <span className="wurf-streifen" aria-hidden="true">
                  <span className="wurf-streifen__linie" />
                  <span className="wurf-streifen__linie" />
                  <span className="wurf-streifen__linie" />
                  <span className="wurf-streifen__linie" />
                </span>
              ) : null}
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
