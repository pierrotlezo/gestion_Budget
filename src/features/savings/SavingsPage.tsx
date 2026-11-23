import { useMemo, useState } from 'react';
import { db, newId } from '../../db/db';
import type { SavingsAccount, SavingsMovement, SavingsType, Settings } from '../../db/schema';
import { useLoans, useSavingsAccounts, useSavingsMovements, useSettings } from '../../hooks/data';
import { balanceAt, ceilingBreaches, checkDeposit, rateAt, yearInterest } from '../../domain/savings/quinzaine';
import { effectiveCeiling, effectiveRates, SAVINGS_TYPE_LABELS } from '../../domain/savings/accounts';
import { projectForAccount } from '../../domain/netWorth';
import { formatDateFR, parts, toISO, todayISO } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { Alert, Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, ProgressBar, Select, Stat, Table } from '../../components/ui';
import { RateHistoryEditor } from '../../components/RateHistoryEditor';

export function SavingsPage() {
  const accounts = useSavingsAccounts();
  const movements = useSavingsMovements();
  const settings = useSettings();
  const [editing, setEditing] = useState<SavingsAccount | 'new' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayISO();
  const total = accounts.reduce((s, a) => s + balanceAt(movements.filter((m) => m.accountId === a.id), today), 0);
  const account = accounts.find((a) => a.id === selected) ?? accounts[0];

  return (
    <div>
      <PageHeader title="Mes livrets" subtitle={`Total : ${formatEUR(total)}`} actions={<Button variant="primary" onClick={() => setEditing('new')}>+ Ajouter un compte</Button>} />

      {accounts.length === 0 ? (
        <EmptyState>Aucun compte d'épargne.</EmptyState>
      ) : (
        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} movements={movements.filter((m) => m.accountId === a.id)} settings={settings} selected={a.id === account?.id} onSelect={() => setSelected(a.id)} onEdit={() => setEditing(a)} />
          ))}
        </div>
      )}

      {account && <AccountDetail key={account.id} account={account} movements={movements.filter((m) => m.accountId === account.id)} settings={settings} />}


      {editing && <AccountForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AccountCard({ account, movements, settings, selected, onSelect, onEdit }: { account: SavingsAccount; movements: SavingsMovement[]; settings: Settings; selected: boolean; onSelect: () => void; onEdit: () => void }) {
  const today = todayISO();
  const year = parts(today).y;
  const balance = balanceAt(movements, today);
  const ceiling = effectiveCeiling(account, settings);
  const rates = effectiveRates(account, settings);
  const projection = useMemo(() => projectForAccount(account, { accounts: [account], movements, settings, today }, toISO(year + 1, 12, 31)).years, [account, movements, settings, today, year]);
  const ratio = ceiling ? balance / ceiling : 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-200 dark:border-slate-800'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{account.name}</div>
          <div className="text-xs text-slate-500">{SAVINGS_TYPE_LABELS[account.type]} · taux actuel {formatPercent(rateAt(rates, today))}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`Modifier ${account.name}`}>✏️</Button>
      </div>
      <div className="mt-2 text-2xl font-bold">{formatEUR(balance)}</div>
      {ceiling !== null && (
        <div className="mt-2">
          <ProgressBar ratio={ratio} status={ratio > 1 ? 'over' : ratio >= 0.95 ? 'warning' : 'ok'} />
          <div className="mt-0.5 text-xs text-slate-500">Plafond {formatEUR(ceiling, { round: true })} · encore {formatEUR(Math.max(0, ceiling - balance))} versables</div>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-1 text-xs">
        <dt className="text-slate-500">Intérêts estimés {year}</dt>
        <dd className="text-right font-medium">{formatEUR(projection[0]?.interest ?? 0)}</dd>
        <dt className="text-slate-500">Intérêts estimés {year + 1}</dt>
        <dd className="text-right font-medium">{formatEUR(projection[1]?.interest ?? 0)}</dd>
      </dl>
      {settings.transferAccountId === account.id && settings.monthlyTransfer > 0 && (
        <p className="mt-2 text-xs text-slate-500">Inclut les retraits prévus de {formatEUR(settings.monthlyTransfer)} le {settings.transferDay === 1 ? '1er' : settings.transferDay} de chaque mois.</p>
      )}
    </div>
  );
}

function AccountDetail({ account, movements, settings }: { account: SavingsAccount; movements: SavingsMovement[]; settings: Settings }) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<'deposit' | 'withdrawal' | 'interest'>('deposit');
  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState('');
  const ceiling = effectiveCeiling(account, settings);
  const rates = effectiveRates(account, settings);
  const sorted = [...movements].sort((a, b) => b.date.localeCompare(a.date));
  const balanceAtDate = balanceAt(movements, date);
  const check = direction === 'deposit' ? checkDeposit(balanceAtDate, amount, ceiling) : null;
  const breaches = ceilingBreaches(movements, ceiling);
  const year = parts(today).y;
  const lastYear = year - 1;
  const lastYearInterest = yearInterest(movements, rates, lastYear).interest;
  const lastYearCredited = movements.some((m) => m.kind === 'interest' && m.date.startsWith(String(lastYear)));
  const projection = useMemo(() => projectForAccount(account, { accounts: [account], movements, settings, today }, toISO(year, 12, 31)), [account, movements, settings, today, year]);
  const detail = useMemo(() => yearInterest(projection.movements, rates, year), [projection, rates, year]);

  const add = async () => {
    if (amount <= 0) return;
    await db.savingsMovements.add({
      id: newId(),
      accountId: account.id,
      date,
      amount: direction === 'withdrawal' ? -amount : amount,
      label: label.trim() || (direction === 'deposit' ? 'Versement' : direction === 'withdrawal' ? 'Retrait' : 'Intérêts'),
      kind: direction,
    });
    setAmount(0);
    setLabel('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Mouvements · ${account.name}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
              <option value="deposit">Versement</option>
              <option value="withdrawal">Retrait</option>
              <option value="interest">Intérêts crédités</option>
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
          <Field label="Montant"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Libellé (facultatif)"><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        </div>
        {check?.exceeds && (
          <div className="mt-3">
            <Alert tone="danger">⛔ Ce versement dépasse le plafond de {formatEUR(ceiling!)} de {formatEUR(check.excess)}. Versement maximal possible : {formatEUR(check.maxDeposit)}.</Alert>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={add} disabled={amount <= 0}>Ajouter</Button>
          {!lastYearCredited && lastYearInterest > 0 && (
            <Button
              onClick={() => db.savingsMovements.add({ id: newId(), accountId: account.id, date: toISO(lastYear, 12, 31), amount: lastYearInterest, label: `Intérêts ${lastYear} (estimés)`, kind: 'interest' })}
            >
              + Créditer les intérêts {lastYear} ({formatEUR(lastYearInterest)})
            </Button>
          )}
        </div>
        {breaches.length > 0 && (
          <div className="mt-3">
            <Alert tone="warning">⚠️ {breaches.length} versement(s) ont fait dépasser le plafond : {breaches.map((b) => formatDateFR(b.date)).join(', ')}.</Alert>
          </div>
        )}
        <div className="mt-4 max-h-80 overflow-y-auto">
          {sorted.length === 0 ? (
            <EmptyState>Aucun mouvement. Ajoute le solde de départ comme un versement (avec sa date).</EmptyState>
          ) : (
            <Table>
              <thead><tr><th>Date</th><th>Libellé</th><th className="text-right!">Montant</th><th></th></tr></thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">{formatDateFR(m.date)}</td>
                    <td>{m.label}</td>
                    <td className={`whitespace-nowrap text-right font-medium ${m.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatEUR(m.amount, { sign: true })}</td>
                    <td className="text-right"><Button variant="ghost" size="sm" onClick={() => db.savingsMovements.delete(m.id)} aria-label="Supprimer">🗑️</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card title={`Intérêts ${year} par quinzaine`}>
        <p className="mb-2 text-sm text-slate-500">
          Un versement rapporte à partir de la quinzaine suivante ; un retrait cesse de rapporter dès le début de sa quinzaine. Les retraits mensuels prévus sont inclus.
        </p>
        <Stat label={`Total estimé ${year}`} value={formatEUR(detail.interest)} hint="Crédité le 31 décembre" />
        <div className="mt-3 max-h-80 overflow-y-auto">
          <Table>
            <thead><tr><th>Quinzaine</th><th className="text-right!">Solde productif</th><th className="text-right!">Taux</th><th className="text-right!">Intérêts</th></tr></thead>
            <tbody>
              {detail.quinzaines.map((q) => (
                <tr key={q.index} className={q.start > today ? 'text-slate-400' : ''}>
                  <td>{formatDateFR(q.start)}</td>
                  <td className="text-right">{formatEUR(q.balance)}</td>
                  <td className="text-right">{formatPercent(q.rate)}</td>
                  <td className="text-right">{formatEUR(Math.round(q.interest))}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function AccountForm({ initial, onClose }: { initial?: SavingsAccount; onClose: () => void }) {
  const loans = useLoans();
  const settings = useSettings();
  const [a, setA] = useState<SavingsAccount>(initial ?? { id: newId(), name: '', type: 'other', rates: [{ from: todayISO(), rate: 0.02 }], ceiling: null });
  const set = <K extends keyof SavingsAccount>(k: K, v: SavingsAccount[K]) => setA((x) => ({ ...x, [k]: v }));
  const onType = (type: SavingsType) => {
    setA((x) => ({
      ...x,
      type,
      name: x.name || SAVINGS_TYPE_LABELS[type],
      // Livret A et LDDS suivent le taux du Livret A ; LDDS plafonné à 12 000 €
      rates: type === 'livretA' || type === 'ldds' ? null : (x.rates ?? [{ from: todayISO(), rate: rateAt(settings.livretARates, todayISO()) }]),
      ceiling: type === 'ldds' ? 1200000 : type === 'lep' ? 1000000 : x.ceiling,
    }));
  };

  return (
    <Modal open title={initial ? `Modifier « ${initial.name} »` : 'Nouveau compte d\'épargne'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={a.type} onChange={(e) => onType(e.target.value as SavingsType)}>
              {Object.entries(SAVINGS_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Nom"><Input value={a.name} onChange={(e) => set('name', e.target.value)} /></Field>
        </div>
        {a.type === 'livretA' ? (
          <p className="text-sm text-slate-500">Taux et plafond : ceux du Livret A dans les Paramètres ({formatEUR(settings.livretACeiling, { round: true })}).</p>
        ) : (
          <>
            <Field label="Plafond" hint="0 = pas de plafond">
              <MoneyInput value={a.ceiling ?? 0} onChange={(v) => set('ceiling', v > 0 ? v : null)} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={a.rates === null} onChange={(e) => set('rates', e.target.checked ? null : [{ from: todayISO(), rate: rateAt(settings.livretARates, todayISO()) }])} />
              Suit le taux du Livret A
            </label>
            {a.rates && (
              <div>
                <div className="mb-1 text-sm font-medium">Historique des taux</div>
                <RateHistoryEditor value={a.rates} onChange={(v) => set('rates', v)} />
              </div>
            )}
          </>
        )}
        <Field label="Alimenté par un prêt ?" hint="Pour comparer le coût du prêt aux intérêts gagnés.">
          <Select value={a.fundedByLoanId ?? ''} onChange={(e) => set('fundedByLoanId', e.target.value || undefined)}>
            <option value="">Non</option>
            {loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-between gap-2 pt-2">
          {initial ? (
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(`Supprimer « ${initial.name} » et tous ses mouvements ?`)) return;
                await db.transaction('rw', db.savingsAccounts, db.savingsMovements, async () => {
                  await db.savingsMovements.where('accountId').equals(initial.id).delete();
                  await db.savingsAccounts.delete(initial.id);
                });
                onClose();
              }}
            >
              Supprimer
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button variant="primary" disabled={!a.name.trim()} onClick={async () => { await db.savingsAccounts.put({ ...a, name: a.name.trim() }); onClose(); }}>Enregistrer</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
