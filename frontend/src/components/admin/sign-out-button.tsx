'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Ends the staff session via the BFF (which revokes at the backend and clears the
 * httpOnly cookies), then returns to sign-in.
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      /* clearing happens server-side; fall through to redirect regardless */
    }
    router.replace('/admin/sign-in');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="text-sm text-ink-muted transition hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
