import type { RatePeriod, SavingsAccount, SavingsType, Settings } from '../../db/schema';
import type { Cents } from '../money';

export const SAVINGS_TYPE_LABELS: Record<SavingsType, string> = {
  livretA: 'Livret A',
  ldds: 'LDDS',
  lep: 'LEP',
  other: 'Autre',
};

/** Historique des taux applicable : celui du compte, ou celui du Livret A (Paramètres). */
export function effectiveRates(account: SavingsAccount, settings: Settings): RatePeriod[] {
  return account.rates ?? settings.livretARates;
}

/** Plafond applicable : celui des Paramètres pour un Livret A, sinon celui du compte. */
export function effectiveCeiling(account: SavingsAccount, settings: Settings): Cents | null {
  return account.type === 'livretA' ? settings.livretACeiling : account.ceiling;
}
