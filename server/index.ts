/**
 * Serveur maison : lance-le avec « npm start » sur le PC.
 * - https://<nom-du-pc>.local:8443 : l'application (PC, iPhone…), la synchro et les notifications
 * - http://<nom-du-pc>.local:8080  : page d'installation pour l'iPhone (certificat à installer)
 */
import { createServer as createHttps } from 'node:https';
import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { apiMiddleware } from './api';
import { ensureCerts } from './certs';
import { HTTPS_PORT, HTTP_PORT, lanIps, localHostname, serverUrls } from './network';
import { startNotifier } from './notifier';
import { DATA_DIR } from './store';

const DIST = path.resolve(process.cwd(), 'dist');
if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('Application non construite : lance « npm start » (qui construit puis démarre), ou « npm run build ».');
  process.exit(1);
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'https://local');
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file);
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // Les fichiers « assets » ont un nom unique par version : cache long. Le reste : toujours revalider.
  res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
  createReadStream(file).pipe(res);
}

const host = localHostname();
const ips = lanIps();
const { key, cert, caPath } = ensureCerts([host, 'localhost'], ['127.0.0.1', ...ips]);

createHttps({ key, cert }, (req, res) => {
  apiMiddleware(req, res, () => serveStatic(req, res));
}).listen(HTTPS_PORT, '0.0.0.0');

// Page d'installation (HTTP simple, uniquement pour télécharger le certificat avant de lui faire confiance)
createHttp((req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (url.pathname === '/ca.crt') {
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="gestion-budget-ca.crt"');
    return res.end(readFileSync(caPath));
  }
  const app = `https://${host}:${HTTPS_PORT}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Installer Mon budget</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:34rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#0f172a}a.b{display:block;text-align:center;background:#4f46e5;color:#fff;padding:.9rem;border-radius:.8rem;text-decoration:none;font-weight:600;margin:.8rem 0}li{margin:.6rem 0}small{color:#64748b}</style></head><body>
<h1>💶 Installer Mon budget sur l'iPhone</h1>
<ol>
<li><a class="b" href="/ca.crt">1. Télécharger le certificat</a> Safari affiche « Profil téléchargé » → <b>Fermer</b>.</li>
<li>Ouvre <b>Réglages</b> → <b>Profil téléchargé</b> (en haut) → <b>Installer</b> (code de l'iPhone).</li>
<li><b>Réglages → Général → Informations → Réglages des certificats</b> → active <b>Gestion Budget - autorité locale</b>.</li>
<li><a class="b" href="${app}">2. Ouvrir l'application</a> puis <b>Partager</b> ⬆️ → <b>Sur l'écran d'accueil</b>.</li>
<li>Ouvre l'appli depuis l'écran d'accueil, entre le <b>code d'appairage</b> affiché sur le PC (Réglages → Téléphone), puis active les notifications.</li>
</ol>
<p><small>Ce certificat ne sert qu'à sécuriser la connexion entre ton iPhone et ton PC (${host}). Il ne donne accès à rien d'autre.</small></p>
</body></html>`);
}).listen(HTTP_PORT, '0.0.0.0');

startNotifier();

const urls = serverUrls();
console.log(`
💶 Mon budget — serveur maison démarré
   Application  : ${urls.app.join('  ou  ')}
   Sur ce PC    : https://localhost:${HTTPS_PORT}
   Installation iPhone : ${urls.setup}
   Données du serveur  : ${DATA_DIR}
   (Ctrl + C pour arrêter. Les notifications ne partent que si ce serveur tourne.)
`);
