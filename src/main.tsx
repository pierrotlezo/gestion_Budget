import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initTheme } from './app/theme';
import { startAutoSync } from './services/sync';
import './index.css';

initTheme();
startAutoSync();

// Appli installable + notifications : le service worker n'est utilisé que dans la version construite
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
