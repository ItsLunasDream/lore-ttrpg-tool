/**
 * Die Einstellungen eines Werkzeugs, gemalt von der Huelle.
 *
 * Das Werkzeug laeuft in einer eigenen Ansicht; seine Bedienteile lassen sich
 * nicht in diesen Dialog haengen. Also schickt es eine Beschreibung
 * (@suite/einstellungen), und hier entsteht daraus die Oberflaeche. Zurueck
 * geht nur „Feld x hat jetzt Wert y" — was daraus wird, weiss allein das
 * Werkzeug.
 *
 * Nach jeder Aenderung kommt der ganze Stand zurueck und ersetzt den alten.
 * Nicht, weil es billiger waere, sondern weil ein Werkzeug einen Wert
 * zurechtruecken darf und ein Schalter andere Felder sperren kann. Wer nur
 * das geaenderte Feld aktualisiert, zeigt danach eine Mischung aus zwei
 * Staenden.
 */
import { useEffect, useState } from 'react';
import {
  istBedienbar,
  text,
  type Feld,
  type Sprache,
  type Werkzeugeinstellungen,
  type Wert
} from '@suite/einstellungen';

interface Props {
  readonly appId: string;
  /** Der Name des Werkzeugs, schon uebersetzt. Steht als Ueberschrift. */
  readonly titel: string;
  readonly sprache: Sprache;
  readonly lade: (appId: string) => Promise<Werkzeugeinstellungen | null>;
  readonly setze: (
    appId: string,
    feldId: string,
    wert: Wert
  ) => Promise<Werkzeugeinstellungen | null>;
  readonly befehl: (
    appId: string,
    befehlId: string,
    wert?: string
  ) => Promise<Werkzeugeinstellungen | null>;
  readonly onFehler: (grund: unknown) => void;
}

export function Werkzeugfelder({ appId, titel, sprache, lade, setze, befehl, onFehler }: Props) {
  const [stand, setStand] = useState<Werkzeugeinstellungen | null>(null);

  useEffect(() => {
    let lebt = true;
    void lade(appId).then(
      (geladen) => {
        if (lebt) setStand(geladen);
      },
      (grund: unknown) => {
        if (lebt) onFehler(grund);
      }
    );
    return () => {
      lebt = false;
    };
    // Absichtlich nur an der Kennung: `lade` und `onFehler` kommen als neue
    // Funktion pro Zeichnung herein, und ein Abhaengen daran laedt endlos neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  /**
   * Eine Antwort des Werkzeugs uebernehmen.
   *
   * `null` heisst „das Werkzeug ist weg" — inzwischen geschlossen, waehrend
   * der Dialog offen stand. Dann verschwindet der Abschnitt, statt einen
   * Stand zu zeigen, den niemand mehr annimmt.
   */
  const uebernimm = (versprechen: Promise<Werkzeugeinstellungen | null>) => {
    void versprechen.then(setStand, onFehler);
  };

  if (!stand || stand.gruppen.length === 0) return null;

  const male = (feld: Feld) => {
    const bedienbar = istBedienbar(stand, feld);

    switch (feld.art) {
      case 'satz':
        return <p className="feld__hinweis">{text(feld.hinweis, sprache)}</p>;

      case 'knoepfe':
        return (
          <>
            {feld.name ? <span className="feld__name">{text(feld.name, sprache)}</span> : null}
            <div className="feld__knoepfe">
              {feld.knoepfe.map((knopf) => (
                <button
                  key={knopf.id}
                  type="button"
                  onClick={() => uebernimm(befehl(appId, knopf.id))}
                >
                  {text(knopf.name, sprache)}
                </button>
              ))}
            </div>
          </>
        );

      case 'schalter':
        return (
          <label className="feld feld--inline">
            <input
              type="checkbox"
              checked={feld.wert}
              disabled={!bedienbar}
              onChange={(ereignis) => uebernimm(setze(appId, feld.id, ereignis.target.checked))}
            />
            <span className="feld__name">{text(feld.name, sprache)}</span>
          </label>
        );

      case 'zahl':
        return (
          <label className="feld">
            <span className="feld__name">
              {text(feld.name, sprache)}
              {feld.einheit ? ` (${text(feld.einheit, sprache)})` : ''}
            </span>
            <input
              className="feld__eingabe"
              type="number"
              min={feld.min}
              max={feld.max}
              step={feld.schritt ?? 1}
              value={feld.wert}
              disabled={!bedienbar}
              onChange={(ereignis) => uebernimm(setze(appId, feld.id, ereignis.target.value))}
            />
          </label>
        );

      case 'zeile':
        return (
          <label className="feld">
            <span className="feld__name">{text(feld.name, sprache)}</span>
            <input
              className="feld__eingabe"
              value={feld.wert}
              disabled={!bedienbar}
              placeholder={feld.platzhalter ? text(feld.platzhalter, sprache) : undefined}
              onChange={(ereignis) => uebernimm(setze(appId, feld.id, ereignis.target.value))}
            />
          </label>
        );

      case 'auswahl':
        return (
          <label className="feld">
            <span className="feld__name">{text(feld.name, sprache)}</span>
            <select
              className="feld__wahl"
              value={feld.wert}
              disabled={!bedienbar}
              onChange={(ereignis) => uebernimm(setze(appId, feld.id, ereignis.target.value))}
            >
              {feld.optionen.map((option) => (
                <option key={option.id} value={option.id}>
                  {text(option.name, sprache)}
                </option>
              ))}
            </select>
          </label>
        );

      case 'pfad':
        return (
          <>
            <div className="feld">
              <span className="feld__name">{text(feld.name, sprache)}</span>
              <code className="feld__pfad">{feld.wert}</code>
            </div>
            <div className="feld__knoepfe">
              {feld.knoepfe.map((knopf) => (
                <button
                  key={knopf.id}
                  type="button"
                  onClick={() => uebernimm(befehl(appId, knopf.id))}
                >
                  {text(knopf.name, sprache)}
                </button>
              ))}
            </div>
          </>
        );

      case 'sammlung':
        return (
          <div className="feld">
            <span className="feld__name">{text(feld.name, sprache)}</span>
            {feld.eintraege.length === 0 ? (
              <p className="feld__hinweis">{text(feld.leer, sprache)}</p>
            ) : (
              <ul className="feld__sammlung" data-pfeile="liste">
                {feld.eintraege.map((eintrag) => (
                  <li data-pfeil key={eintrag}>
                    <span>{eintrag}</span>
                    <button
                      type="button"
                      onClick={() => uebernimm(befehl(appId, feld.id, eintrag))}
                    >
                      {text(feld.entfernen, sprache)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <h3 className="feld__ueberschrift">{titel}</h3>
      {stand.gruppen.map((gruppe) => (
        <div key={gruppe.id} className="werkzeugfelder__gruppe">
          <h4 className="feld__untertitel">{text(gruppe.name, sprache)}</h4>
          {gruppe.felder.map((feld) => (
            <div key={feld.id}>
              {male(feld)}
              {'hinweis' in feld && feld.hinweis && feld.art !== 'satz' ? (
                <p className="feld__hinweis">{text(feld.hinweis, sprache)}</p>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
