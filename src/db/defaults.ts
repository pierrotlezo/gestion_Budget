/**
 * Valeurs par défaut, insérées à la création de la base.
 * Ce sont des DONNÉES : tout est modifiable ensuite dans l'application.
 */
import type { Category, CategoryRule, Loan, SavingsAccount, Settings, SimScenario } from './schema';

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
  autoPrices: true,
  autoDeals: true,
  loanPlan: { monthlyDraw: 60000, drawYears: 3, availableOverride: null, payDeferralFromSavings: true },
  city: 'Grenoble',
  notifications: { budget: true, game: true, weekly: true, deals: true },
};

/** Icône et flux de bons plans Dealabs de chaque catégorie par défaut. */
export const CATEGORY_EXTRAS: Record<string, { icon: string; dealFeeds?: string[] }> = {
  'cat-loyer': { icon: '🏠' },
  'cat-alimentation': { icon: '🛒', dealFeeds: ['epicerie', 'restaurants'] },
  'cat-energie': { icon: '⚡', dealFeeds: ['energie'] },
  'cat-abonnements': { icon: '📱', dealFeeds: ['forfaits-mobiles', 'telephonie'] },
  'cat-transport': { icon: '🚆', dealFeeds: ['transports-en-commun', 'voyages'] },
  'cat-divertissement': { icon: '🎬', dealFeeds: ['sorties', 'cinema', 'culture-divertissement'] },
  'cat-epargne': { icon: '🐷' },
  'cat-autre': { icon: '📦', dealFeeds: ['gratuit'] },
  'cat-virement-livret': { icon: '🏦' },
  'cat-parents': { icon: '💝' },
  'cat-autres-revenus': { icon: '💶' },
};

const baseCategories: Category[] = [
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

export const defaultCategories: Category[] = baseCategories.map((c) => ({ ...c, ...CATEGORY_EXTRAS[c.id] }));

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

/**
 * Enseignes et organismes courants (ajoutées en version 5). Le 3e élément facultatif limite la règle
 * aux entrées (« in ») ou aux sorties (« out ») d'argent.
 */
export const commonRuleSet: [string, string, ('in' | 'out')?][] = [
  ['IZLY', 'cat-alimentation'],
  ['BURGER KING', 'cat-alimentation'],
  ['MCDONALD', 'cat-alimentation'],
  ['MC DONALD', 'cat-alimentation'],
  ['KFC', 'cat-alimentation'],
  ['SUSHI', 'cat-alimentation'],
  ['DOMINOS', 'cat-alimentation'],
  ['UBER EATS', 'cat-alimentation'],
  ['DELIVEROO', 'cat-alimentation'],
  ['BOULANGERIE', 'cat-alimentation'],
  ['SPAR', 'cat-alimentation'],
  ['COCCINELLE', 'cat-alimentation'],
  ['GRAND FRAIS', 'cat-alimentation'],
  ['BIOCOOP', 'cat-alimentation'],
  ['AREAS', 'cat-alimentation'],
  ['EFFIA', 'cat-transport'],
  ['INDIGO', 'cat-transport'],
  ['BLABLACAR', 'cat-transport'],
  ['TOTAL ACCESS', 'cat-transport'],
  ['ANTHROPIC', 'cat-abonnements'],
  ['OPENAI', 'cat-abonnements'],
  ['YOUTUBE', 'cat-abonnements'],
  ['BETCLIC', 'cat-divertissement'],
  ['WINAMAX', 'cat-divertissement'],
  ['UNIBET', 'cat-divertissement'],
  ['FDJ', 'cat-divertissement'],
  ['HELLOASSO', 'cat-divertissement'],
  ['HELLO ASSO', 'cat-divertissement'],
  ['CINEMA', 'cat-divertissement'],
  ['PATHE', 'cat-divertissement'],
  ['STEAM', 'cat-divertissement'],
  ['C.P.A.M', 'cat-autres-revenus', 'in'],
  ['CPAM', 'cat-autres-revenus', 'in'],
  ['ASSURANCE MOYEN DE PAIEMENT', 'cat-autre'],
  ['COTISATION', 'cat-autre'],
  ['FRAIS', 'cat-autre'],
  ['ECHEANCE PRET', 'cat-autre'],
];

/** Virements vers des plateformes d'investissement → catégorie Épargne (ajoutées en version 2). */
export const investmentRuleSet: [string, string][] = [
  ['TRADE REPUBLIC', 'cat-epargne'],
  ['COINBASE', 'cat-epargne'],
  ['BINANCE', 'cat-epargne'],
  ['BITPANDA', 'cat-epargne'],
  ['BITSTACK', 'cat-epargne'],
  ['DEGIRO', 'cat-epargne'],
  ['YOMONI', 'cat-epargne'],
];

/**
 * Identifiants identiques à ceux créés par les migrations (rule-inv-…, rule-common-…) :
 * un nouvel appareil et un PC mis à jour au fil des versions ont ainsi les mêmes règles, sans doublon après synchro.
 */
export const defaultRules: CategoryRule[] = [
  ...ruleSet.map(([p, c], i) => ({ id: `rule-${i}`, p, c, d: undefined as 'in' | 'out' | undefined })),
  ...investmentRuleSet.map(([p, c], i) => ({ id: `rule-inv-${i}`, p, c, d: undefined })),
  ...commonRuleSet.map(([p, c, d], i) => ({ id: `rule-common-${i}`, p, c, d })),
].map(({ id, p, c, d }, i) => ({ id, pattern: p, match: 'contains' as const, categoryId: c, priority: i * 10, ...(d ? { direction: d } : {}) }));

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

/** Scénarios de départ du simulateur (rendements supposés, modifiables). */
export const defaultScenarios: SimScenario[] = [
  { id: 'sim-livret', name: 'Livret A', initial: 0, monthly: 10000, years: 10, annualReturn: 0.015, color: '#2a78d6' },
  { id: 'sim-etf', name: 'ETF Monde (PEA)', initial: 0, monthly: 10000, years: 10, annualReturn: 0.07, color: '#eb6834' },
];
