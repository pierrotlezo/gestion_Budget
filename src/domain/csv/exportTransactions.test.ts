import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../../db/schema';
import { transactionsToCsv } from './exportTransactions';

describe('export CSV des transactions', () => {
  it('produit un CSV lisible par Excel en français', () => {
    const cats: Category[] = [{ id: 'alim', name: 'Alimentation', color: '#000', monthlyBudget: 0, kind: 'expense', order: 0 }];
    const tx: Transaction[] = [
      { id: '2', date: '2026-11-05', amount: -2345, label: 'CB CARREFOUR; CITY', categoryId: 'alim', note: 'courses "semaine"', source: 'csv' },
      { id: '1', date: '2026-11-01', amount: 60000, label: 'VIR LIVRET A', categoryId: null, source: 'csv' },
    ];
    expect(transactionsToCsv(tx, cats)).toBe(
      '﻿Date;Libellé;Catégorie;Montant;Note\r\n01/11/2026;VIR LIVRET A;;600,00;\r\n05/11/2026;"CB CARREFOUR; CITY";Alimentation;-23,45;"courses ""semaine"""',
    );
  });
});
