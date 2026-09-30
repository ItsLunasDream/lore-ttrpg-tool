/**
 * Farbe und Muster der Wuerfel.
 *
 * Gilt fuer alle gemeinsam: die Wuerfelart erkennt man an der Form, nicht an
 * der Farbe. Ein Satz je Art waere ein Zusatz fuer spaeter — das Datenmodell
 * traegt ihn schon (ein globaler Satz plus spaeter optionale Ausnahmen), die
 * Oberflaeche noch nicht.
 */
import { Klappe } from './Klappe';
import { MUSTER, type Einstellungen, type Muster } from '../shared/einstellungen';
import { t, type TextKey } from './i18n';
import { Wuerfel } from './Wuerfel';

interface Props {
  readonly einstellungen: Einstellungen;
  onAendern(teil: Partial<Einstellungen>): void;
}

export function Aussehen({ einstellungen, onAendern }: Props) {
  return (
    <Klappe name="aussehen" klasse="aussehen" titel={t('aussehen.titel')}>

      <label className="aussehen__farbe">
        <span className="feld__label">{t('aussehen.farbe')}</span>
        <input
          type="color"
          value={einstellungen.farbe}
          onChange={(ereignis) => onAendern({ farbe: ereignis.target.value })}
        />
      </label>

      {/* Die Muster als Wuerfel und nicht als Liste von Woertern: „Marmor"
          sagt weniger als ein Marmorwuerfel daneben. */}
      <div className="aussehen__muster">
        {MUSTER.map((muster) => (
          <button
            key={muster}
            type="button"
            className={`musterknopf ${einstellungen.muster === muster ? 'musterknopf--an' : ''}`}
            onClick={() => onAendern({ muster })}
            title={t(`muster.${muster}` as TextKey)}
            aria-pressed={einstellungen.muster === muster}
          >
            <Wuerfel art="d20" augen={20} farbe={einstellungen.farbe} muster={muster as Muster} groesse={40} />
          </button>
        ))}
      </div>

      {/*
        Der Schalter fuer die Koerper steht ueber den Effekten, weil er mehr
        aendert als sie. Fehlt die Grafikbeschleunigung, faellt die
        Darstellung von selbst auf die flache zurueck — der Schalter bleibt
        trotzdem bedienbar, sonst waere nicht zu erkennen, warum nichts
        passiert.
      */}
      <label className="aussehen__schalter">
        <input
          type="checkbox"
          checked={einstellungen.dreiD}
          onChange={(ereignis) => onAendern({ dreiD: ereignis.target.checked })}
        />
        <span>{t('aussehen.dreiD')}</span>
      </label>

      <label className="aussehen__schalter">
        <input
          type="checkbox"
          checked={einstellungen.glitzerAn}
          onChange={(ereignis) => onAendern({ glitzerAn: ereignis.target.checked })}
        />
        <span>{t('effekt.glitzer')}</span>
      </label>

      <label className="aussehen__schalter">
        <input
          type="checkbox"
          checked={einstellungen.streifenAn}
          onChange={(ereignis) => onAendern({ streifenAn: ereignis.target.checked })}
        />
        <span>{t('effekt.streifen')}</span>
      </label>
    </Klappe>
  );
}
