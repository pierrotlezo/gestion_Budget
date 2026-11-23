/**
 * Lecture des relevés bancaires CSV. Chaque banque a son format : la correspondance des
 * colonnes est décrite par un CsvProfile (choisi dans l'écran d'import).
 */
import Papa from 'papaparse';
import type { CategoryRule, CsvProfile } from '../../db/schema';
import { parseAmount, type Cents } from '../money';
import { parseDate, type ISODate } from '../dates';
import { findCategoryForLabel, normalizeLabel } from '../rules/categorize';

/** Décode le fichier : UTF-8 si valide, sinon Windows-1252 (fréquent dans les banques françaises). */
export function decodeFile(buffer: ArrayBuffer, encoding = 'auto'): { text: string; encoding: string } {
  if (encoding === 'auto') {
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, ''), encoding: 'utf-8' };
    } catch {
      return { text: new TextDecoder('windows-1252').decode(buffer), encoding: 'windows-1252' };
    }
  }
  return { text: new TextDecoder(encoding).decode(buffer).replace(/^﻿/, ''), encoding };
}

/** Devine le séparateur le plus fréquent dans les premières lignes. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n');
  const counts = [';', ',', '\t'].map((d) => ({ d, n: sample.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/** Découpe le texte CSV. La première ligne après `skipRows` sert d'en-têtes. */
export function parseCsvTable(text: string, delimiter: string, skipRows = 0): CsvTable {
  const lines = text.split(/\r?\n/).slice(skipRows).join('\n');
  const res = Papa.parse<string[]>(lines, { delimiter, skipEmptyLines: 'greedy' });
  const data = res.data.map((r) => r.map((c) => (c ?? '').trim()));
  const rawHeaders = data[0] ?? [];
  // En-têtes uniques et non vides (sinon impossible de les sélectionner)
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const base = h || `Colonne ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  return { headers, rows: data.slice(1) };
}

/** Propose une correspondance de colonnes d'après le nom des en-têtes. */
export function guessMapping(headers: string[]): Partial<CsvProfile> {
  const used = new Set<string>();
  /** Premier en-tête non encore attribué qui correspond, en essayant les motifs par ordre de priorité. */
  const find = (...patterns: RegExp[]) => {
    for (const re of patterns) {
      const h = headers.find((x) => !used.has(x) && re.test(normalizeLabel(x)));
      if (h) {
        used.add(h);
        return h;
      }
    }
    return undefined;
  };
  const date = find(/DATE.*OP/, /^DATE$/, /DATE/);
  const debit = find(/DEBIT/);
  const credit = find(/CREDIT/);
  const amount = debit && credit ? undefined : find(/MONTANT/, /AMOUNT|SOMME|VALEUR$/);
  const label = find(/LIBELLE/, /DESCRIPTION|INTITULE|LABEL/, /OPERATION|NATURE|DETAIL/);
  return {
    dateColumn: date ?? headers[0],
    labelColumns: label ? [label] : headers.filter((h) => !used.has(h)).slice(0, 1),
    amount: debit && credit ? { mode: 'debitCredit', debit, credit } : { mode: 'single', column: amount ?? headers[headers.length - 1] },
  };
}

export interface DraftTransaction {
  line: number;
  date: ISODate;
  amount: Cents;
  label: string;
  categoryId: string | null;
  importHash: string;
}

export interface MappingResult {
  drafts: DraftTransaction[];
  errors: { line: number; message: string }[];
}

type Mapping = Pick<CsvProfile, 'dateColumn' | 'dateFormat' | 'labelColumns' | 'amount' | 'decimalSeparator'>;

/** Transforme les lignes du CSV en transactions prêtes à importer (+ liste des lignes en erreur). */
export function mapRows(table: CsvTable, mapping: Mapping, rules: CategoryRule[] = []): MappingResult {
  const idx = (name: string) => table.headers.indexOf(name);
  const dateI = idx(mapping.dateColumn);
  const labelIs = mapping.labelColumns.map(idx).filter((i) => i >= 0);
  const drafts: DraftTransaction[] = [];
  const errors: MappingResult['errors'] = [];

  table.rows.forEach((row, i) => {
    const line = i + 2; // +1 pour l'en-tête, +1 car les lignes commencent à 1
    if (row.every((c) => c === '')) return;
    const date = dateI >= 0 ? parseDate(row[dateI] ?? '', mapping.dateFormat) : null;
    if (!date) return errors.push({ line, message: `Date illisible : « ${row[dateI] ?? ''} »` });

    let amount: Cents | null;
    if (mapping.amount.mode === 'single') {
      amount = parseAmount(row[idx(mapping.amount.column)] ?? '', mapping.decimalSeparator);
    } else {
      const debit = parseAmount(row[idx(mapping.amount.debit)] ?? '', mapping.decimalSeparator);
      const credit = parseAmount(row[idx(mapping.amount.credit)] ?? '', mapping.decimalSeparator);
      amount = debit === null && credit === null ? null : Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
    }
    if (amount === null) return errors.push({ line, message: 'Montant illisible' });
    if (amount === 0) return;

    const label = labelIs.map((j) => row[j]).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || '(sans libellé)';
    drafts.push({ line, date, amount, label, categoryId: findCategoryForLabel(label, rules), importHash: '' });
  });

  return { drafts: withImportHashes(drafts), errors };
}

/**
 * Empreinte d'une ligne : date + montant + libellé + numéro d'occurrence.
 * Deux achats identiques le même jour restent distincts, mais réimporter le même relevé
 * (ou un relevé qui chevauche le précédent) ne crée pas de doublons.
 */
export function withImportHashes<T extends { date: string; amount: number; label: string }>(items: T[]): (T & { importHash: string })[] {
  const seen = new Map<string, number>();
  return items.map((t) => {
    const base = `${t.date}|${t.amount}|${normalizeLabel(t.label)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...t, importHash: `${base}|${n}` };
  });
}

/** Génère un CSV (séparateur « ; », virgule décimale) lisible par Excel / LibreOffice en français. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}
