import type { CategoryRule } from '../../db/schema';

/** Met en majuscules et retire les accents et espaces multiples : « Café  Crème » → « CAFE CREME ». */
export function normalizeLabel(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** La règle s'applique-t-elle ? `amount` (centimes signés) permet de respecter le sens de la règle. */
export function ruleMatches(rule: CategoryRule, label: string, amount?: number): boolean {
  const pattern = normalizeLabel(rule.pattern);
  if (rule.direction && amount !== undefined && (rule.direction === 'in' ? amount <= 0 : amount >= 0)) return false;
  return pattern.length > 0 && normalizeLabel(label).includes(pattern);
}

/** Catégorie proposée par la première règle (par priorité croissante) qui correspond au libellé (et au sens). */
export function findCategoryForLabel(label: string, rules: CategoryRule[], amount?: number): string | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return sorted.find((r) => ruleMatches(r, label, amount))?.categoryId ?? null;
}

/** Mots qui ne servent pas à identifier un commerçant dans un libellé bancaire. */
const NOISE = new Set([
  'CB', 'CARTE', 'PERMANENT', 'VIR.PERMANENT', 'SUMUP', 'PRLV', 'PRELEVEMENT', 'SEPA', 'VIR', 'VIREMENT', 'INST', 'RECU', 'EMIS', 'PAIEMENT', 'ACHAT',
  'FACTURE', 'DU', 'DE', 'LE', 'LA', 'LES', 'DES', 'PAR', 'POUR', 'CHEZ', 'WEB', 'EUR', 'FR', 'SAS', 'SA', 'SARL', 'RETRAIT', 'DAB',
]);

/**
 * Propose un motif de règle à partir d'un libellé : le premier mot « significatif ».
 * « CB CARREFOUR CITY 12/11 » → « CARREFOUR » ; « PRLV SEPA NETFLIX.COM » → « NETFLIX.COM ».
 */
export function suggestPattern(label: string): string {
  const words = normalizeLabel(label)
    .split(/[\s*]+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w) && !/\d/.test(w) && !/^X+$/.test(w));
  return words[0] ?? normalizeLabel(label).split(' ')[0] ?? '';
}
