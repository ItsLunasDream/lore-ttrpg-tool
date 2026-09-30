/**
 * Rechtschreibpruefung: Vorschlaege und eigene Woerter.
 *
 * Electron bringt die Pruefung mit, aber das Menue dazu waere das native von
 * Chromium — und der Editor hat ein eigenes Rechtsklickmenue. Damit beides
 * gleich aussieht, faengt der Hauptprozess das Ereignis ab und reicht das
 * angestrichene Wort samt Vorschlaegen an die Oberflaeche weiter, die daraus
 * ihr eigenes Menue baut.
 *
 * Das Woerterbuch gehoert der Sitzung, nicht der Kampagne. Electron fuehrt
 * je Sitzung genau eines; je Kampagne hiesse, es selbst zu verwalten.
 */
import type { Session, WebContents } from 'electron';
import type { Language } from '../shared/i18n';
import type { Rechtschreibwahl } from '../shared/types';
import { channel } from '../shared/channels';

/** Was die Oberflaeche braucht, um ihr Menue zu bauen. */
export interface RechtschreibTreffer {
  readonly x: number;
  readonly y: number;
  readonly wort: string;
  readonly vorschlaege: string[];
}

/**
 * Die Sprachkennung, die Chromium erwartet.
 *
 * `en` allein kennt es nicht; ohne Gebiet bliebe die Pruefung stumm.
 */
export function pruefsprache(language: Language): string {
  return language === 'de' ? 'de' : 'en-US';
}

/**
 * Stellt die Sprache der Pruefung ein.
 *
 * Schlaegt fehl, wenn die Fassung ohne Rechtschreibpruefung gebaut wurde —
 * dann bleibt es dabei, statt den Start abzubrechen.
 */
export function setzePruefsprache(session: Session, language: Language, wahl: Rechtschreibwahl = 'auto'): void {
  try {
    session.setSpellCheckerEnabled(wahl !== 'off');
    if (wahl === 'off') return;
    session.setSpellCheckerLanguages([pruefsprache(wahl === 'auto' ? language : wahl)]);
  } catch (fehler) {
    console.warn('[backstory] Rechtschreibsprache liess sich nicht setzen:', fehler);
  }
}

/**
 * Haengt die Pruefung an eine Ansicht.
 *
 * Aufgerufen von beiden Wegen: der eigenstaendigen Anwendung und der Huelle.
 * Ohne das Weiterreichen bliebe der Rechtsklick auf ein angestrichenes Wort
 * folgenlos.
 */
export function richteRechtschreibungEin(
  webContents: WebContents,
  language: Language,
  wahl: Rechtschreibwahl = 'auto'
): void {
  // Fuer den Rauchtest: er hat keine echte Rechtschreibpruefung zur Hand
  // (die Woerterbuecher laedt Chromium erst nach), kann so aber den Weg von
  // hier bis ins Menue pruefen.
  const probewort = process.env.BACKSTORY_SMOKE_SPELL;
  if (probewort) {
    webContents.on('context-menu', (_ereignis, params) => {
      if (webContents.isDestroyed()) return;
      webContents.send(channel('app:rechtschreibung'), {
        x: params.x,
        y: params.y,
        wort: probewort,
        vorschlaege: ['Falkenhand', 'Falkenhandel']
      } satisfies RechtschreibTreffer);
    });
    return;
  }

  setzePruefsprache(webContents.session, language, wahl);

  webContents.on('context-menu', (_ereignis, params) => {
    if (!params.misspelledWord) return;
    if (webContents.isDestroyed()) return;

    const treffer: RechtschreibTreffer = {
      x: params.x,
      y: params.y,
      wort: params.misspelledWord,
      vorschlaege: params.dictionarySuggestions ?? []
    };
    webContents.send(channel('app:rechtschreibung'), treffer);
  });
}
