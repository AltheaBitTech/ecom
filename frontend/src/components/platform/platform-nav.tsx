'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, LayoutDashboard, Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/platform-admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/platform-admin/tenants', label: 'Tenants', icon: Building2 },
];

export function PlatformNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/platform/logout', { method: 'POST' });
    router.push('/platform-admin/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight text-tertiary">
            <ShieldCheck className="size-4" />
            Platform Console
          </div>
          <nav className="flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
