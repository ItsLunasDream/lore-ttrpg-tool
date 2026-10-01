/**
 * Das Formular eines magischen Gegenstands: Art, Seltenheit, Einstimmung,
 * Wirkungen und Fluch. Ein Formular für Magic Item Generator und Homebrew
 * Creator (Rückmeldung: „Blank Item" gab es doppelt). Name, Wert/Preis,
 * Bild und Notiz bleiben beim jeweiligen Werkzeug, das sie anders anordnet.
 *
 * Was nur ein Werkzeug kann (die KI im Generator), kommt über die
 * Knopf-Plätze herein; das Formular kennt die KI nicht.
 */
import type { ReactNode } from 'react';
import { SELTENHEITEN, SELTENHEIT_NAME, type Seltenheit } from '@suite/srd';
import { ARTEN, ART_NAME, type Art } from './tabellen';
import { wuerfleFluch, wuerfleWirkung, type Gegenstand } from './erzeuge';

export type Felder = Pick<Gegenstand, 'art' | 'seltenheit' | 'einstimmung' | 'wirkungen' | 'fluch'>;

const TEXTE = {
  art: ['Art', 'Type'],
  seltenheit: ['Seltenheit', 'Rarity'],
  einstimmung: ['Erfordert Einstimmung', 'Requires attunement'],
  wirkungen: ['Wirkungen', 'Properties'],
  neueWirkung: ['Neue Wirkung hinzufügen:', 'Add new property:'],
  gewuerfelt: ['Gewürfelt', 'Rolled'],
  leer: ['Leer', 'Blank'],
  wirkungWeg: ['Wirkung entfernen', 'Remove property'],
  wirkungNeu: ['Diese Wirkung neu würfeln', 'Reroll this property'],
  fluch: ['Fluch', 'Curse'],
  fluchHinweis: ['Leer lassen, wenn der Gegenstand nicht verflucht ist.', 'Leave empty if the item is not cursed.'],
  fluchWuerfeln: ['Fluch würfeln', 'Roll a curse'],
  fluchNeu: ['Fluch neu würfeln', 'Reroll curse']
} as const;

export interface MagieFelderProps<T extends Felder> {
  readonly g: T;
  readonly sprache: 'de' | 'en';
  /** Teiländerung; das Werkzeug passt bei Bedarf weitere Felder an (z. B. den Wert). */
  readonly setze: (teil: Partial<Felder>) => void;
  /** Unter Art und Seltenheit (der Generator setzt dort den Wert hin). */
  readonly nachKopf?: ReactNode;
  /** Weitere Knöpfe je Wirkung (z. B. KI). */
  readonly wirkungKnoepfe?: (stelle: number) => ReactNode;
  /** Weitere Knöpfe in „Neue Wirkung hinzufügen". */
  readonly neueWirkungKnoepfe?: ReactNode;
  /** Weitere Knöpfe unter dem Fluch. */
  readonly fluchKnoepfe?: ReactNode;
}

export function MagieFelder<T extends Felder>({ g, sprache, setze, nachKopf, wirkungKnoepfe, neueWirkungKnoepfe, fluchKnoepfe }: MagieFelderProps<T>) {
  const i = sprache === 'de' ? 0 : 1;
  const t = (k: keyof typeof TEXTE) => TEXTE[k][i];
  return (
    <div className="magiefelder" data-magiefelder>
      <div className="kopfzeile">
        <label className="feld">
          <span className="feld__name">{t('art')}</span>
          <select className="feld__wahl" value={g.art} data-feld="gegenstandsart" onChange={(e) => setze({ art: e.target.value as Art })}>
            {ARTEN.map((a) => (
              <option key={a} value={a}>
                {ART_NAME[a][sprache]}
              </option>
            ))}
          </select>
        </label>
        <label className="feld">
          <span className="feld__name">{t('seltenheit')}</span>
          <select className="feld__wahl" value={g.seltenheit} data-feld="seltenheit" onChange={(e) => setze({ seltenheit: e.target.value as Seltenheit })}>
            {SELTENHEITEN.map((s) => (
              <option key={s} value={s}>
                {SELTENHEIT_NAME[s][sprache]}
              </option>
            ))}
          </select>
        </label>
        <label className="feld feld--haken">
          <input type="checkbox" checked={g.einstimmung} data-feld="einstimmung" onChange={(e) => setze({ einstimmung: e.target.checked })} /> {t('einstimmung')}
        </label>
      </div>
      {nachKopf}

      <h3>{t('wirkungen')}</h3>
      <ul className="wirkungsliste">
        {g.wirkungen.map((w, stelle) => (
          <li key={stelle}>
            <textarea
              className="feld__flaeche"
              rows={2}
              value={w}
              data-wirkung={stelle}
              onChange={(e) => setze({ wirkungen: g.wirkungen.map((x, j) => (j === stelle ? e.target.value : x)) })}
            />
            <div className="zeilenknoepfe">
              <button
                type="button"
                className="knopf"
                data-wirkung-neu={stelle}
                aria-label={t('wirkungNeu')}
                title={t('wirkungNeu')}
                onClick={() =>
                  setze({ wirkungen: g.wirkungen.map((x, j) => (j === stelle ? wuerfleWirkung(g.art, g.seltenheit, sprache, g.wirkungen) : x)) })
                }
              >
                ⚄
              </button>
              {wirkungKnoepfe?.(stelle)}
              <button
                type="button"
                className="knopf"
                data-wirkung-weg={stelle}
                aria-label={t('wirkungWeg')}
                title={t('wirkungWeg')}
                onClick={() => setze({ wirkungen: g.wirkungen.filter((_, j) => j !== stelle) })}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
      {/* Ausdrücklich eine Wirkung würfeln, nicht nur ein leeres Feld anlegen. */}
      <div className="knopfreihe knopfreihe--neu">
        <span className="knopfreihe__titel">{t('neueWirkung')}</span>
        <button
          type="button"
          className="knopf"
          data-wirkung-wuerfeln
          onClick={() => setze({ wirkungen: [...g.wirkungen.filter((w) => w.trim()), wuerfleWirkung(g.art, g.seltenheit, sprache, g.wirkungen)] })}
        >
          ⚄ {t('gewuerfelt')}
        </button>
        {neueWirkungKnoepfe}
        <button type="button" className="knopf" data-wirkung-dazu onClick={() => setze({ wirkungen: [...g.wirkungen, ''] })}>
          + {t('leer')}
        </button>
      </div>

      <h3 className="fluch__titel">{t('fluch')}</h3>
      <div className="fluch">
        <textarea
          className="feld__flaeche"
          rows={2}
          value={g.fluch}
          placeholder={t('fluchHinweis')}
          data-fluch
          data-feld="fluch"
          onChange={(e) => setze({ fluch: e.target.value })}
        />
      </div>
      <div className="knopfreihe">
        <button
          type="button"
          className="knopf"
          data-fluch-wuerfeln
          onClick={() =>
            // Ein Fluch bindet: mit ihm verlangt der Gegenstand Einstimmung (Tränke und Schriftrollen nie).
            setze({ fluch: wuerfleFluch(sprache, g.fluch), einstimmung: g.art !== 'trank' && g.art !== 'schriftrolle' ? true : g.einstimmung })
          }
        >
          ⚄ {g.fluch.trim() ? t('fluchNeu') : t('fluchWuerfeln')}
        </button>
        {fluchKnoepfe}
      </div>
    </div>
  );
}
