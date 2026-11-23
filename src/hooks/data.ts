/** Accès réactif aux données : les composants se mettent à jour dès que la base change. */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings } from '../db/defaults';
import type { Category, CategoryRule, Investment, InvestmentOperation, Loan, PriceQuote, SavingsAccount, SavingsGoal, SavingsMovement, Settings, SimScenario, Transaction } from '../db/schema';
import type { Position } from '../domain/invest/portfolio';
import { todayISO } from '../domain/dates';
import { computeWealth, type Wealth } from '../domain/progress';

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
  return useWealth().positions;
}

/** Vue d'ensemble : livrets, placements, dette, patrimoine net. */
export function useWealth(): Wealth {
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const loans = useLoans();
  const investments = useInvestments();
  const investmentOps = useInvestmentOps();
  const priceList = useLiveQuery(() => db.prices.toArray(), []) ?? EMPTY;
  return useMemo(
    () => computeWealth({ investments, investmentOps, prices: priceList, savingsAccounts: accounts, savingsMovements: movements, loans }, todayISO()),
    [accounts, movements, loans, investments, investmentOps, priceList],
  );
}
const EMPTY: PriceQuote[] = [];

export { goalCurrentAmount } from '../domain/progress';
