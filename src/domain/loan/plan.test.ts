import { describe, expect, it } from 'vitest';
import type { Loan } from '../../db/schema';
import { planLoan } from './plan';
import { monthlyPayment } from './amortization';

const loan: Loan = { id: 'l', name: 'Prêt', principal: 5000000, annualRate: 0.012, durationMonths: 60, startDate: '2026-01-01', monthlyInsurance: 0, deferral: { type: 'partial', months: 60 } };
const base = { loan, today: '2026-01-01', available: 5000000, savingsRate: 0, monthlyDraw: 60000, drawMonths: 36, payDeferralFromSavings: false };

describe('Mon plan', () => {
  it('sans rendement : argent restant = disponible − retraits', () => {
    const p = planLoan(base);
    expect(p.repaymentStart).toBe('2031-02-01');
    expect(p.monthsUntilRepayment).toBe(61);
    expect(p.totalDrawn).toBe(36 * 60000);
    expect(p.leftAtRepayment).toBe(5000000 - 36 * 60000);
    expect(p.runsOutAt).toBeNull();
    expect(p.drawEnd).toBe('2029-01-01');
  });

  it('mensualité normale et avec remboursement anticipé', () => {
    const p = planLoan(base);
    expect(p.capitalAtRepayment).toBe(5000000);
    expect(p.paymentNormal).toBe(monthlyPayment(5000000, 0.012, 60));
    expect(p.paymentWithEarlyRepayment).toBe(monthlyPayment(5000000 - p.leftAtRepayment, 0.012, 60));
    expect(p.paymentWithEarlyRepayment).toBeLessThan(p.paymentNormal);
    expect(p.deferralMonthlyCost).toBe(5000);
  });

  it('les intérêts du différé payés avec l’argent du prêt réduisent le reste', () => {
    const p = planLoan({ ...base, payDeferralFromSavings: true });
    // 60 échéances d'intérêts de 50 € pendant le différé (de février 2026 à janvier 2031)
    expect(p.deferralCostPaid).toBe(60 * 5000);
    expect(p.leftAtRepayment).toBe(5000000 - 36 * 60000 - 60 * 5000);
  });

  it('l’argent placé rapporte', () => {
    const p = planLoan({ ...base, savingsRate: 0.015 });
    expect(p.interestEarned).toBeGreaterThan(0);
    expect(p.leftAtRepayment).toBe(5000000 - 36 * 60000 + p.interestEarned);
  });

  it('signale quand l’argent est épuisé', () => {
    const p = planLoan({ ...base, available: 1000000, drawMonths: 36 });
    expect(p.runsOutAt).toBe('2027-06-01'); // 16 retraits pleins, le 17e est incomplet
    expect(p.leftAtRepayment).toBe(0);
    expect(p.paymentWithEarlyRepayment).toBe(p.paymentNormal);
  });

  it('différé total : capital augmenté par les intérêts capitalisés', () => {
    const p = planLoan({ ...base, loan: { ...loan, deferral: { type: 'total', months: 60 } } });
    expect(p.capitalAtRepayment).toBeGreaterThan(5000000);
    expect(p.deferralMonthlyCost).toBe(0);
  });
});
