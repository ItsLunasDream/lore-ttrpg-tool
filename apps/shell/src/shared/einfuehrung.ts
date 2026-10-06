/**
 * Was beim ersten Mal erklaert wird.
 *
 * Ein kurzes Fenster beim ersten Start der Sammlung und beim ersten Oeffnen
 * jedes Werkzeugs: was es tut, wofuer es gut ist, drei bis fuenf Punkte.
 * Danach nie wieder — wer es noch einmal sehen will, findet in den
 * Einstellungen einen Knopf dafuer.
 *
 * Die Texte stehen hier und nicht im Woerterbuch: sie gehoeren zusammen, sind
 * laenger als ein Knopfbeschriftung und wuerden dort zwischen zwanzig
 * Einzelschluesseln verschwinden. Zweisprachig wie alles andere.
 *
 * In der Huelle und nicht in den Werkzeugen, damit die Einfuehrung ueberall
 * gleich aussieht und ein Werkzeug sie nicht vergessen kann.
 */

export interface Paar {
  readonly de: string;
  readonly en: string;
}

export interface Einfuehrung {
  /** Werkzeug-Kennung, oder 'suite' fuer das Willkommen der Sammlung. */
  readonly id: string;
  readonly titel: Paar;
  /** Ein Satz: worum es geht. */
  readonly satz: Paar;
  /** Drei bis fuenf Punkte. Mehr liest beim ersten Start niemand. */
  readonly punkte: readonly Paar[];
}

/** Die Kennung des Willkommens beim allerersten Start. */
export const WILLKOMMEN = 'suite';

export const EINFUEHRUNGEN: readonly Einfuehrung[] = [
  {
    id: WILLKOMMEN,
    titel: { de: 'Willkommen', en: 'Welcome' },
    satz: {
      de: 'Werkzeuge für Pen-&-Paper-Runden, nebeneinander in einem Fenster.',
      en: 'Tools for tabletop campaigns, side by side in one window.'
    },
    punkte: [
      {
        de: 'Links in der Schiene wechselst du das Werkzeug. Nichts geht dabei verloren — was offen ist, bleibt offen.',
        en: 'Switch tools in the rail on the left. Nothing is lost on the way — whatever is open stays open.'
      },
      {
        de: 'Alles bleibt auf deiner Platte. Es geht nichts ins Netz, solange du keine KI einrichtest und fragst.',
        en: 'Everything stays on your disk. Nothing goes online unless you set up an AI and ask it something.'
      },
      {
        de: 'Sprache, Symbole und die KI stellst du oben rechts in den Einstellungen ein — einmal für alle Werkzeuge.',
        en: 'Language, icons and the AI live in the settings at the top right — set once, used by every tool.'
      },
      {
        de: 'Jedes Werkzeug erklärt sich beim ersten Öffnen selbst, genau wie dieses Fenster hier.',
        en: 'Each tool introduces itself the first time you open it, just like this window does now.'
      }
    ]
  },
  {
    id: 'backstory',
    titel: { de: 'Story Creator', en: 'Story Creator' },
    satz: {
      de: 'Das Archiv deiner Welt: Figuren, Orte, Fraktionen und was sie verbindet.',
      en: 'The archive of your world: characters, places, factions and what connects them.'
    },
    punkte: [
      {
        de: 'Notizen schreibst du wie in einem Textprogramm. Gespeichert wird als Markdown — lesbar auch ohne dieses Programm.',
        en: 'Write notes like in a word processor. They are saved as Markdown — readable without this program, too.'
      },
      {
        de: 'Mit [[doppelten Klammern]] verweist du auf andere Notizen. Gibt es sie noch nicht, legst du sie mit einem Klick an.',
        en: 'Use [[double brackets]] to link other notes. If one does not exist yet, a click creates it.'
      },
      {
        de: 'Der Graph zeigt das Geflecht: wer mit wem, wer allein steht. Knoten lassen sich verschieben, die Anordnung bleibt.',
        en: 'The graph shows the web: who is tied to whom, who stands alone. Drag nodes around; the arrangement is kept.'
      },
      {
        de: 'Exportieren kannst du einzelne Notizen oder die ganze Kampagne, als Markdown oder PDF — mit Inhaltsverzeichnis und Netzbild.',
        en: 'Export single notes or the whole campaign, as Markdown or PDF — with a table of contents and the web as a picture.'
      }
    ]
  },
  {
    id: 'mapmaker',
    titel: { de: 'Karteneditor', en: 'Map Editor' },
    satz: {
      de: 'Battlemaps und Weltkarten zeichnen — für den Tisch oder fürs VTT.',
      en: 'Draw battlemaps and world maps — for the table or for a VTT.'
    },
    punkte: [
      {
        de: 'Links die Werkzeuge, rechts ihre Einstellungen. Rechtsklick auf der Fläche wechselt zurück aufs Verschieben.',
        en: 'Tools on the left, their settings on the right. Right-click on the canvas switches back to panning.'
      },
      {
        de: 'Wände, Türen und Lichter gehören zur Karte dazu: Foundry, Roll20 und Owlbear Rodeo lesen sie aus dem Export.',
        en: 'Walls, doors and lights are part of the map: Foundry, Roll20 and Owlbear Rodeo read them from the export.'
      },
      {
        de: 'Generatoren bauen dir einen Stadtplan oder ein Höhlensystem als Anfang, den du danach von Hand veränderst.',
        en: 'Generators give you a town plan or a cave system to start from, which you then change by hand.'
      },
      {
        de: 'Gespeichert wird als Datei auf deiner Platte. F1 zeigt alle Tastenkürzel.',
        en: 'Maps are saved as files on your disk. Press F1 for every keyboard shortcut.'
      }
    ]
  },
  {
    id: 'initiative',
    titel: { de: 'Initiative Tracker', en: 'Initiative Tracker' },
    satz: {
      de: 'Die Reihenfolge im Kampf, Trefferpunkte und Zustände — systemneutral.',
      en: 'Turn order in combat, hit points and conditions — system-neutral.'
    },
    punkte: [
      {
        de: 'Teilnehmende eintragen, Initiative würfeln oder eintippen, los geht die Runde.',
        en: 'Add participants, roll or type initiative, and the round begins.'
      },
      {
        de: 'Zustände haben eine Dauer und zählen selbst herunter. Was abläuft, sagt der Tracker.',
        en: 'Conditions carry a duration and count themselves down. The tracker says when one ends.'
      },
      {
        de: 'Monsterhorden fasst du zu Gruppen zusammen — eine Zeile statt acht.',
        en: 'Group monster hordes together — one row instead of eight.'
      },
      {
        de: 'Begegnungen lassen sich vorbereiten und später wieder laden.',
        en: 'Prepare encounters in advance and load them again later.'
      }
    ]
  },
  {
    id: 'dice',
    titel: { de: 'Würfel', en: 'Dice' },
    satz: {
      de: 'Ein Wurf, wenn keine Würfel zur Hand sind — flach oder als fallende Körper.',
      en: 'A roll when no dice are at hand — flat, or as falling bodies.'
    },
    punkte: [
      {
        de: 'Würfel anklicken, Anzahl wächst; Rechtsklick nimmt wieder weg. Ein Minus davor heißt Abzug.',
        en: 'Click a die to add one, right-click to take one away. A minus in front means subtraction.'
      },
      {
        de: 'Vorteil und Nachteil gibt es als eigenen Schalter, der Verlauf steht daneben.',
        en: 'Advantage and disadvantage have their own switch; the history stands beside it.'
      },
      {
        de: 'Die 3D-Ansicht ist Schau, kein Zufall: das Ergebnis steht vorher fest und wird nur gezeigt.',
        en: 'The 3D view is for show, not for chance: the result is fixed beforehand and only played back.'
      }
    ]
  },
  {
    id: 'npc',
    titel: { de: 'NPC Creator', en: 'NPC Creator' },
    satz: {
      de: 'Eine Randfigur auf Knopfdruck, wenn die Gruppe jemanden anspricht, den du nicht vorbereitet hast.',
      en: 'A minor character at the push of a button, for when the party talks to someone you did not prepare.'
    },
    punkte: [
      {
        de: 'Jedes Feld lässt sich einzeln neu würfeln, festhalten oder überschreiben.',
        en: 'Every field can be rerolled, locked or overwritten on its own.'
      },
      {
        de: 'Ohne KI kommt alles aus Tabellen. Mit KI schlägt das Modell frei vor, nicht aus den Tabellen.',
        en: 'Without an AI everything comes from tables. With one, the model suggests freely instead.'
      },
      {
        de: 'Ein Knopf legt die Figur als Notiz im Story Creator an — in der Kampagne, die dort offen ist.',
        en: 'One button files the character as a note in the Story Creator — in the campaign open over there.'
      }
    ]
  },
  {
    id: 'inspiration',
    titel: { de: 'Inspirationshilfe', en: 'Inspiration' },
    satz: {
      de: 'Das leere Blatt am Anfang einer Kampagne: Aufhänger, Fraktionen, Figuren, Orte und ihre Verbindungen.',
      en: 'The blank page at the start of a campaign: hooks, factions, characters, places and their ties.'
    },
    punkte: [
      {
        de: 'Umfang, Region, Thema und Tonfall einstellen, dann „Alles würfeln" — aus großen Tabellen, ohne KI.',
        en: 'Set scope, region, theme and tone, then “Roll everything” — from large tables, no AI needed.'
      },
      {
        de: 'Jeder Baustein hat ein Schloss. Was dir gefällt, bleibt beim nächsten Wurf stehen.',
        en: 'Every block has a lock. Whatever you like stays put on the next roll.'
      },
      {
        de: 'Verbindungen sind gerichtet: beide sehen dieselbe Sache anders. Genau daraus wird am Tisch eine Szene.',
        en: 'Connections are directed: the two see the same thing differently. That is what makes a scene.'
      },
      {
        de: 'Übernehmen legt alles als verknüpfte Notizen im Story Creator an. Der Entwurf hier ist nur ein Entwurf.',
        en: 'Sending it over files everything as linked notes in the Story Creator. What is here is only a draft.'
      }
    ]
  }
,
  {
    id: 'monster',
    titel: { de: 'Monster Creator', en: 'Monster Creator' },
    satz: {
      de: 'Homebrew-Monster zu einem Grad, den du vorgibst — und jede Zahl wird nachgerechnet.',
      en: 'Homebrew monsters at a rating you choose — and every number gets checked.'
    },
    punkte: [
      {
        de: 'Grad, Art und Rolle einstellen, würfeln. Der Rest kommt aus Tabellen, ganz ohne KI.',
        en: 'Set rating, type and role, then roll. The rest comes from tables, no AI needed.'
      },
      {
        de: 'Unter dem Steckbrief steht der Befund: hält es genug aus, teilt es genug aus, und was sich drehen lässt.',
        en: 'Below the stat block sits the verdict: does it take enough, does it deal enough, and what you can turn.'
      },
      {
        de: 'Was die KI liefert, wird nachgerechnet und bei Bedarf auf den Grad gezogen — mit Ansage.',
        en: 'What the AI delivers is recomputed and pulled to the rating if needed — and it says so.'
      },
      {
        de: 'Gespeichertes findest du unter „Sammlung", als Kacheln oder Liste. Ein Feld sucht Name, Art und Grad zugleich.',
        en: 'What you save lives under “Collection”, as tiles or a list. One field searches name, type and rating at once.'
      }
    ]
  },
  {
    id: 'zustaende',
    titel: { de: 'Status Effect Creator', en: 'Status Effect Creator' },
    satz: {
      de: 'Eigene Zustände mit Stufen — Kälte, die sich aufbaut, ein Fluch, der beim dritten Mal etwas anderes tut.',
      en: 'Custom conditions with levels — cold that builds up, a curse that does something else the third time.'
    },
    punkte: [
      {
        de: 'Art, Thema, Härte und Stufenzahl einstellen, würfeln. Jede Stufe ist schlimmer als die davor.',
        en: 'Set kind, theme, severity and level count, then roll. Every level is worse than the one before.'
      },
      {
        de: 'Die Stufen sind Stichpunkte, keine Prosa. Wer Sätze will, lässt sie von der KI ausformulieren.',
        en: 'Levels are bullet points, not prose. If you want sentences, have the AI write them out.'
      },
      {
        de: 'Unter dem Blatt steht das Gewicht — wie schwer der Zustand wiegt, und wie viel das im Vergleich zu bekannten ist.',
        en: 'Below the sheet sits the weight — how much the condition weighs, and how that compares to familiar ones.'
      },
      {
        de: 'Was es ausdrücklich NICHT sagt: ob er für deine Runde zu hart ist. Das hängt daran, wie oft man ihn bekommt.',
        en: 'What it explicitly does NOT say: whether it is too harsh for your table. That depends on how often you get it.'
      }
    ]
  },
  {
    id: 'encounter',
    titel: { de: 'Encounter Creator', en: 'Encounter Creator' },
    satz: {
      de: 'Eine Begegnung zusammenstellen — und sie später in einem Zug in den Initiative Tracker schieben.',
      en: 'Put an encounter together — and later push it into the initiative tracker in one go.'
    },
    punkte: [
      {
        de: 'Eine Begegnung anlegen, benennen, eine Notiz dazu: Taktik, Vorlesetext, was sonst dazugehört.',
        en: 'Create an encounter, name it, add a note: tactics, read-aloud text, whatever else belongs.'
      },
      {
        de: 'Sie liegt als Markdown-Datei da. Wer das Werkzeug nicht mehr benutzt, behält seine Begegnungen.',
        en: 'It sits there as a Markdown file. If you stop using the tool, you keep your encounters.'
      },
      {
        de: 'Eine Begegnung ist eine Vorlage, kein Spielstand: der Tracker liest sie und schreibt nicht zurück.',
        en: 'An encounter is a template, not a saved game: the tracker reads it and never writes back.'
      },
      {
        de: 'Die Monster kommen aus deiner eigenen Sammlung, und „In den Tracker" schiebt alles in einem Zug hinüber.',
        en: 'The monsters come from your own collection, and “To the tracker” pushes everything across in one go.'
      },
      {
        de: 'Trag die Gruppe am Tisch ein, dann steht darunter die Schwierigkeit, gerechnet nach dem Regelwerk. Oder lass die Begegnung nach Ziel-HG zusammenstellen.',
        en: 'Enter your party and the difficulty appears underneath, worked out from the rules. Or let it build an encounter for a target CR.'
      }
    ]
  },
  {
    id: 'nachschlagewerk',
    titel: { de: 'Nachschlagewerk', en: 'Reference' },
    satz: {
      de: 'Die Regeln aus dem Systemreferenzdokument — offline, zweisprachig und in derselben Suche wie alles andere.',
      en: 'The rules from the System Reference Document — offline, in both languages, and in the same search as everything else.'
    },
    punkte: [
      {
        de: 'Das ganze Regelglossar, das Kapitel Ausrüstung, alle Zauber und alle magischen Gegenstände. Gesucht wird auch im Text; Begriffe im Text zeigen beim Darüberfahren eine Vorschau.',
        en: 'The whole rules glossary, the equipment chapter, every spell and every magic item. The search covers the text; terms in the text show a preview on hover.'
      },
      {
        de: 'Beide Sprachen gleichzeitig: wer auf Deutsch steht und „prone" tippt, findet „Liegend".',
        en: 'Both languages at once: typing “liegend” finds Prone even when the tool is in English.'
      },
      {
        de: 'Bei einer Abweichung gilt die englische Fassung — „Andere Sprache daneben" zeigt sie neben der deutschen.',
        en: 'Where the two differ, the English version applies — “Other language alongside” shows both.'
      },
      {
        de: 'Eigene Hausregeln hängen an der offiziellen Regel, und markierter Text bekommt eine Notiz.',
        en: 'Your own house rules attach to the official rule, and selected text can take a note.'
      }
    ]
  },
  {
    id: 'magicitems',
    titel: { de: 'Magic Item Generator', en: 'Magic Item Generator' },
    satz: {
      de: 'Magische Gegenstände würfeln, anpassen und ablegen.',
      en: 'Roll, adjust and store magic items.'
    },
    punkte: [
      {
        de: 'Art und Seltenheit wählen oder dem Zufall überlassen, dann „Würfeln".',
        en: 'Pick a type and rarity or leave them to chance, then “Roll”.'
      },
      {
        de: 'Der Wert kommt aus der Tabelle des SRD; alles andere lässt sich frei ändern.',
        en: 'The value comes from the SRD table; everything else can be edited freely.'
      },
      {
        de: 'Abgelegt wird erst mit „Speichern"; „Neu würfeln" verwirft den Entwurf.',
        en: 'Nothing is stored until you “Save”; “Reroll” discards the draft.'
      }
    ]
  },
  {
    id: 'kalender',
    titel: { de: 'Campaign Calendar', en: 'Campaign Calendar' },
    satz: {
      de: 'Einen Termin finden: alle markieren, wann sie können, die Heatmap zeigt die besten Abende.',
      en: 'Find a date: everyone marks when they can, the heatmap shows the best evenings.'
    },
    punkte: [
      {
        de: 'Neue Umfrage anlegen, Tage und Uhrzeiten wählen, dann im eigenen Raster ziehen: „Kann" oder „Notfalls".',
        en: 'Create a poll, pick days and times, then drag in your own grid: “Available” or “If need be”.'
      },
      {
        de: 'Im Raum teilen: Antworten kommen von selbst zurück. Ohne Raum als Datei herumschicken und wieder einlesen.',
        en: 'Share in the room: answers come back on their own. Without a room, send it around as a file and import it again.'
      },
      {
        de: 'Unter „Beste Termine" festlegen und als .ics in den eigenen Kalender holen.',
        en: 'Set the date under “Best dates” and add it to your own calendar as .ics.'
      }
    ]
  },
  {
    id: 'orte',
    titel: { de: 'Settlement Generator', en: 'Settlement Generator' },
    satz: {
      de: 'Ein Klick, ein ganzer Ort: Gasthaus, Läden mit SRD-Preisen, Personen und Gerüchte.',
      en: 'One click, a whole settlement: inn, shops at SRD prices, people and rumours.'
    },
    punkte: [
      {
        de: 'Größe und Lage vorgeben oder würfeln lassen. Mit 🔒 hältst du ein Teil fest, 🎲 würfelt nur dieses neu.',
        en: 'Set size and location or let them be rolled. 🔒 keeps a part, 🎲 rerolls only that part.'
      },
      {
        de: 'Zauberdienste, Gasthauspreise und Waren kommen aus dem SRD; welche Läden es wo gibt, ist eine Annahme und so gekennzeichnet.',
        en: 'Spellcasting services, inn prices and wares come from the SRD; which shops exist where is an assumption and marked as such.'
      },
      {
        de: 'Gespeicherte Orte gehen als Notizen in den Story Creator, ihre Läden als Tabellen in den Loot Generator.',
        en: 'Saved settlements go to the Story Creator as notes, their shops to the Loot Generator as tables.'
      }
    ]
  },
  {
    id: 'homebrew',
    titel: { de: 'Homebrew Creator', en: 'Homebrew Creator' },
    satz: {
      de: 'Eigene Waffen, Rüstungen und Gegenstände bauen, verglichen mit dem SRD.',
      en: 'Build your own weapons, armor and items, compared with the SRD.'
    },
    punkte: [
      {
        de: 'Oben eine Art wählen, dann Feld für Feld ausfüllen; ein Bild ist möglich.',
        en: 'Pick a kind at the top, then fill in field by field; an image is optional.'
      },
      {
        de: 'Rechts steht die Eichung: wie stark der Eintrag neben ähnlichen SRD-Einträgen ist. Sie warnt, sie verbietet nichts.',
        en: 'The calibration on the right shows how strong the entry is next to similar SRD entries. It warns; it forbids nothing.'
      },
      {
        de: 'Gespeichertes steht im Charakterbogen und im Loot Generator zur Wahl.',
        en: 'Saved entries can be picked in the Character Sheet and the Loot Generator.'
      }
    ]
  },
  {
    id: 'loot',
    titel: { de: 'Loot Generator', en: 'Loot Generator' },
    satz: {
      de: 'Eigene Zufallstabellen schreiben und würfeln.',
      en: 'Write and roll your own random tables.'
    },
    punkte: [
      {
        de: 'Eine Zeile je Eintrag, auf Wunsch mit Spanne davor: „1-3: 2d6 × 10 Kupfer".',
        en: 'One line per entry, optionally with a range in front: “1-3: 2d6 × 10 copper”.'
      },
      {
        de: 'Eine andere Tabelle in eckigen Klammern wird mitgewürfelt: „[Taschenkram]".',
        en: 'Another table in square brackets is rolled too: “[Pocket Junk]”.'
      },
      {
        de: 'Der Würfel auf einer Kachel würfelt sofort, ohne die Tabelle zu öffnen.',
        en: 'The die on a tile rolls right away, without opening the table.'
      }
    ]
  },
  {
    id: 'charakterbogen',
    titel: { de: 'Charakterbogen', en: 'Character Sheet' },
    satz: {
      de: 'Ein kleiner 5E-kompatibler Bogen (Regeln von 2024), der mitrechnet.',
      en: 'A small 5E-compatible sheet (2024 rules) that does the maths.'
    },
    punkte: [
      {
        de: 'Modifikatoren, Übungsbonus, Fertigkeiten und passive Wahrnehmung rechnet der Bogen selbst.',
        en: 'Modifiers, proficiency bonus, skills and passive Perception are worked out for you.'
      },
      {
        de: 'Ins Feld „Schaden / Heilung": „-7" zieht ab, „+5" heilt, Würfel gehen auch. Temporäre TP gehen zuerst.',
        en: 'In the “Damage / Healing” field: “-7” subtracts, “+5” heals, dice work too. Temporary HP go first.'
      },
      {
        de: 'Gespeichert wird von selbst, als Markdown-Datei, die jeder Editor lesen kann.',
        en: 'Saving happens by itself, as a Markdown file any editor can read.'
      }
    ]
  }
];


/*
 * Die Hilfe (Knopf „?" in der Titelleiste, F1): dieselben Sätze wie die
 * Einführung, dazu die Bedienung, wo ein Werkzeug Eigenheiten hat. Nur, was
 * im Code nachgesehen ist; was nicht dasteht, gibt es nicht oder ist
 * gewöhnlich (Klicken, Tippen).
 */
export const STEUERUNG: Readonly<Record<string, readonly Paar[]>> = {
  backstory: [
    { de: '„[[" tippen schlägt Notizen zum Verlinken vor; markierter Text mit „[[" wird zum Verweis.', en: 'Type “[[” to get notes to link; selected text plus “[[” becomes a link.' },
    { de: 'Überschriften lassen sich mit dem Pfeil davor einklappen.', en: 'Headings collapse with the arrow in front of them.' },
    { de: 'Strg+S speichert die offene Notiz.', en: 'Ctrl+S saves the open note.' }
  ],
  mapmaker: [
    { de: 'Alle Tasten und Mausgriffe stehen in der eigenen Hilfe des Map Makers (F1 oder „?" in seiner Werkzeugleiste).', en: 'All keys and mouse gestures are listed in the Map Maker’s own help (F1 or “?” in its toolbar).' }
  ],
  initiative: [
    { de: 'Strg+Z macht rückgängig, Strg+Y (oder Strg+Umschalt+Z) wieder her.', en: 'Ctrl+Z undoes, Ctrl+Y (or Ctrl+Shift+Z) redoes.' },
    { de: 'Rechtsklick auf eine Zeile oder die freie Fläche öffnet ein Menü.', en: 'Right-click a row or the empty area for a menu.' },
    { de: 'Im Schadensfeld mit Enter bestätigen.', en: 'Confirm the damage field with Enter.' }
  ],
  dice: [
    { de: 'Linksklick auf einen Würfel legt einen dazu, Rechtsklick nimmt einen weg.', en: 'Left-click a die to add one, right-click to remove one.' },
    { de: 'Einen Ausdruck wie „2d6+3" tippen und mit Enter würfeln.', en: 'Type an expression like “2d6+3” and press Enter to roll.' }
  ],
  kalender: [
    { de: 'Klicken markiert ein Feld, Ziehen ein Rechteck. Beginnt das Ziehen auf einem markierten Feld, wird entfernt.', en: 'Click marks a cell, dragging marks a rectangle. Starting on a marked cell removes instead.' },
    { de: 'Mit der Tastatur: Leertaste oder Enter auf einem Feld.', en: 'With the keyboard: Space or Enter on a cell.' }
  ],
  loot: [{ de: 'In einem Eintrag schlägt „[" andere Tabellen zum Verweisen vor.', en: 'In an entry, “[” suggests other tables to reference.' }],
  homebrew: [{ de: 'Ein Klick auf die Überschrift eines Abschnitts klappt ihn zu oder auf.', en: 'Click a section heading to collapse or expand it.' }]
};

/** Was überall gilt; steht unter jeder Hilfe. */
export const ALLGEMEIN: readonly Paar[] = [
  { de: 'Strg+K: Suche über alle Werkzeuge.', en: 'Ctrl+K: search across all tools.' },
  { de: 'Strg+S: speichern, wo es einen Speichern-Knopf gibt.', en: 'Ctrl+S: save wherever there is a Save button.' },
  { de: 'Pfeiltasten wandern durch Listen und Kacheln.', en: 'Arrow keys move through lists and tiles.' },
  { de: 'F6: zurück in die Schiene links.', en: 'F6: back to the rail on the left.' },
  { de: 'Strg+Alt+Plus/Minus/0: die ganze Oberfläche größer, kleiner, zurück.', en: 'Ctrl+Alt+Plus/Minus/0: the whole interface larger, smaller, reset.' },
  { de: 'F1 oder „?" oben: diese Hilfe.', en: 'F1 or “?” at the top: this help.' }
];

/** Die Einfuehrung zu einer Kennung, oder `undefined`. */
export function einfuehrungFuer(id: string): Einfuehrung | undefined {
  return EINFUEHRUNGEN.find((eintrag) => eintrag.id === id);
}

/** Ob diese Einfuehrung noch aussteht. */
export function stehtAus(id: string, gesehen: readonly string[]): boolean {
  return Boolean(einfuehrungFuer(id)) && !gesehen.includes(id);
}
