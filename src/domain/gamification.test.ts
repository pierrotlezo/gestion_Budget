import { describe, expect, it } from 'vitest';
import { computeXp, levelFor, reachedMilestones, savedByMonth, savingStreak, unlockedBadges } from './gamification';

describe('gamification', () => {
  it('niveaux', () => {
    expect(levelFor(0).current.name).toBe('Graine');
    expect(levelFor(150)).toMatchObject({ current: { level: 2 }, next: { level: 3 }, progress: 0.25 });
    expect(levelFor(99999)).toMatchObject({ current: { level: 8 }, next: null, progress: 1 });
  });

  it('paliers', () => {
    expect(reachedMilestones(0.2)).toEqual([]);
    expect(reachedMilestones(0.5)).toEqual([25, 50]);
    expect(reachedMilestones(1.2)).toEqual([25, 50, 75, 100]);
  });

  it('épargne par mois sans double comptage, gros versements ignorés', () => {
    const m = savedByMonth(
      [{ date: '2026-10-15', amount: -2500 }, { date: '2026-11-15', amount: -2500 }],
      [{ date: '2026-10-15', amount: 2500 }, { date: '2026-11-20', amount: 5000 }, { date: '2026-09-01', amount: 2295000 }],
    );
    expect(m.get('2026-10')).toBe(2500);
    expect(m.get('2026-11')).toBe(5000);
    expect(m.has('2026-09')).toBe(false);
  });

  it('série de mois', () => {
    const m = new Map([['2026-09', 100], ['2026-10', 100], ['2026-08', 0], ['2026-07', 100]]);
    expect(savingStreak(m, '2026-11')).toBe(2); // novembre pas encore épargné : on part d'octobre
    m.set('2026-11', 100);
    expect(savingStreak(m, '2026-11')).toBe(3);
    expect(savingStreak(new Map(), '2026-11')).toBe(0);
  });

  it('badges et XP', () => {
    const b = unlockedBadges({ totalSaved: 120000, streak: 3, goals: 1, goalsReached: 0, investments: 2, envelopes: new Set(['crypto', 'pea']), supports: 3, budgetMonthRespected: false, tipsTried: 1 });
    expect([...b].sort()).toEqual(['crypto', 'diversified', 'first_goal', 'first_investment', 'first_save', 'pea', 'saved1000', 'streak3']);
    expect(computeXp({ totalSaved: 120000, milestones: [25, 50], badges: 8, tips: { trying: 1, done: 1 } })).toBe(1200 + 75 + 400 + 60);
  });
});
