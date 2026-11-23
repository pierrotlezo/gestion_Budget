import { db, newId } from '../../db/db';
import type { Category, CategoryKind } from '../../db/schema';

import { CATEGORICAL } from '../../app/chartTheme';

const PALETTE = CATEGORICAL;

export async function addCategory(name: string, kind: CategoryKind): Promise<string> {
  const all = await db.categories.toArray();
  const id = newId();
  await db.categories.add({
    id,
    name: name.trim(),
    kind,
    color: PALETTE[all.length % PALETTE.length],
    monthlyBudget: 0,
    order: Math.max(-1, ...all.map((c) => c.order)) + 1,
  });
  return id;
}

export const updateCategory = (id: string, patch: Partial<Category>) => db.categories.update(id, patch);

/**
 * Supprime une catégorie. Ses transactions et règles sont déplacées vers `targetId`
 * (ou deviennent « à catégoriser » / sont supprimées si targetId est null).
 */
export async function deleteCategory(id: string, targetId: string | null) {
  await db.transaction('rw', db.categories, db.transactions, db.rules, async () => {
    await db.transactions.where('categoryId').equals(id).modify({ categoryId: targetId });
    if (targetId) await db.rules.filter((r) => r.categoryId === id).modify({ categoryId: targetId });
    else await db.rules.filter((r) => r.categoryId === id).delete();
    await db.categories.delete(id);
  });
}

/** Échange l'ordre d'affichage de deux catégories. */
export async function swapOrder(a: Category, b: Category) {
  await db.transaction('rw', db.categories, async () => {
    await db.categories.update(a.id, { order: b.order });
    await db.categories.update(b.id, { order: a.order });
  });
}

export const KIND_LABELS: Record<CategoryKind, string> = {
  expense: 'Dépense',
  savings: 'Épargne',
  income: 'Revenu',
};
