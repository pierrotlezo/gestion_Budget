import { useState } from 'react';
import { db } from '../../db/db';
import type { CategoryRule } from '../../db/schema';
import { useCategories, useRules } from '../../hooks/data';
import { findCategoryForLabel } from '../../domain/rules/categorize';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Table } from '../../components/ui';
import { applyRules, createRule } from '../transactions/transactionService';

export function RulesPage() {
  const rules = useRules();
  const categories = useCategories();
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? '?';
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [test, setTest] = useState('');
  const [message, setMessage] = useState('');

  /** Échange deux règles puis renumérote toutes les priorités (0, 10, 20…). */
  const move = async (r: CategoryRule, dir: -1 | 1) => {
    const i = rules.findIndex((x) => x.id === r.id);
    if (!rules[i + dir]) return;
    const order = [...rules];
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await db.rules.bulkUpdate(order.map((x, j) => ({ key: x.id, changes: { priority: j * 10 } })));
  };

  const tested = test ? findCategoryForLabel(test, rules) : undefined;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Règles de catégorisation"
        subtitle="Si le libellé contient le texte, la transaction est classée dans la catégorie. La première règle qui correspond l'emporte."
        actions={
          <>
            <Button onClick={async () => setMessage(`${await applyRules(true)} transaction(s) catégorisée(s).`)}>Appliquer aux non catégorisées</Button>
            <Button
              onClick={async () => {
                if (confirm('Réappliquer les règles à TOUTES les transactions ? Les catégories choisies à la main peuvent être remplacées.')) setMessage(`${await applyRules(false)} transaction(s) modifiée(s).`);
              }}
            >
              Réappliquer à tout
            </Button>
          </>
        }
      />
      {message && <div className="mb-4"><Alert tone="success">{message}</Alert></div>}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card title="Nouvelle règle">
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pattern.trim() || !categoryId) return;
              await createRule(pattern, categoryId);
              setPattern('');
            }}
          >
            <Field label="Le libellé contient">
              <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Ex. BOULANGERIE" />
            </Field>
            <Field label="Catégorie">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Choisir —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="primary" disabled={!pattern.trim() || !categoryId}>Ajouter</Button>
          </form>
        </Card>
        <Card title="Tester un libellé">
          <Input value={test} onChange={(e) => setTest(e.target.value)} placeholder="Ex. CB CARREFOUR CITY 12/11" />
          {test && <p className="mt-3 text-sm">→ {tested ? <strong>{catName(tested)}</strong> : 'Aucune règle ne correspond.'}</p>}
        </Card>
      </div>

      <Card title={`${rules.length} règle(s)`}>
        <Table>
          <thead>
            <tr>
              <th>Le libellé contient</th>
              <th>Catégorie</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <Input defaultValue={r.pattern} onBlur={(e) => e.target.value.trim() && db.rules.update(r.id, { pattern: e.target.value.trim() })} className="py-1!" aria-label="Motif" />
                </td>
                <td>
                  <Select value={r.categoryId} onChange={(e) => db.rules.update(r.id, { categoryId: e.target.value })} className="py-1!" aria-label="Catégorie">
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </td>
                <td className="whitespace-nowrap text-right">
                  <Button variant="ghost" size="sm" onClick={() => move(r, -1)} disabled={i === 0} aria-label="Monter">▲</Button>
                  <Button variant="ghost" size="sm" onClick={() => move(r, 1)} disabled={i === rules.length - 1} aria-label="Descendre">▼</Button>
                  <Button variant="ghost" size="sm" onClick={() => db.rules.delete(r.id)} aria-label="Supprimer">🗑️</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
