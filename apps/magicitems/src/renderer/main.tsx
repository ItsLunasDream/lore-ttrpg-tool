import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@suite/motion/motion.css';
import '@suite/magie/formular.css';
import './styles.css';
import { installierePfeile } from '@suite/tastatur';

// Pfeiltasten in Listen und Kacheln (data-pfeile), siehe packages/tastatur.
installierePfeile();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
