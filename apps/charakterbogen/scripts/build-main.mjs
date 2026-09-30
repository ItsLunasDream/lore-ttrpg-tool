import { build } from 'esbuild';

/**
 * Haupt- und Preload-Prozess vollstaendig buendeln, nur `electron` bleibt
 * aussen vor. Gleiches Vorgehen wie in den anderen Werkzeugen: das fertige
 * Paket braucht dadurch kein node_modules.
 */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  external: ['electron']
};

await build({ ...shared, entryPoints: ['src/main/embed.ts'], outfile: 'dist/main/embed.js' });
await build({ ...shared, entryPoints: ['src/preload/index.ts'], outfile: 'dist/main/preload.js' });

console.log('charakterbogen: main + preload gebaut');
