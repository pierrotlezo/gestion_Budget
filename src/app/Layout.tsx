import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { sections, type Section } from './routes';
import { autoRefreshPrices } from '../services/prices';
import { useSyncStatus } from '../services/sync';

/** Petit indicateur de synchro avec le PC. */
function SyncBadge({ compact = false }: { compact?: boolean }) {
  const s = useSyncStatus();
  if (!s.token) {
    return (
      <NavLink to="/reglages/telephone" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
        {compact ? '🔗 Appairer' : '🔗 Appairer avec le PC'}
      </NavLink>
    );
  }
  const ago = s.lastResult ? Math.round((Date.now() - s.lastResult.at) / 60000) : null;
  const label = s.syncing ? '🔄 Synchro…' : s.lastResult?.ok ? `✅ Synchro${ago !== null && ago > 0 ? ` il y a ${ago} min` : ''}` : s.lastResult ? '📴 PC injoignable' : '🔄 En attente';
  return <NavLink to="/reglages/telephone" className="text-xs text-slate-500 hover:underline" title={s.lastResult?.message}>{label}</NavLink>;
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
    isActive ? 'bg-indigo-600 font-semibold text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function Layout() {
  // Mise à jour automatique des cours des placements à l'ouverture (si activée dans les Réglages)
  useEffect(() => {
    autoRefreshPrices();
  }, []);

  return (
    <div className="min-h-screen md:flex">
      {/* Barre latérale (ordinateur) */}
      <nav className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white px-3 py-5 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-3 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white">€</span>
          Mon budget
        </div>
        <ul className="flex flex-col gap-1">
          {sections.map((s) => (
            <li key={s.path}>
              <NavLink to={s.path} className={navClass}>
                <span aria-hidden className="text-lg">{s.icon}</span>
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto space-y-1 px-3">
          <SyncBadge />
          <p className="text-xs leading-relaxed text-slate-400">🔒 Tes données restent chez toi.</p>
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28 md:px-10 md:pt-8 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex justify-end md:hidden"><SyncBadge compact /></div>
          <Outlet />
        </div>
      </main>

      {/* Barre du bas (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95">
        <ul className="grid grid-cols-5">
          {sections.map((s) => (
            <li key={s.path}>
              <NavLink to={s.path} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                <span aria-hidden className="text-xl">{s.icon}</span>
                {s.label.replace(' & Invest.', '')}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Onglets en haut d'une rubrique. */
export function SectionLayout({ section }: { section: Section }) {
  return (
    <>
      {section.pages.length > 1 && (
        <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
          {section.pages.filter((p) => !p.hidden).map((p) => (
            <NavLink
              key={p.path}
              to={p.path ? `${section.path}/${p.path}` : section.path}
              end
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
                  isActive ? 'bg-slate-900 font-medium text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              {p.label}
            </NavLink>
          ))}
        </div>
      )}
      <Outlet />
    </>
  );
}
