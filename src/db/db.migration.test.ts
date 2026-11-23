import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { BudgetDB } from './db';
import { defaultCategories, defaultRules, defaultSettings } from './defaults';

describe('migration version 1 → 2', () => {
  it('conserve les données et ajoute les nouveautés', async () => {
    // Base « ancienne » créée avec le schéma de la version 1
    const old = new Dexie('test-migration');
    old.version(1).stores({ settings: 'id', categories: 'id, order', transactions: 'id, date, categoryId, importHash', rules: 'id, priority', csvProfiles: 'id', loans: 'id', savingsAccounts: 'id', savingsMovements: 'id, accountId, date' });
    const { autoPrices: _ignored, ...v1Settings } = defaultSettings;
    await old.table('settings').add(v1Settings);
    await old.table('categories').bulkAdd(defaultCategories);
    await old.table('rules').bulkAdd(defaultRules.filter((r) => !['COINBASE', 'BINANCE'].includes(r.pattern)));
    await old.table('transactions').add({ id: 't', date: '2026-11-01', amount: -100, label: 'X', categoryId: null, source: 'manual' });
    old.close();

    const db = new BudgetDB('test-migration');
    expect(await db.transactions.get('t')).toBeTruthy();
    expect((await db.settings.get('app'))?.autoPrices).toBe(true);
    expect(await db.scenarios.count()).toBe(2);
    const patterns = (await db.rules.toArray()).map((r) => r.pattern);
    expect(patterns.filter((p) => p === 'COINBASE')).toHaveLength(1);
    expect(patterns.filter((p) => p === 'TRADE REPUBLIC')).toHaveLength(1);
    expect(await db.investments.count()).toBe(0);
    db.close();
  });
});

describe('migration version 2 → 3', () => {
  it('ajoute les icônes de catégories et le plan de prêt', async () => {
    const old = new Dexie('test-migration-3');
    old.version(2).stores({ settings: 'id', categories: 'id, order', transactions: 'id, date, categoryId, importHash', rules: 'id, priority', csvProfiles: 'id', loans: 'id', savingsAccounts: 'id', savingsMovements: 'id, accountId, date', investments: 'id', investmentOps: 'id, investmentId, date', prices: 'id', goals: 'id', scenarios: 'id' });
    const { autoDeals: _a, loanPlan: _l, ...v2Settings } = defaultSettings;
    await old.table('settings').add(v2Settings);
    await old.table('categories').bulkAdd([
      { id: 'cat-alimentation', name: 'Alimentation', color: '#000', monthlyBudget: 0, kind: 'expense', order: 0 },
      { id: 'perso', name: 'Santé', color: '#000', monthlyBudget: 0, kind: 'expense', order: 1 },
    ]);
    old.close();
    const db = new BudgetDB('test-migration-3');
    expect(await db.categories.get('cat-alimentation')).toMatchObject({ icon: '🛒', dealFeeds: ['epicerie', 'restaurants'] });
    expect((await db.categories.get('perso'))?.icon).toBe('🏷️');
    expect((await db.settings.get('app'))?.loanPlan).toMatchObject({ monthlyDraw: 60000, drawYears: 3 });
    expect(await db.tipStates.count()).toBe(0);
    db.close();
  });
});
