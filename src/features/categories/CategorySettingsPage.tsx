import { CategoriesPage } from './CategoriesPage';
import { RulesPage } from '../rules/RulesPage';

/** Réglages des dépenses : catégories (icône, couleur, budget) puis règles de tri automatique. */
export function CategorySettingsPage() {
  return (
    <div className="space-y-10">
      <CategoriesPage />
      <RulesPage />
    </div>
  );
}
