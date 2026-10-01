/**
 * Die Texte des Homebrew Creators. Paarweise `[de, en]` wie in den anderen
 * Werkzeugen. Die Namen der Werte (Eigenschaften, Schadensarten …) stehen
 * in shared/texte.ts, weil auch die Ablage sie braucht.
 */
import { DEFAULT_LANGUAGE, type Language } from '@suite/i18n';

const TEXTE = {
  titel: ['Homebrew Creator', 'Homebrew Creator'],
  untertitel: [
    'Eigene Waffen, Rüstungen, Gegenstände und Zauber bauen, am SRD geeicht.',
    'Build your own weapons, armor, items and spells, calibrated against the SRD.'
  ],
  'neu': ['Neu', 'New'],
  'liste.suche': ['Suchen …', 'Search …'],
  'liste.leer': ['Noch nichts gebaut. Oben eine Art wählen.', 'Nothing built yet. Pick a kind above.'],
  'liste.nichts': ['Nichts gefunden.', 'Nothing found.'],
  'liste.anzahl': ['{anzahl} Einträge', '{anzahl} entries'],
  'liste.eine': ['1 Eintrag', '1 entry'],
  'filter.alle': ['Alle', 'All'],
  zurueck: ['Zurück', 'Back'],
  speichern: ['Speichern', 'Save'],
  gespeichert: ['Gespeichert.', 'Saved.'],
  loeschen: ['Löschen', 'Delete'],
  'loeschen.sicher': ['„{name}" löschen?', 'Delete “{name}”?'],
  'verwerfen.sicher': ['Ungespeicherte Änderungen verwerfen?', 'Discard unsaved changes?'],
  'fehler.speichern': ['Konnte nicht speichern: {detail}', 'Could not save: {detail}'],
  'fehler.lesen': ['Der Eintrag ließ sich nicht lesen.', 'The entry could not be read.'],
  'fehler.name': ['Der Eintrag braucht einen Namen.', 'The entry needs a name.'],
  'feld.name': ['Name', 'Name'],
  'feld.beschreibung': ['Beschreibung', 'Description'],
  'feld.preis': ['Preis (GM)', 'Cost (GP)'],
  'feld.gewicht': ['Gewicht (lb)', 'Weight (lb)'],
  'feld.kategorie': ['Kategorie', 'Category'],
  'kategorie.einfach': ['Einfach', 'Simple'],
  'kategorie.kriegs': ['Kriegswaffe', 'Martial'],
  'feld.nahFern': ['Kampf', 'Combat'],
  nah: ['Nahkampf', 'Melee'],
  fern: ['Fernkampf', 'Ranged'],
  'feld.wuerfel': ['Schaden', 'Damage'],
  'feld.schadensart': ['Schadensart', 'Damage type'],
  'feld.eigenschaften': ['Eigenschaften', 'Properties'],
  'feld.vielseitig': ['Zweihändig (vielseitig)', 'Two-handed (versatile)'],
  'feld.reichweite': ['Reichweite (Fuß, normal/max.)', 'Range (feet, normal/long)'],
  'feld.meisterschaft': ['Meisterschaft', 'Mastery'],
  'feld.bonus': ['Magischer Bonus', 'Magic bonus'],
  'bonus.kein': ['keiner', 'none'],
  'feld.ruestungsart': ['Art', 'Kind'],
  'feld.rk': ['RK', 'AC'],
  'feld.rkSchild': ['RK-Bonus', 'AC bonus'],
  'feld.staerke': ['Stärke nötig (0 = keine)', 'Strength needed (0 = none)'],
  'feld.heimlichkeit': ['Nachteil auf Heimlichkeit', 'Disadvantage on Stealth'],
  'eichung': ['Eichung am SRD', 'SRD calibration'],
  'eichung.im_rahmen': ['Im Rahmen', 'Within range'],
  'eichung.unter': ['Schwächer', 'Weaker'],
  'eichung.ueber': ['Stärker', 'Stronger'],
  'eichung.weit_ueber': ['Deutlich stärker', 'Much stronger'],
  'eichung.hinweis': [
    'Verglichen mit den ähnlichsten SRD-Einträgen, mit einer Würfelstufe Spielraum. Die Eichung warnt, sie verbietet nichts.',
    'Compared with the most similar SRD entries, with one die step of leeway. The calibration warns; it forbids nothing.'
  ],
  'eichung.vergleich': ['Vergleich', 'Compared with'],
  'eichung.seltenheit': ['Der Bonus +{bonus} entspricht im SRD der Seltenheit: {seltenheit}.', 'A +{bonus} bonus matches this SRD rarity: {seltenheit}.'],
  'eichung.bald': ['Für diese Art gibt es noch keine Eichung.', 'There is no calibration for this kind yet.'],
  'eichung.zauberHinweis': [
    'Verglichen mit SRD-Zaubern desselben Grads, die sofort Schaden machen (Schaden bei misslungenem Rettungswurf oder Treffer). Ab 25 % über dem stärksten gilt „stärker". Die Grenzen sind eine Schätzung, keine Regel.',
    'Compared with SRD spells of the same level that deal damage at once (damage on a failed save or a hit). From 25 % above the strongest it counts as “stronger”. The limits are an estimate, not a rule.'
  ],
  'eichung.magischHinweis': [
    'Dieselben Grenzen wie im Magic Item Generator, geeicht an SRD-Gegenständen. Gelesen werden nur Zahlen in festen Mustern („+2 Bonus", „2W6 Schaden", „SG 15", „(Grad 3)"); frei Formuliertes sieht die Eichung nicht.',
    'The same limits as in the Magic Item Generator, calibrated against SRD items. Only numbers in fixed patterns are read (“+2 bonus”, “2d6 damage”, “DC 15”, “(level 3)”); free wording is not checked.'
  ],
  'feld.gegenstandsart': ['Art', 'Kind'],
  'feld.seltenheit': ['Seltenheit', 'Rarity'],
  'feld.einstimmung': ['Einstimmung nötig', 'Requires attunement'],
  'feld.wirkungen': ['Wirkungen', 'Properties'],
  'wirkung.dazu': ['+ Wirkung', '+ Property'],
  'wirkung.weg': ['Wirkung entfernen', 'Remove property'],
  'feld.fluch': ['Fluch (leer = keiner)', 'Curse (empty = none)'],
  'feld.grad': ['Grad', 'Level'],
  'grad.trick': ['Zaubertrick', 'Cantrip'],
  'feld.schule': ['Schule', 'School'],
  'feld.klassen': ['Klassen', 'Classes'],
  'feld.zeit': ['Zeitaufwand', 'Casting Time'],
  'feld.zauberReichweite': ['Reichweite', 'Range'],
  'feld.komponenten': ['Komponenten', 'Components'],
  'feld.dauer': ['Wirkungsdauer', 'Duration'],
  'feld.konzentration': ['Konzentration', 'Concentration'],
  'feld.ritual': ['Ritual', 'Ritual'],
  'feld.schaden': ['Schaden', 'Damage'],
  'feld.ziel': ['Ziel', 'Target'],
  'ziel.einzel': ['Ein Ziel', 'One target'],
  'ziel.mehrere': ['Mehrere Ziele', 'Several targets'],
  'ziel.flaeche': ['Fläche', 'Area'],
  'feld.flaeche': ['Form', 'Shape'],
  'feld.flaecheGroesse': ['Größe (Fuß)', 'Size (feet)'],
  'flaeche.kugel': ['Kugel', 'Sphere'],
  'flaeche.kegel': ['Kegel', 'Cone'],
  'flaeche.linie': ['Linie', 'Line'],
  'flaeche.wuerfel': ['Würfel', 'Cube'],
  'flaeche.zylinder': ['Zylinder', 'Cylinder'],
  'flaeche.ausstrahlung': ['Ausstrahlung', 'Emanation'],
  'feld.rettungswurf': ['Rettungswurf', 'Saving throw'],
  'feld.halb': ['Halber Schaden bei Erfolg', 'Half damage on a success'],
  'feld.angriffswurf': ['Zauberangriff', 'Spell attack'],
  'feld.hoehererGrad': ['Höhere Grade', 'Higher levels'],
  bild: ['Bild', 'Image'],
  'bild.waehlen': ['Bild wählen', 'Choose image'],
  'bild.aendern': ['Bild ändern', 'Change image'],
  'bild.weg': ['Bild entfernen', 'Remove image'],
  'bild.fehler': ['Das Bild ließ sich nicht lesen.', 'The image could not be read.'],
  loot: ['In den Loot Generator', 'Send to Loot Generator'],
  'loot.drin': ['Im Loot Generator ✓', 'In Loot Generator ✓'],
  'loot.fertig': ['Liegt jetzt im Loot Generator.', 'Now in the Loot Generator.'],
  'loot.heraus': ['Aus dem Loot Generator genommen.', 'Removed from the Loot Generator.'],
  'loot.fehler': ['Das ging nicht.', 'That did not work.'],
  foundry: ['Für Foundry', 'For Foundry'],
  'foundry.fertig': ['Gespeichert: {pfad}', 'Saved: {pfad}']
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
