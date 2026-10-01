/**
 * Die Hilfe eines Werkzeugs (Rückmeldung: „pro App ein kleines
 * Help-Fenster wie im Map Maker"). Knopf „?" in der Titelleiste oder F1.
 *
 * Inhalt: was das Werkzeug tut (dieselben Sätze wie die Einführung), die
 * Bedienung, wo es Eigenheiten hat, und was überall gilt.
 */
import { ALLGEMEIN, STEUERUNG, WILLKOMMEN, type Einfuehrung, type Paar } from '../shared/einfuehrung';
import type { Language, MessageKey, MessageParams } from '../shared/i18n';
import { Dialog } from './Dialog';
import { AppSymbol, SuiteIcon } from './icons';

interface Props {
  readonly inhalt: Einfuehrung;
  /** Der Name, wie er in der Schiene steht. */
  readonly name: string;
  readonly sprache: Language;
  readonly bild?: string;
  readonly onClose: () => void;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
}

export function Hilfe({ inhalt, name, sprache, bild, onClose, t }: Props) {
  const text = (paar: Paar) => (sprache === 'de' ? paar.de : paar.en);
  const steuerung = STEUERUNG[inhalt.id] ?? [];
  return (
    <Dialog titel={t('help.title', { name })} schliessenText={t('dialog.close')} onClose={onClose}>
      <div className="einfuehrung__kopf" data-hilfe={inhalt.id}>
        <span className="einfuehrung__symbol" aria-hidden="true">
          {inhalt.id === WILLKOMMEN ? <SuiteIcon size={44} /> : <AppSymbol id={inhalt.id} size={44} bild={bild} />}
        </span>
        <p className="einfuehrung__satz">{text(inhalt.satz)}</p>
      </div>
      <ul className="einfuehrung__punkte">
        {inhalt.punkte.map((punkt) => (
          <li key={punkt.en}>{text(punkt)}</li>
        ))}
      </ul>
      {steuerung.length ? (
        <>
          <h3 className="hilfe__titel">{t('help.controls')}</h3>
          <ul className="einfuehrung__punkte" data-hilfe-steuerung>
            {steuerung.map((p) => (
              <li key={p.en}>{text(p)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3 className="hilfe__titel">{t('help.general')}</h3>
      <ul className="einfuehrung__punkte hilfe__allgemein">
        {ALLGEMEIN.map((p) => (
          <li key={p.en}>{text(p)}</li>
        ))}
      </ul>
    </Dialog>
  );
}
