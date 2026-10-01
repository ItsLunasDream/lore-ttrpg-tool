"""
Schreibt die Eichpunkte des Magic Item Generators aus den Gegenstaenden des SRD.

VON HAND GEWAEHLT, AUS DEM PDF GELESEN
======================================
Welcher SRD-Gegenstand fuer welche unserer Wirkungen steht, ist unsere
Auswahl — nur „saubere" Gegenstaende, die im Wesentlichen genau diese eine
Wirkung haben. Die Seltenheit, der Bonus und die Heilformel dagegen werden
aus dem ausgelesenen Text genommen, nicht abgetippt. Fehlt ein gewaehlter
Gegenstand in der Auslese, bricht das Skript ab.

Der Test in packages/magie prueft dann: erzeugt der Erzeuger bei dieser
Seltenheit diese Wirkung, und mit denselben Zahlen?

Aufruf:  python3 werkzeug/gegenstaende_eichung.py <gegenstaende.json> <ziel.ts>
"""
import json
import re
import sys

STUFEN = ['common', 'uncommon', 'rare', 'veryRare', 'legendary']

# (unsere Wirkung, SRD-Name, wie gelesen wird)
#   'einfach'  eine Seltenheit
#   'staffel'  „+1, +2, or +3": die Seltenheiten der Reihe nach, Bonus 1..3
#   'bonus1'   eine Seltenheit, Bonus +1 aus dem Text
AUSWAHL = [
    ('waffe-bonus', 'Weapon, +1, +2, or +3', 'staffel'),
    ('ruestung-bonus', 'Armor, +1, +2, or +3', 'staffel'),
    ('schild-bonus', 'Shield, +1, +2, or +3', 'staffel'),
    ('stab-bonus', 'Wand of the War Mage, +1, +2, or +3', 'staffel'),
    ('rettung-bonus', 'Cloak of Protection', 'bonus1'),
    ('rettung-bonus', 'Ring of Protection', 'bonus1'),
    ('attribut', 'Gauntlets of Ogre Power', 'einfach'),
    ('attribut', 'Headband of Intellect', 'einfach'),
    ('attribut', 'Amulet of Health', 'einfach'),
    ('resistenz', 'Armor of Resistance', 'einfach'),
    ('resistenz', 'Ring of Resistance', 'einfach'),
    ('trank-resistenz', 'Potion of Resistance', 'einfach'),
    ('dunkelsicht', 'Goggles of Night', 'einfach'),
    ('fliegen', 'Winged Boots', 'einfach'),
    ('fliegen', 'Wings of Flying', 'einfach'),
    ('trank-fliegen', 'Potion of Flying', 'einfach'),
    ('waffe-element', 'Flame Tongue', 'einfach'),
    ('waffe-bann', 'Dragon Slayer', 'einfach'),
    ('waffe-bann', 'Giant Slayer', 'einfach'),
]


def punkte(gegenstaende):
    nach_name = {g['name']: g for g in gegenstaende}
    heraus = []
    for wirkung, name, wie in AUSWAHL:
        g = nach_name.get(name)
        if g is None:
            raise SystemExit(f'Nicht in der Auslese: {name}')
        seltenheiten = [s for s in g['seltenheiten'] if s in STUFEN]
        if wie == 'staffel':
            if len(seltenheiten) != 3:
                raise SystemExit(f'{name}: erwartet drei Seltenheiten, gelesen {seltenheiten}')
            for bonus, s in enumerate(seltenheiten, start=1):
                heraus.append({'wirkung': wirkung, 'name': f'{name} (+{bonus})', 'seltenheit': s, 'bonus': bonus})
        else:
            if len(seltenheiten) != 1:
                raise SystemExit(f'{name}: erwartet eine Seltenheit, gelesen {seltenheiten}')
            punkt = {'wirkung': wirkung, 'name': name, 'seltenheit': seltenheiten[0]}
            if wie == 'bonus1':
                if not re.search(r'\+1 bonus', g['text']):
                    raise SystemExit(f'{name}: kein +1 im Text')
                punkt['bonus'] = 1
            heraus.append(punkt)

    # Die Heiltraenke stehen als Tabelle in einem Eintrag: Name, Seltenheit,
    # Heilung. Gelesen wird die Formel neben der Seltenheit.
    heil = nach_name.get('Potions of Healing')
    if heil is None:
        raise SystemExit('Nicht in der Auslese: Potions of Healing')
    for wort, s in (('Common', 'common'), ('Uncommon', 'uncommon'), ('Rare', 'rare'), ('Very Rare', 'veryRare')):
        # In der Tabelle steht die Formel VOR der Seltenheit: „2d4 + 2 Common".
        m = re.search(r'(\d+d\d+\s*\+\s*\d+)\s+' + wort + r'\b', heil['text'])
        if not m:
            raise SystemExit(f'Heiltrank {wort}: keine Formel gefunden')
        heraus.append({'wirkung': 'trank-heilung', 'name': f'Potion of Healing ({wort})', 'seltenheit': s,
                       'formel': re.sub(r'\s+', ' ', m.group(1))})
    return heraus


KOPF = '''/**
 * Eichpunkte: Gegenstaende aus dem SRD 5.2.1, an denen die Wirkungen dieses
 * Werkzeugs gemessen werden.
 *
 * DIESE DATEI IST ERZEUGT (packages/srd/werkzeug/gegenstaende_eichung.py).
 * Welcher Gegenstand fuer welche Wirkung steht, ist von Hand gewaehlt;
 * Seltenheit, Bonus und Heilformel sind aus dem PDF gelesen. Der Test
 * packages/magie/tests/eichung.test.mjs prueft den Erzeuger daran.
 */

export interface Eichpunkt {
  readonly wirkung: string;
  /** Der Name im englischen SRD. */
  readonly name: string;
  readonly seltenheit: 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';
  readonly bonus?: number;
  readonly formel?: string;
}

export const EICHPUNKTE: readonly Eichpunkt[] = '''

if __name__ == '__main__':
    daten = json.load(open(sys.argv[1], encoding='utf8'))
    p = punkte(daten['en'])
    with open(sys.argv[2], 'w', encoding='utf8') as f:
        f.write(KOPF + json.dumps(p, ensure_ascii=False, indent=2) + ';\n')
    print(len(p), 'Eichpunkte geschrieben')
