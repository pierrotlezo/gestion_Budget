import { useState } from 'react';
import type { Transaction } from '../../db/schema';
import { useCategories, useRules } from '../../hooks/data';
import { todayISO } from '../../domain/dates';
import { findCategoryForLabel } from '../../domain/rules/categorize';
import { Button, Field, Input, Modal, MoneyInput, Select } from '../../components/ui';
import { deleteTransaction, saveTransaction } from './transactionService';

/** Formulaire d'ajout / modification. `onSaved` reçoit la transaction et indique si la catégorie a été changée à la main. */
export function TransactionForm({ initial, defaultCategoryId, onClose, onSaved }: { initial?: Transaction; defaultCategoryId?: string; onClose: () => void; onSaved?: (t: Transaction, manualCategoryChange: boolean) => void }) {
  const categories = useCategories();
  const rules = useRules();
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [direction, setDirection] = useState<'out' | 'in'>(initial && initial.amount > 0 ? 'in' : 'out');
  const [amount, setAmount] = useState(Math.abs(initial?.amount ?? 0));
  const [label, setLabel] = useState(initial?.label ?? '');
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? defaultCategoryId ?? '');
  const [categoryTouched, setCategoryTouched] = useState(!!defaultCategoryId);
  const [note, setNote] = useState(initial?.note ?? '');

  const onLabel = (v: string) => {
    setLabel(v);
    if (!categoryTouched && !initial) setCategoryId(findCategoryForLabel(v, rules) ?? '');
  };

  const valid = date && amount > 0 && label.trim();

  return (
    <Modal open title={initial ? 'Modifier la transaction' : 'Nouvelle transaction'} onClose={onClose}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          const t: Transaction = {
            id: initial?.id ?? crypto.randomUUID(),
            date,
            amount: direction === 'out' ? -amount : amount,
            label: label.trim(),
            categoryId: categoryId || null,
            note: note.trim() || undefined,
            source: initial?.source ?? 'manual',
            importHash: initial?.importHash,
            isDemo: initial?.isDemo,
          };
          await saveTransaction(t);
          onSaved?.(t, categoryTouched && !!initial && t.categoryId !== initial.categoryId);
          onClose();
        }}
      >
        <Field label="Type">
          <Select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
            <option value="out">Dépense</option>
            <option value="in">Entrée d'argent</option>
          </Select>
        </Field>
        <Field label="Montant">
          <MoneyInput value={amount} onChange={setAmount} autoFocus={!initial} />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Catégorie">
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCategoryTouched(true);
            }}
          >
            <option value="">— À catégoriser —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Libellé" className="sm:col-span-2">
          <Input value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Ex. CARREFOUR CITY" required />
        </Field>
        <Field label="Note (facultatif)" className="sm:col-span-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex gap-2 sm:col-span-2">
          {initial && (
            <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={async () => { if (confirm(`Supprimer « ${initial.label} » ?`)) { await deleteTransaction(initial.id); onClose(); } }}>
              🗑️ Supprimer
            </Button>
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={!valid}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
