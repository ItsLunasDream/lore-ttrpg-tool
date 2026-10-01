/**
 * Tiergestalt im Bogen (docs/tiergestalt.md): bekannte Gestalten waehlen,
 * Nutzungen, Verwandeln; dazu der Kasten der aktiven Gestalt, der neben dem
 * Bogen liegt, solange die Figur verwandelt ist.
 *
 * Gewaehlt wird nur aus den Tieren des SRD, die die Druidenstufe erlaubt.
 * Der Knopf „Nachschlagen" oeffnet das Nachschlagewerk mit demselben
 * Filter (ueber die Huelle), zum Vergleichen und Lesen der ganzen Kaesten.
 */
import { alleGestalten, erfuellt, gestaltNach, grenzeFuer, hgText, tiergestaltFuer, type Gestalt } from '@suite/srd/gestalten';
import { api } from './api';
import { getLanguage, t } from './i18n';
import { Suchwahl } from './Bedienung';
import { SlMarke } from './LiveTeile';
import type { Werte } from '../shared/bogen';
import { druidenstufe, lerneGestalt, nutzungenUebrig, verwandle, verwandleZurueck, vergissGestalt } from '../shared/tiergestalt';
import type { FigurProps } from './Figurenbogen';

function spr(): 'de' | 'en' {
  return getLanguage() === 'de' ? 'de' : 'en';
}

function kurz(g: Gestalt): string {
  const s = spr();
  return `${t('tg.hg')} ${g.monster.hg} · ${t('rk')} ${g.monster.rk} · ${t('tg.tp')} ${g.monster.tp} · ${g.monster.bewegung[s]}`;
}

export function TiergestaltBlock({ w, aendere, name }: { w: Werte; aendere: FigurProps['aendere']; name: string }) {
  const stufe = druidenstufe(w);
  const regel = tiergestaltFuer(stufe);
  const stand = w.tiergestalt ?? { bekannt: [], verbraucht: 0 };
  const uebrig = nutzungenUebrig(w);
  const s = spr();
  const grenze = grenzeFuer('tiergestalt', stufe);
  const waehlbar = grenze
    ? alleGestalten().filter((g) => erfuellt(g, grenze) && !stand.bekannt.includes(g.monster.id))
    : [];
  const voll = regel ? stand.bekannt.length >= regel.bekannt : true;

  const nachschlagen = () => {
    const p = new URLSearchParams({ vorgabe: 'tiergestalt', wert: String(stufe), bekannt: stand.bekannt.join(','), figur: name });
    void api.nachschlagen(`gestalten?${p.toString()}`);
  };

  return (
    <div className="tiergestalt" data-tiergestalt>
      {regel ? (
        <p className="leise tiergestalt__regel" data-tg-regel>
          {t('tg.regel', {
            stufe,
            hg: hgText(regel.maxHg),
            flug: regel.flug ? t('tg.mitFlug') : t('tg.ohneFlug'),
            temp: regel.tempTp,
            stunden: regel.stunden
          })}
        </p>
      ) : (
        <p className="leise">{t('tg.abStufe2')}</p>
      )}
      {regel ? (
        <div className="tiergestalt__nutzungen" data-tg-nutzungen={uebrig}>
          <span>{t('tg.nutzungen')}</span>
          <span className="punkte">
            {Array.from({ length: regel.nutzungen }, (_, n) => (
              <button
                key={n}
                type="button"
                className={n < stand.verbraucht ? 'punkt punkt--weg' : 'punkt'}
                aria-label={t('tg.nutzungUmschalten')}
                title={t('tg.nutzungUmschalten')}
                onClick={() =>
                  aendere((x) => ({
                    ...x,
                    tiergestalt: { ...(x.tiergestalt ?? { bekannt: [], verbraucht: 0 }), verbraucht: n < stand.verbraucht ? n : n + 1 }
                  }))
                }
              />
            ))}
          </span>
          <span className="leise">{t('tg.rast')}</span>
        </div>
      ) : null}

      <div className="tiergestalt__kopf">
        <strong>
          {t('tg.bekannt')} {regel ? `${stand.bekannt.length}/${regel.bekannt}` : stand.bekannt.length}
        </strong>
        <SlMarke feld="tiergestalt" />
        <span className="tiergestalt__knoepfe">
          {regel && !voll ? (
            <Suchwahl
              punkte={waehlbar.map((g) => ({ id: g.monster.id, name: g.monster.name[s], info: kurz(g) }))}
              aendern={(id) => id && aendere((x) => lerneGestalt(x, id))}
              knopf={`+ ${t('tg.lernen')}`}
              suche={t('tg.suche')}
              daten={{ 'data-tg-lernen': '' }}
            />
          ) : null}
          <button type="button" className="knopf knopf--leise" data-tg-nachschlagen onClick={nachschlagen}>
            {t('tg.nachschlagen')}
          </button>
        </span>
      </div>

      {stand.bekannt.length ? (
        <ul className="tiergestalt__liste" data-pfeile="liste">
          {stand.bekannt.map((id) => {
            const g = gestaltNach(id);
            if (!g) return null;
            const aktiv = stand.aktiv === id;
            const erlaubt = grenze ? erfuellt(g, grenze) : false;
            return (
              <li key={id} className={aktiv ? 'tiergestalt__zeile tiergestalt__zeile--aktiv' : 'tiergestalt__zeile'} data-pfeil data-tg-gestalt={id}>
                <span className="tiergestalt__name">
                  {g.monster.name[s]}
                  {!erlaubt ? <span className="tiergestalt__warnung" title={t('tg.nichtErlaubt')}> ⚠</span> : null}
                </span>
                <span className="leise">{kurz(g)}</span>
                {aktiv ? (
                  <button type="button" className="knopf" data-tg-zurueck onClick={() => aendere(verwandleZurueck)}>
                    {t('tg.zurueck')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="knopf"
                    data-tg-verwandeln={id}
                    disabled={uebrig <= 0 || !regel}
                    title={uebrig <= 0 ? t('tg.keineNutzung') : t('tg.verwandelnTitel', { temp: regel?.tempTp ?? 0 })}
                    onClick={() => aendere((x) => verwandle(x, id))}
                  >
                    {t('tg.verwandeln')}
                  </button>
                )}
                <button
                  type="button"
                  className="knopf knopf--leise"
                  aria-label={t('tg.vergessen', { name: g.monster.name[s] })}
                  title={t('tg.vergessen', { name: g.monster.name[s] })}
                  onClick={() => aendere((x) => vergissGestalt(x, id))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="leise">{t('tg.keine')}</p>
      )}
    </div>
  );
}

const ATTRIBUTE: Record<'de' | 'en', readonly string[]> = {
  de: ['Stä', 'Ges', 'Kon', 'Int', 'Wei', 'Cha'],
  en: ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']
};

/**
 * Der Kasten der aktiven Gestalt: das Noetigste fuer den Kampf (RK,
 * Bewegung, Attribute, Sinne, Merkmale und Aktionen), woertlich aus dem SRD.
 * Nach SRD 5.2.1 („Rules While Shape-Shifted") behaelt die Figur ihre TP,
 * Trefferwuerfel und INT, WEI, CHA; die TP des Tiers gelten nicht. Darum
 * stehen hier die TP der Figur und bei INT/WEI/CHA ihre eigenen Werte.
 */
export function GestaltKasten({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const id = w.tiergestalt?.aktiv;
  const g = id ? gestaltNach(id) : undefined;
  if (!g) return null;
  const s = spr();
  const m = g.monster;
  const mod = (wert: number) => {
    const z = Math.floor((wert - 10) / 2);
    return z >= 0 ? `+${z}` : `−${-z}`;
  };
  const abschnitte = m.abschnitte.filter((a) => a.id === 'merkmale' || a.id === 'aktionen' || a.id === 'bonusaktionen' || a.id === 'reaktionen');
  return (
    <aside className="kasten gestaltkasten" data-gestaltkasten={id}>
      <div className="gestaltkasten__kopf">
        <h2>
          {t('tg.inGestalt')}: {m.name[s]}
        </h2>
        <button type="button" className="knopf" data-tg-zurueck onClick={() => aendere(verwandleZurueck)}>
          {t('tg.zurueck')}
        </button>
      </div>
      <p className="leise">{m.art[s]}</p>
      <p>
        <b>{t('rk')}</b> {m.rk} · <b>{t('tg.tp')}</b> {w.tp.aktuell}/{w.tp.max} · <b>{t('tp.temp')}</b> {w.tp.temp}
      </p>
      <p>
        <b>{t('bewegung')}</b> {m.bewegung[s]}
      </p>
      <div className="gestaltkasten__attribute">
        {m.attribute.map((tier, i) => {
          // INT, WEI, CHA bleiben die der Figur.
          const eigen = i >= 3;
          const wert = eigen ? [w.attribute.int, w.attribute.wei, w.attribute.cha][i - 3] : tier;
          return (
            <span key={ATTRIBUTE[s][i]} title={eigen ? t('tg.eigenerWert') : undefined}>
              <b>{ATTRIBUTE[s][i]}</b> {wert} ({mod(wert)}){eigen ? '*' : ''}
            </span>
          );
        })}
      </div>
      <p className="leise gestaltkasten__hinweis">{t('tg.behaelt')}</p>
      {m.zeilen[s].map((zeile) => (
        <p key={zeile} className="gestaltkasten__zeile">
          {zeile}
        </p>
      ))}
      {abschnitte.map((a) => (
        <section key={a.id}>
          {a.eintraege.map((e) => (
            <p key={e.name.en}>
              <b>
                <i>
                  {e.name[s]}
                  {s === 'de' ? ':' : '.'}
                </i>
              </b>{' '}
              {e.text[s]}
            </p>
          ))}
        </section>
      ))}
    </aside>
  );
}
