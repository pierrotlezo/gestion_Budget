import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db, newId } from '../../../db/db';
import type { CsvProfile } from '../../../db/schema';
import { useCategories, useRules } from '../../../hooks/data';
import { decodeFile, detectDelimiter, guessMapping, mapRows, parseCsvTable } from '../../../domain/csv/parse';
import { formatDateFR } from '../../../domain/dates';
import { formatEUR } from '../../../domain/money';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Table } from '../../../components/ui';
import { importDrafts } from '../transactionService';

type Mapping = Omit<CsvProfile, 'id' | 'name'>;

const DELIMITERS = [
  { v: ';', l: 'Point-virgule (;)' },
  { v: ',', l: 'Virgule (,)' },
  { v: '\t', l: 'Tabulation' },
];

export function CsvImportPage() {
  const navigate = useNavigate();
  const rules = useRules();
  const categories = useCategories();
  const profiles = useLiveQuery(() => db.csvProfiles.toArray(), []) ?? [];
  const [fileName, setFileName] = useState('');
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [profileName, setProfileName] = useState('');
  const [result, setResult] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const text = useMemo(() => (buffer && mapping ? decodeFile(buffer, mapping.encoding).text : ''), [buffer, mapping?.encoding]);
  const table = useMemo(() => (mapping && text ? parseCsvTable(text, mapping.delimiter, mapping.skipRows) : null), [text, mapping?.delimiter, mapping?.skipRows]);
  const mapped = useMemo(() => (table && mapping ? mapRows(table, mapping, rules) : null), [table, mapping, rules]);
  const existing = useLiveQuery(async () => {
    if (!mapped) return new Set<string>();
    const found = await db.transactions.where('importHash').anyOf(mapped.drafts.map((d) => d.importHash)).toArray();
    return new Set(found.map((t) => t.importHash));
  }, [mapped]);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const { text, encoding } = decodeFile(buf);
    const delimiter = detectDelimiter(text);
    // Saute les lignes d'introduction (nom du compte…) : on cherche la première ligne avec assez de colonnes
    const lines = text.split(/\r?\n/);
    const maxCols = Math.max(...lines.slice(0, 30).map((l) => l.split(delimiter).length));
    const skipRows = Math.max(0, lines.findIndex((l) => l.split(delimiter).length === maxCols));
    const headers = parseCsvTable(text, delimiter, skipRows).headers;
    const guess = guessMapping(headers);
    setFileName(file.name);
    setBuffer(buf);
    setResult('');
    setMapping({
      encoding,
      delimiter,
      skipRows,
      dateColumn: guess.dateColumn!,
      dateFormat: 'DD/MM/YYYY',
      labelColumns: guess.labelColumns!,
      amount: guess.amount!,
      decimalSeparator: ',',
    });
  };

  const applyProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const { id: _id, name, ...m } = p;
    setMapping(m);
    setProfileName(name);
  };

  const set = <K extends keyof Mapping>(k: K, v: Mapping[K]) => setMapping((m) => (m ? { ...m, [k]: v } : m));

  const doImport = async () => {
    if (!mapped || !mapping) return;
    setBusy(true);
    if (profileName.trim()) {
      const same = profiles.find((p) => p.name === profileName.trim());
      await db.csvProfiles.put({ ...mapping, id: same?.id ?? newId(), name: profileName.trim() });
    }
    const r = await importDrafts(mapped.drafts);
    setBusy(false);
    setResult(`${r.imported} transaction(s) importée(s)${r.duplicates ? `, ${r.duplicates} doublon(s) ignoré(s)` : ''}.`);
  };

  const catName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name : null);
  const headers = table?.headers ?? [];
  const newCount = mapped ? mapped.drafts.filter((d) => !existing?.has(d.importHash)).length : 0;

  return (
    <div>
      <PageHeader title="Importer un relevé CSV" subtitle="Le fichier est lu dans le navigateur : il n'est envoyé nulle part." />

      <Card title="1. Fichier" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Relevé bancaire (.csv)">
            <Input type="file" accept=".csv,.txt,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </Field>
          {profiles.length > 0 && buffer && (
            <Field label="Format enregistré">
              <Select defaultValue="" onChange={(e) => applyProfile(e.target.value)}>
                <option value="">— Choisir une banque —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {fileName && <p className="mt-2 text-xs text-slate-500">{fileName} · encodage détecté : {mapping?.encoding}</p>}
      </Card>

      {mapping && table && (
        <Card title="2. Correspondance des colonnes" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Séparateur">
              <Select value={mapping.delimiter} onChange={(e) => set('delimiter', e.target.value)}>
                {DELIMITERS.map((d) => (
                  <option key={d.v} value={d.v}>{d.l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Lignes à ignorer au début">
              <Input type="number" min={0} value={mapping.skipRows} onChange={(e) => set('skipRows', Math.max(0, Number(e.target.value) || 0))} />
            </Field>
            <Field label="Encodage">
              <Select value={mapping.encoding} onChange={(e) => set('encoding', e.target.value)}>
                <option value="utf-8">UTF-8</option>
                <option value="windows-1252">Windows-1252 (ANSI)</option>
                <option value="iso-8859-1">ISO-8859-1</option>
              </Select>
            </Field>
            <Field label="Séparateur décimal">
              <Select value={mapping.decimalSeparator} onChange={(e) => set('decimalSeparator', e.target.value as ',' | '.')}>
                <option value=",">Virgule (12,50)</option>
                <option value=".">Point (12.50)</option>
              </Select>
            </Field>
            <Field label="Colonne date">
              <Select value={mapping.dateColumn} onChange={(e) => set('dateColumn', e.target.value)}>
                {headers.map((h) => <option key={h}>{h}</option>)}
              </Select>
            </Field>
            <Field label="Format de date">
              <Select value={mapping.dateFormat} onChange={(e) => set('dateFormat', e.target.value as Mapping['dateFormat'])}>
                <option value="DD/MM/YYYY">JJ/MM/AAAA</option>
                <option value="YYYY-MM-DD">AAAA-MM-JJ</option>
                <option value="MM/DD/YYYY">MM/JJ/AAAA</option>
              </Select>
            </Field>
            <Field label="Montant">
              <Select
                value={mapping.amount.mode}
                onChange={(e) =>
                  set('amount', e.target.value === 'single' ? { mode: 'single', column: headers[headers.length - 1] } : { mode: 'debitCredit', debit: headers[headers.length - 2], credit: headers[headers.length - 1] })
                }
              >
                <option value="single">Une colonne (signée)</option>
                <option value="debitCredit">Deux colonnes Débit / Crédit</option>
              </Select>
            </Field>
            {mapping.amount.mode === 'single' ? (
              <Field label="Colonne montant">
                <Select value={mapping.amount.column} onChange={(e) => set('amount', { mode: 'single', column: e.target.value })}>
                  {headers.map((h) => <option key={h}>{h}</option>)}
                </Select>
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Débit">
                  <Select value={mapping.amount.debit} onChange={(e) => mapping.amount.mode === 'debitCredit' && set('amount', { ...mapping.amount, debit: e.target.value })}>
                    {headers.map((h) => <option key={h}>{h}</option>)}
                  </Select>
                </Field>
                <Field label="Crédit">
                  <Select value={mapping.amount.credit} onChange={(e) => mapping.amount.mode === 'debitCredit' && set('amount', { ...mapping.amount, credit: e.target.value })}>
                    {headers.map((h) => <option key={h}>{h}</option>)}
                  </Select>
                </Field>
              </div>
            )}
          </div>
          <div className="mt-3 text-sm">
            <div className="mb-1 font-medium text-slate-700 dark:text-slate-300">Colonne(s) du libellé</div>
            <div className="flex flex-wrap gap-3">
              {headers.map((h) => (
                <label key={h} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={mapping.labelColumns.includes(h)}
                    onChange={(e) => set('labelColumns', e.target.checked ? [...mapping.labelColumns, h] : mapping.labelColumns.filter((x) => x !== h))}
                  />
                  {h}
                </label>
              ))}
            </div>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-slate-500">Voir le fichier brut (5 premières lignes)</summary>
            <Table>
              <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </Table>
          </details>
        </Card>
      )}

      {mapped && (
        <Card title="3. Aperçu et import">
          {mapped.errors.length > 0 && (
            <div className="mb-3">
              <Alert tone="warning">
                {mapped.errors.length} ligne(s) ignorée(s) : {mapped.errors.slice(0, 5).map((e) => `ligne ${e.line} (${e.message})`).join(', ')}
                {mapped.errors.length > 5 && '…'}
              </Alert>
            </div>
          )}
          <p className="mb-2 text-sm">
            {mapped.drafts.length} opération(s) lue(s), <strong>{newCount} nouvelle(s)</strong>
            {mapped.drafts.length - newCount > 0 && `, ${mapped.drafts.length - newCount} déjà importée(s)`}.
          </p>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th className="text-right!">Montant</th></tr></thead>
              <tbody>
                {mapped.drafts.map((d) => {
                  const dup = existing?.has(d.importHash);
                  return (
                    <tr key={d.importHash} className={dup ? 'opacity-40' : ''}>
                      <td className="whitespace-nowrap">{formatDateFR(d.date)}</td>
                      <td>{d.label}{dup && <span className="ml-2 text-xs">(déjà importée)</span>}</td>
                      <td className="text-slate-500">{catName(d.categoryId) ?? <span className="text-orange-500">à catégoriser</span>}</td>
                      <td className="whitespace-nowrap text-right">{formatEUR(d.amount, { sign: true })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Mémoriser ce format sous le nom (facultatif)">
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Ex. Ma banque" />
            </Field>
            <Button variant="primary" onClick={doImport} disabled={busy || newCount === 0}>Importer {newCount} transaction(s)</Button>
            {result && <Button onClick={() => navigate('/transactions')}>Voir les transactions →</Button>}
          </div>
          {result && <div className="mt-3"><Alert tone="success">{result}</Alert></div>}
        </Card>
      )}
    </div>
  );
}
