/**
 * Welche Groessentaste zu Strg+Alt gedrueckt ist, oder null.
 *
 * Auf deutschen Tastaturen ist Strg+Alt dasselbe wie AltGr, und AltGr+Plus
 * liefert „~“ (AltGr+0 liefert „}“). Deshalb zaehlen neben dem Zeichen auch
 * die Tastencodes und diese AltGr-Zeichen; sonst ging Strg+Alt+Plus nicht,
 * Minus und 0 aber schon (Testbericht).
 */
export function groessenTaste(key: string, code = ''): 'groesser' | 'kleiner' | 'zurueck' | null {
  if (key === '+' || key === '=' || key === '~' || code === 'NumpadAdd' || code === 'Equal' || (code === 'BracketRight' && key !== ']')) {
    return 'groesser';
  }
  if (key === '-' || code === 'NumpadSubtract' || code === 'Minus' || code === 'Slash') return 'kleiner';
  if (key === '0' || key === '}' || code === 'Digit0' || code === 'Numpad0') return 'zurueck';
  return null;
}
