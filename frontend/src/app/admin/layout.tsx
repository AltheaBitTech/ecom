'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package2, Loader2 } from 'lucide-react';
import { SidebarNav } from '@/components/admin/sidebar-nav';
import { Topbar } from '@/components/admin/topbar';
import { useAuth } from '@/lib/auth-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status, tenant } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
    // OAuth signups arrive without legal/tax details — finish them first.
    else if (status === 'authenticated' && tenant && !tenant.legalName) router.replace('/onboarding');
  }, [status, tenant, router]);

  if (status !== 'authenticated' || (tenant && !tenant.legalName)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold tracking-tight">
          <Package2 className="size-5" />
          Stallwart
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
