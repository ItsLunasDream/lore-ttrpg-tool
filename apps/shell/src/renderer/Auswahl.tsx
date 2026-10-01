/**
 * Was geteilt wird: die Auswahl der Eintraege.
 *
 * Rueckmeldung: „Die Auswahl muss deutlich schoener werden. Sortierung nach
 * Apps. Zusaetzlich zur Suche ein Filter, bei dem man anklickt, welche Apps
 * angezeigt werden — wie bei Amazon die Kategorien."
 *
 * Also drei Dinge uebereinander:
 * - Filter-Chips, einer je App mit Eintraegen, mit Anzahl. Keiner gewaehlt
 *   heisst alle; mehrere sind erlaubt.
 * - Die Suche wie bisher, sie wirkt innerhalb der gewaehlten Apps.
 * - Die Liste, nach App gruppiert, mit Symbol, Anzahl und „alle waehlen" je
 *   Gruppe.
 *
 * Ganz oben „Zuletzt geoeffnet": die letzten zehn Eintraege, die in einem
 * Werkzeug offen waren (Rueckmeldung), als eigene Gruppe wie „Monster".
 *
 * Die Gruppen sind eingeklappt, bis man sie oeffnet (Rueckmeldung); so
 * stehen auch die ueber 900 offiziellen Regeln in der Liste, ohne eine Wand
 * zu sein. Waehrend einer Suche sind alle Gruppen mit Treffern offen.
 * „Zuletzt geoeffnet" ist von Anfang an offen: es ist der schnelle Griff.
 */
import { memo, useMemo, useState } from 'react';
import { useVorschau } from './Vorschau';
import { eintragsSchluessel, finde, type Eintrag } from '@suite/eintraege';
import type { MessageKey, MessageParams } from '../shared/i18n';
import { nameKey } from '../shared/apps';
import { AppSymbol } from './icons';

/** Ein fester leerer Vorgabewert, damit `memo` nicht an einem neuen [] scheitert. */
const LEER: readonly never[] = [];

interface Props {
  readonly teilbar: readonly Eintrag[] | null;
  /** Zuletzt geoeffnete Orte, neueste zuerst (aus dem Verlauf der Huelle). */
  readonly zuletzt?: readonly { readonly werkzeug: string; readonly ort: string }[];
  readonly gewaehlt: ReadonlySet<string>;
  readonly setGewaehlt: (neu: Set<string>) => void;
  readonly symbole: Record<string, string>;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
}

/** Kennung der Gruppe „Zuletzt geoeffnet" — kein Werkzeug heisst so. */
const ZULETZT = '~zuletzt';
/** Kennung der Gruppe „Zuletzt hinzugefuegt": neueste Speicherzeit zuerst. */
const NEU = '~neu';
const istSondergruppe = (id: string) => id === ZULETZT || id === NEU;

/** Wie viele „Zuletzt geoeffnet" zeigt. */
const ZULETZT_ANZAHL = 10;

/**
 * Mit `memo`: der Dialog zeichnet bei jeder Chatzeile und jedem Raumereignis
 * neu, die Auswahl (mit aufgeklapptem Nachschlagewerk ueber 900 Eintraege)
 * aber nur, wenn sich ihre eigenen Daten aendern.
 */
export const Auswahl = memo(function Auswahl({ teilbar, zuletzt = LEER, gewaehlt, setGewaehlt, symbole, t }: Props) {
  const [suche, setSuche] = useState('');
  const [apps, setApps] = useState<ReadonlySet<string>>(new Set());
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set([ZULETZT, NEU]));
  const werkzeugName = (id: string) => t(nameKey(id));

  /** Die Apps mit Eintraegen, und wie viele. */
  const chips = useMemo(() => {
    const zahl = new Map<string, number>();
    for (const e of teilbar ?? []) zahl.set(e.werkzeug, (zahl.get(e.werkzeug) ?? 0) + 1);
    return [...zahl.entries()].sort((a, b) => werkzeugName(a[0]).localeCompare(werkzeugName(b[0])));
  }, [teilbar, t]);

  const gruppen = useMemo(() => {
    if (!teilbar) return [];
    const imFilter = (e: Eintrag) => apps.size === 0 || apps.has(e.werkzeug);
    const liste = suche.trim() ? [...finde(teilbar.filter(imFilter), suche, 300)] : teilbar.filter(imFilter);
    const nachApp = new Map<string, Eintrag[]>();
    for (const e of liste) nachApp.set(e.werkzeug, [...(nachApp.get(e.werkzeug) ?? []), e]);
    const nachAppGruppen = [...nachApp.entries()]
      .sort((a, b) => werkzeugName(a[0]).localeCompare(werkzeugName(b[0])))
      .map(([werkzeug, eintraege]) => ({
        werkzeug,
        eintraege: suche.trim() ? eintraege : [...eintraege].sort((a, b) => a.name.localeCompare(b.name))
      }));
    /*
     * Zuletzt geoeffnet: der Ort eines Werkzeugs ist die Kennung des
     * Eintrags; im Story Creator nur die Notiz, ohne Kampagne davor.
     */
    const imBlick = new Set(liste.map(eintragsSchluessel));
    const neu: Eintrag[] = [];
    for (const z of zuletzt) {
      const e = teilbar.find(
        (x) => x.werkzeug === z.werkzeug && (x.kennung === z.ort || x.kennung.endsWith(`/${z.ort}`))
      );
      if (e && imBlick.has(eintragsSchluessel(e)) && !neu.includes(e)) neu.push(e);
      if (neu.length >= ZULETZT_ANZAHL) break;
    }
    // Zuletzt hinzugefuegt (oder geaendert): nach der Speicherzeit, die die
    // Huelle mitliefert. Offizielle Regeln haben keine und fehlen hier.
    const frisch = liste
      .filter((e) => e.geaendert)
      .sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? ''))
      .slice(0, ZULETZT_ANZAHL);
    return [
      ...(neu.length ? [{ werkzeug: ZULETZT, eintraege: neu }] : []),
      ...(frisch.length ? [{ werkzeug: NEU, eintraege: frisch }] : []),
      ...nachAppGruppen
    ];
  }, [teilbar, suche, apps, t, zuletzt]);

  // Vorschau beim Darueberfahren (Vorschau.tsx).
  const vorschau = useVorschau();
  const zeigeVorschau = (e: Eintrag, ziel: HTMLElement) =>
    vorschau.zeige(eintragsSchluessel(e), () => window.shell.austausch.vorschau(e.werkzeug, e.kennung), ziel);
  const versteckeVorschau = vorschau.verstecke;

  const schalteGruppe = (id: string) => {
    const neu = new Set(offen);
    if (neu.has(id)) neu.delete(id);
    else neu.add(id);
    setOffen(neu);
  };

  const schalteApp = (id: string) => {
    const neu = new Set(apps);
    if (neu.has(id)) neu.delete(id);
    else neu.add(id);
    setApps(neu);
  };

  const schalte = (schluessel: readonly string[], an: boolean) => {
    const neu = new Set(gewaehlt);
    for (const k of schluessel) {
      if (an) neu.add(k);
      else neu.delete(k);
    }
    setGewaehlt(neu);
  };

  if (teilbar === null) return <p className="einst__satz">{t('search.loading')}</p>;

  return (
    <div className="auswahl" data-auswahl>
      <div className="auswahl__chips" role="group" aria-label={t('share.filterApps')}>
        <button
          type="button"
          className={apps.size === 0 ? 'auswahl__chip is-an' : 'auswahl__chip'}
          aria-pressed={apps.size === 0}
          data-chip="alle"
          onClick={() => setApps(new Set())}
        >
          {t('share.allApps')}
        </button>
        {chips.map(([id, anzahl]) => (
          <button
            key={id}
            type="button"
            className={apps.has(id) ? 'auswahl__chip is-an' : 'auswahl__chip'}
            aria-pressed={apps.has(id)}
            data-chip={id}
            onClick={() => schalteApp(id)}
          >
            <AppSymbol id={id} size={16} bild={symbole[id]} />
            {werkzeugName(id)}
            <span className="auswahl__zahl">{anzahl}</span>
          </button>
        ))}
      </div>

      <input
        className="suche__feld austausch__filter"
        value={suche}
        placeholder={t('share.filter')}
        data-auswahl-suche
        onChange={(e) => setSuche(e.target.value)}
      />

      {vorschau.karte}

      {gruppen.length === 0 ? (
        <p className="einst__satz">{t('share.nothing')}</p>
      ) : (
        <div className="auswahl__gruppen">
          {gruppen.map(({ werkzeug, eintraege }) => {
            const schluessel = eintraege.map(eintragsSchluessel);
            const alle = schluessel.every((k) => gewaehlt.has(k));
            const aufgeklappt = offen.has(werkzeug) || suche.trim() !== '';
            const gewaehltHier = schluessel.filter((k) => gewaehlt.has(k)).length;
            return (
              <section
                key={werkzeug}
                className={aufgeklappt ? 'auswahl__gruppe is-offen motion-erscheinen' : 'auswahl__gruppe motion-erscheinen'}
                data-gruppe={werkzeug}
                data-offen={aufgeklappt}
              >
                {/* Die ganze Kopfzeile klappt, nicht nur der Pfeil (Rueckmeldung);
                    der Knopf „Alle" rechts bleibt fuer sich. */}
                <header
                  className="auswahl__kopf"
                  data-gruppe-kopf={werkzeug}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest('.auswahl__alle, .auswahl__klappe')) return;
                    schalteGruppe(werkzeug);
                  }}
                >
                  <button
                    type="button"
                    className="auswahl__klappe"
                    aria-expanded={aufgeklappt}
                    data-gruppe-klappe={werkzeug}
                    onClick={() => schalteGruppe(werkzeug)}
                  >
                    <span className="auswahl__pfeil" aria-hidden="true">
                      ›
                    </span>
                  </button>
                  {istSondergruppe(werkzeug) ? (
                    <span className="auswahl__uhr" aria-hidden="true">
                      {werkzeug === NEU ? '✚' : '⏲'}
                    </span>
                  ) : (
                    <AppSymbol id={werkzeug} size={20} bild={symbole[werkzeug]} />
                  )}
                  <strong>
                    {werkzeug === ZULETZT ? t('share.recent') : werkzeug === NEU ? t('share.recentlyAdded') : werkzeugName(werkzeug)}
                  </strong>
                  <span className="auswahl__zahl">
                    {gewaehltHier > 0 ? `${gewaehltHier} / ${eintraege.length}` : eintraege.length}
                  </span>
                  <span className="auswahl__luecke" />
                  <button
                    type="button"
                    className="auswahl__alle"
                    data-gruppe-alle={werkzeug}
                    onClick={() => schalte(schluessel, !alle)}
                  >
                    {alle ? t('share.noneInGroup') : t('share.allInGroup')}
                  </button>
                </header>
                {aufgeklappt ? (
                <ul className="auswahl__liste" data-pfeile="liste">
                  {eintraege.map((e) => {
                    const k = eintragsSchluessel(e);
                    const an = gewaehlt.has(k);
                    return (
                      <li data-pfeil key={k}>
                        <label
                          className={an ? 'auswahl__karte is-an' : 'auswahl__karte'}
                          onMouseEnter={(ev) => zeigeVorschau(e, ev.currentTarget)}
                          onMouseLeave={versteckeVorschau}
                        >
                          <input
                            type="checkbox"
                            data-teilen={k}
                            checked={an}
                            onChange={() => schalte([k], !an)}
                          />
                          {istSondergruppe(werkzeug) ? <AppSymbol id={e.werkzeug} size={16} bild={symbole[e.werkzeug]} /> : null}
                          <span className="auswahl__name">{e.name}</span>
                          {e.art ? <span className="auswahl__art">{e.art}</span> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
});
