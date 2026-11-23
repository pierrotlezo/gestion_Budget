import { describe, expect, it } from 'vitest';
import { monthlyRate, monthsToTarget, requiredMonthly, simulate } from './compound';

describe('intérêts composés', () => {
  it('sans rendement : simple cumul des versements', () => {
    const s = simulate({ initial: 0, monthly: 10000, years: 10, annualReturn: 0 });
    expect(s).toHaveLength(11);
    expect(s[10]).toEqual({ year: 10, contributed: 1200000, value: 1200000, gains: 0 });
  });

  it('capital seul : 1 000 € à 5 % pendant 10 ans = 1 628,89 €', () => {
    expect(simulate({ initial: 100000, monthly: 0, years: 10, annualReturn: 0.05 })[10].value).toBe(162889);
  });

  it('correspond à la formule fermée avec versements', () => {
    const r = monthlyRate(0.07);
    const n = 240;
    const expected = 500000 * Math.pow(1 + r, n) + (10000 * (Math.pow(1 + r, n) - 1)) / r;
    const s = simulate({ initial: 500000, monthly: 10000, years: 20, annualReturn: 0.07 });
    expect(s[20].value).toBe(Math.round(expected));
    expect(s[20].contributed).toBe(500000 + 240 * 10000);
    expect(s[20].gains).toBe(s[20].value - s[20].contributed);
  });

  it('taux mensuel équivalent : 12 mois composés = taux annuel', () => {
    expect(Math.pow(1 + monthlyRate(0.07), 12)).toBeCloseTo(1.07, 10);
  });
});

describe('objectifs', () => {
  it('nombre de mois pour atteindre un montant', () => {
    expect(monthsToTarget(0, 10000, 0, 300000)).toBe(30);
    expect(monthsToTarget(300000, 0, 0, 300000)).toBe(0);
    expect(monthsToTarget(0, 0, 0, 100)).toBeNull();
    expect(monthsToTarget(0, 10000, 0.05, 300000)!).toBeLessThan(30);
  });

  it('versement mensuel nécessaire', () => {
    expect(requiredMonthly(0, 300000, 30, 0)).toBe(10000);
    expect(requiredMonthly(100000, 300000, 20, 0)).toBe(10000);
    expect(requiredMonthly(400000, 300000, 20, 0)).toBe(0);
    // avec rendement, l'effort est plus faible et vérifie la formule
    const pmt = requiredMonthly(0, 1000000, 60, 0.05);
    expect(pmt).toBeLessThan(1000000 / 60);
    expect(monthsToTarget(0, pmt, 0.05, 1000000)).toBe(60);
  });
});
