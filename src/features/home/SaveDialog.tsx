import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, newId } from '../../db/db';
import { useSavingsAccounts, useSettings, usePositions, useWealth } from '../../hooks/data';
import { checkDeposit } from '../../domain/savings/quinzaine';
import { effectiveCeiling } from '../../domain/savings/accounts';
import { ENVELOPE_ICONS } from '../../domain/invest/portfolio';
import { todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Alert, Button, Field, Input, Modal, MoneyInput, Select } from '../../components/ui';

/**
 * « J'épargne » : enregistre un versement vers un placement (achat) ou un livret (versement),
 * en une seule étape depuis l'accueil.
 */
export function SaveDialog({ onClose, suggested = 0 }: { onClose: () => void; suggested?: number }) {
  const positions = usePositions();
  const accounts = useSavingsAccounts();
  const settings = useSettings();
  const wealth = useWealth();
  const [chosen, setChosen] = useState('');
  // Destination par défaut calculée à chaque rendu : les données arrivent après l'ouverture du dialogue
  const target = chosen || (positions[0] ? `inv:${positions[0].investment.id}` : accounts[0] ? `acc:${accounts[0].id}` : '');
  const [amount, setAmount] = useState(Math.max(0, suggested));
  const [date, setDate] = useState(todayISO());
  const [quantityText, setQuantityText] = useState('');
  const [alsoExpense, setAlsoExpense] = useState(false);
  const [done, setDone] = useState('');

  const [kind, id] = target.split(':');
  const position = kind === 'inv' ? positions.find((p) => p.investment.id === id) : undefined;
  const account = kind === 'acc' ? accounts.find((a) => a.id === id) : undefined;
  const priced = position && position.investment.priceSource !== 'manual' && position.price;
  const suggestedQty = priced ? amount / 100 / position.price! : 0;
  const quantity = quantityText.trim() ? Number(quantityText.replace(',', '.')) : suggestedQty;
  const ceiling = account ? effectiveCeiling(account, settings) : null;
  const balance = account ? (wealth.savingsByAccount.find((a) => a.account.id === account.id)?.balance ?? 0) : 0;
  const check = account ? checkDeposit(balance, amount, ceiling) : null;
  const name = position?.investment.name ?? account?.name ?? '';

  const options = useMemo(() => ({ positions, accounts }), [positions, accounts]);

  if (!positions.length && !accounts.length) {
    return (
      <Modal open title="J'épargne" onClose={onClose}>
        <p className="text-sm">Ajoute d'abord un placement ou un livret.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/epargne/placements" onClick={onClose}><Button variant="primary">Ajouter un placement</Button></Link>
        </div>
      </Modal>
    );
  }

  const save = async () => {
    if (amount <= 0 || !target) return;
    await db.transaction('rw', [db.investmentOps, db.savingsMovements, db.transactions], async () => {
      if (position) {
        await db.investmentOps.add({ id: newId(), investmentId: position.investment.id, date, kind: 'buy', amount, quantity: position.investment.priceSource !== 'manual' && Number.isFinite(quantity) && quantity > 0 ? quantity : undefined });
      } else if (account) {
        await db.savingsMovements.add({ id: newId(), accountId: account.id, date, amount, label: 'Versement', kind: 'deposit' });
      }
      if (alsoExpense) {
        await db.transactions.add({ id: newId(), date, amount: -amount, label: `Épargne → ${name}`, categoryId: 'cat-epargne', source: 'manual' });
      }
    });
    setDone(`${formatEUR(amount)} mis de côté sur ${name}. Bravo ! 🎉`);
  };

  return (
    <Modal open title="💰 J'épargne" onClose={onClose}>
      {done ? (
        <>
          <Alert tone="success">{done}</Alert>
          <div className="mt-4 flex justify-end"><Button variant="primary" onClick={onClose}>Fermer</Button></div>
        </>
      ) : (
        <div className="space-y-3">
          <Field label="Où ?">
            <Select value={target} onChange={(e) => { setChosen(e.target.value); setQuantityText(''); }}>
              {options.positions.length > 0 && (
                <optgroup label="Placements">
                  {options.positions.map((p) => <option key={p.investment.id} value={`inv:${p.investment.id}`}>{ENVELOPE_ICONS[p.investment.envelope]} {p.investment.name}</option>)}
                </optgroup>
              )}
              {options.accounts.length > 0 && (
                <optgroup label="Livrets">
                  {options.accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>🐷 {a.name}</option>)}
                </optgroup>
              )}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Montant"><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          </div>
          {position && position.investment.priceSource !== 'manual' && (
            <Field label="Quantité achetée" hint={priced ? `Calculée avec le cours actuel (${formatEUR(Math.round(position.price! * 100))}). Corrige-la avec la valeur exacte de ton courtier.` : 'Cours inconnu : indique la quantité reçue.'}>
              <Input inputMode="decimal" value={quantityText} placeholder={suggestedQty ? suggestedQty.toLocaleString('fr-FR', { maximumFractionDigits: 8 }) : '0'} onChange={(e) => setQuantityText(e.target.value)} />
            </Field>
          )}
          {check?.exceeds && <Alert tone="danger">⛔ Dépasse le plafond de {formatEUR(ceiling!)}. Maximum possible : {formatEUR(check.maxDeposit)}.</Alert>}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={alsoExpense} onChange={(e) => setAlsoExpense(e.target.checked)} />
            <span>
              Ajouter aussi la sortie d'argent dans mes dépenses (catégorie Épargne)
              <span className="block text-xs text-slate-500">Inutile si tu importes ton relevé bancaire : le virement y apparaîtra.</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button variant="primary" onClick={save} disabled={amount <= 0 || !!check?.exceeds}>Enregistrer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
