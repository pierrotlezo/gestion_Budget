/** Astuces du mois et progression « jeu », calculées à partir des données (voir domain/progress.ts). */
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { TipState } from '../db/schema';
import { currentMonth, todayISO } from '../domain/dates';
import { computeGameProgress, computeInsights } from '../domain/progress';
import { useCategories, useGoals, useInvestmentOps, useSavingsMovements, useSettings, useTransactions, useWealth } from './data';

export function useTipStatesList(): TipState[] {
  return useLiveQuery(() => db.tipStates.toArray(), []) ?? [];
}

export const setTipStatus = (id: string, status: TipState['status'] | null) =>
  status ? db.tipStates.put({ id, status }) : db.tipStates.delete(id);

export function useInsights() {
  const raw = useTransactions();
  const categories = useCategories();
  const tipStates = useTipStatesList();
  return useMemo(() => {
    const transactions = raw ?? [];
    return { ...computeInsights({ transactions, categories, tipStates }, currentMonth()), ready: raw !== undefined };
  }, [raw, categories, tipStates]);
}

export function useGameProgress() {
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const investmentOps = useInvestmentOps();
  const savingsMovements = useSavingsMovements();
  const goals = useGoals();
  const wealth = useWealth();
  const tipStates = useTipStatesList();
  const settings = useSettings();
  return useMemo(
    () =>
      computeGameProgress(
        { transactions, categories, investmentOps, savingsMovements, goals, tipStates, settings, investments: [], prices: [], savingsAccounts: [], loans: [] },
        wealth,
        currentMonth(),
        todayISO(),
      ),
    [transactions, categories, investmentOps, savingsMovements, goals, wealth, tipStates, settings],
  );
}
