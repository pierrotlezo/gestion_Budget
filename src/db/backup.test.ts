import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BudgetDB } from './db';
import { exportAll, importAll, migrateBackup } from './backup';
import { clearDemo, countDemo, generateDemoTransactions, loadDemo } from './demo';
import { defaultRules } from './defaults';

describe('sauvegarde JSON', () => {
  it('exporte puis réimporte à l’identique', async () => {
    const a = new BudgetDB('test-backup-a');
    await a.transactions.add({ id: 't1', date: '2026-11-01', amount: -1234, label: 'TEST', categoryId: 'cat-autre', source: 'manual' });
    const backup = JSON.parse(JSON.stringify(await exportAll(a)));
    const b = new BudgetDB('test-backup-b');
    const counts = await importAll(b, backup);
    expect(counts.transactions).toBe(1);
    expect(await b.transactions.get('t1')).toMatchObject({ amount: -1234, label: 'TEST' });
    expect(await b.categories.count()).toBe(await a.categories.count());
    a.close();
    b.close();
  });

  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => migrateBackup({ foo: 1 })).toThrow(/pas une sauvegarde/);
    expect(() => migrateBackup({ app: 'gestion-budget', formatVersion: 99, data: {} })).toThrow(/plus récente/);
    expect(() => migrateBackup({ app: 'gestion-budget', formatVersion: 1, data: { transactions: [{}] } })).toThrow(/identifiant/);
  });
});

describe('données de démonstration', () => {
  it('génère 12 mois de transactions catégorisées par les règles', () => {
    const tx = generateDemoTransactions('2026-11-23', defaultRules);
    const months = new Set(tx.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBe(12);
    expect(tx.every((t) => t.date <= '2026-11-23' && t.isDemo)).toBe(true);
    expect(tx.find((t) => t.label.includes('NETFLIX'))?.categoryId).toBe('cat-abonnements');
    expect(tx.find((t) => t.label.includes('LOYER'))?.categoryId).toBe('cat-loyer');
    expect(tx.some((t) => t.categoryId === null)).toBe(true);
  });

  it('se charge et s’efface sans toucher aux vraies données', async () => {
    const d = new BudgetDB('test-demo');
    await d.transactions.add({ id: 'real', date: '2026-11-01', amount: -500, label: 'VRAIE', categoryId: null, source: 'manual' });
    const r = await loadDemo(d);
    expect(r.transactions).toBeGreaterThan(100);
    expect(r.movements).toBeGreaterThan(5);
    expect(await countDemo(d)).toBe(r.transactions + r.movements);
    await clearDemo(d);
    expect(await countDemo(d)).toBe(0);
    expect(await d.transactions.count()).toBe(1);
    expect(await d.categories.count()).toBeGreaterThan(5);
    d.close();
  });
});
