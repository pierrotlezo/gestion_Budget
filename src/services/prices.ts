/**
 * Récupération des cours (seul accès réseau de l'application).
 * Seuls les SYMBOLES sont envoyés (« CW8.PA », « bitcoin ») : jamais de montant ni de quantité.
 *
 * Les requêtes passent par le proxy local de Vite (/api/…, voir vite.config.ts) : les navigateurs
 * bloquent les appels directs à Yahoo Finance (CORS).
 */
import { db } from '../db/db';
import type { Investment, PriceQuote } from '../db/schema';
import { parseCoingeckoPrice, parseCoingeckoSearch, parseYahooChart, parseYahooSearch, type SearchResult } from '../domain/invest/quotes';

export const quoteId = (inv: Pick<Investment, 'priceSource' | 'symbol'>) => `${inv.priceSource}:${inv.symbol}`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Cours en euros d'un symbole Yahoo (avec conversion de devise si besoin). */
export async function fetchYahooPrice(symbol: string): Promise<number> {
  const quote = parseYahooChart(await getJson(`/api/yahoo1/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`));
  if (!quote) throw new Error(`Cours introuvable pour ${symbol}`);
  if (quote.currency === 'EUR') return quote.price;
  const fx = parseYahooChart(await getJson(`/api/yahoo1/v8/finance/chart/${quote.currency}EUR=X?range=1d&interval=1d`));
  if (!fx) throw new Error(`Taux de change ${quote.currency}/EUR introuvable`);
  return quote.price * fx.price;
}

export async function fetchCoingeckoPrice(id: string): Promise<number> {
  const price = parseCoingeckoPrice(await getJson(`/api/coingecko/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`), id);
  if (price === null) throw new Error(`Cours introuvable pour ${id}`);
  return price;
}

/** Recherche d'un placement par nom, symbole ou ISIN (ex. « bitcoin », « CW8 », « FR0010315770 »). */
export async function searchInstruments(query: string): Promise<SearchResult[]> {
  const q = encodeURIComponent(query.trim());
  const [yahoo, gecko] = await Promise.allSettled([
    getJson(`/api/yahoo2/v1/finance/search?q=${q}&quotesCount=8&newsCount=0`).then(parseYahooSearch),
    getJson(`/api/coingecko/api/v3/search?query=${q}`).then(parseCoingeckoSearch),
  ]);
  const results = [...(gecko.status === 'fulfilled' ? gecko.value : []), ...(yahoo.status === 'fulfilled' ? yahoo.value : [])];
  if (results.length === 0 && yahoo.status === 'rejected' && gecko.status === 'rejected') throw new Error('Recherche impossible : vérifie ta connexion Internet.');
  return results;
}

/** Met à jour les cours de tous les placements cotés. */
export async function refreshPrices(): Promise<{ updated: number; errors: string[] }> {
  const investments = (await db.investments.toArray()).filter((i) => i.priceSource !== 'manual' && i.symbol);
  const unique = new Map(investments.map((i) => [quoteId(i), i]));
  const errors: string[] = [];
  const quotes: PriceQuote[] = [];
  await Promise.all(
    [...unique.entries()].map(async ([id, inv]) => {
      try {
        const price = inv.priceSource === 'coingecko' ? await fetchCoingeckoPrice(inv.symbol!) : await fetchYahooPrice(inv.symbol!);
        quotes.push({ id, price, fetchedAt: new Date().toISOString() });
      } catch (e) {
        errors.push(`${inv.name} : ${(e as Error).message}`);
      }
    }),
  );
  await db.prices.bulkPut(quotes);
  return { updated: quotes.length, errors };
}

/** Rafraîchit automatiquement si l'option est active et que les cours datent de plus de `maxAgeMinutes`. */
let lastAuto = 0;
export async function autoRefreshPrices(maxAgeMinutes = 30): Promise<void> {
  const settings = await db.settings.get('app');
  if (settings && settings.autoPrices === false) return;
  if (Date.now() - lastAuto < maxAgeMinutes * 60_000) return;
  const investments = (await db.investments.toArray()).filter((i) => i.priceSource !== 'manual' && i.symbol);
  if (investments.length === 0) return;
  const quotes = await db.prices.bulkGet(investments.map(quoteId));
  const stale = quotes.some((q) => !q || Date.now() - Date.parse(q.fetchedAt) > maxAgeMinutes * 60_000);
  lastAuto = Date.now();
  if (stale) await refreshPrices().catch(() => undefined);
}
