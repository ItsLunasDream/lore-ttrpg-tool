/**
 * Die Texte des Settlement Generators, paarweise `[de, en]`. Die Namen
 * der Werte (Größen, Läden, Lebensstile) stehen in shared/tabellen.ts.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Settlement Generator', 'Settlement Generator'],
  untertitel: [
    'Dörfer, Kleinstädte und Städte mit einem Klick: Gasthaus, Läden mit SRD-Preisen, Personen, Gerüchte.',
    'Villages, towns and cities in one click: inn, shops with SRD prices, people, rumours.'
  ],
  wuerfeln: ['Ort würfeln', 'Roll a settlement'],
  'wuerfeln.neu': ['Neu würfeln', 'Reroll'],
  'wuerfeln.hinweis': ['Festgehaltene Teile (🔒) bleiben.', 'Locked parts (🔒) stay.'],
  'wunsch.groesse': ['Größe', 'Size'],
  'wunsch.lage': ['Lage', 'Location'],
  beliebig: ['beliebig', 'any'],
  'liste.suche': ['Suchen …', 'Search …'],
  'liste.leer': ['Noch keine Orte gespeichert. Oben einen würfeln.', 'No settlements saved yet. Roll one above.'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  zurueck: ['Zurück', 'Back'],
  speichern: ['Speichern', 'Save'],
  gespeichert: ['Gespeichert.', 'Saved.'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['„{name}" löschen?', 'Delete “{name}”?'],
  'verwerfen.sicher': ['Ungespeicherten Ort verwerfen?', 'Discard the unsaved settlement?'],
  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': ['Der Ort ließ sich nicht lesen.', 'The settlement could not be read.'],
  'fehler.name': ['Der Ort braucht einen Namen.', 'The settlement needs a name.'],
  festhalten: ['Festhalten', 'Lock'],
  loesen: ['Lösen', 'Unlock'],
  'neu.teil': ['Nur dieses Teil neu würfeln', 'Reroll only this part'],
  name: ['Name', 'Name'],
  einwohner: ['Einwohner', 'Inhabitants'],
  herrschaft: ['Herrschaft', 'Rule'],
  wirtschaft: ['Wirtschaft', 'Economy'],
  besonderheit: ['Besonderheit', 'Notable'],
  problem: ['Problem', 'Trouble'],
  geruechte: ['Gerüchte (nur SL)', 'Rumours (GM only)'],
  wahr: ['wahr', 'true'],
  falsch: ['falsch', 'false'],
  gasthaus: ['Gasthaus', 'Inn'],
  qualitaet: ['Qualität', 'Quality'],
  spezialitaet: ['Spezialität', 'Speciality'],
  uebernachtung: ['Übernachtung', 'Night’s stay'],
  mahlzeit: ['Mahlzeit', 'Meal'],
  laeden: ['Läden', 'Shops'],
  ware: ['Ware', 'Item'],
  preis: ['Preis', 'Price'],
  personen: ['Personen', 'People'],
  zauberdienste: ['Zauberwirken gegen Bezahlung', 'Spellcasting services'],
  'zauberdienste.grad': ['Grad {grad}', 'Level {grad}'],
  'zauberdienste.trick': ['Zaubertrick', 'Cantrip'],
  notiz: ['Notizen', 'Notes'],
  'quelle.srd': [
    'SRD 5.2.1: Ortsgrößen, Zauberdienste, Gasthauspreise, Preise der Waren und wo es magische Gegenstände zu kaufen gibt (gewöhnliche ab Kleinstadt, ungewöhnliche und seltene nur in Städten).',
    'SRD 5.2.1: settlement sizes, spellcasting services, inn prices, item prices and where magic items can be bought (common from towns, uncommon and rare only in cities).'
  ],
  'quelle.annahme': [
    'Eigene Annahme, nicht SRD: Einwohnerzahlen, welche Läden es ab welcher Größe gibt, wie viele Waren sie zeigen, die Qualität der Gasthäuser.',
    'Own assumption, not SRD: population, which shops exist from which size, how many items they show, inn quality.'
  ],
  'story.kampagne': ['Kampagne', 'Campaign'],
  'story.anlegen': ['In den Story Creator', 'Send to Story Creator'],
  'story.fertig': ['Angelegt: {text}', 'Created: {text}'],
  'story.ersetzen': ['{text} Vorhandene Notizen ersetzen?', '{text} Replace existing notes?'],
  'story.keine': ['Keine Kampagne gefunden. Erst im Story Creator eine anlegen.', 'No campaign found. Create one in the Story Creator first.'],
  loot: ['Läden in den Loot Generator', 'Shops to Loot Generator'],
  'loot.drin': ['Im Loot Generator ✓', 'In Loot Generator ✓'],
  'loot.fertig': ['Die Läden liegen jetzt als Tabellen im Loot Generator.', 'The shops are now tables in the Loot Generator.'],
  'loot.heraus': ['Aus dem Loot Generator genommen.', 'Removed from the Loot Generator.'],
  'loot.fehler': ['Das ging nicht.', 'That did not work.']
} as const;

export type TextKey = keyof typeof TEXTE;

let sprache: Language = DEFAULT_LANGUAGE;

export function setLanguage(neu: Language): void {
  sprache = neu;
}

export function getLanguage(): Language {
  return sprache;
}

export function t(key: TextKey, params?: Record<string, string | number>): string {
  const paar = TEXTE[key];
  let text: string = sprache === 'de' ? paar[0] : paar[1];
  if (params) {
    for (const [name, wert] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(wert));
    }
  }
  return text;
}
