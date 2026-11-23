/**
 * Dates stockées au format ISO « AAAA-MM-JJ » (tri alphabétique = tri chronologique).
 * Mois au format « AAAA-MM ». Aucun fuseau horaire : on manipule des dates calendaires.
 */
export type ISODate = string;
export type MonthKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parts(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function todayISO(): ISODate {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parts(iso);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';

/**
 * Lit une date de relevé bancaire. Pour « DD/MM/YYYY », accepte aussi « - » ou « . »
 * comme séparateur et l'année sur 2 chiffres (« 05/11/26 » → 2026-11-05).
 */
export function parseDate(input: string, format: DateFormat = 'DD/MM/YYYY'): ISODate | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  if (format === 'YYYY-MM-DD') {
    const r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (!r) return null;
    [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else {
    const r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(s);
    if (!r) return null;
    const a = Number(r[1]);
    const b = Number(r[2]);
    [d, m] = format === 'DD/MM/YYYY' ? [a, b] : [b, a];
    y = Number(r[3]);
    if (r[3].length === 2) y += 2000;
  }
  const iso = toISO(y, m, d);
  return isValidISO(iso) ? iso : null;
}

/** 2026-11-23 → « 23/11/2026 » */
export function formatDateFR(iso: ISODate): string {
  const { y, m, d } = parts(iso);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export const monthOf = (iso: ISODate): MonthKey => iso.slice(0, 7);
export const currentMonth = (): MonthKey => monthOf(todayISO());

export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function addMonthsToKey(month: MonthKey, n: number): MonthKey {
  return monthOf(addMonths(`${month}-01`, n));
}

/** Les n derniers mois, du plus ancien au plus récent, en terminant par `end`. */
export function lastMonths(end: MonthKey, n: number): MonthKey[] {
  return Array.from({ length: n }, (_, i) => addMonthsToKey(end, i - n + 1));
}

/** Nombre de mois entiers entre deux dates (b - a). */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const pa = parts(a);
  const pb = parts(b);
  return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}

export function endOfMonth(month: MonthKey): ISODate {
  const [y, m] = month.split('-').map(Number);
  return toISO(y, m, daysInMonth(y, m));
}

const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const monthShortFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

/** « 2026-11 » → « novembre 2026 » (ou « nov. 26 » en version courte) */
export function formatMonth(month: MonthKey, short = false): string {
  const [y, m] = month.split('-').map(Number);
  return (short ? monthShortFmt : monthFmt).format(new Date(y, m - 1, 1));
}

/**
 * Quinzaines (règle des livrets réglementés) : 24 par an, numérotées de 0 à 23.
 * Du 1er au 15 → quinzaine paire, du 16 à la fin du mois → quinzaine impaire.
 */
export function quinzaineOf(iso: ISODate): { year: number; index: number } {
  const { y, m, d } = parts(iso);
  return { year: y, index: (m - 1) * 2 + (d >= 16 ? 1 : 0) };
}

/** Date de début d'une quinzaine. */
export function quinzaineStart(year: number, index: number): ISODate {
  return toISO(year, Math.floor(index / 2) + 1, index % 2 === 0 ? 1 : 16);
}
