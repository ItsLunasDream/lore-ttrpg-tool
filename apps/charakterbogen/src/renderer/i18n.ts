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
    'Jede Stufe: −2 auf W20-Prüfungen, Bewegung −1,5 m (5 ft). Bei 6 stirbt die Figur.',
    'Each level: −2 to D20 Tests, Speed −5 ft (1.5 m). At 6 the character dies.'
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

  zauber: ['Zauber', 'Spells'],
  'zauber.keine': ['Diese Figur wirkt keine Zauber.', 'This character casts no spells.'],
  'zauber.an': ['Zauber hinzufügen', 'Add spellcasting'],
  'zauber.aus': ['Zauber entfernen', 'Remove spellcasting'],
  'zauber.ausSicher': ['Zauberliste und Plätze wirklich entfernen?', 'Really remove the spell list and slots?'],
  'zauber.attribut': ['Zauberattribut', 'Spellcasting ability'],
  'zauber.sg': ['Zauber-SG', 'Spell save DC'],
  'zauber.angriff': ['Zauberangriff', 'Spell attack'],
  'zauber.vorbereitet': ['Vorbereitet', 'Prepared'],
  'zauber.maxVorbereitet': ['Wie viele vorbereitet sein dürfen', 'How many may be prepared'],
  'zauber.vorbereitetHinweis': [
    'Gezählt ohne Zaubertricks und ohne „immer vorbereitet“. Die Höchstzahl steht in der Klassentabelle; trag sie selbst ein.',
    'Counted without cantrips and without “always prepared”. The maximum is in your class table; enter it yourself.'
  ],
  'zauber.plaetze': ['Zauberplätze', 'Spell slots'],
  'zauber.plaetzeGrad': ['Plätze des {grad}. Grades', 'Level {grad} slots'],
  'zauber.platzUmschalten': ['Platz des {grad}. Grades verbrauchen oder zurückgeben', 'Spend or restore a level {grad} slot'],
  'zauber.pakt': ['Plätze kommen auch nach einer kurzen Rast zurück (Paktmagie)', 'Slots also return on a Short Rest (Pact Magic)'],
  'zauber.paktHinweis': ['Für Hexenmeister.', 'For Warlocks.'],
  'zauber.liste': ['Zauberliste', 'Spell list'],
  'zauber.leer': ['Noch keine Zauber.', 'No spells yet.'],
  'zauber.trick': ['Zaubertricks sind immer bereit.', 'Cantrips are always ready.'],
  'zauber.trickKurz': ['ZT', 'C'],
  'zauber.tricks': ['Zaubertricks', 'Cantrips'],
  'zauber.gradN': ['{grad}. Grad', 'Level {grad}'],
  'zauber.grad': ['Grad', 'Level'],
  'zauber.alleGrade': ['Alle Grade', 'All levels'],
  'zauber.alleKlassen': ['Alle Klassen', 'All classes'],
  'zauber.konzentration': ['Konzentration', 'Concentration'],
  'zauber.ritual': ['Ritual', 'Ritual'],
  'zauber.immer': ['Immer vorbereitet', 'Always prepared'],
  'zauber.wirken': ['Wirken', 'Cast'],
  'zauber.gewirkt0': ['{name} gewirkt (Zaubertrick, kein Platz).', '{name} cast (cantrip, no slot).'],
  'zauber.gewirkt': ['{name} gewirkt, Platz des {grad}. Grades verbraucht.', '{name} cast, level {grad} slot spent.'],
  'zauber.keinPlatz': ['Kein freier Platz ab dem {grad}. Grad für {name}.', 'No free slot of level {grad} or higher for {name}.'],
  'zauber.name': ['Name', 'Name'],
  'zauber.text': ['Text', 'Text'],
  'zauber.herkunft': ['Herkunft (z. B. Talent)', 'Source (e.g. feat)'],
  'zauber.weg': ['Aus der Liste', 'Remove'],
  'zauber.dazu': ['+ Zauber aus dem SRD', '+ Spell from the SRD'],
  'zauber.eigen': ['+ Eigener Zauber', '+ Custom spell'],
  'zauber.eigenName': ['Eigener Zauber', 'Custom spell'],
  'zauber.suchen': ['Zauber suchen (deutsch oder englisch)', 'Search spells (English or German)'],
  'zauber.drin': ['drin', 'added'],
  schliessen: ['Schließen', 'Close'],
  inventar: ['Inventar', 'Inventory'],
  geld: ['Geld', 'Money'],
  'geld.summe': ['Zusammen', 'Total'],
  'umrechnen.wenige': ['In wenige Münzen', 'Fewest coins'],
  'umrechnen.wenigeHinweis': ['Rechnet in Platin, Gold, Silber und Kupfer um, ohne Elektrum.', 'Converts to platinum, gold, silver and copper, without electrum.'],
  'umrechnen.gold': ['Alles in Gold', 'All to gold'],
  'geld.geben': ['Geld geben …', 'Give money …'],
  aufteilen: ['Gleichmäßig aufteilen', 'Split evenly'],
  'aufteilen.auf': ['Aufteilen auf:', 'Split among:'],
  'aufteilen.fertig': ['Auf {n} aufgeteilt; was nicht aufging, bleibt hier.', 'Split among {n}; what did not divide stays here.'],
  muenzgewicht: ['Münzen mitwiegen', 'Count coin weight'],
  'muenzgewicht.hinweis': ['SRD: 50 Münzen wiegen etwa ein halbes Kilo (1 lb).', 'SRD: 50 coins weigh a pound (about 0.5 kg).'],
  geben: ['Geben', 'Give'],
  'geben.an': ['Geben an …', 'Give to …'],
  'geben.fertig': ['An {an} gegeben.', 'Given to {an}.'],
  'geben.geht.nicht': ['Das ging nicht: nicht genug da, oder der Bogen fehlt.', 'That did not work: not enough, or the sheet is missing.'],
  gegenstaende: ['Gegenstände', 'Items'],
  'gegenstaende.leer': ['Noch nichts dabei.', 'Nothing carried yet.'],
  'gegenstand.name': ['Gegenstand', 'Item'],
  'gegenstand.anzahl': ['Anzahl', 'Qty'],
  'gegenstand.gewicht': ['Gewicht ({einheit})', 'Weight ({einheit})'],
  'gegenstand.wert': ['Wert ({einheit})', 'Value ({einheit})'],
  'gegenstand.ausgeruestet': ['Ausgerüstet', 'Equipped'],
  'gegenstand.eingestimmt': ['Eingestimmt', 'Attuned'],
  'gegenstand.mehr': ['Beschreibung und mehr', 'Description and more'],
  'gegenstand.beschreibung': ['Beschreibung', 'Description'],
  'gegenstand.dazu': ['+ Gegenstand', '+ Item'],
  'summe.gewicht': ['Gewicht', 'Weight'],
  'summe.wert': ['Wert', 'Value'],
  mindestens: ['mindestens', 'at least'],
  eingestimmt: ['Eingestimmt', 'Attuned'],
  'eingestimmt.warnung': ['Mehr als drei eingestimmte Gegenstände erlaubt das SRD nicht.', 'The SRD allows no more than three attuned items.'],
  'traglast.ueber': ['Mehr als die Traglast (Stärke × 7,5 kg bzw. × 15 lb): Bewegung höchstens 1,5 m (5 ft).', 'Over carrying capacity (Strength × 15 lb, or × 7.5 kg): Speed at most 5 ft (1.5 m).'],
  verlauf: ['Verlauf', 'History'],
  'neu.gruppe': ['Neues Gruppeninventar', 'New party inventory'],
  'neu.gruppeName': ['Gemeinsame Beute', 'Shared loot'],
  notizen: ['Notizen', 'Notes'],
  'notizen.platzhalter': ['Merkmale, Talente, Sprachen, Werkzeuge …', 'Features, feats, languages, tools …'],
  gruppe: ['Gruppeninventar', 'Party inventory'],
  // Boegen im Raum
  'live.titel': ['Im Raum', 'In the room'],
  'live.leer': ['Noch hat niemand einen Bogen hereingebracht.', 'Nobody has brought a sheet in yet.'],
  'live.bringe': ['In den Raum bringen', 'Bring into the room'],
  'live.bringe.wahl': ['Eigenen Bogen wählen …', 'Choose one of your sheets …'],
  'live.meiner': ['Deiner', 'Yours'],
  'live.nurUebersicht': [
    'Nur die Übersicht ist freigegeben: Name, Klasse, ungefähre TP, RK, Zustände.',
    'Only the overview is shared: name, class, rough HP, AC, conditions.'
  ],
  'live.tp.voll': ['unverletzt', 'unhurt'],
  'live.tp.leicht': ['leicht verletzt', 'lightly hurt'],
  'live.tp.schwer': ['schwer verletzt', 'badly hurt'],
  'live.tp.boden': ['am Boden', 'down'],
  'live.imRaum.meiner': ['Im Raum: dein Bogen', 'In the room: your sheet'],
  'live.imRaum.von': ['Im Raum: Bogen von {name}', 'In the room: {name}’s sheet'],
  'live.nurLesen': ['nur lesen', 'read only'],
  'live.zuletzt': ['Zuletzt: {name}, {zeit}', 'Last change: {name}, {zeit}'],
  'live.freigabe': ['Andere sehen', 'Others see'],
  'live.freigabe.titel': [
    'Was die anderen Spieler:innen sehen. Die SL sieht immer alles.',
    'What the other players see. The GM always sees everything.'
  ],
  'live.freigabe.nichts': ['nichts', 'nothing'],
  'live.freigabe.uebersicht': ['Übersicht', 'overview'],
  'live.freigabe.alles': ['alles', 'everything'],
  'live.still': ['Still ändern', 'Change quietly'],
  'live.still.kurz': ['still', 'quiet'],
  'live.still.titel': [
    'Solange an: deine Änderungen an fremden Bögen werden nicht markiert. Sie stehen nur im Verlauf der SL.',
    'While on: your changes to other people’s sheets are not marked. Only the GM history shows them.'
  ],
  'live.zurueck': ['Aus dem Raum nehmen', 'Take out of the room'],
  'live.entfernen': ['Aus dem Raum entfernen', 'Remove from the room'],
  'live.weg': ['Der Bogen ist nicht mehr im Raum. Der letzte Stand liegt bei der Person, der er gehört.', 'The sheet is no longer in the room. The person it belongs to keeps the last state.'],
  'live.abgelehnt.recht': ['Das darfst du an diesem Bogen nicht ändern.', 'You may not change this sheet.'],
  'live.abgelehnt.voll': ['Du hast schon zwölf Bögen im Raum.', 'You already have twelve sheets in the room.'],
  'live.abgelehnt.unbekannt': ['Diesen Bogen gibt es im Raum nicht mehr.', 'This sheet is no longer in the room.'],
  'live.abgelehnt.geht-nicht': ['Das geht nicht: nicht genug davon, oder der Gegenstand ist schon weg.', 'That does not work: not enough of it, or the item is already gone.'],
  'live.abgelehnt.ungueltig': ['Der Gastgeber konnte die Änderung nicht lesen.', 'The host could not read the change.'],
  'sl.kurz': ['SL', 'GM'],
  'sl.marke.titel': ['Geändert von {von} um {zeit}. Vorher: {alt}', 'Changed by {von} at {zeit}. Before: {alt}'],
  'sl.aenderungen': ['{n} Änderungen durch die SL', '{n} changes by the GM'],
  'sl.gesehen': ['Gesehen', 'Seen'],
  'sl.verlauf': ['Verlauf der SL ({n})', 'GM history ({n})'],
  'feld.name': ['Name', 'Name'],
  'feld.tp': ['TP', 'HP'],
  'feld.rk': ['RK', 'AC'],
  'feld.attribute': ['Attribute', 'Abilities'],
  'feld.fertigkeiten': ['Fertigkeiten', 'Skills'],
  'feld.zustaende': ['Zustände', 'Conditions'],
  'feld.erschoepfung': ['Erschöpfung', 'Exhaustion'],
  'feld.gegenstaende': ['Gegenstände', 'Items'],
  'feld.muenzen': ['Geld', 'Money'],
  'feld.notizen': ['Notizen', 'Notes'],
  'feld.zauber': ['Zauber', 'Spells'],
  'feld.angriffe': ['Angriffe', 'Attacks'],
  'feld.klassen': ['Klassen', 'Classes'],
  'feld.trefferwuerfel': ['Trefferwürfel', 'Hit Dice'],
  'feld.todesrettung': ['Todesrettungswürfe', 'Death saves']
} as const;

export type TextKey = keyof typeof TEXTE;

let sprache: Language = DEFAULT_LANGUAGE;

export function setLanguage(neu: Language): void {
  sprache = neu;
}

export function getLanguage(): Language {
  return sprache;
}

/** Ob es einen Text unter diesem Schluessel gibt (fuer zusammengesetzte Schluessel). */
export function hatText(key: string): key is TextKey {
  return Object.prototype.hasOwnProperty.call(TEXTE, key);
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
