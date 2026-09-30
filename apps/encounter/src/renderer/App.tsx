/**
 * Der Encounter Creator.
 *
 * Begegnungen in einer Sammlung: Gegner aus der eigenen Monstersammlung,
 * eine Umgebung, die Einordnung gegen die Gruppe am Tisch und der Weg in
 * den Initiative Tracker.
 *
 * Siehe `docs/encounter.md`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';
import { api } from './api';
import { getLanguage, setLanguage, t } from './i18n';
import { finde, type Sortierung } from '../shared/suche';
import {
  gegnerzahl,
  leereBegegnung,
  naechsterName,
  type Begegnung,
  type Eintrag
} from '../shared/ablage';
import type { Monsterkarte } from '../shared/monsterliste';
import { eigeneKarten, srdKarten, srdStatblock, type Katalogkarte } from '../shared/katalog';
import { Katalog } from './Katalog';
import { Zusammensteller } from './Zusammensteller';
import {
  UMGEBUNGEN,
  anblickzeilen,
  umgebungNach,
  umgebungName,
  type Sprache,
  type Umgebung
} from '@suite/umgebungen';
import { modifikator, type Uebergabe } from '@suite/uebergabe';
import {
  gradsumme,
  gruppenstaerke,
  ordneEin,
  punktsumme,
  schreibeGruppe,
  type Gruppe
} from '../shared/schwierigkeit';
import { EINORDNUNG_NAME, budget, text as srdText } from '@suite/srd';

/** Die Sprache, wie `@suite/umgebungen` sie erwartet. */
function sprache(): Sprache {
  return getLanguage() === 'de' ? 'de' : 'en';
}

export function App() {
  const [, neuZeichnen] = useState(0);
  const [eintraege, setEintraege] = useState<readonly Eintrag[]>([]);
  /** Die Gruppe am Tisch. Gilt fuer das ganze Werkzeug, eingestellt wird sie hier. */
  const [gruppe, setGruppe] = useState<Gruppe>([]);
  const [offen, setOffen] = useState<Begegnung | null>(null);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<Sortierung>('geaendert');
  /** Die offene Begegnung liegt noch nicht auf der Platte. */
  const [istNeu, setIstNeu] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const [monster, setMonster] = useState<readonly Monsterkarte[]>([]);

  const ladeListe = useCallback(async () => {
    setEintraege(await api.sammlung.liste());
  }, []);

  useEffect(() => {
    void ladeListe();
  }, [ladeListe]);

  /*
   * Die Monster bei jedem Start frisch.
   *
   * Wer eben ein Monster gebaut hat, soll es hier sofort finden — und ein
   * geloeschtes soll verschwinden. Ein gemerkter Stand waere die zweite
   * Stelle, an der dieselbe Wahrheit steht.
   */
  useEffect(() => {
    void api.monster.liste().then(setMonster, () => setMonster([]));
  }, []);

  /*
   * Die Gruppe am Tisch.
   *
   * Einmal beim Start gelesen; geaendert wird sie hier im Werkzeug.
   */
  useEffect(() => {
    void api.gruppe.lesen().then(setGruppe, () => setGruppe([]));
    return api.gruppe.beiWechsel(setGruppe);
  }, []);

  /*
   * Die Sprache kommt aus der Huelle, nicht aus einem eigenen Waehler.
   *
   * Dasselbe wie im Initiative Tracker seit #120: zwei Stellen fuer
   * dieselbe Einstellung heisst, dass man immer in der falschen nachsieht.
   */
  useEffect(() => {
    return api.sprache.beiWechsel((neu) => {
      setLanguage((neu === 'de' ? 'de' : 'en') as Language);
      neuZeichnen((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    setLanguage(DEFAULT_LANGUAGE);
  }, []);

  /** Ein Treffer aus der Suche der Huelle (Strg+K) landet hier. */
  useEffect(
    () =>
      api.beiSuchtreffer((kennung) => {
        void (async () => {
          const geladen = await api.sammlung.lesen(kennung);
          if (geladen) setzeGrund(geladen);
          else setFehler(t('fehler.lesen'));
        })();
      }),
    []
  );

  /*
   * Der Verlauf der Huelle kennt auch den Ort IM Werkzeug: „Zurueck" aus
   * einem geoeffneten Eintrag fuehrt zur Liste, nicht zum vorigen Werkzeug
   * (Rueckmeldung). `null` ist die Liste, ein ungespeicherter Entwurf heisst
   * „entwurf" und laesst sich nicht wieder herstellen.
   */
  /*
   * Was zuletzt geladen oder gespeichert wurde. Weicht die offene Begegnung
   * davon ab, fragt „Zurueck", statt sie still zu verwerfen (Testbericht).
   */
  const [stand, setStand] = useState<string | null>(null);
  const setzeGrund = (b: Begegnung | null) => {
    setOffen(b);
    setStand(b ? JSON.stringify(b) : null);
  };
  const veraendert = offen !== null && stand !== null && JSON.stringify(offen) !== stand;

  const ort = offen ? offen.id || 'entwurf' : null;
  useEffect(() => api.ort.melde(ort), [ort]);
  useEffect(
    () =>
      api.ort.beiSprung((ziel) => {
        if (ziel === null) {
          setzeGrund(null);
          return;
        }
        if (ziel === 'entwurf') return;
        void api.sammlung.lesen(ziel).then((geladen) => geladen && setzeGrund(geladen));
      }),
    []
  );

  /*
   * Alle Monster, die eine Begegnung kennen kann: die offiziellen und die
   * eigenen. Nachgeschlagen wird jeder Gegner hier, gleich woher er kommt.
   */
  const karten = useMemo<readonly Katalogkarte[]>(
    () => [...srdKarten(sprache()), ...eigeneKarten(monster)],
    // Die Sprache aendert die Namen der offiziellen Monster.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monster, getLanguage()]
  );

  const gefunden = useMemo(
    () => finde(eintraege, suche, sortierung),
    [eintraege, suche, sortierung]
  );

  const speichere = async (begegnung: Begegnung, neu: boolean) => {
    setFehler('');
    const ergebnis = await api.sammlung.speichern(begegnung, neu);
    if (!ergebnis.ok) {
      setFehler(t('fehler.speichern', { detail: ergebnis.text }));
      return null;
    }
    setMeldung(t('gespeichert'));
    await ladeListe();
    return ergebnis.id;
  };

  /** Der Name, der gilt: der eingetragene, sonst „Encounter_N". */
  const ersatzname = () => naechsterName(eintraege.map((e) => e.name));
  const nameVon = (begegnung: Begegnung) => begegnung.name.trim() || ersatzname();

  const speichereOffen = async () => {
    if (!offen) return;
    const fertig = { ...offen, name: nameVon(offen) };
    const id = await speichere(fertig, istNeu);
    if (id === null) return;
    // Mit der Kennung, die der Hauptprozess vergeben hat — sie kann wegen
    // eines Namensgleichstands eine andere sein als die geratene.
    setzeGrund({ ...fertig, id });
    setIstNeu(false);
  };

  /**
   * Als neue Begegnung speichern: die gespeicherte bleibt, wie sie ist
   * (wie in Monster und Status Effects; Testbericht).
   */
  const speichereAlsNeu = async () => {
    if (!offen) return;
    const fertig = { ...offen, name: nameVon(offen) };
    const id = await speichere(fertig, true);
    if (id === null) return;
    setzeGrund({ ...fertig, id });
    setIstNeu(false);
    setMeldung(t('gespeichertNeu'));
  };

  const setzeGruppe = async (neu: Gruppe) => {
    setGruppe(neu);
    try {
      setGruppe(await api.gruppe.setzen(schreibeGruppe(neu)));
    } catch (grund) {
      setFehler(t('fehler.speichern', { detail: String(grund) }));
    }
  };

  /**
   * Schiebt die offene Begegnung in den Initiative Tracker.
   *
   * Zusammengestellt wird hier nur die gemeinsame Form aus
   * `@suite/uebergabe` — Namen, Zahlen, Saetze. Teilnehmer und Terrain
   * baut der Tracker daraus selbst; dieses Werkzeug kennt sein
   * Datenmodell nicht und soll es nicht kennen.
   *
   * Die Werte kommen aus der MONSTERLISTE und nicht aus der Datei: wer
   * sein Monster eben noch geaendert hat, soll die neuen Trefferpunkte
   * im Tracker sehen. Ein Monster, das es nicht mehr gibt, wandert mit
   * seinen Nullen mit — es fehlt sichtbar, statt stillschweigend zu
   * verschwinden.
   */
  const inDenTracker = async () => {
    if (!offen) return;
    setFehler('');
    const umgebung = umgebungNach(offen.umgebungId);
    const spr = sprache();
    const uebergabe: Uebergabe = {
      name: nameVon(offen),
      quelle: offen.id,
      gegner: offen.gegner.map((einer) => {
        const karte = karten.find((m) => m.id === einer.monsterId);
        return {
          name: einer.name,
          anzahl: einer.anzahl,
          tp: karte?.tp ?? 0,
          rk: karte?.rk ?? 0,
          // Das SRD nennt den Zuschlag selbst; eigene Monster haben nur
          // die Geschicklichkeit.
          iniMod: karte?.ini ?? modifikator(karte?.ge ?? 10),
          // Der Statblock reist mit, damit der Tracker ihn per Klick zeigt.
          statblock: karte?.statblock || srdStatblock(einer.monsterId, spr)
        };
      }),
      umgebung: umgebung
        ? {
            name: umgebungName(umgebung, spr),
            beschreibung: anblickzeilen(umgebung, spr),
            regeln: umgebung.regeln.map((regel) => ({
              text: regel.wirkung[spr === 'de' ? 'de' : 'en'],
              wert: typeof regel.wert === 'number' ? regel.wert : null
            }))
          }
        : null
    };
    const ging = await api.inDenTracker(uebergabe);
    if (ging) setMeldung(t('tracker.unterwegs'));
    else setFehler(t('tracker.ging-nicht'));
  };

  // --- Eine offene Begegnung ------------------------------------------------
  if (offen) {
    return (
      <div className="rahmen">
        <Kopf />
        <div className="leiste">
          <button
            type="button"
            className="knopf"
            onClick={() => {
              if (veraendert && !confirm(t('verwerfen.sicher'))) return;
              setzeGrund(null);
              setIstNeu(false);
              setMeldung('');
            }}
          >
            ← {t('zurueck')}
          </button>
          <span className="leiste__luecke" />
          {/*
            Der Weg in den Tracker steht NEBEN dem Speichern und nicht
            statt seiner. Er schiebt hinueber, was gerade auf dem Schirm
            steht; was auf der Platte liegt, bleibt davon unberuehrt.
          */}
          <button
            type="button"
            className="knopf"
            data-tracker
            disabled={offen.gegner.length === 0}
            onClick={() => void inDenTracker()}
          >
            {t('tracker.knopf')}
          </button>
          {!istNeu ? (
            <button type="button" className="knopf" data-als-neu onClick={() => void speichereAlsNeu()}>
              {t('speichernNeu')}
            </button>
          ) : null}
          <button
            type="button"
            className="knopf knopf--haupt"
            onClick={() => void speichereOffen()}
          >
            {t('speichern')}
          </button>
        </div>

        <section className="karte">
          <label className="feld">
            <span className="feld__name">{t('feld.name')}</span>
            <input
              className="feld__eingabe"
              value={offen.name}
              // Leer lassen darf man: gespeichert wird dann unter dem
              // Namen, der hier grau steht.
              placeholder={istNeu ? ersatzname() : undefined}
              onChange={(e) => setOffen({ ...offen, name: e.target.value })}
            />
          </label>

          <h3>
            {t('gegner.titel')} · {t('gegner.zahl', { anzahl: gegnerzahl(offen.gegner) })}
          </h3>
          {offen.gegner.length === 0 ? (
            <p className="hinweis">{t('gegner.keine')}</p>
          ) : (
            <ul className="gegnerliste">
              {offen.gegner.map((einer) => {
                /*
                 * Ein geloeschtes Monster verschwindet NICHT stillschweigend.
                 *
                 * Der Name steht mit in der Datei, also bleibt die Zeile
                 * stehen und sagt, dass es das Monster nicht mehr gibt. Wer
                 * die Begegnung Wochen spaeter aufmacht, soll sehen, was
                 * fehlt, statt sich zu wundern, warum sie duenner ist.
                 */
                const gibtEs = karten.some((m) => m.id === einer.monsterId);
                return (
                  <li
                    key={einer.monsterId || einer.name}
                    className={gibtEs ? 'gegnerzeile' : 'gegnerzeile gegnerzeile--fehlt'}
                    data-monster={einer.monsterId}
                  >
                    <input
                      className="gegnerzeile__anzahl"
                      type="number"
                      min={1}
                      max={99}
                      value={einer.anzahl}
                      aria-label={einer.name}
                      onChange={(e) => {
                        const anzahl = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                        setOffen({
                          ...offen,
                          gegner: offen.gegner.map((g) =>
                            g.monsterId === einer.monsterId ? { ...g, anzahl } : g
                          )
                        });
                      }}
                    />
                    <span className="gegnerzeile__name">{einer.name}</span>
                    {gibtEs ? null : (
                      <span className="gegnerzeile__marke" title={t('gegner.fehlt')}>
                        {t('gegner.fehltKurz')}
                      </span>
                    )}
                    <button
                      type="button"
                      className="gegnerzeile__weg"
                      aria-label={t('gegner.weg')}
                      title={t('gegner.weg')}
                      onClick={() =>
                        setOffen({
                          ...offen,
                          gegner: offen.gegner.filter((g) => g.monsterId !== einer.monsterId)
                        })
                      }
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Direkt unter den Gegnern: vorher stand die Einordnung unter dem
              ganzen Katalog, 2700 Pixel tief (Testbericht). */}
          <Verhaeltnis offen={offen} monster={karten} gruppe={gruppe} />

          <Klappe id="bauen" titel={t('bau.titel')}>
            <Zusammensteller
              karten={karten}
              gegner={offen.gegner}
              sprache={sprache()}
              gruppe={gruppe}
              setzeGegner={(gegner) => setOffen({ ...offen, gegner })}
            />
          </Klappe>

          <Klappe id="sammlung" titel={t('monster.titel')}>
            <Katalog
              karten={karten}
              sprache={sprache()}
              dazu={(einer) => {
                /*
                 * Zweimal dasselbe Monster ist keine zweite Zeile, sondern
                 * eine hoehere Anzahl. „3x Wolf" ist der Normalfall, drei
                 * Zeilen „Wolf" waeren Rauschen.
                 */
                const schon = offen.gegner.find((g) => g.monsterId === einer.id);
                setOffen({
                  ...offen,
                  gegner: schon
                    ? offen.gegner.map((g) =>
                        g.monsterId === einer.id ? { ...g, anzahl: Math.min(99, g.anzahl + 1) } : g
                      )
                    : [...offen.gegner, { monsterId: einer.id, name: einer.name, anzahl: 1 }]
                });
              }}
            />
          </Klappe>

          <Klappe id="gruppe" titel={t('gruppe.titel')} zusatz={gruppeKurz(gruppe)}>
            <Gruppenfeld gruppe={gruppe} setze={(neu) => void setzeGruppe(neu)} />
          </Klappe>

          <Klappe
            id="umgebung"
            titel={t('umgebung.titel')}
            zusatz={(() => {
              const gewaehlt = umgebungNach(offen.umgebungId);
              return gewaehlt ? umgebungName(gewaehlt, sprache()) : t('umgebung.keine');
            })()}
          >
            <Umgebungswahl
              gewaehlt={offen.umgebungId}
              waehle={(umgebungId) => setOffen({ ...offen, umgebungId })}
            />
            <Umgebungsblatt umgebung={umgebungNach(offen.umgebungId)} />
          </Klappe>

          <label className="feld feld--hoch">
            <span className="feld__name">{t('feld.notiz')}</span>
            <textarea
              className="feld__flaeche"
              rows={8}
              value={offen.notiz}
              onChange={(e) => setOffen({ ...offen, notiz: e.target.value })}
            />
          </label>

          {meldung ? <p className="meldung">{meldung}</p> : null}
          {fehler ? <p className="fehler">{fehler}</p> : null}
        </section>
      </div>
    );
  }

  // --- Die Sammlung ---------------------------------------------------------
  return (
    <div className="rahmen">
      <Kopf />
      <div className="leiste">
        <button
          type="button"
          className="knopf knopf--haupt"
          onClick={() => {
            // Gleich in die Begegnung, ohne erst nach dem Namen zu fragen.
            // Auf die Platte kommt sie mit dem ersten Speichern.
            setzeGrund(leereBegegnung('', new Date().toISOString()));
            setIstNeu(true);
            setMeldung('');
            setFehler('');
          }}
        >
          + {t('neu')}
        </button>
        <input
          className="feld__eingabe leiste__suche"
          type="search"
          value={suche}
          placeholder={t('liste.suche')}
          aria-label={t('liste.suche')}
          onChange={(e) => setSuche(e.target.value)}
        />
        <select
          className="feld__wahl"
          value={sortierung}
          aria-label={t('liste.sortieren')}
          onChange={(e) => setSortierung(e.target.value as Sortierung)}
        >
          <option value="geaendert">{t('liste.nachDatum')}</option>
          <option value="name">{t('liste.nachName')}</option>
          <option value="gegner">{t('liste.nachGegnern')}</option>
        </select>
      </div>

      <p className="anzahl">
        {gefunden.length === 1
          ? t('liste.eine')
          : t('liste.anzahl', { anzahl: gefunden.length })}
      </p>

      {eintraege.length === 0 ? (
        <p className="hinweis">{t('liste.leer')}</p>
      ) : gefunden.length === 0 ? (
        <p className="hinweis">{t('liste.nichts')}</p>
      ) : (
        <ul className="kacheln" data-pfeile="raster">
          {gefunden.map((eintrag) => (
            <li data-pfeil key={eintrag.id}>
              <button
                type="button"
                className="begegnungskachel"
                data-id={eintrag.id}
                onClick={() => {
                  void (async () => {
                    const geladen = await api.sammlung.lesen(eintrag.id);
                    if (geladen) {
                      setzeGrund(geladen);
                      setIstNeu(false);
                    } else setFehler(t('fehler.lesen'));
                  })();
                }}
              >
                <span className="begegnungskachel__name">{eintrag.name}</span>
                <span className="begegnungskachel__zahl">
                  {t('gegner.zahl', { anzahl: eintrag.gegnerzahl })}
                </span>
                {eintrag.gegnernamen.length > 0 ? (
                  <span className="begegnungskachel__unten">
                    {eintrag.gegnernamen.join(', ')}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="begegnungskachel__weg"
                aria-label={t('loeschen')}
                title={t('loeschen')}
                onClick={() => {
                  // Kein stilles Loeschen: eine Begegnung ist Arbeit, und
                  // ein Fehlklick soll sie nicht kosten.
                  if (!confirm(t('loeschen.sicher', { name: eintrag.name }))) return;
                  void (async () => {
                    await api.sammlung.loeschen(eintrag.id);
                    await ladeListe();
                  })();
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {fehler ? <p className="fehler">{fehler}</p> : null}
    </div>
  );
}

/**
 * Was die Begegnung der Gruppe gegenueberstellt — und kein Urteil.
 *
 * Hier steht ausdruecklich NICHT „mittelschwer". Die Schwellen dafuer
 * gehoeren nach `packages/srd/` und sind dort noch nicht erfasst; eine
 * aus dem Kopf getippte Schwelle saehe aus wie eine Auskunft. Also das
 * Zweitbeste, das ehrlich bleibt: beide Zahlen nebeneinander, und wer
 * sie deutet, ist der Mensch am Tisch.
 *
 * Fehlt die Gruppe, steht trotzdem die Gradsumme da. Sie ist fuer sich
 * schon brauchbar, und ein leerer Kasten waere eine Aufforderung, in die
 * Einstellungen zu gehen — die steht im Hinweis, nicht als Leerstelle.
 */
function Verhaeltnis({
  offen,
  monster,
  gruppe
}: {
  readonly offen: Begegnung;
  readonly monster: readonly Monsterkarte[];
  readonly gruppe: Gruppe;
}) {
  const gewertet = offen.gegner.map((einer) => ({
    anzahl: einer.anzahl,
    grad: monster.find((m) => m.id === einer.monsterId)?.cr ?? ''
  }));
  const summe = gradsumme(gewertet);
  const punkte = punktsumme(gewertet);
  const staerke = gruppenstaerke(gruppe);
  const wo = ordneEin(gewertet, gruppe);
  const spr = sprache();
  if (offen.gegner.length === 0) return null;

  return (
    <div className="verhaeltnis" data-einordnung={wo ?? ''}>
      {/*
        Die Einordnung steht oben und gross — sie ist die Antwort, die man
        sucht. Darunter die beiden Zahlen, aus denen sie entstanden ist:
        eine Einordnung ohne ihre Grundlage muss man glauben, mit ihr kann
        man sie nachrechnen.
      */}
      {wo ? (
        <p className="verhaeltnis__urteil">
          {srdText(EINORDNUNG_NAME[wo], spr)}
          <span className="verhaeltnis__punkte">
            {t('verhaeltnis.punkte', {
              punkte: punkte.summe.toLocaleString(spr === 'de' ? 'de-DE' : 'en-US'),
              niedrig: (budget(gruppe, 'niedrig') ?? 0).toLocaleString(spr === 'de' ? 'de-DE' : 'en-US'),
              mittel: (budget(gruppe, 'mittel') ?? 0).toLocaleString(spr === 'de' ? 'de-DE' : 'en-US'),
              hoch: (budget(gruppe, 'hoch') ?? 0).toLocaleString(spr === 'de' ? 'de-DE' : 'en-US')
            })}
          </span>
        </p>
      ) : null}

      <div className="verhaeltnis__zahlen">
        <span className="verhaeltnis__seite">
          {t('verhaeltnis.grade', { summe: zahl(summe.summe) })}
        </span>
        <span className="verhaeltnis__gegen">{t('verhaeltnis.gegen')}</span>
        <span className="verhaeltnis__seite">
          {staerke
            ? staerke.kleinsteStufe === staerke.groessteStufe
              ? t('verhaeltnis.gruppe', {
                  figuren: staerke.figuren,
                  stufe: staerke.kleinsteStufe
                })
              : t('verhaeltnis.gruppeSpanne', {
                  figuren: staerke.figuren,
                  von: staerke.kleinsteStufe,
                  bis: staerke.groessteStufe
                })
            : t('verhaeltnis.keineGruppe')}
        </span>
      </div>

      {summe.ohneGrad > 0 ? (
        <p className="hinweis hinweis--klein">
          {t('verhaeltnis.ohneGrad', { anzahl: summe.ohneGrad })}
        </p>
      ) : null}
      {/*
        Warum KEINE Einordnung dasteht, ist eine eigene Auskunft. Ohne sie
        sieht ein fehlendes Urteil aus wie ein Fehler der Anwendung.
      */}
      {!wo ? (
        <p className="hinweis hinweis--klein">
          {staerke ? t('verhaeltnis.keineGrade') : t('verhaeltnis.gruppeFehlt')}
        </p>
      ) : null}
    </div>
  );
}

/** Halbe Grade lesbar: „1,5" statt „1.5000000000000002". */
function zahl(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : String(Math.round(wert * 100) / 100);
}

/**
 * Die Umgebung in ihren ZWEI Sorten.
 *
 * Das ist die Entscheidung, die dieses Werkzeug von einer Monsterliste
 * unterscheidet: was man sieht (zum Vorlesen, Vorlage fuer eine Karte) und
 * was am Tisch wirkt (eine Regel mit Zahl, spaeter als Terrain im
 * Tracker). Ohne die zweite Sorte ist die Umgebung Deko, ohne die erste
 * eine Tabellenzeile — deshalb stehen hier beide, getrennt beschriftet.
 */
function Umgebungsblatt({ umgebung }: { readonly umgebung: Umgebung | undefined }) {
  if (!umgebung) return null;
  const spr = sprache();
  return (
    <div className="umgebung">
      <section className="umgebung__teil">
        <h4>{t('umgebung.anblick')}</h4>
        <ul>
          {anblickzeilen(umgebung, spr).map((zeile) => (
            <li key={zeile}>{zeile}</li>
          ))}
        </ul>
      </section>
      <section className="umgebung__teil umgebung__teil--regeln">
        <h4>{t('umgebung.regeln')}</h4>
        <ul>
          {umgebung.regeln.map((regel) => (
            <li key={regel.id}>
              {regel.wirkung[spr === 'de' ? 'de' : 'en']}
              {/* Die Zahl steht als Marke daneben, nicht im Satz: so sieht
                  man auf einen Blick, welche Regel ueberhaupt eine hat. */}
              {typeof regel.wert === 'number' && regel.art ? (
                <span className="umgebung__wert">
                  {t(`umgebung.${regel.art}` as 'umgebung.sicht')} {regel.wert}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Ein Abschnitt zum Auf- und Zuklappen.
 *
 * Der Stand bleibt je Abschnitt gemerkt — nur als Bequemlichkeit im
 * Browser-Speicher der Ansicht; fehlt er, ist alles offen.
 */
function Klappe({
  id,
  titel,
  zusatz,
  children
}: {
  readonly id: string;
  readonly titel: string;
  readonly zusatz?: string;
  readonly children: ReactNode;
}) {
  const schluessel = `encounter.klappe.${id}`;
  const [auf, setAuf] = useState(() => {
    try {
      return localStorage.getItem(schluessel) !== 'zu';
    } catch {
      return true;
    }
  });
  const umschalten = () => {
    setAuf((vorher) => {
      try {
        localStorage.setItem(schluessel, vorher ? 'zu' : 'auf');
      } catch {
        // Ohne Speicher klappt es trotzdem, nur ohne Gedaechtnis.
      }
      return !vorher;
    });
  };
  return (
    <section className={auf ? 'klappe is-auf' : 'klappe'} data-klappe={id}>
      <button type="button" className="klappe__kopf" aria-expanded={auf} onClick={umschalten}>
        <span className="klappe__pfeil" aria-hidden="true">
          ▸
        </span>
        <span className="klappe__titel">{titel}</span>
        {zusatz ? <span className="klappe__zusatz">{zusatz}</span> : null}
      </button>
      {auf ? <div className="klappe__inhalt">{children}</div> : null}
    </section>
  );
}

/** „4 × Stufe 5" — was im zugeklappten Kopf der Gruppe steht. */
function gruppeKurz(gruppe: Gruppe): string {
  if (gruppe.length === 0) return t('verhaeltnis.keineGruppe');
  return gruppe.map((z) => t('gruppe.kurz', { anzahl: z.anzahl, stufe: z.stufe })).join(', ');
}

/** Die Gruppe am Tisch: Zeilen aus Anzahl und Stufe. */
function Gruppenfeld({
  gruppe,
  setze
}: {
  readonly gruppe: Gruppe;
  readonly setze: (neu: Gruppe) => void;
}) {
  const begrenze = (wert: string, max: number) =>
    Math.max(1, Math.min(max, Math.round(Number(wert)) || 1));
  return (
    <div className="gruppenfeld">
      {gruppe.length === 0 ? <p className="hinweis">{t('gruppe.leer')}</p> : null}
      {gruppe.map((zeile, i) => (
        <div className="gruppenfeld__zeile" key={i} data-gruppenzeile={i}>
          <input
            className="gruppenfeld__zahl"
            type="number"
            min={1}
            max={20}
            value={zeile.anzahl}
            aria-label={t('gruppe.figuren')}
            onChange={(e) =>
              setze(gruppe.map((z, j) => (j === i ? { ...z, anzahl: begrenze(e.target.value, 20) } : z)))
            }
          />
          <span>{t('gruppe.figuren')}</span>
          <span className="gruppenfeld__mal">·</span>
          <span>{t('gruppe.stufe')}</span>
          <input
            className="gruppenfeld__zahl"
            type="number"
            min={1}
            max={20}
            value={zeile.stufe}
            aria-label={t('gruppe.stufe')}
            onChange={(e) =>
              setze(gruppe.map((z, j) => (j === i ? { ...z, stufe: begrenze(e.target.value, 20) } : z)))
            }
          />
          <button
            type="button"
            className="gegnerzeile__weg"
            aria-label={t('gruppe.weg')}
            title={t('gruppe.weg')}
            onClick={() => setze(gruppe.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="knopf"
        data-gruppe-dazu
        onClick={() => {
          const letzte = gruppe[gruppe.length - 1];
          setze([...gruppe, { anzahl: letzte ? 1 : 4, stufe: letzte?.stufe ?? 1 }]);
        }}
      >
        + {t('gruppe.dazu')}
      </button>
    </div>
  );
}

/** Die Umgebungen als Kacheln, wie die Zustaende im Status Effect Creator. */
function Umgebungswahl({
  gewaehlt,
  waehle
}: {
  readonly gewaehlt: string;
  readonly waehle: (umgebungId: string) => void;
}) {
  const kachel = (id: string, zeichen: string, name: string, farbe?: string) => (
    <button
      key={id || 'keine'}
      type="button"
      className={gewaehlt === id ? 'umgebungskachel is-an' : 'umgebungskachel'}
      aria-pressed={gewaehlt === id}
      data-umgebung={id}
      style={farbe ? ({ '--marke': farbe } as CSSProperties) : undefined}
      onClick={() => waehle(id)}
    >
      <span className="umgebungskachel__zeichen" aria-hidden="true">
        {zeichen}
      </span>
      <span className="umgebungskachel__name">{name}</span>
    </button>
  );
  return (
    <div className="umgebungswahl">
      {kachel('', '∅', t('umgebung.keine'))}
      {UMGEBUNGEN.map((u) => kachel(u.id, u.zeichen, umgebungName(u, sprache()), u.farbe))}
      <button
        type="button"
        className="umgebungskachel umgebungskachel--wurf"
        data-umgebung-wuerfeln
        onClick={() => waehle(UMGEBUNGEN[Math.floor(Math.random() * UMGEBUNGEN.length)].id)}
      >
        <span className="umgebungskachel__zeichen" aria-hidden="true">
          ⚄
        </span>
        <span className="umgebungskachel__name">{t('umgebung.wuerfeln')}</span>
      </button>
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
