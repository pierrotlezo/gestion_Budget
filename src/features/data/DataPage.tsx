import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { exportAll, importAll, resetAll } from '../../db/backup';
import { saveFile, type SaveResult } from '../../services/download';
import { transactionsToCsv } from '../../domain/csv/exportTransactions';
import { clearDemo, countDemo, loadDemo } from '../../db/demo';
import { todayISO } from '../../domain/dates';
import { Alert, Button, Card, Input, PageHeader } from '../../components/ui';

export function DataPage() {
  const demoCount = useLiveQuery(() => countDemo(), []) ?? 0;
  // Contenus préparés à l'avance : sur iPhone, le partage doit partir directement du clic
  const csvData = useLiveQuery(async () => {
    const [transactions, categories] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
    return { count: transactions.length, csv: transactionsToCsv(transactions, categories) };
  }, []);
  const backup = useLiveQuery(() => exportAll(db), []);
  const txCount = csvData?.count ?? 0;
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const today = todayISO();

  const report = (r: SaveResult, what: string) => {
    if (r === 'cancelled') return setMessage(null);
    setMessage({
      tone: 'success',
      text: r === 'shared' ? `${what} prêt : choisis « Enregistrer dans Fichiers » (ou une autre appli) dans le menu de partage.` : `${what} téléchargé : regarde dans ton dossier Téléchargements.`,
    });
  };
  const fail = (e: unknown) => setMessage({ tone: 'danger', text: `Export impossible : ${(e as Error).message}` });

  const exportJson = () => {
    if (!backup) return;
    saveFile(`budget-sauvegarde-${today}.json`, JSON.stringify({ ...backup, exportedAt: new Date().toISOString() }, null, 2), 'application/json')
      .then((r) => report(r, 'Fichier de sauvegarde'))
      .catch(fail);
  };

  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (!confirm('Restaurer cette sauvegarde ? TOUTES les données actuelles seront remplacées.')) return;
      const counts = await importAll(db, raw);
      setMessage({ tone: 'success', text: `Sauvegarde restaurée : ${counts.transactions} transaction(s), ${counts.categories} catégorie(s), ${counts.savingsMovements} mouvement(s) d'épargne, ${counts.investments} placement(s).` });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof SyntaxError ? 'Le fichier n\'est pas un JSON valide.' : (e as Error).message });
    }
  };

  const exportCsv = () => {
    if (!csvData) return;
    saveFile(`transactions-${today}.csv`, csvData.csv, 'text/csv;charset=utf-8')
      .then((r) => report(r, `Fichier CSV (${csvData.count} transactions)`))
      .catch(fail);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Données" subtitle="Tout est stocké dans ce navigateur (IndexedDB). Rien n'est envoyé sur Internet." />
      {message && <div className="mb-4"><Alert tone={message.tone}>{message.text}</Alert></div>}

      <div className="space-y-4">
        <Card title="Sauvegarde complète (JSON)">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            Exporte régulièrement tes données : si tu vides le cache du navigateur ou changes d'ordinateur, c'est la seule copie.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={exportJson} disabled={!backup}>💾 Exporter la sauvegarde</Button>
            <label className="text-sm">
              <span className="mr-2">Restaurer :</span>
              <Input type="file" accept=".json,application/json" className="inline-block w-auto" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} />
            </label>
          </div>
        </Card>

        <Card title="Export des transactions (CSV)">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Format compatible Excel / LibreOffice (séparateur « ; », virgule décimale).</p>
          <Button onClick={exportCsv} disabled={!csvData || txCount === 0}>📄 Exporter {txCount} transaction(s)</Button>
          {csvData && txCount === 0 && <p className="mt-2 text-sm text-slate-500">Aucune transaction à exporter pour l'instant : importe un relevé ou ajoute des dépenses.</p>}
          <p className="mt-2 text-xs text-slate-500">Sur iPhone, le menu de partage s'ouvre : choisis « Enregistrer dans Fichiers ». Tu peux aussi exporter seulement une sélection depuis Dépenses → Opérations.</p>
        </Card>

        <Card title="Données de démonstration">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            12 mois de transactions fictives, des mouvements sur le Livret A, deux placements (bitcoin, ETF Monde) et deux objectifs, pour découvrir l'application. Elles sont marquées « démo » et s'effacent sans toucher à tes vraies données.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={async () => { const r = await loadDemo(); setMessage({ tone: 'success', text: `Démo chargée : ${r.transactions} transactions, ${r.movements} mouvements d'épargne, ${r.investments} placements et 2 objectifs.` }); }}>
              ✨ {demoCount > 0 ? 'Recharger' : 'Charger'} la démo
            </Button>
            <Button variant="danger" disabled={demoCount === 0} onClick={async () => { const n = await clearDemo(); setMessage({ tone: 'success', text: `${n} élément(s) de démonstration effacé(s).` }); }}>
              🧹 Effacer la démo ({demoCount})
            </Button>
          </div>
        </Card>

        <Card title="Zone de danger">
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm('Effacer TOUTES les données et revenir aux réglages par défaut ? Pense à exporter une sauvegarde avant.')) return;
              if (!confirm('Vraiment tout effacer ? Cette action est irréversible.')) return;
              await resetAll(db);
              location.reload();
            }}
          >
            Tout effacer
          </Button>
        </Card>
      </div>
    </div>
  );
}
