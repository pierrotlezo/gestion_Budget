import type { RatePeriod } from '../db/schema';
import { formatDateFR } from '../domain/dates';
import { Button, Input, PercentInput } from './ui';

/** Éditeur d'historique de taux : chaque ligne = un taux valable à partir d'une date. */
export function RateHistoryEditor({ value, onChange }: { value: RatePeriod[]; onChange: (v: RatePeriod[]) => void }) {
  const sorted = [...value].sort((a, b) => a.from.localeCompare(b.from));
  const update = (i: number, patch: Partial<RatePeriod>) => onChange(sorted.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {sorted.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-8 text-xs text-slate-500">dès le</span>
          <Input type="date" value={r.from} onChange={(e) => e.target.value && update(i, { from: e.target.value })} className="max-w-44" aria-label={`Date d'effet du taux ${i + 1}`} />
          <div className="w-28">
            <PercentInput value={r.rate} onChange={(rate) => update(i, { rate })} aria-label={`Taux ${i + 1}`} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange(sorted.filter((_, j) => j !== i))} disabled={sorted.length <= 1} aria-label="Supprimer ce taux">
            ✕
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        onClick={() => {
          const last = sorted[sorted.length - 1];
          const today = new Date();
          const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
          onChange([...sorted, { from, rate: last?.rate ?? 0 }]);
        }}
      >
        + Ajouter un taux
      </Button>
      {sorted.length > 0 && (
        <p className="text-xs text-slate-500">Taux en vigueur depuis le {formatDateFR(sorted[sorted.length - 1].from)}.</p>
      )}
    </div>
  );
}
