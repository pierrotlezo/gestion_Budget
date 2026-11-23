import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCategories, useLoans, useSavingsAccounts, useSavingsMovements, useSettings, updateSettings, useTransactions } from '../../hooks/data';
import type { LoanPlanSettings } from '../../db/schema';
import { planLoan } from '../../domain/loan/plan';
import { balanceAt, rateAt } from '../../domain/savings/quinzaine';
import { summarizeMonth } from '../../domain/budget/totals';
import { addMonthsToKey, currentMonth, lastMonths, todayISO } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { Alert, Button, MoneyInput } from '../../components/ui';

const monthYear = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const years = (months: number) => {
  const y = months / 12;
  return `${y.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} an${y >= 2 ? 's' : ''}`;
};

/** « Combien vais-je rembourser chaque mois dans 5 ans ? » — en fonction de ce que je dépense. */
export function LoanPlanPage() {
  const loans = useLoans();
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const settings = useSettings();
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const loan = loans[0];
  const plan = settings.loanPlan;
  const today = todayISO();
  const setPlan = (patch: Partial<LoanPlanSettings>) => updateSettings({ loanPlan: { ...plan, ...patch } });

  const funded = accounts.filter((a) => a.fundedByLoanId === loan?.id);
  const fundedBalance = funded.reduce((s, a) => s + balanceAt(movements.filter((m) => m.accountId === a.id), today), 0);
  const available = plan.availableOverride ?? fundedBalance;

  // Besoin mensuel estimé : dépenses moyennes − rentrées d'argent qui ne viennent pas du prêt
  const need = useMemo(() => {
    const months = lastMonths(addMonthsToKey(currentMonth(), -1), 3).map((m) => summarizeMonth(transactions, categories, m)).filter((s) => s.spent > 0);
    if (!months.length) return null;
    const spent = months.reduce((s, m) => s + m.spent, 0) / months.length;
    const otherIncome = months.reduce((s, m) => s + m.byCategory.filter((c) => c.category.kind === 'income' && c.category.id !== 'cat-virement-livret').reduce((a, c) => a + c.amount, 0), 0) / months.length;
    return { spent: Math.round(spent), otherIncome: Math.round(otherIncome), need: Math.max(0, Math.round((spent - otherIncome) / 1000) * 1000) };
  }, [transactions, categories]);

  const result = useMemo(
    () =>
      loan
        ? planLoan({ loan, today, available, savingsRate: rateAt(settings.livretARates, today), monthlyDraw: plan.monthlyDraw, drawMonths: Math.round(plan.drawYears * 12), payDeferralFromSavings: plan.payDeferralFromSavings && loan.deferral.type !== 'none' })
        : null,
    [loan, today, available, settings.livretARates, plan],
  );

  if (!loan || !result) return <Alert tone="info">Ajoute d'abord ton prêt dans l'onglet « Détails du prêt ».</Alert>;
  const saving = result.paymentNormal - result.paymentWithEarlyRepayment;

  return (
    <div className="space-y-6">
      {loan.annualRate === 0 && <Alert tone="warning">⚠️ Le taux du prêt est à 0 %. Renseigne-le dans <Link to="/pret/details" className="font-medium underline">Détails du prêt</Link> pour une estimation juste.</Alert>}

      {/* Réponse principale */}
      <section className="rounded-3xl bg-gradient-to-br from-sky-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <div className="text-sm text-sky-100">{result.repaymentStart ? `À partir de ${monthYear(result.repaymentStart)}, tu rembourseras environ` : 'Tu rembourses'}</div>
        <div className="mt-1 text-5xl font-bold tracking-tight">{formatEUR(result.paymentNormal, { round: true })}<span className="text-2xl font-semibold"> / mois</span></div>
        <div className="mt-1 text-sky-100">pendant {years(result.durationMonths)}</div>
        {result.leftAtRepayment > 0 && saving > 0 && (
          <div className="mt-4 inline-block rounded-2xl bg-white/15 px-4 py-2 text-sm">
            ou <strong>{formatEUR(result.paymentWithEarlyRepayment, { round: true })} / mois</strong> si tu rembourses d'un coup les {formatEUR(result.leftAtRepayment, { round: true })} qui te resteront
          </div>
        )}
      </section>

      {/* Réglages du plan */}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-lg font-semibold">Mon rythme de vie</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between text-sm"><span>Je prends sur l'argent du prêt</span><strong className="text-lg">{formatEUR(plan.monthlyDraw, { round: true })} / mois</strong></div>
            <input type="range" min={0} max={200000} step={1000} value={plan.monthlyDraw} onChange={(e) => setPlan({ monthlyDraw: Number(e.target.value) })} className="mt-2 w-full accent-indigo-600" aria-label="Montant prélevé par mois" />
            {need && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>D'après tes dépenses : {formatEUR(need.spent, { round: true })}/mois − {formatEUR(need.otherIncome, { round: true })} d'autres rentrées = <strong>{formatEUR(need.need, { round: true })}</strong></span>
                <Button size="sm" onClick={() => setPlan({ monthlyDraw: need.need })}>Utiliser</Button>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm"><span>Pendant</span><strong className="text-lg">{years(plan.drawYears * 12)}</strong></div>
            <input type="range" min={0} max={Math.max(1, Math.ceil(result.monthsUntilRepayment / 6) / 2)} step={0.5} value={plan.drawYears} onChange={(e) => setPlan({ drawYears: Number(e.target.value) })} className="mt-2 w-full accent-indigo-600" aria-label="Durée en années" />
            <div className="mt-2 text-xs text-slate-500">Ensuite, l'argent restant attend sur le livret jusqu'au début des remboursements.</div>
          </div>
          <div>
            <div className="mb-1 text-sm">Argent du prêt disponible aujourd'hui</div>
            <div className="flex items-center gap-2">
              <div className="w-40"><MoneyInput value={available} onChange={(v) => setPlan({ availableOverride: v })} aria-label="Argent disponible" /></div>
              {plan.availableOverride !== null && <Button size="sm" variant="ghost" onClick={() => setPlan({ availableOverride: null })}>Revenir au solde des livrets ({formatEUR(fundedBalance, { round: true })})</Button>}
            </div>
            <div className="mt-1 text-xs text-slate-500">Par défaut : le solde des livrets alimentés par le prêt ({funded.map((a) => a.name).join(', ') || 'aucun'}). Ajoute ici l'argent placé ailleurs.</div>
          </div>
          {loan.deferral.type === 'partial' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={plan.payDeferralFromSavings} onChange={(e) => setPlan({ payDeferralFromSavings: e.target.checked })} />
              <span>Je paie les intérêts du différé ({formatEUR(result.deferralMonthlyCost)}/mois) avec cet argent</span>
            </label>
          )}
        </div>
      </section>

      {result.runsOutAt && (
        <Alert tone="danger">⛔ À ce rythme, l'argent du prêt sera épuisé en <strong>{monthYear(result.runsOutAt)}</strong>, avant la fin de la période prévue.</Alert>
      )}

      {/* Frise */}
      <section className="grid gap-3 md:grid-cols-3">
        <Step color="bg-amber-400" icon="🧑‍🎓" title="Je vis avec le prêt" when={`Maintenant → ${monthYear(result.drawEnd)}`}>
          {formatEUR(plan.monthlyDraw, { round: true })}/mois · {formatEUR(result.totalDrawn, { round: true })} au total
        </Step>
        <Step color="bg-emerald-500" icon="🐷" title="L'argent restant est placé" when={`Jusqu'à ${result.repaymentStart ? monthYear(result.repaymentStart) : '—'}`}>
          +{formatEUR(result.interestEarned, { round: true })} d'intérêts (Livret A {formatPercent(rateAt(settings.livretARates, today))})
          {result.deferralCostPaid > 0 && <> · −{formatEUR(result.deferralCostPaid, { round: true })} d'intérêts du différé</>}
          <div className="mt-1 font-semibold">Il restera {formatEUR(result.leftAtRepayment, { round: true })}</div>
        </Step>
        <Step color="bg-indigo-500" icon="🏦" title="Je rembourse" when={`Pendant ${years(result.durationMonths)}`}>
          {formatEUR(result.capitalAtRepayment, { round: true })} à rembourser
        </Step>
      </section>

      {/* Les deux options */}
      {result.leftAtRepayment > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          <Option title="Option A · Je garde mon épargne" payment={result.paymentNormal} detail={`Tu gardes ${formatEUR(result.leftAtRepayment, { round: true })} de côté.`} />
          <Option title="Option B · Je rembourse une partie d'un coup" payment={result.paymentWithEarlyRepayment} detail={`Tu utilises les ${formatEUR(result.leftAtRepayment, { round: true })} restants : ${formatEUR(saving, { round: true })} de moins chaque mois.`} highlight />
        </section>
      )}

      <p className="text-xs text-slate-500">
        Estimation : le livret est compté au taux actuel (crédité chaque mois), le taux du prêt est celui saisi dans les détails. Un remboursement anticipé peut entraîner des frais (au maximum 6 mois d'intérêts et 3 % du capital remboursé) : vérifie ton contrat.
      </p>
    </div>
  );
}

function Step({ color, icon, title, when, children }: { color: string; icon: string; title: string; when: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`h-1.5 ${color}`} />
      <div className="p-4">
        <div className="flex items-center gap-2 font-semibold"><span className="text-xl" aria-hidden>{icon}</span>{title}</div>
        <div className="text-xs text-slate-500">{when}</div>
        <div className="mt-2 text-sm">{children}</div>
      </div>
    </div>
  );
}

function Option({ title, payment, detail, highlight }: { title: string; payment: number; detail: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</div>
      <div className="mt-1 text-3xl font-bold">{formatEUR(payment, { round: true })}<span className="text-base font-medium"> / mois</span></div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  );
}
