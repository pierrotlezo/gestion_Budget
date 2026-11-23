/**
 * Bons plans du moment : flux RSS publics de Dealabs, choisis selon les catégories où tu dépenses le plus.
 * On TÉLÉCHARGE un flux public (« epicerie », « transports-en-commun »…) : aucune donnée personnelle n'est envoyée,
 * le choix des flux et le filtrage se font sur ton ordinateur. Résultats gardés 1 h en mémoire de session.
 */
import { parseDealabsRss, type Deal } from '../domain/tips/deals';

const CACHE_KEY = 'gestion-budget.deals';
const TTL = 60 * 60 * 1000;

export async function fetchDeals(feeds: string[], max = 8): Promise<Deal[]> {
  const key = feeds.join(',');
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as { key: string; at: number; deals: Deal[] } | null;
    if (cached && cached.key === key && Date.now() - cached.at < TTL) return cached.deals;
  } catch {
    /* cache illisible : on recharge */
  }
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const res = await fetch(`/api/dealabs/rss/groupe/${encodeURIComponent(feed)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseDealabsRss(await res.text(), feed);
    }),
  );
  const ok = results.filter((r): r is PromiseFulfilledResult<Deal[]> => r.status === 'fulfilled');
  if (ok.length === 0) throw new Error('Bons plans indisponibles pour le moment (connexion Internet ?).');
  // On alterne les flux pour avoir de la variété, les plus récents d'abord
  const lists = ok.map((r) => r.value.sort((a, b) => b.date.localeCompare(a.date)));
  const deals: Deal[] = [];
  for (let i = 0; deals.length < max && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && deals.length < max) deals.push(l[i]);
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), deals }));
  return deals;
}
