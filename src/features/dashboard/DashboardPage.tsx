import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCategories, useTransactions } from '../../hooks/data';
import { addMonthsToKey, currentMonth, formatMonth, type MonthKey } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { monthlyHistory, summarizeMonth, type CategoryTotal } from '../../domain/budget/totals';
import { chartChrome, seriesColor } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Alert, Button, Card, ColorDot, EmptyState, PageHeader, ProgressBar, Stat, Table } from '../../components/ui';
import { ChartTooltip } from '../../components/ChartTooltip';

export function DashboardPage() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const [month, setMonth] = useState<MonthKey>(currentMonth());
  const dark = useIsDark();
  const chrome = chartChrome(dark);

  const summary = useMemo(() => summarizeMonth(transactions, categories, month), [transactions, categories, month]);
  const history = useMemo(() => monthlyHistory(transactions, categories, month, 12), [transactions, categories, month]);
  const expectedIncome = categories.filter((c) => c.kind === 'income').reduce((s, c) => s + c.monthlyBudget, 0);

  const spending = summary.byCategory.filter((c) => c.category.kind !== 'income');
  const withBudget = spending.filter((c) => c.budget > 0 || c.amount > 0);
  const donut = spending.filter((c) => c.amount > 0).map((c) => ({ name: c.category.name, value: c.amount, fill: seriesColor(c.category.color, dark) }));
  if (summary.uncategorizedOut > 0) donut.push({ name: 'À catégoriser', value: summary.uncategorizedOut, fill: dark ? '#64748b' : '#94a3b8' });
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setMonth((m) => addMonthsToKey(m, -1))} aria-label="Mois précédent">◀</Button>
            <span className="min-w-36 text-center font-semibold capitalize">{formatMonth(month)}</span>
            <Button onClick={() => setMonth((m) => addMonthsToKey(m, 1))} aria-label="Mois suivant">▶</Button>
            {month !== currentMonth() && <Button variant="ghost" onClick={() => setMonth(currentMonth())}>Aujourd'hui</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Entrées" value={formatEUR(summary.income)} hint={expectedIncome > 0 ? `Attendu : ${formatEUR(expectedIncome)}` : undefined} />
        <Stat label="Dépensé" value={formatEUR(summary.spent)} />
        <Stat label="Reste du mois" value={formatEUR(summary.remaining)} tone={summary.remaining < 0 ? 'negative' : 'positive'} />
      </div>

      {summary.uncategorizedIn + summary.uncategorizedOut > 0 && (
        <div className="mb-4">
          <Alert tone="info">
            Des opérations de ce mois ne sont pas catégorisées.{' '}
            <Link to="/transactions" className="font-medium underline">Les catégoriser</Link>
          </Alert>
        </div>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card title="Budget par catégorie">
          {withBudget.length === 0 ? (
            <EmptyState>Aucun budget ni dépense ce mois-ci.</EmptyState>
          ) : (
            <div className="space-y-3">
              {withBudget.map((c) => (
                <BudgetLine key={c.category.id} total={c} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Répartition des dépenses">
          {donut.length === 0 ? (
            <EmptyState>Aucune dépense ce mois-ci.</EmptyState>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={donut.length > 1 ? 1 : 0} stroke={chrome.surface} strokeWidth={2} isAnimationActive={false}>
                      {donut.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Légende + tableau : l'identité ne repose jamais sur la couleur seule */}
              <ul className="w-full min-w-0 flex-1 space-y-1 text-sm">
                {donut.map((d) => (
                  <li key={d.name} className="flex items-center gap-2">
                    <ColorDot color={d.fill} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto shrink-0 font-medium">{formatEUR(d.value)}</span>
                    <span className="w-9 shrink-0 text-right text-xs text-slate-500">{Math.round((d.value / donutTotal) * 100)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Évolution sur 12 mois">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={history} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={chrome.grid} />
              <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m, true)} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => formatEUR(v, { round: true })} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} width={80} />
              <Tooltip content={<ChartTooltip labelFormatter={(m) => formatMonth(m)} />} cursor={{ fill: chrome.grid, opacity: 0.5 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: chrome.text }}>{v}</span>} />
              <Bar dataKey="income" name="Entrées" fill={chrome.income} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="spent" name="Dépenses" fill={chrome.spent} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-500">Voir le tableau</summary>
          <Table>
            <thead>
              <tr><th>Mois</th><th className="text-right!">Entrées</th><th className="text-right!">Dépenses</th><th className="text-right!">Reste</th></tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h) => (
                <tr key={h.month}>
                  <td className="capitalize">{formatMonth(h.month)}</td>
                  <td className="text-right">{formatEUR(h.income)}</td>
                  <td className="text-right">{formatEUR(h.spent)}</td>
                  <td className={`text-right font-medium ${h.remaining < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{formatEUR(h.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </details>
      </Card>
    </div>
  );
}

function BudgetLine({ total: t }: { total: CategoryTotal }) {
  // Arrondi vers le bas : 79,8 % s'affiche « 79 % » (cohérent avec le seuil orange à 80 %)
  const pct = Math.floor(t.ratio * 100);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        <ColorDot color={t.category.color} />
        <span className="font-medium">{t.category.name}</span>
        <span className="ml-auto">
          {formatEUR(t.amount)}
          {t.budget > 0 && <span className="text-slate-500"> / {formatEUR(t.budget)}</span>}
        </span>
      </div>
      {t.budget > 0 ? (
        <>
          <ProgressBar ratio={t.ratio} status={t.status} />
          <div className="mt-0.5 text-xs">
            {t.status === 'over' ? (
              <span className="text-red-600 dark:text-red-400">⛔ Dépassé de {formatEUR(t.amount - t.budget)} ({pct} %)</span>
            ) : t.status === 'warning' ? (
              <span className="text-orange-600 dark:text-orange-400">⚠️ {pct} % utilisé · reste {formatEUR(t.budget - t.amount)}</span>
            ) : (
              <span className="text-slate-500">{pct} % · reste {formatEUR(t.budget - t.amount)}</span>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs text-slate-500">Pas de budget défini</div>
      )}
    </div>
  );
}
