/**
 * API du serveur maison (utilisée aussi par le serveur de développement Vite) :
 * - /api/yahoo1, /api/yahoo2, /api/coingecko, /api/dealabs : relais vers les fournisseurs de cours et de bons plans
 * - /api/local-deals : bons plans locaux (ville des Réglages)
 * - /api/pair… : appairage des appareils (code à 6 chiffres)
 * - /api/sync : synchronisation des données
 * - /api/push… : notifications
 * Les routes qui touchent à tes données exigent le jeton secret de l'appareil (en-tête x-budget-token).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { emptyState, mergeSync, type SyncRequest, type SyncState } from '../src/domain/sync/merge';
import { FILES, getConfig, readJson, writeJson, type PushSubscriptionRecord } from './store';
import { getLocalDeals } from './deals';
import { serverUrls } from './network';
import { sendToAll } from './notifier';

type Next = (err?: unknown) => void;

const UPSTREAMS: Record<string, string> = {
  '/api/yahoo1/': 'https://query1.finance.yahoo.com/',
  '/api/yahoo2/': 'https://query2.finance.yahoo.com/',
  '/api/coingecko/': 'https://api.coingecko.com/',
  '/api/dealabs/': 'https://www.dealabs.com/',
};

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody<T>(req: IncomingMessage, limit = 30 * 1024 * 1024): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error('Requête trop volumineuse');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as T;
}

const isLoopback = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');

function authorized(req: IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers['x-budget-token'] ?? ''));
  const expected = Buffer.from(getConfig().token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Code d'appairage : 6 chiffres, valable 10 minutes, 5 essais au maximum
let pairing: { code: string; expires: number; attempts: number } | null = null;

export async function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: Next) {
  const url = new URL(req.url ?? '/', 'http://local');
  const p = url.pathname;
  if (!p.startsWith('/api/')) return next();
  try {
    // ── Relais vers les fournisseurs de cours / bons plans ──
    const prefix = Object.keys(UPSTREAMS).find((k) => p.startsWith(k));
    if (prefix) {
      const target = UPSTREAMS[prefix] + p.slice(prefix.length) + url.search;
      // On ne transmet ni cookies ni page d'origine ; User-Agent générique
      const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: String(req.headers.accept ?? '*/*') }, signal: AbortSignal.timeout(20000) });
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    if (p === '/api/health') return send(res, 200, { ok: true, app: 'gestion-budget' });

    if (p === '/api/local-deals') {
      const city = (url.searchParams.get('city') ?? 'Grenoble').slice(0, 60);
      return send(res, 200, { city, deals: await getLocalDeals(city), fetchedAt: new Date().toISOString() });
    }

    // ── Appairage ──
    if (p === '/api/pair/local') {
      // Le navigateur du PC lui-même est appairé automatiquement
      return isLoopback(req) ? send(res, 200, { token: getConfig().token }) : send(res, 403, { error: 'Réservé au PC' });
    }
    if (p === '/api/pair' && req.method === 'POST') {
      const { code } = await readBody<{ code?: string }>(req, 10000);
      if (!pairing || Date.now() > pairing.expires) return send(res, 401, { error: 'Aucun code valide : génère un code sur le PC.' });
      pairing.attempts++;
      if (pairing.attempts > 5) {
        pairing = null;
        return send(res, 401, { error: 'Trop d\'essais : génère un nouveau code sur le PC.' });
      }
      if (String(code ?? '').trim() !== pairing.code) return send(res, 401, { error: 'Code incorrect.' });
      pairing = null;
      return send(res, 200, { token: getConfig().token });
    }

    // ── Routes protégées ──
    if (!authorized(req)) return send(res, 401, { error: 'Appareil non appairé.' });

    if (p === '/api/pair/code' && req.method === 'POST') {
      pairing = { code: String(randomInt(0, 1_000_000)).padStart(6, '0'), expires: Date.now() + 10 * 60 * 1000, attempts: 0 };
      return send(res, 200, { code: pairing.code, expiresAt: pairing.expires });
    }

    if (p === '/api/info') {
      const subs = readJson<PushSubscriptionRecord[]>(FILES.subscriptions, []);
      return send(res, 200, { urls: serverUrls(), devices: subs.map((s) => s.device) });
    }

    if (p === '/api/sync' && req.method === 'POST') {
      const body = await readBody<SyncRequest>(req);
      const now = Date.now();
      const merged = mergeSync(readJson<SyncState>(FILES.state, emptyState()), { lastSyncAt: body.lastSyncAt ?? 0, known: body.known ?? [], tables: body.tables ?? {} }, now);
      writeJson(FILES.state, merged);
      const tables = Object.fromEntries(Object.entries(merged.tables).map(([t, rows]) => [t, Object.values(rows)]));
      return send(res, 200, { tables, serverTime: now, version: merged.version });
    }

    if (p === '/api/push/key') return send(res, 200, { publicKey: getConfig().vapid.publicKey });

    if (p === '/api/push/subscribe' && req.method === 'POST') {
      const { subscription, device } = await readBody<{ subscription: PushSubscriptionRecord; device?: string }>(req, 20000);
      if (!subscription?.endpoint || !subscription.keys?.p256dh) return send(res, 400, { error: 'Abonnement invalide' });
      const subs = readJson<PushSubscriptionRecord[]>(FILES.subscriptions, []).filter((s) => s.endpoint !== subscription.endpoint);
      subs.push({ endpoint: subscription.endpoint, keys: subscription.keys, device: (device ?? 'Appareil').slice(0, 60), createdAt: new Date().toISOString() });
      writeJson(FILES.subscriptions, subs);
      return send(res, 200, { ok: true, devices: subs.length });
    }

    if (p === '/api/push/unsubscribe' && req.method === 'POST') {
      const { endpoint } = await readBody<{ endpoint?: string }>(req, 20000);
      writeJson(FILES.subscriptions, readJson<PushSubscriptionRecord[]>(FILES.subscriptions, []).filter((s) => s.endpoint !== endpoint));
      return send(res, 200, { ok: true });
    }

    if (p === '/api/push/test' && req.method === 'POST') {
      const sent = await sendToAll({ title: '🔔 Ça marche !', body: 'Les notifications de Mon budget sont activées.', url: '/accueil', tag: 'test' });
      return send(res, 200, { sent });
    }

    return send(res, 404, { error: 'Route inconnue' });
  } catch (e) {
    return send(res, 500, { error: (e as Error).message });
  }
}

