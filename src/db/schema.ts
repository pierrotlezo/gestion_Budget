/** Horodatage de la dernière modification (synchro PC ↔ téléphone), 0 = valeur par défaut. */
interface Synced {
  updatedAt?: number;
}

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

export interface Settings extends Synced {
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
  /** Mise à jour automatique des cours (seuls les symboles sont envoyés, jamais les montants). */
  autoPrices: boolean;
  /** Affichage des bons plans du moment (téléchargement des flux publics Dealabs, rien n'est envoyé). */
  autoDeals: boolean;
  /** Plan « Mon prêt » : ce que je prélève chaque mois sur l'argent du prêt, et pendant combien de temps. */
  loanPlan: LoanPlanSettings;
  /** Ville pour les bons plans locaux. */
  city: string;
  /** Types de notifications envoyées sur le téléphone. */
  notifications: { budget: boolean; game: boolean; weekly: boolean; deals: boolean };
}

export interface LoanPlanSettings {
  monthlyDraw: Cents;
  drawYears: number;
  /** Argent du prêt disponible aujourd'hui. null = solde des comptes alimentés par le prêt. */
  availableOverride: Cents | null;
  /** Les intérêts et l'assurance du différé sont-ils payés avec l'argent du prêt ? */
  payDeferralFromSavings: boolean;
}

export type CategoryKind = 'expense' | 'income' | 'savings';

export interface Category extends Synced {
  id: string;
  name: string;
  color: string;
  /** Budget mensuel en centimes (0 = pas de budget). Pour un revenu : montant attendu. */
  monthlyBudget: Cents;
  kind: CategoryKind;
  order: number;
  /** Emoji affiché sur la tuile de la catégorie. */
  icon?: string;
  /** Flux de bons plans Dealabs associés (ex. « epicerie ») pour les promotions du moment. */
  dealFeeds?: string[];
  isDemo?: boolean;
}

export interface Transaction extends Synced {
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

export interface CategoryRule extends Synced {
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
export interface CsvProfile extends Synced {
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

export interface Loan extends Synced {
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

export interface SavingsAccount extends Synced {
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

export interface SavingsMovement extends Synced {
  id: string;
  accountId: string;
  date: ISODate;
  /** + versement, − retrait. Les intérêts annuels sont un versement au 31/12. */
  amount: Cents;
  label: string;
  kind?: 'deposit' | 'withdrawal' | 'interest';
  isDemo?: boolean;
}

/* ───────────── Épargne & investissement (version 2 de la base) ───────────── */

export type InvestmentEnvelope = 'pea' | 'cto' | 'crypto' | 'assuranceVie' | 'per' | 'other';

/** Un placement : un ETF dans un PEA, du bitcoin, un fonds euros d'assurance-vie… */
export interface Investment extends Synced {
  id: string;
  name: string;
  envelope: InvestmentEnvelope;
  /** Symbole Yahoo (« CW8.PA ») ou identifiant CoinGecko (« bitcoin »). */
  symbol?: string;
  /** D'où vient le cours : automatique (Yahoo / CoinGecko) ou valorisation saisie à la main. */
  priceSource: 'yahoo' | 'coingecko' | 'manual';
  color: string;
  isDemo?: boolean;
}

export interface InvestmentOperation extends Synced {
  id: string;
  investmentId: string;
  date: ISODate;
  /** Achat, vente, ou valorisation (valeur totale constatée, pour les placements sans cours). */
  kind: 'buy' | 'sell' | 'valuation';
  /** Nombre de parts / de BTC (achats et ventes de placements cotés). */
  quantity?: number;
  /** Montant payé, reçu, ou valeur totale (valorisation). Toujours positif. */
  amount: Cents;
  note?: string;
  isDemo?: boolean;
}

/** Dernier cours connu (cache local). id = « yahoo:CW8.PA » ou « coingecko:bitcoin ». */
export interface PriceQuote extends Synced {
  id: string;
  /** Prix d'une unité, en euros. */
  price: number;
  fetchedAt: string;
}

export interface SavingsGoal extends Synced {
  id: string;
  name: string;
  icon: string;
  target: Cents;
  deadline?: ISODate;
  /** Placements et livrets dont la valeur compte pour l'objectif. Vide = montant saisi à la main. */
  sources: { kind: 'investment' | 'savings'; id: string }[];
  manualAmount: Cents;
  monthlyContribution: Cents;
  /** Rendement annuel supposé (0 pour un livret à taux faible). */
  annualReturn: number;
  /** Paliers déjà fêtés (25, 50, 75, 100) pour ne célébrer qu'une fois. */
  milestonesCelebrated?: number[];
  isDemo?: boolean;
}

/** Ce que j'ai fait d'une astuce d'économie. */
export interface TipState extends Synced {
  /** Identifiant de l'astuce (catalogue). */
  id: string;
  status: 'trying' | 'done' | 'dismissed';
}

/** Scénario du simulateur d'intérêts composés. */
export interface SimScenario extends Synced {
  id: string;
  name: string;
  initial: Cents;
  monthly: Cents;
  years: number;
  annualReturn: number;
  color: string;
}
