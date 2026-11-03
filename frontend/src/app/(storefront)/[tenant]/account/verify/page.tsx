'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { StorePage } from '@/components/storefront/store-page';
import { Spinner } from '@/components/ui/primitives';
import { clientApi, isApiError } from '@/lib/client-api';

/**
 * Confirms a shopper's email from the link in the verification email. Each store
 * has its own domain, so this lives under the tenant — the backend's EmailService
 * points its customer verification URL at `{store}/account/verify`.
 */
export default function VerifyEmailPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const params = useSearchParams();
  const token = params.get('token');
  // token is already known on the first render (from the URL), so the
  // "missing token" case is derived directly rather than set in an effect.
  const [state, setState] = useState<'working' | 'done' | 'error'>(() => (token ? 'working' : 'error'));
  const [message, setMessage] = useState(() => (token ? '' : 'This verification link is missing its token.'));

  useEffect(() => {
    if (!token) return;
    clientApi(`/storefront/${tenant}/account/auth/verify-email`, { method: 'POST', body: { token } })
      .then(() => setState('done'))
      .catch((e) => {
        setState('error');
        setMessage(isApiError(e) ? e.message : 'This link is invalid or has expired.');
      });
  }, [tenant, token]);

  return (
    <StorePage eyebrow="Customer account" className="max-w-xl text-center">
      {state === 'working' && <Spinner label="Verifying your email…" />}
      {state === 'done' && (
        <>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
            ✓
          </div>
          <h1 className="text-2xl font-semibold">Email verified</h1>
          <p className="mt-1 text-sm text-ink-muted">Your email is confirmed. You can now sign in.</p>
          <Button href={`/${tenant}/account`} className="mt-6">
            Go to sign in
          </Button>
        </>
      )}
      {state === 'error' && (
        <>
          <h1 className="text-2xl font-semibold">Verification failed</h1>
          <p className="mt-1 text-sm text-ink-muted">{message}</p>
          <Button href={`/${tenant}/account`} variant="secondary" className="mt-6">
            Back to account
          </Button>
        </>
      )}
    </StorePage>
  );
}
