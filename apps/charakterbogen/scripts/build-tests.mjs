import { build } from 'esbuild';

/**
 * Buendelt tests/entry.ts zu einem CommonJS-Modul, damit node --test es ohne
 * TypeScript-Unterstuetzung laden kann. Gleiches Vorgehen wie in
 * apps/backstory/scripts/build-tests.mjs.
 */
await build({
  entryPoints: ['tests/entry.ts'],
  outfile: 'dist/tests/entry.cjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true
});
