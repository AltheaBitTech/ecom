'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REVIEWABLE = ['PENDING_VERIFICATION', 'PROFILE_INCOMPLETE', 'UNDER_REVIEW', 'REVISION_REQUESTED'];

interface TenantRowActionsProps {
  id: string;
  status: string;
}

export function TenantRowActions({ id, status }: TenantRowActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: string) {
    setPending(action);
    try {
      const res = await fetch(`/api/platform/tenants/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Action failed');
      router.refresh();
    } catch {
      // ponytail: no toast wired up here — refresh will simply leave the row unchanged, add
      // sonner feedback if silent failures start confusing admins.
    } finally {
      setPending(null);
    }
  }

  const busy = (action: string) => pending === action;

  if (REVIEWABLE.includes(status)) {
    return (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => run('approve')}>
          {busy('approve') ? <Loader2 className="size-3.5 animate-spin" /> : 'Approve'}
        </Button>
        <Button size="sm" variant="destructive" disabled={!!pending} onClick={() => run('reject')}>
          {busy('reject') ? <Loader2 className="size-3.5 animate-spin" /> : 'Reject'}
        </Button>
      </div>
    );
  }

  if (status === 'ACTIVE') {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="destructive" disabled={!!pending} onClick={() => run('suspend')}>
          {busy('suspend') ? <Loader2 className="size-3.5 animate-spin" /> : 'Suspend'}
        </Button>
      </div>
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" disabled={!!pending} onClick={() => run('reactivate')}>
          {busy('reactivate') ? <Loader2 className="size-3.5 animate-spin" /> : 'Reactivate'}
        </Button>
      </div>
    );
  }

  return null;
}
