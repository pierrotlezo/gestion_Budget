import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { goalCurrentAmount, useCategories, useGoals, useTransactions, useWealth } from '../../hooks/data';
import { addMonthsToKey, currentMonth, formatMonth, todayISO, type MonthKey } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { summarizeMonth, type CategoryTotal } from '../../domain/budget/totals';
import { averagePotential, savingsCapacity } from '../../domain/budget/capacity';
import { simulate } from '../../domain/invest/compound';
import { goalProgress } from '../../domain/invest/goals';
import { seriesColor } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Button, Card, ColorDot, EmptyState, ProgressBar, Stat } from '../../components/ui';
import { Donut } from '../../components/Donut';
import { TransactionForm } from '../transactions/TransactionForm';
import { SaveDialog } from './SaveDialog';

/** Hypothèse de rendement utilisée pour illustrer « et si tu investissais ? » (modifiable dans le simulateur). */
const ILLUSTRATION_RETURN = 0.07;

export function HomePage() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const goals = useGoals();
  const wealth = useWealth();
  const dark = useIsDark();
  const [month, setMonth] = useState<MonthKey>(currentMonth());
  const [dialog, setDialog] = useState<'save' | 'expense' | null>(null);

  const summary = useMemo(() => summarizeMonth(transactions, categories, month), [transactions, categories, month]);
  const capacity = savingsCapacity(summary);
  const avg = useMemo(() => averagePotential(transactions, categories, currentMonth(), 3), [transactions, categories]);
  const in10y = avg.average > 0 ? simulate({ initial: 0, monthly: avg.average, years: 10, annualReturn: ILLUSTRATION_RETURN })[10] : null;

  const spending = summary.byCategory.filter((c) => c.category.kind === 'expense');
  const budgeted = spending.filter((c) => c.budget > 0);
  const others = spending.filter((c) => c.budget === 0 && c.amount > 0);
  const donut = spending.map((c) => ({ name: c.category.name, value: c.amount, color: seriesColor(c.category.color, dark) }));
  if (summary.uncategorizedOut > 0) donut.push({ name: 'À catégoriser', value: summary.uncategorizedOut, color: dark ? '#64748b' : '#94a3b8' });
  const spentRatio = summary.income > 0 ? (capacity.consumption + capacity.saved) / summary.income : 0;
  const isCurrent = month === currentMonth();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bonjour 👋</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Voici où en est ton mois de <span className="font-medium">{formatMonth(month)}</span>.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setMonth((m) => addMonthsToKey(m, -1))} aria-label="Mois précédent">◀</Button>
          <span className="min-w-28 text-center text-sm font-medium capitalize">{formatMonth(month, true)}</span>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setMonth((m) => addMonthsToKey(m, 1))} aria-label="Mois suivant" disabled={isCurrent}>▶</Button>
        </div>
      </div>

      {/* Carte principale */}
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-emerald-500 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-sm text-indigo-100">{isCurrent ? 'Il te reste ce mois-ci' : 'Il te restait ce mois-là'}</div>
            <div className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{formatEUR(capacity.leftover)}</div>
            <div className="mt-2 text-sm text-indigo-100">
              {capacity.saved > 0 ? `Et tu as déjà mis ${formatEUR(capacity.saved)} de côté 👏` : capacity.leftover > 0 ? 'Une partie pourrait partir vers ton épargne 🌱' : 'Pas de marge ce mois-ci : regarde tes dépenses ci-dessous.'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog('save')} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50">💰 J'épargne</button>
            <button type="button" onClick={() => setDialog('expense')} className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/25">+ Dépense</button>
          </div>
        </div>
        {summary.income > 0 && (
          <div className="mt-6">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, spentRatio * 100)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-indigo-100">{Math.round(spentRatio * 100)} % de tes revenus utilisés ({formatEUR(summary.income)} reçus)</div>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="💶" label="Entrées" value={formatEUR(summary.income)} />
        <Stat icon="🛒" label="Dépenses" value={formatEUR(capacity.consumption)} hint={summary.uncategorizedOut > 0 ? <Link to="/depenses" className="underline">Des opérations sont à catégoriser</Link> : undefined} />
        <Stat icon="🐷" label="Mis de côté" value={formatEUR(capacity.saved)} hint={summary.income > 0 ? `Taux d'épargne possible : ${Math.round(capacity.savingsRate * 100)} %` : undefined} />
      </div>

      {/* Lien dépenses → épargne */}
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl" aria-hidden>🌱</span>
            <div>
              <div className="font-semibold">Ton potentiel d'épargne</div>
              {avg.months > 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Sur les {avg.months} derniers mois, tu aurais pu mettre de côté <strong>{formatEUR(avg.average)}</strong> par mois en moyenne.
                  {in10y && in10y.value > 0 && (
                    <> Investis chaque mois pendant 10 ans à {Math.round(ILLUSTRATION_RETURN * 100)} % par an (hypothèse), cela ferait environ <strong>{formatEUR(in10y.value, { round: true })}</strong>, dont {formatEUR(in10y.gains, { round: true })} d'intérêts.</>
                  )}
                </p>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">Importe quelques mois de relevés pour estimer ce que tu peux épargner chaque mois.</p>
              )}
            </div>
          </div>
          <Link to="/epargne/simulateur"><Button>Simuler →</Button></Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Mes budgets" actions={<Link to="/depenses/categories" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Modifier</Link>}>
          {budgeted.length === 0 ? (
            <EmptyState>Fixe un budget mensuel pour tes catégories (Alimentation, Loisirs…) pour suivre tes dépenses ici.</EmptyState>
          ) : (
            <div className="space-y-4">{budgeted.map((c) => <BudgetLine key={c.category.id} total={c} />)}</div>
          )}
          {others.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Sans budget</div>
              <div className="flex flex-wrap gap-2">
                {others.map((c) => (
                  <span key={c.category.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">
                    <ColorDot color={c.category.color} /> {c.category.name} <strong>{formatEUR(c.amount, { round: true })}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Où part mon argent ?">
          <Donut items={donut} centerLabel="dépensés" empty="Aucune dépense ce mois-ci." />
        </Card>
      </div>

      <Card title="Mes objectifs" actions={<Link to="/epargne/objectifs" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">Tout voir</Link>}>
        {goals.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Fixe-toi un objectif : épargne de précaution, 1 000 € en bitcoin, un voyage…</p>
            <Link to="/epargne/objectifs"><Button variant="primary">Créer un objectif</Button></Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.slice(0, 3).map((g) => {
              const p = goalProgress(g, goalCurrentAmount(g, wealth), todayISO());
              return (
                <div key={g.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2 font-medium"><span className="text-xl" aria-hidden>{g.icon}</span>{g.name}</div>
                  <div className="mt-2"><ProgressBar ratio={p.ratio} status="ok" /></div>
                  <div className="mt-1 flex justify-between text-xs text-slate-500">
                    <span>{formatEUR(p.current, { round: true })} / {formatEUR(p.target, { round: true })}</span>
                    <span>{p.reached ? 'Atteint 🎉' : `${Math.floor(p.ratio * 100)} %`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} suggested={Math.max(0, Math.round(capacity.leftover / 1000) * 1000)} />}
      {dialog === 'expense' && <TransactionForm onClose={() => setDialog(null)} />}
    </div>
  );
}

function BudgetLine({ total: t }: { total: CategoryTotal }) {
  const pct = Math.floor(t.ratio * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm">
        <ColorDot color={t.category.color} />
        <span className="font-medium">{t.category.name}</span>
        <span className="ml-auto">{formatEUR(t.amount)} <span className="text-slate-400">/ {formatEUR(t.budget, { round: true })}</span></span>
      </div>
      <ProgressBar ratio={t.ratio} status={t.status} />
      <div className="mt-1 text-xs">
        {t.status === 'over' ? (
          <span className="text-red-600 dark:text-red-400">⛔ Dépassé de {formatEUR(t.amount - t.budget)}</span>
        ) : t.status === 'warning' ? (
          <span className="text-orange-600 dark:text-orange-400">⚠️ {pct} % utilisé · il reste {formatEUR(t.budget - t.amount)}</span>
        ) : (
          <span className="text-slate-500">Il reste {formatEUR(t.budget - t.amount)}</span>
        )}
      </div>
    </div>
  );
}
