import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLoans, useSavingsAccounts, useSavingsMovements, useSettings } from '../../hooks/data';
import { netWorthSeries } from '../../domain/netWorth';
import { formatMonth, monthOf, todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { chartChrome } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Card, PageHeader } from '../../components/ui';
import { ChartTooltip } from '../../components/ChartTooltip';
import { ComparisonCard } from './ComparisonCard';

export function LoanVsSavingsPage() {
  const loans = useLoans();
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const settings = useSettings();
  const dark = useIsDark();
  const chrome = chartChrome(dark);
  const today = todayISO();
  const series = useMemo(() => netWorthSeries(loans, { accounts, movements, settings, today }, 6, 24), [loans, accounts, movements, settings, today]);

  return (
    <div className="space-y-6">
      <PageHeader title="Prêt vs épargne" subtitle="L'argent emprunté et placé te coûte-t-il ou te rapporte-t-il ?" />
      <ComparisonCard />
      <Card title="Livrets − capital restant dû (projection sur 2 ans)">
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} />
              <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, true)} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
              <YAxis tickFormatter={(v) => formatEUR(v, { round: true })} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} width={90} />
              <Tooltip content={<ChartTooltip labelFormatter={(m) => formatMonth(m)} />} />
              <ReferenceLine y={0} stroke={chrome.axis} />
              <ReferenceLine x={monthOf(today)} stroke={chrome.axis} strokeDasharray="4 4" label={{ value: 'Projection →', fill: chrome.axis, fontSize: 11, position: 'insideTopLeft' }} />
              <Line type="linear" dataKey="netWorth" name="Livrets − prêt" stroke={chrome.income} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">Les retraits mensuels de {formatEUR(settings.monthlyTransfer)} diminuent les livrets sans diminuer la dette. Les placements (PEA, BTC…) ne sont pas inclus dans cette courbe.</p>
      </Card>
    </div>
  );
}
