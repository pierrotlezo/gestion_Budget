import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { budgetApi } from './server/vite-plugin';

/**
 * Les appels /api (cours, bons plans, synchro, notifications) sont traités par l'API du serveur maison
 * (server/api.ts), branchée ici pour le développement. Seuls les symboles des placements et les noms
 * de flux publics transitent vers Internet, jamais tes montants ni tes opérations.
 */
// Le serveur n'écoute que sur la machine locale : rien n'est exposé sur le réseau.
export default defineConfig({
  plugins: [react(), tailwindcss(), budgetApi()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  // Application locale : un seul fichier JS d'environ 600 Ko est sans importance
  build: { chunkSizeWarningLimit: 1000 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
