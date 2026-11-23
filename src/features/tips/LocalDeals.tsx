import { useState } from 'react';
import { THEME_LABELS, type DealTheme } from '../../db/localSources';
import type { LocalDeal } from '../../domain/tips/localDeals';
import { formatDateFR } from '../../domain/dates';
import { useSettings } from '../../hooks/data';
import { useLocalDeals } from '../../services/localDeals';
import { Alert } from '../../components/ui';

/** Bons plans de la ville (presse locale, Crous, offres ski…), filtrables par thème. */
export function LocalDeals({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const settings = useSettings();
  const { deals, error } = useLocalDeals(settings.city, settings.autoDeals);
  const [theme, setTheme] = useState<DealTheme | 'all'>('all');
  if (!settings.autoDeals) return null;
  const shown = (deals ?? []).filter((d) => theme === 'all' || d.theme === theme).slice(0, limit ?? 30);
  const counts = new Map<DealTheme, number>();
  for (const d of deals ?? []) counts.set(d.theme, (counts.get(d.theme) ?? 0) + 1);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">📍 Bons plans à {settings.city}</h2>
        <span className="text-xs text-slate-500">Presse locale, Crous, offres ski · mis à jour toutes les 30 min</span>
      </div>
      {!compact && deals && deals.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {(['all', 'food', 'bars', 'ski', 'student', 'free'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)} className={`rounded-full px-3 py-1 text-sm ${theme === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
              {t === 'all' ? `Tout (${deals.length})` : `${THEME_LABELS[t]} (${counts.get(t) ?? 0})`}
            </button>
          ))}
        </div>
      )}
      {error ? <Alert tone="warning">{error}</Alert> : !deals ? <p className="text-sm text-slate-500">Recherche des bons plans…</p> : shown.length === 0 ? (
        <p className="text-sm text-slate-500">Rien de neuf dans cette catégorie pour le moment.</p>
      ) : (
        <div className={`grid gap-3 ${compact ? 'md:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {shown.map((d) => <DealCard key={d.link} d={d} />)}
        </div>
      )}
    </section>
  );
}

function DealCard({ d }: { d: LocalDeal }) {
  return (
    <a href={d.link} target="_blank" rel="noopener noreferrer" className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <span className="mb-1 text-xs text-slate-500">{THEME_LABELS[d.theme]}</span>
      <span className="line-clamp-3 flex-1 font-medium">{d.title}</span>
      <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        {d.price && <strong className="text-emerald-600 dark:text-emerald-400">{d.price}</strong>}
        <span className="truncate">{d.source}</span>
        {d.date && <span className="ml-auto shrink-0">{formatDateFR(d.date.slice(0, 10))}</span>}
      </span>
    </a>
  );
}
