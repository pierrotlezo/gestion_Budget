/**
 * Calculs transverses à partir de toutes les données : patrimoine, progression « jeu », astuces.
 * Fonctions pures, utilisées par l'interface (hooks) ET par le serveur maison (notifications).
 */
import type { Category, Investment, InvestmentOperation, Loan, PriceQuote, SavingsAccount, SavingsGoal, SavingsMovement, Settings, TipState, Transaction } from '../db/schema';
import { TIPS_CATALOG } from '../db/tipsCatalog';
import { addMonthsToKey, lastMonths, monthOf, parts, type ISODate, type MonthKey } from './dates';
import { summarizeMonth } from './budget/totals';
import { computePosition, summarizePortfolio } from './invest/portfolio';
import { goalProgress } from './invest/goals';
import { balanceAt } from './savings/quinzaine';
import { buildSchedule, remainingCapitalAt } from './loan/amortization';
import { computeXp, levelFor, reachedMilestones, savedByMonth, savingStreak, unlockedBadges } from './gamification';
import { detectSubscriptions } from './tips/subscriptions';
import { evaluateTips, tipsOfTheMonth, type TipContext } from './tips/engine';
import { normalizeLabel } from './rules/categorize';

export interface AppData {
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  investments: Investment[];
  investmentOps: InvestmentOperation[];
  prices: PriceQuote[];
  savingsAccounts: SavingsAccount[];
  savingsMovements: SavingsMovement[];
  loans: Loan[];
  goals: SavingsGoal[];
  tipStates: TipState[];
}

export const quoteId = (inv: Pick<Investment, 'priceSource' | 'symbol'>) => `${inv.priceSource}:${inv.symbol}`;

export function computeWealth(d: Pick<AppData, 'investments' | 'investmentOps' | 'prices' | 'savingsAccounts' | 'savingsMovements' | 'loans'>, today: ISODate) {
  const prices = new Map(d.prices.map((p) => [p.id, p]));
  const positions = d.investments.map((i) => computePosition(i, d.investmentOps, i.symbol ? prices.get(quoteId(i)) : undefined));
  const savingsByAccount = d.savingsAccounts.map((a) => ({ account: a, balance: balanceAt(d.savingsMovements.filter((m) => m.accountId === a.id), today) }));
  const savings = savingsByAccount.reduce((s, a) => s + a.balance, 0);
  const portfolio = summarizePortfolio(positions);
  const debt = d.loans.reduce((s, l) => s + remainingCapitalAt(l, buildSchedule(l), today), 0);
  return { savingsByAccount, savings, positions, portfolio, debt, netWorth: savings + portfolio.value - debt };
}
export type Wealth = ReturnType<typeof computeWealth>;

/** Montant actuel d'un objectif (somme de ses sources, ou montant saisi). */
export function goalCurrentAmount(goal: SavingsGoal, wealth: Wealth): number {
  if (goal.sources.length === 0) return goal.manualAmount;
  return goal.sources.reduce((s, src) => {
    if (src.kind === 'investment') return s + (wealth.positions.find((p) => p.investment.id === src.id)?.value ?? 0);
    return s + (wealth.savingsByAccount.find((a) => a.account.id === src.id)?.balance ?? 0);
  }, 0);
}

export function computeGameProgress(d: AppData, wealth: Wealth, month: MonthKey, today: ISODate) {
  const savingsCats = new Set(d.categories.filter((c) => c.kind === 'savings').map((c) => c.id));
  const saved = savedByMonth(
    d.transactions.filter((t) => t.categoryId && savingsCats.has(t.categoryId)),
    [...d.investmentOps.filter((o) => o.kind === 'buy'), ...d.savingsMovements.filter((m) => m.amount > 0 && m.kind !== 'interest')],
  );
  const totalSaved = [...saved.values()].reduce((a, b) => a + b, 0);
  const streak = savingStreak(saved, month);
  const goalStates = d.goals.map((g) => {
    const p = goalProgress(g, goalCurrentAmount(g, wealth), today);
    return { goal: g, progress: p, milestones: reachedMilestones(p.ratio) };
  });
  const budgetMonthRespected = lastMonths(addMonthsToKey(month, -1), 6).some((m) => {
    const s = summarizeMonth(d.transactions, d.categories, m);
    const budgeted = s.byCategory.filter((c) => c.budget > 0 && c.category.kind === 'expense');
    return s.spent > 0 && budgeted.length > 0 && budgeted.every((c) => c.status !== 'over');
  });
  const tips = { trying: d.tipStates.filter((t) => t.status === 'trying').length, done: d.tipStates.filter((t) => t.status === 'done').length };
  const envelopes = new Set(wealth.positions.map((p) => p.investment.envelope as string));
  const badges = unlockedBadges({
    totalSaved,
    streak,
    goals: d.goals.length,
    goalsReached: goalStates.filter((g) => g.progress.reached).length,
    investments: wealth.positions.length,
    envelopes,
    supports: envelopes.size + (wealth.savingsByAccount.some((a) => a.balance > 0) ? 1 : 0),
    budgetMonthRespected,
    tipsTried: tips.trying + tips.done,
  });
  const xp = computeXp({ totalSaved, milestones: goalStates.flatMap((g) => g.milestones), badges: badges.size, tips });
  return { xp, level: levelFor(xp), streak, savedThisMonth: saved.get(month) ?? 0, totalSaved, badges, goalStates };
}
export type GameProgress = ReturnType<typeof computeGameProgress>;

export function computeInsights(d: Pick<AppData, 'transactions' | 'categories' | 'tipStates'>, month: MonthKey) {
  const { transactions, categories } = d;
  const states = new Map(d.tipStates.map((s) => [s.id, s]));
  // Moyenne des 3 derniers mois complets (ou du mois en cours s'il n'y a pas d'historique)
  const past = lastMonths(addMonthsToKey(month, -1), 3).map((m) => summarizeMonth(transactions, categories, m)).filter((s) => s.spent > 0);
  const sources = past.length ? past : [summarizeMonth(transactions, categories, month)];
  const avgByCategory = new Map<string, number>();
  for (const c of categories) avgByCategory.set(c.id, Math.round(sources.reduce((s, m) => s + (m.byCategory.find((x) => x.category.id === c.id)?.amount ?? 0), 0) / sources.length));
  const current = summarizeMonth(transactions, categories, month);
  const overBudget = new Set(current.byCategory.filter((c) => c.status === 'over').map((c) => c.category.id));
  // Dépenses récurrentes (hors épargne) ; « abonnements » au sens strict : catégorie Abonnements ou non triés
  const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
  const recurring = detectSubscriptions(transactions, month, 4).filter((s) => !s.categoryId || kindOf.get(s.categoryId) === 'expense');
  const subscriptions = recurring.filter((s) => !s.categoryId || s.categoryId === 'cat-abonnements');
  const window = new Set(lastMonths(month, 3));
  const labels = [...new Set(transactions.filter((t) => t.amount < 0 && window.has(monthOf(t.date))).map((t) => normalizeLabel(t.label)))];
  const ctx: TipContext = { avgByCategory, overBudget, subscriptions, labels, states };
  const all = evaluateTips(TIPS_CATALOG, ctx);
  const { y, m } = parts(`${month}-01`);
  const ofTheMonth = tipsOfTheMonth(all, ctx, y * 12 + m, 3);
  const feeds = categories
    .filter((c) => c.dealFeeds?.length && (avgByCategory.get(c.id) ?? 0) > 0)
    .sort((a, b) => (avgByCategory.get(b.id) ?? 0) - (avgByCategory.get(a.id) ?? 0))
    .slice(0, 3)
    .map((c) => c.dealFeeds![0]);
  return { avgByCategory, overBudget, subscriptions, recurring, all, ofTheMonth, trying: all.filter((s) => s.status === 'trying'), feeds: feeds.length ? feeds : ['gratuit'] };
}
export type Insights = ReturnType<typeof computeInsights>;
