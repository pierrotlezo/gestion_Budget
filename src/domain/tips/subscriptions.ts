/**
 * Détection des dépenses récurrentes (abonnements, loyer, électricité…) et de leurs hausses de prix.
 * Une dépense est récurrente si le même libellé revient au plus une fois par mois,
 * sur au moins `minMonths` des derniers mois, avec un montant quasi identique.
 */
import type { Transaction } from '../../db/schema';
import type { Cents } from '../money';
import { lastMonths, monthOf, type ISODate, type MonthKey } from '../dates';
import { normalizeLabel } from '../rules/categorize';

export interface Subscription {
  key: string;
  label: string;
  categoryId: string | null;
  amount: Cents;
  months: number;
  lastDate: ISODate;
  /** Hausse de prix entre les deux derniers prélèvements. */
  increase: { from: Cents; to: Cents } | null;
}

/** Clé de regroupement : libellé sans chiffres ni mots bancaires. */
export function subscriptionKey(label: string): string {
  return normalizeLabel(label)
    .replace(/\b(PRLV|SEPA|CB|CARTE|PAIEMENT|ACHAT|FACTURE|ECH(EANCE)?|PRELEVEMENT)\b/g, ' ')
    .replace(/[0-9/.\-*]+/g, ' ')
    .replace(/\b(X+)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSubscriptions(transactions: Transaction[], endMonth: MonthKey, monthsBack = 4, minMonths = 3, maxRatio = 1.25): Subscription[] {
  const window = new Set(lastMonths(endMonth, monthsBack));
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount >= 0 || !window.has(monthOf(t.date))) continue;
    const key = subscriptionKey(t.label);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: Subscription[] = [];
  for (const [key, list] of groups) {
    const months = new Set(list.map((t) => monthOf(t.date)));
    if (months.size < minMonths || list.length > months.size) continue; // au plus une fois par mois
    const amounts = list.map((t) => -t.amount);
    if (Math.max(...amounts) > Math.min(...amounts) * maxRatio) continue; // montant stable
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted.at(-1)!;
    const prev = sorted.at(-2)!;
    const increase = -last.amount > -prev.amount * 1.02 ? { from: -prev.amount, to: -last.amount } : null;
    out.push({ key, label: last.label, categoryId: last.categoryId, amount: -last.amount, months: months.size, lastDate: last.date, increase });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
