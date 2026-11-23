import { describe, expect, it } from 'vitest';
import type { Investment, InvestmentOperation } from '../../db/schema';
import { computePosition, summarizePortfolio } from './portfolio';

const btc: Investment = { id: 'btc', name: 'Bitcoin', envelope: 'crypto', symbol: 'bitcoin', priceSource: 'coingecko', color: '#000' };
const av: Investment = { id: 'av', name: 'Fonds euros', envelope: 'assuranceVie', priceSource: 'manual', color: '#000' };
const op = (investmentId: string, date: string, kind: InvestmentOperation['kind'], amount: number, quantity?: number): InvestmentOperation => ({ id: `${investmentId}${date}${kind}`, investmentId, date, kind, amount, quantity });

describe('valorisation des placements', () => {
  const ops = [op('btc', '2026-01-10', 'buy', 5000, 0.001), op('btc', '2026-02-10', 'buy', 5000, 0.0008), op('btc', '2026-03-10', 'sell', 2000, 0.0003)];

  it('placement coté : quantité × cours', () => {
    const p = computePosition(btc, ops, { id: 'coingecko:bitcoin', price: 60000, fetchedAt: '' });
    expect(p.quantity).toBeCloseTo(0.0015, 10);
    expect(p.invested).toBe(8000);
    expect(p.value).toBe(9000); // 0,0015 × 60 000 € = 90 €
    expect(p.gain).toBe(1000);
    expect(p.gainRatio).toBeCloseTo(0.125);
    expect(p.valueSource).toBe('price');
  });

  it('sans cours disponible : valeur = montant investi', () => {
    expect(computePosition(btc, ops)).toMatchObject({ value: 8000, gain: 0, valueSource: 'cost' });
  });

  it('placement sans cours : dernière valorisation + versements depuis', () => {
    const avOps = [op('av', '2025-01-01', 'buy', 100000), op('av', '2025-12-31', 'valuation', 102500), op('av', '2026-03-01', 'buy', 20000), op('av', '2026-04-01', 'sell', 5000)];
    const p = computePosition(av, avOps);
    expect(p.invested).toBe(115000);
    expect(p.value).toBe(102500 + 20000 - 5000);
    expect(p.gain).toBe(2500);
    expect(p.valueSource).toBe('valuation');
  });

  it('une valorisation le même jour qu’un versement l’inclut', () => {
    const avOps = [op('av', '2026-01-01', 'valuation', 50000), op('av', '2026-01-01', 'buy', 50000)];
    expect(computePosition(av, avOps).value).toBe(50000);
  });

  it('résumé et répartition par enveloppe', () => {
    const s = summarizePortfolio([
      computePosition(btc, ops, { id: 'x', price: 60000, fetchedAt: '' }),
      computePosition(av, [op('av', '2026-01-01', 'buy', 20000)]),
    ]);
    expect(s).toMatchObject({ value: 29000, invested: 28000, gain: 1000 });
    expect(s.byEnvelope).toEqual([{ envelope: 'assuranceVie', value: 20000 }, { envelope: 'crypto', value: 9000 }]);
  });
});
