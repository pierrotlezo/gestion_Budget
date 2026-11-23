import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { exportAll, importAll, resetAll } from '../../db/backup';
import { clearDemo, countDemo, loadDemo } from '../../db/demo';
import { toCsv } from '../../domain/csv/parse';
import { formatDateFR, todayISO } from '../../domain/dates';
import { Alert, Button, Card, Input, PageHeader } from '../../components/ui';

/** Télécharge un fichier généré dans le navigateur (aucun envoi réseau). */
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataPage() {
  const demoCount = useLiveQuery(() => countDemo(), []) ?? 0;
  const txCount = useLiveQuery(() => db.transactions.count(), []) ?? 0;
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const today = todayISO();

  const exportJson = async () => {
    const backup = await exportAll(db);
    download(`budget-sauvegarde-${today}.json`, JSON.stringify(backup, null, 2), 'application/json');
    setMessage({ tone: 'success', text: 'Sauvegarde téléchargée. Range-la dans un endroit sûr : elle contient toutes tes données.' });
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

  const exportCsv = async () => {
    const [transactions, categories] = await Promise.all([db.transactions.orderBy('date').toArray(), db.categories.toArray()]);
    const name = new Map(categories.map((c) => [c.id, c.name]));
    const csv = toCsv(
      ['Date', 'Libellé', 'Catégorie', 'Montant', 'Note'],
      transactions.map((t) => [formatDateFR(t.date), t.label, t.categoryId ? (name.get(t.categoryId) ?? '') : '', (t.amount / 100).toFixed(2).replace('.', ','), t.note ?? '']),
    );
    download(`transactions-${today}.csv`, csv, 'text/csv;charset=utf-8');
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
            <Button variant="primary" onClick={exportJson}>💾 Exporter la sauvegarde</Button>
            <label className="text-sm">
              <span className="mr-2">Restaurer :</span>
              <Input type="file" accept=".json,application/json" className="inline-block w-auto" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importJson(f); }} />
            </label>
          </div>
        </Card>

        <Card title="Export des transactions (CSV)">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Format compatible Excel / LibreOffice (séparateur « ; », virgule décimale).</p>
          <Button onClick={exportCsv} disabled={txCount === 0}>📄 Exporter {txCount} transaction(s)</Button>
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
