import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { goalCurrentAmount, useCategories, useGoals, useTransactions, useWealth } from '../../hooks/data';
import { ENVELOPE_ICONS, ENVELOPE_LABELS } from '../../domain/invest/portfolio';
import { averagePotential, savingsCapacity } from '../../domain/budget/capacity';
import { summarizeMonth } from '../../domain/budget/totals';
import { goalProgress } from '../../domain/invest/goals';
import { currentMonth, formatDateFR, todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { CATEGORICAL, seriesColor } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Button, Card, EmptyState, GainText, PageHeader, ProgressBar, Stat } from '../../components/ui';
import { BreakdownBars } from '../../components/BreakdownBars';
import { SaveDialog } from '../home/SaveDialog';

export function OverviewPage() {
  const wealth = useWealth();
  const goals = useGoals();
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const dark = useIsDark();
  const [saving, setSaving] = useState(false);

  const month = savingsCapacity(summarizeMonth(transactions, categories, currentMonth()));
  const avg = useMemo(() => averagePotential(transactions, categories, currentMonth(), 3), [transactions, categories]);

  // Répartition : chaque livret + chaque enveloppe d'investissement, couleurs dans un ordre fixe
  const items = [
    ...wealth.savingsByAccount.map((a) => ({ key: a.account.id, name: a.account.name, value: a.balance, icon: '🐷', to: '/epargne/livrets' })),
    ...wealth.portfolio.byEnvelope.map((e) => ({ key: e.envelope, name: ENVELOPE_LABELS[e.envelope], value: e.value, icon: ENVELOPE_ICONS[e.envelope], to: '/epargne/placements' })),
  ].map((it, i) => ({ ...it, color: seriesColor(CATEGORICAL[i % CATEGORICAL.length], dark) }));
  const assets = wealth.savings + wealth.portfolio.value;

  return (
    <div className="space-y-6">
      <PageHeader title="Épargne & investissement" subtitle="Tout ce que tu as mis de côté, au même endroit." actions={<Button variant="primary" onClick={() => setSaving(true)}>💰 J'épargne</Button>} />

      <section className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg md:p-8">
        <div className="text-sm text-emerald-50">Mon épargne totale</div>
        <div className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{formatEUR(assets)}</div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-white/15 px-4 py-3"><div className="text-emerald-50">🐷 Livrets</div><div className="text-lg font-semibold">{formatEUR(wealth.savings)}</div></div>
          <div className="rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-emerald-50">📈 Placements</div>
            <div className="text-lg font-semibold">{formatEUR(wealth.portfolio.value)}</div>
            {wealth.portfolio.invested > 0 && <div className="text-xs text-emerald-50">{wealth.portfolio.gain >= 0 ? '▲' : '▼'} {formatEUR(wealth.portfolio.gain, { sign: true })} de plus-value</div>}
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-emerald-50">⚖️ Patrimoine net</div>
            <div className="text-lg font-semibold">{formatEUR(wealth.netWorth)}</div>
            <div className="text-xs text-emerald-50">après {formatEUR(wealth.debt, { round: true })} de prêt restant</div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="🗓️" label="Mis de côté ce mois-ci" value={formatEUR(month.saved)} hint={month.leftover > 0 ? `Encore ${formatEUR(month.leftover)} disponibles` : undefined} />
        <Stat icon="🌱" label="Potentiel moyen / mois" value={formatEUR(avg.average)} hint={avg.months ? `Moyenne des ${avg.months} derniers mois` : 'Pas encore assez de données'} />
        <Stat icon="📊" label="Taux d'épargne possible" value={`${Math.round(month.savingsRate * 100)} %`} hint="Part des revenus non dépensée ce mois-ci" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Répartition" actions={<Link to="/epargne/placements" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Mes placements</Link>}>
          <BreakdownBars items={items} empty="Ajoute un livret ou un placement pour voir ta répartition." />
        </Card>

        <Card title="Mes objectifs" actions={<Link to="/epargne/objectifs" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Gérer</Link>}>
          {goals.length === 0 ? (
            <EmptyState>Aucun objectif pour le moment. <Link to="/epargne/objectifs" className="underline">En créer un</Link></EmptyState>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const p = goalProgress(g, goalCurrentAmount(g, wealth), todayISO());
                return (
                  <div key={g.id}>
                    <div className="mb-1.5 flex items-center gap-2 text-sm">
                      <span aria-hidden>{g.icon}</span><span className="font-medium">{g.name}</span>
                      <span className="ml-auto">{formatEUR(p.current, { round: true })} <span className="text-slate-400">/ {formatEUR(p.target, { round: true })}</span></span>
                    </div>
                    <ProgressBar ratio={p.ratio} status="ok" />
                    <div className="mt-1 text-xs text-slate-500">{p.reached ? 'Objectif atteint 🎉' : p.estimatedDate ? `Atteint vers le ${formatDateFR(p.estimatedDate)}` : 'Ajoute un versement mensuel pour estimer la date'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {wealth.positions.length > 0 && (
        <Card title="Mes placements">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {wealth.positions.map((p) => (
              <li key={p.investment.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-lg" aria-hidden>{ENVELOPE_ICONS[p.investment.envelope]}</span>
                <span className="font-medium">{p.investment.name}</span>
                <span className="ml-auto font-semibold">{formatEUR(p.value)}</span>
                <span className="w-36 text-right"><GainText cents={p.gain} ratio={p.gainRatio} format={formatEUR} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {saving && <SaveDialog onClose={() => setSaving(false)} suggested={Math.max(0, Math.round(month.leftover / 1000) * 1000)} />}
    </div>
  );
}
