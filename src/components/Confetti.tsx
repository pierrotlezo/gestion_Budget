import { useMemo } from 'react';
import { CATEGORICAL } from '../app/chartTheme';

/** Pluie de confettis (purement décorative). */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.6, drift: (Math.random() - 0.5) * 200, color: CATEGORICAL[i % CATEGORICAL.length] })),
    [count],
  );
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{ left: `${p.left}vw`, backgroundColor: p.color, animationDelay: `${p.delay}s`, ['--dur' as string]: `${p.dur}s`, ['--drift' as string]: `${p.drift}px` }} />
      ))}
    </div>
  );
}
