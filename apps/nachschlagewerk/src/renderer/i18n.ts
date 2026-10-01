/**
 * Die Texte des Nachschlagewerks — die der Oberflaeche, nicht die Regeln.
 *
 * Paarweise `[de, en]` wie in den anderen Werkzeugen. Der Regeltext selbst
 * steht NICHT hier, sondern in `@suite/srd`: er ist woertlich uebernommen
 * und keine Oberflaechenbeschriftung, die man umformulieren duerfte.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Nachschlagewerk', 'Reference'],
  untertitel: [
    'Regelglossar, Ausrüstung, Zauber, magische Gegenstände und Tiergestalten des SRD 5.2.1, offline, auf Deutsch und Englisch.',
    'The rules glossary, equipment, spells, magic items and beast forms of the SRD 5.2.1, offline, in English and German.'
  ],
  suche: ['Suchen', 'Search'],
  'suche.platzhalter': ['Begriff oder Stelle im Text …', 'A term or a phrase in the text …'],
  'suche.anzahl': ['{anzahl} Treffer', '{anzahl} results'],
  'suche.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'leer.titel': ['Wähle links einen Eintrag.', 'Pick an entry on the left.'],
  'leer.satz': [
    'Oder such nach einem Begriff: „liegend", „prone" oder eine Stelle im Text wie „critical hit".',
    'Or search for a term such as “prone”, or a phrase from the text such as “critical hit”.'
  ],
  daneben: ['Andere Sprache daneben', 'Other language alongside'],
  'daneben.aus': ['Nur eine Sprache', 'One language only'],
  massgeblich: [
    'Bei einer Abweichung gilt die englische Fassung.',
    'Where the two differ, the English version applies.'
  ],
  quelle: ['Quelle', 'Source'],
  verweise: ['Siehe auch', 'See also'],
  'vorschau.oeffnen': ['Eintrag öffnen', 'Open entry'],
  'haus.neu': ['Hausregel', 'House rule'],
  'haus.dazu': ['Hausregel dazu', 'Add house rule'],
  'haus.amTisch': ['An diesem Tisch gilt:', 'At this table:'],
  'haus.aendert': ['Ändert:', 'Changes:'],
  'haus.bearbeiten': ['Bearbeiten', 'Edit'],
  'haus.loeschen': ['Löschen', 'Delete'],
  'haus.loeschenSicher': ['Hausregel „{name}" löschen?', 'Delete house rule “{name}”?'],
  'haus.name': ['Name', 'Name'],
  'haus.bezug': ['Ändert die offizielle Regel', 'Changes the official rule'],
  'haus.keinBezug': ['— keine, kommt dazu —', '— none, it is new —'],
  'haus.text': ['Text', 'Text'],
  'haus.textHinweis': [
    'Markdown. [[Liegend]] verweist auf einen Eintrag.',
    'Markdown. [[Prone]] links to an entry.'
  ],
  'haus.speichern': ['Speichern', 'Save'],
  'haus.abbrechen': ['Abbrechen', 'Cancel'],
  'haus.nameFehlt': ['Die Hausregel braucht einen Namen.', 'The house rule needs a name.'],
  'haus.fehler': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'notiz.neu': ['Notiz', 'Note'],
  'notiz.titel': ['Notiz', 'Note'],
  'notiz.titelMehr': ['Deine Notizen', 'Your notes'],
  'notiz.platzhalter': ['Was willst du dir hier merken?', 'What do you want to remember here?'],
  'notiz.weg': ['Stelle nicht mehr gefunden', 'Passage no longer found'],
  'notiz.fehler': ['Die Notizen ließen sich nicht speichern.', 'The notes could not be saved.'],
  'ansicht.regeln': ['Regeln', 'Rules'],
  'ansicht.gestalten': ['Gestalten', 'Beast forms'],
  'gestalt.fuer': ['Für {name}', 'For {name}'],
  'gestalt.vorgabe': ['Wofür', 'For'],
  'gestalt.stufe': ['Druidenstufe', 'Druid level'],
  'gestalt.zielHg': ['HG oder Stufe des Ziels', 'CR or level of the target'],
  'gestalt.maxHg': ['Höchster HG', 'Maximum CR'],
  'gestalt.flugErlaubt': ['Fliegen erlaubt', 'Fly Speed allowed'],
  'gestalt.ja': ['ja', 'yes'],
  'gestalt.nein': ['nein', 'no'],
  'gestalt.regelStufe': [
    'Bekannte Gestalten: {bekannt} · höchster HG {hg} · Fliegen: {flug} · {nutzungen} Nutzungen · beim Verwandeln {temp} temporäre TP · bis {stunden} Std.',
    'Known forms: {bekannt} · max CR {hg} · Fly Speed: {flug} · {nutzungen} uses · {temp} temporary HP on shifting · up to {stunden} h'
  ],
  'gestalt.abStufe2': ['Tiergestalt gibt es ab Druidenstufe 2.', 'Wild Shape starts at Druid level 2.'],
  'gestalt.regelEigene': [
    'Eigene Grenze, etwa für eine Unterklasse aus einem anderen Buch. Trag die Werte von dort ein.',
    'A custom limit, for example for a subclass from another book. Enter the values from there.'
  ],
  'gestalt.regelVertrauter': ['Ein Tier mit HG 0.', 'A Beast with a Challenge Rating of 0.'],
  'gestalt.regelVerwandlung': [
    'Ein Tier mit einem HG bis zum HG des Ziels (oder seiner Stufe).',
    'A Beast with a Challenge Rating up to the target’s (or its level).'
  ],
  'gestalt.regelTiergestalten': ['Höchstens groß, HG bis 4.', 'Large or smaller, Challenge Rating 4 or lower.'],
  'gestalt.bewegung': ['Bewegung', 'Movement'],
  'gestalt.sinne': ['Sinne', 'Senses'],
  'gestalt.groesse': ['Größe', 'Size'],
  'gestalt.maxGroesse': ['Größe', 'Size'],
  'gestalt.jede': ['jede', 'any'],
  'gestalt.sortierung': ['Sortieren', 'Sort'],
  'gestalt.nachHg': ['nach HG', 'by CR'],
  'gestalt.nachName': ['nach Name', 'by name'],
  'gestalt.nachTp': ['nach TP', 'by HP'],
  'gestalt.nachRk': ['nach RK', 'by AC'],
  'gestalt.schwaerme': ['Schwärme zeigen', 'Show swarms'],
  'gestalt.schwarm': ['Schwarm', 'Swarm'],
  'gestalt.suche': ['Tier suchen …', 'Find a beast …'],
  'gestalt.anzahl': ['{anzahl} Gestalten', '{anzahl} forms'],
  'gestalt.bekanntZahl': ['{n} von {max} bekannt', '{n} of {max} known'],
  'gestalt.bekannt': ['Bekannte Gestalt der Figur', 'Known form of the character'],
  'gestalt.hg': ['HG', 'CR'],
  'gestalt.rk': ['RK', 'AC'],
  'gestalt.tp': ['TP', 'HP'],
  'gestalt.vergleichen': ['Vergleichen', 'Compare'],
  'gestalt.vergleich': ['Vergleich', 'Comparison'],
  'gestalt.ausVergleich': ['Aus dem Vergleich nehmen', 'Remove from comparison'],
  'gestalt.angriffe': ['Aktionen', 'Actions'],
  'gestalt.tier': ['Tier', 'Beast'],
  'gestalt.leerTitel': ['Wähle links eine Gestalt.', 'Pick a form on the left.'],
  'gestalt.leerSatz': [
    'Haken rechts in der Liste setzen, um bis zu drei Gestalten zu vergleichen.',
    'Tick the boxes on the right of the list to compare up to three forms.'
  ],
  'haus.insLeere': ['Diesen Eintrag gibt es nicht.', 'This entry does not exist.']
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
