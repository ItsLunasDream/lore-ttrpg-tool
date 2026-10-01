/**
 * Eichung von Zaubern am SRD 5.2.1 (docs/homebrew-creator.md).
 *
 * Ein offizielles Richtwertblatt fuer Zauberschaden habe ich im SRD 5.2.1
 * nicht gefunden. Die Eichung kommt deshalb aus den Zaubern selbst: von Hand
 * gewaehlte Zauber, die sofort Schaden machen (keine Konzentration, kein
 * Schaden ueber Runden als Hauptsache), mit dem Schaden bei misslungenem
 * Rettungswurf bzw. Treffer, alle Teile zusammen (Eissturm 2W10 + 4W6).
 * Die Test-Datei prueft jeden Punkt am Wortlaut des SRD.
 *
 * Fuer einen Grad ohne Punkt wird zwischen den Nachbarn gemittelt. Spielraum:
 * 25 % ueber dem hoechsten Vergleich ist „stärker", 60 % „deutlich stärker".
 * Diese Grenzen sind eine Schaetzung, keine Regel; das sagt die Oberflaeche.
 */
import type { Paar } from '@suite/srd';
import { ZAUBER } from '@suite/srd/zauber';
import type { Zauber } from './modell';
import type { Befund, Urteil } from './eichung';

export type Zielart = 'einzel' | 'flaeche';

export interface Zauberpunkt {
  readonly id: string;
  readonly grad: number;
  readonly ziel: Zielart;
  /** Die Wuerfel, wie im SRD-Text (alle Teile), z. B. ["2d10", "4d6"]. */
  readonly wuerfel: readonly string[];
  /** Festes Plus (Aufloesung: 10W6 + 40). */
  readonly plus?: number;
  /** Mal so viele (Sengender Strahl: drei Strahlen). */
  readonly mal?: number;
}

export const ZAUBERPUNKTE: readonly Zauberpunkt[] = [
  // Zaubertricks
  { id: 'fire-bolt', grad: 0, ziel: 'einzel', wuerfel: ['1d10'] },
  { id: 'eldritch-blast', grad: 0, ziel: 'einzel', wuerfel: ['1d10'] },
  { id: 'chill-touch', grad: 0, ziel: 'einzel', wuerfel: ['1d10'] },
  { id: 'poison-spray', grad: 0, ziel: 'einzel', wuerfel: ['1d12'] },
  { id: 'ray-of-frost', grad: 0, ziel: 'einzel', wuerfel: ['1d8'] },
  { id: 'sacred-flame', grad: 0, ziel: 'einzel', wuerfel: ['1d8'] },
  { id: 'vicious-mockery', grad: 0, ziel: 'einzel', wuerfel: ['1d6'] },
  { id: 'acid-splash', grad: 0, ziel: 'flaeche', wuerfel: ['1d6'] },
  // Grad 1
  { id: 'guiding-bolt', grad: 1, ziel: 'einzel', wuerfel: ['4d6'] },
  { id: 'inflict-wounds', grad: 1, ziel: 'einzel', wuerfel: ['2d10'] },
  { id: 'ray-of-sickness', grad: 1, ziel: 'einzel', wuerfel: ['2d8'] },
  { id: 'chromatic-orb', grad: 1, ziel: 'einzel', wuerfel: ['3d8'] },
  { id: 'hellish-rebuke', grad: 1, ziel: 'einzel', wuerfel: ['2d10'] },
  { id: 'dissonant-whispers', grad: 1, ziel: 'einzel', wuerfel: ['3d6'] },
  { id: 'burning-hands', grad: 1, ziel: 'flaeche', wuerfel: ['3d6'] },
  { id: 'thunderwave', grad: 1, ziel: 'flaeche', wuerfel: ['2d8'] },
  // Grad 2
  { id: 'scorching-ray', grad: 2, ziel: 'einzel', wuerfel: ['2d6'], mal: 3 },
  { id: 'acid-arrow', grad: 2, ziel: 'einzel', wuerfel: ['4d4'] },
  { id: 'shatter', grad: 2, ziel: 'flaeche', wuerfel: ['3d8'] },
  // Grad 3
  { id: 'fireball', grad: 3, ziel: 'flaeche', wuerfel: ['8d6'] },
  { id: 'lightning-bolt', grad: 3, ziel: 'flaeche', wuerfel: ['8d6'] },
  // Grad 4
  { id: 'blight', grad: 4, ziel: 'einzel', wuerfel: ['8d8'] },
  { id: 'ice-storm', grad: 4, ziel: 'flaeche', wuerfel: ['2d10', '4d6'] },
  { id: 'vitriolic-sphere', grad: 4, ziel: 'flaeche', wuerfel: ['10d4'] },
  // Grad 5
  { id: 'cone-of-cold', grad: 5, ziel: 'flaeche', wuerfel: ['8d8'] },
  { id: 'flame-strike', grad: 5, ziel: 'flaeche', wuerfel: ['5d6', '5d6'] },
  { id: 'contagion', grad: 5, ziel: 'einzel', wuerfel: ['11d8'] },
  // Grad 6
  { id: 'disintegrate', grad: 6, ziel: 'einzel', wuerfel: ['10d6'], plus: 40 },
  { id: 'harm', grad: 6, ziel: 'einzel', wuerfel: ['14d6'] },
  { id: 'chain-lightning', grad: 6, ziel: 'einzel', wuerfel: ['10d8'] },
  { id: 'circle-of-death', grad: 6, ziel: 'flaeche', wuerfel: ['8d8'] },
  { id: 'freezing-sphere', grad: 6, ziel: 'flaeche', wuerfel: ['10d6'] },
  // Grad 7
  { id: 'finger-of-death', grad: 7, ziel: 'einzel', wuerfel: ['7d8'], plus: 30 },
  { id: 'fire-storm', grad: 7, ziel: 'flaeche', wuerfel: ['7d10'] },
  // Grad 8
  { id: 'befuddlement', grad: 8, ziel: 'einzel', wuerfel: ['10d12'] },
  { id: 'sunburst', grad: 8, ziel: 'flaeche', wuerfel: ['12d6'] },
  // Grad 9
  { id: 'meteor-swarm', grad: 9, ziel: 'flaeche', wuerfel: ['20d6', '20d6'] }
];

function schnittVon(w: string): number {
  const [a, s] = w.split('d').map(Number);
  return (a * (s + 1)) / 2;
}

export function punktSchnitt(p: Zauberpunkt): number {
  return (p.wuerfel.reduce((s, w) => s + schnittVon(w), 0) + (p.plus ?? 0)) * (p.mal ?? 1);
}

export const STARK = 1.25;
export const SEHR_STARK = 1.6;

/** Das Band fuer Grad und Zielart; `ohne` laesst einen Punkt aus (Leave-one-out). */
export function zauberBand(grad: number, ziel: Zielart, ohne?: string): { lo: number; hi: number; vergleich: Zauberpunkt[]; gemittelt: boolean } {
  const punkte = ZAUBERPUNKTE.filter((p) => p.ziel === ziel && p.id !== ohne);
  const bei = (g: number) => punkte.filter((p) => p.grad === g);
  const eigene = bei(grad);
  if (eigene.length) {
    const s = eigene.map(punktSchnitt);
    return { lo: Math.min(...s), hi: Math.max(...s), vergleich: eigene, gemittelt: false };
  }
  // Naechster Grad darunter und darueber; fehlt einer, gilt der andere.
  let unten = grad - 1;
  while (unten >= 0 && !bei(unten).length) unten -= 1;
  let oben = grad + 1;
  while (oben <= 9 && !bei(oben).length) oben += 1;
  const grenzen = (g: number) => {
    const s = bei(g).map(punktSchnitt);
    return { lo: Math.min(...s), hi: Math.max(...s) };
  };
  if (unten < 0 && oben > 9) return { lo: 0, hi: Infinity, vergleich: [], gemittelt: true };
  if (unten < 0) return { ...grenzen(oben), vergleich: bei(oben), gemittelt: true };
  if (oben > 9) return { ...grenzen(unten), vergleich: bei(unten), gemittelt: true };
  const a = grenzen(unten);
  const b = grenzen(oben);
  const f = (grad - unten) / (oben - unten);
  return {
    lo: a.lo + (b.lo - a.lo) * f,
    hi: a.hi + (b.hi - a.hi) * f,
    vergleich: [...bei(unten), ...bei(oben)],
    gemittelt: true
  };
}

export function urteilZauber(grad: number, ziel: Zielart, schnitt: number, ohne?: string): Urteil {
  const b = zauberBand(grad, ziel, ohne);
  if (schnitt > b.hi * SEHR_STARK) return 'weit_ueber';
  if (schnitt > b.hi * STARK) return 'ueber';
  if (schnitt < b.lo / STARK) return 'unter';
  return 'im_rahmen';
}

function name(id: string, s: 'de' | 'en'): string {
  return ZAUBER.find((z) => z.id === id)?.name[s] ?? id;
}

function zahl(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.0', '');
}

export interface ZauberEichung {
  readonly urteil: Urteil | null;
  readonly satz: Paar;
  readonly befunde: readonly Befund[];
}

export function eicheZauber(z: Zauber): ZauberEichung {
  const befunde: Befund[] = [];
  const hin = (de: string, en: string) => befunde.push({ stufe: 'hinweis', text: { de, en } });
  const warn = (de: string, en: string) => befunde.push({ stufe: 'warnung', text: { de, en } });
  if (z.konzentration && /^(unmittelbar|instantaneous)/i.test(z.dauer.trim()))
    warn('Konzentration bei „Unmittelbar" ergibt keinen Sinn.', 'Concentration with an “Instantaneous” duration makes no sense.');
  if (z.rettungswurf && z.angriffswurf) hin('Rettungswurf und Angriffswurf zugleich ist im SRD selten.', 'A saving throw and an attack roll together is rare in the SRD.');
  if (z.wirkungen.includes('heilung') && z.heilAnzahl) {
    const heil = (z.heilAnzahl * (z.heilSeiten + 1)) / 2 + z.heilPlus;
    hin(
      `Heilung im Schnitt ${zahl(heil)} (ohne Attributsmodifikator). Zum Vergleich im SRD 5.2: Wunden heilen 2W8, Heilendes Wort 2W4, je plus Modifikator.`,
      `Average healing ${zahl(heil)} (without ability modifier). For comparison in SRD 5.2: Cure Wounds 2d8, Healing Word 2d4, each plus modifier.`
    );
  }
  if (z.wirkungen.includes('zustand'))
    hin(
      'Zustände lassen sich nicht in Zahlen eichen. Vergleiche mit SRD-Zaubern, die denselben Zustand verursachen (z. B. Person festhalten: Gelähmt, Grad 2).',
      'Conditions cannot be calibrated in numbers. Compare with SRD spells that cause the same condition (e.g. Hold Person: Paralyzed, level 2).'
    );
  if (!z.wirkungen.includes('schaden') || !z.schadenAnzahl) {
    return {
      urteil: null,
      satz: {
        de: 'Ohne Schaden lässt sich ein Zauber kaum eichen. Vergleiche ihn mit SRD-Zaubern desselben Grads und derselben Schule im Nachschlagewerk.',
        en: 'A spell without damage can hardly be calibrated. Compare it with SRD spells of the same level and school in the Reference.'
      },
      befunde
    };
  }
  const ziel: Zielart = z.ziel === 'flaeche' ? 'flaeche' : 'einzel';
  const schnitt = (z.schadenAnzahl * (z.schadenSeiten + 1)) / 2 + z.schadenPlus;
  const band = zauberBand(z.grad, ziel);
  const urteil = urteilZauber(z.grad, ziel, schnitt);
  const namen = (s: 'de' | 'en') => band.vergleich.map((p) => `${name(p.id, s)} ${zahl(punktSchnitt(p))}`).join(', ');
  const bandText = band.lo === band.hi ? zahl(band.lo) : `${zahl(band.lo)}–${zahl(band.hi)}`;
  const art = (s: 'de' | 'en') => (ziel === 'flaeche' ? (s === 'de' ? 'Flächenzauber' : 'area spells') : s === 'de' ? 'Zauber auf ein Ziel' : 'single-target spells');
  const grad = (s: 'de' | 'en') => (z.grad === 0 ? (s === 'de' ? 'Zaubertricks' : 'cantrips') : s === 'de' ? `Grad ${z.grad}` : `level ${z.grad}`);
  const gemittelt = (s: 'de' | 'en') => (band.gemittelt ? (s === 'de' ? ' (gemittelt aus den Nachbargraden)' : ' (averaged from neighbouring levels)') : '');
  const satz: Paar = {
    de: `Schaden im Schnitt ${zahl(schnitt)}. ${art('de')}, ${grad('de')}: ${bandText}${gemittelt('de')}. Vergleich: ${namen('de')}.`,
    en: `Average damage ${zahl(schnitt)}. ${art('en')}, ${grad('en')}: ${bandText}${gemittelt('en')}. Compared with: ${namen('en')}.`
  };
  if (z.ziel === 'mehrere') hin('Mehrere Ziele: verglichen wird der Schaden je Ziel mit Zaubern auf ein Ziel.', 'Several targets: damage per target is compared with single-target spells.');
  if (z.konzentration)
    hin(
      'Konzentration: verglichen wird mit Zaubern ohne Konzentration. Macht der Zauber jede Runde Schaden, ist er stärker, als die Zahl sagt.',
      'Concentration: compared with spells without concentration. If it deals damage every round, it is stronger than the number suggests.'
    );
  if (ziel === 'flaeche' && z.rettungswurf && !z.halbBeiErfolg)
    hin('Flächenzauber mit Rettungswurf machen im SRD meist halben Schaden bei Erfolg.', 'Area spells with a saving throw usually deal half damage on a success in the SRD.');
  if (!z.rettungswurf && !z.angriffswurf) hin('Weder Rettungs- noch Angriffswurf: der Schaden trifft sicher.', 'Neither a saving throw nor an attack roll: the damage always lands.');
  return { urteil, satz, befunde };
}
