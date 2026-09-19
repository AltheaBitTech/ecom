'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: number;
  // A function prop can't cross the server->client boundary (this component is 'use client',
  // its caller is a Server Component) — a named variant string is the serializable equivalent.
  format?: 'number' | 'inr';
  delayMs?: number;
  accent?: 'coral' | 'teal' | 'amber';
}

const FORMATTERS: Record<NonNullable<StatTileProps['format']>, (n: number) => string> = {
  number: (n) => n.toLocaleString('en-IN'),
  inr: (n) => `₹${(n / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
};

const ACCENTS: Record<NonNullable<StatTileProps['accent']>, string> = {
  coral: 'text-primary',
  teal: 'text-tertiary',
  amber: 'text-chart-3',
};

// ponytail: plain rAF count-up, no animation lib — this is a handful of tiles, not a
// perf-sensitive chart. Duration is fixed; add easing options only if a tile ever needs one.
function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    let raf: number;
    const tick = (t: number) => {
      start.current ??= t;
      const progress = Math.min(1, (t - start.current) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

export function StatTile({ label, value, format = 'number', delayMs = 0, accent = 'teal' }: StatTileProps) {
  const animated = useCountUp(value);
  const formatted = FORMATTERS[format](animated);

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10 duration-500"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn('mt-1.5 font-heading text-2xl font-semibold tabular-nums', ACCENTS[accent])}>{formatted}</p>
    </div>
  );
}
