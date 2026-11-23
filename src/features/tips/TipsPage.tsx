import { useEffect, useState } from 'react';
import { useCategoryMap, useSettings } from '../../hooks/data';
import { setTipStatus, useInsights } from '../../hooks/insights';
import { fetchDeals } from '../../services/deals';
import type { Deal } from '../../domain/tips/deals';
import type { Subscription } from '../../domain/tips/subscriptions';
import type { Category } from '../../db/schema';
import { formatDateFR } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Alert, Button, Card, EmptyState, PageHeader } from '../../components/ui';
import { TipCard } from './TipCard';

const FEED_LABELS: Record<string, string> = {
  epicerie: '🛒 Courses', restaurants: '🍽️ Restos', energie: '⚡ Énergie', 'forfaits-mobiles': '📱 Forfaits', telephonie: '📱 Téléphonie',
  'transports-en-commun': '🚆 Transports', voyages: '🧳 Voyages', sorties: '🎟️ Sorties', cinema: '🎬 Cinéma', 'culture-divertissement': '🎭 Culture', gratuit: '🎁 Gratuit',
};

export function TipsPage() {
  const insights = useInsights();
  const settings = useSettings();
  const categories = useCategoryMap();
  const [showAll, setShowAll] = useState(false);
  const subsTotal = insights.subscriptions.reduce((s, x) => s + x.amount, 0);
  const bills = insights.recurring.filter((r) => !insights.subscriptions.includes(r));
  const others = insights.all.filter((s) => !s.status && !insights.ofTheMonth.includes(s));
  const dismissed = insights.all.filter((s) => s.status === 'dismissed' || s.status === 'done');

  return (
    <div className="space-y-8">
      <PageHeader title="Astuces & bons plans" subtitle="Choisies d'après tes dépenses. Elles changent chaque mois." />

      <section>
        <h2 className="mb-3 text-lg font-semibold">💡 Ce mois-ci</h2>
        {insights.ofTheMonth.length === 0 ? (
          <EmptyState>Importe quelques relevés pour recevoir des astuces adaptées à tes dépenses.</EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">{insights.ofTheMonth.map((s) => <TipCard key={s.tip.id} s={s} />)}</div>
        )}
      </section>

      {insights.trying.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">💪 En cours</h2>
          <div className="grid gap-4 md:grid-cols-3">{insights.trying.map((s) => <TipCard key={s.tip.id} s={s} compact />)}</div>
        </section>
      )}

      <Card title={`📱 Tes abonnements${insights.subscriptions.length ? ` · ${formatEUR(subsTotal)} / mois` : ''}`}>
        {insights.subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun abonnement régulier détecté sur les derniers mois.</p>
        ) : (
          <>
            <RecurringList items={insights.subscriptions} categories={categories} />
            <p className="mt-3 text-sm text-slate-500">Soit <strong>{formatEUR(subsTotal * 12, { round: true })} par an</strong>. Lequel utilises-tu vraiment ?</p>
          </>
        )}
        {bills.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Autres prélèvements réguliers</div>
            <RecurringList items={bills} categories={categories} />
          </div>
        )}
      </Card>

      {settings.autoDeals ? (insights.ready && <Deals feeds={insights.feeds} />) : (
        <Alert tone="info">Les bons plans du moment sont désactivés (Réglages → Paramètres).</Alert>
      )}

      {others.length > 0 && (
        <section>
          <Button onClick={() => setShowAll((v) => !v)}>{showAll ? 'Masquer' : `Voir ${others.length} autre(s) astuce(s)`}</Button>
          {showAll && <div className="mt-4 grid gap-4 md:grid-cols-3">{others.map((s) => <TipCard key={s.tip.id} s={s} />)}</div>}
        </section>
      )}

      {dismissed.length > 0 && (
        <p className="text-xs text-slate-500">
          {dismissed.length} astuce(s) adoptée(s) ou écartée(s).{' '}
          <button type="button" className="underline" onClick={() => dismissed.forEach((s) => setTipStatus(s.tip.id, null))}>Les remettre dans la liste</button>
        </p>
      )}
    </div>
  );
}

function RecurringList({ items, categories }: { items: Subscription[]; categories: Map<string, Category> }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-3 py-2.5 text-sm">
          <span className="text-lg" aria-hidden>{(s.categoryId && categories.get(s.categoryId)?.icon) || '🔁'}</span>
          <span className="min-w-0 truncate font-medium">{s.label}</span>
          {s.increase && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">⚠️ Hausse : {formatEUR(s.increase.from)} → {formatEUR(s.increase.to)}</span>}
          <span className="ml-auto shrink-0 font-semibold">{formatEUR(s.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function Deals({ feeds }: { feeds: string[] }) {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState('');
  const key = feeds.join(',');
  useEffect(() => {
    // On ignore les réponses d'une requête précédente (sinon un ancien choix de flux peut écraser le bon)
    let current = true;
    setDeals(null);
    setError('');
    fetchDeals(feeds)
      .then((d) => current && setDeals(d))
      .catch((e) => current && setError((e as Error).message));
    return () => {
      current = false;
    };
  }, [key]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">🔥 Bons plans du moment</h2>
        <span className="text-xs text-slate-500">Pour tes plus grosses dépenses : {feeds.map((f) => FEED_LABELS[f] ?? f).join(' · ')} · source Dealabs</span>
      </div>
      {error ? <Alert tone="warning">{error}</Alert> : !deals ? <p className="text-sm text-slate-500">Chargement…</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((d) => (
            <a key={d.link} href={d.link} target="_blank" rel="noopener noreferrer" className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <span className="mb-1 text-xs text-slate-500">{FEED_LABELS[d.feed] ?? d.feed}</span>
              <span className="line-clamp-3 flex-1 font-medium">{d.title}</span>
              <span className="mt-2 flex items-center gap-2">
                {d.price && <strong className="text-emerald-600 dark:text-emerald-400">{d.price}</strong>}
                {d.merchant && <span className="truncate text-slate-500">{d.merchant}</span>}
                {d.date && <span className="ml-auto shrink-0 text-xs text-slate-400">{formatDateFR(d.date.slice(0, 10))}</span>}
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
