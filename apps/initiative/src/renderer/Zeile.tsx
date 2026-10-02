/**
 * Eine Zeile der Initiativliste.
 *
 * Zugeklappt zeigt sie, was man im Kampf braucht: wer dran ist, wie es um die
 * Trefferpunkte steht, welche Zustaende laufen. Aufgeklappt kommen die Felder
 * dazu, die man beim Vorbereiten oder Nachjustieren braucht. Das ist kein
 * Bearbeitungsmodus — beides ist jederzeit erreichbar, weil am Tisch beides
 * jederzeit vorkommt.
 */
import { useRef, useState, type ReactNode } from 'react';
import { useWertBlitz } from '@suite/motion/react';
import { ZahlFeld } from '@suite/zahlfeld/feld';
import { Kontextmenue, type MenueEintrag } from './Kontextmenue';
import { t } from './i18n';
import { regelZu, useZustandsliste } from './zustandsliste';
import { Statblockfenster } from './Statblock';
import { leseSchaden } from '../shared/format';
import { DAUERN, type Dauer, type Koerper, type Teilnehmer } from '../shared/types';

interface Props {
  readonly teilnehmer: Teilnehmer;
  readonly amZug: boolean;
  readonly laeuft: boolean;
  readonly offen: boolean;
  readonly nummer: number;
  readonly bildUrl: string | null;
  onOeffnen(): void;
  onAendern(aendere: (teilnehmer: Teilnehmer) => Teilnehmer): void;
  onSchaden(koerperId: string, betrag: number): void;
  onSetzeHp(koerperId: string, wert: number): void;
  onGruppe(anzahl: number): void;
  /** Nach einer Aenderung der Initiative: neu einsortieren. */
  onSortieren?(): void;
  onDuplizieren(): void;
  onEntfernen(): void;
  onZustand(name: string, dauer: Dauer, runden: number | null): void;
  onZustandWeg(zustandId: string): void;
  onBild(): void;
  /** Rechtsklick auf die Zeile: umbenennen. Fragt nach dem neuen Namen. */
  onUmbenennen(): void;
  /** Weitere Eintraege im Rechtsklickmenue (Zuordnung im Raum). */
  readonly zusatzMenue?: readonly MenueEintrag[];
  /** Wem die Figur im Raum gehoert, fuer die kleine Marke am Namen. */
  readonly besitzer?: string;
}

export function Zeile(props: Props) {
  const { teilnehmer, amZug, offen } = props;
  const zustandsliste = useZustandsliste();
  const [statblockOffen, setStatblockOffen] = useState(false);
  /** Das offene Rechtsklickmenue, mit der Stelle des Zeigers. */
  const [menue, setMenue] = useState<{ x: number; y: number } | null>(null);
  /*
   * Das Gelaende zaehlt immer als aufrecht.
   *
   * Es hat keine Trefferpunkte, und ohne diese Ausnahme faende `some` nichts
   * — die Zeile waere durchgestrichen und blass, als waere das Gelaende
   * gefallen. Dieselbe Ueberlegung wie bei `istAktiv` im Kampfkern.
   */
  const lebt =
    teilnehmer.istTerrain || teilnehmer.koerper.some((koerper) => !koerper.raus && koerper.hp > 0);
  const gruppe = teilnehmer.koerper.length > 1;

  return (
    <section
      className={[
        'zeile',
        teilnehmer.istTerrain ? 'zeile--terrain' : '',
        amZug ? 'zeile--dran' : '',
        !lebt ? 'zeile--liegt' : '',
        offen ? 'zeile--offen' : '',
        'motion-eintritt'
      ]
        .filter(Boolean)
        .join(' ')}
      // Gestaffelter Auftritt, aber knapp: bei zwoelf Teilnehmern darf der
      // letzte nicht spuerbar spaeter dastehen als der erste.
      style={{ animationDelay: `${Math.min(props.nummer, 8) * 25}ms` }}
      aria-current={amZug ? 'true' : undefined}
      data-zeile={teilnehmer.id}
      data-ausblenden
    >
      <div className="zeile__kopf">
        <span className="zeile__ini" title={t('feld.initiative')}>
          {teilnehmer.initiative}
        </span>

        {teilnehmer.istTerrain ? (
          // Kein Bild, kein Anfangsbuchstabe: das Gelaende ist keine Figur,
          // und ein Portraitplatz daneben liesse es wie eine aussehen.
          <span className="zeile__bild zeile__bild--terrain" aria-hidden="true">
            ◆
          </span>
        ) : props.bildUrl ? (
          <img className="zeile__bild" src={props.bildUrl} alt="" />
        ) : (
          <span className="zeile__bild zeile__bild--leer" aria-hidden="true">
            {(teilnehmer.name || '?').slice(0, 1).toUpperCase()}
          </span>
        )}

        <button
          type="button"
          className="zeile__name"
          onClick={props.onOeffnen}
          onContextMenu={(ereignis) => {
            ereignis.preventDefault();
            setMenue({ x: ereignis.clientX, y: ereignis.clientY });
          }}
        >
          {teilnehmer.name || <em className="zeile__namenlos">{t('feld.name')}</em>}
          {gruppe ? (
            <span className="zeile__marke">{t('gruppe.mitglieder', { n: teilnehmer.koerper.length })}</span>
          ) : null}
          {teilnehmer.istSpieler ? <span className="zeile__marke">PC</span> : null}
          {teilnehmer.rk ? (
            <span className="zeile__marke zeile__rk" title={t('feld.rk')}>
              {t('feld.rk')} {teilnehmer.rk}
            </span>
          ) : null}
          {props.besitzer ? (
            <span className="zeile__marke zeile__besitz" data-besitzer={props.besitzer}>
              {props.besitzer}
            </span>
          ) : null}
        </button>
        {teilnehmer.statblock ? (
          <button
            type="button"
            className="zeile__statblock"
            title={t('knopf.statblock')}
            data-statblock-knopf
            onClick={() => setStatblockOffen(true)}
          >
            {t('knopf.statblockKurz')}
          </button>
        ) : null}
        {statblockOffen && teilnehmer.statblock ? (
          <Statblockfenster
            titel={teilnehmer.name}
            markdown={teilnehmer.statblock}
            onZu={() => setStatblockOffen(false)}
          />
        ) : null}

        <div className="zeile__koerper">
          {teilnehmer.istTerrain ? (
            // Keine Trefferpunkte: das Gelaende laesst sich nicht totschlagen.
            // Stattdessen steht dort, wann es an die Reihe kommt.
            <span className="zeile__terrainhinweis">{t('terrain.hinweis')}</span>
          ) : (
            teilnehmer.koerper.map((koerper) => (
              <KoerperFeld
                key={koerper.id}
                koerper={koerper}
                zeigeMarke={gruppe}
                onSchaden={(betrag) => props.onSchaden(koerper.id, betrag)}
                onSetzeHp={(wert) => props.onSetzeHp(koerper.id, wert)}
              />
            ))
          )}
        </div>

        {amZug ? <span className="zeile__dran">{t('amZug')}</span> : null}
      </div>

      {teilnehmer.zustaende.length > 0 ? (
        <div className="zeile__zustaende">
          {teilnehmer.zustaende.map((zustand) => (
            <button
              key={zustand.id}
              type="button"
              className="zustand"
              onClick={() => props.onZustandWeg(zustand.id)}
              // Wann er ablaeuft, steht in der Kurzinfo statt in der Marke:
              // auf dem Chip ist kein Platz fuer einen ganzen Satz, und im
              // Kampf zaehlt die Zahl.
              // Dazu die Regel, wenn es ein bekannter Zustand ist (SRD oder
              // eigener): am Tisch muss niemand nachschlagen, was Blind heisst.
              title={[regelZu(zustandsliste, zustand.name), `${t(`dauer.${zustand.dauer}`)} · ${t('knopf.entfernen')}`]
                .filter(Boolean)
                .join('\n\n')}
            >
              {zustand.name}
              {zustand.rundenRest !== null ? <span className="zustand__runden">{zustand.rundenRest}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {offen ? (
        <Ausklapp
          teilnehmer={teilnehmer}
          hatBild={Boolean(props.bildUrl)}
          onAendern={props.onAendern}
          onSortieren={props.onSortieren}
          onGruppe={props.onGruppe}
          onDuplizieren={props.onDuplizieren}
          onEntfernen={props.onEntfernen}
          onZustand={props.onZustand}
          onBild={props.onBild}
        />
      ) : null}

      {menue ? (
        <Kontextmenue
          x={menue.x}
          y={menue.y}
          onSchliessen={() => setMenue(null)}
          eintraege={[
            { text: t('knopf.umbenennen'), onWahl: props.onUmbenennen },
            { text: t('knopf.duplizieren'), onWahl: props.onDuplizieren },
            ...(props.zusatzMenue ?? []),
            { text: t('knopf.entfernen'), gefaehrlich: true, onWahl: props.onEntfernen }
          ]}
        />
      ) : null}
    </section>
  );
}

/**
 * Trefferpunkte eines Koerpers, mit dem Feld fuer Schaden daneben.
 *
 * Eintippen und Enter — nicht Plus- und Minusknoepfe: Schaden ist selten eins,
 * und siebenmal klicken ist am Tisch keine Bedienung.
 */
function KoerperFeld({
  koerper,
  zeigeMarke,
  onSchaden,
  onSetzeHp
}: {
  koerper: Koerper;
  zeigeMarke: boolean;
  onSchaden: (betrag: number) => void;
  onSetzeHp: (wert: number) => void;
}) {
  const [eingabe, setEingabe] = useState('');
  // Das HP-Feld haelt beim Tippen seinen eigenen Text: sofortiges Klemmen
  // machte aus „7" plus „5" wieder 7 (Testbericht).
  const [hpText, setHpText] = useState<string | null>(null);
  // Schaden und Heilung leuchten kurz auf, auch wenn die TP von woanders kommen
  // (Charakterbogen, Raum); vorher nur nach einer Eingabe hier.
  const kasten = useRef<HTMLSpanElement>(null);
  useWertBlitz(kasten, koerper.hp + koerper.tempHp, koerper.id);
  const liegt = koerper.hp <= 0 || koerper.raus;

  function anwenden() {
    // Summen und Wuerfel („3+4", „2d6+3"); ein Vorzeichen vorn heilt.
    const betrag = leseSchaden(eingabe);
    if (betrag === null) return;
    onSchaden(betrag);
    setEingabe('');
  }

  return (
    <span ref={kasten} className={`koerper ${liegt ? 'koerper--liegt' : ''}`}>
      {zeigeMarke && koerper.marke ? <span className="koerper__marke">{koerper.marke}</span> : null}
      <input
        className="koerper__hp"
        type="number"
        value={hpText ?? koerper.hp}
        onChange={(ereignis) => setHpText(ereignis.target.value)}
        onBlur={() => {
          if (hpText !== null) onSetzeHp(Number.parseInt(hpText, 10) || 0);
          setHpText(null);
        }}
        onKeyDown={(ereignis) => {
          if (ereignis.key === 'Enter') (ereignis.target as HTMLInputElement).blur();
        }}
        aria-label={t('feld.hp')}
      />
      <span className="koerper__max">/{koerper.hpMax}</span>
      {koerper.tempHp > 0 ? <span className="koerper__temp">+{koerper.tempHp}</span> : null}
      <input
        className="koerper__schaden"
        type="text"
        inputMode="numeric"
        value={eingabe}
        placeholder="–"
        title={t('schaden.hinweis')}
        onChange={(ereignis) => setEingabe(ereignis.target.value)}
        onKeyDown={(ereignis) => {
          if (ereignis.key === 'Enter') {
            ereignis.preventDefault();
            anwenden();
          } else if (ereignis.key === 'Escape') {
            setEingabe('');
          }
        }}
        // Kein Anwenden beim Verlassen: Schaden gilt erst mit Enter
        // (Testbericht: ein Klick daneben zog sonst unbemerkt Schaden ab).
      />
    </span>
  );
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="feld">
      <span className="feld__label">{label}</span>
      {children}
    </label>
  );
}

function Ausklapp({
  teilnehmer,
  hatBild,
  onAendern,
  onSortieren,
  onGruppe,
  onDuplizieren,
  onEntfernen,
  onZustand,
  onBild
}: {
  teilnehmer: Teilnehmer;
  hatBild: boolean;
  onAendern: (aendere: (teilnehmer: Teilnehmer) => Teilnehmer) => void;
  onSortieren?: () => void;
  onGruppe: (anzahl: number) => void;
  onDuplizieren: () => void;
  onEntfernen: () => void;
  onZustand: (name: string, dauer: Dauer, runden: number | null) => void;
  onBild: () => void;
}) {
  const zustandsliste = useZustandsliste();
  const [zustandName, setZustandName] = useState('');
  const [zustandRunden, setZustandRunden] = useState('');
  // 'zugEnde' als Vorgabe: das ist die Dauer der allermeisten Zauber.
  const [zustandDauer, setZustandDauer] = useState<Dauer>('zugEnde');

  function zustandHinzu() {
    const name = zustandName.trim();
    if (!name) return;
    const runden = Number.parseInt(zustandRunden, 10);
    // Ohne Zahl gilt einmal — "bis zum Ende deines naechsten Zuges" ist
    // einmal. Bei 'offen' spielt die Zahl keine Rolle.
    onZustand(
      name,
      zustandDauer,
      zustandDauer === 'offen' ? null : Number.isFinite(runden) && runden > 0 ? runden : 1
    );
    setZustandName('');
    setZustandRunden('');
  }

  return (
    <div className="ausklapp motion-eintritt">
      <div className="ausklapp__felder">
        <Feld label={t('feld.name')}>
          <input
            type="text"
            value={teilnehmer.name}
            autoFocus={!teilnehmer.name}
            onChange={(e) => onAendern((alt) => ({ ...alt, name: e.target.value }))}
          />
        </Feld>
        <Feld label={t('feld.initiative')}>
          <input
            type="number"
            className="schmal"
            value={teilnehmer.initiative}
            onChange={(e) => onAendern((alt) => ({ ...alt, initiative: Number.parseInt(e.target.value, 10) || 0 }))}
            // Erst beim Verlassen einsortieren: beim Tippen sprang die Zeile sonst unter dem Cursor weg.
            onBlur={() => onSortieren?.()}
          />
        </Feld>
        {/*
          Das Gelaende ist kein Lebewesen: Trefferpunkte, Gruppengroesse,
          Feinwert und der Spieler-Haken ergeben dafuer keinen Sinn. Felder,
          die man nicht sinnvoll ausfuellen kann, stehen besser gar nicht da
          — sonst fragt man sich, was man dort eintragen soll.

          Der Feinwert entscheidet Gleichstaende, und beim Gelaende
          entscheidet die Regel: es liegt immer hinten.
        */}
        {teilnehmer.istTerrain ? null : (
          <>
        <Feld label={t('feld.feinwert')}>
          <input
            type="number"
            className="schmal"
            value={teilnehmer.feinwert}
            onChange={(e) => onAendern((alt) => ({ ...alt, feinwert: Number.parseInt(e.target.value, 10) || 0 }))}
          />
        </Feld>
        <Feld label={t('feld.hpMax')}>
          <input
            type="number"
            className="schmal"
            value={teilnehmer.koerper[0]?.hpMax ?? 0}
            onChange={(e) => {
              const hpMax = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
              // Auch die laufenden Trefferpunkte mitziehen, solange sie
              // unberuehrt sind: beim Anlegen tippt man erst den Hoechstwert,
              // und eine Kreatur, die mit 0 von 12 startet, waere falsch.
              onAendern((alt) => ({
                ...alt,
                koerper: alt.koerper.map((koerper) => ({
                  ...koerper,
                  hpMax,
                  hp: koerper.hp === koerper.hpMax ? hpMax : Math.min(koerper.hp, hpMax)
                }))
              }));
            }}
          />
        </Feld>
        <Feld label={t('feld.anzahl')}>
          <ZahlFeld
            className="schmal"
            min={1}
            max={99}
            wert={teilnehmer.koerper.length}
            aendern={onGruppe}
          />
        </Feld>
        <Feld label={t('feld.tempHp')}>
          <input
            type="number"
            className="schmal"
            min={0}
            value={teilnehmer.koerper[0]?.tempHp ?? 0}
            onChange={(e) => {
              const tempHp = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
              onAendern((alt) => ({ ...alt, koerper: alt.koerper.map((k) => ({ ...k, tempHp })) }));
            }}
          />
        </Feld>
        <Feld label={t('feld.rk')}>
          <input
            type="number"
            min={0}
            className="schmal"
            value={teilnehmer.rk ?? ''}
            onChange={(e) => {
              const rk = Number.parseInt(e.target.value, 10);
              onAendern(({ rk: _alt, ...alt }) => (rk > 0 ? { ...alt, rk } : alt));
            }}
          />
        </Feld>
        <label className="feld feld--haken">
          <input
            type="checkbox"
            checked={teilnehmer.koerper.length > 0 && teilnehmer.koerper.every((k) => k.raus)}
            onChange={(e) =>
              onAendern((alt) => ({ ...alt, koerper: alt.koerper.map((k) => ({ ...k, raus: e.target.checked })) }))
            }
          />
          <span>{t('feld.raus')}</span>
        </label>
        <label className="feld feld--haken">
          <input
            type="checkbox"
            checked={teilnehmer.istSpieler}
            onChange={(e) => onAendern((alt) => ({ ...alt, istSpieler: e.target.checked }))}
          />
          <span>{t('feld.spieler')}</span>
        </label>
          </>
        )}
      </div>

      <div className="ausklapp__zustand">
        {/* Die Zustaende des SRD als Vorschlag; Freitext bleibt moeglich
            (Wunsch aus dem Testbericht: Auswahl statt nur Freitext). */}
        <datalist id={`zustaende-${teilnehmer.id}`}>
          {zustandsliste.map((z) => (
            <option key={`${z.eigen ? 'e' : 's'}-${z.name}`} value={z.name}>
              {z.eigen ? t('zustand.eigen') : 'SRD'}
            </option>
          ))}
        </datalist>
        <input
          type="text"
          list={`zustaende-${teilnehmer.id}`}
          placeholder={t('knopf.zustand')}
          value={zustandName}
          onChange={(e) => setZustandName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              zustandHinzu();
            }
          }}
        />
        <select
          className="ausklapp__dauer"
          value={zustandDauer}
          title={t('feld.dauer')}
          onChange={(e) => setZustandDauer(e.target.value as Dauer)}
        >
          {DAUERN.map((dauer) => (
            <option key={dauer} value={dauer}>
              {t(`dauer.${dauer}`)}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="schmal"
          placeholder={t('feld.runden')}
          // Bei 'offen' gibt es nichts zu zaehlen.
          disabled={zustandDauer === 'offen'}
          value={zustandRunden}
          onChange={(e) => setZustandRunden(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              zustandHinzu();
            }
          }}
        />
        <button type="button" onClick={zustandHinzu}>
          +
        </button>
      </div>

      <div className="ausklapp__knoepfe">
        {/* Kein Portrait fuers Gelaende: es hat kein Gesicht. */}
        {teilnehmer.istTerrain ? null : (
          <>
            <button type="button" onClick={onBild}>
              {hatBild ? t('knopf.bildAendern') : t('knopf.bild')}
            </button>
            {hatBild ? (
              <button type="button" onClick={() => onAendern((alt) => ({ ...alt, bild: null }))}>
                {t('knopf.bildWeg')}
              </button>
            ) : null}
          </>
        )}
        <button type="button" onClick={onDuplizieren}>
          {t('knopf.duplizieren')}
        </button>
        <span className="leiste__fueller" />
        <button type="button" className="knopf--gefahr" onClick={onEntfernen}>
          {t('knopf.entfernen')}
        </button>
      </div>

      {/* Die Notiz bleibt auch im Kampf sichtbar: dort steht etwa die
          Ruestungsklasse aus dem Encounter Creator (Testbericht). */}
      {(
        <textarea
          className="ausklapp__notiz"
          placeholder={t('feld.notiz')}
          value={teilnehmer.notiz}
          onChange={(e) => onAendern((alt) => ({ ...alt, notiz: e.target.value }))}
        />
      )}
    </div>
  );
}
