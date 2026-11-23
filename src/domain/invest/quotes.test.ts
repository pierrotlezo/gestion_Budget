import { describe, expect, it } from 'vitest';
import { normalizeCurrency, parseCoingeckoPrice, parseCoingeckoSearch, parseYahooChart, parseYahooSearch } from './quotes';

describe('lecture des cours', () => {
  it('Yahoo Finance (ETF du PEA)', () => {
    const json = { chart: { result: [{ meta: { currency: 'EUR', symbol: 'CW8.PA', regularMarketPrice: 688.72, longName: 'Amundi MSCI World' } }] } };
    expect(parseYahooChart(json)).toEqual({ price: 688.72, currency: 'EUR', name: 'Amundi MSCI World' });
    expect(parseYahooChart({ chart: { result: null, error: { code: 'Not Found' } } })).toBeNull();
    expect(parseYahooChart('n importe quoi')).toBeNull();
  });
  it('convertit les cotations en pence', () => {
    expect(normalizeCurrency(1234, 'GBp')).toEqual({ price: 12.34, currency: 'GBP' });
    expect(normalizeCurrency(10, 'usd')).toEqual({ price: 10, currency: 'USD' });
  });
  it('CoinGecko', () => {
    expect(parseCoingeckoPrice({ bitcoin: { eur: 56192 } }, 'bitcoin')).toBe(56192);
    expect(parseCoingeckoPrice({}, 'bitcoin')).toBeNull();
  });
  it('recherche', () => {
    const y = parseYahooSearch({ quotes: [
      { symbol: 'CW8.PA', shortname: 'Amundi MSCI World', quoteType: 'ETF', exchDisp: 'Paris' },
      { symbol: '^GSPC', shortname: 'S&P 500', quoteType: 'INDEX' },
    ] });
    expect(y).toEqual([{ source: 'yahoo', symbol: 'CW8.PA', name: 'Amundi MSCI World', detail: 'ETF · Paris' }]);
    const c = parseCoingeckoSearch({ coins: [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', market_cap_rank: 1 }] });
    expect(c[0]).toEqual({ source: 'coingecko', symbol: 'bitcoin', name: 'Bitcoin (BTC)', detail: 'Crypto · n°1 mondial' });
  });
});
