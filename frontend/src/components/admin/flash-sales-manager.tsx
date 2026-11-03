'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import {
  createFlashSale,
  deleteFlashSale,
  updateFlashSale,
} from '@/app/(admin)/admin/(dashboard)/flash-sales/actions';
import { Badge } from '@/components/admin-ui/badge';
import { Button } from '@/components/admin-ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/admin-ui/dropdown-menu';
import { formatDate, formatMoney } from '@/lib/format';
import type { FlashSale, FlashSaleStatus, Product } from '@/lib/types';

const STATUS_VARIANT: Record<FlashSaleStatus, 'default' | 'secondary' | 'outline'> = {
  ongoing: 'default',
  upcoming: 'secondary',
  expired: 'outline',
};

/** ISO string -> value a <input type="datetime-local"> accepts (local, no tz). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Draft = { id: string | null; product_id: string; sale_price: string; starts_at: string; ends_at: string };
const BLANK: Draft = { id: null, product_id: '', sale_price: '', starts_at: '', ends_at: '' };

/** Admin flash-sale list with an inline add/edit form. Status is derived server
 *  side, so a page refresh reflects upcoming -> ongoing -> expired transitions. */
export function FlashSalesManager({
  sales,
  products,
  canWrite,
}: {
  sales: FlashSale[];
  products: Pick<Product, 'id' | 'name'>[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(sale: FlashSale) {
    setDraft({
      id: sale.id,
      product_id: sale.product_id,
      sale_price: (sale.sale_price_cents / 100).toString(),
      starts_at: toLocalInput(sale.starts_at),
      ends_at: toLocalInput(sale.ends_at),
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.product_id || !draft.starts_at || !draft.ends_at) {
      return toast.error('Pick a product and a start and end time.');
    }
    const cents = Math.round(Number(draft.sale_price) * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast.error('Enter a valid sale price.');
    if (new Date(draft.ends_at) <= new Date(draft.starts_at)) {
      return toast.error('The end must be after the start.');
    }
    const input = {
      product_id: draft.product_id,
      sale_price_cents: cents,
      starts_at: new Date(draft.starts_at).toISOString(),
      ends_at: new Date(draft.ends_at).toISOString(),
    };
    setBusy(true);
    const result = draft.id
      ? await updateFlashSale(draft.id, input)
      : await createFlashSale(input);
    setBusy(false);
    if (!result.ok) return toast.error(result.error?.message ?? 'Could not save the flash sale.');
    toast.success('Flash sale saved');
    setDraft(null);
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete the flash sale on "${name}"?`)) return;
    setBusy(true);
    const result = await deleteFlashSale(id);
    setBusy(false);
    if (!result.ok) return toast.error(result.error?.message ?? 'Could not delete the flash sale.');
    toast.success('Flash sale deleted');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setDraft(draft ? null : BLANK)} disabled={busy}>
            {draft ? 'Close' : 'Add flash sale'}
          </Button>
        </div>
      )}

      {draft && (
        <div className="card space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-medium text-ink-muted">
              Product
              <select
                className="input mt-1 h-10 w-full"
                value={draft.product_id}
                onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}
                disabled={!!draft.id} // product is fixed once the sale exists
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Sale price
              <input
                className="input mt-1 h-10 w-full"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 19.99"
                value={draft.sale_price}
                onChange={(e) => setDraft({ ...draft, sale_price: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Starts
              <input
                className="input mt-1 h-10 w-full"
                type="datetime-local"
                value={draft.starts_at}
                onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
              />
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Ends
              <input
                className="input mt-1 h-10 w-full"
                type="datetime-local"
                value={draft.ends_at}
                onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
            <Button type="button" size="sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Sale price</th>
              <th className="px-5 py-3 font-medium">Starts</th>
              <th className="px-5 py-3 font-medium">Ends</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Status</th>
              {canWrite && <th className="w-14 px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-paper-soft">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{sale.product_name}</div>
                  <div className="text-xs text-ink-faint line-through">{formatMoney(sale.product_price_cents, sale.currency)}</div>
                </td>
                <td className="px-5 py-3 font-medium">{formatMoney(sale.sale_price_cents, sale.currency)}</td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(sale.starts_at)}</td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(sale.ends_at)}</td>
                <td className="px-5 py-3 text-ink-soft">{sale.stock}</td>
                <td className="px-5 py-3"><Badge variant={STATUS_VARIANT[sale.status]}>{sale.status}</Badge></td>
                {canWrite && (
                  <td className="px-5 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Row actions" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={busy} onClick={() => startEdit(sale)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem disabled={busy} className="text-destructive focus:text-destructive" onClick={() => remove(sale.id, sale.product_name)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-ink-faint">No flash sales yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
