/**
 * Valeurs par défaut, insérées à la création de la base.
 * Ce sont des DONNÉES : tout est modifiable ensuite dans l'application.
 */
import type { Category, CategoryRule, Loan, SavingsAccount, Settings } from './schema';

/**
 * Historique officiel des taux du Livret A (le LDDS a le même taux).
 * À compléter dans Paramètres à chaque révision (1er février et 1er août).
 */
export const LIVRET_A_RATES = [
  { from: '2020-02-01', rate: 0.005 },
  { from: '2022-02-01', rate: 0.01 },
  { from: '2022-08-01', rate: 0.02 },
  { from: '2023-02-01', rate: 0.03 },
  { from: '2025-02-01', rate: 0.024 },
  { from: '2025-08-01', rate: 0.017 },
  { from: '2026-02-01', rate: 0.015 },
];

export const DEFAULT_LIVRET_A_ID = 'acc-livret-a';
export const DEFAULT_LOAN_ID = 'loan-principal';

export const defaultSettings: Settings = {
  id: 'app',
  monthlyTransfer: 60000,
  transferDay: 1,
  transferAccountId: DEFAULT_LIVRET_A_ID,
  parentsAllowance: 25000,
  livretACeiling: 2295000,
  livretARates: LIVRET_A_RATES,
};

export const defaultCategories: Category[] = [
  { id: 'cat-loyer', name: 'Loyer', color: '#2a78d6', monthlyBudget: 0, kind: 'expense', order: 0 },
  { id: 'cat-alimentation', name: 'Alimentation', color: '#eb6834', monthlyBudget: 25000, kind: 'expense', order: 1 },
  { id: 'cat-energie', name: 'Électricité/Énergie', color: '#1baf7a', monthlyBudget: 0, kind: 'expense', order: 2 },
  { id: 'cat-abonnements', name: 'Abonnements', color: '#eda100', monthlyBudget: 0, kind: 'expense', order: 3 },
  { id: 'cat-transport', name: 'Transport', color: '#e87ba4', monthlyBudget: 0, kind: 'expense', order: 4 },
  { id: 'cat-divertissement', name: 'Divertissement', color: '#008300', monthlyBudget: 0, kind: 'expense', order: 5 },
  { id: 'cat-epargne', name: 'Épargne & Investissement', color: '#6250d6', monthlyBudget: 0, kind: 'savings', order: 6 },
  { id: 'cat-autre', name: 'Autre', color: '#8a8f98', monthlyBudget: 0, kind: 'expense', order: 7 },
  { id: 'cat-virement-livret', name: 'Virement Livret A', color: '#2a78d6', monthlyBudget: 60000, kind: 'income', order: 8 },
  { id: 'cat-parents', name: 'Aide des parents', color: '#eb6834', monthlyBudget: 25000, kind: 'income', order: 9 },
  { id: 'cat-autres-revenus', name: 'Autres revenus', color: '#1baf7a', monthlyBudget: 0, kind: 'income', order: 10 },
];

const ruleSet: [string, string][] = [
  ['CARREFOUR', 'cat-alimentation'],
  ['LECLERC', 'cat-alimentation'],
  ['AUCHAN', 'cat-alimentation'],
  ['LIDL', 'cat-alimentation'],
  ['INTERMARCHE', 'cat-alimentation'],
  ['MONOPRIX', 'cat-alimentation'],
  ['FRANPRIX', 'cat-alimentation'],
  ['NETFLIX', 'cat-abonnements'],
  ['SPOTIFY', 'cat-abonnements'],
  ['DEEZER', 'cat-abonnements'],
  ['DISNEY', 'cat-abonnements'],
  ['AMAZON PRIME', 'cat-abonnements'],
  ['FREE MOBILE', 'cat-abonnements'],
  ['EDF', 'cat-energie'],
  ['ENGIE', 'cat-energie'],
  ['TOTALENERGIES', 'cat-energie'],
  ['SNCF', 'cat-transport'],
  ['OUIGO', 'cat-transport'],
  ['LOYER', 'cat-loyer'],
];

export const defaultRules: CategoryRule[] = ruleSet.map(([pattern, categoryId], i) => ({
  id: `rule-${i}`,
  pattern,
  match: 'contains',
  categoryId,
  priority: i * 10,
}));

export const defaultLoan: Loan = {
  id: DEFAULT_LOAN_ID,
  name: 'Prêt bancaire',
  principal: 5000000,
  annualRate: 0,
  durationMonths: 60,
  startDate: '2026-01-01',
  monthlyInsurance: 0,
  deferral: { type: 'partial', months: 60 },
};

export const defaultSavingsAccounts: SavingsAccount[] = [
  { id: DEFAULT_LIVRET_A_ID, name: 'Livret A', type: 'livretA', rates: null, ceiling: null, fundedByLoanId: DEFAULT_LOAN_ID },
];
