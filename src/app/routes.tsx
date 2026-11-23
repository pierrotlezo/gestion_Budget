import type { ComponentType } from 'react';
import { HomePage } from '../features/home/HomePage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import { CategoryGridPage } from '../features/transactions/CategoryGridPage';
import { CategoryDetailPage } from '../features/transactions/CategoryDetailPage';
import { TipsPage } from '../features/tips/TipsPage';
import { CategorySettingsPage } from '../features/categories/CategorySettingsPage';
import { LoanPlanPage } from '../features/loan/LoanPlanPage';
import { CsvImportPage } from '../features/transactions/csv-import/CsvImportPage';
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
  /** Page sans onglet (ex. détail d'une catégorie). */
  hidden?: boolean;
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
      { path: '', label: 'Par catégorie', element: CategoryGridPage },
      { path: 'operations', label: 'Opérations', element: TransactionsPage },
      { path: 'astuces', label: '💡 Astuces & bons plans', element: TipsPage },
      { path: 'importer', label: 'Importer', element: CsvImportPage },
      { path: 'reglages', label: 'Catégories & règles', element: CategorySettingsPage },
      { path: 'categorie/:id', label: 'Catégorie', element: CategoryDetailPage, hidden: true },
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
      { path: 'objectifs', label: '🎮 Objectifs', element: GoalsPage },
      { path: 'simulateur', label: 'Simulateur', element: SimulatorPage },
    ],
  },
  {
    path: '/pret',
    label: 'Prêt',
    icon: '🏦',
    pages: [
      { path: '', label: 'Mon plan', element: LoanPlanPage },
      { path: 'details', label: 'Détails du prêt', element: LoanPage },
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
