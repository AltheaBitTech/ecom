'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import type { Customer } from '@/lib/types';

type SortBy = 'createdAt' | 'name';

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}

function CustomersView() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const canManage = hasPermission(PERMISSIONS.ORDERS_CUSTOMERS_MANAGE);

  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sortBy') as SortBy) || 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  const [searchInput, setSearchInput] = useState(search);

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) setParams({ search: searchInput || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    api<Customer[]>(`/customers?${params.toString()}`)
      .then(setCustomers)
      .catch(() => toast.error('Failed to load customers'));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [search, sortBy, sortDir]);

  function toggleSort(col: SortBy) {
    if (sortBy === col) setParams({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
    else setParams({ sortBy: col, sortDir: 'desc' });
  }

  function sortHeader(col: SortBy, children: React.ReactNode) {
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
        <span className="inline-flex items-center gap-1">
          {children}
          {sortBy === col && (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
        </span>
      </TableHead>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Who orders get placed against.</p>
        </div>
        {canManage && <CreateCustomerDialog onCreated={load} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, email, or phone…"
          className="max-w-xs"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {sortHeader('name', 'Name')}
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Marketing</TableHead>
              {sortHeader('createdAt', 'Added')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {customers?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            )}
            {customers?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{c.phone ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.unsubscribedAt ? 'Unsubscribed' : c.marketingOptIn ? 'Opted in' : 'Not opted in'}
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateCustomerDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/customers', { method: 'POST', body: { name, email: email || undefined, phone: phone || undefined } });
      toast.success('Customer added');
      setOpen(false);
      setName('');
      setEmail('');
      setPhone('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add customer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        New customer
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>Customers are who orders get placed against.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} minLength={1} maxLength={150} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !name}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Add customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
