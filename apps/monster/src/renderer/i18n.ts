/**
 * Die Texte des Monster Creators.
 *
 * Paarweise `[de, en]` wie im Karteneditor und in der Inspirationshilfe:
 * zwei getrennte Woerterbuecher laufen auseinander.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  'titel': ['Monster Creator', 'Monster Creator'],
  'untertitel': [
    'Homebrew-Monster zu einem vorgegebenen Grad — und jede Zahl wird nachgerechnet.',
    'Homebrew monsters at a rating you choose — and every number gets checked.'
  ],

  'reiter.bauen': ['Bauen', 'Build'],
  'reiter.sammlung': ['Sammlung', 'Collection'],
  'reiter.pruefen': ['Prüfen', 'Check'],

  'feld.cr': ['Herausforderungsgrad', 'Challenge rating'],
  'feld.thema': ['Art', 'Type'],
  'feld.rolle': ['Rolle im Kampf', 'Combat role'],
  'feld.legendaer': ['Legendäre Aktionen', 'Legendary actions'],
  'feld.beliebig': ['beliebig', 'any'],
  'feld.kampfweite': ['Kampfentfernung', 'Fighting range'],
  'feld.kiWunsch': ['Wunsch an die KI', 'What to tell the AI'],
  'feld.kiWunschBeispiel': [
    'z. B. ein Sumpfhexer, der Ertrunkene ruft',
    'e.g. a bog witch who calls the drowned'
  ],
  'feld.kiWunschHinweis': [
    'Gilt nur für die KI. An den Zahlen ändert das nichts — die kommen aus den Richtwerten.',
    'Applies to the AI only. It does not change the numbers — those come from the baselines.'
  ],
  'kampfweite.egal': ['egal', 'any'],
  'kampfweite.nah': ['Nahkampf', 'Melee'],
  'kampfweite.fern': ['Fernkampf', 'Ranged'],
  'kampfweite.gemischt': ['gemischt', 'Mixed'],

  'knopf.wuerfeln': ['Würfeln', 'Roll'],
  'knopf.ki': ['Von der KI', 'From the AI'],
  'knopf.kiLaeuft': ['Fragt …', 'Asking …'],
  'feld.eigeneZustaende': ['Eigene Zustände einbauen', 'Use own conditions'],
  'feld.eigeneZustaendeLeer': [
    'Im Status Effect Creator liegen noch keine eigenen Zustände.',
    'There are no own conditions in the Status Effect Creator yet.'
  ],
  'knopf.alsNeu': ['Als neu speichern', 'Save as new'],
  'knopf.speichern': ['In die Sammlung', 'To the collection'],
  'knopf.export': ['In den Story Creator', 'To the Story Creator'],
  // Der Name des Programms, nicht uebersetzt — er heisst ueberall so.
  'knopf.foundry': ['Für Foundry (JSON)', 'For Foundry (JSON)'],
  'knopf.variante': ['Variante anlegen', 'Create variant'],
  'knopf.neuerName': ['Neuer Name', 'New name'],
  'knopf.neueFaehigkeiten': ['Neue Fähigkeiten', 'New features'],
  'knopf.neueWerte': ['Werte neu', 'Reroll numbers'],
  'knopf.neueAngriffe': ['Neue Angriffe', 'New attacks'],
  'knopf.neueBewegung': ['Neue Bewegung', 'New speed'],
  'knopf.zurueckZurKi': ['Zurück zum Vorschlag der KI', 'Back to the AI’s suggestion'],
  'knopf.uebernehmen': ['Übernehmen', 'Apply'],
  'knopf.loeschen': ['Löschen', 'Delete'],

  'werte.tp': ['Trefferpunkte', 'Hit points'],
  'werte.rk': ['Rüstungsklasse', 'Armor class'],
  'werte.schaden': ['Schaden pro Runde', 'Damage per round'],
  'werte.bonus': ['Angriffsbonus', 'Attack bonus'],
  'werte.angriffe': ['Angriffe', 'Attacks'],
  'werte.tempo': ['Bewegung', 'Speed'],
  'werte.umgebung': ['Umgebung', 'Environment'],
  'werte.initiative': ['Initiative', 'Initiative'],
  'werte.sinne': ['Sinne', 'Senses'],
  'werte.passiv': ['Passive Wahrnehmung {n}', 'Passive Perception {n}'],
  'werte.grad': ['{cr} (EP {ep}; ÜB +{ub})', '{cr} (XP {ep}; PB +{ub})'],
  'werte.resistent': ['Resistenzen', 'Damage Resistances'],
  'werte.immun': ['Immunitäten', 'Damage Immunities'],
  'werte.verwundbar': ['Verwundbarkeiten', 'Damage Vulnerabilities'],
  'werte.hauptattribut': [
    'Hauptattribut — daran hängen Angriffsbonus und Rettungs-SG',
    'Primary ability — the attack bonus and save DC hang on it'
  ],

  'block.aktionen': ['Aktionen', 'Actions'],
  'block.bonusaktionen': ['Bonusaktionen', 'Bonus Actions'],
  'kategorie.passiv': ['Eigenschaft', 'Trait'],
  'kategorie.aktion': ['Aktion', 'Action'],
  'kategorie.bonusaktion': ['Bonusaktion', 'Bonus action'],
  'kategorie.reaktion': ['Reaktion', 'Reaction'],
  'kategorie.legendaer': ['Legendäre Aktion', 'Legendary action'],
  'knopf.bearbeiten': ['Bearbeiten', 'Edit'],
  'knopf.fertig': ['Fertig', 'Done'],
  'bearbeiten.name': ['Name', 'Name'],
  'bearbeiten.satz': ['Beschreibung', 'Description'],
  'bearbeiten.anzahl': ['Anzahl', 'Count'],
  'bearbeiten.schnitt': ['Schnitt', 'Average'],
  'bearbeiten.wuerfel': ['Würfel', 'Dice'],
  'bearbeiten.faehigkeiten': ['Fähigkeiten', 'Features'],
  'bearbeiten.art': ['Art', 'Kind'],
  'bearbeiten.neueFaehigkeit': ['Neue Fähigkeit', 'New feature'],
  'bearbeiten.dazu': ['Fähigkeit hinzufügen', 'Add feature'],
  'block.reaktionen': ['Reaktionen', 'Reactions'],
  'block.legendaer': ['Legendäre Aktionen', 'Legendary Actions'],
  'block.legendaerText': [
    'Es kann 3 legendäre Aktionen einsetzen und wählt aus den folgenden Möglichkeiten. Nur eine auf einmal, und nur am Ende des Zuges einer anderen Kreatur. Zu Beginn seines Zuges bekommt es die verbrauchten zurück.',
    'It can take 3 legendary actions, choosing from the options below. Only one at a time, and only at the end of another creature’s turn. It regains spent legendary actions at the start of its turn.'
  ],
  'block.legendaerAngriff': ['Angriff', 'Attack'],
  'block.legendaerAngriffText': ['Es macht einen Angriff mit {waffe}.', 'It makes one {waffe} attack.'],
  'block.mehrfachangriff': ['Mehrfachangriff', 'Multiattack'],
  'block.mehrfachangriffText': [
    'Es greift {anzahl}-mal an: {was}.',
    'It makes {anzahl} attacks: {was}.'
  ],
  'block.nahkampf': [
    'Nahkampfangriff: +{bonus} auf Treffer, Reichweite {reichweite}. Treffer: {schaden}.',
    'Melee Attack: +{bonus} to hit, reach {reichweite}. Hit: {schaden}.'
  ],
  'block.fernkampf': [
    'Fernkampfangriff: +{bonus} auf Treffer, Reichweite {reichweite}. Treffer: {schaden}.',
    'Ranged Attack: +{bonus} to hit, range {reichweite}. Hit: {schaden}.'
  ],
  'block.flaeche': [
    '{flaeche}. Jede Kreatur darin: Rettungswurf {attribut} gegen SG {sg}, sonst {schaden}. Bei Erfolg die Hälfte.',
    '{flaeche}. Each creature in the area makes a DC {sg} {attribut} saving throw, taking {schaden} on a failure, or half as much on a success.'
  ],
  'block.aufladen': ['(Aufladen 5–6)', '(Recharge 5–6)'],
  'block.summeMitFaehigkeit': [
    'Zusammen {gesamt} Schaden pro Runde — {anzahl} {{Angriff|Angriffe}} zu je etwa {je}, dazu etwa {zusatz} aus seinen Fähigkeiten. Mit dieser Zahl rechnet die Prüfung.',
    'Together {gesamt} damage per round — {anzahl} {{attack|attacks}} at about {je} each, plus about {zusatz} from its features. This is the number the check uses.'
  ],
  'block.summeFlaeche': [
    'Die Fläche mit Aufladen ersetzt in ihrer Runde die Angriffe und zählt deshalb nicht dazu.',
    'The recharge area replaces the attacks on its turn, so it is not added.'
  ],
  'block.summe': [
    'Zusammen {gesamt} Schaden pro Runde — {anzahl} {{Angriff|Angriffe}} zu je etwa {je}. Mit dieser Zahl rechnet die Prüfung.',
    'Together {gesamt} damage per round — {anzahl} {{attack|attacks}} at about {je} each. This is the number the check uses.'
  ],

  'befund.passt': ['Passt zum Grad', 'Matches the rating'],
  'befund.zuStark': ['Zu stark für den Grad', 'Too strong for the rating'],
  'befund.zuSchwach': ['Zu schwach für den Grad', 'Too weak for the rating'],
  'befund.erklaerung': [
    'Gerechnet wird nach den 5E-Regeln: aus Trefferpunkten und Rüstung ein Grad, den es aushält, aus Schaden und Angriffsbonus einer, den es austeilt. Der Mittelwert ist das Ergebnis.',
    'Computed the 5E way: hit points and armor give a rating it can survive, damage and attack bonus give one it can dish out. The result is the mean of the two.'
  ],
  'befund.gerechnet': ['Gerechnet: Grad {cr}', 'Computed: CR {cr}'],
  'befund.eingestellt': ['Eingestellt: Grad {cr}', 'Set: CR {cr}'],
  'befund.verteidigung': ['Verteidigung', 'Defence'],
  'befund.angriff': ['Angriff', 'Offence'],
  'befund.empfohlen': ['Empfohlen: {von}–{bis}', 'Recommended: {von}–{bis}'],
  'befund.vorschlaege': ['Das lässt sich drehen:', 'Here is what you can turn:'],

  'grund.tpZuHoch': ['Trefferpunkte zu hoch', 'Hit points too high'],
  'grund.tpZuNiedrig': ['Trefferpunkte zu niedrig', 'Hit points too low'],
  'grund.schadenZuHoch': ['Schaden zu hoch', 'Damage too high'],
  'grund.schadenZuNiedrig': ['Schaden zu niedrig', 'Damage too low'],
  'grund.rkDaneben': ['Rüstungsklasse weit daneben', 'Armor class far off'],
  'grund.bonusDaneben': ['Angriffsbonus weit daneben', 'Attack bonus far off'],
  'vorschlag.setzen': ['{feld} auf {wert} setzen', 'Set {feld} to {wert}'],

  'ki.berichtigt': [
    'Die KI lag daneben. Die Zahlen wurden auf Grad {cr} gezogen.',
    'The AI was off. The numbers were pulled to CR {cr}.'
  ],
  'ki.aenderung': ['{feld}: {von} → {auf}', '{feld}: {von} → {auf}'],
  'ki.aus': [
    'Keine KI eingerichtet. Die Tabellen können alles ohne sie.',
    'No AI set up. The tables do all of this without one.'
  ],

  'sammlung.suche': ['Suchen: Name, Art, Grad …', 'Search: name, type, rating …'],
  'sammlung.sucheHinweis': [
    'Ein Feld für alles: „untot" sucht die Art, „4" den Grad, „untot 4" beides.',
    'One field for everything: “undead” finds the type, “4” the rating, “undead 4” both.'
  ],
  'sammlung.leer': [
    'Noch nichts gebaut. Was du speicherst, steht hier.',
    'Nothing built yet. What you save shows up here.'
  ],
  'sammlung.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'befund.grad': ['HG', 'CR'],
  'sammlung.anzahl': ['{anzahl} Monster', '{anzahl} {{monster|monsters}}'],
  'sammlung.kacheln': ['Kacheln', 'Tiles'],
  'sammlung.liste': ['Liste', 'List'],
  'sammlung.sortieren': ['Sortieren', 'Sort'],
  'sammlung.nachCr': ['nach Grad', 'by rating'],
  'sammlung.nachName': ['nach Name', 'by name'],
  'sammlung.nachDatum': ['zuletzt geändert', 'last changed'],

  'hinweis.dnd': [
    'Dieses Werkzeug ist 5E-kompatibel und rechnet nach den Regeln von 2024 (SRD 5.2.1). Grade, Trefferpunkte, Rüstungsklasse und Schaden pro Runde sind so gemeint, wie sie dort gemeint sind.',
    'This tool is 5E compatible and follows the 2024 rules (SRD 5.2.1). Ratings, hit points, armor class and damage per round mean what they mean there.'
  ],

  'pruefen.hinweis': [
    'Zahlen eintragen und nachrechnen lassen — für Monster aus Büchern, aus dem Netz oder von früher.',
    'Enter numbers and have them checked — for monsters from books, from the web, or from before.'
  ],

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
