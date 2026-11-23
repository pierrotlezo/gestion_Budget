/**
 * Synchronisation PC ↔ téléphone (fusion « le plus récent gagne », enregistrement par enregistrement).
 *
 * - Chaque enregistrement porte `updatedAt` (horodatage de sa dernière modification, 0 = valeur par défaut).
 * - Le serveur (le PC) garde l'état fusionné et des « pierres tombales » pour les suppressions.
 * - Un appareil envoie toutes ses données + la liste des enregistrements qu'il connaissait à la
 *   dernière synchro : ce qui a disparu depuis a été supprimé sur cet appareil.
 * - En cas d'égalité (ex. valeurs par défaut sur un nouveau téléphone), la version du serveur est gardée.
 * - Une modification faite ailleurs après la dernière synchro l'emporte sur une suppression.
 */
export interface Row {
  id: string;
  updatedAt?: number;
  [k: string]: unknown;
}

export interface SyncState {
  tables: Record<string, Record<string, Row>>;
  /** « table:id » → date de suppression. */
  tombstones: Record<string, number>;
  version: number;
}

export interface SyncRequest {
  /** Heure (serveur) de la dernière synchro réussie de cet appareil, 0 si jamais. */
  lastSyncAt: number;
  /** Enregistrements (« table:id ») présents sur l'appareil à la fin de sa dernière synchro. */
  known: string[];
  tables: Record<string, Row[]>;
}

export const emptyState = (): SyncState => ({ tables: {}, tombstones: {}, version: 0 });
const keyOf = (table: string, id: string) => `${table}:${id}`;
const TOMBSTONE_TTL = 180 * 86400000;

export function mergeSync(state: SyncState, req: SyncRequest, now: number): SyncState {
  const next: SyncState = structuredClone(state);
  const sent = new Set<string>();

  for (const [table, rows] of Object.entries(req.tables)) {
    const target = (next.tables[table] ??= {});
    for (const row of rows) {
      if (typeof row?.id !== 'string') continue;
      const key = keyOf(table, row.id);
      sent.add(key);
      const ts = row.updatedAt ?? 0;
      const tomb = next.tombstones[key];
      if (tomb !== undefined && tomb >= ts) continue; // supprimé ailleurs après cette version
      const current = target[row.id];
      if (!current || ts > (current.updatedAt ?? 0)) target[row.id] = row;
      if (tomb !== undefined) delete next.tombstones[key];
    }
  }

  // Suppressions faites sur l'appareil depuis sa dernière synchro
  for (const key of req.known) {
    if (sent.has(key)) continue;
    const sep = key.indexOf(':');
    const table = key.slice(0, sep);
    const id = key.slice(sep + 1);
    const current = next.tables[table]?.[id];
    if (current && (current.updatedAt ?? 0) > req.lastSyncAt) continue; // modifié ailleurs entre-temps : on garde
    if (current) delete next.tables[table][id];
    next.tombstones[key] = now;
  }

  for (const [key, at] of Object.entries(next.tombstones)) if (now - at > TOMBSTONE_TTL) delete next.tombstones[key];
  next.version = state.version + 1;
  return next;
}

/** Liste des clés « table:id » d'un état (ce que l'appareil connaît après la synchro). */
export const stateKeys = (s: SyncState) => Object.entries(s.tables).flatMap(([t, rows]) => Object.keys(rows).map((id) => keyOf(t, id)));
