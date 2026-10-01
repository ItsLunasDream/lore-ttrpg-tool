/**
 * Der Dialog „Teilen" (docs/austausch.md).
 *
 * Der **Raum** ist die Hauptsache und steht vorne: Chat, Eintraege an alle
 * oder an eine Person, Angekommenes annehmen. Die **Datei** ist der Weg
 * ohne Netz — Weitergeben und Empfangen in einem Reiter (Rueckmeldung: das
 * sind Alternativen zum Raum, keine eigenen Hauptfunktionen):
 *
 * - Als Datei speichern: Eintraege auswaehlen, als Paket ablegen, per
 *   Stick oder Mail weitergeben.
 * - Datei oeffnen: sehen, was darin ist, und annehmen. Gibt es einen
 *   Eintrag schon, wird gefragt; daneben legen ist die Vorgabe.
 *
 * Die Oberflaeche sieht nie den Inhalt eines Pakets, nur Namen und Arten.
 * Das Paket selbst bleibt im Hauptprozess, bis angenommen ist.
 */
import { useEffect, useRef, useState } from 'react';
import { eintragsSchluessel, type Eintrag } from '@suite/eintraege';
import type { MessageKey, MessageParams } from '../shared/i18n';
import { nameKey } from '../shared/apps';
import { Dialog } from './Dialog';
import { Raum } from './Raum';
import { Auswahl } from './Auswahl';
import { AppSymbol } from './icons';
import { useVorschau } from './Vorschau';
import { Ankunftsfenster } from './Ankunftsfenster';
import type { GefundenerRaum, Raumzustand } from '../main/raum';
import type { Raumpaket } from '../preload';

const AUS: Raumzustand = { rolle: 'aus', raum: '', ich: null, personen: [], chat: [], port: null, adressen: [], ipv6: [], verschluesselt: false, internet: false, ping: null, pings: {}, letzter: null };

type Modus = 'uebernehmen' | 'daneben' | 'verwerfen';

interface Ankunft {
  readonly nummer: number;
  readonly werkzeug: string;
  readonly name: string;
  readonly art: string;
  readonly bilder: number;
  readonly verweis: boolean;
  readonly annehmbar: boolean;
}

interface Props {
  readonly onClose: () => void;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  readonly symbole?: Record<string, string>;
  /** Ein Raumfehler, der bei geschlossenem Dialog kam (Schluessel wie `getrennt`). */
  readonly anfangsFehler?: string | null;
}

export function Austausch({ onClose, t, symbole = {}, anfangsFehler = null }: Props) {
  const [richtung, setRichtung] = useState<'raum' | 'datei'>('raum');
  const werkzeugName = (id: string) => t(nameKey(id));

  /* ---------- Der Raum (Stufe 2) ---------- */
  const [raum, setRaum] = useState<Raumzustand>(AUS);
  const [raeume, setRaeume] = useState<readonly GefundenerRaum[]>([]);
  const [raumPakete, setRaumPakete] = useState<readonly Raumpaket[]>([]);
  const [raumFehler, setRaumFehler] = useState(() => (anfangsFehler ? t(`room.error.${anfangsFehler}` as MessageKey) : ''));
  const [raumAn, setRaumAn] = useState('');
  // Neue Chatzeilen, waehrend der Reiter „Als Datei" vorn ist: sonst sieht man sie nicht kommen.
  const [ungelesen, setUngelesen] = useState(0);
  const richtungRef = useRef(richtung);
  richtungRef.current = richtung;
  useEffect(() => {
    if (richtung === 'raum') setUngelesen(0);
  }, [richtung]);
  // Das Ziel „nur an …" faellt weg, wenn die Person gegangen ist.
  useEffect(() => {
    if (raumAn && !raum.personen.some((p) => p.id === raumAn)) setRaumAn('');
  }, [raumAn, raum.personen]);

  useEffect(() => {
    void window.shell.raum.zustand().then((s) => {
      setRaum(s.zustand);
      setRaeume(s.raeume);
      setRaumPakete(s.pakete);
    });
    return window.shell.raum.beiEreignis((e) => {
      if (e.art === 'zustand') {
        setRaum(e.zustand);
        if (e.zustand.rolle !== 'aus') setRaumFehler('');
      } else if (e.art === 'raeume') setRaeume(e.raeume);
      else if (e.art === 'pakete') setRaumPakete(e.pakete);
      // Wie im Hauptprozess hoechstens 500 Zeilen, sonst waechst die Liste bis zum naechsten Zustand.
      else if (e.art === 'chat') {
        setRaum((alt) => ({ ...alt, chat: [...alt.chat, e.zeile].slice(-500) }));
        if (richtungRef.current !== 'raum' && !e.zeile.eigene) setUngelesen((n) => n + 1);
      }
      else if (e.art === 'ping') setRaum((alt) => ({ ...alt, ping: e.ping, pings: e.pings }));
      else if (e.art === 'fehler') setRaumFehler(t(`room.error.${e.grund}` as MessageKey));
    });
  }, [t]);

  /* ---------- Weitergeben ---------- */
  const [teilbar, setTeilbar] = useState<Eintrag[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  // Je Reiter eine eigene Meldung: „Gespeichert" gehoert nicht unter „In den Raum" (Testbericht).
  const [meldungen, setMeldungen] = useState<{ raum: string; datei: string }>({ raum: '', datei: '' });
  const setMeldung = (wo: 'raum' | 'datei', text: string) => setMeldungen((alt) => ({ ...alt, [wo]: text }));

  const [zuletzt, setZuletzt] = useState<readonly { werkzeug: string; ort: string }[]>([]);
  useEffect(() => {
    void window.shell.austausch.teilbar().then(setTeilbar, () => setTeilbar([]));
    void window.shell.austausch.zuletzt().then(setZuletzt, () => setZuletzt([]));
  }, []);

  const auswahlListe = () =>
    (teilbar ?? [])
      .filter((e) => gewaehlt.has(eintragsSchluessel(e)))
      .map((e) => ({ werkzeug: e.werkzeug, kennung: e.kennung }));

  const inDenRaum = async () => {
    try {
      const antwort = await window.shell.raum.senden(auswahlListe(), raumAn || null);
      setMeldung(
        'raum',
        !antwort.ok ? t('share.sendFailed') : antwort.anzahl === 1 ? t('share.sentToRoomOne') : t('share.sentToRoom', { anzahl: antwort.anzahl })
      );
    } catch {
      setMeldung('raum', t('share.sendFailed'));
    }
  };

  const speichern = async () => {
    const auswahl = auswahlListe();
    try {
      const antwort = await window.shell.austausch.speichern(auswahl);
      if (antwort.abgebrochen) return;
      setMeldung(
        'datei',
        !antwort.ok ? t('share.saveFailed') : antwort.anzahl === 1 ? t('share.savedOne') : t('share.saved', { anzahl: antwort.anzahl })
      );
    } catch {
      // Etwa ein Ordner ohne Schreibrecht: sagen, statt die alte Meldung stehen zu lassen.
      setMeldung('datei', t('share.saveFailed'));
    }
  };

  /* ---------- Empfangen ---------- */
  const [ankuenfte, setAnkuenfte] = useState<Ankunft[] | null>(null);
  const [ziele, setZiele] = useState<Record<string, { id: string; name: string }[]>>({});
  const [zielWahl, setZielWahl] = useState<Record<string, string>>({});
  const [konflikt, setKonflikt] = useState<boolean[]>([]);
  const [annehmen, setAnnehmen] = useState<Set<number>>(new Set());
  const [modi, setModi] = useState<Record<number, Modus>>({});
  const [fehler, setFehler] = useState('');
  const [ergebnis, setErgebnis] = useState<{ ok: boolean; name: string; grund?: string }[] | null>(null);
  // Jede geoeffnete Sendung zaehlt hoch: die Vorschau merkt sich Texte je Sendung.
  const [eingangNr, setEingangNr] = useState(0);
  // Woher die gezeigten Ankuenfte kommen: jeder Reiter zeigt nur seine eigenen (Testbericht).
  const [quelle, setQuelle] = useState<{ art: 'raum'; paket: number } | { art: 'datei' } | null>(null);
  const [fenster, setFenster] = useState<number | null>(null);
  const [gespeichert, setGespeichert] = useState<Set<number>>(new Set());
  const vorschau = useVorschau();

  const oeffnen = async () => zeige(await window.shell.austausch.oeffnen(), { art: 'datei' });

  const zeige = (
    antwort: Awaited<ReturnType<typeof window.shell.austausch.oeffnen>>,
    woher: { art: 'raum'; paket: number } | { art: 'datei' }
  ) => {
    if (antwort.abgebrochen) return;
    setQuelle(woher);
    setErgebnis(null);
    if (!antwort.ok || !antwort.ankuenfte) {
      setAnkuenfte(null);
      setFehler(t('share.openFailed', { grund: antwort.grund ?? '' }));
      return;
    }
    setFehler('');
    setEingangNr((n) => n + 1);
    setFenster(null);
    setGespeichert(new Set());
    const z = antwort.ziele ?? {};
    const wahl = Object.fromEntries(Object.entries(z).map(([w, liste]) => [w, liste[0]?.id ?? '']));
    setZiele(z);
    setZielWahl(wahl);
    setAnkuenfte(antwort.ankuenfte);
    setAnnehmen(new Set(antwort.ankuenfte.filter((a) => a.annehmbar).map((a) => a.nummer)));
    setModi({});
  };

  // Ob es die Eintraege im gewaehlten Ziel schon gibt — neu, sobald sich
  // das Ziel aendert.
  useEffect(() => {
    if (!ankuenfte) return;
    void window.shell.austausch.konflikte(zielWahl).then(setKonflikt, () => setKonflikt([]));
  }, [ankuenfte, zielWahl]);

  /** Eine Ankunft, fuer deren Werkzeug es Ziele geben muss, aber keines gibt. */
  const ohneZiel = (a: Ankunft) => a.werkzeug in ziele && !zielWahl[a.werkzeug];

  const nimmAn = async () => {
    if (!ankuenfte) return;
    const entscheidungen = ankuenfte
      .filter((a) => annehmen.has(a.nummer) && a.annehmbar && !ohneZiel(a) && !gespeichert.has(a.nummer))
      .map((a) => ({ nummer: a.nummer, modus: konflikt[a.nummer] ? (modi[a.nummer] ?? 'daneben') : 'daneben' }));
    const ergebnisse = await window.shell.austausch.annehmen(entscheidungen, zielWahl);
    setErgebnis(ergebnisse);
    // Angenommenes ist erledigt: abgehakt und nicht mehr waehlbar, damit ein
    // zweiter Klick es nicht noch einmal daneben legt (Testbericht).
    const fertig = entscheidungen.filter((_, i) => ergebnisse[i]?.ok).map((e) => e.nummer);
    setGespeichert((alt) => {
      const neu = new Set([...alt, ...fertig]);
      erledigePaket(neu);
      return neu;
    });
    setAnnehmen((alt) => new Set([...alt].filter((n) => !fertig.includes(n))));
  };

  // Ein anderer Raum (oder keiner): was aus dem alten angesehen wurde, ist weg.
  const raumSchluessel = `${raum.rolle}:${raum.raum}`;
  const vorigerRaum = useRef(raumSchluessel);
  useEffect(() => {
    if (vorigerRaum.current === raumSchluessel) return;
    vorigerRaum.current = raumSchluessel;
    if (quelle?.art === 'raum') {
      setAnkuenfte(null);
      setErgebnis(null);
      setQuelle(null);
    }
  }, [raumSchluessel, quelle]);

  /** Ist aus einem Raumpaket alles Annehmbare angenommen, verschwindet es aus „Angekommen". */
  const erledigePaket = (gespeichertJetzt: Set<number>) => {
    if (quelle?.art !== 'raum' || !ankuenfte) return;
    if (ankuenfte.filter((a) => a.annehmbar).every((a) => gespeichertJetzt.has(a.nummer))) {
      void window.shell.raum.paketVerwerfen(quelle.paket);
    }
  };

  /** Eine einzelne Ankunft annehmen, aus ihrem Fenster heraus. */
  const nimmEineAn = async (a: Ankunft) => {
    const modus = konflikt[a.nummer] ? (modi[a.nummer] ?? 'daneben') : 'daneben';
    const [e] = await window.shell.austausch.annehmen([{ nummer: a.nummer, modus }], zielWahl);
    if (e?.ok) {
      setGespeichert((alt) => {
        const neu = new Set(alt).add(a.nummer);
        erledigePaket(neu);
        return neu;
      });
      setAnnehmen((alt) => {
        const neu = new Set(alt);
        neu.delete(a.nummer);
        return neu;
      });
    }
    return e ?? { ok: false, name: a.name };
  };

  /** Was angekommen ist (aus dem Raum oder einer Datei), mit Annehmen. */
  const ankunftsTeil = (
    <>
      {fehler && (
        <p className="einst__satz austausch__fehler" data-fehler>
          {fehler}
        </p>
      )}
      {ankuenfte && (
        <>
          {Object.entries(ziele).map(([werkzeug, liste]) => (
            <label key={werkzeug} className="feld austausch__ziel">
              <span className="feld__name">{t('share.target', { werkzeug: werkzeugName(werkzeug) })}</span>
              {liste.length === 0 ? (
                <span>{t('share.noTarget')}</span>
              ) : (
                <select
                  className="feld__wahl"
                  data-ziel={werkzeug}
                  value={zielWahl[werkzeug] ?? ''}
                  onChange={(e) => setZielWahl({ ...zielWahl, [werkzeug]: e.target.value })}
                >
                  {liste.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
          <ul className="auswahl__liste" data-pfeile="liste">
            {ankuenfte.map((a) => (
              <li data-pfeil
                key={a.nummer}
                data-ankunft={a.nummer}
                onMouseEnter={(ev) =>
                  vorschau.zeige(`ankunft:${eingangNr}:${a.nummer}`, () => window.shell.austausch.ankunftText(a.nummer, false), ev.currentTarget)
                }
                onMouseLeave={vorschau.verstecke}
                onDoubleClick={() => {
                  vorschau.verstecke();
                  setFenster(a.nummer);
                }}
                title={t('share.openHint')}
              >
                <label className={annehmen.has(a.nummer) && a.annehmbar && !ohneZiel(a) ? 'auswahl__karte is-an' : 'auswahl__karte'}>
                  <input
                    type="checkbox"
                    disabled={!a.annehmbar || ohneZiel(a) || gespeichert.has(a.nummer)}
                    checked={annehmen.has(a.nummer) && a.annehmbar && !ohneZiel(a) && !gespeichert.has(a.nummer)}
                    onChange={() =>
                      setAnnehmen((alt) => {
                        const neu = new Set(alt);
                        if (neu.has(a.nummer)) neu.delete(a.nummer);
                        else neu.add(a.nummer);
                        return neu;
                      })
                    }
                  />
                  <AppSymbol id={a.werkzeug} size={18} bild={symbole[a.werkzeug]} />
                  <span className="auswahl__name">
                    {gespeichert.has(a.nummer) ? '✓ ' : ''}
                    {a.name}
                  </span>
                  <span className="auswahl__art">
                    {a.art} · {werkzeugName(a.werkzeug)}
                    {a.bilder > 0 ? ` · ${t('share.images', { anzahl: a.bilder })}` : ''}
                    {a.verweis ? ` · ${t('share.reference')}` : ''}
                    {!a.annehmbar ? ` · ${t('share.unknownTool')}` : ''}
                  </span>
                </label>
                {konflikt[a.nummer] && (
                  <label className="austausch__konflikt">
                    <span>{t('share.exists')}</span>
                    <select
                      className="feld__wahl"
                      data-modus={a.nummer}
                      value={modi[a.nummer] ?? 'daneben'}
                      onChange={(e) => setModi({ ...modi, [a.nummer]: e.target.value as Modus })}
                    >
                      <option value="daneben">{t('share.modeBeside')}</option>
                      <option value="uebernehmen">{t('share.modeReplace')}</option>
                      <option value="verwerfen">{t('share.modeDiscard')}</option>
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
          {vorschau.karte}
          {fenster !== null && ankuenfte[fenster] && (
            <Ankunftsfenster
              key={`${eingangNr}:${fenster}`}
              ankunft={ankuenfte[fenster]}
              werkzeugName={werkzeugName(ankuenfte[fenster].werkzeug)}
              symbol={symbole[ankuenfte[fenster].werkzeug]}
              ziele={ziele[ankuenfte[fenster].werkzeug]}
              zielWahl={zielWahl[ankuenfte[fenster].werkzeug] ?? ''}
              setZiel={(id) => setZielWahl({ ...zielWahl, [ankuenfte[fenster].werkzeug]: id })}
              konflikt={Boolean(konflikt[fenster])}
              modus={modi[fenster] ?? 'daneben'}
              setModus={(m) => setModi({ ...modi, [fenster]: m })}
              gespeichert={gespeichert.has(fenster)}
              speichere={() => nimmEineAn(ankuenfte[fenster])}
              onClose={() => setFenster(null)}
              t={t}
            />
          )}
          <p className="einst__satz raum__warnung">{t('share.openHint')}</p>
          <div className="austausch__fuss">
            <span />
            <button
              type="button"
              className="dialog__knopf"
              data-annehmen
              disabled={![...annehmen].some((n) => !gespeichert.has(n))}
              onClick={() => void nimmAn()}
            >
              {t('share.accept')}
            </button>
          </div>
        </>
      )}
      {ergebnis && (
        <ul className="austausch__ergebnis" data-ergebnis>
          {ergebnis.map((e, i) => (
            <li key={i} className={e.ok ? 'is-ok' : 'is-fehler'}>
              {e.ok ? '✓' : '✗'} {e.name}
              {!e.ok && e.grund ? ` (${e.grund})` : ''}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const auswahl = (
    <Auswahl teilbar={teilbar} zuletzt={zuletzt} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} symbole={symbole} t={t} />
  );

  return (
    <Dialog titel={t('share.title')} schliessenText={t('dialog.close')} onClose={onClose} klasse="dialog--teilen">
      <div className="austausch__marke">
        <AppSymbol id="austausch" size={28} bild={symbole.austausch} />
        <div className="segment" role="group" aria-label={t('share.title')}>
          {(['raum', 'datei'] as const).map((r) => (
            <button
              key={r}
              type="button"
              data-richtung={r}
              className={r === richtung ? 'segment__knopf is-an' : 'segment__knopf'}
              aria-pressed={r === richtung}
              onClick={() => setRichtung(r)}
            >
              {t(r === 'raum' ? 'share.room' : 'share.tabFile')}
              {r === 'raum' && raumPakete.length + ungelesen > 0 ? ` (${raumPakete.length + ungelesen})` : ''}
            </button>
          ))}
        </div>
      </div>

      {richtung === 'raum' ? (
        <div key="raum" className="motion-erscheinen">
          <Raum zustand={raum} raeume={raeume} fehler={raumFehler} t={t} />
          {raum.rolle !== 'aus' && (
            <>
              <section className="austausch austausch__abschnitt" data-austausch="raum-senden">
                <h3 className="austausch__titel">{t('share.sectionSend')}</h3>
                {auswahl}
                <div className="austausch__fuss">
                  <span>{t('share.selected', { anzahl: gewaehlt.size })}</span>
                  <select className="feld__wahl" data-raum-an value={raumAn} onChange={(e) => setRaumAn(e.target.value)}>
                    <option value="">{t('room.toAll')}</option>
                    {raum.personen
                      .filter((p) => p.id !== raum.ich?.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {t('room.toOne', { name: p.name })}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="dialog__knopf"
                    data-in-den-raum
                    disabled={gewaehlt.size === 0}
                    onClick={() => void inDenRaum()}
                  >
                    {t('share.sendToRoom')}
                  </button>
                </div>
                {meldungen.raum && (
                  <p className="einst__satz" data-meldung>
                    {meldungen.raum}
                  </p>
                )}
              </section>
              <section className="austausch austausch__abschnitt" data-austausch="raum-angekommen">
                <h3 className="austausch__titel">
                  {t('share.sectionArrived')} {raumPakete.length > 0 ? `(${raumPakete.length})` : ''}
                </h3>
                {raumPakete.length === 0 ? (
                  <p className="einst__satz">{t('share.nothingArrived')}</p>
                ) : (
                  <ul className="auswahl__liste" data-pfeile="liste" data-raumpakete>
                    {raumPakete.map((p) => (
                      <li data-pfeil
                        key={p.id}
                        className="auswahl__karte"
                        onDoubleClick={() => void window.shell.raum.paketAnsehen(p.id).then((a) => zeige(a, { art: 'raum', paket: p.id }))}
                      >
                        <span className="auswahl__name">{p.titel}</span>
                        <span className="auswahl__art">{t('share.fromRoom', { name: p.von })}</span>
                        <button
                          type="button"
                          className="dialog__knopf"
                          data-raumpaket={p.id}
                          onClick={() => void window.shell.raum.paketAnsehen(p.id).then((a) => zeige(a, { art: 'raum', paket: p.id }))}
                        >
                          {t('share.look')}
                        </button>
                        <button
                          type="button"
                          className="dialog__knopf"
                          data-raumpaket-verwerfen={p.id}
                          title={t('share.discard')}
                          onClick={() => {
                            if (quelle?.art === 'raum' && quelle.paket === p.id) {
                              setAnkuenfte(null);
                              setQuelle(null);
                            }
                            void window.shell.raum.paketVerwerfen(p.id);
                          }}
                        >
                          {t('share.discard')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {raumPakete.length > 1 && (
                  <button type="button" className="dialog__knopf" data-alle-verwerfen onClick={() => void window.shell.raum.paketVerwerfen(null)}>
                    {t('share.discardAll')}
                  </button>
                )}
                {quelle?.art === 'raum' && ankunftsTeil}
              </section>
            </>
          )}
        </div>
      ) : (
        <div key="datei" className="motion-erscheinen">
          <p className="einst__satz">{t('share.fileHint')}</p>
          <section className="austausch austausch__abschnitt" data-austausch="geben">
            <h3 className="austausch__titel">{t('share.sectionSave')}</h3>
            {auswahl}
            <div className="austausch__fuss">
              <span>{t('share.selected', { anzahl: gewaehlt.size })}</span>
              <button
                type="button"
                className="dialog__knopf"
                data-paket-speichern
                disabled={gewaehlt.size === 0}
                onClick={() => void speichern()}
              >
                {t('share.save')}
              </button>
            </div>
            {meldungen.datei && (
              <p className="einst__satz" data-meldung>
                {meldungen.datei}
              </p>
            )}
          </section>
          <section className="austausch austausch__abschnitt" data-austausch="nehmen">
            <h3 className="austausch__titel">{t('share.sectionOpen')}</h3>
            <p className="einst__satz">{t('share.takeHint')}</p>
            <button type="button" className="dialog__knopf" data-paket-oeffnen onClick={() => void oeffnen()}>
              {t('share.open')}
            </button>
            {quelle?.art === 'datei' && ankunftsTeil}
          </section>
        </div>
      )}
    </Dialog>
  );
}
