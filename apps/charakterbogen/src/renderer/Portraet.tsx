/**
 * Das Bild der Figur mit waehlbarem Rahmen (Rueckmeldung).
 *
 * Das Bild wird hier verkleinert (laengste Seite 480 px, JPEG) und als
 * data:-Adresse im Bogen gespeichert: so reist es mit dem Bogen durch
 * Ablage, Teilen und Raum, ohne eigene Datei.
 */
import { useRef, useState } from 'react';
import { t } from './i18n';
import type { Bogen, Rahmen } from '../shared/bogen';

const KANTE = 480;

function verkleinere(datei: File): Promise<string> {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('lesen'));
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('bild'));
      bild.onload = () => {
        const faktor = Math.min(1, KANTE / Math.max(bild.width, bild.height));
        const flaeche = document.createElement('canvas');
        flaeche.width = Math.max(1, Math.round(bild.width * faktor));
        flaeche.height = Math.max(1, Math.round(bild.height * faktor));
        const stift = flaeche.getContext('2d');
        if (!stift) return fehler(new Error('leinwand'));
        stift.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
        fertig(flaeche.toDataURL('image/jpeg', 0.86));
      };
      bild.src = String(leser.result);
    };
    leser.readAsDataURL(datei);
  });
}

export function Portraet({ bild, setze }: { bild: Bogen['bild']; setze: (b: Bogen['bild'] | undefined) => void }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState('');
  const rahmen: Rahmen = bild?.rahmen ?? 'kreis';
  return (
    <div className="portraet" data-portraet>
      <button
        type="button"
        className={`portraet__rahmen portraet__rahmen--${rahmen}`}
        title={bild ? t('bild.aendern') : t('bild.waehlen')}
        onClick={() => eingabe.current?.click()}
      >
        {bild ? <img src={bild.daten} alt="" /> : <span className="portraet__leer">＋ {t('bild')}</span>}
      </button>
      <input
        ref={eingabe}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        data-bild-datei
        onChange={async (e) => {
          const datei = e.target.files?.[0];
          e.target.value = '';
          if (!datei) return;
          try {
            setFehler('');
            setze({ daten: await verkleinere(datei), rahmen });
          } catch {
            setFehler(t('bild.fehler'));
          }
        }}
      />
      {bild ? (
        <div className="portraet__wahl">
          {/* Der Rahmen steht unter „Aussehen" (Rückmeldung). */}
          <button type="button" className="knopf--klein knopf--leise" title={t('bild.weg')} onClick={() => setze(undefined)}>
            {t('bild.weg')}
          </button>
        </div>
      ) : null}
      {fehler ? <p className="stoerung">{fehler}</p> : null}
    </div>
  );
}
