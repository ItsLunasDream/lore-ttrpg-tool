/**
 * Die Sammlung: was schon gebaut wurde.
 *
 * Dieselbe Handhabung wie im Monster Creator, damit man sie nicht zweimal
 * lernen muss: ein Suchfeld fuer alles, zwei Auswahlfelder daneben, Kacheln
 * oder Liste.
 *
 * Auf der Kachel steht das Zeichen gross und in der Farbe des Zustands —
 * genau so steht es spaeter im Initiative Tracker neben dem Namen, und wer
 * es hier wiedererkennt, findet es dort sofort.
 */
import { useMemo, useState } from 'react';
import type { Eintrag } from '../shared/ablage';
import { betragVon } from '../shared/gewicht';
import { finde, gruppiere, type Sortierung } from '../shared/suche';
import { ARTEN, HAERTEN, THEMEN, text } from '../shared/tabellen';
import { getLanguage, t } from './i18n';

interface Props {
  readonly eintraege: readonly Eintrag[];
  readonly onOeffnen: (id: string) => void;
  readonly onLoeschen: (eintrag: Eintrag) => void;
}

export function Sammlung({ eintraege, onOeffnen, onLoeschen }: Props) {
  const [suche, setSuche] = useState('');
  const [artId, setArtId] = useState('');
  const [themaId, setThemaId] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('gewicht');
  const [alsKacheln, setAlsKacheln] = useState(true);
  /** Welche Pakete aufgeklappt sind. Zugeklappt ist die Vorgabe. */
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set());

  const sprache = getLanguage() === 'en' ? 'en' : 'de';
  const gefunden = useMemo(
    () =>
      finde(
        eintraege,
        { text: suche, artId: artId || undefined, themaId: themaId || undefined },
        sortierung,
        sprache
      ),
    [eintraege, suche, artId, themaId, sortierung, sprache]
  );

  // Gebuendelt wird ueber die GEFUNDENEN Eintraege: wer nach „kaelte" sucht,
  // soll im Paket die Kaelte sehen und nicht die drei anderen dazu.
  const gruppen = useMemo(() => gruppiere(gefunden), [gefunden]);

  /** Eine Kachel fuer einen einzelnen Zustand — in einem Paket wie ausserhalb. */
  const kachel = (eintrag: Eintrag) => (
    <>
      <button
        type="button"
        className="zustandskachel"
        style={{ ['--marke' as string]: eintrag.farbe }}
        onClick={() => onOeffnen(eintrag.id)}
      >
        <span className="zustandskachel__zeichen" aria-hidden="true">
          {eintrag.zeichen}
        </span>
        <span className="zustandskachel__name">{eintrag.name}</span>
        <span className="zustandskachel__unten">
          {name(THEMEN, eintrag.themaId)} ·{' '}
          {eintrag.stufen > 1
            ? t('sammlung.stufen', { anzahl: eintrag.stufen })
            : t('sammlung.eineStufe')}{' '}
          · {t('gewicht.titel')} {betragVon(eintrag.gewicht)}
        </span>
      </button>
      <button
        type="button"
        className="zustandskachel__weg"
        aria-label={t('knopf.loeschen')}
        title={t('knopf.loeschen')}
        onClick={() => onLoeschen(eintrag)}
      >
        ×
      </button>
    </>
  );

  const name = (liste: readonly { id: string; name: { de: string; en: string } }[], id: string) => {
    const gefundene = liste.find((x) => x.id === id);
    return gefundene ? text(gefundene.name, sprache) : id;
  };

  if (eintraege.length === 0) {
    return <p className="hinweis">{t('sammlung.leer')}</p>;
  }

  return (
    <div className="sammlung">
      <div className="sammlung__leiste">
        <input
          className="sammlung__suche"
          type="search"
          value={suche}
          placeholder={t('sammlung.suche')}
          aria-label={t('sammlung.suche')}
          onChange={(ereignis) => setSuche(ereignis.target.value)}
        />
        <select value={artId} onChange={(e) => setArtId(e.target.value)} aria-label={t('feld.art')}>
          <option value="">
            {t('feld.art')}: {t('feld.beliebig')}
          </option>
          {ARTEN.map((art) => (
            <option key={art.id} value={art.id}>
              {text(art.name, sprache)}
            </option>
          ))}
        </select>
        <select value={themaId} onChange={(e) => setThemaId(e.target.value)} aria-label={t('feld.thema')}>
          <option value="">
            {t('feld.thema')}: {t('feld.beliebig')}
          </option>
          {THEMEN.map((thema) => (
            <option key={thema.id} value={thema.id}>
              {text(thema.name, sprache)}
            </option>
          ))}
        </select>
        <select
          value={sortierung}
          onChange={(e) => setSortierung(e.target.value as Sortierung)}
          aria-label={t('sammlung.sortieren')}
        >
          <option value="gewicht">{t('sammlung.nachGewicht')}</option>
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
          {gruppen.map((gruppe) =>
            gruppe.art === 'einzeln' ? (
              <li data-pfeil key={gruppe.eintrag.id}>{kachel(gruppe.eintrag)}</li>
            ) : (
              /*
                Ein Paket steht da wie ein einzelner Zustand, solange es zu
                ist — gleiche Groesse, gleiche Stelle im Raster. Erst beim
                Aufklappen nimmt es Platz.

                Aufgeklappt stehen die Zustaende NEBEN dem Paket, nicht
                darunter, und ein Rahmen liegt um beides. Der Rahmen ist die
                Verbindung: er sagt „das hier gehoert zusammen", auch wenn
                die Reihe umbricht und die letzten zwei Zustaende eine Zeile
                tiefer landen. Untereinander waere die Zugehoerigkeit nur
                aus dem Einzug zu erraten gewesen.
              */
              <li
                key={gruppe.id}
                className={offen.has(gruppe.id) ? 'paketgruppe paketgruppe--auf' : 'paketgruppe'}
              >
                <button
                  type="button"
                  className="paketkachel__kopf"
                  aria-expanded={offen.has(gruppe.id)}
                  onClick={() =>
                    setOffen((vorher) => {
                      const neu = new Set(vorher);
                      if (neu.has(gruppe.id)) neu.delete(gruppe.id);
                      else neu.add(gruppe.id);
                      return neu;
                    })
                  }
                >
                  <span className="paketkachel__pfeil" aria-hidden="true">
                    {offen.has(gruppe.id) ? '▾' : '▸'}
                  </span>
                  <span className="paketkachel__name">{gruppe.name}</span>
                  <span className="paketkachel__zahl">
                    {t('paket.zustaende', { anzahl: gruppe.eintraege.length })}
                  </span>
                  <span className="paketkachel__unten">
                    {gruppe.eintraege.map((e) => e.name).join(', ')}
                  </span>
                </button>
                {offen.has(gruppe.id)
                  ? gruppe.eintraege.map((eintrag) => (
                      <div className="paketgruppe__glied" key={eintrag.id}>
                        {kachel(eintrag)}
                      </div>
                    ))
                  : null}
              </li>
            )
          )}
        </ul>
      ) : (
        <table className="zustandsliste">
          <thead>
            <tr>
              <th aria-label={t('feld.thema')} />
              <th>{t('titel')}</th>
              <th>{t('feld.art')}</th>
              <th>{t('feld.thema')}</th>
              <th>{t('feld.haerte')}</th>
              <th>{t('feld.stufen')}</th>
              <th>{t('gewicht.titel')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gefunden.map((eintrag) => (
              <tr key={eintrag.id}>
                <td style={{ color: eintrag.farbe }} aria-hidden="true">
                  {eintrag.zeichen}
                </td>
                <td>
                  <button type="button" className="alsLink" onClick={() => onOeffnen(eintrag.id)}>
                    {eintrag.name}
                  </button>
                </td>
                <td>{name(ARTEN, eintrag.artId)}</td>
                <td>{name(THEMEN, eintrag.themaId)}</td>
                <td>{name(HAERTEN, eintrag.haerteId)}</td>
                <td>{eintrag.stufen}</td>
                <td>{betragVon(eintrag.gewicht)}</td>
                <td>
                  <button
                    type="button"
                    className="zustandskachel__weg"
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
