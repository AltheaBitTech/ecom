'use client';

import { useEffect, useState } from 'react';

function timeLeft(endsAt: string) {
  const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

/** Ticks down to a flash sale's end time. Client-only so the number is live;
 *  a stale SSR value would just read wrong until hydration corrects it. */
export function DealCountdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState(() => timeLeft(endsAt));
  useEffect(() => {
    const timer = setInterval(() => setLeft(timeLeft(endsAt)), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return <div className="store-deal-clock" role="timer" aria-label="Time left on this deal">
    {([['Days', left.days], ['Hours', left.hours], ['Mins', left.minutes], ['Secs', left.seconds]] as const).map(([label, value]) => (
      <span key={label}><strong>{String(value).padStart(2, '0')}</strong><small>{label}</small></span>
    ))}
  </div>;
}
