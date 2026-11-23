import { describe, expect, it } from 'vitest';
import type { CategoryRule } from '../../db/schema';
import { parseAmount } from '../money';
import { parseDate } from '../dates';
import { decodeFile, detectDelimiter, guessMapping, mapRows, parseCsvTable, toCsv } from './parse';

describe('montants', () => {
  it('lit la virgule décimale française', () => {
    expect(parseAmount('12,50')).toBe(1250);
    expect(parseAmount('-1 234,56 €')).toBe(-123456);
    expect(parseAmount('1 234,5')).toBe(123450);
    expect(parseAmount('1.234,56')).toBe(123456);
    expect(parseAmount('+600,00')).toBe(60000);
  });
  it('lit aussi le point décimal', () => {
    expect(parseAmount('12.30', '.')).toBe(1230);
    expect(parseAmount('12.30', ',')).toBe(1230);
    expect(parseAmount('1,234.56', '.')).toBe(123456);
  });
  it('gère « 1.234 » selon le séparateur attendu', () => {
    expect(parseAmount('1.234', ',')).toBe(123400);
    expect(parseAmount('1.234', '.')).toBe(123);
  });
  it('gère les notations négatives bancaires', () => {
    expect(parseAmount('(45,00)')).toBe(-4500);
    expect(parseAmount('45,00-')).toBe(-4500);
  });
  it('refuse ce qui n’est pas un montant', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('dates', () => {
  it('lit JJ/MM/AAAA et variantes', () => {
    expect(parseDate('05/11/2026')).toBe('2026-11-05');
    expect(parseDate('5-11-2026')).toBe('2026-11-05');
    expect(parseDate('05.11.26')).toBe('2026-11-05');
    expect(parseDate('2026-11-05', 'YYYY-MM-DD')).toBe('2026-11-05');
  });
  it('refuse les dates impossibles', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('13/13/2026')).toBeNull();
    expect(parseDate('hier')).toBeNull();
  });
});

describe('import CSV', () => {
  const rules: CategoryRule[] = [{ id: 'r', pattern: 'CARREFOUR', match: 'contains', categoryId: 'alim', priority: 0 }];

  it('importe un relevé « montant unique » au format français', () => {
    const text = 'Date;Libellé;Montant\n03/11/2026;CB CARREFOUR CITY;-23,45\n01/11/2026;VIR LIVRET A;600,00\n';
    const delimiter = detectDelimiter(text);
    expect(delimiter).toBe(';');
    const table = parseCsvTable(text, delimiter);
    const mapping = { ...guessMapping(table.headers), dateFormat: 'DD/MM/YYYY', decimalSeparator: ',' } as const;
    expect(mapping.dateColumn).toBe('Date');
    const { drafts, errors } = mapRows(table, mapping as never, rules);
    expect(errors).toEqual([]);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ date: '2026-11-03', amount: -2345, categoryId: 'alim' });
    expect(drafts[1]).toMatchObject({ amount: 60000, categoryId: null });
  });

  it('importe un relevé « débit / crédit » avec lignes d’en-tête à ignorer', () => {
    const text = 'Compte courant n°123\n\nDate opération;Libellé;Débit;Crédit\n04/11/2026;SNCF;45,00;\n05/11/2026;REMBOURSEMENT;;12,00\nbad;X;1;\n';
    const table = parseCsvTable(text, ';', 2);
    const guess = guessMapping(table.headers);
    expect(guess.amount).toEqual({ mode: 'debitCredit', debit: 'Débit', credit: 'Crédit' });
    const { drafts, errors } = mapRows(table, { ...guess, dateFormat: 'DD/MM/YYYY', decimalSeparator: ',' } as never);
    expect(drafts.map((d) => d.amount)).toEqual([-4500, 1200]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(4);
  });

  it('devine les colonnes même quand « opération » apparaît dans plusieurs en-têtes', () => {
    expect(guessMapping(['Date opération', 'Date valeur', 'Libellé', 'Débit', 'Crédit'])).toEqual({
      dateColumn: 'Date opération',
      labelColumns: ['Libellé'],
      amount: { mode: 'debitCredit', debit: 'Débit', credit: 'Crédit' },
    });
    expect(guessMapping(['Date', 'Montant', 'Type opération'])).toMatchObject({ dateColumn: 'Date', labelColumns: ['Type opération'], amount: { mode: 'single', column: 'Montant' } });
    expect(guessMapping(['Booking date', 'Amount', 'Description'])).toMatchObject({ dateColumn: 'Booking date', labelColumns: ['Description'], amount: { column: 'Amount' } });
  });

  it('distingue deux achats identiques le même jour mais reste stable à la réimportation', () => {
    const text = 'Date;Libellé;Montant\n03/11/2026;CAFE;-2,00\n03/11/2026;CAFE;-2,00\n';
    const table = parseCsvTable(text, ';');
    const m = { dateColumn: 'Date', labelColumns: ['Libellé'], amount: { mode: 'single', column: 'Montant' }, dateFormat: 'DD/MM/YYYY', decimalSeparator: ',' } as const;
    const a = mapRows(table, m as never).drafts.map((d) => d.importHash);
    const b = mapRows(table, m as never).drafts.map((d) => d.importHash);
    expect(new Set(a).size).toBe(2);
    expect(a).toEqual(b);
  });

  it('décode un fichier Windows-1252', () => {
    const bytes = new Uint8Array([0x4c, 0x69, 0x62, 0x65, 0x6c, 0x6c, 0xe9]); // « Libellé » en Windows-1252
    expect(decodeFile(bytes.buffer)).toEqual({ text: 'Libellé', encoding: 'windows-1252' });
  });

  it('exporte un CSV avec échappement', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'z"']])).toBe('﻿a;b\r\n"x;y";"z"""');
  });
});
