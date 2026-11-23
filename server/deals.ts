/** Récupération des bons plans locaux par le serveur (cache 30 min par ville). */
import { ALLOWED_FEED_HOSTS, LOCAL_SOURCES } from '../src/db/localSources';
import { extractDeals, mergeDeals, parseRss, sourceUrl, type LocalDeal } from '../src/domain/tips/localDeals';

const cache = new Map<string, { at: number; deals: LocalDeal[] }>();
const TTL = 30 * 60 * 1000;

export async function getLocalDeals(city: string): Promise<LocalDeal[]> {
  const key = city.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.deals;
  const lists = await Promise.all(
    LOCAL_SOURCES.map(async (s) => {
      const url = sourceUrl(s, city.trim());
      if (!ALLOWED_FEED_HOSTS.includes(new URL(url).hostname)) return [];
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) return [];
        return extractDeals(parseRss(await res.text()), s, city.trim(), new Date());
      } catch {
        return [];
      }
    }),
  );
  const deals = mergeDeals(lists, 60);
  cache.set(key, { at: Date.now(), deals });
  return deals;
}
