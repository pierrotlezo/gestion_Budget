import { useEffect, useState } from 'react';

/** Préférence d'affichage, gardée en localStorage (local au navigateur, comme IndexedDB). */
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'gestion-budget.theme';

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function initTheme() {
  apply((localStorage.getItem(KEY) as Theme) ?? 'system');
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) ?? 'system');
  useEffect(() => {
    localStorage.setItem(KEY, theme);
    apply(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  return [theme, setTheme];
}

/** Vrai si le mode sombre est actif (pour adapter les couleurs des graphiques). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    sync(); // au cas où le thème a changé entre le premier rendu et l'abonnement
    return () => obs.disconnect();
  }, []);
  return dark;
}
