/**
 * Progression façon jeu : points d'expérience (XP), niveaux, série de mois, badges, paliers d'objectifs.
 * Tout est recalculé à partir des données (rien de « trichable » à stocker).
 */
import type { Cents } from './money';
import { addMonthsToKey, monthOf, type MonthKey } from './dates';

export const MILESTONES = [25, 50, 75, 100] as const;
const MILESTONE_XP: Record<number, number> = { 25: 25, 50: 50, 75: 75, 100: 200 };
export const BADGE_XP = 50;
export const TIP_XP = { trying: 20, done: 40 } as const;

export interface Level {
  level: number;
  name: string;
  icon: string;
  minXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Graine', icon: '🌱', minXp: 0 },
  { level: 2, name: 'Pousse', icon: '🌿', minXp: 100 },
  { level: 3, name: 'Bourgeon', icon: '🌷', minXp: 300 },
  { level: 4, name: 'Arbuste', icon: '🪴', minXp: 700 },
  { level: 5, name: 'Arbre', icon: '🌳', minXp: 1500 },
  { level: 6, name: 'Chêne', icon: '🌲', minXp: 3000 },
  { level: 7, name: 'Forêt', icon: '🏞️', minXp: 6000 },
  { level: 8, name: 'Légende', icon: '👑', minXp: 12000 },
];

export function levelFor(xp: number): { current: Level; next: Level | null; progress: number } {
  const current = [...LEVELS].reverse().find((l) => xp >= l.minXp)!;
  const next = LEVELS.find((l) => l.minXp > xp) ?? null;
  return { current, next, progress: next ? (xp - current.minXp) / (next.minXp - current.minXp) : 1 };
}

/** Paliers atteints (25/50/75/100 %) pour un ratio de progression. */
export const reachedMilestones = (ratio: number) => MILESTONES.filter((m) => ratio * 100 >= m);

/**
 * Série : nombre de mois consécutifs avec de l'épargne, en terminant par le mois en cours
 * (ou le mois précédent si rien n'a encore été épargné ce mois-ci).
 */
export function savingStreak(savedByMonth: Map<MonthKey, Cents>, currentMonth: MonthKey): number {
  let month = (savedByMonth.get(currentMonth) ?? 0) > 0 ? currentMonth : addMonthsToKey(currentMonth, -1);
  let streak = 0;
  while ((savedByMonth.get(month) ?? 0) > 0) {
    streak++;
    month = addMonthsToKey(month, -1);
  }
  return streak;
}

/**
 * Épargne de chaque mois : le plus grand des deux montants « virements classés en Épargne »
 * et « achats de placements + versements sur livrets » (évite de compter deux fois
 * un même virement saisi des deux côtés). Les gros versements initiaux (≥ seuil) sont ignorés.
 */
export function savedByMonth(
  savingsTransactions: { date: string; amount: Cents }[],
  contributions: { date: string; amount: Cents }[],
  bigDepositThreshold: Cents = 500000,
): Map<MonthKey, Cents> {
  const a = new Map<MonthKey, Cents>();
  const b = new Map<MonthKey, Cents>();
  for (const t of savingsTransactions) a.set(monthOf(t.date), (a.get(monthOf(t.date)) ?? 0) + Math.max(0, -t.amount));
  for (const c of contributions) if (c.amount > 0 && c.amount < bigDepositThreshold) b.set(monthOf(c.date), (b.get(monthOf(c.date)) ?? 0) + c.amount);
  const out = new Map<MonthKey, Cents>();
  for (const m of new Set([...a.keys(), ...b.keys()])) out.set(m, Math.max(a.get(m) ?? 0, b.get(m) ?? 0));
  return out;
}

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  description: string;
}

/** Catalogue des badges (données). Les conditions sont évaluées dans `unlockedBadges`. */
export const BADGES: BadgeDef[] = [
  { id: 'first_save', icon: '🪙', name: 'Premier pas', description: 'Mettre de l\'argent de côté pour la première fois' },
  { id: 'first_goal', icon: '🎯', name: 'Un cap', description: 'Créer ton premier objectif' },
  { id: 'first_investment', icon: '📈', name: 'Investisseur', description: 'Ajouter ton premier placement' },
  { id: 'crypto', icon: '₿', name: 'Crypto-curieux', description: 'Détenir un placement en crypto' },
  { id: 'pea', icon: '🇫🇷', name: 'Boursicoteur', description: 'Détenir un placement sur un PEA' },
  { id: 'diversified', icon: '🧺', name: 'Panier varié', description: 'Épargner sur 3 supports différents (livret, PEA, crypto…)' },
  { id: 'streak3', icon: '🔥', name: 'En feu', description: 'Épargner 3 mois de suite' },
  { id: 'streak6', icon: '☄️', name: 'Inarrêtable', description: 'Épargner 6 mois de suite' },
  { id: 'saved1000', icon: '💯', name: 'Mille euros', description: 'Avoir mis 1 000 € de côté au total' },
  { id: 'budget_master', icon: '🧮', name: 'Maître du budget', description: 'Finir un mois sans dépasser aucun budget' },
  { id: 'tip_hunter', icon: '💡', name: 'Chasseur d\'économies', description: 'Essayer 3 astuces d\'économie' },
  { id: 'goal_reached', icon: '🏆', name: 'Objectif atteint', description: 'Atteindre un objectif' },
];

export interface GameFacts {
  totalSaved: Cents;
  streak: number;
  goals: number;
  goalsReached: number;
  investments: number;
  envelopes: Set<string>;
  supports: number;
  budgetMonthRespected: boolean;
  tipsTried: number;
}

export function unlockedBadges(f: GameFacts): Set<string> {
  const ok = new Set<string>();
  if (f.totalSaved > 0) ok.add('first_save');
  if (f.goals > 0) ok.add('first_goal');
  if (f.investments > 0) ok.add('first_investment');
  if (f.envelopes.has('crypto')) ok.add('crypto');
  if (f.envelopes.has('pea')) ok.add('pea');
  if (f.supports >= 3) ok.add('diversified');
  if (f.streak >= 3) ok.add('streak3');
  if (f.streak >= 6) ok.add('streak6');
  if (f.totalSaved >= 100000) ok.add('saved1000');
  if (f.budgetMonthRespected) ok.add('budget_master');
  if (f.tipsTried >= 3) ok.add('tip_hunter');
  if (f.goalsReached > 0) ok.add('goal_reached');
  return ok;
}

/** XP total : 1 XP par euro épargné + paliers d'objectifs + badges + astuces. */
export function computeXp(opts: { totalSaved: Cents; milestones: number[]; badges: number; tips: { trying: number; done: number } }): number {
  return (
    Math.floor(opts.totalSaved / 100) +
    opts.milestones.reduce((s, m) => s + (MILESTONE_XP[m] ?? 0), 0) +
    opts.badges * BADGE_XP +
    opts.tips.trying * TIP_XP.trying +
    opts.tips.done * TIP_XP.done
  );
}
