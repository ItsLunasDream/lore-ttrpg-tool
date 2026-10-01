/**
 * Die Sammlung: was schon gebaut wurde.
 *
 * Ein Werkzeug, das nur erzeugt und nie zeigt, was es erzeugt hat, ist eine
 * Einbahnstrasse — nach zehn Abenden liegen dreissig Monster da und man
 * findet keines wieder.
 *
 * Zwei Ansichten: Kacheln zum Stoebern („irgendwas Untotes um Grad 4") und
 * eine Liste zum Wiederfinden („wie hiess der Golem nochmal"). Die Kacheln
 * sind die Vorgabe.
 */
import { useMemo, useState } from 'react';
import type { Eintrag } from '../shared/ablage';
import { finde, type Sortierung } from '../shared/suche';
import { ROLLEN, THEMEN, text } from '../shared/tabellen';
import { getLanguage, t } from './i18n';

interface Props {
  readonly eintraege: readonly Eintrag[];
  readonly onOeffnen: (id: string) => void;
  readonly onLoeschen: (eintrag: Eintrag) => void;
}

export function Sammlung({ eintraege, onOeffnen, onLoeschen }: Props) {
  const [suche, setSuche] = useState('');
  const [themaId, setThemaId] = useState('');
  const [rolleId, setRolleId] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('cr');
  const [alsKacheln, setAlsKacheln] = useState(true);

  const sprache = getLanguage();
  const gefunden = useMemo(
    () => finde(eintraege, { text: suche, themaId: themaId || undefined, rolleId: rolleId || undefined }, sortierung, sprache),
    [eintraege, suche, themaId, rolleId, sortierung, sprache]
  );

  const themaName = (id: string) => {
    const thema = THEMEN.find((x) => x.id === id);
    return thema ? text(thema.name, sprache) : id;
  };
  const rolleName = (id: string) => {
    const rolle = ROLLEN.find((x) => x.id === id);
    return rolle ? text(rolle.name, sprache) : id;
  };

  if (eintraege.length === 0) {
    return <p className="hinweis">{t('sammlung.leer')}</p>;
  }

  return (
    <div className="sammlung">
      <div className="sammlung__leiste">
        {/*
          EIN Suchfeld, nicht drei. Zahlen liest es als Grad, Woerter als
          Name, Art oder Rolle, „untot 4" als beides. Wer es genauer will,
          hat die Auswahlfelder daneben.
        */}
        <input
          className="sammlung__suche"
          type="search"
          value={suche}
          placeholder={t('sammlung.suche')}
          aria-label={t('sammlung.suche')}
          onChange={(ereignis) => setSuche(ereignis.target.value)}
        />
        <select value={themaId} onChange={(e) => setThemaId(e.target.value)} aria-label={t('feld.thema')}>
          <option value="">{t('feld.thema')}: {t('feld.beliebig')}</option>
          {THEMEN.map((thema) => (
            <option key={thema.id} value={thema.id}>
              {text(thema.name, sprache)}
            </option>
          ))}
        </select>
        <select value={rolleId} onChange={(e) => setRolleId(e.target.value)} aria-label={t('feld.rolle')}>
          <option value="">{t('feld.rolle')}: {t('feld.beliebig')}</option>
          {ROLLEN.map((rolle) => (
            <option key={rolle.id} value={rolle.id}>
              {text(rolle.name, sprache)}
            </option>
          ))}
        </select>
        <select
          value={sortierung}
          onChange={(e) => setSortierung(e.target.value as Sortierung)}
          aria-label={t('sammlung.sortieren')}
        >
          <option value="cr">{t('sammlung.nachCr')}</option>
          <option value="name">{t('sammlung.nachName')}</option>
          <option value="geaendert">{t('sammlung.nachDatum')}</option>
        </select>
        <div className="sammlung__ansicht">
          <button
            type="button"
            className={alsKacheln ? 'knopf knopf--klein knopf--an' : 'knopf knopf--klein'}
            onClick={() => setAlsKacheln(true)}
          >
            {t('sammlung.kacheln')}
          </button>
          <button
            type="button"
            className={alsKacheln ? 'knopf knopf--klein' : 'knopf knopf--klein knopf--an'}
            onClick={() => setAlsKacheln(false)}
          >
            {t('sammlung.liste')}
          </button>
        </div>
      </div>

      <p className="sammlung__zahl">{t('sammlung.anzahl', { anzahl: gefunden.length })}</p>
      <p className="hinweis hinweis--klein">{t('sammlung.sucheHinweis')}</p>

      {gefunden.length === 0 ? (
        <p className="hinweis">{t('sammlung.nichts')}</p>
      ) : alsKacheln ? (
        <ul className="kacheln" data-pfeile="raster">
          {gefunden.map((eintrag) => (
            <li data-pfeil key={eintrag.id}>
              <button type="button" className="monsterkachel" onClick={() => onOeffnen(eintrag.id)}>
                <span className="monsterkachel__cr">{eintrag.cr}</span>
                <span className="monsterkachel__name">{eintrag.name}</span>
                <span className="monsterkachel__unten">
                  {themaName(eintrag.themaId)} · {rolleName(eintrag.rolleId)}
                </span>
              </button>
              <button
                type="button"
                className="monsterkachel__weg"
                aria-label={t('knopf.loeschen')}
                title={t('knopf.loeschen')}
                onClick={() => onLoeschen(eintrag)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="monsterliste">
          <thead>
            <tr>
              <th>{t('feld.cr')}</th>
              <th>{t('titel')}</th>
              <th>{t('feld.thema')}</th>
              <th>{t('feld.rolle')}</th>
              <th>{t('werte.tp')}</th>
              <th>{t('werte.rk')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gefunden.map((eintrag) => (
              <tr key={eintrag.id}>
                <td>{eintrag.cr}</td>
                <td>
                  <button type="button" className="alsLink" onClick={() => onOeffnen(eintrag.id)}>
                    {eintrag.name}
                  </button>
                </td>
                <td>{themaName(eintrag.themaId)}</td>
                <td>{rolleName(eintrag.rolleId)}</td>
                <td>{eintrag.tp}</td>
                <td>{eintrag.rk}</td>
                <td>
                  <button
                    type="button"
                    className="monsterkachel__weg"
                    aria-label={t('knopf.loeschen')}
                    onClick={() => onLoeschen(eintrag)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
