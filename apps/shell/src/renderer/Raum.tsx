/**
 * Der Reiter „Raum" im Dialog „Teilen" (docs/austausch.md, Stufe 2).
 *
 * Aus: den eigenen Namen setzen, einen Raum eroeffnen oder einem aus der
 * Liste beitreten (oder ueber die Adresse, wenn das Netz die Liste nicht
 * durchlaesst). Drin: wer da ist, der Chat, Nachrichten an alle oder an
 * eine Person.
 *
 * Ueber das Internet: der Gastgeber schaltet „Auch ueber das Internet" ein,
 * bekommt einen festen Port und braucht ein Passwort (der Verkehr ist dann
 * verschluesselt). Gaeste treten ueber IPv4 mit Portfreigabe, IPv6 oder
 * einen Namen bei.
 *
 * Der Dienst lebt im Hauptprozess; dieser Reiter zeigt nur seinen Stand.
 * Ein geschlossener Dialog verliert also nichts.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MessageKey, MessageParams } from '../shared/i18n';
import type { Chatzeile, GefundenerRaum, Raumzustand } from '../main/raum';
import type { GespeicherterRaum } from '../main/raeume';
import { alsAdresse, leseAdresse, RAUM_INTERNETPORT } from '@suite/austausch';

interface Props {
  readonly zustand: Raumzustand;
  readonly raeume: readonly GefundenerRaum[];
  readonly fehler: string;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  /** Klick auf einen Eintrag in einer Chatzeile (Rückmeldung: Items direkt öffnen). */
  readonly oeffneEintrag?: (e: { werkzeug: string; kennung: string; name: string }) => void;
}

export function Raum({ zustand, raeume, fehler, t, oeffneEintrag }: Props) {
  const [name, setName] = useState('');
  const [raumName, setRaumName] = useState('');
  const [passwort, setPasswort] = useState('');
  const [beitrittPasswort, setBeitrittPasswort] = useState('');
  const [adresse, setAdresse] = useState('');
  const [neuerName, setNeuerName] = useState('');
  const [text, setText] = useState('');
  const [an, setAn] = useState('');
  const [internet, setInternet] = useState(false);
  const [internetPort, setInternetPort] = useState(String(RAUM_INTERNETPORT));
  // Rollen und gespeicherte Raeume (docs/charakterbogen.md).
  const [ichLeite, setIchLeite] = useState(true);
  const [gespeicherte, setGespeicherte] = useState<readonly GespeicherterRaum[]>([]);
  const [fortsetzen, setFortsetzen] = useState<GespeicherterRaum | null>(null);
  // Für den eigenen Raum ist das Passwort gemerkt: dann muss es nicht neu eingetippt werden.
  const [pwGemerkt, setPwGemerkt] = useState(false);
  // Im offenen Raum: der Host sieht sein Passwort (Rückmeldung), standardmäßig verdeckt.
  const [hostPasswort, setHostPasswort] = useState('');
  const [pwZeigen, setPwZeigen] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState<string | null>(null);
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [umbenennenText, setUmbenennenText] = useState('');
  const [menue, setMenue] = useState<{ id: string; x: number; y: number } | null>(null);
  // Beim Gastgeber: die Einstellungen des gespeicherten Raums.
  const [raumEinst, setRaumEinst] = useState<{ gruppeNehmen: boolean; slMarkieren: boolean } | null>(null);
  useEffect(() => {
    if (zustand.rolle === 'gastgeber') void window.shell.raum.einstellungen({}).then(setRaumEinst);
    else setRaumEinst(null);
    if (zustand.rolle === 'gastgeber') void window.shell.raum.passwort().then(setHostPasswort);
    else setHostPasswort('');
    setPwZeigen(false);
  }, [zustand.rolle, zustand.raum]);
  const setzeEinst = (aenderung: { gruppeNehmen?: boolean; slMarkieren?: boolean }) =>
    void window.shell.raum.einstellungen(aenderung).then(setRaumEinst);
  const [eigenerFehler, setEigenerFehler] = useState('');
  const [oeffentlich, setOeffentlich] = useState<string | null | 'fragt' | 'fehlt'>(null);
  const [kopiert, setKopiert] = useState('');
  // Waehrend ein Beitritt laeuft: Knoepfe gesperrt und ein Hinweis statt des alten Fehlers.
  const [verbindet, setVerbindet] = useState(false);
  // Ein geschuetzter Raum aus der Liste, fuer den noch das Passwort fehlt.
  const [passwortFuer, setPasswortFuer] = useState<string | null>(null);
  // Chatzeilen mit geteilten Eintraegen, die aufgeklappt sind (nach Index).
  const [aufgeklappt, setAufgeklappt] = useState<Set<number>>(new Set());
  const liste = useRef<HTMLDivElement>(null);
  // Neben „Aktualisieren": erst ein drehender Kreis, dann eine Sekunde ein
  // Haken, dann nichts. Auch wenn sich die Liste von selbst aendert.
  const [anzeige, setAnzeige] = useState<'ruhe' | 'dreht' | 'fertig'>('ruhe');
  const drehTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drehe = (ms: number) => {
    setAnzeige('dreht');
    if (drehTimer.current) clearTimeout(drehTimer.current);
    drehTimer.current = setTimeout(() => {
      setAnzeige('fertig');
      drehTimer.current = setTimeout(() => setAnzeige('ruhe'), 1000);
    }, ms);
  };
  const raumSchluessel = raeume
    .map((r) => `${r.adresse}:${r.port}:${r.raum}`)
    .sort()
    .join('|');
  const vorigeSchluessel = useRef<string | null>(null);
  useEffect(() => {
    if (vorigeSchluessel.current !== null && vorigeSchluessel.current !== raumSchluessel) drehe(700);
    vorigeSchluessel.current = raumSchluessel;
  }, [raumSchluessel]);
  useEffect(() => () => {
    if (drehTimer.current) clearTimeout(drehTimer.current);
  }, []);

  useEffect(() => {
    void window.shell.raum.suchen();
    void window.shell.raum.gespeicherte().then(setGespeicherte);
    return window.shell.raum.beiEreignis((e) => {
      if (e.art === 'gespeichert') setGespeicherte(e.raeume);
    });
  }, []);
  // Ein Rechtsklickmenue schliesst bei jedem Klick daneben und mit Escape.
  useEffect(() => {
    if (!menue) return;
    const zu = () => setMenue(null);
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && zu();
    window.addEventListener('click', zu);
    window.addEventListener('keydown', taste);
    return () => {
      window.removeEventListener('click', zu);
      window.removeEventListener('keydown', taste);
    };
  }, [menue]);
  // Der Name kann sich im Raum geaendert haben; nach dem Verlassen steht hier der aktuelle.
  useEffect(() => {
    if (zustand.rolle === 'aus') void window.shell.einstellungen.lesen().then((e) => setName(e.tischName));
  }, [zustand.rolle]);

  const beitreten = (host: string, port: number) => {
    if (verbindet) return;
    setVerbindet(true);
    setPasswortFuer(null);
    void window.shell.raum.beitreten(host, port, beitrittPasswort).finally(() => setVerbindet(false));
  };

  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight });
  }, [zustand.chat.length]);

  // Wer gegangen ist, bekommt keine Direktnachricht mehr: sonst ginge die
  // naechste privat an „?" (Testbericht).
  useEffect(() => {
    if (an && !zustand.personen.some((p) => p.id === an)) setAn('');
  }, [an, zustand.personen]);

  const kopiere = (text: string) => {
    void window.shell.raum.kopieren(text).then((ok) => {
      if (!ok) return;
      setKopiert(text);
      setTimeout(() => setKopiert((alt) => (alt === text ? '' : alt)), 1200);
    });
  };
  const ziel = leseAdresse(adresse);
  const portZahl = Number(internetPort);
  const portGut = Number.isInteger(portZahl) && portZahl >= 1024 && portZahl <= 65535;
  const eroeffnen = () => {
    setEigenerFehler('');
    void window.shell.raum
      .eroeffnen(raumName, passwort, {
        ...(internet ? { internet: true, port: portZahl } : {}),
        // Beim Fortsetzen entscheiden die gemerkten Rollen, sonst der Haken.
        ...(fortsetzen ? { raumId: fortsetzen.id } : { sl: ichLeite })
      })
      .then((antwort) => {
        if (antwort.ok) setFortsetzen(null);
        if (!antwort.ok) {
          const grund = antwort.grund === 'passwort-noetig' || antwort.grund === 'port-belegt' ? antwort.grund : 'eroeffnen';
          setEigenerFehler(t(`room.error.${grund}` as MessageKey, { port: internetPort }));
        }
      });
  };

  const setzeFort = (r: GespeicherterRaum) => {
    setFortsetzen(r);
    setRaumName(r.name);
    setInternet(r.internet);
    if (r.port) setInternetPort(String(r.port));
    setPasswort('');
    setEigenerFehler('');
    setPwGemerkt(false);
    void window.shell.raum.passwortGemerkt(r.id).then(setPwGemerkt);
  };
  const leseRaumEin = () => {
    void window.shell.raum.gespeichertImport().then((a) => {
      if (!a.ok && !a.abgebrochen) setEigenerFehler(t('room.importFailed'));
    });
  };

  const speichereName = (neu: string) => {
    setName(neu);
    void window.shell.einstellungen.schreiben({ tischName: neu });
  };

  if (zustand.rolle === 'aus') {
    return (
      <div className="austausch raum motion-erscheinen" data-raum="aus">
        <label className="feld">
          <span className="feld__name">{t('room.yourName')}</span>
          <input
            className="suche__feld raum__eingabe"
            data-tischname
            value={name}
            maxLength={40}
            placeholder={t('room.namePlaceholder')}
            onChange={(e) => speichereName(e.target.value)}
          />
        </label>
        <p className="einst__satz raum__warnung">{t('room.encryptionHint')}</p>

        <div className="raum__suchkopf">
          <h3 className="raum__kopf">{t('room.found')}</h3>
          <span className="raum__zeichen" aria-hidden="true" data-raum-anzeige={anzeige}>
            {anzeige === 'dreht' ? <span className="raum__kreis" /> : anzeige === 'fertig' ? <span className="raum__haken">✓</span> : null}
          </span>
          <button
            type="button"
            className="dialog__knopf"
            data-raum-aktualisieren
            onClick={() => {
              drehe(1000);
              void window.shell.raum.aktualisieren();
            }}
          >
            {t('room.refresh')}
          </button>
        </div>
        {raeume.length === 0 ? (
          <p className="einst__satz">{t('room.noneFound')}</p>
        ) : (
          <ul className="austausch__liste" data-pfeile="liste">
            {raeume.map((r) => (
              <li data-pfeil key={`${r.adresse}:${r.port}`} className="austausch__zeile">
                <span className="austausch__name">{r.raum}</span>
                <span className="austausch__art">
                  {r.gastgeber}
                  {r.geschuetzt ? ` · ${t('room.protected')}` : ''}
                </span>
                <button
                  type="button"
                  className="dialog__knopf"
                  data-beitreten={r.raum}
                  disabled={verbindet}
                  onClick={() => {
                    // Geschuetzt und noch kein Passwort: hier nachfragen statt scheitern.
                    if (r.geschuetzt && !beitrittPasswort) setPasswortFuer(`${r.adresse}:${r.port}`);
                    else beitreten(r.adresse, r.port);
                  }}
                >
                  {t('room.join')}
                </button>
                {passwortFuer === `${r.adresse}:${r.port}` && (
                  <div className="raum__reihe raum__nachfrage" data-passwort-nachfrage>
                    <span className="einst__satz">{t('room.needsPassword')}</span>
                    <input
                      className="suche__feld raum__eingabe"
                      type="password"
                      autoFocus
                      data-nachfrage-passwort
                      value={beitrittPasswort}
                      placeholder={t('room.password')}
                      onChange={(e) => setBeitrittPasswort(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && beitrittPasswort) beitreten(r.adresse, r.port);
                      }}
                    />
                    <button
                      type="button"
                      className="dialog__knopf"
                      disabled={!beitrittPasswort || verbindet}
                      title={!beitrittPasswort ? t('room.hint.password') : undefined}
                      onClick={() => beitreten(r.adresse, r.port)}
                    >
                      {t('room.join')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <h3 className="raum__kopf">{t('room.direct')}</h3>
        <div className="raum__reihe">
          <input
            className="suche__feld raum__eingabe"
            data-adresse
            value={adresse}
            placeholder={t('room.address')}
            title={t('room.addressHint', { port: String(RAUM_INTERNETPORT) })}
            onChange={(e) => setAdresse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ziel) beitreten(ziel.host, ziel.port);
            }}
          />
          <input
            className="suche__feld raum__eingabe"
            type="password"
            data-beitritt-passwort
            value={beitrittPasswort}
            placeholder={t('room.password')}
            onChange={(e) => setBeitrittPasswort(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ziel) beitreten(ziel.host, ziel.port);
            }}
          />
          <button
            type="button"
            className="dialog__knopf"
            data-adresse-beitreten
            disabled={!ziel || verbindet}
            title={!ziel ? t('room.hint.address', { port: String(RAUM_INTERNETPORT) }) : undefined}
            onClick={() => ziel && beitreten(ziel.host, ziel.port)}
          >
            {t('room.join')}
          </button>
        </div>
        {verbindet ? (
          <p className="einst__satz raum__verbindet" data-raum-verbindet>
            <span className="raum__kreis" /> {t('room.connecting')}
          </p>
        ) : (
          fehler && (
            <p className="einst__satz austausch__fehler" data-raum-fehler>
              {fehler}
            </p>
          )
        )}

        <h3 className="raum__kopf">{t('room.open')}</h3>
        <div className="raum__reihe">
          <input
            className="suche__feld raum__eingabe"
            data-raumname
            value={raumName}
            maxLength={40}
            placeholder={t('room.roomName')}
            onChange={(e) => setRaumName(e.target.value)}
          />
          <input
            className="suche__feld raum__eingabe"
            type="password"
            data-raum-passwort
            value={passwort}
            placeholder={fortsetzen && pwGemerkt ? t('room.passwordRemembered') : internet ? t('room.passwordRequired') : t('room.passwordOptional')}
            onChange={(e) => setPasswort(e.target.value)}
          />
          <button
            type="button"
            className="dialog__knopf"
            data-raum-eroeffnen
            disabled={internet && ((!passwort && !(fortsetzen && pwGemerkt)) || !portGut)}
            title={internet && !passwort && !(fortsetzen && pwGemerkt) ? t('room.hint.password') : internet && !portGut ? t('room.hint.port') : undefined}
            onClick={eroeffnen}
          >
            {fortsetzen ? t('room.resumeButton') : t('room.openButton')}
          </button>
        </div>
        {fortsetzen && (
          <p className="einst__satz" data-raum-fortsetzen={fortsetzen.name}>
            {t('room.resuming', { name: fortsetzen.name })}{' '}
            <button type="button" className="dialog__knopf" onClick={() => setFortsetzen(null)}>
              {t('room.newInstead')}
            </button>
          </p>
        )}
        <div className="raum__reihe">
          {!fortsetzen && (
            <label className="raum__schalter" title={t('room.gmHint')}>
              <input type="checkbox" data-raum-sl checked={ichLeite} onChange={(e) => setIchLeite(e.target.checked)} />
              {t('room.gm')}
            </label>
          )}
          <label className="raum__schalter">
            <input type="checkbox" data-raum-internet checked={internet} onChange={(e) => setInternet(e.target.checked)} />
            {t('room.internet')}
          </label>
          {internet && (
            <label className="raum__schalter">
              {t('room.port')}
              <input
                className="suche__feld raum__port"
                data-raum-port
                inputMode="numeric"
                value={internetPort}
                onChange={(e) => setInternetPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </label>
          )}
        </div>
        {internet && <p className="einst__satz raum__warnung">{t('room.internetHint')}</p>}
        {internet && <HostingAnleitung t={t} />}
        {eigenerFehler && (
          <p className="einst__satz austausch__fehler" data-raum-eroeffnen-fehler>
            {eigenerFehler}
          </p>
        )}
        <section className="raum__gespeichert" data-raum-gespeichert>
          <div className="raum__suchkopf">
            <h3 className="raum__kopf">{t('room.saved')}</h3>
            <button type="button" className="dialog__knopf" data-raum-einlesen onClick={leseRaumEin}>
              {t('room.import')}
            </button>
          </div>
          {gespeicherte.length === 0 ? (
            <p className="einst__satz">{t('room.savedEmpty')}</p>
          ) : (
            <ul className="austausch__liste" data-pfeile="liste">
              {gespeicherte.map((r) => (
                <li data-pfeil key={r.id} className="austausch__zeile" data-gespeichert={r.name}>
                  {umbenennenId === r.id ? (
                    <input
                      className="suche__feld raum__eingabe"
                      autoFocus
                      value={umbenennenText}
                      maxLength={60}
                      onChange={(e) => setUmbenennenText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setUmbenennenId(null);
                        if (e.key === 'Enter' && umbenennenText.trim()) {
                          void window.shell.raum.gespeichertUmbenennen(r.id, umbenennenText).then(() => setUmbenennenId(null));
                        }
                      }}
                      onBlur={() => setUmbenennenId(null)}
                    />
                  ) : (
                    <span className="austausch__name">{r.name}</span>
                  )}
                  <span className="austausch__art">
                    {t('room.savedRoles', { anzahl: Object.keys(r.rollen).length })}
                    {r.internet ? ` · ${t('room.savedInternet')}` : ''}
                  </span>
                  <span className="raum__knoepfe">
                    <button type="button" className="dialog__knopf" data-fortsetzen={r.name} onClick={() => setzeFort(r)}>
                      {t('room.resume')}
                    </button>
                    <button
                      type="button"
                      className="dialog__knopf"
                      onClick={() => {
                        setUmbenennenId(r.id);
                        setUmbenennenText(r.name);
                      }}
                    >
                      {t('room.renameSaved')}
                    </button>
                    <button type="button" className="dialog__knopf" onClick={() => void window.shell.raum.gespeichertExport(r.id)}>
                      {t('room.export')}
                    </button>
                    {/* Loeschen nur mit zweitem Klick: der Raum traegt die Rollen der Runde. */}
                    <button
                      type="button"
                      className="dialog__knopf"
                      data-loeschen={r.name}
                      onClick={() => {
                        if (loeschFrage !== r.id) return setLoeschFrage(r.id);
                        setLoeschFrage(null);
                        if (fortsetzen?.id === r.id) setFortsetzen(null);
                        void window.shell.raum.gespeichertLoeschen(r.id);
                      }}
                      onBlur={() => setLoeschFrage((alt) => (alt === r.id ? null : alt))}
                    >
                      {loeschFrage === r.id ? t('room.deleteConfirm') : t('room.delete')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {zustand.letzter && (
          <section className="raum__letzter" data-raum-letzter>
            <div className="raum__suchkopf">
              <h3 className="raum__kopf">{t('room.lastRoom', { raum: zustand.letzter.raum })}</h3>
              <button type="button" className="dialog__knopf" data-raum-vergessen onClick={() => void window.shell.raum.vergessen()}>
                {t('room.hideLast')}
              </button>
            </div>
            <div className="raum__chat">
              <Chatliste chat={zustand.letzter.chat} aufgeklappt={aufgeklappt} setAufgeklappt={setAufgeklappt} t={t} oeffne={oeffneEintrag} />
            </div>
          </section>
        )}
      </div>
    );
  }

  const andere = zustand.personen.filter((p) => p.id !== zustand.ich?.id);
  // Rollen vergeben darf jede SL; gibt es keine, der Gastgeber (wie im Raumdienst).
  const slZahl = zustand.personen.filter((p) => p.sl).length;
  const ichBinSl = zustand.personen.some((p) => p.id === zustand.ich?.id && p.sl);
  const darfRollen = ichBinSl || (slZahl === 0 && zustand.rolle === 'gastgeber');
  const menuePerson = menue ? zustand.personen.find((p) => p.id === menue.id) : undefined;
  const umbenennen = () => {
    if (!neuerName.trim() || neuerName.trim() === zustand.ich?.name) return;
    void window.shell.raum.umbenennen(neuerName).then((ok) => ok && setNeuerName(''));
  };
  const senden = () => {
    if (!text.trim()) return;
    void window.shell.raum.chat(text, an || null).then((ok) => ok && setText(''));
  };

  return (
    <div className="austausch raum motion-erscheinen" data-raum="drin">
      <div className="raum__reihe raum__kopfzeile">
        <strong data-raumtitel>{zustand.raum}</strong>
        <span className="austausch__art">
          {zustand.rolle === 'gastgeber' ? t('room.youHost') : t('room.youAre', { name: zustand.ich?.name ?? '' })}
        </span>
        {zustand.rolle === 'gast' && (
          <span className="raum__marke" data-raum-ping title={t('room.pingHint')}>
            {zustand.ping === null ? t('room.pingWaiting') : t('room.ping', { ms: zustand.ping })}
          </span>
        )}
        <span className={`raum__marke${zustand.verschluesselt ? ' is-sicher' : ''}`} data-raum-verschluesselt={zustand.verschluesselt}>
          {zustand.verschluesselt ? t('room.encrypted') : t('room.notEncrypted')}
        </span>
        <button
          type="button"
          className="dialog__knopf"
          data-raum-verlassen
          onClick={() => {
            // Als Gastgeber fliegen alle raus: erst fragen, wenn jemand da ist.
            if (zustand.rolle === 'gastgeber' && andere.length > 0 && !window.confirm(t('room.closeConfirm'))) return;
            void window.shell.raum.verlassen();
          }}
        >
          {zustand.rolle === 'gastgeber' ? t('room.close') : t('room.leave')}
        </button>
      </div>
      {zustand.rolle === 'gastgeber' && hostPasswort ? (
        <div className="raum__reihe" data-raum-hostpasswort>
          <span className="austausch__art">{t('room.password')}</span>
          <input className="suche__feld raum__eingabe" readOnly type={pwZeigen ? 'text' : 'password'} value={hostPasswort} data-hostpasswort aria-label={t('room.password')} />
          <button type="button" className="dialog__knopf" data-passwort-zeigen aria-pressed={pwZeigen} onClick={() => setPwZeigen((z) => !z)}>
            {pwZeigen ? t('room.passwordHide') : t('room.passwordShow')}
          </button>
          <button type="button" className="dialog__knopf" onClick={() => kopiere(hostPasswort)}>
            {kopiert === hostPasswort ? '✓' : t('room.copy')}
          </button>
        </div>
      ) : null}
      {zustand.rolle === 'gastgeber' && zustand.port !== null && (
        <Adressen
          zustand={zustand}
          port={zustand.port}
          oeffentlich={oeffentlich}
          frageOeffentlich={() => {
            setOeffentlich('fragt');
            void window.shell.raum.oeffentlicheIp().then((ip) => setOeffentlich(ip ?? 'fehlt'));
          }}
          kopiert={kopiert}
          kopiere={kopiere}
          t={t}
        />
      )}
      {/* Der eigene Name laesst sich auch im offenen Raum aendern (Rueckmeldung). */}
      <div className="raum__reihe">
        <label className="austausch__art" htmlFor="raum-name">
          {t('room.yourName')}
        </label>
        <input
          id="raum-name"
          className="suche__feld raum__eingabe"
          data-raum-umbenennen
          value={neuerName}
          maxLength={40}
          placeholder={zustand.ich?.name ?? ''}
          onChange={(e) => setNeuerName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') umbenennen();
          }}
        />
        <button
          type="button"
          className="dialog__knopf"
          data-raum-umbenennen-knopf
          disabled={!neuerName.trim()}
          onClick={umbenennen}
        >
          {t('room.rename')}
        </button>
      </div>
      <p className="austausch__art" data-personen>
        {t('room.people')}:{' '}
        {zustand.personen.map((p, i) => (
          <span
            key={p.id}
            data-person={p.name}
            data-sl={p.sl === true}
            tabIndex={darfRollen ? 0 : undefined}
            className={darfRollen ? 'raum__person' : undefined}
            onContextMenu={(e) => {
              if (!darfRollen) return;
              e.preventDefault();
              e.stopPropagation();
              setMenue({ id: p.id, x: e.clientX, y: e.clientY });
            }}
          >
            {i > 0 ? ', ' : ''}
            {p.name}
            {p.sl && (
              <span className="raum__marke raum__sl" title={t('room.gmHint')}>
                {t('room.gmBadge')}
              </span>
            )}
            {/* Beim Gastgeber: der Ping zu jedem Gast. */}
            {zustand.pings[p.id] !== undefined && <span className="raum__personping"> ({zustand.pings[p.id]} ms)</span>}
          </span>
        ))}
      </p>
      {/* Ueber ein Portal: im Dialog (mit Transform) waere `position: fixed` nicht am Fenster ausgerichtet. */}
      {menue &&
        menuePerson &&
        createPortal(
          <div className="raum__menue" role="menu" style={{ left: menue.x, top: menue.y }} data-raum-menue onClick={(e) => e.stopPropagation()}>
            {menuePerson.sl ? (
              <button
                type="button"
                role="menuitem"
                data-sl-abgeben
                disabled={slZahl <= 1}
                title={slZahl <= 1 ? t('room.lastGm') : undefined}
                onClick={() => {
                  setMenue(null);
                  void window.shell.raum.rolle(menuePerson.id, false);
                }}
              >
                {t('room.dropGm')}
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                data-sl-machen
                onClick={() => {
                  setMenue(null);
                  void window.shell.raum.rolle(menuePerson.id, true);
                }}
              >
                {t('room.makeGm')}
              </button>
            )}
          </div>,
          document.body
        )}
      {raumEinst ? (
        <div className="raum__reihe" data-raum-einstellungen>
          <label className="raum__schalter">
            <input
              type="checkbox"
              data-gruppe-nehmen
              checked={raumEinst.gruppeNehmen}
              onChange={(e) => setzeEinst({ gruppeNehmen: e.target.checked })}
            />
            {t('room.settingsTakeFromGroup')}
          </label>
          <label className="raum__schalter">
            <input
              type="checkbox"
              data-sl-markieren
              checked={raumEinst.slMarkieren}
              onChange={(e) => setzeEinst({ slMarkieren: e.target.checked })}
            />
            {t('room.settingsMarkGm')}
          </label>
        </div>
      ) : null}
      <div className="raum__chat" ref={liste} data-chat>
        {zustand.chat.length === 0 ? (
          <p className="einst__satz">{t('room.emptyChat')}</p>
        ) : (
          <Chatliste chat={zustand.chat} aufgeklappt={aufgeklappt} setAufgeklappt={setAufgeklappt} t={t} oeffne={oeffneEintrag} />
        )}
      </div>
      <div className="raum__reihe">
        <select className="feld__wahl" data-chat-an value={an} onChange={(e) => setAn(e.target.value)}>
          <option value="">{t('room.toAll')}</option>
          {andere.map((p) => (
            <option key={p.id} value={p.id}>
              {t('room.toOne', { name: p.name })}
            </option>
          ))}
        </select>
        <input
          className="suche__feld raum__eingabe raum__text"
          data-chat-text
          value={text}
          maxLength={4000}
          placeholder={t('room.message')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') senden();
          }}
        />
        <button type="button" className="dialog__knopf" data-chat-senden onClick={senden}>
          {t('room.send')}
        </button>
      </div>
      {an && <p className="einst__satz raum__warnung">{t('room.privateHint')}</p>}
    </div>
  );
}

/**
 * Wo die anderen den Gastgeber erreichen: im lokalen Netz, ueber IPv6 und
 * ueber die oeffentliche IPv4 (Portfreigabe noetig). Die oeffentliche IPv4
 * wird bei einem Internetraum gleich beim Eroeffnen erfragt, wie Foundry
 * es auf seiner Einladungsseite tut; die App sagt dazu, wen sie fragt.
 * „Einladung kopieren" legt alle Adressen als einen Text ab, fertig zum
 * Einfuegen in einen Chat. Das Passwort steht bewusst nicht darin.
 */
function Adressen({
  zustand,
  port,
  oeffentlich,
  frageOeffentlich,
  kopiert,
  kopiere,
  t
}: {
  readonly zustand: Raumzustand;
  readonly port: number;
  readonly oeffentlich: string | null | 'fragt' | 'fehlt';
  readonly frageOeffentlich: () => void;
  readonly kopiert: string;
  readonly kopiere: (text: string) => void;
  readonly t: Props['t'];
}) {
  const zeile = (art: string, adresse: string, daten: string) => (
    <li key={adresse} className="raum__adresse" data-raum-adresse={daten}>
      <span className="raum__adressart">{art}</span>
      <code className="raum__adresstext">{adresse}</code>
      <button type="button" className="dialog__knopf" onClick={() => kopiere(adresse)}>
        {kopiert === adresse ? '✓' : t('room.copy')}
      </button>
    </li>
  );
  const lan = zustand.adressen.length > 0 ? zustand.adressen : ['127.0.0.1'];
  const gefragt = useRef(false);
  useEffect(() => {
    if (zustand.internet && oeffentlich === null && !gefragt.current) {
      gefragt.current = true;
      frageOeffentlich();
    }
  }, [zustand.internet, oeffentlich, frageOeffentlich]);
  const v4 = typeof oeffentlich === 'string' && oeffentlich !== 'fragt' && oeffentlich !== 'fehlt' ? oeffentlich : null;
  const einladung = [
    t('room.inviteTitle', { raum: zustand.raum }),
    ...(zustand.internet && v4 ? [`${t('room.addrPublic')}: ${alsAdresse(v4, port)}`] : []),
    ...(zustand.internet ? zustand.ipv6.map((a) => `IPv6: ${alsAdresse(a, port)}`) : []),
    ...lan.map((a) => `${t('room.addrLan')}: ${alsAdresse(a, port)}`),
    zustand.verschluesselt ? t('room.invitePassword', { name: zustand.ich?.name ?? '' }) : ''
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div className="raum__adressen" data-raum-adressen>
      <ul className="austausch__liste" data-pfeile="liste">
        {lan.map((a) => zeile(t('room.addrLan'), alsAdresse(a, port), 'lan'))}
        {zustand.internet && zustand.ipv6.map((a) => zeile('IPv6', alsAdresse(a, port), 'ipv6'))}
        {zustand.internet && v4 && zeile(t('room.addrPublic'), alsAdresse(v4, port), 'ipv4')}
      </ul>
      <div className="raum__reihe">
        <button type="button" className="dialog__knopf" data-raum-einladung onClick={() => kopiere(einladung)}>
          {kopiert === einladung ? `✓ ${t('room.inviteCopied')}` : t('room.invite')}
        </button>
        {zustand.internet && oeffentlich === 'fragt' && <span className="einst__satz raum__warnung">{t('room.publicAsking')}</span>}
      </div>
      {zustand.internet && (
        <>
          {oeffentlich === 'fehlt' ? (
            <div className="raum__reihe">
              <button type="button" className="dialog__knopf" data-raum-oeffentlich onClick={frageOeffentlich}>
                {t('room.retryPublic')}
              </button>
              <span className="einst__satz raum__warnung">{t('room.publicFailed')}</span>
            </div>
          ) : (
            <p className="einst__satz raum__warnung">{t('room.publicHint')}</p>
          )}
          <p className="einst__satz raum__warnung" data-raum-portfreigabe>
            {t('room.forwardHint', { port: String(port), lan: lan[0] })}
          </p>
          {zustand.ipv6.length === 0 && <p className="einst__satz raum__warnung">{t('room.noIpv6')}</p>}
          <HostingAnleitung t={t} />
        </>
      )}
    </div>
  );
}

/** Kurzanleitung zum Hosten uebers Internet (Rueckmeldung); ausfuehrlich in docs/raum-online.md. */
function HostingAnleitung({ t }: { t: (key: MessageKey, params?: MessageParams) => string }) {
  return (
    <details className="raum__anleitung" data-raum-anleitung>
      <summary>{t('room.guide')}</summary>
      <ol>
        {(['room.guide.1', 'room.guide.2', 'room.guide.3', 'room.guide.4', 'room.guide.5', 'room.guide.6'] as const).map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ol>
    </details>
  );
}

/** Die Uhrzeit einer Chatzeile, kurz (14:05). */
function uhrzeit(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Die Zeilen eines Chats, mit Uhrzeit; Kommen und Gehen als leise Zeile der App. */
function Chatliste({
  chat,
  aufgeklappt,
  setAufgeklappt,
  t,
  oeffne
}: {
  readonly oeffne?: Props['oeffneEintrag'];
  readonly chat: readonly Chatzeile[];
  readonly aufgeklappt: Set<number>;
  readonly setAufgeklappt: (f: (alt: Set<number>) => Set<number>) => void;
  readonly t: Props['t'];
}) {
  return (
    <>
      {chat.map((z, i) =>
        z.system ? (
          <p key={i} className="raum__zeile raum__system" data-chat-system={z.system}>
            <span className="raum__zeit">{uhrzeit(z.zeit)}</span>{' '}
            {t(z.system === 'kommt' ? 'room.joined' : 'room.left', { name: z.von.name })}
          </p>
        ) : (
          <p key={i} className={`raum__zeile motion-eintritt${z.an ? ' is-privat' : ''}${z.eigene ? ' is-eigen' : ''}`}>
            <span className="raum__zeit">{uhrzeit(z.zeit)}</span>{' '}
            <span className="raum__wer">
              {z.von.name}
              {z.an ? ` → ${z.an.name}` : ''}
            </span>{' '}
            {z.an ? <em className="raum__privat">{t('room.private')} </em> : null}
            {z.dateien ? (
              <Dateizeile
                dateien={z.dateien}
                eintraege={z.eintraege}
                oeffne={oeffne}
                offen={aufgeklappt.has(i)}
                schalte={() =>
                  setAufgeklappt((alt) => {
                    const neu = new Set(alt);
                    if (neu.has(i)) neu.delete(i);
                    else neu.add(i);
                    return neu;
                  })
                }
                t={t}
              />
            ) : (
              z.text
            )}
          </p>
        )
      )}
    </>
  );
}

/** Wie viele Namen eine Chatzeile mit geteilten Eintraegen zeigt, bevor sie zaehlt. */
const SICHTBARE_DATEIEN = 5;

/**
 * Eine Chatzeile fuer geteilte Eintraege: die ersten fuenf Namen, dann eine
 * Zahl. Ein Klick klappt die ganze Liste auf.
 */
function Dateizeile({
  dateien,
  eintraege,
  oeffne,
  offen,
  schalte,
  t
}: {
  readonly dateien: readonly string[];
  readonly eintraege?: readonly { werkzeug: string; kennung: string; name: string }[];
  readonly oeffne?: Props['oeffneEintrag'];
  readonly offen: boolean;
  readonly schalte: () => void;
  readonly t: Props['t'];
}) {
  const mehr = dateien.length - SICHTBARE_DATEIEN;
  // Mit Werkzeug und Kennung: jeder Name ist ein Knopf, der den Eintrag öffnet.
  if (eintraege && eintraege.length && oeffne) {
    const knopf = (e: { werkzeug: string; kennung: string; name: string }, i: number) => (
      <button key={i} type="button" className="raum__eintrag" data-chat-eintrag={`${e.werkzeug}/${e.kennung}`} title={t('room.openItem')} onClick={() => oeffne(e)}>
        {e.name}
      </button>
    );
    return (
      <span className="raum__dateien raum__dateien--knoepfe" data-chat-dateien={eintraege.length}>
        📎 {eintraege.length === 1 ? t('room.sharedOne') : t('room.sharedFiles', { anzahl: eintraege.length })}{' '}
        {(offen ? eintraege : eintraege.slice(0, SICHTBARE_DATEIEN)).map(knopf)}
        {eintraege.length > SICHTBARE_DATEIEN ? (
          <button type="button" className="raum__mehr" aria-expanded={offen} onClick={schalte}>
            {offen ? '−' : t('room.moreFiles', { anzahl: eintraege.length - SICHTBARE_DATEIEN })}
          </button>
        ) : null}
      </span>
    );
  }
  return (
    <>
      <button type="button" className="raum__dateien" data-chat-dateien={dateien.length} aria-expanded={offen} title={t('room.showFiles')} onClick={schalte}>
        📎 {dateien.length === 1 ? t('room.sharedOne') : t('room.sharedFiles', { anzahl: dateien.length })}{' '}
        <span className="raum__dateiliste">
          {dateien.slice(0, SICHTBARE_DATEIEN).join(', ')}
          {mehr > 0 ? ` ${t('room.moreFiles', { anzahl: mehr })}` : ''}
        </span>
      </button>
      {offen && (
        <ul className="raum__alledateien" data-chat-alle-dateien>
          {dateien.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </>
  );
}
