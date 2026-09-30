import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@suite/motion/motion.css';
import './styles.css';
import { installierePfeile } from '@suite/tastatur';

// Pfeiltasten in Listen und Kacheln (data-pfeile), siehe packages/tastatur.
installierePfeile();

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('#root fehlt in index.html');

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>
);


// Der Vorversuch unter spike/spike3d.ts wird bewusst NICHT eingebunden.
// Waehrend der Messung stand hier ein Import, und das Buendel wuchs von
// 157 kB auf 708 kB — das ist der Preis von three.js und cannon-es, und den
// zahlt die Anwendung erst, wenn die 3D-Darstellung wirklich da ist. Die
// Datei bleibt liegen, ihre Typen werden weiter geprueft.
