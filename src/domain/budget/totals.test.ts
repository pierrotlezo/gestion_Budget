import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../db/schema';
import { budgetStatus, monthlyHistory, summarizeMonth } from './totals';

const cat = (id: string, kind: Category['kind'], monthlyBudget = 0): Category => ({ id, name: id, color: '#000', kind, monthlyBudget, order: 0 });
const tx = (date: string, amount: number, categoryId: string | null): Transaction => ({ id: `${date}${amount}${categoryId}`, date, amount, label: 'x', categoryId, source: 'manual' });

const categories = [cat('alim', 'expense', 25000), cat('loyer', 'expense', 50000), cat('epargne', 'savings'), cat('virement', 'income', 60000), cat('parents', 'income', 25000)];

const transactions = [
  tx('2026-11-01', 60000, 'virement'),
  tx('2026-11-02', 25000, 'parents'),
  tx('2026-11-03', -48000, 'loyer'),
  tx('2026-11-05', -12000, 'alim'),
  tx('2026-11-12', -9000, 'alim'),
  tx('2026-11-13', 1000, 'alim'), // remboursement
  tx('2026-11-20', -5000, 'epargne'),
  tx('2026-11-21', -700, null),
  tx('2026-11-22', 300, null),
  tx('2026-10-15', -99999, 'alim'), // autre mois
];

describe('totaux par catégorie', () => {
  const s = summarizeMonth(transactions, categories, '2026-11');
  const by = (id: string) => s.byCategory.find((c) => c.category.id === id)!;

  it('calcule les dépenses nettes par catégorie', () => {
    expect(by('alim').amount).toBe(20000);
    expect(by('loyer').amount).toBe(48000);
    expect(by('epargne').amount).toBe(5000);
    expect(by('virement').amount).toBe(60000);
  });

  it('calcule entrées, dépenses et reste du mois', () => {
    expect(s.income).toBe(60000 + 25000 + 300);
    expect(s.spent).toBe(48000 + 20000 + 5000 + 700);
    expect(s.remaining).toBe(s.income - s.spent);
    expect(s.uncategorizedOut).toBe(700);
  });

  it('passe à l’orange à 80 % et au rouge au-delà du budget', () => {
    expect(by('alim').ratio).toBeCloseTo(0.8);
    expect(by('alim').status).toBe('warning');
    expect(budgetStatus(19999, 25000)).toBe('ok');
    expect(budgetStatus(25000, 25000)).toBe('warning');
    expect(budgetStatus(25001, 25000)).toBe('over');
    expect(budgetStatus(5000, 0)).toBe('ok');
  });

  it('produit un historique de 12 mois', () => {
    const h = monthlyHistory(transactions, categories, '2026-11');
    expect(h).toHaveLength(12);
    expect(h[0].month).toBe('2025-12');
    expect(h[11].month).toBe('2026-11');
    expect(h[10].spent).toBe(99999);
  });
});
