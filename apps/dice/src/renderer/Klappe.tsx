/**
 * Ein Abschnitt der linken Leiste, der sich zuklappen laesst
 * (Rueckmeldung: Wurfart, Aussehen und Teilen nehmen viel Platz).
 *
 * Ob er offen ist, merkt sich dieser Rechner; das ist Bequemlichkeit und
 * keine Einstellung, deshalb im localStorage und nicht in der Datei.
 */
import { useState, type ReactNode } from 'react';

function gemerkt(name: string): boolean {
  try {
    return window.localStorage.getItem(`dice.klappe.${name}`) !== 'zu';
  } catch {
    return true;
  }
}

export function Klappe({ name, titel, klasse, children }: { name: string; titel: string; klasse: string; children: ReactNode }) {
  const [offen, setOffen] = useState(() => gemerkt(name));
  return (
    <section className={`${klasse} klappe${offen ? '' : ' klappe--zu'}`} data-klappe={name}>
      <button
        type="button"
        className="klappe__kopf aussehen__titel"
        aria-expanded={offen}
        onClick={() => {
          const neu = !offen;
          setOffen(neu);
          try {
            window.localStorage.setItem(`dice.klappe.${name}`, neu ? 'auf' : 'zu');
          } catch {
            // Ohne Speicher bleibt es fuer diese Sitzung.
          }
        }}
      >
        <span className="klappe__pfeil" aria-hidden="true">
          ▸
        </span>
        {titel}
      </button>
      {offen ? children : null}
    </section>
  );
}
