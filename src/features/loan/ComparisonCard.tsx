import { useMemo } from 'react';
import type { Loan } from '../../db/schema';
import { useLoans, useSavingsAccounts, useSavingsMovements, useSettings } from '../../hooks/data';
import { compareLoanAndSavings } from '../../domain/netWorth';
import { formatDateFR, todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Card } from '../../components/ui';

/** Carte « Le prêt me coûte-t-il ou me rapporte-t-il ? » pour chaque prêt lié à un compte d'épargne. */
export function ComparisonCard() {
  const loans = useLoans();
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const settings = useSettings();
  const linked = loans.filter((l) => accounts.some((a) => a.fundedByLoanId === l.id));
  if (linked.length === 0) {
    return (
      <Card title="Prêt vs épargne">
        <p className="text-sm text-slate-500">Indique dans Épargne & Invest. → Livrets quel compte est alimenté par le prêt pour comparer son coût aux intérêts gagnés.</p>
      </Card>
    );
  }
  return (
    <>
      {linked.map((loan) => (
        <LoanComparison key={loan.id} loan={loan} ctx={{ accounts, movements, settings, today: todayISO() }} />
      ))}
    </>
  );
}

function LoanComparison({ loan, ctx }: { loan: Loan; ctx: Parameters<typeof compareLoanAndSavings>[1] }) {
  const c = useMemo(() => compareLoanAndSavings(loan, ctx), [loan, ctx.accounts, ctx.movements, ctx.settings]);
  const fundedNames = ctx.accounts.filter((a) => a.fundedByLoanId === loan.id).map((a) => a.name).join(', ');
  return (
    <Card title={`${loan.name} vs ${fundedNames}`}>
      {loan.annualRate === 0 && <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">⚠️ Le taux du prêt est à 0 % : renseigne-le dans Prêt → Mon prêt.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Block title={`En ${c.year}`} cost={c.yearLoanCost} gain={c.yearSavingsInterest} />
        <Block title={`Du ${formatDateFR(c.horizonFrom)} au ${formatDateFR(c.horizonTo)}`} subtitle={loan.deferral.type !== 'none' ? 'Durée du différé, pendant laquelle l\'argent est placé' : 'Durée du prêt'} cost={c.horizonLoanCost} gain={c.horizonSavingsInterest} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Coût du prêt = intérêts + assurance. Intérêts de l'épargne estimés par quinzaine, avec les retraits mensuels prévus ({formatEUR(ctx.settings.monthlyTransfer)}) et le dernier taux connu pour les années futures. Coût total du crédit sur toute sa durée : {formatEUR(c.totalCreditCost)}.
      </p>
    </Card>
  );
}

function Block({ title, subtitle, cost, gain }: { title: string; subtitle?: string; cost: number; gain: number }) {
  const net = gain - cost;
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Intérêts gagnés (épargne)</dt><dd className="font-medium">+{formatEUR(gain)}</dd></div>
        <div className="flex justify-between"><dt>Coût du prêt</dt><dd className="font-medium">−{formatEUR(cost)}</dd></div>
        <div className="flex justify-between border-t border-slate-200 pt-1 dark:border-slate-700">
          <dt className="font-semibold">Bilan</dt>
          <dd className={`font-bold ${net === 0 ? '' : net > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatEUR(net, { sign: true })}</dd>
        </div>
      </dl>
      {net === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Pas encore de données à comparer.</p>
      ) : (
        <p className={`mt-2 text-sm ${net > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
          {net > 0 ? '✅ L\'argent emprunté et placé te rapporte.' : '❌ L\'argent emprunté et placé te coûte.'}
        </p>
      )}
    </div>
  );
}
