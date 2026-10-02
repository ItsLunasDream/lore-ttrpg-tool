/**
 * Der Monster Creator.
 *
 * Drei Reiter: bauen, die Sammlung, und ein vorhandenes Monster pruefen.
 *
 * Der Befund steht in allen dreien an derselben Stelle und sieht gleich aus.
 * Das ist Absicht: die Pruefung ist der Kern des Werkzeugs, und sie soll
 * nicht wie ein Anhaengsel wirken, das man im Bauen-Reiter uebersieht.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { einzeln } from '@suite/tastatur';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import type { Eintrag } from '../shared/ablage';
import { alsLeib, freieKennung, zuId } from '../shared/ablage';
import { alsVariante, erzeugeMonster, mitEigenemZustand, wuerfleNeu, type EigenerZustand, type Monster } from '../shared/erzeuge';
import type { Kampfweite } from '../shared/angriffe';
import { alsFoundryDatei } from '../shared/foundry';
import { zieheKiNach, type RohMonster } from '../shared/kiAufgaben';
import { pruefe, type Vorschlag, type Werte } from '../shared/pruefung';
import { RICHTWERTE } from '../shared/richtwerte';
import { ROLLEN, THEMEN, text } from '../shared/tabellen';
import { api } from './api';
import { Befund } from './Befund';
import { Sammlung } from './Sammlung';
import { Statblock } from './Statblock';
import { Bearbeiten } from './Bearbeiten';
import { getLanguage, setLanguage, t, type TextKey } from './i18n';

/** Der Zufall der Oberflaeche. Die reinen Funktionen bekommen ihn uebergeben. */
const wuerfel = () => Math.random();

type Reiter = 'bauen' | 'sammlung' | 'pruefen';

export function App() {
  // Strg+S und Klick kurz hintereinander: nur einmal speichern (sonst doppelte neue Einträge).
  const speichertGerade = useRef(false);
  const [sprache, setSpracheState] = useState<Language>(DEFAULT_LANGUAGE);
  const [reiter, setReiter] = useState<Reiter>('bauen');
  /*
   * Welches gespeicherte Monster gerade offen ist. Die Huelle merkt es sich
   * (Verlauf, „Zuletzt geoeffnet" im Teilen); ein frisch gewuerfeltes ist
   * noch keines.
   */
  const [offenId, setOffenId] = useState<string | null>(null);
  const [cr, setCr] = useState('5');
  const [themaId, setThemaId] = useState('');
  const [rolleId, setRolleId] = useState('');
  const [legendaer, setLegendaer] = useState(false);
  // Haken „Eigene Zustaende einbauen" und die Zustaende aus dem Status
  // Effect Creator, die die Huelle liefert.
  const [mitZustand, setMitZustand] = useState(false);
  const [eigeneZustaende, setEigeneZustaende] = useState<readonly EigenerZustand[]>([]);
  const [kampfweite, setKampfweite] = useState<Kampfweite>('egal');
  /** Was der KI thematisch gesagt wird. Leer heisst: nur die Regler zaehlen. */
  const [kiWunsch, setKiWunsch] = useState('');
  const [monster, setMonster] = useState<Monster | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const [kiDa, setKiDa] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  /** Was die KI zuletzt vorgeschlagen hat, falls sie berichtigt wurde. */
  const [kiVorschlag, setKiVorschlag] = useState<{ werte: Werte; zeilen: string[] } | null>(null);
  /** Der Prueflappen: Zahlen von Hand, ohne Erzeuger. */
  const [handWerte, setHandWerte] = useState<Werte>({
    tp: 95,
    rk: 15,
    schadenProRunde: 35,
    angriffsbonus: 7
  });
  const [handCr, setHandCr] = useState('5');

  useEffect(() => {
    void api.ki.da().then(setKiDa);
    const ab = api.ki.beiWechsel(() => void api.ki.da().then(setKiDa));
    const abSprache = api.sprache.beiWechsel((neu) => {
      setLanguage(neu as Language);
      setSpracheState(neu as Language);
    });
    return () => {
      ab();
      abSprache();
    };
  }, []);

  const ladeSammlung = useCallback(async () => {
    setEintraege(await api.sammlung.liste());
  }, []);

  useEffect(() => {
    void ladeSammlung();
  }, [ladeSammlung]);

  const befund = useMemo(() => (monster ? pruefe(monster.werte, monster.cr) : null), [monster]);
  const handBefund = useMemo(() => pruefe(handWerte, handCr), [handWerte, handCr]);

  const wuerfeln = () => {
    setKiVorschlag(null);
    setOffenId(null);
    const neu = erzeugeMonster(
      { cr, themaId: themaId || undefined, rolleId: rolleId || undefined, legendaer, kampfweite },
      getLanguage(),
      wuerfel
    );
    setMonster(
      mitZustand && eigeneZustaende.length > 0
        ? mitEigenemZustand(neu, eigeneZustaende[Math.floor(wuerfel() * eigeneZustaende.length)], getLanguage())
        : neu
    );
  };

  // Die eigenen Zustaende beim Start und beim Zurueckkommen ins Fenster:
  // wer eben einen gebaut hat, soll ihn gleich hier finden.
  useEffect(() => {
    let aktiv = true;
    const lade = () =>
      void api
        .eigeneZustaende?.()
        .then((liste) => aktiv && setEigeneZustaende(liste))
        .catch(() => undefined);
    lade();
    window.addEventListener('focus', lade);
    return () => {
      aktiv = false;
      window.removeEventListener('focus', lade);
    };
  }, []);

  /**
   * Das ganze Monster von der KI.
   *
   * Und danach die Regel, fuer die die Pruefung gebaut ist: was die KI
   * liefert, wird nachgerechnet und bei Bedarf auf den Grad gezogen — mit
   * Ansage, samt Knopf zurueck zum Vorschlag.
   */
  const frageKi = async () => {
    if (kiLaeuft) return;
    setKiLaeuft(true);
    setMeldung(null);
    try {
      const ergebnis = await api.ki.frage(
        {
          aufgabe: 'monster',
          cr,
          themaId: themaId || undefined,
          rolleId: rolleId || undefined,
          wunsch: kiWunsch.trim() || undefined
        },
        getLanguage()
      );
      if (!ergebnis.ok || !ergebnis.wert) {
        setMeldung(t((ergebnis.grund || 'error.aiOther') as TextKey));
        return;
      }
      const roh = ergebnis.wert as RohMonster;
      const nachgezogen = zieheKiNach(roh.werte, cr);

      // Das Geruest kommt aus den Tabellen, die Prosa von der KI: so ist
      // alles gefuellt, was das Modell auslaesst.
      const grundlage = erzeugeMonster(
        { cr, themaId: themaId || undefined, rolleId: rolleId || undefined, legendaer, kampfweite },
        getLanguage(),
        wuerfel
      );
      setOffenId(null);
      setMonster({
        ...grundlage,
        name: roh.name || grundlage.name,
        satz: roh.beschreibung || grundlage.satz,
        faehigkeiten: roh.faehigkeiten.length > 0 ? roh.faehigkeiten : grundlage.faehigkeiten,
        werte: { ...nachgezogen.werte, legendaer: legendaer || undefined }
      });

      if (nachgezogen.berichtigt) {
        const zeilen: string[] = [];
        const nenne = (feldKey: TextKey, von: number, auf: number) => {
          if (von !== auf) zeilen.push(t('ki.aenderung', { feld: t(feldKey), von, auf }));
        };
        nenne('werte.tp', nachgezogen.vorschlagDerKi.tp, nachgezogen.werte.tp);
        nenne('werte.rk', nachgezogen.vorschlagDerKi.rk, nachgezogen.werte.rk);
        nenne('werte.schaden', nachgezogen.vorschlagDerKi.schadenProRunde, nachgezogen.werte.schadenProRunde);
        nenne('werte.bonus', nachgezogen.vorschlagDerKi.angriffsbonus, nachgezogen.werte.angriffsbonus);
        setKiVorschlag({ werte: nachgezogen.vorschlagDerKi, zeilen });
      } else {
        setKiVorschlag(null);
      }
    } catch (fehler) {
      setMeldung(String(fehler));
    } finally {
      setKiLaeuft(false);
    }
  };

  // `alsNeu`: „Als neu speichern" legt eine zweite Datei an, auch wenn das
  // Stueck schon in der Sammlung liegt (Wunsch aus dem Testbericht).
  const speichern = async (alsNeu = false) => {
    if (!monster) return;
    // Das offene Stueck behaelt seine Datei. Alles andere bekommt eine freie
    // Kennung: ein neues gleichen Namens ersetzt kein gespeichertes still.
    const id = (alsNeu ? null : offenId) ?? freieKennung(zuId(monster.name), eintraege.map((e) => e.id));
    const ergebnis = await api.sammlung.speichern(
      { ...monster, id, geaendert: new Date().toISOString() },
      getLanguage()
    );
    if (ergebnis.ok) setOffenId(id);
    setMeldung(
      ergebnis.ok
        ? t('meldung.gespeichert', { name: monster.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
    if (ergebnis.ok) await ladeSammlung();
  };

  const exportieren = async () => {
    if (!monster) return;
    // Ohne die Kopfzahlen: in einer Notiz sind sie kein Dateikopf mehr,
    // sondern ein Absatz „id: … name: … schemaVersion: 2" ueber dem Statblock.
    const markdown = alsLeib(
      { ...monster, id: zuId(monster.name), geaendert: new Date().toISOString() },
      getLanguage()
    );
    const ergebnis = await api.export(monster.name, markdown);
    setMeldung(
      ergebnis.ok
        ? t('meldung.exportiert', { name: monster.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
  };

  /**
   * Das Monster als JSON fuer Foundry wegschreiben.
   *
   * Ein eigener Knopf neben dem Export in den Story Creator: das eine ist
   * ein Text zum Lesen, das andere eine Datei zum Einlesen. Sie unter einem
   * Knopf zusammenzulegen hiesse, vor jedem Export zu fragen, wohin.
   */
  const nachFoundry = async () => {
    if (!monster) return;
    const datei = alsFoundryDatei(monster, Math.random);
    const ergebnis = await api.foundry(datei.name, datei.inhalt);
    // Abgebrochen ist kein Fehler: dann bleibt die Leiste still, statt eine
    // Meldung zu zeigen, die nach Missgeschick klingt.
    if (!ergebnis.ok && !ergebnis.text) return;
    setMeldung(
      ergebnis.ok
        ? t('meldung.foundry', { name: monster.name })
        : t('meldung.fehler', { detail: ergebnis.text })
    );
  };

  const oeffnen = async (id: string) => {
    const eintrag = eintraege.find((e) => e.id === id);
    if (!eintrag) return;
    /*
     * Geoeffnet wird ueber die Kopfzahlen, nicht ueber den Leib: der Leib ist
     * Markdown fuer Menschen, der Kopf sind die Zahlen. Faehigkeitentexte
     * gehen dabei verloren — das ist der Preis dafuer, dass die Dateien von
     * Hand aenderbar bleiben, und er ist hier vertretbar.
     */
    const grundlage = erzeugeMonster(
      { cr: eintrag.cr, themaId: eintrag.themaId || undefined, rolleId: eintrag.rolleId || undefined },
      getLanguage(),
      wuerfel
    );
    setMonster({
      ...grundlage,
      name: eintrag.name,
      cr: eintrag.cr,
      werte: { ...grundlage.werte, tp: eintrag.tp, rk: eintrag.rk }
    });
    setCr(eintrag.cr);
    setReiter('bauen');
    setOffenId(id);
  };

  /*
   * Ein Treffer aus der Suche der Huelle (Strg+K).
   *
   * Derselbe Weg wie ein Klick in der eigenen Sammlung — `oeffnen` wechselt
   * auch den Reiter. Wer von aussen kommt, soll dasselbe sehen wie jemand,
   * der von innen klickt.
   */
  // Die Liste frisch: ein Treffer kann auch ein Monster sein, das gerade
  // erst angekommen ist (Austausch, docs/austausch.md).
  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" fuehrt
   * zum vorigen Reiter (Bauen, Sammlung, Pruefen), nicht zum vorigen Werkzeug
   * (Rueckmeldung).
   */
  // Beim Bauen ist der Ort das offene Monster (falls gespeichert), sonst der Reiter.
  useEffect(() => api.ort.melde(reiter === 'bauen' ? offenId : reiter), [reiter, offenId]);
  useEffect(() =>
    api.ort.beiSprung((ziel) => {
      if (ziel === 'sammlung' || ziel === 'pruefen') setReiter(ziel);
      else if (ziel && ziel !== offenId) void ladeSammlung().then(() => oeffnen(ziel));
      else setReiter('bauen');
    })
  );

  useEffect(() => api.beiSuchtreffer((kennung) => void ladeSammlung().then(() => oeffnen(kennung))));

  const loeschen = async (eintrag: Eintrag) => {
    if (!window.confirm(`${eintrag.name}?`)) return;
    await api.sammlung.loeschen(eintrag.id);
    setMeldung(t('meldung.geloescht', { name: eintrag.name }));
    await ladeSammlung();
  };

  const uebernimmVorschlag = (vorschlag: Vorschlag) => {
    if (!monster) return;
    setMonster({ ...monster, werte: { ...monster.werte, [vorschlag.feld]: vorschlag.auf } });
  };

  return (
    <div className="app" lang={sprache}>
      <header className="kopf">
        <div>
          <h1>{t('titel')}</h1>
          <p className="kopf__satz">{t('untertitel')}</p>
          {/* Woran sich das Werkzeug haelt, steht dort, wo man es beim
              ersten Blick sieht — nicht erst im Ueber-Dialog. */}
          <p className="kopf__regelwerk">{t('hinweis.dnd')}</p>
        </div>
        <nav className="reiter">
          {(['bauen', 'sammlung', 'pruefen'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={reiter === id ? 'reiter__knopf reiter__knopf--an' : 'reiter__knopf'}
              onClick={() => setReiter(id)}
            >
              {t(`reiter.${id}` as TextKey)}
            </button>
          ))}
        </nav>
      </header>

      {meldung && <p className="meldung">{meldung}</p>}

      {reiter === 'bauen' && (
        <main className="bauen">
          <section className="regler">
            <label>
              {t('feld.cr')}
              <select value={cr} onChange={(e) => setCr(e.target.value)}>
                {RICHTWERTE.map((eintrag) => (
                  <option key={eintrag.cr} value={eintrag.cr}>
                    {eintrag.cr}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.thema')}
              <select value={themaId} onChange={(e) => setThemaId(e.target.value)}>
                <option value="">{t('feld.beliebig')}</option>
                {THEMEN.map((thema) => (
                  <option key={thema.id} value={thema.id}>
                    {text(thema.name, sprache)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.rolle')}
              <select value={rolleId} onChange={(e) => setRolleId(e.target.value)}>
                <option value="">{t('feld.beliebig')}</option>
                {ROLLEN.map((rolle) => (
                  <option key={rolle.id} value={rolle.id}>
                    {text(rolle.name, sprache)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('feld.kampfweite')}
              <select value={kampfweite} onChange={(e) => setKampfweite(e.target.value as Kampfweite)}>
                {(['egal', 'nah', 'fern', 'gemischt'] as const).map((id) => (
                  <option key={id} value={id}>
                    {t(`kampfweite.${id}` as TextKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="regler__kaestchen">
              <input type="checkbox" checked={legendaer} onChange={(e) => setLegendaer(e.target.checked)} />
              {t('feld.legendaer')}
            </label>
            <label
              className="regler__kaestchen"
              title={eigeneZustaende.length === 0 ? t('feld.eigeneZustaendeLeer') : undefined}
            >
              <input
                type="checkbox"
                checked={mitZustand}
                disabled={eigeneZustaende.length === 0}
                data-eigene-zustaende
                onChange={(e) => setMitZustand(e.target.checked)}
              />
              {t('feld.eigeneZustaende')}
            </label>
            <div className="regler__knoepfe">
              <button type="button" className="knopf knopf--haupt" onClick={wuerfeln}>
                {t('knopf.wuerfeln')}
              </button>
              {kiDa ? (
                <button type="button" className="knopf" disabled={kiLaeuft} onClick={() => void frageKi()}>
                  {kiLaeuft ? t('knopf.kiLaeuft') : t('knopf.ki')}
                </button>
              ) : (
                <span className="hinweis hinweis--klein">{t('ki.aus')}</span>
              )}
            </div>

            {/*
              Der freie Wunsch steht unter dem KI-Knopf und nicht zwischen den
              Reglern: er wirkt nur auf die KI, und daneben zu stehen waere
              ein Versprechen, das der Wuerfel nicht halten kann.
            */}
            {kiDa && (
              <label className="regler__wunsch">
                {t('feld.kiWunsch')}
                <textarea
                  value={kiWunsch}
                  onChange={(e) => setKiWunsch(e.target.value)}
                  placeholder={t('feld.kiWunschBeispiel')}
                  rows={3}
                />
                <span className="hinweis hinweis--klein">{t('feld.kiWunschHinweis')}</span>
              </label>
            )}
          </section>

          {monster && befund && (
            <>
              {bearbeiten ? (
                <Bearbeiten monster={monster} onAendern={setMonster} />
              ) : (
                <Statblock monster={monster} />
              )}
              <Befund befund={befund} onUebernehmen={uebernimmVorschlag} />

              {kiVorschlag && (
                <section className="kiHinweis">
                  <p>{t('ki.berichtigt', { cr })}</p>
                  <ul>
                    {kiVorschlag.zeilen.map((zeile) => (
                      <li key={zeile}>{zeile}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="knopf knopf--klein"
                    onClick={() => {
                      setMonster({ ...monster, werte: kiVorschlag.werte });
                      setKiVorschlag(null);
                    }}
                  >
                    {t('knopf.zurueckZurKi')}
                  </button>
                </section>
              )}

              <section className="werkzeuge">
                <button type="button" className="knopf knopf--klein" aria-pressed={bearbeiten} onClick={() => setBearbeiten((vorher) => !vorher)}>
                  {bearbeiten ? t('knopf.fertig') : t('knopf.bearbeiten')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => setMonster(wuerfleNeu(monster, 'name', getLanguage(), wuerfel))}>
                  {t('knopf.neuerName')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => {
                  // Der eingebaute eigene Zustand bleibt beim Nachwuerfeln stehen.
                  const neu = wuerfleNeu(monster, 'faehigkeiten', getLanguage(), wuerfel);
                  const alt = monster.faehigkeiten.find((f) => f.eigenerZustand);
                  setMonster(alt ? { ...neu, faehigkeiten: [...neu.faehigkeiten, alt] } : neu);
                }}>
                  {t('knopf.neueFaehigkeiten')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => setMonster(wuerfleNeu(monster, 'angriffe', getLanguage(), wuerfel))}>
                  {t('knopf.neueAngriffe')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => setMonster(wuerfleNeu(monster, 'bewegung', getLanguage(), wuerfel))}>
                  {t('knopf.neueBewegung')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => setMonster(wuerfleNeu(monster, 'werte', getLanguage(), wuerfel))}>
                  {t('knopf.neueWerte')}
                </button>
                <button type="button" className="knopf knopf--klein" onClick={() => {
                    // Eine Variante ist ein neues Monster: gespeichert wird sie neben dem Original.
                    setOffenId(null);
                    setMonster(alsVariante(monster, cr, wuerfel));
                  }}>
                  {t('knopf.variante')}
                </button>
              </section>

              <section className="abgang">
                <button type="button" className="knopf knopf--haupt" data-speichern onClick={() => einzeln(speichertGerade, speichern)}>
                  {t('knopf.speichern')}
                </button>
                {offenId && (
                  <button type="button" className="knopf" onClick={() => void speichern(true)}>
                    {t('knopf.alsNeu')}
                  </button>
                )}
                <button type="button" className="knopf" onClick={() => void exportieren()}>
                  {t('knopf.export')}
                </button>
                <button type="button" className="knopf" onClick={() => void nachFoundry()}>
                  {t('knopf.foundry')}
                </button>
              </section>
            </>
          )}
        </main>
      )}

      {reiter === 'sammlung' && (
        <main>
          <Sammlung eintraege={eintraege} onOeffnen={(id) => void oeffnen(id)} onLoeschen={(e) => void loeschen(e)} />
        </main>
      )}

      {reiter === 'pruefen' && (
        <main className="pruefen">
          <p className="hinweis">{t('pruefen.hinweis')}</p>
          <section className="regler">
            <label>
              {t('feld.cr')}
              <select value={handCr} onChange={(e) => setHandCr(e.target.value)}>
                {RICHTWERTE.map((eintrag) => (
                  <option key={eintrag.cr} value={eintrag.cr}>
                    {eintrag.cr}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ['tp', 'werte.tp'],
                ['rk', 'werte.rk'],
                ['schadenProRunde', 'werte.schaden'],
                ['angriffsbonus', 'werte.bonus']
              ] as const
            ).map(([feld, schluessel]) => (
              <label key={feld}>
                {t(schluessel)}
                <input
                  type="number"
                  value={handWerte[feld]}
                  onChange={(e) =>
                    setHandWerte({ ...handWerte, [feld]: Number(e.target.value) || 0 })
                  }
                />
              </label>
            ))}
          </section>
          <Befund
            befund={handBefund}
            onUebernehmen={(vorschlag) => setHandWerte({ ...handWerte, [vorschlag.feld]: vorschlag.auf })}
          />
        </main>
      )}
    </div>
  );
}
