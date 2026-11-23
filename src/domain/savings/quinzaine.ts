/**
 * Intérêts des livrets réglementés (Livret A, LDDS, LEP) : règle des quinzaines.
 *
 * - L'année compte 24 quinzaines (1er–15 et 16–fin de chaque mois).
 * - Un VERSEMENT rapporte à partir du 1er jour de la quinzaine SUIVANTE.
 * - Un RETRAIT cesse de rapporter dès le début de la quinzaine où il a lieu.
 * - Intérêts d'une quinzaine = solde productif × taux annuel / 24 (taux en vigueur ce jour-là).
 * - Les intérêts de l'année sont crédités le 31/12 et rapportent à partir du 1er janvier.
 */
import type { RatePeriod, SavingsMovement } from '../../db/schema';
import type { Cents } from '../money';
import { addMonths, parts, quinzaineOf, quinzaineStart, toISO, type ISODate } from '../dates';

/** Taux en vigueur à une date (0 si aucun taux n'est défini avant cette date). */
export function rateAt(rates: RatePeriod[], date: ISODate): number {
  let rate = 0;
  for (const r of [...rates].sort((a, b) => a.from.localeCompare(b.from))) {
    if (r.from <= date) rate = r.rate;
  }
  return rate;
}

export function balanceAt(movements: SavingsMovement[], date: ISODate): Cents {
  return movements.filter((m) => m.date <= date).reduce((s, m) => s + m.amount, 0);
}

/** Numéro absolu de la quinzaine à partir de laquelle le mouvement compte dans le solde productif. */
function effectiveQuinzaine(m: Pick<SavingsMovement, 'date' | 'amount'>): number {
  const q = quinzaineOf(m.date);
  const abs = q.year * 24 + q.index;
  return m.amount > 0 ? abs + 1 : abs;
}

export interface QuinzaineDetail {
  index: number;
  start: ISODate;
  balance: Cents;
  rate: number;
  interest: number; // en centimes, non arrondi
}

export interface YearInterest {
  year: number;
  interest: Cents;
  quinzaines: QuinzaineDetail[];
}

/** Intérêts d'une année civile pour un compte. */
export function yearInterest(movements: Pick<SavingsMovement, 'date' | 'amount'>[], rates: RatePeriod[], year: number): YearInterest {
  const effects = movements.map((m) => ({ q: effectiveQuinzaine(m), amount: m.amount })).sort((a, b) => a.q - b.q);
  const quinzaines: QuinzaineDetail[] = [];
  let total = 0;
  for (let index = 0; index < 24; index++) {
    const abs = year * 24 + index;
    const balance = Math.max(0, effects.filter((e) => e.q <= abs).reduce((s, e) => s + e.amount, 0));
    const start = quinzaineStart(year, index);
    const rate = rateAt(rates, start);
    const interest = (balance * rate) / 24;
    total += interest;
    quinzaines.push({ index, start, balance, rate, interest });
  }
  return { year, interest: Math.round(total), quinzaines };
}

export interface CeilingCheck {
  exceeds: boolean;
  /** Versement maximal possible sans dépasser le plafond. */
  maxDeposit: Cents;
  excess: Cents;
}

/**
 * Vérifie qu'un versement ne fait pas dépasser le plafond.
 * (La capitalisation des intérêts, elle, peut légalement faire dépasser le plafond.)
 */
export function checkDeposit(currentBalance: Cents, deposit: Cents, ceiling: Cents | null): CeilingCheck {
  if (ceiling === null || deposit <= 0) return { exceeds: false, maxDeposit: Infinity, excess: 0 };
  const maxDeposit = Math.max(0, ceiling - currentBalance);
  return { exceeds: deposit > maxDeposit, maxDeposit, excess: Math.max(0, deposit - maxDeposit) };
}

/** Versements (hors intérêts) qui ont fait dépasser le plafond, dans l'ordre chronologique. */
export function ceilingBreaches(movements: SavingsMovement[], ceiling: Cents | null): SavingsMovement[] {
  if (ceiling === null) return [];
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const out: SavingsMovement[] = [];
  for (const m of sorted) {
    const before = balance;
    balance += m.amount;
    if (m.amount > 0 && m.kind !== 'interest' && checkDeposit(before, m.amount, ceiling).exceeds) out.push(m);
  }
  return out;
}

/** Retraits mensuels prévus (ex. 600 € le 1er de chaque mois) entre deux dates exclues/incluses. */
export function plannedWithdrawals(after: ISODate, until: ISODate, amount: Cents, day: number): { date: ISODate; amount: Cents }[] {
  if (amount <= 0) return [];
  const out: { date: ISODate; amount: Cents }[] = [];
  const { y, m } = parts(after);
  let date = toISO(y, m, Math.min(day, 28));
  if (date <= after) date = addMonths(date, 1);
  while (date <= until) {
    out.push({ date, amount: -amount });
    date = addMonths(date, 1);
  }
  return out;
}

export interface ProjectionYear {
  year: number;
  interest: Cents;
  /** Solde au 31/12, intérêts de l'année inclus. */
  endBalance: Cents;
  withdrawals: Cents;
}

/**
 * Projette un compte jusqu'à `until` : mouvements réels + retraits mensuels prévus après `today`
 * (plafonnés au solde disponible) + capitalisation des intérêts chaque 31/12.
 * Les années futures utilisent le dernier taux connu.
 */
export function projectAccount(opts: ProjectionOptions): ProjectionYear[] {
  return projectAccountDetailed(opts).years;
}

export interface ProjectionOptions {
  movements: Pick<SavingsMovement, 'date' | 'amount' | 'kind'>[];
  rates: RatePeriod[];
  today: ISODate;
  until: ISODate;
  monthlyWithdrawal: Cents;
  withdrawalDay: number;
}

/** Comme projectAccount, mais renvoie aussi tous les mouvements (réels + prévus) pour tracer des courbes. */
export function projectAccountDetailed(opts: ProjectionOptions): { years: ProjectionYear[]; movements: { date: ISODate; amount: Cents; kind?: string }[] } {
  const { today, until } = opts;
  const all: { date: ISODate; amount: Cents; kind?: string }[] = [...opts.movements];
  const planned = plannedWithdrawals(today, until, opts.monthlyWithdrawal, opts.withdrawalDay);
  const result: ProjectionYear[] = [];
  const firstYear = parts(today).y;
  const lastYear = parts(until).y;

  for (let year = firstYear; year <= lastYear; year++) {
    let withdrawals = 0;
    for (const w of planned.filter((p) => parts(p.date).y === year)) {
      const available = balanceAt(all as SavingsMovement[], w.date);
      const amount = -Math.min(-w.amount, Math.max(0, available));
      if (amount < 0) {
        all.push({ date: w.date, amount, kind: 'withdrawal' });
        withdrawals += -amount;
      }
    }
    const yearEnd = toISO(year, 12, 31);
    const alreadyCredited = all.some((m) => m.kind === 'interest' && m.date === yearEnd);
    const interest = alreadyCredited ? 0 : yearInterest(all, opts.rates, year).interest;
    if (!alreadyCredited && interest > 0) all.push({ date: yearEnd, amount: interest, kind: 'interest' });
    result.push({ year, interest, endBalance: balanceAt(all as SavingsMovement[], yearEnd), withdrawals });
  }
  return { years: result, movements: all.sort((a, b) => a.date.localeCompare(b.date)) };
}
