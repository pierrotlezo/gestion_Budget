/** Accès réactif aux données : les composants se mettent à jour dès que la base change. */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings } from '../db/defaults';
import type { Category, CategoryRule, Investment, InvestmentOperation, Loan, PriceQuote, SavingsAccount, SavingsGoal, SavingsMovement, Settings, SimScenario, Transaction } from '../db/schema';
import { computePosition, summarizePortfolio, type Position } from '../domain/invest/portfolio';
import { balanceAt } from '../domain/savings/quinzaine';
import { buildSchedule, remainingCapitalAt } from '../domain/loan/amortization';
import { todayISO } from '../domain/dates';
import { quoteId } from '../services/prices';

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('app'), []);
  return useMemo(() => ({ ...defaultSettings, ...stored }), [stored]);
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
}

export function useCategoryMap(): Map<string, Category> {
  const cats = useCategories();
  return new Map(cats.map((c) => [c.id, c]));
}

export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
}

export function useRules(): CategoryRule[] {
  return useLiveQuery(() => db.rules.orderBy('priority').toArray(), []) ?? [];
}

export function useLoans(): Loan[] {
  return useLiveQuery(() => db.loans.toArray(), []) ?? [];
}

export function useSavingsAccounts(): SavingsAccount[] {
  return useLiveQuery(() => db.savingsAccounts.toArray(), []) ?? [];
}

export function useSavingsMovements(): SavingsMovement[] {
  return useLiveQuery(() => db.savingsMovements.orderBy('date').toArray(), []) ?? [];
}

export async function updateSettings(patch: Partial<Settings>) {
  const current = (await db.settings.get('app')) ?? defaultSettings;
  await db.settings.put({ ...current, ...patch, id: 'app' });
}

/* ───────────── Épargne & investissement ───────────── */

export function useInvestments(): Investment[] {
  return useLiveQuery(() => db.investments.toArray(), []) ?? [];
}

export function useInvestmentOps(): InvestmentOperation[] {
  return useLiveQuery(() => db.investmentOps.orderBy('date').toArray(), []) ?? [];
}

export function usePrices(): Map<string, PriceQuote> {
  const list = useLiveQuery(() => db.prices.toArray(), []) ?? [];
  return useMemo(() => new Map(list.map((p) => [p.id, p])), [list]);
}

export function useGoals(): SavingsGoal[] {
  return useLiveQuery(() => db.goals.toArray(), []) ?? [];
}

export function useScenarios(): SimScenario[] {
  return useLiveQuery(() => db.scenarios.toArray(), []) ?? [];
}

/** Valorisation de chaque placement avec le dernier cours connu. */
export function usePositions(): Position[] {
  const investments = useInvestments();
  const ops = useInvestmentOps();
  const prices = usePrices();
  return useMemo(() => investments.map((i) => computePosition(i, ops, i.symbol ? prices.get(quoteId(i)) : undefined)), [investments, ops, prices]);
}

/** Vue d'ensemble : livrets, placements, dette, patrimoine net. */
export function useWealth() {
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const loans = useLoans();
  const positions = usePositions();
  return useMemo(() => {
    const today = todayISO();
    const savingsByAccount = accounts.map((a) => ({ account: a, balance: balanceAt(movements.filter((m) => m.accountId === a.id), today) }));
    const savings = savingsByAccount.reduce((s, a) => s + a.balance, 0);
    const portfolio = summarizePortfolio(positions);
    const debt = loans.reduce((s, l) => s + remainingCapitalAt(l, buildSchedule(l), today), 0);
    return { savingsByAccount, savings, positions, portfolio, debt, netWorth: savings + portfolio.value - debt };
  }, [accounts, movements, loans, positions]);
}

/** Montant actuel d'un objectif (somme de ses sources, ou montant saisi). */
export function goalCurrentAmount(goal: SavingsGoal, wealth: ReturnType<typeof useWealth>): number {
  if (goal.sources.length === 0) return goal.manualAmount;
  return goal.sources.reduce((s, src) => {
    if (src.kind === 'investment') return s + (wealth.positions.find((p) => p.investment.id === src.id)?.value ?? 0);
    return s + (wealth.savingsByAccount.find((a) => a.account.id === src.id)?.balance ?? 0);
  }, 0);
}
