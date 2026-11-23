import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Proxy local vers les fournisseurs de cours (le navigateur ne peut pas les appeler directement).
 * Seuls les symboles des placements (ex. « CW8.PA », « bitcoin ») et les noms de flux de bons plans
 * transitent, jamais tes montants ni tes opérations.
 */
const target = (url: string, prefix: string) => ({
  target: url,
  changeOrigin: true,
  secure: true,
  rewrite: (p: string) => p.replace(prefix, ''),
  headers: { 'User-Agent': 'Mozilla/5.0' }, // générique : ne révèle rien de ta machine
  // On ne transmet ni cookies, ni page d'origine : uniquement la requête de cours.
  configure: (p: { on: (ev: 'proxyReq', cb: (req: { removeHeader: (h: string) => void }) => void) => void }) =>
    p.on('proxyReq', (req) => ['cookie', 'referer', 'origin'].forEach((h) => req.removeHeader(h))),
});
const proxy = {
  '/api/yahoo1': target('https://query1.finance.yahoo.com', '/api/yahoo1'),
  '/api/yahoo2': target('https://query2.finance.yahoo.com', '/api/yahoo2'),
  '/api/coingecko': target('https://api.coingecko.com', '/api/coingecko'),
  // Bons plans : téléchargement des flux RSS publics (rien n'est envoyé)
  '/api/dealabs': target('https://www.dealabs.com', '/api/dealabs'),
};

// Le serveur n'écoute que sur la machine locale : rien n'est exposé sur le réseau.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, proxy },
  preview: { host: '127.0.0.1', port: 4173, proxy },
  // Application locale : un seul fichier JS d'environ 600 Ko est sans importance
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
