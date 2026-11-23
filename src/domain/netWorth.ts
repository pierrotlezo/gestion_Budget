/**
 * Vues transverses prêt + épargne : comparaison coût du prêt / intérêts de l'épargne,
 * et patrimoine net (épargne − capital restant dû).
 */
import type { Loan, SavingsAccount, SavingsMovement, Settings } from '../db/schema';
import type { Cents } from './money';
import { endOfMonth, monthOf, parts, toISO, type ISODate, type MonthKey, addMonthsToKey } from './dates';
import { buildSchedule, loanCostBetween, remainingCapitalAt, summarizeLoan } from './loan/amortization';
import { balanceAt, projectAccountDetailed, yearInterest } from './savings/quinzaine';
import { effectiveRates } from './savings/accounts';

export interface SavingsContext {
  accounts: SavingsAccount[];
  movements: SavingsMovement[];
  settings: Settings;
  today: ISODate;
}

/** Projection d'un compte, avec le virement mensuel des Paramètres s'il part de ce compte. */
export function projectForAccount(account: SavingsAccount, ctx: SavingsContext, until: ISODate) {
  const isTransferSource = ctx.settings.transferAccountId === account.id;
  return projectAccountDetailed({
    movements: ctx.movements.filter((m) => m.accountId === account.id),
    rates: effectiveRates(account, ctx.settings),
    today: ctx.today,
    until,
    monthlyWithdrawal: isTransferSource ? ctx.settings.monthlyTransfer : 0,
    withdrawalDay: ctx.settings.transferDay,
  });
}

/** Intérêts (estimés) d'un compte sur les années [fromYear, toYear] : réel pour le passé, projection ensuite. */
export function accountInterestBetween(account: SavingsAccount, ctx: SavingsContext, fromYear: number, toYear: number): Cents {
  const currentYear = parts(ctx.today).y;
  const own = ctx.movements.filter((m) => m.accountId === account.id);
  let total = 0;
  for (let y = fromYear; y < Math.min(currentYear, toYear + 1); y++) total += yearInterest(own, effectiveRates(account, ctx.settings), y).interest;
  if (toYear >= currentYear) {
    const proj = projectForAccount(account, ctx, toISO(toYear, 12, 31)).years;
    total += proj.filter((p) => p.year >= Math.max(fromYear, currentYear) && p.year <= toYear).reduce((s, p) => s + p.interest, 0);
  }
  return total;
}

export interface Comparison {
  year: number;
  /** Année en cours : intérêts + assurance du prêt vs intérêts estimés de l'épargne financée par le prêt. */
  yearLoanCost: Cents;
  yearSavingsInterest: Cents;
  /** Sur la période où l'argent est placé (jusqu'à la fin du différé, ou la fin du prêt). */
  horizonFrom: ISODate;
  horizonTo: ISODate;
  horizonLoanCost: Cents;
  horizonSavingsInterest: Cents;
  /** Coût total du crédit sur toute sa durée. */
  totalCreditCost: Cents;
}

export function compareLoanAndSavings(loan: Loan, ctx: SavingsContext): Comparison {
  const schedule = buildSchedule(loan);
  const summary = summarizeLoan(loan, schedule, ctx.today);
  const funded = ctx.accounts.filter((a) => a.fundedByLoanId === loan.id);
  const year = parts(ctx.today).y;
  const horizonTo = summary.deferralEndDate ?? summary.endDate ?? ctx.today;
  const fromYear = parts(loan.startDate).y;
  const toYear = parts(horizonTo).y;
  return {
    year,
    yearLoanCost: loanCostBetween(schedule, toISO(year, 1, 1), toISO(year, 12, 31)),
    yearSavingsInterest: funded.reduce((s, a) => s + accountInterestBetween(a, ctx, year, year), 0),
    horizonFrom: loan.startDate,
    horizonTo,
    horizonLoanCost: loanCostBetween(schedule, loan.startDate, horizonTo),
    horizonSavingsInterest: funded.reduce((s, a) => s + accountInterestBetween(a, ctx, fromYear, toYear), 0),
    totalCreditCost: summary.totalCost,
  };
}

export interface NetWorthPoint {
  month: MonthKey;
  savings: Cents;
  debt: Cents;
  netWorth: Cents;
  projected: boolean;
}

/** Patrimoine net en fin de mois : réel jusqu'au mois courant, projeté ensuite. */
export function netWorthSeries(loans: Loan[], ctx: SavingsContext, monthsBack: number, monthsAhead: number): NetWorthPoint[] {
  const nowMonth = monthOf(ctx.today);
  const lastDate = endOfMonth(addMonthsToKey(nowMonth, monthsAhead));
  const projections = ctx.accounts.map((a) => projectForAccount(a, ctx, lastDate).movements);
  const schedules = loans.map((l) => ({ loan: l, schedule: buildSchedule(l) }));
  const out: NetWorthPoint[] = [];
  for (let k = -monthsBack; k <= monthsAhead; k++) {
    const month = addMonthsToKey(nowMonth, k);
    const date = k === 0 ? ctx.today : endOfMonth(month);
    const savings = projections.reduce((s, mv) => s + balanceAt(mv as SavingsMovement[], date), 0);
    const debt = schedules.reduce((s, { loan, schedule }) => s + remainingCapitalAt(loan, schedule, date), 0);
    out.push({ month, savings, debt, netWorth: savings - debt, projected: k > 0 });
  }
  return out;
}

export function currentNetWorth(loans: Loan[], ctx: SavingsContext) {
  const savings = ctx.accounts.reduce((s, a) => s + balanceAt(ctx.movements.filter((m) => m.accountId === a.id), ctx.today), 0);
  const debt = loans.reduce((s, l) => s + remainingCapitalAt(l, buildSchedule(l), ctx.today), 0);
  return { savings, debt, netWorth: savings - debt };
}
