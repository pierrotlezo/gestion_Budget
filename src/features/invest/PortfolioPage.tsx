import { useState } from 'react';
import { db } from '../../db/db';
import type { Investment, InvestmentOperation } from '../../db/schema';
import { useInvestmentOps, usePositions, useSettings } from '../../hooks/data';
import { ENVELOPE_ICONS, ENVELOPE_LABELS, summarizePortfolio, type Position } from '../../domain/invest/portfolio';
import { formatDateFR } from '../../domain/dates';
import { formatEUR } from '../../domain/money';
import { seriesColor } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { refreshPrices } from '../../services/prices';
import { Alert, Badge, Button, Card, EmptyState, GainText, PageHeader, Stat, Table } from '../../components/ui';
import { BreakdownBars } from '../../components/BreakdownBars';
import { InvestmentForm } from './InvestmentForm';
import { OperationForm } from './OperationForm';

const OP_LABELS: Record<InvestmentOperation['kind'], string> = { buy: 'Achat', sell: 'Vente', valuation: 'Valorisation' };

export function PortfolioPage() {
  const positions = usePositions();
  const settings = useSettings();
  const dark = useIsDark();
  const summary = summarizePortfolio(positions);
  const [editing, setEditing] = useState<Investment | 'new' | null>(null);
  const [operation, setOperation] = useState<{ position: Position; kind: InvestmentOperation['kind'] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);

  const lastUpdate = positions.map((p) => p.priceFetchedAt).filter(Boolean).sort().at(-1);
  const hasPriced = positions.some((p) => p.investment.priceSource !== 'manual');

  const refresh = async () => {
    setRefreshing(true);
    const r = await refreshPrices();
    setRefreshing(false);
    setMessage(r.errors.length ? { tone: 'warning', text: `Cours mis à jour : ${r.updated}. Problèmes : ${r.errors.join(' ; ')}` } : { tone: 'success', text: `${r.updated} cours mis à jour.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes placements"
        subtitle={hasPriced ? (lastUpdate ? `Cours du ${new Date(lastUpdate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${settings.autoPrices ? ' · mise à jour automatique' : ''}` : 'Cours pas encore récupérés') : 'BTC, ETF du PEA, assurance-vie, PER…'}
        actions={
          <>
            {hasPriced && <Button onClick={refresh} disabled={refreshing}>{refreshing ? '⏳ Mise à jour…' : '🔄 Actualiser les cours'}</Button>}
            <Button variant="primary" onClick={() => setEditing('new')}>+ Ajouter un placement</Button>
          </>
        }
      />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {positions.length === 0 ? (
        <EmptyState>
          <div className="mb-3 text-4xl">📈</div>
          Ajoute ton premier placement : du bitcoin, un ETF de ton PEA, ton assurance-vie…
          <div className="mt-4"><Button variant="primary" onClick={() => setEditing('new')}>+ Ajouter un placement</Button></div>
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon="💼" label="Valeur actuelle" value={formatEUR(summary.value)} />
            <Stat icon="📥" label="Total investi" value={formatEUR(summary.invested)} />
            <Stat icon="📈" label="Plus ou moins-value" value={<GainText cents={summary.gain} ratio={summary.gainRatio} format={formatEUR} />} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
            <div className="space-y-4">
              {positions.map((p) => (
                <PositionCard key={p.investment.id} position={p} onOperation={(kind) => setOperation({ position: p, kind })} onEdit={() => setEditing(p.investment)} />
              ))}
            </div>
            <Card title="Répartition" className="h-fit">
              <BreakdownBars items={positions.map((p) => ({ key: p.investment.id, name: p.investment.name, value: p.value, color: seriesColor(p.investment.color, dark), icon: ENVELOPE_ICONS[p.investment.envelope] }))} />
            </Card>
          </div>
        </>
      )}

      {editing && <InvestmentForm initial={editing === 'new' ? undefined : editing} count={positions.length} onClose={() => setEditing(null)} />}
      {operation && <OperationForm position={operation.position} initialKind={operation.kind} onClose={() => setOperation(null)} />}
    </div>
  );
}

function PositionCard({ position: p, onOperation, onEdit }: { position: Position; onOperation: (k: InvestmentOperation['kind']) => void; onEdit: () => void }) {
  const ops = useInvestmentOps().filter((o) => o.investmentId === p.investment.id).reverse();
  const [open, setOpen] = useState(false);
  const priced = p.investment.priceSource !== 'manual';
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: `${p.investment.color}22` }} aria-hidden>{ENVELOPE_ICONS[p.investment.envelope]}</span>
          <div>
            <div className="font-semibold">{p.investment.name}</div>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              <Badge>{ENVELOPE_LABELS[p.investment.envelope]}</Badge>
              {p.investment.symbol && <Badge className="font-mono">{p.investment.symbol}</Badge>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">{formatEUR(p.value)}</div>
          <GainText cents={p.gain} ratio={p.gainRatio} format={formatEUR} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
        <span>Investi : <strong className="text-slate-700 dark:text-slate-200">{formatEUR(p.invested)}</strong></span>
        {priced && <span>Quantité : <strong className="text-slate-700 dark:text-slate-200">{p.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 8 })}</strong></span>}
        {priced && <span>Cours : <strong className="text-slate-700 dark:text-slate-200">{p.price ? formatEUR(Math.round(p.price * 100)) : 'inconnu'}</strong></span>}
        {!priced && p.valueSource === 'cost' && <span>Pas encore de valorisation : valeur = montant investi</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => onOperation('buy')}>+ Acheter</Button>
        <Button size="sm" onClick={() => onOperation('sell')}>Vendre</Button>
        {!priced && <Button size="sm" onClick={() => onOperation('valuation')}>Mettre à jour la valeur</Button>}
        <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? 'Masquer' : 'Historique'} ({ops.length})</Button>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Modifier">✏️</Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Supprimer"
          onClick={async () => {
            if (!confirm(`Supprimer « ${p.investment.name} » et tout son historique ?`)) return;
            await db.transaction('rw', db.investments, db.investmentOps, async () => {
              await db.investmentOps.where('investmentId').equals(p.investment.id).delete();
              await db.investments.delete(p.investment.id);
            });
          }}
        >
          🗑️
        </Button>
      </div>
      {open && (
        <div className="mt-4">
          {ops.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune opération.</p>
          ) : (
            <Table>
              <thead><tr><th>Date</th><th>Opération</th>{priced && <th className="text-right!">Quantité</th>}<th className="text-right!">Montant</th><th></th></tr></thead>
              <tbody>
                {ops.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDateFR(o.date)}</td>
                    <td>{OP_LABELS[o.kind]}</td>
                    {priced && <td className="text-right">{o.quantity?.toLocaleString('fr-FR', { maximumFractionDigits: 8 }) ?? '—'}</td>}
                    <td className="text-right">{formatEUR(o.amount)}</td>
                    <td className="text-right"><Button size="sm" variant="ghost" onClick={() => db.investmentOps.delete(o.id)} aria-label="Supprimer l'opération">🗑️</Button></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}
    </Card>
  );
}
