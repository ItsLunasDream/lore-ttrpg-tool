/**
 * Die Teile der Oberflaeche fuer Boegen im Raum: die Liste „Im Raum", die
 * Leiste ueber einem geteilten Bogen, der Hinweis auf Aenderungen durch die
 * SL und die kleinen Marken an geaenderten Feldern.
 */
import { createContext, useContext, useState } from 'react';
import { Segment, Suchwahl } from './Bedienung';
import { getLanguage, hatText, t } from './i18n';
import type { Kachel } from '../shared/ablage';
import { FREIGABEN, type LiveEintrag, type SlAenderung } from '../shared/live';
import type { LiveZustand } from '../main/live';

// --- Marken an Feldern ------------------------------------------------------

export interface MarkenInfo {
  readonly von: string;
  readonly zeit: string;
  readonly alt: string;
}

/** Welche Felder die SL geaendert hat, nach Kurzname („rk", „tp-aktuell", „gegenstaende"). */
export const SlMarkenKontext = createContext<ReadonlyMap<string, MarkenInfo>>(new Map());

export function markenAus(liste: readonly SlAenderung[]): Map<string, MarkenInfo> {
  const marken = new Map<string, MarkenInfo>();
  // Aelteste zuerst, damit die neueste gewinnt.
  for (const a of [...liste].reverse()) {
    for (const feld of a.felder) {
      const teile = feld.split('.');
      const rest = teile[0] === 'werte' ? teile.slice(1) : teile;
      for (let n = 1; n <= rest.length; n += 1) {
        marken.set(rest.slice(0, n).join('-'), { von: a.von, zeit: a.zeit, alt: a.alt?.[feld] ?? '—' });
      }
    }
  }
  return marken;
}

function uhrzeit(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(getLanguage() === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Eine kleine Marke „SL" an einem Feld, das die SL geaendert hat. */
export function SlMarke({ feld }: { feld: string }) {
  const info = useContext(SlMarkenKontext).get(feld);
  if (!info) return null;
  return (
    <span className="sl-marke" data-sl-marke={feld} title={t('sl.marke.titel', { von: info.von, zeit: uhrzeit(info.zeit), alt: info.alt })}>
      {t('sl.kurz')}
    </span>
  );
}

// --- Die Liste im Raum ------------------------------------------------------

const TP_STUFE: Record<string, Parameters<typeof t>[0]> = {
  voll: 'live.tp.voll',
  leicht: 'live.tp.leicht',
  schwer: 'live.tp.schwer',
  boden: 'live.tp.boden'
};

export function LiveListe({
  live,
  eigene,
  oeffne,
  bringe,
  alleInTracker
}: {
  live: LiveZustand;
  eigene: readonly Kachel[];
  oeffne: (id: string) => void;
  bringe: (bogenId: string) => void;
  /** Nur fuer die SL: alle Figuren, die man ganz sieht, in den Initiative Tracker. */
  alleInTracker: () => void;
}) {
  const [wahl, setWahl] = useState('');
  const drin = new Set(live.eintraege.filter((e) => e.besitzer.id === live.ich).map((e) => e.bogen?.id ?? e.id.split('/').pop()));
  const draussen = eigene.filter((k) => !drin.has(k.id));
  const sortiert = [...live.eintraege].sort(
    (a, b) => Number(b.besitzer.id === live.ich) - Number(a.besitzer.id === live.ich) || a.uebersicht.name.localeCompare(b.uebersicht.name)
  );
  return (
    <section className="block live-liste" data-live-liste>
      <h2>
        {t('live.titel')}
        {live.ichSl ? <span className="sl-marke sl-marke--rolle">{t('sl.kurz')}</span> : null}
        {live.ichSl && sortiert.some((e) => e.sicht === 'voll' && e.uebersicht.art === 'figur') ? (
          <button type="button" className="knopf--klein" data-alle-tracker onClick={alleInTracker}>
            {t('tracker.alle')}
          </button>
        ) : null}
      </h2>
      {sortiert.length === 0 ? <p className="leer">{t('live.leer')}</p> : null}
      <ul className="kacheln" data-pfeile="raster">
        {sortiert.map((e) => (
          <li data-pfeil key={e.id}>
            {e.sicht === 'voll' ? (
              <button type="button" className="kachel kachel--live" data-live={e.id} onClick={() => oeffne(e.id)}>
                <LiveKopf e={e} ich={live.ich} />
              </button>
            ) : (
              <div className="kachel kachel--live kachel--uebersicht" data-live={e.id} title={t('live.nurUebersicht')}>
                <LiveKopf e={e} ich={live.ich} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {draussen.length > 0 ? (
        <div className="leiste">
          <Suchwahl
            daten={{ 'data-bringe-wahl': '' }}
            punkte={draussen.map((k) => ({ id: k.id, name: k.name, info: k.kurz }))}
            wert={wahl}
            suche={t('liste.suche')}
            knopf={draussen.find((k) => k.id === wahl)?.name ?? t('live.bringe.wahl')}
            aendern={setWahl}
          />
          <button
            type="button"
            data-bringe
            disabled={!wahl}
            onClick={() => {
              bringe(wahl);
              setWahl('');
            }}
          >
            {t('live.bringe')}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function LiveKopf({ e, ich }: { e: LiveEintrag; ich: string | null }) {
  const u = e.uebersicht;
  return (
    <>
      <span className="kachel__name">{u.name}</span>
      <span className="kachel__kurz">
        {e.besitzer.id === ich ? t('live.meiner') : e.besitzer.name}
        {u.kurz ? ` · ${u.kurz}` : ''}
      </span>
      <span className="kachel__tp">
        {e.sicht === 'voll' && e.bogen?.werte
          ? `${e.bogen.werte.tp.aktuell}/${e.bogen.werte.tp.max}`
          : u.tpStufe
            ? t(TP_STUFE[u.tpStufe])
            : ''}
        {u.rk !== null ? ` · ${t('rk')} ${u.rk}` : ''}
        {u.zustaende.length ? ` · ${u.zustaende.length} ${t('zustaende')}` : ''}
      </span>
    </>
  );
}

// --- Die Leiste ueber einem geteilten Bogen ---------------------------------

export function LiveLeiste({
  e,
  live,
  still,
  setStill,
  anfrage
}: {
  e: LiveEintrag;
  live: LiveZustand;
  still: boolean;
  setStill: (still: boolean) => void;
  anfrage: (a: Parameters<typeof window.charakterbogen.live.anfrage>[0]) => void;
}) {
  const meiner = e.besitzer.id === live.ich;
  const fremdAlsSl = live.ichSl && !meiner;
  return (
    <div className="live-leiste" data-live-leiste>
      <span className="live-leiste__wer">
        {meiner ? t('live.imRaum.meiner') : t('live.imRaum.von', { name: e.besitzer.name })}
        {!e.darfAendern ? ` · ${t('live.nurLesen')}` : ''}
      </span>
      {e.zuletzt ? (
        <span className="leise" data-zuletzt>
          {t('live.zuletzt', { name: e.zuletzt.name, zeit: uhrzeit(e.zuletzt.zeit) })}
        </span>
      ) : null}
      <span className="leiste__rest" />
      {e.darfAendern ? (
        <div className="live-leiste__freigabe" title={t('live.freigabe.titel')}>
          {t('live.freigabe')}
          <Segment
            klein
            label={t('live.freigabe')}
            wert={e.freigabe}
            daten={{ 'data-freigabe': '' }}
            optionen={FREIGABEN.map((f) => ({ wert: f, text: t(`live.freigabe.${f}` as Parameters<typeof t>[0]) }))}
            aendern={(f) => anfrage({ art: 'freigabe', id: e.id, freigabe: f })}
          />
        </div>
      ) : null}
      {fremdAlsSl ? (
        <label className={`live-leiste__still${still ? ' ist-an' : ''}`} title={t('live.still.titel')}>
          <input type="checkbox" data-still checked={still} onChange={(ev) => setStill(ev.target.checked)} />
          {t('live.still')}
        </label>
      ) : null}
      {e.darfAendern ? (
        <button type="button" data-zurueckholen onClick={() => anfrage({ art: 'zurueck', id: e.id })}>
          {meiner ? t('live.zurueck') : t('live.entfernen')}
        </button>
      ) : null}
    </div>
  );
}

/** Oben am eigenen Bogen: was die SL geaendert hat. Bei der SL: ihr Verlauf. */
export function SlHinweis({
  e,
  meiner,
  bestaetige
}: {
  e: LiveEintrag;
  meiner: boolean;
  bestaetige: () => void;
}) {
  if (e.slAenderungen.length === 0) return null;
  const zeilen = (
    <ul className="sl-hinweis__liste">
      {e.slAenderungen.map((a, n) => (
        <li key={n}>
          <span className="leise">{uhrzeit(a.zeit)}</span> {a.von}: {a.felder.map(feldName).join(', ')}
          {a.still ? <em className="leise"> ({t('live.still.kurz')})</em> : null}
        </li>
      ))}
    </ul>
  );
  if (!meiner) {
    return (
      <details className="sl-hinweis sl-hinweis--verlauf" data-sl-verlauf>
        <summary>{t('sl.verlauf', { n: e.slAenderungen.length })}</summary>
        {zeilen}
      </details>
    );
  }
  return (
    <div className="sl-hinweis" role="status" data-sl-hinweis>
      <strong>{t('sl.aenderungen', { n: e.slAenderungen.length })}</strong>
      {zeilen}
      <button type="button" data-sl-gesehen onClick={bestaetige}>
        {t('sl.gesehen')}
      </button>
    </div>
  );
}

/** Lesbarer Name eines Feldpfads, soweit bekannt; sonst der Pfad. */
function feldName(pfad: string): string {
  const teile = pfad.split('.');
  const rest = teile[0] === 'werte' ? teile.slice(1) : teile;
  const schluessel = `feld.${rest[0]}`;
  if (!hatText(schluessel)) return rest.join('.');
  const name = t(schluessel);
  return rest.length > 1 && rest[0] !== 'tp' ? `${name} (${rest.slice(1).join('.')})` : name;
}
