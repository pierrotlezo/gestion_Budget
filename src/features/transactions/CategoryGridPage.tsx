import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCategories, useTransactions } from '../../hooks/data';
import { currentMonth, monthOf, type MonthKey } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { summarizeMonth } from '../../domain/budget/totals';
import { ProgressBar } from '../../components/ui';
import { MonthSwitcher } from './MonthSwitcher';

/** Accueil des dépenses : une tuile par catégorie, cliquable. */
export function CategoryGridPage() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const [params, setParams] = useSearchParams();
  const month: MonthKey = params.get('mois') ?? currentMonth();
  const summary = useMemo(() => summarizeMonth(transactions, categories, month), [transactions, categories, month]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of transactions) if (monthOf(t.date) === month) m.set(t.categoryId ?? '__none', (m.get(t.categoryId ?? '__none') ?? 0) + 1);
    return m;
  }, [transactions, month]);
  const toSort = counts.get('__none') ?? 0;
  const spending = summary.byCategory.filter((c) => c.category.kind !== 'income');
  const income = summary.byCategory.filter((c) => c.category.kind === 'income' && c.amount !== 0);
  const q = month === currentMonth() ? '' : `?mois=${month}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">Dépensé</div>
          <div className="text-3xl font-bold tracking-tight">{formatEUR(summary.spent)}</div>
        </div>
        <MonthSwitcher month={month} onChange={(m) => setParams(m === currentMonth() ? {} : { mois: m })} />
      </div>

      {toSort > 0 && (
        <Link to={`/depenses/categorie/__none${q}`} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-4 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40">
          <span className="text-2xl" aria-hidden>📥</span>
          <span className="font-medium">{toSort} opération{toSort > 1 ? 's' : ''} à trier</span>
          <span className="ml-auto text-sm text-orange-700 dark:text-orange-300">Trier →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {spending.map((c) => (
          <Link
            key={c.category.id}
            to={`/depenses/categorie/${c.category.id}${q}`}
            className="group flex flex-col rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${c.category.color}22` }} aria-hidden>{c.category.icon ?? '🏷️'}</span>
            <span className="truncate text-sm text-slate-600 dark:text-slate-300">{c.category.name}</span>
            <span className={`text-xl font-bold ${c.amount === 0 ? 'text-slate-300 dark:text-slate-600' : ''}`}>{formatEUR(c.amount, { round: c.amount >= 100000 })}</span>
            {c.budget > 0 ? (
              <div className="mt-2">
                <ProgressBar ratio={c.ratio} status={c.status} />
                <div className={`mt-1 text-xs ${c.status === 'over' ? 'text-red-600 dark:text-red-400' : c.status === 'warning' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>
                  {c.status === 'over' ? `⛔ +${formatEUR(c.amount - c.budget, { round: true })}` : `${formatEUR(c.budget - c.amount, { round: true })} restants`}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-400">{counts.get(c.category.id) ?? 0} opération{(counts.get(c.category.id) ?? 0) > 1 ? 's' : ''}</div>
            )}
          </Link>
        ))}
      </div>

      {income.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-medium text-slate-500">Rentrées d'argent · {formatEUR(summary.income)}</div>
          <div className="flex flex-wrap gap-2">
            {income.map((c) => (
              <Link key={c.category.id} to={`/depenses/categorie/${c.category.id}${q}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                <span aria-hidden>{c.category.icon}</span> {c.category.name} <strong className="text-emerald-600 dark:text-emerald-400">+{formatEUR(c.amount, { round: true })}</strong>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
