import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
// Vor der eigenen Stilvorlage: die Zeiten und Kurven der Sammlung stehen
// darin, und die eigenen Farben ueberschreiben sie danach.
import '@suite/motion/motion.css';
import './styles.css';
import { installierePfeile } from '@suite/tastatur';

// Pfeiltasten in Listen und Kacheln (data-pfeile), siehe packages/tastatur.
installierePfeile();

const container = document.getElementById('root');
if (!container) throw new Error('Root-Element fehlt.');

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
