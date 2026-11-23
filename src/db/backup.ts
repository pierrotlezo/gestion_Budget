/**
 * Sauvegarde / restauration de toutes les données au format JSON.
 * `formatVersion` permet de relire d'anciennes sauvegardes après une évolution du modèle :
 * ajouter une étape dans `migrateBackup` à chaque changement de format.
 */
import { DATA_TABLES, type BudgetDB, type DataTable } from './db';
import { CATEGORY_EXTRAS, defaultScenarios, defaultSettings } from './defaults';

export const BACKUP_APP = 'gestion-budget';
export const BACKUP_FORMAT_VERSION = 4;

export interface Backup {
  app: typeof BACKUP_APP;
  formatVersion: number;
  exportedAt: string;
  data: Record<DataTable, unknown[]>;
}

export async function exportAll(db: BudgetDB): Promise<Backup> {
  const data = {} as Record<DataTable, unknown[]>;
  for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Vérifie et met à niveau une sauvegarde. Lève une erreur en français si le fichier est invalide. */
export function migrateBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object') throw new Error('Le fichier ne contient pas de données JSON valides.');
  const b = raw as Partial<Backup>;
  if (b.app !== BACKUP_APP) throw new Error('Ce fichier n\'est pas une sauvegarde de cette application.');
  if (typeof b.formatVersion !== 'number' || b.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('Cette sauvegarde vient d\'une version plus récente de l\'application.');
  }
  if (!b.data || typeof b.data !== 'object') throw new Error('Sauvegarde incomplète : données manquantes.');
  const data = {} as Record<DataTable, unknown[]>;
  for (const t of DATA_TABLES) {
    const rows = (b.data as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows)) throw new Error(`Sauvegarde invalide : la table « ${t} » n'est pas une liste.`);
    if (rows.some((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new Error(`Sauvegarde invalide : un élément de « ${t} » n'a pas d'identifiant.`);
    }
    data[t] = rows;
  }
  // Version 1 → 2 : les tables d'investissement absentes sont vides ; on ajoute les réglages manquants.
  data.settings = data.settings.map((s) => ({ ...defaultSettings, ...(s as object) }));
  if (data.settings.length === 0) data.settings = [defaultSettings];
  if (b.formatVersion < 2 && data.scenarios.length === 0) data.scenarios = defaultScenarios;
  // Version 2 → 3 : icônes et flux de bons plans des catégories par défaut
  data.categories = data.categories.map((c) => {
    const cat = c as { id: string; icon?: string };
    return cat.icon ? cat : { ...CATEGORY_EXTRAS[cat.id], icon: CATEGORY_EXTRAS[cat.id]?.icon ?? '🏷️', ...cat };
  });
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: b.exportedAt ?? '', data };
}

/** Remplace TOUTES les données par celles de la sauvegarde. */
export async function importAll(db: BudgetDB, raw: unknown): Promise<Record<DataTable, number>> {
  const backup = migrateBackup(raw);
  const counts = {} as Record<DataTable, number>;
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(backup.data[t]);
      counts[t] = backup.data[t].length;
    }
  });
  return counts;
}

/** Efface tout et remet les valeurs par défaut. */
export async function resetAll(db: BudgetDB) {
  await db.delete();
  await db.open();
}
