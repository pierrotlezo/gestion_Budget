/**
 * « Mon plan » : je vis avec l'argent du prêt pendant quelques années, puis il reste placé
 * jusqu'à la fin du différé. Combien rembourserai-je chaque mois ensuite ?
 *
 * Estimation volontairement simple :
 * - l'argent restant rapporte le taux du livret, crédité chaque mois (approximation des quinzaines) ;
 * - chaque mois, on retire le montant prévu (tant que la période de retrait dure et qu'il reste de l'argent) ;
 * - pendant un différé partiel, les intérêts et l'assurance du prêt peuvent être payés avec cet argent ;
 * - à la fin du différé : mensualité normale, ou mensualité réduite si on rembourse par anticipation
 *   avec l'argent restant (même durée, capital diminué).
 */
import type { Loan } from '../../db/schema';
import type { Cents } from '../money';
import { addMonths, monthsBetween, type ISODate } from '../dates';
import { buildSchedule, monthlyPayment, summarizeLoan } from './amortization';

export interface PlanInput {
  loan: Loan;
  today: ISODate;
  /** Argent du prêt disponible aujourd'hui. */
  available: Cents;
  /** Taux annuel de placement (ex. Livret A). */
  savingsRate: number;
  monthlyDraw: Cents;
  drawMonths: number;
  payDeferralFromSavings: boolean;
}

export interface PlanResult {
  /** Début des remboursements (fin du différé). */
  repaymentStart: ISODate | null;
  monthsUntilRepayment: number;
  /** Mois où l'argent est épuisé (null s'il en reste). */
  runsOutAt: ISODate | null;
  drawEnd: ISODate;
  totalDrawn: Cents;
  interestEarned: Cents;
  deferralCostPaid: Cents;
  /** Argent restant au début des remboursements. */
  leftAtRepayment: Cents;
  /** Capital à rembourser au début des remboursements. */
  capitalAtRepayment: Cents;
  durationMonths: number;
  /** Mensualité (assurance comprise) sans toucher à l'argent restant. */
  paymentNormal: Cents;
  /** Mensualité si l'argent restant sert à rembourser par anticipation. */
  paymentWithEarlyRepayment: Cents;
  /** Coût du différé chaque mois (intérêts + assurance), 0 si différé total. */
  deferralMonthlyCost: Cents;
  /** Évolution de l'argent restant, mois par mois. */
  timeline: { date: ISODate; balance: Cents }[];
}

export function planLoan(input: PlanInput): PlanResult {
  const { loan, today } = input;
  const schedule = buildSchedule(loan);
  const summary = summarizeLoan(loan, schedule, today);
  const deferralRows = schedule.filter((r) => r.phase === 'deferral');
  const firstAmort = schedule.find((r) => r.phase === 'amortization');
  const repaymentStart = firstAmort?.date ?? null;
  const start = today > loan.startDate ? today : loan.startDate;
  const horizon = repaymentStart ? Math.max(0, monthsBetween(start, repaymentStart)) : 0;
  const r = input.savingsRate / 12;

  let balance = input.available;
  let totalDrawn = 0;
  let interestEarned = 0;
  let deferralCostPaid = 0;
  let runsOutAt: ISODate | null = null;
  const timeline = [{ date: start, balance }];

  for (let k = 1; k <= horizon; k++) {
    const date = addMonths(start, k);
    const interest = Math.round(Math.max(0, balance) * r);
    balance += interest;
    interestEarned += interest;
    if (k <= input.drawMonths) {
      const draw = Math.min(input.monthlyDraw, Math.max(0, balance));
      balance -= draw;
      totalDrawn += draw;
      if (draw < input.monthlyDraw && !runsOutAt) runsOutAt = date;
    }
    if (input.payDeferralFromSavings) {
      const row = deferralRows.find((x) => x.date.slice(0, 7) === date.slice(0, 7));
      if (row) {
        const cost = row.payment + row.insurance;
        balance -= cost;
        deferralCostPaid += cost;
      }
    }
    timeline.push({ date, balance });
  }

  const left = Math.max(0, balance);
  const capitalAtRepayment = deferralRows.at(-1)?.remaining ?? loan.principal;
  const insurance = loan.monthlyInsurance;
  const paymentNormal = (firstAmort ? summary.monthlyPayment : monthlyPayment(capitalAtRepayment, loan.annualRate, loan.durationMonths)) + insurance;
  const reduced = Math.max(0, capitalAtRepayment - left);
  return {
    repaymentStart,
    monthsUntilRepayment: horizon,
    runsOutAt,
    drawEnd: addMonths(start, input.drawMonths),
    totalDrawn,
    interestEarned,
    deferralCostPaid,
    leftAtRepayment: left,
    capitalAtRepayment,
    durationMonths: loan.durationMonths,
    paymentNormal,
    paymentWithEarlyRepayment: (reduced > 0 ? monthlyPayment(reduced, loan.annualRate, loan.durationMonths) : 0) + (reduced > 0 ? insurance : 0),
    deferralMonthlyCost: loan.deferral.type === 'partial' ? (deferralRows[0]?.payment ?? 0) + insurance : loan.deferral.type === 'total' ? insurance : 0,
    timeline,
  };
}
