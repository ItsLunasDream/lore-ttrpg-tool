/**
 * Die Kopfzeile einer Vorschau im Teilen, in der eingestellten Sprache.
 *
 * Die Dateien der Werkzeuge tragen ihre Eigenschaften im YAML-Kopf, mit
 * deutschen Schluesseln und Kennungen (`einstimmung: ja`, `thema: untot`).
 * Roh gezeigt waere das bei Englisch halb deutsch. Hier werden die
 * bekannten Felder in lesbare Worte der Sprache uebersetzt; was nicht
 * bekannt ist, bleibt weg, statt roh zu erscheinen.
 *
 * Grenze: Was jemand selbst in den Text geschrieben hat, bleibt, wie es ist.
 */
import { SELTENHEIT_NAME, type Seltenheit } from '@suite/srd';
import { ART_NAME, type Art as GegenstandsArt } from '@suite/magie/tabellen';
import { ROLLEN, THEMEN as MONSTERTHEMEN } from '../../../monster/src/shared/tabellen';
import { ARTEN as ZUSTANDSARTEN, HAERTEN, THEMEN as ZUSTANDSTHEMEN } from '../../../zustaende/src/shared/tabellen';

type Sprache = 'de' | 'en';
type Kopf = Readonly<Record<string, string>>;

const ja = (wert: string | undefined) => wert === 'ja' || wert === 'true';
const nach = <T extends { id: string; name: { de: string; en: string } }>(liste: readonly T[], id: string | undefined, sprache: Sprache) =>
  liste.find((x) => x.id === id)?.name[sprache];

/** Die Zeilen ueber dem Text; leer, wenn es fuer das Werkzeug nichts gibt. */
export function kopfzeilen(werkzeug: string, kopf: Kopf, sprache: Sprache): string[] {
  const de = sprache === 'de';
  const zeile = (...teile: (string | undefined | false)[]) => teile.filter(Boolean).join(' · ');
  switch (werkzeug) {
    case 'magicitems': {
      const art = ART_NAME[kopf.art as GegenstandsArt]?.[sprache];
      const seltenheit = SELTENHEIT_NAME[kopf.seltenheit as Seltenheit]?.[sprache];
      return [
        zeile(
          art,
          seltenheit,
          ja(kopf.einstimmung) && (de ? 'Einstimmung nötig' : 'Requires attunement'),
          kopf.wert && `${kopf.wert} ${de ? 'GM' : 'gp'}`
        )
      ];
    }
    case 'loot':
      return [
        zeile(kopf.wuerfel && `${de ? 'Würfel' : 'Die'} ${kopf.wuerfel}`, ja(kopf.ohneZuruecklegen) && (de ? 'ohne Zurücklegen' : 'without replacement'))
      ];
    case 'monster':
      return [
        zeile(
          kopf.cr && `${de ? 'HG' : 'CR'} ${kopf.cr}`,
          nach(MONSTERTHEMEN, kopf.thema, sprache),
          nach(ROLLEN, kopf.rolle, sprache)
        ),
        zeile(kopf.tp && `${de ? 'TP' : 'HP'} ${kopf.tp}`, kopf.rk && `${de ? 'RK' : 'AC'} ${kopf.rk}`)
      ];
    case 'zustaende':
      return [
        zeile(
          nach(ZUSTANDSARTEN, kopf.art, sprache),
          nach(ZUSTANDSTHEMEN, kopf.thema, sprache),
          nach(HAERTEN, kopf.haerte, sprache),
          kopf.stufen && Number(kopf.stufen) > 1 && `${kopf.stufen} ${de ? 'Stufen' : 'stages'}`
        )
      ];
    default:
      return [];
  }
}

/** Ueberschriften im Text, die ein Werkzeug fest auf Deutsch schreibt. */
const UEBERSCHRIFTEN: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  magicitems: { Wirkungen: 'Properties', Fluch: 'Curse', Notiz: 'Notes' },
  loot: { Notiz: 'Notes' }
};

export function uebersetzeUeberschriften(werkzeug: string, rumpf: string, sprache: Sprache): string {
  const tabelle = UEBERSCHRIFTEN[werkzeug];
  if (sprache === 'de' || !tabelle) return rumpf;
  return rumpf.replace(/^(#{1,6}\s+)(.+?)\s*$/gm, (ganz, raute: string, titel: string) =>
    tabelle[titel] ? `${raute}${tabelle[titel]}` : ganz
  );
}
