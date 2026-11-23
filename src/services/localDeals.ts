/** Bons plans locaux, récupérés par le serveur maison (voir server/deals.ts). */
import { useEffect, useState } from 'react';
import type { LocalDeal } from '../domain/tips/localDeals';

export function useLocalDeals(city: string, enabled: boolean) {
  const [state, setState] = useState<{ deals: LocalDeal[] | null; error: string }>({ deals: null, error: '' });
  useEffect(() => {
    if (!enabled || !city.trim()) return;
    let current = true;
    setState({ deals: null, error: '' });
    fetch(`/api/local-deals?city=${encodeURIComponent(city.trim())}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Erreur ${r.status}`))))
      .then((b: { deals: LocalDeal[] }) => current && setState({ deals: b.deals, error: '' }))
      .catch(() => current && setState({ deals: null, error: 'Bons plans locaux indisponibles (PC injoignable ou pas de connexion Internet).' }));
    return () => {
      current = false;
    };
  }, [city, enabled]);
  return state;
}
