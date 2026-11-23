import { describe, expect, it } from 'vitest';
import { emptyState, mergeSync, stateKeys, type Row } from './merge';

const r = (id: string, updatedAt: number, extra: Record<string, unknown> = {}): Row => ({ id, updatedAt, ...extra });

describe('synchronisation', () => {
  it('première synchro : le serveur reçoit tout', () => {
    const s = mergeSync(emptyState(), { lastSyncAt: 0, known: [], tables: { transactions: [r('t1', 10)], categories: [r('c1', 0)] } }, 100);
    expect(stateKeys(s).sort()).toEqual(['categories:c1', 'transactions:t1']);
    expect(s.version).toBe(1);
  });

  it('les valeurs par défaut d’un nouveau téléphone n’écrasent pas celles du PC', () => {
    const pc = mergeSync(emptyState(), { lastSyncAt: 0, known: [], tables: { categories: [r('cat-alim', 0, { monthlyBudget: 25000 })] } }, 100);
    const phone = mergeSync(pc, { lastSyncAt: 0, known: [], tables: { categories: [r('cat-alim', 0, { monthlyBudget: 0 })] } }, 200);
    expect(phone.tables.categories['cat-alim'].monthlyBudget).toBe(25000);
  });

  it('la modification la plus récente gagne', () => {
    let s = mergeSync(emptyState(), { lastSyncAt: 0, known: [], tables: { goals: [r('g', 10, { name: 'A' })] } }, 100);
    s = mergeSync(s, { lastSyncAt: 100, known: ['goals:g'], tables: { goals: [r('g', 50, { name: 'B' })] } }, 200);
    expect(s.tables.goals.g.name).toBe('B');
    s = mergeSync(s, { lastSyncAt: 100, known: ['goals:g'], tables: { goals: [r('g', 20, { name: 'vieux' })] } }, 300);
    expect(s.tables.goals.g.name).toBe('B');
  });

  it('une suppression se propage aux autres appareils', () => {
    let s = mergeSync(emptyState(), { lastSyncAt: 0, known: [], tables: { transactions: [r('t1', 10), r('t2', 10)] } }, 100);
    // Le téléphone supprime t1
    s = mergeSync(s, { lastSyncAt: 100, known: ['transactions:t1', 'transactions:t2'], tables: { transactions: [r('t2', 10)] } }, 200);
    expect(Object.keys(s.tables.transactions)).toEqual(['t2']);
    expect(s.tombstones['transactions:t1']).toBe(200);
    // Le PC, qui a encore t1 (ancienne version), synchronise : t1 ne revient pas
    s = mergeSync(s, { lastSyncAt: 100, known: ['transactions:t1', 'transactions:t2'], tables: { transactions: [r('t1', 10), r('t2', 10)] } }, 300);
    expect(Object.keys(s.tables.transactions)).toEqual(['t2']);
  });

  it('une modification faite après la dernière synchro l’emporte sur une suppression', () => {
    let s = mergeSync(emptyState(), { lastSyncAt: 0, known: [], tables: { goals: [r('g', 10)] } }, 100);
    s = mergeSync(s, { lastSyncAt: 100, known: ['goals:g'], tables: { goals: [r('g', 150, { name: 'modifié' })] } }, 160); // PC modifie
    s = mergeSync(s, { lastSyncAt: 100, known: ['goals:g'], tables: { goals: [] } }, 200); // téléphone supprime (il avait l'ancienne)
    expect(s.tables.goals.g.name).toBe('modifié');
  });

  it('un enregistrement recréé après suppression revient', () => {
    let s = mergeSync(emptyState(), { lastSyncAt: 0, known: ['x:a'], tables: { x: [] } }, 100);
    expect(s.tombstones['x:a']).toBe(100);
    s = mergeSync(s, { lastSyncAt: 100, known: [], tables: { x: [r('a', 150)] } }, 200);
    expect(s.tables.x.a).toBeTruthy();
    expect(s.tombstones['x:a']).toBeUndefined();
  });

  it('oublie les vieilles suppressions', () => {
    const s = mergeSync({ tables: {}, tombstones: { 'x:a': 0 }, version: 3 }, { lastSyncAt: 0, known: [], tables: {} }, 200 * 86400000);
    expect(s.tombstones).toEqual({});
  });
});
