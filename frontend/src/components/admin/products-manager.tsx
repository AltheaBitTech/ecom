'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { toast } from 'sonner';

import { deleteProduct, deleteProducts } from '@/app/(admin)/admin/(dashboard)/products/actions';
import { RowActions } from '@/components/admin/row-actions';
import { Badge } from '@/components/admin-ui/badge';
import { Button } from '@/components/admin-ui/button';
import { formatMoney } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

const STATUS_VARIANT: Record<Product['status'], 'default' | 'secondary' | 'outline'> = {
  ACTIVE: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
};
type Label = 'all' | 'featured' | 'bestseller' | 'on-sale';
const LABELS: Array<{ id: Label; text: string }> = [
  { id: 'all', text: 'All labels' },
  { id: 'featured', text: 'Featured' },
  { id: 'bestseller', text: 'Bestseller' },
  { id: 'on-sale', text: 'On sale' },
];

/** Interactive product catalog: search + category "folder" + label filters,
 *  per-row actions menu (edit/delete), and checkbox bulk-delete. */
export function ProductsManager({ products, categories, canWrite }: { products: Product[]; categories: Category[]; canWrite: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all'); // 'all' | 'none' | categoryId
  const [label, setLabel] = useState<Label>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
      if (category === 'none' ? p.category_id : category !== 'all' && p.category_id !== category) return false;
      if (label === 'featured' && !p.is_featured) return false;
      if (label === 'bestseller' && !p.is_bestseller) return false;
      if (label === 'on-sale' && !p.compare_at_price_cents) return false;
      return true;
    });
  }, [products, query, category, label]);

  const allShownSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allShownSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  async function removeOne(id: string) {
    setBusy(true);
    const result = await deleteProduct(id);
    setBusy(false);
    if (!result.ok) return toast.error(result.error?.message ?? 'Could not delete the product.');
    toast.success('Product deleted');
    router.refresh();
  }

  async function removeSelected() {
    const ids = [...selected];
    if (!window.confirm(`Delete ${ids.length} selected product${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBusy(true);
    const result = await deleteProducts(ids);
    setBusy(false);
    if (!result.ok) toast.error(result.error?.message ?? 'Some products could not be deleted.');
    else toast.success(`${ids.length} product${ids.length > 1 ? 's' : ''} deleted`);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input h-10 w-full max-w-xs"
          placeholder="Search name or slug…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input h-10 w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category folder">
          <option value="all">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="input h-10 w-auto" value={label} onChange={(e) => setLabel(e.target.value as Label)} aria-label="Filter by label">
          {LABELS.map((l) => <option key={l.id} value={l.id}>{l.text}</option>)}
        </select>
        <span className="ml-auto text-xs text-ink-faint">{filtered.length} of {products.length}</span>
      </div>

      {canWrite && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-sm font-medium text-red-700">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(new Set())} disabled={busy}>Clear</Button>
            <Button type="button" variant="destructive" size="sm" onClick={removeSelected} disabled={busy}>{busy ? 'Deleting…' : 'Delete selected'}</Button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              {canWrite && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-[#ff5c35]" />
                </th>
              )}
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              {canWrite && <th className="w-14 px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((product) => (
              <tr key={product.id} className={selected.has(product.id) ? 'bg-red-50/40' : 'hover:bg-paper-soft'}>
                {canWrite && (
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggle(product.id)} aria-label={`Select ${product.name}`} className="h-4 w-4 accent-[#ff5c35]" />
                  </td>
                )}
                <td className="px-5 py-3">
                  {canWrite ? (
                    <Link href={`/admin/products/${product.id}/edit`} className="font-medium text-ink hover:text-brand">{product.name}</Link>
                  ) : (
                    <div className="font-medium text-ink">{product.name}</div>
                  )}
                  <div className="text-xs text-ink-faint">{product.slug}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {product.is_featured && <span className="rounded-full bg-[#c8ff4d] px-2 py-0.5 text-[9px] font-bold uppercase text-[#151517]">Featured</span>}
                    {product.is_bestseller && <span className="rounded-full bg-[#ff5c35] px-2 py-0.5 text-[9px] font-bold uppercase text-white">Bestseller</span>}
                    {product.badge && <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-[9px] font-bold uppercase text-ink-muted">{product.badge}</span>}
                  </div>
                </td>
                <td className="px-5 py-3 text-ink-soft">{product.category_id ? catName.get(product.category_id) ?? '—' : <span className="text-ink-faint">Uncategorized</span>}</td>
                <td className="px-5 py-3"><Badge variant={STATUS_VARIANT[product.status]}>{product.status.toLowerCase()}</Badge></td>
                <td className="px-5 py-3">{formatMoney(product.price_cents, product.currency)}</td>
                <td className="px-5 py-3 text-ink-soft">{product.stock}</td>
                {canWrite && (
                  <td className="px-5 py-3 text-right">
                    <RowActions editHref={`/admin/products/${product.id}/edit`} itemLabel={product.name} deleting={busy} onDelete={() => removeOne(product.id)} />
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-faint">No products match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
