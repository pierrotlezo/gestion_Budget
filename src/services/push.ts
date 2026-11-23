/** Abonnement aux notifications (Web Push) envoyées par le serveur maison. */
import { serverApi } from './sync';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Sur iPhone, les notifications ne marchent que dans l'appli ajoutée à l'écran d'accueil. */
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return /Firefox/.test(ua) ? 'PC (Firefox)' : 'PC';
}

/** Doit être appelé depuis un clic (exigence d'iOS). */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Notifications non disponibles ici. Sur iPhone : ajoute d\'abord l\'appli à l\'écran d\'accueil (iOS 16.4 ou plus récent).');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications refusées. Tu peux les autoriser dans les réglages de l\'iPhone (Notifications → Mon budget).');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await serverApi<{ publicKey: string }>('/api/push/key');
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  await serverApi('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), device: deviceName() }) });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await serverApi('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe();
}

export const sendTestPush = () => serverApi<{ sent: number }>('/api/push/test', { method: 'POST' });
