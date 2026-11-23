import { useEffect, useMemo, useState } from 'react';
import { db, newId } from '../../db/db';
import type { SavingsGoal } from '../../db/schema';
import { useCategories, useTransactions, useWealth } from '../../hooks/data';
import { useGameProgress } from '../../hooks/insights';
import { BADGES, LEVELS, MILESTONES } from '../../domain/gamification';
import type { GoalProgress } from '../../domain/invest/goals';
import { averagePotential } from '../../domain/budget/capacity';
import { ENVELOPE_ICONS } from '../../domain/invest/portfolio';
import { currentMonth, formatDateFR } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { Button, Field, Input, Modal, MoneyInput, PercentInput } from '../../components/ui';
import { Confetti } from '../../components/Confetti';
import { SaveDialog } from '../home/SaveDialog';

const ICONS = ['🛟', '₿', '📈', '✈️', '🏠', '🚗', '🎓', '💻', '🎁', '🌴'];
const LEVEL_KEY = 'gestion-budget.level';

export function GoalsPage() {
  const game = useGameProgress();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);

  // Célébrer les nouveaux paliers atteints (une seule fois) et les passages de niveau
  useEffect(() => {
    const fresh = game.goalStates.filter((g) => g.milestones.some((m) => !(g.goal.milestonesCelebrated ?? []).includes(m)));
    const prevLevel = Number(localStorage.getItem(LEVEL_KEY) ?? 0);
    let msg: string | null = null;
    if (fresh.length) {
      const top = fresh.map((g) => ({ g, m: Math.max(...g.milestones) })).sort((a, b) => b.m - a.m)[0];
      msg = top.m === 100 ? `${top.g.goal.icon} « ${top.g.goal.name} » est atteint !` : `${top.g.goal.icon} Palier ${top.m} % atteint pour « ${top.g.goal.name} » !`;
      fresh.forEach((g) => db.goals.update(g.goal.id, { milestonesCelebrated: g.milestones }));
    }
    if (prevLevel && game.level.current.level > prevLevel) msg = `${game.level.current.icon} Niveau ${game.level.current.level} : ${game.level.current.name} !`;
    if (game.level.current.level !== prevLevel) localStorage.setItem(LEVEL_KEY, String(game.level.current.level));
    if (msg) setCelebration(msg);
  }, [game]);

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 4500);
    return () => clearTimeout(t);
  }, [celebration]);

  const { current, next, progress } = game.level;

  return (
    <div className="space-y-8">
      {/* Carte joueur */}
      <section className="rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-6 text-white shadow-lg md:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-5xl" aria-hidden>{current.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-indigo-100">Niveau {current.level}</div>
            <div className="text-3xl font-bold">{current.name}</div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-xs text-indigo-100">{game.xp} XP{next ? ` · encore ${next.minXp - game.xp} XP pour ${next.icon} ${next.name}` : ' · niveau maximum !'}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-3xl">{game.streak > 0 ? '🔥' : '🧊'}</div>
              <div className="text-lg font-bold">{game.streak} mois</div>
              <div className="text-xs text-indigo-100">de suite</div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3">
              <div className="text-3xl">🏅</div>
              <div className="text-lg font-bold">{game.badges.size}/{BADGES.length}</div>
              <div className="text-xs text-indigo-100">badges</div>
            </div>
          </div>
        </div>
        {/* Mission du mois */}
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/15 px-4 py-3">
          <span className="text-2xl" aria-hidden>{game.savedThisMonth > 0 ? '✅' : '🎯'}</span>
          <span className="flex-1 text-sm">
            {game.savedThisMonth > 0
              ? <>Mission du mois réussie : <strong>{formatEUR(game.savedThisMonth)}</strong> mis de côté. Ta série continue !</>
              : <>Mission du mois : mets de l'argent de côté avant la fin du mois pour {game.streak > 0 ? 'garder ta série 🔥' : 'lancer ta série 🔥'} (+1 XP par euro).</>}
          </span>
          {game.savedThisMonth === 0 && <button type="button" onClick={() => setSaving(true)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">💰 J'épargne</button>}
        </div>
      </section>

      {/* Objectifs */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">🎯 Mes objectifs</h2>
          <Button variant="primary" onClick={() => setEditing('new')}>+ Nouvel objectif</Button>
        </div>
        {game.goalStates.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <div className="mb-2 text-4xl">🗺️</div>
            <p className="text-sm text-slate-500">Choisis ta première quête : une épargne de précaution, 1 000 € en bitcoin, un voyage…</p>
            <Button variant="primary" className="mt-4" onClick={() => setEditing('new')}>Commencer une quête</Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {game.goalStates.map(({ goal, progress: p }) => <GoalQuest key={goal.id} goal={goal} p={p} onEdit={() => setEditing(goal)} />)}
          </div>
        )}
      </section>

      {/* Badges */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">🏅 Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BADGES.map((b) => {
            const ok = game.badges.has(b.id);
            return (
              <div key={b.id} className={`rounded-2xl border p-4 text-center ${ok ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900'}`}>
                <div className={`text-3xl ${ok ? '' : 'grayscale'}`} aria-hidden>{ok ? b.icon : '🔒'}</div>
                <div className="mt-1 text-sm font-semibold">{b.name}</div>
                <div className="text-xs text-slate-500">{b.description}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          XP : 1 par euro mis de côté · paliers d'objectifs 25 / 50 / 75 / 200 · 50 par badge · 20 par astuce essayée, 40 par astuce adoptée. Niveaux : {LEVELS.map((l) => `${l.icon} ${l.name}`).join(' → ')}.
        </p>
      </section>

      {celebration && (
        <>
          <Confetti />
          <div role="status" className="pop-in fixed inset-x-0 top-6 z-[80] mx-auto w-fit max-w-[90vw] rounded-2xl bg-slate-900 px-6 py-4 text-center text-white shadow-2xl dark:bg-white dark:text-slate-900">
            <div className="text-lg font-bold">🎉 Bravo !</div>
            <div className="text-sm">{celebration}</div>
          </div>
        </>
      )}
      {editing && <GoalForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {saving && <SaveDialog onClose={() => setSaving(false)} />}
    </div>
  );
}

/** Un objectif présenté comme une quête : chemin avec 4 paliers. */
function GoalQuest({ goal, p, onEdit }: { goal: SavingsGoal; p: GoalProgress; onEdit: () => void }) {
  const pct = Math.min(100, p.ratio * 100);
  const nextMilestone = MILESTONES.find((m) => pct < m);
  const toNext = nextMilestone ? Math.max(0, Math.round((goal.target * nextMilestone) / 100) - p.current) : 0;
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${p.reached ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl dark:bg-indigo-950" aria-hidden>{goal.icon}</span>
          <div>
            <div className="font-semibold">{goal.name}</div>
            <div className="text-sm"><strong>{formatEUR(p.current, { round: true })}</strong> <span className="text-slate-500">/ {formatEUR(p.target, { round: true })}</span></div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Modifier ${goal.name}`}>✏️</Button>
      </div>

      {/* Chemin de la quête */}
      <div className="relative mt-8 mb-10 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${pct}%` }} />
        {MILESTONES.map((m) => {
          const ok = pct >= m;
          return (
            <div key={m} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${m}%` }}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs ${ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-900'}`}>{m === 100 ? '🏆' : ok ? '✓' : ''}</div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500">{m} %</div>
            </div>
          );
        })}
        <div className="absolute -top-7 -translate-x-1/2 text-xl transition-all" style={{ left: `${Math.max(3, Math.min(97, pct))}%` }} aria-hidden>{goal.icon}</div>
      </div>

      <div className="text-sm">
        {p.reached ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">🏆 Quête terminée ! +200 XP</span>
        ) : (
          <>
            <div>Prochain palier <strong>{nextMilestone} %</strong> : encore <strong>{formatEUR(toNext, { round: true })}</strong> <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">+{nextMilestone === 100 ? 200 : nextMilestone} XP</span></div>
            <div className="mt-1 text-slate-500">
              {p.estimatedDate ? `À ${formatEUR(goal.monthlyContribution, { round: true })}/mois, arrivée vers ${new Date(p.estimatedDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}` : 'Ajoute un versement mensuel pour estimer l\'arrivée.'}
              {goal.deadline && ` · échéance ${formatDateFR(goal.deadline)}`}
            </div>
            {p.onTrack === false && p.requiredMonthly !== null && <div className="mt-1 text-orange-600 dark:text-orange-400">⚠️ Pour l'échéance : {formatEUR(p.requiredMonthly, { round: true })}/mois</div>}
          </>
        )}
      </div>
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
  const toggle = (kind: 'investment' | 'savings', id: string) => set('sources', has(kind, id) ? g.sources.filter((s) => !(s.kind === kind && s.id === id)) : [...g.sources, { kind, id }]);
  const chip = (on: boolean) => `flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${on ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`;

  return (
    <Modal open title={initial ? 'Modifier la quête' : 'Nouvelle quête'} onClose={onClose}>
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
          <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Ce qui compte pour cette quête</div>
          <div className="flex flex-wrap gap-2">
            {wealth.positions.map((p) => (
              <label key={p.investment.id} className={chip(has('investment', p.investment.id))}>
                <input type="checkbox" className="sr-only" checked={has('investment', p.investment.id)} onChange={() => toggle('investment', p.investment.id)} />
                {ENVELOPE_ICONS[p.investment.envelope]} {p.investment.name}
              </label>
            ))}
            {wealth.savingsByAccount.map(({ account }) => (
              <label key={account.id} className={chip(has('savings', account.id))}>
                <input type="checkbox" className="sr-only" checked={has('savings', account.id)} onChange={() => toggle('savings', account.id)} />
                🐷 {account.name}
              </label>
            ))}
          </div>
          {g.sources.length === 0 && <Field label="Déjà mis de côté" className="mt-3"><MoneyInput value={g.manualAmount} onChange={(v) => set('manualAmount', v)} /></Field>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Je verse chaque mois" hint={avg.months ? `Ton potentiel moyen : ${formatEUR(avg.average, { round: true })}/mois` : undefined}><MoneyInput value={g.monthlyContribution} onChange={(v) => set('monthlyContribution', v)} /></Field>
          <Field label="Rendement annuel supposé" hint="0 % pour un livret"><PercentInput value={g.annualReturn} onChange={(v) => set('annualReturn', v)} /></Field>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {initial ? <Button variant="danger" onClick={async () => { if (confirm(`Supprimer « ${initial.name} » ?`)) { await db.goals.delete(initial.id); onClose(); } }}>Supprimer</Button> : <span />}
          <div className="flex gap-2">
            <Button onClick={onClose}>Annuler</Button>
            <Button variant="primary" disabled={!g.name.trim() || g.target <= 0} onClick={async () => { await db.goals.put({ ...g, name: g.name.trim() }); onClose(); }}>Enregistrer</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
