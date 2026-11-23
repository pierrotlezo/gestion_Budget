import { Link } from 'react-router-dom';
import { formatEUR } from '../domain/money';
import { ColorDot, EmptyState } from './ui';

export interface BreakdownItem {
  key: string;
  name: string;
  value: number;
  color: string;
  icon?: string;
  /** Lien vers le détail (ex. la page de la catégorie). */
  to?: string;
}

/**
 * Répartition en barres horizontales, de la plus grosse à la plus petite :
 * plus lisible qu'un anneau pour comparer des montants. Total en haut.
 */
export function BreakdownBars({ items, totalLabel, empty = 'Rien à afficher pour le moment.' }: { items: BreakdownItem[]; totalLabel?: string; empty?: string }) {
  const data = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((s, d) => s + d.value, 0);
  const max = data[0]?.value ?? 0;
  if (data.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div>
      {totalLabel && (
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm text-slate-500">{totalLabel}</span>
          <span className="text-2xl font-bold">{formatEUR(total)}</span>
        </div>
      )}
      <ul className="space-y-3">
        {data.map((d) => {
          const row = (
            <>
              <div className="mb-1 flex items-center gap-2 text-sm">
                {d.icon ? <span aria-hidden className="w-5 text-center">{d.icon}</span> : <ColorDot color={d.color} />}
                <span className="min-w-0 truncate font-medium">{d.name}</span>
                <span className="ml-auto shrink-0 font-semibold">{formatEUR(d.value)}</span>
                <span className="w-10 shrink-0 text-right text-xs text-slate-500">{Math.round((d.value / total) * 100)} %</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: d.color }} />
              </div>
            </>
          );
          return (
            <li key={d.key}>
              {d.to ? <Link to={d.to} className="-mx-2 block rounded-xl px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">{row}</Link> : row}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
