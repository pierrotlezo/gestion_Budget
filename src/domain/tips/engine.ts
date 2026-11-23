/**
 * Choix des astuces d'économie du mois, à partir de tes dépenses.
 * Le catalogue des astuces est une DONNÉE (src/db/tipsCatalog.ts) : on peut en ajouter sans toucher à ce code.
 */
import type { TipState } from '../../db/schema';
import type { Cents } from '../money';
import type { Subscription } from './subscriptions';

export type TipCondition =
  | { type: 'always' }
  /** La catégorie dépasse un montant mensuel moyen. */
  | { type: 'categoryAbove'; categoryId: string; minMonthly: Cents }
  /** Au moins `min` abonnements détectés. */
  | { type: 'subscriptions'; min: number }
  /** Un libellé de dépense récente contient ce texte. */
  | { type: 'labelMatch'; pattern: string };

export interface TipDef {
  id: string;
  icon: string;
  title: string;
  /** Texte ; {moyenne} = dépense mensuelle moyenne de la catégorie, {economie} = économie estimée. */
  text: string;
  categoryId?: string;
  when: TipCondition;
  /** Économie estimée : part de la dépense moyenne de la catégorie, ou montant fixe par mois. */
  savingRatio?: number;
  savingFixed?: Cents;
  link?: { label: string; url: string };
}

export interface TipContext {
  /** Dépense mensuelle moyenne par catégorie (centimes). */
  avgByCategory: Map<string, Cents>;
  overBudget: Set<string>;
  subscriptions: Subscription[];
  /** Libellés normalisés des dépenses récentes. */
  labels: string[];
  states: Map<string, TipState>;
}

export interface SuggestedTip {
  tip: TipDef;
  /** Économie mensuelle estimée. */
  saving: Cents;
  categoryAvg: Cents;
  status?: TipState['status'];
}

function applies(c: TipCondition, ctx: TipContext): boolean {
  switch (c.type) {
    case 'always':
      return true;
    case 'categoryAbove':
      return (ctx.avgByCategory.get(c.categoryId) ?? 0) >= c.minMonthly;
    case 'subscriptions':
      return ctx.subscriptions.length >= c.min;
    case 'labelMatch':
      return ctx.labels.some((l) => l.includes(c.pattern.toUpperCase()));
  }
}

export function evaluateTips(defs: TipDef[], ctx: TipContext): SuggestedTip[] {
  return defs
    .filter((t) => applies(t.when, ctx))
    .map((tip) => {
      const categoryAvg = tip.categoryId ? (ctx.avgByCategory.get(tip.categoryId) ?? 0) : 0;
      const subsTotal = tip.when.type === 'subscriptions' ? ctx.subscriptions.reduce((s, x) => s + x.amount, 0) : 0;
      const base = tip.when.type === 'subscriptions' ? subsTotal : categoryAvg;
      const saving = tip.savingFixed ?? Math.round(base * (tip.savingRatio ?? 0));
      return { tip, saving, categoryAvg: base, status: ctx.states.get(tip.id)?.status };
    });
}

/**
 * Les astuces du mois : les plus rentables d'abord (bonus si la catégorie dépasse son budget),
 * sans celles écartées ou déjà adoptées, avec une rotation pour en proposer de nouvelles chaque mois.
 */
export function tipsOfTheMonth(all: SuggestedTip[], ctx: TipContext, monthIndex: number, count = 3): SuggestedTip[] {
  const candidates = all
    // Les astuces en cours, adoptées ou écartées ne sont plus proposées
    .filter((s) => !s.status)
    .map((s) => ({ s, score: s.saving + (s.tip.categoryId && ctx.overBudget.has(s.tip.categoryId) ? 5000 : 0) }))
    .sort((a, b) => b.score - a.score || a.s.tip.id.localeCompare(b.s.tip.id))
    .slice(0, Math.max(count * 3, count))
    .map((x) => x.s);
  if (candidates.length <= count) return candidates;
  const start = (monthIndex * count) % candidates.length;
  return Array.from({ length: count }, (_, i) => candidates[(start + i) % candidates.length]);
}

/** Remplace {moyenne} et {economie} dans le texte d'une astuce. */
export function fillTip(text: string, s: SuggestedTip, format: (c: Cents) => string): string {
  return text.replace('{moyenne}', format(s.categoryAvg)).replace('{economie}', format(s.saving));
}
