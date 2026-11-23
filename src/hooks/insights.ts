/** Astuces du mois et progression « jeu », calculées à partir des données. */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TIPS_CATALOG } from '../db/tipsCatalog';
import type { TipState } from '../db/schema';
import { addMonthsToKey, currentMonth, lastMonths, monthOf, parts } from '../domain/dates';
import { summarizeMonth } from '../domain/budget/totals';
import { detectSubscriptions } from '../domain/tips/subscriptions';
import { evaluateTips, tipsOfTheMonth, type TipContext } from '../domain/tips/engine';
import { normalizeLabel } from '../domain/rules/categorize';
import { computeXp, levelFor, reachedMilestones, savedByMonth, savingStreak, unlockedBadges } from '../domain/gamification';
import { goalProgress } from '../domain/invest/goals';
import { todayISO } from '../domain/dates';
import { goalCurrentAmount, useCategories, useGoals, useInvestmentOps, useSavingsMovements, useTransactions, useWealth } from './data';

export function useTipStates(): Map<string, TipState> {
  const list = useLiveQuery(() => db.tipStates.toArray(), []) ?? [];
  return useMemo(() => new Map(list.map((s) => [s.id, s])), [list]);
}

export const setTipStatus = (id: string, status: TipState['status'] | null) =>
  status ? db.tipStates.put({ id, status, updatedAt: new Date().toISOString() }) : db.tipStates.delete(id);

export function useInsights() {
  const raw = useTransactions();
  const transactions = useMemo(() => raw ?? [], [raw]);
  const ready = raw !== undefined;
  const categories = useCategories();
  const states = useTipStates();
  return useMemo(() => {
    const month = currentMonth();
    // Moyenne des 3 derniers mois complets (ou du mois en cours s'il n'y a pas d'historique)
    const past = lastMonths(addMonthsToKey(month, -1), 3).map((m) => summarizeMonth(transactions, categories, m)).filter((s) => s.spent > 0);
    const sources = past.length ? past : [summarizeMonth(transactions, categories, month)];
    const avgByCategory = new Map<string, number>();
    for (const c of categories) avgByCategory.set(c.id, Math.round(sources.reduce((s, m) => s + (m.byCategory.find((x) => x.category.id === c.id)?.amount ?? 0), 0) / sources.length));
    const current = summarizeMonth(transactions, categories, month);
    const overBudget = new Set(current.byCategory.filter((c) => c.status === 'over').map((c) => c.category.id));
    // Dépenses récurrentes (hors épargne) ; les « abonnements » au sens strict sont ceux de la catégorie Abonnements ou non triés
    const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
    const recurring = detectSubscriptions(transactions, month, 4).filter((s) => !s.categoryId || kindOf.get(s.categoryId) === 'expense');
    const subscriptions = recurring.filter((s) => !s.categoryId || s.categoryId === 'cat-abonnements');
    const window = new Set(lastMonths(month, 3));
    const labels = [...new Set(transactions.filter((t) => t.amount < 0 && window.has(monthOf(t.date))).map((t) => normalizeLabel(t.label)))];
    const ctx: TipContext = { avgByCategory, overBudget, subscriptions, labels, states };
    const all = evaluateTips(TIPS_CATALOG, ctx);
    const { y, m } = parts(`${month}-01`);
    const ofTheMonth = tipsOfTheMonth(all, ctx, y * 12 + m, 3);
    // Flux de bons plans : ceux des catégories où tu dépenses le plus
    const feeds = categories
      .filter((c) => c.dealFeeds?.length && (avgByCategory.get(c.id) ?? 0) > 0)
      .sort((a, b) => (avgByCategory.get(b.id) ?? 0) - (avgByCategory.get(a.id) ?? 0))
      .slice(0, 3)
      .map((c) => c.dealFeeds![0]);
    return { avgByCategory, overBudget, subscriptions, recurring, all, ofTheMonth, trying: all.filter((s) => s.status === 'trying'), feeds: feeds.length ? feeds : ['gratuit'], ready };
  }, [transactions, categories, states, ready]);
}

export function useGameProgress() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const ops = useInvestmentOps();
  const movements = useSavingsMovements();
  const goals = useGoals();
  const wealth = useWealth();
  const states = useTipStates();
  return useMemo(() => {
    const month = currentMonth();
    const savingsCats = new Set(categories.filter((c) => c.kind === 'savings').map((c) => c.id));
    const saved = savedByMonth(
      transactions.filter((t) => t.categoryId && savingsCats.has(t.categoryId)),
      [...ops.filter((o) => o.kind === 'buy'), ...movements.filter((m) => m.amount > 0 && m.kind !== 'interest')],
    );
    const totalSaved = [...saved.values()].reduce((a, b) => a + b, 0);
    const streak = savingStreak(saved, month);
    const goalStates = goals.map((g) => {
      const p = goalProgress(g, goalCurrentAmount(g, wealth), todayISO());
      return { goal: g, progress: p, milestones: reachedMilestones(p.ratio) };
    });
    // Un mois complet (parmi les 6 derniers) où aucun budget n'a été dépassé
    const budgetMonthRespected = lastMonths(addMonthsToKey(month, -1), 6).some((m) => {
      const s = summarizeMonth(transactions, categories, m);
      const budgeted = s.byCategory.filter((c) => c.budget > 0 && c.category.kind === 'expense');
      return s.spent > 0 && budgeted.length > 0 && budgeted.every((c) => c.status !== 'over');
    });
    const tipList = [...states.values()];
    const tips = { trying: tipList.filter((t) => t.status === 'trying').length, done: tipList.filter((t) => t.status === 'done').length };
    const envelopes = new Set(wealth.positions.map((p) => p.investment.envelope as string));
    const badges = unlockedBadges({
      totalSaved,
      streak,
      goals: goals.length,
      goalsReached: goalStates.filter((g) => g.progress.reached).length,
      investments: wealth.positions.length,
      envelopes,
      supports: envelopes.size + (wealth.savingsByAccount.some((a) => a.balance > 0) ? 1 : 0),
      budgetMonthRespected,
      tipsTried: tips.trying + tips.done,
    });
    const xp = computeXp({ totalSaved, milestones: goalStates.flatMap((g) => g.milestones), badges: badges.size, tips });
    return { xp, level: levelFor(xp), streak, savedThisMonth: saved.get(month) ?? 0, totalSaved, badges, goalStates };
  }, [transactions, categories, ops, movements, goals, wealth, states]);
}
