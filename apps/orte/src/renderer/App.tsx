/**
 * Der Settlement Generator (docs/ortsgenerator.md).
 *
 * Wie im NPC Creator: ein Knopf, ein fertiger Ort. Jedes Teil lässt sich
 * festhalten (🔒) und einzeln neu würfeln (🎲); die Texte lassen sich von
 * Hand ändern. Gespeichert wird in eine Sammlung mit Kacheln; von dort geht
 * ein Ort als Notizen in den Story Creator oder mit seinen Läden in den Loot
 * Generator.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { einzeln } from '@suite/tastatur';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { SELTENHEIT_NAME } from '@suite/srd';
import { api } from './api';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';
import {
  STANDARD_WUENSCHE,
  erzeugeOrt,
  lageName,
  wuerfleNeu,
  zauberdiensteFuer,
  type Feld,
  type Ort,
  type Person,
  type Wuensche
} from '../shared/erzeuge';
import { kurzzeile, preisText, type Gespeichert, type Kachel } from '../shared/ablage';
import { KI_FELDER, type KiFeld } from '../shared/kiAufgaben';

/** Fehlerschlüssel der KI (aus @suite/ki) → Text. Unbekanntes wird allgemein. */
function kiFehlerText(grund: string): TextKey {
  const bekannt: readonly string[] = ['error.aiNoProvider', 'error.aiKeinJson', 'error.aiNoConnection', 'error.aiTimeout', 'error.aiAuth', 'error.aiRateLimit', 'error.aiModelMissing'];
  return (bekannt.includes(grund) ? grund : 'error.aiOther') as TextKey;
}
import {
  GASTHAUS_PREISE,
  GETRAENKE,
  GROESSEN,
  GROESSE_NAME,
  LADEN_NAME,
  LAGEN,
  QUALITAETEN,
  QUALITAET_NAME,
  type Groesse,
  type Lage,
  type Sprache
} from '../shared/tabellen';

function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

const GROESSE_ZEICHEN: Record<Groesse, string> = { dorf: '🏡', kleinstadt: '🏘', stadt: '🏰' };

export function App() {
  // Strg+S und Klick kurz hintereinander: nur einmal speichern (sonst doppelte neue Einträge).
  const speichertGerade = useRef(false);
  const [, neuZeichnen] = useState(0);
  const [kacheln, setKacheln] = useState<readonly Kachel[]>([]);
  const [suche, setSuche] = useState('');
  const [wuensche, setWuensche] = useState<Wuensche>(STANDARD_WUENSCHE);
  const [offen, setOffen] = useState<Gespeichert | null>(null);
  const [istNeu, setIstNeu] = useState(false);
  const [stand, setStand] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState<readonly Feld[]>([]);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const [kampagnen, setKampagnen] = useState<{ liste: { id: string; name: string }[]; aktuell: string | null }>({ liste: [], aktuell: null });
  const [kampagne, setKampagne] = useState<string | null>(null);

  const setzeGrund = (o: Gespeichert | null) => {
    setOffen(o);
    setStand(o ? JSON.stringify(o) : null);
  };
  const veraendert = offen !== null && stand !== null && JSON.stringify(offen) !== stand;
  const darfVerwerfen = () => !veraendert || confirm(t('verwerfen.sicher'));

  const ladeListe = useCallback(async () => setKacheln(await api.sammlung.liste()), []);

  // KI: Knöpfe nur, wenn eine eingerichtet ist (Einstellungen der Hülle).
  const [kiDa, setKiDa] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [kiWunsch, setKiWunsch] = useState('');
  useEffect(() => {
    const pruefe = () => void api.ki.da().then(setKiDa).catch(() => setKiDa(false));
    pruefe();
    return api.ki.beiWechsel(pruefe);
  }, []);
  useEffect(() => {
    void ladeListe();
  }, [ladeListe]);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  const oeffne = async (id: string) => {
    const o = await api.sammlung.lesen(id);
    if (!o) {
      setFehler(t('fehler.lesen'));
      return;
    }
    setzeGrund(o);
    setIstNeu(false);
    setGesperrt([]);
    setMeldung('');
    setFehler('');
  };

  const ort = offen ? offen.id || 'entwurf' : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) {
          setzeGrund(null);
          setIstNeu(false);
          return;
        }
        if (ziel !== 'entwurf') void oeffne(ziel);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(
    () => api.beiSuchtreffer((kennung) => void oeffne(kennung)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Kampagnen für den Export; neu gefragt, wenn ein Ort aufgeht.
  useEffect(() => {
    if (!offen) return;
    void api.story.kampagnen().then((k) => {
      setKampagnen(k);
      setKampagne((alt) => alt ?? k.aktuell ?? k.liste[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen?.id]);

  const spr = sprache();

  const wuerfle = () => {
    if (!darfVerwerfen()) return;
    const o = erzeugeOrt(wuensche, spr, Math.random);
    setzeGrund({ ...o, id: '', sprache: spr, notiz: '', imLoot: false, geaendert: '' });
    // Ein frischer Ort ist ungespeichert; Zurück fragt nach.
    setStand(null);
    setIstNeu(true);
    setGesperrt([]);
    setMeldung('');
    setFehler('');
  };

  const gefunden = useMemo(() => {
    const worte = suche.toLowerCase().split(/\s+/).filter(Boolean);
    return [...kacheln]
      .filter((k) => worte.every((w) => `${k.name} ${k.kurz}`.toLowerCase().includes(w)))
      .sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  }, [kacheln, suche]);

  const wunschLeiste = (
    <div className="leiste" data-pfeile="zeile">
      <button type="button" className="knopf knopf--haupt" data-wuerfeln data-pfeil onClick={wuerfle}>
        🎲 {t('wuerfeln')}
      </button>
      <label className="wahl">
        <span>{t('wunsch.groesse')}</span>
        <select
          value={wuensche.groesse ?? ''}
          data-wunsch="groesse"
          onChange={(e) => setWuensche({ ...wuensche, groesse: (e.target.value || null) as Groesse | null })}
        >
          <option value="">{t('beliebig')}</option>
          {GROESSEN.map((g) => (
            <option key={g} value={g}>
              {GROESSE_NAME[g][spr]}
            </option>
          ))}
        </select>
      </label>
      <label className="wahl">
        <span>{t('wunsch.lage')}</span>
        <select value={wuensche.lage ?? ''} data-wunsch="lage" onChange={(e) => setWuensche({ ...wuensche, lage: (e.target.value || null) as Lage | null })}>
          <option value="">{t('beliebig')}</option>
          {LAGEN.map((l) => (
            <option key={l} value={l}>
              {lageName(l, spr)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  // --- Ein Ort -----------------------------------------------------------------
  if (offen) {
    const s = offen.sprache;
    const setze = (teil: Partial<Gespeichert>) => {
      setOffen({ ...offen, ...teil });
      setMeldung('');
    };
    const sperre = (f: Feld) => setGesperrt((alt) => (alt.includes(f) ? alt.filter((x) => x !== f) : [...alt, f]));
    const neuTeil = (f: Feld) => setze(wuerfleNeu(offen, f, s, Math.random) as Partial<Gespeichert>);
    /** Die KI schreibt die genannten Teile neu; festgehaltene bleiben, wenn es um alles geht. */
    const frageKi = async (felder: KiFeld[]) => {
      if (!felder.length) return;
      setKiLaeuft(true);
      setFehler('');
      try {
        const r = await api.ki.frage(offen, felder, kiWunsch, s);
        if (r.ok && r.wert) {
          setOffen((alt) => (alt ? { ...alt, ...r.wert } : alt));
          setMeldung(t('ki.fertig'));
        } else setFehler(t(kiFehlerText(r.grund)));
      } finally {
        setKiLaeuft(false);
      }
    };
    const kiKnopf = (feld: KiFeld) =>
      kiDa ? (
        <button
          type="button"
          className="knopf knopf--klein"
          title={t('ki.feld')}
          aria-label={t('ki.feld')}
          data-ki-feld={feld}
          disabled={kiLaeuft}
          onClick={() => void frageKi([feld])}
        >
          ✦
        </button>
      ) : null;
    const allesNeu = () => {
      const o: Ort = erzeugeOrt(wuensche, s, Math.random, gesperrt, offen);
      setze(o as Partial<Gespeichert>);
    };
    const speichere = async (): Promise<Gespeichert | null> => {
      setFehler('');
      if (!offen.name.trim()) {
        setFehler(t('fehler.name'));
        return null;
      }
      const ergebnis = await api.sammlung.speichern({ ...offen, name: offen.name.trim() }, istNeu);
      if (!ergebnis.ok) {
        setFehler(t('fehler.speichern', { detail: ergebnis.text }));
        return null;
      }
      const neu = (await api.sammlung.lesen(ergebnis.id)) ?? { ...offen, id: ergebnis.id };
      setzeGrund(neu);
      setIstNeu(false);
      setMeldung(t('gespeichert'));
      await ladeListe();
      return neu;
    };
    const exportiere = async () => {
      if (!kampagne) {
        setFehler(t('story.keine'));
        return;
      }
      setFehler('');
      let r = await api.story.exportiere(offen, kampagne, false);
      if (!r.ok && r.vorhanden && confirm(t('story.ersetzen', { text: r.text }))) r = await api.story.exportiere(offen, kampagne, true);
      if (r.ok) setMeldung(t('story.fertig', { text: r.text }));
      else setFehler(r.text);
    };
    // Als Funktionen, nicht als Komponenten: eine Komponente, die bei jedem
    // Zeichnen neu entsteht, würde das Textfeld beim Tippen neu einhängen
    // und den Fokus verlieren.
    const teil = (feld: Feld, titel: TextKey, inhalt: React.ReactNode) => (
      <section key={feld} className="karte teil" data-teil={feld}>
        <header className="teil__kopf">
          <h2>{t(titel)}</h2>
          <span className="leiste__luecke" />
          {(KI_FELDER as readonly string[]).includes(feld) ? kiKnopf(feld as KiFeld) : null}
          <button type="button" className="knopf knopf--klein" title={t('neu.teil')} aria-label={t('neu.teil')} data-neu-teil={feld} onClick={() => neuTeil(feld)}>
            🎲
          </button>
          <button
            type="button"
            className={gesperrt.includes(feld) ? 'knopf knopf--klein knopf--an' : 'knopf knopf--klein'}
            title={gesperrt.includes(feld) ? t('loesen') : t('festhalten')}
            aria-pressed={gesperrt.includes(feld)}
            data-sperre={feld}
            onClick={() => sperre(feld)}
          >
            {gesperrt.includes(feld) ? '🔒' : '🔓'}
          </button>
        </header>
        {inhalt}
      </section>
    );
    const textteil = (feld: 'herrschaft' | 'wirtschaft' | 'besonderheit' | 'problem') =>
      teil(
        feld,
        feld,
        <textarea className="flaeche" rows={2} value={offen[feld]} data-feld={feld} onChange={(e) => setze({ [feld]: e.target.value })} />
      );
    const personZeile = (p: Person, schluessel?: string) => (
      <details key={schluessel} className="person" data-person={p.figur.name}>
        <summary>
          <strong>{p.figur.name}</strong> <span className="leise">· {p.rolle} · {p.figur.spezies}</span>
        </summary>
        <p>{p.figur.aussehen}</p>
        <p>
          <span className="leise">{s === 'de' ? 'Will' : 'Wants'}:</span> {p.figur.motivation}
        </p>
        <p>
          <span className="leise">{s === 'de' ? 'Verschweigt' : 'Hides'}:</span> {p.figur.geheimnis}
        </p>
        {p.figur.eigenheit ? <p className="leise">{p.figur.eigenheit}</p> : null}
      </details>
    );
    const preise = GASTHAUS_PREISE[offen.gasthaus.qualitaet];
    return (
      <div className="rahmen">
        <Kopf />
        <div className="leiste">
          <button
            type="button"
            className="knopf"
            data-zurueck
            onClick={() => {
              if (!darfVerwerfen()) return;
              setzeGrund(null);
              setIstNeu(false);
            }}
          >
            ← {t('zurueck')}
          </button>
          <button type="button" className="knopf" data-alles-neu title={t('wuerfeln.hinweis')} onClick={allesNeu}>
            🎲 {t('wuerfeln.neu')}
          </button>
          {kiDa ? (
            <button
              type="button"
              className="knopf"
              data-ki
              title={t('ki.hinweis')}
              disabled={kiLaeuft}
              onClick={() => void frageKi(KI_FELDER.filter((f) => !gesperrt.includes(f)))}
            >
              {kiLaeuft ? t('ki.laeuft') : `✦ ${t('ki.knopf')}`}
            </button>
          ) : null}
          <span className="leiste__luecke" />
          {!istNeu ? (
            <button
              type="button"
              className="knopf"
              data-loot
              onClick={() =>
                void (async () => {
                  const g = await speichere();
                  if (!g) return;
                  const drin = !offen.imLoot;
                  if (await (drin ? api.sammlung.inDenLoot(g.id) : api.sammlung.ausDemLoot(g.id))) {
                    setzeGrund({ ...g, imLoot: drin });
                    setMeldung(t(drin ? 'loot.fertig' : 'loot.heraus'));
                  } else setFehler(t('loot.fehler'));
                })()
              }
            >
              {offen.imLoot ? t('loot.drin') : t('loot')}
            </button>
          ) : null}
          <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speichere)}>
            {t('speichern')}
          </button>
          {!istNeu ? (
            <button
              type="button"
              className="knopf knopf--gefahr"
              data-loeschen
              onClick={() =>
                void (async () => {
                  if (!confirm(t('loeschen.sicher', { name: offen.name }))) return;
                  await api.sammlung.loeschen(offen.id);
                  setzeGrund(null);
                  await ladeListe();
                })()
              }
            >
              {t('loeschen')}
            </button>
          ) : null}
        </div>

        <div className="leiste">
          <label className="wahl">
            <span>{t('story.kampagne')}</span>
            <select value={kampagne ?? ''} data-kampagne onChange={(e) => setKampagne(e.target.value || null)}>
              {kampagnen.liste.length === 0 ? <option value="">—</option> : null}
              {kampagnen.liste.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="knopf" data-story onClick={() => void exportiere()}>
            📜 {t('story.anlegen')}
          </button>
        </div>
        {kiDa ? (
          <input
            className="eingabe ki__wunsch"
            value={kiWunsch}
            data-ki-wunsch
            aria-label={t('ki.wunsch')}
            placeholder={`${t('ki.wunsch')}: ${t('ki.wunschBeispiel')}`}
            onChange={(e) => setKiWunsch(e.target.value)}
          />
        ) : null}
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

        <section className="karte kopfkarte" data-teil="name">
          <div className="leiste">
            <input className="titel" value={offen.name} data-feld="name" aria-label={t('name')} onChange={(e) => setze({ name: e.target.value })} />
            {kiKnopf('name')}
            <button type="button" className="knopf knopf--klein" title={t('neu.teil')} data-neu-teil="name" onClick={() => neuTeil('name')}>
              🎲
            </button>
            <button
              type="button"
              className={gesperrt.includes('name') ? 'knopf knopf--klein knopf--an' : 'knopf knopf--klein'}
              aria-pressed={gesperrt.includes('name')}
              data-sperre="name"
              onClick={() => sperre('name')}
            >
              {gesperrt.includes('name') ? '🔒' : '🔓'}
            </button>
          </div>
          <p className="leise" data-kurzzeile>
            {GROESSE_ZEICHEN[offen.groesse]} {kurzzeile(offen, spr)}
          </p>
        </section>

        <div className="raster">
          {textteil('herrschaft')}
          {textteil('wirtschaft')}
          {textteil('besonderheit')}
          {textteil('problem')}
        </div>

        {teil(
          'gasthaus',
          'gasthaus',
          <>
          <input className="eingabe" value={offen.gasthaus.name} data-feld="gasthaus" onChange={(e) => setze({ gasthaus: { ...offen.gasthaus, name: e.target.value } })} />
          <div className="leiste">
            <label className="wahl">
              <span>{t('qualitaet')}</span>
              <select
                value={offen.gasthaus.qualitaet}
                data-qualitaet
                onChange={(e) => setze({ gasthaus: { ...offen.gasthaus, qualitaet: e.target.value as typeof offen.gasthaus.qualitaet } })}
              >
                {QUALITAETEN.map((q) => (
                  <option key={q} value={q}>
                    {QUALITAET_NAME[q][spr]}
                  </option>
                ))}
              </select>
            </label>
            <span>
              <span className="leise">{t('spezialitaet')}:</span> {offen.gasthaus.spezialitaet}
            </span>
          </div>
          <table className="tabelle" data-gasthaus-preise>
            <tbody>
              <tr>
                <td>{t('uebernachtung')}</td>
                <td>{preisText(preise.nacht, spr)}</td>
              </tr>
              <tr>
                <td>{t('mahlzeit')}</td>
                <td>{preisText(preise.mahlzeit, spr)}</td>
              </tr>
              {GETRAENKE.map((g) => (
                <tr key={g.name.en}>
                  <td>{g.name[spr]}</td>
                  <td>{preisText(g.preis, spr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {personZeile(offen.gasthaus.wirt)}
          </>
        )}

        {teil(
          'laeden',
          'laeden',
          <div className="laeden">
            {offen.laeden.map((l) => (
              <article key={l.name} className="laden" data-laden={l.art}>
                <h3>{l.name}</h3>
                <p className="leise">{LADEN_NAME[l.art][spr]}</p>
                <table className="tabelle">
                  <thead>
                    <tr>
                      <th>{t('ware')}</th>
                      <th>{t('preis')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.waren.map((w) => (
                      <tr key={w.name}>
                        <td>
                          {w.name}
                          {w.seltenheit ? <span className="leise"> · {SELTENHEIT_NAME[w.seltenheit][spr]}</span> : null}
                        </td>
                        <td>{preisText(w.preis, spr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {personZeile(l.inhaber)}
              </article>
            ))}
          </div>
        )}

        {teil('personen', 'personen', <>{offen.personen.map((p) => personZeile(p, p.figur.name + p.rolle))}</>)}

        {teil(
          'geruechte',
          'geruechte',
          <ul className="geruechte">
            {offen.geruechte.map((g, i) => (
              <li key={i} data-geruecht={g.wahr ? 'wahr' : 'falsch'}>
                <button
                  type="button"
                  className={g.wahr ? 'marke marke--wahr' : 'marke'}
                  onClick={() => setze({ geruechte: offen.geruechte.map((x, j) => (j === i ? { ...x, wahr: !x.wahr } : x)) })}
                >
                  {g.wahr ? t('wahr') : t('falsch')}
                </button>{' '}
                {g.text}
              </li>
            ))}
          </ul>
        )}

        <section className="karte" data-zauberdienste>
          <h2>{t('zauberdienste')}</h2>
          <table className="tabelle">
            <tbody>
              {zauberdiensteFuer(offen.groesse).map((d) => (
                <tr key={d.grade}>
                  <td>{d.grade === '0' ? t('zauberdienste.trick') : t('zauberdienste.grad', { grad: d.grade })}</td>
                  <td>{preisText(d.kosten, spr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="karte">
          <h2>{t('notiz')}</h2>
          <textarea className="flaeche" rows={4} value={offen.notiz} data-feld="notiz" onChange={(e) => setze({ notiz: e.target.value })} />
        </section>

        <p className="leise klein">{t('quelle.srd')}</p>
        <p className="leise klein">{t('quelle.annahme')}</p>
      </div>
    );
  }

  // --- Die Sammlung --------------------------------------------------------------
  return (
    <div className="rahmen">
      <Kopf />
      {wunschLeiste}
      <div className="leiste">
        <input className="eingabe leiste__suche" type="search" placeholder={t('liste.suche')} value={suche} data-suche onChange={(e) => setSuche(e.target.value)} />
      </div>
      {fehler ? <p className="fehler">{fehler}</p> : null}
      {kacheln.length === 0 ? <p className="leise">{t('liste.leer')}</p> : gefunden.length === 0 ? <p className="leise">{t('liste.nichts')}</p> : null}
      <div className="kacheln" data-pfeile="raster">
        {gefunden.map((k) => (
          <button key={k.id} type="button" className="ortkachel" data-ort={k.id} data-pfeil onClick={() => void oeffne(k.id)}>
            <span className="ortkachel__zeichen" aria-hidden="true">
              {GROESSE_ZEICHEN[k.groesse]}
            </span>
            <span className="ortkachel__name">{k.name}</span>
            <span className="leise">{k.kurz}</span>
            {k.imLoot ? <span className="leise">Loot ✓</span> : null}
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
