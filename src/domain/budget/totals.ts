/**
 * Totaux mensuels du budget.
 * - Revenus = transactions des catégories « Revenu » + entrées d'argent non catégorisées.
 * - Dépenses = montant NET des catégories « Dépense » et « Épargne » (un remboursement
 *   Carrefour réduit la dépense Alimentation) + sorties d'argent non catégorisées.
 */
import type { Category, Transaction } from '../../db/schema';
import type { Cents } from '../money';
import { lastMonths, monthOf, type MonthKey } from '../dates';

export type BudgetStatus = 'ok' | 'warning' | 'over';

/** Seuil d'alerte orange : 80 % du budget consommé. */
export const WARNING_RATIO = 0.8;

export function budgetStatus(spent: Cents, budget: Cents): BudgetStatus {
  if (budget <= 0) return 'ok'; // pas de budget défini : pas d'alerte
  if (spent > budget) return 'over';
  if (spent >= budget * WARNING_RATIO) return 'warning';
  return 'ok';
}

export interface CategoryTotal {
  category: Category;
  /** Pour une dépense : montant dépensé (positif). Pour un revenu : montant reçu. */
  amount: Cents;
  budget: Cents;
  ratio: number;
  status: BudgetStatus;
}

export interface MonthSummary {
  month: MonthKey;
  income: Cents;
  spent: Cents;
  remaining: Cents;
  byCategory: CategoryTotal[];
  uncategorizedIn: Cents;
  uncategorizedOut: Cents;
}

export function summarizeMonth(transactions: Transaction[], categories: Category[], month: MonthKey): MonthSummary {
  const sums = new Map<string, Cents>();
  let uncategorizedIn = 0;
  let uncategorizedOut = 0;
  const known = new Set(categories.map((c) => c.id));

  for (const t of transactions) {
    if (monthOf(t.date) !== month) continue;
    if (t.categoryId && known.has(t.categoryId)) sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
    else if (t.amount > 0) uncategorizedIn += t.amount;
    else uncategorizedOut += -t.amount;
  }

  let income = uncategorizedIn;
  let spent = uncategorizedOut;
  const byCategory = categories.map((category): CategoryTotal => {
    const net = sums.get(category.id) ?? 0;
    const amount = category.kind === 'income' ? net : -net;
    if (category.kind === 'income') income += amount;
    else spent += amount;
    const budget = category.monthlyBudget;
    return { category, amount, budget, ratio: budget > 0 ? amount / budget : 0, status: category.kind === 'income' ? 'ok' : budgetStatus(amount, budget) };
  });

  return { month, income, spent, remaining: income - spent, byCategory, uncategorizedIn, uncategorizedOut };
}

export interface MonthPoint {
  month: MonthKey;
  income: Cents;
  spent: Cents;
  remaining: Cents;
}

/** Évolution sur les `n` derniers mois (du plus ancien au plus récent). */
export function monthlyHistory(transactions: Transaction[], categories: Category[], endMonth: MonthKey, n = 12): MonthPoint[] {
  return lastMonths(endMonth, n).map((month) => {
    const s = summarizeMonth(transactions, categories, month);
    return { month, income: s.income, spent: s.spent, remaining: s.remaining };
  });
}
