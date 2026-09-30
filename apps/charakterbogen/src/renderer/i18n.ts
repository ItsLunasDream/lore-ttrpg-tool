/**
 * Die Texte des Charakterbogens, paarweise `[de, en]` wie in den anderen
 * Werkzeugen. Namen von Attributen und Fertigkeiten stehen in
 * `shared/regeln.ts`, weil auch die Ablage sie braucht.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Charakterbogen', 'Character Sheet'],
  untertitel: [
    'Ein kleiner Bogen für D&D 5.5e (2024). Rechnet Modifikatoren und Boni, den Rest trägst du ein.',
    'A small sheet for D&D 5.5e (2024). It works out modifiers and bonuses; you fill in the rest.'
  ],
  'liste.leer': ['Noch keine Bögen.', 'No sheets yet.'],
  'liste.suche': ['Suchen', 'Search'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  neu: ['Neuer Bogen', 'New sheet'],
  'neu.name': ['Neue Figur', 'New character'],
  einlesen: ['Einlesen', 'Import'],
  'einlesen.fertig': ['Eingelesen: {namen}', 'Imported: {namen}'],
  weitergeben: ['Weitergeben', 'Share'],
  'weitergeben.fertig': ['Gespeichert unter {pfad}', 'Saved to {pfad}'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['„{name}" wirklich löschen?', 'Really delete “{name}”?'],
  zurueck: ['Zurück zur Liste', 'Back to the list'],
  'speichern.laeuft': ['Speichert …', 'Saving …'],
  'speichern.fertig': ['Gespeichert', 'Saved'],
  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': ['Dieser Bogen ließ sich nicht öffnen.', 'This sheet could not be opened.'],

  name: ['Name', 'Name'],
  spieler: ['Spieler:in', 'Player'],
  spezies: ['Spezies', 'Species'],
  hintergrund: ['Hintergrund', 'Background'],
  klasse: ['Klasse', 'Class'],
  stufe: ['Stufe', 'Level'],
  'klasse.dazu': ['+ Klasse', '+ Class'],
  'klasse.weg': ['Klasse entfernen', 'Remove class'],
  gesamtstufe: ['Gesamtstufe {stufe} · Übungsbonus {pb}', 'Total level {stufe} · Proficiency bonus {pb}'],

  attribute: ['Attribute', 'Abilities'],
  rettung: ['Rettungswürfe', 'Saving throws'],
  'rettung.uebung': ['Übung im Rettungswurf', 'Proficient in this save'],
  'rettung.einer': ['Rettungswurf', 'Save'],
  fertigkeiten: ['Fertigkeiten', 'Skills'],
  'fertigkeit.stufe': [
    'Klicken: keine Übung → Übung → Expertise',
    'Click: none → proficient → expertise'
  ],
  passiv: ['Passive Wahrnehmung', 'Passive Perception'],

  kampf: ['Kampf', 'Combat'],
  rk: ['RK', 'AC'],
  initiative: ['Initiative', 'Initiative'],
  'initiative.auto': ['Leer lassen: aus GES', 'Leave empty: from DEX'],
  bewegung: ['Bewegung', 'Speed'],
  'bewegung.platzhalter': ['z. B. 9 m', 'e.g. 30 ft.'],
  tp: ['Trefferpunkte', 'Hit Points'],
  'tp.aktuell': ['Aktuell', 'Current'],
  'tp.max': ['Maximum', 'Maximum'],
  'tp.temp': ['Temporär', 'Temporary'],
  'tp.feld': ['Schaden / Heilung', 'Damage / Healing'],
  'tp.feldHinweis': [
    '7 oder -7 ist Schaden, +7 heilt. Würfel gehen: 2w6+3. Enter übernimmt.',
    '7 or -7 is damage, +7 heals. Dice work: 2d6+3. Enter applies.'
  ],
  'tp.unlesbar': ['Das lässt sich nicht lesen.', 'That cannot be read.'],
  'tp.schaden': ['{n} Schaden', '{n} damage'],
  'tp.heilung': ['{n} geheilt', '{n} healed'],
  trefferwuerfel: ['Trefferwürfel', 'Hit Point Dice'],
  'tw.uebrig': ['übrig', 'left'],
  'tw.dazu': ['+ Würfelart', '+ Die type'],
  todesrettung: ['Todesrettungswürfe', 'Death Saving Throws'],
  'todesrettung.erfolge': ['Erfolge', 'Successes'],
  'todesrettung.fehlschlaege': ['Fehlschläge', 'Failures'],

  zustaende: ['Zustände', 'Conditions'],
  'zustand.dazu': ['+ Zustand', '+ Condition'],
  'zustand.weg': ['Zustand „{name}" entfernen', 'Remove condition “{name}”'],
  erschoepfung: ['Erschöpfung', 'Exhaustion'],
  'erschoepfung.hinweis': [
    'Jede Stufe: −2 auf W20-Prüfungen, Bewegung −1,5 m. Bei 6 stirbt die Figur.',
    'Each level: −2 to D20 Tests, Speed −5 ft. At 6 the character dies.'
  ],
  inspiration: ['Heldische Inspiration', 'Heroic Inspiration'],

  angriffe: ['Angriffe', 'Attacks'],
  'angriff.name': ['Name', 'Name'],
  'angriff.bonus': ['Bonus', 'Bonus'],
  'angriff.schaden': ['Schaden', 'Damage'],
  'angriff.notiz': ['Notiz', 'Note'],
  'angriff.dazu': ['+ Angriff', '+ Attack'],
  'angriff.weg': ['Angriff entfernen', 'Remove attack'],

  rasten: ['Rasten', 'Rests'],
  'rast.kurz': ['Kurze Rast', 'Short Rest'],
  'rast.lang': ['Lange Rast', 'Long Rest'],
  'rast.langHinweis': [
    'Alle TP und alle Trefferwürfel zurück, eine Erschöpfungsstufe weniger. Braucht mindestens 1 TP.',
    'All HP and all Hit Point Dice back, one Exhaustion level less. Needs at least 1 HP.'
  ],
  'rast.langOhneTp': ['Mit 0 TP kann keine Rast beginnen.', 'A rest cannot start at 0 HP.'],
  'rast.langFertig': ['Lange Rast: {tp} TP, Trefferwürfel voll.', 'Long Rest: {tp} HP, Hit Point Dice refilled.'],
  'rast.kurzHinweis': [
    'Wie viele Trefferwürfel ausgeben? Je Würfel: Wurf + KON-Modifikator, mindestens 1.',
    'How many Hit Point Dice to spend? Per die: roll + CON modifier, at least 1.'
  ],
  'rast.wuerfeln': ['Würfeln und heilen', 'Roll and heal'],
  'rast.kurzFertig': ['Kurze Rast: {wuerfe} → {summe} TP geheilt.', 'Short Rest: {wuerfe} → {summe} HP healed.'],
  abbrechen: ['Abbrechen', 'Cancel'],

  notizen: ['Notizen', 'Notes'],
  'notizen.platzhalter': ['Merkmale, Talente, Sprachen, Werkzeuge …', 'Features, feats, languages, tools …'],
  gruppe: ['Gruppeninventar', 'Party inventory']
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
