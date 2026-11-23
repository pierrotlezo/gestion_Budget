import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../db/schema';
import { detectSubscriptions, subscriptionKey } from './subscriptions';
import { evaluateTips, fillTip, tipsOfTheMonth, type TipContext, type TipDef } from './engine';
import { parseDealabsRss } from './deals';

const tx = (date: string, amount: number, label: string): Transaction => ({ id: date + label + amount, date, amount, label, categoryId: null, source: 'csv' });

describe('abonnements', () => {
  it('regroupe les libellés sans chiffres ni mots bancaires', () => {
    expect(subscriptionKey('PRLV SEPA NETFLIX.COM 123456')).toBe('NETFLIX COM');
  });
  it('détecte les prélèvements mensuels stables et les hausses de prix', () => {
    const list = [
      tx('2026-09-10', -1349, 'PRLV SEPA NETFLIX.COM'), tx('2026-10-10', -1349, 'PRLV SEPA NETFLIX.COM'), tx('2026-11-10', -1499, 'PRLV SEPA NETFLIX.COM'),
      tx('2026-09-05', -1599, 'FREE MOBILE 09/26'), tx('2026-10-05', -1599, 'FREE MOBILE 10/26'), tx('2026-11-05', -1599, 'FREE MOBILE 11/26'),
      tx('2026-10-20', -3700, 'CB OUIGO'), tx('2026-11-21', -3750, 'CB OUIGO'), // seulement 2 mois : pas un abonnement
      tx('2026-09-12', -1500, 'CB FNAC'), tx('2026-10-12', -3600, 'CB FNAC'), tx('2026-11-12', -3659, 'CB FNAC'), // montant trop variable
      tx('2026-11-03', -2345, 'CB CARREFOUR'), tx('2026-11-12', -4100, 'CB CARREFOUR'), tx('2026-10-03', -3000, 'CB CARREFOUR'),
      tx('2026-11-01', 60000, 'VIR LIVRET A'),
    ];
    const subs = detectSubscriptions(list, '2026-11');
    expect(subs.map((s) => s.key)).toEqual(['FREE MOBILE', 'NETFLIX COM']);
    expect(subs.find((s) => s.key === 'NETFLIX COM')!.increase).toEqual({ from: 1349, to: 1499 });
    expect(subs.find((s) => s.key === 'FREE MOBILE')!.increase).toBeNull();
  });
});

describe('astuces', () => {
  const defs: TipDef[] = [
    { id: 'a', icon: '🛒', title: 'Courses', text: 'Tu dépenses {moyenne}, tu peux gagner {economie}.', categoryId: 'alim', when: { type: 'categoryAbove', categoryId: 'alim', minMonthly: 10000 }, savingRatio: 0.2 },
    { id: 'b', icon: '🚆', title: 'Train', text: '', categoryId: 'transport', when: { type: 'categoryAbove', categoryId: 'transport', minMonthly: 10000 }, savingRatio: 0.3 },
    { id: 'c', icon: '📱', title: 'Abonnements', text: '', when: { type: 'subscriptions', min: 2 }, savingRatio: 0.25 },
    { id: 'd', icon: '💡', title: 'Règle des 48 h', text: '', when: { type: 'always' }, savingFixed: 1000 },
    { id: 'e', icon: '🏦', title: 'Frais bancaires', text: '', when: { type: 'labelMatch', pattern: 'frais' }, savingFixed: 500 },
  ];
  const ctx: TipContext = {
    avgByCategory: new Map([['alim', 20000], ['transport', 5000]]),
    overBudget: new Set(),
    subscriptions: [{ key: 'X', label: 'X', categoryId: null, amount: 1500, months: 3, lastDate: '', increase: null }, { key: 'Y', label: 'Y', categoryId: null, amount: 500, months: 2, lastDate: '', increase: null }],
    labels: ['FRAIS TENUE DE COMPTE'],
    states: new Map([['d', { id: 'd', status: 'dismissed', updatedAt: '' }]]),
  };

  it('ne garde que les astuces pertinentes et estime l’économie', () => {
    const all = evaluateTips(defs, ctx);
    expect(all.map((s) => s.tip.id)).toEqual(['a', 'c', 'd', 'e']);
    expect(all.find((s) => s.tip.id === 'a')!.saving).toBe(4000);
    expect(all.find((s) => s.tip.id === 'c')!.saving).toBe(500); // 25 % de 20 € d'abonnements
    expect(fillTip(defs[0].text, all[0], (c) => `${c / 100} €`)).toBe('Tu dépenses 200 €, tu peux gagner 40 €.');
  });

  it('exclut les astuces écartées et change d’astuces chaque mois', () => {
    const all = evaluateTips(defs, ctx);
    const m0 = tipsOfTheMonth(all, ctx, 0, 2).map((s) => s.tip.id);
    const m1 = tipsOfTheMonth(all, ctx, 1, 2).map((s) => s.tip.id);
    expect(m0).toEqual(['a', 'c']); // à économie égale (c et e : 5 €), ordre alphabétique
    expect(m0).not.toContain('d');
    expect(m1).not.toEqual(m0);
  });

  it('priorise une catégorie hors budget', () => {
    const all = evaluateTips(defs, { ...ctx, overBudget: new Set(['transport']), avgByCategory: new Map([['alim', 20000], ['transport', 12000]]) });
    expect(tipsOfTheMonth(all, ctx, 0, 1)[0].tip.id).toBe('a');
    expect(tipsOfTheMonth(all, { ...ctx, overBudget: new Set(['transport']) }, 0, 1)[0].tip.id).toBe('b');
  });
});

describe('bons plans Dealabs', () => {
  it('lit le flux RSS', () => {
    const xml = `<rss><channel><item><category><![CDATA[Épicerie & Courses]]></category><pepper:merchant name="Aldi" price="1,03€"/><title><![CDATA[2 pains aux raisins &amp; co]]></title><link>https://www.dealabs.com/bons-plans/2-pains-3467070</link><pubDate>Mon, 23 Nov 2026 22:48:01 +0100</pubDate></item><item><title>Lien douteux</title><link>https://exemple.com/x</link></item></channel></rss>`;
    expect(parseDealabsRss(xml, 'epicerie')).toEqual([
      { title: '2 pains aux raisins & co', price: '1,03€', merchant: 'Aldi', link: 'https://www.dealabs.com/bons-plans/2-pains-3467070', date: '2026-11-23T21:48:01.000Z', feed: 'epicerie' },
    ]);
  });
});
