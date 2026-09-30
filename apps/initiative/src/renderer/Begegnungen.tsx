/**
 * Die Sammlung der Begegnungen.
 *
 * Aufgebaut wie die Sammlungen im Monster Creator und im Status Effect
 * Creator: Kacheln zum Stoebern, eine Liste zum Wiederfinden, ein Suchfeld
 * darueber. Wer zwischen den Werkzeugen wechselt, soll nicht jedes Mal
 * umlernen.
 *
 * Gesucht wird ueber den Namen der Begegnung **und** die Namen der
 * Teilnehmer — siehe `shared/suche.ts`. Wer eine Begegnung sucht, weiss oft
 * nur noch, wer darin vorkam.
 */
import { useMemo, useState } from 'react';
import { finde, treffendeTeilnehmer, type Sortierung } from '../shared/suche';
import { t } from './i18n';
import type { Begegnung } from '../shared/types';

interface Props {
  readonly begegnungen: readonly Begegnung[];
  readonly onOeffnen: (id: string) => void;
  readonly onLoeschen: (id: string) => Promise<void> | void;
  readonly onSchliessen: () => void;
}

export function Begegnungen({ begegnungen, onOeffnen, onLoeschen, onSchliessen }: Props) {
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('name');
  const [alsKacheln, setAlsKacheln] = useState(true);

  const gefunden = useMemo(
    () => finde(begegnungen, suche, sortierung),
    [begegnungen, suche, sortierung]
  );

  return (
    <div className="begegnungen motion-eintritt">
      <div className="begegnungen__kopf">
        <h2 className="begegnungen__titel">{t('begegnung.titel')}</h2>
        <button
          type="button"
          className="begegnungen__zu"
          onClick={onSchliessen}
          aria-label={t('knopf.schliessen')}
        >
          ×
        </button>
      </div>

      {begegnungen.length === 0 ? (
        <p className="begegnungen__leer">{t('begegnung.keine')}</p>
      ) : (
        <>
          <div className="sammlung__leiste">
            <input
              className="sammlung__suche"
              type="search"
              value={suche}
              placeholder={t('begegnung.suche')}
              aria-label={t('begegnung.suche')}
              onChange={(ereignis) => setSuche(ereignis.target.value)}
            />
            <select
              value={sortierung}
              onChange={(ereignis) => setSortierung(ereignis.target.value as Sortierung)}
              aria-label={t('sammlung.sortieren')}
            >
              <option value="name">{t('sammlung.nachName')}</option>
              <option value="groesse">{t('sammlung.nachGroesse')}</option>
            </select>
            <div className="sammlung__ansicht">
              <button
                type="button"
                className={alsKacheln ? 'knopf--klein knopf--an' : 'knopf--klein'}
                onClick={() => setAlsKacheln(true)}
              >
                {t('sammlung.kacheln')}
              </button>
              <button
                type="button"
                className={alsKacheln ? 'knopf--klein' : 'knopf--klein knopf--an'}
                onClick={() => setAlsKacheln(false)}
              >
                {t('sammlung.liste')}
              </button>
            </div>
          </div>
          <p className="sammlung__zahl">{t('sammlung.anzahl', { n: gefunden.length })}</p>

          {gefunden.length === 0 ? (
            <p className="begegnungen__leer">{t('sammlung.nichts')}</p>
          ) : alsKacheln ? (
            <ul className="kacheln" data-pfeile="raster">
              {gefunden.map((begegnung) => {
                // Warum diese Begegnung gefunden wurde: wer nach „Ghul" sucht
                // und „Waldlager" angezeigt bekommt, will den Grund sehen.
                const treffer = treffendeTeilnehmer(begegnung, suche);
                return (
                  <li data-pfeil key={begegnung.id}>
                    <button
                      type="button"
                      className="kachel"
                      onClick={() => onOeffnen(begegnung.id)}
                    >
                      <span className="kachel__oben">
                        {t('begegnung.teilnehmerzahl', { n: begegnung.teilnehmer.length })}
                      </span>
                      <span className="kachel__name">{begegnung.name}</span>
                      <span className="kachel__unten">
                        {(treffer.length > 0
                          ? treffer
                          : begegnung.teilnehmer.map((teilnehmer) => teilnehmer.name)
                        )
                          .slice(0, 4)
                          .join(', ') || t('begegnung.ohneTeilnehmer')}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="kachel__weg"
                      aria-label={t('knopf.entfernen')}
                      title={t('knopf.entfernen')}
                      onClick={() => void onLoeschen(begegnung.id)}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="begegnungen__liste" data-pfeile="liste">
              {gefunden.map((begegnung) => (
                <li data-pfeil key={begegnung.id}>
                  <button type="button" onClick={() => onOeffnen(begegnung.id)}>
                    <span className="begegnungen__name">{begegnung.name}</span>
                    <span className="begegnungen__zahl">{begegnung.teilnehmer.length}</span>
                  </button>
                  <button
                    type="button"
                    className="knopf--gefahr"
                    onClick={() => void onLoeschen(begegnung.id)}
                    aria-label={t('knopf.entfernen')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
