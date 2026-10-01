import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ZustandslisteGeber } from './zustandsliste';
// Vor den eigenen Stilen: die Anwendung ueberschreibt darin einzelne Farben
// des Pakets, und was zuletzt kommt, gewinnt.
import '@suite/motion/motion.css';
import './styles.css';
import { installierePfeile } from '@suite/tastatur';

// Pfeiltasten in Listen und Kacheln (data-pfeile), siehe packages/tastatur.
installierePfeile();

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('#root fehlt in index.html');

createRoot(wurzel).render(
  <StrictMode>
    <ZustandslisteGeber>
      <App />
    </ZustandslisteGeber>
  </StrictMode>
);
