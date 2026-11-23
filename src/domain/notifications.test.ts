import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../db/schema';
import { defaultSettings } from '../db/defaults';
import { computeNotifications } from './notifications';
import { computeGameProgress, computeInsights, computeWealth, type AppData } from './progress';

const cat = (id: string, kind: Category['kind'], monthlyBudget = 0): Category => ({ id, name: id === 'alim' ? 'Alimentation' : id, color: '#000', kind, monthlyBudget, order: 0 });
const tx = (date: string, amount: number, categoryId: string, label = 'X'): Transaction => ({ id: `${date}${amount}${categoryId}${label}`, date, amount, label, categoryId, source: 'manual' });

function setup(transactions: Transaction[], nowIso: string, goals: AppData['goals'] = []) {
  const data: AppData = {
    settings: defaultSettings, categories: [cat('alim', 'expense', 20000), cat('epargne', 'savings'), cat('rev', 'income')], transactions,
    investments: [], investmentOps: [], prices: [], savingsAccounts: [], savingsMovements: [], loans: [], goals, tipStates: [],
  };
  const now = new Date(nowIso);
  const today = nowIso.slice(0, 10);
  const wealth = computeWealth(data, today);
  return { data, now, insights: computeInsights(data, today.slice(0, 7)), game: computeGameProgress(data, wealth, today.slice(0, 7), today) };
}
const all = { budget: true, game: true, weekly: true, deals: true };

describe('notifications', () => {
  it('alerte budget à 80 % puis en cas de dépassement', () => {
    let s = setup([tx('2026-11-05', -17000, 'alim')], '2026-11-23T10:00:00');
    let n = computeNotifications({ ...s, deals: [], city: 'Grenoble', enabled: all });
    expect(n.map((x) => x.key)).toContain('budget-warn:alim:2026-11');
    s = setup([tx('2026-11-05', -23000, 'alim')], '2026-11-23T10:00:00');
    n = computeNotifications({ ...s, deals: [], city: 'Grenoble', enabled: all });
    expect(n.find((x) => x.key === 'budget-over:alim:2026-11')?.body).toContain('+30,00');
    expect(computeNotifications({ ...s, deals: [], city: 'Grenoble', enabled: { ...all, budget: false } }).filter((x) => x.kind === 'budget')).toEqual([]);
  });

  it('paliers d’objectifs et rappel de fin de mois pour la série', () => {
    const goal = { id: 'g', name: 'Précaution', icon: '🛟', target: 100000, sources: [], manualAmount: 55000, monthlyContribution: 0, annualReturn: 0 };
    const s = setup([tx('2026-10-10', -2000, 'epargne')], '2026-11-28T19:00:00', [goal]);
    const keys = computeNotifications({ ...s, deals: [], city: 'Grenoble', enabled: all }).map((x) => x.key);
    expect(keys).toEqual(expect.arrayContaining(['goal:g:25', 'goal:g:50', 'streak:2026-11']));
    expect(keys).not.toContain('goal:g:75');
  });

  it('résumé le dimanche soir seulement', () => {
    const txs = [tx('2026-11-20', -3000, 'alim'), tx('2026-11-01', 85000, 'rev')];
    const sunday = setup(txs, '2026-11-22T19:30:00');
    const n = computeNotifications({ ...sunday, deals: [], city: 'Grenoble', enabled: all }).find((x) => x.kind === 'weekly');
    expect(n?.body).toMatch(/Dépensé : 30\s€/); // espace insécable fine avant €
    expect(computeNotifications({ ...setup(txs, '2026-11-22T10:00:00'), deals: [], city: 'Grenoble', enabled: all }).some((x) => x.kind === 'weekly')).toBe(false);
  });

  it('bons plans du jour, groupés', () => {
    const s = setup([], '2026-11-23T13:00:00');
    const deals = [
      { id: 'a', title: 'Musées gratuits', source: 'eVous', link: 'https://x', date: '2026-11-22T10:00:00Z', theme: 'free' as const },
      { id: 'b', title: 'Ski à 9 €', source: 'Dealabs', link: 'https://y', date: '2026-11-20T10:00:00Z', theme: 'ski' as const },
      { id: 'c', title: 'Vieux', source: 'x', link: 'https://z', date: '2026-10-01T10:00:00Z', theme: 'food' as const },
    ];
    const n = computeNotifications({ ...s, deals, city: 'Grenoble', enabled: all }).find((x) => x.kind === 'deals')!;
    expect(n).toMatchObject({ key: 'deals:2026-11-23', title: '📍 2 bons plans à Grenoble' });
    expect(n.body).toBe('• Musées gratuits\n• Ski à 9 €');
  });
});
