/**
 * Name, Fassung und Lizenz der Sammlung. Kein Rechtsdokument, nur der Verweis
 * darauf — der vollstaendige Text steht im Repository und ist von hier aus
 * einen Klick entfernt.
 *
 * Dass es diese Angaben ueberhaupt geben muss, kommt von der AGPL: wer die
 * Software weitergibt, muss sagen, unter welcher Lizenz das geschieht und wo
 * der Quelltext zu finden ist.
 */
import type { Language, MessageKey, MessageParams } from '../shared/i18n';
import { Dialog } from './Dialog';
import { SuiteIcon } from './icons';
import { NAMENSNENNUNG } from '@suite/srd';

const REPO_URL = 'https://github.com/ItsLunasDream/lore-ttrpg-tool';
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
/*
 * Die Namensnennung fuer fremde Daten. CC-BY verlangt sie, und sie nur ins
 * README zu schreiben reicht nicht: wer die Anwendung benutzt, sieht das
 * README nie.
 */
const NOTICE_URL = `${REPO_URL}/blob/main/NOTICE.md`;

interface Props {
  readonly version: string;
  readonly onClose: () => void;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  /** Entscheidet, welche der beiden vorgeschriebenen Fassungen dasteht. */
  readonly sprache: Language;
}

export function Ueber({ version, onClose, t, sprache }: Props) {
  return (
    <Dialog titel={t('about.title')} schliessenText={t('dialog.close')} onClose={onClose}>
      <div className="ueber">
        <span className="ueber__marke" aria-hidden="true">
          <SuiteIcon size={48} />
        </span>
        <p className="ueber__name">LORE</p>
        <p className="ueber__untertitel">{t('menu.subtitle')}</p>
        <p className="ueber__autor">{t('about.author')}</p>
        {/* Die Fassung ist eine Zugabe: kommt sie nicht an, faellt die Zeile
            weg, statt den Dialog aufzuhalten. */}
        {version && <p className="ueber__fassung">{t('about.version', { version })}</p>}
        <p>{t('about.description')}</p>

        <p className="ueber__lizenz">{t('about.license')}</p>
        <p>{t('about.licenseDetail')}</p>
        <p className="ueber__gewaehr">{t('about.warranty')}</p>
        <p className="ueber__gewaehr">{t('about.notice')}</p>

        {/*
          DIESER SATZ IST WOERTLICH VORGESCHRIEBEN.
          =========================================
          Er ist die Bedingung, unter der das Material aus dem
          Systemreferenzdokument ueberhaupt benutzt werden darf, und er
          steht deshalb hier und nicht nur im NOTICE — wer die Anwendung
          benutzt, sieht das NOTICE nie.

          Er kommt aus `@suite/srd` und nicht aus dem i18n der Huelle:
          eine Uebersetzung ist hier kein Text, den man verbessern darf.
          Beide Fassungen stehen so im Dokument selbst.
        */}
        <p className="ueber__srd">{NAMENSNENNUNG[sprache === 'de' ? 'de' : 'en']}</p>

        <div className="ueber__verweise">
          {/* Kein <a href>: die Ansicht wuerde selbst dorthin navigieren und
              danach laege auf der fremden Seite dieselbe Bruecke wie auf der
              eigenen. Der Hauptprozess gibt die Adresse an den Browser des
              Systems weiter. */}
          <button type="button" onClick={() => void window.shell.app.oeffneExtern(REPO_URL)}>
            {t('about.sourceLink')}
          </button>
          <button type="button" onClick={() => void window.shell.app.oeffneExtern(LICENSE_URL)}>
            {t('about.licenseLink')}
          </button>
          <button type="button" onClick={() => void window.shell.app.oeffneExtern(NOTICE_URL)}>
            {t('about.noticeLink')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
