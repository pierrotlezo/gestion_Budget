import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatEUR } from '../domain/money';
import { chartChrome } from '../app/chartTheme';
import { useIsDark } from '../app/theme';
import { ChartTooltip } from './ChartTooltip';
import { ColorDot, EmptyState } from './ui';

export interface DonutItem {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

/** Anneau + légende chiffrée (la légende sert aussi de tableau : l'identité ne repose pas sur la couleur seule). */
export function Donut({ items, centerLabel, empty = 'Rien à afficher pour le moment.' }: { items: DonutItem[]; centerLabel?: string; empty?: string }) {
  const dark = useIsDark();
  const chrome = chartChrome(dark);
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    // Mise en page selon la largeur de la carte (container query), pas de la fenêtre
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={data.length > 1 ? 1 : 0} stroke={chrome.surface} strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && <span className="text-xs text-slate-500">{centerLabel}</span>}
          <span className="text-lg font-bold">{formatEUR(total, { round: true })}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <ColorDot color={d.color} />
            <span className="min-w-0 truncate">{d.icon && <span className="mr-1" aria-hidden>{d.icon}</span>}{d.name}</span>
            <span className="ml-auto shrink-0 font-medium">{formatEUR(d.value)}</span>
            <span className="w-10 shrink-0 text-right text-xs text-slate-500">{Math.round((d.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
