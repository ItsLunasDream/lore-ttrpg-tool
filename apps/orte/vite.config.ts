import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  // Ohne relative Basis verweist das gebaute index.html absolut auf /assets/
  // und laedt unter file:// nichts.
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true
  },
  // Jedes Werkzeug hat seinen eigenen Port: 5173 Story Creator, 5273 Huelle,
  // 5373 Initiative, 5473 NPC und Wuerfel, 5573 Inspiration, 5673 Monster,
  // 5773 Zustaende, 5873 Encounter, 5973 Nachschlagewerk, 6073 Magic Items, 6173 Loot, 6273 Charakterbogen, 6373 Homebrew, 6473 hier.
  server: { port: 6473, strictPort: true }
});
