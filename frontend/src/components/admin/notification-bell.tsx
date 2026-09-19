'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import type { AppNotification } from '@/lib/types';

// ponytail: polls on an interval rather than opening a websocket/SSE channel — a merchant
// dashboard doesn't need sub-minute latency on "an order came in", and polling costs one
// small query. Swap for SSE if the gap ever matters.
const POLL_MS = 60_000;

function ago(iso: string) {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [[60, 'm'], [3600, 'h'], [86400, 'd']];
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [size, suffix] = units[i];
    if (seconds >= size) return `${Math.floor(seconds / size)}${suffix} ago`;
  }
  return 'just now';
}

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api<{ items: AppNotification[]; unread: number }>('/notifications')
      .then((data) => { setItems(data.items); setUnread(data.unread); })
      // A failed poll is not worth a toast — the next tick retries.
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    // Catch up immediately when the merchant comes back to the tab.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((n) => Math.max(0, n - 1));
    await api(`/notifications/${id}/read`, { method: 'PATCH' }).catch(load);
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    await api('/notifications/read-all', { method: 'PATCH' }).catch(load);
  }

  return (
    <DropdownMenu open={open} onOpenChange={(next) => { setOpen(next); if (next) load(); }}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <span className="sr-only">{unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && (
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={markAllRead}>
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. New orders, payments, and returns will show up here.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => {
              const body = (
                <>
                  <span className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                    <span className={`text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</span>
                  </span>
                  <span className="mt-0.5 block pl-3.5 text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block pl-3.5 text-[11px] text-muted-foreground/70">{ago(n.createdAt)}</span>
                </>
              );
              return (
                <li key={n.id} className="border-b last:border-0">
                  {n.link ? (
                    <Link href={n.link} className="block px-3 py-2.5 hover:bg-accent" onClick={() => { setOpen(false); if (!n.readAt) markRead(n.id); }}>
                      {body}
                    </Link>
                  ) : (
                    <button className="block w-full px-3 py-2.5 text-left hover:bg-accent" onClick={() => !n.readAt && markRead(n.id)}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
