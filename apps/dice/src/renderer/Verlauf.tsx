/**
 * Der Verlauf der letzten Wuerfe.
 *
 * Nur fuer diese Sitzung — beim Schliessen ist er weg, und er wird bewusst
 * nicht geschrieben. Ein Wurf ist ein Ereignis am Tisch, kein Dokument.
 *
 * Ein Eintrag laesst sich anklicken und holt denselben Pool zurueck: dieselbe
 * Sache noch einmal zu wuerfeln ist der haeufigste Wunsch, und ihn neu
 * zusammenzuklicken die haeufigste vermeidbare Arbeit.
 */
import { t } from './i18n';
import type { Eintrag } from './verlaufTypen';

interface Props {
  readonly eintraege: readonly Eintrag[];
  /** Der Eintrag, dessen Wuerfel gerade auf dem Tisch liegen. */
  readonly aktiv?: number | null;
  onZurueckholen(eintrag: Eintrag): void;
  onLeeren(): void;
}

export function Verlauf({ eintraege, aktiv, onZurueckholen, onLeeren }: Props) {
  return (
    <section className="verlauf">
      <header className="verlauf__kopf">
        <span className="verlauf__titel">{t('verlauf.titel')}</span>
        <span className="verlauf__hinweis">{t('verlauf.hinweis')}</span>
        {/* Ohne Eintraege gaebe es nichts zu leeren; der Knopf waere dann nur
            eine Flaeche, die nichts tut. */}
        {eintraege.length > 0 ? (
          <button type="button" className="verlauf__leeren" onClick={onLeeren}>
            {t('verlauf.leeren')}
          </button>
        ) : null}
      </header>

      {eintraege.length === 0 ? (
        <p className="verlauf__leer">{t('verlauf.leer')}</p>
      ) : (
        <ol className="verlauf__liste">
          {eintraege.map((eintrag) => (
            <li key={eintrag.id}>
              <button
                type="button"
                className={eintrag.id === aktiv ? 'ist-an' : ''}
                aria-current={eintrag.id === aktiv ? 'true' : undefined}
                data-verlauf-eintrag={eintrag.id}
                onClick={() => onZurueckholen(eintrag)}
                title={t('verlauf.holen')}
              >
                <span className="verlauf__ausdruck">{eintrag.wurf.ausdruck}</span>
                <span className="verlauf__einzeln">{fasseZusammen(eintrag)}</span>
                <span className="verlauf__summe">{eintrag.wurf.summe}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Die Einzelergebnisse, nach Wuerfelart gruppiert.
 *
 * Nicht als eine lange Zahlenreihe: bei „4d6 + 3d20\" stuenden dort sieben
 * Zahlen, und man wuesste nicht, welche zu welcher Art gehoert. Abzuege
 * tragen ihr Minus mit, sonst geht die Summe nicht auf.
 */
function fasseZusammen(eintrag: Eintrag): string {
  const gruppen: string[] = [];
  let laufend: { art: string; zahlen: number[]; abzug: boolean } | null = null;

  for (const wurf of eintrag.wurf.wuerfe) {
    const marke = `${wurf.art}-${wurf.zaehltPositiv}`;
    if (!laufend || `${laufend.art}-${!laufend.abzug}` !== marke) {
      if (laufend) gruppen.push(schreibeGruppe(laufend));
      laufend = { art: wurf.art, zahlen: [], abzug: !wurf.zaehltPositiv };
    }
    laufend.zahlen.push(wurf.augen);
  }
  if (laufend) gruppen.push(schreibeGruppe(laufend));
  return gruppen.join('  ');
}

function schreibeGruppe(gruppe: { zahlen: number[]; abzug: boolean }): string {
  const inhalt = gruppe.zahlen.join(', ');
  return gruppe.abzug ? `−[${inhalt}]` : `[${inhalt}]`;
}
