/**
 * Valorisation des placements (BTC, ETF du PEA, assurance-vie…).
 *
 * - Montant investi = achats − ventes (versements nets).
 * - Valeur actuelle :
 *   • placement coté (cours automatique) : quantité × dernier cours ;
 *   • placement sans cours (fonds euros, PER…) : dernière valorisation saisie,
 *     + achats − ventes faits depuis ;
 *   • à défaut : le montant investi.
 */
import type { Investment, InvestmentEnvelope, InvestmentOperation, PriceQuote } from '../../db/schema';
import type { Cents } from '../money';

export interface Position {
  investment: Investment;
  quantity: number;
  invested: Cents;
  value: Cents;
  gain: Cents;
  gainRatio: number;
  price?: number;
  priceFetchedAt?: string;
  valueSource: 'price' | 'valuation' | 'cost';
}

const sortOps = (ops: InvestmentOperation[]) => [...ops].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'valuation' ? 1 : 0) - (b.kind === 'valuation' ? 1 : 0));

export function computePosition(investment: Investment, allOps: InvestmentOperation[], quote?: PriceQuote): Position {
  const ops = sortOps(allOps.filter((o) => o.investmentId === investment.id));
  let quantity = 0;
  let invested = 0;
  for (const o of ops) {
    if (o.kind === 'buy') {
      quantity += o.quantity ?? 0;
      invested += o.amount;
    } else if (o.kind === 'sell') {
      quantity -= o.quantity ?? 0;
      invested -= o.amount;
    }
  }
  quantity = Math.round(quantity * 1e8) / 1e8;

  let value = invested;
  let valueSource: Position['valueSource'] = 'cost';
  if (investment.priceSource !== 'manual' && quote && quantity > 0) {
    value = Math.round(quantity * quote.price * 100);
    valueSource = 'price';
  } else {
    const lastIdx = ops.map((o) => o.kind).lastIndexOf('valuation');
    if (lastIdx >= 0) {
      value = ops[lastIdx].amount;
      for (const o of ops.slice(lastIdx + 1)) value += o.kind === 'buy' ? o.amount : o.kind === 'sell' ? -o.amount : 0;
      valueSource = 'valuation';
    }
  }
  const gain = value - invested;
  return { investment, quantity, invested, value, gain, gainRatio: invested > 0 ? gain / invested : 0, price: quote?.price, priceFetchedAt: quote?.fetchedAt, valueSource };
}

export interface PortfolioSummary {
  value: Cents;
  invested: Cents;
  gain: Cents;
  gainRatio: number;
  byEnvelope: { envelope: InvestmentEnvelope; value: Cents }[];
}

export function summarizePortfolio(positions: Position[]): PortfolioSummary {
  const value = positions.reduce((s, p) => s + p.value, 0);
  const invested = positions.reduce((s, p) => s + p.invested, 0);
  const map = new Map<InvestmentEnvelope, Cents>();
  for (const p of positions) map.set(p.investment.envelope, (map.get(p.investment.envelope) ?? 0) + p.value);
  return {
    value,
    invested,
    gain: value - invested,
    gainRatio: invested > 0 ? (value - invested) / invested : 0,
    byEnvelope: [...map.entries()].map(([envelope, v]) => ({ envelope, value: v })).sort((a, b) => b.value - a.value),
  };
}

export const ENVELOPE_LABELS: Record<InvestmentEnvelope, string> = {
  pea: 'PEA',
  cto: 'Compte-titres',
  crypto: 'Crypto',
  assuranceVie: 'Assurance-vie',
  per: 'PER',
  other: 'Autre',
};

export const ENVELOPE_ICONS: Record<InvestmentEnvelope, string> = {
  pea: '🇫🇷',
  cto: '📊',
  crypto: '🪙',
  assuranceVie: '🛡️',
  per: '🏖️',
  other: '💼',
};
