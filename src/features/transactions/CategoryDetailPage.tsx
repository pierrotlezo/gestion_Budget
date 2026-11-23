import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Transaction } from '../../db/schema';
import { useCategories, useTransactions } from '../../hooks/data';
import { useInsights } from '../../hooks/insights';
import { currentMonth, monthOf, type MonthKey } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { summarizeMonth } from '../../domain/budget/totals';
import { Button, EmptyState, MoneyInput, ProgressBar } from '../../components/ui';
import { updateCategory } from '../categories/categoryService';
import { TipCard } from '../tips/TipCard';
import { MonthSwitcher } from './MonthSwitcher';
import { TransactionRows } from './TransactionRows';
import { TransactionForm } from './TransactionForm';
import { useRuleSuggestion } from './RuleSuggestion';
import { saveTransaction } from './transactionService';

/** Page d'une catégorie : total du mois, budget, opérations, astuces. « __none » = opérations à trier. */
export function CategoryDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const month: MonthKey = params.get('mois') ?? currentMonth();
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const insights = useInsights();
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const { propose, dialog } = useRuleSuggestion();
  const isInbox = id === '__none';
  const category = catMap.get(id);

  const list = useMemo(
    () => transactions.filter((t) => monthOf(t.date) === month && (isInbox ? !t.categoryId || !catMap.has(t.categoryId) : t.categoryId === id)),
    [transactions, month, id, isInbox, catMap],
  );
  const total = useMemo(() => summarizeMonth(transactions, categories, month).byCategory.find((c) => c.category.id === id), [transactions, categories, month, id]);
  const avg = insights.avgByCategory.get(id) ?? 0;
  const tips = insights.all.filter((s) => s.tip.categoryId === id && !s.status).slice(0, 2);
  const q = month === currentMonth() ? '' : `?mois=${month}`;

  const assign = async (t: Transaction, categoryId: string) => {
    const updated = { ...t, categoryId };
    await saveTransaction(updated);
    propose(updated);
  };

  if (!isInbox && !category) return <EmptyState>Catégorie introuvable. <Link to="/depenses" className="underline">Retour</Link></EmptyState>;

  return (
    <div className="space-y-6">
      <Link to={`/depenses${q}`} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">← Toutes les catégories</Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl text-4xl" style={{ backgroundColor: `${category?.color ?? '#f97316'}22` }} aria-hidden>{isInbox ? '📥' : (category!.icon ?? '🏷️')}</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{isInbox ? 'À trier' : category!.name}</h1>
            {!isInbox && <div className="text-3xl font-bold">{formatEUR(total?.amount ?? 0)}</div>}
          </div>
        </div>
        <MonthSwitcher month={month} onChange={(m) => setParams(m === currentMonth() ? {} : { mois: m })} />
      </div>

      {!isInbox && category!.kind !== 'income' && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Budget mensuel</span>
              <div className="w-32"><MoneyInput value={category!.monthlyBudget} onChange={(v) => updateCategory(category!.id, { monthlyBudget: v })} aria-label="Budget mensuel" /></div>
            </div>
            {avg > 0 && (
              <div className="text-sm text-slate-500">
                Ta moyenne : <strong className="text-slate-700 dark:text-slate-200">{formatEUR(avg, { round: true })}</strong>
                {total && total.amount > 0 && month === currentMonth() && <span> · ce mois-ci {total.amount > avg ? '📈' : '📉'} {Math.round(((total.amount - avg) / avg) * 100)} %</span>}
              </div>
            )}
          </div>
          {category!.monthlyBudget > 0 && total && (
            <div className="mt-3">
              <ProgressBar ratio={total.ratio} status={total.status} />
              <div className="mt-1 text-xs text-slate-500">{total.status === 'over' ? `⛔ Dépassé de ${formatEUR(total.amount - total.budget)}` : `Il reste ${formatEUR(total.budget - total.amount)}`}</div>
            </div>
          )}
        </div>
      )}

      {tips.length > 0 && <div className="grid gap-4 md:grid-cols-2">{tips.map((s) => <TipCard key={s.tip.id} s={s} />)}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{list.length} opération{list.length > 1 ? 's' : ''}</h2>
        {!isInbox && <Button variant="primary" onClick={() => setEditing('new')}>+ Ajouter</Button>}
      </div>

      {list.length === 0 ? (
        <EmptyState>{isInbox ? 'Tout est trié 🎉' : 'Aucune opération ce mois-ci.'}</EmptyState>
      ) : (
        <TransactionRows
          transactions={list}
          categories={catMap}
          onOpen={setEditing}
          renderExtra={
            isInbox
              ? (t) => (
                  <div className="flex gap-1.5 overflow-x-auto px-4 pb-3">
                    {categories.filter((c) => (t.amount < 0 ? c.kind !== 'income' : c.kind === 'income')).map((c) => (
                      <button key={c.id} type="button" onClick={() => assign(t, c.id)} title={c.name} className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                        <span aria-hidden>{c.icon}</span>{c.name}
                      </button>
                    ))}
                  </div>
                )
              : undefined
          }
        />
      )}

      {editing && (
        <TransactionForm
          initial={editing === 'new' ? undefined : editing}
          defaultCategoryId={editing === 'new' && !isInbox ? id : undefined}
          onClose={() => setEditing(null)}
          onSaved={(t, manual) => manual && propose(t)}
        />
      )}
      {dialog}
    </div>
  );
}
