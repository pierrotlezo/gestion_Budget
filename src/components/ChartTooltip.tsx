import { formatEUR } from '../domain/money';

/** Infobulle commune aux graphiques Recharts (texte en couleurs neutres, pastille de couleur à côté). */
export function ChartTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string | number; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {label !== undefined && <div className="mb-1 font-semibold">{labelFormatter ? labelFormatter(String(label)) : label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color ?? p.payload?.fill }} />
          <span className="text-slate-600 dark:text-slate-300">{p.name}</span>
          <span className="ml-auto pl-3 font-medium">{formatEUR(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
