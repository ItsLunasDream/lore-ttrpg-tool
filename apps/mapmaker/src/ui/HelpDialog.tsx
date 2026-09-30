/** Hilfe: Steuerung und der Weg von der leeren Karte nach Foundry. */

import { useT } from '@/i18n/useT';
import { useEscapeClose } from './controls';
import { KeyBindings } from './KeyBindings';
import { LANGUAGES, LANGUAGE_LABELS } from '@/i18n';
import type { StringKey } from '@/i18n';

/** Eine Zeile der Tastentabelle: Taste (oder Beschreibung) und Wirkung. */
type Entry = [key: StringKey | string, action: StringKey];

const VIEW: Entry[] = [
  ['help.pan', 'help.panAction'],
  ['help.wheel', 'help.wheelAction'],
  ['help.altWheel', 'help.altWheelAction'],
  ['@Strg+0 / Einpassen', 'help.fitAction'],
];

/**
 * Nur noch die Griffe mit der Maus.
 *
 * Die reinen Tastenkürzel standen hier als feste Zeilen — eine dritte Liste
 * neben der wirksamen Belegung und der Werkzeugleiste. Sie kommen jetzt aus der
 * Belegung selbst, samt Möglichkeit, sie zu ändern.
 */
const EDITING: Entry[] = [
  ['help.shiftWheel', 'help.shiftWheelAction'],
  ['help.clickThrough', 'help.clickThroughAction'],
  ['help.altDrag', 'help.altDragAction'],
  ['help.ctrlDrag', 'help.ctrlDragAction'],
  ['help.propGrab', 'help.propGrabAction'],
  ['help.altProp', 'help.altPropAction'],
  ['help.rightBrush', 'help.rightBrushAction'],
  ['help.pathEdit', 'help.pathEditAction'],
  ['help.polygonFinish', 'help.polygonFinishAction'],
];

const VTT: Entry[] = [
  ['help.wallDraw', 'help.wallDrawAction'],
  ['help.wallFinish', 'help.wallFinishAction'],
  ['help.wallClose', 'help.wallCloseAction'],
  ['help.wallBack', 'help.wallBackAction'],
  ['help.openingDrag', 'help.openingDragAction'],
  ['help.openingClick', 'help.openingClickAction'],
  ['help.lightDrag', 'help.lightDragAction'],
  ['help.rightDelete', 'help.rightDeleteAction'],
];

const STEPS: StringKey[] = [
  'help.step1',
  'help.step2',
  'help.step3',
  'help.step4',
  'help.step5',
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t, language, setLanguage } = useT();
  useEscapeClose(onClose);

  // Einträge, die mit @ beginnen, sind sprachunabhängige Tastenkürzel.
  const label = (value: string) => (value.startsWith('@') ? value.slice(1) : t(value as StringKey));

  const table = (title: StringKey, rows: Entry[]) => (
    <>
      <h4>{t(title)}</h4>
      <table className="help-table">
        <tbody>
          {rows.map(([k, action]) => (
            <tr key={`${k}-${action}`}>
              <th>{label(k)}</th>
              <td>{t(action)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{t('help.title')}</h3>
          <div className="row-inline">
            <label htmlFor="help-language">{t('toolbar.language')}</label>
            <select
              id="help-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </select>
            <button className="ghost icon" onClick={onClose} title={t('export.close')}>
              ✕
            </button>
          </div>
        </header>

        <div className="modal-body">
          <p className="hint">{t('help.intro')}</p>

          <h4>{t('help.workflow')}</h4>
          <ol className="help-steps">
            {STEPS.map((step) => (
              <li key={step}>{t(step)}</li>
            ))}
          </ol>
          <p className="hint">{t('help.saveHint')}</p>

          <KeyBindings />

          {table('help.navigation', VIEW)}
          {table('help.editing', EDITING)}
          {table('help.vtt', VTT)}
        </div>

        <footer>
          <button className="primary" onClick={onClose}>
            {t('export.close')}
          </button>
        </footer>
      </div>
    </div>
  );
}
