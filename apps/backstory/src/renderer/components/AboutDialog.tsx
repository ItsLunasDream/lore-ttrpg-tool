import { useEffect, useState } from 'react';
import { api, call } from '../api';
import { useT } from '../i18n';
import { Modal } from './Modal';

interface Props {
  onClose: () => void;
}

const REPO_URL = 'https://github.com/ItsLunasDream/lore-ttrpg-tool';
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;

/** Name, Version und Lizenz. Kein Rechtsdokument, nur der Verweis darauf. */
export function AboutDialog({ onClose }: Props) {
  const t = useT();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Schlaegt der Aufruf fehl, bleibt die Zeile einfach weg statt den
    // ganzen Dialog zu sprengen — die Versionsnummer ist eine Zugabe.
    void call(api.app.version()).then(
      (value) => {
        if (!cancelled) setVersion(value);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal title={t('about.title')} onClose={onClose}>
      <div className="about">
        <p className="about__author">{t('about.author')}</p>
        {version ? <p className="about__version">{t('about.version', { version })}</p> : null}

        <p className="about__license">{t('about.license')}</p>
        <p>{t('about.licenseDetail')}</p>
        <p className="modal__hint">{t('about.warranty')}</p>

        <div className="about__links">
          <button type="button" onClick={() => void call(api.openExternal(REPO_URL))}>
            {t('about.sourceLink')}
          </button>
          <button type="button" onClick={() => void call(api.openExternal(LICENSE_URL))}>
            {t('about.licenseLink')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
