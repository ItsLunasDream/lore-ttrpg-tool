// Sammelpunkt fuer die Tests: buendelt die reinen Logikmodule ohne Oberflaeche.
export {
  BAUSTEINE,
  FRIST_CHANCE,
  LEERER_ENTWURF,
  erzeugeAufhaenger,
  erzeugeEntwurf,
  erzeugeFigur,
  erzeugeFraktion,
  erzeugeName,
  erzeugeOrt,
  AUSSTATTUNGSSTUECKE,
  erzeugeFrist,
  erzeugeVerbindung,
  erzeugeVerbindungen,
  erzeugeZeitstrahl,
  mitFreiemNamen,
  vergebeneNamen,
  ersetzeFigur,
  fuegeFigurHinzu,
  benenneFigurUm,
  moeglichkeiten
} from '../src/shared/erzeuge';
export {
  MENGEN,
  MINDESTAUSWAHL,
  REGIONEN,
  STANDARD_ZUSCHNITT,
  THEMEN,
  TONFALL,
  UMFAENGE,
  passend,
  text,
  REGION_TEXTE,
  THEMA_TEXTE,
  TONFALL_TEXTE,
  UMFANG_TEXTE,
  alsRegionId,
  alsThemaId,
  alsTonfallId
} from '../src/shared/tabellen';
export { AUSLOESER, BETROFFENE, FRISTEN, KOMPLIKATIONEN } from '../src/shared/haken';
export {
  FRAKTION_ART,
  FRAKTION_FORM,
  FRAKTION_MITTEL,
  FRAKTION_SCHWAECHE,
  FRAKTION_ZIEL,
  FRAKTION_ZUSATZ
} from '../src/shared/fraktionen';
export { HEBEL, MAKEL, ROLLEN, RUFNAMEN, TRIEBFEDERN } from '../src/shared/figuren';
export {
  NAME_ERSTE,
  NAME_ZWEITE,
  ORT_ART,
  ORT_AUSSTATTUNG,
  ORT_KARTE,
  ORT_MERKMAL,
  ORT_ZUSTAND
} from '../src/shared/orte';
export { VERBINDUNGEN, fuelle } from '../src/shared/verbindungen';
export { SCHRITTE, ZEITMARKEN } from '../src/shared/zeitstrahl';
export {
  alsKartennotizen,
  alsMarkdown,
  alsNotizen,
  ausstattungsstuecke,
  verbindungenVon,
  verweis
} from '../src/shared/notizen';
export { kanal, PRAEFIX } from '../src/shared/kanaele';
export { baueEntwurf } from '../src/shared/uebernahme';
export {
  KI_AUFGABEN,
  FELDER,
  MAX_ZEICHEN,
  systemAnweisung,
  anweisung,
  nurFestgehaltenes,
  uebernehmbar,
  uebernehmbarerEntwurf
} from '../src/shared/kiAufgaben';
export { berechneGeflecht, beschriftung, KNOTEN_RADIUS, RAND } from '../src/shared/geflecht';
