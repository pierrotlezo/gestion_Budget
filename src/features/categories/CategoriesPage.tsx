import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Category, CategoryKind } from '../../db/schema';
import { useCategories } from '../../hooks/data';
import { Button, Card, Field, Input, Modal, MoneyInput, PageHeader, Select } from '../../components/ui';
import { formatEUR } from '../../domain/money';
import { addCategory, deleteCategory, KIND_LABELS, swapOrder, updateCategory } from './categoryService';

const GROUPS: { kind: CategoryKind; title: string; budgetLabel: string }[] = [
  { kind: 'expense', title: 'Dépenses', budgetLabel: 'Budget mensuel' },
  { kind: 'savings', title: 'Épargne', budgetLabel: 'Objectif mensuel' },
  { kind: 'income', title: 'Revenus', budgetLabel: 'Montant attendu' },
];

export function CategoriesPage() {
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKind>('expense');
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const totalBudget = categories.filter((c) => c.kind !== 'income').reduce((s, c) => s + c.monthlyBudget, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Catégories & budgets" subtitle={`Icône, couleur et budget de chaque catégorie · total des budgets : ${formatEUR(totalBudget)} / mois`} />

      <Card className="mb-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            await addCategory(newName, newKind);
            setNewName('');
          }}
        >
          <Field label="Nouvelle catégorie" className="min-w-48 flex-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex. Santé" />
          </Field>
          <Field label="Type">
            <Select value={newKind} onChange={(e) => setNewKind(e.target.value as CategoryKind)}>
              {Object.entries(KIND_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary">Ajouter</Button>
        </form>
      </Card>

      <div className="space-y-4">
        {GROUPS.map((g) => {
          const list = categories.filter((c) => c.kind === g.kind);
          return (
            <Card key={g.kind} title={g.title}>
              <div className="space-y-2">
                {list.map((c, i) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    budgetLabel={g.budgetLabel}
                    onUp={i > 0 ? () => swapOrder(c, list[i - 1]) : undefined}
                    onDown={i < list.length - 1 ? () => swapOrder(c, list[i + 1]) : undefined}
                    onDelete={() => setToDelete(c)}
                  />
                ))}
                {list.length === 0 && <p className="text-sm text-slate-500">Aucune catégorie.</p>}
              </div>
            </Card>
          );
        })}
      </div>

      {toDelete && <DeleteDialog category={toDelete} categories={categories} onClose={() => setToDelete(null)} />}
    </div>
  );
}

function CategoryRow({ category: c, budgetLabel, onUp, onDown, onDelete }: { category: Category; budgetLabel: string; onUp?: () => void; onDown?: () => void; onDelete: () => void }) {
  const [name, setName] = useState(c.name);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg p-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <Input
        defaultValue={c.icon ?? ''}
        onBlur={(e) => e.target.value.trim() && updateCategory(c.id, { icon: e.target.value.trim() })}
        className="w-14 text-center text-lg"
        aria-label={`Icône de ${c.name}`}
        title="Icône (emoji) — Windows : touche Windows + . · Mac : Ctrl + Cmd + Espace"
      />
      <input
        type="color"
        value={c.color}
        onChange={(e) => updateCategory(c.id, { color: e.target.value })}
        className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
        aria-label={`Couleur de ${c.name}`}
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== c.name ? updateCategory(c.id, { name: name.trim() }) : setName(c.name)}
        className="min-w-40 flex-1"
        aria-label="Nom de la catégorie"
      />
      <div className="w-36" title={budgetLabel}>
        <MoneyInput value={c.monthlyBudget} onChange={(v) => updateCategory(c.id, { monthlyBudget: v })} aria-label={budgetLabel} />
      </div>
      <Select value={c.kind} onChange={(e) => updateCategory(c.id, { kind: e.target.value as CategoryKind })} className="w-32" aria-label="Type">
        {Object.entries(KIND_LABELS).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </Select>
      <div className="flex">
        <Button variant="ghost" size="sm" onClick={onUp} disabled={!onUp} aria-label="Monter">▲</Button>
        <Button variant="ghost" size="sm" onClick={onDown} disabled={!onDown} aria-label="Descendre">▼</Button>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Supprimer ${c.name}`}>🗑️</Button>
      </div>
    </div>
  );
}

function DeleteDialog({ category, categories, onClose }: { category: Category; categories: Category[]; onClose: () => void }) {
  const count = useLiveQuery(() => db.transactions.where('categoryId').equals(category.id).count(), [category.id]) ?? 0;
  const others = categories.filter((c) => c.id !== category.id);
  const [target, setTarget] = useState<string>(others.find((c) => c.id === 'cat-autre')?.id ?? '');
  return (
    <Modal open title={`Supprimer « ${category.name} » ?`} onClose={onClose}>
      <p className="mb-3 text-sm">
        {count === 0 ? 'Aucune transaction n\'utilise cette catégorie.' : `${count} transaction(s) utilisent cette catégorie. Où les déplacer ?`}
      </p>
      {count > 0 && (
        <Field label="Déplacer vers" className="mb-4">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">— À catégoriser —</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="danger"
          onClick={async () => {
            await deleteCategory(category.id, target || null);
            onClose();
          }}
        >
          Supprimer
        </Button>
      </div>
    </Modal>
  );
}
