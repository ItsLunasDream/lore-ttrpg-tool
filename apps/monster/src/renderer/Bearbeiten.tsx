/**
 * Ein gewuerfeltes Monster von Hand nachbessern.
 *
 * Wunsch aus dem Testbericht: bisher liess sich nur neu wuerfeln, und wer
 * nur den Namen oder eine Zahl anders haben wollte, verlor dabei den Rest.
 * Jede Aenderung geht sofort ans Monster; die Pruefung darunter rechnet
 * mit, so sieht man beim Tippen, ob der Grad noch haelt.
 */

import type { Monster, Faehigkeitseintrag } from '../shared/erzeuge';
import { ZahlFeld } from '@suite/zahlfeld/feld';
import { abzweig } from '../shared/erzeuge';
import { angriffName, schadenProRunde, type Angriff } from '../shared/angriffe';
import type { Kategorie } from '../shared/tabellen';
import { getLanguage, t } from './i18n';

const KATEGORIEN: readonly Kategorie[] = ['passiv', 'aktion', 'bonusaktion', 'reaktion', 'legendaer'];

/** Der Rundenschaden folgt den Angriffen, sonst rechnet die Pruefung mit alten Zahlen. */
function mitSumme(monster: Monster, angriffe: readonly Angriff[]): Monster {
  const zusatz = abzweig(monster.faehigkeiten, monster.werte.schadenProRunde).schaden;
  return {
    ...monster,
    angriffe,
    werte: { ...monster.werte, schadenProRunde: Math.max(1, schadenProRunde(angriffe) + zusatz) }
  };
}

export function Bearbeiten({
  monster,
  onAendern
}: {
  readonly monster: Monster;
  readonly onAendern: (monster: Monster) => void;
}) {
  const sprache = getLanguage() === 'en' ? 'en' : 'de';
  const setzeFaehigkeit = (stelle: number, neu: Partial<Faehigkeitseintrag>) =>
    onAendern({
      ...monster,
      faehigkeiten: monster.faehigkeiten.map((f, i) => (i === stelle ? { ...f, ...neu } : f))
    });
  const setzeAngriff = (stelle: number, neu: Partial<Angriff>) =>
    onAendern(mitSumme(monster, monster.angriffe.map((a, i) => (i === stelle ? { ...a, ...neu } : a))));

  return (
    <section className="bearbeiten" data-bearbeiten>
      <div className="bearbeiten__reihe">
        <label className="bearbeiten__feld bearbeiten__feld--breit">
          {t('bearbeiten.name')}
          <input value={monster.name} onChange={(e) => onAendern({ ...monster, name: e.target.value })} />
        </label>
        <label className="bearbeiten__feld">
          {t('werte.rk')}
          <ZahlFeld
            min={1}
            wert={monster.werte.rk}
            aendern={(n) => onAendern({ ...monster, werte: { ...monster.werte, rk: n } })}
          />
        </label>
        <label className="bearbeiten__feld">
          {t('werte.tp')}
          <ZahlFeld
            min={1}
            wert={monster.werte.tp}
            aendern={(n) => onAendern({ ...monster, werte: { ...monster.werte, tp: n } })}
          />
        </label>
      </div>

      <label className="bearbeiten__feld bearbeiten__feld--breit">
        {t('bearbeiten.satz')}
        <textarea rows={2} value={monster.satz} onChange={(e) => onAendern({ ...monster, satz: e.target.value })} />
      </label>

      <h3 className="bearbeiten__titel">{t('block.aktionen')}</h3>
      {monster.angriffe.map((angriff, stelle) => (
        <div className="bearbeiten__reihe" key={`${angriff.waffeId}-${stelle}`}>
          <span className="bearbeiten__waffe">{angriffName(angriff.waffeId, sprache)}</span>
          {angriff.art !== 'flaeche' && (
            <label className="bearbeiten__feld">
              {t('bearbeiten.anzahl')}
              <ZahlFeld
                min={1}
                wert={angriff.anzahl}
                aendern={(n) => setzeAngriff(stelle, { anzahl: n })}
              />
            </label>
          )}
          <label className="bearbeiten__feld">
            {t('bearbeiten.schnitt')}
            <ZahlFeld
              min={1}
              wert={angriff.schadenJeAngriff}
              aendern={(n) => setzeAngriff(stelle, { schadenJeAngriff: n })}
            />
          </label>
          <label className="bearbeiten__feld">
            {t('bearbeiten.wuerfel')}
            <input value={angriff.wuerfel} onChange={(e) => setzeAngriff(stelle, { wuerfel: e.target.value })} />
          </label>
        </div>
      ))}

      <h3 className="bearbeiten__titel">{t('bearbeiten.faehigkeiten')}</h3>
      {monster.faehigkeiten.map((f, stelle) => (
        <div className="bearbeiten__faehigkeit" key={stelle}>
          <div className="bearbeiten__reihe">
            <input
              className="bearbeiten__fname"
              value={f.name}
              aria-label={t('bearbeiten.name')}
              onChange={(e) => setzeFaehigkeit(stelle, { name: e.target.value })}
            />
            <select
              value={f.kategorie}
              aria-label={t('bearbeiten.art')}
              onChange={(e) => setzeFaehigkeit(stelle, { kategorie: e.target.value as Kategorie })}
            >
              {KATEGORIEN.map((k) => (
                <option key={k} value={k}>
                  {t(`kategorie.${k}` as const)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="knopf knopf--klein"
              onClick={() => onAendern({ ...monster, faehigkeiten: monster.faehigkeiten.filter((_, i) => i !== stelle) })}
            >
              {t('knopf.loeschen')}
            </button>
          </div>
          <textarea rows={2} value={f.text} onChange={(e) => setzeFaehigkeit(stelle, { text: e.target.value })} />
        </div>
      ))}
      <button
        type="button"
        className="knopf knopf--klein"
        onClick={() =>
          onAendern({
            ...monster,
            faehigkeiten: [...monster.faehigkeiten, { name: t('bearbeiten.neueFaehigkeit'), text: '', kategorie: 'passiv' }]
          })
        }
      >
        {t('bearbeiten.dazu')}
      </button>
    </section>
  );
}
