// Sammelpunkt fuer die Tests: buendelt die reinen Logikmodule ohne Electron
// und ohne Oberflaeche.
export {
  leererKampf,
  neuerTeilnehmer,
  neuesTerrain,
  TERRAIN_INITIATIVE,
  neuerKoerper,
  reihenfolge,
  istAktiv,
  beginne,
  naechsterZug,
  aendereHp,
  setzeHp,
  dupliziere,
  naechsterName,
  setzeGruppengroesse,
  setzeZustand,
  entferneZustand,
  entferneTeilnehmer,
  fuegeEin,
  neueId,
  sortiereNeu
} from '../src/shared/kampf';
export {
  schreibeBegegnung,
  leseBegegnung,
  zuId,
  istGueltigeId,
  leseSchaden
} from '../src/shared/format';
export { Ablage } from '../src/main/ablage';
export {
  leererVerlauf,
  merke,
  kannZurueck,
  kannVor,
  zurueck,
  vor,
  VERLAUF_TIEFE
} from '../src/shared/verlauf';
export { finde, passt, heuhaufen, treffendeTeilnehmer } from '../src/shared/suche';
export { pruefeVerlust, nichtsZuVerlieren, alsVorlage, speicherZiel } from '../src/shared/neuebegegnung';
export { alsTeilnehmer, alsTaktik } from '../src/shared/uebernahme';
export { teileKampf, stufe, leseBotschaft, wendeAn, setzeBesitz } from '../src/shared/teilen';
export { uebernimmFiguren, tpAenderungen, leseFiguren } from '../src/shared/boegen';
