/**
 * Lecture des réponses des fournisseurs de cours (Yahoo Finance pour les actions/ETF,
 * CoinGecko pour les cryptos). Fonctions pures : le réseau est géré dans services/prices.ts.
 */
export type PriceSourceId = 'yahoo' | 'coingecko';

export interface SearchResult {
  source: PriceSourceId;
  symbol: string;
  name: string;
  detail: string;
}

/** Réponse de https://query1.finance.yahoo.com/v8/finance/chart/{symbole} */
export function parseYahooChart(json: unknown): { price: number; currency: string; name?: string } | null {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const name = (meta?.longName ?? meta?.shortName) as string | undefined;
  return { ...normalizeCurrency(price, String(meta?.currency ?? 'EUR')), name };
}

/** Certaines places cotent en centimes (GBp = pence). */
export function normalizeCurrency(price: number, currency: string): { price: number; currency: string } {
  if (currency === 'GBp' || currency === 'GBX') return { price: price / 100, currency: 'GBP' };
  if (currency === 'ZAc') return { price: price / 100, currency: 'ZAR' };
  return { price, currency: currency.toUpperCase() };
}

/** Réponse de https://api.coingecko.com/api/v3/simple/price?ids=…&vs_currencies=eur */
export function parseCoingeckoPrice(json: unknown, id: string): number | null {
  const v = (json as Record<string, { eur?: unknown }>)?.[id]?.eur;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const YAHOO_TYPES: Record<string, string> = { ETF: 'ETF', EQUITY: 'Action', MUTUALFUND: 'Fonds', CRYPTOCURRENCY: 'Crypto' };

export function parseYahooSearch(json: unknown): SearchResult[] {
  const quotes = (json as { quotes?: Record<string, string>[] })?.quotes ?? [];
  return quotes
    .filter((q) => q.symbol && YAHOO_TYPES[q.quoteType])
    .map((q) => ({
      source: 'yahoo' as const,
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      detail: `${YAHOO_TYPES[q.quoteType]} · ${q.exchDisp || q.exchange || ''}`.trim(),
    }));
}

export function parseCoingeckoSearch(json: unknown): SearchResult[] {
  const coins = (json as { coins?: { id: string; name: string; symbol: string; market_cap_rank?: number }[] })?.coins ?? [];
  return coins.slice(0, 5).map((c) => ({
    source: 'coingecko' as const,
    symbol: c.id,
    name: `${c.name} (${c.symbol})`,
    detail: `Crypto${c.market_cap_rank ? ` · n°${c.market_cap_rank} mondial` : ''}`,
  }));
}
