/**
 * Quelles notifications envoyer maintenant ? Fonction pure, utilisée par le serveur maison
 * (envoi sur le téléphone) et par l'interface (centre de notifications).
 * Chaque notification a une clé unique : elle n'est envoyée qu'une fois.
 */
import { formatEUR } from './money';
import { daysInMonth, monthOf, toISO, type MonthKey } from './dates';
import { summarizeMonth } from './budget/totals';
import { savingsCapacity } from './budget/capacity';
import type { AppData, GameProgress, Insights } from './progress';
import type { LocalDeal } from './tips/localDeals';

export type NotificationKind = 'budget' | 'game' | 'weekly' | 'deals';

export interface AppNotification {
  key: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Page à ouvrir au clic. */
  url: string;
}

export interface NotifyInput {
  data: AppData;
  insights: Insights;
  game: GameProgress;
  deals: LocalDeal[];
  now: Date;
  city: string;
  enabled: Record<NotificationKind, boolean>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (d: Date) => toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

export function computeNotifications({ data, insights, game, deals, now, city, enabled }: NotifyInput): AppNotification[] {
  const out: AppNotification[] = [];
  const today = localISO(now);
  const month: MonthKey = monthOf(today);
  const hour = now.getHours();

  if (enabled.budget) {
    const summary = summarizeMonth(data.transactions, data.categories, month);
    for (const c of summary.byCategory) {
      if (c.budget <= 0 || c.category.kind !== 'expense') continue;
      if (c.status === 'over') {
        out.push({ key: `budget-over:${c.category.id}:${month}`, kind: 'budget', title: `⛔ Budget ${c.category.name} dépassé`, body: `${formatEUR(c.amount)} dépensés pour ${formatEUR(c.budget)} prévus (+${formatEUR(c.amount - c.budget)}).`, url: `/depenses/categorie/${c.category.id}` });
      } else if (c.status === 'warning') {
        out.push({ key: `budget-warn:${c.category.id}:${month}`, kind: 'budget', title: `⚠️ ${c.category.name} : ${Math.floor(c.ratio * 100)} % du budget`, body: `Il te reste ${formatEUR(c.budget - c.amount)} jusqu'à la fin du mois.`, url: `/depenses/categorie/${c.category.id}` });
      }
    }
    for (const s of insights.recurring) {
      if (!s.increase) continue;
      out.push({ key: `sub-up:${s.key}:${s.lastDate}`, kind: 'budget', title: `📈 ${s.label} augmente`, body: `${formatEUR(s.increase.from)} → ${formatEUR(s.increase.to)} par mois. Toujours utile ?`, url: '/depenses/astuces' });
    }
  }

  if (enabled.game) {
    for (const g of game.goalStates) {
      for (const m of g.milestones) {
        out.push({ key: `goal:${g.goal.id}:${m}`, kind: 'game', title: m === 100 ? `🏆 Objectif atteint : ${g.goal.name} !` : `🎉 Palier ${m} % : ${g.goal.name}`, body: `${formatEUR(g.progress.current, { round: true })} sur ${formatEUR(g.progress.target, { round: true })}.`, url: '/epargne/objectifs' });
      }
    }
    if (game.level.current.level > 1) {
      out.push({ key: `level:${game.level.current.level}`, kind: 'game', title: `${game.level.current.icon} Niveau ${game.level.current.level} : ${game.level.current.name} !`, body: `${game.xp} XP. Continue comme ça !`, url: '/epargne/objectifs' });
    }
    const dim = daysInMonth(now.getFullYear(), now.getMonth() + 1);
    if (now.getDate() >= dim - 3 && hour >= 18 && game.savedThisMonth === 0) {
      out.push({ key: `streak:${month}`, kind: 'game', title: game.streak > 0 ? `🔥 Garde ta série de ${game.streak} mois !` : '🔥 Lance ta série d\'épargne', body: 'Mets un peu d\'argent de côté avant la fin du mois : même 10 € comptent.', url: '/epargne/objectifs' });
    }
  }

  if (enabled.weekly && now.getDay() === 0 && hour >= 19) {
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const from = localISO(weekAgo);
    const savingsCats = new Set(data.categories.filter((c) => c.kind === 'savings').map((c) => c.id));
    const spentWeek = data.transactions.filter((t) => t.date > from && t.date <= today && t.amount < 0 && !(t.categoryId && savingsCats.has(t.categoryId))).reduce((s, t) => s - t.amount, 0);
    const cap = savingsCapacity(summarizeMonth(data.transactions, data.categories, month));
    const tip = insights.ofTheMonth[0];
    out.push({
      key: `weekly:${today}`,
      kind: 'weekly',
      title: '📊 Ta semaine',
      body: `Dépensé : ${formatEUR(spentWeek, { round: true })} · Il te reste ${formatEUR(cap.leftover, { round: true })} ce mois-ci.${game.streak ? ` Série : ${game.streak} mois 🔥` : ''}${tip ? ` 💡 ${tip.tip.title}` : ''}`,
      url: '/accueil',
    });
  }

  if (enabled.deals && hour >= 12 && deals.length) {
    const recent = deals.filter((d) => !d.date || now.getTime() - Date.parse(d.date) < 7 * 86400000);
    if (recent.length) {
      out.push({
        key: `deals:${today}`,
        kind: 'deals',
        title: `📍 ${recent.length} bon${recent.length > 1 ? 's' : ''} plan${recent.length > 1 ? 's' : ''} à ${city}`,
        body: recent.slice(0, 2).map((d) => `• ${d.title}`).join('\n'),
        url: '/depenses/astuces',
      });
    }
  }
  return out;
}

/** Clé de la semaine (pour l'historique). */
export const weekKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
