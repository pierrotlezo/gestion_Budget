/**
 * Tous les montants de l'application sont stockés en CENTIMES entiers
 * (60000 = 600,00 €) pour éviter les erreurs d'arrondi des nombres flottants.
 */
export type Cents = number;

export const toCents = (euros: number): Cents => Math.round(euros * 100);
export const fromCents = (cents: Cents): number => cents / 100;

const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eurFormatterRound = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 123456 → « 1 234,56 € » */
export function formatEUR(cents: Cents, opts: { round?: boolean; sign?: boolean } = {}): string {
  const f = opts.round ? eurFormatterRound : eurFormatter;
  const s = f.format(fromCents(cents));
  return opts.sign && cents > 0 ? `+${s}` : s;
}

/** Pourcentage : 0.017 → « 1,7 % » */
export function formatPercent(ratio: number, digits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(ratio);
}

/**
 * Lit un montant écrit « à la française » ou « à l'anglaise » et renvoie des centimes.
 * Gère : « 1 234,56 », « -12,30 € », « 1.234,56 », « 12.30 », « (45,00) », « 12,30- », « +5 ».
 * `decimal` indique le séparateur décimal attendu lorsque le texte est ambigu (ex. « 1.234 »).
 * Renvoie null si le texte n'est pas un montant.
 */
export function parseAmount(input: string, decimal: ',' | '.' = ','): Cents | null {
  let s = input.trim().replace(/[\s  ]/g, '').replace(/€|EUR/gi, '');
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let decSep: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    // « 1,234,567 » (plusieurs virgules) = séparateur de milliers anglais
    decSep = (s.match(/,/g)!.length > 1) ? null : ',';
  } else if (lastDot >= 0) {
    const multiple = s.match(/\./g)!.length > 1;
    const threeAfter = /\.\d{3}$/.test(s);
    // « 1.234 » avec un séparateur décimal attendu « , » = milliers
    decSep = multiple || (decimal === ',' && threeAfter) ? null : '.';
  }

  const thousandsSep = decSep === ',' ? '.' : ',';
  s = s.split(thousandsSep).join('');
  if (decSep === null) s = s.replace(/[.,]/g, '');
  else if (decSep === ',') s = s.replace(',', '.');

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return negative ? -cents : cents;
}

/** Valeur à afficher dans un champ de saisie : 123456 → « 1234,56 » */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
}
