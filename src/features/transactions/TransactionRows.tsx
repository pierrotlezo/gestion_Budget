import type { ReactNode } from 'react';
import type { Category, Transaction } from '../../db/schema';
import { formatEUR } from '../../domain/money';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Liste d'opérations groupées par jour, sans texte superflu. Un clic ouvre la modification. */
export function TransactionRows({ transactions, categories, onOpen, renderExtra }: { transactions: Transaction[]; categories: Map<string, Category>; onOpen: (t: Transaction) => void; renderExtra?: (t: Transaction) => ReactNode }) {
  const days = new Map<string, Transaction[]>();
  for (const t of transactions) days.set(t.date, [...(days.get(t.date) ?? []), t]);
  return (
    <div className="space-y-4">
      {[...days.entries()].map(([date, list]) => (
        <div key={date}>
          <div className="mb-1 px-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{dayFmt.format(new Date(`${date}T12:00:00`))}</div>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {list.map((t) => {
              const c = t.categoryId ? categories.get(t.categoryId) : undefined;
              return (
                <li key={t.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => onOpen(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: c ? `${c.color}22` : '#f9731622' }} aria-hidden>{c?.icon ?? '❔'}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.label}</span>
                        <span className="block truncate text-xs text-slate-500">{c?.name ?? 'À trier'}{t.note ? ` · ${t.note}` : ''}</span>
                      </span>
                      <span className={`ml-auto shrink-0 font-semibold ${t.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatEUR(t.amount, { sign: true })}</span>
                    </button>
                  </div>
                  {renderExtra?.(t)}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
