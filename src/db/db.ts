import Dexie, { type Table } from 'dexie';
import type {
  Category,
  CategoryRule,
  CsvProfile,
  Loan,
  SavingsAccount,
  SavingsMovement,
  Settings,
  Transaction,
} from './schema';
import {
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

    this.on('populate', (tx) => {
      tx.table('settings').add(defaultSettings);
      tx.table('categories').bulkAdd(defaultCategories);
      tx.table('rules').bulkAdd(defaultRules);
      tx.table('loans').add(defaultLoan);
      tx.table('savingsAccounts').bulkAdd(defaultSavingsAccounts);
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
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export const newId = (): string => crypto.randomUUID();
