/**
 * Synchronisation avec le serveur maison (le PC). L'appli est servie par le PC : le serveur est
 * donc à la même adresse que l'appli. Hors de chez toi, la synchro attend simplement ton retour.
 */
import { useSyncExternalStore } from 'react';
import { db, DATA_TABLES, onLocalChange, setSyncApplying } from '../db/db';

const KEY = 'gestion-budget.sync';

export interface SyncStatus {
  token: string | null;
  lastSyncAt: number;
  /** « table:id » connus à la fin de la dernière synchro (pour détecter les suppressions locales). */
  known: string[];
  lastResult: { at: number; ok: boolean; message: string } | null;
  syncing: boolean;
}

let status: SyncStatus = { token: null, lastSyncAt: 0, known: [], lastResult: null, syncing: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
status.syncing = false;
const listeners = new Set<() => void>();
function update(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  const { syncing: _s, ...persist } = status;
  localStorage.setItem(KEY, JSON.stringify(persist));
  listeners.forEach((l) => l());
}

export const getSyncStatus = () => status;
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => status);
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(status.token ? { 'x-budget-token': status.token } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Erreur ${res.status}`);
  return body as T;
}
export { api as serverApi };

/** Sur le PC lui-même, l'appairage est automatique. */
export async function tryLocalPairing(): Promise<boolean> {
  if (status.token) return true;
  try {
    const { token } = await api<{ token: string }>('/api/pair/local');
    update({ token });
    return true;
  } catch {
    return false;
  }
}

export async function pairWithCode(code: string) {
  const { token } = await api<{ token: string }>('/api/pair', { method: 'POST', body: JSON.stringify({ code }) });
  update({ token, lastSyncAt: 0, known: [] });
  await syncNow();
}

export function unpair() {
  update({ token: null, lastSyncAt: 0, known: [], lastResult: null });
}

export async function syncNow(): Promise<boolean> {
  if (!status.token || status.syncing) return false;
  update({ syncing: true });
  try {
    const tables: Record<string, unknown[]> = {};
    for (const t of DATA_TABLES) tables[t] = await db.table(t).toArray();
    const res = await api<{ tables: Record<string, { id: string }[]>; serverTime: number }>('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ lastSyncAt: status.lastSyncAt, known: status.known, tables }),
    });
    // On remplace les données locales par l'état fusionné, sans ré-horodater
    setSyncApplying(true);
    try {
      await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
        for (const t of DATA_TABLES) {
          await db.table(t).clear();
          await db.table(t).bulkAdd(res.tables[t] ?? []);
        }
      });
    } finally {
      setSyncApplying(false);
    }
    const known = Object.entries(res.tables).flatMap(([t, rows]) => rows.map((r) => `${t}:${r.id}`));
    update({ lastSyncAt: res.serverTime, known, syncing: false, lastResult: { at: Date.now(), ok: true, message: 'Synchronisé' } });
    return true;
  } catch (e) {
    const offline = e instanceof TypeError; // réseau injoignable
    update({ syncing: false, lastResult: { at: Date.now(), ok: false, message: offline ? 'PC injoignable (tu n\'es pas sur le même Wi-Fi ?)' : (e as Error).message } });
    if ((e as Error).message.includes('non appairé')) update({ token: null });
    return false;
  }
}

/** Synchro automatique : à l'ouverture, au retour sur l'appli, et 5 s après chaque modification. */
let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => syncNow(), ms);
  };
  tryLocalPairing().then(() => soon(500));
  onLocalChange(() => !status.syncing && status.token && soon(5000));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && soon(300));
  window.addEventListener('online', () => soon(300));
}
