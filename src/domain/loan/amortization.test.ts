import { describe, expect, it } from 'vitest';
import type { Loan } from '../../db/schema';
import { buildSchedule, loanCostBetween, monthlyPayment, remainingCapitalAt, summarizeLoan } from './amortization';

const base: Loan = {
  id: 'l',
  name: 'Prêt',
  principal: 5000000,
  annualRate: 0.012,
  durationMonths: 60,
  startDate: '2026-01-15',
  monthlyInsurance: 0,
  deferral: { type: 'none', months: 0 },
};

describe('mensualité', () => {
  it('correspond à la formule classique', () => {
    // 50 000 € à 1,2 % sur 60 mois → 859,00 € (référence : 50000·0,001 / (1 − 1,001^−60) = 858,9998)
    expect(monthlyPayment(5000000, 0.012, 60)).toBe(85900);
    // 10 000 € à 3 % sur 12 mois → 846,94 €
    expect(monthlyPayment(1000000, 0.03, 12)).toBe(84694);
  });
  it('gère un taux nul', () => {
    expect(monthlyPayment(1200000, 0, 12)).toBe(100000);
  });
});

describe('tableau d’amortissement sans différé', () => {
  const s = buildSchedule(base);
  it('rembourse tout le capital', () => {
    expect(s).toHaveLength(60);
    expect(s.at(-1)!.remaining).toBe(0);
    expect(s.reduce((a, r) => a + r.principal, 0)).toBe(5000000);
  });
  it('première échéance un mois après le déblocage, intérêts sur le capital initial', () => {
    expect(s[0].date).toBe('2026-02-15');
    expect(s[0].interest).toBe(5000); // 50 000 × 1,2 % / 12 = 50 €
    expect(s[0].principal).toBe(85900 - 5000);
  });
  it('coût total = total payé − capital', () => {
    const sum = summarizeLoan(base, s, '2030-01-01');
    expect(sum.totalPaid - base.principal).toBe(sum.totalCost);
    expect(sum.totalInterest).toBeGreaterThan(153900);
    expect(sum.totalInterest).toBeLessThan(154100);
  });
  it('capital restant dû et intérêts payés à une date', () => {
    const sum = summarizeLoan(base, s, '2026-04-20'); // 3 échéances passées
    expect(sum.paymentsDone).toBe(3);
    expect(sum.remainingCapital).toBe(s[2].remaining);
    expect(sum.interestToDate).toBe(s[0].interest + s[1].interest + s[2].interest);
    expect(remainingCapitalAt(base, s, '2025-12-31')).toBe(0); // pas encore emprunté
    expect(remainingCapitalAt(base, s, '2026-01-20')).toBe(5000000);
  });
});

describe('différé', () => {
  it('partiel : on paie les intérêts, le capital reste constant', () => {
    const loan: Loan = { ...base, deferral: { type: 'partial', months: 60 }, monthlyInsurance: 500 };
    const s = buildSchedule(loan);
    expect(s).toHaveLength(120);
    expect(s[0]).toMatchObject({ phase: 'deferral', payment: 5000, interest: 5000, principal: 0, remaining: 5000000, insurance: 500 });
    expect(s[59].remaining).toBe(5000000);
    expect(s[60]).toMatchObject({ phase: 'amortization', payment: 85900 });
    const sum = summarizeLoan(loan, s, '2026-01-01');
    expect(sum.deferralPayment).toBe(5000);
    expect(sum.totalInsurance).toBe(120 * 500);
    expect(sum.totalInterest).toBe(60 * 5000 + s.slice(60).reduce((a, r) => a + r.interest, 0));
    expect(sum.deferralEndDate).toBe('2031-01-15');
    expect(sum.endDate).toBe('2036-01-15');
  });

  it('total : les intérêts sont capitalisés', () => {
    const loan: Loan = { ...base, deferral: { type: 'total', months: 60 } };
    const s = buildSchedule(loan);
    expect(s[0]).toMatchObject({ payment: 0, interest: 5000, principal: -5000, remaining: 5005000 });
    // ≈ 50 000 × (1 + 0,001)^60 ≈ 53 090,8 €
    expect(s[59].remaining).toBeGreaterThan(5309000);
    expect(s[59].remaining).toBeLessThan(5309200);
    expect(s.at(-1)!.remaining).toBe(0);
    const sum = summarizeLoan(loan, s, '2040-01-01');
    expect(sum.totalPaid - loan.principal).toBe(sum.totalCost);
    // le différé total coûte plus cher que le différé partiel
    const partial = summarizeLoan(loan, buildSchedule({ ...loan, deferral: { type: 'partial', months: 60 } }), '2040-01-01');
    expect(sum.totalCost).toBeGreaterThan(partial.totalCost);
  });

  it('coût sur une période', () => {
    const loan: Loan = { ...base, deferral: { type: 'partial', months: 60 }, monthlyInsurance: 500 };
    const s = buildSchedule(loan);
    // 2026 : échéances de février à décembre = 11 mois
    expect(loanCostBetween(s, '2026-01-01', '2026-12-31')).toBe(11 * 5500);
  });
});

describe('mensualité imposée par la banque', () => {
  it('la dernière échéance solde le capital', () => {
    const s = buildSchedule({ ...base, monthlyPaymentOverride: 86000 });
    expect(s[0].payment).toBe(86000);
    expect(s.at(-1)!.remaining).toBe(0);
  });
});
