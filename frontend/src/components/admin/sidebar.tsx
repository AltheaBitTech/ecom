'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavItem } from '@/lib/nav';

/**
 * Renders whatever nav items it is given — the filtering by permission happens
 * on the server (visibleNav). This component holds no role logic; it only knows
 * how to draw a list and highlight the active route.
 */
export function Sidebar({ items, storeName, storeSlug }: { items: NavItem[]; storeName: string; storeSlug?: string }) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card px-4 py-5 text-foreground lg:flex">
      <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2 font-display text-xl font-bold tracking-tighter">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">✦</span>
        StoreLab
      </Link>
      <div className="mb-6 rounded-xl border border-border bg-muted/60 p-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[.18em] text-muted-foreground">Active store</p>
        <p className="mt-1.5 truncate font-display text-lg font-bold tracking-[-.03em]">{storeName}</p>
        {storeSlug && <p className="mt-1 truncate text-[10px] text-muted-foreground">/{storeSlug}</p>}
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-md text-sm leading-none ${active ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border pt-4">
        {storeSlug ? (
          <Link href={`/${storeSlug}`} target="_blank" className="flex items-center justify-between rounded-lg px-3 py-3 text-xs font-bold uppercase tracking-[.12em] text-primary hover:bg-accent">
            View storefront <span>↗</span>
          </Link>
        ) : (
          <p className="px-3 text-xs leading-5 text-muted-foreground">Sign in again once to enable your storefront shortcut.</p>
        )}
      </div>
    </aside>
  );
}
