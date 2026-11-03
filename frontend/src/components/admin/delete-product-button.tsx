'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { deleteProduct } from '@/app/(admin)/admin/(dashboard)/products/actions';
import { Button } from '@/components/admin-ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/admin-ui/dialog';

/** Delete a product with a confirm step, then return to the list. */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    const result = await deleteProduct(id);
    if (!result.ok) {
      setPending(false);
      toast.error(result.error?.message ?? 'Could not delete the product.');
      return;
    }
    setOpen(false);
    router.push('/admin/products');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>Delete</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={pending} onClick={onDelete}>{pending ? 'Deleting…' : 'Delete'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
