import { db, newId } from '../../db/db';
import type { CategoryRule, Transaction } from '../../db/schema';
import { findCategoryForLabel, ruleMatches } from '../../domain/rules/categorize';
import type { DraftTransaction } from '../../domain/csv/parse';

export async function saveTransaction(t: Omit<Transaction, 'id'> & { id?: string }) {
  const id = t.id ?? newId();
  await db.transactions.put({ ...t, id });
  return id;
}

export const deleteTransaction = (id: string) => db.transactions.delete(id);

/** Importe les lignes d'un relevé en ignorant celles déjà présentes. Renvoie le nombre importé. */
export async function importDrafts(drafts: DraftTransaction[]): Promise<{ imported: number; duplicates: number }> {
  return db.transaction('rw', db.transactions, async () => {
    const hashes = new Set((await db.transactions.where('importHash').anyOf(drafts.map((d) => d.importHash)).toArray()).map((t) => t.importHash));
    const fresh = drafts.filter((d) => !hashes.has(d.importHash));
    await db.transactions.bulkAdd(
      fresh.map((d) => ({ id: newId(), date: d.date, amount: d.amount, label: d.label, categoryId: d.categoryId, source: 'csv' as const, importHash: d.importHash })),
    );
    return { imported: fresh.length, duplicates: drafts.length - fresh.length };
  });
}

/** Crée une règle prioritaire sur les règles existantes. */
export async function createRule(pattern: string, categoryId: string): Promise<CategoryRule> {
  const first = await db.rules.orderBy('priority').first();
  const rule: CategoryRule = { id: newId(), pattern: pattern.trim(), match: 'contains', categoryId, priority: (first?.priority ?? 0) - 10 };
  await db.rules.add(rule);
  return rule;
}

/** Applique les règles aux transactions (par défaut uniquement à celles non catégorisées). */
export async function applyRules(onlyUncategorized = true): Promise<number> {
  const rules = await db.rules.toArray();
  let count = 0;
  await db.transaction('rw', db.transactions, async () => {
    const list = onlyUncategorized ? await db.transactions.filter((t) => !t.categoryId).toArray() : await db.transactions.toArray();
    for (const t of list) {
      const cat = findCategoryForLabel(t.label, rules);
      if (cat && cat !== t.categoryId) {
        await db.transactions.update(t.id, { categoryId: cat });
        count++;
      }
    }
  });
  return count;
}

/** Transactions (autres que `exceptId`) dont le libellé correspond au motif et qui ne sont pas dans `categoryId`. */
export async function findMatching(pattern: string, categoryId: string, exceptId?: string) {
  const rule: CategoryRule = { id: '', pattern, match: 'contains', categoryId, priority: 0 };
  return db.transactions.filter((t) => t.id !== exceptId && t.categoryId !== categoryId && ruleMatches(rule, t.label)).toArray();
}
