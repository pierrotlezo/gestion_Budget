import { useState } from 'react';
import { db, newId } from '../../db/db';
import type { InvestmentOperation } from '../../db/schema';
import type { Position } from '../../domain/invest/portfolio';
import { todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Button, Field, Input, Modal, MoneyInput, Select } from '../../components/ui';

const LABELS: Record<InvestmentOperation['kind'], string> = { buy: 'Achat / versement', sell: 'Vente / retrait', valuation: 'Mise à jour de la valeur' };

/** Achat, vente ou valorisation d'un placement. */
export function OperationForm({ position, initialKind, onClose }: { position: Position; initialKind: InvestmentOperation['kind']; onClose: () => void }) {
  const inv = position.investment;
  const priced = inv.priceSource !== 'manual';
  const [kind, setKind] = useState(initialKind);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(kind === 'valuation' ? position.value : 0);
  const [qtyText, setQtyText] = useState('');
  const suggestedQty = priced && position.price && amount > 0 ? amount / 100 / position.price : 0;
  const quantity = qtyText.trim() ? Number(qtyText.replace(',', '.')) : suggestedQty;

  const save = async () => {
    await db.investmentOps.add({
      id: newId(),
      investmentId: inv.id,
      date,
      kind,
      amount,
      quantity: priced && kind !== 'valuation' && Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
    });
    onClose();
  };

  return (
    <Modal open title={`${inv.name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Opération">
          <Select value={kind} onChange={(e) => setKind(e.target.value as InvestmentOperation['kind'])}>
            <option value="buy">{LABELS.buy}</option>
            <option value="sell">{LABELS.sell}</option>
            {!priced && <option value="valuation">{LABELS.valuation}</option>}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={kind === 'valuation' ? 'Valeur totale actuelle' : kind === 'buy' ? 'Montant investi' : 'Montant reçu'}>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
        </div>
        {priced && kind !== 'valuation' && (
          <Field label={kind === 'buy' ? 'Quantité achetée' : 'Quantité vendue'} hint={position.price ? `Calculée avec le cours actuel (${formatEUR(Math.round(position.price * 100))}). Mets la valeur exacte de ton courtier si tu l'as.` : 'Indique la quantité indiquée par ton courtier.'}>
            <Input inputMode="decimal" value={qtyText} placeholder={suggestedQty ? suggestedQty.toLocaleString('fr-FR', { maximumFractionDigits: 8 }) : '0'} onChange={(e) => setQtyText(e.target.value)} />
          </Field>
        )}
        {kind === 'valuation' && <p className="text-xs text-slate-500">Indique la valeur affichée sur ton relevé (ex. relevé annuel d'assurance-vie). La plus-value est calculée par rapport aux versements.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={amount <= 0} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  );
}
