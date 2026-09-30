/**
 * Aussehen eines Bogens: Akzentfarbe, Papier und Schrift. Je Bogen
 * gespeichert (`Bogen.design`), fehlt es, gilt die Vorgabe. Die Werte hier
 * sind nur Kennungen und Farben; die Schriften liefert die Oberflaeche mit
 * (freie OFL-Schriften ueber @fontsource).
 */
import type { Design } from './bogen';

export interface Farbe {
  readonly id: string;
  readonly name: readonly [string, string];
  /** Akzent auf hellem und auf dunklem Papier. */
  readonly hell: string;
  readonly dunkel: string;
}

export const FARBEN: readonly Farbe[] = [
  { id: 'rot', name: ['Rot', 'Red'], hell: '#8b1e1e', dunkel: '#e0605a' },
  { id: 'blau', name: ['Blau', 'Blue'], hell: '#1f4e8c', dunkel: '#6ea2e8' },
  { id: 'gruen', name: ['Grün', 'Green'], hell: '#2d6a36', dunkel: '#6cc27a' },
  { id: 'violett', name: ['Violett', 'Violet'], hell: '#5b2d8c', dunkel: '#b48ae6' },
  { id: 'gold', name: ['Gold', 'Gold'], hell: '#8a6412', dunkel: '#e2b64a' },
  { id: 'tuerkis', name: ['Türkis', 'Teal'], hell: '#12696b', dunkel: '#4fc4c0' },
  { id: 'rosa', name: ['Rosa', 'Rose'], hell: '#9a2d62', dunkel: '#ec7fb0' },
  { id: 'braun', name: ['Braun', 'Brown'], hell: '#6b4226', dunkel: '#c99a6e' },
  { id: 'grau', name: ['Grau', 'Slate'], hell: '#3d4652', dunkel: '#a3adbb' },
  { id: 'schwarz', name: ['Tinte', 'Ink'], hell: '#1d1d1d', dunkel: '#e8e2d4' }
];

export interface Papier {
  readonly id: string;
  readonly name: readonly [string, string];
  readonly dunkel: boolean;
  /** Grund, Kasten, Text, Linie. */
  readonly grund: string;
  readonly kasten: string;
  readonly text: string;
  readonly linie: string;
}

export const PAPIERE: readonly Papier[] = [
  { id: 'pergament', name: ['Pergament', 'Parchment'], dunkel: false, grund: '#efe3c8', kasten: '#faf3e2', text: '#2b2118', linie: '#8a7456' },
  { id: 'hell', name: ['Hell', 'Light'], dunkel: false, grund: '#f3f2ef', kasten: '#ffffff', text: '#1d1d1f', linie: '#9a9aa2' },
  { id: 'leinen', name: ['Leinen', 'Linen'], dunkel: false, grund: '#e7e4dc', kasten: '#f6f4ee', text: '#262420', linie: '#8d877a' },
  { id: 'dunkel', name: ['Dunkel', 'Dark'], dunkel: true, grund: '#1e1f24', kasten: '#2a2c33', text: '#ece9e2', linie: '#6a6d78' },
  { id: 'nacht', name: ['Nacht', 'Night'], dunkel: true, grund: '#131a2a', kasten: '#1c2539', text: '#e4e8f2', linie: '#56627e' },
  { id: 'schiefer', name: ['Schiefer', 'Slate'], dunkel: true, grund: '#23282b', kasten: '#2f3539', text: '#e6ebe9', linie: '#687379' }
];

export interface Schrift {
  readonly id: string;
  readonly name: string;
  /** CSS font-family fuer Ueberschriften und fuer Text. */
  readonly titel: string;
  readonly text: string;
}

const SYSTEM = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const SCHRIFTEN: readonly Schrift[] = [
  { id: 'schlicht', name: 'System', titel: SYSTEM, text: SYSTEM },
  { id: 'buch', name: 'Alegreya', titel: "'Alegreya', Georgia, serif", text: "'Alegreya', Georgia, serif" },
  { id: 'roemisch', name: 'Cinzel', titel: "'Cinzel', Georgia, serif", text: "'Alegreya', Georgia, serif" },
  { id: 'alt', name: 'IM Fell English', titel: "'IM Fell English', Georgia, serif", text: "'IM Fell English', Georgia, serif" },
  { id: 'mittelalter', name: 'MedievalSharp', titel: "'MedievalSharp', Georgia, serif", text: "'Alegreya', Georgia, serif" },
  { id: 'unziale', name: 'Uncial Antiqua', titel: "'Uncial Antiqua', Georgia, serif", text: "'Alegreya', Georgia, serif" },
  { id: 'hand', name: 'Caveat', titel: "'Caveat', cursive", text: "'Caveat', cursive" }
];

export const VORGABE_DESIGN: Design = { farbe: 'rot', papier: 'pergament', schrift: 'roemisch' };

/** Das wirksame Design: Unbekanntes faellt auf die Vorgabe zurueck. */
export function designVon(d: Design | undefined): { farbe: Farbe; papier: Papier; schrift: Schrift } {
  return {
    farbe: FARBEN.find((x) => x.id === d?.farbe) ?? FARBEN.find((x) => x.id === VORGABE_DESIGN.farbe)!,
    papier: PAPIERE.find((x) => x.id === d?.papier) ?? PAPIERE.find((x) => x.id === VORGABE_DESIGN.papier)!,
    schrift: SCHRIFTEN.find((x) => x.id === d?.schrift) ?? SCHRIFTEN.find((x) => x.id === VORGABE_DESIGN.schrift)!
  };
}

/** CSS-Variablen fuer den Bogen. */
export function designVariablen(d: Design | undefined): Record<string, string> {
  const { farbe, papier, schrift } = designVon(d);
  return {
    '--b-akzent': papier.dunkel ? farbe.dunkel : farbe.hell,
    '--b-grund': papier.grund,
    '--b-kasten': papier.kasten,
    '--b-text': papier.text,
    '--b-linie': papier.linie,
    '--b-titel': schrift.titel,
    '--b-schrift': schrift.text
  };
}
