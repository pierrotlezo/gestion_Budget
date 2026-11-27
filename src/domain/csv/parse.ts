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

/**
 * Découpe le texte CSV. Si `hasHeader`, la première ligne après `skipRows` donne le nom des colonnes ;
 * sinon (relevés LCL…), les colonnes s'appellent « Colonne 1 », « Colonne 2 »…
 */
export function parseCsvTable(text: string, delimiter: string, skipRows = 0, hasHeader = true): CsvTable {
  const lines = text.split(/\r?\n/).slice(skipRows).join('\n');
  const res = Papa.parse<string[]>(lines, { delimiter, skipEmptyLines: 'greedy' });
  const data = res.data.map((r) => r.map((c) => (c ?? '').trim()));
  if (!hasHeader) {
    const width = Math.max(0, ...data.map((r) => r.length));
    return { headers: Array.from({ length: width }, (_, i) => `Colonne ${i + 1}`), rows: data };
  }
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

/** La ligne ressemble-t-elle à une opération (une date et un montant) plutôt qu'à des titres de colonnes ? */
function looksLikeData(row: string[]): boolean {
  return row.some((c) => parseDate(c) !== null) && row.some((c) => /\d/.test(c) && parseAmount(c) !== null && parseDate(c) === null);
}

/** Devine les colonnes d'après leur contenu (pour les fichiers sans en-tête). */
export function guessMappingFromContent(table: CsvTable): Partial<CsvProfile> {
  const rows = table.rows.filter((r) => r.length === table.headers.length).slice(0, 50);
  const ratio = (i: number, test: (c: string) => boolean) => {
    const filled = rows.map((r) => r[i] ?? '').filter((c) => c !== '');
    return filled.length ? filled.filter(test).length / rows.length : 0;
  };
  const cols = table.headers.map((_, i) => i);
  const dateI = cols.find((i) => ratio(i, (c) => parseDate(c) !== null) > 0.8) ?? 0;
  const amountI = cols.find((i) => i !== dateI && ratio(i, (c) => parseAmount(c) !== null && /\d/.test(c)) > 0.8) ?? 1;
  // Libellés : colonnes de texte assez longues (le type « Carte » ou la catégorie « Divers » sont trop courts)
  const labelIs = cols.filter((i) => {
    if (i === dateI || i === amountI) return false;
    const filled = rows.map((r) => r[i] ?? '').filter((c) => c !== '' && parseAmount(c) === null);
    return filled.length > 0 && filled.reduce((s, c) => s + c.length, 0) / filled.length >= 10;
  });
  return {
    dateColumn: table.headers[dateI],
    labelColumns: (labelIs.length ? labelIs : [cols.find((i) => i !== dateI && i !== amountI) ?? 2]).map((i) => table.headers[i]),
    amount: { mode: 'single', column: table.headers[amountI] },
  };
}

/** Formats de banques reconnus automatiquement (données : on peut en ajouter). */
export const BANK_FORMATS: { name: string; detect: (rows: string[][]) => boolean; mapping: Omit<CsvProfile, 'id' | 'name' | 'encoding' | 'skipRows'> }[] = [
  {
    // LCL : pas d'en-tête ; 1re et dernière lignes = solde ; Date;Montant;Type;…;Libellé (carte);Libellé (virement);…;Catégorie LCL
    name: 'LCL',
    detect: (rows) => {
      const ops = rows.filter((r) => r.length === 8 && parseDate(r[0]) !== null);
      return ops.length > 0 && ops.length >= rows.length - 3 && ops.every((r) => /^(Carte|Virement|Prélèvement|Prelevement|Chèque|Cheque|Remise|Retrait|Frais|)$/i.test(r[2]));
    },
    mapping: { delimiter: ';', hasHeader: false, dateColumn: 'Colonne 1', dateFormat: 'DD/MM/YYYY', labelColumns: ['Colonne 5', 'Colonne 6'], amount: { mode: 'single', column: 'Colonne 2' }, decimalSeparator: ',' },
  },
];

export interface DetectedFormat {
  mapping: Omit<CsvProfile, 'id' | 'name'>;
  /** Nom de la banque si le format est connu. */
  bank: string | null;
}

/** Analyse un relevé et propose la correspondance des colonnes. */
export function detectFormat(text: string, encoding: string): DetectedFormat {
  const delimiter = detectDelimiter(text);
  const raw = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' }).data.map((r) => r.map((c) => (c ?? '').trim()));
  for (const f of BANK_FORMATS) {
    if (f.mapping.delimiter === delimiter && f.detect(raw)) return { bank: f.name, mapping: { ...f.mapping, encoding, skipRows: 0 } };
  }
  // Lignes d'introduction (nom du compte…) : on part de la première ligne qui a le nombre de colonnes maximal
  const lines = text.split(/\r?\n/);
  const maxCols = Math.max(...lines.slice(0, 30).map((l) => l.split(delimiter).length));
  const skipRows = Math.max(0, lines.findIndex((l) => l.split(delimiter).length === maxCols));
  const first = parseCsvTable(text, delimiter, skipRows, false).rows[0] ?? [];
  const hasHeader = !looksLikeData(first);
  const table = parseCsvTable(text, delimiter, skipRows, hasHeader);
  const guess = hasHeader ? guessMapping(table.headers) : guessMappingFromContent(table);
  return {
    bank: null,
    mapping: { encoding, delimiter, skipRows, hasHeader, dateColumn: guess.dateColumn!, dateFormat: 'DD/MM/YYYY', labelColumns: guess.labelColumns!, amount: guess.amount!, decimalSeparator: ',' },
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
  /** Lignes ignorées car incomplètes (ex. lignes de solde en début et fin de relevé LCL). */
  skipped: number;
}

type Mapping = Pick<CsvProfile, 'dateColumn' | 'dateFormat' | 'labelColumns' | 'amount' | 'decimalSeparator' | 'hasHeader'>;

/** Transforme les lignes du CSV en transactions prêtes à importer (+ liste des lignes en erreur). */
export function mapRows(table: CsvTable, mapping: Mapping, rules: CategoryRule[] = []): MappingResult {
  const idx = (name: string) => table.headers.indexOf(name);
  const dateI = idx(mapping.dateColumn);
  const labelIs = mapping.labelColumns.map(idx).filter((i) => i >= 0);
  const drafts: DraftTransaction[] = [];
  const errors: MappingResult['errors'] = [];
  let skipped = 0;
  const width = table.headers.length;
  const offset = mapping.hasHeader === false ? 1 : 2; // numéro de ligne dans le fichier (sans compter les lignes sautées)

  table.rows.forEach((row, i) => {
    const line = i + offset;
    if (row.every((c) => c === '')) return;
    // Ligne nettement plus courte que les autres : ligne de solde ou de total, pas une opération
    if (width >= 5 && row.length < width * 0.75) {
      skipped++;
      return;
    }
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
    drafts.push({ line, date, amount, label, categoryId: findCategoryForLabel(label, rules, amount), importHash: '' });
  });

  return { drafts: withImportHashes(drafts), errors, skipped };
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
