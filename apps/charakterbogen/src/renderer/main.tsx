import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@suite/motion/motion.css';
// Freie Schriften fuer das Aussehen der Boegen (OFL, siehe SCHRIFTEN.md). Nur Latin.
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/cinzel/latin-400.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/medievalsharp/latin-400.css';
import '@fontsource/uncial-antiqua/latin-400.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-700.css';
import './styles.css';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
