/**
 * Modèle de données de l'application.
 * Conventions : montants en centimes entiers, dates « AAAA-MM-JJ », taux en décimal (0.017 = 1,7 %).
 * `isDemo` marque les données de démonstration pour pouvoir les effacer en un clic.
 */
import type { Cents } from '../domain/money';
import type { DateFormat, ISODate } from '../domain/dates';

/** Un taux applicable à partir d'une date (historique de taux). */
export interface RatePeriod {
  from: ISODate;
  rate: number;
}

export interface Settings {
  id: 'app';
  /** Virement mensuel du Livret A vers le compte courant (loyer, électricité). */
  monthlyTransfer: Cents;
  /** Jour du mois où ce virement est fait (sert à projeter les intérêts du livret). */
  transferDay: number;
  /** Compte d'épargne d'où part le virement mensuel. */
  transferAccountId: string | null;
  /** Montant donné par les parents (alimentation et trains). */
  parentsAllowance: Cents;
  /** Plafond du Livret A (et des comptes qui suivent le Livret A). */
  livretACeiling: Cents;
  /** Historique des taux du Livret A (le LDDS suit le même taux). */
  livretARates: RatePeriod[];
}

export type CategoryKind = 'expense' | 'income' | 'savings';

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Budget mensuel en centimes (0 = pas de budget). Pour un revenu : montant attendu. */
  monthlyBudget: Cents;
  kind: CategoryKind;
  order: number;
  isDemo?: boolean;
}

export interface Transaction {
  id: string;
  date: ISODate;
  /** Montant signé : négatif = dépense, positif = entrée d'argent. */
  amount: Cents;
  label: string;
  categoryId: string | null;
  note?: string;
  source: 'manual' | 'csv';
  /** Empreinte pour éviter d'importer deux fois la même ligne d'un relevé. */
  importHash?: string;
  isDemo?: boolean;
}

export interface CategoryRule {
  id: string;
  /** Texte recherché dans le libellé (sans tenir compte des majuscules ni des accents). */
  pattern: string;
  match: 'contains';
  categoryId: string;
  /** Plus petit = testé en premier. */
  priority: number;
  isDemo?: boolean;
}

export type AmountMapping =
  | { mode: 'single'; column: string }
  | { mode: 'debitCredit'; debit: string; credit: string };

/** Format de relevé CSV mémorisé pour une banque. */
export interface CsvProfile {
  id: string;
  name: string;
  delimiter: string;
  skipRows: number;
  dateColumn: string;
  dateFormat: DateFormat;
  labelColumns: string[];
  amount: AmountMapping;
  decimalSeparator: ',' | '.';
  encoding: string;
}

export type DeferralType = 'none' | 'partial' | 'total';

export interface Loan {
  id: string;
  name: string;
  principal: Cents;
  annualRate: number;
  /** Durée de remboursement en mois, HORS différé. */
  durationMonths: number;
  /** Date de déblocage des fonds. La 1re échéance tombe un mois après. */
  startDate: ISODate;
  /** Mensualité imposée par la banque (sinon calculée). Hors assurance. */
  monthlyPaymentOverride?: Cents;
  monthlyInsurance: Cents;
  /**
   * Différé : « partial » = on ne paie que les intérêts (et l'assurance),
   * « total » = on ne paie rien (sauf l'assurance), les intérêts s'ajoutent au capital.
   */
  deferral: { type: DeferralType; months: number };
  isDemo?: boolean;
}

export type SavingsType = 'livretA' | 'ldds' | 'lep' | 'other';

export interface SavingsAccount {
  id: string;
  name: string;
  type: SavingsType;
  /** null = suit l'historique des taux du Livret A (Paramètres). */
  rates: RatePeriod[] | null;
  /** Plafond en centimes. Ignoré pour un Livret A (plafond des Paramètres). null = pas de plafond. */
  ceiling: Cents | null;
  /** Compte alimenté par ce prêt (pour la carte de comparaison prêt / épargne). */
  fundedByLoanId?: string;
  isDemo?: boolean;
}

export interface SavingsMovement {
  id: string;
  accountId: string;
  date: ISODate;
  /** + versement, − retrait. Les intérêts annuels sont un versement au 31/12. */
  amount: Cents;
  label: string;
  kind?: 'deposit' | 'withdrawal' | 'interest';
  isDemo?: boolean;
}
