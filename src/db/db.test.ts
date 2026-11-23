import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BudgetDB } from './db';

describe('base de données', () => {
  it('insère les valeurs par défaut à la création', async () => {
    const db = new BudgetDB('test-populate');
    expect(await db.categories.count()).toBeGreaterThanOrEqual(10);
    expect((await db.settings.get('app'))?.monthlyTransfer).toBe(60000);
    expect((await db.settings.get('app'))?.livretACeiling).toBe(2295000);
    expect(await db.rules.count()).toBeGreaterThan(5);
    expect((await db.loans.toArray())[0].principal).toBe(5000000);
    db.close();
  });
});
