/**
 * Fichiers du serveur maison, dans `donnees-serveur/` (jamais envoyé sur GitHub : voir .gitignore).
 * Ce dossier contient une copie de tes données (pour la synchro et les notifications) : garde-le privé.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as webpush from 'web-push';

export const DATA_DIR = process.env.GB_DATA_DIR ?? path.resolve(process.cwd(), 'donnees-serveur');
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

export function readJson<T>(name: string, fallback: T): T {
  const file = path.join(DATA_DIR, name);
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

/** Écriture atomique (fichier temporaire puis renommage) : pas de fichier à moitié écrit en cas de coupure. */
export function writeJson(name: string, value: unknown) {
  const file = path.join(DATA_DIR, name);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  renameSync(tmp, file);
}

export const exists = (name: string) => existsSync(path.join(DATA_DIR, name));

export interface ServerConfig {
  /** Jeton secret des appareils appairés. */
  token: string;
  vapid: { publicKey: string; privateKey: string };
}

let config: ServerConfig | null = null;
export function getConfig(): ServerConfig {
  if (config) return config;
  config = readJson<ServerConfig | null>('config.json', null);
  if (!config) {
    config = { token: randomBytes(32).toString('hex'), vapid: webpush.generateVAPIDKeys() };
    writeJson('config.json', config);
  }
  return config;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device: string;
  createdAt: string;
}

export const FILES = {
  state: 'etat-synchro.json',
  subscriptions: 'abonnements-push.json',
  sent: 'notifications-envoyees.json',
};
