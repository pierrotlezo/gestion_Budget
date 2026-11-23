import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLoans, useSavingsAccounts, useSavingsMovements, useSettings } from '../../hooks/data';
import { currentNetWorth, netWorthSeries } from '../../domain/netWorth';
import { formatMonth, monthOf, todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { chartChrome } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Card, PageHeader, Stat, Table } from '../../components/ui';
import { ChartTooltip } from '../../components/ChartTooltip';
import { ComparisonCard } from '../loan/ComparisonCard';

export function NetWorthPage() {
  const loans = useLoans();
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const settings = useSettings();
  const dark = useIsDark();
  const chrome = chartChrome(dark);
  const today = todayISO();
  const ctx = useMemo(() => ({ accounts, movements, settings, today }), [accounts, movements, settings, today]);
  const now = useMemo(() => currentNetWorth(loans, ctx), [loans, ctx]);
  const series = useMemo(() => netWorthSeries(loans, ctx, 12, 24), [loans, ctx]);

  return (
    <div>
      <PageHeader title="Patrimoine net" subtitle="Épargne − capital restant dû des prêts" />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Épargne totale" value={formatEUR(now.savings)} />
        <Stat label="Capital restant dû" value={formatEUR(now.debt)} />
        <Stat label="Patrimoine net" value={formatEUR(now.netWorth)} tone={now.netWorth < 0 ? 'negative' : 'positive'} />
      </div>

      <div className="mb-4 space-y-4">
        <ComparisonCard />
      </div>

      <Card title="Évolution du patrimoine net (12 derniers mois et projection sur 24 mois)">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} />
              <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, true)} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
              <YAxis tickFormatter={(v) => formatEUR(v, { round: true })} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} width={90} />
              <Tooltip content={<ChartTooltip labelFormatter={(m) => formatMonth(m)} />} />
              <ReferenceLine y={0} stroke={chrome.axis} />
              <ReferenceLine x={monthOf(today)} stroke={chrome.axis} strokeDasharray="4 4" label={{ value: 'Projection →', fill: chrome.axis, fontSize: 11, position: 'insideTopLeft' }} />
              <Line type="linear" dataKey="netWorth" name="Patrimoine net" stroke={chrome.income} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-500">Voir le tableau</summary>
          <Table>
            <thead><tr><th>Mois</th><th className="text-right!">Épargne</th><th className="text-right!">Capital restant dû</th><th className="text-right!">Patrimoine net</th></tr></thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.month} className={p.projected ? 'text-slate-500 italic' : ''}>
                  <td className="capitalize">{formatMonth(p.month)}{p.projected && ' (projection)'}</td>
                  <td className="text-right">{formatEUR(p.savings)}</td>
                  <td className="text-right">{formatEUR(p.debt)}</td>
                  <td className="text-right font-medium">{formatEUR(p.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </details>
        <p className="mt-2 text-xs text-slate-500">
          Le patrimoine net d'un prêt placé sur un livret est négatif : le capital emprunté est une dette, et les retraits mensuels de {formatEUR(settings.monthlyTransfer)} diminuent l'épargne sans diminuer la dette.
        </p>
      </Card>
    </div>
  );
}
