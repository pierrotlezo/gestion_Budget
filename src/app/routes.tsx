import type { ComponentType } from 'react';
import { HomePage } from '../features/home/HomePage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { CsvImportPage } from '../features/transactions/csv-import/CsvImportPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { RulesPage } from '../features/rules/RulesPage';
import { OverviewPage } from '../features/invest/OverviewPage';
import { PortfolioPage } from '../features/invest/PortfolioPage';
import { SavingsPage } from '../features/savings/SavingsPage';
import { GoalsPage } from '../features/invest/GoalsPage';
import { SimulatorPage } from '../features/invest/SimulatorPage';
import { LoanPage } from '../features/loan/LoanPage';
import { LoanVsSavingsPage } from '../features/loan/LoanVsSavingsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { DataPage } from '../features/data/DataPage';

/**
 * Navigation : 5 rubriques dans la barre latérale, des onglets en haut de chaque rubrique.
 * Ajouter un écran = ajouter une page dans la rubrique concernée.
 */
export interface SubPage {
  /** Chemin relatif à la rubrique ('' = page par défaut). */
  path: string;
  label: string;
  element: ComponentType;
}

export interface Section {
  path: string;
  label: string;
  icon: string;
  pages: SubPage[];
}

export const sections: Section[] = [
  { path: '/accueil', label: 'Accueil', icon: '🏠', pages: [{ path: '', label: 'Accueil', element: HomePage }] },
  {
    path: '/depenses',
    label: 'Dépenses',
    icon: '💸',
    pages: [
      { path: '', label: 'Transactions', element: TransactionsPage },
      { path: 'importer', label: 'Importer un relevé', element: CsvImportPage },
      { path: 'categories', label: 'Catégories & budgets', element: CategoriesPage },
      { path: 'regles', label: 'Règles', element: RulesPage },
    ],
  },
  {
    path: '/epargne',
    label: 'Épargne & Invest.',
    icon: '📈',
    pages: [
      { path: '', label: "Vue d'ensemble", element: OverviewPage },
      { path: 'placements', label: 'Placements', element: PortfolioPage },
      { path: 'livrets', label: 'Livrets', element: SavingsPage },
      { path: 'objectifs', label: 'Objectifs', element: GoalsPage },
      { path: 'simulateur', label: 'Simulateur', element: SimulatorPage },
    ],
  },
  {
    path: '/pret',
    label: 'Prêt',
    icon: '🏦',
    pages: [
      { path: '', label: 'Mon prêt', element: LoanPage },
      { path: 'comparaison', label: 'Prêt vs épargne', element: LoanVsSavingsPage },
    ],
  },
  {
    path: '/reglages',
    label: 'Réglages',
    icon: '⚙️',
    pages: [
      { path: '', label: 'Paramètres', element: SettingsPage },
      { path: 'donnees', label: 'Données & sauvegarde', element: DataPage },
    ],
  },
];

/** Lien vers une page : pageUrl('/depenses', 'importer') → « /depenses/importer ». */
export const pageUrl = (section: string, page = '') => (page ? `${section}/${page}` : section);
