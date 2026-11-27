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

describe('horodatage pour la synchro (version 4)', () => {
  it('valeurs par défaut à 0, créations et modifications horodatées', async () => {
    const db = new BudgetDB('test-stamp');
    expect((await db.categories.get('cat-alimentation'))?.updatedAt).toBe(0);
    expect((await db.settings.get('app'))?.updatedAt).toBe(0);
    const before = Date.now();
    await db.transactions.add({ id: 't', date: '2026-11-01', amount: -100, label: 'X', categoryId: null, source: 'manual' });
    expect((await db.transactions.get('t'))!.updatedAt).toBeGreaterThanOrEqual(before);
    await db.categories.update('cat-alimentation', { monthlyBudget: 30000 });
    expect((await db.categories.get('cat-alimentation'))!.updatedAt).toBeGreaterThanOrEqual(before);
    expect((await db.settings.get('app'))?.city).toBe('Grenoble');
    db.close();
  });

  it('la migration horodate les données existantes', async () => {
    const old = new Dexie('test-migration-4');
    old.version(3).stores({ settings: 'id', categories: 'id, order', transactions: 'id, date, categoryId, importHash', rules: 'id, priority', csvProfiles: 'id', loans: 'id', savingsAccounts: 'id', savingsMovements: 'id, accountId, date', investments: 'id', investmentOps: 'id, investmentId, date', prices: 'id', goals: 'id', scenarios: 'id', tipStates: 'id' });
    const { city: _c, notifications: _n, ...v3Settings } = defaultSettings;
    await old.table('settings').add(v3Settings);
    await old.table('transactions').add({ id: 't', date: '2026-11-01', amount: -100, label: 'X', categoryId: null, source: 'manual' });
    old.close();
    const db = new BudgetDB('test-migration-4');
    expect((await db.transactions.get('t'))!.updatedAt).toBeGreaterThan(0);
    expect((await db.settings.get('app'))).toMatchObject({ city: 'Grenoble', notifications: { budget: true, deals: true } });
    db.close();
  });
});

describe('migration version 4 → 5', () => {
  it('ajoute les règles des enseignes courantes avec les mêmes identifiants qu’un nouvel appareil', async () => {
    const old = new Dexie('test-migration-5');
    old.version(4).stores({ settings: 'id', categories: 'id, order', transactions: 'id, date, categoryId, importHash', rules: 'id, priority', csvProfiles: 'id', loans: 'id', savingsAccounts: 'id', savingsMovements: 'id, accountId, date', investments: 'id', investmentOps: 'id, investmentId, date', prices: 'id', goals: 'id', scenarios: 'id', tipStates: 'id' });
    await old.table('settings').add(defaultSettings);
    await old.table('rules').bulkAdd([
      { id: 'perso', pattern: 'MA REGLE', match: 'contains', categoryId: 'cat-autre', priority: -10 },
      { id: 'deja', pattern: 'IZLY', match: 'contains', categoryId: 'cat-autre', priority: 5 }, // déjà créée à la main : gardée telle quelle
    ]);
    old.close();
    const db = new BudgetDB('test-migration-5');
    const rules = await db.rules.toArray();
    expect(rules.find((r) => r.id === 'perso')).toBeTruthy();
    expect(rules.filter((r) => r.pattern === 'IZLY')).toHaveLength(1);
    const cpam = rules.find((r) => r.pattern === 'CPAM')!;
    expect(cpam).toMatchObject({ categoryId: 'cat-autres-revenus', direction: 'in' });
    // Même identifiant que sur un appareil neuf
    expect(defaultRules.find((r) => r.pattern === 'CPAM')!.id).toBe(cpam.id);
    expect(new Set(defaultRules.map((r) => r.id)).size).toBe(defaultRules.length);
    db.close();
  });
});
