/**
 * Données de démonstration : 12 mois de transactions réalistes + mouvements du Livret A.
 * Tout est marqué `isDemo: true` et s'efface en un clic sans toucher aux vraies données.
 */
import { db, newId, type BudgetDB } from './db';
import type { CategoryRule, Investment, InvestmentOperation, RatePeriod, SavingsGoal, SavingsMovement, Transaction } from './schema';
import { yearInterest } from '../domain/savings/quinzaine';
import { DEFAULT_LIVRET_A_ID, LIVRET_A_RATES } from './defaults';
import { addMonthsToKey, daysInMonth, lastMonths, monthOf, parts, todayISO, toISO, type ISODate } from '../domain/dates';
import { findCategoryForLabel } from '../domain/rules/categorize';
import { withImportHashes } from '../domain/csv/parse';

/** Générateur pseudo-aléatoire déterministe (mêmes données à chaque chargement). */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function generateDemoTransactions(today: ISODate, rules: CategoryRule[]): Transaction[] {
  const rand = seeded(42);
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const out: Omit<Transaction, 'id' | 'importHash'>[] = [];

  for (const month of lastMonths(monthOf(today), 12)) {
    const [y, m] = month.split('-').map(Number);
    const day = (d: number) => toISO(y, m, Math.min(d, daysInMonth(y, m)));
    const add = (d: number, label: string, amount: number, categoryId?: string | null) => {
      const date = day(d);
      if (date > today) return;
      out.push({ date, label, amount, categoryId: categoryId === undefined ? findCategoryForLabel(label, rules, amount) : categoryId, source: 'csv', isDemo: true });
    };

    add(1, 'VIR INST LIVRET A', 60000, 'cat-virement-livret');
    add(2, 'VIREMENT RECU PARENTS', 25000, 'cat-parents');
    add(3, 'PRLV SEPA LOYER RESIDENCE', -43000);
    add(6, 'PRLV SEPA EDF CLIENTS PARTICULIERS', -between(32, 45));
    add(5, 'PRLV SEPA FREE MOBILE', -1599);
    // Hausse de prix le dernier mois, pour montrer l'alerte « abonnement plus cher »
    add(10, 'PRLV SEPA NETFLIX.COM', month === monthOf(today) ? -1499 : -1349);
    add(12, 'PRLV SEPA SPOTIFY', -1217);

    const shops = ['CB CARREFOUR CITY', 'CB LIDL', 'CB AUCHAN', 'CB CARREFOUR MARKET', 'CB MONOPRIX'];
    const groceries = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < groceries; k++) add(2 + Math.floor((k * 26) / groceries + rand() * 3), pick(shops), -between(24, 62));

    if (rand() < 0.8) add(8 + Math.floor(rand() * 15), pick(['CB SNCF CONNECT', 'CB OUIGO']), -between(15, 49));
    // Achat programmé de bitcoin (voir les placements de démo) : classé en Épargne par la règle COINBASE
    if (month >= addMonthsToKey(monthOf(today), -7)) add(15, 'PRLV SEPA COINBASE EUROPE', -2500);
    if (rand() < 0.6) add(14 + Math.floor(rand() * 10), 'CB CINEMA PATHE', -1150, 'cat-divertissement');
    if (rand() < 0.4) add(18 + Math.floor(rand() * 8), 'CB FNAC', -between(12, 40), 'cat-divertissement');
    // Quelques opérations non catégorisées, pour tester la suggestion de règle
    if (rand() < 0.7) add(9 + Math.floor(rand() * 15), 'CB BOULANGERIE DU MARCHE', -between(3, 9), null);
    if (rand() < 0.3) add(20, 'CB PHARMACIE CENTRALE', -between(5, 20), null);
  }
  return withImportHashes(out.sort((a, b) => a.date.localeCompare(b.date))).map((t) => ({ ...t, id: newId(), importHash: `demo|${t.importHash}` }));
}

export function generateDemoMovements(today: ISODate, accountId: string, transferDay: number, rates: RatePeriod[] = LIVRET_A_RATES, notBefore?: ISODate): SavingsMovement[] {
  // Fonds placés il y a 11 mois (au plafond, et pas avant le déblocage du prêt), puis retraits mensuels de 600 €
  let depositDate = `${addMonthsToKey(monthOf(today), -11)}-05`;
  if (notBefore && notBefore > depositDate && notBefore <= today) depositDate = notBefore;
  const start = monthOf(depositDate);
  const moves: SavingsMovement[] = [{ id: newId(), accountId, date: depositDate, amount: 2295000, label: 'Versement (fonds du prêt)', kind: 'deposit', isDemo: true }];
  for (let k = 1; k <= 11; k++) {
    const date = `${addMonthsToKey(start, k)}-${String(Math.min(transferDay, 28)).padStart(2, '0')}`;
    if (date <= today) moves.push({ id: newId(), accountId, date, amount: -60000, label: 'Virement vers compte courant', kind: 'withdrawal', isDemo: true });
  }
  // Intérêts de l'année précédente si le versement date de l'an dernier
  const lastYear = parts(today).y - 1;
  if (parts(depositDate).y <= lastYear) {
    const interest = yearInterest(moves, rates, lastYear).interest;
    moves.push({ id: newId(), accountId, date: toISO(lastYear, 12, 31), amount: interest, label: `Intérêts ${lastYear}`, kind: 'interest', isDemo: true });
  }
  return moves;
}

/** Placements fictifs : achats programmés de BTC et d'un ETF Monde sur le PEA. */
export function generateDemoInvestments(today: ISODate): { investments: Investment[]; ops: InvestmentOperation[]; goals: SavingsGoal[] } {
  const btc: Investment = { id: 'demo-btc', name: 'Bitcoin', envelope: 'crypto', symbol: 'bitcoin', priceSource: 'coingecko', color: '#eda100', isDemo: true };
  const etf: Investment = { id: 'demo-cw8', name: 'Amundi MSCI World (CW8)', envelope: 'pea', symbol: 'CW8.PA', priceSource: 'yahoo', color: '#2a78d6', isDemo: true };
  const ops: InvestmentOperation[] = [];
  const months = lastMonths(monthOf(today), 8);
  months.forEach((m, k) => {
    const date = `${m}-15`;
    if (date > today) return;
    // Cours fictifs proches des cours réels, pour que les quantités soient réalistes
    const btcPrice = 52000 + k * 600;
    const etfPrice = 640 + k * 5;
    ops.push({ id: newId(), investmentId: btc.id, date, kind: 'buy', amount: 2500, quantity: Math.round((25 / btcPrice) * 1e8) / 1e8, isDemo: true });
    ops.push({ id: newId(), investmentId: etf.id, date, kind: 'buy', amount: 5000, quantity: Math.round((50 / etfPrice) * 1e4) / 1e4, isDemo: true });
  });
  const goals: SavingsGoal[] = [
    { id: 'demo-goal-precaution', name: 'Épargne de précaution', icon: '🛟', target: 300000, sources: [], manualAmount: 120000, monthlyContribution: 10000, annualReturn: 0, isDemo: true },
    { id: 'demo-goal-btc', name: '1 000 € en bitcoin', icon: '₿', target: 100000, sources: [{ kind: 'investment', id: btc.id }], manualAmount: 0, monthlyContribution: 2500, annualReturn: 0, isDemo: true },
  ];
  return { investments: [btc, etf], ops, goals };
}

export async function loadDemo(database: BudgetDB = db): Promise<{ transactions: number; movements: number; investments: number }> {
  await clearDemo(database);
  const today = todayISO();
  const rules = await database.rules.toArray();
  const settings = await database.settings.get('app');
  const account = (await database.savingsAccounts.get(settings?.transferAccountId ?? DEFAULT_LIVRET_A_ID)) ?? (await database.savingsAccounts.toCollection().first());
  const loan = account?.fundedByLoanId ? await database.loans.get(account.fundedByLoanId) : undefined;
  const transactions = generateDemoTransactions(today, rules);
  const movements = account ? generateDemoMovements(today, account.id, settings?.transferDay ?? 1, account.rates ?? settings?.livretARates, loan?.startDate) : [];
  const inv = generateDemoInvestments(today);
  await database.transaction('rw', [database.transactions, database.savingsMovements, database.investments, database.investmentOps, database.goals], async () => {
    await database.transactions.bulkAdd(transactions);
    await database.savingsMovements.bulkAdd(movements);
    await database.investments.bulkAdd(inv.investments);
    await database.investmentOps.bulkAdd(inv.ops);
    await database.goals.bulkAdd(inv.goals);
  });
  return { transactions: transactions.length, movements: movements.length, investments: inv.investments.length };
}

/** Supprime toutes les données marquées « démo », dans toutes les tables. */
export async function clearDemo(database: BudgetDB = db): Promise<number> {
  let count = 0;
  const tables = [database.transactions, database.savingsMovements, database.categories, database.rules, database.savingsAccounts, database.loans, database.investments, database.investmentOps, database.goals];
  await database.transaction('rw', tables, async () => {
    for (const t of tables) count += await (t as typeof database.transactions).filter((r) => r.isDemo === true).delete();
  });
  return count;
}

export async function countDemo(database: BudgetDB = db): Promise<number> {
  const counts = await Promise.all(
    [database.transactions, database.savingsMovements, database.investments, database.investmentOps, database.goals].map((t) => (t as typeof database.transactions).filter((r) => r.isDemo === true).count()),
  );
  return counts.reduce((a, b) => a + b, 0);
}
