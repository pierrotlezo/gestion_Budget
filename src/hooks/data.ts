/** Accès réactif aux données : les composants se mettent à jour dès que la base change. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings } from '../db/defaults';
import type { Category, Loan, SavingsAccount, SavingsMovement, Settings, Transaction, CategoryRule } from '../db/schema';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('app'), []) ?? defaultSettings;
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
