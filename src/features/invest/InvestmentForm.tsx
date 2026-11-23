import { useEffect, useState } from 'react';
import { db, newId } from '../../db/db';
import type { Investment, InvestmentEnvelope } from '../../db/schema';
import { ENVELOPE_ICONS, ENVELOPE_LABELS } from '../../domain/invest/portfolio';
import type { SearchResult } from '../../domain/invest/quotes';
import { CATEGORICAL } from '../../app/chartTheme';
import { refreshPrices, searchInstruments } from '../../services/prices';
import { Alert, Button, Field, Input, Modal, Select } from '../../components/ui';

/** Ajout / modification d'un placement, avec recherche par nom, symbole ou ISIN. */
export function InvestmentForm({ initial, count, onClose }: { initial?: Investment; count: number; onClose: () => void }) {
  const [inv, setInv] = useState<Investment>(initial ?? { id: newId(), name: '', envelope: 'pea', priceSource: 'manual', color: CATEGORICAL[count % CATEGORICAL.length] });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Investment>(k: K, v: Investment[K]) => setInv((x) => ({ ...x, [k]: v }));

  // Recherche avec un petit délai pour ne pas interroger à chaque frappe
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    setSearching(true);
    const t = setTimeout(() => {
      searchInstruments(query)
        .then((r) => { setResults(r); setError(''); })
        .catch((e) => setError((e as Error).message))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (r: SearchResult) => {
    setInv((x) => ({
      ...x,
      name: r.name,
      symbol: r.symbol,
      priceSource: r.source,
      envelope: r.source === 'coingecko' ? 'crypto' : x.envelope === 'crypto' ? 'pea' : x.envelope,
    }));
    setResults([]);
    setQuery('');
  };

  const save = async () => {
    await db.investments.put({ ...inv, name: inv.name.trim() });
    onClose();
    if (inv.priceSource !== 'manual') refreshPrices();
  };

  return (
    <Modal open title={initial ? `Modifier « ${initial.name} »` : 'Nouveau placement'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Rechercher" hint="Nom, symbole ou code ISIN : « bitcoin », « CW8 », « FR0010315770 »… Seul ce texte est envoyé pour la recherche.">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 Bitcoin, MSCI World, Ethereum…" autoFocus={!initial} />
        </Field>
        {searching && <p className="text-sm text-slate-500">Recherche…</p>}
        {error && <Alert tone="warning">{error}</Alert>}
        {results.length > 0 && (
          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
            {results.map((r) => (
              <li key={`${r.source}:${r.symbol}`}>
                <button type="button" onClick={() => pick(r)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-500">{r.detail}</span></span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">{r.symbol}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          {inv.priceSource === 'manual' ? (
            <>Sans cours automatique : tu indiqueras toi-même la valeur (fonds euros, PER, crowdfunding…).</>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span>Cours automatique : <span className="font-mono">{inv.symbol}</span> ({inv.priceSource === 'coingecko' ? 'CoinGecko' : 'Yahoo Finance'})</span>
              <Button size="sm" variant="ghost" onClick={() => setInv((x) => ({ ...x, priceSource: 'manual', symbol: undefined }))}>Retirer</Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom"><Input value={inv.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Fonds euros Linxea" /></Field>
          <Field label="Enveloppe">
            <Select value={inv.envelope} onChange={(e) => set('envelope', e.target.value as InvestmentEnvelope)}>
              {Object.entries(ENVELOPE_LABELS).map(([k, l]) => <option key={k} value={k}>{ENVELOPE_ICONS[k as InvestmentEnvelope]} {l}</option>)}
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={!inv.name.trim()} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  );
}
