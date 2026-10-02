/**
 * Der Statblock.
 *
 * Aufbau und Reihenfolge wie im Regelwerk, und das ist kein Zierrat: wer
 * seit Jahren D&D leitet, sucht die Ruestungsklasse oben links und die
 * Aktionen unten. Ein eigener Aufbau kostet bei jedem Nachschlagen eine
 * Sekunde, und am Tisch warten dabei vier Leute.
 *
 * Deshalb: Kopf, Ruestung und Trefferpunkte, Bewegung, die sechs Attribute
 * in einer Reihe, dann Widerstaende, dann die passiven Faehigkeiten, dann
 * Aktionen, Bonusaktionen, Reaktionen und zuletzt die legendaeren.
 */
import { ATTRIBUTE, alsVorzeichen, attributKuerzel, modifikator, uebungsbonus } from '../shared/attribute';
import { epFuerGrad } from '@suite/srd';
import { richtwert } from '../shared/richtwerte';
import { alsZeile } from '../shared/bewegung';
import { angriffName, angriffSchaden, reichweiteText, WAFFEN, type Angriff } from '../shared/angriffe';
import { schadensartName } from '../shared/schadensarten';
import { abzweig, angriffeProRunde, type Monster } from '../shared/erzeuge';
import type { Kategorie } from '../shared/tabellen';
import { getLanguage, t } from './i18n';

export function Statblock({ monster }: { readonly monster: Monster }) {
  const sprache = getLanguage() === 'en' ? 'en' : 'de';
  const w = monster.werte;
  const angriffe = monster.angriffe.filter((a) => a.art !== 'flaeche');
  const flaechen = monster.angriffe.filter((a) => a.art === 'flaeche');
  const gesamt = angriffeProRunde(monster);

  const ausListe = (kategorie: Kategorie) =>
    monster.faehigkeiten.filter((f) => f.kategorie === kategorie);

  const arten = (liste: readonly string[]) =>
    liste.map((id) => schadensartName(id, sprache)).join(', ');

  return (
    <section className="statblock">
      <header className="statblock__kopf">
        <h2 className="statblock__name" data-wurf-feld>{monster.name}</h2>
        <p className="statblock__art" data-wurf-feld>
          {monster.thema} · {monster.rolle} · {t('feld.cr')} {monster.cr}
        </p>
      </header>

      <Trennlinie />

      <div className="statblock__grund" data-wurf-feld>
        <Zeile name={t('werte.rk')} wert={String(w.rk)} />
        <Zeile name={t('werte.tp')} wert={String(w.tp)} />
        <Zeile name={t('werte.tempo')} wert={alsZeile(monster.bewegung, sprache)} />
        {/* Wie im Statblock von 2024: Initiative mit Wert in Klammern. */}
        <Zeile
          name={t('werte.initiative')}
          wert={`${alsVorzeichen(modifikator(monster.attribute.ge))} (${10 + modifikator(monster.attribute.ge)})`}
        />
      </div>

      <Trennlinie />

      {/* Die sechs Attribute in einer Reihe, wie im Buch. */}
      <table className="statblock__attribute" data-wurf-feld>
        <thead>
          <tr>
            {ATTRIBUTE.map((id) => (
              <th key={id} scope="col">
                {attributKuerzel(id, sprache)}
                {id === monster.hauptattribut && (
                  <span className="statblock__haupt" title={t('werte.hauptattribut')} aria-hidden="true">
                    ★
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {ATTRIBUTE.map((id) => (
              <td key={id}>
                {monster.attribute[id]} <span className="statblock__mod">({alsVorzeichen(modifikator(monster.attribute[id]))})</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <Trennlinie />

      <div className="statblock__grund" data-wurf-feld>
        {monster.widerstaende.verwundbarkeiten.length > 0 && (
          <Zeile name={t('werte.verwundbar')} wert={arten(monster.widerstaende.verwundbarkeiten)} />
        )}
        {monster.widerstaende.resistenzen.length > 0 && (
          <Zeile name={t('werte.resistent')} wert={arten(monster.widerstaende.resistenzen)} />
        )}
        {monster.widerstaende.immunitaeten.length > 0 && (
          <Zeile name={t('werte.immun')} wert={arten(monster.widerstaende.immunitaeten)} />
        )}
        <Zeile name={t('werte.sinne')} wert={t('werte.passiv', { n: 10 + modifikator(monster.attribute.we) })} />
        <Zeile
          name={t('feld.cr')}
          wert={t('werte.grad', {
            cr: monster.cr,
            ep: (epFuerGrad(monster.cr) ?? 0).toLocaleString(sprache === 'de' ? 'de-DE' : 'en-US'),
            ub: uebungsbonus(richtwert(monster.cr)?.wert ?? 0)
          })}
        />
        <Zeile name={t('werte.umgebung')} wert={monster.umgebung} />
      </div>

      <Trennlinie />

      <p className="statblock__satz" data-wurf-feld>{monster.satz}</p>

      {/* Passives steht ohne Ueberschrift ueber den Aktionen. */}
      {ausListe('passiv').map((f) => (
        <p className="statblock__eintrag" data-wurf-feld key={f.name}>
          <strong>{f.name}.</strong> {f.text}
        </p>
      ))}

      <h3 className="statblock__ueberschrift">{t('block.aktionen')}</h3>
      {gesamt > 1 && (
        <p className="statblock__eintrag" data-wurf-feld>
          <strong>{t('block.mehrfachangriff')}.</strong>{' '}
          {t('block.mehrfachangriffText', {
            anzahl: gesamt,
            was: angriffe.map((a) => `${a.anzahl}× ${angriffName(a.waffeId, sprache)}`).join(' + ')
          })}
        </p>
      )}
      {angriffe.map((angriff, stelle) => (
        <Angriffszeile key={`${angriff.waffeId}-${stelle}`} angriff={angriff} />
      ))}
      {flaechen.map((angriff, stelle) => (
        <Angriffszeile key={`flaeche-${angriff.waffeId}-${stelle}`} angriff={angriff} />
      ))}
      {ausListe('aktion').map((f) => (
        <p className="statblock__eintrag" data-wurf-feld key={f.name}>
          <strong>{f.name}.</strong> {f.text}
        </p>
      ))}

      {/*
       * Die Summe darunter, klein.
       *
       * „Schaden pro Runde" allein war die Zahl, mit der niemand etwas
       * anfangen konnte. Jetzt steht darueber, woraus sie besteht, und sie
       * selbst ist das, was sie ist: die Zahl, mit der die Pruefung rechnet.
       */}
      <p className="statblock__summe" data-wurf-feld>
        {t(abzweig(monster.faehigkeiten, w.schadenProRunde).schaden > 0 ? 'block.summeMitFaehigkeit' : 'block.summe', {
          gesamt: w.schadenProRunde,
          anzahl: gesamt,
          je: angriffe[0]?.schadenJeAngriff ?? w.schadenProRunde,
          zusatz: abzweig(monster.faehigkeiten, w.schadenProRunde).schaden
        })}
        {flaechen.some((a) => a.aufladen) ? ` ${t('block.summeFlaeche')}` : ''}
      </p>

      <Abschnitt titel={t('block.bonusaktionen')} eintraege={ausListe('bonusaktion')} />
      <Abschnitt titel={t('block.reaktionen')} eintraege={ausListe('reaktion')} />

      {w.legendaer && (
        <>
          <h3 className="statblock__ueberschrift">{t('block.legendaer')}</h3>
          <p className="statblock__satz statblock__satz--klein">{t('block.legendaerText')}</p>
          {ausListe('legendaer').map((f) => (
            <p className="statblock__eintrag" data-wurf-feld key={f.name}>
              <strong>{f.name}.</strong> {f.text}
            </p>
          ))}
          {angriffe[0] && (
            <p className="statblock__eintrag" data-wurf-feld>
              <strong>{t('block.legendaerAngriff')}.</strong>{' '}
              {t('block.legendaerAngriffText', { waffe: angriffName(angriffe[0].waffeId, sprache) })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Trennlinie() {
  return <hr className="statblock__linie" aria-hidden="true" />;
}

function Zeile({ name, wert }: { readonly name: string; readonly wert: string }) {
  return (
    <p className="statblock__zeile" data-wurf-feld>
      <strong>{name}</strong> {wert}
    </p>
  );
}

function Abschnitt({
  titel,
  eintraege
}: {
  readonly titel: string;
  readonly eintraege: readonly { name: string; text: string }[];
}) {
  if (eintraege.length === 0) return null;
  return (
    <>
      <h3 className="statblock__ueberschrift">{titel}</h3>
      {eintraege.map((f) => (
        <p className="statblock__eintrag" data-wurf-feld key={f.name}>
          <strong>{f.name}.</strong> {f.text}
        </p>
      ))}
    </>
  );
}

/**
 * Eine Angriffszeile.
 *
 * Der Unterschied zwischen Wurf und Rettung steht vorn, weil er am Tisch
 * die erste Frage ist: muss ich wuerfeln, oder muss der Spieler?
 */
function Angriffszeile({ angriff }: { readonly angriff: Angriff }) {
  const sprache = getLanguage() === 'en' ? 'en' : 'de';
  const waffe = WAFFEN.find((w) => w.id === angriff.waffeId);
  const name = angriffName(angriff.waffeId, sprache);
  const schaden = `${angriff.schadenJeAngriff} (${angriff.wuerfel}) ${angriffSchaden(angriff, sprache)}`;
  const reichweite = waffe ? reichweiteText(waffe, sprache) : '';

  if (angriff.art === 'flaeche' && angriff.rettung) {
    return (
      <p className="statblock__eintrag" data-wurf-feld>
        <strong>
          {name}
          {angriff.aufladen ? ` ${t('block.aufladen')}` : ''}.
        </strong>{' '}
        {t('block.flaeche', {
          flaeche: reichweite,
          attribut: attributKuerzel(angriff.rettung.attribut, sprache),
          sg: angriff.rettung.sg,
          schaden
        })}
      </p>
    );
  }

  return (
    <p className="statblock__eintrag" data-wurf-feld>
      <strong>{name}.</strong>{' '}
      {t(angriff.art === 'nah' ? 'block.nahkampf' : 'block.fernkampf', {
        bonus: angriff.trefferbonus ?? 0,
        reichweite,
        schaden
      })}
    </p>
  );
}
