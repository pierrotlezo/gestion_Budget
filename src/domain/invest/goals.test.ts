import { describe, expect, it } from 'vitest';
import type { SavingsGoal } from '../../db/schema';
import { goalProgress } from './goals';

const goal: SavingsGoal = { id: 'g', name: 'Précaution', icon: '🛟', target: 300000, sources: [], manualAmount: 0, monthlyContribution: 10000, annualReturn: 0 };

describe('progression d’un objectif', () => {
  it('estime la date d’atteinte', () => {
    const p = goalProgress(goal, 100000, '2026-11-23');
    expect(p).toMatchObject({ ratio: 1 / 3, remaining: 200000, reached: false, estimatedDate: '2028-07-23', onTrack: null, requiredMonthly: null });
  });
  it('vérifie l’échéance et calcule l’effort nécessaire', () => {
    const late = goalProgress({ ...goal, deadline: '2027-11-23' }, 100000, '2026-11-23');
    expect(late.onTrack).toBe(false);
    expect(late.requiredMonthly).toBe(16667); // 2 000 € en 12 mois
    expect(goalProgress({ ...goal, deadline: '2029-01-01' }, 100000, '2026-11-23').onTrack).toBe(true);
  });
  it('objectif atteint', () => {
    expect(goalProgress(goal, 350000, '2026-11-23')).toMatchObject({ reached: true, remaining: 0, estimatedDate: '2026-11-23' });
  });
  it('sans versement : jamais atteint', () => {
    expect(goalProgress({ ...goal, monthlyContribution: 0 }, 0, '2026-11-23').estimatedDate).toBeNull();
  });
});
