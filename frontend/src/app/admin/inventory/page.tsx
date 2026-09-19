'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
import type { InventoryItem } from '@/lib/types';

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const canAdjust = hasPermission(PERMISSIONS.INVENTORY_STOCK_ADJUST);

  function load() {
    api<InventoryItem[]>('/inventory')
      .then(setItems)
      .catch(() => toast.error('Failed to load inventory'));
  }

  useEffect(load, []);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground">Stock on hand for every product in your catalog.</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Reorder threshold</TableHead>
              {canAdjust && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={canAdjust ? 5 : 4}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.product.sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.quantityOnHand}
                    {item.quantityOnHand <= item.reorderThreshold && <Badge variant="destructive">Low stock</Badge>}
                  </div>
                </TableCell>
                <TableCell>{item.reorderThreshold}</TableCell>
                {canAdjust && (
                  <TableCell className="text-right">
                    <AdjustStockDialog productId={item.productId} productName={item.product.name} onAdjusted={load} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AdjustStockDialog({
  productId,
  productName,
  onAdjusted,
}: {
  productId: string;
  productName: string;
  onAdjusted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api(`/inventory/${productId}/adjust`, { method: 'POST', body: { delta: Number(delta), reason } });
      toast.success('Stock adjusted');
      setOpen(false);
      setDelta('');
      setReason('');
      onAdjusted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Adjust</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>{productName}. Use a negative number to remove stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delta">Delta</Label>
              <Input
                id="delta"
                type="number"
                min={-1_000_000}
                max={1_000_000}
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={500} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !delta}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Adjust
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
