/**
 * Der Campaign Calendar (docs/kampagnenkalender.md).
 *
 * Zwei Ansichten: die Sammlung (nächste Termine und Umfragen) und eine
 * Umfrage. In der Umfrage links das eigene Raster zum Ziehen, rechts die
 * Heatmap aller; darunter die besten Termine. Jede Änderung wird gleich
 * gespeichert; im Raum geht die eigene Antwort sofort an alle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { api } from './api';
import { getLanguage, setLanguage, t } from './i18n';
import {
  belegung,
  besteTermine,
  erfuellt,
  gewicht,
  leereUmfrage,
  mitAntwort,
  sichtbareAntworten,
  tageZwischen,
  uhrzeit,
  type Filter,
  type Stufe,
  type Umfrage
} from '../shared/modell';
import { alleZonen, ansicht, eigeneZone, istZone, zeitraum } from '../shared/zeitzone';
import type { RaumLage } from '../main/embed';

type Sprache = 'de' | 'en';

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

const NAME_SPEICHER = 'kalender.name';
const ZONE_SPEICHER = 'kalender.zone';
const KEIN_RAUM: RaumLage = { rolle: 'aus', ich: null, personen: [] };

function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tagText(tag: string, s: Sprache, lang = false): string {
  const d = new Date(`${tag}T12:00:00`);
  return d.toLocaleDateString(s === 'de' ? 'de-DE' : 'en-GB', lang ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'numeric' });
}

/** Mo–So in der Reihenfolge der Woche, mit getDay()-Zahl. */
const WOCHE: readonly { tag: number; de: string; en: string }[] = [
  { tag: 1, de: 'Mo', en: 'Mon' },
  { tag: 2, de: 'Di', en: 'Tue' },
  { tag: 3, de: 'Mi', en: 'Wed' },
  { tag: 4, de: 'Do', en: 'Thu' },
  { tag: 5, de: 'Fr', en: 'Fri' },
  { tag: 6, de: 'Sa', en: 'Sat' },
  { tag: 0, de: 'So', en: 'Sun' }
];

function leseZone(): string {
  try {
    const z = localStorage.getItem(ZONE_SPEICHER) ?? '';
    return istZone(z) ? z : eigeneZone();
  } catch {
    return eigeneZone();
  }
}

function leseName(): string {
  try {
    return localStorage.getItem(NAME_SPEICHER) ?? '';
  } catch {
    return '';
  }
}

export function App() {
  const [, neuZeichnen] = useState(0);
  const [umfragen, setUmfragen] = useState<readonly Umfrage[]>([]);
  const [offen, setOffen] = useState<Umfrage | null>(null);
  const [lage, setLage] = useState<RaumLage>(KEIN_RAUM);
  const [name, setName] = useState(leseName);
  const [zone, setZone] = useState(leseZone);
  useEffect(() => {
    try {
      localStorage.setItem(ZONE_SPEICHER, zone);
    } catch {
      // ohne Speicher gilt die Zone des Rechners
    }
  }, [zone]);
  const [modus, setModus] = useState<Stufe>('kann');
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const speicherZeit = useRef<number | null>(null);
  const offenRef = useRef<Umfrage | null>(null);
  offenRef.current = offen;

  const ladeListe = useCallback(async () => setUmfragen(await api.sammlung.liste()), []);
  useEffect(() => {
    void ladeListe();
    void api.raum.lage().then(setLage);
    return api.raum.beiZustand(setLage);
  }, [ladeListe]);

  // Im Raum heißt man, wie man im Raum heißt.
  useEffect(() => {
    if (lage.ich?.name && !name) setName(lage.ich.name);
  }, [lage, name]);
  useEffect(() => {
    try {
      localStorage.setItem(NAME_SPEICHER, name);
    } catch {
      // ohne Speicher eben jedes Mal neu
    }
  }, [name]);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  /** Speichern mit kurzer Verzögerung; beim Ziehen nicht bei jedem Feld. */
  const speichereSpaeter = (u: Umfrage) => {
    if (speicherZeit.current !== null) window.clearTimeout(speicherZeit.current);
    speicherZeit.current = window.setTimeout(() => {
      speicherZeit.current = null;
      void api.sammlung.speichern(u).then(() => ladeListe());
    }, 350);
  };
  const speichereSofort = async () => {
    if (speicherZeit.current !== null) {
      window.clearTimeout(speicherZeit.current);
      speicherZeit.current = null;
    }
    if (offenRef.current) await api.sammlung.speichern(offenRef.current);
  };

  const aendere = (u: Umfrage) => {
    setOffen(u);
    speichereSpaeter(u);
  };

  const oeffne = async (id: string) => {
    await speichereSofort();
    const u = await api.sammlung.lesen(id);
    if (u) setOffen(u);
    setMeldung('');
    setFehler('');
  };

  // Eine Antwort aus dem Raum liegt schon auf der Platte (die Hülle hat sie
  // zusammengeführt): eigene Änderungen erst sichern, dann neu lesen.
  useEffect(
    () =>
      api.raum.beiNeu(() => {
        void (async () => {
          await speichereSofort();
          await ladeListe();
          const jetzt = offenRef.current;
          if (jetzt) {
            const neu = await api.sammlung.lesen(jetzt.id);
            if (neu) setOffen(neu);
          }
        })();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ort = offen ? offen.id : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) setOffen(null);
        else void oeffne(ziel);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(
    () => api.beiSuchtreffer((kennung) => void oeffne(kennung)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const spr = sprache();

  // --- Eine Umfrage --------------------------------------------------------------
  if (offen) {
    return (
      <UmfrageAnsicht
        u={offen}
        lage={lage}
        name={name}
        setName={setName}
        zone={zone}
        setZone={setZone}
        modus={modus}
        setModus={setModus}
        aendere={aendere}
        meldung={meldung}
        fehler={fehler}
        setMeldung={setMeldung}
        setFehler={setFehler}
        zurueck={() =>
          void (async () => {
            await speichereSofort();
            setOffen(null);
            await ladeListe();
          })()
        }
        loesche={() =>
          void (async () => {
            if (!confirm(t('loeschen.sicher', { name: offen.titel || offen.id }))) return;
            if (speicherZeit.current !== null) window.clearTimeout(speicherZeit.current);
            speicherZeit.current = null;
            await api.sammlung.loeschen(offen.id);
            setOffen(null);
            await ladeListe();
          })()
        }
        speichereSofort={speichereSofort}
      />
    );
  }

  // --- Die Sammlung --------------------------------------------------------------
  const kommende = umfragen
    .filter((u) => u.termin && u.termin.tag >= heute())
    .sort((a, b) => (a.termin!.tag + a.termin!.von).localeCompare(b.termin!.tag + b.termin!.von));
  return (
    <div className="rahmen">
      <Kopf />
      <div className="leiste">
        <button
          type="button"
          className="knopf knopf--haupt"
          data-neu
          onClick={() => {
            const u = leereUmfrage(`u-${Date.now().toString(36)}`, heute(), eigeneZone());
            setOffen(u);
            void api.sammlung.speichern(u).then(() => ladeListe());
          }}
        >
          + {t('neu')}
        </button>
        <button
          type="button"
          className="knopf"
          data-einlesen
          onClick={() =>
            void (async () => {
              const r = await api.datei.importiere();
              if (r.ok) {
                setMeldung(t('eingelesen'));
                await ladeListe();
                await oeffne(r.id);
              } else if (r.text) setFehler(r.text);
            })()
          }
        >
          {t('einlesen')}
        </button>
      </div>
      {meldung ? <p className="meldung">{meldung}</p> : null}
      {fehler ? <p className="fehler">{fehler}</p> : null}
      {kommende.length ? (
        <section className="karte" data-naechste>
          <h2>{t('naechste')}</h2>
          <ul className="termine">
            {kommende.map((u) => {
              const z = zeitraum(u, u.termin!, zone);
              return (
                <li key={u.id}>
                  <button type="button" className="verweis" onClick={() => void oeffne(u.id)}>
                    <strong>{tagText(z.tag, spr, true)}</strong>, {uhrzeit(z.von)}–{uhrzeit(z.bis)} · {u.titel || t('ohneTitel')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <h2>{t('umfragen')}</h2>
      {umfragen.length === 0 ? <p className="leise">{t('liste.leer')}</p> : null}
      <div className="kacheln" data-pfeile="raster">
        {[...umfragen]
          .sort((a, b) => b.geaendert.localeCompare(a.geaendert))
          .map((u) => (
            <button key={u.id} type="button" className="kachel" data-umfrage={u.id} data-pfeil onClick={() => void oeffne(u.id)}>
              <span className="kachel__name">{u.titel || t('ohneTitel')}</span>
              <span className="leise">
                {u.tage.length ? `${tagText(u.tage[0], spr)} – ${tagText(u.tage[u.tage.length - 1], spr)}` : '—'}
              </span>
              <span className="leise">{t('antworten', { n: u.antworten.length })}</span>
              {u.termin ? (
                <span className="marke marke--an">
                  📅 {tagText(zeitraum(u, u.termin, zone).tag, spr)}, {uhrzeit(zeitraum(u, u.termin, zone).von)}
                </span>
              ) : null}
            </button>
          ))}
      </div>
    </div>
  );
}

function Kopf() {
  return (
    <header className="kopf">
      <h1>{t('titel')}</h1>
      <p>{t('untertitel')}</p>
    </header>
  );
}

interface AnsichtProps {
  readonly u: Umfrage;
  readonly lage: RaumLage;
  readonly name: string;
  readonly setName: (n: string) => void;
  readonly zone: string;
  readonly setZone: (z: string) => void;
  readonly modus: Stufe;
  readonly setModus: (m: Stufe) => void;
  readonly aendere: (u: Umfrage) => void;
  readonly meldung: string;
  readonly fehler: string;
  readonly setMeldung: (m: string) => void;
  readonly setFehler: (m: string) => void;
  readonly zurueck: () => void;
  readonly loesche: () => void;
  readonly speichereSofort: () => Promise<void>;
}

function UmfrageAnsicht({ u, lage, name, setName, zone, setZone, modus, setModus, aendere, meldung, fehler, setMeldung, setFehler, zurueck, loesche, speichereSofort }: AnsichtProps) {
  const spr = sprache();
  const sichtRaster = useMemo(() => ansicht(u, zone), [u, zone]);
  const ich = u.antworten.find((a) => a.person.trim().toLowerCase() === name.trim().toLowerCase());
  const meine = ich?.felder ?? {};
  /** Beim Ziehen: Startzelle (Spalte, Zeile), setzen oder entfernen, und der Stand vor dem Ziehen. */
  const zieht = useRef<{ setzen: boolean; spalte: number; zeile: number; basis: Record<string, Stufe> } | null>(null);
  const [filter, setFilter] = useState<{ aus: readonly string[]; mindestens: number | null; pflicht: readonly string[] }>({ aus: [], mindestens: null, pflicht: [] });
  const [entwurf, setEntwurfZustand] = useState<Record<string, Stufe> | null>(null);
  // Der Entwurf auch als Ref: `ende` liest ihn sofort, ohne auf das nächste
  // Zeichnen zu warten (Tastatur: beginne und ende im selben Ereignis).
  const entwurfRef = useRef<Record<string, Stufe> | null>(null);
  const setEntwurf = (e: Record<string, Stufe> | null) => {
    entwurfRef.current = e;
    setEntwurfZustand(e);
  };
  const sicht = entwurf ?? meine;
  const imRaum = lage.rolle !== 'aus';

  const startTag = u.tage[0] ?? heute();
  const endeTag = u.tage[u.tage.length - 1] ?? heute();
  const wochentage = useMemo(() => [...new Set(u.tage.map((d) => new Date(`${d}T12:00:00Z`).getUTCDay()))], [u.tage]);

  const setzeTage = (start: string, ende: string, wt: readonly number[]) => aendere({ ...u, tage: tageZwischen(start, ende, wt) });

  /*
   * Ziehen markiert ein Rechteck von der Startzelle bis zur Zelle unter dem
   * Zeiger. Die Startzelle entscheidet: war sie leer, wird gesetzt, sonst
   * entfernt. So wählt ein Klick auf ein markiertes Feld es wieder ab.
   */
  const rechteck = (basis: Record<string, Stufe>, a: { spalte: number; zeile: number }, b: { spalte: number; zeile: number }, setzen: boolean) => {
    const neu = { ...basis };
    for (let sp = Math.min(a.spalte, b.spalte); sp <= Math.max(a.spalte, b.spalte); sp += 1) {
      for (let ze = Math.min(a.zeile, b.zeile); ze <= Math.max(a.zeile, b.zeile); ze += 1) {
        const f = sichtRaster.feldAn(sichtRaster.tage[sp], sichtRaster.minuten[ze]);
        if (!f) continue;
        if (setzen) neu[f] = modus;
        else delete neu[f];
      }
    }
    return neu;
  };
  const beginne = (f: string, spalte: number, zeile: number) => {
    if (!name.trim()) {
      setFehler(t('ich.fehlt'));
      return;
    }
    setFehler('');
    const setzen = !sicht[f];
    zieht.current = { setzen, spalte, zeile, basis: { ...sicht } };
    setEntwurf(rechteck(sicht, { spalte, zeile }, { spalte, zeile }, setzen));
  };
  const ueber = (spalte: number, zeile: number) => {
    const z = zieht.current;
    if (!z) return;
    setEntwurf(rechteck(z.basis, z, { spalte, zeile }, z.setzen));
  };
  const ende = useCallback(() => {
    if (!zieht.current) return;
    zieht.current = null;
    const e = entwurfRef.current;
    setEntwurf(null);
    if (!e) return;
    const antwort = { person: name.trim(), felder: e, zeit: new Date().toISOString() };
    aendere(mitAntwort(u, antwort));
    if (imRaum) void api.raum.sende(JSON.stringify({ art: 'antwort', umfrageId: u.id, antwort }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, u, aendere, imRaum]);
  useEffect(() => {
    window.addEventListener('pointerup', ende);
    return () => window.removeEventListener('pointerup', ende);
  }, [ende]);

  const sichtbar = u.antworten.filter((a) => !filter.aus.includes(a.person));
  const aktiverFilter: Filter = {
    personen: sichtbar.map((a) => a.person),
    mindestens: filter.mindestens,
    pflicht: filter.pflicht.filter((p) => sichtbar.some((a) => a.person === p))
  };
  const gefiltert = filter.aus.length > 0 || filter.mindestens !== null || aktiverFilter.pflicht!.length > 0;
  const vorschlaege = besteTermine(u, 3, aktiverFilter);
  const fehlen = lage.personen.filter((p) => !u.antworten.some((a) => a.person.trim().toLowerCase() === p.name.trim().toLowerCase())).map((p) => p.name);

  const meineZelle = (f: string, spalte: number, zeile: number) => {
    const s = sicht[f];
    return (
      <button
        key={f}
        type="button"
        className={`zelle ${s ? `zelle--${s}` : ''}`}
        data-feld={f}
        data-stufe={s ?? ''}
        aria-pressed={Boolean(s)}
        onPointerDown={(e) => {
          e.preventDefault();
          // Bei Fingern hält der Browser den Zeiger am ersten Feld fest; ohne
          // Freigabe kämen die übrigen Felder beim Ziehen nie an.
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          beginne(f, spalte, zeile);
        }}
        onPointerEnter={() => ueber(spalte, zeile)}
        onKeyDown={(e) => {
          if (e.key !== ' ' && e.key !== 'Enter') return;
          e.preventDefault();
          beginne(f, spalte, zeile);
          ende();
        }}
      />
    );
  };
  const alleZelle = (f: string) => {
    const b = belegung({ ...u, antworten: sichtbareAntworten(u, aktiverFilter) }, f);
    const passt = erfuellt([...b.kann, ...b.notfalls], aktiverFilter);
    const anteil = sichtbar.length && passt ? gewicht(b) / sichtbar.length : 0;
    const titel = [
      b.kann.length ? `✓ ${b.kann.join(', ')}` : '',
      b.notfalls.length ? `~ ${b.notfalls.join(', ')}` : '',
      b.nicht.length ? `✗ ${b.nicht.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    return (
      <span
        key={f}
        className="zelle zelle--heat"
        data-heat={f}
        data-anzahl={b.kann.length}
        data-passt={passt ? '1' : '0'}
        title={titel}
        style={{ background: `color-mix(in srgb, var(--betont) ${Math.round(anteil * 100)}%, var(--grund-tief))` }}
      />
    );
  };
  const rasterMit = (zelle: (f: string, spalte: number, zeile: number) => JSX.Element, art: string) => (
    <div className="raster" style={{ gridTemplateColumns: `4.2em repeat(${sichtRaster.tage.length}, minmax(2.6em, 1fr))` }} data-raster={art}>
      <span />
      {sichtRaster.tage.map((tag) => (
        <span key={tag} className="raster__kopf">
          {tagText(tag, spr)}
        </span>
      ))}
      {sichtRaster.minuten.flatMap((m, zeile) => [
        <span key={`z${m}`} className="raster__zeit">
          {uhrzeit(m)}
        </span>,
        ...sichtRaster.tage.map((tag, spalte) => {
          const f = sichtRaster.feldAn(tag, m);
          // Durch die Umrechnung kann eine Zelle zu keinem Feld der Umfrage gehören.
          return f ? zelle(f, spalte, zeile) : <span key={`${tag}-${m}`} className="zelle zelle--leer" />;
        })
      ])}
    </div>
  );
  const zonen = useMemo(() => alleZonen(), []);
  const zonenListe = (wert: string) => (zonen.includes(wert) || !wert ? zonen : [wert, ...zonen]);
  const zeigeZeitraum = (x: { tag: string; von: number; bis: number }) => {
    const z = zeitraum(u, x, zone);
    return (
      <>
        <strong>{tagText(z.tag, spr, true)}</strong>, {uhrzeit(z.von)}–{uhrzeit(z.bis)}
      </>
    );
  };

  return (
    <div className="rahmen">
      <Kopf />
      <div className="leiste">
        <button type="button" className="knopf" data-zurueck onClick={zurueck}>
          ← {t('zurueck')}
        </button>
        <input
          className="eingabe titel"
          value={u.titel}
          placeholder={t('feld.titelPlatz')}
          aria-label={t('feld.titel')}
          data-titel
          onChange={(e) => aendere({ ...u, titel: e.target.value })}
        />
        <button
          type="button"
          className="knopf"
          data-teilen
          onClick={() =>
            void (async () => {
              if (!imRaum) {
                setMeldung(t('teilen.aus'));
                return;
              }
              await speichereSofort();
              const ok = await api.raum.sende(JSON.stringify({ art: 'umfrage', umfrage: u }));
              setMeldung(ok ? t('teilen.fertig') : t('teilen.aus'));
            })()
          }
        >
          {t('teilen')}
        </button>
        <button
          type="button"
          className="knopf"
          data-datei
          onClick={() =>
            void (async () => {
              await speichereSofort();
              const r = await api.datei.exportiere(u.id);
              if (r.ok) setMeldung(t('datei.fertig', { pfad: r.text }));
            })()
          }
        >
          {t('datei')}
        </button>
        <button type="button" className="knopf knopf--gefahr" data-loeschen onClick={loesche}>
          {t('loeschen')}
        </button>
      </div>
      {meldung ? (
        <p className="meldung" data-meldung>
          {meldung}
        </p>
      ) : null}
      {fehler ? (
        <p className="fehler" data-fehler>
          {fehler}
        </p>
      ) : null}

      <details className="karte" open={u.antworten.length === 0}>
        <summary>
          <strong>{t('einstellungen')}</strong>
        </summary>
        <div className="leiste">
          <label className="wahl">
            <span>{t('feld.von')}</span>
            <input type="date" className="eingabe" value={startTag} data-start onChange={(e) => setzeTage(e.target.value, endeTag, wochentage)} />
          </label>
          <label className="wahl">
            <span>{t('feld.bis')}</span>
            <input type="date" className="eingabe" value={endeTag} data-ende onChange={(e) => setzeTage(startTag, e.target.value, wochentage)} />
          </label>
        </div>
        <div className="leiste" role="group" aria-label={t('feld.tage')}>
          {WOCHE.map((w) => {
            const an = wochentage.includes(w.tag);
            return (
              <button
                key={w.tag}
                type="button"
                className={an ? 'chip chip--an' : 'chip'}
                aria-pressed={an}
                data-wochentag={w.tag}
                onClick={() => {
                  const neu = an ? wochentage.filter((x) => x !== w.tag) : [...wochentage, w.tag];
                  // Ohne gewählte Tage bliebe kein Datum übrig; dann wird der Start neu genommen.
                  setzeTage(startTag, endeTag, neu.length ? neu : [w.tag]);
                }}
              >
                {w[spr]}
              </button>
            );
          })}
        </div>
        <div className="leiste">
          <label className="wahl">
            <span>{t('feld.uhrVon')}</span>
            <select value={u.von} data-uhr-von onChange={(e) => aendere({ ...u, von: Number(e.target.value), bis: Math.max(u.bis, Number(e.target.value) + 60) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h * 60}>
                  {uhrzeit(h * 60)}
                </option>
              ))}
            </select>
          </label>
          <label className="wahl">
            <span>{t('feld.uhrBis')}</span>
            <select value={u.bis} data-uhr-bis onChange={(e) => aendere({ ...u, bis: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (h + 1) * 60)
                .filter((m) => m > u.von)
                .map((m) => (
                  <option key={m} value={m}>
                    {uhrzeit(m)}
                  </option>
                ))}
            </select>
          </label>
          <label className="wahl">
            <span>{t('feld.schritt')}</span>
            <select value={u.schritt} data-schritt onChange={(e) => aendere({ ...u, schritt: Number(e.target.value) === 30 ? 30 : 60 })}>
              <option value={60}>{t('minuten', { n: 60 })}</option>
              <option value={30}>{t('minuten', { n: 30 })}</option>
            </select>
          </label>
          <label className="wahl">
            <span>{t('feld.dauer')}</span>
            <select value={u.dauer ?? ''} data-dauer onChange={(e) => aendere({ ...u, dauer: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">{t('dauer.offen')}</option>
              {[1, 2, 3, 4, 5, 6, 8].map((h) => (
                <option key={h} value={h * 60}>
                  {t('stunden', { n: h })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="leiste">
          <label className="wahl">
            <span>{t('zone.umfrage')}</span>
            <select value={u.zone} data-zone-umfrage onChange={(e) => aendere({ ...u, zone: e.target.value })}>
              <option value="">{t('zone.ohne')}</option>
              {zonenListe(u.zone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="leise klein">{u.zone ? t('zone.hinweis') : t('zeitzone')}</p>
      </details>

      <div className="leiste">
        <label className="wahl">
          <span>{t('ich')}</span>
          <input className="eingabe" value={name} placeholder={t('ich.platz')} data-name onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="schalter" role="group">
          {(['kann', 'notfalls'] as const).map((m) => (
            <button key={m} type="button" className={modus === m ? `chip chip--an chip--${m}` : 'chip'} aria-pressed={modus === m} data-modus={m} onClick={() => setModus(m)}>
              {t(m === 'kann' ? 'modus.kann' : 'modus.notfalls')}
            </button>
          ))}
        </div>
        {u.zone ? (
          <label className="wahl">
            <span>{t('zone.ich')}</span>
            <select value={zone} data-zone-ich onChange={(e) => setZone(e.target.value)}>
              {zonenListe(zone).map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {imRaum && fehlen.length ? <span className="leise">{t('fehlen', { namen: fehlen.join(', ') })}</span> : null}
      </div>

      <div className="zwei">
        <section className="karte">
          <h2>{t('meine')}</h2>
          <p className="leise klein">{t('meine.hinweis')}</p>
          {rasterMit(meineZelle, 'meine')}
        </section>
        <section className="karte">
          <h2>
            {t('alle')} <span className="leise">({u.antworten.length})</span>
          </h2>
          {u.antworten.length === 0 ? (
            <p className="leise klein">{t('alle.leer')}</p>
          ) : (
            <div className="filter" data-filter>
              <div className="leiste" role="group" aria-label={t('filter.personen')}>
                <span className="leise klein">{t('filter.personen')}:</span>
                {u.antworten.map((a) => {
                  const an = !filter.aus.includes(a.person);
                  return (
                    <button
                      key={a.person}
                      type="button"
                      className={an ? 'chip chip--an' : 'chip'}
                      aria-pressed={an}
                      data-person={a.person}
                      onClick={() => setFilter({ ...filter, aus: an ? [...filter.aus, a.person] : filter.aus.filter((x) => x !== a.person) })}
                    >
                      {a.person}
                    </button>
                  );
                })}
              </div>
              <div className="leiste">
                <label className="wahl">
                  <span>{t('filter.mindestens')}</span>
                  <select
                    value={filter.mindestens ?? ''}
                    data-mindestens
                    onChange={(e) => setFilter({ ...filter, mindestens: e.target.value === '' ? null : Number(e.target.value) })}
                  >
                    <option value="">{t('filter.alle')}</option>
                    {sichtbar.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {t('filter.personenZahl', { n: i + 1 })}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="leise klein">{t('filter.pflicht')}:</span>
                {sichtbar.map((a) => {
                  const an = filter.pflicht.includes(a.person);
                  return (
                    <button
                      key={a.person}
                      type="button"
                      className={an ? 'chip chip--an' : 'chip'}
                      aria-pressed={an}
                      data-pflicht={a.person}
                      onClick={() => setFilter({ ...filter, pflicht: an ? filter.pflicht.filter((x) => x !== a.person) : [...filter.pflicht, a.person] })}
                    >
                      {a.person}
                    </button>
                  );
                })}
              </div>
              {gefiltert ? <p className="leise klein">{t('filter.hinweis')}</p> : null}
            </div>
          )}
          {rasterMit(alleZelle, 'alle')}
        </section>
      </div>

      <section className="karte" data-beste>
        <h2>{t('beste')}</h2>
        {u.termin ? (
          <p className="termin" data-termin>
            📅 {zeigeZeitraum(u.termin)}{' '}
            <button
              type="button"
              className="knopf knopf--klein"
              data-ics
              onClick={() =>
                void (async () => {
                  await speichereSofort();
                  const r = await api.datei.ics(u.id);
                  if (r.ok) setMeldung(t('ics.fertig', { pfad: r.text }));
                })()
              }
            >
              {t('ics')}
            </button>{' '}
            <button type="button" className="knopf knopf--klein" data-termin-loesen onClick={() => aendere({ ...u, termin: null })}>
              {t('termin.loesen')}
            </button>
          </p>
        ) : null}
        {vorschlaege.length === 0 ? <p className="leise">{u.dauer === null ? t('beste.leer.offen') : t('beste.leer')}</p> : null}
        <ol className="vorschlaege">
          {vorschlaege.map((v) => (
            <li key={`${v.tag}-${v.von}`} data-vorschlag={`${v.tag}-${v.von}`}>
              {zeigeZeitraum(v)}
              <span className="leise">
                {' · '}
                {t('beste.kann', { namen: v.kann.join(', ') || '—' })}
                {v.notfalls.length ? ` · ${t('beste.notfalls', { namen: v.notfalls.join(', ') })}` : ''}
              </span>{' '}
              <button type="button" className="knopf knopf--klein" data-festlegen onClick={() => aendere({ ...u, termin: { tag: v.tag, von: v.von, bis: v.bis } })}>
                {t('festlegen')}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="karte">
        <h2>{t('notiz')}</h2>
        <textarea className="flaeche" rows={3} value={u.notiz} data-notiz onChange={(e) => aendere({ ...u, notiz: e.target.value })} />
      </section>
    </div>
  );
}
