/**
 * „Aus Quelle hinzufügen" im Inventar: SRD-Ausrüstung, magische
 * Gegenstände des SRD, eigene aus dem Magic Item Generator (Homebrew) und
 * ein Wurf auf eine Loot-Tabelle.
 */
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Segment } from './Bedienung';
import { getLanguage, t } from './i18n';
import type { Bogen } from '../shared/bogen';
import { gewichtAnzeige } from '../shared/inventar';
import { alsGegenstand, lootAlsEintrag, srdAusruestung, srdMagie, sucheQuellen, type Quelleintrag } from '../shared/quellen';

type Reiter = 'srd' | 'magie' | 'eigene' | 'loot';

interface Props {
  readonly aendere: (wie: (b: Bogen) => Bogen) => void;
  readonly setMeldung: (text: string) => void;
  readonly schliessen: () => void;
}

export function Quellen({ aendere, setMeldung, schliessen }: Props) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const [reiter, setReiter] = useState<Reiter>('srd');
  const [suche, setSuche] = useState('');
  const [eigene, setEigene] = useState<Quelleintrag[] | null>(null);
  const [tabellen, setTabellen] = useState<{ id: string; name: string }[] | null>(null);
  const [tabelle, setTabelle] = useState('');
  const [wurf, setWurf] = useState<string | null>(null);

  useEffect(() => {
    // Auch fuer Loot: ein gewuerfelter eigener Gegenstand bringt so seine Werte mit.
    if ((reiter === 'eigene' || reiter === 'loot') && eigene === null) {
      void api.quellen.magicitems().then((liste) =>
        setEigene(
          liste.map((g) => ({
            quelle: 'magicitem',
            kennung: g.id,
            name: g.name,
            art: g.art,
            gewicht: null,
            wert: g.wert,
            beschreibung: g.beschreibung,
            einstimmung: g.einstimmung
          }))
        )
      );
    }
    if (reiter === 'loot' && tabellen === null) {
      void api.quellen.lootTabellen().then((liste) => {
        setTabellen(liste);
        if (liste[0]) setTabelle(liste[0].id);
      });
    }
  }, [reiter, eigene, tabellen]);

  const liste = useMemo(() => {
    if (reiter === 'srd') return sucheQuellen(srdAusruestung(sprache), suche);
    if (reiter === 'magie') return sucheQuellen(srdMagie(sprache), suche);
    if (reiter === 'eigene') return sucheQuellen(eigene ?? [], suche);
    return [];
  }, [reiter, suche, eigene, sprache]);

  const dazu = (e: Quelleintrag) => {
    aendere((b) => ({ ...b, gegenstaende: [...b.gegenstaende, alsGegenstand(e)] }));
    setMeldung(t('quelle.dazu', { name: e.name }));
  };

  const wuerfle = () => {
    if (!tabelle) return;
    void api.quellen.lootWuerfle(tabelle).then((text) => setWurf(text ?? ''));
  };

  return (
    <div className="quellen" data-quellen>
      <div className="quellen__reiter" role="tablist">
        {(['srd', 'magie', 'eigene', 'loot'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={reiter === r}
            className={reiter === r ? 'ist-an' : ''}
            data-quelle-reiter={r}
            onClick={() => {
              setReiter(r);
              setWurf(null);
              // Jeder Reiter sucht in einer anderen Liste: der alte Suchtext passt selten.
              setSuche('');
            }}
          >
            {t(`quelle.${r}` as Parameters<typeof t>[0])}
          </button>
        ))}
        <span className="leiste__rest" />
        <button type="button" className="knopf--klein" onClick={schliessen}>
          {t('schliessen')}
        </button>
      </div>

      {reiter === 'loot' ? (
        <div className="quellen__loot">
          {tabellen && tabellen.length === 0 ? <p className="leise">{t('quelle.loot.leer')}</p> : null}
          {tabellen && tabellen.length ? (
            <div className="leiste">
              <Segment
                label={t('quelle.loot')}
                wert={tabelle}
                daten={{ 'data-loot-tabelle': '' }}
                optionen={tabellen.map((x) => ({ wert: x.id, text: x.name }))}
                aendern={setTabelle}
              />
              <button type="button" data-loot-wuerfeln onClick={wuerfle}>
                🎲 {t('quelle.loot.wuerfeln')}
              </button>
            </div>
          ) : null}
          {wurf !== null ? (
            <div className="quellen__wurf" data-loot-ergebnis>
              <p>{wurf || t('quelle.loot.nichts')}</p>
              {wurf ? (
                <button
                  type="button"
                  className="knopf--haupt"
                  data-loot-dazu
                  onClick={() => {
                    const name = tabellen?.find((x) => x.id === tabelle)?.name ?? '';
                    // Mit bekannten Gegenständen abgleichen: Wert, Gewicht, Iteminfo.
                    dazu(lootAlsEintrag(wurf, tabelle, name, sprache, eigene ?? []));
                    setWurf(null);
                  }}
                >
                  {t('quelle.loot.dazu')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <input
            type="search"
            className="suche"
            data-quelle-suche
            placeholder={t('quelle.suche')}
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          {reiter === 'eigene' && eigene && eigene.length === 0 ? <p className="leise">{t('quelle.eigene.leer')}</p> : null}
          <ul className="quellen__liste" data-pfeile="liste">
            {liste.map((e) => (
              <li data-pfeil key={`${e.quelle}:${e.kennung}`}>
                <div>
                  <strong>{e.name}</strong> <span className="leise">{e.art}</span>
                  <div className="leise quellen__zahlen">
                    {e.gewicht !== null ? gewichtAnzeige(e.gewicht, sprache) : ''}
                    {e.gewicht !== null && e.wert !== null ? ' · ' : ''}
                    {e.wert !== null ? `${e.wert.toLocaleString(sprache === 'de' ? 'de-DE' : 'en-US')} ${sprache === 'de' ? 'GM' : 'GP'}` : ''}
                  </div>
                </div>
                <button type="button" className="knopf--klein" data-quelle-dazu={e.kennung} title={e.beschreibung.slice(0, 400)} onClick={() => dazu(e)}>
                  + {t('quelle.nehmen')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
