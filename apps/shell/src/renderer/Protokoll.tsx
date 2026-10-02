/**
 * Der Dialog des Sitzungsprotokolls (docs/sitzungsprotokoll.md).
 *
 * Drei Zustände: nichts läuft (Knopf „Sitzung beginnen"), eine Sitzung läuft
 * (Zahl der Einträge, Zeile von Hand, „Sitzung beenden"), und die Vorschau
 * nach dem Ende: Titel, Einträge abwählen, Zusammenfassung, dann als Notiz
 * in den Story Creator oder verwerfen.
 */
import { useEffect, useState } from 'react';
import type { MessageKey, MessageParams } from '../shared/i18n';
import type { Sitzung } from '../shared/protokoll';
import { Dialog } from './Dialog';

interface Props {
  readonly onClose: () => void;
  readonly t: (key: MessageKey, params?: MessageParams) => string;
}

function uhr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Protokoll({ onClose, t }: Props) {
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  const [zeile, setZeile] = useState('');
  const [zusammenfassung, setZusammenfassung] = useState('');
  const [vorschau, setVorschau] = useState('');
  const [meldung, setMeldung] = useState('');
  const [kiDa, setKiDa] = useState(false);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  useEffect(() => {
    void window.shell.protokoll.kiDa().then(setKiDa).catch(() => setKiDa(false));
  }, []);

  useEffect(() => {
    void window.shell.protokoll.zustand().then(setSitzung);
    return window.shell.protokoll.beiAenderung(() => void window.shell.protokoll.zustand().then(setSitzung));
  }, []);

  const beendet = sitzung !== null && sitzung.ende !== null;
  useEffect(() => {
    if (!beendet) return;
    const zeit = window.setTimeout(() => void window.shell.protokoll.vorschau(zusammenfassung).then(setVorschau), 250);
    return () => window.clearTimeout(zeit);
  }, [beendet, sitzung, zusammenfassung]);

  const bearbeite = (s: Sitzung) => {
    setSitzung(s);
    void window.shell.protokoll.bearbeite(s);
  };

  return (
    <Dialog titel={t('session.title')} schliessenText={t('dialog.close')} onClose={onClose} klasse="protokoll">
      {!sitzung ? (
        <div className="protokoll__leer" data-protokoll="aus">
          <p>{t('session.idle')}</p>
          <button
            type="button"
            className="dialog__knopf dialog__knopf--haupt"
            data-protokoll-start
            onClick={() => void window.shell.protokoll.start().then(setSitzung)}
          >
            ● {t('session.start')}
          </button>
        </div>
      ) : !beendet ? (
        <div data-protokoll="laeuft">
          <p>
            <strong>{sitzung.titel}</strong>
            <br />
            <span className="feld__hinweis">{t('session.running', { zeit: uhr(sitzung.beginn), anzahl: sitzung.eintraege.length })}</span>
          </p>
          <form
            className="protokoll__zeile"
            onSubmit={(e) => {
              e.preventDefault();
              if (!zeile.trim()) return;
              void window.shell.protokoll.hand(zeile).then((s) => {
                setSitzung(s);
                setZeile('');
              });
            }}
          >
            <input className="feld__eingabe" value={zeile} placeholder={t('session.line')} data-protokoll-zeile onChange={(e) => setZeile(e.target.value)} />
            <button type="submit" className="dialog__knopf">
              {t('session.add')}
            </button>
          </form>
          <ul className="protokoll__liste" data-protokoll-liste>
            {sitzung.eintraege.length === 0 ? <li className="feld__hinweis">{t('session.empty')}</li> : null}
            {[...sitzung.eintraege]
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <li key={e.id} className={e.wichtig ? 'protokoll__eintrag protokoll__eintrag--wichtig' : 'protokoll__eintrag'}>
                  <span className="feld__hinweis">{uhr(e.zeit)}</span> {e.text}
                </li>
              ))}
          </ul>
          <button type="button" className="dialog__knopf" data-protokoll-stopp onClick={() => void window.shell.protokoll.stopp().then(setSitzung)}>
            ■ {t('session.stop')}
          </button>
        </div>
      ) : (
        <div data-protokoll="vorschau">
          <label className="protokoll__feld">
            <span>{t('session.noteTitle')}</span>
            <input className="feld__eingabe" value={sitzung.titel} data-protokoll-titel onChange={(e) => bearbeite({ ...sitzung, titel: e.target.value })} />
          </label>
          <label className="protokoll__feld">
            <span>{t('session.summary')}</span>
            <textarea className="feld__eingabe" rows={3} value={zusammenfassung} data-protokoll-zusammenfassung onChange={(e) => setZusammenfassung(e.target.value)} />
          </label>
          {kiDa ? (
            <button
              type="button"
              className="dialog__knopf"
              data-protokoll-ki
              disabled={kiLaeuft}
              onClick={() =>
                void (async () => {
                  if (zusammenfassung.trim() && !confirm(t('session.aiReplace'))) return;
                  setKiLaeuft(true);
                  setMeldung('');
                  try {
                    const r = await window.shell.protokoll.ki();
                    if (r.ok) setZusammenfassung(r.text);
                    else if (r.text) setMeldung(r.text);
                  } finally {
                    setKiLaeuft(false);
                  }
                })()
              }
            >
              {kiLaeuft ? t('session.aiRunning') : `✦ ${t('session.aiButton')}`}
            </button>
          ) : null}
          <p className="feld__hinweis">{t('session.entries')}</p>
          <ul className="protokoll__liste protokoll__liste--wahl" data-protokoll-auswahl>
            {sitzung.eintraege.length === 0 ? <li className="feld__hinweis">{t('session.empty')}</li> : null}
            {sitzung.eintraege.map((e) => (
              <li key={e.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!e.weg}
                    data-protokoll-eintrag={e.id}
                    onChange={(ev) => bearbeite({ ...sitzung, eintraege: sitzung.eintraege.map((x) => (x.id === e.id ? { ...x, weg: !ev.target.checked } : x)) })}
                  />{' '}
                  <span className="feld__hinweis">{uhr(e.zeit)}</span> {e.text}
                  {e.wichtig ? <span className="feld__hinweis"> · {t('session.important')}</span> : null}
                </label>
              </li>
            ))}
          </ul>
          <details>
            <summary>{t('session.preview')}</summary>
            <pre className="protokoll__vorschau" data-protokoll-vorschau>
              {vorschau}
            </pre>
          </details>
          {meldung ? (
            <p key={meldung} className="einst__satz motion-meldung-ok" data-protokoll-meldung>
              {meldung}
            </p>
          ) : null}
          <div className="knopfreihe">
            <button
              type="button"
              className="dialog__knopf dialog__knopf--haupt"
              data-protokoll-anlegen
              onClick={() =>
                void window.shell.protokoll.anlegen(zusammenfassung).then((r) => {
                  setMeldung(r.ok ? t('session.created', { text: r.text }) : r.text);
                  if (r.ok) {
                    setSitzung(null);
                    setZusammenfassung('');
                  }
                })
              }
            >
              {t('session.create')}
            </button>
            <button
              type="button"
              className="dialog__knopf"
              data-protokoll-verwerfen
              onClick={() => {
                if (!confirm(t('session.discardSure'))) return;
                void window.shell.protokoll.verwerfen().then(() => setSitzung(null));
              }}
            >
              {t('session.discard')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
