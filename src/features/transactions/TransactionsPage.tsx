import { useMemo, useState } from 'react';
import type { Transaction } from '../../db/schema';
import { useCategories, useTransactions } from '../../hooks/data';
import { formatMonth, monthOf } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { normalizeLabel } from '../../domain/rules/categorize';
import { Button, EmptyState, Input, Select } from '../../components/ui';
import { TransactionForm } from './TransactionForm';
import { TransactionRows } from './TransactionRows';
import { useRuleSuggestion } from './RuleSuggestion';

const PAGE = 150;

/** Toutes les opérations, groupées par jour. Un clic sur une opération permet de la modifier. */
export function TransactionsPage() {
  const transactions = useTransactions();
  const categories = useCategories();
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const { propose, dialog } = useRuleSuggestion();

  const months = useMemo(() => [...new Set((transactions ?? []).map((t) => monthOf(t.date)))].sort().reverse(), [transactions]);
  const filtered = useMemo(() => {
    const q = normalizeLabel(search);
    return (transactions ?? []).filter((t) => {
      if (month && monthOf(t.date) !== month) return false;
      if (category === '__none' ? t.categoryId : category && t.categoryId !== category) return false;
      if (q && !normalizeLabel(`${t.label} ${t.note ?? ''} ${(t.amount / 100).toFixed(2).replace('.', ',')}`).includes(q)) return false;
      return true;
    });
  }, [transactions, month, category, search]);
  const total = filtered.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" placeholder="🔍 Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" className="max-w-xs flex-1" />
        <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className="w-auto">
          <option value="">Tous les mois</option>
          {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie" className="w-auto">
          <option value="">Toutes les catégories</option>
          <option value="__none">❔ À trier</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
        <Button variant="primary" className="ml-auto" onClick={() => setEditing('new')}>+ Ajouter</Button>
      </div>

      {transactions && filtered.length === 0 ? (
        <EmptyState>{transactions.length === 0 ? 'Aucune opération. Importe un relevé ou ajoute une dépense.' : 'Aucune opération ne correspond.'}</EmptyState>
      ) : (
        <>
          <div className="text-sm text-slate-500">{filtered.length} opération{filtered.length > 1 ? 's' : ''} · <strong className={total < 0 ? '' : 'text-emerald-600 dark:text-emerald-400'}>{formatEUR(total, { sign: true })}</strong></div>
          <TransactionRows transactions={filtered.slice(0, limit)} categories={catMap} onOpen={setEditing} />
          {filtered.length > limit && <div className="text-center"><Button onClick={() => setLimit((l) => l + PAGE)}>Afficher plus</Button></div>}
        </>
      )}

      {editing && (
        <TransactionForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(t, manual) => manual && propose(t)} />
      )}
      {dialog}
    </div>
  );
}
