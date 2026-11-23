import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { centsToInput, parseAmount, type Cents } from '../../domain/money';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary: 'border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
};

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm',
        variants[variant],
        className,
      )}
    />
  );
}

const fieldClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800';

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-sm', className)}>
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, props.className)} />;
}

/** Champ de saisie d'un montant en euros (accepte « 12,50 » ou « 12.50 »), valeur en centimes. */
export function MoneyInput({ value, onChange, allowNegative = false, ...rest }: { value: Cents; onChange: (v: Cents) => void; allowNegative?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(centsToInput(value));
  useEffect(() => {
    setText((t) => (parseAmount(t) === value ? t : centsToInput(value)));
  }, [value]);
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        {...rest}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const c = parseAmount(e.target.value, ',');
          if (c !== null && (allowNegative || c >= 0)) onChange(c);
          else if (e.target.value.trim() === '') onChange(0);
        }}
        className="pr-8 text-right"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">€</span>
    </div>
  );
}

/** Champ de saisie d'un pourcentage (« 1,7 » = 1,7 %), valeur en décimal (0.017). */
export function PercentInput({ value, onChange, ...rest }: { value: number; onChange: (v: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const toText = (v: number) => String(Math.round(v * 100000) / 1000).replace('.', ',');
  const [text, setText] = useState(toText(value));
  useEffect(() => {
    setText((t) => (Number(t.replace(',', '.')) / 100 === value ? t : toText(value)));
  }, [value]);
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        {...rest}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(',', '.').trim());
          if (!Number.isNaN(n) && n >= 0) onChange(Math.round(n * 1000) / 100000);
        }}
        className="pr-8 text-right"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">%</span>
    </div>
  );
}

export function ProgressBar({ ratio, status }: { ratio: number; status: 'ok' | 'warning' | 'over' }) {
  const color = status === 'over' ? 'bg-red-500' : status === 'warning' ? 'bg-orange-500' : 'bg-emerald-500';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
    </div>
  );
}

export function Stat({ label, value, tone, hint, icon }: { label: string; value: ReactNode; tone?: 'positive' | 'negative' | 'neutral'; hint?: ReactNode; icon?: string }) {
  const toneClass = tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'negative' ? 'text-red-600 dark:text-red-400' : '';
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {icon && <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base dark:bg-slate-800" aria-hidden>{icon}</span>}
        {label}
      </div>
      <div className={cx('mt-1 text-2xl font-bold', toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
    warning: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200',
    danger: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  };
  return <div className={cx('rounded-lg border px-3 py-2 text-sm', tones[tone])}>{children}</div>;
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{children}</div>;
}

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ backgroundColor: color, width: size, height: size }} />;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-2 [&_td]:py-1.5 [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-slate-500 [&_thead]:border-b [&_thead]:border-slate-200 dark:[&_thead]:border-slate-800 [&_tbody_tr]:border-b [&_tbody_tr]:border-slate-100 dark:[&_tbody_tr]:border-slate-800/60">
        {children}
      </table>
    </div>
  );
}

/** Petite étiquette (ex. « PEA », « Crypto »). */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300', className)}>{children}</span>;
}

/** Montant de gain / perte coloré avec flèche (la couleur n'est jamais le seul indice). */
export function GainText({ cents, ratio, format }: { cents: number; ratio?: number; format: (c: number, o?: { sign?: boolean }) => string }) {
  const up = cents > 0;
  const down = cents < 0;
  return (
    <span className={cx('font-medium', up && 'text-emerald-600 dark:text-emerald-400', down && 'text-red-600 dark:text-red-400')}>
      {up ? '▲' : down ? '▼' : '•'} {format(cents, { sign: true })}
      {ratio !== undefined && ratio !== 0 && <span className="ml-1 text-xs">({(ratio * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' })} %)</span>}
    </span>
  );
}
