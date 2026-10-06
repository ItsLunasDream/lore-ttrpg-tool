/**
 * Die Texte des Status Effect Creators.
 *
 * Paarweise `[de, en]` wie in den anderen Werkzeugen: zwei getrennte
 * Woerterbuecher laufen auseinander.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  'titel': ['Status Effect Creator', 'Status Effect Creator'],
  'untertitel': [
    'Eigene Zustände mit Stufen — und jeder wird gewogen.',
    'Custom conditions with levels — and every one gets weighed.'
  ],
  'hinweis.regeln': [
    'Die Vorlagen orientieren sich an 5E. Was „Nachteil" an deinem Tisch bedeutet, entscheidet dein Tisch — das Werkzeug kennt nur Stufen, Dauern und Auslöser.',
    'The tables lean on 5E. What “disadvantage” means at your table is your table’s call — the tool only knows levels, durations and triggers.'
  ],

  'reiter.bauen': ['Bauen', 'Build'],
  'reiter.sammlung': ['Sammlung', 'Collection'],
  'reiter.paket': ['Paket', 'Package'],

  'paket.satz': [
    'Mehrere Zustände in einem Wurf, mit demselben Thema und abgestimmten Wirkungen — für einen ganzen Abschnitt der Kampagne.',
    'Several conditions in one roll, sharing a theme with coordinated effects — for a whole stretch of the campaign.'
  ],
  'paket.anzahl': ['Wie viele', 'How many'],
  'paket.wuerfeln': ['Paket würfeln', 'Roll a package'],
  'paket.leer': [
    'Noch kein Paket. Thema und Härte einstellen, dann würfeln.',
    'No package yet. Set theme and severity, then roll.'
  ],
  'paket.abgestimmt': [
    'Abgestimmt: keine Wirkung kommt zweimal vor.',
    'Coordinated: no effect appears twice.'
  ],
  'paket.ueberschneidung': [
    '{anzahl} Wirkungen kommen mehrfach vor — der Vorrat an passenden war erschöpft.',
    '{anzahl} effects appear more than once — the pool of fitting ones ran out.'
  ],
  'paket.alleSpeichern': ['Alle in die Sammlung', 'All to the collection'],
  'paket.alleKarten': ['Alle Karten drucken', 'Print all cards'],
  'paket.oeffnen': ['Einzeln öffnen', 'Open on its own'],
  'paket.gespeichert': ['{anzahl} Zustände liegen in der Sammlung.', '{anzahl} conditions are in the collection.'],
  'paket.zustaende': ['{anzahl} Zustände', '{anzahl} conditions'],

  'karte.gespeichert': ['Die Karte liegt als PDF: {pfad}', 'The card is saved as a PDF: {pfad}'],
  'karte.abgebrochen': ['Abgebrochen.', 'Cancelled.'],
  'karte.vorschau': ['Karte ansehen', 'View card'],
  'karte.schliessen': ['Schließen', 'Close'],
  'karte.drucken': ['Als PDF speichern', 'Save as PDF'],

  'feld.art': ['Art', 'Kind'],
  'feld.thema': ['Thema', 'Theme'],
  'feld.haerte': ['Härte', 'Severity'],
  'feld.wirkrichtung': ['Wirkrichtung', 'Direction'],
  'feld.stufen': ['Stufen', 'Levels'],
  'feld.beliebig': ['beliebig', 'any'],
  'feld.ohneStufen': ['keine Stufen', 'no levels'],
  'feld.kiWunsch': ['Wunsch an die KI', 'What to tell the AI'],
  'feld.kiWunschBeispiel': [
    'z. B. eine Zeitkrankheit, die Erinnerungen frisst',
    'e.g. a time sickness that eats memories'
  ],
  'feld.kiWunschHinweis': [
    'Gilt nur für die KI. Die Tabellen können alles auch ohne sie.',
    'Applies to the AI only. The tables do all of this without one.'
  ],

  'richtung.schaden': ['Schaden', 'Damage'],
  'richtung.debuff': ['Debuff', 'Debuff'],
  'richtung.buff': ['Buff', 'Buff'],
  'richtung.gemischt': ['gemischt', 'Mixed'],

  'knopf.wuerfeln': ['Würfeln', 'Roll'],
  'knopf.ki': ['Von der KI', 'From the AI'],
  'knopf.kiLaeuft': ['Fragt …', 'Asking …'],
  'knopf.ausformulieren': ['Ausformulieren lassen', 'Have it written out'],
  'knopf.alsNeu': ['Als neu speichern', 'Save as new'],
  'knopf.speichern': ['In die Sammlung', 'To the collection'],
  'knopf.export': ['In den Story Creator', 'To the Story Creator'],
  // Der Name des Programms, nicht uebersetzt — er heisst ueberall so.
  'knopf.foundry': ['Für Foundry (JSON)', 'For Foundry (JSON)'],
  'knopf.karte': ['Karte zum Vorlesen', 'Card to read aloud'],
  'knopf.neuerName': ['Neuer Name', 'New name'],
  'knopf.neuerSatz': ['Neuer Kurzsatz', 'New one-liner'],
  'knopf.neueStufen': ['Stufen neu', 'Reroll levels'],
  'knopf.neuesZeichen': ['Anderes Zeichen', 'Other symbol'],
  'knopf.loeschen': ['Löschen', 'Delete'],
  'knopf.zurueck': ['Zurück', 'Back'],

  'blatt.stufen': ['Stufen', 'Levels'],
  'blatt.wirkung': ['Wirkung', 'Effect'],
  'blatt.dauer': ['Dauer', 'Duration'],
  'blatt.schlimmer': ['Schlimmer', 'Worse'],
  'blatt.besser': ['Besser', 'Better'],
  'blatt.frist': ['Frist', 'Interval'],
  'blatt.staerker': ['Stärker', 'Grows'],
  'blatt.schwaecher': ['Schwächer', 'Fades'],
  'blatt.ausgeloest': ['Ausgelöst', 'Triggered'],

  'gewicht.titel': ['Gewicht', 'Weight'],
  'gewicht.wert': ['{wert}', '{wert}'],
  'gewicht.vergleich': [
    'etwa so viel wie {name}',
    'about as much as {name}'
  ],
  'gewicht.keinVergleich': [
    'kein Vergleich — die Eichung kennt nur Zustände, die nehmen',
    'no comparison — the calibration only knows conditions that take'
  ],
  'gewicht.geschaetzt': [
    'geschätzt — der Text kommt von der KI und hat keine Punktwerte',
    'estimated — the text comes from the AI and carries no point values'
  ],
  'gewicht.einschraenkung': [
    'Das Gewicht sagt, wie schwer der Zustand wiegt, solange er anliegt. Ob er für deine Runde zu hart ist, hängt daran, wie oft man ihn bekommt — und das weiß nur dein Tisch.',
    'The weight says how much the condition weighs while it lasts. Whether it is too harsh for your table depends on how often you get it — and only your table knows that.'
  ],
  'gewicht.spanne': ['Für „{haerte}" erwartet: {von}–{bis}', 'Expected for “{haerte}”: {von}–{bis}'],

  'urteil.passt': ['Passt zur Härte', 'Matches the severity'],
  'urteil.zuSchwer': ['Schwerer als eingestellt', 'Heavier than set'],
  'urteil.zuLeicht': ['Leichter als eingestellt', 'Lighter than set'],
  'urteil.kaputt': ['Da stimmt etwas nicht', 'Something is off'],

  'hinweis.flach': [
    'Stufe {stufen} bringt nichts dazu — eine Stufe, die man nicht merkt, ist eine zu viel.',
    'Level {stufen} adds nothing — a level you do not notice is one too many.'
  ],
  'hinweis.doppelt': [
    'Dieselbe Wirkung kommt mehrfach vor.',
    'The same effect appears more than once.'
  ],
  'stimmig.titel': ['Das passt nicht zusammen:', 'These do not go together:'],
  'stimmig.linderungZuLangsam': [
    'Die Linderung braucht länger, als der Zustand anhält — er ist vorbei, bevor sie wirkt.',
    'The relief takes longer than the condition lasts — it is over before the relief works.'
  ],
  'stimmig.verschlimmerungZuLangsam': [
    'Die Verschlimmerung käme nie zum Zug: sie braucht länger als die Dauer.',
    'The worsening would never happen: it takes longer than the duration.'
  ],
  'stimmig.stufenOhneZeit': [
    'Mehrere Stufen, aber der Zustand ist vorbei, bevor die zweite kommt.',
    'Several levels, but the condition ends before the second one arrives.'
  ],
  'stimmig.ausloeserOhneUmgebung': [
    'Ein Ort als Auslöser, obwohl der Zustand nicht von der Umgebung kommt.',
    'A place as the trigger, though the condition does not come from the environment.'
  ],

  'hinweis.sprung': [
    'Von Stufe {stufen} an verdoppelt sich das Gewicht. Gewollt?',
    'From level {stufen} on the weight doubles. Intended?'
  ],

  'ki.aus': [
    'Keine KI eingerichtet. Die Tabellen können alles ohne sie.',
    'No AI set up. The tables do all of this without one.'
  ],
  'ki.zurueckgewiesen': [
    'Die Antwort der KI war unbrauchbar, die Tabellen haben übernommen:',
    'The AI’s answer was unusable, the tables took over:'
  ],
  'kiFehler.keineStufen': ['Es kamen keine Stufen zurück.', 'No levels came back.'],
  'kiFehler.stufenLuecke': ['Die Stufen sind nicht lückenlos durchnummeriert.', 'The levels are not numbered without gaps.'],
  'kiFehler.stufeDoppelt': ['Zwei Stufen sagen dasselbe.', 'Two levels say the same thing.'],
  'kiFehler.zuLang': ['Eine Stufe ist ein Absatz statt eines Stichpunkts.', 'One level is a paragraph instead of a bullet point.'],

  'sammlung.suche': ['Suchen: Name, Art, Thema, „3 stufen" …', 'Search: name, kind, theme, “3 levels” …'],
  'sammlung.sucheHinweis': [
    'Ein Feld für alles: „kälte" sucht das Thema, „fluch" die Art, „3 stufen" die Stufenzahl.',
    'One field for everything: “cold” finds the theme, “curse” the kind, “3 levels” the level count.'
  ],
  'sammlung.leer': [
    'Noch nichts gebaut. Was du speicherst, steht hier.',
    'Nothing built yet. What you save shows up here.'
  ],
  'sammlung.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'sammlung.anzahl': ['{anzahl} Zustände', '{anzahl} conditions'],
  'sammlung.kacheln': ['Kacheln', 'Tiles'],
  'sammlung.liste': ['Liste', 'List'],
  'sammlung.sortieren': ['Sortieren', 'Sort'],
  'sammlung.nachGewicht': ['nach Gewicht', 'by weight'],
  'sammlung.nachName': ['nach Name', 'by name'],
  'sammlung.nachDatum': ['zuletzt geändert', 'last changed'],
  'sammlung.stufen': ['{anzahl} Stufen', '{anzahl} levels'],
  'sammlung.eineStufe': ['ohne Stufen', 'no levels'],

  'meldung.gespeichert': ['„{name}" liegt in der Sammlung.', '“{name}” is in the collection.'],
  'meldung.exportiert': ['„{name}" liegt als Notiz im Story Creator.', '“{name}” is a note in the Story Creator.'],
  'meldung.foundry': ['„{name}“ liegt als JSON für Foundry bereit.', '“{name}” is ready as JSON for Foundry.'],
  'meldung.fehler': ['Das ging nicht: {detail}', 'That did not work: {detail}'],
  'meldung.geloescht': ['„{name}" ist gelöscht.', '“{name}” is deleted.'],

  'fehler.kiKeinAnbieter': ['Es ist keine KI eingerichtet.', 'No AI is set up.'],
  'fehler.kiKeinJson': ['Die Antwort war nicht lesbar.', 'The answer could not be read.'],
  'error.aiOther': ['Die KI meldet einen Fehler.', 'The AI reports an error.'],
  'error.aiNoConnection': ['Keine Verbindung zur KI.', 'No connection to the AI.'],
  'error.aiTimeout': ['Die KI antwortet nicht.', 'The AI is not answering.'],
  'error.aiAuth': ['Der API-Schlüssel wird nicht akzeptiert.', 'The API key is not accepted.'],
  'error.aiRateLimit': ['Zu viele Anfragen. Gleich noch einmal.', 'Too many requests. Try again shortly.']
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
