import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../db/schema';
import { summarizeMonth } from './totals';
import { averagePotential, savingsCapacity } from './capacity';

const cat = (id: string, kind: Category['kind']): Category => ({ id, name: id, color: '#000', kind, monthlyBudget: 0, order: 0 });
const categories = [cat('alim', 'expense'), cat('epargne', 'savings'), cat('revenu', 'income')];
const tx = (date: string, amount: number, categoryId: string): Transaction => ({ id: date + amount + categoryId, date, amount, label: '', categoryId, source: 'manual' });

describe('capacité d’épargne', () => {
  const transactions = [
    tx('2026-11-01', 85000, 'revenu'), tx('2026-11-03', -60000, 'alim'), tx('2026-11-10', -10000, 'epargne'),
    tx('2026-10-01', 85000, 'revenu'), tx('2026-10-03', -75000, 'alim'),
    tx('2026-09-01', 85000, 'revenu'), tx('2026-09-03', -65000, 'alim'),
  ];

  it('sépare consommation et épargne', () => {
    const c = savingsCapacity(summarizeMonth(transactions, categories, '2026-11'));
    expect(c).toEqual({ income: 85000, consumption: 60000, saved: 10000, potential: 25000, leftover: 15000, savingsRate: 25000 / 85000 });
  });

  it('moyenne des mois complets précédents, en ignorant les mois vides', () => {
    expect(averagePotential(transactions, categories, '2026-11', 3)).toEqual({ average: 15000, months: 2 });
    expect(averagePotential([], categories, '2026-11')).toEqual({ average: 0, months: 0 });
  });
});
