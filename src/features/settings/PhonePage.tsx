import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useSettings, updateSettings } from '../../hooks/data';
import { getSyncStatus, pairWithCode, serverApi, syncNow, unpair, useSyncStatus } from '../../services/sync';
import { currentSubscription, disablePush, enablePush, isIos, isStandalone, pushSupported, sendTestPush } from '../../services/push';
import { Alert, Button, Card, Input, PageHeader } from '../../components/ui';

const isThisPc = () => ['localhost', '127.0.0.1'].includes(location.hostname);

function Qr({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setSrc);
  }, [url]);
  return (
    <figure className="flex flex-col items-center gap-2 text-center">
      {src && <img src={src} alt={`QR code : ${url}`} className="h-44 w-44 rounded-xl bg-white p-2" />}
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <code className="text-xs break-all text-slate-500">{url}</code>
    </figure>
  );
}

export function PhonePage() {
  const sync = useSyncStatus();
  const settings = useSettings();
  const [code, setCode] = useState('');
  const [pairCode, setPairCode] = useState<{ code: string; expiresAt: number } | null>(null);
  const [info, setInfo] = useState<{ urls: { app: string[]; setup: string }; devices: string[] } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sync.token) serverApi<typeof info>('/api/info').then(setInfo).catch(() => setInfo(null));
    currentSubscription().then((s) => setSubscribed(!!s));
  }, [sync.token]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setMessage({ tone: 'success', text: ok });
    } catch (e) {
      setMessage({ tone: 'danger', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: keyof typeof settings.notifications) => updateSettings({ notifications: { ...settings.notifications, [k]: !settings.notifications[k] } });
  const lastSync = sync.lastResult ? new Date(sync.lastResult.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="📱 Téléphone & synchro" subtitle="Ton PC sert de « serveur maison » : il synchronise tes données et envoie les notifications. Rien ne passe par un service en ligne." />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {/* Appairage / synchro */}
      <Card title="🔄 Synchronisation">
        {sync.token ? (
          <div className="space-y-3 text-sm">
            <p>✅ Cet appareil est appairé. Dernière synchro : <strong>{lastSync}</strong>{sync.lastResult && !sync.lastResult.ok && <span className="text-orange-600 dark:text-orange-400"> — {sync.lastResult.message}</span>}</p>
            <p className="text-slate-500">La synchro est automatique (à l'ouverture et après chaque modification) quand ton téléphone et ton PC sont sur le même Wi-Fi. Hors de chez toi, tout reste utilisable : la synchro se fera au retour.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={sync.syncing} onClick={() => run(async () => { if (!(await syncNow())) throw new Error('Synchro impossible : ' + (getSyncStatus().lastResult?.message ?? '')); }, 'Synchronisé ✅')}>{sync.syncing ? 'Synchro…' : 'Synchroniser maintenant'}</Button>
              {!isThisPc() && <Button variant="ghost" onClick={() => confirm('Désappairer cet appareil ? Ses données restent, mais il ne se synchronisera plus.') && unpair()}>Désappairer</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p>Entre le code à 6 chiffres affiché sur ton PC (<strong>Réglages → Téléphone → Générer un code</strong>).</p>
            <div className="flex gap-2">
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className="max-w-40 text-center text-2xl tracking-widest" aria-label="Code d'appairage" />
              <Button variant="primary" disabled={code.length !== 6 || busy} onClick={() => run(() => pairWithCode(code), 'Appairé et synchronisé ✅ Tes données du PC sont maintenant ici.')}>Appairer</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sur le PC : installer sur l'iPhone */}
      {isThisPc() && sync.token && (
        <Card title="📲 Installer sur l'iPhone">
          <ol className="mb-5 list-decimal space-y-1 pl-5 text-sm">
            <li>Lance le serveur maison sur ce PC : <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm start</code> (et laisse-le tourner).</li>
            <li>Connecte l'iPhone au <strong>même Wi-Fi</strong> que le PC (ou le PC au partage de connexion de l'iPhone).</li>
            <li>Scanne le premier QR code avec l'appareil photo : il guide l'installation du certificat (une seule fois).</li>
            <li>Scanne le second : l'appli s'ouvre dans Safari → <strong>Partager ⬆️ → Sur l'écran d'accueil</strong>.</li>
            <li>Ouvre l'appli depuis l'écran d'accueil et entre le code d'appairage ci-dessous.</li>
          </ol>
          {info ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <Qr url={info.urls.setup} label="1. Installation du certificat" />
              <Qr url={info.urls.app[0]} label="2. Ouvrir l'appli" />
            </div>
          ) : (
            <Alert tone="info">Adresse du serveur indisponible.</Alert>
          )}
          {info && info.urls.app.length > 1 && <p className="mt-3 text-xs text-slate-500">Si le nom « .local » ne marche pas, utilise l'adresse IP : {info.urls.app.slice(1).join(', ')}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-indigo-50 p-4 dark:bg-indigo-950/40">
            <Button variant="primary" onClick={() => run(async () => setPairCode(await serverApi('/api/pair/code', { method: 'POST' })), 'Code généré : entre-le sur l\'iPhone.')}>Générer un code d'appairage</Button>
            {pairCode && (
              <div>
                <div className="font-mono text-4xl font-bold tracking-[0.3em]">{pairCode.code}</div>
                <div className="text-xs text-slate-500">Valable jusqu'à {new Date(pairCode.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )}
          </div>
          {info && info.devices.length > 0 && <p className="mt-3 text-sm text-slate-500">Appareils recevant les notifications : {info.devices.join(', ')}</p>}
        </Card>
      )}

      {/* Notifications */}
      <Card title="🔔 Notifications">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['deals', '📍 Bons plans à ' + settings.city, 'Une notification groupée par jour'],
            ['budget', '⚠️ Alertes budget', '80 % atteint, dépassement, abonnement qui augmente'],
            ['game', '🎮 Jeu & objectifs', 'Paliers, niveaux, rappel de fin de mois pour ta série'],
            ['weekly', '📊 Résumé de la semaine', 'Le dimanche soir'],
          ] as const).map(([k, title, desc]) => (
            <label key={k} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
              <input type="checkbox" className="mt-1" checked={settings.notifications[k]} onChange={() => toggle(k)} />
              <span><span className="font-medium">{title}</span><span className="block text-xs text-slate-500">{desc}</span></span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Pas de notification entre 22 h et 8 h. Elles sont envoyées par ton PC (qui doit être allumé avec <code>npm start</code>), chiffrées de bout en bout via le service de notifications d'Apple.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isIos() && !isStandalone() ? (
            <Alert tone="info">Sur iPhone, ajoute d'abord l'appli à l'écran d'accueil (Partager ⬆️ → Sur l'écran d'accueil), puis ouvre-la depuis l'icône pour activer les notifications.</Alert>
          ) : !pushSupported() ? (
            <Alert tone="info">Les notifications ne sont pas disponibles dans ce navigateur (ou en mode développement : utilise « npm start »).</Alert>
          ) : !sync.token ? (
            <Alert tone="info">Appaire d'abord cet appareil avec ton PC.</Alert>
          ) : subscribed ? (
            <>
              <span className="self-center text-sm">✅ Notifications activées sur cet appareil</span>
              <Button onClick={() => run(async () => { const r = await sendTestPush(); if (!r.sent) throw new Error('Aucun appareil n\'a reçu la notification.'); }, 'Notification de test envoyée.')}>Envoyer un test</Button>
              <Button variant="ghost" onClick={() => run(async () => { await disablePush(); setSubscribed(false); }, 'Notifications désactivées sur cet appareil.')}>Désactiver</Button>
            </>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => run(async () => { await enablePush(); setSubscribed(true); }, 'Notifications activées ✅')}>🔔 Activer les notifications sur cet appareil</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
