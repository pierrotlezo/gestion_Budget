import type { Plugin } from 'vite';
import { apiMiddleware } from './api';

/** Branche l'API du serveur maison sur le serveur de développement Vite (npm run dev). */
export function budgetApi(): Plugin {
  return {
    name: 'gestion-budget-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void apiMiddleware(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void apiMiddleware(req, res, next));
    },
  };
}
