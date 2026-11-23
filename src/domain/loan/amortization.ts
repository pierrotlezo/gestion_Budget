/**
 * Prêt amortissable à mensualités constantes, avec différé éventuel.
 *
 * - Différé partiel : pendant le différé on ne paie que les intérêts (+ assurance), le capital ne baisse pas.
 * - Différé total : on ne paie rien (sauf l'assurance) ; les intérêts s'ajoutent au capital (capitalisation).
 * - Ensuite : mensualité constante M = C·i / (1 − (1+i)^−n), avec i = taux annuel / 12.
 *
 * Les montants sont arrondis au centime à chaque échéance ; la dernière échéance solde le capital.
 */
import type { Loan } from '../../db/schema';
import type { Cents } from '../money';
import { addMonths, type ISODate } from '../dates';

export interface ScheduleRow {
  n: number;
  date: ISODate;
  phase: 'deferral' | 'amortization';
  /** Échéance hors assurance (intérêts payés + capital remboursé). */
  payment: Cents;
  /** Intérêts du mois (payés, ou capitalisés en différé total). */
  interest: Cents;
  /** Capital remboursé (négatif si les intérêts sont capitalisés). */
  principal: Cents;
  insurance: Cents;
  /** Capital restant dû après l'échéance. */
  remaining: Cents;
}

/** Mensualité constante (hors assurance) pour rembourser `capital` en `months` mois. */
export function monthlyPayment(capital: Cents, annualRate: number, months: number): Cents {
  if (months <= 0) return capital;
  const i = annualRate / 12;
  if (i === 0) return Math.round(capital / months);
  return Math.round((capital * i) / (1 - Math.pow(1 + i, -months)));
}

export function buildSchedule(loan: Loan): ScheduleRow[] {
  const i = loan.annualRate / 12;
  const rows: ScheduleRow[] = [];
  let remaining = loan.principal;
  let n = 0;

  const deferralMonths = loan.deferral.type === 'none' ? 0 : loan.deferral.months;
  for (let k = 0; k < deferralMonths; k++) {
    n++;
    const interest = Math.round(remaining * i);
    const capitalized = loan.deferral.type === 'total';
    if (capitalized) remaining += interest;
    rows.push({
      n,
      date: addMonths(loan.startDate, n),
      phase: 'deferral',
      payment: capitalized ? 0 : interest,
      interest,
      principal: capitalized ? -interest : 0,
      insurance: loan.monthlyInsurance,
      remaining,
    });
  }

  const payment = loan.monthlyPaymentOverride ?? monthlyPayment(remaining, loan.annualRate, loan.durationMonths);
  for (let k = 0; k < loan.durationMonths && remaining > 0; k++) {
    n++;
    const interest = Math.round(remaining * i);
    const last = k === loan.durationMonths - 1;
    let principal = Math.max(0, payment - interest);
    if (last || principal > remaining) principal = remaining;
    remaining -= principal;
    rows.push({ n, date: addMonths(loan.startDate, n), phase: 'amortization', payment: principal + interest, interest, principal, insurance: loan.monthlyInsurance, remaining });
  }
  return rows;
}

export interface LoanSummary {
  /** Mensualité pendant le remboursement (hors assurance). */
  monthlyPayment: Cents;
  /** Mensualité pendant le différé (hors assurance). */
  deferralPayment: Cents;
  totalInterest: Cents;
  totalInsurance: Cents;
  /** Coût total du crédit = intérêts + assurance. */
  totalCost: Cents;
  /** Total remboursé (échéances + assurance). */
  totalPaid: Cents;
  endDate: ISODate | null;
  deferralEndDate: ISODate | null;
  /** À la date demandée : */
  remainingCapital: Cents;
  interestToDate: Cents;
  insuranceToDate: Cents;
  paidToDate: Cents;
  paymentsDone: number;
}

export function summarizeLoan(loan: Loan, schedule: ScheduleRow[], asOf: ISODate): LoanSummary {
  const sum = (rows: ScheduleRow[], f: (r: ScheduleRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const done = schedule.filter((r) => r.date <= asOf);
  const amort = schedule.find((r) => r.phase === 'amortization');
  const deferral = schedule.filter((r) => r.phase === 'deferral');
  const totalInterest = sum(schedule, (r) => r.interest);
  const totalInsurance = sum(schedule, (r) => r.insurance);
  return {
    monthlyPayment: amort?.payment ?? 0,
    deferralPayment: deferral[0]?.payment ?? 0,
    totalInterest,
    totalInsurance,
    totalCost: totalInterest + totalInsurance,
    totalPaid: sum(schedule, (r) => r.payment + r.insurance),
    endDate: schedule.at(-1)?.date ?? null,
    deferralEndDate: deferral.at(-1)?.date ?? null,
    remainingCapital: done.at(-1)?.remaining ?? loan.principal,
    interestToDate: sum(done, (r) => r.interest),
    insuranceToDate: sum(done, (r) => r.insurance),
    paidToDate: sum(done, (r) => r.payment + r.insurance),
    paymentsDone: done.length,
  };
}

/** Capital restant dû à une date (le principal avant la 1re échéance). */
export function remainingCapitalAt(loan: Loan, schedule: ScheduleRow[], date: ISODate): Cents {
  if (date < loan.startDate) return 0;
  const done = schedule.filter((r) => r.date <= date);
  return done.at(-1)?.remaining ?? loan.principal;
}

/** Coût (intérêts + assurance) des échéances comprises entre deux dates incluses. */
export function loanCostBetween(schedule: ScheduleRow[], from: ISODate, to: ISODate): Cents {
  return schedule.filter((r) => r.date >= from && r.date <= to).reduce((s, r) => s + r.interest + r.insurance, 0);
}
