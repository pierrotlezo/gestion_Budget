import { describe, expect, it } from 'vitest';
import type { CategoryRule } from '../../db/schema';
import { decodeFile, detectFormat, mapRows, parseCsvTable } from './parse';
import { findCategoryForLabel } from '../rules/categorize';

// Relevé fictif au format exact d'un export LCL (UTF-8 avec BOM, sans en-tête, soldes en 1re et dernière lignes)
const LCL = '﻿' + [
  '01/11/2026;229,66;;01234 012345X',
  '01/11/2026;250;Virement;;;VIR.PERMANENT DUPONT;;',
  "02/11/2026;-20,01;Carte;;CB  VL INTERMARCHE   01/11/26;;0;Divers",
  "02/11/2026;-3;Carte;;CB  CAFE DU COIN      01/11/26;;0;Divers",
  '02/11/2026;600;Virement;;;VIREMENT M JEAN EXEMPLE;;',
  '06/11/2026;-50;Virement;;;PRLV SEPA TotalEnergies Electri;;',
  '09/11/2026;-400;Virement;;;VIR SEPA M JEAN EXEMPLE;;',
  '19/11/2026;-2,25;;;ASSURANCE MOYEN DE PAIEMENT;;;',
  '23/11/2026;-7,97;Prélèvement;;ECHEANCE PRET PERSONNEL 231126;;;',
  '26/11/2026;-1,2;Carte;;CB  SUMUP  *ASSO ETUD 24/11/26;;0;Divers',
  '26/11/2026;197,67;;01234 012345X',
].join('\r\n');

describe('relevé LCL', () => {
  const bytes = new TextEncoder().encode(LCL);
  const { text, encoding } = decodeFile(bytes.buffer);

  it('reconnaît le format LCL (sans en-tête, libellé sur 2 colonnes)', () => {
    const f = detectFormat(text, encoding);
    expect(f.bank).toBe('LCL');
    expect(f.mapping).toMatchObject({ delimiter: ';', hasHeader: false, dateColumn: 'Colonne 1', labelColumns: ['Colonne 5', 'Colonne 6'], amount: { mode: 'single', column: 'Colonne 2' } });
  });

  it('importe les 9 opérations et ignore les 2 lignes de solde', () => {
    const f = detectFormat(text, encoding);
    const table = parseCsvTable(text, f.mapping.delimiter, f.mapping.skipRows, f.mapping.hasHeader);
    const { drafts, errors, skipped } = mapRows(table, f.mapping, []);
    expect(errors).toEqual([]);
    expect(skipped).toBe(2);
    expect(drafts).toHaveLength(9);
    expect(drafts[0]).toMatchObject({ date: '2026-11-01', amount: 25000, label: 'VIR.PERMANENT DUPONT' });
    expect(drafts[1]).toMatchObject({ amount: -2001, label: 'CB VL INTERMARCHE 01/11/26' });
    expect(drafts.find((d) => d.label.startsWith('ASSURANCE'))?.amount).toBe(-225);
    expect(drafts.reduce((s, d) => s + d.amount, 0)).toBe(36557); // somme des opérations fictives
  });

  it('sans format connu, devine les colonnes d’après le contenu', () => {
    const generic = 'Mon compte\n05/11/2026;-12,50;Carte;CB BOULANGERIE DU PARC\n06/11/2026;600,00;Virement;VIREMENT RECU DE MAMAN\n';
    const f = detectFormat(generic, 'utf-8');
    expect(f.bank).toBeNull();
    expect(f.mapping).toMatchObject({ skipRows: 1, hasHeader: false, dateColumn: 'Colonne 1', amount: { column: 'Colonne 2' }, labelColumns: ['Colonne 4'] });
  });

  it('avec en-tête, garde la détection par nom de colonne', () => {
    const f = detectFormat('Date;Libellé;Montant\n03/11/2026;CB CARREFOUR;-23,45\n', 'utf-8');
    expect(f.mapping).toMatchObject({ hasHeader: true, dateColumn: 'Date', labelColumns: ['Libellé'] });
  });
});

describe('règles avec sens (entrées / sorties)', () => {
  const rules: CategoryRule[] = [
    { id: 'a', pattern: 'JEAN EXEMPLE', match: 'contains', categoryId: 'virement-livret', priority: 0, direction: 'in' },
    { id: 'b', pattern: 'JEAN EXEMPLE', match: 'contains', categoryId: 'epargne', priority: 1, direction: 'out' },
  ];
  it('un même nom va dans deux catégories selon le sens du virement', () => {
    expect(findCategoryForLabel('VIREMENT M JEAN EXEMPLE', rules, 60000)).toBe('virement-livret');
    expect(findCategoryForLabel('VIR SEPA M JEAN EXEMPLE', rules, -40000)).toBe('epargne');
    expect(findCategoryForLabel('VIR SEPA M JEAN EXEMPLE', rules)).toBe('virement-livret'); // sans montant : premier trouvé
  });
});
