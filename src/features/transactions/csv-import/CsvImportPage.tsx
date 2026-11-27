import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, newId } from '../../../db/db';
import type { CsvProfile } from '../../../db/schema';
import { useCategories, useRules } from '../../../hooks/data';
import { decodeFile, detectFormat, mapRows, parseCsvTable } from '../../../domain/csv/parse';
import { formatDateFR, monthOf } from '../../../domain/dates';
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
  const rules = useRules();
  const categories = useCategories();
  const profiles = useLiveQuery(() => db.csvProfiles.toArray(), []) ?? [];
  const [fileName, setFileName] = useState('');
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [profileName, setProfileName] = useState('');
  const [result, setResult] = useState<{ imported: number; duplicates: number; sorted: number; toSort: number; month: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bank, setBank] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const text = useMemo(() => (buffer && mapping ? decodeFile(buffer, mapping.encoding).text : ''), [buffer, mapping?.encoding]);
  const table = useMemo(() => (mapping && text ? parseCsvTable(text, mapping.delimiter, mapping.skipRows, mapping.hasHeader !== false) : null), [text, mapping?.delimiter, mapping?.skipRows, mapping?.hasHeader]);
  const mapped = useMemo(() => (table && mapping ? mapRows(table, mapping, rules) : null), [table, mapping, rules]);
  const existing = useLiveQuery(async () => {
    if (!mapped) return new Set<string>();
    const found = await db.transactions.where('importHash').anyOf(mapped.drafts.map((d) => d.importHash)).toArray();
    return new Set(found.map((t) => t.importHash));
  }, [mapped]);

  const onFile = async (file: File) => {
    setError('');
    if (!/\.(csv|txt)$/i.test(file.name) && !file.type.includes('csv') && !file.type.startsWith('text/')) {
      setError(`« ${file.name} » n'est pas un fichier CSV. Sur le site de ta banque, choisis l'export au format CSV.`);
      return;
    }
    const buf = await file.arrayBuffer();
    const { text, encoding } = decodeFile(buf);
    // Format reconnu automatiquement (LCL…) ou deviné d'après le contenu
    const detected = detectFormat(text, encoding);
    setFileName(file.name);
    setBuffer(buf);
    setResult(null);
    setBank(detected.bank);
    setMapping(detected.mapping);
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
    const fresh = mapped.drafts.filter((d) => !existing?.has(d.importHash));
    const r = await importDrafts(mapped.drafts);
    setBusy(false);
    // Mois qui contient le plus d'opérations à trier (pour y aller directement)
    const byMonth = new Map<string, number>();
    for (const d of fresh) if (!d.categoryId) byMonth.set(monthOf(d.date), (byMonth.get(monthOf(d.date)) ?? 0) + 1);
    const month = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? monthOf(fresh[0]?.date ?? mapped.drafts[0].date);
    setResult({ imported: r.imported, duplicates: r.duplicates, sorted: fresh.filter((d) => d.categoryId).length, toSort: fresh.filter((d) => !d.categoryId).length, month });
  };

  const catName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name : null);
  const headers = table?.headers ?? [];
  const newCount = mapped ? mapped.drafts.filter((d) => !existing?.has(d.importHash)).length : 0;

  return (
    <div>
      <PageHeader title="Importer un relevé CSV" subtitle="Le fichier est lu dans le navigateur : il n'est envoyé nulle part." />

      <Card title="1. Ton relevé" className="mb-4">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'}`}
        >
          <span className="text-4xl" aria-hidden>📥</span>
          <span className="font-semibold">{fileName ? `📄 ${fileName}` : 'Dépose ton relevé CSV ici'}</span>
          <span className="text-sm text-slate-500">{fileName ? 'ou clique pour choisir un autre fichier' : 'ou clique pour le choisir (LCL, Crédit Agricole, Boursorama… export CSV)'}</span>
          <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
        </label>
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
        {bank && <div className="mt-3"><Alert tone="success">✅ Format <strong>{bank}</strong> reconnu : les colonnes sont réglées automatiquement.</Alert></div>}
        {fileName && !bank && mapping && <div className="mt-3"><Alert tone="info">Vérifie la correspondance des colonnes ci-dessous (l'aperçu en bas montre le résultat).</Alert></div>}
        {profiles.length > 0 && buffer && (
          <Field label="Ou utiliser un format enregistré" className="mt-3 max-w-xs">
            <Select defaultValue="" onChange={(e) => applyProfile(e.target.value)}>
              <option value="">— Choisir —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
        )}
      </Card>

      {mapping && table && (
        <details open={!bank} className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <summary className="cursor-pointer text-lg font-semibold">2. Correspondance des colonnes {bank && <span className="text-sm font-normal text-slate-500">(automatique, cliquer pour modifier)</span>}</summary>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mapping.hasHeader !== false} onChange={(e) => set('hasHeader', e.target.checked)} />
            La première ligne contient le nom des colonnes
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </details>
      )}

      {mapped && (
        <Card title="3. Aperçu et import">
          {mapped.skipped > 0 && <p className="mb-2 text-sm text-slate-500">{mapped.skipped} ligne(s) de solde ou de total ignorée(s).</p>}
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
          </div>
          {result && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="text-lg font-semibold">🎉 {result.imported} opération{result.imported > 1 ? 's' : ''} importée{result.imported > 1 ? 's' : ''}</div>
              <div className="mt-1 text-sm">
                ✅ {result.sorted} classée{result.sorted > 1 ? 's' : ''} automatiquement
                {result.toSort > 0 && <> · 📥 {result.toSort} à trier</>}
                {result.duplicates > 0 && <> · {result.duplicates} déjà présente{result.duplicates > 1 ? 's' : ''} ignorée{result.duplicates > 1 ? 's' : ''}</>}
              </div>
              {result.toSort > 0 && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Trie-les en un clic : à chaque fois, l'appli te propose une règle pour que les prochains relevés soient triés tout seuls.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {result.toSort > 0 && <Link to={`/depenses/categorie/__none?mois=${result.month}`}><Button variant="primary">📥 Trier les {result.toSort} opérations</Button></Link>}
                <Link to={`/depenses?mois=${result.month}`}><Button>Voir mes dépenses par catégorie</Button></Link>
                <Link to="/accueil"><Button variant="ghost">Tableau de bord</Button></Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
