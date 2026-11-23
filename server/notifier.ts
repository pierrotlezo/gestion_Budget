/**
 * Envoi des notifications sur les appareils abonnés (Web Push).
 * Le contenu est chiffré de bout en bout : le service de notification d'Apple ne peut pas le lire.
 * Vérification toutes les 10 minutes ; rien entre 22 h et 8 h (les notifications attendent le matin).
 */
import * as webpush from 'web-push';
import { defaultSettings } from '../src/db/defaults';
import { emptyState, type SyncState } from '../src/domain/sync/merge';
import { computeGameProgress, computeInsights, computeWealth, type AppData } from '../src/domain/progress';
import { computeNotifications } from '../src/domain/notifications';
import { monthOf, toISO } from '../src/domain/dates';
import { FILES, exists, getConfig, readJson, writeJson, type PushSubscriptionRecord } from './store';
import { getLocalDeals } from './deals';

let configured = false;
function setup() {
  if (configured) return;
  const { vapid } = getConfig();
  // Contact technique exigé par le protocole : l'adresse publique du projet (aucune donnée personnelle)
  webpush.setVapidDetails('https://github.com/pierrotlezo/gestion_Budget', vapid.publicKey, vapid.privateKey);
  configured = true;
}

export async function sendToAll(payload: { title: string; body: string; url: string; tag: string }): Promise<number> {
  setup();
  const subs = readJson<PushSubscriptionRecord[]>(FILES.subscriptions, []);
  let ok = 0;
  const dead = new Set<string>();
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload), { TTL: 24 * 3600, urgency: 'normal' });
        ok++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.add(s.endpoint); // abonnement expiré
        else console.warn(`Notification non envoyée à ${s.device} :`, (e as Error).message);
      }
    }),
  );
  if (dead.size) writeJson(FILES.subscriptions, subs.filter((s) => !dead.has(s.endpoint)));
  return ok;
}

function stateToData(state: SyncState): AppData {
  const t = (name: string) => Object.values(state.tables[name] ?? {}) as never[];
  const settings = { ...defaultSettings, ...((state.tables.settings?.app as object) ?? {}) } as AppData['settings'];
  return {
    settings,
    categories: (t('categories') as AppData['categories']).sort((a, b) => a.order - b.order),
    // On ignore les enregistrements incomplets (le serveur ne doit jamais planter sur une donnée abîmée)
    transactions: (t('transactions') as AppData['transactions']).filter((x) => typeof x.date === 'string' && typeof x.amount === 'number' && typeof x.label === 'string'),
    investments: t('investments'),
    investmentOps: (t('investmentOps') as AppData['investmentOps']).filter((x) => typeof x.date === 'string' && typeof x.amount === 'number'),
    prices: t('prices'),
    savingsAccounts: t('savingsAccounts'),
    savingsMovements: (t('savingsMovements') as AppData['savingsMovements']).filter((x) => typeof x.date === 'string' && typeof x.amount === 'number'),
    loans: t('loans'),
    goals: t('goals'),
    tipStates: t('tipStates'),
  };
}

/** Notifications qui seraient envoyées maintenant (sans rien envoyer). */
export async function previewNotifications(now = new Date()) {
  const state = readJson<SyncState>(FILES.state, emptyState());
  if (!state.tables.settings) return null; // aucune synchro encore
  const data = stateToData(state);
  const today = toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const wealth = computeWealth(data, today);
  const insights = computeInsights(data, monthOf(today));
  const game = computeGameProgress(data, wealth, monthOf(today), today);
  const deals = data.settings.notifications.deals ? await getLocalDeals(data.settings.city) : [];
  return computeNotifications({ data, insights, game, deals, now, city: data.settings.city, enabled: data.settings.notifications });
}

export async function checkNotifications(now = new Date()): Promise<number> {
  const notifications = await previewNotifications(now);
  if (!notifications) return 0;

  const firstRun = !exists(FILES.sent);
  const sent = readJson<Record<string, number>>(FILES.sent, {});
  const fresh = notifications.filter((n) => !sent[n.key]);
  // Au tout premier lancement, on n'envoie rien d'ancien : on note seulement l'état actuel
  const quiet = now.getHours() < 8 || now.getHours() >= 22;
  let count = 0;
  if (!firstRun && !quiet) {
    for (const n of fresh.slice(0, 3)) {
      await sendToAll({ title: n.title, body: n.body, url: n.url, tag: n.key });
      sent[n.key] = Date.now();
      count++;
    }
  } else if (firstRun) {
    for (const n of fresh) sent[n.key] = Date.now();
  }
  // On oublie les clés de plus de 120 jours
  for (const [k, at] of Object.entries(sent)) if (Date.now() - at > 120 * 86400000) delete sent[k];
  writeJson(FILES.sent, sent);
  return count;
}

export function startNotifier() {
  const run = () => checkNotifications().catch((e) => console.warn('Notifications :', (e as Error).message));
  setTimeout(run, 30_000);
  setInterval(run, 10 * 60_000);
}
