/**
 * Die Karten der offenen Datei als Reiter (`model/mappe.ts`).
 *
 * Ein Klick öffnet eine Karte, ein Doppelklick benennt sie um, „+" legt eine
 * leere gleicher Größe an. Entfernen fragt nach: eine Karte ist die Arbeit von
 * Stunden, und das Entfernen ist kein Rückgängig-Schritt.
 */

import { useState } from 'react';
import { useEditor } from '@/model/store';
import { MAX_KARTEN, freierKartenName } from '@/model/mappe';
import { useT } from '@/i18n/useT';

export function KartenLeiste() {
  const { t } = useT();
  const karten = useEditor((s) => s.karten);
  const aktiv = useEditor((s) => s.aktiveKarte);
  const rev = useEditor((s) => s.rev);
  const wechsle = useEditor((s) => s.wechsleKarte);
  const neu = useEditor((s) => s.neueKarte);
  const entferne = useEditor((s) => s.entferneKarte);
  const benenne = useEditor((s) => s.benenneKarte);
  const [umbenennen, setUmbenennen] = useState<{ stelle: number; name: string } | null>(null);
  void rev;

  const fertig = () => {
    if (umbenennen) benenne(umbenennen.stelle, umbenennen.name.trim());
    setUmbenennen(null);
  };

  return (
    <nav className="karten-leiste" aria-label={t('karten.leiste')} data-karten-leiste>
      {karten.map((k, i) =>
        umbenennen?.stelle === i ? (
          <input
            key={k.meta.id ?? i}
            className="karten-reiter__name"
            type="text"
            autoFocus
            value={umbenennen.name}
            aria-label={t('karten.umbenennen')}
            data-karte-name={i}
            onChange={(e) => setUmbenennen({ stelle: i, name: e.target.value })}
            onBlur={fertig}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fertig();
              if (e.key === 'Escape') setUmbenennen(null);
              e.stopPropagation();
            }}
          />
        ) : (
          <span key={k.meta.id ?? i} className={`karten-reiter${i === aktiv ? ' is-aktiv' : ''}`}>
            <button
              type="button"
              className="ghost karten-reiter__knopf"
              aria-pressed={i === aktiv}
              title={t('karten.hinweis')}
              data-karte={i}
              onClick={() => wechsle(i)}
              onDoubleClick={() => setUmbenennen({ stelle: i, name: k.meta.name })}
            >
              {k.meta.name}
            </button>
            {karten.length > 1 ? (
              <button
                type="button"
                className="ghost icon karten-reiter__weg"
                aria-label={t('karten.entfernen', { name: k.meta.name })}
                title={t('karten.entfernen', { name: k.meta.name })}
                data-karte-weg={i}
                onClick={() => {
                  if (window.confirm(t('karten.entfernenFrage', { name: k.meta.name }))) entferne(i);
                }}
              >
                ✕
              </button>
            ) : null}
          </span>
        ),
      )}
      <button
        type="button"
        className="ghost karten-neu"
        disabled={karten.length >= MAX_KARTEN}
        title={t('karten.neuHinweis')}
        data-karte-neu
        onClick={() => neu(freierKartenName(karten, t('karten.stamm')))}
      >
        + {t('karten.neu')}
      </button>
    </nav>
  );
}
