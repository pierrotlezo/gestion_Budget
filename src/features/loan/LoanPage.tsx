import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, newId } from '../../db/db';
import type { DeferralType, Loan } from '../../db/schema';
import { useLoans } from '../../hooks/data';
import { buildSchedule, monthlyPayment, summarizeLoan, type ScheduleRow } from '../../domain/loan/amortization';
import { formatDateFR, monthOf, todayISO } from '../../domain/dates';
import { formatEUR, formatPercent } from '../../domain/money';
import { chartChrome } from '../../app/chartTheme';
import { useIsDark } from '../../app/theme';
import { Alert, Button, Card, Field, Input, MoneyInput, PageHeader, PercentInput, Select, Stat, Table } from '../../components/ui';
import { ChartTooltip } from '../../components/ChartTooltip';
import { ComparisonCard } from './ComparisonCard';

export function LoanPage() {
  const loans = useLoans();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loan = loans.find((l) => l.id === selectedId) ?? loans[0];

  const addLoan = async () => {
    const id = newId();
    await db.loans.add({ id, name: 'Nouveau prêt', principal: 1000000, annualRate: 0.03, durationMonths: 60, startDate: todayISO(), monthlyInsurance: 0, deferral: { type: 'none', months: 0 } });
    setSelectedId(id);
  };

  return (
    <div>
      <PageHeader
        title="Prêt"
        actions={
          <>
            {loans.length > 1 && (
              <Select value={loan?.id} onChange={(e) => setSelectedId(e.target.value)} aria-label="Choisir le prêt">
                {loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            )}
            <Button onClick={addLoan}>+ Ajouter un prêt</Button>
          </>
        }
      />
      {loan ? <LoanView key={loan.id} loan={loan} canDelete={loans.length > 1} /> : <Button onClick={addLoan}>Créer un prêt</Button>}
    </div>
  );
}

function LoanView({ loan, canDelete }: { loan: Loan; canDelete: boolean }) {
  const [draft, setDraft] = useState<Loan>(loan);
  useEffect(() => setDraft(loan), [loan]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(loan);
  const set = <K extends keyof Loan>(k: K, v: Loan[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const today = todayISO();
  const schedule = useMemo(() => buildSchedule(draft), [draft]);
  const summary = useMemo(() => summarizeLoan(draft, schedule, today), [draft, schedule, today]);
  const computedPayment = monthlyPayment(
    draft.deferral.type === 'total' ? (schedule.filter((r) => r.phase === 'deferral').at(-1)?.remaining ?? draft.principal) : draft.principal,
    draft.annualRate,
    draft.durationMonths,
  );

  return (
    <div className="space-y-4">
      <Card title="Caractéristiques">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nom"><Input value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Montant emprunté"><MoneyInput value={draft.principal} onChange={(v) => set('principal', v)} /></Field>
          <Field label="Taux annuel (hors assurance)"><PercentInput value={draft.annualRate} onChange={(v) => set('annualRate', v)} /></Field>
          <Field label="Date de déblocage des fonds"><Input type="date" value={draft.startDate} onChange={(e) => e.target.value && set('startDate', e.target.value)} /></Field>
          <Field label="Différé">
            <Select value={draft.deferral.type} onChange={(e) => set('deferral', { type: e.target.value as DeferralType, months: e.target.value === 'none' ? 0 : draft.deferral.months || 60 })}>
              <option value="none">Aucun</option>
              <option value="partial">Partiel (je paie les intérêts)</option>
              <option value="total">Total (intérêts ajoutés au capital)</option>
            </Select>
          </Field>
          <Field label="Durée du différé (mois)" hint={draft.deferral.months ? `${(draft.deferral.months / 12).toLocaleString('fr-FR')} an(s)` : undefined}>
            <Input type="number" min={0} max={240} disabled={draft.deferral.type === 'none'} value={draft.deferral.months} onChange={(e) => set('deferral', { ...draft.deferral, months: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="Durée de remboursement (mois)" hint="Hors différé">
            <Input type="number" min={1} max={480} value={draft.durationMonths} onChange={(e) => set('durationMonths', Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Assurance par mois"><MoneyInput value={draft.monthlyInsurance} onChange={(v) => set('monthlyInsurance', v)} /></Field>
          <Field label="Mensualité imposée par la banque" hint={`0 = calculée automatiquement (${formatEUR(computedPayment)})`}>
            <MoneyInput value={draft.monthlyPaymentOverride ?? 0} onChange={(v) => set('monthlyPaymentOverride', v > 0 ? v : undefined)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" disabled={!dirty} onClick={() => db.loans.put(draft)}>Enregistrer</Button>
          {dirty && <Button onClick={() => setDraft(loan)}>Annuler les modifications</Button>}
          {canDelete && <Button variant="danger" onClick={() => confirm(`Supprimer le prêt « ${loan.name} » ?`) && db.loans.delete(loan.id)}>Supprimer ce prêt</Button>}
        </div>
        {dirty && <div className="mt-3"><Alert tone="info">Aperçu des calculs avec tes modifications (non enregistrées).</Alert></div>}
        {draft.annualRate === 0 && <div className="mt-3"><Alert tone="warning">Renseigne le taux du prêt (sur ton offre de prêt) pour obtenir des calculs justes.</Alert></div>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={draft.deferral.type !== 'none' ? 'Mensualité pendant le différé' : 'Mensualité'}
          value={formatEUR((draft.deferral.type !== 'none' ? summary.deferralPayment : summary.monthlyPayment) + draft.monthlyInsurance)}
          hint={draft.deferral.type !== 'none' ? `Puis ${formatEUR(summary.monthlyPayment + draft.monthlyInsurance)} / mois à partir du ${summary.deferralEndDate ? formatDateFR(schedule.find((r) => r.phase === 'amortization')?.date ?? summary.deferralEndDate) : '—'}` : draft.monthlyInsurance ? 'Assurance comprise' : undefined}
        />
        <Stat label="Capital restant dû" value={formatEUR(summary.remainingCapital)} hint={`${summary.paymentsDone} échéance(s) passée(s) sur ${schedule.length}`} />
        <Stat label="Intérêts déjà payés" value={formatEUR(summary.interestToDate)} hint={draft.deferral.type === 'total' ? 'Capitalisés (ajoutés au capital)' : summary.insuranceToDate ? `+ ${formatEUR(summary.insuranceToDate)} d'assurance` : undefined} />
        <Stat label="Coût total du crédit" value={formatEUR(summary.totalCost)} hint={`${formatEUR(summary.totalInterest)} d'intérêts + ${formatEUR(summary.totalInsurance)} d'assurance · fin le ${summary.endDate ? formatDateFR(summary.endDate) : '—'}`} />
      </div>

      <ComparisonCard />

      <CapitalChart schedule={schedule} startDate={draft.startDate} principal={draft.principal} />
      <ScheduleTable schedule={schedule} rate={draft.annualRate} />
    </div>
  );
}

function CapitalChart({ schedule, startDate, principal }: { schedule: ScheduleRow[]; startDate: string; principal: number }) {
  const dark = useIsDark();
  const chrome = chartChrome(dark);
  const data = [{ date: startDate, remaining: principal }, ...schedule.map((r) => ({ date: r.date, remaining: r.remaining }))];
  const today = todayISO();
  const todayPoint = data.filter((d) => d.date <= today).at(-1);
  // Une graduation par année : la première échéance de chaque année
  const yearTicks = data.filter((d, i) => i === 0 || d.date.slice(0, 4) !== data[i - 1].date.slice(0, 4)).map((d) => d.date);
  return (
    <Card title="Capital restant dû">
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chrome.grid} />
            <XAxis dataKey="date" ticks={yearTicks} tickFormatter={(d) => d.slice(0, 4)} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} minTickGap={40} />
            <YAxis tickFormatter={(v) => formatEUR(v, { round: true })} stroke={chrome.axis} tickLine={false} axisLine={false} fontSize={12} width={90} />
            <Tooltip content={<ChartTooltip labelFormatter={(d) => formatDateFR(d)} />} />
            {todayPoint && <ReferenceLine x={todayPoint.date} stroke={chrome.axis} strokeDasharray="4 4" label={{ value: "Aujourd'hui", fill: chrome.axis, fontSize: 11, position: 'insideTopRight' }} />}
            <Area type="stepAfter" dataKey="remaining" name="Capital restant dû" stroke={chrome.income} strokeWidth={2} fill={chrome.income} fillOpacity={0.12} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ScheduleTable({ schedule, rate }: { schedule: ScheduleRow[]; rate: number }) {
  const [monthly, setMonthly] = useState(false);
  const today = todayISO();
  const years = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const r of schedule) map.set(r.date.slice(0, 4), [...(map.get(r.date.slice(0, 4)) ?? []), r]);
    return [...map.entries()].map(([year, rows]) => ({
      year,
      count: rows.length,
      payment: rows.reduce((s, r) => s + r.payment, 0),
      interest: rows.reduce((s, r) => s + r.interest, 0),
      principal: rows.reduce((s, r) => s + r.principal, 0),
      insurance: rows.reduce((s, r) => s + r.insurance, 0),
      remaining: rows.at(-1)!.remaining,
    }));
  }, [schedule]);

  return (
    <Card title={`Tableau d'amortissement (taux ${formatPercent(rate, 3)})`} actions={<Button size="sm" onClick={() => setMonthly((m) => !m)}>{monthly ? 'Vue par année' : 'Vue par mois'}</Button>}>
      <div className="max-h-[32rem] overflow-y-auto">
        <Table>
          <thead>
            <tr>
              <th>{monthly ? 'Échéance' : 'Année'}</th>
              <th className="text-right!">Échéance{!monthly && 's'}</th>
              <th className="text-right!">Intérêts</th>
              <th className="text-right!">Capital remboursé</th>
              <th className="text-right!">Assurance</th>
              <th className="text-right!">Capital restant</th>
            </tr>
          </thead>
          <tbody>
            {monthly
              ? schedule.map((r) => (
                  <tr key={r.n} className={monthOf(r.date) === monthOf(today) ? 'bg-indigo-50 dark:bg-indigo-950/50' : r.date < today ? 'text-slate-400' : ''}>
                    <td className="whitespace-nowrap">n°{r.n} · {formatDateFR(r.date)} {r.phase === 'deferral' && <span className="text-xs text-slate-500">(différé)</span>}</td>
                    <td className="text-right">{formatEUR(r.payment)}</td>
                    <td className="text-right">{formatEUR(r.interest)}</td>
                    <td className="text-right">{formatEUR(r.principal)}</td>
                    <td className="text-right">{formatEUR(r.insurance)}</td>
                    <td className="text-right font-medium">{formatEUR(r.remaining)}</td>
                  </tr>
                ))
              : years.map((y) => (
                  <tr key={y.year} className={y.year === today.slice(0, 4) ? 'bg-indigo-50 dark:bg-indigo-950/50' : ''}>
                    <td>{y.year} <span className="text-xs text-slate-500">({y.count} mois)</span></td>
                    <td className="text-right">{formatEUR(y.payment)}</td>
                    <td className="text-right">{formatEUR(y.interest)}</td>
                    <td className="text-right">{formatEUR(y.principal)}</td>
                    <td className="text-right">{formatEUR(y.insurance)}</td>
                    <td className="text-right font-medium">{formatEUR(y.remaining)}</td>
                  </tr>
                ))}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
