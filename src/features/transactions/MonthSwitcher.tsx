import { addMonthsToKey, currentMonth, formatMonth, type MonthKey } from '../../domain/dates';
import { Button } from '../../components/ui';

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onChange(addMonthsToKey(month, -1))} aria-label="Mois précédent">◀</Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
      <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onChange(addMonthsToKey(month, 1))} aria-label="Mois suivant" disabled={month >= currentMonth()}>▶</Button>
    </div>
  );
}
