import Dexie, { type Table } from 'dexie';
import type {
  Category,
  CategoryRule,
  CsvProfile,
  Investment,
  InvestmentOperation,
  Loan,
  PriceQuote,
  SavingsGoal,
  TipState,
  SimScenario,
  SavingsAccount,
  SavingsMovement,
  Settings,
  Transaction,
} from './schema';
import {
  CATEGORY_EXTRAS,
  defaultScenarios,
  investmentRuleSet,
  defaultCategories,
  defaultLoan,
  defaultRules,
  defaultSavingsAccounts,
  defaultSettings,
} from './defaults';

/**
 * Base IndexedDB locale (dans le navigateur). Rien ne sort de la machine.
 *
 * Pour faire évoluer le schéma (nouveau module, nouvel index) :
 *   this.version(2).stores({ goals: 'id' }).upgrade(tx => { ... });
 * Ne jamais modifier une version déjà publiée : toujours en ajouter une.
 */
export class BudgetDB extends Dexie {
  settings!: Table<Settings, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  rules!: Table<CategoryRule, string>;
  csvProfiles!: Table<CsvProfile, string>;
  loans!: Table<Loan, string>;
  savingsAccounts!: Table<SavingsAccount, string>;
  savingsMovements!: Table<SavingsMovement, string>;
  investments!: Table<Investment, string>;
  investmentOps!: Table<InvestmentOperation, string>;
  prices!: Table<PriceQuote, string>;
  goals!: Table<SavingsGoal, string>;
  scenarios!: Table<SimScenario, string>;
  tipStates!: Table<TipState, string>;

  constructor(name = 'gestion-budget') {
    super(name);
    this.version(1).stores({
      settings: 'id',
      categories: 'id, order',
      transactions: 'id, date, categoryId, importHash',
      rules: 'id, priority',
      csvProfiles: 'id',
      loans: 'id',
      savingsAccounts: 'id',
      savingsMovements: 'id, accountId, date',
    });

    // Version 2 : épargne & investissement (placements, cours, objectifs, simulateur)
    this.version(2)
      .stores({
        investments: 'id',
        investmentOps: 'id, investmentId, date',
        prices: 'id',
        goals: 'id',
        scenarios: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('settings').toCollection().modify((s) => {
          if (s.autoPrices === undefined) s.autoPrices = true;
        });
        const rules = tx.table('rules');
        const existing = new Set((await rules.toArray()).map((r) => String(r.pattern).toUpperCase()));
        const first = (await rules.orderBy('priority').last())?.priority ?? 0;
        await rules.bulkAdd(
          investmentRuleSet
            .filter(([p]) => !existing.has(p))
            .map(([pattern, categoryId], i) => ({ id: `rule-inv-${i}`, pattern, match: 'contains', categoryId, priority: first + (i + 1) * 10 })),
        );
        await tx.table('scenarios').bulkAdd(defaultScenarios);
      });

    // Version 3 : icônes de catégories, astuces d'économie, bons plans, plan de prêt
    this.version(3)
      .stores({ tipStates: 'id' })
      .upgrade(async (tx) => {
        await tx.table('categories').toCollection().modify((c) => {
          const extra = CATEGORY_EXTRAS[c.id];
          if (!c.icon) c.icon = extra?.icon ?? '🏷️';
          if (!c.dealFeeds && extra?.dealFeeds) c.dealFeeds = extra.dealFeeds;
        });
        await tx.table('settings').toCollection().modify((s) => {
          if (s.autoDeals === undefined) s.autoDeals = true;
          if (!s.loanPlan) s.loanPlan = { monthlyDraw: s.monthlyTransfer ?? 60000, drawYears: 3, availableOverride: null, payDeferralFromSavings: true };
        });
      });

    this.on('populate', (tx) => {
      tx.table('settings').add(defaultSettings);
      tx.table('categories').bulkAdd(defaultCategories);
      tx.table('rules').bulkAdd(defaultRules);
      tx.table('loans').add(defaultLoan);
      tx.table('savingsAccounts').bulkAdd(defaultSavingsAccounts);
      tx.table('scenarios').bulkAdd(defaultScenarios);
    });
  }
}

export const db = new BudgetDB();

/** Liste des tables, utilisée par la sauvegarde JSON et l'effacement des données de démo. */
export const DATA_TABLES = [
  'settings',
  'categories',
  'transactions',
  'rules',
  'csvProfiles',
  'loans',
  'savingsAccounts',
  'savingsMovements',
  'investments',
  'investmentOps',
  'prices',
  'goals',
  'scenarios',
  'tipStates',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export const newId = (): string => crypto.randomUUID();
