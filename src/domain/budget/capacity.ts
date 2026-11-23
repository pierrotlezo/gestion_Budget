/**
 * Capacité d'épargne : ce que le mois permet de mettre de côté.
 * - consommation = dépenses hors catégories « Épargne »
 * - déjà épargné = sorties vers les catégories « Épargne » (virements vers PEA, crypto, livret…)
 * - potentiel = revenus − consommation (ce que tu aurais pu épargner au total)
 * - reste = potentiel − déjà épargné (ce qu'il reste à placer ou à garder)
 */
import type { Category, Transaction } from '../../db/schema';
import type { Cents } from '../money';
import { addMonthsToKey, type MonthKey } from '../dates';
import { summarizeMonth, type MonthSummary } from './totals';

export interface SavingsCapacity {
  income: Cents;
  consumption: Cents;
  saved: Cents;
  potential: Cents;
  leftover: Cents;
  /** Part des revenus non consommée (potentiel / revenus). */
  savingsRate: number;
}

export function savingsCapacity(summary: MonthSummary): SavingsCapacity {
  const saved = summary.byCategory.filter((c) => c.category.kind === 'savings').reduce((s, c) => s + c.amount, 0);
  const consumption = summary.spent - saved;
  const potential = summary.income - consumption;
  return { income: summary.income, consumption, saved, potential, leftover: potential - saved, savingsRate: summary.income > 0 ? potential / summary.income : 0 };
}

/** Potentiel d'épargne moyen sur les `n` mois complets avant `month` (les mois vides sont ignorés). */
export function averagePotential(transactions: Transaction[], categories: Category[], month: MonthKey, n = 3): { average: Cents; months: number } {
  const values: Cents[] = [];
  for (let k = 1; k <= n; k++) {
    const s = summarizeMonth(transactions, categories, addMonthsToKey(month, -k));
    if (s.income === 0 && s.spent === 0) continue;
    values.push(savingsCapacity(s).potential);
  }
  return { average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0, months: values.length };
}
