import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import type { Settings } from '../../db/schema';
import { useSavingsAccounts, useSettings, updateSettings } from '../../hooks/data';
import { useTheme, type Theme } from '../../app/theme';
import { Alert, Button, Card, Field, Input, MoneyInput, PageHeader, Select } from '../../components/ui';
import { RateHistoryEditor } from '../../components/RateHistoryEditor';

export function SettingsPage() {
  const settings = useSettings();
  const accounts = useSavingsAccounts();
  const [theme, setTheme] = useTheme();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    await db.transaction('rw', db.settings, db.categories, async () => {
      await updateSettings(draft);
      // Les montants attendus des catégories de revenus suivent les paramètres.
      await db.categories.update('cat-virement-livret', { monthlyBudget: draft.monthlyTransfer });
      await db.categories.update('cat-parents', { monthlyBudget: draft.parentsAllowance });
    });
    setSaved(true);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Paramètres" subtitle="Montants mensuels, Livret A, cours et affichage." />
      <div className="space-y-4">
        <Card title="Revenus mensuels">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Virement mensuel depuis l'épargne" hint="Pour le loyer et l'électricité.">
              <MoneyInput value={draft.monthlyTransfer} onChange={(v) => set('monthlyTransfer', v)} />
            </Field>
            <Field label="Aide des parents" hint="Alimentation et trains.">
              <MoneyInput value={draft.parentsAllowance} onChange={(v) => set('parentsAllowance', v)} />
            </Field>
            <Field label="Compte d'où part le virement">
              <Select value={draft.transferAccountId ?? ''} onChange={(e) => set('transferAccountId', e.target.value || null)}>
                <option value="">— Aucun —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Jour du virement" hint="Sert à estimer les intérêts futurs du livret.">
              <Input type="number" min={1} max={28} value={draft.transferDay} onChange={(e) => set('transferDay', Math.min(28, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
          </div>
        </Card>

        <Card title="Livret A (et LDDS)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plafond du Livret A" hint="22 950 € aujourd'hui, relevé en février 2027.">
              <MoneyInput value={draft.livretACeiling} onChange={(v) => set('livretACeiling', v)} />
            </Field>
            <div className="text-sm">
              <div className="mb-1 font-medium text-slate-700 dark:text-slate-300">Historique des taux</div>
              <RateHistoryEditor value={draft.livretARates} onChange={(v) => set('livretARates', v)} />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Le taux est révisé le 1er février et le 1er août. Ajoute chaque nouveau taux avec sa date d'effet : les intérêts de chaque quinzaine sont calculés avec le taux en vigueur à cette date.
          </p>
        </Card>

        <Card title="Connexion Internet (facultative)">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={draft.autoPrices} onChange={(e) => set('autoPrices', e.target.checked)} />
            <span>
              Mettre à jour automatiquement les cours (bitcoin, ETF…) à l'ouverture de l'application
              <span className="block text-xs text-slate-500">
                Seuls les symboles des placements (ex. « CW8.PA », « bitcoin ») sont envoyés à Yahoo Finance et CoinGecko, via HTTPS. Jamais tes montants ni tes quantités. Désactivé : les cours ne sont mis à jour que quand tu cliques sur « Actualiser ».
              </span>
            </span>
          </label>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={draft.autoDeals} onChange={(e) => set('autoDeals', e.target.checked)} />
            <span>
              Afficher les bons plans du moment (Dealabs) dans « Astuces & bons plans »
              <span className="block text-xs text-slate-500">L'application télécharge des listes publiques de promotions (courses, transports…). Rien n'est envoyé : le choix des catégories se fait sur ton ordinateur.</span>
            </span>
          </label>
        </Card>

        <Card title="Affichage">
          <Field label="Thème" className="max-w-xs">
            <Select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              <option value="system">Comme le système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </Select>
          </Field>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={save}>Enregistrer</Button>
          {saved && <Alert tone="success">Paramètres enregistrés.</Alert>}
        </div>
      </div>
    </div>
  );
}
