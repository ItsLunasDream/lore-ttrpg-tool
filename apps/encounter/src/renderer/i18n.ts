/**
 * Die Texte des Encounter Creators.
 *
 * Paarweise `[de, en]` wie in den anderen Werkzeugen: zwei getrennte
 * Woerterbuecher laufen auseinander.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Begegnungen', 'Encounters'],
  untertitel: [
    'Begegnungen zusammenstellen und in den Tracker schieben.',
    'Build encounters and send them to the tracker.'
  ],

  'liste.leer': ['Noch keine Begegnung.', 'No encounters yet.'],
  'liste.anzahl': ['{anzahl} {{Begegnung|Begegnungen}}', '{anzahl} {{encounter|encounters}}'],
  'liste.eine': ['1 Begegnung', '1 encounter'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'liste.suche': ['Suchen', 'Search'],
  'liste.sortieren': ['Sortieren', 'Sort'],
  'liste.nachDatum': ['Zuletzt geändert', 'Last changed'],
  'liste.nachName': ['Nach Name', 'By name'],
  'liste.nachGegnern': ['Nach Gegnerzahl', 'By creature count'],

  neu: ['Neue Begegnung', 'New encounter'],
  abbrechen: ['Abbrechen', 'Cancel'],
  speichern: ['Speichern', 'Save'],
  gespeichert: ['Gespeichert.', 'Saved.'],
  speichernNeu: ['Als neu speichern', 'Save as new'],
  gespeichertNeu: ['Als neue Begegnung gespeichert; die alte bleibt.', 'Saved as a new encounter; the old one stays.'],
  loeschen: ['Löschen', 'Delete'],
  'verwerfen.sicher': ['Ungespeicherte Änderungen verwerfen?', 'Discard unsaved changes?'],
  'loeschen.sicher': [
    '„{name}" wirklich löschen? Das lässt sich nicht rückgängig machen.',
    'Really delete “{name}”? This cannot be undone.'
  ],
  zurueck: ['Zurück zur Liste', 'Back to the list'],

  'feld.name': ['Name', 'Name'],
  'feld.notiz': ['Notiz', 'Note'],

  'gegner.keine': ['Noch keine Gegner.', 'No creatures yet.'],
  'gegner.zahl': ['{anzahl} Wesen', '{anzahl} {{creature|creatures}}'],
  'gegner.titel': ['Gegner', 'Creatures'],
  'gegner.weg': ['Entfernen', 'Remove'],
  'gegner.fehlt': [
    'Dieses Monster gibt es nicht mehr.',
    'This monster no longer exists.'
  ],
  'gegner.fehltKurz': ['fehlt', 'missing'],

  'monster.titel': ['Monster', 'Monsters'],
  'monster.suche': ['Monster suchen', 'Search monsters'],
  'monster.nichts': ['Kein Monster passt dazu.', 'No monster matches that.'],
  'monster.dazu': ['Dazu', 'Add'],

  'katalog.quelle': ['Quelle', 'Source'],
  'katalog.quelle.alle': ['Alle', 'All'],
  'katalog.quelle.srd': ['Offiziell', 'Official'],
  'katalog.quelle.eigen': ['Eigene', 'Homebrew'],
  'katalog.typ': ['Typ', 'Type'],
  'katalog.alleTypen': ['Alle Typen', 'All types'],
  'katalog.hgVon': ['HG ab', 'CR from'],
  'katalog.hgBis': ['HG bis', 'CR to'],
  'katalog.legendaer': ['Legendär', 'Legendary'],
  'katalog.anzahl': ['{anzahl} Monster', '{anzahl} {{monster|monsters}}'],
  'katalog.name': ['Name', 'Name'],
  'katalog.hg': ['HG', 'CR'],
  'katalog.tp': ['TP', 'HP'],
  'katalog.rk': ['RK', 'AC'],
  'katalog.mehr': ['{anzahl} weitere zeigen', 'Show {anzahl} more'],
  'katalog.eigen': ['eigen', 'homebrew'],

  'bau.titel': ['Zusammenstellen lassen', 'Build automatically'],
  'bau.ziel': ['Ziel', 'Target'],
  'bau.hg': ['HG', 'CR'],
  'bau.schwierigkeit': ['Schwierigkeit', 'Difficulty'],
  'bau.ohneGruppe': ['Erst unten die Gruppe eintragen.', 'Enter the party below first.'],
  'bau.ep': ['EP', 'XP'],
  'bau.anzahl': ['Gegner', 'Opponents'],
  'bau.beliebig': ['egal', 'any'],
  'bau.quelle.srd': ['Offiziell', 'Official'],
  'bau.quelle.eigen': ['Eigene', 'Homebrew'],
  'bau.quelle.gemischt': ['Gemischt', 'Mixed'],
  'bau.behalten': ['Vorhandene Gegner behalten', 'Keep current opponents'],
  'bau.los': ['Zusammenstellen', 'Build'],
  'bau.hinweis': [
    'Ein HG als Ziel heißt: so viele EP wie ein Monster dieses Grades. Gegner, die schon in der Begegnung stehen, bleiben drin, wenn der Haken gesetzt ist.',
    'A CR target means as much XP as one monster of that CR. Opponents already in the encounter stay if the box is checked.'
  ],
  'bau.ergebnis': [
    'Ziel {ziel} EP (HG {zielGrad}), erreicht {ep} EP (etwa HG {grad}).',
    'Target {ziel} XP (CR {zielGrad}), reached {ep} XP (about CR {grad}).'
  ],
  'bau.abweichung': ['Weicht um {prozent} % ab.', 'Off by {prozent}%.'],
  'bau.nichts': [
    'Keine passenden Monster gefunden. Quelle oder Typ weiter fassen.',
    'No matching monsters. Try a wider source or type.'
  ],

  'umgebung.titel': ['Umgebung', 'Environment'],
  'umgebung.keine': ['Keine', 'None'],
  'umgebung.wuerfeln': ['Würfeln', 'Roll'],
  'umgebung.anblick': ['Was man sieht', 'What you see'],
  'umgebung.regeln': ['Was wirkt', 'What applies'],
  'umgebung.sicht': ['Sicht', 'Sight'],
  'umgebung.bewegung': ['Bewegung', 'Movement'],
  'umgebung.sg': ['SG', 'DC'],
  'umgebung.schaden': ['Schaden', 'Damage'],

  'verhaeltnis.grade': ['Grade zusammen {summe}', 'Challenge ratings {summe} in total'],
  'verhaeltnis.gegen': ['gegen', 'against'],
  'verhaeltnis.gruppe': [
    '{figuren} Figuren auf Stufe {stufe}',
    '{figuren} characters at level {stufe}'
  ],
  'verhaeltnis.gruppeSpanne': [
    '{figuren} Figuren auf Stufe {von} bis {bis}',
    '{figuren} characters at levels {von} to {bis}'
  ],
  'verhaeltnis.keineGruppe': [
    'keine Gruppe eingetragen',
    'no party set'
  ],
  'verhaeltnis.ohneGrad': [
    '{anzahl} Gegner ohne lesbaren Grad {{ist|sind}} nicht mitgezählt.',
    '{anzahl} {{opponent|opponents}} without a readable rating {{is|are}} not counted.'
  ],
  'verhaeltnis.punkte': [
    '{punkte} EP · Budgets: niedrig {niedrig}, mittel {mittel}, hoch {hoch} EP',
    '{punkte} XP · budgets: low {niedrig}, moderate {mittel}, high {hoch} XP'
  ],
  'verhaeltnis.keineGrade': [
    'Keine Einordnung: kein Gegner hat einen bekannten Grad.',
    'No rating: no opponent has a known challenge rating.'
  ],
  'verhaeltnis.gruppeFehlt': [
    'Für eine Einordnung fehlt die Gruppe.',
    'A rating needs the party.'
  ],

  'gruppe.titel': ['Gruppe am Tisch', 'Party'],
  'gruppe.leer': ['Noch keine Gruppe eingetragen.', 'No party set yet.'],
  'gruppe.figuren': ['Figuren', 'characters'],
  'gruppe.stufe': ['Stufe', 'level'],
  'gruppe.dazu': ['Zeile', 'Row'],
  'gruppe.weg': ['Zeile entfernen', 'Remove row'],
  'gruppe.kurz': ['{anzahl} × Stufe {stufe}', '{anzahl} × level {stufe}'],

  'tracker.knopf': ['In den Tracker', 'To the tracker'],
  'tracker.unterwegs': [
    'Die Begegnung ist in der Initiative.',
    'The encounter is in Initiative.'
  ],
  'tracker.ging-nicht': [
    'Die Initiative ließ sich nicht öffnen.',
    'Initiative could not be opened.'
  ],

  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': [
    'Diese Begegnung ließ sich nicht öffnen.',
    'This encounter could not be opened.'
  ]
} as const;

export type TextKey = keyof typeof TEXTE;

let sprache: Language = DEFAULT_LANGUAGE;

export function setLanguage(neu: Language): void {
  sprache = neu;
}

export function getLanguage(): Language {
  return sprache;
}

/**
 * `{{Einzahl|Mehrzahl}}` im Text waehlt nach der ersten Zahl in den
 * Parametern (`anzahl` oder `n` zuerst): aus „1 creatures" wird so „1 creature".
 */
function mitMehrzahl(text: string, params: Record<string, string | number>): string {
  if (!text.includes('{{')) return text;
  const zahl = params.anzahl ?? params.n ?? Object.values(params).find((wert) => typeof wert === 'number');
  return text.replace(/\{\{([^|}]*)\|([^}]*)\}\}/g, (_, eins: string, mehr: string) => (Number(zahl) === 1 ? eins : mehr));
}

export function t(key: TextKey, params?: Record<string, string | number>): string {
  const paar = TEXTE[key];
  let text: string = sprache === 'de' ? paar[0] : paar[1];
  if (params) {
    for (const [name, wert] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(wert));
    }
    text = mitMehrzahl(text, params);
  }
  return text;
}
