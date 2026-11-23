import { describe, expect, it } from 'vitest';
import type { Loan, SavingsAccount, SavingsMovement, Settings } from '../db/schema';
import { defaultSettings } from '../db/defaults';
import { compareLoanAndSavings, currentNetWorth, netWorthSeries } from './netWorth';

const loan: Loan = { id: 'L', name: 'Prêt', principal: 5000000, annualRate: 0.012, durationMonths: 60, startDate: '2026-01-10', monthlyInsurance: 0, deferral: { type: 'partial', months: 60 } };
const account: SavingsAccount = { id: 'A', name: 'Livret A', type: 'livretA', rates: null, ceiling: null, fundedByLoanId: 'L' };
const settings: Settings = { ...defaultSettings, transferAccountId: 'A', monthlyTransfer: 0, livretARates: [{ from: '2000-01-01', rate: 0.015 }] };
const movements: SavingsMovement[] = [{ id: 'm', accountId: 'A', date: '2026-01-12', amount: 2295000, label: 'Versement' }];
const ctx = { accounts: [account], movements, settings, today: '2026-11-23' };

describe('comparaison prêt / épargne', () => {
  const c = compareLoanAndSavings(loan, ctx);
  it('année en cours', () => {
    expect(c.year).toBe(2026);
    expect(c.yearLoanCost).toBe(11 * 5000); // 11 échéances d'intérêts de 50 € en 2026
    // 22 950 € versés le 12/01 → productifs dès le 16/01 : 23 quinzaines à 1,5 %
    expect(c.yearSavingsInterest).toBe(Math.round((2295000 * 0.015 * 23) / 24));
  });
  it('sur la durée du différé', () => {
    expect(c.horizonTo).toBe('2031-01-10');
    expect(c.horizonLoanCost).toBe(60 * 5000);
    expect(c.horizonSavingsInterest).toBeGreaterThan(c.yearSavingsInterest * 4);
  });
});

describe('patrimoine net', () => {
  it('épargne − capital restant dû', () => {
    expect(currentNetWorth([loan], ctx)).toEqual({ savings: 2295000, debt: 5000000, netWorth: -2705000 });
  });
  it('série mensuelle réelle puis projetée', () => {
    const s = netWorthSeries([loan], ctx, 2, 2);
    expect(s.map((p) => p.month)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    expect(s[2].netWorth).toBe(-2705000);
    expect(s[3].projected).toBe(true);
    // intérêts 2026 crédités le 31/12
    expect(s[3].savings).toBeGreaterThan(2295000);
  });
});
