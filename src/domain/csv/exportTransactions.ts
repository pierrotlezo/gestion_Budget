import type { Category, Transaction } from '../../db/schema';
import { formatDateFR } from '../dates';
import { toCsv } from './parse';

/** Transactions au format CSV français (séparateur « ; », virgule décimale), du plus ancien au plus récent. */
export function transactionsToCsv(transactions: Transaction[], categories: Category[]): string {
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  return toCsv(
    ['Date', 'Libellé', 'Catégorie', 'Montant', 'Note'],
    sorted.map((t) => [formatDateFR(t.date), t.label, t.categoryId ? (name.get(t.categoryId) ?? '') : '', (t.amount / 100).toFixed(2).replace('.', ','), t.note ?? '']),
  );
}
