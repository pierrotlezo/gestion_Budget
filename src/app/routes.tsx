import type { ComponentType } from 'react';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { CsvImportPage } from '../features/transactions/csv-import/CsvImportPage';
import { RulesPage } from '../features/rules/RulesPage';
import { LoanPage } from '../features/loan/LoanPage';
import { SavingsPage } from '../features/savings/SavingsPage';
import { NetWorthPage } from '../features/net-worth/NetWorthPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { DataPage } from '../features/data/DataPage';
import { SettingsPage } from '../features/settings/SettingsPage';

/**
 * Registre des écrans. Ajouter un module = ajouter une entrée ici.
 * (Prochaines versions : investissements, objectifs, abonnements récurrents, prévisions.)
 */
export interface AppRoute {
  path: string;
  label: string;
  icon: string;
  element: ComponentType;
}

export const routes: AppRoute[] = [
  { path: '/tableau-de-bord', label: 'Tableau de bord', icon: '📊', element: DashboardPage },
  { path: '/transactions', label: 'Transactions', icon: '🧾', element: TransactionsPage },
  { path: '/import', label: 'Import CSV', icon: '📥', element: CsvImportPage },
  { path: '/pret', label: 'Prêt', icon: '🏦', element: LoanPage },
  { path: '/epargne', label: 'Épargne', icon: '🐷', element: SavingsPage },
  { path: '/patrimoine', label: 'Patrimoine net', icon: '⚖️', element: NetWorthPage },
  { path: '/categories', label: 'Catégories', icon: '🏷️', element: CategoriesPage },
  { path: '/regles', label: 'Règles', icon: '🪄', element: RulesPage },
  { path: '/donnees', label: 'Données', icon: '💾', element: DataPage },
  { path: '/parametres', label: 'Paramètres', icon: '⚙️', element: SettingsPage },
];
