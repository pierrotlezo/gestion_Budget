import type { SuggestedTip } from '../../domain/tips/engine';
import { fillTip } from '../../domain/tips/engine';
import { formatEUR } from '../../domain/money';
import { TIP_XP } from '../../domain/gamification';
import { setTipStatus } from '../../hooks/insights';
import { Button } from '../../components/ui';

/** Une astuce d'économie, avec ses actions « J'essaie » / « Pas pour moi ». */
export function TipCard({ s, compact = false }: { s: SuggestedTip; compact?: boolean }) {
  const { tip } = s;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>{tip.icon}</span>
        <div className="min-w-0">
          <div className="font-semibold">{tip.title}</div>
          {s.saving > 0 && <div className="text-sm font-medium text-emerald-700 dark:text-emerald-400">≈ {formatEUR(s.saving, { round: true })} / mois</div>}
        </div>
      </div>
      {!compact && <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{fillTip(tip.text, s, (c) => formatEUR(c, { round: true }))}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {s.status === 'trying' ? (
          <>
            <Button size="sm" variant="primary" onClick={() => setTipStatus(tip.id, 'done')}>✅ Adopté (+{TIP_XP.done} XP)</Button>
            <Button size="sm" variant="ghost" onClick={() => setTipStatus(tip.id, null)}>Abandonner</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="primary" onClick={() => setTipStatus(tip.id, 'trying')}>💪 J'essaie (+{TIP_XP.trying} XP)</Button>
            <Button size="sm" variant="ghost" onClick={() => setTipStatus(tip.id, 'dismissed')}>Pas pour moi</Button>
          </>
        )}
        {tip.link && !compact && (
          <a href={tip.link.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-indigo-600 hover:underline dark:text-indigo-400">{tip.link.label} ↗</a>
        )}
      </div>
    </div>
  );
}
