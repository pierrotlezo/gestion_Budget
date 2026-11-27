import { useEffect, useState } from 'react';
import { db } from '../../db/db';
import type { Transaction } from '../../db/schema';
import { useCategoryMap, useRules } from '../../hooks/data';
import { ruleMatches, suggestPattern } from '../../domain/rules/categorize';
import { Button, Field, Input, Modal } from '../../components/ui';
import { createRule, findMatching } from './transactionService';

/**
 * Après une recatégorisation manuelle, propose de créer une règle
 * (sauf si une règle existante classe déjà ce libellé dans cette catégorie).
 */
export function useRuleSuggestion() {
  const rules = useRules();
  const [target, setTarget] = useState<Transaction | null>(null);
  const propose = (t: Transaction) => {
    if (!t.categoryId) return;
    const covered = rules.some((r) => r.categoryId === t.categoryId && ruleMatches(r, t.label, t.amount));
    if (!covered) setTarget(t);
  };
  const dialog = target ? <RuleSuggestionDialog transaction={target} onClose={() => setTarget(null)} /> : null;
  return { propose, dialog };
}

function RuleSuggestionDialog({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const categories = useCategoryMap();
  const category = categories.get(transaction.categoryId!);
  const [pattern, setPattern] = useState(suggestPattern(transaction.label));
  const [others, setOthers] = useState<Transaction[]>([]);
  const [applyToOthers, setApplyToOthers] = useState(true);
  // Par défaut, la règle ne vaut que dans le même sens (ex. un virement reçu de toi ≠ un virement envoyé à toi)
  const incoming = transaction.amount > 0;
  const [sameDirection, setSameDirection] = useState(true);
  const direction = sameDirection ? (incoming ? 'in' : 'out') : undefined;

  useEffect(() => {
    let alive = true;
    const p = pattern.trim();
    if (p.length < 2) return setOthers([]);
    findMatching(p, transaction.categoryId!, transaction.id, direction).then((r) => alive && setOthers(r));
    return () => {
      alive = false;
    };
  }, [pattern, transaction, direction]);

  return (
    <Modal open title="Créer une règle ?" onClose={onClose}>
      <p className="mb-3 text-sm">
        Classer automatiquement dans <strong>{category?.name}</strong> les opérations dont le libellé contient :
      </p>
      <Field label="Texte recherché" hint={`Libellé d'origine : ${transaction.label}`} className="mb-3">
        <Input value={pattern} onChange={(e) => setPattern(e.target.value)} autoFocus />
      </Field>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={sameDirection} onChange={(e) => setSameDirection(e.target.checked)} />
        Seulement pour les {incoming ? 'entrées d\'argent (virements reçus…)' : 'sorties d\'argent (paiements, virements envoyés…)'}
      </label>
      {others.length > 0 && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={applyToOthers} onChange={(e) => setApplyToOthers(e.target.checked)} />
          Recatégoriser aussi les {others.length} autre(s) opération(s) correspondante(s)
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Non merci</Button>
        <Button
          variant="primary"
          disabled={pattern.trim().length < 2}
          onClick={async () => {
            await createRule(pattern, transaction.categoryId!, direction);
            if (applyToOthers && others.length) {
              await db.transactions.bulkUpdate(others.map((t) => ({ key: t.id, changes: { categoryId: transaction.categoryId } })));
            }
            onClose();
          }}
        >
          Créer la règle
        </Button>
      </div>
    </Modal>
  );
}
