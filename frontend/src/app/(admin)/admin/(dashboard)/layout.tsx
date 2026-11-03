import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Menu } from 'lucide-react';

import { SignOutButton } from '@/components/admin/sign-out-button';
import { Sidebar } from '@/components/admin/sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/admin-ui/sheet';
import { Toaster } from '@/components/admin-ui/sonner';
import { ADMIN_STORE_COOKIE, ADMIN_STORE_SLUG_COOKIE } from '@/lib/admin-auth';
import { getStaffSession } from '@/lib/session';
import { visibleNav } from '@/lib/nav';

/**
 * Admin shell. The nav is resolved from the signed-in staff member's permission
 * set on the server — nothing about roles reaches the client. Middleware keeps a
 * valid access token in place (refreshing silently); this redirect is the
 * defensive fallback for when there is no session at all.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession();

  if (!session) {
    redirect('/admin/sign-in');
  }

  const nav = visibleNav(session.permissions);
  const jar = await cookies();
  const storeName = jar.get(ADMIN_STORE_COOKIE)?.value || 'Your store';
  const storeSlug = jar.get(ADMIN_STORE_SLUG_COOKIE)?.value;

  return (
    <div className="admin-shell flex min-h-screen bg-background text-foreground">
      <Sidebar items={nav} storeName={storeName} storeSlug={storeSlug} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-border bg-card/90 px-5 backdrop-blur-xl sm:px-8">
          <Sheet>
            <SheetTrigger render={<button type="button" className="grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background lg:hidden" aria-label="Open dashboard menu" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <nav className="mt-8 flex flex-col gap-1">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                    <span>{item.icon}</span>{item.label}
                  </Link>
                ))}
                {storeSlug && (
                  <Link href={`/${storeSlug}`} target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-accent">
                    <span>↗</span>View storefront
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/admin" className="font-display text-lg font-bold tracking-[-.04em] lg:hidden">
            {storeName}<span className="text-primary">.</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {storeSlug && (
              <Link href={`/${storeSlug}`} target="_blank" className="hidden rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold transition hover:border-primary sm:block">
                View store ↗
              </Link>
            )}
            <span className="rounded-lg bg-accent px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-accent-foreground">
              {session.role || 'Staff'}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-360 flex-1 px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
