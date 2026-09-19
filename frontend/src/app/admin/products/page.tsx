'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, X, Tags, ArrowUp, ArrowDown, Download, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth-context';
import { api, apiDownload, ApiError } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions';
import { productAccent } from '@/lib/product-accent';
import type { Product } from '@/lib/types';
import { ProductEditor, VariantPriceEditor } from '@/components/admin/product-editor';

function status(p: Product): 'Draft' | 'Published' | 'Archived' {
  if (p.archivedAt) return 'Archived';
  if (p.publishedAt) return 'Published';
  return 'Draft';
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  Published: 'default',
  Draft: 'secondary',
  Archived: 'destructive',
};

type SortBy = 'createdAt' | 'priceCents' | 'name';

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const canManage = hasPermission(PERMISSIONS.CATALOG_PRODUCTS_MANAGE);

  const category = searchParams.get('category') ?? '';
  const filterStatus = searchParams.get('status') ?? '';
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
    if (category) params.set('category', category);
    if (filterStatus) params.set('status', filterStatus);
    if (search) params.set('search', search);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('includeArchived', 'true');
    api<Product[]>(`/products?${params.toString()}`)
      .then((p) => {
        setProducts(p);
        setSelected((prev) => new Set([...prev].filter((id) => p.some((x) => x.id === id))));
        // ponytail: category list derived from the loaded page, not a dedicated endpoint.
        setAllCategories((prev) => [...new Set([...prev, ...p.map((x) => x.category)])].sort());
      })
      .catch(() => toast.error('Failed to load products'));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [category, filterStatus, search, sortBy, sortDir]);

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

  async function transition(id: string, action: 'publish' | 'unpublish' | 'archive') {
    setBusyId(id);
    try {
      await api(`/products/${id}/${action}`, { method: 'POST' });
      toast.success(`Product ${action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'archived'}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${action} product`);
    } finally {
      setBusyId(null);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ponytail: reuses the existing per-id transition endpoints in parallel — no dedicated bulk API.
  async function bulkTransition(action: 'publish' | 'unpublish' | 'archive') {
    const ids = [...selected];
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => api(`/products/${id}/${action}`, { method: 'POST' })));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed) toast.error(`${failed} of ${ids.length} products failed to ${action}`);
      else toast.success(`${ids.length} product${ids.length === 1 ? '' : 's'} ${action === 'publish' ? 'published' : action === 'unpublish' ? 'unpublished' : 'archived'}`);
      setSelected(new Set());
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Draft products until they&apos;re sellable, then publish them.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => apiDownload('/products/export', 'products.csv').catch(() => toast.error('Export failed'))}>
            <Download className="size-4" />
            Export CSV
          </Button>
          {canManage && <ImportCsvButton onImported={load} />}
          {canManage && <CreateProductDialog onCreated={load} />}
        </div>
      </div>

      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkTransition('publish')}>Publish</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkTransition('unpublish')}>Unpublish</Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={bulkBusy} />}>Archive</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {selected.size} product{selected.size === 1 ? '' : 's'}?</AlertDialogTitle>
                <AlertDialogDescription>Archived products are hidden by default and can&apos;t be added to new orders.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => bulkTransition('archive')}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name or SKU…"
          className="max-w-xs"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select value={category || 'all'} onValueChange={(v) => setParams({ category: v === 'all' ? null : (v as string) })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus || 'all'} onValueChange={(v) => setParams({ status: v === 'all' ? null : (v as string) })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all products"
                    checked={!!products?.length && selected.size === products.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(products?.map((p) => p.id)) : new Set())}
                  />
                </TableHead>
              )}
              {sortHeader('name', 'Name')}
              <TableHead>SKU</TableHead>
              {sortHeader('priceCents', 'Price')}
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canManage ? 6 : 4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {products?.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 4} className="py-10 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            )}
            {products?.map((p) => {
              const s = status(p);
              return (
                <TableRow key={p.id}>
                  {canManage && (
                    <TableCell>
                      <input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external URLs, not a local/optimizable asset
                        <img src={p.imageUrl} alt="" className="size-8 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div
                          aria-hidden
                          className="size-8 shrink-0 rounded-md"
                          style={{ background: productAccent(p.id) }}
                        />
                      )}
                      {p.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                  <TableCell>
                    {(p.priceCents / 100).toLocaleString(undefined, { style: 'currency', currency: p.currency })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[s]}>{s}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ProductEditor product={p} onSaved={load} />
                        <VariantsDialog product={p} onChanged={load} />
                        {s === 'Draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === p.id}
                            onClick={() => transition(p.id, 'publish')}
                          >
                            Publish
                          </Button>
                        )}
                        {s === 'Published' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === p.id}
                            onClick={() => transition(p.id, 'unpublish')}
                          >
                            Unpublish
                          </Button>
                        )}
                        {s !== 'Archived' && (
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="sm" disabled={busyId === p.id} />}>
                              Archive
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive {p.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Archived products are hidden by default and can&apos;t be added to new orders.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => transition(p.id, 'archive')}>Archive</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateProductDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/products', {
        method: 'POST',
        body: {
          sku,
          name,
          priceCents: Number(priceCents),
          imageUrl: imageUrl || undefined,
          gstRateBps: gstRate ? Math.round(Number(gstRate) * 100) : undefined,
          hsnCode: hsnCode || undefined,
        },
      });
      toast.success('Product created');
      setOpen(false);
      setSku('');
      setName('');
      setPriceCents('');
      setImageUrl('');
      setGstRate('');
      setHsnCode('');
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        New product
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create product</DialogTitle>
            <DialogDescription>Starts as a draft. Publish it once it&apos;s ready to sell.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} minLength={1} maxLength={60} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} minLength={1} maxLength={200} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priceCents">Price (minor units)</Label>
              <Input
                id="priceCents"
                type="number"
                min={0}
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://images.example.com/product.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="gstRate">GST rate % (optional)</Label>
                <Input id="gstRate" type="number" min={0} max={28} step={0.01} value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hsnCode">HSN code (optional)</Label>
                <Input id="hsnCode" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} maxLength={8} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !sku || !name || !priceCents}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function money(cents: number, currency: string) {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency });
}

/**
 * A product's sellable options — label is free text ("Half"/"Full", "70 Gram"/"1 Kg", anything
 * else a seller sells by), not a fixed weight/size field. No variants = the product just sells
 * at its own price, unchanged.
 */
function VariantsDialog({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function addVariant(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api(`/products/${product.id}/variants`, { method: 'POST', body: { label, priceCents: Number(priceCents) } });
      setLabel('');
      setPriceCents('');
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add variant');
    } finally {
      setAdding(false);
    }
  }

  async function archiveVariant(variantId: string) {
    setBusyId(variantId);
    try {
      await api(`/products/${product.id}/variants/${variantId}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to remove variant');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Tags className="size-4" />
        Variants{product.variants.length > 0 && ` (${product.variants.length})`}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name} — variants</DialogTitle>
          <DialogDescription>
            Sellable options with their own price — size, weight, or anything else. No variants means
            the product just sells at {money(product.priceCents, product.currency)}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {product.variants.length > 0 && (
            <ul className="grid gap-2">
              {product.variants.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{v.label}</span>
                  <div className="flex items-center gap-2">
                    <VariantPriceEditor productId={product.id} variant={v} onSaved={onChanged} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busyId === v.id}
                      onClick={() => archiveVariant(v.id)}
                      aria-label={`Remove ${v.label}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addVariant} className="flex items-end gap-2">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="variant-label" className="text-xs">
                Label
              </Label>
              <Input
                id="variant-label"
                placeholder="e.g. 500 Gram, Half, Full"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                minLength={1}
                maxLength={60}
                required
              />
            </div>
            <div className="grid w-28 gap-1.5">
              <Label htmlFor="variant-price" className="text-xs">
                Price
              </Label>
              <Input
                id="variant-price"
                type="number"
                min={0}
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="icon" disabled={adding || !label || !priceCents} aria-label="Add variant">
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvButton({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const csv = await file.text();
      const result = await api<{ created: number; updated: number; errors: string[] }>('/products/import', { method: 'POST', body: { csv } });
      toast.success(`Imported: ${result.created} created, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} row(s) skipped` : ''}`);
      if (result.errors.length) result.errors.forEach((msg) => toast.error(msg));
      onImported();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} nativeButton={false} render={<label />}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      Import CSV
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} disabled={busy} />
    </Button>
  );
}
