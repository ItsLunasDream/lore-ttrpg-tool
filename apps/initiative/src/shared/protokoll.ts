/**
 * Was der Tracker an das Sitzungsprotokoll der Hülle meldet
 * (docs/sitzungsprotokoll.md): Kampfbeginn, neue Runde, wer ausfällt,
 * Kampfende. Aus dem Vergleich vorher/nachher, weil jede Änderung am Kampf
 * durch dieselbe Stelle läuft.
 */
import type { Kampf } from './types';

export interface KampfMeldung {
  readonly art: 'kampf-beginn' | 'runde' | 'raus' | 'kampf-ende';
  readonly text: string;
}

function ausgefallen(k: Kampf): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of k.teilnehmer) {
    for (const x of t.koerper) {
      if (x.raus || (x.hpMax > 0 && x.hp <= 0)) m.set(x.id, `${t.name} ${x.marke}`.trim());
    }
  }
  return m;
}

export function kampfEreignisse(vorher: Kampf, neu: Kampf, sprache: 'de' | 'en'): KampfMeldung[] {
  const de = sprache === 'de';
  const name = neu.name.trim() || (de ? 'Kampf' : 'Combat');
  const heraus: KampfMeldung[] = [];
  if (!vorher.laeuft && neu.laeuft) {
    const wer = neu.teilnehmer.map((t) => t.name).filter(Boolean);
    heraus.push({ art: 'kampf-beginn', text: `${de ? 'Kampf beginnt' : 'Combat starts'}: ${name}${wer.length ? ` (${wer.join(', ')})` : ''}` });
    return heraus;
  }
  if (vorher.laeuft && !neu.laeuft) {
    heraus.push({ art: 'kampf-ende', text: `${de ? 'Kampf endet' : 'Combat ends'}: ${name} (${de ? 'Runde' : 'round'} ${vorher.runde})` });
    return heraus;
  }
  if (!neu.laeuft) return heraus;
  // Rückgängig senkt die Runde; das ist kein Ereignis.
  if (neu.runde > vorher.runde) heraus.push({ art: 'runde', text: `${de ? 'Runde' : 'Round'} ${neu.runde}` });
  const alt = ausgefallen(vorher);
  for (const [id, n] of ausgefallen(neu)) {
    if (!alt.has(id)) heraus.push({ art: 'raus', text: `${n} ${de ? 'fällt aus' : 'is down'}` });
  }
  return heraus;
}
