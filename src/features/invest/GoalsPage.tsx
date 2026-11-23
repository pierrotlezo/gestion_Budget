import { useMemo, useState } from 'react';
import { db, newId } from '../../db/db';
import type { SavingsGoal } from '../../db/schema';
import { goalCurrentAmount, useCategories, useGoals, useTransactions, useWealth } from '../../hooks/data';
import { goalProgress } from '../../domain/invest/goals';
import { averagePotential } from '../../domain/budget/capacity';
import { ENVELOPE_ICONS } from '../../domain/invest/portfolio';
import { currentMonth, formatDateFR, todayISO } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Button, Card, EmptyState, Field, Input, Modal, MoneyInput, PageHeader, PercentInput, ProgressBar } from '../../components/ui';

const ICONS = ['🛟', '₿', '📈', '✈️', '🏠', '🚗', '🎓', '💻', '🎁', '🌴'];

export function GoalsPage() {
  const goals = useGoals();
  const wealth = useWealth();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const today = todayISO();

  return (
    <div className="space-y-6">
      <PageHeader title="Mes objectifs" subtitle="Donne un but à ton épargne et suis ta progression." actions={<Button variant="primary" onClick={() => setEditing('new')}>+ Nouvel objectif</Button>} />
      {goals.length === 0 ? (
        <EmptyState>
          <div className="mb-3 text-4xl">🎯</div>
          Par exemple : une épargne de précaution de 3 000 €, 1 000 € en bitcoin, un voyage…
          <div className="mt-4"><Button variant="primary" onClick={() => setEditing('new')}>Créer mon premier objectif</Button></div>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const p = goalProgress(g, goalCurrentAmount(g, wealth), today);
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl dark:bg-indigo-950" aria-hidden>{g.icon}</span>
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-slate-500">{g.deadline ? `Pour le ${formatDateFR(g.deadline)}` : 'Sans échéance'}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(g)} aria-label={`Modifier ${g.name}`}>✏️</Button>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <span className="text-2xl font-bold">{formatEUR(p.current, { round: true })}</span>
                  <span className="text-sm text-slate-500">sur {formatEUR(p.target, { round: true })}</span>
                </div>
                <div className="mt-2"><ProgressBar ratio={p.ratio} status="ok" /></div>
                <div className="mt-3 text-sm">
                  {p.reached ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">🎉 Objectif atteint, bravo !</span>
                  ) : (
                    <>
                      <div>Encore <strong>{formatEUR(p.remaining, { round: true })}</strong> · {Math.floor(p.ratio * 100)} %</div>
                      <div className="text-slate-500">
                        {p.estimatedDate ? `Avec ${formatEUR(g.monthlyContribution, { round: true })}/mois : atteint vers ${new Date(p.estimatedDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Ajoute un versement mensuel pour estimer la date.'}
                      </div>
                      {p.onTrack === false && p.requiredMonthly !== null && (
                        <div className="mt-1 text-orange-600 dark:text-orange-400">⚠️ Pour tenir l'échéance : {formatEUR(p.requiredMonthly, { round: true })}/mois</div>
                      )}
                      {p.onTrack === true && <div className="mt-1 text-emerald-600 dark:text-emerald-400">✅ En bonne voie pour l'échéance</div>}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <GoalForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GoalForm({ initial, onClose }: { initial?: SavingsGoal; onClose: () => void }) {
  const wealth = useWealth();
  const transactions = useTransactions() ?? [];
  const categories = useCategories();
  const avg = useMemo(() => averagePotential(transactions, categories, currentMonth(), 3), [transactions, categories]);
  const [g, setG] = useState<SavingsGoal>(
    initial ?? { id: newId(), name: '', icon: '🛟', target: 300000, sources: [], manualAmount: 0, monthlyContribution: Math.max(0, Math.round(avg.average / 2 / 1000) * 1000) || 5000, annualReturn: 0 },
  );
  const set = <K extends keyof SavingsGoal>(k: K, v: SavingsGoal[K]) => setG((x) => ({ ...x, [k]: v }));
  const has = (kind: 'investment' | 'savings', id: string) => g.sources.some((s) => s.kind === kind && s.id === id);
  const toggle = (kind: 'investment' | 'savings', id: string) =>
    set('sources', has(kind, id) ? g.sources.filter((s) => !(s.kind === kind && s.id === id)) : [...g.sources, { kind, id }]);

  return (
    <Modal open title={initial ? 'Modifier l\'objectif' : 'Nouvel objectif'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button key={i} type="button" onClick={() => set('icon', i)} className={`h-10 w-10 rounded-xl text-xl ${g.icon === i ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-950' : 'bg-slate-100 dark:bg-slate-800'}`} aria-label={`Icône ${i}`}>{i}</button>
          ))}
        </div>
        <Field label="Nom"><Input value={g.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Épargne de précaution" autoFocus={!initial} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Montant visé"><MoneyInput value={g.target} onChange={(v) => set('target', v)} /></Field>
          <Field label="Échéance (facultatif)"><Input type="date" value={g.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || undefined)} /></Field>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ce qui compte pour cet objectif</div>
          {wealth.positions.length + wealth.savingsByAccount.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun placement ni livret : indique le montant déjà mis de côté ci-dessous.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {wealth.positions.map((p) => (
                <label key={p.investment.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${has('investment', p.investment.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="checkbox" className="sr-only" checked={has('investment', p.investment.id)} onChange={() => toggle('investment', p.investment.id)} />
                  {ENVELOPE_ICONS[p.investment.envelope]} {p.investment.name}
                </label>
              ))}
              {wealth.savingsByAccount.map(({ account }) => (
                <label key={account.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${has('savings', account.id) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="checkbox" className="sr-only" checked={has('savings', account.id)} onChange={() => toggle('savings', account.id)} />
                  🐷 {account.name}
                </label>
              ))}
            </div>
          )}
          {g.sources.length === 0 && (
            <Field label="Déjà mis de côté" className="mt-3"><MoneyInput value={g.manualAmount} onChange={(v) => set('manualAmount', v)} /></Field>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Je verse chaque mois" hint={avg.months ? `Ton potentiel moyen : ${formatEUR(avg.average, { round: true })}/mois` : undefined}>
            <MoneyInput value={g.monthlyContribution} onChange={(v) => set('monthlyContribution', v)} />
          </Field>
          <Field label="Rendement annuel supposé" hint="0 % pour un livret, à ajuster pour un placement">
            <PercentInput value={g.annualReturn} onChange={(v) => set('annualReturn', v)} />
          </Field>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {initial ? <Button variant="danger" onClick={async () => { if (confirm(`Supprimer l'objectif « ${initial.name} » ?`)) { await db.goals.delete(initial.id); onClose(); } }}>Supprimer</Button> : <span />}
          <div className="flex gap-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button variant="primary" disabled={!g.name.trim() || g.target <= 0} onClick={async () => { await db.goals.put({ ...g, name: g.name.trim() }); onClose(); }}>Enregistrer</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
