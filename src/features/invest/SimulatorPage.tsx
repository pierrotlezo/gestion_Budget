import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, newId } from '../../db/db';
import type { SimScenario } from '../../db/schema';
import { useCategories, useScenarios, useSettings, useTransactions } from '../../hooks/data';
import { rateAt } from '../../domain/savings/quinzaine';
import { simulate } from '../../domain/invest/compound';
import { averagePotential } from '../../domain/budget/capacity';
import { currentMonth, todayISO } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { CATEGORICAL, chartChrome, seriesColor } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Alert, Button, Card, ColorDot, Field, Input, MoneyInput, PageHeader, PercentInput, Table } from '../../components/ui';
import { ChartTooltip } from '../../components/ChartTooltip';

/** Au-delà de 4 courbes, le graphique devient illisible. */
const MAX_SCENARIOS = 4;

export function SimulatorPage() {
  const scenarios = useScenarios();
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const settings = useSettings();
  const dark = useIsDark();
  const chrome = chartChrome(dark);
  const avg = useMemo(() => averagePotential(transactions, categories, currentMonth(), 3), [transactions, categories]);

  const results = useMemo(() => scenarios.map((s) => ({ scenario: s, points: simulate(s) })), [scenarios]);
  const maxYears = Math.max(0, ...scenarios.map((s) => s.years));
  const data = Array.from({ length: maxYears + 1 }, (_, year) => {
    const row: Record<string, number> = { year };
    for (const r of results) if (r.points[year]) row[r.scenario.id] = r.points[year].value;
    return row;
  });

  const update = (id: string, patch: Partial<SimScenario>) => db.scenarios.update(id, patch);
  const add = () => {
    const used = new Set(scenarios.map((s) => s.color));
    db.scenarios.add({ id: newId(), name: `Scénario ${scenarios.length + 1}`, initial: 0, monthly: avg.average > 0 ? Math.round(avg.average / 1000) * 1000 : 10000, years: 10, annualReturn: 0.05, color: CATEGORICAL.find((c) => !used.has(c)) ?? CATEGORICAL[0] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulateur d'intérêts composés"
        subtitle="Compare ce que deviendrait ton épargne selon où tu la places."
        actions={
          <>
            {avg.average > 0 && <Button onClick={() => scenarios.forEach((s) => update(s.id, { monthly: Math.round(avg.average / 1000) * 1000 }))}>Utiliser mon potentiel ({formatEUR(avg.average, { round: true })}/mois)</Button>}
            <Button variant="primary" onClick={add} disabled={scenarios.length >= MAX_SCENARIOS}>+ Scénario</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <Card key={s.id}>
            <div className="mb-3 flex items-center gap-2">
              <ColorDot color={seriesColor(s.color, dark)} size={12} />
              <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} className="py-1! font-semibold" aria-label="Nom du scénario" />
              <Button size="sm" variant="ghost" onClick={() => db.scenarios.delete(s.id)} aria-label={`Supprimer ${s.name}`}>✕</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Départ"><MoneyInput value={s.initial} onChange={(v) => update(s.id, { initial: v })} /></Field>
              <Field label="Par mois"><MoneyInput value={s.monthly} onChange={(v) => update(s.id, { monthly: v })} /></Field>
              <Field label="Durée (ans)"><Input type="number" min={1} max={50} value={s.years} onChange={(e) => update(s.id, { years: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
              <Field label="Rendement annuel"><PercentInput value={s.annualReturn} onChange={(v) => update(s.id, { annualReturn: v })} /></Field>
            </div>
          </Card>
        ))}
      </div>

      {scenarios.length > 0 && (
        <Card title="Évolution de la valeur">
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chrome.grid} />
                <XAxis dataKey="year" tickFormatter={(y) => `${y} an${y > 1 ? 's' : ''}`} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v) => formatEUR(v, { round: true })} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} width={90} />
                <Tooltip content={<ChartTooltip labelFormatter={(y) => `Après ${y} an(s)`} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: chrome.text }}>{v}</span>} />
                {scenarios.map((s) => (
                  <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={seriesColor(s.color, dark)} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <Table>
              <thead><tr><th>Scénario</th><th className="text-right!">Rendement</th><th className="text-right!">Total versé</th><th className="text-right!">Intérêts gagnés</th><th className="text-right!">Valeur finale</th></tr></thead>
              <tbody>
                {results.map(({ scenario: s, points }) => {
                  const last = points.at(-1)!;
                  return (
                    <tr key={s.id}>
                      <td><span className="inline-flex items-center gap-2"><ColorDot color={seriesColor(s.color, dark)} />{s.name} <span className="text-xs text-slate-500">({s.years} ans)</span></span></td>
                      <td className="text-right">{formatPercent(s.annualReturn)}</td>
                      <td className="text-right">{formatEUR(last.contributed, { round: true })}</td>
                      <td className="text-right text-emerald-600 dark:text-emerald-400">+{formatEUR(last.gains, { round: true })}</td>
                      <td className="text-right font-semibold">{formatEUR(last.value, { round: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      <Alert tone="info">
        Les rendements sont des hypothèses, pas des promesses. Pour comparer : Livret A {formatPercent(rateAt(settings.livretARates, todayISO()))} (garanti) ; un ETF actions monde a fait en moyenne autour de 7 % par an sur le long terme, avec de fortes baisses certaines années ; le bitcoin est très volatil et peut perdre une grande partie de sa valeur. Pour l'argent placé en bourse ou en crypto, vise plusieurs années.
      </Alert>
    </div>
  );
}
