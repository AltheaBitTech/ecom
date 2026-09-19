'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StoreLink as Link } from '@/components/storefront/store-link';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { api } from '@/lib/api';

function Unsubscribe() {
  const params = useSearchParams();
  const customerId = params.get('c');
  const token = params.get('t');
  const [result, setResult] = useState<'working' | 'done' | 'failed'>('working');
  // A link missing either half is already a failure — no request, and no setState during render.
  const usable = Boolean(customerId && token);
  const state = usable ? result : 'failed';

  useEffect(() => {
    if (!customerId || !token) return;
    // The link is the authorisation — no login, and one visit is all it takes.
    api(`/marketing/unsubscribe?c=${encodeURIComponent(customerId)}&t=${encodeURIComponent(token)}`)
      .then(() => setResult('done'))
      .catch(() => setResult('failed'));
  }, [customerId, token]);

  if (state === 'working') return <p className="store-container py-24 text-center text-muted-foreground">Updating your preferences…</p>;

  return (
    <div className="store-container store-empty !py-24">
      {state === 'done' ? (
        <>
          <CircleCheck size={44} className="text-primary" />
          <h1>You&apos;re unsubscribed.</h1>
          <p>You won&apos;t get marketing messages from us again. Order updates for anything you buy will still reach you.</p>
        </>
      ) : (
        <>
          <CircleAlert size={44} className="text-destructive" />
          <h1>That link didn&apos;t work.</h1>
          <p>It may have expired or been copied incompletely. Contact the store and we&apos;ll take you off the list.</p>
        </>
      )}
      <Link className="store-button" href="/store">Back to the store</Link>
      <Link className="store-text-link" href="/store#contact">Contact the store</Link>
    </div>
  );
}

export default function UnsubscribePage() {
  return <Suspense><Unsubscribe /></Suspense>;
}
