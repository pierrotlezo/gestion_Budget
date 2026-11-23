import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '../../db/schema';
import { useCategories, useTransactions } from '../../hooks/data';
import { formatDateFR, formatMonth, monthOf } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { normalizeLabel } from '../../domain/rules/categorize';
import { Button, Card, ColorDot, EmptyState, Input, PageHeader, Select, Table } from '../../components/ui';
import { TransactionForm } from './TransactionForm';
import { deleteTransaction, saveTransaction } from './transactionService';
import { useRuleSuggestion } from './RuleSuggestion';

const PAGE = 200;

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
      if (q) {
        const hay = normalizeLabel(`${t.label} ${t.note ?? ''} ${(t.amount / 100).toFixed(2).replace('.', ',')}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, month, category, search]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const uncategorized = (transactions ?? []).filter((t) => !t.categoryId).length;

  const changeCategory = async (t: Transaction, categoryId: string) => {
    const updated = { ...t, categoryId: categoryId || null };
    await saveTransaction(updated);
    propose(updated);
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={uncategorized > 0 ? `${uncategorized} transaction(s) à catégoriser` : undefined}
        actions={
          <>
            <Link to="/import"><Button>📥 Importer un relevé CSV</Button></Link>
            <Button variant="primary" onClick={() => setEditing('new')}>+ Nouvelle transaction</Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input type="search" placeholder="Rechercher (libellé, note, montant)…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" />
          <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filtrer par mois">
            <option value="">Tous les mois</option>
            {months.map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par catégorie">
            <option value="">Toutes les catégories</option>
            <option value="__none">— À catégoriser —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {transactions && filtered.length === 0 ? (
          <EmptyState>
            {transactions.length === 0 ? 'Aucune transaction. Ajoute-en une, importe un relevé, ou charge les données de démonstration (menu Données).' : 'Aucune transaction ne correspond aux filtres.'}
          </EmptyState>
        ) : (
          <>
            <div className="mb-2 text-sm text-slate-500">
              {filtered.length} transaction(s) · solde : <strong className={total < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{formatEUR(total, { sign: true })}</strong>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th className="text-right!">Montant</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((t) => {
                  const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">{formatDateFR(t.date)}</td>
                      <td>
                        <div className="font-medium">{t.label}</div>
                        {t.note && <div className="text-xs text-slate-500">{t.note}</div>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ColorDot color={c?.color ?? 'transparent'} />
                          <Select value={t.categoryId ?? ''} onChange={(e) => changeCategory(t, e.target.value)} className={`py-1! ${!c ? 'border-orange-400!' : ''}`} aria-label="Catégorie">
                            <option value="">— À catégoriser —</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </Select>
                        </div>
                      </td>
                      <td className={`whitespace-nowrap text-right font-medium ${t.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatEUR(t.amount, { sign: true })}</td>
                      <td className="whitespace-nowrap text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(t)} aria-label="Modifier">✏️</Button>
                        <Button variant="ghost" size="sm" onClick={() => confirm(`Supprimer « ${t.label} » ?`) && deleteTransaction(t.id)} aria-label="Supprimer">🗑️</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {filtered.length > limit && (
              <div className="mt-3 text-center">
                <Button onClick={() => setLimit((l) => l + PAGE)}>Afficher plus ({filtered.length - limit} restantes)</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {editing && (
        <TransactionForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(t, manual) => manual && propose(t)}
        />
      )}
      {dialog}
    </div>
  );
}
