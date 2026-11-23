import { describe, expect, it } from 'vitest';
import type { CategoryRule } from '../../db/schema';
import { findCategoryForLabel, normalizeLabel, suggestPattern } from './categorize';

const rule = (pattern: string, categoryId: string, priority = 0): CategoryRule => ({ id: pattern, pattern, match: 'contains', categoryId, priority });

describe('catégorisation par règles', () => {
  const rules = [rule('CARREFOUR', 'alim', 10), rule('NETFLIX', 'abo', 20), rule('carrefour location', 'transport', 0)];

  it('ignore majuscules et accents', () => {
    expect(normalizeLabel('  Café   Crème ')).toBe('CAFE CREME');
    expect(findCategoryForLabel('cb carrefour city grenoble', rules)).toBe('alim');
    expect(findCategoryForLabel('PRLV SEPA Netflix.com', rules)).toBe('abo');
  });

  it('respecte la priorité (plus petite d’abord)', () => {
    expect(findCategoryForLabel('CARREFOUR LOCATION UTILITAIRE', rules)).toBe('transport');
  });

  it('renvoie null si aucune règle ne correspond', () => {
    expect(findCategoryForLabel('BOULANGERIE', rules)).toBeNull();
    expect(findCategoryForLabel('X', [rule('', 'vide')])).toBeNull();
  });

  it('suggère un motif sans le bruit bancaire', () => {
    expect(suggestPattern('CB CARREFOUR CITY 12/11')).toBe('CARREFOUR');
    expect(suggestPattern('PRLV SEPA NETFLIX.COM')).toBe('NETFLIX.COM');
    expect(suggestPattern('CARTE X1234 21/11 SNCF CONNECT')).toBe('SNCF');
  });
});
