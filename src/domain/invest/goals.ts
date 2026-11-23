import type { SavingsGoal } from '../../db/schema';
import type { Cents } from '../money';
import { addMonths, monthsBetween, type ISODate } from '../dates';
import { monthsToTarget, requiredMonthly } from './compound';

export interface GoalProgress {
  current: Cents;
  target: Cents;
  ratio: number;
  remaining: Cents;
  reached: boolean;
  /** Date estimée avec le versement mensuel prévu (null si jamais atteint). */
  estimatedDate: ISODate | null;
  /** Versement mensuel nécessaire pour tenir l'échéance (si une échéance est fixée). */
  requiredMonthly: Cents | null;
  /** L'objectif sera-t-il atteint à temps au rythme prévu ? (null sans échéance) */
  onTrack: boolean | null;
}

export function goalProgress(goal: SavingsGoal, current: Cents, today: ISODate): GoalProgress {
  const remaining = Math.max(0, goal.target - current);
  const reached = remaining === 0;
  const months = monthsToTarget(current, goal.monthlyContribution, goal.annualReturn, goal.target);
  const estimatedDate = months === null ? null : addMonths(today, months);
  const monthsLeft = goal.deadline ? Math.max(0, monthsBetween(today, goal.deadline)) : null;
  return {
    current,
    target: goal.target,
    ratio: goal.target > 0 ? current / goal.target : 0,
    remaining,
    reached,
    estimatedDate: reached ? today : estimatedDate,
    requiredMonthly: monthsLeft === null ? null : requiredMonthly(current, goal.target, monthsLeft, goal.annualReturn),
    onTrack: goal.deadline ? reached || (estimatedDate !== null && estimatedDate <= goal.deadline) : null,
  };
}
