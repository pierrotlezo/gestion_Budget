import { NavLink, Outlet } from 'react-router-dom';
import { routes } from './routes';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="shrink-0 border-b border-slate-200 bg-white md:w-56 md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-4 text-lg font-bold">💶 Mon budget</div>
        <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-4">
          {routes.map((r) => (
            <li key={r.path}>
              <NavLink
                to={r.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                    isActive ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <span aria-hidden>{r.icon}</span>
                {r.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="hidden px-4 pb-4 text-xs text-slate-400 md:block">🔒 Données stockées uniquement dans ce navigateur.</p>
      </nav>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
